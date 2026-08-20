# 09 — How is the ladder shared across four list views with an uncertain future?

Type: grilling
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

**What is the seam between the ladder and the list components, given that which
lists exist is not settled?**

The facts as they stand:

- `BooksHome` (`toggleView 0`), `SeriesHome` (`1`) and `BooksGrid` (`2`) are
  mounted from `src/app/(drawer)/(library)/index.tsx`.
- **`BooksList` is imported by nothing** — verified dead today.
- The driver's position: `BooksList` is *dead but not abandoned*. It may
  **replace** `BooksGrid` (making that one dead instead), or a **4th toggle**
  may ship with all four available. **Design for both.**

Decide:

1. **What each list must expose** for the ladder to drive it — a scroll handle, a
   live offset, and (BooksHome only) expanded-section state. Keep it the same
   contract for all four so adding or swapping a view is not a redesign.
2. **Whether BooksHome's 3-rung ladder and the others' 2-rung ladder are one
   parameterised thing or two.** The temptation is one clever abstraction; the
   alternative is a shared 2-rung base that BooksHome extends. Consult
   `/codebase-design` for the deep-module framing.
3. **Whether `BooksList` gets wired now or is merely kept wireable.** Wiring dead
   code has a cost; leaving it unwired risks the contract drifting away from it.
4. **Whether a 4th toggle changes anything structural** — e.g. two list types
   mounted under different toggles sharing one ladder installation.

This overlaps ticket 02 (where the handler lives) but is a distinct question: 02
decides *ownership and lifecycle*, this decides *the contract and its
future-proofing*. Resolve 02 first if both are on the frontier.

## Input from ticket 02 (resolved 2026-08-18) — read before deciding

Ticket 02 fixed **ownership and direction** and deliberately left this ticket's
four sub-questions open. What is now settled and should not be re-litigated:

- **Direction is screen → list.** The screen owns all ladder state; lists receive
  refs and callbacks as props. No `useImperativeHandle` on any list.
- **One shared `listRef` serves all four lists**, and the hook knows the active
  view from a mirrored `toggleView`.
- **The only thing a list must report upward** is what the FlashList ref cannot
  answer: the `sectionId → index range` map. Offset, visibility and the scroll
  action all come from the ref.
- **Primitives only** — `FlatListItem` must not leave `BooksHome`.

Still yours to decide, and now sharper:

1. **The exact fields** of `sectionRangesRef`. Ticket 02 proposes
   `{ sectionId, start, end }[]` because it answers both queries with pure index
   math; ratify or replace it. Tickets 03/04/05 feed it.
2. **One parameterised ladder or two.** Note **F1**: `activeGridSections`
   persists across `toggleView` (only writer `BooksHome.tsx:195`, nothing clears
   it), so **set size is a stale proxy for "this view has sections"** — the
   capability must come from the view identity, not the data. That kills the most
   tempting version of the "one clever abstraction".
3. **Whether `BooksList` is wired now or kept wireable.** It is the least
   equipped of the four: no `listRef`, no `selectedTab`, no
   `useResetScrollOnTabChange` (`src/components/BooksList.tsx`). Under ticket
   02's answer, wiring it costs one prop.
4. **Whether a 4th toggle changes anything structural.** Ticket 02's shared-ref
   decision holds only while exactly one list is mounted at a time; a split
   tablet layout mounting two would break it, and that is this ticket's call.

## Input from ticket 04 (resolved 2026-08-18)

The collapse sweep needs **no per-view branching and no capability flag in the
list contract.** It is installed uniformly by the ladder hook for all four views,
and where a view has no expandable sections `sectionRangesRef` is empty, so
`computeRemainingOpen` returns the same `Set` reference and React bails out — a
structural no-op, not a guarded one.

