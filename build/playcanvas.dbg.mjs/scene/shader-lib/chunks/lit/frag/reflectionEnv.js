var reflectionEnvPS = /* glsl */`
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

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 dir = cubeMapProject(reflDir) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    // calculate roughness level
    float level = saturate(1.0 - gloss) * 5.0;
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

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;

export { reflectionEnvPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkVudi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25FbnYuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZm5kZWYgRU5WX0FUTEFTXG4jZGVmaW5lIEVOVl9BVExBU1xudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9lbnZBdGxhcztcbiNlbmRpZlxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbi8vIGNhbGN1bGF0ZSBtaXAgbGV2ZWwgZm9yIHNoaW55IHJlZmxlY3Rpb24gZ2l2ZW4gZXF1aXJlY3QgY29vcmRzIHV2LlxuZmxvYXQgc2hpbnlNaXBMZXZlbCh2ZWMyIHV2KSB7XG4gICAgdmVjMiBkeCA9IGRGZHgodXYpO1xuICAgIHZlYzIgZHkgPSBkRmR5KHV2KTtcblxuICAgIC8vIGNhbGN1bGF0ZSBzZWNvbmQgZEYgYXQgMTgwIGRlZ3JlZXNcbiAgICB2ZWMyIHV2MiA9IHZlYzIoZnJhY3QodXYueCArIDAuNSksIHV2LnkpO1xuICAgIHZlYzIgZHgyID0gZEZkeCh1djIpO1xuICAgIHZlYzIgZHkyID0gZEZkeSh1djIpO1xuXG4gICAgLy8gY2FsY3VsYXRlIG1pbiBvZiBib3RoIHNldHMgb2YgZEYgdG8gaGFuZGxlIGRpc2NvbnRpbnVpdHkgYXQgdGhlIGF6aW0gZWRnZVxuICAgIGZsb2F0IG1heGQgPSBtaW4obWF4KGRvdChkeCwgZHgpLCBkb3QoZHksIGR5KSksIG1heChkb3QoZHgyLCBkeDIpLCBkb3QoZHkyLCBkeTIpKSk7XG5cbiAgICByZXR1cm4gY2xhbXAoMC41ICogbG9nMihtYXhkKSAtIDEuMCArIHRleHR1cmVCaWFzLCAwLjAsIDUuMCk7XG59XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykge1xuICAgIHZlYzMgZGlyID0gY3ViZU1hcFByb2plY3QocmVmbERpcikgKiB2ZWMzKC0xLjAsIDEuMCwgMS4wKTtcbiAgICB2ZWMyIHV2ID0gdG9TcGhlcmljYWxVdihkaXIpO1xuXG4gICAgLy8gY2FsY3VsYXRlIHJvdWdobmVzcyBsZXZlbFxuICAgIGZsb2F0IGxldmVsID0gc2F0dXJhdGUoMS4wIC0gZ2xvc3MpICogNS4wO1xuICAgIGZsb2F0IGlsZXZlbCA9IGZsb29yKGxldmVsKTtcblxuICAgIC8vIGFjY2Vzc2luZyB0aGUgc2hpbnkgKHRvcCBsZXZlbCkgcmVmbGVjdGlvbiAtIHBlcmZvcm0gbWFudWFsIG1pcG1hcCBsb29rdXBcbiAgICBmbG9hdCBsZXZlbDIgPSBzaGlueU1pcExldmVsKHV2ICogYXRsYXNTaXplKTtcbiAgICBmbG9hdCBpbGV2ZWwyID0gZmxvb3IobGV2ZWwyKTtcblxuICAgIHZlYzIgdXYwLCB1djE7XG4gICAgZmxvYXQgd2VpZ2h0O1xuICAgIGlmIChpbGV2ZWwgPT0gMC4wKSB7XG4gICAgICAgIHV2MCA9IG1hcFNoaW55VXYodXYsIGlsZXZlbDIpO1xuICAgICAgICB1djEgPSBtYXBTaGlueVV2KHV2LCBpbGV2ZWwyICsgMS4wKTtcbiAgICAgICAgd2VpZ2h0ID0gbGV2ZWwyIC0gaWxldmVsMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhY2Nlc3Npbmcgcm91Z2ggcmVmbGVjdGlvbiAtIGp1c3Qgc2FtcGxlIHRoZSBzYW1lIHBhcnQgdHdpY2VcbiAgICAgICAgdXYwID0gdXYxID0gbWFwUm91Z2huZXNzVXYodXYsIGlsZXZlbCk7XG4gICAgICAgIHdlaWdodCA9IDAuMDtcbiAgICB9XG5cbiAgICB2ZWMzIGxpbmVhckEgPSAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX2VudkF0bGFzLCB1djApKTtcbiAgICB2ZWMzIGxpbmVhckIgPSAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX2VudkF0bGFzLCB1djEpKTtcbiAgICB2ZWMzIGxpbmVhcjAgPSBtaXgobGluZWFyQSwgbGluZWFyQiwgd2VpZ2h0KTtcbiAgICB2ZWMzIGxpbmVhcjEgPSAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX2VudkF0bGFzLCBtYXBSb3VnaG5lc3NVdih1diwgaWxldmVsICsgMS4wKSkpO1xuXG4gICAgcmV0dXJuIHByb2Nlc3NFbnZpcm9ubWVudChtaXgobGluZWFyMCwgbGluZWFyMSwgbGV2ZWwgLSBpbGV2ZWwpKTtcbn1cblxudm9pZCBhZGRSZWZsZWN0aW9uKHZlYzMgcmVmbERpciwgZmxvYXQgZ2xvc3MpIHsgICBcbiAgICBkUmVmbGVjdGlvbiArPSB2ZWM0KGNhbGNSZWZsZWN0aW9uKHJlZmxEaXIsIGdsb3NzKSwgbWF0ZXJpYWxfcmVmbGVjdGl2aXR5KTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsc0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
