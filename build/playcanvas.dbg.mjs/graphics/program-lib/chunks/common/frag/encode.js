/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var encodePS = `
vec4 encodeLinear(vec3 source) {
    return vec4(source, 1.0);
}

vec4 encodeGamma(vec3 source) {
    return vec4(pow(source + 0.0000001, vec3(1.0 / 2.2)), 1.0);
}

vec4 encodeRGBM(vec3 source) { // modified RGBM
    vec4 result;
    result.rgb = pow(source.rgb, vec3(0.5));
    result.rgb *= 1.0 / 8.0;

    result.a = saturate( max( max( result.r, result.g ), max( result.b, 1.0 / 255.0 ) ) );
    result.a = ceil(result.a * 255.0) / 255.0;

    result.rgb /= result.a;
    return result;
}

vec4 encodeRGBP(vec3 source) {
    // convert incoming linear to gamma(ish)
    vec3 gamma = pow(source, vec3(0.5));

    // calculate the maximum component clamped to 1..8
    float maxVal = min(8.0, max(1.0, max(gamma.x, max(gamma.y, gamma.z))));

    // calculate storage factor
    float v = 1.0 - ((maxVal - 1.0) / 7.0);

    // round the value for storage in 8bit channel
    v = ceil(v * 255.0) / 255.0;

    return vec4(gamma / (-v * 7.0 + 8.0), v);    
}

vec4 encodeRGBE(vec3 source) {
    float maxVal = max(source.x, max(source.y, source.z));
    if (maxVal < 1e-32) {
        return vec4(0, 0, 0, 0);
    } else {
        float e = ceil(log2(maxVal));
        return vec4(source / pow(2.0, e), (e + 128.0) / 255.0);
    }
}
`;

export { encodePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5jb2RlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL2VuY29kZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjNCBlbmNvZGVMaW5lYXIodmVjMyBzb3VyY2UpIHtcbiAgICByZXR1cm4gdmVjNChzb3VyY2UsIDEuMCk7XG59XG5cbnZlYzQgZW5jb2RlR2FtbWEodmVjMyBzb3VyY2UpIHtcbiAgICByZXR1cm4gdmVjNChwb3coc291cmNlICsgMC4wMDAwMDAxLCB2ZWMzKDEuMCAvIDIuMikpLCAxLjApO1xufVxuXG52ZWM0IGVuY29kZVJHQk0odmVjMyBzb3VyY2UpIHsgLy8gbW9kaWZpZWQgUkdCTVxuICAgIHZlYzQgcmVzdWx0O1xuICAgIHJlc3VsdC5yZ2IgPSBwb3coc291cmNlLnJnYiwgdmVjMygwLjUpKTtcbiAgICByZXN1bHQucmdiICo9IDEuMCAvIDguMDtcblxuICAgIHJlc3VsdC5hID0gc2F0dXJhdGUoIG1heCggbWF4KCByZXN1bHQuciwgcmVzdWx0LmcgKSwgbWF4KCByZXN1bHQuYiwgMS4wIC8gMjU1LjAgKSApICk7XG4gICAgcmVzdWx0LmEgPSBjZWlsKHJlc3VsdC5hICogMjU1LjApIC8gMjU1LjA7XG5cbiAgICByZXN1bHQucmdiIC89IHJlc3VsdC5hO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbnZlYzQgZW5jb2RlUkdCUCh2ZWMzIHNvdXJjZSkge1xuICAgIC8vIGNvbnZlcnQgaW5jb21pbmcgbGluZWFyIHRvIGdhbW1hKGlzaClcbiAgICB2ZWMzIGdhbW1hID0gcG93KHNvdXJjZSwgdmVjMygwLjUpKTtcblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgbWF4aW11bSBjb21wb25lbnQgY2xhbXBlZCB0byAxLi44XG4gICAgZmxvYXQgbWF4VmFsID0gbWluKDguMCwgbWF4KDEuMCwgbWF4KGdhbW1hLngsIG1heChnYW1tYS55LCBnYW1tYS56KSkpKTtcblxuICAgIC8vIGNhbGN1bGF0ZSBzdG9yYWdlIGZhY3RvclxuICAgIGZsb2F0IHYgPSAxLjAgLSAoKG1heFZhbCAtIDEuMCkgLyA3LjApO1xuXG4gICAgLy8gcm91bmQgdGhlIHZhbHVlIGZvciBzdG9yYWdlIGluIDhiaXQgY2hhbm5lbFxuICAgIHYgPSBjZWlsKHYgKiAyNTUuMCkgLyAyNTUuMDtcblxuICAgIHJldHVybiB2ZWM0KGdhbW1hIC8gKC12ICogNy4wICsgOC4wKSwgdik7ICAgIFxufVxuXG52ZWM0IGVuY29kZVJHQkUodmVjMyBzb3VyY2UpIHtcbiAgICBmbG9hdCBtYXhWYWwgPSBtYXgoc291cmNlLngsIG1heChzb3VyY2UueSwgc291cmNlLnopKTtcbiAgICBpZiAobWF4VmFsIDwgMWUtMzIpIHtcbiAgICAgICAgcmV0dXJuIHZlYzQoMCwgMCwgMCwgMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZmxvYXQgZSA9IGNlaWwobG9nMihtYXhWYWwpKTtcbiAgICAgICAgcmV0dXJuIHZlYzQoc291cmNlIC8gcG93KDIuMCwgZSksIChlICsgMTI4LjApIC8gMjU1LjApO1xuICAgIH1cbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxlQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBOUNBOzs7OyJ9
