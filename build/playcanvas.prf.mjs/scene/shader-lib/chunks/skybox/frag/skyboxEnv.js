/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var skyboxEnvPS = `
varying vec3 vViewDir;

uniform sampler2D texture_envAtlas;
uniform float mipLevel;

void main(void) {
		vec3 dir = vViewDir * vec3(-1.0, 1.0, 1.0);
		vec2 uv = toSphericalUv(normalize(dir));

		vec3 linear = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, mipLevel)));

		gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;

export { skyboxEnvPS as default };
