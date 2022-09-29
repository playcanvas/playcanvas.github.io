/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var gamma2_2PS = `
float gammaCorrectInput(float color) {
    return decodeGamma(color);
}

vec3 gammaCorrectInput(vec3 color) {
    return decodeGamma(color);
}

vec4 gammaCorrectInput(vec4 color) {
    return vec4(decodeGamma(color.xyz), color.w);
}

vec3 gammaCorrectOutput(vec3 color) {
#ifdef HDR
    return color;
#else
    return pow(color + 0.0000001, vec3(1.0 / 2.2));
#endif
}
`;

export { gamma2_2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtbWEyXzIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvZ2FtbWEyXzIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdhbW1hQ29ycmVjdElucHV0KGZsb2F0IGNvbG9yKSB7XG4gICAgcmV0dXJuIGRlY29kZUdhbW1hKGNvbG9yKTtcbn1cblxudmVjMyBnYW1tYUNvcnJlY3RJbnB1dCh2ZWMzIGNvbG9yKSB7XG4gICAgcmV0dXJuIGRlY29kZUdhbW1hKGNvbG9yKTtcbn1cblxudmVjNCBnYW1tYUNvcnJlY3RJbnB1dCh2ZWM0IGNvbG9yKSB7XG4gICAgcmV0dXJuIHZlYzQoZGVjb2RlR2FtbWEoY29sb3IueHl6KSwgY29sb3Iudyk7XG59XG5cbnZlYzMgZ2FtbWFDb3JyZWN0T3V0cHV0KHZlYzMgY29sb3IpIHtcbiNpZmRlZiBIRFJcbiAgICByZXR1cm4gY29sb3I7XG4jZWxzZVxuICAgIHJldHVybiBwb3coY29sb3IgKyAwLjAwMDAwMDEsIHZlYzMoMS4wIC8gMi4yKSk7XG4jZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxpQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBcEJBOzs7OyJ9
