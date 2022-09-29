/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_TBNVS = `
    mat3 rot3 = mat3(rotMatrix[0][0], rotMatrix[0][1], 0.0, rotMatrix[1][0], rotMatrix[1][1], 0.0, 0.0, 0.0, 1.0);
    ParticleMat = mat3(-matrix_viewInverse[0].xyz, -matrix_viewInverse[1].xyz, matrix_viewInverse[2].xyz) * rot3;
`;

export { particle_TBNVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfVEJOLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfVEJOLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgbWF0MyByb3QzID0gbWF0Myhyb3RNYXRyaXhbMF1bMF0sIHJvdE1hdHJpeFswXVsxXSwgMC4wLCByb3RNYXRyaXhbMV1bMF0sIHJvdE1hdHJpeFsxXVsxXSwgMC4wLCAwLjAsIDAuMCwgMS4wKTtcbiAgICBQYXJ0aWNsZU1hdCA9IG1hdDMoLW1hdHJpeF92aWV3SW52ZXJzZVswXS54eXosIC1tYXRyaXhfdmlld0ludmVyc2VbMV0ueHl6LCBtYXRyaXhfdmlld0ludmVyc2VbMl0ueHl6KSAqIHJvdDM7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEscUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBSEE7Ozs7In0=
