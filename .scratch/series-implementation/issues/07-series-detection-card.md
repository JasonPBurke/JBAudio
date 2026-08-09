# 07 — The `Series Detection` card in `Manage Library`

**Blocked by:** [06](06-detection-runs-on-scan.md).

**Status:** resolved — **all eleven acceptance criteria met, and the copy decision is RULED (see
`## The ruling`), 2026-08-08.** Desk work and the **device run** are both complete (uncommitted
on `feature/series-styling`). `tsc` 0 · eslint 0 errors · jest **42 suites / 469 tests green**.
Device record: [`../DEVICE-CHECK-07.md`](../DEVICE-CHECK-07.md) — physical Pixel 7 Pro, the
driver's real 3,461-file library, **`Created 23 series from 200 books.` matching 06's scan
byte-for-byte**, `No New Series` on the second press, and 23 series surviving a full scan with
detection off. **One defect was found and fixed mid-check — see the two `InfoDialogPopup` sections at the end.**
**[09](09-delete-suppresses-and-restores.md) is now unblocked.**

**Spec:** [§A3, A9, A14, B10](../../series-ux-redesign/spec.md), §K1, §K2.

## What to build

The one place a user governs detection, and the one place the app makes its promise in
plain language. It sits in `Manage Library`, because these are decisions about *what the
library is*, not about how it looks.

```
+- Series Detection ------------------ (i) -+
| Automatically group books into series     |
| using their tags and folder names         |
|                                           |
| Enable Series Detection          [ ON ]   |
|                                           |
| [ ] Also group by folder name             |
|     Finds series that have no series      |
|     tags, using folder names. May         |
|     occasionally group a folder that      |
|     isn't a series.                       |
|                                           |
| [ Detect Series in Existing Books ]       |
|                                           |
| Removed Series (3)                     >  |
+-------------------------------------------+
```

Closes user stories 5–11.

## Acceptance criteria

- [x] The card lives in `Manage Library` and copy ships **exactly** as ticket 09 §9 wrote
      it — the card description (no trailing period), the `Info` dialog's three paragraphs,
      and the sub-option caption above. **One sentence of the third paragraph is subject to
      an open driver decision handed over by [19](19-membership-survives-a-file-move.md) —
      see below. Settle it before shipping the copy, do not settle it by shipping.**
      → **RULED BEFORE THE COPY SHIPPED**, see `## The ruling`. All three strings are module
      constants in `library.tsx`, so the shipped copy is one grep from its source.
- [x] `Enable Series Detection` is **ON by default and not Pro-gated.** Gating detection
      would invert the redesign for free users, and an empty Series tab reads as a broken
      feature rather than an upsell. → No `useRequiresPro` call anywhere on this card's path.
- [x] **The getter reads `!== false`, fallback `true`** — at its own site, and it is the
      second such site (the first is [08](08-series-backgrounds-setting.md)). Getting it
      wrong is silent: the user sees a switch rendered OFF that they never turned off.
      → Shipped by [06](06-detection-runs-on-scan.md) and covered by
      `seriesDetectionSettings.test.ts`. **07 adds the same default a THIRD time**, in the
      screen's `useState` seed — that is what renders for the frame before the fetch
      resolves, so `useState(false)` would show the switch OFF exactly as `=== true` would.
- [x] `Also group by folder name` is a checkbox, **default OFF**, rendering **only when
      detection is on**. Ordinary `=== true` getter — it is default-OFF.
- [x] `Detect Series in Existing Books` runs detection over the current library and
      reports what it created. → `runSeriesDetection()` → `summarizeDetectionRun()`.
      **The wording wants a real library behind it — device.**
- [x] **That button carries no count.** The naive figure ("books not in a series") is not a
      promise the way the auto-chapters count is — most books in a typical library are
      standalones that will never group.
- [x] Turning detection **OFF stops future detection and leaves existing series untouched**,
      matching the `autoChapterInterval = null` precedent exactly. → The setter writes one
      boolean and nothing else, and `runSeriesDetection` returns before its first read.
      **Observable only on device.**
- [x] The info dialog explains in plain language what detection can and cannot do, so odd
      names and ungrouped books read as expected behaviour rather than bugs.
- [x] The `Removed Series (N)` row is present; the list behind it is
      [09](09-delete-suppresses-and-restores.md). → Present, counting **distinct** suppressed
      names; **deliberately not pressable — 09 owns the route.** See `## What was built`.
