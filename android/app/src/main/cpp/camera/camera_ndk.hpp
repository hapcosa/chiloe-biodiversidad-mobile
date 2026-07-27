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

    // window es un ANativeWindow ya adquirido (ANativeWindow_fromSurface) que
    // el caller sigue siendo dueño de liberar tras clearPreviewSurface().
    void setPreviewSurface(ANativeWindow* window);
    void clearPreviewSurface();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace chiloe::camera

