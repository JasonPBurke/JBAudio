import { detectSeries, type DetectionUnit } from '@/helpers/seriesDetection';

/** A unit with only the fields a test cares about; the rest default to empty. */
const unit = (u: Partial<DetectionUnit> & { rel: string }): DetectionUnit => ({
  file: '01.m4b',
  ...u,
});

const namesOf = (units: DetectionUnit[]) =>
  detectSeries(units)
    .map((s) => s.name)
    .sort();

describe('A1 · the precedence waterfall', () => {
  test('the extra.SERIES tag names a series and part gives the number', () => {
    const units = [
      unit({
        rel: 'Jim Butcher/Dresden Files/Storm Front',
        series: 'Dresden Files',
        part: '1',
      }),
      unit({
        rel: 'Jim Butcher/Dresden Files/Fool Moon',
        series: 'Dresden Files',
        part: '2',
      }),
    ];

    const proposals = detectSeries(units);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].name).toBe('Dresden Files');
    expect(proposals[0].books.map((b) => b.number)).toEqual(['1', '2']);
    expect(proposals[0].books[0].why).toContain('tag.extra.SERIES');
  });
});

describe('A1 · album patterns, when no machine tag is present', () => {
  test('`Series N - Title` yields the series, the number and a named why trail', () => {
    const units = [
      unit({
        rel: 'Brandon Sanderson/Mistborn',
        album: 'Mistborn 1 - The Final Empire',
      }),
      unit({
        rel: 'Brandon Sanderson/Mistborn2',
        album: 'Mistborn 2 - The Well of Ascension',
      }),
    ];

    const [proposal] = detectSeries(units);

    expect(proposal.name).toBe('Mistborn');
    expect(proposal.books.map((b) => b.number)).toEqual(['1', '2']);
    expect(proposal.books[0].why).toContain('alb.name-num-dash');
  });

  test('an `(Unabridged)` suffix does not defeat the pattern', () => {
    const units = [
      unit({ rel: 'A/1', album: 'Bobiverse 1 - We Are Legion (Unabridged)' }),
      unit({ rel: 'A/2', album: 'Bobiverse 2 - For We Are Many (Unabridged)' }),
    ];

    expect(namesOf(units)).toEqual(['Bobiverse']);
  });
});

describe('A1 · the album rule table', () => {
  /**
   * Every pair below is a REAL album pair from the research corpus, chosen so
   * the two books land in the same series. The rule id is asserted alongside
   * the result: a rule that starts matching by accident is a regression even
   * when the answer happens to stay right.
   */
  const cases: [string, string, string, string, [string, string]][] = [
    ['alb.hash-colon', 'The Dresden Files #12: Changes', 'The Dresden Files #14: Cold Days', 'The Dresden Files', ['12', '14']],
    ['alb.book-suffix', 'Shift: The Silo Saga, Book 2', 'Dust: The Silo Saga, Book 3', 'The Silo Saga', ['2', '3']],
    ['alb.book-dash-series', 'Book 01 - God Touched - Demon Accords Series', 'Book 02 - Demon Driven - Demon Accords Series', 'Demon Accords', ['1', '2']],
    ['alb.series-book-n', 'Lockwood and Co Book 1 - The Screaming Staircase', 'Lockwood and Co Book 2 - The Whispering Skull', 'Lockwood and Co', ['1', '2']],
    ['alb.name-num-dash', "Shadow 1 - Ender's Shadow", 'Shadow 3 - Shadow Puppets', 'Shadow', ['1', '3']],
    ['alb.name-num-sp', 'Crouch, B: 1 Pines', 'Crouch, B: 2 Wayward', 'Crouch, B', ['1', '2']],
    ['alb.roman', 'The Dark Tower I: The Gunslinger', 'The Dark Tower II: The Drawing Of The Three', 'The Dark Tower', ['1', '2']],
    ['alb.paren-pre', '(Long Earth 01) The Long Earth', '(Long Earth 02) The Long War', 'Long Earth', ['1', '2']],
  ];

  test.each(cases)('%s', (ruleId, albumA, albumB, expectedName, expectedNumbers) => {
    const units = [
      unit({ rel: 'Author/A', album: albumA }),
      unit({ rel: 'Author/B', album: albumB }),
    ];

    const [proposal] = detectSeries(units);

    expect(proposal.name).toBe(expectedName);
    expect(proposal.books.map((b) => b.number)).toEqual(expectedNumbers);
    expect(proposal.books[0].why).toContain(ruleId);
  });
});

