/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class Skin {
  constructor(graphicsDevice, ibp, boneNames) {
    this.device = graphicsDevice;
    this.inverseBindPose = ibp;
    this.boneNames = boneNames;
  }
}

export { Skin };
