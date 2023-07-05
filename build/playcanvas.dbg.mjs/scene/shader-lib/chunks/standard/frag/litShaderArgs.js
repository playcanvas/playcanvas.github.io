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
    // The normal used for the clearcoat layer
    vec3 worldNormal;

    // Intensity of the clearcoat layer, range [0..1]
    float specularity;

    // Glossiness of clearcoat layer, range [0..1]
    float gloss;
};

struct SheenArgs
{
    // The color of the f0 specularity factor for the sheen layer
    vec3 specularity;

    // Glossiness of the sheen layer, range [0..1]
    float gloss;
};

struct LitShaderArguments {
    // Normal direction in world space
    vec3 worldNormal;

    // Transparency
    float opacity;

    // Surface albedo absorbance
    vec3 albedo;

    // Transmission factor (refraction), range [0..1]
    float transmission;

    // The f0 specularity factor
    vec3 specularity;

    // Uniform thickness of medium, used by transmission, range [0..inf]
    float thickness;

    // Emission color
    vec3 emission;

    // Ambient occlusion amount, range [0..1]
    float ao;

    // Light map color
    vec3 lightmap;

    // Specularity intensity factor, range [0..1]
    float specularityFactor;

    // Light map direction
    vec3 lightmapDir;

    // The microfacet glossiness factor, range [0..1]
    float gloss;

    // Iridescence extension arguments
    IridescenceArgs iridescence;

    // Clearcoat extension arguments
    ClearcoatArgs clearcoat;

    // Surface metalness factor, range [0..1]
    float metalness;

    // Sheen extension arguments
    SheenArgs sheen;
};
`;

export { litShaderArgsPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0U2hhZGVyQXJncy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvbGl0U2hhZGVyQXJncy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG5zdHJ1Y3QgSXJpZGVzY2VuY2VBcmdzXG57XG4gICAgLy8gSXJpZGVzY2VuY2UgZWZmZWN0IGludGVuc2l0eSwgcmFuZ2UgWzAuLjFdXG4gICAgZmxvYXQgaW50ZW5zaXR5O1xuXG4gICAgLy8gVGhpY2tuZXNzIG9mIHRoZSBpcmlkZXNjZW50IG1pY3JvZmlsbSBsYXllciwgdmFsdWUgaXMgaW4gbmFub21ldGVycywgcmFuZ2UgWzAuLjEwMDBdXG4gICAgZmxvYXQgdGhpY2tuZXNzO1xufTtcblxuc3RydWN0IENsZWFyY29hdEFyZ3NcbntcbiAgICAvLyBUaGUgbm9ybWFsIHVzZWQgZm9yIHRoZSBjbGVhcmNvYXQgbGF5ZXJcbiAgICB2ZWMzIHdvcmxkTm9ybWFsO1xuXG4gICAgLy8gSW50ZW5zaXR5IG9mIHRoZSBjbGVhcmNvYXQgbGF5ZXIsIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IHNwZWN1bGFyaXR5O1xuXG4gICAgLy8gR2xvc3NpbmVzcyBvZiBjbGVhcmNvYXQgbGF5ZXIsIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IGdsb3NzO1xufTtcblxuc3RydWN0IFNoZWVuQXJnc1xue1xuICAgIC8vIFRoZSBjb2xvciBvZiB0aGUgZjAgc3BlY3VsYXJpdHkgZmFjdG9yIGZvciB0aGUgc2hlZW4gbGF5ZXJcbiAgICB2ZWMzIHNwZWN1bGFyaXR5O1xuXG4gICAgLy8gR2xvc3NpbmVzcyBvZiB0aGUgc2hlZW4gbGF5ZXIsIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IGdsb3NzO1xufTtcblxuc3RydWN0IExpdFNoYWRlckFyZ3VtZW50cyB7XG4gICAgLy8gTm9ybWFsIGRpcmVjdGlvbiBpbiB3b3JsZCBzcGFjZVxuICAgIHZlYzMgd29ybGROb3JtYWw7XG5cbiAgICAvLyBUcmFuc3BhcmVuY3lcbiAgICBmbG9hdCBvcGFjaXR5O1xuXG4gICAgLy8gU3VyZmFjZSBhbGJlZG8gYWJzb3JiYW5jZVxuICAgIHZlYzMgYWxiZWRvO1xuXG4gICAgLy8gVHJhbnNtaXNzaW9uIGZhY3RvciAocmVmcmFjdGlvbiksIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IHRyYW5zbWlzc2lvbjtcblxuICAgIC8vIFRoZSBmMCBzcGVjdWxhcml0eSBmYWN0b3JcbiAgICB2ZWMzIHNwZWN1bGFyaXR5O1xuXG4gICAgLy8gVW5pZm9ybSB0aGlja25lc3Mgb2YgbWVkaXVtLCB1c2VkIGJ5IHRyYW5zbWlzc2lvbiwgcmFuZ2UgWzAuLmluZl1cbiAgICBmbG9hdCB0aGlja25lc3M7XG5cbiAgICAvLyBFbWlzc2lvbiBjb2xvclxuICAgIHZlYzMgZW1pc3Npb247XG5cbiAgICAvLyBBbWJpZW50IG9jY2x1c2lvbiBhbW91bnQsIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IGFvO1xuXG4gICAgLy8gTGlnaHQgbWFwIGNvbG9yXG4gICAgdmVjMyBsaWdodG1hcDtcblxuICAgIC8vIFNwZWN1bGFyaXR5IGludGVuc2l0eSBmYWN0b3IsIHJhbmdlIFswLi4xXVxuICAgIGZsb2F0IHNwZWN1bGFyaXR5RmFjdG9yO1xuXG4gICAgLy8gTGlnaHQgbWFwIGRpcmVjdGlvblxuICAgIHZlYzMgbGlnaHRtYXBEaXI7XG5cbiAgICAvLyBUaGUgbWljcm9mYWNldCBnbG9zc2luZXNzIGZhY3RvciwgcmFuZ2UgWzAuLjFdXG4gICAgZmxvYXQgZ2xvc3M7XG5cbiAgICAvLyBJcmlkZXNjZW5jZSBleHRlbnNpb24gYXJndW1lbnRzXG4gICAgSXJpZGVzY2VuY2VBcmdzIGlyaWRlc2NlbmNlO1xuXG4gICAgLy8gQ2xlYXJjb2F0IGV4dGVuc2lvbiBhcmd1bWVudHNcbiAgICBDbGVhcmNvYXRBcmdzIGNsZWFyY29hdDtcblxuICAgIC8vIFN1cmZhY2UgbWV0YWxuZXNzIGZhY3RvciwgcmFuZ2UgWzAuLjFdXG4gICAgZmxvYXQgbWV0YWxuZXNzO1xuXG4gICAgLy8gU2hlZW4gZXh0ZW5zaW9uIGFyZ3VtZW50c1xuICAgIFNoZWVuQXJncyBzaGVlbjtcbn07XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHNCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
