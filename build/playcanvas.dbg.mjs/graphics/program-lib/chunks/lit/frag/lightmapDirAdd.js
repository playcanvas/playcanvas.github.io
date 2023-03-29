/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightmapDirAddPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBEaXJBZGQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvbGlnaHRtYXBEaXJBZGQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgYWRkTGlnaHRNYXAoKSB7XG4gICAgaWYgKGRvdChkTGlnaHRtYXBEaXIsIGRMaWdodG1hcERpcikgPCAwLjAwMDEpIHtcbiAgICAgICAgZERpZmZ1c2VMaWdodCArPSBkTGlnaHRtYXA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZExpZ2h0RGlyTm9ybVcgPSBkTGlnaHRtYXBEaXI7XG5cbiAgICAgICAgZmxvYXQgdmxpZ2h0ID0gc2F0dXJhdGUoZG90KGRMaWdodERpck5vcm1XLCAtZFZlcnRleE5vcm1hbFcpKTtcbiAgICAgICAgZmxvYXQgZmxpZ2h0ID0gc2F0dXJhdGUoZG90KGRMaWdodERpck5vcm1XLCAtZE5vcm1hbFcpKTtcbiAgICAgICAgZmxvYXQgbmxpZ2h0ID0gKGZsaWdodCAvIG1heCh2bGlnaHQsIDAuMDEpKSAqIDAuNTtcblxuICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IGRMaWdodG1hcCAqIG5saWdodCAqIDIuMDtcblxuICAgICAgICB2ZWMzIGhhbGZEaXJXID0gbm9ybWFsaXplKC1kTGlnaHRtYXBEaXIgKyBkVmlld0RpclcpO1xuICAgICAgICB2ZWMzIHNwZWN1bGFyTGlnaHQgPSBkTGlnaHRtYXAgKiBnZXRMaWdodFNwZWN1bGFyKGhhbGZEaXJXKTtcblxuICAgICAgICAjaWZkZWYgTElUX1NQRUNVTEFSX0ZSRVNORUxcbiAgICAgICAgc3BlY3VsYXJMaWdodCAqPSBnZXRGcmVzbmVsKGRvdChkVmlld0RpclcsIGhhbGZEaXJXKSwgZFNwZWN1bGFyaXR5KTtcbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgZFNwZWN1bGFyTGlnaHQgKz0gc3BlY3VsYXJMaWdodDtcbiAgICB9XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXZCQTs7OzsifQ==
