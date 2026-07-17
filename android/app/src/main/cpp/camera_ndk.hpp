#pragma once

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

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace chiloe::camera

