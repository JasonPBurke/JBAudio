# 01 — Signal inventory: what series-bearing data actually exists?

Type: prototype
Status: open
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

Across a real library, **which fields carry series identity, series position, and
edition — and how consistently?** Produce an evidence table, not a hunch, and be
explicit about what is *absent*.

This is deliberately the inventory only. Designing the precedence rules is
ticket 02; resolving what a series *is* is ticket 06. Do not skip ahead — an
eager first pass that jumps to rules is exactly what splitting these two tickets
was meant to prevent.

## Why this is first

Every other decision on this map is downstream of how reliable detection can be.
If detection is 95% accurate the UI is a quiet confirmation step; if it is 60%
accurate the UI is a correction workbench. Those are different products.

## Evidence already gathered (2026-07-31, `emulator-5554`)

Read with `ffprobe` against byte ranges pulled off the device. `Grouping` does not
appear in `ffprobe`'s normalised output — it was read from the Dresden `.nfo`
files, which are MediaInfo text dumps.

| | **Dresden 01/03/04/08** | **Bobiverse 02** | **Mort (2022)** | **Mort (1980s)** | **Bands of Mourning** |
|---|---|---|---|---|---|
| `Grouping` | ✅ `The Dresden Files` | — | — | — | — |
| `album` | `The Dresden Files #1: Storm Front` | `Bobiverse 02 For We Are Many` | `Mort (#4)` | `Discworld 04 - Mort` | `Mistborn 6 (Michael Kramer)` |
| `artist` | Jim Butcher | Dennis E. Taylor | Terry Pratchett | Terry Pratchett | Brandon Sanderson |
| `album_artist` | — | — | — | Terry Pratchett | Brandon Sanderson |
| `composer` → narrator | James Marsters | Ray Porter | Colin Morgan, Peter Serafinowicz, Bill Nighy | **absent** (in `comment`: "Read by Nigel Planer") | Michael Kramer |
| `title` | = album | = album | = album | `Discworld 04 - Mort - 01` (track) | `01.The Bands of Mourning` (track) |
| `track` | — | — | — | `01/07` | `01` |
| folder | `The Dresden Files 04 - Summer Knight` | **`Dennis E. Taylor`** (author!) | `Discworld (2022)` | `Discworld/Discworld 04 - Mort` | `6.The Bands of Mourning` |
| container | m4b + cue | m4b | m4b | 7 × mp3 | 39 × mp3 |

### Five books, five conventions — the specific traps

1. **Series name location varies:** dedicated tag (Dresden) · album prefix
   (Bobiverse, Mort 1980s, Mistborn) · **folder only** (Mort 2022 — its tags
   contain no series name at all).
2. **Folder depth varies:** series folder is the *parent* for Mort 2022, the
   *grandparent* for Mort 1980s.
3. **The folder can be the author.** Bobiverse's folder is `Dennis E. Taylor`.
   Candidate guard: it *equals the `artist` tag*.
4. **The album can contain the narrator.** `Mistborn 6 (Michael Kramer)` —
   detectable because the parenthetical equals `composer`.
5. **The book title may exist only in the folder.** *The Bands of Mourning*'s
   `title` tag is the track name; the real title is in `6.The Bands of Mourning`.
6. **Narrator is not always available.** Mort 1980s has no `composer`, so the
   app's `narrator` column would be blank — it cannot be leaned on for edition
   discrimination.

## What this ticket still needs

- **Widen the sample.** 8 books cannot characterise a 350-title library. Sample
  the real library (or a larger curated pull) and report *frequencies*: how often
  is `Grouping` present? how often does `album` contain a parseable series+number?
  how often is the folder the author?
- **Enumerate the candidate signals formally**, including ones not yet looked at:
  `Album_Performer`, `Track_Position`, `Part`/`movement` atoms, `.cue` `TITLE`,
  `.nfo` presence, `sort_album`, and anything in MediaInfo's `extra` bag.
- **Confirm `Grouping` survives the JSON path.** The Dresden evidence is from
  MediaInfo's *text* output. Verify the key's exact name and location in the JSON
  the turbomodule actually returns (top-level on `General`, or under `extra`).
- **Record what is unambiguously absent**, so ticket 02 does not design rules
  around fields that are not there.

## Answer

_(unresolved)_
