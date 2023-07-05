var shadowCascadesPS = /* glsl */`
const float maxCascades = 4.0;

// shadow matrix for selected cascade
mat4 cascadeShadowMat;

// function which selects a shadow projection matrix based on cascade distances 
void getShadowCascadeMatrix(mat4 shadowMatrixPalette[4], float shadowCascadeDistances[4], float shadowCascadeCount) {

    // depth in 0 .. far plane range
    float depth = 1.0 / gl_FragCoord.w;

    // find cascade index based on the depth (loop as there is no per component vec compare operator in webgl)
    float cascadeIndex = 0.0;
    for (float i = 0.0; i < maxCascades; i++) {
        if (depth < shadowCascadeDistances[int(i)]) {
            cascadeIndex = i;
            break;
        }
    }

    // limit to actual number of used cascades
    cascadeIndex = min(cascadeIndex, shadowCascadeCount - 1.0);

    // pick shadow matrix
    #ifdef GL2
        cascadeShadowMat = shadowMatrixPalette[int(cascadeIndex)];
    #else
        // webgl 1 does not allow non-cost index array lookup
        if (cascadeIndex == 0.0) {
            cascadeShadowMat = shadowMatrixPalette[0];
        }
        else if (cascadeIndex == 1.0) {
            cascadeShadowMat = shadowMatrixPalette[1];
        }
        else if (cascadeIndex == 2.0) {
            cascadeShadowMat = shadowMatrixPalette[2];
        }
        else {
            cascadeShadowMat = shadowMatrixPalette[3];
        }
    #endif
}

void fadeShadow(float shadowCascadeDistances[4]) {                  

    // if the pixel is past the shadow distance, remove shadow
    // this enforces straight line instead of corner of shadow which moves when camera rotates  
    float depth = 1.0 / gl_FragCoord.w;
    if (depth > shadowCascadeDistances[int(maxCascades - 1.0)]) {
        dShadowCoord.z = -9999999.0;
    }
}
`;

export { shadowCascadesPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q2FzY2FkZXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dDYXNjYWRlcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuY29uc3QgZmxvYXQgbWF4Q2FzY2FkZXMgPSA0LjA7XG5cbi8vIHNoYWRvdyBtYXRyaXggZm9yIHNlbGVjdGVkIGNhc2NhZGVcbm1hdDQgY2FzY2FkZVNoYWRvd01hdDtcblxuLy8gZnVuY3Rpb24gd2hpY2ggc2VsZWN0cyBhIHNoYWRvdyBwcm9qZWN0aW9uIG1hdHJpeCBiYXNlZCBvbiBjYXNjYWRlIGRpc3RhbmNlcyBcbnZvaWQgZ2V0U2hhZG93Q2FzY2FkZU1hdHJpeChtYXQ0IHNoYWRvd01hdHJpeFBhbGV0dGVbNF0sIGZsb2F0IHNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbNF0sIGZsb2F0IHNoYWRvd0Nhc2NhZGVDb3VudCkge1xuXG4gICAgLy8gZGVwdGggaW4gMCAuLiBmYXIgcGxhbmUgcmFuZ2VcbiAgICBmbG9hdCBkZXB0aCA9IDEuMCAvIGdsX0ZyYWdDb29yZC53O1xuXG4gICAgLy8gZmluZCBjYXNjYWRlIGluZGV4IGJhc2VkIG9uIHRoZSBkZXB0aCAobG9vcCBhcyB0aGVyZSBpcyBubyBwZXIgY29tcG9uZW50IHZlYyBjb21wYXJlIG9wZXJhdG9yIGluIHdlYmdsKVxuICAgIGZsb2F0IGNhc2NhZGVJbmRleCA9IDAuMDtcbiAgICBmb3IgKGZsb2F0IGkgPSAwLjA7IGkgPCBtYXhDYXNjYWRlczsgaSsrKSB7XG4gICAgICAgIGlmIChkZXB0aCA8IHNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbaW50KGkpXSkge1xuICAgICAgICAgICAgY2FzY2FkZUluZGV4ID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gbGltaXQgdG8gYWN0dWFsIG51bWJlciBvZiB1c2VkIGNhc2NhZGVzXG4gICAgY2FzY2FkZUluZGV4ID0gbWluKGNhc2NhZGVJbmRleCwgc2hhZG93Q2FzY2FkZUNvdW50IC0gMS4wKTtcblxuICAgIC8vIHBpY2sgc2hhZG93IG1hdHJpeFxuICAgICNpZmRlZiBHTDJcbiAgICAgICAgY2FzY2FkZVNoYWRvd01hdCA9IHNoYWRvd01hdHJpeFBhbGV0dGVbaW50KGNhc2NhZGVJbmRleCldO1xuICAgICNlbHNlXG4gICAgICAgIC8vIHdlYmdsIDEgZG9lcyBub3QgYWxsb3cgbm9uLWNvc3QgaW5kZXggYXJyYXkgbG9va3VwXG4gICAgICAgIGlmIChjYXNjYWRlSW5kZXggPT0gMC4wKSB7XG4gICAgICAgICAgICBjYXNjYWRlU2hhZG93TWF0ID0gc2hhZG93TWF0cml4UGFsZXR0ZVswXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjYXNjYWRlSW5kZXggPT0gMS4wKSB7XG4gICAgICAgICAgICBjYXNjYWRlU2hhZG93TWF0ID0gc2hhZG93TWF0cml4UGFsZXR0ZVsxXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjYXNjYWRlSW5kZXggPT0gMi4wKSB7XG4gICAgICAgICAgICBjYXNjYWRlU2hhZG93TWF0ID0gc2hhZG93TWF0cml4UGFsZXR0ZVsyXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhc2NhZGVTaGFkb3dNYXQgPSBzaGFkb3dNYXRyaXhQYWxldHRlWzNdO1xuICAgICAgICB9XG4gICAgI2VuZGlmXG59XG5cbnZvaWQgZmFkZVNoYWRvdyhmbG9hdCBzaGFkb3dDYXNjYWRlRGlzdGFuY2VzWzRdKSB7ICAgICAgICAgICAgICAgICAgXG5cbiAgICAvLyBpZiB0aGUgcGl4ZWwgaXMgcGFzdCB0aGUgc2hhZG93IGRpc3RhbmNlLCByZW1vdmUgc2hhZG93XG4gICAgLy8gdGhpcyBlbmZvcmNlcyBzdHJhaWdodCBsaW5lIGluc3RlYWQgb2YgY29ybmVyIG9mIHNoYWRvdyB3aGljaCBtb3ZlcyB3aGVuIGNhbWVyYSByb3RhdGVzICBcbiAgICBmbG9hdCBkZXB0aCA9IDEuMCAvIGdsX0ZyYWdDb29yZC53O1xuICAgIGlmIChkZXB0aCA+IHNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbaW50KG1heENhc2NhZGVzIC0gMS4wKV0pIHtcbiAgICAgICAgZFNoYWRvd0Nvb3JkLnogPSAtOTk5OTk5OS4wO1xuICAgIH1cbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsdUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
