import { Debug } from '../core/debug.js';
import { math } from '../core/math/math.js';
import { Mat4 } from '../core/math/mat4.js';
import { PIXELFORMAT_RGBA32F, FILTER_NEAREST } from '../platform/graphics/constants.js';
import { Texture } from '../platform/graphics/texture.js';

const _invMatrix = new Mat4();

/**
 * A skin instance is responsible for generating the matrix palette that is used to skin vertices
 * from object space to world space.
 */
class SkinInstance {
  /**
   * An array of nodes representing each bone in this skin instance.
   *
   * @type {import('./graph-node.js').GraphNode[]}
   */

  /**
   * Create a new SkinInstance instance.
   *
   * @param {import('./skin.js').Skin} skin - The skin that will provide the inverse bind pose
   * matrices to generate the final matrix palette.
   */
  constructor(skin) {
    this.bones = void 0;
    this._dirty = true;

    // optional root bone - used for cache lookup, not used for skinning
    this._rootBone = null;

    // sequential index of when the bone update was performed the last time
    this._skinUpdateIndex = -1;

    // true if bones need to be updated before the frustum culling (bones are needed to update bounds of the MeshInstance)
    this._updateBeforeCull = true;
    if (skin) {
      this.initSkin(skin);
    }
  }
  set rootBone(rootBone) {
    this._rootBone = rootBone;
  }
  get rootBone() {
    return this._rootBone;
  }
  init(device, numBones) {
    if (device.supportsBoneTextures) {
      // texture size - roughly square that fits all bones, width is multiply of 3 to simplify shader math
      const numPixels = numBones * 3;
      let width = Math.ceil(Math.sqrt(numPixels));
      width = math.roundUp(width, 3);
      const height = Math.ceil(numPixels / width);
      this.boneTexture = new Texture(device, {
        width: width,
        height: height,
        format: PIXELFORMAT_RGBA32F,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        name: 'skin'
      });
      this.matrixPalette = this.boneTexture.lock();
    } else {
      this.matrixPalette = new Float32Array(numBones * 12);
    }
  }
  destroy() {
    if (this.boneTexture) {
      this.boneTexture.destroy();
      this.boneTexture = null;
    }
  }

  // resolved skin bones to a hierarchy with the rootBone at its root.
  // entity parameter specifies the entity used if the bone match is not found in the hierarchy - usually the entity the render component is attached to
  resolve(rootBone, entity) {
    this.rootBone = rootBone;

    // Resolve bone IDs to actual graph nodes of the hierarchy
    const skin = this.skin;
    const bones = [];
    for (let j = 0; j < skin.boneNames.length; j++) {
      const boneName = skin.boneNames[j];
      let bone = rootBone.findByName(boneName);
      if (!bone) {
        Debug.error(`Failed to find bone [${boneName}] in the entity hierarchy, RenderComponent on ${entity.name}, rootBone: ${rootBone.name}`);
        bone = entity;
      }
      bones.push(bone);
    }
    this.bones = bones;
  }
  initSkin(skin) {
    this.skin = skin;

    // Unique per clone
    this.bones = [];
    const numBones = skin.inverseBindPose.length;
    this.init(skin.device, numBones);
    this.matrices = [];
    for (let i = 0; i < numBones; i++) {
      this.matrices[i] = new Mat4();
    }
  }
  uploadBones(device) {
    // TODO: this is a bit strange looking. Change the Texture API to do a reupload
    if (device.supportsBoneTextures) {
      this.boneTexture.lock();
      this.boneTexture.unlock();
    }
  }
  _updateMatrices(rootNode, skinUpdateIndex) {
    // if not already up to date
    if (this._skinUpdateIndex !== skinUpdateIndex) {
      this._skinUpdateIndex = skinUpdateIndex;
      _invMatrix.copy(rootNode.getWorldTransform()).invert();
      for (let i = this.bones.length - 1; i >= 0; i--) {
        this.matrices[i].mulAffine2(_invMatrix, this.bones[i].getWorldTransform()); // world space -> rootNode space
        this.matrices[i].mulAffine2(this.matrices[i], this.skin.inverseBindPose[i]); // rootNode space -> bind space
      }
    }
  }

