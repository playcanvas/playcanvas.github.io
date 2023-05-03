var particle_billboardVS = `
		quadXY = rotate(quadXY, inAngle, rotMatrix);
		vec3 localPos = billboard(particlePos, quadXY);
`;

export { particle_billboardVS as default };
