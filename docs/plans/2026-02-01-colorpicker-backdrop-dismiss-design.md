# ColorPicker Modal Backdrop Dismiss Design

**Date:** 2026-02-01
**Component:** `ColorPickerModal` (`src/components/ColorPicker.tsx`)
**Goal:** Allow users to dismiss the color picker modal by tapping the backdrop, discarding any unsaved color changes.

## Requirements

When a user taps the dark semi-transparent area (backdrop) around the color picker modal:
- The modal should close immediately
- Any color changes should be discarded (not saved)
- The "Done" button should continue to save and close as before

## Design

### Approach: Separate Handler Functions

We'll use two distinct handler functions with clear responsibilities:

1. **`handleDone()`** - Save and dismiss (existing behavior)
   - Saves `resultColor` to store via `setCustomPrimaryColor()`
   - Calls `onClose()`
   - Triggered by: "Done" button

2. **`handleDismiss()`** - Dismiss without saving (new)
   - Simply calls `onClose()` without saving
   - Discards color changes
   - Triggered by: Backdrop tap, Android back button

### Implementation Details

#### 1. Handler Functions

Add new `handleDismiss()` function:
```typescript
const handleDismiss = () => {
  onClose();
};
```

Update Modal's `onRequestClose`:
```typescript
<Modal
  visible={isVisible}
  transparent
  animationType='fade'
  onRequestClose={handleDismiss}  // Changed from onClose
>
```

This ensures Android's back button dismisses without saving.

#### 2. Backdrop Pressable

Wrap the modal overlay content with a Pressable for the backdrop hit area:

```typescript
<View style={colorPickerStyle.modalOverlay}>
  <Pressable
    style={StyleSheet.absoluteFill}
    onPress={handleDismiss}
    accessibilityLabel="Close color picker"
    accessibilityRole="button"
  >
    {/* Empty - this is just the backdrop hit area */}
  </Pressable>

  <View style={[colorPickerStyle.colorPickerModalContent, ...]}>
    {/* Existing modal content */}
  </View>
</View>
```

**Key points:**
- `Pressable` uses `StyleSheet.absoluteFill` to cover entire overlay
- Renders **before** the content View (z-index ordering)
- Content View sits on top and intercepts its own touches
- Only taps outside the content reach the backdrop Pressable

#### 3. State Management

No changes needed to existing state management:
- The existing `useEffect` (lines 39-45) already resets `resultColor`, `originalColor`, and `currentColor.value` when the modal opens
- When dismissed via backdrop, these values are simply discarded
- Previously saved custom colors remain in the store - we only discard unsaved changes

### Edge Cases & UX Considerations

**Touch Handling:**
- React Native's default touch system handles z-index based on render order
- No special responder logic needed
- Content View naturally blocks touches from reaching backdrop

**Visual Feedback:**
- No ripple or opacity changes on backdrop (standard modal UX)
- Keeps the interaction simple and familiar

**Accessibility:**
- Backdrop Pressable has `accessibilityLabel` and `accessibilityRole`
- Screen reader users understand backdrop dismissal

**Animation:**
- Existing `animationType='fade'` handles transitions
- No additional animation work needed

**State Consistency:**
- Unsaved changes are discarded on backdrop dismiss
- Previously saved custom colors persist
- Modal reopens with current saved state

## Testing Checklist

- [ ] Tap backdrop dismisses modal without saving color
- [ ] "Done" button saves color and dismisses
- [ ] Android back button dismisses without saving
- [ ] Tapping modal content does not dismiss
- [ ] Previously saved custom colors persist after backdrop dismiss
- [ ] Modal reopens with correct color state
- [ ] Screen reader announces backdrop button correctly
