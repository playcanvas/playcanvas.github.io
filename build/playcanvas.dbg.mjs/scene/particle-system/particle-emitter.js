/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Curve } from '../../core/math/curve.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { FILTER_LINEAR, PRIMITIVE_TRIANGLES, CULLFACE_NONE, BUFFER_DYNAMIC, INDEXFORMAT_UINT16, SEMANTIC_ATTR0, TYPE_FLOAT32, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_TEXCOORD0, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { particle } from '../shader-lib/programs/particle.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { EMITTERSHAPE_BOX, PARTICLESORT_NONE, PARTICLEORIENTATION_SCREEN, PARTICLEORIENTATION_WORLD, PARTICLEMODE_GPU, BLEND_NORMAL } from '../constants.js';
import { Material } from '../materials/material.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { ParticleCPUUpdater } from './cpu-updater.js';
import { ParticleGPUUpdater } from './gpu-updater.js';

const particleVerts = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
function _createTexture(device, width, height, pixelData, format = PIXELFORMAT_RGBA32F, mult8Bit, filter) {
  let mipFilter = FILTER_NEAREST;
  if (filter && format === PIXELFORMAT_R8_G8_B8_A8) mipFilter = FILTER_LINEAR;
  const texture = new Texture(device, {
    width: width,
    height: height,
    format: format,
    cubemap: false,
    mipmaps: false,
    minFilter: mipFilter,
    magFilter: mipFilter,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
    name: 'ParticleSystemTexture'
  });
  const pixels = texture.lock();
  if (format === PIXELFORMAT_R8_G8_B8_A8) {
    const temp = new Uint8Array(pixelData.length);
    for (let i = 0; i < pixelData.length; i++) {
      temp[i] = pixelData[i] * mult8Bit * 255;
    }
    pixelData = temp;
  }
  pixels.set(pixelData);
  texture.unlock();
  return texture;
}
function saturate(x) {
  return Math.max(Math.min(x, 1), 0);
}
const default0Curve = new Curve([0, 0, 1, 0]);
const default1Curve = new Curve([0, 1, 1, 1]);
const default0Curve3 = new CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]);
const default1Curve3 = new CurveSet([0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]);
let particleTexHeight = 2;
const particleTexChannels = 4;

const extentsInnerRatioUniform = new Float32Array(3);
const spawnMatrix = new Mat4();
const tmpVec3 = new Vec3();
const bMin = new Vec3();
const bMax = new Vec3();
let setPropertyTarget;
let setPropertyOptions;
function setProperty(pName, defaultVal) {
  if (setPropertyOptions[pName] !== undefined && setPropertyOptions[pName] !== null) {
    setPropertyTarget[pName] = setPropertyOptions[pName];
  } else {
    setPropertyTarget[pName] = defaultVal;
  }
}
function pack3NFloats(a, b, c) {
  const packed = a * 255 << 16 | b * 255 << 8 | c * 255;
  return packed / (1 << 24);
}
function packTextureXYZ_NXYZ(qXYZ, qXYZ2) {
  const num = qXYZ.length / 3;
  const colors = new Array(num * 4);
  for (let i = 0; i < num; i++) {
    colors[i * 4] = qXYZ[i * 3];
    colors[i * 4 + 1] = qXYZ[i * 3 + 1];
    colors[i * 4 + 2] = qXYZ[i * 3 + 2];
    colors[i * 4 + 3] = pack3NFloats(qXYZ2[i * 3], qXYZ2[i * 3 + 1], qXYZ2[i * 3 + 2]);
  }
  return colors;
}
function packTextureRGBA(qRGB, qA) {
  const colors = new Array(qA.length * 4);
  for (let i = 0; i < qA.length; i++) {
    colors[i * 4] = qRGB[i * 3];
    colors[i * 4 + 1] = qRGB[i * 3 + 1];
    colors[i * 4 + 2] = qRGB[i * 3 + 2];
    colors[i * 4 + 3] = qA[i];
  }
  return colors;
}
function packTexture5Floats(qA, qB, qC, qD, qE) {
  const colors = new Array(qA.length * 4);
  for (let i = 0; i < qA.length; i++) {
    colors[i * 4] = qA[i];
    colors[i * 4 + 1] = qB[i];
    colors[i * 4 + 2] = 0;
    colors[i * 4 + 3] = pack3NFloats(qC[i], qD[i], qE[i]);
  }
  return colors;
}
function packTexture2Floats(qA, qB) {
  const colors = new Array(qA.length * 4);
  for (let i = 0; i < qA.length; i++) {
    colors[i * 4] = qA[i];
    colors[i * 4 + 1] = qB[i];
    colors[i * 4 + 2] = 0;
    colors[i * 4 + 3] = 0;
  }
  return colors;
}
function calcEndTime(emitter) {
  const interval = Math.max(emitter.rate, emitter.rate2) * emitter.numParticles + emitter.lifetime;
  return Date.now() + interval * 1000;
}
function subGraph(A, B) {
  const r = new Float32Array(A.length);
  for (let i = 0; i < A.length; i++) {
    r[i] = A[i] - B[i];
  }
  return r;
}
function maxUnsignedGraphValue(A, outUMax) {
  const chans = outUMax.length;
  const values = A.length / chans;
  for (let i = 0; i < values; i++) {
    for (let j = 0; j < chans; j++) {
      const a = Math.abs(A[i * chans + j]);
      outUMax[j] = Math.max(outUMax[j], a);
    }
  }
}
function normalizeGraph(A, uMax) {
  const chans = uMax.length;
  const values = A.length / chans;
  for (let i = 0; i < values; i++) {
    for (let j = 0; j < chans; j++) {
      A[i * chans + j] /= uMax[j] === 0 ? 1 : uMax[j];
      A[i * chans + j] *= 0.5;
      A[i * chans + j] += 0.5;
    }
  }
}
function divGraphFrom2Curves(curve1, curve2, outUMax) {
  const sub = subGraph(curve2, curve1);
  maxUnsignedGraphValue(sub, outUMax);
  normalizeGraph(sub, outUMax);
  return sub;
}

