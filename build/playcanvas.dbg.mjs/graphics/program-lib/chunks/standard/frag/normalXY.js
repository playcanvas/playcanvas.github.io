/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalXYPS = `
vec3 unpackNormal(vec4 nmap) {
    vec3 normal;
    normal.xy = nmap.wy * 2.0 - 1.0;
    normal.z = sqrt(1.0 - saturate(dot(normal.xy, normal.xy)));
    return normal;
}
`;

export { normalXYPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsWFkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9ub3JtYWxYWS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyB1bnBhY2tOb3JtYWwodmVjNCBubWFwKSB7XG4gICAgdmVjMyBub3JtYWw7XG4gICAgbm9ybWFsLnh5ID0gbm1hcC53eSAqIDIuMCAtIDEuMDtcbiAgICBub3JtYWwueiA9IHNxcnQoMS4wIC0gc2F0dXJhdGUoZG90KG5vcm1hbC54eSwgbm9ybWFsLnh5KSkpO1xuICAgIHJldHVybiBub3JtYWw7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsaUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FQQTs7OzsifQ==
