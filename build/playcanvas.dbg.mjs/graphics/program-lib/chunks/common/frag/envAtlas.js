/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var envAtlasPS = `
// the envAtlas is fixed at 512 pixels. every equirect is generated with 1 pixel boundary.
const float atlasSize = 512.0;
const float seamSize = 1.0 / atlasSize;

// map a normalized equirect UV to the given rectangle (taking 1 pixel seam into account).
vec2 mapUv(vec2 uv, vec4 rect) {
    return vec2(mix(rect.x + seamSize, rect.x + rect.z - seamSize, uv.x),
                mix(rect.y + seamSize, rect.y + rect.w - seamSize, uv.y));
}

// map a normalized equirect UV and roughness level to the correct atlas rect.
vec2 mapRoughnessUv(vec2 uv, float level) {
    float t = 1.0 / exp2(level);
    return mapUv(uv, vec4(0, 1.0 - t, t, t * 0.5));
}

// map shiny level UV
vec2 mapShinyUv(vec2 uv, float level) {
    float t = 1.0 / exp2(level);
    return mapUv(uv, vec4(1.0 - t, 1.0 - t, t, t * 0.5));
}
`;

export { envAtlasPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52QXRsYXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvZW52QXRsYXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2Bcbi8vIHRoZSBlbnZBdGxhcyBpcyBmaXhlZCBhdCA1MTIgcGl4ZWxzLiBldmVyeSBlcXVpcmVjdCBpcyBnZW5lcmF0ZWQgd2l0aCAxIHBpeGVsIGJvdW5kYXJ5LlxuY29uc3QgZmxvYXQgYXRsYXNTaXplID0gNTEyLjA7XG5jb25zdCBmbG9hdCBzZWFtU2l6ZSA9IDEuMCAvIGF0bGFzU2l6ZTtcblxuLy8gbWFwIGEgbm9ybWFsaXplZCBlcXVpcmVjdCBVViB0byB0aGUgZ2l2ZW4gcmVjdGFuZ2xlICh0YWtpbmcgMSBwaXhlbCBzZWFtIGludG8gYWNjb3VudCkuXG52ZWMyIG1hcFV2KHZlYzIgdXYsIHZlYzQgcmVjdCkge1xuICAgIHJldHVybiB2ZWMyKG1peChyZWN0LnggKyBzZWFtU2l6ZSwgcmVjdC54ICsgcmVjdC56IC0gc2VhbVNpemUsIHV2LngpLFxuICAgICAgICAgICAgICAgIG1peChyZWN0LnkgKyBzZWFtU2l6ZSwgcmVjdC55ICsgcmVjdC53IC0gc2VhbVNpemUsIHV2LnkpKTtcbn1cblxuLy8gbWFwIGEgbm9ybWFsaXplZCBlcXVpcmVjdCBVViBhbmQgcm91Z2huZXNzIGxldmVsIHRvIHRoZSBjb3JyZWN0IGF0bGFzIHJlY3QuXG52ZWMyIG1hcFJvdWdobmVzc1V2KHZlYzIgdXYsIGZsb2F0IGxldmVsKSB7XG4gICAgZmxvYXQgdCA9IDEuMCAvIGV4cDIobGV2ZWwpO1xuICAgIHJldHVybiBtYXBVdih1diwgdmVjNCgwLCAxLjAgLSB0LCB0LCB0ICogMC41KSk7XG59XG5cbi8vIG1hcCBzaGlueSBsZXZlbCBVVlxudmVjMiBtYXBTaGlueVV2KHZlYzIgdXYsIGZsb2F0IGxldmVsKSB7XG4gICAgZmxvYXQgdCA9IDEuMCAvIGV4cDIobGV2ZWwpO1xuICAgIHJldHVybiBtYXBVdih1diwgdmVjNCgxLjAgLSB0LCAxLjAgLSB0LCB0LCB0ICogMC41KSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsaUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F0QkE7Ozs7In0=
