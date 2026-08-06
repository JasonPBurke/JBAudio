# 03 — `detectSeries`: the cascade as a tested pure module

**Blocked by:** None — can start immediately. It touches no database, no React Native and
no device, so it runs in parallel with [01](01-schema-v33.md).

**Status:** ready-for-agent

**Spec:** [§A1–A8, A15](../../series-ux-redesign/spec.md) and §Testing Decisions.

## What to build

Given every book in a library, decide **which of them form series** — and prove it against
the owner's real 350-title library, so that a future change which quietly degrades grouping
**fails a test instead of shipping**.

This is the first of the spec's two agreed seams, and the decisive property is that it is
**pure**: signals in, proposals out. No query runs, no row is written, nothing imports React
Native. The repo's existing membership-diff helper documents the idiom in its own docstring
— it was extracted from the query module *specifically so it could be unit-tested without
the native adapter*. Follow that pattern.

```
detectSeries(units, { alsoGroupByFolder })  ->  ProposedSeries[]
```

## This is a port under test, not an invention

The cascade already exists as working, scored Node in
`.scratch/series-ux-redesign/research/02-detection-cascade/` — roughly 450 lines across
`cascade.js` (waterfall + folder clustering), `refine.js` (split-book guard, display-name
election, `&`/`and` key merge), `collision.js` (the edition split, singleton drop) and
`pipeline.js` (the three-stage composition). **Port it; do not redesign it.** Every number
in the spec was measured from that code.

The unit fields it actually reads, in full: `series`, `grouping`, `part`, `album`, `artist`,
`album_artist`, `composer`, `rel`, `dir`, `file`, `flat`.

## What the seam must cover

- **A1 — precedence, not weighted scoring.** A strict waterfall, first match wins:
  `extra.SERIES → Grouping → album patterns → folder`. Every proposal carries a `why` trail
  (`alb.name-num-dash`, `folder:name-corroborated(25/39)`). A weighted score buys nothing
  measurable and cannot be shown to a user.
- **A2 — folder evidence self-validates, always.** A folder cluster is trusted only when its
  own members' tags corroborate it. **This is never relaxed**, and the app ships no
  folder-structure recommendation; if folder advice is ever added, it does not license the
  detector to trust folders more.
- **A3 — two fidelity levels**, driven by the `alsoGroupByFolder` flag.
- **A4 — the number-collision check keeps editions apart.** ≥4 numbered books, ≥25%
  duplicate numbers, and a folder partition into ≥2 internally-near-unique parts of ≥2
  books each → take the folder split and name each part by its raw folder name.
- **A5 — no one-book series.** A second book arriving later creates it.
- **A7 — abstention is the default outcome.** Never create a series without confidence: an
  unmade group costs one trip to the editor, a wrong group costs trust.
- **A15 — identity is `name` alone.** Detector-generated collisions **disambiguate**
  (parent folder, then ` (2)`); they never merge and never abstain.
- **A16 — the confidence tier does NOT persist.** It and its reason string stay a
  description of the algorithm, emitted to the scan log. Its only consumer was the review
  queue, which A9 replaced. Nothing displays it. **Do not add a column for it.**

## The corpus becomes a checked-in fixture

Both research files ship into the test tree (~208 KB): the **298-unit corpus** and the
**hand-authored ground truth** labelling 236 books across 38 multi-book series. This turns
the spec's measured numbers from a claim in a ticket into assertions that fail on
regression.

Two caveats must be encoded **in the fixture's own comments**, so nobody misreads it later:

1. **The ground truth is AUTHORED, not derived** — from human knowledge of these books plus
   every available signal. It is therefore **not** valid to cite folder-rule accuracy
   against it as proof that folders are trustworthy *in general*, only that they agree with
   truth *here*. Units where reasonable curators differ carry an `ambiguous` flag.
2. **Coverage figures are LOWER BOUNDS.** The device probe took at most two files per
   directory, so ~35 single-file books in flat multi-book folders are missing. Accuracy
   figures are unaffected — they are measured on what was probed. **Assert accuracy; never
   assert coverage.**

## Acceptance criteria

- [ ] `detectSeries(units, { alsoGroupByFolder })` is pure, exported from one module, and
      imports nothing from React Native, the DB or a screen.
- [ ] Corpus and ground truth are checked in as fixtures, carrying both caveat comments.
- [ ] Threshold assertions on the conservative tier: grouping purity **≥ 0.983**,
      standalones swept in **= 0**, and the edition-aware naming case
      (`Discworld (2022)` present).
- [ ] Both fidelity levels asserted, and the difference between them is a **fixture-level
      fact**, not a comment: conservative = 19 series / 179 books placed / 0 swept; full =
      28 series / 210 placed / 2 swept.
- [ ] Each named forcing case is its own readable assertion, not folded into an aggregate:
      the 80-book merge splitting into **41 + 39** · the author folder **rejected** because
      its members' albums name a different series · the near-threshold series where the
      collision check correctly **declines** · the split-book guard suppressing a phantom
      two-book series · the science-of spin-off forming its own group rather than being
      absorbed.
- [ ] The suite is also run with `series` / `grouping` / `part` **nulled out**, pinning the
      graceful-degradation property [02](02-capture-tags-at-scan.md) depends on: grouping
      purity, series count and coverage are unchanged; only canonical-number accuracy drops
      (96.4% → 93.5%). This is what makes "no backfill" a safe ruling rather than a lucky
      one.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Why two seams and not one

A **grouping-purity** regression and a **provenance-safety** regression are different
failures with different owners. Folding them into one assertion makes the second invisible
behind the first. The other seam is [05](05-reconcile-series-seam.md).
