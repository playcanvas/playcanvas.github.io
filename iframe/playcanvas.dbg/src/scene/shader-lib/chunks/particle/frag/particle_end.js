var particle_endPS = /* glsl */`
    rgb = addFog(rgb);
    rgb = toneMap(rgb);
    rgb = gammaCorrectOutput(rgb);
    gl_FragColor = vec4(rgb, a);
}
`;

export { particle_endPS as default };
