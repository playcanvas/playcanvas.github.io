var bilateralDeNoisePS = /* glsl */`
// bilateral filter, based on https://www.shadertoy.com/view/4dfGDH# and
// http://people.csail.mit.edu/sparis/bf_course/course_notes.pdf

// A bilateral filter is a non-linear, edge-preserving, and noise-reducing smoothing filter for images.
// It replaces the intensity of each pixel with a weighted average of intensity values from nearby pixels.
// This weight can be based on a Gaussian distribution. Crucially, the weights depend not only on
// Euclidean distance of pixels, but also on the radiometric differences (e.g., range differences, such
// as color intensity, depth distance, etc.). This preserves sharp edges.

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmlsYXRlcmFsRGVOb2lzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpZ2h0bWFwcGVyL2ZyYWcvYmlsYXRlcmFsRGVOb2lzZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gYmlsYXRlcmFsIGZpbHRlciwgYmFzZWQgb24gaHR0cHM6Ly93d3cuc2hhZGVydG95LmNvbS92aWV3LzRkZkdESCMgYW5kXG4vLyBodHRwOi8vcGVvcGxlLmNzYWlsLm1pdC5lZHUvc3BhcmlzL2JmX2NvdXJzZS9jb3Vyc2Vfbm90ZXMucGRmXG5cbi8vIEEgYmlsYXRlcmFsIGZpbHRlciBpcyBhIG5vbi1saW5lYXIsIGVkZ2UtcHJlc2VydmluZywgYW5kIG5vaXNlLXJlZHVjaW5nIHNtb290aGluZyBmaWx0ZXIgZm9yIGltYWdlcy5cbi8vIEl0IHJlcGxhY2VzIHRoZSBpbnRlbnNpdHkgb2YgZWFjaCBwaXhlbCB3aXRoIGEgd2VpZ2h0ZWQgYXZlcmFnZSBvZiBpbnRlbnNpdHkgdmFsdWVzIGZyb20gbmVhcmJ5IHBpeGVscy5cbi8vIFRoaXMgd2VpZ2h0IGNhbiBiZSBiYXNlZCBvbiBhIEdhdXNzaWFuIGRpc3RyaWJ1dGlvbi4gQ3J1Y2lhbGx5LCB0aGUgd2VpZ2h0cyBkZXBlbmQgbm90IG9ubHkgb25cbi8vIEV1Y2xpZGVhbiBkaXN0YW5jZSBvZiBwaXhlbHMsIGJ1dCBhbHNvIG9uIHRoZSByYWRpb21ldHJpYyBkaWZmZXJlbmNlcyAoZS5nLiwgcmFuZ2UgZGlmZmVyZW5jZXMsIHN1Y2hcbi8vIGFzIGNvbG9yIGludGVuc2l0eSwgZGVwdGggZGlzdGFuY2UsIGV0Yy4pLiBUaGlzIHByZXNlcnZlcyBzaGFycCBlZGdlcy5cblxuZmxvYXQgbm9ybXBkZjMoaW4gdmVjMyB2LCBpbiBmbG9hdCBzaWdtYSkge1xuICAgIHJldHVybiAwLjM5ODk0ICogZXhwKC0wLjUgKiBkb3QodiwgdikgLyAoc2lnbWEgKiBzaWdtYSkpIC8gc2lnbWE7XG59XG5cbnZlYzMgZGVjb2RlUkdCTSh2ZWM0IHJnYm0pIHtcbiAgICB2ZWMzIGNvbG9yID0gKDguMCAqIHJnYm0uYSkgKiByZ2JtLnJnYjtcbiAgICByZXR1cm4gY29sb3IgKiBjb2xvcjtcbn1cblxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbnZlYzQgZW5jb2RlUkdCTSh2ZWMzIGNvbG9yKSB7IC8vIG1vZGlmaWVkIFJHQk1cbiAgICB2ZWM0IGVuY29kZWQ7XG4gICAgZW5jb2RlZC5yZ2IgPSBwb3coY29sb3IucmdiLCB2ZWMzKDAuNSkpO1xuICAgIGVuY29kZWQucmdiICo9IDEuMCAvIDguMDtcblxuICAgIGVuY29kZWQuYSA9IHNhdHVyYXRlKCBtYXgoIG1heCggZW5jb2RlZC5yLCBlbmNvZGVkLmcgKSwgbWF4KCBlbmNvZGVkLmIsIDEuMCAvIDI1NS4wICkgKSApO1xuICAgIGVuY29kZWQuYSA9IGNlaWwoZW5jb2RlZC5hICogMjU1LjApIC8gMjU1LjA7XG5cbiAgICBlbmNvZGVkLnJnYiAvPSBlbmNvZGVkLmE7XG4gICAgcmV0dXJuIGVuY29kZWQ7XG59XG5cbi8vIGZpbHRlciBzaXplXG4jZGVmaW5lIE1TSVpFIDE1XG5cbnZhcnlpbmcgdmVjMiB2VXYwO1xudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudW5pZm9ybSB2ZWMyIHBpeGVsT2Zmc2V0O1xudW5pZm9ybSB2ZWMyIHNpZ21hcztcbnVuaWZvcm0gZmxvYXQgYlpub3JtO1xudW5pZm9ybSBmbG9hdCBrZXJuZWxbTVNJWkVdO1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIFxuICAgIHZlYzQgcGl4ZWxSZ2JtID0gdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCk7XG5cbiAgICAvLyBsaWdodG1hcCBzcGVjaWZpYyBvcHRpbWl6YXRpb24gLSBza2lwIHBpeGVscyB0aGF0IHdlcmUgbm90IGJha2VkXG4gICAgLy8gdGhpcyBhbHNvIGFsbG93cyBkaWxhdGUgZmlsdGVyIHRoYXQgd29yayBvbiB0aGUgb3V0cHV0IG9mIHRoaXMgdG8gd29yayBjb3JyZWN0bHksIGFzIGl0IGRlcGVuZHMgb24gLmEgYmVpbmcgemVyb1xuICAgIC8vIHRvIGRpbGF0ZSwgd2hpY2ggdGhlIGZvbGxvd2luZyBibHVyIGZpbHRlciB3b3VsZCBvdGhlcndpc2UgbW9kaWZ5XG4gICAgaWYgKHBpeGVsUmdibS5hIDw9IDAuMCkge1xuICAgICAgICBnbF9GcmFnQ29sb3IgPSBwaXhlbFJnYm07XG4gICAgICAgIHJldHVybiA7XG4gICAgfVxuXG4gICAgLy8gcmFuZ2Ugc2lnbWEgLSBjb250cm9scyBibHVycmluZXNzIGJhc2VkIG9uIGEgcGl4ZWwgZGlzdGFuY2VcbiAgICBmbG9hdCBzaWdtYSA9IHNpZ21hcy54O1xuXG4gICAgLy8gZG9tYWluIHNpZ21hIC0gY29udHJvbHMgYmx1cnJpbmVzcyBiYXNlZCBvbiBhIHBpeGVsIHNpbWlsYXJpdHkgKHRvIHByZXNlcnZlIGVkZ2VzKVxuICAgIGZsb2F0IGJTaWdtYSA9IHNpZ21hcy55O1xuXG4gICAgdmVjMyBwaXhlbEhkciA9IGRlY29kZVJHQk0ocGl4ZWxSZ2JtKTtcbiAgICB2ZWMzIGFjY3VtdWxhdGVkSGRyID0gdmVjMygwLjApO1xuICAgIGZsb2F0IGFjY3VtdWxhdGVkRmFjdG9yID0gMC4wO1xuXG4gICAgLy8gcmVhZCBvdXQgdGhlIHRleGVsc1xuICAgIGNvbnN0IGludCBrU2l6ZSA9IChNU0laRS0xKS8yO1xuICAgIGZvciAoaW50IGkgPSAta1NpemU7IGkgPD0ga1NpemU7ICsraSkge1xuICAgICAgICBmb3IgKGludCBqID0gLWtTaXplOyBqIDw9IGtTaXplOyArK2opIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gc2FtcGxlIHRoZSBwaXhlbCB3aXRoIG9mZnNldFxuICAgICAgICAgICAgdmVjMiBjb29yZCA9IHZVdjAgKyB2ZWMyKGZsb2F0KGkpLCBmbG9hdChqKSkgKiBwaXhlbE9mZnNldDtcbiAgICAgICAgICAgIHZlYzQgcmdibSA9IHRleHR1cmUyRChzb3VyY2UsIGNvb3JkKTtcblxuICAgICAgICAgICAgLy8gbGlnaHRtYXAgLSBvbmx5IHVzZSBiYWtlZCBwaXhlbHNcbiAgICAgICAgICAgIGlmIChyZ2JtLmEgPiAwLjApIHtcbiAgICAgICAgICAgICAgICB2ZWMzIGhkciA9IGRlY29kZVJHQk0ocmdibSk7XG5cbiAgICAgICAgICAgICAgICAvLyBiaWxhdGVyYWwgZmFjdG9yc1xuICAgICAgICAgICAgICAgIGZsb2F0IGZhY3RvciA9IGtlcm5lbFtrU2l6ZSArIGpdICoga2VybmVsW2tTaXplICsgaV07XG4gICAgICAgICAgICAgICAgZmFjdG9yICo9IG5vcm1wZGYzKGhkciAtIHBpeGVsSGRyLCBiU2lnbWEpICogYlpub3JtO1xuXG4gICAgICAgICAgICAgICAgLy8gYWNjdW11bGF0ZVxuICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkSGRyICs9IGZhY3RvciAqIGhkcjtcbiAgICAgICAgICAgICAgICBhY2N1bXVsYXRlZEZhY3RvciArPSBmYWN0b3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnbF9GcmFnQ29sb3IgPSBlbmNvZGVSR0JNKGFjY3VtdWxhdGVkSGRyIC8gYWNjdW11bGF0ZWRGYWN0b3IpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx5QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
