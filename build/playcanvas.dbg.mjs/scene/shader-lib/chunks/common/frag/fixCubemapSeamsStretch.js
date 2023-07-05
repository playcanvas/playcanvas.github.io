var fixCubemapSeamsStretchPS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4Q3ViZW1hcFNlYW1zU3RyZXRjaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL2ZpeEN1YmVtYXBTZWFtc1N0cmV0Y2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzMgZml4U2VhbXModmVjMyB2ZWMsIGZsb2F0IG1pcG1hcEluZGV4KSB7XG4gICAgdmVjMyBhdmVjID0gYWJzKHZlYyk7XG4gICAgZmxvYXQgc2NhbGUgPSAxLjAgLSBleHAyKG1pcG1hcEluZGV4KSAvIDEyOC4wO1xuICAgIGZsb2F0IE0gPSBtYXgobWF4KGF2ZWMueCwgYXZlYy55KSwgYXZlYy56KTtcbiAgICBpZiAoYXZlYy54ICE9IE0pIHZlYy54ICo9IHNjYWxlO1xuICAgIGlmIChhdmVjLnkgIT0gTSkgdmVjLnkgKj0gc2NhbGU7XG4gICAgaWYgKGF2ZWMueiAhPSBNKSB2ZWMueiAqPSBzY2FsZTtcbiAgICByZXR1cm4gdmVjO1xufVxuXG52ZWMzIGZpeFNlYW1zKHZlYzMgdmVjKSB7XG4gICAgdmVjMyBhdmVjID0gYWJzKHZlYyk7XG4gICAgZmxvYXQgc2NhbGUgPSAxLjAgLSAxLjAgLyAxMjguMDtcbiAgICBmbG9hdCBNID0gbWF4KG1heChhdmVjLngsIGF2ZWMueSksIGF2ZWMueik7XG4gICAgaWYgKGF2ZWMueCAhPSBNKSB2ZWMueCAqPSBzY2FsZTtcbiAgICBpZiAoYXZlYy55ICE9IE0pIHZlYy55ICo9IHNjYWxlO1xuICAgIGlmIChhdmVjLnogIT0gTSkgdmVjLnogKj0gc2NhbGU7XG4gICAgcmV0dXJuIHZlYztcbn1cblxudmVjMyBmaXhTZWFtc1N0YXRpYyh2ZWMzIHZlYywgZmxvYXQgaW52UmVjTWlwU2l6ZSkge1xuICAgIHZlYzMgYXZlYyA9IGFicyh2ZWMpO1xuICAgIGZsb2F0IHNjYWxlID0gaW52UmVjTWlwU2l6ZTtcbiAgICBmbG9hdCBNID0gbWF4KG1heChhdmVjLngsIGF2ZWMueSksIGF2ZWMueik7XG4gICAgaWYgKGF2ZWMueCAhPSBNKSB2ZWMueCAqPSBzY2FsZTtcbiAgICBpZiAoYXZlYy55ICE9IE0pIHZlYy55ICo9IHNjYWxlO1xuICAgIGlmIChhdmVjLnogIT0gTSkgdmVjLnogKj0gc2NhbGU7XG4gICAgcmV0dXJuIHZlYztcbn1cblxudmVjMyBjYWxjU2VhbSh2ZWMzIHZlYykge1xuICAgIHZlYzMgYXZlYyA9IGFicyh2ZWMpO1xuICAgIGZsb2F0IE0gPSBtYXgoYXZlYy54LCBtYXgoYXZlYy55LCBhdmVjLnopKTtcbiAgICByZXR1cm4gdmVjMyhhdmVjLnggIT0gTSA/IDEuMCA6IDAuMCxcbiAgICAgICAgICAgICAgICBhdmVjLnkgIT0gTSA/IDEuMCA6IDAuMCxcbiAgICAgICAgICAgICAgICBhdmVjLnogIT0gTSA/IDEuMCA6IDAuMCk7XG59XG5cbnZlYzMgYXBwbHlTZWFtKHZlYzMgdmVjLCB2ZWMzIHNlYW0sIGZsb2F0IHNjYWxlKSB7XG4gICAgcmV0dXJuIHZlYyAqIChzZWFtICogLXNjYWxlICsgdmVjMygxLjApKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsK0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
