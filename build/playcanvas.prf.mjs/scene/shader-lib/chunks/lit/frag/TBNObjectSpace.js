/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var TBNObjectSpacePS = `
void getTBN() {

		vec3 B = cross(dVertexNormalW, vObjectSpaceUpW);
		vec3 T = cross(dVertexNormalW, B);

		if (dot(B,B)==0.0) // deal with case when vObjectSpaceUpW dVertexNormalW are parallel
		{
				float major=max(max(dVertexNormalW.x, dVertexNormalW.y),dVertexNormalW.z);

				if (dVertexNormalW.x==major)
				{
						B=cross(dVertexNormalW, vec3(0,1,0));
						T=cross(dVertexNormalW, B);
				}
				else if (dVertexNormalW.y==major)
				{
						B=cross(dVertexNormalW, vec3(0,0,1));
						T=cross(dVertexNormalW, B);
				}
				else if (dVertexNormalW.z==major)
				{
						B=cross(dVertexNormalW, vec3(1,0,0));
						T=cross(dVertexNormalW, B);
				}
		}

		dTBN = mat3(normalize(T), normalize(B), normalize(dVertexNormalW));
}
`;

export { TBNObjectSpacePS as default };
