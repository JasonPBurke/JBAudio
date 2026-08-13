/**
 * §K7 — where the editor lands after it deletes a series.
 *
 * The defect, reproduced: `Delete Series` popped ONTO the detail sheet of the
 * series it had just deleted. The route then resolves nothing and renders
 * nothing, and per K5 a route with no themed background renders that as a
 * FULL-SCREEN WHITE sheet with no grab handle — escapable only by system back.
 *
 * K7 needs BOTH fixes and this is the first: pop *past* the sheet. The second
 * is the route's themed `contentStyle`, set in `_layout.tsx`, which is what
 * covers every other way that screen can be reached with nothing to draw.
 *
 * Why a count rather than a fixed `back(); back();`: the stack under the editor
 * is not a constant. A create has no sheet under it at all, and §F's
 * `titleDetails` series line will put a book's own sheet under the series one.
 * Reading the stack is the only version that cannot pop somebody else's screen.
 *
 * This is deliberately not `dismissAll()`: that would also throw away whatever
 * launched the sheet.
 */

/**
 * The subset of a navigation route this decision reads. `params` is typed the
 * way react-navigation types it — a bare `object` — so a real
 * `navigation.getState().routes` can be passed straight in.
 */
export type StackRoute = {
  name: string;
  params?: object;
};

const EDITOR_ROUTE = 'seriesEditor';
const DETAIL_ROUTE = 'seriesDetail';

/**
 * How many screens to pop after deleting `seriesId` from the editor: the
 * editor itself, plus any detail sheets directly beneath it that were showing
 * the series that no longer exists.
 *
 * Never pops the whole stack — an app on no route at all is a worse white
 * screen than the one this exists to fix.
 */
export function popCountAfterSeriesDelete(
  routes: readonly StackRoute[],
  seriesId: string,
): number {
  const max = Math.max(routes.length - 1, 0);
  let count = 0;

  for (let i = routes.length - 1; i >= 0 && count < max; i--) {
    const route = routes[i];
    if (count === 0) {
      if (route.name !== EDITOR_ROUTE) break;
      count = 1;
      continue;
    }
    // A sheet with no id resolves nothing either, so it is the same dead route.
    const id = (route.params as { id?: unknown } | undefined)?.id;
    if (route.name !== DETAIL_ROUTE) break;
    if (id !== undefined && id !== seriesId) break;
    count += 1;
  }

  return count;
}
