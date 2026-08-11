# Device check — ticket 15, series artwork

**COMPLETE — all 16 criteria closed. Run split across two sessions on 2026-08-11.**

**Rig:** physical Pixel 7 Pro (`29131FDH3009SZ`), real library — 355 books / 33 series.
**Build:** dev build + Metro (`expo start --dev-client`). Ticket 15 is all JS, so a bundle
reload is the whole install. Driver drove; agent captured and measured over adb.
**Screenshots:** `device-check/tk15-*` (19 files).

**Filesystem baseline:** `files/artwork/` = **331** files, **0** `series_*`.
**Filesystem after session 1:** **331** files, **0** `series_*` — the run leaked nothing.
**At close:** Bobiverse carries a pin the driver made between sessions; that is a real library state, not test residue.

---

## Closed

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Control exists beside the name field (§D6) | Cover box measured **88.0 × 88.0 dp** = `COVER_BOX_SIZE`. `ImagePlus` badge bottom-right on the 70% scrim chip, mirroring `editTitleDetails`. Name field 53.4dp, centred against the cover column to within **2.4dp**. `Sort by number` still full-width and right-pinned. |
| 2 | Absent from the create pass (§E9) | `New series` renders the name field at the left screen margin, full width. No box, no caption, no reserved column. |
| 3 | Derived preview follows the drag order (§D10) | Dragged book 02 to the top → cover box changed across its **full 88×88** (mean delta 69.2/255), caption band **byte-identical**. Then `Sort by number` → cover **pixel-identical** to the pre-drag state (mean delta **0.00**) and the whole ordered-list region diffed to bbox **`None`**. |
| 4 | Search opens pre-seeded | `Dennis E. Taylor Bobiverse series cover`. `sharedAuthorName()` resolved (all 5 books one author). The `series` token earned its place — results included a `THE BOBIVERSE VOL 1-3` omnibus, a boxed-set photo and a 4-up collage, i.e. collection covers a book-shaped query does not return. |
| 5 | Confirmation BEFORE applying (§K6) | Dialog: **“Use this cover? / It is saved right away — the editor’s Cancel will not undo it.”** `CANCEL` · `USE COVER`. |
| 6 | Cancelling changes nothing | After `Cancel`: 331 files, 0 `series_*`, **0** `cache/cover_download_*.tmp`, and the screen **stayed on the search grid** rather than returning to the editor. The download never started. |
| 7 | Pin writes exactly one file | `series_58b1f25a.webp`, 6890 B. 331 → **332**. 0 leftover temps. |
| 8 | Caption flips to the pressable state (§D7) | `#FFB606` — **byte-identical to `Sort by number`**. Null state was `#D8DEE9` — **byte-identical to the instruction line**. Each state joined the right family, not just different words. 9.69:1 contrast. |
| 12 | Replacing overwrites in place (§K6) | **Same filename** `series_58b1f25a.webp`; 6,890 → 103,200 B; md5 `30dcff11…` → `1b001745…`; total files **332 → 332**. No net new file, no orphan. This is what keying the filename on the series id alone buys. |
| 13 | Revert is ONE press and DELETES the file (§K8) | `ls: files/artwork/series_58b1f25a.webp: No such file or directory`. 332 → **331**. Caption band byte-identical to the pristine derived shot. No dialog. |
| 14 | Deleting a series releases its file (§K8) | Throwaway `ZZ Test` pinned `series_208aec2b.webp` (63,396 B) — note the **different hash** from Bobiverse's, two series two files. After `Delete Series`: `No such file or directory`, 332 → **331**. |

### Two measurements worth keeping

- **The revert's cover box diffs 4.16/255 against the original derived screenshot, not 0.00.**
  Mean luma **identical to one decimal** (96.8 vs 96.8), differences spread evenly across the
  whole box. That is FastImage re-decoding the book's cover at a slightly different resample
  after the URI changed back — not a different image. The caption band, being text on flat
  colour, *is* byte-identical. Do not chase this.
- **Hero fan geometry (pre-amendment):** column-profiling found the layer borders (drawn in
  `#1C1C1C`, the background token) at x=405 and x=440 px with the stack ending at x=473 —
  a drawn width of **~123 dp against the rule's predicted 124.8 dp**.

---

## §C8 AMENDED MID-RUN — driver ruling, 2026-08-11

Raised by the driver at step 6, after seeing pinned art drawn as the fan's front card.

> *"The series art is only used for the header background and the series list cards
> background, so cover 1's cover should always show at the top of the book stack, not the
> series cover — they should only be in lockstep if the user is using the first cover as the
> series cover, and that is just by happenstance."*

Spec §C8 amended **in place** with the full reasoning and the overturned clause preserved.
Ticket 15's C8 criterion rewritten. Built and green, **NOT YET DEVICE-VERIFIED.**

**What triggered it:** a pinned cover is drawn assumed-square (no `artwork_width`/`_height`
companions; §G closed at 13 columns), so a tall source is centre-cropped. As an 88dp **card**
that sliced the author's name off the top and the series title off the bottom of a real
cover. The ruling **dissolves that finding** — a backdrop is scrimmed, faded and cropped by
design, so the missing columns stop mattering and no v34 migration is implied.

**Built:**
- `heroClusterCovers` **DELETED**. Stripped of its pinned branch it computed
  `getSeriesRowFacts().cluster` character for character; the hero reads that now.
- `seriesBackdropUri(series)` in `seriesArtwork.ts` — pinned artwork, else book 1's cover.
  The backdrop used to be read off `covers[0]`, and sharing that one line is exactly what
  made the fan and the backdrop move together.
