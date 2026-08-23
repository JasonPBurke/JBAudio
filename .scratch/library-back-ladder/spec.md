# Library Back Ladder — Design Spec

Status: `ready-for-agent`
Effort: `library-back-ladder`
Written: 2026-08-20 · resolves [10](issues/10-write-the-spec.md)
**Approval: SIGNED OFF by the driver, 2026-08-22.** Three open forks were put to the driver on
2026-08-20 and answered (test seam shape, the overscroll-bounce sweep, TalkBack scope);
they are recorded below as decisions. Amendments are edits to this file, in place; it is never
reissued.
**Amended 2026-08-21** — six edits, all raised by implementation tickets
[02](../library-back-ladder-impl/issues/02-decide-back-press.md) and
[03](../library-back-ladder-impl/issues/03-decide-sweep.md) and none reversing a driver ruling:
two factual corrections (**B7**'s missing premise, **F8**'s sentinel value), two adoptions of a
safer default the spec was silent on (**F8**'s dropped qualifier, **F5**'s unreported velocity),
one signature widening (**J4/J5**), and one contract sharpened for the range producer (**H4**).
Each is marked in place at the decision it touches.
**Amended again 2026-08-21** — one edit, raised by implementation ticket
[04](../library-back-ladder-impl/issues/04-shared-list-contract.md)'s review: **H8**'s module
home. Locational only; the contract itself is unchanged.
**Amended 2026-08-22 (eighth amendment)** — two factual corrections, both raised by
[impl 10](../library-back-ladder-impl/issues/10-branch-review-disposition.md)'s whole-branch
review (F-8): the Testing Decisions section wrongly claimed the jest environment was jsdom with
no React Native preset — it was node — and that claim is now stale twice over, since the
`rn` jest lane merged onto this branch afterward. Both sites corrected in place; §J4's extraction
rationale is unchanged.
**Amended 2026-08-23 (ninth amendment)** — five edits, all raised by implementation ticket
[08](../library-back-ladder-impl/issues/08-device-verification.md)'s device pass, which found
**two defects in the intermediate rung** (D-1, the 38 px sample skew; D-2, the pixel-grid snap).
The rung no longer identifies its section by index, so every passage describing that mechanism is
superseded: **D4** (the mechanism itself), **H4**'s "the rung asks containment" clause, **J1**'s
press-time read list, and Testing Decisions cases **11** and **13**, which specified the very
behaviour D-1 had to remove. **D3 is unchanged and was correct throughout** — the fault was D4's
mechanism for reaching it, never the intent. One question raised by the amendment — C1's
*"meaningfully above the fold"* — was put to the driver and **answered the same day: the current
behaviour is accepted**. See D4's amendment.
**Amended 2026-08-23 (tenth amendment)** — two edits, also raised by implementation ticket
[08](../library-back-ladder-impl/issues/08-device-verification.md)'s device pass: **F5** and **E5**.
F5's open device question is answered — the overscroll bounce DOES sweep, confirmed with a control —
and a THIRD sweeping gesture was found that F5's recorded lever does not cover: a settled slow drag
down into the list. E5's smear risk was measured on shipping code and is not the shape E5 assumed.
Both were put to the driver and **accepted as they stand**, with the reopen condition recorded.
Map (the argument, ticket by ticket): [map.md](map.md)
Prototype branch: **`proto/back-ladder-rung-ab`** — throwaway, see §Further Notes.

---

## How to read this

This is the **final state** of twelve tickets, organised by **surface**, not by ticket
number. Where a later ticket overturned an earlier one, only the surviving decision is
stated; the reversal and the losing option live in the linked ticket. Every heading
carries its ticket links — follow them when you want the *why*, not the *what*.

Three things this document is not:

- **Not a plan.** It states what gets built, not in what order.
- **Not a record of how the thinking went.** That is the map.
- **Not implementation.** The map ends here; implementation is a separate effort.

Deviations from the standard spec template, all deliberate:

- **A `## Risks` section exists**, because [10](issues/10-write-the-spec.md) requires the
  conclusions of tickets [07](issues/07-reassess-the-flicker.md) and
  [08](issues/08-blank-screen-large-section.md) to be carried as risks rather than buried.
- **An `## Invariants` section exists**, because several decisions here are only safe while
  a property elsewhere in the app holds. Stating them as invariants is the point: a future
  change that breaks one must fail loudly rather than quietly.
- **Small code blocks appear** where a prototype encoded a decision more precisely than
  prose can — chiefly the arm predicate, the rung's landing arithmetic and the module
  interfaces. They are decisions, not implementations.
- **No file paths and no line numbers.** Modules are named; locations rot.

---

## Problem Statement

A reader with a large library opens the library screen, taps a few author sections open to
browse them, scrolls a long way down — and is then stranded.

**Unlimited-open has no cheap inverse.** `BooksHome` deliberately allows any number of
sections to be expanded at once; that was a considered choice, made to dodge a FlashList
jump/flash the app hit when it tried to auto-close the previous section. The cost of that
choice was never paid: re-compacting the list means finding every header you opened and
tapping each one, scrolling the whole way back up to do it. In a 355-book library that is
a chore, and it is a chore the app created.

Two smaller failures sit alongside it:

- **Getting back to the top is manual.** There is no scroll-to-top affordance anywhere on
  the library screen. The only way back to the top of a long, expanded list is to flick
  repeatedly.
- **Back is doing nothing useful here.** On the library screen — and only there — the back
  press already means exactly one thing: background the app. It is the one screen in the
  app where a press is available to be spent on something better, and it is currently
  spent on the least interesting outcome available.

The user has no word for any of this. What they experience is: *"I opened four authors, I
scrolled down, and now getting back to a tidy list is more work than the browsing was."*

## Solution

**On the library screen, back becomes a ladder.** Each press takes one rung down; when
there are no rungs left, back means what it has always meant and the app backgrounds.

For the sectioned view (`BooksHome`), the ladder has three rungs:

1. **Press one — the section top.** If the top of your viewport is inside an expanded
   section whose header is above you, the list scrolls up to that header. You land where
   you entered the section you are reading.
2. **Press two — the top of the list.** The list scrolls to the top, and **on arrival every
   expanded section that is not on screen collapses.** The list you come back to is
   compact.
3. **Press three — the app backgrounds.** Unchanged behaviour.

For the non-sectioned views (`SeriesHome`, `BooksGrid`, and `BooksList` if it is revived)
there is nothing to collapse and no section to return to, so the same ladder has two rungs:
top of list, then background.

The reset gesture is the point of the feature. The other rungs are what make it feel like a
ladder rather than a trick.

Three properties hold across all of it:

- **The jump is animated.** It is a real scroll, so you can see where you came from.
- **There is no toast, no haptic and no "press back again to exit".** The convention exists
  for apps where the first press does nothing visible. Here the first press is visibly a
  scroll — that *is* the feedback.
- **Nothing else about the screen changes.** Your search text, your selected tab and your
  view toggle are untouched by back. Scroll position is the only thing the ladder moves.

---

## User Stories

### The reader, on the sectioned view

1. As a reader browsing a long expanded author section, I want a back press to take me to
   that section's header, so that I can get back to where I entered it without flicking.
2. As a reader who has landed on a section header, I want the header to sit clear of the
   search bar, so that I can actually read the name of the section I returned to.
3. As a reader at a section header, I want the next back press to take me to the top of the
   whole list, so that the ladder keeps descending rather than sticking.
4. As a reader arriving at the top, I want every expanded section I cannot see to have
   collapsed, so that the list is compact again without me hunting down each header.
5. As a reader arriving at the top, I want whatever is on screen to stay exactly as it is,
   so that nothing jumps or reflows under my eyes at the moment I arrive.
6. As a reader whose Recently Added section is expanded and filling the screen, I want it
   left open when I arrive at the top, so that the app does not close the thing I am
   looking at.
7. As a reader who wants that section closed too, I want to close it with one tap on a
   header that is already on screen, so that the remaining work is trivial rather than a
   hunt.
8. As a reader at the top of a tidy list, I want a back press to background the app, so
   that back still means what it means everywhere else in Android.
9. As a reader whose viewport top is inside a *collapsed* region, I want back to go
   straight to the top of the list, so that I do not pay for a rung that would do nothing.
10. As a reader whose viewport top is inside an expanded section whose header is already on
    screen, I want back to go straight to the top of the list, so that a press never
    produces an invisible result.
11. As a reader who has just used the section rung, I want the ladder to work out where I am
    from where I am, so that it never gets out of step with the list after I scroll by hand
    between presses.

### The reader, on the other library views

12. As a reader browsing the Series view, I want back to scroll me to the top and then
    background the app, so that the gesture is the same everywhere on the library screen.
13. As a reader browsing the grid view, I want the same two-rung behaviour, so that
    switching view toggles does not change what back means.
14. As a reader who has expanded sections on the books view and then switched to another
    view, I want my expansions still there when I come back, so that switching views is not
    a destructive act.
15. As a reader on a view with no sections, I want back to never collapse anything, so that
    a scroll in one view cannot silently change another.

### The reader, at the edges

16. As a reader who is already at the top of the list, I want a single back press to
    background the app, so that I never have to press twice for no visible reason.
