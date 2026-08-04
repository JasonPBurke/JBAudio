# 12 — Series display setting: the backdrop toggle

Type: grilling
Status: resolved
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

**`Series Backgrounds`, in `Appearance → Display Settings`, default ON, global,
not Pro-gated, governing the browse row only.** Resolved by grilling with the
driver, 2026-08-03.

### The setting

| | |
| --- | --- |
| **Label** | `Series Backgrounds` |
| **Home** | `Appearance` (`src/app/(settings)/general.tsx`) → the existing **`Display Settings`** card, beside `Number of Columns` |
| **Control** | `ToggleSwitch`, right-aligned, matching `Auto Accent from Cover` |
| **Default** | **ON** — new users see `Blend sep ctr` |
| **Scope** | Global |
| **Pro** | Not gated |
| **Reach** | The Series browse row only |

**Description line** (always visible, muted, **no trailing period** — matching
its card-mate `Number of Columns` exactly):

> Show each series' cover art behind it in your library

**`InfoDialogPopup title='Series Backgrounds'`** (single plain string, driver's
wording):

> When enabled, each series in your library will use the first book's cover as
> the series background by default. You can search and replace the series art
> used as the background without it changing your books covers.

### Why default ON

Not because the backdrop is better — 08 measured `Blend quiet ctr` as the most
legible of the fourteen, and backdrop quality is **data-dependent** in a way
legibility is not (it is an arbitrary first cover; 08 logged real failures over
bright art like `Bobiverse`).

The deciding argument is **which dissatisfied user can rescue themselves**. A
user who finds the backdrop busy is *irritated*, and irritated users go hunting
through settings. A user seeing the quiet row does not know a richer option
exists, so they never look. Default-ON produces a user who can find the fix;
default-OFF produces one who cannot. Supporting: 08 fixed both concrete backdrop
defects (the invisible light-mode glyph, the box halo) before closing, and listed
`Blend sep ctr` first in the winner pair.

### Why `Appearance`, not the `Series Detection` card

This ticket opened suspecting 09's card was wrong for it, and that is confirmed —
but the deciding evidence is on the *other* side. `Display Settings` already
holds **`Number of Columns`**, which is the same species of preference (how a
library browse surface renders), and one card down **`Auto Accent from Cover`**
is already a boolean that derives an appearance from cover art, built from
`CompactSettingsRow` + `ToggleSwitch`. Two direct precedents on one screen.

Against that, 09's `Series Detection` card exists to carry one promise —
*nothing you do by hand is ever overwritten* — and a backdrop toggle has nothing
to do with it; its `Info` dialog would have to cover two unrelated subjects.

**The accepted cost is a split brain**: series settings now live on two screens,
detection in `Manage Library` and presentation in `Appearance`. Taken knowingly —
*"how does it look"* → Appearance is a stronger mental model than *"everything
with the word Series in it lives together"*, and it costs no new card.

**Rejected: a control on the Series screen itself.** Checked and unprecedented —
`numColumns` has **no on-screen control anywhere** in `src/`; it is set only in
settings. A browse-screen control would be a new pattern, not a followed one.

### Why the name is short

The row carries a one-line description **and** the `Info` icon, so the label does
not have to explain the feature. Driver: *"we can definitely have a short one
line explanation always visible… that would allow us to be more succinct in the
toggle name."*

**A naming constraint worth keeping**: the **cover cluster is present in both
states** — backdrop OFF still shows three fanned covers. So any label reading as
*"show cover art"* is actively wrong; it names something the toggle does not
control. The label must carry **background**, never **cover art** alone.

