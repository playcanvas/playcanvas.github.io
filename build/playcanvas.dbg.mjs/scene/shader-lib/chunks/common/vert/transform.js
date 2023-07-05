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

    #ifdef WEBGPU
        ivec2 getTextureMorphCoords() {

            // turn morph_vertex_id into int grid coordinates
            ivec2 textureSize = ivec2(morph_tex_params.xy);
            int morphGridV = int(morph_vertex_id / textureSize.x);
            int morphGridU = int(morph_vertex_id - (morphGridV * textureSize.x));
            morphGridV = textureSize.y - morphGridV - 1;
            return ivec2(morphGridU, morphGridV);
        }
    #else
        vec2 getTextureMorphCoords() {
            vec2 textureSize = morph_tex_params.xy;
            vec2 invTextureSize = morph_tex_params.zw;

            // turn morph_vertex_id into int grid coordinates
            float morphGridV = floor(morph_vertex_id * invTextureSize.x);
            float morphGridU = morph_vertex_id - (morphGridV * textureSize.x);

            // convert grid coordinates to uv coordinates with half pixel offset
            return vec2(morphGridU, morphGridV) * invTextureSize + (0.5 * invTextureSize);
        }
    #endif

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

        #ifdef WEBGPU
            ivec2 morphUV = getTextureMorphCoords();
            vec3 morphPos = texelFetch(morphPositionTex, ivec2(morphUV), 0).xyz;
        #else
            vec2 morphUV = getTextureMorphCoords();
            vec3 morphPos = texture2D(morphPositionTex, morphUV).xyz;
        #endif

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL3ZlcnQvdHJhbnNmb3JtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgUElYRUxTTkFQXG51bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XG4jZW5kaWZcblxuI2lmZGVmIFNDUkVFTlNQQUNFXG51bmlmb3JtIGZsb2F0IHByb2plY3Rpb25GbGlwWTtcbiNlbmRpZlxuXG4jaWZkZWYgTU9SUEhJTkdcbnVuaWZvcm0gdmVjNCBtb3JwaF93ZWlnaHRzX2E7XG51bmlmb3JtIHZlYzQgbW9ycGhfd2VpZ2h0c19iO1xuI2VuZGlmXG5cbiNpZmRlZiBNT1JQSElOR19URVhUVVJFX0JBU0VEXG4gICAgdW5pZm9ybSB2ZWM0IG1vcnBoX3RleF9wYXJhbXM7XG5cbiAgICAjaWZkZWYgV0VCR1BVXG4gICAgICAgIGl2ZWMyIGdldFRleHR1cmVNb3JwaENvb3JkcygpIHtcblxuICAgICAgICAgICAgLy8gdHVybiBtb3JwaF92ZXJ0ZXhfaWQgaW50byBpbnQgZ3JpZCBjb29yZGluYXRlc1xuICAgICAgICAgICAgaXZlYzIgdGV4dHVyZVNpemUgPSBpdmVjMihtb3JwaF90ZXhfcGFyYW1zLnh5KTtcbiAgICAgICAgICAgIGludCBtb3JwaEdyaWRWID0gaW50KG1vcnBoX3ZlcnRleF9pZCAvIHRleHR1cmVTaXplLngpO1xuICAgICAgICAgICAgaW50IG1vcnBoR3JpZFUgPSBpbnQobW9ycGhfdmVydGV4X2lkIC0gKG1vcnBoR3JpZFYgKiB0ZXh0dXJlU2l6ZS54KSk7XG4gICAgICAgICAgICBtb3JwaEdyaWRWID0gdGV4dHVyZVNpemUueSAtIG1vcnBoR3JpZFYgLSAxO1xuICAgICAgICAgICAgcmV0dXJuIGl2ZWMyKG1vcnBoR3JpZFUsIG1vcnBoR3JpZFYpO1xuICAgICAgICB9XG4gICAgI2Vsc2VcbiAgICAgICAgdmVjMiBnZXRUZXh0dXJlTW9ycGhDb29yZHMoKSB7XG4gICAgICAgICAgICB2ZWMyIHRleHR1cmVTaXplID0gbW9ycGhfdGV4X3BhcmFtcy54eTtcbiAgICAgICAgICAgIHZlYzIgaW52VGV4dHVyZVNpemUgPSBtb3JwaF90ZXhfcGFyYW1zLnp3O1xuXG4gICAgICAgICAgICAvLyB0dXJuIG1vcnBoX3ZlcnRleF9pZCBpbnRvIGludCBncmlkIGNvb3JkaW5hdGVzXG4gICAgICAgICAgICBmbG9hdCBtb3JwaEdyaWRWID0gZmxvb3IobW9ycGhfdmVydGV4X2lkICogaW52VGV4dHVyZVNpemUueCk7XG4gICAgICAgICAgICBmbG9hdCBtb3JwaEdyaWRVID0gbW9ycGhfdmVydGV4X2lkIC0gKG1vcnBoR3JpZFYgKiB0ZXh0dXJlU2l6ZS54KTtcblxuICAgICAgICAgICAgLy8gY29udmVydCBncmlkIGNvb3JkaW5hdGVzIHRvIHV2IGNvb3JkaW5hdGVzIHdpdGggaGFsZiBwaXhlbCBvZmZzZXRcbiAgICAgICAgICAgIHJldHVybiB2ZWMyKG1vcnBoR3JpZFUsIG1vcnBoR3JpZFYpICogaW52VGV4dHVyZVNpemUgKyAoMC41ICogaW52VGV4dHVyZVNpemUpO1xuICAgICAgICB9XG4gICAgI2VuZGlmXG5cbiNlbmRpZlxuXG4jaWZkZWYgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9QT1NJVElPTlxudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgbW9ycGhQb3NpdGlvblRleDtcbiNlbmRpZlxuXG5tYXQ0IGdldE1vZGVsTWF0cml4KCkge1xuICAgICNpZmRlZiBEWU5BTUlDQkFUQ0hcbiAgICByZXR1cm4gZ2V0Qm9uZU1hdHJpeCh2ZXJ0ZXhfYm9uZUluZGljZXMpO1xuICAgICNlbGlmIGRlZmluZWQoU0tJTilcbiAgICByZXR1cm4gbWF0cml4X21vZGVsICogZ2V0U2tpbk1hdHJpeCh2ZXJ0ZXhfYm9uZUluZGljZXMsIHZlcnRleF9ib25lV2VpZ2h0cyk7XG4gICAgI2VsaWYgZGVmaW5lZChJTlNUQU5DSU5HKVxuICAgIHJldHVybiBtYXQ0KGluc3RhbmNlX2xpbmUxLCBpbnN0YW5jZV9saW5lMiwgaW5zdGFuY2VfbGluZTMsIGluc3RhbmNlX2xpbmU0KTtcbiAgICAjZWxzZVxuICAgIHJldHVybiBtYXRyaXhfbW9kZWw7XG4gICAgI2VuZGlmXG59XG5cbnZlYzQgZ2V0UG9zaXRpb24oKSB7XG4gICAgZE1vZGVsTWF0cml4ID0gZ2V0TW9kZWxNYXRyaXgoKTtcbiAgICB2ZWMzIGxvY2FsUG9zID0gdmVydGV4X3Bvc2l0aW9uO1xuXG4gICAgI2lmZGVmIE5JTkVTTElDRURcbiAgICAvLyBvdXRlciBhbmQgaW5uZXIgdmVydGljZXMgYXJlIGF0IHRoZSBzYW1lIHBvc2l0aW9uLCBzY2FsZSBib3RoXG4gICAgbG9jYWxQb3MueHogKj0gb3V0ZXJTY2FsZTtcblxuICAgIC8vIG9mZnNldCBpbm5lciB2ZXJ0aWNlcyBpbnNpZGVcbiAgICAvLyAob3JpZ2luYWwgdmVydGljZXMgbXVzdCBiZSBpbiBbLTE7MV0gcmFuZ2UpXG4gICAgdmVjMiBwb3NpdGl2ZVVuaXRPZmZzZXQgPSBjbGFtcCh2ZXJ0ZXhfcG9zaXRpb24ueHosIHZlYzIoMC4wKSwgdmVjMigxLjApKTtcbiAgICB2ZWMyIG5lZ2F0aXZlVW5pdE9mZnNldCA9IGNsYW1wKC12ZXJ0ZXhfcG9zaXRpb24ueHosIHZlYzIoMC4wKSwgdmVjMigxLjApKTtcbiAgICBsb2NhbFBvcy54eiArPSAoLXBvc2l0aXZlVW5pdE9mZnNldCAqIGlubmVyT2Zmc2V0Lnh5ICsgbmVnYXRpdmVVbml0T2Zmc2V0ICogaW5uZXJPZmZzZXQuencpICogdmVydGV4X3RleENvb3JkMC54eTtcblxuICAgIHZUaWxlZFV2ID0gKGxvY2FsUG9zLnh6IC0gb3V0ZXJTY2FsZSArIGlubmVyT2Zmc2V0Lnh5KSAqIC0wLjUgKyAxLjA7IC8vIHV2ID0gbG9jYWwgcG9zIC0gaW5uZXIgY29ybmVyXG5cbiAgICBsb2NhbFBvcy54eiAqPSAtMC41OyAvLyBtb3ZlIGZyb20gLTE7MSB0byAtMC41OzAuNVxuICAgIGxvY2FsUG9zID0gbG9jYWxQb3MueHp5O1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1PUlBISU5HXG4gICAgI2lmZGVmIE1PUlBISU5HX1BPUzAzXG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVswXSAqIG1vcnBoX3BvczA7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVsxXSAqIG1vcnBoX3BvczE7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVsyXSAqIG1vcnBoX3BvczI7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYVszXSAqIG1vcnBoX3BvczM7XG4gICAgI2VuZGlmIC8vIE1PUlBISU5HX1BPUzAzXG4gICAgI2lmZGVmIE1PUlBISU5HX1BPUzQ3XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlswXSAqIG1vcnBoX3BvczQ7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlsxXSAqIG1vcnBoX3BvczU7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlsyXSAqIG1vcnBoX3BvczY7XG4gICAgbG9jYWxQb3MueHl6ICs9IG1vcnBoX3dlaWdodHNfYlszXSAqIG1vcnBoX3Bvczc7XG4gICAgI2VuZGlmIC8vIE1PUlBISU5HX1BPUzQ3XG4gICAgI2VuZGlmIC8vIE1PUlBISU5HXG5cbiAgICAjaWZkZWYgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9QT1NJVElPTlxuXG4gICAgICAgICNpZmRlZiBXRUJHUFVcbiAgICAgICAgICAgIGl2ZWMyIG1vcnBoVVYgPSBnZXRUZXh0dXJlTW9ycGhDb29yZHMoKTtcbiAgICAgICAgICAgIHZlYzMgbW9ycGhQb3MgPSB0ZXhlbEZldGNoKG1vcnBoUG9zaXRpb25UZXgsIGl2ZWMyKG1vcnBoVVYpLCAwKS54eXo7XG4gICAgICAgICNlbHNlXG4gICAgICAgICAgICB2ZWMyIG1vcnBoVVYgPSBnZXRUZXh0dXJlTW9ycGhDb29yZHMoKTtcbiAgICAgICAgICAgIHZlYzMgbW9ycGhQb3MgPSB0ZXh0dXJlMkQobW9ycGhQb3NpdGlvblRleCwgbW9ycGhVVikueHl6O1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICBsb2NhbFBvcyArPSBtb3JwaFBvcztcblxuICAgICNlbmRpZlxuXG4gICAgdmVjNCBwb3NXID0gZE1vZGVsTWF0cml4ICogdmVjNChsb2NhbFBvcywgMS4wKTtcbiAgICAjaWZkZWYgU0NSRUVOU1BBQ0VcbiAgICBwb3NXLnp3ID0gdmVjMigwLjAsIDEuMCk7XG4gICAgI2VuZGlmXG4gICAgZFBvc2l0aW9uVyA9IHBvc1cueHl6O1xuXG4gICAgdmVjNCBzY3JlZW5Qb3M7XG4gICAgI2lmZGVmIFVWMUxBWU9VVFxuICAgIHNjcmVlblBvcyA9IHZlYzQodmVydGV4X3RleENvb3JkMS54eSAqIDIuMCAtIDEuMCwgMC41LCAxKTtcbiAgICAjZWxzZVxuICAgICNpZmRlZiBTQ1JFRU5TUEFDRVxuICAgIHNjcmVlblBvcyA9IHBvc1c7XG4gICAgc2NyZWVuUG9zLnkgKj0gcHJvamVjdGlvbkZsaXBZO1xuICAgICNlbHNlXG4gICAgc2NyZWVuUG9zID0gbWF0cml4X3ZpZXdQcm9qZWN0aW9uICogcG9zVztcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBQSVhFTFNOQVBcbiAgICAvLyBzbmFwIHZlcnRleCB0byBhIHBpeGVsIGJvdW5kYXJ5XG4gICAgc2NyZWVuUG9zLnh5ID0gKHNjcmVlblBvcy54eSAqIDAuNSkgKyAwLjU7XG4gICAgc2NyZWVuUG9zLnh5ICo9IHVTY3JlZW5TaXplLnh5O1xuICAgIHNjcmVlblBvcy54eSA9IGZsb29yKHNjcmVlblBvcy54eSk7XG4gICAgc2NyZWVuUG9zLnh5ICo9IHVTY3JlZW5TaXplLnp3O1xuICAgIHNjcmVlblBvcy54eSA9IChzY3JlZW5Qb3MueHkgKiAyLjApIC0gMS4wO1xuICAgICNlbmRpZlxuICAgICNlbmRpZlxuXG4gICAgcmV0dXJuIHNjcmVlblBvcztcbn1cblxudmVjMyBnZXRXb3JsZFBvc2l0aW9uKCkge1xuICAgIHJldHVybiBkUG9zaXRpb25XO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
