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
  *strictly-between* predicate rather than any special case. Both are spec-amendment candidates.
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
  spec-amendment candidates** (details in the ticket's Answer): the empty-overlap guard is
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
