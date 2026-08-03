# 09 — Auto-generate series: the setting, and what happens to my edits

Type: grilling
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

Detection ships behind a **settings toggle modelled on `Auto-Generate
Chapters`** (driver, 2026-08-02) rather than behind a post-scan review queue.
That shape is settled. **What is undecided is what the toggle promises — and
what it does to work the user has already done.**

## Why this exists

[02](02-detection-cascade.md) measured detection and the driver chose the
delivery shape in the same session: no per-item confirm/reject gate, because a
**wipe-and-regenerate** button makes detection errors cheap without any
per-item UI. That is a good trade, but it moves the risk. The dangerous moment
is no longer "the scanner guessed wrong" — it is **"the scanner ran again and I
lost my work."**

## The decisions

1. **Default state.** On or off for a new install? On is the whole point of
   making detection primary; off is the conservative read of the abstention
   bias. And the default *fidelity* — 02 recommends Conservative (19 series,
   98.3% purity, 0 standalones swept) over Full (28 series, 97.2%, 2 swept,
   one visibly wrong `Enders Game` group).

2. **What does turning it OFF do to series that already exist?** Three
   candidates, and they are not close to equivalent: stop creating new ones and
   leave the existing alone; hide the detected ones but keep them; or delete
   the detected ones. Hand-made series must survive all three.

3. **What does REGENERATE destroy?** This is the sharp one. A regenerate must
   rebuild detected series, but the user may have renamed one, split one, moved
   a book, or set a canonical number. [07](07-sequence-numbering.md) already
   ruled that `series_books.canonical_source = 'user'` is never touched by a
   rescan — but regenerate is not a rescan, it is an explicit reset, and the
   two may want opposite answers.

4. **The override marker for membership and naming.** 07 gave the *number* one
   (`canonical_source`). Nothing yet marks "I renamed this series" or "I moved
   this book out". 02 deferred it here because the regenerate model is what
   makes it load-bearing. Is it one flag per series, per membership row, or a
   whole detected-vs-user provenance concept?

5. **What the explanatory copy says.** The toggle is the only place the app
   ever explains detection. It has to say what can go wrong and how to fix it
   without describing a cascade. 02's real failure modes, in the user's terms:
   two recordings of one series may merge (they don't, now — the number
   collision check splits them, but the user cannot know that); a series may
   get an ugly name (`TMC`, `Crouch, B`) and can be renamed; a few books may
   not be picked up at all and can be added by hand; at Full fidelity a folder
   that isn't really a series may become one.

6. **Does Full fidelity deserve to be user-visible at all**, or is the
   difference (+9 series, +34 books, one of them a visibly wrong 7-book group)
   too small a prize for a setting most users will not understand?

## Constraints already settled

- **No post-scan review/approval queue** (driver, 2026-08-02). Whatever is
  created, is created.
- **No one-book series** (driver, 2026-08-02). A second book arriving later
  creates the series — so *adding a book must be able to create a series*, and
  that path runs outside any scan the toggle controls.
- **No folder-consent switch** (driver, 2026-08-02). Folder evidence is always
  considered; self-validation is always underneath it.
- 07: `position` is the sole sort authority; `canonical_number` only seeds it.
- 02: detection at Conservative sweeps **zero** standalones into a series, so
  the toggle's promise can be honest about false positives being rare.

## Notes

- Model the UI on the existing `Auto-Generate Chapters` toggle — find it in
  `src/` and match its affordances and copy voice rather than inventing a new
  pattern.
- The measured numbers to quote in any copy or mock live in
  [`../research/02-detection-cascade/`](../research/02-detection-cascade/)
  (`RESULTS.txt`, `SERIES_LISTING.txt`).
- Schema impact folds into the map's consolidated-schema fog item, alongside
  06's edition decision.

## Answer

Resolved 2026-08-02 by grilling. **The toggle promises that nothing you do by
hand is ever overwritten** — and it can promise that because ownership is
recorded *per aspect*, not per object.

The ticket's framing dissolved on contact with the existing
`Auto-Generate Chapters` implementation, which turned out to be a **two-surfaced**
precedent, not a one-surfaced one:

