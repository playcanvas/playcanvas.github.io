/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var cubeMapProjectBoxPS = `
uniform vec3 envBoxMin, envBoxMax;

vec3 cubeMapProject(vec3 nrdir) {
    nrdir = cubeMapRotate(nrdir);

    vec3 rbmax = (envBoxMax - vPositionW) / nrdir;
    vec3 rbmin = (envBoxMin - vPositionW) / nrdir;

    vec3 rbminmax;
    rbminmax.x = nrdir.x>0.0? rbmax.x : rbmin.x;
    rbminmax.y = nrdir.y>0.0? rbmax.y : rbmin.y;
    rbminmax.z = nrdir.z>0.0? rbmax.z : rbmin.z;

    float fa = min(min(rbminmax.x, rbminmax.y), rbminmax.z);

    vec3 posonbox = vPositionW + nrdir * fa;
    vec3 envBoxPos = (envBoxMin + envBoxMax) * 0.5;
    return normalize(posonbox - envBoxPos);
}
`;

export { cubeMapProjectBoxPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3ViZU1hcFByb2plY3RCb3guanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvY3ViZU1hcFByb2plY3RCb3guanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gdmVjMyBlbnZCb3hNaW4sIGVudkJveE1heDtcblxudmVjMyBjdWJlTWFwUHJvamVjdCh2ZWMzIG5yZGlyKSB7XG4gICAgbnJkaXIgPSBjdWJlTWFwUm90YXRlKG5yZGlyKTtcblxuICAgIHZlYzMgcmJtYXggPSAoZW52Qm94TWF4IC0gdlBvc2l0aW9uVykgLyBucmRpcjtcbiAgICB2ZWMzIHJibWluID0gKGVudkJveE1pbiAtIHZQb3NpdGlvblcpIC8gbnJkaXI7XG5cbiAgICB2ZWMzIHJibWlubWF4O1xuICAgIHJibWlubWF4LnggPSBucmRpci54PjAuMD8gcmJtYXgueCA6IHJibWluLng7XG4gICAgcmJtaW5tYXgueSA9IG5yZGlyLnk+MC4wPyByYm1heC55IDogcmJtaW4ueTtcbiAgICByYm1pbm1heC56ID0gbnJkaXIuej4wLjA/IHJibWF4LnogOiByYm1pbi56O1xuXG4gICAgZmxvYXQgZmEgPSBtaW4obWluKHJibWlubWF4LngsIHJibWlubWF4LnkpLCByYm1pbm1heC56KTtcblxuICAgIHZlYzMgcG9zb25ib3ggPSB2UG9zaXRpb25XICsgbnJkaXIgKiBmYTtcbiAgICB2ZWMzIGVudkJveFBvcyA9IChlbnZCb3hNaW4gKyBlbnZCb3hNYXgpICogMC41O1xuICAgIHJldHVybiBub3JtYWxpemUocG9zb25ib3ggLSBlbnZCb3hQb3MpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDBCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FwQkE7Ozs7In0=