- `SeriesBrowseRow` now reads `series.artwork` **for the first time** — its card backdrop is
  one of series art's two homes.
- **MUTATION-PROVEN:** re-introducing the pinned substitution into `getSeriesRowFacts` fails
  exactly **2** tests; reverting restores all 24. One guard, both fans.

### ⚠ The pixel A/B that is already banked

`shots/10-browse-pinned-BEFORE.png` is the Bobiverse browse row captured **while pinned,
before the amendment**: fan = `We Are Legion`, card backdrop = `We Are Legion` (the giant
`LEGION (WE ARE BOB)` lettering reads straight across the row). After the change the same row
must show **the blueprint as its background with the fan unchanged**. That is a direct pixel
A/B, not a judgement call — but the file lives in the job's tmp dir. **Re-capture it before
reloading if the job is gone.**

---

## Session 2 — the §C8 amendment, themes and font scale

| # | Criterion | Result |
| --- | --- | --- |
| 9 | Fan front card is book 1 (§C8 **amended**) | Hero A/B vs the pre-amendment capture: **front card mean delta 85.64** (blueprint → *We Are Legion*), **back layers 2.65** (books 02/03 untouched), book list control 0.50. Cluster geometry **identical**: layer borders at columns **401–403** and last card column **462** in BOTH captures — same width, same peek, same positions. |
| 10 | The backdrop is the pinned art (§C8 **amended**) | Hero backdrop `(43,47,61)` matches the browse row's proven-pinned backdrop in character; the front card averages `(73,109,103)`. Background and front card are demonstrably two different images — which is the entire point of splitting the expression. |
| 11 | Browse row background = pinned art, **fan unchanged** | Direct pixel A/B vs `tk15-10-browse-pinned-BEFORE.png`: **fan 0.37** (unchanged), **backdrop 25.28** (changed), and the **Bromeliad control row diffs to bbox `None`** — zero differing pixels, so the captures are aligned and the signal is real. ⚠ The fan figure is a REGRESSION check, not evidence of the amendment: the browse fan never carried pinned art even before. The backdrop change IS the amendment — that row read `series.artwork` for the first time. |
| 15 | Light theme, both caption states | muted `#4B5563` @ **6.56:1**, byte-identical to the instruction line · pressable `#FFB606`, byte-identical to `Sort by number`. Same relationships as dark. Hero title over pinned art **13.39:1**, meta **6.03:1**. |
| 16 | Font scale 2.0 — the identity row stacks | Cover box **88.0 × 88.0 dp, unchanged**. Caption **268.6 dp wide on ONE line**, not clipped. Header ends at **461.7 dp = 52%** of screen, leaving **429.7 dp** of list. Verified it was font scale and not Display Size (`font_scale` = 2.0, `wm density` still 560). Restored to 1.0. |

### Light-theme contrast: two findings, both scoped

- **Pinned backdrops are NOT worse than derived ones.** Browse rows measured: Bobiverse
  (pinned) **13.74:1**, Bromeliad 13.31, Cerulean 14.41, Demon Accords 13.81 — the pinned row
  sits mid-pack. Pinning adds no new light-theme exposure. ⚠ This is NOT a re-adjudication of
  §I5; different sampling method, not this ticket's to reopen.
- ⚠ **The accent measures 1.53:1 as text on the light ground — and `Sort by number` measures
  EXACTLY THE SAME.** Byte-identical colour, same background. **Ticket 15 did not introduce
  this**; the caption inherited it by following the screen's own convention. Two reasons it is
  written down: the caption is the *worst instance* on the screen (10px regular vs the
  button's 16px semibold), and it is the **escape hatch**. **DEFERRED to the whole-app colour
  branch by recommendation** — the accent is user-settable AND cover-derived, so a per-site
  override would not survive it, and fixing this one label would make it the only
  accent-coloured control on the screen that is not the accent.

---

## `HERO_SCRIM` DELETED — driver ruling, 2026-08-11, measured on device

The driver noticed the detail sheet looked "much more whited out" than the series list. It was
real and it was in the code: the hero laid a **flat `background @ 0.55`** over the backdrop
before the horizontal gradient; the browse row never did.

| Surface | layers over the image | mean \|Δ\| from page bg | p95 |
| --- | --- | --- | --- |
| Browse row | image + ONE gradient `[bg, .92, .55]` | 15.07 | 20.33 |
| Hero **before** | image + **flat `bg@0.55`** + gradient `[bg, .9, .5]` | **4.68** | 8.00 |
| Hero **after** | image + ONE gradient `[bg, .92, .55]` | **13.47** | **20.67** |

**p95 20.67 vs the row's 20.33** — peak image presence now identical, which is what "same
stack" should produce. The residual gap in the *mean* is §C7's bottom fade, which the hero has
and the row does not.

**Why it went rather than being tuned:**
1. **§C7 already said so** — the backdrop-ON state *is* "the browse treatment"; the widening is
   "a conditional, not a design".
2. **§C8's amendment changed what the backdrop is FOR.** It used to be book 1's cover — ambient
   texture derived from an image sitting inches away. It is now the **only** place a user's
   pinned series art appears, and burying it defeats the point of pinning.

Contrast held: hero title 14.02 → **13.39:1**, meta 6.27 → **6.03:1**. Nothing near AA.

---

## Closed

**All 16 criteria verified.** `tsc` 0 errors · eslint 0 errors (35 warnings, none in a file
this ticket added or touched) · jest **52 suites / 646 tests**, up from 620.

Two things deliberately NOT done, both recorded above: §I5 was not reopened, and the accent's
1.53:1 on light was deferred to the whole-app colour branch rather than patched at one site.
