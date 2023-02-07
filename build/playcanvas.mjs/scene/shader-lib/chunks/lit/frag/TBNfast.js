var TBNfastPS = `
void getTBN() {
		dTBN = mat3(dTangentW, dBinormalW, dVertexNormalW);
}
`;

export { TBNfastPS as default };
