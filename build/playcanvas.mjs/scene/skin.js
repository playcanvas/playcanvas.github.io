class Skin {
	constructor(graphicsDevice, ibp, boneNames) {
		this.device = graphicsDevice;
		this.inverseBindPose = ibp;
		this.boneNames = boneNames;
	}
}

export { Skin };
