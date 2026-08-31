# 01 — The player's timer sheet reads a remembered setting as an armed timer

**What to build:** The player's sleep-timer sheet stops showing a timer as armed
when no timer is running. It derives "armed" from `timer_active`, the way
`PlayerControls` already does, instead of from "a value is configured".

**Status:** resolved

**Resolved 2026-08-30** by the selection-model work in
`.scratch/sleep-timer-selection/spec.md` — not by the fix described below, and
the difference matters. This ticket proposed reading `timer_active` at the
sheet. What actually landed is that "armed" and "selected" became two different
fields: `timer_mode` is the highlight, `timer_active` is the running timer, and
the sheet reads the first for the highlight and never infers either from the
value columns. Deriving the highlight from `timer_active` would have been wrong
under the confirmed spec — disarming from the bell must LEAVE the highlight.

## The problem

`timer_chapters` and `timer_duration` carry the **configured** timer — the one
the user last chose, kept so it can be re-armed with one press. `timer_active`
carries whether a timer is **running**. `SleepTimerOptions.tsx` conflates them:

```ts
setChapterTimerActive(healedChapters !== null);   // :76 and :100
setActiveTimerDuration(settings[0].timerDuration); // :75
```

Neither reads `timer_active`. So every state that stops a timer while leaving
the configured value behind renders in the sheet as a live, armed timer:

- **`cancel()` deliberately leaves both configured values set**
  (`sleepTimer.ts:316-332` writes `timer_active`, `sleep_time` and
  `timer_frozen_remaining`, and nothing else).
- **Chapter-timer expiry leaves `timer_chapters` set** — `onChapterChanged`'s
  fire branch (`:588-593`) writes `updateTimerActive(false)` and clears the
  store, but not the count.

`PlayerControls.tsx:578` is the same feature getting it right, and is the
precedent to copy:

```ts
const uiActive = storeActive || settings?.timerActive === true;
```

## What is verified, and what still needs tracing

**Verified by reading:**

- The sheet's `chapterTimerActive` and `activeTimerDuration` are set from the
  settings row only, in both the initial fetch (`:73-81`) and the observer
  (`:93-107`). `timer_active` is never read anywhere in the file.
- `cancel()` leaves `timer_chapters` and `timer_duration` intact (traced above).
  Reopening the sheet after a cancel therefore re-derives "armed" from the
  leftovers — deterministic, no race.
- Cancelling **from inside the sheet** hits the same bug by a racier path: the
  handler's `setChapterTimerActive((prev) => !prev)` (`:233`) competes with the
  observer, which re-asserts `chapterTimerActive = true` on each of the three
  writes `cancel()` makes. Which lands last is not pinned. Close and reopen the
  sheet and it is unambiguous.
- The duration half has the same shape but a narrower reach: the sheet's own
  preset button clears `timer_duration` when it deactivates (`:180`), so it
  self-heals. Cancelling from the **player's timer button**
  (`PlayerControls.tsx:630`) calls `cancel()` only, and the preset stays lit.

**⚠ Do NOT "fix" this by clearing the configured values in `cancel()`.** That
is the obvious-looking fix and it breaks a real behaviour: `PlayerControls`'
`handlePress` (`:629-640`) re-arms the last configured timer with one press,
and it reads exactly those leftovers. The values surviving a cancel is the
design; reading them as "armed" is the defect.

**⚠ `SleepTimerDurationCard` is NOT wrong, do not change its derivation.** It
looks identical (`chapterTimerActive = healedChapters !== null`, `:66`) but it
lives on the settings screen, where the highlight means "this is the configured
mode" and there is no arming — the screen's own `hasTimerConfigured`
(`timer.tsx:292`) derives the same way on purpose. Only the player sheet claims
to show a running timer.

**Needs tracing before the fix is finished:**

- What the sheet should show when `timer_active` is true but the *other* mode is
  configured — e.g. a duration timer running while `timer_chapters` still holds
  a count from an earlier session. `timer_active` alone cannot say which mode is
  live. `sleepTimer.syncFromDB` (`:680-710`) already resolves this precedence
  (frozen → `sleep_time` → `timer_chapters`) and the store's `mode` field
  carries the answer at runtime; decide whether the sheet should read the store
  (as `PlayerControls` does, via `useSleepTimer()`) rather than re-deriving from
  the DB at all. Answer this before writing the fix — it may make the fix
  smaller.

