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
- **`Grouping` is present on only 1 of 5 sampled book sets** (Dresden). Do not
  build on it as the primary signal. Full evidence in ticket 01.
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

## Not yet specified

In scope, but not yet sharp enough to ticket. Graduates as the frontier advances.

- **Series detail screen** — whether one exists at all, what it holds, and how it
  relates to inline expansion. Waits on ticket 08's browse decision.
- **Review & correction surface** — the new mode between "auto" and "manual":
  confirm/reject a proposal, split a series that merged two editions, merge two
  that should be one, reassign a mis-filed book. Waits on 02 and 06.
- **`titleDetails` integration** — what series info a book's detail screen shows,
  and whether membership can be edited book-first rather than series-first.
- **Consolidated schema decisions** — canonical number, edition, detection
  confidence, user-override/"don't re-detect" flag, series artwork. Individual
  pieces surface in 06/07 and the review surface; they need one coherent pass.
- **Wizard flow shape as fallback** — the 3-step funnel may be wrong once the
  review surface absorbs part of its job. Fold in the defects logged in
  [05](issues/05-wizard-presentation.md): the inactive Next/Save button renders
  with an **invisible label**, the wizard has no app header, and every step has a
  large dead vertical region.
- **Tablet / large-screen behaviour** — this app has a history of tablet layout
  bugs; every browse variant eventually needs a tablet answer.
- **Re-verifying the existing series logic** — assumed correct, never re-checked
  against the redesign's assumptions.

## Out of scope

Ruled beyond this destination. Does not graduate.

- **The clipped-row bug as a standalone hunt.** Deferred by the driver;
  5 hypotheses already refuted. Tickets 05 and 08 may dissolve it as a side
  effect, but chasing it is not on the route.
- **Merging to `main`.** Both series branches stay open.
- **The implementation itself.** This map ends at an approved spec.
- **Auto-generating series from an online database** (Audible/Goodreads lookup).
  Local signals only.
