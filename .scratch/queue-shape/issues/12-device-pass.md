# 12 — Device pass

**Spec:** `.scratch/queue-shape/spec.md` — `### Stage 2 — device pass required`.

**What to build:** Confirmation on a real device that the translator behaves on real Books,
and on two Books the corpus cannot produce.

## Build for this pass: preview + `run-as` ENABLED

⚠ The blanket "preview builds refuse `run-as`, so this pass is UI-only" constraint **no longer
applies to this ticket.** `android:debuggable="true"` has been added to the `<application>` tag in
`android/app/src/main/AndroidManifest.xml`, so the installed package carries `FLAG_DEBUGGABLE` and
`adb shell run-as com.fuzzylogic42.JBAudio` works. The `.scratch` DB recipes are back in play — read
`watermelon.db` directly (remember the WAL: `sqlite3` must see `watermelon.db-wal` too, or
force-stop the app first to checkpoint).

Three facts about that build, all verified before the change was made:

- **It is still a release build.** The attribute is set in the manifest, *not* as
  `debuggable true` on the release `buildType`, because AGP derives `BuildConfig.DEBUG` from the
  variant's debuggable flag and RN's `getUseDeveloperSupport()` returns `BuildConfig.DEBUG` — the
  gradle route would flip the app to Metro. The manifest route sets the install-time flag only, so
  the JS bundle stays embedded and behaviour matches the preview build previously under test.
- **Build it with `npm run build:local` (profile `preview`).** That wraps `eas build --local`,
  which pulls the same EAS keystore as the remote preview build, so the APK installs **over the
  top** of what is on the device — the scanned library, progress and footprints all survive. A
  plain `./gradlew assembleRelease` signs with `signingConfigs.debug` (`build.gradle:165`), forcing
  an uninstall that would wipe the corpus this ticket depends on.
- **The clipping gate does not move.** `deviceHeap.ts` reads `Runtime.maxMemory()` via the
  turbomodule, which `debuggable` does not affect — so the runtime shape each subject takes is the
  same as on a normal preview build.

⚠ `debuggable=true` puts ART in a deoptimizable mode (no cross-boundary inlining, slower
interpretation). **Take no timing or CPU readings from this build.**

⚠ **`android/` is committed.** This manifest edit is a tracked working-tree change and must be
reverted before the ticket closes — it must never reach a Play upload, which Google rejects
outright for debuggable artifacts. See the last two acceptance rows.

**What `run-as` unblocks that the UI could not reach:**

- **Synthesised subject 1 becomes a one-liner.** Rather than authoring an audio file with a bad
  chapter duration, write it: `UPDATE chapters SET duration = 0 WHERE ...` mid-list, force-stop,
  relaunch.
- **The "not marked Finished early" assertion.** `finishedAt` is rendered nowhere in `src/app` or
  `src/components`; it was previously unreachable and is now a direct read.
- **Runtime shape confirmed by fact, not inference** — read `is_auto_generated` and the chapter
  start offsets instead of guessing from the outside (see the next section).
- **Exact footprint chapter index**, rather than reading the inverted, mount-loading footprints
  list.

**Three real subjects, already in the corpus:** a multi-file Book with one chapter per file;
a single-file Book with chapters; a single-file Book with no chapters.

⚠ **"Single-file with chapters" is two runtime shapes, and the UI does not distinguish them** —
but with `run-as` available you can now settle it from the `chapters` rows rather than inferring
it. Clipping requires *all* of: real (not auto-generated) chapters, at least one
non-zero chapter start offset, and an estimated memory peak under half the device heap. So a
short single-file Book with real chapters loads as a chapter Queue, while the same Book
auto-chaptered — or a long one; the recorded out-of-memory case was 28.7 hours — loads as
one item. **Confirm which branch each subject takes before starting**, or all three may
exercise the same path and the pass proves less than it appears to.

**Two synthesised subjects**, for the cases the corpus cannot produce:

