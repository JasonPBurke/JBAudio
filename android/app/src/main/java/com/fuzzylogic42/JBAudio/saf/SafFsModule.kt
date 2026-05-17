package com.fuzzylogic42.JBAudio.saf

import android.net.Uri
import android.provider.DocumentsContract
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

class SafFsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SafFs"

    @ReactMethod
    fun listTree(treeUri: String, promise: Promise) {
        try {
            val uri = Uri.parse(treeUri)
            val rootDocId = DocumentsContract.getTreeDocumentId(uri)
            val results = Arguments.createArray()
            walk(uri, rootDocId, results)
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("SAF_LIST_FAILED", e.message ?: "listTree failed", e)
        }
    }

    private fun walk(treeUri: Uri, parentDocId: String, results: WritableArray) {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId)
        val parentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, parentDocId).toString()
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
        )

        reactApplicationContext.contentResolver
            .query(childrenUri, projection, null, null, null)
            ?.use { cursor ->
                while (cursor.moveToNext()) {
                    val docId = cursor.getString(0)
                    val name = cursor.getString(1) ?: continue
                    val mime = cursor.getString(2)
                    val size = if (cursor.isNull(3)) 0L else cursor.getLong(3)
                    val isDir = DocumentsContract.Document.MIME_TYPE_DIR == mime
                    val docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId).toString()

                    val entry = Arguments.createMap()
                    entry.putString("uri", docUri)
                    entry.putString("name", name)
                    entry.putBoolean("isDirectory", isDir)
                    entry.putString("parentUri", parentUri)
                    entry.putDouble("size", size.toDouble())
                    results.pushMap(entry)

                    if (isDir) {
                        walk(treeUri, docId, results)
                    }
                }
            }
    }

    @ReactMethod
    fun readTextFile(uri: String, promise: Promise) {
        try {
            val stream = reactApplicationContext.contentResolver.openInputStream(Uri.parse(uri))
                ?: throw RuntimeException("openInputStream returned null for $uri")
            val text = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            promise.resolve(text)
        } catch (e: Exception) {
            promise.reject("SAF_READ_FAILED", e.message ?: "readTextFile failed", e)
        }
    }
}
