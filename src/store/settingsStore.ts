import { create } from 'zustand';
import TrackPlayer, { Capability } from 'react-native-track-player';
import {
  getNumColumns,
  setNumColumns as setNumColumnsInDB,
  getSkipBackDuration,
  getSkipForwardDuration,
  updateSkipBackDuration,
  updateSkipForwardDuration,
} from '@/db/settingsQueries';

interface SettingsState {
  numColumns: number;
  skipBackDuration: number;
  skipForwardDuration: number;
  isInitialized: boolean;
  initializeSettings: () => Promise<void>;
  setNumColumns: (newNumColumns: number) => Promise<void>;
  setSkipBackDuration: (value: number) => Promise<void>;
  setSkipForwardDuration: (value: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  numColumns: 2,
  skipBackDuration: 30,
  skipForwardDuration: 30,
  isInitialized: false,
  initializeSettings: async () => {
    if (get().isInitialized) return;
    const [numColumnsFromDB, skipBack, skipForward] = await Promise.all([
      getNumColumns(),
      getSkipBackDuration(),
      getSkipForwardDuration(),
    ]);
    set({
      numColumns: numColumnsFromDB ?? 2,
      skipBackDuration: skipBack,
      skipForwardDuration: skipForward,
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
    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: 1,
      backwardJumpInterval: value,
      forwardJumpInterval: get().skipForwardDuration,
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.Stop,
      ],
    });
  },
  setSkipForwardDuration: async (value: number) => {
    set({ skipForwardDuration: value });
    await updateSkipForwardDuration(value);
    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: 1,
      forwardJumpInterval: value,
      backwardJumpInterval: get().skipBackDuration,
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.Stop,
      ],
    });
  },
}));
