/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var alphaTestPS = `
uniform float alpha_ref;

void alphaTest(float a) {
    if (a < alpha_ref) discard;
}
`;

export { alphaTestPS as default };
