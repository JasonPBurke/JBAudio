import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import {
  ensureSettingsRecord,
  getThemeMode,
  setThemeMode as setThemeModeInDB,
  getCustomPrimaryColor,
  setCustomPrimaryColor as setCustomPrimaryColorInDB,
  getAutoAccentEnabled,
  setAutoAccentEnabled as setAutoAccentEnabledInDB,
  getLastActiveBook,
} from '@/db/settingsQueries';
import database from '@/db';
import BookModel from '@/db/models/Book';
import { usePlayerStateStore } from '@/store/playerState';
import { useLibraryStore } from '@/store/library';
import { ArtworkColors } from '@/helpers/gradientColorSorter';

type ThemeMode = 'system' | 'light' | 'dark';

const COLOR_TYPE_ORDER: (keyof ArtworkColors)[] = [
  'vibrant',
  'darkVibrant',
  'lightVibrant',
  'muted',
  'darkMuted',
  'lightMuted',
  'dominantAndroid',
];

interface ThemeState {
  mode: ThemeMode;
  activeColorScheme: 'light' | 'dark';
  customPrimaryColor: string | null;
  isInitialized: boolean;
  autoAccentEnabled: boolean;
  autoAccentColor: string | null;
  manualOverrideActive: boolean;
  initializeTheme: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
  setCustomPrimaryColor: (color: string | null) => Promise<void>;
  setAutoAccentEnabled: (enabled: boolean) => Promise<void>;
  computeAutoAccentForBook: (bookId: string | null) => void;
}

// Helper to determine active color scheme based on mode
function getActiveColorScheme(
  mode: ThemeMode,
  systemScheme: ColorSchemeName | null | undefined
): 'light' | 'dark' {
  if (mode === 'system') {
    return systemScheme === 'light' ? 'light' : 'dark';
  }
  return mode;
}

function resolveAutoAccentColor(
  artworkColors: ArtworkColors | null | undefined,
  selectedType: string | null
): string | null {
  if (!artworkColors) return null;

  // Try the selected type first (default to vibrant)
  const type = (selectedType || 'vibrant') as keyof ArtworkColors;
  if (artworkColors[type]) return artworkColors[type];

  // Fall back to first non-null color
  for (const key of COLOR_TYPE_ORDER) {
    if (artworkColors[key]) return artworkColors[key];
  }
  return null;
}

