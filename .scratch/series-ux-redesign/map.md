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

> **Amendment, 2026-08-04 — the destination's own framing has drifted and this
> records it rather than silently rewriting it.** "Review-and-correction as its
> centre of gravity" is no longer true.
> [02](issues/02-detection-cascade.md) measured grouping at **98.3% purity with
> 0 standalones swept**, and [09](issues/09-auto-generate-series-setting.md)
> therefore replaced the review queue with a **settings toggle**; correction
> became the *existing edit screen* grown by three things
> ([10](issues/10-correction-surface.md)), not a new surface. The effort's real
> centre of gravity turned out to be **presentation** — 08, 11, 12 and 13 are
> four of the thirteen resolutions and all of the built work. The **scope** the
> destination fixes is unchanged (same six areas, same fallback wizard), so this
> is descriptive drift, not a redrawn destination. Driver may redraw if they
> disagree.
>
> **The spec named in the first line does not exist as a document.** Decisions-so-far
> is an *index*, deliberately. Writing `spec.md` is now
> [19](issues/19-write-the-spec.md), the map's closing ticket.

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
- **PLAY-GLYPH HOUSE STYLE — the darkening is the GLYPH, never the artwork**
  (driver, 2026-08-04, resolving [13](issues/13-detail-sheet-prototype.md)).
  A play glyph drawn over cover art takes its contrast from its **own `fill`**:
  `fill` = the scrim value (**0.42 black**), stroke = a **fixed near-white**,
  and **no scrim, disc or badge outside the glyph** — every pixel of artwork
  outside the play shape stays untouched. **Applies in both places this effort
  draws one: the detail sheet's book rows AND the browse row's glyph over the
  fanned cover cluster.**

  **This AMENDS 08 and the mechanism of 12.** 08 put the browse glyph on a 42%
  scrim *inside the front cover layer* (`CoverCluster`'s `frontScrim`), and 12
  froze that scrim across both toggle states. The value and the reasoning both
  survive — 12 wanted contrast that cannot vary with a user preference, and a
  glyph carrying its own fill satisfies that **more completely**, since it is
  now independent of the backdrop entirely. Only the *region* changed.
  `frontScrim` is now `0` on the winning variants.

  Two things NOT to re-derive: the colours stay **fixed, never theme-derived**
  (08's light-theme defect was a palette-coloured glyph on artwork the palette
  knows nothing about), and a **26dp disc was built and rejected** on the way
  here — a smaller darkened patch is still a darkened patch.

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
  on `series_books` — `canonical_number` (**a nullable NUMBER since
  [10](issues/10-correction-surface.md) superseded this — originally a string
  holding `12.5`/`14b`/`1-3`, until the letter forms were found to force an
  alphabetic keyboard on every edit**; float-parsed for seeding and
  range-collapse) and
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
  sacrificed. The glyph sits on a 42% scrim **inside** the cover layer
  (**AMENDED by [13](issues/13-detail-sheet-prototype.md): the 0.42 moved into
  the glyph's own `fill` and `frontScrim` is now 0 — see the play-glyph house
  style in Notes**) and is a **fixed near-white, not a theme colour** — theme-coupling made it invisible in
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

- [12 — Series display setting: the backdrop toggle](issues/12-series-display-setting.md)
  — **`Series Backgrounds`, in `Appearance → Display Settings`, default ON,
  global, not Pro-gated, browse row only** — **reach WIDENED by
  [11](issues/11-series-detail-contents.md) to also govern the detail hero, at
  near-zero cost because both of that hero's states were already designed.**
  Default-ON was chosen on **which
  dissatisfied user can rescue themselves** — a user irritated by the backdrop
  hunts through settings, a user seeing the quiet row never learns the richer one
  exists — *against* the fact that 08 measured `Blend quiet ctr` as the most
  legible of the fourteen. Sited beside `Number of Columns` because that card
  already holds the same species of preference and `Auto Accent from Cover` one
  card down is already a cover-derived boolean; the accepted cost is a **split
  brain** (detection in `Manage Library`, presentation in `Appearance`). A
  browse-screen control was rejected as **unprecedented** — `numColumns` has no
  on-screen control anywhere in `src/`. **Naming constraint worth keeping: the
  cover cluster shows in BOTH states**, so any label reading "show cover art"
  names something the toggle does not control. Global and not-Pro-gated are
  **entailments, not choices** — `settings` is a single-row table so per-library
  is inexpressible, and gating a default-ON setting would charge users to turn
  *off* the busier read. **Scrim stays 0.42 in both states** — **the VALUE and the
  REASON survive [13](issues/13-detail-sheet-prototype.md), the MECHANISM does
  not: 0.42 is now the glyph's own `fill` rather than a scrim on the cover, which
  serves this ruling better still, since a self-contained glyph cannot vary with
  the toggle at all.** 08's re-tune
  premise does not survive — the glyph never sat on the backdrop, it sits on the
  front cover in both states, and a toggle-dependent scrim would make legibility
  vary by preference (08's own theme-coupling bug, repeated). **Ruling that
  binds 11: a series artwork override with cover-art search WILL ship**, parallel
  to `/coverArtSearch` — the driver's dialog copy promises it, so 11 *designs* it
  rather than deciding it; it must ship before or with that copy, and **with the
  toggle OFF the override has nowhere to appear on browse** (the cluster is book
  covers, not series art). **Correction to 08 and to 12's own constraints: this
  IS a schema change** — every setting is a column on the `settings` table, so it
  costs one boolean + a migration; the series running total is untouched but
  neither ticket may claim zero schema cost. Build effort inherits two traps:
  `CompactSettingsRow` needs **`description` AND `onInfoPress`** (its control
  slot is taken by the switch — the reason `timer.tsx` has two info-icon shapes),
  and the getter must **invert the house `=== true` idiom** to `!== false`, since
  this is the table's first default-ON boolean and a migration leaves every
  existing tester `null`.

- [10 — Correction surface: where does fixing a series actually happen?](issues/10-correction-surface.md)
  — **Correction IS the existing edit screen**, grown by three things: **series
  artwork**, a **per-row canonical number** and **`Sort by number`**. Rename is
  02's commonest repair and still costs 5 taps; a dedicated rename dialog was
  offered and **rejected** for one-surface-one-validation. **Two visible routes,
  one word: `wrench` + `Edit series`** on both the detail row and a ⋮ that
  mirrors `titleDetails`. **08's "⋮ only" ruling is superseded** — 08 never built
  a ⋮, it built the wrench row — and **`Fix this series` is retired**, since it
  presumes breakage on the 98.3% of detected series that are correct and on every
  hand-made playlist. **07's number override is sited here** and editing a number
  deliberately **does not resort** (position keeps sole sort authority);
  **`Sort by number` re-seeds order** on demand, NULLS LAST and stable. **Bulk
  numbering ships but is gated to fully-unnumbered series** — 09's *bulk creates,
  per-item destroys* rules out renumbering over existing values, and "fill blanks
  only" was rejected because on `1, _, _, 8` it manufactures false canonical data
  (07: *blank beats misleading*). **Artwork lives in the editor** as a pressable
  cover + `ImagePlus`, parity with `editTitleDetails` (the app's only entry to
  `/coverArtSearch`); **`replaceBookArtwork` generalises to `replaceArtwork`**,
  **immediate-write is KEPT plus a confirm-BEFORE-apply** (deferring is
  incoherent — `RNFS.unlink` runs before the DB write, so the old cover is
  already gone), and **"pick a member's cover" is DROPPED** — web search subsumes
  it, so series art has exactly one override mechanism. **Book-first gets a read
  plus one shortcut**: a series line on `titleDetails` and an always-present
  `Add to series…`, but **no book-first remove**. Two findings worth keeping:
  **`Sort by number` silently changes the series cover** (08's art-follows-reorder
  rule, working as specified and reading like a bug — pinned art probably needs
  to look pinned, which is 11's), and **07's string-valued number forecloses the
  Android number pad** (`14b`, `1-3` need letters). **That one AMENDS 07**: the
  driver dropped the letter forms rather than the keypad (`14b` renames to
  `14.1`), so the field is a **`decimal-pad`** and `canonical_number` becomes a
  **nullable NUMBER** — structural rather than conventional, and most of 07's
  normalisation collapses to a parse. **Ranges are the casualty** (an omnibus
  can no longer say `1-3`), and there is a **locale trap**: `decimal-pad` shows
  the locale's separator, so `parseFloat('14,1')` silently returns `14`.
  **Costs zero NEW schema** (07's column changes type, none is added). Inherits
  the not-09-aware editor, and notes that `Save`'s `exitGroup()` — which pops the
  **whole series stack** — is **correct today** (no detail screen exists; the
  library really is the previous screen) and becomes wrong the moment 11 lands
  one, making it a constraint on 11's routing rather than a live bug.
  **AMENDED BY [11](issues/11-series-detail-contents.md) in two places: the ⋮ is
  GONE** (the driver removed it entirely rather than choose its contents, so the
  wrench row is the sole route to the editor and "two visible routes, one word"
  is now one), **and it was `Delete`'s exit that broke, not `Save`'s** — 11's
  root-sibling routing makes `Save`/`Cancel` correct by construction and leaves
  `handleDelete` popping onto the sheet of a deleted series.

- [11 — Series detail screen: what does it hold?](issues/11-series-detail-contents.md)
  — **A `formSheet` whose rows play, with no ⋮ and no back chevron.** Decided by
  grilling alone; **nothing was built** — verification is
  [13](issues/13-detail-sheet-prototype.md). The ticket was **half-dead on
  arrival**: 10 resolved a day after it was written and took four of its six
  decisions. **Presentation is a `formSheet` matching `titleDetails`**, the app's
  existing detail-screen-for-an-object — 05's push ruling explicitly does *not*
  transfer, because the wizard is a task flow and this is a container. That
  **forces a root-sibling route** (a screen inside `series/` cannot be a
  root-level sheet), which **resolves 10's `Save` handover for free**: the editor's
  `exitGroup()` pops the group and lands back on the sheet, no code change. The
  editor **stays in the group** (option A) making `Edit series` the app's first
  opaque push launched from a live sheet — a known `react-native-screens` rough
  edge on Android, hence 13; **fallback (C)** is documented, not chosen. **Rows
  play**: the whole row, body and image, starts/continues that book, so the
  screen has **no route to `titleDetails` at all** — which in turn forces
  **restart-from-zero on finished rows**, since `handleBookPlay` has no
  `Finished` case and would otherwise drop you at the last few seconds with no
  escape (`BookGridItem` retrofit ruled **out of scope**). **The ⋮ was deleted
  rather than filled** — one item duplicating a visible row is not worth its
  pixels; it returns when split/merge does. **The description was DROPPED
  entirely** (out of scope), removing two of the columns the schema section
  promised. Artwork override is **one nullable column, `series.artwork`** — no
  `*_source`, because nothing ever *detects* series art, so a source column would
  be a pure function of its neighbour's nullity. **The hero gets 08's scrimmed
  backdrop and DOES honour `Series Backgrounds`** — amending 12, at near-zero cost
  because both states were already designed (ON = 08's browse treatment, OFF = the
  flat prototype hero). **Pinned art rides the fan's front card**, which was
  already `books[0]`'s cover by construction, so `series.artwork ?? books[0].artwork`
  is one expression and 08 is untouched; the **editor gains a caption** that
  indicates pinned-vs-derived *and* reverts, answering 10's "pinned art needs to
  look pinned". Header is a **grab handle only** — the 48dp nav row goes.
  Schema: **one column**. Graduates [13](issues/13-detail-sheet-prototype.md).

- [13 — Build the detail sheet: does a push over a live sheet survive?](issues/13-detail-sheet-prototype.md)
  — **(C) ADOPTED, and the row got a second target.** Built on a REAL route
  (`src/app/seriesDetail.tsx` + one `Stack.Screen`), so 08/10/11's "it's a
  `Modal`, it says nothing about presentation" caveat is finally discharged.
  **The opaque push is the only presentation that misbehaves**: it presents
  fine and `Save`/`Cancel`/back all land on the sheet with its scroll offset
  **pixel-exact** (nothing remounts), but popping the group *reveals the
  LIBRARY* for ~165 ms and the sheet then **re-presents** with a full slide-up.
  Both shipped alternatives are clean over a live sheet — `transparentModal`
  cross-fades, `formSheet` slides down, each revealing the sheet already
  underneath — so `series/edit/[id]` becomes a root `transparentModal` matching
  `editTitleDetails`. A `formSheet` editor was offered (sheet-over-sheet is now
  proven) and **rejected**: 05 chose a push because the editor is a task flow
  with a Save/Cancel footer, and that survives the presentation change.
  **CORRECTION to 11 and to 13's own brief: the group boundary does NOT own
  `seriesDraftStore`'s lifetime** — `series/_layout.tsx` is a bare `<Stack>` and
  every reset lives on a screen, so (C) orphans nothing and `exitGroup()`
  collapses to a plain `goBack()`. Only the `Add books` sub-flow's return leg is
  untested. **Rows are now SPLIT — the cover plays, the text opens
  `titleDetails`** — which **REVERSES 11's "no route to `titleDetails` at all"**.
  That was never a technical finding; it fell out of "the whole row plays", and
  the question it implied (can a root `formSheet` present over another root
  `formSheet`? nothing in this app stacks two sheets) had never been asked.
  It can: presents fully, returns cleanly. **The glyph question dissolved into
  the target question** — a glyph is only worth its pixels if it discriminates,
  which needs two targets — and **the scrim shrank to the GLYPH ITSELF**: 0.42
  black as the triangle's `fill`, near-white stroke as its border, every pixel
  outside it untouched artwork (a 26dp disc was built and rejected as "still a
  darkened patch"). **Restart-from-zero KEPT** despite the escape hatch
  returning. **`Delete` is broken worse than 11 predicted — a full-screen WHITE
  sheet**, because the route renders `null` and `titleDetails`-style options set
  no `contentStyle` background (`player` does, `_layout.tsx:239`); it needs
  BOTH a routing fix and a background. Also verified: hero honours
  `Series Backgrounds` in both states (and needed an unspecified bottom fade or
  the backdrop's edge is a seam), pinned art rides the front card **and the
  backdrop follows it**, both caption states work, rows play for real with
  `LoaderKitView` on the active one. New traps: **a non-square pinned cover
  pillarboxes** in the square cluster box (series art is likelier non-square
  than book art), and **playing a real book collapses a synthetic series'
  fabricated progress** to real values (`reconcileProgress`'s `hasMix`).
  Costs **no schema**. tsc 0 / eslint 0 / jest 484.

- [14 — `titleDetails` integration: where does the series line sit?](issues/14-titledetails-integration.md)
  — **A STATIC subheading under the book title — `Book 8 of Discworld` — showing
  exactly ONE series, the largest DETECTED one.** Four variants built on the real
  route. **AMENDS [10](issues/10-correction-surface.md) in two places**: 10 said
  the line "renders a LIST because multi-membership is real" and "taps through to
  series detail", and it now does **neither** — *Guards! Guards!* reads
  `Book 8 of Discworld` and never mentions Night Watch 1 here. Driver's rule was
  *"derived series, or the first series created by the user"*; the tiebreak it was
  silent on — **two DETECTED series, the real case** — resolves as **largest
  wins**, because detected series have no meaningful creation order (it is scan
  order) so size is the only signal, while the user-created fallback keeps
  "first created" *because* its order is meaningful. **The asymmetry is the
  ruling.** Static because a subheading reading as prose has nowhere to put an
  affordance cue without becoming a field again — the thing that made it win.
  **The framing measurement: there is NO vertical slack** — in the control
  `Continue Listening` sits *exactly* at the fold, so every variant spends space
  that does not exist. **`4th card` was the only free option and could not be
  used**: zero vertical cost, but it drops the series NAME (`#6` — of what?),
  truncates to `Series +…`, and fails 10's content ruling outright. It beat three
  structurally different rivals, each asserting a different answer to *what kind
  of thing is a series* (identity/byline · tag/chip · metadata/card); the
  subheading asserts a fourth — **part of the title block, the way a printed
  cover does it**. **`Add to series…` sits under `Edit Book Details`.**
  **`Layers` was found doing double duty** — the library's Series toggle AND
  `Remove Auto-Chapters`' glyph, which would have put identical icons on adjacent
  rows — so **auto-chapters moves to `TableOfContents`**; that one import plus one
  element in `titleDetails.tsx` is the ticket's **only real-code change**.
  **Trap for [19](issues/19-write-the-spec.md): the `marginTop: -17` is
  load-bearing** — `bookInfoColumn`'s `gap: 20` made the line its own block, and
  the driver's target was the `Read by`→narrator gap, which is *no gap at all*;
  the 20dp below is deliberately kept. **Round trip discharged** from the
  opposite direction to 13. Costs **no schema**. tsc 0 / eslint 0.

## Not yet specified

In scope, but not yet sharp enough to ticket. Graduates as the frontier advances.

> **2026-08-04 — six of the eight patches below graduated into tickets 14–20**
> once the thirteenth resolution landed and the frontier emptied. Each graduated
> patch was **cleared from this section** and its accumulated context carried
> into the ticket body, so it now lives in exactly one place. What is left below
> is the genuine residue: two patches nobody has sharpened, and one question
> (animation) that was riding along inside a patch that graduated without it.

- **Animation.** The only piece of the old *Light theme / font scale / animation*
  patch that did **not** graduate — deliberately. Nobody has yet stated what the
  animation question *is*: [13](issues/13-detail-sheet-prototype.md) measured the
  sheet transitions on a real route and they were clean, 08 chose a row with no
  expansion to animate, and no ticket has asked for motion anywhere. It stays fog
  because it fails the graduation test — the question cannot be phrased sharply,
  not because it cannot be answered.
- **Re-verifying the existing series logic** — assumed correct, never re-checked
  against the redesign's assumptions. Stayed fog on 2026-08-04 rather than
  graduating: nobody can yet say *which* assumptions are load-bearing enough to
  be worth checking, and the honest reading is that this belongs to the
  **implementation** effort (it verifies code, not a decision) — which would make
  it out of scope rather than fog. Left in scope pending a driver ruling, because
  the map should not quietly shed work it once claimed.

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

- **Retrofitting the app-wide "inapplicable menu item" convention.**
  Driver-raised 2026-08-04 while resolving
  [10](issues/10-correction-surface.md): an overflow item that does not apply
  should be **absent, not disabled at 0.4 opacity**, reversing the
  `Remove Auto-Chapters` precedent (`titleDetails.tsx:346-370`) this map had
  recorded as the pattern to copy. **The new convention binds this effort** —
  10's series line on `titleDetails` is absent when a book is in no series — but
  changing `Remove Auto-Chapters` itself is a book-screen change, not a series
  one. No two-conventions-in-one-menu problem is created in the meantime:
  10's `Add to series…` has **no** inapplicable state, because multi-membership
  means any book can always join another series.

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

- **A series description.** Driver-raised on 2026-08-03 and driver-**dropped** on
  2026-08-04 while resolving [11](issues/11-series-detail-contents.md):
  *"drop the description all together."* It was the only item on 11's list that
  added a feature rather than deciding a presentation, and it dragged a column, a
  `*_source` companion (08's session had confirmed it must be rescan-protected
  like `name`) and an editor field behind it. Withdrawn from the schema section,
  which had already promised it.

- **Pillarboxing of non-square covers on a fan's front card. Driver-accepted
  2026-08-04 (*"accept it"*), ruled not worth fixing.**

  **Scope, stated precisely because it was framed two wrong ways first — it is
  NOT pinned-art-only and it is NOT the edit screen.** It is **any** non-square
  cover on **any** `CoverCluster` layer, which means **browse rows and the
  detail hero**, and it happens with **derived** art exactly as much as pinned.
  It is visible on the emulator today in the `Discworld Proto` browse row
  (`assets/13-detail-sheet/17-FINAL-browse-glyph-no-front-scrim.png`) with
  nothing pinned. Pinning only raises the odds, because web-searched *series*
  art is less often square than a book cover.

  **Why only there.** The geometry is identical everywhere — `fitInBox`
  (`seriesFacts.ts`) and `CoverCluster` both shrink the image to touch its box on
  the long axis, leaving space on the short one. What differs is what fills that
  space. The editor's 88dp cover and the detail sheet's 46dp row covers leave it
  **unfilled**, so it is page background and invisible
  (`07-pin-caption-pinned.png` — the editor looks clean). `CoverCluster` layers
  fill it with **`PILLAR`, a fixed `#0B0B0B`** (`seriesCardParts.tsx:79`),
  deliberately *not* `themeColors.background` so it reads as a cover's own
  letterbox and does not become a white hole in light theme. Against the hero's
  scrimmed backdrop that near-black is darker than its surroundings, so it reads
  as bands (`08-pinned-art-on-fan.png`).

  **Accepted as cosmetic** — it was present through all fourteen of 08's browse
  variants and never remarked on, which is some evidence it reads as a letterbox
  rather than a fault. Two fixes were offered and declined: **crop-to-fill the
  front layer** (bands go, square box and glyph alignment survive, but the edges
  of tall art are lost) and **re-colouring `PILLAR`** to the theme background
  (cheapest, but reintroduces exactly the light-theme hole `PILLAR` exists to
  prevent). Do not abandon the square box — 08 squared it so the glyph aligns and
  every row's text column starts at the same x, and letting the front layer track
  the artwork's aspect is what misaligned it in the first place.

- **Retrofitting restart-from-zero to `BookGridItem` — OUT OF SCOPE HERE, BUT
  THE DRIVER WANTS IT FIXED. This is a carried commitment, not an accepted
  divergence.** `handleBookPlay` has no `Finished` case
  (`handleBookPlay.ts:44-68`), so a finished book resumes at its last few
  seconds everywhere in the app.

  **This entry previously read "a known, accepted inconsistency… not an
  oversight" and that is now REVERSED** (driver, 2026-08-04, resolving
  [13](issues/13-detail-sheet-prototype.md)): *"doublecheck that we have put in
  a note to correct this in `BookGridItem` to match this better behavior."*
  There was no such note — the map recorded the opposite — hence this rewrite.

  The reversal has a history worth keeping. 11 ruled restart-from-zero *in* for
  the detail rows **because that screen had no route to `titleDetails` and
  therefore no escape hatch**, and the library grid was left alone on the
  grounds that it *had* one. 13 then restored the escape hatch (the row split
  opens `titleDetails`), which removed that justification — and the driver kept
  restart-from-zero anyway, on the grounds that landing 30 seconds from the end
  of a finished book is a poor outcome whether or not you can seek out of it.
  **So the argument is no longer "this screen is special"; it is "this is the
  better behaviour", which applies everywhere.**

  It stays out of scope for *this* map on scope grounds only — `BookGridItem` is
  the library grid, a book-screen change, and this map ends at a Series spec.
  **The follow-on effort should fix it**, ideally by giving `handleBookPlay` the
  `Finished` case rather than duplicating the caller-side rewind that
  `ProtoSeriesDetailSheet` currently uses. Until then the inconsistency is
  live and **known to be wrong**, not sanctioned.
