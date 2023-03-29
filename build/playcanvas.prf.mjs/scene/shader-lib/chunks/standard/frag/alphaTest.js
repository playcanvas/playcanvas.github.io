/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var alphaTestPS = `
uniform float alpha_ref;

void alphaTest(float a) {
		if (a < alpha_ref) discard;
}
`;

export { alphaTestPS as default };
