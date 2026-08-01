# 03 — Prior Art: How Other Apps Handle Series

Effort: `series-ux-redesign`
Researched: 2026-07-31
Status: `research`

## Evidence quality key

- **[SOURCE]** — read the actual source code (Audiobookshelf and Voice were cloned and
  read locally; paths below are repo-relative).
- **[DOC]** — official documentation / help centre, fetched directly.
- **[API]** — queried a live first-party API and read the response.
- **[PAGE]** — fetched and parsed the live rendered page.
- **[TRACKER]** — official issue tracker / roadmap, fetched via API.
- **[WEAK]** — blog, Reddit, third-party guide. Labelled inline; used only where
  nothing better exists.
- **[UNVERIFIED]** — could not check. Called out explicitly.

**What I could not verify at all:** the Audible *mobile app* UI (no account, cannot
run it), the Libby app UI beyond its help centre, and Smart AudioBook Player (closed
source, no usable primary documentation of series behaviour — treat any claim about it
as unverified).

---

## 1. Series list unit — what is the repeating element?

| App | Repeating element | How it reads as "a series" not "a book" |
| --- | --- | --- |
| **Audiobookshelf (web)** | **Grid tile, double-width.** `cardWidth = coverHeight / aspectRatio * 2` — a series tile is literally two book-covers wide in the same grid. | Three simultaneous signals: the double width, a **fanned stack of member covers** instead of one cover, and a **gold count badge** (`#cd9d49dd`) top-right. [SOURCE] `client/components/cards/LazySeriesCard.vue:1-30,62-64` |
| **Audiobookshelf (mobile app)** | Same grid tile, but the count badge is **dropped**. Only the fanned covers + name placard + progress bar remain. | [SOURCE] `audiobookshelf-app/components/cards/LazySeriesCard.vue:1-18` |
| **Audible (web series page)** | **Full-width row, vertically stacked**, with a `Book N` label rendered as a header *above* each row, then cover, title, "Discworld, Book N" subtitle, author, narrator, length, Abridged/Unabridged, ratings, price. | The series is its own *page*, not a tile in a list. [PAGE] `audible.com/series/Discworld-Audiobooks/B006K1LRQO` |
| **Goodreads** | **Full-width row** with `Book 1` as a header line above it. | Same shape as Audible. [PAGE] `goodreads.com/series/40650-discworld` |
| **Libby** | Series is **not a list unit at all** — it is a *section inside a title's detail screen*. "On a title's details screen, scroll down to see the series information." [DOC] `help.libbyapp.com/en-us/6018.htm` |
| **Voice** | **No series UI exists.** See §7. |

**The interesting one — Audiobookshelf's "collapse series" mode.** In the *All Books*
grid, ABS can collapse a series into a single card in place, so one card in the book
grid stands for N books. The collapsed card reuses the *book* card component with a
`collapsedSeries` payload attached, swapping the title for the series name and the
author line for `"{N} Books"`.
[SOURCE] `client/components/cards/LazyBookCard.vue:279-341`,
`server/utils/queries/libraryItemsBookFilters.js:655-668`

This is worth noting for JBAudio because it means ABS answers "series row or series
screen?" with **both, as a user toggle**, and does it without a second card component.

---

## 2. Series artwork

**No app in this survey gives a series its own artwork field.** This is a clean,
consistent finding.

- **Audiobookshelf**: the `Series` model has exactly three content columns — `name`,
  `nameIgnorePrefix`, `description`. There is **no `coverPath`**.
  [SOURCE] `server/models/Series.js:90-101`
- Artwork is synthesised at render time by `GroupCover.vue`: it takes the member
  covers, **slices to the first 10**, and fans them left-to-right with descending
  z-index so each card peeks out from behind the previous. Width per cover =
  `(cardWidth - coverWidth) / (n - 1)`. With one book it renders that cover full-bleed.
  With zero valid covers it falls back to the series **name as text** on a plain panel.
  [SOURCE] `client/components/covers/GroupCover.vue:164-195`
- **Audible** *does* have a series-level hero on the web series page, but it is
  editorial page furniture (title, "71 books in series", aggregate rating count, a
  written series summary, genre/mood chips) — not a series cover image. [PAGE]
- **Goodreads** shows no series image at all; the page is a header plus rows. [PAGE]

**Read on this:** a fanned collage is the universal answer because it is *free* — it
requires no new asset, no new column, and no user work, and it degrades gracefully
(1 book → normal cover; 0 covers → text). The 10-cover cap matters: beyond ~10 the fan
becomes visual noise and the per-cover offset collapses to nothing.

---

## 3. Sequence display — where the number lives, and which number it is

### Where it lives