1. A Book with **one unusable chapter duration mid-list** — the exact-or-null path. This is
   the case with real history: a zero-duration chapter once marked a twenty-file Book
   Finished at chapter five, and unit tests did not catch it. A synthesised subject
   exercises scan → database → store → translator → render end to end, which no test lane
   reaches.
2. A **multi-file Book whose files each carry embedded chapters** — the fourth authoring
   shape. It is already broken in the queue builder, independently of this work; this
   subject turns "known unrepresented shape" from a hypothesis into characterised,
   documented behaviour. **Record what it does; do not fix it here** — see the spec's
   `## Out of scope`.

**Blocked by:** 11

**Status:** resolved

- [x] Which runtime shape each of the three real subjects takes is confirmed and recorded
      before the pass begins
- [x] Both single-file runtime shapes are actually exercised; if the corpus cannot, a
      subject is adjusted until they are
- [x] A Book with a bad chapter duration renders something sensible in the library row —
      not blank, not `NaN` — and is **not** marked Finished early (`finished_at` read directly
      from `watermelon.db`, now that `run-as` is open)
- [x] The player screen's elapsed and remaining times track correctly on a clipped
      single-file Book
- [x] A footprint recorded during a chapter-Queue Book lands on the right chapter after the
      move in `10`
- [x] The fourth-shape subject's behaviour is characterised and written up, with a separate
      issue filed for the queue-builder defect
- [x] Any device-only logging added for this pass is removed before the ticket closes
- [x] ⚠ `android:debuggable="true"`, `tools:ignore="HardcodedDebugMode"`, the `xmlns:tools`
      declaration and the temporary comment block are **all reverted** in
      `android/app/src/main/AndroidManifest.xml` before the ticket closes, and `git diff` on
      `android/` is clean
- [x] A non-debuggable preview build is reinstalled afterwards and `dumpsys package
      com.fuzzylogic42.JBAudio | grep flags=` confirms `DEBUGGABLE` is gone

---

## Answer — device pass record

Run 2026-09-02, Pixel 7 Pro (`29131FDH3009SZ`), versionCode 115, `flags=[ DEBUGGABLE HAS_CODE
ALLOW_CLEAR_USER_DATA LARGE_HEAP ]`. `run-as` confirmed open; `watermelon.db` read directly
throughout, so every assertion below is a **fact read from the DB or the live media session**,
not an inference from the UI.

Method note: all three DB files were pulled together (`watermelon.db`, `-wal`, `-shm`) and
opened locally — the WAL held ~4.4 MB against a 4.7 MB main DB, so reading the main file alone
would have shown a badly stale corpus. **Force-stop did NOT checkpoint the WAL**; pulling the
sidecars is the reliable route, not force-stop.

### Corpus census — every Book classified before the pass began

`queueShapeOf` + `shouldUseClippedChapters` replicated against all 359 Books, using this
device's real budget (`largeHeap` → `Runtime.maxMemory()` 512 MiB → 256 MiB clipping budget):

| count | shape | reached via |
| ---: | --- | --- |
| 179 | `multi-item` | single file, clipped chapters |
| 128 | `multi-item` | multi-file |
| 50 | `one-item` | auto-generated chapters |
| 1 | `one-item` | 42.9 h — over the memory budget |
| 1 | `one-item` | single chapter |

⚠ **On this device the memory gate is almost never the deciding input.** The budget is
`256 MiB ÷ (24 × 44100/1024 × 2 B/s) ≈ 36 hours`; the recorded 28.7 h OOM happened on a
256 MiB heap (18 h budget). Exactly **one** Book in 359 is held at `one-item` by memory
(*Kingkiller Chronicle 02*, 42.9 h). What actually keeps a single-file Book at `one-item`
here is the **auto-chapter exclusion**. A pass run only against short single-file Books would
never exercise the memory branch at all.

⚠ **TWO CORPUS FACTS THAT CONTRADICT THE TICKET'S PLAN, both verified:**

