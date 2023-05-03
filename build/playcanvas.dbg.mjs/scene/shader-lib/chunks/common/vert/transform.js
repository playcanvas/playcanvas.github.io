var transformVS = /* glsl */`
#ifdef PIXELSNAP
uniform vec4 uScreenSize;
#endif

#ifdef SCREENSPACE
uniform float projectionFlipY;
#endif

#ifdef MORPHING
uniform vec4 morph_weights_a;
uniform vec4 morph_weights_b;
#endif

#ifdef MORPHING_TEXTURE_BASED
uniform vec4 morph_tex_params;

vec2 getTextureMorphCoords() {
    float vertexId = morph_vertex_id;
    vec2 textureSize = morph_tex_params.xy;
    vec2 invTextureSize = morph_tex_params.zw;

    // turn vertexId into int grid coordinates
    float morphGridV = floor(vertexId * invTextureSize.x);
    float morphGridU = vertexId - (morphGridV * textureSize.x);

    // convert grid coordinates to uv coordinates with half pixel offset
    vec2 uv = (vec2(morphGridU, morphGridV) * invTextureSize) + (0.5 * invTextureSize);
    return getImageEffectUV(uv);
}
#endif

#ifdef MORPHING_TEXTURE_BASED_POSITION
uniform highp sampler2D morphPositionTex;
#endif

mat4 getModelMatrix() {
    #ifdef DYNAMICBATCH
    return getBoneMatrix(vertex_boneIndices);
    #elif defined(SKIN)
    return matrix_model * getSkinMatrix(vertex_boneIndices, vertex_boneWeights);
    #elif defined(INSTANCING)
    return mat4(instance_line1, instance_line2, instance_line3, instance_line4);
    #else
    return matrix_model;
    #endif
}

vec4 getPosition() {
    dModelMatrix = getModelMatrix();
    vec3 localPos = vertex_position;

    #ifdef NINESLICED
    // outer and inner vertices are at the same position, scale both
    localPos.xz *= outerScale;

    // offset inner vertices inside
    // (original vertices must be in [-1;1] range)
    vec2 positiveUnitOffset = clamp(vertex_position.xz, vec2(0.0), vec2(1.0));
    vec2 negativeUnitOffset = clamp(-vertex_position.xz, vec2(0.0), vec2(1.0));
    localPos.xz += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;

    vTiledUv = (localPos.xz - outerScale + innerOffset.xy) * -0.5 + 1.0; // uv = local pos - inner corner

    localPos.xz *= -0.5; // move from -1;1 to -0.5;0.5
    localPos = localPos.xzy;
    #endif

    #ifdef MORPHING
    #ifdef MORPHING_POS03
    localPos.xyz += morph_weights_a[0] * morph_pos0;
    localPos.xyz += morph_weights_a[1] * morph_pos1;
    localPos.xyz += morph_weights_a[2] * morph_pos2;
    localPos.xyz += morph_weights_a[3] * morph_pos3;
    #endif // MORPHING_POS03
    #ifdef MORPHING_POS47
    localPos.xyz += morph_weights_b[0] * morph_pos4;
    localPos.xyz += morph_weights_b[1] * morph_pos5;
    localPos.xyz += morph_weights_b[2] * morph_pos6;
    localPos.xyz += morph_weights_b[3] * morph_pos7;
    #endif // MORPHING_POS47
    #endif // MORPHING

    #ifdef MORPHING_TEXTURE_BASED_POSITION
    // apply morph offset from texture
    vec2 morphUV = getTextureMorphCoords();
    vec3 morphPos = texture2D(morphPositionTex, morphUV).xyz;
    localPos += morphPos;
    #endif

    vec4 posW = dModelMatrix * vec4(localPos, 1.0);
    #ifdef SCREENSPACE
    posW.zw = vec2(0.0, 1.0);
    #endif
    dPositionW = posW.xyz;

    vec4 screenPos;
    #ifdef UV1LAYOUT
    screenPos = vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);
    #else
    #ifdef SCREENSPACE
    screenPos = posW;
    screenPos.y *= projectionFlipY;
    #else
    screenPos = matrix_viewProjection * posW;
    #endif

    #ifdef PIXELSNAP
    // snap vertex to a pixel boundary
    screenPos.xy = (screenPos.xy * 0.5) + 0.5;
    screenPos.xy *= uScreenSize.xy;
    screenPos.xy = floor(screenPos.xy);
    screenPos.xy *= uScreenSize.zw;
    screenPos.xy = (screenPos.xy * 2.0) - 1.0;
    #endif
    #endif

    return screenPos;
}

vec3 getWorldPosition() {
    return dPositionW;
}
`;

export { transformVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL3ZlcnQvdHJhbnNmb3JtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgUElYRUxTTkFQXG51bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XG4jZW5kaWZcblxuI2lmZGVmIFNDUkVFTlNQQUNFXG51bmlmb3JtIGZsb2F0IHByb2plY3Rpb25GbGlwWTtcbiNlbmRpZlxuXG4jaWZkZWYgTU9SUEhJTkdcbnVuaWZvcm0gdmVjNCBtb3JwaF93ZWlnaHRzX2E7XG51bmlmb3JtIHZlYzQgbW9ycGhfd2VpZ2h0c19iO1xuI2VuZGlmXG5cbiNpZmRlZiBNT1JQSElOR19URVhUVVJFX0JBU0VEXG51bmlmb3JtIHZlYzQgbW9ycGhfdGV4X3BhcmFtcztcblxudmVjMiBnZXRUZXh0dXJlTW9ycGhDb29yZHMoKSB7XG4gICAgZmxvYXQgdmVydGV4SWQgPSBtb3JwaF92ZXJ0ZXhfaWQ7XG4gICAgdmVjMiB0ZXh0dXJlU2l6ZSA9IG1vcnBoX3RleF9wYXJhbXMueHk7XG4gICAgdmVjMiBpbnZUZXh0dXJlU2l6ZSA9IG1vcnBoX3RleF9wYXJhbXMuenc7XG5cbiAgICAvLyB0dXJuIHZlcnRleElkIGludG8gaW50IGdyaWQgY29vcmRpbmF0ZXNcbiAgICBmbG9hdCBtb3JwaEdyaWRWID0gZmxvb3IodmVydGV4SWQgKiBpbnZUZXh0dXJlU2l6ZS54KTtcbiAgICBmbG9hdCBtb3JwaEdyaWRVID0gdmVydGV4SWQgLSAobW9ycGhHcmlkViAqIHRleHR1cmVTaXplLngpO1xuXG4gICAgLy8gY29udmVydCBncmlkIGNvb3JkaW5hdGVzIHRvIHV2IGNvb3JkaW5hdGVzIHdpdGggaGFsZiBwaXhlbCBvZmZzZXRcbiAgICB2ZWMyIHV2ID0gKHZlYzIobW9ycGhHcmlkVSwgbW9ycGhHcmlkVikgKiBpbnZUZXh0dXJlU2l6ZSkgKyAoMC41ICogaW52VGV4dHVyZVNpemUpO1xuICAgIHJldHVybiBnZXRJbWFnZUVmZmVjdFVWKHV2KTtcbn1cbiNlbmRpZlxuXG4jaWZkZWYgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9QT1NJVElPTlxudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgbW9ycGhQb3NpdGlvblRleDtcbiNlbmRpZlxuXG5tYXQ0IGdldE1vZGVsTWF0cml4KCkge1xuICAgICNpZmRlZiBEWU5BTUlDQkFUQ0hcbiAgICByZXR1cm4gZ2V0Qm9uZU1hdHJpeCh2ZXJ0ZXhfYm9uZUluZGljZXMpO1xuICAgICNlbGlmIGRlZmluZWQoU0tJTilcbiAgICByZXR1cm4gbWF0cml4X21vZGVsICogZ2V0U2tpbk1hdHJpeCh2ZXJ0ZXhfYm9uZUluZGljZXMsIHZlcnRleF9ib25lV2VpZ2h0cyk7XG4gICAgI2VsaWYgZGVmaW5lZChJTlNUQU5DSU5HKVxuICAgIHJldHVybiBtYXQ0KGluc3RhbmNlX2xpbmUxLCBpbnN0YW5jZV9saW5lMiwgaW5zdGFuY2VfbGluZTMsIGluc3RhbmNlX2xpbmU0KTtcbiAgICAjZWxzZVxuICAgIHJldHVybiBtYXRyaXhfbW9kZWw7XG4gICAgI2VuZGlmXG59XG5cbnZlYzQgZ2V0UG9zaXRpb24oKSB7XG4gICAgZE1vZGVsTWF0cml4ID0gZ2V0TW9kZWxNYXRyaXgoKTtcbiAgICB2ZWMzIGxvY2FsUG9zID0gdmVydGV4X3Bvc2l0aW9uO1xuXG4gICAgI2lmZGVmIE5JTkVTTElDRURcbiAgICAvLyBvdXRlciBhbmQgaW5uZXIgdmVydGljZXMgYXJlIGF0IHRoZSBzYW1lIHBvc2l0aW9uLCBzY2FsZSBib3RoXG4gICAgbG9jYWxQb3MueHogKj0gb3V0ZXJTY2FsZTtcblxuICAgIC8vIG9mZnNldCBpbm5lciB2ZXJ0aWNlcyBpbnNpZGVcbiAgICAvLyAob3JpZ2luYWwgdmVydGljZXMgbXVzdCBiZSBpbiBbLTE7MV0gcmFuZ2UpXG4gICAgdmVjMiBwb3NpdGl2ZVVuaXRPZmZzZXQgPSBjbGFtcCh2ZXJ0ZXhfcG9zaXRpb24ueHosIHZlYzIoMC4wKSwgdmVjMigxLjApKTtcbiAgICB2ZWMyIG5lZ2F0aXZlVW5pdE9mZnNldCA9IGNsYW1wKC12ZXJ0ZXhfcG9zaXRpb24ueHosIHZlYzIoMC4wKSwgdmVjMigxLjApKTtcbiAgICBsb2NhbFBvcy54eiArPSAoLXBvc2l0aXZlVW5pdE9mZnNldCAqIGlubmVyT2Zmc2V0Lnh5ICsgbmVnYXRpdmVVbml0T2Zmc2V0ICogaW5uZXJPZmZzZXQuencpICogdmVydGV4X3RleENvb3JkMC54eTtcblxuICAgIHZUaWxlZFV2ID0gKGxvY2FsUG9zLnh6IC0gb3V0ZXJTY2FsZSArIGlubmVyT2Zmc2V0Lnh5KSAqIC0wLjUgKyAxLjA7IC8vIHV2ID0gbG9jYWwgcG9zIC0gaW5uZXIgY29ybmVyXG5cbiAgICBsb2NhbFBvcy54eiAqPSAtMC41OyAvLyBtb3ZlIGZyb20gLTE7MSB0byAtMC41OzAuNVxuICAgIGxvY2FsUG9zID0gbG9jYWxQb3MueHp5O1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1PUlBISU5HXG4gICAgI2lmZGVmIE1PUlBISU5HX1BPUzAzXG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVswXSAqIG1vcnBoX3BvczA7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVsxXSAqIG1vcnBoX3BvczE7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVsyXSAqIG1vcnBoX3BvczI7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVszXSAqIG1vcnBoX3BvczM7XG4gICAgI2VuZGlmIC8vIE1PUlBISU5HX1BPUzAzXG4gICAgI2lmZGVmIE1PUlBISU5HX1BPUzQ3XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlswXSAqIG1vcnBoX3BvczQ7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlsxXSAqIG1vcnBoX3BvczU7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlsyXSAqIG1vcnBoX3BvczY7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlszXSAqIG1vcnBoX3Bvczc7XG4gICAgI2VuZGlmIC8vIE1PUlBISU5HX1BPUzQ3XG4gICAgI2VuZGlmIC8vIE1PUlBISU5HXG5cbiAgICAjaWZkZWYgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9QT1NJVElPTlxuICAgIC8vIGFwcGx5IG1vcnBoIG9mZnNldCBmcm9tIHRleHR1cmVcbiAgICB2ZWMyIG1vcnBoVVYgPSBnZXRUZXh0dXJlTW9ycGhDb29yZHMoKTtcbiAgICB2ZWMzIG1vcnBoUG9zID0gdGV4dHVyZTJEKG1vcnBoUG9zaXRpb25UZXgsIG1vcnBoVVYpLnh5ejtcbiAgICBsb2NhbFBvcyArPSBtb3JwaFBvcztcbiAgICAjZW5kaWZcblxuICAgIHZlYzQgcG9zVyA9IGRNb2RlbE1hdHJpeCAqIHZlYzQobG9jYWxQb3MsIDEuMCk7XG4gICAgI2lmZGVmIFNDUkVFTlNQQUNFXG4gICAgcG9zVy56dyA9IHZlYzIoMC4wLCAxLjApO1xuICAgICNlbmRpZlxuICAgIGRQb3NpdGlvblcgPSBwb3NXLnh5ejtcblxuICAgIHZlYzQgc2NyZWVuUG9zO1xuICAgICNpZmRlZiBVVjFMQVlPVVRcbiAgICBzY3JlZW5Qb3MgPSB2ZWM0KHZlcnRleF90ZXhDb29yZDEueHkgKiAyLjAgLSAxLjAsIDAuNSwgMSk7XG4gICAgI2Vsc2VcbiAgICAjaWZkZWYgU0NSRUVOU1BBQ0VcbiAgICBzY3JlZW5Qb3MgPSBwb3NXO1xuICAgIHNjcmVlblBvcy55ICo9IHByb2plY3Rpb25GbGlwWTtcbiAgICAjZWxzZVxuICAgIHNjcmVlblBvcyA9IG1hdHJpeF92aWV3UHJvamVjdGlvbiAqIHBvc1c7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgUElYRUxTTkFQXG4gICAgLy8gc25hcCB2ZXJ0ZXggdG8gYSBwaXhlbCBib3VuZGFyeVxuICAgIHNjcmVlblBvcy54eSA9IChzY3JlZW5Qb3MueHkgKiAwLjUpICsgMC41O1xuICAgIHNjcmVlblBvcy54eSAqPSB1U2NyZWVuU2l6ZS54eTtcbiAgICBzY3JlZW5Qb3MueHkgPSBmbG9vcihzY3JlZW5Qb3MueHkpO1xuICAgIHNjcmVlblBvcy54eSAqPSB1U2NyZWVuU2l6ZS56dztcbiAgICBzY3JlZW5Qb3MueHkgPSAoc2NyZWVuUG9zLnh5ICogMi4wKSAtIDEuMDtcbiAgICAjZW5kaWZcbiAgICAjZW5kaWZcblxuICAgIHJldHVybiBzY3JlZW5Qb3M7XG59XG5cbnZlYzMgZ2V0V29ybGRQb3NpdGlvbigpIHtcbiAgICByZXR1cm4gZFBvc2l0aW9uVztcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsa0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
