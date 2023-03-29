/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowCommonPS = `
void normalOffsetPointShadow(vec4 shadowParams) {
    float distScale = length(dLightDirW);
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - dLightPosW;
    dLightDirW = dir;
}
`;

export { shadowCommonPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q29tbW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL3NoYWRvd0NvbW1vbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBub3JtYWxPZmZzZXRQb2ludFNoYWRvdyh2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIGZsb2F0IGRpc3RTY2FsZSA9IGxlbmd0aChkTGlnaHREaXJXKTtcbiAgICB2ZWMzIHdQb3MgPSB2UG9zaXRpb25XICsgZFZlcnRleE5vcm1hbFcgKiBzaGFkb3dQYXJhbXMueSAqIGNsYW1wKDEuMCAtIGRvdChkVmVydGV4Tm9ybWFsVywgLWRMaWdodERpck5vcm1XKSwgMC4wLCAxLjApICogZGlzdFNjYWxlOyAvLzAuMDJcbiAgICB2ZWMzIGRpciA9IHdQb3MgLSBkTGlnaHRQb3NXO1xuICAgIGRMaWdodERpclcgPSBkaXI7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEscUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FQQTs7OzsifQ==
