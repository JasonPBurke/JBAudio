# Declare the player seam that already exists

Status: ready-for-agent

Raised: 2026-08-25, from the architecture review of 2026-08-23 (candidate 01).
Scoped by a grilling session the same day; every decision below was put to the
driver and ruled on individually. The rulings are the spec — where this document
and the architecture review disagree, this document wins, and the disagreements
are listed under **Further notes**.

## Problem statement

Thirty-four non-test files reach for `react-native-track-player` by name. No
module owns the Player's interface, so RNTP's vocabulary — tracks, queue
indices, playback states — is the app's vocabulary, everywhere, including in
list rows and in persistence.

Three consequences, in the order they cost us:

1. **A quirk has nowhere to live.** RNTP's seek clamp, its `updateOptions`
   array-replacement behaviour, its `commandStarted` latch and the
   foreground-service demote patch are all things we have had to learn and fix
   once each. There is no file where the next one belongs, so the next one will
   be learned again at whichever call site meets it.
2. **`Track` carries one field through an `any` hole.** RNTP's `Track` is
   declared with an index signature of `any`, and the app adds no module
   augmentation. Thirty-one call sites read `activeTrack?.bookId` off it. Every
   one of those reads is unchecked: a misspelling compiles clean and yields
   `undefined`. `tsc` is green at zero errors and cannot see this.
3. **Two words for two different things, both spelled the same.** The Book the
   Player has loaded and the Book the app has decided to play are separate
   facts that disagree during a switch. Both are called `activeBookId`, in two
   stores, and five components read both without distinguishing them.

## Solution

One module owns RNTP. Nothing else may import it, and a lint rule says so.

The module is an **adapter**, not a domain interface: it speaks RNTP's
vocabulary and makes no decisions. Domain vocabulary lives above it, in the
modules that already hold it. The fake that nine test files hand-roll today
keeps faking RNTP and therefore keeps working unchanged, one layer below the
adapter — which also means the adapter is exercised by the existing suite
rather than being the one module with no coverage.

One read is deliberately not a passthrough. The adapter answers **which Book is
active** with a `bookId`, never a `Track`. That collapses twenty call sites,
removes RNTP's `Track` type from the read path entirely, and puts a real type on
the app's most-used identifier for the first time.

## User stories

