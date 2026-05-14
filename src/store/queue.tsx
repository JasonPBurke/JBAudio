import { create } from 'zustand';

type QueueStore = {
  activeBookId: string | null;
  setActiveBookId: (bookId: string) => void;
  isPlayerReady: boolean;
  setPlayerReady: (isReady: boolean) => void;
  playerSetupPromise: Promise<void> | null;
  setPlayerSetupPromise: (promise: Promise<void> | null) => void;
};

export const useQueueStore = create<QueueStore>()((set) => ({
  activeBookId: null,
  setActiveBookId: (bookId) => set({ activeBookId: bookId }),
  isPlayerReady: false,
  setPlayerReady: (isReady) => set({ isPlayerReady: isReady }),
  playerSetupPromise: null,
  setPlayerSetupPromise: (promise) => set({ playerSetupPromise: promise }),
}));

export const useBookQueue = () =>
  useQueueStore((state) => state.activeBookId);
