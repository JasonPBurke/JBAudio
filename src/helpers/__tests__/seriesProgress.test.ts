import { deriveSeriesProgressState } from '@/helpers/seriesProgress';

const b = (v: number) => ({ bookProgressValue: v });

test('all not-started → unplayed', () =>
  expect(deriveSeriesProgressState([b(0), b(0)])).toBe('unplayed'));

test('finished + not-started → playing', () =>
  expect(deriveSeriesProgressState([b(2), b(0), b(0)])).toBe('playing'));

test('one started → playing', () =>
  expect(deriveSeriesProgressState([b(1), b(0)])).toBe('playing'));

test('all finished → finished', () =>
  expect(deriveSeriesProgressState([b(2), b(2)])).toBe('finished'));

test('empty → unplayed', () =>
  expect(deriveSeriesProgressState([])).toBe('unplayed'));