describe('A7 · a parsed name must look like a series, or the cascade abstains', () => {
  test('a junk word is not a series name — real corpus case', () => {
    // "Volume 01 - The Demon Accords Compendium" parses as name "Volume".
    const units = [
      unit({ rel: 'John Conroe/Comp/1', album: 'Volume 01 - The Demon Accords Compendium' }),
      unit({ rel: 'John Conroe/Comp/2', album: 'Volume 02 - The Demon Accords Compendium' }),
    ];

    expect(detectSeries(units)).toEqual([]);
  });

  test('the author is not a series name', () => {
    const units = [
      unit({
        rel: 'A/1',
        album: 'Terry Pratchett 1 - The Colour of Magic',
        artist: 'Terry Pratchett',
      }),
      unit({
        rel: 'A/2',
        album: 'Terry Pratchett 2 - The Light Fantastic',
        artist: 'Terry Pratchett',
      }),
    ];

    expect(detectSeries(units)).toEqual([]);
  });

  test('a name of digits only is not a series name', () => {
    const units = [
      unit({ rel: 'A/1', album: '2001 1 - A Space Odyssey' }),
      unit({ rel: 'A/2', album: '2001 2 - Odyssey Two' }),
    ];

    expect(detectSeries(units)).toEqual([]);
  });
});

describe('A1 · precedence is a waterfall, not a vote', () => {
  test('extra.SERIES outranks a disagreeing album pattern', () => {
    const units = [
      unit({
        rel: 'A/1',
        series: 'The Expanse',
        album: 'Leviathan Wakes 1 - A Novel',
      }),
      unit({ rel: 'A/2', series: 'The Expanse', part: '2' }),
    ];

    expect(namesOf(units)).toEqual(['The Expanse']);
  });

  test('Grouping outranks a disagreeing album pattern', () => {
    const units = [
      unit({
        rel: 'A/1',
        grouping: 'Discworld',
        album: 'Guards Guards 1 - A Discworld Novel',
      }),
      unit({ rel: 'A/2', grouping: 'Discworld' }),
    ];

    expect(namesOf(units)).toEqual(['Discworld']);
  });

  test('Grouping carrying a number splits into name and number', () => {
    const units = [
      unit({ rel: 'A/1', grouping: 'Discworld, Book 13' }),
      unit({ rel: 'A/2', grouping: 'Discworld, Book 14' }),
    ];

    const [proposal] = detectSeries(units);
    expect(proposal.name).toBe('Discworld');
    expect(proposal.books.map((b) => b.number)).toEqual(['13', '14']);
    expect(proposal.books[0].why).toContain('tag.Grouping+num');
  });
});

describe('canonical numbers are normalised, not merely copied', () => {
  const numbersFor = (parts: string[]) => {
    const units = parts.map((part, i) =>
      unit({ rel: `Author/Series/d${i}`, series: 'Sequence', part }),
    );
    return detectSeries(units)[0].books.map((b) => b.number);
  };

  test('decoration and leading zeros are stripped; fractions and suffixes survive', () => {
    expect(numbersFor(['#03', 'Book 4', '007', '12.5', '14b', '1-3', 'IV'])).toEqual([
      '3',
      '4',
      '7',
      '12.5',
      '14b',
      '1-3',
      '4',
    ]);
  });

  test('a part that is not a number at all yields no number', () => {
    expect(numbersFor(['Prologue', '2'])).toEqual([null, '2']);
  });

  /**
   * `roman()` folds runs of `l` back to `i` because `lll` is a real-world typo
   * for III. The rule is about the CHARACTER, not about where it sits, so a
   * later run has to fold exactly like the first one. Asserted as an
   * equivalence rather than a literal value: the point is that the two
   * spellings are indistinguishable, not what the odd numeral evaluates to.
   */
  test('every run of l folds, not just the first', () => {
    const [typed] = numbersFor(['llxll', '2']);
    const [spelled] = numbersFor(['iixii', '2']);

    expect(typed).toBe(spelled);
  });

  /**
   * `normNumber` accepts a fraction only with its leading digit present. `.5`
   * is refused outright — it is not silently promoted to `0.5` — while `0.5`
   * survives intact. Pinned because the parsing branch that once claimed to
   * handle a bare leading dot could never run.
   */
  test('a fraction needs its leading digit; a bare dot is not a number', () => {
    expect(numbersFor(['0.5', '.5', '2'])).toEqual(['0.5', null, '2']);
  });
});

