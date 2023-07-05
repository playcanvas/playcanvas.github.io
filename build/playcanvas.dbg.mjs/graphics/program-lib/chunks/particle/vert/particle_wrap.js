/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_wrapVS = `
    vec3 origParticlePos = particlePos;
    particlePos -= matrix_model[3].xyz;
    particlePos = mod(particlePos, wrapBounds) - wrapBounds * 0.5;
    particlePos += matrix_model[3].xyz;
    particlePosMoved = particlePos - origParticlePos;
`;

export { particle_wrapVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfd3JhcC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS92ZXJ0L3BhcnRpY2xlX3dyYXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICB2ZWMzIG9yaWdQYXJ0aWNsZVBvcyA9IHBhcnRpY2xlUG9zO1xuICAgIHBhcnRpY2xlUG9zIC09IG1hdHJpeF9tb2RlbFszXS54eXo7XG4gICAgcGFydGljbGVQb3MgPSBtb2QocGFydGljbGVQb3MsIHdyYXBCb3VuZHMpIC0gd3JhcEJvdW5kcyAqIDAuNTtcbiAgICBwYXJ0aWNsZVBvcyArPSBtYXRyaXhfbW9kZWxbM10ueHl6O1xuICAgIHBhcnRpY2xlUG9zTW92ZWQgPSBwYXJ0aWNsZVBvcyAtIG9yaWdQYXJ0aWNsZVBvcztcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FOQTs7OzsifQ==