17. As a reader whose search matched nothing, I want back to background the app
    immediately, so that an empty screen does not trap me.
18. As a reader on an empty tab, I want the same, so that emptiness is never a reason back
    stops working.
19. As a reader with the drawer open, I want back to close the drawer and leave my scroll
    position exactly where it was, so that the drawer's own behaviour is untouched.
20. As a reader with the keyboard up, I want back to dismiss the keyboard only, so that
    dismissing a keyboard never also moves the list.
21. As a reader with the player, the title-details sheet or any other modal open, I want
    back to close that, so that the ladder never steals a press from the screen on top.
22. As a reader who starts a back gesture and then cancels it, I want nothing to happen, so
    that an aborted swipe is not a committed one.
23. As a reader who presses back while the list is still flinging, I want the jump to start
    from where the list actually is, so that the press acts on what I can see.
24. As a reader who touches the screen mid-jump, I want the scroll to stop under my finger
    and nothing else to happen, so that I always have control of the list.

### The reader, on motion and scale

25. As a reader with a very large library, I want the jump from deep in the list to stay
    smooth, so that the feature is not worse the more books I own.
26. As a reader who has turned animations off at the system level, I want the jump to be
    instant, so that the app respects a setting I set for the whole device.
27. As a reader who has turned animations off, I want the collapse to still happen, so that
    the reset half of the feature does not silently disappear with the animation.
28. As a reader, I want the ladder to add no cost to ordinary scrolling, so that a feature I
    use occasionally does not tax the thing I do constantly.

### The reader, on what back must NOT do

29. As a reader, I want back to leave my search text alone, so that a press does not undo
    typing.
30. As a reader, I want back to leave my selected tab alone, so that the ladder cannot
    navigate on my behalf.
31. As a reader, I want back to leave my view toggle alone, so that the list I am looking
    at stays the list I chose.
32. As a reader who switches tabs, I want the list to reset to the top without collapsing my
    expanded sections, so that a tab change is not secretly a reset gesture.
33. As a reader on any screen other than the library, I want back to mean exactly what it
    means today, so that one screen's new behaviour does not leak into the rest of the app.
34. As a reader who backgrounds the app with back and returns to it, I want back to keep
    working forever after, so that the app never reaches a state where back is dead.

### The maintainer

35. As the app's maintainer, I want the ladder's rung selection and collapse rules to be
    pure functions with jest tests, so that the parts of this feature that can be verified
    off-device are verified on every commit.
36. As the maintainer, I want the four list components to share one compiler-enforced
    contract, so that adding a field to the ladder fails the build on the list nobody
    mounts rather than drifting silently.
37. As the maintainer, I want the list identity the ladder receives to be a name rather than
    a toggle number, so that renumbering the toggle cannot change behaviour.
38. As the maintainer, I want the properties this design depends on stated as invariants,
    so that a future one-word edit elsewhere cannot quietly break it.
39. As the maintainer, I want the prototype's probe instrumentation and its FlashList patch
    to die with the prototype branch, so that no throwaway diagnostic reaches `main`.

---

## Implementation Decisions

### A · Interception — how a back press reaches the ladder

[01](issues/01-back-interception-mechanism.md) ·
[research](research/01-back-interception-mechanism.md) ·
[11](issues/11-android16-device-tests.md)

**A1. The mechanism is `BackHandler.addEventListener('hardwareBackPress', …)` registered
inside React Navigation's `useFocusEffect`.** Not expo-router (it exposes no facility for
this), not native. This is the app's first conditional back handler — `BackHandler` appears
nowhere in `src/` today.

**A2. Returning `true` consumes the press; returning `false` declines it** and lets Android
background the app through the existing `MainActivity` override. **Interleaving the two in
any order is safe on RN 0.83.2 + targetSdk 36 + Android 16.** The known one-way latch —
`invokeDefaultOnBackPressed` calling `setEnabled(false)` and never re-enabling — is
unreachable from both paths: the consume path never calls `exitApp()`, and the decline path
stops at `MainActivity`'s `moveTaskToBack(false)`, which returns `true` for this root
`singleTask` launcher activity so `super` is never reached. **Device-confirmed:** five
rounds alternating gesture and button in a single process, ten consume/decline transitions,
every press reaching JS.

**A3. No native patch and no RN 0.84 / Expo SDK 56 upgrade is required.** Recorded here to
stop it being re-litigated.

**A4. The gesture and the 3-button back are the same event.** On targetSdk 36 `KEYCODE_BACK`
is no longer dispatched; both converge on `OnBackInvokedDispatcher` and produce one
`hardwareBackPress`. A cancelled gesture produces **no event at all** — RN no-ops
`onBackCancelled` — so an aborted swipe can never fire a rung.

**A5. A consumed press cannot flash a "leaving the app" animation.** RN registers its
callback at androidx priority `0` and overrides neither `handleOnBackStarted` nor
`handleOnBackProgressed`, so the back-to-home peek never plays on this app on any press.
(The circular chevron SystemUI draws at the screen edge during a gesture is not the peek and
is unaffected.)

**A6. The handler is installed exactly once per focus.** Every mutable input reaches it
through a mirror ref, so the `useFocusEffect` callback's dependency array contains only
stable ref objects. This is load-bearing, not tidiness: `BackHandler` dispatches strict LIFO
**by registration time**, so a handler that re-registers while the drawer is open would sit
*above* the drawer's own handler and scroll the list instead of closing the drawer.

**A7. The hook owns a drawer guard and declines while the drawer is open** — but as
defence-in-depth only. On device the drawer consumes back upstream in React Navigation and
the ladder's handler is never reached at all; the same is true of the IME. Keep the guard
(it is one comparison and it makes the hook self-contained), but **do not describe it in
review or documentation as the thing that makes the drawer case work** — it is not.

**A8. Modal routes disarm the ladder for free.** Every modal route in this app is declared
as a sibling of the drawer on the root stack, so pushing one blurs the library screen,
`useFocusEffect`'s cleanup runs and the handler is removed. Device-confirmed on three
routes.

### B · The arm predicate — what "scrolled down" means

[03](issues/03-define-at-the-top.md) · [11](issues/11-android16-device-tests.md)

**B1. The predicate is a comparison of two values read from the mounted list's own ref, at
press time:**

```
armed  ⟺  getAbsoluteLastScrollOffset()  >  getFirstItemOffset()
at top ⟺  getAbsoluteLastScrollOffset()  <= getFirstItemOffset()
```

One comparison serves the ladder and the sweep as exact complements. Nothing can be both
"scrolled" and "at top", or neither.

**B2. It is not a fudge factor and not an epsilon.** `firstItemOffset` is *exactly* the raw
scroll offset at which the first list item's top reaches the viewport top, so the predicate
reads literally as **"is any list item above the fold?"**. That is the definition of
"scrolled down" this feature wants, and it is the same threshold that makes the sweep's
invariant (§I2) true.

**B3. The resting offset at visual top is `0` on every view.** The spacer
`ListHeaderComponent` is *content inside* the scrollable area, not a shift of the origin:
FlashList stores the offset spacer-relative and `getAbsoluteLastScrollOffset()` adds the
spacer back, reconstructing the raw native offset. `scrollToOffset({offset: 0})` lands on
that same zero, so the predicate's zero and the ladder's landing spot are the same number.
Device-confirmed at rest on all three mountable views.

**B4. Read the value; never hardcode it.** `firstItemOffset` is **not uniform**:
measured **38** (BooksHome), **38** (SeriesHome), **44** (BooksGrid) — all exact against
prediction — and **50** predicted for `BooksList`, which cannot be measured because nothing
mounts it. One of those differences comes from `style` rather than `contentContainerStyle`
and is easy to miss by inspection. A hardcoded `~40` would pass on three views and silently
under-cover the fourth; under the driver's likely density sub-toggle it would swap 44 ↔ 50
under a single toggle position and produce a density-dependent bug where back never
backgrounds the app.

**B5. ⚠ Do not repeat ticket 03's headline justification — it was refuted on device.** The
claim that *"an empty list reports `firstItemOffset` forever, so a literal `> 0` would arm
the ladder on every no-results search"* **did not reproduce**: four independent empty states
(no-results search, search cleared, and two genuinely-empty tabs) all read `offset: 0`. The
predicate is unchanged and still correct — `0 <= 38` declines, and back still backgrounds
the app on an empty list — but its justification is now **B2 and B4**: structural exactness
and a per-view spread no constant can track. *Residual:* none of those four states was a
true cold mount of an already-empty list; that variant is untested and is not leaned on.

**B6. The at-top test must stay an inequality, never an equality.** The resting offset can
legitimately be **negative** (overscroll at the top), and after a sweep it can briefly be
strongly negative. `<=` is the safe side and every negative value falls on it.

**B7. Evaluate the offset predicate before touching visibility.** `computeVisibleIndices()`
**throws** when the list has no layout manager, while the two offset accessors are plain
field reads that never throw. Ordering the predicate first is what keeps that throw out of
reach: the predicate is `offset > firstItemOffset`, and with no layout manager **both** sides
read `0`, so it is `0 > 0` — false. **Predicate true ⇒ layout exists.** This is why the
snapshot in §J4 exposes visibility lazily.