- [x] Light theme is checked. This surface **was never built and so was never tested** — it
      inherits correctness structurally (a settings screen paints no surface of its own),
      but that is an argument, not a test. → **CHECKED ON DEVICE**, and the argument held:
      nothing illegible, nothing white-on-white. Two notes in
      [`../DEVICE-CHECK-07.md`](../DEVICE-CHECK-07.md), neither introduced here — 17's
      already-closed accent finding arriving on a new surface (the button is visually
      identical to `Apply to Existing Books` six pixels above it), and `InfoDialogPopup`
      painting **dark in both themes** for all three of its callers.
- [x] `tsc` 0 errors · eslint 0 errors · jest green. → **42 suites / 469 tests green**,
      including 10 new ones over the run-report copy.

## Do not rebuild what exists

**K2:** the compact settings row needs both `description` **and** `onInfoPress`, because
its control slot is taken by the switch. **Both props are already built and shipped**
(optional, so every existing call site is untouched), and the timer screen's `How it works`
row is already retired as their first call site. Use them.

## Two rulings that look like omissions

- **The sub-option caption stays generic on purpose.** The real rule turns on
  *contradiction versus absence*, which is not sayable in a caption, and every short
  approximation misdescribes at least one real case.
- **Deliberately unmentioned in the copy:** that two recordings of one series stay
  separate. It is internal machinery the user cannot act on, and naming it invites doubt
  about a case that is already handled.

## One copy decision, handed to this ticket by [19](19-membership-survives-a-file-move.md)

Added at 19's triage, 2026-08-08. **This ticket owns the card, so this ticket owns the
sentence — 19 changes no behaviour and deliberately did not decide it.**

The `Info` dialog's third paragraph, verbatim from 09 §9:

> Your changes are never overwritten. Renamed series, books you've added or removed,
> custom ordering and hand-made series are all left alone when your library is scanned
> again.

19's ruling is that a **file move** destroys exactly those four things: the driver ruled that
moving or renaming a book's folder ends its series membership, and that moving or renaming the
library root deletes every hand-made series outright — name, order and all — with a
user-edited detected series regenerating fresh, its custom name and numbers gone and any book
the user had removed back in.

So the sentence is **true for every scan of a library whose files have not moved** — which is
what it was written to promise, and is the case that matters — and **false in the one scenario
where the files did move**. The tester who hits it is the tester who just tidied their folders,
which is also the tester most likely to remember reading it.

**The decision is the driver's, and it is a genuine trade, not an oversight to be corrected:**

- **Leave it.** The paragraph is about what *detection* does to your work, and a user who
  renames their library root is not surprised that the app treats the contents as new. Adding
  a caveat costs plain-language confidence in the one place the app makes its promise, in
  exchange for covering a scenario the copy was never about.
- **Qualify it.** One added clause or sentence in the app's own voice, e.g. *"If you move or
  rename your book files, the app sees new books — a hand-made series won't follow them."*
  Honest, and it is the only place the boundary would ever reach a user, since 19 declined an
  in-app warning. Costs a fourth paragraph's worth of doubt on a card already carrying three.

Whichever way it goes, record it here — the ruling, not just the resulting string — and amend
09 §9 and `spec.md` **in place** if the wording changes, per this effort's amendment rule. Two
wordings of one promise in two documents is worse than either wording.

### The ruling

**Driver's decision, 2026-08-08: LEAVE IT.** The third paragraph ships exactly as 09 §9 wrote
it, with **no file-move caveat and no fourth paragraph**.

The reasoning, so it is not re-litigated: the paragraph is about what **detection** does to your
work, and that is what it is true about. A user who moves or renames their library root is not
surprised that the app treats the contents as new — the surprise the paragraph exists to prevent
is the *scanner* undoing an edit the user made, which never happens. Buying the file-move case
costs plain-language confidence in the one place the app makes its promise, on a card already
carrying three paragraphs, in exchange for covering a scenario the copy was never about and that
19 already ruled is **intended behaviour** rather than a defect.

