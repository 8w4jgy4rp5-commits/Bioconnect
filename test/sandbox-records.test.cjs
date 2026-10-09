const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createDB, ids} = require('./db.cjs');
(async () => {
  const db = await createDB();
  try {
    await db.query(fs.readFileSync(path.join(__dirname,'../supabase/sandbox/records.sql'),'utf8'));
    const insert = 'insert into public.user_app_data(owner_id,app_slug,key,value) values($1,$2,$3,$4)';
    await assert.rejects(db.as(null,insert,[ids.a,'ecosystem-puzzle','score','{}'],'anon'));
    await db.as(ids.a,insert,[ids.a,'ecosystem-puzzle','score','{"best":100,"revived":true}']);
    await assert.rejects(db.as(ids.b,insert,[ids.a,'ecosystem-puzzle','met','{}']));
    assert.equal((await db.as(ids.b,'select * from public.user_app_data')).length,0);
    await assert.rejects(db.as(ids.a,insert,[ids.a,'ecosystem-puzzle','wallet','{}']));
    await assert.rejects(db.as(ids.a,insert,[ids.a,'other-app','score','{}']));
    await assert.rejects(db.as(ids.a,'update public.user_app_data set owner_id=$1',[ids.b]));
    await assert.rejects(db.as(ids.a,'delete from public.user_app_data'));
    await db.as(ids.a,'update public.user_app_data set value=$1 where owner_id=$2',['{"best":200,"revived":true}',ids.a]);
    assert.equal((await db.as(ids.a,'select value from public.user_app_data'))[0].value.best,200);
    console.log('Sandbox record RLS: owner-only read/insert/update; anonymous, foreign owner, money keys and delete rejected.');
  } finally { await db.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
