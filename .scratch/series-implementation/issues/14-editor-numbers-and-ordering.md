# 14 — Canonical numbers, `Sort by number`, and bulk numbering

**Blocked by:** [12](12-editor-one-root-route.md).

**Status:** resolved — device-verified 2026-08-11 on the physical Pixel 7 Pro, both themes,
font scales 1.0 and 2.0. FOUR defects were found on device, fixed and re-verified in the same
session — three of them visible only at font scale 2.0 or in light theme. Record: [`DEVICE-CHECK-14.md`](../DEVICE-CHECK-14.md).

**Spec:** [§D3–D5, D10](../../series-ux-redesign/spec.md), §E7, §A5, §K3, §K15.

## What to build

A user sets a book's **published** number, so the badge shows the real series number rather
than its position on the shelf — and can ask the app to reorder by those numbers, or to
number an unnumbered playlist from the order they arranged.

Closes user stories 42–47 and 57.

## Three rules that are opposites of each other, deliberately

- **D3 — editing a number does NOT resort.** `position` keeps sole sort authority, so a row
  must never move out from under the cursor.
- **D4 — `Sort by number` re-seeds `position` on demand**, numerically, **NULLS LAST**, and
  **stable**, so a partly-numbered series does not shuffle its unnumbered tail. Disabled
  when nothing is numbered. It sits beside the name field.
- **D5 — bulk numbering seeds numbers from the order**, gated to **fully-unnumbered series
  only**.

`Sort by number` and bulk numbering are **exact opposites**: one seeds order from numbers,
the other numbers from order.

## Why bulk numbering is gated rather than clever

Renumbering over existing values **is a bulk destroy**, and no bulk destroy ships (A14).

**"Fill blanks only" was rejected**: on `1, _, _, 8` it manufactures false canonical data.
**Blank beats misleading.** Gated to zero-numbered series it is a pure *create* whose only
input is the order the user arranged.

## Acceptance criteria

- [x] Each row carries a `decimal-pad` canonical-number field. Editing one **does not
      resort the list**.
- [x] `canonical_number` is a **nullable NUMBER**. The letter forms (`14b`, `1-3`) are
      dropped rather than paying an alphabetic keyboard on every number edit; `14b` renames
      to `14.1`. The constraint becomes **structural** — a letter form cannot be stored even
      by accident — and most normalisation collapses into a parse.
      *Ranges are the casualty, not letters: an omnibus of books 1–3 carries a single
      number. Accepted.*
- [x] **K3 — `decimal-pad` renders the LOCALE's decimal separator.** A comma-decimal user
      types `14,1` and a naive float parse returns **`14`** — silently, no error.
      **Normalise the separator before parsing**, and unit-test it, or the fractional part
      vanishes on exactly the users whose keyboard offered it.
- [x] `Sort by number` re-seeds `position` numerically, **NULLS LAST**, stable, and is
      disabled when nothing is numbered.
- [x] Bulk numbering is available **only** when no book in the series has a number, and
      numbers `1..n` from the current drag order.
- [x] **E7 — numbering is playlist-shaped:** boxes start empty; blank means no canonical
      number; an untouched list is numbered `1..n` from its **final drag order at save**.
- [x] The badge shows `#canonical` where set and a blank where not — never a substituted
      position. *(Already true — 11 shipped it at `SeriesDetailSheet.tsx:559`. Unchanged
      here, and now reachable, because before this ticket nothing could set a number.)*
- [x] **K15 — the disabled-button label is invisible.** Confirmed on the editor's `Save` and
      the create surface's `Next`, and still live. Fix it wherever this ticket disables a
      control.
- [x] Device-verified at font scale 2.0 in both themes, including a partly-numbered series
      and one with a decimal number.
- [x] `tsc` 0 errors · eslint 0 errors · jest green (620, up from 594; 0 warnings in any
      changed file).

## What landed, and the things a reader should not re-derive

**The rule lives in one pure module**, `src/helpers/seriesNumbering.ts`, tested at
`src/helpers/__tests__/seriesNumbering.test.ts` (14 assertions):
`parseCanonicalNumber` · `orderByCanonicalNumber` · `canBulkNumber` ·
`resolveNumbersForSave`.

