/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_lightingPS = `
    vec3 light = negNormal.x*lightCube[0] + posNormal.x*lightCube[1] +
                        negNormal.y*lightCube[2] + posNormal.y*lightCube[3] +
                        negNormal.z*lightCube[4] + posNormal.z*lightCube[5];

    rgb *= light;
`;

export { particle_lightingPS as default };
