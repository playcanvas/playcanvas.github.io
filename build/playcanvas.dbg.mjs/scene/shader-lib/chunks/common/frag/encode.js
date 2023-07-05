var encodePS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5jb2RlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvZW5jb2RlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWM0IGVuY29kZUxpbmVhcih2ZWMzIHNvdXJjZSkge1xuICAgIHJldHVybiB2ZWM0KHNvdXJjZSwgMS4wKTtcbn1cblxudmVjNCBlbmNvZGVHYW1tYSh2ZWMzIHNvdXJjZSkge1xuICAgIHJldHVybiB2ZWM0KHBvdyhzb3VyY2UgKyAwLjAwMDAwMDEsIHZlYzMoMS4wIC8gMi4yKSksIDEuMCk7XG59XG5cbnZlYzQgZW5jb2RlUkdCTSh2ZWMzIHNvdXJjZSkgeyAvLyBtb2RpZmllZCBSR0JNXG4gICAgdmVjNCByZXN1bHQ7XG4gICAgcmVzdWx0LnJnYiA9IHBvdyhzb3VyY2UucmdiLCB2ZWMzKDAuNSkpO1xuICAgIHJlc3VsdC5yZ2IgKj0gMS4wIC8gOC4wO1xuXG4gICAgcmVzdWx0LmEgPSBzYXR1cmF0ZSggbWF4KCBtYXgoIHJlc3VsdC5yLCByZXN1bHQuZyApLCBtYXgoIHJlc3VsdC5iLCAxLjAgLyAyNTUuMCApICkgKTtcbiAgICByZXN1bHQuYSA9IGNlaWwocmVzdWx0LmEgKiAyNTUuMCkgLyAyNTUuMDtcblxuICAgIHJlc3VsdC5yZ2IgLz0gcmVzdWx0LmE7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxudmVjNCBlbmNvZGVSR0JQKHZlYzMgc291cmNlKSB7XG4gICAgLy8gY29udmVydCBpbmNvbWluZyBsaW5lYXIgdG8gZ2FtbWEoaXNoKVxuICAgIHZlYzMgZ2FtbWEgPSBwb3coc291cmNlLCB2ZWMzKDAuNSkpO1xuXG4gICAgLy8gY2FsY3VsYXRlIHRoZSBtYXhpbXVtIGNvbXBvbmVudCBjbGFtcGVkIHRvIDEuLjhcbiAgICBmbG9hdCBtYXhWYWwgPSBtaW4oOC4wLCBtYXgoMS4wLCBtYXgoZ2FtbWEueCwgbWF4KGdhbW1hLnksIGdhbW1hLnopKSkpO1xuXG4gICAgLy8gY2FsY3VsYXRlIHN0b3JhZ2UgZmFjdG9yXG4gICAgZmxvYXQgdiA9IDEuMCAtICgobWF4VmFsIC0gMS4wKSAvIDcuMCk7XG5cbiAgICAvLyByb3VuZCB0aGUgdmFsdWUgZm9yIHN0b3JhZ2UgaW4gOGJpdCBjaGFubmVsXG4gICAgdiA9IGNlaWwodiAqIDI1NS4wKSAvIDI1NS4wO1xuXG4gICAgcmV0dXJuIHZlYzQoZ2FtbWEgLyAoLXYgKiA3LjAgKyA4LjApLCB2KTsgICAgXG59XG5cbnZlYzQgZW5jb2RlUkdCRSh2ZWMzIHNvdXJjZSkge1xuICAgIGZsb2F0IG1heFZhbCA9IG1heChzb3VyY2UueCwgbWF4KHNvdXJjZS55LCBzb3VyY2UueikpO1xuICAgIGlmIChtYXhWYWwgPCAxZS0zMikge1xuICAgICAgICByZXR1cm4gdmVjNCgwLCAwLCAwLCAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmbG9hdCBlID0gY2VpbChsb2cyKG1heFZhbCkpO1xuICAgICAgICByZXR1cm4gdmVjNChzb3VyY2UgLyBwb3coMi4wLCBlKSwgKGUgKyAxMjguMCkgLyAyNTUuMCk7XG4gICAgfVxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxlQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
