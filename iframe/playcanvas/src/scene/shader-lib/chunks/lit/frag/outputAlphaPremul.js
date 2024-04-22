var outputAlphaPremulPS = `
gl_FragColor.rgb *= litArgs_opacity;
gl_FragColor.a = litArgs_opacity;
`;

export { outputAlphaPremulPS as default };
