# 02 — Detection cascade: what rules get it right, and how do they fail?

Type: prototype
Status: claimed
Blocked by: 01
Parent: [map.md](../map.md)

## Question

Given the signals inventoried in [01](01-signal-inventory.md), **what precedence
of rules produces the correct series, series position, and edition — and what is
the shape of its failures?**

The failure shape matters as much as the accuracy. A detector that is confidently
wrong needs a different UI from one that abstains when unsure.

## Acceptance

Run the candidate cascade over the real corpus offline (Node, no device needed —
tag extraction is pure data) and report, per book: proposed series name, proposed
position/number, proposed edition, and a confidence. Then score it.

The three cases the driver named explicitly must be handled:

1. **Two Morts land in two *separate* Discworld series.** Tags alone cannot do
   this — Mort 2022's tags carry no series name. Folder is required, and the
   series folder sits at a different depth for each.
2. **Bobiverse 02 → series "Bobiverse", book 2.** The folder must be *rejected*
   here (it is the author); series + number come from `album`.
3. **Bands of Mourning → series "Mistborn", book 6.** `album` gives series +
   number, its `(Michael Kramer)` parenthetical is the narrator, and the real book
   title comes from the folder.

## Design questions inside this

- **Do sidecars enter the cascade, and where?** They are **not** just tags by
  another name — see *Sidecar signals* below. `.opf`'s `calibre:series` +
  `calibre:series_index` is the cleanest series signal in the corpus after
  `extra.SERIES`; `.nfo` `Position in Series` is the *least* trustworthy number
  source found (see constraint 3 from 07). Same file family, opposite verdicts —
  so this is a per-field ranking question, never a per-format one.
- **What does probing cost?** Sidecars cannot be discovered by listing (below).
  A blind probe per book over 350 titles is a scan-time regression; the gate has
  to be designed, not discovered. Measure it as part of scoring the cascade.
- **Precedence or scoring?** A strict waterfall (`Grouping` → album pattern →
  folder) is simple but brittle; weighted scoring across signals is more robust
  but harder to explain to a user — and the UI may need to *explain why* a
  proposal was made.
- **When does the detector abstain?** Abstaining is a feature: "7 books I couldn't
  place" is a better UX than 7 wrong series.
- **What is a confidence, concretely?** A number, a tier (`certain` /
  `likely` / `guess`), or the *reason* ("matched Grouping tag")? The review UI
  will surface whatever this produces.
- **Grouping key vs display name.** `Discworld` and `Discworld (2022)` must not
  collide, but `Mistborn 6 (Michael Kramer)` must normalise to `Mistborn`.
- **Re-detection on rescan.** If the user renames or splits a detected series,
  the next scan must not undo it. Implies a persisted override marker — feeds the
  schema work in the fog.

## Driver inputs (2026-08-01, on resolving 01)

1. **Folder conventions are per-library, never global.** No folder rule ships as
   a universal prior, and structure is never enforced (ABS-style mandates are
   off the table). But a *specific* user's structure may **earn trust by
   self-validation**: where folder patterns corroborate tag signals at scale
   within that library (e.g. `Discworld NN - Title` folders agree with albums
   41/41), the learned convention may then be applied to that library's
   tag-silent units. The 01 traps (author-as-folder, `{YEAR - Title}` folders,
   flat multi-book dirs, chapter-split dirs that look identical to flat dirs)
   are the cases self-validation must reject.
2. **Err on the side of caution — abstention bias is binding.** Do not create a
   series unless confident it is correct. An unmade group costs one wizard
   trip; a wrong group costs trust and cleanup. (Consistent with 03: user
   corrections are top-precedence detection inputs, so the detector defers.)
