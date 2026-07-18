cmake_minimum_required(VERSION 3.22.1)

# Nombre del proyecto fijado a "appmodules": React Native busca libappmodules.so
# en tiempo de ejecución para cargar los TurboModules autolinkeados (incluidos los
# built-in como PlatformConstants). Este include genera y linkea esa librería.
project(appmodules)
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

add_library(
    chiloe_camera
    SHARED
    camera/camera_ndk.cpp
    camera/chiloe_camera_jni.cpp
    camera/exif_minimal.cpp
    camera/jpeg_writer.cpp
)

target_compile_features(chiloe_camera PRIVATE cxx_std_17)
target_compile_options(chiloe_camera PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(
    chiloe_camera
    android
    camera2ndk
    log
    mediandk
)

