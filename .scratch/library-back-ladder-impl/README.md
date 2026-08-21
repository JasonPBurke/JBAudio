# Library Back Ladder — implementation

Implementation tickets for [`../library-back-ladder/spec.md`](../library-back-ladder/spec.md).

The research effort next door is **closed** (12/12 resolved) and its `issues/` directory holds the
wayfinder tickets the spec links to by number. Implementation is a separate effort with its own
numbering, so those cross-references stay valid.

Read the spec before starting any ticket here. Each ticket names the spec sections it implements;
the spec is the authority, these files are the slicing.

## Progress

The research effort's convention is a `map.md` with a Decisions-so-far list. This effort has no
map — it is slicing, not argument — so ticket outcomes are rolled up here instead. One line per
resolved ticket; the reasoning lives in that ticket's `## Answer`.

Branch: **`feat/library-back-ladder`**, off `main` at `104bd34`.

- **01 — restore the collapse helper** · `resolved` (`20da088`) — `computeRemainingOpen` + its
  five-case suite cherry-picked byte-identical from the parked branch. Its two same-reference cases
  were mutation-tested and shown to be load-bearing: an equivalent `filter()` rewrite passes the
  other three and fails exactly those two, so the suite really does pin React's bail-out. Nothing
  imports the helper yet; ticket 07 wires it up. jest 843 → 848.
