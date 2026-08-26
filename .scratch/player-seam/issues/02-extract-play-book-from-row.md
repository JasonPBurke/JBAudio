# 02 — Extract the shared "play this Book from a row" operation

**What to build:** Tapping play on a Book anywhere in the library — a grid card,
a list row, a series browse row, a series detail sheet — runs one shared
operation instead of four hand-copied ones. Behaviour is identical from the
user's side; the point is that the next change to "what happens when you press
play on a row" happens once.

**Blocked by:** None — can start immediately.

**Status:** resolved

## Why this comes first

It is a prefactor. Four call sites become one, so the migration batches that
follow have four fewer places to touch — and the duplication is worth removing
on its own merits regardless of the seam work.

`BookGridItem` and `BookListItem` currently hold **character-for-character
identical** handlers, differing only in a null guard and a comment: wait for the
player, read playback state, conditionally record a play footprint, then hand
off to the book-play helper. `SeriesBrowseRow` and `SeriesDetailSheet` hold the
same shape without the footprint step.

## ⚠ The trap in this extraction

The four callers do **not** agree on what they pass as "is this the active
Book", and the disagreement is invisible until you line them up:

- The grid and list rows pass the **Active Book** — an observation, from the
  player-state store.
- The series row and sheet pass the **Requested Book** — an intent, from the
  queue store, compared inline.

Same argument position, same helper, two different questions. See `CONTEXT.md`
for both terms and why they diverge during a Book switch.

**The extracted operation must take that as a parameter and each caller must
keep passing what it passes today.** Picking one source for all four is a
behaviour change, it is not this ticket's job, and it would be invisible in
every test that does not switch Books mid-playback. Reconciling them is ticket
11's territory.

Record the inconsistency in the new function's header so it is not lost.

## Acceptance criteria

- [x] One shared operation covers all four sites, with the footprint step as an
      option rather than a copy
- [x] Each caller passes the same active-Book source it passes today —
      verified caller by caller, not assumed
- [x] The Active/Requested inconsistency is named in the new function's header
- [x] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline
- [x] No behaviour change: pressing play on a grid card, a list row, a series
      browse row and a series detail sheet each do exactly what they did before

## Answer

`src/helpers/playBookFromRow.ts` — one operation, an options object, 12 tests in
the `helpers` lane. The four handlers are gone; each call site is now four named
fields and a one-line comment saying which active-Book source it passes.

### The parameter is NOT called `isActiveBook`

The extraction was going to keep `handleBookPlay`'s name for the disputed
argument. It should not: `CONTEXT.md` lists "active book" under `_Avoid_` for the
**Requested Book**, and two of the four callers pass exactly that. A name that
asserts one of the two answers needs a paragraph of prose at every call site to
un-assert it. The parameter is `alreadyInPlay` — question-neutral, so the header
can explain the split once and the call sites just name their source:

```ts
alreadyInPlay: isActiveBook,                      // grid card, list row
alreadyInPlay: book.bookId === activeBookId,      // series row, series sheet
```

It still lands in `handleBookPlay`'s `isActiveBook` unchanged. Renaming that
parameter, and reconciling the two sources behind it, remain ticket 11's.

### Caller-by-caller verification (against `git show HEAD:`, not assumed)

| Site | source before | after |
|---|---|---|
| `BookGridItem` | `useIsBookActive(bookId)` — player state | same variable |
| `BookListItem` | `useIsBookActive(bookId)` — player state | same variable |
| `SeriesBrowseRow` | `target.bookId === activeBookId` — queue store | same expression |
| `SeriesDetailSheet` | `book.bookId === activeBookId` — queue store | same expression |

`book`, `playing` (still a live `getPlaybackState()` read), `activeBookId` and
`setActiveBookId` are unchanged in meaning at all four, and the await ordering
(`awaitPlayerReady` → `getPlaybackState` → footprint → `handleBookPlay`) is
preserved.

### THE BOOK DETAILS SCREEN IS NOT A FIFTH CALLER

`src/app/titleDetails.tsx` holds a block that reads as the same copy — footprint
comment included — and is a different operation: a play/**pause** toggle, it
stamps `stampLastPlayed` beside the footprint, it drives a loading spinner
around the play, and it reads a **third** active-Book source (`activeTrack?.bookId`
straight off RNTP's hook, neither store). Folding it in would be a behaviour
change, not a de-duplication. Named in the new module's header so the next
reader does not stop looking, and does not read it as missed.

### Two differences that are not behaviour changes

1. **The grid card gained a bail-out it never had.** The list row guarded
   `if (!fullBook) return`, the grid did not — the one difference between two
   otherwise identical handlers. The shared operation takes the stricter guard,
   `if (!book?.bookId) return`. Unreachable: the grid's parent returns a
   placeholder cell when `!fullBook`, and `bookId` is the library store's map key.
2. **The footprint's identity moved from the `bookId` prop to `book.bookId`.**
   `library.tsx` keys the map by `bookModel.id` and sets `bookId` from the same
   value, so the two are always equal.

### Gates

Baseline (ticket 01) was 74 suites / 954 tests. Now **75 suites / 966 tests**,
verified from a cold cache (`npx jest --clearCache` first — a warm one lies).
`tsc` 0 errors. `eslint` 0 errors, 38 warnings — byte-identical to the
pre-change count; the two in `BookGridItem` are pre-existing.

Reviewed on both axes (Standards + Spec). Spec found no correctness defects.
Standards produced the `alreadyInPlay` rename, the trimmed call-site comments,
the `titleDetails` correction above, and a typed `Partial<PlayBookFromRowArgs>`
in the test's argument builder — a loose `Record<string, unknown>` there would
have let a misspelled override compile clean and pass on the default, which is
the exact unchecked-property failure the parent spec exists to remove.

### Not done here

No device pass. This ticket changes no behaviour and the spec's device gates
attach to the migration batches; the four play buttons are worth a glance
whenever the next build goes out.
