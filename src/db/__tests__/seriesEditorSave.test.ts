import { planEditorSave } from '@/db/seriesEditorSave';
import type { EditorSavePlan } from '@/db/seriesEditorSave';

/** The shape a save carries when nothing about the name changed. */
function save(
  existing: {
    bookKey: string;
    position: number;
    canonicalNumber?: number | null;
    membership?: string | null;
  }[],
  desiredKeysInOrder: string[],
  canonicalNumbers: (number | null)[] = desiredKeysInOrder.map(() => null),
  names: { storedName?: string; desiredName?: string } = {},
): EditorSavePlan {
  return planEditorSave({
    existing,
    desiredKeysInOrder,
    canonicalNumbers,
    storedName: names.storedName ?? 'Discworld',
    desiredName: names.desiredName ?? names.storedName ?? 'Discworld',
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
   * position 1 cannot push the visible list into a gap. The stale position on
   * the excluded row is deliberate — it is a tombstone, not a place in the
   * order — and `seedInsertPositions` already reads excluded rows for their
   * position while refusing them as anchors.
   */
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
