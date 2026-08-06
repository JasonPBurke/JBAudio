# 09 — Deleting a series makes it stay deleted, and `Removed Series` brings it back

**Blocked by:** [06](06-detection-runs-on-scan.md), [07](07-series-detection-card.md).

**Status:** ready-for-agent

**Spec:** [§A12, A13, A14](../../series-ux-redesign/spec.md), §G7, §Out of Scope.

## What to build

A user rejects a grouping the app made. It **stays rejected** — the next scan does not
quietly recreate it. And a user who deleted one by mistake finds it in a `Removed Series`
list and restores it.

Closes user stories 17–19.

## Why this is load-bearing, not a polish item

Cross-series **split and merge do not ship**. That makes *delete and rebuild by hand* the
**only expressible repair for a wrong merge**, which puts three things on a load-bearing
route: deletion, this suppression/restore path, and the create/edit surface. None of them
may be treated as nice-to-have.

## Acceptance criteria

- [ ] Deleting a **detected** series writes its name to `suppressed_series`, so detection
      will not recreate it.
- [ ] Deleting a **hand-made** series writes nothing — nothing would recreate it.
- [ ] Deleting a series **never touches the user's books**. Removing a grouping is not a
      destructive act.
- [ ] `Removed Series (N)` opens a browsable list offering `Restore` and `Restore All`.
      Restore deletes the suppression row; the next scan recreates the series.
- [ ] Hand-creating a series whose name is suppressed **clears that row** — otherwise the
      user's own new series is shadowed by an invisible veto.
- [ ] **The suppression name is de-duplicated in JS on write.** There is **no
      unique-constraint support anywhere in the DB library** — `isIndexed` emits a plain
      index. Without the JS check a double-delete writes two rows and the
      `Removed Series (N)` count is wrong.
- [ ] End-to-end on a device: delete a detected series → rescan → **it stays gone** →
      restore → rescan → **it comes back**.
- [ ] The list gets a light-theme look. Like the card in [07](07-series-detection-card.md),
      this surface was never built and so was never tested.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Two rejected designs — do not reintroduce

- **A checkbox on the delete dialog** ("also stop detecting this"). Rejected: **a modifier
  asking for foresight fails exactly when foresight is absent.** The whole point of
  recovery is that it works for a user who did not anticipate needing it.
- **`Restore All` as a bulk destroy.** It is not one — it is creative, which is precisely
  why it is allowed under A14. No bulk destroy ships anywhere on this feature.
