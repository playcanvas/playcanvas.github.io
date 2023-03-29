/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var TBNPS = `
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
		dTBN = mat3(normalize(tangent), normalize(binormal), normalize(normal));
}
`;

export { TBNPS as default };
