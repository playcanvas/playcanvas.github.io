/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterInitPS = `
varying vec2 vUv0;

uniform highp sampler2D particleTexIN;
uniform highp sampler2D internalTex0;
uniform highp sampler2D internalTex1;
uniform highp sampler2D internalTex2;
uniform highp sampler2D internalTex3;

uniform mat3 emitterMatrix, emitterMatrixInv;
uniform vec3 emitterScale;

uniform vec3 emitterPos, frameRandom, localVelocityDivMult, velocityDivMult;
uniform float delta, rate, rateDiv, lifetime, numParticles, rotSpeedDivMult, radialSpeedDivMult, seed;
uniform float startAngle, startAngle2;
uniform float initialVelocity;

uniform float graphSampleSize;
uniform float graphNumSamples;

vec3 inPos;
vec3 inVel;
float inAngle;
bool inShow;
float inLife;
float visMode;

vec3 outPos;
vec3 outVel;
float outAngle;
bool outShow;
float outLife;
`;

export { particleUpdaterInitPS as default };
