/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionEnvPS = `
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif
uniform float material_reflectivity;

// calculate mip level for shiny reflection given equirect coords uv.
float shinyMipLevel(vec2 uv) {
    vec2 dx = dFdx(uv);
    vec2 dy = dFdy(uv);

    // calculate second dF at 180 degrees
    vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
    vec2 dx2 = dFdx(uv2);
    vec2 dy2 = dFdy(uv2);

    // calculate min of both sets of dF to handle discontinuity at the azim edge
    float maxd = min(max(dot(dx, dx), dot(dy, dy)), max(dot(dx2, dx2), dot(dy2, dy2)));

    return clamp(0.5 * log2(maxd) - 1.0 + textureBias, 0.0, 5.0);
}

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 dir = cubeMapProject(tReflDirW) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    // calculate roughness level
    float level = saturate(1.0 - tGlossiness) * 5.0;
    float ilevel = floor(level);

    // accessing the shiny (top level) reflection - perform manual mipmap lookup
    float level2 = shinyMipLevel(uv * atlasSize);
    float ilevel2 = floor(level2);

    vec2 uv0, uv1;
    float weight;
    if (ilevel == 0.0) {
        uv0 = mapShinyUv(uv, ilevel2);
        uv1 = mapShinyUv(uv, ilevel2 + 1.0);
        weight = level2 - ilevel2;
    } else {
        // accessing rough reflection - just sample the same part twice
        uv0 = uv1 = mapRoughnessUv(uv, ilevel);
        weight = 0.0;
    }

    vec3 linearA = $DECODE(texture2D(texture_envAtlas, uv0));
    vec3 linearB = $DECODE(texture2D(texture_envAtlas, uv1));
    vec3 linear0 = mix(linearA, linearB, weight);
    vec3 linear1 = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(linear0, linear1, level - ilevel));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionEnvPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkVudi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9yZWZsZWN0aW9uRW52LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZuZGVmIEVOVl9BVExBU1xuI2RlZmluZSBFTlZfQVRMQVNcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZW52QXRsYXM7XG4jZW5kaWZcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfcmVmbGVjdGl2aXR5O1xuXG4vLyBjYWxjdWxhdGUgbWlwIGxldmVsIGZvciBzaGlueSByZWZsZWN0aW9uIGdpdmVuIGVxdWlyZWN0IGNvb3JkcyB1di5cbmZsb2F0IHNoaW55TWlwTGV2ZWwodmVjMiB1dikge1xuICAgIHZlYzIgZHggPSBkRmR4KHV2KTtcbiAgICB2ZWMyIGR5ID0gZEZkeSh1dik7XG5cbiAgICAvLyBjYWxjdWxhdGUgc2Vjb25kIGRGIGF0IDE4MCBkZWdyZWVzXG4gICAgdmVjMiB1djIgPSB2ZWMyKGZyYWN0KHV2LnggKyAwLjUpLCB1di55KTtcbiAgICB2ZWMyIGR4MiA9IGRGZHgodXYyKTtcbiAgICB2ZWMyIGR5MiA9IGRGZHkodXYyKTtcblxuICAgIC8vIGNhbGN1bGF0ZSBtaW4gb2YgYm90aCBzZXRzIG9mIGRGIHRvIGhhbmRsZSBkaXNjb250aW51aXR5IGF0IHRoZSBhemltIGVkZ2VcbiAgICBmbG9hdCBtYXhkID0gbWluKG1heChkb3QoZHgsIGR4KSwgZG90KGR5LCBkeSkpLCBtYXgoZG90KGR4MiwgZHgyKSwgZG90KGR5MiwgZHkyKSkpO1xuXG4gICAgcmV0dXJuIGNsYW1wKDAuNSAqIGxvZzIobWF4ZCkgLSAxLjAgKyB0ZXh0dXJlQmlhcywgMC4wLCA1LjApO1xufVxuXG52ZWMzIGNhbGNSZWZsZWN0aW9uKHZlYzMgdFJlZmxEaXJXLCBmbG9hdCB0R2xvc3NpbmVzcykge1xuICAgIHZlYzMgZGlyID0gY3ViZU1hcFByb2plY3QodFJlZmxEaXJXKSAqIHZlYzMoLTEuMCwgMS4wLCAxLjApO1xuICAgIHZlYzIgdXYgPSB0b1NwaGVyaWNhbFV2KGRpcik7XG5cbiAgICAvLyBjYWxjdWxhdGUgcm91Z2huZXNzIGxldmVsXG4gICAgZmxvYXQgbGV2ZWwgPSBzYXR1cmF0ZSgxLjAgLSB0R2xvc3NpbmVzcykgKiA1LjA7XG4gICAgZmxvYXQgaWxldmVsID0gZmxvb3IobGV2ZWwpO1xuXG4gICAgLy8gYWNjZXNzaW5nIHRoZSBzaGlueSAodG9wIGxldmVsKSByZWZsZWN0aW9uIC0gcGVyZm9ybSBtYW51YWwgbWlwbWFwIGxvb2t1cFxuICAgIGZsb2F0IGxldmVsMiA9IHNoaW55TWlwTGV2ZWwodXYgKiBhdGxhc1NpemUpO1xuICAgIGZsb2F0IGlsZXZlbDIgPSBmbG9vcihsZXZlbDIpO1xuXG4gICAgdmVjMiB1djAsIHV2MTtcbiAgICBmbG9hdCB3ZWlnaHQ7XG4gICAgaWYgKGlsZXZlbCA9PSAwLjApIHtcbiAgICAgICAgdXYwID0gbWFwU2hpbnlVdih1diwgaWxldmVsMik7XG4gICAgICAgIHV2MSA9IG1hcFNoaW55VXYodXYsIGlsZXZlbDIgKyAxLjApO1xuICAgICAgICB3ZWlnaHQgPSBsZXZlbDIgLSBpbGV2ZWwyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGFjY2Vzc2luZyByb3VnaCByZWZsZWN0aW9uIC0ganVzdCBzYW1wbGUgdGhlIHNhbWUgcGFydCB0d2ljZVxuICAgICAgICB1djAgPSB1djEgPSBtYXBSb3VnaG5lc3NVdih1diwgaWxldmVsKTtcbiAgICAgICAgd2VpZ2h0ID0gMC4wO1xuICAgIH1cblxuICAgIHZlYzMgbGluZWFyQSA9ICRERUNPREUodGV4dHVyZTJEKHRleHR1cmVfZW52QXRsYXMsIHV2MCkpO1xuICAgIHZlYzMgbGluZWFyQiA9ICRERUNPREUodGV4dHVyZTJEKHRleHR1cmVfZW52QXRsYXMsIHV2MSkpO1xuICAgIHZlYzMgbGluZWFyMCA9IG1peChsaW5lYXJBLCBsaW5lYXJCLCB3ZWlnaHQpO1xuICAgIHZlYzMgbGluZWFyMSA9ICRERUNPREUodGV4dHVyZTJEKHRleHR1cmVfZW52QXRsYXMsIG1hcFJvdWdobmVzc1V2KHV2LCBpbGV2ZWwgKyAxLjApKSk7XG5cbiAgICByZXR1cm4gcHJvY2Vzc0Vudmlyb25tZW50KG1peChsaW5lYXIwLCBsaW5lYXIxLCBsZXZlbCAtIGlsZXZlbCkpO1xufVxuXG52b2lkIGFkZFJlZmxlY3Rpb24oKSB7ICAgXG4gICAgZFJlZmxlY3Rpb24gKz0gdmVjNChjYWxjUmVmbGVjdGlvbihkUmVmbERpclcsIGRHbG9zc2luZXNzKSwgbWF0ZXJpYWxfcmVmbGVjdGl2aXR5KTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQTFEQTs7OzsifQ==
