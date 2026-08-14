# Device check — ticket 17, the `titleDetails` series line

**Run on 2026-08-13, IN LIGHT THEME THROUGHOUT — which is the ticket's own headline
criterion**, because every visual acceptance on this effort before 2026-08-05 was made from
dark-theme screenshots and §F6 is precisely where that bit.

**Rig:** physical Pixel 7 Pro (`29131FDH3009SZ`), the reduced library ticket 16 left behind
— 5 Bobiverse books in one detected series `Bob` (`origin=detected name_source=user`,
numbered 1–5), 0 tombstones, 0 suppressions. JS-only ticket, so every iteration was a
reload; two mid-run fixes went in that way.

**Driver drove the UI; agent captured, probed and measured over adb.**
Screenshots: `device-check/tk17-*`.

**Light theme was PROVED, not assumed**, because this screen cannot show it: the sheet is
painted by an artwork-derived mesh gradient that is dark in both themes. The proof is the
overflow menu, which paints its own card — sampled `#D8DEE9` ground with `#1C1C1C` labels
(12.62:1), i.e. the light per-scheme `modalBackground`/`text`.

---

## The measurement this ticket exists for

§F6 says the theme tokens measure **1.20:1** on this screen in light theme. Reproduced from
real pixels on two different covers, and the fix measured beside it:

| cover | ground behind the line | `lightTextMuted` (shipped) | light `textMuted` (the trap) | light `text` |
| --- | --- | --- | --- | --- |
| Bobiverse 03 (orange) | `#6D3827` | **6.92:1** | **1.24:1** | 1.82:1 |
| Bobiverse 04 (green) | `#4C6D39` | **4.37:1** | **1.28:1** | 2.88:1 |

The glyphs sample as **exactly `#D8DEE9`** (3,586 px on cover 1; 3,569 px on cover 2) —
`colorTokens.shared.lightTextMuted`, unchanged by the light theme, which is K9's whole
point: `useTheme` spreads `shared` OVER the per-scheme bag, so these are theme-invariant by
construction.

**On the brighter cover the line is 4.37:1 — under AA's 4.5, and that is NOT a ticket-17
defect.** The title one line above it, which this screen has always painted `lightText`,
measures **5.13:1** on the same ground. The line sits one hierarchy step under the title,
exactly as §F6 specifies, and is bounded by the screen's own existing treatment rather than
worse than it. The counterfactual is the number that matters: the theme token would have
been **3.4× worse**. A mesh gradient derived from arbitrary artwork has no floor, so this
is a property of the surface, not of the string drawn on it.

---

## Closed

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | The subheading renders under the title, static, one series | `Book 3 of Bob` on Bobiverse 03. Static — no press affordance, no route (§F3). |
| 2 | §F6 — the WHOLE string in the shared light-coloured token | Sampled `#D8DEE9` on two covers; no two-tone prefix. See the table above. |
| 3 | **§F7 — the negative top margin lands on its stated target** | Measured ink-to-ink: title → line **14.9 dp**, against the `Read by` → narrator reference of **14.3 dp** on the same screenshot. Within 0.6 dp of the gap F7 names as the target. |
| 4 | **§F2 — a detected series beats a user-created one** | Book 04 put in `Bob` (detected, 5) + `ZZ Beta` (user, 1) + `ZZ Alpha` (user, 2). Line read `Book 4 of Bob` — and `ZZ Alpha` sorts FIRST in the A–Z list the store hands over, so list order was not what picked it. |
| 5 | **§F2 — with no detected series, the FIRST-CREATED user one wins** | Removed 04 from `Bob`; line read `Book 1 of ZZ Beta`. The fixture was built to discriminate: `ZZ Beta` was created 25 s EARLIER and is SMALLER (1 book vs 2) and sorts LATER. Creation order is the only rule that picks it — size and list order both pick `ZZ Alpha`. |
| 6 | §F4 — no number renders `Part of` | Cleared 03's number box (leaving the others, so E7 does not renumber): `Part of Bob`. 03 sits at index 2, so a position fallback would have read "Book 3" — it did not. |
| 7 | §F5 — zero series renders nothing at all | With 04 in no series: no line, no dimmed placeholder. Measured: the block moved up by the line's own box (~28 dp) and NO residue of the -17 margin was left behind. |
| 8 | §F8 — `Add to series…` under `Edit Book Details` | Order on device: `Edit Book Details` · **`Add to series…`** · `Remove Auto-Chapters` · `Mark Book as…`. Always present. No `New series…` row. |
| 9 | §F10 SURVIVED | `Layers` on the series row, `TableOfContents` on auto-chapters — adjacent rows, distinct glyphs, verified in one screenshot. |
| 10 | §F9 — no book-first remove | Nothing in the menu or the panel removes a membership. |
| 11 | The picker's empty state | On a book already in the only series that exists: `No series to join.` Themed (light card, dark text), not the mesh-gradient treatment — K9 applied in the other direction. |
| 12 | **The join restores a tombstone, it does not duplicate** | Re-joined 04 to `Bob` from the book side: **5 rows, not 6**; `membership` flipped `excluded` → `user`. Verified in the live DB, twice. |
| 13 | **The join does not wipe the remembered number** | 04 came back carrying **`#4`**, `canonical_source=detected` untouched — this is ticket 16's device-found defect tested through the OTHER door, and it did not reproduce. Books 01/02/05 kept `#1`/`#2`/`#5` across the write, which is what `planSeriesJoin` carrying the existing numbers exists to guarantee. |
| 14 | Font scale 2.0 | `settings put system font_scale 2.0`, density unchanged at 560. Title wrapped to two lines, `Book 1 of ZZ Beta` held one line under it, no clip and no ellipsis, still reading as part of the title block. The ink gap grows 14.9 → 19.4 dp, which is the font's own leading — the layout gap the margin cancels is fixed dp, as F7 states. |
| 15 | No regression on the sheet | Overflow menu, `Mark Book as…` expansion, genres, info cards and `Start Listening` all behaved through ~15 opens. |

