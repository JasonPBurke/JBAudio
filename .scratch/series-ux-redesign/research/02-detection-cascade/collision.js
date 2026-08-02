'use strict';
/**
 * Number-collision check -> fall back to folders for grouping.
 *
 * A real series numbers each book once. When a proposed series carries the SAME
 * canonical number repeatedly, something has merged that should not have. The
 * check: if the members partition cleanly by folder into parts that are each
 * internally near-unique, that folder split IS the real boundary -- take it.
 * Named for what it is: two editions of one series, or two series in one name.
 */
function splitOnNumberCollision(results, units, opts = {}) {
  const minNumbered = opts.minNumbered ?? 4;
  const minDupRate  = opts.minDupRate  ?? 0.25;
  const maxInnerDup = opts.maxInnerDup ?? 0.10;
  const minPart     = opts.minPart     ?? 2;

  const out = results.map(r => ({ ...r }));
  const groups = new Map();
  out.forEach((r, i) => { if (!r.key) return; if (!groups.has(r.key)) groups.set(r.key, []); groups.get(r.key).push(i); });

  const dupRate = idxs => {
    const nums = idxs.map(i => out[i].num).filter(n => n != null);
    if (!nums.length) return 0;
    return (nums.length - new Set(nums).size) / nums.length;
  };

  for (const [key, idxs] of groups) {
    const numbered = idxs.filter(i => out[i].num != null);
    if (numbered.length < minNumbered) continue;
    const rate = dupRate(idxs);
    if (rate < minDupRate) continue;

    // deepest common ancestor of every member, then partition on the NEXT segment
    const paths = idxs.map(i => units[i].rel.split('/'));
    let dca = 0;
    while (paths.every(p => p.length > dca + 1 && p[dca] === paths[0][dca])) dca++;
    const parts = new Map();
    for (const i of idxs) {
      const seg = units[i].rel.split('/')[dca] ?? '';
      if (!parts.has(seg)) parts.set(seg, []);
      parts.get(seg).push(i);
    }
    if (parts.size < 2) continue;                                  // nothing to split on
    if ([...parts.values()].some(p => p.length < minPart)) continue; // degenerate (one book per folder)
    if ([...parts.values()].some(p => dupRate(p) > maxInnerDup)) continue; // split doesn't resolve it

    for (const [seg, members] of parts) {
      for (const i of members) {
        out[i].key = key + '#' + seg.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        out[i].name = seg;                       // raw folder name -- the year IS the discriminator
        out[i].why = [...out[i].why, `split:number-collision(${(rate*100).toFixed(0)}% dupes -> ${parts.size} folders)`];
      }
    }
  }
  return out;
}

/** A series needs two books. One book is a book. */
function dropSingletons(results) {
  const n = new Map();
  results.forEach(r => { if (r.key) n.set(r.key, (n.get(r.key) || 0) + 1); });
  return results.map(r => (r.key && n.get(r.key) < 2)
    ? { ...r, name: null, key: null, conf: 0, confName: 'abstain', why: ['suppressed:single-book-series'] }
    : r);
}
module.exports = { splitOnNumberCollision, dropSingletons };
