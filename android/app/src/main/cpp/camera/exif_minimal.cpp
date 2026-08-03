#include "exif_minimal.hpp"

#include <fstream>
#include <stdexcept>

namespace chiloe::camera {
namespace {

constexpr std::uint16_t OrientationTag = 0x0112;
constexpr std::uint16_t TypeShort = 3;

std::vector<std::uint8_t> readAll(const std::string& filePath) {
    std::ifstream input(filePath, std::ios::binary);
    if (!input) {
        throw std::runtime_error("failed to reopen captured JPEG");
    }

    return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

void writeAll(const std::string& filePath, const std::vector<std::uint8_t>& bytes) {
    std::ofstream output(filePath, std::ios::binary | std::ios::trunc);
    if (!output) {
        throw std::runtime_error("failed to rewrite captured JPEG");
    }
    output.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
}

std::uint16_t bigEndian16(const std::vector<std::uint8_t>& bytes, std::size_t offset) {
    return static_cast<std::uint16_t>((bytes[offset] << 8U) | bytes[offset + 1]);
}

std::uint16_t read16(const std::vector<std::uint8_t>& bytes, std::size_t offset, bool littleEndian) {
    return littleEndian
        ? static_cast<std::uint16_t>((bytes[offset + 1] << 8U) | bytes[offset])
        : static_cast<std::uint16_t>((bytes[offset] << 8U) | bytes[offset + 1]);
}

std::uint32_t read32(const std::vector<std::uint8_t>& bytes, std::size_t offset, bool littleEndian) {
    if (littleEndian) {
        return static_cast<std::uint32_t>(bytes[offset]) |
            (static_cast<std::uint32_t>(bytes[offset + 1]) << 8U) |
            (static_cast<std::uint32_t>(bytes[offset + 2]) << 16U) |
            (static_cast<std::uint32_t>(bytes[offset + 3]) << 24U);
    }
    return (static_cast<std::uint32_t>(bytes[offset]) << 24U) |
        (static_cast<std::uint32_t>(bytes[offset + 1]) << 16U) |
        (static_cast<std::uint32_t>(bytes[offset + 2]) << 8U) |
        static_cast<std::uint32_t>(bytes[offset + 3]);
}

bool isExifApp1(const std::vector<std::uint8_t>& bytes, std::size_t segmentStart, std::uint16_t segmentLength) {
    // segmentStart apunta al marcador (0xFF 0xE1); la firma va tras la longitud.
    const std::size_t signature = segmentStart + 4;
    return segmentLength >= 8 && signature + 6 <= bytes.size() && bytes[signature] == 'E' &&
        bytes[signature + 1] == 'x' && bytes[signature + 2] == 'i' && bytes[signature + 3] == 'f' &&
        bytes[signature + 4] == 0 && bytes[signature + 5] == 0;
}

// Recorre la IFD0 del bloque TIFF buscando la etiqueta de orientación.
std::uint16_t orientationFromTiff(
    const std::vector<std::uint8_t>& bytes,
    std::size_t tiffStart,
    std::size_t tiffEnd) {
    if (tiffStart + 8 > tiffEnd) {
        return OrientationNormal;
    }

    const bool littleEndian = bytes[tiffStart] == 'I' && bytes[tiffStart + 1] == 'I';
    const bool bigEndian = bytes[tiffStart] == 'M' && bytes[tiffStart + 1] == 'M';
    if (!littleEndian && !bigEndian) {
        return OrientationNormal;
    }

    const std::uint32_t ifdOffset = read32(bytes, tiffStart + 4, littleEndian);
    const std::size_t ifdStart = tiffStart + ifdOffset;
    if (ifdOffset < 8 || ifdStart + 2 > tiffEnd) {
        return OrientationNormal;
    }

    const std::uint16_t entryCount = read16(bytes, ifdStart, littleEndian);
    for (std::uint16_t index = 0; index < entryCount; ++index) {
        const std::size_t entry = ifdStart + 2 + static_cast<std::size_t>(index) * 12;
        if (entry + 12 > tiffEnd) {
            break;
        }

        if (read16(bytes, entry, littleEndian) == OrientationTag &&
            read16(bytes, entry + 2, littleEndian) == TypeShort) {
            // El valor cabe en los 4 bytes del propio campo, sin indirección.
            return read16(bytes, entry + 8, littleEndian);
        }
    }

    return OrientationNormal;
}

// APP1 de 36 bytes con una única IFD0 que solo contiene la orientación. La
// longitud declarada (0x22 = 34) cuenta el propio campo de longitud pero no el
// marcador, según la norma JPEG.
std::vector<std::uint8_t> buildOrientationApp1(std::uint16_t orientation) {
    std::vector<std::uint8_t> segment{
        0xFF, 0xE1,
        0x00, 0x22,                         // longitud del segmento
        'E', 'x', 'i', 'f', 0x00, 0x00,     // firma EXIF
        'M', 'M', 0x00, 0x2A,               // TIFF big endian
        0x00, 0x00, 0x00, 0x08,             // offset de la IFD0
        0x00, 0x01,                         // una entrada
        0x01, 0x12,                         // etiqueta: orientación
        0x00, 0x03,                         // tipo: SHORT
        0x00, 0x00, 0x00, 0x01,             // count
        0x00, 0x00, 0x00, 0x00,             // valor en los dos primeros bytes
        0x00, 0x00, 0x00, 0x00,             // no hay más IFD
    };
    segment[28] = static_cast<std::uint8_t>(orientation >> 8U);
    segment[29] = static_cast<std::uint8_t>(orientation & 0xFFU);
    return segment;
}

} // namespace

std::uint16_t readExifOrientation(const std::vector<std::uint8_t>& source) {
    if (source.size() < 4 || source[0] != 0xFF || source[1] != 0xD8) {
        return OrientationNormal;
    }

    std::size_t offset = 2;
    while (offset + 4 <= source.size()) {
        if (source[offset] != 0xFF || source[offset + 1] == 0xDA) {
            break;
        }

        const auto segmentLength = bigEndian16(source, offset + 2);
        if (segmentLength < 2 || offset + 2 + segmentLength > source.size()) {
            break;
        }

        if (source[offset + 1] == 0xE1 && isExifApp1(source, offset, segmentLength)) {
            return orientationFromTiff(source, offset + 10, offset + 2 + segmentLength);
        }

        offset += 2 + segmentLength;
    }

    return OrientationNormal;
}

std::vector<std::uint8_t> sanitizeJpegExif(const std::vector<std::uint8_t>& source) {
    if (source.size() < 4 || source[0] != 0xFF || source[1] != 0xD8) {
        return source;
    }

    // La orientación es el único dato del APP1 que hay que conservar: sin ella
    // la foto se muestra tal como la entrega el sensor, apaisada. El resto
    // (GPS, número de serie, modelo) se descarta a propósito.
    const auto orientation = readExifOrientation(source);

    std::vector<std::uint8_t> sanitized;
    sanitized.reserve(source.size());
    sanitized.push_back(0xFF);
    sanitized.push_back(0xD8);

    const auto app1 = buildOrientationApp1(orientation);
    sanitized.insert(sanitized.end(), app1.begin(), app1.end());

    std::size_t offset = 2;
    while (offset + 4 <= source.size()) {
        if (source[offset] != 0xFF) {
            sanitized.insert(sanitized.end(), source.begin() + static_cast<long>(offset), source.end());
            break;
        }

        const auto marker = source[offset + 1];
        if (marker == 0xDA) {
            sanitized.insert(sanitized.end(), source.begin() + static_cast<long>(offset), source.end());
            break;
        }

        const auto segmentLength = bigEndian16(source, offset + 2);
        if (segmentLength < 2 || offset + 2 + segmentLength > source.size()) {
            sanitized.insert(sanitized.end(), source.begin() + static_cast<long>(offset), source.end());
            break;
        }

        if (marker != 0xE1) {
            sanitized.insert(
                sanitized.end(),
                source.begin() + static_cast<long>(offset),
                source.begin() + static_cast<long>(offset + 2 + segmentLength));
        }

        offset += 2 + segmentLength;
    }

    return sanitized;
}

void stripSensitiveExif(const std::string& filePath) {
    writeAll(filePath, sanitizeJpegExif(readAll(filePath)));
}

} // namespace chiloe::camera
