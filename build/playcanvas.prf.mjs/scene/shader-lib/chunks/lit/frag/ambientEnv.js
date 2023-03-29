/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var ambientEnvPS = `
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif

void addAmbient(vec3 worldNormal) {
		vec3 dir = normalize(cubeMapRotate(worldNormal) * vec3(-1.0, 1.0, 1.0));
		vec2 uv = mapUv(toSphericalUv(dir), vec4(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize);

		vec4 raw = texture2D(texture_envAtlas, uv);
		vec3 linear = $DECODE(raw);
		dDiffuseLight += processEnvironment(linear);
}
`;

export { ambientEnvPS as default };
