# 17 — Light theme pass over the Series surfaces

Type: prototype
Status: open
Blocked by: 14, 15
Parent: [map.md](../map.md)

## Question

This effort has found **two** light/dark defects, both by accident, and has never
done a systematic pass. Both are the same family — *a component paints a surface,
then draws on it with a colour the theme chose* — and the map already carries the
rule that came out of them. What it does not carry is evidence that the rule was
applied everywhere.

The two on record:

- [08](08-browse-presentation.md): the play glyph was coloured from the theme
  while sitting on a scrim the component itself paints — **invisible in light
  mode**. Fixed by making it a fixed near-white; then
  [13](13-detail-sheet-prototype.md) went further and moved the darkening
  **into the glyph's own `fill`**, which is now house style.
- [13](13-detail-sheet-prototype.md): a `formSheet` whose route renders `null`
  shows the platform's **white** container, because `titleDetails`-style options
  set **no `contentStyle` background** (`player` does — `_layout.tsx:239`).
  Any screen copying those options inherits it. This is why `Delete` produced a
  full-screen white sheet.

What to check:

1. **Every surface in light theme**: browse row in both `Series Backgrounds`
   states, the detail sheet and its hero, the editor, the wizard (15's shape),
   14's series line on `titleDetails`, the `Series Detection` settings card, the
   `Removed Series` list, and every dialog.
2. **`PILLAR` (`#0B0B0B`, `seriesCardParts.tsx:79`)** — chosen deliberately *not*
   to be `themeColors.background` so a letterbox does not become a white hole in
   light theme. The map ruled the pillarboxing itself **out of scope** and
   accepted it, but that ruling was made from **dark-theme screenshots**. A
   near-black band on a light row is a different picture. Confirm the acceptance
   still holds in light theme, or report that it does not — do **not** redesign
   the geometry, which stays out of scope.
3. **The detail hero.** [13](13-detail-sheet-prototype.md) defused the trap
   rather than tripping it — the gradient derives from `themeColors.background`,
   so text on it is legitimately a theme colour. Verify that survives light
   theme, including the **bottom fade** 13 added so the backdrop's edge is not a
   seam.
4. **Every `contentStyle`-less route this effort adds.** 13's white-sheet bug is
   a copy-paste hazard, so it is a checklist item, not a one-off fix.

## Explicitly not in this ticket

**Animation.** The map groups it with light theme and font scale, but nobody has
yet stated what the animation question *is* — 13 measured the sheet transitions
and they were clean. It stays fog until someone can phrase it.

## Constraints

- The rule to apply: **anything drawn on a surface the component darkens must be
  coloured against that surface, not the palette.**
- The play-glyph house style is settled and must not be re-derived: `fill` = 0.42
  black, stroke = fixed near-white, no scrim/disc/badge outside the glyph, fixed
  colours never theme-derived. A 26dp disc was built and rejected.
- Prototypes are disposable.

## Definition of done

Each surface either passes in light theme or has a named fix. The `PILLAR`
acceptance is re-confirmed or reported broken. The `contentStyle` hazard is a
written checklist item for the implementation effort.
