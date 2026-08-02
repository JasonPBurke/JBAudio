# Series UX Redesign — Wayfinder Map

Label: `wayfinder:map`
Effort: `series-ux-redesign`
Charted: 2026-07-31
Branch: `feature/series-styling`
Driver: Jason Burke

## Destination

A **design spec plus the data-model decisions it depends on** for the whole Series
feature, built around **tag/path-based auto-detection as the primary path**, with
**review-and-correction as its centre of gravity** and the manual wizard as a
**fallback**.

Covers the browse screen, series detail/expansion, sequence display, the
create/edit wizard, `titleDetails` integration, and the schema changes these
require.

Validated by **throwaway** prototypes on the `Pixel_7_Pro` emulator.
**Implementation is a separate effort** — this map produces decisions, not
shipped UI.

## Notes

### Domain

React Native 0.83.2 · Expo 55 · React 19.2 · Hermes · New Architecture ·
React Compiler. FlashList 2.3.2, Reanimated 4.2.1, react-native-sortables 1.10.0,
WatermelonDB (**schema v32** on this branch; `main` is v31), Zustand, FastImage,
custom MediaInfo turbomodule.

### Provisional vocabulary

Sharpened by ticket 06; used loosely until then.

- **Series** — an ordered, named, user-authored set of books. Doubles as a
  **personal playlist**; no decision may foreclose that (original spec, §Summary).
- **Edition** — a distinct recording of the same series (Discworld/Nigel Planer
  vs Discworld 2022 full cast). Whether this is part of series *identity* is
  **unsettled** — ticket 06.
- **Position** — 0-based order within the series. Exists today
  (`series_books.position`).
- **Canonical number** — the book's number in the published series (Dresden #3,
  Mistborn 6). **Does not exist today.** Diverges from Position whenever the user
  owns gaps.
- **Proposal** — a series the scanner *infers*, pending user confirmation. Does
  not exist today; likely the central new concept.
- **Structural key** — a book's first file path; how membership is anchored
  (`bookStructuralKey.ts`). Deliberately not `book.id`.

### Established facts — do not re-derive

- **Every detection signal is already reachable from JS. No native work, no
  rebuild.** `NativeMediaInfoModule` runs MediaInfo with `Output=JSON` and returns
  the whole document; `GeneralTrack` is typed `[key: string]: unknown` with an
  `extra` bag (`src/NativeMediaInfo.ts:36,57`). `src/helpers/mediainfo.ts:105-114`
  already parses `Album`, `Artist`/`Performer`, and `Composer`→`narrator`.
- **Real-library signal frequencies are now measured** (ticket 01, n=304
  on-device units): explicit series tags on ~13% of in-series books, album
  carries series name+number on ~52%, **≈57–60% of in-series books are
  groupable from portable (tag/album) signals alone; ~4% are dark to every
  signal**. Folder-derived evidence is **non-portable by design** — the app
  does not enforce library structure, and this library's tree is one user's
  convention. Most books in a *typical* library are standalones; absence of
  series tags there is correct data, not failure.
- **Folder path is load-bearing and inconsistent.** The series folder is the
  *parent* for one book and the *grandparent* for another; for a third it is the
  **author name** and must be rejected. **Reconciled with ticket 03:**
  Audiobookshelf ranks path *lowest* and refuses to guess depth at all — it
  mandates `{Author}/{Series}/{Book}`. Both are true. Path is the only signal
  that names some of this library's series (Mort 2022), *and* heuristic depth
  inference is a thing the most mature implementation deliberately declined. Any
  path rule needs an explicit confidence penalty and an escape hatch, not
  cleverness.
- **The wizard is the only opaque full-screen push in the app**
  (`src/app/_layout.tsx:288`). Every other focused flow is `formSheet` or
  `transparentModal`. This is the leading explanation for "jarring", and plausibly
  also the clipped-row bug's trigger (a push detaches the screen underneath).
- Emulator: `Pixel_7_Pro` = `emulator-5554`. Corpus is 8 books across 5 tagging
  conventions. Real library is **350+ titles**, including Discworld 41 × 2
  editions = 82 books.
- **The emulator's series set is volatile — the driver changes it between
  sessions.** Never assume a particular series exists; screenshot first, then
  script taps. Relaunch after a JS-only change with the dev-client deep link
  (`am start -a android.intent.action.VIEW -d "sonicbooks://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"`);
  it fails silently maybe half the time, so **verify with `pidof` before driving
  the UI**. `am force-stop` drops to the dev-client launcher, and a stray back
  press can exit the app entirely — a "tap" then lands on the Android launcher.
