/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_localShiftVS = /* glsl */`
    particlePos = (matrix_model * vec4(particlePos, 1.0)).xyz;
`;

export { particle_localShiftVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbG9jYWxTaGlmdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfbG9jYWxTaGlmdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHBhcnRpY2xlUG9zID0gKG1hdHJpeF9tb2RlbCAqIHZlYzQocGFydGljbGVQb3MsIDEuMCkpLnh5ejtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw0QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQSxDQUFDOzs7OyJ9
