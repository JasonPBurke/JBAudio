package com.fuzzylogic42.JBAudio.mediainfo

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import net.mediaarea.mediainfo.MediaInfo
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * TurboModule implementation for React Native (Android) that uses the
 * MediaInfo JNI wrapper provided by MediaInfoLib v25.10.
 *
 * Uses FD-based file opening for fast direct access (~10x faster than buffer API).
 * Falls back to buffer-based API (Open_Buffer_*) if FD opening fails.
 *
 * Concurrency: `analyzeBatchNoCover` dispatches across a shared 4-thread pool
 * (see companion object) and emits a `MediaInfoBatchResult` event per file as it
 * finishes. Each worker owns its own MediaInfo instance — the library is not
 * thread-safe across instances. Promise resolves when the last worker finishes.
 */
@ReactModule(name = NativeMediaInfoModule.NAME)
class NativeMediaInfoModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), TurboModule {

    override fun getName(): String = NAME

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun analyze(path: String): String = analyzeFile(path, includeCover = true)

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun analyzeNoCover(path: String): String = analyzeFile(path, includeCover = false)

    @ReactMethod
    fun analyzeBatchNoCover(batchId: String, paths: ReadableArray, promise: Promise) {
        val pathList = (0 until paths.size()).mapNotNull { paths.getString(it) }
        if (pathList.isEmpty()) {
            promise.resolve(0)
            return
        }
        val remaining = AtomicInteger(pathList.size)
        pathList.forEach { path ->
            pool.execute {
                val event: WritableMap = Arguments.createMap().apply {
                    putString("batchId", batchId)
                    putString("path", path)
                }
                try {
                    event.putString("json", analyzeFile(path, includeCover = false))
                } catch (t: Throwable) {
                    event.putString("error", t.message ?: "analyze failed")
                }
                emitEvent(EVENT_NAME, event)
                if (remaining.decrementAndGet() == 0) {
                    promise.resolve(pathList.size)
                }
            }
        }
    }

    // RN requires these stubs on any module that emits events via DeviceEventEmitter.
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Double) {}

    private fun analyzeFile(path: String, includeCover: Boolean): String {
        val file = File(path)

        if (!file.exists() || !file.canRead()) {
            throw RuntimeException("MediaInfo: file does not exist or is not readable: $path")
        }

        val mi = MediaInfo()

        if (mi.mi == 0L) {
            throw RuntimeException("MediaInfo: Init() failed - invalid handle")
        }

        try {
            mi.Option("Internet", "No")
            mi.Option("Cover_Data", if (includeCover) "base64" else "")
            mi.Option("Output", "JSON")

            // Try path-based opening first (fast - ~50ms vs ~500ms for buffer API)
            var opened = false
            try {
                opened = (mi.openPath(file.absolutePath) == 1)
            } catch (_: Exception) {
                opened = false
            }

            if (!opened) {
                bufferFallbackCount.incrementAndGet()
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
     * Slower than path-based opening but works in all scenarios.
     *
     * Per-call buffer allocation is intentional — required for thread safety when
     * the batch path runs multiple workers in parallel. ART's large-object space
     * handles 1 MB primitive arrays in O(1); fallback is also rare in path-based
     * mode (verified by `bufferFallbackCount` in scan logs).
     */
    private fun analyzeWithBuffer(mi: MediaInfo, file: File): Boolean {
        val buffer = ByteArray(BUFFER_SIZE)
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

    private fun emitEvent(name: String, body: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(name, body)
    }

    companion object {
        const val NAME: String = "NativeMediaInfo"
        private const val BUFFER_SIZE = 1024 * 1024 // 1MB buffer for fallback API
        private const val POOL_SIZE = 4
        private const val EVENT_NAME = "MediaInfoBatchResult"

        // Counts how often the buffer-API fallback fires during a scan.
        // Exposed for logging from the JS scanLibrary instrumentation.
        @JvmStatic
        val bufferFallbackCount: AtomicInteger = AtomicInteger(0)

        private val threadCounter = AtomicInteger(0)
        private val pool: ExecutorService = Executors.newFixedThreadPool(POOL_SIZE) { r ->
            Thread(r, "MediaInfo-${threadCounter.incrementAndGet()}").apply {
                isDaemon = true
                priority = Thread.NORM_PRIORITY - 1
            }
        }
    }
}
