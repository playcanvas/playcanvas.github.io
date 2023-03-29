/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fixCubemapSeamsStretchPS = `
vec3 fixSeams(vec3 vec, float mipmapIndex) {
    vec3 avec = abs(vec);
    float scale = 1.0 - exp2(mipmapIndex) / 128.0;
    float M = max(max(avec.x, avec.y), avec.z);
    if (avec.x != M) vec.x *= scale;
    if (avec.y != M) vec.y *= scale;
    if (avec.z != M) vec.z *= scale;
    return vec;
}

vec3 fixSeams(vec3 vec) {
    vec3 avec = abs(vec);
    float scale = 1.0 - 1.0 / 128.0;
    float M = max(max(avec.x, avec.y), avec.z);
    if (avec.x != M) vec.x *= scale;
    if (avec.y != M) vec.y *= scale;
    if (avec.z != M) vec.z *= scale;
    return vec;
}

vec3 fixSeamsStatic(vec3 vec, float invRecMipSize) {
    vec3 avec = abs(vec);
    float scale = invRecMipSize;
    float M = max(max(avec.x, avec.y), avec.z);
    if (avec.x != M) vec.x *= scale;
    if (avec.y != M) vec.y *= scale;
    if (avec.z != M) vec.z *= scale;
    return vec;
}

vec3 calcSeam(vec3 vec) {
    vec3 avec = abs(vec);
    float M = max(avec.x, max(avec.y, avec.z));
    return vec3(avec.x != M ? 1.0 : 0.0,
                avec.y != M ? 1.0 : 0.0,
                avec.z != M ? 1.0 : 0.0);
}

vec3 applySeam(vec3 vec, vec3 seam, float scale) {
    return vec * (seam * -scale + vec3(1.0));
}
`;

export { fixCubemapSeamsStretchPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4Q3ViZW1hcFNlYW1zU3RyZXRjaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jb21tb24vZnJhZy9maXhDdWJlbWFwU2VhbXNTdHJldGNoLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGZpeFNlYW1zKHZlYzMgdmVjLCBmbG9hdCBtaXBtYXBJbmRleCkge1xuICAgIHZlYzMgYXZlYyA9IGFicyh2ZWMpO1xuICAgIGZsb2F0IHNjYWxlID0gMS4wIC0gZXhwMihtaXBtYXBJbmRleCkgLyAxMjguMDtcbiAgICBmbG9hdCBNID0gbWF4KG1heChhdmVjLngsIGF2ZWMueSksIGF2ZWMueik7XG4gICAgaWYgKGF2ZWMueCAhPSBNKSB2ZWMueCAqPSBzY2FsZTtcbiAgICBpZiAoYXZlYy55ICE9IE0pIHZlYy55ICo9IHNjYWxlO1xuICAgIGlmIChhdmVjLnogIT0gTSkgdmVjLnogKj0gc2NhbGU7XG4gICAgcmV0dXJuIHZlYztcbn1cblxudmVjMyBmaXhTZWFtcyh2ZWMzIHZlYykge1xuICAgIHZlYzMgYXZlYyA9IGFicyh2ZWMpO1xuICAgIGZsb2F0IHNjYWxlID0gMS4wIC0gMS4wIC8gMTI4LjA7XG4gICAgZmxvYXQgTSA9IG1heChtYXgoYXZlYy54LCBhdmVjLnkpLCBhdmVjLnopO1xuICAgIGlmIChhdmVjLnggIT0gTSkgdmVjLnggKj0gc2NhbGU7XG4gICAgaWYgKGF2ZWMueSAhPSBNKSB2ZWMueSAqPSBzY2FsZTtcbiAgICBpZiAoYXZlYy56ICE9IE0pIHZlYy56ICo9IHNjYWxlO1xuICAgIHJldHVybiB2ZWM7XG59XG5cbnZlYzMgZml4U2VhbXNTdGF0aWModmVjMyB2ZWMsIGZsb2F0IGludlJlY01pcFNpemUpIHtcbiAgICB2ZWMzIGF2ZWMgPSBhYnModmVjKTtcbiAgICBmbG9hdCBzY2FsZSA9IGludlJlY01pcFNpemU7XG4gICAgZmxvYXQgTSA9IG1heChtYXgoYXZlYy54LCBhdmVjLnkpLCBhdmVjLnopO1xuICAgIGlmIChhdmVjLnggIT0gTSkgdmVjLnggKj0gc2NhbGU7XG4gICAgaWYgKGF2ZWMueSAhPSBNKSB2ZWMueSAqPSBzY2FsZTtcbiAgICBpZiAoYXZlYy56ICE9IE0pIHZlYy56ICo9IHNjYWxlO1xuICAgIHJldHVybiB2ZWM7XG59XG5cbnZlYzMgY2FsY1NlYW0odmVjMyB2ZWMpIHtcbiAgICB2ZWMzIGF2ZWMgPSBhYnModmVjKTtcbiAgICBmbG9hdCBNID0gbWF4KGF2ZWMueCwgbWF4KGF2ZWMueSwgYXZlYy56KSk7XG4gICAgcmV0dXJuIHZlYzMoYXZlYy54ICE9IE0gPyAxLjAgOiAwLjAsXG4gICAgICAgICAgICAgICAgYXZlYy55ICE9IE0gPyAxLjAgOiAwLjAsXG4gICAgICAgICAgICAgICAgYXZlYy56ICE9IE0gPyAxLjAgOiAwLjApO1xufVxuXG52ZWMzIGFwcGx5U2VhbSh2ZWMzIHZlYywgdmVjMyBzZWFtLCBmbG9hdCBzY2FsZSkge1xuICAgIHJldHVybiB2ZWMgKiAoc2VhbSAqIC1zY2FsZSArIHZlYzMoMS4wKSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsK0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBMUNBOzs7OyJ9
