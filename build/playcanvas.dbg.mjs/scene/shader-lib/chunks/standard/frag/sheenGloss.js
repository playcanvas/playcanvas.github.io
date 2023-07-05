var sheenGlossPS = /* glsl */`
#ifdef MAPFLOAT
uniform float material_sheenGloss;
#endif

void getSheenGlossiness() {
    float sheenGlossiness = 1.0;

    #ifdef MAPFLOAT
    sheenGlossiness *= material_sheenGloss;
    #endif

    #ifdef MAPTEXTURE
    sheenGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenGlossiness *= saturate(vVertexColor.$VC);
    #endif

    #ifdef MAPINVERT
    sheenGlossiness = 1.0 - sheenGlossiness;
    #endif

    sheenGlossiness += 0.0000001;
    sGlossiness = sheenGlossiness;
}
`;

export { sheenGlossPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hlZW5HbG9zcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvc2hlZW5HbG9zcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE1BUEZMT0FUXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX3NoZWVuR2xvc3M7XG4jZW5kaWZcblxudm9pZCBnZXRTaGVlbkdsb3NzaW5lc3MoKSB7XG4gICAgZmxvYXQgc2hlZW5HbG9zc2luZXNzID0gMS4wO1xuXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgc2hlZW5HbG9zc2luZXNzICo9IG1hdGVyaWFsX3NoZWVuR2xvc3M7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgIHNoZWVuR2xvc3NpbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgc2hlZW5HbG9zc2luZXNzICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUElOVkVSVFxuICAgIHNoZWVuR2xvc3NpbmVzcyA9IDEuMCAtIHNoZWVuR2xvc3NpbmVzcztcbiAgICAjZW5kaWZcblxuICAgIHNoZWVuR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgc0dsb3NzaW5lc3MgPSBzaGVlbkdsb3NzaW5lc3M7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLG1CQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
