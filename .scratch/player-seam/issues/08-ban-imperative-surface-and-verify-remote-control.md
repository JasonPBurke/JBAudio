# 08 — Ban the imperative surface, and verify Remote control on device

**What to build:** The seam becomes real rather than agreed. A lint rule makes
the Player library unimportable outside the adapter for everything except the
React hooks — and a device pass proves the notification, the lock screen, the
headset and Android Auto all still drive playback exactly as they did.

**Blocked by:** 05, 06, 07

**Status:** ready-for-agent

## The contract half — stage 1 of the ban

A restricted-import rule in `eslint.config.js`, written in that file's house
style: a **narrow** block with a comment recording what was *measured*, not
assumed. That file already carries two such blocks; match them.

- Applies to source.
- **Exempts the adapter, and test directories.** The test exemption is
  deliberate and honest: the fake plugs in there, so the rule reads *"only the
  adapter and its tests."*
- Stage 1 bans the default export and the enums and types — all of which the
  adapter re-exports.
- Stage 1 still **permits** the four React hooks. Ticket 10 removes them.

⚠ **The permitted list is the migration tracker.** What remains allowed is
exactly what remains unmigrated, and it empties when ticket 10 lands. Do not add
a TODO comment or a tracking ticket to say the same thing worse.

⚠ The rule does not see `require()` or module-mock string literals. Both are
acceptable given the test exemption; note it in the block's comment so the next
reader does not think it was missed.

## Known incompleteness — do not "fix" it here

The persistence module still asks the Player where it is, and then decides what
**Position** is measured against. It goes through the adapter now, which changes
the colour of the coupling and not its direction. It is marked in place with a
rule-shaped comment that names no file path. Fixing it is the queue-shape work —
see `.scratch/queue-shape/spec.md`.

## The device pass — the Remote control surface

Both runtime Queue shapes. **Position** means different things in each.

- [ ] Notification transport: play, pause, next, previous
- [ ] Lock screen controls
- [ ] Headset button: single press, double press
- [ ] Android Auto: browse, select, transport, queue scroll
- [ ] Remote seek from the notification scrubber
- [ ] Remote jump forward and back land where they did before
- [ ] Chapter skip across a boundary, both directions
- [ ] Skip-previous restart threshold still behaves at the 15s line
- [ ] Sleep timer: duck, fade, end-of-chapter option
- [ ] Playback rate persists and applies
- [ ] Book-end detection still marks a Book Finished before the credits
- [ ] Cold start from a headset play, with no app UI ever opening

## Acceptance criteria

- [ ] Stage-1 rule active; `eslint` 0 with it on
- [ ] The only permitted library imports outside the adapter are the four hooks
- [ ] `tsc` 0, test count at or above ticket 01's baseline
- [ ] Every device row above run on **both** runtime Queue shapes, result
      recorded below under `## Answer` including anything that failed