- **Audiobookshelf**: a **badge overlaid on the cover, top-right**, rendered `#3`, on a
  translucent black pill. It shares the exact same slot and geometry as the podcast
  episode-count badge, and the same slot as the series card's gold count badge —
  ABS treats "top-right of a cover" as a single reserved corner for one numeric fact.
  Critically it is only rendered **when a series context is active**
  (`v-if="seriesSequence && !isHovering && !isSelectionMode"`, and `seriesSequence` is
  only populated by the server when filtering by series).
  [SOURCE] `client/components/cards/LazyBookCard.vue:96-98,247`;
  server side `server/utils/queries/libraryItemsBookFilters.js:632-637`
- **Audible**: number appears **twice** — as a `Book 4` group label above the row, and
  again inside the product subtitle `"Discworld, Book 4"`. The subtitle is a real
  catalogue field, not a rendering: the API returns
  `"subtitle": "Discworld, Book 1"` on the product. [PAGE] + [API]
- **Goodreads**: `Book 1` as a header line above the row. Never on the cover. [PAGE]
- **Libby**: inline in list and search results as `#1 in a series`; on the detail
  screen the current title is **starred within the series list** rather than numbered
  in place. [DOC] `help.libbyapp.com/en-us/6018.htm`

### Which number it is — canonical, not position

**Every system surveyed stores the CANONICAL published number, not the position in the
owned set.** This is unanimous and it is the single most transferable finding.

- **Audiobookshelf** stores `sequence` **on the join table**, `BookSeries.sequence`,
  typed `DataTypes.STRING`. It is a property of the (book, series) *pair*, so one book
  can be #1 in one series and #6 in another. [SOURCE] `server/models/BookSeries.js:11,44`
- It is a **string, sorted as a float**: `ORDER BY CAST(sequence AS FLOAT) ASC NULLS
  LAST`. That gives you 0.5, 2.5, 39.5 for free, tolerates `1a`, and pushes unnumbered
  books to the end. [SOURCE] `server/utils/queries/libraryItemsBookFilters.js:288-290,329,505`
- Series-page ordering falls back to `localeCompare(..., {numeric: true})` with
  null-sequence books sorted last. [SOURCE] `server/utils/queries/seriesFilters.js:194-199`
- **Audible** models it identically: a product carries an array of series memberships,
  each with its own string `sequence`. `The Colour of Magic` (B09LYZPFLZ) returns:
  ```
  SERIES B07MBK2865 #1  "Discworld: Rincewind"
  SERIES B006K1LRQO #1  "Discworld"
  ```
  and `Guards! Guards!` is `#8` in *Discworld* but `#1` in *Discworld: Ankh-Morpork City
  Watch*. Decimals are live in production: the series page renders `Book 39.5` and
  `Book 40.5`. [API] `api.audible.com/1.0/catalog/products?...&response_groups=series` + [PAGE]
- **Goodreads** uses decimals as formal policy: novellas between books 1 and 2 are
  numbered 1.5 (or 1.3/1.5/1.7 if several), and prequels are #0 (novel length) or #0.5
  (novella length) "regardless of their numbering elsewhere". [WEAK — Goodreads
  Librarians Group discussion threads quoting the manual; the manual page itself
  (help/show/475) was not directly reachable. The *behaviour* is confirmed
  independently by the rendered series page.]

**Implication for the JBAudio schema decision:** the map's "Canonical number" concept
is correct and universal. Do not store position-in-owned-set as the displayed number.
The cheapest correct shape is exactly ABS's: a **string column on the membership row**,
ordered by `CAST(... AS REAL)` with NULLs last. String-not-number buys you `1a`, `Vol
II`, and empty-but-present without a nullable-float dance.

---

## 4. Gaps — the user owns 1, 3, 4, 8

**No app renders placeholders for missing entries.** Gaps are silently skipped
everywhere in a *library* context. But two apps make the gap legible in different ways,
and one of them is directly stealable.

### Audiobookshelf: compressed range string

When a series card stands for a set of books, ABS renders the owned sequences as a
**collapsed range list** — contiguous runs merge, gaps break the run:

```js
// server/utils/libraryHelpers.js:233-249
naturalSort(books.map(b => b.filterSeriesSequence)).asc()
  .reduce((ranges, cur) => {
    const isNumber = /^(\d+|\d+\.\d*|\d*\.\d+)$/.test(cur)
    if (isNumber) cur = parseFloat(cur)
    const last = ranges.at(-1)
    if (last && isNumber && last.isNumber && last.end + 1 == cur) last.end = cur
    else ranges.push({ start: cur, end: cur, isNumber })
    return ranges
  }, [])
  .map(r => (r.start == r.end ? r.start : `${r.start}-${r.end}`))
  .join(', ')
```