**Consequences:** the wording does not change, so **09 §9 and `spec.md` need no amendment** —
they already hold the shipped string, and there is still exactly one wording of the promise in
the repo. The ruling is recorded here (it was 07's to make) and in a comment above
`SERIES_DETECTION_INFO` in `src/app/(settings)/library.tsx`, so an engineer who notices the gap
finds the decision instead of "fixing" it.

**19 needs nothing from this.** It changed no behaviour and deliberately did not decide the
sentence; the decision landing here is the handover completing, not a reopening.

## No bulk destroy — ever

**A14:** every bulk action on this card is **creative**. The app already ruled this once
(`Auto-Generate Chapters` is the two-surfaced precedent) and there is **no bulk destroy
anywhere in the codebase**. "Delete all detected series" does not ship, in any wording.

---

## What was built

Five files, all on `feature/series-styling`, uncommitted.

| File | What |
| --- | --- |
| `src/db/settingsQueries.ts` | `setSeriesDetectionEnabled` · `setSeriesFolderGroupingEnabled`. Both are one-line `updateSetting` writes beside the getters 06 shipped, so the pair of opposite defaults stays readable in one screenful. |
| `src/helpers/seriesDetectionSummary.ts` | **New.** `summarizeDetectionRun(result)` → `{title, message}` — the only new *logic* on this ticket. |
| `src/helpers/__tests__/seriesDetectionSummary.test.ts` | **New.** 10 tests over the five outcomes. |
| `src/app/(settings)/library.tsx` | The card, and §F10's glyph split (below). |
| `src/modals/InfoDialogPopup.tsx` | A **scroll ceiling** on the message. Found by this ticket's own copy — see below. |

**The card's shape, and the two things it decides that the mock does not say:**

- **The `Info` icon rides the `Enable Series Detection` row, not the card header.** K2's
  `onInfoPress` is exactly the prop for a row whose control slot is taken by a switch, and 08's
  `Series Backgrounds` row is the shipped precedent for the arrangement. The mock's header `(i)`
  is ASCII shorthand for "the long copy hangs off this card". **`description` is deliberately
  NOT also set on the row** — the card already prints that exact string above it, and setting
  both prints it twice.
- **The checkbox AND the retroactive button both render only while detection is ON.** The
  sub-option was specified that way; the button follows for a harder reason —
  `runSeriesDetection` returns `reason: 'disabled'` before its first read, so a button visible
  while the toggle is off is a button that looks broken rather than one that looks disabled.
  (`summarizeDetectionRun` still answers for `'disabled'`: the run guards on its own state, and
  the report answers for the state rather than trusting a caller.)

**The checkbox's checked state is an accent TINT with an accent glyph — not the author picker's
solid accent fill with the glyph knocked out.** That precedent cannot be copied here and the
reason is worth keeping: its knockout colour is `themeColors.background`, which is **dark ink on
the accent in the dark theme and near-white ink on it in the light one** (~1.8:1 on the default
amber). The accent is user-settable, so **no fixed ink colour is derivable** — the same shape as
17's pillar finding. Reusing this screen's own `withOpacity(primary, 0.1)` idiom means the
checkbox asks the question the two buttons beside it already ask (**accent on card**) instead of
adding a second one (**ink on accent**). ⚠ **The author picker still has the original
arrangement**; it is out of this ticket's scope but is now a known light-theme item.

**`Removed Series` renders always, but its count does not.** `(0)` reads as a broken feature, so
the label is bare when nothing is suppressed and `Removed Series (N)` when something is. The row
itself never hides: A12 rejected the delete-dialog checkbox because **a modifier asking for
foresight fails exactly when foresight is absent**, and an entry point that only appears once you
already need it fails the same way. The count is over **distinct** names (`normalizeSortName`,
the same key series identity uses) because G7 leaves the table without a unique constraint, so a
double-delete could otherwise print `(2)` over a list of one.

**§F10's glyph split shipped here, and this screen is why it exists.** `Layers` was doing double
duty as the library's Series-view toggle and the auto-chapters glyph; `titleDetails` already
moved auto-chapters to `TableOfContents`. Without the same move here, `Series Detection` and
`Auto-Generate Chapters` would sit **adjacent on one screen wearing the same icon** — the exact
collision 14 found. Series keeps `Layers`; the auto-chapters card and its `Apply to Existing
Books` button now carry `TableOfContents`.

**What is NOT here, on purpose:** the `Removed Series` list and this row's `onPress`
([09](09-delete-suppresses-and-restores.md) owns both, and nothing writes a suppression row until
09 lands, so the count is 0 on every device today). A chevron that goes nowhere beats a ripple
that goes nowhere, so the row is not pressable rather than pressable-and-inert.

## What the device closed

**2026-08-08, physical Pixel 7 Pro, the driver's real 3,461-file library, dev build.** Full
record and raw logs: [`../DEVICE-CHECK-07.md`](../DEVICE-CHECK-07.md). **All three device
criteria closed in one session**, and the driver added a fourth run of their own.

The starting state was better than planned: the driver scanned the whole library **with
detection toggled off** before the check began, which separates the two halves of A9's OFF
ruling and gives the retroactive button a library it has provably never touched.

| Criterion | Result |
| --- | --- |
| light theme | Card correct on white — nothing illegible, nothing white-on-white. The accent is the lowest-contrast element (17's closed finding), and the button is **visually identical to `Apply to Existing Books` six pixels above it**, so this card does not make the existing condition worse ✅ |
| retroactive report | **`Created 23 series from 200 books.`** — byte-identical to 06's scan-driven number and 04's seam number before it. Second press: **`No New Series`**, still proposing all 23 and writing `created 0`. Dialog agreed with the log both times ✅ |
| OFF leaves series alone | Full scan with detection off, after the 23 existed: `detection is off — no series were read or written`, `detect 1ms`, shelf still reads **All (23)** ✅ |

**The strongest single result is that the button and the scan agree.** 23 series / 200 books is
the same figure three independent paths have now produced, so `Detect Series in Existing Books`
really is the bridge A9 describes rather than a second, slightly different detector.

**Driver-requested extra — the sub-option on real data, and the corpus predicted it exactly.**
`Also group by folder name` produced `created 9 (47 rows)`, and **+9 series is precisely A3's
corpus figure (19 → 28)**. All three series 09 §7 named as this option's justification appeared
(*Gentlemen Bastards*, *Founders Trilogy*, *Drenai*), and so did **the predicted false positive,
by name**: `Enders Game`, 7 books from a folder that is not one series. One bad group bought
eight good ones, which is the caption's warning holding up in the field. `The Science of
Discworld` correctly stayed **out** of `Discworld`. Full table in the device record.

## A defect this ticket's own copy uncovered

**`InfoDialogPopup` had no scroll view.** It is a fixed 80%-width box that simply grows with its
message, and **every caller until now passed one paragraph**. 09 §9's mandated copy is three —
~131 words, ≈27 lines, ≈650dp of text — which fits a phone at 1× with little room and **clips
silently above ~1.2× font scale**: no scrollbar, no cut edge, just a missing third paragraph on
the one screen whose job is explaining what detection can and cannot do. Left alone it would
have failed the info-dialog criterion on exactly the users who most need the copy.

Fixed with a **ceiling, not a fixed height** — `maxHeight: 60%` of the window on a `ScrollView`
around the message. Content shorter than that is laid out exactly as before, so
[08](08-series-backgrounds-setting.md)'s `Series Backgrounds` dialog and the timer screen's two
are **pixel-identical**; only copy that would have been invisible gains a scroll. The scroll view
is `alignSelf: 'stretch'`, because `modalView` centres its children and a shrink-to-content
scroll view would have re-wrapped the text.

It is the same shape as the app's two open font-scale clipping defects (the library search field
and `titleDetails`' info card: a fixed-height container holding scaling text). Unlike those, it
is fixed rather than logged — it was **created by this ticket's own requirement**, not found
beside it.

## …and the defect that fix uncovered, found on device

**`InfoDialogPopup`'s message would not scroll reliably** — three or four attempts before it
moved. Reported by the driver the moment the card was first opened on real hardware.

**The cause was touch-responder contention, not rendering.** The card was wrapped in two nested
`TouchableOpacity`s (the tap-outside-to-close backdrop). A touchable claims the responder on
touch-**start**, so the `ScrollView` this ticket added had to win it back on **move** — which it
did only sometimes. **No `ScrollView` prop can fix that**, because the contention sits above the
ScrollView; reaching for `nestedScrollEnabled` would have been the expensive wrong turn.

**Fix: the backdrop is now an absolutely-positioned sibling behind the card, not its parent.**
It still catches every tap outside, the card sits above it in z-order, and nothing competes for
the gesture. **Driver-verified: scrolls on the first attempt, and BOTH dismiss paths — the `X`
and tapping outside — still close correctly**, which was the part most at risk from re-parenting
a backdrop.

Worth keeping, because it generalises: **this bug could only exist once the dialog had something
to scroll.** The clip was real and invisible for the same reason the jank was — every caller
before this one passed a single paragraph, so neither the ScrollView nor the contention it
exposed had ever been needed.
