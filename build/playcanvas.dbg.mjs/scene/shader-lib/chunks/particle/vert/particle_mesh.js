/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_meshVS = `
    vec3 localPos = meshLocalPos;
    localPos.xy = rotate(localPos.xy, inAngle, rotMatrix);
    localPos.yz = rotate(localPos.yz, inAngle, rotMatrix);

    billboard(particlePos, quadXY);
`;

export { particle_meshVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbWVzaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfbWVzaC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHZlYzMgbG9jYWxQb3MgPSBtZXNoTG9jYWxQb3M7XG4gICAgbG9jYWxQb3MueHkgPSByb3RhdGUobG9jYWxQb3MueHksIGluQW5nbGUsIHJvdE1hdHJpeCk7XG4gICAgbG9jYWxQb3MueXogPSByb3RhdGUobG9jYWxQb3MueXosIGluQW5nbGUsIHJvdE1hdHJpeCk7XG5cbiAgICBiaWxsYm9hcmQocGFydGljbGVQb3MsIHF1YWRYWSk7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsc0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
