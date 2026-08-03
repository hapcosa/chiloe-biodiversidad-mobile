// Pruebas de la lógica EXIF, que es pura y no depende de Android. No entra en
// libchiloe_camera.so (ver CMakeLists.txt): se compila y ejecuta a mano.
//
//   cd android/app/src/main/cpp/camera
//   g++ -std=c++17 -Wall -Wextra -o /tmp/exif_test exif_minimal.cpp exif_minimal_test.cpp
//   /tmp/exif_test

#include "exif_minimal.hpp"

#include <cassert>
#include <cstdio>
#include <string>

namespace {

using Bytes = std::vector<std::uint8_t>;

void append16(Bytes& bytes, std::uint16_t value) {
    bytes.push_back(static_cast<std::uint8_t>(value >> 8U));
    bytes.push_back(static_cast<std::uint8_t>(value & 0xFFU));
}

// APP1 EXIF little endian con tres etiquetas: orientación, modelo de cámara y
// un bloque que hace las veces de dato sensible.
Bytes buildExifApp1(std::uint16_t orientation) {
    Bytes tiff{'I', 'I', 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00};

    const std::uint16_t entryCount = 3;
    tiff.push_back(static_cast<std::uint8_t>(entryCount));
    tiff.push_back(0x00);

    const auto appendEntry = [&tiff](std::uint16_t tag, std::uint16_t value) {
        tiff.push_back(static_cast<std::uint8_t>(tag & 0xFFU));
        tiff.push_back(static_cast<std::uint8_t>(tag >> 8U));
        tiff.push_back(0x03); // SHORT
        tiff.push_back(0x00);
        tiff.insert(tiff.end(), {0x01, 0x00, 0x00, 0x00});
        tiff.push_back(static_cast<std::uint8_t>(value & 0xFFU));
        tiff.push_back(static_cast<std::uint8_t>(value >> 8U));
        tiff.insert(tiff.end(), {0x00, 0x00});
    };

    appendEntry(0x0110, 0xBEEF); // Model
    appendEntry(0x0112, orientation);
    appendEntry(0x8825, 0xCAFE); // GPS IFD pointer
    tiff.insert(tiff.end(), {0x00, 0x00, 0x00, 0x00});

    Bytes segment{0xFF, 0xE1};
    append16(segment, static_cast<std::uint16_t>(tiff.size() + 6 + 2));
    segment.insert(segment.end(), {'E', 'x', 'i', 'f', 0x00, 0x00});
    segment.insert(segment.end(), tiff.begin(), tiff.end());
    return segment;
}

Bytes buildJpeg(const Bytes& app1) {
    Bytes jpeg{0xFF, 0xD8};
    jpeg.insert(jpeg.end(), app1.begin(), app1.end());
    // APP0 (JFIF) que debe sobrevivir intacto.
    jpeg.insert(jpeg.end(), {0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00});
    // SOS y datos comprimidos.
    jpeg.insert(jpeg.end(), {0xFF, 0xDA, 0x00, 0x03, 0x00, 0x11, 0x22, 0x33, 0xFF, 0xD9});
    return jpeg;
}

bool contains(const Bytes& haystack, const Bytes& needle) {
    if (needle.size() > haystack.size()) {
        return false;
    }
    for (std::size_t start = 0; start + needle.size() <= haystack.size(); ++start) {
        if (std::equal(needle.begin(), needle.end(), haystack.begin() + static_cast<long>(start))) {
            return true;
        }
    }
    return false;
}

void expect(bool condition, const char* description) {
    if (!condition) {
        std::printf("FALLO: %s\n", description);
        std::abort();
    }
    std::printf("ok: %s\n", description);
}

} // namespace

int main() {
    using namespace chiloe::camera;

    for (const std::uint16_t orientation : {1, 3, 6, 8}) {
        const auto source = buildJpeg(buildExifApp1(orientation));
        expect(readExifOrientation(source) == orientation, "lee la orientación del EXIF original");

        const auto sanitized = sanitizeJpegExif(source);
        expect(
            readExifOrientation(sanitized) == orientation,
            "conserva la orientación tras limpiar el EXIF");
    }

    const auto source = buildJpeg(buildExifApp1(6));
    const auto sanitized = sanitizeJpegExif(source);

    expect(!contains(sanitized, Bytes{0xEF, 0xBE}), "descarta el modelo de cámara");
    expect(!contains(sanitized, Bytes{0xFE, 0xCA}), "descarta el puntero a la IFD de GPS");
    expect(contains(sanitized, Bytes{0xFF, 0xE0, 0x00, 0x04}), "no toca los demás segmentos");
    expect(
        contains(sanitized, Bytes{0xFF, 0xDA, 0x00, 0x03, 0x00, 0x11, 0x22, 0x33, 0xFF, 0xD9}),
        "no toca los datos comprimidos");
    expect(sanitized.size() < source.size(), "el resultado es más pequeño que el original");

    // Un JPEG sin EXIF gana un APP1 con orientación normal, para que el archivo
    // salga siempre con una orientación explícita.
    const auto withoutExif = buildJpeg({});
    const auto sanitizedWithoutExif = sanitizeJpegExif(withoutExif);
    expect(
        readExifOrientation(sanitizedWithoutExif) == OrientationNormal,
        "un JPEG sin EXIF queda con orientación normal");

    const Bytes notAJpeg{0x00, 0x01, 0x02, 0x03};
    expect(sanitizeJpegExif(notAJpeg) == notAJpeg, "deja intacto lo que no es JPEG");

    std::printf("\nTodas las pruebas pasaron.\n");
    return 0;
}
