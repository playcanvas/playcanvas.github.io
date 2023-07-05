var sphericalPS = /* glsl */`
// equirectangular helper functions
const float PI = 3.141592653589793;

vec2 toSpherical(vec3 dir) {
    return vec2(dir.xz == vec2(0.0) ? 0.0 : atan(dir.x, dir.z), asin(dir.y));
}

vec2 toSphericalUv(vec3 dir) {
    vec2 uv = toSpherical(dir) / vec2(PI * 2.0, PI) + 0.5;
    return vec2(uv.x, 1.0 - uv.y);
}
`;

export { sphericalPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BoZXJpY2FsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvc3BoZXJpY2FsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBlcXVpcmVjdGFuZ3VsYXIgaGVscGVyIGZ1bmN0aW9uc1xuY29uc3QgZmxvYXQgUEkgPSAzLjE0MTU5MjY1MzU4OTc5MztcblxudmVjMiB0b1NwaGVyaWNhbCh2ZWMzIGRpcikge1xuICAgIHJldHVybiB2ZWMyKGRpci54eiA9PSB2ZWMyKDAuMCkgPyAwLjAgOiBhdGFuKGRpci54LCBkaXIueiksIGFzaW4oZGlyLnkpKTtcbn1cblxudmVjMiB0b1NwaGVyaWNhbFV2KHZlYzMgZGlyKSB7XG4gICAgdmVjMiB1diA9IHRvU3BoZXJpY2FsKGRpcikgLyB2ZWMyKFBJICogMi4wLCBQSSkgKyAwLjU7XG4gICAgcmV0dXJuIHZlYzIodXYueCwgMS4wIC0gdXYueSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
