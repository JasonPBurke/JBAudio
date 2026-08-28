import { create } from 'zustand';

/**
 * The Requested Book and the Player's setup lifecycle.
 *
 * ⚠ `requestedBookId` IS AN INTENT, NOT AN OBSERVATION. It is what the
 * play / restore / remote-play path most recently decided to play, written the
 * moment the user asks and before the Queue is built, so it **leads** a Book
 * switch. `store/playerState`'s `activeBookId` is the other question — what
 * the Player reports it has actually loaded — and it **lags** the same switch.
 * The two agree during steady playback and disagree for exactly the length of
 * a switch.
 *
 * Both fields were called `activeBookId` until ticket 11, which is why the
 * warning is here rather than assumed: `helpers/handleBookPlay` reads THIS one
 * to tell "same Book, seek" from "different Book, rebuild the Queue", so
 * feeding it the Active Book instead makes a switch look like a resume. That
 * failure is invisible to every test that stays on one Book — see
 * `store/__tests__/queue.test.ts`, which exists to hold the distinction — and
 * to CONTEXT.md's `Requested Book` and `Active Book` entries.
 */
type QueueStore = {
  requestedBookId: string | null;
  setRequestedBookId: (bookId: string) => void;
  isPlayerReady: boolean;
  setPlayerReady: (isReady: boolean) => void;
  playerSetupPromise: Promise<void> | null;
  setPlayerSetupPromise: (promise: Promise<void> | null) => void;
};

export const useQueueStore = create<QueueStore>()((set) => ({
  requestedBookId: null,
  setRequestedBookId: (bookId) => set({ requestedBookId: bookId }),
  isPlayerReady: false,
  setPlayerReady: (isReady) => set({ isPlayerReady: isReady }),
  playerSetupPromise: null,
  setPlayerSetupPromise: (promise) => set({ playerSetupPromise: promise }),
}));
