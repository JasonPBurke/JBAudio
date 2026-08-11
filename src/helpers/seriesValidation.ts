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
 * The book requirement is asymmetric on purpose: creating an empty series is
 * meaningless, but emptying an existing one is a real path — `updateSeries([])`
 * delegates to `deleteSeries`, which suppresses (A12). Blocking it here would
 * disable Save on the one screen that can reach it.
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

  if (!editingSeriesId && bookCount === 0)
    issues.push('Add at least one book.');

  return issues;
}
