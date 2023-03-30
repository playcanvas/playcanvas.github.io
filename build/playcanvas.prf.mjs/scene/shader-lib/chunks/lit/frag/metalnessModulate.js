/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var metalnessModulatePS = `

uniform float material_f0;

void getMetalnessModulate(inout LitShaderArguments litShaderArgs) {
		vec3 dielectricF0 = material_f0 * litShaderArgs.specularity;
		litShaderArgs.specularity = mix(dielectricF0, litShaderArgs.albedo, litShaderArgs.metalness);
		litShaderArgs.albedo *= 1.0 - litShaderArgs.metalness;
}
`;

export { metalnessModulatePS as default };
