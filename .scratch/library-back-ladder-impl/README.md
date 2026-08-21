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
