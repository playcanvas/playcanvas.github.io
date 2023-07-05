var textureSamplePS = /* glsl */`
vec4 texture2DSRGB(sampler2D tex, vec2 uv) {
    return gammaCorrectInput(texture2D(tex, uv));
}

vec4 texture2DSRGB(sampler2D tex, vec2 uv, float bias) {
    return gammaCorrectInput(texture2D(tex, uv, bias));
}

vec3 texture2DRGBM(sampler2D tex, vec2 uv) {
    return decodeRGBM(texture2D(tex, uv));
}

vec3 texture2DRGBM(sampler2D tex, vec2 uv, float bias) {
    return decodeRGBM(texture2D(tex, uv, bias));
}

vec3 texture2DRGBE(sampler2D tex, vec2 uv) {
    return decodeRGBM(texture2D(tex, uv));
}

vec3 texture2DRGBE(sampler2D tex, vec2 uv, float bias) {
    return decodeRGBM(texture2D(tex, uv, bias));
}
`;

export { textureSamplePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZVNhbXBsZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvdGV4dHVyZVNhbXBsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjNCB0ZXh0dXJlMkRTUkdCKHNhbXBsZXIyRCB0ZXgsIHZlYzIgdXYpIHtcbiAgICByZXR1cm4gZ2FtbWFDb3JyZWN0SW5wdXQodGV4dHVyZTJEKHRleCwgdXYpKTtcbn1cblxudmVjNCB0ZXh0dXJlMkRTUkdCKHNhbXBsZXIyRCB0ZXgsIHZlYzIgdXYsIGZsb2F0IGJpYXMpIHtcbiAgICByZXR1cm4gZ2FtbWFDb3JyZWN0SW5wdXQodGV4dHVyZTJEKHRleCwgdXYsIGJpYXMpKTtcbn1cblxudmVjMyB0ZXh0dXJlMkRSR0JNKHNhbXBsZXIyRCB0ZXgsIHZlYzIgdXYpIHtcbiAgICByZXR1cm4gZGVjb2RlUkdCTSh0ZXh0dXJlMkQodGV4LCB1dikpO1xufVxuXG52ZWMzIHRleHR1cmUyRFJHQk0oc2FtcGxlcjJEIHRleCwgdmVjMiB1diwgZmxvYXQgYmlhcykge1xuICAgIHJldHVybiBkZWNvZGVSR0JNKHRleHR1cmUyRCh0ZXgsIHV2LCBiaWFzKSk7XG59XG5cbnZlYzMgdGV4dHVyZTJEUkdCRShzYW1wbGVyMkQgdGV4LCB2ZWMyIHV2KSB7XG4gICAgcmV0dXJuIGRlY29kZVJHQk0odGV4dHVyZTJEKHRleCwgdXYpKTtcbn1cblxudmVjMyB0ZXh0dXJlMkRSR0JFKHNhbXBsZXIyRCB0ZXgsIHZlYzIgdXYsIGZsb2F0IGJpYXMpIHtcbiAgICByZXR1cm4gZGVjb2RlUkdCTSh0ZXh0dXJlMkQodGV4LCB1diwgYmlhcykpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxzQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
