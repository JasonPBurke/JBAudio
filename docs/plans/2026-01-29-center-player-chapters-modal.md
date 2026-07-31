# Center PlayerChaptersModal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Center the PlayerChaptersModal component horizontally regardless of chapter title length.

**Architecture:** The fix requires adjusting the layout to handle MovingText's unconditional `width: 9999` style. We'll make the trackTitleContainer have an explicit shrink behavior and ensure the Pressable properly centers within its parent.

**Tech Stack:** React Native StyleSheet, Flexbox

---

## Root Cause Analysis

### Initial Hypothesis (INCORRECT)
The Pressable shrinks to fit content and needs `alignSelf: 'center'` or `width: '100%'`.

### Actual Root Cause
The `MovingText` component was modified to **always** apply `width: 9999` (previously conditional on `shouldAnimate`). This change was necessary to fix text scrolling animation issues.

**Problem Chain:**
1. `MovingText` always has `width: 9999`
2. This creates a very wide intrinsic content size
3. `trackTitleContainer` has `maxWidth: '70%'` and `overflow: 'hidden'`, but...
4. Flexbox still considers the content's intrinsic width when calculating layout
5. The Pressable's content size becomes unbalanced (icon + huge text container)
6. `justifyContent: 'center'` centers based on this unbalanced size, appearing left-aligned

### Solution
Force the `trackTitleContainer` to shrink properly and not allow its child's intrinsic width to affect the parent Pressable's size calculation. Key properties:
- `flexShrink: 1` - Allows the container to shrink below its content size
- `flexBasis: 0` or explicit width - Prevents the container from expanding based on content
- `alignSelf: 'center'` on the Pressable - Centers the whole row

---

### Task 1: Fix trackTitleContainer flex behavior

**Files:**
- Modify: `src/modals/PlayerChaptersModal.tsx:99-101`

**Step 1: Update trackTitleContainer style**

In `src/modals/PlayerChaptersModal.tsx`, update the `trackTitleContainer` style:

```tsx
trackTitleContainer: {
  overflow: 'hidden',
  maxWidth: '70%',
  flexShrink: 1,   // ADD: Allow shrinking below content size
  flexGrow: 0,     // ADD: Don't grow beyond content needs
},
```

**Step 2: Add alignSelf to chapterTitleContainer**

Update `chapterTitleContainer` style:

```tsx
chapterTitleContainer: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'center',  // ADD: Center the entire Pressable within parent
  gap: 8,
  paddingVertical: 6,
  borderRadius: 6,
},
```

**Step 3: Verify the fix visually**

1. Run the app
2. Navigate to the player screen
3. Test with:
   - Short chapter titles (e.g., "Chapter 1") - should be centered
   - Long chapter titles - should be centered and animate

**Step 4: Commit**

```bash
git add src/modals/PlayerChaptersModal.tsx
git commit -m "fix: center PlayerChaptersModal with MovingText width handling

Add flexShrink/flexGrow to trackTitleContainer to handle MovingText's
unconditional width: 9999 style. Add alignSelf: center to the Pressable
to center the icon+title row regardless of content width."
```

---

## Alternative Approaches (if Task 1 doesn't work)

### Alternative A: Wrap in a centering View
If the flexbox approach doesn't work, wrap the Pressable in a View with centering:

```tsx
return (
  <View style={{ alignItems: 'center' }}>
    <Pressable onPress={handlePress} style={styles.chapterTitleContainer}>
      {/* ... content ... */}
    </Pressable>
  </View>
);
```

### Alternative B: Use absolute positioning for the text width
Instead of `width: 9999` on the text, use a measured approach where the text is positioned absolutely during measurement, then laid out normally.

### Alternative C: Use explicit pixel width
If the container width is known from parent layout, pass it down and use explicit width instead of maxWidth percentage.
