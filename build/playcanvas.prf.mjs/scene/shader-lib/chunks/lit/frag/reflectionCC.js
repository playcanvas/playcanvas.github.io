/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCCPS = `
#ifdef LIT_CLEARCOAT
void addReflectionCC() {
		ccReflection += calcReflection(ccReflDirW, ccGlossiness);
}
#endif
`;

export { reflectionCCPS as default };
