var normalXYPS = /* glsl */`
vec3 unpackNormal(vec4 nmap) {
    vec3 normal;
    normal.xy = nmap.wy * 2.0 - 1.0;
    normal.z = sqrt(1.0 - saturate(dot(normal.xy, normal.xy)));
    return normal;
}
`;

export { normalXYPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsWFkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL25vcm1hbFhZLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIHVucGFja05vcm1hbCh2ZWM0IG5tYXApIHtcbiAgICB2ZWMzIG5vcm1hbDtcbiAgICBub3JtYWwueHkgPSBubWFwLnd5ICogMi4wIC0gMS4wO1xuICAgIG5vcm1hbC56ID0gc3FydCgxLjAgLSBzYXR1cmF0ZShkb3Qobm9ybWFsLnh5LCBub3JtYWwueHkpKSk7XG4gICAgcmV0dXJuIG5vcm1hbDtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsaUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
