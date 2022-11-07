/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var bilateralDeNoisePS = `
// bilateral filter, based on https://www.shadertoy.com/view/4dfGDH# and
// http://people.csail.mit.edu/sparis/bf_course/course_notes.pdf

// A bilateral filter is a non-linear, edge-preserving, and noise-reducing smoothing filter for images.
// It replaces the intensity of each pixel with a weighted average of intensity values from nearby pixels.
// This weight can be based on a Gaussian distribution. Crucially, the weights depend not only on
// Euclidean distance of pixels, but also on the radiometric differences (e.g., range differences, such
// as color intensity, depth distance, etc.). This preserves sharp edges.

#define SHADER_NAME BilateralDeNoise

float normpdf3(in vec3 v, in float sigma) {
    return 0.39894 * exp(-0.5 * dot(v, v) / (sigma * sigma)) / sigma;
}

vec3 decodeRGBM(vec4 rgbm) {
    vec3 color = (8.0 * rgbm.a) * rgbm.rgb;
    return color * color;
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 encodeRGBM(vec3 color) { // modified RGBM
    vec4 encoded;
    encoded.rgb = pow(color.rgb, vec3(0.5));
    encoded.rgb *= 1.0 / 8.0;

    encoded.a = saturate( max( max( encoded.r, encoded.g ), max( encoded.b, 1.0 / 255.0 ) ) );
    encoded.a = ceil(encoded.a * 255.0) / 255.0;

    encoded.rgb /= encoded.a;
    return encoded;
}

// filter size
#define MSIZE 15

varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;
uniform vec2 sigmas;
uniform float bZnorm;
uniform float kernel[MSIZE];

void main(void) {
    
    vec4 pixelRgbm = texture2D(source, vUv0);

    // lightmap specific optimization - skip pixels that were not baked
    // this also allows dilate filter that work on the output of this to work correctly, as it depends on .a being zero
    // to dilate, which the following blur filter would otherwise modify
    if (pixelRgbm.a <= 0.0) {
        gl_FragColor = pixelRgbm;
        return ;
    }

    // range sigma - controls blurriness based on a pixel distance
    float sigma = sigmas.x;

    // domain sigma - controls blurriness based on a pixel similarity (to preserve edges)
    float bSigma = sigmas.y;

    vec3 pixelHdr = decodeRGBM(pixelRgbm);
    vec3 accumulatedHdr = vec3(0.0);
    float accumulatedFactor = 0.0;

    // read out the texels
    const int kSize = (MSIZE-1)/2;
    for (int i = -kSize; i <= kSize; ++i) {
        for (int j = -kSize; j <= kSize; ++j) {
            
            // sample the pixel with offset
            vec2 coord = vUv0 + vec2(float(i), float(j)) * pixelOffset;
            vec4 rgbm = texture2D(source, coord);

            // lightmap - only use baked pixels
            if (rgbm.a > 0.0) {
                vec3 hdr = decodeRGBM(rgbm);

                // bilateral factors
                float factor = kernel[kSize + j] * kernel[kSize + i];
                factor *= normpdf3(hdr - pixelHdr, bSigma) * bZnorm;

                // accumulate
                accumulatedHdr += factor * hdr;
                accumulatedFactor += factor;
            }
        }
    }

    gl_FragColor = encodeRGBM(accumulatedHdr / accumulatedFactor);
}
`;

export { bilateralDeNoisePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmlsYXRlcmFsRGVOb2lzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saWdodG1hcHBlci9mcmFnL2JpbGF0ZXJhbERlTm9pc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2Bcbi8vIGJpbGF0ZXJhbCBmaWx0ZXIsIGJhc2VkIG9uIGh0dHBzOi8vd3d3LnNoYWRlcnRveS5jb20vdmlldy80ZGZHREgjIGFuZFxuLy8gaHR0cDovL3Blb3BsZS5jc2FpbC5taXQuZWR1L3NwYXJpcy9iZl9jb3Vyc2UvY291cnNlX25vdGVzLnBkZlxuXG4vLyBBIGJpbGF0ZXJhbCBmaWx0ZXIgaXMgYSBub24tbGluZWFyLCBlZGdlLXByZXNlcnZpbmcsIGFuZCBub2lzZS1yZWR1Y2luZyBzbW9vdGhpbmcgZmlsdGVyIGZvciBpbWFnZXMuXG4vLyBJdCByZXBsYWNlcyB0aGUgaW50ZW5zaXR5IG9mIGVhY2ggcGl4ZWwgd2l0aCBhIHdlaWdodGVkIGF2ZXJhZ2Ugb2YgaW50ZW5zaXR5IHZhbHVlcyBmcm9tIG5lYXJieSBwaXhlbHMuXG4vLyBUaGlzIHdlaWdodCBjYW4gYmUgYmFzZWQgb24gYSBHYXVzc2lhbiBkaXN0cmlidXRpb24uIENydWNpYWxseSwgdGhlIHdlaWdodHMgZGVwZW5kIG5vdCBvbmx5IG9uXG4vLyBFdWNsaWRlYW4gZGlzdGFuY2Ugb2YgcGl4ZWxzLCBidXQgYWxzbyBvbiB0aGUgcmFkaW9tZXRyaWMgZGlmZmVyZW5jZXMgKGUuZy4sIHJhbmdlIGRpZmZlcmVuY2VzLCBzdWNoXG4vLyBhcyBjb2xvciBpbnRlbnNpdHksIGRlcHRoIGRpc3RhbmNlLCBldGMuKS4gVGhpcyBwcmVzZXJ2ZXMgc2hhcnAgZWRnZXMuXG5cbiNkZWZpbmUgU0hBREVSX05BTUUgQmlsYXRlcmFsRGVOb2lzZVxuXG5mbG9hdCBub3JtcGRmMyhpbiB2ZWMzIHYsIGluIGZsb2F0IHNpZ21hKSB7XG4gICAgcmV0dXJuIDAuMzk4OTQgKiBleHAoLTAuNSAqIGRvdCh2LCB2KSAvIChzaWdtYSAqIHNpZ21hKSkgLyBzaWdtYTtcbn1cblxudmVjMyBkZWNvZGVSR0JNKHZlYzQgcmdibSkge1xuICAgIHZlYzMgY29sb3IgPSAoOC4wICogcmdibS5hKSAqIHJnYm0ucmdiO1xuICAgIHJldHVybiBjb2xvciAqIGNvbG9yO1xufVxuXG5mbG9hdCBzYXR1cmF0ZShmbG9hdCB4KSB7XG4gICAgcmV0dXJuIGNsYW1wKHgsIDAuMCwgMS4wKTtcbn1cblxudmVjNCBlbmNvZGVSR0JNKHZlYzMgY29sb3IpIHsgLy8gbW9kaWZpZWQgUkdCTVxuICAgIHZlYzQgZW5jb2RlZDtcbiAgICBlbmNvZGVkLnJnYiA9IHBvdyhjb2xvci5yZ2IsIHZlYzMoMC41KSk7XG4gICAgZW5jb2RlZC5yZ2IgKj0gMS4wIC8gOC4wO1xuXG4gICAgZW5jb2RlZC5hID0gc2F0dXJhdGUoIG1heCggbWF4KCBlbmNvZGVkLnIsIGVuY29kZWQuZyApLCBtYXgoIGVuY29kZWQuYiwgMS4wIC8gMjU1LjAgKSApICk7XG4gICAgZW5jb2RlZC5hID0gY2VpbChlbmNvZGVkLmEgKiAyNTUuMCkgLyAyNTUuMDtcblxuICAgIGVuY29kZWQucmdiIC89IGVuY29kZWQuYTtcbiAgICByZXR1cm4gZW5jb2RlZDtcbn1cblxuLy8gZmlsdGVyIHNpemVcbiNkZWZpbmUgTVNJWkUgMTVcblxudmFyeWluZyB2ZWMyIHZVdjA7XG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XG51bmlmb3JtIHZlYzIgcGl4ZWxPZmZzZXQ7XG51bmlmb3JtIHZlYzIgc2lnbWFzO1xudW5pZm9ybSBmbG9hdCBiWm5vcm07XG51bmlmb3JtIGZsb2F0IGtlcm5lbFtNU0laRV07XG5cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgXG4gICAgdmVjNCBwaXhlbFJnYm0gPSB0ZXh0dXJlMkQoc291cmNlLCB2VXYwKTtcblxuICAgIC8vIGxpZ2h0bWFwIHNwZWNpZmljIG9wdGltaXphdGlvbiAtIHNraXAgcGl4ZWxzIHRoYXQgd2VyZSBub3QgYmFrZWRcbiAgICAvLyB0aGlzIGFsc28gYWxsb3dzIGRpbGF0ZSBmaWx0ZXIgdGhhdCB3b3JrIG9uIHRoZSBvdXRwdXQgb2YgdGhpcyB0byB3b3JrIGNvcnJlY3RseSwgYXMgaXQgZGVwZW5kcyBvbiAuYSBiZWluZyB6ZXJvXG4gICAgLy8gdG8gZGlsYXRlLCB3aGljaCB0aGUgZm9sbG93aW5nIGJsdXIgZmlsdGVyIHdvdWxkIG90aGVyd2lzZSBtb2RpZnlcbiAgICBpZiAocGl4ZWxSZ2JtLmEgPD0gMC4wKSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHBpeGVsUmdibTtcbiAgICAgICAgcmV0dXJuIDtcbiAgICB9XG5cbiAgICAvLyByYW5nZSBzaWdtYSAtIGNvbnRyb2xzIGJsdXJyaW5lc3MgYmFzZWQgb24gYSBwaXhlbCBkaXN0YW5jZVxuICAgIGZsb2F0IHNpZ21hID0gc2lnbWFzLng7XG5cbiAgICAvLyBkb21haW4gc2lnbWEgLSBjb250cm9scyBibHVycmluZXNzIGJhc2VkIG9uIGEgcGl4ZWwgc2ltaWxhcml0eSAodG8gcHJlc2VydmUgZWRnZXMpXG4gICAgZmxvYXQgYlNpZ21hID0gc2lnbWFzLnk7XG5cbiAgICB2ZWMzIHBpeGVsSGRyID0gZGVjb2RlUkdCTShwaXhlbFJnYm0pO1xuICAgIHZlYzMgYWNjdW11bGF0ZWRIZHIgPSB2ZWMzKDAuMCk7XG4gICAgZmxvYXQgYWNjdW11bGF0ZWRGYWN0b3IgPSAwLjA7XG5cbiAgICAvLyByZWFkIG91dCB0aGUgdGV4ZWxzXG4gICAgY29uc3QgaW50IGtTaXplID0gKE1TSVpFLTEpLzI7XG4gICAgZm9yIChpbnQgaSA9IC1rU2l6ZTsgaSA8PSBrU2l6ZTsgKytpKSB7XG4gICAgICAgIGZvciAoaW50IGogPSAta1NpemU7IGogPD0ga1NpemU7ICsraikge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBzYW1wbGUgdGhlIHBpeGVsIHdpdGggb2Zmc2V0XG4gICAgICAgICAgICB2ZWMyIGNvb3JkID0gdlV2MCArIHZlYzIoZmxvYXQoaSksIGZsb2F0KGopKSAqIHBpeGVsT2Zmc2V0O1xuICAgICAgICAgICAgdmVjNCByZ2JtID0gdGV4dHVyZTJEKHNvdXJjZSwgY29vcmQpO1xuXG4gICAgICAgICAgICAvLyBsaWdodG1hcCAtIG9ubHkgdXNlIGJha2VkIHBpeGVsc1xuICAgICAgICAgICAgaWYgKHJnYm0uYSA+IDAuMCkge1xuICAgICAgICAgICAgICAgIHZlYzMgaGRyID0gZGVjb2RlUkdCTShyZ2JtKTtcblxuICAgICAgICAgICAgICAgIC8vIGJpbGF0ZXJhbCBmYWN0b3JzXG4gICAgICAgICAgICAgICAgZmxvYXQgZmFjdG9yID0ga2VybmVsW2tTaXplICsgal0gKiBrZXJuZWxba1NpemUgKyBpXTtcbiAgICAgICAgICAgICAgICBmYWN0b3IgKj0gbm9ybXBkZjMoaGRyIC0gcGl4ZWxIZHIsIGJTaWdtYSkgKiBiWm5vcm07XG5cbiAgICAgICAgICAgICAgICAvLyBhY2N1bXVsYXRlXG4gICAgICAgICAgICAgICAgYWNjdW11bGF0ZWRIZHIgKz0gZmFjdG9yICogaGRyO1xuICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkRmFjdG9yICs9IGZhY3RvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdsX0ZyYWdDb2xvciA9IGVuY29kZVJHQk0oYWNjdW11bGF0ZWRIZHIgLyBhY2N1bXVsYXRlZEZhY3Rvcik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQS9GQTs7OzsifQ==
