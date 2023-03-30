/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var startPS = `
void main(void) {
		dReflection = vec4(0);

		#ifdef LIT_CLEARCOAT
		ccSpecularLight = vec3(0);
		ccReflection = vec3(0);
		#endif
`;

export { startPS as default };
