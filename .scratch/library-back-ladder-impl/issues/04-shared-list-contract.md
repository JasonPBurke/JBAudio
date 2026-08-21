# 04 — Prefactor: one shared list contract across all four lists

**What to build:** No user-visible change at all. The library screen becomes the owner of the one
list ref, all four list components accept the same compiler-enforced props contract, and the fourth
list — the one nothing currently mounts — is made uniform with the other three. After this ticket
the app looks and behaves exactly as it does today, and the ladder becomes a small addition rather
than a change spread across five files.

This is the prefactor: make the change easy, then make the easy change.

Three of the lists each own a private ref today and hand it to the tab-change reset hook; the
fourth owns none and mounts its list only when it has books. That difference is the reason two of
the four are silently un-laddered today, and it is what this ticket removes.

The contract (spec §H8), reproduced because the compiler-enforcement is the point:

```ts
export type LadderListProps = {
  /** Owned by the library screen. Serves the ladder AND the tab-change reset. */
  listRef: React.RefObject<LadderList | null>;
  selectedTab: CustomTabs;
  onMomentumScrollEnd: () => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Sectioned views only. */
  onSectionRangesChange?: (ranges: SectionRange[]) => void;
};
```

Adding a field later then fails compilation on every list that has not kept up — **including the
one nothing mounts**. That is what stops the contract drifting away from the fourth list.

For this ticket only, the screen supplies inert settle handlers; ticket 05 replaces them with the
hook's. The two settle props are **required**, not optional, because that is what makes the
compiler do the work.

Spec: H6, H7, H8, H9, I1, I3; user stories 36, 37, 38.

**Blocked by:** 02 (the shared types).

**Status:** ready-for-agent

- [ ] The screen owns exactly one list ref and threads it to whichever list is mounted. Exactly one
      list is mounted at a time and the views stay mutually exclusive.
- [ ] Every list's **internal fallback ref is deleted**. An optional ref with an internal fallback
      fails silently — a caller who forgets it gets a ladder that does nothing and no error, which
      is precisely the state two of the lists are in today.
- [ ] The tab-change scroll reset still works on every view, now driven through the screen-owned
      ref.
- [ ] The tab-change reset stays `animated: false`, and a comment beside it says why: an instant
      programmatic scroll emits **no momentum events**, which is the only reason a tab change does
      not fire a collapse sweep. A future "polish" to `animated: true` would silently start
      collapsing sections on every tab change.
- [ ] The fourth list gains **both** obligations: it accepts the full contract, **and** it mounts
      its list unconditionally, dropping its "only if there are books" guard. Its empty component —
      dead code today — becomes live as a side effect.
- [ ] No `useImperativeHandle` is added to any list component.
- [ ] `onScroll` is **not** part of the contract. The screen's existing scroll handler stays
      exactly as it is, uncomposed — the ladder must never sit in the per-frame path.
- [ ] No header height, per-view constant, or "does this view collapse?" flag enters the contract.
- [ ] A merge callback attaching both an internal and an external ref is **not** used — writing to
      a ref inside a prop-derived callback is the exact shape the React Compiler rejects.
- [ ] Manual check: scrolling, searching, tab switching and view toggling behave identically to
      `main` on all three mountable views.
- [ ] `npm test`, tsc and eslint are green.
