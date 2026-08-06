# 06 — Detection runs: scan the library, series appear

**Blocked by:** [01](01-schema-v33.md), [04](04-detection-units.md),
[05](05-reconcile-series-seam.md).

**Status:** ready-for-agent

**Spec:** [§A9–A13](../../series-ux-redesign/spec.md), §G5, §Testing Decisions.

## What to build

**The moment the feature becomes real.** A user with a library full of series scans it, and
their Series shelf fills itself in — no wizard, no tapping, no review queue. An existing
tester who upgrades gets the same thing on their next scan: structure **added**, nothing
they already had changed.

This is the first end-to-end slice. It closes user stories 1–4 and 20.

## What it wires together

Units ([04](04-detection-units.md)) → proposals ([03](03-detect-series-seam.md)) →
a plan ([05](05-reconcile-series-seam.md)) → **the write**.

`seriesQueries.applyPlan(plan)` is the only new impure piece, and it is **IO only and
deliberately untested** — that is the whole point of putting two pure seams in front of it.
It must not make decisions. If a conditional shows up inside `applyPlan`, it belongs in
`reconcileSeries` instead.

## Acceptance criteria

- [ ] Detection runs at the **end** of a scan, on the stable post-scan state — never
      mid-scan, and after the existing orphan prune and empty-series reaper, which already
      run in that position.
- [ ] It respects the two settings columns from [01](01-schema-v33.md). Their getters land
      here; their UI is [07](07-series-detection-card.md).
- [ ] **The detection getter reads `!== false` with `true` as the fallback.** The house
      idiom is `=== true`, which hard-codes default-OFF into both the null case and the
      no-record case, and every existing tester's row is null. Copy-pasting it here ships
      the feature switched off, silently.
- [ ] Scanning the driver's real library produces **~19 series** at conservative fidelity,
      and spot-checks match the research listing.
- [ ] **A second scan changes nothing** — no duplicate series, no churn, no reordering.
      This is the idempotence [05](05-reconcile-series-seam.md) proved, now observed on a
      device.
- [ ] A hand-made series is **untouched** by a scan: same name, same members, same order.
- [ ] Detection off → a scan creates no series and **leaves existing ones exactly as they
      are**. Preference changes never destroy data.
- [ ] The upgrade path is **additive**: an existing tester with hand-made series scans and
      gains detected ones alongside, losing nothing.
- [ ] The tier and `why` trail for each proposal are **emitted to the scan log** and
      persisted nowhere.
- [ ] Scan time does not regress noticeably. Detection is a batch over ~350 units and ~28
      candidates; if it is slow, something is querying per book.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Watch for

- **A failed migration is silent** and this is the first ticket where real data flows
  through the new columns. If something reads wrong, check the coalesce before suspecting
  the cascade.
- The existing series screen renders whatever is in the DB, so detected series appear in
  today's UI. That is expected — [10](10-browse-row.md) restyles it later, and using the
  old view here is what makes this ticket independently demoable.
