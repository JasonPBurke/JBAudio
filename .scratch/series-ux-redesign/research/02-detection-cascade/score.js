'use strict';
const { detect, normKey, TIER_NAME } = require('./cascade.js');
const units = require('./units.json');
const truth = require('./ground_truth.json');

const ukey = u => u.rel + (u.flat ? ' :: ' + (u.album || u.file) : '');
const tOf = u => truth[ukey(u)] || { series: null, number: null, edition: null, multi: false };

function pairs(groups) {
  const s = new Set();
  for (const [, arr] of groups) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++)
    s.add(arr[i] < arr[j] ? arr[i] + '|' + arr[j] : arr[j] + '|' + arr[i]);
  return s;
}
function groupBy(items, keyFn) {
  const m = new Map();
  for (const it of items) { const k = keyFn(it); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(it.id); }
  return m;
}

function run(opts, label) {
  const { results, clusters } = detect(units, opts);
  const items = results.map((r, i) => ({ ...r, id: i, t: tOf(units[i]) }));

  // --- truth groups (strict = edition-aware; lenient = edition-collapsed)
  const tStrict = groupBy(items, it => it.t.multi ? it.t.series + '||' + (it.t.edition || '') : null);
  const tLenient = groupBy(items, it => it.t.multi ? it.t.series : null);
  const pStrict = groupBy(items.filter(i => i.name), it => it.key);

  const TP = pairs(tStrict), TL = pairs(tLenient), P = pairs(pStrict);
  const inter = [...P].filter(x => TP.has(x)).length;
  const interL = [...P].filter(x => TL.has(x)).length;
  const prec = P.size ? inter / P.size : 1, rec = TP.size ? inter / TP.size : 1;
  const precL = P.size ? interL / P.size : 1, recL = TL.size ? interL / TL.size : 1;
  const f1 = (p, r) => (p + r) ? 2 * p * r / (p + r) : 0;

  const inSeries = items.filter(i => i.t.multi);
  const standalone = items.filter(i => !i.t.series);
  const proposed = items.filter(i => i.name);

  console.log(`\n${'='.repeat(78)}\n${label}\n${'='.repeat(78)}`);
  console.log(`proposals: ${proposed.length}/${items.length} units placed into ${pStrict.size} proposed series`);
  console.log(`pairwise (edition-aware)   precision ${(prec*100).toFixed(1)}%  recall ${(rec*100).toFixed(1)}%  F1 ${(f1(prec,rec)*100).toFixed(1)}%`);
  console.log(`pairwise (edition-blind)   precision ${(precL*100).toFixed(1)}%  recall ${(recL*100).toFixed(1)}%  F1 ${(f1(precL,recL)*100).toFixed(1)}%`);

  // --- coverage of genuinely-in-series units
  const placed = inSeries.filter(i => i.name).length;
  console.log(`\ncoverage: ${placed}/${inSeries.length} (${(placed/inSeries.length*100).toFixed(1)}%) of units in a multi-book series got a proposal`);

  // --- hallucination: standalones swept into a group
  const halluc = standalone.filter(i => i.name);
  console.log(`hallucination: ${halluc.length}/${standalone.length} standalone units were placed in a series`);

  // --- per-confidence tier: precision of the pairs contributed at each tier
  console.log('\n  tier      units   name-correct   number-correct   standalone-swept');
  for (let t = 4; t >= 1; t--) {
    const at = proposed.filter(i => i.conf === t);
    if (!at.length) { console.log(`  ${TIER_NAME[t].padEnd(9)} ${'0'.padStart(5)}`); continue; }
    const nameOk = at.filter(i => i.t.series && normKey(i.name) === normKey(i.t.series)).length;
    const withNum = at.filter(i => i.t.number != null && i.t.series && normKey(i.name) === normKey(i.t.series));
    const numOk = withNum.filter(i => String(i.num) === String(i.t.number)).length;
    const sw = at.filter(i => !i.t.series).length;
    console.log(`  ${TIER_NAME[t].padEnd(9)} ${String(at.length).padStart(5)}   ${String(nameOk).padStart(4)}/${String(at.length).padEnd(4)} ${(nameOk/at.length*100).toFixed(0).padStart(3)}%   ${String(numOk).padStart(4)}/${String(withNum.length).padEnd(4)} ${withNum.length?(numOk/withNum.length*100).toFixed(0).padStart(3):' --'}%   ${String(sw).padStart(4)}`);
  }

  // --- overall number accuracy on correctly-named units
  const scoreable = proposed.filter(i => i.t.number != null && i.t.series && normKey(i.name) === normKey(i.t.series));
  const numRight = scoreable.filter(i => String(i.num) === String(i.t.number));
  console.log(`\nnumbers: ${numRight.length}/${scoreable.length} (${(numRight.length/scoreable.length*100).toFixed(1)}%) correct among correctly-named units with a known truth number`);

  // --- misses
  const missed = inSeries.filter(i => !i.name);
  const byMiss = new Map();
  for (const m of missed) { const k = m.t.series; byMiss.set(k, (byMiss.get(k) || 0) + 1); }
  console.log(`\nABSTAINED on ${missed.length} in-series units:`);
  for (const [k, n] of [...byMiss].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${k}`);

  return { items, clusters, pStrict, prec, rec };
}

const base = run({ trustFolders: true }, 'A. FULL CASCADE  (folder evidence permitted, self-validated)');
run({ trustFolders: false }, 'B. PORTABLE SIGNALS ONLY  (the "no folder consent" branch)');

// ---------- failure taxonomy on the full cascade ----------
console.log(`\n${'='.repeat(78)}\nFAILURE TAXONOMY (full cascade)\n${'='.repeat(78)}`);
const { items, pStrict } = base;
for (const [k, ids] of [...pStrict].sort((a, b) => b[1].length - a[1].length)) {
  const mem = ids.map(i => items[i]);
  const tset = new Map();
  for (const m of mem) { const tk = m.t.series ? m.t.series + (m.t.edition ? ' [' + m.t.edition + ']' : '') : '(standalone)'; tset.set(tk, (tset.get(tk) || 0) + 1); }
  const bad = tset.size > 1;
  if (!bad) continue;
  console.log(`\nMERGED proposal "${mem[0].name}" (${mem.length} units) spans ${tset.size} truth groups:`);
  for (const [tk, n] of [...tset].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(3)}  ${tk}`);
}
// splits: one truth group across several proposals
const tg = new Map();
items.filter(i => i.t.multi).forEach(i => { const k = i.t.series + '||' + (i.t.edition || ''); if (!tg.has(k)) tg.set(k, []); tg.get(k).push(i); });
for (const [k, mem] of tg) {
  const ks = new Map();
  for (const m of mem) { const kk = m.name || '(abstained)'; ks.set(kk, (ks.get(kk) || 0) + 1); }
  if (ks.size > 1) {
    console.log(`\nSPLIT truth series "${k.replace('||', ' [')}${k.endsWith('||') ? '' : ']'}" (${mem.length} units) across ${ks.size} outcomes:`);
    for (const [kk, n] of [...ks].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(3)}  ${kk}`);
  }
}
