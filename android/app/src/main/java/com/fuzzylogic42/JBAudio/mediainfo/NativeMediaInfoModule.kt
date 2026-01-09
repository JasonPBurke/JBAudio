package com.fuzzylogic42.JBAudio.mediainfo

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import net.mediaarea.mediainfo.MediaInfo
import java.io.File
import java.io.RandomAccessFile

/**
 * TurboModule implementation for React Native (Android) that uses the
 * MediaInfo JNI wrapper provided by MediaInfoLib v25.10.
 *
 * Uses the buffer-based API (Open_Buffer_*) for reliable file parsing
 * across all Android versions and storage access patterns.
 *
 * Note: Cover_Data extraction is not supported by this MediaInfoLib build.
 * Use a separate library for cover art extraction.
 */
@ReactModule(name = NativeMediaInfoModule.NAME)
class NativeMediaInfoModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), TurboModule {

    override fun getName(): String = NAME
    
    // Reusable buffer to avoid allocation per file
    private val buffer = ByteArray(BUFFER_SIZE)

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun analyze(path: String): String {
        val file = File(path)
        
        if (!file.exists() || !file.canRead()) {
            throw RuntimeException("MediaInfo: file does not exist or is not readable: $path")
        }
        
        val mi = MediaInfo()
        
        if (mi.mi == 0L) {
            throw RuntimeException("MediaInfo: Init() failed - invalid handle")
        }

        try {
            // Configure MediaInfo options
            mi.Option("Internet", "No")
            mi.Option("Output", "JSON")

            val fileSize = file.length()
            val raf = RandomAccessFile(file, "r")
            
            mi.Open_Buffer_Init(fileSize, 0)
            
            while (true) {
                val bytesRead = raf.read(buffer)
                if (bytesRead <= 0) break
                
                val continueResult = mi.Open_Buffer_Continue(buffer, bytesRead.toLong())
                
                // Check for seek request
                val seekTo = mi.Open_Buffer_Continue_GoTo_Get()
                if (seekTo != -1L && seekTo >= 0 && seekTo < fileSize) {
                    raf.seek(seekTo)
                    mi.Open_Buffer_Init(fileSize, seekTo)
                } else if ((continueResult and 0x08) != 0) {
                    // Parsing complete, exit immediately
                    break
                }
            }
            
            raf.close()
            mi.Open_Buffer_Finalize()

            val json = mi.Inform()
            
            if (json.isEmpty()) {
                throw RuntimeException("MediaInfo: failed to extract metadata from: $path")
            }

            return json
            
        } catch (e: Exception) {
            throw RuntimeException("MediaInfo: analysis failed for $path - ${e.message}")
        } finally {
            mi.Close()
            mi.Destroy()
        }
    }

    companion object {
        const val NAME: String = "NativeMediaInfo"
        private const val BUFFER_SIZE = 1024 * 1024 // 1MB buffer (smaller = faster for most files)
    }
}
