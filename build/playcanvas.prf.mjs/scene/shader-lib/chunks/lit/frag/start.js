/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
