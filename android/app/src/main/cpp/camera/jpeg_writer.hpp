#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace chiloe::camera {

void writeJpegFile(const std::string& outputPath, const std::vector<std::uint8_t>& bytes);

} // namespace chiloe::camera

