cmake_minimum_required(VERSION 3.22.1)

project(chiloe_camera LANGUAGES CXX)

add_library(
    chiloe_camera
    SHARED
    camera_ndk.cpp
    chiloe_camera_jni.cpp
    exif_minimal.cpp
    jpeg_writer.cpp
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

