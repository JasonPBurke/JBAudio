/**
 * The editor's canonical-number rules — spec §D3–D5, §E7, §K3.
 *
 * PURE, and deliberately so. Per the spec's testing decisions, the decision is
 * tested here and the write is IO left untested; `jest.config.js` carries no
 * React Native preset, so anything importing a screen cannot be tested at all.
 *
 * Its one import is provenance VOCABULARY from `@/db/seriesProvenance`, which
 * imports nothing itself, so purity and testability are untouched. It is worth
 * the `helpers/` → `db/` reach because that module is the declared single site
 * for what these columns mean, and a second reading of one is how the two drift.
 */

import { resolveMembership } from '@/db/seriesProvenance';

/**
 * K3 — `decimal-pad` renders the LOCALE's decimal separator, so a
 * comma-decimal user is offered `,` and types `14,1`. `parseFloat('14,1')`
 * returns 14, silently and with no error, which drops the fractional part on
 * exactly the users whose keyboard produced it. Normalise the separator BEFORE
 * parsing.
 *
 * D3 — and the parse is then STRICT, mirroring `toCanonicalNumber` in
 * `seriesReconcile.ts`: `canonical_number` is a nullable NUMBER, so a letter
 * form cannot be stored even by accident. `parseFloat('14b')` is 14, which
 * would file an omnibus alongside book 14 as if it were book 14. Blank beats
 * misleading, so anything that is not wholly numeric returns null.
 */
export function parseCanonicalNumber(
  text: string | null | undefined,
): number | null {
  const normalised = (text ?? '').trim().replace(',', '.');
  // Digits on either side of the separator, but at least one digit somewhere:
  // `5`, `5.`, `5.5` and `.5` all parse, `.` and `14b` do not. `5.` matters
  // because it is what every decimal looks like mid-typing, and dropping it
  // would blink `Sort by number` disabled under the user's finger.
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalised)) return null;
  return Number(normalised);
}

/**
 * D4 — `Sort by number` re-seeds order on demand: numerically ascending,
 * **NULLS LAST**, and **stable**, so a partly-numbered series does not shuffle
 * its unnumbered tail.
 *
 * Stability is decided by the ARRIVAL INDEX, not by title. The prototype
 * alphabetised the blanks; D4 does not, because the blanks are the books the
 * user has said nothing about and re-sorting them is a change they did not ask
 * for. Duplicates hold their order for the same reason.
 *
 * Generic over the row type so the detector and the button share one rule —
 * `seedOrder` in `seriesReconcile.ts` seeds a freshly detected series with this
 * exact comparator, and the spec requires a seeded series and a `Sort by
 * number` press to agree. Two copies of one rule is how sites drift apart.
 */
export function orderByCanonicalNumber<T>(
  items: T[],
  numberOf: (item: T) => number | null,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const an = numberOf(a.item);
      const bn = numberOf(b.item);
      if (an == null && bn == null) return a.index - b.index;
      if (an == null) return 1;
      if (bn == null) return -1;
      return an === bn ? a.index - b.index : an - bn;
    })
    .map(({ item }) => item);
}

/**
 * D5 — bulk numbering ships **gated to fully-unnumbered series only**.
 *
 * Renumbering over existing values IS a bulk destroy, and no bulk destroy ships
 * (A14). "Fill blanks only" was offered and rejected: on `1, _, _, 8` it
 * manufactures false canonical data for the two books nobody numbered — blank
 * beats misleading. Gated to zero-numbered series it is a pure CREATE whose
 * only input is the order the user arranged.
 */
export function canBulkNumber(numbers: (number | null)[]): boolean {
  return numbers.length > 0 && numbers.every((n) => n == null);
}

/**
 * E7 — numbering is playlist-shaped: boxes start empty, blank means no
 * canonical number, and **an untouched list is numbered `1..n` from its final
 * drag order at save**. The array IS that drag order, so the number is the
 * index plus one.
 *
 * SAME GATE AS `canBulkNumber`, and deliberately the same function. D5's button
 * and E7's save are one rule reached two ways — one manual, one implicit — so
 * the button calls this too. That makes pressing it while the gate is shut a
 * no-op rather than a bulk destroy, which is the safe direction for the one
 * verb A14 refuses to ship.
 */
export function resolveNumbersForSave(
  numbers: (number | null)[],
): (number | null)[] {
  if (!canBulkNumber(numbers)) return numbers;
  return numbers.map((_, index) => index + 1);
}

/**
 * A11 — what a series REMEMBERS about the books it is not currently showing.
 *
 * A tombstone is the series' memory of a book, and the canonical number is
 * part of that memory: the row keeps `canonical_number` while it is
 * `'excluded'`, because nothing about a removal says the book's published
 * number changed.
 *
 * ⚠ DEVICE-FOUND, 2026-08-13 (ticket 16). Without this the editor seeds its
 * boxes from the VISIBLE rows only, so putting a removed book back returned it
 * with a blank box — and `Save` then wrote that blank over the stored number,
 * silently, on a round trip the user thought was a no-op.
 *
 * Formatted with a `.` regardless of locale, matching how the editor seeds
 * every other box: K3's parse accepts both separators, and rendering per-locale
 * would mean carrying a locale into a pure draft for a cosmetic gain.
 */
export function rememberedNumbersFrom(
  rows: {
    bookKey: string;
    canonicalNumber?: number | null;
    membership?: string | null;
  }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    // Only a tombstone: a visible row's number is already in its own box, and
    // reading it from here would fight whatever the user has typed.
    //
    // ⚠ Read through `resolveMembership`, never off the raw column. The two
    // agree EXACTLY today, which is what makes this safe — and is also why it
    // sat unnoticed. Widen the tombstone encoding and a raw `!==` silently
    // stops matching, which reopens ticket 16's device-found defect: re-adding
    // a removed book comes back with a blank box and `Save` writes the blank
    // over its stored number. Code review finding 17.
    if (resolveMembership(row.membership) !== 'excluded') continue;
    if (row.canonicalNumber == null) continue;
    out[row.bookKey] = String(row.canonicalNumber);
  }
  return out;
}

/**
 * Fill the number boxes of books that were JUST ADDED from what the series
 * remembers about them. Everything else is left exactly as it is.
 *
 * Two rules, and both are about not overreaching: only the keys being added
 * (another row's blank is a blank the user chose), and never over a value
 * already in the draft (what they typed this session wins).
 */
export function restoreRememberedNumbers(
  current: Record<string, string>,
  remembered: Record<string, string>,
  addedKeys: string[],
): Record<string, string> {
  const next = { ...current };
  for (const key of addedKeys) {
    if (next[key] != null && next[key] !== '') continue;
    const number = remembered[key];
    if (number != null) next[key] = number;
  }
  return next;
}