`Series Background from Cover` (mirroring the same-screen sibling's grammar) was
the recommendation and was **not** taken, because the always-visible description
makes the prepositional phrase redundant.

### Scope and gating are entailments, not judgment calls

- **Global.** `settings` is a **single-row wide table**, and `library_paths`
  holds an array of folder entries on that one row. This app has *one* library
  made of several folders — there is no per-library entity for a preference to
  hang off. "Per-library" is not expressible without inventing one.
- **Not Pro-gated**, and this follows from default-ON: gating a default-ON
  setting gates the ability to turn it *off*, handing free users the busier read
  and charging them to quiet it down. Note the `Theme Settings` card on this same
  screen **is** Pro-gated, so the screen is not gate-free by convention — it is
  this setting's polarity that rules it out. Same outcome as 09 by different
  reasoning: 09 refused gating because it would invert the redesign; here it is
  refused because the polarity is backwards.

### Reach: the browse row only

Ticket [11](11-series-detail-contents.md) designs the series detail screen and
has not run. A setting must not pre-commit a screen nobody has seen, and the name
is honest either way — a detail-screen header is not a "background" behind a
list. Widening the setting later is cheap; narrowing it after users have learned
it is not.

### The scrim stays 0.42 in both states

08 left this open: *"with no backdrop… the scrim is worth re-tuning for this
variant only — the contrast problem it solves is milder here, because no backdrop
is competing with the glyph."* Because **both** variants won, that became a
toggle-dependent-value question.

**08's premise does not survive inspection.** The glyph never sat on the
backdrop — it sits on the front cover of the cluster in *both* states, since the
scrim is `CoverCluster`'s `frontScrim` painted inside the cover layer (08's own
fix). `SCRIM_GLYPH` is a **fixed near-white** that must survive an arbitrary
bright cover, and that requirement is unchanged when the backdrop goes away. What
actually differs is aesthetic: with a backdrop, one darkened cover reads as part
of a darkened row; without, it reads as arbitrarily dimmed.

Making the scrim toggle-dependent would make the glyph's legibility guarantee
vary with a **display preference** — the same class of bug 08 spent a round
fixing when the glyph took its colour from the theme. One value, `0.42`, both
states. Today `BlendSeriesHome.tsx:364-365` already keys `frontScrim` on
`playSlot`/`overlayStyle` and **not** on `backdrop`, so this is "change nothing".

### Decisions this ticket makes on ticket 11's behalf

The driver's dialog copy promises a capability that does not exist:
*"you can search and replace the series art used as the background"*, and
**"by default"** only parses if an override exists.

