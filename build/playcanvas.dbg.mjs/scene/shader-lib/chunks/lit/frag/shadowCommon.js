var shadowCommonPS = /* glsl */`
void normalOffsetPointShadow(vec4 shadowParams, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
    float distScale = length(lightDir);
    vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - lightPos;
    lightDir = dir;
}
`;

export { shadowCommonPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q29tbW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93Q29tbW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIG5vcm1hbE9mZnNldFBvaW50U2hhZG93KHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIGxpZ2h0UG9zLCBpbm91dCB2ZWMzIGxpZ2h0RGlyLCB2ZWMzIGxpZ2h0RGlyTm9ybSwgdmVjMyBub3JtYWwpIHtcbiAgICBmbG9hdCBkaXN0U2NhbGUgPSBsZW5ndGgobGlnaHREaXIpO1xuICAgIHZlYzMgd1BvcyA9IHZQb3NpdGlvblcgKyBub3JtYWwgKiBzaGFkb3dQYXJhbXMueSAqIGNsYW1wKDEuMCAtIGRvdChub3JtYWwsIC1saWdodERpck5vcm0pLCAwLjAsIDEuMCkgKiBkaXN0U2NhbGU7IC8vMC4wMlxuICAgIHZlYzMgZGlyID0gd1BvcyAtIGxpZ2h0UG9zO1xuICAgIGxpZ2h0RGlyID0gZGlyO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