| Surface | Action | Direction |
| --- | --- | --- |
| Library settings | toggle + interval + `Apply to Existing Books (N)` | **creates**, in bulk |
| `titleDetails` dropdown | `Remove Auto-Chapters`, disabled at 0.4 opacity when N/A | **destroys**, one item |

The app had therefore **already ruled on this once**: bulk actions create,
per-item actions destroy, and no bulk destroy exists anywhere in `src/`. Every
answer below follows that split.

### 1. The data model — per-aspect provenance (decision 4)

A detected series is not one thing you own or don't. It is a bundle of
independently-editable claims, and disagreeing with one must not disown the
rest. This extends 07's `canonical_source` pattern rather than inventing a
concept.

```
series.origin          'detected' | 'user'                  -- 06, UNCHANGED
series.name_source     'detected' | 'user'                  -- NEW
series_books.membership        'detected' | 'user' | 'excluded'  -- NEW
series_books.canonical_number  string                       -- 07
series_books.canonical_source  'user' | 'detected'          -- 07

TABLE suppressed_series                                     -- NEW
  name        string, indexed
  created_at  number
```

**Running total: 5 columns across 2 tables, plus one new 2-column table**
(was 3 columns).

The deciding argument is 02's own numbers: **grouping is 98.3% correct but
naming only 94.2%**, so renaming is the highest-traffic repair a user will ever
make. Coarse "touch it, own it" promotion was rejected precisely because it
punishes that repair with the most surprising possible failure — rename `TMC`
to *The Mistborn Chronicles*, and book 7 is never auto-added, with nothing to
explain why. **An edit does NOT promote `series.origin`** — this answers the
question 06 explicitly deferred here.

Flags flip **silently on edit**, exactly as 07 ruled for numbers. No lock icons:
03 found Jellyfin's visible-lock approach is a documented mess.

### 2. Removals get a tombstone (decision 4, sharp edge)

Add and rename leave a row to flag; **removal does not** — "*Snuff* isn't
Discworld" is expressed by deleting the join row, and a deleted row is exactly
what re-derivation recreates. Solved with a **third enum value** rather than a
sixth column: `membership = 'excluded'` keeps the row as a hidden tombstone that
blocks re-derivation. Display filters `WHERE membership != 'excluded'`.

This is not hypothetical — at Full fidelity 02 emits a wrong `Enders Game` group,
and the only repair for a wrong merge is removing books. Without the tombstone
the user removes four books, rescans, and gets all four back: the most
trust-destroying outcome available on this map.

The column is named `membership`, not `membership_source`, because it now
encodes state as well as origin.

### 3. Regenerate reconciles; it never rebuilds (decision 3)

**"Wipe-and-regenerate" does not ship.** 07 already specified that canonical
seeds `position` "at create and at insert" — never re-seeding an existing row —
so a reconcile preserves hand-ordering *for free*, with no `order_source` flag
and no sixth column. A wipe would make every row new and kill ordering on every
run.

```
row still detected + still valid -> LEAVE IT (position intact)
row detected but no longer valid -> remove
newly detected book              -> insert, seed position from canonical
origin = 'user'                  -> skip the series entirely
name_source = 'user'             -> keep the name, reconcile membership
```

**What regenerate destroys: nothing the user made.** The ticket called this "the
sharp one"; per-aspect provenance plus tombstones plus reconcile dissolved it.

### 4. Deletion and suppression (new, driver-raised)

The driver raised a failure mode the ticket had missed: **deleting an accurate
series by mistake and wanting it back**. Two deletion motives exist and they
want opposite behaviour — "this grouping is wrong" (never return) versus "oops"
(should return).

A checkbox on the delete dialog was considered and rejected on two grounds. The
decisive one: **a modifier asking for foresight fails exactly when foresight is
absent** — the misclick case is by definition the case where the dialog wasn't
read. The secondary one: the app has no custom confirm dialog and uses
`Alert.alert` in 21 places, so a checkbox means building its first bespoke one.

**Chosen: delete always suppresses, and recovery lives in settings.**

