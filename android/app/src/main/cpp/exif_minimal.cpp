#include "exif_minimal.hpp"

#include <cstdint>
#include <fstream>
#include <stdexcept>
#include <vector>

namespace chiloe::camera {
namespace {

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

} // namespace

void stripSensitiveExif(const std::string& filePath) {
    const auto source = readAll(filePath);
    if (source.size() < 4 || source[0] != 0xFF || source[1] != 0xD8) {
        return;
    }

    std::vector<std::uint8_t> sanitized;
    sanitized.reserve(source.size());
    sanitized.push_back(0xFF);
    sanitized.push_back(0xD8);

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

        const bool isExifApp1 = marker == 0xE1;
        if (!isExifApp1) {
            sanitized.insert(
                sanitized.end(),
                source.begin() + static_cast<long>(offset),
                source.begin() + static_cast<long>(offset + 2 + segmentLength));
        }

        offset += 2 + segmentLength;
    }

    writeAll(filePath, sanitized);
}

} // namespace chiloe::camera

