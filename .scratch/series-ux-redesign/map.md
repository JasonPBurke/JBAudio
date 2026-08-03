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

### Vocabulary

Sharpened by ticket 06 (2026-08-02); no longer provisional.

- **Series** — an ordered, named set of books, **identified by its `name`**.
  May be authored by a human or inferred by the detector — see *Origin*. Doubles
  as a **personal playlist**; no decision may foreclose that (original spec,
  §Summary).
- **Edition** — a distinct recording of the same series (Discworld/Nigel Planer
  vs Discworld 2022 full cast). **Settled by 06: NOT part of series identity.**
  It is a *naming convention* (`Discworld (2022)`), carried in the name and
  filled from the folder — there is no `edition` column and no series grouping
  level. Two editions are simply two series with two names.
- **Origin** — `series.origin: 'detected' | 'user'`, who *created* the series
  (06). The boundary that makes playlists survive wipe-and-regenerate:
  regeneration may only touch `'detected'`. Whether an edit promotes
  `'detected'` → `'user'` is ticket 09's.
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
  add one row. **08 is now unblocked** (07 resolved 2026-08-02, 06 on 2026-08-02).

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

- [06 — Series identity: is a series `name`, or `name × edition`?](issues/06-series-identity-edition.md)
  — **A series is identified by its `name`. Edition is not first-class.** The
  ticket's premise had already dissolved: 02's collision check emits
  `"Discworld"` (41) and `"Discworld (2022)"` (39) as two **already
  name-distinct** series — across all 28 emitted series that is the *only*
  edition pair and there is **no name collision anywhere** in the library — so
  the forcing case costs **zero schema change**. Edition is a naming convention
  filled from the folder; no `edition` column (narrator can't populate it —
  absent on 39/41 classic Discworld), no `series_group` (a second hierarchy
  level in every screen for a case occurring once in 350 titles). **The
  duplicate-name rule survives untouched** — this ticket predicted it "must
  change" and it doesn't; `seriesName.ts` needs **no code change**. Detector-
  generated collisions **disambiguate** (parent folder, then ` (2)`) — never
  merge (that recombines the 80-book/39-doubled-number series 02 exists to
  prevent), never abstain (the detector holds a validated split). One new
  column: **`series.origin: 'detected' | 'user'`**, mirroring 07's
  `canonical_source`, which makes "never foreclose personal playlists"
  structural — regeneration may only touch `'detected'`. `origin` records
  *creation* only; whether an edit promotes it is **09's**. Detection creates
  the edition split **without a confirmation gate**. Unblocks
  [08](issues/08-browse-presentation.md).

- [09 — Auto-generate series: the setting, and what happens to my edits](issues/09-auto-generate-series-setting.md)
  — **The toggle promises that nothing you do by hand is ever overwritten.**
  `Auto-Generate Chapters` turned out to be a **two-surfaced** precedent, and the
  app had therefore already ruled on the shape: **bulk actions create, per-item
  actions destroy** (there is no bulk destroy anywhere in `src/`). **Ownership is
  per-aspect, not per-object** — `series.name_source` + `series_books.membership`
  join 07's `canonical_source`, so a rename does *not* freeze membership. Coarse
  "touch it, own it" promotion was rejected because 02 measures grouping at 98.3%
  and naming at 94.2%: renaming is the commonest repair and must not cost
  anything else. **An edit does NOT promote `origin`** — answering the question
  06 deferred. **"Wipe-and-regenerate" does not ship**: rescan **reconciles**, so
  surviving rows keep `position` and hand-ordering survives with no flag (07
  already specified seeding only "at create and at insert"). Removals need a
  tombstone or the repair for a wrong merge silently undoes itself —
  `membership = 'excluded'`, a third enum value rather than a sixth column.
  **Delete always suppresses**, via a new **`suppressed_series(name, created_at)`
  table** rather than a `'suppressed'` value on `origin` — the driver caught that
  conflating lifecycle with provenance silently amends 06's "creation only", and
  the separate table also deletes both pieces of defensive code the shell-row
  design needed (`deleteEmptySeries` unchanged). A checkbox on the delete dialog
  was rejected: **a modifier asking for foresight fails exactly when foresight is
  absent**; recovery lives in a browsable `Removed Series` list instead.
  **OFF stops future detection and leaves existing series untouched** (driver,
  matching `autoChapterInterval = null`). **ON by default and NOT Pro-gated** —
  gating would invert the redesign for free users. Full fidelity ships as plain
  language (`Also group by folder name`, default off), never as
  "Conservative/Full". Retro button carries **no count** (driver's call, against
  recommendation: the naive count is not a promise). Copy is one muted line plus
  a pressable `Info` icon → `InfoDialogPopup`, the pattern already in
  `timer.tsx`. Card is **`Series Detection`**. Schema: **5 columns across 2
  tables + 1 new table**. Graduates [10](issues/10-correction-surface.md).

