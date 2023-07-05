var aoSpecOccConstSimplePS = `
void occludeSpecular() {
    dSpecularLight *= dAo;
    dReflection *= dAo;
}
`;

export { aoSpecOccConstSimplePS as default };
