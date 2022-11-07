/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCCPS = `
#ifdef LIT_CLEARCOAT
void addReflectionCC() {
    ccReflection += calcReflection(ccReflDirW, ccGlossiness);
}
#endif
`;

export { reflectionCCPS as default };
