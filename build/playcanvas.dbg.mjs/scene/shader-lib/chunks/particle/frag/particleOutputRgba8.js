var particleOutputRgba8PS = /* glsl */`
uniform vec3 outBoundsMul;
uniform vec3 outBoundsAdd;

vec2 encodeFloatRG( float v ) {
    vec2 enc = vec2(1.0, 255.0) * v;
    enc = fract(enc);
    enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);
    return enc;
}

vec4 encodeFloatRGBA( float v ) {
    vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;
    enc = fract(enc);
    enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
    return enc;
}

void writeOutput() {
    outPos = outPos * outBoundsMul + outBoundsAdd;
    outAngle = fract(outAngle / PI2);

    outVel = (outVel / maxVel) + vec3(0.5); // TODO: mul

    float maxNegLife = max(lifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = lifetime+1.0;
    outLife = (outLife + maxNegLife) / (maxNegLife + maxPosLife);

    if (gl_FragCoord.y < 1.0) {
        gl_FragColor = vec4(encodeFloatRG(outPos.x), encodeFloatRG(outPos.y));
    } else if (gl_FragCoord.y < 2.0) {
        gl_FragColor = vec4(encodeFloatRG(outPos.z), encodeFloatRG(outAngle));
    } else if (gl_FragCoord.y < 3.0) {
        gl_FragColor = vec4(outVel, visMode*0.5+0.5);
    } else {
        gl_FragColor = encodeFloatRGBA(outLife);
    }
}
`;

export { particleOutputRgba8PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVPdXRwdXRSZ2JhOC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVPdXRwdXRSZ2JhOC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSB2ZWMzIG91dEJvdW5kc011bDtcbnVuaWZvcm0gdmVjMyBvdXRCb3VuZHNBZGQ7XG5cbnZlYzIgZW5jb2RlRmxvYXRSRyggZmxvYXQgdiApIHtcbiAgICB2ZWMyIGVuYyA9IHZlYzIoMS4wLCAyNTUuMCkgKiB2O1xuICAgIGVuYyA9IGZyYWN0KGVuYyk7XG4gICAgZW5jIC09IGVuYy55eSAqIHZlYzIoMS4wLzI1NS4wLCAxLjAvMjU1LjApO1xuICAgIHJldHVybiBlbmM7XG59XG5cbnZlYzQgZW5jb2RlRmxvYXRSR0JBKCBmbG9hdCB2ICkge1xuICAgIHZlYzQgZW5jID0gdmVjNCgxLjAsIDI1NS4wLCA2NTAyNS4wLCAxNjA1ODEzNzUuMCkgKiB2O1xuICAgIGVuYyA9IGZyYWN0KGVuYyk7XG4gICAgZW5jIC09IGVuYy55end3ICogdmVjNCgxLjAvMjU1LjAsMS4wLzI1NS4wLDEuMC8yNTUuMCwwLjApO1xuICAgIHJldHVybiBlbmM7XG59XG5cbnZvaWQgd3JpdGVPdXRwdXQoKSB7XG4gICAgb3V0UG9zID0gb3V0UG9zICogb3V0Qm91bmRzTXVsICsgb3V0Qm91bmRzQWRkO1xuICAgIG91dEFuZ2xlID0gZnJhY3Qob3V0QW5nbGUgLyBQSTIpO1xuXG4gICAgb3V0VmVsID0gKG91dFZlbCAvIG1heFZlbCkgKyB2ZWMzKDAuNSk7IC8vIFRPRE86IG11bFxuXG4gICAgZmxvYXQgbWF4TmVnTGlmZSA9IG1heChsaWZldGltZSwgKG51bVBhcnRpY2xlcyAtIDEuMCkgKiAocmF0ZStyYXRlRGl2KSk7XG4gICAgZmxvYXQgbWF4UG9zTGlmZSA9IGxpZmV0aW1lKzEuMDtcbiAgICBvdXRMaWZlID0gKG91dExpZmUgKyBtYXhOZWdMaWZlKSAvIChtYXhOZWdMaWZlICsgbWF4UG9zTGlmZSk7XG5cbiAgICBpZiAoZ2xfRnJhZ0Nvb3JkLnkgPCAxLjApIHtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChlbmNvZGVGbG9hdFJHKG91dFBvcy54KSwgZW5jb2RlRmxvYXRSRyhvdXRQb3MueSkpO1xuICAgIH0gZWxzZSBpZiAoZ2xfRnJhZ0Nvb3JkLnkgPCAyLjApIHtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChlbmNvZGVGbG9hdFJHKG91dFBvcy56KSwgZW5jb2RlRmxvYXRSRyhvdXRBbmdsZSkpO1xuICAgIH0gZWxzZSBpZiAoZ2xfRnJhZ0Nvb3JkLnkgPCAzLjApIHtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChvdXRWZWwsIHZpc01vZGUqMC41KzAuNSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yID0gZW5jb2RlRmxvYXRSR0JBKG91dExpZmUpO1xuICAgIH1cbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsNEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
