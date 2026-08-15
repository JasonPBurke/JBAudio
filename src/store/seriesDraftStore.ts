import { create } from 'zustand';

import { restoreRememberedNumbers } from '@/helpers/seriesNumbering';

/**
 * Working draft for the one create/edit surface (§E1). Kept OUTSIDE the screen
 * because the picker's staged selection has to survive the panel opening and
 * closing over it, and because the draft outlives nothing else — the editor
 * seeds it on mount and resets it on removal, so an abandoned draft can't leak
 * into the next run. Book identity throughout is the structural key (first file
 * path), consistent with series_books.book_key.
 *
 * ⚠ It no longer spans three pushed screens. The wizard's steps are a panel on
 * the editor's own route, so nothing here has to survive an unmount any more —
 * but the fields are still the picker's staging buffers, not the editor's
 * state, and `orderedBookKeys` is still the sole source of truth on save.
 */
interface SeriesDraftState {
  mode: 'create' | 'edit';
  editingSeriesId?: string;
  name: string;
  selectedAuthorNames: string[]; // picker step 1 filter
  selectedBookKeys: string[]; // picker step 2 staged selection
  orderedBookKeys: string[]; // the editor's list (source of truth on save)
  /**
   * §D3 — the per-row canonical number, held as the RAW TEXT the field shows
   * rather than as a parsed number.
   *
   * Two reasons, both about the keypad. A comma-decimal user's `14,1` must
   * survive as `14,1` (K3 normalises it at the parse, not at the keystroke), or
   * the separator their own keyboard offered would be rewritten under their
   * finger. And `14.` is a state every decimal passes through while being
   * typed; parsing on keystroke would round-trip it back to `14` and eat the
   * separator they just pressed.
   *
   * Keyed by structural key, so a drag reorders the list without touching a
   * single number — which is exactly D3's rule that editing a number does not
   * resort, read from the other end.
   */
  numbersByKey: Record<string, string>;

  resetForCreate: () => void;
  /** `numbersByKey` is optional: a series with no published numbers seeds none. */
  resetForEdit: (
    id: string,
    name: string,
    orderedKeys: string[],
    numbersByKey?: Record<string, string>,
  ) => void;
  setName: (name: string) => void;
  toggleAuthor: (name: string) => void;
  toggleBookKey: (key: string) => void;
  setOrderedKeys: (keys: string[]) => void;
  /**
   * Commit the staged picker selection (§E3), carrying A11's remembered
   * numbers for the books this pass ACTUALLY adds.
   */
  commitPickerSelection: (remembered: Record<string, string>) => void;
  setNumber: (key: string, value: string) => void;
  setNumbers: (numbersByKey: Record<string, string>) => void;
  beginPicker: () => void;
}

const toggle = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

const union = (arr: string[], additions: string[]) => {
  const seen = new Set(arr);
  const merged = [...arr];
  for (const a of additions) {
    if (!seen.has(a)) {
      seen.add(a);
      merged.push(a);
    }
  }
  return merged;
};

export const useSeriesDraftStore = create<SeriesDraftState>()((set) => ({
  mode: 'create',
  editingSeriesId: undefined,
  name: '',
  selectedAuthorNames: [],
  selectedBookKeys: [],
  orderedBookKeys: [],
  numbersByKey: {},

  resetForCreate: () =>
    set({
      mode: 'create',
      editingSeriesId: undefined,
      name: '',
      selectedAuthorNames: [],
      selectedBookKeys: [],
      orderedBookKeys: [],
      numbersByKey: {},
    }),

  resetForEdit: (id, name, orderedKeys, numbersByKey) =>
    set({
      mode: 'edit',
      editingSeriesId: id,
      name,
      selectedAuthorNames: [],
      selectedBookKeys: [...orderedKeys],
      orderedBookKeys: [...orderedKeys],
      numbersByKey: { ...(numbersByKey ?? {}) },
    }),

  setName: (name) => set({ name }),

  toggleAuthor: (name) =>
    set((s) => ({ selectedAuthorNames: toggle(s.selectedAuthorNames, name) })),

  toggleBookKey: (key) =>
    set((s) => ({ selectedBookKeys: toggle(s.selectedBookKeys, key) })),

  setOrderedKeys: (keys) => set({ orderedBookKeys: keys }),

  /**
   * ⚠ ONE `set` over ONE snapshot, and that is the whole point. The union and
   * A11's number restore need the SAME "before" list: the commit ADDS the
   * staged set, but it may only RESTORE what the staged set actually adds.
   *
   * `beginPicker` re-seeds the staging from the entire list, so the staged set
   * is a superset of the added set — every existing member is in it. Handing
   * that to `restoreRememberedNumbers` as its `addedKeys` refills a box the
   * user deliberately cleared, on the next pass (code review finding 8).
   *
   * Deriving both from `s` is what keeps them honest. The screen used to read
   * the "before" list once for the append and once for the restore, and the two
   * reads were free to disagree — the same input-drift shape as ticket 22.
   */
  commitPickerSelection: (remembered) =>
    set((s) => {
      const added = s.selectedBookKeys.filter(
        (k) => !s.orderedBookKeys.includes(k),
      );
      return {
        orderedBookKeys: union(s.orderedBookKeys, s.selectedBookKeys),
        numbersByKey: restoreRememberedNumbers(
          s.numbersByKey,
          remembered,
          added,
        ),
      };
    }),

  setNumber: (key, value) =>
    set((s) => ({ numbersByKey: { ...s.numbersByKey, [key]: value } })),

  /** Bulk numbering (D5) and `Sort by number` both replace the map wholesale. */
  setNumbers: (numbersByKey) => set({ numbersByKey: { ...numbersByKey } }),

  /**
   * `+ Add books` — start a fresh pass through the picker.
   *
   * The author filter clears (a second pass is a second question), but the
   * staged books are re-seeded from the list you already have, so books already
   * in the series read as selected rather than as candidates. That is what
   * keeps the picker ADDITIVE: unticking one there cannot remove it, because
   * the commit is a union. Removal is the editor list's own affordance, and
   * keeping the two apart is why `+ Add books` can be opened any number of
   * times without ever subtracting.
   */
  beginPicker: () =>
    set((s) => ({
      selectedAuthorNames: [],
      selectedBookKeys: [...s.orderedBookKeys],
    })),
}));
