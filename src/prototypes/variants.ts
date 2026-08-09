/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * The variant registry. Ticket 08 adds entries here: drop a component in
 * `variants/`, add one row below, fast-refresh, and it appears in the switcher.
 * No other file needs to change.
 */
import type React from 'react';
import SeriesHome from '@/components/SeriesHome';
import BaselineSeriesHome from './variants/BaselineSeriesHome';
import NumberedSeriesHome from './variants/NumberedSeriesHome';
import CardsSeriesHome from './variants/CardsSeriesHome';
import RichHeaderSeriesHome from './variants/RichHeaderSeriesHome';
import PickerSeriesHome from './variants/PickerSeriesHome';
import {
  RichPlayIcon,
  RichPlayContinue,
} from './variants/RichPlaySeriesHome';
import {
  BlendCard,
  BlendSeparator,
  BlendQuiet,
  BlendIcon,
  BlendStack,
  BlendCenter,
  BlendSeparatorCenter,
  BlendQuietCenter,
} from './variants/BlendSeriesHome';
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
  /*
   * TICKET 10: the SHIPPING row, first in the list so it is also what
   * `resolveVariant` falls back to. It is here for one reason — the `Stress ×15`
   * dataset lives in this harness and 10's device criteria are written against
   * it, so the real component has to be reachable with synthetic data behind it.
   * The Data knob injects above the library screen's pipeline, so this entry
   * renders production code with no branch in production code.
   */
  {
    id: 'shipping',
    label: 'Shipping',
    hint: 'the real SeriesHome — ticket 10’s browse row, no prototype in the path',
    Component: SeriesHome,
  },
  {
    id: 'baseline',
    label: 'Baseline',
    hint: 'the Series view as it shipped BEFORE ticket 10 (kept as the record)',
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
  // ---- Ticket 08 REOPENED (2026-08-03): the Cards × Rich blend. The peek row
  // is deleted and the fanned cluster takes over the cover job, which is the one
  // move that answers BOTH complaints (row too heavy, peek doesn't earn its
  // height). `card` vs `sep` isolates the container; `quiet` drops the backdrop.
  {
    id: 'blendcard',
    label: 'Blend card',
    hint: 'Cards frame + Rich backdrop: fanned cluster, next-up, Continue pill. Bounded card, no peek row',
    Component: BlendCard,
  },
  {
    id: 'blendsep',
    label: 'Blend sep',
    hint: 'same row, but no card — full-bleed backdrop and an inset hairline rule like BooksList',
    Component: BlendSeparator,
  },
  {
    id: 'blendquiet',
    label: 'Blend quiet',
    hint: 'same row and rule, but NO cover art behind the text — covers appear only in the cluster',
    Component: BlendQuiet,
  },
  // ---- Ticket 08 REOPENED, second round: the `Continue` pill cost ~27% of the
  // row's width and caused four separate faults. Both hold container=card +
  // backdrop constant against `Blend card`, so the ONLY variable is the play
  // affordance.
  {
    id: 'blendicon',
    label: 'Blend icon',
    hint: 'pill → bare glyph ON the front cover (BookGridItem-style). Zero width cost, text column ~250dp',
    Component: BlendIcon,
  },
  {
    id: 'blendstack',
    label: 'Blend stack',
    hint: 'pill shrunk and tucked under the fan. Row ~20dp taller but FIXED height, text column ~250dp',
    Component: BlendStack,
  },
  {
    id: 'blendcenter',
    label: 'Blend center',
    hint: 'glyph CENTRED and larger on the front cover over a 42% scrim — trades artwork detail for contrast',
    Component: BlendCenter,
  },
  // The centred glyph carried across to the two separator containers, so the
  // play-affordance and container questions can be judged together.
  {
    id: 'blendsepctr',
    label: 'Blend sep ctr',
    hint: 'centred glyph + full-bleed backdrop + inset hairline rule — no card edges',
    Component: BlendSeparatorCenter,
  },
  {
    id: 'blendquietctr',
    label: 'Blend quiet ctr',
    hint: 'centred glyph, hairline rule, NO backdrop — the quietest row in the set',
    Component: BlendQuietCenter,
  },
];

export function resolveVariant(id: string): Variant {
  return VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
}
