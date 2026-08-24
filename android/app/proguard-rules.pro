
      # Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

-keep class com.nozbe.watermelondb.** { *; }
      
# --- Our own native modules -------------------------------------------------
# The TurboModule/NativeModule classes here are resolved by name across the JS
# and codegen'd C++ boundary. This app only has ~10 native source files, so
# keeping all of them costs almost nothing and removes the highest-risk
# category of R8 breakage outright.
-keep class com.fuzzylogic42.JBAudio.** { *; }
-keep class net.mediaarea.mediainfo.** { *; }

# --- react-native-track-player (pinned v5 alpha) ----------------------------
# RNTP is the ONLY native dependency in this tree that ships no
# consumerProguardFiles -- every other one (react-native, expo,
# expo-modules-core, expo-image, react-native-svg, reanimated, worklets, and
# the androidx/media3, Glide, RevenueCat and Sentry AARs) brings its own rules.
# It is also permanently frozen on this nightly, so there is no upstream fix
# coming. Its PlaybackService is kept automatically via AndroidManifest, but
# its event/state classes cross the JSI boundary by name.
# Package names verified against the pinned nightly's source tree.
-keep class com.doublesymmetry.trackplayer.** { *; }
-keep class com.doublesymmetry.kotlinaudio.** { *; }
