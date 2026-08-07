/**
 * Unit assembly, and the round trip that stops it drifting from the fixture.
 *
 * The rules half is ordinary. The corpus half is the point: it rebuilds
 * DATABASE ROWS from the 298 checked-in research units, runs them back through
 * `buildDetectionUnits`, and asserts `detectSeries` still reproduces every
 * number in §A3. If assembly ever changes what `rel`, `flat` or `album` mean,
 * those totals move and this fails — which is the only way the app's input and
 * the corpus's input can be held to one shape.
 */

import {
  buildDetectionUnits,
  UNKNOWN_AUTHOR,
  UNKNOWN_BOOK_TITLE,
  UNKNOWN_NARRATOR,
  type DetectionBookRow,
} from '@/helpers/detectionUnits';
import { detectSeries } from '@/helpers/seriesDetection';
import { corpusUnits } from '@/helpers/__fixtures__/seriesCorpus';

const ROOT = '/storage/emulated/0/Audiobooks';

const row = (over: Partial<DetectionBookRow> = {}): DetectionBookRow => ({
  firstFilePath: `${ROOT}/Author/Book/01.m4b`,
  title: 'A Book',
  author: 'An Author',
  narrator: 'A Narrator',
  series: null,
  part: null,
  grouping: null,
  // Carried for ticket 02's fill-rate measurement only; the assembly ignores
  // it, which the "never reaches a unit" test below pins.
  fileFormat: 'MPEG-4',
  ...over,
});

describe('buildDetectionUnits — paths', () => {
  it('makes rel relative to the library root, never absolute', () => {
    const { units } = buildDetectionUnits(
      [row({ firstFilePath: `${ROOT}/Terry Pratchett/Discworld/01.m4b` })],
      [ROOT],
    );
    expect(units[0].rel).toBe('Terry Pratchett/Discworld');
    expect(units[0].dir).toBe(`${ROOT}/Terry Pratchett/Discworld`);
    expect(units[0].file).toBe('01.m4b');
  });

  it('preserves rel DEPTH, which the folder rules reason about', () => {
    // Measured: leaving the root on the front turns the root itself into a
    // folder cluster — the corpus grows a 71-book series called "Audiobooks"
    // at full fidelity. Depth is not cosmetic.
    const { units } = buildDetectionUnits(
      [row({ firstFilePath: `${ROOT}/Andy Weir/Artemis.m4b` })],
      [ROOT],
    );
    expect(units[0].rel.split('/')).toHaveLength(1);
  });

  it('matches the longest root first, so a nested root wins', () => {
    const nested = `${ROOT}/Imports`;
    const { units } = buildDetectionUnits(
      [row({ firstFilePath: `${nested}/Series/01.m4b` })],
      [ROOT, nested],
    );
    expect(units[0].rel).toBe('Series');
  });

  it('tolerates a trailing slash on a configured root', () => {
    const { units } = buildDetectionUnits(
      [row({ firstFilePath: `${ROOT}/Series/01.m4b` })],
      [`${ROOT}/`],
    );
    expect(units[0].rel).toBe('Series');
  });

  it('gives a book sitting directly in the root an empty rel', () => {
    const { units } = buildDetectionUnits(
      [row({ firstFilePath: `${ROOT}/loose.m4b` })],
      [ROOT],
    );
    expect(units[0].rel).toBe('');
  });

  it('DROPS a book under no configured root rather than going absolute', () => {
    const result = buildDetectionUnits(
      [
        row({ firstFilePath: `${ROOT}/Kept/01.m4b` }),
        row({ firstFilePath: '/sdcard/Elsewhere/Book/01.m4b' }),
      ],
      [ROOT],
    );
    expect(result.units).toHaveLength(1);
    expect(result.outsideRoots).toBe(1);
  });

  it('drops every book when no root is configured, and says so', () => {
    const result = buildDetectionUnits([row(), row()], []);
    expect(result.units).toEqual([]);
    expect(result.outsideRoots).toBe(2);
  });

  it('drops a book with no first file path', () => {
    const result = buildDetectionUnits([row({ firstFilePath: '' })], [ROOT]);
    expect(result.units).toEqual([]);
    expect(result.keyless).toBe(1);
  });

  it('carries the structural key through untouched', () => {
    const path = `${ROOT}/Author/Book/01.m4b`;
    const { units } = buildDetectionUnits([row({ firstFilePath: path })], [
      ROOT,
    ]);
    expect(units[0].bookKey).toBe(path);
  });
});

