#include "camera_ndk.hpp"

#include "exif_minimal.hpp"

#include <android/native_window_jni.h>
#include <jni.h>

#include <atomic>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <unordered_map>

namespace {

std::mutex sessionsMutex;
// shared_ptr y no unique_ptr: `getSession` suelta el mutex antes de que el
// llamador use la sesión, así que hay que mantenerla viva mientras dure la
// llamada. Con unique_ptr, un `nativeClose` concurrente la destruía y el otro
// hilo quedaba con una referencia colgando.
std::unordered_map<int, std::shared_ptr<chiloe::camera::CameraSession>> sessions;
std::atomic<int> nextSessionId{1};

std::string toString(JNIEnv* env, jstring value) {
    const char* raw = env->GetStringUTFChars(value, nullptr);
    if (raw == nullptr) {
        throw std::runtime_error("invalid string");
    }
    std::string result(raw);
    env->ReleaseStringUTFChars(value, raw);
    return result;
}

std::shared_ptr<chiloe::camera::CameraSession> findSession(int sessionId) {
    std::lock_guard<std::mutex> lock(sessionsMutex);
    const auto it = sessions.find(sessionId);
    if (it == sessions.end()) {
        return nullptr;
    }
    return it->second;
}

std::shared_ptr<chiloe::camera::CameraSession> getSession(int sessionId) {
    auto session = findSession(sessionId);
    if (!session) {
        throw std::runtime_error("camera session not found");
    }
    return session;
}

void throwJava(JNIEnv* env, const std::exception& error) {
    const auto clazz = env->FindClass("java/lang/IllegalStateException");
    env->ThrowNew(clazz, error.what());
}

} // namespace

extern "C" JNIEXPORT jint JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeOpenCamera(
    JNIEnv* env,
    jobject,
    jstring lens) {
    try {
        auto session = std::make_unique<chiloe::camera::CameraSession>(toString(env, lens));
        session->open();
        const int sessionId = nextSessionId.fetch_add(1);

        std::lock_guard<std::mutex> lock(sessionsMutex);
        sessions.emplace(sessionId, std::move(session));
        return sessionId;
    } catch (const std::exception& error) {
        throwJava(env, error);
        return 0;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeSetIso(
    JNIEnv* env,
    jobject,
    jint sessionId,
    jint iso) {
    try {
        getSession(sessionId)->setIso(iso);
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeSetExposureMs(
    JNIEnv* env,
    jobject,
    jint sessionId,
    jdouble exposureMs) {
    try {
        getSession(sessionId)->setExposureMs(exposureMs);
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeSetFocusDistance(
    JNIEnv* env,
    jobject,
    jint sessionId,
    jfloat distance) {
    try {
        getSession(sessionId)->setFocusDistance(distance);
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeSetAutoFocus(
    JNIEnv* env,
    jobject,
    jint sessionId) {
    try {
        getSession(sessionId)->setAutoFocus();
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT jintArray JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeCaptureJpeg(
    JNIEnv* env,
    jobject,
    jint sessionId,
    jstring outputPath,
    jint deviceOrientation) {
    try {
        const auto session = getSession(sessionId);
        session->setDeviceOrientation(deviceOrientation);
        const auto result = session->captureJpeg(toString(env, outputPath));
        jint values[] = {result.width, result.height};
        jintArray array = env->NewIntArray(2);
        env->SetIntArrayRegion(array, 0, 2, values);
        return array;
    } catch (const std::exception& error) {
        throwJava(env, error);
        return nullptr;
    }
}

// Devuelve {orientación del sensor, 1 si es frontal, ancho y alto del preview}
// para que la vista de preview calcule su transformación.
extern "C" JNIEXPORT jintArray JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeGetSensorGeometry(
    JNIEnv* env,
    jobject,
    jint sessionId) {
    try {
        const auto geometry = getSession(sessionId)->sensorGeometry();
        jint values[] = {
            geometry.orientationDegrees,
            geometry.frontFacing ? 1 : 0,
            geometry.previewWidth,
            geometry.previewHeight,
        };
        jintArray array = env->NewIntArray(4);
        env->SetIntArrayRegion(array, 0, 4, values);
        return array;
    } catch (const std::exception& error) {
        throwJava(env, error);
        return nullptr;
    }
}

// Rangos que el sensor acepta, para que la UI de controles manuales no ofrezca
// valores que el driver ignora. Los double van en un array aparte porque JNI no
// mezcla tipos en un mismo array primitivo.
// Enteros: {isoMin, isoMax, maxAfRegions, manualSensor?1:0, previewW, previewH}
extern "C" JNIEXPORT jintArray JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeGetCapabilitiesInt(
    JNIEnv* env,
    jobject,
    jint sessionId) {
    try {
        const auto caps = getSession(sessionId)->capabilities();
        jint values[] = {
            caps.isoMin,
            caps.isoMax,
            caps.maxAfRegions,
            caps.supportsManualSensor ? 1 : 0,
            caps.previewWidth,
            caps.previewHeight,
        };
        jintArray array = env->NewIntArray(6);
        env->SetIntArrayRegion(array, 0, 6, values);
        return array;
    } catch (const std::exception& error) {
        throwJava(env, error);
        return nullptr;
    }
}

// Reales: {exposiciónMínMs, exposiciónMáxMs, dioptríasMáximas}
extern "C" JNIEXPORT jdoubleArray JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeGetCapabilitiesDouble(
    JNIEnv* env,
    jobject,
    jint sessionId) {
    try {
        const auto caps = getSession(sessionId)->capabilities();
        jdouble values[] = {
            caps.exposureMinMs,
            caps.exposureMaxMs,
            static_cast<jdouble>(caps.focusMaxDiopters),
        };
        jdoubleArray array = env->NewDoubleArray(3);
        env->SetDoubleArrayRegion(array, 0, 3, values);
        return array;
    } catch (const std::exception& error) {
        throwJava(env, error);
        return nullptr;
    }
}

// Las fotos de la galería llegan con el EXIF completo del aparato que las
// tomó, GPS incluido. Se pasan por el mismo saneado que las capturas propias.
extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeStripSensitiveExif(
    JNIEnv* env,
    jobject,
    jstring filePath) {
    try {
        chiloe::camera::stripSensitiveExif(toString(env, filePath));
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeFocusAt(
    JNIEnv* env,
    jobject,
    jint sessionId,
    jfloat x,
    jfloat y) {
    try {
        getSession(sessionId)->focusAt(x, y);
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeSetPreviewSurface(
    JNIEnv* env,
    jobject,
    jint sessionId,
    jobject surface) {
    try {
        ANativeWindow* window = ANativeWindow_fromSurface(env, surface);
        if (window == nullptr) {
            throw std::runtime_error("invalid preview surface");
        }
        getSession(sessionId)->setPreviewSurface(window);
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeClearPreviewSurface(
    JNIEnv* env,
    jobject,
    jint sessionId) {
    try {
        // Soltar el preview de una sesión que ya no existe no es un error: al
        // salir de la pantalla, JS cierra la sesión y el SurfaceTexture se
        // destruye después. Lanzar aquí mataba la app al apretar "Volver".
        if (const auto session = findSession(sessionId)) {
            session->clearPreviewSurface();
        }
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeClose(
    JNIEnv* env,
    jobject,
    jint sessionId) {
    try {
        std::shared_ptr<chiloe::camera::CameraSession> session;
        {
            std::lock_guard<std::mutex> lock(sessionsMutex);
            const auto it = sessions.find(sessionId);
            if (it == sessions.end()) {
                return;
            }
            session = std::move(it->second);
            sessions.erase(it);
        }
        session->close();
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

