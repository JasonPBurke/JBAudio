# 12 — Convert the playback service to TypeScript

**What to build:** `src/setup/service.js` becomes `src/setup/service.ts` — the
last `.js` file in `src/`, and the one the migration deliberately skipped. Type
annotations only, plus two named structural changes agreed below. No runtime
expression changes.

**Blocked by:** 08 (resolved)

**Status:** ready-for-human — code complete, `tsc` 0, suite green. The only
outstanding criterion is the Remote-control device pass, which no agent can run.

## Why it was excluded from the migration

709 lines, zero tests, playback-critical. Ticket 07 moves it onto the adapter,
and the only thing making that defensible is that the change there is
**mechanical and greppable**. A TypeScript conversion in the same diff would
destroy that property, and with it the ability to review ticket 07 by
inspection.

## ⚠ Not the same thing as making it testable

RNTP was one of four blockers to testing this file; the others are a native
shake module, a native haptics module, and the database-backed stores. Reaching
it with tests is an "accept your inputs" problem — architecture-review candidate
03's treatment applied here — and it is a substantially larger job than a type
conversion. **Do not let the two be conflated in triage.**

---

## Measured cost — the 2026-08-28 spike

The file was copied to `.ts` and compiled against the real project config
(`strict: true`, `allowJs: true`, `checkJs` unset — so the file is parsed but
**not checked** today; it reports zero errors because it is invisible, not
because it is clean).

**22 errors. Every one of them is reachable by annotation alone.** Not one
requires changing a runtime expression.

| Class                                                                          | Count | Work                                                                                               |
| ------------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------- |
| Implicit `any` — params, destructured payloads, three module-scope `let`s      | 16    | Annotate                                                                                           |
| `progressTrackCache` inferred `{bookId: null, url: null}` from its initialiser | 1     | Declare the cache's type                                                                           |
| `let queueShape = 'multi-item'` infers `string`                                | 1     | Annotate with the `'one-item' \| 'multi-item'` union `helpers/bookEndDetection.ts` already exports |
| `currentTrackUrl: trackUrl` — `string \| null` vs `string \| undefined`        | 1     | `?? undefined`. Safe: `evaluateBookEnd` opens with `if (!currentTrackUrl) return false`            |
| `book.artwork` — `string \| null` vs `string \| undefined`                     | 2     | `?? undefined`. **Proven safe — see below**                                                        |
| `subscribe('remote-play-book', …)` — event name and payload                    | 2     | Adapter change — see below                                                                         |

### The artwork case was traced, not assumed

Line 264 is the **notification metadata update**, and an open notification-cover
defect already sits in this file. Passing `undefined` where `null` flows today
could plausibly change whether the cover is cleared or left alone, so RNTP's
implementation was read rather than guessed:

```js
function resolveImportedAssetOrPath(pathOrAsset) {
  return pathOrAsset === undefined
    ? undefined
    : typeof pathOrAsset === 'string'
      ? pathOrAsset
      : resolveImportedAsset(pathOrAsset);
}
function resolveImportedAsset(id) {
  return id ? (resolveAssetSource(id) ?? undefined) : undefined;
}
```

`null` falls through to `resolveImportedAsset(null)` and returns `undefined`.
`undefined` short-circuits and returns `undefined`. **Both collapse to
`undefined` before crossing the bridge.** `?? undefined` is behaviour-identical,
provably, not probably.

---

## The two structural changes, and why each is not optional

### 1. A local store accessor — because the conversion otherwise makes things worse

`BookMap = Record<string, Book>` and `noUncheckedIndexedAccess` is off, so
`books[bookId]` types as `Book`, never `Book | undefined`. But this file writes
`book?.chapters`, `book?.bookProgressValue`, `treatAsSingleFile(book?…)` —
because **at runtime the lookup genuinely can miss.** That is the headless /
cold-start path `handleRemotePlayBook` and `restoreLastActiveBook` exist for,
where the service runs before the library store is populated.

⚠ **This is the conversion's real hazard, and it is the inverse of the feared
one.** The risk is not that TypeScript forces a change to working code. It is
that TypeScript _agrees with a wrong assumption_ — typing `book` as
always-present, so the next reader sees a load-bearing `?.` as redundant noise
and removes it. Under `.js` those `?.`s read as deliberate. Under a naive `.ts`
they read as cruft.

**Do:** route the five reads through one local
`getBookFromStore(id): Book | undefined`. Roughly ten lines, no runtime change,
and the `?.`s become compiler-required rather than folklore.

