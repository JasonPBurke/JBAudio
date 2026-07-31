# Artwork Display Size Compensation

## Problem

When users change Android's display size settings (via Settings > Display > Display size), the artwork in PlayerArtwork component becomes physically smaller on screen. This occurs because the `FIXED_ARTWORK_HEIGHT = 350` constant uses logical pixels (dp), which scale with display settings.

## Solution

Compensate for display scaling by dividing the desired height by the font scale factor. This normalizes the height to maintain consistent physical dimensions regardless of display settings.

## Implementation

### Core Calculation

```typescript
import { PixelRatio } from 'react-native';

const DESIRED_ARTWORK_HEIGHT = 350;
const FIXED_ARTWORK_HEIGHT = DESIRED_ARTWORK_HEIGHT / PixelRatio.getFontScale();
```

### How It Works

- When `getFontScale()` returns 1.0 (normal display size): height = 350dp
- When `getFontScale()` returns 1.3 (large display size): height ≈ 269dp
- The smaller logical pixel height renders at the same physical size as 350dp at normal scale

### Files Modified

1. **src/components/player/PlayerArtwork.tsx**
   - Added PixelRatio import
   - Updated FIXED_ARTWORK_HEIGHT calculation

2. **src/app/player.tsx**
   - Added PixelRatio import
   - Updated FIXED_ARTWORK_HEIGHT calculation
   - artworkWidth calculation automatically benefits

3. **src/app/titleDetails.tsx**
   - Added PixelRatio import
   - Updated FIXED_ARTWORK_HEIGHT calculation
   - Inline width calculation automatically benefits

## Behavior

- **Calculation timing:** Height is calculated once on app initialization (module load)
- **Dynamic updates:** Not supported - users must restart app after changing display settings
- **Visual consistency:** Artwork maintains same physical height across all display size settings

## Trade-offs

- ✅ Simple implementation using built-in React Native API
- ✅ Maintains visual consistency across display settings
- ✅ No runtime performance impact (calculated once)
- ⚠️ Requires app restart for changes to take effect
- ⚠️ Assumes font scale correlates with desired visual scaling (appropriate for this use case)
