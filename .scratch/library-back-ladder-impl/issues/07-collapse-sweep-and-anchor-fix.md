# 07 — The collapse sweep on arrival, and the MVCP anchor fix

**What to build:** The reset gesture — the point of the whole feature. When the list arrives at the
top, every expanded section that is not on screen collapses. The list you come back to is compact,
and you did not have to hunt down a single header.

Whatever is on screen at the moment of arrival stays exactly as it is; nothing jumps or reflows
under the reader's eyes. In practice that means an expanded Recently Added section fills the
viewport and is left open — the app does not close the thing you are looking at — and the reader
closes it with one tap on a header already on screen. That is the accepted consequence of "keep
what's at the top", and both alternatives were rejected on the same ground: each collapses a
section at or above the fold, which is the configuration of a known blank-screen defect.

The sweep runs **strictly after the list has settled at the top. Never before the jump, never
during it.** The two rejected orderings are not "less good", they are structurally unsafe on this
list: mutating while scrolled moves the anchor, so the list issues a corrective scroll and sets an
ignore-scroll-events flag for 100 ms, freezing the render stack for roughly the first 40% of the
jump.

⚠ **The trap that makes this more than a preference:** the visible-range accessor is a pure
function of the last **observed** scroll offset, so sampling it synchronously after issuing a
scroll returns the **pre-jump viewport**. "Collapse before the jump" and "collapse right after
issuing the jump" are the same bug with two entrances, and the second is what the obvious code does
by accident. The rule that prevents it is that the sweep only ever runs on an event that **proves**
the list is at the top.

The animated jump needs **zero arrival machinery** — an animated programmatic scroll emits
momentum-scroll-end by itself, and that event is already the sweep's first trigger. This is the
reverse of the usual "instant is simpler" intuition.

This ticket also carries the **one-line anchor fix**: call the list's layout-animation-render
preparation immediately before the sweep's state update. The sweep runs on the *native* momentum
end, while the list re-anchors on its own 100 ms scroll-idle debounce that every scroll event
during the jump keeps resetting — so at the instant the sweep mutates the data, the anchor is still
a pre-jump item deep in the list, and the correction moves the list off the top. Proven to the
pixel: the correction's `diff` equalled the resting drift exactly in all three reproductions.
Device A/B: fix off, 4 of 6 jumps drifted; fix on, 0 of 20.

⚠ **That line must carry the comment explaining why.** To a reader who does not know about the
anchor race it looks like a no-op, and it is exactly the kind of line a future cleanup deletes.
Copy it and its comment across from the prototype.

Spec: E2–E5, F1–F9, G1–G8, I2, I5; user stories 4, 5, 6, 7, 14, 15, 27, 32.

**Blocked by:** 03 (the sweep decision), 06.

## ⚠ Testing changed under this ticket — read before starting

Hooks and components are **now testable**. Jest runs two projects: pure TypeScript stays in the
fast `helpers` lane, and anything importing React Native goes in an `rn` lane
(`jest-expo/android` + `@testing-library/react-native`) by being named `*.rn.test.tsx`.
**Read `docs/testing/jest-projects-and-rn-tests.md` first** — it holds seven traps that all fail
quietly.

Landed by `spike/rn-jest-testing` (`544ac8a`); merge that branch before starting if it has not
already landed. When this ticket was written, none of this existed and its acceptance criteria
assumed `tsc` plus a manual device check were the only tools available.

## ⚠ Handoff from ticket 06 — the hook's parameter names

