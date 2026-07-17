#include "camera_ndk.hpp"

#include <jni.h>

#include <atomic>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <unordered_map>

namespace {

std::mutex sessionsMutex;
std::unordered_map<int, std::unique_ptr<chiloe::camera::CameraSession>> sessions;
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

chiloe::camera::CameraSession& getSession(int sessionId) {
    std::lock_guard<std::mutex> lock(sessionsMutex);
    const auto it = sessions.find(sessionId);
    if (it == sessions.end() || !it->second) {
        throw std::runtime_error("camera session not found");
    }
    return *it->second;
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
        getSession(sessionId).setIso(iso);
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
        getSession(sessionId).setExposureMs(exposureMs);
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
        getSession(sessionId).setFocusDistance(distance);
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
        getSession(sessionId).setAutoFocus();
    } catch (const std::exception& error) {
        throwJava(env, error);
    }
}

extern "C" JNIEXPORT jintArray JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeCaptureJpeg(
    JNIEnv* env,
    jobject,
    jint sessionId,
    jstring outputPath) {
    try {
        const auto result = getSession(sessionId).captureJpeg(toString(env, outputPath));
        jint values[] = {result.width, result.height};
        jintArray array = env->NewIntArray(2);
        env->SetIntArrayRegion(array, 0, 2, values);
        return array;
    } catch (const std::exception& error) {
        throwJava(env, error);
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_cl_chiloe_biodiversidad_camera_ChiloeCameraModule_nativeClose(
    JNIEnv* env,
    jobject,
    jint sessionId) {
    try {
        std::unique_ptr<chiloe::camera::CameraSession> session;
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

