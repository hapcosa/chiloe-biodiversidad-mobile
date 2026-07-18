#include "camera_ndk.hpp"

#include "jpeg_writer.hpp"

#include <android/log.h>
#include <camera/NdkCameraDevice.h>
#include <camera/NdkCameraManager.h>
#include <media/NdkImage.h>
#include <media/NdkImageReader.h>

#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <mutex>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace chiloe::camera {
namespace {

constexpr const char* LogTag = "ChiloeCamera";
constexpr int CaptureTimeoutSeconds = 10;

struct Size {
    int width = 1280;
    int height = 720;
};

struct ImageCaptureContext {
    std::mutex mutex;
    std::condition_variable cv;
    std::vector<std::uint8_t> jpeg;
    int width = 0;
    int height = 0;
    bool completed = false;
    bool failed = false;
};

void checkCamera(camera_status_t status, const char* message) {
    if (status != ACAMERA_OK) {
        throw std::runtime_error(message);
    }
}

void checkMedia(media_status_t status, const char* message) {
    if (status != AMEDIA_OK) {
        throw std::runtime_error(message);
    }
}

void onDeviceDisconnected(void*, ACameraDevice*) {
    __android_log_print(ANDROID_LOG_WARN, LogTag, "camera disconnected");
}

void onDeviceError(void*, ACameraDevice*, int error) {
    __android_log_print(ANDROID_LOG_ERROR, LogTag, "camera error: %d", error);
}

void onSessionClosed(void*, ACameraCaptureSession*) {}
void onSessionReady(void*, ACameraCaptureSession*) {}
void onSessionActive(void*, ACameraCaptureSession*) {}

void onImageAvailable(void* contextPtr, AImageReader* reader) {
    auto* context = static_cast<ImageCaptureContext*>(contextPtr);
    AImage* image = nullptr;
    const auto acquireStatus = AImageReader_acquireNextImage(reader, &image);

    {
        std::lock_guard<std::mutex> lock(context->mutex);
        if (acquireStatus != AMEDIA_OK || image == nullptr) {
            context->failed = true;
            context->completed = true;
            context->cv.notify_one();
            return;
        }

        int32_t width = 0;
        int32_t height = 0;
        std::uint8_t* data = nullptr;
        int dataLength = 0;

        if (AImage_getWidth(image, &width) != AMEDIA_OK ||
            AImage_getHeight(image, &height) != AMEDIA_OK ||
            AImage_getPlaneData(image, 0, &data, &dataLength) != AMEDIA_OK ||
            data == nullptr ||
            dataLength <= 0) {
            context->failed = true;
        } else {
            context->width = width;
            context->height = height;
            context->jpeg.assign(data, data + dataLength);
        }

        context->completed = true;
    }

    AImage_delete(image);
    context->cv.notify_one();
}

std::string selectCameraId(ACameraManager* manager, const std::string& lens) {
    ACameraIdList* cameraIds = nullptr;
    checkCamera(ACameraManager_getCameraIdList(manager, &cameraIds), "failed to list cameras");

    const auto desiredFacing =
        lens == "front" ? ACAMERA_LENS_FACING_FRONT : ACAMERA_LENS_FACING_BACK;
    std::string fallback;

    for (int index = 0; index < cameraIds->numCameras; ++index) {
        const char* cameraId = cameraIds->cameraIds[index];
        if (cameraId == nullptr) {
            continue;
        }

        if (fallback.empty()) {
            fallback = cameraId;
        }

        ACameraMetadata* metadata = nullptr;
        if (ACameraManager_getCameraCharacteristics(manager, cameraId, &metadata) != ACAMERA_OK) {
            continue;
        }

        ACameraMetadata_const_entry facingEntry{};
        const auto hasFacing =
            ACameraMetadata_getConstEntry(metadata, ACAMERA_LENS_FACING, &facingEntry) == ACAMERA_OK &&
            facingEntry.count > 0;

        if (hasFacing && facingEntry.data.u8[0] == desiredFacing) {
            std::string selected = cameraId;
            ACameraMetadata_free(metadata);
            ACameraManager_deleteCameraIdList(cameraIds);
            return selected;
        }

        ACameraMetadata_free(metadata);
    }

    ACameraManager_deleteCameraIdList(cameraIds);

    if (fallback.empty()) {
        throw std::runtime_error("no camera available");
    }

    return fallback;
}

Size chooseJpegSize(ACameraManager* manager, const std::string& cameraId) {
    ACameraMetadata* metadata = nullptr;
    if (ACameraManager_getCameraCharacteristics(manager, cameraId.c_str(), &metadata) != ACAMERA_OK) {
        return {};
    }

    ACameraMetadata_const_entry entry{};
    const auto status = ACameraMetadata_getConstEntry(
        metadata,
        ACAMERA_SCALER_AVAILABLE_STREAM_CONFIGURATIONS,
        &entry);

    Size selected;
    long selectedArea = selected.width * selected.height;

    if (status == ACAMERA_OK) {
        for (uint32_t index = 0; index + 3 < entry.count; index += 4) {
            const int32_t format = entry.data.i32[index];
            const int32_t width = entry.data.i32[index + 1];
            const int32_t height = entry.data.i32[index + 2];
            const int32_t input = entry.data.i32[index + 3];
            const long area = static_cast<long>(width) * static_cast<long>(height);

            if (format == AIMAGE_FORMAT_JPEG && input == 0 && area > selectedArea) {
                selected = {width, height};
                selectedArea = area;
            }
        }
    }

    ACameraMetadata_free(metadata);
    return selected;
}

} // namespace