describe('A2 · folder evidence self-validates, always', () => {
  test('a folder whose own members corroborate it sweeps in the book that has no pattern', () => {
    const units = [
      unit({
        rel: 'Stephen King/The Dark Tower/Gunslinger',
        album: 'The Dark Tower I: The Gunslinger',
      }),
      unit({
        rel: 'Stephen King/The Dark Tower/Drawing',
        album: 'The Dark Tower II: The Drawing Of The Three',
      }),
      unit({
        rel: 'Stephen King/The Dark Tower/Waste Lands',
        album: 'The Waste Lands',
      }),
    ];

    const [proposal] = detectSeries(units);

    expect(proposal.name).toBe('The Dark Tower');
    expect(proposal.books).toHaveLength(3);
    const sweptIn = proposal.books.find((b) => b.unit.album === 'The Waste Lands');
    expect(sweptIn?.why).toEqual(['folder:name-corroborated(2/3)']);
  });
});

describe('A2 · folders corroborated by numbers rather than names', () => {
  test('albums that carry only a number let the folder supply the name', () => {
    const units = [
      unit({ rel: 'Joe Abercrombie/First Law World/01 - The First Law/a', album: '01 - The Blade Itself' }),
      unit({ rel: 'Joe Abercrombie/First Law World/01 - The First Law/b', album: '02 - Before They Are Hanged' }),
      unit({ rel: 'Joe Abercrombie/First Law World/01 - The First Law/c', album: '03 - Last Argument of Kings' }),
    ];

    const [proposal] = detectSeries(units);

    expect(proposal.name).toBe('The First Law');
    expect(proposal.books.map((b) => b.number)).toEqual(['1', '2', '3']);
    expect(proposal.books[0].why).toEqual(['folder:number-corroborated(3/3)']);
  });

  test('the deepest accepted folder wins, so a sub-series beats its parent', () => {
    const units = [
      unit({ rel: 'Joe Abercrombie/First Law World/01 - The First Law/a', album: '01 - The Blade Itself' }),
      unit({ rel: 'Joe Abercrombie/First Law World/01 - The First Law/b', album: '02 - Before They Are Hanged' }),
      unit({ rel: 'Joe Abercrombie/First Law World/01 - The First Law/c', album: '03 - Last Argument of Kings' }),
      unit({ rel: 'Joe Abercrombie/First Law World/02 - The Age of Madness/a', album: '01 - A Little Hatred' }),
      unit({ rel: 'Joe Abercrombie/First Law World/02 - The Age of Madness/b', album: '02 - The Trouble With Peace' }),
      unit({ rel: 'Joe Abercrombie/First Law World/02 - The Age of Madness/c', album: '03 - The Wisdom of Crowds' }),
    ];

    expect(namesOf(units)).toEqual(['The Age of Madness', 'The First Law']);
  });

  test('the author level is refused because its books name it as their author', () => {
    // Three books, so the uncorroborated-size gate would otherwise ACCEPT this
    // folder at full fidelity. What refuses it is the tags, not its depth.
    const units = [
      unit({ rel: 'Josiah Bancroft/Senlin Ascends', album: 'Senlin Ascends', artist: 'Josiah Bancroft' }),
      unit({ rel: 'Josiah Bancroft/Arm of the Sphinx', album: 'Arm of the Sphinx', artist: 'Josiah Bancroft' }),
      unit({ rel: 'Josiah Bancroft/The Hod King', album: 'The Hod King', artist: 'Josiah Bancroft' }),
    ];

    expect(detectSeries(units, { alsoGroupByFolder: true })).toEqual([]);
  });

  test('depth is not evidence: the same folder is judged the same at any depth', () => {
    // The accepted cost of having no depth rule. With no author tag there is
    // nothing to refuse this folder with, so full fidelity takes it — and that
    // is true at depth 1 and depth 2 ALIKE. Detection must not depend on where
    // the user happened to point their library root.
    const books = ['Senlin Ascends', 'Arm of the Sphinx', 'The Hod King'];
    const atDepth = (prefix: string) =>
      books.map((title) => unit({ rel: `${prefix}${title}`, album: title }));

    const shallow = detectSeries(atDepth('Josiah Bancroft/'), { alsoGroupByFolder: true });
    const deep = detectSeries(atDepth('Audiobooks/Josiah Bancroft/'), { alsoGroupByFolder: true });

    expect(shallow.map((p) => p.name)).toEqual(['Josiah Bancroft']);
    expect(deep.map((p) => p.name)).toEqual(shallow.map((p) => p.name));
    expect(deep[0].books.map((b) => b.why)).toEqual(shallow[0].books.map((b) => b.why));
    // Conservative fidelity refuses it either way — this only reaches the user
    // who has opted into folder grouping.
    expect(detectSeries(atDepth('Josiah Bancroft/'))).toEqual([]);
  });
});