- Per-series delete only, reusing the existing origin-blind dialog at
  `src/app/series/edit/[id].tsx:171` — copy already written and already correct:
  *"Delete series? This removes the series. Your books are not affected."*
- Deleting a **detected** series also writes its name to `suppressed_series`,
  so detection will not recreate it. A **hand-made** one writes nothing —
  nothing would recreate it.
- `Removed Series (N) →` in Library settings **renders the `suppressed_series`
  table directly**, with `Restore` and `Restore All`. Restore deletes the row;
  the next scan recreates the series.
- Suppression keys on the series **name**, which needs no new identity concept
  because 06 already ruled identity is `name` alone.

**Why a separate table rather than a value on `origin`.** The first draft of
this answer made `origin` three-valued (`'detected' | 'user' | 'suppressed'`).
The driver challenged it and it does not survive scrutiny: **06 states that
`origin` records *creation* only**, so a `'suppressed'` value silently amends a
closed ticket, and suppression is a lifecycle fact that varies independently of
provenance. Conflating two orthogonal axes in one enum also means any future
third provenance value would need every combination as a new member.

The membership case is **not** symmetric, which is why it keeps its three-valued
enum: a membership tombstone is keyed by `(series_id, book_key)` — the row *is*
the key, so storing it elsewhere would duplicate that key. A series tombstone is
keyed by **name alone**, needs no series row, and keeping an empty shell purely
to hold a name is the tail wagging the dog.

The separate table also **deletes two pieces of defensive code** that the
shell-row design required: `deleteSeries()` needs no branch on origin, and
`deleteEmptySeries()` needs no change whatsoever.

**No bulk destroy ships.** Under suppress-on-delete, "Delete All Detected
Series" would leave detection running but permanently muzzled — which is just
the toggle wearing a different hat — while the non-suppressing variant would
regenerate everything on the next scan and achieve nothing. Every bulk action on
this card is creative: `Detect Series in Existing Books`, `Restore All`.

### 5. What OFF does (decision 2) — driver's ruling, verbatim in effect

**Stop checking; leave existing series completely untouched.** Identical to the
precedent, where `handleAutoChapterToggle` merely writes
`autoChapterInterval = null` and never touches generated chapters. The driver's
framing: the toggle governs whether titles are examined *as they scan in*, and
the retroactive button exists as the bridge for anyone whose toggle was off
during the first scan.

The "hide them but keep them" and "delete them" candidates are both dead.

### 6. Default state and Pro gating (decision 1)

- **ON by default.** OFF-by-default would make the map's primary path opt-in,
  which most users never find, and an empty Series tab reads as a broken feature
  rather than an upsell. 02 measured 98.3% purity and **0 standalones swept**, so
  nothing is damaged; and after this ticket an error costs two taps and stays
  fixed. Existing closed-testing users get their library organised on upgrade —
  additive and non-destructive.
- **Not Pro-gated**, despite the precedent being Pro. Gating detection inverts
  the redesign for free users: the fallback becomes their only path. The wizard
  stays free either way, so there was nothing to withhold that wouldn't make the
  product worse.

**Note on the abstention bias.** It was written when a wrong group was expensive
and permanent. It now costs two taps and is reversible from `Removed Series`. It
still governs the *cascade*; it no longer governs the *default*.

### 7. Full fidelity is user-visible, in plain language (decision 6)

Yes — but never as "fidelity", and never as "Conservative"/"Full", which are
engineer words describing nothing actionable, and where "Full" misleadingly
reads as better while being measurably less accurate.

The two levels differ on exactly one concrete thing: **whether to trust a folder
name that no tag corroborates.** So that is what the UI says.

```
[x] Enable Series Detection
    [ ] Also group by folder name
        Finds series that have no series tags, using folder names.
        May occasionally group a folder that isn't a series.
```

Default **off** (= Conservative). On = Full: +9 series, +34 books, 2 standalones
swept, one visibly wrong `Enders Game` group. It recovers the *Gentlemen
Bastards* / *Founders Trilogy* / *Drenai* gap — real series whose folders are
named correctly but whose tags say nothing. Precedent for a sub-option that only
renders when the toggle is on: the 30/60-minute interval `Picker`.

