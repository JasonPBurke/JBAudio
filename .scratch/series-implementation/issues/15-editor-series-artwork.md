# 15 — Series artwork: pin one, or fall back to the first book's

**Blocked by:** [12](12-editor-one-root-route.md).

**Status:** ready-for-agent

**Spec:** [§D6, D7, D10](../../series-ux-redesign/spec.md), §C8, §K6, §K8.

## What to build

A series can carry its **own** cover rather than always borrowing its first book's — found
by searching the web, and revertible in one press.

Closes user stories 48–50.

## Where it lives and why

A pressable cover with an add-image badge **beside the name field**, mirroring the book
editor — the app's only entry point to cover-art search. The **book artwork replacement
helper generalises to serve books and series**; it is not duplicated.

Siting it in the editor is deliberate: `Sort by number` silently changes a derived cover
(D10), so the override sits exactly where the user watches that happen.

## The caption does three jobs in one element

| State | Caption |
| --- | --- |
| artwork is null | muted, non-interactive — *Using first book's cover* |
| artwork is set | pressable — *Use first book's cover instead* → nulls the column |

**Words rather than a pin badge**, on the same division as the wrench: a badge tells you the
state and gives you nothing to press, so reverting would need a second, undiscoverable
affordance.

## Acceptance criteria

- [ ] A pressable series cover with an add-image badge sits beside the name field and opens
      the existing cover-art search.
- [ ] The existing book-artwork replacement helper is **generalised**, not copied.
- [ ] The caption renders both states and the "set" state reverts to derived in one press.
- [ ] **K6 — artwork replacement unlinks the old file BEFORE the DB write.** So a deferred
      transaction is incoherent — the old cover is already gone — and **the confirmation
      must come BEFORE applying**, not as a notice afterwards. Immediate-write is kept.
- [ ] **K8 — reverting to derived must DELETE the pinned file.** Series artwork is a second
      producer of orphaned artwork files: a pinned cover is a new file only the series
      references, so **deleting the series leaks it forever**, and so does reverting unless
      the revert deletes it. Derived art is free by comparison — it points at a file the
      book already owns.
- [ ] Deleting a series also releases its pinned file, for the same reason.
- [ ] **C8 — pinned art rides the fan's FRONT card**, replacing card 0 rather than
      prepending, so the cluster's width and peek stay constant. The backdrop follows it.
      The expression is one line — pinned artwork, else the first book's — because the front
      card *already was* the first book's cover.
- [ ] Device-verified in both themes: pin, revert, and confirm the old file is gone.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Dropped

**"Pick a member's cover" does not ship.** Web search subsumes it; series art has exactly
**one** override mechanism.

## Note for the follow-on

The ref-counted orphaned-artwork sweep sketched in the existing orphaned-artwork note
**needs to know series exist**. This ticket does not build that sweep; it must not make it
harder.