  updateMatrices(rootNode, skinUpdateIndex) {
    if (this._updateBeforeCull) {
      this._updateMatrices(rootNode, skinUpdateIndex);
    }
  }
  updateMatrixPalette(rootNode, skinUpdateIndex) {
    // make sure matrices are up to date
    this._updateMatrices(rootNode, skinUpdateIndex);

    // copy matrices to palette
    const mp = this.matrixPalette;
    const count = this.bones.length;
    for (let i = 0; i < count; i++) {
      const pe = this.matrices[i].data;

      // Copy the matrix into the palette, ready to be sent to the vertex shader, transpose matrix from 4x4 to 4x3 format as well
      const base = i * 12;
      mp[base] = pe[0];
      mp[base + 1] = pe[4];
      mp[base + 2] = pe[8];
      mp[base + 3] = pe[12];
      mp[base + 4] = pe[1];
      mp[base + 5] = pe[5];
      mp[base + 6] = pe[9];
      mp[base + 7] = pe[13];
      mp[base + 8] = pe[2];
      mp[base + 9] = pe[6];
      mp[base + 10] = pe[10];
      mp[base + 11] = pe[14];
    }
    this.uploadBones(this.skin.device);
  }
}

export { SkinInstance };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbi1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3NraW4taW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBGSUxURVJfTkVBUkVTVCwgUElYRUxGT1JNQVRfUkdCQTMyRiB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmNvbnN0IF9pbnZNYXRyaXggPSBuZXcgTWF0NCgpO1xuXG4vKipcbiAqIEEgc2tpbiBpbnN0YW5jZSBpcyByZXNwb25zaWJsZSBmb3IgZ2VuZXJhdGluZyB0aGUgbWF0cml4IHBhbGV0dGUgdGhhdCBpcyB1c2VkIHRvIHNraW4gdmVydGljZXNcbiAqIGZyb20gb2JqZWN0IHNwYWNlIHRvIHdvcmxkIHNwYWNlLlxuICovXG5jbGFzcyBTa2luSW5zdGFuY2Uge1xuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIG5vZGVzIHJlcHJlc2VudGluZyBlYWNoIGJvbmUgaW4gdGhpcyBza2luIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9ncmFwaC1ub2RlLmpzJykuR3JhcGhOb2RlW119XG4gICAgICovXG4gICAgYm9uZXM7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2tpbkluc3RhbmNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc2tpbi5qcycpLlNraW59IHNraW4gLSBUaGUgc2tpbiB0aGF0IHdpbGwgcHJvdmlkZSB0aGUgaW52ZXJzZSBiaW5kIHBvc2VcbiAgICAgKiBtYXRyaWNlcyB0byBnZW5lcmF0ZSB0aGUgZmluYWwgbWF0cml4IHBhbGV0dGUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc2tpbikge1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgLy8gb3B0aW9uYWwgcm9vdCBib25lIC0gdXNlZCBmb3IgY2FjaGUgbG9va3VwLCBub3QgdXNlZCBmb3Igc2tpbm5pbmdcbiAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSBudWxsO1xuXG4gICAgICAgIC8vIHNlcXVlbnRpYWwgaW5kZXggb2Ygd2hlbiB0aGUgYm9uZSB1cGRhdGUgd2FzIHBlcmZvcm1lZCB0aGUgbGFzdCB0aW1lXG4gICAgICAgIHRoaXMuX3NraW5VcGRhdGVJbmRleCA9IC0xO1xuXG4gICAgICAgIC8vIHRydWUgaWYgYm9uZXMgbmVlZCB0byBiZSB1cGRhdGVkIGJlZm9yZSB0aGUgZnJ1c3R1bSBjdWxsaW5nIChib25lcyBhcmUgbmVlZGVkIHRvIHVwZGF0ZSBib3VuZHMgb2YgdGhlIE1lc2hJbnN0YW5jZSlcbiAgICAgICAgdGhpcy5fdXBkYXRlQmVmb3JlQ3VsbCA9IHRydWU7XG5cbiAgICAgICAgaWYgKHNraW4pIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdFNraW4oc2tpbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgcm9vdEJvbmUocm9vdEJvbmUpIHtcbiAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSByb290Qm9uZTtcbiAgICB9XG5cbiAgICBnZXQgcm9vdEJvbmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb290Qm9uZTtcbiAgICB9XG5cbiAgICBpbml0KGRldmljZSwgbnVtQm9uZXMpIHtcblxuICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzQm9uZVRleHR1cmVzKSB7XG5cbiAgICAgICAgICAgIC8vIHRleHR1cmUgc2l6ZSAtIHJvdWdobHkgc3F1YXJlIHRoYXQgZml0cyBhbGwgYm9uZXMsIHdpZHRoIGlzIG11bHRpcGx5IG9mIDMgdG8gc2ltcGxpZnkgc2hhZGVyIG1hdGhcbiAgICAgICAgICAgIGNvbnN0IG51bVBpeGVscyA9IG51bUJvbmVzICogMztcbiAgICAgICAgICAgIGxldCB3aWR0aCA9IE1hdGguY2VpbChNYXRoLnNxcnQobnVtUGl4ZWxzKSk7XG4gICAgICAgICAgICB3aWR0aCA9IG1hdGgucm91bmRVcCh3aWR0aCwgMyk7XG4gICAgICAgICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLmNlaWwobnVtUGl4ZWxzIC8gd2lkdGgpO1xuXG4gICAgICAgICAgICB0aGlzLmJvbmVUZXh0dXJlID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICAgICAgICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3NraW4nXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5tYXRyaXhQYWxldHRlID0gdGhpcy5ib25lVGV4dHVyZS5sb2NrKCk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubWF0cml4UGFsZXR0ZSA9IG5ldyBGbG9hdDMyQXJyYXkobnVtQm9uZXMgKiAxMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmJvbmVUZXh0dXJlKSB7XG4gICAgICAgICAgICB0aGlzLmJvbmVUZXh0dXJlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuYm9uZVRleHR1cmUgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVzb2x2ZWQgc2tpbiBib25lcyB0byBhIGhpZXJhcmNoeSB3aXRoIHRoZSByb290Qm9uZSBhdCBpdHMgcm9vdC5cbiAgICAvLyBlbnRpdHkgcGFyYW1ldGVyIHNwZWNpZmllcyB0aGUgZW50aXR5IHVzZWQgaWYgdGhlIGJvbmUgbWF0Y2ggaXMgbm90IGZvdW5kIGluIHRoZSBoaWVyYXJjaHkgLSB1c3VhbGx5IHRoZSBlbnRpdHkgdGhlIHJlbmRlciBjb21wb25lbnQgaXMgYXR0YWNoZWQgdG9cbiAgICByZXNvbHZlKHJvb3RCb25lLCBlbnRpdHkpIHtcblxuICAgICAgICB0aGlzLnJvb3RCb25lID0gcm9vdEJvbmU7XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBib25lIElEcyB0byBhY3R1YWwgZ3JhcGggbm9kZXMgb2YgdGhlIGhpZXJhcmNoeVxuICAgICAgICBjb25zdCBza2luID0gdGhpcy5za2luO1xuICAgICAgICBjb25zdCBib25lcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHNraW4uYm9uZU5hbWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBib25lTmFtZSA9IHNraW4uYm9uZU5hbWVzW2pdO1xuICAgICAgICAgICAgbGV0IGJvbmUgPSByb290Qm9uZS5maW5kQnlOYW1lKGJvbmVOYW1lKTtcblxuICAgICAgICAgICAgaWYgKCFib25lKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYEZhaWxlZCB0byBmaW5kIGJvbmUgWyR7Ym9uZU5hbWV9XSBpbiB0aGUgZW50aXR5IGhpZXJhcmNoeSwgUmVuZGVyQ29tcG9uZW50IG9uICR7ZW50aXR5Lm5hbWV9LCByb290Qm9uZTogJHtyb290Qm9uZS5uYW1lfWApO1xuICAgICAgICAgICAgICAgIGJvbmUgPSBlbnRpdHk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvbmVzLnB1c2goYm9uZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ib25lcyA9IGJvbmVzO1xuICAgIH1cblxuICAgIGluaXRTa2luKHNraW4pIHtcblxuICAgICAgICB0aGlzLnNraW4gPSBza2luO1xuXG4gICAgICAgIC8vIFVuaXF1ZSBwZXIgY2xvbmVcbiAgICAgICAgdGhpcy5ib25lcyA9IFtdO1xuXG4gICAgICAgIGNvbnN0IG51bUJvbmVzID0gc2tpbi5pbnZlcnNlQmluZFBvc2UubGVuZ3RoO1xuICAgICAgICB0aGlzLmluaXQoc2tpbi5kZXZpY2UsIG51bUJvbmVzKTtcblxuICAgICAgICB0aGlzLm1hdHJpY2VzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQm9uZXM7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5tYXRyaWNlc1tpXSA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGxvYWRCb25lcyhkZXZpY2UpIHtcblxuICAgICAgICAvLyBUT0RPOiB0aGlzIGlzIGEgYml0IHN0cmFuZ2UgbG9va2luZy4gQ2hhbmdlIHRoZSBUZXh0dXJlIEFQSSB0byBkbyBhIHJldXBsb2FkXG4gICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMpIHtcbiAgICAgICAgICAgIHRoaXMuYm9uZVRleHR1cmUubG9jaygpO1xuICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZS51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVNYXRyaWNlcyhyb290Tm9kZSwgc2tpblVwZGF0ZUluZGV4KSB7XG5cbiAgICAgICAgLy8gaWYgbm90IGFscmVhZHkgdXAgdG8gZGF0ZVxuICAgICAgICBpZiAodGhpcy5fc2tpblVwZGF0ZUluZGV4ICE9PSBza2luVXBkYXRlSW5kZXgpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5VcGRhdGVJbmRleCA9IHNraW5VcGRhdGVJbmRleDtcblxuICAgICAgICAgICAgX2ludk1hdHJpeC5jb3B5KHJvb3ROb2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpLmludmVydCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuYm9uZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1hdHJpY2VzW2ldLm11bEFmZmluZTIoX2ludk1hdHJpeCwgdGhpcy5ib25lc1tpXS5nZXRXb3JsZFRyYW5zZm9ybSgpKTsgLy8gd29ybGQgc3BhY2UgLT4gcm9vdE5vZGUgc3BhY2VcbiAgICAgICAgICAgICAgICB0aGlzLm1hdHJpY2VzW2ldLm11bEFmZmluZTIodGhpcy5tYXRyaWNlc1tpXSwgdGhpcy5za2luLmludmVyc2VCaW5kUG9zZVtpXSk7IC8vIHJvb3ROb2RlIHNwYWNlIC0+IGJpbmQgc3BhY2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZU1hdHJpY2VzKHJvb3ROb2RlLCBza2luVXBkYXRlSW5kZXgpIHtcblxuICAgICAgICBpZiAodGhpcy5fdXBkYXRlQmVmb3JlQ3VsbCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWF0cmljZXMocm9vdE5vZGUsIHNraW5VcGRhdGVJbmRleCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVNYXRyaXhQYWxldHRlKHJvb3ROb2RlLCBza2luVXBkYXRlSW5kZXgpIHtcblxuICAgICAgICAvLyBtYWtlIHN1cmUgbWF0cmljZXMgYXJlIHVwIHRvIGRhdGVcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0cmljZXMocm9vdE5vZGUsIHNraW5VcGRhdGVJbmRleCk7XG5cbiAgICAgICAgLy8gY29weSBtYXRyaWNlcyB0byBwYWxldHRlXG4gICAgICAgIGNvbnN0IG1wID0gdGhpcy5tYXRyaXhQYWxldHRlO1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuYm9uZXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHBlID0gdGhpcy5tYXRyaWNlc1tpXS5kYXRhO1xuXG4gICAgICAgICAgICAvLyBDb3B5IHRoZSBtYXRyaXggaW50byB0aGUgcGFsZXR0ZSwgcmVhZHkgdG8gYmUgc2VudCB0byB0aGUgdmVydGV4IHNoYWRlciwgdHJhbnNwb3NlIG1hdHJpeCBmcm9tIDR4NCB0byA0eDMgZm9ybWF0IGFzIHdlbGxcbiAgICAgICAgICAgIGNvbnN0IGJhc2UgPSBpICogMTI7XG4gICAgICAgICAgICBtcFtiYXNlXSA9IHBlWzBdO1xuICAgICAgICAgICAgbXBbYmFzZSArIDFdID0gcGVbNF07XG4gICAgICAgICAgICBtcFtiYXNlICsgMl0gPSBwZVs4XTtcbiAgICAgICAgICAgIG1wW2Jhc2UgKyAzXSA9IHBlWzEyXTtcbiAgICAgICAgICAgIG1wW2Jhc2UgKyA0XSA9IHBlWzFdO1xuICAgICAgICAgICAgbXBbYmFzZSArIDVdID0gcGVbNV07XG4gICAgICAgICAgICBtcFtiYXNlICsgNl0gPSBwZVs5XTtcbiAgICAgICAgICAgIG1wW2Jhc2UgKyA3XSA9IHBlWzEzXTtcbiAgICAgICAgICAgIG1wW2Jhc2UgKyA4XSA9IHBlWzJdO1xuICAgICAgICAgICAgbXBbYmFzZSArIDldID0gcGVbNl07XG4gICAgICAgICAgICBtcFtiYXNlICsgMTBdID0gcGVbMTBdO1xuICAgICAgICAgICAgbXBbYmFzZSArIDExXSA9IHBlWzE0XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXBsb2FkQm9uZXModGhpcy5za2luLmRldmljZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTa2luSW5zdGFuY2UgfTtcbiJdLCJuYW1lcyI6WyJfaW52TWF0cml4IiwiTWF0NCIsIlNraW5JbnN0YW5jZSIsImNvbnN0cnVjdG9yIiwic2tpbiIsImJvbmVzIiwiX2RpcnR5IiwiX3Jvb3RCb25lIiwiX3NraW5VcGRhdGVJbmRleCIsIl91cGRhdGVCZWZvcmVDdWxsIiwiaW5pdFNraW4iLCJyb290Qm9uZSIsImluaXQiLCJkZXZpY2UiLCJudW1Cb25lcyIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwibnVtUGl4ZWxzIiwid2lkdGgiLCJNYXRoIiwiY2VpbCIsInNxcnQiLCJtYXRoIiwicm91bmRVcCIsImhlaWdodCIsImJvbmVUZXh0dXJlIiwiVGV4dHVyZSIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJuYW1lIiwibWF0cml4UGFsZXR0ZSIsImxvY2siLCJGbG9hdDMyQXJyYXkiLCJkZXN0cm95IiwicmVzb2x2ZSIsImVudGl0eSIsImoiLCJib25lTmFtZXMiLCJsZW5ndGgiLCJib25lTmFtZSIsImJvbmUiLCJmaW5kQnlOYW1lIiwiRGVidWciLCJlcnJvciIsInB1c2giLCJpbnZlcnNlQmluZFBvc2UiLCJtYXRyaWNlcyIsImkiLCJ1cGxvYWRCb25lcyIsInVubG9jayIsIl91cGRhdGVNYXRyaWNlcyIsInJvb3ROb2RlIiwic2tpblVwZGF0ZUluZGV4IiwiY29weSIsImdldFdvcmxkVHJhbnNmb3JtIiwiaW52ZXJ0IiwibXVsQWZmaW5lMiIsInVwZGF0ZU1hdHJpY2VzIiwidXBkYXRlTWF0cml4UGFsZXR0ZSIsIm1wIiwiY291bnQiLCJwZSIsImRhdGEiLCJiYXNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFPQSxNQUFNQSxVQUFVLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsWUFBWSxDQUFDO0FBQ2Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsSUFBSSxFQUFFO0FBQUEsSUFBQSxJQUFBLENBUmxCQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFTRCxJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJLENBQUE7O0FBRWxCO0lBQ0EsSUFBSSxDQUFDQyxTQUFTLEdBQUcsSUFBSSxDQUFBOztBQUVyQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxDQUFDLENB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
