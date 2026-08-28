# Should a sleep timer deactivate when the app is killed while NOT playing?

Status: needs-triage

Raised: 2026-08-17, during the fix for the paused-timer-lost-its-freeze bug.
Deliberately NOT actioned then — the fix shipped the opposite behaviour (restore
the freeze). This file exists so the question can be re-decided on evidence
rather than re-derived from scratch.

## The proposal

When the app's process dies while playback is **not playing**, deactivate the
sleep timer instead of restoring its frozen remaining time.

Driver's intuition: swiping the app away is about as close as Android gets to
"I'm done", and a timer that silently survives that is not what most people
would expect. Sleep timers in media apps are commonly session-scoped.

## Current behaviour (shipped)

An armed duration timer has two persisted shapes and cold start restores
whichever applies:

- RUNNING — `sleep_time` = absolute end instant, `timer_frozen_remaining` null
- FROZEN — `timer_frozen_remaining` = ms left, `sleep_time` null

So a paused timer keeps its banked minutes across a process death indefinitely.
See `src/setup/sleepTimer.ts` and schema v34.

## Why it was not adopted

### 1. The headless cold start (the blocking objection)

`syncFromDB()` lives inside the RNTP **playback service** (`src/setup/service.js`,
registered at `index.js:9`), not the UI. That service starts cold from the media notification, or an Android Auto connection —
with no app UI ever opening.

So "deactivate on cold start" would cancel the timer at the exact moment
playback resumes, and then play unbounded. The user never sees a screen, so
there is no unarmed bell to notice. Given this app ships an Android Auto
integration, that is a normal way to start listening, not an edge case.

This also breaks the argument that a cancelled timer "fails visibly, so the user
just re-arms it" — that argument assumes the UI is open, and here it never is.

### 2. The timer is denominated in playback, not wall-clock

Driver's framing, and it is the more coherent model: the timer measures
_listening time remaining_, not _a wall-clock stop instant_. Under that
definition 25 banked minutes is exactly the right number however much wall time
passed while paused, and staleness is irrelevant by construction. It also means
timer state should be a function of playback state — and process lifecycle is
not a playback signal.

### 3. Playing + swiped away must keep counting (firm requirement)

`appKilledPlaybackBehavior: ContinuePlayback` (`src/helpers/playerSetup.ts:26`)
means a swipe while playing does NOT kill the process — the foreground service
holds it, playback continues, the timer keeps running. Any future rule must not
disturb this. Note this case cannot reach `syncFromDB()` at all, since it never
cold-starts.

## The scenario any future design MUST be held against

Fully headless, no UI at any point:

1. Timer running, playing.
2. User swipes the app off recents — playback continues (FGS holds the process).
3. User pauses from the notification / Bluetooth / Android Auto.
   → FGS demotes (`stopForegroundGracePeriod: 0`) and the task is already gone
   from recents, so nothing holds the process up. It is very likely killed.
4. Later, user presses starts the book from Android Auto.
   → Cold runtime, service-only, no UI.

Shipped behaviour: the frozen value is restored and converted back to a running
countdown. Correct.
Under the proposal: the timer is cancelled at step 4 and the book plays
unbounded, silently.

## If revisited, the more promising variant

Bound the _staleness_ rather than keying on process death: drop a frozen timer
that has been frozen longer than some window (1-4h), applied uniformly whether
or not the process survived. This keeps the short-interruption case correct and
kills only genuinely stale timers. Costs one persisted `frozen_at` timestamp.

Note this weakens objection 2 rather than answering it — if the timer really is
denominated in listening time, a stale timer is not wrong, merely surprising.
Decide which of those two models the product actually wants first; the
implementation follows trivially either way.

## Evidence to gather before deciding

- Does anyone actually hit this? Closed-testing feedback on timers surviving
  longer than expected, vs. books playing on unbounded.
- What do comparable audiobook apps do on app restart with an armed timer?
  Claimed convention (session-scoped) was never verified against real apps.
