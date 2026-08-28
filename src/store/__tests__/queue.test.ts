import { useQueueStore } from '../queue';

/**
 * The Requested Book is an INTENT, and this store is the only place that holds
 * it. It is set the moment the user asks for a Book — before the Queue is
 * built — so it LEADS a Book switch, while `store/playerState`'s Active Book
 * mirror lags it. For the length of a switch the two disagree, and that window
 * is the whole reason both fields exist.
 *
 * ⚠ THESE TESTS EXIST TO STOP THE MERGE. Until ticket 11 both fields were
 * called `activeBookId`, and the standing warning against folding them
 * together lived only in a comment. The comment was right and unenforceable:
 * a merge is correct on screen during steady playback and wrong only while a
 * Book is changing. See CONTEXT.md's `Requested Book` and `Active Book`
 * entries, and `helpers/handleBookPlay`, which reads this field to tell a
 * switch from a resume.
 */
describe('useQueueStore — the Requested Book', () => {
  beforeEach(() => {
    useQueueStore.setState({ requestedBookId: null });
  });

  it('starts with nothing requested', () => {
    expect(useQueueStore.getState().requestedBookId).toBeNull();
  });

  it('records the Book the user asked for', () => {
    useQueueStore.getState().setRequestedBookId('book-a');

    expect(useQueueStore.getState().requestedBookId).toBe('book-a');
  });

  /*
   * The lead is the point: the Requested Book moves on the ask, with nothing
   * from the Player consulted. Nothing here waits for a Queue to be built,
   * because the intent is true before one is.
   */
  it('moves to the new Book on a switch without consulting the Player', () => {
    useQueueStore.getState().setRequestedBookId('book-a');
    useQueueStore.getState().setRequestedBookId('book-b');

    expect(useQueueStore.getState().requestedBookId).toBe('book-b');
  });

  /*
   * The Active Book mirror clears to `null` when the Player unloads, and keeps
   * a separate sticky field for consumers that must keep showing the Book that
   * just stopped. This store does neither: an intent is not an observation, so
   * there is nothing here to go stale and nothing to make sticky. If a future
   * change gives this field a null-on-unload behaviour, it has stopped being
   * the Requested Book.
   */
  it('has no sticky twin, because an intent does not lag', () => {
    useQueueStore.getState().setRequestedBookId('book-a');

    expect(Object.keys(useQueueStore.getState())).not.toContain(
      'lastRequestedBookId',
    );
  });
});
