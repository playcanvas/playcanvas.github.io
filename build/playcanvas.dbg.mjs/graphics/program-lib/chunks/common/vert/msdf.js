/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var msdfVS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXNkZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jb21tb24vdmVydC9tc2RmLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjMyB2ZXJ0ZXhfb3V0bGluZVBhcmFtZXRlcnM7XG5hdHRyaWJ1dGUgdmVjMyB2ZXJ0ZXhfc2hhZG93UGFyYW1ldGVycztcblxudmFyeWluZyB2ZWM0IG91dGxpbmVfY29sb3I7XG52YXJ5aW5nIGZsb2F0IG91dGxpbmVfdGhpY2tuZXNzO1xudmFyeWluZyB2ZWM0IHNoYWRvd19jb2xvcjtcbnZhcnlpbmcgdmVjMiBzaGFkb3dfb2Zmc2V0O1xuXG52b2lkIHVucGFja01zZGZQYXJhbXMoKSB7XG4gICAgdmVjMyBsaXR0bGUgPSBtb2QodmVydGV4X291dGxpbmVQYXJhbWV0ZXJzLCAyNTYuKTtcbiAgICB2ZWMzIGJpZyA9ICh2ZXJ0ZXhfb3V0bGluZVBhcmFtZXRlcnMgLSBsaXR0bGUpIC8gMjU2LjtcblxuICAgIG91dGxpbmVfY29sb3IucmIgPSBsaXR0bGUueHkgLyAyNTUuO1xuICAgIG91dGxpbmVfY29sb3IuZ2EgPSBiaWcueHkgLyAyNTUuO1xuXG4gICAgLy8gX291dGxpbmVUaGlja25lc3NTY2FsZSA9PT0gMC4yXG4gICAgb3V0bGluZV90aGlja25lc3MgPSBsaXR0bGUueiAvIDI1NS4gKiAwLjI7XG5cbiAgICBsaXR0bGUgPSBtb2QodmVydGV4X3NoYWRvd1BhcmFtZXRlcnMsIDI1Ni4pO1xuICAgIGJpZyA9ICh2ZXJ0ZXhfc2hhZG93UGFyYW1ldGVycyAtIGxpdHRsZSkgLyAyNTYuO1xuXG4gICAgc2hhZG93X2NvbG9yLnJiID0gbGl0dGxlLnh5IC8gMjU1LjtcbiAgICBzaGFkb3dfY29sb3IuZ2EgPSBiaWcueHkgLyAyNTUuO1xuXG4gICAgLy8gdmVjMihsaXR0bGUueiwgYmlnLnopIC8gMTI3LiAtIDEuIHJlbWFwcyBzaGFkb3cgb2Zmc2V0IGZyb20gWzAsIDI1NF0gdG8gWy0xLCAxXVxuICAgIC8vIF9zaGFkb3dPZmZzZXRTY2FsZSA9PT0gMC4wMDVcbiAgICBzaGFkb3dfb2Zmc2V0ID0gKHZlYzIobGl0dGxlLnosIGJpZy56KSAvIDEyNy4gLSAxLikgKiAwLjAwNTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxhQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0E3QkE7Ozs7In0=
