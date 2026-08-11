# Device check — ticket 20, the picker's author grid

**2026-08-11 · physical device (Pixel 7 Pro, `29131FDH3009SZ`, 1440×3120, density 560)**
Build: the working tree at the time of the check (uncommitted).

**Result: PASS.** All three device criteria closed, including the font-scale-2.0 leg §E14
carried as an open risk.

## Evidence

| shot | what it shows |
| --- | --- |
| `tk20-01-authors-grid-1x.png` | the grid, dark, `font_scale 1.0` |
| `tk20-02-books-step-staged.png` | books step, two books staged |
| `tk20-03-ordered-list-committed.png` | panel closed, ordered list on the editor |
| `tk20-04-reopen-authors-cleared.png` | `+ Add books` reopen — authors cleared, draft kept |
| `tk20-05-x-keeps-the-series.png` | `X` dismisses the panel, series intact |
| `tk20-06-authors-grid-light.png` | the grid, light, three selected |
| `tk20-07-authors-grid-displaysize-720.png` | Display Size 560→720 (see the trap below) |
| `tk20-08-authors-grid-fs2.png` | **`font_scale 2.0`**, light |

## The grid itself (§E14)

Two columns, 13px names, ~50dp pitch, 14px corner check — all as specified. Selection reads
three ways at a glance: primary border, 12% tint, corner check.

**Density measured: ~21 authors per screen** at 1×, against §E14's predicted ~18–20 and the
single column's 7–8. Slightly ahead of the prototype's figure, which is the larger screen.

**The corner check measures 2.51:1** fill-vs-glyph in the driver's real light theme
(teal `#4898B8`, knockout `#D8E4EC`), consistent with ticket 07's 2.82:1 for the same
construct at a different accent. **The fill + knockout ruling holds and was not re-swapped.**

## Font scale 2.0 — the carried risk, now closed

The cells **grow taller** and the two columns hold. Names truncate at line 2 with a clean
ellipsis (`Jim Butcher, Kerrie Hugh…`, `John Kennedy To…`) — no mid-token cut, no horizontal
overflow, no collision between text and the corner check.

**No fix was needed.** The mitigation ticket 20 nominated — let the cell grow rather than
drop to one column — is what the layout already does, because `minHeight: 42` is a floor
and the content is centered rather than fixed-height. Density falls to ~10 authors per
screen, still ahead of a single column at the same scale.

⚠ **`paddingRight: 20` on the cell is load-bearing at 2×.** It is the corner check's berth;
without it a two-line name at 26px runs under the glyph. Do not "tidy" the asymmetric
padding.

## Trap worth recording: Display Size is NOT font scale

The first attempt at this criterion changed **Display Size** (`wm density` override
560→720), not font size — `settings get system font_scale` still read `1.0`. The screen
looks convincingly "scaled up" either way, so the shot is easy to accept as the wrong
evidence. **Verify with `adb shell settings get system font_scale` before believing a
font-scale screenshot**; `wm density` reports the other lever, and the two stress different
things (density scales chrome *and* type together, which is the gentler case).

`tk20-07` is kept as the Display Size result — it also passes — but it is not the criterion.

## Not covered, and why it is acceptable

**Dark theme at font scale 2.0.** Both themes were verified at 1× and the 2× leg was run in
light. The grid's geometry carries no theme-conditional sizing — themes supply colours
only — so the 2× result transfers. Recorded rather than claimed as tested.

## Unrelated defect seen and NOT chased

The footer's **disabled `Next` renders as an unlabelled pale box** (visible in `tk20-04`).
The driver confirmed on sight that this is **already known and owned by a later ticket**. It
is in `seriesEditor.tsx`'s footer, which ticket 20 does not touch, and it predates this work.

## False alarm, resolved — read before re-investigating

A mid-check screenshot showed the name field empty and the authors cleared, which looked
like the draft being reset by `+ Add books`. **It was not a defect:** the first series had
been saved, and that surface was a *fresh* draft created from the series screen's `+`
button, not a reopen. Confirmed by the driver and corroborated by the list header being
genuinely empty. The real reopen (`tk20-04`) keeps the name and the books and clears only
the author filter, which is `clearAuthors()` behaving as §E9 specifies.
