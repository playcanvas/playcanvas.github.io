var falloffInvSquaredPS = /* glsl */`
float getFalloffWindow(float lightRadius, vec3 lightDir) {
    float sqrDist = dot(lightDir, lightDir);
    float invRadius = 1.0 / lightRadius;
    return square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );
}

float getFalloffInvSquared(float lightRadius, vec3 lightDir) {
    float sqrDist = dot(lightDir, lightDir);
    float falloff = 1.0 / (sqrDist + 1.0);
    float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}
`;

export { falloffInvSquaredPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFsbG9mZkludlNxdWFyZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9mYWxsb2ZmSW52U3F1YXJlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgZ2V0RmFsbG9mZldpbmRvdyhmbG9hdCBsaWdodFJhZGl1cywgdmVjMyBsaWdodERpcikge1xuICAgIGZsb2F0IHNxckRpc3QgPSBkb3QobGlnaHREaXIsIGxpZ2h0RGlyKTtcbiAgICBmbG9hdCBpbnZSYWRpdXMgPSAxLjAgLyBsaWdodFJhZGl1cztcbiAgICByZXR1cm4gc3F1YXJlKCBzYXR1cmF0ZSggMS4wIC0gc3F1YXJlKCBzcXJEaXN0ICogc3F1YXJlKGludlJhZGl1cykgKSApICk7XG59XG5cbmZsb2F0IGdldEZhbGxvZmZJbnZTcXVhcmVkKGZsb2F0IGxpZ2h0UmFkaXVzLCB2ZWMzIGxpZ2h0RGlyKSB7XG4gICAgZmxvYXQgc3FyRGlzdCA9IGRvdChsaWdodERpciwgbGlnaHREaXIpO1xuICAgIGZsb2F0IGZhbGxvZmYgPSAxLjAgLyAoc3FyRGlzdCArIDEuMCk7XG4gICAgZmxvYXQgaW52UmFkaXVzID0gMS4wIC8gbGlnaHRSYWRpdXM7XG5cbiAgICBmYWxsb2ZmICo9IDE2LjA7XG4gICAgZmFsbG9mZiAqPSBzcXVhcmUoIHNhdHVyYXRlKCAxLjAgLSBzcXVhcmUoIHNxckRpc3QgKiBzcXVhcmUoaW52UmFkaXVzKSApICkgKTtcblxuICAgIHJldHVybiBmYWxsb2ZmO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
