/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particleAnimFrameClampVS = /* glsl */`
    float animFrame = min(floor(texCoordsAlphaLife.w * animTexParams.y) + animTexParams.x, animTexParams.z);
`;

export { particleAnimFrameClampVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVBbmltRnJhbWVDbGFtcC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVBbmltRnJhbWVDbGFtcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIGZsb2F0IGFuaW1GcmFtZSA9IG1pbihmbG9vcih0ZXhDb29yZHNBbHBoYUxpZmUudyAqIGFuaW1UZXhQYXJhbXMueSkgKyBhbmltVGV4UGFyYW1zLngsIGFuaW1UZXhQYXJhbXMueik7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsK0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0EsQ0FBQzs7OzsifQ==
