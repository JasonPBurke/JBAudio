# Fix: Glide Bitmap Leak from React Native View Tag Conflict

## Context

The app uses ~900-1200 MB after scrolling through 340 book covers. `dumpsys meminfo` consistently shows **343 malloced bitmaps** — one per book — totaling ~100 MB, plus ~200 MB in GPU textures. Despite capping Glide's LRU cache at 10 MB and bitmap pool at 5 MB (confirmed loading via logcat), the bitmap count never decreased.

### True Root Cause: React Native `view.setTag(null)` wipes Glide's request tracking

React Native's `BaseViewManager.prepareToRecycleView()` calls **`view.setTag(null)`** to reset views during recycling. Glide stores its active request in the same default tag slot via `view.setTag(request)`. When React Native nullifies this tag, Glide can never find its old request to clear it. The old bitmap stays permanently in Glide's "active resources" (which has NO size limit), bypassing the LRU cache entirely.

### The Fix: `ViewTarget.setTagId()`

Glide's `ViewTarget.setTagId(int)` makes it use `view.setTag(customId, request)` instead of `view.setTag(request)`. React Native's `view.setTag(null)` only clears the default tag, so a custom tag ID is unaffected.

## Changes

1. **New:** `android/app/src/main/res/values/ids.xml` — defines `glide_custom_view_target_tag` resource ID
2. **Updated:** `CustomGlideModule.java` — calls `ViewTarget.setTagId()`, sets 15 MB cache + 10 MB pool
3. **Previously implemented:** Explicit pixel dims on FastImage components, `drawDistance` on horizontal lists, `excludeAppGlideModule`, Glide dependencies
