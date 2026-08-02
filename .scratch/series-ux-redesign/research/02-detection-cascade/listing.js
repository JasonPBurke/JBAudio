'use strict';
const { run } = require('./pipeline.js'); const { normKey } = require('./cascade.js');
const units = require('./units.json'); const truth = require('./ground_truth.json');
const ukey = u => u.rel + (u.flat ? ' :: ' + (u.album || u.file) : '');
const K = s => s && String(s).replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const NK = s => K(normKey(K(s)));
const title = u => (u.album || '').replace(/\s*\((Unabridged|Abridged)\)\s*$/i, '').trim() || u.rel.split('/').pop();

const cons = run(units, 'conservative'), full = run(units, 'full');
const consKeys = new Set(cons.map(r => r.key).filter(Boolean));

function groupsOf(res) {
  const g = new Map();
  res.forEach((r, i) => { if (!r.key) return; if (!g.has(r.key)) g.set(r.key, []); g.get(r.key).push({ ...r, u: units[i], t: truth[ukey(units[i])] || {} }); });
  return g;
}
function show(g, keys, heading) {
  console.log(`\n${'='.repeat(74)}\n${heading}\n${'='.repeat(74)}`);
  let ns = 0, nb = 0;
  for (const k of [...keys].sort((a, b) => g.get(b).length - g.get(a).length)) {
    const mem = g.get(k); ns++; nb += mem.length;
    const t = new Set(mem.map(m => (m.t.series || '(standalone)') + (m.t.edition ? ' [' + m.t.edition + ']' : '')));
    console.log(`\n"${mem[0].name}"  ${mem.length} books${t.size > 1 ? '   <== MIXES ' + t.size + ' REAL SERIES' : ''}`);
    for (const m of mem.slice().sort((a, b) => (parseFloat(a.num) || 999) - (parseFloat(b.num) || 999))) {
      const w = !m.t.series ? ' <-- I labelled this a STANDALONE'
        : NK(m.name) !== NK(m.t.series) ? ` <-- I labelled this "${m.t.series}"`
        : (m.t.number != null && String(m.num) !== String(m.t.number)) ? ` <-- I labelled this #${m.t.number}` : '';
      console.log(`   ${(m.num == null ? ' -' : '#' + m.num).padStart(6)}  ${title(m.u).slice(0, 56).padEnd(56)}${w}`);
    }
  }
  console.log(`\n  -> ${ns} series, ${nb} books`);
}
const gc = groupsOf(cons), gf = groupsOf(full);
show(gc, gc.keys(), 'LEVEL 1 - CONSERVATIVE  (tags + self-validated folders)');
show(gf, [...gf.keys()].filter(k => !consKeys.has(k)), 'LEVEL 2 - FULL  adds these (uncorroborated folders)');
