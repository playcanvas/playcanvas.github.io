/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import decodePS from './decode.js';
import encodePS from './encode.js';

var reprojectPS = `
// This shader requires the following #DEFINEs:
//
// PROCESS_FUNC - must be one of reproject, prefilter
// DECODE_FUNC - must be one of decodeRGBM, decodeRGBE, decodeGamma or decodeLinear
// ENCODE_FUNC - must be one of encodeRGBM, encodeRGBE, encideGamma or encodeLinear
// SOURCE_FUNC - must be one of sampleCubemap, sampleEquirect, sampleOctahedral
// TARGET_FUNC - must be one of getDirectionCubemap, getDirectionEquirect, getDirectionOctahedral
//
// When filtering:
// NUM_SAMPLES - number of samples
// NUM_SAMPLES_SQRT - sqrt of number of samples
//
// SUPPORTS_TEXLOD - whether supports texlod is supported

varying vec2 vUv0;

// source
uniform sampler2D sourceTex;
uniform samplerCube sourceCube;

// samples
uniform sampler2D samplesTex;
uniform vec2 samplesTexInverseSize;

// params:
// x - target cubemap face 0..6
// y - specular power (when prefiltering)
// z - source cubemap seam scale (0 to disable)
// w - target cubemap size for seam calc (0 to disable)
uniform vec4 params;

// params2:
// x - target image total pixels
// y - source cubemap size
uniform vec2 params2;

float targetFace() { return params.x; }
float specularPower() { return params.y; }
float sourceCubeSeamScale() { return params.z; }
float targetCubeSeamScale() { return params.w; }

float targetTotalPixels() { return params2.x; }
float sourceTotalPixels() { return params2.y; }

float PI = 3.141592653589793;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

${decodePS}
${encodePS}

//-- supported projections

vec3 modifySeams(vec3 dir, float scale) {
    vec3 adir = abs(dir);
    float M = max(max(adir.x, adir.y), adir.z);
    return dir / M * vec3(
        adir.x == M ? 1.0 : scale,
        adir.y == M ? 1.0 : scale,
        adir.z == M ? 1.0 : scale
    );
}

vec2 toSpherical(vec3 dir) {
    return vec2(dir.xz == vec2(0.0) ? 0.0 : atan(dir.x, dir.z), asin(dir.y));
}

vec3 fromSpherical(vec2 uv) {
    return vec3(cos(uv.y) * sin(uv.x),
                sin(uv.y),
                cos(uv.y) * cos(uv.x));
}

vec3 getDirectionEquirect() {
    return fromSpherical((vec2(vUv0.x, 1.0 - vUv0.y) * 2.0 - 1.0) * vec2(PI, PI * 0.5));
}

vec4 sampleEquirect(vec2 sph) {
    vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
    return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
}

vec4 sampleEquirect(vec3 dir) {
    return sampleEquirect(toSpherical(dir));
}

vec4 sampleCubemap(vec3 dir) {
    return textureCube(sourceCube, modifySeams(dir, 1.0 - sourceCubeSeamScale()));
}

vec4 sampleCubemap(vec2 sph) {
    return sampleCubemap(fromSpherical(sph));
}

vec4 sampleEquirect(vec2 sph, float mipLevel) {
    vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
#ifdef SUPPORTS_TEXLOD
    return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
#else
    return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
#endif
}

vec4 sampleEquirect(vec3 dir, float mipLevel) {
    return sampleEquirect(toSpherical(dir), mipLevel);
}

vec4 sampleCubemap(vec3 dir, float mipLevel) {
#ifdef SUPPORTS_TEXLOD
    return textureCubeLodEXT(sourceCube, modifySeams(dir, 1.0 - exp2(mipLevel) * sourceCubeSeamScale()), mipLevel);
#else
    return textureCube(sourceCube, modifySeams(dir, 1.0 - exp2(mipLevel) * sourceCubeSeamScale()));
#endif
}

vec4 sampleCubemap(vec2 sph, float mipLevel) {
    return sampleCubemap(fromSpherical(sph), mipLevel);
}

// octahedral code, based on http://jcgt.org/published/0003/02/01
// "Survey of Efficient Representations for Independent Unit Vectors" by Cigolle, Donow, Evangelakos, Mara, McGuire, Meyer

float signNotZero(float k){
    return(k >= 0.0) ? 1.0 : -1.0;
}

vec2 signNotZero(vec2 v) {
    return vec2(signNotZero(v.x), signNotZero(v.y));
}

// Returns a unit vector. Argument o is an octahedral vector packed via octEncode, on the [-1, +1] square
vec3 octDecode(vec2 o) {
    vec3 v = vec3(o.x, 1.0 - abs(o.x) - abs(o.y), o.y);
    if (v.y < 0.0) {
        v.xz = (1.0 - abs(v.zx)) * signNotZero(v.xz);
    }
    return normalize(v);
}

vec3 getDirectionOctahedral() {
    return octDecode(vec2(vUv0.x, 1.0 - vUv0.y) * 2.0 - 1.0);
}

// Assumes that v is a unit vector. The result is an octahedral vector on the [-1, +1] square
vec2 octEncode(in vec3 v) {
    float l1norm = abs(v.x) + abs(v.y) + abs(v.z);
    vec2 result = v.xz * (1.0 / l1norm);
    if (v.y < 0.0) {
        result = (1.0 - abs(result.yx)) * signNotZero(result.xy);
    }
    return result;
}

vec4 sampleOctahedral(vec3 dir) {
    vec2 uv = octEncode(dir) * 0.5 + 0.5;
    return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
}

vec4 sampleOctahedral(vec2 sph) {
    return sampleOctahedral(fromSpherical(sph));
}

vec4 sampleOctahedral(vec3 dir, float mipLevel) {
    vec2 uv = octEncode(dir) * 0.5 + 0.5;
#ifdef SUPPORTS_TEXLOD
    return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
#else
    return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
#endif
}

vec4 sampleOctahedral(vec2 sph, float mipLevel) {
    return sampleOctahedral(fromSpherical(sph), mipLevel);
}

/////////////////////////////////////////////////////////////////////

vec3 getDirectionCubemap() {
    vec2 st = vUv0 * 2.0 - 1.0;
    float face = targetFace();

    vec3 vec;
    if (face == 0.0) {
        vec = vec3(1, -st.y, -st.x);
    } else if (face == 1.0) {
        vec = vec3(-1, -st.y, st.x);
    } else if (face == 2.0) {
        vec = vec3(st.x, 1, st.y);
    } else if (face == 3.0) {
        vec = vec3(st.x, -1, -st.y);
    } else if (face == 4.0) {
        vec = vec3(st.x, -st.y, 1);
    } else {
        vec = vec3(-st.x, -st.y, -1);
    }

    return normalize(modifySeams(vec, 1.0 / (1.0 - targetCubeSeamScale())));
}

mat3 matrixFromVector(vec3 n) { // frisvad
    float a = 1.0 / (1.0 + n.z);
    float b = -n.x * n.y * a;
    vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);
    vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);
    return mat3(b1, b2, n);
}

mat3 matrixFromVectorSlow(vec3 n) {
    vec3 up = (1.0 - abs(n.y) <= 0.0000001) ? vec3(0.0, 0.0, n.y > 0.0 ? 1.0 : -1.0) : vec3(0.0, 1.0, 0.0);
    vec3 x = normalize(cross(up, n));
    vec3 y = cross(n, x);
    return mat3(x, y, n);
}

vec4 reproject() {
    if (NUM_SAMPLES <= 1) {
        // single sample
        return ENCODE_FUNC(DECODE_FUNC(SOURCE_FUNC(TARGET_FUNC())));
    } else {
        // multi sample
        vec3 t = TARGET_FUNC();
        vec3 tu = dFdx(t);
        vec3 tv = dFdy(t);

        vec3 result = vec3(0.0);
        for (float u = 0.0; u < NUM_SAMPLES_SQRT; ++u) {
            for (float v = 0.0; v < NUM_SAMPLES_SQRT; ++v) {
                result += DECODE_FUNC(SOURCE_FUNC(normalize(t +
                                                            tu * (u / NUM_SAMPLES_SQRT - 0.5) +
                                                            tv * (v / NUM_SAMPLES_SQRT - 0.5))));
            }
        }
        return ENCODE_FUNC(result / (NUM_SAMPLES_SQRT * NUM_SAMPLES_SQRT));
    }
}

vec4 unpackFloat = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0);

void unpackSample(int i, out vec3 L, out float mipLevel) {
    float u = (float(i * 4) + 0.5) * samplesTexInverseSize.x;
    float v = (floor(u) + 0.5) * samplesTexInverseSize.y;

    vec4 raw;
    raw.x = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
    raw.y = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
    raw.z = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat); u += samplesTexInverseSize.x;
    raw.w = dot(texture2D(samplesTex, vec2(u, v)), unpackFloat);

    L.xyz = raw.xyz * 2.0 - 1.0;
    mipLevel = raw.w * 8.0;
}

// convolve an environment given pre-generated samples
vec4 prefilterSamples() {
    // construct vector space given target direction
    mat3 vecSpace = matrixFromVectorSlow(TARGET_FUNC());

    vec3 L;
    float mipLevel;

    vec3 result = vec3(0.0);
    float totalWeight = 0.0;
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        unpackSample(i, L, mipLevel);
        result += DECODE_FUNC(SOURCE_FUNC(vecSpace * L, mipLevel)) * L.z;
        totalWeight += L.z;
    }

    return ENCODE_FUNC(result / totalWeight);
}

// unweighted version of prefilterSamples
vec4 prefilterSamplesUnweighted() {
    // construct vector space given target direction
    mat3 vecSpace = matrixFromVectorSlow(TARGET_FUNC());

    vec3 L;
    float mipLevel;

    vec3 result = vec3(0.0);
    float totalWeight = 0.0;
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        unpackSample(i, L, mipLevel);
        result += DECODE_FUNC(SOURCE_FUNC(vecSpace * L, mipLevel));
    }

    return ENCODE_FUNC(result / float(NUM_SAMPLES));
}

void main(void) {
    gl_FragColor = PROCESS_FUNC();
}
`;

export { reprojectPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL3JlcHJvamVjdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZGVjb2RlIGZyb20gJy4vZGVjb2RlLmpzJztcbmltcG9ydCBlbmNvZGUgZnJvbSAnLi9lbmNvZGUuanMnO1xuXG5leHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gVGhpcyBzaGFkZXIgcmVxdWlyZXMgdGhlIGZvbGxvd2luZyAjREVGSU5Fczpcbi8vXG4vLyBQUk9DRVNTX0ZVTkMgLSBtdXN0IGJlIG9uZSBvZiByZXByb2plY3QsIHByZWZpbHRlclxuLy8gREVDT0RFX0ZVTkMgLSBtdXN0IGJlIG9uZSBvZiBkZWNvZGVSR0JNLCBkZWNvZGVSR0JFLCBkZWNvZGVHYW1tYSBvciBkZWNvZGVMaW5lYXJcbi8vIEVOQ09ERV9GVU5DIC0gbXVzdCBiZSBvbmUgb2YgZW5jb2RlUkdCTSwgZW5jb2RlUkdCRSwgZW5jaWRlR2FtbWEgb3IgZW5jb2RlTGluZWFyXG4vLyBTT1VSQ0VfRlVOQyAtIG11c3QgYmUgb25lIG9mIHNhbXBsZUN1YmVtYXAsIHNhbXBsZUVxdWlyZWN0LCBzYW1wbGVPY3RhaGVkcmFsXG4vLyBUQVJHRVRfRlVOQyAtIG11c3QgYmUgb25lIG9mIGdldERpcmVjdGlvbkN1YmVtYXAsIGdldERpcmVjdGlvbkVxdWlyZWN0LCBnZXREaXJlY3Rpb25PY3RhaGVkcmFsXG4vL1xuLy8gV2hlbiBmaWx0ZXJpbmc6XG4vLyBOVU1fU0FNUExFUyAtIG51bWJlciBvZiBzYW1wbGVzXG4vLyBOVU1fU0FNUExFU19TUVJUIC0gc3FydCBvZiBudW1iZXIgb2Ygc2FtcGxlc1xuLy9cbi8vIFNVUFBPUlRTX1RFWExPRCAtIHdoZXRoZXIgc3VwcG9ydHMgdGV4bG9kIGlzIHN1cHBvcnRlZFxuXG52YXJ5aW5nIHZlYzIgdlV2MDtcblxuLy8gc291cmNlXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2VUZXg7XG51bmlmb3JtIHNhbXBsZXJDdWJlIHNvdXJjZUN1YmU7XG5cbi8vIHNhbXBsZXNcbnVuaWZvcm0gc2FtcGxlcjJEIHNhbXBsZXNUZXg7XG51bmlmb3JtIHZlYzIgc2FtcGxlc1RleEludmVyc2VTaXplO1xuXG4vLyBwYXJhbXM6XG4vLyB4IC0gdGFyZ2V0IGN1YmVtYXAgZmFjZSAwLi42XG4vLyB5IC0gc3BlY3VsYXIgcG93ZXIgKHdoZW4gcHJlZmlsdGVyaW5nKVxuLy8geiAtIHNvdXJjZSBjdWJlbWFwIHNlYW0gc2NhbGUgKDAgdG8gZGlzYWJsZSlcbi8vIHcgLSB0YXJnZXQgY3ViZW1hcCBzaXplIGZvciBzZWFtIGNhbGMgKDAgdG8gZGlzYWJsZSlcbnVuaWZvcm0gdmVjNCBwYXJhbXM7XG5cbi8vIHBhcmFtczI6XG4vLyB4IC0gdGFyZ2V0IGltYWdlIHRvdGFsIHBpeGVsc1xuLy8geSAtIHNvdXJjZSBjdWJlbWFwIHNpemVcbnVuaWZvcm0gdmVjMiBwYXJhbXMyO1xuXG5mbG9hdCB0YXJnZXRGYWNlKCkgeyByZXR1cm4gcGFyYW1zLng7IH1cbmZsb2F0IHNwZWN1bGFyUG93ZXIoKSB7IHJldHVybiBwYXJhbXMueTsgfVxuZmxvYXQgc291cmNlQ3ViZVNlYW1TY2FsZSgpIHsgcmV0dXJuIHBhcmFtcy56OyB9XG5mbG9hdCB0YXJnZXRDdWJlU2VhbVNjYWxlKCkgeyByZXR1cm4gcGFyYW1zLnc7IH1cblxuZmxvYXQgdGFyZ2V0VG90YWxQaXhlbHMoKSB7IHJldHVybiBwYXJhbXMyLng7IH1cbmZsb2F0IHNvdXJjZVRvdGFsUGl4ZWxzKCkgeyByZXR1cm4gcGFyYW1zMi55OyB9XG5cbmZsb2F0IFBJID0gMy4xNDE1OTI2NTM1ODk3OTM7XG5cbmZsb2F0IHNhdHVyYXRlKGZsb2F0IHgpIHtcbiAgICByZXR1cm4gY2xhbXAoeCwgMC4wLCAxLjApO1xufVxuXG4ke2RlY29kZX1cbiR7ZW5jb2RlfVxuXG4vLy0tIHN1cHBvcnRlZCBwcm9qZWN0aW9uc1xuXG52ZWMzIG1vZGlmeVNlYW1zKHZlYzMgZGlyLCBmbG9hdCBzY2FsZSkge1xuICAgIHZlYzMgYWRpciA9IGFicyhkaXIpO1xuICAgIGZsb2F0IE0gPSBtYXgobWF4KGFkaXIueCwgYWRpci55KSwgYWRpci56KTtcbiAgICByZXR1cm4gZGlyIC8gTSAqIHZlYzMoXG4gICAgICAgIGFkaXIueCA9PSBNID8gMS4wIDogc2NhbGUsXG4gICAgICAgIGFkaXIueSA9PSBNID8gMS4wIDogc2NhbGUsXG4gICAgICAgIGFkaXIueiA9PSBNID8gMS4wIDogc2NhbGVcbiAgICApO1xufVxuXG52ZWMyIHRvU3BoZXJpY2FsKHZlYzMgZGlyKSB7XG4gICAgcmV0dXJuIHZlYzIoZGlyLnh6ID09IHZlYzIoMC4wKSA/IDAuMCA6IGF0YW4oZGlyLngsIGRpci56KSwgYXNpbihkaXIueSkpO1xufVxuXG52ZWMzIGZyb21TcGhlcmljYWwodmVjMiB1dikge1xuICAgIHJldHVybiB2ZWMzKGNvcyh1di55KSAqIHNpbih1di54KSxcbiAgICAgICAgICAgICAgICBzaW4odXYueSksXG4gICAgICAgICAgICAgICAgY29zKHV2LnkpICogY29zKHV2LngpKTtcbn1cblxudmVjMyBnZXREaXJlY3Rpb25FcXVpcmVjdCgpIHtcbiAgICByZXR1cm4gZnJvbVNwaGVyaWNhbCgodmVjMih2VXYwLngsIDEuMCAtIHZVdjAueSkgKiAyLjAgLSAxLjApICogdmVjMihQSSwgUEkgKiAwLjUpKTtcbn1cblxudmVjNCBzYW1wbGVFcXVpcmVjdCh2ZWMyIHNwaCkge1xuICAgIHZlYzIgdXYgPSBzcGggLyB2ZWMyKFBJICogMi4wLCBQSSkgKyAwLjU7XG4gICAgcmV0dXJuIHRleHR1cmUyRChzb3VyY2VUZXgsIHZlYzIodXYueCwgMS4wIC0gdXYueSkpO1xufVxuXG52ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzMgZGlyKSB7XG4gICAgcmV0dXJuIHNhbXBsZUVxdWlyZWN0KHRvU3BoZXJpY2FsKGRpcikpO1xufVxuXG52ZWM0IHNhbXBsZUN1YmVtYXAodmVjMyBkaXIpIHtcbiAgICByZXR1cm4gdGV4dHVyZUN1YmUoc291cmNlQ3ViZSwgbW9kaWZ5U2VhbXMoZGlyLCAxLjAgLSBzb3VyY2VDdWJlU2VhbVNjYWxlKCkpKTtcbn1cblxudmVjNCBzYW1wbGVDdWJlbWFwKHZlYzIgc3BoKSB7XG4gICAgcmV0dXJuIHNhbXBsZUN1YmVtYXAoZnJvbVNwaGVyaWNhbChzcGgpKTtcbn1cblxudmVjNCBzYW1wbGVFcXVpcmVjdCh2ZWMyIHNwaCwgZmxvYXQgbWlwTGV2ZWwpIHtcbiAgICB2ZWMyIHV2ID0gc3BoIC8gdmVjMihQSSAqIDIuMCwgUEkpICsgMC41O1xuI2lmZGVmIFNVUFBPUlRTX1RFWExPRFxuICAgIHJldHVybiB0ZXh0dXJlMkRMb2RFWFQoc291cmNlVGV4LCB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpLCBtaXBMZXZlbCk7XG4jZWxzZVxuICAgIHJldHVybiB0ZXh0dXJlMkQoc291cmNlVGV4LCB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpKTtcbiNlbmRpZlxufVxuXG52ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzMgZGlyLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgIHJldHVybiBzYW1wbGVFcXVpcmVjdCh0b1NwaGVyaWNhbChkaXIpLCBtaXBMZXZlbCk7XG59XG5cbnZlYzQgc2FtcGxlQ3ViZW1hcCh2ZWMzIGRpciwgZmxvYXQgbWlwTGV2ZWwpIHtcbiNpZmRlZiBTVVBQT1JUU19URVhMT0RcbiAgICByZXR1cm4gdGV4dHVyZUN1YmVMb2RFWFQoc291cmNlQ3ViZSwgbW9kaWZ5U2VhbXMoZGlyLCAxLjAgLSBleHAyKG1pcExldmVsKSAqIHNvdXJjZUN1YmVTZWFtU2NhbGUoKSksIG1pcExldmVsKTtcbiNlbHNlXG4gICAgcmV0dXJuIHRleHR1cmVDdWJlKHNvdXJjZUN1YmUsIG1vZGlmeVNlYW1zKGRpciwgMS4wIC0gZXhwMihtaXBMZXZlbCkgKiBzb3VyY2VDdWJlU2VhbVNjYWxlKCkpKTtcbiNlbmRpZlxufVxuXG52ZWM0IHNhbXBsZUN1YmVtYXAodmVjMiBzcGgsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgcmV0dXJuIHNhbXBsZUN1YmVtYXAoZnJvbVNwaGVyaWNhbChzcGgpLCBtaXBMZXZlbCk7XG59XG5cbi8vIG9jdGFoZWRyYWwgY29kZSwgYmFzZWQgb24gaHR0cDovL2pjZ3Qub3JnL3B1Ymxpc2hlZC8wMDAzLzAyLzAxXG4vLyBcIlN1cnZleSBvZiBFZmZpY2llbnQgUmVwcmVzZW50YXRpb25zIGZvciBJbmRlcGVuZGVudCBVbml0IFZlY3RvcnNcIiBieSBDaWdvbGxlLCBEb25vdywgRXZhbmdlbGFrb3MsIE1hcmEsIE1jR3VpcmUsIE1leWVyXG5cbmZsb2F0IHNpZ25Ob3RaZXJvKGZsb2F0IGspe1xuICAgIHJldHVybihrID49IDAuMCkgPyAxLjAgOiAtMS4wO1xufVxuXG52ZWMyIHNpZ25Ob3RaZXJvKHZlYzIgdikge1xuICAgIHJldHVybiB2ZWMyKHNpZ25Ob3RaZXJvKHYueCksIHNpZ25Ob3RaZXJvKHYueSkpO1xufVxuXG4vLyBSZXR1cm5zIGEgdW5pdCB2ZWN0b3IuIEFyZ3VtZW50IG8gaXMgYW4gb2N0YWhlZHJhbCB2ZWN0b3IgcGFja2VkIHZpYSBvY3RFbmNvZGUsIG9uIHRoZSBbLTEsICsxXSBzcXVhcmVcbnZlYzMgb2N0RGVjb2RlKHZlYzIgbykge1xuICAgIHZlYzMgdiA9IHZlYzMoby54LCAxLjAgLSBhYnMoby54KSAtIGFicyhvLnkpLCBvLnkpO1xuICAgIGlmICh2LnkgPCAwLjApIHtcbiAgICAgICAgdi54eiA9ICgxLjAgLSBhYnModi56eCkpICogc2lnbk5vdFplcm8odi54eik7XG4gICAgfVxuICAgIHJldHVybiBub3JtYWxpemUodik7XG59XG5cbnZlYzMgZ2V0RGlyZWN0aW9uT2N0YWhlZHJhbCgpIHtcbiAgICByZXR1cm4gb2N0RGVjb2RlKHZlYzIodlV2MC54LCAxLjAgLSB2VXYwLnkpICogMi4wIC0gMS4wKTtcbn1cblxuLy8gQXNzdW1lcyB0aGF0IHYgaXMgYSB1bml0IHZlY3Rvci4gVGhlIHJlc3VsdCBpcyBhbiBvY3RhaGVkcmFsIHZlY3RvciBvbiB0aGUgWy0xLCArMV0gc3F1YXJlXG52ZWMyIG9jdEVuY29kZShpbiB2ZWMzIHYpIHtcbiAgICBmbG9hdCBsMW5vcm0gPSBhYnModi54KSArIGFicyh2LnkpICsgYWJzKHYueik7XG4gICAgdmVjMiByZXN1bHQgPSB2Lnh6ICogKDEuMCAvIGwxbm9ybSk7XG4gICAgaWYgKHYueSA8IDAuMCkge1xuICAgICAgICByZXN1bHQgPSAoMS4wIC0gYWJzKHJlc3VsdC55eCkpICogc2lnbk5vdFplcm8ocmVzdWx0Lnh5KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxudmVjNCBzYW1wbGVPY3RhaGVkcmFsKHZlYzMgZGlyKSB7XG4gICAgdmVjMiB1diA9IG9jdEVuY29kZShkaXIpICogMC41ICsgMC41O1xuICAgIHJldHVybiB0ZXh0dXJlMkQoc291cmNlVGV4LCB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpKTtcbn1cblxudmVjNCBzYW1wbGVPY3RhaGVkcmFsKHZlYzIgc3BoKSB7XG4gICAgcmV0dXJuIHNhbXBsZU9jdGFoZWRyYWwoZnJvbVNwaGVyaWNhbChzcGgpKTtcbn1cblxudmVjNCBzYW1wbGVPY3RhaGVkcmFsKHZlYzMgZGlyLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgIHZlYzIgdXYgPSBvY3RFbmNvZGUoZGlyKSAqIDAuNSArIDAuNTtcbiNpZmRlZiBTVVBQT1JUU19URVhMT0RcbiAgICByZXR1cm4gdGV4dHVyZTJETG9kRVhUKHNvdXJjZVRleCwgdmVjMih1di54LCAxLjAgLSB1di55KSwgbWlwTGV2ZWwpO1xuI2Vsc2VcbiAgICByZXR1cm4gdGV4dHVyZTJEKHNvdXJjZVRleCwgdmVjMih1di54LCAxLjAgLSB1di55KSk7XG4jZW5kaWZcbn1cblxudmVjNCBzYW1wbGVPY3RhaGVkcmFsKHZlYzIgc3BoLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgIHJldHVybiBzYW1wbGVPY3RhaGVkcmFsKGZyb21TcGhlcmljYWwoc3BoKSwgbWlwTGV2ZWwpO1xufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxudmVjMyBnZXREaXJlY3Rpb25DdWJlbWFwKCkge1xuICAgIHZlYzIgc3QgPSB2VXYwICogMi4wIC0gMS4wO1xuICAgIGZsb2F0IGZhY2UgPSB0YXJnZXRGYWNlKCk7XG5cbiAgICB2ZWMzIHZlYztcbiAgICBpZiAoZmFjZSA9PSAwLjApIHtcbiAgICAgICAgdmVjID0gdmVjMygxLCAtc3QueSwgLXN0LngpO1xuICAgIH0gZWxzZSBpZiAoZmFjZSA9PSAxLjApIHtcbiAgICAgICAgdmVjID0gdmVjMygtMSwgLXN0LnksIHN0LngpO1xuICAgIH0gZWxzZSBpZiAoZmFjZSA9PSAyLjApIHtcbiAgICAgICAgdmVjID0gdmVjMyhzdC54LCAxLCBzdC55KTtcbiAgICB9IGVsc2UgaWYgKGZhY2UgPT0gMy4wKSB7XG4gICAgICAgIHZlYyA9IHZlYzMoc3QueCwgLTEsIC1zdC55KTtcbiAgICB9IGVsc2UgaWYgKGZhY2UgPT0gNC4wKSB7XG4gICAgICAgIHZlYyA9IHZlYzMoc3QueCwgLXN0LnksIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZlYyA9IHZlYzMoLXN0LngsIC1zdC55LCAtMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vcm1hbGl6ZShtb2RpZnlTZWFtcyh2ZWMsIDEuMCAvICgxLjAgLSB0YXJnZXRDdWJlU2VhbVNjYWxlKCkpKSk7XG59XG5cbm1hdDMgbWF0cml4RnJvbVZlY3Rvcih2ZWMzIG4pIHsgLy8gZnJpc3ZhZFxuICAgIGZsb2F0IGEgPSAxLjAgLyAoMS4wICsgbi56KTtcbiAgICBmbG9hdCBiID0gLW4ueCAqIG4ueSAqIGE7XG4gICAgdmVjMyBiMSA9IHZlYzMoMS4wIC0gbi54ICogbi54ICogYSwgYiwgLW4ueCk7XG4gICAgdmVjMyBiMiA9IHZlYzMoYiwgMS4wIC0gbi55ICogbi55ICogYSwgLW4ueSk7XG4gICAgcmV0dXJuIG1hdDMoYjEsIGIyLCBuKTtcbn1cblxubWF0MyBtYXRyaXhGcm9tVmVjdG9yU2xvdyh2ZWMzIG4pIHtcbiAgICB2ZWMzIHVwID0gKDEuMCAtIGFicyhuLnkpIDw9IDAuMDAwMDAwMSkgPyB2ZWMzKDAuMCwgMC4wLCBuLnkgPiAwLjAgPyAxLjAgOiAtMS4wKSA6IHZlYzMoMC4wLCAxLjAsIDAuMCk7XG4gICAgdmVjMyB4ID0gbm9ybWFsaXplKGNyb3NzKHVwLCBuKSk7XG4gICAgdmVjMyB5ID0gY3Jvc3MobiwgeCk7XG4gICAgcmV0dXJuIG1hdDMoeCwgeSwgbik7XG59XG5cbnZlYzQgcmVwcm9qZWN0KCkge1xuICAgIGlmIChOVU1fU0FNUExFUyA8PSAxKSB7XG4gICAgICAgIC8vIHNpbmdsZSBzYW1wbGVcbiAgICAgICAgcmV0dXJuIEVOQ09ERV9GVU5DKERFQ09ERV9GVU5DKFNPVVJDRV9GVU5DKFRBUkdFVF9GVU5DKCkpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbXVsdGkgc2FtcGxlXG4gICAgICAgIHZlYzMgdCA9IFRBUkdFVF9GVU5DKCk7XG4gICAgICAgIHZlYzMgdHUgPSBkRmR4KHQpO1xuICAgICAgICB2ZWMzIHR2ID0gZEZkeSh0KTtcblxuICAgICAgICB2ZWMzIHJlc3VsdCA9IHZlYzMoMC4wKTtcbiAgICAgICAgZm9yIChmbG9hdCB1ID0gMC4wOyB1IDwgTlVNX1NBTVBMRVNfU1FSVDsgKyt1KSB7XG4gICAgICAgICAgICBmb3IgKGZsb2F0IHYgPSAwLjA7IHYgPCBOVU1fU0FNUExFU19TUVJUOyArK3YpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gREVDT0RFX0ZVTkMoU09VUkNFX0ZVTkMobm9ybWFsaXplKHQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHUgKiAodSAvIE5VTV9TQU1QTEVTX1NRUlQgLSAwLjUpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR2ICogKHYgLyBOVU1fU0FNUExFU19TUVJUIC0gMC41KSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gRU5DT0RFX0ZVTkMocmVzdWx0IC8gKE5VTV9TQU1QTEVTX1NRUlQgKiBOVU1fU0FNUExFU19TUVJUKSk7XG4gICAgfVxufVxuXG52ZWM0IHVucGFja0Zsb2F0ID0gdmVjNCgxLjAsIDEuMCAvIDI1NS4wLCAxLjAgLyA2NTAyNS4wLCAxLjAgLyAxNjU4MTM3NS4wKTtcblxudm9pZCB1bnBhY2tTYW1wbGUoaW50IGksIG91dCB2ZWMzIEwsIG91dCBmbG9hdCBtaXBMZXZlbCkge1xuICAgIGZsb2F0IHUgPSAoZmxvYXQoaSAqIDQpICsgMC41KSAqIHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS54O1xuICAgIGZsb2F0IHYgPSAoZmxvb3IodSkgKyAwLjUpICogc2FtcGxlc1RleEludmVyc2VTaXplLnk7XG5cbiAgICB2ZWM0IHJhdztcbiAgICByYXcueCA9IGRvdCh0ZXh0dXJlMkQoc2FtcGxlc1RleCwgdmVjMih1LCB2KSksIHVucGFja0Zsb2F0KTsgdSArPSBzYW1wbGVzVGV4SW52ZXJzZVNpemUueDtcbiAgICByYXcueSA9IGRvdCh0ZXh0dXJlMkQoc2FtcGxlc1RleCwgdmVjMih1LCB2KSksIHVucGFja0Zsb2F0KTsgdSArPSBzYW1wbGVzVGV4SW52ZXJzZVNpemUueDtcbiAgICByYXcueiA9IGRvdCh0ZXh0dXJlMkQoc2FtcGxlc1RleCwgdmVjMih1LCB2KSksIHVucGFja0Zsb2F0KTsgdSArPSBzYW1wbGVzVGV4SW52ZXJzZVNpemUueDtcbiAgICByYXcudyA9IGRvdCh0ZXh0dXJlMkQoc2FtcGxlc1RleCwgdmVjMih1LCB2KSksIHVucGFja0Zsb2F0KTtcblxuICAgIEwueHl6ID0gcmF3Lnh5eiAqIDIuMCAtIDEuMDtcbiAgICBtaXBMZXZlbCA9IHJhdy53ICogOC4wO1xufVxuXG4vLyBjb252b2x2ZSBhbiBlbnZpcm9ubWVudCBnaXZlbiBwcmUtZ2VuZXJhdGVkIHNhbXBsZXNcbnZlYzQgcHJlZmlsdGVyU2FtcGxlcygpIHtcbiAgICAvLyBjb25zdHJ1Y3QgdmVjdG9yIHNwYWNlIGdpdmVuIHRhcmdldCBkaXJlY3Rpb25cbiAgICBtYXQzIHZlY1NwYWNlID0gbWF0cml4RnJvbVZlY3RvclNsb3coVEFSR0VUX0ZVTkMoKSk7XG5cbiAgICB2ZWMzIEw7XG4gICAgZmxvYXQgbWlwTGV2ZWw7XG5cbiAgICB2ZWMzIHJlc3VsdCA9IHZlYzMoMC4wKTtcbiAgICBmbG9hdCB0b3RhbFdlaWdodCA9IDAuMDtcbiAgICBmb3IgKGludCBpID0gMDsgaSA8IE5VTV9TQU1QTEVTOyArK2kpIHtcbiAgICAgICAgdW5wYWNrU2FtcGxlKGksIEwsIG1pcExldmVsKTtcbiAgICAgICAgcmVzdWx0ICs9IERFQ09ERV9GVU5DKFNPVVJDRV9GVU5DKHZlY1NwYWNlICogTCwgbWlwTGV2ZWwpKSAqIEwuejtcbiAgICAgICAgdG90YWxXZWlnaHQgKz0gTC56O1xuICAgIH1cblxuICAgIHJldHVybiBFTkNPREVfRlVOQyhyZXN1bHQgLyB0b3RhbFdlaWdodCk7XG59XG5cbi8vIHVud2VpZ2h0ZWQgdmVyc2lvbiBvZiBwcmVmaWx0ZXJTYW1wbGVzXG52ZWM0IHByZWZpbHRlclNhbXBsZXNVbndlaWdodGVkKCkge1xuICAgIC8vIGNvbnN0cnVjdCB2ZWN0b3Igc3BhY2UgZ2l2ZW4gdGFyZ2V0IGRpcmVjdGlvblxuICAgIG1hdDMgdmVjU3BhY2UgPSBtYXRyaXhGcm9tVmVjdG9yU2xvdyhUQVJHRVRfRlVOQygpKTtcblxuICAgIHZlYzMgTDtcbiAgICBmbG9hdCBtaXBMZXZlbDtcblxuICAgIHZlYzMgcmVzdWx0ID0gdmVjMygwLjApO1xuICAgIGZsb2F0IHRvdGFsV2VpZ2h0ID0gMC4wO1xuICAgIGZvciAoaW50IGkgPSAwOyBpIDwgTlVNX1NBTVBMRVM7ICsraSkge1xuICAgICAgICB1bnBhY2tTYW1wbGUoaSwgTCwgbWlwTGV2ZWwpO1xuICAgICAgICByZXN1bHQgKz0gREVDT0RFX0ZVTkMoU09VUkNFX0ZVTkModmVjU3BhY2UgKiBMLCBtaXBMZXZlbCkpO1xuICAgIH1cblxuICAgIHJldHVybiBFTkNPREVfRlVOQyhyZXN1bHQgLyBmbG9hdChOVU1fU0FNUExFUykpO1xufVxuXG52b2lkIG1haW4odm9pZCkge1xuICAgIGdsX0ZyYWdDb2xvciA9IFBST0NFU1NfRlVOQygpO1xufVxuYDtcbiJdLCJuYW1lcyI6WyJkZWNvZGUiLCJlbmNvZGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBR0Esa0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUVBLFFBQU8sQ0FBQTtBQUNULEVBQUVDLFFBQU8sQ0FBQTtBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXZTQTs7OzsifQ==
