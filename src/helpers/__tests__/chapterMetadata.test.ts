import { hasValidChapterData } from '../chapterMetadata';
import {
  multiItemChapters,
  oneChapterBookChapters,
  oneItemChapters,
} from './support/queueShapeFixtures';

/*
 * The predicate that survived `helpers/singleFileBook.ts`, which until ticket
 * `11` had no test of its own — its module's suite tested only the
 * press-target calculator that ticket `08` deleted.
 *
 * ⚠ IT IS NOT A QUEUE SHAPE VERDICT, and these cases are chosen to prove that
 * rather than to re-test `queueShapeOf`: two of them are one-item Queues that
 * answer differently, and one is a multi-item Queue that answers the same as a
 * one-item one. Nothing about the Queue predicts this.
 */
describe('hasValidChapterData', () => {
  it('is false without rows to read', () => {
    expect(hasValidChapterData(undefined)).toBe(false);
    expect(hasValidChapterData([])).toBe(false);
  });

  // The `> 1` that `clippedChapters.ts` documents as load-bearing only
  // TOGETHER with its own. A single row has no boundary to show a listener,
  // whatever its startMs says.
  it('is false for one row, which is a boundary of nothing', () => {
    expect(hasValidChapterData(oneChapterBookChapters())).toBe(false);
    expect(hasValidChapterData([{ startMs: 5000 }])).toBe(false);
  });

  it('is true when several rows carry real offsets', () => {
    expect(hasValidChapterData(oneItemChapters([0, 60000, 120000]))).toBe(true);
  });

  /*
   * ⚠ THE CASE THAT SEPARATES IT FROM THE SHAPE VERDICT. One file per Chapter
   * is a MULTI-ITEM Queue and every row sits at `startMs: 0`, because the file
   * boundary IS the chapter boundary — so there is no timing data here even
   * though there are plainly chapters. The lock screen gets its chapter
   * labelling from the Queue in that case, not from this predicate.
   */
  it('is false when every row starts at zero, however many there are', () => {
    expect(hasValidChapterData(multiItemChapters(5))).toBe(false);
  });

  it('needs only one non-zero offset among the rows', () => {
    expect(
      hasValidChapterData([{ startMs: 0 }, { startMs: 0 }, { startMs: 90000 }]),
    ).toBe(true);
  });
});
