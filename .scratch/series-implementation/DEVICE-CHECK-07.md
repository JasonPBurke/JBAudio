# Ticket 07 — device check

**2026-08-08, physical Pixel 7 Pro (`29131FDH3009SZ`), dev build, driver's real library
(3,461 files / 352 books).** Branch `feature/series-styling`, uncommitted. Raw log:
[`device-check/tk07-device-2026-08-08.series.log`](device-check/tk07-device-2026-08-08.series.log);
screenshots `device-check/0*.png`.

**All acceptance criteria are closed, including the light-theme one that was the ticket's last
open item.** Two findings are recorded at the bottom — one fixed during the session, one logged
for the driver.

## Starting state, and why it was the right one

The driver scanned the whole library **with detection toggled off** before the check began. That
is a stronger starting point than a fresh install, because it separates the two halves of A9's
OFF ruling — *stop examining* and *leave existing series alone* — and lets the retroactive button
be measured against a library it has provably never touched.

    [series] detection is off — no series were read or written
    [scan] 189638ms total · 3461 files, 3461 new (54.3ms/new file) — … · detect 3ms

**`detect 3ms` against the 338 ms ticket 06 measured for a real run** is the guard being real
rather than asserted: it returns before its first read, so there was nothing to write. The
library entered the check with **zero detected series**.

## The criteria

| Criterion | Result |
| --- | --- |
| card in `Manage Library`, copy exact | Renders as specified. Description carries **no trailing period**; the sub-option caption and all three `Info` paragraphs are verbatim (also diffed against 09 §9 programmatically before the build left the desk) ✅ |
| ON by default, not Pro-gated | No Pro gate on the path. The default itself was proven in **06's** run, where the column read `NULL` for the entire session and detection ran anyway ✅ |
| getter reads `!== false` | Unchanged from 06; the toggle now exercises both directions from the UI ✅ |
| sub-option: checkbox, default OFF, renders only when detection is on | Absent with the switch off, present with it on, unchecked by default ✅ |
| retroactive button runs and reports | `Created 23 series from 200 books.` — see below ✅ |
| button carries no count | No `(N)` on the label in any state ✅ |
| **OFF stops detection and leaves existing series untouched** | Full scan with detection off after the 23 existed: `detection is off — no series were read or written`, `detect 1ms`, and the shelf still reads **All (23)** ✅ |
| info dialog explains the feature | Three paragraphs, legible, scrollable ✅ |
| `Removed Series (N)` row present | Present, chevron, **no count while nothing is suppressed** — 0 rows today because 09 has not landed ✅ |
| **light theme** | Card renders correctly on white; nothing illegible, nothing white-on-white. Two notes below ✅ |
| tsc · eslint · jest | 0 · 0 errors · 42 suites / 469 tests ✅ |

## The retroactive run, both presses

    19:21:49  [series] detection (conservative): 351 units → 23 series, 200 books placed ·
              created 23 (200 rows) · inserted 0 · removed 0 · skipped 0 · 221ms
    19:22:43  [series] detection (conservative): 351 units → 23 series, 200 books placed ·
              created 0 (0 rows) · inserted 0 · removed 0 · skipped 0 · 174ms

- **First press → `Series Detected` / `Created 23 series from 200 books.`** The dialog and the
  log agree exactly, and **23/200 is byte-identical to 06's scan-driven measurement** and to
  04's seam measurement before it. The button reaches the same state a scan does — which is the
  whole claim of A9's "bridge for anyone whose toggle was off during the first scan".
- **Second press → `No New Series`.** It still *proposes* all 23 and writes **nothing**:
  reconcile recognising its own work rather than rebuilding it. This is the branch most easily
  written as a failure, and on the device it reads as designed behaviour.
- The 23 titles match 06's listing name-for-name, including the **edition split** (`Discworld`
  41 + `Discworld (2022)` 39, never an 80-book merge) and `Lockwood and Co.` at 4.
- The known scan-side book split logged itself rather than going silent: *"0 books sit under no
  configured root and 1 have no first chapter — all dropped before detection, out of 352."*

## Driver-requested extra: the sub-option, on the real library

Not an acceptance criterion — the driver asked for it after the criteria closed, and it is the
first time `Also group by folder name` has run against anything but the corpus.

    19:28:57  [series] detection (full): 351 units → 32 series, 247 books placed ·
              created 9 (47 rows) · inserted 0 · removed 0 · skipped 0 · 640ms

