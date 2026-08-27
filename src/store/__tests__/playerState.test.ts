import { usePlayerStateStore } from '../playerState';

/**
 * The sticky last-active field is the only decision this store makes, and it
 * is the one that replaces `hooks/useLastActiveTrack`. The FloatingPlayer and
 * BookTimeRemaining keep rendering the Book that just stopped, so the field
 * must survive the null that arrives when the Player unloads.
 */
describe('usePlayerStateStore — the Active Book mirror', () => {
  beforeEach(() => {
    usePlayerStateStore.setState({
      activeBookId: null,
      lastActiveBookId: null,
      isPlaying: false,
    });
  });

  it('starts with no Active Book and no last Active Book', () => {
    const { activeBookId, lastActiveBookId } = usePlayerStateStore.getState();
    expect(activeBookId).toBeNull();
    expect(lastActiveBookId).toBeNull();
  });

  it('sets both fields when a Book becomes active', () => {
    usePlayerStateStore.getState().setActiveBookId('book-a');

    const { activeBookId, lastActiveBookId } = usePlayerStateStore.getState();
    expect(activeBookId).toBe('book-a');
    expect(lastActiveBookId).toBe('book-a');
  });

  it('keeps the last Active Book when the Player unloads', () => {
    usePlayerStateStore.getState().setActiveBookId('book-a');
    usePlayerStateStore.getState().setActiveBookId(null);

    const { activeBookId, lastActiveBookId } = usePlayerStateStore.getState();
    expect(activeBookId).toBeNull();
    expect(lastActiveBookId).toBe('book-a');
  });

  it('advances the last Active Book when a different Book loads', () => {
    usePlayerStateStore.getState().setActiveBookId('book-a');
    usePlayerStateStore.getState().setActiveBookId(null);
    usePlayerStateStore.getState().setActiveBookId('book-b');

    const { activeBookId, lastActiveBookId } = usePlayerStateStore.getState();
    expect(activeBookId).toBe('book-b');
    expect(lastActiveBookId).toBe('book-b');
  });

  it('leaves the last Active Book alone when the Player unloads twice', () => {
    usePlayerStateStore.getState().setActiveBookId('book-a');
    usePlayerStateStore.getState().setActiveBookId(null);
    usePlayerStateStore.getState().setActiveBookId(null);

    expect(usePlayerStateStore.getState().lastActiveBookId).toBe('book-a');
  });
});