describe('the book folder can supply a number the tags never carried', () => {
  test('a numbered book directory fills in the canonical number', () => {
    const units = [
      unit({ rel: 'Terry Pratchett/Bromeliad/01 - Truckers', grouping: 'Bromeliad' }),
      unit({ rel: 'Terry Pratchett/Bromeliad/02 - Diggers', grouping: 'Bromeliad' }),
      unit({ rel: 'Terry Pratchett/Bromeliad/03 - Wings', grouping: 'Bromeliad' }),
    ];

    const [proposal] = detectSeries(units);

    expect(proposal.books.map((b) => b.number)).toEqual(['1', '2', '3']);
    expect(proposal.books[0].why).toContain('num:folder');
  });

  test('`(11) Reaper Man` and `Book 3` shapes are both read', () => {
    const units = [
      unit({ rel: 'Terry Pratchett/Discworld/(11) Reaper Man', grouping: 'Discworld' }),
      unit({ rel: 'Terry Pratchett/Discworld/Book 3 - Equal Rites', grouping: 'Discworld' }),
    ];

    expect(detectSeries(units)[0].books.map((b) => b.number)).toEqual(['11', '3']);
  });

  test('a tag number is never overwritten by the folder', () => {
    const units = [
      unit({ rel: 'Terry Pratchett/Bromeliad/09 - Truckers', grouping: 'Bromeliad, Book 1' }),
      unit({ rel: 'Terry Pratchett/Bromeliad/08 - Diggers', grouping: 'Bromeliad, Book 2' }),
    ];

    const [proposal] = detectSeries(units);
    expect(proposal.books.map((b) => b.number)).toEqual(['1', '2']);
    expect(proposal.books[0].why).not.toContain('num:folder');
  });
});

