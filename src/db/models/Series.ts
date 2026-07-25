import { Model } from '@nozbe/watermelondb';
import { text, date, children } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import SeriesBook from './SeriesBook';

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
}
