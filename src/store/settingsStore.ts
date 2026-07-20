import { create } from 'zustand';
import TrackPlayer from 'react-native-track-player';
import { applyPlayerOptions } from '@/helpers/playerSetup';
import { quantizeRate } from '@/helpers/playbackRate';
import {
  getNumColumns,
  setNumColumns as setNumColumnsInDB,
  getSkipBackDuration,
  getSkipForwardDuration,
  updateSkipBackDuration,
  updateSkipForwardDuration,
  getShakeToResetEnabled,
  setShakeToResetEnabled as setShakeToResetEnabledInDB,
  getPlaybackRate,
  updatePlaybackRate,
  getLastNonDefaultRate,
  updateLastNonDefaultRate,
} from '@/db/settingsQueries';

interface SettingsState {
  numColumns: number;
  skipBackDuration: number;
  skipForwardDuration: number;
  shakeToResetEnabled: boolean;
  playbackRate: number;
  /** Last speed the user set that wasn't 1x — the icon tap toggles back to it. */
  lastNonDefaultRate: number | null;
  isInitialized: boolean;
  initializeSettings: () => Promise<void>;
  setNumColumns: (newNumColumns: number) => Promise<void>;
  setSkipBackDuration: (value: number) => Promise<void>;
  setSkipForwardDuration: (value: number) => Promise<void>;
  setShakeToResetEnabled: (enabled: boolean) => Promise<void>;
  setPlaybackRate: (value: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  numColumns: 2,
  skipBackDuration: 30,
  skipForwardDuration: 30,
  shakeToResetEnabled: false,
  playbackRate: 1.0,
  lastNonDefaultRate: null,
  isInitialized: false,
  initializeSettings: async () => {
    if (get().isInitialized) return;
    const [
      numColumnsFromDB,
      skipBack,
      skipForward,
      shakeToReset,
      rate,
      lastRate,
    ] = await Promise.all([
      getNumColumns(),
      getSkipBackDuration(),
      getSkipForwardDuration(),
      getShakeToResetEnabled(),
      getPlaybackRate(),
      getLastNonDefaultRate(),
    ]);
    set({
      numColumns: numColumnsFromDB ?? 2,
      skipBackDuration: skipBack,
      skipForwardDuration: skipForward,
      shakeToResetEnabled: shakeToReset,
      playbackRate: quantizeRate(rate),
      lastNonDefaultRate: lastRate !== null ? quantizeRate(lastRate) : null,
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
  setPlaybackRate: async (value: number) => {
    const rate = quantizeRate(value);
    // Setting 1x deliberately preserves lastNonDefaultRate — it is what
    // the gauge icon's tap toggles back to.
    set({
      playbackRate: rate,
      ...(rate !== 1.0 && { lastNonDefaultRate: rate }),
    });
    await TrackPlayer.setRate(rate);
    await updatePlaybackRate(rate);
    if (rate !== 1.0) await updateLastNonDefaultRate(rate);
  },
}));
