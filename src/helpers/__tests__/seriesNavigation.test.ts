import { popCountAfterSeriesDelete } from '@/helpers/seriesNavigation';

const drawer = { name: '(drawer)' };
const editor = (id: string) => ({ name: 'seriesEditor', params: { id } });
const sheet = (id: string) => ({ name: 'seriesDetail', params: { id } });

describe('K7 — the delete exit pops PAST the sheet of the series it deleted', () => {
  test('the editor and the sheet under it both go', () => {
    expect(popCountAfterSeriesDelete([drawer, sheet('s1'), editor('s1')], 's1')).toBe(2);
  });

  test('an editor opened without a sheet under it pops once', () => {
    expect(popCountAfterSeriesDelete([drawer, editor('s1')], 's1')).toBe(1);
  });

  /*
   * §F — a book's `titleDetails` will link to a series sheet, so the stack the
   * editor sits on is not always two deep. Whatever launched the sheet is not
   * this delete's business.
   */
  test('only the deleted series’ sheet is popped, not what launched it', () => {
    const routes = [drawer, { name: 'titleDetails' }, sheet('s1'), editor('s1')];
    expect(popCountAfterSeriesDelete(routes, 's1')).toBe(2);
  });

  test('someone else’s sheet is left standing', () => {
    expect(popCountAfterSeriesDelete([drawer, sheet('s2'), editor('s1')], 's1')).toBe(1);
  });

  /* A sheet with no id resolves nothing either — it is the K5 white screen. */
  test('a sheet carrying no id is popped too', () => {
    const routes = [drawer, { name: 'seriesDetail' }, editor('s1')];
    expect(popCountAfterSeriesDelete(routes, 's1')).toBe(2);
  });

  test('two stacked sheets for the same series both go', () => {
    const routes = [drawer, sheet('s1'), sheet('s1'), editor('s1')];
    expect(popCountAfterSeriesDelete(routes, 's1')).toBe(3);
  });

  /*
   * The guard that matters more than the count: popping the last route leaves
   * the app on nothing at all, which is a worse white screen than the one this
   * is fixing.
   */
  test('never pops the whole stack', () => {
    expect(popCountAfterSeriesDelete([sheet('s1'), editor('s1')], 's1')).toBe(1);
    expect(popCountAfterSeriesDelete([editor('s1')], 's1')).toBe(0);
    expect(popCountAfterSeriesDelete([], 's1')).toBe(0);
  });
});
