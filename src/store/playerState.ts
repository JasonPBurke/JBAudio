import { create } from 'zustand';

/**
 * The app's mirror of the Player's Active Book and transport state.
 *
 * ⚠ MOUNT INVARIANT — LOAD-BEARING, NOT AN ACCIDENT. Every selector below is
 * only correct while `components/PlayerStateSync` is mounted: it is the one
 * component that subscribes to the Player library's React hooks, and nothing
 * else writes these fields. It is rendered once in the root layout
 * (`app/_layout.tsx`), above the router, so the invariant holds for every
 * screen. Move it under a route and every consumer silently reads a stale
 * mirror on the screens that route does not cover -- a failure with no error
 * and no type change. The library's hooks worked anywhere; these selectors do
 * not, and that is the price paid for one subscription instead of twelve.
 *
 * ⚠ `activeBookId` HERE IS THE ACTIVE BOOK -- an OBSERVATION of what the
 * Player reports it has loaded, so it LAGS a Book switch. Its counterpart is
 * `store/queue`'s `requestedBookId`, the REQUESTED Book: what the
 * play/restore/remote-play path asked for, which LEADS the same switch. They
 * are not duplicates, and merging them breaks book-switching in a way no test
 * that stays on one Book can see.
 *
 * Both fields were called `activeBookId` until ticket 11 renamed the queue's,
 * which is the only reason the distinction is now legible at an import site;
 * five components read both, in one case four lines apart. The rule the
 * rename came from is CONTEXT.md's: name a key after the question it answers.
 * See CONTEXT.md's `Active Book` and `Requested Book` entries.
 */
interface PlayerState {
  activeBookId: string | null;
  /**
   * The last Book the Player had loaded, which does NOT clear when the Player
   * unloads. Consumers that must keep showing the Book that just stopped --
   * the FloatingPlayer and the time-remaining line inside it -- read this
   * instead of `activeBookId`.
   *
   * It is written by the same action, so whenever `activeBookId` is non-null
   * the two are equal; `activeBookId ?? lastActiveBookId` and
   * `lastActiveBookId` are therefore the same expression, and consumers use
   * the latter.
   */
  lastActiveBookId: string | null;
  isPlaying: boolean;
  setActiveBookId: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
}

export const usePlayerStateStore = create<PlayerState>()((set) => ({
  activeBookId: null,
  lastActiveBookId: null,
  isPlaying: false,
  setActiveBookId: (id) =>
    set(
      id === null
        ? { activeBookId: null }
        : { activeBookId: id, lastActiveBookId: id },
    ),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}));

/**
 * Selector: Returns true ONLY if this specific book is active AND currently playing.
 * This selector will only cause a re-render when:
 * 1. This book becomes/stops being the active book, OR
 * 2. This book IS the active book and playing state changes
 *
 * For non-active books, this always returns false and never changes.
 */
export const useIsBookActiveAndPlaying = (bookId: string): boolean =>
  usePlayerStateStore(
    (state) => state.activeBookId === bookId && state.isPlaying
  );

/**
 * Selector: Returns true if this book is the currently active book.
 * Only triggers re-render when this specific book's active status changes.
 */
export const useIsBookActive = (bookId: string): boolean =>
  usePlayerStateStore((state) => state.activeBookId === bookId);

/**
 * Selector: Which Book the Player currently has loaded, or `null` for none.
 *
 * For a component that only asks about ONE Book, prefer `useIsBookActive` --
 * it returns `false` unchanged for every other Book and so does not re-render
 * on a switch between two Books it does not care about. Reach for this one
 * when the identity itself is the input, e.g. to look the Book up.
 */
export const useActiveBookId = (): string | null =>
  usePlayerStateStore((state) => state.activeBookId);

/**
 * Selector: the last Book the Player had loaded, sticky across unload.
 * See `lastActiveBookId` above for why this is not `activeBookId ?? previous`.
 */
export const useLastActiveBookId = (): string | null =>
  usePlayerStateStore((state) => state.lastActiveBookId);

/**
 * Selector: Get just the isPlaying state.
 * Use this sparingly - only in components that MUST know global playing state.
 */
export const useIsPlayerPlaying = (): boolean =>
  usePlayerStateStore((state) => state.isPlaying);

