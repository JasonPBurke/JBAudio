package com.fuzzylogic42.JBAudio.saf

import android.net.Uri
import android.provider.DocumentsContract
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.FileNotFoundException
import java.io.IOException

class SafCueReaderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SafCueReaderModule"

    @ReactMethod
    fun readCueText(treeUriStr: String, relativePath: String, promise: Promise) {
        try {
            val treeUri = Uri.parse(treeUriStr)
            val treeDocId = DocumentsContract.getTreeDocumentId(treeUri)
            val cueDocId = "$treeDocId/$relativePath"
            val cueUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, cueDocId)

            val text = reactApplicationContext.contentResolver
                .openInputStream(cueUri)
                ?.use { it.readBytes().toString(Charsets.UTF_8) }
                ?: throw FileNotFoundException("openInputStream returned null for $relativePath")

            promise.resolve(text)
        } catch (e: FileNotFoundException) {
            promise.reject("ENOENT", e.message, e)
        } catch (e: IllegalArgumentException) {
            // ExternalStorageProvider wraps "file doesn't exist" in IllegalArgumentException
            // when its "is X a child of treeUri?" containment check fails. Depending on
            // Android version, the FileNotFoundException is either set on e.cause OR
            // string-concatenated into e.message — so check both signals.
            val msg = e.message ?: ""
            val isMissing = e.cause is FileNotFoundException ||
                msg.contains("FileNotFoundException") ||
                msg.contains("Missing file")
            if (isMissing) {
                promise.reject("ENOENT", e.message, e)
            } else {
                promise.reject("EINVAL", e.message, e)
            }
        } catch (e: SecurityException) {
            promise.reject("EACCES", "SAF tree permission revoked or invalid: ${e.message}", e)
        } catch (e: IOException) {
            promise.reject("EIO", e.message, e)
        } catch (e: Exception) {
            promise.reject("EUNKNOWN", e.message, e)
        }
    }
}
