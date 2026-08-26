# 03 — Author the chapter-boundary device checklist

**What to build:** A written list of everything that visibly changes on screen
when a chapter turns over inside one Book — derived by reading the code as it
behaves **today**, before anything is migrated. That list is the test ticket 10
runs on a device.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## ⚠ Why the ordering is the whole point

Ticket 09 replaces a hook that re-renders on **every active-track change**
(including chapter-to-chapter inside one Book) with a store selector that
re-renders only when the **Active Book** changes. Strictly fewer renders, and the
direction the player-state store's own docblock already argues for — but any
site that silently depended on re-render-at-chapter-boundary goes stale.

**A stale render is indistinguishable from a correct one** unless you already
know what should have moved. Written after the migration, this list describes
the new behaviour and certifies nothing.

## Method

For each of the twelve files named in ticket 09, read it and answer one
question:

> When a chapter turns over **within the same Book**, what does this file cause
> to change on screen?

Record each answer as an observable in the user's words — "the highlighted row
in the chapter list moves down one" — not as an implementation note. If the
answer is "nothing", record that: it is a prediction that the site is safe, and
it is far better to be wrong about it here than on a device.

Where a file already tracks the chapter index through its own event
subscription rather than through the hook, say so. Those are the sites expected
to be unaffected, and naming them is how a surprise gets noticed.

## Seed — incomplete and unverified, read the files

- chapter list screen — highlighted chapter row moves
- player screen — contents follow the chapter
- title details — active-Book state, play/pause glyph
- footprint list — likely nothing, the list is per-Book
- floating player — title and artwork
- player controls — transport state, chapter-dependent affordances
- player progress bar — bar resets, chapter label changes
- book time remaining — recomputes; ⚠ already tracks the index via its own
  active-track-changed subscription
- player state sync — the mirror writer itself, no UI of its own
- stable current-chapter hook — feeds the chapters modal and the progress bar;
  ⚠ already reads the index from the library store, with a cold-mount fallback
- last-active-track hook — deleted by ticket 09; check both consumers keep their
  sticky-last behaviour
- track-player state logger — logging only

## Both runtime Queue shapes

Every row runs twice. Chapter-crossing means different things depending on what
**Position** is measured against, and per the book-end work a real book cannot
always distinguish the two — synthesise a case with ffmpeg if the library lacks
one. See the queue-shape taxonomy in the book-end-detection notes.

## Acceptance criteria

- [ ] One row per file from ticket 09's list, none omitted
- [ ] Each row names an observable, in the user's words
- [ ] Each row states which runtime Queue shape it applies to, or both
- [ ] Sites that already track the index independently are marked as such
- [ ] The checklist is recorded below under `## Answer`
