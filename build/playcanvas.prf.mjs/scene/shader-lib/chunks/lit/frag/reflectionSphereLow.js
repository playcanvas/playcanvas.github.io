/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionSphereLowPS = `
uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
		vec3 reflDirV = vNormalV;

		vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
		return $DECODE(texture2D(texture_sphereMap, sphereMapUv));
}

void addReflection(vec3 reflDir, float gloss) {   
		dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;

export { reflectionSphereLowPS as default };
