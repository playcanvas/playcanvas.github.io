/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var diffusePS = /* glsl */`
#ifdef MAPCOLOR
uniform vec3 material_diffuse;
#endif

void getAlbedo() {
    dAlbedo = vec3(1.0);

#ifdef MAPCOLOR
    dAlbedo *= material_diffuse.rgb;
#endif

#ifdef MAPTEXTURE
    vec3 albedoBase = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    dAlbedo *= addAlbedoDetail(albedoBase);
#endif

#ifdef MAPVERTEX
    dAlbedo *= gammaCorrectInput(saturate(vVertexColor.$VC));
#endif
}
`;

export { diffusePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZnVzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvZGlmZnVzZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE1BUENPTE9SXG51bmlmb3JtIHZlYzMgbWF0ZXJpYWxfZGlmZnVzZTtcbiNlbmRpZlxuXG52b2lkIGdldEFsYmVkbygpIHtcbiAgICBkQWxiZWRvID0gdmVjMygxLjApO1xuXG4jaWZkZWYgTUFQQ09MT1JcbiAgICBkQWxiZWRvICo9IG1hdGVyaWFsX2RpZmZ1c2UucmdiO1xuI2VuZGlmXG5cbiNpZmRlZiBNQVBURVhUVVJFXG4gICAgdmVjMyBhbGJlZG9CYXNlID0gJERFQ09ERSh0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKSkuJENIO1xuICAgIGRBbGJlZG8gKj0gYWRkQWxiZWRvRGV0YWlsKGFsYmVkb0Jhc2UpO1xuI2VuZGlmXG5cbiNpZmRlZiBNQVBWRVJURVhcbiAgICBkQWxiZWRvICo9IGdhbW1hQ29ycmVjdElucHV0KHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpKTtcbiNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