1. As a maintainer, I want exactly one module to import the Player library, so that a newly discovered quirk has an obvious home instead of being fixed at whichever call site met it.
2. As a maintainer, I want that rule enforced by lint rather than by convention, so that the seam cannot quietly erode the next time someone needs a Player call in a hurry.
3. As a maintainer, I want the lint rule staged so its allowlist names precisely what has not yet been migrated, so that the migration needs no separate tracking issue.
4. As a maintainer, I want to ask "which Book is active?" and receive a typed `string | null`, so that a misspelled field name fails the build instead of silently yielding `undefined`.
5. As a maintainer, I want RNTP's `Track` type absent from the read path, so that its `any` index signature stops laundering unchecked property access into twenty files.
6. As a maintainer, I want `Track` to survive on the write path, so that building a Queue from a Book stays honest about the structure it is building.
7. As a maintainer, I want the adapter to make no decisions at all, so that "does this module decide something?" stays a question with a one-word answer.
8. As a maintainer, I want the existing player tests to keep passing without edits, so that the refactor's risk is visible as a diff in source and nowhere else.
9. As a maintainer, I want the fake to keep modelling native semantics rather than the adapter's, so that it keeps catching the landing-spot defects a call-assertion mock cannot.
10. As a maintainer, I want the adapter covered by the existing suite as a side effect, so that the one new module is not the one untested module.
11. As a maintainer, I want components to stop importing a native module, so that a list row's dependencies describe a list row.
12. As a maintainer, I want a single place where the Player library's enums are known, so that a version change presents one surface rather than fifteen.
13. As a maintainer, I want the reactive surface funnelled through the store mirror that already exists, so that the app has one answer to "which Book is playing?" instead of twelve files subscribing for the same one field.
14. As a maintainer, I want `Active Book` and `Requested Book` distinguished in the glossary, so that the next person to read `activeBookId` learns there are two of them before they merge them.
15. As a maintainer, I want the glossary distinction recorded now and the rename booked separately, so that a rename does not land in the same diff as a behavioural change.
16. As a maintainer, I want the Queue-shape question left untouched here and handed forward explicitly, so that the follow-up work inherits a described problem rather than rediscovering it.
17. As a maintainer, I want the layering violation in persistence named in place, so that its survival reads as a decision rather than as something missed.
18. As a maintainer, I want the RN test lane repaired before the risky half lands, so that the automated coverage under twelve migrated files is actually running.
19. As a maintainer, I want the test-count gate written down with the flag that makes it work, so that the next person does not read a watchman crash as a regression.
20. As a maintainer, I want each commit gated by the device pass that matches its risk, so that a Remote-control regression and a stale-render regression are never bisected through one diff.
21. As a maintainer, I want the chapter-boundary device checklist derived from the code before the code changes, so that the pass tests what should update rather than what looks fine.
22. As a maintainer, I want both runtime Queue shapes exercised in each device pass, so that a defect that only appears in chapter-relative Position is not certified by an absolute-Position book.
23. As a maintainer, I want the decision recorded as an ADR, so that a future reader who finds `Track` banned on reads and permitted on writes does not read it as an oversight.
24. As a listener, I want the notification, lock screen, headset and Android Auto controls to behave exactly as before, so that a refactor I did not ask for costs me nothing.
25. As a listener, I want seek, chapter skip, jump forward and jump back to land where they landed before, so that the boundary behaviour I have learned still holds.
26. As a listener, I want the sleep timer's fade and its end-of-chapter option to keep working, so that a change to how the app talks to the Player does not reach my bedtime routine.
27. As a listener, I want the mini player, chapter list, progress bar and time-remaining to update when a chapter turns over, so that the screen keeps agreeing with what I am hearing.
28. As a listener, I want playback rate to survive the change, so that my speed setting is not quietly reset.
29. As a listener, I want no change at all that I can perceive, so that the only evidence of this work is that the next Player bug is fixed faster.

## Implementation decisions

### The adapter

- **One module owns RNTP**, named for the library it fronts rather than for a
  domain it does not own. The word "player" already denotes six things in this
  repo — a screen, three components, a settings module and the engine — so the
  adapter does not take it.
- **The adapter is mechanical.** RNTP's vocabulary, RNTP's semantics, no
  decisions. Anything that decides belongs above it. This mirrors the rule
  `seriesQueries` states in its own header: the IO half must not make decisions.
- **The adapter is not a deep module and is not presented as one.** Its
  justification is that it is the sole import site and the sole substitution
  point. That is enough; claiming more would invite someone to "fix" it later by
  giving it responsibilities.
- **Layering, not replacement.** Domain vocabulary already exists above the
  adapter in the modules holding relative seek, chapter skip, book play,
  restore, playback rate, remote play/pause, footprints and player setup. Those
  keep their names and their jobs; they change only where they get their Player
  calls from.

### The surface

Ratified in full. Nineteen functions, one subscribe, seven re-exports, covering
all twenty-three RNTP methods currently in use.

- **Reads split by what is being read.** *Active-item* reads collapse:
  `getActiveBookId(): Promise<string | null>` replaces `getActiveTrack` at every
  one of its twenty call sites, none of which reads any other field.
  *Queue-structure* reads stay structural — the queue read returns items because
  relative seek and chapter skip need per-item durations, one caller needs the
  first item's `bookId`, and four callers need the length.
- **`getActiveTrack` is not exported.** No escape hatch. An unused escape hatch
  is how the collapse gets quietly undone; if a caller ever needs more than
  `bookId`, it gets added then, with a reason.
- **`Track` survives on the write path.** Building a Queue from a Book genuinely
  constructs items, and the add call genuinely takes them. Reads collapse,
  writes stay structural. This asymmetry is the ADR's central content.
- **Enums are re-exported, not redefined.** Re-exports stay identity-equal to
  RNTP's, so existing state comparisons keep working with zero risk. Redefining
  them would be a domain-language improvement and a subtle equality-bug
  generator.
