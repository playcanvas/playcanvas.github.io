/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skinBatchConstVS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbkJhdGNoQ29uc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL3ZlcnQvc2tpbkJhdGNoQ29uc3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSBmbG9hdCB2ZXJ0ZXhfYm9uZUluZGljZXM7XG5cbnVuaWZvcm0gdmVjNCBtYXRyaXhfcG9zZVtCT05FX0xJTUlUICogM107XG5cbm1hdDQgZ2V0Qm9uZU1hdHJpeChjb25zdCBpbiBmbG9hdCBpKSB7XG4gICAgLy8gcmVhZCA0eDMgbWF0cml4XG4gICAgdmVjNCB2MSA9IG1hdHJpeF9wb3NlW2ludCgzLjAgKiBpKV07XG4gICAgdmVjNCB2MiA9IG1hdHJpeF9wb3NlW2ludCgzLjAgKiBpICsgMS4wKV07XG4gICAgdmVjNCB2MyA9IG1hdHJpeF9wb3NlW2ludCgzLjAgKiBpICsgMi4wKV07XG5cbiAgICAvLyB0cmFuc3Bvc2UgdG8gNHg0IG1hdHJpeFxuICAgIHJldHVybiBtYXQ0KFxuICAgICAgICB2MS54LCB2Mi54LCB2My54LCAwLFxuICAgICAgICB2MS55LCB2Mi55LCB2My55LCAwLFxuICAgICAgICB2MS56LCB2Mi56LCB2My56LCAwLFxuICAgICAgICB2MS53LCB2Mi53LCB2My53LCAxXG4gICAgKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQW5CQTs7OzsifQ==
