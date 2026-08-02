'use strict';
/** Post-cascade refinement: split-book guard + display-name election.
 *  Kept separate from cascade.js so its contribution is measurable on its own. */
const { normKey, cleanDirName } = require('./cascade.js');

const SPLIT_RE = /\((\d+)\s*of\s*(\d+)\)|\bPart\s+(\d+)\s*(?:of\s*\d+)?\s*$|\b(?:Disc|CD)\s*\d+\s*$/i;

/** "Warbreaker 1" + album "(1 of 2)" is ONE book in two files, not a two-book series. */
function isSplitBookPart(r) {
  const alb = r.album || '';
  const m = alb.match(SPLIT_RE);
  if (!m) return false;
  const part = m[1] || m[3];
  const fromGrouping = r.signals.some(s => s.splitRisk && String(s.num) === String(part));
  return Boolean(fromGrouping);
}

function stripDecoration(name, members) {
  let n = String(name).trim();
  n = n.replace(/\s+series\s+by\s+.+$/i, '');            // "... series by Tad Williams"
  n = n.replace(/\s*\bseries\b\s*$/i, '');                // trailing "Series"
  n = n.replace(/[,\s]+\d+\s*-\s*\d+\s*$/, '');            // "... 1-3" owned-range suffix
  n = n.replace(/^\s*[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2}\s+-\s+/, (m0) => {
    const who = m0.replace(/\s+-\s+$/, '');
    return members.some(u => normKey(u.artist) === normKey(who) || normKey(u.album_artist) === normKey(who)) ? '' : m0;
  });
  n = n.replace(/[:,\s]+$/, '').trim();
  return n || String(name).trim();
}
const isAbbrev = n => /^[A-Z0-9]{2,5}$/.test(n.replace(/[^A-Za-z0-9]/g, ''));

function refine(results, units) {
  const out = results.map(r => ({ ...r }));
  // 1. split-book guard
  for (const r of out) if (r.name && isSplitBookPart(r)) { r.name = null; r.key = null; r.num = null; r.conf = 0; r.confName = 'abstain'; r.why = ['suppressed:split-book-part']; }
  // 2. merge keys that differ only by & / and
  const K = k => k && k.replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ').trim();
  for (const r of out) if (r.key) r.key = K(r.key);
  // 3. elect one display name per group
  const groups = new Map();
  out.forEach((r, i) => { if (!r.key) return; if (!groups.has(r.key)) groups.set(r.key, []); groups.get(r.key).push(i); });
  for (const [key, idxs] of groups) {
    const members = idxs.map(i => units[i]);
    const votes = new Map();
    for (const i of idxs) {
      const cands = [out[i].name];
      // the folder that houses this group is also a naming candidate
      const parts = out[i].rel.split('/');
      for (let d = 1; d < parts.length - 1; d++) cands.push(cleanDirName(parts[d]));
      for (let c of cands) {
        if (!c) continue;
        c = stripDecoration(c, members);
        const ck = K(normKey(c));
        // accept the group key itself, or a tidier form of it (one contains the other)
        if (!ck || !(ck === key || key.includes(ck) || ck.includes(key))) continue;
        votes.set(c, (votes.get(c) || 0) + (ck === key ? 1 : 0.9));
      }
    }
    if (!votes.size) continue;
    const ranked = [...votes].sort((a, b) => {
      const abA = isAbbrev(a[0]), abB = isAbbrev(b[0]);
      if (abA !== abB) return abA ? 1 : -1;       // never prefer an abbreviation
      if (Math.abs(b[1] - a[1]) > 0.5) return b[1] - a[1];  // clearly more votes
      return a[0].length - b[0].length;           // then shortest
    });
    const elected = ranked[0][0];
    const newKey = K(normKey(elected));
    for (const i of idxs) { out[i].name = elected; if (newKey) out[i].key = newKey; }
  }
  return out;
}
module.exports = { refine };
