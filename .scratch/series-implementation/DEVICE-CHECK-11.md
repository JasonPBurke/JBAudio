# Device check — ticket 11, the series detail sheet

Physical **Pixel 7 Pro** (`29131FDH3009SZ`), dev build over Metro, **2026-08-10**.
Screenshots: `device-check/tk11-*.png`. Raw log: `device-check/tk11-device-2026-08-10.log`.

The dev build was not installed on the device at the start of this session, so it was
reinstalled from `android/app/build/outputs/apk/debug/app-debug.apk` (2026-08-07). All of
ticket 11 is JS, so a Metro load is enough — no native rebuild.

**Baseline scan**, driver-initiated, cold, from an empty install:

```
[scan] 194121ms total · 3464 files, 3464 new (55.5ms/new file)
       — enumerate 1510ms · existing-urls 31ms · process 192116ms · cleanup 179ms · detect 274ms
[series] detection (conservative): 354 units → 24 series, 202 books placed
       · created 24 (202 rows) · inserted 0 · removed 0 · skipped 0 · 240ms
```

⚠ **This is 354/24/202, NOT the 351/23/200 reproduced four times in tickets 04/06/07/09.**
The library grew by 3 files between 2026-08-09 and today; nothing regressed. Treat 354/24/202
as the new baseline, and do not read the old figure as an expectation.

## Closed by adb this session

| Criterion | Evidence |
| --- | --- |
| **C1/C2** — root-sibling `formSheet`, overflow-top-inset, corner radius | `tk11-05` — presents from the browse row's text, full height, rounded |
| **C3** — grab handle only | `tk11-05` — no nav row, no chevron, no ⋮ |
| **C4** — rows split | text → `tk11-06` (book details), cover → `tk11-08` (plays) |
| **J1.3** — nav-intent flag | `tk11-06`: book details **stayed up**. Without the flag it dismisses itself on mount and the row looks dead |
| **sheet-over-sheet, both directions** | `tk11-06` → back → `tk11-07`, returns to the **series sheet**, not the library |
| **C6** — active book reuses the grid's treatment | `tk11-08`: title in the accent, animated bars replacing the glyph |
| **C9** — the button keeps its word | `tk11-05` `Start · #1 Bromeliad 01 - Truckers` |
| **C10** — one wrench row `Edit series` | `tk11-05`, under the play button, no ⋮ anywhere |
| **font scale 2.0, layout** | `tk11-11`: the word `Start` survives (word first, label shrinks); badges, wrench row, rows and the accent title all intact, nothing clipped or overlapping |

Browse row at 2.0 (`tk11-10`) is unchanged from ticket 10 — this ticket touched it only to
delete its local rewind.

## Closed by the driver, same session — ALL FIVE PASS

Driver drove; verbatim results, 2026-08-10:

1. **C5 — restart-from-zero: PASS.** A book finished by **playing to its end** then
   **"resumed at 00:00"**.
   ⚠ Tested the correct way. A book marked finished **by hand** does not restart, by design —
   see the ticket's `## Answer`. That is the accepted cost of the positional rule, not a
   failure of this criterion. **The driver has since asked to discuss reverting the whole
   restart-from-zero decision — see `## Open with the driver` below.**
2. **C7 — `Series Backgrounds` both ways: PASS.** Turning it off *"removed the backgrounds
   from the series cards and the series detail sheet"* — both surfaces, one setting, which is
   the amendment §C7 makes to §B9.
3. **Both themes: PASS** — *"themes look correct"*.
4. **H6 — the ✓ travels with the title: PASS at font scale 2.0.** *"the check sits right
   behind the second line of a two line title"* — i.e. `flexShrink` parking the tick against
   the title rather than at the screen edge, which is the whole 416dp finding.
5. **C10's exits: PASS.** *"edit/save do land back on the correct screen with the series
   detail screen popping back up into place on both actions"* — §C2's root-sibling placement
   making the editor's exits correct by construction, confirmed on both `Save` and `Cancel`.

**Every device criterion on ticket 11 is closed.**

## §C5 was RE-RULED after this run, so step 1 above tested code that no longer ships

**Driver ruling, 2026-08-10, same evening.** The positional rule verified above (restart only
when resuming would land in the last 30 seconds, flag untouched) **passed and was then
withdrawn** — on design grounds, not on evidence. What ships now is a **flat flag check that
also flips the book back to `Started`**, so the restart is a once-per-listen event by
construction. Full reasoning is in `spec.md` §C5, amended in place.

**Step 1's result still holds** — a book finished by playing to its end restarts at 0:00
under both rules. The flip and its knock-ons were then re-verified in a second driver run,
same device, same session, on the real `Bobiverse` series (`5 books · 1 finished · #1-5`,
bar `1/5`, ✓ on `#1 We Are Legion`). **All four confirmed:**

- [x] After the restart the book **leaves the `Finished` tab for `Playing`**
- [x] The series' completion bar drops `n/n` → `n-1/n` (`1/5` → `0/5`), `1 finished` drops
      out of the meta line, and the hero button's word changes with it
- [x] The row's ✓ disappears; the grid's duration row switches from a full capsule + total
      duration to a real capsule + `X left`
- [x] **Pause the re-listen and press play from a card again → it RESUMES**, it does not
      restart. This is the case the whole ruling turns on, and the one a flat rule WITHOUT
      the flag flip gets wrong.

**Ticket 11 is fully device-verified.** The only criterion that remains unverifiable is §C8
(pinned artwork), which is blocked on ticket 15 writing `series.artwork`.

⚠ Note while testing: the flip only happens through `handleBookPlay`. Resuming from the
player screen, the floating player, the notification or Android Auto's transport controls
never routes through it — those talk to TrackPlayer directly and simply resume. Correct, but
it is the one place the two behaviours differ.

## Cannot be device-verified yet

**C8 — pinned art on the fan's front card.** The read path is built and unit-tested
(`heroClusterCovers`, mutation-proven), and `series.artwork` is now observed and carried
through `DerivedSeries` — but **nothing writes that column until ticket 15** builds the
editor's artwork control. There is no way to pin a cover on device today.
