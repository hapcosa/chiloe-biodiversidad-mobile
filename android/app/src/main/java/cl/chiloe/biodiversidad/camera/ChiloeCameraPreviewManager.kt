package cl.chiloe.biodiversidad.camera

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class ChiloeCameraPreviewManager : SimpleViewManager<ChiloeCameraPreviewView>() {
    override fun getName(): String = "ChiloeCameraPreviewView"

    override fun createViewInstance(context: ThemedReactContext): ChiloeCameraPreviewView =
        ChiloeCameraPreviewView(context)

    @ReactProp(name = "sessionId")
    fun setSessionId(view: ChiloeCameraPreviewView, sessionId: Int) {
        view.sessionId = sessionId
    }
}
