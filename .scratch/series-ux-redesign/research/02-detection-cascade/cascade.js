'use strict';
/**
 * Candidate series-detection cascade -- PURE, RN-free, DB-free.
 * Input: plain unit objects {rel, file, album, artist, album_artist, composer,
 *        grouping, series, part, flat}. Output: proposals with evidence.
 *
 * Shape: three stages.
 *   A. per-unit portable extraction  (tags + album patterns; travels with files)
 *   B. folder clustering + SELF-VALIDATION (non-portable; must earn trust)
 *   C. reconciliation -> proposal with a confidence tier
 */

// ---------- normalisation ----------
const STOP = /^(the|a|an)\s+/i;
function normKey(name) {
  if (!name) return null;
  return String(name)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[‘’']/g, "'")
    .replace(/\b(series|saga|trilogy|cycle|chronicles?|novels?)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().replace(STOP, '')
    .toLowerCase().replace(/\s+/g, ' ') || null;
}
/** Normalise a canonical number per ticket 07: strip #/Book/Volume/leading zeros;
 *  keep 12.5 / 14b / 1-3 intact. */
function normNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/^[#\s]*/, '')
    .replace(/^(book|volume|vol\.?|part|pt\.?)\s*/i, '').trim();
  if (!s) return null;
  const m = s.match(/^0*(\d+(?:\.\d+)?(?:[a-z])?(?:-\d+)?)$/i);
  return m ? (m[1].startsWith('.') ? '0' + m[1] : m[1]) : (/^[ivxlIVXL]+$/.test(s) ? String(roman(s)) : null);
}
const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
function roman(s) {
  s = s.toLowerCase().replace(/l{2,}/, m => 'i'.repeat(m.length)); // the 'lll' typo for III
  let t = 0;
  for (let i = 0; i < s.length; i++) {
    const a = ROMAN[s[i]], b = ROMAN[s[i + 1]];
    if (!a) return NaN;
    t += b && b > a ? -a : a;
  }
  return t;
}
const isAuthorish = (name, u) => {
  const k = normKey(name);
  if (!k) return false;
  return [u.artist, u.album_artist, u.composer].some(v => v && normKey(v) === k);
};
/** A parsed name must look like a series title, not junk or the author. */
function plausibleName(name, u) {
  if (!name) return false;
  const t = String(name).trim();
  if (t.length < 3 || t.length > 45) return false;
  if (/^\d+$/.test(t)) return false;
  if (!/\p{L}/u.test(t)) return false;
  if (isAuthorish(t, u)) return false;
  if (/^(unabridged|audiobook|book|volume|disc|part|cd)$/i.test(t)) return false;
  return true;
}

// ---------- A. portable per-unit extraction ----------
const ALBUM_RULES = [
  // [Series N] Title
  { id: 'alb.bracket', re: /^\[(.{2,40}?)\s+(\d{1,3}(?:\.\d+)?)\]\s*(.+)$/, name: 1, num: 2 },
  // (Series N) Title
  { id: 'alb.paren-pre', re: /^\((\D{2,30}?)\s+(\d{1,3}(?:\.\d+)?)\)\s*(.+)$/, name: 1, num: 2 },
  // Title: Series, Book N        <-- series is SECOND
  { id: 'alb.book-suffix', re: /^(.+?):\s*(.{2,40}?),\s*Book,?\s*(\d{1,3}(?:\.\d+)?)/i, name: 2, num: 3 },
  // Series #N: Title
  { id: 'alb.hash-colon', re: /^(.{2,40}?)\s*#(\d{1,3}(?:\.\d+)?):\s*(.+)$/, name: 1, num: 2 },
  // Book NN[ Part n] - Title - Series Series
  { id: 'alb.book-dash-series', re: /^Book\s+(\d{1,3}(?:\.\d+)?)(?:\s+Part\s+\d)?\s*-\s*.+?\s*-\s*(.{2,40}?)\s+Series$/i, name: 2, num: 1 },
  // Series Book N - Title
  { id: 'alb.series-book-n', re: /^(.{2,40}?)\s+Book\s+(\d{1,3}(?:\.\d+)?)\s*[-–:]\s*(.+)$/i, name: 1, num: 2 },
  // Series NN - Title   /   Series NN Title
  { id: 'alb.name-num-dash', re: /^(.{2,40}?)\s+#?(\d{1,3}(?:\.\d+)?)\s*[-–:]\s+(.+)$/, name: 1, num: 2 },
  { id: 'alb.name-num-sp', re: /^(.{2,40}?)\s+#?(\d{1,3}(?:\.\d+)?)\s+([A-Z(].+)$/, name: 1, num: 2 },
  // Series N (Narrator)
  { id: 'alb.name-num-paren', re: /^(.{2,40}?)\s+(\d{1,3}(?:\.\d+)?)\s*\(([^)]+)\)\s*$/, name: 1, num: 2, paren: 3 },
  // number-only shapes: no series name available from the album
  { id: 'alb.num-only-pre', re: /^\(#?(\d{1,3}(?:\.\d+)?)\)\s*(.+)$/, num: 1 },
  { id: 'alb.num-only-suf', re: /^(.+?)\s*\(#(\d{1,3}(?:\.\d+)?)\)\s*$/, num: 2 },
  { id: 'alb.num-only-lead', re: /^(\d{1,3}(?:\.\d+)?)\s*[-–.]\s*(.+)$/, num: 1 },
  { id: 'alb.num-only-lead2', re: /^(\d{1,3})\s+([A-Z].+)$/, num: 1 },
  { id: 'alb.author-mangled', re: /^[A-Z][a-z]+,\s*[A-Z]\.?:\s*(\d{1,3})\s+(.+)$/, num: 1 },
  // The Dark Tower IV: Title  (roman)
  { id: 'alb.roman', re: /^(.{2,40}?)\s+([IVXL]{1,7}|lll):\s*(.+)$/, name: 1, numRoman: 2 },
];

function extractPortable(u) {
  const out = [];
  // 1. machine fields -- highest trust
  if (u.series && String(u.series).trim()) {
    out.push({ src: 'tag.extra.SERIES', name: String(u.series).trim(), num: normNumber(u.part), tier: 3 });
  }
  // 2. Grouping -- series name, but may embed a number or be a split-book part
  if (u.grouping && String(u.grouping).trim()) {
    const g = String(u.grouping).trim();
    let m = g.match(/^(.+?)[,\s]+(?:Book|Vol(?:ume)?)\s*#?(\d{1,3}(?:\.\d+)?)$/i);
    if (m) out.push({ src: 'tag.Grouping+num', name: m[1].trim(), num: normNumber(m[2]), tier: 2 });
    else if ((m = g.match(/^(.+?)\s+(\d{1,3})$/))) {
      // "Discworld 13" (real) vs "Warbreaker 1" (split-book part) -- indistinguishable here
      out.push({ src: 'tag.Grouping+bare-num', name: m[1].trim(), num: normNumber(m[2]), tier: 2, splitRisk: true });
    } else out.push({ src: 'tag.Grouping', name: g, num: null, tier: 2 });
  }
  // 3. album patterns -- first match wins (ordered by specificity)
  const alb = (u.album || '').replace(/\s*\((Unabridged|Abridged)\)\s*$/i, '').trim();
  if (alb) {
    for (const r of ALBUM_RULES) {
      const m = alb.match(r.re);
      if (!m) continue;
      const name = r.name ? m[r.name].trim() : null;
      let num = r.num ? normNumber(m[r.num]) : null;
      if (r.numRoman) { const v = roman(m[r.numRoman]); num = Number.isFinite(v) && v > 0 && v < 100 ? String(v) : null; }
      if (r.numRoman && num == null) continue;
      if (name && !plausibleName(name, u)) {
        // name rejected (author-mangled / junk) -- the NUMBER may still be good
        if (num) out.push({ src: r.id + '(name-rejected)', name: null, num, tier: 1 });
        break;
      }
      // parenthetical that equals the narrator confirms the pattern (Mistborn 6 (Michael Kramer))
      const narratorParen = r.paren && u.composer && normKey(m[r.paren]) === normKey(u.composer);
      out.push({ src: r.id, name, num, tier: name ? (narratorParen ? 2 : 1) : 1 });
      break;
    }
  }
  return out;
}

// ---------- B. folder clustering ----------
/** every ancestor directory path of a unit, shallowest first, excluding the root */
function ancestors(rel) {
  const p = rel.split('/');
  const out = [];
  for (let i = 1; i <= p.length; i++) out.push(p.slice(0, i).join('/'));
  return out;
}
/** strip decoration a human puts on a series directory */
function cleanDirName(base) {
  return base
    .replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ')
    .replace(/\((?:19|20)\d\d(?:-(?:19|20)\d\d)?\)/g, ' ')
    .replace(/\b(19|20)\d\d\s*-\s*/g, ' ')
    .replace(/,?\s*Books?\s+\d+\s*-\s*\d+\s*$/i, ' ')
    .replace(/\s*-\s*[A-Z][a-z]+\s+[A-Z][a-z']+\s*$/, ' ')  // "... - Dan Simmons"
    .replace(/^\s*\d{1,3}\s*[-.]\s*/, ' ')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Decide, per candidate directory, whether it may name a series.
 * SELF-VALIDATION (driver rule, 2026-08-01): the directory earns trust only when
 * the portable signals of its own members corroborate it.
 */
function folderClusters(units, portables, opts) {
  const byDir = new Map();
  units.forEach((u, i) => {
    for (const a of ancestors(u.rel)) {
      if (!byDir.has(a)) byDir.set(a, []);
      byDir.get(a).push(i);
    }
  });
  const clusters = [];
  for (const [dir, idxs] of byDir) {
    if (idxs.length < 2) continue;
    const depth = dir.split('/').length;
    if (depth === 1 && !opts.allowTopLevel) continue;  // author level
    const base = dir.split('/').pop();
    const clean = cleanDirName(base);
    const key = normKey(clean);
    if (!key) continue;
    const members = idxs.map(i => units[i]);
    // reject the author-as-folder trap
    const authorish = members.filter(u => isAuthorish(clean, u)).length;
    if (authorish >= members.length / 2) { clusters.push({ dir, key, display: clean, members: idxs, rejected: 'author-folder' }); continue; }
    // NAME corroboration: how many members' portable signals name this same series?
    let nameOk = 0, numOk = 0;
    for (const i of idxs) {
      const ps = portables[i] || [];
      if (ps.some(p => p.name && normKey(p.name) === key)) nameOk++;
      if (ps.some(p => p.num != null)) numOk++;
    }
    clusters.push({ dir, key, display: clean, members: idxs, nameOk, numOk, size: idxs.length });
  }
  return clusters;
}

// ---------- C. reconcile ----------
const TIER_NAME = ['abstain', 'guess', 'possible', 'likely', 'certain'];

function detect(units, options = {}) {
  const opts = {
    trustFolders: true,          // the user-facing "use my file structure?" switch
    nameCorroborationMin: 2,     // members whose portable signals must name the folder
    nameCorroborationFrac: 0.25,
    minClusterSize: 2,
    allowTopLevel: false,
    ...options,
  };
  const portables = units.map(extractPortable);

  // -- portable name proposals per unit
  const proposals = units.map((u, i) => {
    const ps = portables[i];
    const named = ps.filter(p => p.name && plausibleName(p.name, u));
    const numOnly = ps.filter(p => !p.name && p.num != null);
    let best = null;
    if (named.length) {
      named.sort((a, b) => b.tier - a.tier);
      best = { name: named[0].name, key: normKey(named[0].name), num: named[0].num, evidence: named.map(p => p.src), portable: true, tier: named[0].tier };
      // independent agreement across two portable sources raises trust
      const agree = new Set(named.map(p => normKey(p.name))).size === 1 && named.length > 1;
      best.agree = agree;
    }
    const num = best?.num ?? numOnly[0]?.num ?? ps.find(p => p.num != null)?.num ?? null;
    return { unit: u, idx: i, portable: best, numOnly: best ? null : num, num, signals: ps };
  });

  // -- folder clusters, self-validated
  const clusters = folderClusters(units, portables, opts);
  const accepted = [];
  for (const c of clusters) {
    if (c.rejected) continue;
    if (c.size < opts.minClusterSize) continue;
    const need = Math.max(opts.nameCorroborationMin, Math.ceil(c.size * opts.nameCorroborationFrac));
    if (c.nameOk >= need) { accepted.push({ ...c, mode: 'name-corroborated' }); continue; }
    // number corroboration: most members carry a number but nothing names the series
    if (c.numOk >= Math.ceil(c.size * 0.6) && c.size >= 3) { accepted.push({ ...c, mode: 'number-corroborated' }); continue; }
    if (opts.acceptUncorroborated && c.size >= opts.acceptUncorroborated) { accepted.push({ ...c, mode: 'uncorroborated' }); continue; }
    accepted.push({ ...c, mode: 'uncorroborated-rejected' });
  }
  // deepest accepted cluster wins for a unit (sub-series beats parent)
  const clusterFor = new Map();
  for (const c of accepted) {
    for (const i of c.members) {
      const cur = clusterFor.get(i);
      if (!cur || c.dir.length > cur.dir.length) clusterFor.set(i, c);
    }
  }

  // -- final assignment
  const results = proposals.map(p => {
    const c = clusterFor.get(p.idx);
    const folderNum = folderNumber(p.unit, c);
    let name = null, key = null, num = p.num, conf = 0, why = [];

    if (p.portable) {
      name = p.portable.name; key = p.portable.key; why = [...p.portable.evidence];
      conf = p.portable.tier >= 3 ? 4 : (p.portable.agree || p.portable.tier >= 2 ? 3 : 3);
      if (c && !c.rejected && !String(c.mode).startsWith('uncorroborated') && c.key === key) { conf = 4; why.push('folder:' + c.mode); }
    } else if (c && opts.trustFolders && c.mode === 'name-corroborated') {
      name = c.display; key = c.key; conf = 2; why = ['folder:name-corroborated(' + c.nameOk + '/' + c.size + ')'];
    } else if (c && opts.trustFolders && c.mode === 'number-corroborated') {
      name = c.display; key = c.key; conf = 1; why = ['folder:number-corroborated(' + c.numOk + '/' + c.size + ')'];
    } else if (c && opts.trustFolders && c.mode === 'uncorroborated') {
      name = c.display; key = c.key; conf = 1; why = ['folder:UNCORROBORATED(' + c.size + ' books, nothing in the tags agrees)'];
    }
    if (num == null && folderNum != null && name) { num = folderNum; why.push('num:folder'); }
    return { rel: p.unit.rel, file: p.unit.file, flat: p.unit.flat, album: p.unit.album,
             name, key, num, conf, confName: TIER_NAME[conf], why, signals: p.signals };
  });
  return { results, clusters: accepted };
}

/** number embedded in the book folder or the series folder path (non-portable) */
function folderNumber(u, c) {
  const base = u.rel.split('/').pop();
  let m = base.match(/^\((\d{1,3}(?:\.\d+)?)\)/) ||                 // "(11) Reaper Man"
          base.match(/^(\d{1,3}(?:\.\d+)?)[\s.\-]/) ||              // "6.The Bands of Mourning"
          base.match(/\b(?:Book|Vol(?:ume)?)\s*(\d{1,3}(?:\.\d+)?)/i);
  if (!m && c) {
    const rest = u.rel.slice(c.dir.length + 1).split('/')[0] || '';
    const esc = c.display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    m = base.match(new RegExp(esc + '\\s*#?(\\d{1,3}(?:\\.\\d+)?)', 'i')) ||
        rest.match(/^(\d{1,3}(?:\.\d+)?)[\s.\-]/);
  }
  if (!m) { const r = base.match(/\b([IVXL]{1,7})\b/); if (r) { const v = roman(r[1]); if (v > 0 && v < 60) return String(v); } }
  return m ? normNumber(m[1]) : null;
}

module.exports = { detect, extractPortable, normKey, normNumber, cleanDirName, TIER_NAME };
