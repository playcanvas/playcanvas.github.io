/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkNDLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25DQy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbnZvaWQgYWRkUmVmbGVjdGlvbkNDKCkge1xuICAgIGNjUmVmbGVjdGlvbiArPSBjYWxjUmVmbGVjdGlvbihjY1JlZmxEaXJXLCBjY0dsb3NzaW5lc3MpO1xufVxuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEscUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBTkE7Ozs7In0=
