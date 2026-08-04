# 20 — Does the app proactively recommend a folder structure?

Type: grilling
Status: open
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

Driver-raised 2026-08-01, deliberately parked until
[02](02-detection-cascade.md)'s numbers existed. They exist, and they **weaken**
the case that opened it:

- Folders are already used **without a consent switch** — self-validation
  against the cluster's own members' tags rejects the bad ones on evidence.
- Conservative reaches **98.3% purity with 0 standalones swept**.
- [09](09-auto-generate-series-setting.md) surfaced Full fidelity as the plain-
  language `Also group by folder name` (default off), so folder naming is now a
  thing the user can **deliberately opt into**, and that switch's caption is the
  natural home for any advice.

So the broad question is answered. What is left is narrow and genuinely open:

1. **Should the app say anything about folder structure anywhere beyond that one
   caption?** The residual gap is real — books whose *tags* say nothing and whose
   folder no sibling corroborates (Gentlemen Bastards, Founders Trilogy, Drenai).
   A recommendation helps exactly those, and nothing else.
2. **If yes, where?** Candidates: the `Also group by folder name` caption itself
   (already exists, costs nothing), the `Series Detection` card's `Info` dialog
   (09 established the `InfoDialogPopup` pattern from `timer.tsx`), onboarding,
   or a docs link. Each has a different cost and a different reach.
3. **What exactly is recommended?** [03](03-prior-art-series-ux.md) found
   Audiobookshelf **mandates** `{Author}/{Series}/{Book}` and refuses to infer
   depth. This app deliberately does not enforce structure. Recommending ABS's
   shape without enforcing it is coherent — but only if the detector actually
   rewards it, which needs saying out loud.

## The trap to avoid

**Abstention bias cuts both ways here.** The standing preference says folder
conventions are "per-library evidence that must self-validate against that
library's tags; never a global prior, never enforced." A *recommendation* is a
soft global prior. If the app tells users to name folders a certain way, some
will, and the detector must not then start trusting folders more than the
evidence warrants. Whatever is decided, the recommendation and the detector's
confidence rules have to stay decoupled.

## Why this is small

It is one paragraph of copy and its location, or a decision to write none. It is
ticketed rather than left as fog because the question is now sharp, not because
it is large.

## Definition of done

Either "no proactive recommendation, and here is why" or the copy plus its site,
with the decoupling from detection confidence stated either way.
