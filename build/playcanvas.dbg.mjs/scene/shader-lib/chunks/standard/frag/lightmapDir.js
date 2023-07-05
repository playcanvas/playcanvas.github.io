var lightmapDirPS = /* glsl */`
uniform sampler2D texture_lightMap;
uniform sampler2D texture_dirLightMap;

void getLightMap() {
    dLightmap = $DECODE(texture2DBias(texture_lightMap, $UV, textureBias)).$CH;

    vec3 dir = texture2DBias(texture_dirLightMap, $UV, textureBias).xyz * 2.0 - 1.0;
    float dirDot = dot(dir, dir);
    dLightmapDir = (dirDot > 0.001) ? dir / sqrt(dirDot) : vec3(0.0);
}
`;

export { lightmapDirPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBEaXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2xpZ2h0bWFwRGlyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2xpZ2h0TWFwO1xudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9kaXJMaWdodE1hcDtcblxudm9pZCBnZXRMaWdodE1hcCgpIHtcbiAgICBkTGlnaHRtYXAgPSAkREVDT0RFKHRleHR1cmUyREJpYXModGV4dHVyZV9saWdodE1hcCwgJFVWLCB0ZXh0dXJlQmlhcykpLiRDSDtcblxuICAgIHZlYzMgZGlyID0gdGV4dHVyZTJEQmlhcyh0ZXh0dXJlX2RpckxpZ2h0TWFwLCAkVVYsIHRleHR1cmVCaWFzKS54eXogKiAyLjAgLSAxLjA7XG4gICAgZmxvYXQgZGlyRG90ID0gZG90KGRpciwgZGlyKTtcbiAgICBkTGlnaHRtYXBEaXIgPSAoZGlyRG90ID4gMC4wMDEpID8gZGlyIC8gc3FydChkaXJEb3QpIDogdmVjMygwLjApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxvQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
