/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleInputFloatPS = `
void readInput(float uv) {
    vec4 tex = texture2D(particleTexIN, vec2(uv, 0.25));
    vec4 tex2 = texture2D(particleTexIN, vec2(uv, 0.75));

    inPos = tex.xyz;
    inVel = tex2.xyz;
    inAngle = (tex.w < 0.0? -tex.w : tex.w) - 1000.0;
    inShow = tex.w >= 0.0;
    inLife = tex2.w;
}
`;

export { particleInputFloatPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVJbnB1dEZsb2F0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVJbnB1dEZsb2F0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIHJlYWRJbnB1dChmbG9hdCB1dikge1xuICAgIHZlYzQgdGV4ID0gdGV4dHVyZTJEKHBhcnRpY2xlVGV4SU4sIHZlYzIodXYsIDAuMjUpKTtcbiAgICB2ZWM0IHRleDIgPSB0ZXh0dXJlMkQocGFydGljbGVUZXhJTiwgdmVjMih1diwgMC43NSkpO1xuXG4gICAgaW5Qb3MgPSB0ZXgueHl6O1xuICAgIGluVmVsID0gdGV4Mi54eXo7XG4gICAgaW5BbmdsZSA9ICh0ZXgudyA8IDAuMD8gLXRleC53IDogdGV4LncpIC0gMTAwMC4wO1xuICAgIGluU2hvdyA9IHRleC53ID49IDAuMDtcbiAgICBpbkxpZmUgPSB0ZXgyLnc7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMkJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVhBOzs7OyJ9
