/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccConstSimplePS = `
void occludeSpecular() {
    dSpecularLight *= dAo;
    dReflection *= dAo;
}
`;

export { aoSpecOccConstSimplePS as default };
