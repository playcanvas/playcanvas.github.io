/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFsbG9mZkludlNxdWFyZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9mYWxsb2ZmSW52U3F1YXJlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgZ2V0RmFsbG9mZldpbmRvdyhmbG9hdCBsaWdodFJhZGl1cykge1xuICAgIGZsb2F0IHNxckRpc3QgPSBkb3QoZExpZ2h0RGlyVywgZExpZ2h0RGlyVyk7XG4gICAgZmxvYXQgaW52UmFkaXVzID0gMS4wIC8gbGlnaHRSYWRpdXM7XG4gICAgcmV0dXJuIHNxdWFyZSggc2F0dXJhdGUoIDEuMCAtIHNxdWFyZSggc3FyRGlzdCAqIHNxdWFyZShpbnZSYWRpdXMpICkgKSApO1xufVxuXG5mbG9hdCBnZXRGYWxsb2ZmSW52U3F1YXJlZChmbG9hdCBsaWdodFJhZGl1cykge1xuICAgIGZsb2F0IHNxckRpc3QgPSBkb3QoZExpZ2h0RGlyVywgZExpZ2h0RGlyVyk7XG4gICAgZmxvYXQgZmFsbG9mZiA9IDEuMCAvIChzcXJEaXN0ICsgMS4wKTtcbiAgICBmbG9hdCBpbnZSYWRpdXMgPSAxLjAgLyBsaWdodFJhZGl1cztcblxuICAgIGZhbGxvZmYgKj0gMTYuMDtcbiAgICBmYWxsb2ZmICo9IHNxdWFyZSggc2F0dXJhdGUoIDEuMCAtIHNxdWFyZSggc3FyRGlzdCAqIHNxdWFyZShpbnZSYWRpdXMpICkgKSApO1xuXG4gICAgcmV0dXJuIGZhbGxvZmY7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
