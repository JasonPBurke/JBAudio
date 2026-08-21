# Library Back Ladder — Wayfinder Map

Label: `wayfinder:map`
Effort: `library-back-ladder`
Charted: 2026-08-18
Branch: **`proto/back-ladder-rung-ab`** — the throwaway prototype build (tickets
05/06, instrumented for 11). Level with `main` on code; behind only on `.scratch/`.
⚠ **Findings are recorded on `main`, in `.scratch/library-back-ladder/`** — the
branch's copy of these docs is stale and dies with the branch.
(The older `fix/collapse-offscreen-lists-onMomentumScrollEnd` is superseded.)
Driver: Jason Burke

## Destination — REACHED 2026-08-20

**[`spec.md`](spec.md) is written and labelled `ready-for-agent`.** All 12 tickets are
resolved. The only thing still outstanding is the driver's read of the document as a
whole; the spec's header records that, and amendments are edits to that file in place.

A **driver-approved `spec.md`** for a back-press ladder on the library screen:
a back gesture/button press while scrolled down scrolls the list to the top
(collapsing expanded sections on arrival), and the next press backgrounds the
app.

Covers all four library list views, the BooksHome intermediate rung, the
collapse sweep, and the Android back-interception mechanism this app has never
used before.

**Implementation is a separate effort** — this map produces decisions, not
shipped UI. Prototypes built here are throwaway.

## Notes

**Domain.** Android audiobook player (Sonicbooks/JBAudio). Expo Router + Drawer;
the library screen `src/app/(drawer)/(library)/index.tsx` is the drawer root and
hosts the list views by `toggleView`: `0` BooksHome, `1` SeriesHome, `2`
BooksGrid. `BooksList` is **dead code today but in scope** — it may replace
`BooksGrid`, or join it as a 4th toggle. Design for both futures.

**Skills every session should consult:** `/grilling` and `/domain-modeling` for
decisions; `/prototype` for the device variants; `/research` for the AFK
research tickets.

**Memory topics to read before touching this area** (in
`~/.claude/projects/-home-jason-Development-JBAudio/memory/`):
`android-back-latch-rn083`, `collapse-offscreen-sections-flicker`,
`flashlist-2.3.2-mvcp-header-anchor`.

### Why this feature exists

Not tidiness. **Unlimited-open has no cheap inverse.** BooksHome deliberately
allows any number of expanded sections at once (to dodge the FlashList v2
"case 3" jump/flash — see `flashlist-2.3.2-mvcp-header-anchor`). The cost is
that re-compacting the list means hunting down every header you opened and
tapping each one, scrolling the whole way. **Scroll-to-top-collapses-all is the
missing reset gesture.** Every decision on this map should be judged against
that purpose.

### Charting decisions (settled during the charting grill, 2026-08-18)

These are settled inputs, not tickets. They came out of the charting session and
the map is built on them.

| # | Decision |
|---|---|
| 1 | **Four views in scope**, including the currently-dead `BooksList`. |
| 2 | **The rung predicate is derived from live scroll offset, armed at any offset > 0.** No counter, no timer, no timeout. Self-healing by construction. |
| 3 | **The BooksHome intermediate rung fires only when the topmost expanded section's HEADER is above the viewport top** — i.e. you are genuinely inside that list. Otherwise it is skipped and back goes straight to master-top. A **no-intermediate-rung variant is built for comparison**; "sounds good on paper, may be frustrating on device". |
| 4 | **The collapse sweep fires on any USER-DRIVEN arrival at the top** — momentum-scroll-end, velocity-gated drag-end, and the back jump. **Not** on mount, **not** on the `useResetScrollOnTabChange` reset. Arriving at the top *is* the collapse gesture; a tab change is not that gesture. |
| 5 | **Library screen only.** Everywhere else back keeps its current meaning. The library screen is the only place where back already means "background the app", so this intercepts a press no navigator wants. |
| 6 | **No toast, no haptic.** The visible jump is the feedback. The "press back again to exit" convention exists for apps where the first press does nothing visible. |
| 7 | **Scroll position is the only rung.** Search query, selected tab and view toggle are untouched by back. The drawer and the soft keyboard already consume back upstream. |
| 8 | **Animated is the preference; an instant variant is built** to weigh style against long-list cost. |

### Evidence carried in, not assumption

