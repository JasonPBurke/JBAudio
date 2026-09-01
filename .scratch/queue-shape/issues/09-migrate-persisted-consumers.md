# 09 — Migrate the persisted consumers

**Spec:** `.scratch/queue-shape/spec.md` — decision 3.

**What to build:** The surfaces that read where a Book was *left* rather than where the
Player is now — the library rows, the chapter list, the footprint list and the remaining-time
display — use the same translator as the live surfaces, passing persisted progress instead
of Player reads.

These are the consumers that prove the translator's signature was right. They have no Player
reads and must not gain any: the library row renders once per visible Book, unmemoized by
design, so an async bridge call there would be a scroll regression. Today one of them
re-implements the conversion inline **precisely because** it could not afford the live-only
helper — that inline copy is the shape of the bug this ticket ends.

**This ticket owns the user-visible half of exact-or-null.** A Book with a chapter whose
duration failed to extract now yields a null Book Position instead of a silently
undercounted number. Decide and implement what each surface shows for that — and it must be
sensible, never blank and never `NaN`. Where a surface genuinely wants an approximation, it
calls the best-effort variant by name, so the choice is visible at the call site.

**Blocked by:** 07

**Status:** resolved

- [x] Library rows, chapter list, footprint list and remaining-time all use the translator
- [x] None of them makes a Player read, directly or transitively
- [x] The inline conversion copy in the library-row progress helper is gone
- [x] Each surface has a decided, implemented behaviour for a null Book Position — never
      blank, never `NaN` — and the decision is recorded on this ticket
- [x] Any surface that wants an approximation calls the best-effort variant explicitly
- [x] An `rn`-lane test proves a Book with an unusable chapter duration renders sensibly in
      the library row
- [x] The `rn`-lane trap list in `docs/testing/jest-projects-and-rn-tests.md` is read before
      that test is written
- [x] `tsc` 0, eslint 0, full suite green

## Answer

Four surfaces migrated, one new helper (a pure resolver plus its transport), two hand-rolled
conversions deleted. `tsc` 0, eslint 0 errors, full suite green — **97 suites / 1229 tests**,
both projects.

### What each surface now does

| Surface | Reading | Variant | Why |
| ------- | ------- | ------- | --- |
| `helpers/bookProgressUtils` (library rows) | `'chapter'` — persisted or live store values | **approximate** | An undercounted capsule is cosmetic — the spec's own example |
| `helpers/chapterPlayback`'s `calculateRemainingBookTime` | `'queue'` — the Player reading its caller already holds | **approximate** | Undercounting played OVERSTATES what is left, which is the safe direction for a label |
| `app/chapterList` — the highlight | `'chapter'` | `locateInBook` — **policy-irrelevant** | Reads `.chapter.index` only |
| `app/chapterList` / `app/footprintList` — the press | `'chapter'` | `locateInBook` — **policy-irrelevant** | Each arm reads a coordinate no duration is summed into |

⚠ **Only the first two rows are a real exact-vs-best-effort choice**, and the spec-axis review
was right to say so. `DurationPolicy` reaches nothing but `secondsBefore`, i.e.
`bookPositionSeconds` on a MULTI-item Queue. The highlight reads `.chapter.index`; the jump
resolver reads `.chapter` on the multi-item arm and a one-item `bookPositionSeconds` that sums
nothing. Both variants would answer identically there, so `locateInBook` is the honest default
rather than a load-bearing decision. The two that genuinely choose say why at the call site.

⚠ **Both store values are CHAPTER coordinates**, which is what made the `'chapter'` tag right
for three of the four: the service writes `playbackIndex` through `setChapterIndex` and feeds
`setPlaybackProgress` a chapter-relative position on **either** shape.

### The null Book Position at each surface — decided and implemented

- **Library row.** Progress capsule at 0, remaining text = the whole duration. Never blank,
  never `NaN`. It is the honest floor: we cannot say how far in you are, and the only number
  certainly true of the Book is its length. ⚠ This is the **migration delta 07 flagged**: the
  deleted arithmetic CLAMPED an out-of-range index to the last chapter, i.e. rendered a Book
  it could not place as *nearly finished*. Pinned by the `rn` test.
- **Chapter list highlight.** No row highlighted (`activeIndex = -1`) — the same rendering
  the screen already produces in read-only mode and for a Book that is not the loaded one.
  Again replacing a clamp that highlighted the LAST chapter, the most misleading row available.
  ⚠ **It passes a Chapter Position of `0` on purpose.** The highlight names a Chapter, not a
  position within one, and feeding the stored progress in made a corrupt
  `current_chapter_progress` VOID a perfectly good index — `locateInBook` declines the whole
  reading when the position is unusable. Caught by the spec-axis review; the first draft read
  the store's progress and would have un-highlighted the row.
- **Chapter list / footprint list press.** Do nothing, and the chapter list resolves the jump
  **before** the footprint write so an unplaceable row records no departure either.
- **Remaining-time label.** Falls back to the whole Book duration, and the initial state is
  **seeded** with it rather than `''` — the first paint used to render a bare `" left"`
  before `getProgress()` resolved.

### `helpers/chapterJump.ts` — new, and why it is not scope creep

Both list screens had the *same* hand-rolled `startMs + position` conversion beside the same
transport branch. `resolveChapterJump(chapters, target: ChapterPosition)` returns
`{ kind: 'seek', bookPositionSeconds }` or `{ kind: 'skip', queueIndex, chapterPositionSeconds }`
or `null`, and `performChapterJump(jump)` carries it out. The split is `chapterSkip.ts`'s
(`resolvePreviousPress` / `skipToPreviousChapter`): the resolver decides and touches no Player,
the transport is handed the answer as a PARAMETER and decides nothing — ADR 0003 decision 2.

