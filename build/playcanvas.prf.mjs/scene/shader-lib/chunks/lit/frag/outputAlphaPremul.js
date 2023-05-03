var outputAlphaPremulPS = `
gl_FragColor.rgb *= litShaderArgs.opacity;
gl_FragColor.a = litShaderArgs.opacity;
`;

export { outputAlphaPremulPS as default };
