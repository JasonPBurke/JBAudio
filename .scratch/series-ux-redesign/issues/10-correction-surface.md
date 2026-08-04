# 10 — Correction surface: where does fixing a series actually happen?

Type: prototype
Status: resolved
Blocked by: 08
Parent: [map.md](../map.md)

## Question

Detection now creates series without any gate, and [09](09-auto-generate-series-setting.md)
guaranteed that **every hand edit survives every rescan**. That guarantee is
only worth something if the edits are reachable. **Where do they live?**

## Why this exists

This was the map's longest-standing fog patch. It started life as a
*review-and-correction gate* — the redesign's original centre of gravity.
[02](02-detection-cascade.md) removed the gate (detection is accurate enough
that per-item confirmation is not worth its UI), and 09 replaced the last of it
with a settings toggle plus suppression-on-delete. What is left is genuinely an
**editing** surface, and it is now unblocked in every direction except layout.

## The decisions

1. **Does the existing series editor absorb all of it?** **Largely yes —
   settled during 08 (2026-08-03).** `src/app/series/edit/[id].tsx` already does
   rename, **add books** (:242), remove (`handleRemove`), reorder (`Sortable`)
   and delete — a complete single-series repair kit. Correction is therefore
   "that screen, reached from the right place", not a new surface. **But it is a
   strict subset of correction** — see 3 and the defect below. Note 05 kept the
   wizard as the app's only opaque full-screen push; this should not be a second.

2. **Entry points. Settled by 08.** Editing is reached **from the series detail
   screen's three-dot menu**, and nowhere else. 08 removed the `Pencil` from
   every browse row (`SeriesHome.tsx:279`) and deliberately did not replace it —
   putting it back would re-clutter the space the redesign cleared. Accepted
   cost: editing goes from 1 tap to 2. What remains for this ticket is only
   whether *correction-specific* actions need any entry beyond that menu.

3. ~~**Split and merge.**~~ **OUT OF SCOPE — driver, 2026-08-03.**
   *"Deleting and rebuilding is good enough for now, and if at a later date
   feedback leads me to needing to add this, we can revisit."* Design nothing
   for it here.

   Recorded because the reasoning matters if it ever returns: these are the only
   two corrections a single-series editor **structurally cannot express** — it
   operates on one id, while a false split ("these two are one") or false merge
   ("this one is two") spans two. The escape hatch is delete the wrong series
   and rebuild it in the wizard. That is now load-bearing, so **deletion and the
   wizard must stay capable enough to serve as the universal repair of last
   resort** — 09's `suppressed_series` + `Removed Series` restore path is part of
   why this is acceptable.

4. **Reassigning a mis-filed book.** Book-first or series-first? Overlaps the
   `titleDetails` fog item, which may want to merge into this ticket.

5. **07's canonical-number edit field.** 07 ruled the override must exist and
   flips `canonical_source` to `'user'`, but deliberately declined to site the
   UI. It lands here.

6. **07's deferred "Sort by number" action** — re-seeds `position` from
   canonical on demand. 07 considered and declined it purely because it had
   nowhere to live. It now has somewhere.

7. **Does a bulk "number sequentially from current order" action belong here?**
   It would number all 39 of the 2022 Discworld units in one tap, but on a
   gapped set it stamps 1,2,3,4 over 1,3,4,8 and destroys the distinction 07
   exists to draw.

## Defect this ticket inherits — found during 08, not yet fixed

**The existing editor predates 09 and will silently undo repairs on *detected*
series.** Schema is v32; `membership`, `name_source`, `origin` and
`suppressed_series` do not exist yet, so:

