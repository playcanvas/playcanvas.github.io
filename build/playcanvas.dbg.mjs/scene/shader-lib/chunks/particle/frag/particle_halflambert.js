var particle_halflambertPS = /* glsl */`
    vec3 negNormal = normal*0.5+0.5;
    vec3 posNormal = -normal*0.5+0.5;
    negNormal *= negNormal;
    posNormal *= posNormal;
`;

export { particle_halflambertPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfaGFsZmxhbWJlcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlX2hhbGZsYW1iZXJ0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgdmVjMyBuZWdOb3JtYWwgPSBub3JtYWwqMC41KzAuNTtcbiAgICB2ZWMzIHBvc05vcm1hbCA9IC1ub3JtYWwqMC41KzAuNTtcbiAgICBuZWdOb3JtYWwgKj0gbmVnTm9ybWFsO1xuICAgIHBvc05vcm1hbCAqPSBwb3NOb3JtYWw7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDZCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
