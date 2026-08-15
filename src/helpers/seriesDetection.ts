/**
 * Series detection — PURE. Signals in, proposals out.
 *
 * Deliberately imports nothing from `@/db`, React Native or a screen, so the
 * grouping decision is unit-testable without the native SQLite adapter — the
 * same extraction pattern `db/seriesMembershipDiff.ts` documents.
 */

/**
 * One book, reduced to the signals detection reads. Field names match the tag
 * names they come from so the checked-in research corpus can be used verbatim
 * as a fixture.
 */
export type DetectionUnit = {
  /**
   * The book's DIRECTORY, relative to the LIBRARY ROOT — never absolute, since
   * folder self-validation walks its ancestors. Two units share one `rel` when
   * their directory holds more than one book (see `flat`).
   */
  rel: string;
  file?: string | null;
  album?: string | null;
  artist?: string | null;
  album_artist?: string | null;
  composer?: string | null;
  grouping?: string | null;
  series?: string | null;
  part?: string | null;
  /** True when this unit's directory holds more than one book. */
  flat?: boolean;
};

/**
 * How strong the evidence for this placement was.
 *
 * A16 — THIS IS NEVER PERSISTED. It is a description of the algorithm, for the
 * scan log only. Its one consumer was the review queue, which A9 replaced with
 * a settings toggle; no surface displays it. Do not add a column for it.
 */
export type DetectionConfidence = 'guess' | 'possible' | 'likely' | 'certain';

export type ProposedBook<T extends DetectionUnit = DetectionUnit> = {
  unit: T;
  /** Canonical number, normalised; null when no signal carried one. */
  number: string | null;
  /** Evidence trail, e.g. `alb.name-num-dash`, `folder:name-corroborated(25/39)`. */
  why: string[];
  /** Scan-log only — see `DetectionConfidence`. Never write this to the DB. */
  confidence: DetectionConfidence;
};

export type ProposedSeries<T extends DetectionUnit = DetectionUnit> = {
  name: string;
  /** Normalised grouping key. Not persisted — identity is `name` alone (A15). */
  key: string;
  books: ProposedBook<T>[];
};

export type DetectSeriesOptions = {
  /** A3 — the `Also group by folder name` checkbox. Default off. */
  alsoGroupByFolder?: boolean;
};

const STOP = /^(the|a|an)\s+/i;