describe('A3 · two fidelity levels', () => {
  /** A folder nothing in the tags agrees with: its members name other series. */
  const uncorroborated = [
    unit({ rel: 'Orson Scott Card/Enders Game/Shadow1', album: "Shadow 1 - Ender's Shadow" }),
    unit({ rel: 'Orson Scott Card/Enders Game/Shadow3', album: 'Shadow 3 - Shadow Puppets' }),
    unit({ rel: 'Orson Scott Card/Enders Game/Speaker', album: 'Speaker for the Dead' }),
    unit({ rel: 'Orson Scott Card/Enders Game/Xenocide', album: 'Xenocide' }),
  ];

  test('conservative refuses the folder and keeps only what the tags support', () => {
    const proposals = detectSeries(uncorroborated);

    expect(proposals.map((p) => p.name)).toEqual(['Shadow']);
    expect(proposals[0].books).toHaveLength(2);
  });

  test('full accepts the same folder, and says in the why trail that nothing agreed', () => {
    const proposals = detectSeries(uncorroborated, { alsoGroupByFolder: true });

    expect(proposals.map((p) => p.name).sort()).toEqual(['Enders Game', 'Shadow']);
    const folderGroup = proposals.find((p) => p.name === 'Enders Game');
    expect(folderGroup?.books).toHaveLength(2);
    expect(folderGroup?.books[0].why[0]).toMatch(/^folder:UNCORROBORATED\(4 books/);
  });
});

describe('the split-book guard', () => {
  /**
   * Real corpus case. One book delivered as two files, tagged `Warbreaker 1`
   * and `Warbreaker 2` — which reads exactly like a two-book series until the
   * album's `(1 of 2)` is taken into account.
   */
  const warbreaker = [
    unit({
      rel: 'Brandon Sanderson/Warbreaker',
      grouping: 'Warbreaker 1',
      album: 'Warbreaker: Tenth Anniversary Edition (1 of 2) [Dramatized Adaptation]',
    }),
    unit({
      rel: 'Brandon Sanderson/Warbreaker',
      grouping: 'Warbreaker 2',
      album: 'Warbreaker: Tenth Anniversary Edition (2 of 2) [Dramatized Adaptation]',
    }),
  ];

  test('a phantom two-book series is suppressed, at both fidelity levels', () => {
    expect(detectSeries(warbreaker)).toEqual([]);
    expect(detectSeries(warbreaker, { alsoGroupByFolder: true })).toEqual([]);
  });

  test('the same grouping shape IS a series when no part-of-N album backs it', () => {
    const discworld = [
      unit({ rel: 'Terry Pratchett/Discworld/Mort', grouping: 'Discworld 4', album: 'Mort' }),
      unit({ rel: 'Terry Pratchett/Discworld/Sourcery', grouping: 'Discworld 5', album: 'Sourcery' }),
    ];

    expect(namesOf(discworld)).toEqual(['Discworld']);
  });

  /**
   * The `Disc N` / `CD N` shape is the third spelling of the same delivery —
   * one book cut into discs — and must suppress exactly like `(1 of 2)`.
   */
  test('a disc-per-file delivery is suppressed like a part-of-N one', () => {
    const discs = [
      unit({
        rel: 'Brandon Sanderson/Warbreaker',
        grouping: 'Warbreaker 1',
        album: 'Warbreaker - Disc 1',
      }),
      unit({
        rel: 'Brandon Sanderson/Warbreaker',
        grouping: 'Warbreaker 2',
        album: 'Warbreaker - Disc 2',
      }),
    ];

    expect(detectSeries(discs)).toEqual([]);
  });

  test('a CD suffix suppresses on the same rule', () => {
    const cds = [
      unit({ rel: 'A/Warbreaker', grouping: 'Warbreaker 1', album: 'Warbreaker CD 1' }),
      unit({ rel: 'A/Warbreaker', grouping: 'Warbreaker 2', album: 'Warbreaker CD 2' }),
    ];

    expect(detectSeries(cds)).toEqual([]);
  });

  /**
   * The equality half of the guard, for the disc shape: a genuine series whose
   * files happen to carry a disc suffix keeps its numbers, because the disc
   * number is not the series number. Without this the fix would over-suppress.
   */
  test('a disc suffix does NOT suppress when it disagrees with the series number', () => {
    const discworld = [
      unit({
        rel: 'Terry Pratchett/Discworld/Mort',
        grouping: 'Discworld 4',
        album: 'Mort - Disc 1',
      }),
      unit({
        rel: 'Terry Pratchett/Discworld/Sourcery',
        grouping: 'Discworld 5',
        album: 'Sourcery - Disc 1',
      }),
    ];

    expect(namesOf(discworld)).toEqual(['Discworld']);
  });
});

describe('A8 · the display name is elected separately from the grouping', () => {
  test('punctuation and articles do not split a group', () => {
    const units = [
      unit({ rel: 'Tad Williams/A', grouping: 'Memory, Sorrow & Thorn' }),
      unit({ rel: 'Tad Williams/B', grouping: 'Memory — Sorrow & Thorn!' }),
      unit({ rel: 'Tad Williams/C', grouping: 'The Memory Sorrow Thorn Series' }),
    ];

    expect(detectSeries(units)).toHaveLength(1);
  });

  test('a folder name loses its `series by <author>` tail — real corpus case', () => {
    const units = [
      unit({ rel: 'Tad Williams/Memory, Sorrow & Thorn series by Tad Williams/a', album: '01 The Dragonbone Chair' }),
      unit({ rel: 'Tad Williams/Memory, Sorrow & Thorn series by Tad Williams/b', album: '02 The Stone of Farewell' }),
      unit({ rel: 'Tad Williams/Memory, Sorrow & Thorn series by Tad Williams/c', album: '03 To Green Angel Tower' }),
    ];

    expect(detectSeries(units)[0].name).toBe('Memory, Sorrow & Thorn');
  });

  test('an author prefix is stripped when a member names that author — real corpus case', () => {
    const units = [
      unit({
        rel: 'Martha Wells/A',
        album: 'Martha Wells - The Murderbot Diaries 06 - Fugitive Telemetry',
        artist: 'Martha Wells',
      }),
      unit({
        rel: 'Martha Wells/B',
        album: 'Martha Wells - The Murderbot Diaries 07 - System Collapse',
        artist: 'Martha Wells',
      }),
    ];

    expect(detectSeries(units)[0].name).toBe('The Murderbot Diaries');
  });

  test('an abbreviation loses to a longer candidate with the same votes', () => {
    // Both candidates normalise to the key `tmc`, so votes tie; the tie-break
    // must reject the abbreviation rather than take the shorter string.
    const units = [
      unit({ rel: 'Robin Hobb/TMC Saga/Ship of Magic', album: 'TMC 1 - Ship of Magic' }),
      unit({ rel: 'Robin Hobb/TMC Saga/The Mad Ship', album: 'TMC 2 - The Mad Ship' }),
    ];

    expect(detectSeries(units)[0].name).toBe('TMC Saga');
  });
});

describe('A4 · the number-collision check keeps editions apart', () => {
  const twoEditions = [
    unit({ rel: 'Terry Pratchett/Discworld/Mort', album: 'Discworld 4 - Mort' }),
    unit({ rel: 'Terry Pratchett/Discworld/Sourcery', album: 'Discworld 5 - Sourcery' }),
    unit({ rel: 'Terry Pratchett/Discworld (2022)/Mort', album: 'Discworld 4 - Mort' }),
    unit({ rel: 'Terry Pratchett/Discworld (2022)/Sourcery', album: 'Discworld 5 - Sourcery' }),
  ];

  test('a merge with duplicate numbers splits on its folders, named raw', () => {
    const proposals = detectSeries(twoEditions);

    expect(proposals.map((p) => p.name).sort()).toEqual(['Discworld', 'Discworld (2022)']);
    expect(proposals.every((p) => p.books.length === 2)).toBe(true);
    expect(proposals[0].books[0].why.join(' ')).toMatch(/split:number-collision\(50% dupes/);
  });

  test('it declines when duplication is below the threshold', () => {
    const mostlyUnique = [
      ...twoEditions.slice(0, 2),
      unit({ rel: 'Terry Pratchett/Discworld (2022)/Mort', album: 'Discworld 4 - Mort' }),
      unit({ rel: 'Terry Pratchett/Discworld (2022)/Guards', album: 'Discworld 8 - Guards Guards' }),
      unit({ rel: 'Terry Pratchett/Discworld (2022)/Eric', album: 'Discworld 9 - Eric' }),
    ];
    // 5 numbered, one duplicate -> 20%, under the 25% gate.
    expect(namesOf(mostlyUnique)).toEqual(['Discworld']);
  });

  test('it declines when the folder partition would be degenerate', () => {
    // Plenty of duplicate numbers, but one book per folder: splitting on that
    // gives singletons, not two editions.
    const oneBookPerFolder = [
      unit({ rel: 'Terry Pratchett/Discworld/a', album: 'Discworld 4 - Mort' }),
      unit({ rel: 'Terry Pratchett/Discworld/b', album: 'Discworld 4 - Mort' }),
      unit({ rel: 'Terry Pratchett/Discworld/c', album: 'Discworld 5 - Sourcery' }),
      unit({ rel: 'Terry Pratchett/Discworld/d', album: 'Discworld 5 - Sourcery' }),
    ];

    expect(namesOf(oneBookPerFolder)).toEqual(['Discworld']);
  });
});

describe('A15 · identity is `name` alone, so collisions disambiguate', () => {
  /** Four books under one parent, numbered 1,2,1,2 — forces a folder split. */
  const collidingEditions = (parent: string, left: string, right: string, tag: string) => [
    unit({ rel: `${parent}/${left}/a`, grouping: `${tag}, Book 1` }),
    unit({ rel: `${parent}/${left}/b`, grouping: `${tag}, Book 2` }),
    unit({ rel: `${parent}/${right}/a`, grouping: `${tag}, Book 1` }),
    unit({ rel: `${parent}/${right}/b`, grouping: `${tag}, Book 2` }),
  ];

  test('two series that would land on one name take the parent folder as a suffix', () => {
    const units = [
      ...collidingEditions('Pratchett', 'Omnibus', 'Special', 'Alpha'),
      ...collidingEditions('Gemmell', 'Omnibus', 'Deluxe', 'Beta'),
    ];

    expect(namesOf(units)).toEqual([
      'Deluxe',
      'Omnibus (Gemmell)',
      'Omnibus (Pratchett)',
      'Special',
    ]);
  });

  test('when the parent folder does not disambiguate either, a counter does', () => {
    const units = [
      ...collidingEditions('Shared', 'Omnibus', 'Special', 'Alpha'),
      ...collidingEditions('Shared', 'Omnibus', 'Deluxe', 'Beta'),
    ];

    const names = namesOf(units);
    expect(names).toContain('Omnibus');
    expect(names).toContain('Omnibus (2)');
  });

  test('disambiguation never merges the groups and never drops a book', () => {
    const units = [
      ...collidingEditions('Pratchett', 'Omnibus', 'Special', 'Alpha'),
      ...collidingEditions('Gemmell', 'Omnibus', 'Deluxe', 'Beta'),
    ];

    const proposals = detectSeries(units);
    expect(proposals).toHaveLength(4);
    expect(proposals.flatMap((p) => p.books)).toHaveLength(8);
    expect(new Set(proposals.map((p) => p.name)).size).toBe(4);
  });
});

describe('A16 · the confidence tier describes the algorithm and is never stored', () => {
  const tierFor = (u: DetectionUnit[]) => detectSeries(u)[0].books[0].confidence;

  test('a machine tag corroborated by its folder is `certain`', () => {
    expect(
      tierFor([
        unit({ rel: 'Jim Butcher/Dresden Files/a', series: 'Dresden Files', part: '1' }),
        unit({ rel: 'Jim Butcher/Dresden Files/b', series: 'Dresden Files', part: '2' }),
      ]),
    ).toBe('certain');
  });

  test('an album pattern standing alone is `likely`', () => {
    expect(
      tierFor([
        unit({ rel: 'A/1', album: 'Mistborn 1 - The Final Empire' }),
        unit({ rel: 'B/2', album: 'Mistborn 2 - The Well of Ascension' }),
      ]),
    ).toBe('likely');
  });

  test('a name-corroborated folder is only `possible`', () => {
    const proposal = detectSeries([
      unit({ rel: 'Stephen King/The Dark Tower/a', album: 'The Dark Tower I: The Gunslinger' }),
      unit({ rel: 'Stephen King/The Dark Tower/b', album: 'The Dark Tower II: The Drawing Of The Three' }),
      unit({ rel: 'Stephen King/The Dark Tower/c', album: 'The Waste Lands' }),
    ])[0];

    const sweptIn = proposal.books.find((b) => b.unit.album === 'The Waste Lands');
    expect(sweptIn?.confidence).toBe('possible');
  });

  test('a folder trusted only on numbers is a `guess`', () => {
    expect(
      tierFor([
        unit({ rel: 'Joe Abercrombie/First Law World/The First Law/a', album: '01 - The Blade Itself' }),
        unit({ rel: 'Joe Abercrombie/First Law World/The First Law/b', album: '02 - Before They Are Hanged' }),
        unit({ rel: 'Joe Abercrombie/First Law World/The First Law/c', album: '03 - Last Argument of Kings' }),
      ]),
    ).toBe('guess');
  });
});

describe('A5 · no one-book series', () => {
  test('a lone tagged book proposes nothing — a second book creates the series', () => {
    const solo = unit({
      rel: 'Andy Weir/Project Hail Mary',
      series: 'Hail Mary',
      part: '1',
    });

    expect(detectSeries([solo])).toEqual([]);

    const later = unit({
      rel: 'Andy Weir/Hail Mary 2',
      series: 'Hail Mary',
      part: '2',
    });
    expect(namesOf([solo, later])).toEqual(['Hail Mary']);
  });
});
