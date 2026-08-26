# 07 — Migrate the playback service and sleep timer onto the adapter

**What to build:** The largest untested file in the repo, plus the sleep timer,
talk to the Player through the adapter. This is where the quirks that motivated
the whole seam actually live.

**Blocked by:** 04

**Status:** ready-for-agent

## Why this file is included at all, despite the risk

709 lines, zero tests, playback-critical, and it holds the `commandStarted`
latch, the foreground-service demote patch, and the options-replace-arrays
behaviour — every RNTP quirk this repo has paid to learn. Excluding it would
exclude the locality win that justifies the work, and would leave a lint
exemption that looks permanent.

What makes it defensible is that the change here is **mechanical and greppable**
and nothing else. If an edit in this ticket requires thought about behaviour, it
is in the wrong ticket.

## Scope

- The playback service: its imperative calls, and its 24 event subscriptions
  moving to the adapter's subscribe.
- The sleep timer's Player calls: duck, fade, play, pause, read state.

⚠ **The service stays JavaScript.** Converting it is ticket 12 and must not ride
along — a TypeScript conversion would swamp the diff and destroy the greppability
that makes including the file defensible. The cost is that the adapter's types do
not protect its handful of active-Book reads; ticket 08's device pass covers them
instead.

⚠ **The nine inbound remote handlers are `Remote control`** — the OS driving the
app, the opposite direction from everything else in the file. They move to the
adapter's subscribe like any other listener; the direction is not a code change
here, but it is why ticket 08's device pass is shaped the way it is. See
`CONTEXT.md`.

## Acceptance criteria

- [ ] Neither file imports the Player library directly
- [ ] All 24 subscriptions go through the adapter
- [ ] The service is still JavaScript; no types added
- [ ] The five active-Book reads are individually verified by eye — there is no
      compiler helping here
- [ ] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline
