#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace chiloe::camera {

// Etiqueta EXIF de orientación (0x0112). Los únicos valores que produce una
// cámara son 1 (derecha), 3 (180º), 6 (90º horario) y 8 (90º antihorario).
constexpr std::uint16_t OrientationNormal = 1;

// Devuelve el JPEG sin su APP1 original, reemplazado por uno mínimo que solo
// lleva la orientación. Función pura para poder probarla sin Android.
std::vector<std::uint8_t> sanitizeJpegExif(const std::vector<std::uint8_t>& source);

std::uint16_t readExifOrientation(const std::vector<std::uint8_t>& source);

void stripSensitiveExif(const std::string& filePath);

} // namespace chiloe::camera