describe('buildDetectionUnits — flat is a property of the directory', () => {
  it('flags every book in a directory holding more than one', () => {
    const { units } = buildDetectionUnits(
      [
        row({ firstFilePath: `${ROOT}/Author/one.m4b` }),
        row({ firstFilePath: `${ROOT}/Author/two.m4b` }),
        row({ firstFilePath: `${ROOT}/Author/Solo/01.m4b` }),
      ],
      [ROOT],
    );
    expect(units.map((u) => u.flat)).toEqual([true, true, false]);
  });

  it('counts dropped books out of the tally', () => {
    // The second book is outside every root, so the first is NOT flat.
    const { units } = buildDetectionUnits(
      [
        row({ firstFilePath: `${ROOT}/Author/one.m4b` }),
        row({ firstFilePath: '/elsewhere/Author/two.m4b' }),
      ],
      [ROOT],
    );
    expect(units[0].flat).toBe(false);
  });
});

describe('buildDetectionUnits — tags', () => {
  it('maps the single author column onto both artist fields', () => {
    const { units } = buildDetectionUnits([row({ author: 'Brandon' })], [ROOT]);
    expect(units[0].artist).toBe('Brandon');
    expect(units[0].album_artist).toBe('Brandon');
  });

  it('feeds the title into the album channel and the narrator into composer', () => {
    const { units } = buildDetectionUnits(
      [row({ title: 'Mistborn 6', narrator: 'Michael Kramer' })],
      [ROOT],
    );
    expect(units[0].album).toBe('Mistborn 6');
    expect(units[0].composer).toBe('Michael Kramer');
  });

  it("stringifies part without losing a novella's decimal", () => {
    expect(buildDetectionUnits([row({ part: 15.5 })], [ROOT]).units[0].part).toBe(
      '15.5',
    );
    expect(buildDetectionUnits([row({ part: 0 })], [ROOT]).units[0].part).toBe(
      '0',
    );
    expect(buildDetectionUnits([row({ part: null })], [ROOT]).units[0].part).toBe(
      null,
    );
  });

  it('nulls the scan placeholders — absence must not read as evidence', () => {
    const { units } = buildDetectionUnits(
      [
        row({
          title: UNKNOWN_BOOK_TITLE,
          author: UNKNOWN_AUTHOR,
          narrator: UNKNOWN_NARRATOR,
        }),
      ],
      [ROOT],
    );
    expect(units[0].album).toBeNull();
    expect(units[0].artist).toBeNull();
    expect(units[0].album_artist).toBeNull();
    expect(units[0].composer).toBeNull();
  });

  it('nulls blank and whitespace-only tags, and trims the rest', () => {
    const { units } = buildDetectionUnits(
      [row({ title: '  Spaced  ', grouping: '   ', series: '' })],
      [ROOT],
    );
    expect(units[0].album).toBe('Spaced');
    expect(units[0].grouping).toBeNull();
    expect(units[0].series).toBeNull();
  });

  it('keeps a folder-derived title in the album channel — measured, not assumed', () => {
    // The scan writes `metadata.album || <parent folder> || 'Unknown Book'`,
    // so a title equal to its own folder may be either. Suppressing that case
    // costs 19 -> 14 series on the corpus; keeping it costs one book. See the
    // comment at the assignment in detectionUnits.ts.
    const { units } = buildDetectionUnits(
      [row({ firstFilePath: `${ROOT}/Author/The Martian/01.m4b`, title: 'The Martian' })],
      [ROOT],
    );
    expect(units[0].album).toBe('The Martian');
  });

  it('never leaks fileFormat into a unit — it is measurement, not signal', () => {
    // `file_format` rides on DetectionBookRow so ticket 02's fourth fill rate
    // can be counted from the read that already happens. It is not a detection
    // signal and no cascade rule may ever see it. This is the structural pin
    // behind that claim: if someone maps it through, this fails rather than
    // silently changing what the folder and album rules cluster on.
    const { units } = buildDetectionUnits(
      [row({ fileFormat: 'MPEG-4' })],
      [ROOT],
    );
    expect(Object.values(units[0])).not.toContain('MPEG-4');
    expect(units[0]).not.toHaveProperty('fileFormat');
  });
});

