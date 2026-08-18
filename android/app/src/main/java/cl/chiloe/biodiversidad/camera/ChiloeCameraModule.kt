package cl.chiloe.biodiversidad.camera

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.view.Surface
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File

data class SensorGeometry(
    val orientationDegrees: Int,
    val frontFacing: Boolean,
    val previewWidth: Int,
    val previewHeight: Int,
)

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
            val size = nativeCaptureJpeg(sessionId, output.absolutePath, deviceOrientationDegrees())
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

    // Llamado directamente (sin pasar por el puente JS/Promise) por
    // ChiloeCameraPreviewView, que vive en el mismo proceso Kotlin, cuando su
    // SurfaceTexture queda disponible o se destruye.
    fun attachPreviewSurface(sessionId: Int, surface: Surface) {
        nativeSetPreviewSurface(sessionId, surface)
    }

    fun detachPreviewSurface(sessionId: Int) {
        nativeClearPreviewSurface(sessionId)
    }

    fun sensorGeometry(sessionId: Int): SensorGeometry? {
        val values = runCatching { nativeGetSensorGeometry(sessionId) }.getOrNull() ?: return null
        if (values.size < 4) {
            return null
        }
        return SensorGeometry(
            orientationDegrees = values[0],
            frontFacing = values[1] == 1,
            previewWidth = values[2],
            previewHeight = values[3],
        )
    }

    // Surface.ROTATION_* mide cuánto gira la *pantalla* respecto de la
    // orientación natural, que es el sentido contrario al que gira el aparato.
    // La cámara espera lo segundo (lo que reporta OrientationEventListener), de
    // ahí la inversión: girar el teléfono 90º a la izquierda deja la pantalla en
    // ROTATION_90 y el dispositivo en 270º.
    fun deviceOrientationDegrees(): Int =
        when (displayRotation()) {
            Surface.ROTATION_90 -> 270
            Surface.ROTATION_180 -> 180
            Surface.ROTATION_270 -> 90
            else -> 0
        }

    // Cuánto está girada la *pantalla* respecto de su orientación natural, en
    // grados. Es lo único que hay que compensar en el preview: en la
    // orientación natural el sensor ya queda derecho en pantalla.
    fun displayRotationDegrees(): Int =
        when (displayRotation()) {
            Surface.ROTATION_90 -> 90
            Surface.ROTATION_180 -> 180
            Surface.ROTATION_270 -> 270
            else -> 0
        }

    @Suppress("DEPRECATION")
    private fun displayRotation(): Int {
        val activity = reactContext.currentActivity
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity?.display?.let { return it.rotation }
        }
        val windowManager = activity?.getSystemService(WindowManager::class.java)
        return windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_0
    }

    private fun hasCameraPermission(): Boolean =
        reactContext.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private external fun nativeOpenCamera(lens: String): Int
    private external fun nativeSetIso(sessionId: Int, iso: Int)
    private external fun nativeSetExposureMs(sessionId: Int, exposureMs: Double)
    private external fun nativeSetFocusDistance(sessionId: Int, distance: Float)
    private external fun nativeSetAutoFocus(sessionId: Int)
    private external fun nativeCaptureJpeg(
        sessionId: Int,
        outputPath: String,
        deviceOrientation: Int,
    ): IntArray

    private external fun nativeGetSensorGeometry(sessionId: Int): IntArray
    private external fun nativeSetPreviewSurface(sessionId: Int, surface: Surface)
    private external fun nativeClearPreviewSurface(sessionId: Int)
    private external fun nativeClose(sessionId: Int)
}

