import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import {
  getThemeMode,
  setThemeMode as setThemeModeInDB,
  getCustomPrimaryColor,
  setCustomPrimaryColor as setCustomPrimaryColorInDB,
  getAutoAccentEnabled,
  setAutoAccentEnabled as setAutoAccentEnabledInDB,
} from '@/db/settingsQueries';
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

    // Get saved theme mode and custom primary color from database
    const savedMode = await getThemeMode();
    const mode = (savedMode ?? 'system') as ThemeMode;
    const customPrimaryColor = await getCustomPrimaryColor();
    const autoAccentEnabled = await getAutoAccentEnabled();

    // Determine active color scheme
    const systemScheme = Appearance.getColorScheme();
    const activeColorScheme = getActiveColorScheme(mode, systemScheme);

    set({ mode, activeColorScheme, customPrimaryColor, autoAccentEnabled, isInitialized: true });

    // If auto accent is enabled, compute for the current active book
    if (autoAccentEnabled) {
      const activeBookId = usePlayerStateStore.getState().activeBookId;
      if (activeBookId) {
        get().computeAutoAccentForBook(activeBookId);
      }
    }

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

    // Subscribe to activeBookId changes for auto accent
    let prevActiveBookId = usePlayerStateStore.getState().activeBookId;
    usePlayerStateStore.subscribe((state) => {
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
    useLibraryStore.subscribe((state) => {
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
    const color = resolveAutoAccentColor(
      book?.artworkColors,
      book?.selectedAccentColorType ?? null
    );

    set({ autoAccentColor: color, manualOverrideActive: false });
  },
}));
