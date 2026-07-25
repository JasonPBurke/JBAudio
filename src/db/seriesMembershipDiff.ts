/**
 * Pure membership diffing for series_books. Extracted from seriesQueries so it
 * can be unit-tested without importing the native SQLite adapter (`@/db`).
 */

export type ExistingMembership = { bookKey: string; position: number };

export type MembershipDiff = {
  toCreate: { bookKey: string; position: number }[];
  toDelete: string[]; // bookKeys to remove
  toReposition: { bookKey: string; position: number }[];
};

/**
 * Diff the current membership rows against the desired ordered list of book
 * keys. Produces the minimal set of creates/deletes/repositions to reconcile.
 */
export function computeMembershipDiff(
  existing: ExistingMembership[],
  desiredKeysInOrder: string[],
): MembershipDiff {
  const existingKeys = new Set(existing.map((e) => e.bookKey));
  const desiredSet = new Set(desiredKeysInOrder);
  const posByKey = new Map(existing.map((e) => [e.bookKey, e.position]));

  const toDelete = existing
    .filter((e) => !desiredSet.has(e.bookKey))
    .map((e) => e.bookKey);

  const toCreate: { bookKey: string; position: number }[] = [];
  const toReposition: { bookKey: string; position: number }[] = [];

  desiredKeysInOrder.forEach((bookKey, position) => {
    if (!existingKeys.has(bookKey)) {
      toCreate.push({ bookKey, position });
    } else if (posByKey.get(bookKey) !== position) {
      toReposition.push({ bookKey, position });
    }
  });

  return { toCreate, toDelete, toReposition };
}