- [08 — Browse presentation: what is the repeating unit?](issues/08-browse-presentation.md)
  — **A full-bleed row, no card, separated by an inset hairline rule: fanned
  square cover cluster with a centred play glyph, beside name / meta / completion
  bar / next-up. It does not expand.** Reopened 2026-08-03 after the first pass's
  `Rich + continue` failed to satisfy; **fourteen variants across two passes**,
  winner `Blend sep ctr` + `Blend quiet ctr`. **The answer is TWO variants and a
  SETTING** — they differ only in the backdrop, and the driver ruled that a user
  toggle picks between them, converting the art-heavy-vs-quiet axis from a spec
  decision into a user one (→ [12](issues/12-series-display-setting.md)).
  ~140dp/row, **~4.5 series/screen** against the first pass's 3.5. **The play
  button carries no word**: its `Start`/`Continue`/`Restart` label cost ~27% of
  the row's width and caused four faults, and the state is already carried by the
  progress bar plus a next-up line that now has **three** states
  (`Next` / `Continue` / `Series complete`) — so the label was *redundant*, not
  sacrificed. The glyph sits on a 42% scrim **inside** the cover layer and is a
  **fixed near-white, not a theme colour** — theme-coupling made it invisible in
  light mode, the first light-theme defect this effort has found. Cover geometry:
  **square boxes** (tall art pillarboxed, wide art cropped), constant 8.4dp peek,
  constant 100.8dp cluster width — all three so the glyph aligns and the text
  column starts at the same x on every row. **Inline expansion, the masonry list
  and every book cell are gone**; `BooksHome`/`BooksGrid` untouched; no origin
  chip on browse. The card container lost, measurably: 24dp of padding ≈ 4
  characters of every line. **Row height is variable — the first pass's
  "predictability over elasticity" ruling is deliberately reversed** (`Blend
  stack` fixed it structurally and was not chosen). Costs **no schema**: the
  toggle is a client setting. Does **not** decide tablet, font scale, animation,
  or the detail screen's transition. Unblocks
  [10](issues/10-correction-surface.md) and
  [11](issues/11-series-detail-contents.md).
  Picked on device from six built variants (`Rich + continue`). A 96dp band over
  a scrimmed first-book backdrop carries name (2 lines, truncating), the meta
  line with 07's canonical range, a completion bar, and a **`Start`/`Continue`/
  `Restart`** button that is never absent — hiding it on finished series left the
  row's right side empty so a completed series read as an unfinished *layout*.
  **Inline expansion is gone entirely**, and with it the masonry list, all book
  cells, and the nested-horizontal-FlashList construct — a **dividend, not the
  argument** (three of four candidates killed it anyway). **`BooksHome` and
  `BooksGrid` are untouched**: nothing forked, nothing modified, the Series view
  simply stops being a customer of `BookGridItem`/`BooksHorizontal`. Design
  continuity with `BooksHome` was *tested and lost* — the section-shaped variant
  was built and beaten by the same header without expansion, upholding 03's
  Audible divergence finding. **No origin chip on browse**: it truncated the
  canonical range on 5 of 15 series, and a row cannot carry both at full width —
  provenance is detail-only. Covers take their true shape (`BookGridItem.tsx:246`,
  500×500 fallback); the peek fits as many as the device allows so the count
  varies by device *and* by series; `+N` hides when nothing is hidden. Play
  styling is `BookGridItem`'s outlined glyph on `backgroundAlpha59` **plus a
  hairline border** it does not have — a deliberate divergence, because the grid
  button always sits on cover art while this one sits on a scrim that can match
  its own ground and vanish. Density ~3.5 series/screen, so it is **not** the
  densest option and was not chosen for density. Graduates
  [11](issues/11-series-detail-contents.md); **does not decide** tablet, theme,
  font scale, or the detail screen's transition (prototype used a `Modal`, not a
  route).

## Not yet specified

In scope, but not yet sharp enough to ticket. Graduates as the frontier advances.

- **`titleDetails` integration** — what series info a book's detail screen shows,
  and whether membership can be edited book-first rather than series-first.
  **09 adds a precedent worth copying**: the sibling `Remove Auto-Chapters` item
  already lives in this screen's overflow menu, `disabled` at 0.4 opacity when it
  does not apply — so a per-book series action has an established home and an
  established disabled-state convention. May merge into
  [10](issues/10-correction-surface.md), which owns the book-first-vs-series-first
  question.
- **Consolidated schema decisions** — **canonical number settled by 07**
  (`series_books.canonical_number` + `canonical_source`, schema v33). **Detection
  confidence settled by 02**: a tier (`certain`/`likely`/`possible`/`guess`) plus
  a reason string, never a float — so the column is small and the `why` trail is
  what any explanatory UI reads. **Edition settled by 06 and it costs nothing** —
  identity is `name`, so there is no `edition` column and no grouping table;
  06 adds exactly one column, **`series.origin` (`'detected' | 'user'`)**.
  **Override markers settled by 09**: `series.name_source` and
  `series_books.membership` (`'detected' | 'user' | 'excluded'`, the third value
  being the removal tombstone), plus a **`suppressed_series(name, created_at)`
  table** — 09 explicitly declined to overload `origin` with a `'suppressed'`
  value, keeping 06's "records creation only" intact. **09 also ruled an edit does
  NOT promote `origin`.** Still open: where 02's confidence tier physically lands,
  and **[11](issues/11-series-detail-contents.md) will add more** — a series
  **artwork override** (art derives from the first book and *follows* a reorder,
  so only an override needs storing) and a **series description**, which 08's
  session confirmed must be rescan-protected like `name` and therefore needs a
  `*_source` companion under 09's per-aspect model. Whether these ship as one
  migration or several is the remaining coherence question; the running total is
  **five columns across two tables plus one new two-column table** (07's two and
  09's one on `series_books`, 06's one and 09's one on `series`, and 09's
  `suppressed_series`) — **plus whatever 11 lands**.