Owning 1, 3, 4, 8 renders as **`#1, 3-4, 8`** in the badge. Non-numeric sequences never
merge into a range. There is a Cypress test asserting the `#1-3` form.
[SOURCE] `server/utils/libraryHelpers.js:233`,
`client/components/cards/LazyBookCard.vue:9-11`,
`client/cypress/tests/components/cards/LazyBookCard.cy.js:265-270`

This is the best gap answer I found anywhere. It is compact enough for a badge, it makes
the gap *visible* without inventing ghost rows, and it degrades to a plain `#3` for a
single book.

### Audible: gaps are visible because the catalogue is complete

The Audible series page is the publisher's full list, so every number is present and the
`Book N` labels run consecutively. A gap is therefore not a UI problem there — which
means **Audible offers no pattern to borrow for the owned-subset case.** [PAGE]

### Goodreads: two denominators

Goodreads' header reads verbatim: **`41 primary works • 89 total works`**. It also
cross-links **`Sub-series:`** (Discworld — DEATH, Ankh-Morpork City Watch, Witches,
Rincewind, Tiffany Aching) and **`See also:`** (Companion Books, Maps, The Science of
Discworld). [PAGE]

The lesson is not the number, it is the *admission that the denominator is ambiguous*.
"Book 3 of 41" and "Book 3 of 89" are both true. Any "N of M" progress string in
JBAudio has this problem and it has no clean answer from a local-only library — you do
not know M.

### StoryGraph: does not do this at all

