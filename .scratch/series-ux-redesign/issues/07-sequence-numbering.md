# 07 — Sequence numbering: position, canonical number, or both?

Type: grilling
Status: resolved
Blocked by: 01
Parent: [map.md](../map.md)

## Question

The driver's diagnosis of the current UI: *"the series IS ordered once created,
but the books do not have a visual cue showing this fact"* — with a proposed fix
of **a number overlaid on the cover, like the play/pause button treatment.**

Before that can be designed, the number has to mean something. **Which number?**

## The ambiguity

The library holds Dresden Files **1, 3, 4, 8** — non-contiguous. So the badge on
*Summer Knight* reads either:

- **3** — its **position** in the user's set (what exists today:
  `series_books.position`, 0-based), or
- **4** — its **canonical number** in the published series (what the tags say:
  `album` = `The Dresden Files #4: Summer Knight`).

These answer different questions. Position answers *"what do I play next?"*.
Canonical number answers *"what am I missing?"*. Both are legitimate; they are not
interchangeable; and the divergence is not an edge case — it is the driver's
normal state, since the curated set is deliberately full of gaps.

## The decision

- Show one, or both? If one, which — and does the other need to exist anyway for
  sorting?
- **Canonical number does not exist in the schema.** Adding it means a column, a
  detection source, a manual entry point in the wizard, and an override path when
  detection is wrong. That is a real cost; is it earned?
- Where does the canonical number come from when tags lack it? Mort 2022's `album`
  is `Mort (#4)` — number present, series name absent. Bobiverse's is embedded in
  a title string. Some books will have none.
- **Sort order vs display.** If canonical numbers exist, should the series sort by
  them automatically instead of by drag-ordered position? That would make the
  drag-sort wizard step redundant for detected series — a meaningful simplification
  of the wizard, or a loss of control.
- Half-numbers: novellas are routinely 2.5 or 0.5. Integer column or float?
- Do gaps get **rendered**? A greyed placeholder for the missing Dresden 2 tells
  the user what to buy next; it also clutters a shelf with things they do not own.
  This is a display decision that depends on the number's meaning.

## Design constraint carried in

Whatever this resolves, the browse prototype (ticket 08) needs a concrete rule for
what the badge shows — the badge treatment cannot be prototyped against an
undecided number.

## Answer

Resolved 2026-08-02 by grilling. **Both numbers exist, and each gets exactly one
job.** The badge shows the **canonical number**; **`position` remains the sole
sort authority**. Canonical is stored **per-membership**, is **nullable**, and is
**blank rather than guessed** wherever the evidence doesn't name that series.

| | `position` (exists, v32) | `canonical_number` (new, v33) |
|---|---|---|
| Job | **orders** the shelf | **informs** — "what am I missing?" |
| Authority | drag / user, always wins | detection, user-correctable |
| Rendered as | reading order — no ink | badge on the cover |
| Null? | never | yes — and blank is the honest default |
| Wrong value costs | books in the wrong order (structural) | a bad badge (cosmetic) |

That asymmetry in the last row is the point of the split: after this decision a
detection error can no longer corrupt the shelf, only mislabel a cover. It buys
the map's **abstention bias** through separation of concerns rather than through
confidence thresholds.

### The six questions, answered

**1. Show one, or both? → Canonical only. Blank when unknown.**

Position is *already conveyed by layout*. A badge reading `3` on the third cell
is confirmation; `4` on the third cell is information the grid cannot carry — you
are missing #2. Position is not badged, but it does not go away: it keeps doing
the job it already does.

Rejected: **canonical-with-position-fallback**. On Dresden 1, 3, 4, 8 with one
number missing it renders `1, 3, 4, 4` and the user cannot tell which badge means
what. Two meanings in one glyph is worse than one meaning and a gap.

Accepted cost: ~40% of in-series books (ticket 01) and 100% of pure playlists get
no badge, so the driver's original "no visual cue of order" complaint is only
partly answered by this ticket. The remainder is **08's** — order legibility is a
layout problem as much as a numbering one.

**2. Is the schema cost earned? → Yes.** One column, plus one companion (below).
Prior art in ticket 03 is unanimous and the field is not derivable from anything
that exists today.

