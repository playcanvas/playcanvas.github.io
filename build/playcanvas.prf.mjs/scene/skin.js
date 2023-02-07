/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class Skin {
	constructor(graphicsDevice, ibp, boneNames) {
		this.device = graphicsDevice;
		this.inverseBindPose = ibp;
		this.boneNames = boneNames;
	}
}

export { Skin };
