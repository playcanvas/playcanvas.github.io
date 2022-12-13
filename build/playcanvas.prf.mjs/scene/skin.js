/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
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
