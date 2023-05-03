var cubeMapProjectBoxPS = /* glsl */`
uniform vec3 envBoxMin;
uniform vec3 envBoxMax;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3ViZU1hcFByb2plY3RCb3guanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9jdWJlTWFwUHJvamVjdEJveC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSB2ZWMzIGVudkJveE1pbjtcbnVuaWZvcm0gdmVjMyBlbnZCb3hNYXg7XG5cbnZlYzMgY3ViZU1hcFByb2plY3QodmVjMyBucmRpcikge1xuICAgIG5yZGlyID0gY3ViZU1hcFJvdGF0ZShucmRpcik7XG5cbiAgICB2ZWMzIHJibWF4ID0gKGVudkJveE1heCAtIHZQb3NpdGlvblcpIC8gbnJkaXI7XG4gICAgdmVjMyByYm1pbiA9IChlbnZCb3hNaW4gLSB2UG9zaXRpb25XKSAvIG5yZGlyO1xuXG4gICAgdmVjMyByYm1pbm1heDtcbiAgICByYm1pbm1heC54ID0gbnJkaXIueD4wLjA/IHJibWF4LnggOiByYm1pbi54O1xuICAgIHJibWlubWF4LnkgPSBucmRpci55PjAuMD8gcmJtYXgueSA6IHJibWluLnk7XG4gICAgcmJtaW5tYXgueiA9IG5yZGlyLno+MC4wPyByYm1heC56IDogcmJtaW4uejtcblxuICAgIGZsb2F0IGZhID0gbWluKG1pbihyYm1pbm1heC54LCByYm1pbm1heC55KSwgcmJtaW5tYXgueik7XG5cbiAgICB2ZWMzIHBvc29uYm94ID0gdlBvc2l0aW9uVyArIG5yZGlyICogZmE7XG4gICAgdmVjMyBlbnZCb3hQb3MgPSAoZW52Qm94TWluICsgZW52Qm94TWF4KSAqIDAuNTtcbiAgICByZXR1cm4gbm9ybWFsaXplKHBvc29uYm94IC0gZW52Qm94UG9zKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