- `handleRemove` + `updateSeries` just rewrite the join rows. On a detected
  series **the next rescan re-adds the book the user removed** — exactly the
  failure 09 predicted ("removals need a tombstone or the repair for a wrong
  merge silently undoes itself").
- `updateSeries` **deletes the series when its last book is removed**
  (`seriesQueries.ts:81-83`), whereas 09 ruled that delete must **suppress** via
  `suppressed_series`, or detection simply recreates it.

So "correction = the edit screen" only becomes *true* once the edit screen is
made 09-aware. That is a correctness upgrade to an existing screen rather than a
design question, but this ticket owns noticing it — and it matters more now that
**delete-and-rebuild is the sanctioned escape hatch** for split/merge: that path
runs straight through the suppression behaviour above.

## Constraints already settled

- **09: renaming sets `series.name_source = 'user'`; removing a book sets
  `series_books.membership = 'excluded'`; adding one sets `'user'`.** All flips
  are **silent** — no lock icons (03: Jellyfin's visible locks are a documented
  mess). The surface must not invent a competing provenance UI.
- **09: `Removed Series` already has a home** in Library settings, rendering the
  `suppressed_series` table with `Restore` / `Restore All`. Do not duplicate it.
- **09: deleting a series is already solved** and its copy already written.
- **02: renaming is the highest-traffic repair** — grouping is 98.3% correct
  while naming is 94.2%, so the common action is a label fix, not a regrouping.
  Optimise the surface for rename above everything else.
- **06: a rename changes a series' identity**, not merely its label, since
  identity is `name` alone. Duplicate-name rules apply on edit.
- 07: `position` is the sole sort authority; `canonical_number` only seeds it.

## Notes

- 04's harness (`src/prototypes/`) takes a new variant by copying a file and
  adding one row.
- The existing implementation is a **resource, not a constraint** — the editor
  is device-verified and its delete copy is already correct.

## Answer

**Correction is the existing edit screen, grown by three things: series
artwork, a per-row canonical number, and `Sort by number`.** Two visible routes
reach it, both saying the same word. Resolved by grilling + an on-device
prototype with the driver, 2026-08-04.

Prototype: `src/prototypes/ProtoSeriesEdit.tsx`, reached from the wrench row on
`ProtoSeriesDetail`. Evidence in
[`assets/10-correction-surface/`](../assets/10-correction-surface/).

### 1 — Editor only. The 5-tap journey is accepted.

Rename is 02's highest-traffic repair (naming 94.2% vs grouping 98.3%) and costs
the most navigation of anything in the feature: browse row → detail → ⋮ →
`Edit series` → tap field → type → `Save`. A dedicated rename dialog was
offered and **rejected** — one surface for editing a series, no second field to
keep in sync, and `seriesEditIssues`' duplicate-name validation keeps exactly
one call site.

### 2 — Two routes, one word: **wrench + `Edit series`**

| Route | Where |
| --- | --- |
| Visible row | Series detail, under the play button — the wrench row 08 prototyped |
| ⋮ menu | Series detail nav bar, mirroring `titleDetails` |

**08's "⋮ only" ruling is superseded.** 08 removed the browse `Pencil` and said
editing is reached from a ⋮ — but it *prototyped* a wrench row and never built
the ⋮, so the ⋮ has never existed. Both now ship. Redundant entry points are
fine: the visible row advertises, the ⋮ collects. They fail only when they look
like different destinations — hence one word.

- **`Fix this series` is retired.** It presumes breakage, which is wrong on the
  98.3% of detected series that are correct and actively wrong on a hand-made
  playlist the map has a standing rule never to foreclose.
- **The wrench glyph is KEPT** (driver, against the recommendation of `Pencil`
  for parity with `titleDetails`' `Edit Book Details`): the glyph signals
  *correction*, the word signals *destination*.
- The ⋮ is deliberately thin today. It exists for parity and as the home for
  split/merge **if** that out-of-scope ruling is ever revisited.

### 3 — Split and merge: OUT OF SCOPE (pre-settled, unchanged)

### 4 — Book-first: a read plus one shortcut. No book-first remove.

`titleDetails` shows **no series information at all** today, so book-first was
missing the *read*, not just the editor.

- **Series line** on `titleDetails` — name + 07's canonical number, tapping
  through to series detail. Renders a **list**: 07 verified multi-membership
  (*Guards! Guards!* is Discworld **and** Night Watch).
- **`Add to series…`** in `titleDetails`' ⋮. **Always present** — any book can
  join another series regardless of what it is already in, so it has no
  inapplicable state and the disabled-vs-absent question never bites it.
- **No book-first remove.** Removal changes a *series'* membership and 09's
  `membership = 'excluded'` tombstone is series-scoped.
- **New convention (driver): a menu item that does not apply is ABSENT, not
  disabled.** This reverses the `Remove Auto-Chapters` precedent the map
  flagged. Here it governs the series line only — a book in no series renders
  no line, rather than a dimmed "Not in a series". Retrofitting
  `Remove Auto-Chapters` is a book-screen change, **out of scope**.

### 5 — Canonical number: a per-row field in the editor

Sites 07's override, which 07 ruled must exist and declined to place. Editing a
number **does not resort** — 07 gave `position` sole sort authority, so a row
must not move out from under the cursor.

#### This ticket AMENDS 07: the field is a `decimal-pad`, and the column is a number

The prototype first shipped a default alphabetic keyboard, because 07 made
`canonical_number` a **string** to hold `12.5`, `14b` and `1-3` and Android's
numeric input types exclude letters outright. Every number edit therefore paid a
full keyboard for a mostly-numeric field.

**Driver, 2026-08-04: drop the letter forms instead.** They are too uncommon to
pay for, and `14b` renames to `14.1`.

- `keyboardType='decimal-pad'`.
- **`canonical_number` becomes a nullable NUMBER**, not a string. Every value is
  now float-parseable, so the constraint becomes *structural* — `14b` cannot be
  stored even by accident — and most of 07's normalisation (strip `#`, `Book `,
  leading zeros) collapses into a parse. 03's
  `CAST(sequence AS FLOAT) NULLS LAST` becomes a plain numeric sort, nulls last.
- **Ranges are the real casualty, not letters.** An omnibus of books 1–3 can no
  longer say `1-3`; it carries a single number. Accepted.
- **⚠ LOCALE TRAP.** `decimal-pad` renders the *locale's* decimal separator, so
  a comma-decimal user types `14,1` and `parseFloat('14,1')` returns **`14`** —
  silently, no error. Normalise the separator before parsing, or the fractional
  part vanishes on exactly the users whose keyboard offered it.
- The bulk action (item 7) survives this and is still wanted.

Measured on device: a 52dp field + 56dp cover + minus + grip pushes titles to
**two lines** where the shipping `SeriesBookRow` fits one. ~79dp rows, ~8 per
screen.

### 6 — `Sort by number`: yes, beside the name field

07 declined this purely for having nowhere to live. Re-seeds `position` from
canonical on demand, using 03's rule — `CAST(sequence AS FLOAT)` **NULLS LAST**,
stable, so a partly-numbered series does not shuffle its unnumbered tail.
Disabled when nothing is numbered.

### 7 — Bulk numbering: yes, **gated to fully-unnumbered series only**

09's rule decides it: **bulk actions create, per-item actions destroy** — there
is no bulk destroy in `src/`. Renumbering over existing numbers *is* a bulk
destroy (it stamps `1,2,3,4` over `1,3,4,8`), so it is out on precedent.

**"Fill blanks only" was considered and rejected** — on `1, _, _, 8` it fills
`2, 3` from position when the real books may be 3 and 4, manufacturing false
canonical data. That is exactly what 07 refused when it ruled a hand-made
sub-series seeds **null**: *blank beats misleading*.

Gated to zero-numbered series there is nothing to destroy and nothing to
contradict — a pure create, whose only input is the order the user arranged. It
and `Sort by number` are opposites: one seeds order from numbers, the other
numbers from order.

### 8 — Series artwork lives in the editor

A pressable cover + `ImagePlus` badge beside the name field, mirroring
`editTitleDetails.tsx:157-186` — the app's **only** entry point to
`/coverArtSearch`. Device-verified to fit at 88dp with the name field still
wide; the ⋮ fallback was not needed on space grounds.

- **`replaceBookArtwork` → `replaceArtwork`**, generalised and shared by books
  and series. It is already parameterised by id/title/author; only
  `updateBookArtwork` is book-specific.
- **Immediate-write behaviour is KEPT, plus a confirmation** (driver). A
  deferred transaction was costed and declined: `replaceBookArtwork` runs
  `RNFS.unlink(finalPath)` **before** the DB write
  (`src/helpers/replaceBookArtwork.ts:51`), so deferring the DB write alone is
  incoherent — the old cover is already gone. Deferring the whole pipeline
  means no real preview and a slow, network-dependent, failure-prone `Save`.
  Because the old file is genuinely unrecoverable, the confirmation must be
  **before** applying, not a notice after.
- **"Pick a member's cover as series art" is DROPPED** (driver): no intuitive
  home, and web image search subsumes it. Series art has exactly **one**
  override mechanism, which shrinks 11's job.

> **Finding worth keeping — sorting silently changes the series cover.**
> Setting Storm Front to `9` and tapping `Sort by number` dropped it to position
> 8 **and switched the header artwork to Grave Peril**, because 08 ruled art
> derives from the first book and *follows* a reorder. The rule works exactly as
> specified and still reads like a bug. It argues for siting the override right
> there — you watch it move, you pin it immediately — and that pinned art
> probably needs to *look* pinned. The indicator is **11's**.

### Defects this ticket inherits — correctness, not design

1. **The editor is not 09-aware** (as logged in the ticket body): `handleRemove`
   + `updateSeries` rewrite join rows, so a rescan re-adds a removed book, and
   `updateSeries` **deletes** the series when its last book goes
   (`seriesQueries.ts:81-83`) where 09 requires suppression. Load-bearing now
   that delete-and-rebuild is the sanctioned repair for split/merge.
2. **`Save`'s exit is LATENT, not live — and it is 11's to activate.**
   `handleSave` calls `exitGroup()` = `navigation.getParent().goBack()`
   (`src/app/series/edit/[id].tsx:132`), which pops the **whole `series` stack
   group**. Today that is **correct**: there is no shipped series detail screen,
   and the only route to the editor is `(library)/index.tsx:254` — the browse
   row's `Pencil` — so the library genuinely is the previous screen. It breaks
   the moment 11's detail screen sits between library and editor, because
   popping the group skips it. **A constraint on 11's routing, not a fix to make
   now.**

   *(Verified 2026-08-04: the driver observed Save returning to the detail
   screen and it was the PROTOTYPE, whose `Save` is inert — `onPress={onClose}`.
   It demonstrated the wanted behaviour, not the shipped one.)*

### Schema cost: **zero**

Numbers reuse 07's columns; artwork override is 11's; the `titleDetails` series
line is a read. The running total is unchanged by this ticket.

### Prototype fidelity caveats

`Modal`, not a route. Rows draw a grip but do not drag — `react-native-sortables`
is not wired, since the real screen's drag is device-verified and the question
was what fits in a row. Nothing is written to the DB. Hardware back inside the
editor closed the whole modal rather than the keyboard: a Modal-in-Modal
artifact, already handled on the real screen by its `beforeRemove` draft reset.
tsc 0 / eslint 0.
