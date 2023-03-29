/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var TBNfastPS = /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
    dTBN = mat3(tangent, binormal, normal);
}
`;

export { TBNfastPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOZmFzdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL1RCTmZhc3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgZ2V0VEJOKHZlYzMgdGFuZ2VudCwgdmVjMyBiaW5vcm1hbCwgdmVjMyBub3JtYWwpIHtcbiAgICBkVEJOID0gbWF0Myh0YW5nZW50LCBiaW5vcm1hbCwgbm9ybWFsKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
