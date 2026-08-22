/**
 * Items shaped like `BooksHome`'s `flatData`, shared by every suite that feeds
 * the section-range producer.
 *
 * One home rather than a copy per suite, so the shape these fixtures claim to
 * mirror can only drift from the real `flatData` in ONE place. A section is a
 * HEADER followed by either a single horizontal row (collapsed) or N book cells
 * (expanded), and sections are contiguous -- which is the producer's stated
 * precondition, so a fixture that broke it would be testing something the app
 * never builds.
 *
 * Lives under `__tests__/support/` because `jest.config.js` documents that path
 * as the home for shared harnesses: the `helpers` lane ignores it when matching
 * tests, and the `rn` lane's `*.rn.test.tsx` suffix never matches it either.
 */
export const header = (sectionId: string) => ({
  type: 'sectionHeader',
  sectionId,
});

export const row = (sectionId: string) => ({
  type: 'horizontalRow',
  sectionId,
});

export const book = (sectionId: string, bookId: string) => ({
  type: 'book',
  sectionId,
  bookId,
});
