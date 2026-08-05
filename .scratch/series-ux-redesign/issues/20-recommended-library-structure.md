# 20 — Does the app proactively recommend a folder structure?

Type: grilling
Status: resolved — 2026-08-05. **No recommendation, no copy change.** See `## Answer`.
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

## Answer

Resolved 2026-08-05 by grilling. **No proactive folder-structure recommendation
anywhere, and no copy changes at all** — 09's caption and Info dialog ship
exactly as written. The decoupling from detection confidence is carried into
[19](19-write-the-spec.md)'s spec as a Detection rule.

This ticket **answers its own question in the negative and refutes the premise
that opened it.** That is the substance; the "no change" outcome is a
consequence, not an absence of work.

### 1. The ticket's stated beneficiaries do not exist

The question above says the residual gap is "books whose *tags* say nothing and
whose folder no sibling corroborates (Gentlemen Bastards, Founders Trilogy,
Drenai)" and that "a recommendation helps exactly those."

**That is wrong, and [09](09-auto-generate-series-setting.md) already said so.**
09 describes the same three as *"real series whose folders are **named
correctly** but whose tags say nothing."* Their folders are already in the shape
any recommendation would recommend. What recovers them is **turning
`Also group by folder name` on** — an existing control, already designed, already
captioned. Renaming advice does nothing for them, because there is nothing to
rename.

So the population a *structural* recommendation would serve is not the residual
gap. It is the strictly smaller set of books with **useless tags AND badly-named
folders AND** an owner willing to reorganise files on disk that the app can only
read (SAF, cue-only since 4e473e5). That is a slice of 01's ~4% dark, not the
~4% itself.

### 2. Advice is inert at the default level

Conservative — the default — self-validates every folder cluster against its own
members' tags. A flawless `{Author}/{Series}/{Book}` tree whose books carry no
series tags therefore yields **zero** series, no matter how well named.

A folder-naming recommendation only pays off for a user who *also* enables Full.
That makes the useful sentence not *"name your folders like this"* but *"turn
this on if your folders are already named after your series"* — a **targeting
hint for an existing control**, not a filing convention. And that is already
approximately what 09's caption says.

### 3. Two of the four candidate sites do not exist

Checked in `src/`, not assumed:

- **Onboarding: does not exist.** No hits for `onboarding|firstLaunch|welcome|
  tutorial` anywhere in `src/`. The app has never had a first-run flow.
- **Docs link: would be the app's first outbound link.** `Linking.openURL`
  appears **nowhere** in `src/`. `expo-linking` and `react-native-webview` are
  installed but not used for this. The app has never sent a user to a web page.

Both are **net-new app surfaces**, not sites for a paragraph. Costing them as
"a different cost and a different reach" understated them by a whole feature
each.

The ticket also **missed the one surface that would have fit**:
**`src/app/(settings)/help.tsx`**, reached from `DrawerContent.tsx:153`, is live
and populated — 6 FAQ items and 8 Tips & Gestures, including
`How do auto-chapters work?`, exactly this species of content. It was offered as
a site and declined along with the recommendation itself, so it stays unused
here. **Recorded so no future session re-derives that it exists.**

### 4. The copy does not change, because the true rule is not sayable

The obvious amendment — give the caption an applicability clause such as
*"works best when your folders are named after the series"* — was drafted and
**rejected as less accurate than what is already there.**

[02](02-detection-cascade.md) rejects a folder **on evidence, not on naming
style**: `Dennis E. Taylor` is refused because its members' albums say
"Bobiverse", while `Discworld (2022)` is trusted because 25/39 of its own albums
say "Discworld" — *same library, same code, opposite verdicts* (02 §5). And the
single bad group at Full is **`Enders Game`**, a **franchise** folder mixing 4
Ender Saga books with Children of the Fleet and two short-story collections
(02 §4) — **not** an author folder at all.

So the real rule is *"trusted unless its own members' tags contradict it"*,
which turns on **contradiction versus absence**, not on how a folder is named.
That is not expressible in a checkbox caption. 09's existing line —

> May occasionally group a folder that isn't a series

— is generic **because the precise rule cannot be stated**, and that genericness
is a feature. Any short user-facing approximation would misdescribe both the
Bobiverse rejection and the Enders Game failure.

**Copy shipping unchanged from 09, for the avoidance of doubt:**

```
[ ] Also group by folder name
    Finds series that have no series tags, using folder names.
    May occasionally group a folder that isn't a series.
```

### 5. The decoupling, stated (definition of done)

The trap never fires, because **no global prior is ever issued** — the ruling
dissolves it rather than managing it. But the guarantee is written down anyway,
and **carried into the spec** (driver's call):

> **Self-validation is never relaxed on the assumption that users have been told
> how to name folders.** Folder evidence must corroborate against the library's
> own tags on its own merits, always. If folder advice is ever added in future,
> it does not license the detector to trust folders more.

The map's Notes already carry this as a standing preference (*"never a global
prior, never enforced"*), but **a build engineer reads the spec, not this map** —
hence the addition to [19](19-write-the-spec.md), which is the only artifact this
ticket changes.

### Incidental finding — not actioned, not this map's

**`src/app/(settings)/faq.tsx` is orphaned.** It renders a stub reading
`FAQ section coming soon` and **has no route to it anywhere in `src/`** — the
only navigation to help content is `router.navigate('/help')`
(`DrawerContent.tsx:153`), and the real FAQ lives in `help.tsx`. Dead settings
code, not series work; noted for the follow-on effort rather than owned here.

### Cost

**Zero.** No copy, no schema, no code, no new surface. One sentence added to
19's brief.
