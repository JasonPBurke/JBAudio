import { Model } from '@nozbe/watermelondb';
import { text, date } from '@nozbe/watermelondb/decorators';

/**
 * A series name the user deleted.
 *
 * Detection is idempotent and would otherwise re-propose the same name on the
 * next scan, so a delete has to leave something behind. The row is keyed by
 * NAME, not by series id, precisely because the series it named is gone and
 * the next detection run will build a different one.
 *
 * There is no unique-constraint support anywhere in this DB library —
 * `isIndexed` emits a plain index and nothing more — so the name must be
 * de-duplicated in JS before writing, or a double-delete stores it twice and
 * the "Removed Series (N)" count is wrong.
 */
export default class SuppressedSeries extends Model {
  static table = 'suppressed_series';

  @text('name') name!: string;
  @date('created_at') createdAt!: Date;
}