### 8. The retroactive button shows no count

`Detect Series in Existing Books`, with no `(N)`. The chapters count is a
*promise* — every one of those books gets chapters. The naive series analogue
("books not in a series") is not, because most books in a typical library are
standalones that will never group; showing `(312)` and then creating 19 series
misleads on the one screen whose job is explaining what detection can and cannot
do. Computing the true figure needs a full cascade pass, which was judged not
worth it. Driver's call, against the recommendation.

### 9. The copy (decision 5)

One muted line on the card, verbose explanation behind a pressable `Info` icon —
the pattern already used in `src/app/(settings)/timer.tsx` via
`InfoDialogPopup` (`src/modals/InfoDialogPopup.tsx`, props
`{ isVisible, onClose, title, message }`). **`message` is a single plain string**,
so the long copy is prose with paragraph breaks, not bullets. House voice is
second-person, opening "When enabled, …".

Card title **`Series Detection`**, row label **`Enable Series Detection`**
(driver's choice over `Auto-Generate Series` / `Enable Auto-Series`, which bought
sibling-card symmetry at the price of awkward English).

Card description, no trailing period, matching the sibling exactly:

> Automatically group books into series using their tags and folder names

`InfoDialogPopup title='Series Detection'`:

> When enabled, books are grouped into series automatically as your library is
> scanned, using the series information in their tags and, if you turn on folder
> grouping, their folder names.
>
> Series names come from your files, so a name may occasionally look odd. Books
> with no series information are left on their own. Both are fixable by hand —
> you can rename a series, add a book to one, or remove a book that doesn't
> belong.
>
> Your changes are never overwritten. Renamed series, books you've added or
> removed, custom ordering and hand-made series are all left alone when your
> library is scanned again. Deleting a detected series also stops it being
> recreated; you can reverse that from Removed Series.

**Deliberately unmentioned:** that two recordings of one series stay separate.
02 works hard to guarantee it via the number-collision check, but it is internal
machinery the user cannot act on, and naming it would invite doubt about a case
that is already handled.

### The full card

```
+- Series Detection ------------------ (i) -+
| Automatically group books into series     |
| using their tags and folder names         |
|                                           |
| Enable Series Detection          [ ON ]   |
|                                           |
| [ ] Also group by folder name             |
|     Finds series that have no series      |
|     tags, using folder names. May         |
|     occasionally group a folder that      |
|     isn't a series.                       |
|                                           |
| [ Detect Series in Existing Books ]       |
|                                           |
| Removed Series (3)                     >  |
+-------------------------------------------+
```

### Implementation consequences (for the build effort, not this map)

- `deleteEmptySeries()` (`src/db/seriesQueries.ts:202`) needs **no change**. This
  is a direct dividend of the separate table — there are no shell rows for it to
  reap.
- `deleteSeries()` (`src/db/seriesQueries.ts:133`) stays a hard delete for every
  series. The only addition is that when `origin = 'detected'` it *also* writes
  the name to `suppressed_series`. A hand-made series writes nothing: `Restore`
  works by letting detection recreate the series, and detection never made that
  one, so listing it would offer a button that does nothing.
- Detection must consult both tombstones before creating: skip any name in
  `suppressed_series`, and never re-add a membership row marked `'excluded'`.
- Hand-creating a series whose name sits in `suppressed_series` should clear that
  row — otherwise the user's own new series is shadowed by an invisible veto.
- **Edge case, not decided here:** a series whose every membership row is
  `'excluded'` still has rows, so `deleteEmptySeries` keeps it, but it renders
  with no books. Excluding every book one at a time is arguably a delete and
  should probably suppress — flagged for the build effort.
- Migration is schema **v33** (07's two columns + 09's two + the new table), or
  split across several; the map's consolidated-schema item still owns that
  coherence question.

### What this ticket did NOT decide

Where rename / split / merge / reassign actually live. That is the correction
surface, now graduated out of the map's fog as
[10](10-correction-surface.md).
