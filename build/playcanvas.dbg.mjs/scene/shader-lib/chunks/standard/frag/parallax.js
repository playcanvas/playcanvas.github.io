/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var parallaxPS = /* glsl */`
uniform float material_heightMapFactor;

void getParallax() {
    float parallaxScale = material_heightMapFactor;

    float height = texture2DBias($SAMPLER, $UV, textureBias).$CH;
    height = height * parallaxScale - parallaxScale*0.5;
    vec3 viewDirT = dViewDirW * dTBN;

    viewDirT.z += 0.42;
    dUvOffset = height * (viewDirT.xy / viewDirT.z);
}
`;

export { parallaxPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyYWxsYXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL3BhcmFsbGF4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2hlaWdodE1hcEZhY3Rvcjtcblxudm9pZCBnZXRQYXJhbGxheCgpIHtcbiAgICBmbG9hdCBwYXJhbGxheFNjYWxlID0gbWF0ZXJpYWxfaGVpZ2h0TWFwRmFjdG9yO1xuXG4gICAgZmxvYXQgaGVpZ2h0ID0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgIGhlaWdodCA9IGhlaWdodCAqIHBhcmFsbGF4U2NhbGUgLSBwYXJhbGxheFNjYWxlKjAuNTtcbiAgICB2ZWMzIHZpZXdEaXJUID0gZFZpZXdEaXJXICogZFRCTjtcblxuICAgIHZpZXdEaXJULnogKz0gMC40MjtcbiAgICBkVXZPZmZzZXQgPSBoZWlnaHQgKiAodmlld0RpclQueHkgLyB2aWV3RGlyVC56KTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxpQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
