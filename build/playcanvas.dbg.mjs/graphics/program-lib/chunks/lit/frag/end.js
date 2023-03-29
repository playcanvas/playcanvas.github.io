/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2VuZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBjb21iaW5lQ29sb3IoKTtcblxuICAgIGdsX0ZyYWdDb2xvci5yZ2IgKz0gZEVtaXNzaW9uO1xuICAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBhZGRGb2coZ2xfRnJhZ0NvbG9yLnJnYik7XG5cbiAgICAjaWZuZGVmIEhEUlxuICAgIGdsX0ZyYWdDb2xvci5yZ2IgPSB0b25lTWFwKGdsX0ZyYWdDb2xvci5yZ2IpO1xuICAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBnYW1tYUNvcnJlY3RPdXRwdXQoZ2xfRnJhZ0NvbG9yLnJnYik7XG4gICAgI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsWUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVZBOzs7OyJ9
