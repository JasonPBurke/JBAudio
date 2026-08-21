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

**Status:** resolved

- [x] The screen owns exactly one list ref and threads it to whichever list is mounted. Exactly one
      list is mounted at a time and the views stay mutually exclusive.
- [x] Every list's **internal fallback ref is deleted**. An optional ref with an internal fallback
      fails silently — a caller who forgets it gets a ladder that does nothing and no error, which
      is precisely the state two of the lists are in today.
- [x] The tab-change scroll reset still works on every view, now driven through the screen-owned
      ref.
- [x] The tab-change reset stays `animated: false`, and a comment beside it says why: an instant
      programmatic scroll emits **no momentum events**, which is the only reason a tab change does
      not fire a collapse sweep. A future "polish" to `animated: true` would silently start
      collapsing sections on every tab change.
- [x] The fourth list gains **both** obligations: it accepts the full contract, **and** it mounts
      its list unconditionally, dropping its "only if there are books" guard. Its empty component —
      dead code today — becomes live as a side effect.
- [x] No `useImperativeHandle` is added to any list component.
- [x] `onScroll` is **not** part of the contract. The screen's existing scroll handler stays
      exactly as it is, uncomposed — the ladder must never sit in the per-frame path.
- [x] No header height, per-view constant, or "does this view collapse?" flag enters the contract.
- [x] A merge callback attaching both an internal and an external ref is **not** used — writing to
      a ref inside a prop-derived callback is the exact shape the React Compiler rejects.
- [ ] Manual check: scrolling, searching, tab switching and view toggling behave identically to
      `main` on all three mountable views.
- [x] `npm test`, tsc and eslint are green.

## Answer

**Resolved.** Commits `7040429` (implementation) and this one (review disposition). tsc 0,
eslint 0 errors — 38 warnings, byte-identical to the pre-change baseline, measured by stashing —
jest **888/888 across 68 suites, unchanged**, because this ticket adds no pure code and this repo
has no component or hook tests: jest here is jsdom with no React Native preset. **For this ticket
the compiler IS the test**, which is exactly what §H8 designs for.

### What shipped

`src/types/ladderList.ts` exports `LadderList` and `LadderListProps`. The library screen owns the
one ref and the two (inert) settle handlers; `BooksHome`, `SeriesHome`, `BooksGrid` and `BooksList`
all intersect the contract; every internal fallback ref is gone; `BooksList` mounts
unconditionally.

**The enforcement was verified by probe, not assumed.** Deleting each required prop from a call
site errors `TS2741` on all four lists — including `BooksList`, which nothing mounts. The optional
`onMomentumScrollEnd?` that the lists inherit from `Partial<FlashListProps<T>>` does **not** weaken
the required one; the intersection keeps the required member.

### The one decision the ticket did not make for us: what `LadderList` IS

⚠ **`LadderList = FlashListRef<any>`, and the `any` is load-bearing — do not "fix" it.** Two
tighter shapes were tried in a throwaway probe and BOTH are rejected by tsc with `TS2322`:

1. **A structural subset interface** naming only the methods the ladder calls (`scrollToOffset`,
   `getFirstItemOffset`, `getAbsoluteLastScrollOffset`, `computeVisibleIndices`, `getLayout`,
   `prepareForLayoutAnimationRender`) — the obvious "narrow interface" answer, and wrong. A ref is
   checked through its **mutable `current`**, so a subset cannot be handed to
   `<FlashList<Item> ref={...}>` even though every member matches.
2. **Any narrower item type**, including `unknown`. `FlashListRef<T>` is **invariant** in `T`: it
   appears in `props: RecyclerViewProps<T>` (covariant `data`, contravariant `renderItem`) and in
   `scrollToItem`.

The four lists carry four different item types (`FlatListItem`, `DerivedSeries`, `string`,
`string`), so `any` is the only parameterisation one shared ref can hold for all four. The
spec-axis reviewer re-ran the `unknown` case independently and got the same failure.

### Deviation from §H8, now amended into the spec

§H8 said the contract is "exported by the ladder hook". That hook is ticket 05 and does not exist;
creating a hook file containing no hook to satisfy the wording would have been worse. The contract
has **a module of its own** instead, which also keeps `ladderDecisions.ts` — the pure,
jest-testable decision unit — free of React Native imports. **§H8 is amended in place** (the
spec's seventh amendment) and ⚠ **ticket 05 now carries the warning in its own file: import the
type, never re-declare or re-export it.** Two copies drifting apart is the precise failure §H8
exists to prevent.

### Review — two axes (mattpocock code-review, opus), fixed point `c6b76ed`

**Spec axis: faithful.** No missing requirement, no scope creep, nothing implemented wrongly;
every checklist box verified individually against the code. It raised the §H8 module-home
amendment above.

**Standards axis: 0 documented-standard violations, 5 judgement calls.** Three adopted, two
declined:

| # | Finding | Disposition |
|---|---|---|
| 1 | `LadderList` names a ref *handle*, not a list — rename to `LadderListHandle` | **Declined.** Honest criticism, but `LadderList` is the spec's own name in the §H8 block and ticket 05 is written against it. Recorded in the §H8 amendment so the mismatch is deliberate rather than an oversight. |
| 2 | `onSectionRangesChange?` being optional contradicts the docblock's "required is what makes the compiler do the work" | **Adopted in part.** The optionality is spec-mandated (§H8, "Sectioned views only"), but the contradiction was real *as written*. The field now carries its own reason: only `booksHome` has sections (§H2), so requiring it would force three views to accept a callback they can never fire. |
| 3 | Fold the repeated `onScroll?` / `ListHeaderComponent?` declarations into the shared type | **Declined, firmly.** §H9: "**no `onScroll`**… the ladder never sits in the per-frame path", and this ticket's own checklist says `onScroll` is not part of the contract. The reviewer read §H9 as excluding `onScroll` from the ladder's *wiring* rather than from the *type*, but `LadderListProps` **is** the contract §H9 names. This is exactly the tidy-looking change the spec pre-registers as forbidden. (`ListHeaderComponent` is not even uniform across the four — `SeriesHome` calls it `ListHeaderSpacer`.) |
| 4 | The same rationale comment restated four times, one gratuitously reworded | **Adopted.** All four lists now carry one identical two-line comment. |
| 5 | Two zero-dependency no-ops belong at module scope, per this file's own rule ("move outside component to avoid recreation") | **Adopted.** They are a module-scope `NO_OP` now instead of two `useCallback`s. |

### Still open

⚠ **The manual check is NOT done** — the last unticked box. Scrolling, searching, tab switching and
view toggling have not been exercised against `main` on a device or emulator; this was an
agent session with no device attached. Two behaviour changes are real and unverified, both on
`BooksList`, which nothing mounts today, so neither is reachable by that manual check:
its list now mounts with zero books (showing "No books found" where the whole view used to be
blank), and it gains a tab-change scroll reset it never had. The three mountable views take the
same code paths as before with the same ref timing, so the expectation is genuinely "identical to
`main`" — but expectation is not evidence, and ticket 08 is the device pass.
