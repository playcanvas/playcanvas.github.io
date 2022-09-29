/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowVSM_commonPS = `
float linstep(float a, float b, float v) {
    return saturate((v - a) / (b - a));
}

float reduceLightBleeding(float pMax, float amount) {
   // Remove the [0, amount] tail and linearly rescale (amount, 1].
   return linstep(amount, 1.0, pMax);
}

float chebyshevUpperBound(vec2 moments, float mean, float minVariance, float lightBleedingReduction) {
    // Compute variance
    float variance = moments.y - (moments.x * moments.x);
    variance = max(variance, minVariance);

    // Compute probabilistic upper bound
    float d = mean - moments.x;
    float pMax = variance / (variance + (d * d));

    pMax = reduceLightBleeding(pMax, lightBleedingReduction);

    // One-tailed Chebyshev
    return (mean <= moments.x ? 1.0 : pMax);
}

float calculateEVSM(vec3 moments, float Z, float vsmBias, float exponent) {
    Z = 2.0 * Z - 1.0;
    float warpedDepth = exp(exponent * Z);

    moments.xy += vec2(warpedDepth, warpedDepth*warpedDepth) * (1.0 - moments.z);

    float VSMBias = vsmBias;//0.01 * 0.25;
    float depthScale = VSMBias * exponent * warpedDepth;
    float minVariance1 = depthScale * depthScale;
    return chebyshevUpperBound(moments.xy, warpedDepth, minVariance1, 0.1);
}
`;

export { shadowVSM_commonPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93VlNNX2NvbW1vbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dWU01fY29tbW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBsaW5zdGVwKGZsb2F0IGEsIGZsb2F0IGIsIGZsb2F0IHYpIHtcbiAgICByZXR1cm4gc2F0dXJhdGUoKHYgLSBhKSAvIChiIC0gYSkpO1xufVxuXG5mbG9hdCByZWR1Y2VMaWdodEJsZWVkaW5nKGZsb2F0IHBNYXgsIGZsb2F0IGFtb3VudCkge1xuICAgLy8gUmVtb3ZlIHRoZSBbMCwgYW1vdW50XSB0YWlsIGFuZCBsaW5lYXJseSByZXNjYWxlIChhbW91bnQsIDFdLlxuICAgcmV0dXJuIGxpbnN0ZXAoYW1vdW50LCAxLjAsIHBNYXgpO1xufVxuXG5mbG9hdCBjaGVieXNoZXZVcHBlckJvdW5kKHZlYzIgbW9tZW50cywgZmxvYXQgbWVhbiwgZmxvYXQgbWluVmFyaWFuY2UsIGZsb2F0IGxpZ2h0QmxlZWRpbmdSZWR1Y3Rpb24pIHtcbiAgICAvLyBDb21wdXRlIHZhcmlhbmNlXG4gICAgZmxvYXQgdmFyaWFuY2UgPSBtb21lbnRzLnkgLSAobW9tZW50cy54ICogbW9tZW50cy54KTtcbiAgICB2YXJpYW5jZSA9IG1heCh2YXJpYW5jZSwgbWluVmFyaWFuY2UpO1xuXG4gICAgLy8gQ29tcHV0ZSBwcm9iYWJpbGlzdGljIHVwcGVyIGJvdW5kXG4gICAgZmxvYXQgZCA9IG1lYW4gLSBtb21lbnRzLng7XG4gICAgZmxvYXQgcE1heCA9IHZhcmlhbmNlIC8gKHZhcmlhbmNlICsgKGQgKiBkKSk7XG5cbiAgICBwTWF4ID0gcmVkdWNlTGlnaHRCbGVlZGluZyhwTWF4LCBsaWdodEJsZWVkaW5nUmVkdWN0aW9uKTtcblxuICAgIC8vIE9uZS10YWlsZWQgQ2hlYnlzaGV2XG4gICAgcmV0dXJuIChtZWFuIDw9IG1vbWVudHMueCA/IDEuMCA6IHBNYXgpO1xufVxuXG5mbG9hdCBjYWxjdWxhdGVFVlNNKHZlYzMgbW9tZW50cywgZmxvYXQgWiwgZmxvYXQgdnNtQmlhcywgZmxvYXQgZXhwb25lbnQpIHtcbiAgICBaID0gMi4wICogWiAtIDEuMDtcbiAgICBmbG9hdCB3YXJwZWREZXB0aCA9IGV4cChleHBvbmVudCAqIFopO1xuXG4gICAgbW9tZW50cy54eSArPSB2ZWMyKHdhcnBlZERlcHRoLCB3YXJwZWREZXB0aCp3YXJwZWREZXB0aCkgKiAoMS4wIC0gbW9tZW50cy56KTtcblxuICAgIGZsb2F0IFZTTUJpYXMgPSB2c21CaWFzOy8vMC4wMSAqIDAuMjU7XG4gICAgZmxvYXQgZGVwdGhTY2FsZSA9IFZTTUJpYXMgKiBleHBvbmVudCAqIHdhcnBlZERlcHRoO1xuICAgIGZsb2F0IG1pblZhcmlhbmNlMSA9IGRlcHRoU2NhbGUgKiBkZXB0aFNjYWxlO1xuICAgIHJldHVybiBjaGVieXNoZXZVcHBlckJvdW5kKG1vbWVudHMueHksIHdhcnBlZERlcHRoLCBtaW5WYXJpYW5jZTEsIDAuMSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBcENBOzs7OyJ9
