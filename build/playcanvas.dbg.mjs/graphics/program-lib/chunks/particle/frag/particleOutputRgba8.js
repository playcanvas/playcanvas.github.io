/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleOutputRgba8PS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVPdXRwdXRSZ2JhOC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlT3V0cHV0UmdiYTguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gdmVjMyBvdXRCb3VuZHNNdWw7XG51bmlmb3JtIHZlYzMgb3V0Qm91bmRzQWRkO1xuXG52ZWMyIGVuY29kZUZsb2F0UkcoIGZsb2F0IHYgKSB7XG4gICAgdmVjMiBlbmMgPSB2ZWMyKDEuMCwgMjU1LjApICogdjtcbiAgICBlbmMgPSBmcmFjdChlbmMpO1xuICAgIGVuYyAtPSBlbmMueXkgKiB2ZWMyKDEuMC8yNTUuMCwgMS4wLzI1NS4wKTtcbiAgICByZXR1cm4gZW5jO1xufVxuXG52ZWM0IGVuY29kZUZsb2F0UkdCQSggZmxvYXQgdiApIHtcbiAgICB2ZWM0IGVuYyA9IHZlYzQoMS4wLCAyNTUuMCwgNjUwMjUuMCwgMTYwNTgxMzc1LjApICogdjtcbiAgICBlbmMgPSBmcmFjdChlbmMpO1xuICAgIGVuYyAtPSBlbmMueXp3dyAqIHZlYzQoMS4wLzI1NS4wLDEuMC8yNTUuMCwxLjAvMjU1LjAsMC4wKTtcbiAgICByZXR1cm4gZW5jO1xufVxuXG52b2lkIHdyaXRlT3V0cHV0KCkge1xuICAgIG91dFBvcyA9IG91dFBvcyAqIG91dEJvdW5kc011bCArIG91dEJvdW5kc0FkZDtcbiAgICBvdXRBbmdsZSA9IGZyYWN0KG91dEFuZ2xlIC8gUEkyKTtcblxuICAgIG91dFZlbCA9IChvdXRWZWwgLyBtYXhWZWwpICsgdmVjMygwLjUpOyAvLyBUT0RPOiBtdWxcblxuICAgIGZsb2F0IG1heE5lZ0xpZmUgPSBtYXgobGlmZXRpbWUsIChudW1QYXJ0aWNsZXMgLSAxLjApICogKHJhdGUrcmF0ZURpdikpO1xuICAgIGZsb2F0IG1heFBvc0xpZmUgPSBsaWZldGltZSsxLjA7XG4gICAgb3V0TGlmZSA9IChvdXRMaWZlICsgbWF4TmVnTGlmZSkgLyAobWF4TmVnTGlmZSArIG1heFBvc0xpZmUpO1xuXG4gICAgaWYgKGdsX0ZyYWdDb29yZC55IDwgMS4wKSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZW5jb2RlRmxvYXRSRyhvdXRQb3MueCksIGVuY29kZUZsb2F0Ukcob3V0UG9zLnkpKTtcbiAgICB9IGVsc2UgaWYgKGdsX0ZyYWdDb29yZC55IDwgMi4wKSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZW5jb2RlRmxvYXRSRyhvdXRQb3MueiksIGVuY29kZUZsb2F0Ukcob3V0QW5nbGUpKTtcbiAgICB9IGVsc2UgaWYgKGdsX0ZyYWdDb29yZC55IDwgMy4wKSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQob3V0VmVsLCB2aXNNb2RlKjAuNSswLjUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IGVuY29kZUZsb2F0UkdCQShvdXRMaWZlKTtcbiAgICB9XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXRDQTs7OzsifQ==
