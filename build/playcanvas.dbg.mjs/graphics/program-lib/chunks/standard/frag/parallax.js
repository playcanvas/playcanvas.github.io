/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var parallaxPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyYWxsYXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9wYXJhbGxheC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9oZWlnaHRNYXBGYWN0b3I7XG5cbnZvaWQgZ2V0UGFyYWxsYXgoKSB7XG4gICAgZmxvYXQgcGFyYWxsYXhTY2FsZSA9IG1hdGVyaWFsX2hlaWdodE1hcEZhY3RvcjtcblxuICAgIGZsb2F0IGhlaWdodCA9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICBoZWlnaHQgPSBoZWlnaHQgKiBwYXJhbGxheFNjYWxlIC0gcGFyYWxsYXhTY2FsZSowLjU7XG4gICAgdmVjMyB2aWV3RGlyVCA9IGRWaWV3RGlyVyAqIGRUQk47XG5cbiAgICB2aWV3RGlyVC56ICs9IDAuNDI7XG4gICAgZFV2T2Zmc2V0ID0gaGVpZ2h0ICogKHZpZXdEaXJULnh5IC8gdmlld0RpclQueik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsaUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FiQTs7OzsifQ==
