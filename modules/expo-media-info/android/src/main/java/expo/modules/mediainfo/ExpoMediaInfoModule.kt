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
  }
}
