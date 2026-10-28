// Anonymous player-source counts (player_visits).
const assert = require('assert/strict');
const { randomUUID } = require('crypto');
const { createDB } = require('./db.cjs');
(async () => {
  const db = await createDB();
  try {
    const record = (visit, source, returning = false, lang = 'en-US') =>
      db.as(null, 'select public.bioconnect_record_visit($1,$2,$3,$4)', [visit, source, returning, lang], 'anon');
    const rows = async () => (await db.query('select source, repeat_player, lang from bioconnect_private.player_visits order by at, source'));
    const a = randomUUID();
    await record(a, 'x-bio'); await record(a, 'x-bio');
    await record(randomUUID(), 'T.CO', true, 'en-IN');
    await record(randomUUID(), '<script>', false, 'not a tag!!');
    const got = (await rows()).rows || await rows();
    assert.equal(got.length, 3); console.log('ok one row per visit, repeats ignored');
    assert.ok(got.some(r => r.source === 't.co' && r.repeat_player === true && r.lang === 'en-IN')); console.log('ok source is lowercased, language kept');
    assert.ok(got.some(r => r.source === 'other' && r.lang === null)); console.log('ok junk becomes other/null instead of failing');
    await assert.rejects(db.as(null, 'select count(*) from bioconnect_private.player_visits', [], 'anon'));
    await assert.rejects(db.as(null, 'select * from bioconnect_private.player_visits_daily', [], 'anon'));
    console.log('ok visitors cannot read the table or the summary');
    const daily = await db.query('select sum(players)::int as n from bioconnect_private.player_visits_daily');
    assert.equal((daily.rows || daily)[0].n, 3); console.log('ok daily summary adds up');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exit(1); });
