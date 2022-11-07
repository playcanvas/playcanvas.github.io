/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skinTexVS = `
attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;

uniform highp sampler2D texture_poseMap;
uniform vec4 texture_poseMapSize;

void getBoneMatrix(const in float i, out vec4 v1, out vec4 v2, out vec4 v3) {
    float j = i * 3.0;
    float dx = texture_poseMapSize.z;
    float dy = texture_poseMapSize.w;
    
    float y = floor(j * dx);
    float x = j - (y * texture_poseMapSize.x);
    y = dy * (y + 0.5);

    // read elements of 4x3 matrix
    v1 = texture2D(texture_poseMap, vec2(dx * (x + 0.5), y));
    v2 = texture2D(texture_poseMap, vec2(dx * (x + 1.5), y));
    v3 = texture2D(texture_poseMap, vec2(dx * (x + 2.5), y));
}

mat4 getSkinMatrix(const in vec4 indices, const in vec4 weights) {
    // get 4 bone matrices
    vec4 a1, a2, a3;
    getBoneMatrix(indices.x, a1, a2, a3);

    vec4 b1, b2, b3;
    getBoneMatrix(indices.y, b1, b2, b3);

    vec4 c1, c2, c3;
    getBoneMatrix(indices.z, c1, c2, c3);

    vec4 d1, d2, d3;
    getBoneMatrix(indices.w, d1, d2, d3);

    // multiply them by weights and add up to get final 4x3 matrix
    vec4 v1 = a1 * weights.x + b1 * weights.y + c1 * weights.z + d1 * weights.w;
    vec4 v2 = a2 * weights.x + b2 * weights.y + c2 * weights.z + d2 * weights.w;
    vec4 v3 = a3 * weights.x + b3 * weights.y + c3 * weights.z + d3 * weights.w;

    // add up weights
    float one = dot(weights, vec4(1.0));

    // transpose to 4x4 matrix
    return mat4(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, one
    );
}
`;

export { skinTexVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpblRleC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jb21tb24vdmVydC9za2luVGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhfYm9uZVdlaWdodHM7XG5hdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhfYm9uZUluZGljZXM7XG5cbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIHRleHR1cmVfcG9zZU1hcDtcbnVuaWZvcm0gdmVjNCB0ZXh0dXJlX3Bvc2VNYXBTaXplO1xuXG52b2lkIGdldEJvbmVNYXRyaXgoY29uc3QgaW4gZmxvYXQgaSwgb3V0IHZlYzQgdjEsIG91dCB2ZWM0IHYyLCBvdXQgdmVjNCB2Mykge1xuICAgIGZsb2F0IGogPSBpICogMy4wO1xuICAgIGZsb2F0IGR4ID0gdGV4dHVyZV9wb3NlTWFwU2l6ZS56O1xuICAgIGZsb2F0IGR5ID0gdGV4dHVyZV9wb3NlTWFwU2l6ZS53O1xuICAgIFxuICAgIGZsb2F0IHkgPSBmbG9vcihqICogZHgpO1xuICAgIGZsb2F0IHggPSBqIC0gKHkgKiB0ZXh0dXJlX3Bvc2VNYXBTaXplLngpO1xuICAgIHkgPSBkeSAqICh5ICsgMC41KTtcblxuICAgIC8vIHJlYWQgZWxlbWVudHMgb2YgNHgzIG1hdHJpeFxuICAgIHYxID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMC41KSwgeSkpO1xuICAgIHYyID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMS41KSwgeSkpO1xuICAgIHYzID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMi41KSwgeSkpO1xufVxuXG5tYXQ0IGdldFNraW5NYXRyaXgoY29uc3QgaW4gdmVjNCBpbmRpY2VzLCBjb25zdCBpbiB2ZWM0IHdlaWdodHMpIHtcbiAgICAvLyBnZXQgNCBib25lIG1hdHJpY2VzXG4gICAgdmVjNCBhMSwgYTIsIGEzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy54LCBhMSwgYTIsIGEzKTtcblxuICAgIHZlYzQgYjEsIGIyLCBiMztcbiAgICBnZXRCb25lTWF0cml4KGluZGljZXMueSwgYjEsIGIyLCBiMyk7XG5cbiAgICB2ZWM0IGMxLCBjMiwgYzM7XG4gICAgZ2V0Qm9uZU1hdHJpeChpbmRpY2VzLnosIGMxLCBjMiwgYzMpO1xuXG4gICAgdmVjNCBkMSwgZDIsIGQzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy53LCBkMSwgZDIsIGQzKTtcblxuICAgIC8vIG11bHRpcGx5IHRoZW0gYnkgd2VpZ2h0cyBhbmQgYWRkIHVwIHRvIGdldCBmaW5hbCA0eDMgbWF0cml4XG4gICAgdmVjNCB2MSA9IGExICogd2VpZ2h0cy54ICsgYjEgKiB3ZWlnaHRzLnkgKyBjMSAqIHdlaWdodHMueiArIGQxICogd2VpZ2h0cy53O1xuICAgIHZlYzQgdjIgPSBhMiAqIHdlaWdodHMueCArIGIyICogd2VpZ2h0cy55ICsgYzIgKiB3ZWlnaHRzLnogKyBkMiAqIHdlaWdodHMudztcbiAgICB2ZWM0IHYzID0gYTMgKiB3ZWlnaHRzLnggKyBiMyAqIHdlaWdodHMueSArIGMzICogd2VpZ2h0cy56ICsgZDMgKiB3ZWlnaHRzLnc7XG5cbiAgICAvLyBhZGQgdXAgd2VpZ2h0c1xuICAgIGZsb2F0IG9uZSA9IGRvdCh3ZWlnaHRzLCB2ZWM0KDEuMCkpO1xuXG4gICAgLy8gdHJhbnNwb3NlIHRvIDR4NCBtYXRyaXhcbiAgICByZXR1cm4gbWF0NChcbiAgICAgICAgdjEueCwgdjIueCwgdjMueCwgMCxcbiAgICAgICAgdjEueSwgdjIueSwgdjMueSwgMCxcbiAgICAgICAgdjEueiwgdjIueiwgdjMueiwgMCxcbiAgICAgICAgdjEudywgdjIudywgdjMudywgb25lXG4gICAgKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXBEQTs7OzsifQ==
