# 19 — Write the spec

Type: task
Status: resolved
Blocked by: 14, 15, 16, 17, 18, 20 (ALL resolved — 19 is the whole frontier)
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

   **Must carry [20](20-recommended-library-structure.md)'s rule verbatim:**
   *self-validation is never relaxed on the assumption that users have been told
   how to name folders.* Folder evidence corroborates against the library's own
   tags on its own merits, always. The app ships **no** folder-structure
   recommendation (20), and if one is ever added it does not license the detector
   to trust folders more. This is in the map's Notes as a standing preference,
   but a build engineer reads the spec, not the map — hence it is stated here.
2. **Browse** — 08's row, 12's `Series Backgrounds` toggle.
3. **Series detail** — 11 as amended by 13: `formSheet`, split rows, the hero.
4. **Correction / editor** — 10 as amended by 11 and 13.
5. **Wizard** — 05 plus 15's shape.
6. **`titleDetails` integration** — 10's content plus 14's layout.
7. **Schema** — 18's consolidated table and migration plan.

Plus the cross-cutting results from 16 (tablet, font scale) and 17 (light theme).

## How to write it

**Resolve this by invoking `/to-spec` — not by writing the document freehand.**
The driver has to type it: `/to-spec` is `disable-model-invocation: true`, so no
session can reach it on its own, and a fresh one has no conversation to
synthesise. Point it at this ticket and at [map.md](../map.md). It supplies what
this ticket does not — the spec template (Problem Statement · Solution · User
Stories · Implementation Decisions · Testing Decisions · Out of Scope · Further
Notes) and a **seams** step: sketch the test seams, prefer existing ones, agree
them with the driver *before* writing. This ticket is the **content** contract;
`/to-spec` is the **shape**. It closes nothing — resolution is the tracker's own
procedure (`docs/agents/issue-tracker.md` § Wayfinding operations). Then
`/to-tickets` on the spec, in the same context window.

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

## Answer

Resolved 2026-08-06 by invoking `/to-spec` against this ticket and
[map.md](../map.md), then zooming into the `## Answer` of every ticket the map's
Decisions-so-far links. **[`../spec.md`](../spec.md) exists**, labelled
`ready-for-agent`, and was **APPROVED BY THE DRIVER on 2026-08-06**. The
definition of done below is therefore met: **every ticket is closed and the map
is complete.** Amendments are edits to `spec.md` in place; it is never reissued.
Next step is `/to-tickets` on the spec — which the driver must type
(`disable-model-invocation: true`), and which needs a **numbering decision
first**: it publishes to `issues/NN-slug.md` from `01`, and `01`–`20` here are
this effort's decision record.

### Shape

`/to-spec`'s template, with the **seven areas organised by surface** inside
`Implementation Decisions` — A Detection · B Browse · C Series detail ·
D Correction/editor · E Create-edit surface · F `titleDetails` · G Schema —
plus **H geometry** (16), **I theme** (17), **J routing consolidated**, and
**K traps**. 76 user stories grouped by the same surfaces.

### Seams — agreed with the driver before writing, per `/to-spec` step 2

**Two new pure seams and no others**, following the repo's existing extraction
idiom (`seriesMembershipDiff` was pulled out of `seriesQueries` precisely so it
could be tested without the native adapter):

```
detectSeries(units, { alsoGroupByFolder })          -> ProposedSeries[]
reconcileSeries(proposals, existingRows, suppressed) -> write plan
seriesQueries.applyPlan(plan)                        -- IO only, untested
```

Two rather than one **deliberately**: a grouping-purity regression and a
provenance-safety regression are different failures, and folding them into one
assertion hides the second behind the first.

**Driver ruled the 02 corpus becomes a checked-in fixture** —
`units.json` + `ground_truth.json` (~208KB) with threshold assertions, so
98.3% purity and 0-standalones-swept stop being ticket claims and start being
tests. The spec encodes the two caveats that make it safe to keep: the ground
truth is **authored, not derived** (so it cannot prove folders are trustworthy
in general), and **coverage figures are lower bounds** while accuracy figures
are not — assert accuracy, never coverage.

**Third seam question (presentation) came back as a question, not a choice:**
*"If installing @testing-library/react-native will help us, I will install it."*
Answered in the spec as a costed deferral rather than a yes/no. It **cannot**
assert what this effort actually decided — no layout engine, no pixels, so no
contrast ratios, no dp geometry, no glyph fill, no sheet transitions — while
installing it means adopting an RN jest preset plus transforms and mocks for
Reanimated/worklets, FlashList, FastImage, sortables, RNTP and the WatermelonDB
adapter, risking a green 484-test suite on an unmerged branch. **What it would
genuinely buy is named** (13's split row targets, 15's `X`-vs-back split, 13's
delete-exit routing), with the trigger stated: if one of those regresses in
practice, it becomes its **own up-front infrastructure ticket** for the
implementation effort, never a mid-feature bolt-on. Pure string/geometry
helpers get jest either way — range cap, meta-line sacrifice order, next-up
states, `primaryMembership`, cluster-size rule, canonical-number parse.

### Two things this ticket's brief got wrong, corrected in the spec

1. **The harness cleanup is no longer "`rm -rf src/prototypes` plus three
   commented lines"** — that figure predates 13, 14 and 15, which added two
   throwaway routes, two `<Stack.Screen>` entries, four mounts on
   `titleDetails` and a wizard pill. `src/prototypes/README.md` holds the
   authoritative recipe and the spec points at it, restating only the part that
   is a **ruling rather than a revert**: the `TableOfContents` icon on
   `Remove Auto-Chapters` ships (14) and must not be reverted with the harness.
2. **08 has no `assets/` directory** — its fourteen variants were judged live on
   device. The spec therefore cites 13's and 17's captures as the surviving
   image evidence for the winning row rather than inventing a citation.

### Also carried, because a build engineer reads the spec and not the map

20's guarantee **verbatim** (self-validation is never relaxed on the assumption
that users have been told how to name folders); 18's column list **copied, not
re-derived**; 16 rulings that were made and **withdrawn** (the backdrop-vs-width
claim) marked do-not-re-raise alongside 17's `PILLAR`; and the two out-of-scope
items that are **commitments rather than exclusions** —
`BookGridItem` restart-from-zero as a carried fix, and delete-and-rebuild being
sanctioned, which is what makes 13's white-sheet delete bug a **blocker rather
than polish**.

**16 traps** are carried as their own section (K1–K16), including the seven this
ticket listed plus `addColumns` dropping `defaultValue`, the `light*` token
naming trap, the cover-stack occlusion rule, the tri-state progress value, and
measure-don't-infer-overflow.
