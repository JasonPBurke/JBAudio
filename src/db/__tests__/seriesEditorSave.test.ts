import { planEditorSave } from '@/db/seriesEditorSave';
import type { EditorSavePlan } from '@/db/seriesEditorSave';

/**
 * The shape a save carries when nothing about the name changed.
 *
 * `visibleKeys` defaults to every row the editor COULD have drawn — i.e. every
 * non-tombstoned row — which is what the screen sees when the whole library
 * resolves. A test that wants a DANGLING row (one whose file has moved, so
 * `assembleDerivedSeries` skipped it) says so by passing a shorter set.
 */
function save(
  existing: {
    bookKey: string;
    position: number;
    canonicalNumber?: number | null;
    membership?: string | null;
  }[],
  desiredKeysInOrder: string[],
  canonicalNumbers: (number | null)[] = desiredKeysInOrder.map(() => null),
  opts: {
    storedName?: string;
    desiredName?: string;
    visibleKeys?: string[];
  } = {},
): EditorSavePlan {
  return planEditorSave({
    existing,
    desiredKeysInOrder,
    canonicalNumbers,
    visibleKeys:
      opts.visibleKeys ??
      existing.filter((r) => r.membership !== 'excluded').map((r) => r.bookKey),
    storedName: opts.storedName ?? 'Discworld',
    desiredName: opts.desiredName ?? opts.storedName ?? 'Discworld',
  });
}

/** Kept as one call site in case the plan's shape grows a wrapper again. */
function rowsOf(plan: EditorSavePlan) {
  return plan;
}

describe('A11 — a removed book leaves a tombstone', () => {
  test('removing a book updates its row to excluded and destroys nothing', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'detected' },
        ],
        ['a'],
      ),
    );

    expect(plan.updateRows).toContainEqual(
      expect.objectContaining({ bookKey: 'b', membership: 'excluded' }),
    );
    // The whole point: there is no verb here that removes a row.
    expect(plan.insertRows).toEqual([]);
    expect(Object.keys(plan)).not.toContain('removeRows');
  });

  test('a book that was already removed is left alone', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'excluded' },
        ],
        ['a'],
      ),
    );

    expect(plan.updateRows).toEqual([]);
  });

  test('re-adding a removed book clears its tombstone', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'excluded' },
        ],
        ['a', 'b'],
      ),
    );

    expect(plan.updateRows).toContainEqual(
      expect.objectContaining({ bookKey: 'b', membership: 'user' }),
    );
  });

  /*
   * The one a diff-driven implementation gets wrong. Nothing about this row's
   * POSITION changed, so the membership diff proposes nothing for it — and the
   * book the user just put back would stay invisible until they also dragged
   * it somewhere.
   */
  test('re-adding a removed book clears its tombstone even when its position is unchanged', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'excluded' },
        ],
        ['a', 'b'],
      ),
    );

    expect(plan.updateRows).toEqual([{ bookKey: 'b', membership: 'user' }]);
  });
});

/*
 * ⚠ THE RULE: YOU MAY ONLY REMOVE WHAT YOU COULD SEE.
 *
 * A membership row whose `bookKey` does not resolve against the live library
 * is a DANGLING row, and `scanLibrary` documents that state as deliberate — its
 * prune is gated on `orphanedBooks.length > 0`, so a row whose file has merely
 * moved legitimately sits there until a scan finds an orphan. Meanwhile
 * `assembleDerivedSeries` skips it, so the editor never draws it and it can
 * never be in the desired list.
 *
 * Inferring "removed" from `existing - desired` therefore tombstones it, and
 * `seriesReconcile` builds `settledKeys` from tombstones too — so detection
 * never puts it back. One Save while a file was moving used to delete a book
 * from its series FOREVER, silently. Hence the third input: the planner is told
 * what the screen could see, and leaves everything else alone.
 */
describe('a save may only remove what the editor could see', () => {
  test('a row that never reached the screen is left completely alone', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          // Its file moved. The row is fine; the book just cannot be resolved,
          // so `series.books` skipped it and the editor drew a two-row list.
          { bookKey: 'moved', position: 1, canonicalNumber: 2, membership: 'detected' },
          { bookKey: 'b', position: 2, membership: 'detected' },
        ],
        ['a', 'b'],
        [null, null],
        { visibleKeys: ['a', 'b'] },
      ),
    );

    expect(plan.updateRows.map((r) => r.bookKey)).not.toContain('moved');
    expect(plan.insertRows).toEqual([]);
  });

  /* A11 must not regress: a book the user could see and dropped IS removed. */
  test('a row the editor drew and the user dropped is still tombstoned', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'detected' },
        ],
        ['a'],
        [null],
        { visibleKeys: ['a', 'b'] },
      ),
    );

    expect(plan.updateRows).toContainEqual(
      expect.objectContaining({ bookKey: 'b', membership: 'excluded' }),
    );
  });
});

