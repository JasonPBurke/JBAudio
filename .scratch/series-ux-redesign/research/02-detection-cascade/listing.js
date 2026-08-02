'use strict';
const { detect, normKey } = require('./cascade.js'); const { refine } = require('./refine.js');
const units = require('./units.json'); const truth = require('./ground_truth.json');
const ukey = u => u.rel + (u.flat ? ' :: ' + (u.album || u.file) : '');
const K = s => s && String(s).replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const NK = s => K(normKey(K(s)));
const title = u => {
  const a = (u.album || '').replace(/\s*\((Unabridged|Abridged)\)\s*$/i, '').trim();
  return a || u.rel.split('/').pop();
};
const items = refine(detect(units, { trustFolders: true, acceptUncorroborated: 3 }).results, units)
  .map((r, i) => ({ ...r, u: units[i], t: truth[ukey(units[i])] || {} }));

const groups = new Map();
items.forEach(it => { if (!it.key) return; if (!groups.has(it.key)) groups.set(it.key, []); groups.get(it.key).push(it); });

const unc = new Set(), self = new Set();
for (const [k, mem] of groups) (mem.some(m => m.why.some(w => w.includes('UNCORROBORATED'))) ? unc : self).add(k);

function show(keys, heading) {
  console.log(`\n${'='.repeat(76)}\n${heading}\n${'='.repeat(76)}`);
  let n = 0, books = 0;
  for (const k of [...keys].sort((a, b) => groups.get(b).length - groups.get(a).length)) {
    const mem = groups.get(k); n++; books += mem.length;
    const tiers = {}; mem.forEach(m => tiers[m.confName] = (tiers[m.confName] || 0) + 1);
    const tset = new Set(mem.map(m => (m.t.series || '(standalone)') + (m.t.edition ? ' [' + m.t.edition + ']' : '')));
    const flag = tset.size > 1 ? '  <== MIXES ' + tset.size + ' REAL SERIES' : '';
    console.log(`\n"${mem[0].name}"  -- ${mem.length} books  [${Object.entries(tiers).map(([a, b]) => b + ' ' + a).join(', ')}]${flag}`);
    const sorted = mem.slice().sort((a, b) => (parseFloat(a.num) || 999) - (parseFloat(b.num) || 999));
    for (const m of sorted) {
      const wrong = !m.t.series ? ' <-- I labelled this a STANDALONE'
        : NK(m.name) !== NK(m.t.series) ? ` <-- I labelled this "${m.t.series}"`
        : (m.t.number != null && String(m.num) !== String(m.t.number)) ? ` <-- I labelled this #${m.t.number}` : '';
      console.log(`     ${(m.num == null ? '  -' : '#' + m.num).padStart(6)}  ${title(m.u).slice(0, 58).padEnd(58)}${wrong}`);
    }
  }
  console.log(`\n  -> ${n} series, ${books} books`);
}
show(self, 'A.  SELF-VALIDATED  (tags agree, or the folder is corroborated by its own members)');
show(unc, 'B.  UNCORROBORATED FOLDERS  (folder names a series; nothing in the tags confirms it)');
