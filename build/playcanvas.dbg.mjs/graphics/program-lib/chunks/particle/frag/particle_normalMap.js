/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_normalMapPS = `
    vec3 normalMap = normalize(texture2D(normalMap, vec2(texCoordsAlphaLife.x, 1.0 - texCoordsAlphaLife.y)).xyz * 2.0 - 1.0);
    vec3 normal = ParticleMat * normalMap;
`;

export { particle_normalMapPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbm9ybWFsTWFwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVfbm9ybWFsTWFwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgdmVjMyBub3JtYWxNYXAgPSBub3JtYWxpemUodGV4dHVyZTJEKG5vcm1hbE1hcCwgdmVjMih0ZXhDb29yZHNBbHBoYUxpZmUueCwgMS4wIC0gdGV4Q29vcmRzQWxwaGFMaWZlLnkpKS54eXogKiAyLjAgLSAxLjApO1xuICAgIHZlYzMgbm9ybWFsID0gUGFydGljbGVNYXQgKiBub3JtYWxNYXA7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMkJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBSEE7Ozs7In0=
