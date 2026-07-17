#include "jpeg_writer.hpp"

#include "exif_minimal.hpp"

#include <fstream>
#include <stdexcept>

namespace chiloe::camera {

void writeJpegFile(const std::string& outputPath, const std::vector<std::uint8_t>& bytes) {
    if (bytes.empty()) {
        throw std::runtime_error("capture produced an empty JPEG");
    }

    std::ofstream output(outputPath, std::ios::binary | std::ios::trunc);
    if (!output) {
        throw std::runtime_error("failed to open output JPEG path");
    }

    output.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    output.close();

    if (!output) {
        throw std::runtime_error("failed to write output JPEG");
    }

    stripSensitiveExif(outputPath);
}

} // namespace chiloe::camera