/*
 * ⚠ RULED ON DEVICE, 2026-08-13. This plan has NO DESTRUCTIVE VERB AT ALL —
 * not for a row, and not for the series. An emptying save used to return
 * `verb: 'delete'` and `updateSeries` deleted and suppressed; that made `Save`
 * an unconfirmed destroy, and the editor's validation now refuses it outright
 * (`seriesEditorIssues`). Deleting a series is `Delete Series`, which confirms.
 *
 * So an empty list is no longer expected to arrive here. If it ever does — a
 * caller bypassing validation — the answer is K16's all-excluded state: every
 * row tombstoned, the series still standing, visible and empty, with the
 * confirmed escape hatch one tap away. K16 rules that state stable precisely
 * so that nothing has to infer a destroy from it.
 */
describe('there is no verb here that destroys anything', () => {
  test('an empty list tombstones every row and keeps the series', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'user' },
        ],
        [],
      ),
    );

    expect(plan.updateRows).toEqual([
      { bookKey: 'a', membership: 'excluded' },
      { bookKey: 'b', membership: 'excluded' },
    ]);
    expect(plan.insertRows).toEqual([]);
  });
});

describe('ownership is per aspect', () => {
  test('a rename claims the name', () => {
    const plan = rowsOf(
      save([{ bookKey: 'a', position: 0 }], ['a'], [null], {
        storedName: 'Discworld',
        desiredName: 'Discworld (2022)',
      }),
    );

    expect(plan.nameSource).toBe('user');
  });

  test('trimming alone is not a rename', () => {
    const plan = rowsOf(
      save([{ bookKey: 'a', position: 0 }], ['a'], [null], {
        storedName: 'Discworld',
        desiredName: '  Discworld ',
      }),
    );

    expect(plan.nameSource).toBeUndefined();
  });

  /* Reordering must not disown the name. */
  test('a reorder leaves the name alone', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0 },
          { bookKey: 'b', position: 1 },
        ],
        ['b', 'a'],
      ),
    );

    expect(plan.nameSource).toBeUndefined();
    expect(plan.updateRows.length).toBe(2);
  });

  /*
   * And renaming must not cost automatic membership: there is no verb here
   * that could touch `origin`, so a renamed DETECTED series keeps gaining new
   * books. This asserts the absence, which is the whole of A10a's second pass
   * staying reachable.
   */
  test('nothing a save writes can change a series origin', () => {
    const plan = rowsOf(
      save([{ bookKey: 'a', position: 0 }], ['a'], [null], {
        storedName: 'Discworld',
        desiredName: 'Sam Vimes books',
      }),
    );

    expect(Object.keys(plan)).not.toContain('origin');
  });
});

