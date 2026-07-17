package cl.chiloe.biodiversidad.camera

import android.Manifest
import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File

class ChiloeCameraModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        init {
            System.loadLibrary("chiloe_camera")
        }
    }

    override fun getName(): String = "ChiloeCamera"

    @ReactMethod
    fun openCamera(options: ReadableMap, promise: Promise) {
        if (!hasCameraPermission()) {
            promise.reject("camera_permission_denied", "Permiso de cámara no concedido")
            return
        }

        try {
            val lens = if (options.hasKey("lens")) options.getString("lens") ?: "back" else "back"
            val sessionId = nativeOpenCamera(lens)
            val result = Arguments.createMap()
            result.putInt("sessionId", sessionId)
            promise.resolve(result)
        } catch (error: Throwable) {
            promise.reject("camera_open_failed", error)
        }
    }

    @ReactMethod
    fun setIso(sessionId: Int, iso: Int, promise: Promise) {
        try {
            nativeSetIso(sessionId, iso)
            promise.resolve(null)
        } catch (error: Throwable) {
            promise.reject("camera_iso_failed", error)
        }
    }

    @ReactMethod
    fun setExposure(sessionId: Int, exposureMs: Double, promise: Promise) {
        try {
            nativeSetExposureMs(sessionId, exposureMs)
            promise.resolve(null)
        } catch (error: Throwable) {
            promise.reject("camera_exposure_failed", error)
        }
    }

    @ReactMethod
    fun setFocus(sessionId: Int, distance: Double, promise: Promise) {
        try {
            if (distance < 0) {
                nativeSetAutoFocus(sessionId)
            } else {
                nativeSetFocusDistance(sessionId, distance.toFloat())
            }
            promise.resolve(null)
        } catch (error: Throwable) {
            promise.reject("camera_focus_failed", error)
        }
    }

    @ReactMethod
    fun capture(sessionId: Int, promise: Promise) {
        try {
            val outputDir = File(reactContext.cacheDir, "captures").apply { mkdirs() }
            val output = File(outputDir, "chiloe-${System.currentTimeMillis()}.jpg")
            val size = nativeCaptureJpeg(sessionId, output.absolutePath)
            val result = Arguments.createMap()
            result.putString("filePath", output.absolutePath)
            result.putInt("width", size.getOrNull(0) ?: 0)
            result.putInt("height", size.getOrNull(1) ?: 0)
            promise.resolve(result)
        } catch (error: Throwable) {
            promise.reject("camera_capture_failed", error)
        }
    }

    @ReactMethod
    fun close(sessionId: Int, promise: Promise) {
        try {
            nativeClose(sessionId)
            promise.resolve(null)
        } catch (error: Throwable) {
            promise.reject("camera_close_failed", error)
        }
    }

    private fun hasCameraPermission(): Boolean =
        reactContext.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private external fun nativeOpenCamera(lens: String): Int
    private external fun nativeSetIso(sessionId: Int, iso: Int)
    private external fun nativeSetExposureMs(sessionId: Int, exposureMs: Double)
    private external fun nativeSetFocusDistance(sessionId: Int, distance: Float)
    private external fun nativeSetAutoFocus(sessionId: Int)
    private external fun nativeCaptureJpeg(sessionId: Int, outputPath: String): IntArray
    private external fun nativeClose(sessionId: Int)
}

