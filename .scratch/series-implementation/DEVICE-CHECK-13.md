# Device check — ticket 13, the editor's on-demand book picker

**2026-08-10 · physical Pixel 7 Pro (`29131FDH3009SZ`) · the driver's real library.**
Dev build, JS served from Metro over `adb reverse tcp:8081` (13 is all JS, so no native
rebuild — see [[native-changes-need-native-rebuild]]). Screenshots in
`device-check/tk13-*`; filtered logcat at
`device-check/tk13-device-2026-08-10.filtered.log` (**zero JS errors or warnings across
the whole run**).

Rig: 1440×3120 @560dpi = **411dp**, targetSdk 36.
Library, read straight out of `watermelon.db`: **355 books · 79 distinct authors · 33
series · 250 `series_books` rows · 0 suppressions.**

---

## §E13 — the pool is virtualized. Measured against the code it replaces.

The old build was put back on the device (`git stash`, relaunch) and driven through the
same two screens on the same library, so this is an A/B on one rig, not a before/after
recollection. The instrument is `dumpsys gfxinfo <pkg>`'s **`View hierarchy`** line, which
reports the app's live Android view count — the thing virtualization is *for*.

| state | rows in pool | views | render nodes | worst frame |
| --- | --- | --- | --- | --- |
| **OLD** authors step | 79 | **583** | 1329 kB | 57 ms |
| **NEW** authors step | 79 | **416** | 883 kB | 16 ms |
| **OLD** books step · `Terry Pratchett` | 82 | **917** | 1981 kB | 200 ms |
| **NEW** books step · same pool | 82 | **480** | 1003 kB | 150 ms |
| **NEW** books step · 21 authors | **108** | **462** | 961 kB | 69 ms |

Read the last two rows together — that is the whole ticket:

- The old build costs **≈5.3 views per pool row** ((917−480)/82). It is linear in the pool,
  and `Terry Pratchett` alone is **81 books** on this library.
- The new build is **flat**: a 108-row pool renders *fewer* views (462) than an 82-row one
  (480), because both are just the viewport. Selecting more authors no longer costs
  anything to mount.

**Scrolling is smooth in both** — NEW 253 frames / 0.79% janky / 95th 12 ms, OLD 124 frames
/ 0.81% janky / 95th 10 ms. That is expected and is not the finding: once the old build has
paid to mount every row, scrolling them is cheap. The cost it pays is at the commit, in
views and in memory, and it is the cost that grows with the library.

## §E3 — staging, measured in pixels on the real library

Screenshots before/after each selection tap, differenced per pixel (threshold 8/255):

| | changed px | **above the panel** |
| --- | --- | --- |
| tap 1 | 107,597 | **0** |
| tap 2 | 29,609 | **0** |

Tap 2 (29,609) reproduces the prototype's chosen shape (28,488) almost exactly; the
rejected shape measured 547,334. Tap 1 is bigger only because the *first* selection also
flips the footer button from its inactive state to `Done` — that is **below** the panel,
not above it. **Nothing above the panel moved on either tap.**

## The rest of the criteria

- **`+ Add books` opens Authors → Books over the editor** — `tk13-01`, `tk13-04`. The
  create pass opens straight on the picker; the edit pass opens on the list (`cleanup5`),
  so 12's mode asymmetry is intact.
- **The ordered list stays on the surface beneath it** — `tk13-12` shows the shipped §E13
  arrangement in one frame: four ordered rows with their grips as the **list header**, then
  the `Add books` head, then the pool.
- **Selections are kept when the author filter changes** — structural: the pool is a pure
  function of the filter (`pickerRows` is never told what is staged) and the staged keys
  live in the draft store. Pinned by tests on both sides.
- **`X` closes the panel onto the editor and never abandons the series** — `tk13-20`.
  Reached with an empty list, which is the case that only became reachable under §E4.
- **The empty state reads `Add books to get started.`** — `tk13-20`.
- **§H7 — no 600dp cap on this surface.** Confirmed at 411dp in all four theme × font-scale
  combinations; the radio rows and the grabbers run to the screen edge.
