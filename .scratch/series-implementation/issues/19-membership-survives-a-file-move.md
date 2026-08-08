# 19 — Series membership does not survive a file move

**Blocked by:** [01](01-schema-v33.md) — the provenance columns must exist to reason about.
Nothing else. It can run now.

**Does NOT block [06](06-detection-runs-on-scan.md)** — see *Sequencing* below. Its one device
criterion is mirrored onto 06 and closed on the run that validates 06, the way
[02](02-capture-tags-at-scan.md)'s and [04](04-detection-units.md)'s were.

**Status:** ready-for-agent

**Spec:** none — this is **not** a spec gap. Found on 2026-08-07 while closing
[02](02-capture-tags-at-scan.md)'s and [04](04-detection-units.md)'s device criteria
([`../DEVICE-CHECK.md`](../DEVICE-CHECK.md)), by reading the code rather than by observing a
failure. **No user has reported it and no test covers it.**

**Triaged 2026-08-08.** The decision this ticket was raised to force **has been made** — see
*The ruling*. What remains is documentation, one pure test, and one device criterion. The
behaviour does not change.

## What is wrong

`series_books` identifies a member by **`book_key`** — the absolute path of the book's **first
audio file** (`bookStructuralKey`), not by `book_id` (`src/db/schema.ts`, `series_books`).

At the end of every scan, inside `removeMissingFiles` (`src/helpers/scanLibrary.ts`):

```ts
if (orphanedBooks.length > 0) {          // ← the gate. See "Two corrections" below.
  const liveKeys = new Set<string>();
  for (const chapter of allChapters) {
    if (!removedChapterIds.has(chapter.id)) liveKeys.add(chapter.url);
  }
  await pruneOrphanedSeriesBooks(liveKeys);
  await deleteEmptySeries();
}
```

and `pruneOrphanedSeriesBooks` (`src/db/seriesQueries.ts`) is:

```ts
const orphans = all.filter((m) => !liveKeys.has(m.bookKey));
… prepareDestroyPermanently()
```

**A membership row whose path no longer exists is destroyed permanently** — not soft-deleted,
no tombstone, no undo — and `deleteEmptySeries` then removes any series left with zero members.

**The prune does not consult provenance.** It treats `membership: 'user'`, `'excluded'` and
`'detected'` identically, and ignores `origin` / `name_source` entirely.

### THERE ARE TWO PRUNE SITES, NOT ONE

The original ticket named only the scan. `removeLibraryFolder` (`src/db/settingsQueries.ts`) —
the **Remove** button on each folder in `Manage Library` — carries its **own inlined copy** of
the same logic: it collects the removed books' structural keys, destroys every `series_books`
row matching them, and destroys any series left with no remaining rows, all in one batch.

It does not call `pruneOrphanedSeriesBooks`, which is why a grep for that name finds only the
scan. Any ruling that only lands in the scan is half-landed. **This site is deliberately left
destructive** — the user tapped a button whose dialog says *"remove this folder and all of its
books from your library"* — but it must carry the same comment, or the next reader finds two
implementations of one rule and no statement of which is authoritative.

### Two corrections to the original ticket

Both were found during triage by reading the scan end to end. Both were **code-read, not
observed** — the same standard as the original finding.

1. **The prune is gated on `orphanedBooks.length > 0`.** The original quoted the block inside
   the gate without the gate. It matters: a scan in which no book is orphaned never prunes at
   all, so two of the four original scenarios never reach the code the ticket is about.
2. **`membershipOf` does not exist.** The helper is `resolveMembership`
   (`src/db/seriesProvenance.ts`). Recorded because the original cited it by the wrong name at
   a line number that had already drifted.

## What actually breaks, and the verdict on each

Rewritten at triage: the original table's last two rows described the wrong mechanism, and its
folder-move row collapsed *one book*, *a whole library*, and *a root folder that no longer
exists* into one line — three cases with three different outcomes, and the distinction the
ruling turns on.