let appearanceSubscription: any = null;
let playerStateSubscription: (() => void) | null = null;
let libraryStoreSubscription: (() => void) | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  activeColorScheme: Appearance.getColorScheme() === 'light' ? 'light' : 'dark',
  customPrimaryColor: null,
  isInitialized: false,
  autoAccentEnabled: false,
  autoAccentColor: null,
  manualOverrideActive: false,

  initializeTheme: async () => {
    if (get().isInitialized) return;

    // Defensive: ensure the singleton settings row exists before we read from
    // it. `_layout.tsx` also calls this in a separate effect but the ordering
    // is not guaranteed; this protects against a parallel-effect race that
    // would leave lastActiveBook (and thus autoAccentColor) null on a fresh
    // install.
    await ensureSettingsRecord();

    // Get saved theme mode and custom primary color from database
    const savedMode = await getThemeMode();
    const mode = (savedMode ?? 'system') as ThemeMode;
    const customPrimaryColor = await getCustomPrimaryColor();
    const autoAccentEnabled = await getAutoAccentEnabled();

    // Determine active color scheme
    const systemScheme = Appearance.getColorScheme();
    const activeColorScheme = getActiveColorScheme(mode, systemScheme);

    // Pre-resolve the auto-accent color for the last active book so the first
    // paint already has the correct accent. Without this, the UI renders once
    // with the default/custom color and then re-renders when the library store
    // populates — causing a visible flash.
    let autoAccentColor: string | null = null;
    if (autoAccentEnabled) {
      try {
        const lastActiveBookId = await getLastActiveBook();
        if (lastActiveBookId) {
          const bookRecord = await database
            .get<BookModel>('books')
            .find(lastActiveBookId);
          const artworkColors: ArtworkColors = {
            dominantAndroid: bookRecord.coverColorDominant,
            vibrant: bookRecord.coverColorVibrant,
            darkVibrant: bookRecord.coverColorDarkVibrant,
            lightVibrant: bookRecord.coverColorLightVibrant,
            muted: bookRecord.coverColorMuted,
            darkMuted: bookRecord.coverColorDarkMuted,
            lightMuted: bookRecord.coverColorLightMuted,
          };
          autoAccentColor = resolveAutoAccentColor(
            artworkColors,
            bookRecord.selectedAccentColorType ?? null,
          );
        }
      } catch {
        // Book not found / DB error — fall through with autoAccentColor=null;
        // the library-store subscription below will fix it once data arrives.
      }
    }

    set({
      mode,
      activeColorScheme,
      customPrimaryColor,
      autoAccentEnabled,
      autoAccentColor,
      isInitialized: true,
    });

    // Clean up any existing subscription
    if (appearanceSubscription) {
      appearanceSubscription.remove();
    }

    // Subscribe to system appearance changes
    appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
      const currentMode = get().mode;
      if (currentMode === 'system') {
        const newActiveScheme = getActiveColorScheme(currentMode, colorScheme);
        set({ activeColorScheme: newActiveScheme });
      }
    });

    // Tear down any stale subscriptions before creating new ones. The
    // `isInitialized` guard at the top of this function prevents re-entry in
    // normal flow, but this defends against any future code that resets
    // isInitialized (e.g., a logout/reset path).
    playerStateSubscription?.();
    libraryStoreSubscription?.();

    // Subscribe to activeBookId changes for auto accent
    let prevActiveBookId = usePlayerStateStore.getState().activeBookId;
    playerStateSubscription = usePlayerStateStore.subscribe((state) => {
      const newBookId = state.activeBookId;
      if (newBookId !== prevActiveBookId) {
        prevActiveBookId = newBookId;
        const { autoAccentEnabled } = get();
        if (autoAccentEnabled) {
          get().computeAutoAccentForBook(newBookId);
        }
      }
    });

    // Subscribe to library store for cover art replacement detection
    let prevArtworkColorsRef: ArtworkColors | null = null;
    libraryStoreSubscription = useLibraryStore.subscribe((state) => {
      const { autoAccentEnabled, manualOverrideActive } = get();
      if (!autoAccentEnabled || manualOverrideActive) return;
      const activeBookId = usePlayerStateStore.getState().activeBookId;
      if (!activeBookId) return;
      const book = state.books[activeBookId];
      const currentColors = book?.artworkColors ?? null;
      if (currentColors !== prevArtworkColorsRef) {
        prevArtworkColorsRef = currentColors;
        get().computeAutoAccentForBook(activeBookId);
      }
    });
  },

  setMode: async (mode: ThemeMode) => {
    const systemScheme = Appearance.getColorScheme();
    const activeColorScheme = getActiveColorScheme(mode, systemScheme);

    set({ mode, activeColorScheme });
    await setThemeModeInDB(mode);
  },

  setCustomPrimaryColor: async (color: string | null) => {
    set({
      customPrimaryColor: color,
      manualOverrideActive: color !== null,
    });
    await setCustomPrimaryColorInDB(color);
  },

  setAutoAccentEnabled: async (enabled: boolean) => {
    set({ autoAccentEnabled: enabled });
    await setAutoAccentEnabledInDB(enabled);

    if (enabled) {
      const activeBookId = usePlayerStateStore.getState().activeBookId;
      get().computeAutoAccentForBook(activeBookId);
    } else {
      set({ autoAccentColor: null });
    }
  },

  computeAutoAccentForBook: (bookId: string | null) => {
    if (!bookId || !get().autoAccentEnabled) {
      set({ autoAccentColor: null, manualOverrideActive: false });
      return;
    }

    const book = useLibraryStore.getState().books[bookId];
    if (!book) {
      // Library store hasn't populated this book yet. Preserve the current
      // autoAccentColor (which may have been pre-resolved in initializeTheme)
      // rather than clearing to null — the library-store subscription will
      // re-fire when data arrives.
      return;
    }

    const color = resolveAutoAccentColor(
      book.artworkColors,
      book.selectedAccentColorType ?? null
    );

    set({ autoAccentColor: color, manualOverrideActive: false });
  },
}));