- **Font scale 2.0, both themes** — `tk13-14`/`tk13-15` (dark), `tk13-18`/`tk13-19`
  (light). Nothing clips: the subtitle wraps to two lines, the head band grows with its
  text and keeps `X` on the row, and the book rows are text-driven so the fixed 60×80
  artwork never bounds them.
- **The sticky head pins** — `tk13-02` shows it held at the *end* of the 79-row author
  pool. In the old build (`tk13-09`) the head has scrolled away entirely and closing the
  panel starts with a scroll back to the top.
- **Dragging still works, in both containers** — `tk13-13`: a row dragged from 4th to 1st
  *inside the picker's list header*, with the pool below unmoved. The panel-closed path is
  unchanged from 12.
- **Built a cross-author playlist end to end and saved it.** `Ticket13`, four books, three
  authors (Christie · Weir · Moore), verified in the DB in the dragged order:
  `pos 0 Project Hail Mary · 1 Lamb · 2 Miss Marple · 3 The Martian`, provenance null (a
  hand-made series, matching 06's finding that `createSeries` stamps none). It rendered
  correctly in browse (`tk13-21`) and on the detail sheet in the same order (`tk13-22`),
  then was **deleted through the editor** — library back to **33 series / 355 books / 0
  suppressions**, so the driver's library is exactly as it was found.

---

## Findings

### 1. ⚠ The selection tick's contrast is a property of the ACCENT, not of the design — and the "fix" measured worse

Ticket 07 flagged the filled tick (accent fill, glyph knocked out in
`themeColors.background`) as a light-theme item and fixed the Series Detection card the
other way round (accent tint, accent glyph). That idiom was built here, **measured on the
driver's real light theme, and reverted**:

| accent | fill + knockout (shipped) | tint + accent glyph (reverted) |
| --- | --- | --- |
| the auto accent in use, teal `#4898B8` | **2.82:1** | 2.43:1 |
| the driver's custom amber `#FFB606` | **1.53:1** | 1.41:1 |
| a dark accent `#1F5673` | **6.91:1** | 5.43:1 |

The tint is worse at every accent, and **both track the user's colour choice rather than
the design** — which is the reading the driver already ruled on in ticket 09, withdrawing
an accent-contrast finding for exactly this reason. Shipped as-is. Selection is signalled
three ways regardless (row border, ring, glyph). The table is pinned in a comment above
`AuthorRow` so the swap is not re-proposed without a new measurement.

### 2. K15's blank disabled button is DARK-THEME ONLY — new detail for ticket 14

The inactive footer button renders **blank** in dark theme (`tk13-01`, `tk13-04`) but shows
a legible grey `Next`/`Save` in light (`tk13-16`, `tk13-18`). So the defect is not "no
label" — it is `textMuted` on `divider` colliding in one theme. **14 owns it; this is not
13's and not a regression.**

### 3. The library's `+` FAB is unreachable at font scale 2.0 — harness only

At 2× the prototype chip (`15 • new series • E • Editor + author panel`) covers the create
FAB. The chip is `__DEV__`-gated and ticket 18 deletes it, so this cannot reach a shipping
build. Worked around here with the deep link `sonicbooks://seriesEditor`, which is worth
knowing: **it opens the create pass directly and needs no navigation.**

### 4. Pre-existing, logged not fixed

`Alert.alert` still paints dark in light theme (`cleanup6`) — same note ticket 09 recorded,
app-wide.

## Method notes worth keeping

- ⚠ **`adb shell input swipe` is NOT a drag for `react-native-sortables`.** A swipe over a
  grabber does nothing at any duration; **`adb shell input draganddrop x1 y1 x2 y2 <ms>`
  works first time.** Cost one wrong "the drag is broken" reading.
- **`dumpsys gfxinfo <pkg>` ends with a `View hierarchy:` section giving the live view
  count and render-node bytes.** That is the direct measure of virtualization and it is far
  better evidence than frame timings, which look fine in *both* builds.
- **A font-scale change recreates the activity**, so the editor remounts and the draft
  resets. Set the scale first, then navigate — not the other way round.
- **`run-as` + `cat` still works on the dev build**, and `watermelon.db` is at the app data
  root with its `-wal`/`-shm` beside it (pull all three; the WAL held 4.3 MB here against a
  5.1 MB main file). Python's stdlib `sqlite3` reads them.
