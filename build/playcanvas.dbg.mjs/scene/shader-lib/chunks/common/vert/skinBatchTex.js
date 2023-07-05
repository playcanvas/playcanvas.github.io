var skinBatchTexVS = /* glsl */`
attribute float vertex_boneIndices;

uniform highp sampler2D texture_poseMap;
uniform vec4 texture_poseMapSize;

mat4 getBoneMatrix(const in float i) {
    float j = i * 3.0;
    float dx = texture_poseMapSize.z;
    float dy = texture_poseMapSize.w;

    float y = floor(j * dx);
    float x = j - (y * texture_poseMapSize.x);
    y = dy * (y + 0.5);

    // read elements of 4x3 matrix
    vec4 v1 = texture2D(texture_poseMap, vec2(dx * (x + 0.5), y));
    vec4 v2 = texture2D(texture_poseMap, vec2(dx * (x + 1.5), y));
    vec4 v3 = texture2D(texture_poseMap, vec2(dx * (x + 2.5), y));

    // transpose to 4x4 matrix
    return mat4(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, 1
    );
}
`;

export { skinBatchTexVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbkJhdGNoVGV4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL3ZlcnQvc2tpbkJhdGNoVGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgZmxvYXQgdmVydGV4X2JvbmVJbmRpY2VzO1xuXG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCB0ZXh0dXJlX3Bvc2VNYXA7XG51bmlmb3JtIHZlYzQgdGV4dHVyZV9wb3NlTWFwU2l6ZTtcblxubWF0NCBnZXRCb25lTWF0cml4KGNvbnN0IGluIGZsb2F0IGkpIHtcbiAgICBmbG9hdCBqID0gaSAqIDMuMDtcbiAgICBmbG9hdCBkeCA9IHRleHR1cmVfcG9zZU1hcFNpemUuejtcbiAgICBmbG9hdCBkeSA9IHRleHR1cmVfcG9zZU1hcFNpemUudztcblxuICAgIGZsb2F0IHkgPSBmbG9vcihqICogZHgpO1xuICAgIGZsb2F0IHggPSBqIC0gKHkgKiB0ZXh0dXJlX3Bvc2VNYXBTaXplLngpO1xuICAgIHkgPSBkeSAqICh5ICsgMC41KTtcblxuICAgIC8vIHJlYWQgZWxlbWVudHMgb2YgNHgzIG1hdHJpeFxuICAgIHZlYzQgdjEgPSB0ZXh0dXJlMkQodGV4dHVyZV9wb3NlTWFwLCB2ZWMyKGR4ICogKHggKyAwLjUpLCB5KSk7XG4gICAgdmVjNCB2MiA9IHRleHR1cmUyRCh0ZXh0dXJlX3Bvc2VNYXAsIHZlYzIoZHggKiAoeCArIDEuNSksIHkpKTtcbiAgICB2ZWM0IHYzID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMi41KSwgeSkpO1xuXG4gICAgLy8gdHJhbnNwb3NlIHRvIDR4NCBtYXRyaXhcbiAgICByZXR1cm4gbWF0NChcbiAgICAgICAgdjEueCwgdjIueCwgdjMueCwgMCxcbiAgICAgICAgdjEueSwgdjIueSwgdjMueSwgMCxcbiAgICAgICAgdjEueiwgdjIueiwgdjMueiwgMCxcbiAgICAgICAgdjEudywgdjIudywgdjMudywgMVxuICAgICk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHFCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