- **The parked flicker is an OPEN QUESTION, not a blocker.** Driver tested a
  build from `fix/collapse-offscreen-lists-onMomentumScrollEnd` on 2026-08-18:
  off-screen collapse showed **no flicker**, and collapsing a section *above*
  the view was "almost flawless". The FastImage-fade attribution recorded in
  `collapse-offscreen-sections-flicker` is a **lead, not a finding** — reassess
  with fresh eyes during the work. That branch may have been closer to correct
  than was realised.
- **New defect, observed 2026-08-18:** collapsing a **100+ book** expanded
  section while it is *in or above* the viewport **blanks the screen** until a
  scroll forces re-render. Does **not** occur when that section is below the
  view.
- **Structural consequence worth asserting as an invariant:** at offset 0,
  "not visible" and "below the fold" are the *same set* — nothing is above the
  fold when you are at the top. So a sweep that only ever fires at the top can
  only ever collapse below-fold sections, which is the case measured as clean.
  The blank-screen case is unreachable **by construction** — provided the
  visible set is sampled *after* the list settles (ticket 04).

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [01 — How does this app intercept a back press, on RN 0.83 + Android 16?](issues/01-back-interception-mechanism.md)
  — **Implementable as specified on RN 0.83.2; no native patch, no SDK 56 upgrade.**
  Use `BackHandler.addEventListener('hardwareBackPress', …)` inside React Navigation's
  `useFocusEffect`. The RN 0.83 latch **cannot** be re-exposed by consume/decline
  interleaving (enabled state is path-independent — the consume path never reaches
  `invokeDefaultOnBackPressed`, and the decline path stops at `MainActivity`'s
  `moveTaskToBack(false)`). The back-to-home **peek animation never plays on this app**,
  so a consumed press cannot flash a "leaving" animation. Gesture and button converge on
  one event. Six risks handed to tickets 02/03/06 and the spec; five device tests
  carried into [11](issues/11-android16-device-tests.md). Evidence:
  [research/01-back-interception-mechanism.md](research/01-back-interception-mechanism.md).

- [02 — Where does the ladder live, and how does it survive `toggleView`?](issues/02-where-the-ladder-lives.md)
  — **One screen-installed hook, `useBackToTopLadder`, called in `LibraryScreen`.**
  The screen owns all ladder state and the lists receive refs as props — no
  `useImperativeHandle` anywhere, matching the pattern `onScroll`/`activeGridSections`
  already establish. One shared `listRef` for all four lists; the hook mirrors **every**
  input into refs internally, so RISK 1's empty-dep mandate is guaranteed by the module
  rather than by call-site discipline. It owns the `useDrawerStatus()` guard itself, and
  owns the collapse sweep (returning `onMomentumScrollEnd`/`onScrollEndDrag`) so charting
  decision 4's rule is implemented once. ⚠ **Revises ticket 01's RISK 2:** FlashList 2.3.2's
  ref answers offset and visibility **synchronously**
  (`getAbsoluteLastScrollOffset`, `computeVisibleIndices`, `scrollToTop`), so the ladder
  **tracks nothing** — which deletes a real staleness bug (F2). The one thing the ref cannot
  answer is the `sectionId → index range` map, which `BooksHome` writes into a screen-owned
  ref. Five findings (F1–F5) and handoffs to 03/04/09/11 in the ticket.

- [03 — What exactly is "at the top", given the spacer header and MVCP?](issues/03-define-at-the-top.md)
  — **`getAbsoluteLastScrollOffset() > getFirstItemOffset()`, both read from the mounted
  list's ref at press time.** The spacer ambiguity **does not exist**: the accessor
  reconstructs the raw `contentOffset.y`, so the resting offset at visual top is **`0` on
  all four views**, and `scrollToTop()` lands on that same zero. But a literal `> 0` cannot
  ship — on an **empty list** `applyInitialScrollAdjustment` never runs, so the accessor
  returns `firstItemOffset` (38–50) **permanently** while visually at the top, which would
  arm the ladder on every no-results search and stop back from ever backgrounding the app.
  `getFirstItemOffset()` excludes that (and a mount-window twin) **by construction**, needs
  no constant, and self-adjusts per view (**38 / 44 / 38 / 50**) where a fixed epsilon would
  silently under-cover `BooksList`. It is not a fudge factor: it is the offset at which item
  0's top meets the viewport top, so the predicate reads as "is any list item above the
  fold". The at-top test for the sweep is its exact complement — one comparison, no gap.
  **MVCP cannot perturb the resting offset at the top** (anchor is index 0, `diff === 0`),
  answering the ticket's second bullet structurally. Five findings (F1–F5), incl. the two
  **inverted doc comments** in `RecyclerViewManager.ts` and MVCP's **100 ms
  `ignoreScrollEvents` blind window** — which hands ticket 04 a mechanical argument for
  sampling *after* the list settles. Handoffs to 04/08/09 and DT-8/DT-9 on 11.

