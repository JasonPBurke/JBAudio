# 01 — Shape D: a multi-file Book whose files each carry embedded chapters

**Status:** needs-triage

**Filed by:** the queue-shape device pass (`.scratch/queue-shape/issues/12-device-pass.md`),
which was required to *characterise* this shape and explicitly forbidden from fixing it —
see that spec's `## Out of scope`: "Fixing shape D … **File it separately.**"

## The shape

The fourth authoring shape in the taxonomy (`book-end-detection`'s, reused by
`.scratch/queue-shape/spec.md`): a Book of **several files, each of which carries its own
embedded chapter marks**. It produces chapter rows with **more than one distinct `url`** AND
**non-zero `start_ms`** — the only shape where both are true at once.

Two files with five embedded chapters each become ten chapter rows: five pointing at file A
with `start_ms` 0…, five pointing at file B with `start_ms` 0….

⚠ **The corpus does not contain one.** Verified 2026-09-02 against the device DB: of 359
Books, **zero** have more chapters than distinct files. This shape is unrepresented in
production data, which is why it has survived unnoticed.

## What actually happens — three defects, three layers

Reproduced on device (Pixel 7 Pro, versionCode 115) by synthesising the shape directly in
`watermelon.db`: the 2-file Book *2012 - Railsea* was given 4 chapter rows — `P1-A`
(`start_ms` 0), `P1-B` (`start_ms` 9311555), `P2-A` (0), `P2-B` (8585809).

### 1. `start_ms` is ignored by the queue builder — file replayed from 0:00

`src/helpers/handleBookPlay.ts:239-248` (the multi-file arm) maps each chapter to a Track
using `url` and `chapterDuration` and **never reads `startMs`**. There is no
`clipStartMs`/`clipEndMs` on this arm; clipping exists only on the single-file arm.

**Device evidence:** tapping chapter `P1-B` (`start_ms` = 9311555, i.e. 2h35m into
Railsea Part1.mp3) produced `active item id=3, position=0` — the player restarted the file
from the beginning, replaying audio the listener already heard.

This is the defect the queue-shape spec predicted (it cites `handleBookPlay:217`; the arm
is now at :239 after the queue-shape work).

### 2. ⚠ NEW — chapter order is scrambled across files by the store's sort

**Not predicted by the queue-shape spec.** `src/store/library.tsx:61` sorts a Book's
chapters by `startMs` alone:

```ts
.sort((a: Chapter, b: Chapter) => (a.startMs ?? 0) - (b.startMs ?? 0))
```

`startMs` means a different thing in each shape, and only shape D breaks this:

| shape | `startMs` is | sort result |
| --- | --- | --- |
| single file, chapters | a **book-wide** offset | correct |
| multi-file, one chapter per file | always `0` | no-op, fetch order preserved |
| **multi-file, embedded chapters** | a **per-file** offset | **files interleave** |

**Device evidence:** authored order `P1-A, P1-B, P2-A, P2-B` rendered in the chapter list as
**`P1-A, P2-A, P2-B, P1-B`** — file 1's second half sorts *after* both halves of file 2,
because 9311555 > 8585809. The Book plays in the wrong order end to end.

### 3. Degenerate elapsed/remaining once elapsed passes the declared chapter duration

Because the Track is the whole file but `duration` is the chapter's, the progress bar's
elapsed runs past the chapter length and remaining pins at a floor.

**Device evidence:** on chapter `P2-A` (declared `02:23:05`) the player displayed elapsed
**`03:20:50`** and remaining **`-00:00`**.

## Why this is not a queue-shape regression

`queueShapeOf` answers `'multi-item'` here — chapters have differing `url`s, so it returns
before it ever consults the clipping gate. That is the spec's deliberate choice: representing
shape D in the verdict would have been encoding the bug. All three defects above predate the
queue-shape work and are untouched by it. The position translator behaves correctly given the
rows it is handed; it is the rows' **ordering** and the builder's **track construction** that
are wrong.

## Root cause worth stating once

`startMs` silently changes coordinate system between authoring shapes — book-wide, dead-zero,
or per-file — and nothing in the type system distinguishes them. `queueShapeOf` ended exactly
this confusion for the *Queue*; the same discipline has not been applied to the *authoring*
shapes.

## Sketch of a fix (not agreed, not in scope here)

The multi-file arm needs the clipping treatment the single-file arm already has — one Track
per chapter with `clipStartMs`/`clipEndMs` derived from the chapter's own file — and the
store's sort needs a key that is stable across files (group by `url` in the scanner's file
order, then sort by `startMs` within the group). ⚠ Both halves must land together: fixing the
builder alone still plays a scrambled Book, and fixing the sort alone still replays each file
from 0:00. Any fix must also not disturb shapes A–C, where the current sort is correct or inert.

⚠ **`shouldUseClippedChapters`' memory gate would need revisiting too** — its estimate sums
*all* chapter durations as one sample table, which is right for one file and wrong for several.

## Reproduction

No audio authoring needed. With a debuggable build (`run-as` open), take any multi-file Book
and split its chapter rows so two or more share a `url` with distinct `start_ms`. The recipe
used is recorded in `.scratch/queue-shape/issues/12-device-pass.md` under
`### Subject F — shape D`.