| the user does | what actually happens | verdict |
| --- | --- | --- |
| reorders books **inside the app** | **safe** — that is `position` / `canonical_number`, no files involved | unchanged |
| moves or renames **one book's folder** | the book is destroyed and re-created at the new path under a new key; its membership row is destroyed; if it was the series' last member the series goes too | **RULED EXPECTED** |
| renames a **single-file** book (`.m4b`) | identical to the above — the only chapter's path changed, so the book orphans | **RULED EXPECTED** |
| **reorganises inside** a live library root — the realistic *"let me tidy my folders"* | every book they touched is destroyed and re-created; membership rows go with them; any series left with no members ceases to exist | **RULED EXPECTED** |
| moves the library's **contents** elsewhere, leaving the configured root folder in place (even empty) | the root still exists, so every chapter under it is probed, found gone, and removed. **Every book, every membership row and every series is destroyed** — a hand-made playlist is not emptied, it ceases to exist | **RULED EXPECTED** |
| renames or deletes the **configured root folder itself** | **PROTECTED, and nothing is destroyed** — see the guards below. The books linger in the DB pointing at dead paths and cannot play, but every series survives intact | not a loss; a **different** defect if it bothers anyone |
| renames **only the first file** of a multi-file book | the book survives, so **nothing orphans and the prune never runs**. The row is not destroyed — it dangles, and the book quietly stops appearing in the series via `assembleDerivedSeries`' graceful skip. The stale row is destroyed later, by the first unrelated scan that orphans any book | **NOT CODED AROUND** — driver's ruling 2026-08-08: odd user behaviour, no work |
| **adds** a file that sorts earlier (intro/prologue) | **does not change the key.** `processDirectoryFiles` skips files already in `existingUrls`, so only the new file is grouped, and `populateSingleBook` adopts an existing book only when one of its chapters already holds the incoming first-file path — a brand-new path, so never. It creates a **second book row**; the original keeps every chapter and its key, and membership is untouched. The original ticket's claim holds only after a wipe-and-rescan | **NOT THIS TICKET'S** → [`../NOTE-book-split.md`](../NOTE-book-split.md) |

That last row is also a **candidate mechanism for the Dark Tower split** that NOTE-book-split
records as unexplained: files arriving in two different scans cannot be grouped together, and
the second batch becomes its own book row. Offered there as a lead, not a conclusion — nobody
has observed it.

### The two guards that decide whether anything is destroyed at all

Found at triage. Both already exist, both are load-bearing, and **neither may be "tidied up"**
by the agent implementing this ticket — they are the reason the destructive rows above are
narrower than they look.

1. **A configured root that is not on disk is skipped wholesale.** `removeMissingFiles` probes
   each configured root first and, for any chapter under a root that is missing, `continue`s
   without removing it. So renaming or deleting the *root folder itself* destroys nothing. This
   is why *"I moved my library"* and *"I renamed my library folder"* have **opposite outcomes**,
   which is not obvious and is exactly what the ADR needs to say.
2. **An empty enumeration skips cleanup entirely.** If MediaStore returns zero files while
   libraries are configured, the whole cleanup is skipped with a warning rather than wiping the
   chapters table.

There is a third, narrower one: for a chapter under an *available* root, removal still requires
a direct `RNFS.exists` probe to confirm the file is genuinely gone, so MediaStore under-reporting
does not destroy anything either. Together these mean **only a genuinely-absent file under a
genuinely-present root** reaches the prune.

**The asymmetry the original ticket named still holds.** Detected series *self-heal*: once
[06](06-detection-runs-on-scan.md) ships, moved books are re-detected and re-grouped on the
same scan. Authored data does not. The ruling accepts that asymmetry rather than closing it.

One deliberate exception already works the right way round: `suppressed_series` is keyed by
**name**, not path, so *"I deleted this series, don't bring it back"* survives a reorganisation.

## Why this is not [06](06-detection-runs-on-scan.md)'s

The destruction happens in `removeMissingFiles`, which runs **before** detection — 06's own
first criterion places detection *"after the existing orphan prune and empty-series reaper"*.
So by the time any 06 code runs the rows are already gone, and
[05](05-reconcile-series-seam.md)'s `reconcileSeries` cannot help either: it is pure and only
ever sees survivors.

`pruneOrphanedSeriesBooks` / `deleteEmptySeries` also **predate this effort** — they are v32-era
series code already wired into the scan. Nothing in 01–08 caused this.

