import {
  groupRemovedSeries,
  suppressionsMatching,
} from '@/db/seriesSuppression';

const row = (id: string, name: string) => ({ id, name });

describe('suppressionsMatching', () => {
  it('returns nothing when the name was never suppressed', () => {
    expect(suppressionsMatching('Discworld', [row('a', 'Dresden Files')])).toEqual(
      [],
    );
  });

  it('returns the row whose name is the same series', () => {
    const rows = [row('a', 'Dresden Files'), row('b', 'Discworld')];
    expect(suppressionsMatching('Discworld', rows)).toEqual([rows[1]]);
  });

  // G7 — no unique constraint anywhere in this DB library, so two rows for one
  // name are a real state. Clearing only the first would leave the veto up.
  it('returns EVERY row for the name, not just the first', () => {
    const rows = [
      row('a', 'Discworld'),
      row('b', 'Dresden Files'),
      row('c', 'Discworld'),
    ];
    expect(suppressionsMatching('Discworld', rows)).toEqual([rows[0], rows[2]]);
  });

  // A15 — identity is the name under the app's one comparison key, the same
  // one `identity_key` and `isDuplicateSeriesName` use.
  it('matches case-insensitively and ignores surrounding space', () => {
    const rows = [row('a', 'Discworld')];
    expect(suppressionsMatching('  discworld ', rows)).toEqual([rows[0]]);
  });

  it('matches a stored name that carries its own surrounding space', () => {
    const rows = [row('a', ' Discworld ')];
    expect(suppressionsMatching('Discworld', rows)).toEqual([rows[0]]);
  });

  it('does not match a name that merely starts the same way', () => {
    expect(suppressionsMatching('Discworld', [row('a', 'Discworld (2022)')])).toEqual(
      [],
    );
  });
});

describe('groupRemovedSeries', () => {
  it('has no entries when nothing is suppressed', () => {
    expect(groupRemovedSeries([])).toEqual([]);
  });

  it('makes one entry per suppressed name, carrying its row', () => {
    expect(groupRemovedSeries([row('a', 'Discworld')])).toEqual([
      { name: 'Discworld', rowIds: ['a'] },
    ]);
  });

  // G7's read half: the count on the card and the length of this list are the
  // same number, and a double-delete must not make it say two.
  it('collapses duplicate rows into one entry holding every row id', () => {
    expect(
      groupRemovedSeries([
        row('a', 'Discworld'),
        row('b', 'Discworld'),
      ]),
    ).toEqual([{ name: 'Discworld', rowIds: ['a', 'b'] }]);
  });

  it('collapses rows that differ only in case or surrounding space', () => {
    expect(
      groupRemovedSeries([row('a', 'Discworld'), row('b', ' discworld ')]),
    ).toEqual([{ name: 'Discworld', rowIds: ['a', 'b'] }]);
  });

  // The list shows the user a name, so it must show a stored spelling — never
  // the lower-cased comparison key.
  it('displays the first stored spelling, not the comparison key', () => {
    expect(groupRemovedSeries([row('a', 'The Dark Tower')])[0].name).toBe(
      'The Dark Tower',
    );
  });

  it('keeps genuinely different names apart', () => {
    expect(
      groupRemovedSeries([
        row('a', 'Discworld'),
        row('b', 'Discworld (2022)'),
      ]).map((e) => e.name),
    ).toEqual(['Discworld', 'Discworld (2022)']);
  });

  /*
   * ⚠ THE REMOVED LIST MUST FILE THE WAY THE BROWSE LIST FILES — ticket 32.
   *
   * This grouping is keyed by the identity key (A15), which keeps the leading
   * article, and it used to SORT on that key too. Once the browse list moved to
   * `compareSeriesNames`, that left `The Dresden Files` under D on one screen
   * and under T on the other. Two orderings of the same concept is the drift
   * ADR 0001 warns about, so this reads `compareSeriesNames` as well.
   *
   * ⚠ Grouping still uses the identity key and MUST — `The Dresden Files` and
   * `Dresden Files` are different series and may not collapse into one entry.
   * Same rule as everywhere: order ignores the article, identity does not.
   */
  it('files a removed series under its first significant word', () => {
    expect(
      groupRemovedSeries([
        row('a', 'Threshold'),
        row('b', 'The Dresden Files'),
        row('c', 'Silo'),
      ]).map((e) => e.name),
    ).toEqual(['The Dresden Files', 'Silo', 'Threshold']);
  });

  it('still keeps a name and its article-prefixed twin as separate entries', () => {
    expect(
      groupRemovedSeries([
        row('a', 'The Dresden Files'),
        row('b', 'Dresden Files'),
      ]).map((e) => e.rowIds),
    ).toEqual([['a'], ['b']]);
  });

  it('sorts alphabetically, ignoring case, whatever order the rows arrive in', () => {
    expect(
      groupRemovedSeries([
        row('a', 'the Wheel of Time'),
        row('b', 'Discworld'),
        row('c', 'Mistborn'),
      ]).map((e) => e.name),
    ).toEqual(['Discworld', 'Mistborn', 'the Wheel of Time']);
  });
});
