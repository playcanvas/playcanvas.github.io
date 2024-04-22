var tangentBinormalVS = /* glsl */`
vec3 getTangent() {
    return normalize(dNormalMatrix * vertex_tangent.xyz);
}

vec3 getBinormal() {
    return cross(vNormalW, vTangentW) * vertex_tangent.w;
}
`;

export { tangentBinormalVS as default };
