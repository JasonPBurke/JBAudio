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
];

export function resolveVariant(id: string): Variant {
  return VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
}
