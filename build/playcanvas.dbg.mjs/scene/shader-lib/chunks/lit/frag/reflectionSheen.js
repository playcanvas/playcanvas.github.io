var reflectionSheenPS = /* glsl */`

void addReflectionSheen(vec3 worldNormal, vec3 viewDir, float gloss) {
    float NoV = dot(worldNormal, viewDir);
    float alphaG = gloss * gloss;

    // Avoid using a LUT and approximate the values analytically
    float a = gloss < 0.25 ? -339.2 * alphaG + 161.4 * gloss - 25.9 : -8.48 * alphaG + 14.3 * gloss - 9.95;
    float b = gloss < 0.25 ? 44.0 * alphaG - 23.7 * gloss + 3.26 : 1.97 * alphaG - 3.27 * gloss + 0.72;
    float DG = exp( a * NoV + b ) + ( gloss < 0.25 ? 0.0 : 0.1 * ( gloss - 0.25 ) );
    sReflection += calcReflection(worldNormal, 0.0) * saturate(DG);
}
`;

export { reflectionSheenPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNoZWVuLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbGVjdGlvblNoZWVuLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5cbnZvaWQgYWRkUmVmbGVjdGlvblNoZWVuKHZlYzMgd29ybGROb3JtYWwsIHZlYzMgdmlld0RpciwgZmxvYXQgZ2xvc3MpIHtcbiAgICBmbG9hdCBOb1YgPSBkb3Qod29ybGROb3JtYWwsIHZpZXdEaXIpO1xuICAgIGZsb2F0IGFscGhhRyA9IGdsb3NzICogZ2xvc3M7XG5cbiAgICAvLyBBdm9pZCB1c2luZyBhIExVVCBhbmQgYXBwcm94aW1hdGUgdGhlIHZhbHVlcyBhbmFseXRpY2FsbHlcbiAgICBmbG9hdCBhID0gZ2xvc3MgPCAwLjI1ID8gLTMzOS4yICogYWxwaGFHICsgMTYxLjQgKiBnbG9zcyAtIDI1LjkgOiAtOC40OCAqIGFscGhhRyArIDE0LjMgKiBnbG9zcyAtIDkuOTU7XG4gICAgZmxvYXQgYiA9IGdsb3NzIDwgMC4yNSA/IDQ0LjAgKiBhbHBoYUcgLSAyMy43ICogZ2xvc3MgKyAzLjI2IDogMS45NyAqIGFscGhhRyAtIDMuMjcgKiBnbG9zcyArIDAuNzI7XG4gICAgZmxvYXQgREcgPSBleHAoIGEgKiBOb1YgKyBiICkgKyAoIGdsb3NzIDwgMC4yNSA/IDAuMCA6IDAuMSAqICggZ2xvc3MgLSAwLjI1ICkgKTtcbiAgICBzUmVmbGVjdGlvbiArPSBjYWxjUmVmbGVjdGlvbih3b3JsZE5vcm1hbCwgMC4wKSAqIHNhdHVyYXRlKERHKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsd0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
