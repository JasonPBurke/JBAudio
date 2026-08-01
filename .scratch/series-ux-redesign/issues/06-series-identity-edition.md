# 06 — Series identity: is a series `name`, or `name × edition`?

Type: grilling
Status: open
Blocked by: 01, 02, 03
Parent: [map.md](../map.md)

## Question

**What identifies a series?** Today it is a user-typed `name` plus a normalised
`sort_name`, with duplicates rejected. The driver's real library breaks that
model.

Use `/grilling` and `/domain-modeling`. The output is a settled definition plus
whatever schema follows from it.

## The forcing case

The driver owns **Discworld twice** — the 1980s Nigel Planer recordings and the
2022 full-cast recordings — 41 books each, **82 books that must appear as two
separate series**.

Under the current model the only way to express that is a naming convention:
literally typing `Discworld` and `Discworld (2022)`. Which is exactly what the
driver's *folder names* already do — and what `Mistborn 6 (Michael Kramer)` does
in an `album` tag. The convention is already in use everywhere; the question is
whether the data model should learn it.

Note the discriminator is fragile: Mort 1980s has **no `composer` tag**, so its
narrator field would be blank. Edition cannot be derived from narrator alone.

## The decision

- Is **edition** a first-class attribute of a series, or just part of its name?
- If first-class: is it free text ("2022 full cast"), a narrator reference, or a
  year? What happens when narrator is missing?
- Duplicate-name validation currently rejects `sort_name` collisions
  (`seriesName.ts`). If `Discworld` can legitimately exist twice with different
  editions, that rule must change — to what?
- Does auto-detection get to *create* two series that differ only by edition, or
  must a human confirm the split? (Detection has one clean signal here — the
  folder — and one unreliable one — narrator.)
- **Playlists must survive this.** A series doubles as a personal playlist
  ("Discworld: Night Watch arc"); a model that makes edition mandatory would
  break that. Whatever lands must leave a plain user-authored set expressible.

## Inputs

- [01](01-signal-inventory.md) — what edition signals actually exist
- [02](02-detection-cascade.md) — whether the detector can distinguish editions,
  and how confidently
- [03](03-prior-art-series-ux.md) — whether *any* comparable app models editions.
  A null result is informative: it may mean this is genuinely novel, and novel
  means no borrowed answer.

## Answer

_(unresolved)_
