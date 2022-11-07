/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_cpuVS = `
attribute vec4 particle_vertexData;   // XYZ = world pos, W = life
attribute vec4 particle_vertexData2;  // X = angle, Y = scale, Z = alpha, W = velocity.x
attribute vec4 particle_vertexData3;  // XYZ = particle local pos, W = velocity.y
attribute float particle_vertexData4; // particle id
#ifndef USE_MESH
#define VDATA5TYPE vec2
#else
#define VDATA5TYPE vec4
#endif
attribute VDATA5TYPE particle_vertexData5; // VDATA4TYPE depends on useMesh property. Start with X = velocity.z, Y = particle ID and for mesh particles proceeds with Z = mesh UV.x, W = mesh UV.y

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

uniform mat3 matrix_normal;
uniform mat4 matrix_viewInverse;

uniform float numParticles;
uniform float lifetime;
uniform float stretch;
uniform float seed;
uniform vec3 wrapBounds, emitterScale, faceTangent, faceBinorm;
uniform sampler2D texLifeAndSourcePosOUT;
uniform highp sampler2D internalTex0;
uniform highp sampler2D internalTex1;
uniform highp sampler2D internalTex2;
uniform vec3 emitterPos;

varying vec4 texCoordsAlphaLife;

vec2 rotate(vec2 quadXY, float pRotation, out mat2 rotMatrix)
{
    float c = cos(pRotation);
    float s = sin(pRotation);
    //vec4 rotationMatrix = vec4(c, -s, s, c);

    mat2 m = mat2(c, -s, s, c);
    rotMatrix = m;

    return m * quadXY;
}

vec3 billboard(vec3 InstanceCoords, vec2 quadXY)
{
    vec3 pos = -matrix_viewInverse[0].xyz * quadXY.x + -matrix_viewInverse[1].xyz * quadXY.y;
    return pos;
}

vec3 customFace(vec3 InstanceCoords, vec2 quadXY)
{
    vec3 pos = faceTangent * quadXY.x + faceBinorm * quadXY.y;
    return pos;
}

void main(void)
{
    vec3 particlePos = particle_vertexData.xyz;
    vec3 inPos = particlePos;
    vec3 vertPos = particle_vertexData3.xyz;
    vec3 inVel = vec3(particle_vertexData2.w, particle_vertexData3.w, particle_vertexData5.x);

    float id = floor(particle_vertexData4);
    float rndFactor = fract(sin(id + 1.0 + seed));
    vec3 rndFactor3 = vec3(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

#ifdef LOCAL_SPACE
    inVel = mat3(matrix_model) * inVel;
#endif
    vec2 velocityV = normalize((mat3(matrix_view) * inVel).xy); // should be removed by compiler if align/stretch is not used

    vec2 quadXY = vertPos.xy;

#ifdef USE_MESH
    texCoordsAlphaLife = vec4(particle_vertexData5.zw, particle_vertexData2.z, particle_vertexData.w);
#else
    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5, particle_vertexData2.z, particle_vertexData.w);
#endif
    mat2 rotMatrix;

    float inAngle = particle_vertexData2.x;
    vec3 particlePosMoved = vec3(0.0);
    vec3 meshLocalPos = particle_vertexData3.xyz;
`;

