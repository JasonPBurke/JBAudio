import { seriesEmptyMessage } from '@/helpers/seriesEmptyMessage';
import { CustomTabs } from '@/types/CustomTabs';

const base = {
  totalSeriesCount: 3,
  searchMatchCount: 3,
  hasSearchQuery: false,
  selectedTab: CustomTabs.All,
};

test('no series at all wins over every other case', () => {
  expect(
    seriesEmptyMessage({
      ...base,
      totalSeriesCount: 0,
      searchMatchCount: 0,
      hasSearchQuery: true,
      selectedTab: CustomTabs.Unplayed,
    }),
  ).toBe('No series have been set up. Tap + to build a new one.');
});

test('active search with no matches', () => {
  expect(
    seriesEmptyMessage({
      ...base,
      hasSearchQuery: true,
      searchMatchCount: 0,
      selectedTab: CustomTabs.Unplayed,
    }),
  ).toBe('No series match your search.');
});

test('search matches exist but the tab is empty → tab message', () => {
  expect(
    seriesEmptyMessage({
      ...base,
      hasSearchQuery: true,
      searchMatchCount: 2,
      selectedTab: CustomTabs.Finished,
    }),
  ).toBe('No finished series.');
});

test('unplayed tab', () => {
  expect(
    seriesEmptyMessage({ ...base, selectedTab: CustomTabs.Unplayed }),
  ).toBe('No unplayed series.');
});

test('started tab', () => {
  expect(seriesEmptyMessage({ ...base, selectedTab: CustomTabs.Started })).toBe(
    'No series in progress.',
  );
});

test('finished tab', () => {
  expect(
    seriesEmptyMessage({ ...base, selectedTab: CustomTabs.Finished }),
  ).toBe('No finished series.');
});

test('All tab falls back to the no-series message', () => {
  expect(seriesEmptyMessage({ ...base, selectedTab: CustomTabs.All })).toBe(
    'No series have been set up. Tap + to build a new one.',
  );
});
