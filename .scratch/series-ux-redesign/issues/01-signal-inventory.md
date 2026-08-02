# 01 — Signal inventory: what series-bearing data actually exists?

Type: prototype
Status: resolved
Blocked by: (none)
Resolved: 2026-08-01 — real-library sample (304 units on-device) + tool-parity verification. See Answer.
Parent: [map.md](../map.md)

## Question

Across a real library, **which fields carry series identity, series position, and
edition — and how consistently?** Produce an evidence table, not a hunch, and be
explicit about what is *absent*.

This is deliberately the inventory only. Designing the precedence rules is
ticket 02; resolving what a series *is* is ticket 06. Do not skip ahead — an
eager first pass that jumps to rules is exactly what splitting these two tickets
was meant to prevent.

## Why this is first

Every other decision on this map is downstream of how reliable detection can be.
If detection is 95% accurate the UI is a quiet confirmation step; if it is 60%
accurate the UI is a correction workbench. Those are different products.

## Evidence already gathered (2026-07-31, `emulator-5554`)

Read with `ffprobe` against byte ranges pulled off the device. `Grouping` does not
appear in `ffprobe`'s normalised output — it was read from the Dresden `.nfo`
files, which are MediaInfo text dumps.

| | **Dresden 01/03/04/08** | **Bobiverse 02** | **Mort (2022)** | **Mort (1980s)** | **Bands of Mourning** |
|---|---|---|---|---|---|
| `Grouping` | ✅ `The Dresden Files` | — | — | — | — |
| `album` | `The Dresden Files #1: Storm Front` | `Bobiverse 02 For We Are Many` | `Mort (#4)` | `Discworld 04 - Mort` | `Mistborn 6 (Michael Kramer)` |
| `artist` | Jim Butcher | Dennis E. Taylor | Terry Pratchett | Terry Pratchett | Brandon Sanderson |
| `album_artist` | — | — | — | Terry Pratchett | Brandon Sanderson |
| `composer` → narrator | James Marsters | Ray Porter | Colin Morgan, Peter Serafinowicz, Bill Nighy | **absent** (in `comment`: "Read by Nigel Planer") | Michael Kramer |
| `title` | = album | = album | = album | `Discworld 04 - Mort - 01` (track) | `01.The Bands of Mourning` (track) |
| `track` | — | — | — | `01/07` | `01` |
| folder | `The Dresden Files 04 - Summer Knight` | **`Dennis E. Taylor`** (author!) | `Discworld (2022)` | `Discworld/Discworld 04 - Mort` | `6.The Bands of Mourning` |
| container | m4b + cue | m4b | m4b | 7 × mp3 | 39 × mp3 |

### Five books, five conventions — the specific traps

1. **Series name location varies:** dedicated tag (Dresden) · album prefix
   (Bobiverse, Mort 1980s, Mistborn) · **folder only** (Mort 2022 — its tags
   contain no series name at all).
2. **Folder depth varies:** series folder is the *parent* for Mort 2022, the
   *grandparent* for Mort 1980s.
3. **The folder can be the author.** Bobiverse's folder is `Dennis E. Taylor`.
   Candidate guard: it *equals the `artist` tag*.
4. **The album can contain the narrator.** `Mistborn 6 (Michael Kramer)` —
   detectable because the parenthetical equals `composer`.
5. **The book title may exist only in the folder.** *The Bands of Mourning*'s
   `title` tag is the track name; the real title is in `6.The Bands of Mourning`.
6. **Narrator is not always available.** Mort 1980s has no `composer`, so the
   app's `narrator` column would be blank — it cannot be leaned on for edition
   discrimination.

## What this ticket still needs

- **Widen the sample.** 8 books cannot characterise a 350-title library. Sample
  the real library (or a larger curated pull) and report *frequencies*: how often
  is `Grouping` present? how often does `album` contain a parseable series+number?
  how often is the folder the author?
- **Enumerate the candidate signals formally**, including ones not yet looked at:
  `Album_Performer`, `Track_Position`, `Part`/`movement` atoms, `.cue` `TITLE`,
  `.nfo` presence, `sort_album`, and anything in MediaInfo's `extra` bag.
- **Confirm `Grouping` survives the JSON path.** The Dresden evidence is from
  MediaInfo's *text* output. Verify the key's exact name and location in the JSON
  the turbomodule actually returns (top-level on `General`, or under `extra`).
- **Record what is unambiguously absent**, so ticket 02 does not design rules
  around fields that are not there.

## Answer

Resolved 2026-08-01. The sample is no longer 8 books: **304 book units from the
driver's real phone library** (`/sdcard/Audiobooks`, 57 author folders, 3,790
files, tag regions pulled over USB) plus **140 units across three local stores**.
Every tag read used a **host build of the exact MediaInfoLib v25.10 source the
turbomodule bundles**, with the turbomodule's exact options (`Internet=No`,
`Cover_Data=""`, `Output=JSON`) — these are the keys and values the app itself
sees. ffprobe ran in parallel as a cross-check. Raw data + probe scripts:
[`../research/01-signal-inventory/`](../research/01-signal-inventory/).

