/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendAddPS = `
    dBlendModeFogFactor = 0.0;
    rgb *= saturate(gammaCorrectInput(max(a, 0.0)));
    if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;
`;

export { particle_blendAddPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfYmxlbmRBZGQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZV9ibGVuZEFkZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIGRCbGVuZE1vZGVGb2dGYWN0b3IgPSAwLjA7XG4gICAgcmdiICo9IHNhdHVyYXRlKGdhbW1hQ29ycmVjdElucHV0KG1heChhLCAwLjApKSk7XG4gICAgaWYgKChyZ2IuciArIHJnYi5nICsgcmdiLmIpIDwgMC4wMDAwMDEpIGRpc2NhcmQ7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0EsQ0FKQTs7OzsifQ==
