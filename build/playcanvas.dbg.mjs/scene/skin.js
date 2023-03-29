/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * A skin contains data about the bones in a hierarchy that drive a skinned mesh animation.
 * Specifically, the skin stores the bone name and inverse bind matrix and for each bone. Inverse
 * bind matrices are instrumental in the mathematics of vertex skinning.
 */
class Skin {
  /**
   * Create a new Skin instance.
   *
   * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device used to manage this skin.
   * @param {import('../core/math/mat4.js').Mat4[]} ibp - The array of inverse bind matrices.
   * @param {string[]} boneNames - The array of bone names for the bones referenced by this skin.
   */
  constructor(graphicsDevice, ibp, boneNames) {
    // Constant between clones
    this.device = graphicsDevice;
    this.inverseBindPose = ibp;
    this.boneNames = boneNames;
  }
}

export { Skin };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3NraW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIHNraW4gY29udGFpbnMgZGF0YSBhYm91dCB0aGUgYm9uZXMgaW4gYSBoaWVyYXJjaHkgdGhhdCBkcml2ZSBhIHNraW5uZWQgbWVzaCBhbmltYXRpb24uXG4gKiBTcGVjaWZpY2FsbHksIHRoZSBza2luIHN0b3JlcyB0aGUgYm9uZSBuYW1lIGFuZCBpbnZlcnNlIGJpbmQgbWF0cml4IGFuZCBmb3IgZWFjaCBib25lLiBJbnZlcnNlXG4gKiBiaW5kIG1hdHJpY2VzIGFyZSBpbnN0cnVtZW50YWwgaW4gdGhlIG1hdGhlbWF0aWNzIG9mIHZlcnRleCBza2lubmluZy5cbiAqL1xuY2xhc3MgU2tpbiB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNraW4gaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC1cbiAgICAgKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoaXMgc2tpbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0W119IGlicCAtIFRoZSBhcnJheSBvZiBpbnZlcnNlIGJpbmQgbWF0cmljZXMuXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gYm9uZU5hbWVzIC0gVGhlIGFycmF5IG9mIGJvbmUgbmFtZXMgZm9yIHRoZSBib25lcyByZWZlcmVuY2VkIGJ5IHRoaXMgc2tpbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSwgaWJwLCBib25lTmFtZXMpIHtcbiAgICAgICAgLy8gQ29uc3RhbnQgYmV0d2VlbiBjbG9uZXNcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgdGhpcy5pbnZlcnNlQmluZFBvc2UgPSBpYnA7XG4gICAgICAgIHRoaXMuYm9uZU5hbWVzID0gYm9uZU5hbWVzO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2tpbiB9O1xuIl0sIm5hbWVzIjpbIlNraW4iLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiaWJwIiwiYm9uZU5hbWVzIiwiZGV2aWNlIiwiaW52ZXJzZUJpbmRQb3NlIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxJQUFJLENBQUM7QUFDUDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsY0FBYyxFQUFFQyxHQUFHLEVBQUVDLFNBQVMsRUFBRTtBQUN4QztJQUNBLElBQUksQ0FBQ0MsTUFBTSxHQUFHSCxjQUFjLENBQUE7SUFDNUIsSUFBSSxDQUFDSSxlQUFlLEdBQUdILEdBQUcsQ0FBQTtJQUMxQixJQUFJLENBQUNDLFNBQVMsR0FBR0EsU0FBUyxDQUFBO0FBQzlCLEdBQUE7QUFDSjs7OzsifQ==
