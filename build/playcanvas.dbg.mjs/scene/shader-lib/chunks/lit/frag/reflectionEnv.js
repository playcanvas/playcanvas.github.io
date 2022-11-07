/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkVudi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25FbnYuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZm5kZWYgRU5WX0FUTEFTXG4jZGVmaW5lIEVOVl9BVExBU1xudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9lbnZBdGxhcztcbiNlbmRpZlxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbi8vIGNhbGN1bGF0ZSBtaXAgbGV2ZWwgZm9yIHNoaW55IHJlZmxlY3Rpb24gZ2l2ZW4gZXF1aXJlY3QgY29vcmRzIHV2LlxuZmxvYXQgc2hpbnlNaXBMZXZlbCh2ZWMyIHV2KSB7XG4gICAgdmVjMiBkeCA9IGRGZHgodXYpO1xuICAgIHZlYzIgZHkgPSBkRmR5KHV2KTtcblxuICAgIC8vIGNhbGN1bGF0ZSBzZWNvbmQgZEYgYXQgMTgwIGRlZ3JlZXNcbiAgICB2ZWMyIHV2MiA9IHZlYzIoZnJhY3QodXYueCArIDAuNSksIHV2LnkpO1xuICAgIHZlYzIgZHgyID0gZEZkeCh1djIpO1xuICAgIHZlYzIgZHkyID0gZEZkeSh1djIpO1xuXG4gICAgLy8gY2FsY3VsYXRlIG1pbiBvZiBib3RoIHNldHMgb2YgZEYgdG8gaGFuZGxlIGRpc2NvbnRpbnVpdHkgYXQgdGhlIGF6aW0gZWRnZVxuICAgIGZsb2F0IG1heGQgPSBtaW4obWF4KGRvdChkeCwgZHgpLCBkb3QoZHksIGR5KSksIG1heChkb3QoZHgyLCBkeDIpLCBkb3QoZHkyLCBkeTIpKSk7XG5cbiAgICByZXR1cm4gY2xhbXAoMC41ICogbG9nMihtYXhkKSAtIDEuMCArIHRleHR1cmVCaWFzLCAwLjAsIDUuMCk7XG59XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyB0UmVmbERpclcsIGZsb2F0IHRHbG9zc2luZXNzKSB7XG4gICAgdmVjMyBkaXIgPSBjdWJlTWFwUHJvamVjdCh0UmVmbERpclcpICogdmVjMygtMS4wLCAxLjAsIDEuMCk7XG4gICAgdmVjMiB1diA9IHRvU3BoZXJpY2FsVXYoZGlyKTtcblxuICAgIC8vIGNhbGN1bGF0ZSByb3VnaG5lc3MgbGV2ZWxcbiAgICBmbG9hdCBsZXZlbCA9IHNhdHVyYXRlKDEuMCAtIHRHbG9zc2luZXNzKSAqIDUuMDtcbiAgICBmbG9hdCBpbGV2ZWwgPSBmbG9vcihsZXZlbCk7XG5cbiAgICAvLyBhY2Nlc3NpbmcgdGhlIHNoaW55ICh0b3AgbGV2ZWwpIHJlZmxlY3Rpb24gLSBwZXJmb3JtIG1hbnVhbCBtaXBtYXAgbG9va3VwXG4gICAgZmxvYXQgbGV2ZWwyID0gc2hpbnlNaXBMZXZlbCh1diAqIGF0bGFzU2l6ZSk7XG4gICAgZmxvYXQgaWxldmVsMiA9IGZsb29yKGxldmVsMik7XG5cbiAgICB2ZWMyIHV2MCwgdXYxO1xuICAgIGZsb2F0IHdlaWdodDtcbiAgICBpZiAoaWxldmVsID09IDAuMCkge1xuICAgICAgICB1djAgPSBtYXBTaGlueVV2KHV2LCBpbGV2ZWwyKTtcbiAgICAgICAgdXYxID0gbWFwU2hpbnlVdih1diwgaWxldmVsMiArIDEuMCk7XG4gICAgICAgIHdlaWdodCA9IGxldmVsMiAtIGlsZXZlbDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gYWNjZXNzaW5nIHJvdWdoIHJlZmxlY3Rpb24gLSBqdXN0IHNhbXBsZSB0aGUgc2FtZSBwYXJ0IHR3aWNlXG4gICAgICAgIHV2MCA9IHV2MSA9IG1hcFJvdWdobmVzc1V2KHV2LCBpbGV2ZWwpO1xuICAgICAgICB3ZWlnaHQgPSAwLjA7XG4gICAgfVxuXG4gICAgdmVjMyBsaW5lYXJBID0gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9lbnZBdGxhcywgdXYwKSk7XG4gICAgdmVjMyBsaW5lYXJCID0gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9lbnZBdGxhcywgdXYxKSk7XG4gICAgdmVjMyBsaW5lYXIwID0gbWl4KGxpbmVhckEsIGxpbmVhckIsIHdlaWdodCk7XG4gICAgdmVjMyBsaW5lYXIxID0gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9lbnZBdGxhcywgbWFwUm91Z2huZXNzVXYodXYsIGlsZXZlbCArIDEuMCkpKTtcblxuICAgIHJldHVybiBwcm9jZXNzRW52aXJvbm1lbnQobWl4KGxpbmVhcjAsIGxpbmVhcjEsIGxldmVsIC0gaWxldmVsKSk7XG59XG5cbnZvaWQgYWRkUmVmbGVjdGlvbigpIHsgICBcbiAgICBkUmVmbGVjdGlvbiArPSB2ZWM0KGNhbGNSZWZsZWN0aW9uKGRSZWZsRGlyVywgZEdsb3NzaW5lc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
