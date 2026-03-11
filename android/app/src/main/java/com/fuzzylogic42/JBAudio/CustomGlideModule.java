package com.fuzzylogic42.JBAudio;

import android.content.Context;
import android.util.Log;
import androidx.annotation.NonNull;
import com.bumptech.glide.GlideBuilder;
import com.bumptech.glide.annotation.GlideModule;
import com.bumptech.glide.load.engine.cache.LruResourceCache;
import com.bumptech.glide.load.engine.bitmap_recycle.LruBitmapPool;
import com.bumptech.glide.module.AppGlideModule;
import com.bumptech.glide.request.target.ViewTarget;

@GlideModule
public final class CustomGlideModule extends AppGlideModule {
    private static final String TAG = "CustomGlideModule";
    private static final int MEMORY_CACHE_SIZE = 15 * 1024 * 1024;  // 15 MB
    private static final int BITMAP_POOL_SIZE = 10 * 1024 * 1024;   // 10 MB

    @Override
    public void applyOptions(@NonNull Context context, @NonNull GlideBuilder builder) {
        // Fix: Use custom tag ID to prevent React Native's prepareToRecycleView()
        // from wiping Glide's request tag via view.setTag(null)
        ViewTarget.setTagId(R.id.glide_custom_view_target_tag);

        builder.setMemoryCache(new LruResourceCache(MEMORY_CACHE_SIZE));
        builder.setBitmapPool(new LruBitmapPool(BITMAP_POOL_SIZE));

        Log.d(TAG, "CustomGlideModule loaded — tagId set, memory cache "
            + (MEMORY_CACHE_SIZE / 1024 / 1024) + "MB, bitmap pool "
            + (BITMAP_POOL_SIZE / 1024 / 1024) + "MB");
    }

    @Override
    public boolean isManifestParsingEnabled() {
        return false;
    }
}
