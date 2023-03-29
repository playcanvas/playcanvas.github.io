/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
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