describe('the corpus round trip', () => {
  // Rebuild database rows from the research units. This is the direction the
  // app runs in — DB row -> unit — so it exercises the assembly the shipped
  // path uses, against input whose correct output is already pinned by
  // seriesDetection.corpus.test.ts.
  const CORPUS_ROOT = '/sdcard/Audiobooks';
  const rows: DetectionBookRow[] = corpusUnits.map((u) => ({
    firstFilePath: `${CORPUS_ROOT}/${u.rel}/${u.file}`,
    title: u.album ?? null,
    // The DB has ONE author column. Collapsing the corpus's `artist` and
    // `album_artist` onto it is verified inert: they differ on 132 of the 298
    // units and every measure below is unchanged either way.
    author: u.artist ?? null,
    narrator: u.composer ?? null,
    series: u.series ?? null,
    part: u.part == null ? null : Number(u.part),
    grouping: u.grouping ?? null,
    // Not in the corpus and not a detection signal — see `DetectionBookRow`.
    fileFormat: null,
  }));

  const built = buildDetectionUnits(rows, [CORPUS_ROOT]);

  it('keeps every unit — none is keyless or outside the root', () => {
    expect(built.units).toHaveLength(corpusUnits.length);
    expect(built.outsideRoots).toBe(0);
    expect(built.keyless).toBe(0);
  });

  it('reproduces the corpus rel exactly', () => {
    expect(built.units.map((u) => u.rel)).toEqual(corpusUnits.map((u) => u.rel));
  });

  it('re-derives flat from the set, agreeing with the probe on every unit', () => {
    // The probe emitted two units for a directory whose two sampled files had
    // different albums; counting books per directory has to land in the same
    // place, or `flat` has become a different fact.
    expect(built.units.map((u) => u.flat)).toEqual(
      corpusUnits.map((u) => u.flat === true),
    );
  });

  it('detects §A3 conservative exactly: 19 series, 179 books placed', () => {
    const proposals = detectSeries(built.units, {});
    expect(proposals).toHaveLength(19);
    expect(proposals.reduce((n, s) => n + s.books.length, 0)).toBe(179);
  });

  it('detects §A3 full exactly: 28 series, 213 books placed', () => {
    const proposals = detectSeries(built.units, { alsoGroupByFolder: true });
    expect(proposals).toHaveLength(28);
    expect(proposals.reduce((n, s) => n + s.books.length, 0)).toBe(213);
  });

  it('still splits the two Discworld editions (A4) after assembly', () => {
    const names = detectSeries(built.units, {}).map((s) => s.name);
    expect(names).toContain('Discworld');
    expect(names).toContain('Discworld (2022)');
    const sizes = detectSeries(built.units, {})
      .filter((s) => s.name.startsWith('Discworld'))
      .map((s) => s.books.length)
      .sort((a, b) => b - a);
    expect(sizes).toEqual([41, 39]);
  });

  it('carries a bookKey back out of the cascade for every placed book', () => {
    const proposals = detectSeries(built.units, {});
    const keys = proposals.flatMap((s) => s.books.map((b) => b.unit.bookKey));
    expect(keys).toHaveLength(179);
    expect(keys.every((k) => k.startsWith(`${CORPUS_ROOT}/`))).toBe(true);
    expect(new Set(keys).size).toBe(179);
  });

  it('every proposal carries a why trail (A1)', () => {
    for (const series of detectSeries(built.units, {})) {
      for (const book of series.books) {
        expect(book.why.length).toBeGreaterThan(0);
      }
    }
  });
});
