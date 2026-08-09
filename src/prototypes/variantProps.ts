/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * Every variant is a drop-in for the real `SeriesHome`, so its props are derived
 * from that component rather than re-declared. If SeriesHome's contract changes,
 * the variants fail to compile instead of silently drifting.
 */
import type React from 'react';
import type SeriesHome from '@/components/SeriesHome';

/**
 * TICKET 10: the shipping row does not expand, so `SeriesHome` no longer takes
 * the expanded-sections pair or the browse `Edit` callback. The eight variants
 * kept here as the comparison record still declare them, so they are re-added
 * on top rather than deleted from six closed tickets' artifacts. All three are
 * unused by the winning variant and die with the harness (ticket 18).
 */
export type VariantProps = React.ComponentProps<typeof SeriesHome> & {
  activeGridSections: Set<string>;
  setActiveGridSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  onEditPress: (seriesId: string) => void;
};
