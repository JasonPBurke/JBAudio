# Tag-capture survey: what MediaInfo returns vs. what the app keeps

Research-only. No code changed. Corpus: `device_general.jsonl` (304 sampled records /
286 real book directories, pulled via `adb` from the owner's actual 350-title Android
library) — see caveat below on `mi_general.jsonl`.

## Summary (5 lines)

Capturing the high-fill fields is cheap and worth it: **5 new columns** (3 required by
series detection, 2 free/high-value) cost **well under 10 KB** for the whole 350-book
library and ride the branch's already-planned, not-yet-coded `toVersion: 33` migration
with zero index changes. The catch is entirely the **backfill**: `scanLibrary()` only
probes files not already in the DB, so every column here stays `NULL` on all ~350
existing books forever unless something re-runs MediaInfo over them — recommend an
explicit user-triggered "Re-read Library Tags" action (same UI pattern as the existing
`applyAutoChaptersToExistingBooks` flow), costing roughly **~1 minute** end-to-end on
this library, per real shipped benchmarks (not guessed).

## 0. Corpus correction (read this first)

Two source files were named in the brief; only one is the real library:

| File | What it actually is |
|---|---|
| `device_general.jsonl` | **Real corpus.** 304 records / 286 directories, pulled via `adb` from the owner's actual device library (349-title Android audiobook collection). |
| `mi_general.jsonl` | **Not the user's library.** A probe of a local LibriVox test corpus (`donquixote_2508_librivox`, `flatland_version_2_1901_librivox`, ...) used to test MediaInfo parsing robustness against non-Audible files. Zero Audible extras, different genre tagging conventions. |

All fill-rate numbers below use `device_general.jsonl` only (N=304). Combining the two
(as literally instructed) dilutes every Audible-specific key's fill rate and pollutes
`Genre` with `"speech"`. Flagging this because it changes the headline numbers
materially (e.g. `extra.SERIES` reads as 4.7%/444 combined vs. the correct 6.6%/304).

**Second corpus caveat, also load-bearing:** `device_general.jsonl` was built by
`device_probe.py`, which for files >32 MB pulls only a **head+tail fragment** via `adb dd`
(methods `head4`/`head16`/`tail-moov`), not the whole file. `extra.IsTruncated` (49.7%
fill) and `extra.ConformanceErrors` (50.0% fill) correlate almost perfectly with those
fragment methods (77/77 `head16` records show `IsTruncated`, vs. 1/80 `whole`-file
records) — **these two keys are an artifact of the sampling script's partial-file pull,
not a real property of the on-device files.** The app's native MediaInfo call always
reads the complete local file, so these two keys are excluded from consideration
entirely, not just deprioritized. (Tag values themselves — Album, SERIES, Duration,
etc. — are unaffected: MediaInfo reads those from the moov/ID3 header, which the
fragment-reconstruction preserves.)

## 1. Fill-rate table (real corpus, N=304, sorted descending, non-artifact keys only)

**General track, top-level:**

