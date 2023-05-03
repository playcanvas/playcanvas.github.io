var tonemappingFilmicPS = /* glsl */`
const float A =  0.15;
const float B =  0.50;
const float C =  0.10;
const float D =  0.20;
const float E =  0.02;
const float F =  0.30;
const float W =  11.2;

uniform float exposure;

vec3 uncharted2Tonemap(vec3 x) {
   return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 toneMap(vec3 color) {
    color = uncharted2Tonemap(color * exposure);
    vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W,W,W));
    color = color * whiteScale;

    return color;
}
`;

export { tonemappingFilmicPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdGaWxtaWMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy90b25lbWFwcGluZ0ZpbG1pYy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuY29uc3QgZmxvYXQgQSA9ICAwLjE1O1xuY29uc3QgZmxvYXQgQiA9ICAwLjUwO1xuY29uc3QgZmxvYXQgQyA9ICAwLjEwO1xuY29uc3QgZmxvYXQgRCA9ICAwLjIwO1xuY29uc3QgZmxvYXQgRSA9ICAwLjAyO1xuY29uc3QgZmxvYXQgRiA9ICAwLjMwO1xuY29uc3QgZmxvYXQgVyA9ICAxMS4yO1xuXG51bmlmb3JtIGZsb2F0IGV4cG9zdXJlO1xuXG52ZWMzIHVuY2hhcnRlZDJUb25lbWFwKHZlYzMgeCkge1xuICAgcmV0dXJuICgoeCooQSp4K0MqQikrRCpFKS8oeCooQSp4K0IpK0QqRikpLUUvRjtcbn1cblxudmVjMyB0b25lTWFwKHZlYzMgY29sb3IpIHtcbiAgICBjb2xvciA9IHVuY2hhcnRlZDJUb25lbWFwKGNvbG9yICogZXhwb3N1cmUpO1xuICAgIHZlYzMgd2hpdGVTY2FsZSA9IDEuMCAvIHVuY2hhcnRlZDJUb25lbWFwKHZlYzMoVyxXLFcpKTtcbiAgICBjb2xvciA9IGNvbG9yICogd2hpdGVTY2FsZTtcblxuICAgIHJldHVybiBjb2xvcjtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
