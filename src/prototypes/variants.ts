/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * The variant registry. Ticket 08 adds entries here: drop a component in
 * `variants/`, add one row below, fast-refresh, and it appears in the switcher.
 * No other file needs to change.
 */
import type React from 'react';
import BaselineSeriesHome from './variants/BaselineSeriesHome';
import NumberedSeriesHome from './variants/NumberedSeriesHome';
import CardsSeriesHome from './variants/CardsSeriesHome';
import RichHeaderSeriesHome from './variants/RichHeaderSeriesHome';
import PickerSeriesHome from './variants/PickerSeriesHome';
import {
  RichPlayIcon,
  RichPlayContinue,
} from './variants/RichPlaySeriesHome';
import type { VariantProps } from './variantProps';

export type Variant = {
  id: string;
  /** Short enough for a chip in the dev panel. */
  label: string;
  /** What this variant is asking the driver to judge. */
  hint: string;
  Component: React.ComponentType<VariantProps>;
};

export const VARIANTS: Variant[] = [
  {
    id: 'baseline',
    label: 'Baseline',
    hint: 'the Series view exactly as it ships today',
    Component: BaselineSeriesHome,
  },
  {
    id: 'numbered',
    label: 'Numbered',
    hint: 'baseline + cover number badges and a collapsed #1, 3-4, 8 range',
    Component: NumberedSeriesHome,
  },
  // ---- Ticket 08: browse presentation. Ordered cheapest-change first, so
  // flipping left-to-right walks from "keep the section list" to "replace it".
  {
    id: 'cards',
    label: 'Cards',
    hint: 'one full-width card per series: stack, next-up, progress. Body expands, chevron opens detail',
    Component: CardsSeriesHome,
  },
  {
    id: 'richheader',
    label: 'Rich header',
    hint: 'sections kept, but header gains cover backdrop + a STATIC 4-cover peek (no inner scroll)',
    Component: RichHeaderSeriesHome,
  },
  {
    id: 'picker',
    label: 'Picker',
    hint: 'thin rows only, no inline expansion at all — everything lives on the detail screen',
    Component: PickerSeriesHome,
  },
  // ---- Ticket 08, driver's revision of `Rich header`: no origin chip, no
  // inline expansion (tap → detail), play affordance in the vacated space.
  // Two entries, one component, one boolean apart — icon vs `Continue` pill.
  {
    id: 'richplay',
    label: 'Rich + play',
    hint: 'rich header, chip and expansion dropped, round play button (tap header → detail)',
    Component: RichPlayIcon,
  },
  {
    id: 'richcontinue',
    label: 'Rich + continue',
    hint: 'same, but the play button is a `Continue` pill echoing the detail screen',
    Component: RichPlayContinue,
  },
];

export function resolveVariant(id: string): Variant {
  return VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
}