const particleEmitterDeviceCache = new DeviceCache();
class ParticleEmitter {
  constructor(graphicsDevice, options) {
    this.graphicsDevice = graphicsDevice;
    const gd = graphicsDevice;
    const precision = 32;
    this.precision = precision;
    this._addTimeTime = 0;

    setPropertyTarget = this;
    setPropertyOptions = options;
    setProperty('numParticles', 1);

    if (this.numParticles > graphicsDevice.maxTextureSize) {
      Debug.warn(`WARNING: can't create more than ${graphicsDevice.maxTextureSize} particles on this device.`);
      this.numParticles = graphicsDevice.maxTextureSize;
    }
    setProperty('rate', 1);
    setProperty('rate2', this.rate);
    setProperty('lifetime', 50);
    setProperty('emitterExtents', new Vec3(0, 0, 0));
    setProperty('emitterExtentsInner', new Vec3(0, 0, 0));
    setProperty('emitterRadius', 0);
    setProperty('emitterRadiusInner', 0);
    setProperty('emitterShape', EMITTERSHAPE_BOX);
    setProperty('initialVelocity', 1);
    setProperty('wrap', false);
    setProperty('localSpace', false);
    setProperty('screenSpace', false);
    setProperty('wrapBounds', null);
    setProperty('colorMap', this.defaultParamTexture);
    setProperty('normalMap', null);
    setProperty('loop', true);
    setProperty('preWarm', false);
    setProperty('sort', PARTICLESORT_NONE);
    setProperty('mode', PARTICLEMODE_GPU);
    setProperty('scene', null);
    setProperty('lighting', false);
    setProperty('halfLambert', false);
    setProperty('intensity', 1.0);
    setProperty('stretch', 0.0);
    setProperty('alignToMotion', false);
    setProperty('depthSoftening', 0);
    setProperty('mesh', null);
    setProperty('particleNormal', new Vec3(0, 1, 0));
    setProperty('orientation', PARTICLEORIENTATION_SCREEN);
    setProperty('depthWrite', false);
    setProperty('noFog', false);
    setProperty('blendType', BLEND_NORMAL);
    setProperty('node', null);
    setProperty('startAngle', 0);
    setProperty('startAngle2', this.startAngle);
    setProperty('animTilesX', 1);
    setProperty('animTilesY', 1);
    setProperty('animStartFrame', 0);
    setProperty('animNumFrames', 1);
    setProperty('animNumAnimations', 1);
    setProperty('animIndex', 0);
    setProperty('randomizeAnimIndex', false);
    setProperty('animSpeed', 1);
    setProperty('animLoop', true);
    this._gpuUpdater = new ParticleGPUUpdater(this, gd);
    this._cpuUpdater = new ParticleCPUUpdater(this);
    this.constantLightCube = gd.scope.resolve('lightCube[0]');
    this.emitterPosUniform = new Float32Array(3);
    this.wrapBoundsUniform = new Float32Array(3);
    this.emitterScaleUniform = new Float32Array([1, 1, 1]);

    setProperty('colorGraph', default1Curve3);
    setProperty('colorGraph2', this.colorGraph);
    setProperty('scaleGraph', default1Curve);
    setProperty('scaleGraph2', this.scaleGraph);
    setProperty('alphaGraph', default1Curve);
    setProperty('alphaGraph2', this.alphaGraph);
    setProperty('localVelocityGraph', default0Curve3);
    setProperty('localVelocityGraph2', this.localVelocityGraph);
    setProperty('velocityGraph', default0Curve3);
    setProperty('velocityGraph2', this.velocityGraph);
    setProperty('rotationSpeedGraph', default0Curve);
    setProperty('rotationSpeedGraph2', this.rotationSpeedGraph);
    setProperty('radialSpeedGraph', default0Curve);
    setProperty('radialSpeedGraph2', this.radialSpeedGraph);
    this.lightCube = new Float32Array(6 * 3);
    this.lightCubeDir = new Array(6);
    this.lightCubeDir[0] = new Vec3(-1, 0, 0);
    this.lightCubeDir[1] = new Vec3(1, 0, 0);
    this.lightCubeDir[2] = new Vec3(0, -1, 0);
    this.lightCubeDir[3] = new Vec3(0, 1, 0);
    this.lightCubeDir[4] = new Vec3(0, 0, -1);
    this.lightCubeDir[5] = new Vec3(0, 0, 1);
    this.animTilesParams = new Float32Array(2);
    this.animParams = new Float32Array(4);
    this.animIndexParams = new Float32Array(2);
    this.internalTex0 = null;
    this.internalTex1 = null;
    this.internalTex2 = null;
    this.colorParam = null;
    this.vbToSort = null;
    this.vbOld = null;
    this.particleDistance = null;
    this.camera = null;
    this.swapTex = false;
    this.useMesh = true;
    this.useCpu = !graphicsDevice.supportsGpuParticles;
    this.pack8 = true;
    this.localBounds = new BoundingBox();
    this.worldBoundsNoTrail = new BoundingBox();
    this.worldBoundsTrail = [new BoundingBox(), new BoundingBox()];
    this.worldBounds = new BoundingBox();
    this.worldBoundsSize = new Vec3();
    this.prevWorldBoundsSize = new Vec3();
    this.prevWorldBoundsCenter = new Vec3();
    this.prevEmitterExtents = this.emitterExtents;
    this.prevEmitterRadius = this.emitterRadius;
    this.worldBoundsMul = new Vec3();
    this.worldBoundsAdd = new Vec3();
    this.timeToSwitchBounds = 0;

    this.shaderParticleUpdateRespawn = null;
    this.shaderParticleUpdateNoRespawn = null;
    this.shaderParticleUpdateOnStop = null;
    this.numParticleVerts = 0;
    this.numParticleIndices = 0;
    this.material = null;
    this.meshInstance = null;
    this.drawOrder = 0;
    this.seed = Math.random();
    this.fixedTimeStep = 1.0 / 60;
    this.maxSubSteps = 10;
    this.simTime = 0;
    this.simTimeTotal = 0;
    this.beenReset = false;
    this._layer = null;
    this.rebuild();
  }
  get defaultParamTexture() {
    Debug.assert(this.graphicsDevice);
    return particleEmitterDeviceCache.get(this.graphicsDevice, () => {
      const resolution = 16;
      const centerPoint = resolution * 0.5 + 0.5;
      const dtex = new Float32Array(resolution * resolution * 4);
      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          const xgrad = x + 1 - centerPoint;
          const ygrad = y + 1 - centerPoint;
          const c = saturate(1 - saturate(Math.sqrt(xgrad * xgrad + ygrad * ygrad) / resolution) - 0.5);
          const p = y * resolution + x;
          dtex[p * 4] = 1;
          dtex[p * 4 + 1] = 1;
          dtex[p * 4 + 2] = 1;
          dtex[p * 4 + 3] = c;
        }
      }
      const texture = _createTexture(this.graphicsDevice, resolution, resolution, dtex, PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
      texture.minFilter = FILTER_LINEAR;
      texture.magFilter = FILTER_LINEAR;
      return texture;
    });
  }
  onChangeCamera() {
    this.regenShader();
    this.resetMaterial();
  }
  calculateBoundsMad() {
    this.worldBoundsMul.x = 1.0 / this.worldBoundsSize.x;
    this.worldBoundsMul.y = 1.0 / this.worldBoundsSize.y;
    this.worldBoundsMul.z = 1.0 / this.worldBoundsSize.z;
    this.worldBoundsAdd.copy(this.worldBounds.center).mul(this.worldBoundsMul).mulScalar(-1);
    this.worldBoundsAdd.x += 0.5;
    this.worldBoundsAdd.y += 0.5;
    this.worldBoundsAdd.z += 0.5;
  }
  calculateWorldBounds() {
    if (!this.node) return;
    this.prevWorldBoundsSize.copy(this.worldBoundsSize);
    this.prevWorldBoundsCenter.copy(this.worldBounds.center);
    if (!this.useCpu) {
      let recalculateLocalBounds = false;
      if (this.emitterShape === EMITTERSHAPE_BOX) {
        recalculateLocalBounds = !this.emitterExtents.equals(this.prevEmitterExtents);
      } else {
        recalculateLocalBounds = !(this.emitterRadius === this.prevEmitterRadius);
      }
      if (recalculateLocalBounds) {
        this.calculateLocalBounds();
      }
    }
    const nodeWT = this.node.getWorldTransform();
    if (this.localSpace) {
      this.worldBoundsNoTrail.copy(this.localBounds);
    } else {
      this.worldBoundsNoTrail.setFromTransformedAabb(this.localBounds, nodeWT);
    }
    this.worldBoundsTrail[0].add(this.worldBoundsNoTrail);
    this.worldBoundsTrail[1].add(this.worldBoundsNoTrail);
    const now = this.simTimeTotal;
    if (now >= this.timeToSwitchBounds) {
      this.worldBoundsTrail[0].copy(this.worldBoundsTrail[1]);
      this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);
      this.timeToSwitchBounds = now + this.lifetime;
    }
    this.worldBounds.copy(this.worldBoundsTrail[0]);
    this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
    if (this.localSpace) {
      this.meshInstance.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
      this.meshInstance.mesh.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
    } else {
      this.meshInstance.aabb.copy(this.worldBounds);
      this.meshInstance.mesh.aabb.copy(this.worldBounds);
    }
    this.meshInstance._aabbVer = 1 - this.meshInstance._aabbVer;
    if (this.pack8) this.calculateBoundsMad();
  }
  resetWorldBounds() {
    if (!this.node) return;
    this.worldBoundsNoTrail.setFromTransformedAabb(this.localBounds, this.localSpace ? Mat4.IDENTITY : this.node.getWorldTransform());
    this.worldBoundsTrail[0].copy(this.worldBoundsNoTrail);
    this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);
    this.worldBounds.copy(this.worldBoundsTrail[0]);
    this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
    this.prevWorldBoundsSize.copy(this.worldBoundsSize);
    this.prevWorldBoundsCenter.copy(this.worldBounds.center);
    this.simTimeTotal = 0;
    this.timeToSwitchBounds = 0;
  }
  calculateLocalBounds() {
    let minx = Number.MAX_VALUE;
    let miny = Number.MAX_VALUE;
    let minz = Number.MAX_VALUE;
    let maxx = -Number.MAX_VALUE;
    let maxy = -Number.MAX_VALUE;
    let maxz = -Number.MAX_VALUE;
    let maxR = 0;
    let maxScale = 0;
    const stepWeight = this.lifetime / this.precision;
    const wVels = [this.qVelocity, this.qVelocity2];
    const lVels = [this.qLocalVelocity, this.qLocalVelocity2];
    const accumX = [0, 0];
    const accumY = [0, 0];
    const accumZ = [0, 0];
    const accumR = [0, 0];
    const accumW = [0, 0];
    let x, y, z;
    for (let i = 0; i < this.precision + 1; i++) {
      const index = Math.min(i, this.precision - 1);
      for (let j = 0; j < 2; j++) {
        x = lVels[j][index * 3 + 0] * stepWeight + accumX[j];
        y = lVels[j][index * 3 + 1] * stepWeight + accumY[j];
        z = lVels[j][index * 3 + 2] * stepWeight + accumZ[j];
        minx = Math.min(x, minx);
        miny = Math.min(y, miny);
        minz = Math.min(z, minz);
        maxx = Math.max(x, maxx);
        maxy = Math.max(y, maxy);
        maxz = Math.max(z, maxz);
        accumX[j] = x;
        accumY[j] = y;
        accumZ[j] = z;
      }
      for (let j = 0; j < 2; j++) {
        accumW[j] += stepWeight * Math.sqrt(wVels[j][index * 3 + 0] * wVels[j][index * 3 + 0] + wVels[j][index * 3 + 1] * wVels[j][index * 3 + 1] + wVels[j][index * 3 + 2] * wVels[j][index * 3 + 2]);
      }
      accumR[0] += this.qRadialSpeed[index] * stepWeight;
      accumR[1] += this.qRadialSpeed2[index] * stepWeight;
      maxR = Math.max(maxR, Math.max(Math.abs(accumR[0]), Math.abs(accumR[1])));
      maxScale = Math.max(maxScale, this.qScale[index]);
    }
    if (this.emitterShape === EMITTERSHAPE_BOX) {
      x = this.emitterExtents.x * 0.5;
      y = this.emitterExtents.y * 0.5;
      z = this.emitterExtents.z * 0.5;
    } else {
      x = this.emitterRadius;
      y = this.emitterRadius;
      z = this.emitterRadius;
    }
    const w = Math.max(accumW[0], accumW[1]);
    bMin.x = minx - maxScale - x - maxR - w;
    bMin.y = miny - maxScale - y - maxR - w;
    bMin.z = minz - maxScale - z - maxR - w;
    bMax.x = maxx + maxScale + x + maxR + w;
    bMax.y = maxy + maxScale + y + maxR + w;
    bMax.z = maxz + maxScale + z + maxR + w;
    this.localBounds.setMinMax(bMin, bMax);
  }
  rebuild() {
    const gd = this.graphicsDevice;
    if (this.colorMap === null) this.colorMap = this.defaultParamTexture;
    this.spawnBounds = this.emitterShape === EMITTERSHAPE_BOX ? this.emitterExtents : this.emitterRadius;
    this.useCpu = this.useCpu || this.sort > PARTICLESORT_NONE ||
    gd.maxVertexTextures <= 1 ||
    gd.fragmentUniformsCount < 64 ||
    gd.forceCpuParticles || !gd.extTextureFloat;

    this._destroyResources();
    this.pack8 = (this.pack8 || !gd.textureFloatRenderable) && !this.useCpu;
    particleTexHeight = this.useCpu || this.pack8 ? 4 : 2;
    this.useMesh = false;
    if (this.mesh) {
      const totalVertCount = this.numParticles * this.mesh.vertexBuffer.numVertices;
      if (totalVertCount > 65535) {
        Debug.warn('WARNING: particle system can\'t render mesh particles because numParticles * numVertices is more than 65k. Reverting to quad particles.');
      } else {
        this.useMesh = true;
      }
    }
    this.numParticlesPot = math.nextPowerOfTwo(this.numParticles);
    this.rebuildGraphs();
    this.calculateLocalBounds();
    this.resetWorldBounds();
    if (this.node) {
      this.worldBounds.setFromTransformedAabb(this.localBounds, this.localSpace ? Mat4.IDENTITY : this.node.getWorldTransform());
      this.worldBoundsTrail[0].copy(this.worldBounds);
      this.worldBoundsTrail[1].copy(this.worldBounds);
      this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
      this.prevWorldBoundsSize.copy(this.worldBoundsSize);
      this.prevWorldBoundsCenter.copy(this.worldBounds.center);
      if (this.pack8) this.calculateBoundsMad();
    }

    this.vbToSort = new Array(this.numParticles);
    for (let iSort = 0; iSort < this.numParticles; iSort++) this.vbToSort[iSort] = [0, 0];
    this.particleDistance = new Float32Array(this.numParticles);
    this._gpuUpdater.randomize();
    this.particleTex = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
    const emitterPos = this.node === null || this.localSpace ? Vec3.ZERO : this.node.getPosition();
    if (this.emitterShape === EMITTERSHAPE_BOX) {
      if (this.node === null || this.localSpace) {
        spawnMatrix.setTRS(Vec3.ZERO, Quat.IDENTITY, this.spawnBounds);
      } else {
        spawnMatrix.setTRS(Vec3.ZERO, this.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.node.localScale));
      }
      extentsInnerRatioUniform[0] = this.emitterExtents.x !== 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
      extentsInnerRatioUniform[1] = this.emitterExtents.y !== 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
      extentsInnerRatioUniform[2] = this.emitterExtents.z !== 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
    }
    for (let i = 0; i < this.numParticles; i++) {
      this._cpuUpdater.calcSpawnPosition(this.particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, i);
      if (this.useCpu) this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = 1;
    }

    this.particleTexStart = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
    for (let i = 0; i < this.particleTexStart.length; i++) {
      this.particleTexStart[i] = this.particleTex[i];
    }
    if (!this.useCpu) {
      if (this.pack8) {
        this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_R8_G8_B8_A8, 1, false);
        this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_R8_G8_B8_A8, 1, false);
        this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart, PIXELFORMAT_R8_G8_B8_A8, 1, false);
      } else {
        this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
        this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
        this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart);
      }
      this.rtParticleTexIN = new RenderTarget({
        colorBuffer: this.particleTexIN,
        depth: false
      });
      this.rtParticleTexOUT = new RenderTarget({
        colorBuffer: this.particleTexOUT,
        depth: false
      });
      this.swapTex = false;
    }
    const shaderCodeStart = (this.localSpace ? '#define LOCAL_SPACE\n' : '') + shaderChunks.particleUpdaterInitPS + (this.pack8 ? shaderChunks.particleInputRgba8PS + shaderChunks.particleOutputRgba8PS : shaderChunks.particleInputFloatPS + shaderChunks.particleOutputFloatPS) + (this.emitterShape === EMITTERSHAPE_BOX ? shaderChunks.particleUpdaterAABBPS : shaderChunks.particleUpdaterSpherePS) + shaderChunks.particleUpdaterStartPS;
    const shaderCodeRespawn = shaderCodeStart + shaderChunks.particleUpdaterRespawnPS + shaderChunks.particleUpdaterEndPS;
    const shaderCodeNoRespawn = shaderCodeStart + shaderChunks.particleUpdaterNoRespawnPS + shaderChunks.particleUpdaterEndPS;
    const shaderCodeOnStop = shaderCodeStart + shaderChunks.particleUpdaterOnStopPS + shaderChunks.particleUpdaterEndPS;

    const params = this.emitterShape + '' + this.pack8 + '' + this.localSpace;
    this.shaderParticleUpdateRespawn = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeRespawn, 'fsQuad0' + params);
    this.shaderParticleUpdateNoRespawn = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeNoRespawn, 'fsQuad1' + params);
    this.shaderParticleUpdateOnStop = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeOnStop, 'fsQuad2' + params);
    this.numParticleVerts = this.useMesh ? this.mesh.vertexBuffer.numVertices : 4;
    this.numParticleIndices = this.useMesh ? this.mesh.indexBuffer[0].numIndices : 6;
    this._allocate(this.numParticles);
    const mesh = new Mesh(gd);
    mesh.vertexBuffer = this.vertexBuffer;
    mesh.indexBuffer[0] = this.indexBuffer;
    mesh.primitive[0].type = PRIMITIVE_TRIANGLES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = this.numParticles * this.numParticleIndices;
    mesh.primitive[0].indexed = true;
    this.material = new Material();
    this.material.name = this.node.name;
    this.material.cull = CULLFACE_NONE;
    this.material.alphaWrite = false;
    this.material.blend = true;
    this.material.blendType = this.blendType;
    this.material.depthWrite = this.depthWrite;
    this.material.emitter = this;
    this.regenShader();
    this.resetMaterial();
    const wasVisible = this.meshInstance ? this.meshInstance.visible : true;
    this.meshInstance = new MeshInstance(mesh, this.material, this.node);
    this.meshInstance.pick = false;
    this.meshInstance.updateKey();
    this.meshInstance.cull = true;
    this.meshInstance._noDepthDrawGl1 = true;
    if (this.localSpace) {
      this.meshInstance.aabb.setFromTransformedAabb(this.worldBounds, this.node.getWorldTransform());
    } else {
      this.meshInstance.aabb.copy(this.worldBounds);
    }
    this.meshInstance._updateAabb = false;
    this.meshInstance.visible = wasVisible;
    this._initializeTextures();
    this.resetTime();
    this.addTime(0, false);
    if (this.preWarm) this.prewarm(this.lifetime);
  }
  _isAnimated() {
    return this.animNumFrames >= 1 && (this.animTilesX > 1 || this.animTilesY > 1) && (this.colorMap && this.colorMap !== this.defaultParamTexture || this.normalMap);
  }
  rebuildGraphs() {
    const precision = this.precision;
    const gd = this.graphicsDevice;
    this.qLocalVelocity = this.localVelocityGraph.quantize(precision);
    this.qVelocity = this.velocityGraph.quantize(precision);
    this.qColor = this.colorGraph.quantizeClamped(precision, 0, 1);
    this.qRotSpeed = this.rotationSpeedGraph.quantize(precision);
    this.qScale = this.scaleGraph.quantize(precision);
    this.qAlpha = this.alphaGraph.quantize(precision);
    this.qRadialSpeed = this.radialSpeedGraph.quantize(precision);
    this.qLocalVelocity2 = this.localVelocityGraph2.quantize(precision);
    this.qVelocity2 = this.velocityGraph2.quantize(precision);
    this.qColor2 = this.colorGraph2.quantizeClamped(precision, 0, 1);
    this.qRotSpeed2 = this.rotationSpeedGraph2.quantize(precision);
    this.qScale2 = this.scaleGraph2.quantize(precision);
    this.qAlpha2 = this.alphaGraph2.quantize(precision);
    this.qRadialSpeed2 = this.radialSpeedGraph2.quantize(precision);
    for (let i = 0; i < precision; i++) {
      this.qRotSpeed[i] *= math.DEG_TO_RAD;
      this.qRotSpeed2[i] *= math.DEG_TO_RAD;
    }
    this.localVelocityUMax = new Float32Array(3);
    this.velocityUMax = new Float32Array(3);
    this.colorUMax = new Float32Array(3);
    this.rotSpeedUMax = [0];
    this.scaleUMax = [0];
    this.alphaUMax = [0];
    this.radialSpeedUMax = [0];
    this.qLocalVelocityDiv = divGraphFrom2Curves(this.qLocalVelocity, this.qLocalVelocity2, this.localVelocityUMax);
    this.qVelocityDiv = divGraphFrom2Curves(this.qVelocity, this.qVelocity2, this.velocityUMax);
    this.qColorDiv = divGraphFrom2Curves(this.qColor, this.qColor2, this.colorUMax);
    this.qRotSpeedDiv = divGraphFrom2Curves(this.qRotSpeed, this.qRotSpeed2, this.rotSpeedUMax);
    this.qScaleDiv = divGraphFrom2Curves(this.qScale, this.qScale2, this.scaleUMax);
    this.qAlphaDiv = divGraphFrom2Curves(this.qAlpha, this.qAlpha2, this.alphaUMax);
    this.qRadialSpeedDiv = divGraphFrom2Curves(this.qRadialSpeed, this.qRadialSpeed2, this.radialSpeedUMax);
    if (this.pack8) {
      const umax = [0, 0, 0];
      maxUnsignedGraphValue(this.qVelocity, umax);
      const umax2 = [0, 0, 0];
      maxUnsignedGraphValue(this.qVelocity2, umax2);
      const lumax = [0, 0, 0];
      maxUnsignedGraphValue(this.qLocalVelocity, lumax);
      const lumax2 = [0, 0, 0];
      maxUnsignedGraphValue(this.qLocalVelocity2, lumax2);
      const rumax = [0];
      maxUnsignedGraphValue(this.qRadialSpeed, rumax);
      const rumax2 = [0];
      maxUnsignedGraphValue(this.qRadialSpeed2, rumax2);
      let maxVel = Math.max(umax[0], umax2[0]);
      maxVel = Math.max(maxVel, umax[1]);
      maxVel = Math.max(maxVel, umax2[1]);
      maxVel = Math.max(maxVel, umax[2]);
      maxVel = Math.max(maxVel, umax2[2]);
      let lmaxVel = Math.max(lumax[0], lumax2[0]);
      lmaxVel = Math.max(lmaxVel, lumax[1]);
      lmaxVel = Math.max(lmaxVel, lumax2[1]);
      lmaxVel = Math.max(lmaxVel, lumax[2]);
      lmaxVel = Math.max(lmaxVel, lumax2[2]);
      const maxRad = Math.max(rumax[0], rumax2[0]);
      this.maxVel = maxVel + lmaxVel + maxRad;
    }
    if (!this.useCpu) {
      this.internalTex0 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qLocalVelocity, this.qLocalVelocityDiv));
      this.internalTex1 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qVelocity, this.qVelocityDiv));
      this.internalTex2 = _createTexture(gd, precision, 1, packTexture5Floats(this.qRotSpeed, this.qScale, this.qScaleDiv, this.qRotSpeedDiv, this.qAlphaDiv));
      this.internalTex3 = _createTexture(gd, precision, 1, packTexture2Floats(this.qRadialSpeed, this.qRadialSpeedDiv));
    }
    this.colorParam = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
  }
  _initializeTextures() {
    if (this.colorMap) {
      this.material.setParameter('colorMap', this.colorMap);
      if (this.lighting && this.normalMap) {
        this.material.setParameter('normalMap', this.normalMap);
      }
    }
  }
  regenShader() {
    const programLib = getProgramLibrary(this.graphicsDevice);
    programLib.register('particle', particle);
    const hasNormal = this.normalMap !== null;
    this.normalOption = 0;
    if (this.lighting) {
      this.normalOption = hasNormal ? 2 : 1;
    }
    this.material.getShaderVariant = function (dev, sc, defs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
      if (this.emitter.scene) {
        if (this.emitter.camera !== this.emitter.scene._activeCamera) {
          this.emitter.camera = this.emitter.scene._activeCamera;
          this.emitter.onChangeCamera();
        }
      }

      const inTools = this.emitter.inTools;
      const shader = programLib.getProgram('particle', {
        useCpu: this.emitter.useCpu,
        normal: this.emitter.normalOption,
        halflambert: this.emitter.halfLambert,
        stretch: this.emitter.stretch,
        alignToMotion: this.emitter.alignToMotion,
        soft: this.emitter.depthSoftening,
        mesh: this.emitter.useMesh,
        gamma: this.emitter.scene ? this.emitter.scene.gammaCorrection : 0,
        toneMap: this.emitter.scene ? this.emitter.scene.toneMapping : 0,
        fog: this.emitter.scene && !this.emitter.noFog ? this.emitter.scene.fog : 'none',
        wrap: this.emitter.wrap && this.emitter.wrapBounds,
        localSpace: this.emitter.localSpace,
        screenSpace: inTools ? false : this.emitter.screenSpace,
        blend: this.blendType,
        animTex: this.emitter._isAnimated(),
        animTexLoop: this.emitter.animLoop,
        pack8: this.emitter.pack8,
        customFace: this.emitter.orientation !== PARTICLEORIENTATION_SCREEN
      });
      return shader;
    };
    this.material.shader = this.material.getShaderVariant();
  }
  resetMaterial() {
    const material = this.material;
    material.setParameter('stretch', this.stretch);
    if (this._isAnimated()) {
      material.setParameter('animTexTilesParams', this.animTilesParams);
      material.setParameter('animTexParams', this.animParams);
      material.setParameter('animTexIndexParams', this.animIndexParams);
    }
    material.setParameter('colorMult', this.intensity);
    if (!this.useCpu) {
      material.setParameter('internalTex0', this.internalTex0);
      material.setParameter('internalTex1', this.internalTex1);
      material.setParameter('internalTex2', this.internalTex2);
      material.setParameter('internalTex3', this.internalTex3);
    }
    material.setParameter('colorParam', this.colorParam);
    material.setParameter('numParticles', this.numParticles);
    material.setParameter('numParticlesPot', this.numParticlesPot);
    material.setParameter('lifetime', this.lifetime);
    material.setParameter('rate', this.rate);
    material.setParameter('rateDiv', this.rate2 - this.rate);
    material.setParameter('seed', this.seed);
    material.setParameter('scaleDivMult', this.scaleUMax[0]);
    material.setParameter('alphaDivMult', this.alphaUMax[0]);
    material.setParameter('radialSpeedDivMult', this.radialSpeedUMax[0]);
    material.setParameter('graphNumSamples', this.precision);
    material.setParameter('graphSampleSize', 1.0 / this.precision);
    material.setParameter('emitterScale', new Float32Array([1, 1, 1]));
    if (this.pack8) {
      this._gpuUpdater._setInputBounds();
      material.setParameter('inBoundsSize', this._gpuUpdater.inBoundsSizeUniform);
      material.setParameter('inBoundsCenter', this._gpuUpdater.inBoundsCenterUniform);
      material.setParameter('maxVel', this.maxVel);
    }
    if (this.wrap && this.wrapBounds) {
      this.wrapBoundsUniform[0] = this.wrapBounds.x;
      this.wrapBoundsUniform[1] = this.wrapBounds.y;
      this.wrapBoundsUniform[2] = this.wrapBounds.z;
      material.setParameter('wrapBounds', this.wrapBoundsUniform);
    }
    if (this.colorMap) {
      material.setParameter('colorMap', this.colorMap);
    }
    if (this.lighting) {
      if (this.normalMap) {
        material.setParameter('normalMap', this.normalMap);
      }
    }
    if (this.depthSoftening > 0) {
      material.setParameter('softening', 1.0 / (this.depthSoftening * this.depthSoftening * 100));
    }

    if (this.stretch > 0.0) material.cull = CULLFACE_NONE;
    this._compParticleFaceParams();
  }
  _compParticleFaceParams() {
    let tangent, binormal;
    if (this.orientation === PARTICLEORIENTATION_SCREEN) {
      tangent = new Float32Array([1, 0, 0]);
      binormal = new Float32Array([0, 0, 1]);
    } else {
      let n;
      if (this.orientation === PARTICLEORIENTATION_WORLD) {
        n = this.particleNormal.normalize();
      } else {
        const emitterMat = this.node === null ? Mat4.IDENTITY : this.node.getWorldTransform();
        n = emitterMat.transformVector(this.particleNormal).normalize();
      }
      const t = new Vec3(1, 0, 0);
      if (Math.abs(t.dot(n)) === 1) t.set(0, 0, 1);
      const b = new Vec3().cross(n, t).normalize();
      t.cross(b, n).normalize();
      tangent = new Float32Array([t.x, t.y, t.z]);
      binormal = new Float32Array([b.x, b.y, b.z]);
    }
    this.material.setParameter('faceTangent', tangent);
    this.material.setParameter('faceBinorm', binormal);
  }

  _allocate(numParticles) {
    const psysVertCount = numParticles * this.numParticleVerts;
    const psysIndexCount = numParticles * this.numParticleIndices;
    if (this.vertexBuffer === undefined || this.vertexBuffer.getNumVertices() !== psysVertCount) {
      if (!this.useCpu) {
        const elements = [{
          semantic: SEMANTIC_ATTR0,
          components: 4,
          type: TYPE_FLOAT32
        }];
        if (this.useMesh) {
          elements.push({
            semantic: SEMANTIC_ATTR1,
            components: 2,
            type: TYPE_FLOAT32
          });
        }
        const particleFormat = new VertexFormat(this.graphicsDevice, elements);
        this.vertexBuffer = new VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, BUFFER_DYNAMIC);
        this.indexBuffer = new IndexBuffer(this.graphicsDevice, INDEXFORMAT_UINT16, psysIndexCount);
      } else {
        const elements = [{
          semantic: SEMANTIC_ATTR0,
          components: 4,
          type: TYPE_FLOAT32
        }, {
          semantic: SEMANTIC_ATTR1,
          components: 4,
          type: TYPE_FLOAT32
        }, {
          semantic: SEMANTIC_ATTR2,
          components: 4,
          type: TYPE_FLOAT32
        }, {
          semantic: SEMANTIC_ATTR3,
          components: 1,
          type: TYPE_FLOAT32
        }, {
          semantic: SEMANTIC_ATTR4,
          components: this.useMesh ? 4 : 2,
          type: TYPE_FLOAT32
        }];
        const particleFormat = new VertexFormat(this.graphicsDevice, elements);
        this.vertexBuffer = new VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, BUFFER_DYNAMIC);
        this.indexBuffer = new IndexBuffer(this.graphicsDevice, INDEXFORMAT_UINT16, psysIndexCount);
      }

      const data = new Float32Array(this.vertexBuffer.lock());
      let meshData, stride, texCoordOffset;
      if (this.useMesh) {
        meshData = new Float32Array(this.mesh.vertexBuffer.lock());
        stride = meshData.length / this.mesh.vertexBuffer.numVertices;
        for (let elem = 0; elem < this.mesh.vertexBuffer.format.elements.length; elem++) {
          if (this.mesh.vertexBuffer.format.elements[elem].name === SEMANTIC_TEXCOORD0) {
            texCoordOffset = this.mesh.vertexBuffer.format.elements[elem].offset / 4;
            break;
          }
        }
      }
      for (let i = 0; i < psysVertCount; i++) {
        const id = Math.floor(i / this.numParticleVerts);
        if (!this.useMesh) {
          const vertID = i % 4;
          data[i * 4] = particleVerts[vertID][0];
          data[i * 4 + 1] = particleVerts[vertID][1];
          data[i * 4 + 2] = 0;
          data[i * 4 + 3] = id;
        } else {
          const vert = i % this.numParticleVerts;
          data[i * 6] = meshData[vert * stride];
          data[i * 6 + 1] = meshData[vert * stride + 1];
          data[i * 6 + 2] = meshData[vert * stride + 2];
          data[i * 6 + 3] = id;
          data[i * 6 + 4] = meshData[vert * stride + texCoordOffset + 0];
          data[i * 6 + 5] = 1.0 - meshData[vert * stride + texCoordOffset + 1];
        }
      }
      if (this.useCpu) {
        this.vbCPU = new Float32Array(data);
        this.vbOld = new Float32Array(this.vbCPU.length);
      }
      this.vertexBuffer.unlock();
      if (this.useMesh) {
        this.mesh.vertexBuffer.unlock();
      }

      let dst = 0;
      const indices = new Uint16Array(this.indexBuffer.lock());
      if (this.useMesh) meshData = new Uint16Array(this.mesh.indexBuffer[0].lock());
      for (let i = 0; i < numParticles; i++) {
        if (!this.useMesh) {
          const baseIndex = i * 4;
          indices[dst++] = baseIndex;
          indices[dst++] = baseIndex + 1;
          indices[dst++] = baseIndex + 2;
          indices[dst++] = baseIndex;
          indices[dst++] = baseIndex + 2;
          indices[dst++] = baseIndex + 3;
        } else {
          for (let j = 0; j < this.numParticleIndices; j++) {
            indices[i * this.numParticleIndices + j] = meshData[j] + i * this.numParticleVerts;
          }
        }
      }
      this.indexBuffer.unlock();
      if (this.useMesh) this.mesh.indexBuffer[0].unlock();
    }
  }
  reset() {
    this.beenReset = true;
    this.seed = Math.random();
    this.material.setParameter('seed', this.seed);
    if (this.useCpu) {
      for (let i = 0; i < this.particleTexStart.length; i++) {
        this.particleTex[i] = this.particleTexStart[i];
      }
    } else {
      this._initializeTextures();
    }
    this.resetWorldBounds();
    this.resetTime();
    const origLoop = this.loop;
    this.loop = true;
    this.addTime(0, false);
    this.loop = origLoop;
    if (this.preWarm) {
      this.prewarm(this.lifetime);
    }
  }
  prewarm(time) {
    const lifetimeFraction = time / this.lifetime;
    const iterations = Math.min(Math.floor(lifetimeFraction * this.precision), this.precision);
    const stepDelta = time / iterations;
    for (let i = 0; i < iterations; i++) {
      this.addTime(stepDelta, false);
    }
  }
  resetTime() {
    this.endTime = calcEndTime(this);
  }
  finishFrame() {
    if (this.useCpu) this.vertexBuffer.unlock();
  }
  addTime(delta, isOnStop) {
    const device = this.graphicsDevice;
    const startTime = now();
    this.simTimeTotal += delta;
    this.calculateWorldBounds();
    if (this._isAnimated()) {
      const tilesParams = this.animTilesParams;
      tilesParams[0] = 1.0 / this.animTilesX;
      tilesParams[1] = 1.0 / this.animTilesY;

      const params = this.animParams;
      params[0] = this.animStartFrame;
      params[1] = this.animNumFrames * this.animSpeed;
      params[2] = this.animNumFrames - 1;
      params[3] = this.animNumAnimations - 1;

      const animIndexParams = this.animIndexParams;
      animIndexParams[0] = this.animIndex;
      animIndexParams[1] = this.randomizeAnimIndex;
    }

    if (this.scene) {
      if (this.camera !== this.scene._activeCamera) {
        this.camera = this.scene._activeCamera;
        this.onChangeCamera();
      }
    }
    if (this.emitterShape === EMITTERSHAPE_BOX) {
      extentsInnerRatioUniform[0] = this.emitterExtents.x !== 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
      extentsInnerRatioUniform[1] = this.emitterExtents.y !== 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
      extentsInnerRatioUniform[2] = this.emitterExtents.z !== 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
      if (this.meshInstance.node === null) {
        spawnMatrix.setTRS(Vec3.ZERO, Quat.IDENTITY, this.emitterExtents);
      } else {
        spawnMatrix.setTRS(Vec3.ZERO, this.meshInstance.node.getRotation(), tmpVec3.copy(this.emitterExtents).mul(this.meshInstance.node.localScale));
      }
    }
    let emitterPos;
    const emitterScale = this.meshInstance.node === null ? Vec3.ONE : this.meshInstance.node.localScale;
    this.emitterScaleUniform[0] = emitterScale.x;
    this.emitterScaleUniform[1] = emitterScale.y;
    this.emitterScaleUniform[2] = emitterScale.z;
    this.material.setParameter('emitterScale', this.emitterScaleUniform);
    if (this.localSpace && this.meshInstance.node) {
      emitterPos = this.meshInstance.node.getPosition();
      this.emitterPosUniform[0] = emitterPos.x;
      this.emitterPosUniform[1] = emitterPos.y;
      this.emitterPosUniform[2] = emitterPos.z;
      this.material.setParameter('emitterPos', this.emitterPosUniform);
    }
    this._compParticleFaceParams();
    if (!this.useCpu) {
      this._gpuUpdater.update(device, spawnMatrix, extentsInnerRatioUniform, delta, isOnStop);
    } else {
      const data = new Float32Array(this.vertexBuffer.lock());
      this._cpuUpdater.update(data, this.vbToSort, this.particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, delta, isOnStop);
    }

    if (!this.loop) {
      if (Date.now() > this.endTime) {
        if (this.onFinished) this.onFinished();
        this.meshInstance.visible = false;
      }
    }
    if (this.meshInstance) {
      this.meshInstance.drawOrder = this.drawOrder;
    }
    this._addTimeTime += now() - startTime;
  }
  _destroyResources() {
    if (this.particleTexIN) {
      this.particleTexIN.destroy();
      this.particleTexIN = null;
    }
    if (this.particleTexOUT) {
      this.particleTexOUT.destroy();
      this.particleTexOUT = null;
    }
    if (this.particleTexStart && this.particleTexStart.destroy) {
      this.particleTexStart.destroy();
      this.particleTexStart = null;
    }
    if (this.rtParticleTexIN) {
      this.rtParticleTexIN.destroy();
      this.rtParticleTexIN = null;
    }
    if (this.rtParticleTexOUT) {
      this.rtParticleTexOUT.destroy();
      this.rtParticleTexOUT = null;
    }
    if (this.internalTex0) {
      this.internalTex0.destroy();
      this.internalTex0 = null;
    }
    if (this.internalTex1) {
      this.internalTex1.destroy();
      this.internalTex1 = null;
    }
    if (this.internalTex2) {
      this.internalTex2.destroy();
      this.internalTex2 = null;
    }
    if (this.internalTex3) {
      this.internalTex3.destroy();
      this.internalTex3 = null;
    }
    if (this.colorParam) {
      this.colorParam.destroy();
      this.colorParam = null;
    }
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = undefined;
    }

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
      this.indexBuffer = undefined;
    }
    if (this.material) {
      this.material.destroy();
      this.material = null;
    }

  }

  destroy() {
    this.camera = null;
    this._destroyResources();
  }
}

