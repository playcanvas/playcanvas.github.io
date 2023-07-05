/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var falloffInvSquaredPS = `
float getFalloffWindow(float lightRadius) {
    float sqrDist = dot(dLightDirW, dLightDirW);
    float invRadius = 1.0 / lightRadius;
    return square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );
}

float getFalloffInvSquared(float lightRadius) {
    float sqrDist = dot(dLightDirW, dLightDirW);
    float falloff = 1.0 / (sqrDist + 1.0);
    float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}
`;

export { falloffInvSquaredPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFsbG9mZkludlNxdWFyZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvZmFsbG9mZkludlNxdWFyZWQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdldEZhbGxvZmZXaW5kb3coZmxvYXQgbGlnaHRSYWRpdXMpIHtcbiAgICBmbG9hdCBzcXJEaXN0ID0gZG90KGRMaWdodERpclcsIGRMaWdodERpclcpO1xuICAgIGZsb2F0IGludlJhZGl1cyA9IDEuMCAvIGxpZ2h0UmFkaXVzO1xuICAgIHJldHVybiBzcXVhcmUoIHNhdHVyYXRlKCAxLjAgLSBzcXVhcmUoIHNxckRpc3QgKiBzcXVhcmUoaW52UmFkaXVzKSApICkgKTtcbn1cblxuZmxvYXQgZ2V0RmFsbG9mZkludlNxdWFyZWQoZmxvYXQgbGlnaHRSYWRpdXMpIHtcbiAgICBmbG9hdCBzcXJEaXN0ID0gZG90KGRMaWdodERpclcsIGRMaWdodERpclcpO1xuICAgIGZsb2F0IGZhbGxvZmYgPSAxLjAgLyAoc3FyRGlzdCArIDEuMCk7XG4gICAgZmxvYXQgaW52UmFkaXVzID0gMS4wIC8gbGlnaHRSYWRpdXM7XG5cbiAgICBmYWxsb2ZmICo9IDE2LjA7XG4gICAgZmFsbG9mZiAqPSBzcXVhcmUoIHNhdHVyYXRlKCAxLjAgLSBzcXVhcmUoIHNxckRpc3QgKiBzcXVhcmUoaW52UmFkaXVzKSApICkgKTtcblxuICAgIHJldHVybiBmYWxsb2ZmO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDBCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FqQkE7Ozs7In0=
