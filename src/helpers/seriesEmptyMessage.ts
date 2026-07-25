import { CustomTabs } from '@/types/CustomTabs';

export const NO_SERIES_MESSAGE =
  'No series have been set up. Tap + to build a new one.';

type Args = {
  /** Every series that exists, before search or tab filtering. */
  totalSeriesCount: number;
  /** Series remaining after the search filter, before tab filtering. */
  searchMatchCount: number;
  hasSearchQuery: boolean;
  selectedTab: CustomTabs;
};

/**
 * Message for the Series list when it renders empty. Evaluated in order, so
 * "you have no series" always beats "this tab is empty" — otherwise a single
 * played series makes the Unplayed and Finished tabs both claim nothing has
 * been set up.
 *
 * The All tab has no case of its own: with series present and no active search
 * it can never be empty. It falls through to NO_SERIES_MESSAGE rather than
 * rendering a blank list.
 */
export function seriesEmptyMessage({
  totalSeriesCount,
  searchMatchCount,
  hasSearchQuery,
  selectedTab,
}: Args): string {
  if (totalSeriesCount === 0) return NO_SERIES_MESSAGE;
  if (hasSearchQuery && searchMatchCount === 0)
    return 'No series match your search.';
  switch (selectedTab) {
    case CustomTabs.Unplayed:
      return 'No unplayed series.';
    case CustomTabs.Started:
      return 'No series in progress.';
    case CustomTabs.Finished:
      return 'No finished series.';
    default:
      return NO_SERIES_MESSAGE;
  }
}
