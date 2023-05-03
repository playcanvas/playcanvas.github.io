var bakeLmEndPS = /* glsl */`
#ifdef LIGHTMAP_RGBM
    gl_FragColor.rgb = dDiffuseLight;
    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(0.5));
    gl_FragColor.rgb /= 8.0;
    gl_FragColor.a = clamp( max( max( gl_FragColor.r, gl_FragColor.g ), max( gl_FragColor.b, 1.0 / 255.0 ) ), 0.0,1.0 );
    gl_FragColor.a = ceil(gl_FragColor.a * 255.0) / 255.0;
    gl_FragColor.rgb /= gl_FragColor.a;
#else
    gl_FragColor = vec4(dDiffuseLight, 1.0);
#endif
`;

export { bakeLmEndPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFrZUxtRW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGlnaHRtYXBwZXIvZnJhZy9iYWtlTG1FbmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBMSUdIVE1BUF9SR0JNXG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IGREaWZmdXNlTGlnaHQ7XG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IHBvdyhnbF9GcmFnQ29sb3IucmdiLCB2ZWMzKDAuNSkpO1xuICAgIGdsX0ZyYWdDb2xvci5yZ2IgLz0gOC4wO1xuICAgIGdsX0ZyYWdDb2xvci5hID0gY2xhbXAoIG1heCggbWF4KCBnbF9GcmFnQ29sb3IuciwgZ2xfRnJhZ0NvbG9yLmcgKSwgbWF4KCBnbF9GcmFnQ29sb3IuYiwgMS4wIC8gMjU1LjAgKSApLCAwLjAsMS4wICk7XG4gICAgZ2xfRnJhZ0NvbG9yLmEgPSBjZWlsKGdsX0ZyYWdDb2xvci5hICogMjU1LjApIC8gMjU1LjA7XG4gICAgZ2xfRnJhZ0NvbG9yLnJnYiAvPSBnbF9GcmFnQ29sb3IuYTtcbiNlbHNlXG4gICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChkRGlmZnVzZUxpZ2h0LCAxLjApO1xuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
