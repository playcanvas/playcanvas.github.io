var tonemappingAcesPS = /* glsl */`
uniform float exposure;

vec3 toneMap(vec3 color) {
    float tA = 2.51;
    float tB = 0.03;
    float tC = 2.43;
    float tD = 0.59;
    float tE = 0.14;
    vec3 x = color * exposure;
    return (x*(tA*x+tB))/(x*(tC*x+tD)+tE);
}
`;

export { tonemappingAcesPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdBY2VzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvdG9uZW1hcHBpbmdBY2VzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IGV4cG9zdXJlO1xuXG52ZWMzIHRvbmVNYXAodmVjMyBjb2xvcikge1xuICAgIGZsb2F0IHRBID0gMi41MTtcbiAgICBmbG9hdCB0QiA9IDAuMDM7XG4gICAgZmxvYXQgdEMgPSAyLjQzO1xuICAgIGZsb2F0IHREID0gMC41OTtcbiAgICBmbG9hdCB0RSA9IDAuMTQ7XG4gICAgdmVjMyB4ID0gY29sb3IgKiBleHBvc3VyZTtcbiAgICByZXR1cm4gKHgqKHRBKngrdEIpKS8oeCoodEMqeCt0RCkrdEUpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx3QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
