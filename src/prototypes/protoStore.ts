/**
 * THROWAWAY — Series UX redesign prototype harness (.scratch/series-ux-redesign, ticket 04).
 * Delete this whole directory when the effort ends. See ./README.md.
 *
 * Two orthogonal knobs, both `__DEV__`-only:
 *   dataPreset — where the Series view's data comes from (real DB vs synthetic)
 *   variantId  — which browse implementation renders it
 *
 * Persisted to AsyncStorage so an A/B position survives the full JS reloads that
 * navigator/`screenOptions` work forces (see the map's emulator-ops notes). The
 * panel shows a loud badge whenever synthetic data is live so a persisted
 * "synthetic on" can never be mistaken for the real library.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DataPreset = 'off' | 'stress' | 'minimal';

export const DATA_PRESETS: { id: DataPreset; label: string; hint: string }[] = [
  { id: 'off', label: 'Real DB', hint: 'the actual series rows on this device' },
  { id: 'stress', label: 'Stress ×15', hint: 'every pathological shape at once' },
  { id: 'minimal', label: 'Calm ×3', hint: 'an ordinary, unstressed library' },
];

type ProtoState = {
  dataPreset: DataPreset;
  variantId: string;
  panelOpen: boolean;
  setDataPreset: (p: DataPreset) => void;
  setVariantId: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
  /** "Clear synthetic series" — nothing was ever written to the DB, so this is a
   *  complete restore, not a best-effort cleanup. */
  clearSynthetic: () => void;
};

export const useProtoStore = create<ProtoState>()(
  persist(
    (set) => ({
      dataPreset: 'off',
      variantId: 'baseline',
      panelOpen: false,
      setDataPreset: (dataPreset) => set({ dataPreset }),
      setVariantId: (variantId) => set({ variantId }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      clearSynthetic: () => set({ dataPreset: 'off' }),
    }),
    {
      name: 'proto-series-harness',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        dataPreset: s.dataPreset,
        variantId: s.variantId,
      }),
    },
  ),
);