*Amended 2026-08-21 ([impl 02](../library-back-ladder-impl/issues/02-decide-back-press.md)).*
The original wording named only the `firstItemOffset === 0` half and concluded `0 > 0` from it
alone; the **offset** must read `0` too, and that half is **reasoned, not measured** — a list
that has never laid out cannot have been scrolled. Treat the ordering as a strong guard, not a
proof. **If the hook contains the throw at all, containment must DECLINE the press** — return
control to the system so back backgrounds the app, exactly as it does with no ladder. It must
never fall through to a rung: a swallowed throw that lands on master top is the silent
wrong-landing shape §H5 and §F8 exist to prevent. The pure decision function does not catch;
the boundary belongs to the hook.

### C · The ladder — rungs, order, and both ends

[02](issues/02-where-the-ladder-lives.md) · [05](issues/05-intermediate-rung-ab.md) ·
[09](issues/09-four-views-sharing.md)

**C1. `BooksHome` — three rungs.** Evaluated in order on every press:

| # | Rung | Fires when | Action |
|---|---|---|---|
| 0 | *decline* | drawer open, or no mounted list | return `false` |
| 1 | *decline* | `offset <= firstItemOffset` (B1) | return `false` → app backgrounds |
| 2 | **section top** | the viewport top sits inside an **expanded** section whose header is meaningfully above the fold (D1–D3) | animated scroll to that header (D2), return `true` |
| 3 | **master top** | otherwise | animated scroll to offset `0`, return `true` |

**C2. `SeriesHome`, `BooksGrid`, `BooksList` — two rungs.** The same ladder with rung 2
gated off. Not a base class, not a second hook.

**C3. There is no ladder state anywhere.** No counter, no timer, no timeout, no "which rung
was last" memory. Every press re-derives its answer from the live scroll offset and the live
layout. The ladder is therefore **self-healing by construction**: scroll by hand between
presses, switch views, let the library rescan under you — the next press is still correct.
Device-confirmed: after the section rung lands, the header is at the fold rather than above
it, so rung 2's own predicate is false and the next press goes to master top with no state
consulted.

**C4. Both ends are unremarkable on purpose.** The top end declines and Android backgrounds
the app exactly as it does today. The bottom end has no special case — the ladder never
looks at how far down the list you are, only at whether anything is above you.

### D · The intermediate rung

[05](issues/05-intermediate-rung-ab.md) · [11](issues/11-android16-device-tests.md)

**D1. The rung ships. It earned its place on device.** Both arms were built on
`proto/back-ladder-rung-ab` and driver-tested as a **preview build** against a real
355-book library. Verdict: *"the 3-rung is the clear winner."* The argument against it — that
it puts an extra press in front of the reset that is the whole point of the feature — did
not survive contact with the device. It reads as a ladder, not as an obstacle.

**D2. ⚠ The landing offset is `getLayout(headerIndex).y` — plain `y`, with no conversion
term.** This is the one number on this map a reasonable implementer gets wrong in the
obvious direction, and the prototype did:

```
at raw offset S, item i's top sits at screen position (y_i + firstItemOffset) - S
we want the header at screen position firstItemOffset  ⇒  S = y_h
```

Landing at `y_h + firstItemOffset` aligns the header to the **viewport** top, which is
exactly the strip the dropped-down search bar occupies as an absolute overlay — the header
lands **underneath the search bar**. Found on device, fixed, re-confirmed on a later build.
Landing at plain `y_h` puts the header precisely where item 0 sits at master top: clear of
the bar, in the visual slot the user already knows. **Self-consistency check:** at header
index 0, `y = 0`, so the rung and master top become the same call — the rung degenerates
correctly at the boundary rather than needing a special case.

Rejected alternative: *hide the search bar during auto-scrolls.* It only defers the
occlusion (the bar returns on any upward delta), and it would give the ladder a second job
— owning chrome visibility — with a new failure mode.

**D3. "Topmost expanded section" means the *nearest* one — the section that CONTAINS the
viewport top.** Not the earliest expanded section in the list. The earliest reading is
self-defeating: Recently Added is the first item on every non-empty `BooksHome`, so whenever
it is expanded that reading targets index 0, which is master top, making the rung a
guaranteed dead press.

**D4. The rung is identified by index and decided by offset.** Find the range containing
`computeVisibleIndices().startIndex`; require it to be expanded; resolve its header's `y`;
fire only if `offset - y > 1px`. The sub-pixel guard exists because an index-based test
re-fires the rung when the landing offset settles a hair past the header's `y`.

*Amended 2026-08-23 ([impl 08](../library-back-ladder-impl/issues/08-device-verification.md)).*
**The mechanism above is WRONG and is superseded. D3's intent is unchanged.** Two device defects
came out of it, with byte-identical symptoms and different causes:

- **D-1, the 38 px sample skew.** `computeVisibleIndices()` samples from
  `offset - firstItemOffset` — `RecyclerViewManager.ts:117` hands `EngagedIndicesTracker` the
  SUBTRACTED value as its `viewportStart` — while D2 lands the rung at the header's PLAIN `y`.
  The index and the landing therefore live in coordinate spaces exactly one list-header spacer
  apart, 38 px on `BooksHome`. So the instant a rung landed, the sample window opened 38 px
  ABOVE that header, inside the PREVIOUS section's last item, and any-sliver bounds reported
  that item's index. With CONSECUTIVE sections expanded, back climbed one open section per
  press. When the previous section was collapsed the expanded check swallowed it and the press
  fell through to master top — correct by accident, and the reason this survived a year of
  single-expansion reading, 943 tests and three reviewers.
- **D-2, the pixel-grid snap.** `scrollTo` can only come to rest on an integer PHYSICAL PIXEL,
  while a layout `y` is a sum of measured dp heights and is freely fractional. A landing aimed
  at `y_h` rests at `y_h` SNAPPED TO THE GRID — ≤0.14 dp at density 3.5, ≤0.5 dp at any density.
  Snapped short, a strict `y <= offset` drops the header the press just landed on out of its OWN
  candidate set. **The two numbers D2's arithmetic says are equal are never quite equal.**

**The rung resolves its section in OFFSET SPACE — the same coordinate the landing is expressed
in.** Take the section header with the GREATEST `layoutY(range.start)` satisfying
`y <= offset + T`; require it to be expanded; fire only if `offset - y > T`. A header whose
layout does not resolve is skipped rather than fatal, since an unresolved `y` cannot be compared
and abandoning the rung on one would lose it for the whole list. `T` is a tolerance in dp; `1`
clears the pixel-grid snap on any density with margin.

Three consequences, each load-bearing:

- **The rung is SELF-TERMINATING by construction.** After a landing the same section resolves
  again and the fire condition declines to master top. No "have I already landed here?" state is
  introduced, so C3/I6 hold unchanged.
- **`computeVisibleIndices()` leaves the back-press path entirely.** B7's ordering rule and J4's
  lazy `visible` now protect the SWEEP alone; the rung's throw hazard is closed at source rather
  than ordered around. The hook's `try/catch` is KEPT — an uncaught throw inside a `BackHandler`
  callback is a crash on a back press — with `getLayout` as its live subject.
- **The lookup is ORDER-INDEPENDENT** — a maximum, not a first match — so it no longer depends
  on H4's non-overlap guarantee. See H4's amendment.

⚠ **`T` does TWO jobs and C1 only asked for one. *(Driver decision, 2026-08-23: the current
behaviour is ACCEPTED. Revisit if the conditions below change.)*** `T` gates both *"which header
is the offset AT"* (where it must be ≥ the grid snap, or D-2 returns) and *"is this header worth
scrolling to"* (C1 rung 2's *"meaningfully above the fold"*). At `T = 1` a header 5 px above the
offset fires the rung: back is consumed for a hop the reader cannot see, and only the NEXT press
reaches master top. Verified against the shipped decision — `offset 1505`, header `y 1500` →
`scrollTo(1500, 'section')`.

The deviation from C1 is real and is accepted on its consequences: the hop is invisible, the
ladder still completes on the following press, nothing is lost or mis-landed, and the window is
one dp wide. **What would reopen it:** `T` growing beyond a sub-pixel allowance for any reason;
a view whose `firstItemOffset` or header height makes the dead press land somewhere a reader
notices; or a report of "back did nothing". **The fix, when that day comes, is to split `T` into
two named constants** — a grid-snap tolerance for the containment test, and a separate
"meaningfully above" threshold for the fire condition — since only the first is bracketed by the
pixel grid and the second is a UX number.

**D5. The rung is a plain `scrollToOffset`, never `scrollToIndex`.** The header is above the
viewport and therefore already measured, so its layout is exact. The memory topic that
rejects pinning by index describes a *pin racing MVCP across a data mutation*; the rung
mutates nothing, so that rejection never applied. Device-confirmed: no jump/flash.

### E · The jump

[06](issues/06-animated-vs-instant.md) · [04](issues/04-collapse-scroll-sequencing.md) ·
[11](issues/11-android16-device-tests.md)

**E1. Every rung uses `scrollToOffset({ offset, animated: true })`. The instant arm is
rejected**, on device, against a real library.

