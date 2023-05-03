var lightmapAddPS = /* glsl */`
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
    dDiffuseLight += lightmap;
}
`;

export { lightmapAddPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBBZGQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9saWdodG1hcEFkZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBhZGRMaWdodE1hcChcbiAgICB2ZWMzIGxpZ2h0bWFwLCBcbiAgICB2ZWMzIGRpciwgXG4gICAgdmVjMyB3b3JsZE5vcm1hbCwgXG4gICAgdmVjMyB2aWV3RGlyLCBcbiAgICB2ZWMzIHJlZmxlY3Rpb25EaXIsIFxuICAgIGZsb2F0IGdsb3NzLCBcbiAgICB2ZWMzIHNwZWN1bGFyaXR5LCBcbiAgICB2ZWMzIHZlcnRleE5vcm1hbCwgXG4gICAgbWF0MyB0Ym5cbiNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICB2ZWMzIGlyaWRlc2NlbmNlRnJlc25lbCwgXG4gICAgSXJpZGVzY2VuY2VBcmdzIGlyaWRlc2NlbmNlXG4jZW5kaWZcbikge1xuICAgIGREaWZmdXNlTGlnaHQgKz0gbGlnaHRtYXA7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLG9CQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
