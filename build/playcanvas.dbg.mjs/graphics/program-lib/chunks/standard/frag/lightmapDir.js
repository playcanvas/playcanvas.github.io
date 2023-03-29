/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightmapDirPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBEaXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9saWdodG1hcERpci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9saWdodE1hcDtcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZGlyTGlnaHRNYXA7XG5cbnZvaWQgZ2V0TGlnaHRNYXAoKSB7XG4gICAgZExpZ2h0bWFwID0gJERFQ09ERSh0ZXh0dXJlMkRCaWFzKHRleHR1cmVfbGlnaHRNYXAsICRVViwgdGV4dHVyZUJpYXMpKS4kQ0g7XG5cbiAgICB2ZWMzIGRpciA9IHRleHR1cmUyREJpYXModGV4dHVyZV9kaXJMaWdodE1hcCwgJFVWLCB0ZXh0dXJlQmlhcykueHl6ICogMi4wIC0gMS4wO1xuICAgIGZsb2F0IGRpckRvdCA9IGRvdChkaXIsIGRpcik7XG4gICAgZExpZ2h0bWFwRGlyID0gKGRpckRvdCA+IDAuMDAxKSA/IGRpciAvIHNxcnQoZGlyRG90KSA6IHZlYzMoMC4wKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxvQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBWEE7Ozs7In0=