Three things the two-axis review changed here, all in the second draft:

- **The argument is a `ChapterPosition`, not two loose primitives.** They are that type, both
  callers already hold the pair, and every other entry point in `bookLocation` takes a named
  reading (Data Clumps / Primitive Obsession).
- **Neither arm's field is called `seconds` any more.** One was a Book Position and the other a
  Chapter Position under one name — exactly what CONTEXT.md's Position cluster lists under
  *Avoid*. They are `bookPositionSeconds` and `chapterPositionSeconds`.
- ⚠ **The transport is shared because it had ALREADY drifted.** Inline, `footprintList` seeked
  after its `skip` and `chapterList` did not. `performChapterJump` settles it once — seek only
  when the Chapter Position is non-zero, since a freshly skipped-to item starts at 0 — and
  three fakePlayer tests assert the landing spot rather than the calls.

⚠ **Both arms come from ONE `locateInBook` call, and each reads only the coordinate its shape
makes exact.** One item → `bookPositionSeconds` (`startMs + position`; no durations summed, so
nothing can void it). Multi item → the validated `chapter`. **Reading `bookPositionSeconds` on
the multi-item arm would refuse a jump that works perfectly well**, because that coordinate is
summed from the PRECEDING chapters and voids on a damaged earlier one — a `skip()` needs no
such sum. This was written the wrong way round first and caught before it shipped.

The shape verdict survives here on purpose: stepping to another Queue item is a different
OPERATION from seeking inside one. ADR 0004's addendum already lists that class
(`PressReading.oneItemQueue`); this is the same kind.

### ⚠ One checkbox is true only in the sense that matters

*"None of them makes a Player read"* — `components/BookTimeRemaining` reads the Player and
always has: it is a **live** display of remaining time, subscribed to progress events, and
`getActiveTrackIndex` is where its Queue index comes from. It is on this ticket because
`calculateRemainingBookTime` is the helper that still branched. What 09 guarantees is the
property the ticket actually needs: **no helper on this path reads the Player, and no read was
added.** The three genuinely persisted surfaces (library row, chapter list, footprint list)
make none, directly or transitively — the `rn` test's mock list is two entries long and
neither is a player.

### 07's SECOND delta — "null Chapter with an exact Book Position"

07 warned that this combination is new and that *"a surface showing 'which chapter' needs an
answer for it"*. **It is unreachable at every surface on this ticket**, and the reason is the
tag, not luck: it arises only on the one-item `'queue'` path, where the Chapter is scanned
from `startMs` and the scan may refuse. All four surfaces here read persisted or store values
and are tagged `'chapter'`, where the index IS the Chapter and no scan happens. The one
surface that shows "which chapter" — the chapter list highlight — is therefore answered by
07's FIRST delta (the index) alone. The live surfaces that can hit it belong to `08`.

### Behavioural deltas beyond the two null policies

1. **`calculateRemainingBookTime` returns `number | null`** where it returned a number. An
   unreadable Queue index on a multi-item Queue used to fabricate chapter 0 and answer
   `duration - position`; it now declines and the label shows the whole duration. Visible for
   at most one frame at mount, before `getActiveTrackIndex()` resolves.
2. **A one-item Queue still answers without an index** (it can only ever be 0), so nothing
   regressed there — pinned by a new test.
3. `bookProgressUtils` and `BookDurationRow` now import `BookProgressState` from
   `helpers/bookProgressState` instead of through `handleBookPlay`. Same enum; the old route
   drags the Player adapter and WatermelonDB's SQLite adapter into the helper, which is what
   made the library row untestable in both lanes. This is that module's stated purpose.

### Tests

- `helpers/__tests__/bookProgressUtils.test.ts` — **new**, 10 cases. The helper had none.
- `helpers/__tests__/chapterJump.test.ts` — **new**, 12 cases: both shapes and every null
  path for the resolver, plus three transport cases against `support/fakePlayer`.
- `helpers/__tests__/chapterPlayback.test.ts` — the fabricated-chapter-0 case rewritten to
  assert `null`, plus the one-item-without-an-index and unusable-duration cases.
- `components/__tests__/BookDurationRow.rn.test.tsx` — **new**, the `rn` lane, 3 cases. Trap
  list read first: `render` is awaited (trap 2), no fake timers, no render-count assertions
  (trap 4), and it renders no list (traps 6/7). It kills two mutations — reverting to the
  exact variant, and restoring the index clamp.

### Notes for the tickets that follow

- ⚠ **ADR 0004 ruling 3 asks for a recount at `11`**: *"if every site collapses `null` the same
  way, delete the variant."* Three of this ticket's four surfaces do collapse it the same way —
  to the whole Book duration — while the two list surfaces collapse it to "highlight nothing" /
  "do nothing". Not a merge yet, but `11` should count again with `08`'s sites included.
- `.scratch/queue-shape/` has no `map.md`, so the resolve step's "append a context pointer to
  the map" has nowhere to go — true of `01`–`08` as well. `brief.md` + `spec.md` have served as
  the map for this effort; worth settling before the next one rather than inventing one here.
- The standards review's one disputed point, recorded so it is not re-raised: **`render` IS
  async in RNTL 14**, trap 2's list notwithstanding. The `rn` test failed with *"`render`
  function has not been called"* until it was awaited, and `PlayerControls.rn.test.tsx` awaits
  it for the same reason.