struct CameraSession::Impl {
    explicit Impl(std::string requestedLens) : lens(std::move(requestedLens)) {}

    std::string lens;
    std::string cameraId;
    ACameraManager* manager = nullptr;
    ACameraDevice* device = nullptr;
    int iso = 0;
    double exposureMs = 0;
    float focusDistance = -1;
};

CameraSession::CameraSession(std::string lens) : impl_(std::make_unique<Impl>(std::move(lens))) {}

CameraSession::~CameraSession() {
    close();
}

void CameraSession::open() {
    if (impl_->device != nullptr) {
        return;
    }

    impl_->manager = ACameraManager_create();
    if (impl_->manager == nullptr) {
        throw std::runtime_error("failed to create camera manager");
    }

    impl_->cameraId = selectCameraId(impl_->manager, impl_->lens);

    ACameraDevice_StateCallbacks callbacks{};
    callbacks.context = nullptr;
    callbacks.onDisconnected = onDeviceDisconnected;
    callbacks.onError = onDeviceError;

    checkCamera(
        ACameraManager_openCamera(
            impl_->manager,
            impl_->cameraId.c_str(),
            &callbacks,
            &impl_->device),
        "failed to open camera");
}

void CameraSession::close() {
    if (impl_->device != nullptr) {
        ACameraDevice_close(impl_->device);
        impl_->device = nullptr;
    }

    if (impl_->manager != nullptr) {
        ACameraManager_delete(impl_->manager);
        impl_->manager = nullptr;
    }
}

void CameraSession::setIso(int iso) {
    impl_->iso = iso > 0 ? iso : 0;
}

void CameraSession::setExposureMs(double exposureMs) {
    impl_->exposureMs = exposureMs > 0 ? exposureMs : 0;
}

void CameraSession::setFocusDistance(float distance) {
    impl_->focusDistance = distance >= 0 ? distance : -1;
}

void CameraSession::setAutoFocus() {
    impl_->focusDistance = -1;
}

