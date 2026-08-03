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

