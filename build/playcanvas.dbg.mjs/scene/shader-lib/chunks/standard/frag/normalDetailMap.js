var normalDetailMapPS = /* glsl */`
#ifdef MAPTEXTURE
uniform float material_normalDetailMapBumpiness;

vec3 blendNormals(vec3 n1, vec3 n2) {
    // https://blog.selfshadow.com/publications/blending-in-detail/#detail-oriented
    n1 += vec3(0, 0, 1);
    n2 *= vec3(-1, -1, 1);
    return n1 * dot(n1, n2) / n1.z - n2;
}
#endif

vec3 addNormalDetail(vec3 normalMap) {
#ifdef MAPTEXTURE
    vec3 normalDetailMap = unpackNormal(texture2DBias($SAMPLER, $UV, textureBias));
    normalDetailMap = mix(vec3(0.0, 0.0, 1.0), normalDetailMap, material_normalDetailMapBumpiness);
    return blendNormals(normalMap, normalDetailMap);
#else
    return normalMap;
#endif
}
`;

export { normalDetailMapPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsRGV0YWlsTWFwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9ub3JtYWxEZXRhaWxNYXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBURVhUVVJFXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX25vcm1hbERldGFpbE1hcEJ1bXBpbmVzcztcblxudmVjMyBibGVuZE5vcm1hbHModmVjMyBuMSwgdmVjMyBuMikge1xuICAgIC8vIGh0dHBzOi8vYmxvZy5zZWxmc2hhZG93LmNvbS9wdWJsaWNhdGlvbnMvYmxlbmRpbmctaW4tZGV0YWlsLyNkZXRhaWwtb3JpZW50ZWRcbiAgICBuMSArPSB2ZWMzKDAsIDAsIDEpO1xuICAgIG4yICo9IHZlYzMoLTEsIC0xLCAxKTtcbiAgICByZXR1cm4gbjEgKiBkb3QobjEsIG4yKSAvIG4xLnogLSBuMjtcbn1cbiNlbmRpZlxuXG52ZWMzIGFkZE5vcm1hbERldGFpbCh2ZWMzIG5vcm1hbE1hcCkge1xuI2lmZGVmIE1BUFRFWFRVUkVcbiAgICB2ZWMzIG5vcm1hbERldGFpbE1hcCA9IHVucGFja05vcm1hbCh0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKSk7XG4gICAgbm9ybWFsRGV0YWlsTWFwID0gbWl4KHZlYzMoMC4wLCAwLjAsIDEuMCksIG5vcm1hbERldGFpbE1hcCwgbWF0ZXJpYWxfbm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzKTtcbiAgICByZXR1cm4gYmxlbmROb3JtYWxzKG5vcm1hbE1hcCwgbm9ybWFsRGV0YWlsTWFwKTtcbiNlbHNlXG4gICAgcmV0dXJuIG5vcm1hbE1hcDtcbiNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx3QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
