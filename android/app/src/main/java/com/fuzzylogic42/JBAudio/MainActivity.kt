package com.fuzzylogic42.JBAudio
import expo.modules.splashscreen.SplashScreenManager

import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    *
    * NOTE: we deliberately do NOT delegate to super on Android S+ (the upstream
    * Expo/RN template does). On targetSdk 36 ReactActivity registers an
    * OnBackPressedCallback to work around enforced predictive back, and its
    * invokeDefaultOnBackPressed() calls setEnabled(false) on that callback
    * without ever re-enabling it. Since this method only runs when JS declined
    * to handle the press, the very first back press on a root screen latches the
    * callback off for the lifetime of the Activity: every later back press then
    * bypasses React Navigation entirely and backgrounds the app, no matter which
    * screen is open, until the process is restarted. The callback is private, so
    * a subclass cannot re-enable it — we background the task ourselves instead,
    * which leaves it enabled.
    *
    * Upstream fixed this in RN 0.84.0 (the re-enable was added after
    * super.onBackPressed()); it was NOT backported to the 0.83 branch, and
    * 0.83.10 is still affected. Once this app is on RN >= 0.84 (Expo SDK 56
    * ships 0.85.3) this whole override can be reverted to the stock Expo
    * template version.
    */
  override fun invokeDefaultOnBackPressed() {
      if (!moveTaskToBack(false)) {
          // For non-root activities, use the default implementation to finish them.
          // The latch is harmless here because the Activity is going away anyway.
          super.invokeDefaultOnBackPressed()
      }
  }
}