| Field | Fill | Type | Examples |
|---|---|---|---|
| FileExtension, FileSize, File_Modified_Date(_Local) | 100.0% | string | `m4b`, `317922` |
| Format | 99.7% | string | `MPEG-4`, `MPEG Audio` |
| AudioCount, Duration, OverallBitRate(_Mode) | 99.0% | string | `16.904`, `VBR` |
| Performer | 97.0% | string | `Agatha Christie`, `Andy Weir` |
| Album | 96.7% | string | `Artemis` |
| ImageCount, Cover, Cover_Type | 93.1% | string | `Yes`, `Cover` |
| Title, Track | 91.8% | string | `Opening Credits` |
| Genre | 90.8% | string | `Audiobook` |
| Recorded_Date | 84.5% | string | `2022`, `2017-11-13` |
| Comment | 77.0% | string | (long blurb) |
| Album_Performer | 59.2% | string | `Agatha Christie` |
| Format_Profile, CodecID, CodecID_Compatible | 53.3% | string | `mp42`, `Base Media` |
| StreamSize | 51.3% | string | `5265` |
| Composer | 51.0% | string | `Juliet Stevenson` |
| Track_Position | 50.0% | string | `1`, `2` |
| Encoded_Library | 48.4% | string | `LAME3.99r` |
| MenuCount | 45.4% | string | `1`, `2` |
| Tagged_Date | 45.1% | string | timestamp |
| Cover_Mime | 40.5% | string | `image/jpeg` |
| Publisher | **31.9%** | string | `Audible Studios` |
| Encoded_Application | 31.2% | string | `fre:ac v1.1.7`, `inAudible 1.97` |
| Title_More / Track_More | 30.3% | string | long blurb (duplicate of Comment) |
| HeaderSize/DataSize/FooterSize/IsStreamable | 28.6% | string | container internals |
| Copyright | 28.0% | string | `©2013 Agatha Christie...` |
| Track_Position_Total | 27.6% | string | `1`, `33` |
| Encoded_Date | 25.0% | string | timestamp |
| Description | 24.0% | string | long blurb (duplicate) |
| Encoded_Application_Name/Version | 17.4% | string | `fre:ac`, `1.1.7` |
| Encoded_Library_Name | 14.8% | string | `QuickTime` |
| Encoded_Library_CompanyName | 11.5% | string | `Apple` |
| ContentType | 9.5% | string | `Audiobook` |
| **Grouping** | **5.6%** | string | `Warbreaker 1`, `The Dresden Files` |
| EncodedBy | 3.6% | string | `iTunes 10.5.0.142` |
| Lyrics | 2.6% | string | Publisher's-summary text |
| Performer_Sort, Album_ReplayGain_*, Original_Lyricist | ≤2.3% | string | sort/replay-gain noise |
| Part_Position(_Total) | 2.0% | string | `1`, `3 / 3` |
| ISBN, Rating, Label, Season, Part | ≤0.7% | string | negligible |

**Extra bag (Audible/MP4-freeform atoms), N=304:**

| Field | Fill | Examples |
|---|---|---|
| ~~ConformanceErrors~~ | ~~50.0%~~ | **excluded — probe artifact, see §0** |
| ~~IsTruncated~~ | ~~49.7%~~ | **excluded — probe artifact, see §0** |
| extra.nrt | 21.4% | `Rosario Dawson` |
| extra.rldt | 15.5% | `14-Nov-2017` |
| prID, CDEK, CDET, VERS, AACR, _sti | 14.8–15.1% | Audible internal catalog IDs |
| LANGUAGE | 9.5% | `English` |
| AUDIBLE_ASIN | 7.9% | `B0721NKM4B` |
| asin | 7.6% | `B0721NKM4B` (near-duplicate of AUDIBLE_ASIN) |
| **SERIES** | **6.6%** | `Blacktongue`, `The Dresden Files` |
| **PART** | **5.9%** | `2`, `17` |
| **SUBTITLE** | **5.6%** | `Hierarchy, Book 2` |
| TCOM | 4.3% | narrator, alt tag |
| UFID, NARRATEDBY, WOAS, LongDescription | 3.0% | low-fill, mostly duplicate/opaque |
| everything else | ≤2.3% | long tail of DAW/ripper-specific one-offs |

## 2. Three-way classification (high-fill / relevant keys only)

| Field | Status | Where it lands today |
|---|---|---|
| Album, Performer, Album_Performer, Composer, Genre, Recorded_Date, Copyright, Comment/Title_More, Track_Position, Cover*, Duration, OverallBitRate | **Already persisted** | `ExtractedMetadata` in `src/helpers/mediainfo.ts` → `books`/`chapters` via `buildBookMetadata`/`buildChaptersFromMetadata` |
| **Format** (99.7% fill) | **Extracted then dropped** | `extractMetadataFromResult` computes `fileFormat` (mediainfo.ts:96) but `buildBookMetadata` never reads it — free to persist, zero new extraction cost |
| **extra.rldt** (15.5% fill) | **Dead-code bug, not a real fallback** | `mediainfo.ts:99` reads `general.rldt` (top-level) as a `releaseDate` fallback, but the real data always nests it under `general.extra.rldt` (confirmed 0/304 top-level vs 47/304 under `extra`). This fallback never fires today. Same shape of bug on `general.nrt` (line 111) vs. `general.extra?.nrt` — harmless there only because the `extra?.nrt` check is second in the same `||` chain and does fire. |
| Grouping, Publisher, SERIES, PART, SUBTITLE, asin/AUDIBLE_ASIN, ISBN, ContentType, LANGUAGE, NARRATEDBY | **Never extracted** | Present in `GeneralTrack`'s index signature / `extra` bag (nothing is unreachable — `src/NativeMediaInfo.ts`), but `extractMetadataFromResult` doesn't read them |