- [04 — Collapse before, during, or after the scroll settles — and does Recents survive?](issues/04-collapse-scroll-sequencing.md)
  — **Collapse strictly AFTER the list settles at the top; never before, never during.
  Recents is not exempt — it survives by position.** The proposed A/B has no second arm:
  option 2 freezes FlashList's render stack for **100 ms mid-animation** (mutating while
  scrolled moves MVCP's anchor → `scrollBy` + `ignoreScrollEvents`, which short-circuits the
  **whole** scroll handler, so engaged indices and `setRenderId` stall), and it collapses a
  section **at the fold** — ticket 08's exact configuration. ⚠ **The trap:**
  `computeVisibleIndices()` is a pure function of the last *observed* offset, so sampling it
  synchronously after `scrollToOffset` returns the **pre-jump** viewport — option 2 is what
  the obvious code does by accident. ⚠ **`scrollToOffset({animated:true})` fires
  `onMomentumScrollEnd` itself** (`smoothScrollTo` → `startFlingAnimator` →
  `dispatchMomentumEndOnAnimationEnd`, which also fires on *cancel*), so the animated back
  jump needs **zero** arrival machinery and interruption is free — while the instant variant
  needs a one-shot flag. That reverses ticket 06's simplicity intuition, and 06 also loses
  pre-collapse as a smear mitigation. Driver ruling: **"keep what's at the top"**; verified
  that `flatData[0]` is the Recents header on every non-empty BooksHome (`sortBooksByRecency`
  orders without filtering). **Invariant for the spec:** the sweep fires only at
  `offset <= firstItemOffset`, where nothing is above the fold — so it can only ever collapse
  below-fold sections, making ticket 08's defect unreachable by construction. Seven findings
  (F1–F7), incl. the resumed branch's viewability plumbing being **redundant, not just
  superseded**, and its "sweep anywhere" trigger needing to **narrow** to "sweep at the top".
  Handoffs to 06/08/09/10 and DT-10/11/12 on 11.

