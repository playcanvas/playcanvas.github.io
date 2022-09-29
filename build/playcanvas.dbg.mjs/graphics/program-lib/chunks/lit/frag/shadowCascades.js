/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowCascadesPS = `
const float maxCascades = 4.0;

// shadow matrix for selected cascade
mat4 cascadeShadowMat;

// function which selects a shadow projection matrix based on cascade distances 
void getShadowCascadeMatrix(mat4 shadowMatrixPalette[4], float shadowCascadeDistances[4], float shadowCascadeCount) {

    // depth in 0 .. far plane range
    float depth = 1.0 / gl_FragCoord.w;

    // find cascade index based on the depth (loop as there is no per component vec compare operator in webgl)
    float cascadeIndex = 0.0;
    for (float i = 0.0; i < maxCascades; i++) {
        if (depth < shadowCascadeDistances[int(i)]) {
            cascadeIndex = i;
            break;
        }
    }

    // limit to actual number of used cascades
    cascadeIndex = min(cascadeIndex, shadowCascadeCount - 1.0);

    // pick shadow matrix
    #ifdef GL2
        cascadeShadowMat = shadowMatrixPalette[int(cascadeIndex)];
    #else
        // webgl 1 does not allow non-cost index array lookup
        if (cascadeIndex == 0.0) {
            cascadeShadowMat = shadowMatrixPalette[0];
        }
        else if (cascadeIndex == 1.0) {
            cascadeShadowMat = shadowMatrixPalette[1];
        }
        else if (cascadeIndex == 2.0) {
            cascadeShadowMat = shadowMatrixPalette[2];
        }
        else {
            cascadeShadowMat = shadowMatrixPalette[3];
        }
    #endif
}

void fadeShadow(float shadowCascadeDistances[4]) {                  

    // if the pixel is past the shadow distance, remove shadow
    // this enforces straight line instead of corner of shadow which moves when camera rotates  
    float depth = 1.0 / gl_FragCoord.w;
    if (depth > shadowCascadeDistances[int(maxCascades - 1.0)]) {
        dShadowCoord.z = -9999999.0;
    }
}
`;

export { shadowCascadesPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q2FzY2FkZXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93Q2FzY2FkZXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmNvbnN0IGZsb2F0IG1heENhc2NhZGVzID0gNC4wO1xuXG4vLyBzaGFkb3cgbWF0cml4IGZvciBzZWxlY3RlZCBjYXNjYWRlXG5tYXQ0IGNhc2NhZGVTaGFkb3dNYXQ7XG5cbi8vIGZ1bmN0aW9uIHdoaWNoIHNlbGVjdHMgYSBzaGFkb3cgcHJvamVjdGlvbiBtYXRyaXggYmFzZWQgb24gY2FzY2FkZSBkaXN0YW5jZXMgXG52b2lkIGdldFNoYWRvd0Nhc2NhZGVNYXRyaXgobWF0NCBzaGFkb3dNYXRyaXhQYWxldHRlWzRdLCBmbG9hdCBzaGFkb3dDYXNjYWRlRGlzdGFuY2VzWzRdLCBmbG9hdCBzaGFkb3dDYXNjYWRlQ291bnQpIHtcblxuICAgIC8vIGRlcHRoIGluIDAgLi4gZmFyIHBsYW5lIHJhbmdlXG4gICAgZmxvYXQgZGVwdGggPSAxLjAgLyBnbF9GcmFnQ29vcmQudztcblxuICAgIC8vIGZpbmQgY2FzY2FkZSBpbmRleCBiYXNlZCBvbiB0aGUgZGVwdGggKGxvb3AgYXMgdGhlcmUgaXMgbm8gcGVyIGNvbXBvbmVudCB2ZWMgY29tcGFyZSBvcGVyYXRvciBpbiB3ZWJnbClcbiAgICBmbG9hdCBjYXNjYWRlSW5kZXggPSAwLjA7XG4gICAgZm9yIChmbG9hdCBpID0gMC4wOyBpIDwgbWF4Q2FzY2FkZXM7IGkrKykge1xuICAgICAgICBpZiAoZGVwdGggPCBzaGFkb3dDYXNjYWRlRGlzdGFuY2VzW2ludChpKV0pIHtcbiAgICAgICAgICAgIGNhc2NhZGVJbmRleCA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGxpbWl0IHRvIGFjdHVhbCBudW1iZXIgb2YgdXNlZCBjYXNjYWRlc1xuICAgIGNhc2NhZGVJbmRleCA9IG1pbihjYXNjYWRlSW5kZXgsIHNoYWRvd0Nhc2NhZGVDb3VudCAtIDEuMCk7XG5cbiAgICAvLyBwaWNrIHNoYWRvdyBtYXRyaXhcbiAgICAjaWZkZWYgR0wyXG4gICAgICAgIGNhc2NhZGVTaGFkb3dNYXQgPSBzaGFkb3dNYXRyaXhQYWxldHRlW2ludChjYXNjYWRlSW5kZXgpXTtcbiAgICAjZWxzZVxuICAgICAgICAvLyB3ZWJnbCAxIGRvZXMgbm90IGFsbG93IG5vbi1jb3N0IGluZGV4IGFycmF5IGxvb2t1cFxuICAgICAgICBpZiAoY2FzY2FkZUluZGV4ID09IDAuMCkge1xuICAgICAgICAgICAgY2FzY2FkZVNoYWRvd01hdCA9IHNoYWRvd01hdHJpeFBhbGV0dGVbMF07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2FzY2FkZUluZGV4ID09IDEuMCkge1xuICAgICAgICAgICAgY2FzY2FkZVNoYWRvd01hdCA9IHNoYWRvd01hdHJpeFBhbGV0dGVbMV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2FzY2FkZUluZGV4ID09IDIuMCkge1xuICAgICAgICAgICAgY2FzY2FkZVNoYWRvd01hdCA9IHNoYWRvd01hdHJpeFBhbGV0dGVbMl07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXNjYWRlU2hhZG93TWF0ID0gc2hhZG93TWF0cml4UGFsZXR0ZVszXTtcbiAgICAgICAgfVxuICAgICNlbmRpZlxufVxuXG52b2lkIGZhZGVTaGFkb3coZmxvYXQgc2hhZG93Q2FzY2FkZURpc3RhbmNlc1s0XSkgeyAgICAgICAgICAgICAgICAgIFxuXG4gICAgLy8gaWYgdGhlIHBpeGVsIGlzIHBhc3QgdGhlIHNoYWRvdyBkaXN0YW5jZSwgcmVtb3ZlIHNoYWRvd1xuICAgIC8vIHRoaXMgZW5mb3JjZXMgc3RyYWlnaHQgbGluZSBpbnN0ZWFkIG9mIGNvcm5lciBvZiBzaGFkb3cgd2hpY2ggbW92ZXMgd2hlbiBjYW1lcmEgcm90YXRlcyAgXG4gICAgZmxvYXQgZGVwdGggPSAxLjAgLyBnbF9GcmFnQ29vcmQudztcbiAgICBpZiAoZGVwdGggPiBzaGFkb3dDYXNjYWRlRGlzdGFuY2VzW2ludChtYXhDYXNjYWRlcyAtIDEuMCldKSB7XG4gICAgICAgIGRTaGFkb3dDb29yZC56ID0gLTk5OTk5OTkuMDtcbiAgICB9XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXJEQTs7OzsifQ==
