import { useLibraryStore } from '@/store/library';

/**
 * Re-render the calling component when the chapter turns over inside `bookId`.
 *
 * ⚠ SUBSCRIBED FOR THE RE-RENDER, NOT FOR THE VALUE — which is why this is a
 * named hook rather than a bare selector call at the call site. It returns
 * nothing, and a caller that wants the index should select it directly.
 *
 * It exists for components that read live playback state through an
 * UNSUBSCRIBED `useLibraryStore.getState()` during render and so refresh only
 * when their parent re-renders — `components/BookDurationRow` is the one such
 * component, deliberately (see its header). Until ticket 09 of the player seam,
 * screens rendering it re-rendered at a chapter boundary as a side effect of
 * their `useActiveTrack()` subscription. The Active-Book selectors that
 * replaced it do not change inside one Book, and `current_chapter_index` is not
 * among the columns `store/library`'s `observeWithColumns` watches, so without
 * this the row freezes at its mount value while the Book plays on.
 *
 * `playbackIndex` and NOT `playbackProgress`: the latter is rewritten by
 * `setup/service.ts` on every progress tick, which would re-render the caller
 * at 1 Hz. This changes only at a chapter turn — the cadence those screens had
 * before ticket 09.
 *
 * ⚠ Do NOT "fix" a stale row instead by adding `current_chapter_index` to
 * `observeWithColumns`: that column is written on every chapter turn for every
 * Book, and would re-fetch the whole library each time.
 */
export function useRerenderOnChapterTurn(bookId: string): void {
  useLibraryStore((state) => state.playbackIndex[bookId]);
}
