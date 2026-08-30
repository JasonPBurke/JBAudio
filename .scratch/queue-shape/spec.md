# Give Queue shape a module of its own

Status: needs-triage

Architecture-review candidate 02, not yet scoped. **This file is a stub with an
inherited-scope section**, written 2026-08-25 while scoping candidate 01 so that
whoever picks this up starts from a described problem rather than rediscovering
it.

⚠ **Read `## Inherited from player-seam` before anything else.** It holds work
that candidate 01 deliberately left standing, and the reason it left it.

## The question this module answers

> What is **Position** measured against for this Book?

`CONTEXT.md` already carries the hazard, on **Position**:

> ⚠ What it is measured against depends on how the queue was built — for some
> Books it is an offset into the whole Book, for others into one Chapter — so
> "how far through?" and "how far into this item?" are different questions.

The glossary names it. No module owns it. It is re-derived at 47 references
across 11 non-test files, by **five different mechanisms that consult different
sources and can disagree**.

## The five mechanisms

| Mechanism | Consults | Where |
| --- | --- | --- |
| `isSingleFileBook()` | URL equality across chapters | `helpers/singleFileBook.ts` |
| `book.isSingleFile` | a flag persisted at Scan time | the Book record |
| `shouldUseClippedChapters()` | chapters + a device-heap gate | `helpers/clippedChapters.ts` |
| `usesChapterQueue()` | composes the two above | `helpers/chapterPlayback.ts` |
| `queue.length === 1` | asks the Player at runtime | four call sites |

**One file contains both the fix and an unguarded instance of what it fixes.**
`service.js` defines `treatAsSingleFile()` with a seven-line comment explaining
why a naive check is unsafe once clipped per-chapter queues exist — then answers
the same question later in the file with a bare `queue.length === 1`. They agree
in the common cases and diverge in exactly the window the comment exists to warn
about, which is why this survives review.

## The four runtime `queue.length === 1` sites

Measured 2026-08-25. All four now reach the Player through the RNTP adapter,
but none of them has stopped deciding:

- `setup/service.js` — the one described above
- `modals/SleepTimerOptions.tsx`
- `components/PlayerControls.tsx`
- `app/(settings)/timer.tsx`

## The read cluster this should absorb

Seven places assemble the same four Player reads — active Book, active track
index, progress, queue — and reconstruct "where am I, in Book terms?" from
scratch each time: the playback service, the sleep-timer settings screen, the
sleep-timer options modal, the player controls, the progress bar, the stable
current-chapter hook, and the footprint queries.

**This is the shape of the module.** It is the question all five mechanisms are
trying to answer, and it is the single most-called read in the app.

## Inherited from player-seam

Candidate 01 shipped the RNTP adapter and the lint rule that makes it the sole
importer. Three things were left for this work, each deliberately.

### 1. The layering violation in `db/footprintQueries.ts`

`getCurrentChapterInfo()` reads the active track index and progress **from the
Player**, fetches the Book's chapters, calls `usesChapterQueue()`, and branches
on absolute-versus-chapter-relative Position. That is this module's question,
asked from inside persistence.

The architecture review lists this file under candidate 01 as a leak that seam
fixes. **It does not.** Candidate 01 gave it the mechanical import swap — it had
to, or the lint rule would have needed an exemption that looked permanent — so
it now asks the Player politely through the adapter. It still asks. A
rule-shaped comment marks it in place.

⚠ The comment names **no file path**, on purpose. The explanatory comment in
`helpers/seriesProgress.ts` already rotted and points at the wrong file; that is
the failure mode a pointer invites. Rules do not rot.

### 2. This module lands **above** the adapter, never on it

The adapter is mechanical by contract: RNTP's vocabulary, RNTP's semantics, no
decisions. Queue shape is a decision. It consumes the adapter's raw reads and
answers in the domain's language.

⚠ **Do not add a queue-shape method to the adapter.** That would put the app's
most-contested decision inside the one module whose entire justification is that
it makes none.

### 3. Sequencing was checked and holds

Doing candidate 02 first would have meant building the module and then moving
it. Candidate 01 gives it somewhere to live. One caveat found while scoping: the
adapter's most-used read and this module's central question are the same
question, so the adapter answers only the mechanical half — *which* Book, *which*
index, *what* progress — and stops before *what those mean*.

## Not yet decided

Everything else. This stub deliberately does not choose the module's name, its
return type, whether the verdict is cached, or how the persisted Scan-time flag
and the runtime heap gate are reconciled when they disagree. Those want their
own grilling.

⚠ One thing to settle early, because it shapes the rest: `resolveQueueShape`
returning `'absolute' | 'chapter-relative'` is the review's sketch, not a
ruling. The five mechanisms do not all answer the same question — the heap gate
answers "can this device afford clipping?", which is a *cause* of the shape
rather than the shape itself. Check whether one return value is enough before
building on the assumption that it is.

## Prior art worth reading first

- `CONTEXT.md` — **Position**, **Queue**, **Active Book**, **Requested Book**
- `.scratch/player-seam/spec.md` — the adapter this sits on, and its contract
- The queue-shape taxonomy in the book-end-detection work: four authoring
  shapes, two runtime shapes, and the finding that a real book cannot always
  distinguish them — test cases needed ffmpeg synthesis
- `docs/adr/0003-only-the-rntp-adapter-imports-rntp.md`

## Addendum 2026-08-30 — the site count is five, not four

> *This was generated by AI during triage.*

Filed from the grilling of
`.scratch/skip-next-parity/issues/01-in-app-next-never-joined-the-extracted-decision.md`.
Two corrections to `## The four runtime `queue.length === 1` sites` above, which
was measured 2026-08-25.

**1. A fifth site was missed: `helpers/chapterSkip.ts`.** `skipToPreviousChapter`
branches on `queue.length === 1` to decide whether Position is absolute or
chapter-relative. It is the same mechanism as the other four and belongs on the
list.

This matters more than an off-by-one, because of *which* module it is.
`chapterSkip.ts` is the module the skip-next parity ticket holds up as the
already-extracted target shape — so the "good" side of that comparison is itself
only half-converted. It moved the *decision* out of the button but kept
re-deriving queue shape the contested way.

The genuinely converted example in the app is `resolveNextPress`, in the same
file: it takes `treatAsSingleFile` as a **parameter** and refuses to derive queue
shape at all, with a header explaining why. That is the shape this spec should
generalise from, and it is one function below a site that does the opposite.

**2. One site is being removed by the skip-next parity work.**
`components/PlayerControls.tsx`'s instance lives in `SkipToNextButton`, which
ticket `01` converts to consume a shared verdict. On that ticket's completion the
live list is:

- `setup/service.ts` — the one this spec describes as containing both the fix and an unguarded instance of what it fixes
- `modals/SleepTimerOptions.tsx`
- `app/(settings)/timer.tsx`
- `helpers/chapterSkip.ts` — **newly identified**

⚠ **`treatAsSingleFile` moves to `helpers/clippedChapters.ts` as part of that
ticket.** It is no longer defined in the playback service. The move is a
deduplication with **no verdict changed** — deliberately so, because this spec
owns the verdict — and it is explicitly a **waypoint this spec is expected to
supersede**, not a ruling that pre-empted it. The practical effect is in this
spec's favour: when the real shape resolver lands it updates one shared helper
rather than chasing two call sites that had drifted apart.

The sequencing question ("should queue-shape be done first?") was put to the
driver during that grilling and answered **no**: the parity ticket is a net
subtraction from this spec's surface area, while this spec's own
`## Not yet decided` section is still "everything else" and wants its own
grilling.
