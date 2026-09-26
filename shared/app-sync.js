// ミニアプリのデータをクラウド(Supabase)と同期する共通ヘルパー。
//
// このファイルには2世代のAPIが同居している:
//
//   [旧API] isLoggedIn / pull / push / pushNow
//     低レベルな読み書き。daily-todo が使っているため残してある。
//     新しいアプリでは使わないこと。
//
//   [新API] AppSync.store(appSlug, key, options)
//     同期ロジック(初回マージ・競合解決・デバウンス・再送・タブ間反映・
//     復帰時の再取得・トースト表示)を全部こちら側で持つ。
//     アプリ側に残るコードは get() / set() / subscribe() だけになる。
//
// ------------------------------------------------------------------
// 新APIの使い方
// ------------------------------------------------------------------
//   <script src="../../supabase-config.js"></script>
//   <script src="../../app-sync.js"></script>
//
//   let store;
//   (async function () {
//     store = await AppSync.store('daily-wins', 'wins', {
//       default: [],            // データが無いときの初期値
//       version: 1,             // アプリ側データ構造のバージョン
//       legacyKey: 'dailyWins', // 旧localStorageキーがあれば吸い上げる
//       migrate: function (data, fromVersion) { return data; }
//     });
//
//     render(store.get());               // 起動時の描画
//     store.subscribe(function (value) { // 他デバイス/他タブの変更で再描画
//       render(value);
//     });
//   })();
//
//   function save(newValue) {
//     store.set(newValue);   // ローカルは即時保存、クラウドは自動でまとめ送信
//   }
//
// 2つの約束事:
//   ・get() は毎回コピーを返す。受け取った値をそのまま書き換えて set() してよい。
//   ・subscribe は「他デバイス・他タブ由来の変更」でしか呼ばれない。
//     自分の set() では呼ばれないので、アプリ側で source を見分ける必要はない。
//
// beforeunload / visibilitychange / storage の登録も、
// 「別のデバイスの変更を読み込みました」トーストも、このファイルが自前でやる。
// アプリ側には一切書かない。
//
// ------------------------------------------------------------------
// 所有者チェック
// ------------------------------------------------------------------
// 同じブラウザで「ユーザーAでログイン → ログアウト → ユーザーBでログイン」
// をすると、localStorageにはAのデータが残ったままになる。これをBのものとして
// 扱うと、Aのtのほうが新しい場合にBのクラウドデータを上書きしてしまう。
//
// 対策として、エンベロープに所有者 o(owner_id)を持たせ、起動時に現在の
// セッションと突き合わせる。別人のデータなら採用せず、リモートだけを使う。
// アプリ側で意識することは何もない。
// ------------------------------------------------------------------

