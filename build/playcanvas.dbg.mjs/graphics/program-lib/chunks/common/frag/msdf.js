/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var msdfPS = `
uniform sampler2D texture_msdfMap;

#ifdef GL_OES_standard_derivatives
#define USE_FWIDTH
#endif

#ifdef GL2
#define USE_FWIDTH
#endif

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float map (float min, float max, float v) {
    return (v - min) / (max - min);
}

uniform float font_sdfIntensity; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost
uniform float font_pxrange;      // the number of pixels between inside and outside the font in SDF
uniform float font_textureWidth; // the width of the texture atlas

#ifdef UNIFORM_TEXT_PARAMETERS
uniform vec4 outline_color;
uniform float outline_thickness;
uniform vec4 shadow_color;
uniform vec2 shadow_offset;
#else
varying vec4 outline_color;
varying float outline_thickness;
varying vec4 shadow_color;
varying vec2 shadow_offset;
#endif

vec4 applyMsdf(vec4 color) {
    // sample the field
    vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    vec2 uvShdw = vUv0 - shadow_offset;
    vec3 ssample = texture2D(texture_msdfMap, uvShdw).rgb;
    // get the signed distance value
    float sigDist = median(tsample.r, tsample.g, tsample.b);
    float sigDistShdw = median(ssample.r, ssample.g, ssample.b);

    // smoothing limit - smaller value makes for sharper but more aliased text, especially on angles
    // too large value (0.5) creates a dark glow around the letters
    float smoothingMax = 0.2;

    #ifdef USE_FWIDTH
    // smoothing depends on size of texture on screen
    vec2 w = fwidth(vUv0);
    float smoothing = clamp(w.x * font_textureWidth / font_pxrange, 0.0, smoothingMax);
    #else
    float font_size = 16.0; // TODO fix this
    // smoothing gets smaller as the font size gets bigger
    // don't have fwidth we can approximate from font size, this doesn't account for scaling
    // so a big font scaled down will be wrong...
    float smoothing = clamp(font_pxrange / font_size, 0.0, smoothingMax);
    #endif

    float mapMin = 0.05;
    float mapMax = clamp(1.0 - font_sdfIntensity, mapMin, 1.0);

    // remap to a smaller range (used on smaller font sizes)
    float sigDistInner = map(mapMin, mapMax, sigDist);
    float sigDistOutline = map(mapMin, mapMax, sigDist + outline_thickness);
    sigDistShdw = map(mapMin, mapMax, sigDistShdw + outline_thickness);

    float center = 0.5;
    // calculate smoothing and use to generate opacity
    float inside = smoothstep(center-smoothing, center+smoothing, sigDistInner);
    float outline = smoothstep(center-smoothing, center+smoothing, sigDistOutline);
    float shadow = smoothstep(center-smoothing, center+smoothing, sigDistShdw);

    vec4 tcolor = (outline > inside) ? outline * vec4(outline_color.a * outline_color.rgb, outline_color.a) : vec4(0.0);
    tcolor = mix(tcolor, color, inside);

    vec4 scolor = (shadow > outline) ? shadow * vec4(shadow_color.a * shadow_color.rgb, shadow_color.a) : tcolor;
    tcolor = mix(scolor, tcolor, outline);
    
    return tcolor;
}
`;

export { msdfPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXNkZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jb21tb24vZnJhZy9tc2RmLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX21zZGZNYXA7XG5cbiNpZmRlZiBHTF9PRVNfc3RhbmRhcmRfZGVyaXZhdGl2ZXNcbiNkZWZpbmUgVVNFX0ZXSURUSFxuI2VuZGlmXG5cbiNpZmRlZiBHTDJcbiNkZWZpbmUgVVNFX0ZXSURUSFxuI2VuZGlmXG5cbmZsb2F0IG1lZGlhbihmbG9hdCByLCBmbG9hdCBnLCBmbG9hdCBiKSB7XG4gICAgcmV0dXJuIG1heChtaW4ociwgZyksIG1pbihtYXgociwgZyksIGIpKTtcbn1cblxuZmxvYXQgbWFwIChmbG9hdCBtaW4sIGZsb2F0IG1heCwgZmxvYXQgdikge1xuICAgIHJldHVybiAodiAtIG1pbikgLyAobWF4IC0gbWluKTtcbn1cblxudW5pZm9ybSBmbG9hdCBmb250X3NkZkludGVuc2l0eTsgLy8gaW50ZW5zaXR5IGlzIHVzZWQgdG8gYm9vc3QgdGhlIHZhbHVlIHJlYWQgZnJvbSB0aGUgU0RGLCAwIGlzIG5vIGJvb3N0LCAxLjAgaXMgbWF4IGJvb3N0XG51bmlmb3JtIGZsb2F0IGZvbnRfcHhyYW5nZTsgICAgICAvLyB0aGUgbnVtYmVyIG9mIHBpeGVscyBiZXR3ZWVuIGluc2lkZSBhbmQgb3V0c2lkZSB0aGUgZm9udCBpbiBTREZcbnVuaWZvcm0gZmxvYXQgZm9udF90ZXh0dXJlV2lkdGg7IC8vIHRoZSB3aWR0aCBvZiB0aGUgdGV4dHVyZSBhdGxhc1xuXG4jaWZkZWYgVU5JRk9STV9URVhUX1BBUkFNRVRFUlNcbnVuaWZvcm0gdmVjNCBvdXRsaW5lX2NvbG9yO1xudW5pZm9ybSBmbG9hdCBvdXRsaW5lX3RoaWNrbmVzcztcbnVuaWZvcm0gdmVjNCBzaGFkb3dfY29sb3I7XG51bmlmb3JtIHZlYzIgc2hhZG93X29mZnNldDtcbiNlbHNlXG52YXJ5aW5nIHZlYzQgb3V0bGluZV9jb2xvcjtcbnZhcnlpbmcgZmxvYXQgb3V0bGluZV90aGlja25lc3M7XG52YXJ5aW5nIHZlYzQgc2hhZG93X2NvbG9yO1xudmFyeWluZyB2ZWMyIHNoYWRvd19vZmZzZXQ7XG4jZW5kaWZcblxudmVjNCBhcHBseU1zZGYodmVjNCBjb2xvcikge1xuICAgIC8vIHNhbXBsZSB0aGUgZmllbGRcbiAgICB2ZWMzIHRzYW1wbGUgPSB0ZXh0dXJlMkQodGV4dHVyZV9tc2RmTWFwLCB2VXYwKS5yZ2I7XG4gICAgdmVjMiB1dlNoZHcgPSB2VXYwIC0gc2hhZG93X29mZnNldDtcbiAgICB2ZWMzIHNzYW1wbGUgPSB0ZXh0dXJlMkQodGV4dHVyZV9tc2RmTWFwLCB1dlNoZHcpLnJnYjtcbiAgICAvLyBnZXQgdGhlIHNpZ25lZCBkaXN0YW5jZSB2YWx1ZVxuICAgIGZsb2F0IHNpZ0Rpc3QgPSBtZWRpYW4odHNhbXBsZS5yLCB0c2FtcGxlLmcsIHRzYW1wbGUuYik7XG4gICAgZmxvYXQgc2lnRGlzdFNoZHcgPSBtZWRpYW4oc3NhbXBsZS5yLCBzc2FtcGxlLmcsIHNzYW1wbGUuYik7XG5cbiAgICAvLyBzbW9vdGhpbmcgbGltaXQgLSBzbWFsbGVyIHZhbHVlIG1ha2VzIGZvciBzaGFycGVyIGJ1dCBtb3JlIGFsaWFzZWQgdGV4dCwgZXNwZWNpYWxseSBvbiBhbmdsZXNcbiAgICAvLyB0b28gbGFyZ2UgdmFsdWUgKDAuNSkgY3JlYXRlcyBhIGRhcmsgZ2xvdyBhcm91bmQgdGhlIGxldHRlcnNcbiAgICBmbG9hdCBzbW9vdGhpbmdNYXggPSAwLjI7XG5cbiAgICAjaWZkZWYgVVNFX0ZXSURUSFxuICAgIC8vIHNtb290aGluZyBkZXBlbmRzIG9uIHNpemUgb2YgdGV4dHVyZSBvbiBzY3JlZW5cbiAgICB2ZWMyIHcgPSBmd2lkdGgodlV2MCk7XG4gICAgZmxvYXQgc21vb3RoaW5nID0gY2xhbXAody54ICogZm9udF90ZXh0dXJlV2lkdGggLyBmb250X3B4cmFuZ2UsIDAuMCwgc21vb3RoaW5nTWF4KTtcbiAgICAjZWxzZVxuICAgIGZsb2F0IGZvbnRfc2l6ZSA9IDE2LjA7IC8vIFRPRE8gZml4IHRoaXNcbiAgICAvLyBzbW9vdGhpbmcgZ2V0cyBzbWFsbGVyIGFzIHRoZSBmb250IHNpemUgZ2V0cyBiaWdnZXJcbiAgICAvLyBkb24ndCBoYXZlIGZ3aWR0aCB3ZSBjYW4gYXBwcm94aW1hdGUgZnJvbSBmb250IHNpemUsIHRoaXMgZG9lc24ndCBhY2NvdW50IGZvciBzY2FsaW5nXG4gICAgLy8gc28gYSBiaWcgZm9udCBzY2FsZWQgZG93biB3aWxsIGJlIHdyb25nLi4uXG4gICAgZmxvYXQgc21vb3RoaW5nID0gY2xhbXAoZm9udF9weHJhbmdlIC8gZm9udF9zaXplLCAwLjAsIHNtb290aGluZ01heCk7XG4gICAgI2VuZGlmXG5cbiAgICBmbG9hdCBtYXBNaW4gPSAwLjA1O1xuICAgIGZsb2F0IG1hcE1heCA9IGNsYW1wKDEuMCAtIGZvbnRfc2RmSW50ZW5zaXR5LCBtYXBNaW4sIDEuMCk7XG5cbiAgICAvLyByZW1hcCB0byBhIHNtYWxsZXIgcmFuZ2UgKHVzZWQgb24gc21hbGxlciBmb250IHNpemVzKVxuICAgIGZsb2F0IHNpZ0Rpc3RJbm5lciA9IG1hcChtYXBNaW4sIG1hcE1heCwgc2lnRGlzdCk7XG4gICAgZmxvYXQgc2lnRGlzdE91dGxpbmUgPSBtYXAobWFwTWluLCBtYXBNYXgsIHNpZ0Rpc3QgKyBvdXRsaW5lX3RoaWNrbmVzcyk7XG4gICAgc2lnRGlzdFNoZHcgPSBtYXAobWFwTWluLCBtYXBNYXgsIHNpZ0Rpc3RTaGR3ICsgb3V0bGluZV90aGlja25lc3MpO1xuXG4gICAgZmxvYXQgY2VudGVyID0gMC41O1xuICAgIC8vIGNhbGN1bGF0ZSBzbW9vdGhpbmcgYW5kIHVzZSB0byBnZW5lcmF0ZSBvcGFjaXR5XG4gICAgZmxvYXQgaW5zaWRlID0gc21vb3Roc3RlcChjZW50ZXItc21vb3RoaW5nLCBjZW50ZXIrc21vb3RoaW5nLCBzaWdEaXN0SW5uZXIpO1xuICAgIGZsb2F0IG91dGxpbmUgPSBzbW9vdGhzdGVwKGNlbnRlci1zbW9vdGhpbmcsIGNlbnRlcitzbW9vdGhpbmcsIHNpZ0Rpc3RPdXRsaW5lKTtcbiAgICBmbG9hdCBzaGFkb3cgPSBzbW9vdGhzdGVwKGNlbnRlci1zbW9vdGhpbmcsIGNlbnRlcitzbW9vdGhpbmcsIHNpZ0Rpc3RTaGR3KTtcblxuICAgIHZlYzQgdGNvbG9yID0gKG91dGxpbmUgPiBpbnNpZGUpID8gb3V0bGluZSAqIHZlYzQob3V0bGluZV9jb2xvci5hICogb3V0bGluZV9jb2xvci5yZ2IsIG91dGxpbmVfY29sb3IuYSkgOiB2ZWM0KDAuMCk7XG4gICAgdGNvbG9yID0gbWl4KHRjb2xvciwgY29sb3IsIGluc2lkZSk7XG5cbiAgICB2ZWM0IHNjb2xvciA9IChzaGFkb3cgPiBvdXRsaW5lKSA/IHNoYWRvdyAqIHZlYzQoc2hhZG93X2NvbG9yLmEgKiBzaGFkb3dfY29sb3IucmdiLCBzaGFkb3dfY29sb3IuYSkgOiB0Y29sb3I7XG4gICAgdGNvbG9yID0gbWl4KHNjb2xvciwgdGNvbG9yLCBvdXRsaW5lKTtcbiAgICBcbiAgICByZXR1cm4gdGNvbG9yO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGFBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FsRkE7Ozs7In0=
