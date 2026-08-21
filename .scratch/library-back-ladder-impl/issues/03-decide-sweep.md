# 03 — `decideSweep`, the collapse sweep's judgement

**What to build:** The ladder's judgement about *whether, and what, to collapse* — again a pure
function over the same snapshot, tested off-device. Nothing calls it yet. When this ticket is done
every gate that device work proved load-bearing is pinned by a test, including the two that exist
solely to keep known hazards closed.

The signature (spec §J4):

```ts
decideSweep(s: LadderSnapshot, trigger: 'momentum' | 'drag', velocityY?: number)
  -> { kind: 'none'; reason: 'not-sectioned' | 'not-at-top' | 'flinging' | 'no-visible-sample' }
   | { kind: 'collapse'; open: Set<string> };
```

Two exports rather than one, deliberately: a **wrong landing** and a **wrong collapse** are
different failures with different owners, and folding them into one return type would put
assertions about scroll offsets next to assertions about collapse behaviour.

`decideSweep` calls the restored collapse helper and leaves its contract alone. The degenerate-sample
bail-out belongs **here**, where the knowledge is.

⚠ One trap to know before starting. Ticket 12 of the closed map offered "make the helper iterate
`visible` instead of `open`" as a fix for the collapse-everything hazard. **It does not work** —
both iteration orders compute the same intersection, and with `visible` empty both yield an empty
set. What closes the hazard is the **bail-out**, not the loop. An implementer who "fixes" the
iteration order will believe the hazard is closed and it will not be.

Spec: F1–F9, H2, H3, I2, I5, J4; Testing Decisions › `decideSweep` — the cases; Risks R5; user story 35.

**Blocked by:** 01 (the collapse helper and its suite), 02 (the shared types).

**Status:** ready-for-agent

- [ ] The capability gate comes from **view identity**, never inferred from the expanded set being
      non-empty — that set persists across view toggles, so data cannot answer this question.
- [ ] Not-sectioned view with stale non-empty `ranges` and a non-empty `expanded` returns
      `none('not-sectioned')`. **This is the R5 regression test:** ungated, this exact input wipes
      the user's expansions from another view while they are looking at a different screen.
- [ ] Not at the top returns `none('not-at-top')`.
- [ ] Drag trigger with `velocityY = -4.76` at `offset 0` returns `none('flinging')` — the
      device-measured fling-away-from-the-top case that the at-top guard alone does not exclude.
- [ ] Drag trigger with `velocityY = 0` at the top returns `collapse` — the accepted overscroll
      bounce.
- [ ] A degenerate visible sample (`startIndex < 0`) returns `none('no-visible-sample')`.
- [ ] **Empty overlap with non-empty ranges** returns `none('no-visible-sample')`. This is the
      other regression test: without it, this input is a collapse-**everything**, because the
      helper iterates the open set rather than the visible one.
- [ ] Recents survives **by position**, not by exemption: at the top with Recently Added visible
      and three author sections expanded below the fold, the returned set contains only the
      Recently Added id. There is no protected-section parameter in play.
- [ ] Nothing to collapse, and an empty `expanded` set, both return the **same set reference** as
      the input so React bails out of the re-render.
- [ ] **Idempotence:** feeding a collapse result straight back in returns the same reference and
      collapses nothing. This is the property that makes a double momentum-end harmless.
- [ ] Overlap counts **any sliver**: a section whose `end` equals `startIndex`, and one whose
      `start` equals `endIndex`, are both visible.
- [ ] `npm test`, tsc and eslint are green.
