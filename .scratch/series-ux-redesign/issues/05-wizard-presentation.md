# 05 — Wizard presentation: overlay or full-screen push?

Type: prototype
Status: open
Blocked by: (none)
Claim released: 2026-07-31 — worked in one session, decision deferred by the
driver. Back on the frontier. The build work is DONE and recorded below; only the
replace-vs-cover decision remains, so resuming costs a look at the device and an
answer, not a rebuild.

**Open sub-question:** sheet presentation + 0.95 detent is settled; the
**animation direction** (`slide_from_bottom` vs `slide_from_right`) is not.
Parent: [map.md](../map.md)

## Question

The driver reports the wizard is usable and its flow makes sense, but that
**"something is jarring when going from the series/booksHome screen to the
wizard."** Is that because the wizard breaks the app's own navigation language —
and does fixing it also cure the clipped-row bug?

## The finding this ticket tests

`src/app/_layout.tsx` presents every focused flow as an **overlay**:

| Screen | Presentation |
| --- | --- |
| `player` | `formSheet`, slide from bottom, `sheetCornerRadius: 15` |
| `titleDetails` | `formSheet`, slide from bottom, `sheetCornerRadius: 15` |
| `coverArtSearch` | `transparentModal`, fade |
| `editTitleDetails` | `transparentModal`, fade, dimmed backdrop |
| `chapterList` | `transparentModal`, fade |
| `footprintList` | `transparentModal`, fade |
| `(settings)` | `slide_from_left` |
| **`series`** (line 288) | **opaque full-screen push, `slide_from_right`** |

The wizard is the **only** flow in the app that fully replaces the library. Every
other one keeps context visible behind it. That is a concrete, testable
explanation for "jarring" that has nothing to do with the wizard's internal
styling — and it would explain why the driver finds the wizard fine in isolation
but the *transition* wrong.

## The second, larger prize

A full-screen push is exactly what makes `react-native-screens` **detach** the
screen underneath. The clipped-row investigation established that the bug
"reproduces on insert (0→1 AND N→N+1) *while the screen is detached behind a
pushed native-stack route*", and that a view switch (remount) repairs it. Five
hypotheses were refuted; the untested next angle was named as
`freezeOnBlur` / `detachPreviousScreen` on the series stack.

**A `formSheet` presentation keeps the library attached.** If that removes the
clipping, the `listKey` remount workaround in `SeriesHome.tsx:81` — which costs a
scroll-position reset on every insert, delete and reorder — can be deleted
outright.

This is why the ticket is cheap and early: the presentation change is
approximately one line, and it tests a UX hypothesis and a bug hypothesis at once.

## Acceptance

1. Try the wizard as `formSheet` (matching `titleDetails`) and as
   `transparentModal`. Judge the transition against `titleDetails` and `player`,
   which are the app's established feel.
2. A multi-step stack inside a sheet needs checking specifically: does the
   3-step push still work, does native/gesture back still map to "previous step",
   and does the sheet's own dismiss gesture conflict with it?
3. **Independently** verify the clipped-row effect: with the remount workaround
   (`listKey`) temporarily disabled, create a series and see whether rows still
   clip.
4. Note any regression in the `beforeRemove` draft-discard behaviour — that was
   hard-won and depends on navigation lifecycle, which a presentation change can
   disturb.

## Out of scope here

Redesigning the wizard's *steps* — that is fog, pending the review-and-correction
surface, which may absorb part of the wizard's job.

## Findings — 2026-07-31 device session (`emulator-5554`, Pixel_7_Pro)

Screenshots in the session scratchpad under `shots/`.

### 1. `formSheet` works on Android — with one trap

`react-native-screens` 4.23.0 has Android sheet support. All three wizard steps
render and navigate **inside** the sheet; hardware back correctly maps to
"previous step"; the draft survives a back navigation (verified: the series name
persisted and re-appended).

**The trap:** copying `titleDetails`/`player`'s options verbatim — including
`sheetShouldOverflowTopInset: true` — produces a **full-height** sheet that is
visually indistinguishable from the opaque push. The first attempt looked like
nothing had changed. What makes it read as an overlay is a detent below 1:

```ts
sheetAllowedDetents: [0.92],   // library header + tab bar stay visible above
sheetGrabberVisible: true,
```

With that, the library's header and tab bar remain on screen above the rounded
sheet edge, and the wizard reads as an overlay in the app's established language.

### 2. Clipped-row hypothesis — **REFUTED**

Add as **hypothesis #6** to the refuted list in [[series-feature]]:

> *A `formSheet` presentation keeps the underlying screen attached, removing the
> clipped-row precondition.* **Refuted.** With the `listKey` remount workaround
> disabled, creating a new series through the sheet produced a row clipped to
> roughly a quarter height with a reserved empty gap below it, while the existing
> Dresden row rendered fully. Cycling library views repaired it — the exact
> signature of the known bug.

**Where the reasoning went wrong:** the library being *painted* behind the sheet
was taken as proof it was *attached and committing*. It is not the same thing —
`react-native-screens` can keep a view in the hierarchy while React freezes the
subtree, so the insert still commits against a frozen screen. Visible ≠ live.

