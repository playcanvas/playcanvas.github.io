/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var transformVS = `
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
    return (vec2(morphGridU, morphGridV) * invTextureSize) + (0.5 * invTextureSize);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL3ZlcnQvdHJhbnNmb3JtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgUElYRUxTTkFQXG51bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XG4jZW5kaWZcblxuI2lmZGVmIFNDUkVFTlNQQUNFXG51bmlmb3JtIGZsb2F0IHByb2plY3Rpb25GbGlwWTtcbiNlbmRpZlxuXG4jaWZkZWYgTU9SUEhJTkdcbnVuaWZvcm0gdmVjNCBtb3JwaF93ZWlnaHRzX2E7XG51bmlmb3JtIHZlYzQgbW9ycGhfd2VpZ2h0c19iO1xuI2VuZGlmXG5cbiNpZmRlZiBNT1JQSElOR19URVhUVVJFX0JBU0VEXG51bmlmb3JtIHZlYzQgbW9ycGhfdGV4X3BhcmFtcztcblxudmVjMiBnZXRUZXh0dXJlTW9ycGhDb29yZHMoKSB7XG4gICAgZmxvYXQgdmVydGV4SWQgPSBtb3JwaF92ZXJ0ZXhfaWQ7XG4gICAgdmVjMiB0ZXh0dXJlU2l6ZSA9IG1vcnBoX3RleF9wYXJhbXMueHk7XG4gICAgdmVjMiBpbnZUZXh0dXJlU2l6ZSA9IG1vcnBoX3RleF9wYXJhbXMuenc7XG5cbiAgICAvLyB0dXJuIHZlcnRleElkIGludG8gaW50IGdyaWQgY29vcmRpbmF0ZXNcbiAgICBmbG9hdCBtb3JwaEdyaWRWID0gZmxvb3IodmVydGV4SWQgKiBpbnZUZXh0dXJlU2l6ZS54KTtcbiAgICBmbG9hdCBtb3JwaEdyaWRVID0gdmVydGV4SWQgLSAobW9ycGhHcmlkViAqIHRleHR1cmVTaXplLngpO1xuXG4gICAgLy8gY29udmVydCBncmlkIGNvb3JkaW5hdGVzIHRvIHV2IGNvb3JkaW5hdGVzIHdpdGggaGFsZiBwaXhlbCBvZmZzZXRcbiAgICByZXR1cm4gKHZlYzIobW9ycGhHcmlkVSwgbW9ycGhHcmlkVikgKiBpbnZUZXh0dXJlU2l6ZSkgKyAoMC41ICogaW52VGV4dHVyZVNpemUpO1xufVxuI2VuZGlmXG5cbiNpZmRlZiBNT1JQSElOR19URVhUVVJFX0JBU0VEX1BPU0lUSU9OXG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBtb3JwaFBvc2l0aW9uVGV4O1xuI2VuZGlmXG5cbm1hdDQgZ2V0TW9kZWxNYXRyaXgoKSB7XG4gICAgI2lmZGVmIERZTkFNSUNCQVRDSFxuICAgIHJldHVybiBnZXRCb25lTWF0cml4KHZlcnRleF9ib25lSW5kaWNlcyk7XG4gICAgI2VsaWYgZGVmaW5lZChTS0lOKVxuICAgIHJldHVybiBtYXRyaXhfbW9kZWwgKiBnZXRTa2luTWF0cml4KHZlcnRleF9ib25lSW5kaWNlcywgdmVydGV4X2JvbmVXZWlnaHRzKTtcbiAgICAjZWxpZiBkZWZpbmVkKElOU1RBTkNJTkcpXG4gICAgcmV0dXJuIG1hdDQoaW5zdGFuY2VfbGluZTEsIGluc3RhbmNlX2xpbmUyLCBpbnN0YW5jZV9saW5lMywgaW5zdGFuY2VfbGluZTQpO1xuICAgICNlbHNlXG4gICAgcmV0dXJuIG1hdHJpeF9tb2RlbDtcbiAgICAjZW5kaWZcbn1cblxudmVjNCBnZXRQb3NpdGlvbigpIHtcbiAgICBkTW9kZWxNYXRyaXggPSBnZXRNb2RlbE1hdHJpeCgpO1xuICAgIHZlYzMgbG9jYWxQb3MgPSB2ZXJ0ZXhfcG9zaXRpb247XG5cbiAgICAjaWZkZWYgTklORVNMSUNFRFxuICAgIC8vIG91dGVyIGFuZCBpbm5lciB2ZXJ0aWNlcyBhcmUgYXQgdGhlIHNhbWUgcG9zaXRpb24sIHNjYWxlIGJvdGhcbiAgICBsb2NhbFBvcy54eiAqPSBvdXRlclNjYWxlO1xuXG4gICAgLy8gb2Zmc2V0IGlubmVyIHZlcnRpY2VzIGluc2lkZVxuICAgIC8vIChvcmlnaW5hbCB2ZXJ0aWNlcyBtdXN0IGJlIGluIFstMTsxXSByYW5nZSlcbiAgICB2ZWMyIHBvc2l0aXZlVW5pdE9mZnNldCA9IGNsYW1wKHZlcnRleF9wb3NpdGlvbi54eiwgdmVjMigwLjApLCB2ZWMyKDEuMCkpO1xuICAgIHZlYzIgbmVnYXRpdmVVbml0T2Zmc2V0ID0gY2xhbXAoLXZlcnRleF9wb3NpdGlvbi54eiwgdmVjMigwLjApLCB2ZWMyKDEuMCkpO1xuICAgIGxvY2FsUG9zLnh6ICs9ICgtcG9zaXRpdmVVbml0T2Zmc2V0ICogaW5uZXJPZmZzZXQueHkgKyBuZWdhdGl2ZVVuaXRPZmZzZXQgKiBpbm5lck9mZnNldC56dykgKiB2ZXJ0ZXhfdGV4Q29vcmQwLnh5O1xuXG4gICAgdlRpbGVkVXYgPSAobG9jYWxQb3MueHogLSBvdXRlclNjYWxlICsgaW5uZXJPZmZzZXQueHkpICogLTAuNSArIDEuMDsgLy8gdXYgPSBsb2NhbCBwb3MgLSBpbm5lciBjb3JuZXJcblxuICAgIGxvY2FsUG9zLnh6ICo9IC0wLjU7IC8vIG1vdmUgZnJvbSAtMTsxIHRvIC0wLjU7MC41XG4gICAgbG9jYWxQb3MgPSBsb2NhbFBvcy54enk7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTU9SUEhJTkdcbiAgICAjaWZkZWYgTU9SUEhJTkdfUE9TMDNcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19hWzBdICogbW9ycGhfcG9zMDtcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19hWzFdICogbW9ycGhfcG9zMTtcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19hWzJdICogbW9ycGhfcG9zMjtcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19hWzNdICogbW9ycGhfcG9zMztcbiAgICAjZW5kaWYgLy8gTU9SUEhJTkdfUE9TMDNcbiAgICAjaWZkZWYgTU9SUEhJTkdfUE9TNDdcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19iWzBdICogbW9ycGhfcG9zNDtcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19iWzFdICogbW9ycGhfcG9zNTtcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19iWzJdICogbW9ycGhfcG9zNjtcbiAgICBsb2NhbFBvcy54eXogKz0gbW9ycGhfd2VpZ2h0c19iWzNdICogbW9ycGhfcG9zNztcbiAgICAjZW5kaWYgLy8gTU9SUEhJTkdfUE9TNDdcbiAgICAjZW5kaWYgLy8gTU9SUEhJTkdcblxuICAgICNpZmRlZiBNT1JQSElOR19URVhUVVJFX0JBU0VEX1BPU0lUSU9OXG4gICAgLy8gYXBwbHkgbW9ycGggb2Zmc2V0IGZyb20gdGV4dHVyZVxuICAgIHZlYzIgbW9ycGhVViA9IGdldFRleHR1cmVNb3JwaENvb3JkcygpO1xuICAgIHZlYzMgbW9ycGhQb3MgPSB0ZXh0dXJlMkQobW9ycGhQb3NpdGlvblRleCwgbW9ycGhVVikueHl6O1xuICAgIGxvY2FsUG9zICs9IG1vcnBoUG9zO1xuICAgICNlbmRpZlxuXG4gICAgdmVjNCBwb3NXID0gZE1vZGVsTWF0cml4ICogdmVjNChsb2NhbFBvcywgMS4wKTtcbiAgICAjaWZkZWYgU0NSRUVOU1BBQ0VcbiAgICBwb3NXLnp3ID0gdmVjMigwLjAsIDEuMCk7XG4gICAgI2VuZGlmXG4gICAgZFBvc2l0aW9uVyA9IHBvc1cueHl6O1xuXG4gICAgdmVjNCBzY3JlZW5Qb3M7XG4gICAgI2lmZGVmIFVWMUxBWU9VVFxuICAgIHNjcmVlblBvcyA9IHZlYzQodmVydGV4X3RleENvb3JkMS54eSAqIDIuMCAtIDEuMCwgMC41LCAxKTtcbiAgICAjZWxzZVxuICAgICNpZmRlZiBTQ1JFRU5TUEFDRVxuICAgIHNjcmVlblBvcyA9IHBvc1c7XG4gICAgc2NyZWVuUG9zLnkgKj0gcHJvamVjdGlvbkZsaXBZO1xuICAgICNlbHNlXG4gICAgc2NyZWVuUG9zID0gbWF0cml4X3ZpZXdQcm9qZWN0aW9uICogcG9zVztcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBQSVhFTFNOQVBcbiAgICAvLyBzbmFwIHZlcnRleCB0byBhIHBpeGVsIGJvdW5kYXJ5XG4gICAgc2NyZWVuUG9zLnh5ID0gKHNjcmVlblBvcy54eSAqIDAuNSkgKyAwLjU7XG4gICAgc2NyZWVuUG9zLnh5ICo9IHVTY3JlZW5TaXplLnh5O1xuICAgIHNjcmVlblBvcy54eSA9IGZsb29yKHNjcmVlblBvcy54eSk7XG4gICAgc2NyZWVuUG9zLnh5ICo9IHVTY3JlZW5TaXplLnp3O1xuICAgIHNjcmVlblBvcy54eSA9IChzY3JlZW5Qb3MueHkgKiAyLjApIC0gMS4wO1xuICAgICNlbmRpZlxuICAgICNlbmRpZlxuXG4gICAgcmV0dXJuIHNjcmVlblBvcztcbn1cblxudmVjMyBnZXRXb3JsZFBvc2l0aW9uKCkge1xuICAgIHJldHVybiBkUG9zaXRpb25XO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
