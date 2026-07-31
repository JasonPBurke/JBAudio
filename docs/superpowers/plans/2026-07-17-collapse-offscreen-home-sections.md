# Collapse Off-Screen Home Sections (Variation A: self-tidying) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-collapse home-screen sections once they scroll fully off-screen, keeping off-screen long lists from bloating the scroll — without reintroducing the FlashList v2 "case-3" header-drift flash.

**Architecture:** Add scroll-driven collapse to the existing single masonry FlashList in `BooksHome.tsx`. Track on-screen section ids via `onViewableItemsChanged` into a ref; on scroll-settle, delete any expanded section that is fully off-screen from the existing `activeGridSections` Set. Collapsing only off-screen content is the device-verified case-4 path (MVCP re-anchors the top visible item, no visible movement). The set logic is a pure, unit-tested helper; expansion/press behavior is unchanged.

**Tech Stack:** React Native 0.83 / Expo 55, `@shopify/flash-list` 2.3.2 (MVCP default-on), Hermes, React 19 + React Compiler, Jest 30.

## Global Constraints

- Do NOT change `handleSectionPress`, the `activeGridSections` state shape, `keyExtractor`, masonry/`numColumns` layout, or MVCP config. This variation is *additive*.
- A section is only ever collapsed while **fully off-screen**. Never collapse a visible section (that is the case-3 flash).
- `viewabilityConfig` and `onViewableItemsChanged` must be **referentially stable** (FlashList, like FlatList, does not support changing them on the fly).
- No `expo prebuild --clean` (committed `android/` holds a custom turbomodule).
- Section ids are `author.name` or `'recentlyAdded'`; every `FlatListItem` carries `sectionId`.
- Run tests with `npx jest <path>` (there is no `test` npm script).

---

### Task 1: Pure `computeRemainingOpen` helper

**Files:**
- Create: `src/helpers/collapseOffscreenSections.ts`
- Test: `src/helpers/__tests__/collapseOffscreenSections.test.ts`

