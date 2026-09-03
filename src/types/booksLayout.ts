/**
 * The Books shelf's presentation. ADR 0006's SECOND AXIS: the library header
 * picks a SHELF (one of three), and the Books shelf -- alone -- additionally
 * has a LAYOUT. Shelf is navigation; Layout is a preference. That asymmetry is
 * deliberate and is what keeps "what layout is the Series shelf in?" from
 * being a question.
 *
 * ⚠ Not a boolean, and not a fourth shelf ordinal. A boolean would answer "is
 * it the list one" rather than the question the reader is actually asking --
 * WHICH layout -- and could not grow a third member without a migration. A
 * fourth ordinal is the design ADR 0006 exists to rule against.
 */
export type BooksLayout = 'grid' | 'list';
