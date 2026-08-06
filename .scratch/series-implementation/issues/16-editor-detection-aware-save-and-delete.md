# 16 — The editor stops fighting detection: save, remove, delete

**Blocked by:** [12](12-editor-one-root-route.md),
[09](09-delete-suppresses-and-restores.md).

**Status:** ready-for-agent

**Spec:** [§D8, D9](../../series-ux-redesign/spec.md), §A11, §A12, §K7, §K5, §I7.

## What to build

The two correctness defects the editor carries today, fixed — so that a user's edit
**survives the next scan**, and deleting a series does not strand them on a blank white
screen.

Closes user stories 12–16 and 51, and it is the last piece of the promise that makes the
whole feature trustworthy.

## Defect 1 — the editor is not detection-aware

Its save path **rewrites join rows**. Two consequences, both trust-destroying:

- A book the user **removed** comes back on the next rescan. Removal must instead write the
  `membership = 'excluded'` tombstone that blocks re-derivation (A11).
- Removing the **last** book **deletes** the series, where A12 requires **suppression**.

The reconcile contract already exists and is tested ([05](05-reconcile-series-seam.md));
this ticket makes the editor's writes agree with it. Ownership is **per aspect** — renaming
must not cost automatic membership, and reordering must not disown the name.

## Defect 2 — the delete exit

**K7 — deleting a series currently pops onto the sheet of the series it just deleted.**
Reproduced, and **worse than predicted**: the route resolves nothing, renders nothing,
and — per K5 — shows **full-screen white**, with no grab handle, so the only escape is
system back.

**It needs BOTH fixes: pop *past* the sheet, and give the route a themed background.**

This is a **blocker, not a polish item**: because split and merge do not ship,
delete-and-rebuild is the sanctioned repair of last resort, which puts deletion on a
load-bearing route.

## Acceptance criteria

- [ ] Removing a book from a series writes the `'excluded'` tombstone; the book **stays
      removed across rescans**.
- [ ] Removing the last book **suppresses** rather than deletes, per A12.
- [ ] A rename persists forever — the next scan does not put the machine's name back — and
      **new books keep being added** to the renamed series.
- [ ] A hand-ordered series keeps its order across every rescan.
- [ ] A hand-made series (`origin = 'user'`) is **never touched** by detection.
- [ ] `Delete Series` lives in the editor and reuses the **existing origin-blind dialog**,
      whose copy is already correct: *"Delete series? This removes the series. Your books
      are not affected."*
- [ ] Deletion writes the suppression row per A12.
- [ ] **The delete exit pops past the detail sheet AND the route carries a themed
      background.** Verify on a device that no white screen is reachable, in either theme.
- [ ] `Save` and `Cancel` exits are correct — they are so by construction once the routing
      from [12](12-editor-one-root-route.md) has landed; **Delete's is not, which is why it
      is called out separately.**
- [ ] **I7 — `Delete Series` uses the shared `danger` token, which measures 2.59:1 on the
      light background.** All four shared accent tokens fail there structurally: they live
      in a shared bag spread *over* the per-scheme tokens, so they are **unthemeable by
      construction**, and all four were picked against the dark background. Note the reading
      and fix or flag it explicitly — do not leave it unmeasured.
- [ ] Device-verified end to end: remove a book → rescan → still removed; delete a series →
      rescan → still gone; restore → rescan → back.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Do not extend the existing diff helper

The membership-diff helper is **unchanged** — it serves the editor's save path in its
current form, and this effort's reconcile lives in its own seam. Assert that its tests
still pass rather than folding new behaviour into it.
