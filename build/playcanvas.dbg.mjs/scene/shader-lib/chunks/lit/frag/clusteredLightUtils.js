var clusteredLightUtilsPS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3RlcmVkTGlnaHRVdGlscy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2NsdXN0ZXJlZExpZ2h0VXRpbHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2Bcbi8vIENvbnZlcnRzIHVubm9ybWFsaXplZCBkaXJlY3Rpb24gdmVjdG9yIHRvIGEgY3ViZW1hcCBmYWNlIGluZGV4IFswLi41XSBhbmQgdXYgY29vcmRpbmF0ZXMgd2l0aGluIHRoZSBmYWNlIGluIFswLi4xXSByYW5nZS5cbi8vIEFkZGl0aW9uYWxseSBvZmZzZXQgdG8gYSB0aWxlIGluIGF0bGFzIHdpdGhpbiAzeDMgc3ViZGl2aXNpb24gaXMgcHJvdmlkZWRcbnZlYzIgZ2V0Q3ViZW1hcEZhY2VDb29yZGluYXRlcyhjb25zdCB2ZWMzIGRpciwgb3V0IGZsb2F0IGZhY2VJbmRleCwgb3V0IHZlYzIgdGlsZU9mZnNldClcbntcbiAgICB2ZWMzIHZBYnMgPSBhYnMoZGlyKTtcbiAgICBmbG9hdCBtYTtcbiAgICB2ZWMyIHV2O1xuICAgIGlmICh2QWJzLnogPj0gdkFicy54ICYmIHZBYnMueiA+PSB2QWJzLnkpIHsgICAvLyBmcm9udCAvIGJhY2tcblxuICAgICAgICBmYWNlSW5kZXggPSBkaXIueiA8IDAuMCA/IDUuMCA6IDQuMDtcbiAgICAgICAgbWEgPSAwLjUgLyB2QWJzLno7XG4gICAgICAgIHV2ID0gdmVjMihkaXIueiA8IDAuMCA/IC1kaXIueCA6IGRpci54LCAtZGlyLnkpO1xuXG4gICAgICAgIHRpbGVPZmZzZXQueCA9IDIuMDtcbiAgICAgICAgdGlsZU9mZnNldC55ID0gZGlyLnogPCAwLjAgPyAxLjAgOiAwLjA7XG5cbiAgICB9IGVsc2UgaWYodkFicy55ID49IHZBYnMueCkgeyAgLy8gdG9wIGluZGV4IDIsIGJvdHRvbSBpbmRleCAzXG5cbiAgICAgICAgZmFjZUluZGV4ID0gZGlyLnkgPCAwLjAgPyAzLjAgOiAyLjA7XG4gICAgICAgIG1hID0gMC41IC8gdkFicy55O1xuICAgICAgICB1diA9IHZlYzIoZGlyLngsIGRpci55IDwgMC4wID8gLWRpci56IDogZGlyLnopO1xuXG4gICAgICAgIHRpbGVPZmZzZXQueCA9IDEuMDtcbiAgICAgICAgdGlsZU9mZnNldC55ID0gZGlyLnkgPCAwLjAgPyAxLjAgOiAwLjA7XG5cbiAgICB9IGVsc2UgeyAgICAvLyBsZWZ0IC8gcmlnaHRcblxuICAgICAgICBmYWNlSW5kZXggPSBkaXIueCA8IDAuMCA/IDEuMCA6IDAuMDtcbiAgICAgICAgbWEgPSAwLjUgLyB2QWJzLng7XG4gICAgICAgIHV2ID0gdmVjMihkaXIueCA8IDAuMCA/IGRpci56IDogLWRpci56LCAtZGlyLnkpO1xuXG4gICAgICAgIHRpbGVPZmZzZXQueCA9IDAuMDtcbiAgICAgICAgdGlsZU9mZnNldC55ID0gZGlyLnggPCAwLjAgPyAxLjAgOiAwLjA7XG5cbiAgICB9XG4gICAgcmV0dXJuIHV2ICogbWEgKyAwLjU7XG59XG5cbi8vIGNvbnZlcnRzIHVubm9ybWFsaXplZCBkaXJlY3Rpb24gdmVjdG9yIHRvIGEgdGV4dHVyZSBjb29yZGluYXRlIGZvciBhIGN1YmVtYXAgZmFjZSBzdG9yZWQgd2l0aGluIHRleHR1cmUgYXRsYXMgZGVzY3JpYmVkIGJ5IHRoZSB2aWV3cG9ydFxudmVjMiBnZXRDdWJlbWFwQXRsYXNDb29yZGluYXRlcyhjb25zdCB2ZWMzIG9tbmlBdGxhc1ZpZXdwb3J0LCBmbG9hdCBzaGFkb3dFZGdlUGl4ZWxzLCBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgY29uc3QgdmVjMyBkaXIpIHtcblxuICAgIGZsb2F0IGZhY2VJbmRleDtcbiAgICB2ZWMyIHRpbGVPZmZzZXQ7XG4gICAgdmVjMiB1diA9IGdldEN1YmVtYXBGYWNlQ29vcmRpbmF0ZXMoZGlyLCBmYWNlSW5kZXgsIHRpbGVPZmZzZXQpO1xuXG4gICAgLy8gbW92ZSB1diBjb29yZGluYXRlcyBpbndhcmRzIGluc2lkZSB0byBjb21wZW5zYXRlIGZvciBsYXJnZXIgZm92IHdoZW4gcmVuZGVyaW5nIHNoYWRvdyBpbnRvIGF0bGFzXG4gICAgZmxvYXQgYXRsYXNGYWNlU2l6ZSA9IG9tbmlBdGxhc1ZpZXdwb3J0Lno7XG4gICAgZmxvYXQgdGlsZVNpemUgPSBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiAqIGF0bGFzRmFjZVNpemU7XG4gICAgZmxvYXQgb2Zmc2V0ID0gc2hhZG93RWRnZVBpeGVscyAvIHRpbGVTaXplO1xuICAgIHV2ID0gdXYgKiB2ZWMyKDEuMCAtIG9mZnNldCAqIDIuMCkgKyB2ZWMyKG9mZnNldCAqIDEuMCk7XG5cbiAgICAvLyBzY2FsZSB1diBjb29yZGluYXRlcyB0byBjdWJlIGZhY2UgYXJlYSB3aXRoaW4gdGhlIHZpZXdwb3J0XG4gICAgdXYgKj0gYXRsYXNGYWNlU2l6ZTtcblxuICAgIC8vIG9mZnNldCBpbnRvIGZhY2Ugb2YgdGhlIGF0bGFzICgzeDMgZ3JpZClcbiAgICB1diArPSB0aWxlT2Zmc2V0ICogYXRsYXNGYWNlU2l6ZTtcblxuICAgIC8vIG9mZnNldCBpbnRvIHRoZSBhdGxhcyB2aWV3cG9ydFxuICAgIHV2ICs9IG9tbmlBdGxhc1ZpZXdwb3J0Lnh5O1xuXG4gICAgcmV0dXJuIHV2O1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSw0QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
