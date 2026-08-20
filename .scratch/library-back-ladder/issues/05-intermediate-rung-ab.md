# 05 — Does the BooksHome intermediate rung earn its place on device?

Type: prototype
Status: resolved
Blocked by: 01
Parent: [map.md](../map.md)

## Question

**Build the ladder with and without the intermediate rung and decide which
ships.**

Charting decision 3 fixed the rung's predicate: it fires **only when the topmost
expanded section's header has scrolled above the viewport top** — i.e. the user
is genuinely inside that list, not already at its start. When no expanded
section's header is above the fold, the rung is **skipped** and back goes
straight to master-top. That predicate exists to kill the no-op case where back
would scroll almost nowhere and read as a dead press.

The driver's position: *"sounds good on paper, but may be frustrating on the
device."* So build both:

- **Variant A — 3 rungs:** section-top → master-top (collapsing) → background.
- **Variant B — 2 rungs:** master-top (collapsing) → background. Uniform with the
  other three views.

## The two arguments to weigh on device

**For the rung:** inside a 100+ book expanded author, the section header is
genuinely far away and no other gesture gets you there. It composes into a
coherent ladder — *start of this list* → *start of the library, tidied* → *leave*.

**Against it:** the feature exists because unlimited-open has no cheap inverse
(see the map's "Why this feature exists"). The intermediate rung puts an extra
press *in front of* the reset that is the whole point. It also delays reaching
the collapse sweep.

## Known technical risk, specific to this rung

This is the **only** rung that scrolls to a mid-list position, which means
`scrollToIndex` on the section header. Every other rung in the design is
`scrollToOffset(0)` — the call these lists are known-good at. The
`flashlist-2.3.2-mvcp-header-anchor` memory records a `scrollToIndex` pin as one
of the workarounds that **reintroduced the case-3 jump/flash**. If Variant A
reproduces that flash, that is evidence in the decision, not merely a bug to fix.

Also determine: after the rung fires and the user is at the section top, does a
further back press go to master-top — i.e. is the ladder strictly ordered, or
purely re-derived from position each press? (Charting decision 2 says derived,
so re-derivation should fall out naturally; confirm it does.)

## Investigation notes (interim, 2026-08-18 — NOT a resolution)

Source-only pass against `@shopify/flash-list@2.3.2`. **The decision itself is still
open**: it is a UX judgement and needs the driver on device. What changed is the
*shape* of the question — the ticket's stated technical risk largely dissolves, and
one charting ambiguity must be settled before either variant can be built.

### N1 — The rung does NOT need `scrollToIndex`. The stated risk is avoidable.

`scrollToIndex` in 2.3.2 is **not** a thin wrapper like `scrollToOffset`
(`hooks/useRecyclerViewController.tsx:320–500`). It:

- sets `pauseOffsetCorrection.current = true` and `setOffsetProjectionEnabled(false)`;
- walks the tracker's offset through **5 synthetic steps** via
  `updateScrollOffsetWithCallback`, forcing a render commit per step — so
  `getAbsoluteLastScrollOffset()` reports a **commanded, fabricated** offset for the
  whole operation (ticket 03's predicate reads exactly that accessor);
- for `animated`, **instant-jumps** to `startScrollOffset` (target ± ~2 viewport
  heights) and animates only the last leg;
- re-enables correction on a `setTimeout` of **300 ms** (animated) / 200 ms.

All of that machinery exists to reach an index the list has **never measured**. The
rung scrolls *backwards* to a header the user already scrolled past, whose layout is
already measured and persisted (`isHeightMeasured`, `layout-managers/LayoutManager.ts:245`).

So the rung is a plain, known-good `scrollToOffset`:

```ts
const y = list.getLayout(headerIndex)?.y;          // ref -> tryGetLayout, never throws
if (y !== undefined) list.scrollToOffset({ offset: y + list.getFirstItemOffset(), animated });
```

`getLayout` is spacer-relative and `scrollToOffset` defaults to `skipFirstItemOffset:
true` (raw), hence the `+ getFirstItemOffset()`. **Consistency check:** at
`headerIndex === 0`, `getLayout(0).y === 0`, so the target is exactly
`firstItemOffset` — ticket 03's at-top boundary. The rung degenerates into master-top
precisely when the topmost expanded section is the first one.

This also inherits ticket 04's F3 for free: an animated `scrollToOffset` fires
`onMomentumScrollEnd` itself, at a non-top offset, where the at-top guard makes the
sweep a no-op. No new arrival machinery.

**Consequence for the decision:** the memory's rejected `scrollToIndex` pin was
rejected in a *different* configuration — a pin racing MVCP's correction across a
**data mutation**. The rung mutates nothing. The "Variant A reintroduces the case-3
flash" argument does not transfer, and should not be weighed against Variant A unless
a device build actually shows it.

### N2 — Masonry full-span headers make "section top" exact (and validate ticket 02)

BooksHome is `masonry` + `optimizeItemArrangement`, so `getLayout(index).y` is **not**
monotonic in index — items are placed into the shortest column. But
`overrideItemLayout` gives every non-`book` item `span = maxColumns`
(`BooksHome.tsx:260–272`), and for a full-span item
`placeOptimizedMultiColumnItem` (`layout-managers/MasonryLayoutManager.ts:247–286`)
degenerates: the candidate loop runs once at `startCol = 0`, `layout.y = max(all
columnHeights)`, and **all columns are levelled** to `maxHeight + height`.

**A section header is therefore a hard barrier**: everything before it in index order
is strictly above it in y, everything after starts at or below its bottom. Masonry
reordering is confined *within* a section. So section index ranges map cleanly onto
contiguous y bands — which is what ticket 02's `sectionRangesRef` design already
assumed, now confirmed rather than hoped.

### N3 — Charting decision 3's "topmost" is ambiguous, and one reading is self-defeating

"the **topmost** expanded section's HEADER is above the viewport top — i.e. you are
genuinely inside that list" admits two readings:

- **(i) nearest** — the expanded section *containing the viewport top*; back goes to
  the top of the section you are in.
- **(ii) earliest** — the first expanded section in the list.

**(ii) is self-defeating.** Recents is `flatData[0]` on every non-empty BooksHome
(ticket 04 F5). Whenever Recents is expanded, reading (ii) targets index 0, i.e.
offset `firstItemOffset` — *identical to master-top*. The rung becomes a guaranteed
dead press, which is the exact failure decision 3 was written to prevent.

**Reading (i) is the one to build**, and it matches the ticket's own framing ("start
of this list"). Worth stating explicitly in the spec — it is not a redefinition, it is
disambiguation.

### N4 — Express the predicate in offsets, not indices

Ticket 02 proposed the signed test `range.start < visible.startIndex`. That is an
index *proxy* for decision 3's literal statement, and it has a sub-pixel dead-press
failure: land at `header.y = 1234.5`, the real offset settles at 1235, `startIndex`
becomes `headerIndex + 1`, and the next press re-fires the rung for a ~0.5 px scroll.

The literal statement is already an offset comparison:

```ts
const target = list.getLayout(headerIndex)!.y + list.getFirstItemOffset();
if (currentOffset - target > EPS) { /* fire the rung */ }
```

Same semantics, no `computeVisibleIndices()` call, immune to the boundary. (The sweep
still needs `computeVisibleIndices()` — this only replaces the *rung's* predicate.)

### N5 — Re-derivation confirmed structurally (the ticket's second question)

Charting decision 2 predicted the ladder falls out of position with no ordering state.
It does. After the rung lands, offset `== header.y + firstItemOffset >
firstItemOffset`, so the ladder is still armed; and the rung's own predicate is now
false (the header is at the fold, not above it), so the next press goes to master-top.
No counter, no sequence. Under N4's epsilon form this holds without a boundary case.

### Still open — what a device owes this ticket

The technical arm is clear; **the UX arm is untouched**. Variant A vs B is the
driver's call on device, and the arguments in the Question section stand unchanged.
The next session should build the throwaway prototype (both variants behind one
runtime toggle) and hand it to the driver.

⚠ Keep the jump style (animated/instant) **out** of this prototype's decision
surface — ticket 06 is `claimed` by a concurrent session and owns it. Pin it to
animated (charting decision 8) as a single constant.

## Prototype built (2026-08-18) — awaiting the driver's device judgement

**Branch `proto/back-ladder-rung-ab`, commit `fecac6c`.** Throwaway, off `main`.
tsc 0, eslint 0, jest 843/843 (baseline unchanged).

JS-only, so **`npx expo start` + a Metro reload is enough — no native rebuild.**

### How to run the A/B

1. Check out the branch, reload Metro, open the library on the **Books** view.
2. A coloured chip sits bottom-left above the floating player:
   **green `A · 3-rung`** / **red `B · 2-rung`**. Tap it to flip variants live —
   no reload, no rebuild, so both arms can be compared in the same sitting on the
   same scroll position.
3. Expand a large author section, scroll deep inside it, then press back.

| | Variant A | Variant B |
|---|---|---|
| 1st back, deep inside an expanded section | scrolls to that **section's header** | scrolls to **master-top**, collapsing |
| 2nd back | master-top, collapsing | backgrounds the app |
| 3rd back | backgrounds the app | — |

Back while already at the top backgrounds the app in both variants.

### The question to answer while holding it

Not "does it work" — that part is mechanical. **Does the extra press in front of
the reset annoy you?** The feature exists because unlimited-open has no cheap
inverse; variant A puts a rung in front of that inverse. Weigh that against
variant A's payoff, which is only felt inside a genuinely long section.

Worth deliberately testing the *skip* path: with the viewport top inside a
**collapsed** section, or already at a section's header, variant A should behave
exactly like variant B (no dead press). If it ever scrolls a few pixels and
stops, that is the failure decision 3 was written to prevent — say so.

### What the build resolves for free

Watch for these while you have it in hand; they cost nothing extra to observe:

- **No case-3 flash is expected.** Per note N1 the rung is a plain
  `scrollToOffset`, not the `scrollToIndex` pin that was rejected in
  `flashlist-2.3.2-mvcp-header-anchor`. If a flash appears anyway, that is a
  genuine finding against variant A and the ticket's stated risk was real after all.
- **Ladder re-derivation** (the ticket's second question): after the rung lands,
  the next press should go to master-top with no ordering state anywhere.
- The animated jump firing the sweep on arrival (ticket 04 F3) is visible here
  too, but **ticket 06 owns the jump style** — don't let motion quality
  contaminate the rung judgement.

### N6 — new finding: React Compiler freezes prop refs (hands ticket 09 a constraint)

Ticket 02's seam has `BooksHome` writing its section ranges **into a
screen-owned ref passed down as a prop**. That shape does not compile here:
React Compiler treats props as frozen, so `sectionRangesRef.current = ranges`
is an eslint error (`react-compiler/react-compiler`) even inside a `useEffect`.

The prototype hands the ranges **up through a callback** instead
(`onSectionRangesChange`), and the screen stores them in its own ref. Ownership
and direction are unchanged — only the transport differs.

**→ Ticket 09** should specify the list contract as a callback, not a ref prop.
The `listRef` prop is unaffected: passing a ref *down* for the child to attach
is fine; it is only *writing* to a prop ref that is rejected.

### Scope note

Only **BooksHome** is wired. It is the only view with expandable sections, so it
is the only view that can answer this ticket, and leaving the other three alone
keeps the throwaway diff small. Back on SeriesHome/BooksGrid is unchanged
(backgrounds the app as today) — that is a prototype limitation, not a proposal.

## Update — ticket 06's arm folded into the same build (2026-08-18)

The driver asked whether ticket 06's animated/instant switch could share this
prototype. It now does, on a **second, independent** chip
(`06 · animated` / `06 · instant`, above the variant chip). One build serves both
tickets; see the coordination note appended to ticket 06.

**Judge one axis at a time, in this order:**

1. **Ticket 05 first, jump style left on `animated`** (charting decision 8's
   preference). Flip A/B and decide whether the rung earns its place.
2. **Then ticket 06**, variant left wherever step 1 landed. Flip
   animated/instant and judge the motion.

Doing both at once makes a 2x2 and invites attributing motion dissatisfaction to
the rung. If a *combination* turns out to matter — e.g. the rung reads well
animated and badly instant — that is itself a finding, but record it as one rather
than discovering it by accident.

**Only ticket 05's answer belongs in this file.** Ticket 06 is claimed by another
session; report that arm's findings to it through the driver, not by resolving it here.

## Answer

**Resolved 2026-08-18** (driver device test on a **preview build**, real library).

### Headline

**Variant A ships — the 3-rung ladder. The intermediate rung earns its place.**

Driver's verdict after running both arms on device: *"the 3-rung is the clear
winner."* The map's charting decision 3 stands as written, under note N3's
**nearest** reading (the expanded section *containing the viewport top*).

The "against" argument in the Question section — that the rung puts an extra press
in front of the reset that is the whole point of the feature — did not survive
contact with the device. It reads as a coherent ladder, not as an obstacle.

The ticket's **stated technical risk did not materialise**: no case-3 jump/flash.
Note N1 predicted this, because the rung is a plain `scrollToOffset` to an
already-measured header, not the `scrollToIndex` pin that was rejected in
`flashlist-2.3.2-mvcp-header-anchor`. That memory's rejection was a pin racing
MVCP across a **data mutation**; the rung mutates nothing, so it never applied.

### The landing offset — a real defect, found on device, fixed here

**Symptom:** after the rung fires, the section header is **hidden behind the
dropped-down search bar**.

**Cause: arithmetic in the prototype, not a design fork.** The rung landed at
`y_h + firstItemOffset`, which aligns the header to the **viewport** top. The
search bar is an absolute overlay occupying exactly that strip.

**The correct landing offset is plain `y_h`** — no conversion term:

```
at raw offset S, item i's top sits at screen position (y_i + firstItemOffset) - S
want the header at screen position firstItemOffset  =>  S = y_h
```

`firstItemOffset` is the room the `ListHeaderComponent` spacer reserves for the
search bar — **38 for BooksHome, and `SEARCH_BAR_HEIGHT` is also 38**. So landing
at `y_h` puts the section header exactly where item 0 sits at master-top: clear of
the bar, in the same visual slot the user already knows.

**Self-consistency check, and why this is the right rule rather than a nudge:** at
`h = 0`, `y = 0`, so `S = 0` — master-top's own landing spot. The rung and the
master-top rung become the same call at the boundary. (This also retracts the
"consistency check" in note N1, which asserted `h = 0` should yield
`firstItemOffset`. That assertion *was* the bug, stated confidently.)

Fixed on the branch; **re-confirm on the next build** (DT-13 on ticket 11).

### Why not "keep the search bar hidden during auto-scrolls"

The driver offered this as the alternative. Rejected, for two reasons:

1. **It only defers the occlusion.** The bar is shown by `useScrollDirection` on
   *any* upward delta. Land the rung, nudge the list up a few pixels, and the bar
   drops over the header again. The corrected landing offset is durable;
   suppression is not.
2. **It reintroduces coupling ticket 02 F5 deliberately avoided.** `useScrollDirection`
   has exactly one call site and the ladder currently adds no scroll handler to it.
   Making the ladder own chrome visibility during a jump gives it a second job and
   a new failure mode (a suppressed bar that fails to come back).

With the landing offset correct, the occlusion is unreachable, so this needs no
separate ticket and no setting.

### Re-derivation confirmed (the ticket's second question)

The ladder is **purely re-derived from position each press**, as charting decision
2 predicted — no ordering state exists anywhere in the implementation. After the
rung lands, the header is at the fold rather than above it, so the rung's own
predicate is false and the next press goes to master-top. Note N4's offset-based
predicate is what makes this hold without a sub-pixel boundary case.

### Handoffs

- **→ Ticket 10 (the spec).** Carry the landing formula **verbatim**: the rung
  scrolls to `getLayout(headerIndex).y`, *not* `y + firstItemOffset`. It is the
  one number on this map that a reasonable implementer would get wrong in the
  obvious direction — and did. Also record N3 (the *nearest* reading of
  "topmost") as disambiguation, since the *earliest* reading makes the rung a
  dead press whenever Recents is expanded.
- **→ Ticket 09 (four views sharing).** Confirms the rung is BooksHome-only in
  effect: the other three views have no sections, so `sectionTopAboveFold`
  returns `null` and the ladder collapses to 2 rungs with no per-view branching.
  Plus note N6's constraint (ranges travel up via callback; React Compiler
  freezes prop refs).
- **→ Ticket 11.** DT-13 added: confirm the corrected landing clears the search bar.
- **Ticket 06 is untouched by this result.** The driver judged the rung with the
  jump style pinned to animated, as instructed. That arm remains that session's.
