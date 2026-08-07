# 03 — `detectSeries`: the cascade as a tested pure module

**Blocked by:** None — can start immediately. It touches no database, no React Native and
no device, so it runs in parallel with [01](01-schema-v33.md).

**Status:** resolved

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

- [x] `detectSeries(units, { alsoGroupByFolder })` is pure, exported from one module, and
      imports nothing from React Native, the DB or a screen.
- [x] Corpus and ground truth are checked in as fixtures, carrying both caveat comments.
- [x] Threshold assertions on the conservative tier: grouping purity **≥ 0.983**,
      standalones swept in **= 0**, and the edition-aware naming case
      (`Discworld (2022)` present).
- [x] Both fidelity levels asserted, and the difference between them is a **fixture-level
      fact**, not a comment: conservative = 19 series / 179 books placed / 0 swept; full =
      28 series / 210 placed / 2 swept.
- [x] Each named forcing case is its own readable assertion, not folded into an aggregate:
      the 80-book merge splitting into **41 + 39** · the author folder **rejected** because
      its members' albums name a different series · the near-threshold series where the
      collision check correctly **declines** · the split-book guard suppressing a phantom
      two-book series · the science-of spin-off forming its own group rather than being
      absorbed.
- [x] The suite is also run with `series` / `grouping` / `part` **nulled out**, pinning the
      graceful-degradation property [02](02-capture-tags-at-scan.md) depends on: grouping
      purity, series count and coverage are unchanged; only canonical-number accuracy drops
      (96.4% → 93.5%). This is what makes "no backfill" a safe ruling rather than a lucky
      one.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## Why two seams and not one

A **grouping-purity** regression and a **provenance-safety** regression are different
failures with different owners. Folding them into one assertion makes the second invisible
behind the first. The other seam is [05](05-reconcile-series-seam.md).

---

## Answer

Ported. `detectSeries(units, { alsoGroupByFolder })` lives at `src/helpers/seriesDetection.ts`
— **zero imports**, so it cannot reach React Native, the DB or a screen even by accident.
Corpus and ground truth are checked in at `src/helpers/__fixtures__/` (208KB, verbatim from
the research harness), wrapped by `seriesCorpus.ts` which carries both caveats in its header.
64 tests across `seriesDetection.test.ts` (rules) and `seriesDetection.corpus.test.ts`
(measurements). `tsc` 0 · eslint 0 · jest green (306 in this tree).

**Every measured number reproduced exactly**, first run, before any test was written:

| | conservative | full |
| --- | --- | --- |
| series | 19 | 28 |
| books placed | 179 | 213 (210 of them in-series) |
| grouping purity, edition-aware | 98.3% | 97.2% |
| canonical number | 162/168 = 96.4% | 95.2% |
| standalones swept | 0 | 2 |

Tag-stripped run: series, books placed, names and purity **all identical**; numbering alone
drops 162/168 → 157/168. The NO-BACKFILL ruling is safe, and now pinned by a test.

### Three things found on the way, each a decision rather than a port

1. **The `&`/`and` key merge in `refine.js` is dead code, and was not ported.** `normKey`
   deletes `&` along with all punctuation *before* any key comparison, so the merge only
   ever saw keys with no ampersand left in them. Neutering it changed nothing on all 298
   units. The module carries a comment saying why it is absent and what would bring it
   back, so nobody re-adds it thinking it was forgotten. Note the consequence: `Memory,
   Sorrow & Thorn` and `Memory, Sorrow and Thorn` really do key differently — no library in
   the corpus exercises it.

2. **A15's name disambiguation did not exist in the research code and had to be written.**
   The cascade could emit two proposals with one display name; A15 forbids merging and
   forbids abstaining, so they disambiguate. Judgment call made here: the parent folder is
   used as the suffix **only when the two groups sit under different parents**. Under a
   shared parent it adds a word and no information, and worse, suffixing only the second
   (`Omnibus` vs `Omnibus (Shared)`) implies the first is canonical — so that case falls
   through to ` (2)`. Three tests cover it; no corpus case reaches it.

3. **The confidence tier is emitted, not dropped.** A16 says it is "a description of the
   algorithm, emitted to the scan log" — dropping it entirely would leave
   [06](06-detection-runs-on-scan.md) with nothing to log. It is a field on `ProposedBook`,
   documented as never-persisted at both the type and the field. It is not noise: a
   `certain` placement is correctly grouped for **107/107 units at both fidelities**, and
   that is asserted.

### For the ticket that consumes this

`detectSeries` is **generic over the unit type** — `detectSeries<T extends DetectionUnit>`
returns proposals whose `books[].unit` is the caller's own `T`. [04](04-detection-units.md)
can therefore pass `DetectionUnit & { bookKey: string }` and get book keys back out
type-safely, with no lookup table and no invented id field on `DetectionUnit`.

**`rel` is the book's DIRECTORY relative to the library root, not its file path**, and two
units legitimately share one `rel` when their folder holds several books (`flat`). Getting
this wrong changes what clusters and silently misfeeds the folder-number rule — it cost a
round trip here, on synthetic fixtures.

### Not done, deliberately

The `alb.bracket`, `alb.name-num-paren` and `alb.author-mangled` rules are ported but have
**no test of their own**: nothing in the 298-unit corpus matches them, so any test would
assert a shape I invented rather than a case that exists. They are covered only by the
corpus totals.
