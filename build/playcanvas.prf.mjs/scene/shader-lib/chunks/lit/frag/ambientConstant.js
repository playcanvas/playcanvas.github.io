/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var ambientConstantPS = `
void addAmbient(vec3 worldNormal) {
		dDiffuseLight += light_globalAmbient;
}
`;

export { ambientConstantPS as default };
