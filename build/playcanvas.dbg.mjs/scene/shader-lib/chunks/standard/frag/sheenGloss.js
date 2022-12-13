/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var sheenGlossPS = `
#ifdef MAPFLOAT
uniform float material_sheenGlossiness;
#endif

void getSheenGlossiness() {
    float sheenGlossiness = 1.0;

    #ifdef MAPFLOAT
    sheenGlossiness *= material_sheenGlossiness;
    #endif

    #ifdef MAPTEXTURE
    sheenGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenGlossiness *= saturate(vVertexColor.$VC);
    #endif

    sheenGlossiness += 0.0000001;
    sGlossiness = sheenGlossiness;
}
`;

export { sheenGlossPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hlZW5HbG9zcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvc2hlZW5HbG9zcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE1BUEZMT0FUXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX3NoZWVuR2xvc3NpbmVzcztcbiNlbmRpZlxuXG52b2lkIGdldFNoZWVuR2xvc3NpbmVzcygpIHtcbiAgICBmbG9hdCBzaGVlbkdsb3NzaW5lc3MgPSAxLjA7XG5cbiAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICBzaGVlbkdsb3NzaW5lc3MgKj0gbWF0ZXJpYWxfc2hlZW5HbG9zc2luZXNzO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBzaGVlbkdsb3NzaW5lc3MgKj0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgIHNoZWVuR2xvc3NpbmVzcyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAjZW5kaWZcblxuICAgIHNoZWVuR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgc0dsb3NzaW5lc3MgPSBzaGVlbkdsb3NzaW5lc3M7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