**3. Where does the number come from when tags lack it? → Ticket 02's cascade.**
Deliberately not decided here; see *Handoff to 02*. A **human override must
exist** — Snuff proves detection can be confidently wrong — but **where that UI
lives is not this ticket's call**: it graduates with the review-and-correction
fog, which waits on 02 and 06. Siting a number field in the wizard now would
pre-commit the 3-step funnel's shape, which the map still lists as unsettled.

**4. Sort order vs display → `position` stays the sole sort key.**

Canonical **seeds** position — at series creation, and again when a book is added
later, so a Dresden #2 acquired six months from now slots into place instead of
appending to the end. After seeding, position owns order and a drag always wins.

Rejected: **sorting by canonical (float, nulls last)**, i.e. Audiobookshelf's
query. It self-heals, and it would have made the wizard's drag step redundant —
but when detection is wrong, dragging could not fix it, which contradicts 03's
finding that corrections must be top-precedence *inputs*. The driver's own
evidence decided it (see *Evidence correction* below).

Also rejected: a **per-series auto/manual mode flag** — structurally Jellyfin's
lock approach, which 03 found to be a documented, unfixed mess.

The wizard's drag-sort step is therefore **not** redundant. It is *pre-sorted and
usually already correct*, which is the real simplification — fewer drags, not a
removed step. An explicit **"Sort by number"** action stays available as a future
affordance; it needs a series detail screen to live on, so it stays in the fog.

**5. Half-numbers → nullable string, float-parsed for sort.**