Series tracking is an **open roadmap request**, not a feature. StoryGraph's Nadia, 5 Feb
2024: *"We will still eventually have some smarter, built in series tracking feature
(because of course you don't want to have to make a challenge for every series!)"* The
current workaround is Book-Specific Reading Challenges. The request text is a decent
external spec: *series name, last book finished, next book, a status line showing if
books are read or not read and if any books have been missed, sorted by series number or
publication date.* [TRACKER] `roadmap.thestorygraph.com/requests-ideas/posts/overview-of-series-i-m-in-the-middle-of`

---

## 5. Editions — the same series in two different recordings

### The short answer: NULL RESULT. Nothing models this. There is nothing to borrow.

This is worth stating flatly because it changes the shape of the decision: JBAudio is not
choosing between known designs here, it is designing something the field has not solved.

### Audiobookshelf: structurally impossible

`Series.name` carries a **unique index on `(name, libraryId)`**, added in a dedicated
2.15.0 migration that first *deduplicates* existing rows by merging their `bookSeries`
memberships and deleting the losers. Lookup is case-insensitive
(`where(fn('lower', col('name')), seriesName.toLowerCase())`).

```
{ fields: ['name', 'libraryId'], unique: true, name: 'unique_series_name_per_library' }
```

[SOURCE] `server/models/Series.js:118-124`, `server/migrations/v2.15.0-series-column-unique.js`

So two Discworld editions in one ABS library **cannot both be called "Discworld"**. Your
only options are a distinguishing suffix in the name, or two separate libraries. There is
no `edition`, `narrator`, or `recording` dimension anywhere on `Series` or `BookSeries`.
And because a user request to rename would collide, ABS would *merge* them — which is
what the migration does deliberately.

### Audible: forks the series NAME, and only for abridgement and language

Audible has genuinely distinct series entities for what are arguably editions — but only
along two axes:

```
B006K1LRQO  "Discworld"              (current unabridged)
B006K1RPDS  "Discworld (abridged)"   (Tony Robinson abridgements)
B084RNH6VL  "Mundodisco"             (Spanish)
B07MBK2865  "Discworld: Rincewind"   (sub-series, not an edition)
```

Sequence numbers restart at 1 in each. [API]

But for the developer's actual case — **two unabridged recordings of the same 41 novels**
— Audible does **not** model them in parallel. The 2022 full-cast recordings occupy the
*same* series ASIN (B006K1LRQO) that the older recordings did; the slot for `Book 1` is
now Colin Morgan/Bill Nighy, and the Nigel Planer editions are simply not in that list.
The series *summary text* still says "Narrators of the series include Nigel Planer and
Tony Robinson" and "Please note: Some of the audio is a vintage recording" — i.e. Audible
resolves the edition problem in **prose**, not in data. The list itself is heterogeneous:
`Book 22.5` is a 1999 abridged Frank Muller recording; books 30–32 and 34, 38, 39, 41 are
2004 Stephen Briggs recordings; the rest are 2022 full-cast. One product per number, mixed
provenance. [PAGE] pages 1–4 of the series listing.

**So Audible's model is: series identity = (work-series × abridgement × language). A
re-recording replaces the previous occupant of a numbered slot rather than coexisting
with it.** Audible never needs the two-editions case because it delists.

### Goodreads / StoryGraph: editions are a child of the work, so the question cannot arise

Goodreads' `Book 1` row shows `95 editions` as a *count behind the work*. Series
membership is attached to the **work**, and every recording, translation and printing
hangs off that work as an edition. There is exactly one Discworld series and it can never
fork by narrator. [PAGE]

### Plex / Jellyfin: no audiobook series concept at all

Neither has a native audiobook series entity. The community answer is Plex **collections**
(via Kometa/Plex Meta Manager driven off Audnexus' Mood tags) or folder structure —
collections are just named bags, so two editions are two collections with two names. Same
naming workaround, one abstraction level lower.
[SOURCE-adjacent] `seanap/Audiobooks.bundle` README (primary, third-party plugin):
series → Plex `Mood` field, ordering via the `AlbumSort` tag, folder shape
`%author%/%series%/%year% - %album%/`.

### What this means for JBAudio

Every system either (a) makes series name the unique key and forces disambiguation into
the name, or (b) hangs editions off a work so series can't fork. JBAudio's real library —
Discworld 41 × 2 = 82 books, both editions present *simultaneously*, both wanted — is
outside the shape all of these assume.

The only pattern with any support in the evidence is **(a) with a disambiguator that is
part of identity but not part of the display name** — i.e. store `(name, edition)` as the
unique key, render `name` in the browse list and only surface `edition` where two
memberships would otherwise collide. Audible's `"Discworld (abridged)"` is that idea done
manually and permanently; you can do it automatically and conditionally. But note that
nobody has shipped it, so there is no UX to copy — only a schema shape.

---

## 6. Detection & correction

### Is detection silent or does it propose?

**Audiobookshelf: silent and automatic, with a layered override chain.** There is no
confirmation step for scan-derived series. The scanner runs a fixed list of sources in
order, each overwriting the last:

```js
// server/models/Library.js:84-86
static get defaultMetadataPrecedence() {
  return ['folderStructure', 'audioMetatags', 'nfoFile', 'txtFiles', 'opfFile', 'absMetadata']
}
```

Last wins. The official wording: the server *"will attempt to fill each field using the
local metadata source with the lowest enabled priority, then overwrite any fields with the
second lowest enabled priority."* The order is **user-configurable per library**.
[SOURCE] + [DOC] `audiobookshelf.org/guides/book-scanner/`

The two signal paths that matter for JBAudio:

**(a) Embedded tags** — `server/scanner/AudioFileScanner.js:258-340`, reading only
`audioFiles[0]`:

| Concept | ffprobe lookup order | Notes |
| --- | --- | --- |
| series | `series`, `show`, `mvnm` | primary |
| series part | `series-part`, `episode_id`, `mvin`, `part` | primary |
| series (fallback) | `grouping`, `grp1` | **alt tag** |

[SOURCE] `server/utils/prober.js:191-193`

The `grouping` fallback has its own grammar: when series came from `grouping`, the value
is split on `;` and each fragment parsed with `parseSeriesString`, which pulls a trailing
` #<token>` off the end:

```js
// server/utils/parsers/parseSeriesString.js
const matchResults = seriesString.match(/ #([^#\s]+)$/)
// "Name #1a"  => { name: 'Name', sequence: '1a' }
// "Name #1#a" and "Name #1 a" do NOT match
```

so `"Test Series; Series Name #1; Other Series #2"` yields three memberships. When series
came from the *proper* `series` tag, multi-series is instead detected by both `series` and
`series-part` containing `;` with **equal element counts** — otherwise it is treated as one
series with `series-part` as the whole sequence.
[SOURCE] `server/scanner/AudioFileScanner.js:296-340`

**Independent corroboration of `mvnm`/`mvin`:** Voice's Android scanner maps ID3
`TXXX:MVNM → series` and `TXXX:MVIN → part` (plus `TXXX:PART`), and needed a *custom
binary reader* for m4a because androidx.media doesn't expose movement frames.
[SOURCE] `Voice/core/scanner/src/main/kotlin/voice/core/scanner/MediaAnalyzer.kt:186-192`,
PR advplyr-style `PaulWoitaschek/Voice#3054` (merged 2025-09-04)

**(b) Folder path** — and ABS's approach here is the direct rebuttal to the JBAudio
problem that "the series folder is the parent for one book and the grandparent for
another". ABS **does not guess**. It mandates `{Author}/{Series}/{Book}` or
`{Author}/{Book}` and reads by fixed position from the right:

```js
// server/utils/scandir.js:150-160
var folder  = splitDir.pop()                                  // always the title dir
series      = splitDir.length > 1 ? splitDir.pop() : null      // needs >=2 remaining
author      = splitDir.length > 0 ? splitDir.pop() : null
...
var [folder, sequence] = series ? getSequence(folder) : [folder, null]
```

Two details worth lifting:

1. **Sequence extraction is gated on a series folder existing.** No series dir → the
   `getSequence` pass never runs, so `"1984"` and `"101 Dalmations"` in a two-deep layout
   can never be mistaken for `Book 1` / `Book 101`.
2. `getSequence` itself is deliberately conservative. It splits the folder on `" - "` and
   for each part applies
   `/^(?<volumeLabel>vol\.? |volume |book )?(?<sequence>\d{0,3}(?:\.\d{1,2})?)(?<trailingDot>\.?)(?: (?<suffix>.*))?$/i`,
   **rejecting any match that has a suffix but neither a volume label nor a trailing dot**
   — which is precisely the rule that excludes `101 Dalmations` while accepting
   `101. Dalmations`, `Book 2 - Title`, `Vol. 3 Title Here`, and `0.5 - Book Title`.
   [SOURCE] `server/utils/scandir.js:188-220`

Also note folder structure is **lowest** priority by default — path is the fallback, tags
win. That is the opposite of what the JBAudio map currently assumes ("folder path is
load-bearing"); given JBAudio's corpus has `Grouping` on only 1 of 5 sets, precedence
there is a genuinely open question, but ABS's *ordering being configurable per library* is
the safety valve that makes a wrong default survivable.

**Audiobookshelf's one propose-and-confirm surface is the online *Match* flow, and it is
excellent.** `Match` presents the candidate's fields as a **checkbox per field**, all
individually editable before applying, with a "Select All" master, and — for fields that
already have a value — an inline `Currently: <value>` where the current value is a
clickable link that stuffs it back into the field.

```html
<ui-checkbox v-model="selectedMatchUsage.series" ... />
<widgets-series-input-widget v-model="selectedMatch.series" :disabled="!selectedMatchUsage.series" />
<p v-if="mediaMetadata.seriesName">{{ $strings.LabelCurrently }}
  <a @click.stop="setMatchFieldValue('series', mediaMetadata.series)">{{ mediaMetadata.seriesName }}</a></p>
```

[SOURCE] `client/components/modals/item/tabs/Match.vue:35,122-129`

**Plex**: `Fix Match` is per-item, opened from the `…` overflow on the item detail screen.
It runs a search immediately and shows ranked candidates with disambiguating info; `Search
Options` lets you override title / year / language; and you can force an exact match by
typing a provider ID as the search term (`imdb-tt1217209`, `tvdb-110381`, `tmdb-10283`, a
MusicBrainz MBID). If the item is wholly unmatched the menu reads `Match` instead. The
critical structural note: *"For television libraries, Fix Match… is only available at the
show level (not at the season or episode level)."* — **correction is applied at the
grouping level, not the child level.** [DOC] `support.plex.tv/articles/201018497-fix-match-match/`

### Where does the user go to fix a wrong series?

- **Audiobookshelf: book-first, always.** The book's *Edit Details* has a Series field —
  a multi-select with an edit affordance per chip; editing opens a small modal with `name`
  + `sequence`; the chip renders `"Name #3"`. Adding a duplicate name is rejected client
  side. [SOURCE] `client/components/widgets/SeriesInputWidget.vue:1-90`,
  `client/components/modals/EditSeriesInputInnerModal.vue`
- There is **no series-first editing UI**. `SeriesController` exposes only `findOne` and
  `update`, and `update` is annotated in-source:
  `// TODO: Currently unused in the client, should check for duplicate name`. You cannot
  rename a series, reorder it, merge two, or split one from a series screen.
  [SOURCE] `server/controllers/SeriesController.js:64-88`
- **The ABS mobile app has no series editing at all.** Its `components/modals/` directory
  contains no edit-details modal; series appear only in browse, filter and item-detail
  read paths. Corrections are a desktop/server activity.
  [SOURCE] `audiobookshelf-app/components/modals/`
- Series are **auto-reaped**: after a scan, any series whose book count fell to zero is
  deleted. [SOURCE] `server/scanner/BookScanner.js:977-1001`

### Is there an "unmatched / couldn't be placed" inbox?

**No — not in any app surveyed.** ABS has an *Issues* filter on the bookshelf, but it
means "missing or invalid files", with a bulk `Remove All` button; it has nothing to do
with metadata confidence. [SOURCE] `client/components/app/BookShelfToolbar.vue:75,307,516`

Nobody has a "these N books look like a series, confirm?" queue. If JBAudio builds a
review-and-correction surface as the map proposes, **it is not copying anyone.**

### Does a correction survive re-scan?

This is where the field splits into a good pattern and a bad one, and the difference is
stark.

**Audiobookshelf — good.** The user's edit is written back into the **highest-priority
detection source**, so the next scan re-derives the same answer instead of being blocked
from re-deriving. `saveMetadataFile()` serialises the item to `metadata.json` and encodes
series as strings in exactly the format `parseSeriesString` reads back:

```js
series: mediaExpanded.series.map((se) => {
  const sequence = se.bookSeries?.sequence || ''
  return sequence ? `${se.name} #${sequence}` : se.name
})
```

[SOURCE] `server/models/LibraryItem.js:616-676`. It is called from the edit controllers
(`MiscController.js:361,404,499,542`) *and* from the scanner itself
(`BookScanner.js:395,641`). Default location is `/metadata/items/<id>/metadata.json`;
`storeMetadataWithItem` moves it next to the audio instead
(`ServerSettings.storeMetadataWithItem = false` by default).
`absMetadata` sits **last** in `defaultMetadataPrecedence`, so it wins.

The documented failure mode, verbatim: *"If this is disabled, any edits you make to
metadata through Audiobookshelf will be lost the next time the library item is scanned or
updated."* [DOC]

**Jellyfin — bad, and instructive.** Manual `Identify` sets the provider ID correctly and
then triggers a full refresh in which *all* enabled providers run again. Providers with no
matching ID **fall back to name-based search**, and a wrong name hit overwrites the
correct data. The reported example: user picks TheMovieDb for "Animusic"; TheTVDB then
name-searches, returns "Animatic Battle", and clobbers it. The only workaround is
*"Disable TheTVDB at the library level, Identify with TheMovieDb, Lock the item metadata,
Re-enable TheTVDB"* — and locking then blocks all legitimate future updates.
[TRACKER] `github.com/jellyfin/jellyfin/issues/16268` (see also #11773, same theme)

**Voice — worst, and it is an audiobook app.** Voice auto-merged multiple books into one:
*"Voice auto-merge series of book from the same author, the issue is that some are in the
wrong order… the worse is that voice forgot where I was in the book I had started when it
merged with the new files that I added. so now I have to listen to 71hours before I can
remove a book."* Silent grouping destroyed playback position and had no undo.
[TRACKER] `github.com/PaulWoitaschek/Voice/issues/1001` (closed 2023-05-13)

The generalisable rule: **a correction that is stored as a *suppression flag* rots; a
correction that is stored as a *higher-priority input* survives.** ABS chose the second and
it is why its model works. Jellyfin chose the first (lock) and it is why its model doesn't.

---

## 7. Series-level progress

- **Audiobookshelf** shows a **single bar across the bottom edge of the series tile**, in
  yellow while in progress and green when the whole series is finished. The value is the
  mean of per-book progress with finished books counted as 1.0:
  ```js
  seriesPercentInProgress() {
    let p = 0
    this.seriesBookProgress.forEach(pr => { p += pr.isFinished ? 1 : (pr.progress || 0) })
    return clamp(p / this.books.length)
  }
  isSeriesFinished() { return this.books.length === this.seriesBooksFinished.length }
  ```
  Denominator is **books the user actually has**, not the published count. No "3 of 7"
  string is shown anywhere. [SOURCE] `client/components/cards/LazySeriesCard.vue:121-145`
- **"Continue Series" shelf** — the real next-up mechanism, and it is careful. A series
  qualifies when it has ≥1 finished book, ≥1 unfinished book, and **zero books currently
  in progress** (so it never competes with "Continue Listening"). Ordering is by the most
  recent progress timestamp anywhere in the series. A per-user
  `seriesHideFromContinueListening` array lets a user dismiss a series from the shelf.
  [SOURCE] `server/utils/queries/libraryItemsBookFilters.js:697-760`
- The gap-relevant twist: a library setting `onlyShowLaterBooksInContinueSeries` adds
  `AND CAST(bs.sequence AS FLOAT) > (SELECT max(CAST(bs.sequence AS FLOAT)) ... WHERE
  isFinished = 1)`. Off → next-up is the lowest-numbered unfinished book (so finishing #3
  after #1 surfaces #2). On → next-up is the lowest-numbered book strictly *above your
  high-water mark*, and if none exists the series drops off the shelf entirely.
  [SOURCE] same file, lines 721-726, 795-806
- **Audible**: series-level *aggregate* stats on the series page (`71 books in series`,
  `75,156 ratings`) but no cross-series progress on that page. Per-title progress lives in
  the Library. [PAGE]
- **Libby / Goodreads / StoryGraph / Plex / Jellyfin / Voice / BookPlayer**: none. Libby's
  star-the-current-title marker on the detail-screen series list is the closest thing, and
  it is a position indicator, not progress. [DOC]

---

## 8. Apps that deliberately do NOT have series (useful negative space)

- **Voice** (Android, open source, the closest peer to JBAudio). PR #3054 (merged
  2025-09-04) added `series` and `part` to the scanner, the `BookContent` model, the Room
  schema (v58) and the FTS index. But on current `main`, `series` appears in `features/`
  **only in test factories** — `features/bookOverview/src/test/.../BookFactory.kt` and
  `features/playbackScreen/src/test/.../BookPlayViewModelTest.kt`. Outside tests it exists
  in exactly three places: `BookContent.kt:29`, `BookContentDao.kt:44`, and the scanner.
  **The data is captured; no UI displays or groups by it.** The PR author's own suggested
  `SeriesLine(book.series, book.part)` composable was a testing aid and was not merged into
  any UI file. Open issue #3048 ("App doesn't recognize series") is still open; #487
  ("Feature Request: Series Grouping", 2017) was closed without implementation.
  [SOURCE] local clone of `PaulWoitaschek/Voice` @ main + [TRACKER]
- **BookPlayer** (iOS, open source): #428 "Series Management" (2020) and #616 "Library
  Categories and Series" (2021) both closed without implementation. Folders/playlists are
  the answer. [TRACKER]
- **Smart AudioBook Player**: documented structure is `Audiobooks/Author/Book Title/*.mp3`
  — two levels, no series slot. [WEAK — third-party guides only; no primary source found.
  Treat as unverified.]

That three mature Android/iOS audiobook players have all *declined* to build series is
itself a data point: the feature is not table stakes, so JBAudio's version should be
justified by the 350-title / 82-Discworld-file reality, not by parity.

---

## What I would steal

1. **Sequence as a string on the membership row, ordered `CAST(... AS REAL) NULLS LAST`.**
   ABS's exact shape. It is the canonical published number, it lives on the (book, series)
   pair so one book can be #8 in Discworld and #1 in City Watch, and the float cast gives
   you 0.5 / 2.5 / 39.5 free while tolerating `1a`. Audible's live API independently uses a
   string `sequence` on a per-membership array; two systems converging is enough.
   *Evidence: §3.*

2. **The compressed range badge — `#1, 3-4, 8`.** This is the single best idea I found and
   it is ~15 lines. It is the only thing anywhere that makes a gapped owned-set legible at
   a glance without inventing placeholder rows, and it collapses to `#3` for the single-book
   case. It also answers the developer's stated situation exactly.
   *Evidence: §4, `libraryHelpers.js:233`.*

3. **Fanned collage series art, capped at ~10, degrading to full-bleed at 1 and to a text
   panel at 0.** No new column, no new asset, no user work, and it is what both the ABS web
   client and the ABS mobile app do. Do not add a series artwork field — nobody has one.
   *Evidence: §2.*

4. **Write corrections back into the highest-priority detection source, not into a
   "don't re-detect" flag.** This is the load-bearing architectural steal. A user override
   should be a *fact the detector reads first*, so re-scan re-derives the corrected answer
   rather than being blocked. ABS does it by serialising to `metadata.json` and putting
   `absMetadata` last in precedence; JBAudio's equivalent is an override row keyed by
   structural key that the detector consults as its top-precedence source. Jellyfin's lock
   flag is the counterexample and it is a documented, unfixed mess.
   *Evidence: §6, `LibraryItem.js:616`, jellyfin#16268.*

5. **Field-level accept/reject with "Currently: X ← click to restore".** ABS's Match tab.
   For the review-and-correction surface the map is planning, this is the right granularity:
   not "accept this whole proposal" but a checkbox per field, pre-filled and still editable,
   with the existing value one tap away. Cheap, and it makes a wrong proposal costless.
   *Evidence: §6, `Match.vue:122-129`.*

6. **Gate sequence-extraction on a series actually having been identified.** ABS's
   `series ? getSequence(folder) : [folder, null]` plus the "suffix requires a volume label
   or trailing dot" rule is what stops `101 Dalmations` becoming Book 101. Given JBAudio's
   corpus, this class of false positive is a near certainty otherwise.
   *Evidence: §6, `scandir.js:150-220`.*

7. **`mvnm` / `mvin` (movement name / movement number) as a first-class tag path.** ABS
   reads `series, show, mvnm` and `series-part, episode_id, mvin, part`; Voice reads
   `TXXX:MVNM` and `TXXX:MVIN`. Two independent implementations agree. The map notes
   `Grouping` is present on only 1 of 5 sample sets — worth re-sampling for MVNM/MVIN before
   settling precedence, because it may be better covered than `Grouping` and it is
   unambiguous where `Grouping` is not.
   *Evidence: §6.*

8. **"Next up" that stands down when something is already in progress.** ABS's Continue
   Series requires zero in-progress books in the series, so it never fights the plain
   Continue Listening row. Small rule, prevents a duplicate-surfacing bug you would
   otherwise ship and then have to diagnose.
   *Evidence: §7.*

## What I would avoid

1. **Silent auto-grouping with no undo.** Voice #1001 is the cautionary tale: automatic
   merging produced wrong order, a 71-hour "book", and — worst — *lost the user's playback
   position*. JBAudio's series are user-visible groupings over books that already carry
   progress, so a bad auto-merge has the same blast radius. If detection is silent, the undo
   must be as cheap as the detection was; the map's proposal concept is the right instinct
   and the evidence supports it.
   *Evidence: §6.*

2. **Making series name the unique key.** ABS's `unique_series_name_per_library` is the
   direct cause of it being unable to represent two Discworld editions, and its 2.15.0
   migration actively *merges* same-name series and deletes the losers. With 82 Discworld
   files across two editions, adopting this constraint would silently destroy exactly the
   case JBAudio exists to handle. If uniqueness is needed, it must be over
   `(name, edition-discriminator)`.
   *Evidence: §5.*

3. **A "locked / do not re-detect" flag as the correction mechanism.** Jellyfin's lock is
   all-or-nothing: it stops the clobbering *and* stops every legitimate future improvement,
   and users are told to disable providers, identify, lock, re-enable. Anything with this
   shape decays into a library full of frozen items nobody dares rescan.
   *Evidence: §6.*

4. **Placeholder rows for books you don't own.** No app does it. It would make Discworld
   render 41 rows of which the user owns 12, and it requires a canonical series length you
   cannot know from local files. The range badge conveys the same information in one line.
   *Evidence: §4.*

5. **"Book 3 of 7" as a series progress string.** Goodreads' own header — `41 primary works
   • 89 total works` — is an admission that the denominator is ambiguous even for the
   authoritative catalogue. Locally you have neither number. ABS deliberately shows a
   *bar* whose denominator is books-you-own and no fraction at all. Copy the bar; skip the
   fraction.
   *Evidence: §4, §7.*

6. **Making the sequence badge always-on.** ABS renders `#N` only when a series context is
   active, and the server only populates the field then. Showing a sequence badge on every
   cover in the main library turns a useful signal into noise and collides with whatever
   else wants the cover's top-right corner (ABS reserves that one corner for exactly one
   numeric fact across book cards, series cards and podcast cards).
   *Evidence: §3.*

7. **Series-first editing as the only correction path — or as the first one built.** ABS
   has *no* series-first editing (`SeriesController.update` is dead code, annotated as such)
   and it survives, because per-book editing plus auto-reaping of empty series covers the
   real cases. Build book-first correction first; a series-first "split / merge / reorder"
   screen is a second-order feature, not the entry point.
   *Evidence: §6.*

8. **Assuming Audible's per-content-type layout divergence licenses a bespoke series screen
   on phone.** Partly confirmed, partly not — see the caveat below.

---

## Appendix: the Audible layout-divergence question, answered as precisely as I can

The developer's premise is *"Audible switches layout per content type; that convention is
worth a prototype rather than an assumption."* Splitting it into what I can and cannot
verify:

**CONFIRMED — the Library is segmented by content type.** Audible's own help page lists the
app Library's sections as **Audiobooks, Podcasts, Wish List, Lists, Authors, Series,
Genres**, navigated by swiping between them. `Series` is a first-class library section, not
a filter. [DOC] `help.audible.com/s/article/manage-your-library`

**CONFIRMED — on the web, the series template and the product template are genuinely
different pages, not one template with a variant flag.** Fetched both and diffed the
markers:

| Marker | `/series/…/B006K1LRQO` | `/pd/…/B09LYZPFLZ` |
| --- | --- | --- |
| `71 books in series` | present | absent |
| series-level Summary + genre/mood chips | present | absent |
| numbered `Product List` (`Book 1`, `Book 2`, …) | present | absent |
| `Series:` cross-link | absent | present |
| `Listeners also enjoyed` / `People who viewed` | absent | present |

[PAGE] both fetched 2026-07-31.

So the divergence is real on web, and the *information architecture* divergence is real in
the app. The series surface is a **list-of-ordered-things with an aggregate header**; the
product surface is a **single-item detail with recommendations**. Those are different jobs
and they get different layouts.

**NOT CONFIRMED — that the Audible *phone app* renders a structurally different screen per
content type.** I have no Audible account and cannot run the app; I found no official
screenshots or design documentation showing the in-app series screen. Everything above is
web + help-centre inference. **Do not treat "Audible switches layout per content type in
the app" as established.** What *is* established is weaker but still decision-relevant:
Audible treats Series as its own top-level library section rather than a filter over books,
and on web gives it a template whose job is ordered enumeration plus an aggregate header.

That is enough to justify prototyping a distinct series surface. It is not enough to
justify abandoning `BooksHome` continuity on the grounds that "Audible does it" — the
premise is only half-verified, and the one comparable *phone* implementation I could read
in full (the Audiobookshelf mobile app) reuses the same grid, the same card geometry and
the same bookshelf chrome for series as for books, changing only the cover treatment and
dropping the count badge.
