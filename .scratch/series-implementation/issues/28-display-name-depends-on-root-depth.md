# 28 — the elected display name depends on where the library root was pointed

**Status:** needs-triage

**Source:** Traced out of **finding 15** of the [code review vs d2195ed](../CODE-REVIEW-d2195ed.md),
2026-08-14. The finding itself was **refuted by measurement** and closed; this is the real residual
it uncovered, pointing the opposite way.

## The defect

`electDisplayNames` (`src/helpers/seriesDetection.ts`) gathers folder candidates with:

```ts
for (let d = 1; d < parts.length - 1; d++) candidates.push(cleanDirName(parts[d]));
```

`parts` comes from `a.unit.rel`, which is the book's **DIRECTORY** relative to the library root —
never the file (see the `DetectionUnit.rel` doc comment). So both bounds are positional, and the
window they leave open depends on how deep the user's root sits:

| library root | `rel` for the same book | folder candidates |
| --- | --- | --- |
| `/Audiobooks` | `Terry Pratchett/Discworld/Reaper Man` | `Discworld` ✅ |
| `/Audiobooks/Terry Pratchett` | `Discworld/Reaper Man` | **none** — `d = 1; d < 1` runs zero times |
| `/Audiobooks/Terry Pratchett` (flat) | `Discworld` | **none** |

Same books, same tags, different display name — decided by a setting that is meant to be about
*where files live*, not about what they are called. When no folder qualifies, the name falls back
to the tag-parsed `a.name`, so the folder's tidier spelling can never win.

⚠ **This is the exact defect class `folderClusters`' header describes and says was FIXED there**:
depth is "a fact about where the user pointed their library root, not about the books". Rooting at
`/Audiobooks/Terry Pratchett` once already merged 47 Discworld editions into one series. That rule
was removed from clustering; `electDisplayNames` is where it survived.

## ⚠ Do NOT "fix" this by starting the loop at 0 — that is a different, worse bug

Measured 2026-08-14, all three variants against the 73-test detection suite:

| variant | result |
| --- | --- |
| `d = 0; d < parts.length - 1` | **2 failed** |
| `d = 0; d < parts.length` | **2 failed** |
| `d = 1; d < parts.length` | 73 passed (corpus-neutral) |
| shipped `d = 1; d < parts.length - 1` | 73 passed |

`parts[0]` is the **author level**. Including it elects **`Martha Wells`** over
**`The Murderbot Diaries`**. The `d = 1` start is the author guard and must not be removed without
a replacement.

## What a real fix has to do

Refuse author folders on the **tags** rather than on **position**, the way clustering already does
(`isAuthorish`, which works at every depth). That was measured too, and it is **not a drop-in**:

- ✅ It fixes the author case properly — Murderbot stays correct.
- ❌ It still fails `A1 · extra.SERIES outranks a disagreeing album pattern`, and the reason is a
  **second, independent weakness**: the candidate filter accepts anything satisfying
  `key.includes(ck)`, so the one-character fixture folder `A` qualifies as a candidate for
  `The Expanse` (`'expanse'.includes('a')`), and the *shortest-wins* tie-break elects `A`.

So the fix is two changes, not one: tag-based author refusal **plus** a length/containment guard on
candidates so a short folder cannot impersonate a long series name.

## Acceptance criteria

- [ ] The elected display name is **identical** for the same books under two different library
      roots (one and two levels up). This is the criterion; a test with two `rel` shapes pins it.
- [ ] `The Murderbot Diaries` still beats `Martha Wells`, by a **tag-based** refusal.
- [ ] A one-character or otherwise degenerate folder cannot be elected over a real series name.
- [ ] The corpus baseline is unmoved: **19 series / 179 books conservative, 28 / 213 full**, and
      A4's 80-book Discworld split still lands at 41 + 39.
- [ ] jest green · `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- The reasoning above is recorded in the comment block on `electDisplayNames` itself, so it is not
  re-derived a fourth time. **Keep the comment and the code in step.**
- Measuring beats arguing here: the corpus harness answers a variant in seconds, and it was the
  failure MESSAGE (`Martha Wells`) that named the invariant nobody had written down.
- Never run a formatter over this repo — there is no config file.
