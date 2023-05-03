var skinBatchConstVS = /* glsl */`
attribute float vertex_boneIndices;

uniform vec4 matrix_pose[BONE_LIMIT * 3];

mat4 getBoneMatrix(const in float i) {
    // read 4x3 matrix
    vec4 v1 = matrix_pose[int(3.0 * i)];
    vec4 v2 = matrix_pose[int(3.0 * i + 1.0)];
    vec4 v3 = matrix_pose[int(3.0 * i + 2.0)];

    // transpose to 4x4 matrix
    return mat4(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, 1
    );
}
`;

export { skinBatchConstVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbkJhdGNoQ29uc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vdmVydC9za2luQmF0Y2hDb25zdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuYXR0cmlidXRlIGZsb2F0IHZlcnRleF9ib25lSW5kaWNlcztcblxudW5pZm9ybSB2ZWM0IG1hdHJpeF9wb3NlW0JPTkVfTElNSVQgKiAzXTtcblxubWF0NCBnZXRCb25lTWF0cml4KGNvbnN0IGluIGZsb2F0IGkpIHtcbiAgICAvLyByZWFkIDR4MyBtYXRyaXhcbiAgICB2ZWM0IHYxID0gbWF0cml4X3Bvc2VbaW50KDMuMCAqIGkpXTtcbiAgICB2ZWM0IHYyID0gbWF0cml4X3Bvc2VbaW50KDMuMCAqIGkgKyAxLjApXTtcbiAgICB2ZWM0IHYzID0gbWF0cml4X3Bvc2VbaW50KDMuMCAqIGkgKyAyLjApXTtcblxuICAgIC8vIHRyYW5zcG9zZSB0byA0eDQgbWF0cml4XG4gICAgcmV0dXJuIG1hdDQoXG4gICAgICAgIHYxLngsIHYyLngsIHYzLngsIDAsXG4gICAgICAgIHYxLnksIHYyLnksIHYzLnksIDAsXG4gICAgICAgIHYxLnosIHYyLnosIHYzLnosIDAsXG4gICAgICAgIHYxLncsIHYyLncsIHYzLncsIDFcbiAgICApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