**E2. The back handler for the master rung is two statements** — the scroll, then
`return true`. Nothing else. An animated programmatic scroll **emits
`onMomentumScrollEnd` by itself** (via Android's fling animator), and that event is already
the collapse sweep's first trigger. **The animated jump therefore needs zero arrival
machinery**, which is the reverse of the usual "instant is simpler" intuition: the instant
arm would have needed a one-shot armed flag, because `animated: false` emits no momentum
events at all. That flag is **deleted from the design**; it has no remaining caller.

**E3. Interruption needs no design.** The fling animator dispatches momentum-end on
*cancel* as well as on end, so a touch mid-jump still produces the event — at a non-top
offset, where the sweep's at-top guard makes it a no-op.

**E4. The sweep fires AT LEAST ONCE per arrival and must be idempotent.** Do not assert
exactly-once. When back interrupts an in-flight fling, momentum-end fires **twice** (the
cancelled fling's animator and the programmatic scroll's), so the sweep runs twice.
Device-confirmed idempotent — every observed second run collapsed nothing — but the property
must be stated, because it is what makes the double fire harmless.

**E5. The animation duration is distance-independent** (~250 ms, cached from the device's
`OverScroller`). Measured: a **41,226 px** jump took **288 ms**; a **20,818 px** jump took
**319 ms**. The smear risk — consecutive frames sharing no cells, so recycling buys nothing
— was the ticket's central concern and **was not reported as objectionable at real library
scale**. Consequently the **two-stage jump** (instant to within a screenful, then animate the
last leg) and the **distance-dependent rule** are both unneeded and stay unbuilt.

*Amended 2026-08-23 ([impl 08](../library-back-ladder-impl/issues/08-device-verification.md)).*
**Measured on shipping code, and the risk is not the shape E5 assumed.** Screen-recorded at 120 Hz
on a preview build against the real 355-book library and analysed frame by frame: the jump does not
produce a smear of mismatched cells. **The list viewport goes fully BLANK for ~160 ms** — flat
luminance 26.3 against 62–63 settled — then fills over ~90 ms, fully settled ~320 ms after the
press, with cover art resolving last. "Consecutive frames sharing no cells" understates it: for
about half the jump there are no cells at all.

*(Driver decision, 2026-08-23: **ACCEPTED.** It is brief, it is the same every time, nothing is
mis-landed, and the list is correct the moment it settles. **Revisit on evidence** — a user
reporting the blank as a glitch or a perceived hang. E5's conclusion is UNCHANGED: the two-stage
jump and the distance-dependent rule stay unbuilt, and note that the two-stage jump would not even
address this — an instant first leg lands in the same unrendered region.)*

**E6. ⚠ The ladder must NOT consult `ReducedMotionConfig`.** That component is Reanimated's
and has no path to the platform `ObjectAnimator` this scroll runs on. **Reduced motion is
handled by the OS animator scale, for free and correctly:** at scale `0` the jump takes 0 ms,
yet the animator's end callback still fires, so momentum-end still emits and **the sweep
still runs**. Device-confirmed. The animated choice is the only one that is simple at both
ends of that setting.

### F · The collapse sweep

[04](issues/04-collapse-scroll-sequencing.md) · [09](issues/09-four-views-sharing.md) ·
[11](issues/11-android16-device-tests.md) · [12](issues/12-collapse-sweep-scroll-drift.md)

**F1. Collapse strictly AFTER the list has settled at the top. Never before the jump, never
during it.** The two rejected orderings are not "less good", they are structurally unsafe on
this list:

- Mutating while scrolled moves MVCP's anchor, so FlashList issues a corrective `scrollBy`
  and sets an ignore-scroll-events flag for **100 ms**. That flag short-circuits the *entire*
  scroll handler — engaged indices are never recomputed and the render id never bumps — so
  the render stack is **frozen for roughly the first 40% of the jump**, rendering cells for a
  viewport the list has already left.
- It also collapses a section *at the fold*, which is exactly the configuration of the
  blank-screen defect in §Risks.

**F2. ⚠ The trap that makes this more than a preference:** `computeVisibleIndices()` is a
pure function of the last **observed** scroll offset. Sampling it synchronously after issuing
a scroll returns the **pre-jump viewport**. "Collapse before the jump" and "collapse right
after issuing the jump" are the *same bug with two entrances* — the second is what the
obvious code does by accident. The rule that prevents it is that the sweep only ever runs on
an event that **proves** the list is at the top.

**F3. Triggers — three, all funnelling into one function:**

| Trigger | Wiring | Note |
|---|---|---|
| momentum-scroll-end | `onMomentumScrollEnd` | also the animated jump's own arrival event (E2) |
| drag-end, velocity-gated | `onScrollEndDrag`, fire only if `abs(velocityY) < 0.01` | see F4 |
| the back jump | **nothing** | covered by trigger 1 |

Explicitly **not** triggers: mount, and the tab-change scroll reset (§I3). Arriving at the
top *is* the collapse gesture; a tab change is not that gesture.

**F4. The velocity gate is load-bearing and its direction matters.** At the top, a fling
that scrolls **down into the list** is at-top at finger-lift, so the at-top guard alone would
collapse everything as the user flings away. Device-measured: `velocityY -4.76`, gate closed,
no sweep. **Only the gate excludes this case.**

**F5. Accepted behaviour — an overscroll bounce at the top DOES sweep.** *(Driver decision,
2026-08-20.)* Pulling down while already at the top reports velocity `0` — the list cannot
scroll past the top, so there is no velocity to report — and the sweep runs. It is accepted:
the outcome is identical to the one a back press would produce, and the sweep can only touch
below-fold sections, so nothing visible moves. Rejected as unnecessary machinery: recording
the drag's starting offset via a fifth handler on all four lists to distinguish a bounce from
a genuine slow drag up to the top. **Reversible lever, if it annoys on device:** add
`onScrollBeginDrag` to the contract and require the drag to have begun below the top.

*Amended 2026-08-21 ([impl 03](../library-back-ladder-impl/issues/03-decide-sweep.md)).*
**An UNREPORTED drag velocity counts as flinging, not as settled.** §J4 types `velocityY`
optional and said nothing about `undefined`; the two errors are not symmetric — a missed sweep
is invisible and the next arrival at the top performs it anyway, while a wrong sweep destroys
the reader's expansions. So the absent value defaults to *fast*, not to *still*. For the same
reason the gate is written as `!(Math.abs(v) < THRESHOLD)` rather than `Math.abs(v) >=
THRESHOLD`: those differ on exactly one input, `NaN`, and under `>=` a `NaN` velocity would
count as **settled** and sweep.

⚠ **This puts F5 on the device list.** F5's accepted bounce-sweep rests on the platform
reporting `0` for a bounce; if it reports **nothing**, the safe default classifies the bounce
as a fling and the bounce-sweep silently never happens. F4's `-4.76` is device-measured, so
velocity *is* reported for drag-end on the rig — but the bounce's own value is inferred, not
measured. Confirm on device (§ ticket 08); if the bounce never sweeps, this is why, and the
feature is not otherwise harmed.

*Amended 2026-08-23 ([impl 08](../library-back-ladder-impl/issues/08-device-verification.md)).*
**Both halves of the question above are answered, and a THIRD sweeping gesture was found.**

- **The bounce DOES sweep — confirmed on device**, against a control (identical setup without
  the bounce left the below-fold section expanded). The platform reports it, the safe default
  never fires, and the ⚠ above is closed. F5 stands exactly as written.
- **A settled slow drag DOWN INTO the list also sweeps** — ticket 10's F-7, recorded there as an
  open question and now answered: **it is reachable, not theoretical.** The precondition needs no
  scrolling at all: at rest at the top, expand a VISIBLE section, then expand the one ABOVE it —
  the second expansion pushes the first below the fold while it stays open. A drag down into the
  list released at ~0 velocity then collapses it. I2 is not violated, so nothing visible changes
  and the loss is **silent** until the reader scrolls down. **F5's "reversible lever" above does
  NOT cover this**, because this drag *begins* at the top.

*(Driver decision, 2026-08-23: **ACCEPTED as it stands.** The precondition takes two deliberate
expansions near the top, the loss is one tap to undo, and nothing is mis-landed. **Revisit on
evidence** — a user reporting that they dislike it, or reporting that they hit it at all. If it
ever must be fixed, the lever is NOT the start-offset test above: the bounce moves the list UP off
the top while this moves it DOWN into the list, so gating the drag-trigger sweep on the drag not
having moved into the list separates the two where a start-position test cannot.)*

**F6. Sampling point: read visibility from the list's ref at the moment the sweep runs**, and
compare it against the section ranges by index overlap — `range.start <= endIndex && range.end
>= startIndex`. No `onViewableItemsChanged` and no `viewabilityConfig`. This is a
**behaviour-preserving** replacement for the parked branch's viewability plumbing, not merely
a simplification: FlashList's visible-range bounds count *any sliver* as visible, which is
exactly the semantics `itemVisiblePercentThreshold: 1` was chosen for. Delete that plumbing.

**F7. Recents is not exempt. It survives by position.** Driver ruling: *"keep what's at the
top."* The sweep stays a plain visible-set sweep with **no protected section**. This is safe
because the first item of every non-empty `BooksHome` is the Recently Added header — verified,
not assumed: the recency sort **orders without filtering**, so there is no state in which
authors exist but recents do not. **The accepted consequence, stated plainly:** if Recents is
expanded it fills the viewport, so back compacts every other section and leaves Recents open;
the user closes it with one tap on a header already on screen. Both alternatives
("collapse everything", "keep Recents and collapse all others") were rejected on the same
ground — each collapses a section at or above the fold, which is the blank-screen
configuration.

**F8. ⚠ A degenerate visible sample is a NO-OP, never a collapse.** The sweep must do nothing
when `computeVisibleIndices()` returns a degenerate range — `startIndex < 0` **or**
`endIndex < startIndex` — or when the overlap yields **no** sections. This is not defensive
decoration — it closes a live production hazard: the collapse helper iterates the **open** set,
not the visible set, so an empty visible set is a **collapse-EVERYTHING**, which wipes exactly
the sections F7 exists to protect. A drifted sweep was observed doing this on device. The
guard belongs in the sweep's decision function (§J4), where the knowledge is; the collapse
helper's contract stays unchanged so its existing tests stay meaningful. At the top of a list
with data the ranges tile the list, so index 0 always belongs to a section — an empty visible
set at sweep time is **always** a bug signal, never a legitimate state.

*Amended 2026-08-21 ([impl 03](../library-back-ladder-impl/issues/03-decide-sweep.md)), two
corrections to the wording above — the ruling itself is unchanged.*

- **The empty sample FlashList actually emits is INVERTED, not `startIndex < 0`.** Verified in
  `node_modules`: `ConsecutiveNumbers.EMPTY = new ConsecutiveNumbers(-1, -2)`, returned by the
  layout manager. So `endIndex < startIndex` is the half that catches the real thing and
  `startIndex < 0` catches it only incidentally. Both halves are kept — an inverted range that
  is *not* the sentinel can still overlap a section under F6's arithmetic and produce a
  confident, wrong collapse — but an implementation that pins only the originally-worded half
  is **not** guarded against the value the list really returns.
- **The `while the range list is non-empty` qualifier is REMOVED.** It could only ever *admit*
  inputs, never reject them, and every input it admits is the R5 shape exactly: empty `ranges`
  alongside a persisted non-empty `expanded`, which both H5's before-paint window and a fresh
  mount produce, and where the collapse helper wipes **everything**. Empty `ranges` implies an
  empty visible-id set, so the unqualified guard provably cannot suppress a legitimate
  collapse — the only thing it suppresses is a collapse-everything.

⚠ **This answers ticket [12](issues/12-collapse-sweep-scroll-drift.md) §6.3's fork, and it takes
NEITHER of the two options that ticket offered.** Anyone reading that ticket will find the choice
presented as the spec's to make, so the ruling is recorded here rather than left implicit:

- *"Gate the sweep on `offset >= 0`"* — **rejected.** It reasons about the wrong quantity. The
  drift was **negative** in all three of ticket 12's reproductions and **positive** in both of
  ticket 11's, and that sign asymmetry is unexplained (§Risks R4). A rule keyed to the sign of
  the offset is a rule keyed to the half of the phenomenon that happened to be reproduced last.
  It would also exclude a legitimately-negative resting offset at the top (B6).
- *"Make `computeRemainingOpen` iterate `visible` instead of `open`"* — **rejected, and note
  that as literally stated it does not work.** Both iteration orders compute the same
  intersection of `open` and `visible`; with `visible` empty, building the result from `visible`
  yields an empty set just as surely as filtering `open` does. The iteration order is not what
  causes the wipe. **What closes the hazard is the bail-out, not the loop** — which is this
  decision, placed in the sweep rather than in the helper. An implementer who "fixes" the
  iteration order will believe the hazard is closed and it will not be.

**F9. The sweep is gated by view identity, and that gate is load-bearing** — see H2 and §Risks
R5.

### G · The MVCP anchor fix — one line, and why it must not be deleted

[12](issues/12-collapse-sweep-scroll-drift.md) · [11](issues/11-android16-device-tests.md)

**G1. Call `prepareForLayoutAnimationRender()` on the list immediately before the sweep's
state update.** One line, a documented FlashList method, no timer, no constant, no new state.

**G2. What it fixes.** The sweep runs on the **native** momentum-end, while FlashList
re-anchors MVCP on its own **100 ms scroll-idle debounce** that every scroll event during the
jump keeps resetting. So at the instant the sweep mutates the data, MVCP's anchor is still a
**pre-jump item deep in the list**. MVCP re-finds it, sees content above it has shrunk, and
issues `scrollBy(diff)` — **moving the list off the top**. Proven to the pixel: the correction's
`diff` equalled the resting drift **exactly** in all three reproductions (−978.55, −1803.89,
−617.20 px). The call sets a flag FlashList checks at that very `scrollBy` guard, and clears
itself on the next commit.

**G3. Both consequences of the drift are real, and both are bad.** A **positive** drift leaves
`atTop` false, so back stops backgrounding the app — three presses to exit, four with the
rung. A **negative** drift keeps `atTop` true, but the follow-up sweep then runs at a negative
offset with an empty visible set, which is F8's collapse-everything.

**G4. Device A/B.** Fix off: **4 of 6** master jumps drifted in the reproducing configuration.
Fix on: **0 of 20**, across both prototype variants.

**G5. ⚠ It must carry the comment explaining why.** To a reader who does not know about the
anchor race the line looks like a no-op, and it is exactly the kind of line a future cleanup
deletes.

**G6. ⚠ Correct a claim ticket 03 made that this overturns.** *"At the top the anchor is index
0, so `diff === 0`"* is **FALSE at sweep time** — the anchor was observed pointing at a deep
pre-jump section while the list rested at offset 0; it becomes index 0 about 100 ms later.
That statement holds **only because this call suppresses the correction**, not because arrival
at the top makes it true. Ticket 03's invariant stops being an assumption and becomes enforced.

**G7. The precondition, for anyone reproducing it.** The stale anchor must **survive** the
mutation **and** content above it must change — which requires the anchor to be **deep in
already-collapsed territory with expanded sections above it**. In configurations where the
anchor is near the top, the sections above it are visible by definition and the sweep keeps
them open, so nothing above it can shrink. This is why the device matrix could not isolate it
before ticket 12.

**G8. Honest limit, carried forward.** The two drifts seen in ticket 11 were **positive**; all
three reproduced in ticket 12 were **negative**. Same correction, opposite sign, and the
positive geometry was never reproduced. The fix suppresses the correction outright so it covers
both signs, but the asymmetry is unexplained — see §Risks R4.

### H · Sharing the ladder across four views

[09](issues/09-four-views-sharing.md) · [02](issues/02-where-the-ladder-lives.md)

**H1. The ladder is told a NAMED view, never a toggle ordinal:**

```ts
export type LadderView = 'booksHome' | 'seriesHome' | 'booksGrid' | 'booksList';
```

The toggle's `0/1/2` is a **UI toggle position, not a view identity** — it is local state,
persisted nowhere, and both candidate futures for `BooksList` (replacing the grid, or joining
as a fourth option) are exactly the changes that renumber it. The screen maps its own state to
the name at the mount site; the ladder never learns the ordinal.

**H2. ONE parameterised ladder, gated by a capability set derived from that identity:**

```ts
const SECTIONED_VIEWS = new Set<LadderView>(['booksHome']);
```

The set gates **the intermediate rung AND the collapse sweep**. The two-rung ladder is the
same ladder with the gate closed. **The gate is not tidiness** — see §Risks R5 for what it
prevents.

**H3. The capability must come from identity, never from data.** The expanded-section set
persists across view toggles (nothing clears it), so "this view has sections" cannot be
inferred from that set being non-empty.

**H4. The section-range contract:**

```ts
export type SectionRange = {
  sectionId: string;
  /** index of the section's header item */
  start: number;
  /** index of the section's last item, INCLUSIVE */
  end: number;
};
```

Both consumers are pure index math and neither needs a pixel, which is what lets one contract
serve four differently laid-out lists: the sweep asks **overlap**, the rung asks
**containment** and then resolves one `y`. `end` is strictly derivable from the next section's
`start`, and is stored anyway as a **deliberate redundancy** so the contract does not depend on
that tiling invariant holding forever. Rejected: adding an `expanded` flag — it would duplicate
the expanded-section state into a second source of truth while the sweep still needs the setter
anyway.

*Amended 2026-08-23 ([impl 08](../library-back-ladder-impl/issues/08-device-verification.md)).*
"the rung asks **containment**" is superseded by D4's amendment. The rung now takes the MAXIMUM
header `y` at or below the offset, which is order-independent and needs no containment lookup.
**The contract itself is unchanged** and both fields are still required — but non-overlap is no
longer what makes the RUNG's lookup deterministic; a maximum needs no such guarantee. It remains
load-bearing for the SWEEP's overlap test, which is unaffected.

⚠ **What the range producer owes its consumers, stated so it can be tested rather than assumed**
*(added 2026-08-21; see [impl 02](../library-back-ladder-impl/issues/02-decide-back-press.md)'s
review)*:

1. **`end` is INCLUSIVE** — the index of the section's last item, not the next section's `start`.
   The exclusive reading is an easy mistake *precisely because* `end` is stored as redundancy
   rather than derived, and it fails in the quietest possible way: the viewport top resolves to
   the **previous** section, the rung lands on the wrong header, and every sanity check an
   implementer would think to write still passes.
2. **Ranges do not overlap.** The rung resolves the viewport top with a *first-match* containment
   lookup, so at most one range may contain a given index; with overlapping ranges it silently
   picks an arbitrary one. Ordering is **not** required — non-overlap is what makes the lookup
   deterministic.

Neither property is enforceable by the type, so both are pinned by boundary tests on the
consumer side.

**H5. ⚠ Ranges must be published BEFORE PAINT, from a layout effect — this is a contract
requirement, not an implementation detail.** The ladder reads index information from two
independent clocks: FlashList's own (updated inside its commit) and the published ranges. A
*passive* effect publishes after paint, leaving a window in which new rows are on screen but
the ranges still describe the previous array. The trigger is not a section tap — it is the
library store emitting mid-scan.

The failure is silent and reads as a jump bug rather than a staleness bug: a stale range
resolves to the **correct section id** with a **stale `start`**, so `expanded.has(id)` passes,
`getLayout(start).y` returns a real and plausible `y`, the sub-pixel guard passes — and the
rung lands on a section the user was never in. Every sanity check one would think to write
passes. The window and the trigger are **positively correlated**: the window is widest when the
JS thread is busy, which is when the store churns. The fix costs nothing — the ranges are
already computed during render — and precedent for a layout effect exists in the search hook.

**H6. `listRef` is a REQUIRED prop on all four lists; internal fallback refs are deleted.** It
serves both the list's `ref` and the existing tab-change scroll reset. An optional ref with an
internal fallback fails **silently** — a caller who forgets it gets a ladder that does nothing
and no error, which is precisely the state two of the lists are in today. Rejected: a merge
callback attaching both an internal and an external ref — writing to a ref inside a
prop-derived callback is the exact shape the React Compiler rejects.

**H7. `BooksList` is made UNIFORM with the other three — two obligations, not one.** It must
(a) accept the full contract, and (b) **mount its list unconditionally**, dropping its
"only if there are books" guard, so its empty case runs the same path as everyone else's
rather than satisfying §B by the accident of a null ref. Its empty component — dead code today
— becomes live as a side effect. Wiring it proves nothing today (nothing mounts it), but it
makes the diff to revive it **zero**, which is the guarantee this decision exists to give.

**H8. The contract is a NAMED SHARED TYPE, exported by a MODULE OF ITS OWN — `ladderList` —
and intersected by all four props types:**

*Amended 2026-08-21 ([impl 04](../library-back-ladder-impl/issues/04-shared-list-contract.md)).*
This originally read "exported by the ladder hook", written when that hook was assumed to be the
only ladder module that would exist. It is not: the contract is needed by the four lists in the
prefactor, **before** the hook exists, and putting it in the hook would also drag React Native
imports into the reach of `ladderDecisions.ts`, which must stay importable by jest. The type
therefore has its own module and the hook imports it. **Ticket 05 must import, never re-declare
or re-export** — two copies of this contract drifting apart is the precise failure H8 exists to
prevent. `LadderList` keeps its spec name even though it types a ref *handle* rather than a list.
The contract's fields are unchanged.

```ts
export type LadderListProps = {
  /** Owned by the library screen. Serves the ladder AND the tab-change reset. */
  listRef: React.RefObject<LadderList | null>;
  selectedTab: CustomTabs;
  onMomentumScrollEnd: () => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Sectioned views only. */
  onSectionRangesChange?: (ranges: SectionRange[]) => void;
};
```

Adding a field later then fails compilation on every list that has not kept up — **including
the one nothing mounts**. That is what stops the contract drifting away from `BooksList`.

**H9. What is deliberately NOT in the contract:** no header height, no per-view constant, no
"does this view collapse?" flag (capability comes from identity, at the hook), and **no
`onScroll`**. The screen's existing scroll handler stays exactly as it is, uncomposed —
**the ladder never sits in the per-frame path**, only on settle events.

### I · Invariants

These are the properties this design rests on. Each is stated so that a future change which
breaks one is a visible decision rather than an accident.

**I1. Exactly one list component is mounted at a time.** The single shared `listRef` depends on
it. It holds today because the views are mutually exclusive, and it survives a view switch
because React detaches every old ref in the mutation phase before attaching any new ref in the
layout phase — the ref goes old → null → new inside one commit with no JS interleaved, so the
ladder can never observe the null. Mutual exclusion by a toggle *or* by a density sub-toggle
both satisfy this. **A layout that mounts two lists at once (e.g. a tablet split) invalidates
the ladder and requires redesign** — it is not a drop-in change, and the question it raises
(*which pane does back act on?*) is a product question.

**I2. The sweep can only ever collapse BELOW-FOLD sections.** The sweep fires only when
`offset <= firstItemOffset`; at that offset **no list item is above the fold**, so "not visible"
and "below the fold" are the same set. This is the sentence that keeps the blank-screen defect
(§Risks R2) out of this feature — by construction, not by care. Any change that lets the sweep
run at another offset breaks it.

**I3. The tab-change scroll reset must stay `animated: false`.** Charting decision 4 (no sweep
on a tab change) is honoured *for free* only because an instant programmatic scroll emits **no
momentum events at all**, and because the instant arm's one-shot flag was deleted with it. A
future "polish" of that single call to `animated: true` would silently start firing a collapse
sweep on every tab change. State this beside that hook's existing warning. The same reasoning
covers a density sub-toggle and any view swap: a fresh mount emits no momentum event, and the
reset's first-render guard is per-instance.

**I4. `MainActivity` must remain the task root and keep calling `moveTaskToBack(false)`
directly.** The entire no-latch argument (A2) rests on that call returning `true` so RN's
`setEnabled(false)` is never reached. Anything that changes it re-arms the back latch
**app-wide**, not just here.

**I5. The sweep is idempotent** (E4), and **a degenerate visible sample is a no-op** (F8).

**I6. The ladder holds no state between presses** (C3). No counter, no timer, no last-rung
memory. If a future change needs one, it is a redesign of the ladder's core property, not an
addition to it.

### J · Modules and interfaces

[02](issues/02-where-the-ladder-lives.md) · [09](issues/09-four-views-sharing.md)

**J1. One screen-installed hook — `useBackToTopLadder` — called by the library screen. The
screen owns all ladder state; the lists receive refs and callbacks as props. No
`useImperativeHandle` on any list component.** This matches the pattern the screen already
establishes for its scroll handler and its expanded-section state, and it is close to forced:
the hook must return the two settle handlers for the screen to thread into the lists.

```
useBackToTopLadder({ listRef, view, sectionRangesRef,
                     activeGridSections, setActiveGridSections })
  -> { onMomentumScrollEnd, onScrollEndDrag }

reads at press time:  getAbsoluteLastScrollOffset(), getFirstItemOffset(),
                      computeVisibleIndices(), getLayout(i)
acts:                 scrollToOffset({ offset, animated: true })
                      prepareForLayoutAnimationRender() + setActiveGridSections(...)
```

*Amended 2026-08-23 ([impl 08](../library-back-ladder-impl/issues/08-device-verification.md)).*
The diagram's press-time read list is superseded in one entry: **`computeVisibleIndices()` is NOT
read on a back press.** Per D4's amendment the press reads `getAbsoluteLastScrollOffset()`,
`getFirstItemOffset()` (for the at-top predicate) and `getLayout(i)`. `computeVisibleIndices()`
is the SWEEP's alone. The `acts:` line is unchanged.

**J2. The hook mirrors EVERY input into a ref internally.** Callers pass ordinary values; the
module itself guarantees A6's empty-dependency registration, rather than leaving it to
call-site discipline a later edit can quietly break.

**J3. The ladder tracks nothing.** Offset and visibility are read **synchronously from the
mounted list's ref at the moment of the decision**. A screen-tracked scroll offset would go
stale across a view toggle — the old list unmounts, the new one mounts at offset 0, and **no
scroll event fires** — so the first back press would consume itself scrolling an
already-at-top list to the top: nothing visible happens and the app does not background, which
is the no-toast decision's failure mode with no jump. Do not reintroduce tracking.

**J4. The decision logic is pure and lives outside the hook.** *(Driver decision, 2026-08-20.)*
One new pure helper module exporting two decisions over a snapshot of plain numbers:

```ts
type LadderSnapshot = {
  view: LadderView;
  drawerOpen: boolean;
  offset: number;
  firstItemOffset: number;
  expanded: Set<string>;
  ranges: SectionRange[];
  /** LAZY — must not be called before the offset predicate passes (B7). */
  visible: () => { startIndex: number; endIndex: number };
  layoutY: (index: number) => number | undefined;
};

decideBackPress(s: LadderSnapshot | null)
  -> { kind: 'decline'; reason: 'drawer' | 'no-list' | 'at-top' }
   | { kind: 'scrollTo'; offset: number; rung: 'section' | 'master' };

decideSweep(s: LadderSnapshot, trigger: 'momentum' | 'drag', velocityY?: number)
  -> { kind: 'none'; reason: 'not-sectioned' | 'not-at-top' | 'flinging' | 'no-visible-sample' }
   | { kind: 'collapse'; open: Set<string> };
```

The hook becomes IO only: **gather → decide → execute**. `visible` is a thunk rather than a
value so B7's ordering is preserved *inside* the tested unit and can be asserted directly.
The existing collapse helper stays exactly as it is and is called by `decideSweep`, keeping its
own tests meaningful.

Two exports rather than one, deliberately: a **wrong landing** and a **wrong collapse** are
different failures with different owners, and folding them into one return type puts
assertions about scroll offsets next to assertions about collapse behaviour.

Two shapes were weighed and rejected, both recorded so they are not re-proposed:

- **One reducer over an event union** (`decideLadder(event, snapshot)`) — literally the fewest
  seams possible, and rejected for the reason directly above: one return type and one suite for
  two unrelated failure classes.
- **A thin extraction** — keep the collapse helper as the only pure surface and add a rung-target
  function beside it, leaving the at-top predicate, the drawer and view gates, the velocity gate
  and F8's guard inside the hook. Smallest diff, and rejected because those guards are precisely
  the parts device work proved load-bearing (F4, F8, H2/R5); leaving them in the untestable layer
  puts the tests where the risk is not.

**J5. `decideBackPress` takes `LadderSnapshot | null`. The absence of a snapshot IS the absence
of a list.** *(Amended 2026-08-21,
[impl 02](../library-back-ladder-impl/issues/02-decide-back-press.md).)* `decline('no-list')` is
otherwise **unreachable**: `offset` and `firstItemOffset` are non-nullable and the `visible` /
`layoutY` thunks can only be built from a live ref, so constructing a snapshot at all already
implies a mounted list, and no field is left to express "no list". The two alternatives were
weighed and rejected — threading `| null` through every arithmetic site inside the function, and
a `hasList: boolean` flag, which admits the impossible state of `hasList: false` sitting beside a
real offset and live thunks and forces the hook to fabricate numbers it does not have.

**One behavioural consequence, stated plainly:** a no-list snapshot is now reported as
`'no-list'` even with the drawer open, where a list-first-then-drawer ordering would have said
`'drawer'`. Both **decline** — only the diagnostic reason differs, and the combination is
unreachable in practice, since the library screen stays mounted behind an open drawer.

`decideSweep` keeps its non-null parameter: a settle event cannot fire without a mounted list.

---

## Testing Decisions

### What makes a good test here

**Test the decision, not the wiring.** Both exported decisions are pure functions of plain
numbers and sets. Assert the returned value. Do not assert that an accessor was called, that a
particular scroll ran, or that an intermediate structure has a shape.

This is not stylistic. The jest environment here was **node, with no React Native preset**, and
`@testing-library/react-native` was not installed — anything that imported React Native, a
native module or a screen **could not be tested at all** at the time this was written. That
constraint is why §J4 exists in the shape it does: the ladder's judgement is extracted precisely
so it can be tested without a device, and the IO left behind is deliberately too thin to hold a
decision. *(Amended 2026-08-22 — corrected from a false "jsdom" claim; see
[impl 10](../library-back-ladder-impl/issues/10-branch-review-disposition.md).)* A second `rn`
jest lane (`jest-expo/android` + RNTL) was later added
([spike/rn-jest-testing](../library-back-ladder-impl/README.md), merged onto this branch), so
hooks, components and screens are testable today — see
`docs/testing/jest-projects-and-rn-tests.md`. §J4's extraction is not made obsolete by that: the
reason it exists — a wrong landing and a wrong collapse are different failures with different
owners — stands independently of what jest can reach.

The repo's dominant pattern is exactly this — a pure helper plus a jest suite, as with the
relative-seek, chapter-skip and collapse helpers — and this feature follows it rather than
inventing a seam.

### Restore the collapse helper's tests

⚠ **They are not currently green — they do not exist on the prototype branch.** The collapse
helper was cherry-picked onto `proto/back-ladder-rung-ab` **without** its five-case jest suite,
which still lives only on the parked `fix/collapse-offscreen-lists-onMomentumScrollEnd` branch.
Bring the suite along with the helper. It covers: drops non-visible open sections; returns the
**same reference** when nothing collapses (the React bail-out this feature relies on); same
reference when the open set is empty; retains a protected section when one is passed; and
defaults to protecting nothing — which is the mode this feature uses (F7).

### `decideBackPress` — the cases

**Declines**

1. Drawer open, list scrolled deep → `decline('drawer')`.
2. No mounted list → `decline('no-list')`.
3. At rest at visual top: `offset 0`, `firstItemOffset 38` → `decline('at-top')`.
4. **Boundary:** `offset === firstItemOffset` → `decline` (the predicate is `>`, not `>=`).
5. **Negative offset** (overscroll, or post-drift): `offset -978`, `firstItemOffset 38` →
   `decline('at-top')` — B6's inequality.
6. **Ordering (B7):** on every declining case, a `visible` thunk that **throws** must not be
   called. This is the test that pins the throw-avoidance rule rather than leaving it to a
   comment.
7. Empty list reading `offset 0` → `decline` (B5's device-corrected reading), and the same
   snapshot with `offset === firstItemOffset` → `decline` (the pre-device reading, still
   handled).

**Master top**

8. Non-sectioned view, scrolled deep → `scrollTo(0, 'master')` **and never `'section'`**, even
   when `expanded` and `ranges` are non-empty and would otherwise select a rung — the H2 gate.
9. Sectioned view, viewport top inside a **collapsed** section → `master`.
10. Sectioned view, viewport top inside an **expanded** section whose header is at or within
    1px of the fold → `master` (D4's sub-pixel guard).
11. Visible sample overlapping **no range at all**, offset inside an expanded section →
    `section`. *(Ninth amendment — inverted. This case previously read "No range contains
    `startIndex` → `master`", which specified D-1.)*
12. `layoutY` returns undefined for the header → `master`.
13. **Degenerate** visible range (`startIndex < 0`), offset inside an expanded section →
    `section`. *(Ninth amendment — inverted, same reason. F8's degenerate-sample rule is the
    SWEEP's alone.)*
14. Viewport top inside an expanded section whose header is index 0 (`y === 0`) → `master`,
    by degeneration rather than by special case (D2's self-consistency check).

*Amended 2026-08-23 ([impl 08](../library-back-ladder-impl/issues/08-device-verification.md)).*
Cases **11** and **13** are INVERTED above: both asserted `master` on the strength of a
visibility sample the rung no longer reads, so as written they specified D-1. Their value is not
lost — restated as `section`, they now pin the structural claim that **the sample cannot
influence the rung at all**, which is stronger than what they asserted before. Case **10** is
unaffected and still correct. **One case is ADDED to this group** (unnumbered, to avoid
renumbering the rung cases below):

- **The pixel-grid snap (D-2).** Viewport top a FRACTION of a pixel BELOW an expanded section's
  header, with a further expanded section below it → `master`, **never** a climb to that lower
  section. This is the case a strict `y <= offset` gets wrong, and it is not reachable from a
  hand-written offset: it arises because the landing is quantized and the layout `y` is not.

**The section rung**

15. Viewport top inside an expanded section with header `y = 4820`, `offset = 6421`,
    `firstItemOffset = 38` → `scrollTo(4820, 'section')`. **Assert the exact number.** A
    result of `4858` is the `y + firstItemOffset` bug that hid the header under the search
    bar on device (D2) — this assertion is the regression test for it.
16. **The nearest reading (D3):** viewport top is inside a *later* expanded section while an
    *earlier* expanded section (Recently Added at index 0) is also open → the rung targets the
    **containing** section, not index 0. Under the rejected earliest reading this returns
    `master`, making the rung a dead press.
17. **Re-derivation (C3):** feed the snapshot that results from case 15's landing (`offset =
    4820`) back in → `master`. No ordering state, and the ladder cannot get out of step.

### `decideSweep` — the cases

1. Non-sectioned view, at the top, with a stale non-empty `ranges` and a non-empty `expanded`
   → `none('not-sectioned')`. **This is the R5 regression test** — ungated, this input
   collapses the user's expansions from another view.
2. Sectioned view, not at the top → `none('not-at-top')`.
3. Drag trigger with `velocityY = -4.76` at `offset 0` → `none('flinging')` — F4's
   device-measured case, and the gate is the only thing that excludes it.
4. Drag trigger with `velocityY = 0` at the top → `collapse` — F5's accepted bounce.
5. **Degenerate sample:** at the top, `visible()` returns `startIndex < 0` →
   `none('no-visible-sample')`.
6. **Empty overlap with non-empty ranges:** at the top, visible range overlaps no section →
   `none('no-visible-sample')`. **This is the G3/F8 regression test** — without it this input
   is a collapse-everything.
7. **Recents survives by position (F7):** at the top with Recently Added visible and three
   author sections expanded below the fold → `collapse` with a set containing only the
   Recently Added id.
8. Nothing to collapse (every open section visible) → the returned set is the **same
   reference** as the input, so React bails out of the re-render.
9. Empty `expanded` set → same reference, no collapse.
10. **Idempotence (E4/I5):** feeding the result of case 7 straight back in yields the same
    reference and collapses nothing. This is the property that makes the double momentum-end
    harmless.
11. Overlap arithmetic at the boundaries: a section whose `end` equals `startIndex`, and one
    whose `start` equals `endIndex`, both count as visible (F6's any-sliver semantics).

### What jest will never cover here, and how it is accepted instead

Everything that requires a real layout: the actual `firstItemOffset` values, whether an
animated programmatic scroll really emits momentum-end, MVCP's correction, the animator scale,
and every user-visible motion outcome. Neither jest lane has a native renderer, so a layout
measurement returns nothing meaningful. *(Amended 2026-08-22 — corrected from a false "jsdom"
claim, same as §903; see [impl 10](../library-back-ladder-impl/issues/10-branch-review-disposition.md).)*

These are accepted by **device checks, and the implementation effort must re-run them on the
real build** — they were passed on a throwaway prototype, not on shipping code:

| Check | What it confirms |
|---|---|
| The latch test — scroll, back, back, reopen, push a screen, back must pop; five rounds in one process, alternating gesture and button | A2. The signature of failure is that back stops reaching JS at all |
| Momentum-end on a clean back press, and on a press that interrupts a fling | E2 and E4 — once when clean, twice when interrupting |
| The per-view `firstItemOffset` readings | B4 — expect 38 / 38 / 44, and **50 for `BooksList` if H7 makes it mountable, which no device has yet measured** |
| The rung landing against the search bar | D2 |
| A deep jump on a preview build against a real library | E5's smear question |
| Animator duration scale set to `0` | E6 — the jump is instant and **the sweep still fires** |
| Ticket 12's drift recipe, fix on and fix off | G1–G4. The reproducing configuration is: Recents collapsed, the first several sections expanded, everything after collapsed; fling deep into the collapsed region, then press back mid-fling |
| Drawer open, keyboard up, and each modal route | A7, A8 |

Two notes on running them. **A preview build is mandatory for anything visual** — a debug
build serves assets over Metro, so asset behaviour is invisible. And **the sweep is visually
silent by design**, so "nothing happened" is the expected observation: confirm it by scrolling
down afterwards to find the sections collapsed, not by watching the moment of the sweep.

---

## Risks

Carried from [07](issues/07-reassess-the-flicker.md), [08](issues/08-blank-screen-large-section.md),
[11](issues/11-android16-device-tests.md) and [12](issues/12-collapse-sweep-scroll-drift.md).

**R1 — Card reload after the collapse. Known, accepted, cosmetic.** Book cards briefly reload
after the sweep. The driver tested the real candidate mechanism — this feature's sweep and
animated jump, not the old parked branch — and judged the reload **small and expected**. The
mechanism named in the older memory topic (a fade transition replaying on recycled cells) is
almost certainly still the cause; what was wrong was its **severity**, recorded there as a
blocker. **This spec is not gated on root-causing it.** Do not fix it speculatively: the card
component is used by *all* library lists, so a change there has app-wide blast radius.

**R2 — The blank-screen defect is unreachable by construction, and stays a pre-existing
main-branch bug.** Auto-collapsing a 100+ book section that is at or above the fold blanks the
screen until a scroll forces a re-render. This feature never does that (I2). The driver
confirmed the blank only ever followed *auto-collapsing an above-fold section* — a different
action from merely scrolling past one. **The risk is not the bug; the risk is a future change
that breaks I2** and silently makes it reachable. Full characterisation is out of scope and
recorded separately.

**R3 — The rung was once observed landing a few rows past the header. Unreproduced.** Seen
once on device, with a numeric corroboration, and never reproduced despite ticket 12 looking
directly for evidence of layout-estimation error (every non-drifting correction had identical
old and new `y` to full float precision). H5's layout-effect requirement is the most likely
explanation and closes the most plausible route to it. **Watch for it during implementation**;
if it recurs, the range-publication timing is the first place to look.

**R4 — The drift's sign asymmetry is unexplained.** Ticket 11's drifts were positive; ticket
12's three reproductions were negative. G1 suppresses the correction outright so it covers both
signs, and 20 trials produced zero drift — but the positive geometry was never reproduced, so
"fixed" rests on the mechanism being the same rather than on both signs being observed clean.

**R5 — Wiring the non-sectioned views ARMS a latent bug, and only the H2 gate disarms it.**
The section-range ref is never emptied and the expanded-section set persists across view
toggles, so on another view the ranges would be matched against the **wrong list's indices**;
combined with the collapse helper iterating the open set, the mismatched result is a
**collapse-everything**. Concretely: expand two authors on the books view, toggle to Series,
scroll, land at the top — and the user's expansions are silently wiped while they are looking
at a different screen. The prototype never exhibited this only because the other views received
no ladder props at all. **H2's gate and F8's guard are what close it, and case 1 of the
`decideSweep` suite is what keeps it closed.**

**R6 — `BooksList`'s numbers are unmeasured.** Its predicted `firstItemOffset` of 50 comes from
inspection; nothing mounts it, so no device has ever read it. The design is immune (B1 reads
the value live), but the prediction itself is unverified until something mounts that list.

**R7 — Screen readers are unexamined.** See §Out of Scope.

---

## Out of Scope

- **Every screen other than the library.** Applying the ladder to series detail, the player,
  settings or any pushed route is a separate effort. The library screen is the only place where
  back already means "background the app", which is why it is the only place a press is
  available to spend.
- **Unwinding search text, selected tab or view toggle via back.** Scroll position is the only
  rung.
- **TalkBack and screen-reader announcements.** *(Driver decision, 2026-08-20.)* A back press
  that moves the viewport without changing screen may warrant an announcement; nothing here was
  ever tested with a screen reader, so specifying an announcement string now would be invention
  rather than a decision. **Filed 2026-08-20 as the memory topic
  `talkback-back-ladder-announcement`**, deliberately *not* as a ticket on this closed map:
  the driver expects it to land inside **a full accessibility feature exploration** rather than
  as a one-off patch, alongside the open font-scale clipping defects. ⚠ **Do not "fix" it with a
  quick `announceForAccessibility` call** — whether Android already announces a programmatic
  scroll has never been observed on a device, so a patch would be guessing at duplication; a
  TalkBack pass on the shipped ladder comes first. Note
  the *reduced-motion* half of this question **is** decided and is not open: E6, do nothing.
- **Root-causing the card reload (R1)** or the blank-screen defect (R2). Both are recorded
  separately; neither gates this spec.
- **Reviving or retiring `BooksList` as a product decision.** H7 decides only that it conforms
  to the contract, so that reviving it is a zero-diff change.
- **Building the grid ↔ list density sub-toggle.** It changes nothing structural — one list is
  still mounted at a time (I1), identity becomes a function of two state values at the mount
  site (H1), and the differing `firstItemOffset` is already handled (B4). The ladder imposes
  **no constraint** on whether the swap preserves scroll position. Shipping it is a separate
  effort.
- **A two-stage jump, a distance-dependent jump rule, or an instant jump variant.** All three
  are decided against on device evidence (E5); they are recorded as unbuilt, not as pending.
- **Any toast, haptic, or "press back again to exit" affordance.**
- **A tablet split layout mounting two lists at once.** It invalidates I1 by design and needs a
  product answer before an engineering one.

---

## Further Notes

### The prototype, and what must die with it

`proto/back-ladder-rung-ab` is **throwaway**. It answered three questions no amount of source
reading could — does the intermediate rung earn its place, is animated better than instant, and
what actually causes the drift — and it is expected to be deleted rather than merged.

⚠ **Four artifacts on that branch must never reach `main`:** the prototype ladder hook, the
probe/logging helper it uses, the on-screen debug chips, and the **FlashList patch** added
purely to instrument MVCP. The patches directory is shipped code; a diagnostic patch left there
would be applied on every install.

The implementation effort should treat the prototype as **evidence, not as a starting point**.
Two pieces of it are worth copying almost verbatim, though: the rung's landing arithmetic with
its comment (D2), and the MVCP suppression call with its comment (G1/G5).

### The parked branch

`fix/collapse-offscreen-lists-onMomentumScrollEnd` is where the collapse helper and its tests
live. Two things change when it is resumed, and one is easy to miss:

- **The helper survives intact; the viewability plumbing is deleted** — and the swap is
  *behaviour-preserving*, which is worth knowing before deleting working code (F6).
- **⚠ The trigger predicate NARROWS.** That branch sweeps at **every** scroll stop, wherever
  the user is. This feature sweeps **only at the top**, and that narrowing is what makes I2
  true. **Do not resume its semantics wholesale.**

### The evidence rig

Everything device-confirmed here was run on a **Pixel 7 Pro, Android 16 / SDK 36, gesture
navigation, animator scales 1.0**, against a real **355-book** library, on both a debug build
with Metro and a `--profile preview` build. 15 device tests were defined; **14 passed, one was
refuted** (B5), and the run turned up the drift defect that ticket 12 then root-caused.

### Volumes, so nothing is over-built

This is a small feature carrying a lot of argument. What actually gets written: one hook, one
pure helper module with two exported decisions, one small shared type block, a props change on
four list components (one of which also loses a conditional mount), a layout-effect change on
one of them, and one line with a long comment. Everything else in this document exists to stop
a future edit undoing it.

### Where this lives

Written to `.scratch/library-back-ladder/spec.md`, per the repo's local-markdown tracker
convention. ⚠ **The map's findings live on `main`**; the prototype branch's copies are stale by
design and die with the branch. Committed to `main` on 2026-08-20 (`58b3855`) alongside them.
