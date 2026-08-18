package cl.chiloe.biodiversidad.camera

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.view.Surface
import android.view.WindowManager
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
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

        private const val REQUEST_PICK_IMAGE = 0x43484C // "CHL"
    }

    private var pendingGalleryPromise: Promise? = null

    private val activityEventListener: ActivityEventListener =
        object : BaseActivityEventListener() {
            override fun onActivityResult(
                activity: Activity,
                requestCode: Int,
                resultCode: Int,
                data: Intent?,
            ) {
                if (requestCode != REQUEST_PICK_IMAGE) {
                    return
                }
                val promise = pendingGalleryPromise ?: return
                pendingGalleryPromise = null

                if (resultCode != Activity.RESULT_OK) {
                    // Cancelar no es un error: JS distingue por el null.
                    promise.resolve(null)
                    return
                }

                val uri = data?.data
                if (uri == null) {
                    promise.resolve(null)
                    return
                }

                try {
                    promise.resolve(copyGalleryImage(uri))
                } catch (error: Throwable) {
                    promise.reject("gallery_copy_failed", error)
                }
            }
        }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = "ChiloeCamera"

    override fun invalidate() {
        reactContext.removeActivityEventListener(activityEventListener)
        pendingGalleryPromise = null
        super.invalidate()
    }

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

    // Rangos reales del sensor. Sin esto la UI de controles manuales no puede
    // ofrecer nada: los valores fuera de rango los ignora el driver en silencio.
    @ReactMethod
    fun capabilities(sessionId: Int, promise: Promise) {
        try {
            val ints = nativeGetCapabilitiesInt(sessionId)
            val doubles = nativeGetCapabilitiesDouble(sessionId)
            if (ints.size < 6 || doubles.size < 3) {
                promise.reject("camera_capabilities_failed", "respuesta nativa incompleta")
                return
            }

            val result = Arguments.createMap()
            result.putInt("isoMin", ints[0])
            result.putInt("isoMax", ints[1])
            result.putInt("maxAfRegions", ints[2])
            result.putBoolean("supportsManualSensor", ints[3] == 1)
            result.putInt("previewWidth", ints[4])
            result.putInt("previewHeight", ints[5])
            result.putDouble("exposureMinMs", doubles[0])
            result.putDouble("exposureMaxMs", doubles[1])
            result.putDouble("focusMaxDiopters", doubles[2])
            promise.resolve(result)
        } catch (error: Throwable) {
            promise.reject("camera_capabilities_failed", error)
        }
    }

    // Lo que JS necesita para convertir un toque en coordenadas de la imagen.
    // La rotación de pantalla se lee aquí y no en JS porque `Dimensions` no la
    // expone y la activity no está fijada a vertical.
    @ReactMethod
    fun previewLayout(sessionId: Int, promise: Promise) {
        val geometry = sensorGeometry(sessionId)
        if (geometry == null) {
            promise.reject("camera_layout_failed", "sesión de cámara sin geometría")
            return
        }

        val result = Arguments.createMap()
        result.putInt("bufferWidth", geometry.previewWidth)
        result.putInt("bufferHeight", geometry.previewHeight)
        result.putInt("sensorOrientation", geometry.orientationDegrees)
        result.putInt("displayRotation", displayRotationDegrees())
        promise.resolve(result)
    }

    // (x, y) normalizados 0..1 sobre la imagen tal como se ve, sin el recorte
    // de la vista: la conversión desde el toque la hace JS, que es quien conoce
    // el tamaño de la vista.
    @ReactMethod
    fun focusAt(sessionId: Int, x: Double, y: Double, promise: Promise) {
        try {
            nativeFocusAt(sessionId, x.toFloat(), y.toFloat())
            promise.resolve(null)
        } catch (error: Throwable) {
            promise.reject("camera_focus_at_failed", error)
        }
    }

    // ACTION_GET_CONTENT en vez de una dependencia npm de galería: no necesita
    // permiso de almacenamiento (el usuario elige el archivo y el sistema nos
    // da acceso solo a ese) y no agrega superficie de terceros.
    @ReactMethod
    fun pickImageFromGallery(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("gallery_no_activity", "No hay actividad para abrir la galería")
            return
        }
        if (pendingGalleryPromise != null) {
            promise.reject("gallery_busy", "Ya hay una selección de imagen en curso")
            return
        }

        val intent =
            Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }

        pendingGalleryPromise = promise
        try {
            // Vía el ReactContext y no la Activity: es quien enruta el
            // resultado de vuelta a los ActivityEventListener registrados.
            reactContext.startActivityForResult(
                Intent.createChooser(intent, "Elegir imagen"),
                REQUEST_PICK_IMAGE,
                null,
            )
        } catch (error: Throwable) {
            pendingGalleryPromise = null
            promise.reject("gallery_open_failed", error)
        }
    }

    private fun copyGalleryImage(uri: Uri): com.facebook.react.bridge.WritableMap {
        val outputDir = File(reactContext.cacheDir, "captures").apply { mkdirs() }
        val output = File(outputDir, "galeria-${System.currentTimeMillis()}.jpg")

        reactContext.contentResolver.openInputStream(uri).use { input ->
            if (input == null) {
                throw IllegalStateException("No se pudo leer la imagen elegida")
            }
            output.outputStream().use { input.copyTo(it) }
        }

        // La foto viene de otra app y trae el EXIF entero, GPS incluido: mismo
        // saneado que las capturas propias.
        nativeStripSensitiveExif(output.absolutePath)

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(output.absolutePath, bounds)

        val result = Arguments.createMap()
        result.putString("filePath", output.absolutePath)
        result.putInt("width", bounds.outWidth.coerceAtLeast(0))
        result.putInt("height", bounds.outHeight.coerceAtLeast(0))
        return result
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

    private external fun nativeGetCapabilitiesInt(sessionId: Int): IntArray

    private external fun nativeGetCapabilitiesDouble(sessionId: Int): DoubleArray

    private external fun nativeFocusAt(sessionId: Int, x: Float, y: Float)

    private external fun nativeStripSensitiveExif(filePath: String)

    private external fun nativeSetPreviewSurface(sessionId: Int, surface: Surface)
    private external fun nativeClearPreviewSurface(sessionId: Int)
    private external fun nativeClose(sessionId: Int)
}