/** Grouping key for a series name: decoration, articles and case folded away. */
function normKey(name: string | null | undefined): string | null {
  if (!name) return null;
  return (
    String(name)
      .replace(/\(.*?\)/g, ' ')
      .replace(/[‘’']/g, "'")
      .replace(/\b(series|saga|trilogy|cycle|chronicles?|novels?)\b/gi, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(STOP, '')
      .toLowerCase()
      .replace(/\s+/g, ' ') || null
  );
}

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50 };

/** Roman numeral to int. Returns NaN on anything that is not one. */
function roman(input: string): number {
  // 'lll' is a real-world typo for III, so fold runs of l back to i. EVERY run:
  // the rule is about the character, not about where it sits, and without the
  // `g` a second run stayed an L and scored 50.
  const s = input.toLowerCase().replace(/l{2,}/g, (m) => 'i'.repeat(m.length));
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const a = ROMAN[s[i]];
    const b = ROMAN[s[i + 1]];
    if (!a) return NaN;
    total += b && b > a ? -a : a;
  }
  return total;
}

/**
 * Normalise a canonical number per §07: strip `#`/`Book`/`Volume` and leading
 * zeros, keep `12.5` / `14b` / `1-3` intact, accept roman numerals.
 */
function normNumber(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw)
    .trim()
    .replace(/^[#\s]*/, '')
    .replace(/^(book|volume|vol\.?|part|pt\.?)\s*/i, '')
    .trim();
  if (!s) return null;
  // The capture opens with `\d+`, so it can never come back starting at the
  // dot: `.5` fails the match outright and `0.5` backtracks `0*` to empty and
  // arrives whole. A bare leading dot is therefore REFUSED, not promoted — if
  // that is ever wanted, the pattern is what has to change, not this line.
  const m = s.match(/^0*(\d+(?:\.\d+)?(?:[a-z])?(?:-\d+)?)$/i);
  if (m) return m[1];
  if (/^[ivxlIVXL]+$/.test(s)) {
    const v = roman(s);
    return Number.isFinite(v) ? String(v) : null;
  }
  return null;
}

/** True when `name` is really the author under another heading. */
function isAuthorish(name: string, u: DetectionUnit): boolean {
  const k = normKey(name);
  if (!k) return false;
  return [u.artist, u.album_artist, u.composer].some((v) => v && normKey(v) === k);
}

/** A parsed name must look like a series title, not junk and not the author. */
function plausibleName(name: string | null, u: DetectionUnit): boolean {
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
// Portable signals travel with the file. They are tried in order and the first
// match wins — precedence, never a weighted score (A1).

/** One piece of evidence extracted from a single unit's own tags. */
type Signal = {
  src: string;
  name: string | null;
  num: string | null;
  /** Trust level of this signal, higher is better. */
  tier: number;
  /** Set when the number may be a file part rather than a book number. */
  splitRisk?: boolean;
};

type AlbumRule = {
  id: string;
  re: RegExp;
  /** Capture group holding the series name, if the shape reveals one. */
  name?: number;
  num?: number;
  numRoman?: number;
  /** Capture group holding a parenthetical, checked against the narrator. */
  paren?: number;
};

/** Ordered by specificity — the FIRST match wins and the rest are not tried. */
const ALBUM_RULES: AlbumRule[] = [
  // [Series N] Title
  { id: 'alb.bracket', re: /^\[(.{2,40}?)\s+(\d{1,3}(?:\.\d+)?)\]\s*(.+)$/, name: 1, num: 2 },
  // (Series N) Title
  { id: 'alb.paren-pre', re: /^\((\D{2,30}?)\s+(\d{1,3}(?:\.\d+)?)\)\s*(.+)$/, name: 1, num: 2 },
  // Title: Series, Book N        <-- the series is SECOND
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
  // number-only shapes: no series name is available from the album
  { id: 'alb.num-only-pre', re: /^\(#?(\d{1,3}(?:\.\d+)?)\)\s*(.+)$/, num: 1 },
  { id: 'alb.num-only-suf', re: /^(.+?)\s*\(#(\d{1,3}(?:\.\d+)?)\)\s*$/, num: 2 },
  { id: 'alb.num-only-lead', re: /^(\d{1,3}(?:\.\d+)?)\s*[-–.]\s*(.+)$/, num: 1 },
  { id: 'alb.num-only-lead2', re: /^(\d{1,3})\s+([A-Z].+)$/, num: 1 },
  { id: 'alb.author-mangled', re: /^[A-Z][a-z]+,\s*[A-Z]\.?:\s*(\d{1,3})\s+(.+)$/, num: 1 },
  // The Dark Tower IV: Title  (roman)
  { id: 'alb.roman', re: /^(.{2,40}?)\s+([IVXL]{1,7}|lll):\s*(.+)$/, name: 1, numRoman: 2 },
];

function extractPortable(u: DetectionUnit): Signal[] {
  const out: Signal[] = [];

  // 1. machine fields — highest trust
  const seriesTag = u.series?.trim();
  if (seriesTag) {
    out.push({ src: 'tag.extra.SERIES', name: seriesTag, num: normNumber(u.part), tier: 3 });
  }

  // 2. Grouping — a series name, but it may embed a number or be a split-book part
  const grouping = u.grouping?.trim();
  if (grouping) {
    const withBook = grouping.match(
      /^(.+?)[,\s]+(?:Book|Vol(?:ume)?)\s*#?(\d{1,3}(?:\.\d+)?)$/i,
    );
    const bareNum = withBook ? null : grouping.match(/^(.+?)\s+(\d{1,3})$/);
    if (withBook) {
      out.push({
        src: 'tag.Grouping+num',
        name: withBook[1].trim(),
        num: normNumber(withBook[2]),
        tier: 2,
      });
    } else if (bareNum) {
      // "Discworld 13" (real) vs "Warbreaker 1" (one book split in two files) —
      // indistinguishable from the tag alone, so flag the risk for the guard.
      out.push({
        src: 'tag.Grouping+bare-num',
        name: bareNum[1].trim(),
        num: normNumber(bareNum[2]),
        tier: 2,
        splitRisk: true,
      });
    } else {
      out.push({ src: 'tag.Grouping', name: grouping, num: null, tier: 2 });
    }
  }

  // 3. album patterns — first match wins, ordered by specificity
  const album = (u.album ?? '')
    .replace(/\s*\((?:Unabridged|Abridged)\)\s*$/i, '')
    .trim();
  if (album) {
    for (const rule of ALBUM_RULES) {
      const m = album.match(rule.re);
      if (!m) continue;
      const name = rule.name ? m[rule.name].trim() : null;
      let num = rule.num ? normNumber(m[rule.num]) : null;
      if (rule.numRoman) {
        const v = roman(m[rule.numRoman]);
        num = Number.isFinite(v) && v > 0 && v < 100 ? String(v) : null;
        // A roman rule that produced no number matched something else entirely.
        if (num == null) continue;
      }
      if (name && !plausibleName(name, u)) {
        // The name is junk or the author — but the NUMBER may still be good.
        if (num) out.push({ src: `${rule.id}(name-rejected)`, name: null, num, tier: 1 });
        break;
      }
      // A parenthetical equal to the narrator confirms the shape rather than
      // being part of the title ("Mistborn 6 (Michael Kramer)").
      const narratorParen =
        rule.paren != null && u.composer && normKey(m[rule.paren]) === normKey(u.composer);
      out.push({ src: rule.id, name, num, tier: name ? (narratorParen ? 2 : 1) : 1 });
      break;
    }
  }

  return out;
}

// ---------- B. folder clustering, self-validated ----------
// Folder structure is NOT portable, so it has to earn its trust from the tags
// of its own members. This is never relaxed (A2).

/** Every ancestor directory of a unit, shallowest first, excluding the file. */
function ancestors(rel: string): string[] {
  const parts = rel.split('/');
  const out: string[] = [];
  for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join('/'));
  return out;
}

/** Strip the decoration a human puts on a series directory. */
function cleanDirName(base: string): string {
  return base
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\((?:19|20)\d\d(?:-(?:19|20)\d\d)?\)/g, ' ')
    .replace(/\b(19|20)\d\d\s*-\s*/g, ' ')
    .replace(/,?\s*Books?\s+\d+\s*-\s*\d+\s*$/i, ' ')
    .replace(/\s*-\s*[A-Z][a-z]+\s+[A-Z][a-z']+\s*$/, ' ') // "... - Dan Simmons"
    .replace(/^\s*\d{1,3}\s*[-.]\s*/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Cluster = {
  dir: string;
  key: string;
  display: string;
  members: number[];
  size: number;
  /** Members whose own portable signals name this same series. */
  nameOk: number;
  /** Members carrying a canonical number from any signal. */
  numOk: number;
  mode: 'name-corroborated' | 'number-corroborated' | 'uncorroborated' | 'rejected';
};

const NAME_CORROBORATION_MIN = 2;
const NAME_CORROBORATION_FRAC = 0.25;
const NUMBER_CORROBORATION_FRAC = 0.6;
const MIN_CLUSTER_SIZE = 2;
/** Cluster size at which an uncorroborated folder is accepted, at full fidelity. */
const UNCORROBORATED_MIN_SIZE = 3;

/**
 * NOTE — every directory is judged by the same rules, and DEPTH IS NEVER
 * CONSULTED. The research harness skipped depth 1 as "the author level", and
 * that line was ported here and then removed: depth 1 is a fact about where the
 * user pointed their library root, not about the books. A user who adds
 * `/Audiobooks/Terry Pratchett` rather than `/Audiobooks` had their Discworld
 * editions merged into one 47-book series — A4's split silently stopped
 * working, and 11 of the other 18 re-rooted corpus folders were worse too.
 * Removing it is byte-identical on the corpus, and
 * `seriesDetection.corpus.test.ts` now pins the invariance.
 *
 * The author level is still refused — by `isAuthorish` below, on the tags,
 * which works at every depth. What the depth rule additionally caught was an
 * author folder whose books carry NO author tag; at full fidelity that is now
 * accepted, exactly as the identical folder one level down always was.
 */
function folderClusters(
  units: readonly DetectionUnit[],
  portables: Signal[][],
  acceptUncorroborated: number,
): Cluster[] {
  const byDir = new Map<string, number[]>();
  units.forEach((u, i) => {
    for (const a of ancestors(u.rel)) {
      const list = byDir.get(a);
      if (list) list.push(i);
      else byDir.set(a, [i]);
    }
  });

  const clusters: Cluster[] = [];
  for (const [dir, idxs] of byDir) {
    if (idxs.length < MIN_CLUSTER_SIZE) continue;

    const display = cleanDirName(dir.split('/').pop() ?? '');
    const key = normKey(display);
    if (!key) continue;

    const members = idxs.map((i) => units[i]);
    // The author-as-folder trap: half the members call this name their author.
    const authorish = members.filter((u) => isAuthorish(display, u)).length;
    if (authorish >= members.length / 2) continue;

    let nameOk = 0;
    let numOk = 0;
    for (const i of idxs) {
      const ps = portables[i] ?? [];
      if (ps.some((p) => p.name && normKey(p.name) === key)) nameOk++;
      if (ps.some((p) => p.num != null)) numOk++;
    }

    const size = idxs.length;
    const need = Math.max(NAME_CORROBORATION_MIN, Math.ceil(size * NAME_CORROBORATION_FRAC));
    let mode: Cluster['mode'] = 'rejected';
    if (nameOk >= need) mode = 'name-corroborated';
    else if (numOk >= Math.ceil(size * NUMBER_CORROBORATION_FRAC) && size >= 3)
      mode = 'number-corroborated';
    else if (acceptUncorroborated && size >= acceptUncorroborated) mode = 'uncorroborated';

    clusters.push({ dir, key, display, members: idxs, size, nameOk, numOk, mode });
  }
  return clusters;
}

/**
 * A number embedded in the book's own directory, or in the path below the
 * series directory. NOT portable — it is the last resort, consulted only when
 * no tag carried a number.
 */
function folderNumber(u: DetectionUnit, cluster: Cluster | undefined): string | null {
  const base = u.rel.split('/').pop() ?? '';
  let m =
    base.match(/^\((\d{1,3}(?:\.\d+)?)\)/) || // "(11) Reaper Man"
    base.match(/^(\d{1,3}(?:\.\d+)?)[\s.\-]/) || // "6.The Bands of Mourning"
    base.match(/\b(?:Book|Vol(?:ume)?)\s*(\d{1,3}(?:\.\d+)?)/i);

  if (!m && cluster) {
    const rest = u.rel.slice(cluster.dir.length + 1).split('/')[0] ?? '';
    const escaped = cluster.display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    m =
      base.match(new RegExp(`${escaped}\\s*#?(\\d{1,3}(?:\\.\\d+)?)`, 'i')) ||
      rest.match(/^(\d{1,3}(?:\.\d+)?)[\s.\-]/);
  }
  if (!m) {
    const r = base.match(/\b([IVXL]{1,7})\b/);
    if (r) {
      const v = roman(r[1]);
      if (v > 0 && v < 60) return String(v);
    }
    return null;
  }
  return normNumber(m[1]);
}

// ---------- C. reconcile ----------

/** One unit's outcome: the series it was assigned to, or nothing. */
type Assignment<T extends DetectionUnit> = {
  unit: T;
  name: string | null;
  key: string | null;
  num: string | null;
  why: string[];
  confidence: DetectionConfidence;
  signals: Signal[];
};

function assign<T extends DetectionUnit>(
  units: readonly T[],
  acceptUncorroborated: number,
): Assignment<T>[] {
  const portables = units.map(extractPortable);

  const clusters = folderClusters(units, portables, acceptUncorroborated).filter(
    (c) => c.mode !== 'rejected',
  );
  // The deepest accepted cluster wins for a unit, so a sub-series beats its parent.
  const clusterFor = new Map<number, Cluster>();
  for (const c of clusters) {
    for (const i of c.members) {
      const current = clusterFor.get(i);
      if (!current || c.dir.length > current.dir.length) clusterFor.set(i, c);
    }
  }

  return units.map((u, i) => {
    const signals = portables[i];
    const named = signals
      .filter((s): s is Signal & { name: string } => Boolean(s.name) && plausibleName(s.name, u))
      .sort((a, b) => b.tier - a.tier);
    const best = named[0] ?? null;
    let num = best?.num ?? signals.find((s) => s.num != null)?.num ?? null;
    const cluster = clusterFor.get(i);

    let name: string | null = null;
    let key: string | null = null;
    let why: string[] = [];
    let confidence: DetectionConfidence = 'guess';

    if (best) {
      name = best.name;
      key = normKey(best.name);
      why = named.map((s) => s.src);
      // A machine tag is stronger evidence than a parsed album string.
      confidence = best.tier >= 3 ? 'certain' : 'likely';
      if (cluster && cluster.mode !== 'uncorroborated' && cluster.key === key) {
        why.push(`folder:${cluster.mode}`);
        confidence = 'certain'; // the folder independently agrees
      }
    } else if (cluster?.mode === 'name-corroborated') {
      name = cluster.display;
      key = cluster.key;
      why = [`folder:name-corroborated(${cluster.nameOk}/${cluster.size})`];
      confidence = 'possible';
    } else if (cluster?.mode === 'number-corroborated') {
      name = cluster.display;
      key = cluster.key;
      why = [`folder:number-corroborated(${cluster.numOk}/${cluster.size})`];
      confidence = 'guess';
    } else if (cluster?.mode === 'uncorroborated') {
      name = cluster.display;
      key = cluster.key;
      why = [`folder:UNCORROBORATED(${cluster.size} books, nothing in the tags agrees)`];
      confidence = 'guess';
    }

    // Last resort, and only for a book that already belongs somewhere.
    if (num == null && name) {
      const fromFolder = folderNumber(u, cluster);
      if (fromFolder != null) {
        num = fromFolder;
        why = [...why, 'num:folder'];
      }
    }

    return { unit: u, name, key, num, why, confidence, signals };
  });
}

// ---------- D. refinement ----------
// Runs AFTER assignment, never during it: a unit whose portable name is
// withdrawn here must NOT fall through to its folder as a second chance.

// Group numbering runs ACROSS the alternatives, not within each one, so every
// alternative that can win has to declare its own capture and be listed in the
// `part` pick below. `Disc|CD` shipped without one: it matched, `part` came out
// undefined, and the whole third of the guard could never suppress anything.
const SPLIT_RE = /\((\d+)\s*of\s*(\d+)\)|\bPart\s+(\d+)\s*(?:of\s*\d+)?\s*$|\b(?:Disc|CD)\s*(\d+)\s*$/i;

/**
 * "Warbreaker 1" alongside an album reading "(1 of 2)" is ONE book in two
 * files, not a two-book series. The album alone is not enough — the number in
 * the tag must be the same number, or a genuine `Discworld 4` gets suppressed.
 */
function isSplitBookPart<T extends DetectionUnit>(a: Assignment<T>): boolean {
  const m = (a.unit.album ?? '').match(SPLIT_RE);
  if (!m) return false;
  const part = m[1] || m[3] || m[4];
  return a.signals.some((s) => s.splitRisk && String(s.num) === String(part));
}

/**
 * NOTE — there is deliberately no `&` -> `and` key merge here, although the
 * research harness carried one. It could never fire: `normKey` deletes `&`
 * along with all other punctuation BEFORE any key is compared, so the merge
 * only ever saw keys that no longer contained an ampersand. Removing it was
 * verified to change nothing on the 298-unit corpus. If a future change makes
 * `normKey` preserve punctuation, revisit this — `Memory, Sorrow & Thorn` and
 * `Memory, Sorrow and Thorn` would then key differently and need folding.
 */

/** Strip the decoration a human puts on a series name. */
function stripDecoration(name: string, members: readonly DetectionUnit[]): string {
  let n = String(name).trim();
  n = n.replace(/\s+series\s+by\s+.+$/i, ''); // "... series by Tad Williams"
  n = n.replace(/\s*\bseries\b\s*$/i, ''); // a trailing "Series"
  n = n.replace(/[,\s]+\d+\s*-\s*\d+\s*$/, ''); // "... 1-3", an owned-range suffix
  n = n.replace(/^\s*[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2}\s+-\s+/, (prefix) => {
    // Only strip a leading "Name - " when a member actually names that author.
    const who = prefix.replace(/\s+-\s+$/, '');
    return members.some(
      (u) => normKey(u.artist) === normKey(who) || normKey(u.album_artist) === normKey(who),
    )
      ? ''
      : prefix;
  });
  n = n.replace(/[:,\s]+$/, '').trim();
  return n || String(name).trim();
}

const isAbbrev = (n: string) => /^[A-Z0-9]{2,5}$/.test(n.replace(/[^A-Za-z0-9]/g, ''));

/**
 * Elect ONE display name per group. Candidates are each member's own parsed
 * name plus every folder on its path; a candidate only stands if it normalises
 * to the group's key (or a tidier form of it).
 */
function electDisplayNames<T extends DetectionUnit>(assignments: Assignment<T>[]): void {
  const groups = new Map<string, Assignment<T>[]>();
  for (const a of assignments) {
    if (!a.key) continue;
    const group = groups.get(a.key);
    if (group) group.push(a);
    else groups.set(a.key, [a]);
  }

  for (const [key, members] of groups) {
    const units = members.map((m) => m.unit);
    const votes = new Map<string, number>();

    for (const a of members) {
      const parts = a.unit.rel.split('/');
      const candidates = [a.name];
      for (let d = 1; d < parts.length - 1; d++) candidates.push(cleanDirName(parts[d]));

      for (const raw of candidates) {
        if (!raw) continue;
        const candidate = stripDecoration(raw, units);
        const ck = normKey(candidate);
        if (!ck || !(ck === key || key.includes(ck) || ck.includes(key))) continue;
        votes.set(candidate, (votes.get(candidate) ?? 0) + (ck === key ? 1 : 0.9));
      }
    }
    if (!votes.size) continue;

    const [elected] = [...votes].sort((a, b) => {
      const abbrevA = isAbbrev(a[0]);
      const abbrevB = isAbbrev(b[0]);
      if (abbrevA !== abbrevB) return abbrevA ? 1 : -1; // never prefer an abbreviation
      if (Math.abs(b[1] - a[1]) > 0.5) return b[1] - a[1]; // then clearly more votes
      return a[0].length - b[0].length; // then the shortest
    })[0];

    const newKey = normKey(elected);
    for (const a of members) {
      a.name = elected;
      if (newKey) a.key = newKey;
    }
  }
}

// ---------- E. the number-collision split ----------

const MIN_NUMBERED = 4;
const MIN_DUP_RATE = 0.25;
const MAX_INNER_DUP = 0.1;
const MIN_PART_SIZE = 2;

const duplicateRate = (numbers: (string | null)[]): number => {
  const present = numbers.filter((n): n is string => n != null);
  if (!present.length) return 0;
  return (present.length - new Set(present).size) / present.length;
};

/**
 * A4 — a real series numbers each book once. When a proposed series carries
 * the same canonical number repeatedly, something has merged that should not
 * have: two editions of one series, or two series under one name. If the
 * members partition cleanly by folder into parts that are each internally
 * near-unique, THAT folder split is the real boundary — take it, and name each
 * part by its raw folder name, because the year in the folder IS the
 * discriminator.
 *
 * This is a GROUPING rule, not an identity concept (A15).
 */
function splitOnNumberCollision<T extends DetectionUnit>(assignments: Assignment<T>[]): void {
  const groups = new Map<string, Assignment<T>[]>();
  for (const a of assignments) {
    if (!a.key) continue;
    const group = groups.get(a.key);
    if (group) group.push(a);
    else groups.set(a.key, [a]);
  }

  for (const [key, members] of groups) {
    if (members.filter((m) => m.num != null).length < MIN_NUMBERED) continue;
    const rate = duplicateRate(members.map((m) => m.num));
    if (rate < MIN_DUP_RATE) continue;

    // Deepest common ancestor of every member, then partition on the NEXT segment.
    const paths = members.map((m) => m.unit.rel.split('/'));
    let dca = 0;
    while (paths.every((p) => p.length > dca + 1 && p[dca] === paths[0][dca])) dca++;

    const parts = new Map<string, Assignment<T>[]>();
    for (const m of members) {
      const seg = m.unit.rel.split('/')[dca] ?? '';
      const part = parts.get(seg);
      if (part) part.push(m);
      else parts.set(seg, [m]);
    }

    if (parts.size < 2) continue; // nothing to split on
    const partitions = [...parts.values()];
    if (partitions.some((p) => p.length < MIN_PART_SIZE)) continue; // degenerate
    if (partitions.some((p) => duplicateRate(p.map((m) => m.num)) > MAX_INNER_DUP)) continue;

    const trail = `split:number-collision(${(rate * 100).toFixed(0)}% dupes -> ${parts.size} folders)`;
    for (const [seg, part] of parts) {
      for (const m of part) {
        m.key = `${key}#${seg.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        m.name = seg; // the raw folder name, undecorated
        m.why = [...m.why, trail];
      }
    }
  }
}

// ---------- F. name disambiguation ----------

/** The directory that contains every member of a group. */
function commonParent(units: readonly DetectionUnit[]): string | null {
  const paths = units.map((u) => u.rel.split('/'));
  let shared = 0;
  while (paths.every((p) => p.length > shared && p[shared] === paths[0][shared])) shared++;
  // One level above the shared directory is what distinguishes this group.
  return shared >= 2 ? paths[0][shared - 2] : (paths[0][0] ?? null);
}

/**
 * A15 — series identity is `name` alone, so two detected groups may not answer
 * to the same name. They DISAMBIGUATE: the parent folder first, then a
 * counter. They never merge (that would be a wrong grouping) and never abstain
 * (that would lose a correct one).
 */
function disambiguateNames<T extends DetectionUnit>(proposals: ProposedSeries<T>[]): void {
  const taken = new Set<string>();
  for (const p of proposals) {
    if (!taken.has(p.name)) {
      taken.add(p.name);
      continue;
    }
    const bare = p.name;
    const first = proposals.find((q) => q !== p && q.name === bare);
    const parent = commonParent(p.books.map((b) => b.unit));
    const firstParent = first ? commonParent(first.books.map((b) => b.unit)) : null;

    // The parent folder only qualifies as a discriminator when the two groups
    // sit under DIFFERENT parents; otherwise it adds a word and no meaning.
    if (first && parent && firstParent && parent !== firstParent) {
      const mine = `${bare} (${parent})`;
      const theirs = `${bare} (${firstParent})`;
      if (!taken.has(mine) && !taken.has(theirs)) {
        taken.delete(bare);
        first.name = theirs;
        p.name = mine;
        taken.add(theirs).add(mine);
        continue;
      }
    }

    let n = 2;
    while (taken.has(`${bare} (${n})`)) n++;
    p.name = `${bare} (${n})`;
    taken.add(p.name);
  }
}

/**
 * The seam. Given every book in the library, decide which of them form series.
 */
export function detectSeries<T extends DetectionUnit>(
  units: readonly T[],
  options: DetectSeriesOptions = {},
): ProposedSeries<T>[] {
  const assignments = assign(units, options.alsoGroupByFolder ? UNCORROBORATED_MIN_SIZE : 0);

  for (const a of assignments) {
    if (a.name && isSplitBookPart(a)) {
      a.name = null;
      a.key = null;
      a.num = null;
      a.why = ['suppressed:split-book-part'];
    }
  }
  electDisplayNames(assignments);
  splitOnNumberCollision(assignments);

  const byKey = new Map<string, ProposedSeries<T>>();
  for (const a of assignments) {
    if (!a.name || !a.key) continue;
    let proposal = byKey.get(a.key);
    if (!proposal) {
      proposal = { name: a.name, key: a.key, books: [] };
      byKey.set(a.key, proposal);
    }
    proposal.books.push({
      unit: a.unit,
      number: a.num,
      why: a.why,
      confidence: a.confidence,
    });
  }

  // A5 — a series needs two books. One book is a book.
  const proposals = [...byKey.values()].filter((p) => p.books.length >= 2);
  disambiguateNames(proposals);
  return proposals;
}