**Do not:** turn on `noUncheckedIndexedAccess` repo-wide. Correct in principle,
a different project in practice, and out of scope here.

This also builds the seam candidate 02 wants: `.scratch/queue-shape/spec.md`
names this file's four Player reads as the first entry in the read cluster its
module absorbs.

### 2. The adapter learns `remote-play-book`

`service.js:498` subscribes to `'remote-play-book'` — the Android Auto browse
path, emitted by **our own patch** to RNTP. It is not in RNTP's `Event` enum nor
in `EventPayloadByEvent`, so `subscribe<T extends Event>` rejects both the name
and the payload. The call **compiles only because this file is JavaScript**, and
a comment in the file has said so since ticket 07.

**Spiked and confirmed working:**

```ts
export type AppEventPayloadByEvent = EventPayloadByEvent & {
  'remote-play-book': { bookId: string };
};

export function subscribe<T extends keyof AppEventPayloadByEvent>(
  event: T,
  handler: AppEventPayloadByEvent[T] extends never
    ? () => void
    : (payload: AppEventPayloadByEvent[T]) => void,
): EmitterSubscription {
  return TrackPlayer.addEventListener(event as Event, handler as never);
}
```

Result: adapter errors 0, whole-project errors 0, probe 22 → 20. Every other
`subscribe` caller still compiles, **including the Reanimated progress hook**
the adapter's own comment flags as fragile.

⚠ **This relocates a cast, it does not remove one.** `event as Event` and
`handler as never` are still casts — now inside the module whose stated job is
owning the impedance mismatch with a patched native layer, instead of inside the
playback service. That is the right home for them, but the acceptance criteria
below must say so rather than claim a clean sweep.

The alternative — `subscribe('remote-play-book' as Event, …)` at the call site —
is the agreed **fallback only if the adapter change turns ugly**. It is worse on
its own terms: it writes a raw RNTP event name plus a cast back into the exact
file ADR 0003 was written to protect.

---

## Line endings — do the rename in two commits

`src/setup/service.js` is **682 of 682 lines CRLF**, it is the only such file in
`src/` (`helpers/resetBookToStart.ts` and `player/trackPlayer.ts` are 0), and
there is **no `.gitattributes`**. This ticket renames the file, which makes it
both the natural moment to normalize and a live hazard:

- Normalize in the same commit as the annotations and the diff becomes **682
  whole-file lines**, destroying the small-reviewable-diff property that is this
  ticket's entire justification.
- Preserve CRLF and the trap survives into a `.ts` file, where the next scripted
  edit hits it exactly as ticket 02's did.

**Ruling: normalize, in its own commit.**

1. `git mv src/setup/service.js src/setup/service.ts` + CRLF → LF, **zero
   content change**.
2. The annotations, the accessor and the adapter change, in the next commit.

The separation is **provable, not merely claimed**: `git diff
--ignore-cr-at-eol` on commit 1 shows nothing. A reviewer reads one commit of
682 mechanical lines and one commit of actual work.

⚠ This retires the CRLF trap recorded in
`.scratch/chapter-position-writes/issues/01-collapse-the-chapter-position-writes.md`,
which is a second-order reason that ticket is sequenced behind this one.

## The strict rule

The diff may contain **only**:

1. Type annotations and imports of existing types.
2. The local `getBookFromStore` accessor.
3. The adapter's `AppEventPayloadByEvent` change.
4. The CRLF → LF normalization — **in its own commit**, per the section above.

**If any error can only be silenced by changing a runtime expression: stop.
File it as its own ticket, leave the error, and do not close this one.**

The spike says the strict rule costs nothing on the known 22 — all are
annotation-reachable. Its value is against the unknown. A compiler question that
demands a behaviour change is a real defect in the app's most dangerous file,
and it deserves its own reasoning and its own device pass, not a footnote inside
a conversion diff. This is the principle this ticket already applies to ticket
07, turned on itself.

It is also the bail-out. "This got scary" now has a defined shape — the compiler
demanded a logic change — and the response is to stop rather than push through.

## Acceptance criteria

- [x] `src/setup/service.js` is `src/setup/service.ts`; no other `.js` in `src/`
- [x] The rename + CRLF → LF landed as a **separate commit** with no content
      change, verified by `git diff --ignore-cr-at-eol` reporting nothing