- Navigator `screenOptions` changes do **not** apply via fast refresh; they need a
  full JS reload.
- **`pidof` does NOT prove the app is foregrounded** — a stray back press dropped it
  to the Android launcher while `pidof` still returned a pid, and the next scripted
  swipes scrolled the launcher. Use
  `adb shell dumpsys window | grep mCurrentFocus`, which names the focused activity.
  This supersedes the `pidof` advice above. Also: **`console.table` does not forward
  to the Metro log** — use formatted `console.log`.
- **A book cell can only render a book that is in the library store.** `SeriesHome`
  passes a bare `bookId` to `BookGridItem`, which re-resolves it from
  `useLibraryStore`; an unresolvable id renders a size-accurate **blank** cell
  (`BookGridItem.tsx:265`). Any variant, and any future "proposal" concept from
  ticket 02, has to respect this — or render from the `Book` objects that
  `DerivedSeries.books` already carries and that `SeriesHome` currently throws away.
- The existing implementation is **functional and device-verified**. Treat it as a
  **resource, not a constraint**.

### Skills every session should consult

`mattpocock-skills:grilling` · `mattpocock-skills:domain-modeling` ·
`mattpocock-skills:prototype` · `mattpocock-skills:research` · `frontend-design`

### Standing preferences

- **Plan, don't do.** Prototypes are disposable — they need not honour the jest,
  tsc, eslint, tablet or font-scale bars.
- **One ticket per session** (research excepted).
- Design continuity with `BooksHome` is a **feature, not a bug** — but it is
  testable, not sacred. Audible switches layout per content type; that convention
  is worth a prototype rather than an assumption.
- Never foreclose personal playlists.
- **Abstention bias** (driver, 2026-08-01): never auto-create a series without
  confidence it is correct — an unmade group costs a wizard trip, a wrong group
  costs trust. Folder conventions are per-library evidence that must
  self-validate against that library's tags; never a global prior, never
  enforced.

### Repo gotchas

- No `.prettierrc` — **never** run `prettier --write`.
- `jest.config.js` has no RN preset — keep pure helpers RN-free and DB-free.
- ~40 eslint **warnings** are the pre-existing baseline; the bar is **0 errors**.
- `android/` is committed and holds a custom turbomodule — never
  `expo prebuild --clean`.
