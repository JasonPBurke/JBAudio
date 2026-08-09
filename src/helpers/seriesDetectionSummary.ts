/**
 * What `Detect Series in Existing Books` says when it finishes.
 *
 * Pure on purpose. The button's only job is to call `runSeriesDetection` and
 * show what comes back, and every judgement in that sentence — which of five
 * outcomes happened, whether "series" needs a number in front of it, whether
 * "no new series" is bad news — is decidable from the result alone. Keeping it
 * out of the JSX is what makes the copy testable, since a settings screen is
 * not (no layout engine in this suite; see the spec's testing section).
 *
 * A14 — the button is a CREATIVE bulk action, and the report says only what was
 * created. Reconcile can also remove a membership row that is no longer
 * detected, and that number goes to the scan log, not to a dialog: a user who
 * pressed a button labelled "detect" is not asking to be told about removals,
 * and surfacing them would read as the bulk destroy this feature does not ship.
 */

import type { SeriesDetectionRunResult } from '@/db/seriesDetectionRun';

export type DetectionRunReport = {
  title: string;
  message: string;
};

/** `1 book` / `2 books`. "series" is already its own plural. */
const books = (n: number) => `${n} book${n === 1 ? '' : 's'}`;

export function summarizeDetectionRun(
  result: SeriesDetectionRunResult,
): DetectionRunReport {
  if (!result.ran) {
    switch (result.reason) {
      // Not reachable from the card, which hides the button while detection is
      // off — but the run guards on its own state, so the report answers for
      // that state rather than assuming a caller.
      case 'disabled':
        return {
          title: 'Series Detection Is Off',
          message:
            'Turn on Series Detection to group the books you already have ' +
            'into series.',
        };
      case 'no-units':
        return {
          title: 'No Books Found',
          message:
            'There are no books in your library folders to group. Add a ' +
            'folder, or check that your existing folders are still where ' +
            'they were.',
        };
      default:
        return {
          title: 'Error',
          message:
            'Something went wrong while grouping your books into series. ' +
            'Your books were not changed. Please try again.',
        };
    }
  }

  const { seriesCreated, rowsCreated, rowsInserted } = result;

  if (seriesCreated > 0 && rowsInserted > 0) {
    return {
      title: 'Series Detected',
      message:
        `Created ${seriesCreated} series from ${books(rowsCreated)}, and ` +
        `added ${books(rowsInserted)} to series you already had.`,
    };
  }

  if (seriesCreated > 0) {
    return {
      title: 'Series Detected',
      message: `Created ${seriesCreated} series from ${books(rowsCreated)}.`,
    };
  }

  if (rowsInserted > 0) {
    return {
      title: 'Series Detected',
      message: `Added ${books(rowsInserted)} to series you already had.`,
    };
  }

  // The commonest outcome on a second press, and the one most easily read as a
  // failure. A7's abstention bias is the app working as designed, so the copy
  // says what to do next instead of apologising.
  return {
    title: 'No New Series',
    message:
      'No new series were found. Books with no series information in their ' +
      'files are left on their own — you can group those by hand.',
  };
}
