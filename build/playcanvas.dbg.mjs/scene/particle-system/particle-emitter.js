/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Curve } from '../../core/math/curve.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { FILTER_LINEAR, PRIMITIVE_TRIANGLES, CULLFACE_NONE, BUFFER_DYNAMIC, INDEXFORMAT_UINT16, SEMANTIC_ATTR0, TYPE_FLOAT32, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_TEXCOORD0, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { EMITTERSHAPE_BOX, PARTICLESORT_NONE, PARTICLEORIENTATION_SCREEN, PARTICLEORIENTATION_WORLD, PARTICLEMODE_GPU, BLEND_NORMAL } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { Material } from '../materials/material.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { particle } from '../shader-lib/programs/particle.js';
import { ParticleCPUUpdater } from './cpu-updater.js';
import { ParticleGPUUpdater } from './gpu-updater.js';

const particleVerts = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
function _createTexture(device, width, height, pixelData, format = PIXELFORMAT_RGBA32F, mult8Bit, filter) {
  let mipFilter = FILTER_NEAREST;
  if (filter && format === PIXELFORMAT_RGBA8) mipFilter = FILTER_LINEAR;
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
  if (format === PIXELFORMAT_RGBA8) {
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
      const texture = _createTexture(this.graphicsDevice, resolution, resolution, dtex, PIXELFORMAT_RGBA8, 1.0, true);
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
        this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_RGBA8, 1, false);
        this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_RGBA8, 1, false);
        this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart, PIXELFORMAT_RGBA8, 1, false);
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
    this.colorParam = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), PIXELFORMAT_RGBA8, 1.0, true);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUtZW1pdHRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ3VydmUgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUuanMnO1xuaW1wb3J0IHsgQ3VydmVTZXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQlVGRkVSX0RZTkFNSUMsXG4gICAgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVCxcbiAgICBJTkRFWEZPUk1BVF9VSU5UMTYsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX1JHQkEzMkYsXG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMywgU0VNQU5USUNfQVRUUjQsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGV2aWNlLWNhY2hlLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9OT1JNQUwsXG4gICAgRU1JVFRFUlNIQVBFX0JPWCxcbiAgICBQQVJUSUNMRU1PREVfR1BVLFxuICAgIFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOLCBQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxELFxuICAgIFBBUlRJQ0xFU09SVF9OT05FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IGdldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi91dGlscy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgcGFydGljbGUgfSBmcm9tICcuLi9zaGFkZXItbGliL3Byb2dyYW1zL3BhcnRpY2xlLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlQ1BVVXBkYXRlciB9IGZyb20gJy4vY3B1LXVwZGF0ZXIuanMnO1xuaW1wb3J0IHsgUGFydGljbGVHUFVVcGRhdGVyIH0gZnJvbSAnLi9ncHUtdXBkYXRlci5qcyc7XG5cbmNvbnN0IHBhcnRpY2xlVmVydHMgPSBbXG4gICAgWy0xLCAtMV0sXG4gICAgWzEsIC0xXSxcbiAgICBbMSwgMV0sXG4gICAgWy0xLCAxXVxuXTtcblxuZnVuY3Rpb24gX2NyZWF0ZVRleHR1cmUoZGV2aWNlLCB3aWR0aCwgaGVpZ2h0LCBwaXhlbERhdGEsIGZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkEzMkYsIG11bHQ4Qml0LCBmaWx0ZXIpIHtcblxuICAgIGxldCBtaXBGaWx0ZXIgPSBGSUxURVJfTkVBUkVTVDtcbiAgICBpZiAoZmlsdGVyICYmIGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTgpXG4gICAgICAgIG1pcEZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG5cbiAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgIGZvcm1hdDogZm9ybWF0LFxuICAgICAgICBjdWJlbWFwOiBmYWxzZSxcbiAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgIG1pbkZpbHRlcjogbWlwRmlsdGVyLFxuICAgICAgICBtYWdGaWx0ZXI6IG1pcEZpbHRlcixcbiAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgbmFtZTogJ1BhcnRpY2xlU3lzdGVtVGV4dHVyZSdcbiAgICB9KTtcblxuICAgIGNvbnN0IHBpeGVscyA9IHRleHR1cmUubG9jaygpO1xuXG4gICAgaWYgKGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTgpIHtcbiAgICAgICAgY29uc3QgdGVtcCA9IG5ldyBVaW50OEFycmF5KHBpeGVsRGF0YS5sZW5ndGgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBpeGVsRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGVtcFtpXSA9IHBpeGVsRGF0YVtpXSAqIG11bHQ4Qml0ICogMjU1O1xuICAgICAgICB9XG4gICAgICAgIHBpeGVsRGF0YSA9IHRlbXA7XG4gICAgfVxuXG4gICAgcGl4ZWxzLnNldChwaXhlbERhdGEpO1xuXG4gICAgdGV4dHVyZS51bmxvY2soKTtcblxuICAgIHJldHVybiB0ZXh0dXJlO1xufVxuXG5mdW5jdGlvbiBzYXR1cmF0ZSh4KSB7XG4gICAgcmV0dXJuIE1hdGgubWF4KE1hdGgubWluKHgsIDEpLCAwKTtcbn1cblxuY29uc3QgZGVmYXVsdDBDdXJ2ZSA9IG5ldyBDdXJ2ZShbMCwgMCwgMSwgMF0pO1xuY29uc3QgZGVmYXVsdDFDdXJ2ZSA9IG5ldyBDdXJ2ZShbMCwgMSwgMSwgMV0pO1xuY29uc3QgZGVmYXVsdDBDdXJ2ZTMgPSBuZXcgQ3VydmVTZXQoWzAsIDAsIDEsIDBdLCBbMCwgMCwgMSwgMF0sIFswLCAwLCAxLCAwXSk7XG5jb25zdCBkZWZhdWx0MUN1cnZlMyA9IG5ldyBDdXJ2ZVNldChbMCwgMSwgMSwgMV0sIFswLCAxLCAxLCAxXSwgWzAsIDEsIDEsIDFdKTtcblxubGV0IHBhcnRpY2xlVGV4SGVpZ2h0ID0gMjtcbmNvbnN0IHBhcnRpY2xlVGV4Q2hhbm5lbHMgPSA0OyAvLyB0aGVyZSBpcyBhIGR1cGxpY2F0ZSBpbiBjcHUgdXBkYXRlclxuXG5jb25zdCBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuY29uc3Qgc3Bhd25NYXRyaXggPSBuZXcgTWF0NCgpO1xuXG5jb25zdCB0bXBWZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IGJNaW4gPSBuZXcgVmVjMygpO1xuY29uc3QgYk1heCA9IG5ldyBWZWMzKCk7XG5cbmxldCBzZXRQcm9wZXJ0eVRhcmdldDtcbmxldCBzZXRQcm9wZXJ0eU9wdGlvbnM7XG5cbmZ1bmN0aW9uIHNldFByb3BlcnR5KHBOYW1lLCBkZWZhdWx0VmFsKSB7XG4gICAgaWYgKHNldFByb3BlcnR5T3B0aW9uc1twTmFtZV0gIT09IHVuZGVmaW5lZCAmJiBzZXRQcm9wZXJ0eU9wdGlvbnNbcE5hbWVdICE9PSBudWxsKSB7XG4gICAgICAgIHNldFByb3BlcnR5VGFyZ2V0W3BOYW1lXSA9IHNldFByb3BlcnR5T3B0aW9uc1twTmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXRbcE5hbWVdID0gZGVmYXVsdFZhbDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBhY2szTkZsb2F0cyhhLCBiLCBjKSB7XG4gICAgY29uc3QgcGFja2VkID0gKChhICogMjU1KSA8PCAxNikgfCAoKGIgKiAyNTUpIDw8IDgpIHwgKGMgKiAyNTUpO1xuICAgIHJldHVybiAocGFja2VkKSAvICgxIDw8IDI0KTtcbn1cblxuZnVuY3Rpb24gcGFja1RleHR1cmVYWVpfTlhZWihxWFlaLCBxWFlaMikge1xuICAgIGNvbnN0IG51bSA9IHFYWVoubGVuZ3RoIC8gMztcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkobnVtICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW07IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcVhZWltpICogM107XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcVhZWltpICogMyArIDFdO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAyXSA9IHFYWVpbaSAqIDMgKyAyXTtcblxuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IHBhY2szTkZsb2F0cyhxWFlaMltpICogM10sIHFYWVoyW2kgKiAzICsgMV0sIHFYWVoyW2kgKiAzICsgMl0pO1xuICAgIH1cbiAgICByZXR1cm4gY29sb3JzO1xufVxuXG5mdW5jdGlvbiBwYWNrVGV4dHVyZVJHQkEocVJHQiwgcUEpIHtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkocUEubGVuZ3RoICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxQS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcVJHQltpICogM107XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcVJHQltpICogMyArIDFdO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAyXSA9IHFSR0JbaSAqIDMgKyAyXTtcblxuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IHFBW2ldO1xuICAgIH1cbiAgICByZXR1cm4gY29sb3JzO1xufVxuXG5mdW5jdGlvbiBwYWNrVGV4dHVyZTVGbG9hdHMocUEsIHFCLCBxQywgcUQsIHFFKSB7XG4gICAgY29uc3QgY29sb3JzID0gbmV3IEFycmF5KHFBLmxlbmd0aCAqIDQpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcUEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29sb3JzW2kgKiA0XSA9IHFBW2ldO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAxXSA9IHFCW2ldO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAyXSA9IDA7XG5cbiAgICAgICAgY29sb3JzW2kgKiA0ICsgM10gPSBwYWNrM05GbG9hdHMocUNbaV0sIHFEW2ldLCBxRVtpXSk7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlMkZsb2F0cyhxQSwgcUIpIHtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkocUEubGVuZ3RoICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxQS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcUFbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcUJbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gMDtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4gY29sb3JzO1xufVxuXG5mdW5jdGlvbiBjYWxjRW5kVGltZShlbWl0dGVyKSB7XG4gICAgY29uc3QgaW50ZXJ2YWwgPSAoTWF0aC5tYXgoZW1pdHRlci5yYXRlLCBlbWl0dGVyLnJhdGUyKSAqIGVtaXR0ZXIubnVtUGFydGljbGVzICsgZW1pdHRlci5saWZldGltZSk7XG4gICAgcmV0dXJuIERhdGUubm93KCkgKyBpbnRlcnZhbCAqIDEwMDA7XG59XG5cbmZ1bmN0aW9uIHN1YkdyYXBoKEEsIEIpIHtcbiAgICBjb25zdCByID0gbmV3IEZsb2F0MzJBcnJheShBLmxlbmd0aCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJbaV0gPSBBW2ldIC0gQltpXTtcbiAgICB9XG4gICAgcmV0dXJuIHI7XG59XG5cbmZ1bmN0aW9uIG1heFVuc2lnbmVkR3JhcGhWYWx1ZShBLCBvdXRVTWF4KSB7XG4gICAgY29uc3QgY2hhbnMgPSBvdXRVTWF4Lmxlbmd0aDtcbiAgICBjb25zdCB2YWx1ZXMgPSBBLmxlbmd0aCAvIGNoYW5zO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWVzOyBpKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjaGFuczsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBhID0gTWF0aC5hYnMoQVtpICogY2hhbnMgKyBqXSk7XG4gICAgICAgICAgICBvdXRVTWF4W2pdID0gTWF0aC5tYXgob3V0VU1heFtqXSwgYSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUdyYXBoKEEsIHVNYXgpIHtcbiAgICBjb25zdCBjaGFucyA9IHVNYXgubGVuZ3RoO1xuICAgIGNvbnN0IHZhbHVlcyA9IEEubGVuZ3RoIC8gY2hhbnM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXM7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNoYW5zOyBqKyspIHtcbiAgICAgICAgICAgIEFbaSAqIGNoYW5zICsgal0gLz0gKHVNYXhbal0gPT09IDAgPyAxIDogdU1heFtqXSk7XG4gICAgICAgICAgICBBW2kgKiBjaGFucyArIGpdICo9IDAuNTtcbiAgICAgICAgICAgIEFbaSAqIGNoYW5zICsgal0gKz0gMC41O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaXZHcmFwaEZyb20yQ3VydmVzKGN1cnZlMSwgY3VydmUyLCBvdXRVTWF4KSB7XG4gICAgY29uc3Qgc3ViID0gc3ViR3JhcGgoY3VydmUyLCBjdXJ2ZTEpO1xuICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZShzdWIsIG91dFVNYXgpO1xuICAgIG5vcm1hbGl6ZUdyYXBoKHN1Yiwgb3V0VU1heCk7XG4gICAgcmV0dXJuIHN1Yjtcbn1cblxuLy8gYSBkZXZpY2UgY2FjaGUgc3RvcmluZyBkZWZhdWx0IHBhcmFtZXRlciB0ZXh0dXJlIGZvciB0aGUgZW1pdHRlclxuY29uc3QgcGFydGljbGVFbWl0dGVyRGV2aWNlQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuY2xhc3MgUGFydGljbGVFbWl0dGVyIHtcbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IGdkID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHByZWNpc2lvbiA9IDMyO1xuICAgICAgICB0aGlzLnByZWNpc2lvbiA9IHByZWNpc2lvbjtcblxuICAgICAgICB0aGlzLl9hZGRUaW1lVGltZSA9IDA7XG5cbiAgICAgICAgLy8gR2xvYmFsIHN5c3RlbSBwYXJhbWV0ZXJzXG4gICAgICAgIHNldFByb3BlcnR5VGFyZ2V0ID0gdGhpcztcbiAgICAgICAgc2V0UHJvcGVydHlPcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgc2V0UHJvcGVydHkoJ251bVBhcnRpY2xlcycsIDEpOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQW1vdW50IG9mIHBhcnRpY2xlcyBhbGxvY2F0ZWQgKG1heCBwYXJ0aWNsZXMgPSBtYXggR0wgdGV4dHVyZSB3aWR0aCBhdCB0aGlzIG1vbWVudClcblxuICAgICAgICBpZiAodGhpcy5udW1QYXJ0aWNsZXMgPiBncmFwaGljc0RldmljZS5tYXhUZXh0dXJlU2l6ZSkge1xuICAgICAgICAgICAgRGVidWcud2FybihgV0FSTklORzogY2FuJ3QgY3JlYXRlIG1vcmUgdGhhbiAke2dyYXBoaWNzRGV2aWNlLm1heFRleHR1cmVTaXplfSBwYXJ0aWNsZXMgb24gdGhpcyBkZXZpY2UuYCk7XG4gICAgICAgICAgICB0aGlzLm51bVBhcnRpY2xlcyA9IGdyYXBoaWNzRGV2aWNlLm1heFRleHR1cmVTaXplO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhdGUnLCAxKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRW1pc3Npb24gcmF0ZVxuICAgICAgICBzZXRQcm9wZXJ0eSgncmF0ZTInLCB0aGlzLnJhdGUpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbGlmZXRpbWUnLCA1MCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJ0aWNsZSBsaWZldGltZVxuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlckV4dGVudHMnLCBuZXcgVmVjMygwLCAwLCAwKSk7ICAgICAgICAvLyBTcGF3biBwb2ludCBkaXZlcmdlbmNlXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyRXh0ZW50c0lubmVyJywgbmV3IFZlYzMoMCwgMCwgMCkpOyAgIC8vIFZvbHVtZSBpbnNpZGUgZW1pdHRlckV4dGVudHMgdG8gZXhjbHVkZSBmcm9tIHJlZ2VuZXJhdGlvblxuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlclJhZGl1cycsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlclJhZGl1c0lubmVyJywgMCk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBTYW1lIGFzIEV4dGVudHNJbm5lciBidXQgZm9yIHNwaGVyaWNhbCB2b2x1bWVcbiAgICAgICAgc2V0UHJvcGVydHkoJ2VtaXR0ZXJTaGFwZScsIEVNSVRURVJTSEFQRV9CT1gpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnaW5pdGlhbFZlbG9jaXR5JywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCd3cmFwJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbG9jYWxTcGFjZScsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjcmVlblNwYWNlJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnd3JhcEJvdW5kcycsIG51bGwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnY29sb3JNYXAnLCB0aGlzLmRlZmF1bHRQYXJhbVRleHR1cmUpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbm9ybWFsTWFwJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb29wJywgdHJ1ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdwcmVXYXJtJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc29ydCcsIFBBUlRJQ0xFU09SVF9OT05FKTsgLy8gU29ydGluZyBtb2RlOiAwID0gbm9uZSwgMSA9IGJ5IGRpc3RhbmNlLCAyID0gYnkgbGlmZSwgMyA9IGJ5IC1saWZlOyAgRm9yY2VzIENQVSBtb2RlIGlmIG5vdCAwXG4gICAgICAgIHNldFByb3BlcnR5KCdtb2RlJywgUEFSVElDTEVNT0RFX0dQVSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzY2VuZScsIG51bGwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbGlnaHRpbmcnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdoYWxmTGFtYmVydCcsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2ludGVuc2l0eScsIDEuMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdHJldGNoJywgMC4wKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FsaWduVG9Nb3Rpb24nLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdkZXB0aFNvZnRlbmluZycsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbWVzaCcsIG51bGwpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1lc2ggdG8gYmUgdXNlZCBhcyBwYXJ0aWNsZS4gVmVydGV4IGJ1ZmZlciBpcyBzdXBwb3NlZCB0byBob2xkIHZlcnRleCBwb3NpdGlvbiBpbiBmaXJzdCAzIGZsb2F0cyBvZiBlYWNoIHZlcnRleFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIExlYXZlIHVuZGVmaW5lZCB0byB1c2Ugc2ltcGxlIHF1YWRzXG4gICAgICAgIHNldFByb3BlcnR5KCdwYXJ0aWNsZU5vcm1hbCcsIG5ldyBWZWMzKDAsIDEsIDApKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ29yaWVudGF0aW9uJywgUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4pO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdkZXB0aFdyaXRlJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbm9Gb2cnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdibGVuZFR5cGUnLCBCTEVORF9OT1JNQUwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbm9kZScsIG51bGwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc3RhcnRBbmdsZScsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc3RhcnRBbmdsZTInLCB0aGlzLnN0YXJ0QW5nbGUpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltVGlsZXNYJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltVGlsZXNZJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltU3RhcnRGcmFtZScsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbU51bUZyYW1lcycsIDEpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbU51bUFuaW1hdGlvbnMnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1JbmRleCcsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgncmFuZG9taXplQW5pbUluZGV4JywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbVNwZWVkJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTG9vcCcsIHRydWUpO1xuXG4gICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIgPSBuZXcgUGFydGljbGVHUFVVcGRhdGVyKHRoaXMsIGdkKTtcbiAgICAgICAgdGhpcy5fY3B1VXBkYXRlciA9IG5ldyBQYXJ0aWNsZUNQVVVwZGF0ZXIodGhpcyk7XG5cbiAgICAgICAgdGhpcy5jb25zdGFudExpZ2h0Q3ViZSA9IGdkLnNjb3BlLnJlc29sdmUoJ2xpZ2h0Q3ViZVswXScpO1xuICAgICAgICB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy53cmFwQm91bmRzVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoWzEsIDEsIDFdKTtcblxuICAgICAgICAvLyBUaW1lLWRlcGVuZGVudCBwYXJhbWV0ZXJzXG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvckdyYXBoJywgZGVmYXVsdDFDdXJ2ZTMpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnY29sb3JHcmFwaDInLCB0aGlzLmNvbG9yR3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdzY2FsZUdyYXBoJywgZGVmYXVsdDFDdXJ2ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzY2FsZUdyYXBoMicsIHRoaXMuc2NhbGVHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2FscGhhR3JhcGgnLCBkZWZhdWx0MUN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FscGhhR3JhcGgyJywgdGhpcy5hbHBoYUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgnbG9jYWxWZWxvY2l0eUdyYXBoJywgZGVmYXVsdDBDdXJ2ZTMpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbG9jYWxWZWxvY2l0eUdyYXBoMicsIHRoaXMubG9jYWxWZWxvY2l0eUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgndmVsb2NpdHlHcmFwaCcsIGRlZmF1bHQwQ3VydmUzKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3ZlbG9jaXR5R3JhcGgyJywgdGhpcy52ZWxvY2l0eUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgncm90YXRpb25TcGVlZEdyYXBoJywgZGVmYXVsdDBDdXJ2ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdyb3RhdGlvblNwZWVkR3JhcGgyJywgdGhpcy5yb3RhdGlvblNwZWVkR3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdyYWRpYWxTcGVlZEdyYXBoJywgZGVmYXVsdDBDdXJ2ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdyYWRpYWxTcGVlZEdyYXBoMicsIHRoaXMucmFkaWFsU3BlZWRHcmFwaCk7XG5cbiAgICAgICAgdGhpcy5saWdodEN1YmUgPSBuZXcgRmxvYXQzMkFycmF5KDYgKiAzKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXIgPSBuZXcgQXJyYXkoNik7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzBdID0gbmV3IFZlYzMoLTEsIDAsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpclsxXSA9IG5ldyBWZWMzKDEsIDAsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpclsyXSA9IG5ldyBWZWMzKDAsIC0xLCAwKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbM10gPSBuZXcgVmVjMygwLCAxLCAwKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbNF0gPSBuZXcgVmVjMygwLCAwLCAtMSk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzVdID0gbmV3IFZlYzMoMCwgMCwgMSk7XG5cbiAgICAgICAgdGhpcy5hbmltVGlsZXNQYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLmFuaW1QYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLmFuaW1JbmRleFBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5cbiAgICAgICAgdGhpcy5pbnRlcm5hbFRleDAgPSBudWxsO1xuICAgICAgICB0aGlzLmludGVybmFsVGV4MSA9IG51bGw7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxUZXgyID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb2xvclBhcmFtID0gbnVsbDtcblxuICAgICAgICB0aGlzLnZiVG9Tb3J0ID0gbnVsbDtcbiAgICAgICAgdGhpcy52Yk9sZCA9IG51bGw7XG4gICAgICAgIHRoaXMucGFydGljbGVEaXN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jYW1lcmEgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc3dhcFRleCA9IGZhbHNlO1xuICAgICAgICB0aGlzLnVzZU1lc2ggPSB0cnVlO1xuICAgICAgICB0aGlzLnVzZUNwdSA9ICFncmFwaGljc0RldmljZS5zdXBwb3J0c0dwdVBhcnRpY2xlcztcblxuICAgICAgICB0aGlzLnBhY2s4ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5sb2NhbEJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTm9UcmFpbCA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWwgPSBbbmV3IEJvdW5kaW5nQm94KCksIG5ldyBCb3VuZGluZ0JveCgpXTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplID0gbmV3IFZlYzMoKTtcblxuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc0NlbnRlciA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMucHJldkVtaXR0ZXJFeHRlbnRzID0gdGhpcy5lbWl0dGVyRXh0ZW50cztcbiAgICAgICAgdGhpcy5wcmV2RW1pdHRlclJhZGl1cyA9IHRoaXMuZW1pdHRlclJhZGl1cztcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc011bCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcyA9IDA7XG4gICAgICAgIC8vIHRoaXMucHJldlBvcyA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZVJlc3Bhd24gPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlTm9SZXNwYXduID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZU9uU3RvcCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZVZlcnRzID0gMDtcbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZUluZGljZXMgPSAwO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZHJhd09yZGVyID0gMDtcblxuICAgICAgICB0aGlzLnNlZWQgPSBNYXRoLnJhbmRvbSgpO1xuXG4gICAgICAgIHRoaXMuZml4ZWRUaW1lU3RlcCA9IDEuMCAvIDYwO1xuICAgICAgICB0aGlzLm1heFN1YlN0ZXBzID0gMTA7XG4gICAgICAgIHRoaXMuc2ltVGltZSA9IDA7XG4gICAgICAgIHRoaXMuc2ltVGltZVRvdGFsID0gMDtcblxuICAgICAgICB0aGlzLmJlZW5SZXNldCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2xheWVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnJlYnVpbGQoKTtcbiAgICB9XG5cbiAgICBnZXQgZGVmYXVsdFBhcmFtVGV4dHVyZSgpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuZ3JhcGhpY3NEZXZpY2UpO1xuICAgICAgICByZXR1cm4gcGFydGljbGVFbWl0dGVyRGV2aWNlQ2FjaGUuZ2V0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdXRpb24gPSAxNjtcbiAgICAgICAgICAgIGNvbnN0IGNlbnRlclBvaW50ID0gcmVzb2x1dGlvbiAqIDAuNSArIDAuNTtcbiAgICAgICAgICAgIGNvbnN0IGR0ZXggPSBuZXcgRmxvYXQzMkFycmF5KHJlc29sdXRpb24gKiByZXNvbHV0aW9uICogNCk7XG4gICAgICAgICAgICBmb3IgKGxldCB5ID0gMDsgeSA8IHJlc29sdXRpb247IHkrKykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IHggPSAwOyB4IDwgcmVzb2x1dGlvbjsgeCsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHhncmFkID0gKHggKyAxKSAtIGNlbnRlclBvaW50O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB5Z3JhZCA9ICh5ICsgMSkgLSBjZW50ZXJQb2ludDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYyA9IHNhdHVyYXRlKCgxIC0gc2F0dXJhdGUoTWF0aC5zcXJ0KHhncmFkICogeGdyYWQgKyB5Z3JhZCAqIHlncmFkKSAvIHJlc29sdXRpb24pKSAtIDAuNSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHAgPSB5ICogcmVzb2x1dGlvbiArIHg7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDRdID0gICAgIDE7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDQgKyAxXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDQgKyAyXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDQgKyAzXSA9IGM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gX2NyZWF0ZVRleHR1cmUodGhpcy5ncmFwaGljc0RldmljZSwgcmVzb2x1dGlvbiwgcmVzb2x1dGlvbiwgZHRleCwgUElYRUxGT1JNQVRfUkdCQTgsIDEuMCwgdHJ1ZSk7XG4gICAgICAgICAgICB0ZXh0dXJlLm1pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICB0ZXh0dXJlLm1hZ0ZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICByZXR1cm4gdGV4dHVyZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgb25DaGFuZ2VDYW1lcmEoKSB7XG4gICAgICAgIHRoaXMucmVnZW5TaGFkZXIoKTtcbiAgICAgICAgdGhpcy5yZXNldE1hdGVyaWFsKCk7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm91bmRzTWFkKCkge1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsLnggPSAxLjAgLyB0aGlzLndvcmxkQm91bmRzU2l6ZS54O1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsLnkgPSAxLjAgLyB0aGlzLndvcmxkQm91bmRzU2l6ZS55O1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsLnogPSAxLjAgLyB0aGlzLndvcmxkQm91bmRzU2l6ZS56O1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQuY29weSh0aGlzLndvcmxkQm91bmRzLmNlbnRlcikubXVsKHRoaXMud29ybGRCb3VuZHNNdWwpLm11bFNjYWxhcigtMSk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQueCArPSAwLjU7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQueSArPSAwLjU7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQueiArPSAwLjU7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlV29ybGRCb3VuZHMoKSB7XG4gICAgICAgIGlmICghdGhpcy5ub2RlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kc1NpemUpO1xuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc0NlbnRlci5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKTtcblxuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICBsZXQgcmVjYWxjdWxhdGVMb2NhbEJvdW5kcyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlclNoYXBlID09PSBFTUlUVEVSU0hBUEVfQk9YKSB7XG4gICAgICAgICAgICAgICAgcmVjYWxjdWxhdGVMb2NhbEJvdW5kcyA9ICF0aGlzLmVtaXR0ZXJFeHRlbnRzLmVxdWFscyh0aGlzLnByZXZFbWl0dGVyRXh0ZW50cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlY2FsY3VsYXRlTG9jYWxCb3VuZHMgPSAhKHRoaXMuZW1pdHRlclJhZGl1cyA9PT0gdGhpcy5wcmV2RW1pdHRlclJhZGl1cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVjYWxjdWxhdGVMb2NhbEJvdW5kcykge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsY3VsYXRlTG9jYWxCb3VuZHMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgY29uc3Qgbm9kZVdUID0gdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsLmNvcHkodGhpcy5sb2NhbEJvdW5kcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzTm9UcmFpbC5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMubG9jYWxCb3VuZHMsIG5vZGVXVCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMF0uYWRkKHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdLmFkZCh0aGlzLndvcmxkQm91bmRzTm9UcmFpbCk7XG5cbiAgICAgICAgY29uc3Qgbm93ID0gdGhpcy5zaW1UaW1lVG90YWw7XG4gICAgICAgIGlmIChub3cgPj0gdGhpcy50aW1lVG9Td2l0Y2hCb3VuZHMpIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5jb3B5KHRoaXMud29ybGRCb3VuZHNUcmFpbFsxXSk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzTm9UcmFpbCk7XG4gICAgICAgICAgICB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcyA9IG5vdyArIHRoaXMubGlmZXRpbWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndvcmxkQm91bmRzLmNvcHkodGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdKTtcblxuICAgICAgICB0aGlzLndvcmxkQm91bmRzU2l6ZS5jb3B5KHRoaXMud29ybGRCb3VuZHMuaGFsZkV4dGVudHMpLm11bFNjYWxhcigyKTtcblxuICAgICAgICBpZiAodGhpcy5sb2NhbFNwYWNlKSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy53b3JsZEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm1lc2guYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMud29ybGRCb3VuZHMsIG5vZGVXVCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tZXNoLmFhYmIuY29weSh0aGlzLndvcmxkQm91bmRzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fYWFiYlZlciA9IDEgLSB0aGlzLm1lc2hJbnN0YW5jZS5fYWFiYlZlcjtcblxuICAgICAgICBpZiAodGhpcy5wYWNrOCkgdGhpcy5jYWxjdWxhdGVCb3VuZHNNYWQoKTtcbiAgICB9XG5cbiAgICByZXNldFdvcmxkQm91bmRzKCkge1xuICAgICAgICBpZiAoIXRoaXMubm9kZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoXG4gICAgICAgICAgICB0aGlzLmxvY2FsQm91bmRzLCB0aGlzLmxvY2FsU3BhY2UgPyBNYXQ0LklERU5USVRZIDogdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5jb3B5KHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdLmNvcHkodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHMuY29weSh0aGlzLndvcmxkQm91bmRzVHJhaWxbMF0pO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzU2l6ZS5jb3B5KHRoaXMud29ybGRCb3VuZHMuaGFsZkV4dGVudHMpLm11bFNjYWxhcigyKTtcblxuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyLmNvcHkodGhpcy53b3JsZEJvdW5kcy5jZW50ZXIpO1xuXG4gICAgICAgIHRoaXMuc2ltVGltZVRvdGFsID0gMDtcbiAgICAgICAgdGhpcy50aW1lVG9Td2l0Y2hCb3VuZHMgPSAwO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUxvY2FsQm91bmRzKCkge1xuICAgICAgICBsZXQgbWlueCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtaW55ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgbGV0IG1pbnogPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4eCA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4eSA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4eiA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4UiA9IDA7XG4gICAgICAgIGxldCBtYXhTY2FsZSA9IDA7XG4gICAgICAgIGNvbnN0IHN0ZXBXZWlnaHQgPSB0aGlzLmxpZmV0aW1lIC8gdGhpcy5wcmVjaXNpb247XG4gICAgICAgIGNvbnN0IHdWZWxzID0gW3RoaXMucVZlbG9jaXR5LCB0aGlzLnFWZWxvY2l0eTJdO1xuICAgICAgICBjb25zdCBsVmVscyA9IFt0aGlzLnFMb2NhbFZlbG9jaXR5LCB0aGlzLnFMb2NhbFZlbG9jaXR5Ml07XG4gICAgICAgIGNvbnN0IGFjY3VtWCA9IFswLCAwXTtcbiAgICAgICAgY29uc3QgYWNjdW1ZID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVogPSBbMCwgMF07XG4gICAgICAgIGNvbnN0IGFjY3VtUiA9IFswLCAwXTtcbiAgICAgICAgY29uc3QgYWNjdW1XID0gWzAsIDBdO1xuICAgICAgICBsZXQgeCwgeSwgejtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnByZWNpc2lvbiArIDE7IGkrKykgeyAvLyB0YWtlIGV4dHJhIHN0ZXAgdG8gcHJldmVudCBwb3NpdGlvbiBnbGl0Y2hlc1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBNYXRoLm1pbihpLCB0aGlzLnByZWNpc2lvbiAtIDEpO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCAyOyBqKyspIHtcbiAgICAgICAgICAgICAgICB4ID0gbFZlbHNbal1baW5kZXggKiAzICsgMF0gKiBzdGVwV2VpZ2h0ICsgYWNjdW1YW2pdO1xuICAgICAgICAgICAgICAgIHkgPSBsVmVsc1tqXVtpbmRleCAqIDMgKyAxXSAqIHN0ZXBXZWlnaHQgKyBhY2N1bVlbal07XG4gICAgICAgICAgICAgICAgeiA9IGxWZWxzW2pdW2luZGV4ICogMyArIDJdICogc3RlcFdlaWdodCArIGFjY3VtWltqXTtcblxuICAgICAgICAgICAgICAgIG1pbnggPSBNYXRoLm1pbih4LCBtaW54KTtcbiAgICAgICAgICAgICAgICBtaW55ID0gTWF0aC5taW4oeSwgbWlueSk7XG4gICAgICAgICAgICAgICAgbWlueiA9IE1hdGgubWluKHosIG1pbnopO1xuICAgICAgICAgICAgICAgIG1heHggPSBNYXRoLm1heCh4LCBtYXh4KTtcbiAgICAgICAgICAgICAgICBtYXh5ID0gTWF0aC5tYXgoeSwgbWF4eSk7XG4gICAgICAgICAgICAgICAgbWF4eiA9IE1hdGgubWF4KHosIG1heHopO1xuXG4gICAgICAgICAgICAgICAgYWNjdW1YW2pdID0geDtcbiAgICAgICAgICAgICAgICBhY2N1bVlbal0gPSB5O1xuICAgICAgICAgICAgICAgIGFjY3VtWltqXSA9IHo7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDI7IGorKykge1xuICAgICAgICAgICAgICAgIGFjY3VtV1tqXSArPSBzdGVwV2VpZ2h0ICogTWF0aC5zcXJ0KFxuICAgICAgICAgICAgICAgICAgICB3VmVsc1tqXVtpbmRleCAqIDMgKyAwXSAqIHdWZWxzW2pdW2luZGV4ICogMyArIDBdICtcbiAgICAgICAgICAgICAgICAgICAgd1ZlbHNbal1baW5kZXggKiAzICsgMV0gKiB3VmVsc1tqXVtpbmRleCAqIDMgKyAxXSArXG4gICAgICAgICAgICAgICAgICAgIHdWZWxzW2pdW2luZGV4ICogMyArIDJdICogd1ZlbHNbal1baW5kZXggKiAzICsgMl0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhY2N1bVJbMF0gKz0gdGhpcy5xUmFkaWFsU3BlZWRbaW5kZXhdICogc3RlcFdlaWdodDtcbiAgICAgICAgICAgIGFjY3VtUlsxXSArPSB0aGlzLnFSYWRpYWxTcGVlZDJbaW5kZXhdICogc3RlcFdlaWdodDtcbiAgICAgICAgICAgIG1heFIgPSBNYXRoLm1heChtYXhSLCBNYXRoLm1heChNYXRoLmFicyhhY2N1bVJbMF0pLCBNYXRoLmFicyhhY2N1bVJbMV0pKSk7XG5cbiAgICAgICAgICAgIG1heFNjYWxlID0gTWF0aC5tYXgobWF4U2NhbGUsIHRoaXMucVNjYWxlW2luZGV4XSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgIHggPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnggKiAwLjU7XG4gICAgICAgICAgICB5ID0gdGhpcy5lbWl0dGVyRXh0ZW50cy55ICogMC41O1xuICAgICAgICAgICAgeiA9IHRoaXMuZW1pdHRlckV4dGVudHMueiAqIDAuNTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHggPSB0aGlzLmVtaXR0ZXJSYWRpdXM7XG4gICAgICAgICAgICB5ID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICAgICAgeiA9IHRoaXMuZW1pdHRlclJhZGl1cztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHcgPSBNYXRoLm1heChhY2N1bVdbMF0sIGFjY3VtV1sxXSk7XG4gICAgICAgIGJNaW4ueCA9IG1pbnggLSBtYXhTY2FsZSAtIHggLSBtYXhSIC0gdztcbiAgICAgICAgYk1pbi55ID0gbWlueSAtIG1heFNjYWxlIC0geSAtIG1heFIgLSB3O1xuICAgICAgICBiTWluLnogPSBtaW56IC0gbWF4U2NhbGUgLSB6IC0gbWF4UiAtIHc7XG4gICAgICAgIGJNYXgueCA9IG1heHggKyBtYXhTY2FsZSArIHggKyBtYXhSICsgdztcbiAgICAgICAgYk1heC55ID0gbWF4eSArIG1heFNjYWxlICsgeSArIG1heFIgKyB3O1xuICAgICAgICBiTWF4LnogPSBtYXh6ICsgbWF4U2NhbGUgKyB6ICsgbWF4UiArIHc7XG4gICAgICAgIHRoaXMubG9jYWxCb3VuZHMuc2V0TWluTWF4KGJNaW4sIGJNYXgpO1xuICAgIH1cblxuICAgIHJlYnVpbGQoKSB7XG4gICAgICAgIGNvbnN0IGdkID0gdGhpcy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICBpZiAodGhpcy5jb2xvck1hcCA9PT0gbnVsbCkgdGhpcy5jb2xvck1hcCA9IHRoaXMuZGVmYXVsdFBhcmFtVGV4dHVyZTtcblxuICAgICAgICB0aGlzLnNwYXduQm91bmRzID0gdGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1ggPyB0aGlzLmVtaXR0ZXJFeHRlbnRzIDogdGhpcy5lbWl0dGVyUmFkaXVzO1xuXG4gICAgICAgIHRoaXMudXNlQ3B1ID0gdGhpcy51c2VDcHUgfHwgdGhpcy5zb3J0ID4gUEFSVElDTEVTT1JUX05PTkUgfHwgIC8vIGZvcmNlIENQVSBpZiBkZXNpcmFibGUgYnkgdXNlciBvciBzb3J0aW5nIGlzIGVuYWJsZWRcbiAgICAgICAgZ2QubWF4VmVydGV4VGV4dHVyZXMgPD0gMSB8fCAvLyBmb3JjZSBDUFUgaWYgY2FuJ3QgdXNlIGVub3VnaCB2ZXJ0ZXggdGV4dHVyZXNcbiAgICAgICAgZ2QuZnJhZ21lbnRVbmlmb3Jtc0NvdW50IDwgNjQgfHwgLy8gZm9yY2UgQ1BVIGlmIGNhbid0IHVzZSBtYW55IHVuaWZvcm1zOyBUT0RPOiBjaGFuZ2UgdG8gbW9yZSByZWFsaXN0aWMgdmFsdWUgKHRoaXMgb25lIGlzIGlwaG9uZSdzKVxuICAgICAgICBnZC5mb3JjZUNwdVBhcnRpY2xlcyB8fFxuICAgICAgICAhZ2QuZXh0VGV4dHVyZUZsb2F0OyAvLyBubyBmbG9hdCB0ZXh0dXJlIGV4dGVuc2lvblxuXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lSZXNvdXJjZXMoKTtcblxuICAgICAgICB0aGlzLnBhY2s4ID0gKHRoaXMucGFjazggfHwgIWdkLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpICYmICF0aGlzLnVzZUNwdTtcblxuICAgICAgICBwYXJ0aWNsZVRleEhlaWdodCA9ICh0aGlzLnVzZUNwdSB8fCB0aGlzLnBhY2s4KSA/IDQgOiAyO1xuXG4gICAgICAgIHRoaXMudXNlTWVzaCA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5tZXNoKSB7XG4gICAgICAgICAgICBjb25zdCB0b3RhbFZlcnRDb3VudCA9IHRoaXMubnVtUGFydGljbGVzICogdGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIGlmICh0b3RhbFZlcnRDb3VudCA+IDY1NTM1KSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybignV0FSTklORzogcGFydGljbGUgc3lzdGVtIGNhblxcJ3QgcmVuZGVyIG1lc2ggcGFydGljbGVzIGJlY2F1c2UgbnVtUGFydGljbGVzICogbnVtVmVydGljZXMgaXMgbW9yZSB0aGFuIDY1ay4gUmV2ZXJ0aW5nIHRvIHF1YWQgcGFydGljbGVzLicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVzZU1lc2ggPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZXNQb3QgPSBtYXRoLm5leHRQb3dlck9mVHdvKHRoaXMubnVtUGFydGljbGVzKTtcbiAgICAgICAgdGhpcy5yZWJ1aWxkR3JhcGhzKCk7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlTG9jYWxCb3VuZHMoKTtcbiAgICAgICAgdGhpcy5yZXNldFdvcmxkQm91bmRzKCk7XG5cbiAgICAgICAgaWYgKHRoaXMubm9kZSkge1xuICAgICAgICAgICAgLy8gdGhpcy5wcmV2UG9zLmNvcHkodGhpcy5ub2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kcy5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKFxuICAgICAgICAgICAgICAgIHRoaXMubG9jYWxCb3VuZHMsIHRoaXMubG9jYWxTcGFjZSA/IE1hdDQuSURFTlRJVFkgOiB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG5cbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5jb3B5KHRoaXMud29ybGRCb3VuZHMpO1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG5cbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuICAgICAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kc1NpemUpO1xuICAgICAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNDZW50ZXIuY29weSh0aGlzLndvcmxkQm91bmRzLmNlbnRlcik7XG4gICAgICAgICAgICBpZiAodGhpcy5wYWNrOCkgdGhpcy5jYWxjdWxhdGVCb3VuZHNNYWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIER5bmFtaWMgc2ltdWxhdGlvbiBkYXRhXG4gICAgICAgIHRoaXMudmJUb1NvcnQgPSBuZXcgQXJyYXkodGhpcy5udW1QYXJ0aWNsZXMpO1xuICAgICAgICBmb3IgKGxldCBpU29ydCA9IDA7IGlTb3J0IDwgdGhpcy5udW1QYXJ0aWNsZXM7IGlTb3J0KyspIHRoaXMudmJUb1NvcnRbaVNvcnRdID0gWzAsIDBdO1xuICAgICAgICB0aGlzLnBhcnRpY2xlRGlzdGFuY2UgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtUGFydGljbGVzKTtcblxuICAgICAgICB0aGlzLl9ncHVVcGRhdGVyLnJhbmRvbWl6ZSgpO1xuXG4gICAgICAgIHRoaXMucGFydGljbGVUZXggPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtUGFydGljbGVzUG90ICogcGFydGljbGVUZXhIZWlnaHQgKiBwYXJ0aWNsZVRleENoYW5uZWxzKTtcbiAgICAgICAgY29uc3QgZW1pdHRlclBvcyA9ICh0aGlzLm5vZGUgPT09IG51bGwgfHwgdGhpcy5sb2NhbFNwYWNlKSA/IFZlYzMuWkVSTyA6IHRoaXMubm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm5vZGUgPT09IG51bGwgfHwgdGhpcy5sb2NhbFNwYWNlKSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgUXVhdC5JREVOVElUWSwgdGhpcy5zcGF3bkJvdW5kcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNwYXduTWF0cml4LnNldFRSUyhWZWMzLlpFUk8sIHRoaXMubm9kZS5nZXRSb3RhdGlvbigpLCB0bXBWZWMzLmNvcHkodGhpcy5zcGF3bkJvdW5kcykubXVsKHRoaXMubm9kZS5sb2NhbFNjYWxlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMF0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnggIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueCAvIHRoaXMuZW1pdHRlckV4dGVudHMueCA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMV0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueSAvIHRoaXMuZW1pdHRlckV4dGVudHMueSA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMl0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnogIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueiAvIHRoaXMuZW1pdHRlckV4dGVudHMueiA6IDA7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm51bVBhcnRpY2xlczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jcHVVcGRhdGVyLmNhbGNTcGF3blBvc2l0aW9uKHRoaXMucGFydGljbGVUZXgsIHNwYXduTWF0cml4LCBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0sIGVtaXR0ZXJQb3MsIGkpO1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlQ3B1KSB0aGlzLnBhcnRpY2xlVGV4W2kgKiBwYXJ0aWNsZVRleENoYW5uZWxzICsgMyArIHRoaXMubnVtUGFydGljbGVzUG90ICogMiAqIHBhcnRpY2xlVGV4Q2hhbm5lbHNdID0gMTsgLy8gaGlkZS9zaG93XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtUGFydGljbGVzUG90ICogcGFydGljbGVUZXhIZWlnaHQgKiBwYXJ0aWNsZVRleENoYW5uZWxzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydFtpXSA9IHRoaXMucGFydGljbGVUZXhbaV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wYWNrOCkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTiA9IF9jcmVhdGVUZXh0dXJlKGdkLCB0aGlzLm51bVBhcnRpY2xlc1BvdCwgcGFydGljbGVUZXhIZWlnaHQsIHRoaXMucGFydGljbGVUZXgsIFBJWEVMRk9STUFUX1JHQkE4LCAxLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleE9VVCA9IF9jcmVhdGVUZXh0dXJlKGdkLCB0aGlzLm51bVBhcnRpY2xlc1BvdCwgcGFydGljbGVUZXhIZWlnaHQsIHRoaXMucGFydGljbGVUZXgsIFBJWEVMRk9STUFUX1JHQkE4LCAxLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0ID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0LCBQSVhFTEZPUk1BVF9SR0JBOCwgMSwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4SU4gPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VUID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0ID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4SU4gPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGhpcy5wYXJ0aWNsZVRleElOLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhPVVQgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGhpcy5wYXJ0aWNsZVRleE9VVCxcbiAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5zd2FwVGV4ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzaGFkZXJDb2RlU3RhcnQgPSAodGhpcy5sb2NhbFNwYWNlID8gJyNkZWZpbmUgTE9DQUxfU1BBQ0VcXG4nIDogJycpICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlckluaXRQUyArXG4gICAgICAgICh0aGlzLnBhY2s4ID8gKHNoYWRlckNodW5rcy5wYXJ0aWNsZUlucHV0UmdiYThQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZU91dHB1dFJnYmE4UFMpIDpcbiAgICAgICAgICAgIChzaGFkZXJDaHVua3MucGFydGljbGVJbnB1dEZsb2F0UFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVPdXRwdXRGbG9hdFBTKSkgK1xuICAgICAgICAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1ggPyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyQUFCQlBTIDogc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclNwaGVyZVBTKSArXG4gICAgICAgIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJTdGFydFBTO1xuICAgICAgICBjb25zdCBzaGFkZXJDb2RlUmVzcGF3biA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJSZXNwYXduUFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyRW5kUFM7XG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVOb1Jlc3Bhd24gPSBzaGFkZXJDb2RlU3RhcnQgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyTm9SZXNwYXduUFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyRW5kUFM7XG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVPblN0b3AgPSBzaGFkZXJDb2RlU3RhcnQgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyT25TdG9wUFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyRW5kUFM7XG5cbiAgICAgICAgLy8gTm90ZTogY3JlYXRlU2hhZGVyRnJvbUNvZGUgY2FuIHJldHVybiBhIHNoYWRlciBmcm9tIHRoZSBjYWNoZSAobm90IGEgbmV3IHNoYWRlcikgc28gd2UgKnNob3VsZCBub3QqIGRlbGV0ZSB0aGVzZSBzaGFkZXJzXG4gICAgICAgIC8vIHdoZW4gdGhlIHBhcnRpY2xlIGVtaXR0ZXIgaXMgZGVzdHJveWVkXG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHRoaXMuZW1pdHRlclNoYXBlICsgJycgKyB0aGlzLnBhY2s4ICsgJycgKyB0aGlzLmxvY2FsU3BhY2U7XG4gICAgICAgIHRoaXMuc2hhZGVyUGFydGljbGVVcGRhdGVSZXNwYXduID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlUmVzcGF3biwgJ2ZzUXVhZDAnICsgcGFyYW1zKTtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZU5vUmVzcGF3biA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKGdkLCBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUywgc2hhZGVyQ29kZU5vUmVzcGF3biwgJ2ZzUXVhZDEnICsgcGFyYW1zKTtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZU9uU3RvcCA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKGdkLCBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUywgc2hhZGVyQ29kZU9uU3RvcCwgJ2ZzUXVhZDInICsgcGFyYW1zKTtcblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlVmVydHMgPSB0aGlzLnVzZU1lc2ggPyB0aGlzLm1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzIDogNDtcbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZUluZGljZXMgPSB0aGlzLnVzZU1lc2ggPyB0aGlzLm1lc2guaW5kZXhCdWZmZXJbMF0ubnVtSW5kaWNlcyA6IDY7XG4gICAgICAgIHRoaXMuX2FsbG9jYXRlKHRoaXMubnVtUGFydGljbGVzKTtcblxuICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZ2QpO1xuICAgICAgICBtZXNoLnZlcnRleEJ1ZmZlciA9IHRoaXMudmVydGV4QnVmZmVyO1xuICAgICAgICBtZXNoLmluZGV4QnVmZmVyWzBdID0gdGhpcy5pbmRleEJ1ZmZlcjtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9ICh0aGlzLm51bVBhcnRpY2xlcyAqIHRoaXMubnVtUGFydGljbGVJbmRpY2VzKTtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLm5hbWUgPSB0aGlzLm5vZGUubmFtZTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuYmxlbmQgPSB0cnVlO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmJsZW5kVHlwZSA9IHRoaXMuYmxlbmRUeXBlO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWwuZGVwdGhXcml0ZSA9IHRoaXMuZGVwdGhXcml0ZTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5lbWl0dGVyID0gdGhpcztcblxuICAgICAgICB0aGlzLnJlZ2VuU2hhZGVyKCk7XG4gICAgICAgIHRoaXMucmVzZXRNYXRlcmlhbCgpO1xuXG4gICAgICAgIGNvbnN0IHdhc1Zpc2libGUgPSB0aGlzLm1lc2hJbnN0YW5jZSA/IHRoaXMubWVzaEluc3RhbmNlLnZpc2libGUgOiB0cnVlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaCwgdGhpcy5tYXRlcmlhbCwgdGhpcy5ub2RlKTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UucGljayA9IGZhbHNlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS51cGRhdGVLZXkoKTsgLy8gc2hvdWxkbid0IGJlIGhlcmU/XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmN1bGwgPSB0cnVlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fbm9EZXB0aERyYXdHbDEgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5sb2NhbFNwYWNlKSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy53b3JsZEJvdW5kcywgdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuYWFiYi5jb3B5KHRoaXMud29ybGRCb3VuZHMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl91cGRhdGVBYWJiID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnZpc2libGUgPSB3YXNWaXNpYmxlO1xuXG4gICAgICAgIHRoaXMuX2luaXRpYWxpemVUZXh0dXJlcygpO1xuXG4gICAgICAgIHRoaXMucmVzZXRUaW1lKCk7XG5cbiAgICAgICAgdGhpcy5hZGRUaW1lKDAsIGZhbHNlKTsgLy8gZmlsbCBkeW5hbWljIHRleHR1cmVzIGFuZCBjb25zdGFudHMgd2l0aCBpbml0aWFsIGRhdGFcbiAgICAgICAgaWYgKHRoaXMucHJlV2FybSkgdGhpcy5wcmV3YXJtKHRoaXMubGlmZXRpbWUpO1xuICAgIH1cblxuICAgIF9pc0FuaW1hdGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hbmltTnVtRnJhbWVzID49IDEgJiZcbiAgICAgICAgICAgICAgICh0aGlzLmFuaW1UaWxlc1ggPiAxIHx8IHRoaXMuYW5pbVRpbGVzWSA+IDEpICYmXG4gICAgICAgICAgICAgICAodGhpcy5jb2xvck1hcCAmJiB0aGlzLmNvbG9yTWFwICE9PSB0aGlzLmRlZmF1bHRQYXJhbVRleHR1cmUgfHwgdGhpcy5ub3JtYWxNYXApO1xuICAgIH1cblxuICAgIHJlYnVpbGRHcmFwaHMoKSB7XG4gICAgICAgIGNvbnN0IHByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uO1xuICAgICAgICBjb25zdCBnZCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgdGhpcy5xTG9jYWxWZWxvY2l0eSA9IHRoaXMubG9jYWxWZWxvY2l0eUdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVZlbG9jaXR5ID0gdGhpcy52ZWxvY2l0eUdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUNvbG9yID0gICAgICAgICB0aGlzLmNvbG9yR3JhcGgucXVhbnRpemVDbGFtcGVkKHByZWNpc2lvbiwgMCwgMSk7XG4gICAgICAgIHRoaXMucVJvdFNwZWVkID0gICAgICB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFTY2FsZSA9ICAgICAgICAgdGhpcy5zY2FsZUdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUFscGhhID0gICAgICAgICB0aGlzLmFscGhhR3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xUmFkaWFsU3BlZWQgPSAgIHRoaXMucmFkaWFsU3BlZWRHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuXG4gICAgICAgIHRoaXMucUxvY2FsVmVsb2NpdHkyID0gdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVZlbG9jaXR5MiA9ICAgICAgdGhpcy52ZWxvY2l0eUdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFDb2xvcjIgPSAgICAgICAgIHRoaXMuY29sb3JHcmFwaDIucXVhbnRpemVDbGFtcGVkKHByZWNpc2lvbiwgMCwgMSk7XG4gICAgICAgIHRoaXMucVJvdFNwZWVkMiA9ICAgICAgdGhpcy5yb3RhdGlvblNwZWVkR3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVNjYWxlMiA9ICAgICAgICAgdGhpcy5zY2FsZUdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFBbHBoYTIgPSAgICAgICAgIHRoaXMuYWxwaGFHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xUmFkaWFsU3BlZWQyID0gICB0aGlzLnJhZGlhbFNwZWVkR3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVjaXNpb247IGkrKykge1xuICAgICAgICAgICAgdGhpcy5xUm90U3BlZWRbaV0gKj0gbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgdGhpcy5xUm90U3BlZWQyW2ldICo9IG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9jYWxWZWxvY2l0eVVNYXggPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLnZlbG9jaXR5VU1heCA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuY29sb3JVTWF4ID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5yb3RTcGVlZFVNYXggPSBbMF07XG4gICAgICAgIHRoaXMuc2NhbGVVTWF4ID0gICAgWzBdO1xuICAgICAgICB0aGlzLmFscGhhVU1heCA9ICAgIFswXTtcbiAgICAgICAgdGhpcy5yYWRpYWxTcGVlZFVNYXggPSBbMF07XG4gICAgICAgIHRoaXMucUxvY2FsVmVsb2NpdHlEaXYgPSBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucUxvY2FsVmVsb2NpdHksIHRoaXMucUxvY2FsVmVsb2NpdHkyLCB0aGlzLmxvY2FsVmVsb2NpdHlVTWF4KTtcbiAgICAgICAgdGhpcy5xVmVsb2NpdHlEaXYgPSAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xVmVsb2NpdHksIHRoaXMucVZlbG9jaXR5MiwgdGhpcy52ZWxvY2l0eVVNYXgpO1xuICAgICAgICB0aGlzLnFDb2xvckRpdiA9ICAgICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFDb2xvciwgdGhpcy5xQ29sb3IyLCB0aGlzLmNvbG9yVU1heCk7XG4gICAgICAgIHRoaXMucVJvdFNwZWVkRGl2ID0gICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucVJvdFNwZWVkLCB0aGlzLnFSb3RTcGVlZDIsIHRoaXMucm90U3BlZWRVTWF4KTtcbiAgICAgICAgdGhpcy5xU2NhbGVEaXYgPSAgICAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xU2NhbGUsIHRoaXMucVNjYWxlMiwgdGhpcy5zY2FsZVVNYXgpO1xuICAgICAgICB0aGlzLnFBbHBoYURpdiA9ICAgICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFBbHBoYSwgdGhpcy5xQWxwaGEyLCB0aGlzLmFscGhhVU1heCk7XG4gICAgICAgIHRoaXMucVJhZGlhbFNwZWVkRGl2ID0gICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucVJhZGlhbFNwZWVkLCB0aGlzLnFSYWRpYWxTcGVlZDIsIHRoaXMucmFkaWFsU3BlZWRVTWF4KTtcblxuICAgICAgICBpZiAodGhpcy5wYWNrOCkge1xuICAgICAgICAgICAgY29uc3QgdW1heCA9IFswLCAwLCAwXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFWZWxvY2l0eSwgdW1heCk7XG4gICAgICAgICAgICBjb25zdCB1bWF4MiA9IFswLCAwLCAwXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFWZWxvY2l0eTIsIHVtYXgyKTtcblxuICAgICAgICAgICAgY29uc3QgbHVtYXggPSBbMCwgMCwgMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xTG9jYWxWZWxvY2l0eSwgbHVtYXgpO1xuICAgICAgICAgICAgY29uc3QgbHVtYXgyID0gWzAsIDAsIDBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucUxvY2FsVmVsb2NpdHkyLCBsdW1heDIpO1xuXG4gICAgICAgICAgICBjb25zdCBydW1heCA9IFswXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFSYWRpYWxTcGVlZCwgcnVtYXgpO1xuICAgICAgICAgICAgY29uc3QgcnVtYXgyID0gWzBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVJhZGlhbFNwZWVkMiwgcnVtYXgyKTtcblxuICAgICAgICAgICAgbGV0IG1heFZlbCA9IE1hdGgubWF4KHVtYXhbMF0sIHVtYXgyWzBdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heFsxXSk7XG4gICAgICAgICAgICBtYXhWZWwgPSBNYXRoLm1heChtYXhWZWwsIHVtYXgyWzFdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heFsyXSk7XG4gICAgICAgICAgICBtYXhWZWwgPSBNYXRoLm1heChtYXhWZWwsIHVtYXgyWzJdKTtcblxuICAgICAgICAgICAgbGV0IGxtYXhWZWwgPSBNYXRoLm1heChsdW1heFswXSwgbHVtYXgyWzBdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heFsxXSk7XG4gICAgICAgICAgICBsbWF4VmVsID0gTWF0aC5tYXgobG1heFZlbCwgbHVtYXgyWzFdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heFsyXSk7XG4gICAgICAgICAgICBsbWF4VmVsID0gTWF0aC5tYXgobG1heFZlbCwgbHVtYXgyWzJdKTtcblxuICAgICAgICAgICAgY29uc3QgbWF4UmFkID0gTWF0aC5tYXgocnVtYXhbMF0sIHJ1bWF4MlswXSk7XG5cbiAgICAgICAgICAgIHRoaXMubWF4VmVsID0gbWF4VmVsICsgbG1heFZlbCArIG1heFJhZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgwID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmVYWVpfTlhZWih0aGlzLnFMb2NhbFZlbG9jaXR5LCB0aGlzLnFMb2NhbFZlbG9jaXR5RGl2KSk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MSA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlWFlaX05YWVoodGhpcy5xVmVsb2NpdHksIHRoaXMucVZlbG9jaXR5RGl2KSk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MiA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlNUZsb2F0cyh0aGlzLnFSb3RTcGVlZCwgdGhpcy5xU2NhbGUsIHRoaXMucVNjYWxlRGl2LCB0aGlzLnFSb3RTcGVlZERpdiwgdGhpcy5xQWxwaGFEaXYpKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgzID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmUyRmxvYXRzKHRoaXMucVJhZGlhbFNwZWVkLCB0aGlzLnFSYWRpYWxTcGVlZERpdikpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29sb3JQYXJhbSA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlUkdCQSh0aGlzLnFDb2xvciwgdGhpcy5xQWxwaGEpLCBQSVhFTEZPUk1BVF9SR0JBOCwgMS4wLCB0cnVlKTtcbiAgICB9XG5cbiAgICBfaW5pdGlhbGl6ZVRleHR1cmVzKCkge1xuICAgICAgICBpZiAodGhpcy5jb2xvck1hcCkge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2NvbG9yTWFwJywgdGhpcy5jb2xvck1hcCk7XG4gICAgICAgICAgICBpZiAodGhpcy5saWdodGluZyAmJiB0aGlzLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdub3JtYWxNYXAnLCB0aGlzLm5vcm1hbE1hcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWdlblNoYWRlcigpIHtcbiAgICAgICAgY29uc3QgcHJvZ3JhbUxpYiA9IGdldFByb2dyYW1MaWJyYXJ5KHRoaXMuZ3JhcGhpY3NEZXZpY2UpO1xuICAgICAgICBwcm9ncmFtTGliLnJlZ2lzdGVyKCdwYXJ0aWNsZScsIHBhcnRpY2xlKTtcblxuICAgICAgICBjb25zdCBoYXNOb3JtYWwgPSAodGhpcy5ub3JtYWxNYXAgIT09IG51bGwpO1xuICAgICAgICB0aGlzLm5vcm1hbE9wdGlvbiA9IDA7XG4gICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nKSB7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbE9wdGlvbiA9IGhhc05vcm1hbCA/IDIgOiAxO1xuICAgICAgICB9XG4gICAgICAgIC8vIGdldFNoYWRlclZhcmlhbnQgaXMgYWxzbyBjYWxsZWQgYnkgcGMuU2NlbmUgd2hlbiBhbGwgc2hhZGVycyBuZWVkIHRvIGJlIHVwZGF0ZWRcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5nZXRTaGFkZXJWYXJpYW50ID0gZnVuY3Rpb24gKGRldiwgc2MsIGRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCkge1xuXG4gICAgICAgICAgICAvLyBUaGUgYXBwIHdvcmtzIGxpa2UgdGhpczpcbiAgICAgICAgICAgIC8vIDEuIEVtaXR0ZXIgaW5pdFxuICAgICAgICAgICAgLy8gMi4gVXBkYXRlLiBObyBjYW1lcmEgaXMgYXNzaWduZWQgdG8gZW1pdHRlcnNcbiAgICAgICAgICAgIC8vIDMuIFJlbmRlcjsgYWN0aXZlQ2FtZXJhID0gY2FtZXJhOyBzaGFkZXIgaW5pdFxuICAgICAgICAgICAgLy8gNC4gVXBkYXRlLiBhY3RpdmVDYW1lcmEgaXMgc2V0IHRvIGVtaXR0ZXJzXG4gICAgICAgICAgICAvLyAtLS0tLVxuICAgICAgICAgICAgLy8gVGhlIHByb2JsZW0gd2l0aCAxc3QgZnJhbWUgcmVuZGVyIGlzIHRoYXQgd2UgaW5pdCB0aGUgc2hhZGVyIHdpdGhvdXQgaGF2aW5nIGFueSBjYW1lcmEgc2V0IHRvIGVtaXR0ZXIgLVxuICAgICAgICAgICAgLy8gc28gd3Jvbmcgc2hhZGVyIGlzIGJlaW5nIGNvbXBpbGVkLlxuICAgICAgICAgICAgLy8gVG8gZml4IGl0LCB3ZSBuZWVkIHRvIGNoZWNrIGFjdGl2ZUNhbWVyYSE9ZW1pdHRlci5jYW1lcmEgaW4gc2hhZGVyIGluaXQgdG9vXG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyLnNjZW5lKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlci5jYW1lcmEgIT09IHRoaXMuZW1pdHRlci5zY2VuZS5fYWN0aXZlQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5jYW1lcmEgPSB0aGlzLmVtaXR0ZXIuc2NlbmUuX2FjdGl2ZUNhbWVyYTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm9uQ2hhbmdlQ2FtZXJhKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgYnkgRWRpdG9yIGlmIHJ1bm5pbmcgaW5zaWRlIGVkaXRvclxuICAgICAgICAgICAgY29uc3QgaW5Ub29scyA9IHRoaXMuZW1pdHRlci5pblRvb2xzO1xuXG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSBwcm9ncmFtTGliLmdldFByb2dyYW0oJ3BhcnRpY2xlJywge1xuICAgICAgICAgICAgICAgIHVzZUNwdTogdGhpcy5lbWl0dGVyLnVzZUNwdSxcbiAgICAgICAgICAgICAgICBub3JtYWw6IHRoaXMuZW1pdHRlci5ub3JtYWxPcHRpb24sXG4gICAgICAgICAgICAgICAgaGFsZmxhbWJlcnQ6IHRoaXMuZW1pdHRlci5oYWxmTGFtYmVydCxcbiAgICAgICAgICAgICAgICBzdHJldGNoOiB0aGlzLmVtaXR0ZXIuc3RyZXRjaCxcbiAgICAgICAgICAgICAgICBhbGlnblRvTW90aW9uOiB0aGlzLmVtaXR0ZXIuYWxpZ25Ub01vdGlvbixcbiAgICAgICAgICAgICAgICBzb2Z0OiB0aGlzLmVtaXR0ZXIuZGVwdGhTb2Z0ZW5pbmcsXG4gICAgICAgICAgICAgICAgbWVzaDogdGhpcy5lbWl0dGVyLnVzZU1lc2gsXG4gICAgICAgICAgICAgICAgZ2FtbWE6IHRoaXMuZW1pdHRlci5zY2VuZSA/IHRoaXMuZW1pdHRlci5zY2VuZS5nYW1tYUNvcnJlY3Rpb24gOiAwLFxuICAgICAgICAgICAgICAgIHRvbmVNYXA6IHRoaXMuZW1pdHRlci5zY2VuZSA/IHRoaXMuZW1pdHRlci5zY2VuZS50b25lTWFwcGluZyA6IDAsXG4gICAgICAgICAgICAgICAgZm9nOiAodGhpcy5lbWl0dGVyLnNjZW5lICYmICF0aGlzLmVtaXR0ZXIubm9Gb2cpID8gdGhpcy5lbWl0dGVyLnNjZW5lLmZvZyA6ICdub25lJyxcbiAgICAgICAgICAgICAgICB3cmFwOiB0aGlzLmVtaXR0ZXIud3JhcCAmJiB0aGlzLmVtaXR0ZXIud3JhcEJvdW5kcyxcbiAgICAgICAgICAgICAgICBsb2NhbFNwYWNlOiB0aGlzLmVtaXR0ZXIubG9jYWxTcGFjZSxcblxuICAgICAgICAgICAgICAgIC8vIGluIEVkaXRvciwgc2NyZWVuIHNwYWNlIHBhcnRpY2xlcyAoY2hpbGRyZW4gb2YgMkQgU2NyZWVuKSBhcmUgc3RpbGwgcmVuZGVyZWQgaW4gM2Qgc3BhY2VcbiAgICAgICAgICAgICAgICBzY3JlZW5TcGFjZTogaW5Ub29scyA/IGZhbHNlIDogdGhpcy5lbWl0dGVyLnNjcmVlblNwYWNlLFxuXG4gICAgICAgICAgICAgICAgYmxlbmQ6IHRoaXMuYmxlbmRUeXBlLFxuICAgICAgICAgICAgICAgIGFuaW1UZXg6IHRoaXMuZW1pdHRlci5faXNBbmltYXRlZCgpLFxuICAgICAgICAgICAgICAgIGFuaW1UZXhMb29wOiB0aGlzLmVtaXR0ZXIuYW5pbUxvb3AsXG4gICAgICAgICAgICAgICAgcGFjazg6IHRoaXMuZW1pdHRlci5wYWNrOCxcbiAgICAgICAgICAgICAgICBjdXN0b21GYWNlOiB0aGlzLmVtaXR0ZXIub3JpZW50YXRpb24gIT09IFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zaGFkZXIgPSB0aGlzLm1hdGVyaWFsLmdldFNoYWRlclZhcmlhbnQoKTtcbiAgICB9XG5cbiAgICByZXNldE1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHRoaXMubWF0ZXJpYWw7XG5cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdzdHJldGNoJywgdGhpcy5zdHJldGNoKTtcbiAgICAgICAgaWYgKHRoaXMuX2lzQW5pbWF0ZWQoKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdhbmltVGV4VGlsZXNQYXJhbXMnLCB0aGlzLmFuaW1UaWxlc1BhcmFtcyk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FuaW1UZXhQYXJhbXMnLCB0aGlzLmFuaW1QYXJhbXMpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdhbmltVGV4SW5kZXhQYXJhbXMnLCB0aGlzLmFuaW1JbmRleFBhcmFtcyk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdjb2xvck11bHQnLCB0aGlzLmludGVuc2l0eSk7XG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW50ZXJuYWxUZXgwJywgdGhpcy5pbnRlcm5hbFRleDApO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbnRlcm5hbFRleDEnLCB0aGlzLmludGVybmFsVGV4MSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ludGVybmFsVGV4MicsIHRoaXMuaW50ZXJuYWxUZXgyKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW50ZXJuYWxUZXgzJywgdGhpcy5pbnRlcm5hbFRleDMpO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignY29sb3JQYXJhbScsIHRoaXMuY29sb3JQYXJhbSk7XG5cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdudW1QYXJ0aWNsZXMnLCB0aGlzLm51bVBhcnRpY2xlcyk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbnVtUGFydGljbGVzUG90JywgdGhpcy5udW1QYXJ0aWNsZXNQb3QpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2xpZmV0aW1lJywgdGhpcy5saWZldGltZSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcigncmF0ZScsIHRoaXMucmF0ZSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcigncmF0ZURpdicsIHRoaXMucmF0ZTIgLSB0aGlzLnJhdGUpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NlZWQnLCB0aGlzLnNlZWQpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NjYWxlRGl2TXVsdCcsIHRoaXMuc2NhbGVVTWF4WzBdKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdhbHBoYURpdk11bHQnLCB0aGlzLmFscGhhVU1heFswXSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcigncmFkaWFsU3BlZWREaXZNdWx0JywgdGhpcy5yYWRpYWxTcGVlZFVNYXhbMF0pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2dyYXBoTnVtU2FtcGxlcycsIHRoaXMucHJlY2lzaW9uKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdncmFwaFNhbXBsZVNpemUnLCAxLjAgLyB0aGlzLnByZWNpc2lvbik7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZW1pdHRlclNjYWxlJywgbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pKTtcblxuICAgICAgICBpZiAodGhpcy5wYWNrOCkge1xuICAgICAgICAgICAgdGhpcy5fZ3B1VXBkYXRlci5fc2V0SW5wdXRCb3VuZHMoKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW5Cb3VuZHNTaXplJywgdGhpcy5fZ3B1VXBkYXRlci5pbkJvdW5kc1NpemVVbmlmb3JtKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW5Cb3VuZHNDZW50ZXInLCB0aGlzLl9ncHVVcGRhdGVyLmluQm91bmRzQ2VudGVyVW5pZm9ybSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ21heFZlbCcsIHRoaXMubWF4VmVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLndyYXAgJiYgdGhpcy53cmFwQm91bmRzKSB7XG4gICAgICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtWzBdID0gdGhpcy53cmFwQm91bmRzLng7XG4gICAgICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtWzFdID0gdGhpcy53cmFwQm91bmRzLnk7XG4gICAgICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtWzJdID0gdGhpcy53cmFwQm91bmRzLno7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3dyYXBCb3VuZHMnLCB0aGlzLndyYXBCb3VuZHNVbmlmb3JtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbG9yTWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2NvbG9yTWFwJywgdGhpcy5jb2xvck1hcCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgaWYgKHRoaXMubm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdub3JtYWxNYXAnLCB0aGlzLm5vcm1hbE1hcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZGVwdGhTb2Z0ZW5pbmcgPiAwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NvZnRlbmluZycsIDEuMCAvICh0aGlzLmRlcHRoU29mdGVuaW5nICogdGhpcy5kZXB0aFNvZnRlbmluZyAqIDEwMCkpOyAvLyByZW1hcCB0byBtb3JlIHBlcmNlcHR1YWxseSBsaW5lYXJcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdHJldGNoID4gMC4wKSBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcblxuICAgICAgICB0aGlzLl9jb21wUGFydGljbGVGYWNlUGFyYW1zKCk7XG4gICAgfVxuXG4gICAgX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMoKSB7XG4gICAgICAgIGxldCB0YW5nZW50LCBiaW5vcm1hbDtcbiAgICAgICAgaWYgKHRoaXMub3JpZW50YXRpb24gPT09IFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOKSB7XG4gICAgICAgICAgICB0YW5nZW50ID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMCwgMF0pO1xuICAgICAgICAgICAgYmlub3JtYWwgPSBuZXcgRmxvYXQzMkFycmF5KFswLCAwLCAxXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgbjtcbiAgICAgICAgICAgIGlmICh0aGlzLm9yaWVudGF0aW9uID09PSBQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxEKSB7XG4gICAgICAgICAgICAgICAgbiA9IHRoaXMucGFydGljbGVOb3JtYWwubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVtaXR0ZXJNYXQgPSB0aGlzLm5vZGUgPT09IG51bGwgP1xuICAgICAgICAgICAgICAgICAgICBNYXQ0LklERU5USVRZIDogdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgbiA9IGVtaXR0ZXJNYXQudHJhbnNmb3JtVmVjdG9yKHRoaXMucGFydGljbGVOb3JtYWwpLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdCA9IG5ldyBWZWMzKDEsIDAsIDApO1xuICAgICAgICAgICAgaWYgKE1hdGguYWJzKHQuZG90KG4pKSA9PT0gMSlcbiAgICAgICAgICAgICAgICB0LnNldCgwLCAwLCAxKTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBuZXcgVmVjMygpLmNyb3NzKG4sIHQpLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdC5jcm9zcyhiLCBuKS5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHRhbmdlbnQgPSBuZXcgRmxvYXQzMkFycmF5KFt0LngsIHQueSwgdC56XSk7XG4gICAgICAgICAgICBiaW5vcm1hbCA9IG5ldyBGbG9hdDMyQXJyYXkoW2IueCwgYi55LCBiLnpdKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZmFjZVRhbmdlbnQnLCB0YW5nZW50KTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ZhY2VCaW5vcm0nLCBiaW5vcm1hbCk7XG4gICAgfVxuXG4gICAgLy8gRGVjbGFyZXMgdmVydGV4IGZvcm1hdCwgY3JlYXRlcyBWQiBhbmQgSUJcbiAgICBfYWxsb2NhdGUobnVtUGFydGljbGVzKSB7XG4gICAgICAgIGNvbnN0IHBzeXNWZXJ0Q291bnQgPSBudW1QYXJ0aWNsZXMgKiB0aGlzLm51bVBhcnRpY2xlVmVydHM7XG4gICAgICAgIGNvbnN0IHBzeXNJbmRleENvdW50ID0gbnVtUGFydGljbGVzICogdGhpcy5udW1QYXJ0aWNsZUluZGljZXM7XG5cbiAgICAgICAgaWYgKCh0aGlzLnZlcnRleEJ1ZmZlciA9PT0gdW5kZWZpbmVkKSB8fCAodGhpcy52ZXJ0ZXhCdWZmZXIuZ2V0TnVtVmVydGljZXMoKSAhPT0gcHN5c1ZlcnRDb3VudCkpIHtcbiAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgcGFydGljbGUgdmVydGV4IGZvcm1hdFxuICAgICAgICAgICAgaWYgKCF0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgICAgIC8vIEdQVTogWFlaID0gcXVhZCB2ZXJ0ZXggcG9zaXRpb247IFcgPSBJTlQ6IHBhcnRpY2xlIElELCBGUkFDOiByYW5kb20gZmFjdG9yXG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBbe1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjAsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH1dO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjEsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0aWNsZUZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcy5ncmFwaGljc0RldmljZSwgZWxlbWVudHMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIHBhcnRpY2xlRm9ybWF0LCBwc3lzVmVydENvdW50LCBCVUZGRVJfRFlOQU1JQyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLmdyYXBoaWNzRGV2aWNlLCBJTkRFWEZPUk1BVF9VSU5UMTYsIHBzeXNJbmRleENvdW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBbe1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjAsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIxLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiA0LFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMixcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogNCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjMsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDEsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFI0LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiB0aGlzLnVzZU1lc2ggPyA0IDogMixcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfV07XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydGljbGVGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIGVsZW1lbnRzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gbmV3IFZlcnRleEJ1ZmZlcih0aGlzLmdyYXBoaWNzRGV2aWNlLCBwYXJ0aWNsZUZvcm1hdCwgcHN5c1ZlcnRDb3VudCwgQlVGRkVSX0RZTkFNSUMpO1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIodGhpcy5ncmFwaGljc0RldmljZSwgSU5ERVhGT1JNQVRfVUlOVDE2LCBwc3lzSW5kZXhDb3VudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbGwgdGhlIHZlcnRleCBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMudmVydGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICBsZXQgbWVzaERhdGEsIHN0cmlkZSwgdGV4Q29vcmRPZmZzZXQ7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgbWVzaERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIubG9jaygpKTtcbiAgICAgICAgICAgICAgICBzdHJpZGUgPSBtZXNoRGF0YS5sZW5ndGggLyB0aGlzLm1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGVsZW0gPSAwOyBlbGVtIDwgdGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyBlbGVtKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2VsZW1dLm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4Q29vcmRPZmZzZXQgPSB0aGlzLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tlbGVtXS5vZmZzZXQgLyA0O1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHN5c1ZlcnRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSBNYXRoLmZsb29yKGkgLyB0aGlzLm51bVBhcnRpY2xlVmVydHMpO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRJRCA9IGkgJSA0O1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0XSA9IHBhcnRpY2xlVmVydHNbdmVydElEXVswXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNCArIDFdID0gcGFydGljbGVWZXJ0c1t2ZXJ0SURdWzFdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0ICsgMl0gPSAwO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0ICsgM10gPSBpZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ID0gaSAlIHRoaXMubnVtUGFydGljbGVWZXJ0cztcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNl0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDFdID0gbWVzaERhdGFbdmVydCAqIHN0cmlkZSArIDFdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgMl0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgMl07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyAzXSA9IGlkO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgNF0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgdGV4Q29vcmRPZmZzZXQgKyAwXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDVdID0gMS4wIC0gbWVzaERhdGFbdmVydCAqIHN0cmlkZSArIHRleENvb3JkT2Zmc2V0ICsgMV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZiQ1BVID0gbmV3IEZsb2F0MzJBcnJheShkYXRhKTtcbiAgICAgICAgICAgICAgICB0aGlzLnZiT2xkID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLnZiQ1BVLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2gudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaWxsIHRoZSBpbmRleCBidWZmZXJcbiAgICAgICAgICAgIGxldCBkc3QgPSAwO1xuICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheSh0aGlzLmluZGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VNZXNoKSBtZXNoRGF0YSA9IG5ldyBVaW50MTZBcnJheSh0aGlzLm1lc2guaW5kZXhCdWZmZXJbMF0ubG9jaygpKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtUGFydGljbGVzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlSW5kZXggPSBpICogNDtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4ICsgMTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXggKyAyO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXggKyAyO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleCArIDM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLm51bVBhcnRpY2xlSW5kaWNlczsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2kgKiB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyArIGpdID0gbWVzaERhdGFbal0gKyBpICogdGhpcy5udW1QYXJ0aWNsZVZlcnRzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHRoaXMubWVzaC5pbmRleEJ1ZmZlclswXS51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2V0KCkge1xuICAgICAgICB0aGlzLmJlZW5SZXNldCA9IHRydWU7XG4gICAgICAgIHRoaXMuc2VlZCA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdzZWVkJywgdGhpcy5zZWVkKTtcbiAgICAgICAgaWYgKHRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFydGljbGVUZXhTdGFydC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhbaV0gPSB0aGlzLnBhcnRpY2xlVGV4U3RhcnRbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplVGV4dHVyZXMoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlc2V0V29ybGRCb3VuZHMoKTtcbiAgICAgICAgdGhpcy5yZXNldFRpbWUoKTtcbiAgICAgICAgY29uc3Qgb3JpZ0xvb3AgPSB0aGlzLmxvb3A7XG4gICAgICAgIHRoaXMubG9vcCA9IHRydWU7XG4gICAgICAgIHRoaXMuYWRkVGltZSgwLCBmYWxzZSk7XG4gICAgICAgIHRoaXMubG9vcCA9IG9yaWdMb29wO1xuICAgICAgICBpZiAodGhpcy5wcmVXYXJtKSB7XG4gICAgICAgICAgICB0aGlzLnByZXdhcm0odGhpcy5saWZldGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcmV3YXJtKHRpbWUpIHtcbiAgICAgICAgY29uc3QgbGlmZXRpbWVGcmFjdGlvbiA9IHRpbWUgLyB0aGlzLmxpZmV0aW1lO1xuICAgICAgICBjb25zdCBpdGVyYXRpb25zID0gTWF0aC5taW4oTWF0aC5mbG9vcihsaWZldGltZUZyYWN0aW9uICogdGhpcy5wcmVjaXNpb24pLCB0aGlzLnByZWNpc2lvbik7XG4gICAgICAgIGNvbnN0IHN0ZXBEZWx0YSA9IHRpbWUgLyBpdGVyYXRpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZXJhdGlvbnM7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5hZGRUaW1lKHN0ZXBEZWx0YSwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzZXRUaW1lKCkge1xuICAgICAgICB0aGlzLmVuZFRpbWUgPSBjYWxjRW5kVGltZSh0aGlzKTtcbiAgICB9XG5cbiAgICBmaW5pc2hGcmFtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMudXNlQ3B1KSB0aGlzLnZlcnRleEJ1ZmZlci51bmxvY2soKTtcbiAgICB9XG5cbiAgICBhZGRUaW1lKGRlbHRhLCBpc09uU3RvcCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuc2ltVGltZVRvdGFsICs9IGRlbHRhO1xuXG4gICAgICAgIHRoaXMuY2FsY3VsYXRlV29ybGRCb3VuZHMoKTtcblxuICAgICAgICBpZiAodGhpcy5faXNBbmltYXRlZCgpKSB7XG4gICAgICAgICAgICBjb25zdCB0aWxlc1BhcmFtcyA9IHRoaXMuYW5pbVRpbGVzUGFyYW1zO1xuICAgICAgICAgICAgdGlsZXNQYXJhbXNbMF0gPSAxLjAgLyB0aGlzLmFuaW1UaWxlc1g7IC8vIGFuaW1UZXhUaWxlc1BhcmFtcy54XG4gICAgICAgICAgICB0aWxlc1BhcmFtc1sxXSA9IDEuMCAvIHRoaXMuYW5pbVRpbGVzWTsgLy8gYW5pbVRleFRpbGVzUGFyYW1zLnlcblxuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gdGhpcy5hbmltUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gdGhpcy5hbmltU3RhcnRGcmFtZTsgLy8gYW5pbVRleFBhcmFtcy54XG4gICAgICAgICAgICBwYXJhbXNbMV0gPSB0aGlzLmFuaW1OdW1GcmFtZXMgKiB0aGlzLmFuaW1TcGVlZDsgLy8gYW5pbVRleFBhcmFtcy55XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSB0aGlzLmFuaW1OdW1GcmFtZXMgLSAxOyAvLyBhbmltVGV4UGFyYW1zLnpcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IHRoaXMuYW5pbU51bUFuaW1hdGlvbnMgLSAxOyAvLyBhbmltVGV4UGFyYW1zLndcblxuICAgICAgICAgICAgY29uc3QgYW5pbUluZGV4UGFyYW1zID0gdGhpcy5hbmltSW5kZXhQYXJhbXM7XG4gICAgICAgICAgICBhbmltSW5kZXhQYXJhbXNbMF0gPSB0aGlzLmFuaW1JbmRleDsgLy8gYW5pbVRleEluZGV4UGFyYW1zLnhcbiAgICAgICAgICAgIGFuaW1JbmRleFBhcmFtc1sxXSA9IHRoaXMucmFuZG9taXplQW5pbUluZGV4OyAvLyBhbmltVGV4SW5kZXhQYXJhbXMueVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc2NlbmUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNhbWVyYSAhPT0gdGhpcy5zY2VuZS5fYWN0aXZlQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYW1lcmEgPSB0aGlzLnNjZW5lLl9hY3RpdmVDYW1lcmE7XG4gICAgICAgICAgICAgICAgdGhpcy5vbkNoYW5nZUNhbWVyYSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlclNoYXBlID09PSBFTUlUVEVSU0hBUEVfQk9YKSB7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMF0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnggIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueCAvIHRoaXMuZW1pdHRlckV4dGVudHMueCA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMV0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueSAvIHRoaXMuZW1pdHRlckV4dGVudHMueSA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMl0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnogIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueiAvIHRoaXMuZW1pdHRlckV4dGVudHMueiA6IDA7XG4gICAgICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2Uubm9kZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHNwYXduTWF0cml4LnNldFRSUyhWZWMzLlpFUk8sIFF1YXQuSURFTlRJVFksIHRoaXMuZW1pdHRlckV4dGVudHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzcGF3bk1hdHJpeC5zZXRUUlMoVmVjMy5aRVJPLCB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmdldFJvdGF0aW9uKCksIHRtcFZlYzMuY29weSh0aGlzLmVtaXR0ZXJFeHRlbnRzKS5tdWwodGhpcy5tZXNoSW5zdGFuY2Uubm9kZS5sb2NhbFNjYWxlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZW1pdHRlclBvcztcbiAgICAgICAgY29uc3QgZW1pdHRlclNjYWxlID0gdGhpcy5tZXNoSW5zdGFuY2Uubm9kZSA9PT0gbnVsbCA/IFZlYzMuT05FIDogdGhpcy5tZXNoSW5zdGFuY2Uubm9kZS5sb2NhbFNjYWxlO1xuICAgICAgICB0aGlzLmVtaXR0ZXJTY2FsZVVuaWZvcm1bMF0gPSBlbWl0dGVyU2NhbGUueDtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtWzFdID0gZW1pdHRlclNjYWxlLnk7XG4gICAgICAgIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybVsyXSA9IGVtaXR0ZXJTY2FsZS56O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZW1pdHRlclNjYWxlJywgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtKTtcbiAgICAgICAgaWYgKHRoaXMubG9jYWxTcGFjZSAmJiB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlKSB7XG4gICAgICAgICAgICBlbWl0dGVyUG9zID0gdGhpcy5tZXNoSW5zdGFuY2Uubm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyUG9zVW5pZm9ybVswXSA9IGVtaXR0ZXJQb3MueDtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm1bMV0gPSBlbWl0dGVyUG9zLnk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtWzJdID0gZW1pdHRlclBvcy56O1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2VtaXR0ZXJQb3MnLCB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMoKTtcblxuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICB0aGlzLl9ncHVVcGRhdGVyLnVwZGF0ZShkZXZpY2UsIHNwYXduTWF0cml4LCBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0sIGRlbHRhLCBpc09uU3RvcCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLnZlcnRleEJ1ZmZlci5sb2NrKCkpO1xuICAgICAgICAgICAgdGhpcy5fY3B1VXBkYXRlci51cGRhdGUoZGF0YSwgdGhpcy52YlRvU29ydCwgdGhpcy5wYXJ0aWNsZVRleCwgc3Bhd25NYXRyaXgsIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSwgZW1pdHRlclBvcywgZGVsdGEsIGlzT25TdG9wKTtcbiAgICAgICAgICAgIC8vIHRoaXMudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmxvb3ApIHtcbiAgICAgICAgICAgIGlmIChEYXRlLm5vdygpID4gdGhpcy5lbmRUaW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub25GaW5pc2hlZCkgdGhpcy5vbkZpbmlzaGVkKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSB0aGlzLmRyYXdPcmRlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fYWRkVGltZVRpbWUgKz0gbm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIF9kZXN0cm95UmVzb3VyY2VzKCkge1xuICAgICAgICBpZiAodGhpcy5wYXJ0aWNsZVRleElOKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4SU4uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleElOID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnBhcnRpY2xlVGV4T1VUKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VULmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhPVVQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGFydGljbGVUZXhTdGFydCAmJiB0aGlzLnBhcnRpY2xlVGV4U3RhcnQuZGVzdHJveSkge1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5ydFBhcnRpY2xlVGV4SU4pIHtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleElOLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleElOID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJ0UGFydGljbGVUZXhPVVQpIHtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleE9VVC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhPVVQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJuYWxUZXgwKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbnRlcm5hbFRleDEpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmludGVybmFsVGV4Mikge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJuYWxUZXgzKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4My5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb2xvclBhcmFtKSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yUGFyYW0uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5jb2xvclBhcmFtID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSB1bmRlZmluZWQ7IC8vIHdlIGFyZSB0ZXN0aW5nIGlmIHZiIGlzIHVuZGVmaW5lZCBpbiBzb21lIGNvZGUsIG5vIGlkZWEgd2h5XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbmRleEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBub3RlOiBzaGFkZXJzIHNob3VsZCBub3QgYmUgZGVzdHJveWVkIGFzIHRoZXkgY291bGQgYmUgc2hhcmVkIGJldHdlZW4gZW1pdHRlcnNcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmNhbWVyYSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlc291cmNlcygpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUGFydGljbGVFbWl0dGVyIH07XG4iXSwibmFtZXMiOlsicGFydGljbGVWZXJ0cyIsIl9jcmVhdGVUZXh0dXJlIiwiZGV2aWNlIiwid2lkdGgiLCJoZWlnaHQiLCJwaXhlbERhdGEiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwibXVsdDhCaXQiLCJmaWx0ZXIiLCJtaXBGaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiRklMVEVSX0xJTkVBUiIsInRleHR1cmUiLCJUZXh0dXJlIiwiY3ViZW1hcCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwibmFtZSIsInBpeGVscyIsImxvY2siLCJ0ZW1wIiwiVWludDhBcnJheSIsImxlbmd0aCIsImkiLCJzZXQiLCJ1bmxvY2siLCJzYXR1cmF0ZSIsIngiLCJNYXRoIiwibWF4IiwibWluIiwiZGVmYXVsdDBDdXJ2ZSIsIkN1cnZlIiwiZGVmYXVsdDFDdXJ2ZSIsImRlZmF1bHQwQ3VydmUzIiwiQ3VydmVTZXQiLCJkZWZhdWx0MUN1cnZlMyIsInBhcnRpY2xlVGV4SGVpZ2h0IiwicGFydGljbGVUZXhDaGFubmVscyIsImV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsInNwYXduTWF0cml4IiwiTWF0NCIsInRtcFZlYzMiLCJWZWMzIiwiYk1pbiIsImJNYXgiLCJzZXRQcm9wZXJ0eVRhcmdldCIsInNldFByb3BlcnR5T3B0aW9ucyIsInNldFByb3BlcnR5IiwicE5hbWUiLCJkZWZhdWx0VmFsIiwidW5kZWZpbmVkIiwicGFjazNORmxvYXRzIiwiYSIsImIiLCJjIiwicGFja2VkIiwicGFja1RleHR1cmVYWVpfTlhZWiIsInFYWVoiLCJxWFlaMiIsIm51bSIsImNvbG9ycyIsIkFycmF5IiwicGFja1RleHR1cmVSR0JBIiwicVJHQiIsInFBIiwicGFja1RleHR1cmU1RmxvYXRzIiwicUIiLCJxQyIsInFEIiwicUUiLCJwYWNrVGV4dHVyZTJGbG9hdHMiLCJjYWxjRW5kVGltZSIsImVtaXR0ZXIiLCJpbnRlcnZhbCIsInJhdGUiLCJyYXRlMiIsIm51bVBhcnRpY2xlcyIsImxpZmV0aW1lIiwiRGF0ZSIsIm5vdyIsInN1YkdyYXBoIiwiQSIsIkIiLCJyIiwibWF4VW5zaWduZWRHcmFwaFZhbHVlIiwib3V0VU1heCIsImNoYW5zIiwidmFsdWVzIiwiaiIsImFicyIsIm5vcm1hbGl6ZUdyYXBoIiwidU1heCIsImRpdkdyYXBoRnJvbTJDdXJ2ZXMiLCJjdXJ2ZTEiLCJjdXJ2ZTIiLCJzdWIiLCJwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZSIsIkRldmljZUNhY2hlIiwiUGFydGljbGVFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsIm9wdGlvbnMiLCJnZCIsInByZWNpc2lvbiIsIl9hZGRUaW1lVGltZSIsIm1heFRleHR1cmVTaXplIiwiRGVidWciLCJ3YXJuIiwiRU1JVFRFUlNIQVBFX0JPWCIsImRlZmF1bHRQYXJhbVRleHR1cmUiLCJQQVJUSUNMRVNPUlRfTk9ORSIsIlBBUlRJQ0xFTU9ERV9HUFUiLCJQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTiIsIkJMRU5EX05PUk1BTCIsInN0YXJ0QW5nbGUiLCJfZ3B1VXBkYXRlciIsIlBhcnRpY2xlR1BVVXBkYXRlciIsIl9jcHVVcGRhdGVyIiwiUGFydGljbGVDUFVVcGRhdGVyIiwiY29uc3RhbnRMaWdodEN1YmUiLCJzY29wZSIsInJlc29sdmUiLCJlbWl0dGVyUG9zVW5pZm9ybSIsIndyYXBCb3VuZHNVbmlmb3JtIiwiZW1pdHRlclNjYWxlVW5pZm9ybSIsImNvbG9yR3JhcGgiLCJzY2FsZUdyYXBoIiwiYWxwaGFHcmFwaCIsImxvY2FsVmVsb2NpdHlHcmFwaCIsInZlbG9jaXR5R3JhcGgiLCJyb3RhdGlvblNwZWVkR3JhcGgiLCJyYWRpYWxTcGVlZEdyYXBoIiwibGlnaHRDdWJlIiwibGlnaHRDdWJlRGlyIiwiYW5pbVRpbGVzUGFyYW1zIiwiYW5pbVBhcmFtcyIsImFuaW1JbmRleFBhcmFtcyIsImludGVybmFsVGV4MCIsImludGVybmFsVGV4MSIsImludGVybmFsVGV4MiIsImNvbG9yUGFyYW0iLCJ2YlRvU29ydCIsInZiT2xkIiwicGFydGljbGVEaXN0YW5jZSIsImNhbWVyYSIsInN3YXBUZXgiLCJ1c2VNZXNoIiwidXNlQ3B1Iiwic3VwcG9ydHNHcHVQYXJ0aWNsZXMiLCJwYWNrOCIsImxvY2FsQm91bmRzIiwiQm91bmRpbmdCb3giLCJ3b3JsZEJvdW5kc05vVHJhaWwiLCJ3b3JsZEJvdW5kc1RyYWlsIiwid29ybGRCb3VuZHMiLCJ3b3JsZEJvdW5kc1NpemUiLCJwcmV2V29ybGRCb3VuZHNTaXplIiwicHJldldvcmxkQm91bmRzQ2VudGVyIiwicHJldkVtaXR0ZXJFeHRlbnRzIiwiZW1pdHRlckV4dGVudHMiLCJwcmV2RW1pdHRlclJhZGl1cyIsImVtaXR0ZXJSYWRpdXMiLCJ3b3JsZEJvdW5kc011bCIsIndvcmxkQm91bmRzQWRkIiwidGltZVRvU3dpdGNoQm91bmRzIiwic2hhZGVyUGFydGljbGVVcGRhdGVSZXNwYXduIiwic2hhZGVyUGFydGljbGVVcGRhdGVOb1Jlc3Bhd24iLCJzaGFkZXJQYXJ0aWNsZVVwZGF0ZU9uU3RvcCIsIm51bVBhcnRpY2xlVmVydHMiLCJudW1QYXJ0aWNsZUluZGljZXMiLCJtYXRlcmlhbCIsIm1lc2hJbnN0YW5jZSIsImRyYXdPcmRlciIsInNlZWQiLCJyYW5kb20iLCJmaXhlZFRpbWVTdGVwIiwibWF4U3ViU3RlcHMiLCJzaW1UaW1lIiwic2ltVGltZVRvdGFsIiwiYmVlblJlc2V0IiwiX2xheWVyIiwicmVidWlsZCIsImFzc2VydCIsImdldCIsInJlc29sdXRpb24iLCJjZW50ZXJQb2ludCIsImR0ZXgiLCJ5IiwieGdyYWQiLCJ5Z3JhZCIsInNxcnQiLCJwIiwib25DaGFuZ2VDYW1lcmEiLCJyZWdlblNoYWRlciIsInJlc2V0TWF0ZXJpYWwiLCJjYWxjdWxhdGVCb3VuZHNNYWQiLCJ6IiwiY29weSIsImNlbnRlciIsIm11bCIsIm11bFNjYWxhciIsImNhbGN1bGF0ZVdvcmxkQm91bmRzIiwibm9kZSIsInJlY2FsY3VsYXRlTG9jYWxCb3VuZHMiLCJlbWl0dGVyU2hhcGUiLCJlcXVhbHMiLCJjYWxjdWxhdGVMb2NhbEJvdW5kcyIsIm5vZGVXVCIsImdldFdvcmxkVHJhbnNmb3JtIiwibG9jYWxTcGFjZSIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJhZGQiLCJoYWxmRXh0ZW50cyIsImFhYmIiLCJtZXNoIiwiX2FhYmJWZXIiLCJyZXNldFdvcmxkQm91bmRzIiwiSURFTlRJVFkiLCJtaW54IiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwibWlueSIsIm1pbnoiLCJtYXh4IiwibWF4eSIsIm1heHoiLCJtYXhSIiwibWF4U2NhbGUiLCJzdGVwV2VpZ2h0Iiwid1ZlbHMiLCJxVmVsb2NpdHkiLCJxVmVsb2NpdHkyIiwibFZlbHMiLCJxTG9jYWxWZWxvY2l0eSIsInFMb2NhbFZlbG9jaXR5MiIsImFjY3VtWCIsImFjY3VtWSIsImFjY3VtWiIsImFjY3VtUiIsImFjY3VtVyIsImluZGV4IiwicVJhZGlhbFNwZWVkIiwicVJhZGlhbFNwZWVkMiIsInFTY2FsZSIsInciLCJzZXRNaW5NYXgiLCJjb2xvck1hcCIsInNwYXduQm91bmRzIiwic29ydCIsIm1heFZlcnRleFRleHR1cmVzIiwiZnJhZ21lbnRVbmlmb3Jtc0NvdW50IiwiZm9yY2VDcHVQYXJ0aWNsZXMiLCJleHRUZXh0dXJlRmxvYXQiLCJfZGVzdHJveVJlc291cmNlcyIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJ0b3RhbFZlcnRDb3VudCIsInZlcnRleEJ1ZmZlciIsIm51bVZlcnRpY2VzIiwibnVtUGFydGljbGVzUG90IiwibWF0aCIsIm5leHRQb3dlck9mVHdvIiwicmVidWlsZEdyYXBocyIsImlTb3J0IiwicmFuZG9taXplIiwicGFydGljbGVUZXgiLCJlbWl0dGVyUG9zIiwiWkVSTyIsImdldFBvc2l0aW9uIiwic2V0VFJTIiwiUXVhdCIsImdldFJvdGF0aW9uIiwibG9jYWxTY2FsZSIsImVtaXR0ZXJFeHRlbnRzSW5uZXIiLCJjYWxjU3Bhd25Qb3NpdGlvbiIsInBhcnRpY2xlVGV4U3RhcnQiLCJwYXJ0aWNsZVRleElOIiwicGFydGljbGVUZXhPVVQiLCJydFBhcnRpY2xlVGV4SU4iLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwicnRQYXJ0aWNsZVRleE9VVCIsInNoYWRlckNvZGVTdGFydCIsInNoYWRlckNodW5rcyIsInBhcnRpY2xlVXBkYXRlckluaXRQUyIsInBhcnRpY2xlSW5wdXRSZ2JhOFBTIiwicGFydGljbGVPdXRwdXRSZ2JhOFBTIiwicGFydGljbGVJbnB1dEZsb2F0UFMiLCJwYXJ0aWNsZU91dHB1dEZsb2F0UFMiLCJwYXJ0aWNsZVVwZGF0ZXJBQUJCUFMiLCJwYXJ0aWNsZVVwZGF0ZXJTcGhlcmVQUyIsInBhcnRpY2xlVXBkYXRlclN0YXJ0UFMiLCJzaGFkZXJDb2RlUmVzcGF3biIsInBhcnRpY2xlVXBkYXRlclJlc3Bhd25QUyIsInBhcnRpY2xlVXBkYXRlckVuZFBTIiwic2hhZGVyQ29kZU5vUmVzcGF3biIsInBhcnRpY2xlVXBkYXRlck5vUmVzcGF3blBTIiwic2hhZGVyQ29kZU9uU3RvcCIsInBhcnRpY2xlVXBkYXRlck9uU3RvcFBTIiwicGFyYW1zIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJmdWxsc2NyZWVuUXVhZFZTIiwiaW5kZXhCdWZmZXIiLCJudW1JbmRpY2VzIiwiX2FsbG9jYXRlIiwiTWVzaCIsInByaW1pdGl2ZSIsInR5cGUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsIk1hdGVyaWFsIiwiY3VsbCIsIkNVTExGQUNFX05PTkUiLCJhbHBoYVdyaXRlIiwiYmxlbmQiLCJibGVuZFR5cGUiLCJkZXB0aFdyaXRlIiwid2FzVmlzaWJsZSIsInZpc2libGUiLCJNZXNoSW5zdGFuY2UiLCJwaWNrIiwidXBkYXRlS2V5IiwiX25vRGVwdGhEcmF3R2wxIiwiX3VwZGF0ZUFhYmIiLCJfaW5pdGlhbGl6ZVRleHR1cmVzIiwicmVzZXRUaW1lIiwiYWRkVGltZSIsInByZVdhcm0iLCJwcmV3YXJtIiwiX2lzQW5pbWF0ZWQiLCJhbmltTnVtRnJhbWVzIiwiYW5pbVRpbGVzWCIsImFuaW1UaWxlc1kiLCJub3JtYWxNYXAiLCJxdWFudGl6ZSIsInFDb2xvciIsInF1YW50aXplQ2xhbXBlZCIsInFSb3RTcGVlZCIsInFBbHBoYSIsImxvY2FsVmVsb2NpdHlHcmFwaDIiLCJ2ZWxvY2l0eUdyYXBoMiIsInFDb2xvcjIiLCJjb2xvckdyYXBoMiIsInFSb3RTcGVlZDIiLCJyb3RhdGlvblNwZWVkR3JhcGgyIiwicVNjYWxlMiIsInNjYWxlR3JhcGgyIiwicUFscGhhMiIsImFscGhhR3JhcGgyIiwicmFkaWFsU3BlZWRHcmFwaDIiLCJERUdfVE9fUkFEIiwibG9jYWxWZWxvY2l0eVVNYXgiLCJ2ZWxvY2l0eVVNYXgiLCJjb2xvclVNYXgiLCJyb3RTcGVlZFVNYXgiLCJzY2FsZVVNYXgiLCJhbHBoYVVNYXgiLCJyYWRpYWxTcGVlZFVNYXgiLCJxTG9jYWxWZWxvY2l0eURpdiIsInFWZWxvY2l0eURpdiIsInFDb2xvckRpdiIsInFSb3RTcGVlZERpdiIsInFTY2FsZURpdiIsInFBbHBoYURpdiIsInFSYWRpYWxTcGVlZERpdiIsInVtYXgiLCJ1bWF4MiIsImx1bWF4IiwibHVtYXgyIiwicnVtYXgiLCJydW1heDIiLCJtYXhWZWwiLCJsbWF4VmVsIiwibWF4UmFkIiwiaW50ZXJuYWxUZXgzIiwic2V0UGFyYW1ldGVyIiwibGlnaHRpbmciLCJwcm9ncmFtTGliIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJyZWdpc3RlciIsInBhcnRpY2xlIiwiaGFzTm9ybWFsIiwibm9ybWFsT3B0aW9uIiwiZ2V0U2hhZGVyVmFyaWFudCIsImRldiIsInNjIiwiZGVmcyIsInN0YXRpY0xpZ2h0TGlzdCIsInBhc3MiLCJzb3J0ZWRMaWdodHMiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJzY2VuZSIsIl9hY3RpdmVDYW1lcmEiLCJpblRvb2xzIiwic2hhZGVyIiwiZ2V0UHJvZ3JhbSIsIm5vcm1hbCIsImhhbGZsYW1iZXJ0IiwiaGFsZkxhbWJlcnQiLCJzdHJldGNoIiwiYWxpZ25Ub01vdGlvbiIsInNvZnQiLCJkZXB0aFNvZnRlbmluZyIsImdhbW1hIiwiZ2FtbWFDb3JyZWN0aW9uIiwidG9uZU1hcCIsInRvbmVNYXBwaW5nIiwiZm9nIiwibm9Gb2ciLCJ3cmFwIiwid3JhcEJvdW5kcyIsInNjcmVlblNwYWNlIiwiYW5pbVRleCIsImFuaW1UZXhMb29wIiwiYW5pbUxvb3AiLCJjdXN0b21GYWNlIiwib3JpZW50YXRpb24iLCJpbnRlbnNpdHkiLCJfc2V0SW5wdXRCb3VuZHMiLCJpbkJvdW5kc1NpemVVbmlmb3JtIiwiaW5Cb3VuZHNDZW50ZXJVbmlmb3JtIiwiX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMiLCJ0YW5nZW50IiwiYmlub3JtYWwiLCJuIiwiUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRCIsInBhcnRpY2xlTm9ybWFsIiwibm9ybWFsaXplIiwiZW1pdHRlck1hdCIsInRyYW5zZm9ybVZlY3RvciIsInQiLCJkb3QiLCJjcm9zcyIsInBzeXNWZXJ0Q291bnQiLCJwc3lzSW5kZXhDb3VudCIsImdldE51bVZlcnRpY2VzIiwiZWxlbWVudHMiLCJzZW1hbnRpYyIsIlNFTUFOVElDX0FUVFIwIiwiY29tcG9uZW50cyIsIlRZUEVfRkxPQVQzMiIsInB1c2giLCJTRU1BTlRJQ19BVFRSMSIsInBhcnRpY2xlRm9ybWF0IiwiVmVydGV4Rm9ybWF0IiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX0RZTkFNSUMiLCJJbmRleEJ1ZmZlciIsIklOREVYRk9STUFUX1VJTlQxNiIsIlNFTUFOVElDX0FUVFIyIiwiU0VNQU5USUNfQVRUUjMiLCJTRU1BTlRJQ19BVFRSNCIsImRhdGEiLCJtZXNoRGF0YSIsInN0cmlkZSIsInRleENvb3JkT2Zmc2V0IiwiZWxlbSIsIlNFTUFOVElDX1RFWENPT1JEMCIsIm9mZnNldCIsImlkIiwiZmxvb3IiLCJ2ZXJ0SUQiLCJ2ZXJ0IiwidmJDUFUiLCJkc3QiLCJpbmRpY2VzIiwiVWludDE2QXJyYXkiLCJiYXNlSW5kZXgiLCJyZXNldCIsIm9yaWdMb29wIiwibG9vcCIsInRpbWUiLCJsaWZldGltZUZyYWN0aW9uIiwiaXRlcmF0aW9ucyIsInN0ZXBEZWx0YSIsImVuZFRpbWUiLCJmaW5pc2hGcmFtZSIsImRlbHRhIiwiaXNPblN0b3AiLCJzdGFydFRpbWUiLCJ0aWxlc1BhcmFtcyIsImFuaW1TdGFydEZyYW1lIiwiYW5pbVNwZWVkIiwiYW5pbU51bUFuaW1hdGlvbnMiLCJhbmltSW5kZXgiLCJyYW5kb21pemVBbmltSW5kZXgiLCJlbWl0dGVyU2NhbGUiLCJPTkUiLCJ1cGRhdGUiLCJvbkZpbmlzaGVkIiwiZGVzdHJveSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE2Q0EsTUFBTUEsYUFBYSxHQUFHLENBQ2xCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFDUixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUNQLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUNOLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQ1YsQ0FBQTtBQUVELFNBQVNDLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsU0FBUyxFQUFFQyxNQUFNLEdBQUdDLG1CQUFtQixFQUFFQyxRQUFRLEVBQUVDLE1BQU0sRUFBRTtFQUV0RyxJQUFJQyxTQUFTLEdBQUdDLGNBQWMsQ0FBQTtFQUM5QixJQUFJRixNQUFNLElBQUlILE1BQU0sS0FBS00saUJBQWlCLEVBQ3RDRixTQUFTLEdBQUdHLGFBQWEsQ0FBQTtBQUU3QixFQUFBLE1BQU1DLE9BQU8sR0FBRyxJQUFJQyxPQUFPLENBQUNiLE1BQU0sRUFBRTtBQUNoQ0MsSUFBQUEsS0FBSyxFQUFFQSxLQUFLO0FBQ1pDLElBQUFBLE1BQU0sRUFBRUEsTUFBTTtBQUNkRSxJQUFBQSxNQUFNLEVBQUVBLE1B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
