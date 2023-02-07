/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var ambientEnvPS = /* glsl */`
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif

void addAmbient() {
    vec3 dir = normalize(cubeMapRotate(dNormalW) * vec3(-1.0, 1.0, 1.0));
    vec2 uv = mapUv(toSphericalUv(dir), vec4(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize);

    vec4 raw = texture2D(texture_envAtlas, uv);
    vec3 linear = $DECODE(raw);
    dDiffuseLight += processEnvironment(linear);
}
`;

export { ambientEnvPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1iaWVudEVudi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2FtYmllbnRFbnYuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZm5kZWYgRU5WX0FUTEFTXG4jZGVmaW5lIEVOVl9BVExBU1xudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9lbnZBdGxhcztcbiNlbmRpZlxuXG52b2lkIGFkZEFtYmllbnQoKSB7XG4gICAgdmVjMyBkaXIgPSBub3JtYWxpemUoY3ViZU1hcFJvdGF0ZShkTm9ybWFsVykgKiB2ZWMzKC0xLjAsIDEuMCwgMS4wKSk7XG4gICAgdmVjMiB1diA9IG1hcFV2KHRvU3BoZXJpY2FsVXYoZGlyKSwgdmVjNCgxMjguMCwgMjU2LjAgKyAxMjguMCwgNjQuMCwgMzIuMCkgLyBhdGxhc1NpemUpO1xuXG4gICAgdmVjNCByYXcgPSB0ZXh0dXJlMkQodGV4dHVyZV9lbnZBdGxhcywgdXYpO1xuICAgIHZlYzMgbGluZWFyID0gJERFQ09ERShyYXcpO1xuICAgIGREaWZmdXNlTGlnaHQgKz0gcHJvY2Vzc0Vudmlyb25tZW50KGxpbmVhcik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
