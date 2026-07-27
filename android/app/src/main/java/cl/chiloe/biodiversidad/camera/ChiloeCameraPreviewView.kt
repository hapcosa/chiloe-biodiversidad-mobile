package cl.chiloe.biodiversidad.camera

import android.content.Context
import android.graphics.SurfaceTexture
import android.util.Log
import android.view.Surface
import android.view.TextureView
import com.facebook.react.bridge.ReactContext

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

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) = Unit

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
        } catch (error: Exception) {
            Log.e(TAG, "attachIfReady: attachPreviewSurface failed sessionId=$sessionId", error)
        }
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
