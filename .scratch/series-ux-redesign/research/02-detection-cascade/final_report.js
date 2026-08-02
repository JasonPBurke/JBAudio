'use strict';
const { detect, normKey, TIER_NAME } = require('./cascade.js'); const { refine } = require('./refine.js');
const units = require('./units.json'); const truth = require('./ground_truth.json');
const ukey = u => u.rel + (u.flat ? ' :: ' + (u.album || u.file) : '');
const K = s => s && String(s).replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const NK = s => K(normKey(K(s)));

function full(opts, label) {
  const items = refine(detect(units, opts).results, units).map((r, i) => ({ ...r, t: truth[ukey(units[i])] || {} }));
  const inSeries = items.filter(i => i.t.multi), placed = inSeries.filter(i => i.name);
  const g = new Map(); items.forEach(it => { if (!it.key) return; if (!g.has(it.key)) g.set(it.key, []); g.get(it.key).push(it); });
  let badB = 0, badE = 0, tot = 0;
  for (const [, mem] of g) {
    tot += mem.length;
    const cb = new Map(), ce = new Map();
    for (const m of mem) {
      const b = m.t.series || '(standalone)', e = b + (m.t.edition ? '|' + m.t.edition : '');
      cb.set(b, (cb.get(b) || 0) + 1); ce.set(e, (ce.get(e) || 0) + 1);
    }
    badB += mem.length - [...cb.values()].sort((a, b) => b - a)[0];
    badE += mem.length - [...ce.values()].sort((a, b) => b - a)[0];
  }
  const named = items.filter(i => i.name && i.t.series);
  const nameOk = named.filter(i => NK(i.name) === NK(i.t.series)).length;
  const sc = named.filter(i => i.t.number != null && NK(i.name) === NK(i.t.series));
  const numOk = sc.filter(i => String(i.num) === String(i.t.number)).length;
  console.log(`\n${label}`);
  console.log(`  coverage of in-series units      ${placed.length}/${inSeries.length}  (${(placed.length / inSeries.length * 100).toFixed(1)}%)`);
  console.log(`  proposed series                  ${g.size}`);
  console.log(`  grouping purity, edition-blind   ${((tot - badB) / tot * 100).toFixed(1)}%   (${badB}/${tot} misplaced)`);
  console.log(`  grouping purity, edition-aware   ${((tot - badE) / tot * 100).toFixed(1)}%   (${badE}/${tot} misplaced)`);
  console.log(`  display name correct             ${nameOk}/${named.length}  (${(nameOk / named.length * 100).toFixed(1)}%)`);
  console.log(`  canonical number correct         ${numOk}/${sc.length}  (${(numOk / sc.length * 100).toFixed(1)}%)`);
  console.log(`  standalones swept into a series  ${items.filter(i => i.name && !i.t.series).length}`);
  console.log('\n   tier       units   grouping-correct   name-correct   number-correct');
  for (let t = 4; t >= 1; t--) {
    const at = items.filter(i => i.name && i.conf === t); if (!at.length) continue;
    const gc = at.filter(i => { const mem = g.get(i.key); const c = new Map();
      for (const m of mem) { const b = m.t.series || '(sa)'; c.set(b, (c.get(b) || 0) + 1); }
      const modal = [...c].sort((a, b) => b[1] - a[1])[0][0]; return (i.t.series || '(sa)') === modal && i.t.series; }).length;
    const nc = at.filter(i => i.t.series && NK(i.name) === NK(i.t.series)).length;
    const ws = at.filter(i => i.t.number != null && i.t.series && NK(i.name) === NK(i.t.series));
    const nu = ws.filter(i => String(i.num) === String(i.t.number)).length;
    console.log(`   ${TIER_NAME[t].padEnd(9)} ${String(at.length).padStart(6)}   ${(gc / at.length * 100).toFixed(0).padStart(11)}%   ${(nc / at.length * 100).toFixed(0).padStart(10)}%   ${ws.length ? (nu / ws.length * 100).toFixed(0).padStart(12) : '          --'}%`);
  }
  return items;
}
const A = full({ trustFolders: true }, 'A. FOLDER EVIDENCE PERMITTED (self-validated per library)');
full({ trustFolders: false }, 'B. PORTABLE SIGNALS ONLY (user declined the folder switch)');

console.log('\n\nWHAT THE CASCADE ABSTAINS ON (folder-permitted run) -- 49 units, by cause:');
const ab = A.filter(i => i.t.multi && !i.name);
const bys = new Map(); ab.forEach(i => bys.set(i.t.series, (bys.get(i.t.series) || 0) + 1));
for (const [s, n] of [...bys].sort((a, b) => b[1] - a[1])) {
  const ex = ab.find(i => i.t.series === s);
  console.log(`  ${String(n).padStart(2)}  ${String(s).padEnd(24)} album="${String(ex.album).slice(0, 42)}"  folder="${ex.rel.split('/').slice(1, 2)[0] || ''}"`);
}
