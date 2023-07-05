var skinConstVS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbkNvbnN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL3ZlcnQvc2tpbkNvbnN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhfYm9uZVdlaWdodHM7XG5hdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhfYm9uZUluZGljZXM7XG5cbnVuaWZvcm0gdmVjNCBtYXRyaXhfcG9zZVtCT05FX0xJTUlUICogM107XG5cbnZvaWQgZ2V0Qm9uZU1hdHJpeChjb25zdCBpbiBmbG9hdCBpLCBvdXQgdmVjNCB2MSwgb3V0IHZlYzQgdjIsIG91dCB2ZWM0IHYzKSB7XG4gICAgLy8gcmVhZCA0eDMgbWF0cml4XG4gICAgdjEgPSBtYXRyaXhfcG9zZVtpbnQoMy4wICogaSldO1xuICAgIHYyID0gbWF0cml4X3Bvc2VbaW50KDMuMCAqIGkgKyAxLjApXTtcbiAgICB2MyA9IG1hdHJpeF9wb3NlW2ludCgzLjAgKiBpICsgMi4wKV07XG59XG5cbm1hdDQgZ2V0U2tpbk1hdHJpeChjb25zdCBpbiB2ZWM0IGluZGljZXMsIGNvbnN0IGluIHZlYzQgd2VpZ2h0cykge1xuICAgIC8vIGdldCA0IGJvbmUgbWF0cmljZXNcbiAgICB2ZWM0IGExLCBhMiwgYTM7XG4gICAgZ2V0Qm9uZU1hdHJpeChpbmRpY2VzLngsIGExLCBhMiwgYTMpO1xuXG4gICAgdmVjNCBiMSwgYjIsIGIzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy55LCBiMSwgYjIsIGIzKTtcblxuICAgIHZlYzQgYzEsIGMyLCBjMztcbiAgICBnZXRCb25lTWF0cml4KGluZGljZXMueiwgYzEsIGMyLCBjMyk7XG5cbiAgICB2ZWM0IGQxLCBkMiwgZDM7XG4gICAgZ2V0Qm9uZU1hdHJpeChpbmRpY2VzLncsIGQxLCBkMiwgZDMpO1xuXG4gICAgLy8gbXVsdGlwbHkgdGhlbSBieSB3ZWlnaHRzIGFuZCBhZGQgdXAgdG8gZ2V0IGZpbmFsIDR4MyBtYXRyaXhcbiAgICB2ZWM0IHYxID0gYTEgKiB3ZWlnaHRzLnggKyBiMSAqIHdlaWdodHMueSArIGMxICogd2VpZ2h0cy56ICsgZDEgKiB3ZWlnaHRzLnc7XG4gICAgdmVjNCB2MiA9IGEyICogd2VpZ2h0cy54ICsgYjIgKiB3ZWlnaHRzLnkgKyBjMiAqIHdlaWdodHMueiArIGQyICogd2VpZ2h0cy53O1xuICAgIHZlYzQgdjMgPSBhMyAqIHdlaWdodHMueCArIGIzICogd2VpZ2h0cy55ICsgYzMgKiB3ZWlnaHRzLnogKyBkMyAqIHdlaWdodHMudztcblxuICAgIC8vIGFkZCB1cCB3ZWlnaHRzXG4gICAgZmxvYXQgb25lID0gZG90KHdlaWdodHMsIHZlYzQoMS4wKSk7XG5cbiAgICAvLyB0cmFuc3Bvc2UgdG8gNHg0IG1hdHJpeFxuICAgIHJldHVybiBtYXQ0KFxuICAgICAgICB2MS54LCB2Mi54LCB2My54LCAwLFxuICAgICAgICB2MS55LCB2Mi55LCB2My55LCAwLFxuICAgICAgICB2MS56LCB2Mi56LCB2My56LCAwLFxuICAgICAgICB2MS53LCB2Mi53LCB2My53LCBvbmVcbiAgICApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
