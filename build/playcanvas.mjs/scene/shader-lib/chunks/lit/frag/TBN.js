var TBNPS = `
void getTBN() {
		dTBN = mat3(normalize(dTangentW), normalize(dBinormalW), normalize(dVertexNormalW));
}
`;

export { TBNPS as default };
