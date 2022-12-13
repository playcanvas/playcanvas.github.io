/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skyboxHDRPS = `
varying vec3 vViewDir;

uniform samplerCube texture_cubeMap;

void main(void) {
    vec3 dir=vViewDir;
    dir.x *= -1.0;

    vec3 linear = $DECODE(textureCube(texture_cubeMap, fixSeamsStatic(dir, $FIXCONST)));

    gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;

export { skyboxHDRPS as default };
