/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_customFaceVS = `
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = customFace(particlePos, quadXY);
`;

export { particle_customFaceVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfY3VzdG9tRmFjZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfY3VzdG9tRmFjZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHF1YWRYWSA9IHJvdGF0ZShxdWFkWFksIGluQW5nbGUsIHJvdE1hdHJpeCk7XG4gICAgdmVjMyBsb2NhbFBvcyA9IGN1c3RvbUZhY2UocGFydGljbGVQb3MsIHF1YWRYWSk7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBQUM7Ozs7In0=
