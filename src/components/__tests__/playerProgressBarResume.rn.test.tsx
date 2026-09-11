import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { useAppStateStore } from '@/store/appState';
import { fakeReanimated, type FakeShared } from './support/fakeReanimated';

/*
 * Returning to the player screen on a PAUSED player whose chapter advanced
 * while the app was backgrounded.
 *
 * Three things recover on resume, independently: `useProgressReanimated`
 * refreshes the position shared value, `useCurrentChapterStable` refreshes the
 * chapter, and this component's own effect copies the new chapter's start into
 * a second shared value. The slider and the chapter title are right straight
 * afterwards. The two time labels were not: they are written by a Reanimated
 * mapper whose prepare function reads ONLY the position, so a chapter change
 * cannot re-fire it -- and `runOnJS` delivers the pair the mapper captured,
 * which on this path is a NEW position beside the OLD chapter's start.
 *
 * ⚠ WHY THE ORDER IS A PARAMETER. The two refreshes race, and only one order
 * was broken. Child effects run before parent ones, so `useProgressReanimated`
 * (in this component) registers its resume subscription before
 * `useCurrentChapterStable` (in the screen above) and the position lands first
 * -- which is why the device sees the broken order every time. Pinning both
 * orders is what stops a fix that merely swaps which writer wins.
 *
 * Numbers are the reported case: 17 chapters of 30:00, backgrounded 21:00 into
 * chapter 3, paused from the notification 11:00 into chapter 5. The broken
 * reading is 7860 - 3600 = 4260s, i.e. "01:11:00" with "-00:00" beside it.
 */

const CHAPTER = 1800;
const CH3_START = 2 * CHAPTER;
const CH5_START = 4 * CHAPTER;
const POSITION_BEFORE = CH3_START + 21 * 60; // 4860
const POSITION_AFTER = CH5_START + 11 * 60; // 7860
const BOOK = 17 * CHAPTER;

type Location = {
  chapter: { chapterDuration: number };
  chapterStartSeconds: number;
};

const at = (chapterStartSeconds: number): Location => ({
  chapter: { chapterDuration: CHAPTER },
  chapterStartSeconds,
});

/** Stands in for `CurrentChapterContext`, so a chapter change re-renders. */
const mockChapterContext = React.createContext<Location | undefined>(undefined);

const mockProgress: Record<
  'position' | 'duration' | 'buffered',
  FakeShared<number>
> = {
  position: fakeReanimated.createShared(0),
  duration: fakeReanimated.createShared(BOOK),
  buffered: fakeReanimated.createShared(0),
};

// Trap 3: reanimated's shipped `/mock` dies in worklets' native half, so a
// suite that imports it carries its own stub. Unlike `PlayerControls`'
// value-only one, this stub SCHEDULES -- see support/fakeReanimated.ts.
jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./support/fakeReanimated').createReanimatedMock(),
);
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./support/fakeReanimated').createWorkletsMock(),
);

// The two resume paths this test interleaves by hand.
jest.mock('@/hooks/useProgressReanimated', () => ({
  useProgressReanimated: () => mockProgress,
}));
jest.mock('@/hooks/useCurrentChapterStable', () => ({
  useCurrentChapterLocation: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useContext(mockChapterContext),
}));

// Ships untranspiled, and renders nothing this test reads.
jest.mock('react-native-awesome-slider', () => ({ Slider: () => null }));
jest.mock('@/player/trackPlayer', () => ({ seekTo: jest.fn() }));
jest.mock('@/helpers/activeBookFootprints', () => ({
  recordActiveBookSeekFootprint: jest.fn(),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#fff',
      maximumTrackTintColor: '#333',
      textMuted: '#999',
      lightText: '#eee',
    },
  }),
}));
jest.mock('@/store/settingsStore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return { useSettingsStore: create(() => ({ playbackRate: 1 })) };
});

// eslint-disable-next-line import/first
import { PlayerProgressBar } from '../PlayerProgressBar';

const Screen = ({ location }: { location: Location }) => (
  <mockChapterContext.Provider value={location}>
    <PlayerProgressBar />
  </mockChapterContext.Provider>
);

/** The elapsed and remaining labels, in render order. */
const readTimes = () =>
  screen.getAllByText(/\d\d:\d\d/).map((node) => String(node.props.children));

/** A UI-thread frame. Whatever it hands to `runOnJS` is only queued. */
const uiFrame = () => act(async () => fakeReanimated.frame());
/** The JS thread receiving what an earlier frame captured. */
const deliverToJs = () => act(async () => fakeReanimated.flushJs());

beforeEach(() => {
  useAppStateStore.setState({ isActive: true });
  mockProgress.position.value = POSITION_BEFORE;
  mockProgress.duration.value = BOOK;
});

afterEach(() => {
  fakeReanimated.reset();
});

describe('PlayerProgressBar, resuming to a paused player', () => {
  it.each(['position first', 'chapter first'] as const)(
    'reads the chapter it resumed into, %s',
    async (order) => {
      const { rerender } = await render(<Screen location={at(CH3_START)} />);
      await uiFrame();
      await deliverToJs();
      expect(readTimes()).toEqual(['21:00', '-09:00']);

      await act(async () => useAppStateStore.getState().setActive(false));
      // Two chapters play out with the screen invisible: every handler on it
      // is gated on `isActive`, so nothing here moves.

      await act(async () => useAppStateStore.getState().setActive(true));

      const refreshPosition = async () => {
        mockProgress.position.value = POSITION_AFTER;
        await uiFrame();
      };
      const refreshChapter = () => rerender(<Screen location={at(CH5_START)} />);

      if (order === 'position first') {
        await refreshPosition();
        await refreshChapter();
      } else {
        await refreshChapter();
        await refreshPosition();
      }

      // The player is PAUSED: no further tick arrives to repair a bad reading.
      // All that is left is the delivery of what the frames already captured.
      await deliverToJs();
      await uiFrame();
      await deliverToJs();

      expect(readTimes()).toEqual(['11:00', '-19:00']);
    },
  );
});
