import { create } from 'zustand';

interface PlayerState {
  activeBookId: string | null;
  isPlaying: boolean;
  wasPlayerScreenDismissedToBackground: boolean;
  remainingSleepTimeMs: number | null;
  setActiveBookId: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setWasPlayerScreenDismissedToBackground: (value: boolean) => void;
  setRemainingSleepTimeMs: (ms: number | null) => void;
}

export const usePlayerStateStore = create<PlayerState>()((set) => ({
  activeBookId: null,
  isPlaying: false,
  wasPlayerScreenDismissedToBackground: false,
  remainingSleepTimeMs: null,
  setActiveBookId: (id) => set({ activeBookId: id }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setWasPlayerScreenDismissedToBackground: (value) =>
    set({ wasPlayerScreenDismissedToBackground: value }),
  setRemainingSleepTimeMs: (ms) => set({ remainingSleepTimeMs: ms }),
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
 * Selector: Get just the isPlaying state.
 * Use this sparingly - only in components that MUST know global playing state.
 */
export const useIsPlayerPlaying = (): boolean =>
  usePlayerStateStore((state) => state.isPlaying);

/**
 * Selector: Get the remaining sleep time in ms (used when paused).
 * Returns null when playing (countdown uses live calculation).
 */
export const useRemainingSleepTimeMs = (): number | null =>
  usePlayerStateStore((state) => state.remainingSleepTimeMs);