- [x] `tsc` reports 0 errors project-wide
- [x] **The store lookup** is honest: the five reads go through one local
      `getBookFromStore(id): Book | undefined`, and every `?.` on `book` is
      compiler-required rather than defensive folklore
- [x] The nine remote handlers and the four playback handlers have typed
      payloads, with no `any` remaining
- [x] No new suppressions **at the call site**. The adapter gains exactly two
      casts (`event as Event`, `handler as never`), recorded above, in the
      module that owns the RNTP boundary — this is a relocation, and ticking
      this box means agreeing to that trade, not to a clean sweep
- [x] `queueShape` is typed with the union `helpers/bookEndDetection.ts` exports
- [x] The strict rule held: no runtime expression changed, apart from the two
      `?? undefined` coercions proven equivalent above
- [ ] A full **Remote control** device pass — ticket 08's checklist, on both
      runtime Queue shapes

**Test count:** this file has zero tests and gains none. The "at or above
baseline" criterion is trivially satisfied and is **not** a testing commitment;
see the testability warning at the top.

## Branch plan

Established 2026-08-28. `arch-review-01-declare-player-seam` is 41 commits ahead
of `main`, 0 behind, with tickets 01–11 all resolved and device-verified.

1. **Merge `arch-review-01-declare-player-seam` to `main` first**, without this
   ticket.
2. This ticket gets **its own short branch off the updated `main`**, merged on
   its own Remote-control device pass.
3. Candidate 02 (`.scratch/queue-shape/`) branches off `main` afterwards.

**Why, rather than committing here:** 41 device-verified commits should not be
hostage to the one change whose appetite was in doubt. If the device pass
surfaces something in the progress-tick path, the response under this plan is
simply "don't merge the second branch" — this ticket returns to `needs-triage`
and nothing else is touched. It also makes the device pass diagnostic: on a
branch containing only the conversion, a Remote-control regression has exactly
one possible cause.

Merging candidate 01 with this ticket still open is the correct record, not a
smell. The seam's actual acceptance — ADR 0003 and the lint ban — closed at
ticket 10. This ticket documents itself as excluded from the migration on
purpose.

## Sequencing against candidate 02

`.scratch/queue-shape/spec.md` is the next work either way, and it **will**
reopen this file. The spec names `service.js` three times: it holds
`treatAsSingleFile()`, it holds one of the four unguarded `queue.length === 1`
sites, and it heads the seven-place read cluster the new module absorbs. The
spec's own framing — "one file contains both the fix and an unguarded instance
of what it fixes" — is about this file.

So the triage note's condition ("the benefit is realised only if the file keeps
being edited") is met by the very next ticket. Refactoring `treatAsSingleFile()`
and a bare `queue.length === 1` into a shared module, by hand, in unchecked
JavaScript, with zero tests, on the playback-critical path, is a materially
worse bet than converting first.

⚠ **A finding for candidate 02, surfaced by this spike.** The `queueShape` error
shows the file already computes a shape verdict as an untyped `string`, against
a helper that already declares `'one-item' | 'multi-item'`. The queue-shape spec
says to "check whether one return value is enough before building on the
assumption that it is" — `evaluateBookEnd` has **already made that bet**, in
production, and this file is not held to it. Start candidate 02's return-type
question there.

## Triage note

`needs-triage`: still needs a driver ruling on appetite. The measured picture,
replacing the estimate this note originally carried: the diff is **small and
annotation-shaped**, not large; the one hazard is a _false_ type (the store
lookup) rather than a broken one; and the payoff is the next ticket's safety
rather than tidiness.

**Driver Ruling** move from 'needs-triage' to 'ready-for-agent'

**Rulings already taken (2026-08-28 grilling session):** instrumental
justification, scoped to what candidate 02 needs; local accessor over a global
`noUncheckedIndexedAccess`; adapter learns the custom event, call-site cast as
fallback; own branch off `main` after candidate 01 merges; full Remote-control
device pass; the strict rule with its bail-out; the rename and CRLF
normalization as a separate, provably content-free commit.

**Not yet stamped:** whether to spend the appetite at all.
**Drive Change** changed to ready-for-agent


---

## Answer — 2026-08-28

Landed on `player-seam-12-convert-play-service-to-ts` in three commits.

| Commit    | What                                                          |
| --------- | ------------------------------------------------------------- |
| `1403685` | `git mv` + CRLF → LF. **Zero content hunks**, verified before committing. |
| `437f6aa` | Annotations, `getBookFromStore`, the adapter's `AppEventPayloadByEvent`. |
| `e77c2cb` | Stale `service.js` comment references, and two now-false claims. |

