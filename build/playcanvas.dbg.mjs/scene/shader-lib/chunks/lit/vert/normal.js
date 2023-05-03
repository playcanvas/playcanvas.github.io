var normalVS = /* glsl */`
#ifdef MORPHING_TEXTURE_BASED_NORMAL
uniform highp sampler2D morphNormalTex;
#endif

vec3 getNormal() {
    #ifdef SKIN
    dNormalMatrix = mat3(dModelMatrix[0].xyz, dModelMatrix[1].xyz, dModelMatrix[2].xyz);
    #elif defined(INSTANCING)
    dNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);
    #else
    dNormalMatrix = matrix_normal;
    #endif

    vec3 tempNormal = vertex_normal;

    #ifdef MORPHING
    #ifdef MORPHING_NRM03
    tempNormal += morph_weights_a[0] * morph_nrm0;
    tempNormal += morph_weights_a[1] * morph_nrm1;
    tempNormal += morph_weights_a[2] * morph_nrm2;
    tempNormal += morph_weights_a[3] * morph_nrm3;
    #endif
    #ifdef MORPHING_NRM47
    tempNormal += morph_weights_b[0] * morph_nrm4;
    tempNormal += morph_weights_b[1] * morph_nrm5;
    tempNormal += morph_weights_b[2] * morph_nrm6;
    tempNormal += morph_weights_b[3] * morph_nrm7;
    #endif
    #endif

    #ifdef MORPHING_TEXTURE_BASED_NORMAL
    // apply morph offset from texture
    vec2 morphUV = getTextureMorphCoords();
    vec3 morphNormal = texture2D(morphNormalTex, morphUV).xyz;
    tempNormal += morphNormal;
    #endif

    return normalize(dNormalMatrix * tempNormal);
}
`;

export { normalVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L3ZlcnQvbm9ybWFsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9OT1JNQUxcbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIG1vcnBoTm9ybWFsVGV4O1xuI2VuZGlmXG5cbnZlYzMgZ2V0Tm9ybWFsKCkge1xuICAgICNpZmRlZiBTS0lOXG4gICAgZE5vcm1hbE1hdHJpeCA9IG1hdDMoZE1vZGVsTWF0cml4WzBdLnh5eiwgZE1vZGVsTWF0cml4WzFdLnh5eiwgZE1vZGVsTWF0cml4WzJdLnh5eik7XG4gICAgI2VsaWYgZGVmaW5lZChJTlNUQU5DSU5HKVxuICAgIGROb3JtYWxNYXRyaXggPSBtYXQzKGluc3RhbmNlX2xpbmUxLnh5eiwgaW5zdGFuY2VfbGluZTIueHl6LCBpbnN0YW5jZV9saW5lMy54eXopO1xuICAgICNlbHNlXG4gICAgZE5vcm1hbE1hdHJpeCA9IG1hdHJpeF9ub3JtYWw7XG4gICAgI2VuZGlmXG5cbiAgICB2ZWMzIHRlbXBOb3JtYWwgPSB2ZXJ0ZXhfbm9ybWFsO1xuXG4gICAgI2lmZGVmIE1PUlBISU5HXG4gICAgI2lmZGVmIE1PUlBISU5HX05STTAzXG4gICAgdGVtcE5vcm1hbCArPSBtb3JwaF93ZWlnaHRzX2FbMF0gKiBtb3JwaF9ucm0wO1xuICAgIHRlbXBOb3JtYWwgKz0gbW9ycGhfd2VpZ2h0c19hWzFdICogbW9ycGhfbnJtMTtcbiAgICB0ZW1wTm9ybWFsICs9IG1vcnBoX3dlaWdodHNfYVsyXSAqIG1vcnBoX25ybTI7XG4gICAgdGVtcE5vcm1hbCArPSBtb3JwaF93ZWlnaHRzX2FbM10gKiBtb3JwaF9ucm0zO1xuICAgICNlbmRpZlxuICAgICNpZmRlZiBNT1JQSElOR19OUk00N1xuICAgIHRlbXBOb3JtYWwgKz0gbW9ycGhfd2VpZ2h0c19iWzBdICogbW9ycGhfbnJtNDtcbiAgICB0ZW1wTm9ybWFsICs9IG1vcnBoX3dlaWdodHNfYlsxXSAqIG1vcnBoX25ybTU7XG4gICAgdGVtcE5vcm1hbCArPSBtb3JwaF93ZWlnaHRzX2JbMl0gKiBtb3JwaF9ucm02O1xuICAgIHRlbXBOb3JtYWwgKz0gbW9ycGhfd2VpZ2h0c19iWzNdICogbW9ycGhfbnJtNztcbiAgICAjZW5kaWZcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNT1JQSElOR19URVhUVVJFX0JBU0VEX05PUk1BTFxuICAgIC8vIGFwcGx5IG1vcnBoIG9mZnNldCBmcm9tIHRleHR1cmVcbiAgICB2ZWMyIG1vcnBoVVYgPSBnZXRUZXh0dXJlTW9ycGhDb29yZHMoKTtcbiAgICB2ZWMzIG1vcnBoTm9ybWFsID0gdGV4dHVyZTJEKG1vcnBoTm9ybWFsVGV4LCBtb3JwaFVWKS54eXo7XG4gICAgdGVtcE5vcm1hbCArPSBtb3JwaE5vcm1hbDtcbiAgICAjZW5kaWZcblxuICAgIHJldHVybiBub3JtYWxpemUoZE5vcm1hbE1hdHJpeCAqIHRlbXBOb3JtYWwpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxlQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
