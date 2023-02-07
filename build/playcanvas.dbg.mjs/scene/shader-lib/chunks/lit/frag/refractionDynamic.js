/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var refractionDynamicPS = /* glsl */`
uniform float material_refractionIndex;
uniform float material_invAttenuationDistance;
uniform vec3 material_attenuation;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    float vn = dot(viewVec, Normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction() {

    // Extract scale from the model transform
    vec3 modelScale;
    modelScale.x = length(vec3(matrix_model[0].xyz));
    modelScale.y = length(vec3(matrix_model[1].xyz));
    modelScale.z = length(vec3(matrix_model[2].xyz));

    // Calculate the refraction vector, scaled by the thickness and scale of the object
    vec3 refractionVector = normalize(refract(-dViewDirW, dNormalW, material_refractionIndex)) * dThickness * modelScale;

    // The refraction point is the entry point + vector to exit point
    vec4 pointOfRefraction = vec4(vPositionW + refractionVector, 1.0);

    // Project to texture space so we can sample it
    vec4 projectionPoint = matrix_viewProjection * pointOfRefraction;

    // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
    vec2 uv = getGrabScreenPos(projectionPoint);

    #ifdef SUPPORTS_TEXLOD
        // Use IOR and roughness to select mip
        float iorToRoughness = (1.0 - dGlossiness) * clamp((1.0 / material_refractionIndex) * 2.0 - 2.0, 0.0, 1.0);
        float refractionLod = log2(uScreenSize.x) * iorToRoughness;
        vec3 refraction = texture2DLodEXT(uSceneColorMap, uv, refractionLod).rgb;
    #else
        vec3 refraction = texture2D(uSceneColorMap, uv).rgb;
    #endif

    // Transmittance is our final refraction color
    vec3 transmittance;
    if (material_invAttenuationDistance != 0.0)
    {
        vec3 attenuation = -log(material_attenuation) * material_invAttenuationDistance;
        transmittance = exp(-attenuation * length(refractionVector));
    }
    else
    {
        transmittance = refraction;
    }

    // Apply fresnel effect on refraction
    vec3 fresnel = vec3(1.0) - getFresnel(dot(dViewDirW, dNormalW), dSpecularity);
    dDiffuseLight = mix(dDiffuseLight, refraction * transmittance * fresnel, dTransmission);
}
`;

export { refractionDynamicPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmcmFjdGlvbkR5bmFtaWMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9yZWZyYWN0aW9uRHluYW1pYy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXg7XG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2ludkF0dGVudWF0aW9uRGlzdGFuY2U7XG51bmlmb3JtIHZlYzMgbWF0ZXJpYWxfYXR0ZW51YXRpb247XG5cbnZlYzMgcmVmcmFjdDIodmVjMyB2aWV3VmVjLCB2ZWMzIE5vcm1hbCwgZmxvYXQgSU9SKSB7XG4gICAgZmxvYXQgdm4gPSBkb3Qodmlld1ZlYywgTm9ybWFsKTtcbiAgICBmbG9hdCBrID0gMS4wIC0gSU9SICogSU9SICogKDEuMCAtIHZuICogdm4pO1xuICAgIHZlYzMgcmVmclZlYyA9IElPUiAqIHZpZXdWZWMgLSAoSU9SICogdm4gKyBzcXJ0KGspKSAqIE5vcm1hbDtcbiAgICByZXR1cm4gcmVmclZlYztcbn1cblxudm9pZCBhZGRSZWZyYWN0aW9uKCkge1xuXG4gICAgLy8gRXh0cmFjdCBzY2FsZSBmcm9tIHRoZSBtb2RlbCB0cmFuc2Zvcm1cbiAgICB2ZWMzIG1vZGVsU2NhbGU7XG4gICAgbW9kZWxTY2FsZS54ID0gbGVuZ3RoKHZlYzMobWF0cml4X21vZGVsWzBdLnh5eikpO1xuICAgIG1vZGVsU2NhbGUueSA9IGxlbmd0aCh2ZWMzKG1hdHJpeF9tb2RlbFsxXS54eXopKTtcbiAgICBtb2RlbFNjYWxlLnogPSBsZW5ndGgodmVjMyhtYXRyaXhfbW9kZWxbMl0ueHl6KSk7XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIHJlZnJhY3Rpb24gdmVjdG9yLCBzY2FsZWQgYnkgdGhlIHRoaWNrbmVzcyBhbmQgc2NhbGUgb2YgdGhlIG9iamVjdFxuICAgIHZlYzMgcmVmcmFjdGlvblZlY3RvciA9IG5vcm1hbGl6ZShyZWZyYWN0KC1kVmlld0RpclcsIGROb3JtYWxXLCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXgpKSAqIGRUaGlja25lc3MgKiBtb2RlbFNjYWxlO1xuXG4gICAgLy8gVGhlIHJlZnJhY3Rpb24gcG9pbnQgaXMgdGhlIGVudHJ5IHBvaW50ICsgdmVjdG9yIHRvIGV4aXQgcG9pbnRcbiAgICB2ZWM0IHBvaW50T2ZSZWZyYWN0aW9uID0gdmVjNCh2UG9zaXRpb25XICsgcmVmcmFjdGlvblZlY3RvciwgMS4wKTtcblxuICAgIC8vIFByb2plY3QgdG8gdGV4dHVyZSBzcGFjZSBzbyB3ZSBjYW4gc2FtcGxlIGl0XG4gICAgdmVjNCBwcm9qZWN0aW9uUG9pbnQgPSBtYXRyaXhfdmlld1Byb2plY3Rpb24gKiBwb2ludE9mUmVmcmFjdGlvbjtcblxuICAgIC8vIHVzZSBidWlsdC1pbiBnZXRHcmFiU2NyZWVuUG9zIGZ1bmN0aW9uIHRvIGNvbnZlcnQgc2NyZWVuIHBvc2l0aW9uIHRvIGdyYWIgdGV4dHVyZSB1diBjb29yZHNcbiAgICB2ZWMyIHV2ID0gZ2V0R3JhYlNjcmVlblBvcyhwcm9qZWN0aW9uUG9pbnQpO1xuXG4gICAgI2lmZGVmIFNVUFBPUlRTX1RFWExPRFxuICAgICAgICAvLyBVc2UgSU9SIGFuZCByb3VnaG5lc3MgdG8gc2VsZWN0IG1pcFxuICAgICAgICBmbG9hdCBpb3JUb1JvdWdobmVzcyA9ICgxLjAgLSBkR2xvc3NpbmVzcykgKiBjbGFtcCgoMS4wIC8gbWF0ZXJpYWxfcmVmcmFjdGlvbkluZGV4KSAqIDIuMCAtIDIuMCwgMC4wLCAxLjApO1xuICAgICAgICBmbG9hdCByZWZyYWN0aW9uTG9kID0gbG9nMih1U2NyZWVuU2l6ZS54KSAqIGlvclRvUm91Z2huZXNzO1xuICAgICAgICB2ZWMzIHJlZnJhY3Rpb24gPSB0ZXh0dXJlMkRMb2RFWFQodVNjZW5lQ29sb3JNYXAsIHV2LCByZWZyYWN0aW9uTG9kKS5yZ2I7XG4gICAgI2Vsc2VcbiAgICAgICAgdmVjMyByZWZyYWN0aW9uID0gdGV4dHVyZTJEKHVTY2VuZUNvbG9yTWFwLCB1dikucmdiO1xuICAgICNlbmRpZlxuXG4gICAgLy8gVHJhbnNtaXR0YW5jZSBpcyBvdXIgZmluYWwgcmVmcmFjdGlvbiBjb2xvclxuICAgIHZlYzMgdHJhbnNtaXR0YW5jZTtcbiAgICBpZiAobWF0ZXJpYWxfaW52QXR0ZW51YXRpb25EaXN0YW5jZSAhPSAwLjApXG4gICAge1xuICAgICAgICB2ZWMzIGF0dGVudWF0aW9uID0gLWxvZyhtYXRlcmlhbF9hdHRlbnVhdGlvbikgKiBtYXRlcmlhbF9pbnZBdHRlbnVhdGlvbkRpc3RhbmNlO1xuICAgICAgICB0cmFuc21pdHRhbmNlID0gZXhwKC1hdHRlbnVhdGlvbiAqIGxlbmd0aChyZWZyYWN0aW9uVmVjdG9yKSk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRyYW5zbWl0dGFuY2UgPSByZWZyYWN0aW9uO1xuICAgIH1cblxuICAgIC8vIEFwcGx5IGZyZXNuZWwgZWZmZWN0IG9uIHJlZnJhY3Rpb25cbiAgICB2ZWMzIGZyZXNuZWwgPSB2ZWMzKDEuMCkgLSBnZXRGcmVzbmVsKGRvdChkVmlld0RpclcsIGROb3JtYWxXKSwgZFNwZWN1bGFyaXR5KTtcbiAgICBkRGlmZnVzZUxpZ2h0ID0gbWl4KGREaWZmdXNlTGlnaHQsIHJlZnJhY3Rpb24gKiB0cmFuc21pdHRhbmNlICogZnJlc25lbCwgZFRyYW5zbWlzc2lvbik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
