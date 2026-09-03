import { resolveBooksLayout } from '@/helpers/resolveBooksLayout';

/**
 * D4 -- the ONE place `settings.books_layout` becomes a `BooksLayout`, and
 * therefore the one place the default lives. Nothing reads that column raw,
 * following `resolveTimerMode`.
 *
 * The default is not a detail. `addColumns` cannot backfill, so EVERY row that
 * existed before schema v36 reads null -- which is to say every reader already
 * using the app. Resolving null to anything but the grid would rearrange their
 * shelf on an update they did not ask for (user story 28).
 */
describe('resolveBooksLayout', () => {
  it('resolves null to the grid -- every pre-v36 row, and every fresh install', () => {
    // `ensureSettingsRecord` seeds three fields, so null is the column's state
    // on a NEW install too, not merely after the migration.
    expect(resolveBooksLayout(null)).toBe('grid');
  });

  it('resolves the empty string to the grid', () => {
    expect(resolveBooksLayout('')).toBe('grid');
  });

  it('resolves an unrecognised string to the grid', () => {
    // The column is a string so a third layout is POSSIBLE later. Until one
    // exists, a value from a future build -- or a corrupted row -- must degrade
    // to the layout the reader had before the feature, not to a blank shelf.
    expect(resolveBooksLayout('masonry')).toBe('grid');
  });

  it('resolves an exact `list` to the list', () => {
    expect(resolveBooksLayout('list')).toBe('list');
  });

  it('resolves an exact `grid` to the grid', () => {
    expect(resolveBooksLayout('grid')).toBe('grid');
  });
});