export { ParticleEmitter };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUtZW1pdHRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHsgQ3VydmUgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUuanMnO1xuaW1wb3J0IHsgQ3VydmVTZXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQlVGRkVSX0RZTkFNSUMsXG4gICAgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVCxcbiAgICBJTkRFWEZPUk1BVF9VSU5UMTYsXG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsIFBJWEVMRk9STUFUX1JHQkEzMkYsXG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMywgU0VNQU5USUNfQVRUUjQsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi4vLi4vc2NlbmUvc2hhZGVyLWxpYi91dGlscy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgSW5kZXhCdWZmZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgRGV2aWNlQ2FjaGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXZpY2UtY2FjaGUuanMnO1xuaW1wb3J0IHsgcGFydGljbGUgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3BhcnRpY2xlLmpzJztcbmltcG9ydCB7IGdldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9OT1JNQUwsXG4gICAgRU1JVFRFUlNIQVBFX0JPWCxcbiAgICBQQVJUSUNMRU1PREVfR1BVLFxuICAgIFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOLCBQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxELFxuICAgIFBBUlRJQ0xFU09SVF9OT05FXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcblxuaW1wb3J0IHsgUGFydGljbGVDUFVVcGRhdGVyIH0gZnJvbSAnLi9jcHUtdXBkYXRlci5qcyc7XG5pbXBvcnQgeyBQYXJ0aWNsZUdQVVVwZGF0ZXIgfSBmcm9tICcuL2dwdS11cGRhdGVyLmpzJztcblxuY29uc3QgcGFydGljbGVWZXJ0cyA9IFtcbiAgICBbLTEsIC0xXSxcbiAgICBbMSwgLTFdLFxuICAgIFsxLCAxXSxcbiAgICBbLTEsIDFdXG5dO1xuXG5mdW5jdGlvbiBfY3JlYXRlVGV4dHVyZShkZXZpY2UsIHdpZHRoLCBoZWlnaHQsIHBpeGVsRGF0YSwgZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTMyRiwgbXVsdDhCaXQsIGZpbHRlcikge1xuXG4gICAgbGV0IG1pcEZpbHRlciA9IEZJTFRFUl9ORUFSRVNUO1xuICAgIGlmIChmaWx0ZXIgJiYgZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOClcbiAgICAgICAgbWlwRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcblxuICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgIGN1YmVtYXA6IGZhbHNlLFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBtaXBGaWx0ZXIsXG4gICAgICAgIG1hZ0ZpbHRlcjogbWlwRmlsdGVyLFxuICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICBuYW1lOiAnUGFydGljbGVTeXN0ZW1UZXh0dXJlJ1xuICAgIH0pO1xuXG4gICAgY29uc3QgcGl4ZWxzID0gdGV4dHVyZS5sb2NrKCk7XG5cbiAgICBpZiAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCkge1xuICAgICAgICBjb25zdCB0ZW1wID0gbmV3IFVpbnQ4QXJyYXkocGl4ZWxEYXRhLmxlbmd0aCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGl4ZWxEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0ZW1wW2ldID0gcGl4ZWxEYXRhW2ldICogbXVsdDhCaXQgKiAyNTU7XG4gICAgICAgIH1cbiAgICAgICAgcGl4ZWxEYXRhID0gdGVtcDtcbiAgICB9XG5cbiAgICBwaXhlbHMuc2V0KHBpeGVsRGF0YSk7XG5cbiAgICB0ZXh0dXJlLnVubG9jaygpO1xuXG4gICAgcmV0dXJuIHRleHR1cmU7XG59XG5cbmZ1bmN0aW9uIHNhdHVyYXRlKHgpIHtcbiAgICByZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4oeCwgMSksIDApO1xufVxuXG5jb25zdCBkZWZhdWx0MEN1cnZlID0gbmV3IEN1cnZlKFswLCAwLCAxLCAwXSk7XG5jb25zdCBkZWZhdWx0MUN1cnZlID0gbmV3IEN1cnZlKFswLCAxLCAxLCAxXSk7XG5jb25zdCBkZWZhdWx0MEN1cnZlMyA9IG5ldyBDdXJ2ZVNldChbMCwgMCwgMSwgMF0sIFswLCAwLCAxLCAwXSwgWzAsIDAsIDEsIDBdKTtcbmNvbnN0IGRlZmF1bHQxQ3VydmUzID0gbmV3IEN1cnZlU2V0KFswLCAxLCAxLCAxXSwgWzAsIDEsIDEsIDFdLCBbMCwgMSwgMSwgMV0pO1xuXG5sZXQgcGFydGljbGVUZXhIZWlnaHQgPSAyO1xuY29uc3QgcGFydGljbGVUZXhDaGFubmVscyA9IDQ7IC8vIHRoZXJlIGlzIGEgZHVwbGljYXRlIGluIGNwdSB1cGRhdGVyXG5cbmNvbnN0IGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5jb25zdCBzcGF3bk1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbmNvbnN0IHRtcFZlYzMgPSBuZXcgVmVjMygpO1xuY29uc3QgYk1pbiA9IG5ldyBWZWMzKCk7XG5jb25zdCBiTWF4ID0gbmV3IFZlYzMoKTtcblxubGV0IHNldFByb3BlcnR5VGFyZ2V0O1xubGV0IHNldFByb3BlcnR5T3B0aW9ucztcblxuZnVuY3Rpb24gc2V0UHJvcGVydHkocE5hbWUsIGRlZmF1bHRWYWwpIHtcbiAgICBpZiAoc2V0UHJvcGVydHlPcHRpb25zW3BOYW1lXSAhPT0gdW5kZWZpbmVkICYmIHNldFByb3BlcnR5T3B0aW9uc1twTmFtZV0gIT09IG51bGwpIHtcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXRbcE5hbWVdID0gc2V0UHJvcGVydHlPcHRpb25zW3BOYW1lXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXRQcm9wZXJ0eVRhcmdldFtwTmFtZV0gPSBkZWZhdWx0VmFsO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFjazNORmxvYXRzKGEsIGIsIGMpIHtcbiAgICBjb25zdCBwYWNrZWQgPSAoKGEgKiAyNTUpIDw8IDE2KSB8ICgoYiAqIDI1NSkgPDwgOCkgfCAoYyAqIDI1NSk7XG4gICAgcmV0dXJuIChwYWNrZWQpIC8gKDEgPDwgMjQpO1xufVxuXG5mdW5jdGlvbiBwYWNrVGV4dHVyZVhZWl9OWFlaKHFYWVosIHFYWVoyKSB7XG4gICAgY29uc3QgbnVtID0gcVhZWi5sZW5ndGggLyAzO1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShudW0gKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxWFlaW2kgKiAzXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxWFlaW2kgKiAzICsgMV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gcVhZWltpICogMyArIDJdO1xuXG4gICAgICAgIGNvbG9yc1tpICogNCArIDNdID0gcGFjazNORmxvYXRzKHFYWVoyW2kgKiAzXSwgcVhZWjJbaSAqIDMgKyAxXSwgcVhZWjJbaSAqIDMgKyAyXSk7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlUkdCQShxUkdCLCBxQSkge1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShxQS5sZW5ndGggKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHFBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxUkdCW2kgKiAzXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxUkdCW2kgKiAzICsgMV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gcVJHQltpICogMyArIDJdO1xuXG4gICAgICAgIGNvbG9yc1tpICogNCArIDNdID0gcUFbaV07XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlNUZsb2F0cyhxQSwgcUIsIHFDLCBxRCwgcUUpIHtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkocUEubGVuZ3RoICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxQS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcUFbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcUJbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gMDtcblxuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IHBhY2szTkZsb2F0cyhxQ1tpXSwgcURbaV0sIHFFW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbG9ycztcbn1cblxuZnVuY3Rpb24gcGFja1RleHR1cmUyRmxvYXRzKHFBLCBxQikge1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShxQS5sZW5ndGggKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHFBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxQVtpXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxQltpXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMl0gPSAwO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIGNhbGNFbmRUaW1lKGVtaXR0ZXIpIHtcbiAgICBjb25zdCBpbnRlcnZhbCA9IChNYXRoLm1heChlbWl0dGVyLnJhdGUsIGVtaXR0ZXIucmF0ZTIpICogZW1pdHRlci5udW1QYXJ0aWNsZXMgKyBlbWl0dGVyLmxpZmV0aW1lKTtcbiAgICByZXR1cm4gRGF0ZS5ub3coKSArIGludGVydmFsICogMTAwMDtcbn1cblxuZnVuY3Rpb24gc3ViR3JhcGgoQSwgQikge1xuICAgIGNvbnN0IHIgPSBuZXcgRmxvYXQzMkFycmF5KEEubGVuZ3RoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IEEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcltpXSA9IEFbaV0gLSBCW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcjtcbn1cblxuZnVuY3Rpb24gbWF4VW5zaWduZWRHcmFwaFZhbHVlKEEsIG91dFVNYXgpIHtcbiAgICBjb25zdCBjaGFucyA9IG91dFVNYXgubGVuZ3RoO1xuICAgIGNvbnN0IHZhbHVlcyA9IEEubGVuZ3RoIC8gY2hhbnM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXM7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNoYW5zOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGEgPSBNYXRoLmFicyhBW2kgKiBjaGFucyArIGpdKTtcbiAgICAgICAgICAgIG91dFVNYXhbal0gPSBNYXRoLm1heChvdXRVTWF4W2pdLCBhKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplR3JhcGgoQSwgdU1heCkge1xuICAgIGNvbnN0IGNoYW5zID0gdU1heC5sZW5ndGg7XG4gICAgY29uc3QgdmFsdWVzID0gQS5sZW5ndGggLyBjaGFucztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlczsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY2hhbnM7IGorKykge1xuICAgICAgICAgICAgQVtpICogY2hhbnMgKyBqXSAvPSAodU1heFtqXSA9PT0gMCA/IDEgOiB1TWF4W2pdKTtcbiAgICAgICAgICAgIEFbaSAqIGNoYW5zICsgal0gKj0gMC41O1xuICAgICAgICAgICAgQVtpICogY2hhbnMgKyBqXSArPSAwLjU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpdkdyYXBoRnJvbTJDdXJ2ZXMoY3VydmUxLCBjdXJ2ZTIsIG91dFVNYXgpIHtcbiAgICBjb25zdCBzdWIgPSBzdWJHcmFwaChjdXJ2ZTIsIGN1cnZlMSk7XG4gICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHN1Yiwgb3V0VU1heCk7XG4gICAgbm9ybWFsaXplR3JhcGgoc3ViLCBvdXRVTWF4KTtcbiAgICByZXR1cm4gc3ViO1xufVxuXG4vLyBhIGRldmljZSBjYWNoZSBzdG9yaW5nIGRlZmF1bHQgcGFyYW1ldGVyIHRleHR1cmUgZm9yIHRoZSBlbWl0dGVyXG5jb25zdCBwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jbGFzcyBQYXJ0aWNsZUVtaXR0ZXIge1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgZ2QgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgcHJlY2lzaW9uID0gMzI7XG4gICAgICAgIHRoaXMucHJlY2lzaW9uID0gcHJlY2lzaW9uO1xuXG4gICAgICAgIHRoaXMuX2FkZFRpbWVUaW1lID0gMDtcblxuICAgICAgICAvLyBHbG9iYWwgc3lzdGVtIHBhcmFtZXRlcnNcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXQgPSB0aGlzO1xuICAgICAgICBzZXRQcm9wZXJ0eU9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbnVtUGFydGljbGVzJywgMSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbW91bnQgb2YgcGFydGljbGVzIGFsbG9jYXRlZCAobWF4IHBhcnRpY2xlcyA9IG1heCBHTCB0ZXh0dXJlIHdpZHRoIGF0IHRoaXMgbW9tZW50KVxuXG4gICAgICAgIGlmICh0aGlzLm51bVBhcnRpY2xlcyA+IGdyYXBoaWNzRGV2aWNlLm1heFRleHR1cmVTaXplKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBXQVJOSU5HOiBjYW4ndCBjcmVhdGUgbW9yZSB0aGFuICR7Z3JhcGhpY3NEZXZpY2UubWF4VGV4dHVyZVNpemV9IHBhcnRpY2xlcyBvbiB0aGlzIGRldmljZS5gKTtcbiAgICAgICAgICAgIHRoaXMubnVtUGFydGljbGVzID0gZ3JhcGhpY3NEZXZpY2UubWF4VGV4dHVyZVNpemU7XG4gICAgICAgIH1cblxuICAgICAgICBzZXRQcm9wZXJ0eSgncmF0ZScsIDEpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBFbWlzc2lvbiByYXRlXG4gICAgICAgIHNldFByb3BlcnR5KCdyYXRlMicsIHRoaXMucmF0ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsaWZldGltZScsIDUwKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhcnRpY2xlIGxpZmV0aW1lXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyRXh0ZW50cycsIG5ldyBWZWMzKDAsIDAsIDApKTsgICAgICAgIC8vIFNwYXduIHBvaW50IGRpdmVyZ2VuY2VcbiAgICAgICAgc2V0UHJvcGVydHkoJ2VtaXR0ZXJFeHRlbnRzSW5uZXInLCBuZXcgVmVjMygwLCAwLCAwKSk7ICAgLy8gVm9sdW1lIGluc2lkZSBlbWl0dGVyRXh0ZW50cyB0byBleGNsdWRlIGZyb20gcmVnZW5lcmF0aW9uXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyUmFkaXVzJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyUmFkaXVzSW5uZXInLCAwKTsgICAgICAgICAgICAgICAgICAgICAgIC8vIFNhbWUgYXMgRXh0ZW50c0lubmVyIGJ1dCBmb3Igc3BoZXJpY2FsIHZvbHVtZVxuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlclNoYXBlJywgRU1JVFRFUlNIQVBFX0JPWCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdpbml0aWFsVmVsb2NpdHknLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3dyYXAnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFNwYWNlJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc2NyZWVuU3BhY2UnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCd3cmFwQm91bmRzJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvck1hcCcsIHRoaXMuZGVmYXVsdFBhcmFtVGV4dHVyZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub3JtYWxNYXAnLCBudWxsKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2xvb3AnLCB0cnVlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3ByZVdhcm0nLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzb3J0JywgUEFSVElDTEVTT1JUX05PTkUpOyAvLyBTb3J0aW5nIG1vZGU6IDAgPSBub25lLCAxID0gYnkgZGlzdGFuY2UsIDIgPSBieSBsaWZlLCAzID0gYnkgLWxpZmU7ICBGb3JjZXMgQ1BVIG1vZGUgaWYgbm90IDBcbiAgICAgICAgc2V0UHJvcGVydHkoJ21vZGUnLCBQQVJUSUNMRU1PREVfR1BVKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjZW5lJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsaWdodGluZycsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2hhbGZMYW1iZXJ0JywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnaW50ZW5zaXR5JywgMS4wKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3N0cmV0Y2gnLCAwLjApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxpZ25Ub01vdGlvbicsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2RlcHRoU29mdGVuaW5nJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdtZXNoJywgbnVsbCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWVzaCB0byBiZSB1c2VkIGFzIHBhcnRpY2xlLiBWZXJ0ZXggYnVmZmVyIGlzIHN1cHBvc2VkIHRvIGhvbGQgdmVydGV4IHBvc2l0aW9uIGluIGZpcnN0IDMgZmxvYXRzIG9mIGVhY2ggdmVydGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGVhdmUgdW5kZWZpbmVkIHRvIHVzZSBzaW1wbGUgcXVhZHNcbiAgICAgICAgc2V0UHJvcGVydHkoJ3BhcnRpY2xlTm9ybWFsJywgbmV3IFZlYzMoMCwgMSwgMCkpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnb3JpZW50YXRpb24nLCBQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTik7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2RlcHRoV3JpdGUnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub0ZvZycsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2JsZW5kVHlwZScsIEJMRU5EX05PUk1BTCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub2RlJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdGFydEFuZ2xlJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdGFydEFuZ2xlMicsIHRoaXMuc3RhcnRBbmdsZSk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1UaWxlc1gnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1UaWxlc1knLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1TdGFydEZyYW1lJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTnVtRnJhbWVzJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTnVtQW5pbWF0aW9ucycsIDEpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbUluZGV4JywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdyYW5kb21pemVBbmltSW5kZXgnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltU3BlZWQnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1Mb29wJywgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5fZ3B1VXBkYXRlciA9IG5ldyBQYXJ0aWNsZUdQVVVwZGF0ZXIodGhpcywgZ2QpO1xuICAgICAgICB0aGlzLl9jcHVVcGRhdGVyID0gbmV3IFBhcnRpY2xlQ1BVVXBkYXRlcih0aGlzKTtcblxuICAgICAgICB0aGlzLmNvbnN0YW50TGlnaHRDdWJlID0gZ2Quc2NvcGUucmVzb2x2ZSgnbGlnaHRDdWJlWzBdJyk7XG4gICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pO1xuXG4gICAgICAgIC8vIFRpbWUtZGVwZW5kZW50IHBhcmFtZXRlcnNcbiAgICAgICAgc2V0UHJvcGVydHkoJ2NvbG9yR3JhcGgnLCBkZWZhdWx0MUN1cnZlMyk7XG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvckdyYXBoMicsIHRoaXMuY29sb3JHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjYWxlR3JhcGgnLCBkZWZhdWx0MUN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjYWxlR3JhcGgyJywgdGhpcy5zY2FsZUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxwaGFHcmFwaCcsIGRlZmF1bHQxQ3VydmUpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxwaGFHcmFwaDInLCB0aGlzLmFscGhhR3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFZlbG9jaXR5R3JhcGgnLCBkZWZhdWx0MEN1cnZlMyk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFZlbG9jaXR5R3JhcGgyJywgdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCd2ZWxvY2l0eUdyYXBoJywgZGVmYXVsdDBDdXJ2ZTMpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgndmVsb2NpdHlHcmFwaDInLCB0aGlzLnZlbG9jaXR5R3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdyb3RhdGlvblNwZWVkR3JhcGgnLCBkZWZhdWx0MEN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3JvdGF0aW9uU3BlZWRHcmFwaDInLCB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhZGlhbFNwZWVkR3JhcGgnLCBkZWZhdWx0MEN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhZGlhbFNwZWVkR3JhcGgyJywgdGhpcy5yYWRpYWxTcGVlZEdyYXBoKTtcblxuICAgICAgICB0aGlzLmxpZ2h0Q3ViZSA9IG5ldyBGbG9hdDMyQXJyYXkoNiAqIDMpO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpciA9IG5ldyBBcnJheSg2KTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbMF0gPSBuZXcgVmVjMygtMSwgMCwgMCk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzFdID0gbmV3IFZlYzMoMSwgMCwgMCk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzJdID0gbmV3IFZlYzMoMCwgLTEsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpclszXSA9IG5ldyBWZWMzKDAsIDEsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpcls0XSA9IG5ldyBWZWMzKDAsIDAsIC0xKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbNV0gPSBuZXcgVmVjMygwLCAwLCAxKTtcblxuICAgICAgICB0aGlzLmFuaW1UaWxlc1BhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuYW5pbVBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuYW5pbUluZGV4UGFyYW1zID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuICAgICAgICB0aGlzLmludGVybmFsVGV4MCA9IG51bGw7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbG9yUGFyYW0gPSBudWxsO1xuXG4gICAgICAgIHRoaXMudmJUb1NvcnQgPSBudWxsO1xuICAgICAgICB0aGlzLnZiT2xkID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJ0aWNsZURpc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNhbWVyYSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zd2FwVGV4ID0gZmFsc2U7XG4gICAgICAgIHRoaXMudXNlTWVzaCA9IHRydWU7XG4gICAgICAgIHRoaXMudXNlQ3B1ID0gIWdyYXBoaWNzRGV2aWNlLnN1cHBvcnRzR3B1UGFydGljbGVzO1xuXG4gICAgICAgIHRoaXMucGFjazggPSB0cnVlO1xuICAgICAgICB0aGlzLmxvY2FsQm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbCA9IFtuZXcgQm91bmRpbmdCb3goKSwgbmV3IEJvdW5kaW5nQm94KCldO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1NpemUgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzU2l6ZSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5wcmV2RW1pdHRlckV4dGVudHMgPSB0aGlzLmVtaXR0ZXJFeHRlbnRzO1xuICAgICAgICB0aGlzLnByZXZFbWl0dGVyUmFkaXVzID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMudGltZVRvU3dpdGNoQm91bmRzID0gMDtcbiAgICAgICAgLy8gdGhpcy5wcmV2UG9zID0gbmV3IFZlYzMoKTtcblxuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlUmVzcGF3biA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZGVyUGFydGljbGVVcGRhdGVOb1Jlc3Bhd24gPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wID0gbnVsbDtcblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlVmVydHMgPSAwO1xuICAgICAgICB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyA9IDA7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIHRoaXMuc2VlZCA9IE1hdGgucmFuZG9tKCk7XG5cbiAgICAgICAgdGhpcy5maXhlZFRpbWVTdGVwID0gMS4wIC8gNjA7XG4gICAgICAgIHRoaXMubWF4U3ViU3RlcHMgPSAxMDtcbiAgICAgICAgdGhpcy5zaW1UaW1lID0gMDtcbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgPSAwO1xuXG4gICAgICAgIHRoaXMuYmVlblJlc2V0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVidWlsZCgpO1xuICAgIH1cblxuICAgIGdldCBkZWZhdWx0UGFyYW1UZXh0dXJlKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5ncmFwaGljc0RldmljZSk7XG4gICAgICAgIHJldHVybiBwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZS5nZXQodGhpcy5ncmFwaGljc0RldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IDE2O1xuICAgICAgICAgICAgY29uc3QgY2VudGVyUG9pbnQgPSByZXNvbHV0aW9uICogMC41ICsgMC41O1xuICAgICAgICAgICAgY29uc3QgZHRleCA9IG5ldyBGbG9hdDMyQXJyYXkocmVzb2x1dGlvbiAqIHJlc29sdXRpb24gKiA0KTtcbiAgICAgICAgICAgIGZvciAobGV0IHkgPSAwOyB5IDwgcmVzb2x1dGlvbjsgeSsrKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCByZXNvbHV0aW9uOyB4KyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeGdyYWQgPSAoeCArIDEpIC0gY2VudGVyUG9pbnQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHlncmFkID0gKHkgKyAxKSAtIGNlbnRlclBvaW50O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjID0gc2F0dXJhdGUoKDEgLSBzYXR1cmF0ZShNYXRoLnNxcnQoeGdyYWQgKiB4Z3JhZCArIHlncmFkICogeWdyYWQpIC8gcmVzb2x1dGlvbikpIC0gMC41KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcCA9IHkgKiByZXNvbHV0aW9uICsgeDtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNF0gPSAgICAgMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDFdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDJdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDNdID0gYztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSBfY3JlYXRlVGV4dHVyZSh0aGlzLmdyYXBoaWNzRGV2aWNlLCByZXNvbHV0aW9uLCByZXNvbHV0aW9uLCBkdGV4LCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgMS4wLCB0cnVlKTtcbiAgICAgICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgIHRleHR1cmUubWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBvbkNoYW5nZUNhbWVyYSgpIHtcbiAgICAgICAgdGhpcy5yZWdlblNoYWRlcigpO1xuICAgICAgICB0aGlzLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVCb3VuZHNNYWQoKSB7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueCA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLng7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueSA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLnk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueiA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLno7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKS5tdWwodGhpcy53b3JsZEJvdW5kc011bCkubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC54ICs9IDAuNTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC55ICs9IDAuNTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC56ICs9IDAuNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVXb3JsZEJvdW5kcygpIHtcbiAgICAgICAgaWYgKCF0aGlzLm5vZGUpIHJldHVybjtcblxuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyLmNvcHkodGhpcy53b3JsZEJvdW5kcy5jZW50ZXIpO1xuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGxldCByZWNhbGN1bGF0ZUxvY2FsQm91bmRzID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgICAgICByZWNhbGN1bGF0ZUxvY2FsQm91bmRzID0gIXRoaXMuZW1pdHRlckV4dGVudHMuZXF1YWxzKHRoaXMucHJldkVtaXR0ZXJFeHRlbnRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVjYWxjdWxhdGVMb2NhbEJvdW5kcyA9ICEodGhpcy5lbWl0dGVyUmFkaXVzID09PSB0aGlzLnByZXZFbWl0dGVyUmFkaXVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZWNhbGN1bGF0ZUxvY2FsQm91bmRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxjdWxhdGVMb2NhbEJvdW5kcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBjb25zdCBub2RlV1QgPSB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgaWYgKHRoaXMubG9jYWxTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc05vVHJhaWwuY29weSh0aGlzLmxvY2FsQm91bmRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy5sb2NhbEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5hZGQodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uYWRkKHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcblxuICAgICAgICBjb25zdCBub3cgPSB0aGlzLnNpbVRpbWVUb3RhbDtcbiAgICAgICAgaWYgKG5vdyA+PSB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcykge1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdKTtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFsxXS5jb3B5KHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcbiAgICAgICAgICAgIHRoaXMudGltZVRvU3dpdGNoQm91bmRzID0gbm93ICsgdGhpcy5saWZldGltZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHMuY29weSh0aGlzLndvcmxkQm91bmRzVHJhaWxbMF0pO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuXG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYih0aGlzLndvcmxkQm91bmRzLCBub2RlV1QpO1xuICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UubWVzaC5hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy53b3JsZEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuY29weSh0aGlzLndvcmxkQm91bmRzKTtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm1lc2guYWFiYi5jb3B5KHRoaXMud29ybGRCb3VuZHMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyID0gMSAtIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyO1xuXG4gICAgICAgIGlmICh0aGlzLnBhY2s4KSB0aGlzLmNhbGN1bGF0ZUJvdW5kc01hZCgpO1xuICAgIH1cblxuICAgIHJlc2V0V29ybGRCb3VuZHMoKSB7XG4gICAgICAgIGlmICghdGhpcy5ub2RlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc05vVHJhaWwuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihcbiAgICAgICAgICAgIHRoaXMubG9jYWxCb3VuZHMsIHRoaXMubG9jYWxTcGFjZSA/IE1hdDQuSURFTlRJVFkgOiB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzTm9UcmFpbCk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kcy5jb3B5KHRoaXMud29ybGRCb3VuZHNUcmFpbFswXSk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuXG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzU2l6ZS5jb3B5KHRoaXMud29ybGRCb3VuZHNTaXplKTtcbiAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNDZW50ZXIuY29weSh0aGlzLndvcmxkQm91bmRzLmNlbnRlcik7XG5cbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgPSAwO1xuICAgICAgICB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcyA9IDA7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTG9jYWxCb3VuZHMoKSB7XG4gICAgICAgIGxldCBtaW54ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgbGV0IG1pbnkgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWlueiA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh4ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh5ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh6ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXhSID0gMDtcbiAgICAgICAgbGV0IG1heFNjYWxlID0gMDtcbiAgICAgICAgY29uc3Qgc3RlcFdlaWdodCA9IHRoaXMubGlmZXRpbWUgLyB0aGlzLnByZWNpc2lvbjtcbiAgICAgICAgY29uc3Qgd1ZlbHMgPSBbdGhpcy5xVmVsb2NpdHksIHRoaXMucVZlbG9jaXR5Ml07XG4gICAgICAgIGNvbnN0IGxWZWxzID0gW3RoaXMucUxvY2FsVmVsb2NpdHksIHRoaXMucUxvY2FsVmVsb2NpdHkyXTtcbiAgICAgICAgY29uc3QgYWNjdW1YID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVkgPSBbMCwgMF07XG4gICAgICAgIGNvbnN0IGFjY3VtWiA9IFswLCAwXTtcbiAgICAgICAgY29uc3QgYWNjdW1SID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVcgPSBbMCwgMF07XG4gICAgICAgIGxldCB4LCB5LCB6O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucHJlY2lzaW9uICsgMTsgaSsrKSB7IC8vIHRha2UgZXh0cmEgc3RlcCB0byBwcmV2ZW50IHBvc2l0aW9uIGdsaXRjaGVzXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IE1hdGgubWluKGksIHRoaXMucHJlY2lzaW9uIC0gMSk7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDI7IGorKykge1xuICAgICAgICAgICAgICAgIHggPSBsVmVsc1tqXVtpbmRleCAqIDMgKyAwXSAqIHN0ZXBXZWlnaHQgKyBhY2N1bVhbal07XG4gICAgICAgICAgICAgICAgeSA9IGxWZWxzW2pdW2luZGV4ICogMyArIDFdICogc3RlcFdlaWdodCArIGFjY3VtWVtqXTtcbiAgICAgICAgICAgICAgICB6ID0gbFZlbHNbal1baW5kZXggKiAzICsgMl0gKiBzdGVwV2VpZ2h0ICsgYWNjdW1aW2pdO1xuXG4gICAgICAgICAgICAgICAgbWlueCA9IE1hdGgubWluKHgsIG1pbngpO1xuICAgICAgICAgICAgICAgIG1pbnkgPSBNYXRoLm1pbih5LCBtaW55KTtcbiAgICAgICAgICAgICAgICBtaW56ID0gTWF0aC5taW4oeiwgbWlueik7XG4gICAgICAgICAgICAgICAgbWF4eCA9IE1hdGgubWF4KHgsIG1heHgpO1xuICAgICAgICAgICAgICAgIG1heHkgPSBNYXRoLm1heCh5LCBtYXh5KTtcbiAgICAgICAgICAgICAgICBtYXh6ID0gTWF0aC5tYXgoeiwgbWF4eik7XG5cbiAgICAgICAgICAgICAgICBhY2N1bVhbal0gPSB4O1xuICAgICAgICAgICAgICAgIGFjY3VtWVtqXSA9IHk7XG4gICAgICAgICAgICAgICAgYWNjdW1aW2pdID0gejtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgMjsgaisrKSB7XG4gICAgICAgICAgICAgICAgYWNjdW1XW2pdICs9IHN0ZXBXZWlnaHQgKiBNYXRoLnNxcnQoXG4gICAgICAgICAgICAgICAgICAgIHdWZWxzW2pdW2luZGV4ICogMyArIDBdICogd1ZlbHNbal1baW5kZXggKiAzICsgMF0gK1xuICAgICAgICAgICAgICAgICAgICB3VmVsc1tqXVtpbmRleCAqIDMgKyAxXSAqIHdWZWxzW2pdW2luZGV4ICogMyArIDFdICtcbiAgICAgICAgICAgICAgICAgICAgd1ZlbHNbal1baW5kZXggKiAzICsgMl0gKiB3VmVsc1tqXVtpbmRleCAqIDMgKyAyXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFjY3VtUlswXSArPSB0aGlzLnFSYWRpYWxTcGVlZFtpbmRleF0gKiBzdGVwV2VpZ2h0O1xuICAgICAgICAgICAgYWNjdW1SWzFdICs9IHRoaXMucVJhZGlhbFNwZWVkMltpbmRleF0gKiBzdGVwV2VpZ2h0O1xuICAgICAgICAgICAgbWF4UiA9IE1hdGgubWF4KG1heFIsIE1hdGgubWF4KE1hdGguYWJzKGFjY3VtUlswXSksIE1hdGguYWJzKGFjY3VtUlsxXSkpKTtcblxuICAgICAgICAgICAgbWF4U2NhbGUgPSBNYXRoLm1heChtYXhTY2FsZSwgdGhpcy5xU2NhbGVbaW5kZXhdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCkge1xuICAgICAgICAgICAgeCA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAqIDAuNTtcbiAgICAgICAgICAgIHkgPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgKiAwLjU7XG4gICAgICAgICAgICB6ID0gdGhpcy5lbWl0dGVyRXh0ZW50cy56ICogMC41O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IHRoaXMuZW1pdHRlclJhZGl1cztcbiAgICAgICAgICAgIHkgPSB0aGlzLmVtaXR0ZXJSYWRpdXM7XG4gICAgICAgICAgICB6ID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdyA9IE1hdGgubWF4KGFjY3VtV1swXSwgYWNjdW1XWzFdKTtcbiAgICAgICAgYk1pbi54ID0gbWlueCAtIG1heFNjYWxlIC0geCAtIG1heFIgLSB3O1xuICAgICAgICBiTWluLnkgPSBtaW55IC0gbWF4U2NhbGUgLSB5IC0gbWF4UiAtIHc7XG4gICAgICAgIGJNaW4ueiA9IG1pbnogLSBtYXhTY2FsZSAtIHogLSBtYXhSIC0gdztcbiAgICAgICAgYk1heC54ID0gbWF4eCArIG1heFNjYWxlICsgeCArIG1heFIgKyB3O1xuICAgICAgICBiTWF4LnkgPSBtYXh5ICsgbWF4U2NhbGUgKyB5ICsgbWF4UiArIHc7XG4gICAgICAgIGJNYXgueiA9IG1heHogKyBtYXhTY2FsZSArIHogKyBtYXhSICsgdztcbiAgICAgICAgdGhpcy5sb2NhbEJvdW5kcy5zZXRNaW5NYXgoYk1pbiwgYk1heCk7XG4gICAgfVxuXG4gICAgcmVidWlsZCgpIHtcbiAgICAgICAgY29uc3QgZ2QgPSB0aGlzLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIGlmICh0aGlzLmNvbG9yTWFwID09PSBudWxsKSB0aGlzLmNvbG9yTWFwID0gdGhpcy5kZWZhdWx0UGFyYW1UZXh0dXJlO1xuXG4gICAgICAgIHRoaXMuc3Bhd25Cb3VuZHMgPSB0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCA/IHRoaXMuZW1pdHRlckV4dGVudHMgOiB0aGlzLmVtaXR0ZXJSYWRpdXM7XG5cbiAgICAgICAgdGhpcy51c2VDcHUgPSB0aGlzLnVzZUNwdSB8fCB0aGlzLnNvcnQgPiBQQVJUSUNMRVNPUlRfTk9ORSB8fCAgLy8gZm9yY2UgQ1BVIGlmIGRlc2lyYWJsZSBieSB1c2VyIG9yIHNvcnRpbmcgaXMgZW5hYmxlZFxuICAgICAgICBnZC5tYXhWZXJ0ZXhUZXh0dXJlcyA8PSAxIHx8IC8vIGZvcmNlIENQVSBpZiBjYW4ndCB1c2UgZW5vdWdoIHZlcnRleCB0ZXh0dXJlc1xuICAgICAgICBnZC5mcmFnbWVudFVuaWZvcm1zQ291bnQgPCA2NCB8fCAvLyBmb3JjZSBDUFUgaWYgY2FuJ3QgdXNlIG1hbnkgdW5pZm9ybXM7IFRPRE86IGNoYW5nZSB0byBtb3JlIHJlYWxpc3RpYyB2YWx1ZSAodGhpcyBvbmUgaXMgaXBob25lJ3MpXG4gICAgICAgIGdkLmZvcmNlQ3B1UGFydGljbGVzIHx8XG4gICAgICAgICFnZC5leHRUZXh0dXJlRmxvYXQ7IC8vIG5vIGZsb2F0IHRleHR1cmUgZXh0ZW5zaW9uXG5cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlc291cmNlcygpO1xuXG4gICAgICAgIHRoaXMucGFjazggPSAodGhpcy5wYWNrOCB8fCAhZ2QudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgJiYgIXRoaXMudXNlQ3B1O1xuXG4gICAgICAgIHBhcnRpY2xlVGV4SGVpZ2h0ID0gKHRoaXMudXNlQ3B1IHx8IHRoaXMucGFjazgpID8gNCA6IDI7XG5cbiAgICAgICAgdGhpcy51c2VNZXNoID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgIGNvbnN0IHRvdGFsVmVydENvdW50ID0gdGhpcy5udW1QYXJ0aWNsZXMgKiB0aGlzLm1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgaWYgKHRvdGFsVmVydENvdW50ID4gNjU1MzUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdXQVJOSU5HOiBwYXJ0aWNsZSBzeXN0ZW0gY2FuXFwndCByZW5kZXIgbWVzaCBwYXJ0aWNsZXMgYmVjYXVzZSBudW1QYXJ0aWNsZXMgKiBudW1WZXJ0aWNlcyBpcyBtb3JlIHRoYW4gNjVrLiBSZXZlcnRpbmcgdG8gcXVhZCBwYXJ0aWNsZXMuJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudXNlTWVzaCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlc1BvdCA9IG1hdGgubmV4dFBvd2VyT2ZUd28odGhpcy5udW1QYXJ0aWNsZXMpO1xuICAgICAgICB0aGlzLnJlYnVpbGRHcmFwaHMoKTtcbiAgICAgICAgdGhpcy5jYWxjdWxhdGVMb2NhbEJvdW5kcygpO1xuICAgICAgICB0aGlzLnJlc2V0V29ybGRCb3VuZHMoKTtcblxuICAgICAgICBpZiAodGhpcy5ub2RlKSB7XG4gICAgICAgICAgICAvLyB0aGlzLnByZXZQb3MuY29weSh0aGlzLm5vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoXG4gICAgICAgICAgICAgICAgdGhpcy5sb2NhbEJvdW5kcywgdGhpcy5sb2NhbFNwYWNlID8gTWF0NC5JREVOVElUWSA6IHRoaXMubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcblxuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzKTtcblxuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzLmhhbGZFeHRlbnRzKS5tdWxTY2FsYXIoMik7XG4gICAgICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc0NlbnRlci5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhY2s4KSB0aGlzLmNhbGN1bGF0ZUJvdW5kc01hZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRHluYW1pYyBzaW11bGF0aW9uIGRhdGFcbiAgICAgICAgdGhpcy52YlRvU29ydCA9IG5ldyBBcnJheSh0aGlzLm51bVBhcnRpY2xlcyk7XG4gICAgICAgIGZvciAobGV0IGlTb3J0ID0gMDsgaVNvcnQgPCB0aGlzLm51bVBhcnRpY2xlczsgaVNvcnQrKykgdGhpcy52YlRvU29ydFtpU29ydF0gPSBbMCwgMF07XG4gICAgICAgIHRoaXMucGFydGljbGVEaXN0YW5jZSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXMpO1xuXG4gICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIucmFuZG9taXplKCk7XG5cbiAgICAgICAgdGhpcy5wYXJ0aWNsZVRleCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXNQb3QgKiBwYXJ0aWNsZVRleEhlaWdodCAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMpO1xuICAgICAgICBjb25zdCBlbWl0dGVyUG9zID0gKHRoaXMubm9kZSA9PT0gbnVsbCB8fCB0aGlzLmxvY2FsU3BhY2UpID8gVmVjMy5aRVJPIDogdGhpcy5ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCkge1xuICAgICAgICAgICAgaWYgKHRoaXMubm9kZSA9PT0gbnVsbCB8fCB0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBzcGF3bk1hdHJpeC5zZXRUUlMoVmVjMy5aRVJPLCBRdWF0LklERU5USVRZLCB0aGlzLnNwYXduQm91bmRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgdGhpcy5ub2RlLmdldFJvdGF0aW9uKCksIHRtcFZlYzMuY29weSh0aGlzLnNwYXduQm91bmRzKS5tdWwodGhpcy5ub2RlLmxvY2FsU2NhbGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVswXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci54IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy54IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsxXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueSAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci55IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy55IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsyXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueiAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci56IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy56IDogMDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubnVtUGFydGljbGVzOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NwdVVwZGF0ZXIuY2FsY1NwYXduUG9zaXRpb24odGhpcy5wYXJ0aWNsZVRleCwgc3Bhd25NYXRyaXgsIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSwgZW1pdHRlclBvcywgaSk7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VDcHUpIHRoaXMucGFydGljbGVUZXhbaSAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMgKyAzICsgdGhpcy5udW1QYXJ0aWNsZXNQb3QgKiAyICogcGFydGljbGVUZXhDaGFubmVsc10gPSAxOyAvLyBoaWRlL3Nob3dcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXNQb3QgKiBwYXJ0aWNsZVRleEhlaWdodCAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFydGljbGVUZXhTdGFydC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0W2ldID0gdGhpcy5wYXJ0aWNsZVRleFtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhY2s4KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleElOID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCwgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsIDEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VUID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCwgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsIDEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQsIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCAxLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTiA9IF9jcmVhdGVUZXh0dXJlKGdkLCB0aGlzLm51bVBhcnRpY2xlc1BvdCwgcGFydGljbGVUZXhIZWlnaHQsIHRoaXMucGFydGljbGVUZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhPVVQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhJTiA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLnBhcnRpY2xlVGV4SU4sXG4gICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleE9VVCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLnBhcnRpY2xlVGV4T1VULFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnN3YXBUZXggPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVTdGFydCA9ICh0aGlzLmxvY2FsU3BhY2UgPyAnI2RlZmluZSBMT0NBTF9TUEFDRVxcbicgOiAnJykgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVySW5pdFBTICtcbiAgICAgICAgKHRoaXMucGFjazggPyAoc2hhZGVyQ2h1bmtzLnBhcnRpY2xlSW5wdXRSZ2JhOFBTICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlT3V0cHV0UmdiYThQUykgOlxuICAgICAgICAgICAgKHNoYWRlckNodW5rcy5wYXJ0aWNsZUlucHV0RmxvYXRQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZU91dHB1dEZsb2F0UFMpKSArXG4gICAgICAgICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCA/IHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJBQUJCUFMgOiBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyU3BoZXJlUFMpICtcbiAgICAgICAgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclN0YXJ0UFM7XG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVSZXNwYXduID0gc2hhZGVyQ29kZVN0YXJ0ICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclJlc3Bhd25QUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcbiAgICAgICAgY29uc3Qgc2hhZGVyQ29kZU5vUmVzcGF3biA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJOb1Jlc3Bhd25QUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcbiAgICAgICAgY29uc3Qgc2hhZGVyQ29kZU9uU3RvcCA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJPblN0b3BQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcblxuICAgICAgICAvLyBOb3RlOiBjcmVhdGVTaGFkZXJGcm9tQ29kZSBjYW4gcmV0dXJuIGEgc2hhZGVyIGZyb20gdGhlIGNhY2hlIChub3QgYSBuZXcgc2hhZGVyKSBzbyB3ZSAqc2hvdWxkIG5vdCogZGVsZXRlIHRoZXNlIHNoYWRlcnNcbiAgICAgICAgLy8gd2hlbiB0aGUgcGFydGljbGUgZW1pdHRlciBpcyBkZXN0cm95ZWRcbiAgICAgICAgY29uc3QgcGFyYW1zID0gdGhpcy5lbWl0dGVyU2hhcGUgKyAnJyArIHRoaXMucGFjazggKyAnJyArIHRoaXMubG9jYWxTcGFjZTtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZVJlc3Bhd24gPSBjcmVhdGVTaGFkZXJGcm9tQ29kZShnZCwgc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlMsIHNoYWRlckNvZGVSZXNwYXduLCAnZnNRdWFkMCcgKyBwYXJhbXMpO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlTm9SZXNwYXduID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlTm9SZXNwYXduLCAnZnNRdWFkMScgKyBwYXJhbXMpO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlT25TdG9wLCAnZnNRdWFkMicgKyBwYXJhbXMpO1xuXG4gICAgICAgIHRoaXMubnVtUGFydGljbGVWZXJ0cyA9IHRoaXMudXNlTWVzaCA/IHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMgOiA0O1xuICAgICAgICB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyA9IHRoaXMudXNlTWVzaCA/IHRoaXMubWVzaC5pbmRleEJ1ZmZlclswXS5udW1JbmRpY2VzIDogNjtcbiAgICAgICAgdGhpcy5fYWxsb2NhdGUodGhpcy5udW1QYXJ0aWNsZXMpO1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChnZCk7XG4gICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdGhpcy52ZXJ0ZXhCdWZmZXI7XG4gICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSB0aGlzLmluZGV4QnVmZmVyO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS50eXBlID0gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IDA7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gKHRoaXMubnVtUGFydGljbGVzICogdGhpcy5udW1QYXJ0aWNsZUluZGljZXMpO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbmV3IE1hdGVyaWFsKCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwubmFtZSA9IHRoaXMubm9kZS5uYW1lO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9OT05FO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5ibGVuZCA9IHRydWU7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuYmxlbmRUeXBlID0gdGhpcy5ibGVuZFR5cGU7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbC5kZXB0aFdyaXRlID0gdGhpcy5kZXB0aFdyaXRlO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmVtaXR0ZXIgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMucmVnZW5TaGFkZXIoKTtcbiAgICAgICAgdGhpcy5yZXNldE1hdGVyaWFsKCk7XG5cbiAgICAgICAgY29uc3Qgd2FzVmlzaWJsZSA9IHRoaXMubWVzaEluc3RhbmNlID8gdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA6IHRydWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCB0aGlzLm1hdGVyaWFsLCB0aGlzLm5vZGUpO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5waWNrID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnVwZGF0ZUtleSgpOyAvLyBzaG91bGRuJ3QgYmUgaGVyZT9cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuY3VsbCA9IHRydWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9ub0RlcHRoRHJhd0dsMSA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYih0aGlzLndvcmxkQm91bmRzLCB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmIgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9IHdhc1Zpc2libGU7XG5cbiAgICAgICAgdGhpcy5faW5pdGlhbGl6ZVRleHR1cmVzKCk7XG5cbiAgICAgICAgdGhpcy5yZXNldFRpbWUoKTtcblxuICAgICAgICB0aGlzLmFkZFRpbWUoMCwgZmFsc2UpOyAvLyBmaWxsIGR5bmFtaWMgdGV4dHVyZXMgYW5kIGNvbnN0YW50cyB3aXRoIGluaXRpYWwgZGF0YVxuICAgICAgICBpZiAodGhpcy5wcmVXYXJtKSB0aGlzLnByZXdhcm0odGhpcy5saWZldGltZSk7XG4gICAgfVxuXG4gICAgX2lzQW5pbWF0ZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFuaW1OdW1GcmFtZXMgPj0gMSAmJlxuICAgICAgICAgICAgICAgKHRoaXMuYW5pbVRpbGVzWCA+IDEgfHwgdGhpcy5hbmltVGlsZXNZID4gMSkgJiZcbiAgICAgICAgICAgICAgICh0aGlzLmNvbG9yTWFwICYmIHRoaXMuY29sb3JNYXAgIT09IHRoaXMuZGVmYXVsdFBhcmFtVGV4dHVyZSB8fCB0aGlzLm5vcm1hbE1hcCk7XG4gICAgfVxuXG4gICAgcmVidWlsZEdyYXBocygpIHtcbiAgICAgICAgY29uc3QgcHJlY2lzaW9uID0gdGhpcy5wcmVjaXNpb247XG4gICAgICAgIGNvbnN0IGdkID0gdGhpcy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICB0aGlzLnFMb2NhbFZlbG9jaXR5ID0gdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xVmVsb2NpdHkgPSB0aGlzLnZlbG9jaXR5R3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xQ29sb3IgPSAgICAgICAgIHRoaXMuY29sb3JHcmFwaC5xdWFudGl6ZUNsYW1wZWQocHJlY2lzaW9uLCAwLCAxKTtcbiAgICAgICAgdGhpcy5xUm90U3BlZWQgPSAgICAgIHRoaXMucm90YXRpb25TcGVlZEdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVNjYWxlID0gICAgICAgICB0aGlzLnNjYWxlR3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xQWxwaGEgPSAgICAgICAgIHRoaXMuYWxwaGFHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFSYWRpYWxTcGVlZCA9ICAgdGhpcy5yYWRpYWxTcGVlZEdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG5cbiAgICAgICAgdGhpcy5xTG9jYWxWZWxvY2l0eTIgPSB0aGlzLmxvY2FsVmVsb2NpdHlHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xVmVsb2NpdHkyID0gICAgICB0aGlzLnZlbG9jaXR5R3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUNvbG9yMiA9ICAgICAgICAgdGhpcy5jb2xvckdyYXBoMi5xdWFudGl6ZUNsYW1wZWQocHJlY2lzaW9uLCAwLCAxKTtcbiAgICAgICAgdGhpcy5xUm90U3BlZWQyID0gICAgICB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xU2NhbGUyID0gICAgICAgICB0aGlzLnNjYWxlR3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUFscGhhMiA9ICAgICAgICAgdGhpcy5hbHBoYUdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFSYWRpYWxTcGVlZDIgPSAgIHRoaXMucmFkaWFsU3BlZWRHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWNpc2lvbjsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnFSb3RTcGVlZFtpXSAqPSBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICB0aGlzLnFSb3RTcGVlZDJbaV0gKj0gbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2NhbFZlbG9jaXR5VU1heCA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMudmVsb2NpdHlVTWF4ID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5jb2xvclVNYXggPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLnJvdFNwZWVkVU1heCA9IFswXTtcbiAgICAgICAgdGhpcy5zY2FsZVVNYXggPSAgICBbMF07XG4gICAgICAgIHRoaXMuYWxwaGFVTWF4ID0gICAgWzBdO1xuICAgICAgICB0aGlzLnJhZGlhbFNwZWVkVU1heCA9IFswXTtcbiAgICAgICAgdGhpcy5xTG9jYWxWZWxvY2l0eURpdiA9IGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xTG9jYWxWZWxvY2l0eSwgdGhpcy5xTG9jYWxWZWxvY2l0eTIsIHRoaXMubG9jYWxWZWxvY2l0eVVNYXgpO1xuICAgICAgICB0aGlzLnFWZWxvY2l0eURpdiA9ICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFWZWxvY2l0eSwgdGhpcy5xVmVsb2NpdHkyLCB0aGlzLnZlbG9jaXR5VU1heCk7XG4gICAgICAgIHRoaXMucUNvbG9yRGl2ID0gICAgICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucUNvbG9yLCB0aGlzLnFDb2xvcjIsIHRoaXMuY29sb3JVTWF4KTtcbiAgICAgICAgdGhpcy5xUm90U3BlZWREaXYgPSAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xUm90U3BlZWQsIHRoaXMucVJvdFNwZWVkMiwgdGhpcy5yb3RTcGVlZFVNYXgpO1xuICAgICAgICB0aGlzLnFTY2FsZURpdiA9ICAgICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFTY2FsZSwgdGhpcy5xU2NhbGUyLCB0aGlzLnNjYWxlVU1heCk7XG4gICAgICAgIHRoaXMucUFscGhhRGl2ID0gICAgICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucUFscGhhLCB0aGlzLnFBbHBoYTIsIHRoaXMuYWxwaGFVTWF4KTtcbiAgICAgICAgdGhpcy5xUmFkaWFsU3BlZWREaXYgPSAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xUmFkaWFsU3BlZWQsIHRoaXMucVJhZGlhbFNwZWVkMiwgdGhpcy5yYWRpYWxTcGVlZFVNYXgpO1xuXG4gICAgICAgIGlmICh0aGlzLnBhY2s4KSB7XG4gICAgICAgICAgICBjb25zdCB1bWF4ID0gWzAsIDAsIDBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVZlbG9jaXR5LCB1bWF4KTtcbiAgICAgICAgICAgIGNvbnN0IHVtYXgyID0gWzAsIDAsIDBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVZlbG9jaXR5MiwgdW1heDIpO1xuXG4gICAgICAgICAgICBjb25zdCBsdW1heCA9IFswLCAwLCAwXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFMb2NhbFZlbG9jaXR5LCBsdW1heCk7XG4gICAgICAgICAgICBjb25zdCBsdW1heDIgPSBbMCwgMCwgMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xTG9jYWxWZWxvY2l0eTIsIGx1bWF4Mik7XG5cbiAgICAgICAgICAgIGNvbnN0IHJ1bWF4ID0gWzBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVJhZGlhbFNwZWVkLCBydW1heCk7XG4gICAgICAgICAgICBjb25zdCBydW1heDIgPSBbMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xUmFkaWFsU3BlZWQyLCBydW1heDIpO1xuXG4gICAgICAgICAgICBsZXQgbWF4VmVsID0gTWF0aC5tYXgodW1heFswXSwgdW1heDJbMF0pO1xuICAgICAgICAgICAgbWF4VmVsID0gTWF0aC5tYXgobWF4VmVsLCB1bWF4WzFdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heDJbMV0pO1xuICAgICAgICAgICAgbWF4VmVsID0gTWF0aC5tYXgobWF4VmVsLCB1bWF4WzJdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heDJbMl0pO1xuXG4gICAgICAgICAgICBsZXQgbG1heFZlbCA9IE1hdGgubWF4KGx1bWF4WzBdLCBsdW1heDJbMF0pO1xuICAgICAgICAgICAgbG1heFZlbCA9IE1hdGgubWF4KGxtYXhWZWwsIGx1bWF4WzFdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heDJbMV0pO1xuICAgICAgICAgICAgbG1heFZlbCA9IE1hdGgubWF4KGxtYXhWZWwsIGx1bWF4WzJdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heDJbMl0pO1xuXG4gICAgICAgICAgICBjb25zdCBtYXhSYWQgPSBNYXRoLm1heChydW1heFswXSwgcnVtYXgyWzBdKTtcblxuICAgICAgICAgICAgdGhpcy5tYXhWZWwgPSBtYXhWZWwgKyBsbWF4VmVsICsgbWF4UmFkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDAgPSBfY3JlYXRlVGV4dHVyZShnZCwgcHJlY2lzaW9uLCAxLCBwYWNrVGV4dHVyZVhZWl9OWFlaKHRoaXMucUxvY2FsVmVsb2NpdHksIHRoaXMucUxvY2FsVmVsb2NpdHlEaXYpKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmVYWVpfTlhZWih0aGlzLnFWZWxvY2l0eSwgdGhpcy5xVmVsb2NpdHlEaXYpKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgyID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmU1RmxvYXRzKHRoaXMucVJvdFNwZWVkLCB0aGlzLnFTY2FsZSwgdGhpcy5xU2NhbGVEaXYsIHRoaXMucVJvdFNwZWVkRGl2LCB0aGlzLnFBbHBoYURpdikpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDMgPSBfY3JlYXRlVGV4dHVyZShnZCwgcHJlY2lzaW9uLCAxLCBwYWNrVGV4dHVyZTJGbG9hdHModGhpcy5xUmFkaWFsU3BlZWQsIHRoaXMucVJhZGlhbFNwZWVkRGl2KSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb2xvclBhcmFtID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmVSR0JBKHRoaXMucUNvbG9yLCB0aGlzLnFBbHBoYSksIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCAxLjAsIHRydWUpO1xuICAgIH1cblxuICAgIF9pbml0aWFsaXplVGV4dHVyZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbG9yTWFwKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignY29sb3JNYXAnLCB0aGlzLmNvbG9yTWFwKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nICYmIHRoaXMubm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ25vcm1hbE1hcCcsIHRoaXMubm9ybWFsTWFwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlZ2VuU2hhZGVyKCkge1xuICAgICAgICBjb25zdCBwcm9ncmFtTGliID0gZ2V0UHJvZ3JhbUxpYnJhcnkodGhpcy5ncmFwaGljc0RldmljZSk7XG4gICAgICAgIHByb2dyYW1MaWIucmVnaXN0ZXIoJ3BhcnRpY2xlJywgcGFydGljbGUpO1xuXG4gICAgICAgIGNvbnN0IGhhc05vcm1hbCA9ICh0aGlzLm5vcm1hbE1hcCAhPT0gbnVsbCk7XG4gICAgICAgIHRoaXMubm9ybWFsT3B0aW9uID0gMDtcbiAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcpIHtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsT3B0aW9uID0gaGFzTm9ybWFsID8gMiA6IDE7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZ2V0U2hhZGVyVmFyaWFudCBpcyBhbHNvIGNhbGxlZCBieSBwYy5TY2VuZSB3aGVuIGFsbCBzaGFkZXJzIG5lZWQgdG8gYmUgdXBkYXRlZFxuICAgICAgICB0aGlzLm1hdGVyaWFsLmdldFNoYWRlclZhcmlhbnQgPSBmdW5jdGlvbiAoZGV2LCBzYywgZGVmcywgc3RhdGljTGlnaHRMaXN0LCBwYXNzLCBzb3J0ZWRMaWdodHMsIHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIFRoZSBhcHAgd29ya3MgbGlrZSB0aGlzOlxuICAgICAgICAgICAgLy8gMS4gRW1pdHRlciBpbml0XG4gICAgICAgICAgICAvLyAyLiBVcGRhdGUuIE5vIGNhbWVyYSBpcyBhc3NpZ25lZCB0byBlbWl0dGVyc1xuICAgICAgICAgICAgLy8gMy4gUmVuZGVyOyBhY3RpdmVDYW1lcmEgPSBjYW1lcmE7IHNoYWRlciBpbml0XG4gICAgICAgICAgICAvLyA0LiBVcGRhdGUuIGFjdGl2ZUNhbWVyYSBpcyBzZXQgdG8gZW1pdHRlcnNcbiAgICAgICAgICAgIC8vIC0tLS0tXG4gICAgICAgICAgICAvLyBUaGUgcHJvYmxlbSB3aXRoIDFzdCBmcmFtZSByZW5kZXIgaXMgdGhhdCB3ZSBpbml0IHRoZSBzaGFkZXIgd2l0aG91dCBoYXZpbmcgYW55IGNhbWVyYSBzZXQgdG8gZW1pdHRlciAtXG4gICAgICAgICAgICAvLyBzbyB3cm9uZyBzaGFkZXIgaXMgYmVpbmcgY29tcGlsZWQuXG4gICAgICAgICAgICAvLyBUbyBmaXggaXQsIHdlIG5lZWQgdG8gY2hlY2sgYWN0aXZlQ2FtZXJhIT1lbWl0dGVyLmNhbWVyYSBpbiBzaGFkZXIgaW5pdCB0b29cbiAgICAgICAgICAgIGlmICh0aGlzLmVtaXR0ZXIuc2NlbmUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyLmNhbWVyYSAhPT0gdGhpcy5lbWl0dGVyLnNjZW5lLl9hY3RpdmVDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmNhbWVyYSA9IHRoaXMuZW1pdHRlci5zY2VuZS5fYWN0aXZlQ2FtZXJhO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXR0ZXIub25DaGFuZ2VDYW1lcmEoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBieSBFZGl0b3IgaWYgcnVubmluZyBpbnNpZGUgZWRpdG9yXG4gICAgICAgICAgICBjb25zdCBpblRvb2xzID0gdGhpcy5lbWl0dGVyLmluVG9vbHM7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHByb2dyYW1MaWIuZ2V0UHJvZ3JhbSgncGFydGljbGUnLCB7XG4gICAgICAgICAgICAgICAgdXNlQ3B1OiB0aGlzLmVtaXR0ZXIudXNlQ3B1LFxuICAgICAgICAgICAgICAgIG5vcm1hbDogdGhpcy5lbWl0dGVyLm5vcm1hbE9wdGlvbixcbiAgICAgICAgICAgICAgICBoYWxmbGFtYmVydDogdGhpcy5lbWl0dGVyLmhhbGZMYW1iZXJ0LFxuICAgICAgICAgICAgICAgIHN0cmV0Y2g6IHRoaXMuZW1pdHRlci5zdHJldGNoLFxuICAgICAgICAgICAgICAgIGFsaWduVG9Nb3Rpb246IHRoaXMuZW1pdHRlci5hbGlnblRvTW90aW9uLFxuICAgICAgICAgICAgICAgIHNvZnQ6IHRoaXMuZW1pdHRlci5kZXB0aFNvZnRlbmluZyxcbiAgICAgICAgICAgICAgICBtZXNoOiB0aGlzLmVtaXR0ZXIudXNlTWVzaCxcbiAgICAgICAgICAgICAgICBnYW1tYTogdGhpcy5lbWl0dGVyLnNjZW5lID8gdGhpcy5lbWl0dGVyLnNjZW5lLmdhbW1hQ29ycmVjdGlvbiA6IDAsXG4gICAgICAgICAgICAgICAgdG9uZU1hcDogdGhpcy5lbWl0dGVyLnNjZW5lID8gdGhpcy5lbWl0dGVyLnNjZW5lLnRvbmVNYXBwaW5nIDogMCxcbiAgICAgICAgICAgICAgICBmb2c6ICh0aGlzLmVtaXR0ZXIuc2NlbmUgJiYgIXRoaXMuZW1pdHRlci5ub0ZvZykgPyB0aGlzLmVtaXR0ZXIuc2NlbmUuZm9nIDogJ25vbmUnLFxuICAgICAgICAgICAgICAgIHdyYXA6IHRoaXMuZW1pdHRlci53cmFwICYmIHRoaXMuZW1pdHRlci53cmFwQm91bmRzLFxuICAgICAgICAgICAgICAgIGxvY2FsU3BhY2U6IHRoaXMuZW1pdHRlci5sb2NhbFNwYWNlLFxuXG4gICAgICAgICAgICAgICAgLy8gaW4gRWRpdG9yLCBzY3JlZW4gc3BhY2UgcGFydGljbGVzIChjaGlsZHJlbiBvZiAyRCBTY3JlZW4pIGFyZSBzdGlsbCByZW5kZXJlZCBpbiAzZCBzcGFjZVxuICAgICAgICAgICAgICAgIHNjcmVlblNwYWNlOiBpblRvb2xzID8gZmFsc2UgOiB0aGlzLmVtaXR0ZXIuc2NyZWVuU3BhY2UsXG5cbiAgICAgICAgICAgICAgICBibGVuZDogdGhpcy5ibGVuZFR5cGUsXG4gICAgICAgICAgICAgICAgYW5pbVRleDogdGhpcy5lbWl0dGVyLl9pc0FuaW1hdGVkKCksXG4gICAgICAgICAgICAgICAgYW5pbVRleExvb3A6IHRoaXMuZW1pdHRlci5hbmltTG9vcCxcbiAgICAgICAgICAgICAgICBwYWNrODogdGhpcy5lbWl0dGVyLnBhY2s4LFxuICAgICAgICAgICAgICAgIGN1c3RvbUZhY2U6IHRoaXMuZW1pdHRlci5vcmllbnRhdGlvbiAhPT0gUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gc2hhZGVyO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnNoYWRlciA9IHRoaXMubWF0ZXJpYWwuZ2V0U2hhZGVyVmFyaWFudCgpO1xuICAgIH1cblxuICAgIHJlc2V0TWF0ZXJpYWwoKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbDtcblxuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3N0cmV0Y2gnLCB0aGlzLnN0cmV0Y2gpO1xuICAgICAgICBpZiAodGhpcy5faXNBbmltYXRlZCgpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FuaW1UZXhUaWxlc1BhcmFtcycsIHRoaXMuYW5pbVRpbGVzUGFyYW1zKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignYW5pbVRleFBhcmFtcycsIHRoaXMuYW5pbVBhcmFtcyk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FuaW1UZXhJbmRleFBhcmFtcycsIHRoaXMuYW5pbUluZGV4UGFyYW1zKTtcbiAgICAgICAgfVxuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2NvbG9yTXVsdCcsIHRoaXMuaW50ZW5zaXR5KTtcbiAgICAgICAgaWYgKCF0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbnRlcm5hbFRleDAnLCB0aGlzLmludGVybmFsVGV4MCk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ludGVybmFsVGV4MScsIHRoaXMuaW50ZXJuYWxUZXgxKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW50ZXJuYWxUZXgyJywgdGhpcy5pbnRlcm5hbFRleDIpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbnRlcm5hbFRleDMnLCB0aGlzLmludGVybmFsVGV4Myk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdjb2xvclBhcmFtJywgdGhpcy5jb2xvclBhcmFtKTtcblxuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ251bVBhcnRpY2xlcycsIHRoaXMubnVtUGFydGljbGVzKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdudW1QYXJ0aWNsZXNQb3QnLCB0aGlzLm51bVBhcnRpY2xlc1BvdCk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbGlmZXRpbWUnLCB0aGlzLmxpZmV0aW1lKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdyYXRlJywgdGhpcy5yYXRlKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdyYXRlRGl2JywgdGhpcy5yYXRlMiAtIHRoaXMucmF0ZSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignc2VlZCcsIHRoaXMuc2VlZCk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignc2NhbGVEaXZNdWx0JywgdGhpcy5zY2FsZVVNYXhbMF0pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FscGhhRGl2TXVsdCcsIHRoaXMuYWxwaGFVTWF4WzBdKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdyYWRpYWxTcGVlZERpdk11bHQnLCB0aGlzLnJhZGlhbFNwZWVkVU1heFswXSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZ3JhcGhOdW1TYW1wbGVzJywgdGhpcy5wcmVjaXNpb24pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2dyYXBoU2FtcGxlU2l6ZScsIDEuMCAvIHRoaXMucHJlY2lzaW9uKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdlbWl0dGVyU2NhbGUnLCBuZXcgRmxvYXQzMkFycmF5KFsxLCAxLCAxXSkpO1xuXG4gICAgICAgIGlmICh0aGlzLnBhY2s4KSB7XG4gICAgICAgICAgICB0aGlzLl9ncHVVcGRhdGVyLl9zZXRJbnB1dEJvdW5kcygpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbkJvdW5kc1NpemUnLCB0aGlzLl9ncHVVcGRhdGVyLmluQm91bmRzU2l6ZVVuaWZvcm0pO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbkJvdW5kc0NlbnRlcicsIHRoaXMuX2dwdVVwZGF0ZXIuaW5Cb3VuZHNDZW50ZXJVbmlmb3JtKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbWF4VmVsJywgdGhpcy5tYXhWZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud3JhcCAmJiB0aGlzLndyYXBCb3VuZHMpIHtcbiAgICAgICAgICAgIHRoaXMud3JhcEJvdW5kc1VuaWZvcm1bMF0gPSB0aGlzLndyYXBCb3VuZHMueDtcbiAgICAgICAgICAgIHRoaXMud3JhcEJvdW5kc1VuaWZvcm1bMV0gPSB0aGlzLndyYXBCb3VuZHMueTtcbiAgICAgICAgICAgIHRoaXMud3JhcEJvdW5kc1VuaWZvcm1bMl0gPSB0aGlzLndyYXBCb3VuZHMuejtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignd3JhcEJvdW5kcycsIHRoaXMud3JhcEJvdW5kc1VuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29sb3JNYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignY29sb3JNYXAnLCB0aGlzLmNvbG9yTWFwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5ub3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ25vcm1hbE1hcCcsIHRoaXMubm9ybWFsTWFwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5kZXB0aFNvZnRlbmluZyA+IDApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignc29mdGVuaW5nJywgMS4wIC8gKHRoaXMuZGVwdGhTb2Z0ZW5pbmcgKiB0aGlzLmRlcHRoU29mdGVuaW5nICogMTAwKSk7IC8vIHJlbWFwIHRvIG1vcmUgcGVyY2VwdHVhbGx5IGxpbmVhclxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0cmV0Y2ggPiAwLjApIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9OT05FO1xuXG4gICAgICAgIHRoaXMuX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMoKTtcbiAgICB9XG5cbiAgICBfY29tcFBhcnRpY2xlRmFjZVBhcmFtcygpIHtcbiAgICAgICAgbGV0IHRhbmdlbnQsIGJpbm9ybWFsO1xuICAgICAgICBpZiAodGhpcy5vcmllbnRhdGlvbiA9PT0gUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4pIHtcbiAgICAgICAgICAgIHRhbmdlbnQgPSBuZXcgRmxvYXQzMkFycmF5KFsxLCAwLCAwXSk7XG4gICAgICAgICAgICBiaW5vcm1hbCA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsIDFdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBuO1xuICAgICAgICAgICAgaWYgKHRoaXMub3JpZW50YXRpb24gPT09IFBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQpIHtcbiAgICAgICAgICAgICAgICBuID0gdGhpcy5wYXJ0aWNsZU5vcm1hbC5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW1pdHRlck1hdCA9IHRoaXMubm9kZSA9PT0gbnVsbCA/XG4gICAgICAgICAgICAgICAgICAgIE1hdDQuSURFTlRJVFkgOiB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgICAgICBuID0gZW1pdHRlck1hdC50cmFuc2Zvcm1WZWN0b3IodGhpcy5wYXJ0aWNsZU5vcm1hbCkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0ID0gbmV3IFZlYzMoMSwgMCwgMCk7XG4gICAgICAgICAgICBpZiAoTWF0aC5hYnModC5kb3QobikpID09PSAxKVxuICAgICAgICAgICAgICAgIHQuc2V0KDAsIDAsIDEpO1xuICAgICAgICAgICAgY29uc3QgYiA9IG5ldyBWZWMzKCkuY3Jvc3MobiwgdCkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB0LmNyb3NzKGIsIG4pLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdGFuZ2VudCA9IG5ldyBGbG9hdDMyQXJyYXkoW3QueCwgdC55LCB0LnpdKTtcbiAgICAgICAgICAgIGJpbm9ybWFsID0gbmV3IEZsb2F0MzJBcnJheShbYi54LCBiLnksIGIuel0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdmYWNlVGFuZ2VudCcsIHRhbmdlbnQpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZmFjZUJpbm9ybScsIGJpbm9ybWFsKTtcbiAgICB9XG5cbiAgICAvLyBEZWNsYXJlcyB2ZXJ0ZXggZm9ybWF0LCBjcmVhdGVzIFZCIGFuZCBJQlxuICAgIF9hbGxvY2F0ZShudW1QYXJ0aWNsZXMpIHtcbiAgICAgICAgY29uc3QgcHN5c1ZlcnRDb3VudCA9IG51bVBhcnRpY2xlcyAqIHRoaXMubnVtUGFydGljbGVWZXJ0cztcbiAgICAgICAgY29uc3QgcHN5c0luZGV4Q291bnQgPSBudW1QYXJ0aWNsZXMgKiB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcztcblxuICAgICAgICBpZiAoKHRoaXMudmVydGV4QnVmZmVyID09PSB1bmRlZmluZWQpIHx8ICh0aGlzLnZlcnRleEJ1ZmZlci5nZXROdW1WZXJ0aWNlcygpICE9PSBwc3lzVmVydENvdW50KSkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBwYXJ0aWNsZSB2ZXJ0ZXggZm9ybWF0XG4gICAgICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICAgICAgLy8gR1BVOiBYWVogPSBxdWFkIHZlcnRleCBwb3NpdGlvbjsgVyA9IElOVDogcGFydGljbGUgSUQsIEZSQUM6IHJhbmRvbSBmYWN0b3JcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IFt7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogNCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfV07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRpY2xlRm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBlbGVtZW50cyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIodGhpcy5ncmFwaGljc0RldmljZSwgcGFydGljbGVGb3JtYXQsIHBzeXNWZXJ0Q291bnQsIEJVRkZFUl9EWU5BTUlDKTtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIElOREVYRk9STUFUX1VJTlQxNiwgcHN5c0luZGV4Q291bnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IFt7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogNCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjEsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIyLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiA0LFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMyxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogMSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjQsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IHRoaXMudXNlTWVzaCA/IDQgOiAyLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9XTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0aWNsZUZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcy5ncmFwaGljc0RldmljZSwgZWxlbWVudHMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIHBhcnRpY2xlRm9ybWF0LCBwc3lzVmVydENvdW50LCBCVUZGRVJfRFlOQU1JQyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLmdyYXBoaWNzRGV2aWNlLCBJTkRFWEZPUk1BVF9VSU5UMTYsIHBzeXNJbmRleENvdW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRmlsbCB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXIubG9jaygpKTtcbiAgICAgICAgICAgIGxldCBtZXNoRGF0YSwgc3RyaWRlLCB0ZXhDb29yZE9mZnNldDtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICBtZXNoRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5sb2NrKCkpO1xuICAgICAgICAgICAgICAgIHN0cmlkZSA9IG1lc2hEYXRhLmxlbmd0aCAvIHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZWxlbSA9IDA7IGVsZW0gPCB0aGlzLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7IGVsZW0rKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbZWxlbV0ubmFtZSA9PT0gU0VNQU5USUNfVEVYQ09PUkQwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXhDb29yZE9mZnNldCA9IHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2VsZW1dLm9mZnNldCAvIDQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwc3lzVmVydENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IE1hdGguZmxvb3IoaSAvIHRoaXMubnVtUGFydGljbGVWZXJ0cyk7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVydElEID0gaSAlIDQ7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDRdID0gcGFydGljbGVWZXJ0c1t2ZXJ0SURdWzBdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0ICsgMV0gPSBwYXJ0aWNsZVZlcnRzW3ZlcnRJRF1bMV07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDQgKyAyXSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDQgKyAzXSA9IGlkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnQgPSBpICUgdGhpcy5udW1QYXJ0aWNsZVZlcnRzO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2XSA9IG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGVdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgMV0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgMV07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyAyXSA9IG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGUgKyAyXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDNdID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyA0XSA9IG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGUgKyB0ZXhDb29yZE9mZnNldCArIDBdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgNV0gPSAxLjAgLSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgdGV4Q29vcmRPZmZzZXQgKyAxXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgICAgIHRoaXMudmJDUFUgPSBuZXcgRmxvYXQzMkFycmF5KGRhdGEpO1xuICAgICAgICAgICAgICAgIHRoaXMudmJPbGQgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMudmJDUFUubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbGwgdGhlIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgbGV0IGRzdCA9IDA7XG4gICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuaW5kZXhCdWZmZXIubG9jaygpKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIG1lc2hEYXRhID0gbmV3IFVpbnQxNkFycmF5KHRoaXMubWVzaC5pbmRleEJ1ZmZlclswXS5sb2NrKCkpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1QYXJ0aWNsZXM7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VJbmRleCA9IGkgKiA0O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXggKyAxO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleCArIDI7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleCArIDI7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4ICsgMztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMubnVtUGFydGljbGVJbmRpY2VzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGljZXNbaSAqIHRoaXMubnVtUGFydGljbGVJbmRpY2VzICsgal0gPSBtZXNoRGF0YVtqXSArIGkgKiB0aGlzLm51bVBhcnRpY2xlVmVydHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkgdGhpcy5tZXNoLmluZGV4QnVmZmVyWzBdLnVubG9jaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIHRoaXMuYmVlblJlc2V0ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zZWVkID0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NlZWQnLCB0aGlzLnNlZWQpO1xuICAgICAgICBpZiAodGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFtpXSA9IHRoaXMucGFydGljbGVUZXhTdGFydFtpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2luaXRpYWxpemVUZXh0dXJlcygpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVzZXRXb3JsZEJvdW5kcygpO1xuICAgICAgICB0aGlzLnJlc2V0VGltZSgpO1xuICAgICAgICBjb25zdCBvcmlnTG9vcCA9IHRoaXMubG9vcDtcbiAgICAgICAgdGhpcy5sb29wID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hZGRUaW1lKDAsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5sb29wID0gb3JpZ0xvb3A7XG4gICAgICAgIGlmICh0aGlzLnByZVdhcm0pIHtcbiAgICAgICAgICAgIHRoaXMucHJld2FybSh0aGlzLmxpZmV0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByZXdhcm0odGltZSkge1xuICAgICAgICBjb25zdCBsaWZldGltZUZyYWN0aW9uID0gdGltZSAvIHRoaXMubGlmZXRpbWU7XG4gICAgICAgIGNvbnN0IGl0ZXJhdGlvbnMgPSBNYXRoLm1pbihNYXRoLmZsb29yKGxpZmV0aW1lRnJhY3Rpb24gKiB0aGlzLnByZWNpc2lvbiksIHRoaXMucHJlY2lzaW9uKTtcbiAgICAgICAgY29uc3Qgc3RlcERlbHRhID0gdGltZSAvIGl0ZXJhdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlcmF0aW9uczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFRpbWUoc3RlcERlbHRhLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXNldFRpbWUoKSB7XG4gICAgICAgIHRoaXMuZW5kVGltZSA9IGNhbGNFbmRUaW1lKHRoaXMpO1xuICAgIH1cblxuICAgIGZpbmlzaEZyYW1lKCkge1xuICAgICAgICBpZiAodGhpcy51c2VDcHUpIHRoaXMudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgIH1cblxuICAgIGFkZFRpbWUoZGVsdGEsIGlzT25TdG9wKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgKz0gZGVsdGE7XG5cbiAgICAgICAgdGhpcy5jYWxjdWxhdGVXb3JsZEJvdW5kcygpO1xuXG4gICAgICAgIGlmICh0aGlzLl9pc0FuaW1hdGVkKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHRpbGVzUGFyYW1zID0gdGhpcy5hbmltVGlsZXNQYXJhbXM7XG4gICAgICAgICAgICB0aWxlc1BhcmFtc1swXSA9IDEuMCAvIHRoaXMuYW5pbVRpbGVzWDsgLy8gYW5pbVRleFRpbGVzUGFyYW1zLnhcbiAgICAgICAgICAgIHRpbGVzUGFyYW1zWzFdID0gMS4wIC8gdGhpcy5hbmltVGlsZXNZOyAvLyBhbmltVGV4VGlsZXNQYXJhbXMueVxuXG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSB0aGlzLmFuaW1QYXJhbXM7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSB0aGlzLmFuaW1TdGFydEZyYW1lOyAvLyBhbmltVGV4UGFyYW1zLnhcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IHRoaXMuYW5pbU51bUZyYW1lcyAqIHRoaXMuYW5pbVNwZWVkOyAvLyBhbmltVGV4UGFyYW1zLnlcbiAgICAgICAgICAgIHBhcmFtc1syXSA9IHRoaXMuYW5pbU51bUZyYW1lcyAtIDE7IC8vIGFuaW1UZXhQYXJhbXMuelxuICAgICAgICAgICAgcGFyYW1zWzNdID0gdGhpcy5hbmltTnVtQW5pbWF0aW9ucyAtIDE7IC8vIGFuaW1UZXhQYXJhbXMud1xuXG4gICAgICAgICAgICBjb25zdCBhbmltSW5kZXhQYXJhbXMgPSB0aGlzLmFuaW1JbmRleFBhcmFtcztcbiAgICAgICAgICAgIGFuaW1JbmRleFBhcmFtc1swXSA9IHRoaXMuYW5pbUluZGV4OyAvLyBhbmltVGV4SW5kZXhQYXJhbXMueFxuICAgICAgICAgICAgYW5pbUluZGV4UGFyYW1zWzFdID0gdGhpcy5yYW5kb21pemVBbmltSW5kZXg7IC8vIGFuaW1UZXhJbmRleFBhcmFtcy55XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zY2VuZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuY2FtZXJhICE9PSB0aGlzLnNjZW5lLl9hY3RpdmVDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbWVyYSA9IHRoaXMuc2NlbmUuX2FjdGl2ZUNhbWVyYTtcbiAgICAgICAgICAgICAgICB0aGlzLm9uQ2hhbmdlQ2FtZXJhKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVswXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci54IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy54IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsxXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueSAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci55IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy55IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsyXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueiAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci56IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy56IDogMDtcbiAgICAgICAgICAgIGlmICh0aGlzLm1lc2hJbnN0YW5jZS5ub2RlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgUXVhdC5JREVOVElUWSwgdGhpcy5lbWl0dGVyRXh0ZW50cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNwYXduTWF0cml4LnNldFRSUyhWZWMzLlpFUk8sIHRoaXMubWVzaEluc3RhbmNlLm5vZGUuZ2V0Um90YXRpb24oKSwgdG1wVmVjMy5jb3B5KHRoaXMuZW1pdHRlckV4dGVudHMpLm11bCh0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmxvY2FsU2NhbGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBlbWl0dGVyUG9zO1xuICAgICAgICBjb25zdCBlbWl0dGVyU2NhbGUgPSB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlID09PSBudWxsID8gVmVjMy5PTkUgOiB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmxvY2FsU2NhbGU7XG4gICAgICAgIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybVswXSA9IGVtaXR0ZXJTY2FsZS54O1xuICAgICAgICB0aGlzLmVtaXR0ZXJTY2FsZVVuaWZvcm1bMV0gPSBlbWl0dGVyU2NhbGUueTtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtWzJdID0gZW1pdHRlclNjYWxlLno7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdlbWl0dGVyU2NhbGUnLCB0aGlzLmVtaXR0ZXJTY2FsZVVuaWZvcm0pO1xuICAgICAgICBpZiAodGhpcy5sb2NhbFNwYWNlICYmIHRoaXMubWVzaEluc3RhbmNlLm5vZGUpIHtcbiAgICAgICAgICAgIGVtaXR0ZXJQb3MgPSB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtWzBdID0gZW1pdHRlclBvcy54O1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyUG9zVW5pZm9ybVsxXSA9IGVtaXR0ZXJQb3MueTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm1bMl0gPSBlbWl0dGVyUG9zLno7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZW1pdHRlclBvcycsIHRoaXMuZW1pdHRlclBvc1VuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29tcFBhcnRpY2xlRmFjZVBhcmFtcygpO1xuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIudXBkYXRlKGRldmljZSwgc3Bhd25NYXRyaXgsIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSwgZGVsdGEsIGlzT25TdG9wKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMudmVydGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICB0aGlzLl9jcHVVcGRhdGVyLnVwZGF0ZShkYXRhLCB0aGlzLnZiVG9Tb3J0LCB0aGlzLnBhcnRpY2xlVGV4LCBzcGF3bk1hdHJpeCwgZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtLCBlbWl0dGVyUG9zLCBkZWx0YSwgaXNPblN0b3ApO1xuICAgICAgICAgICAgLy8gdGhpcy52ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMubG9vcCkge1xuICAgICAgICAgICAgaWYgKERhdGUubm93KCkgPiB0aGlzLmVuZFRpbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vbkZpbmlzaGVkKSB0aGlzLm9uRmluaXNoZWQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHRoaXMuZHJhd09yZGVyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9hZGRUaW1lVGltZSArPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgX2Rlc3Ryb3lSZXNvdXJjZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcnRpY2xlVGV4SU4pIHtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTi5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4SU4gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGFydGljbGVUZXhPVVQpIHtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhPVVQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleE9VVCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wYXJ0aWNsZVRleFN0YXJ0ICYmIHRoaXMucGFydGljbGVUZXhTdGFydC5kZXN0cm95KSB7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJ0UGFydGljbGVUZXhJTikge1xuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4SU4uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4SU4gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucnRQYXJ0aWNsZVRleE9VVCkge1xuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4T1VULmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleE9VVCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbnRlcm5hbFRleDApIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgwLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgwID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmludGVybmFsVGV4MSkge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDEuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDEgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJuYWxUZXgyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4Mi5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbnRlcm5hbFRleDMpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbG9yUGFyYW0pIHtcbiAgICAgICAgICAgIHRoaXMuY29sb3JQYXJhbS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmNvbG9yUGFyYW0gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IHVuZGVmaW5lZDsgLy8gd2UgYXJlIHRlc3RpbmcgaWYgdmIgaXMgdW5kZWZpbmVkIGluIHNvbWUgY29kZSwgbm8gaWRlYSB3aHlcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tYXRlcmlhbCkge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vdGU6IHNoYWRlcnMgc2hvdWxkIG5vdCBiZSBkZXN0cm95ZWQgYXMgdGhleSBjb3VsZCBiZSBzaGFyZWQgYmV0d2VlbiBlbWl0dGVyc1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuY2FtZXJhID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9kZXN0cm95UmVzb3VyY2VzKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQYXJ0aWNsZUVtaXR0ZXIgfTtcbiJdLCJuYW1lcyI6WyJwYXJ0aWNsZVZlcnRzIiwiX2NyZWF0ZVRleHR1cmUiLCJkZXZpY2UiLCJ3aWR0aCIsImhlaWdodCIsInBpeGVsRGF0YSIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJtdWx0OEJpdCIsImZpbHRlciIsIm1pcEZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJGSUxURVJfTElORUFSIiwidGV4dHVyZSIsIlRleHR1cmUiLCJjdWJlbWFwIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJuYW1lIiwicGl4ZWxzIiwibG9jayIsInRlbXAiLCJVaW50OEFycmF5IiwibGVuZ3RoIiwiaSIsInNldCIsInVubG9jayIsInNhdHVyYXRlIiwieCIsIk1hdGgiLCJtYXgiLCJtaW4iLCJkZWZhdWx0MEN1cnZlIiwiQ3VydmUiLCJkZWZhdWx0MUN1cnZlIiwiZGVmYXVsdDBDdXJ2ZTMiLCJDdXJ2ZVNldCIsImRlZmF1bHQxQ3VydmUzIiwicGFydGljbGVUZXhIZWlnaHQiLCJwYXJ0aWNsZVRleENoYW5uZWxzIiwiZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtIiwiRmxvYXQzMkFycmF5Iiwic3Bhd25NYXRyaXgiLCJNYXQ0IiwidG1wVmVjMyIsIlZlYzMiLCJiTWluIiwiYk1heCIsInNldFByb3BlcnR5VGFyZ2V0Iiwic2V0UHJvcGVydHlPcHRpb25zIiwic2V0UHJvcGVydHkiLCJwTmFtZSIsImRlZmF1bHRWYWwiLCJ1bmRlZmluZWQiLCJwYWNrM05GbG9hdHMiLCJhIiwiYiIsImMiLCJwYWNrZWQiLCJwYWNrVGV4dHVyZVhZWl9OWFlaIiwicVhZWiIsInFYWVoyIiwibnVtIiwiY29sb3JzIiwiQXJyYXkiLCJwYWNrVGV4dHVyZVJHQkEiLCJxUkdCIiwicUEiLCJwYWNrVGV4dHVyZTVGbG9hdHMiLCJxQiIsInFDIiwicUQiLCJxRSIsInBhY2tUZXh0dXJlMkZsb2F0cyIsImNhbGNFbmRUaW1lIiwiZW1pdHRlciIsImludGVydmFsIiwicmF0ZSIsInJhdGUyIiwibnVtUGFydGljbGVzIiwibGlmZXRpbWUiLCJEYXRlIiwibm93Iiwic3ViR3JhcGgiLCJBIiwiQiIsInIiLCJtYXhVbnNpZ25lZEdyYXBoVmFsdWUiLCJvdXRVTWF4IiwiY2hhbnMiLCJ2YWx1ZXMiLCJqIiwiYWJzIiwibm9ybWFsaXplR3JhcGgiLCJ1TWF4IiwiZGl2R3JhcGhGcm9tMkN1cnZlcyIsImN1cnZlMSIsImN1cnZlMiIsInN1YiIsInBhcnRpY2xlRW1pdHRlckRldmljZUNhY2hlIiwiRGV2aWNlQ2FjaGUiLCJQYXJ0aWNsZUVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwib3B0aW9ucyIsImdkIiwicHJlY2lzaW9uIiwiX2FkZFRpbWVUaW1lIiwibWF4VGV4dHVyZVNpemUiLCJEZWJ1ZyIsIndhcm4iLCJFTUlUVEVSU0hBUEVfQk9YIiwiZGVmYXVsdFBhcmFtVGV4dHVyZSIsIlBBUlRJQ0xFU09SVF9OT05FIiwiUEFSVElDTEVNT0RFX0dQVSIsIlBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOIiwiQkxFTkRfTk9STUFMIiwic3RhcnRBbmdsZSIsIl9ncHVVcGRhdGVyIiwiUGFydGljbGVHUFVVcGRhdGVyIiwiX2NwdVVwZGF0ZXIiLCJQYXJ0aWNsZUNQVVVwZGF0ZXIiLCJjb25zdGFudExpZ2h0Q3ViZSIsInNjb3BlIiwicmVzb2x2ZSIsImVtaXR0ZXJQb3NVbmlmb3JtIiwid3JhcEJvdW5kc1VuaWZvcm0iLCJlbWl0dGVyU2NhbGVVbmlmb3JtIiwiY29sb3JHcmFwaCIsInNjYWxlR3JhcGgiLCJhbHBoYUdyYXBoIiwibG9jYWxWZWxvY2l0eUdyYXBoIiwidmVsb2NpdHlHcmFwaCIsInJvdGF0aW9uU3BlZWRHcmFwaCIsInJhZGlhbFNwZWVkR3JhcGgiLCJsaWdodEN1YmUiLCJsaWdodEN1YmVEaXIiLCJhbmltVGlsZXNQYXJhbXMiLCJhbmltUGFyYW1zIiwiYW5pbUluZGV4UGFyYW1zIiwiaW50ZXJuYWxUZXgwIiwiaW50ZXJuYWxUZXgxIiwiaW50ZXJuYWxUZXgyIiwiY29sb3JQYXJhbSIsInZiVG9Tb3J0IiwidmJPbGQiLCJwYXJ0aWNsZURpc3RhbmNlIiwiY2FtZXJhIiwic3dhcFRleCIsInVzZU1lc2giLCJ1c2VDcHUiLCJzdXBwb3J0c0dwdVBhcnRpY2xlcyIsInBhY2s4IiwibG9jYWxCb3VuZHMiLCJCb3VuZGluZ0JveCIsIndvcmxkQm91bmRzTm9UcmFpbCIsIndvcmxkQm91bmRzVHJhaWwiLCJ3b3JsZEJvdW5kcyIsIndvcmxkQm91bmRzU2l6ZSIsInByZXZXb3JsZEJvdW5kc1NpemUiLCJwcmV2V29ybGRCb3VuZHNDZW50ZXIiLCJwcmV2RW1pdHRlckV4dGVudHMiLCJlbWl0dGVyRXh0ZW50cyIsInByZXZFbWl0dGVyUmFkaXVzIiwiZW1pdHRlclJhZGl1cyIsIndvcmxkQm91bmRzTXVsIiwid29ybGRCb3VuZHNBZGQiLCJ0aW1lVG9Td2l0Y2hCb3VuZHMiLCJzaGFkZXJQYXJ0aWNsZVVwZGF0ZVJlc3Bhd24iLCJzaGFkZXJQYXJ0aWNsZVVwZGF0ZU5vUmVzcGF3biIsInNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wIiwibnVtUGFydGljbGVWZXJ0cyIsIm51bVBhcnRpY2xlSW5kaWNlcyIsIm1hdGVyaWFsIiwibWVzaEluc3RhbmNlIiwiZHJhd09yZGVyIiwic2VlZCIsInJhbmRvbSIsImZpeGVkVGltZVN0ZXAiLCJtYXhTdWJTdGVwcyIsInNpbVRpbWUiLCJzaW1UaW1lVG90YWwiLCJiZWVuUmVzZXQiLCJfbGF5ZXIiLCJyZWJ1aWxkIiwiYXNzZXJ0IiwiZ2V0IiwicmVzb2x1dGlvbiIsImNlbnRlclBvaW50IiwiZHRleCIsInkiLCJ4Z3JhZCIsInlncmFkIiwic3FydCIsInAiLCJvbkNoYW5nZUNhbWVyYSIsInJlZ2VuU2hhZGVyIiwicmVzZXRNYXRlcmlhbCIsImNhbGN1bGF0ZUJvdW5kc01hZCIsInoiLCJjb3B5IiwiY2VudGVyIiwibXVsIiwibXVsU2NhbGFyIiwiY2FsY3VsYXRlV29ybGRCb3VuZHMiLCJub2RlIiwicmVjYWxjdWxhdGVMb2NhbEJvdW5kcyIsImVtaXR0ZXJTaGFwZSIsImVxdWFscyIsImNhbGN1bGF0ZUxvY2FsQm91bmRzIiwibm9kZVdUIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJsb2NhbFNwYWNlIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImFkZCIsImhhbGZFeHRlbnRzIiwiYWFiYiIsIm1lc2giLCJfYWFiYlZlciIsInJlc2V0V29ybGRCb3VuZHMiLCJJREVOVElUWSIsIm1pbngiLCJOdW1iZXIiLCJNQVhfVkFMVUUiLCJtaW55IiwibWlueiIsIm1heHgiLCJtYXh5IiwibWF4eiIsIm1heFIiLCJtYXhTY2FsZSIsInN0ZXBXZWlnaHQiLCJ3VmVscyIsInFWZWxvY2l0eSIsInFWZWxvY2l0eTIiLCJsVmVscyIsInFMb2NhbFZlbG9jaXR5IiwicUxvY2FsVmVsb2NpdHkyIiwiYWNjdW1YIiwiYWNjdW1ZIiwiYWNjdW1aIiwiYWNjdW1SIiwiYWNjdW1XIiwiaW5kZXgiLCJxUmFkaWFsU3BlZWQiLCJxUmFkaWFsU3BlZWQyIiwicVNjYWxlIiwidyIsInNldE1pbk1heCIsImNvbG9yTWFwIiwic3Bhd25Cb3VuZHMiLCJzb3J0IiwibWF4VmVydGV4VGV4dHVyZXMiLCJmcmFnbWVudFVuaWZvcm1zQ291bnQiLCJmb3JjZUNwdVBhcnRpY2xlcyIsImV4dFRleHR1cmVGbG9hdCIsIl9kZXN0cm95UmVzb3VyY2VzIiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsInRvdGFsVmVydENvdW50IiwidmVydGV4QnVmZmVyIiwibnVtVmVydGljZXMiLCJudW1QYXJ0aWNsZXNQb3QiLCJtYXRoIiwibmV4dFBvd2VyT2ZUd28iLCJyZWJ1aWxkR3JhcGhzIiwiaVNvcnQiLCJyYW5kb21pemUiLCJwYXJ0aWNsZVRleCIsImVtaXR0ZXJQb3MiLCJaRVJPIiwiZ2V0UG9zaXRpb24iLCJzZXRUUlMiLCJRdWF0IiwiZ2V0Um90YXRpb24iLCJsb2NhbFNjYWxlIiwiZW1pdHRlckV4dGVudHNJbm5lciIsImNhbGNTcGF3blBvc2l0aW9uIiwicGFydGljbGVUZXhTdGFydCIsInBhcnRpY2xlVGV4SU4iLCJwYXJ0aWNsZVRleE9VVCIsInJ0UGFydGljbGVUZXhJTiIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJydFBhcnRpY2xlVGV4T1VUIiwic2hhZGVyQ29kZVN0YXJ0Iiwic2hhZGVyQ2h1bmtzIiwicGFydGljbGVVcGRhdGVySW5pdFBTIiwicGFydGljbGVJbnB1dFJnYmE4UFMiLCJwYXJ0aWNsZU91dHB1dFJnYmE4UFMiLCJwYXJ0aWNsZUlucHV0RmxvYXRQUyIsInBhcnRpY2xlT3V0cHV0RmxvYXRQUyIsInBhcnRpY2xlVXBkYXRlckFBQkJQUyIsInBhcnRpY2xlVXBkYXRlclNwaGVyZVBTIiwicGFydGljbGVVcGRhdGVyU3RhcnRQUyIsInNoYWRlckNvZGVSZXNwYXduIiwicGFydGljbGVVcGRhdGVyUmVzcGF3blBTIiwicGFydGljbGVVcGRhdGVyRW5kUFMiLCJzaGFkZXJDb2RlTm9SZXNwYXduIiwicGFydGljbGVVcGRhdGVyTm9SZXNwYXduUFMiLCJzaGFkZXJDb2RlT25TdG9wIiwicGFydGljbGVVcGRhdGVyT25TdG9wUFMiLCJwYXJhbXMiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsImZ1bGxzY3JlZW5RdWFkVlMiLCJpbmRleEJ1ZmZlciIsIm51bUluZGljZXMiLCJfYWxsb2NhdGUiLCJNZXNoIiwicHJpbWl0aXZlIiwidHlwZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwiTWF0ZXJpYWwiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsImFscGhhV3JpdGUiLCJibGVuZCIsImJsZW5kVHlwZSIsImRlcHRoV3JpdGUiLCJ3YXNWaXNpYmxlIiwidmlzaWJsZSIsIk1lc2hJbnN0YW5jZSIsInBpY2siLCJ1cGRhdGVLZXkiLCJfbm9EZXB0aERyYXdHbDEiLCJfdXBkYXRlQWFiYiIsIl9pbml0aWFsaXplVGV4dHVyZXMiLCJyZXNldFRpbWUiLCJhZGRUaW1lIiwicHJlV2FybSIsInByZXdhcm0iLCJfaXNBbmltYXRlZCIsImFuaW1OdW1GcmFtZXMiLCJhbmltVGlsZXNYIiwiYW5pbVRpbGVzWSIsIm5vcm1hbE1hcCIsInF1YW50aXplIiwicUNvbG9yIiwicXVhbnRpemVDbGFtcGVkIiwicVJvdFNwZWVkIiwicUFscGhhIiwibG9jYWxWZWxvY2l0eUdyYXBoMiIsInZlbG9jaXR5R3JhcGgyIiwicUNvbG9yMiIsImNvbG9yR3JhcGgyIiwicVJvdFNwZWVkMiIsInJvdGF0aW9uU3BlZWRHcmFwaDIiLCJxU2NhbGUyIiwic2NhbGVHcmFwaDIiLCJxQWxwaGEyIiwiYWxwaGFHcmFwaDIiLCJyYWRpYWxTcGVlZEdyYXBoMiIsIkRFR19UT19SQUQiLCJsb2NhbFZlbG9jaXR5VU1heCIsInZlbG9jaXR5VU1heCIsImNvbG9yVU1heCIsInJvdFNwZWVkVU1heCIsInNjYWxlVU1heCIsImFscGhhVU1heCIsInJhZGlhbFNwZWVkVU1heCIsInFMb2NhbFZlbG9jaXR5RGl2IiwicVZlbG9jaXR5RGl2IiwicUNvbG9yRGl2IiwicVJvdFNwZWVkRGl2IiwicVNjYWxlRGl2IiwicUFscGhhRGl2IiwicVJhZGlhbFNwZWVkRGl2IiwidW1heCIsInVtYXgyIiwibHVtYXgiLCJsdW1heDIiLCJydW1heCIsInJ1bWF4MiIsIm1heFZlbCIsImxtYXhWZWwiLCJtYXhSYWQiLCJpbnRlcm5hbFRleDMiLCJzZXRQYXJhbWV0ZXIiLCJsaWdodGluZyIsInByb2dyYW1MaWIiLCJnZXRQcm9ncmFtTGlicmFyeSIsInJlZ2lzdGVyIiwicGFydGljbGUiLCJoYXNOb3JtYWwiLCJub3JtYWxPcHRpb24iLCJnZXRTaGFkZXJWYXJpYW50IiwiZGV2Iiwic2MiLCJkZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsInNjZW5lIiwiX2FjdGl2ZUNhbWVyYSIsImluVG9vbHMiLCJzaGFkZXIiLCJnZXRQcm9ncmFtIiwibm9ybWFsIiwiaGFsZmxhbWJlcnQiLCJoYWxmTGFtYmVydCIsInN0cmV0Y2giLCJhbGlnblRvTW90aW9uIiwic29mdCIsImRlcHRoU29mdGVuaW5nIiwiZ2FtbWEiLCJnYW1tYUNvcnJlY3Rpb24iLCJ0b25lTWFwIiwidG9uZU1hcHBpbmciLCJmb2ciLCJub0ZvZyIsIndyYXAiLCJ3cmFwQm91bmRzIiwic2NyZWVuU3BhY2UiLCJhbmltVGV4IiwiYW5pbVRleExvb3AiLCJhbmltTG9vcCIsImN1c3RvbUZhY2UiLCJvcmllbnRhdGlvbiIsImludGVuc2l0eSIsIl9zZXRJbnB1dEJvdW5kcyIsImluQm91bmRzU2l6ZVVuaWZvcm0iLCJpbkJvdW5kc0NlbnRlclVuaWZvcm0iLCJfY29tcFBhcnRpY2xlRmFjZVBhcmFtcyIsInRhbmdlbnQiLCJiaW5vcm1hbCIsIm4iLCJQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxEIiwicGFydGljbGVOb3JtYWwiLCJub3JtYWxpemUiLCJlbWl0dGVyTWF0IiwidHJhbnNmb3JtVmVjdG9yIiwidCIsImRvdCIsImNyb3NzIiwicHN5c1ZlcnRDb3VudCIsInBzeXNJbmRleENvdW50IiwiZ2V0TnVtVmVydGljZXMiLCJlbGVtZW50cyIsInNlbWFudGljIiwiU0VNQU5USUNfQVRUUjAiLCJjb21wb25lbnRzIiwiVFlQRV9GTE9BVDMyIiwicHVzaCIsIlNFTUFOVElDX0FUVFIxIiwicGFydGljbGVGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfRFlOQU1JQyIsIkluZGV4QnVmZmVyIiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiU0VNQU5USUNfQVRUUjIiLCJTRU1BTlRJQ19BVFRSMyIsIlNFTUFOVElDX0FUVFI0IiwiZGF0YSIsIm1lc2hEYXRhIiwic3RyaWRlIiwidGV4Q29vcmRPZmZzZXQiLCJlbGVtIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwib2Zmc2V0IiwiaWQiLCJmbG9vciIsInZlcnRJRCIsInZlcnQiLCJ2YkNQVSIsImRzdCIsImluZGljZXMiLCJVaW50MTZBcnJheSIsImJhc2VJbmRleCIsInJlc2V0Iiwib3JpZ0xvb3AiLCJsb29wIiwidGltZSIsImxpZmV0aW1lRnJhY3Rpb24iLCJpdGVyYXRpb25zIiwic3RlcERlbHRhIiwiZW5kVGltZSIsImZpbmlzaEZyYW1lIiwiZGVsdGEiLCJpc09uU3RvcCIsInN0YXJ0VGltZSIsInRpbGVzUGFyYW1zIiwiYW5pbVN0YXJ0RnJhbWUiLCJhbmltU3BlZWQiLCJhbmltTnVtQW5pbWF0aW9ucyIsImFuaW1JbmRleCIsInJhbmRvbWl6ZUFuaW1JbmRleCIsImVtaXR0ZXJTY2FsZSIsIk9ORSIsInVwZGF0ZSIsIm9uRmluaXNoZWQiLCJkZXN0cm95Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWlEQSxNQUFNQSxhQUFhLEdBQUcsQ0FDbEIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUNSLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQ1AsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQ04sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FDVixDQUFBO0FBRUQsU0FBU0MsY0FBYyxDQUFDQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxFQUFFQyxTQUFTLEVBQUVDLE1BQU0sR0FBR0MsbUJBQW1CLEVBQUVDLFFBQVEsRUFBRUMsTUFBTSxFQUFFO0VBRXRHLElBQUlDLFNBQVMsR0FBR0MsY0FBYyxDQUFBO0VBQzlCLElBQUlGLE1BQU0sSUFBSUgsTUFBTSxLQUFLTSx1QkFBdUIsRUFDNUNGLFNBQVMsR0FBR0csYUFBYSxDQUFBO0FBRTdCLEVBQUEs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
