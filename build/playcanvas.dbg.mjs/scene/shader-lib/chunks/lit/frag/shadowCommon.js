/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowCommonPS = /* glsl */`
void normalOffsetPointShadow(vec4 shadowParams) {
    float distScale = length(dLightDirW);
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - dLightPosW;
    dLightDirW = dir;
}
`;

export { shadowCommonPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q29tbW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93Q29tbW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIG5vcm1hbE9mZnNldFBvaW50U2hhZG93KHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgZmxvYXQgZGlzdFNjYWxlID0gbGVuZ3RoKGRMaWdodERpclcpO1xuICAgIHZlYzMgd1BvcyA9IHZQb3NpdGlvblcgKyBkVmVydGV4Tm9ybWFsVyAqIHNoYWRvd1BhcmFtcy55ICogY2xhbXAoMS4wIC0gZG90KGRWZXJ0ZXhOb3JtYWxXLCAtZExpZ2h0RGlyTm9ybVcpLCAwLjAsIDEuMCkgKiBkaXN0U2NhbGU7IC8vMC4wMlxuICAgIHZlYzMgZGlyID0gd1BvcyAtIGRMaWdodFBvc1c7XG4gICAgZExpZ2h0RGlyVyA9IGRpcjtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