- **02 — shared types + `decideBackPress`** · `resolved` (`354413c`) — pure decision module
  `src/helpers/ladderDecisions.ts`, all 17 spec cases under 18 tests, nothing imports it yet.
  Every guard mutation-checked (see the ticket's Answer for the table). **Two contract decisions
  taken here that §J4 does not state:** the parameter is `LadderSnapshot | null` because
  `decline('no-list')` is otherwise unreachable, and the index-0 header degenerates to master via a
  *strictly-between* predicate rather than any special case. Both are spec-amendment candidates — **SETTLED, both adopted**; see *Spec amendments* below.
  Also added the missing `npm test` script (`82ca506`) — it never existed.
  Reviewed (`05e65ea`): the containment bounds had **no** coverage — mutating both to strict left
  the suite green — so `end`'s inclusiveness is now pinned by two boundary tests. ⚠ **Ticket 06's
  range producer must emit an INCLUSIVE `end`**; an exclusive one lands the rung on the previous
  section's header and passes every obvious sanity check. jest 848 → 868.
- **03 — `decideSweep`** · `resolved` — the sweep's five gates in `ladderDecisions.ts`, 18 tests,
  nothing imports it yet. All 11 spec cases plus one the spec did not ask for: the at-top boundary
  had a test on the DECLINING side only, so `>` → `>=` killed nothing while silently meaning the
  sweep never fires at the canonical resting offset. **16 mutations run, all killed.** Ticket 12
  §6.3's "iterate `visible`" was confirmed inert by mutation, not assumed. ⚠ **Three more
  spec-amendment candidates** — **SETTLED, all three adopted**; see *Spec amendments* below (details in the ticket's Answer): the empty-overlap guard is
  deliberately NOT qualified by `ranges.length > 0` (F8's wording would admit the R5 input); an
  unreported drag velocity counts as **flinging**, not settled; a degenerate sample includes an
  **inverted** range, not just `startIndex < 0`. jest 868 → 886.
  Reviewed (two axes, opus): no documented-standard violations and nothing implemented wrongly, but
  the Spec axis found **case 5's test did not bite** — a `{-1,-1}` sample trips the empty-overlap
  guard too, which returns the identical reason, so F8's `startIndex < 0` half was unpinned and the
  mutation table hid it. Split into two tests, one of which uses FlashList's **actual** empty value:
  ⚠ `ConsecutiveNumbers.EMPTY` is `(-1, -2)` — **INVERTED**, so F8's wording describes something
  FlashList never emits. Also extracted `isAtTop` and `overlapsSpan`, now shared with
  `decideBackPress`: I2's exact-complement claim and `end`'s inclusiveness each live in one place.
  jest 886 → 888.

- **04 — one shared list contract** · `resolved` (`7040429` + review commit) — the prefactor. New
  module exporting `LadderList` / `LadderListProps`; the library screen owns the ONE ref and the
  two inert settle handlers; all four lists intersect the contract and every internal fallback ref
  is deleted; `BooksList` mounts unconditionally, so its empty component is live code. **No
  user-visible change on the three mountable views.** jest 888, unchanged — this ticket adds no
  pure code, and **the compiler is the test**: deleting a required prop errors `TS2741` on all
  four lists, `BooksList` included. Verified by probe, not assumed.
  ⚠ **`LadderList = FlashListRef<any>` and the `any` is LOAD-BEARING — do not "fix" it.** Both
  tighter shapes fail `TS2322`: a structural subset interface naming only the methods the ladder
  calls (a ref is checked through its *mutable* `current`, so a subset cannot be passed as a `ref`)
  and any narrower item type including `unknown` (`FlashListRef<T>` is invariant in `T`). Four
  lists, four item types; `any` is the only thing one shared ref can hold.
  Reviewed (two axes, opus): **Spec axis found nothing** — faithful, no scope creep. Standards axis
  found 0 documented violations and 5 judgement calls; 3 adopted (the optional member now states
  why it is optional, four duplicated comments unified, the no-ops moved to module scope), 2
  declined with reasons in the ticket's Answer. ⚠ The notable decline: **do not fold `onScroll`
  into the contract** — §H9 forbids it by name and `LadderListProps` *is* the contract §H9 names.
  It reads as an obvious tidy-up and the spec pre-registers it as forbidden.
  ⚠ **The manual/device check is NOT done** (the one box left unticked) — no device this session.
  The two real behaviour changes both land on `BooksList`, which nothing mounts, so they are
  unreachable by that check anyway; ticket 08 is the device pass.

## Spec amendments — SETTLED 2026-08-21, before ticket 04

The five spec-amendment candidates raised by tickets 02 and 03 were reviewed together and **all
five adopted**; a sixth was surfaced during the review. `spec.md` on the effort next door is
amended in place, each edit marked at the decision it touches, and its header carries the log.
**No code changed** — every amendment describes what tickets 02/03 already built, verified line by
line against `ladderDecisions.ts`; tsc 0, eslint 0, jest 888 unchanged.

| # | Spec | Kind | Ruling |
|---|---|---|---|
| 1 | §B7 | factual correction | The "no layout manager ⇒ `0 > 0`" argument named only the `firstItemOffset` half; the **offset** must read `0` too, and that half is reasoned, not measured. Ordering is a strong guard, not a proof. |
| 2 | §F8 | factual correction | FlashList's empty sample is `ConsecutiveNumbers.EMPTY = (-1, -2)` — **INVERTED**. The originally-worded `startIndex < 0` half catches the real value only incidentally. Both halves kept. |
| 3 | §F8 | adopt the safer default | The `while the range list is non-empty` qualifier is **removed**. It can only admit inputs, and every input it admits is the R5 collapse-everything shape. |
| 4 | §F5 | adopt the safer default | An **unreported** drag velocity counts as flinging, not settled — the errors are asymmetric. Also pins `!(abs(v) < T)` over `>=` for `NaN`. |
| 5 | §J4→J5 | signature widening | `decideBackPress(s: LadderSnapshot \| null)`. Without it `decline('no-list')` is unreachable. Consequence recorded: drawer-open-and-no-list now reports `'no-list'`, not `'drawer'` — unreachable in practice, both decline. |
| 6 | §H4 | contract sharpened | **New.** The range producer owes an INCLUSIVE `end` and NON-OVERLAPPING ranges. Ordering is not required; non-overlap is what makes the rung's first-match containment lookup deterministic. |

**Three handoff holes closed at the same time** — in each case the knowledge existed but not in the
file the implementer opens:

- **Ticket 05** now owns the throw-containment decision explicitly. Ticket 02 declined `try/catch`
  in the pure function and named ticket 05 as the boundary, but nothing in ticket 05 said so. The
  constraint is now written down: if the hook contains the throw, containment must **decline the
  press**, never fall through to a rung.
- **Ticket 06** now carries the INCLUSIVE-`end` trap. It was flagged in this README and in the spec
  but was absent from the ticket itself — the one file that ticket's implementer is guaranteed to
  read.
- **Ticket 08** now checks the **overscroll bounce actually sweeps**. Amendment 4 makes an
  unreported velocity a fling, so if the platform reports nothing for a bounce, F5's accepted
  bounce-sweep silently never happens. This is the only observable that distinguishes the two, and
  nothing was verifying it. A failure there is expected-and-harmless — record it, do not weaken the
  gate.

**A seventh amendment landed 2026-08-21, after ticket 04's review:** **§H8**'s module home. It
read "exported by the ladder hook", written when that hook was assumed to be the only ladder
module. The contract is needed by the four lists *before* the hook exists, and siting it in the
hook would drag React Native imports into `ladderDecisions.ts`'s reach. It now has a module of its
own and the hook imports it. ⚠ **Ticket 05 must import, never re-declare** — the warning is in
ticket 05's own file, not only here.

**Ticket 04 was never blocked by any of this.** It implements §H6–H9/I1/I3 — the shared list
contract — and none of the six touches those. The amendments land on tickets 05 (1, 5), 06 (2, 6)
and 07 (2, 3, 4).
