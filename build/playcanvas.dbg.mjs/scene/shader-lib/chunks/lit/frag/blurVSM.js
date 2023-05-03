var blurVSMPS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmx1clZTTS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2JsdXJWU00uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZhcnlpbmcgdmVjMiB2VXYwO1xuXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XG51bmlmb3JtIHZlYzIgcGl4ZWxPZmZzZXQ7XG5cbiNpZmRlZiBHQVVTU1xudW5pZm9ybSBmbG9hdCB3ZWlnaHRbU0FNUExFU107XG4jZW5kaWZcblxuI2lmZGVmIFBBQ0tFRFxuZmxvYXQgZGVjb2RlRmxvYXRSRyh2ZWMyIHJnKSB7XG4gICAgcmV0dXJuIHJnLnkqKDEuMC8yNTUuMCkgKyByZy54O1xufVxuXG52ZWMyIGVuY29kZUZsb2F0UkcoIGZsb2F0IHYgKSB7XG4gICAgdmVjMiBlbmMgPSB2ZWMyKDEuMCwgMjU1LjApICogdjtcbiAgICBlbmMgPSBmcmFjdChlbmMpO1xuICAgIGVuYyAtPSBlbmMueXkgKiB2ZWMyKDEuMC8yNTUuMCwgMS4wLzI1NS4wKTtcbiAgICByZXR1cm4gZW5jO1xufVxuI2VuZGlmXG5cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgdmVjMyBtb21lbnRzID0gdmVjMygwLjApO1xuICAgIHZlYzIgdXYgPSB2VXYwIC0gcGl4ZWxPZmZzZXQgKiAoZmxvYXQoU0FNUExFUykgKiAwLjUpO1xuICAgIGZvciAoaW50IGk9MDsgaTxTQU1QTEVTOyBpKyspIHtcbiAgICAgICAgdmVjNCBjID0gdGV4dHVyZTJEKHNvdXJjZSwgdXYgKyBwaXhlbE9mZnNldCAqIGZsb2F0KGkpKTtcblxuICAgICAgICAjaWZkZWYgUEFDS0VEXG4gICAgICAgIGMueHkgPSB2ZWMyKGRlY29kZUZsb2F0UkcoYy54eSksIGRlY29kZUZsb2F0UkcoYy56dykpO1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICAjaWZkZWYgR0FVU1NcbiAgICAgICAgbW9tZW50cyArPSBjLnh5eiAqIHdlaWdodFtpXTtcbiAgICAgICAgI2Vsc2VcbiAgICAgICAgbW9tZW50cyArPSBjLnh5ejtcbiAgICAgICAgI2VuZGlmXG4gICAgfVxuXG4gICAgI2lmbmRlZiBHQVVTU1xuICAgIG1vbWVudHMgLz0gZmxvYXQoU0FNUExFUyk7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgUEFDS0VEXG4gICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChlbmNvZGVGbG9hdFJHKG1vbWVudHMueCksIGVuY29kZUZsb2F0UkcobW9tZW50cy55KSk7XG4gICAgI2Vsc2VcbiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KG1vbWVudHMueCwgbW9tZW50cy55LCBtb21lbnRzLnosIDEuMCk7XG4gICAgI2VuZGlmXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGdCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
