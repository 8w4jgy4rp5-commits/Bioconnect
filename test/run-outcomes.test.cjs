// Anonymous elephant counts behind the share card's rarity line.
const assert = require('assert/strict');
const { randomUUID } = require('crypto');
const { createDB } = require('./db.cjs');
(async () => {
  const db = await createDB();
  try {
    const record = (run, elephant, ticks = 50, rules = 21) =>
      db.as(null, 'select public.bioconnect_record_run($1,$2,$3,$4)', [run, rules, elephant, ticks], 'anon');
    const rate = async (rules = 21) =>
      (await db.as(null, 'select public.bioconnect_elephant_rate($1) as r', [rules], 'anon'))[0].r;
    const a = randomUUID(), b = randomUUID();
    await record(a, false); await record(b, true); await record(randomUUID(), false, 3);
    assert.deepEqual(await rate(), { runs: 2, elephants: 1 }); console.log('ok counts played runs; a tap-through is ignored');
    await record(a, true, 80); await record(b, false, 90);
    assert.deepEqual(await rate(), { runs: 2, elephants: 2 }); console.log('ok a revived run keeps an elephant from either ending');
    await record(randomUUID(), true, 50, 22);
    assert.deepEqual(await rate(), { runs: 2, elephants: 2 }); console.log('ok each rules version counts on its own');
    await assert.rejects(db.as(null, 'select count(*) from bioconnect_private.run_outcomes', [], 'anon'));
    console.log('ok the table itself is not readable by visitors');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exit(1); });