`canonical_number: string | null`. Holds every shape ticket 01 found: `12.5`,
`0.5` (novellas), `14b`, `1-3` (omnibus spanning three books). **Normalised on
write** — strip `#`, `Book `, `Volume `, and leading zeros, so `04` stores as `4`
and badges read cleanly. Float parsing happens in a **pure helper** (RN-free,
DB-free, so it unit-tests under this repo's jest config) and is needed only for
seeding position and collapsing the header range — not for rendering.

Rejected: a **float column** (`14b` and `1-3` become unrepresentable, and both
are real in this library) and a **two-column sort-value/display-label pair**
(two fields that can drift, for a value that no longer drives sorting).

**6. Are gaps rendered? → No placeholders. The header carries the range.**

Never render a book the user does not own — 03 found no app anywhere does this,
and it would fill the library with things to buy. Gaps stay legible through the
collapsed range on the section header (`#1, 3-4, 8`), which is **already built
and device-verified**: `collapseNumberRange` in
`src/prototypes/syntheticSeries.ts:263`, including the two-long-run collapse.

One layout guard is required. In the prototype header the title is
`flexShrink: 1` and the range is `flexShrink: 0`, both `numberOfLines={1}`
(`NumberedSeriesHome.tsx:334-345`) — so a ragged set like
`#1, 3-4, 8, 12, 15-17, 22` does not wrap, it **eats the series name**. Cap the
range and elide (`#1, 3-4, …`).

Accepted caveat: in a partly-numbered series the range describes only the
numbered books, so it can under-report.

### Rescan behaviour — and the companion column

**`canonical_source: 'user' | 'detected' | null`**, on the same row.

- A rescan **replaces `detected` values freely** and **never touches `user`**
  ones.
- This is Audiobookshelf's model in substance: a correction becomes the
  highest-priority input the detector reads, not a lock it fights (03 §4).
- It keeps detection **self-improving** as 02's cascade matures, while making
  corrections permanent.

Rejected: **no companion column, fill-nulls-only**. Simpler, and corrections
would survive by construction — but the first guess becomes permanent, so every
wrongly-detected number is frozen until hand-fixed and later cascade improvements
can only ever help books that were blank. Also rejected: **detection always
wins**, which would silently revert corrections on the next scan.

This deliberately pre-empts one slice of the map's *consolidated schema
decisions* fog — the "user-override / don't-re-detect flag" — because committing
to the column made that question sharp. Edition, detection confidence and series
artwork remain in the fog.

### One book in two series (driver's question, verified in code)

*Guards! Guards!* is Discworld **#8** and Night Watch **#1**. Both hold, and
**editing one never touches the other** — because canonical lives on the join
row, beside `position`, not on `books`. The number depends on the **(book,
series) pair**, so putting it on `books` would be a normalisation error that
surfaces the first time a sub-series is created.

Current behaviour, confirmed against v32 source:

- The wizard's book picker filters only by selected author and structural-key
  presence (`src/app/series/create/books.tsx:53-67`). It does **not** exclude
  books already in another series.
- `series_books.book_key` is indexed but **not unique** — WatermelonDB has no
  unique indexes at all. The feature's only global uniqueness is series
  `sort_name` (`seriesQueries.ts:assertSeriesNameAvailable`).
- Every write path is scoped by `series_id`: `createSeries` writes rows for the
  new series only; `updateSeries` fetches `Q.where('series_id', id)` before
  diffing (`seriesQueries.ts:85`), so `computeMembershipDiff` can only ever see
  one series' rows.
- `assembleDerivedSeries` buckets memberships by series and resolves each
  independently, so the same `Book` renders on both shelves.

So *Guards! Guards!* **already** holds position 7 in Discworld and position 0 in
Night Watch today. Canonical inherits that independence for free.

**Gap:** no test covers multi-membership. It is structurally supported but
unexercised — see *Handoff to implementation*.

**Seeding a hand-made sub-series → seed only on a series-NAME match.**

The tag on *Guards! Guards!* says "Discworld #8" — a signal naming the **parent**
series. Detection writes canonical only where the detected series name matches
the series being seeded, so a user-created "Discworld: Night Watch" starts with
**null canonical on every row and no badges at all** until the user numbers it.
The driver explicitly offered to accept wrong-but-editable sub-series numbers;
blank was chosen instead, because an `8` at the head of a Night Watch shelf is
*actively false*, and question 1 already ruled that blank beats misleading.

A useful consequence: sub-series numbers can be wrong (or absent) without the
shelf being out of order. Parent numbers are monotonic in the same direction as
the sub-series' true numbering, so ordering survives regardless. **Badge
correctness and sequence correctness are now genuinely decoupled.**

Note also that editing canonical does **not** re-seed position — seeding happens
at create and at insert only. Renumbering Night Watch 1–8 will not re-shuffle it.

### Schema delta (concrete)

`src/db/schema.ts:4` — **v32 → v33**. One `addColumns` step on `series_books`,
both columns optional, so existing rows need no backfill:

```ts
{ name: 'canonical_number', type: 'string', isOptional: true },
{ name: 'canonical_source', type: 'string', isOptional: true },
```

Carries the standing hazard already on the map: **wipe any device that ran the
old series v31.**

### Handoffs

**To 02 (detection cascade)** — three requirements this ticket imposes:

1. Emit a **normalised number string** per *(book, series)* alongside the series
   name, in the shapes listed under question 5.
2. Seed a membership **only when the detected series name matches** that series.
3. Rank **folder above `.nfo` `Position in Series`** as a number source — see the
   evidence correction below.

**To 08 (browse presentation)** — 07 no longer blocks it; 08 now waits only on
06. Its rule: **the badge shows canonical when known and nothing otherwise.**
Whether the *collapsed horizontal row* badges as well as the expanded grid is
08's presentation call, not this ticket's — the prototype currently badges only
the expanded grid (`NumberedSeriesHome.tsx:138-166`).

**To implementation (out of scope for this map)** — add a test covering one book
in two series with different canonical numbers, since no test exercises
multi-membership today.

### Evidence correction to ticket 01

Ticket 01 logged, neutrally, that Snuff's folder says `Discworld 39` while its
`.nfo` says `Position in Series: 33`. **The folder is right: Snuff is the 39th
Discworld novel; 33 is *Going Postal*.** (Driver, 2026-08-02.)

This matters twice over. It demotes `.nfo` `Position in Series` as a trusted
number source for 02's cascade — a tidy, machine-readable, purpose-built field
that is simply **factually wrong** — and it is the strongest argument for the
sort-authority decision above: if even the cleanest-looking source lies, a
human-owned `position` has to remain the authority.
