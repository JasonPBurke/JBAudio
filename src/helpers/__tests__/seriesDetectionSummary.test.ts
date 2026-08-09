import { summarizeDetectionRun } from '@/helpers/seriesDetectionSummary';
import type { SeriesDetectionRunResult } from '@/db/seriesDetectionRun';

/**
 * The five outcomes of `Detect Series in Existing Books`, and the two ways the
 * sentence can be wrong without being broken: a plural that reads as a typo,
 * and a "nothing happened" that reads as a failure on the one screen whose job
 * is explaining what detection can and cannot do (A9).
 *
 * `ran: false` carries counts that are ZEROS MEANING UNKNOWN, so every
 * not-ran case must be decided by `reason` and never by the numbers beside it.
 */

const result = (
  overrides: Partial<SeriesDetectionRunResult> = {},
): SeriesDetectionRunResult => ({
  ran: true,
  units: 0,
  proposals: 0,
  placed: 0,
  seriesCreated: 0,
  rowsCreated: 0,
  rowsInserted: 0,
  rowsRemoved: 0,
  skippedUserOwned: 0,
  skippedSuppressed: 0,
  elapsedMs: 0,
  ...overrides,
});

describe('a run that created something', () => {
  it('reports new series and the books in them', () => {
    const { title, message } = summarizeDetectionRun(
      result({ seriesCreated: 19, rowsCreated: 179 }),
    );

    expect(title).toBe('Series Detected');
    expect(message).toBe('Created 19 series from 179 books.');
  });

  it('reports both halves when it also grew existing series', () => {
    const { message } = summarizeDetectionRun(
      result({ seriesCreated: 3, rowsCreated: 8, rowsInserted: 4 }),
    );

    expect(message).toBe(
      'Created 3 series from 8 books, and added 4 books to series you ' +
        'already had.',
    );
  });

  it('reports growth alone when no series was created', () => {
    const { title, message } = summarizeDetectionRun(
      result({ rowsInserted: 2 }),
    );

    expect(title).toBe('Series Detected');
    expect(message).toBe('Added 2 books to series you already had.');
  });

  it('says "1 book", not "1 books"', () => {
    expect(
      summarizeDetectionRun(result({ rowsInserted: 1 })).message,
    ).toContain('1 book to');

    expect(
      summarizeDetectionRun(result({ seriesCreated: 1, rowsCreated: 1 }))
        .message,
    ).toBe('Created 1 series from 1 book.');
  });
});

describe('a run that created nothing', () => {
  // The second press of the button, on a library that is already grouped.
  it('is not phrased as a failure, and says what is left to do', () => {
    const { title, message } = summarizeDetectionRun(result());

    expect(title).toBe('No New Series');
    expect(message).toContain('left on their own');
    expect(message).toContain('by hand');
  });

  // A14: the report is creative-only. Removals go to the scan log.
  it('never mentions removals', () => {
    const { message } = summarizeDetectionRun(
      result({ seriesCreated: 2, rowsCreated: 5, rowsRemoved: 7 }),
    );

    expect(message).not.toContain('7');
    expect(message).not.toMatch(/remov/i);
  });
});

describe('a run that did not happen', () => {
  it('names the toggle when detection is off', () => {
    const { title, message } = summarizeDetectionRun(
      result({ ran: false, reason: 'disabled' }),
    );

    expect(title).toBe('Series Detection Is Off');
    expect(message).toContain('Turn on Series Detection');
  });

  it('points at the library folders when there was nothing to read', () => {
    const { title, message } = summarizeDetectionRun(
      result({ ran: false, reason: 'no-units' }),
    );

    expect(title).toBe('No Books Found');
    expect(message).toContain('folder');
  });

  it('does not claim the library is unchanged when the run failed', () => {
    const { title, message } = summarizeDetectionRun(
      result({ ran: false, reason: 'failed' }),
    );

    expect(title).toBe('Error');
    // The write is one atomic batch and a throw can land after it, so the only
    // promise this copy is entitled to make is about the user's BOOKS.
    expect(message).toContain('Your books were not changed.');
    expect(message).not.toMatch(/library is unchanged|nothing was changed/i);
  });

  // Zeros on a failed run mean "unknown", so a not-ran result must never fall
  // through to the created/nothing-found branches.
  it('is decided by the reason, never by the counts beside it', () => {
    const { title } = summarizeDetectionRun(
      result({ ran: false, reason: 'failed', seriesCreated: 3 }),
    );

    expect(title).toBe('Error');
  });
});
