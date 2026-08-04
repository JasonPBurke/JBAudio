# 19 — Write the spec

Type: task
Status: open
Blocked by: 14, 15, 16, 17, 18, 20
Parent: [map.md](../map.md)

## Question

There is nothing left to decide — this ticket is the destination itself.

The map's destination is **"a design spec plus the data-model decisions it
depends on"**. That spec **does not exist as a document**. What exists is a map
whose Decisions-so-far is an *index* — one paragraph per ticket, deliberately a
gist pointing at the ticket that holds the detail. Twenty tickets is the wrong
artifact to hand to an implementation effort: it is a record of how the thinking
went, ordered by when questions were asked, not by what gets built.

So: write `.scratch/series-ux-redesign/spec.md`, per this repo's tracker
convention (`docs/agents/issue-tracker.md` — "the spec is
`.scratch/<feature-slug>/spec.md`").

## What the spec must cover

The destination names six areas. All six must be present, organised by
**surface**, not by ticket number:

1. **Detection** — 02's precedence waterfall, the number-collision edition split,
   the Conservative/Full levels, 09's `Series Detection` settings card and its
   reconcile-not-wipe contract.
2. **Browse** — 08's row, 12's `Series Backgrounds` toggle.
3. **Series detail** — 11 as amended by 13: `formSheet`, split rows, the hero.
4. **Correction / editor** — 10 as amended by 11 and 13.
5. **Wizard** — 05 plus 15's shape.
6. **`titleDetails` integration** — 10's content plus 14's layout.
7. **Schema** — 18's consolidated table and migration plan.

Plus the cross-cutting results from 16 (tablet, font scale) and 17 (light theme).

## How to write it

- **State decisions, not their history.** The map records *reversals* (08's
  row-height ruling reversed, 11's "no route to `titleDetails`" reversed by 13,
  10's ⋮ deleted by 11, 12's scrim mechanism amended by 13, `BookGridItem`'s
  restart-from-zero reversed from accepted to carried). A reader of the spec must
  get **the final state**, cleanly, without having to reconstruct which amendment
  won. Link back to the ticket for anyone who wants the argument.
- **Carry the traps forward.** These are the things an implementer will
  otherwise rediscover expensively:
  - Every setting is a **column** on a single-row `settings` table, and every
    boolean getter hard-codes default-OFF — 12's toggle must invert to `!== false`.
  - `CompactSettingsRow` needs **`description` AND `onInfoPress`**; its control
    slot is taken by the switch.
  - `decimal-pad` shows the **locale's** separator, so `parseFloat('14,1')`
    silently returns `14`.
  - A failed migration is **silent**; `unsafeExecuteSql`'s assert is dev-only.
  - Routes copying `titleDetails`-style options set **no `contentStyle`
    background** → white sheet when the route renders `null`.
  - `replaceBookArtwork` → `replaceArtwork`: `RNFS.unlink` runs **before** the DB
    write, so the confirm must come **before** apply.
  - `handleDelete` on the detail sheet still pops onto the sheet of a deleted
    series (13).
- **Carry the out-of-scope list**, especially the two commitments that are *not*
  simple exclusions: **`BookGridItem` restart-from-zero is a carried fix the
  driver wants**, ideally as a `Finished` case on `handleBookPlay` rather than
  the caller-side rewind the prototype uses; and **delete-and-rebuild is the
  sanctioned repair of last resort**, which makes deletion, the
  `suppressed_series` restore path and the wizard load-bearing.
- **Say what the prototypes were.** `src/prototypes/` is throwaway — the spec
  should name the screenshots in `assets/` that justify each choice, and record
  that `rm -rf src/prototypes` plus three commented lines is the whole cleanup.

## Not in this ticket

Implementation. The map ends at an approved spec; that is out of scope and stays
out of scope.

## Definition of done

`spec.md` exists, covers all seven areas above, and the driver approves it. At
that point every ticket is closed and the map is complete.
