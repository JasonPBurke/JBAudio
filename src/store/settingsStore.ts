import { create } from 'zustand';
import {
  getNumColumns,
  setNumColumns as setNumColumnsInDB,
} from '@/db/settingsQueries';

interface SettingsState {
  numColumns: number;
  isInitialized: boolean;
  initializeSettings: () => Promise<void>;
  setNumColumns: (newNumColumns: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  numColumns: 2, // A sensible default before initialization
  isInitialized: false,
  initializeSettings: async () => {
    if (get().isInitialized) return;
    const numColumnsFromDB = await getNumColumns();
    set({ numColumns: numColumnsFromDB ?? 2, isInitialized: true });
  },
  setNumColumns: async (newNumColumns: number) => {
    set({ numColumns: newNumColumns });
    await setNumColumnsInDB(newNumColumns);
  },
}));
