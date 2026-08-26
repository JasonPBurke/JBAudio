# 10 — Close the ban, and verify chapter-boundary freshness on device

**What to build:** The seam closes. The Player library becomes unimportable
anywhere outside the adapter and its tests — and a device pass proves that every
surface which used to update when a chapter turns over still does.

**Blocked by:** 09

**Status:** ready-for-agent

## The contract half — stage 2 of the ban

Widen the restricted-import block from ticket 08 to ban the library outright,
keeping the two exemptions: the adapter, and test directories.

The stage-1 permitted list disappears. **Its emptying is the migration's
completion signal** — there is nothing else to check off.

## The device pass — chapter-boundary render freshness

Run **ticket 03's checklist**, authored before any of this changed. Do not
re-derive it now; a list written after the fact describes the new behaviour and
certifies nothing.

Every row runs on **both runtime Queue shapes**. Chapter-crossing means different
things depending on what **Position** is measured against, and per the book-end
work a real book cannot always distinguish the two — synthesise a case with
ffmpeg if needed.

## What a failure looks like

A surface that used to update at a chapter boundary and now does not. It will
look correct on screen — that is the entire reason the checklist exists. Compare
against the row's predicted observable, not against whether the screen looks
plausible.

If a row fails: the site depended on re-render-at-chapter-boundary, which the
Active Book selector no longer provides. Fix it by giving that site its own
index subscription — the pattern the book-time-remaining and stable
current-chapter components already use — not by reverting the migration.

## Acceptance criteria

- [ ] Stage-2 rule active; the library is unimportable outside the adapter and
      test directories
- [ ] `eslint` 0 with it on; `tsc` 0
- [ ] Test count at or above ticket 01's baseline, 74 of 74 suites running
- [ ] Every row of ticket 03's checklist run on **both** runtime Queue shapes
- [ ] Result recorded below under `## Answer`, including every row that failed
      and what was done about it
