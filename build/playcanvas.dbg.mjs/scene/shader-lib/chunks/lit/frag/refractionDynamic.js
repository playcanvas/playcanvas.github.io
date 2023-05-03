var refractionDynamicPS = /* glsl */`
uniform float material_refractionIndex;
uniform float material_invAttenuationDistance;
uniform vec3 material_attenuation;

void addRefraction(
    vec3 worldNormal, 
    vec3 viewDir, 
    float thickness, 
    float gloss, 
    vec3 specularity, 
    vec3 albedo, 
    float transmission
#if defined(LIT_IRIDESCENCE)
    , vec3 iridescenceFresnel,
    IridescenceArgs iridescence
#endif
) {

    // Extract scale from the model transform
    vec3 modelScale;
    modelScale.x = length(vec3(matrix_model[0].xyz));
    modelScale.y = length(vec3(matrix_model[1].xyz));
    modelScale.z = length(vec3(matrix_model[2].xyz));

    // Calculate the refraction vector, scaled by the thickness and scale of the object
    vec3 refractionVector = normalize(refract(-viewDir, worldNormal, material_refractionIndex)) * thickness * modelScale;

    // The refraction point is the entry point + vector to exit point
    vec4 pointOfRefraction = vec4(vPositionW + refractionVector, 1.0);

    // Project to texture space so we can sample it
    vec4 projectionPoint = matrix_viewProjection * pointOfRefraction;

    // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
    vec2 uv = getGrabScreenPos(projectionPoint);

    #ifdef SUPPORTS_TEXLOD
        // Use IOR and roughness to select mip
        float iorToRoughness = (1.0 - gloss) * clamp((1.0 / material_refractionIndex) * 2.0 - 2.0, 0.0, 1.0);
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
    vec3 fresnel = vec3(1.0) - 
        getFresnel(
            dot(viewDir, worldNormal), 
            gloss, 
            specularity
        #if defined(LIT_IRIDESCENCE)
            , iridescenceFresnel,
            iridescence
        #endif
        );
    dDiffuseLight = mix(dDiffuseLight, refraction * transmittance * fresnel, transmission);
}
`;

export { refractionDynamicPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmcmFjdGlvbkR5bmFtaWMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9yZWZyYWN0aW9uRHluYW1pYy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXg7XG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2ludkF0dGVudWF0aW9uRGlzdGFuY2U7XG51bmlmb3JtIHZlYzMgbWF0ZXJpYWxfYXR0ZW51YXRpb247XG5cbnZvaWQgYWRkUmVmcmFjdGlvbihcbiAgICB2ZWMzIHdvcmxkTm9ybWFsLCBcbiAgICB2ZWMzIHZpZXdEaXIsIFxuICAgIGZsb2F0IHRoaWNrbmVzcywgXG4gICAgZmxvYXQgZ2xvc3MsIFxuICAgIHZlYzMgc3BlY3VsYXJpdHksIFxuICAgIHZlYzMgYWxiZWRvLCBcbiAgICBmbG9hdCB0cmFuc21pc3Npb25cbiNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICAsIHZlYzMgaXJpZGVzY2VuY2VGcmVzbmVsLFxuICAgIElyaWRlc2NlbmNlQXJncyBpcmlkZXNjZW5jZVxuI2VuZGlmXG4pIHtcblxuICAgIC8vIEV4dHJhY3Qgc2NhbGUgZnJvbSB0aGUgbW9kZWwgdHJhbnNmb3JtXG4gICAgdmVjMyBtb2RlbFNjYWxlO1xuICAgIG1vZGVsU2NhbGUueCA9IGxlbmd0aCh2ZWMzKG1hdHJpeF9tb2RlbFswXS54eXopKTtcbiAgICBtb2RlbFNjYWxlLnkgPSBsZW5ndGgodmVjMyhtYXRyaXhfbW9kZWxbMV0ueHl6KSk7XG4gICAgbW9kZWxTY2FsZS56ID0gbGVuZ3RoKHZlYzMobWF0cml4X21vZGVsWzJdLnh5eikpO1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSByZWZyYWN0aW9uIHZlY3Rvciwgc2NhbGVkIGJ5IHRoZSB0aGlja25lc3MgYW5kIHNjYWxlIG9mIHRoZSBvYmplY3RcbiAgICB2ZWMzIHJlZnJhY3Rpb25WZWN0b3IgPSBub3JtYWxpemUocmVmcmFjdCgtdmlld0Rpciwgd29ybGROb3JtYWwsIG1hdGVyaWFsX3JlZnJhY3Rpb25JbmRleCkpICogdGhpY2tuZXNzICogbW9kZWxTY2FsZTtcblxuICAgIC8vIFRoZSByZWZyYWN0aW9uIHBvaW50IGlzIHRoZSBlbnRyeSBwb2ludCArIHZlY3RvciB0byBleGl0IHBvaW50XG4gICAgdmVjNCBwb2ludE9mUmVmcmFjdGlvbiA9IHZlYzQodlBvc2l0aW9uVyArIHJlZnJhY3Rpb25WZWN0b3IsIDEuMCk7XG5cbiAgICAvLyBQcm9qZWN0IHRvIHRleHR1cmUgc3BhY2Ugc28gd2UgY2FuIHNhbXBsZSBpdFxuICAgIHZlYzQgcHJvamVjdGlvblBvaW50ID0gbWF0cml4X3ZpZXdQcm9qZWN0aW9uICogcG9pbnRPZlJlZnJhY3Rpb247XG5cbiAgICAvLyB1c2UgYnVpbHQtaW4gZ2V0R3JhYlNjcmVlblBvcyBmdW5jdGlvbiB0byBjb252ZXJ0IHNjcmVlbiBwb3NpdGlvbiB0byBncmFiIHRleHR1cmUgdXYgY29vcmRzXG4gICAgdmVjMiB1diA9IGdldEdyYWJTY3JlZW5Qb3MocHJvamVjdGlvblBvaW50KTtcblxuICAgICNpZmRlZiBTVVBQT1JUU19URVhMT0RcbiAgICAgICAgLy8gVXNlIElPUiBhbmQgcm91Z2huZXNzIHRvIHNlbGVjdCBtaXBcbiAgICAgICAgZmxvYXQgaW9yVG9Sb3VnaG5lc3MgPSAoMS4wIC0gZ2xvc3MpICogY2xhbXAoKDEuMCAvIG1hdGVyaWFsX3JlZnJhY3Rpb25JbmRleCkgKiAyLjAgLSAyLjAsIDAuMCwgMS4wKTtcbiAgICAgICAgZmxvYXQgcmVmcmFjdGlvbkxvZCA9IGxvZzIodVNjcmVlblNpemUueCkgKiBpb3JUb1JvdWdobmVzcztcbiAgICAgICAgdmVjMyByZWZyYWN0aW9uID0gdGV4dHVyZTJETG9kRVhUKHVTY2VuZUNvbG9yTWFwLCB1diwgcmVmcmFjdGlvbkxvZCkucmdiO1xuICAgICNlbHNlXG4gICAgICAgIHZlYzMgcmVmcmFjdGlvbiA9IHRleHR1cmUyRCh1U2NlbmVDb2xvck1hcCwgdXYpLnJnYjtcbiAgICAjZW5kaWZcblxuICAgIC8vIFRyYW5zbWl0dGFuY2UgaXMgb3VyIGZpbmFsIHJlZnJhY3Rpb24gY29sb3JcbiAgICB2ZWMzIHRyYW5zbWl0dGFuY2U7XG4gICAgaWYgKG1hdGVyaWFsX2ludkF0dGVudWF0aW9uRGlzdGFuY2UgIT0gMC4wKVxuICAgIHtcbiAgICAgICAgdmVjMyBhdHRlbnVhdGlvbiA9IC1sb2cobWF0ZXJpYWxfYXR0ZW51YXRpb24pICogbWF0ZXJpYWxfaW52QXR0ZW51YXRpb25EaXN0YW5jZTtcbiAgICAgICAgdHJhbnNtaXR0YW5jZSA9IGV4cCgtYXR0ZW51YXRpb24gKiBsZW5ndGgocmVmcmFjdGlvblZlY3RvcikpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0cmFuc21pdHRhbmNlID0gcmVmcmFjdGlvbjtcbiAgICB9XG5cbiAgICAvLyBBcHBseSBmcmVzbmVsIGVmZmVjdCBvbiByZWZyYWN0aW9uXG4gICAgdmVjMyBmcmVzbmVsID0gdmVjMygxLjApIC0gXG4gICAgICAgIGdldEZyZXNuZWwoXG4gICAgICAgICAgICBkb3Qodmlld0Rpciwgd29ybGROb3JtYWwpLCBcbiAgICAgICAgICAgIGdsb3NzLCBcbiAgICAgICAgICAgIHNwZWN1bGFyaXR5XG4gICAgICAgICNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICAgICAgICAgICwgaXJpZGVzY2VuY2VGcmVzbmVsLFxuICAgICAgICAgICAgaXJpZGVzY2VuY2VcbiAgICAgICAgI2VuZGlmXG4gICAgICAgICk7XG4gICAgZERpZmZ1c2VMaWdodCA9IG1peChkRGlmZnVzZUxpZ2h0LCByZWZyYWN0aW9uICogdHJhbnNtaXR0YW5jZSAqIGZyZXNuZWwsIHRyYW5zbWlzc2lvbik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
