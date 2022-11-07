/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var endPS = `
    gl_FragColor.rgb = combineColor();

    gl_FragColor.rgb += dEmission;
    gl_FragColor.rgb = addFog(gl_FragColor.rgb);

    #ifndef HDR
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
    #endif
`;

export { endPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvZW5kLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IGNvbWJpbmVDb2xvcigpO1xuXG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiArPSBkRW1pc3Npb247XG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IGFkZEZvZyhnbF9GcmFnQ29sb3IucmdiKTtcblxuICAgICNpZm5kZWYgSERSXG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IHRvbmVNYXAoZ2xfRnJhZ0NvbG9yLnJnYik7XG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IGdhbW1hQ29ycmVjdE91dHB1dChnbF9GcmFnQ29sb3IucmdiKTtcbiAgICAjZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxZQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
