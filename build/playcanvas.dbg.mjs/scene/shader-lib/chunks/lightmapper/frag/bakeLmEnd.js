/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFrZUxtRW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGlnaHRtYXBwZXIvZnJhZy9iYWtlTG1FbmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBnbF9GcmFnQ29sb3IucmdiID0gZERpZmZ1c2VMaWdodDtcbiAgICBnbF9GcmFnQ29sb3IucmdiID0gcG93KGdsX0ZyYWdDb2xvci5yZ2IsIHZlYzMoMC41KSk7XG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiAvPSA4LjA7XG4gICAgZ2xfRnJhZ0NvbG9yLmEgPSBjbGFtcCggbWF4KCBtYXgoIGdsX0ZyYWdDb2xvci5yLCBnbF9GcmFnQ29sb3IuZyApLCBtYXgoIGdsX0ZyYWdDb2xvci5iLCAxLjAgLyAyNTUuMCApICksIDAuMCwxLjAgKTtcbiAgICBnbF9GcmFnQ29sb3IuYSA9IGNlaWwoZ2xfRnJhZ0NvbG9yLmEgKiAyNTUuMCkgLyAyNTUuMDtcbiAgICBnbF9GcmFnQ29sb3IucmdiIC89IGdsX0ZyYWdDb2xvci5hO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
