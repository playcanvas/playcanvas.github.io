var litShaderArgsPS = /* glsl */`

struct IridescenceArgs
{
    // Iridescence effect intensity, range [0..1]
    float intensity;

    // Thickness of the iridescent microfilm layer, value is in nanometers, range [0..1000]
    float thickness;
};

struct ClearcoatArgs
{
    // Intensity of the clearcoat layer, range [0..1]
    float specularity;

    // Glossiness of clearcoat layer, range [0..1]
    float gloss;

    // The normal used for the clearcoat layer
    vec3 worldNormal;
};

struct SheenArgs
{
    // Glossiness of the sheen layer, range [0..1]
    float gloss;

    // The color of the f0 specularity factor for the sheen layer
    vec3 specularity;
};

struct LitShaderArguments {
    // Transparency
    float opacity;

    // Normal direction in world space
    vec3 worldNormal;

    // Surface albedo absorbance
    vec3 albedo;

    // Transmission factor (refraction), range [0..1]
    float transmission;

    // Uniform thickness of medium, used by transmission, range [0..inf]
    float thickness;

    // The f0 specularity factor
    vec3 specularity;

    // The microfacet glossiness factor, range [0..1]
    float gloss;

    // Surface metalness factor, range [0..1]
    float metalness;

    // Specularity intensity factor, range [0..1]
    float specularityFactor;

    // Ambient occlusion amount, range [0..1]
    float ao;

    // Emission color
    vec3 emission;

    // Light map color
    vec3 lightmap;

    // Light map direction
    vec3 lightmapDir;

    // Iridescence extension arguments
    IridescenceArgs iridescence;

    // Clearcoat extension arguments
    ClearcoatArgs clearcoat;

    // Sheen extension arguments
    SheenArgs sheen;
};
`;

export { litShaderArgsPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0U2hhZGVyQXJncy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvbGl0U2hhZGVyQXJncy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG5zdHJ1Y3QgSXJpZGVzY2VuY2VBcmdzXG57XG4gICAgLy8gSXJpZGVzY2VuY2UgZWZmZWN0IGludGVuc2l0eSwgcmFuZ2UgWzAuLjFdXG4gICAgZmxvYXQgaW50ZW5zaXR5O1xuXG4gICAgLy8gVGhpY2tuZXNzIG9mIHRoZSBpcmlkZXNjZW50IG1pY3JvZmlsbSBsYXllciwgdmFsdWUgaXMgaW4gbmFub21ldGVycywgcmFuZ2UgWzAuLjEwMDBdXG4gICAgZmxvYXQgdGhpY2tuZXNzO1xufTtcblxuc3RydWN0IENsZWFyY29hdEFyZ3NcbntcbiAgICAvLyBJbnRlbnNpdHkgb2YgdGhlIGNsZWFyY29hdCBsYXllciwgcmFuZ2UgWzAuLjFdXG4gICAgZmxvYXQgc3BlY3VsYXJpdHk7XG5cbiAgICAvLyBHbG9zc2luZXNzIG9mIGNsZWFyY29hdCBsYXllciwgcmFuZ2UgWzAuLjFdXG4gICAgZmxvYXQgZ2xvc3M7XG5cbiAgICAvLyBUaGUgbm9ybWFsIHVzZWQgZm9yIHRoZSBjbGVhcmNvYXQgbGF5ZXJcbiAgICB2ZWMzIHdvcmxkTm9ybWFsO1xufTtcblxuc3RydWN0IFNoZWVuQXJnc1xue1xuICAgIC8vIEdsb3NzaW5lc3Mgb2YgdGhlIHNoZWVuIGxheWVyLCByYW5nZSBbMC4uMV1cbiAgICBmbG9hdCBnbG9zcztcblxuICAgIC8vIFRoZSBjb2xvciBvZiB0aGUgZjAgc3BlY3VsYXJpdHkgZmFjdG9yIGZvciB0aGUgc2hlZW4gbGF5ZXJcbiAgICB2ZWMzIHNwZWN1bGFyaXR5O1xufTtcblxuc3RydWN0IExpdFNoYWRlckFyZ3VtZW50cyB7XG4gICAgLy8gVHJhbnNwYXJlbmN5XG4gICAgZmxvYXQgb3BhY2l0eTtcblxuICAgIC8vIE5vcm1hbCBkaXJlY3Rpb24gaW4gd29ybGQgc3BhY2VcbiAgICB2ZWMzIHdvcmxkTm9ybWFsO1xuXG4gICAgLy8gU3VyZmFjZSBhbGJlZG8gYWJzb3JiYW5jZVxuICAgIHZlYzMgYWxiZWRvO1xuXG4gICAgLy8gVHJhbnNtaXNzaW9uIGZhY3RvciAocmVmcmFjdGlvbiksIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IHRyYW5zbWlzc2lvbjtcblxuICAgIC8vIFVuaWZvcm0gdGhpY2tuZXNzIG9mIG1lZGl1bSwgdXNlZCBieSB0cmFuc21pc3Npb24sIHJhbmdlIFswLi5pbmZdXG4gICAgZmxvYXQgdGhpY2tuZXNzO1xuXG4gICAgLy8gVGhlIGYwIHNwZWN1bGFyaXR5IGZhY3RvclxuICAgIHZlYzMgc3BlY3VsYXJpdHk7XG5cbiAgICAvLyBUaGUgbWljcm9mYWNldCBnbG9zc2luZXNzIGZhY3RvciwgcmFuZ2UgWzAuLjFdXG4gICAgZmxvYXQgZ2xvc3M7XG5cbiAgICAvLyBTdXJmYWNlIG1ldGFsbmVzcyBmYWN0b3IsIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IG1ldGFsbmVzcztcblxuICAgIC8vIFNwZWN1bGFyaXR5IGludGVuc2l0eSBmYWN0b3IsIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IHNwZWN1bGFyaXR5RmFjdG9yO1xuXG4gICAgLy8gQW1iaWVudCBvY2NsdXNpb24gYW1vdW50LCByYW5nZSBbMC4uMV1cbiAgICBmbG9hdCBhbztcblxuICAgIC8vIEVtaXNzaW9uIGNvbG9yXG4gICAgdmVjMyBlbWlzc2lvbjtcblxuICAgIC8vIExpZ2h0IG1hcCBjb2xvclxuICAgIHZlYzMgbGlnaHRtYXA7XG5cbiAgICAvLyBMaWdodCBtYXAgZGlyZWN0aW9uXG4gICAgdmVjMyBsaWdodG1hcERpcjtcblxuICAgIC8vIElyaWRlc2NlbmNlIGV4dGVuc2lvbiBhcmd1bWVudHNcbiAgICBJcmlkZXNjZW5jZUFyZ3MgaXJpZGVzY2VuY2U7XG5cbiAgICAvLyBDbGVhcmNvYXQgZXh0ZW5zaW9uIGFyZ3VtZW50c1xuICAgIENsZWFyY29hdEFyZ3MgY2xlYXJjb2F0O1xuXG4gICAgLy8gU2hlZW4gZXh0ZW5zaW9uIGFyZ3VtZW50c1xuICAgIFNoZWVuQXJncyBzaGVlbjtcbn07XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHNCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
