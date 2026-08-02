'use strict';
const { detect, normKey } = require('./cascade.js');
const { refine } = require('./refine.js');
const units = require('./units.json'); const truth = require('./ground_truth.json');
const ukey = u => u.rel + (u.flat ? ' :: ' + (u.album || u.file) : '');
const K = k => k && k.replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ').trim();

function report(results, label) {
  const items = results.map((r, i) => ({ ...r, id: i, t: truth[ukey(units[i])] || {} }));
  const groups = new Map();
  items.forEach(it => { if (!it.key) return; if (!groups.has(it.key)) groups.set(it.key, []); groups.get(it.key).push(it); });

  // GROUPING PURITY: does each proposed group hold exactly one truth group?
  let pureGroups = 0, impureUnits = 0, totalGrouped = 0;
  const impure = [];
  for (const [k, mem] of groups) {
    const c = new Map();
    for (const m of mem) { const tk = (m.t.series || '(standalone)') + (m.t.edition ? ' [' + m.t.edition + ']' : ''); c.set(tk, (c.get(tk) || 0) + 1); }
    const modal = [...c].sort((a, b) => b[1] - a[1])[0];
    totalGrouped += mem.length;
    if (c.size === 1) pureGroups++; else { impureUnits += mem.length - modal[1]; impure.push([mem[0].name, mem.length, [...c]]); }
  }
  // NAME quality on correctly-grouped units
  const named = items.filter(i => i.name && i.t.series);
  const nameOk = named.filter(i => K(normKey(i.name)) === K(normKey(i.t.series))).length;
  const inSeries = items.filter(i => i.t.multi);
  const placed = inSeries.filter(i => i.name).length;
  const halluc = items.filter(i => i.name && !i.t.series).length;
  const scoreable = named.filter(i => i.t.number != null && K(normKey(i.name)) === K(normKey(i.t.series)));
  const numOk = scoreable.filter(i => String(i.num) === String(i.t.number)).length;

  console.log(`\n--- ${label}`);
  console.log(`  groups proposed        ${groups.size}   (pure: ${pureGroups}, mixed: ${groups.size - pureGroups})`);
  console.log(`  grouping purity        ${((totalGrouped - impureUnits) / totalGrouped * 100).toFixed(1)}%  (${impureUnits} of ${totalGrouped} grouped units sit in the wrong group)`);
  console.log(`  coverage (in-series)   ${placed}/${inSeries.length}  ${(placed / inSeries.length * 100).toFixed(1)}%`);
  console.log(`  display name correct   ${nameOk}/${named.length}  ${(nameOk / named.length * 100).toFixed(1)}%`);
  console.log(`  canonical number right ${numOk}/${scoreable.length}  ${(numOk / scoreable.length * 100).toFixed(1)}%`);
  console.log(`  phantom/standalone     ${halluc} units placed in a series that truth calls standalone`);
  for (const [n, sz, c] of impure) console.log(`     MIXED "${n}" (${sz}): ` + c.map(([a, b]) => `${b}x ${a}`).join(' + '));
  return items;
}

const raw = detect(units, { trustFolders: true }).results;
report(raw, 'V1  cascade only, folders permitted');
const ref = refine(raw, units);
report(ref, 'V2  cascade + refinement (split-book guard, name election, &/and merge)');
const refNoFolder = refine(detect(units, { trustFolders: false }).results, units);
report(refNoFolder, 'V2-portable  refinement, folder evidence WITHHELD (no consent)');

// ---- edition probe: duplicate canonical numbers inside one proposed group ----
console.log('\n--- EDITION SIGNAL: proposed groups containing duplicate canonical numbers');
const g = new Map();
ref.forEach((r, i) => { if (!r.key || r.num == null) return; if (!g.has(r.key)) g.set(r.key, []); g.get(r.key).push([r.num, units[i].rel]); });
for (const [k, arr] of g) {
  const c = new Map(); for (const [n] of arr) c.set(n, (c.get(n) || 0) + 1);
  const dup = [...c].filter(([, v]) => v > 1);
  if (!dup.length) continue;
  const dirs = new Set(arr.map(([, rel]) => rel.split('/').slice(0, 2).join('/')));
  console.log(`  "${k}": ${dup.length} duplicated numbers over ${arr.length} numbered units; ${dirs.size} distinct top-2 folders`);
  console.log(`      folders: ${[...dirs].map(d => d.split('/').pop()).join('  |  ')}`);
}
