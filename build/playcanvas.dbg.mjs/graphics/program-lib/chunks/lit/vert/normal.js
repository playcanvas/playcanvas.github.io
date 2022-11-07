/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalVS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC92ZXJ0L25vcm1hbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE1PUlBISU5HX1RFWFRVUkVfQkFTRURfTk9STUFMXG51bmlmb3JtIGhpZ2hwIHNhbXBsZXIyRCBtb3JwaE5vcm1hbFRleDtcbiNlbmRpZlxuXG52ZWMzIGdldE5vcm1hbCgpIHtcbiAgICAjaWZkZWYgU0tJTlxuICAgIGROb3JtYWxNYXRyaXggPSBtYXQzKGRNb2RlbE1hdHJpeFswXS54eXosIGRNb2RlbE1hdHJpeFsxXS54eXosIGRNb2RlbE1hdHJpeFsyXS54eXopO1xuICAgICNlbGlmIGRlZmluZWQoSU5TVEFOQ0lORylcbiAgICBkTm9ybWFsTWF0cml4ID0gbWF0MyhpbnN0YW5jZV9saW5lMS54eXosIGluc3RhbmNlX2xpbmUyLnh5eiwgaW5zdGFuY2VfbGluZTMueHl6KTtcbiAgICAjZWxzZVxuICAgIGROb3JtYWxNYXRyaXggPSBtYXRyaXhfbm9ybWFsO1xuICAgICNlbmRpZlxuXG4gICAgdmVjMyB0ZW1wTm9ybWFsID0gdmVydGV4X25vcm1hbDtcblxuICAgICNpZmRlZiBNT1JQSElOR1xuICAgICNpZmRlZiBNT1JQSElOR19OUk0wM1xuICAgIHRlbXBOb3JtYWwgKz0gbW9ycGhfd2VpZ2h0c19hWzBdICogbW9ycGhfbnJtMDtcbiAgICB0ZW1wTm9ybWFsICs9IG1vcnBoX3dlaWdodHNfYVsxXSAqIG1vcnBoX25ybTE7XG4gICAgdGVtcE5vcm1hbCArPSBtb3JwaF93ZWlnaHRzX2FbMl0gKiBtb3JwaF9ucm0yO1xuICAgIHRlbXBOb3JtYWwgKz0gbW9ycGhfd2VpZ2h0c19hWzNdICogbW9ycGhfbnJtMztcbiAgICAjZW5kaWZcbiAgICAjaWZkZWYgTU9SUEhJTkdfTlJNNDdcbiAgICB0ZW1wTm9ybWFsICs9IG1vcnBoX3dlaWdodHNfYlswXSAqIG1vcnBoX25ybTQ7XG4gICAgdGVtcE5vcm1hbCArPSBtb3JwaF93ZWlnaHRzX2JbMV0gKiBtb3JwaF9ucm01O1xuICAgIHRlbXBOb3JtYWwgKz0gbW9ycGhfd2VpZ2h0c19iWzJdICogbW9ycGhfbnJtNjtcbiAgICB0ZW1wTm9ybWFsICs9IG1vcnBoX3dlaWdodHNfYlszXSAqIG1vcnBoX25ybTc7XG4gICAgI2VuZGlmXG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9OT1JNQUxcbiAgICAvLyBhcHBseSBtb3JwaCBvZmZzZXQgZnJvbSB0ZXh0dXJlXG4gICAgdmVjMiBtb3JwaFVWID0gZ2V0VGV4dHVyZU1vcnBoQ29vcmRzKCk7XG4gICAgdmVjMyBtb3JwaE5vcm1hbCA9IHRleHR1cmUyRChtb3JwaE5vcm1hbFRleCwgbW9ycGhVVikueHl6O1xuICAgIHRlbXBOb3JtYWwgKz0gbW9ycGhOb3JtYWw7XG4gICAgI2VuZGlmXG5cbiAgICByZXR1cm4gbm9ybWFsaXplKGROb3JtYWxNYXRyaXggKiB0ZW1wTm9ybWFsKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxlQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBeENBOzs7OyJ9
