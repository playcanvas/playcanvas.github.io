/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var ambientConstantPS = `
void addAmbient(vec3 worldNormal) {
		dDiffuseLight += light_globalAmbient;
}
`;

export { ambientConstantPS as default };
