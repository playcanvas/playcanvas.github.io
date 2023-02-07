/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightmapDirAddPS = /* glsl */`
void addLightMap() {
    if (dot(dLightmapDir, dLightmapDir) < 0.0001) {
        dDiffuseLight += dLightmap;
    } else {
        dLightDirNormW = dLightmapDir;

        float vlight = saturate(dot(dLightDirNormW, -dVertexNormalW));
        float flight = saturate(dot(dLightDirNormW, -dNormalW));
        float nlight = (flight / max(vlight, 0.01)) * 0.5;

        dDiffuseLight += dLightmap * nlight * 2.0;

        vec3 halfDirW = normalize(-dLightmapDir + dViewDirW);
        vec3 specularLight = dLightmap * getLightSpecular(halfDirW);

        #ifdef LIT_SPECULAR_FRESNEL
        specularLight *= getFresnel(dot(dViewDirW, halfDirW), dSpecularity);
        #endif

        dSpecularLight += specularLight;
    }
}
`;

export { lightmapDirAddPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBEaXJBZGQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9saWdodG1hcERpckFkZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBhZGRMaWdodE1hcCgpIHtcbiAgICBpZiAoZG90KGRMaWdodG1hcERpciwgZExpZ2h0bWFwRGlyKSA8IDAuMDAwMSkge1xuICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IGRMaWdodG1hcDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBkTGlnaHREaXJOb3JtVyA9IGRMaWdodG1hcERpcjtcblxuICAgICAgICBmbG9hdCB2bGlnaHQgPSBzYXR1cmF0ZShkb3QoZExpZ2h0RGlyTm9ybVcsIC1kVmVydGV4Tm9ybWFsVykpO1xuICAgICAgICBmbG9hdCBmbGlnaHQgPSBzYXR1cmF0ZShkb3QoZExpZ2h0RGlyTm9ybVcsIC1kTm9ybWFsVykpO1xuICAgICAgICBmbG9hdCBubGlnaHQgPSAoZmxpZ2h0IC8gbWF4KHZsaWdodCwgMC4wMSkpICogMC41O1xuXG4gICAgICAgIGREaWZmdXNlTGlnaHQgKz0gZExpZ2h0bWFwICogbmxpZ2h0ICogMi4wO1xuXG4gICAgICAgIHZlYzMgaGFsZkRpclcgPSBub3JtYWxpemUoLWRMaWdodG1hcERpciArIGRWaWV3RGlyVyk7XG4gICAgICAgIHZlYzMgc3BlY3VsYXJMaWdodCA9IGRMaWdodG1hcCAqIGdldExpZ2h0U3BlY3VsYXIoaGFsZkRpclcpO1xuXG4gICAgICAgICNpZmRlZiBMSVRfU1BFQ1VMQVJfRlJFU05FTFxuICAgICAgICBzcGVjdWxhckxpZ2h0ICo9IGdldEZyZXNuZWwoZG90KGRWaWV3RGlyVywgaGFsZkRpclcpLCBkU3BlY3VsYXJpdHkpO1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICBkU3BlY3VsYXJMaWdodCArPSBzcGVjdWxhckxpZ2h0O1xuICAgIH1cbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