**Interfaces:**
- Consumes: nothing (leaf helper).
- Produces: `computeRemainingOpen(open: Set<string>, visible: Set<string>, primary?: string | null): Set<string>` — returns the sections that stay expanded after an off-screen sweep. Keeps a section iff it equals `primary` OR is in `visible`; drops the rest. Returns the **same `open` reference** when nothing collapses (so `setState(prev => computeRemainingOpen(prev, ...))` hits React's bail-out). `primary` defaults to `null` (this variation passes no primary; variation B passes a section id).

- [ ] **Step 1: Write the failing test**

Create `src/helpers/__tests__/collapseOffscreenSections.test.ts`:

```ts
import { computeRemainingOpen } from '../collapseOffscreenSections';

describe('computeRemainingOpen', () => {
  it('drops open sections that are not visible', () => {
    const open = new Set(['A', 'B', 'C']);
    const result = computeRemainingOpen(open, new Set(['A']));
    expect([...result]).toEqual(['A']);
  });

  it('returns the same reference when nothing collapses', () => {
    const open = new Set(['A', 'B']);
    const result = computeRemainingOpen(open, new Set(['A', 'B']));
    expect(result).toBe(open);
  });

  it('returns the same reference when open is empty', () => {
    const open = new Set<string>();
    expect(computeRemainingOpen(open, new Set(['A']))).toBe(open);
  });

  it('retains the protected primary section even when off-screen', () => {
    const open = new Set(['A', 'B']);
    const result = computeRemainingOpen(open, new Set<string>(), 'A');
    expect([...result]).toEqual(['A']);
  });

  it('defaults primary to null so nothing is protected', () => {
    const open = new Set(['A']);
    const result = computeRemainingOpen(open, new Set<string>());
    expect([...result]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/helpers/__tests__/collapseOffscreenSections.test.ts`
Expected: FAIL — `Cannot find module '../collapseOffscreenSections'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/helpers/collapseOffscreenSections.ts`:

```ts
/**
 * Given the currently-expanded home sections and the set of section ids that
 * are on-screen, return the sections that should remain expanded after an
 * off-screen sweep: keep a section iff it is the protected `primary` section
 * or currently visible; drop the rest.
 *
 * Returns the SAME `open` reference when nothing collapses, so callers using
 * `setActiveGridSections(prev => computeRemainingOpen(prev, ...))` get React's
 * bail-out and skip a needless re-render.
 *
 * `primary` is `null` for the self-tidying variation (nothing protected) and a
 * section id for the lazy-single-open variation (see the sibling spec).
 */
export function computeRemainingOpen(
  open: Set<string>,
  visible: Set<string>,
  primary: string | null = null,
): Set<string> {
  let toRemove: string[] | null = null;
  for (const id of open) {
    if (id === primary) continue;
    if (visible.has(id)) continue;
    (toRemove ??= []).push(id);
  }
  if (toRemove === null) return open; // no change -> preserve reference
  const next = new Set(open);
  for (const id of toRemove) next.delete(id);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/helpers/__tests__/collapseOffscreenSections.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/helpers/collapseOffscreenSections.ts src/helpers/__tests__/collapseOffscreenSections.test.ts
git commit -m "feat: add computeRemainingOpen helper for off-screen section collapse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire scroll-driven collapse into `BooksHome`

**Files:**
- Modify: `src/components/BooksHome.tsx` (imports near lines 1-26; new refs/callbacks inside the component before `renderItem`, ~line 77; FlashList props block lines 280-307; new module const near line 37)

**Interfaces:**
- Consumes: `computeRemainingOpen` from Task 1; the existing `setActiveGridSections` prop (a `useState` setter, referentially stable); `FlatListItem` (each variant has `sectionId: string`).
- Produces: no new exported surface. Adds three FlashList props (`onViewableItemsChanged`, `viewabilityConfig`, `onMomentumScrollEnd`, `onScrollEndDrag`) driving the collapse.

> **Note — correction to spec A's "wire both events to one handler":** `onScrollEndDrag` fires at finger-lift, which may be *followed by a fling*. Sweeping unconditionally there would mutate mid-fling (velocity ≠ 0) — the exact hazard the momentum-end choice avoids. So `onScrollEndDrag` is **velocity-gated**: it sweeps only when the drag stopped with no momentum (no fling will follow); flings are handled by `onMomentumScrollEnd` (velocity ≈ 0 at settle). This preserves "tidy after any scroll gesture" without ever mutating mid-fling.

This task has no Jest test — RN scroll/viewability behavior is not meaningfully unit-testable (Task 1 covers the collapse logic). Verification is lint + typecheck of the touched files + on-device smoke. This matches the spec's testing section.

- [ ] **Step 1: Add the helper import**

In `src/components/BooksHome.tsx`, after the existing import block (the `utilsStyles` import is currently the last, line 26), add:

```ts
import { computeRemainingOpen } from '@/helpers/collapseOffscreenSections';
```

- [ ] **Step 2: Add the stable viewability config constant**

Near the other module-scope declarations (e.g. just below the imports, around line 27), add:

```ts
// Stable reference required: FlashList does not support changing
// viewabilityConfig on the fly. threshold 1 => a section counts as on-screen
// while even a sliver of any of its items shows, so we only collapse a section
// once it is FULLY off-screen.
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 1 } as const;
```

- [ ] **Step 3: Add the viewability ref, viewability handler, and sweep handlers**

Inside the `BooksHome` component, after `listRef` is declared (line 64-65) and before `renderItem`, add:

```ts
  // Section ids currently on-screen, refreshed by onViewableItemsChanged.
  // A ref (not state) so viewability churn during scroll never re-renders.
  const viewableSectionsRef = useRef<Set<string>>(new Set());

  const handleViewableItemsChanged = useCallback(
    ({
      viewableItems,
    }: {
      viewableItems: { isViewable: boolean; item: FlatListItem }[];
    }) => {
      const next = new Set<string>();
      for (const token of viewableItems) {
        if (token.isViewable && token.item) next.add(token.item.sectionId);
      }
      viewableSectionsRef.current = next;
    },
    [],
  );

  // Collapse every expanded section that is now fully off-screen. Safe because
  // off-screen collapse is the verified case-4 path (MVCP keeps the top visible
  // item anchored; nothing on screen moves). computeRemainingOpen returns the
  // same Set reference when nothing collapses, so React bails out.
  const collapseOffscreenSections = useCallback(() => {
    setActiveGridSections((prev) =>
      computeRemainingOpen(prev, viewableSectionsRef.current),
    );
  }, [setActiveGridSections]);

  // Fired at finger-lift. If a fling will follow (velocity != 0), do NOT sweep
  // here — that would mutate the list mid-fling; onMomentumScrollEnd handles it
  // once the fling settles. Only sweep on a no-momentum drag release.
  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vy = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(vy) < 0.01) collapseOffscreenSections();
    },
    [collapseOffscreenSections],
  );
