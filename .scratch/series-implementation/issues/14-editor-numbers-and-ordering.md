# 14 — Canonical numbers, `Sort by number`, and bulk numbering

**Blocked by:** [12](12-editor-one-root-route.md).

**Status:** ready-for-agent

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

- [ ] Each row carries a `decimal-pad` canonical-number field. Editing one **does not
      resort the list**.
- [ ] `canonical_number` is a **nullable NUMBER**. The letter forms (`14b`, `1-3`) are
      dropped rather than paying an alphabetic keyboard on every number edit; `14b` renames
      to `14.1`. The constraint becomes **structural** — a letter form cannot be stored even
      by accident — and most normalisation collapses into a parse.
      *Ranges are the casualty, not letters: an omnibus of books 1–3 carries a single
      number. Accepted.*
- [ ] **K3 — `decimal-pad` renders the LOCALE's decimal separator.** A comma-decimal user
      types `14,1` and a naive float parse returns **`14`** — silently, no error.
      **Normalise the separator before parsing**, and unit-test it, or the fractional part
      vanishes on exactly the users whose keyboard offered it.
- [ ] `Sort by number` re-seeds `position` numerically, **NULLS LAST**, stable, and is
      disabled when nothing is numbered.
- [ ] Bulk numbering is available **only** when no book in the series has a number, and
      numbers `1..n` from the current drag order.
- [ ] **E7 — numbering is playlist-shaped:** boxes start empty; blank means no canonical
      number; an untouched list is numbered `1..n` from its **final drag order at save**.
- [ ] The badge shows `#canonical` where set and a blank where not — never a substituted
      position.
- [ ] **K15 — the disabled-button label is invisible.** Confirmed on the editor's `Save` and
      the create surface's `Next`, and still live. Fix it wherever this ticket disables a
      control.
- [ ] Device-verified at font scale 2.0 in both themes, including a partly-numbered series
      and one with a decimal number.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## A known finding, kept because it reads like a bug and is not

**D10 — `Sort by number` silently changes the series cover**, because artwork derives from
the first book and follows a reorder. **That is the specified behaviour.** It is also the
argument for siting the artwork override right there — you watch it move, you pin it
immediately — which is [15](15-editor-series-artwork.md).
