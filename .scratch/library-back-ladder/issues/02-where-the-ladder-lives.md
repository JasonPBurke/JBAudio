# 02 — Where does the ladder live, and how does it survive `toggleView`?

Type: grilling
Status: resolved
Blocked by: 01
Resolved: 2026-08-18 — grilling session (HITL), driver-approved. See Answer.
Parent: [map.md](../map.md)

## Question

**Which component owns the back handler and the ladder state, and how does it
address whichever list is currently mounted?**

The library screen mounts exactly one list at a time, chosen by `toggleView`
(`0` BooksHome, `1` SeriesHome, `2` BooksGrid), and each list owns its own
`FlashList` ref internally. The handler needs three things the lists currently
keep private: the **live scroll offset**, a **`scrollToOffset` handle**, and —
for BooksHome only — the **expanded-section state and viewability set**.

Candidate shapes to weigh:

- **Screen-level owner.** `index.tsx` installs one back handler and delegates to
  the active list through a ref/imperative handle each list exposes. One handler,
  one lifecycle, naturally correct across `toggleView` switches. Costs a new
  imperative surface on four components.
- **Per-list hook.** Each list installs its own handler (the shape
  `useResetScrollOnTabChange` already establishes). Keeps offset and refs local,
  but means four registrations, and correctness depends on only one list being
  mounted at a time — which is true today and is exactly the kind of assumption
  the 4th-toggle future could break.
- **Shared hook, screen-installed.** A `useBackToTopLadder` hook installed once
  in `index.tsx`, fed by whatever the active list reports upward.

Decide the shape, and decide **where the live scroll offset comes from**:
`useScrollDirection` already receives every `onScroll` event at
`scrollEventThrottle={16}` and tracks `previousScrollY` in a ref, so the value
exists but is not exposed. Extending it vs adding a parallel tracker is part of
this decision.

Also settle: **does the ladder's behaviour differ per list?** BooksGrid,
BooksList and SeriesHome have no expanded sections, so they are a 2-rung ladder;
BooksHome has 3. Whether that is one parameterised ladder or two is a
codebase-design call — consult `/codebase-design`.

## Input from ticket 01 (resolved 2026-08-18) — read before deciding

The mechanism is settled: **`BackHandler.addEventListener('hardwareBackPress', …)`
inside React Navigation's `useFocusEffect`.** Not expo-router, not native. That
constrains this ticket rather than leaving it open.

**RISK 1 (HIGH) lands squarely here.** `BackHandler` dispatches strict **LIFO by
registration time**. The drawer registers its own close-handler **only while it is
open**, deliberately late, so LIFO normally puts the drawer first — but *re-registering
the ladder's handler while the drawer is open would jump it above the drawer's*, and
back would scroll the list instead of closing the drawer.

Ticket 01's mandate, which this ticket should adopt unless it can show better:

- **Empty dep array** on the `useFocusEffect` — every input (scroll offset, expanded
  sections, visible set) reaches the handler **through refs**, never through deps.
- **AND** an explicit `useDrawerStatus() === 'open'` guard that declines the press.

Both, not either. **Do not rely on LIFO alone.** This is the deciding constraint on the
ownership question: a design where the handler's identity or deps change with state is
disqualified, which argues strongly for a single screen-level installation over
per-list registration.

Also settled and not to be re-derived: with the drawer closed there is **no competing
JS listener at all** (expo-router's `useBackButton` registers at container mount, so
LIFO puts it last), and nothing native intercepts on this stack.

## Answer

**Resolved 2026-08-18** (grilling session, driver-approved).

### Headline

**One screen-installed hook — `useBackToTopLadder`, called in `LibraryScreen`
(`src/app/(drawer)/(library)/index.tsx`). The screen owns every piece of ladder
state; the lists receive refs and callbacks as props. No `useImperativeHandle` on
any list component.**

