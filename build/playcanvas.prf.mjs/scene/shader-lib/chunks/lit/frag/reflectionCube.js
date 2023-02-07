/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCubePS = `
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
		vec3 lookupVec = fixSeams(cubeMapProject(tReflDirW));
		lookupVec.x *= -1.0;
		return $DECODE(textureCube(texture_cubeMap, lookupVec));
}

void addReflection() {   
		dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionCubePS as default };