- **Wizard flow shape as fallback** — the 3-step funnel may be wrong once the
  review surface absorbs part of its job. Fold in the defects logged in
  [05](issues/05-wizard-presentation.md): the inactive Next/Save button renders
  with an **invisible label**, the wizard has no app header, and every step has a
  large dead vertical region.
- **Tablet / large-screen behaviour** — this app has a history of tablet layout
  bugs; every browse variant eventually needs a tablet answer. **08's second
  pass changes what this has to cover** (the peek row and the 96dp band it used
  to reference are both gone): the row is now a fixed-width 100.8dp cluster
  beside a `flex: 1` text column, so a tablet spends *all* its extra width on
  text and none on covers — a very long line with a very small picture. The
  84dp cluster, the 2-line name cap and the single-column list are all
  phone-shaped decisions a tablet will test.
- **Light theme** — 08's first pass deferred it; its second pass found and fixed
  the first defect (a glyph coloured from the theme while sitting on a scrim the
  component itself paints, invisible in light mode). **The trap is now on
  record** — anything drawn on a surface the component darkens must be coloured
  against that surface, not the palette — but no systematic light-theme pass has
  been done. Font scale and animation are likewise still untouched.
- **The series detail screen's transition** — 08 prototyped it as a `Modal`, so
  push-vs-sheet is untested *by construction*. 05 chose push for the wizard on a
  "you have left the library" argument that may not transfer to a detail screen,
  which is not a modal task flow. Belongs with
  [11](issues/11-series-detail-contents.md) or just after it.
- **Re-verifying the existing series logic** — assumed correct, never re-checked
  against the redesign's assumptions.
- **Recommended (not enforced) library structure** — driver-raised 2026-08-01,
  waiting on 02's numbers. **Those numbers are now in and they weaken the case:**
  folders are already used without a consent switch, self-validation rejects the
  bad ones on evidence, and Conservative reaches 98.3% purity with 0 false
  positives. The residual gap is books whose *tags* say nothing and whose folder
  no sibling corroborates (Gentlemen Bastards, Founders Trilogy, Drenai) — a
  recommendation would help exactly those. **09 narrows this a lot**: Full
  fidelity is now user-visible as `Also group by folder name`, so folder naming
  has become a thing the user can deliberately opt into, and that switch's caption
  is the natural home for any advice. What remains is only whether the app should
  *proactively* recommend a structure anywhere beyond that one caption.

- **Corpus re-pull without the per-directory cap** — 01 probed at most 2 files
  per directory, so the 12 flat multi-book folders contributed 24 units where 59
  books exist, and every coverage figure on this map is a lower bound. A re-pull
  would firm up coverage and let 02's cascade be scored on the ~35 missing books
  (all single-file books whose probed siblings already detect at `certain`).
  Not a blocker for any decision — accuracy figures are unaffected.

## Out of scope

Ruled beyond this destination. Does not graduate.

- **The clipped-row bug as a standalone hunt.** Deferred by the driver;
  6 hypotheses refuted (05's formSheet test was the 6th). **08 dissolved it
  structurally**: the winning design has no inline expansion, no masonry list and
  no book cells, so the horizontal-FlashList-inside-a-masonry-cell construct the
  bug lived in no longer exists on this screen. Per 08's own instruction that was
  treated as a **dividend, not an argument** — the variant was chosen on how it
  reads. **Not a root-cause fix**: if that construct is ever reintroduced
  anywhere, the bug is unexplained and comes back with it.
- **Merging to `main`.** Both series branches stay open.
- **The implementation itself.** This map ends at an approved spec.
- **Auto-generating series from an online database** (Audible/Goodreads lookup).
  Local signals only. *(Note: 11 does allow an online **cover art** lookup for a
  series, parallel to the existing `/coverArtSearch`. That is artwork, not series
  identity, and does not reopen this.)*

- **Cross-series split and merge.** Driver-raised then ruled out 2026-08-03:
  *"deleting and rebuilding is good enough for now, and if at a later date
  feedback leads me to needing to add this, we can revisit."* They are the only
  two corrections a single-series editor structurally cannot express, so the
  reasoning is preserved in [10](issues/10-correction-surface.md) — but nothing
  is designed for them. **Consequence worth holding:** delete-and-rebuild is now
  the sanctioned repair of last resort, so deletion, 09's `suppressed_series`
  restore path, and the wizard all sit on a load-bearing route.

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
