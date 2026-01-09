package com.fuzzylogic42.JBAudio.mediainfo

import android.os.ParcelFileDescriptor
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
 * Uses FD-based file opening for fast direct access (~10x faster than buffer API).
 * Falls back to buffer-based API (Open_Buffer_*) if FD opening fails.
 *
 * Features enabled in custom build:
 * - Cover_Data extraction (base64 encoded embedded artwork)
 * - JNI bindings with FD support
 * - Advanced metadata options
 */
@ReactModule(name = NativeMediaInfoModule.NAME)
class NativeMediaInfoModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), TurboModule {

    override fun getName(): String = NAME
    
    // Reusable buffer for fallback buffer-based API
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
            // Configure MediaInfo options BEFORE opening file
            mi.Option("Internet", "No")
            mi.Option("Cover_Data", "base64")  // Extract cover art as base64
            mi.Option("Output", "JSON")

            // Try path-based opening first (fast - ~50ms vs ~500ms for buffer API)
            var opened = false
            try {
                val openResult = mi.openPath(file.absolutePath)
                opened = (openResult == 1)
            } catch (e: Exception) {
                opened = false
            }

            // Fallback to buffer-based API if path opening failed
            if (!opened) {
                opened = analyzeWithBuffer(mi, file)
            }

            if (!opened) {
                throw RuntimeException("MediaInfo: failed to open file: $path")
            }

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

    /**
     * Buffer-based file analysis fallback.
     * Slower than FD-based opening but works in all scenarios.
     */
    private fun analyzeWithBuffer(mi: MediaInfo, file: File): Boolean {
        val fileSize = file.length()
        val raf = RandomAccessFile(file, "r")
        
        try {
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
            
            mi.Open_Buffer_Finalize()
            return true
        } finally {
            raf.close()
        }
    }

    companion object {
        const val NAME: String = "NativeMediaInfo"
        private const val BUFFER_SIZE = 1024 * 1024 // 1MB buffer for fallback API
    }
}
