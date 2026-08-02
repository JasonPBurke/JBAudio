# 02 — Detection cascade: what rules get it right, and how do they fail?

Type: prototype
Status: open
Blocked by: 01
Parent: [map.md](../map.md)

## Question

Given the signals inventoried in [01](01-signal-inventory.md), **what precedence
of rules produces the correct series, series position, and edition — and what is
the shape of its failures?**

The failure shape matters as much as the accuracy. A detector that is confidently
wrong needs a different UI from one that abstains when unsure.

## Acceptance

Run the candidate cascade over the real corpus offline (Node, no device needed —
tag extraction is pure data) and report, per book: proposed series name, proposed
position/number, proposed edition, and a confidence. Then score it.

The three cases the driver named explicitly must be handled:

1. **Two Morts land in two *separate* Discworld series.** Tags alone cannot do
   this — Mort 2022's tags carry no series name. Folder is required, and the
   series folder sits at a different depth for each.
2. **Bobiverse 02 → series "Bobiverse", book 2.** The folder must be *rejected*
   here (it is the author); series + number come from `album`.
3. **Bands of Mourning → series "Mistborn", book 6.** `album` gives series +
   number, its `(Michael Kramer)` parenthetical is the narrator, and the real book
   title comes from the folder.

## Design questions inside this

- **Precedence or scoring?** A strict waterfall (`Grouping` → album pattern →
  folder) is simple but brittle; weighted scoring across signals is more robust
  but harder to explain to a user — and the UI may need to *explain why* a
  proposal was made.
- **When does the detector abstain?** Abstaining is a feature: "7 books I couldn't
  place" is a better UX than 7 wrong series.
- **What is a confidence, concretely?** A number, a tier (`certain` /
  `likely` / `guess`), or the *reason* ("matched Grouping tag")? The review UI
  will surface whatever this produces.
- **Grouping key vs display name.** `Discworld` and `Discworld (2022)` must not
  collide, but `Mistborn 6 (Michael Kramer)` must normalise to `Mistborn`.
- **Re-detection on rescan.** If the user renames or splits a detected series,
  the next scan must not undo it. Implies a persisted override marker — feeds the
  schema work in the fog.

## Driver inputs (2026-08-01, on resolving 01)

1. **Folder conventions are per-library, never global.** No folder rule ships as
   a universal prior, and structure is never enforced (ABS-style mandates are
   off the table). But a *specific* user's structure may **earn trust by
   self-validation**: where folder patterns corroborate tag signals at scale
   within that library (e.g. `Discworld NN - Title` folders agree with albums
   41/41), the learned convention may then be applied to that library's
   tag-silent units. The 01 traps (author-as-folder, `{YEAR - Title}` folders,
   flat multi-book dirs, chapter-split dirs that look identical to flat dirs)
   are the cases self-validation must reject.
2. **Err on the side of caution — abstention bias is binding.** Do not create a
   series unless confident it is correct. An unmade group costs one wizard
   trip; a wrong group costs trust and cleanup. (Consistent with 03: user
   corrections are top-precedence detection inputs, so the detector defers.)
3. **A user-facing switch may gate folder evidence** ("use my file structure to
   create series?"), asked before scan/series creation. Consent turns a
   heuristic into a sanctioned signal and fits the abstention bias. Two open
   sub-questions for this ticket: the switch permits folders to be *considered*
   — per-convention self-validation still applies underneath it (Discworld
   folders pass, Bobiverse's author-folder must still be rejected, same
   library, same switch); and *when* to ask — pre-scan consent is abstract,
   while post-dry-run consent can show what the structure would produce
   ("your folders look like 12 series — use them?"), which fits the
   review-and-correction centre of gravity.

## Notes

- All signals are already in JS (`mediainfo.ts:105-114`, and the full MediaInfo
  JSON via `NativeMediaInfo.ts`). **No native change, no rebuild.**
- 01's real-library data + probe scripts: `../research/01-signal-inventory/`
  (`device_general.jsonl` = 304 units with full General tracks — the offline
  scoring corpus this ticket's Acceptance asks for already exists there).
- Keep the rules a **pure, RN-free, DB-free helper** so it is jest-testable —
  `jest.config.js` has no RN preset.
- The corpus is curated to be pathological on purpose. Do not tune to 8 books;
  tune to the frequencies from 01.

## Answer

_(unresolved)_
