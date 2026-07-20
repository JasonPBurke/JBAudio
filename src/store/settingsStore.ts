import { create } from 'zustand';
import { applyPlayerOptions } from '@/helpers/playerSetup';
import {
  getNumColumns,
  setNumColumns as setNumColumnsInDB,
  getSkipBackDuration,
  getSkipForwardDuration,
  updateSkipBackDuration,
  updateSkipForwardDuration,
  getShakeToResetEnabled,
  setShakeToResetEnabled as setShakeToResetEnabledInDB,
} from '@/db/settingsQueries';

interface SettingsState {
  numColumns: number;
  skipBackDuration: number;
  skipForwardDuration: number;
  shakeToResetEnabled: boolean;
  isInitialized: boolean;
  initializeSettings: () => Promise<void>;
  setNumColumns: (newNumColumns: number) => Promise<void>;
  setSkipBackDuration: (value: number) => Promise<void>;
  setSkipForwardDuration: (value: number) => Promise<void>;
  setShakeToResetEnabled: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  numColumns: 2,
  skipBackDuration: 30,
  skipForwardDuration: 30,
  shakeToResetEnabled: false,
  isInitialized: false,
  initializeSettings: async () => {
    if (get().isInitialized) return;
    const [numColumnsFromDB, skipBack, skipForward, shakeToReset] =
      await Promise.all([
        getNumColumns(),
        getSkipBackDuration(),
        getSkipForwardDuration(),
        getShakeToResetEnabled(),
      ]);
    set({
      numColumns: numColumnsFromDB ?? 2,
      skipBackDuration: skipBack,
      skipForwardDuration: skipForward,
      shakeToResetEnabled: shakeToReset,
      isInitialized: true,
    });
  },
  setNumColumns: async (newNumColumns: number) => {
    set({ numColumns: newNumColumns });
    await setNumColumnsInDB(newNumColumns);
  },
  setSkipBackDuration: async (value: number) => {
    set({ skipBackDuration: value });
    await updateSkipBackDuration(value);
    await applyPlayerOptions(value, get().skipForwardDuration);
  },
  setSkipForwardDuration: async (value: number) => {
    set({ skipForwardDuration: value });
    await updateSkipForwardDuration(value);
    await applyPlayerOptions(get().skipBackDuration, value);
  },
  setShakeToResetEnabled: async (enabled: boolean) => {
    set({ shakeToResetEnabled: enabled });
    await setShakeToResetEnabledInDB(enabled);
  },
}));
