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

/**
 * What `Restore` says when it finishes.
 *
 * A12 says the next scan recreates a restored series. Waiting for one was
 * rejected: restoring deletes a VETO, so on its own it changes nothing the
 * user can see, and "it'll come back later" hides the two cases where it never
 * comes back at all —
 *
 *   - **detection is switched off.** Reachable on purpose: the `Removed Series`
 *     row sits outside the enabled block, because turning detection off does
 *     not un-delete anything.
 *   - **the books are gone.** Membership is keyed by file path (ADR 0001), so a
 *     library reorganisation since the delete means detection simply never
 *     proposes that name again.
 *
 * Restore therefore runs detection immediately and this reports what actually
 * happened. Every branch confirms the row left the removed list first — that
 * part is true even when the rebuild is not.
 *
 * ⚠ `ran: false` carries counts that are ZEROS MEANING UNKNOWN, so the
 * not-found branch must be reached only on a run that really ran. A `'failed'`
 * run may have written its batch before throwing.
 */
export function summarizeSeriesRestore(
  restoredNames: readonly string[],
  result: SeriesDetectionRunResult,
): DetectionRunReport {
  const n = restoredNames.length;
  // One restored series is worth naming; several are not worth listing.
  const subject = n === 1 ? restoredNames[0] : `${n} series`;
  const gone = `${subject} ${n === 1 ? 'is' : 'are'} off the removed list`;

  if (!result.ran) {
    if (result.reason === 'disabled') {
      return {
        title: 'Restored',
        message:
          `${gone}. Series Detection is turned off, so ` +
          `${n === 1 ? 'it' : 'they'} can't be rebuilt until you turn it ` +
          'back on.',
      };
    }
    return {
      title: 'Restored',
      message:
        `${gone}, but couldn't be rebuilt just now. ` +
        `${n === 1 ? 'It' : 'They'} will come back the next time your ` +
        'library is scanned again.',
    };
  }

  const { seriesCreated, rowsCreated } = result;

  if (seriesCreated === 0) {
    return {
      title: 'Restored',
      message:
        `${gone}, but detection didn't find ` +
        `${n === 1 ? 'it' : 'them'} in your library — those books may have ` +
        'moved or been removed since.',
    };
  }

  if (seriesCreated < n) {
    return {
      title: 'Series Restored',
      message:
        `${seriesCreated} of ${n} series ${seriesCreated === 1 ? 'is' : 'are'} ` +
        `back, with ${books(rowsCreated)}. Detection didn't find the ` +
        `${n - seriesCreated === 1 ? 'other' : 'others'} in your library.`,
    };
  }

  return {
    title: 'Series Restored',
    message:
      n === 1
        ? `${subject} is back, with ${books(rowsCreated)}.`
        : `${subject} are back, with ${books(rowsCreated)}.`,
  };
}

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
