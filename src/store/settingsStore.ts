import { create } from 'zustand';
import {
  getNumColumns,
  setNumColumns as setNumColumnsInDB,
  getMeshGradientEnabled,
  setMeshGradientEnabled as setMeshGradientEnabledInDB,
} from '@/db/settingsQueries';

interface SettingsState {
  numColumns: number;
  meshGradientEnabled: boolean;
  isInitialized: boolean;
  initializeSettings: () => Promise<void>;
  setNumColumns: (newNumColumns: number) => Promise<void>;
  setMeshGradientEnabled: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  numColumns: 2, // A sensible default before initialization
  meshGradientEnabled: false,
  isInitialized: false,
  initializeSettings: async () => {
    if (get().isInitialized) return;
    const numColumnsFromDB = await getNumColumns();
    const meshGradientFromDB = await getMeshGradientEnabled();
    set({
      numColumns: numColumnsFromDB ?? 2,
      meshGradientEnabled: meshGradientFromDB,
      isInitialized: true,
    });
  },
  setNumColumns: async (newNumColumns: number) => {
    set({ numColumns: newNumColumns });
    await setNumColumnsInDB(newNumColumns);
  },
  setMeshGradientEnabled: async (enabled: boolean) => {
    set({ meshGradientEnabled: enabled });
    await setMeshGradientEnabledInDB(enabled);
  },
}));
