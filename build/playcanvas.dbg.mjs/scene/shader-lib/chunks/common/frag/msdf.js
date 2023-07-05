var msdfPS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXNkZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL21zZGYuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfbXNkZk1hcDtcblxuI2lmZGVmIEdMX09FU19zdGFuZGFyZF9kZXJpdmF0aXZlc1xuI2RlZmluZSBVU0VfRldJRFRIXG4jZW5kaWZcblxuI2lmZGVmIEdMMlxuI2RlZmluZSBVU0VfRldJRFRIXG4jZW5kaWZcblxuZmxvYXQgbWVkaWFuKGZsb2F0IHIsIGZsb2F0IGcsIGZsb2F0IGIpIHtcbiAgICByZXR1cm4gbWF4KG1pbihyLCBnKSwgbWluKG1heChyLCBnKSwgYikpO1xufVxuXG5mbG9hdCBtYXAgKGZsb2F0IG1pbiwgZmxvYXQgbWF4LCBmbG9hdCB2KSB7XG4gICAgcmV0dXJuICh2IC0gbWluKSAvIChtYXggLSBtaW4pO1xufVxuXG51bmlmb3JtIGZsb2F0IGZvbnRfc2RmSW50ZW5zaXR5OyAvLyBpbnRlbnNpdHkgaXMgdXNlZCB0byBib29zdCB0aGUgdmFsdWUgcmVhZCBmcm9tIHRoZSBTREYsIDAgaXMgbm8gYm9vc3QsIDEuMCBpcyBtYXggYm9vc3RcbnVuaWZvcm0gZmxvYXQgZm9udF9weHJhbmdlOyAgICAgIC8vIHRoZSBudW1iZXIgb2YgcGl4ZWxzIGJldHdlZW4gaW5zaWRlIGFuZCBvdXRzaWRlIHRoZSBmb250IGluIFNERlxudW5pZm9ybSBmbG9hdCBmb250X3RleHR1cmVXaWR0aDsgLy8gdGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGF0bGFzXG5cbiNpZmRlZiBVTklGT1JNX1RFWFRfUEFSQU1FVEVSU1xudW5pZm9ybSB2ZWM0IG91dGxpbmVfY29sb3I7XG51bmlmb3JtIGZsb2F0IG91dGxpbmVfdGhpY2tuZXNzO1xudW5pZm9ybSB2ZWM0IHNoYWRvd19jb2xvcjtcbnVuaWZvcm0gdmVjMiBzaGFkb3dfb2Zmc2V0O1xuI2Vsc2VcbnZhcnlpbmcgdmVjNCBvdXRsaW5lX2NvbG9yO1xudmFyeWluZyBmbG9hdCBvdXRsaW5lX3RoaWNrbmVzcztcbnZhcnlpbmcgdmVjNCBzaGFkb3dfY29sb3I7XG52YXJ5aW5nIHZlYzIgc2hhZG93X29mZnNldDtcbiNlbmRpZlxuXG52ZWM0IGFwcGx5TXNkZih2ZWM0IGNvbG9yKSB7XG4gICAgLy8gc2FtcGxlIHRoZSBmaWVsZFxuICAgIHZlYzMgdHNhbXBsZSA9IHRleHR1cmUyRCh0ZXh0dXJlX21zZGZNYXAsIHZVdjApLnJnYjtcbiAgICB2ZWMyIHV2U2hkdyA9IHZVdjAgLSBzaGFkb3dfb2Zmc2V0O1xuICAgIHZlYzMgc3NhbXBsZSA9IHRleHR1cmUyRCh0ZXh0dXJlX21zZGZNYXAsIHV2U2hkdykucmdiO1xuICAgIC8vIGdldCB0aGUgc2lnbmVkIGRpc3RhbmNlIHZhbHVlXG4gICAgZmxvYXQgc2lnRGlzdCA9IG1lZGlhbih0c2FtcGxlLnIsIHRzYW1wbGUuZywgdHNhbXBsZS5iKTtcbiAgICBmbG9hdCBzaWdEaXN0U2hkdyA9IG1lZGlhbihzc2FtcGxlLnIsIHNzYW1wbGUuZywgc3NhbXBsZS5iKTtcblxuICAgIC8vIHNtb290aGluZyBsaW1pdCAtIHNtYWxsZXIgdmFsdWUgbWFrZXMgZm9yIHNoYXJwZXIgYnV0IG1vcmUgYWxpYXNlZCB0ZXh0LCBlc3BlY2lhbGx5IG9uIGFuZ2xlc1xuICAgIC8vIHRvbyBsYXJnZSB2YWx1ZSAoMC41KSBjcmVhdGVzIGEgZGFyayBnbG93IGFyb3VuZCB0aGUgbGV0dGVyc1xuICAgIGZsb2F0IHNtb290aGluZ01heCA9IDAuMjtcblxuICAgICNpZmRlZiBVU0VfRldJRFRIXG4gICAgLy8gc21vb3RoaW5nIGRlcGVuZHMgb24gc2l6ZSBvZiB0ZXh0dXJlIG9uIHNjcmVlblxuICAgIHZlYzIgdyA9IGZ3aWR0aCh2VXYwKTtcbiAgICBmbG9hdCBzbW9vdGhpbmcgPSBjbGFtcCh3LnggKiBmb250X3RleHR1cmVXaWR0aCAvIGZvbnRfcHhyYW5nZSwgMC4wLCBzbW9vdGhpbmdNYXgpO1xuICAgICNlbHNlXG4gICAgZmxvYXQgZm9udF9zaXplID0gMTYuMDsgLy8gVE9ETyBmaXggdGhpc1xuICAgIC8vIHNtb290aGluZyBnZXRzIHNtYWxsZXIgYXMgdGhlIGZvbnQgc2l6ZSBnZXRzIGJpZ2dlclxuICAgIC8vIGRvbid0IGhhdmUgZndpZHRoIHdlIGNhbiBhcHByb3hpbWF0ZSBmcm9tIGZvbnQgc2l6ZSwgdGhpcyBkb2Vzbid0IGFjY291bnQgZm9yIHNjYWxpbmdcbiAgICAvLyBzbyBhIGJpZyBmb250IHNjYWxlZCBkb3duIHdpbGwgYmUgd3JvbmcuLi5cbiAgICBmbG9hdCBzbW9vdGhpbmcgPSBjbGFtcChmb250X3B4cmFuZ2UgLyBmb250X3NpemUsIDAuMCwgc21vb3RoaW5nTWF4KTtcbiAgICAjZW5kaWZcblxuICAgIGZsb2F0IG1hcE1pbiA9IDAuMDU7XG4gICAgZmxvYXQgbWFwTWF4ID0gY2xhbXAoMS4wIC0gZm9udF9zZGZJbnRlbnNpdHksIG1hcE1pbiwgMS4wKTtcblxuICAgIC8vIHJlbWFwIHRvIGEgc21hbGxlciByYW5nZSAodXNlZCBvbiBzbWFsbGVyIGZvbnQgc2l6ZXMpXG4gICAgZmxvYXQgc2lnRGlzdElubmVyID0gbWFwKG1hcE1pbiwgbWFwTWF4LCBzaWdEaXN0KTtcbiAgICBmbG9hdCBzaWdEaXN0T3V0bGluZSA9IG1hcChtYXBNaW4sIG1hcE1heCwgc2lnRGlzdCArIG91dGxpbmVfdGhpY2tuZXNzKTtcbiAgICBzaWdEaXN0U2hkdyA9IG1hcChtYXBNaW4sIG1hcE1heCwgc2lnRGlzdFNoZHcgKyBvdXRsaW5lX3RoaWNrbmVzcyk7XG5cbiAgICBmbG9hdCBjZW50ZXIgPSAwLjU7XG4gICAgLy8gY2FsY3VsYXRlIHNtb290aGluZyBhbmQgdXNlIHRvIGdlbmVyYXRlIG9wYWNpdHlcbiAgICBmbG9hdCBpbnNpZGUgPSBzbW9vdGhzdGVwKGNlbnRlci1zbW9vdGhpbmcsIGNlbnRlcitzbW9vdGhpbmcsIHNpZ0Rpc3RJbm5lcik7XG4gICAgZmxvYXQgb3V0bGluZSA9IHNtb290aHN0ZXAoY2VudGVyLXNtb290aGluZywgY2VudGVyK3Ntb290aGluZywgc2lnRGlzdE91dGxpbmUpO1xuICAgIGZsb2F0IHNoYWRvdyA9IHNtb290aHN0ZXAoY2VudGVyLXNtb290aGluZywgY2VudGVyK3Ntb290aGluZywgc2lnRGlzdFNoZHcpO1xuXG4gICAgdmVjNCB0Y29sb3IgPSAob3V0bGluZSA+IGluc2lkZSkgPyBvdXRsaW5lICogdmVjNChvdXRsaW5lX2NvbG9yLmEgKiBvdXRsaW5lX2NvbG9yLnJnYiwgb3V0bGluZV9jb2xvci5hKSA6IHZlYzQoMC4wKTtcbiAgICB0Y29sb3IgPSBtaXgodGNvbG9yLCBjb2xvciwgaW5zaWRlKTtcblxuICAgIHZlYzQgc2NvbG9yID0gKHNoYWRvdyA+IG91dGxpbmUpID8gc2hhZG93ICogdmVjNChzaGFkb3dfY29sb3IuYSAqIHNoYWRvd19jb2xvci5yZ2IsIHNoYWRvd19jb2xvci5hKSA6IHRjb2xvcjtcbiAgICB0Y29sb3IgPSBtaXgoc2NvbG9yLCB0Y29sb3IsIG91dGxpbmUpO1xuICAgIFxuICAgIHJldHVybiB0Y29sb3I7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGFBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
