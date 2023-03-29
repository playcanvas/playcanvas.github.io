/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var spotPS = /* glsl */`
float getSpotEffect(vec3 lightSpotDir, float lightInnerConeAngle, float lightOuterConeAngle, vec3 lightDirNorm) {
    float cosAngle = dot(lightDirNorm, lightSpotDir);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
`;

export { spotPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3Nwb3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdldFNwb3RFZmZlY3QodmVjMyBsaWdodFNwb3REaXIsIGZsb2F0IGxpZ2h0SW5uZXJDb25lQW5nbGUsIGZsb2F0IGxpZ2h0T3V0ZXJDb25lQW5nbGUsIHZlYzMgbGlnaHREaXJOb3JtKSB7XG4gICAgZmxvYXQgY29zQW5nbGUgPSBkb3QobGlnaHREaXJOb3JtLCBsaWdodFNwb3REaXIpO1xuICAgIHJldHVybiBzbW9vdGhzdGVwKGxpZ2h0T3V0ZXJDb25lQW5nbGUsIGxpZ2h0SW5uZXJDb25lQW5nbGUsIGNvc0FuZ2xlKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxhQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
