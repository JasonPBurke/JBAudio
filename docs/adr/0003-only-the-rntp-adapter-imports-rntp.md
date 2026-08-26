# Only the RNTP adapter imports RNTP — and it hands back a bookId, not a Track

**Status:** accepted (driver, 2026-08-25), from the architecture review of
2026-08-23 and the grilling session that scoped it. Not yet implemented at the
time of writing — see `.scratch/player-seam/spec.md`.

One module imports `react-native-track-player`. A lint rule enforces it. That
module is an **adapter**: RNTP's vocabulary, RNTP's semantics, and no decisions
of its own.

The part that will look wrong later, and the reason this document exists:
**the adapter refuses to hand out a `Track` on the read path, and hands out
`Track[]` freely on the write path.** That asymmetry is deliberate. It is not an
oversight and it is not an inconsistency waiting to be tidied.

## What was actually wrong

Thirty-four non-test files reached for RNTP by name. The obvious complaint is
coupling, and the obvious fix is a wrapper. Both are true and neither is the
interesting part.

The interesting part is what those files were reaching *for*. Sorted by the
question being asked rather than the method being called, the call sites
collapse to about six questions — and one of them dominates. **Every single
site that asked "which Book is playing?" — thirty-one of them — did it by
fetching a `Track` and reading one field off it.**

RNTP's `Track` is declared like this:

```ts
export interface Track extends TrackMetadataBase {
  url: string;
  // …
  [key: string]: any;
}
```

`bookId` is not a field on it. It is an app-added property arriving through the
index signature, so `activeTrack.bookId` is typed `any` — and so is
`activeTrack.bookid`, `activeTrack.bookID`, and `activeTrack.anything`. All four
compile. Three of them yield `undefined`.

This repo's `tsc` is green at zero errors and has been for months. It cannot see
any of this. **Thirty-one unchecked reads of the app's most important runtime
identifier, in a codebase that believes itself typed.**

## The decision

1. **One module imports RNTP.** It is named for the library it fronts, not for
   the domain. The word "player" already denotes six things here — a screen,
   three components, a setup module, and the engine — and the adapter does not
   get to take it.
2. **The adapter makes no decisions.** Same rule `seriesQueries.ts` states in
   its own header: the IO half must not decide. Anything that decides lives
   above it.
3. **Reads collapse. Writes stay structural.** The adapter answers "which Book
   is active?" with `Promise<string | null>`. It does not export
   `getActiveTrack` at all. It *does* return `Track[]` from the queue read and
   accept `Track[]` on add.
4. **A lint rule enforces (1)**, staged, with the remaining allowlist serving as
   the migration's own tracker.

## Why the asymmetry is right

Because reads and writes are asking different things, and only one of them
needs the structure.

**On the read path**, `Track` is a transport for one string. Twenty imperative
sites and eleven hook sites were checked individually; not one reads `url`,
`title`, `artwork` or `duration` off the active item. Handing back a `Track` so
each caller can dig out `bookId` through an `any` hole is the defect, restated
one layer higher.

**On the write path**, `Track` is the thing being built. Constructing a Queue
from a Book genuinely produces items with URLs, durations and clipping windows;
the add call genuinely consumes them. Collapsing that to a `bookId` would
destroy information the Player needs.

The queue read sits deliberately on the write side of this line, and it is the
case most likely to be "corrected" by a future reader. It returns `Track[]`
because three callers need the structure: relative seek and chapter skip need
**per-item durations** to compute a landing spot, and the restore path needs the
**first item's `bookId`** to decide whether the loaded Queue is the right Book.
Four further callers need only `queue.length`, and those four are a different
problem — see *Known incompleteness* below.

So the rule is not "Track is bad." It is: **an active-item read answers a
question and should return the answer; a queue read exposes a structure and
should return the structure.**

## Why not the alternatives

**A — a thin 1:1 port over RNTP's twenty-three methods.** Rejected. It buys
substitutability, which we already had — `jest.mock` has been substituting RNTP
for eighty-one tests across ten files for months — and it delivers nothing on
locality, which was the actual goal. Seven call sites would still reassemble the
same four-call cluster by hand. A pure passthrough would also have been the one
module in the change with no coverage.

**B — a domain interface speaking Book, Chapter and Position.** Rejected as the
*only* layer, though it is the right shape for what sits above. It would have
orphaned `fakePlayer.ts`, which fakes RNTP's verbs, and with it the eighty-one
tests that depend on the fake's simulation of native clamping. The seam's
strongest existing asset would have been thrown away to make the seam prettier.

