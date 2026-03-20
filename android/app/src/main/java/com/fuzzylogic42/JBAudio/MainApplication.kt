package com.fuzzylogic42.JBAudio

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import com.fuzzylogic42.JBAudio.mediainfo.NativeMediaInfoPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      applicationContext,
      PackageList(this).packages.apply {
        add(PermissionPackage())
        add(NativeMediaInfoPackage())
        add(WatermelonDBJSIPackage())
      }
    )
  }

  override fun onCreate() {
    super.onCreate()
    // @generated begin xml-fonts-init - expo prebuild (DO NOT MODIFY) sync-74a219754f1d94d116f12fda36bb502a3078c3cd
    ReactFontManager.getInstance().addCustomFont(this, "Rubik", R.font.xml_rubik)
    // @generated end xml-fonts-init
    SoLoader.init(this, OpenSourceMergedSoMapping)
    DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.EXPERIMENTAL
    load()
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