1. **"A single-file Book with no chapters" DOES NOT EXIST — zero of 359 Books have zero
   chapter rows.** The scanner auto-chapters every file at scan time, so this third "real
   subject" is not producible from the corpus at all. The nearest reachable thing is
   *A Rare Book of Cunning Device* (1 auto chapter, single file), which reaches `one-item`
   through `multipleChaptersInOneFile`'s `length <= 1` — a **different branch** from the
   auto-chapter exclusion, so it is still worth exercising. Anyone rewriting this ticket
   should say "a single-file Book with one chapter", not "with no chapters".
2. **No Book in the corpus is shape D** — none has more chapters than distinct files.
   Confirms the ticket's premise that it must be synthesised.

### Subjects, and the runtime shape each was CONFIRMED to take

Shape confirmed from `dumpsys media_session` **queue size**, which is the runtime fact, not
a guess from the rows:

| # | Book | rows | runtime | proof |
| --- | --- | --- | --- | --- |
| A | *1984* | 1 file, 8 real chapters | `multi-item` (clipped) | `queueTitle=null, size=8` |
| B | *All Systems Red* | 1 file, 7 auto chapters | `one-item` | `queueTitle=null, size=1` |
| C | *Crouch, B: 3 The Last Town* | 12 files, 1 ch each | `multi-item` | `queueTitle=null, size=12` |

Both single-file runtime shapes are therefore genuinely exercised (A and B), which is the
row the ticket warned could silently collapse into one path.

### Row: player elapsed/remaining on a clipped single-file Book — PASS

The discriminating case is a **later** chapter, where the two coordinates diverge.
*1984*, Chapter 5 (`startMs` 6901 s, duration 1579 s), jumped from the chapter list:

- chapter elapsed `00:05`, chapter remaining `-26:13` — chapter-relative, correct
- book remaining **`2h 08m left`** = `14639.3 − 6901 = 7738 s` — the **summed** Book Position

The mirror case on the `one-item` shape (*All Systems Red*, Track 05, `startMs` 7200 s) is the
same helper running the other way — the queue position **is** the Book Position, so the chapter
elapsed must be produced by subtraction:

- `dumpsys` `position=7200000` on a `size=1` queue, `active item id=0` — an absolute seek
- chapter elapsed `00:06`, remaining `-29:53`, book remaining **`1h 17m left`** = `11872 − 7200`

Both directions correct. Cold-restore cross-check: after relaunching, *1984* at Chapter 7
(`startMs` 10087 s) showed `1h 15m left` = `14639 − 10087`.

### Row: footprint lands on the right chapter — PASS on all three shapes

⚠ **The first footprint of any pass is NOT a discriminating test.** Leaving chapter 1 stores
`chapter_index=0`, where `startMs` is `0` and the Chapter Position and Book Position coincide —
the exact coincidence that makes a leaked conversion invisible. A footprint must be taken from
a **later** chapter to prove anything:

| shape | Book | footprint written | Book Position at that instant |
| --- | --- | --- | --- |
| `multi-item` clipped | *1984* | `chapter_index=4, position_ms=25522` | 6926 s |
| `one-item` | *All Systems Red* | `chapter_index=4, position_ms=34126` | 7234 s |
| `multi-item` multi-file | *The Last Town* | `chapter_index=4, position_ms=33260` | 7003 s |

Every row stores the **Chapter Position**, never the Book Position, and the index is the real
chapter — not the `trackIndex ?? 0` that `10` removed. `finished_at` null on all three.

`resolveChapterJump`'s two arms also confirmed distinct at the transport level: the clipped
Book **seeked inside one file**, the multi-file Book **stepped queue item** (`active item id=4,
position=0`). Both are `multi-item`; the shape verdict picked the transport, and neither arm
needed to know how many files were underneath.

### Synthesised subject 1 — bad chapter duration mid-list — PASS

`UPDATE chapters SET chapter_duration = 0` on *The Last Town* chapter 5 of 12
(id `TTn1J6s7y5Y3A3Ne`, true duration 2207.137 s), pushed back with the WAL folded in and the
sidecars deleted, then relaunched.

- **library row: `3h 24m left` with a normal progress bar — not blank, not `NaN`** ✓
- chapter list renders the bad row as `00:00`, every other duration correct, current chapter
  still correctly highlighted
