var gamma1_0PS = /* glsl */`
float gammaCorrectInput(float color) {
    return color;
}

vec3 gammaCorrectInput(vec3 color) {
    return color;
}

vec4 gammaCorrectInput(vec4 color) {
    return color;
}

vec3 gammaCorrectOutput(vec3 color) {
    return color;
}
`;

export { gamma1_0PS as default };
