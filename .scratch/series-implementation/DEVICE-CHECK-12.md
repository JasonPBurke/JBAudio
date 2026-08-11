# Device check — ticket 12, the editor becomes one route

**2026-08-10 · `Pixel_7_Pro` emulator, 1440×3120 @ 560dpi · dev build from
`android/app/build/outputs/apk/debug/app-debug.apk` (2026-08-07), JS loaded over Metro.**

Ticket 12 is all JS, so a Metro load sufficed — no native rebuild. Both device criteria are
closed. Screenshots and both recordings are at `device-check/tk12-*`.

## Why the emulator and not the phone

The driver offered the physical device; it was declined for this ticket. 12 is routing and
presentation — which route, which transition, what back means, what colour the route paints
when it renders nothing — and none of that scales with library size. The phone earns its
keep on [13](issues/13-editor-picker-panel.md), whose picker has to face 350 books.

Emulator library: **50 files · 7 units → 1 series, 3 books placed** (`The Dresden Files`,
detected). Four authors. That is enough to exercise both launch contexts and a real create.

## What was driven

| # | Step | Result |
| --- | --- | --- |
| 1 | Library FAB (**launch context 1**) | The editor opens as `New series`, panel already on Authors |
| 2 | `X` | Panel closes onto the editor; **`Add books to get started.`** renders verbatim (§E4/E6) |
| 3 | `+ Add books` → Jim Butcher → `Next` | Books step, pool scoped to that author |
| 4 | Two books → `Done` | Committed into the ordered list **on the same screen**; subtitle switches to the drag instruction |
| 5 | Name `The Dresden Files` → `Save` | **`A series named "The Dresden Files" already exists. Choose a different name.`** |
| 6 | Rename → `Save` | Created; returns to the library **Series view with its toggle intact** |
| 7 | Row → sheet → `Edit series` (**launch context 2**) | The **same route**, `id` present: title `Edit series`, name and list seeded, `Delete Series` present |
| 8 | **Hardware back** | Lands on the **detail sheet** — no library flash, no re-presenting sheet |
| 9 | Repeat 1–8 in **light theme** | Identical behaviour |
| 10 | `Delete Series` → confirm | Lands on the deleted series' sheet, **themed, with a grab handle** (see below) |

65,390 logcat lines over the run: **no `FATAL`, no unhandled JS, no failed series write.**

## The two device criteria, and how each was measured

### Every route out means one thing, from both launch contexts — CLOSED

Both launch contexts reach one route (`/seriesEditor`), and `id` is the only difference.
**Hardware back returns to the launcher, not through it** — library for a create, detail
sheet for an edit. §J1's failure mode is gone: no library exposure, no sheet re-presentation.

Worth stating plainly because it is the point of the ticket: **no `BackHandler` implements
this.** A root route has no stages behind it, so back means one thing by construction.

### No white flash on entry or exit, in either theme — CLOSED, measured

`adb shell screenrecord` captures **variable-rate** (one frame per screen change), so
`ffmpeg -vsync 0` yields one image per distinct state. Every frame was measured for mean
brightness and standard deviation.

- **Dark theme**, sheet → editor → back: **44 distinct frames, brightest mean 0.1224.** A
  white sheet is ~1.0. Nothing close.
- **Light theme**, both launch contexts: **86 distinct frames, ZERO flat fills** at
  σ < 0.03 — the screen never becomes a featureless sheet in either direction. Brightest
  frame is 0.7425 at σ = 0.36, i.e. a real page.

⚠ **In light theme, brightness alone cannot answer this question and it is a trap.** The
legitimate page already measures **0.876**. What separates a bug from correct behaviour is
the token: `background` is **`#eceff4` → mean 0.940**, while an unthemed route paints
**`#ffffff` → 1.000**. So the test is *flat AND brighter than 0.940*, not merely bright.

### The K7 state, reached deliberately, in light theme

`Delete Series` still pops onto the sheet of the series it just deleted — §K7's first half,
**owned by [16](issues/16-editor-detection-aware-save-and-delete.md)**, unchanged here. What
that state now renders was measured: **mean 0.93844, σ 0.0277** — that is `#eceff4` to
within the grab handle and status bar, **not white (1.000)**. So 11's `MissingSeries` holds
in light theme too, and the escape handle is present. K5's half is closed; the routing half
is not, and is not this ticket's.

## Two findings, both pre-existing, both already owned

1. ⚠ **K15 — the disabled footer button is a blank light rectangle.** Seen immediately on
   the create pass: `themeColors.divider` fill with `themeColors.textMuted` text, so the word
   vanishes. **This is not new and not a regression** — it is the same defect the wizard's
   `Next` and the old editor's `Save` both carried, now on one button instead of three. The
   spec records it at K15 and **ticket 14 owns it** ("fix it wherever this ticket disables a
   control"). The *enabled* state is fine and legible in both themes.
2. **`Alert.alert` paints dark-on-white in both themes.** Seen on the duplicate-name alert.
   App-wide and pre-existing; logged on ticket 09, not fixed here.

Neither was introduced by this ticket and both were carried over verbatim rather than
restyled — 12 changes routes, not appearance.

## Method notes worth not re-deriving

- **`adb pull` can beat `screenrecord` to the file.** The first light-theme recording pulled
  with **no `moov` atom** because the recorder had not finalised. Stop it with
  `adb shell pkill -INT screenrecord` and sleep before pulling; a `--time-limit` that merely
  *should* have elapsed is not a guarantee.
- **`screenrecord` cannot encode 1440×3120** on this AVD (`err=-22`) and falls back to
  720×1280 by itself. Harmless for brightness work.
- **`cmd uimode night no` does NOT flip the app's theme.** `themeStore` persists an explicit
  mode and only follows the system when that mode is `'system'`; this emulator is saved as
  `dark`, so the theme has to be changed in the app's own settings.
- **A dev server rewrites `.expo/types/router.d.ts` on its own.** Metro was already running,
  so the new route typechecked immediately. Without one, a new route is a `tsc` error on the
  `href` until Metro has booted once.
