import { renderHook } from '@testing-library/react-native';
import { useActiveTrack } from 'react-native-track-player';
import { useActiveTrackBookId } from '@/player/trackPlayer';

/**
 * The adapter's ONE reactive read, and a test that exists for a type hole
 * rather than for behaviour.
 *
 * RNTP declares `Track` with an `[key: string]: any` index signature, so
 * `.bookId`, `.bookid` and `.bookID` all compile and two of them yield
 * `undefined`. Since ticket 09 this hook's value is the app's single answer to
 * "which Book is playing?" -- `components/PlayerStateSync` writes it straight
 * into the store mirror -- so a slip here nulls the Active Book for every
 * consumer with no error and no type change. The imperative twin
 * (`getActiveBookId`) narrows identically.
 *
 * Mocked at RNTP rather than through `fakePlayer`: the hooks are named module
 * exports, NOT members of the default export the fake replaces (see the
 * adapter header), so the fake cannot reach them.
 */
jest.mock('react-native-track-player', () => ({
  useActiveTrack: jest.fn(),
}));

const mockUseActiveTrack = jest.mocked(useActiveTrack);

describe('useActiveTrackBookId', () => {
  it('returns null when the Player has no active item', async () => {
    mockUseActiveTrack.mockReturnValue(undefined);

    const { result } = await renderHook(() => useActiveTrackBookId());

    expect(result.current).toBeNull();
  });

  it('returns the bookId of the active item', async () => {
    mockUseActiveTrack.mockReturnValue({ url: 'x', bookId: 'book-1' });

    const { result } = await renderHook(() => useActiveTrackBookId());

    expect(result.current).toBe('book-1');
  });

  it('returns null for a misspelled bookId, which the index signature admits', async () => {
    // `bookid` compiles because of `[key: string]: any`, and reads `undefined`.
    mockUseActiveTrack.mockReturnValue({ url: 'x', bookid: 'book-1' });

    const { result } = await renderHook(() => useActiveTrackBookId());

    expect(result.current).toBeNull();
  });

  it('returns null for a non-string bookId rather than leaking it', async () => {
    mockUseActiveTrack.mockReturnValue({ url: 'x', bookId: 7 });

    const { result } = await renderHook(() => useActiveTrackBookId());

    expect(result.current).toBeNull();
  });
});