The ticket's three candidate shapes were all displaced by a fourth that the
existing code already establishes: `onScroll` and `activeGridSections` are
*already* screen-owned and passed down. A `listRef` passed down is the same
shape, and `useResetScrollOnTabChange(listRef, selectedTab)` already takes the
ref as a parameter rather than creating it — so nothing has to change about how
the lists consume it.

The call site is close to forced: the hook must return handlers
(`onMomentumScrollEnd`, `onScrollEndDrag`) for the screen to thread into the
lists, and a null-rendering `<LibraryBackLadder/>` child cannot hand values back
upward without introducing a context.

### The six decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **Screen owns all ladder state; refs prop-down.** | Matches the pattern `onScroll` / `activeGridSections` already establish. Every input is a ref, so RISK 1's empty dep array is the *natural* shape rather than a discipline to maintain. |
| 2 | **One shared `listRef` for all four lists; `toggleView` passed as a plain value and mirrored inside the hook.** | Safe because exactly one list mounts at a time — React detaches a deleted component's refs in the mutation phase before attaching new ones in the layout phase, so the ref lands on the newly-mounted list. A 4th toggle is one more branch writing the same ref. |
| 3 | **The hook mirrors EVERY input into refs internally.** | Callers pass ordinary values; the hook itself guarantees the empty-dep `useFocusEffect`. The mandate is enforced by the module, not by call-site discipline that a future edit can quietly break. |
| 4 | **Offset and visibility are read synchronously from `listRef.current` at press time — not tracked.** | See "The FlashList ref finding" below. Deletes an entire class of staleness bug. |
| 5 | **The drawer guard lives inside the hook**: it calls `useDrawerStatus()` itself, mirrors it, and declines when open. | RISK 1 mandates the guard; owning it internally means it cannot be forgotten. The hook becomes a self-contained safety unit. Ties it to a drawer navigator — which charting decision 5 already accepts. |
| 6 | **The collapse sweep lives in the hook**, which returns `onMomentumScrollEnd` / `onScrollEndDrag` for the screen to thread down. | Charting decision 4 states the sweep as a *single* rule ("any user-driven arrival at the top"). A rule stated once should be implemented once — otherwise ticket 04's sequencing ruling has to be applied in two files and can drift. |

### The FlashList ref finding (revises this ticket's premise)

FlashList 2.3.2's ref is materially richer than the ticket assumed. Verified in
source, not just in the `.d.ts`:

- **`getAbsoluteLastScrollOffset()`** — `engagedIndicesTracker.scrollOffset +
  firstItemOffset` (`node_modules/@shopify/flash-list/src/recyclerview/RecyclerViewManager.ts:198`).
  A plain **synchronous field read**.
- **`computeVisibleIndices()` → `{startIndex, endIndex}`**, **`getFirstVisibleIndex()`**,
  **`getLayout(index)`** — synchronous visibility, no `onViewableItemsChanged` needed.
- **`scrollToTop({animated})`** — the ladder's action, with no offset math.
- **`getFirstItemOffset()`** — the spacer-header offset (→ ticket 03).
- **`recomputeViewableItems()`** — force a viewability recalc after a mutation
  that did not scroll (→ ticket 04).

The decisive property is that this offset is **per-list-instance state**, which
kills the bug described in F2 below.

**Ticket 01's RISK 2** said the predicate must be synchronously readable from a
ref and that a `scrollYRef` fed by `onScroll` was "nearly free". That remains
true, but is now **superseded**: the list itself answers synchronously, so the
ladder tracks nothing.

**Honest limit:** the implementation was read (a synchronous field read is
verified); freshness at press time under New Architecture was **not** observed.
Carried to ticket 11 as DT-6.

### The seam, concretely

```
useBackToTopLadder({ listRef, toggleView, sectionRangesRef,
                     activeGridSections, setActiveGridSections })
  -> { onMomentumScrollEnd, onScrollEndDrag }

reads at press time:  listRef.current.getAbsoluteLastScrollOffset()
                      listRef.current.computeVisibleIndices()
acts:                 listRef.current.scrollToTop({ animated })
guards:               drawerStatusRef.current === 'open'  -> return false
```

