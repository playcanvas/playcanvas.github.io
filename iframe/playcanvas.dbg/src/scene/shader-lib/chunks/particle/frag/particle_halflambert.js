var particle_halflambertPS = /* glsl */`
    vec3 negNormal = normal*0.5+0.5;
    vec3 posNormal = -normal*0.5+0.5;
    negNormal *= negNormal;
    posNormal *= posNormal;
`;

export { particle_halflambertPS as default };