3. **A user-facing switch may gate folder evidence** ("use my file structure to
   create series?"), asked before scan/series creation. Consent turns a
   heuristic into a sanctioned signal and fits the abstention bias. Two open
   sub-questions for this ticket: the switch permits folders to be *considered*
   — per-convention self-validation still applies underneath it (Discworld
   folders pass, Bobiverse's author-folder must still be rejected, same
   library, same switch); and *when* to ask — pre-scan consent is abstract,
   while post-dry-run consent can show what the structure would produce
   ("your folders look like 12 series — use them?"), which fits the
   review-and-correction centre of gravity.

## Constraints from 07 (resolved 2026-08-02)

[07](07-sequence-numbering.md) settled what a number *means*, which binds this
ticket's output in four ways:

1. **Emit a normalised number string per *(book, series)***, not per book —
   canonical number lives on the `series_books` join row, because one book holds
   different numbers in different series. Normalise on write (strip `#`,
   `Book `, `Volume `, leading zeros); keep `12.5`, `14b`, `1-3` intact.
2. **Seed a membership only when the detected series NAME matches** the series
   being seeded. A hand-made sub-series ("Discworld: Night Watch") must get
   **null**, not the parent's numbers — blank beats misleading.
3. **Rank folder above `.nfo` `Position in Series`.** Snuff's NFO says 33; the
   correct answer is 39 (33 is *Going Postal*) and the folder had it right. See
   the adjudication in [01](01-signal-inventory.md). A purpose-built,
   machine-readable field is not thereby a *correct* one.
4. **The override marker this ticket's "re-detection on rescan" bullet
   anticipated now exists**: `series_books.canonical_source` is `'user'` or
   `'detected'`. The cascade may overwrite `detected` freely and must never
   touch `user`. That is only the *number*; an override marker for series
   membership and naming is still open here.

Also settled, and it lowers this ticket's stakes: **canonical number does not
drive sort order** — `position` does, and canonical only seeds it. A wrong number
from this cascade is a wrong badge, never a mis-ordered shelf.

## Notes

- All signals are already in JS (`mediainfo.ts:105-114`, and the full MediaInfo
  JSON via `NativeMediaInfo.ts`). **No native change, no rebuild.**
- 01's real-library data + probe scripts: `../research/01-signal-inventory/`
  (`device_general.jsonl` = 304 units with full General tracks — the offline
  scoring corpus this ticket's Acceptance asks for already exists there).
- Keep the rules a **pure, RN-free, DB-free helper** so it is jest-testable —
  `jest.config.js` has no RN preset.

### Sidecar signals (added 2026-08-02, driver-raised)

The app reads **no `.nfo` and no `.opf` today** — confirmed, nothing in `src/`.
That is a gap, not a decision. 01 inventoried them and they are worth having:

| Sidecar | n | Series value |
|---|---|---|
| `.opf` (calibre) | 17 | `calibre:series` + `calibre:series_index` — **perfect when present** |
| `.nfo` "General Information" | 36 | `Series Name:` 2/36, `Position in Series:` 1/36 (**and that one is wrong** — Snuff) |
| `.nfo` MediaInfo-dump | 17 | mirrors the tags (Dresden); no independent value |

**A `.cue` reader already exists** — `src/lib/SafCueReader.ts` feeding
`applyCueChaptersToBooks` (`scanLibrary.ts:191`). Sidecar reading is not
greenfield; reuse that SAF text-read path.

**The constraint that decides feasibility** (`scanLibrary.ts:201-207`): under
scoped storage without `MANAGE_EXTERNAL_STORAGE`, `File.listFiles()` — which
`RNFS.readDir` wraps — **is filtered to media MIME types, so non-media files are
invisible to the directory listing.** A sidecar cannot be *discovered*; its path
must be constructed and probed, with ENOENT as the existence check at **~50 ms
per miss**. Over 3,790 files that is a scan-time regression unless gated, which
is exactly why the cue probe is gated to
`chapters.length === 1 && !fromEmbeddedChapters`. **Design the gate up front.**

(Aside, not this map's business: that function's docstring at
`scanLibrary.ts:187` still describes a `cueBasenames` directory-listing
short-circuit that no longer exists — the name appears nowhere else in `src/`.
Stale comment in shipped code.)
- The corpus is curated to be pathological on purpose. Do not tune to 8 books;
  tune to the frequencies from 01.

## Answer

_(unresolved)_
