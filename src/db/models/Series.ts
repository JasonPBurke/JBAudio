import { Model } from '@nozbe/watermelondb';
import { text, date, children } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import SeriesBook from './SeriesBook';
import { resolveProvenance, SeriesProvenance } from '@/db/seriesProvenance';

export default class Series extends Model {
  static table = 'series';
  static associations: Associations = {
    series_books: { type: 'has_many', foreignKey: 'series_id' },
  };

  @text('name') name!: string;
  @text('sort_name') sortName!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @children('series_books') seriesBooks!: SeriesBook[];

  // A pinned cover. Null means "derive it from the member books", which is a
  // real answer rather than a missing one, so it is never coalesced. Note that
  // a pinned file is referenced only by this series — deleting the series, or
  // reverting to derived art, leaks it unless the file is unlinked too.
  @text('artwork') artwork!: string | null;

  // The stored provenance values. Null on every row that predates v33 — a
  // migration cannot backfill a value — so read them through the resolved
  // accessors below rather than comparing these directly.
  @text('origin') originRaw!: string | null;
  @text('name_source') nameSourceRaw!: string | null;

  /** Who created this series. Null (a pre-v33 row) reads as 'user'. */
  get origin(): SeriesProvenance {
    return resolveProvenance(this.originRaw);
  }

  set origin(value: SeriesProvenance) {
    this.originRaw = value;
  }

  /** Who chose this series' name. Null (a pre-v33 row) reads as 'user'. */
  get nameSource(): SeriesProvenance {
    return resolveProvenance(this.nameSourceRaw);
  }

  set nameSource(value: SeriesProvenance) {
    this.nameSourceRaw = value;
  }
}