---

## Two defects found on device, both fixed and re-verified in-run

### A — the picker flashed `No series to join.` as the last thing before the confirmation

**Found by the driver:** *"we did get a small flash of the 'no series' overlay before the
'added' replaced it."*

The panel is a live view of a list the user's own tap mutates. The write lands, the store
re-emits, and the series they just joined stops being joinable — which on a one-series
library empties the list while the panel is still mounted. So a **failure-shaped message
painted for the action that had just succeeded.**

Fixed by snapshotting the rows on tap and rendering the snapshot until the panel unmounts.
Snapshot rather than "suppress the empty state while joining", because the rows must also
not shuffle under the spinner. **Re-verified on device: "no flash seen at all."**

### B — a restored tombstone was appended instead of going back where it was

Removing book 4 from a 1,2,3,4,5 series and re-adding it from the book side left the series
reading **1,2,3,5,4**. The first build appended unconditionally, on the reasoning that a
join carries no opinion about reading order.

**That reasoning is right for a new book and wrong for a tombstone**, which remembers its
position exactly as it remembers its number — and the editor's own re-add already honours
it (ticket 16 criterion 4 verified the position unchanged). The same user action through two
doors must land in the same place.

Fixed in `planSeriesJoin`: a restored tombstone is spliced in after the visible rows that
still precede it (read off live positions, so a stale index cannot misplace it); a book that
was never a member still appends. **Re-verified on device:** with 04 sitting at position 3,
removing and re-joining it returned it to **position 3** — the series still reads 1,2,3,4,5,
and the DB confirms 5 rows with `#4` intact.

> ⚠ **A false negative cost two passes here, and it is worth recording.** Repeating
> "remove 04 → re-join" did NOT demonstrate the fix, because 04's remembered slot WAS the
> end at that point — defect B had put it there. Appending was the correct answer to the
> question actually being asked. **A restore-in-place test needs the book to have been
> somewhere other than the end before it was removed**, which took an isolated drag to
> establish.

---

## What jest holds instead

The **largest-detected-wins** arm of §F2 is unit-tested only. Two detected series over one
book is not constructible on this device — only the scanner writes `origin='detected'`, and
the reduced library yields exactly one folder. `seriesLine.test.ts` pins it, along with both
tie-break rules (both keep list order, so a tie resolves alphabetically rather than by
observer emission order).

`seriesJoin.test.ts` pins the number-carrying property against `planEditorSave` directly —
that a join proposes NO update at all for the sitting members is a stronger statement than
any screen can make.

---

## Device left as found

`Bob`: 5 books, positions 0–4, numbers 1–5, no tombstones, no suppressions. One legitimate
difference: book 03's `canonical_source` is now `'user'` rather than `'detected'`, because
the number was cleared for criterion 6 and retyped by hand afterwards. That is the column
doing its job. `ZZ Alpha` and
`ZZ Beta` deleted — and deleting a hand-made series writes no suppression row, so both
names are free (ticket 16 criterion 11, relied on here). Font scale back to 1.0.