## 3. Book-level vs. file-level — checked against real data, not assumed

`chapters` rows are per-file; `books` rows are per-book. Verified using the 6
directories in the sample that are genuine chapter-split single books (confirmed by
matching `Album` across both sampled files in that directory — 12 other dual-sampled
directories turned out to be **flat-collection folders holding multiple different
books**, not one book's chapters, and were excluded from this check):

| Field | Consistent within one real book's files? |
|---|---|
| Album, Album_Performer, Publisher, Copyright, Genre, Recorded_Date, extra.SERIES, extra.PART, extra.SUBTITLE, extra.asin | **Yes, 6/6 dirs, zero mismatches** — safe as book-level (`books` table) columns |
| **OverallBitRate** | **No — genuinely varies per file** (e.g. Discworld "Going Postal": 131775 vs 131608; Miss Marple: 150460 vs 132591, both VBR). The app already stores `books.bitrate`/`books.sample_rate`/`books.codec` from **only the first chapter processed** (`groupChaptersIntoBooks` in `scanLibrary.ts:100-143` sets book metadata once, on first-seen chapter, never updates it). This is pre-existing, accepted behavior — not something this survey is proposing to change — but it means today's `books.bitrate` is already a first-file approximation of a per-file reality. Any new bitrate-like column should follow the same precedent (book-level = first file wins) rather than inventing a new pattern. |

Conclusion: **series, grouping, part, subtitle, publisher, file_format are all safe as
`books`-table columns.** No candidate in the proposed set needs a `chapters`-table slot.

## 4. Proposed column set, priced

All `isOptional`, snake_case, target table `books`.

### Tier A — needed by series detection now

| Column | Type | Fill | Why |
|---|---|---|---|
| `series` | string | 6.6% | `extra.SERIES` — the cascade's tier-3 (highest-confidence) portable signal (`cascade.js:95-96`); every series-detection ticket assumes this exists |
| `part` | number | 5.9% | `extra.PART` — pairs with `series` to supply the canonical number |
| `grouping` | string | 5.6% | `Grouping` — the cascade's fallback portable signal when `SERIES` is absent (`cascade.js:99-104`) |

Low fill is expected and fine here: these are one signal among several in the cascade
(folder evidence covers the rest — 79.2% vs 54.2% coverage per `RESULTS.txt`), and
`units.json`/`dump_units.py` already treat exactly these three fields as worth
extracting for the detection corpus.

### Tier B — high fill, book-level, plausibly displayable later

| Column | Type | Fill | Why |
|---|---|---|---|
| `file_format` | string | 99.7% | Already computed as `ExtractedMetadata.fileFormat`, just never persisted — **zero incremental extraction cost.** Displayable as "MPEG-4 (.m4b)" / "MPEG Audio (.mp3)". |
| `publisher` | string | 31.9% | New extraction (`general.Publisher`). Confirmed book-level-consistent. Clean, obviously displayable field ("Audible Studios"). |

### Tier C — measured, not worth a column

| Field | Fill | Why not |
|---|---|---|
| `subtitle` | 5.6% | **Derivable** — every real example matches `"{series}, Book {part}"` exactly (e.g. `SUBTITLE: 'Hierarchy, Book 2'` = `SERIES:'Hierarchy'` + `PART:'2'`). Not worth storing once `series`/`part` exist. |
| `asin` / `AUDIBLE_ASIN` | 7.9%/7.6% | Near-duplicate pair, low fill, opaque catalog ID — no display use until an Audible-link feature is actually scoped (explicitly out of scope per the brief) |
| `isbn` | 0.7% | Negligible |
| `content_type` | 9.5% | Redundant — value is `"Audiobook"` in every real sample, same information `genre` already carries |
| `language` | 9.5% | Low fill; also **unmeasured for non-English libraries** — this owner's library is monolingual, so this number may not generalize. Flag as unmeasured, don't ship on this evidence. |
| `narrated_by` (NARRATEDBY) | 3.0% | `narrator` is already populated via the `nrt`/`Composer`/`Album_Performer` fallback chain — redundant |
| `long_description` / `lyrics` | 3.0%/2.6% | Low fill, large blob (hundreds–thousands of bytes each), largely duplicates `description`/`Comment` already stored |
| `encoded_application`/`encoded_library` (ripper fingerprint) | 31–48% | Diagnostic-only (`fre:ac`, `LAME`, `m4b-tool`, `inAudible`) — no identified user-facing value |
| `track_position_total` | 27.6% | Derivable and superseded — the app already computes an authoritative `total_track_count` from real chapter grouping, more trustworthy than a self-reported tag |
| `album_performer` | 59.2% | Not actually dropped — already consumed via the `author`/`narrator` fallback chains; no separate column needed |
| `IsTruncated`, `ConformanceErrors` | 50%/49.7% | **Excluded outright — sampling-probe artifact, not a real file property.** See §0. |
| `prID`/`CDEK`/`CDET`/`VERS`/`AACR`/`UFID`/`WOAS` etc. | ≤15% each | Opaque Audible-internal catalog IDs, no display value |
| sort variants (`*_Sort`), `BPM`, `Rating`, `Label`, `Season` | ≤2% | Noise |

### Storage cost, 350 books

Marginal SQLite cost for 5 new nullable columns × 350 rows, using real fill rates and
observed value lengths (NULL costs ~1 byte of row-header type-flag regardless of fill):

| Column | ≈non-null rows | avg bytes/value | ≈total |
|---|---|---|---|
| `series` | 23 | ~13 | ~0.7 KB |
| `part` | 21 | ~2 (varint) | ~0.4 KB |
| `grouping` | 20 | ~15 | ~0.7 KB |
| `file_format` | 349 | ~9 | ~3.5 KB |
| `publisher` | 112 | ~16 | ~2.3 KB |
| **Total** | | | **≈7.6 KB for the whole library** |

Effectively free. No indexes proposed (matches the branch's existing `G6` "no new
indexes" discipline for the series-feature columns).

## 5. The backfill problem

`scanLibrary()` builds `existingUrls` from the `chapters` table and only runs MediaInfo
on files **not already present** (`processDirectoryFiles`, `scanLibrary.ts:358-427`,
gate at line 368). A rescan of an unchanged library produces zero MediaInfo calls, so
every new column stays `NULL` on all ~350 existing books indefinitely — this is the real
cost center, not the schema.

### Options considered

| Option | Mechanism | Verdict |
|---|---|---|
| **(a) Silent background one-shot on upgrade** | Auto-trigger a full re-probe the first time the app launches post-migration | Rejected — surprises users, drains battery, fights Android background-execution limits, no progress UI, "keep it boring" migration discipline argues against invisible heavy work |
| **(b) Explicit user-triggered "Re-read Library Tags" action** | New settings action, same shape as `applyAutoChaptersToExistingBooks()` (`src/helpers/autoChapterGenerator.ts:63-123`) + its `library.tsx` UI (Alert confirm → `isApplying` spinner → success alert, `src/app/(settings)/library.tsx:141-190`) | **Recommended.** Bounded, consented, visible, matches an existing house pattern exactly. Series detection is itself gated behind a settings toggle (`series_detection_enabled`, spec.md §G1a) — natural to chain: "Turning on series detection re-reads your library's tags first, ~1 minute." |
| (c) Fold into the incremental scan's file filter | Change `existingUrls` gating so already-known files with `NULL` new columns still get re-probed | Rejected — complicates the exact hot path the migration is trying to keep simple, conflates "new file" scanning with "backfill" concerns |
| (d) Lazy per-book backfill on view (e.g. `titleDetails`) | Re-probe one book's file when its detail screen opens | Rejected as primary — leaves rarely-viewed books `NULL` forever, defeating the series-detection motivation which needs the *whole* library at once. Could be a cheap secondary top-up layered on top of (b), not a replacement. |

Auto-chapters' `applyAutoChaptersToExistingBooks` is **not** a re-probe precedent for the
MediaInfo part — it's pure-DB (regenerates chapter timestamps from `book.bookDuration`,
already known, no file I/O). It's the right precedent for the **settings UI shape only**;
the actual re-probe logic here is new work.

### Cost estimate — grounded in real measurements, not guessed

From `[[mediainfo-parallelization-shipped]]` (shipped, measured on this owner's library
at 3577 files / 313 books, cold scan, 4-thread native pool):

| Phase | Measured (3577 files) | Extrapolated (~3900 files) |
|---|---|---|
| MediaInfo, no-cover, 4-thread pool | **54.4 s** | **≈59 s** (linear in file count) |
| File enumeration | RNFS 94.5 s *(pre-MediaStore)* | **≈0.7 s** — confirmed shipped: `enumerateAudioViaMediaStore` (`scanLibrary.ts:993`, `mediastore-probe-result.md`: 3880 files in 738 ms) already replaced the RNFS path in the current code |
| DB update (350 lightweight `UPDATE`s, no artwork/palette work) | *not separately benchmarked* | **unmeasured** — expected low single-digit seconds by analogy: the 57.5 s "artwork + DB persist" figure in the shipped benchmark bundles image resize + palette extraction, which a tags-only backfill skips entirely |

**Total estimate: roughly ~1 minute**, dominated by the MediaInfo no-cover pass, cover
extraction not needed (these columns aren't image data). This is materially better than
a naive "~4 minutes, same as a cold scan" guess would have suggested, specifically
because the RNFS→MediaStore migration already landed and is reused for free. The DB-update
leg is flagged unmeasured rather than estimated with false precision.

## 6. Constraints checked

- **`addColumns` + `defaultValue` trap:** all 5 proposed columns are `isOptional`, so
  existing rows correctly backfill to `null`, not a false-typed zero-value. No non-optional
  enum/number/boolean proposed here.
- **One migration version, appended:** `src/db/migrations.ts` has no `toVersion: 33`
  yet — the series feature's own 9-column/3-table/1-new-table block (`spec.md` §G1) is
  **designed but not yet coded.** Per the brief's directive, any capture columns must
  ride that same block rather than claiming a `v34`. Concretely this means: **the 5
  columns here should be added to `series_books`'s/`series`'s/`settings`'s sibling
  `addColumns` calls for `books`, inside the same `toVersion: 33` migration**, before
  that migration is written — this is the cheapest possible time to do it, and it stays
  consistent with `G3`'s "the answer is one [version number]" discipline. Waiting until
  after v33 lands would force a genuine `v34` and break that discipline; flagging this
  as a timing decision for the driver, not deciding it here.
- **Silent migration failures:** step count stays low (one `addColumns` step on `books`
  alongside the already-planned steps on `series`/`series_books`/`settings`), consistent
  with "keep it boring."
- **Fresh installs never run migrations:** irrelevant to nullability here since all 5
  columns are optional; new installs get the columns natively from `schema.ts` and
  populate them immediately since every file is "new" on a first scan.

## Files referenced

- `/home/jason/Development/JBAudio/.scratch/series-ux-redesign/research/01-signal-inventory/device_general.jsonl` — real corpus (304 records)
- `/home/jason/Development/JBAudio/.scratch/series-ux-redesign/research/01-signal-inventory/mi_general.jsonl` — **not** the real library (LibriVox test corpus, excluded)
- `/home/jason/Development/JBAudio/.scratch/series-ux-redesign/research/01-signal-inventory/device_probe.py` — probe methodology, source of the fragment-pull artifact
- `/home/jason/Development/JBAudio/.scratch/series-ux-redesign/research/02-detection-cascade/units.json`, `cascade.js`, `RESULTS.txt`, `README.md`
- `/home/jason/Development/JBAudio/src/db/schema.ts` — current schema (v32)
- `/home/jason/Development/JBAudio/src/db/migrations.ts` — no `v33` yet
- `/home/jason/Development/JBAudio/src/helpers/mediainfo.ts` — `extractMetadataFromResult`, `ExtractedMetadata`, and the `general.rldt` dead-code fallback bug
- `/home/jason/Development/JBAudio/src/helpers/scanLibrary.ts` — `processDirectoryFiles`, `groupChaptersIntoBooks`, `buildBookMetadata`, `buildChaptersFromMetadata`, incremental `existingUrls` gate
- `/home/jason/Development/JBAudio/src/NativeMediaInfo.ts` — `GeneralTrack`, index signature, `extra` bag
- `/home/jason/Development/JBAudio/src/helpers/autoChapterGenerator.ts` — `applyAutoChaptersToExistingBooks` (UI precedent only, not a re-probe precedent)
- `/home/jason/Development/JBAudio/src/app/(settings)/library.tsx` — the settings-action UI pattern to reuse
- `/home/jason/Development/JBAudio/.scratch/series-ux-redesign/spec.md` §G — the v33 migration design
- Memory: `mediainfo-parallelization-shipped.md`, `mediastore-probe-result.md` — real perf evidence used in §5
