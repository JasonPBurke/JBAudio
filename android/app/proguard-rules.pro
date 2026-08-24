
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
# RNTP ships no consumerProguardFiles (many deps here do not -- see the
# loader-kit note below; do NOT assume a dependency protects itself). It is also
# permanently frozen on this nightly, so there is no upstream fix coming. Its
# PlaybackService is kept automatically via AndroidManifest, but its event/state
# classes cross the JSI boundary by name.
# Package names verified against the pinned nightly's source tree.
-keep class com.doublesymmetry.trackplayer.** { *; }
-keep class com.doublesymmetry.kotlinaudio.** { *; }

# --- react-native-loader-kit / AVLoadingIndicatorView ------------------------
# CONFIRMED R8 REGRESSION, found on device 2026-08-23. Fixed by these rules.
#
# LoaderKitViewManager.setName() calls AVLoadingIndicatorView.setIndicator(String),
# which builds the class name at RUNTIME -- "com.wang.avi" + ".indicators." +
# <name> + "Indicator" -- and resolves it with Class.forName().newInstance()
# (verified by disassembling the AAR). R8 sees no static reference to any of the
# 92 indicator classes and deletes them all as dead code.
#
# The failure is SILENT and VISUAL-ONLY: setIndicator swallows the
# ClassNotFoundException ("Didn't find your class , check the name again !") and
# the view keeps its DEFAULT_INDICATOR -- a hardcoded BallPulseIndicator, i.e.
# three pulsing dots. No crash, nothing in Sentry, nothing jest can catch.
# Affects every <LoaderKitView>: BookGridItem, BookListItem, SeriesDetailSheet.
#
# NOTE the shape of this bug: the vulnerable code was NOT in react-native-loader-kit
# itself but in a transitive Maven AAR it depends on. Auditing node_modules source
# would never have found it. A visual/behavioural device pass is mandatory for R8
# here -- a crash-only smoke test will pass while the UI is silently wrong.
-keep class com.wang.avi.Indicator { *; }
-keep class com.wang.avi.indicators.** { *; }
