var particlePS = /* glsl */`
varying vec4 texCoordsAlphaLife;

uniform sampler2D colorMap;
uniform sampler2D colorParam;
uniform float graphSampleSize;
uniform float graphNumSamples;

#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params;
#endif

uniform float softening;
uniform float colorMult;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    float depth = dot(rgbaDepth, bitShift);
    return depth;
}
#endif

void main(void) {
    vec4 tex  = gammaCorrectInput(texture2D(colorMap, vec2(texCoordsAlphaLife.x, 1.0 - texCoordsAlphaLife.y)));
    vec4 ramp = gammaCorrectInput(texture2D(colorParam, vec2(texCoordsAlphaLife.w, 0.0)));
    ramp.rgb *= colorMult;

    ramp.a += texCoordsAlphaLife.z;

    vec3 rgb = tex.rgb * ramp.rgb;
    float a  = tex.a * ramp.a;
`;

export { particlePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52YXJ5aW5nIHZlYzQgdGV4Q29vcmRzQWxwaGFMaWZlO1xuXG51bmlmb3JtIHNhbXBsZXIyRCBjb2xvck1hcDtcbnVuaWZvcm0gc2FtcGxlcjJEIGNvbG9yUGFyYW07XG51bmlmb3JtIGZsb2F0IGdyYXBoU2FtcGxlU2l6ZTtcbnVuaWZvcm0gZmxvYXQgZ3JhcGhOdW1TYW1wbGVzO1xuXG4jaWZuZGVmIENBTUVSQVBMQU5FU1xuI2RlZmluZSBDQU1FUkFQTEFORVNcbnVuaWZvcm0gdmVjNCBjYW1lcmFfcGFyYW1zO1xuI2VuZGlmXG5cbnVuaWZvcm0gZmxvYXQgc29mdGVuaW5nO1xudW5pZm9ybSBmbG9hdCBjb2xvck11bHQ7XG5cbmZsb2F0IHNhdHVyYXRlKGZsb2F0IHgpIHtcbiAgICByZXR1cm4gY2xhbXAoeCwgMC4wLCAxLjApO1xufVxuXG4jaWZuZGVmIFVOUEFDS0ZMT0FUXG4jZGVmaW5lIFVOUEFDS0ZMT0FUXG5mbG9hdCB1bnBhY2tGbG9hdCh2ZWM0IHJnYmFEZXB0aCkge1xuICAgIGNvbnN0IHZlYzQgYml0U2hpZnQgPSB2ZWM0KDEuMCAvICgyNTYuMCAqIDI1Ni4wICogMjU2LjApLCAxLjAgLyAoMjU2LjAgKiAyNTYuMCksIDEuMCAvIDI1Ni4wLCAxLjApO1xuICAgIGZsb2F0IGRlcHRoID0gZG90KHJnYmFEZXB0aCwgYml0U2hpZnQpO1xuICAgIHJldHVybiBkZXB0aDtcbn1cbiNlbmRpZlxuXG52b2lkIG1haW4odm9pZCkge1xuICAgIHZlYzQgdGV4ICA9IGdhbW1hQ29ycmVjdElucHV0KHRleHR1cmUyRChjb2xvck1hcCwgdmVjMih0ZXhDb29yZHNBbHBoYUxpZmUueCwgMS4wIC0gdGV4Q29vcmRzQWxwaGFMaWZlLnkpKSk7XG4gICAgdmVjNCByYW1wID0gZ2FtbWFDb3JyZWN0SW5wdXQodGV4dHVyZTJEKGNvbG9yUGFyYW0sIHZlYzIodGV4Q29vcmRzQWxwaGFMaWZlLncsIDAuMCkpKTtcbiAgICByYW1wLnJnYiAqPSBjb2xvck11bHQ7XG5cbiAgICByYW1wLmEgKz0gdGV4Q29vcmRzQWxwaGFMaWZlLno7XG5cbiAgICB2ZWMzIHJnYiA9IHRleC5yZ2IgKiByYW1wLnJnYjtcbiAgICBmbG9hdCBhICA9IHRleC5hICogcmFtcC5hO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxpQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
