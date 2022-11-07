var reflDirPS = `
void getReflDir() {
    dReflDirW = normalize(-reflect(dViewDirW, dNormalW));
}
`;

export { reflDirPS as default };