## The ruling

**Driver, 2026-08-08.** Recorded here because the original ticket deliberately declined to
pre-decide, and the whole point of raising it was to stop the current state being *C-by-accident*.

### 1 · Option C. The loss is intended, for both kinds of series.

**A moved or renamed book leaves its series and is not put back by hand.** For a **detected**
series that is invisible, because detection re-adds the book at its new path on the same scan.
For a **hand-made** series the book is simply gone and the user re-adds it. That is the
existing behaviour and it is correct.

**This extends to the whole-library case, which is the one the driver was asked directly.** A
reorganisation big enough to empty a hand-made series deletes that series outright — name, order,
membership — and the user rebuilds it by hand. Ruled **expected**: the user made it, the user
remakes it.

*The question was put to the driver as "you move or rename your whole `/Audiobooks` folder". The
**rename** half of that turned out to be protected by guard 1 below — found after the ruling, and
recorded rather than quietly folded in. It does not disturb the ruling: the destructive paths
that remain (reorganising inside a live root, or moving the contents out and leaving the folder)
are the common ones, and are what the driver was answering about.*

### 2 · A detected series the user has edited regenerates fresh. Also expected.

Rename a detected series, remove a book that does not belong, pin a couple of numbers, then move
the folder: the series is destroyed and detection recreates it with the **auto name**, **no
numbers**, and **the removed book back in**. Ruled acceptable.

Consequences, stated so nobody discovers them later:

- The `membership = 'excluded'` tombstones of [A11](../../series-ux-redesign/spec.md) are
  destroyed with everything else, so the outcome A11 calls *"the most trust-destroying
  available"* is reachable — **but only via a file move**, never via a scan of an unchanged
  library, which is the case A11 was written for. A11 is not weakened; its boundary is now stated.
- The `Series Detection` card copy ([09 §9](../../series-ux-redesign/issues/09-auto-generate-series-setting.md),
  shipped by [07](07-series-detection-card.md)) enumerates as safe the exact four things this
  ruling destroys. **The copy decision is routed to 07, not made here** — see *Out of scope*.

### 3 · Options A and B are REJECTED. Do not re-raise.

**A — provenance-aware prune** (keep `'user'` and `'excluded'` rows, prune only `'detected'`).
Rejected. It does not deliver what it appears to: the book still does not display, because
`assembleDerivedSeries` skips unresolved keys either way, so A and C look **identical** to the
user for a single moved book. What A actually changes is that the *series row* survives its
books, and the driver ruled that it should not. Its costs are real and unwanted — empty
playlists rendered in the browse list (nothing anywhere filters `books.length === 0`), and
`assertSeriesNameAvailable` querying the DB directly, so a ghost series blocks its own name and
re-creating it by hand fails with *"name already used"* against something showing nothing.

A also has a trap worth recording independently: **nothing writes `membership` today.**
`createSeries` / `updateSeries` never set it and there is no other production writer, so every
row resolves to `'user'` via `resolveMembership(null)`. A implemented as the original ticket
described it would have pruned **zero rows** until 06 and 12–16 began stamping provenance —
i.e. it would have silently disabled the orphan prune entirely. The abstention-bias ruling from
[18](18-delete-the-prototype-harness.md) that makes A *safe* is the same property that makes it
*inert*.

**B — re-key on move.** Rejected outright by ruling 1: re-keying exists to make a moved book keep
its series, and a moved book is not supposed to keep its series.

## Sequencing

**The original *"should land before 12–16"* argument no longer applies and has been removed.**
It rested on the editor shipping output that silently evaporates. Under C the output does
evaporate, by design, so there is no code fix to get in first. What remains is weaker and still
true: the **ADR should exist before the editor ships**, because 12–16 build the surface whose
purpose is hand-building playlists and a reader of that code needs the boundary written down.
No technical dependency either way.

**19 does not block 06, and 06 does not block 19's desk work.** The driver ruled that 19 owns
proving a moved book is re-added to its generated series. Taken literally that is circular — the
re-adding *is* 06 — so it resolves as:

- the ADR, both comments and the pure test **run now**, against 01 only;
- the one device criterion is **mirrored onto 06's criteria** (done at triage) and **closed on
  the device run that validates 06**, exactly as 02's and 04's last criteria were closed on
  2026-08-07.

