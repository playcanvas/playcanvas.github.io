var skinTexVS = /* glsl */`

attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;

uniform highp sampler2D texture_poseMap;
uniform vec4 texture_poseMapSize;

void getBoneMatrix(const in float index, out vec4 v1, out vec4 v2, out vec4 v3) {

    float i = float(index);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpblRleC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi92ZXJ0L3NraW5UZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcblxuYXR0cmlidXRlIHZlYzQgdmVydGV4X2JvbmVXZWlnaHRzO1xuYXR0cmlidXRlIHZlYzQgdmVydGV4X2JvbmVJbmRpY2VzO1xuXG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCB0ZXh0dXJlX3Bvc2VNYXA7XG51bmlmb3JtIHZlYzQgdGV4dHVyZV9wb3NlTWFwU2l6ZTtcblxudm9pZCBnZXRCb25lTWF0cml4KGNvbnN0IGluIGZsb2F0IGluZGV4LCBvdXQgdmVjNCB2MSwgb3V0IHZlYzQgdjIsIG91dCB2ZWM0IHYzKSB7XG5cbiAgICBmbG9hdCBpID0gZmxvYXQoaW5kZXgpO1xuICAgIGZsb2F0IGogPSBpICogMy4wO1xuICAgIGZsb2F0IGR4ID0gdGV4dHVyZV9wb3NlTWFwU2l6ZS56O1xuICAgIGZsb2F0IGR5ID0gdGV4dHVyZV9wb3NlTWFwU2l6ZS53O1xuICAgIFxuICAgIGZsb2F0IHkgPSBmbG9vcihqICogZHgpO1xuICAgIGZsb2F0IHggPSBqIC0gKHkgKiB0ZXh0dXJlX3Bvc2VNYXBTaXplLngpO1xuICAgIHkgPSBkeSAqICh5ICsgMC41KTtcblxuICAgIC8vIHJlYWQgZWxlbWVudHMgb2YgNHgzIG1hdHJpeFxuICAgIHYxID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMC41KSwgeSkpO1xuICAgIHYyID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMS41KSwgeSkpO1xuICAgIHYzID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMi41KSwgeSkpO1xufVxuXG5tYXQ0IGdldFNraW5NYXRyaXgoY29uc3QgaW4gdmVjNCBpbmRpY2VzLCBjb25zdCBpbiB2ZWM0IHdlaWdodHMpIHtcbiAgICAvLyBnZXQgNCBib25lIG1hdHJpY2VzXG4gICAgdmVjNCBhMSwgYTIsIGEzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy54LCBhMSwgYTIsIGEzKTtcblxuICAgIHZlYzQgYjEsIGIyLCBiMztcbiAgICBnZXRCb25lTWF0cml4KGluZGljZXMueSwgYjEsIGIyLCBiMyk7XG5cbiAgICB2ZWM0IGMxLCBjMiwgYzM7XG4gICAgZ2V0Qm9uZU1hdHJpeChpbmRpY2VzLnosIGMxLCBjMiwgYzMpO1xuXG4gICAgdmVjNCBkMSwgZDIsIGQzO1xuICAgIGdldEJvbmVNYXRyaXgoaW5kaWNlcy53LCBkMSwgZDIsIGQzKTtcblxuICAgIC8vIG11bHRpcGx5IHRoZW0gYnkgd2VpZ2h0cyBhbmQgYWRkIHVwIHRvIGdldCBmaW5hbCA0eDMgbWF0cml4XG4gICAgdmVjNCB2MSA9IGExICogd2VpZ2h0cy54ICsgYjEgKiB3ZWlnaHRzLnkgKyBjMSAqIHdlaWdodHMueiArIGQxICogd2VpZ2h0cy53O1xuICAgIHZlYzQgdjIgPSBhMiAqIHdlaWdodHMueCArIGIyICogd2VpZ2h0cy55ICsgYzIgKiB3ZWlnaHRzLnogKyBkMiAqIHdlaWdodHMudztcbiAgICB2ZWM0IHYzID0gYTMgKiB3ZWlnaHRzLnggKyBiMyAqIHdlaWdodHMueSArIGMzICogd2VpZ2h0cy56ICsgZDMgKiB3ZWlnaHRzLnc7XG5cbiAgICAvLyBhZGQgdXAgd2VpZ2h0c1xuICAgIGZsb2F0IG9uZSA9IGRvdCh3ZWlnaHRzLCB2ZWM0KDEuMCkpO1xuXG4gICAgLy8gdHJhbnNwb3NlIHRvIDR4NCBtYXRyaXhcbiAgICByZXR1cm4gbWF0NChcbiAgICAgICAgdjEueCwgdjIueCwgdjMueCwgMCxcbiAgICAgICAgdjEueSwgdjIueSwgdjMueSwgMCxcbiAgICAgICAgdjEueiwgdjIueiwgdjMueiwgMCxcbiAgICAgICAgdjEudywgdjIudywgdjMudywgb25lXG4gICAgKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsZ0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
