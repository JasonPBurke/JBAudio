/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * Every variant is a drop-in for the real `SeriesHome`, so its props are derived
 * from that component rather than re-declared. If SeriesHome's contract changes,
 * the variants fail to compile instead of silently drifting.
 */
import type React from 'react';
import type SeriesHome from '@/components/SeriesHome';

export type VariantProps = React.ComponentProps<typeof SeriesHome>;
