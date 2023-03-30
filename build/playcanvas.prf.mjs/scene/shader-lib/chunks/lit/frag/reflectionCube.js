/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCubePS = `
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
		vec3 lookupVec = fixSeams(cubeMapProject(reflDir));
		lookupVec.x *= -1.0;
		return $DECODE(textureCube(texture_cubeMap, lookupVec));
}

void addReflection(vec3 reflDir, float gloss) {   
		dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;

export { reflectionCubePS as default };