- [06 — Animated or instant jump?](issues/06-animated-vs-instant.md)
  — **ANIMATED, confirmed on device; the instant arm is rejected.** Driver device-tested the
  combined 05/06 prototype as a **preview build** on `proto/back-ladder-rung-ab` against a real
  library: animated is the clear winner. Charting decision 8 is now evidence, not preference.
  The **smear did not decide it**, so the **two-stage jump** fallback and the
  **distance-dependent rule** are both unneeded and unbuilt. ⚠ **This DELETES machinery rather
  than adding it:** the back handler becomes `scrollToOffset({offset: 0, animated: true}); return true;`
  and nothing else (ticket 04 F3 — the animated scroll emits `onMomentumScrollEnd` itself, already
  the sweep's trigger #1), and the one-shot `pendingSweepRef` is **removed from the design** — it
  existed only because `animated: false` emits no momentum events. Traced this session:
  the jump is a platform `ObjectAnimator` (`ReactScrollView.java:100`), so **the OS animator scale
  governs reduced motion for free** — at scale 0 the jump is 0 ms yet `onAnimationEnd` still fires,
  so the sweep still runs. The ladder therefore **must not consult `ReducedMotionConfig`**, which is
  Reanimated's and has no path to the scroll view. Verdict measured on `BooksHome` only;
  generality handed to [09](issues/09-four-views-sharing.md), two confirmations to
  [11](issues/11-android16-device-tests.md).

- [05 — Does the BooksHome intermediate rung earn its place on device?](issues/05-intermediate-rung-ab.md)
  — **Yes. Variant A ships — the 3-rung ladder**, driver-verified on a preview build
  against a real library: *"the 3-rung is the clear winner."* The "extra press in front
  of the reset" argument did not survive the device. The ticket's stated technical risk
  **did not materialise** — no case-3 flash, because the rung is a plain `scrollToOffset`
  to an **already-measured** header, not the `scrollToIndex` pin that memory rejected
  (that pin raced MVCP across a *data mutation*; the rung mutates nothing). ⚠ **The one
  number to get right:** the rung lands on `getLayout(headerIndex).y` — **not**
  `y + firstItemOffset`, which aligns the header to the *viewport* top and parks it
  **under the search bar** (found on device). Landing at plain `y` puts it where item 0
  sits at master-top, and degenerates to master-top exactly at `h = 0`. Also settles
  three things the map needed: charting decision 3's "topmost" means the **nearest**
  expanded section containing the viewport top (the *earliest* reading makes the rung a
  dead press whenever Recents is expanded); the rung predicate is an **offset**
  comparison, not an index one; and the ladder is **purely re-derived from position**,
  with no ordering state anywhere. ⚠ **N6 for ticket 09:** React Compiler freezes props,
  so the list cannot write into a prop ref — section ranges travel up via callback.
  Prototype: branch `proto/back-ladder-rung-ab`.

- [07 — Reassess the parked flicker with fresh eyes](issues/07-reassess-the-flicker.md)
  — **Not a defect. Card reload after auto-collapse is small/expected, confirmed on the
  real candidate mechanism.** Driver tested the combined 05/06 prototype
  (`proto/back-ladder-rung-ab`) — ticket 04's actual sweep, not just the old parked
  branch — and judged the reload minor. The old `FastImage.transition.fade` mechanism
  is still almost certainly the cause, but its severity was overstated in the parked
  memory, not its root cause. Combined with ticket 04's structural invariant (sweep
  only ever collapses below-fold sections), this closes the risk-section question:
  goes in as a known, acceptable cosmetic. Memory topic
  `collapse-offscreen-sections-flicker` corrected.

- [08 — Blank screen when a 100+ book section collapses at or above the fold](issues/08-blank-screen-large-section.md)
  — **Unreachable by construction, confirmed.** Driver confirms the blank only ever
  followed **auto-collapsing an above-fold section** — a different action from merely
  scrolling past one while it's above the fold. This feature's sweep (ticket 04) never
  does that: it only ever collapses below-fold sections. Also reconciles ticket 07's
  "almost flawless" above-fold read — that never exercised an above-section
  auto-collapse, so it was never positioned to hit this bug. Full characterization
  (size/`numColumns`/masonry dependence) is undone and out of this map's scope — it's
  a pre-existing main-branch defect, recorded separately in
  `flashlist-blank-screen-collapse-above` (memory topic), not fixed here.