window.AppSync = (function () {
  // ================================================================
  // 旧API(削除しないこと。daily-todo が依存している)
  // ================================================================
  const PUSH_DEBOUNCE_MS = 1500;
  const pushTimers = {};

  async function isLoggedIn() {
    const { data } = await supabaseClient.auth.getSession();
    return !!data.session;
  }

  // クラウド側の値を取得する。行がなければnullを返す。
  // 戻り値: { value, updatedAt } | null
  async function pull(appSlug, key) {
    const { data: session } = await supabaseClient.auth.getSession();
    if (!session.session) return null;

    const { data, error } = await supabaseClient
      .from('user_app_data')
      .select('value, updated_at')
      .eq('owner_id', session.session.user.id)
      .eq('app_slug', appSlug)
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.error('AppSync.pull エラー:', error.message);
      return null;
    }
    if (!data) return null;

    return { value: data.value, updatedAt: new Date(data.updated_at).getTime() };
  }

  // 即座にクラウドへ保存する(await可能)。移行アップロード等、確実に完了を待ちたい場合に使う。
  async function pushNow(appSlug, key, value, updatedAtMs) {
    const { data: session } = await supabaseClient.auth.getSession();
    if (!session.session) return false;

    const { error } = await supabaseClient.from('user_app_data').upsert({
      owner_id: session.session.user.id,
      app_slug: appSlug,
      key: key,
      value: value,
      updated_at: new Date(updatedAtMs || Date.now()).toISOString()
    });

    if (error) {
      console.error('AppSync.push エラー:', error.message);
      return false;
    }
    return true;
  }

  // 通常の保存操作から呼ぶ用。連続保存をまとめるため少し遅延させてから送る。
  function push(appSlug, key, value, updatedAtMs) {
    const timerKey = appSlug + ':' + key;
    if (pushTimers[timerKey]) clearTimeout(pushTimers[timerKey]);
    pushTimers[timerKey] = setTimeout(function () {
      pushNow(appSlug, key, value, updatedAtMs);
    }, PUSH_DEBOUNCE_MS);
  }

  // ================================================================
  // 新API: AppSync.store()
  // ================================================================

  const ENVELOPE_VERSION = 1;          // エンベロープ形式のバージョン
  const DEFAULT_DEBOUNCE_MS = 1000;    // リモート書き込みの遅延
  const MAX_VALUE_BYTES = 256 * 1024;  // 1レコードの上限(超えたらエラー)
  const REVISIT_PULL_COOLDOWN_MS = 30 * 1000; // 復帰時の再pullを抑制する間隔
  const MAX_PUSH_ATTEMPTS = 3;         // リモート書き込みのリトライ回数
  const RETRY_BASE_MS = 500;           // 指数バックオフの基準

  const registry = [];        // 生成済みStoreの一覧(全体flush/refresh用)
  const registryByLsKey = {}; // localStorageキー → Store(storageイベント用)
  let globalHandlersReady = false;

  // ----------------------------------------------------------------
  // appSlug の扱いはここ1箇所に閉じ込める。
  //
  // 【将来への申し送り】
  // 現在 appSlug はクライアントが自己申告しているだけで、他アプリのデータを
  // 名乗って読み書きすることを技術的には防げていない(RLSは owner_id しか見ない)。
  // ユーザー投稿アプリを受け入れる段階では、サーバー発行トークンに含まれる
  // アプリ識別子へ差し替える必要がある。その差し替えをこの関数の中だけで
  // 済ませられるよう、他の場所では生の appSlug を触らないこと。
  // ----------------------------------------------------------------
  function resolveAppSlug(appSlug) {
    if (typeof appSlug !== 'string' || !appSlug) {
      throw new Error('AppSync.store: appSlug が不正です');
    }
    return appSlug;
  }

  function storageKeyFor(appSlug, key) {
    return 'appdata:' + resolveAppSlug(appSlug) + ':' + key;
  }

  // --- Supabaseが使えるかどうか -----------------------------------
  // CDN読込に失敗すると supabase-config.js ごと落ちて supabaseClient が
  // 未定義になる。typeof で参照すれば ReferenceError にならない。
  function hasSupabase() {
    return (
      typeof supabaseClient !== 'undefined' &&
      supabaseClient &&
      supabaseClient.auth &&
      typeof supabaseClient.from === 'function'
    );
  }

  async function getSessionSafe() {
    if (!hasSupabase()) return null;
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) return null;
      return data && data.session ? data.session : null;
    } catch (e) {
      return null;
    }
  }

  // --- エンベロープ ------------------------------------------------
  // 保存形式: { v: 1, av: <アプリ側バージョン>, t: <時刻ms>, o: <owner_id>, d: <本体> }
  // 競合比較には updated_at ではなく t を使う(サーバー時刻とクライアント時刻の
  // 混在を避けるため。ただし端末の時計がずれていると比較もずれる点は承知の上)。
  //
  // o は所有者チェック用。同じブラウザでユーザーAがログアウトし、ユーザーBが
  // ログインしたとき、localStorageに残ったAのデータをBのものとして扱ってしまう
  // (しかもAのtが新しければBのクラウドを上書きしてしまう)のを防ぐ。
  // v は 1 のまま据え置き。o の有無で移行前データかどうかを判別できるため。
  function makeEnvelope(data, appVersion, t, owner) {
    return {
      v: ENVELOPE_VERSION,
      av: appVersion,
      // t は 0(最古)を意図的に渡すことがあるので、|| で判定しない。
      // 0 は falsy なので t || Date.now() だと今の時刻に戻ってしまう。
      t: typeof t === 'number' ? t : Date.now(),
      o: owner === undefined ? null : owner,
      d: data
    };
  }

  // o の解釈:
  //   undefined(キーなし) → 移行前のデータ。持ち主未設定として扱う
  //   null                → 未ログイン中に作られたデータ。持ち主未設定
  //   文字列              → その owner_id のもの。別ユーザーは触ってはいけない
  function ownerOf(envelope) {
    if (!envelope || envelope.o === undefined || envelope.o === null) return null;
    return envelope.o;
  }

  // 「別ユーザーのデータか」。持ち主未設定は false(現ユーザーが引き受けられる)。
  // 未ログイン(owner が null)のときは判定不能なので false を返す。
  function isForeign(envelope, owner) {
    const o = ownerOf(envelope);
    return o !== null && owner !== null && o !== owner;
  }

  // t を変えずに o だけ書き換える。競合解決ロジックに影響を与えないため。
  function stampOwner(envelope, owner) {
    if (ownerOf(envelope) === owner) return envelope;
    return { v: envelope.v, av: envelope.av, t: envelope.t, o: owner, d: envelope.d };
  }

  function isEnvelope(o) {
    return (
      o !== null &&
      typeof o === 'object' &&
      typeof o.v === 'number' &&
      typeof o.t === 'number' &&
      Object.prototype.hasOwnProperty.call(o, 'd')
    );
  }

  function readLocalEnvelope(lsKey) {
    let raw;
    try {
      raw = localStorage.getItem(lsKey);
    } catch (e) {
      return null; // プライベートモード等でlocalStorageが使えない
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return isEnvelope(parsed) ? parsed : null;
    } catch (e) {
      console.warn('AppSync: ローカルデータが壊れています:', lsKey);
      return null;
    }
  }

  function writeLocalEnvelope(lsKey, envelope) {
    localStorage.setItem(lsKey, JSON.stringify(envelope));
  }

  function byteSize(str) {
    try {
      return new Blob([str]).size;
    } catch (e) {
      return str.length * 2; // 概算フォールバック
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // get() / set() の境界で値をコピーする。
  //
  // 旧localStorage版は読むたびに JSON.parse していたので、アプリ側は
  // 「取得 → その場で書き換え → 保存」という書き方をしている。ここで参照を
  // 返すと、保存前の中間状態がキャッシュに見えてしまう(subscribe の受け手や
  // 別の描画処理が、まだ保存していない値を読むことになる)。
  //
  // JSON経由にしているのは structuredClone より速いからではなく、保存時に
  // 実際に通る変換と同じ結果にするため。Date が文字列になる等のズレを
  // リロード後ではなく get() の時点で表面化させる。
  function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return value; // 循環参照など。コピーできない値はそのまま返す
    }
  }

  // --- 共通トースト ------------------------------------------------
  // アプリ側にUIを書かせないため、このファイルが要素とスタイルを自分で作る。
  let toastStyleInjected = false;

  function showToast(message) {
    if (typeof document === 'undefined' || !document.body) return;

    if (!toastStyleInjected) {
      const style = document.createElement('style');
      style.textContent =
        '.appsync-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
        'max-width:min(90vw,420px);padding:10px 16px;border-radius:999px;' +
        'background:rgba(35,31,28,.92);color:#fff;font-size:14px;line-height:1.4;' +
        'text-align:center;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);' +
        'opacity:0;transition:opacity .2s ease}' +
        '.appsync-toast.is-visible{opacity:1}' +
        '@media (prefers-reduced-motion:reduce){.appsync-toast{transition:none}}';
      document.head.appendChild(style);
      toastStyleInjected = true;
    }

    const el = document.createElement('div');
    el.className = 'appsync-toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.remove(); }, 250);
    }, 3200);
  }

  // ----------------------------------------------------------------
  // Store 本体
  // ----------------------------------------------------------------
  function createStore(appSlug, key, options) {
    const opts = options || {};
    const slug = resolveAppSlug(appSlug);
    const lsKey = storageKeyFor(slug, key);
    const appVersion = typeof opts.version === 'number' ? opts.version : 1;
    const debounceMs = typeof opts.debounce === 'number' ? opts.debounce : DEFAULT_DEBOUNCE_MS;
    const defaultValue = Object.prototype.hasOwnProperty.call(opts, 'default') ? opts.default : null;
    const migrate = typeof opts.migrate === 'function' ? opts.migrate : null;
    const legacyKey = typeof opts.legacyKey === 'string' ? opts.legacyKey : null;

    let cache = clone(defaultValue); // メモリ上の真実。get()はこれのコピーを返す
    let cacheT = 0;             // cacheに対応する更新時刻(競合比較用)
    let cacheO = null;          // cacheの所有者(owner_id)。未ログイン時はnullのまま保つ
    let currentOwner = null;    // 現在ログイン中のowner_id。未ログインならnull
    let loggedIn = false;       // このstoreがリモートを使ってよいか
    let subscribers = [];
    let debounceTimer = null;
    let pending = null;         // 未送信のエンベロープ
    let pushing = false;        // 送信中フラグ(多重送信の防止)
    let currentPush = null;     // 送信中のPromise(flushが待てるように保持)
    let lastPullAt = 0;
    let state = { online: false, syncing: false, lastSyncedAt: null, error: null };

    function notify(source) {
      subscribers.slice().forEach(function (cb) {
        try {
          cb(cache, source);
        } catch (e) {
          console.error('AppSync: subscribe コールバックでエラー:', e);
        }
      });
    }

    function refreshOnline() {
      state.online = loggedIn && hasSupabase() && (typeof navigator === 'undefined' || navigator.onLine !== false);
    }

    // --- リモートI/O ------------------------------------------------
    async function pullRemote() {
      const session = await getSessionSafe();
      if (!session) return { ok: false, envelope: null, unauthorized: true };

      try {
        const { data, error } = await supabaseClient
          .from('user_app_data')
          .select('value, updated_at')
          .eq('owner_id', session.user.id)
          .eq('app_slug', slug)
          .eq('key', key)
          .maybeSingle();

        lastPullAt = Date.now();

        if (error) {
          return { ok: false, envelope: null, unauthorized: isAuthError(error) };
        }
        if (!data || !isEnvelope(data.value)) {
          return { ok: true, envelope: null };
        }
        return { ok: true, envelope: data.value };
      } catch (e) {
        return { ok: false, envelope: null };
      }
    }

    function isAuthError(error) {
      if (!error) return false;
      const status = error.status || error.code;
      if (status === 401 || status === '401') return true;
      const msg = (error.message || '').toLowerCase();
      return msg.indexOf('jwt') !== -1 || msg.indexOf('not authenticated') !== -1;
    }

    // upsert では updated_at を送らない。サーバーの default now() に任せ、
    // 競合解決は value.t で行う。
    async function upsertRemote(envelope) {
      const session = await getSessionSafe();
      if (!session) return { ok: false, unauthorized: true };

      try {
        const { error } = await supabaseClient.from('user_app_data').upsert(
          {
            owner_id: session.user.id,
            app_slug: slug,
            key: key,
            value: envelope
          },
          { onConflict: 'owner_id,app_slug,key' }
        );
        if (error) return { ok: false, unauthorized: isAuthError(error), message: error.message };
        return { ok: true };
      } catch (e) {
        return { ok: false, message: e && e.message };
      }
    }

    // セッション切れ → ローカルモードへ縮退。データは失わない。
    function degradeToLocal(showMessage) {
      loggedIn = false;
      refreshOnline();
      if (showMessage) showToast('Session expired — sign in again to keep syncing');
    }

    // 未送信分を送る。失敗しても pending は残るので、次の set / flush で再送される。
    // 既に送信中なら、その完了を待つ(flush()が空振りしないように)。
    function pushPending() {
      if (!pending || !loggedIn) return Promise.resolve();
      if (pushing) return currentPush || Promise.resolve();
      currentPush = runPush();
      return currentPush;
    }

    async function runPush() {
      pushing = true;
      state.syncing = true;

      try {
        // 送信中に新しい set が来たら、その最新版まで続けて送る。
        while (pending && loggedIn) {
          const target = pending;
          let sent = false;

          for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt++) {
            const result = await upsertRemote(target);

            if (result.ok) {
              if (pending === target) pending = null;
              state.lastSyncedAt = Date.now();
              state.error = null;
              sent = true;
              break;
            }

            if (result.unauthorized) {
              degradeToLocal(true);
              state.error = 'unauthorized';
              return; // pending は残す(再ログイン後の set / flush で再送)
            }

            if (attempt < MAX_PUSH_ATTEMPTS - 1) {
              await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
            }
          }

          if (!sent) {
            state.error = 'sync failed';
            console.warn('AppSync: クラウド保存に失敗しました(ローカルには保存済みです)');
            return; // pending は残す。次の set / flush で再送される
          }
        }
      } finally {
        pushing = false;
        currentPush = null;
        state.syncing = false;
      }
    }

    function schedulePush() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        pushPending();
      }, debounceMs);
    }

    // --- 公開メソッド ------------------------------------------------
    // 呼び出し元が戻り値を直接書き換えても、キャッシュは汚れない。
    function get() {
      return clone(cache);
    }

    async function set(value) {
      // ログイン中は常に現ユーザーを所有者として書く。
      // 未ログイン時は既存の o を保つ(ログアウトしただけで持ち主の印を
      // 消してしまうと、次に別ユーザーがログインしたとき引き受けられてしまう)。
      const owner = loggedIn ? currentOwner : cacheO;

      // 呼び出し元がこの後 value を書き換えても、キャッシュにも未送信の
      // エンベロープにも影響しないよう、入口で1回だけ切り離す。
      const snapshot = clone(value);
      const envelope = makeEnvelope(snapshot, appVersion, Date.now(), owner);
      const json = JSON.stringify(envelope);

      // 上限超過は黙って切り捨てず、はっきり失敗させる。
      const size = byteSize(json);
      if (size > MAX_VALUE_BYTES) {
        throw new Error(
          'AppSync: データが大きすぎます (' + Math.round(size / 1024) + 'KB / 上限 ' +
          Math.round(MAX_VALUE_BYTES / 1024) + 'KB)'
        );
      }

      cache = snapshot;
      cacheT = envelope.t;
      cacheO = owner;

      try {
        localStorage.setItem(lsKey, json);
      } catch (e) {
        throw new Error('AppSync: ローカル保存に失敗しました: ' + (e && e.message));
      }

      // 自分の set() では subscribe を呼ばない。呼び出し元は自分の操作の結果を
      // 既に描画しているので二重描画になるし、描画処理が保存を伴う場合
      // (日付をまたいだ毎日タスクの正規化など)set → notify → set と往復する。
      // subscribe はリモート由来・別タブ由来の変更だけを運ぶ。

      if (!loggedIn) return;
      pending = envelope;
      schedulePush();
    }

    async function flush() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await pushPending();
    }

    function subscribe(cb) {
      if (typeof cb !== 'function') return function () {};
      subscribers.push(cb);
      return function unsubscribe() {
        subscribers = subscribers.filter(function (fn) { return fn !== cb; });
      };
    }

    function status() {
      refreshOnline();
      return {
        online: state.online,
        syncing: state.syncing,
        lastSyncedAt: state.lastSyncedAt,
        error: state.error
      };
    }

    // --- 内部: 他タブ / 復帰時の反映 ----------------------------------
    // 同一デバイスの別タブがlocalStorageを書き換えたときに呼ばれる。
    function applyExternalLocal(envelope) {
      if (!envelope || envelope.t <= cacheT) return;
      // 別ユーザーのデータを書いた別タブがあっても取り込まない
      if (isForeign(envelope, currentOwner)) return;
      cache = envelope.d;
      cacheT = envelope.t;
      cacheO = ownerOf(envelope);
      notify('other-tab');
    }

    // タブ復帰時の再取得。前回pullから30秒未満ならスキップ。
    async function refreshFromRemote(force) {
      if (!loggedIn) return;
      if (!force && Date.now() - lastPullAt < REVISIT_PULL_COOLDOWN_MS) return;

      const res = await pullRemote();
      if (!res.ok) {
        if (res.unauthorized) degradeToLocal(true);
        return;
      }
      if (!res.envelope) return;
      if (res.envelope.t <= cacheT) return;

      // リモートは owner_id で絞って取得しているので必ず現ユーザーのもの。
      // 移行前データで o が無い場合に備えて押し直しておく。
      const applied = stampOwner(applyMigration(res.envelope), currentOwner);
      cache = applied.d;
      cacheT = applied.t;
      cacheO = ownerOf(applied);
      try {
        writeLocalEnvelope(lsKey, applied);
      } catch (e) {
        /* ローカル書き込み失敗はメモリ上の値を優先して続行 */
      }
      notify('remote');
      showToast('Loaded changes from another device');
    }

    // av がアプリ側の現行バージョンより古ければ migrate を通す。
    function applyMigration(envelope) {
      const from = typeof envelope.av === 'number' ? envelope.av : 1;
      if (!migrate || from >= appVersion) return envelope;
      try {
        const migrated = migrate(envelope.d, from);
        return makeEnvelope(migrated, appVersion, envelope.t, ownerOf(envelope));
      } catch (e) {
        console.error('AppSync: migrate に失敗しました。元データのまま続行します:', e);
        return envelope;
      }
    }

    // --- 初期化 ------------------------------------------------------
    async function init() {
      // 1. ローカルを読む
      let local = readLocalEnvelope(lsKey);

      // 2. 旧キーからの吸い上げ(新キーが空のときだけ)。
      //    切り戻せるように旧キーは削除しない。
      if (!local && legacyKey) {
        let legacyRaw = null;
        try {
          legacyRaw = localStorage.getItem(legacyKey);
        } catch (e) { /* localStorage不可 */ }
        if (legacyRaw !== null) {
          let legacyData;
          try {
            legacyData = JSON.parse(legacyRaw);
          } catch (e) {
            legacyData = legacyRaw; // JSONでなければ文字列としてそのまま扱う
          }
          // 更新時刻は Date.now() ではなく 0(最古)にする。
          // 旧キーのデータには「いつ更新されたか」の情報が無いため、
          // Date.now() を入れると必ずクラウドより新しい扱いになり、
          // 2台目の端末に残っていた古いデータがクラウドの最新を
          // 上書きして消してしまう。最古とみなせば、
          //   ・クラウドに行がある → クラウドが勝つ(データが消えない)
          //   ・クラウドが空       → そのままアップされる(初回移行は従来どおり)
          // となり、安全側に倒れる。
          local = makeEnvelope(legacyData, appVersion, 0);
          try {
            writeLocalEnvelope(lsKey, local);
          } catch (e) { /* 書けなくてもメモリ上では使える */ }
        }
      }

      const session = await getSessionSafe();
      loggedIn = !!session;
      currentOwner = session ? session.user.id : null;
      refreshOnline();

      // 3. 未ログイン(またはSupabase未読込)→ ローカルのみで確定。
      //    誰のデータか検証できないので所有者チェックはしないし、
      //    既存の o も書き換えない。
      if (!loggedIn) {
        finalize(local, false);
        return;
      }

      // 3.5 所有者チェック(他人のデータ混入の防止)
      //    同じブラウザでユーザーAがログアウトし、Bがログインした場合、
      //    localStorageにはAのデータが残っている。これをBのものとして扱うと、
      //    Aのtが新しければBのクラウドデータを上書きしてしまう。
      //    → ローカルは採用せず、リモートだけを使う。
      //    Aのデータは元々Aのクラウド行にあるので、Aが再ログインすれば戻る。
      if (local && isForeign(local, currentOwner)) {
        console.warn('AppSync: 別アカウントのローカルデータを検出したため使用しません');
        try {
          // 完全削除ではなく退避。万一Aがクラウドへ上げきれていなかった場合に
          // 手動で救出できるようにしておく(このキーは誰も読み込まない)。
          localStorage.setItem(lsKey + ':orphan', JSON.stringify(local));
          localStorage.removeItem(lsKey);
        } catch (e) { /* 消せなくても以降 local は使わない */ }
        local = null;
      }

      // 4. ログイン済み → pullして競合解決
      const res = await pullRemote();

      // pullが失敗してもエラーで止めない。localを採用してオフライン扱いで続行する。
      if (!res.ok) {
        if (res.unauthorized) degradeToLocal(false);
        state.error = 'offline';
        finalize(local, false);
        return;
      }

      const remote = res.envelope;

      // 3.6 持ち主不明のローカルデータ(o === null)は、クラウドに行がある限り採用しない。
      //     ログイン済みで保存したものには必ず o が入るので、o === null は
      //     「この端末で一度もログインせずに作られたデータ」か「旧キーから拾ったデータ」を指す。
      //     どちらも t は保存時刻(または0)で、前者はクラウドより新しくなりがち。
      //     そのまま競合解決にかけると、別端末で育てた本体データを
      //     ログイン前の下書きが消してしまうため、アカウントに紐づくクラウド側を正とする。
      //     クラウドに行が無い場合はこの分岐に入らないので、初回移行や
      //     ログイン前に貯めたデータはこれまでどおりアップロードされる。
      if (local && remote && ownerOf(local) === null) {
        console.warn('AppSync: 持ち主不明のローカルデータを検出したため、クラウド側を採用します');
        try {
          localStorage.removeItem(lsKey);
        } catch (e) { /* 消せなくても以降 local は使わない */ }
        local = null;
      }

      if (!local && !remote) {
        // 両方なし → default
        cache = clone(defaultValue);
        cacheT = 0;
        cacheO = currentOwner;
        return;
      }

      if (local && !remote) {
        // localのみ → 現ユーザーのものとして引き受け、リモートへ上げる
        const migrated = stampOwner(applyMigration(local), currentOwner);
        persistIfMigrated(local, migrated);
        cache = migrated.d;
        cacheT = migrated.t;
        cacheO = ownerOf(migrated);
        pending = migrated;
        await pushPending();
        return;
      }

      if (!local && remote) {
        // remoteのみ → ローカルにも書く
        const converted = applyMigration(remote);
        const migrated = stampOwner(converted, currentOwner);
        cache = migrated.d;
        cacheT = migrated.t;
        cacheO = ownerOf(migrated);
        try {
          writeLocalEnvelope(lsKey, migrated);
        } catch (e) { /* 続行 */ }
        // 中身が変換された場合だけ書き戻す(o を足しただけなら送り直さない)
        if (converted !== remote) {
          pending = migrated;
          await pushPending();
        }
        return;
      }

      // 両方あり → t を比較(この比較ロジックは従来どおり)
      if (local.t > remote.t) {
        const migrated = stampOwner(applyMigration(local), currentOwner);
        persistIfMigrated(local, migrated);
        cache = migrated.d;
        cacheT = migrated.t;
        cacheO = ownerOf(migrated);
        pending = migrated;
        await pushPending();
      } else if (remote.t > local.t) {
        const converted = applyMigration(remote);
        const migrated = stampOwner(converted, currentOwner);
        cache = migrated.d;
        cacheT = migrated.t;
        cacheO = ownerOf(migrated);
        try {
          writeLocalEnvelope(lsKey, migrated);
        } catch (e) { /* 続行 */ }
        // ローカルの値がリモート由来で置き換わったので通知+トースト
        notify('remote');
        showToast('Loaded changes from another device');
        if (converted !== remote) {
          pending = migrated;
          await pushPending();
        }
      } else {
        const migrated = stampOwner(applyMigration(local), currentOwner);
        persistIfMigrated(local, migrated);
        cache = migrated.d;
        cacheT = migrated.t;
        cacheO = ownerOf(migrated);
        if (migrated !== local) {
          pending = migrated;
          await pushPending();
        }
      }
    }

    // migrateで中身が変わったときだけローカルへ書き戻す
    function persistIfMigrated(original, migrated) {
      if (migrated === original) return;
      try {
        writeLocalEnvelope(lsKey, migrated);
      } catch (e) { /* 続行 */ }
    }

    function finalize(local, allowRemote) {
      if (!local) {
        cache = clone(defaultValue);
        cacheT = 0;
        cacheO = currentOwner;
        return;
      }
      // ここは未ログイン/オフライン確定の経路。o は既存のまま持ち越す。
      const migrated = applyMigration(local);
      persistIfMigrated(local, migrated);
      cache = migrated.d;
      cacheT = migrated.t;
      cacheO = ownerOf(migrated);
      if (allowRemote && migrated !== local) {
        pending = migrated;
        schedulePush();
      }
    }

    const store = {
      get: get,
      set: set,
      flush: flush,
      subscribe: subscribe,
      status: status,
      // 内部用(グローバルハンドラから呼ぶ)
      _applyExternalLocal: applyExternalLocal,
      _refreshFromRemote: refreshFromRemote,
      _lsKey: lsKey
    };

    return { store: store, init: init };
  }

  // ----------------------------------------------------------------
  // グローバルハンドラ(1回だけ登録。アプリ側には書かせない)
  // ----------------------------------------------------------------
  function ensureGlobalHandlers() {
    if (globalHandlersReady) return;
    globalHandlersReady = true;

    // 1. 離脱直前に未送信分を送る
    window.addEventListener('beforeunload', function () {
      registry.forEach(function (s) { s.flush(); });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        // 2. バックグラウンドへ回る時も送る(モバイルはbeforeunloadが来ないことがある)
        registry.forEach(function (s) { s.flush(); });
      } else {
        // 3. 復帰時は再pull(各storeが30秒のクールダウンを見る)
        registry.forEach(function (s) { s._refreshFromRemote(false); });
      }
    });

    // 4. 同一デバイスの別タブでの変更を取り込む
    window.addEventListener('storage', function (e) {
      if (!e.key || e.newValue === null) return;
      const s = registryByLsKey[e.key];
      if (!s) return;
      let envelope;
      try {
        envelope = JSON.parse(e.newValue);
      } catch (err) {
        return;
      }
      if (isEnvelope(envelope)) s._applyExternalLocal(envelope);
    });
  }

  // ----------------------------------------------------------------
  // 入口
  // ----------------------------------------------------------------
  async function store(appSlug, key, options) {
    const created = createStore(appSlug, key, options);
    await created.init();

    registry.push(created.store);
    registryByLsKey[created.store._lsKey] = created.store;
    ensureGlobalHandlers();

    return created.store;
  }

  return {
    // 旧API(残す)
    isLoggedIn: isLoggedIn,
    pull: pull,
    push: push,
    pushNow: pushNow,
    // 新API
    store: store
  };
})();