**Do not append it to [`../DEVICE-CHECK.md`](../DEVICE-CHECK.md).** That document is a *closed
record of one completed run* — its title, its four-criterion table and its results are 02's and
04's — not a live checklist. 06's run gets its own document in the same shape when 06 is built.

19 therefore reaches `resolved` in two steps. That is normal for this effort, not a defect.

## Acceptance criteria

- [ ] The ruling is recorded as an **ADR** in `docs/adr/`. The directory does not exist yet —
      this bootstraps it, per `CLAUDE.md`'s lazy-creation rule, and is therefore ADR **0001**.
      It must name what `book_key` identifies, state that a file move ends a book's series
      membership, and state that a hand-made series does not outlive its last member.
- [ ] **Both** prune sites carry a comment stating the ruling and why: `pruneOrphanedSeriesBooks`
      in the series queries, and the inlined prune inside `removeLibraryFolder` in the settings
      queries. A reader must not have to re-derive that provenance was considered and rejected,
      and must not be left guessing which of the two implementations is authoritative.
- [ ] Each row of *What actually breaks* has a stated expected outcome the reader can check
      against the code. The two rows this ticket does not fix — the odd first-file rename, and
      the added intro — say **why** they are out, and the added-intro row points at
      `NOTE-book-split.md`.
- [ ] **The ADR states both guards** and, in particular, that renaming the configured root
      folder and moving its contents out have **opposite** outcomes. That asymmetry is the single
      least guessable thing here, and the guards are the reason the ruling is narrower than
      *"a scan can delete your playlists"*. Neither guard is refactored, simplified or removed
      by this ticket.
- [ ] **A pure unit test covers the prune's decision.** The decision must be extracted from the
      query into a pure function taking membership rows plus the live key set and returning the
      rows to destroy — `seriesMembershipDiff` is the precedent, and this effort's testing
      decisions leave the IO untested, so any conditional has to live somewhere testable. The
      test must pin that provenance is **deliberately ignored**: a `'user'` row and an
      `'excluded'` row with dead keys are both destroyed, and a failing assertion here means
      someone has quietly implemented A.
- [ ] The same pure function backs **both** call sites. Two copies of a rule is how the two
      sites drifted in the first place.
- [ ] **Device criterion, deferred to the 06 run:** move a book's folder on a device with a
      detected series, rescan, and the series comes back **complete** — the moved book present
      at its new path, no duplicate series, nothing left behind. Already mirrored onto
      [06](06-detection-runs-on-scan.md)'s criteria at triage, so this ticket writes no device
      document; it stays open on this one line until 06's run reports back.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Not in scope

- **The `Series Detection` card copy.** The shipped sentence — *"Renamed series, books you've
  added or removed, custom ordering and hand-made series are all left alone when your library is
  scanned again"* — enumerates precisely the four things a file move destroys, so under this
  ruling it is false in that one scenario. **Deliberately routed to [07](07-series-detection-card.md)**,
  which owns the card and ships the copy verbatim from 09 §9: the decision belongs in front of
  the driver when the card is built, not buried in a ticket that changes no behaviour. 07 has
  been annotated. Ruling 2 above is the input it needs.
- **Any in-app warning before a scan empties a hand-made series.** Offered at triage and
  **declined** — the ruling is that the loss is expected, and a warning would contradict it.
- **The scan's delete-and-recreate behaviour itself.** That a moved file becomes a new book is
  upstream of this and is not this ticket's to change. Ruling 1 depends on it staying that way.
- **The book-split defect** in [`../NOTE-book-split.md`](../NOTE-book-split.md) — different
  mechanism, already ruled out of scope. The added-intro row above hands it a new lead.
- **Any change to detection.** 03/04/05 are resolved and correct; this is about what happens to
  rows *after* they are written.
- **Re-keying, and provenance-aware pruning.** Rejected above with reasons. Do not re-raise.

## Comments

> *This was generated by AI during triage.*

### Triage — 2026-08-08

**Category:** bug · **State:** `needs-triage` → `ready-for-agent`

