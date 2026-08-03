# 12 — Series display setting: the backdrop toggle

Type: grilling
Status: open
Blocked by: 08
Parent: [map.md](../map.md)

## Question

[08](08-browse-presentation.md) settled the Series browse row, but chose **two**
variants rather than one: `Blend sep ctr` and `Blend quiet ctr`, identical
except for the backdrop, with the driver ruling that **a setting picks between
them**. The toggle's *existence* is decided. Nothing else about it is.

- **Where does it live?** The app has no display-preferences home for the
  library today; 09 established `Series Detection` as a settings card, but this
  is presentation, not detection, so it probably does not belong there.
- **What is it called?** It controls whether a series row draws a scrimmed
  full-bleed backdrop from the series' first cover. "Backdrop" is jargon; the
  user-facing name has to describe the effect, not the mechanism.
- **What does it default to?** This is the real question — it decides what
  every user sees out of the box, and the two read very differently.
  `Blend quiet ctr` is the most legible row of the fourteen built;
  `Blend sep ctr` is the one that makes a series feel like a *thing* rather
  than a list entry.
- **Is it per-library or global?** Almost certainly global, but say so.

## Why this is not just a settings chore

The toggle converts the **art-heavy vs quiet axis** from a decision the spec
makes into a decision the user makes. That is a real product commitment: every
future change to the Series row now has to work in **both** states, and any
later variant that only reads well with a backdrop is thereby ruled out. Worth
stating explicitly in the spec so it is not rediscovered later.

## Constraints

- **Client setting, NOT schema.** It does not touch `series` or `series_books`,
  and the map's running total of 5 columns across 2 tables plus
  `suppressed_series` is unaffected. `useSettingsStore` already holds display
  preferences of this kind (e.g. `numColumns`).
- **09's precedents apply if this lands near it:** one muted line of copy plus a
  pressable `Info` icon → `InfoDialogPopup` (the `timer.tsx` pattern), plain
  language over internal vocabulary, and **not** Pro-gated — 09 rejected gating
  because it would invert the redesign for free users. The same reasoning
  applies at least as strongly to a display preference.

## Notes

Both variants are already built and switchable in the harness
(`src/prototypes/variants/BlendSeriesHome.tsx`, `backdrop` prop), so this can be
judged on device without new prototype work.

## Answer

_(unresolved)_
