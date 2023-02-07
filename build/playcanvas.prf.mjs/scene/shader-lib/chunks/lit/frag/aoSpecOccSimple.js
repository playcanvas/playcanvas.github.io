/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccSimplePS = `
uniform float material_occludeSpecularIntensity;

void occludeSpecular() {
		float specOcc = mix(1.0, dAo, material_occludeSpecularIntensity);
		dSpecularLight *= specOcc;
		dReflection *= specOcc;
}
`;

export { aoSpecOccSimplePS as default };
