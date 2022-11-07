/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpblRleC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi92ZXJ0L3NraW5UZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSB2ZWM0IHZlcnRleF9ib25lV2VpZ2h0cztcbmF0dHJpYnV0ZSB2ZWM0IHZlcnRleF9ib25lSW5kaWNlcztcblxudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgdGV4dHVyZV9wb3NlTWFwO1xudW5pZm9ybSB2ZWM0IHRleHR1cmVfcG9zZU1hcFNpemU7XG5cbnZvaWQgZ2V0Qm9uZU1hdHJpeChjb25zdCBpbiBmbG9hdCBpLCBvdXQgdmVjNCB2MSwgb3V0IHZlYzQgdjIsIG91dCB2ZWM0IHYzKSB7XG4gICAgZmxvYXQgaiA9IGkgKiAzLjA7XG4gICAgZmxvYXQgZHggPSB0ZXh0dXJlX3Bvc2VNYXBTaXplLno7XG4gICAgZmxvYXQgZHkgPSB0ZXh0dXJlX3Bvc2VNYXBTaXplLnc7XG4gICAgXG4gICAgZmxvYXQgeSA9IGZsb29yKGogKiBkeCk7XG4gICAgZmxvYXQgeCA9IGogLSAoeSAqIHRleHR1cmVfcG9zZU1hcFNpemUueCk7XG4gICAgeSA9IGR5ICogKHkgKyAwLjUpO1xuXG4gICAgLy8gcmVhZCBlbGVtZW50cyBvZiA0eDMgbWF0cml4XG4gICAgdjEgPSB0ZXh0dXJlMkQodGV4dHVyZV9wb3NlTWFwLCB2ZWMyKGR4ICogKHggKyAwLjUpLCB5KSk7XG4gICAgdjIgPSB0ZXh0dXJlMkQodGV4dHVyZV9wb3NlTWFwLCB2ZWMyKGR4ICogKHggKyAxLjUpLCB5KSk7XG4gICAgdjMgPSB0ZXh0dXJlMkQodGV4dHVyZV9wb3NlTWFwLCB2ZWMyKGR4ICogKHggKyAyLjUpLCB5KSk7XG59XG5cbm1hdDQgZ2V0U2tpbk1hdHJpeChjb25zdCBpbiB2ZWM0IGluZGljZXMsIGNvbnN0IGluIHZlYzQgd2VpZ2h0cykge1xuICAgIC8vIGdldCA0IGJvbmUgbWF0cmljZXNcbiAgICB2ZWM0IGExLCBhMiwgYTM7XG4gICAgZ2V0Qm9uZU1hdHJpeChpbmRpY2VzLngsIGExLCBhMiwgYTMpO1xuXG4gICAgdmVjNCBiMSwgYjIsIGIzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy55LCBiMSwgYjIsIGIzKTtcblxuICAgIHZlYzQgYzEsIGMyLCBjMztcbiAgICBnZXRCb25lTWF0cml4KGluZGljZXMueiwgYzEsIGMyLCBjMyk7XG5cbiAgICB2ZWM0IGQxLCBkMiwgZDM7XG4gICAgZ2V0Qm9uZU1hdHJpeChpbmRpY2VzLncsIGQxLCBkMiwgZDMpO1xuXG4gICAgLy8gbXVsdGlwbHkgdGhlbSBieSB3ZWlnaHRzIGFuZCBhZGQgdXAgdG8gZ2V0IGZpbmFsIDR4MyBtYXRyaXhcbiAgICB2ZWM0IHYxID0gYTEgKiB3ZWlnaHRzLnggKyBiMSAqIHdlaWdodHMueSArIGMxICogd2VpZ2h0cy56ICsgZDEgKiB3ZWlnaHRzLnc7XG4gICAgdmVjNCB2MiA9IGEyICogd2VpZ2h0cy54ICsgYjIgKiB3ZWlnaHRzLnkgKyBjMiAqIHdlaWdodHMueiArIGQyICogd2VpZ2h0cy53O1xuICAgIHZlYzQgdjMgPSBhMyAqIHdlaWdodHMueCArIGIzICogd2VpZ2h0cy55ICsgYzMgKiB3ZWlnaHRzLnogKyBkMyAqIHdlaWdodHMudztcblxuICAgIC8vIGFkZCB1cCB3ZWlnaHRzXG4gICAgZmxvYXQgb25lID0gZG90KHdlaWdodHMsIHZlYzQoMS4wKSk7XG5cbiAgICAvLyB0cmFuc3Bvc2UgdG8gNHg0IG1hdHJpeFxuICAgIHJldHVybiBtYXQ0KFxuICAgICAgICB2MS54LCB2Mi54LCB2My54LCAwLFxuICAgICAgICB2MS55LCB2Mi55LCB2My55LCAwLFxuICAgICAgICB2MS56LCB2Mi56LCB2My56LCAwLFxuICAgICAgICB2MS53LCB2Mi53LCB2My53LCBvbmVcbiAgICApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=