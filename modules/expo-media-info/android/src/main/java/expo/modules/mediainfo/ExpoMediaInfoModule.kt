package expo.modules.mediainfo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import net.mediaarea.mediainfo.Core
import net.mediaarea.mediainfo.MediaInfo

class ExpoMediaInfoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoMediaInfo")

    AsyncFunction("getMediaInfo") { fileUri: String ->
      val filePath = if (fileUri.startsWith("file://")) {
        URL(fileUri).path
      } else {
        fileUri
      }

      // Set the output format to JSON on the shared instance
      Core.mi.Option("Output", "JSON")

      // Use the helper function from Core.kt to get the report
      val result = Core.creatReport(filePath)

      return@AsyncFunction result
    }

    AsyncFunction("getCover") { fileUri: String ->
      val filePath = if (fileUri.startsWith("file://")) {
        URL(fileUri).path
      } else {
        fileUri
      }

      val mi = MediaInfo()

      mi.Option("Cover_Data", "base64")
      mi.Open(filePath)
      // First try to get from Image stream
      var cover = mi.Get(MediaInfo.Stream.Image, 0, "Cover_Data")
      if (cover.isEmpty()) {
        // If not in image stream, try General stream
        cover = mi.Get(MediaInfo.Stream.General, 0, "Cover_Data")
      }
      mi.Close()

      return@AsyncFunction cover
    }
  }
}
