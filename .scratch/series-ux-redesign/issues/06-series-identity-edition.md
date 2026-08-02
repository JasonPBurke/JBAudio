# 06 — Series identity: is a series `name`, or `name × edition`?

Type: grilling
Status: resolved
Blocked by: 01, 02, 03
Parent: [map.md](../map.md)

## Question

**What identifies a series?** Today it is a user-typed `name` plus a normalised
`sort_name`, with duplicates rejected. The driver's real library breaks that
model.

Use `/grilling` and `/domain-modeling`. The output is a settled definition plus
whatever schema follows from it.

## The forcing case

The driver owns **Discworld twice** — the 1980s Nigel Planer recordings and the
2022 full-cast recordings — 41 books each, **82 books that must appear as two
separate series**.

Under the current model the only way to express that is a naming convention:
literally typing `Discworld` and `Discworld (2022)`. Which is exactly what the
driver's *folder names* already do — and what `Mistborn 6 (Michael Kramer)` does
in an `album` tag. The convention is already in use everywhere; the question is
whether the data model should learn it.

Note the discriminator is fragile: Mort 1980s has **no `composer` tag**, so its
narrator field would be blank. Edition cannot be derived from narrator alone.

## The decision

- Is **edition** a first-class attribute of a series, or just part of its name?
- If first-class: is it free text ("2022 full cast"), a narrator reference, or a
  year? What happens when narrator is missing?
- Duplicate-name validation currently rejects `sort_name` collisions
  (`seriesName.ts`). If `Discworld` can legitimately exist twice with different
  editions, that rule must change — to what?
- Does auto-detection get to *create* two series that differ only by edition, or
  must a human confirm the split? (Detection has one clean signal here — the
  folder — and one unreliable one — narrator.)
- **Playlists must survive this.** A series doubles as a personal playlist
  ("Discworld: Night Watch arc"); a model that makes edition mandatory would
  break that. Whatever lands must leave a plain user-authored set expressible.

## Inputs

- [01](01-signal-inventory.md) — what edition signals actually exist
- [02](02-detection-cascade.md) — whether the detector can distinguish editions,
  and how confidently
- [03](03-prior-art-series-ux.md) — whether *any* comparable app models editions.
  A null result is informative: it may mean this is genuinely novel, and novel
  means no borrowed answer.

## Answer

Resolved 2026-08-02 (driver, grilling). **A series is identified by its `name`.
Edition is not first-class.**

### The premise this ticket was written on had already dissolved

06 was charted assuming the data model had to *learn* the edition convention.
By the time it came up the frontier, [02](02-detection-cascade.md) had already
solved the forcing case structurally: the number-collision check splits a
merged series by folder and names each part by its raw folder name. Checked
against 02's emitted output (`research/02-detection-cascade/SERIES_LISTING.txt`)
before grilling started:

- The cascade emits **28 series**. Exactly **one** is an edition pair:
  `"Discworld"` (41 books) and `"Discworld (2022)"` (39).
- They are **already name-distinct**, straight from the folder names. There is
  **no name collision anywhere** in the 350-title library.

So "two Discworlds as two separate series" costs **zero schema change**. A
first-class `edition` had to justify itself on something other than grouping —
and nothing else needed it.

### The five rulings

**1. Identity is `name`.** No `edition` column, no `series_group` table.
"Edition" is a *naming convention* the detector fills from the folder
(`Discworld (2022)`), exactly as the driver's folders and the
`Mistborn 6 (Michael Kramer)` album tag already express it. This is also the
only shape consistent with the prior art: [03](03-prior-art-series-ux.md) found
Audiobookshelf forbids duplicate names outright, Audible reuses one series ASIN
and explains editions in prose, and Goodreads hangs them off the *work*.

Rejected: the optional `(sort_name, edition)` column 03 flagged as the one
borrowable schema shape — it would have to be populated from a signal 01 proved
cannot carry it (**narrator is absent on 39/41 classic Discworld books**, and
the two editions have *asymmetric* signals: classic has uniform parseable
albums and almost no `Composer`, 2022 has rich narrator data and zero series
tags). Also rejected: a parent/child `series_group`, which adds a second level
of hierarchy to every list, expansion and detail screen for a case occurring
**once** in 350 titles.