- **Event subscription is a passthrough**, and the policy about who may
  subscribe is a documented rule rather than a type constraint. The Reanimated
  progress hook writes shared values specifically to avoid React re-renders;
  any design that treats "subscribe" as a smell to eliminate will fight that
  module and lose.

### Substitution

- **Module mock, relocated.** The adapter is a module of exported functions.
  There is no dependency injection and no settable singleton. We have exactly
  one real alternative implementation, it already substitutes fine at the module
  loader, and paying for injection to solve a problem `jest.mock` already solves
  is speculation.
- **The fake sits below the adapter, not at it.** It keeps faking RNTP. Tests
  keep mocking RNTP. The real adapter runs on top of the fake — so it is
  exercised by the existing suite, and the existing suite needs close to no
  edits, because a call that used to reach RNTP directly now reaches it one
  frame deeper and the spy still fires.

### Enforcement

- **`no-restricted-imports`, staged.** Stage one bans the default export and the
  enums and types, all of which the adapter re-exports, while still permitting
  the React hooks. Stage two, after the reactive migration, bans the module
  outright.
- **The allowlist is the migration tracker.** What remains permitted is exactly
  what remains unmigrated, and it shrinks to nothing when the reactive contract
  lands (ticket 10). No TODO comment, no separate ticket.
- **Test directories are exempt**, because that is where the fake plugs in. The
  rule therefore reads "only the adapter and its tests", which is honest.
- The rule does not see `require()` (nothing in source uses it for RNTP) and
  does not see `jest.mock` string literals. Both are acceptable given the
  exemption above.

### The reactive surface

- **The store mirror that already exists takes ownership.** One component is the
  only caller of RNTP's hooks; it writes the **Active Book** and the playing
  state into the player-state store. Twelve files read selectors instead of
  subscribing.
- **This is justified by measurement, not preference.** All eleven hook call
  sites read exactly one field off the Track, and the sticky-last hook's two
  consumers immediately take `bookId` off its result too. The hook that returns
  a whole Track for one string is deleted; its "last non-null" behaviour becomes
  a store field that does not clear.
- **A real behavioural change, deliberately accepted.** The RNTP hook re-renders
  on every active-track change, including chapter-to-chapter within one Book. A
  selector on the Active Book re-renders only when the Book changes — strictly
  fewer renders, and the direction the player-state store's own docblock already
  argues for. Any site depending on re-render-at-chapter-boundary goes stale,
  which is what the device checklist exists to catch.
- **A mount invariant is created and must be written down.** The RNTP hooks work
  in any component; store selectors work only while the syncing component is
  mounted. It is in the root layout today. That becomes an invariant rather than
  an accident.

### Glossary

Four terms added to the domain glossary in this pass: **Player**, **Active
Book**, **Requested Book**, **Remote control**.

- **Active Book** is an observation — what the Player reports it has loaded. It
  lags a switch.
- **Requested Book** is an intent — what the app has decided to play. It is set
  when the user asks, before the Queue is built, so it leads a switch.
- These are **not duplicates and must not be merged.** They are written by
  different callers, they disagree for the length of a switch, and the switch
  logic reads the intent one specifically to tell "same Book" from "a switch".
  Five components read both today without distinguishing them.
- **Remote control** names the inbound direction: the OS driving the app, which
  is the opposite of everything else in that glossary section. Nine listeners
  handle it. Conflating the two directions has already hidden one defect.
- **The rename is booked separately.** The glossary entries cost nothing and are
  the actual fix, because the defect here is conceptual. Renaming the two
  fields touches the same components as the reactive migration, and a rename
  tangled with a behavioural change is exactly what the commit split exists to
  prevent.

## Testing decisions

**What makes a good test here.** The existing player suite is already the model
and the reason this refactor is cheap. It asserts on the **landing spot** — where
playback ends up — rather than on which calls were made, because a call
assertion is satisfied by a nonsense target while the listener ends up in the
wrong place. The fake earns that by simulating the two native behaviours that
turn a bad target into the symptom a user reports: the seek clamps into the
active item, and a skip resets position to zero. Those are native semantics,
transcribed rather than invented — the same discipline the WatermelonDB fake
follows.