Dialog: **`Created 9 series from 47 books.`** — agreeing with the log, and the existing 23 were
**not touched** (`removed 0`, and every one of them logged `(existing)`).

**`+9 series` is exactly what A3's corpus table predicted (19 → 28).** The nine:

| Series | Books | |
| --- | --- | --- |
| Rivers of London | 16 | real |
| **Enders Game** | 7 | ⚠ **the predicted false positive, by name** |
| Drenai | 4 | real — **named in 09 §7 as a target of this option** |
| Formic Wars | 4 | real |
| The Science of Discworld | 4 | real, and correctly **not** merged into `Discworld` |
| Founders Trilogy | 3 | real — **named in 09 §7** |
| Gentlemen Bastards | 3 | real — **named in 09 §7** |
| Speaker Trilogy | 3 | real |
| The Hyperion Cantos | 3 | real |

Three things this establishes on real data rather than on the corpus:

- **All three series 09 §7 named as the justification for shipping the option appeared** —
  *Gentlemen Bastards*, *Founders Trilogy*, *Drenai*: real series whose folders are named
  correctly and whose tags say nothing.
- **The predicted wrong group is the same wrong group.** `Enders Game` sweeps 7 books from a
  folder that is not one series, while `Speaker Trilogy` and `Formic Wars` stand correctly
  apart. One bad group bought eight good ones — and it is precisely what the caption warns
  about, which is the argument for the caption's wording holding up in the field.
- **Folder evidence did not bleed across adjacent names**: `The Science of Discworld` stayed out
  of `Discworld`, on a library where `Discworld` is already the largest series.

**Consequence the driver was told before pressing, and it held:** these nine persist after the
box is unticked. Reconcile has no "everything not proposed is stale" step — which is what makes
it safe — so removing them is a hand-delete, and until [09](issues/09-delete-suppresses-and-restores.md)
lands that delete writes no suppression row.

## Light theme — the criterion, and what it actually found

The card is structurally correct on white: `overlay` card, dark title, `textMuted` description
and labels all legible, and the divider and chevron read properly. **Two notes, neither a defect
introduced by this ticket:**

1. **The accent is the lowest-contrast thing on the card in light theme** — the card icon, the
   `Detect Series in Existing Books` button and the new checkbox all wear it. This is **17's
   already-closed finding** (`primary` #FFB606 ≈ 1.9:1 on white) arriving on a new surface, and
   the button is **visually identical to `Apply to Existing Books` shipping six pixels above
   it**. The question this card raises is "does it make the existing condition worse", and it
   does not. The checkbox's accent *tint* was chosen for exactly this reason — see the ticket.
2. **`InfoDialogPopup` renders DARK in the light theme.** It paints from the static `colors`
   bag rather than theme tokens, so it is a dark box with light text for **all three callers**
   (timer, `Series Backgrounds`, `Series Detection`). Internally consistent and perfectly
   legible, but it is a dark dialog over a light app. **Pre-existing and shared — logged, not
   fixed here**, because changing it is a decision about three surfaces, not this one.

## A defect found and fixed during the check

**`InfoDialogPopup`'s message would not scroll reliably** — the driver reported it taking three
or four attempts. **Cause: touch-responder contention, not rendering.** The card was wrapped in
two nested `TouchableOpacity`s (the tap-outside-to-close backdrop). A touchable claims the
responder on touch-**start**, so the `ScrollView` added for the three-paragraph copy had to win
it back on **move**, which it did only sometimes. No `ScrollView` prop can fix that, because the
contention sits above the ScrollView.

**Fix: the backdrop became an absolutely-positioned sibling behind the card instead of its
parent.** It still catches every tap outside, the card sits above it in z-order, and nothing
competes for the gesture. **Driver-verified on device: scroll works on the first attempt, and
both dismiss paths — the `X` and tapping outside — still close correctly**, which was the part
most at risk from re-parenting the backdrop.

Worth keeping: this bug only existed because the ticket's own copy forced the ScrollView. The
clip it was fixing is real and was never visible before, because **every previous caller passed
one paragraph**.

## Left as found

Folder grouping was returned to its default (unchecked) and the device was returned to dark
mode. The library was left with the 23 detected series in place and detection toggled **off** —
the driver's own last action, not a test artifact.