```

(`useRef` and `useCallback` are already imported at line 2; `NativeScrollEvent`/`NativeSyntheticEvent` are already imported at line 3.)

- [ ] **Step 4: Attach the props to the FlashList**

In the `<FlashList ... />` block (lines 280-307), alongside the existing `onScroll={onScroll}` prop (line 292), add these four props:

```tsx
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onMomentumScrollEnd={collapseOffscreenSections}
        onScrollEndDrag={handleScrollEndDrag}
```

- [ ] **Step 5: Lint and typecheck the touched files**

Run: `npx eslint src/components/BooksHome.tsx src/helpers/collapseOffscreenSections.ts`
Expected: no errors on these files.

Run: `npx tsc --noEmit 2>&1 | grep -E "BooksHome|collapseOffscreenSections" || echo "no type errors in touched files"`
Expected: `no type errors in touched files`. (The repo may have pre-existing errors elsewhere; this checks only the files this task touches.)

- [ ] **Step 6: Commit**

```bash
git add src/components/BooksHome.tsx
git commit -m "feat: collapse home sections once scrolled off-screen

Sweep runs on momentum-scroll-end and on no-momentum drag-end (velocity
gated to avoid mid-fling mutation). Off-screen-only collapse rides the
verified case-4 MVCP path, so no header-drift flash. Expansion behavior
unchanged. See docs/superpowers/specs/2026-07-17-collapse-offscreen-home-sections-design.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: On-device verification (A/B vs `main`)

**Files:** none (manual verification). Do NOT skip — the whole point is a flash-free scroll feel, which only a device shows.

**Interfaces:** none.

- [ ] **Step 1: Build and launch on device**

Run: `npx expo run:android` (the app is Android-only; `android/` is committed — never `prebuild --clean`).
Expected: app launches to the library home screen.

- [ ] **Step 2: Verify self-tidying + no flash**

Manually confirm each:
1. Expand two author sections that both fit on screen → both stay expanded (visible multi-open preserved).
2. Expand a long author section, scroll down *into* its books → it stays expanded while any of its books are visible.
3. Scroll until that section is fully past the top → on scroll-settle it collapses back to a horizontal row, with **no visible jump/flash** of the content that stays on screen (case-4 check).
4. Scroll back up → the tidied section is a horizontal row again; tap re-expands it.
5. Slow-drag (no fling) until a section goes off-screen and lift your finger → it still collapses (velocity-gated `onScrollEndDrag` path).
6. A short library where an expanded section never leaves the viewport → it simply stays open (no forced collapse).

- [ ] **Step 3: A/B against `main`**

Run: `git stash --include-untracked` is NOT needed (work is committed). Compare feel against `main` (never auto-collapses) by checking out `main` in a separate build if desired. Confirm the branch behaves identically to `main` for expansion, differing only in the off-screen tidy-up.

- [ ] **Step 4: Record the result**

If verified, note it in the commit/PR description and update memory `flashlist-2.3.2-mvcp-header-anchor` with the outcome. If any flash or fling stutter appears, STOP and revisit: most likely the `itemVisiblePercentThreshold` (try a slightly higher value) or the drag-end velocity threshold — do not disable MVCP (that regressed the common case in prior attempts).

---

## Notes for the implementer

- The verified "case 4" (off-screen collapse is flash-free) and the rejected alternatives (scrollToIndex pin, MVCP-disable, cap-with-eviction) are documented in memory `flashlist-2.3.2-mvcp-header-anchor`. Do not re-try the rejected ones.
- `BooksHome.tsx` starts with `'use no memo'` because it receives a Reanimated `onScroll` handler. The JS callbacks added here (`onMomentumScrollEnd`, `onScrollEndDrag`, `onViewableItemsChanged`) coexist with the animated `onScroll` — verify on device that `onMomentumScrollEnd` still fires with the animated handler attached (Step 2.3 exercises this).
- Variation B (lazy single-open) reuses everything here and passes a non-null `primary` to `computeRemainingOpen`; do not delete or rename the helper's `primary` param.
```