export { particle_cpuVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfY3B1LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfY3B1LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjNCBwYXJ0aWNsZV92ZXJ0ZXhEYXRhOyAgIC8vIFhZWiA9IHdvcmxkIHBvcywgVyA9IGxpZmVcbmF0dHJpYnV0ZSB2ZWM0IHBhcnRpY2xlX3ZlcnRleERhdGEyOyAgLy8gWCA9IGFuZ2xlLCBZID0gc2NhbGUsIFogPSBhbHBoYSwgVyA9IHZlbG9jaXR5LnhcbmF0dHJpYnV0ZSB2ZWM0IHBhcnRpY2xlX3ZlcnRleERhdGEzOyAgLy8gWFlaID0gcGFydGljbGUgbG9jYWwgcG9zLCBXID0gdmVsb2NpdHkueVxuYXR0cmlidXRlIGZsb2F0IHBhcnRpY2xlX3ZlcnRleERhdGE0OyAvLyBwYXJ0aWNsZSBpZFxuI2lmbmRlZiBVU0VfTUVTSFxuI2RlZmluZSBWREFUQTVUWVBFIHZlYzJcbiNlbHNlXG4jZGVmaW5lIFZEQVRBNVRZUEUgdmVjNFxuI2VuZGlmXG5hdHRyaWJ1dGUgVkRBVEE1VFlQRSBwYXJ0aWNsZV92ZXJ0ZXhEYXRhNTsgLy8gVkRBVEE0VFlQRSBkZXBlbmRzIG9uIHVzZU1lc2ggcHJvcGVydHkuIFN0YXJ0IHdpdGggWCA9IHZlbG9jaXR5LnosIFkgPSBwYXJ0aWNsZSBJRCBhbmQgZm9yIG1lc2ggcGFydGljbGVzIHByb2NlZWRzIHdpdGggWiA9IG1lc2ggVVYueCwgVyA9IG1lc2ggVVYueVxuXG51bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXdQcm9qZWN0aW9uO1xudW5pZm9ybSBtYXQ0IG1hdHJpeF9tb2RlbDtcblxuI2lmbmRlZiBWSUVXTUFUUklYXG4jZGVmaW5lIFZJRVdNQVRSSVhcbnVuaWZvcm0gbWF0NCBtYXRyaXhfdmlldztcbiNlbmRpZlxuXG51bmlmb3JtIG1hdDMgbWF0cml4X25vcm1hbDtcbnVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld0ludmVyc2U7XG5cbnVuaWZvcm0gZmxvYXQgbnVtUGFydGljbGVzO1xudW5pZm9ybSBmbG9hdCBsaWZldGltZTtcbnVuaWZvcm0gZmxvYXQgc3RyZXRjaDtcbnVuaWZvcm0gZmxvYXQgc2VlZDtcbnVuaWZvcm0gdmVjMyB3cmFwQm91bmRzLCBlbWl0dGVyU2NhbGUsIGZhY2VUYW5nZW50LCBmYWNlQmlub3JtO1xudW5pZm9ybSBzYW1wbGVyMkQgdGV4TGlmZUFuZFNvdXJjZVBvc09VVDtcbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIGludGVybmFsVGV4MDtcbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIGludGVybmFsVGV4MTtcbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIGludGVybmFsVGV4MjtcbnVuaWZvcm0gdmVjMyBlbWl0dGVyUG9zO1xuXG52YXJ5aW5nIHZlYzQgdGV4Q29vcmRzQWxwaGFMaWZlO1xuXG52ZWMyIHJvdGF0ZSh2ZWMyIHF1YWRYWSwgZmxvYXQgcFJvdGF0aW9uLCBvdXQgbWF0MiByb3RNYXRyaXgpXG57XG4gICAgZmxvYXQgYyA9IGNvcyhwUm90YXRpb24pO1xuICAgIGZsb2F0IHMgPSBzaW4ocFJvdGF0aW9uKTtcbiAgICAvL3ZlYzQgcm90YXRpb25NYXRyaXggPSB2ZWM0KGMsIC1zLCBzLCBjKTtcblxuICAgIG1hdDIgbSA9IG1hdDIoYywgLXMsIHMsIGMpO1xuICAgIHJvdE1hdHJpeCA9IG07XG5cbiAgICByZXR1cm4gbSAqIHF1YWRYWTtcbn1cblxudmVjMyBiaWxsYm9hcmQodmVjMyBJbnN0YW5jZUNvb3JkcywgdmVjMiBxdWFkWFkpXG57XG4gICAgdmVjMyBwb3MgPSAtbWF0cml4X3ZpZXdJbnZlcnNlWzBdLnh5eiAqIHF1YWRYWS54ICsgLW1hdHJpeF92aWV3SW52ZXJzZVsxXS54eXogKiBxdWFkWFkueTtcbiAgICByZXR1cm4gcG9zO1xufVxuXG52ZWMzIGN1c3RvbUZhY2UodmVjMyBJbnN0YW5jZUNvb3JkcywgdmVjMiBxdWFkWFkpXG57XG4gICAgdmVjMyBwb3MgPSBmYWNlVGFuZ2VudCAqIHF1YWRYWS54ICsgZmFjZUJpbm9ybSAqIHF1YWRYWS55O1xuICAgIHJldHVybiBwb3M7XG59XG5cbnZvaWQgbWFpbih2b2lkKVxue1xuICAgIHZlYzMgcGFydGljbGVQb3MgPSBwYXJ0aWNsZV92ZXJ0ZXhEYXRhLnh5ejtcbiAgICB2ZWMzIGluUG9zID0gcGFydGljbGVQb3M7XG4gICAgdmVjMyB2ZXJ0UG9zID0gcGFydGljbGVfdmVydGV4RGF0YTMueHl6O1xuICAgIHZlYzMgaW5WZWwgPSB2ZWMzKHBhcnRpY2xlX3ZlcnRleERhdGEyLncsIHBhcnRpY2xlX3ZlcnRleERhdGEzLncsIHBhcnRpY2xlX3ZlcnRleERhdGE1LngpO1xuXG4gICAgZmxvYXQgaWQgPSBmbG9vcihwYXJ0aWNsZV92ZXJ0ZXhEYXRhNCk7XG4gICAgZmxvYXQgcm5kRmFjdG9yID0gZnJhY3Qoc2luKGlkICsgMS4wICsgc2VlZCkpO1xuICAgIHZlYzMgcm5kRmFjdG9yMyA9IHZlYzMocm5kRmFjdG9yLCBmcmFjdChybmRGYWN0b3IqMTAuMCksIGZyYWN0KHJuZEZhY3RvcioxMDAuMCkpO1xuXG4jaWZkZWYgTE9DQUxfU1BBQ0VcbiAgICBpblZlbCA9IG1hdDMobWF0cml4X21vZGVsKSAqIGluVmVsO1xuI2VuZGlmXG4gICAgdmVjMiB2ZWxvY2l0eVYgPSBub3JtYWxpemUoKG1hdDMobWF0cml4X3ZpZXcpICogaW5WZWwpLnh5KTsgLy8gc2hvdWxkIGJlIHJlbW92ZWQgYnkgY29tcGlsZXIgaWYgYWxpZ24vc3RyZXRjaCBpcyBub3QgdXNlZFxuXG4gICAgdmVjMiBxdWFkWFkgPSB2ZXJ0UG9zLnh5O1xuXG4jaWZkZWYgVVNFX01FU0hcbiAgICB0ZXhDb29yZHNBbHBoYUxpZmUgPSB2ZWM0KHBhcnRpY2xlX3ZlcnRleERhdGE1Lnp3LCBwYXJ0aWNsZV92ZXJ0ZXhEYXRhMi56LCBwYXJ0aWNsZV92ZXJ0ZXhEYXRhLncpO1xuI2Vsc2VcbiAgICB0ZXhDb29yZHNBbHBoYUxpZmUgPSB2ZWM0KHF1YWRYWSAqIC0wLjUgKyAwLjUsIHBhcnRpY2xlX3ZlcnRleERhdGEyLnosIHBhcnRpY2xlX3ZlcnRleERhdGEudyk7XG4jZW5kaWZcbiAgICBtYXQyIHJvdE1hdHJpeDtcblxuICAgIGZsb2F0IGluQW5nbGUgPSBwYXJ0aWNsZV92ZXJ0ZXhEYXRhMi54O1xuICAgIHZlYzMgcGFydGljbGVQb3NNb3ZlZCA9IHZlYzMoMC4wKTtcbiAgICB2ZWMzIG1lc2hMb2NhbFBvcyA9IHBhcnRpY2xlX3ZlcnRleERhdGEzLnh5ejtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXhGQTs7OzsifQ==
