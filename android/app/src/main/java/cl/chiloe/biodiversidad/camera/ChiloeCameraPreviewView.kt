package cl.chiloe.biodiversidad.camera

import android.content.Context
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.util.Log
import android.view.Surface
import android.view.TextureView
import com.facebook.react.bridge.ReactContext
import kotlin.math.max

private const val TAG = "ChiloeCameraPreview"

// TextureView cuyo SurfaceTexture se pasa directo (Kotlin a Kotlin, sin
// puente JS) a la sesión nativa de cámara identificada por `sessionId`, para
// que Camera2 NDK transmita el preview en vivo a esta vista.
class ChiloeCameraPreviewView(context: Context) :
    TextureView(context), TextureView.SurfaceTextureListener {
    var sessionId: Int = -1
        set(value) {
            field = value
            attachIfReady()
        }

    private var attachedSurface: Surface? = null

    init {
        surfaceTextureListener = this
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "onSurfaceTextureAvailable: ${width}x$height sessionId=$sessionId")
        attachIfReady()
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        applyPreviewTransform()
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        detach()
        return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) = Unit

    private fun attachIfReady() {
        val texture = surfaceTexture
        if (texture == null || sessionId < 0 || attachedSurface != null) {
            Log.d(
                TAG,
                "attachIfReady: skipped (texture=${texture != null} sessionId=$sessionId " +
                    "alreadyAttached=${attachedSurface != null})",
            )
            return
        }

        val module = cameraModule()
        if (module == null) {
            Log.w(TAG, "attachIfReady: ChiloeCameraModule not found")
            return
        }

        val surface = Surface(texture)
        attachedSurface = surface
        try {
            module.attachPreviewSurface(sessionId, surface)
            Log.d(TAG, "attachIfReady: attachPreviewSurface OK sessionId=$sessionId")
            // El tamaño del stream de preview solo se conoce tras adjuntar la
            // superficie, así que la transformación se calcula aquí.
            applyPreviewTransform()
        } catch (error: Exception) {
            Log.e(TAG, "attachIfReady: attachPreviewSurface failed sessionId=$sessionId", error)
        }
    }

    // El buffer llega en orientación de sensor, que en casi todos los teléfonos
    // está montado apaisado: sin esta matriz el preview se ve girado un cuarto
    // de vuelta y estirado para llenar una vista vertical.
    private fun applyPreviewTransform() {
        val geometry = cameraModule()?.sensorGeometry(sessionId) ?: return
        if (geometry.previewWidth <= 0 || geometry.previewHeight <= 0 || width == 0 || height == 0) {
            return
        }

        val deviceOrientation = cameraModule()?.deviceOrientationDegrees() ?: 0
        val rotation = if (geometry.frontFacing) {
            ((geometry.orientationDegrees - deviceOrientation) % 360 + 360) % 360
        } else {
            (geometry.orientationDegrees + deviceOrientation) % 360
        }

        // Tamaño con el que el buffer termina *dibujado*: al girar un cuarto de
        // vuelta, el lado largo del sensor pasa a ser el alto de la vista.
        val quarterTurn = rotation == 90 || rotation == 270
        val shownWidth = if (quarterTurn) geometry.previewHeight else geometry.previewWidth
        val shownHeight = if (quarterTurn) geometry.previewWidth else geometry.previewHeight

        val viewRect = RectF(0f, 0f, width.toFloat(), height.toFloat())
        val centerX = viewRect.centerX()
        val centerY = viewRect.centerY()

        // La vista dibuja el buffer estirado a sus bordes; el primer paso lo
        // devuelve a su relación de aspecto real, centrado. Aquí van las
        // dimensiones del buffer *sin* intercambiar: el intercambio lo hace
        // después `postRotate`, y aplicarlo también aquí deformaba la imagen y
        // la dejaba como una franja apaisada con bandas negras arriba y abajo.
        val contentRect = RectF(
            0f,
            0f,
            geometry.previewWidth.toFloat(),
            geometry.previewHeight.toFloat(),
        )
        contentRect.offset(centerX - contentRect.centerX(), centerY - contentRect.centerY())

        val matrix = Matrix()
        matrix.setRectToRect(viewRect, contentRect, Matrix.ScaleToFit.FILL)

        // Recorte centrado: se agranda hasta cubrir la vista sin deformar. Se
        // mide contra el tamaño ya girado, que es el que ocupa la pantalla.
        val scale = max(
            viewRect.width() / shownWidth.toFloat(),
            viewRect.height() / shownHeight.toFloat(),
        )
        matrix.postScale(scale, scale, centerX, centerY)
        matrix.postRotate(rotation.toFloat(), centerX, centerY)

        Log.d(
            TAG,
            "applyPreviewTransform: buffer=${geometry.previewWidth}x${geometry.previewHeight} " +
                "sensor=${geometry.orientationDegrees} device=$deviceOrientation rotation=$rotation " +
                "view=${width}x$height",
        )
        setTransform(matrix)
    }

    private fun detach() {
        val surface = attachedSurface ?: return
        attachedSurface = null
        if (sessionId >= 0) {
            cameraModule()?.detachPreviewSurface(sessionId)
        }
        surface.release()
    }

    // getNativeModule(Class) devuelve null en silencio bajo la Nueva
    // Arquitectura para módulos legacy sin spec de Codegen (ver
    // ChiloeCameraModule, un ReactContextBaseJavaModule plano). El lookup por
    // nombre pasa por CatalystInstance/TurboModuleManager igual en ambas
    // arquitecturas.
    private fun cameraModule(): ChiloeCameraModule? =
        (context as? ReactContext)?.getNativeModule("ChiloeCamera") as? ChiloeCameraModule
}