**1. D5 and E7 are ONE function, not two.** `resolveNumbersForSave` is gated by
`canBulkNumber`, and the `Number 1–n` button calls the same function the save path does.
So the button is precisely "do now what save would have done", and pressing it with the
gate shut is a **no-op rather than a bulk destroy** — the safe direction for the one verb
A14 refuses to ship. Driver's ruling (2026-08-11): E7 fires for **any** fully-unnumbered
list, edit as well as create, so renaming an unnumbered detected series does stamp
`#1..#n` on it. That was chosen knowingly over "create only".

**2. `seedOrder` in `seriesReconcile.ts` now DELEGATES to `orderByCanonicalNumber`.** The
spec's own comment said it existed "so a seeded series and a `Sort by number` press
agree" — two copies of one rule is the drift `docs/adr/0001` was written about. All 35
reconcile tests stayed green across the extraction, which is what proves it
behaviour-preserving.

**3. ⚠ K15 IS NOT DARK-THEME-ONLY, IT IS A COLOUR COLLISION, AND IT HAS TWO OPPOSITE
HALVES.** The dark palette sets
`textMuted` and `divider` to the **same `#d8dee9`**, so the disabled label was drawn in
its own background: **measured 1.00:1**. Light theme pairs `#4B5563` on `#9CA3AF` for
**2.98:1** — legible enough that nobody filed it, and still under AA. The fix
(`src/helpers/controlColors.ts`) makes the disabled fill a 24% tint of `divider` over the
screen background, resolved to an **opaque** hex so jest can assert it: **6.49:1 dark,
5.54:1 light**. Corollary applied to `Sort by number`: **disabled is a colour change,
never an opacity** — the prototype's `opacity: 0.4` is the same defect in a different
costume, because it drags the label toward its background instead of away from it.

**4. Four defects the device found that jest structurally could not.** Full detail in
`DEVICE-CHECK-14.md`; the transferable lessons:

- **A fixed-width box holding font-scaled text clips at 2×** (`4.5` lost the `4`'s diagonal).
  Both geometry rules are now pure functions in `seriesEditorGeometry.ts`, because a literal
  inside a StyleSheet cannot be asserted.
- **Excess legibility is a failure mode.** The disabled label passed a `>= 4.5` assertion at
  **12.57:1** — it had become brighter than body text and read as active. A one-sided
  assertion cannot see the far side; the test now pins a floor AND a ceiling.
- **⚠ Never state the disabled invariant against the ENABLED colour.** The accent is
  user-settable and may be derived from cover art (driver, 2026-08-11), so it is a free
  variable. Both bounds are stated against fixed tokens — the surface, and body text.
- **⚠ Cluster/extent screenshot measurement is BLIND to glyph clipping** (same colours, same
  extent, different shape) and **quantisation under-reports contrast near a threshold**
  (4.26 measured vs 4.61 true). The clip was caught by the driver's eye.
- **Every editable field must set `cursorColor`/`selectionColor`** to the accent. Both fields
  here were missing it, the series NAME field since ticket 12. `editTitleDetails` uses plain
  `primary`; `SearchBar`/`coverArtSearch` use `withOpacity(primary, 0.56)`.

**Ticket 15's two approved decisions the shipped editor was behind on are now in**, and the
second is load-bearing rather than cosmetic: the number box takes ~54dp off the row's left,
and moving `Remove` off the row's tail to a `Trash2` badge at the card's top-left is what
pays for it. `SeriesBookRow` is **untouched** — the editor wraps it, per 15's ruling. Its
`onRemove` prop now has no production caller and **must not be deleted**: variants A–D are
the comparison record and still use it.

**One trap paid for here, worth not paying twice:** `Model.prepareUpdate` invariants on
`!this._preparedState` and **throws** on a second call to the same row before the batch.
`updateSeries` therefore emits **one merged update per row** covering position and number
together. The row that would have hit it is one both **dragged and renumbered in the same
session** — the most likely editor session this feature has, and invisible to any test that
performs one action at a time.

## A known finding, kept because it reads like a bug and is not

**D10 — `Sort by number` silently changes the series cover**, because artwork derives from
the first book and follows a reorder. **That is the specified behaviour.** It is also the
argument for siting the artwork override right there — you watch it move, you pin it
immediately — which is [15](15-editor-series-artwork.md).
