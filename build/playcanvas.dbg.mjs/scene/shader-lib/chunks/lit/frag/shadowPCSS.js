var shadowPCSSPS = /* glsl */`

/**
 * PCSS is a shadow sampling method that provides contact hardening soft shadows. 
 * Based on: 
 * - https://www.gamedev.net/tutorials/programming/graphics/effect-area-light-shadows-part-1-pcss-r4971/
 * - https://github.com/pboechat/PCSS 
 */


#define PCSS_SAMPLE_COUNT 16
uniform float pcssDiskSamples[PCSS_SAMPLE_COUNT];
uniform float pcssSphereSamples[PCSS_SAMPLE_COUNT];

vec2 vogelDisk(int sampleIndex, float count, float phi, float r) {
    const float GoldenAngle = 2.4;
    float theta = float(sampleIndex) * GoldenAngle + phi;

    float sine = sin(theta);
    float cosine = cos(theta);
    return vec2(r * cosine, r * sine);
}

vec3 vogelSphere(int sampleIndex, float count, float phi, float r) {
    const float GoldenAngle = 2.4;
    float theta = float(sampleIndex) * GoldenAngle + phi;

    float weight = float(sampleIndex) / count;
    return vec3(cos(theta) * r, weight, sin(theta) * r);
}

float gradientNoise(vec2 screenPos) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(screenPos, magic.xy)));
}

#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif

float viewSpaceDepth(float depth, mat4 invProjection) {
    float z = depth * 2.0 - 1.0;
    vec4 clipSpace = vec4(0.0, 0.0, z, 1.0);
    vec4 viewSpace = invProjection * clipSpace;
    return viewSpace.z;
}


float PCSSBlockerDistance(TEXTURE_ACCEPT(shadowMap), vec2 sampleCoords[PCSS_SAMPLE_COUNT], vec2 shadowCoords, vec2 searchSize, float z) {

    float blockers = 0.0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec2 offset = sampleCoords[i] * searchSize;
        vec2 sampleUV = shadowCoords + offset;

    #ifdef GL2
        float blocker = textureLod(shadowMap, sampleUV, 0.0).r;
    #else // GL1
        float blocker = unpackFloat(texture2D(shadowMap, sampleUV));
    #endif        
        float isBlocking = step(blocker, z);
        blockers += isBlocking;
        averageBlocker += blocker * isBlocking;
    }

    if (blockers > 0.0)
        return averageBlocker /= blockers;
    return -1.0;
}

float PCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoords, vec4 cameraParams, vec2 shadowSearchArea) {
    float receiverDepth = linearizeDepth(shadowCoords.z, cameraParams);
#ifndef GL2
    // If using packed depth on GL1, we need to normalize to get the correct receiver depth
    receiverDepth *= 1.0 / (cameraParams.y - cameraParams.z);
#endif

    vec2 samplePoints[PCSS_SAMPLE_COUNT];
    float noise = gradientNoise( gl_FragCoord.xy ) * 2.0 * PI;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        float pcssPresample = pcssDiskSamples[i];
        samplePoints[i] = vogelDisk(i, float(PCSS_SAMPLE_COUNT), noise, pcssPresample);
    }

    float averageBlocker = PCSSBlockerDistance(TEXTURE_PASS(shadowMap), samplePoints, shadowCoords.xy, shadowSearchArea, receiverDepth);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        vec2 filterRadius = ((receiverDepth - averageBlocker) / averageBlocker) * shadowSearchArea * cameraParams.x;

        float shadow = 0.0;

        for (int i = 0; i < PCSS_SAMPLE_COUNT; i ++)
        {
            vec2 sampleUV = samplePoints[i] * filterRadius;
            sampleUV = shadowCoords.xy + sampleUV;

        #ifdef GL2
            float depth = textureLod(shadowMap, sampleUV, 0.0).r;
        #else // GL1
            float depth = unpackFloat(texture2D(shadowMap, sampleUV));
        #endif
            shadow += step(receiverDepth, depth);
        }
        return shadow / float(PCSS_SAMPLE_COUNT);
    } 
}

float PCSSCubeBlockerDistance(samplerCube shadowMap, vec3 lightDirNorm, vec3 samplePoints[PCSS_SAMPLE_COUNT], float z, float shadowSearchArea) {
    float blockers = 0.0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec3 sampleDir = lightDirNorm + samplePoints[i] * shadowSearchArea;
        sampleDir = normalize(sampleDir);

    #ifdef GL2
        float blocker = textureCubeLodEXT(shadowMap, sampleDir, 0.0).r;
    #else // GL1
        float blocker = unpackFloat(textureCube(shadowMap, sampleDir));
    #endif
        float isBlocking = step(blocker, z);
        blockers += isBlocking;
        averageBlocker += blocker * isBlocking;
    }

    if (blockers > 0.0)
        return averageBlocker /= float(blockers);
    return -1.0;
}

float PCSSCube(samplerCube shadowMap, vec4 shadowParams, vec3 shadowCoords, vec4 cameraParams, float shadowSearchArea, vec3 lightDir) {
    
    vec3 samplePoints[PCSS_SAMPLE_COUNT];
    float noise = gradientNoise( gl_FragCoord.xy ) * 2.0 * PI;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        float r = pcssSphereSamples[i];
        samplePoints[i] = vogelSphere(i, float(PCSS_SAMPLE_COUNT), noise, r);
    }

    float receiverDepth = length(lightDir) * shadowParams.w + shadowParams.z;
    vec3 lightDirNorm = normalize(lightDir);
    
    float averageBlocker = PCSSCubeBlockerDistance(shadowMap, lightDirNorm, samplePoints, receiverDepth, shadowSearchArea);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        float filterRadius = ((receiverDepth - averageBlocker) / averageBlocker) * shadowSearchArea;

        float shadow = 0.0;
        for (int i = 0; i < PCSS_SAMPLE_COUNT; i++)
        {
            vec3 offset = samplePoints[i] * filterRadius;
            vec3 sampleDir = lightDirNorm + offset;
            sampleDir = normalize(sampleDir);

            #ifdef GL2
                float depth = textureCubeLodEXT(shadowMap, sampleDir, 0.0).r;
            #else // GL1
                float depth = unpackFloat(textureCube(shadowMap, sampleDir));
            #endif
            shadow += step(receiverDepth, depth);
        }
        return shadow / float(PCSS_SAMPLE_COUNT);
    }
}

float getShadowPointPCSS(samplerCube shadowMap, vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec2 shadowSearchArea, vec3 lightDir) {
    return PCSSCube(shadowMap, shadowParams, shadowCoord, cameraParams, shadowSearchArea.x, lightDir);
}

float getShadowSpotPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec2 shadowSearchArea, vec3 lightDir) {
    return PCSS(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, shadowSearchArea);
}

float getShadowPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec2 shadowSearchArea, vec3 lightDir) {
    return PCSS(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, shadowSearchArea);
}

`;

export { shadowPCSSPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93UENTUy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3NoYWRvd1BDU1MuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcblxuLyoqXG4gKiBQQ1NTIGlzIGEgc2hhZG93IHNhbXBsaW5nIG1ldGhvZCB0aGF0IHByb3ZpZGVzIGNvbnRhY3QgaGFyZGVuaW5nIHNvZnQgc2hhZG93cy4gXG4gKiBCYXNlZCBvbjogXG4gKiAtIGh0dHBzOi8vd3d3LmdhbWVkZXYubmV0L3R1dG9yaWFscy9wcm9ncmFtbWluZy9ncmFwaGljcy9lZmZlY3QtYXJlYS1saWdodC1zaGFkb3dzLXBhcnQtMS1wY3NzLXI0OTcxL1xuICogLSBodHRwczovL2dpdGh1Yi5jb20vcGJvZWNoYXQvUENTUyBcbiAqL1xuXG5cbiNkZWZpbmUgUENTU19TQU1QTEVfQ09VTlQgMTZcbnVuaWZvcm0gZmxvYXQgcGNzc0Rpc2tTYW1wbGVzW1BDU1NfU0FNUExFX0NPVU5UXTtcbnVuaWZvcm0gZmxvYXQgcGNzc1NwaGVyZVNhbXBsZXNbUENTU19TQU1QTEVfQ09VTlRdO1xuXG52ZWMyIHZvZ2VsRGlzayhpbnQgc2FtcGxlSW5kZXgsIGZsb2F0IGNvdW50LCBmbG9hdCBwaGksIGZsb2F0IHIpIHtcbiAgICBjb25zdCBmbG9hdCBHb2xkZW5BbmdsZSA9IDIuNDtcbiAgICBmbG9hdCB0aGV0YSA9IGZsb2F0KHNhbXBsZUluZGV4KSAqIEdvbGRlbkFuZ2xlICsgcGhpO1xuXG4gICAgZmxvYXQgc2luZSA9IHNpbih0aGV0YSk7XG4gICAgZmxvYXQgY29zaW5lID0gY29zKHRoZXRhKTtcbiAgICByZXR1cm4gdmVjMihyICogY29zaW5lLCByICogc2luZSk7XG59XG5cbnZlYzMgdm9nZWxTcGhlcmUoaW50IHNhbXBsZUluZGV4LCBmbG9hdCBjb3VudCwgZmxvYXQgcGhpLCBmbG9hdCByKSB7XG4gICAgY29uc3QgZmxvYXQgR29sZGVuQW5nbGUgPSAyLjQ7XG4gICAgZmxvYXQgdGhldGEgPSBmbG9hdChzYW1wbGVJbmRleCkgKiBHb2xkZW5BbmdsZSArIHBoaTtcblxuICAgIGZsb2F0IHdlaWdodCA9IGZsb2F0KHNhbXBsZUluZGV4KSAvIGNvdW50O1xuICAgIHJldHVybiB2ZWMzKGNvcyh0aGV0YSkgKiByLCB3ZWlnaHQsIHNpbih0aGV0YSkgKiByKTtcbn1cblxuZmxvYXQgZ3JhZGllbnROb2lzZSh2ZWMyIHNjcmVlblBvcykge1xuICAgIHZlYzMgbWFnaWMgPSB2ZWMzKDAuMDY3MTEwNTYsIDAuMDA1ODM3MTUsIDUyLjk4MjkxODkpO1xuICAgIHJldHVybiBmcmFjdChtYWdpYy56ICogZnJhY3QoZG90KHNjcmVlblBvcywgbWFnaWMueHkpKSk7XG59XG5cbiNpZm5kZWYgVU5QQUNLRkxPQVRcbiNkZWZpbmUgVU5QQUNLRkxPQVRcbmZsb2F0IHVucGFja0Zsb2F0KHZlYzQgcmdiYURlcHRoKSB7XG4gICAgY29uc3QgdmVjNCBiaXRTaGlmdCA9IHZlYzQoMS4wIC8gKDI1Ni4wICogMjU2LjAgKiAyNTYuMCksIDEuMCAvICgyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gMjU2LjAsIDEuMCk7XG4gICAgcmV0dXJuIGRvdChyZ2JhRGVwdGgsIGJpdFNoaWZ0KTtcbn1cbiNlbmRpZlxuXG5mbG9hdCB2aWV3U3BhY2VEZXB0aChmbG9hdCBkZXB0aCwgbWF0NCBpbnZQcm9qZWN0aW9uKSB7XG4gICAgZmxvYXQgeiA9IGRlcHRoICogMi4wIC0gMS4wO1xuICAgIHZlYzQgY2xpcFNwYWNlID0gdmVjNCgwLjAsIDAuMCwgeiwgMS4wKTtcbiAgICB2ZWM0IHZpZXdTcGFjZSA9IGludlByb2plY3Rpb24gKiBjbGlwU3BhY2U7XG4gICAgcmV0dXJuIHZpZXdTcGFjZS56O1xufVxuXG5cbmZsb2F0IFBDU1NCbG9ja2VyRGlzdGFuY2UoVEVYVFVSRV9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjMiBzYW1wbGVDb29yZHNbUENTU19TQU1QTEVfQ09VTlRdLCB2ZWMyIHNoYWRvd0Nvb3JkcywgdmVjMiBzZWFyY2hTaXplLCBmbG9hdCB6KSB7XG5cbiAgICBmbG9hdCBibG9ja2VycyA9IDAuMDtcbiAgICBmbG9hdCBhdmVyYWdlQmxvY2tlciA9IDAuMDtcbiAgICBmb3IgKGludCBpID0gMDsgaSA8IFBDU1NfU0FNUExFX0NPVU5UOyBpKyspIHtcbiAgICAgICAgdmVjMiBvZmZzZXQgPSBzYW1wbGVDb29yZHNbaV0gKiBzZWFyY2hTaXplO1xuICAgICAgICB2ZWMyIHNhbXBsZVVWID0gc2hhZG93Q29vcmRzICsgb2Zmc2V0O1xuXG4gICAgI2lmZGVmIEdMMlxuICAgICAgICBmbG9hdCBibG9ja2VyID0gdGV4dHVyZUxvZChzaGFkb3dNYXAsIHNhbXBsZVVWLCAwLjApLnI7XG4gICAgI2Vsc2UgLy8gR0wxXG4gICAgICAgIGZsb2F0IGJsb2NrZXIgPSB1bnBhY2tGbG9hdCh0ZXh0dXJlMkQoc2hhZG93TWFwLCBzYW1wbGVVVikpO1xuICAgICNlbmRpZiAgICAgICAgXG4gICAgICAgIGZsb2F0IGlzQmxvY2tpbmcgPSBzdGVwKGJsb2NrZXIsIHopO1xuICAgICAgICBibG9ja2VycyArPSBpc0Jsb2NraW5nO1xuICAgICAgICBhdmVyYWdlQmxvY2tlciArPSBibG9ja2VyICogaXNCbG9ja2luZztcbiAgICB9XG5cbiAgICBpZiAoYmxvY2tlcnMgPiAwLjApXG4gICAgICAgIHJldHVybiBhdmVyYWdlQmxvY2tlciAvPSBibG9ja2VycztcbiAgICByZXR1cm4gLTEuMDtcbn1cblxuZmxvYXQgUENTUyhURVhUVVJFX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd0Nvb3JkcywgdmVjNCBjYW1lcmFQYXJhbXMsIHZlYzIgc2hhZG93U2VhcmNoQXJlYSkge1xuICAgIGZsb2F0IHJlY2VpdmVyRGVwdGggPSBsaW5lYXJpemVEZXB0aChzaGFkb3dDb29yZHMueiwgY2FtZXJhUGFyYW1zKTtcbiNpZm5kZWYgR0wyXG4gICAgLy8gSWYgdXNpbmcgcGFja2VkIGRlcHRoIG9uIEdMMSwgd2UgbmVlZCB0byBub3JtYWxpemUgdG8gZ2V0IHRoZSBjb3JyZWN0IHJlY2VpdmVyIGRlcHRoXG4gICAgcmVjZWl2ZXJEZXB0aCAqPSAxLjAgLyAoY2FtZXJhUGFyYW1zLnkgLSBjYW1lcmFQYXJhbXMueik7XG4jZW5kaWZcblxuICAgIHZlYzIgc2FtcGxlUG9pbnRzW1BDU1NfU0FNUExFX0NPVU5UXTtcbiAgICBmbG9hdCBub2lzZSA9IGdyYWRpZW50Tm9pc2UoIGdsX0ZyYWdDb29yZC54eSApICogMi4wICogUEk7XG4gICAgZm9yIChpbnQgaSA9IDA7IGkgPCBQQ1NTX1NBTVBMRV9DT1VOVDsgaSsrKSB7XG4gICAgICAgIGZsb2F0IHBjc3NQcmVzYW1wbGUgPSBwY3NzRGlza1NhbXBsZXNbaV07XG4gICAgICAgIHNhbXBsZVBvaW50c1tpXSA9IHZvZ2VsRGlzayhpLCBmbG9hdChQQ1NTX1NBTVBMRV9DT1VOVCksIG5vaXNlLCBwY3NzUHJlc2FtcGxlKTtcbiAgICB9XG5cbiAgICBmbG9hdCBhdmVyYWdlQmxvY2tlciA9IFBDU1NCbG9ja2VyRGlzdGFuY2UoVEVYVFVSRV9QQVNTKHNoYWRvd01hcCksIHNhbXBsZVBvaW50cywgc2hhZG93Q29vcmRzLnh5LCBzaGFkb3dTZWFyY2hBcmVhLCByZWNlaXZlckRlcHRoKTtcbiAgICBpZiAoYXZlcmFnZUJsb2NrZXIgPT0gLTEuMCkge1xuICAgICAgICByZXR1cm4gMS4wO1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgdmVjMiBmaWx0ZXJSYWRpdXMgPSAoKHJlY2VpdmVyRGVwdGggLSBhdmVyYWdlQmxvY2tlcikgLyBhdmVyYWdlQmxvY2tlcikgKiBzaGFkb3dTZWFyY2hBcmVhICogY2FtZXJhUGFyYW1zLng7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93ID0gMC4wO1xuXG4gICAgICAgIGZvciAoaW50IGkgPSAwOyBpIDwgUENTU19TQU1QTEVfQ09VTlQ7IGkgKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZlYzIgc2FtcGxlVVYgPSBzYW1wbGVQb2ludHNbaV0gKiBmaWx0ZXJSYWRpdXM7XG4gICAgICAgICAgICBzYW1wbGVVViA9IHNoYWRvd0Nvb3Jkcy54eSArIHNhbXBsZVVWO1xuXG4gICAgICAgICNpZmRlZiBHTDJcbiAgICAgICAgICAgIGZsb2F0IGRlcHRoID0gdGV4dHVyZUxvZChzaGFkb3dNYXAsIHNhbXBsZVVWLCAwLjApLnI7XG4gICAgICAgICNlbHNlIC8vIEdMMVxuICAgICAgICAgICAgZmxvYXQgZGVwdGggPSB1bnBhY2tGbG9hdCh0ZXh0dXJlMkQoc2hhZG93TWFwLCBzYW1wbGVVVikpO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgICAgIHNoYWRvdyArPSBzdGVwKHJlY2VpdmVyRGVwdGgsIGRlcHRoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2hhZG93IC8gZmxvYXQoUENTU19TQU1QTEVfQ09VTlQpO1xuICAgIH0gXG59XG5cbmZsb2F0IFBDU1NDdWJlQmxvY2tlckRpc3RhbmNlKHNhbXBsZXJDdWJlIHNoYWRvd01hcCwgdmVjMyBsaWdodERpck5vcm0sIHZlYzMgc2FtcGxlUG9pbnRzW1BDU1NfU0FNUExFX0NPVU5UXSwgZmxvYXQgeiwgZmxvYXQgc2hhZG93U2VhcmNoQXJlYSkge1xuICAgIGZsb2F0IGJsb2NrZXJzID0gMC4wO1xuICAgIGZsb2F0IGF2ZXJhZ2VCbG9ja2VyID0gMC4wO1xuICAgIGZvciAoaW50IGkgPSAwOyBpIDwgUENTU19TQU1QTEVfQ09VTlQ7IGkrKykge1xuICAgICAgICB2ZWMzIHNhbXBsZURpciA9IGxpZ2h0RGlyTm9ybSArIHNhbXBsZVBvaW50c1tpXSAqIHNoYWRvd1NlYXJjaEFyZWE7XG4gICAgICAgIHNhbXBsZURpciA9IG5vcm1hbGl6ZShzYW1wbGVEaXIpO1xuXG4gICAgI2lmZGVmIEdMMlxuICAgICAgICBmbG9hdCBibG9ja2VyID0gdGV4dHVyZUN1YmVMb2RFWFQoc2hhZG93TWFwLCBzYW1wbGVEaXIsIDAuMCkucjtcbiAgICAjZWxzZSAvLyBHTDFcbiAgICAgICAgZmxvYXQgYmxvY2tlciA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgc2FtcGxlRGlyKSk7XG4gICAgI2VuZGlmXG4gICAgICAgIGZsb2F0IGlzQmxvY2tpbmcgPSBzdGVwKGJsb2NrZXIsIHopO1xuICAgICAgICBibG9ja2VycyArPSBpc0Jsb2NraW5nO1xuICAgICAgICBhdmVyYWdlQmxvY2tlciArPSBibG9ja2VyICogaXNCbG9ja2luZztcbiAgICB9XG5cbiAgICBpZiAoYmxvY2tlcnMgPiAwLjApXG4gICAgICAgIHJldHVybiBhdmVyYWdlQmxvY2tlciAvPSBmbG9hdChibG9ja2Vycyk7XG4gICAgcmV0dXJuIC0xLjA7XG59XG5cbmZsb2F0IFBDU1NDdWJlKHNhbXBsZXJDdWJlIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgc2hhZG93Q29vcmRzLCB2ZWM0IGNhbWVyYVBhcmFtcywgZmxvYXQgc2hhZG93U2VhcmNoQXJlYSwgdmVjMyBsaWdodERpcikge1xuICAgIFxuICAgIHZlYzMgc2FtcGxlUG9pbnRzW1BDU1NfU0FNUExFX0NPVU5UXTtcbiAgICBmbG9hdCBub2lzZSA9IGdyYWRpZW50Tm9pc2UoIGdsX0ZyYWdDb29yZC54eSApICogMi4wICogUEk7XG4gICAgZm9yIChpbnQgaSA9IDA7IGkgPCBQQ1NTX1NBTVBMRV9DT1VOVDsgaSsrKSB7XG4gICAgICAgIGZsb2F0IHIgPSBwY3NzU3BoZXJlU2FtcGxlc1tpXTtcbiAgICAgICAgc2FtcGxlUG9pbnRzW2ldID0gdm9nZWxTcGhlcmUoaSwgZmxvYXQoUENTU19TQU1QTEVfQ09VTlQpLCBub2lzZSwgcik7XG4gICAgfVxuXG4gICAgZmxvYXQgcmVjZWl2ZXJEZXB0aCA9IGxlbmd0aChsaWdodERpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgIHZlYzMgbGlnaHREaXJOb3JtID0gbm9ybWFsaXplKGxpZ2h0RGlyKTtcbiAgICBcbiAgICBmbG9hdCBhdmVyYWdlQmxvY2tlciA9IFBDU1NDdWJlQmxvY2tlckRpc3RhbmNlKHNoYWRvd01hcCwgbGlnaHREaXJOb3JtLCBzYW1wbGVQb2ludHMsIHJlY2VpdmVyRGVwdGgsIHNoYWRvd1NlYXJjaEFyZWEpO1xuICAgIGlmIChhdmVyYWdlQmxvY2tlciA9PSAtMS4wKSB7XG4gICAgICAgIHJldHVybiAxLjA7XG4gICAgfSBlbHNlIHtcblxuICAgICAgICBmbG9hdCBmaWx0ZXJSYWRpdXMgPSAoKHJlY2VpdmVyRGVwdGggLSBhdmVyYWdlQmxvY2tlcikgLyBhdmVyYWdlQmxvY2tlcikgKiBzaGFkb3dTZWFyY2hBcmVhO1xuXG4gICAgICAgIGZsb2F0IHNoYWRvdyA9IDAuMDtcbiAgICAgICAgZm9yIChpbnQgaSA9IDA7IGkgPCBQQ1NTX1NBTVBMRV9DT1VOVDsgaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICB2ZWMzIG9mZnNldCA9IHNhbXBsZVBvaW50c1tpXSAqIGZpbHRlclJhZGl1cztcbiAgICAgICAgICAgIHZlYzMgc2FtcGxlRGlyID0gbGlnaHREaXJOb3JtICsgb2Zmc2V0O1xuICAgICAgICAgICAgc2FtcGxlRGlyID0gbm9ybWFsaXplKHNhbXBsZURpcik7XG5cbiAgICAgICAgICAgICNpZmRlZiBHTDJcbiAgICAgICAgICAgICAgICBmbG9hdCBkZXB0aCA9IHRleHR1cmVDdWJlTG9kRVhUKHNoYWRvd01hcCwgc2FtcGxlRGlyLCAwLjApLnI7XG4gICAgICAgICAgICAjZWxzZSAvLyBHTDFcbiAgICAgICAgICAgICAgICBmbG9hdCBkZXB0aCA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgc2FtcGxlRGlyKSk7XG4gICAgICAgICAgICAjZW5kaWZcbiAgICAgICAgICAgIHNoYWRvdyArPSBzdGVwKHJlY2VpdmVyRGVwdGgsIGRlcHRoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2hhZG93IC8gZmxvYXQoUENTU19TQU1QTEVfQ09VTlQpO1xuICAgIH1cbn1cblxuZmxvYXQgZ2V0U2hhZG93UG9pbnRQQ1NTKHNhbXBsZXJDdWJlIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzQgY2FtZXJhUGFyYW1zLCB2ZWMyIHNoYWRvd1NlYXJjaEFyZWEsIHZlYzMgbGlnaHREaXIpIHtcbiAgICByZXR1cm4gUENTU0N1YmUoc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMsIHNoYWRvd0Nvb3JkLCBjYW1lcmFQYXJhbXMsIHNoYWRvd1NlYXJjaEFyZWEueCwgbGlnaHREaXIpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dTcG90UENTUyhURVhUVVJFX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjNCBjYW1lcmFQYXJhbXMsIHZlYzIgc2hhZG93U2VhcmNoQXJlYSwgdmVjMyBsaWdodERpcikge1xuICAgIHJldHVybiBQQ1NTKFRFWFRVUkVfUEFTUyhzaGFkb3dNYXApLCBzaGFkb3dDb29yZCwgY2FtZXJhUGFyYW1zLCBzaGFkb3dTZWFyY2hBcmVhKTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93UENTUyhURVhUVVJFX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjNCBjYW1lcmFQYXJhbXMsIHZlYzIgc2hhZG93U2VhcmNoQXJlYSwgdmVjMyBsaWdodERpcikge1xuICAgIHJldHVybiBQQ1NTKFRFWFRVUkVfUEFTUyhzaGFkb3dNYXApLCBzaGFkb3dDb29yZCwgY2FtZXJhUGFyYW1zLCBzaGFkb3dTZWFyY2hBcmVhKTtcbn1cblxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxtQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
