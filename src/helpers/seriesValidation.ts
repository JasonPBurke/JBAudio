import { isDuplicateSeriesName, duplicateNameIssue } from '@/helpers/seriesName';

type SeriesLike = { id: string; name: string };

export { duplicateNameIssue };

/** The picker panel's author step (§E3). */
export function seriesAuthorStepIssues(
  selectedAuthorNames: string[],
): string[] {
  return selectedAuthorNames.length > 0
    ? []
    : ['Select at least one author.'];
}

/**
 * The picker panel's book step.
 *
 * It no longer validates the NAME. Under §E1 the name is a field on the editor
 * surface the panel opens over, so the panel cannot be the last thing standing
 * between a nameless draft and the database — the editor's own Save is
 * (`seriesEditorIssues` below). That collapse is the whole shape of §E8: the
 * "picker shared between create and edit" problem dissolved, and with it the
 * `isEdit` flag this function used to carry to decide whose name it was
 * checking.
 */
export function seriesPickerBookIssues(selectedBookKeys: string[]): string[] {
  return selectedBookKeys.length > 0 ? [] : ['Select at least one book.'];
}

/**
 * §E1/E8 — the ONE validation of the ONE create/edit surface.
 *
 * Create and edit used to validate in two places with two functions (the
 * wizard's book step checked a name for a series that did not exist yet; the
 * edit screen's Save checked a name for one that did). One route means one
 * gate, and `editingSeriesId` is the only thing that differs between the two
 * passes: **its absence IS create mode**, and its presence is both the mode and
 * the id to exclude from the duplicate check.
 *
 * ⚠ THE DUPLICATE-NAME RULE IS UNCHANGED, deliberately, and the tests assert it
 * rather than assume it. Series identity is `name` alone (A15/§G), so `Dune
 * Saga` still cannot exist twice, a series is still allowed to keep its own
 * name through a rename, and the sentence the user reads still comes from the
 * single `duplicateNameIssue` definition shared with the query layer's
 * `SeriesNameConflictError`.
 *
 * ⚠ THE BOOK REQUIREMENT IS UNCONDITIONAL, and it was not always — DRIVER
 * RULING ON DEVICE, 2026-08-13 (ticket 16).
 *
 * It used to exempt edit mode, so that emptying a series and pressing `Save`
 * fell through to `updateSeries([])`, which deleted the series and wrote A12's
 * suppression row. That is an unconfirmed destroy with a lasting side effect —
 * detection will not recreate the name until the user finds it in
 * `Removed Series` — performed by a button labelled `Save`. Every other destroy
 * in this app confirms first, and the one that does confirm sits one tap below
 * `+ Add books` on this very screen.
 *
 * A14's standing rule is *bulk creates, per-item destroys*; a run of per-item
 * removals quietly becoming a whole-series destroy at save time was the one
 * place the app inverted it.
 *
 * The message therefore POINTS AT THE ESCAPE HATCH instead of dead-ending on
 * it — but only in edit mode, because the create pass has no `Delete Series`
 * to name. Emptying-as-rebuild (K16) is untouched: the replacements go in
 * before the save, which is the order that was always going to happen.
 */
export function seriesEditorIssues({
  name,
  series,
  bookCount,
  editingSeriesId,
}: {
  name: string;
  series: SeriesLike[];
  bookCount: number;
  /** Present in edit mode only; its absence is what makes this a create. */
  editingSeriesId?: string;
}): string[] {
  const issues: string[] = [];

  if (name.trim().length === 0) issues.push('Enter a series name.');
  else if (isDuplicateSeriesName(name, series, editingSeriesId))
    issues.push(duplicateNameIssue(name));

  if (bookCount === 0)
    issues.push(
      editingSeriesId
        ? 'Add at least one book, or use Delete Series to remove it.'
        : 'Add at least one book.',
    );

  return issues;
}