- **The existing player tests are the regression suite**, unchanged. Ten files,
  eighty-one tests. Because the fake stays below the adapter, their mock blocks
  and their assertions both keep working; the subject's imports change and the
  tests do not notice. **Any test that does break is signal, not chores** — it
  means a call moved rather than being redirected, and it should be investigated
  before being edited.
- **The adapter is covered transitively** by those eighty-one tests. Its one
  piece of logic — the active-Book read — sits on the path of most of them. It
  gets no dedicated suite; a suite asserting that a passthrough passes through
  would test the implementation, not behaviour.
- **The RN lane must be repaired first.** It is currently dead: all three of its
  suites fail to start because a transitive Expo dependency is nested rather
  than hoisted, and the fast lane reports green while it happens. The reactive
  migration touches twelve files, most of them React components, and that lane is the only
  automated thing in this repo that can render one. Repairing it is its own
  commit, before either migration — it is not ours to bundle into a refactor,
  and it re-establishes a baseline against which "unchanged" means something.
- **The test-count gate must be written with the flag that makes it work.** The
  bare test command crashes in watchman on the development machine before
  running anything. The gate is the run with watchman disabled.
- **Baseline at the time of writing:** 914 tests, 71 of 74 suites, `tsc` clean,
  `eslint` clean — with the RN lane's three suites failing to start. Expect the
  post-repair baseline to be higher, and use that as the comparison.
