var particle_pointAlongVS = /* glsl */`
    inAngle = atan(velocityV.x, velocityV.y); // not the fastest way, but easier to plug in; TODO: create rot matrix right from vectors

`;

export { particle_pointAlongVS as default };
