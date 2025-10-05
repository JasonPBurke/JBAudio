import { create } from 'zustand';

type QueueStore = {
  activeBookId: string | null;
  setActiveBookId: (bookId: string) => void;
};

export const useQueueStore = create<QueueStore>()((set) => ({
  activeBookId: null,
  setActiveBookId: (bookId) => set({ activeBookId: bookId }),
}));

export const useBookQueue = () =>
  useQueueStore((state) => state.activeBookId);
