/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var blurVSMPS = `
varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

#ifdef GAUSS
uniform float weight[SAMPLES];
#endif

#ifdef PACKED
float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

vec2 encodeFloatRG( float v ) {
    vec2 enc = vec2(1.0, 255.0) * v;
    enc = fract(enc);
    enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);
    return enc;
}
#endif

void main(void) {
    vec3 moments = vec3(0.0);
    vec2 uv = vUv0 - pixelOffset * (float(SAMPLES) * 0.5);
    for (int i=0; i<SAMPLES; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));

        #ifdef PACKED
        c.xy = vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw));
        #endif

        #ifdef GAUSS
        moments += c.xyz * weight[i];
        #else
        moments += c.xyz;
        #endif
    }

    #ifndef GAUSS
    moments /= float(SAMPLES);
    #endif

    #ifdef PACKED
    gl_FragColor = vec4(encodeFloatRG(moments.x), encodeFloatRG(moments.y));
    #else
    gl_FragColor = vec4(moments.x, moments.y, moments.z, 1.0);
    #endif
}
`;

export { blurVSMPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmx1clZTTS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9ibHVyVlNNLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52YXJ5aW5nIHZlYzIgdlV2MDtcblxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudW5pZm9ybSB2ZWMyIHBpeGVsT2Zmc2V0O1xuXG4jaWZkZWYgR0FVU1NcbnVuaWZvcm0gZmxvYXQgd2VpZ2h0W1NBTVBMRVNdO1xuI2VuZGlmXG5cbiNpZmRlZiBQQUNLRURcbmZsb2F0IGRlY29kZUZsb2F0UkcodmVjMiByZykge1xuICAgIHJldHVybiByZy55KigxLjAvMjU1LjApICsgcmcueDtcbn1cblxudmVjMiBlbmNvZGVGbG9hdFJHKCBmbG9hdCB2ICkge1xuICAgIHZlYzIgZW5jID0gdmVjMigxLjAsIDI1NS4wKSAqIHY7XG4gICAgZW5jID0gZnJhY3QoZW5jKTtcbiAgICBlbmMgLT0gZW5jLnl5ICogdmVjMigxLjAvMjU1LjAsIDEuMC8yNTUuMCk7XG4gICAgcmV0dXJuIGVuYztcbn1cbiNlbmRpZlxuXG52b2lkIG1haW4odm9pZCkge1xuICAgIHZlYzMgbW9tZW50cyA9IHZlYzMoMC4wKTtcbiAgICB2ZWMyIHV2ID0gdlV2MCAtIHBpeGVsT2Zmc2V0ICogKGZsb2F0KFNBTVBMRVMpICogMC41KTtcbiAgICBmb3IgKGludCBpPTA7IGk8U0FNUExFUzsgaSsrKSB7XG4gICAgICAgIHZlYzQgYyA9IHRleHR1cmUyRChzb3VyY2UsIHV2ICsgcGl4ZWxPZmZzZXQgKiBmbG9hdChpKSk7XG5cbiAgICAgICAgI2lmZGVmIFBBQ0tFRFxuICAgICAgICBjLnh5ID0gdmVjMihkZWNvZGVGbG9hdFJHKGMueHkpLCBkZWNvZGVGbG9hdFJHKGMuencpKTtcbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgI2lmZGVmIEdBVVNTXG4gICAgICAgIG1vbWVudHMgKz0gYy54eXogKiB3ZWlnaHRbaV07XG4gICAgICAgICNlbHNlXG4gICAgICAgIG1vbWVudHMgKz0gYy54eXo7XG4gICAgICAgICNlbmRpZlxuICAgIH1cblxuICAgICNpZm5kZWYgR0FVU1NcbiAgICBtb21lbnRzIC89IGZsb2F0KFNBTVBMRVMpO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIFBBQ0tFRFxuICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZW5jb2RlRmxvYXRSRyhtb21lbnRzLngpLCBlbmNvZGVGbG9hdFJHKG1vbWVudHMueSkpO1xuICAgICNlbHNlXG4gICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChtb21lbnRzLngsIG1vbWVudHMueSwgbW9tZW50cy56LCAxLjApO1xuICAgICNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FsREE7Ozs7In0=