Combined with ticket 03's finding that the at-top predicate is view-agnostic
(both operands read from the mounted list's own ref), the shared contract does
**not** need to carry a header height, a per-view constant, or a "does this view
collapse?" capability. A revived `BooksList` or a 4th toggle adds no entry
anywhere.

## Input from ticket 05's prototype (2026-08-18) — a constraint on the list contract

**React Compiler freezes props, so the list cannot write into a screen-owned ref
passed down as a prop.** Ticket 02's seam sketched
`sectionRangesRef` travelling *down* as a prop for `BooksHome` to fill; that is an
eslint error here (`react-compiler/react-compiler`, "mutates a variable that React
considers immutable") even when the write happens inside a `useEffect`.

The prototype on `proto/back-ladder-rung-ab` uses a callback instead —
`onSectionRangesChange?: (ranges: SectionRange[]) => void` — with the screen
storing the result in its own ref. Ownership and direction are exactly as ticket 02
ruled; only the transport changes.

**Specify the contract as a callback.** Note the asymmetry: passing `listRef`
*down* for the child to attach is fine, because that is React attaching to the ref,
not the component writing to a prop. It is only an explicit `propRef.current = x`
that is rejected.

## Input from ticket 06 (resolved 2026-08-18)

**The jump style is settled — `animated: true` — but measured on `BooksHome` only.**
The prototype wired `externalListRef` and the ladder handlers into `BooksHome` alone
(`index.tsx:346–349`); `SeriesHome` (`:355`) and `BooksGrid` (`:365`) got no ref, so back
simply backgrounded the app on those views.

**Expected resolution: assert one jump style for all four views, do not re-check per view.**
The mechanism is list-agnostic — a platform `ObjectAnimator` driving `scrollY` over the
content height for a device-constant ~250 ms — and nothing in it reads the list's item
type, span count, or section structure. `BooksHome` with sections expanded is also the
**worst case** (longest content, therefore the fastest traversal and the highest smear
risk), so a verdict that holds there should hold a fortiori on the shorter views. State
this as an assertion in the shared list contract rather than leaving it implicit.

**This ticket also inherits a simplification, not a burden.** Ticket 06 deleted the
one-shot `pendingSweepRef` from the design along with the instant arm, so the contract
each list must satisfy is now smaller: a ref exposing `scrollToOffset`,
`getAbsoluteLastScrollOffset` and `getFirstItemOffset`, plus `onMomentumScrollEnd` /
`onScrollEndDrag` wiring. No arrival flag, no per-list arrival machinery.

## Answer

**The seam is one exported type, one named identity, and one capability gate.**
Resolved 2026-08-20 by grilling session with the driver. All four sub-questions
answered, plus two the ticket did not anticipate (push timing, ref transport).

### D1 — The ladder is told a NAMED view, never an ordinal

```ts
export type LadderView =
  | 'booksHome' | 'seriesHome' | 'booksGrid' | 'booksList';
```

The screen maps its own state to that name at the mount site; the hook mirrors it
into `viewRef` like every other input (ticket 02 decision 3).

`toggleView`'s `0/1/2` is a **UI toggle position, not a view identity**. It is
`useState(0)` at `index.tsx:50`, persisted nowhere, and its ordinals are already
hardcoded in two places (`Header.tsx:188/198/206`, `index.tsx:337/352/361`). Both
futures this ticket exists for — `BooksList` replacing `BooksGrid`, or joining as a
4th toggle — are exactly the changes that renumber positions. The prototype's
`toggleViewRef.current === 0` (`useBackToTopLadderPrototype.ts:172`) would survive
both by luck. A name survives by construction, and the ladder stops being a third
site that knows the ordinals.

### D2 — ONE parameterised ladder, gated by capability derived from D1's identity

```ts
const SECTIONED_VIEWS = new Set<LadderView>(['booksHome']);
```

That set gates **the intermediate rung AND the collapse sweep**. The 2-rung ladder
is the same ladder with the gate closed — not a base class, not a second hook. In
deep-module terms: one module with a narrow interface (`view` in, two handlers out),
rather than two shallow ones that would each re-implement ticket 03's at-top
predicate.

Ticket 02's **F1** rules out deriving the capability from data (`activeGridSections`
persists across `toggleView`, so set size is a stale proxy). D1's identity is the
only sound source.

> ⚠ **This CORRECTS the "Input from ticket 04" block above.** Ticket 04's *decision*
> (collapse strictly after settle; Recents survives by position) is untouched. Its
> *argument for uniform installation* does not survive tracing — see F1 below.

### D3 — `SectionRange` ratified unchanged

```ts
export type SectionRange = {
  sectionId: string;
  /** index of the section's header item */
  start: number;
  /** index of the section's last item, INCLUSIVE */
  end: number;
};
```

Both consumers are pure index math and neither needs a pixel, which is what makes
one contract serve four differently-laid-out lists:

- sweep asks **overlap** — `r.start <= endIndex && r.end >= startIndex`
- rung asks **containment** — `startIndex >= r.start && startIndex <= r.end`, then
  `getLayout(r.start).y`

`end` is strictly derivable (BooksHome's builder tiles `flatData` exhaustively —
ticket 04 verified `flatData[0]` is always the Recents header, so there is no
pre-header gap, and `end[i] === start[i+1] - 1`). It is stored anyway as a
**deliberate redundancy**, so the contract does not depend on that tiling invariant
holding forever.

Rejected: adding `expanded: boolean`. It would duplicate `activeGridSections` into a
second source of truth while the sweep still needs `setActiveGridSections` anyway, so
the state does not actually leave.

### D4 — Ranges are pushed BEFORE PAINT, and that is a contract requirement

```ts
useLayoutEffect(() => {
  onSectionRangesChange?.(sectionRanges);
}, [sectionRanges, onSectionRangesChange]);
```

Stated in the spec as a requirement, not left as an implementation detail, so a
later edit cannot quietly downgrade it.

**Why.** The ladder reads index information from two independent clocks at press
time: FlashList's own (`computeVisibleIndices()`, `getLayout(i)`), updated inside its
commit and therefore on screen by the time the user sees the rows; and
`sectionRangesRef`, updated whenever `onSectionRangesChange` fires. The prototype
pushes from a **passive** `useEffect` (`BooksHome.tsx:227-230`), which React flushes
*after* paint — so there is a window where new rows are visible but the ranges still
describe the previous array.

The trigger is not a section tap (nobody taps then presses back within a frame) — it
is `sortedAuthors` changing under the user, i.e. `library.tsx`'s `observeWithColumns`
firing mid-scan.

**Worked failure.** `activeGridSections = {'Adams, Douglas'}`, viewport top on index 7,
genuinely inside the expanded Adams section — the exact configuration the rung exists
for. A scan adds author *Abercrombie, Joe*, which sorts before Adams and inserts 2
items at index 2 (a collapsed section is exactly `header` + `horizontalRow`,
`BooksHome.tsx:156-161`). MVCP inserts above the anchor, so it `scrollBy`s to hold
content still — **the user sees nothing move**.

| | fresh ranges (D4) | stale ranges (passive effect) |
|---|---|---|
| `startIndex` | 7 | 7 |
| range containing 7 | `{Adams, 4, 10}` | `{Adams, 2, 8}` — stale, but 7 ∈ [2,8] |
| `expanded.has(id)` | ✅ true | ✅ true — **right section id** |
| `getLayout(start).y` | Adams header | **Abercrombie header** — wrong row |
| `offset - y > EPS` | ✅ | ✅ — no guard trips |
| lands on | Adams header ✓ | a section the user was never in ✗ |

The stale range resolves to the **correct section id**, so every sanity check one
would think to write passes. Only `start` is wrong, and `getLayout` returns a real,
plausible `y` for it. It fails silently and reads as a jump bug, not a staleness bug.

The window and the trigger are **positively correlated, not independent**: the window
is widest when the JS thread is busy, which is exactly when `sortedAuthors` churns.
The fix costs nothing — `sectionRanges` is already computed during render by the memo
at `BooksHome.tsx:199`; `useLayoutEffect` only moves *when the single ref assignment
happens*. Precedent exists at `useNavigationSearch.tsx:25`.

The **sweep** is far less exposed than the rung: it only runs at offset 0 where
`startIndex ≈ 0` and stale-vs-fresh ranges mostly agree on a tiny index window. It is
the rung — which reads a *specific* `start` and turns it into a pixel — that converts
staleness into a visible wrong landing.

### D5 — `listRef` is a REQUIRED prop; internal fallback refs are deleted

All four take it and use it for **both** `ref={listRef}` and
`useResetScrollOnTabChange(listRef, selectedTab)`. The prototype's
`externalListRef ?? internalListRef` merge (`BooksHome.tsx:81-84`) is removed.

`index.tsx` is the **only importer of all four** — `BooksGrid`'s `standAlone` prop is
set `true` at its single call site (`index.tsx:365`), and `BooksList` is imported by
nothing. There is no second mounting context whose unwired mode needs preserving, and
an optional fallback's failure mode is silent: a caller who forgets the prop gets a
ladder that does nothing and no error — precisely the state `SeriesHome` and
`BooksGrid` are in today.

Rejected: a merge callback attaching both an internal and an external ref. Writing
`ladderRef.current = node` inside a prop-derived callback is the exact React Compiler
shape ticket 05's N6 found is rejected.

### D6 — `BooksList` is converted to be UNIFORM with the other three

Two obligations, not one. The spec requires the implementation effort to:

1. Accept the contract — `listRef` (required, D5), `selectedTab` +
   `useResetScrollOnTabChange`, `onMomentumScrollEnd`, `onScrollEndDrag`.
2. **Mount its `<FlashList>` unconditionally**, dropping the
   `{bookIds.length > 0 && …}` guard at `BooksList.tsx:60`.

`BooksHome.tsx:335`, `SeriesHome.tsx:116` and `BooksGrid.tsx:145` all mount their
list unconditionally with a live `ListEmptyComponent`; `BooksList` is the sole
outlier. Today it therefore satisfies ticket 03's empty-list requirement by a
**different mechanism** — `listRef.current === null` hitting the ladder's `if (!list)
return false` guard, rather than the empty list reporting `firstItemOffset` forever
and being excluded by `getFirstItemOffset()`. Same outcome, different path. Driver's
ruling: same mechanism as the other three. Its `ListEmptyComponent` — unreachable
dead code today — becomes live as a side effect.

Wiring it does not *prove* anything (nothing mounts it), but it makes the diff to
revive it **zero**, which is what this ticket was asked to guarantee. Under the
driver's likelier future (see the scope note below) it is not dead code at all.

### D7 — One-list-at-a-time is a load-bearing INVARIANT; the shared ref stands

> **Invariant.** Exactly one list component is mounted at a time. The ladder's single
> shared `listRef` depends on it. Mutual exclusion by `toggleView` *or* by a
> sub-toggle both satisfy it. A layout mounting two lists (e.g. a tablet split)
> invalidates the ladder and requires redesign — it is not a drop-in change.

Today this holds structurally: `{toggleView === n && <View/>}` at
`index.tsx:337/352/361`. It survives a view switch because refs of a deleted tree are
detached in React's **mutation** phase and new refs attached in the **layout** phase,
so *all* detaches finish before *any* attach — `listRef.current` goes old → `null` →
new inside one commit with no JS interleaved, and the ladder can never observe the
`null` (**F5**).

Rejected: a `Record<LadderView, RefObject>` and a focused-list registry. Neither
candidate future mounts two lists, so both buy nothing today, and neither answers the
question a split layout actually poses — *which pane does back act on?* That is a
product question, so pre-building the plumbing is not a head start.

### D8 — The contract is a NAMED SHARED TYPE, tsc-enforced

Exported from the ladder hook (it is the ladder's contract), intersected by all four
props types:

```ts
export type LadderListProps = {
  /** Owned by LibraryScreen. Serves the ladder AND the tab-change reset. */
  listRef: React.RefObject<LadderList | null>;
  selectedTab: CustomTabs;
  onMomentumScrollEnd: () => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Sectioned views only — see D2. */
  onSectionRangesChange?: (ranges: SectionRange[]) => void;
};

type BookGridProps = LadderListProps & { authors: Author[]; /* … */ };
```

This is what answers the ticket's own stated risk — *"leaving it unwired risks the
contract drifting away from it."* D6 makes `BooksList` conform once; D8 is what keeps
it conforming. Adding a field to the contract fails compilation on every list that
has not kept up, **including the one nothing mounts**.

Note what is **not** in the contract, per ticket 04 and ticket 03: no header height,
no per-view constant, no "does this view collapse?" flag. Capability comes from D1's
identity at the hook, never from a prop.

### The contract in full

| Member | Who | Notes |
|---|---|---|
| `listRef` | all four | required (D5); also drives `useResetScrollOnTabChange` |
| `selectedTab` | all four | `BooksList` gains it (D6) |
| `onMomentumScrollEnd` | all four | sweep trigger #1, and the animated jump's own arrival event (ticket 04 F3) |
| `onScrollEndDrag` | all four | sweep trigger #2, velocity-gated |
| `onSectionRangesChange` | sectioned views only | callback, not a prop ref (ticket 05 N6); fires in a **layout** effect (D4) |
| `onScroll` | **not the ladder's** | see F3 — stays the screen's existing `useScrollDirection` wiring, uncomposed |

---

## Findings

**F1 — Ticket 04's argument for uniform sweep installation fails on BOTH halves.
The bug is latent today and is ARMED by wiring views 1–3, which is what this ticket
decides.**

The "Input from ticket 04" block above states the sweep needs no per-view branching
because *"where a view has no expandable sections `sectionRangesRef` is empty, so
`computeRemainingOpen` returns the same `Set` reference, React bails out — a
structural no-op."*

- *The ref is never emptied.* `BooksHome`'s push effect (`BooksHome.tsx:227-230`) has
  no cleanup and `handleSectionRanges` (`index.tsx:111-113`) only ever assigns.
  Toggle away and `sectionRangesRef` keeps BooksHome's ranges. `activeGridSections`
  likewise — its only writers are `BooksHome.tsx:246` and the sweep itself (ticket 02
  F1, re-confirmed).
- *Empty would not be safe anyway.* `computeRemainingOpen` iterates **`open`**, not
  `visible` (`collapseOffscreenSections.ts:20`). With `open` non-empty and `visible`
  empty, every id fails both `continue`s, `toRemove` fills, and it returns a **new,
  smaller Set**. An empty `sectionRangesRef` is a **collapse-everything**, not a
  no-op. The bail-out fires only when `open` is empty or fully covered.

Failure once `SeriesHome` is wired:

```
expand Author A + Author B on BooksHome
  → toggle to SeriesHome   (activeGridSections={A,B}, ranges=BooksHome's — both stale)
  → scroll SeriesHome, land at top → onMomentumScrollEnd → sweepIfAtTop
  → visible = overlap(BooksHome's index ranges, SeriesHome's visible indices)  ← garbage
  → computeRemainingOpen({A,B}, garbage, null)
  → the user's BooksHome expansions silently collapse while they look at Series
```

The prototype never exhibited this because `SeriesHome` (`index.tsx:352`) and
`BooksGrid` (`index.tsx:361`) received **no ladder props at all**. **D2's gate closes
it**; D1's named identity closes the rung half independently.

**F2 — Charting decision 4 currently rests on one word in a file unrelated to the
ladder. Make it a named invariant.**

Decision 4 says the sweep must not fire on the `useResetScrollOnTabChange` reset.
That is honoured *for free*: the reset uses `scrollToOffset({offset: 0, animated:
false})` (`useResetScrollOnTabChange.ts:31`), and ticket 04 F3 established that
`animated: false` emits **no momentum events at all**; ticket 06 then deleted
`pendingSweepRef`, removing the only other arrival path. So a future "polish" of that
one call to `animated: true` would silently start firing a collapse sweep on every
tab change — violating a charting decision with a one-word edit. State it as an
invariant beside that hook's existing `requestAnimationFrame` warning.

The same reasoning covers the density sub-toggle and any view swap: a mount emits no
momentum event, and `useResetScrollOnTabChange`'s `isFirstTabRender` guard is
per-instance, so a fresh component skips its reset. Both fall out correctly with no
new rule.

**F3 — The ladder contributes NO `onScroll`; the prototype's handler composition
disappears.**

`index.tsx:123-128` composes `handleScroll = onScroll(e) + ladderOnScroll()`, but
`ladderOnScroll` exists solely to consume `pendingSweepRef` — which ticket 06 deleted
along with the instant arm. `handleScroll` collapses back to the plain `onScroll` the
screen already had for `useScrollDirection`'s search-bar show/hide. Consequence worth
stating: **the ladder never sits in the per-frame path**, only on settle events.

**F4 — `firstItemOffset` differs across the driver's likelier future, vindicating
ticket 03's live read.**

Ticket 03's measured table (`03-define-at-the-top.md:193-198`): BooksHome **38**,
SeriesHome **38**, BooksGrid **44**, BooksList **50**. A density sub-toggle inside
`toggleView 2` would swap **44 ↔ 50 under one toggle position**. Ticket 03 reads
`getFirstItemOffset()` live from the mounted ref, so this is free; its F3 warned a
fixed epsilon *"would silently under-cover `BooksList` at 50"*. Under that shape the
warning becomes concrete: a hardcoded `44` leaves the ladder **armed at visual top**
on the compact view, so back would never background the app there — only on the grid.
A density-dependent bug that would read as haunted.

**F5 — Ref detach-before-attach is what makes the single shared ref safe.** See D7.

---

## Scope note — the driver's likelier future for `BooksList`

Raised during this session and recorded so a later reader is not surprised: rather
than a 4th toggle, the driver expects a **sub-toggle inside `toggleView 2`** flipping
between `BooksGrid` and `BooksList` — *"both these views display the same data in the
same organizational structure and only differ in how compact the data is for
display."*

**That shape changes nothing structural**, and it is why D6 and D5 are the right
calls rather than merely defensible ones:

- One list is still mounted at a time, so **D7's invariant holds** — mutual exclusion
  by a sub-toggle satisfies it exactly as `toggleView` does.
- **Identity becomes a function of two state values**, which is one line at the mount
  site and invisible to the ladder, because the only thing identity feeds is
  `SECTIONED_VIEWS` and neither grid nor list is sectioned:

  ```ts
  const view: LadderView =
    toggleView === 2
      ? (density === 'grid' ? 'booksGrid' : 'booksList')
      : LADDER_VIEW[toggleView];
  ```

- The arm predicate changes value across the swap (44 → 50) and is already handled —
  **F4**.
- **D6 stops being "wiring dead code"**: under this shape `BooksList` ships.
- **D5 matters more**: two components under one toggle is exactly where a silent
  unwired fallback bites, and the symptom would be density-dependent.

The ladder imposes **no constraint** on whether the density swap preserves scroll
position. Building the sub-toggle is out of this map's scope (see the map's
*Out of scope*).
