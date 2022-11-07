/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3ViZU1hcFByb2plY3RCb3guanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9jdWJlTWFwUHJvamVjdEJveC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSB2ZWMzIGVudkJveE1pbiwgZW52Qm94TWF4O1xuXG52ZWMzIGN1YmVNYXBQcm9qZWN0KHZlYzMgbnJkaXIpIHtcbiAgICBucmRpciA9IGN1YmVNYXBSb3RhdGUobnJkaXIpO1xuXG4gICAgdmVjMyByYm1heCA9IChlbnZCb3hNYXggLSB2UG9zaXRpb25XKSAvIG5yZGlyO1xuICAgIHZlYzMgcmJtaW4gPSAoZW52Qm94TWluIC0gdlBvc2l0aW9uVykgLyBucmRpcjtcblxuICAgIHZlYzMgcmJtaW5tYXg7XG4gICAgcmJtaW5tYXgueCA9IG5yZGlyLng+MC4wPyByYm1heC54IDogcmJtaW4ueDtcbiAgICByYm1pbm1heC55ID0gbnJkaXIueT4wLjA/IHJibWF4LnkgOiByYm1pbi55O1xuICAgIHJibWlubWF4LnogPSBucmRpci56PjAuMD8gcmJtYXgueiA6IHJibWluLno7XG5cbiAgICBmbG9hdCBmYSA9IG1pbihtaW4ocmJtaW5tYXgueCwgcmJtaW5tYXgueSksIHJibWlubWF4LnopO1xuXG4gICAgdmVjMyBwb3NvbmJveCA9IHZQb3NpdGlvblcgKyBucmRpciAqIGZhO1xuICAgIHZlYzMgZW52Qm94UG9zID0gKGVudkJveE1pbiArIGVudkJveE1heCkgKiAwLjU7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZShwb3NvbmJveCAtIGVudkJveFBvcyk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
