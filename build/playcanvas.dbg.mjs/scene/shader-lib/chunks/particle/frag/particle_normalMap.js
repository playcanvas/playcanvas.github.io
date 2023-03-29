/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_normalMapPS = /* glsl */`
    vec3 normalMap = normalize(texture2D(normalMap, vec2(texCoordsAlphaLife.x, 1.0 - texCoordsAlphaLife.y)).xyz * 2.0 - 1.0);
    vec3 normal = ParticleMat * normalMap;
`;

export { particle_normalMapPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbm9ybWFsTWFwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZV9ub3JtYWxNYXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICB2ZWMzIG5vcm1hbE1hcCA9IG5vcm1hbGl6ZSh0ZXh0dXJlMkQobm9ybWFsTWFwLCB2ZWMyKHRleENvb3Jkc0FscGhhTGlmZS54LCAxLjAgLSB0ZXhDb29yZHNBbHBoYUxpZmUueSkpLnh5eiAqIDIuMCAtIDEuMCk7XG4gICAgdmVjMyBub3JtYWwgPSBQYXJ0aWNsZU1hdCAqIG5vcm1hbE1hcDtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwyQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBQUM7Ozs7In0=
