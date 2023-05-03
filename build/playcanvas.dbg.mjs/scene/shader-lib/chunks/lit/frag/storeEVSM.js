var storeEVSMPS = /* glsl */`
float exponent = VSM_EXPONENT;

depth = 2.0 * depth - 1.0;
depth =  exp(exponent * depth);
gl_FragColor = vec4(depth, depth*depth, 1.0, 1.0);
`;

export { storeEVSMPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmVFVlNNLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvc3RvcmVFVlNNLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBleHBvbmVudCA9IFZTTV9FWFBPTkVOVDtcblxuZGVwdGggPSAyLjAgKiBkZXB0aCAtIDEuMDtcbmRlcHRoID0gIGV4cChleHBvbmVudCAqIGRlcHRoKTtcbmdsX0ZyYWdDb2xvciA9IHZlYzQoZGVwdGgsIGRlcHRoKmRlcHRoLCAxLjAsIDEuMCk7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
