/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug } from '../../core/debug.js';
import { math } from '../../math/math.js';
import { Mat4 } from '../../math/mat4.js';
import { Quat } from '../../math/quat.js';
import { Vec3 } from '../../math/vec3.js';
import { BoundingBox } from '../../shape/bounding-box.js';
import { Curve } from '../../math/curve.js';
import { CurveSet } from '../../math/curve-set.js';
import { FILTER_LINEAR, PRIMITIVE_TRIANGLES, CULLFACE_NONE, BUFFER_DYNAMIC, INDEXFORMAT_UINT16, SEMANTIC_ATTR0, TYPE_FLOAT32, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_TEXCOORD0, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F, FILTER_NEAREST } from '../../graphics/constants.js';
import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { shaderChunks } from '../../graphics/program-lib/chunks/chunks.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';
import { RenderTarget } from '../../graphics/render-target.js';
import { Texture } from '../../graphics/texture.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';
import { DeviceCache } from '../../graphics/device-cache.js';
import { particle } from '../../graphics/program-lib/programs/particle.js';
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
    this.useCpu = this.useCpu || this.sort > PARTICLESORT_NONE || gd.maxVertexTextures <= 1 || gd.fragmentUniformsCount < 64 || gd.forceCpuParticles || !gd.extTextureFloat;

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
    const programLib = this.graphicsDevice.getProgramLibrary();
    this.graphicsDevice.programLib.register('particle', particle);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUtZW1pdHRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi8uLi9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQgeyBDdXJ2ZSB9IGZyb20gJy4uLy4uL21hdGgvY3VydmUuanMnO1xuaW1wb3J0IHsgQ3VydmVTZXQgfSBmcm9tICcuLi8uLi9tYXRoL2N1cnZlLXNldC5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgIEJVRkZFUl9EWU5BTUlDLFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1QsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDE2LFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCBQSVhFTEZPUk1BVF9SR0JBMzJGLFxuICAgIFBSSU1JVElWRV9UUklBTkdMRVMsXG4gICAgU0VNQU5USUNfQVRUUjAsIFNFTUFOVElDX0FUVFIxLCBTRU1BTlRJQ19BVFRSMiwgU0VNQU5USUNfQVRUUjMsIFNFTUFOVElDX0FUVFI0LCBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uLy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3Byb2dyYW0tbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgSW5kZXhCdWZmZXIgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi8uLi9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgRGV2aWNlQ2FjaGUgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9kZXZpY2UtY2FjaGUuanMnO1xuaW1wb3J0IHsgcGFydGljbGUgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9wcm9ncmFtLWxpYi9wcm9ncmFtcy9wYXJ0aWNsZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9STUFMLFxuICAgIEVNSVRURVJTSEFQRV9CT1gsXG4gICAgUEFSVElDTEVNT0RFX0dQVSxcbiAgICBQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTiwgUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRCxcbiAgICBQQVJUSUNMRVNPUlRfTk9ORVxufSBmcm9tICcuLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi8uLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5cbmltcG9ydCB7IFBhcnRpY2xlQ1BVVXBkYXRlciB9IGZyb20gJy4vY3B1LXVwZGF0ZXIuanMnO1xuaW1wb3J0IHsgUGFydGljbGVHUFVVcGRhdGVyIH0gZnJvbSAnLi9ncHUtdXBkYXRlci5qcyc7XG5cbmNvbnN0IHBhcnRpY2xlVmVydHMgPSBbXG4gICAgWy0xLCAtMV0sXG4gICAgWzEsIC0xXSxcbiAgICBbMSwgMV0sXG4gICAgWy0xLCAxXVxuXTtcblxuZnVuY3Rpb24gX2NyZWF0ZVRleHR1cmUoZGV2aWNlLCB3aWR0aCwgaGVpZ2h0LCBwaXhlbERhdGEsIGZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkEzMkYsIG11bHQ4Qml0LCBmaWx0ZXIpIHtcblxuICAgIGxldCBtaXBGaWx0ZXIgPSBGSUxURVJfTkVBUkVTVDtcbiAgICBpZiAoZmlsdGVyICYmIGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgpXG4gICAgICAgIG1pcEZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG5cbiAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgIGZvcm1hdDogZm9ybWF0LFxuICAgICAgICBjdWJlbWFwOiBmYWxzZSxcbiAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgIG1pbkZpbHRlcjogbWlwRmlsdGVyLFxuICAgICAgICBtYWdGaWx0ZXI6IG1pcEZpbHRlcixcbiAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgbmFtZTogJ1BhcnRpY2xlU3lzdGVtVGV4dHVyZSdcbiAgICB9KTtcblxuICAgIGNvbnN0IHBpeGVscyA9IHRleHR1cmUubG9jaygpO1xuXG4gICAgaWYgKGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgpIHtcbiAgICAgICAgY29uc3QgdGVtcCA9IG5ldyBVaW50OEFycmF5KHBpeGVsRGF0YS5sZW5ndGgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBpeGVsRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGVtcFtpXSA9IHBpeGVsRGF0YVtpXSAqIG11bHQ4Qml0ICogMjU1O1xuICAgICAgICB9XG4gICAgICAgIHBpeGVsRGF0YSA9IHRlbXA7XG4gICAgfVxuXG4gICAgcGl4ZWxzLnNldChwaXhlbERhdGEpO1xuXG4gICAgdGV4dHVyZS51bmxvY2soKTtcblxuICAgIHJldHVybiB0ZXh0dXJlO1xufVxuXG5mdW5jdGlvbiBzYXR1cmF0ZSh4KSB7XG4gICAgcmV0dXJuIE1hdGgubWF4KE1hdGgubWluKHgsIDEpLCAwKTtcbn1cblxuY29uc3QgZGVmYXVsdDBDdXJ2ZSA9IG5ldyBDdXJ2ZShbMCwgMCwgMSwgMF0pO1xuY29uc3QgZGVmYXVsdDFDdXJ2ZSA9IG5ldyBDdXJ2ZShbMCwgMSwgMSwgMV0pO1xuY29uc3QgZGVmYXVsdDBDdXJ2ZTMgPSBuZXcgQ3VydmVTZXQoWzAsIDAsIDEsIDBdLCBbMCwgMCwgMSwgMF0sIFswLCAwLCAxLCAwXSk7XG5jb25zdCBkZWZhdWx0MUN1cnZlMyA9IG5ldyBDdXJ2ZVNldChbMCwgMSwgMSwgMV0sIFswLCAxLCAxLCAxXSwgWzAsIDEsIDEsIDFdKTtcblxubGV0IHBhcnRpY2xlVGV4SGVpZ2h0ID0gMjtcbmNvbnN0IHBhcnRpY2xlVGV4Q2hhbm5lbHMgPSA0OyAvLyB0aGVyZSBpcyBhIGR1cGxpY2F0ZSBpbiBjcHUgdXBkYXRlclxuXG5jb25zdCBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuY29uc3Qgc3Bhd25NYXRyaXggPSBuZXcgTWF0NCgpO1xuXG5jb25zdCB0bXBWZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IGJNaW4gPSBuZXcgVmVjMygpO1xuY29uc3QgYk1heCA9IG5ldyBWZWMzKCk7XG5cbmxldCBzZXRQcm9wZXJ0eVRhcmdldDtcbmxldCBzZXRQcm9wZXJ0eU9wdGlvbnM7XG5cbmZ1bmN0aW9uIHNldFByb3BlcnR5KHBOYW1lLCBkZWZhdWx0VmFsKSB7XG4gICAgaWYgKHNldFByb3BlcnR5T3B0aW9uc1twTmFtZV0gIT09IHVuZGVmaW5lZCAmJiBzZXRQcm9wZXJ0eU9wdGlvbnNbcE5hbWVdICE9PSBudWxsKSB7XG4gICAgICAgIHNldFByb3BlcnR5VGFyZ2V0W3BOYW1lXSA9IHNldFByb3BlcnR5T3B0aW9uc1twTmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXRbcE5hbWVdID0gZGVmYXVsdFZhbDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBhY2szTkZsb2F0cyhhLCBiLCBjKSB7XG4gICAgY29uc3QgcGFja2VkID0gKChhICogMjU1KSA8PCAxNikgfCAoKGIgKiAyNTUpIDw8IDgpIHwgKGMgKiAyNTUpO1xuICAgIHJldHVybiAocGFja2VkKSAvICgxIDw8IDI0KTtcbn1cblxuZnVuY3Rpb24gcGFja1RleHR1cmVYWVpfTlhZWihxWFlaLCBxWFlaMikge1xuICAgIGNvbnN0IG51bSA9IHFYWVoubGVuZ3RoIC8gMztcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkobnVtICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW07IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcVhZWltpICogM107XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcVhZWltpICogMyArIDFdO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAyXSA9IHFYWVpbaSAqIDMgKyAyXTtcblxuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IHBhY2szTkZsb2F0cyhxWFlaMltpICogM10sIHFYWVoyW2kgKiAzICsgMV0sIHFYWVoyW2kgKiAzICsgMl0pO1xuICAgIH1cbiAgICByZXR1cm4gY29sb3JzO1xufVxuXG5mdW5jdGlvbiBwYWNrVGV4dHVyZVJHQkEocVJHQiwgcUEpIHtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkocUEubGVuZ3RoICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxQS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcVJHQltpICogM107XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcVJHQltpICogMyArIDFdO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAyXSA9IHFSR0JbaSAqIDMgKyAyXTtcblxuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IHFBW2ldO1xuICAgIH1cbiAgICByZXR1cm4gY29sb3JzO1xufVxuXG5mdW5jdGlvbiBwYWNrVGV4dHVyZTVGbG9hdHMocUEsIHFCLCBxQywgcUQsIHFFKSB7XG4gICAgY29uc3QgY29sb3JzID0gbmV3IEFycmF5KHFBLmxlbmd0aCAqIDQpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcUEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29sb3JzW2kgKiA0XSA9IHFBW2ldO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAxXSA9IHFCW2ldO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAyXSA9IDA7XG5cbiAgICAgICAgY29sb3JzW2kgKiA0ICsgM10gPSBwYWNrM05GbG9hdHMocUNbaV0sIHFEW2ldLCBxRVtpXSk7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlMkZsb2F0cyhxQSwgcUIpIHtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkocUEubGVuZ3RoICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxQS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcUFbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcUJbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gMDtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4gY29sb3JzO1xufVxuXG5mdW5jdGlvbiBjYWxjRW5kVGltZShlbWl0dGVyKSB7XG4gICAgY29uc3QgaW50ZXJ2YWwgPSAoTWF0aC5tYXgoZW1pdHRlci5yYXRlLCBlbWl0dGVyLnJhdGUyKSAqIGVtaXR0ZXIubnVtUGFydGljbGVzICsgZW1pdHRlci5saWZldGltZSk7XG4gICAgcmV0dXJuIERhdGUubm93KCkgKyBpbnRlcnZhbCAqIDEwMDA7XG59XG5cbmZ1bmN0aW9uIHN1YkdyYXBoKEEsIEIpIHtcbiAgICBjb25zdCByID0gbmV3IEZsb2F0MzJBcnJheShBLmxlbmd0aCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJbaV0gPSBBW2ldIC0gQltpXTtcbiAgICB9XG4gICAgcmV0dXJuIHI7XG59XG5cbmZ1bmN0aW9uIG1heFVuc2lnbmVkR3JhcGhWYWx1ZShBLCBvdXRVTWF4KSB7XG4gICAgY29uc3QgY2hhbnMgPSBvdXRVTWF4Lmxlbmd0aDtcbiAgICBjb25zdCB2YWx1ZXMgPSBBLmxlbmd0aCAvIGNoYW5zO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWVzOyBpKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjaGFuczsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBhID0gTWF0aC5hYnMoQVtpICogY2hhbnMgKyBqXSk7XG4gICAgICAgICAgICBvdXRVTWF4W2pdID0gTWF0aC5tYXgob3V0VU1heFtqXSwgYSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUdyYXBoKEEsIHVNYXgpIHtcbiAgICBjb25zdCBjaGFucyA9IHVNYXgubGVuZ3RoO1xuICAgIGNvbnN0IHZhbHVlcyA9IEEubGVuZ3RoIC8gY2hhbnM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXM7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNoYW5zOyBqKyspIHtcbiAgICAgICAgICAgIEFbaSAqIGNoYW5zICsgal0gLz0gKHVNYXhbal0gPT09IDAgPyAxIDogdU1heFtqXSk7XG4gICAgICAgICAgICBBW2kgKiBjaGFucyArIGpdICo9IDAuNTtcbiAgICAgICAgICAgIEFbaSAqIGNoYW5zICsgal0gKz0gMC41O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaXZHcmFwaEZyb20yQ3VydmVzKGN1cnZlMSwgY3VydmUyLCBvdXRVTWF4KSB7XG4gICAgY29uc3Qgc3ViID0gc3ViR3JhcGgoY3VydmUyLCBjdXJ2ZTEpO1xuICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZShzdWIsIG91dFVNYXgpO1xuICAgIG5vcm1hbGl6ZUdyYXBoKHN1Yiwgb3V0VU1heCk7XG4gICAgcmV0dXJuIHN1Yjtcbn1cblxuLy8gYSBkZXZpY2UgY2FjaGUgc3RvcmluZyBkZWZhdWx0IHBhcmFtZXRlciB0ZXh0dXJlIGZvciB0aGUgZW1pdHRlclxuY29uc3QgcGFydGljbGVFbWl0dGVyRGV2aWNlQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuY2xhc3MgUGFydGljbGVFbWl0dGVyIHtcbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IGdkID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHByZWNpc2lvbiA9IDMyO1xuICAgICAgICB0aGlzLnByZWNpc2lvbiA9IHByZWNpc2lvbjtcblxuICAgICAgICB0aGlzLl9hZGRUaW1lVGltZSA9IDA7XG5cbiAgICAgICAgLy8gR2xvYmFsIHN5c3RlbSBwYXJhbWV0ZXJzXG4gICAgICAgIHNldFByb3BlcnR5VGFyZ2V0ID0gdGhpcztcbiAgICAgICAgc2V0UHJvcGVydHlPcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgc2V0UHJvcGVydHkoJ251bVBhcnRpY2xlcycsIDEpOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQW1vdW50IG9mIHBhcnRpY2xlcyBhbGxvY2F0ZWQgKG1heCBwYXJ0aWNsZXMgPSBtYXggR0wgdGV4dHVyZSB3aWR0aCBhdCB0aGlzIG1vbWVudClcblxuICAgICAgICBpZiAodGhpcy5udW1QYXJ0aWNsZXMgPiBncmFwaGljc0RldmljZS5tYXhUZXh0dXJlU2l6ZSkge1xuICAgICAgICAgICAgRGVidWcud2FybihgV0FSTklORzogY2FuJ3QgY3JlYXRlIG1vcmUgdGhhbiAke2dyYXBoaWNzRGV2aWNlLm1heFRleHR1cmVTaXplfSBwYXJ0aWNsZXMgb24gdGhpcyBkZXZpY2UuYCk7XG4gICAgICAgICAgICB0aGlzLm51bVBhcnRpY2xlcyA9IGdyYXBoaWNzRGV2aWNlLm1heFRleHR1cmVTaXplO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhdGUnLCAxKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRW1pc3Npb24gcmF0ZVxuICAgICAgICBzZXRQcm9wZXJ0eSgncmF0ZTInLCB0aGlzLnJhdGUpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbGlmZXRpbWUnLCA1MCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJ0aWNsZSBsaWZldGltZVxuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlckV4dGVudHMnLCBuZXcgVmVjMygwLCAwLCAwKSk7ICAgICAgICAvLyBTcGF3biBwb2ludCBkaXZlcmdlbmNlXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyRXh0ZW50c0lubmVyJywgbmV3IFZlYzMoMCwgMCwgMCkpOyAgIC8vIFZvbHVtZSBpbnNpZGUgZW1pdHRlckV4dGVudHMgdG8gZXhjbHVkZSBmcm9tIHJlZ2VuZXJhdGlvblxuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlclJhZGl1cycsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlclJhZGl1c0lubmVyJywgMCk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBTYW1lIGFzIEV4dGVudHNJbm5lciBidXQgZm9yIHNwaGVyaWNhbCB2b2x1bWVcbiAgICAgICAgc2V0UHJvcGVydHkoJ2VtaXR0ZXJTaGFwZScsIEVNSVRURVJTSEFQRV9CT1gpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnaW5pdGlhbFZlbG9jaXR5JywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCd3cmFwJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbG9jYWxTcGFjZScsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjcmVlblNwYWNlJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnd3JhcEJvdW5kcycsIG51bGwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnY29sb3JNYXAnLCB0aGlzLmRlZmF1bHRQYXJhbVRleHR1cmUpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbm9ybWFsTWFwJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb29wJywgdHJ1ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdwcmVXYXJtJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc29ydCcsIFBBUlRJQ0xFU09SVF9OT05FKTsgLy8gU29ydGluZyBtb2RlOiAwID0gbm9uZSwgMSA9IGJ5IGRpc3RhbmNlLCAyID0gYnkgbGlmZSwgMyA9IGJ5IC1saWZlOyAgRm9yY2VzIENQVSBtb2RlIGlmIG5vdCAwXG4gICAgICAgIHNldFByb3BlcnR5KCdtb2RlJywgUEFSVElDTEVNT0RFX0dQVSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzY2VuZScsIG51bGwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbGlnaHRpbmcnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdoYWxmTGFtYmVydCcsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2ludGVuc2l0eScsIDEuMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdHJldGNoJywgMC4wKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FsaWduVG9Nb3Rpb24nLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdkZXB0aFNvZnRlbmluZycsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbWVzaCcsIG51bGwpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1lc2ggdG8gYmUgdXNlZCBhcyBwYXJ0aWNsZS4gVmVydGV4IGJ1ZmZlciBpcyBzdXBwb3NlZCB0byBob2xkIHZlcnRleCBwb3NpdGlvbiBpbiBmaXJzdCAzIGZsb2F0cyBvZiBlYWNoIHZlcnRleFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIExlYXZlIHVuZGVmaW5lZCB0byB1c2Ugc2ltcGxlIHF1YWRzXG4gICAgICAgIHNldFByb3BlcnR5KCdwYXJ0aWNsZU5vcm1hbCcsIG5ldyBWZWMzKDAsIDEsIDApKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ29yaWVudGF0aW9uJywgUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4pO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdkZXB0aFdyaXRlJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbm9Gb2cnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdibGVuZFR5cGUnLCBCTEVORF9OT1JNQUwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbm9kZScsIG51bGwpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc3RhcnRBbmdsZScsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc3RhcnRBbmdsZTInLCB0aGlzLnN0YXJ0QW5nbGUpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltVGlsZXNYJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltVGlsZXNZJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltU3RhcnRGcmFtZScsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbU51bUZyYW1lcycsIDEpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbU51bUFuaW1hdGlvbnMnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1JbmRleCcsIDApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgncmFuZG9taXplQW5pbUluZGV4JywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbVNwZWVkJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTG9vcCcsIHRydWUpO1xuXG4gICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIgPSBuZXcgUGFydGljbGVHUFVVcGRhdGVyKHRoaXMsIGdkKTtcbiAgICAgICAgdGhpcy5fY3B1VXBkYXRlciA9IG5ldyBQYXJ0aWNsZUNQVVVwZGF0ZXIodGhpcyk7XG5cbiAgICAgICAgdGhpcy5jb25zdGFudExpZ2h0Q3ViZSA9IGdkLnNjb3BlLnJlc29sdmUoJ2xpZ2h0Q3ViZVswXScpO1xuICAgICAgICB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy53cmFwQm91bmRzVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoWzEsIDEsIDFdKTtcblxuICAgICAgICAvLyBUaW1lLWRlcGVuZGVudCBwYXJhbWV0ZXJzXG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvckdyYXBoJywgZGVmYXVsdDFDdXJ2ZTMpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnY29sb3JHcmFwaDInLCB0aGlzLmNvbG9yR3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdzY2FsZUdyYXBoJywgZGVmYXVsdDFDdXJ2ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzY2FsZUdyYXBoMicsIHRoaXMuc2NhbGVHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2FscGhhR3JhcGgnLCBkZWZhdWx0MUN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FscGhhR3JhcGgyJywgdGhpcy5hbHBoYUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgnbG9jYWxWZWxvY2l0eUdyYXBoJywgZGVmYXVsdDBDdXJ2ZTMpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbG9jYWxWZWxvY2l0eUdyYXBoMicsIHRoaXMubG9jYWxWZWxvY2l0eUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgndmVsb2NpdHlHcmFwaCcsIGRlZmF1bHQwQ3VydmUzKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3ZlbG9jaXR5R3JhcGgyJywgdGhpcy52ZWxvY2l0eUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgncm90YXRpb25TcGVlZEdyYXBoJywgZGVmYXVsdDBDdXJ2ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdyb3RhdGlvblNwZWVkR3JhcGgyJywgdGhpcy5yb3RhdGlvblNwZWVkR3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdyYWRpYWxTcGVlZEdyYXBoJywgZGVmYXVsdDBDdXJ2ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdyYWRpYWxTcGVlZEdyYXBoMicsIHRoaXMucmFkaWFsU3BlZWRHcmFwaCk7XG5cbiAgICAgICAgdGhpcy5saWdodEN1YmUgPSBuZXcgRmxvYXQzMkFycmF5KDYgKiAzKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXIgPSBuZXcgQXJyYXkoNik7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzBdID0gbmV3IFZlYzMoLTEsIDAsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpclsxXSA9IG5ldyBWZWMzKDEsIDAsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpclsyXSA9IG5ldyBWZWMzKDAsIC0xLCAwKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbM10gPSBuZXcgVmVjMygwLCAxLCAwKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbNF0gPSBuZXcgVmVjMygwLCAwLCAtMSk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzVdID0gbmV3IFZlYzMoMCwgMCwgMSk7XG5cbiAgICAgICAgdGhpcy5hbmltVGlsZXNQYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLmFuaW1QYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLmFuaW1JbmRleFBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5cbiAgICAgICAgdGhpcy5pbnRlcm5hbFRleDAgPSBudWxsO1xuICAgICAgICB0aGlzLmludGVybmFsVGV4MSA9IG51bGw7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxUZXgyID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb2xvclBhcmFtID0gbnVsbDtcblxuICAgICAgICB0aGlzLnZiVG9Tb3J0ID0gbnVsbDtcbiAgICAgICAgdGhpcy52Yk9sZCA9IG51bGw7XG4gICAgICAgIHRoaXMucGFydGljbGVEaXN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jYW1lcmEgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc3dhcFRleCA9IGZhbHNlO1xuICAgICAgICB0aGlzLnVzZU1lc2ggPSB0cnVlO1xuICAgICAgICB0aGlzLnVzZUNwdSA9ICFncmFwaGljc0RldmljZS5zdXBwb3J0c0dwdVBhcnRpY2xlcztcblxuICAgICAgICB0aGlzLnBhY2s4ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5sb2NhbEJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTm9UcmFpbCA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWwgPSBbbmV3IEJvdW5kaW5nQm94KCksIG5ldyBCb3VuZGluZ0JveCgpXTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplID0gbmV3IFZlYzMoKTtcblxuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc0NlbnRlciA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMucHJldkVtaXR0ZXJFeHRlbnRzID0gdGhpcy5lbWl0dGVyRXh0ZW50cztcbiAgICAgICAgdGhpcy5wcmV2RW1pdHRlclJhZGl1cyA9IHRoaXMuZW1pdHRlclJhZGl1cztcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc011bCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcyA9IDA7XG4gICAgICAgIC8vIHRoaXMucHJldlBvcyA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZVJlc3Bhd24gPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlTm9SZXNwYXduID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZU9uU3RvcCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZVZlcnRzID0gMDtcbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZUluZGljZXMgPSAwO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZHJhd09yZGVyID0gMDtcblxuICAgICAgICB0aGlzLnNlZWQgPSBNYXRoLnJhbmRvbSgpO1xuXG4gICAgICAgIHRoaXMuZml4ZWRUaW1lU3RlcCA9IDEuMCAvIDYwO1xuICAgICAgICB0aGlzLm1heFN1YlN0ZXBzID0gMTA7XG4gICAgICAgIHRoaXMuc2ltVGltZSA9IDA7XG4gICAgICAgIHRoaXMuc2ltVGltZVRvdGFsID0gMDtcblxuICAgICAgICB0aGlzLmJlZW5SZXNldCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2xheWVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnJlYnVpbGQoKTtcbiAgICB9XG5cbiAgICBnZXQgZGVmYXVsdFBhcmFtVGV4dHVyZSgpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuZ3JhcGhpY3NEZXZpY2UpO1xuICAgICAgICByZXR1cm4gcGFydGljbGVFbWl0dGVyRGV2aWNlQ2FjaGUuZ2V0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdXRpb24gPSAxNjtcbiAgICAgICAgICAgIGNvbnN0IGNlbnRlclBvaW50ID0gcmVzb2x1dGlvbiAqIDAuNSArIDAuNTtcbiAgICAgICAgICAgIGNvbnN0IGR0ZXggPSBuZXcgRmxvYXQzMkFycmF5KHJlc29sdXRpb24gKiByZXNvbHV0aW9uICogNCk7XG4gICAgICAgICAgICBmb3IgKGxldCB5ID0gMDsgeSA8IHJlc29sdXRpb247IHkrKykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IHggPSAwOyB4IDwgcmVzb2x1dGlvbjsgeCsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHhncmFkID0gKHggKyAxKSAtIGNlbnRlclBvaW50O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB5Z3JhZCA9ICh5ICsgMSkgLSBjZW50ZXJQb2ludDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYyA9IHNhdHVyYXRlKCgxIC0gc2F0dXJhdGUoTWF0aC5zcXJ0KHhncmFkICogeGdyYWQgKyB5Z3JhZCAqIHlncmFkKSAvIHJlc29sdXRpb24pKSAtIDAuNSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHAgPSB5ICogcmVzb2x1dGlvbiArIHg7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDRdID0gICAgIDE7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDQgKyAxXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDQgKyAyXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGR0ZXhbcCAqIDQgKyAzXSA9IGM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gX2NyZWF0ZVRleHR1cmUodGhpcy5ncmFwaGljc0RldmljZSwgcmVzb2x1dGlvbiwgcmVzb2x1dGlvbiwgZHRleCwgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsIDEuMCwgdHJ1ZSk7XG4gICAgICAgICAgICB0ZXh0dXJlLm1pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICB0ZXh0dXJlLm1hZ0ZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICByZXR1cm4gdGV4dHVyZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgb25DaGFuZ2VDYW1lcmEoKSB7XG4gICAgICAgIHRoaXMucmVnZW5TaGFkZXIoKTtcbiAgICAgICAgdGhpcy5yZXNldE1hdGVyaWFsKCk7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm91bmRzTWFkKCkge1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsLnggPSAxLjAgLyB0aGlzLndvcmxkQm91bmRzU2l6ZS54O1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsLnkgPSAxLjAgLyB0aGlzLndvcmxkQm91bmRzU2l6ZS55O1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsLnogPSAxLjAgLyB0aGlzLndvcmxkQm91bmRzU2l6ZS56O1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQuY29weSh0aGlzLndvcmxkQm91bmRzLmNlbnRlcikubXVsKHRoaXMud29ybGRCb3VuZHNNdWwpLm11bFNjYWxhcigtMSk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQueCArPSAwLjU7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQueSArPSAwLjU7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNBZGQueiArPSAwLjU7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlV29ybGRCb3VuZHMoKSB7XG4gICAgICAgIGlmICghdGhpcy5ub2RlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kc1NpemUpO1xuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc0NlbnRlci5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKTtcblxuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICBsZXQgcmVjYWxjdWxhdGVMb2NhbEJvdW5kcyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlclNoYXBlID09PSBFTUlUVEVSU0hBUEVfQk9YKSB7XG4gICAgICAgICAgICAgICAgcmVjYWxjdWxhdGVMb2NhbEJvdW5kcyA9ICF0aGlzLmVtaXR0ZXJFeHRlbnRzLmVxdWFscyh0aGlzLnByZXZFbWl0dGVyRXh0ZW50cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlY2FsY3VsYXRlTG9jYWxCb3VuZHMgPSAhKHRoaXMuZW1pdHRlclJhZGl1cyA9PT0gdGhpcy5wcmV2RW1pdHRlclJhZGl1cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVjYWxjdWxhdGVMb2NhbEJvdW5kcykge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsY3VsYXRlTG9jYWxCb3VuZHMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgY29uc3Qgbm9kZVdUID0gdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsLmNvcHkodGhpcy5sb2NhbEJvdW5kcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzTm9UcmFpbC5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMubG9jYWxCb3VuZHMsIG5vZGVXVCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMF0uYWRkKHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdLmFkZCh0aGlzLndvcmxkQm91bmRzTm9UcmFpbCk7XG5cbiAgICAgICAgY29uc3Qgbm93ID0gdGhpcy5zaW1UaW1lVG90YWw7XG4gICAgICAgIGlmIChub3cgPj0gdGhpcy50aW1lVG9Td2l0Y2hCb3VuZHMpIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5jb3B5KHRoaXMud29ybGRCb3VuZHNUcmFpbFsxXSk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzTm9UcmFpbCk7XG4gICAgICAgICAgICB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcyA9IG5vdyArIHRoaXMubGlmZXRpbWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLndvcmxkQm91bmRzLmNvcHkodGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdKTtcblxuICAgICAgICB0aGlzLndvcmxkQm91bmRzU2l6ZS5jb3B5KHRoaXMud29ybGRCb3VuZHMuaGFsZkV4dGVudHMpLm11bFNjYWxhcigyKTtcblxuICAgICAgICBpZiAodGhpcy5sb2NhbFNwYWNlKSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy53b3JsZEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm1lc2guYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMud29ybGRCb3VuZHMsIG5vZGVXVCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tZXNoLmFhYmIuY29weSh0aGlzLndvcmxkQm91bmRzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fYWFiYlZlciA9IDEgLSB0aGlzLm1lc2hJbnN0YW5jZS5fYWFiYlZlcjtcblxuICAgICAgICBpZiAodGhpcy5wYWNrOCkgdGhpcy5jYWxjdWxhdGVCb3VuZHNNYWQoKTtcbiAgICB9XG5cbiAgICByZXNldFdvcmxkQm91bmRzKCkge1xuICAgICAgICBpZiAoIXRoaXMubm9kZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoXG4gICAgICAgICAgICB0aGlzLmxvY2FsQm91bmRzLCB0aGlzLmxvY2FsU3BhY2UgPyBNYXQ0LklERU5USVRZIDogdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5jb3B5KHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdLmNvcHkodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHMuY29weSh0aGlzLndvcmxkQm91bmRzVHJhaWxbMF0pO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzU2l6ZS5jb3B5KHRoaXMud29ybGRCb3VuZHMuaGFsZkV4dGVudHMpLm11bFNjYWxhcigyKTtcblxuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyLmNvcHkodGhpcy53b3JsZEJvdW5kcy5jZW50ZXIpO1xuXG4gICAgICAgIHRoaXMuc2ltVGltZVRvdGFsID0gMDtcbiAgICAgICAgdGhpcy50aW1lVG9Td2l0Y2hCb3VuZHMgPSAwO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUxvY2FsQm91bmRzKCkge1xuICAgICAgICBsZXQgbWlueCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtaW55ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgbGV0IG1pbnogPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4eCA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4eSA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4eiA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWF4UiA9IDA7XG4gICAgICAgIGxldCBtYXhTY2FsZSA9IDA7XG4gICAgICAgIGNvbnN0IHN0ZXBXZWlnaHQgPSB0aGlzLmxpZmV0aW1lIC8gdGhpcy5wcmVjaXNpb247XG4gICAgICAgIGNvbnN0IHdWZWxzID0gW3RoaXMucVZlbG9jaXR5LCB0aGlzLnFWZWxvY2l0eTJdO1xuICAgICAgICBjb25zdCBsVmVscyA9IFt0aGlzLnFMb2NhbFZlbG9jaXR5LCB0aGlzLnFMb2NhbFZlbG9jaXR5Ml07XG4gICAgICAgIGNvbnN0IGFjY3VtWCA9IFswLCAwXTtcbiAgICAgICAgY29uc3QgYWNjdW1ZID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVogPSBbMCwgMF07XG4gICAgICAgIGNvbnN0IGFjY3VtUiA9IFswLCAwXTtcbiAgICAgICAgY29uc3QgYWNjdW1XID0gWzAsIDBdO1xuICAgICAgICBsZXQgeCwgeSwgejtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnByZWNpc2lvbiArIDE7IGkrKykgeyAvLyB0YWtlIGV4dHJhIHN0ZXAgdG8gcHJldmVudCBwb3NpdGlvbiBnbGl0Y2hlc1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBNYXRoLm1pbihpLCB0aGlzLnByZWNpc2lvbiAtIDEpO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCAyOyBqKyspIHtcbiAgICAgICAgICAgICAgICB4ID0gbFZlbHNbal1baW5kZXggKiAzICsgMF0gKiBzdGVwV2VpZ2h0ICsgYWNjdW1YW2pdO1xuICAgICAgICAgICAgICAgIHkgPSBsVmVsc1tqXVtpbmRleCAqIDMgKyAxXSAqIHN0ZXBXZWlnaHQgKyBhY2N1bVlbal07XG4gICAgICAgICAgICAgICAgeiA9IGxWZWxzW2pdW2luZGV4ICogMyArIDJdICogc3RlcFdlaWdodCArIGFjY3VtWltqXTtcblxuICAgICAgICAgICAgICAgIG1pbnggPSBNYXRoLm1pbih4LCBtaW54KTtcbiAgICAgICAgICAgICAgICBtaW55ID0gTWF0aC5taW4oeSwgbWlueSk7XG4gICAgICAgICAgICAgICAgbWlueiA9IE1hdGgubWluKHosIG1pbnopO1xuICAgICAgICAgICAgICAgIG1heHggPSBNYXRoLm1heCh4LCBtYXh4KTtcbiAgICAgICAgICAgICAgICBtYXh5ID0gTWF0aC5tYXgoeSwgbWF4eSk7XG4gICAgICAgICAgICAgICAgbWF4eiA9IE1hdGgubWF4KHosIG1heHopO1xuXG4gICAgICAgICAgICAgICAgYWNjdW1YW2pdID0geDtcbiAgICAgICAgICAgICAgICBhY2N1bVlbal0gPSB5O1xuICAgICAgICAgICAgICAgIGFjY3VtWltqXSA9IHo7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDI7IGorKykge1xuICAgICAgICAgICAgICAgIGFjY3VtV1tqXSArPSBzdGVwV2VpZ2h0ICogTWF0aC5zcXJ0KFxuICAgICAgICAgICAgICAgICAgICB3VmVsc1tqXVtpbmRleCAqIDMgKyAwXSAqIHdWZWxzW2pdW2luZGV4ICogMyArIDBdICtcbiAgICAgICAgICAgICAgICAgICAgd1ZlbHNbal1baW5kZXggKiAzICsgMV0gKiB3VmVsc1tqXVtpbmRleCAqIDMgKyAxXSArXG4gICAgICAgICAgICAgICAgICAgIHdWZWxzW2pdW2luZGV4ICogMyArIDJdICogd1ZlbHNbal1baW5kZXggKiAzICsgMl0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhY2N1bVJbMF0gKz0gdGhpcy5xUmFkaWFsU3BlZWRbaW5kZXhdICogc3RlcFdlaWdodDtcbiAgICAgICAgICAgIGFjY3VtUlsxXSArPSB0aGlzLnFSYWRpYWxTcGVlZDJbaW5kZXhdICogc3RlcFdlaWdodDtcbiAgICAgICAgICAgIG1heFIgPSBNYXRoLm1heChtYXhSLCBNYXRoLm1heChNYXRoLmFicyhhY2N1bVJbMF0pLCBNYXRoLmFicyhhY2N1bVJbMV0pKSk7XG5cbiAgICAgICAgICAgIG1heFNjYWxlID0gTWF0aC5tYXgobWF4U2NhbGUsIHRoaXMucVNjYWxlW2luZGV4XSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgIHggPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnggKiAwLjU7XG4gICAgICAgICAgICB5ID0gdGhpcy5lbWl0dGVyRXh0ZW50cy55ICogMC41O1xuICAgICAgICAgICAgeiA9IHRoaXMuZW1pdHRlckV4dGVudHMueiAqIDAuNTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHggPSB0aGlzLmVtaXR0ZXJSYWRpdXM7XG4gICAgICAgICAgICB5ID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICAgICAgeiA9IHRoaXMuZW1pdHRlclJhZGl1cztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHcgPSBNYXRoLm1heChhY2N1bVdbMF0sIGFjY3VtV1sxXSk7XG4gICAgICAgIGJNaW4ueCA9IG1pbnggLSBtYXhTY2FsZSAtIHggLSBtYXhSIC0gdztcbiAgICAgICAgYk1pbi55ID0gbWlueSAtIG1heFNjYWxlIC0geSAtIG1heFIgLSB3O1xuICAgICAgICBiTWluLnogPSBtaW56IC0gbWF4U2NhbGUgLSB6IC0gbWF4UiAtIHc7XG4gICAgICAgIGJNYXgueCA9IG1heHggKyBtYXhTY2FsZSArIHggKyBtYXhSICsgdztcbiAgICAgICAgYk1heC55ID0gbWF4eSArIG1heFNjYWxlICsgeSArIG1heFIgKyB3O1xuICAgICAgICBiTWF4LnogPSBtYXh6ICsgbWF4U2NhbGUgKyB6ICsgbWF4UiArIHc7XG4gICAgICAgIHRoaXMubG9jYWxCb3VuZHMuc2V0TWluTWF4KGJNaW4sIGJNYXgpO1xuICAgIH1cblxuICAgIHJlYnVpbGQoKSB7XG4gICAgICAgIGNvbnN0IGdkID0gdGhpcy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICBpZiAodGhpcy5jb2xvck1hcCA9PT0gbnVsbCkgdGhpcy5jb2xvck1hcCA9IHRoaXMuZGVmYXVsdFBhcmFtVGV4dHVyZTtcblxuICAgICAgICB0aGlzLnNwYXduQm91bmRzID0gdGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1ggPyB0aGlzLmVtaXR0ZXJFeHRlbnRzIDogdGhpcy5lbWl0dGVyUmFkaXVzO1xuXG4gICAgICAgIHRoaXMudXNlQ3B1ID0gdGhpcy51c2VDcHUgfHwgdGhpcy5zb3J0ID4gUEFSVElDTEVTT1JUX05PTkUgfHwgIC8vIGZvcmNlIENQVSBpZiBkZXNpcmFibGUgYnkgdXNlciBvciBzb3J0aW5nIGlzIGVuYWJsZWRcbiAgICAgICAgZ2QubWF4VmVydGV4VGV4dHVyZXMgPD0gMSB8fCAvLyBmb3JjZSBDUFUgaWYgY2FuJ3QgdXNlIGVub3VnaCB2ZXJ0ZXggdGV4dHVyZXNcbiAgICAgICAgZ2QuZnJhZ21lbnRVbmlmb3Jtc0NvdW50IDwgNjQgfHwgLy8gZm9yY2UgQ1BVIGlmIGNhbid0IHVzZSBtYW55IHVuaWZvcm1zOyBUT0RPOiBjaGFuZ2UgdG8gbW9yZSByZWFsaXN0aWMgdmFsdWUgKHRoaXMgb25lIGlzIGlwaG9uZSdzKVxuICAgICAgICBnZC5mb3JjZUNwdVBhcnRpY2xlcyB8fFxuICAgICAgICAhZ2QuZXh0VGV4dHVyZUZsb2F0OyAvLyBubyBmbG9hdCB0ZXh0dXJlIGV4dGVuc2lvblxuXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lSZXNvdXJjZXMoKTtcblxuICAgICAgICB0aGlzLnBhY2s4ID0gKHRoaXMucGFjazggfHwgIWdkLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpICYmICF0aGlzLnVzZUNwdTtcblxuICAgICAgICBwYXJ0aWNsZVRleEhlaWdodCA9ICh0aGlzLnVzZUNwdSB8fCB0aGlzLnBhY2s4KSA/IDQgOiAyO1xuXG4gICAgICAgIHRoaXMudXNlTWVzaCA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5tZXNoKSB7XG4gICAgICAgICAgICBjb25zdCB0b3RhbFZlcnRDb3VudCA9IHRoaXMubnVtUGFydGljbGVzICogdGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIGlmICh0b3RhbFZlcnRDb3VudCA+IDY1NTM1KSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybignV0FSTklORzogcGFydGljbGUgc3lzdGVtIGNhblxcJ3QgcmVuZGVyIG1lc2ggcGFydGljbGVzIGJlY2F1c2UgbnVtUGFydGljbGVzICogbnVtVmVydGljZXMgaXMgbW9yZSB0aGFuIDY1ay4gUmV2ZXJ0aW5nIHRvIHF1YWQgcGFydGljbGVzLicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVzZU1lc2ggPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZXNQb3QgPSBtYXRoLm5leHRQb3dlck9mVHdvKHRoaXMubnVtUGFydGljbGVzKTtcbiAgICAgICAgdGhpcy5yZWJ1aWxkR3JhcGhzKCk7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlTG9jYWxCb3VuZHMoKTtcbiAgICAgICAgdGhpcy5yZXNldFdvcmxkQm91bmRzKCk7XG5cbiAgICAgICAgaWYgKHRoaXMubm9kZSkge1xuICAgICAgICAgICAgLy8gdGhpcy5wcmV2UG9zLmNvcHkodGhpcy5ub2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kcy5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKFxuICAgICAgICAgICAgICAgIHRoaXMubG9jYWxCb3VuZHMsIHRoaXMubG9jYWxTcGFjZSA/IE1hdDQuSURFTlRJVFkgOiB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG5cbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5jb3B5KHRoaXMud29ybGRCb3VuZHMpO1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG5cbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuICAgICAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kc1NpemUpO1xuICAgICAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNDZW50ZXIuY29weSh0aGlzLndvcmxkQm91bmRzLmNlbnRlcik7XG4gICAgICAgICAgICBpZiAodGhpcy5wYWNrOCkgdGhpcy5jYWxjdWxhdGVCb3VuZHNNYWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIER5bmFtaWMgc2ltdWxhdGlvbiBkYXRhXG4gICAgICAgIHRoaXMudmJUb1NvcnQgPSBuZXcgQXJyYXkodGhpcy5udW1QYXJ0aWNsZXMpO1xuICAgICAgICBmb3IgKGxldCBpU29ydCA9IDA7IGlTb3J0IDwgdGhpcy5udW1QYXJ0aWNsZXM7IGlTb3J0KyspIHRoaXMudmJUb1NvcnRbaVNvcnRdID0gWzAsIDBdO1xuICAgICAgICB0aGlzLnBhcnRpY2xlRGlzdGFuY2UgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtUGFydGljbGVzKTtcblxuICAgICAgICB0aGlzLl9ncHVVcGRhdGVyLnJhbmRvbWl6ZSgpO1xuXG4gICAgICAgIHRoaXMucGFydGljbGVUZXggPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtUGFydGljbGVzUG90ICogcGFydGljbGVUZXhIZWlnaHQgKiBwYXJ0aWNsZVRleENoYW5uZWxzKTtcbiAgICAgICAgY29uc3QgZW1pdHRlclBvcyA9ICh0aGlzLm5vZGUgPT09IG51bGwgfHwgdGhpcy5sb2NhbFNwYWNlKSA/IFZlYzMuWkVSTyA6IHRoaXMubm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm5vZGUgPT09IG51bGwgfHwgdGhpcy5sb2NhbFNwYWNlKSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgUXVhdC5JREVOVElUWSwgdGhpcy5zcGF3bkJvdW5kcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNwYXduTWF0cml4LnNldFRSUyhWZWMzLlpFUk8sIHRoaXMubm9kZS5nZXRSb3RhdGlvbigpLCB0bXBWZWMzLmNvcHkodGhpcy5zcGF3bkJvdW5kcykubXVsKHRoaXMubm9kZS5sb2NhbFNjYWxlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMF0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnggIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueCAvIHRoaXMuZW1pdHRlckV4dGVudHMueCA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMV0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueSAvIHRoaXMuZW1pdHRlckV4dGVudHMueSA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMl0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnogIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueiAvIHRoaXMuZW1pdHRlckV4dGVudHMueiA6IDA7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm51bVBhcnRpY2xlczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jcHVVcGRhdGVyLmNhbGNTcGF3blBvc2l0aW9uKHRoaXMucGFydGljbGVUZXgsIHNwYXduTWF0cml4LCBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0sIGVtaXR0ZXJQb3MsIGkpO1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlQ3B1KSB0aGlzLnBhcnRpY2xlVGV4W2kgKiBwYXJ0aWNsZVRleENoYW5uZWxzICsgMyArIHRoaXMubnVtUGFydGljbGVzUG90ICogMiAqIHBhcnRpY2xlVGV4Q2hhbm5lbHNdID0gMTsgLy8gaGlkZS9zaG93XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtUGFydGljbGVzUG90ICogcGFydGljbGVUZXhIZWlnaHQgKiBwYXJ0aWNsZVRleENoYW5uZWxzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydFtpXSA9IHRoaXMucGFydGljbGVUZXhbaV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wYWNrOCkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTiA9IF9jcmVhdGVUZXh0dXJlKGdkLCB0aGlzLm51bVBhcnRpY2xlc1BvdCwgcGFydGljbGVUZXhIZWlnaHQsIHRoaXMucGFydGljbGVUZXgsIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCAxLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleE9VVCA9IF9jcmVhdGVUZXh0dXJlKGdkLCB0aGlzLm51bVBhcnRpY2xlc1BvdCwgcGFydGljbGVUZXhIZWlnaHQsIHRoaXMucGFydGljbGVUZXgsIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCAxLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0ID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0LCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgMSwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4SU4gPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VUID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0ID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4SU4gPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGhpcy5wYXJ0aWNsZVRleElOLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhPVVQgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGhpcy5wYXJ0aWNsZVRleE9VVCxcbiAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5zd2FwVGV4ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzaGFkZXJDb2RlU3RhcnQgPSAodGhpcy5sb2NhbFNwYWNlID8gJyNkZWZpbmUgTE9DQUxfU1BBQ0VcXG4nIDogJycpICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlckluaXRQUyArXG4gICAgICAgICh0aGlzLnBhY2s4ID8gKHNoYWRlckNodW5rcy5wYXJ0aWNsZUlucHV0UmdiYThQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZU91dHB1dFJnYmE4UFMpIDpcbiAgICAgICAgICAgIChzaGFkZXJDaHVua3MucGFydGljbGVJbnB1dEZsb2F0UFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVPdXRwdXRGbG9hdFBTKSkgK1xuICAgICAgICAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1ggPyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyQUFCQlBTIDogc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclNwaGVyZVBTKSArXG4gICAgICAgIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJTdGFydFBTO1xuICAgICAgICBjb25zdCBzaGFkZXJDb2RlUmVzcGF3biA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJSZXNwYXduUFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyRW5kUFM7XG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVOb1Jlc3Bhd24gPSBzaGFkZXJDb2RlU3RhcnQgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyTm9SZXNwYXduUFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyRW5kUFM7XG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVPblN0b3AgPSBzaGFkZXJDb2RlU3RhcnQgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyT25TdG9wUFMgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyRW5kUFM7XG5cbiAgICAgICAgLy8gTm90ZTogY3JlYXRlU2hhZGVyRnJvbUNvZGUgY2FuIHJldHVybiBhIHNoYWRlciBmcm9tIHRoZSBjYWNoZSAobm90IGEgbmV3IHNoYWRlcikgc28gd2UgKnNob3VsZCBub3QqIGRlbGV0ZSB0aGVzZSBzaGFkZXJzXG4gICAgICAgIC8vIHdoZW4gdGhlIHBhcnRpY2xlIGVtaXR0ZXIgaXMgZGVzdHJveWVkXG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHRoaXMuZW1pdHRlclNoYXBlICsgJycgKyB0aGlzLnBhY2s4ICsgJycgKyB0aGlzLmxvY2FsU3BhY2U7XG4gICAgICAgIHRoaXMuc2hhZGVyUGFydGljbGVVcGRhdGVSZXNwYXduID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlUmVzcGF3biwgJ2ZzUXVhZDAnICsgcGFyYW1zKTtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZU5vUmVzcGF3biA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKGdkLCBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUywgc2hhZGVyQ29kZU5vUmVzcGF3biwgJ2ZzUXVhZDEnICsgcGFyYW1zKTtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZU9uU3RvcCA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKGdkLCBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUywgc2hhZGVyQ29kZU9uU3RvcCwgJ2ZzUXVhZDInICsgcGFyYW1zKTtcblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlVmVydHMgPSB0aGlzLnVzZU1lc2ggPyB0aGlzLm1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzIDogNDtcbiAgICAgICAgdGhpcy5udW1QYXJ0aWNsZUluZGljZXMgPSB0aGlzLnVzZU1lc2ggPyB0aGlzLm1lc2guaW5kZXhCdWZmZXJbMF0ubnVtSW5kaWNlcyA6IDY7XG4gICAgICAgIHRoaXMuX2FsbG9jYXRlKHRoaXMubnVtUGFydGljbGVzKTtcblxuICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZ2QpO1xuICAgICAgICBtZXNoLnZlcnRleEJ1ZmZlciA9IHRoaXMudmVydGV4QnVmZmVyO1xuICAgICAgICBtZXNoLmluZGV4QnVmZmVyWzBdID0gdGhpcy5pbmRleEJ1ZmZlcjtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9ICh0aGlzLm51bVBhcnRpY2xlcyAqIHRoaXMubnVtUGFydGljbGVJbmRpY2VzKTtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLm5hbWUgPSB0aGlzLm5vZGUubmFtZTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuYmxlbmQgPSB0cnVlO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmJsZW5kVHlwZSA9IHRoaXMuYmxlbmRUeXBlO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWwuZGVwdGhXcml0ZSA9IHRoaXMuZGVwdGhXcml0ZTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5lbWl0dGVyID0gdGhpcztcblxuICAgICAgICB0aGlzLnJlZ2VuU2hhZGVyKCk7XG4gICAgICAgIHRoaXMucmVzZXRNYXRlcmlhbCgpO1xuXG4gICAgICAgIGNvbnN0IHdhc1Zpc2libGUgPSB0aGlzLm1lc2hJbnN0YW5jZSA/IHRoaXMubWVzaEluc3RhbmNlLnZpc2libGUgOiB0cnVlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaCwgdGhpcy5tYXRlcmlhbCwgdGhpcy5ub2RlKTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UucGljayA9IGZhbHNlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS51cGRhdGVLZXkoKTsgLy8gc2hvdWxkbid0IGJlIGhlcmU/XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmN1bGwgPSB0cnVlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fbm9EZXB0aERyYXdHbDEgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5sb2NhbFNwYWNlKSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy53b3JsZEJvdW5kcywgdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuYWFiYi5jb3B5KHRoaXMud29ybGRCb3VuZHMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl91cGRhdGVBYWJiID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnZpc2libGUgPSB3YXNWaXNpYmxlO1xuXG4gICAgICAgIHRoaXMuX2luaXRpYWxpemVUZXh0dXJlcygpO1xuXG4gICAgICAgIHRoaXMucmVzZXRUaW1lKCk7XG5cbiAgICAgICAgdGhpcy5hZGRUaW1lKDAsIGZhbHNlKTsgLy8gZmlsbCBkeW5hbWljIHRleHR1cmVzIGFuZCBjb25zdGFudHMgd2l0aCBpbml0aWFsIGRhdGFcbiAgICAgICAgaWYgKHRoaXMucHJlV2FybSkgdGhpcy5wcmV3YXJtKHRoaXMubGlmZXRpbWUpO1xuICAgIH1cblxuICAgIF9pc0FuaW1hdGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hbmltTnVtRnJhbWVzID49IDEgJiZcbiAgICAgICAgICAgICAgICh0aGlzLmFuaW1UaWxlc1ggPiAxIHx8IHRoaXMuYW5pbVRpbGVzWSA+IDEpICYmXG4gICAgICAgICAgICAgICAodGhpcy5jb2xvck1hcCAmJiB0aGlzLmNvbG9yTWFwICE9PSB0aGlzLmRlZmF1bHRQYXJhbVRleHR1cmUgfHwgdGhpcy5ub3JtYWxNYXApO1xuICAgIH1cblxuICAgIHJlYnVpbGRHcmFwaHMoKSB7XG4gICAgICAgIGNvbnN0IHByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uO1xuICAgICAgICBjb25zdCBnZCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgdGhpcy5xTG9jYWxWZWxvY2l0eSA9IHRoaXMubG9jYWxWZWxvY2l0eUdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVZlbG9jaXR5ID0gdGhpcy52ZWxvY2l0eUdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUNvbG9yID0gICAgICAgICB0aGlzLmNvbG9yR3JhcGgucXVhbnRpemVDbGFtcGVkKHByZWNpc2lvbiwgMCwgMSk7XG4gICAgICAgIHRoaXMucVJvdFNwZWVkID0gICAgICB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFTY2FsZSA9ICAgICAgICAgdGhpcy5zY2FsZUdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUFscGhhID0gICAgICAgICB0aGlzLmFscGhhR3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xUmFkaWFsU3BlZWQgPSAgIHRoaXMucmFkaWFsU3BlZWRHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuXG4gICAgICAgIHRoaXMucUxvY2FsVmVsb2NpdHkyID0gdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVZlbG9jaXR5MiA9ICAgICAgdGhpcy52ZWxvY2l0eUdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFDb2xvcjIgPSAgICAgICAgIHRoaXMuY29sb3JHcmFwaDIucXVhbnRpemVDbGFtcGVkKHByZWNpc2lvbiwgMCwgMSk7XG4gICAgICAgIHRoaXMucVJvdFNwZWVkMiA9ICAgICAgdGhpcy5yb3RhdGlvblNwZWVkR3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVNjYWxlMiA9ICAgICAgICAgdGhpcy5zY2FsZUdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFBbHBoYTIgPSAgICAgICAgIHRoaXMuYWxwaGFHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xUmFkaWFsU3BlZWQyID0gICB0aGlzLnJhZGlhbFNwZWVkR3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVjaXNpb247IGkrKykge1xuICAgICAgICAgICAgdGhpcy5xUm90U3BlZWRbaV0gKj0gbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgdGhpcy5xUm90U3BlZWQyW2ldICo9IG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9jYWxWZWxvY2l0eVVNYXggPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLnZlbG9jaXR5VU1heCA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuY29sb3JVTWF4ID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5yb3RTcGVlZFVNYXggPSBbMF07XG4gICAgICAgIHRoaXMuc2NhbGVVTWF4ID0gICAgWzBdO1xuICAgICAgICB0aGlzLmFscGhhVU1heCA9ICAgIFswXTtcbiAgICAgICAgdGhpcy5yYWRpYWxTcGVlZFVNYXggPSBbMF07XG4gICAgICAgIHRoaXMucUxvY2FsVmVsb2NpdHlEaXYgPSBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucUxvY2FsVmVsb2NpdHksIHRoaXMucUxvY2FsVmVsb2NpdHkyLCB0aGlzLmxvY2FsVmVsb2NpdHlVTWF4KTtcbiAgICAgICAgdGhpcy5xVmVsb2NpdHlEaXYgPSAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xVmVsb2NpdHksIHRoaXMucVZlbG9jaXR5MiwgdGhpcy52ZWxvY2l0eVVNYXgpO1xuICAgICAgICB0aGlzLnFDb2xvckRpdiA9ICAgICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFDb2xvciwgdGhpcy5xQ29sb3IyLCB0aGlzLmNvbG9yVU1heCk7XG4gICAgICAgIHRoaXMucVJvdFNwZWVkRGl2ID0gICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucVJvdFNwZWVkLCB0aGlzLnFSb3RTcGVlZDIsIHRoaXMucm90U3BlZWRVTWF4KTtcbiAgICAgICAgdGhpcy5xU2NhbGVEaXYgPSAgICAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xU2NhbGUsIHRoaXMucVNjYWxlMiwgdGhpcy5zY2FsZVVNYXgpO1xuICAgICAgICB0aGlzLnFBbHBoYURpdiA9ICAgICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFBbHBoYSwgdGhpcy5xQWxwaGEyLCB0aGlzLmFscGhhVU1heCk7XG4gICAgICAgIHRoaXMucVJhZGlhbFNwZWVkRGl2ID0gICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucVJhZGlhbFNwZWVkLCB0aGlzLnFSYWRpYWxTcGVlZDIsIHRoaXMucmFkaWFsU3BlZWRVTWF4KTtcblxuICAgICAgICBpZiAodGhpcy5wYWNrOCkge1xuICAgICAgICAgICAgY29uc3QgdW1heCA9IFswLCAwLCAwXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFWZWxvY2l0eSwgdW1heCk7XG4gICAgICAgICAgICBjb25zdCB1bWF4MiA9IFswLCAwLCAwXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFWZWxvY2l0eTIsIHVtYXgyKTtcblxuICAgICAgICAgICAgY29uc3QgbHVtYXggPSBbMCwgMCwgMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xTG9jYWxWZWxvY2l0eSwgbHVtYXgpO1xuICAgICAgICAgICAgY29uc3QgbHVtYXgyID0gWzAsIDAsIDBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucUxvY2FsVmVsb2NpdHkyLCBsdW1heDIpO1xuXG4gICAgICAgICAgICBjb25zdCBydW1heCA9IFswXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFSYWRpYWxTcGVlZCwgcnVtYXgpO1xuICAgICAgICAgICAgY29uc3QgcnVtYXgyID0gWzBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVJhZGlhbFNwZWVkMiwgcnVtYXgyKTtcblxuICAgICAgICAgICAgbGV0IG1heFZlbCA9IE1hdGgubWF4KHVtYXhbMF0sIHVtYXgyWzBdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heFsxXSk7XG4gICAgICAgICAgICBtYXhWZWwgPSBNYXRoLm1heChtYXhWZWwsIHVtYXgyWzFdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heFsyXSk7XG4gICAgICAgICAgICBtYXhWZWwgPSBNYXRoLm1heChtYXhWZWwsIHVtYXgyWzJdKTtcblxuICAgICAgICAgICAgbGV0IGxtYXhWZWwgPSBNYXRoLm1heChsdW1heFswXSwgbHVtYXgyWzBdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heFsxXSk7XG4gICAgICAgICAgICBsbWF4VmVsID0gTWF0aC5tYXgobG1heFZlbCwgbHVtYXgyWzFdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heFsyXSk7XG4gICAgICAgICAgICBsbWF4VmVsID0gTWF0aC5tYXgobG1heFZlbCwgbHVtYXgyWzJdKTtcblxuICAgICAgICAgICAgY29uc3QgbWF4UmFkID0gTWF0aC5tYXgocnVtYXhbMF0sIHJ1bWF4MlswXSk7XG5cbiAgICAgICAgICAgIHRoaXMubWF4VmVsID0gbWF4VmVsICsgbG1heFZlbCArIG1heFJhZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgwID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmVYWVpfTlhZWih0aGlzLnFMb2NhbFZlbG9jaXR5LCB0aGlzLnFMb2NhbFZlbG9jaXR5RGl2KSk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MSA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlWFlaX05YWVoodGhpcy5xVmVsb2NpdHksIHRoaXMucVZlbG9jaXR5RGl2KSk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MiA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlNUZsb2F0cyh0aGlzLnFSb3RTcGVlZCwgdGhpcy5xU2NhbGUsIHRoaXMucVNjYWxlRGl2LCB0aGlzLnFSb3RTcGVlZERpdiwgdGhpcy5xQWxwaGFEaXYpKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgzID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmUyRmxvYXRzKHRoaXMucVJhZGlhbFNwZWVkLCB0aGlzLnFSYWRpYWxTcGVlZERpdikpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY29sb3JQYXJhbSA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlUkdCQSh0aGlzLnFDb2xvciwgdGhpcy5xQWxwaGEpLCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgMS4wLCB0cnVlKTtcbiAgICB9XG5cbiAgICBfaW5pdGlhbGl6ZVRleHR1cmVzKCkge1xuICAgICAgICBpZiAodGhpcy5jb2xvck1hcCkge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2NvbG9yTWFwJywgdGhpcy5jb2xvck1hcCk7XG4gICAgICAgICAgICBpZiAodGhpcy5saWdodGluZyAmJiB0aGlzLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdub3JtYWxNYXAnLCB0aGlzLm5vcm1hbE1hcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWdlblNoYWRlcigpIHtcbiAgICAgICAgY29uc3QgcHJvZ3JhbUxpYiA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuZ2V0UHJvZ3JhbUxpYnJhcnkoKTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5wcm9ncmFtTGliLnJlZ2lzdGVyKCdwYXJ0aWNsZScsIHBhcnRpY2xlKTtcblxuICAgICAgICBjb25zdCBoYXNOb3JtYWwgPSAodGhpcy5ub3JtYWxNYXAgIT09IG51bGwpO1xuICAgICAgICB0aGlzLm5vcm1hbE9wdGlvbiA9IDA7XG4gICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nKSB7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbE9wdGlvbiA9IGhhc05vcm1hbCA/IDIgOiAxO1xuICAgICAgICB9XG4gICAgICAgIC8vIGdldFNoYWRlclZhcmlhbnQgaXMgYWxzbyBjYWxsZWQgYnkgcGMuU2NlbmUgd2hlbiBhbGwgc2hhZGVycyBuZWVkIHRvIGJlIHVwZGF0ZWRcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5nZXRTaGFkZXJWYXJpYW50ID0gZnVuY3Rpb24gKGRldiwgc2MsIGRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCkge1xuXG4gICAgICAgICAgICAvLyBUaGUgYXBwIHdvcmtzIGxpa2UgdGhpczpcbiAgICAgICAgICAgIC8vIDEuIEVtaXR0ZXIgaW5pdFxuICAgICAgICAgICAgLy8gMi4gVXBkYXRlLiBObyBjYW1lcmEgaXMgYXNzaWduZWQgdG8gZW1pdHRlcnNcbiAgICAgICAgICAgIC8vIDMuIFJlbmRlcjsgYWN0aXZlQ2FtZXJhID0gY2FtZXJhOyBzaGFkZXIgaW5pdFxuICAgICAgICAgICAgLy8gNC4gVXBkYXRlLiBhY3RpdmVDYW1lcmEgaXMgc2V0IHRvIGVtaXR0ZXJzXG4gICAgICAgICAgICAvLyAtLS0tLVxuICAgICAgICAgICAgLy8gVGhlIHByb2JsZW0gd2l0aCAxc3QgZnJhbWUgcmVuZGVyIGlzIHRoYXQgd2UgaW5pdCB0aGUgc2hhZGVyIHdpdGhvdXQgaGF2aW5nIGFueSBjYW1lcmEgc2V0IHRvIGVtaXR0ZXIgLVxuICAgICAgICAgICAgLy8gc28gd3Jvbmcgc2hhZGVyIGlzIGJlaW5nIGNvbXBpbGVkLlxuICAgICAgICAgICAgLy8gVG8gZml4IGl0LCB3ZSBuZWVkIHRvIGNoZWNrIGFjdGl2ZUNhbWVyYSE9ZW1pdHRlci5jYW1lcmEgaW4gc2hhZGVyIGluaXQgdG9vXG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyLnNjZW5lKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlci5jYW1lcmEgIT09IHRoaXMuZW1pdHRlci5zY2VuZS5fYWN0aXZlQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5jYW1lcmEgPSB0aGlzLmVtaXR0ZXIuc2NlbmUuX2FjdGl2ZUNhbWVyYTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm9uQ2hhbmdlQ2FtZXJhKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgYnkgRWRpdG9yIGlmIHJ1bm5pbmcgaW5zaWRlIGVkaXRvclxuICAgICAgICAgICAgY29uc3QgaW5Ub29scyA9IHRoaXMuZW1pdHRlci5pblRvb2xzO1xuXG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSBwcm9ncmFtTGliLmdldFByb2dyYW0oJ3BhcnRpY2xlJywge1xuICAgICAgICAgICAgICAgIHVzZUNwdTogdGhpcy5lbWl0dGVyLnVzZUNwdSxcbiAgICAgICAgICAgICAgICBub3JtYWw6IHRoaXMuZW1pdHRlci5ub3JtYWxPcHRpb24sXG4gICAgICAgICAgICAgICAgaGFsZmxhbWJlcnQ6IHRoaXMuZW1pdHRlci5oYWxmTGFtYmVydCxcbiAgICAgICAgICAgICAgICBzdHJldGNoOiB0aGlzLmVtaXR0ZXIuc3RyZXRjaCxcbiAgICAgICAgICAgICAgICBhbGlnblRvTW90aW9uOiB0aGlzLmVtaXR0ZXIuYWxpZ25Ub01vdGlvbixcbiAgICAgICAgICAgICAgICBzb2Z0OiB0aGlzLmVtaXR0ZXIuZGVwdGhTb2Z0ZW5pbmcsXG4gICAgICAgICAgICAgICAgbWVzaDogdGhpcy5lbWl0dGVyLnVzZU1lc2gsXG4gICAgICAgICAgICAgICAgZ2FtbWE6IHRoaXMuZW1pdHRlci5zY2VuZSA/IHRoaXMuZW1pdHRlci5zY2VuZS5nYW1tYUNvcnJlY3Rpb24gOiAwLFxuICAgICAgICAgICAgICAgIHRvbmVNYXA6IHRoaXMuZW1pdHRlci5zY2VuZSA/IHRoaXMuZW1pdHRlci5zY2VuZS50b25lTWFwcGluZyA6IDAsXG4gICAgICAgICAgICAgICAgZm9nOiAodGhpcy5lbWl0dGVyLnNjZW5lICYmICF0aGlzLmVtaXR0ZXIubm9Gb2cpID8gdGhpcy5lbWl0dGVyLnNjZW5lLmZvZyA6ICdub25lJyxcbiAgICAgICAgICAgICAgICB3cmFwOiB0aGlzLmVtaXR0ZXIud3JhcCAmJiB0aGlzLmVtaXR0ZXIud3JhcEJvdW5kcyxcbiAgICAgICAgICAgICAgICBsb2NhbFNwYWNlOiB0aGlzLmVtaXR0ZXIubG9jYWxTcGFjZSxcblxuICAgICAgICAgICAgICAgIC8vIGluIEVkaXRvciwgc2NyZWVuIHNwYWNlIHBhcnRpY2xlcyAoY2hpbGRyZW4gb2YgMkQgU2NyZWVuKSBhcmUgc3RpbGwgcmVuZGVyZWQgaW4gM2Qgc3BhY2VcbiAgICAgICAgICAgICAgICBzY3JlZW5TcGFjZTogaW5Ub29scyA/IGZhbHNlIDogdGhpcy5lbWl0dGVyLnNjcmVlblNwYWNlLFxuXG4gICAgICAgICAgICAgICAgYmxlbmQ6IHRoaXMuYmxlbmRUeXBlLFxuICAgICAgICAgICAgICAgIGFuaW1UZXg6IHRoaXMuZW1pdHRlci5faXNBbmltYXRlZCgpLFxuICAgICAgICAgICAgICAgIGFuaW1UZXhMb29wOiB0aGlzLmVtaXR0ZXIuYW5pbUxvb3AsXG4gICAgICAgICAgICAgICAgcGFjazg6IHRoaXMuZW1pdHRlci5wYWNrOCxcbiAgICAgICAgICAgICAgICBjdXN0b21GYWNlOiB0aGlzLmVtaXR0ZXIub3JpZW50YXRpb24gIT09IFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zaGFkZXIgPSB0aGlzLm1hdGVyaWFsLmdldFNoYWRlclZhcmlhbnQoKTtcbiAgICB9XG5cbiAgICByZXNldE1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHRoaXMubWF0ZXJpYWw7XG5cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdzdHJldGNoJywgdGhpcy5zdHJldGNoKTtcbiAgICAgICAgaWYgKHRoaXMuX2lzQW5pbWF0ZWQoKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdhbmltVGV4VGlsZXNQYXJhbXMnLCB0aGlzLmFuaW1UaWxlc1BhcmFtcyk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FuaW1UZXhQYXJhbXMnLCB0aGlzLmFuaW1QYXJhbXMpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdhbmltVGV4SW5kZXhQYXJhbXMnLCB0aGlzLmFuaW1JbmRleFBhcmFtcyk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdjb2xvck11bHQnLCB0aGlzLmludGVuc2l0eSk7XG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW50ZXJuYWxUZXgwJywgdGhpcy5pbnRlcm5hbFRleDApO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbnRlcm5hbFRleDEnLCB0aGlzLmludGVybmFsVGV4MSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ludGVybmFsVGV4MicsIHRoaXMuaW50ZXJuYWxUZXgyKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW50ZXJuYWxUZXgzJywgdGhpcy5pbnRlcm5hbFRleDMpO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignY29sb3JQYXJhbScsIHRoaXMuY29sb3JQYXJhbSk7XG5cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdudW1QYXJ0aWNsZXMnLCB0aGlzLm51bVBhcnRpY2xlcyk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbnVtUGFydGljbGVzUG90JywgdGhpcy5udW1QYXJ0aWNsZXNQb3QpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2xpZmV0aW1lJywgdGhpcy5saWZldGltZSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcigncmF0ZScsIHRoaXMucmF0ZSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcigncmF0ZURpdicsIHRoaXMucmF0ZTIgLSB0aGlzLnJhdGUpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NlZWQnLCB0aGlzLnNlZWQpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NjYWxlRGl2TXVsdCcsIHRoaXMuc2NhbGVVTWF4WzBdKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdhbHBoYURpdk11bHQnLCB0aGlzLmFscGhhVU1heFswXSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcigncmFkaWFsU3BlZWREaXZNdWx0JywgdGhpcy5yYWRpYWxTcGVlZFVNYXhbMF0pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2dyYXBoTnVtU2FtcGxlcycsIHRoaXMucHJlY2lzaW9uKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdncmFwaFNhbXBsZVNpemUnLCAxLjAgLyB0aGlzLnByZWNpc2lvbik7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZW1pdHRlclNjYWxlJywgbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pKTtcblxuICAgICAgICBpZiAodGhpcy5wYWNrOCkge1xuICAgICAgICAgICAgdGhpcy5fZ3B1VXBkYXRlci5fc2V0SW5wdXRCb3VuZHMoKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW5Cb3VuZHNTaXplJywgdGhpcy5fZ3B1VXBkYXRlci5pbkJvdW5kc1NpemVVbmlmb3JtKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW5Cb3VuZHNDZW50ZXInLCB0aGlzLl9ncHVVcGRhdGVyLmluQm91bmRzQ2VudGVyVW5pZm9ybSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ21heFZlbCcsIHRoaXMubWF4VmVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLndyYXAgJiYgdGhpcy53cmFwQm91bmRzKSB7XG4gICAgICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtWzBdID0gdGhpcy53cmFwQm91bmRzLng7XG4gICAgICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtWzFdID0gdGhpcy53cmFwQm91bmRzLnk7XG4gICAgICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtWzJdID0gdGhpcy53cmFwQm91bmRzLno7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3dyYXBCb3VuZHMnLCB0aGlzLndyYXBCb3VuZHNVbmlmb3JtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbG9yTWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2NvbG9yTWFwJywgdGhpcy5jb2xvck1hcCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgaWYgKHRoaXMubm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdub3JtYWxNYXAnLCB0aGlzLm5vcm1hbE1hcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZGVwdGhTb2Z0ZW5pbmcgPiAwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NvZnRlbmluZycsIDEuMCAvICh0aGlzLmRlcHRoU29mdGVuaW5nICogdGhpcy5kZXB0aFNvZnRlbmluZyAqIDEwMCkpOyAvLyByZW1hcCB0byBtb3JlIHBlcmNlcHR1YWxseSBsaW5lYXJcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdHJldGNoID4gMC4wKSBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcblxuICAgICAgICB0aGlzLl9jb21wUGFydGljbGVGYWNlUGFyYW1zKCk7XG4gICAgfVxuXG4gICAgX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMoKSB7XG4gICAgICAgIGxldCB0YW5nZW50LCBiaW5vcm1hbDtcbiAgICAgICAgaWYgKHRoaXMub3JpZW50YXRpb24gPT09IFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOKSB7XG4gICAgICAgICAgICB0YW5nZW50ID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMCwgMF0pO1xuICAgICAgICAgICAgYmlub3JtYWwgPSBuZXcgRmxvYXQzMkFycmF5KFswLCAwLCAxXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgbjtcbiAgICAgICAgICAgIGlmICh0aGlzLm9yaWVudGF0aW9uID09PSBQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxEKSB7XG4gICAgICAgICAgICAgICAgbiA9IHRoaXMucGFydGljbGVOb3JtYWwubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVtaXR0ZXJNYXQgPSB0aGlzLm5vZGUgPT09IG51bGwgP1xuICAgICAgICAgICAgICAgICAgICBNYXQ0LklERU5USVRZIDogdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgbiA9IGVtaXR0ZXJNYXQudHJhbnNmb3JtVmVjdG9yKHRoaXMucGFydGljbGVOb3JtYWwpLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdCA9IG5ldyBWZWMzKDEsIDAsIDApO1xuICAgICAgICAgICAgaWYgKE1hdGguYWJzKHQuZG90KG4pKSA9PT0gMSlcbiAgICAgICAgICAgICAgICB0LnNldCgwLCAwLCAxKTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBuZXcgVmVjMygpLmNyb3NzKG4sIHQpLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdC5jcm9zcyhiLCBuKS5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHRhbmdlbnQgPSBuZXcgRmxvYXQzMkFycmF5KFt0LngsIHQueSwgdC56XSk7XG4gICAgICAgICAgICBiaW5vcm1hbCA9IG5ldyBGbG9hdDMyQXJyYXkoW2IueCwgYi55LCBiLnpdKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZmFjZVRhbmdlbnQnLCB0YW5nZW50KTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ZhY2VCaW5vcm0nLCBiaW5vcm1hbCk7XG4gICAgfVxuXG4gICAgLy8gRGVjbGFyZXMgdmVydGV4IGZvcm1hdCwgY3JlYXRlcyBWQiBhbmQgSUJcbiAgICBfYWxsb2NhdGUobnVtUGFydGljbGVzKSB7XG4gICAgICAgIGNvbnN0IHBzeXNWZXJ0Q291bnQgPSBudW1QYXJ0aWNsZXMgKiB0aGlzLm51bVBhcnRpY2xlVmVydHM7XG4gICAgICAgIGNvbnN0IHBzeXNJbmRleENvdW50ID0gbnVtUGFydGljbGVzICogdGhpcy5udW1QYXJ0aWNsZUluZGljZXM7XG5cbiAgICAgICAgaWYgKCh0aGlzLnZlcnRleEJ1ZmZlciA9PT0gdW5kZWZpbmVkKSB8fCAodGhpcy52ZXJ0ZXhCdWZmZXIuZ2V0TnVtVmVydGljZXMoKSAhPT0gcHN5c1ZlcnRDb3VudCkpIHtcbiAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgcGFydGljbGUgdmVydGV4IGZvcm1hdFxuICAgICAgICAgICAgaWYgKCF0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgICAgIC8vIEdQVTogWFlaID0gcXVhZCB2ZXJ0ZXggcG9zaXRpb247IFcgPSBJTlQ6IHBhcnRpY2xlIElELCBGUkFDOiByYW5kb20gZmFjdG9yXG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBbe1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjAsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH1dO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjEsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0aWNsZUZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcy5ncmFwaGljc0RldmljZSwgZWxlbWVudHMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIHBhcnRpY2xlRm9ybWF0LCBwc3lzVmVydENvdW50LCBCVUZGRVJfRFlOQU1JQyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLmdyYXBoaWNzRGV2aWNlLCBJTkRFWEZPUk1BVF9VSU5UMTYsIHBzeXNJbmRleENvdW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSBbe1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjAsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIxLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiA0LFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMixcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogNCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjMsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDEsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFI0LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiB0aGlzLnVzZU1lc2ggPyA0IDogMixcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfV07XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydGljbGVGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIGVsZW1lbnRzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gbmV3IFZlcnRleEJ1ZmZlcih0aGlzLmdyYXBoaWNzRGV2aWNlLCBwYXJ0aWNsZUZvcm1hdCwgcHN5c1ZlcnRDb3VudCwgQlVGRkVSX0RZTkFNSUMpO1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIodGhpcy5ncmFwaGljc0RldmljZSwgSU5ERVhGT1JNQVRfVUlOVDE2LCBwc3lzSW5kZXhDb3VudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbGwgdGhlIHZlcnRleCBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMudmVydGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICBsZXQgbWVzaERhdGEsIHN0cmlkZSwgdGV4Q29vcmRPZmZzZXQ7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgbWVzaERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIubG9jaygpKTtcbiAgICAgICAgICAgICAgICBzdHJpZGUgPSBtZXNoRGF0YS5sZW5ndGggLyB0aGlzLm1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGVsZW0gPSAwOyBlbGVtIDwgdGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyBlbGVtKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2VsZW1dLm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4Q29vcmRPZmZzZXQgPSB0aGlzLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tlbGVtXS5vZmZzZXQgLyA0O1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHN5c1ZlcnRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSBNYXRoLmZsb29yKGkgLyB0aGlzLm51bVBhcnRpY2xlVmVydHMpO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRJRCA9IGkgJSA0O1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0XSA9IHBhcnRpY2xlVmVydHNbdmVydElEXVswXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNCArIDFdID0gcGFydGljbGVWZXJ0c1t2ZXJ0SURdWzFdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0ICsgMl0gPSAwO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0ICsgM10gPSBpZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ID0gaSAlIHRoaXMubnVtUGFydGljbGVWZXJ0cztcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNl0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDFdID0gbWVzaERhdGFbdmVydCAqIHN0cmlkZSArIDFdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgMl0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgMl07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyAzXSA9IGlkO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgNF0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgdGV4Q29vcmRPZmZzZXQgKyAwXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDVdID0gMS4wIC0gbWVzaERhdGFbdmVydCAqIHN0cmlkZSArIHRleENvb3JkT2Zmc2V0ICsgMV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZiQ1BVID0gbmV3IEZsb2F0MzJBcnJheShkYXRhKTtcbiAgICAgICAgICAgICAgICB0aGlzLnZiT2xkID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLnZiQ1BVLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2gudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaWxsIHRoZSBpbmRleCBidWZmZXJcbiAgICAgICAgICAgIGxldCBkc3QgPSAwO1xuICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheSh0aGlzLmluZGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VNZXNoKSBtZXNoRGF0YSA9IG5ldyBVaW50MTZBcnJheSh0aGlzLm1lc2guaW5kZXhCdWZmZXJbMF0ubG9jaygpKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtUGFydGljbGVzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlSW5kZXggPSBpICogNDtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4ICsgMTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXggKyAyO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXggKyAyO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleCArIDM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLm51bVBhcnRpY2xlSW5kaWNlczsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2kgKiB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyArIGpdID0gbWVzaERhdGFbal0gKyBpICogdGhpcy5udW1QYXJ0aWNsZVZlcnRzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHRoaXMubWVzaC5pbmRleEJ1ZmZlclswXS51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2V0KCkge1xuICAgICAgICB0aGlzLmJlZW5SZXNldCA9IHRydWU7XG4gICAgICAgIHRoaXMuc2VlZCA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdzZWVkJywgdGhpcy5zZWVkKTtcbiAgICAgICAgaWYgKHRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFydGljbGVUZXhTdGFydC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhbaV0gPSB0aGlzLnBhcnRpY2xlVGV4U3RhcnRbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplVGV4dHVyZXMoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlc2V0V29ybGRCb3VuZHMoKTtcbiAgICAgICAgdGhpcy5yZXNldFRpbWUoKTtcbiAgICAgICAgY29uc3Qgb3JpZ0xvb3AgPSB0aGlzLmxvb3A7XG4gICAgICAgIHRoaXMubG9vcCA9IHRydWU7XG4gICAgICAgIHRoaXMuYWRkVGltZSgwLCBmYWxzZSk7XG4gICAgICAgIHRoaXMubG9vcCA9IG9yaWdMb29wO1xuICAgICAgICBpZiAodGhpcy5wcmVXYXJtKSB7XG4gICAgICAgICAgICB0aGlzLnByZXdhcm0odGhpcy5saWZldGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcmV3YXJtKHRpbWUpIHtcbiAgICAgICAgY29uc3QgbGlmZXRpbWVGcmFjdGlvbiA9IHRpbWUgLyB0aGlzLmxpZmV0aW1lO1xuICAgICAgICBjb25zdCBpdGVyYXRpb25zID0gTWF0aC5taW4oTWF0aC5mbG9vcihsaWZldGltZUZyYWN0aW9uICogdGhpcy5wcmVjaXNpb24pLCB0aGlzLnByZWNpc2lvbik7XG4gICAgICAgIGNvbnN0IHN0ZXBEZWx0YSA9IHRpbWUgLyBpdGVyYXRpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZXJhdGlvbnM7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5hZGRUaW1lKHN0ZXBEZWx0YSwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzZXRUaW1lKCkge1xuICAgICAgICB0aGlzLmVuZFRpbWUgPSBjYWxjRW5kVGltZSh0aGlzKTtcbiAgICB9XG5cbiAgICBmaW5pc2hGcmFtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMudXNlQ3B1KSB0aGlzLnZlcnRleEJ1ZmZlci51bmxvY2soKTtcbiAgICB9XG5cbiAgICBhZGRUaW1lKGRlbHRhLCBpc09uU3RvcCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuc2ltVGltZVRvdGFsICs9IGRlbHRhO1xuXG4gICAgICAgIHRoaXMuY2FsY3VsYXRlV29ybGRCb3VuZHMoKTtcblxuICAgICAgICBpZiAodGhpcy5faXNBbmltYXRlZCgpKSB7XG4gICAgICAgICAgICBjb25zdCB0aWxlc1BhcmFtcyA9IHRoaXMuYW5pbVRpbGVzUGFyYW1zO1xuICAgICAgICAgICAgdGlsZXNQYXJhbXNbMF0gPSAxLjAgLyB0aGlzLmFuaW1UaWxlc1g7IC8vIGFuaW1UZXhUaWxlc1BhcmFtcy54XG4gICAgICAgICAgICB0aWxlc1BhcmFtc1sxXSA9IDEuMCAvIHRoaXMuYW5pbVRpbGVzWTsgLy8gYW5pbVRleFRpbGVzUGFyYW1zLnlcblxuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gdGhpcy5hbmltUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gdGhpcy5hbmltU3RhcnRGcmFtZTsgLy8gYW5pbVRleFBhcmFtcy54XG4gICAgICAgICAgICBwYXJhbXNbMV0gPSB0aGlzLmFuaW1OdW1GcmFtZXMgKiB0aGlzLmFuaW1TcGVlZDsgLy8gYW5pbVRleFBhcmFtcy55XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSB0aGlzLmFuaW1OdW1GcmFtZXMgLSAxOyAvLyBhbmltVGV4UGFyYW1zLnpcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IHRoaXMuYW5pbU51bUFuaW1hdGlvbnMgLSAxOyAvLyBhbmltVGV4UGFyYW1zLndcblxuICAgICAgICAgICAgY29uc3QgYW5pbUluZGV4UGFyYW1zID0gdGhpcy5hbmltSW5kZXhQYXJhbXM7XG4gICAgICAgICAgICBhbmltSW5kZXhQYXJhbXNbMF0gPSB0aGlzLmFuaW1JbmRleDsgLy8gYW5pbVRleEluZGV4UGFyYW1zLnhcbiAgICAgICAgICAgIGFuaW1JbmRleFBhcmFtc1sxXSA9IHRoaXMucmFuZG9taXplQW5pbUluZGV4OyAvLyBhbmltVGV4SW5kZXhQYXJhbXMueVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc2NlbmUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNhbWVyYSAhPT0gdGhpcy5zY2VuZS5fYWN0aXZlQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYW1lcmEgPSB0aGlzLnNjZW5lLl9hY3RpdmVDYW1lcmE7XG4gICAgICAgICAgICAgICAgdGhpcy5vbkNoYW5nZUNhbWVyYSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlclNoYXBlID09PSBFTUlUVEVSU0hBUEVfQk9YKSB7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMF0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnggIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueCAvIHRoaXMuZW1pdHRlckV4dGVudHMueCA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMV0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueSAvIHRoaXMuZW1pdHRlckV4dGVudHMueSA6IDA7XG4gICAgICAgICAgICBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm1bMl0gPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnogIT09IDAgPyB0aGlzLmVtaXR0ZXJFeHRlbnRzSW5uZXIueiAvIHRoaXMuZW1pdHRlckV4dGVudHMueiA6IDA7XG4gICAgICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2Uubm9kZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHNwYXduTWF0cml4LnNldFRSUyhWZWMzLlpFUk8sIFF1YXQuSURFTlRJVFksIHRoaXMuZW1pdHRlckV4dGVudHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzcGF3bk1hdHJpeC5zZXRUUlMoVmVjMy5aRVJPLCB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmdldFJvdGF0aW9uKCksIHRtcFZlYzMuY29weSh0aGlzLmVtaXR0ZXJFeHRlbnRzKS5tdWwodGhpcy5tZXNoSW5zdGFuY2Uubm9kZS5sb2NhbFNjYWxlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZW1pdHRlclBvcztcbiAgICAgICAgY29uc3QgZW1pdHRlclNjYWxlID0gdGhpcy5tZXNoSW5zdGFuY2Uubm9kZSA9PT0gbnVsbCA/IFZlYzMuT05FIDogdGhpcy5tZXNoSW5zdGFuY2Uubm9kZS5sb2NhbFNjYWxlO1xuICAgICAgICB0aGlzLmVtaXR0ZXJTY2FsZVVuaWZvcm1bMF0gPSBlbWl0dGVyU2NhbGUueDtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtWzFdID0gZW1pdHRlclNjYWxlLnk7XG4gICAgICAgIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybVsyXSA9IGVtaXR0ZXJTY2FsZS56O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZW1pdHRlclNjYWxlJywgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtKTtcbiAgICAgICAgaWYgKHRoaXMubG9jYWxTcGFjZSAmJiB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlKSB7XG4gICAgICAgICAgICBlbWl0dGVyUG9zID0gdGhpcy5tZXNoSW5zdGFuY2Uubm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyUG9zVW5pZm9ybVswXSA9IGVtaXR0ZXJQb3MueDtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm1bMV0gPSBlbWl0dGVyUG9zLnk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtWzJdID0gZW1pdHRlclBvcy56O1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2VtaXR0ZXJQb3MnLCB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMoKTtcblxuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICB0aGlzLl9ncHVVcGRhdGVyLnVwZGF0ZShkZXZpY2UsIHNwYXduTWF0cml4LCBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0sIGRlbHRhLCBpc09uU3RvcCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLnZlcnRleEJ1ZmZlci5sb2NrKCkpO1xuICAgICAgICAgICAgdGhpcy5fY3B1VXBkYXRlci51cGRhdGUoZGF0YSwgdGhpcy52YlRvU29ydCwgdGhpcy5wYXJ0aWNsZVRleCwgc3Bhd25NYXRyaXgsIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSwgZW1pdHRlclBvcywgZGVsdGEsIGlzT25TdG9wKTtcbiAgICAgICAgICAgIC8vIHRoaXMudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmxvb3ApIHtcbiAgICAgICAgICAgIGlmIChEYXRlLm5vdygpID4gdGhpcy5lbmRUaW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub25GaW5pc2hlZCkgdGhpcy5vbkZpbmlzaGVkKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSB0aGlzLmRyYXdPcmRlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fYWRkVGltZVRpbWUgKz0gbm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIF9kZXN0cm95UmVzb3VyY2VzKCkge1xuICAgICAgICBpZiAodGhpcy5wYXJ0aWNsZVRleElOKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4SU4uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleElOID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnBhcnRpY2xlVGV4T1VUKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VULmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhPVVQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGFydGljbGVUZXhTdGFydCAmJiB0aGlzLnBhcnRpY2xlVGV4U3RhcnQuZGVzdHJveSkge1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5ydFBhcnRpY2xlVGV4SU4pIHtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleElOLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleElOID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJ0UGFydGljbGVUZXhPVVQpIHtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleE9VVC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhPVVQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJuYWxUZXgwKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbnRlcm5hbFRleDEpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmludGVybmFsVGV4Mikge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJuYWxUZXgzKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4My5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb2xvclBhcmFtKSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yUGFyYW0uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5jb2xvclBhcmFtID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSB1bmRlZmluZWQ7IC8vIHdlIGFyZSB0ZXN0aW5nIGlmIHZiIGlzIHVuZGVmaW5lZCBpbiBzb21lIGNvZGUsIG5vIGlkZWEgd2h5XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbmRleEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBub3RlOiBzaGFkZXJzIHNob3VsZCBub3QgYmUgZGVzdHJveWVkIGFzIHRoZXkgY291bGQgYmUgc2hhcmVkIGJldHdlZW4gZW1pdHRlcnNcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmNhbWVyYSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlc291cmNlcygpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUGFydGljbGVFbWl0dGVyIH07XG4iXSwibmFtZXMiOlsicGFydGljbGVWZXJ0cyIsIl9jcmVhdGVUZXh0dXJlIiwiZGV2aWNlIiwid2lkdGgiLCJoZWlnaHQiLCJwaXhlbERhdGEiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwibXVsdDhCaXQiLCJmaWx0ZXIiLCJtaXBGaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwiRklMVEVSX0xJTkVBUiIsInRleHR1cmUiLCJUZXh0dXJlIiwiY3ViZW1hcCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwibmFtZSIsInBpeGVscyIsImxvY2siLCJ0ZW1wIiwiVWludDhBcnJheSIsImxlbmd0aCIsImkiLCJzZXQiLCJ1bmxvY2siLCJzYXR1cmF0ZSIsIngiLCJNYXRoIiwibWF4IiwibWluIiwiZGVmYXVsdDBDdXJ2ZSIsIkN1cnZlIiwiZGVmYXVsdDFDdXJ2ZSIsImRlZmF1bHQwQ3VydmUzIiwiQ3VydmVTZXQiLCJkZWZhdWx0MUN1cnZlMyIsInBhcnRpY2xlVGV4SGVpZ2h0IiwicGFydGljbGVUZXhDaGFubmVscyIsImV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsInNwYXduTWF0cml4IiwiTWF0NCIsInRtcFZlYzMiLCJWZWMzIiwiYk1pbiIsImJNYXgiLCJzZXRQcm9wZXJ0eVRhcmdldCIsInNldFByb3BlcnR5T3B0aW9ucyIsInNldFByb3BlcnR5IiwicE5hbWUiLCJkZWZhdWx0VmFsIiwidW5kZWZpbmVkIiwicGFjazNORmxvYXRzIiwiYSIsImIiLCJjIiwicGFja2VkIiwicGFja1RleHR1cmVYWVpfTlhZWiIsInFYWVoiLCJxWFlaMiIsIm51bSIsImNvbG9ycyIsIkFycmF5IiwicGFja1RleHR1cmVSR0JBIiwicVJHQiIsInFBIiwicGFja1RleHR1cmU1RmxvYXRzIiwicUIiLCJxQyIsInFEIiwicUUiLCJwYWNrVGV4dHVyZTJGbG9hdHMiLCJjYWxjRW5kVGltZSIsImVtaXR0ZXIiLCJpbnRlcnZhbCIsInJhdGUiLCJyYXRlMiIsIm51bVBhcnRpY2xlcyIsImxpZmV0aW1lIiwiRGF0ZSIsIm5vdyIsInN1YkdyYXBoIiwiQSIsIkIiLCJyIiwibWF4VW5zaWduZWRHcmFwaFZhbHVlIiwib3V0VU1heCIsImNoYW5zIiwidmFsdWVzIiwiaiIsImFicyIsIm5vcm1hbGl6ZUdyYXBoIiwidU1heCIsImRpdkdyYXBoRnJvbTJDdXJ2ZXMiLCJjdXJ2ZTEiLCJjdXJ2ZTIiLCJzdWIiLCJwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZSIsIkRldmljZUNhY2hlIiwiUGFydGljbGVFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsIm9wdGlvbnMiLCJnZCIsInByZWNpc2lvbiIsIl9hZGRUaW1lVGltZSIsIm1heFRleHR1cmVTaXplIiwiRGVidWciLCJ3YXJuIiwiRU1JVFRFUlNIQVBFX0JPWCIsImRlZmF1bHRQYXJhbVRleHR1cmUiLCJQQVJUSUNMRVNPUlRfTk9ORSIsIlBBUlRJQ0xFTU9ERV9HUFUiLCJQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTiIsIkJMRU5EX05PUk1BTCIsInN0YXJ0QW5nbGUiLCJfZ3B1VXBkYXRlciIsIlBhcnRpY2xlR1BVVXBkYXRlciIsIl9jcHVVcGRhdGVyIiwiUGFydGljbGVDUFVVcGRhdGVyIiwiY29uc3RhbnRMaWdodEN1YmUiLCJzY29wZSIsInJlc29sdmUiLCJlbWl0dGVyUG9zVW5pZm9ybSIsIndyYXBCb3VuZHNVbmlmb3JtIiwiZW1pdHRlclNjYWxlVW5pZm9ybSIsImNvbG9yR3JhcGgiLCJzY2FsZUdyYXBoIiwiYWxwaGFHcmFwaCIsImxvY2FsVmVsb2NpdHlHcmFwaCIsInZlbG9jaXR5R3JhcGgiLCJyb3RhdGlvblNwZWVkR3JhcGgiLCJyYWRpYWxTcGVlZEdyYXBoIiwibGlnaHRDdWJlIiwibGlnaHRDdWJlRGlyIiwiYW5pbVRpbGVzUGFyYW1zIiwiYW5pbVBhcmFtcyIsImFuaW1JbmRleFBhcmFtcyIsImludGVybmFsVGV4MCIsImludGVybmFsVGV4MSIsImludGVybmFsVGV4MiIsImNvbG9yUGFyYW0iLCJ2YlRvU29ydCIsInZiT2xkIiwicGFydGljbGVEaXN0YW5jZSIsImNhbWVyYSIsInN3YXBUZXgiLCJ1c2VNZXNoIiwidXNlQ3B1Iiwic3VwcG9ydHNHcHVQYXJ0aWNsZXMiLCJwYWNrOCIsImxvY2FsQm91bmRzIiwiQm91bmRpbmdCb3giLCJ3b3JsZEJvdW5kc05vVHJhaWwiLCJ3b3JsZEJvdW5kc1RyYWlsIiwid29ybGRCb3VuZHMiLCJ3b3JsZEJvdW5kc1NpemUiLCJwcmV2V29ybGRCb3VuZHNTaXplIiwicHJldldvcmxkQm91bmRzQ2VudGVyIiwicHJldkVtaXR0ZXJFeHRlbnRzIiwiZW1pdHRlckV4dGVudHMiLCJwcmV2RW1pdHRlclJhZGl1cyIsImVtaXR0ZXJSYWRpdXMiLCJ3b3JsZEJvdW5kc011bCIsIndvcmxkQm91bmRzQWRkIiwidGltZVRvU3dpdGNoQm91bmRzIiwic2hhZGVyUGFydGljbGVVcGRhdGVSZXNwYXduIiwic2hhZGVyUGFydGljbGVVcGRhdGVOb1Jlc3Bhd24iLCJzaGFkZXJQYXJ0aWNsZVVwZGF0ZU9uU3RvcCIsIm51bVBhcnRpY2xlVmVydHMiLCJudW1QYXJ0aWNsZUluZGljZXMiLCJtYXRlcmlhbCIsIm1lc2hJbnN0YW5jZSIsImRyYXdPcmRlciIsInNlZWQiLCJyYW5kb20iLCJmaXhlZFRpbWVTdGVwIiwibWF4U3ViU3RlcHMiLCJzaW1UaW1lIiwic2ltVGltZVRvdGFsIiwiYmVlblJlc2V0IiwiX2xheWVyIiwicmVidWlsZCIsImFzc2VydCIsImdldCIsInJlc29sdXRpb24iLCJjZW50ZXJQb2ludCIsImR0ZXgiLCJ5IiwieGdyYWQiLCJ5Z3JhZCIsInNxcnQiLCJwIiwib25DaGFuZ2VDYW1lcmEiLCJyZWdlblNoYWRlciIsInJlc2V0TWF0ZXJpYWwiLCJjYWxjdWxhdGVCb3VuZHNNYWQiLCJ6IiwiY29weSIsImNlbnRlciIsIm11bCIsIm11bFNjYWxhciIsImNhbGN1bGF0ZVdvcmxkQm91bmRzIiwibm9kZSIsInJlY2FsY3VsYXRlTG9jYWxCb3VuZHMiLCJlbWl0dGVyU2hhcGUiLCJlcXVhbHMiLCJjYWxjdWxhdGVMb2NhbEJvdW5kcyIsIm5vZGVXVCIsImdldFdvcmxkVHJhbnNmb3JtIiwibG9jYWxTcGFjZSIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJhZGQiLCJoYWxmRXh0ZW50cyIsImFhYmIiLCJtZXNoIiwiX2FhYmJWZXIiLCJyZXNldFdvcmxkQm91bmRzIiwiSURFTlRJVFkiLCJtaW54IiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwibWlueSIsIm1pbnoiLCJtYXh4IiwibWF4eSIsIm1heHoiLCJtYXhSIiwibWF4U2NhbGUiLCJzdGVwV2VpZ2h0Iiwid1ZlbHMiLCJxVmVsb2NpdHkiLCJxVmVsb2NpdHkyIiwibFZlbHMiLCJxTG9jYWxWZWxvY2l0eSIsInFMb2NhbFZlbG9jaXR5MiIsImFjY3VtWCIsImFjY3VtWSIsImFjY3VtWiIsImFjY3VtUiIsImFjY3VtVyIsImluZGV4IiwicVJhZGlhbFNwZWVkIiwicVJhZGlhbFNwZWVkMiIsInFTY2FsZSIsInciLCJzZXRNaW5NYXgiLCJjb2xvck1hcCIsInNwYXduQm91bmRzIiwic29ydCIsIm1heFZlcnRleFRleHR1cmVzIiwiZnJhZ21lbnRVbmlmb3Jtc0NvdW50IiwiZm9yY2VDcHVQYXJ0aWNsZXMiLCJleHRUZXh0dXJlRmxvYXQiLCJfZGVzdHJveVJlc291cmNlcyIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJ0b3RhbFZlcnRDb3VudCIsInZlcnRleEJ1ZmZlciIsIm51bVZlcnRpY2VzIiwibnVtUGFydGljbGVzUG90IiwibWF0aCIsIm5leHRQb3dlck9mVHdvIiwicmVidWlsZEdyYXBocyIsImlTb3J0IiwicmFuZG9taXplIiwicGFydGljbGVUZXgiLCJlbWl0dGVyUG9zIiwiWkVSTyIsImdldFBvc2l0aW9uIiwic2V0VFJTIiwiUXVhdCIsImdldFJvdGF0aW9uIiwibG9jYWxTY2FsZSIsImVtaXR0ZXJFeHRlbnRzSW5uZXIiLCJjYWxjU3Bhd25Qb3NpdGlvbiIsInBhcnRpY2xlVGV4U3RhcnQiLCJwYXJ0aWNsZVRleElOIiwicGFydGljbGVUZXhPVVQiLCJydFBhcnRpY2xlVGV4SU4iLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwicnRQYXJ0aWNsZVRleE9VVCIsInNoYWRlckNvZGVTdGFydCIsInNoYWRlckNodW5rcyIsInBhcnRpY2xlVXBkYXRlckluaXRQUyIsInBhcnRpY2xlSW5wdXRSZ2JhOFBTIiwicGFydGljbGVPdXRwdXRSZ2JhOFBTIiwicGFydGljbGVJbnB1dEZsb2F0UFMiLCJwYXJ0aWNsZU91dHB1dEZsb2F0UFMiLCJwYXJ0aWNsZVVwZGF0ZXJBQUJCUFMiLCJwYXJ0aWNsZVVwZGF0ZXJTcGhlcmVQUyIsInBhcnRpY2xlVXBkYXRlclN0YXJ0UFMiLCJzaGFkZXJDb2RlUmVzcGF3biIsInBhcnRpY2xlVXBkYXRlclJlc3Bhd25QUyIsInBhcnRpY2xlVXBkYXRlckVuZFBTIiwic2hhZGVyQ29kZU5vUmVzcGF3biIsInBhcnRpY2xlVXBkYXRlck5vUmVzcGF3blBTIiwic2hhZGVyQ29kZU9uU3RvcCIsInBhcnRpY2xlVXBkYXRlck9uU3RvcFBTIiwicGFyYW1zIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJmdWxsc2NyZWVuUXVhZFZTIiwiaW5kZXhCdWZmZXIiLCJudW1JbmRpY2VzIiwiX2FsbG9jYXRlIiwiTWVzaCIsInByaW1pdGl2ZSIsInR5cGUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsIk1hdGVyaWFsIiwiY3VsbCIsIkNVTExGQUNFX05PTkUiLCJhbHBoYVdyaXRlIiwiYmxlbmQiLCJibGVuZFR5cGUiLCJkZXB0aFdyaXRlIiwid2FzVmlzaWJsZSIsInZpc2libGUiLCJNZXNoSW5zdGFuY2UiLCJwaWNrIiwidXBkYXRlS2V5IiwiX25vRGVwdGhEcmF3R2wxIiwiX3VwZGF0ZUFhYmIiLCJfaW5pdGlhbGl6ZVRleHR1cmVzIiwicmVzZXRUaW1lIiwiYWRkVGltZSIsInByZVdhcm0iLCJwcmV3YXJtIiwiX2lzQW5pbWF0ZWQiLCJhbmltTnVtRnJhbWVzIiwiYW5pbVRpbGVzWCIsImFuaW1UaWxlc1kiLCJub3JtYWxNYXAiLCJxdWFudGl6ZSIsInFDb2xvciIsInF1YW50aXplQ2xhbXBlZCIsInFSb3RTcGVlZCIsInFBbHBoYSIsImxvY2FsVmVsb2NpdHlHcmFwaDIiLCJ2ZWxvY2l0eUdyYXBoMiIsInFDb2xvcjIiLCJjb2xvckdyYXBoMiIsInFSb3RTcGVlZDIiLCJyb3RhdGlvblNwZWVkR3JhcGgyIiwicVNjYWxlMiIsInNjYWxlR3JhcGgyIiwicUFscGhhMiIsImFscGhhR3JhcGgyIiwicmFkaWFsU3BlZWRHcmFwaDIiLCJERUdfVE9fUkFEIiwibG9jYWxWZWxvY2l0eVVNYXgiLCJ2ZWxvY2l0eVVNYXgiLCJjb2xvclVNYXgiLCJyb3RTcGVlZFVNYXgiLCJzY2FsZVVNYXgiLCJhbHBoYVVNYXgiLCJyYWRpYWxTcGVlZFVNYXgiLCJxTG9jYWxWZWxvY2l0eURpdiIsInFWZWxvY2l0eURpdiIsInFDb2xvckRpdiIsInFSb3RTcGVlZERpdiIsInFTY2FsZURpdiIsInFBbHBoYURpdiIsInFSYWRpYWxTcGVlZERpdiIsInVtYXgiLCJ1bWF4MiIsImx1bWF4IiwibHVtYXgyIiwicnVtYXgiLCJydW1heDIiLCJtYXhWZWwiLCJsbWF4VmVsIiwibWF4UmFkIiwiaW50ZXJuYWxUZXgzIiwic2V0UGFyYW1ldGVyIiwibGlnaHRpbmciLCJwcm9ncmFtTGliIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJyZWdpc3RlciIsInBhcnRpY2xlIiwiaGFzTm9ybWFsIiwibm9ybWFsT3B0aW9uIiwiZ2V0U2hhZGVyVmFyaWFudCIsImRldiIsInNjIiwiZGVmcyIsInN0YXRpY0xpZ2h0TGlzdCIsInBhc3MiLCJzb3J0ZWRMaWdodHMiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJzY2VuZSIsIl9hY3RpdmVDYW1lcmEiLCJpblRvb2xzIiwic2hhZGVyIiwiZ2V0UHJvZ3JhbSIsIm5vcm1hbCIsImhhbGZsYW1iZXJ0IiwiaGFsZkxhbWJlcnQiLCJzdHJldGNoIiwiYWxpZ25Ub01vdGlvbiIsInNvZnQiLCJkZXB0aFNvZnRlbmluZyIsImdhbW1hIiwiZ2FtbWFDb3JyZWN0aW9uIiwidG9uZU1hcCIsInRvbmVNYXBwaW5nIiwiZm9nIiwibm9Gb2ciLCJ3cmFwIiwid3JhcEJvdW5kcyIsInNjcmVlblNwYWNlIiwiYW5pbVRleCIsImFuaW1UZXhMb29wIiwiYW5pbUxvb3AiLCJjdXN0b21GYWNlIiwib3JpZW50YXRpb24iLCJpbnRlbnNpdHkiLCJfc2V0SW5wdXRCb3VuZHMiLCJpbkJvdW5kc1NpemVVbmlmb3JtIiwiaW5Cb3VuZHNDZW50ZXJVbmlmb3JtIiwiX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMiLCJ0YW5nZW50IiwiYmlub3JtYWwiLCJuIiwiUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRCIsInBhcnRpY2xlTm9ybWFsIiwibm9ybWFsaXplIiwiZW1pdHRlck1hdCIsInRyYW5zZm9ybVZlY3RvciIsInQiLCJkb3QiLCJjcm9zcyIsInBzeXNWZXJ0Q291bnQiLCJwc3lzSW5kZXhDb3VudCIsImdldE51bVZlcnRpY2VzIiwiZWxlbWVudHMiLCJzZW1hbnRpYyIsIlNFTUFOVElDX0FUVFIwIiwiY29tcG9uZW50cyIsIlRZUEVfRkxPQVQzMiIsInB1c2giLCJTRU1BTlRJQ19BVFRSMSIsInBhcnRpY2xlRm9ybWF0IiwiVmVydGV4Rm9ybWF0IiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX0RZTkFNSUMiLCJJbmRleEJ1ZmZlciIsIklOREVYRk9STUFUX1VJTlQxNiIsIlNFTUFOVElDX0FUVFIyIiwiU0VNQU5USUNfQVRUUjMiLCJTRU1BTlRJQ19BVFRSNCIsImRhdGEiLCJtZXNoRGF0YSIsInN0cmlkZSIsInRleENvb3JkT2Zmc2V0IiwiZWxlbSIsIlNFTUFOVElDX1RFWENPT1JEMCIsIm9mZnNldCIsImlkIiwiZmxvb3IiLCJ2ZXJ0SUQiLCJ2ZXJ0IiwidmJDUFUiLCJkc3QiLCJpbmRpY2VzIiwiVWludDE2QXJyYXkiLCJiYXNlSW5kZXgiLCJyZXNldCIsIm9yaWdMb29wIiwibG9vcCIsInRpbWUiLCJsaWZldGltZUZyYWN0aW9uIiwiaXRlcmF0aW9ucyIsInN0ZXBEZWx0YSIsImVuZFRpbWUiLCJmaW5pc2hGcmFtZSIsImRlbHRhIiwiaXNPblN0b3AiLCJzdGFydFRpbWUiLCJ0aWxlc1BhcmFtcyIsImFuaW1TdGFydEZyYW1lIiwiYW5pbVNwZWVkIiwiYW5pbU51bUFuaW1hdGlvbnMiLCJhbmltSW5kZXgiLCJyYW5kb21pemVBbmltSW5kZXgiLCJlbWl0dGVyU2NhbGUiLCJPTkUiLCJ1cGRhdGUiLCJvbkZpbmlzaGVkIiwiZGVzdHJveSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWdEQSxNQUFNQSxhQUFhLEdBQUcsQ0FDbEIsQ0FBQyxDQUFDLENBQUYsRUFBSyxDQUFDLENBQU4sQ0FEa0IsRUFFbEIsQ0FBQyxDQUFELEVBQUksQ0FBQyxDQUFMLENBRmtCLEVBR2xCLENBQUMsQ0FBRCxFQUFJLENBQUosQ0FIa0IsRUFJbEIsQ0FBQyxDQUFDLENBQUYsRUFBSyxDQUFMLENBSmtCLENBQXRCLENBQUE7O0FBT0EsU0FBU0MsY0FBVCxDQUF3QkMsTUFBeEIsRUFBZ0NDLEtBQWhDLEVBQXVDQyxNQUF2QyxFQUErQ0MsU0FBL0MsRUFBMERDLE1BQU0sR0FBR0MsbUJBQW5FLEVBQXdGQyxRQUF4RixFQUFrR0MsTUFBbEcsRUFBMEc7RUFFdEcsSUFBSUMsU0FBUyxHQUFHQyxjQUFoQixDQUFBO0VBQ0EsSUFBSUYsTUFBTSxJQUFJSCxNQUFNLEtBQUtNLHVCQUF6QixFQUNJRixTQUFTLEdBQUdHLGFBQVosQ0FBQTtBQUVKLEVBQUEsTUFBTUMsT0FBTyxHQUFHLElBQUlDLE9BQUosQ0FBWWIsTUFBWixFQUFvQjtBQUNoQ0MsSUFBQUEsS0FBSyxFQUFFQSxLQUR5QjtBQUVoQ0MsSUFBQUEsTUFBTSxFQUFFQSxNQUZ3QjtBQUdoQ0UsSUFBQUEsTUFB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
