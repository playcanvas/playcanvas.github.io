/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var clusteredLightUtilsPS = `
// Converts unnormalized direction vector to a cubemap face index [0..5] and uv coordinates within the face in [0..1] range.
// Additionally offset to a tile in atlas within 3x3 subdivision is provided
vec2 getCubemapFaceCoordinates(const vec3 dir, out float faceIndex, out vec2 tileOffset)
{
    vec3 vAbs = abs(dir);
    float ma;
    vec2 uv;
    if (vAbs.z >= vAbs.x && vAbs.z >= vAbs.y) {   // front / back

        faceIndex = dir.z < 0.0 ? 5.0 : 4.0;
        ma = 0.5 / vAbs.z;
        uv = vec2(dir.z < 0.0 ? -dir.x : dir.x, -dir.y);

        tileOffset.x = 2.0;
        tileOffset.y = dir.z < 0.0 ? 1.0 : 0.0;

    } else if(vAbs.y >= vAbs.x) {  // top index 2, bottom index 3

        faceIndex = dir.y < 0.0 ? 3.0 : 2.0;
        ma = 0.5 / vAbs.y;
        uv = vec2(dir.x, dir.y < 0.0 ? -dir.z : dir.z);

        tileOffset.x = 1.0;
        tileOffset.y = dir.y < 0.0 ? 1.0 : 0.0;

    } else {    // left / right

        faceIndex = dir.x < 0.0 ? 1.0 : 0.0;
        ma = 0.5 / vAbs.x;
        uv = vec2(dir.x < 0.0 ? dir.z : -dir.z, -dir.y);

        tileOffset.x = 0.0;
        tileOffset.y = dir.x < 0.0 ? 1.0 : 0.0;

    }
    return uv * ma + 0.5;
}

// converts unnormalized direction vector to a texture coordinate for a cubemap face stored within texture atlas described by the viewport
vec2 getCubemapAtlasCoordinates(const vec3 omniAtlasViewport, float shadowEdgePixels, float shadowTextureResolution, const vec3 dir) {

    float faceIndex;
    vec2 tileOffset;
    vec2 uv = getCubemapFaceCoordinates(dir, faceIndex, tileOffset);

    // move uv coordinates inwards inside to compensate for larger fov when rendering shadow into atlas
    float atlasFaceSize = omniAtlasViewport.z;
    float tileSize = shadowTextureResolution * atlasFaceSize;
    float offset = shadowEdgePixels / tileSize;
    uv = uv * vec2(1.0 - offset * 2.0) + vec2(offset * 1.0);

    // scale uv coordinates to cube face area within the viewport
    uv *= atlasFaceSize;

    // offset into face of the atlas (3x3 grid)
    uv += tileOffset * atlasFaceSize;

    // offset into the atlas viewport
    uv += omniAtlasViewport.xy;

    return uv;
}
`;

export { clusteredLightUtilsPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3RlcmVkTGlnaHRVdGlscy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9jbHVzdGVyZWRMaWdodFV0aWxzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBDb252ZXJ0cyB1bm5vcm1hbGl6ZWQgZGlyZWN0aW9uIHZlY3RvciB0byBhIGN1YmVtYXAgZmFjZSBpbmRleCBbMC4uNV0gYW5kIHV2IGNvb3JkaW5hdGVzIHdpdGhpbiB0aGUgZmFjZSBpbiBbMC4uMV0gcmFuZ2UuXG4vLyBBZGRpdGlvbmFsbHkgb2Zmc2V0IHRvIGEgdGlsZSBpbiBhdGxhcyB3aXRoaW4gM3gzIHN1YmRpdmlzaW9uIGlzIHByb3ZpZGVkXG52ZWMyIGdldEN1YmVtYXBGYWNlQ29vcmRpbmF0ZXMoY29uc3QgdmVjMyBkaXIsIG91dCBmbG9hdCBmYWNlSW5kZXgsIG91dCB2ZWMyIHRpbGVPZmZzZXQpXG57XG4gICAgdmVjMyB2QWJzID0gYWJzKGRpcik7XG4gICAgZmxvYXQgbWE7XG4gICAgdmVjMiB1djtcbiAgICBpZiAodkFicy56ID49IHZBYnMueCAmJiB2QWJzLnogPj0gdkFicy55KSB7ICAgLy8gZnJvbnQgLyBiYWNrXG5cbiAgICAgICAgZmFjZUluZGV4ID0gZGlyLnogPCAwLjAgPyA1LjAgOiA0LjA7XG4gICAgICAgIG1hID0gMC41IC8gdkFicy56O1xuICAgICAgICB1diA9IHZlYzIoZGlyLnogPCAwLjAgPyAtZGlyLnggOiBkaXIueCwgLWRpci55KTtcblxuICAgICAgICB0aWxlT2Zmc2V0LnggPSAyLjA7XG4gICAgICAgIHRpbGVPZmZzZXQueSA9IGRpci56IDwgMC4wID8gMS4wIDogMC4wO1xuXG4gICAgfSBlbHNlIGlmKHZBYnMueSA+PSB2QWJzLngpIHsgIC8vIHRvcCBpbmRleCAyLCBib3R0b20gaW5kZXggM1xuXG4gICAgICAgIGZhY2VJbmRleCA9IGRpci55IDwgMC4wID8gMy4wIDogMi4wO1xuICAgICAgICBtYSA9IDAuNSAvIHZBYnMueTtcbiAgICAgICAgdXYgPSB2ZWMyKGRpci54LCBkaXIueSA8IDAuMCA/IC1kaXIueiA6IGRpci56KTtcblxuICAgICAgICB0aWxlT2Zmc2V0LnggPSAxLjA7XG4gICAgICAgIHRpbGVPZmZzZXQueSA9IGRpci55IDwgMC4wID8gMS4wIDogMC4wO1xuXG4gICAgfSBlbHNlIHsgICAgLy8gbGVmdCAvIHJpZ2h0XG5cbiAgICAgICAgZmFjZUluZGV4ID0gZGlyLnggPCAwLjAgPyAxLjAgOiAwLjA7XG4gICAgICAgIG1hID0gMC41IC8gdkFicy54O1xuICAgICAgICB1diA9IHZlYzIoZGlyLnggPCAwLjAgPyBkaXIueiA6IC1kaXIueiwgLWRpci55KTtcblxuICAgICAgICB0aWxlT2Zmc2V0LnggPSAwLjA7XG4gICAgICAgIHRpbGVPZmZzZXQueSA9IGRpci54IDwgMC4wID8gMS4wIDogMC4wO1xuXG4gICAgfVxuICAgIHJldHVybiB1diAqIG1hICsgMC41O1xufVxuXG4vLyBjb252ZXJ0cyB1bm5vcm1hbGl6ZWQgZGlyZWN0aW9uIHZlY3RvciB0byBhIHRleHR1cmUgY29vcmRpbmF0ZSBmb3IgYSBjdWJlbWFwIGZhY2Ugc3RvcmVkIHdpdGhpbiB0ZXh0dXJlIGF0bGFzIGRlc2NyaWJlZCBieSB0aGUgdmlld3BvcnRcbnZlYzIgZ2V0Q3ViZW1hcEF0bGFzQ29vcmRpbmF0ZXMoY29uc3QgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydCwgZmxvYXQgc2hhZG93RWRnZVBpeGVscywgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24sIGNvbnN0IHZlYzMgZGlyKSB7XG5cbiAgICBmbG9hdCBmYWNlSW5kZXg7XG4gICAgdmVjMiB0aWxlT2Zmc2V0O1xuICAgIHZlYzIgdXYgPSBnZXRDdWJlbWFwRmFjZUNvb3JkaW5hdGVzKGRpciwgZmFjZUluZGV4LCB0aWxlT2Zmc2V0KTtcblxuICAgIC8vIG1vdmUgdXYgY29vcmRpbmF0ZXMgaW53YXJkcyBpbnNpZGUgdG8gY29tcGVuc2F0ZSBmb3IgbGFyZ2VyIGZvdiB3aGVuIHJlbmRlcmluZyBzaGFkb3cgaW50byBhdGxhc1xuICAgIGZsb2F0IGF0bGFzRmFjZVNpemUgPSBvbW5pQXRsYXNWaWV3cG9ydC56O1xuICAgIGZsb2F0IHRpbGVTaXplID0gc2hhZG93VGV4dHVyZVJlc29sdXRpb24gKiBhdGxhc0ZhY2VTaXplO1xuICAgIGZsb2F0IG9mZnNldCA9IHNoYWRvd0VkZ2VQaXhlbHMgLyB0aWxlU2l6ZTtcbiAgICB1diA9IHV2ICogdmVjMigxLjAgLSBvZmZzZXQgKiAyLjApICsgdmVjMihvZmZzZXQgKiAxLjApO1xuXG4gICAgLy8gc2NhbGUgdXYgY29vcmRpbmF0ZXMgdG8gY3ViZSBmYWNlIGFyZWEgd2l0aGluIHRoZSB2aWV3cG9ydFxuICAgIHV2ICo9IGF0bGFzRmFjZVNpemU7XG5cbiAgICAvLyBvZmZzZXQgaW50byBmYWNlIG9mIHRoZSBhdGxhcyAoM3gzIGdyaWQpXG4gICAgdXYgKz0gdGlsZU9mZnNldCAqIGF0bGFzRmFjZVNpemU7XG5cbiAgICAvLyBvZmZzZXQgaW50byB0aGUgYXRsYXMgdmlld3BvcnRcbiAgICB1diArPSBvbW5pQXRsYXNWaWV3cG9ydC54eTtcblxuICAgIHJldHVybiB1djtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw0QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0EvREE7Ozs7In0=
