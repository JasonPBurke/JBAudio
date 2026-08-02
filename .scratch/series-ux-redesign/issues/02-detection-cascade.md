# 02 — Detection cascade: what rules get it right, and how do they fail?

Type: prototype
Status: resolved
Blocked by: 01
Resolved: 2026-08-02 — cascade built and scored offline over the real-library
corpus against hand-authored ground truth. See Answer.
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

Resolved 2026-08-02. A candidate cascade was built and **scored offline against
hand-authored ground truth** over the real-library corpus. Harness, data and the
full per-series listing:
[`../research/02-detection-cascade/`](../research/02-detection-cascade/)
(`README.md`, `RESULTS.txt`, `SERIES_LISTING.txt`).

### The headline

Detection is good enough that **review-and-correction is not the centre of
gravity** — a settings toggle is. Two fidelity levels, measured:

| | **Conservative** (default) | **Full** |
|---|---|---|
| evidence | tags + self-validated folders | + uncorroborated folders |
| series created | **19** | 28 |
| books placed | 179 | 213 |
| grouping purity (edition-aware) | **98.3%** | 97.2% |
| canonical number correct | 96.4% | 95.2% |
| standalones swept into a series | **0** | 2 |
| coverage of in-series units | 75.8% | 89.0% |

### The decisions

1. **Precedence, not weighted scoring.** A strict waterfall
   (`extra.SERIES` → `Grouping` → album patterns → folder) reaches 98.3% purity
   and — decisively — is *explainable*. Every proposal carries a `why` trail
   (`alb.name-num-dash`, `folder:name-corroborated(25/39)`). A weighted score
   would buy nothing measurable and cannot be shown to a user.
2. **Confidence is a tier plus a reason, never a number.** Four tiers —
   `certain` / `likely` / `possible` / `guess`. The evidence is naturally
   ordinal, and the reason string is what any explanatory UI would show.
3. **Grouping and naming are different problems, and only grouping is
   expensive.** Purity 98.3%, display names 94.2%. *Every* surviving name error
   has correct grouping (`TMC`, `Crouch, B`, `Dresden Files` missing its "The").
   A wrong name costs one rename; a wrong grouping costs a split/merge/re-file.
   **Optimise the cascade for grouping purity and treat the name as an editable
   default.**
4. **Abstention is cheap and it works.** 0 standalones swept at Conservative.
   The corpus's hardest cases (Bas-Lag in `{YEAR - Title}` folders, LibriVox
   Barsoom) are simply not grouped, which is the correct outcome.
5. **No folder-consent switch** (driver, 2026-08-02). Folder evidence is always
   *considered*; per-library self-validation always runs underneath it. The
   author-folder trap is rejected on evidence, not on a user's answer —
   `Dennis E. Taylor` is refused because its members' albums say "Bobiverse",
   while `Discworld (2022)` is trusted because 25/39 of its own albums say
   "Discworld". Same library, same code, opposite verdicts.
6. **No one-book series** (driver, 2026-08-02). A series needs two books; a
   second book arriving later creates it. This removed 11 of 29 proposed series
   and, for free, killed three fragment/parent collisions that would otherwise
   have shipped side by side: `Hyperion`(1) vs `The Hyperion Cantos`(3),
   `Waylander`(1) vs `Drenai`(4), `The Second Formic War`(1) vs `Formic Wars`(4).
7. **Sidecars are dropped entirely** from series detection (driver,
   2026-08-02) — see the measurement below.
8. **Number collision falls back to folders.** See below; this is the edition fix.

### The number-collision check — how editions stay separate

A real series numbers each book once. **Repeated canonical numbers inside one
proposed series mean something has merged that should not have.** The check
(`collision.js`), in full:

> If a proposed series has ≥4 numbered books, and ≥25% of its numbers are
> duplicates, and its members partition by folder into ≥2 parts that each hold
> ≥2 books and are each internally near-unique — **take the folder split**, and
> name each part by its raw folder name.

On this library it fires exactly once, on the right target: `Discworld`, 80
books, 39 numbers doubled (49%), partitioning into `Discworld` (41) and
`Discworld (2022)` (39), each internally unique. **Edition-aware purity
77.9% → 98.3%.** It correctly *declines* on `Demon Accords` (24% duplication,
just under threshold, and the partition would be degenerate — one book per
folder).

Note what this is and is not: it is a **grouping** fix that keeps two editions
apart. It does not decide whether "edition" is part of series *identity* —
that stays [06](06-series-identity-edition.md), which this hands a working
structural separation to start from.

### Sidecars: measured, then dropped

The app reads no `.nfo`/`.opf` today. The question was whether to add a probe.
Measured against the real device library (not the local corpus 01 sampled):