describe('the rows a save writes', () => {
  test('a hand-added book is inserted as the user`s own membership', () => {
    const plan = rowsOf(
      save(
        [{ bookKey: 'a', position: 0, membership: 'detected' }],
        ['a', 'b'],
        [null, 2],
      ),
    );

    expect(plan.insertRows).toEqual([
      {
        bookKey: 'b',
        position: 1,
        canonicalNumber: 2,
        canonicalSource: 'user',
        membership: 'user',
      },
    ]);
  });

  test('an unnumbered insert claims no canonical source', () => {
    const plan = rowsOf(save([], ['a'], [null]));
    expect(plan.insertRows[0]).toMatchObject({
      canonicalNumber: null,
      canonicalSource: null,
    });
  });

  test('a dragged book changes its position and nothing else', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'detected' },
        ],
        ['b', 'a'],
      ),
    );

    expect(plan.updateRows).toEqual([
      { bookKey: 'a', position: 1 },
      { bookKey: 'b', position: 0 },
    ]);
  });

  test('a retyped number carries its provenance, and an unchanged one writes nothing', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, canonicalNumber: 1 },
          { bookKey: 'b', position: 1, canonicalNumber: 2 },
        ],
        ['a', 'b'],
        [1, 2.5],
      ),
    );

    expect(plan.updateRows).toEqual([
      { bookKey: 'b', canonicalNumber: 2.5, canonicalSource: 'user' },
    ]);
  });

  test('clearing a number clears its provenance with it', () => {
    const plan = rowsOf(
      save([{ bookKey: 'a', position: 0, canonicalNumber: 4 }], ['a'], [null]),
    );

    expect(plan.updateRows).toEqual([
      { bookKey: 'a', canonicalNumber: null, canonicalSource: null },
    ]);
  });

  /*
   * ⚠ THE INVARIANT `updateSeries` ALREADY CARRIES, moved in front of jest.
   * `Model.prepareUpdate` throws on a second call before the batch, so a row
   * that was dragged AND renumbered in one session must arrive as ONE entry —
   * and that is the single most likely editor session this feature has.
   */
  test('a row that moved AND was renumbered AND was restored arrives once', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          {
            bookKey: 'b',
            position: 1,
            canonicalNumber: 2,
            membership: 'excluded',
          },
        ],
        ['b', 'a'],
        [7, null],
      ),
    );

    expect(plan.updateRows.filter((r) => r.bookKey === 'b')).toEqual([
      {
        bookKey: 'b',
        position: 0,
        canonicalNumber: 7,
        canonicalSource: 'user',
        membership: 'user',
      },
    ]);
  });

  /*
   * Positions are the DESIRED list's own indices, so a tombstone left behind at
   * position 1 cannot push the visible list into a gap. The two spaces overlap
   * on purpose — a tombstone's position is an index INTO the visible list, not
   * a place in it — and `seedInsertPositions` already reads excluded rows for
   * their position while refusing them as anchors.
   */
  /*
   * ⚠ A TOMBSTONE'S POSITION MEANS "index into the CURRENT visible list where
   * I belong" — and the visible list is compacted to `0..n-1` on every save, so
   * that meaning has to be maintained or it decays.
   *
   * The first removal is self-correcting and hid this for a whole ticket: D at
   * 3 still had exactly three visible rows in front of it. The SECOND removal
   * is what breaks it — B leaves, A,C,E compact to 0,1,2, and D's stale 3 now
   * counts all three of them as predecessors instead of two. `planSeriesJoin`
   * reads that count to place a restored book, so the book is appended rather
   * than put back: the exact 1,2,3,5,4 defect the ticket-17 device fix was
   * written to kill, reopened by a second tombstone.
   */
  test('a tombstone comes down a slot when a row in front of it is removed', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'detected' },
          { bookKey: 'c', position: 2, membership: 'detected' },
          { bookKey: 'e', position: 3, membership: 'detected' },
          // Removed by the previous save; its position is already a slot.
          { bookKey: 'd', position: 3, membership: 'excluded' },
        ],
        ['a', 'c', 'e'],
      ),
    );

    expect(plan.updateRows).toContainEqual({ bookKey: 'd', position: 2 });
  });

  /*
   * ⚠ THE SECOND CLAUSE, and it exists to protect a case that works TODAY.
   *
   * Two books removed in the SAME save both genuinely belong at the same index
   * — with `a,b,c,d` losing `b` and `c`, the visible list is `a,d` and both
   * tombstones point between them. The slot cannot separate them, so writing it
   * over both would throw away the only thing that still can: their existing
   * positions. A contested slot therefore moves nobody.
   */
  test('two rows removed at once keep their order rather than collapsing onto one slot', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'detected' },
          { bookKey: 'c', position: 2, membership: 'detected' },
          { bookKey: 'd', position: 3, membership: 'detected' },
        ],
        ['a', 'd'],
      ),
    );

    const moved = plan.updateRows.filter(
      (r) => (r.bookKey === 'b' || r.bookKey === 'c') && 'position' in r,
    );
    expect(moved).toEqual([]);
  });

  /* A tombstone BEHIND the removal is unaffected — nothing moved in front. */
  test('a tombstone the removal happened behind keeps its slot', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'gone', position: 1, membership: 'excluded' },
          { bookKey: 'b', position: 1, membership: 'detected' },
          { bookKey: 'c', position: 2, membership: 'detected' },
        ],
        ['a', 'b'],
      ),
    );

    expect(plan.updateRows.map((r) => r.bookKey)).not.toContain('gone');
  });

  test('a tombstone does not consume a position in the visible order', () => {
    const plan = rowsOf(
      save(
        [
          { bookKey: 'a', position: 0, membership: 'detected' },
          { bookKey: 'b', position: 1, membership: 'detected' },
          { bookKey: 'c', position: 2, membership: 'detected' },
        ],
        ['a', 'c'],
      ),
    );

    expect(plan.updateRows).toEqual([
      { bookKey: 'b', membership: 'excluded' },
      { bookKey: 'c', position: 1 },
    ]);
  });
});
