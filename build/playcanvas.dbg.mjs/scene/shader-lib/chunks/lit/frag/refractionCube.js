var refractionCubePS = /* glsl */`
uniform float material_refractionIndex;

vec3 refract2(vec3 viewVec, vec3 normal, float IOR) {
    float vn = dot(viewVec, normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * normal;
    return refrVec;
}

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
    // use same reflection code with refraction vector
    vec4 tmpRefl = dReflection;
    vec3 reflectionDir = refract2(-viewDir, worldNormal, material_refractionIndex);
    dReflection = vec4(0);
    addReflection(reflectionDir, gloss);
    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * albedo, transmission);
    dReflection = tmpRefl;
}
`;

export { refractionCubePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmcmFjdGlvbkN1YmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9yZWZyYWN0aW9uQ3ViZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXg7XG5cbnZlYzMgcmVmcmFjdDIodmVjMyB2aWV3VmVjLCB2ZWMzIG5vcm1hbCwgZmxvYXQgSU9SKSB7XG4gICAgZmxvYXQgdm4gPSBkb3Qodmlld1ZlYywgbm9ybWFsKTtcbiAgICBmbG9hdCBrID0gMS4wIC0gSU9SICogSU9SICogKDEuMCAtIHZuICogdm4pO1xuICAgIHZlYzMgcmVmclZlYyA9IElPUiAqIHZpZXdWZWMgLSAoSU9SICogdm4gKyBzcXJ0KGspKSAqIG5vcm1hbDtcbiAgICByZXR1cm4gcmVmclZlYztcbn1cblxudm9pZCBhZGRSZWZyYWN0aW9uKFxuICAgIHZlYzMgd29ybGROb3JtYWwsIFxuICAgIHZlYzMgdmlld0RpciwgXG4gICAgZmxvYXQgdGhpY2tuZXNzLCBcbiAgICBmbG9hdCBnbG9zcywgXG4gICAgdmVjMyBzcGVjdWxhcml0eSwgXG4gICAgdmVjMyBhbGJlZG8sIFxuICAgIGZsb2F0IHRyYW5zbWlzc2lvblxuI2lmIGRlZmluZWQoTElUX0lSSURFU0NFTkNFKVxuICAgICwgdmVjMyBpcmlkZXNjZW5jZUZyZXNuZWwsXG4gICAgSXJpZGVzY2VuY2VBcmdzIGlyaWRlc2NlbmNlXG4jZW5kaWYgXG4pIHtcbiAgICAvLyB1c2Ugc2FtZSByZWZsZWN0aW9uIGNvZGUgd2l0aCByZWZyYWN0aW9uIHZlY3RvclxuICAgIHZlYzQgdG1wUmVmbCA9IGRSZWZsZWN0aW9uO1xuICAgIHZlYzMgcmVmbGVjdGlvbkRpciA9IHJlZnJhY3QyKC12aWV3RGlyLCB3b3JsZE5vcm1hbCwgbWF0ZXJpYWxfcmVmcmFjdGlvbkluZGV4KTtcbiAgICBkUmVmbGVjdGlvbiA9IHZlYzQoMCk7XG4gICAgYWRkUmVmbGVjdGlvbihyZWZsZWN0aW9uRGlyLCBnbG9zcyk7XG4gICAgZERpZmZ1c2VMaWdodCA9IG1peChkRGlmZnVzZUxpZ2h0LCBkUmVmbGVjdGlvbi5yZ2IgKiBhbGJlZG8sIHRyYW5zbWlzc2lvbik7XG4gICAgZFJlZmxlY3Rpb24gPSB0bXBSZWZsO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
