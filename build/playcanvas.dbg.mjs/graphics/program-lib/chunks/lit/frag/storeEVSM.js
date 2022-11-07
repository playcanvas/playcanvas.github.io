/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var storeEVSMPS = `
float exponent = VSM_EXPONENT;

depth = 2.0 * depth - 1.0;
depth =  exp(exponent * depth);
gl_FragColor = vec4(depth, depth*depth, 1.0, 1.0);
`;

export { storeEVSMPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmVFVlNNLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL3N0b3JlRVZTTS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgZXhwb25lbnQgPSBWU01fRVhQT05FTlQ7XG5cbmRlcHRoID0gMi4wICogZGVwdGggLSAxLjA7XG5kZXB0aCA9ICBleHAoZXhwb25lbnQgKiBkZXB0aCk7XG5nbF9GcmFnQ29sb3IgPSB2ZWM0KGRlcHRoLCBkZXB0aCpkZXB0aCwgMS4wLCAxLjApO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQU5BOzs7OyJ9
