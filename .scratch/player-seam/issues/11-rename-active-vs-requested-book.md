# 11 — Rename Active Book vs Requested Book

**What to build:** The two fields currently both called `activeBookId` say which
question each answers, so the next person to read one learns there are two of
them before merging them.

**Blocked by:** 10

**Status:** needs-triage

## The problem

Two stores hold a field called `activeBookId`. They are **not** duplicates.

| | queue store | player-state store |
| --- | --- | --- |
| Written by | the play / restore / remote-play path, when the user asks | the sync component, from what the Player reports |
| Means | **Requested Book** — intent | **Active Book** — observation |
| Timing | **leads** a switch | **lags** a switch |
| Also used as | an input, to tell "same Book" from "a switch" | read-only |

They agree during steady playback and diverge for the length of a switch. Five
components read **both**, in one case four lines apart, with no name to tell
them apart. Ticket 02 surfaced a live consequence: four callers of the same
helper pass different sources into the same argument position.

Both terms are now defined in `CONTEXT.md`. The glossary entries were the actual
fix, because the defect is conceptual. This ticket is the code catching up.

## Why it is worth doing

This is the third instance of the same failure in this repo, and the glossary's
`Keys and identity` cluster exists because of the first two — a key that looked
like a foreign key and was not, and a key that answered two questions and was
about to be edited for the wrong one. Both were about to cause a data-level
change while looking like a display-level one. The rule at the top of that
cluster: **name a key after the question it answers.** `activeBookId` is named
after neither.

## ⚠ Do not merge them

The switch path reads the intent one specifically. Merging breaks
book-switching, and it will look correct in every test that does not switch
Books mid-playback.

## Acceptance criteria

- [ ] Both fields and their selectors renamed to carry the distinction
- [ ] The four callers from ticket 02 are reconciled, or their difference is
      recorded as deliberate with a reason
- [ ] No behaviour change — the divergence window stays exactly as it is; the
      point is that it becomes visible
- [ ] `tsc` 0, `eslint` 0, test count at or above baseline

## Triage note

`needs-triage` rather than `ready-for-agent`: the naming wants a driver ruling,
and it is worth deciding whether this rides along with the queue-shape work,
which touches an overlapping set of files.
