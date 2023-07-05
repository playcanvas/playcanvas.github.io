/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
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

    #ifdef GL2
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmcmFjdGlvbkR5bmFtaWMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmcmFjdGlvbkR5bmFtaWMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfcmVmcmFjdGlvbkluZGV4O1xudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9pbnZBdHRlbnVhdGlvbkRpc3RhbmNlO1xudW5pZm9ybSB2ZWMzIG1hdGVyaWFsX2F0dGVudWF0aW9uO1xuXG52ZWMzIHJlZnJhY3QyKHZlYzMgdmlld1ZlYywgdmVjMyBOb3JtYWwsIGZsb2F0IElPUikge1xuICAgIGZsb2F0IHZuID0gZG90KHZpZXdWZWMsIE5vcm1hbCk7XG4gICAgZmxvYXQgayA9IDEuMCAtIElPUiAqIElPUiAqICgxLjAgLSB2biAqIHZuKTtcbiAgICB2ZWMzIHJlZnJWZWMgPSBJT1IgKiB2aWV3VmVjIC0gKElPUiAqIHZuICsgc3FydChrKSkgKiBOb3JtYWw7XG4gICAgcmV0dXJuIHJlZnJWZWM7XG59XG5cbnZvaWQgYWRkUmVmcmFjdGlvbigpIHtcblxuICAgIC8vIEV4dHJhY3Qgc2NhbGUgZnJvbSB0aGUgbW9kZWwgdHJhbnNmb3JtXG4gICAgdmVjMyBtb2RlbFNjYWxlO1xuICAgIG1vZGVsU2NhbGUueCA9IGxlbmd0aCh2ZWMzKG1hdHJpeF9tb2RlbFswXS54eXopKTtcbiAgICBtb2RlbFNjYWxlLnkgPSBsZW5ndGgodmVjMyhtYXRyaXhfbW9kZWxbMV0ueHl6KSk7XG4gICAgbW9kZWxTY2FsZS56ID0gbGVuZ3RoKHZlYzMobWF0cml4X21vZGVsWzJdLnh5eikpO1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSByZWZyYWN0aW9uIHZlY3Rvciwgc2NhbGVkIGJ5IHRoZSB0aGlja25lc3MgYW5kIHNjYWxlIG9mIHRoZSBvYmplY3RcbiAgICB2ZWMzIHJlZnJhY3Rpb25WZWN0b3IgPSBub3JtYWxpemUocmVmcmFjdCgtZFZpZXdEaXJXLCBkTm9ybWFsVywgbWF0ZXJpYWxfcmVmcmFjdGlvbkluZGV4KSkgKiBkVGhpY2tuZXNzICogbW9kZWxTY2FsZTtcblxuICAgIC8vIFRoZSByZWZyYWN0aW9uIHBvaW50IGlzIHRoZSBlbnRyeSBwb2ludCArIHZlY3RvciB0byBleGl0IHBvaW50XG4gICAgdmVjNCBwb2ludE9mUmVmcmFjdGlvbiA9IHZlYzQodlBvc2l0aW9uVyArIHJlZnJhY3Rpb25WZWN0b3IsIDEuMCk7XG5cbiAgICAvLyBQcm9qZWN0IHRvIHRleHR1cmUgc3BhY2Ugc28gd2UgY2FuIHNhbXBsZSBpdFxuICAgIHZlYzQgcHJvamVjdGlvblBvaW50ID0gbWF0cml4X3ZpZXdQcm9qZWN0aW9uICogcG9pbnRPZlJlZnJhY3Rpb247XG4gICAgdmVjMiB1diA9IHByb2plY3Rpb25Qb2ludC54eSAvIHByb2plY3Rpb25Qb2ludC53dztcbiAgICB1diArPSB2ZWMyKDEuMCk7XG4gICAgdXYgKj0gdmVjMigwLjUpO1xuXG4gICAgI2lmZGVmIEdMMlxuICAgICAgICAvLyBVc2UgSU9SIGFuZCByb3VnaG5lc3MgdG8gc2VsZWN0IG1pcFxuICAgICAgICBmbG9hdCBpb3JUb1JvdWdobmVzcyA9ICgxLjAgLSBkR2xvc3NpbmVzcykgKiBjbGFtcCgoMS4wIC8gbWF0ZXJpYWxfcmVmcmFjdGlvbkluZGV4KSAqIDIuMCAtIDIuMCwgMC4wLCAxLjApO1xuICAgICAgICBmbG9hdCByZWZyYWN0aW9uTG9kID0gbG9nMih1U2NyZWVuU2l6ZS54KSAqIGlvclRvUm91Z2huZXNzO1xuICAgICAgICB2ZWMzIHJlZnJhY3Rpb24gPSB0ZXh0dXJlMkRMb2RFWFQodVNjZW5lQ29sb3JNYXAsIHV2LCByZWZyYWN0aW9uTG9kKS5yZ2I7XG4gICAgI2Vsc2VcbiAgICAgICAgdmVjMyByZWZyYWN0aW9uID0gdGV4dHVyZTJEKHVTY2VuZUNvbG9yTWFwLCB1dikucmdiO1xuICAgICNlbmRpZlxuXG4gICAgLy8gVHJhbnNtaXR0YW5jZSBpcyBvdXIgZmluYWwgcmVmcmFjdGlvbiBjb2xvclxuICAgIHZlYzMgdHJhbnNtaXR0YW5jZTtcbiAgICBpZiAobWF0ZXJpYWxfaW52QXR0ZW51YXRpb25EaXN0YW5jZSAhPSAwLjApXG4gICAge1xuICAgICAgICB2ZWMzIGF0dGVudWF0aW9uID0gLWxvZyhtYXRlcmlhbF9hdHRlbnVhdGlvbikgKiBtYXRlcmlhbF9pbnZBdHRlbnVhdGlvbkRpc3RhbmNlO1xuICAgICAgICB0cmFuc21pdHRhbmNlID0gZXhwKC1hdHRlbnVhdGlvbiAqIGxlbmd0aChyZWZyYWN0aW9uVmVjdG9yKSk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRyYW5zbWl0dGFuY2UgPSByZWZyYWN0aW9uO1xuICAgIH1cblxuICAgIC8vIEFwcGx5IGZyZXNuZWwgZWZmZWN0IG9uIHJlZnJhY3Rpb25cbiAgICB2ZWMzIGZyZXNuZWwgPSB2ZWMzKDEuMCkgLSBnZXRGcmVzbmVsKGRvdChkVmlld0RpclcsIGROb3JtYWxXKSwgZFNwZWN1bGFyaXR5KTtcbiAgICBkRGlmZnVzZUxpZ2h0ID0gbWl4KGREaWZmdXNlTGlnaHQsIHJlZnJhY3Rpb24gKiB0cmFuc21pdHRhbmNlICogZnJlc25lbCwgZFRyYW5zbWlzc2lvbik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBekRBOzs7OyJ9