- [09 — How is the ladder shared across four list views with an uncertain future?](issues/09-four-views-sharing.md)
  — **One exported type, one named identity, one capability gate.** The ladder takes a
  **named `LadderView`**, never a toggle ordinal (ordinals are a UI toggle position,
  persisted nowhere, and both candidate futures renumber them); `SECTIONED_VIEWS` derived
  from that identity gates **the rung *and* the sweep**, so the 2-rung ladder is the same
  ladder with the gate closed, not a base class. `SectionRange {sectionId,start,end}`
  ratified. `listRef` becomes a **required** prop on all four (internal fallback refs
  deleted; it also drives `useResetScrollOnTabChange`), and the whole contract is an
  exported **`LadderListProps`** all four props types intersect — which is what stops it
  drifting away from the list nothing mounts. `BooksList` is made **uniform**: contract
  props *and* its `<FlashList>` mounts unconditionally, so its empty case runs ticket 03's
  `getFirstItemOffset()` path instead of a null-ref path. One-list-at-a-time is a stated
  **invariant**; a shared ref is kept and a split layout is a conscious redesign.
  ⚠ **CORRECTS ticket 04's uniform-installation argument (F1):** `sectionRangesRef` is
  never emptied (no cleanup on BooksHome's push) **and** an empty one would be a
  *collapse-everything*, not a no-op, because `computeRemainingOpen` iterates `open`, not
  `visible` — so wiring SeriesHome/BooksGrid would silently wipe the user's BooksHome
  expansions from another view. Ticket 04's *decision* stands; its *reason* did not survive
  tracing. Also: ranges must push from a **`useLayoutEffect`** (D4) — a passive effect
  leaves a window where a stale range resolves to the *correct section id* with a *stale
  `start`*, so the rung lands on the wrong header and every sanity check passes; ⚠ **F2 —
  charting decision 4 rests entirely on `useResetScrollOnTabChange`'s `animated: false`**,
  one word in an unrelated file, so name it an invariant; **F3 — the ladder contributes no
  `onScroll`** (died with ticket 06's instant arm), so it never sits in the per-frame path;
  **F4** — `firstItemOffset` is 44 (grid) vs 50 (list), which a density sub-toggle would
  swap under one toggle position.

- [11 — Run the Android 16 device tests the research could not settle](issues/11-android16-device-tests.md)
  — **14 of 15 pass; DT-9 refuted; one new defect found that gates the spec.** Run on a
  **Pixel 7 Pro / Android 16 / SDK 36, gesture nav**, real 355-book library, debug + preview
  builds on `proto/back-ladder-rung-ab`. **Both design-invalidating tests clear:** the RN 0.83
  latch never re-armed across 5 rounds and 10 consume/decline transitions **in one process**
  (every press reached JS), and the drawer never let a press through. Ticket 01's mechanism,
  ticket 02's installation site, ticket 03's `38/38/44` table (**exact**), ticket 04's sweep
  sequencing, ticket 05's rung landing and ticket 06's animated jump are all confirmed on
  device — including that a **41,226 px jump takes 288 ms vs 319 ms for 20,818 px**, so the
  two-stage fallback is confirmed unnecessary. ⚠ **DT-9 REFUTED:** four empty states read
  `offset 0`, not `firstItemOffset`, so ticket 03's headline justification for
  `getFirstItemOffset()` must be restated — though DT-8's confirmed per-view spread
  (**38/38/44**) independently rescues the predicate. ⚠ **F-H, the one that matters: the
  collapse sweep can drift the list off the top** (+943 px, +213 px), after which `atTop` is
  false and **back stops backgrounding the app** — three presses to exit, four with the rung.
  Trigger narrowed to **deep + mid-fling together**; **not** variant-specific (identical bytes
  run on a master jump), variant A **untested rather than immune**. Handed to
  [12](issues/12-collapse-sweep-scroll-drift.md), which likely **gates the spec**. Also: **F-F**
  the resting offset can be **negative**, so the at-top test must stay an inequality; **F-G**
  the at-top guard and velocity gate are **complementary, not redundant**; **F-C** the drawer
  and IME guards are never reached (both consume upstream); **F-I** the rung was once seen
  landing a few rows past the header, unreproduced but with a 1,368 px numeric corroboration.
  Two pieces of ticket text corrected at source so the spec cannot inherit them: the
  **phantom scrollbar** (no list has one) and **"nothing on screen moves"**, which constrains
  only the sweep phase, not the jump.

- [12 — The collapse sweep drifts the scroll position off the top](issues/12-collapse-sweep-scroll-drift.md)
  — **Root cause confirmed on device, fix chosen and A/B-verified: one line —
  `list.prepareForLayoutAnimationRender()` immediately before the sweep's `setState`.**
  The drift is MVCP's offset correction firing against a **stale anchor**: the sweep runs on
  the *native* momentum end, while FlashList re-anchors on its own **100 ms scroll-idle
  debounce** (`VelocityTracker.ts:59`) that every scroll event during the jump keeps
  resetting. Proven to the pixel — **`mvcp.diff` equals the resting drift exactly** on all
  three reproductions (−978.55, −1803.89, −617.20). ⚠ **Ticket 03's "at the top the anchor is
  index 0, so `diff === 0`" is FALSE at sweep time** — observed anchored to a deep pre-jump
  section while resting at offset 0; it becomes true ~100 ms later. ⚠ **Ticket 11's
  `openAfter` correlate was a proxy**: the real precondition is the stale anchor **surviving**
  the mutation **and content above it changing**, which needs the anchor **deep in
  already-collapsed territory with expanded sections above it** — 4/6 there, 0/14 in the two
  configurations ticket 11 could reach, which is why its matrix could not isolate it.
  ⚠ **A SECOND consequence, new:** a *negative* drift keeps `atTop` true, but the follow-up
  sweep then runs at a negative offset with an **empty visible set** — and by ticket 09 F1's
  `open`-iterating `computeRemainingOpen` that is a **collapse-EVERYTHING**, wiping the very
  sections ticket 04's "keep what's at the top" protects. **Ticket 09's hazard is live, not
  theoretical.** Fix off: 4/6 drifted; fix on: **0/20**, both variants. Leaves ticket 04,
  ticket 03's predicate and charting decision 2 intact — no timer, no constant, no state.
  ⚠ Honest limit: ticket 11's drifts were **positive**, all three here **negative**; same
  correction, sign asymmetry unexplained, so **F-I is neither confirmed nor refuted**
  (`oldY === newY` to full precision in every non-drifting correction — no evidence of
  `getLayout` estimation error). Throwaway probe patch + `12 · seed` chip must die with the branch.

- [10 — Draft `spec.md` and drive it to driver approval](issues/10-write-the-spec.md)
  — **[`spec.md`](spec.md) written, `ready-for-agent`. The map is closed.** 1,022 lines,
  organised by surface (A interception · B arm predicate · C the ladder · D the rung ·
  E the jump · F the sweep · G the MVCP fix · H sharing across four views · I invariants ·
  J modules), plus **§Risks**, **§Testing Decisions** and **§Out of Scope**. Three forks the
  tickets had left to the spec were put to the driver and decided: **(1)** the test seam is
  **one pure module, two decisions** — `decideBackPress` / `decideSweep` over a snapshot of
  plain numbers, with visibility passed as a **thunk** so ticket 03 §6's ordering is asserted
  inside the tested unit, and the hook reduced to gather → decide → execute; **(2)** ticket 11
  **F-A is ACCEPTED** — an overscroll bounce at the top does sweep, since the outcome equals a
  back press's and only below-fold sections can be touched (`onScrollBeginDrag` recorded as a
  reversible lever); **(3)** **TalkBack is out of scope**, as a named follow-up. ⚠ Ticket 12's
  §6.3 fork was answered **neither way as stated**: instead a *degenerate visible sample* is a
  **no-op** (empty visible range, or zero overlap against non-empty ranges) — sign-agnostic,
  leaves `computeRemainingOpen`'s contract and tests untouched, and is pinned by two named jest
  cases. ⚠ **Found while writing, not previously recorded: `computeRemainingOpen`'s five jest
  tests do NOT exist on the prototype branch** — the helper was cherry-picked without them and
  they still live only on `fix/collapse-offscreen-lists-onMomentumScrollEnd` (`0365b39`), so the
  spec says *restore them* rather than *they are green*. Test strategy names **17
  `decideBackPress` cases** and **11 `decideSweep` cases**, including the two regression tests
  that keep ticket 09 F1's collapse-everything hazard and ticket 05's `y + firstItemOffset`
  landing bug from coming back.

## Not yet specified

**Nothing. The fog is closed.**

- **Accessibility / TalkBack** — was the last open item. Driver ruling 2026-08-20:
  **out of scope**, carried into the spec as a **named follow-up ticket** rather than an
  implicit gap, because nothing on this map was ever run with a screen reader and an
  invented announcement string would be speculation, not a decision. The *reduced-motion*
  half was already closed by ticket 06 and is **not** open: the OS animator scale governs
  the jump directly and the sweep survives a 0 ms duration, so the ladder does nothing.

## Out of scope

- **Any screen other than the library** (charting decision 5). Applying the
  ladder to `seriesDetail`, the player, settings or any pushed route is a
  separate effort with a separate destination.
- **Root-causing the parked collapse flicker as a prerequisite.** Downgraded
  from blocker to open question by device evidence; ticket 07 reassesses it, but
  the spec is not gated on a root cause.
- **Implementing the feature.** This map ends at an approved spec.
- **Unwinding search / tab / view-toggle state via back** (charting decision 7).
- **Reviving or retiring `BooksList` as a product decision.** Ticket 09 decides
  only how the ladder is *shared* across list components under both futures.
- **Building the `BooksGrid` ↔ `BooksList` density sub-toggle.** Raised during
  ticket 09 as the driver's likelier shape for reviving `BooksList` — a compactness
  toggle *inside* `toggleView 2` rather than a 4th toggle. Ticket 09 confirmed it
  changes nothing structural (one list still mounted at a time; identity becomes a
  function of two state values, which is one line at the mount site), and that the
  ladder imposes **no constraint** on whether the swap preserves scroll position.
  Shipping it is a separate effort.
