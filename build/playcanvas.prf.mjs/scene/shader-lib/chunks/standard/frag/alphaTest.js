/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var alphaTestPS = `
uniform float alpha_ref;

void alphaTest(float a) {
    if (a < alpha_ref) discard;
}
`;

export { alphaTestPS as default };