**C — dependency injection, or a settable singleton.** Rejected. Both buy
substitutability we already have, and both cost something real — DI is viral
across thirty-four files and has no natural path into React components; a
settable singleton is global mutable state whose test isolation rests on
discipline. RNTP is pinned permanently and patched in place, so designing for
a second production implementation is paying for an option already declared
unexercisable.

**D — keep `getActiveTrack` as an escape hatch alongside `getActiveBookId`.**
Rejected. There are zero callers needing more than `bookId` — measured across
all thirty-one sites, not assumed. An escape hatch with no user is how the
collapse gets quietly undone: the next person in a hurry takes the familiar
name. If a caller ever genuinely needs the Track, it gets added then, with a
recorded reason.

**E — redefine RNTP's enums in domain terms rather than re-exporting them.**
Rejected. Re-exports stay identity-equal to RNTP's, so every existing
`State.Playing` comparison keeps working untouched. Redefining would be a
modest vocabulary win and a generator of equality bugs that present as logic
bugs.

## Where the rule lives

- **The adapter**: `src/player/trackPlayer.ts`. Its header states the
  no-decisions rule; the surface is fixed in
  `.scratch/player-seam/issues/04-create-rntp-adapter.md`.
- **The enforcement**: a `no-restricted-imports` block in `eslint.config.js`,
  written in that file's house style — narrow, with a comment recording what was
  measured. Exempts the adapter and test directories. **The test exemption is
  deliberate**: that is where the fake plugs in, so the rule honestly reads
  *"only the adapter and its tests."*
- **The fake**: `src/helpers/__tests__/support/fakePlayer.ts`, unchanged, and
  deliberately sitting **below** the adapter rather than at it. It keeps
  simulating *native* semantics — the seek clamp into the active item, the
  position reset on skip — which is what lets tests assert on the landing spot
  rather than on which calls were made. Same discipline as
  `fakeDatabase.ts`: transcribed from the real thing, never invented. Keeping it
  below means the real adapter runs on top of it, so the adapter is covered by
  the existing suite instead of being untested.

## Known incompleteness — do not read these as oversights

**The queue-shape question is not answered here, on purpose.** Four callers read
`queue.length === 1` to decide what Position is measured against. That is one of
five competing mechanisms for the same question, and it belongs above the
adapter, never on it — putting the app's most-contested decision inside the one
module whose justification is that it makes none would be self-defeating. See
`.scratch/queue-shape/spec.md`.

**Persistence still asks the Player where it is.** `db/footprintQueries.ts`
reads the Player, fetches chapters, and branches on Queue shape. It goes through
the adapter now, which changes the colour of the arrow and not its direction.
Named in place with a rule-shaped comment. ⚠ **That comment names no file
path** — `seriesProgress.ts`'s explanatory comment already rotted and points at
the wrong file, which is exactly what a pointer invites.

**The playback service stays JavaScript**, so the adapter's types do not protect
its handful of active-Book reads. Verified by device pass instead. Booked
separately.

## The general lesson, since this is the third time

`CONTEXT.md`'s `Keys and identity` cluster opens with a rule earned twice
already: **name a key after the question it answers**, not the shape of its
value or the one place it is currently read. `book_key` looked like a foreign
key and was not. `sort_name` answered two questions and was about to be edited
for the wrong one.

This decision is the same rule applied to a *module* rather than a key.
`PlayerGateway` — the architecture review's name — describes the shape of the
thing. `trackPlayer` describes what it fronts, and `getActiveBookId` describes
the question it answers. Naming it for a domain it deliberately does not own
would have invited exactly one future edit: giving it responsibilities to live
up to its name.

A fourth instance surfaced while scoping this, in the same area and not yet
fixed: **two stores hold a field called `activeBookId`, and they are different
things** — an intent that leads a Book switch, and an observation that lags it.
Five components read both. `CONTEXT.md` now defines **Active Book** and
**Requested Book** separately; the rename is booked at
`.scratch/player-seam/issues/11-rename-active-vs-requested-book.md`.

## What the architecture review claimed that did not survive

Recorded because the review is a persuasive document and will be read again.

- **"service.js becomes reachable by tests."** It does not. RNTP is one of four
  blockers; the others are a native shake module, a native haptics module, and
  the database-backed stores. Module mocking already worked — it is how the
  existing eighty-one tests run — so the seam was never what stood in the way.
- **"`footprintQueries.ts` ← leak"**, listed under this candidate. The seam does
  not fix it. Queue shape does.
- **"Two adapters, a real seam."** True for the imperative surface, where the
  fake implements eleven methods. False for the reactive surface, where it
  implements none. **The one-adapter-is-hypothetical-two-is-real test is only
  meaningful per capability** — applied to a whole dependency at once, it
  certifies the third of the surface where the evidence is thinnest.
