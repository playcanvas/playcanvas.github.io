/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccSimplePS = `
uniform float material_occludeSpecularIntensity;

void occludeSpecular() {
    float specOcc = mix(1.0, dAo, material_occludeSpecularIntensity);
    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
`;

export { aoSpecOccSimplePS as default };