- **`.opf`: 4 files, all four in The Long Earth** — which the cascade already
  gets at `certain` from `(Long Earth 01) …` albums. Yield: **zero**.
- **`.nfo`: 23 files**, only 8 of them on units the cascade abstains from
  (Bas-Lag ×3, Drenai ×4, Rivers of London ×1). 01 measured `Series Name:` at
  2/36, so expected yield is **≈0–1 units of 298**.
- Cost: blind probe **~28.6 s** added to every scan (572 probes at ~50 ms/miss);
  gated to abstentions only, **~4.9 s**.

Nothing justifies either cost. **Sidecars do not enter the cascade.** This does
not bear on the deferred general-metadata effort, where `.nfo` `Read By:` is
still the best narrator source in the corpus (36/36).

### Failure shape — what actually goes wrong

The three cases the driver named are all handled: **two Morts land in two
separate Discworld series** (folder-derived, then split by number collision);
**Bobiverse 02 → "Bobiverse" #2** with the author-folder rejected; **Bands of
Mourning → "Mistborn" #6** with `(Michael Kramer)` recognised as the narrator
because it equals `Composer`.

Known defects that survive at Conservative, in order of cost:

1. **`Demon Accords` (17 books) absorbs the 3 Compendium volumes**, which take
   numbers #1/#2/#3 and collide with the real books 1–3. The only genuine
   grouping impurity left.
2. **`Shadow Saga` numbers are wrong** (1, 3, 6, 8, 9, 10 — should be 1–6). The
   folder numbers are Ender-*universe* positions, not Shadow Saga positions.
   Per [07](07-sequence-numbering.md) this is cosmetic — `position` still sorts.
3. **Ugly names**: `Crouch, B` (should be Wayward Pines), `TMC` (Thursday Murder
   Club), `Dresden Files` and `Long Earth` losing their leading "The".
4. **Full level only**: `Enders Game` (7 books) mixes 4 Ender Saga books with
   Children of the Fleet and two short-story collections. It is the single bad
   group at Full, and the reason Full is not the default.

Two traps did **not** fire, worth recording: `The Science of Discworld` (4
books) formed its own group rather than being absorbed into the 80 Discworld
units; and `Warbreaker`'s `Grouping = "Warbreaker 1"/"Warbreaker 2"` — two
halves of one book — was suppressed by the split-book guard rather than becoming
a phantom two-book series.

### Corpus limitation — read before quoting any coverage number

**Ticket 01's device probe took at most two files per directory.** For the 12
flat multi-book folders that means it captured 24 units where **59 single-file
books exist**. Reconciliation: 298 probed + 35 provably unprobed = **333**
against the driver's on-device count of **350**; no directory went unprobed, so
the residual ~17 is most likely library growth since the 2026-08-01 pull.

Accuracy figures (purity, naming, numbering) are unaffected — they are measured
on what was probed. **Coverage percentages are lower bounds.** The 35 missing
books are all single-file books in folders whose probed siblings already detect
at `certain`/`likely`, so they would very likely join their existing series
(Bobiverse 2→5, Rivers of London 2→15, DCC 2→8, Murderbot 2→7, Red Rising 2→6,
TMC 2→4, Silo 2→3). A re-pull with no per-directory cap would settle it.

### Ground truth

`ground_truth.json` labels all 298 units — 246 in a series, **236 across 38
multi-book series**. It is **authored, not derived**: from human knowledge of
these books plus every available signal, which is exactly the advantage a
curator has and the machine lacks. It is therefore *not* valid to cite
folder-rule accuracy against it as proof that folders are trustworthy in
general — only that they agree with truth here. Units where reasonable curators
differ (Ender hierarchy, split books, the Demon Accords Compendium) carry
`ambiguous: true`.

### What this hands to the rest of the map

- **[06](06-series-identity-edition.md) is unblocked**, and inherits a working
  structural edition separation plus a hard fact: **portable signals cannot
  distinguish the two Discworld editions at all** (both say "Discworld"),
  narrator cannot either (classic has `Composer` on 2/41, and the two narrator
  sets do not overlap but barely exist), so **folder + number collision is the
  only discriminator that works**.
- The **review-and-correction fog item is materially narrowed** — the driver
  removed the post-scan confirm/reject queue in favour of a settings toggle
  (see new ticket [09](09-auto-generate-series-setting.md)). Correction as an
  *editing* surface survives; correction as a *gate* does not.
- **`series_books.canonical_source`** from 07 covers the number. An override
  marker for **membership and naming** is still open and now belongs to 09,
  because "wipe and regenerate" makes "what happens to my edits" the sharp
  question.
