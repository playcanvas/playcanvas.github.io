var msdfVS = /* glsl */`
attribute vec3 vertex_outlineParameters;
attribute vec3 vertex_shadowParameters;

varying vec4 outline_color;
varying float outline_thickness;
varying vec4 shadow_color;
varying vec2 shadow_offset;

void unpackMsdfParams() {
    vec3 little = mod(vertex_outlineParameters, 256.);
    vec3 big = (vertex_outlineParameters - little) / 256.;

    outline_color.rb = little.xy / 255.;
    outline_color.ga = big.xy / 255.;

    // _outlineThicknessScale === 0.2
    outline_thickness = little.z / 255. * 0.2;

    little = mod(vertex_shadowParameters, 256.);
    big = (vertex_shadowParameters - little) / 256.;

    shadow_color.rb = little.xy / 255.;
    shadow_color.ga = big.xy / 255.;

    // vec2(little.z, big.z) / 127. - 1. remaps shadow offset from [0, 254] to [-1, 1]
    // _shadowOffsetScale === 0.005
    shadow_offset = (vec2(little.z, big.z) / 127. - 1.) * 0.005;
}
`;

export { msdfVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXNkZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi92ZXJ0L21zZGYuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSB2ZWMzIHZlcnRleF9vdXRsaW5lUGFyYW1ldGVycztcbmF0dHJpYnV0ZSB2ZWMzIHZlcnRleF9zaGFkb3dQYXJhbWV0ZXJzO1xuXG52YXJ5aW5nIHZlYzQgb3V0bGluZV9jb2xvcjtcbnZhcnlpbmcgZmxvYXQgb3V0bGluZV90aGlja25lc3M7XG52YXJ5aW5nIHZlYzQgc2hhZG93X2NvbG9yO1xudmFyeWluZyB2ZWMyIHNoYWRvd19vZmZzZXQ7XG5cbnZvaWQgdW5wYWNrTXNkZlBhcmFtcygpIHtcbiAgICB2ZWMzIGxpdHRsZSA9IG1vZCh2ZXJ0ZXhfb3V0bGluZVBhcmFtZXRlcnMsIDI1Ni4pO1xuICAgIHZlYzMgYmlnID0gKHZlcnRleF9vdXRsaW5lUGFyYW1ldGVycyAtIGxpdHRsZSkgLyAyNTYuO1xuXG4gICAgb3V0bGluZV9jb2xvci5yYiA9IGxpdHRsZS54eSAvIDI1NS47XG4gICAgb3V0bGluZV9jb2xvci5nYSA9IGJpZy54eSAvIDI1NS47XG5cbiAgICAvLyBfb3V0bGluZVRoaWNrbmVzc1NjYWxlID09PSAwLjJcbiAgICBvdXRsaW5lX3RoaWNrbmVzcyA9IGxpdHRsZS56IC8gMjU1LiAqIDAuMjtcblxuICAgIGxpdHRsZSA9IG1vZCh2ZXJ0ZXhfc2hhZG93UGFyYW1ldGVycywgMjU2Lik7XG4gICAgYmlnID0gKHZlcnRleF9zaGFkb3dQYXJhbWV0ZXJzIC0gbGl0dGxlKSAvIDI1Ni47XG5cbiAgICBzaGFkb3dfY29sb3IucmIgPSBsaXR0bGUueHkgLyAyNTUuO1xuICAgIHNoYWRvd19jb2xvci5nYSA9IGJpZy54eSAvIDI1NS47XG5cbiAgICAvLyB2ZWMyKGxpdHRsZS56LCBiaWcueikgLyAxMjcuIC0gMS4gcmVtYXBzIHNoYWRvdyBvZmZzZXQgZnJvbSBbMCwgMjU0XSB0byBbLTEsIDFdXG4gICAgLy8gX3NoYWRvd09mZnNldFNjYWxlID09PSAwLjAwNVxuICAgIHNoYWRvd19vZmZzZXQgPSAodmVjMihsaXR0bGUueiwgYmlnLnopIC8gMTI3LiAtIDEuKSAqIDAuMDA1O1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxhQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
