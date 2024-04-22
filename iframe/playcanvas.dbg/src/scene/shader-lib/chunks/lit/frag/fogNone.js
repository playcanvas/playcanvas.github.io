var fogNonePS = /* glsl */`
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    return color;
}
`;

export { fogNonePS as default };
