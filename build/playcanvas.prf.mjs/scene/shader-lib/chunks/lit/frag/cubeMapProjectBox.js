/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var cubeMapProjectBoxPS = `
uniform vec3 envBoxMin;
uniform vec3 envBoxMax;

vec3 cubeMapProject(vec3 nrdir) {
		nrdir = cubeMapRotate(nrdir);

		vec3 rbmax = (envBoxMax - vPositionW) / nrdir;
		vec3 rbmin = (envBoxMin - vPositionW) / nrdir;

		vec3 rbminmax;
		rbminmax.x = nrdir.x>0.0? rbmax.x : rbmin.x;
		rbminmax.y = nrdir.y>0.0? rbmax.y : rbmin.y;
		rbminmax.z = nrdir.z>0.0? rbmax.z : rbmin.z;

		float fa = min(min(rbminmax.x, rbminmax.y), rbminmax.z);

		vec3 posonbox = vPositionW + nrdir * fa;
		vec3 envBoxPos = (envBoxMin + envBoxMax) * 0.5;
		return normalize(posonbox - envBoxPos);
}
`;

export { cubeMapProjectBoxPS as default };