**2. The human-facing duplicate-name rule survives untouched.** This ticket
predicted the opposite ("that rule must change — to what?"). It doesn't.
`isDuplicateSeriesName` / `SeriesNameConflictError` / `normalizeSortName` in
`src/helpers/seriesName.ts` need **no change**, because under name-only identity
`Discworld` legitimately *cannot* exist twice — the second one is called
something else. **No code change falls out of this ticket for validation.**

**3. Detector name collisions disambiguate — never merge, never abstain.**
Edition-in-the-name means the *detector* can now generate a collision on its own
(two folders both literally named `Discworld` under different parents), which
this library does not contain but a user's might. On collision, keep both and
make the second name unique from context: **parent folder first, ` (2)` as a
last resort.**

- **Merging** (Audiobookshelf's behaviour) is wrong here: it would recombine the
  two Discworlds into one 80-book series with 39 doubled numbers — precisely the
  failure 02's collision check exists to prevent (edition-aware purity
  77.9% → 98.3%).
- **Abstaining** contradicts the map's abstention bias only in appearance. The
  bias guards against creating groups the detector *isn't sure of*; here it holds
  a validated folder split, so abstaining discards good evidence and costs a
  39-book wizard trip.
- A clumsy auto-name is cheap, visible and fixable. 02 already established
  **grouping and naming are different problems** — grouping 98.3% correct vs
  names 94.2% — and ships `TMC` and `Crouch, B` as editable defaults.

**4. New column: `series.origin: 'detected' | 'user'`.** Under name-only
identity nothing distinguishes a scanner-made `Discworld (2022)` from a
hand-authored `Discworld: Night Watch arc` — both are just a row with a name.
Without a marker, [09](09-auto-generate-series-setting.md)'s wipe-and-regenerate
would delete personal playlists as collateral. The column makes **"never
foreclose personal playlists" structural rather than aspirational**:
regeneration may only ever touch `origin: 'detected'`.

Mirrors [07](07-sequence-numbering.md)'s `series_books.canonical_source`
precedent deliberately — same two-value vocabulary, same rule that machine
passes refresh machine-authored rows and never touch human-authored ones.

The alternatives both failed against the map's own commitments: *additive-only
regeneration* leaves wrong groups forever, defeating the
"wipe-and-regenerate makes detection errors cheap" argument that let 02 drop the
review queue; *wipe everything* makes a playlist something a settings toggle can
destroy, which is not support.

**5. `origin` records who *created* the series — nothing more.** Whether a later
edit (notably a rename, which 02 measured as the highest-traffic repair) promotes
`'detected'` → `'user'` is **[09](09-auto-generate-series-setting.md)'s call**,
which already owns membership and naming overrides per 02's hand-off. Deciding
it here would pre-empt 09 without the wipe semantics in view. Noted for whoever
takes 09: the tempting "a rename makes it yours" answer is **Jellyfin's lock-flag
pattern**, which 03 found is a documented, unfixed mess (issue #16268); 03's
recommended alternative is to store corrections as **top-precedence detection
inputs** so a rescan re-derives them rather than fighting them.

### Also settled by implication

**Auto-detection creates the edition split unilaterally** — no human confirmation
gate. This ticket asked the question, but ruling 3 (keep both) plus the driver's
02 ruling that removed the post-scan confirm/reject queue answer it. Not
re-litigated.

### Consequences

- **Schema:** one column, `series.origin`. Whether it rides in 07's v33 migration
  or its own bump stays with the map's *Consolidated schema decisions* fog item —
  but **edition is now off that list**, leaving only the membership/naming
  override (09) and series artwork.
- **Code:** none required. `seriesName.ts` is untouched.
- **Unblocks [08](08-browse-presentation.md)** (was blocked by 04, 06, 07 — 04
  and 07 already resolved). 08 is now on the frontier.
- **Vocabulary:** the map's provisional *Edition* entry is settled and rewritten.
