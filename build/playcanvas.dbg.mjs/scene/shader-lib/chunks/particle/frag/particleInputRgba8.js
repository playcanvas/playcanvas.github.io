var particleInputRgba8PS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVJbnB1dFJnYmE4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZUlucHV0UmdiYTguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2Bcbi8vUkc9WCwgQkE9WVxuLy9SRz1aLCBCQT1BXG4vL1JHQj1WLCBBPXZpc01vZGVcbi8vUkdCQT1saWZlXG5cbiNkZWZpbmUgUEkyIDYuMjgzMTg1MzA3MTc5NTg2XG5cbnVuaWZvcm0gdmVjMyBpbkJvdW5kc1NpemU7XG51bmlmb3JtIHZlYzMgaW5Cb3VuZHNDZW50ZXI7XG5cbnVuaWZvcm0gZmxvYXQgbWF4VmVsO1xuXG5mbG9hdCBkZWNvZGVGbG9hdFJHKHZlYzIgcmcpIHtcbiAgICByZXR1cm4gcmcueSooMS4wLzI1NS4wKSArIHJnLng7XG59XG5cbmZsb2F0IGRlY29kZUZsb2F0UkdCQSggdmVjNCByZ2JhICkge1xuICByZXR1cm4gZG90KCByZ2JhLCB2ZWM0KDEuMCwgMS4wLzI1NS4wLCAxLjAvNjUwMjUuMCwgMS4wLzE2MDU4MTM3NS4wKSApO1xufVxuXG52b2lkIHJlYWRJbnB1dChmbG9hdCB1dikge1xuICAgIHZlYzQgdGV4MCA9IHRleHR1cmUyRChwYXJ0aWNsZVRleElOLCB2ZWMyKHV2LCAwLjEyNSkpO1xuICAgIHZlYzQgdGV4MSA9IHRleHR1cmUyRChwYXJ0aWNsZVRleElOLCB2ZWMyKHV2LCAwLjM3NSkpO1xuICAgIHZlYzQgdGV4MiA9IHRleHR1cmUyRChwYXJ0aWNsZVRleElOLCB2ZWMyKHV2LCAwLjYyNSkpO1xuICAgIHZlYzQgdGV4MyA9IHRleHR1cmUyRChwYXJ0aWNsZVRleElOLCB2ZWMyKHV2LCAwLjg3NSkpO1xuXG4gICAgaW5Qb3MgPSB2ZWMzKGRlY29kZUZsb2F0UkcodGV4MC5yZyksIGRlY29kZUZsb2F0UkcodGV4MC5iYSksIGRlY29kZUZsb2F0UkcodGV4MS5yZykpO1xuICAgIGluUG9zID0gKGluUG9zIC0gdmVjMygwLjUpKSAqIGluQm91bmRzU2l6ZSArIGluQm91bmRzQ2VudGVyO1xuXG4gICAgaW5WZWwgPSB0ZXgyLnh5ejtcbiAgICBpblZlbCA9IChpblZlbCAtIHZlYzMoMC41KSkgKiBtYXhWZWw7XG5cbiAgICBpbkFuZ2xlID0gZGVjb2RlRmxvYXRSRyh0ZXgxLmJhKSAqIFBJMjtcbiAgICBpblNob3cgPSB0ZXgyLmEgPiAwLjU7XG5cbiAgICBpbkxpZmUgPSBkZWNvZGVGbG9hdFJHQkEodGV4Myk7XG4gICAgZmxvYXQgbWF4TmVnTGlmZSA9IG1heChsaWZldGltZSwgKG51bVBhcnRpY2xlcyAtIDEuMCkgKiAocmF0ZStyYXRlRGl2KSk7XG4gICAgZmxvYXQgbWF4UG9zTGlmZSA9IGxpZmV0aW1lKzEuMDtcbiAgICBpbkxpZmUgPSBpbkxpZmUgKiAobWF4TmVnTGlmZSArIG1heFBvc0xpZmUpIC0gbWF4TmVnTGlmZTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMkJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
