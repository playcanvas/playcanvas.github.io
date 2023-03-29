/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCCPS = `
#ifdef LIT_CLEARCOAT
void addReflectionCC(vec3 reflDir, float gloss) {
		ccReflection += calcReflection(reflDir, gloss);
}
#endif
`;

export { reflectionCCPS as default };
