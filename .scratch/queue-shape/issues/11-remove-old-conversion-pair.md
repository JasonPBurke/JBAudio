# 11 — Remove the old conversion pair

**Spec:** `.scratch/queue-shape/spec.md` — `### Why there are nine`.

**What to build:** The contract half of stage 2. With every consumer on the translator, the
old conversion functions are deleted and the app is left with one place that converts
between Book Position and Chapter Position.

The two functions being removed are exact inverses of each other and have been the
translator all along — unguarded, assuming the one-item mapping, correct only because their
callers branched first. The module they live in is named after one of the two shapes, which
is how a general-purpose conversion pair came to look like a special case's helper. Deleting
them is what makes the earlier tickets permanent rather than additive.

Also absorbed and removed: the chapter-index resolver and the position-to-chapter scan,
both of which are now internal steps of the translator rather than exports anyone reaches
for.

**Blocked by:** 08, 09, 10

**Status:** ready-for-agent

- [ ] The two conversion functions are deleted, not merely unexported
- [ ] The chapter-index resolver and the position-to-chapter scan are no longer public
- [ ] A grep over non-test sources proves nothing converts between the two coordinates
      outside the translator, and the grep is recorded on this ticket
- [ ] Any module left holding only a special case's name is either renamed for what it
      actually does or emptied
- [ ] `tsc` 0, eslint 0, full suite green
