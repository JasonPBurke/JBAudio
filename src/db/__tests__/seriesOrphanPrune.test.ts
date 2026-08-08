import {
  selectOrphanedMemberships,
  selectEmptySeriesIds,
} from '@/db/seriesOrphanPrune';

describe('selectOrphanedMemberships', () => {
  test('destroys rows whose structural key no longer backs a live book', () => {
    const rows = [
      { bookKey: '/Audiobooks/A/01.mp3' },
      { bookKey: '/Audiobooks/B/01.mp3' },
    ];
    const liveKeys = new Set(['/Audiobooks/A/01.mp3']);

    expect(selectOrphanedMemberships(rows, liveKeys)).toEqual([
      { bookKey: '/Audiobooks/B/01.mp3' },
    ]);
  });

  test('a moved book orphans: the old path is dead even though the new one is live', () => {
    const rows = [{ bookKey: '/Audiobooks/Old Name/01.mp3' }];
    const liveKeys = new Set(['/Audiobooks/New Name/01.mp3']);

    expect(selectOrphanedMemberships(rows, liveKeys)).toEqual(rows);
  });

  // ADR 0001, ruling 3: option A (a provenance-aware prune that spares 'user'
  // and 'excluded' rows) was considered and REJECTED. If this fails, someone
  // has quietly implemented A.
  test('provenance is deliberately ignored — user and excluded dead rows are destroyed too', () => {
    const rows = [
      { bookKey: '/dead/user.mp3', membership: 'user' },
      { bookKey: '/dead/excluded.mp3', membership: 'excluded' },
      { bookKey: '/dead/detected.mp3', membership: 'detected' },
      { bookKey: '/dead/unwritten.mp3', membership: null },
      { bookKey: '/live/keep.mp3', membership: 'user' },
    ];
    const liveKeys = new Set(['/live/keep.mp3']);

    expect(
      selectOrphanedMemberships(rows, liveKeys).map((r) => r.bookKey),
    ).toEqual([
      '/dead/user.mp3',
      '/dead/excluded.mp3',
      '/dead/detected.mp3',
      '/dead/unwritten.mp3',
    ]);
  });

  test('no live keys at all orphans every row', () => {
    const rows = [{ bookKey: '/a.mp3' }, { bookKey: '/b.mp3' }];
    expect(selectOrphanedMemberships(rows, new Set())).toEqual(rows);
  });

  test('nothing to destroy when every key is live', () => {
    const rows = [{ bookKey: '/a.mp3' }, { bookKey: '/b.mp3' }];
    const liveKeys = new Set(['/a.mp3', '/b.mp3', '/unrelated.mp3']);
    expect(selectOrphanedMemberships(rows, liveKeys)).toEqual([]);
  });
});

describe('selectEmptySeriesIds', () => {
  // ADR 0001, ruling 1: a hand-made series does not outlive its last member.
  test('a series whose every member was destroyed is empty', () => {
    const surviving = [{ seriesId: 's1' }];
    expect(selectEmptySeriesIds(['s1', 's2'], surviving)).toEqual(['s2']);
  });

  test('one surviving member keeps a series alive', () => {
    const surviving = [{ seriesId: 's1' }, { seriesId: 's1' }];
    expect(selectEmptySeriesIds(['s1'], surviving)).toEqual([]);
  });

  test('a series that never had a member is empty', () => {
    expect(selectEmptySeriesIds(['s1'], [])).toEqual(['s1']);
  });
});
