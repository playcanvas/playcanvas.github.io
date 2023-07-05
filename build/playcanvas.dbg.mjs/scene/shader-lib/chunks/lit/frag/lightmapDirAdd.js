var lightmapDirAddPS = /* glsl */`
void addLightMap(
    vec3 lightmap, 
    vec3 dir, 
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir, 
    float gloss, 
    vec3 specularity, 
    vec3 vertexNormal, 
    mat3 tbn
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel, 
    IridescenceArgs iridescence
#endif
) {
    if (dot(dir, dir) < 0.0001) {
        dDiffuseLight += lightmap;
    } else {
        float vlight = saturate(dot(dir, -vertexNormal));
        float flight = saturate(dot(dir, -worldNormal));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += lightmap * nlight * 2.0;

        vec3 halfDir = normalize(-dir + viewDir);
        vec3 specularLight = lightmap * getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, dir, gloss, tbn);

#ifdef LIT_SPECULAR_FRESNEL
        specularLight *= 
            getFresnel(dot(viewDir, halfDir), 
            gloss, 
            specularity
        #if defined(LIT_IRIDESCENCE)
            , iridescenceFresnel,
            iridescence
        #endif
            );
#endif

        dSpecularLight += specularLight;
    }
}
`;

export { lightmapDirAddPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBEaXJBZGQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9saWdodG1hcERpckFkZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBhZGRMaWdodE1hcChcbiAgICB2ZWMzIGxpZ2h0bWFwLCBcbiAgICB2ZWMzIGRpciwgXG4gICAgdmVjMyB3b3JsZE5vcm1hbCwgXG4gICAgdmVjMyB2aWV3RGlyLCBcbiAgICB2ZWMzIHJlZmxlY3Rpb25EaXIsIFxuICAgIGZsb2F0IGdsb3NzLCBcbiAgICB2ZWMzIHNwZWN1bGFyaXR5LCBcbiAgICB2ZWMzIHZlcnRleE5vcm1hbCwgXG4gICAgbWF0MyB0Ym5cbiNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICB2ZWMzIGlyaWRlc2NlbmNlRnJlc25lbCwgXG4gICAgSXJpZGVzY2VuY2VBcmdzIGlyaWRlc2NlbmNlXG4jZW5kaWZcbikge1xuICAgIGlmIChkb3QoZGlyLCBkaXIpIDwgMC4wMDAxKSB7XG4gICAgICAgIGREaWZmdXNlTGlnaHQgKz0gbGlnaHRtYXA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZmxvYXQgdmxpZ2h0ID0gc2F0dXJhdGUoZG90KGRpciwgLXZlcnRleE5vcm1hbCkpO1xuICAgICAgICBmbG9hdCBmbGlnaHQgPSBzYXR1cmF0ZShkb3QoZGlyLCAtd29ybGROb3JtYWwpKTtcbiAgICAgICAgZmxvYXQgbmxpZ2h0ID0gKGZsaWdodCAvIG1heCh2bGlnaHQsIDAuMDEpKSAqIDAuNTtcblxuICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IGxpZ2h0bWFwICogbmxpZ2h0ICogMi4wO1xuXG4gICAgICAgIHZlYzMgaGFsZkRpciA9IG5vcm1hbGl6ZSgtZGlyICsgdmlld0Rpcik7XG4gICAgICAgIHZlYzMgc3BlY3VsYXJMaWdodCA9IGxpZ2h0bWFwICogZ2V0TGlnaHRTcGVjdWxhcihoYWxmRGlyLCByZWZsZWN0aW9uRGlyLCB3b3JsZE5vcm1hbCwgdmlld0RpciwgZGlyLCBnbG9zcywgdGJuKTtcblxuI2lmZGVmIExJVF9TUEVDVUxBUl9GUkVTTkVMXG4gICAgICAgIHNwZWN1bGFyTGlnaHQgKj0gXG4gICAgICAgICAgICBnZXRGcmVzbmVsKGRvdCh2aWV3RGlyLCBoYWxmRGlyKSwgXG4gICAgICAgICAgICBnbG9zcywgXG4gICAgICAgICAgICBzcGVjdWxhcml0eVxuICAgICAgICAjaWYgZGVmaW5lZChMSVRfSVJJREVTQ0VOQ0UpXG4gICAgICAgICAgICAsIGlyaWRlc2NlbmNlRnJlc25lbCxcbiAgICAgICAgICAgIGlyaWRlc2NlbmNlXG4gICAgICAgICNlbmRpZlxuICAgICAgICAgICAgKTtcbiNlbmRpZlxuXG4gICAgICAgIGRTcGVjdWxhckxpZ2h0ICs9IHNwZWN1bGFyTGlnaHQ7XG4gICAgfVxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
