/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var bakeLmEndPS = `
    gl_FragColor.rgb = dDiffuseLight;
    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(0.5));
    gl_FragColor.rgb /= 8.0;
    gl_FragColor.a = clamp( max( max( gl_FragColor.r, gl_FragColor.g ), max( gl_FragColor.b, 1.0 / 255.0 ) ), 0.0,1.0 );
    gl_FragColor.a = ceil(gl_FragColor.a * 255.0) / 255.0;
    gl_FragColor.rgb /= gl_FragColor.a;
`;

export { bakeLmEndPS as default };
