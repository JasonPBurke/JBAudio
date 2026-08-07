import { Model } from '@nozbe/watermelondb';
import { text, field, date, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Series from './Series';
import {
  resolveMembership,
  resolveCanonicalSource,
  SeriesMembership,
  SeriesProvenance,
} from '@/db/seriesProvenance';

export default class SeriesBook extends Model {
  static table = 'series_books';
  static associations: Associations = {
    series: { type: 'belongs_to', key: 'series_id' },
  };

  // Structural key = the book's first file path (book.chapters[0].url).
  // Deliberately NOT a foreign key to `books`: book.id churns on tag edit +
  // rescan, the file path does not. Resolved to a live Book in JS at read time.
  @text('book_key') bookKey!: string;
  @field('position') position!: number;
  @date('created_at') createdAt!: Date;
  @relation('series', 'series_id') series!: Series;

  // The number shown on the badge. `position` keeps sole sort authority — this
  // is displayed, never sorted on, so a gap or a duplicate is a cosmetic
  // problem rather than a reordering one.
  @field('canonical_number') canonicalNumber!: number | null;

  // Stored provenance. Read through the accessors below.
  @text('canonical_source') canonicalSourceRaw!: string | null;
  @text('membership') membershipRaw!: string | null;

  /**
   * Why this book is in this series. Null (a pre-v33 row) reads as 'user', so
   * a rescan can never take a hand-placed book back out.
   */
  get membership(): SeriesMembership {
    return resolveMembership(this.membershipRaw);
  }

  set membership(value: SeriesMembership) {
    this.membershipRaw = value;
  }

  /**
   * Who set the canonical number, or null when no number is set. The one
   * provenance column that does NOT coalesce: canonical_number is itself
   * nullable, so 'user' here would claim a number nobody entered.
   */
  get canonicalSource(): SeriesProvenance | null {
    return resolveCanonicalSource(this.canonicalSourceRaw);
  }

  set canonicalSource(value: SeriesProvenance | null) {
    this.canonicalSourceRaw = value;
  }
}