§J1 writes the hook's signature as `{ listRef, view, sectionRangesRef, activeGridSections,
setActiveGridSections }`. Ticket 06 named that parameter **`expanded`**, not `activeGridSections`,
and you should keep it — then add the setter as **`setExpanded`**, not `setActiveGridSections`.

The reason is §H1's own pattern, one level along: the screen maps its state to the ladder's
vocabulary **at the mount site** (`ladderViewFor` does exactly this for the view), so the ladder
never learns a name that belongs to one view's UI. `activeGridSections` is the books view's word
for it; `expanded` is what the decision's snapshot field is called, and the hook exists to fill that
snapshot. Passing `expanded` beside `setActiveGridSections` would be the worst of both.

Raised as a spec-amendment candidate (§J1's parameter names) — see ticket 06's Answer. Recorded
here because this file is the one its implementer is guaranteed to read.

**Status:** ready-for-agent

- [ ] Arriving at the top of the sectioned view collapses every expanded section that is not on
      screen, and leaves on-screen sections open.
- [ ] ⚠ **This ticket WIRES `decideSweep` UP; it does not re-derive the gates.** Ticket 03 already
      built all five — view identity, at-top, velocity, the lazy sample, and the degenerate /
      empty-overlap bail-out — as a pure function with 20 tests and 16 killed mutations. The
      checklist items below describe behaviour you must *end up with*, not logic to write here.
      Re-implementing any gate inline puts it back in the untestable layer, which is exactly what
      spec §J4 rejected. The hook is **gather → decide → execute**.
- [ ] Three triggers funnel into one function: momentum-scroll-end, and drag-end gated on velocity.
      The back jump needs **no** wiring of its own — it is covered by momentum-end.
- [ ] ⚠ **Pass the REAL `trigger` for each event.** `trigger` is what selects the velocity gate, so
      passing `'drag'` for a momentum event silently disables the sweep on any list reporting
      residual velocity. That mutation kills 12 tests — but only if the hook is actually exercised,
      so the suite is not a substitute for getting this right at the call site.
- [ ] ⚠ **`visible` must be a THUNK over `computeVisibleIndices()`, never a pre-computed value.**
      Same requirement ticket 02 flagged for the rung, and here it is F2 rather than B7 that it
      protects: an eagerly-sampled viewport is *plausible data*, not an error, so nothing downstream
      can detect it. Evaluating it eagerly is the "collapse right after issuing the jump" bug — the
      second entrance named in the trap above.
- [ ] Pass the drag event's **actual** `velocityY` through. An unreported velocity counts as
      **flinging** by design (spec §F5, amended 2026-08-21), so dropping the value on the floor
      does not fail loudly — it silently stops the drag trigger from ever sweeping.
- [ ] The result's `open` is safe to hand **straight** to the expanded-section setter. It is the
      **same reference** as the input whenever nothing drops, which is what makes every accepted
      bounce-sweep free rather than a re-render of a 355-book list. Do not copy, spread or re-wrap
      it — that discards the React bail-out ticket 01's two same-reference tests exist to pin.
- [ ] `decideSweep` takes a **non-null** snapshot, unlike `decideBackPress`. There is no "no list"
      case: a settle event cannot fire without a mounted list.
- [ ] Mount and the tab-change scroll reset are explicitly **not** triggers. Arriving at the top
      *is* the collapse gesture; a tab change is not that gesture, and a tab change must reset
      scroll without collapsing anything.
- [ ] The velocity gate is present and its direction matters: at the top, a fling that scrolls
      **down into the list** is at-top at finger-lift, so the at-top guard alone would collapse
      everything as the user flings away. Only the gate excludes it.
- [ ] An overscroll bounce at the top **does** sweep, and that is accepted — the outcome is
      identical to a back press, and the sweep can only touch below-fold sections. *(If it annoys
      on device, the reversible lever is to add a drag-begin handler to the contract and require
      the drag to have begun below the top. Do not build that pre-emptively.)*
- [ ] Visibility is read from the list's ref at the moment the sweep runs and compared by index
      overlap. **The viewability plumbing is deleted** — no viewable-items callback, no viewability
      config. The swap is behaviour-preserving, which is worth knowing before deleting working
      code: the visible-range bounds count any sliver as visible, which is exactly the semantics
      the old percent threshold was chosen for.
- [ ] The sweep is **idempotent**, and it fires **at least once** per arrival — do not assert
      exactly-once. When back interrupts an in-flight fling, momentum-end fires twice.
- [ ] Touching the screen mid-jump stops the scroll and does nothing else: the fling animator
      dispatches momentum-end on cancel too, at a non-top offset, where the at-top guard makes it a
      no-op.
- [ ] The non-sectioned views never collapse anything, and a scroll in one view can never silently
      change another.
- [ ] The anchor-fix call is in place, immediately before the sweep's state update, **with its
      comment**. No timer, no constant, no new state.
- [ ] The reset still happens with system animations turned off: at animator scale 0 the jump takes
      0 ms, the animator's end callback still fires, so momentum-end still emits and the sweep
      still runs.
- [ ] The sweep only ever runs at the top, so it can only ever collapse **below-fold** sections.
      Any change that lets it run at another offset re-opens the blank-screen defect.
- [ ] `npm test`, tsc and eslint are green.
- [ ] **The sweep wiring has an `rn`-lane suite.** This ticket already names a bug the pure suite
      cannot catch on its own — *"passing `'drag'` for a momentum event silently disables the sweep
      ... that mutation kills 12 tests, but only if the hook is exercised."* Exercising the hook is
      now possible, so **close that gap here**: assert that the momentum handler reaches
      `decideSweep` with `trigger: 'momentum'`, and the drag handler with `'drag'` **and the event's
      real `velocityY`**. Both bugs are otherwise invisible until a device session.
- [ ] **Assert the same-reference pass-through.** When the sweep drops nothing, the set handed to
      the state setter must be the **same reference** it came in as. A spread or re-wrap anywhere in
      the wiring discards React's bail-out silently, and the pure suite cannot see the hook's
      plumbing. ⚠ Do **not** assert render counts to check this — the React Compiler runs in tests
      and makes those numbers unreliable. Assert reference identity directly.
