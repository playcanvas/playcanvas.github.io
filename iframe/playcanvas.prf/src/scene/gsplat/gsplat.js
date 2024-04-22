import { FloatPacking } from '../../core/math/float-packing.js';
import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Mat3 } from '../../core/math/mat3.js';
import { PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_R16F, PIXELFORMAT_R32F, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Vec3 } from '../../core/math/vec3.js';

const _tmpVecA = new Vec3();
const _tmpVecB = new Vec3();
const _tmpVecC = new Vec3();
const _m0 = new Vec3();
const _m1 = new Vec3();
const _m2 = new Vec3();
const _s = new Vec3();
const _r = new Vec3();
class GSplat {
  constructor(device, numSplats, aabb) {
    this.device = void 0;
    this.numSplats = void 0;
    this.halfFormat = void 0;
    this.colorTexture = void 0;
    this.transformATexture = void 0;
    this.transformBTexture = void 0;
    this.transformCTexture = void 0;
    this.centers = void 0;
    this.aabb = void 0;
    this.device = device;
    this.numSplats = numSplats;
    this.aabb = aabb;
    this.halfFormat = this.getTextureFormat(device, true);
    if (this.halfFormat !== undefined) {
      const size = this.evalTextureSize(numSplats);
      this.colorTexture = this.createTexture(device, 'splatColor', PIXELFORMAT_RGBA8, size);
      this.transformATexture = this.createTexture(device, 'transformA', this.halfFormat ? PIXELFORMAT_RGBA16F : PIXELFORMAT_RGBA32F, size);
      this.transformBTexture = this.createTexture(device, 'transformB', this.halfFormat ? PIXELFORMAT_RGBA16F : PIXELFORMAT_RGBA32F, size);
      this.transformCTexture = this.createTexture(device, 'transformC', this.halfFormat ? PIXELFORMAT_R16F : PIXELFORMAT_R32F, size);
    }
  }
  destroy() {
    var _this$colorTexture, _this$transformATextu, _this$transformBTextu, _this$transformCTextu;
    (_this$colorTexture = this.colorTexture) == null || _this$colorTexture.destroy();
    (_this$transformATextu = this.transformATexture) == null || _this$transformATextu.destroy();
    (_this$transformBTextu = this.transformBTexture) == null || _this$transformBTextu.destroy();
    (_this$transformCTextu = this.transformCTexture) == null || _this$transformCTextu.destroy();
  }
  setupMaterial(material) {
    if (this.colorTexture) {
      material.setParameter('splatColor', this.colorTexture);
      material.setParameter('transformA', this.transformATexture);
      material.setParameter('transformB', this.transformBTexture);
      material.setParameter('transformC', this.transformCTexture);
      const {
        width,
        height
      } = this.colorTexture;
      material.setParameter('tex_params', new Float32Array([width, height, 1 / width, 1 / height]));
    }
  }
  evalTextureSize(count) {
    const width = Math.ceil(Math.sqrt(count));
    const height = Math.ceil(count / width);
    return new Vec2(width, height);
  }
  createTexture(device, name, format, size) {
    return new Texture(device, {
      name: name,
      width: size.x,
      height: size.y,
      format: format,
      cubemap: false,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
  }
  getTextureFormat(device, preferHighPrecision) {
    if (device.isWebGL1) preferHighPrecision = false;
    const halfSupported = device.extTextureHalfFloat && device.textureHalfFloatUpdatable;
    const floatSupported = device.extTextureFloat;
    let halfFormat;
    if (preferHighPrecision) {
      if (floatSupported) {
        halfFormat = false;
      } else if (halfSupported) {
        halfFormat = true;
      }
    } else {
      if (halfSupported) {
        halfFormat = true;
      } else if (floatSupported) {
        halfFormat = false;
      }
    }
    return halfFormat;
  }
  updateColorData(c0, c1, c2, opacity) {
    const SH_C0 = 0.28209479177387814;
    const texture = this.colorTexture;
    if (!texture) return;
    const data = texture.lock();
    const sigmoid = v => {
      if (v > 0) {
        return 1 / (1 + Math.exp(-v));
      }
      const t = Math.exp(v);
      return t / (1 + t);
    };
    for (let i = 0; i < this.numSplats; ++i) {
      if (c0 && c1 && c2) {
        data[i * 4 + 0] = math.clamp((0.5 + SH_C0 * c0[i]) * 255, 0, 255);
        data[i * 4 + 1] = math.clamp((0.5 + SH_C0 * c1[i]) * 255, 0, 255);
        data[i * 4 + 2] = math.clamp((0.5 + SH_C0 * c2[i]) * 255, 0, 255);
      }
      data[i * 4 + 3] = opacity ? math.clamp(sigmoid(opacity[i]) * 255, 0, 255) : 255;
    }
    texture.unlock();
  }
  updateTransformData(x, y, z, rot0, rot1, rot2, rot3, scale0, scale1, scale2) {
    const {
      halfFormat
    } = this;
    const float2Half = FloatPacking.float2Half;
    if (!this.transformATexture) return;
    const dataA = this.transformATexture.lock();
    const dataB = this.transformBTexture.lock();
    const dataC = this.transformCTexture.lock();
    const quat = new Quat();
    const mat = new Mat3();
    const cA = new Vec3();
    const cB = new Vec3();
    for (let i = 0; i < this.numSplats; i++) {
      quat.set(rot0[i], rot1[i], rot2[i], rot3[i]).normalize();
      if (quat.w < 0) {
        quat.conjugate();
      }
      _r.set(quat.x, quat.y, quat.z);
      this.quatToMat3(_r, mat);
      _s.set(Math.exp(scale0[i]), Math.exp(scale1[i]), Math.exp(scale2[i]));
      this.computeCov3d(mat, _s, cA, cB);
      if (halfFormat) {
        dataA[i * 4 + 0] = float2Half(x[i]);
        dataA[i * 4 + 1] = float2Half(y[i]);
        dataA[i * 4 + 2] = float2Half(z[i]);
        dataA[i * 4 + 3] = float2Half(cB.x);
        dataB[i * 4 + 0] = float2Half(cA.x);
        dataB[i * 4 + 1] = float2Half(cA.y);
        dataB[i * 4 + 2] = float2Half(cA.z);
        dataB[i * 4 + 3] = float2Half(cB.y);
        dataC[i] = float2Half(cB.z);
      } else {
        dataA[i * 4 + 0] = x[i];
        dataA[i * 4 + 1] = y[i];
        dataA[i * 4 + 2] = z[i];
        dataA[i * 4 + 3] = cB.x;
        dataB[i * 4 + 0] = cA.x;
        dataB[i * 4 + 1] = cA.y;
        dataB[i * 4 + 2] = cA.z;
        dataB[i * 4 + 3] = cB.y;
        dataC[i] = cB.z;
      }
    }
    this.transformATexture.unlock();
    this.transformBTexture.unlock();
    this.transformCTexture.unlock();
  }
  quatToMat3(R, mat) {
    const x = R.x;
    const y = R.y;
    const z = R.z;
    const w = Math.sqrt(1.0 - R.dot(R));
    const d = mat.data;
    d[0] = 1.0 - 2.0 * (z * z + w * w);
    d[1] = 2.0 * (y * z + x * w);
    d[2] = 2.0 * (y * w - x * z);
    d[3] = 2.0 * (y * z - x * w);
    d[4] = 1.0 - 2.0 * (y * y + w * w);
    d[5] = 2.0 * (z * w + x * y);
    d[6] = 2.0 * (y * w + x * z);
    d[7] = 2.0 * (z * w - x * y);
    d[8] = 1.0 - 2.0 * (y * y + z * z);
  }
  computeCov3d(rot, scale, covA, covB) {
    const r0 = rot.getX(_tmpVecA).mulScalar(scale.x);
    const r1 = rot.getY(_tmpVecB).mulScalar(scale.y);
    const r2 = rot.getZ(_tmpVecC).mulScalar(scale.z);
    _m0.set(r0.x, r1.x, r2.x);
    _m1.set(r0.y, r1.y, r2.y);
    _m2.set(r0.z, r1.z, r2.z);
    covA.set(_m0.dot(_m0), _m0.dot(_m1), _m0.dot(_m2));
    covB.set(_m1.dot(_m1), _m1.dot(_m2), _m2.dot(_m2));
  }
}

export { GSplat };
