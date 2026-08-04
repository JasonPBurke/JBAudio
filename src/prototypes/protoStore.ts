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

/**
 * Which editor the detail sheet's wrench row opens — ticket 13's knob.
 *
 * `real` is the point of the ticket: `series/edit/[id]` is an opaque
 * `slide_from_right` push inside the `series` group, and 11 chose to leave it
 * there, making it the app's FIRST such push launched from a live `formSheet`.
 * Only the real route exercises that, and only the real route's `Save`/`Delete`
 * exercise `exitGroup()`.
 *
 * `proto` reaches `ProtoSeriesEdit` instead, which is where the pinned-artwork
 * caption lives. Keeping this a knob rather than a second row on the sheet is
 * deliberate: the sheet's furniture is the thing being judged, and 11 ruled it
 * carries exactly ONE route to the editor.
 */
export type EditorTarget = 'real' | 'proto';

/**
 * How a book row divides its tap targets — ticket 13's secondary question,
 * REFRAMED by the driver on 2026-08-04.
 *
 * It arrived as "do 41 rows need a play glyph?", which the first build answered
 * as a standalone boolean. The driver rejected the framing: a glyph is only
 * worth its pixels if it DISCRIMINATES, and it can only discriminate if the row
 * has two targets. So the two are one choice, not two:
 *
 *   'whole'  ticket 11's ruling — the entire row plays, and a glyph is
 *            redundant furniture because there is nothing to tell apart.
 *   'split'  cover plays (glyph marks it), text opens `titleDetails` — which
 *            restores the app-wide rule that a book card is tappable to its
 *            details. This screen is currently the ONLY place a book is shown
 *            and cannot be inspected.
 *
 * `split` is the option 11 closed off, and it closed it off as a CONSEQUENCE of
 * "the whole row plays", never on evidence that it could not be built. The
 * technical question it actually rests on — can `titleDetails`, a root-level
 * `formSheet`, be presented over `seriesDetail`, another root-level `formSheet`
 * — was never asked. Nothing in this app stacks two sheets today.
 */
export type RowMode = 'whole' | 'split';

type ProtoState = {
  dataPreset: DataPreset;
  variantId: string;
  panelOpen: boolean;
  /**
   * Stands in for ticket 12's `Series Backgrounds` setting, which 11 widened to
   * govern the detail hero too. Default ON, matching 12's ruling — and note
   * that the real column will need `!== false`, not the house `=== true` idiom.
   */
  seriesBackgrounds: boolean;
  /** See `RowMode`. Carries the glyph with it — they are one choice. */
  rowMode: RowMode;
  editorTarget: EditorTarget;
  /**
   * Synthetic stand-in for 11's `series.artwork` column, keyed by series id.
   * The harness writes nothing to the DB and schema v33 is unbuilt, so a pin is
   * held here and rendered as the LAST book's cover — a cover that is visibly
   * not the derived one, which is the only way the override reads as an
   * override on screen.
   */
  pinnedSeries: Record<string, boolean>;
  setDataPreset: (p: DataPreset) => void;
  setVariantId: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
  setSeriesBackgrounds: (on: boolean) => void;
  setRowMode: (m: RowMode) => void;
  setEditorTarget: (t: EditorTarget) => void;
  setPinned: (seriesId: string, pinned: boolean) => void;
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
      seriesBackgrounds: true,
      // Driver's ruling, 2026-08-04 (ticket 13). `whole` is kept in the
      // switcher so the A/B survives, but `split` is now the spec.
      rowMode: 'split',
      editorTarget: 'real',
      pinnedSeries: {},
      setDataPreset: (dataPreset) => set({ dataPreset }),
      setVariantId: (variantId) => set({ variantId }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setSeriesBackgrounds: (seriesBackgrounds) => set({ seriesBackgrounds }),
      setRowMode: (rowMode) => set({ rowMode }),
      setEditorTarget: (editorTarget) => set({ editorTarget }),
      setPinned: (seriesId, pinned) =>
        set((s) => ({
          pinnedSeries: { ...s.pinnedSeries, [seriesId]: pinned },
        })),
      clearSynthetic: () => set({ dataPreset: 'off' }),
    }),
    {
      name: 'proto-series-harness',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        dataPreset: s.dataPreset,
        variantId: s.variantId,
        seriesBackgrounds: s.seriesBackgrounds,
        rowMode: s.rowMode,
        editorTarget: s.editorTarget,
        pinnedSeries: s.pinnedSeries,
      }),
    },
  ),
);
