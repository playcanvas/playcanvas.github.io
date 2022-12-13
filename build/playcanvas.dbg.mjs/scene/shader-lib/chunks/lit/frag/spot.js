/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var spotPS = `
float getSpotEffect(vec3 lightSpotDirW, float lightInnerConeAngle, float lightOuterConeAngle) {
    float cosAngle = dot(dLightDirNormW, lightSpotDirW);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
`;

export { spotPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3Nwb3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdldFNwb3RFZmZlY3QodmVjMyBsaWdodFNwb3REaXJXLCBmbG9hdCBsaWdodElubmVyQ29uZUFuZ2xlLCBmbG9hdCBsaWdodE91dGVyQ29uZUFuZ2xlKSB7XG4gICAgZmxvYXQgY29zQW5nbGUgPSBkb3QoZExpZ2h0RGlyTm9ybVcsIGxpZ2h0U3BvdERpclcpO1xuICAgIHJldHVybiBzbW9vdGhzdGVwKGxpZ2h0T3V0ZXJDb25lQW5nbGUsIGxpZ2h0SW5uZXJDb25lQW5nbGUsIGNvc0FuZ2xlKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxhQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