**Ruling: a series artwork override with cover-art search WILL ship**, parallel
to the existing `/coverArtSearch` (`src/app/coverArtSearch.tsx`).
[11](11-series-detail-contents.md) **designs** it; it is no longer 11's to
decide. This hardens what the map already anticipated as fog (*"a series artwork
override — art derives from the first book and follows a reorder, so only an
override needs storing"*) into a user-facing promise.

**Two consequences 11 inherits:**

1. **Sequencing.** The override must ship **before or with** this dialog, or the
   copy describes something the user cannot do.
2. **With `Series Backgrounds` OFF, a series artwork override has nowhere to
   appear on the browse screen** — the cluster shows *book* covers, not series
   art (08). In that state the override is visible only on the detail screen. So
   the override's value is partly gated by a display preference, and 11 should
   know that before designing its entry point.

**Not reopened:** browse-row-only stands. The *artwork* is series-wide; the
*toggle* governs only whether it is drawn behind the row. Separable.

### Correction: this IS a schema change

**The ticket's own `Constraints` section is wrong** where it says "Client
setting, NOT schema." Every setting in this app is a **column on the WatermelonDB
`settings` table** (`num_columns`, `auto_accent_enabled`,
`shake_to_reset_enabled` …); `useSettingsStore` is only a Zustand cache in front
of `src/db/settingsQueries.ts`. 08's "costs no schema: the toggle is a client
setting" carries the same error.

Cost: **one boolean column on `settings` + a migration**. The map's running total
of *5 columns across 2 tables + 1 new table* is genuinely unaffected — different
table, different concern — but neither ticket may claim zero schema cost.

### Implementation consequences (for the build effort, not this map)

- **`CompactSettingsRow` needs TWO new optional props: `description` and
  `onInfoPress`.** It is `label` + `control` today
  (`src/components/settings/CompactSettingsRow.tsx:6-11`) — no description slot,
  and its control slot is occupied by the switch. This is why `timer.tsx`
  contains **two** info-icon shapes: `Fadeout Duration` gets the clean inline
  icon (`timer.tsx:369`) because its control is a `Picker` rendered *below*,
  while shake-to-reset falls back to a second row labelled **`How it works`**
  whose control *is* the icon (`timer.tsx:441-456`). Every toggle the driver
  migrates to this pattern hits the same wall. Driver approved the prop addition:
  it retires the `How it works` row app-wide, and serves the migration rather
  than this ticket alone.

  **✅ BUILT 2026-08-03, ahead of the spec** — the one exception to this map's
  *plan, don't do*, taken deliberately because it is **not a series change**: it
  serves the driver's app-wide info-icon migration, and leaving it recorded only
  in a series ticket on a branch that is not on `main` would have hidden it from
  whoever migrates the next settings screen. Both props are **optional**, so
  every existing call site is untouched. `labelRow` mirrors `timer.tsx`'s
  `fadeoutHeader` exactly (`row` / `center` / `gap: 8`) and its label style was
  already identical, so the icon ports rather than approximates; `label` gained
  `flexShrink: 1` so a long label wraps instead of pushing the icon off the row.
  The info `Pressable` carries `accessibilityRole` + `accessibilityLabel`, which
  `timer.tsx`'s two info buttons do **not** — a deliberate small improvement in
  the shared component, not a copy of the existing sites.
  Verified: tsc 0 errors, eslint clean on the file (project unchanged at 0
  errors), jest **484/484**.

  **`timer.tsx`'s `How it works` row is retired (2026-08-03), the first call
  site of the new props.** Shake-to-reset's toggle row now carries
  `onInfoPress={() => setShakeInfoVisible(true)}` and the second row is gone —
  net **−14 lines**, no dead imports (`Pressable`, `Info` and `styles.infoButton`
  are still used by Fadeout Duration). It also gained `showDivider={false}`:
  as the card's now-only row it would otherwise draw a **trailing hairline with
  nothing beneath it**, and `general.tsx`'s last-row convention is no divider.
  tsc 0 / eslint 0 errors / jest 484. **DEVICE-VERIFIED by the driver
  (2026-08-03)** on the Timer settings screen — label, inline `Info` icon and
  switch all render correctly and the dialog opens.

- **⚠ The getter must invert the house idiom.** `Series Backgrounds` is the
  **first default-ON boolean** in the `settings` table. Every existing boolean
  getter in `settingsQueries.ts` reads
  `settingsRecord[0].x === true` with `return false` as the fallback
  (`getAutoAccentEnabled` :500, `getShakeToResetEnabled` :518), which hard-codes
  **default-OFF** into both the null case and the no-record case. A migration
  adds the column as `null` for every existing user, so copy-pasting that idiom
  would silently ship every current tester the **opposite** of the chosen
  default, with no error. It must read `!== false`, with `return true` as the
  fallback.

- Column `series_backgrounds_enabled` (`boolean`, `isOptional: true`), following
  `auto_accent_enabled`'s shape; store field `seriesBackgroundsEnabled`.

- **Dead-column caution:** `mesh_gradient_enabled` is still a live column with
  **zero references anywhere in `src/`** outside the schema and model. A wide
  settings table makes adding a preference cheap and retiring one expensive.

### The product commitment, stated explicitly

As this ticket predicted, the toggle converts the **art-heavy vs quiet axis**
from a decision the spec makes into a decision the user makes. That commitment is
now live:

- **Every future change to the Series row must work in both states.**
- **Any later variant that only reads well over a backdrop is ruled out** by this
  decision.
- The tax arrived immediately — the scrim question above is exactly it, on day
  one.
