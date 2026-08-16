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
