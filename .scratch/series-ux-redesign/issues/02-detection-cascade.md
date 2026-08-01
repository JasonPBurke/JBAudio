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

## Notes

- All signals are already in JS (`mediainfo.ts:105-114`, and the full MediaInfo
  JSON via `NativeMediaInfo.ts`). **No native change, no rebuild.**
- Keep the rules a **pure, RN-free, DB-free helper** so it is jest-testable —
  `jest.config.js` has no RN preset.
- The corpus is curated to be pathological on purpose. Do not tune to 8 books;
  tune to the frequencies from 01.

## Answer

_(unresolved)_
