/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_cpuVS = /* glsl */`
attribute vec4 particle_vertexData;   // XYZ = world pos, W = life
attribute vec4 particle_vertexData2;  // X = angle, Y = scale, Z = alpha, W = velocity.x
attribute vec4 particle_vertexData3;  // XYZ = particle local pos, W = velocity.y
attribute float particle_vertexData4; // particle id

// type depends on useMesh property. Start with X = velocity.z, Y = particle ID and for mesh particles proceeds with Z = mesh UV.x, W = mesh UV.y
#ifndef USE_MESH
attribute vec2 particle_vertexData5;
#else
attribute vec4 particle_vertexData5;
#endif

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
uniform vec3 wrapBounds;
uniform vec3 emitterScale;
uniform vec3 faceTangent;
uniform vec3 faceBinorm;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfY3B1LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvdmVydC9wYXJ0aWNsZV9jcHUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSB2ZWM0IHBhcnRpY2xlX3ZlcnRleERhdGE7ICAgLy8gWFlaID0gd29ybGQgcG9zLCBXID0gbGlmZVxuYXR0cmlidXRlIHZlYzQgcGFydGljbGVfdmVydGV4RGF0YTI7ICAvLyBYID0gYW5nbGUsIFkgPSBzY2FsZSwgWiA9IGFscGhhLCBXID0gdmVsb2NpdHkueFxuYXR0cmlidXRlIHZlYzQgcGFydGljbGVfdmVydGV4RGF0YTM7ICAvLyBYWVogPSBwYXJ0aWNsZSBsb2NhbCBwb3MsIFcgPSB2ZWxvY2l0eS55XG5hdHRyaWJ1dGUgZmxvYXQgcGFydGljbGVfdmVydGV4RGF0YTQ7IC8vIHBhcnRpY2xlIGlkXG5cbi8vIHR5cGUgZGVwZW5kcyBvbiB1c2VNZXNoIHByb3BlcnR5LiBTdGFydCB3aXRoIFggPSB2ZWxvY2l0eS56LCBZID0gcGFydGljbGUgSUQgYW5kIGZvciBtZXNoIHBhcnRpY2xlcyBwcm9jZWVkcyB3aXRoIFogPSBtZXNoIFVWLngsIFcgPSBtZXNoIFVWLnlcbiNpZm5kZWYgVVNFX01FU0hcbmF0dHJpYnV0ZSB2ZWMyIHBhcnRpY2xlX3ZlcnRleERhdGE1O1xuI2Vsc2VcbmF0dHJpYnV0ZSB2ZWM0IHBhcnRpY2xlX3ZlcnRleERhdGE1O1xuI2VuZGlmXG5cbnVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld1Byb2plY3Rpb247XG51bmlmb3JtIG1hdDQgbWF0cml4X21vZGVsO1xuXG4jaWZuZGVmIFZJRVdNQVRSSVhcbiNkZWZpbmUgVklFV01BVFJJWFxudW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3O1xuI2VuZGlmXG5cbnVuaWZvcm0gbWF0MyBtYXRyaXhfbm9ybWFsO1xudW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3SW52ZXJzZTtcblxudW5pZm9ybSBmbG9hdCBudW1QYXJ0aWNsZXM7XG51bmlmb3JtIGZsb2F0IGxpZmV0aW1lO1xudW5pZm9ybSBmbG9hdCBzdHJldGNoO1xudW5pZm9ybSBmbG9hdCBzZWVkO1xudW5pZm9ybSB2ZWMzIHdyYXBCb3VuZHM7XG51bmlmb3JtIHZlYzMgZW1pdHRlclNjYWxlO1xudW5pZm9ybSB2ZWMzIGZhY2VUYW5nZW50O1xudW5pZm9ybSB2ZWMzIGZhY2VCaW5vcm07XG51bmlmb3JtIHNhbXBsZXIyRCB0ZXhMaWZlQW5kU291cmNlUG9zT1VUO1xudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgaW50ZXJuYWxUZXgwO1xudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgaW50ZXJuYWxUZXgxO1xudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgaW50ZXJuYWxUZXgyO1xudW5pZm9ybSB2ZWMzIGVtaXR0ZXJQb3M7XG5cbnZhcnlpbmcgdmVjNCB0ZXhDb29yZHNBbHBoYUxpZmU7XG5cbnZlYzIgcm90YXRlKHZlYzIgcXVhZFhZLCBmbG9hdCBwUm90YXRpb24sIG91dCBtYXQyIHJvdE1hdHJpeClcbntcbiAgICBmbG9hdCBjID0gY29zKHBSb3RhdGlvbik7XG4gICAgZmxvYXQgcyA9IHNpbihwUm90YXRpb24pO1xuICAgIC8vdmVjNCByb3RhdGlvbk1hdHJpeCA9IHZlYzQoYywgLXMsIHMsIGMpO1xuXG4gICAgbWF0MiBtID0gbWF0MihjLCAtcywgcywgYyk7XG4gICAgcm90TWF0cml4ID0gbTtcblxuICAgIHJldHVybiBtICogcXVhZFhZO1xufVxuXG52ZWMzIGJpbGxib2FyZCh2ZWMzIEluc3RhbmNlQ29vcmRzLCB2ZWMyIHF1YWRYWSlcbntcbiAgICB2ZWMzIHBvcyA9IC1tYXRyaXhfdmlld0ludmVyc2VbMF0ueHl6ICogcXVhZFhZLnggKyAtbWF0cml4X3ZpZXdJbnZlcnNlWzFdLnh5eiAqIHF1YWRYWS55O1xuICAgIHJldHVybiBwb3M7XG59XG5cbnZlYzMgY3VzdG9tRmFjZSh2ZWMzIEluc3RhbmNlQ29vcmRzLCB2ZWMyIHF1YWRYWSlcbntcbiAgICB2ZWMzIHBvcyA9IGZhY2VUYW5nZW50ICogcXVhZFhZLnggKyBmYWNlQmlub3JtICogcXVhZFhZLnk7XG4gICAgcmV0dXJuIHBvcztcbn1cblxudm9pZCBtYWluKHZvaWQpXG57XG4gICAgdmVjMyBwYXJ0aWNsZVBvcyA9IHBhcnRpY2xlX3ZlcnRleERhdGEueHl6O1xuICAgIHZlYzMgaW5Qb3MgPSBwYXJ0aWNsZVBvcztcbiAgICB2ZWMzIHZlcnRQb3MgPSBwYXJ0aWNsZV92ZXJ0ZXhEYXRhMy54eXo7XG4gICAgdmVjMyBpblZlbCA9IHZlYzMocGFydGljbGVfdmVydGV4RGF0YTIudywgcGFydGljbGVfdmVydGV4RGF0YTMudywgcGFydGljbGVfdmVydGV4RGF0YTUueCk7XG5cbiAgICBmbG9hdCBpZCA9IGZsb29yKHBhcnRpY2xlX3ZlcnRleERhdGE0KTtcbiAgICBmbG9hdCBybmRGYWN0b3IgPSBmcmFjdChzaW4oaWQgKyAxLjAgKyBzZWVkKSk7XG4gICAgdmVjMyBybmRGYWN0b3IzID0gdmVjMyhybmRGYWN0b3IsIGZyYWN0KHJuZEZhY3RvcioxMC4wKSwgZnJhY3Qocm5kRmFjdG9yKjEwMC4wKSk7XG5cbiNpZmRlZiBMT0NBTF9TUEFDRVxuICAgIGluVmVsID0gbWF0MyhtYXRyaXhfbW9kZWwpICogaW5WZWw7XG4jZW5kaWZcbiAgICB2ZWMyIHZlbG9jaXR5ViA9IG5vcm1hbGl6ZSgobWF0MyhtYXRyaXhfdmlldykgKiBpblZlbCkueHkpOyAvLyBzaG91bGQgYmUgcmVtb3ZlZCBieSBjb21waWxlciBpZiBhbGlnbi9zdHJldGNoIGlzIG5vdCB1c2VkXG5cbiAgICB2ZWMyIHF1YWRYWSA9IHZlcnRQb3MueHk7XG5cbiNpZmRlZiBVU0VfTUVTSFxuICAgIHRleENvb3Jkc0FscGhhTGlmZSA9IHZlYzQocGFydGljbGVfdmVydGV4RGF0YTUuencsIHBhcnRpY2xlX3ZlcnRleERhdGEyLnosIHBhcnRpY2xlX3ZlcnRleERhdGEudyk7XG4jZWxzZVxuICAgIHRleENvb3Jkc0FscGhhTGlmZSA9IHZlYzQocXVhZFhZICogLTAuNSArIDAuNSwgcGFydGljbGVfdmVydGV4RGF0YTIueiwgcGFydGljbGVfdmVydGV4RGF0YS53KTtcbiNlbmRpZlxuICAgIG1hdDIgcm90TWF0cml4O1xuXG4gICAgZmxvYXQgaW5BbmdsZSA9IHBhcnRpY2xlX3ZlcnRleERhdGEyLng7XG4gICAgdmVjMyBwYXJ0aWNsZVBvc01vdmVkID0gdmVjMygwLjApO1xuICAgIHZlYzMgbWVzaExvY2FsUG9zID0gcGFydGljbGVfdmVydGV4RGF0YTMueHl6O1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHFCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