Triaged against the codebase rather than a reproduction: the ticket was itself raised by
code-reading, and reproducing it means a device rescan, which is where its one device criterion
now sits. Everything below is code-read.

**What verification changed.** Seven findings, four of which moved the decision:

0. **Two existing guards narrow the blast radius sharply**, and one of them inverts a case the
   driver was asked about: a configured root that is missing from disk is skipped wholesale, so
   *renaming your library folder* destroys nothing while *moving its contents out* destroys
   everything. Found **after** the ruling was given; recorded in full under *The two guards*
   rather than folded in silently. The ruling holds on the destructive paths that remain.

1. The prune is gated on `orphanedBooks.length > 0`; the ticket quoted inside the gate. Two of
   its four scenarios never reach the prune.
2. The added-intro scenario does not change a book's key — it creates a second book row. The
   ticket's strongest argument for B (*"the case no prune policy alone can catch"*) was
   therefore describing something else.
3. Nothing writes `membership`, so option A would have pruned nothing until 06 shipped.
4. There are **two** prune sites; the ticket named one.
5. `main` is schema v31 with no series files at all — **zero installed base**, so this was a
   forward-looking ruling, not a data rescue.
6. `membershipOf` is really `resolveMembership`.

**Rulings taken** (driver, in order asked):

| question | ruling |
| --- | --- |
| A whole hand-made playlist deleted when all its books move | **Expected — rebuild it by hand** |
| A user-edited detected series regenerating fresh after a move | **Accept** |
| Who proves a moved book is re-added to its generated series | **19 owns it** |

The third was recorded with a correction: the option as offered said *"19 blocks 06"*, which is
backwards — the re-adding is 06's code, so 19 cannot prove it before 06 exists. Resolved as a
two-step close, documented under *Sequencing*. The driver's intent — that the file-move story is
provable in one place — is preserved.

**Consequential edits made outside this file:** [07](07-series-detection-card.md) annotated with
the card-copy boundary; [06](06-detection-runs-on-scan.md)'s qualifier paragraph updated to point
at the ruling rather than at an open question.

### Agent Brief

> *This was generated by AI during triage.*

**Category:** bug
**Summary:** Record — in an ADR, in both prune sites, and in one pure test — that a file move
ends a book's series membership and that a hand-made series does not outlive its last member.
**No behaviour changes.**

**Current behavior:**
Two places destroy series membership rows whose structural key no longer resolves to a live
book, and then destroy any series left with no rows: the scan's missing-file cleanup, and the
`Manage Library` per-folder **Remove** action, which carries its own inlined copy of the same
logic. Neither consults provenance; neither carries a comment saying so. The decision inside
them is expressed as an inline `filter` over model instances, so nothing about it is unit
testable. There is no `docs/adr/` directory.

**Desired behavior:**
Identical runtime behaviour, with the rule stated once and tested once. The decision moves into
a pure function that both sites call; the ADR states what `book_key` identifies and what a file
reorganisation costs; both sites carry a comment naming the ruling and pointing at the ADR.

**Key interfaces:**

- A new **pure** function in the same family as `computeMembershipDiff` — takes the membership
  rows (structural key plus whatever provenance the row carries) and the set of live structural
  keys, returns which rows to destroy. It must not import the database, and must not branch on
  provenance. Both prune sites call it and neither keeps its own copy of the rule.
- `resolveMembership` / `resolveProvenance` in the series provenance module — **read but not
  used to branch.** If the implementation finds itself calling them to decide what to destroy,
  it has implemented rejected option A.
- The scan's missing-file cleanup and the settings module's library-folder removal — the two
  call sites. The gate on the scan's site (it only prunes when at least one book was orphaned)
  is existing behaviour; leave it, and let the comment explain what it means.

**Acceptance criteria:** as listed under *Acceptance criteria* above — all seven. The seventh is
a **device** criterion already mirrored onto 06 and closed by 06's run; this ticket writes no
device document and must not append to the closed `DEVICE-CHECK.md`. Do not mark 19 resolved on
the strength of the desk work alone.

**Out of scope:** as listed under *Not in scope* above. In particular: do not touch the card
copy, do not add a warning, do not re-key, and do not make the prune provenance-aware. Each was
considered and declined at triage, with reasons recorded above.
