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
  Also added the missing `npm test` script (`82ca506`) — it never existed. jest 848 → 866.
