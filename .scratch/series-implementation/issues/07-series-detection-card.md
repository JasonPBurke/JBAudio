# 07 — The `Series Detection` card in `Manage Library`

**Blocked by:** [06](06-detection-runs-on-scan.md).

**Status:** ready-for-agent

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

- [ ] The card lives in `Manage Library` and copy ships **exactly** as ticket 09 §9 wrote
      it — the card description (no trailing period), the `Info` dialog's three paragraphs,
      and the sub-option caption above. **One sentence of the third paragraph is subject to
      an open driver decision handed over by [19](19-membership-survives-a-file-move.md) —
      see below. Settle it before shipping the copy, do not settle it by shipping.**
- [ ] `Enable Series Detection` is **ON by default and not Pro-gated.** Gating detection
      would invert the redesign for free users, and an empty Series tab reads as a broken
      feature rather than an upsell.
- [ ] **The getter reads `!== false`, fallback `true`** — at its own site, and it is the
      second such site (the first is [08](08-series-backgrounds-setting.md)). Getting it
      wrong is silent: the user sees a switch rendered OFF that they never turned off.
- [ ] `Also group by folder name` is a checkbox, **default OFF**, rendering **only when
      detection is on**. Ordinary `=== true` getter — it is default-OFF.
- [ ] `Detect Series in Existing Books` runs detection over the current library and
      reports what it created.
- [ ] **That button carries no count.** The naive figure ("books not in a series") is not a
      promise the way the auto-chapters count is — most books in a typical library are
      standalones that will never group.
- [ ] Turning detection **OFF stops future detection and leaves existing series untouched**,
      matching the `autoChapterInterval = null` precedent exactly.
- [ ] The info dialog explains in plain language what detection can and cannot do, so odd
      names and ungrouped books read as expected behaviour rather than bugs.
- [ ] The `Removed Series (N)` row is present; the list behind it is
      [09](09-delete-suppresses-and-restores.md).
- [ ] Light theme is checked. This surface **was never built and so was never tested** — it
      inherits correctness structurally (a settings screen paints no surface of its own),
      but that is an argument, not a test.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

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

## No bulk destroy — ever

**A14:** every bulk action on this card is **creative**. The app already ruled this once
(`Auto-Generate Chapters` is the two-surfaced precedent) and there is **no bulk destroy
anywhere in the codebase**. "Delete all detected series" does not ship, in any wording.
