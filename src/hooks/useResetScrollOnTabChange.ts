import { useEffect, useRef, type RefObject } from 'react';
import { CustomTabs } from '@/types/CustomTabs';
import type { LadderList } from '@/types/ladderList';

/**
 * The one method this hook drives, taken from the shared list surface rather
 * than re-declared here. `Pick` keeps the hook honest about how little it
 * needs while still failing if that method's signature moves.
 *
 * ⚠ This works because the ref is an ordinary PARAMETER: property covariance
 * lets the screen's `RefObject<LadderList | null>` be passed where a structural
 * subset is expected. It would NOT work as React's `ref` PROP on a
 * `<FlashList<Item>>` -- `FlashListRef<T>` is invariant in `T` and a narrowed
 * shape is rejected with TS2322, which is the reason `LadderList` itself is
 * parameterised with `any` (see its docblock). The two situations look alike
 * and are not.
 */
type ScrollableRef = RefObject<Pick<LadderList, 'scrollToOffset'> | null>;

/**
 * Land the list at the top when the tab changes, so the new tab's content
 * reads from the beginning instead of resuming the previous tab's offset.
 *
 * Deferred one frame: FlashList 2.3.2 has maintainVisibleContentPosition on by
 * default and re-anchors on the data commit, which would otherwise fight this
 * call. This project has a documented history of MVCP scroll bugs on these
 * lists — do not remove the requestAnimationFrame.
 *
 * The first-render guard skips the initial mount, where the list is already at
 * offset 0 and a scroll would be pointless.
 */
export function useResetScrollOnTabChange(
  listRef: ScrollableRef,
  selectedTab: CustomTabs,
) {
  const isFirstTabRender = useRef(true);

  useEffect(() => {
    if (isFirstTabRender.current) {
      isFirstTabRender.current = false;
      return;
    }
    const handle = requestAnimationFrame(() => {
      /*
       * ⚠ `animated: false` is an INVARIANT, not a preference (back-ladder
       * spec §I3). An INSTANT programmatic scroll emits no momentum events at
       * all; an animated one fires `onMomentumScrollEnd` itself. Those settle
       * events are what trigger the back-to-top ladder's collapse sweep, so
       * this single word is the only reason a tab change does not collapse
       * every off-screen section. "Polishing" it to `animated: true` would
       * start silently collapsing sections on every tab change -- a bug that
       * would read as haunted, since nothing here mentions collapsing.
       */
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(handle);
  }, [listRef, selectedTab]);
}