CaptureResult CameraSession::captureJpeg(const std::string& outputPath) {
    if (impl_->device == nullptr) {
        open();
    }

    const auto size = chooseJpegSize(impl_->manager, impl_->cameraId);
    ImageCaptureContext context;
    AImageReader* reader = nullptr;
    ANativeWindow* window = nullptr;
    ACaptureSessionOutputContainer* outputs = nullptr;
    ACaptureSessionOutput* output = nullptr;
    ACameraCaptureSession* session = nullptr;
    ACaptureRequest* request = nullptr;
    ACameraOutputTarget* target = nullptr;

    checkMedia(
        AImageReader_new(size.width, size.height, AIMAGE_FORMAT_JPEG, 1, &reader),
        "failed to create image reader");

    AImageReader_ImageListener imageListener{};
    imageListener.context = &context;
    imageListener.onImageAvailable = onImageAvailable;
    checkMedia(AImageReader_setImageListener(reader, &imageListener), "failed to set image listener");
    checkMedia(AImageReader_getWindow(reader, &window), "failed to get image reader window");

    checkCamera(ACaptureSessionOutputContainer_create(&outputs), "failed to create output container");
    checkCamera(ACaptureSessionOutput_create(window, &output), "failed to create capture output");
    checkCamera(ACaptureSessionOutputContainer_add(outputs, output), "failed to add capture output");

    ACameraCaptureSession_stateCallbacks sessionCallbacks{};
    sessionCallbacks.context = nullptr;
    sessionCallbacks.onClosed = onSessionClosed;
    sessionCallbacks.onReady = onSessionReady;
    sessionCallbacks.onActive = onSessionActive;

    checkCamera(
        ACameraDevice_createCaptureSession(impl_->device, outputs, &sessionCallbacks, &session),
        "failed to create capture session");
    checkCamera(
        ACameraDevice_createCaptureRequest(impl_->device, TEMPLATE_STILL_CAPTURE, &request),
        "failed to create capture request");
    checkCamera(ACameraOutputTarget_create(window, &target), "failed to create output target");
    checkCamera(ACaptureRequest_addTarget(request, target), "failed to add target");

    uint8_t aeMode = ACAMERA_CONTROL_AE_MODE_ON;
    if (impl_->iso > 0 || impl_->exposureMs > 0) {
        aeMode = ACAMERA_CONTROL_AE_MODE_OFF;
        ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AE_MODE, 1, &aeMode);

        if (impl_->iso > 0) {
            const int32_t iso = impl_->iso;
            ACaptureRequest_setEntry_i32(request, ACAMERA_SENSOR_SENSITIVITY, 1, &iso);
        }

        if (impl_->exposureMs > 0) {
            const int64_t exposureNs = static_cast<int64_t>(impl_->exposureMs * 1000000.0);
            ACaptureRequest_setEntry_i64(request, ACAMERA_SENSOR_EXPOSURE_TIME, 1, &exposureNs);
        }
    } else {
        ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AE_MODE, 1, &aeMode);
    }

    uint8_t afMode = ACAMERA_CONTROL_AF_MODE_CONTINUOUS_PICTURE;
    if (impl_->focusDistance >= 0) {
        afMode = ACAMERA_CONTROL_AF_MODE_OFF;
        ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AF_MODE, 1, &afMode);
        ACaptureRequest_setEntry_float(request, ACAMERA_LENS_FOCUS_DISTANCE, 1, &impl_->focusDistance);
    } else {
        ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AF_MODE, 1, &afMode);
    }

    ACaptureRequest* requests[] = {request};
    int sequenceId = 0;
    checkCamera(
        ACameraCaptureSession_capture(session, nullptr, 1, requests, &sequenceId),
        "failed to capture JPEG");

    {
        std::unique_lock<std::mutex> lock(context.mutex);
        const bool completed = context.cv.wait_for(
            lock,
            std::chrono::seconds(CaptureTimeoutSeconds),
            [&context] { return context.completed; });

        if (!completed || context.failed || context.jpeg.empty()) {
            throw std::runtime_error("camera capture timed out or failed");
        }
    }

    writeJpegFile(outputPath, context.jpeg);

    ACaptureRequest_removeTarget(request, target);
    ACameraOutputTarget_free(target);
    ACaptureRequest_free(request);
    ACameraCaptureSession_close(session);
    ACaptureSessionOutputContainer_remove(outputs, output);
    ACaptureSessionOutput_free(output);
    ACaptureSessionOutputContainer_free(outputs);
    AImageReader_delete(reader);

    CaptureResult result;
    result.filePath = outputPath;
    result.width = context.width;
    result.height = context.height;
    return result;
}

} // namespace chiloe::camera