- **RESOLVED — the post-repair baseline is 954 tests, 74 of 74 suites**, `tsc` 0,
  `eslint` 0 errors. See [ticket 01](issues/01-repair-rn-jest-lane.md). This is the
  number every later ticket measures "unchanged" against.
  ⚠ Two additions the spec did not anticipate, both binding on tickets 02-12:
  **(a)** the gate must be run from a **clean tree and a cold cache** —
  `npm ci && npx jest --watchman=false --clearCache && npx jest --watchman=false` —
  because a warm transform cache produced a fully convincing false green during the
  repair; **(b)** the repair moved the toolchain to **jest 29.7.0** (jest-expo 55 is
  a jest-29 package and jest 30's runtime is what broke the lane) and bumped the
  native `react-native-worklets` 0.7.2 -> 0.7.4, so ticket 08's device pass needs a
  real `npm run android`, not a Metro reload.

**Device verification — two passes, matched to two risks.** Neither risk is
reachable by the jest lanes, and they are different risks, which is the argument
for keeping the commits separate.

- **After the imperative commit: the Remote control surface.** Notification
  transport, lock screen, headset buttons, Android Auto, remote seek, remote
  jump forward and back, sleep-timer duck and fade, playback rate. This is where
  the largest untested file lives and where its nine inbound listeners are.
- **After the reactive commit: chapter-boundary render freshness.** An
  enumerated checklist, **written from the code before the code changes**, naming
  for each migrated site what visibly changes when a chapter turns over. A stale
  render looks like a correct render unless you already know what should have
  moved, so the checklist is the test and it is authored first.
- **Both passes run on both runtime Queue shapes.** Chapter-crossing means
  different things depending on what Position is measured against, and per the
  book-end work a real book cannot always distinguish the two.
- **No instrumentation.** Render counters were considered and rejected: the
  React Compiler already makes render-count assertions unreliable here, and the
  most recent instrumentation teardown in this repo had to be verified by
  byte-diff rather than grep because grep missed two hoisted locals. The cost is
  real and the checklist catches the defect class directly.

## Ticket breakdown

Cut as **expand-contract**, not as vertical slices. This is a wide refactor: one
mechanical change whose blast radius fans across the whole codebase, so no
tracer bullet can land green. Each migrate batch stays green on its own because
the old form still exists until ticket 08 forbids it.

| # | Ticket | Blocked by |
| --- | --- | --- |
| 01 | Repair the `rn` jest lane — **RESOLVED**, baseline 954/74 | — |
| 02 | Extract the shared "play this Book from a row" operation | — |
| 03 | Author the chapter-boundary device checklist | — |
| 04 | Create the RNTP adapter beside RNTP *(expand)* | — |
| 05 | Migrate helpers, stores and db *(batch)* | 02, 04 |
| 06 | Migrate components, screens and modals *(batch)* | 02, 04 |
| 07 | Migrate the playback service and sleep timer *(batch)* | 04 |
| 08 | Ban the imperative surface; verify Remote control on device *(contract)* | 05, 06, 07 |
| 09 | Move the reactive surface onto the store mirror | 01, 03, 08 |
| 10 | Close the ban; verify chapter boundaries on device *(contract)* | 09 |
| 11 | Rename Active Book vs Requested Book — `needs-triage` | 10 |
| 12 | Convert the playback service to TypeScript — `needs-triage` | 08 |

Tickets 01, 02, 03 and 04 are all unblocked and can run in parallel.

⚠ **Ticket 03 must RESOLVE before ticket 09 starts.** Its value is entirely that
it is written against today's behaviour. Written afterwards it describes the new
behaviour and certifies nothing.

⚠ **Ticket 02 is a prefactor and should land before 06.** It collapses four
near-duplicate play handlers into one, so 06 has four fewer sites to migrate --
and it surfaced a live inconsistency: those four callers pass *different*
active-Book sources into the same argument of the same helper. See ticket 11.

## Out of scope

- **Making the playback service testable.** The architecture review claims this
  seam delivers it. It does not: RNTP is one of four blockers, alongside a
  native shake module, a native haptics module and the database-backed stores.
  Reaching that file with tests is an "accept your inputs" problem and belongs
  with that work, not here. Doing it under this banner would let the pass grow
  without anyone noticing it had.
- **Converting the playback service to TypeScript.** Seven hundred untested,
  playback-critical lines. Converting them in the same pass would swamp the diff
  and destroy the property that makes including the file defensible at all —
  that its change is mechanical and greppable. The cost is that the adapter's
  types do not protect its handful of active-Book reads; the Remote-control
  device pass covers them instead.
- **The Queue-shape question.** Five mechanisms answer "what is Position
  measured against?" and they can disagree. That is the next candidate and it
  lands above this adapter. Handed forward explicitly in its own spec.
- **The layering violation in persistence.** A database module asks the Player
  where it is, assembles chapters, and branches on Queue shape. It receives the
  mechanical import swap here — it must, or the lint rule needs an exemption
  that would look permanent — but it keeps asking. Fixing that is the Queue-shape
  work's job, and it is named there.
- **Renaming the two Book fields.** Booked as a follow-up. Glossary now, rename
  later, for the reasons above.
- **Replacing or upgrading the Player library.** Not a goal and never will be.
  It is pinned permanently and patched in place; designing for replaceability
  would be paying for an option already declared unexercisable.

## Further notes

**Where this spec departs from the architecture review**, and why:

- The review's headline win, that the playback service becomes reachable by
  tests, does not hold. Module mocking already works and is how the existing
  eighty-one tests run; RNTP was never the blocker it is described as.
- The review lists the persistence module under this candidate's files as a
  leak the seam fixes. The seam does not fix it. The Queue-shape work does.
- The review's "one adapter is hypothetical, two is real" argument passes for
  the imperative surface and not for the reactive one. The fake implements
  eleven imperative methods and none of the hooks. The test is only meaningful
  per capability, and designing the whole seam as though it were proven would
  have put the design risk exactly where the evidence was thinnest.

**Two things found while scoping that the review did not surface**, both worth
more than the leverage counts that motivated the candidate:

- Thirty-one call sites read one field off a type whose index signature is
  `any`, in a codebase whose `tsc` is green. That is a defect class the
  toolchain is structurally blind to, and collapsing the read path is what
  removes it.
- Two different concepts share the name `activeBookId` in two stores, and five
  components consume both four lines apart. They agree during steady playback
  and diverge during a switch — the same shape as the Queue-shape divergence the
  review found in the playback service, and the same shape as the two key
  confusions the glossary's identity section already exists to prevent.

**On the lint rule as a design tool.** During scoping, "leave the persistence
module untouched" was agreed and then proved impossible to state without
contradiction, because the staged ban would have required an exemption for it.
The constraint surfaced the incoherence immediately. A header comment saying the
same thing would have let it sit in this document for weeks and appear as a
surprise mid-implementation. That is an argument for enforcement over
convention independent of the seam itself.
