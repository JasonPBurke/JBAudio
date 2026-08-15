import { Q } from '@nozbe/watermelondb';

import { FakeDatabase } from './support/fakeDatabase';

/**
 * The fake's own suite.
 *
 * ⚠ IT LIVES HERE RATHER THAN IN A CONSUMER ON PURPOSE. This guard used to sit
 * in `addBookToSeries.test.ts`, which was fine while one suite used the fake
 * and wrong the moment a second did: deleting that file would have taken the
 * harness's only defence with it, silently. The repo already rules on this —
 * `src/prototypes/__tests__/harnessBoundary.test.ts` keeps its rule inside the
 * directory it governs so the rule and its subject are removed together.
 */

/*
 * `matchesClauses` reads WatermelonDB's clause objects directly, which is a
 * dependency on a shape the library owns. It THROWS on anything it does not
 * recognise, so a renamed `type` or `operator` fails loudly — but a renamed
 * `left` or `right` would just filter everything out, and EVERY window test
 * built on the fake would go green while asserting nothing. That is the failure
 * this exists to catch, stated against the real `Q`.
 */
test('the fake reads the clause shape `Q.where` actually produces', () => {
  expect(Q.where('series_id', 's1')).toEqual({
    type: 'where',
    left: 'series_id',
    comparison: { operator: 'eq', right: { value: 's1' } },
  });
});

/*
 * The two `batch` guards are transcribed from `Database:83` and `Database:93-95`.
 * They are the fake's whole value over a plain object: without them a write
 * that crashes on a device passes here.
 */
test('batch refuses to run outside a writer', async () => {
  const db = new FakeDatabase();
  await expect(db.batch([])).rejects.toThrow(/inside of a Writer/);
});

test('batch refuses a record nobody prepared', async () => {
  const db = new FakeDatabase();
  const row = db.seed('series', { id: 's-1', name: 'Discworld' });

  await expect(
    db.write(async () => {
      await db.batch([row]);
    }),
  ).rejects.toThrow(/prepared create\/update\/delete/);
});

/*
 * `Model:104` and `Model:199`. The first is the one `writeSeriesSave`'s
 * one-merged-update-per-row rule exists to satisfy — the row that hits it is
 * one both dragged AND renumbered in the same editor session.
 */
test('a record refuses a second prepare before its batch', () => {
  const db = new FakeDatabase();
  const row = db.seed('series', { id: 's-1', name: 'Discworld' });

  row.prepareUpdate(() => {});

  expect(() => row.prepareUpdate(() => {})).toThrow(/pending changes/);
  expect(() => row.prepareDestroyPermanently()).toThrow(/pending changes/);
});
