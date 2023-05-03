var debugOutputPS = /* glsl */`
#ifdef DEBUG_ALBEDO_PASS
gl_FragColor = vec4(litShaderArgs.albedo , 1.0);
#endif

#ifdef DEBUG_UV0_PASS
gl_FragColor = vec4(litShaderArgs.albedo , 1.0);
#endif

#ifdef DEBUG_WORLD_NORMAL_PASS
gl_FragColor = vec4(litShaderArgs.worldNormal * 0.5 + 0.5, 1.0);
#endif

#ifdef DEBUG_OPACITY_PASS
gl_FragColor = vec4(vec3(litShaderArgs.opacity) , 1.0);
#endif

#ifdef DEBUG_SPECULARITY_PASS
gl_FragColor = vec4(litShaderArgs.specularity, 1.0);
#endif

#ifdef DEBUG_GLOSS_PASS
gl_FragColor = vec4(vec3(litShaderArgs.gloss) , 1.0);
#endif

#ifdef DEBUG_METALNESS_PASS
gl_FragColor = vec4(vec3(litShaderArgs.metalness) , 1.0);
#endif

#ifdef DEBUG_AO_PASS
gl_FragColor = vec4(vec3(litShaderArgs.ao) , 1.0);
#endif

#ifdef DEBUG_EMISSION_PASS
gl_FragColor = vec4(litShaderArgs.emission, 1.0);
#endif
`;

export { debugOutputPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWctb3V0cHV0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvZGVidWctb3V0cHV0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgREVCVUdfQUxCRURPX1BBU1NcbmdsX0ZyYWdDb2xvciA9IHZlYzQobGl0U2hhZGVyQXJncy5hbGJlZG8gLCAxLjApO1xuI2VuZGlmXG5cbiNpZmRlZiBERUJVR19VVjBfUEFTU1xuZ2xfRnJhZ0NvbG9yID0gdmVjNChsaXRTaGFkZXJBcmdzLmFsYmVkbyAsIDEuMCk7XG4jZW5kaWZcblxuI2lmZGVmIERFQlVHX1dPUkxEX05PUk1BTF9QQVNTXG5nbF9GcmFnQ29sb3IgPSB2ZWM0KGxpdFNoYWRlckFyZ3Mud29ybGROb3JtYWwgKiAwLjUgKyAwLjUsIDEuMCk7XG4jZW5kaWZcblxuI2lmZGVmIERFQlVHX09QQUNJVFlfUEFTU1xuZ2xfRnJhZ0NvbG9yID0gdmVjNCh2ZWMzKGxpdFNoYWRlckFyZ3Mub3BhY2l0eSkgLCAxLjApO1xuI2VuZGlmXG5cbiNpZmRlZiBERUJVR19TUEVDVUxBUklUWV9QQVNTXG5nbF9GcmFnQ29sb3IgPSB2ZWM0KGxpdFNoYWRlckFyZ3Muc3BlY3VsYXJpdHksIDEuMCk7XG4jZW5kaWZcblxuI2lmZGVmIERFQlVHX0dMT1NTX1BBU1NcbmdsX0ZyYWdDb2xvciA9IHZlYzQodmVjMyhsaXRTaGFkZXJBcmdzLmdsb3NzKSAsIDEuMCk7XG4jZW5kaWZcblxuI2lmZGVmIERFQlVHX01FVEFMTkVTU19QQVNTXG5nbF9GcmFnQ29sb3IgPSB2ZWM0KHZlYzMobGl0U2hhZGVyQXJncy5tZXRhbG5lc3MpICwgMS4wKTtcbiNlbmRpZlxuXG4jaWZkZWYgREVCVUdfQU9fUEFTU1xuZ2xfRnJhZ0NvbG9yID0gdmVjNCh2ZWMzKGxpdFNoYWRlckFyZ3MuYW8pICwgMS4wKTtcbiNlbmRpZlxuXG4jaWZkZWYgREVCVUdfRU1JU1NJT05fUEFTU1xuZ2xfRnJhZ0NvbG9yID0gdmVjNChsaXRTaGFkZXJBcmdzLmVtaXNzaW9uLCAxLjApO1xuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLG9CQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