- JS-only changes reload over Metro; native changes need `npm run android`.
- **Wipe any device that ran series v31** — it collides with main's artwork
  migration.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [01 — Signal inventory: what series-bearing data actually exists?](issues/01-signal-inventory.md)
  — Sample widened from 8 books to **304 real-library units** (driver's phone) +
  140 local, all read with a host build of the **exact bundled MediaInfoLib
  v25.10**. **≈60% of genuinely-in-series books carry portable machine-usable
  series identity; ~96% reachable if this library's folders are trusted; ~4%
  dark.** `Grouping` survives the JSON path as top-level `"Grouping"`; Audible
  `SERIES`/`PART`/ASIN live in `extra`; the app currently discards all of them —
  and its `author` fallback already records "The Wheel of Time" as an author.
  MediaInfo ≥ ffprobe on every signal tested. NFO sidecars carry `Read By:`
  narrator 36/36. Field meanings are per-rip (`artist` = author 80% / narrator /
  series); book↔folder↔unit is not 1:1 (12 flat multi-book dirs, anthology
  nesting, split books, sub-series with resetting numbers).

- [03 — Prior art: how do other apps present and detect series?](issues/03-prior-art-series-ux.md)
  — Canonical sequence is universal and belongs **on the join row as a
  float-sorted string** (one book holds different numbers in different series).
  Gaps collapse to a range (`#1, 3-4, 8`); **nobody** placeholders un-owned books.
  **Editions are a genuine null result** — Audiobookshelf makes them structurally
  impossible, Audible reuses one series ASIN and explains in prose, so 06 must be
  designed from first principles. Corrections should be stored as
  **top-precedence detection inputs, not lock flags** (Jellyfin's lock approach is
  a documented mess). Audible's per-content-type layout divergence is confirmed on
  web only; ABS mobile reuses one card geometry — so 08 should prototype
  divergence, not assume it.

- [04 — Stand up the prototype harness](issues/04-prototype-harness.md)
  — **Built and device-verified**, lives in `src/prototypes/` (JS-only, no rebuild).
  Two orthogonal knobs — **Variant** and **Data** — plus two variants (`Baseline`,
  `Numbered`) so the switcher has an A/B partner. `Stress ×15` covers every listed
  shape and three bonus ones from ticket 03, all verified on device. **Writes nothing
  to the DB**: schema v32 has no canonical-number column, so a DB-backed injector
  could not have produced the Dresden-gaps dataset at all — and "clear synthetic"
  is therefore a true restore. Real-code footprint is three commented lines in the
  library screen; `SeriesHome` is untouched. Adding a variant for 08 = copy a file,
  add one row. **08 now waits only on 06** (07 resolved 2026-08-02).

- [05 — Wizard presentation: overlay or full-screen push?](issues/05-wizard-presentation.md)
  — **Push retained**, no code change. The `formSheet` alternative (0.95 detent)
  was built and read as a proper overlay, but the driver chose push's stronger
  "you have left the library" signal anyway. Didn't fix the clipped-row bug
  either way (hypothesis 6 refuted on-device). The "jarring" complaint that
  opened this ticket stays open — folded into the wizard-flow-shape fog.

- [07 — Sequence numbering: position, canonical number, or both?](issues/07-sequence-numbering.md)
  — **Both exist; each gets one job.** The badge shows the **canonical number**,
  blank when unknown (position is already carried by layout, so a `3` on the third
  cell is confirmation while a `4` is information). **`position` stays the sole
  sort authority**; canonical only *seeds* it, at create and at insert — so a
  wrong number is cosmetic, never structural, and the wizard's drag step survives
  as pre-sorted rather than redundant. Schema **v32 → v33**: two optional columns
  on `series_books` — `canonical_number` (string, normalised on write, holds
  `12.5`/`14b`/`1-3`, float-parsed only for seeding and range-collapse) and
  `canonical_source` (`'user' | 'detected'`; rescans refresh `detected`, never
  touch `user`). **No placeholders for un-owned books**; gaps read from the
  header range (`#1, 3-4, 8`, already built — needs a width cap or it eats the
  series name). A human override **must exist** but its UI is sited with the
  review-and-correction fog, not the wizard. Multi-membership verified working
  today (*Guards! Guards!* = Discworld 8 **and** Night Watch 1, independently);
  a hand-made sub-series seeds **null**, since the parent's tag doesn't name it.
  **Evidence correction to 01: Snuff is Discworld #39 — the folder was right and
  the `.nfo` was wrong.**

- [02 — Detection cascade: what rules get it right, and how do they fail?](issues/02-detection-cascade.md)
  — **Detection is good enough that review is not the centre of gravity; a
  settings toggle is.** A precedence waterfall (`extra.SERIES` → `Grouping` →
  album patterns → folder, each folder cluster **self-validated against its own
  members' tags**) scores **98.3% grouping purity with 0 standalones swept** at
  the Conservative level (19 series, 179 books), 97.2% at Full (+9 series from
  uncorroborated folders, but one visibly wrong `Enders Game` group). **Grouping
  and naming are different problems and only grouping is expensive** — every
  surviving name error (`TMC`, `Crouch, B`) has correct grouping, so names are
  editable defaults. **Editions stay separate via a number-collision check**:
  repeated canonical numbers inside one proposed series trigger a fall back to
  the folder split (Discworld 80 → 41 + 39; edition-aware purity 77.9% → 98.3%),
  and it correctly declines on Demon Accords. Driver rulings: **no folder-consent
  switch** (self-validation replaces it), **no one-book series** (which also
  killed three fragment/parent collisions), **sidecars dropped entirely** —
  the real device library has 4 `.opf`, all on books already detected at
  `certain`, and a blind probe costs ~28.6 s of scan time for ≈0–1 units.
  **Corpus caveat: 01 probed at most 2 files per directory**, so 35 books in the
  12 flat folders are missing (298 + 35 = 333 vs 350 on device) — accuracy
  figures hold, coverage figures are lower bounds.

## Not yet specified

In scope, but not yet sharp enough to ticket. Graduates as the frontier advances.

- **Series detail screen** — whether one exists at all, what it holds, and how it
  relates to inline expansion. Waits on ticket 08's browse decision. **07 adds a
  candidate occupant**: an explicit per-series "Sort by number" action that
  re-seeds `position` from canonical on demand — considered and deliberately not
  adopted in 07 because it has nowhere to live yet.
- **Correction surface** — **materially narrowed by 02**: the driver removed the
  post-scan confirm/reject queue (a wipe-and-regenerate button makes detection
  errors cheap without per-item UI), so this is now an *editing* surface, not a
  *gate*. Still open: rename a series, split one, merge two, reassign a mis-filed
  book, and **07's canonical-number edit field** (07 ruled the override must exist
  and flips `canonical_source` to `'user'`, but declined to site the UI). 02 makes
  renaming the highest-traffic action — grouping is 98.3% right while names are
  94.2%, so the common repair is a label fix, not a regrouping. Whether a bulk
  "number sequentially from current order" action belongs here is open: it would
  number all 39 of the 2022 Discworld units in one tap, but on a gapped set it
  stamps 1,2,3,4 over 1,3,4,8 and destroys the distinction 07 exists to draw.
  Waits on 06 and [09](issues/09-auto-generate-series-setting.md).
- **`titleDetails` integration** — what series info a book's detail screen shows,
  and whether membership can be edited book-first rather than series-first.
- **Consolidated schema decisions** — **canonical number settled by 07**
  (`series_books.canonical_number` + `canonical_source`, schema v33). **Detection
  confidence settled by 02**: a tier (`certain`/`likely`/`possible`/`guess`) plus
  a reason string, never a float — so the column is small and the `why` trail is
  what any explanatory UI reads. Still open: **edition** (06), an override marker
  for series **membership and naming** as distinct from the number (now owned by
  [09](issues/09-auto-generate-series-setting.md), because wipe-and-regenerate is
  what makes it load-bearing), and **series artwork**. Whether these ship as one
  migration or several is the remaining coherence question.
- **Wizard flow shape as fallback** — the 3-step funnel may be wrong once the
  review surface absorbs part of its job. Fold in the defects logged in
  [05](issues/05-wizard-presentation.md): the inactive Next/Save button renders
  with an **invisible label**, the wizard has no app header, and every step has a
  large dead vertical region.
- **Tablet / large-screen behaviour** — this app has a history of tablet layout
  bugs; every browse variant eventually needs a tablet answer.
- **Re-verifying the existing series logic** — assumed correct, never re-checked
  against the redesign's assumptions.
- **Recommended (not enforced) library structure** — driver-raised 2026-08-01,
  waiting on 02's numbers. **Those numbers are now in and they weaken the case:**
  folders are already used without a consent switch, self-validation rejects the
  bad ones on evidence, and Conservative reaches 98.3% purity with 0 false
  positives. The residual gap is books whose *tags* say nothing and whose folder
  no sibling corroborates (Gentlemen Bastards, Founders Trilogy, Drenai) — a
  recommendation would help exactly those. Open question is whether that is worth
  any user-facing advice at all, or whether Full fidelity already covers it.

- **Corpus re-pull without the per-directory cap** — 01 probed at most 2 files
  per directory, so the 12 flat multi-book folders contributed 24 units where 59
  books exist, and every coverage figure on this map is a lower bound. A re-pull
  would firm up coverage and let 02's cascade be scored on the ~35 missing books
  (all single-file books whose probed siblings already detect at `certain`).
  Not a blocker for any decision — accuracy figures are unaffected.

## Out of scope

Ruled beyond this destination. Does not graduate.

- **The clipped-row bug as a standalone hunt.** Deferred by the driver;
  6 hypotheses now refuted (05's formSheet test was the 6th). 05 did **not**
  dissolve it as a side effect — 08 is the one remaining ticket that could,
  but chasing it directly is still not on the route.
- **Merging to `main`.** Both series branches stay open.
- **The implementation itself.** This map ends at an approved spec.
- **Auto-generating series from an online database** (Audible/Goodreads lookup).
  Local signals only.

- **Sidecar-driven general book metadata** (`.nfo`/`.opf` → Author, Narrator,
  Title). Driver-raised 2026-08-02 and consciously deferred: this map ends at a
  Series spec, and populating book fields is library *scanning*, not series
  identity. **Reading sidecars as series signals stays in scope** — it is now an
  explicit part of [02](issues/02-detection-cascade.md).

  Worth knowing when the follow-on effort starts, so it isn't re-derived:
  the app reads **no `.nfo`/`.opf` today** (a gap, not a decision), but **does**
  read `.cue` via `src/lib/SafCueReader.ts`, so the SAF text-read path exists.
  01 found `.nfo` `Read By:` present **36/36** — the most *reliable* narrator
  source in the corpus, though narrower reach than `Composer` (153/304). 02 will
  deliver both the file-reading mechanism and the probe-cost measurement this
  work depends on: sidecars are **invisible to the scoped-storage directory
  listing** and must be probed by constructed path at ~50 ms per miss
  (`scanLibrary.ts:201-207`). Do **not** read 07's demotion of `.nfo`
  `Position in Series` as a verdict on the format — that was one field, n=1,
  and wrong in its single instance.