The mounted list fills **`sectionRangesRef`** with `{ sectionId, start, end }[]`,
derived from the `flatData` `useMemo` `BooksHome` already builds. That is the
*only* thing the FlashList ref cannot answer, because it needs `flatData`. It
serves both queries with pure index math:

- **which sections are off-screen** — range does not overlap `computeVisibleIndices()`
- **is a section's header above the fold** — `range.start < visible.startIndex`

`FlatListItem` never leaves `BooksHome`. The parked branch's
`computeRemainingOpen()` (`src/helpers/collapseOffscreenSections.ts` on
`fix/collapse-offscreen-lists-onMomentumScrollEnd`) survives **intact** as the
pure core — it already takes list-agnostic `Set<string>`s. Its BooksHome-side
*wiring* moves into the hook rather than being reused.

**Exact field list is ticket 09's call**, not this ticket's — 02 fixes ownership
and direction (screen-owned ref, list writes into it, primitives only), 09 fixes
the contract and its future-proofing.

### Findings recorded

- **F1 — `activeGridSections` persists across `toggleView`.** Its only writer is
  `BooksHome`'s `handleSectionPress` (`src/components/BooksHome.tsx:195`);
  nothing clears it on view or tab change. Expand sections in BooksHome, toggle
  to BooksGrid, and the set is still non-empty while a list with no sections is
  mounted. **The ladder must never infer "this view has expandable sections"
  from `activeGridSections.size > 0`.** This is why the hook needs `toggleView`.
- **F2 — a screen-tracked `scrollYRef` would go stale across `toggleView`.**
  Toggle from a scrolled BooksHome to BooksGrid: the old list unmounts, the new
  one mounts fresh at offset 0, and **no scroll event fires**. A tracked ref
  would still read e.g. 3000, so the first back press would consume itself and
  scroll an already-at-top list to the top — **nothing visible happens and the
  app does not background.** That is charting decision 6's failure mode (no
  toast; the jump *is* the feedback) with no jump. Recorded so tracking is not
  reintroduced. Decision 4 makes it unreachable.
- **F3 — section-visibility ≠ header-above-fold.** The parked branch's set is
  keyed by `sectionId` from *any* item, which answers "is this section on screen"
  — enough for the sweep, insufficient for charting decision 3's intermediate
  rung, which needs a **signed** answer (a non-viewable header may be *below* the
  fold). The index-range shape gives the signed test without pixel math.
- **F4 — the formSheet-blur fog item is sharpened (see map).** All modal routes
  (`player`, `titleDetails`, `seriesDetail` as `formSheet`; `coverArtSearch`,
  `editTitleDetails`, `chapterList`, `footprintList`, `seriesEditor` as
  `transparentModal`) are declared in `src/app/_layout.tsx` as **siblings of
  `(drawer)` on the ROOT stack**. Pushing one blurs `(drawer)`, which propagates
  down through `(library)` to `index`, so `useFocusEffect`'s cleanup removes the
  handler. React Navigation focus is state-based, and an ancestor blur is
  unambiguous here. **No longer a design question** — it becomes device test
  DT-7 on ticket 11.
- **F5 — `useScrollDirection` is untouched by this feature.** It has exactly one
  call site (`index.tsx:47`) and every list forwards `onScroll` to FlashList
  unchanged. Decision 4 means the ladder adds no scroll handler at all, so the
  chrome-visibility hook keeps its single purpose.

### Explicitly NOT decided here (ticket 09's question)

Whether BooksHome's 3-rung ladder and the others' 2-rung ladder are one
parameterised thing or two; the exact fields of the list contract; whether
`BooksList` is wired now or merely kept wireable; and whether a 4th toggle
changes anything structural. Ticket 09 owns all four. This answer constrains 09
only by fixing ownership and direction, not the contract.