## The change

Derive "armed" in the sheet from the running-timer state, not from the presence
of a configured value, and keep showing the configured value as the *count* the
next press will arm. `PlayerControls`' `storeActive || settings?.timerActive`
is the shape; whether the sheet should take the whole state from
`useSleepTimer()` is the open question above.

A pure derivation (mode + active + configured values → what the sheet renders)
would be testable in the fast `helpers` lane. Neither the sheet nor the card can
be rendered under jest — trap 7 in `docs/testing/jest-projects-and-rn-tests.md`
— so a pure unit is the only way this gets a test at all.

## Device test

JS-only change: `npx expo start` and reload is enough, **no native rebuild**.
Use a book with 3+ chapters. The defect is a UI derivation, so the queue shape
does not gate it — run it on whatever is loaded, and note the shape in the
results rather than assuming it (`adb shell dumpsys media_session | grep -i
queue` if you need to prove it).

Rows 1-4 fail **today**; that is the point of running them before the fix.

| # | Steps | Expected after the fix |
|---|---|---|
| 1 | Player → timer sheet → press the chapter row to arm ("End of Chapter"). Sheet closes. Reopen it. | Row highlighted, countdown pill visible. (Baseline — must still work.) |
| 2 | From row 1's armed state, press the chapter row to cancel. Close the sheet. **Reopen it.** | Row **not** highlighted; the count still reads what it read before. Today it comes back highlighted. |
| 3 | Arm the chapter timer, then cancel with the **player's timer button** (not from inside the sheet). Open the sheet. | Row **not** highlighted. Cleanest repro — the sheet's own toggle never runs. |
| 4 | Arm "End of Chapter", seek to ~30 s before a chapter end, let it **fire** (playback pauses). Open the sheet. | Row **not** highlighted, countdown pill gone. Today the row still reads as armed. |
| 5 | Arm a 15 min preset, cancel with the **player's timer button**, reopen the sheet. | "15 mins" **not** highlighted. |
| 6 | After any of rows 2-5, press the row/preset once. | It arms immediately from the remembered value. **Guards the wrong fix** — if the configured value was cleared, this now needs two presses or opens the sheet instead. |
| 7 | Settings → Sleep Timer → set "End of 3 Chapters". Navigate away and back. | Row still highlighted. **Guards the card** — unchanged by this ticket. |
| 8 | Arm a chapter timer, background the app for ~30 s, foreground it, open the sheet. | Still armed, count intact. |
| 9 | Arm a chapter timer, force-stop and relaunch the app, open the sheet. | Matches whatever `syncFromDB` restores — and the sheet and the countdown pill agree with each other. |

Prove row 4 and row 9 from the DB rather than the UI if anything looks
ambiguous (debug build only):
`adb shell run-as com.fuzzylogic42.JBAudio find . -name '*.db'`, pull it, and
read `timer_active` / `timer_chapters` / `timer_duration` from `settings`.

## Acceptance criteria

- [ ] The sheet shows a timer as armed only while one is actually running
- [ ] Rows 2, 3, 4 and 5 above pass on a device
- [ ] Row 6 passes — one-press re-arm from the remembered value still works, and
      `cancel()` still leaves the configured values alone
- [ ] `SleepTimerDurationCard` and `timer.tsx` are untouched, or the ticket
      records why the settings screen's "configured" semantics had to change
- [ ] The mode-precedence question in "Needs tracing" is answered in an
      `## Answer` section before the fix is written
- [ ] The derivation has a test in the `helpers` lane, or the ticket records why
      it could not
- [ ] `tsc` 0, `eslint` 0, test count at or above baseline

## Provenance

Found by tracing Route B for
`.scratch/sleep-timer-stepper/issues/01-clamp-modal-chapter-stepper.md`
(resolved 2026-08-28, `8b77487` + `faafd20`), which needed to know whether the
sheet's armed flag could be true while the timer was off. It can, and the
mechanism is independent of the stepper bug that ticket fixed — that one was a
bad value being written, this one is a good value being read as the wrong thing.
Pre-existing; neither ticket caused it.