**Two framing rules (driver-set, 2026-08-01), which the whole table below is
read through:**

1. **Folder findings are *this library's* facts, not rules.** The app does not
   enforce library structure (deliberately unlike Audiobookshelf), so any
   folder-derived signal is **non-portable**: another user's tree may be flat,
   or arbitrary. Tag and sidecar signals travel with the files; folder signals
   do not. Every signal below is labelled for portability.
2. **Most books in a typical library are standalones** — absence of series
   tags on a standalone is *correct data*, not signal failure. The meaningful
   denominator is books that genuinely belong to a series. (This particular
   library is unusually series-heavy: ~239 of 304 units (~79%) belong to one of
   34 multi-book series — Jason's library is the stress case, not the norm.)

### The headline: what fraction of genuinely-in-series books can auto-group?

Ground truth: 239 units across 34 real multi-book series (hand-labelled;
~12 further units are *singleton* series members — one owned book of a known
series — which cannot meaningfully "group" and are excluded).

| Evidence tier | Coverage of the 239 in-series units | Portable? |
|---|---|---|
| Explicit series tag (`Grouping` / `extra.SERIES`+`PART`) | 32 (13%) | ✅ yes |
| Album embeds **series name + number** ("Demon Accords", "Mistborn 6", "Discworld 04 - Mort", "…: Discworld, Book 20") | ~124 (52%) | ✅ yes (needs parsing) |
| **Either portable signal** | **~136–142 (≈57–60%)** | ✅ |
| Folder adds a number and/or a series-named directory | +~90 more | ❌ this library only |
| **Nothing anywhere** (no tag, bare album, no series-named folder) — e.g. the Bas-Lag trilogy in `{YEAR - Title}` folders, Red Rising flat under the author, LibriVox Barsoom | ~10 (4%) | — |

**Rough answer to the driver's question: ~60% of this library's series books
carry portable machine-usable series identity; ~96% is reachable if this
library's folder names are also trusted; ~4% is dark to every signal.** Whether
60%-portable is good enough — and whether a *recommended* (not enforced)
structure discussion is worth having — is deferred until ticket 02 measures
what a real cascade achieves (fog item added to the map).

### Field-by-field inventory (real library, n=304; 288 with `Album`)

| Field (MediaInfo JSON key) | Present | What it holds — and how it lies | Portable? |
|---|---|---|---|
| `Album` | 288 | Book title; 38% embed series/number in ≥6 shapes: `Discworld 04 - Mort`, `…: Discworld, Book 10`, `(#11) Reaper Man`, `Small Gods (#13)`, `Mistborn 6 (Michael Kramer)` (narrator embedded), `Crouch, B: 1 Pines` (author-mangled), Roman numerals (`The Dark Tower IV:`) | ✅ |
| `Performer` (artist) | 289 | Author 80% (237 match author folder). Failures are *structured*: narrator-in-artist (every Blake Crouch book = "Paul Michael Garcia"), `Narrator / Author` combos ("Michael Kramer / Brandon Sanderson"), spelling drift (Aronovitch/Aaronovitch, Mieville/Miéville), **series-in-artist** (WoT, local) | ✅ |
| `Album_Performer` | 175 | Author in some rip generations, **narrator** in others (Expanse), junk in others. Meaning is per-rip | ✅ |
| `Composer` | 153 | Narrator when present (51%) | ✅ |
| `extra.nrt` / `extra.NARRATEDBY` | 61 / 9 | Narrator (Audible rip generations) | ✅ |
| `Grouping` | 17 | Series name (Dresden, MST) — but polluted elsewhere: `Warbreaker 1`/`2` (split-book parts), `The Hexologists, Book #2` (name+number crammed in), `Discworld 13` | ✅ |
| `extra.SERIES`/`PART`/`SUBTITLE` | 20/18/17 | Clean machine series+number (`The Wandering Inn`/`8`). Gold standard; recent Audible-style rips only. Decimals real (`17.5`) | ✅ |
| `extra.AUDIBLE_ASIN`/`asin`/`CDEK` | 43 | Stable external ID for ~14%; also appears in some *filenames* (`[B004K4EMHE]`) | ✅ |
| `Track_Position`/`_Total` | 146/79 | File index within a book — **not** series position | ✅ |
| `ContentType` | 28 | `Audiobook` (decoded iTunes stik) | ✅ |
| `Album_Sort` | 4 | **Effectively absent — do not design on it** | — |
| `Part_Position` (disc) | 7 | Effectively absent | — |
| movement atoms (`mvnm`/`mvin`) | 0 | **Absent everywhere** | — |

### Sidecars (never inventoried before)

| Sidecar | Count | Series value | Portable? |
|---|---|---|---|
| `.nfo` "General Information" dialect | 36 | `Read By:` narrator **36/36** — best narrator source in the corpus; `Series Name:` only 2/36, `Position in Series:` 1/36 | ✅ travels with files |
| `.nfo` MediaInfo-dump dialect | 17 | Mirrors tags (Dresden) | ✅ |
| `.opf` calibre | 17 | `calibre:series` + `calibre:series_index` — perfect when present (Long Earth, Expanse) | ✅ |
| `.cue` | 51 | Global `TITLE` carries series+number only in Dresden; most are chapter-only | ✅ |

### Structure facts (THIS library only — evidence for 02's *confidence penalty*, not for rules)

- Book folders at 4 depths (22/62/169/33 at depths 1–4). Top level is always
  the author here — but another library may have no author level at all.
- **12 flat multi-book folders** (tag-verified: Bobiverse, TMC, Murderbot,
  Kingkiller, Red Rising, Silo, DCC, Cerulean, Rivers of London, Books of
  Babel, Baldree, +1): one folder, several single-file books. Structurally
  identical to a chapter-split book folder (WoT) — **only tags distinguish
  them**.
- **Anthology nesting**: Dresden `#12.5 Side Jobs` contains 23 sub-books with
  their own decimal numbers *inside* a book folder. **Split books**: one
  canonical book = two units (MST *To Green Angel Tower* Siege/Storm;
  Warbreaker `(1 of 2)`; Demon Accords `Book 08 Part 1/2`). Book↔unit is not
  1:1 in either direction.
- **Sub-series with resetting numbers**: First Law (`01 The Blade Itself` under
  `01 - The First Law`, then `01 - A Little Hatred` under `02 - Age of
  Madness`); Ender universe has 4 named sub-series and 5 album-numbering
  styles. "Which number" is ticket 07's question; the data says both levels
  exist.
- **Same-name ≠ same series** and **same book ≠ one entry**: *The Carpet
  People* exists twice as different editions in sibling folders.
- The two Discworld editions are **asymmetric**: Briggs/1980s has uniform
  parseable albums (41/41 `Discworld NN - Title`) but almost no narrator
  (2/41 `Composer`); 2022 has zero series tags and **four album conventions in
  one folder**, but rich narrator data (29/43 + `nrt` 28). Edition
  discrimination has *different* available signals per edition — narrator alone
  cannot do it (confirms the corpus finding at scale).
- Number formats seen: `04`, `#05`, `12.5`, `0.5`, `00`, `14b`, `1-3`, `(#11)`,
  `, Book 8`, Roman numerals `I…VII` (incl. the typo `lll` for III), `Volume 3`.

### Signal conflicts worth remembering (they motivate abstention)

1. Snuff: folder says `Discworld 39`, its NFO says `Position in Series: 33`.
2. WoT (local): `artist` = series name, `album_artist` = author — and the
   app's current `author = Artist || Performer || Album_Performer` mapping
   **already records "The Wheel of Time" as an author today**.
3. Dark Tower `#.5`: the album names a *different book* (the LEGENDS anthology
   it was ripped from) than the folder.
4. One series folder holds three tag generations (device Dresden: 14
   `extra.SERIES` + 7 `Grouping`-only + 2 untagged).

### The JSON path — confirmed empirically (this ticket's open item)

On the host build of the bundled v25.10 source with the turbomodule's options:
the iTunes `©grp` atom arrives as **top-level `"Grouping"`** on the General
track; Audible freeform atoms arrive under **`extra`** (`extra.SERIES`,
`extra.PART`, `extra.SUBTITLE`, `extra.AUDIBLE_ASIN`, `extra.nrt`). Both are
reachable from the app's typed `GeneralTrack` today. `src/helpers/mediainfo.ts`
currently **discards all of them** (keeps Album/Performer/Composer/
Track_Position/rldt).

### MediaInfo vs ffprobe (driver asked directly)

Over 140 identical files: **ffprobe found nothing MediaInfo missed; MediaInfo
found strictly more** — full-length values where ffprobe fell back to 30-char
ID3v1 truncations (LibriVox), `ContentType=Audiobook` decoded vs raw `2`, tags
from 2 genuinely truncated mp3s ffprobe returned nothing for, and the entire
freeform-atom family. Naming maps: `Performer`=artist, `Album_Performer`=
album_artist, `Track`=track *title*, `Track_Position`=number. ffprobe evidence
is a lower bound; the turbomodule is the right engine.

### Method notes (for reproducing)

- m4b tag regions pulled as head-64K + tail-24MB, reconstructed as
  `ftyp`+`moov` fragments (`frag_util.py`); moov placement is mixed here
  (43 end / 25 front locally). Validated against full-file probes.
- `IsTruncated`/`ConformanceErrors` in `device_general.jsonl` are **artifacts
  of fragment probing** for `head4`/`head16` methods — only trust them from
  whole-file probes.
- Host build recipe: `build-host-mediainfo.sh` (mirrors `build-android.sh`
  minus NDK/JNI). ~5 min, no system installs, no root.
