/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleInputRgba8PS = `
//RG=X, BA=Y
//RG=Z, BA=A
//RGB=V, A=visMode
//RGBA=life

#define PI2 6.283185307179586

uniform vec3 inBoundsSize;
uniform vec3 inBoundsCenter;

uniform float maxVel;

float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

float decodeFloatRGBA( vec4 rgba ) {
  return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}

void readInput(float uv) {
    vec4 tex0 = texture2D(particleTexIN, vec2(uv, 0.125));
    vec4 tex1 = texture2D(particleTexIN, vec2(uv, 0.375));
    vec4 tex2 = texture2D(particleTexIN, vec2(uv, 0.625));
    vec4 tex3 = texture2D(particleTexIN, vec2(uv, 0.875));

    inPos = vec3(decodeFloatRG(tex0.rg), decodeFloatRG(tex0.ba), decodeFloatRG(tex1.rg));
    inPos = (inPos - vec3(0.5)) * inBoundsSize + inBoundsCenter;

    inVel = tex2.xyz;
    inVel = (inVel - vec3(0.5)) * maxVel;

    inAngle = decodeFloatRG(tex1.ba) * PI2;
    inShow = tex2.a > 0.5;

    inLife = decodeFloatRGBA(tex3);
    float maxNegLife = max(lifetime, (numParticles - 1.0) * (rate+rateDiv));
    float maxPosLife = lifetime+1.0;
    inLife = inLife * (maxNegLife + maxPosLife) - maxNegLife;
}
`;

export { particleInputRgba8PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVJbnB1dFJnYmE4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVJbnB1dFJnYmE4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vL1JHPVgsIEJBPVlcbi8vUkc9WiwgQkE9QVxuLy9SR0I9ViwgQT12aXNNb2RlXG4vL1JHQkE9bGlmZVxuXG4jZGVmaW5lIFBJMiA2LjI4MzE4NTMwNzE3OTU4NlxuXG51bmlmb3JtIHZlYzMgaW5Cb3VuZHNTaXplO1xudW5pZm9ybSB2ZWMzIGluQm91bmRzQ2VudGVyO1xuXG51bmlmb3JtIGZsb2F0IG1heFZlbDtcblxuZmxvYXQgZGVjb2RlRmxvYXRSRyh2ZWMyIHJnKSB7XG4gICAgcmV0dXJuIHJnLnkqKDEuMC8yNTUuMCkgKyByZy54O1xufVxuXG5mbG9hdCBkZWNvZGVGbG9hdFJHQkEoIHZlYzQgcmdiYSApIHtcbiAgcmV0dXJuIGRvdCggcmdiYSwgdmVjNCgxLjAsIDEuMC8yNTUuMCwgMS4wLzY1MDI1LjAsIDEuMC8xNjA1ODEzNzUuMCkgKTtcbn1cblxudm9pZCByZWFkSW5wdXQoZmxvYXQgdXYpIHtcbiAgICB2ZWM0IHRleDAgPSB0ZXh0dXJlMkQocGFydGljbGVUZXhJTiwgdmVjMih1diwgMC4xMjUpKTtcbiAgICB2ZWM0IHRleDEgPSB0ZXh0dXJlMkQocGFydGljbGVUZXhJTiwgdmVjMih1diwgMC4zNzUpKTtcbiAgICB2ZWM0IHRleDIgPSB0ZXh0dXJlMkQocGFydGljbGVUZXhJTiwgdmVjMih1diwgMC42MjUpKTtcbiAgICB2ZWM0IHRleDMgPSB0ZXh0dXJlMkQocGFydGljbGVUZXhJTiwgdmVjMih1diwgMC44NzUpKTtcblxuICAgIGluUG9zID0gdmVjMyhkZWNvZGVGbG9hdFJHKHRleDAucmcpLCBkZWNvZGVGbG9hdFJHKHRleDAuYmEpLCBkZWNvZGVGbG9hdFJHKHRleDEucmcpKTtcbiAgICBpblBvcyA9IChpblBvcyAtIHZlYzMoMC41KSkgKiBpbkJvdW5kc1NpemUgKyBpbkJvdW5kc0NlbnRlcjtcblxuICAgIGluVmVsID0gdGV4Mi54eXo7XG4gICAgaW5WZWwgPSAoaW5WZWwgLSB2ZWMzKDAuNSkpICogbWF4VmVsO1xuXG4gICAgaW5BbmdsZSA9IGRlY29kZUZsb2F0UkcodGV4MS5iYSkgKiBQSTI7XG4gICAgaW5TaG93ID0gdGV4Mi5hID4gMC41O1xuXG4gICAgaW5MaWZlID0gZGVjb2RlRmxvYXRSR0JBKHRleDMpO1xuICAgIGZsb2F0IG1heE5lZ0xpZmUgPSBtYXgobGlmZXRpbWUsIChudW1QYXJ0aWNsZXMgLSAxLjApICogKHJhdGUrcmF0ZURpdikpO1xuICAgIGZsb2F0IG1heFBvc0xpZmUgPSBsaWZldGltZSsxLjA7XG4gICAgaW5MaWZlID0gaW5MaWZlICogKG1heE5lZ0xpZmUgKyBtYXhQb3NMaWZlKSAtIG1heE5lZ0xpZmU7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMkJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXpDQTs7OzsifQ==
