/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccConstPS = `
void occludeSpecular() {
		// approximated specular occlusion from AO
		float specPow = exp2(dGlossiness * 11.0);
		// http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
		float specOcc = saturate(pow(dot(dNormalW, dViewDirW) + dAo, 0.01*specPow) - 1.0 + dAo);

		dSpecularLight *= specOcc;
		dReflection *= specOcc;
}
`;

export { aoSpecOccConstPS as default };
