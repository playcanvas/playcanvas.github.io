/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var refractionDynamicPS = `
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
    vec2 uv = projectionPoint.xy / projectionPoint.ww;
    uv += vec2(1.0);
    uv *= vec2(0.5);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmcmFjdGlvbkR5bmFtaWMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9yZWZyYWN0aW9uRHluYW1pYy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXg7XG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2ludkF0dGVudWF0aW9uRGlzdGFuY2U7XG51bmlmb3JtIHZlYzMgbWF0ZXJpYWxfYXR0ZW51YXRpb247XG5cbnZlYzMgcmVmcmFjdDIodmVjMyB2aWV3VmVjLCB2ZWMzIE5vcm1hbCwgZmxvYXQgSU9SKSB7XG4gICAgZmxvYXQgdm4gPSBkb3Qodmlld1ZlYywgTm9ybWFsKTtcbiAgICBmbG9hdCBrID0gMS4wIC0gSU9SICogSU9SICogKDEuMCAtIHZuICogdm4pO1xuICAgIHZlYzMgcmVmclZlYyA9IElPUiAqIHZpZXdWZWMgLSAoSU9SICogdm4gKyBzcXJ0KGspKSAqIE5vcm1hbDtcbiAgICByZXR1cm4gcmVmclZlYztcbn1cblxudm9pZCBhZGRSZWZyYWN0aW9uKCkge1xuXG4gICAgLy8gRXh0cmFjdCBzY2FsZSBmcm9tIHRoZSBtb2RlbCB0cmFuc2Zvcm1cbiAgICB2ZWMzIG1vZGVsU2NhbGU7XG4gICAgbW9kZWxTY2FsZS54ID0gbGVuZ3RoKHZlYzMobWF0cml4X21vZGVsWzBdLnh5eikpO1xuICAgIG1vZGVsU2NhbGUueSA9IGxlbmd0aCh2ZWMzKG1hdHJpeF9tb2RlbFsxXS54eXopKTtcbiAgICBtb2RlbFNjYWxlLnogPSBsZW5ndGgodmVjMyhtYXRyaXhfbW9kZWxbMl0ueHl6KSk7XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIHJlZnJhY3Rpb24gdmVjdG9yLCBzY2FsZWQgYnkgdGhlIHRoaWNrbmVzcyBhbmQgc2NhbGUgb2YgdGhlIG9iamVjdFxuICAgIHZlYzMgcmVmcmFjdGlvblZlY3RvciA9IG5vcm1hbGl6ZShyZWZyYWN0KC1kVmlld0RpclcsIGROb3JtYWxXLCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXgpKSAqIGRUaGlja25lc3MgKiBtb2RlbFNjYWxlO1xuXG4gICAgLy8gVGhlIHJlZnJhY3Rpb24gcG9pbnQgaXMgdGhlIGVudHJ5IHBvaW50ICsgdmVjdG9yIHRvIGV4aXQgcG9pbnRcbiAgICB2ZWM0IHBvaW50T2ZSZWZyYWN0aW9uID0gdmVjNCh2UG9zaXRpb25XICsgcmVmcmFjdGlvblZlY3RvciwgMS4wKTtcblxuICAgIC8vIFByb2plY3QgdG8gdGV4dHVyZSBzcGFjZSBzbyB3ZSBjYW4gc2FtcGxlIGl0XG4gICAgdmVjNCBwcm9qZWN0aW9uUG9pbnQgPSBtYXRyaXhfdmlld1Byb2plY3Rpb24gKiBwb2ludE9mUmVmcmFjdGlvbjtcbiAgICB2ZWMyIHV2ID0gcHJvamVjdGlvblBvaW50Lnh5IC8gcHJvamVjdGlvblBvaW50Lnd3O1xuICAgIHV2ICs9IHZlYzIoMS4wKTtcbiAgICB1diAqPSB2ZWMyKDAuNSk7XG5cbiAgICAjaWZkZWYgU1VQUE9SVFNfVEVYTE9EXG4gICAgICAgIC8vIFVzZSBJT1IgYW5kIHJvdWdobmVzcyB0byBzZWxlY3QgbWlwXG4gICAgICAgIGZsb2F0IGlvclRvUm91Z2huZXNzID0gKDEuMCAtIGRHbG9zc2luZXNzKSAqIGNsYW1wKCgxLjAgLyBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXgpICogMi4wIC0gMi4wLCAwLjAsIDEuMCk7XG4gICAgICAgIGZsb2F0IHJlZnJhY3Rpb25Mb2QgPSBsb2cyKHVTY3JlZW5TaXplLngpICogaW9yVG9Sb3VnaG5lc3M7XG4gICAgICAgIHZlYzMgcmVmcmFjdGlvbiA9IHRleHR1cmUyRExvZEVYVCh1U2NlbmVDb2xvck1hcCwgdXYsIHJlZnJhY3Rpb25Mb2QpLnJnYjtcbiAgICAjZWxzZVxuICAgICAgICB2ZWMzIHJlZnJhY3Rpb24gPSB0ZXh0dXJlMkQodVNjZW5lQ29sb3JNYXAsIHV2KS5yZ2I7XG4gICAgI2VuZGlmXG5cbiAgICAvLyBUcmFuc21pdHRhbmNlIGlzIG91ciBmaW5hbCByZWZyYWN0aW9uIGNvbG9yXG4gICAgdmVjMyB0cmFuc21pdHRhbmNlO1xuICAgIGlmIChtYXRlcmlhbF9pbnZBdHRlbnVhdGlvbkRpc3RhbmNlICE9IDAuMClcbiAgICB7XG4gICAgICAgIHZlYzMgYXR0ZW51YXRpb24gPSAtbG9nKG1hdGVyaWFsX2F0dGVudWF0aW9uKSAqIG1hdGVyaWFsX2ludkF0dGVudWF0aW9uRGlzdGFuY2U7XG4gICAgICAgIHRyYW5zbWl0dGFuY2UgPSBleHAoLWF0dGVudWF0aW9uICogbGVuZ3RoKHJlZnJhY3Rpb25WZWN0b3IpKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdHJhbnNtaXR0YW5jZSA9IHJlZnJhY3Rpb247XG4gICAgfVxuXG4gICAgLy8gQXBwbHkgZnJlc25lbCBlZmZlY3Qgb24gcmVmcmFjdGlvblxuICAgIHZlYzMgZnJlc25lbCA9IHZlYzMoMS4wKSAtIGdldEZyZXNuZWwoZG90KGRWaWV3RGlyVywgZE5vcm1hbFcpLCBkU3BlY3VsYXJpdHkpO1xuICAgIGREaWZmdXNlTGlnaHQgPSBtaXgoZERpZmZ1c2VMaWdodCwgcmVmcmFjdGlvbiAqIHRyYW5zbWl0dGFuY2UgKiBmcmVzbmVsLCBkVHJhbnNtaXNzaW9uKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwwQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
