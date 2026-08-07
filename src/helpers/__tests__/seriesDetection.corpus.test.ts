import { detectSeries, type ProposedSeries } from '@/helpers/seriesDetection';
import {
  corpusUnits,
  truthFor,
  type CorpusUnit,
  type GroundTruth,
} from '@/helpers/__fixtures__/seriesCorpus';

/**
 * Scoring against the real library. See the fixture's own header for the two
 * caveats that govern what may be claimed from these numbers — in short: the
 * ground truth is AUTHORED, and coverage figures are LOWER BOUNDS, so this
 * suite asserts ACCURACY and never asserts a coverage rate.
 */

type Proposal = ProposedSeries<CorpusUnit>;

/**
 * Name comparison for scoring only. Deliberately a SEPARATE implementation
 * from the cascade's own normaliser: a test that judged the code with the
 * code's own key function could never disagree with it.
 */
const scoringKey = (s: string | null | undefined): string =>
  String(s ?? '')
    .replace(/&/g, ' and ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(series|saga|trilogy|cycle|chronicles?|novels?)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/i, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** A book's truth identity, edition included — two editions are two series. */
const editionAwareIdentity = (t: GroundTruth) =>
  `${t.series ?? '(standalone)'}${t.edition ? `|${t.edition}` : ''}`;

/**
 * Grouping purity: of all books placed into a series, the fraction that landed
 * with the majority truth-group of the proposal they were placed in.
 */
function purity(proposals: Proposal[]): number {
  let placed = 0;
  let misplaced = 0;
  for (const p of proposals) {
    placed += p.books.length;
    const counts = new Map<string, number>();
    for (const b of p.books) {
      const id = editionAwareIdentity(truthFor(b.unit));
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    misplaced += p.books.length - Math.max(...counts.values());
  }
  return placed ? (placed - misplaced) / placed : 1;
}

/** Standalone books swept into a series — the failure that costs trust. */
const standalonesSwept = (proposals: Proposal[]) =>
  proposals.flatMap((p) => p.books).filter((b) => truthFor(b.unit).series == null).length;

const booksPlaced = (proposals: Proposal[]) =>
  proposals.reduce((n, p) => n + p.books.length, 0);

/** Books that really are in a multi-book series and got placed somewhere. */
const inSeriesPlaced = (proposals: Proposal[]) =>
  proposals.flatMap((p) => p.books).filter((b) => truthFor(b.unit).multi).length;

/** Canonical-number accuracy, measured only on correctly-NAMED books. */
function numberAccuracy(proposals: Proposal[]): { correct: number; scored: number } {
  let correct = 0;
  let scored = 0;
  for (const p of proposals) {
    for (const b of p.books) {
      const t = truthFor(b.unit);
      if (!t.series || t.number == null) continue;
      if (scoringKey(p.name) !== scoringKey(t.series)) continue;
      scored++;
      if (String(b.number) === String(t.number)) correct++;
    }
  }
  return { correct, scored };
}

const conservative = () => detectSeries(corpusUnits);
const full = () => detectSeries(corpusUnits, { alsoGroupByFolder: true });

describe('the corpus is the fixture it claims to be', () => {
  test('298 units, 236 of them in a multi-book series across 38 series', () => {
    expect(corpusUnits).toHaveLength(298);

    const multi = corpusUnits.filter((u) => truthFor(u).multi);
    expect(multi).toHaveLength(236);

    // The headline "38 series" is EDITION-AWARE: 37 distinct names, of which
    // exactly one — Discworld — is present as two separate recordings. That
    // single duplication is the whole reason A4's collision check exists.
    expect(new Set(multi.map((u) => truthFor(u).series)).size).toBe(37);
    expect(new Set(multi.map((u) => editionAwareIdentity(truthFor(u)))).size).toBe(38);
    expect(new Set(multi.filter((u) => truthFor(u).edition).map((u) => truthFor(u).series))).toEqual(
      new Set(['Discworld']),
    );
  });
});

describe('A3 · the two fidelity levels, as fixture-level facts', () => {
  test('conservative: 19 series, 179 books placed, 0 standalones swept', () => {
    const proposals = conservative();

    expect(proposals).toHaveLength(19);
    expect(booksPlaced(proposals)).toBe(179);
    expect(standalonesSwept(proposals)).toBe(0);
    // Not a coverage claim — an exact count on a frozen fixture.
    expect(inSeriesPlaced(proposals)).toBe(179);
  });

  test('full: 28 series, 213 books placed, 2 standalones swept', () => {
    const proposals = full();

    expect(proposals).toHaveLength(28);
    expect(booksPlaced(proposals)).toBe(213);
    expect(standalonesSwept(proposals)).toBe(2);
    expect(inSeriesPlaced(proposals)).toBe(210);
  });

  test('full trades purity for reach — that is the whole choice being offered', () => {
    expect(purity(full())).toBeLessThan(purity(conservative()));
  });
});

describe('the named forcing cases, on the real library', () => {
  const named = (proposals: Proposal[], name: string) => proposals.find((p) => p.name === name);
  const unitsUnder = (dir: string) => corpusUnits.filter((u) => u.rel.startsWith(dir));

  test('A4 · the 80-book Discworld merge splits into 41 + 39', () => {
    const proposals = conservative();
    const original = named(proposals, 'Discworld');
    const reissue = named(proposals, 'Discworld (2022)');

    expect(original?.books).toHaveLength(41);
    expect(reissue?.books).toHaveLength(39);
    // The trail proves the two were ONE group of 80 before the check ran.
    expect(original?.books[0].why.join(' ')).toContain(
      'split:number-collision(49% dupes -> 2 folders)',
    );
    // And the split is clean: neither half holds a book of the other edition.
    expect(purity([original as Proposal, reissue as Proposal])).toBe(1);
  });

  test('A2 · the author folder is refused because its members name other series', () => {
    const enders = unitsUnder('Orson Scott Card/Enders Game');
    expect(enders.length).toBeGreaterThanOrEqual(20);

    // What the folder actually contains: several genuinely different series.
    const truthsInside = new Set(enders.map((u) => truthFor(u).series).filter(Boolean));
    expect(truthsInside.size).toBeGreaterThan(1);

    expect(named(conservative(), 'Enders Game')).toBeUndefined();
    // Only when the user opts into uncorroborated folders does it appear.
    expect(named(full(), 'Enders Game')).toBeDefined();
  });

  test('A4 · the near-threshold series is left alone, because 24% is under the gate', () => {
    const demonAccords = named(conservative(), 'Demon Accords');

    expect(demonAccords?.books).toHaveLength(17);
    expect(demonAccords?.books.some((b) => b.why.join(' ').includes('split:'))).toBe(false);

    // Duplication is REAL here — it just does not reach 25%.
    const numbers = demonAccords?.books.map((b) => b.number).filter((n) => n != null) ?? [];
    const dupRate = (numbers.length - new Set(numbers).size) / numbers.length;
    expect(dupRate).toBeGreaterThan(0);
    expect(dupRate).toBeLessThan(0.25);
  });

  test('the split-book guard suppresses the phantom two-book Warbreaker series', () => {
    const warbreaker = unitsUnder('Brandon Sanderson/Warbreaker');
    expect(warbreaker.map((u) => u.grouping)).toEqual(['Warbreaker 1', 'Warbreaker 2']);

    for (const proposals of [conservative(), full()]) {
      const placed = proposals.flatMap((p) => p.books).map((b) => b.unit);
      expect(placed).not.toContain(warbreaker[0]);
      expect(placed).not.toContain(warbreaker[1]);
    }
  });

  test('the science-of spin-off forms its own group rather than being absorbed', () => {
    const spinOff = named(full(), 'The Science of Discworld');

    expect(spinOff?.books).toHaveLength(4);
    const discworldBooks = full()
      .filter((p) => p.name.startsWith('Discworld'))
      .flatMap((p) => p.books.map((b) => b.unit.rel));
    expect(discworldBooks).not.toContain(spinOff?.books[0].unit.rel);
  });
});

describe('A16 · the confidence tier is a real signal, and stays out of the DB', () => {
  test('every proposed book carries a tier', () => {
    const tiers = new Set(conservative().flatMap((p) => p.books.map((b) => b.confidence)));
    expect(tiers.size).toBeGreaterThan(1);
  });

  test('a `certain` placement is never in the wrong series', () => {
    for (const proposals of [conservative(), full()]) {
      for (const p of proposals) {
        const counts = new Map<string, number>();
        for (const b of p.books) {
          const id = editionAwareIdentity(truthFor(b.unit));
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        const [majority] = [...counts].sort((a, b) => b[1] - a[1])[0];
        for (const b of p.books.filter((x) => x.confidence === 'certain')) {
          expect(editionAwareIdentity(truthFor(b.unit))).toBe(majority);
        }
      }
    }
  });
});

describe('graceful degradation without the scan-captured tag columns', () => {
  /**
   * What a library imported BEFORE ticket 02 started capturing tags looks
   * like: `series`, `grouping` and `part` all null. This is what makes the
   * NO-BACKFILL ruling safe rather than lucky — if grouping fell apart here,
   * existing libraries would need a re-import.
   */
  const withoutTags = corpusUnits.map((u) => ({ ...u, series: null, grouping: null, part: null }));
  const degraded = () => detectSeries(withoutTags);

  test('grouping is untouched: same series, same books, same names', () => {
    expect(degraded()).toHaveLength(19);
    expect(booksPlaced(degraded())).toBe(179);
    expect(degraded().map((p) => p.name).sort()).toEqual(
      conservative().map((p) => p.name).sort(),
    );
  });

  test('grouping purity does not move', () => {
    expect(purity(degraded())).toBeCloseTo(purity(conservative()), 5);
  });

  test('no standalone gets swept in either', () => {
    expect(standalonesSwept(degraded())).toBe(0);
  });

  test('only canonical numbering degrades — 162/168 to 157/168', () => {
    const before = numberAccuracy(conservative());
    const after = numberAccuracy(degraded());

    // The same books are scored; five of them lose their number. 96.4% -> 93.5%
    // as the spec rounds it. Exact counts, so rounding cannot hide a drift.
    expect(before).toEqual({ correct: 162, scored: 168 });
    expect(after).toEqual({ correct: 157, scored: 168 });
  });
});

describe('threshold assertions on the conservative tier', () => {
  test('grouping purity is at least 98.3%', () => {
    expect(purity(conservative())).toBeGreaterThanOrEqual(0.983);
  });

  test('no standalone is ever swept into a series', () => {
    expect(standalonesSwept(conservative())).toBe(0);
  });

  test('canonical numbers are at least 96.4% correct', () => {
    const { correct, scored } = numberAccuracy(conservative());
    expect(correct / scored).toBeGreaterThanOrEqual(0.964);
  });

  test('the edition-aware naming case survives: `Discworld (2022)` is proposed', () => {
    expect(conservative().map((p) => p.name)).toContain('Discworld (2022)');
  });
});
