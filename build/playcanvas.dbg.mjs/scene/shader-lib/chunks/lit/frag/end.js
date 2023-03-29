/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var endPS = /* glsl */`
    gl_FragColor.rgb = combineColor(litShaderArgs.albedo, litShaderArgs.sheen.specularity, litShaderArgs.clearcoat.specularity);

    gl_FragColor.rgb += litShaderArgs.emission;
    gl_FragColor.rgb = addFog(gl_FragColor.rgb);

    #ifndef HDR
    gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
    gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
    #endif
`;

export { endPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvZW5kLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IGNvbWJpbmVDb2xvcihsaXRTaGFkZXJBcmdzLmFsYmVkbywgbGl0U2hhZGVyQXJncy5zaGVlbi5zcGVjdWxhcml0eSwgbGl0U2hhZGVyQXJncy5jbGVhcmNvYXQuc3BlY3VsYXJpdHkpO1xuXG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiArPSBsaXRTaGFkZXJBcmdzLmVtaXNzaW9uO1xuICAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBhZGRGb2coZ2xfRnJhZ0NvbG9yLnJnYik7XG5cbiAgICAjaWZuZGVmIEhEUlxuICAgIGdsX0ZyYWdDb2xvci5yZ2IgPSB0b25lTWFwKGdsX0ZyYWdDb2xvci5yZ2IpO1xuICAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBnYW1tYUNvcnJlY3RPdXRwdXQoZ2xfRnJhZ0NvbG9yLnJnYik7XG4gICAgI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsWUFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
