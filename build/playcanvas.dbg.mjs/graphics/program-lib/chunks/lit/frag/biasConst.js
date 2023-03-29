/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var biasConstPS = `
#define SHADOWBIAS

float getShadowBias(float resolution, float maxBias) {
    return maxBias;
}
`;

export { biasConstPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmlhc0NvbnN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2JpYXNDb25zdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2RlZmluZSBTSEFET1dCSUFTXG5cbmZsb2F0IGdldFNoYWRvd0JpYXMoZmxvYXQgcmVzb2x1dGlvbiwgZmxvYXQgbWF4Qmlhcykge1xuICAgIHJldHVybiBtYXhCaWFzO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQU5BOzs7OyJ9
