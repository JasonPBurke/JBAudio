import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import {
  getThemeMode,
  setThemeMode as setThemeModeInDB,
  getCustomPrimaryColor,
  setCustomPrimaryColor as setCustomPrimaryColorInDB
} from '@/db/settingsQueries';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  activeColorScheme: 'light' | 'dark';
  customPrimaryColor: string | null;
  isInitialized: boolean;
  initializeTheme: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
  setCustomPrimaryColor: (color: string | null) => Promise<void>;
}

// Helper to determine active color scheme based on mode
function getActiveColorScheme(
  mode: ThemeMode,
  systemScheme: ColorSchemeName
): 'light' | 'dark' {
  if (mode === 'system') {
    return systemScheme === 'light' ? 'light' : 'dark';
  }
  return mode;
}

let appearanceSubscription: any = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  activeColorScheme: Appearance.getColorScheme() === 'light' ? 'light' : 'dark',
  customPrimaryColor: null,
  isInitialized: false,

  initializeTheme: async () => {
    if (get().isInitialized) return;

    // Get saved theme mode and custom primary color from database
    const savedMode = await getThemeMode();
    const mode = (savedMode ?? 'system') as ThemeMode;
    const customPrimaryColor = await getCustomPrimaryColor();

    // Determine active color scheme
    const systemScheme = Appearance.getColorScheme();
    const activeColorScheme = getActiveColorScheme(mode, systemScheme);

    set({ mode, activeColorScheme, customPrimaryColor, isInitialized: true });

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
  },

  setMode: async (mode: ThemeMode) => {
    const systemScheme = Appearance.getColorScheme();
    const activeColorScheme = getActiveColorScheme(mode, systemScheme);

    set({ mode, activeColorScheme });
    await setThemeModeInDB(mode);
  },

  setCustomPrimaryColor: async (color: string | null) => {
    set({ customPrimaryColor: color });
    await setCustomPrimaryColorInDB(color);
  },
}));
