import { create } from 'zustand';

type ScanProgressState = {
  isScanning: boolean;
  totalBooks: number;
  scanJustCompleted: boolean;
  processedBooks: number;
  startScan: () => void;
  setTotalBooks: (total: number) => void;
  incrementProcessedBooks: () => void;
  endScan: () => void;
};

export const useScanProgressStore = create<ScanProgressState>((set) => ({
  isScanning: false,
  scanJustCompleted: false,
  totalBooks: 0,
  processedBooks: 0,
  startScan: () =>
    set({
      isScanning: true,
      scanJustCompleted: false,
      processedBooks: 0,
      totalBooks: 0,
    }),
  setTotalBooks: (total) => set({ totalBooks: total }),
  incrementProcessedBooks: () =>
    set((state) => ({ processedBooks: state.processedBooks + 1 })),
  endScan: () => set({ isScanning: false, scanJustCompleted: true }),
}));
