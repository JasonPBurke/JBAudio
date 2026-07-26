import { useEffect, useRef, type RefObject } from 'react';
import { CustomTabs } from '@/types/CustomTabs';

type ScrollableRef = RefObject<{
  scrollToOffset: (params: { offset: number; animated: boolean }) => void;
} | null>;

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
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(handle);
  }, [listRef, selectedTab]);
}
