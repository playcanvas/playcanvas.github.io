/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvcmVwcm9qZWN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkZWNvZGUgZnJvbSAnLi9kZWNvZGUuanMnO1xuaW1wb3J0IGVuY29kZSBmcm9tICcuL2VuY29kZS5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBUaGlzIHNoYWRlciByZXF1aXJlcyB0aGUgZm9sbG93aW5nICNERUZJTkVzOlxuLy9cbi8vIFBST0NFU1NfRlVOQyAtIG11c3QgYmUgb25lIG9mIHJlcHJvamVjdCwgcHJlZmlsdGVyXG4vLyBERUNPREVfRlVOQyAtIG11c3QgYmUgb25lIG9mIGRlY29kZVJHQk0sIGRlY29kZVJHQkUsIGRlY29kZUdhbW1hIG9yIGRlY29kZUxpbmVhclxuLy8gRU5DT0RFX0ZVTkMgLSBtdXN0IGJlIG9uZSBvZiBlbmNvZGVSR0JNLCBlbmNvZGVSR0JFLCBlbmNpZGVHYW1tYSBvciBlbmNvZGVMaW5lYXJcbi8vIFNPVVJDRV9GVU5DIC0gbXVzdCBiZSBvbmUgb2Ygc2FtcGxlQ3ViZW1hcCwgc2FtcGxlRXF1aXJlY3QsIHNhbXBsZU9jdGFoZWRyYWxcbi8vIFRBUkdFVF9GVU5DIC0gbXVzdCBiZSBvbmUgb2YgZ2V0RGlyZWN0aW9uQ3ViZW1hcCwgZ2V0RGlyZWN0aW9uRXF1aXJlY3QsIGdldERpcmVjdGlvbk9jdGFoZWRyYWxcbi8vXG4vLyBXaGVuIGZpbHRlcmluZzpcbi8vIE5VTV9TQU1QTEVTIC0gbnVtYmVyIG9mIHNhbXBsZXNcbi8vIE5VTV9TQU1QTEVTX1NRUlQgLSBzcXJ0IG9mIG51bWJlciBvZiBzYW1wbGVzXG4vL1xuLy8gU1VQUE9SVFNfVEVYTE9EIC0gd2hldGhlciBzdXBwb3J0cyB0ZXhsb2QgaXMgc3VwcG9ydGVkXG5cbnZhcnlpbmcgdmVjMiB2VXYwO1xuXG4vLyBzb3VyY2VcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZVRleDtcbnVuaWZvcm0gc2FtcGxlckN1YmUgc291cmNlQ3ViZTtcblxuLy8gc2FtcGxlc1xudW5pZm9ybSBzYW1wbGVyMkQgc2FtcGxlc1RleDtcbnVuaWZvcm0gdmVjMiBzYW1wbGVzVGV4SW52ZXJzZVNpemU7XG5cbi8vIHBhcmFtczpcbi8vIHggLSB0YXJnZXQgY3ViZW1hcCBmYWNlIDAuLjZcbi8vIHkgLSBzcGVjdWxhciBwb3dlciAod2hlbiBwcmVmaWx0ZXJpbmcpXG4vLyB6IC0gc291cmNlIGN1YmVtYXAgc2VhbSBzY2FsZSAoMCB0byBkaXNhYmxlKVxuLy8gdyAtIHRhcmdldCBjdWJlbWFwIHNpemUgZm9yIHNlYW0gY2FsYyAoMCB0byBkaXNhYmxlKVxudW5pZm9ybSB2ZWM0IHBhcmFtcztcblxuLy8gcGFyYW1zMjpcbi8vIHggLSB0YXJnZXQgaW1hZ2UgdG90YWwgcGl4ZWxzXG4vLyB5IC0gc291cmNlIGN1YmVtYXAgc2l6ZVxudW5pZm9ybSB2ZWMyIHBhcmFtczI7XG5cbmZsb2F0IHRhcmdldEZhY2UoKSB7IHJldHVybiBwYXJhbXMueDsgfVxuZmxvYXQgc3BlY3VsYXJQb3dlcigpIHsgcmV0dXJuIHBhcmFtcy55OyB9XG5mbG9hdCBzb3VyY2VDdWJlU2VhbVNjYWxlKCkgeyByZXR1cm4gcGFyYW1zLno7IH1cbmZsb2F0IHRhcmdldEN1YmVTZWFtU2NhbGUoKSB7IHJldHVybiBwYXJhbXMudzsgfVxuXG5mbG9hdCB0YXJnZXRUb3RhbFBpeGVscygpIHsgcmV0dXJuIHBhcmFtczIueDsgfVxuZmxvYXQgc291cmNlVG90YWxQaXhlbHMoKSB7IHJldHVybiBwYXJhbXMyLnk7IH1cblxuZmxvYXQgUEkgPSAzLjE0MTU5MjY1MzU4OTc5MztcblxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbiR7ZGVjb2RlfVxuJHtlbmNvZGV9XG5cbi8vLS0gc3VwcG9ydGVkIHByb2plY3Rpb25zXG5cbnZlYzMgbW9kaWZ5U2VhbXModmVjMyBkaXIsIGZsb2F0IHNjYWxlKSB7XG4gICAgdmVjMyBhZGlyID0gYWJzKGRpcik7XG4gICAgZmxvYXQgTSA9IG1heChtYXgoYWRpci54LCBhZGlyLnkpLCBhZGlyLnopO1xuICAgIHJldHVybiBkaXIgLyBNICogdmVjMyhcbiAgICAgICAgYWRpci54ID09IE0gPyAxLjAgOiBzY2FsZSxcbiAgICAgICAgYWRpci55ID09IE0gPyAxLjAgOiBzY2FsZSxcbiAgICAgICAgYWRpci56ID09IE0gPyAxLjAgOiBzY2FsZVxuICAgICk7XG59XG5cbnZlYzIgdG9TcGhlcmljYWwodmVjMyBkaXIpIHtcbiAgICByZXR1cm4gdmVjMihkaXIueHogPT0gdmVjMigwLjApID8gMC4wIDogYXRhbihkaXIueCwgZGlyLnopLCBhc2luKGRpci55KSk7XG59XG5cbnZlYzMgZnJvbVNwaGVyaWNhbCh2ZWMyIHV2KSB7XG4gICAgcmV0dXJuIHZlYzMoY29zKHV2LnkpICogc2luKHV2LngpLFxuICAgICAgICAgICAgICAgIHNpbih1di55KSxcbiAgICAgICAgICAgICAgICBjb3ModXYueSkgKiBjb3ModXYueCkpO1xufVxuXG52ZWMzIGdldERpcmVjdGlvbkVxdWlyZWN0KCkge1xuICAgIHJldHVybiBmcm9tU3BoZXJpY2FsKCh2ZWMyKHZVdjAueCwgMS4wIC0gdlV2MC55KSAqIDIuMCAtIDEuMCkgKiB2ZWMyKFBJLCBQSSAqIDAuNSkpO1xufVxuXG52ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzIgc3BoKSB7XG4gICAgdmVjMiB1diA9IHNwaCAvIHZlYzIoUEkgKiAyLjAsIFBJKSArIDAuNTtcbiAgICByZXR1cm4gdGV4dHVyZTJEKHNvdXJjZVRleCwgdmVjMih1di54LCAxLjAgLSB1di55KSk7XG59XG5cbnZlYzQgc2FtcGxlRXF1aXJlY3QodmVjMyBkaXIpIHtcbiAgICByZXR1cm4gc2FtcGxlRXF1aXJlY3QodG9TcGhlcmljYWwoZGlyKSk7XG59XG5cbnZlYzQgc2FtcGxlQ3ViZW1hcCh2ZWMzIGRpcikge1xuICAgIHJldHVybiB0ZXh0dXJlQ3ViZShzb3VyY2VDdWJlLCBtb2RpZnlTZWFtcyhkaXIsIDEuMCAtIHNvdXJjZUN1YmVTZWFtU2NhbGUoKSkpO1xufVxuXG52ZWM0IHNhbXBsZUN1YmVtYXAodmVjMiBzcGgpIHtcbiAgICByZXR1cm4gc2FtcGxlQ3ViZW1hcChmcm9tU3BoZXJpY2FsKHNwaCkpO1xufVxuXG52ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzIgc3BoLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgIHZlYzIgdXYgPSBzcGggLyB2ZWMyKFBJICogMi4wLCBQSSkgKyAwLjU7XG4jaWZkZWYgU1VQUE9SVFNfVEVYTE9EXG4gICAgcmV0dXJuIHRleHR1cmUyRExvZEVYVChzb3VyY2VUZXgsIHZlYzIodXYueCwgMS4wIC0gdXYueSksIG1pcExldmVsKTtcbiNlbHNlXG4gICAgcmV0dXJuIHRleHR1cmUyRChzb3VyY2VUZXgsIHZlYzIodXYueCwgMS4wIC0gdXYueSkpO1xuI2VuZGlmXG59XG5cbnZlYzQgc2FtcGxlRXF1aXJlY3QodmVjMyBkaXIsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgcmV0dXJuIHNhbXBsZUVxdWlyZWN0KHRvU3BoZXJpY2FsKGRpciksIG1pcExldmVsKTtcbn1cblxudmVjNCBzYW1wbGVDdWJlbWFwKHZlYzMgZGlyLCBmbG9hdCBtaXBMZXZlbCkge1xuI2lmZGVmIFNVUFBPUlRTX1RFWExPRFxuICAgIHJldHVybiB0ZXh0dXJlQ3ViZUxvZEVYVChzb3VyY2VDdWJlLCBtb2RpZnlTZWFtcyhkaXIsIDEuMCAtIGV4cDIobWlwTGV2ZWwpICogc291cmNlQ3ViZVNlYW1TY2FsZSgpKSwgbWlwTGV2ZWwpO1xuI2Vsc2VcbiAgICByZXR1cm4gdGV4dHVyZUN1YmUoc291cmNlQ3ViZSwgbW9kaWZ5U2VhbXMoZGlyLCAxLjAgLSBleHAyKG1pcExldmVsKSAqIHNvdXJjZUN1YmVTZWFtU2NhbGUoKSkpO1xuI2VuZGlmXG59XG5cbnZlYzQgc2FtcGxlQ3ViZW1hcCh2ZWMyIHNwaCwgZmxvYXQgbWlwTGV2ZWwpIHtcbiAgICByZXR1cm4gc2FtcGxlQ3ViZW1hcChmcm9tU3BoZXJpY2FsKHNwaCksIG1pcExldmVsKTtcbn1cblxuLy8gb2N0YWhlZHJhbCBjb2RlLCBiYXNlZCBvbiBodHRwOi8vamNndC5vcmcvcHVibGlzaGVkLzAwMDMvMDIvMDFcbi8vIFwiU3VydmV5IG9mIEVmZmljaWVudCBSZXByZXNlbnRhdGlvbnMgZm9yIEluZGVwZW5kZW50IFVuaXQgVmVjdG9yc1wiIGJ5IENpZ29sbGUsIERvbm93LCBFdmFuZ2VsYWtvcywgTWFyYSwgTWNHdWlyZSwgTWV5ZXJcblxuZmxvYXQgc2lnbk5vdFplcm8oZmxvYXQgayl7XG4gICAgcmV0dXJuKGsgPj0gMC4wKSA/IDEuMCA6IC0xLjA7XG59XG5cbnZlYzIgc2lnbk5vdFplcm8odmVjMiB2KSB7XG4gICAgcmV0dXJuIHZlYzIoc2lnbk5vdFplcm8odi54KSwgc2lnbk5vdFplcm8odi55KSk7XG59XG5cbi8vIFJldHVybnMgYSB1bml0IHZlY3Rvci4gQXJndW1lbnQgbyBpcyBhbiBvY3RhaGVkcmFsIHZlY3RvciBwYWNrZWQgdmlhIG9jdEVuY29kZSwgb24gdGhlIFstMSwgKzFdIHNxdWFyZVxudmVjMyBvY3REZWNvZGUodmVjMiBvKSB7XG4gICAgdmVjMyB2ID0gdmVjMyhvLngsIDEuMCAtIGFicyhvLngpIC0gYWJzKG8ueSksIG8ueSk7XG4gICAgaWYgKHYueSA8IDAuMCkge1xuICAgICAgICB2Lnh6ID0gKDEuMCAtIGFicyh2Lnp4KSkgKiBzaWduTm90WmVybyh2Lnh6KTtcbiAgICB9XG4gICAgcmV0dXJuIG5vcm1hbGl6ZSh2KTtcbn1cblxudmVjMyBnZXREaXJlY3Rpb25PY3RhaGVkcmFsKCkge1xuICAgIHJldHVybiBvY3REZWNvZGUodmVjMih2VXYwLngsIDEuMCAtIHZVdjAueSkgKiAyLjAgLSAxLjApO1xufVxuXG4vLyBBc3N1bWVzIHRoYXQgdiBpcyBhIHVuaXQgdmVjdG9yLiBUaGUgcmVzdWx0IGlzIGFuIG9jdGFoZWRyYWwgdmVjdG9yIG9uIHRoZSBbLTEsICsxXSBzcXVhcmVcbnZlYzIgb2N0RW5jb2RlKGluIHZlYzMgdikge1xuICAgIGZsb2F0IGwxbm9ybSA9IGFicyh2LngpICsgYWJzKHYueSkgKyBhYnModi56KTtcbiAgICB2ZWMyIHJlc3VsdCA9IHYueHogKiAoMS4wIC8gbDFub3JtKTtcbiAgICBpZiAodi55IDwgMC4wKSB7XG4gICAgICAgIHJlc3VsdCA9ICgxLjAgLSBhYnMocmVzdWx0Lnl4KSkgKiBzaWduTm90WmVybyhyZXN1bHQueHkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG52ZWM0IHNhbXBsZU9jdGFoZWRyYWwodmVjMyBkaXIpIHtcbiAgICB2ZWMyIHV2ID0gb2N0RW5jb2RlKGRpcikgKiAwLjUgKyAwLjU7XG4gICAgcmV0dXJuIHRleHR1cmUyRChzb3VyY2VUZXgsIHZlYzIodXYueCwgMS4wIC0gdXYueSkpO1xufVxuXG52ZWM0IHNhbXBsZU9jdGFoZWRyYWwodmVjMiBzcGgpIHtcbiAgICByZXR1cm4gc2FtcGxlT2N0YWhlZHJhbChmcm9tU3BoZXJpY2FsKHNwaCkpO1xufVxuXG52ZWM0IHNhbXBsZU9jdGFoZWRyYWwodmVjMyBkaXIsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgdmVjMiB1diA9IG9jdEVuY29kZShkaXIpICogMC41ICsgMC41O1xuI2lmZGVmIFNVUFBPUlRTX1RFWExPRFxuICAgIHJldHVybiB0ZXh0dXJlMkRMb2RFWFQoc291cmNlVGV4LCB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpLCBtaXBMZXZlbCk7XG4jZWxzZVxuICAgIHJldHVybiB0ZXh0dXJlMkQoc291cmNlVGV4LCB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpKTtcbiNlbmRpZlxufVxuXG52ZWM0IHNhbXBsZU9jdGFoZWRyYWwodmVjMiBzcGgsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgcmV0dXJuIHNhbXBsZU9jdGFoZWRyYWwoZnJvbVNwaGVyaWNhbChzcGgpLCBtaXBMZXZlbCk7XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG52ZWMzIGdldERpcmVjdGlvbkN1YmVtYXAoKSB7XG4gICAgdmVjMiBzdCA9IHZVdjAgKiAyLjAgLSAxLjA7XG4gICAgZmxvYXQgZmFjZSA9IHRhcmdldEZhY2UoKTtcblxuICAgIHZlYzMgdmVjO1xuICAgIGlmIChmYWNlID09IDAuMCkge1xuICAgICAgICB2ZWMgPSB2ZWMzKDEsIC1zdC55LCAtc3QueCk7XG4gICAgfSBlbHNlIGlmIChmYWNlID09IDEuMCkge1xuICAgICAgICB2ZWMgPSB2ZWMzKC0xLCAtc3QueSwgc3QueCk7XG4gICAgfSBlbHNlIGlmIChmYWNlID09IDIuMCkge1xuICAgICAgICB2ZWMgPSB2ZWMzKHN0LngsIDEsIHN0LnkpO1xuICAgIH0gZWxzZSBpZiAoZmFjZSA9PSAzLjApIHtcbiAgICAgICAgdmVjID0gdmVjMyhzdC54LCAtMSwgLXN0LnkpO1xuICAgIH0gZWxzZSBpZiAoZmFjZSA9PSA0LjApIHtcbiAgICAgICAgdmVjID0gdmVjMyhzdC54LCAtc3QueSwgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmVjID0gdmVjMygtc3QueCwgLXN0LnksIC0xKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbm9ybWFsaXplKG1vZGlmeVNlYW1zKHZlYywgMS4wIC8gKDEuMCAtIHRhcmdldEN1YmVTZWFtU2NhbGUoKSkpKTtcbn1cblxubWF0MyBtYXRyaXhGcm9tVmVjdG9yKHZlYzMgbikgeyAvLyBmcmlzdmFkXG4gICAgZmxvYXQgYSA9IDEuMCAvICgxLjAgKyBuLnopO1xuICAgIGZsb2F0IGIgPSAtbi54ICogbi55ICogYTtcbiAgICB2ZWMzIGIxID0gdmVjMygxLjAgLSBuLnggKiBuLnggKiBhLCBiLCAtbi54KTtcbiAgICB2ZWMzIGIyID0gdmVjMyhiLCAxLjAgLSBuLnkgKiBuLnkgKiBhLCAtbi55KTtcbiAgICByZXR1cm4gbWF0MyhiMSwgYjIsIG4pO1xufVxuXG5tYXQzIG1hdHJpeEZyb21WZWN0b3JTbG93KHZlYzMgbikge1xuICAgIHZlYzMgdXAgPSAoMS4wIC0gYWJzKG4ueSkgPD0gMC4wMDAwMDAxKSA/IHZlYzMoMC4wLCAwLjAsIG4ueSA+IDAuMCA/IDEuMCA6IC0xLjApIDogdmVjMygwLjAsIDEuMCwgMC4wKTtcbiAgICB2ZWMzIHggPSBub3JtYWxpemUoY3Jvc3ModXAsIG4pKTtcbiAgICB2ZWMzIHkgPSBjcm9zcyhuLCB4KTtcbiAgICByZXR1cm4gbWF0Myh4LCB5LCBuKTtcbn1cblxudmVjNCByZXByb2plY3QoKSB7XG4gICAgaWYgKE5VTV9TQU1QTEVTIDw9IDEpIHtcbiAgICAgICAgLy8gc2luZ2xlIHNhbXBsZVxuICAgICAgICByZXR1cm4gRU5DT0RFX0ZVTkMoREVDT0RFX0ZVTkMoU09VUkNFX0ZVTkMoVEFSR0VUX0ZVTkMoKSkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBtdWx0aSBzYW1wbGVcbiAgICAgICAgdmVjMyB0ID0gVEFSR0VUX0ZVTkMoKTtcbiAgICAgICAgdmVjMyB0dSA9IGRGZHgodCk7XG4gICAgICAgIHZlYzMgdHYgPSBkRmR5KHQpO1xuXG4gICAgICAgIHZlYzMgcmVzdWx0ID0gdmVjMygwLjApO1xuICAgICAgICBmb3IgKGZsb2F0IHUgPSAwLjA7IHUgPCBOVU1fU0FNUExFU19TUVJUOyArK3UpIHtcbiAgICAgICAgICAgIGZvciAoZmxvYXQgdiA9IDAuMDsgdiA8IE5VTV9TQU1QTEVTX1NRUlQ7ICsrdikge1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSBERUNPREVfRlVOQyhTT1VSQ0VfRlVOQyhub3JtYWxpemUodCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0dSAqICh1IC8gTlVNX1NBTVBMRVNfU1FSVCAtIDAuNSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHYgKiAodiAvIE5VTV9TQU1QTEVTX1NRUlQgLSAwLjUpKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBFTkNPREVfRlVOQyhyZXN1bHQgLyAoTlVNX1NBTVBMRVNfU1FSVCAqIE5VTV9TQU1QTEVTX1NRUlQpKTtcbiAgICB9XG59XG5cbnZlYzQgdW5wYWNrRmxvYXQgPSB2ZWM0KDEuMCwgMS4wIC8gMjU1LjAsIDEuMCAvIDY1MDI1LjAsIDEuMCAvIDE2NTgxMzc1LjApO1xuXG52b2lkIHVucGFja1NhbXBsZShpbnQgaSwgb3V0IHZlYzMgTCwgb3V0IGZsb2F0IG1pcExldmVsKSB7XG4gICAgZmxvYXQgdSA9IChmbG9hdChpICogNCkgKyAwLjUpICogc2FtcGxlc1RleEludmVyc2VTaXplLng7XG4gICAgZmxvYXQgdiA9IChmbG9vcih1KSArIDAuNSkgKiBzYW1wbGVzVGV4SW52ZXJzZVNpemUueTtcblxuICAgIHZlYzQgcmF3O1xuICAgIHJhdy54ID0gZG90KHRleHR1cmUyRChzYW1wbGVzVGV4LCB2ZWMyKHUsIHYpKSwgdW5wYWNrRmxvYXQpOyB1ICs9IHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS54O1xuICAgIHJhdy55ID0gZG90KHRleHR1cmUyRChzYW1wbGVzVGV4LCB2ZWMyKHUsIHYpKSwgdW5wYWNrRmxvYXQpOyB1ICs9IHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS54O1xuICAgIHJhdy56ID0gZG90KHRleHR1cmUyRChzYW1wbGVzVGV4LCB2ZWMyKHUsIHYpKSwgdW5wYWNrRmxvYXQpOyB1ICs9IHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS54O1xuICAgIHJhdy53ID0gZG90KHRleHR1cmUyRChzYW1wbGVzVGV4LCB2ZWMyKHUsIHYpKSwgdW5wYWNrRmxvYXQpO1xuXG4gICAgTC54eXogPSByYXcueHl6ICogMi4wIC0gMS4wO1xuICAgIG1pcExldmVsID0gcmF3LncgKiA4LjA7XG59XG5cbi8vIGNvbnZvbHZlIGFuIGVudmlyb25tZW50IGdpdmVuIHByZS1nZW5lcmF0ZWQgc2FtcGxlc1xudmVjNCBwcmVmaWx0ZXJTYW1wbGVzKCkge1xuICAgIC8vIGNvbnN0cnVjdCB2ZWN0b3Igc3BhY2UgZ2l2ZW4gdGFyZ2V0IGRpcmVjdGlvblxuICAgIG1hdDMgdmVjU3BhY2UgPSBtYXRyaXhGcm9tVmVjdG9yU2xvdyhUQVJHRVRfRlVOQygpKTtcblxuICAgIHZlYzMgTDtcbiAgICBmbG9hdCBtaXBMZXZlbDtcblxuICAgIHZlYzMgcmVzdWx0ID0gdmVjMygwLjApO1xuICAgIGZsb2F0IHRvdGFsV2VpZ2h0ID0gMC4wO1xuICAgIGZvciAoaW50IGkgPSAwOyBpIDwgTlVNX1NBTVBMRVM7ICsraSkge1xuICAgICAgICB1bnBhY2tTYW1wbGUoaSwgTCwgbWlwTGV2ZWwpO1xuICAgICAgICByZXN1bHQgKz0gREVDT0RFX0ZVTkMoU09VUkNFX0ZVTkModmVjU3BhY2UgKiBMLCBtaXBMZXZlbCkpICogTC56O1xuICAgICAgICB0b3RhbFdlaWdodCArPSBMLno7XG4gICAgfVxuXG4gICAgcmV0dXJuIEVOQ09ERV9GVU5DKHJlc3VsdCAvIHRvdGFsV2VpZ2h0KTtcbn1cblxuLy8gdW53ZWlnaHRlZCB2ZXJzaW9uIG9mIHByZWZpbHRlclNhbXBsZXNcbnZlYzQgcHJlZmlsdGVyU2FtcGxlc1Vud2VpZ2h0ZWQoKSB7XG4gICAgLy8gY29uc3RydWN0IHZlY3RvciBzcGFjZSBnaXZlbiB0YXJnZXQgZGlyZWN0aW9uXG4gICAgbWF0MyB2ZWNTcGFjZSA9IG1hdHJpeEZyb21WZWN0b3JTbG93KFRBUkdFVF9GVU5DKCkpO1xuXG4gICAgdmVjMyBMO1xuICAgIGZsb2F0IG1pcExldmVsO1xuXG4gICAgdmVjMyByZXN1bHQgPSB2ZWMzKDAuMCk7XG4gICAgZmxvYXQgdG90YWxXZWlnaHQgPSAwLjA7XG4gICAgZm9yIChpbnQgaSA9IDA7IGkgPCBOVU1fU0FNUExFUzsgKytpKSB7XG4gICAgICAgIHVucGFja1NhbXBsZShpLCBMLCBtaXBMZXZlbCk7XG4gICAgICAgIHJlc3VsdCArPSBERUNPREVfRlVOQyhTT1VSQ0VfRlVOQyh2ZWNTcGFjZSAqIEwsIG1pcExldmVsKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIEVOQ09ERV9GVU5DKHJlc3VsdCAvIGZsb2F0KE5VTV9TQU1QTEVTKSk7XG59XG5cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZ2xfRnJhZ0NvbG9yID0gUFJPQ0VTU19GVU5DKCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbImRlY29kZSIsImVuY29kZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFHQSxrQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRUEsUUFBTyxDQUFBO0FBQ1QsRUFBRUMsUUFBTyxDQUFBO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
