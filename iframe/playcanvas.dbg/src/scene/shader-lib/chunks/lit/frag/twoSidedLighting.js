var twoSidedLightingPS = /* glsl */`
uniform float twoSidedLightingNegScaleFactor;
void handleTwoSidedLighting() {
    dTBN[2] *= gl_FrontFacing ? twoSidedLightingNegScaleFactor : -twoSidedLightingNegScaleFactor;
}
`;

export { twoSidedLightingPS as default };