This makes the untested angle already named in memory the strongest remaining
lead, now with one more variant eliminated: **`freezeOnBlur` /
`detachPreviousScreen` on the screen being covered** (the `(drawer)` route, not
the `series` route). Not pursued here — the clipped-row bug is out of scope on
this map.

### 3. Incidental defects observed (not this ticket's job)

- **Inactive Next/Save buttons render with an invisible label** — a light
  `themeColors.divider` rectangle with muted text on it, no readable text at all.
  The active state is gold with a clear label. This is the styling-pass §7 change
  (drop `disabled`, keep inactive styling) with a contrast failure.
- The wizard has **no app header** and a large dead vertical region below the
  content on every step.
- The book picker shows **"Discworld 04 - Mort" and "Mort (#4)" with nothing to
  tell them apart** — no narrator, no edition. Live evidence for
  [06](06-series-identity-edition.md).
- `FloatingPlayer` shows the Mistborn book as **"Mistborn 6 (Michael Kramer)"** —
  the `album` tag used as a title, so the real title *The Bands of Mourning*
  never appears. Live evidence for [01](01-signal-inventory.md).

### 4. `formSheet` **ignores the `animation` prop** on Android

Recorded the sheet twice — once with `animation: 'slide_from_bottom'`, once with
`'slide_from_right'` — and the two transitions are indistinguishable.
`react-native-screens` drives sheets with its own bottom-anchored animator.

*Evidence class: direct A/B on device, **not** source-verified. If certainty
matters, read the rn-screens Android sheet implementation before relying on it.*

**Consequence: direction and presentation are not independent choices.** There is
no "sheet that slides from the right". Picking the direction *is* picking the
presentation, which reframes the open decision below.

### 5. Push vs sheet, frame by frame

`assets/05-wizard-presentation/compare-push-vs-sheet.png` — top row (red) is the
original push, bottom row (green) the sheet.

| | What moves | Seam | Library | Header |
| --- | --- | --- | --- | --- |
| **Push** | **Two** surfaces in opposite directions — library exits left as the wizard enters right | Hard **vertical** edge sweeping mid-screen | Evicted | Leaves with it |
| **Sheet** | **One** surface — only the sheet | Soft **horizontal** edge rising from below | Stationary, stays visible | Persists throughout |

The real question is therefore **replace vs cover**, not bottom vs right.

## Assets

`assets/05-wizard-presentation/`

- `compare-push-vs-sheet.png` — the decisive side-by-side
- `anim_push.mp4`, `anim_bottom.mp4` — raw screen recordings
- `baseline-push-fullscreen.png` — the original push, for reference
- `sheet-0.95-detent.png` — the sheet at the chosen detent
- `clipped-row-still-reproduces.png` / `clipped-row-repaired-by-viewswitch.png` —
  the hypothesis-6 refutation

## Branch state — REVERTED 2026-07-31

**No code from this ticket remains on the branch.** `src/app/_layout.tsx` and
`SeriesHome.tsx` are both byte-identical to `HEAD`; the wizard is back to the
original opaque push (`{ animation: 'slide_from_right' }`). The experiment was
deliberately reverted rather than left in place, so the branch does not carry an
undecided change.

To re-apply the sheet for another look, replace the `series` screen's `options`
with:

```ts
presentation: 'formSheet',
animation: 'slide_from_bottom',   // inert under formSheet — see §4
sheetCornerRadius: 15,
sheetAllowedDetents: [0.95],
sheetGrabberVisible: true,
contentStyle: { backgroundColor: themeColors.background },
```

Then do a **full JS reload** — navigator `screenOptions` do not apply via fast
refresh. Verify the app actually came up (`pidof`) before driving the UI.

Note the emulator may still be running the sheet build until it is reloaded, so
it can disagree with the source until then.

## Answer

_(unresolved — the driver deferred the decision on 2026-07-31)_

### What is settled

- The sheet is technically viable: all three wizard steps render and navigate
  inside it, hardware back maps to "previous step", the draft survives.
- `sheetShouldOverflowTopInset: true` must **not** be copied from
  `titleDetails` — it makes the sheet full-height and indistinguishable from the
  push.
- `animation` is inert under `formSheet` (§4).
- The clipped-row bug is **not** fixed by this (§2). The `listKey` workaround stays.

### The one open question

**Should entering the wizard replace the library (push) or cover it (sheet)?**
Candidates, in the order they were considered:

1. **Sheet at 0.95** — matches every other focused flow in the app; the driver
   picked 0.95 over 0.92 on-device, but *before* learning the direction and
   presentation are coupled, so re-confirm rather than assume.
2. **Push** — full-screen room, strongest "you have left the library" signal, but
   remains the app's only screen that behaves this way.
3. **Sheet with other detents** — 0.85 / 0.90 / `fitToContents` unrecorded.
4. **`transparentModal`** — fade over a dimmed library, as `editTitleDetails` and
   `chapterList` do. Keeps context, and being a non-sheet it can animate freely.
   **Not yet built.**

### Emulator caveat for the next session

The driver changes the series set between sessions (a "Bobobiverse" series
appeared mid-session; a junk "Discworld ProtoDiscworld Proto" from the clipped-row
test was left in place deliberately). **Do not assume any particular series exist**
— re-check before scripting taps.
