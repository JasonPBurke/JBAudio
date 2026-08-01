# 03 — Prior art: how do other apps present and detect series?

Type: research
Status: resolved
Blocked by: (none)
Resolved: 2026-07-31 — full findings in [`../research/03-prior-art-findings.md`](../research/03-prior-art-findings.md)
Parent: [map.md](../map.md)

## Question

How do comparable audiobook and media apps handle **series presentation**,
**sequence position**, **detection**, and **correcting bad detection**? Report
patterns worth stealing and patterns worth avoiding — with reasoning, not just a
catalogue.

AFK-suitable: resolve with a `/research` subagent, capture findings on a
throwaway `research/series-prior-art` branch, and link them back here.

## Targets, in rough priority order

1. **Audiobookshelf** (open source) — the closest analogue that exists. Has
   first-class series, tag-based detection, and a series-correction UI. Its source
   and docs are readable, so its *actual* precedence rules can be inspected rather
   than guessed.
2. **Audible** — the driver noted it switches screen layout by content type. Worth
   confirming: is a per-content-type layout shift a real convention, or an
   Audible quirk? This bears directly on ticket 08.
3. **Libby / OverDrive** — series handling in a catalogue-first app.
4. **Plex / Jellyfin audiobook agents** — mature metadata-matching UX, including
   "fix match" flows, which is exactly the correction problem here.
5. **Storygraph / Goodreads** — series *numbering* display conventions,
   particularly with gaps and novellas (2.5, 0.5).
6. Android players: **Voice**, **Smart AudioBook Player**, **BookPlayer** (iOS).

## Specific things to answer

- **Series list:** what is the repeating unit — a shelf row, a full-width card, a
  grid tile, a text row? How is a series distinguished from a single book at a
  glance?
- **Series identity art:** does a series get its own artwork, a stacked/fanned
  cover treatment, a collage, or just the first book's cover?
- **Sequence display:** where does the number live — badge on the cover, prefix in
  the title, a dedicated column? Is it *position* or *canonical number*?
- **Gaps:** what does a series with books 1, 3, 4, 8 look like? Are missing
  entries shown as placeholders, or silently skipped? (This is the driver's real
  Dresden case.)
- **Editions:** how does any of them handle the same series in two different
  recordings? This is the two-Mort problem and may have no prior art at all — a
  null result here is itself a finding.
- **Detection & correction:** is detection silent or proposed? Where does a user
  go to fix a wrong series? Is there a "these books couldn't be placed" inbox?
- **Progress:** how is *series-level* progress shown (next up, N of M finished, a
  bar)?

## Deliverable

A findings document with screenshots or concrete descriptions, organised by the
questions above, plus a short "what I would steal / what I would avoid" section.
Prefer primary sources — actual docs, actual source, actual screenshots — over
blog summaries.

## Answer

Method: Audiobookshelf (server + web + mobile) and Voice were **cloned and read**;
Audible's public catalogue API and rendered pages were queried live. Most claims
are source-verified. Full report: [`../research/03-prior-art-findings.md`](../research/03-prior-art-findings.md).

### 1. Sequence is **canonical**, universally — and it's a string

Audiobookshelf stores `sequence` as a **STRING on the join table**
(`BookSeries.sequence`), ordered `CAST(sequence AS FLOAT) ASC NULLS LAST`.
Audible does the same, and a title carries **several** memberships each with its
own sequence — *Guards! Guards!* is `#8` in Discworld and `#1` in City Watch.
Decimals ship in production (`Book 39.5`, `Book 40.5`).

→ Settles the core of [07](07-sequence-numbering.md): canonical number, stored
per-membership (not per-book), string-typed, float-sorted, nulls last. Also
confirms one book legitimately holds different numbers in different series — so
the number belongs on `series_books`, not `books`.

### 2. Gaps: collapse to a range, never placeholder

Owning 1, 3, 4, 8 renders as **`#1, 3-4, 8`** (~15 lines, `libraryHelpers.js:233`,
with a Cypress test). **No app anywhere renders placeholders for books you don't
own.** Answers [07](07-sequence-numbering.md)'s gap question outright.

### 3. Editions: a genuine null result — nobody has solved this

- Audiobookshelf makes it **structurally impossible**: a unique index on
  `(Series.name, libraryId)` plus a migration that *merges* same-name series and
  deletes the losers.
- Audible forks series entities only for abridgement and language. The 2022
  full-cast Discworld recordings **took over the same series ASIN** as the
  originals; Audible resolves the mixed provenance in **prose** ("Some of the
  audio is a vintage recording").
- Goodreads hangs editions off the *work*, so the question never arises.

→ [06](06-series-identity-edition.md) is genuinely novel. There is a schema shape
to borrow — **unique over `(name, edition)`** — but **no UX to copy.** Design it
from first principles; don't wait to find prior art.

### 4. Corrections: store overrides as **top-precedence inputs**, not lock flags

Audiobookshelf writes user edits back into `metadata.json`, which is the
**highest-priority source in its own detection chain** (`absMetadata` last, last
wins). A correction becomes a fact the detector reads first, so a rescan
*re-derives* it rather than fighting it. Jellyfin took the opposite route — a
lock flag — and it is a documented, unfixed mess (issue #16268: providers
name-search and clobber locked values).

→ Strong architectural steer for [02](02-detection-cascade.md) and the
review-and-correction surface still in the fog.

### 5. Two corrections to this map's assumptions

- **Folder precedence.** Audiobookshelf ranks folder structure **lowest** by
  default and flatly **refuses to guess** series depth — it mandates
  `{Author}/{Series}/{Book}` and reads by fixed position. This map's Notes call
  path "load-bearing", which remains true *for this library* (Mort 2022 has no
  series name in any tag). Both hold: path is the only signal for some books here,
  **and** inferring depth heuristically is something the most mature
  implementation deliberately refused to attempt. See the reconciliation in the
  map Notes.
- **The Audible premise is half-confirmed.** Series *is* a first-class Library
  section and the web templates provably diverge — but the phone app could not be
  verified. The one phone implementation read in full (ABS mobile) **reuses the
  same grid and card geometry** for series as for books. → For
  [08](08-browse-presentation.md): worth a prototype, not worth abandoning
  `BooksHome` continuity on.

### 6. Negative space

Voice parses `series`/`part` from `MVNM`/`MVIN` into its DB and has **zero UI**
for it. BookPlayer closed both series requests unimplemented. StoryGraph series
tracking is still an open roadmap item. **Three mature players declined to build
this** — a signal about cost, and about how little there is to copy.
