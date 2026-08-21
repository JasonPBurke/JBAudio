import type { RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';

import type { SectionRange } from '@/helpers/ladderDecisions';
import type { CustomTabs } from '@/types/CustomTabs';

/**
 * The back-to-top ladder's list contract, shared by all four library lists.
 *
 * Spec §H6-H9. This type is the enforcement mechanism, not documentation: the
 * four lists intersect it into their own props, so a field added here fails
 * compilation on every list that has not kept up -- INCLUDING `BooksList`,
 * which nothing currently mounts. That is what stops the contract quietly
 * drifting away from the one list no manual test can reach.
 *
 * The ladder hook itself (§J1) arrives with ticket 05 and will consume these
 * types; they live in their own module rather than inside that hook so the
 * hook can be added without moving anything, and so `ladderDecisions.ts` --
 * the pure, jest-testable decision unit -- stays free of React Native imports.
 */

/**
 * The list surface the ladder drives, and the type of the single ref the
 * library screen owns.
 *
 * ⚠ The `any` is load-bearing and is NOT a placeholder for a tighter type.
 * The four lists carry four different item types, and `FlashListRef<T>` is
 * invariant in `T` (it appears in both `props` and `scrollToItem`). A ref is
 * checked through its mutable `current`, so neither a narrower item type nor a
 * structural interface naming only the methods the ladder actually calls can be
 * handed to `<FlashList<Item> ref={...}>` -- both are rejected with TS2322.
 * `any` is the only parameterisation one shared ref can hold for all four.
 */
export type LadderList = FlashListRef<any>;

/**
 * What every library list must accept.
 *
 * ⚠ `listRef` is REQUIRED and no list may keep an internal fallback ref
 * (§H6). An optional ref with a fallback fails SILENTLY -- a caller who
 * forgets it gets a ladder that does nothing and no error, which is precisely
 * the state two of these lists were in before this contract existed.
 *
 * ⚠ The two settle handlers are REQUIRED rather than optional for the same
 * reason: required is what makes the compiler do the work.
 *
 * Deliberately absent (§H9): `onScroll`, any header height, any per-view
 * constant, and any "does this view collapse?" flag. Capability comes from
 * view identity at the hook, and the ladder never sits in the per-frame path
 * -- it acts only on settle events, so the screen's existing scroll handler
 * stays exactly as it is, uncomposed.
 */
export type LadderListProps = {
  /** Owned by the library screen. Serves the ladder AND the tab-change reset. */
  listRef: RefObject<LadderList | null>;
  selectedTab: CustomTabs;
  onMomentumScrollEnd: () => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Sectioned views only. */
  onSectionRangesChange?: (ranges: SectionRange[]) => void;
};
