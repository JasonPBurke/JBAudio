# MovingText CPU Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce CPU load from MovingText animation by using actual text measurement and reducing repeat count.

**Architecture:** Replace character-count-based width estimation with `onTextLayout` measurement for accurate scroll distance. Reduce animation repeats from 4 to 1. This eliminates over-scrolling and reduces RenderThread workload by 75%.

**Tech Stack:** react-native-reanimated 4.x, React Native 0.79, React 19

---

## Task 1: Refactor MovingText with Accurate Text Measurement

**Files:**
- Modify: `src/components/MovingText.tsx`

**Step 1: Update imports and add state for measured width**

Add `useState`, `useCallback`, and `NativeSyntheticEvent`/`TextLayoutEventData` types:

```tsx
import { useCallback, useEffect, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleProp,
  TextLayoutEventData,
  TextStyle,
} from 'react-native';
```

**Step 2: Add container width prop and text measurement state**

Update the props type and component to accept container width and track measured text width:

```tsx
export type MovingTextProps = {
  text: string;
  animationThreshold: number;
  style?: StyleProp<TextStyle>;
  containerWidth: number; // NEW: width of parent container
};

export const MovingText = ({
  text,
  animationThreshold,
  style,
  containerWidth,
}: MovingTextProps) => {
  const translateX = useSharedValue(0);
  const [textWidth, setTextWidth] = useState(0);
  const shouldAnimate = text.length >= animationThreshold && textWidth > containerWidth;
```

**Step 3: Add onTextLayout handler**

Add callback to measure actual rendered text width:

```tsx
  const handleTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const { lines } = event.nativeEvent;
      if (lines.length > 0) {
        setTextWidth(lines[0].width);
      }
    },
    []
  );
```

**Step 4: Update animation effect**

Calculate scroll distance as overflow amount and change repeat to 1:

```tsx
  useEffect(() => {
    if (!shouldAnimate) return;

    // Only scroll the overflow amount (textWidth - containerWidth) plus small padding
    const scrollDistance = textWidth - containerWidth + 20;

    translateX.value = withDelay(
      1000,
      withRepeat(
        withTiming(-scrollDistance, { duration: 5000, easing: Easing.linear }),
        1, // Changed from 4 to 1
        true
      )
    );
    return () => {
      cancelAnimation(translateX);
      translateX.value = 0;
    };
  }, [translateX, text, shouldAnimate, textWidth, containerWidth]);
```

**Step 5: Add onTextLayout to Animated.Text**

```tsx
  return (
    <Animated.Text
      numberOfLines={1}
      onTextLayout={handleTextLayout}
      style={[
        style,
        animatedStyle,
        shouldAnimate && {
          width: 9999,
        },
      ]}
    >
      {text}
    </Animated.Text>
  );
```

**Step 6: Verify complete file**

Final `MovingText.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleProp,
  TextLayoutEventData,
  TextStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type MovingTextProps = {
  text: string;
  animationThreshold: number;
  style?: StyleProp<TextStyle>;
  containerWidth: number;
};

export const MovingText = ({
  text,
  animationThreshold,
  style,
  containerWidth,
}: MovingTextProps) => {
  const translateX = useSharedValue(0);
  const [textWidth, setTextWidth] = useState(0);
  const shouldAnimate = text.length >= animationThreshold && textWidth > containerWidth;

  const handleTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const { lines } = event.nativeEvent;
      if (lines.length > 0) {
        setTextWidth(lines[0].width);
      }
    },
    []
  );

  useEffect(() => {
    if (!shouldAnimate) return;

    const scrollDistance = textWidth - containerWidth + 20;

    translateX.value = withDelay(
      1000,
      withRepeat(
        withTiming(-scrollDistance, { duration: 5000, easing: Easing.linear }),
        1,
        true
      )
    );
    return () => {
      cancelAnimation(translateX);
      translateX.value = 0;
    };
  }, [translateX, text, shouldAnimate, textWidth, containerWidth]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <Animated.Text
      numberOfLines={1}
      onTextLayout={handleTextLayout}
      style={[
        style,
        animatedStyle,
        shouldAnimate && {
          width: 9999,
        },
      ]}
    >
      {text}
    </Animated.Text>
  );
};
```

---

## Task 2: Update FloatingPlayer to Pass Container Width

**Files:**
- Modify: `src/components/FloatingPlayer.tsx`

**Step 1: Find current MovingText usage and add containerWidth prop**

Locate the MovingText usage (around line 81-85) and add the containerWidth prop. The FloatingPlayer likely has a known width or uses flex - pass the appropriate container width based on the layout.

```tsx
<MovingText
  style={[styles.bookTitle, { color: themeColors.text }]}
  text={displayedBook.bookTitle ?? ''}
  animationThreshold={25}
  containerWidth={200} // Adjust based on actual container width in styles
/>
```

**Note:** Check the StyleSheet for the actual width of the text container. If it uses flex, you may need to use `onLayout` to measure or use a known percentage of screen width.

---

## Task 3: Update PlayerChaptersModal to Pass Container Width

**Files:**
- Modify: `src/modals/PlayerChaptersModal.tsx`

**Step 1: Find current MovingText usage and add containerWidth prop**

Locate the MovingText usage (around line 56-60) and add the containerWidth prop:

```tsx
<MovingText
  text={currentChapter.chapterTitle ?? ''}
  animationThreshold={34}
  style={{ ...styles.trackTitleText, color: themeColors.lightIcon }}
  containerWidth={280} // Adjust based on actual container width in styles
/>
```

---

## Task 4: Test and Profile

**Step 1: Run the app**

```bash
npx expo start
```

**Step 2: Test with long titles**

- Navigate to a book with a title longer than 25 characters
- Open the player with a chapter title longer than 34 characters
- Verify the text scrolls smoothly and stops at the correct position

**Step 3: Profile with Flipper or React DevTools**

- Compare RenderThread and UI thread usage before/after
- Expected: ~75% reduction in animation frames (1 repeat vs 4)
- Expected: Scroll distance matches actual overflow, no unnecessary scrolling

---

## Performance Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Animation repeats | 4 | 1 |
| Scroll distance | Estimated (text.length × 4.75) | Measured (actual overflow + 20px) |
| Animation frames per cycle | ~900 | ~300 (shorter distance, shorter duration) |
| Total frames per animation | ~3,600 | ~300 |
