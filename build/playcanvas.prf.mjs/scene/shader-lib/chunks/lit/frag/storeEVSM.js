/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var storeEVSMPS = `
float exponent = VSM_EXPONENT;

depth = 2.0 * depth - 1.0;
depth =  exp(exponent * depth);
gl_FragColor = vec4(depth, depth*depth, 1.0, 1.0);
`;

export { storeEVSMPS as default };
