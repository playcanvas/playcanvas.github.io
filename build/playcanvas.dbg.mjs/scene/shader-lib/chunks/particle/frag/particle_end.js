/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_endPS = `
    rgb = addFog(rgb);
    rgb = toneMap(rgb);
    rgb = gammaCorrectOutput(rgb);
    gl_FragColor = vec4(rgb, a);
}
`;

export { particle_endPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfZW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZV9lbmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICByZ2IgPSBhZGRGb2cocmdiKTtcbiAgICByZ2IgPSB0b25lTWFwKHJnYik7XG4gICAgcmdiID0gZ2FtbWFDb3JyZWN0T3V0cHV0KHJnYik7XG4gICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChyZ2IsIGEpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHFCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9