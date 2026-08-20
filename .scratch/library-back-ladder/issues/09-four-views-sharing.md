# 09 — How is the ladder shared across four list views with an uncertain future?

Type: grilling
Status: open
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
