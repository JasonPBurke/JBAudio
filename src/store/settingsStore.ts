import { create } from 'zustand';
import { setRate } from '@/player/trackPlayer';
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
  getSeriesBackgroundsEnabled,
  setSeriesBackgroundsEnabled as setSeriesBackgroundsEnabledInDB,
  getBooksLayout,
  setBooksLayout as setBooksLayoutInDB,
} from '@/db/settingsQueries';
import type { BooksLayout } from '@/types/booksLayout';

interface SettingsState {
  numColumns: number;
  skipBackDuration: number;
  skipForwardDuration: number;
  shakeToResetEnabled: boolean;
  playbackRate: number;
  /** Last speed the user set that wasn't 1x — the icon tap toggles back to it. */
  lastNonDefaultRate: number | null;
  /** Cover backdrop behind the Series browse row. Default ON — see below. */
  seriesBackgroundsEnabled: boolean;
  /** Which layout the Books shelf is drawn in. Default GRID — see below. */
  booksLayout: BooksLayout;
  isInitialized: boolean;
  initializeSettings: () => Promise<void>;
  setNumColumns: (newNumColumns: number) => Promise<void>;
  setSkipBackDuration: (value: number) => Promise<void>;
  setSkipForwardDuration: (value: number) => Promise<void>;
  setShakeToResetEnabled: (enabled: boolean) => Promise<void>;
  setPlaybackRate: (value: number) => Promise<void>;
  setSeriesBackgroundsEnabled: (enabled: boolean) => Promise<void>;
  setBooksLayout: (layout: BooksLayout) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  numColumns: 2,
  skipBackDuration: 30,
  skipForwardDuration: 30,
  shakeToResetEnabled: false,
  playbackRate: 1.0,
  lastNonDefaultRate: null,
  // Must be `true`, not `false`. Anything reading the store before
  // `initializeSettings` resolves sees this, so a `false` seed renders the
  // switch OFF and pops the backdrop in a frame later for a user who never
  // turned it off — the same silent default-OFF trap the DB getter avoids.
  seriesBackgroundsEnabled: true,
  // Must be 'grid'. Anything reading the store before `initializeSettings`
  // resolves sees this, and 'grid' is what `resolveBooksLayout` gives a reader
  // who has never chosen — so the seed and the DB default cannot disagree.
  //
  // No hydration gate goes with it (D4): settings hydrate during launch and the
  // shelf always starts on the sectioned home, so the Books shelf cannot be on
  // screen before this resolves and the seed is never rendered.
  booksLayout: 'grid',
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
      seriesBackgrounds,
      booksLayout,
    ] = await Promise.all([
      getNumColumns(),
      getSkipBackDuration(),
      getSkipForwardDuration(),
      getShakeToResetEnabled(),
      getPlaybackRate(),
      getLastNonDefaultRate(),
      getSeriesBackgroundsEnabled(),
      getBooksLayout(),
    ]);
    set({
      numColumns: numColumnsFromDB ?? 2,
      skipBackDuration: skipBack,
      skipForwardDuration: skipForward,
      shakeToResetEnabled: shakeToReset,
      playbackRate: quantizeRate(rate),
      lastNonDefaultRate: lastRate !== null ? quantizeRate(lastRate) : null,
      seriesBackgroundsEnabled: seriesBackgrounds,
      booksLayout,
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
  setSeriesBackgroundsEnabled: async (enabled: boolean) => {
    set({ seriesBackgroundsEnabled: enabled });
    await setSeriesBackgroundsEnabledInDB(enabled);
  },
  setBooksLayout: async (layout: BooksLayout) => {
    set({ booksLayout: layout });
    await setBooksLayoutInDB(layout);
  },
  setPlaybackRate: async (value: number) => {
    const rate = quantizeRate(value);
    // Setting 1x deliberately preserves lastNonDefaultRate — it is what
    // the gauge icon's tap toggles back to.
    set({
      playbackRate: rate,
      ...(rate !== 1.0 && { lastNonDefaultRate: rate }),
    });
    await setRate(rate);
    await updatePlaybackRate(rate);
    if (rate !== 1.0) await updateLastNonDefaultRate(rate);
  },
}));
