/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_wrapVS = /* glsl */`
    vec3 origParticlePos = particlePos;
    particlePos -= matrix_model[3].xyz;
    particlePos = mod(particlePos, wrapBounds) - wrapBounds * 0.5;
    particlePos += matrix_model[3].xyz;
    particlePosMoved = particlePos - origParticlePos;
`;

export { particle_wrapVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfd3JhcC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfd3JhcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHZlYzMgb3JpZ1BhcnRpY2xlUG9zID0gcGFydGljbGVQb3M7XG4gICAgcGFydGljbGVQb3MgLT0gbWF0cml4X21vZGVsWzNdLnh5ejtcbiAgICBwYXJ0aWNsZVBvcyA9IG1vZChwYXJ0aWNsZVBvcywgd3JhcEJvdW5kcykgLSB3cmFwQm91bmRzICogMC41O1xuICAgIHBhcnRpY2xlUG9zICs9IG1hdHJpeF9tb2RlbFszXS54eXo7XG4gICAgcGFydGljbGVQb3NNb3ZlZCA9IHBhcnRpY2xlUG9zIC0gb3JpZ1BhcnRpY2xlUG9zO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