`tsc` 0 project-wide. `eslint` clean. Jest **84 suites / 1043 tests green**,
both lanes — unchanged, as the ticket said it would be.

**The spike reproduced exactly.** Renaming the file surfaced 22 errors, class
for class, matching the table above; the adapter change took it to 20; the
annotations took it to 0. No error demanded a runtime change, so the strict
rule's bail-out never fired.

### The accessor was proven, not asserted

The criterion claims the `?.`s become "compiler-required rather than defensive
folklore". That was tested rather than believed: deleting all five raises
**exactly five `TS18048: 'book' is possibly 'undefined'`** (lines 93, 94, 379,
382, 627). Restored, 0 errors.

### Two miscounts in this ticket's own spike — the code is right, the numbers were not

- **"the five reads"** — there are **four** `getState().books[...]` reads
  (pre-conversion lines 204, 467, 539, 604), and all four are routed. Five is
  the count of `book?.` SITES, which is a different set. The criterion is met
  in substance; the number was wrong.
- **`book.artwork` = 2 errors** — there is **one** `artwork` site. Cosmetic.

Both are recorded rather than quietly fixed, because this ticket's whole
argument rests on the spike being trustworthy.

### Findings from the two-axis review

1. **ADR 0003 was stale and is now amended.** Its `## Known incompleteness`
   still read "**The playback service stays JavaScript**, so the adapter's
   types do not protect its handful of active-Book reads." Struck through and
   resolved in place, with both caveats that matter recorded there: the reads
   are protected by the LOCAL accessor rather than by the adapter, and
   decision 1 now costs the adapter two casts. This was the same stale-reason
   bug `e77c2cb` was written to fix, one level up — and it was missed on the
   first pass.

2. ⚠ **The CRLF claim is overstated and needs a driver ruling.** `1403685`'s
   message says it "retires the CRLF trap". It retires the **instance**. With
   no `.gitattributes` carrying an `eol` rule, the next tool that rewrites
   `service.ts` can reintroduce CRLF. A `.gitattributes` was deliberately NOT
   added here: it is repo-wide policy with a renormalization blast radius over
   every other file, it is not one of the four things the strict rule permits,
   and every other decision on this ticket went to the driver.
   **Open question: add a scoped `.gitattributes`, or accept the instance-only
   fix?** Until then, treat the trap in
   `.scratch/chapter-position-writes/issues/01-*.md` as dormant, not retired.

3. **`e77c2cb` is outside the strict rule's four permitted items** and wants an
   explicit nod rather than silent acceptance. It is comment-only across eight
   files, in its own commit, with no executable line changed — both reviewers
   verified that independently. Two of its edits are substantive:
   `bookEndDetection.ts` and its test justified fail-closed input handling with
   "the caller is untyped `service.js`, so `tsc` cannot check what reaches this
   function". This ticket falsified that sentence. **The guards were kept** and
   the reason re-based on the one that survives — Babel erases the types, and
   the values originate in an RNTP payload crossing the native bridge. Left
   alone, the sentence invites the next reader to delete guards that still earn
   their place.

Two minor smells were raised and consciously declined as outside the strict
rule: the twice-repeated `{ index: -1, bookId: null, url: null }` literal wants
an `EMPTY_PROGRESS_TRACK_CACHE` const, and `ProgressUpdatedEvent` could be
exported from `trackPlayer.ts` instead of indexed out of
`AppEventPayloadByEvent` at the call site. Both are candidate-02 material.

### What remains

The **Remote-control device pass**, ticket 08's checklist, on both runtime
Queue shapes. Per the branch plan, a regression here has exactly one possible
cause, and the response is to not merge this branch:

- [ ] Notification transport: play, pause, next, previous
- [ ] Lock screen controls
- [ ] Headset button: single press, double press
- [ ] Android Auto: browse, select, transport, queue scroll
- [ ] Remote seek from the notification scrubber
- [ ] Remote jump forward and back land where they did before
- [ ] Chapter skip across a boundary, both directions
- [ ] Skip-previous restart threshold still behaves at the 15s line
- [ ] Sleep timer: duck, fade, end-of-chapter option
- [ ] Playback rate persists and applies
- [ ] Book-end detection still marks a Book Finished before the credits

⚠ Android Auto browse is the row that exercises `remote-play-book` — the one
call whose types changed shape. Do not skip it.
