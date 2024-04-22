var reflectionCCPS = /* glsl */`
#ifdef LIT_CLEARCOAT
void addReflectionCC(vec3 reflDir, float gloss) {
    ccReflection += calcReflection(reflDir, gloss);
}
#endif
`;

export { reflectionCCPS as default };
