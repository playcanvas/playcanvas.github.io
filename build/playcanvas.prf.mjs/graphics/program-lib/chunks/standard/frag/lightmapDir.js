/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
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
