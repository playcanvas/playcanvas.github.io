import decodePS from './decode.js';
import encodePS from './encode.js';

var reprojectPS = /* glsl */`
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

varying vec2 vUv0;

// source
#ifdef CUBEMAP_SOURCE
    uniform samplerCube sourceCube;
#else
    uniform sampler2D sourceTex;
#endif

#ifdef USE_SAMPLES_TEX
    // samples
    uniform sampler2D samplesTex;
    uniform vec2 samplesTexInverseSize;
#endif

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

/////////////////////////////////////////////////////////////////////

#ifdef CUBEMAP_SOURCE
    vec4 sampleCubemap(vec3 dir) {
        return textureCube(sourceCube, modifySeams(dir, 1.0 - sourceCubeSeamScale()));
    }

    vec4 sampleCubemap(vec2 sph) {
    return sampleCubemap(fromSpherical(sph));
}

    vec4 sampleCubemap(vec3 dir, float mipLevel) {
        return textureCubeLodEXT(sourceCube, modifySeams(dir, 1.0 - exp2(mipLevel) * sourceCubeSeamScale()), mipLevel);
    }

    vec4 sampleCubemap(vec2 sph, float mipLevel) {
        return sampleCubemap(fromSpherical(sph), mipLevel);
    }
#else

    vec4 sampleEquirect(vec2 sph) {
        vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
        return texture2D(sourceTex, vec2(uv.x, 1.0 - uv.y));
    }

    vec4 sampleEquirect(vec3 dir) {
        return sampleEquirect(toSpherical(dir));
    }

    vec4 sampleEquirect(vec2 sph, float mipLevel) {
        vec2 uv = sph / vec2(PI * 2.0, PI) + 0.5;
        return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
    }

    vec4 sampleEquirect(vec3 dir, float mipLevel) {
        return sampleEquirect(toSpherical(dir), mipLevel);
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
        return texture2DLodEXT(sourceTex, vec2(uv.x, 1.0 - uv.y), mipLevel);
    }

    vec4 sampleOctahedral(vec2 sph, float mipLevel) {
        return sampleOctahedral(fromSpherical(sph), mipLevel);
    }

#endif

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

#ifdef USE_SAMPLES_TEX
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
#endif

void main(void) {
    gl_FragColor = PROCESS_FUNC();
}
`;

export { reprojectPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvcmVwcm9qZWN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkZWNvZGUgZnJvbSAnLi9kZWNvZGUuanMnO1xuaW1wb3J0IGVuY29kZSBmcm9tICcuL2VuY29kZS5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBUaGlzIHNoYWRlciByZXF1aXJlcyB0aGUgZm9sbG93aW5nICNERUZJTkVzOlxuLy9cbi8vIFBST0NFU1NfRlVOQyAtIG11c3QgYmUgb25lIG9mIHJlcHJvamVjdCwgcHJlZmlsdGVyXG4vLyBERUNPREVfRlVOQyAtIG11c3QgYmUgb25lIG9mIGRlY29kZVJHQk0sIGRlY29kZVJHQkUsIGRlY29kZUdhbW1hIG9yIGRlY29kZUxpbmVhclxuLy8gRU5DT0RFX0ZVTkMgLSBtdXN0IGJlIG9uZSBvZiBlbmNvZGVSR0JNLCBlbmNvZGVSR0JFLCBlbmNpZGVHYW1tYSBvciBlbmNvZGVMaW5lYXJcbi8vIFNPVVJDRV9GVU5DIC0gbXVzdCBiZSBvbmUgb2Ygc2FtcGxlQ3ViZW1hcCwgc2FtcGxlRXF1aXJlY3QsIHNhbXBsZU9jdGFoZWRyYWxcbi8vIFRBUkdFVF9GVU5DIC0gbXVzdCBiZSBvbmUgb2YgZ2V0RGlyZWN0aW9uQ3ViZW1hcCwgZ2V0RGlyZWN0aW9uRXF1aXJlY3QsIGdldERpcmVjdGlvbk9jdGFoZWRyYWxcbi8vXG4vLyBXaGVuIGZpbHRlcmluZzpcbi8vIE5VTV9TQU1QTEVTIC0gbnVtYmVyIG9mIHNhbXBsZXNcbi8vIE5VTV9TQU1QTEVTX1NRUlQgLSBzcXJ0IG9mIG51bWJlciBvZiBzYW1wbGVzXG5cbnZhcnlpbmcgdmVjMiB2VXYwO1xuXG4vLyBzb3VyY2VcbiNpZmRlZiBDVUJFTUFQX1NPVVJDRVxuICAgIHVuaWZvcm0gc2FtcGxlckN1YmUgc291cmNlQ3ViZTtcbiNlbHNlXG4gICAgdW5pZm9ybSBzYW1wbGVyMkQgc291cmNlVGV4O1xuI2VuZGlmXG5cbiNpZmRlZiBVU0VfU0FNUExFU19URVhcbiAgICAvLyBzYW1wbGVzXG4gICAgdW5pZm9ybSBzYW1wbGVyMkQgc2FtcGxlc1RleDtcbiAgICB1bmlmb3JtIHZlYzIgc2FtcGxlc1RleEludmVyc2VTaXplO1xuI2VuZGlmXG5cbi8vIHBhcmFtczpcbi8vIHggLSB0YXJnZXQgY3ViZW1hcCBmYWNlIDAuLjZcbi8vIHkgLSBzcGVjdWxhciBwb3dlciAod2hlbiBwcmVmaWx0ZXJpbmcpXG4vLyB6IC0gc291cmNlIGN1YmVtYXAgc2VhbSBzY2FsZSAoMCB0byBkaXNhYmxlKVxuLy8gdyAtIHRhcmdldCBjdWJlbWFwIHNpemUgZm9yIHNlYW0gY2FsYyAoMCB0byBkaXNhYmxlKVxudW5pZm9ybSB2ZWM0IHBhcmFtcztcblxuLy8gcGFyYW1zMjpcbi8vIHggLSB0YXJnZXQgaW1hZ2UgdG90YWwgcGl4ZWxzXG4vLyB5IC0gc291cmNlIGN1YmVtYXAgc2l6ZVxudW5pZm9ybSB2ZWMyIHBhcmFtczI7XG5cbmZsb2F0IHRhcmdldEZhY2UoKSB7IHJldHVybiBwYXJhbXMueDsgfVxuZmxvYXQgc3BlY3VsYXJQb3dlcigpIHsgcmV0dXJuIHBhcmFtcy55OyB9XG5mbG9hdCBzb3VyY2VDdWJlU2VhbVNjYWxlKCkgeyByZXR1cm4gcGFyYW1zLno7IH1cbmZsb2F0IHRhcmdldEN1YmVTZWFtU2NhbGUoKSB7IHJldHVybiBwYXJhbXMudzsgfVxuXG5mbG9hdCB0YXJnZXRUb3RhbFBpeGVscygpIHsgcmV0dXJuIHBhcmFtczIueDsgfVxuZmxvYXQgc291cmNlVG90YWxQaXhlbHMoKSB7IHJldHVybiBwYXJhbXMyLnk7IH1cblxuZmxvYXQgUEkgPSAzLjE0MTU5MjY1MzU4OTc5MztcblxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbiR7ZGVjb2RlfVxuJHtlbmNvZGV9XG5cbi8vLS0gc3VwcG9ydGVkIHByb2plY3Rpb25zXG5cbnZlYzMgbW9kaWZ5U2VhbXModmVjMyBkaXIsIGZsb2F0IHNjYWxlKSB7XG4gICAgdmVjMyBhZGlyID0gYWJzKGRpcik7XG4gICAgZmxvYXQgTSA9IG1heChtYXgoYWRpci54LCBhZGlyLnkpLCBhZGlyLnopO1xuICAgIHJldHVybiBkaXIgLyBNICogdmVjMyhcbiAgICAgICAgYWRpci54ID09IE0gPyAxLjAgOiBzY2FsZSxcbiAgICAgICAgYWRpci55ID09IE0gPyAxLjAgOiBzY2FsZSxcbiAgICAgICAgYWRpci56ID09IE0gPyAxLjAgOiBzY2FsZVxuICAgICk7XG59XG5cbnZlYzIgdG9TcGhlcmljYWwodmVjMyBkaXIpIHtcbiAgICByZXR1cm4gdmVjMihkaXIueHogPT0gdmVjMigwLjApID8gMC4wIDogYXRhbihkaXIueCwgZGlyLnopLCBhc2luKGRpci55KSk7XG59XG5cbnZlYzMgZnJvbVNwaGVyaWNhbCh2ZWMyIHV2KSB7XG4gICAgcmV0dXJuIHZlYzMoY29zKHV2LnkpICogc2luKHV2LngpLFxuICAgICAgICAgICAgICAgIHNpbih1di55KSxcbiAgICAgICAgICAgICAgICBjb3ModXYueSkgKiBjb3ModXYueCkpO1xufVxuXG52ZWMzIGdldERpcmVjdGlvbkVxdWlyZWN0KCkge1xuICAgIHJldHVybiBmcm9tU3BoZXJpY2FsKCh2ZWMyKHZVdjAueCwgMS4wIC0gdlV2MC55KSAqIDIuMCAtIDEuMCkgKiB2ZWMyKFBJLCBQSSAqIDAuNSkpO1xufVxuXG4vLyBvY3RhaGVkcmFsIGNvZGUsIGJhc2VkIG9uIGh0dHA6Ly9qY2d0Lm9yZy9wdWJsaXNoZWQvMDAwMy8wMi8wMVxuLy8gXCJTdXJ2ZXkgb2YgRWZmaWNpZW50IFJlcHJlc2VudGF0aW9ucyBmb3IgSW5kZXBlbmRlbnQgVW5pdCBWZWN0b3JzXCIgYnkgQ2lnb2xsZSwgRG9ub3csIEV2YW5nZWxha29zLCBNYXJhLCBNY0d1aXJlLCBNZXllclxuXG5mbG9hdCBzaWduTm90WmVybyhmbG9hdCBrKXtcbiAgICByZXR1cm4oayA+PSAwLjApID8gMS4wIDogLTEuMDtcbn1cblxudmVjMiBzaWduTm90WmVybyh2ZWMyIHYpIHtcbiAgICByZXR1cm4gdmVjMihzaWduTm90WmVybyh2LngpLCBzaWduTm90WmVybyh2LnkpKTtcbn1cblxuLy8gUmV0dXJucyBhIHVuaXQgdmVjdG9yLiBBcmd1bWVudCBvIGlzIGFuIG9jdGFoZWRyYWwgdmVjdG9yIHBhY2tlZCB2aWEgb2N0RW5jb2RlLCBvbiB0aGUgWy0xLCArMV0gc3F1YXJlXG52ZWMzIG9jdERlY29kZSh2ZWMyIG8pIHtcbiAgICB2ZWMzIHYgPSB2ZWMzKG8ueCwgMS4wIC0gYWJzKG8ueCkgLSBhYnMoby55KSwgby55KTtcbiAgICBpZiAodi55IDwgMC4wKSB7XG4gICAgICAgIHYueHogPSAoMS4wIC0gYWJzKHYuengpKSAqIHNpZ25Ob3RaZXJvKHYueHopO1xuICAgIH1cbiAgICByZXR1cm4gbm9ybWFsaXplKHYpO1xufVxuXG52ZWMzIGdldERpcmVjdGlvbk9jdGFoZWRyYWwoKSB7XG4gICAgcmV0dXJuIG9jdERlY29kZSh2ZWMyKHZVdjAueCwgMS4wIC0gdlV2MC55KSAqIDIuMCAtIDEuMCk7XG59XG5cbi8vIEFzc3VtZXMgdGhhdCB2IGlzIGEgdW5pdCB2ZWN0b3IuIFRoZSByZXN1bHQgaXMgYW4gb2N0YWhlZHJhbCB2ZWN0b3Igb24gdGhlIFstMSwgKzFdIHNxdWFyZVxudmVjMiBvY3RFbmNvZGUoaW4gdmVjMyB2KSB7XG4gICAgZmxvYXQgbDFub3JtID0gYWJzKHYueCkgKyBhYnModi55KSArIGFicyh2LnopO1xuICAgIHZlYzIgcmVzdWx0ID0gdi54eiAqICgxLjAgLyBsMW5vcm0pO1xuICAgIGlmICh2LnkgPCAwLjApIHtcbiAgICAgICAgcmVzdWx0ID0gKDEuMCAtIGFicyhyZXN1bHQueXgpKSAqIHNpZ25Ob3RaZXJvKHJlc3VsdC54eSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4jaWZkZWYgQ1VCRU1BUF9TT1VSQ0VcbiAgICB2ZWM0IHNhbXBsZUN1YmVtYXAodmVjMyBkaXIpIHtcbiAgICAgICAgcmV0dXJuIHRleHR1cmVDdWJlKHNvdXJjZUN1YmUsIG1vZGlmeVNlYW1zKGRpciwgMS4wIC0gc291cmNlQ3ViZVNlYW1TY2FsZSgpKSk7XG4gICAgfVxuXG4gICAgdmVjNCBzYW1wbGVDdWJlbWFwKHZlYzIgc3BoKSB7XG4gICAgcmV0dXJuIHNhbXBsZUN1YmVtYXAoZnJvbVNwaGVyaWNhbChzcGgpKTtcbn1cblxuICAgIHZlYzQgc2FtcGxlQ3ViZW1hcCh2ZWMzIGRpciwgZmxvYXQgbWlwTGV2ZWwpIHtcbiAgICAgICAgcmV0dXJuIHRleHR1cmVDdWJlTG9kRVhUKHNvdXJjZUN1YmUsIG1vZGlmeVNlYW1zKGRpciwgMS4wIC0gZXhwMihtaXBMZXZlbCkgKiBzb3VyY2VDdWJlU2VhbVNjYWxlKCkpLCBtaXBMZXZlbCk7XG4gICAgfVxuXG4gICAgdmVjNCBzYW1wbGVDdWJlbWFwKHZlYzIgc3BoLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgICAgICByZXR1cm4gc2FtcGxlQ3ViZW1hcChmcm9tU3BoZXJpY2FsKHNwaCksIG1pcExldmVsKTtcbiAgICB9XG4jZWxzZVxuXG4gICAgdmVjNCBzYW1wbGVFcXVpcmVjdCh2ZWMyIHNwaCkge1xuICAgICAgICB2ZWMyIHV2ID0gc3BoIC8gdmVjMihQSSAqIDIuMCwgUEkpICsgMC41O1xuICAgICAgICByZXR1cm4gdGV4dHVyZTJEKHNvdXJjZVRleCwgdmVjMih1di54LCAxLjAgLSB1di55KSk7XG4gICAgfVxuXG4gICAgdmVjNCBzYW1wbGVFcXVpcmVjdCh2ZWMzIGRpcikge1xuICAgICAgICByZXR1cm4gc2FtcGxlRXF1aXJlY3QodG9TcGhlcmljYWwoZGlyKSk7XG4gICAgfVxuXG4gICAgdmVjNCBzYW1wbGVFcXVpcmVjdCh2ZWMyIHNwaCwgZmxvYXQgbWlwTGV2ZWwpIHtcbiAgICAgICAgdmVjMiB1diA9IHNwaCAvIHZlYzIoUEkgKiAyLjAsIFBJKSArIDAuNTtcbiAgICAgICAgcmV0dXJuIHRleHR1cmUyRExvZEVYVChzb3VyY2VUZXgsIHZlYzIodXYueCwgMS4wIC0gdXYueSksIG1pcExldmVsKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZUVxdWlyZWN0KHZlYzMgZGlyLCBmbG9hdCBtaXBMZXZlbCkge1xuICAgICAgICByZXR1cm4gc2FtcGxlRXF1aXJlY3QodG9TcGhlcmljYWwoZGlyKSwgbWlwTGV2ZWwpO1xuICAgIH1cblxuICAgIHZlYzQgc2FtcGxlT2N0YWhlZHJhbCh2ZWMzIGRpcikge1xuICAgICAgICB2ZWMyIHV2ID0gb2N0RW5jb2RlKGRpcikgKiAwLjUgKyAwLjU7XG4gICAgICAgIHJldHVybiB0ZXh0dXJlMkQoc291cmNlVGV4LCB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZU9jdGFoZWRyYWwodmVjMiBzcGgpIHtcbiAgICAgICAgcmV0dXJuIHNhbXBsZU9jdGFoZWRyYWwoZnJvbVNwaGVyaWNhbChzcGgpKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZU9jdGFoZWRyYWwodmVjMyBkaXIsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgICAgIHZlYzIgdXYgPSBvY3RFbmNvZGUoZGlyKSAqIDAuNSArIDAuNTtcbiAgICAgICAgcmV0dXJuIHRleHR1cmUyRExvZEVYVChzb3VyY2VUZXgsIHZlYzIodXYueCwgMS4wIC0gdXYueSksIG1pcExldmVsKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZU9jdGFoZWRyYWwodmVjMiBzcGgsIGZsb2F0IG1pcExldmVsKSB7XG4gICAgICAgIHJldHVybiBzYW1wbGVPY3RhaGVkcmFsKGZyb21TcGhlcmljYWwoc3BoKSwgbWlwTGV2ZWwpO1xuICAgIH1cblxuI2VuZGlmXG5cbnZlYzMgZ2V0RGlyZWN0aW9uQ3ViZW1hcCgpIHtcbiAgICB2ZWMyIHN0ID0gdlV2MCAqIDIuMCAtIDEuMDtcbiAgICBmbG9hdCBmYWNlID0gdGFyZ2V0RmFjZSgpO1xuXG4gICAgdmVjMyB2ZWM7XG4gICAgaWYgKGZhY2UgPT0gMC4wKSB7XG4gICAgICAgIHZlYyA9IHZlYzMoMSwgLXN0LnksIC1zdC54KTtcbiAgICB9IGVsc2UgaWYgKGZhY2UgPT0gMS4wKSB7XG4gICAgICAgIHZlYyA9IHZlYzMoLTEsIC1zdC55LCBzdC54KTtcbiAgICB9IGVsc2UgaWYgKGZhY2UgPT0gMi4wKSB7XG4gICAgICAgIHZlYyA9IHZlYzMoc3QueCwgMSwgc3QueSk7XG4gICAgfSBlbHNlIGlmIChmYWNlID09IDMuMCkge1xuICAgICAgICB2ZWMgPSB2ZWMzKHN0LngsIC0xLCAtc3QueSk7XG4gICAgfSBlbHNlIGlmIChmYWNlID09IDQuMCkge1xuICAgICAgICB2ZWMgPSB2ZWMzKHN0LngsIC1zdC55LCAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2ZWMgPSB2ZWMzKC1zdC54LCAtc3QueSwgLTEpO1xuICAgIH1cblxuICAgIHJldHVybiBub3JtYWxpemUobW9kaWZ5U2VhbXModmVjLCAxLjAgLyAoMS4wIC0gdGFyZ2V0Q3ViZVNlYW1TY2FsZSgpKSkpO1xufVxuXG5tYXQzIG1hdHJpeEZyb21WZWN0b3IodmVjMyBuKSB7IC8vIGZyaXN2YWRcbiAgICBmbG9hdCBhID0gMS4wIC8gKDEuMCArIG4ueik7XG4gICAgZmxvYXQgYiA9IC1uLnggKiBuLnkgKiBhO1xuICAgIHZlYzMgYjEgPSB2ZWMzKDEuMCAtIG4ueCAqIG4ueCAqIGEsIGIsIC1uLngpO1xuICAgIHZlYzMgYjIgPSB2ZWMzKGIsIDEuMCAtIG4ueSAqIG4ueSAqIGEsIC1uLnkpO1xuICAgIHJldHVybiBtYXQzKGIxLCBiMiwgbik7XG59XG5cbm1hdDMgbWF0cml4RnJvbVZlY3RvclNsb3codmVjMyBuKSB7XG4gICAgdmVjMyB1cCA9ICgxLjAgLSBhYnMobi55KSA8PSAwLjAwMDAwMDEpID8gdmVjMygwLjAsIDAuMCwgbi55ID4gMC4wID8gMS4wIDogLTEuMCkgOiB2ZWMzKDAuMCwgMS4wLCAwLjApO1xuICAgIHZlYzMgeCA9IG5vcm1hbGl6ZShjcm9zcyh1cCwgbikpO1xuICAgIHZlYzMgeSA9IGNyb3NzKG4sIHgpO1xuICAgIHJldHVybiBtYXQzKHgsIHksIG4pO1xufVxuXG52ZWM0IHJlcHJvamVjdCgpIHtcbiAgICBpZiAoTlVNX1NBTVBMRVMgPD0gMSkge1xuICAgICAgICAvLyBzaW5nbGUgc2FtcGxlXG4gICAgICAgIHJldHVybiBFTkNPREVfRlVOQyhERUNPREVfRlVOQyhTT1VSQ0VfRlVOQyhUQVJHRVRfRlVOQygpKSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG11bHRpIHNhbXBsZVxuICAgICAgICB2ZWMzIHQgPSBUQVJHRVRfRlVOQygpO1xuICAgICAgICB2ZWMzIHR1ID0gZEZkeCh0KTtcbiAgICAgICAgdmVjMyB0diA9IGRGZHkodCk7XG5cbiAgICAgICAgdmVjMyByZXN1bHQgPSB2ZWMzKDAuMCk7XG4gICAgICAgIGZvciAoZmxvYXQgdSA9IDAuMDsgdSA8IE5VTV9TQU1QTEVTX1NRUlQ7ICsrdSkge1xuICAgICAgICAgICAgZm9yIChmbG9hdCB2ID0gMC4wOyB2IDwgTlVNX1NBTVBMRVNfU1FSVDsgKyt2KSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IERFQ09ERV9GVU5DKFNPVVJDRV9GVU5DKG5vcm1hbGl6ZSh0ICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR1ICogKHUgLyBOVU1fU0FNUExFU19TUVJUIC0gMC41KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0diAqICh2IC8gTlVNX1NBTVBMRVNfU1FSVCAtIDAuNSkpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIEVOQ09ERV9GVU5DKHJlc3VsdCAvIChOVU1fU0FNUExFU19TUVJUICogTlVNX1NBTVBMRVNfU1FSVCkpO1xuICAgIH1cbn1cblxudmVjNCB1bnBhY2tGbG9hdCA9IHZlYzQoMS4wLCAxLjAgLyAyNTUuMCwgMS4wIC8gNjUwMjUuMCwgMS4wIC8gMTY1ODEzNzUuMCk7XG5cbiNpZmRlZiBVU0VfU0FNUExFU19URVhcbiAgICB2b2lkIHVucGFja1NhbXBsZShpbnQgaSwgb3V0IHZlYzMgTCwgb3V0IGZsb2F0IG1pcExldmVsKSB7XG4gICAgICAgIGZsb2F0IHUgPSAoZmxvYXQoaSAqIDQpICsgMC41KSAqIHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS54O1xuICAgICAgICBmbG9hdCB2ID0gKGZsb29yKHUpICsgMC41KSAqIHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS55O1xuXG4gICAgICAgIHZlYzQgcmF3O1xuICAgICAgICByYXcueCA9IGRvdCh0ZXh0dXJlMkQoc2FtcGxlc1RleCwgdmVjMih1LCB2KSksIHVucGFja0Zsb2F0KTsgdSArPSBzYW1wbGVzVGV4SW52ZXJzZVNpemUueDtcbiAgICAgICAgcmF3LnkgPSBkb3QodGV4dHVyZTJEKHNhbXBsZXNUZXgsIHZlYzIodSwgdikpLCB1bnBhY2tGbG9hdCk7IHUgKz0gc2FtcGxlc1RleEludmVyc2VTaXplLng7XG4gICAgICAgIHJhdy56ID0gZG90KHRleHR1cmUyRChzYW1wbGVzVGV4LCB2ZWMyKHUsIHYpKSwgdW5wYWNrRmxvYXQpOyB1ICs9IHNhbXBsZXNUZXhJbnZlcnNlU2l6ZS54O1xuICAgICAgICByYXcudyA9IGRvdCh0ZXh0dXJlMkQoc2FtcGxlc1RleCwgdmVjMih1LCB2KSksIHVucGFja0Zsb2F0KTtcblxuICAgICAgICBMLnh5eiA9IHJhdy54eXogKiAyLjAgLSAxLjA7XG4gICAgICAgIG1pcExldmVsID0gcmF3LncgKiA4LjA7XG4gICAgfVxuXG4gICAgLy8gY29udm9sdmUgYW4gZW52aXJvbm1lbnQgZ2l2ZW4gcHJlLWdlbmVyYXRlZCBzYW1wbGVzXG4gICAgdmVjNCBwcmVmaWx0ZXJTYW1wbGVzKCkge1xuICAgICAgICAvLyBjb25zdHJ1Y3QgdmVjdG9yIHNwYWNlIGdpdmVuIHRhcmdldCBkaXJlY3Rpb25cbiAgICAgICAgbWF0MyB2ZWNTcGFjZSA9IG1hdHJpeEZyb21WZWN0b3JTbG93KFRBUkdFVF9GVU5DKCkpO1xuXG4gICAgICAgIHZlYzMgTDtcbiAgICAgICAgZmxvYXQgbWlwTGV2ZWw7XG5cbiAgICAgICAgdmVjMyByZXN1bHQgPSB2ZWMzKDAuMCk7XG4gICAgICAgIGZsb2F0IHRvdGFsV2VpZ2h0ID0gMC4wO1xuICAgICAgICBmb3IgKGludCBpID0gMDsgaSA8IE5VTV9TQU1QTEVTOyArK2kpIHtcbiAgICAgICAgICAgIHVucGFja1NhbXBsZShpLCBMLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICByZXN1bHQgKz0gREVDT0RFX0ZVTkMoU09VUkNFX0ZVTkModmVjU3BhY2UgKiBMLCBtaXBMZXZlbCkpICogTC56O1xuICAgICAgICAgICAgdG90YWxXZWlnaHQgKz0gTC56O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIEVOQ09ERV9GVU5DKHJlc3VsdCAvIHRvdGFsV2VpZ2h0KTtcbiAgICB9XG5cbiAgICAvLyB1bndlaWdodGVkIHZlcnNpb24gb2YgcHJlZmlsdGVyU2FtcGxlc1xuICAgIHZlYzQgcHJlZmlsdGVyU2FtcGxlc1Vud2VpZ2h0ZWQoKSB7XG4gICAgICAgIC8vIGNvbnN0cnVjdCB2ZWN0b3Igc3BhY2UgZ2l2ZW4gdGFyZ2V0IGRpcmVjdGlvblxuICAgICAgICBtYXQzIHZlY1NwYWNlID0gbWF0cml4RnJvbVZlY3RvclNsb3coVEFSR0VUX0ZVTkMoKSk7XG5cbiAgICAgICAgdmVjMyBMO1xuICAgICAgICBmbG9hdCBtaXBMZXZlbDtcblxuICAgICAgICB2ZWMzIHJlc3VsdCA9IHZlYzMoMC4wKTtcbiAgICAgICAgZmxvYXQgdG90YWxXZWlnaHQgPSAwLjA7XG4gICAgICAgIGZvciAoaW50IGkgPSAwOyBpIDwgTlVNX1NBTVBMRVM7ICsraSkge1xuICAgICAgICAgICAgdW5wYWNrU2FtcGxlKGksIEwsIG1pcExldmVsKTtcbiAgICAgICAgICAgIHJlc3VsdCArPSBERUNPREVfRlVOQyhTT1VSQ0VfRlVOQyh2ZWNTcGFjZSAqIEwsIG1pcExldmVsKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gRU5DT0RFX0ZVTkMocmVzdWx0IC8gZmxvYXQoTlVNX1NBTVBMRVMpKTtcbiAgICB9XG4jZW5kaWZcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBnbF9GcmFnQ29sb3IgPSBQUk9DRVNTX0ZVTkMoKTtcbn1cbmA7XG4iXSwibmFtZXMiOlsiZGVjb2RlIiwiZW5jb2RlIl0sIm1hcHBpbmdzIjoiOzs7QUFHQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUVBLFFBQU8sQ0FBQTtBQUNULEVBQUVDLFFBQU8sQ0FBQTtBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