- **inside** the corrupted chapter: elapsed `00:06`, remaining `-36:40`, `5h 00m left` — the
  remaining time falls back to the **player's live track duration** (2207 s), not the DB's zero
- `finished_at` = **NULL**; `book_progress_value` = 1 (Playing). Only one Book in the entire DB
  has `finished_at` set, and it predates this pass.
- played **through** the boundary out of the zero-duration chapter: queue item 4 → 5 cleanly,
  `finished_at` still null, footprint `idx=4, pos_ms=2185000` — chapter-relative and correct
  even with a zero stored duration. `restoreLastActiveBook` also restored correctly *into* that
  chapter (`position=2184000`).

⚠ **THE FAILURE DIRECTION HAS FLIPPED, AND THAT IS THE POINT.** The missing 2207 s simply drops
out of the summed Book Position, so the app believes **more** of the Book remains than truly does
(it showed `3h 24m left` where the truth is `2h 47m`). Book-end detection therefore fires **late,
never early**. The historical bug marked a twenty-file Book Finished *at chapter five* — the
unsafe direction. Under the translator the same corruption degrades toward "not finished yet".
The book-level remaining is wrong by exactly the missing chapter, which is an honest consequence
of absent data rather than a fabricated coordinate — nothing invents a position it cannot know.

### Subject F — shape D (multi-file, embedded chapters) — CHARACTERISED, NOT FIXED

Synthesised on *2012 - Railsea* (2 files) by splitting each file into two chapter rows:
`P1-A` (`start_ms` 0), `P1-B` (9311555), `P2-A` (0), `P2-B` (8585809).

**Three defects, in three different layers.** Full write-up and repro filed separately at
`.scratch/shape-d-embedded-chapters/issues/01-multi-file-embedded-chapters.md`:

1. **`startMs` ignored by the queue builder.** `handleBookPlay.ts:239-248` maps chapters to
   Tracks using `url` + `chapterDuration` and never reads `startMs`; there is no clipping on the
   multi-file arm. Tapping `P1-B` (`startMs` 2h35m) gave `active item id=3, position=0` — the
   file replayed from the beginning. This is the defect the spec predicted (it cites `:217`).
2. ⚠ **NEW, NOT PREDICTED BY THE SPEC — chapter order is scrambled by the store's sort.**
   `store/library.tsx:61` sorts by `startMs` alone. Authored `P1-A, P1-B, P2-A, P2-B` rendered
   as **`P1-A, P2-A, P2-B, P1-B`**, because file 1's second half (9311555) sorts after file 2's
   (8585809). `startMs` is book-wide for a single-file Book, always `0` for a multi-file one, and
   **per-file** only here — one expression, three shapes, wrong in exactly the third.
3. **Degenerate times.** On `P2-A` (declared `02:23:05`) the player showed elapsed `03:20:50`
   and remaining `-00:00`, because the Track is the whole file but `duration` is the chapter's.

`queueShapeOf` answers `multi-item` and returns before it reaches the clipping gate, exactly as
the spec intended — representing shape D in the verdict would have encoded the bug. **All three
defects predate this work and none is a queue-shape regression**; the translator is correct given
the rows it is handed, and it is the rows' ordering and the builder's track construction that are
wrong.

### Cleanup

- **Corpus fully restored** from a pre-mutation backup: `The Last Town` chapter 5 back to
  2207.137 s, both synthesised Railsea rows deleted, Railsea back to its 2 original chapters,
  359 Books. Verified by re-reading the device DB after the restore.
- **No device-only logging was added** — the pass needed none, because `run-as` made the DB and
  `dumpsys media_session` sufficient.
- `AndroidManifest.xml` reverted with `git checkout`; `git diff android/` clean.

⚠ **Recipe worth keeping: the DB is a usable seek primitive.** `input swipe` does not drive the
player's progress slider (the gesture is taken as a sheet dismiss). To place the playhead
precisely, write `current_chapter_index` / `current_chapter_progress`, force-stop, and relaunch —
`restoreLastActiveBook` seeks there on launch. That is how the boundary crossing above was reached
without waiting 36 minutes.
