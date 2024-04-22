var particleAnimFrameLoopVS = /* glsl */`
    float animFrame = floor(mod(texCoordsAlphaLife.w * animTexParams.y + animTexParams.x, animTexParams.z + 1.0));
`;

export { particleAnimFrameLoopVS as default };
