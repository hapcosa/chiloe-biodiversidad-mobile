package cl.chiloe.biodiversidad.camera

import android.content.Context
import android.graphics.SurfaceTexture
import android.view.Surface
import android.view.TextureView
import com.facebook.react.bridge.ReactContext

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
            return
        }

        val module = cameraModule() ?: return
        val surface = Surface(texture)
        attachedSurface = surface
        module.attachPreviewSurface(sessionId, surface)
    }

    private fun detach() {
        val surface = attachedSurface ?: return
        attachedSurface = null
        if (sessionId >= 0) {
            cameraModule()?.detachPreviewSurface(sessionId)
        }
        surface.release()
    }

    private fun cameraModule(): ChiloeCameraModule? =
        (context as? ReactContext)?.getNativeModule(ChiloeCameraModule::class.java)
}
