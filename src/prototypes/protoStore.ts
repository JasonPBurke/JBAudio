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

/**
 * TICKET 14 — where the series line sits on `titleDetails`.
 *
 * Ticket 10 settled the content; only the position is open, and the three
 * candidates are the three species of row the screen already has (identity
 * byline / tag chip / metadata card), plus `subheading`, which the driver
 * asked for after seeing the first three. `off` is a real option here, not just
 * a disabled state — it is the control, and flipping to it is how you see what
 * the variant actually cost the screen.
 *
 * `subheading` is the ONLY one that shows a single series rather than a list —
 * see `primaryMembership` in ProtoSeriesLine.tsx for why that is a departure
 * from ticket 10 and not a rendering shortcut.
 */
export type SeriesLineVariant =
  | 'off'
  | 'subheading'
  | 'byline'
  | 'chips'
  | 'card';

export const SERIES_LINE_VARIANTS: {
  id: SeriesLineVariant;
  label: string;
}[] = [
  { id: 'off', label: 'Off (control)' },
  { id: 'subheading', label: 'Subheading' },
  { id: 'byline', label: 'Byline' },
  { id: 'chips', label: 'Chips' },
  { id: 'card', label: '4th card' },
];

/**
 * TICKET 15 — what shape is the create flow, now that the wizard is a fallback?
 *
 * Four structurally opposed answers, not four skins. `steps3` is the control
 * (today's funnel with 05's three defects fixed, so the funnel is judged
 * polished rather than judged shabby); the other three each delete something:
 *
 *   'steps3'  Authors → Books → Order. Today's shape, defects fixed.
 *   'steps2'  Pick → Arrange. The Authors STEP becomes a search FIELD —
 *             `selectedAuthorNames` never reaches the DB (`createSeries` takes
 *             name + keys only), so step 1 was always a filter wearing a step's
 *             clothes.
 *   'single'  One screen: name + search + an inline reorderable selection.
 *             No steps at all. Writes nothing until `Create`.
 *   'thenEdit' Name prompt → land in the editor. Deletes all three wizard
 *             screens and reuses the surface ticket 10 already grew.
 *
 * Held in memory, per the harness rule — `createSeries` is never called. That
 * matters most for `thenEdit`: the naive version of it writes the series at the
 * name prompt, and `deleteEmptySeries()` runs on every scan
 * (`scanLibrary.ts:964`), so an abandoned create would silently vanish. This
 * prototype defers the write to `Save` instead; see the ticket's answer.
 *
 * A–D were all REJECTED on device on 2026-08-04 ("none of these are fully
 * correct"), and E was specified by the driver out of their parts — D's single
 * editor surface, A's author picker, C's numbers-on-the-left, plus a staging
 * rule and a numbering rule that were neither offered nor in any of the four:
 *
 *   'authorFirst' Editor surface; `Add books` expands a panel that runs
 *                 Authors → Books; Order happens in the list. Selection is
 *                 STAGED until Next, so the list never shoves the panel.
 *                 Numbers start EMPTY, blanks sort last, and an untouched list
 *                 is numbered 1..n from its final order at save.
 *
 * A–D are kept in the switcher unchanged. They are the comparison record, and
 * rewriting a rejected variant destroys the evidence for why it was rejected.
 *
 * F is E's only live rival. It changes ONE thing — the panel's two steps become
 * an accordion, so tapping an author unfolds their books in place and `Next` is
 * pressed once instead of twice. Everything below the panel is literally the
 * same code (`editorShell.tsx`), which is what makes the pair readable as an
 * A/B rather than as two designs.
 */
export type WizardVariant =
  | 'steps3'
  | 'steps2'
  | 'single'
  | 'thenEdit'
  | 'authorFirst'
  | 'accordion';

export const WIZARD_VARIANTS: {
  id: WizardVariant;
  label: string;
  screens: string;
}[] = [
  { id: 'authorFirst', label: 'E · Editor + author panel', screens: '2 taps of Next' },
  { id: 'accordion', label: 'F · Author accordion', screens: '1 tap of Next' },
  { id: 'steps3', label: 'A · 3 steps (fixed)', screens: '3 screens' },
  { id: 'steps2', label: 'B · Pick → Arrange', screens: '2 screens' },
  { id: 'single', label: 'C · One screen', screens: '1 screen' },
  { id: 'thenEdit', label: 'D · Create-then-edit', screens: 'prompt + editor' },
];

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
  /** Ticket 14's only knob. See `SeriesLineVariant`. */
  seriesLineVariant: SeriesLineVariant;
  /** Ticket 15's shape knob. See `WizardVariant`. */
  wizardVariant: WizardVariant;
  /**
   * Variant E only. Pads the author grid to ~100 entries with non-selectable
   * synthetic names, because the question E's grid exists to answer — "can two
   * columns carry 50-100 authors?" — cannot be answered against the eight-book
   * emulator corpus. See `useAuthorCells` in wizard/wizardShared.tsx.
   */
  authorPad: boolean;
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
  setSeriesLineVariant: (v: SeriesLineVariant) => void;
  setWizardVariant: (v: WizardVariant) => void;
  setAuthorPad: (on: boolean) => void;
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
      // Starts on the control so the first look is the screen as it ships.
      seriesLineVariant: 'off',
      // A–D are all rejected, so the control is no longer the useful landing
      // spot — E is the live proposal and A–D are now the reference behind it.
      wizardVariant: 'authorFirst',
      // Starts padded: the density question is the reason the grid exists, and
      // the real corpus cannot pose it.
      authorPad: true,
      editorTarget: 'real',
      pinnedSeries: {},
      setDataPreset: (dataPreset) => set({ dataPreset }),
      setVariantId: (variantId) => set({ variantId }),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setSeriesBackgrounds: (seriesBackgrounds) => set({ seriesBackgrounds }),
      setRowMode: (rowMode) => set({ rowMode }),
      setSeriesLineVariant: (seriesLineVariant) => set({ seriesLineVariant }),
      setWizardVariant: (wizardVariant) => set({ wizardVariant }),
      setAuthorPad: (authorPad) => set({ authorPad }),
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
        seriesLineVariant: s.seriesLineVariant,
        wizardVariant: s.wizardVariant,
        authorPad: s.authorPad,
        editorTarget: s.editorTarget,
        pinnedSeries: s.pinnedSeries,
      }),
    },
  ),
);
