/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skinConstVS = `
attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;

uniform vec4 matrix_pose[BONE_LIMIT * 3];

void getBoneMatrix(const in float i, out vec4 v1, out vec4 v2, out vec4 v3) {
    // read 4x3 matrix
    v1 = matrix_pose[int(3.0 * i)];
    v2 = matrix_pose[int(3.0 * i + 1.0)];
    v3 = matrix_pose[int(3.0 * i + 2.0)];
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

export { skinConstVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbkNvbnN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi92ZXJ0L3NraW5Db25zdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuYXR0cmlidXRlIHZlYzQgdmVydGV4X2JvbmVXZWlnaHRzO1xuYXR0cmlidXRlIHZlYzQgdmVydGV4X2JvbmVJbmRpY2VzO1xuXG51bmlmb3JtIHZlYzQgbWF0cml4X3Bvc2VbQk9ORV9MSU1JVCAqIDNdO1xuXG52b2lkIGdldEJvbmVNYXRyaXgoY29uc3QgaW4gZmxvYXQgaSwgb3V0IHZlYzQgdjEsIG91dCB2ZWM0IHYyLCBvdXQgdmVjNCB2Mykge1xuICAgIC8vIHJlYWQgNHgzIG1hdHJpeFxuICAgIHYxID0gbWF0cml4X3Bvc2VbaW50KDMuMCAqIGkpXTtcbiAgICB2MiA9IG1hdHJpeF9wb3NlW2ludCgzLjAgKiBpICsgMS4wKV07XG4gICAgdjMgPSBtYXRyaXhfcG9zZVtpbnQoMy4wICogaSArIDIuMCldO1xufVxuXG5tYXQ0IGdldFNraW5NYXRyaXgoY29uc3QgaW4gdmVjNCBpbmRpY2VzLCBjb25zdCBpbiB2ZWM0IHdlaWdodHMpIHtcbiAgICAvLyBnZXQgNCBib25lIG1hdHJpY2VzXG4gICAgdmVjNCBhMSwgYTIsIGEzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy54LCBhMSwgYTIsIGEzKTtcblxuICAgIHZlYzQgYjEsIGIyLCBiMztcbiAgICBnZXRCb25lTWF0cml4KGluZGljZXMueSwgYjEsIGIyLCBiMyk7XG5cbiAgICB2ZWM0IGMxLCBjMiwgYzM7XG4gICAgZ2V0Qm9uZU1hdHJpeChpbmRpY2VzLnosIGMxLCBjMiwgYzMpO1xuXG4gICAgdmVjNCBkMSwgZDIsIGQzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy53LCBkMSwgZDIsIGQzKTtcblxuICAgIC8vIG11bHRpcGx5IHRoZW0gYnkgd2VpZ2h0cyBhbmQgYWRkIHVwIHRvIGdldCBmaW5hbCA0eDMgbWF0cml4XG4gICAgdmVjNCB2MSA9IGExICogd2VpZ2h0cy54ICsgYjEgKiB3ZWlnaHRzLnkgKyBjMSAqIHdlaWdodHMueiArIGQxICogd2VpZ2h0cy53O1xuICAgIHZlYzQgdjIgPSBhMiAqIHdlaWdodHMueCArIGIyICogd2VpZ2h0cy55ICsgYzIgKiB3ZWlnaHRzLnogKyBkMiAqIHdlaWdodHMudztcbiAgICB2ZWM0IHYzID0gYTMgKiB3ZWlnaHRzLnggKyBiMyAqIHdlaWdodHMueSArIGMzICogd2VpZ2h0cy56ICsgZDMgKiB3ZWlnaHRzLnc7XG5cbiAgICAvLyBhZGQgdXAgd2VpZ2h0c1xuICAgIGZsb2F0IG9uZSA9IGRvdCh3ZWlnaHRzLCB2ZWM0KDEuMCkpO1xuXG4gICAgLy8gdHJhbnNwb3NlIHRvIDR4NCBtYXRyaXhcbiAgICByZXR1cm4gbWF0NChcbiAgICAgICAgdjEueCwgdjIueCwgdjMueCwgMCxcbiAgICAgICAgdjEueSwgdjIueSwgdjMueSwgMCxcbiAgICAgICAgdjEueiwgdjIueiwgdjMueiwgMCxcbiAgICAgICAgdjEudywgdjIudywgdjMudywgb25lXG4gICAgKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQTNDQTs7OzsifQ==
