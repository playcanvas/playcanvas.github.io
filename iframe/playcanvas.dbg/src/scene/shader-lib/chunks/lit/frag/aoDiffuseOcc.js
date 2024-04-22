var aoDiffuseOccPS = /* glsl */`
void occludeDiffuse(float ao) {
    dDiffuseLight *= ao;
}
`;

export { aoDiffuseOccPS as default };
