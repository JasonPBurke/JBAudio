import { isDuplicateSeriesName, duplicateNameIssue } from '@/helpers/seriesName';

type SeriesLike = { id: string; name: string };

export { duplicateNameIssue };

/** Wizard step 1. */
export function seriesAuthorStepIssues(
  selectedAuthorNames: string[],
): string[] {
  return selectedAuthorNames.length > 0
    ? []
    : ['Select at least one author.'];
}

/**
 * Wizard step 2. In edit mode this screen is the "Add books" sub-flow: it shows
 * no name input, so only the book requirement applies.
 */
export function seriesBookStepIssues({
  name,
  selectedBookKeys,
  series,
  isEdit,
}: {
  name: string;
  selectedBookKeys: string[];
  series: SeriesLike[];
  isEdit: boolean;
}): string[] {
  const issues: string[] = [];
  // No excludeId: this screen only checks the name in CREATE mode, where no
  // series exists yet to exclude.
  if (!isEdit) {
    if (name.trim().length === 0) issues.push('Enter a series name.');
    else if (isDuplicateSeriesName(name, series))
      issues.push(duplicateNameIssue(name));
  }
  if (selectedBookKeys.length === 0)
    issues.push('Select at least one book.');
  return issues;
}

/** Edit screen Save button. Book count is not checked here: removing the last
 *  book is an intentional path that deletes the series (see updateSeries). */
export function seriesEditIssues({
  name,
  series,
  excludeId,
}: {
  name: string;
  series: SeriesLike[];
  excludeId?: string;
}): string[] {
  if (name.trim().length === 0) return ['Enter a series name.'];
  if (isDuplicateSeriesName(name, series, excludeId))
    return [duplicateNameIssue(name)];
  return [];
}
