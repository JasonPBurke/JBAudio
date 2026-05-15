import { create } from 'zustand';

type UIReadyState = {
  isLibraryFirstRenderDone: boolean;
  markLibraryFirstRenderDone: () => void;
};

export const useUIReadyStore = create<UIReadyState>((set) => ({
  isLibraryFirstRenderDone: false,
  markLibraryFirstRenderDone: () =>
    set({ isLibraryFirstRenderDone: true }),
}));
