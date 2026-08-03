#include "camera_ndk.hpp"

#include "jpeg_writer.hpp"

#include <android/log.h>
#include <camera/NdkCameraDevice.h>
#include <camera/NdkCameraManager.h>
#include <media/NdkImage.h>
#include <media/NdkImageReader.h>

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <limits>
#include <mutex>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace chiloe::camera {
namespace {

constexpr const char* LogTag = "ChiloeCamera";
constexpr int CaptureTimeoutSeconds = 10;
constexpr int MaxPreviewWidth = 1920;
constexpr int MaxPreviewHeight = 1080;

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

void onSessionClosed(void*, ACameraCaptureSession*) {
    __android_log_print(ANDROID_LOG_DEBUG, LogTag, "session onClosed");
}
void onSessionReady(void*, ACameraCaptureSession*) {
    __android_log_print(ANDROID_LOG_DEBUG, LogTag, "session onReady");
}
void onSessionActive(void*, ACameraCaptureSession*) {
    __android_log_print(ANDROID_LOG_DEBUG, LogTag, "session onActive");
}

// setRepeatingRequest se llamaba con callbacks=nullptr, así que un fallo por
// request (p.ej. target/formato inválido) no se veía en absoluto en logcat.
void onPreviewCaptureFailed(void*, ACameraCaptureSession*, ACaptureRequest*, ACameraCaptureFailure* failure) {
    __android_log_print(
        ANDROID_LOG_ERROR,
        LogTag,
        "preview capture failed: reason=%d sequenceId=%d",
        failure != nullptr ? failure->reason : -1,
        failure != nullptr ? failure->sequenceId : -1);
}

void onPreviewSequenceAborted(void*, ACameraCaptureSession*, int sequenceId) {
    __android_log_print(ANDROID_LOG_ERROR, LogTag, "preview sequence aborted: sequenceId=%d", sequenceId);
}

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

void readSensorCharacteristics(
    ACameraManager* manager,
    const std::string& cameraId,
    int& orientationDegrees,
    bool& frontFacing) {
    ACameraMetadata* metadata = nullptr;
    if (ACameraManager_getCameraCharacteristics(manager, cameraId.c_str(), &metadata) != ACAMERA_OK) {
        return;
    }

    ACameraMetadata_const_entry orientationEntry{};
    if (ACameraMetadata_getConstEntry(metadata, ACAMERA_SENSOR_ORIENTATION, &orientationEntry) == ACAMERA_OK &&
        orientationEntry.count > 0) {
        orientationDegrees = orientationEntry.data.i32[0];
    }

    ACameraMetadata_const_entry facingEntry{};
    if (ACameraMetadata_getConstEntry(metadata, ACAMERA_LENS_FACING, &facingEntry) == ACAMERA_OK &&
        facingEntry.count > 0) {
        frontFacing = facingEntry.data.u8[0] == ACAMERA_LENS_FACING_FRONT;
    }

    ACameraMetadata_free(metadata);
}

// Elige el stream más grande disponible para `format` que no exceda
// maxWidth/maxHeight (usar límites de int para "sin tope", como en JPEG).
Size chooseStreamSize(
    ACameraManager* manager,
    const std::string& cameraId,
    int32_t format,
    int maxWidth,
    int maxHeight) {
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
    long selectedArea = 0;

    if (status == ACAMERA_OK) {
        for (uint32_t index = 0; index + 3 < entry.count; index += 4) {
            const int32_t streamFormat = entry.data.i32[index];
            const int32_t width = entry.data.i32[index + 1];
            const int32_t height = entry.data.i32[index + 2];
            const int32_t input = entry.data.i32[index + 3];
            const long area = static_cast<long>(width) * static_cast<long>(height);

            if (streamFormat == format && input == 0 && width <= maxWidth && height <= maxHeight &&
                area > selectedArea) {
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

    int sensorOrientationDegrees = 90;
    bool frontFacing = false;
    int deviceOrientationDegrees = 0;
    Size previewSize;

    // Fórmula de la documentación de CaptureRequest#JPEG_ORIENTATION: la
    // rotación del dispositivo se invierte en cámaras frontales porque su
    // imagen ya viene espejada.
    int jpegOrientation() const {
        const int deviceOrientation =
            frontFacing ? -deviceOrientationDegrees : deviceOrientationDegrees;
        return ((sensorOrientationDegrees + deviceOrientation) % 360 + 360) % 360;
    }

    AImageReader* jpegReader = nullptr;
    ANativeWindow* jpegWindow = nullptr;
    ACaptureSessionOutput* jpegOutput = nullptr;
    ImageCaptureContext captureContext;

    // Propiedad del ANativeWindow del preview pasa a la sesión una vez
    // recibido vía setPreviewSurface (liberado en clearPreviewSurface/close).
    ANativeWindow* previewWindow = nullptr;
    ACaptureSessionOutput* previewOutput = nullptr;
    ACameraOutputTarget* previewTarget = nullptr;
    ACaptureRequest* previewRequest = nullptr;

    ACaptureSessionOutputContainer* outputs = nullptr;
    ACameraCaptureSession* session = nullptr;

    void applyControls(ACaptureRequest* request) const {
        uint8_t aeMode = ACAMERA_CONTROL_AE_MODE_ON;
        if (iso > 0 || exposureMs > 0) {
            aeMode = ACAMERA_CONTROL_AE_MODE_OFF;
            ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AE_MODE, 1, &aeMode);

            if (iso > 0) {
                const int32_t isoValue = iso;
                ACaptureRequest_setEntry_i32(request, ACAMERA_SENSOR_SENSITIVITY, 1, &isoValue);
            }

            if (exposureMs > 0) {
                const int64_t exposureNs = static_cast<int64_t>(exposureMs * 1000000.0);
                ACaptureRequest_setEntry_i64(request, ACAMERA_SENSOR_EXPOSURE_TIME, 1, &exposureNs);
            }
        } else {
            ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AE_MODE, 1, &aeMode);
        }

        uint8_t afMode = ACAMERA_CONTROL_AF_MODE_CONTINUOUS_PICTURE;
        if (focusDistance >= 0) {
            afMode = ACAMERA_CONTROL_AF_MODE_OFF;
            ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AF_MODE, 1, &afMode);
            ACaptureRequest_setEntry_float(request, ACAMERA_LENS_FOCUS_DISTANCE, 1, &focusDistance);
        } else {
            ACaptureRequest_setEntry_u8(request, ACAMERA_CONTROL_AF_MODE, 1, &afMode);
        }
    }

    // Recrea la sesión de captura reflejando el conjunto actual de outputs
    // (siempre JPEG; preview también si hay un previewWindow activo).
    void rebuildSession() {
        if (session != nullptr) {
            ACameraCaptureSession_stopRepeating(session);
            ACameraCaptureSession_close(session);
            session = nullptr;
        }
        if (outputs != nullptr) {
            ACaptureSessionOutputContainer_free(outputs);
            outputs = nullptr;
        }
        if (previewTarget != nullptr) {
            ACameraOutputTarget_free(previewTarget);
            previewTarget = nullptr;
        }
        if (previewRequest != nullptr) {
            ACaptureRequest_free(previewRequest);
            previewRequest = nullptr;
        }

        checkCamera(ACaptureSessionOutputContainer_create(&outputs), "failed to create output container");
        checkCamera(ACaptureSessionOutputContainer_add(outputs, jpegOutput), "failed to add jpeg output");
        if (previewOutput != nullptr) {
            checkCamera(ACaptureSessionOutputContainer_add(outputs, previewOutput), "failed to add preview output");
        }

        ACameraCaptureSession_stateCallbacks sessionCallbacks{};
        sessionCallbacks.context = nullptr;
        sessionCallbacks.onClosed = onSessionClosed;
        sessionCallbacks.onReady = onSessionReady;
        sessionCallbacks.onActive = onSessionActive;

        checkCamera(
            ACameraDevice_createCaptureSession(device, outputs, &sessionCallbacks, &session),
            "failed to create capture session");

        if (previewWindow != nullptr) {
            checkCamera(
                ACameraDevice_createCaptureRequest(device, TEMPLATE_PREVIEW, &previewRequest),
                "failed to create preview request");
            checkCamera(
                ACameraOutputTarget_create(previewWindow, &previewTarget),
                "failed to create preview target");
            checkCamera(ACaptureRequest_addTarget(previewRequest, previewTarget), "failed to add preview target");
            applyControls(previewRequest);

            ACameraCaptureSession_captureCallbacks previewCallbacks{};
            previewCallbacks.context = nullptr;
            previewCallbacks.onCaptureFailed = onPreviewCaptureFailed;
            previewCallbacks.onCaptureSequenceAborted = onPreviewSequenceAborted;

            ACaptureRequest* requests[] = {previewRequest};
            checkCamera(
                ACameraCaptureSession_setRepeatingRequest(session, &previewCallbacks, 1, requests, nullptr),
                "failed to start preview");
        }
    }
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
    readSensorCharacteristics(
        impl_->manager,
        impl_->cameraId,
        impl_->sensorOrientationDegrees,
        impl_->frontFacing);

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

    const auto jpegSize = chooseStreamSize(
        impl_->manager, impl_->cameraId, AIMAGE_FORMAT_JPEG,
        std::numeric_limits<int>::max(), std::numeric_limits<int>::max());
    checkMedia(
        AImageReader_new(jpegSize.width, jpegSize.height, AIMAGE_FORMAT_JPEG, 1, &impl_->jpegReader),
        "failed to create image reader");

    AImageReader_ImageListener imageListener{};
    imageListener.context = &impl_->captureContext;
    imageListener.onImageAvailable = onImageAvailable;
    checkMedia(
        AImageReader_setImageListener(impl_->jpegReader, &imageListener),
        "failed to set image listener");
    checkMedia(
        AImageReader_getWindow(impl_->jpegReader, &impl_->jpegWindow),
        "failed to get image reader window");
    checkCamera(
        ACaptureSessionOutput_create(impl_->jpegWindow, &impl_->jpegOutput),
        "failed to create jpeg output");

    impl_->rebuildSession();
}

void CameraSession::close() {
    if (impl_->session != nullptr) {
        ACameraCaptureSession_stopRepeating(impl_->session);
        ACameraCaptureSession_close(impl_->session);
        impl_->session = nullptr;
    }
    if (impl_->previewTarget != nullptr) {
        ACameraOutputTarget_free(impl_->previewTarget);
        impl_->previewTarget = nullptr;
    }
    if (impl_->previewRequest != nullptr) {
        ACaptureRequest_free(impl_->previewRequest);
        impl_->previewRequest = nullptr;
    }
    if (impl_->previewOutput != nullptr) {
        ACaptureSessionOutput_free(impl_->previewOutput);
        impl_->previewOutput = nullptr;
    }
    if (impl_->previewWindow != nullptr) {
        ANativeWindow_release(impl_->previewWindow);
        impl_->previewWindow = nullptr;
    }
    if (impl_->outputs != nullptr) {
        ACaptureSessionOutputContainer_free(impl_->outputs);
        impl_->outputs = nullptr;
    }
    if (impl_->jpegOutput != nullptr) {
        ACaptureSessionOutput_free(impl_->jpegOutput);
        impl_->jpegOutput = nullptr;
    }
    if (impl_->jpegReader != nullptr) {
        AImageReader_delete(impl_->jpegReader);
        impl_->jpegReader = nullptr;
        impl_->jpegWindow = nullptr;
    }
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

void CameraSession::setPreviewSurface(ANativeWindow* window) {
    if (impl_->device == nullptr) {
        open();
    }

    // Reemplaza cualquier preview previo antes de instalar el nuevo.
    if (impl_->previewWindow != nullptr) {
        ANativeWindow_release(impl_->previewWindow);
        impl_->previewWindow = nullptr;
    }
    if (impl_->previewOutput != nullptr) {
        ACaptureSessionOutput_free(impl_->previewOutput);
        impl_->previewOutput = nullptr;
    }

    const auto previewSize = chooseStreamSize(
        impl_->manager, impl_->cameraId, AIMAGE_FORMAT_PRIVATE, MaxPreviewWidth, MaxPreviewHeight);
    // Lo consulta la vista de preview para calcular su matriz de transformación:
    // el buffer llega en orientación de sensor (apaisado) y hay que rotarlo y
    // escalarlo para que llene una vista vertical sin deformarse.
    impl_->previewSize = previewSize;
    __android_log_print(
        ANDROID_LOG_DEBUG,
        LogTag,
        "setPreviewSurface: chosen size=%dx%d (default %dx%d means no matching stream config was found)",
        previewSize.width,
        previewSize.height,
        Size{}.width,
        Size{}.height);
    const auto geometryResult =
        ANativeWindow_setBuffersGeometry(window, previewSize.width, previewSize.height, 0);
    if (geometryResult != 0) {
        __android_log_print(
            ANDROID_LOG_ERROR, LogTag, "ANativeWindow_setBuffersGeometry failed: %d", geometryResult);
    }

    impl_->previewWindow = window;
    checkCamera(
        ACaptureSessionOutput_create(impl_->previewWindow, &impl_->previewOutput),
        "failed to create preview output");

    impl_->rebuildSession();
}

void CameraSession::clearPreviewSurface() {
    if (impl_->previewWindow == nullptr) {
        return;
    }

    if (impl_->previewOutput != nullptr) {
        ACaptureSessionOutput_free(impl_->previewOutput);
        impl_->previewOutput = nullptr;
    }
    ANativeWindow_release(impl_->previewWindow);
    impl_->previewWindow = nullptr;

    impl_->rebuildSession();
}

void CameraSession::setDeviceOrientation(int degrees) {
    // Se redondea al múltiplo de 90 más cercano: OrientationEventListener
    // entrega grados continuos y JPEG_ORIENTATION solo admite cuartos de vuelta.
    const int normalized = ((degrees % 360) + 360) % 360;
    impl_->deviceOrientationDegrees = ((normalized + 45) / 90 * 90) % 360;
}

SensorGeometry CameraSession::sensorGeometry() const {
    SensorGeometry geometry;
    geometry.orientationDegrees = impl_->sensorOrientationDegrees;
    geometry.frontFacing = impl_->frontFacing;
    geometry.previewWidth = impl_->previewSize.width;
    geometry.previewHeight = impl_->previewSize.height;
    return geometry;
}

CaptureResult CameraSession::captureJpeg(const std::string& outputPath) {
    if (impl_->device == nullptr) {
        open();
    }
    if (impl_->session == nullptr) {
        impl_->rebuildSession();
    }

    {
        std::lock_guard<std::mutex> lock(impl_->captureContext.mutex);
        impl_->captureContext.completed = false;
        impl_->captureContext.failed = false;
        impl_->captureContext.jpeg.clear();
    }

    ACaptureRequest* request = nullptr;
    ACameraOutputTarget* target = nullptr;

    checkCamera(
        ACameraDevice_createCaptureRequest(impl_->device, TEMPLATE_STILL_CAPTURE, &request),
        "failed to create capture request");
    checkCamera(ACameraOutputTarget_create(impl_->jpegWindow, &target), "failed to create output target");
    checkCamera(ACaptureRequest_addTarget(request, target), "failed to add target");
    impl_->applyControls(request);

    const int32_t jpegOrientation = impl_->jpegOrientation();
    ACaptureRequest_setEntry_i32(request, ACAMERA_JPEG_ORIENTATION, 1, &jpegOrientation);

    ACaptureRequest* requests[] = {request};
    int sequenceId = 0;
    checkCamera(
        ACameraCaptureSession_capture(impl_->session, nullptr, 1, requests, &sequenceId),
        "failed to capture JPEG");

    {
        std::unique_lock<std::mutex> lock(impl_->captureContext.mutex);
        const bool completed = impl_->captureContext.cv.wait_for(
            lock,
            std::chrono::seconds(CaptureTimeoutSeconds),
            [this] { return impl_->captureContext.completed; });

        if (!completed || impl_->captureContext.failed || impl_->captureContext.jpeg.empty()) {
            ACaptureRequest_removeTarget(request, target);
            ACameraOutputTarget_free(target);
            ACaptureRequest_free(request);
            throw std::runtime_error("camera capture timed out or failed");
        }
    }

    writeJpegFile(outputPath, impl_->captureContext.jpeg);

    ACaptureRequest_removeTarget(request, target);
    ACameraOutputTarget_free(target);
    ACaptureRequest_free(request);

    CaptureResult result;
    result.filePath = outputPath;
    result.width = impl_->captureContext.width;
    result.height = impl_->captureContext.height;
    return result;
}

} // namespace chiloe::camera
