var tonemappingHejlPS = /* glsl */`
uniform float exposure;

vec3 toneMap(vec3 color) {
    color *= exposure;
    const float  A = 0.22, B = 0.3, C = .1, D = 0.2, E = .01, F = 0.3;
    const float Scl = 1.25;

    vec3 h = max( vec3(0.0), color - vec3(0.004) );
    return (h*((Scl*A)*h+Scl*vec3(C*B,C*B,C*B))+Scl*vec3(D*E,D*E,D*E)) / (h*(A*h+vec3(B,B,B))+vec3(D*F,D*F,D*F)) - Scl*vec3(E/F,E/F,E/F);
}
`;

export { tonemappingHejlPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdIZWpsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvdG9uZW1hcHBpbmdIZWpsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IGV4cG9zdXJlO1xuXG52ZWMzIHRvbmVNYXAodmVjMyBjb2xvcikge1xuICAgIGNvbG9yICo9IGV4cG9zdXJlO1xuICAgIGNvbnN0IGZsb2F0ICBBID0gMC4yMiwgQiA9IDAuMywgQyA9IC4xLCBEID0gMC4yLCBFID0gLjAxLCBGID0gMC4zO1xuICAgIGNvbnN0IGZsb2F0IFNjbCA9IDEuMjU7XG5cbiAgICB2ZWMzIGggPSBtYXgoIHZlYzMoMC4wKSwgY29sb3IgLSB2ZWMzKDAuMDA0KSApO1xuICAgIHJldHVybiAoaCooKFNjbCpBKSpoK1NjbCp2ZWMzKEMqQixDKkIsQypCKSkrU2NsKnZlYzMoRCpFLEQqRSxEKkUpKSAvIChoKihBKmgrdmVjMyhCLEIsQikpK3ZlYzMoRCpGLEQqRixEKkYpKSAtIFNjbCp2ZWMzKEUvRixFL0YsRS9GKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsd0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
