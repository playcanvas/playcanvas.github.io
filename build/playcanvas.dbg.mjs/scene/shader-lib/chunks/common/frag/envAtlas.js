var envAtlasPS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52QXRsYXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9lbnZBdGxhcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gdGhlIGVudkF0bGFzIGlzIGZpeGVkIGF0IDUxMiBwaXhlbHMuIGV2ZXJ5IGVxdWlyZWN0IGlzIGdlbmVyYXRlZCB3aXRoIDEgcGl4ZWwgYm91bmRhcnkuXG5jb25zdCBmbG9hdCBhdGxhc1NpemUgPSA1MTIuMDtcbmNvbnN0IGZsb2F0IHNlYW1TaXplID0gMS4wIC8gYXRsYXNTaXplO1xuXG4vLyBtYXAgYSBub3JtYWxpemVkIGVxdWlyZWN0IFVWIHRvIHRoZSBnaXZlbiByZWN0YW5nbGUgKHRha2luZyAxIHBpeGVsIHNlYW0gaW50byBhY2NvdW50KS5cbnZlYzIgbWFwVXYodmVjMiB1diwgdmVjNCByZWN0KSB7XG4gICAgcmV0dXJuIHZlYzIobWl4KHJlY3QueCArIHNlYW1TaXplLCByZWN0LnggKyByZWN0LnogLSBzZWFtU2l6ZSwgdXYueCksXG4gICAgICAgICAgICAgICAgbWl4KHJlY3QueSArIHNlYW1TaXplLCByZWN0LnkgKyByZWN0LncgLSBzZWFtU2l6ZSwgdXYueSkpO1xufVxuXG4vLyBtYXAgYSBub3JtYWxpemVkIGVxdWlyZWN0IFVWIGFuZCByb3VnaG5lc3MgbGV2ZWwgdG8gdGhlIGNvcnJlY3QgYXRsYXMgcmVjdC5cbnZlYzIgbWFwUm91Z2huZXNzVXYodmVjMiB1diwgZmxvYXQgbGV2ZWwpIHtcbiAgICBmbG9hdCB0ID0gMS4wIC8gZXhwMihsZXZlbCk7XG4gICAgcmV0dXJuIG1hcFV2KHV2LCB2ZWM0KDAsIDEuMCAtIHQsIHQsIHQgKiAwLjUpKTtcbn1cblxuLy8gbWFwIHNoaW55IGxldmVsIFVWXG52ZWMyIG1hcFNoaW55VXYodmVjMiB1diwgZmxvYXQgbGV2ZWwpIHtcbiAgICBmbG9hdCB0ID0gMS4wIC8gZXhwMihsZXZlbCk7XG4gICAgcmV0dXJuIG1hcFV2KHV2LCB2ZWM0KDEuMCAtIHQsIDEuMCAtIHQsIHQsIHQgKiAwLjUpKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsaUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
