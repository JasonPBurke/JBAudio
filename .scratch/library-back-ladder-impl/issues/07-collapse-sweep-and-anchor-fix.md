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

**Status:** ready-for-agent

- [ ] Arriving at the top of the sectioned view collapses every expanded section that is not on
      screen, and leaves on-screen sections open.
- [ ] Three triggers funnel into one function: momentum-scroll-end, and drag-end gated on velocity.
      The back jump needs **no** wiring of its own — it is covered by momentum-end.
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
