# Device check plan — tickets 21 + 23

**Partially run 2026-08-14** (`d8025f4`), written the same day against `45ae1eb`.
**Tests B and C PASSED** — see their headings. ⚠ **Test A was never run**, which leaves ticket 21's
dangling-row path resting on jest alone; it is the counter-intuitive one (rename only the FIRST
file), so it is the easiest to skip and the most expensive to be wrong about.

**JS-only change** — `planEditorSave`, `planSeriesJoin`, `updateSeries`, `seriesEditor.tsx`.
No native, no `res/`, no patch-package. **A Metro reload is enough**; no `npm run android`.
(If you check a release build instead, confirm the tester's `versionCode` first.)

---

## ⚠ Read this before planning time

**Test B is the one that matters most, and it is the one a device check already missed once.**
Ticket 17 was device-verified and still shipped this defect, because repeating
remove → re-join **cannot** surface it. It needs **two** removals, of a book that was **not at
the end**. If you only have time for one test, do B.

**Two things here are NOT device-testable, and should not be attempted:**

- the seed-time freeze (`visibleAtSeed`) — it needs a background scan to land _inside_ an open
  editor, which you cannot reliably time;
- the fraction arithmetic itself — jest owns that (`seriesEditorSave.test.ts`).

---

## Test A — ticket 21: a book whose file moved is no longer deleted from its series

This is the silent permanent data loss. **It needs a DANGLING row, and producing one is
counter-intuitive** — moving a whole book out _orphans_ it, which trips the scan's prune and
removes the row legitimately. That is not this bug.

The recipe is in `scanLibrary.ts`'s own comment: **rename only the FIRST file of a multi-file
book.** The book survives on its remaining chapters, so nothing orphans, so the prune gate
(`orphanedBooks.length > 0`) stays shut — and the membership row is left pointing at a dead path.

1. Pick a **multi-file** book that is in a series and is **not** the first book in it. Note its
   position and its canonical number.
2. On the device, rename **only its first file** — `01 - foo.mp3` → `01 - foo.mp3.bak`. Leave
   every other file alone, in place.
3. Rescan. **Checkpoint:** the book is still in the library, but has **vanished from the series**.
   If it is gone from the _library_ too, you moved too much — undo and retry.
4. Open that series in the editor. **Change nothing.** Press `Save`.
5. Rename the file back. Rescan.

**PASS:** the book is back in the series, in its original slot, with its number.
**FAIL (pre-fix):** it is gone from the series **forever** — no rescan brings it back.

> Worth an A/B against `499c918` (the commit before the fix) if you want to see it fail first.
> `git stash` is not enough; check out the old commit, reload, and run steps 1–5 there.

---

## Test B — ticket 23: a restored book lands in its slot after TWO removals

** USER TESTED AND PASSED **

Pure UI. No file surgery. **This is the highest-value test on the page.**

1. A series of five numbered books — call them **A B C D E**.
2. Editor → remove **D** → `Save`.
3. Editor → remove **B** → `Save`. _(Two separate saves. This is the ticket's own simulation.)_
   List now reads **A C E**.
4. Go to **D**'s title details → `Add to series…` → pick the series.

**PASS:** `A C D E`.
**FAIL (pre-fix):** `A C E D` — D appended, the 1,2,3,5,4 defect.

Also confirm D came back **with its canonical number**, and that **A, C and E kept theirs**
(a join that blanks numbers is a separate device-found defect that must not return).

---

## Test C — the follow-up fix: two books removed in ONE save, both restore orders

** USER TESTED AND PASSED **

This is the case the **first** attempt got wrong; a code review caught it. Both orders must work,
because the user picks one and neither is rarer.

1. A series **A B C D**.
2. Editor → remove **B** and **C** → **one** `Save`. List reads **A D**.
3. `Add to series…` for **C** first. **PASS:** `A C D`. **FAIL:** `A D C`.
4. Then `Add to series…` for **B**. **PASS:** `A B C D`.
5. Reset to step 2, and this time re-add **B** first → expect `A B D`, then **C** → `A B C D`.

---

## Test D — optional, the one-time normalisation

The first `Save` after this ships rewrites the `position` of existing tombstones from integers to
fractions (e.g. `1` → `0.5`). Slot-preserving and harmless, but it _is_ a write.

Only worth checking if you want to see it: open a series with an existing tombstone, `Save`
without changing anything, and confirm nothing visible moves. The fraction is only observable in
the DB.

---

## Not covered here

- **Ticket 25** — a series whose files have **all** gone missing cannot be saved at all, only
  deleted. Real, filed `needs-triage`, and it needs a driver ruling rather than a check.
- **Ticket 26** — `addBookToSeries` writes back rows read outside the transaction. Needs a scan
  racing a tap; not reliably reproducible by hand.
- A scan that **adds** a book mid-edit still has it tombstoned by the next `Save`. Pre-existing.
