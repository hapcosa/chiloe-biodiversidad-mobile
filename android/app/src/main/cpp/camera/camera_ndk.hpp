#pragma once

#include <android/native_window.h>

#include <memory>
#include <string>

namespace chiloe::camera {

struct CaptureResult {
    std::string filePath;
    int width = 0;
    int height = 0;
};

// Rangos que el sensor acepta de verdad. Sin esto la UI no puede ofrecer
// controles manuales: `setIso`/`setExposureMs` fuera de rango los ignora el
// driver en silencio.
struct CameraCapabilities {
    // Rango de ISO (ACAMERA_SENSOR_INFO_SENSITIVITY_RANGE). 0 = no soportado.
    int isoMin = 0;
    int isoMax = 0;
    // Rango de tiempo de exposición en milisegundos. 0 = no soportado.
    double exposureMinMs = 0;
    double exposureMaxMs = 0;
    // Distancia de enfoque en dioptrías (1/metros), como la quiere Camera2:
    // 0 es infinito y `focusMaxDiopters` es lo más cerca que enfoca el lente.
    // Si es 0, el lente es fijo y no acepta enfoque manual.
    float focusMaxDiopters = 0;
    // Cuántas regiones de autoenfoque acepta el pipeline. 0 = sin
    // toque-para-enfocar.
    int maxAfRegions = 0;
    bool supportsManualSensor = false;
    // Tamaño del stream de preview, para que la UI pueda invertir el recorte
    // al traducir un toque en coordenadas de la imagen.
    int previewWidth = 0;
    int previewHeight = 0;
};

struct SensorGeometry {
    // Grados en sentido horario que hay que rotar la salida del sensor para
    // que quede derecha con el dispositivo en su orientación natural.
    int orientationDegrees = 90;
    bool frontFacing = false;
    int previewWidth = 0;
    int previewHeight = 0;
};

class CameraSession {
public:
    explicit CameraSession(std::string lens);
    ~CameraSession();

    CameraSession(const CameraSession&) = delete;
    CameraSession& operator=(const CameraSession&) = delete;

    void open();
    void close();
    void setIso(int iso);
    void setExposureMs(double exposureMs);
    void setFocusDistance(float distance);
    void setAutoFocus();
    CameraCapabilities capabilities() const;

    // Toque-para-enfocar. (x, y) van normalizados 0..1 sobre la imagen tal
    // como se ve en pantalla, ya rotada y sin el recorte que aplica la vista:
    // traducir el toque de la vista a este marco es tarea del llamador.
    void focusAt(float x, float y);
    CaptureResult captureJpeg(const std::string& outputPath);

    // Grados que el dispositivo está rotado respecto de su orientación natural,
    // en sentido horario (lo que reporta OrientationEventListener). Necesario
    // para que el JPEG salga derecho: sin esto se graba tal cual lo entrega el
    // sensor, que en casi todos los teléfonos está montado apaisado.
    void setDeviceOrientation(int degrees);
    SensorGeometry sensorGeometry() const;

    // window es un ANativeWindow ya adquirido (ANativeWindow_fromSurface) que
    // el caller sigue siendo dueño de liberar tras clearPreviewSurface().
    void setPreviewSurface(ANativeWindow* window);
    void clearPreviewSurface();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace chiloe::camera

