/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
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
const particleTexChannels = 4; // there is a duplicate in cpu updater

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

// a device cache storing default parameter texture for the emitter
const particleEmitterDeviceCache = new DeviceCache();
class ParticleEmitter {
  constructor(graphicsDevice, options) {
    this.graphicsDevice = graphicsDevice;
    const gd = graphicsDevice;
    const precision = 32;
    this.precision = precision;
    this._addTimeTime = 0;

    // Global system parameters
    setPropertyTarget = this;
    setPropertyOptions = options;
    setProperty('numParticles', 1); // Amount of particles allocated (max particles = max GL texture width at this moment)

    if (this.numParticles > graphicsDevice.maxTextureSize) {
      Debug.warn(`WARNING: can't create more than ${graphicsDevice.maxTextureSize} particles on this device.`);
      this.numParticles = graphicsDevice.maxTextureSize;
    }
    setProperty('rate', 1); // Emission rate
    setProperty('rate2', this.rate);
    setProperty('lifetime', 50); // Particle lifetime
    setProperty('emitterExtents', new Vec3(0, 0, 0)); // Spawn point divergence
    setProperty('emitterExtentsInner', new Vec3(0, 0, 0)); // Volume inside emitterExtents to exclude from regeneration
    setProperty('emitterRadius', 0);
    setProperty('emitterRadiusInner', 0); // Same as ExtentsInner but for spherical volume
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
    setProperty('sort', PARTICLESORT_NONE); // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;  Forces CPU mode if not 0
    setProperty('mode', PARTICLEMODE_GPU);
    setProperty('scene', null);
    setProperty('lighting', false);
    setProperty('halfLambert', false);
    setProperty('intensity', 1.0);
    setProperty('stretch', 0.0);
    setProperty('alignToMotion', false);
    setProperty('depthSoftening', 0);
    setProperty('mesh', null); // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
    // Leave undefined to use simple quads
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

    // Time-dependent parameters
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
    // this.prevPos = new Vec3();

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
      // take extra step to prevent position glitches
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
    // force CPU if desirable by user or sorting is enabled
    gd.maxVertexTextures <= 1 ||
    // force CPU if can't use enough vertex textures
    gd.fragmentUniformsCount < 64 ||
    // force CPU if can't use many uniforms; TODO: change to more realistic value (this one is iphone's)
    gd.forceCpuParticles || !gd.extTextureFloat; // no float texture extension

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
      // this.prevPos.copy(this.node.getPosition());
      this.worldBounds.setFromTransformedAabb(this.localBounds, this.localSpace ? Mat4.IDENTITY : this.node.getWorldTransform());
      this.worldBoundsTrail[0].copy(this.worldBounds);
      this.worldBoundsTrail[1].copy(this.worldBounds);
      this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
      this.prevWorldBoundsSize.copy(this.worldBoundsSize);
      this.prevWorldBoundsCenter.copy(this.worldBounds.center);
      if (this.pack8) this.calculateBoundsMad();
    }

    // Dynamic simulation data
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
      if (this.useCpu) this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = 1; // hide/show
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

    // Note: createShaderFromCode can return a shader from the cache (not a new shader) so we *should not* delete these shaders
    // when the particle emitter is destroyed
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
    this.material.blendType = this.blendType;
    this.material.depthWrite = this.depthWrite;
    this.material.emitter = this;
    this.regenShader();
    this.resetMaterial();
    const wasVisible = this.meshInstance ? this.meshInstance.visible : true;
    this.meshInstance = new MeshInstance(mesh, this.material, this.node);
    this.meshInstance.pick = false;
    this.meshInstance.updateKey(); // shouldn't be here?
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
    this.addTime(0, false); // fill dynamic textures and constants with initial data
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
    // getShaderVariant is also called by pc.Scene when all shaders need to be updated
    this.material.getShaderVariant = function (dev, sc, defs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
      // The app works like this:
      // 1. Emitter init
      // 2. Update. No camera is assigned to emitters
      // 3. Render; activeCamera = camera; shader init
      // 4. Update. activeCamera is set to emitters
      // -----
      // The problem with 1st frame render is that we init the shader without having any camera set to emitter -
      // so wrong shader is being compiled.
      // To fix it, we need to check activeCamera!=emitter.camera in shader init too
      if (this.emitter.scene) {
        if (this.emitter.camera !== this.emitter.scene._activeCamera) {
          this.emitter.camera = this.emitter.scene._activeCamera;
          this.emitter.onChangeCamera();
        }
      }

      // set by Editor if running inside editor
      const inTools = this.emitter.inTools;
      const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);
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
        // in Editor, screen space particles (children of 2D Screen) are still rendered in 3d space
        screenSpace: inTools ? false : this.emitter.screenSpace,
        blend: this.blendType,
        animTex: this.emitter._isAnimated(),
        animTexLoop: this.emitter.animLoop,
        pack8: this.emitter.pack8,
        customFace: this.emitter.orientation !== PARTICLEORIENTATION_SCREEN
      }, processingOptions);
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
      material.setParameter('softening', 1.0 / (this.depthSoftening * this.depthSoftening * 100)); // remap to more perceptually linear
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

  // Declares vertex format, creates VB and IB
  _allocate(numParticles) {
    const psysVertCount = numParticles * this.numParticleVerts;
    const psysIndexCount = numParticles * this.numParticleIndices;
    if (this.vertexBuffer === undefined || this.vertexBuffer.getNumVertices() !== psysVertCount) {
      // Create the particle vertex format
      if (!this.useCpu) {
        // GPU: XYZ = quad vertex position; W = INT: particle ID, FRAC: random factor
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

      // Fill the vertex buffer
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

      // Fill the index buffer
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
      tilesParams[0] = 1.0 / this.animTilesX; // animTexTilesParams.x
      tilesParams[1] = 1.0 / this.animTilesY; // animTexTilesParams.y

      const params = this.animParams;
      params[0] = this.animStartFrame; // animTexParams.x
      params[1] = this.animNumFrames * this.animSpeed; // animTexParams.y
      params[2] = this.animNumFrames - 1; // animTexParams.z
      params[3] = this.animNumAnimations - 1; // animTexParams.w

      const animIndexParams = this.animIndexParams;
      animIndexParams[0] = this.animIndex; // animTexIndexParams.x
      animIndexParams[1] = this.randomizeAnimIndex; // animTexIndexParams.y
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
      // this.vertexBuffer.unlock();
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
      this.vertexBuffer = undefined; // we are testing if vb is undefined in some code, no idea why
    }

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
      this.indexBuffer = undefined;
    }
    if (this.material) {
      this.material.destroy();
      this.material = null;
    }

    // note: shaders should not be destroyed as they could be shared between emitters
  }

  destroy() {
    this.camera = null;
    this._destroyResources();
  }
}

export { ParticleEmitter };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUtZW1pdHRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ3VydmUgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUuanMnO1xuaW1wb3J0IHsgQ3VydmVTZXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQlVGRkVSX0RZTkFNSUMsXG4gICAgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVCxcbiAgICBJTkRFWEZPUk1BVF9VSU5UMTYsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX1JHQkEzMkYsXG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMywgU0VNQU5USUNfQVRUUjQsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGV2aWNlLWNhY2hlLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IFNoYWRlclByb2Nlc3Nvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXItcHJvY2Vzc29yLW9wdGlvbnMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PUk1BTCxcbiAgICBFTUlUVEVSU0hBUEVfQk9YLFxuICAgIFBBUlRJQ0xFTU9ERV9HUFUsXG4gICAgUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4sIFBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQsXG4gICAgUEFSVElDTEVTT1JUX05PTkVcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi9tZXNoLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zaGFkZXItbGliL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuLi9zaGFkZXItbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBwYXJ0aWNsZSB9IGZyb20gJy4uL3NoYWRlci1saWIvcHJvZ3JhbXMvcGFydGljbGUuanMnO1xuaW1wb3J0IHsgUGFydGljbGVDUFVVcGRhdGVyIH0gZnJvbSAnLi9jcHUtdXBkYXRlci5qcyc7XG5pbXBvcnQgeyBQYXJ0aWNsZUdQVVVwZGF0ZXIgfSBmcm9tICcuL2dwdS11cGRhdGVyLmpzJztcblxuY29uc3QgcGFydGljbGVWZXJ0cyA9IFtcbiAgICBbLTEsIC0xXSxcbiAgICBbMSwgLTFdLFxuICAgIFsxLCAxXSxcbiAgICBbLTEsIDFdXG5dO1xuXG5mdW5jdGlvbiBfY3JlYXRlVGV4dHVyZShkZXZpY2UsIHdpZHRoLCBoZWlnaHQsIHBpeGVsRGF0YSwgZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTMyRiwgbXVsdDhCaXQsIGZpbHRlcikge1xuXG4gICAgbGV0IG1pcEZpbHRlciA9IEZJTFRFUl9ORUFSRVNUO1xuICAgIGlmIChmaWx0ZXIgJiYgZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOClcbiAgICAgICAgbWlwRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcblxuICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgIGN1YmVtYXA6IGZhbHNlLFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBtaXBGaWx0ZXIsXG4gICAgICAgIG1hZ0ZpbHRlcjogbWlwRmlsdGVyLFxuICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICBuYW1lOiAnUGFydGljbGVTeXN0ZW1UZXh0dXJlJ1xuICAgIH0pO1xuXG4gICAgY29uc3QgcGl4ZWxzID0gdGV4dHVyZS5sb2NrKCk7XG5cbiAgICBpZiAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCkge1xuICAgICAgICBjb25zdCB0ZW1wID0gbmV3IFVpbnQ4QXJyYXkocGl4ZWxEYXRhLmxlbmd0aCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGl4ZWxEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0ZW1wW2ldID0gcGl4ZWxEYXRhW2ldICogbXVsdDhCaXQgKiAyNTU7XG4gICAgICAgIH1cbiAgICAgICAgcGl4ZWxEYXRhID0gdGVtcDtcbiAgICB9XG5cbiAgICBwaXhlbHMuc2V0KHBpeGVsRGF0YSk7XG5cbiAgICB0ZXh0dXJlLnVubG9jaygpO1xuXG4gICAgcmV0dXJuIHRleHR1cmU7XG59XG5cbmZ1bmN0aW9uIHNhdHVyYXRlKHgpIHtcbiAgICByZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4oeCwgMSksIDApO1xufVxuXG5jb25zdCBkZWZhdWx0MEN1cnZlID0gbmV3IEN1cnZlKFswLCAwLCAxLCAwXSk7XG5jb25zdCBkZWZhdWx0MUN1cnZlID0gbmV3IEN1cnZlKFswLCAxLCAxLCAxXSk7XG5jb25zdCBkZWZhdWx0MEN1cnZlMyA9IG5ldyBDdXJ2ZVNldChbMCwgMCwgMSwgMF0sIFswLCAwLCAxLCAwXSwgWzAsIDAsIDEsIDBdKTtcbmNvbnN0IGRlZmF1bHQxQ3VydmUzID0gbmV3IEN1cnZlU2V0KFswLCAxLCAxLCAxXSwgWzAsIDEsIDEsIDFdLCBbMCwgMSwgMSwgMV0pO1xuXG5sZXQgcGFydGljbGVUZXhIZWlnaHQgPSAyO1xuY29uc3QgcGFydGljbGVUZXhDaGFubmVscyA9IDQ7IC8vIHRoZXJlIGlzIGEgZHVwbGljYXRlIGluIGNwdSB1cGRhdGVyXG5cbmNvbnN0IGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5jb25zdCBzcGF3bk1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbmNvbnN0IHRtcFZlYzMgPSBuZXcgVmVjMygpO1xuY29uc3QgYk1pbiA9IG5ldyBWZWMzKCk7XG5jb25zdCBiTWF4ID0gbmV3IFZlYzMoKTtcblxubGV0IHNldFByb3BlcnR5VGFyZ2V0O1xubGV0IHNldFByb3BlcnR5T3B0aW9ucztcblxuZnVuY3Rpb24gc2V0UHJvcGVydHkocE5hbWUsIGRlZmF1bHRWYWwpIHtcbiAgICBpZiAoc2V0UHJvcGVydHlPcHRpb25zW3BOYW1lXSAhPT0gdW5kZWZpbmVkICYmIHNldFByb3BlcnR5T3B0aW9uc1twTmFtZV0gIT09IG51bGwpIHtcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXRbcE5hbWVdID0gc2V0UHJvcGVydHlPcHRpb25zW3BOYW1lXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXRQcm9wZXJ0eVRhcmdldFtwTmFtZV0gPSBkZWZhdWx0VmFsO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFjazNORmxvYXRzKGEsIGIsIGMpIHtcbiAgICBjb25zdCBwYWNrZWQgPSAoKGEgKiAyNTUpIDw8IDE2KSB8ICgoYiAqIDI1NSkgPDwgOCkgfCAoYyAqIDI1NSk7XG4gICAgcmV0dXJuIChwYWNrZWQpIC8gKDEgPDwgMjQpO1xufVxuXG5mdW5jdGlvbiBwYWNrVGV4dHVyZVhZWl9OWFlaKHFYWVosIHFYWVoyKSB7XG4gICAgY29uc3QgbnVtID0gcVhZWi5sZW5ndGggLyAzO1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShudW0gKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxWFlaW2kgKiAzXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxWFlaW2kgKiAzICsgMV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gcVhZWltpICogMyArIDJdO1xuXG4gICAgICAgIGNvbG9yc1tpICogNCArIDNdID0gcGFjazNORmxvYXRzKHFYWVoyW2kgKiAzXSwgcVhZWjJbaSAqIDMgKyAxXSwgcVhZWjJbaSAqIDMgKyAyXSk7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlUkdCQShxUkdCLCBxQSkge1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShxQS5sZW5ndGggKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHFBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxUkdCW2kgKiAzXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxUkdCW2kgKiAzICsgMV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gcVJHQltpICogMyArIDJdO1xuXG4gICAgICAgIGNvbG9yc1tpICogNCArIDNdID0gcUFbaV07XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlNUZsb2F0cyhxQSwgcUIsIHFDLCBxRCwgcUUpIHtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkocUEubGVuZ3RoICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxQS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcUFbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcUJbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gMDtcblxuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IHBhY2szTkZsb2F0cyhxQ1tpXSwgcURbaV0sIHFFW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbG9ycztcbn1cblxuZnVuY3Rpb24gcGFja1RleHR1cmUyRmxvYXRzKHFBLCBxQikge1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShxQS5sZW5ndGggKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHFBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxQVtpXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxQltpXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMl0gPSAwO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIGNhbGNFbmRUaW1lKGVtaXR0ZXIpIHtcbiAgICBjb25zdCBpbnRlcnZhbCA9IChNYXRoLm1heChlbWl0dGVyLnJhdGUsIGVtaXR0ZXIucmF0ZTIpICogZW1pdHRlci5udW1QYXJ0aWNsZXMgKyBlbWl0dGVyLmxpZmV0aW1lKTtcbiAgICByZXR1cm4gRGF0ZS5ub3coKSArIGludGVydmFsICogMTAwMDtcbn1cblxuZnVuY3Rpb24gc3ViR3JhcGgoQSwgQikge1xuICAgIGNvbnN0IHIgPSBuZXcgRmxvYXQzMkFycmF5KEEubGVuZ3RoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IEEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcltpXSA9IEFbaV0gLSBCW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcjtcbn1cblxuZnVuY3Rpb24gbWF4VW5zaWduZWRHcmFwaFZhbHVlKEEsIG91dFVNYXgpIHtcbiAgICBjb25zdCBjaGFucyA9IG91dFVNYXgubGVuZ3RoO1xuICAgIGNvbnN0IHZhbHVlcyA9IEEubGVuZ3RoIC8gY2hhbnM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXM7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNoYW5zOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGEgPSBNYXRoLmFicyhBW2kgKiBjaGFucyArIGpdKTtcbiAgICAgICAgICAgIG91dFVNYXhbal0gPSBNYXRoLm1heChvdXRVTWF4W2pdLCBhKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplR3JhcGgoQSwgdU1heCkge1xuICAgIGNvbnN0IGNoYW5zID0gdU1heC5sZW5ndGg7XG4gICAgY29uc3QgdmFsdWVzID0gQS5sZW5ndGggLyBjaGFucztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlczsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY2hhbnM7IGorKykge1xuICAgICAgICAgICAgQVtpICogY2hhbnMgKyBqXSAvPSAodU1heFtqXSA9PT0gMCA/IDEgOiB1TWF4W2pdKTtcbiAgICAgICAgICAgIEFbaSAqIGNoYW5zICsgal0gKj0gMC41O1xuICAgICAgICAgICAgQVtpICogY2hhbnMgKyBqXSArPSAwLjU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpdkdyYXBoRnJvbTJDdXJ2ZXMoY3VydmUxLCBjdXJ2ZTIsIG91dFVNYXgpIHtcbiAgICBjb25zdCBzdWIgPSBzdWJHcmFwaChjdXJ2ZTIsIGN1cnZlMSk7XG4gICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHN1Yiwgb3V0VU1heCk7XG4gICAgbm9ybWFsaXplR3JhcGgoc3ViLCBvdXRVTWF4KTtcbiAgICByZXR1cm4gc3ViO1xufVxuXG4vLyBhIGRldmljZSBjYWNoZSBzdG9yaW5nIGRlZmF1bHQgcGFyYW1ldGVyIHRleHR1cmUgZm9yIHRoZSBlbWl0dGVyXG5jb25zdCBwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jbGFzcyBQYXJ0aWNsZUVtaXR0ZXIge1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgZ2QgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgcHJlY2lzaW9uID0gMzI7XG4gICAgICAgIHRoaXMucHJlY2lzaW9uID0gcHJlY2lzaW9uO1xuXG4gICAgICAgIHRoaXMuX2FkZFRpbWVUaW1lID0gMDtcblxuICAgICAgICAvLyBHbG9iYWwgc3lzdGVtIHBhcmFtZXRlcnNcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXQgPSB0aGlzO1xuICAgICAgICBzZXRQcm9wZXJ0eU9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbnVtUGFydGljbGVzJywgMSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbW91bnQgb2YgcGFydGljbGVzIGFsbG9jYXRlZCAobWF4IHBhcnRpY2xlcyA9IG1heCBHTCB0ZXh0dXJlIHdpZHRoIGF0IHRoaXMgbW9tZW50KVxuXG4gICAgICAgIGlmICh0aGlzLm51bVBhcnRpY2xlcyA+IGdyYXBoaWNzRGV2aWNlLm1heFRleHR1cmVTaXplKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBXQVJOSU5HOiBjYW4ndCBjcmVhdGUgbW9yZSB0aGFuICR7Z3JhcGhpY3NEZXZpY2UubWF4VGV4dHVyZVNpemV9IHBhcnRpY2xlcyBvbiB0aGlzIGRldmljZS5gKTtcbiAgICAgICAgICAgIHRoaXMubnVtUGFydGljbGVzID0gZ3JhcGhpY3NEZXZpY2UubWF4VGV4dHVyZVNpemU7XG4gICAgICAgIH1cblxuICAgICAgICBzZXRQcm9wZXJ0eSgncmF0ZScsIDEpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBFbWlzc2lvbiByYXRlXG4gICAgICAgIHNldFByb3BlcnR5KCdyYXRlMicsIHRoaXMucmF0ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsaWZldGltZScsIDUwKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhcnRpY2xlIGxpZmV0aW1lXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyRXh0ZW50cycsIG5ldyBWZWMzKDAsIDAsIDApKTsgICAgICAgIC8vIFNwYXduIHBvaW50IGRpdmVyZ2VuY2VcbiAgICAgICAgc2V0UHJvcGVydHkoJ2VtaXR0ZXJFeHRlbnRzSW5uZXInLCBuZXcgVmVjMygwLCAwLCAwKSk7ICAgLy8gVm9sdW1lIGluc2lkZSBlbWl0dGVyRXh0ZW50cyB0byBleGNsdWRlIGZyb20gcmVnZW5lcmF0aW9uXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyUmFkaXVzJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyUmFkaXVzSW5uZXInLCAwKTsgICAgICAgICAgICAgICAgICAgICAgIC8vIFNhbWUgYXMgRXh0ZW50c0lubmVyIGJ1dCBmb3Igc3BoZXJpY2FsIHZvbHVtZVxuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlclNoYXBlJywgRU1JVFRFUlNIQVBFX0JPWCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdpbml0aWFsVmVsb2NpdHknLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3dyYXAnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFNwYWNlJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc2NyZWVuU3BhY2UnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCd3cmFwQm91bmRzJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvck1hcCcsIHRoaXMuZGVmYXVsdFBhcmFtVGV4dHVyZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub3JtYWxNYXAnLCBudWxsKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2xvb3AnLCB0cnVlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3ByZVdhcm0nLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzb3J0JywgUEFSVElDTEVTT1JUX05PTkUpOyAvLyBTb3J0aW5nIG1vZGU6IDAgPSBub25lLCAxID0gYnkgZGlzdGFuY2UsIDIgPSBieSBsaWZlLCAzID0gYnkgLWxpZmU7ICBGb3JjZXMgQ1BVIG1vZGUgaWYgbm90IDBcbiAgICAgICAgc2V0UHJvcGVydHkoJ21vZGUnLCBQQVJUSUNMRU1PREVfR1BVKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjZW5lJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsaWdodGluZycsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2hhbGZMYW1iZXJ0JywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnaW50ZW5zaXR5JywgMS4wKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3N0cmV0Y2gnLCAwLjApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxpZ25Ub01vdGlvbicsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2RlcHRoU29mdGVuaW5nJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdtZXNoJywgbnVsbCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWVzaCB0byBiZSB1c2VkIGFzIHBhcnRpY2xlLiBWZXJ0ZXggYnVmZmVyIGlzIHN1cHBvc2VkIHRvIGhvbGQgdmVydGV4IHBvc2l0aW9uIGluIGZpcnN0IDMgZmxvYXRzIG9mIGVhY2ggdmVydGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGVhdmUgdW5kZWZpbmVkIHRvIHVzZSBzaW1wbGUgcXVhZHNcbiAgICAgICAgc2V0UHJvcGVydHkoJ3BhcnRpY2xlTm9ybWFsJywgbmV3IFZlYzMoMCwgMSwgMCkpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnb3JpZW50YXRpb24nLCBQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTik7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2RlcHRoV3JpdGUnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub0ZvZycsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2JsZW5kVHlwZScsIEJMRU5EX05PUk1BTCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub2RlJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdGFydEFuZ2xlJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdGFydEFuZ2xlMicsIHRoaXMuc3RhcnRBbmdsZSk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1UaWxlc1gnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1UaWxlc1knLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1TdGFydEZyYW1lJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTnVtRnJhbWVzJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTnVtQW5pbWF0aW9ucycsIDEpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbUluZGV4JywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdyYW5kb21pemVBbmltSW5kZXgnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltU3BlZWQnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1Mb29wJywgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5fZ3B1VXBkYXRlciA9IG5ldyBQYXJ0aWNsZUdQVVVwZGF0ZXIodGhpcywgZ2QpO1xuICAgICAgICB0aGlzLl9jcHVVcGRhdGVyID0gbmV3IFBhcnRpY2xlQ1BVVXBkYXRlcih0aGlzKTtcblxuICAgICAgICB0aGlzLmNvbnN0YW50TGlnaHRDdWJlID0gZ2Quc2NvcGUucmVzb2x2ZSgnbGlnaHRDdWJlWzBdJyk7XG4gICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pO1xuXG4gICAgICAgIC8vIFRpbWUtZGVwZW5kZW50IHBhcmFtZXRlcnNcbiAgICAgICAgc2V0UHJvcGVydHkoJ2NvbG9yR3JhcGgnLCBkZWZhdWx0MUN1cnZlMyk7XG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvckdyYXBoMicsIHRoaXMuY29sb3JHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjYWxlR3JhcGgnLCBkZWZhdWx0MUN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjYWxlR3JhcGgyJywgdGhpcy5zY2FsZUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxwaGFHcmFwaCcsIGRlZmF1bHQxQ3VydmUpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxwaGFHcmFwaDInLCB0aGlzLmFscGhhR3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFZlbG9jaXR5R3JhcGgnLCBkZWZhdWx0MEN1cnZlMyk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFZlbG9jaXR5R3JhcGgyJywgdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCd2ZWxvY2l0eUdyYXBoJywgZGVmYXVsdDBDdXJ2ZTMpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgndmVsb2NpdHlHcmFwaDInLCB0aGlzLnZlbG9jaXR5R3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdyb3RhdGlvblNwZWVkR3JhcGgnLCBkZWZhdWx0MEN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3JvdGF0aW9uU3BlZWRHcmFwaDInLCB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhZGlhbFNwZWVkR3JhcGgnLCBkZWZhdWx0MEN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhZGlhbFNwZWVkR3JhcGgyJywgdGhpcy5yYWRpYWxTcGVlZEdyYXBoKTtcblxuICAgICAgICB0aGlzLmxpZ2h0Q3ViZSA9IG5ldyBGbG9hdDMyQXJyYXkoNiAqIDMpO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpciA9IG5ldyBBcnJheSg2KTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbMF0gPSBuZXcgVmVjMygtMSwgMCwgMCk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzFdID0gbmV3IFZlYzMoMSwgMCwgMCk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzJdID0gbmV3IFZlYzMoMCwgLTEsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpclszXSA9IG5ldyBWZWMzKDAsIDEsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpcls0XSA9IG5ldyBWZWMzKDAsIDAsIC0xKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbNV0gPSBuZXcgVmVjMygwLCAwLCAxKTtcblxuICAgICAgICB0aGlzLmFuaW1UaWxlc1BhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuYW5pbVBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuYW5pbUluZGV4UGFyYW1zID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuICAgICAgICB0aGlzLmludGVybmFsVGV4MCA9IG51bGw7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbG9yUGFyYW0gPSBudWxsO1xuXG4gICAgICAgIHRoaXMudmJUb1NvcnQgPSBudWxsO1xuICAgICAgICB0aGlzLnZiT2xkID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJ0aWNsZURpc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNhbWVyYSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zd2FwVGV4ID0gZmFsc2U7XG4gICAgICAgIHRoaXMudXNlTWVzaCA9IHRydWU7XG4gICAgICAgIHRoaXMudXNlQ3B1ID0gIWdyYXBoaWNzRGV2aWNlLnN1cHBvcnRzR3B1UGFydGljbGVzO1xuXG4gICAgICAgIHRoaXMucGFjazggPSB0cnVlO1xuICAgICAgICB0aGlzLmxvY2FsQm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbCA9IFtuZXcgQm91bmRpbmdCb3goKSwgbmV3IEJvdW5kaW5nQm94KCldO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1NpemUgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzU2l6ZSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5wcmV2RW1pdHRlckV4dGVudHMgPSB0aGlzLmVtaXR0ZXJFeHRlbnRzO1xuICAgICAgICB0aGlzLnByZXZFbWl0dGVyUmFkaXVzID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMudGltZVRvU3dpdGNoQm91bmRzID0gMDtcbiAgICAgICAgLy8gdGhpcy5wcmV2UG9zID0gbmV3IFZlYzMoKTtcblxuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlUmVzcGF3biA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZGVyUGFydGljbGVVcGRhdGVOb1Jlc3Bhd24gPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wID0gbnVsbDtcblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlVmVydHMgPSAwO1xuICAgICAgICB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyA9IDA7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIHRoaXMuc2VlZCA9IE1hdGgucmFuZG9tKCk7XG5cbiAgICAgICAgdGhpcy5maXhlZFRpbWVTdGVwID0gMS4wIC8gNjA7XG4gICAgICAgIHRoaXMubWF4U3ViU3RlcHMgPSAxMDtcbiAgICAgICAgdGhpcy5zaW1UaW1lID0gMDtcbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgPSAwO1xuXG4gICAgICAgIHRoaXMuYmVlblJlc2V0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVidWlsZCgpO1xuICAgIH1cblxuICAgIGdldCBkZWZhdWx0UGFyYW1UZXh0dXJlKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5ncmFwaGljc0RldmljZSk7XG4gICAgICAgIHJldHVybiBwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZS5nZXQodGhpcy5ncmFwaGljc0RldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IDE2O1xuICAgICAgICAgICAgY29uc3QgY2VudGVyUG9pbnQgPSByZXNvbHV0aW9uICogMC41ICsgMC41O1xuICAgICAgICAgICAgY29uc3QgZHRleCA9IG5ldyBGbG9hdDMyQXJyYXkocmVzb2x1dGlvbiAqIHJlc29sdXRpb24gKiA0KTtcbiAgICAgICAgICAgIGZvciAobGV0IHkgPSAwOyB5IDwgcmVzb2x1dGlvbjsgeSsrKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCByZXNvbHV0aW9uOyB4KyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeGdyYWQgPSAoeCArIDEpIC0gY2VudGVyUG9pbnQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHlncmFkID0gKHkgKyAxKSAtIGNlbnRlclBvaW50O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjID0gc2F0dXJhdGUoKDEgLSBzYXR1cmF0ZShNYXRoLnNxcnQoeGdyYWQgKiB4Z3JhZCArIHlncmFkICogeWdyYWQpIC8gcmVzb2x1dGlvbikpIC0gMC41KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcCA9IHkgKiByZXNvbHV0aW9uICsgeDtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNF0gPSAgICAgMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDFdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDJdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDNdID0gYztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSBfY3JlYXRlVGV4dHVyZSh0aGlzLmdyYXBoaWNzRGV2aWNlLCByZXNvbHV0aW9uLCByZXNvbHV0aW9uLCBkdGV4LCBQSVhFTEZPUk1BVF9SR0JBOCwgMS4wLCB0cnVlKTtcbiAgICAgICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgIHRleHR1cmUubWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBvbkNoYW5nZUNhbWVyYSgpIHtcbiAgICAgICAgdGhpcy5yZWdlblNoYWRlcigpO1xuICAgICAgICB0aGlzLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVCb3VuZHNNYWQoKSB7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueCA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLng7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueSA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLnk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueiA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLno7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKS5tdWwodGhpcy53b3JsZEJvdW5kc011bCkubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC54ICs9IDAuNTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC55ICs9IDAuNTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC56ICs9IDAuNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVXb3JsZEJvdW5kcygpIHtcbiAgICAgICAgaWYgKCF0aGlzLm5vZGUpIHJldHVybjtcblxuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyLmNvcHkodGhpcy53b3JsZEJvdW5kcy5jZW50ZXIpO1xuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGxldCByZWNhbGN1bGF0ZUxvY2FsQm91bmRzID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgICAgICByZWNhbGN1bGF0ZUxvY2FsQm91bmRzID0gIXRoaXMuZW1pdHRlckV4dGVudHMuZXF1YWxzKHRoaXMucHJldkVtaXR0ZXJFeHRlbnRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVjYWxjdWxhdGVMb2NhbEJvdW5kcyA9ICEodGhpcy5lbWl0dGVyUmFkaXVzID09PSB0aGlzLnByZXZFbWl0dGVyUmFkaXVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZWNhbGN1bGF0ZUxvY2FsQm91bmRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxjdWxhdGVMb2NhbEJvdW5kcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBjb25zdCBub2RlV1QgPSB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgaWYgKHRoaXMubG9jYWxTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc05vVHJhaWwuY29weSh0aGlzLmxvY2FsQm91bmRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy5sb2NhbEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5hZGQodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uYWRkKHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcblxuICAgICAgICBjb25zdCBub3cgPSB0aGlzLnNpbVRpbWVUb3RhbDtcbiAgICAgICAgaWYgKG5vdyA+PSB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcykge1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdKTtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFsxXS5jb3B5KHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcbiAgICAgICAgICAgIHRoaXMudGltZVRvU3dpdGNoQm91bmRzID0gbm93ICsgdGhpcy5saWZldGltZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHMuY29weSh0aGlzLndvcmxkQm91bmRzVHJhaWxbMF0pO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuXG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYih0aGlzLndvcmxkQm91bmRzLCBub2RlV1QpO1xuICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UubWVzaC5hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy53b3JsZEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuY29weSh0aGlzLndvcmxkQm91bmRzKTtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm1lc2guYWFiYi5jb3B5KHRoaXMud29ybGRCb3VuZHMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyID0gMSAtIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyO1xuXG4gICAgICAgIGlmICh0aGlzLnBhY2s4KSB0aGlzLmNhbGN1bGF0ZUJvdW5kc01hZCgpO1xuICAgIH1cblxuICAgIHJlc2V0V29ybGRCb3VuZHMoKSB7XG4gICAgICAgIGlmICghdGhpcy5ub2RlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc05vVHJhaWwuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihcbiAgICAgICAgICAgIHRoaXMubG9jYWxCb3VuZHMsIHRoaXMubG9jYWxTcGFjZSA/IE1hdDQuSURFTlRJVFkgOiB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzTm9UcmFpbCk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kcy5jb3B5KHRoaXMud29ybGRCb3VuZHNUcmFpbFswXSk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuXG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzU2l6ZS5jb3B5KHRoaXMud29ybGRCb3VuZHNTaXplKTtcbiAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNDZW50ZXIuY29weSh0aGlzLndvcmxkQm91bmRzLmNlbnRlcik7XG5cbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgPSAwO1xuICAgICAgICB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcyA9IDA7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTG9jYWxCb3VuZHMoKSB7XG4gICAgICAgIGxldCBtaW54ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgbGV0IG1pbnkgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWlueiA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh4ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh5ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh6ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXhSID0gMDtcbiAgICAgICAgbGV0IG1heFNjYWxlID0gMDtcbiAgICAgICAgY29uc3Qgc3RlcFdlaWdodCA9IHRoaXMubGlmZXRpbWUgLyB0aGlzLnByZWNpc2lvbjtcbiAgICAgICAgY29uc3Qgd1ZlbHMgPSBbdGhpcy5xVmVsb2NpdHksIHRoaXMucVZlbG9jaXR5Ml07XG4gICAgICAgIGNvbnN0IGxWZWxzID0gW3RoaXMucUxvY2FsVmVsb2NpdHksIHRoaXMucUxvY2FsVmVsb2NpdHkyXTtcbiAgICAgICAgY29uc3QgYWNjdW1YID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVkgPSBbMCwgMF07XG4gICAgICAgIGNvbnN0IGFjY3VtWiA9IFswLCAwXTtcbiAgICAgICAgY29uc3QgYWNjdW1SID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVcgPSBbMCwgMF07XG4gICAgICAgIGxldCB4LCB5LCB6O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucHJlY2lzaW9uICsgMTsgaSsrKSB7IC8vIHRha2UgZXh0cmEgc3RlcCB0byBwcmV2ZW50IHBvc2l0aW9uIGdsaXRjaGVzXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IE1hdGgubWluKGksIHRoaXMucHJlY2lzaW9uIC0gMSk7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDI7IGorKykge1xuICAgICAgICAgICAgICAgIHggPSBsVmVsc1tqXVtpbmRleCAqIDMgKyAwXSAqIHN0ZXBXZWlnaHQgKyBhY2N1bVhbal07XG4gICAgICAgICAgICAgICAgeSA9IGxWZWxzW2pdW2luZGV4ICogMyArIDFdICogc3RlcFdlaWdodCArIGFjY3VtWVtqXTtcbiAgICAgICAgICAgICAgICB6ID0gbFZlbHNbal1baW5kZXggKiAzICsgMl0gKiBzdGVwV2VpZ2h0ICsgYWNjdW1aW2pdO1xuXG4gICAgICAgICAgICAgICAgbWlueCA9IE1hdGgubWluKHgsIG1pbngpO1xuICAgICAgICAgICAgICAgIG1pbnkgPSBNYXRoLm1pbih5LCBtaW55KTtcbiAgICAgICAgICAgICAgICBtaW56ID0gTWF0aC5taW4oeiwgbWlueik7XG4gICAgICAgICAgICAgICAgbWF4eCA9IE1hdGgubWF4KHgsIG1heHgpO1xuICAgICAgICAgICAgICAgIG1heHkgPSBNYXRoLm1heCh5LCBtYXh5KTtcbiAgICAgICAgICAgICAgICBtYXh6ID0gTWF0aC5tYXgoeiwgbWF4eik7XG5cbiAgICAgICAgICAgICAgICBhY2N1bVhbal0gPSB4O1xuICAgICAgICAgICAgICAgIGFjY3VtWVtqXSA9IHk7XG4gICAgICAgICAgICAgICAgYWNjdW1aW2pdID0gejtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgMjsgaisrKSB7XG4gICAgICAgICAgICAgICAgYWNjdW1XW2pdICs9IHN0ZXBXZWlnaHQgKiBNYXRoLnNxcnQoXG4gICAgICAgICAgICAgICAgICAgIHdWZWxzW2pdW2luZGV4ICogMyArIDBdICogd1ZlbHNbal1baW5kZXggKiAzICsgMF0gK1xuICAgICAgICAgICAgICAgICAgICB3VmVsc1tqXVtpbmRleCAqIDMgKyAxXSAqIHdWZWxzW2pdW2luZGV4ICogMyArIDFdICtcbiAgICAgICAgICAgICAgICAgICAgd1ZlbHNbal1baW5kZXggKiAzICsgMl0gKiB3VmVsc1tqXVtpbmRleCAqIDMgKyAyXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFjY3VtUlswXSArPSB0aGlzLnFSYWRpYWxTcGVlZFtpbmRleF0gKiBzdGVwV2VpZ2h0O1xuICAgICAgICAgICAgYWNjdW1SWzFdICs9IHRoaXMucVJhZGlhbFNwZWVkMltpbmRleF0gKiBzdGVwV2VpZ2h0O1xuICAgICAgICAgICAgbWF4UiA9IE1hdGgubWF4KG1heFIsIE1hdGgubWF4KE1hdGguYWJzKGFjY3VtUlswXSksIE1hdGguYWJzKGFjY3VtUlsxXSkpKTtcblxuICAgICAgICAgICAgbWF4U2NhbGUgPSBNYXRoLm1heChtYXhTY2FsZSwgdGhpcy5xU2NhbGVbaW5kZXhdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCkge1xuICAgICAgICAgICAgeCA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAqIDAuNTtcbiAgICAgICAgICAgIHkgPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgKiAwLjU7XG4gICAgICAgICAgICB6ID0gdGhpcy5lbWl0dGVyRXh0ZW50cy56ICogMC41O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IHRoaXMuZW1pdHRlclJhZGl1cztcbiAgICAgICAgICAgIHkgPSB0aGlzLmVtaXR0ZXJSYWRpdXM7XG4gICAgICAgICAgICB6ID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdyA9IE1hdGgubWF4KGFjY3VtV1swXSwgYWNjdW1XWzFdKTtcbiAgICAgICAgYk1pbi54ID0gbWlueCAtIG1heFNjYWxlIC0geCAtIG1heFIgLSB3O1xuICAgICAgICBiTWluLnkgPSBtaW55IC0gbWF4U2NhbGUgLSB5IC0gbWF4UiAtIHc7XG4gICAgICAgIGJNaW4ueiA9IG1pbnogLSBtYXhTY2FsZSAtIHogLSBtYXhSIC0gdztcbiAgICAgICAgYk1heC54ID0gbWF4eCArIG1heFNjYWxlICsgeCArIG1heFIgKyB3O1xuICAgICAgICBiTWF4LnkgPSBtYXh5ICsgbWF4U2NhbGUgKyB5ICsgbWF4UiArIHc7XG4gICAgICAgIGJNYXgueiA9IG1heHogKyBtYXhTY2FsZSArIHogKyBtYXhSICsgdztcbiAgICAgICAgdGhpcy5sb2NhbEJvdW5kcy5zZXRNaW5NYXgoYk1pbiwgYk1heCk7XG4gICAgfVxuXG4gICAgcmVidWlsZCgpIHtcbiAgICAgICAgY29uc3QgZ2QgPSB0aGlzLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIGlmICh0aGlzLmNvbG9yTWFwID09PSBudWxsKSB0aGlzLmNvbG9yTWFwID0gdGhpcy5kZWZhdWx0UGFyYW1UZXh0dXJlO1xuXG4gICAgICAgIHRoaXMuc3Bhd25Cb3VuZHMgPSB0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCA/IHRoaXMuZW1pdHRlckV4dGVudHMgOiB0aGlzLmVtaXR0ZXJSYWRpdXM7XG5cbiAgICAgICAgdGhpcy51c2VDcHUgPSB0aGlzLnVzZUNwdSB8fCB0aGlzLnNvcnQgPiBQQVJUSUNMRVNPUlRfTk9ORSB8fCAgLy8gZm9yY2UgQ1BVIGlmIGRlc2lyYWJsZSBieSB1c2VyIG9yIHNvcnRpbmcgaXMgZW5hYmxlZFxuICAgICAgICBnZC5tYXhWZXJ0ZXhUZXh0dXJlcyA8PSAxIHx8IC8vIGZvcmNlIENQVSBpZiBjYW4ndCB1c2UgZW5vdWdoIHZlcnRleCB0ZXh0dXJlc1xuICAgICAgICBnZC5mcmFnbWVudFVuaWZvcm1zQ291bnQgPCA2NCB8fCAvLyBmb3JjZSBDUFUgaWYgY2FuJ3QgdXNlIG1hbnkgdW5pZm9ybXM7IFRPRE86IGNoYW5nZSB0byBtb3JlIHJlYWxpc3RpYyB2YWx1ZSAodGhpcyBvbmUgaXMgaXBob25lJ3MpXG4gICAgICAgIGdkLmZvcmNlQ3B1UGFydGljbGVzIHx8XG4gICAgICAgICFnZC5leHRUZXh0dXJlRmxvYXQ7IC8vIG5vIGZsb2F0IHRleHR1cmUgZXh0ZW5zaW9uXG5cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlc291cmNlcygpO1xuXG4gICAgICAgIHRoaXMucGFjazggPSAodGhpcy5wYWNrOCB8fCAhZ2QudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgJiYgIXRoaXMudXNlQ3B1O1xuXG4gICAgICAgIHBhcnRpY2xlVGV4SGVpZ2h0ID0gKHRoaXMudXNlQ3B1IHx8IHRoaXMucGFjazgpID8gNCA6IDI7XG5cbiAgICAgICAgdGhpcy51c2VNZXNoID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgIGNvbnN0IHRvdGFsVmVydENvdW50ID0gdGhpcy5udW1QYXJ0aWNsZXMgKiB0aGlzLm1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgaWYgKHRvdGFsVmVydENvdW50ID4gNjU1MzUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdXQVJOSU5HOiBwYXJ0aWNsZSBzeXN0ZW0gY2FuXFwndCByZW5kZXIgbWVzaCBwYXJ0aWNsZXMgYmVjYXVzZSBudW1QYXJ0aWNsZXMgKiBudW1WZXJ0aWNlcyBpcyBtb3JlIHRoYW4gNjVrLiBSZXZlcnRpbmcgdG8gcXVhZCBwYXJ0aWNsZXMuJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudXNlTWVzaCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlc1BvdCA9IG1hdGgubmV4dFBvd2VyT2ZUd28odGhpcy5udW1QYXJ0aWNsZXMpO1xuICAgICAgICB0aGlzLnJlYnVpbGRHcmFwaHMoKTtcbiAgICAgICAgdGhpcy5jYWxjdWxhdGVMb2NhbEJvdW5kcygpO1xuICAgICAgICB0aGlzLnJlc2V0V29ybGRCb3VuZHMoKTtcblxuICAgICAgICBpZiAodGhpcy5ub2RlKSB7XG4gICAgICAgICAgICAvLyB0aGlzLnByZXZQb3MuY29weSh0aGlzLm5vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoXG4gICAgICAgICAgICAgICAgdGhpcy5sb2NhbEJvdW5kcywgdGhpcy5sb2NhbFNwYWNlID8gTWF0NC5JREVOVElUWSA6IHRoaXMubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcblxuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzKTtcblxuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzLmhhbGZFeHRlbnRzKS5tdWxTY2FsYXIoMik7XG4gICAgICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc0NlbnRlci5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhY2s4KSB0aGlzLmNhbGN1bGF0ZUJvdW5kc01hZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRHluYW1pYyBzaW11bGF0aW9uIGRhdGFcbiAgICAgICAgdGhpcy52YlRvU29ydCA9IG5ldyBBcnJheSh0aGlzLm51bVBhcnRpY2xlcyk7XG4gICAgICAgIGZvciAobGV0IGlTb3J0ID0gMDsgaVNvcnQgPCB0aGlzLm51bVBhcnRpY2xlczsgaVNvcnQrKykgdGhpcy52YlRvU29ydFtpU29ydF0gPSBbMCwgMF07XG4gICAgICAgIHRoaXMucGFydGljbGVEaXN0YW5jZSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXMpO1xuXG4gICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIucmFuZG9taXplKCk7XG5cbiAgICAgICAgdGhpcy5wYXJ0aWNsZVRleCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXNQb3QgKiBwYXJ0aWNsZVRleEhlaWdodCAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMpO1xuICAgICAgICBjb25zdCBlbWl0dGVyUG9zID0gKHRoaXMubm9kZSA9PT0gbnVsbCB8fCB0aGlzLmxvY2FsU3BhY2UpID8gVmVjMy5aRVJPIDogdGhpcy5ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCkge1xuICAgICAgICAgICAgaWYgKHRoaXMubm9kZSA9PT0gbnVsbCB8fCB0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBzcGF3bk1hdHJpeC5zZXRUUlMoVmVjMy5aRVJPLCBRdWF0LklERU5USVRZLCB0aGlzLnNwYXduQm91bmRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgdGhpcy5ub2RlLmdldFJvdGF0aW9uKCksIHRtcFZlYzMuY29weSh0aGlzLnNwYXduQm91bmRzKS5tdWwodGhpcy5ub2RlLmxvY2FsU2NhbGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVswXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci54IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy54IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsxXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueSAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci55IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy55IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsyXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueiAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci56IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy56IDogMDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubnVtUGFydGljbGVzOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NwdVVwZGF0ZXIuY2FsY1NwYXduUG9zaXRpb24odGhpcy5wYXJ0aWNsZVRleCwgc3Bhd25NYXRyaXgsIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSwgZW1pdHRlclBvcywgaSk7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VDcHUpIHRoaXMucGFydGljbGVUZXhbaSAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMgKyAzICsgdGhpcy5udW1QYXJ0aWNsZXNQb3QgKiAyICogcGFydGljbGVUZXhDaGFubmVsc10gPSAxOyAvLyBoaWRlL3Nob3dcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXNQb3QgKiBwYXJ0aWNsZVRleEhlaWdodCAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFydGljbGVUZXhTdGFydC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0W2ldID0gdGhpcy5wYXJ0aWNsZVRleFtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhY2s4KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleElOID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCwgUElYRUxGT1JNQVRfUkdCQTgsIDEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VUID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCwgUElYRUxGT1JNQVRfUkdCQTgsIDEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQsIFBJWEVMRk9STUFUX1JHQkE4LCAxLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTiA9IF9jcmVhdGVUZXh0dXJlKGdkLCB0aGlzLm51bVBhcnRpY2xlc1BvdCwgcGFydGljbGVUZXhIZWlnaHQsIHRoaXMucGFydGljbGVUZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhPVVQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhJTiA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLnBhcnRpY2xlVGV4SU4sXG4gICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleE9VVCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLnBhcnRpY2xlVGV4T1VULFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnN3YXBUZXggPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVTdGFydCA9ICh0aGlzLmxvY2FsU3BhY2UgPyAnI2RlZmluZSBMT0NBTF9TUEFDRVxcbicgOiAnJykgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVySW5pdFBTICtcbiAgICAgICAgKHRoaXMucGFjazggPyAoc2hhZGVyQ2h1bmtzLnBhcnRpY2xlSW5wdXRSZ2JhOFBTICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlT3V0cHV0UmdiYThQUykgOlxuICAgICAgICAgICAgKHNoYWRlckNodW5rcy5wYXJ0aWNsZUlucHV0RmxvYXRQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZU91dHB1dEZsb2F0UFMpKSArXG4gICAgICAgICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCA/IHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJBQUJCUFMgOiBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyU3BoZXJlUFMpICtcbiAgICAgICAgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclN0YXJ0UFM7XG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVSZXNwYXduID0gc2hhZGVyQ29kZVN0YXJ0ICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclJlc3Bhd25QUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcbiAgICAgICAgY29uc3Qgc2hhZGVyQ29kZU5vUmVzcGF3biA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJOb1Jlc3Bhd25QUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcbiAgICAgICAgY29uc3Qgc2hhZGVyQ29kZU9uU3RvcCA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJPblN0b3BQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcblxuICAgICAgICAvLyBOb3RlOiBjcmVhdGVTaGFkZXJGcm9tQ29kZSBjYW4gcmV0dXJuIGEgc2hhZGVyIGZyb20gdGhlIGNhY2hlIChub3QgYSBuZXcgc2hhZGVyKSBzbyB3ZSAqc2hvdWxkIG5vdCogZGVsZXRlIHRoZXNlIHNoYWRlcnNcbiAgICAgICAgLy8gd2hlbiB0aGUgcGFydGljbGUgZW1pdHRlciBpcyBkZXN0cm95ZWRcbiAgICAgICAgY29uc3QgcGFyYW1zID0gdGhpcy5lbWl0dGVyU2hhcGUgKyAnJyArIHRoaXMucGFjazggKyAnJyArIHRoaXMubG9jYWxTcGFjZTtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZVJlc3Bhd24gPSBjcmVhdGVTaGFkZXJGcm9tQ29kZShnZCwgc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlMsIHNoYWRlckNvZGVSZXNwYXduLCAnZnNRdWFkMCcgKyBwYXJhbXMpO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlTm9SZXNwYXduID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlTm9SZXNwYXduLCAnZnNRdWFkMScgKyBwYXJhbXMpO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlT25TdG9wLCAnZnNRdWFkMicgKyBwYXJhbXMpO1xuXG4gICAgICAgIHRoaXMubnVtUGFydGljbGVWZXJ0cyA9IHRoaXMudXNlTWVzaCA/IHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMgOiA0O1xuICAgICAgICB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyA9IHRoaXMudXNlTWVzaCA/IHRoaXMubWVzaC5pbmRleEJ1ZmZlclswXS5udW1JbmRpY2VzIDogNjtcbiAgICAgICAgdGhpcy5fYWxsb2NhdGUodGhpcy5udW1QYXJ0aWNsZXMpO1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChnZCk7XG4gICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdGhpcy52ZXJ0ZXhCdWZmZXI7XG4gICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSB0aGlzLmluZGV4QnVmZmVyO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS50eXBlID0gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IDA7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gKHRoaXMubnVtUGFydGljbGVzICogdGhpcy5udW1QYXJ0aWNsZUluZGljZXMpO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbmV3IE1hdGVyaWFsKCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwubmFtZSA9IHRoaXMubm9kZS5uYW1lO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9OT05FO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5ibGVuZFR5cGUgPSB0aGlzLmJsZW5kVHlwZTtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsLmRlcHRoV3JpdGUgPSB0aGlzLmRlcHRoV3JpdGU7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuZW1pdHRlciA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5yZWdlblNoYWRlcigpO1xuICAgICAgICB0aGlzLnJlc2V0TWF0ZXJpYWwoKTtcblxuICAgICAgICBjb25zdCB3YXNWaXNpYmxlID0gdGhpcy5tZXNoSW5zdGFuY2UgPyB0aGlzLm1lc2hJbnN0YW5jZS52aXNpYmxlIDogdHJ1ZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMubWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnBpY2sgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudXBkYXRlS2V5KCk7IC8vIHNob3VsZG4ndCBiZSBoZXJlP1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5jdWxsID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuX25vRGVwdGhEcmF3R2wxID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubG9jYWxTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMud29ybGRCb3VuZHMsIHRoaXMubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuY29weSh0aGlzLndvcmxkQm91bmRzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYiA9IGZhbHNlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gd2FzVmlzaWJsZTtcblxuICAgICAgICB0aGlzLl9pbml0aWFsaXplVGV4dHVyZXMoKTtcblxuICAgICAgICB0aGlzLnJlc2V0VGltZSgpO1xuXG4gICAgICAgIHRoaXMuYWRkVGltZSgwLCBmYWxzZSk7IC8vIGZpbGwgZHluYW1pYyB0ZXh0dXJlcyBhbmQgY29uc3RhbnRzIHdpdGggaW5pdGlhbCBkYXRhXG4gICAgICAgIGlmICh0aGlzLnByZVdhcm0pIHRoaXMucHJld2FybSh0aGlzLmxpZmV0aW1lKTtcbiAgICB9XG5cbiAgICBfaXNBbmltYXRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYW5pbU51bUZyYW1lcyA+PSAxICYmXG4gICAgICAgICAgICAgICAodGhpcy5hbmltVGlsZXNYID4gMSB8fCB0aGlzLmFuaW1UaWxlc1kgPiAxKSAmJlxuICAgICAgICAgICAgICAgKHRoaXMuY29sb3JNYXAgJiYgdGhpcy5jb2xvck1hcCAhPT0gdGhpcy5kZWZhdWx0UGFyYW1UZXh0dXJlIHx8IHRoaXMubm9ybWFsTWFwKTtcbiAgICB9XG5cbiAgICByZWJ1aWxkR3JhcGhzKCkge1xuICAgICAgICBjb25zdCBwcmVjaXNpb24gPSB0aGlzLnByZWNpc2lvbjtcbiAgICAgICAgY29uc3QgZ2QgPSB0aGlzLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIHRoaXMucUxvY2FsVmVsb2NpdHkgPSB0aGlzLmxvY2FsVmVsb2NpdHlHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFWZWxvY2l0eSA9IHRoaXMudmVsb2NpdHlHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFDb2xvciA9ICAgICAgICAgdGhpcy5jb2xvckdyYXBoLnF1YW50aXplQ2xhbXBlZChwcmVjaXNpb24sIDAsIDEpO1xuICAgICAgICB0aGlzLnFSb3RTcGVlZCA9ICAgICAgdGhpcy5yb3RhdGlvblNwZWVkR3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xU2NhbGUgPSAgICAgICAgIHRoaXMuc2NhbGVHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFBbHBoYSA9ICAgICAgICAgdGhpcy5hbHBoYUdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVJhZGlhbFNwZWVkID0gICB0aGlzLnJhZGlhbFNwZWVkR3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcblxuICAgICAgICB0aGlzLnFMb2NhbFZlbG9jaXR5MiA9IHRoaXMubG9jYWxWZWxvY2l0eUdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFWZWxvY2l0eTIgPSAgICAgIHRoaXMudmVsb2NpdHlHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xQ29sb3IyID0gICAgICAgICB0aGlzLmNvbG9yR3JhcGgyLnF1YW50aXplQ2xhbXBlZChwcmVjaXNpb24sIDAsIDEpO1xuICAgICAgICB0aGlzLnFSb3RTcGVlZDIgPSAgICAgIHRoaXMucm90YXRpb25TcGVlZEdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFTY2FsZTIgPSAgICAgICAgIHRoaXMuc2NhbGVHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xQWxwaGEyID0gICAgICAgICB0aGlzLmFscGhhR3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVJhZGlhbFNwZWVkMiA9ICAgdGhpcy5yYWRpYWxTcGVlZEdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJlY2lzaW9uOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucVJvdFNwZWVkW2ldICo9IG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgICAgIHRoaXMucVJvdFNwZWVkMltpXSAqPSBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvY2FsVmVsb2NpdHlVTWF4ID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy52ZWxvY2l0eVVNYXggPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmNvbG9yVU1heCA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMucm90U3BlZWRVTWF4ID0gWzBdO1xuICAgICAgICB0aGlzLnNjYWxlVU1heCA9ICAgIFswXTtcbiAgICAgICAgdGhpcy5hbHBoYVVNYXggPSAgICBbMF07XG4gICAgICAgIHRoaXMucmFkaWFsU3BlZWRVTWF4ID0gWzBdO1xuICAgICAgICB0aGlzLnFMb2NhbFZlbG9jaXR5RGl2ID0gZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFMb2NhbFZlbG9jaXR5LCB0aGlzLnFMb2NhbFZlbG9jaXR5MiwgdGhpcy5sb2NhbFZlbG9jaXR5VU1heCk7XG4gICAgICAgIHRoaXMucVZlbG9jaXR5RGl2ID0gICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucVZlbG9jaXR5LCB0aGlzLnFWZWxvY2l0eTIsIHRoaXMudmVsb2NpdHlVTWF4KTtcbiAgICAgICAgdGhpcy5xQ29sb3JEaXYgPSAgICAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xQ29sb3IsIHRoaXMucUNvbG9yMiwgdGhpcy5jb2xvclVNYXgpO1xuICAgICAgICB0aGlzLnFSb3RTcGVlZERpdiA9ICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFSb3RTcGVlZCwgdGhpcy5xUm90U3BlZWQyLCB0aGlzLnJvdFNwZWVkVU1heCk7XG4gICAgICAgIHRoaXMucVNjYWxlRGl2ID0gICAgICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucVNjYWxlLCB0aGlzLnFTY2FsZTIsIHRoaXMuc2NhbGVVTWF4KTtcbiAgICAgICAgdGhpcy5xQWxwaGFEaXYgPSAgICAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xQWxwaGEsIHRoaXMucUFscGhhMiwgdGhpcy5hbHBoYVVNYXgpO1xuICAgICAgICB0aGlzLnFSYWRpYWxTcGVlZERpdiA9ICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFSYWRpYWxTcGVlZCwgdGhpcy5xUmFkaWFsU3BlZWQyLCB0aGlzLnJhZGlhbFNwZWVkVU1heCk7XG5cbiAgICAgICAgaWYgKHRoaXMucGFjazgpIHtcbiAgICAgICAgICAgIGNvbnN0IHVtYXggPSBbMCwgMCwgMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xVmVsb2NpdHksIHVtYXgpO1xuICAgICAgICAgICAgY29uc3QgdW1heDIgPSBbMCwgMCwgMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xVmVsb2NpdHkyLCB1bWF4Mik7XG5cbiAgICAgICAgICAgIGNvbnN0IGx1bWF4ID0gWzAsIDAsIDBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucUxvY2FsVmVsb2NpdHksIGx1bWF4KTtcbiAgICAgICAgICAgIGNvbnN0IGx1bWF4MiA9IFswLCAwLCAwXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFMb2NhbFZlbG9jaXR5MiwgbHVtYXgyKTtcblxuICAgICAgICAgICAgY29uc3QgcnVtYXggPSBbMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xUmFkaWFsU3BlZWQsIHJ1bWF4KTtcbiAgICAgICAgICAgIGNvbnN0IHJ1bWF4MiA9IFswXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFSYWRpYWxTcGVlZDIsIHJ1bWF4Mik7XG5cbiAgICAgICAgICAgIGxldCBtYXhWZWwgPSBNYXRoLm1heCh1bWF4WzBdLCB1bWF4MlswXSk7XG4gICAgICAgICAgICBtYXhWZWwgPSBNYXRoLm1heChtYXhWZWwsIHVtYXhbMV0pO1xuICAgICAgICAgICAgbWF4VmVsID0gTWF0aC5tYXgobWF4VmVsLCB1bWF4MlsxXSk7XG4gICAgICAgICAgICBtYXhWZWwgPSBNYXRoLm1heChtYXhWZWwsIHVtYXhbMl0pO1xuICAgICAgICAgICAgbWF4VmVsID0gTWF0aC5tYXgobWF4VmVsLCB1bWF4MlsyXSk7XG5cbiAgICAgICAgICAgIGxldCBsbWF4VmVsID0gTWF0aC5tYXgobHVtYXhbMF0sIGx1bWF4MlswXSk7XG4gICAgICAgICAgICBsbWF4VmVsID0gTWF0aC5tYXgobG1heFZlbCwgbHVtYXhbMV0pO1xuICAgICAgICAgICAgbG1heFZlbCA9IE1hdGgubWF4KGxtYXhWZWwsIGx1bWF4MlsxXSk7XG4gICAgICAgICAgICBsbWF4VmVsID0gTWF0aC5tYXgobG1heFZlbCwgbHVtYXhbMl0pO1xuICAgICAgICAgICAgbG1heFZlbCA9IE1hdGgubWF4KGxtYXhWZWwsIGx1bWF4MlsyXSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1heFJhZCA9IE1hdGgubWF4KHJ1bWF4WzBdLCBydW1heDJbMF0pO1xuXG4gICAgICAgICAgICB0aGlzLm1heFZlbCA9IG1heFZlbCArIGxtYXhWZWwgKyBtYXhSYWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MCA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlWFlaX05YWVoodGhpcy5xTG9jYWxWZWxvY2l0eSwgdGhpcy5xTG9jYWxWZWxvY2l0eURpdikpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDEgPSBfY3JlYXRlVGV4dHVyZShnZCwgcHJlY2lzaW9uLCAxLCBwYWNrVGV4dHVyZVhZWl9OWFlaKHRoaXMucVZlbG9jaXR5LCB0aGlzLnFWZWxvY2l0eURpdikpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIgPSBfY3JlYXRlVGV4dHVyZShnZCwgcHJlY2lzaW9uLCAxLCBwYWNrVGV4dHVyZTVGbG9hdHModGhpcy5xUm90U3BlZWQsIHRoaXMucVNjYWxlLCB0aGlzLnFTY2FsZURpdiwgdGhpcy5xUm90U3BlZWREaXYsIHRoaXMucUFscGhhRGl2KSk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MyA9IF9jcmVhdGVUZXh0dXJlKGdkLCBwcmVjaXNpb24sIDEsIHBhY2tUZXh0dXJlMkZsb2F0cyh0aGlzLnFSYWRpYWxTcGVlZCwgdGhpcy5xUmFkaWFsU3BlZWREaXYpKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNvbG9yUGFyYW0gPSBfY3JlYXRlVGV4dHVyZShnZCwgcHJlY2lzaW9uLCAxLCBwYWNrVGV4dHVyZVJHQkEodGhpcy5xQ29sb3IsIHRoaXMucUFscGhhKSwgUElYRUxGT1JNQVRfUkdCQTgsIDEuMCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgX2luaXRpYWxpemVUZXh0dXJlcygpIHtcbiAgICAgICAgaWYgKHRoaXMuY29sb3JNYXApIHtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdjb2xvck1hcCcsIHRoaXMuY29sb3JNYXApO1xuICAgICAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcgJiYgdGhpcy5ub3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignbm9ybWFsTWFwJywgdGhpcy5ub3JtYWxNYXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVnZW5TaGFkZXIoKSB7XG4gICAgICAgIGNvbnN0IHByb2dyYW1MaWIgPSBnZXRQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlKTtcbiAgICAgICAgcHJvZ3JhbUxpYi5yZWdpc3RlcigncGFydGljbGUnLCBwYXJ0aWNsZSk7XG5cbiAgICAgICAgY29uc3QgaGFzTm9ybWFsID0gKHRoaXMubm9ybWFsTWFwICE9PSBudWxsKTtcbiAgICAgICAgdGhpcy5ub3JtYWxPcHRpb24gPSAwO1xuICAgICAgICBpZiAodGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgdGhpcy5ub3JtYWxPcHRpb24gPSBoYXNOb3JtYWwgPyAyIDogMTtcbiAgICAgICAgfVxuICAgICAgICAvLyBnZXRTaGFkZXJWYXJpYW50IGlzIGFsc28gY2FsbGVkIGJ5IHBjLlNjZW5lIHdoZW4gYWxsIHNoYWRlcnMgbmVlZCB0byBiZSB1cGRhdGVkXG4gICAgICAgIHRoaXMubWF0ZXJpYWwuZ2V0U2hhZGVyVmFyaWFudCA9IGZ1bmN0aW9uIChkZXYsIHNjLCBkZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpIHtcblxuICAgICAgICAgICAgLy8gVGhlIGFwcCB3b3JrcyBsaWtlIHRoaXM6XG4gICAgICAgICAgICAvLyAxLiBFbWl0dGVyIGluaXRcbiAgICAgICAgICAgIC8vIDIuIFVwZGF0ZS4gTm8gY2FtZXJhIGlzIGFzc2lnbmVkIHRvIGVtaXR0ZXJzXG4gICAgICAgICAgICAvLyAzLiBSZW5kZXI7IGFjdGl2ZUNhbWVyYSA9IGNhbWVyYTsgc2hhZGVyIGluaXRcbiAgICAgICAgICAgIC8vIDQuIFVwZGF0ZS4gYWN0aXZlQ2FtZXJhIGlzIHNldCB0byBlbWl0dGVyc1xuICAgICAgICAgICAgLy8gLS0tLS1cbiAgICAgICAgICAgIC8vIFRoZSBwcm9ibGVtIHdpdGggMXN0IGZyYW1lIHJlbmRlciBpcyB0aGF0IHdlIGluaXQgdGhlIHNoYWRlciB3aXRob3V0IGhhdmluZyBhbnkgY2FtZXJhIHNldCB0byBlbWl0dGVyIC1cbiAgICAgICAgICAgIC8vIHNvIHdyb25nIHNoYWRlciBpcyBiZWluZyBjb21waWxlZC5cbiAgICAgICAgICAgIC8vIFRvIGZpeCBpdCwgd2UgbmVlZCB0byBjaGVjayBhY3RpdmVDYW1lcmEhPWVtaXR0ZXIuY2FtZXJhIGluIHNoYWRlciBpbml0IHRvb1xuICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlci5zY2VuZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVtaXR0ZXIuY2FtZXJhICE9PSB0aGlzLmVtaXR0ZXIuc2NlbmUuX2FjdGl2ZUNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXR0ZXIuY2FtZXJhID0gdGhpcy5lbWl0dGVyLnNjZW5lLl9hY3RpdmVDYW1lcmE7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5vbkNoYW5nZUNhbWVyYSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGJ5IEVkaXRvciBpZiBydW5uaW5nIGluc2lkZSBlZGl0b3JcbiAgICAgICAgICAgIGNvbnN0IGluVG9vbHMgPSB0aGlzLmVtaXR0ZXIuaW5Ub29scztcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NpbmdPcHRpb25zID0gbmV3IFNoYWRlclByb2Nlc3Nvck9wdGlvbnModmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuXG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSBwcm9ncmFtTGliLmdldFByb2dyYW0oJ3BhcnRpY2xlJywge1xuICAgICAgICAgICAgICAgIHVzZUNwdTogdGhpcy5lbWl0dGVyLnVzZUNwdSxcbiAgICAgICAgICAgICAgICBub3JtYWw6IHRoaXMuZW1pdHRlci5ub3JtYWxPcHRpb24sXG4gICAgICAgICAgICAgICAgaGFsZmxhbWJlcnQ6IHRoaXMuZW1pdHRlci5oYWxmTGFtYmVydCxcbiAgICAgICAgICAgICAgICBzdHJldGNoOiB0aGlzLmVtaXR0ZXIuc3RyZXRjaCxcbiAgICAgICAgICAgICAgICBhbGlnblRvTW90aW9uOiB0aGlzLmVtaXR0ZXIuYWxpZ25Ub01vdGlvbixcbiAgICAgICAgICAgICAgICBzb2Z0OiB0aGlzLmVtaXR0ZXIuZGVwdGhTb2Z0ZW5pbmcsXG4gICAgICAgICAgICAgICAgbWVzaDogdGhpcy5lbWl0dGVyLnVzZU1lc2gsXG4gICAgICAgICAgICAgICAgZ2FtbWE6IHRoaXMuZW1pdHRlci5zY2VuZSA/IHRoaXMuZW1pdHRlci5zY2VuZS5nYW1tYUNvcnJlY3Rpb24gOiAwLFxuICAgICAgICAgICAgICAgIHRvbmVNYXA6IHRoaXMuZW1pdHRlci5zY2VuZSA/IHRoaXMuZW1pdHRlci5zY2VuZS50b25lTWFwcGluZyA6IDAsXG4gICAgICAgICAgICAgICAgZm9nOiAodGhpcy5lbWl0dGVyLnNjZW5lICYmICF0aGlzLmVtaXR0ZXIubm9Gb2cpID8gdGhpcy5lbWl0dGVyLnNjZW5lLmZvZyA6ICdub25lJyxcbiAgICAgICAgICAgICAgICB3cmFwOiB0aGlzLmVtaXR0ZXIud3JhcCAmJiB0aGlzLmVtaXR0ZXIud3JhcEJvdW5kcyxcbiAgICAgICAgICAgICAgICBsb2NhbFNwYWNlOiB0aGlzLmVtaXR0ZXIubG9jYWxTcGFjZSxcblxuICAgICAgICAgICAgICAgIC8vIGluIEVkaXRvciwgc2NyZWVuIHNwYWNlIHBhcnRpY2xlcyAoY2hpbGRyZW4gb2YgMkQgU2NyZWVuKSBhcmUgc3RpbGwgcmVuZGVyZWQgaW4gM2Qgc3BhY2VcbiAgICAgICAgICAgICAgICBzY3JlZW5TcGFjZTogaW5Ub29scyA/IGZhbHNlIDogdGhpcy5lbWl0dGVyLnNjcmVlblNwYWNlLFxuXG4gICAgICAgICAgICAgICAgYmxlbmQ6IHRoaXMuYmxlbmRUeXBlLFxuICAgICAgICAgICAgICAgIGFuaW1UZXg6IHRoaXMuZW1pdHRlci5faXNBbmltYXRlZCgpLFxuICAgICAgICAgICAgICAgIGFuaW1UZXhMb29wOiB0aGlzLmVtaXR0ZXIuYW5pbUxvb3AsXG4gICAgICAgICAgICAgICAgcGFjazg6IHRoaXMuZW1pdHRlci5wYWNrOCxcbiAgICAgICAgICAgICAgICBjdXN0b21GYWNlOiB0aGlzLmVtaXR0ZXIub3JpZW50YXRpb24gIT09IFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOXG4gICAgICAgICAgICB9LCBwcm9jZXNzaW5nT3B0aW9ucyk7XG5cbiAgICAgICAgICAgIHJldHVybiBzaGFkZXI7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2hhZGVyID0gdGhpcy5tYXRlcmlhbC5nZXRTaGFkZXJWYXJpYW50KCk7XG4gICAgfVxuXG4gICAgcmVzZXRNYXRlcmlhbCgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsO1xuXG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignc3RyZXRjaCcsIHRoaXMuc3RyZXRjaCk7XG4gICAgICAgIGlmICh0aGlzLl9pc0FuaW1hdGVkKCkpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignYW5pbVRleFRpbGVzUGFyYW1zJywgdGhpcy5hbmltVGlsZXNQYXJhbXMpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdhbmltVGV4UGFyYW1zJywgdGhpcy5hbmltUGFyYW1zKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignYW5pbVRleEluZGV4UGFyYW1zJywgdGhpcy5hbmltSW5kZXhQYXJhbXMpO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignY29sb3JNdWx0JywgdGhpcy5pbnRlbnNpdHkpO1xuICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ludGVybmFsVGV4MCcsIHRoaXMuaW50ZXJuYWxUZXgwKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW50ZXJuYWxUZXgxJywgdGhpcy5pbnRlcm5hbFRleDEpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbnRlcm5hbFRleDInLCB0aGlzLmludGVybmFsVGV4Mik7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ludGVybmFsVGV4MycsIHRoaXMuaW50ZXJuYWxUZXgzKTtcbiAgICAgICAgfVxuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2NvbG9yUGFyYW0nLCB0aGlzLmNvbG9yUGFyYW0pO1xuXG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbnVtUGFydGljbGVzJywgdGhpcy5udW1QYXJ0aWNsZXMpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ251bVBhcnRpY2xlc1BvdCcsIHRoaXMubnVtUGFydGljbGVzUG90KTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdsaWZldGltZScsIHRoaXMubGlmZXRpbWUpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3JhdGUnLCB0aGlzLnJhdGUpO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3JhdGVEaXYnLCB0aGlzLnJhdGUyIC0gdGhpcy5yYXRlKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdzZWVkJywgdGhpcy5zZWVkKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdzY2FsZURpdk11bHQnLCB0aGlzLnNjYWxlVU1heFswXSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignYWxwaGFEaXZNdWx0JywgdGhpcy5hbHBoYVVNYXhbMF0pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3JhZGlhbFNwZWVkRGl2TXVsdCcsIHRoaXMucmFkaWFsU3BlZWRVTWF4WzBdKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdncmFwaE51bVNhbXBsZXMnLCB0aGlzLnByZWNpc2lvbik7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZ3JhcGhTYW1wbGVTaXplJywgMS4wIC8gdGhpcy5wcmVjaXNpb24pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2VtaXR0ZXJTY2FsZScsIG5ldyBGbG9hdDMyQXJyYXkoWzEsIDEsIDFdKSk7XG5cbiAgICAgICAgaWYgKHRoaXMucGFjazgpIHtcbiAgICAgICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIuX3NldElucHV0Qm91bmRzKCk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2luQm91bmRzU2l6ZScsIHRoaXMuX2dwdVVwZGF0ZXIuaW5Cb3VuZHNTaXplVW5pZm9ybSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2luQm91bmRzQ2VudGVyJywgdGhpcy5fZ3B1VXBkYXRlci5pbkJvdW5kc0NlbnRlclVuaWZvcm0pO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdtYXhWZWwnLCB0aGlzLm1heFZlbCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53cmFwICYmIHRoaXMud3JhcEJvdW5kcykge1xuICAgICAgICAgICAgdGhpcy53cmFwQm91bmRzVW5pZm9ybVswXSA9IHRoaXMud3JhcEJvdW5kcy54O1xuICAgICAgICAgICAgdGhpcy53cmFwQm91bmRzVW5pZm9ybVsxXSA9IHRoaXMud3JhcEJvdW5kcy55O1xuICAgICAgICAgICAgdGhpcy53cmFwQm91bmRzVW5pZm9ybVsyXSA9IHRoaXMud3JhcEJvdW5kcy56O1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCd3cmFwQm91bmRzJywgdGhpcy53cmFwQm91bmRzVW5pZm9ybSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb2xvck1hcCkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdjb2xvck1hcCcsIHRoaXMuY29sb3JNYXApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbm9ybWFsTWFwJywgdGhpcy5ub3JtYWxNYXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmRlcHRoU29mdGVuaW5nID4gMCkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdzb2Z0ZW5pbmcnLCAxLjAgLyAodGhpcy5kZXB0aFNvZnRlbmluZyAqIHRoaXMuZGVwdGhTb2Z0ZW5pbmcgKiAxMDApKTsgLy8gcmVtYXAgdG8gbW9yZSBwZXJjZXB0dWFsbHkgbGluZWFyXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RyZXRjaCA+IDAuMCkgbWF0ZXJpYWwuY3VsbCA9IENVTExGQUNFX05PTkU7XG5cbiAgICAgICAgdGhpcy5fY29tcFBhcnRpY2xlRmFjZVBhcmFtcygpO1xuICAgIH1cblxuICAgIF9jb21wUGFydGljbGVGYWNlUGFyYW1zKCkge1xuICAgICAgICBsZXQgdGFuZ2VudCwgYmlub3JtYWw7XG4gICAgICAgIGlmICh0aGlzLm9yaWVudGF0aW9uID09PSBQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTikge1xuICAgICAgICAgICAgdGFuZ2VudCA9IG5ldyBGbG9hdDMyQXJyYXkoWzEsIDAsIDBdKTtcbiAgICAgICAgICAgIGJpbm9ybWFsID0gbmV3IEZsb2F0MzJBcnJheShbMCwgMCwgMV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IG47XG4gICAgICAgICAgICBpZiAodGhpcy5vcmllbnRhdGlvbiA9PT0gUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRCkge1xuICAgICAgICAgICAgICAgIG4gPSB0aGlzLnBhcnRpY2xlTm9ybWFsLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbWl0dGVyTWF0ID0gdGhpcy5ub2RlID09PSBudWxsID9cbiAgICAgICAgICAgICAgICAgICAgTWF0NC5JREVOVElUWSA6IHRoaXMubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgICAgIG4gPSBlbWl0dGVyTWF0LnRyYW5zZm9ybVZlY3Rvcih0aGlzLnBhcnRpY2xlTm9ybWFsKS5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHQgPSBuZXcgVmVjMygxLCAwLCAwKTtcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyh0LmRvdChuKSkgPT09IDEpXG4gICAgICAgICAgICAgICAgdC5zZXQoMCwgMCwgMSk7XG4gICAgICAgICAgICBjb25zdCBiID0gbmV3IFZlYzMoKS5jcm9zcyhuLCB0KS5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHQuY3Jvc3MoYiwgbikubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB0YW5nZW50ID0gbmV3IEZsb2F0MzJBcnJheShbdC54LCB0LnksIHQuel0pO1xuICAgICAgICAgICAgYmlub3JtYWwgPSBuZXcgRmxvYXQzMkFycmF5KFtiLngsIGIueSwgYi56XSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ZhY2VUYW5nZW50JywgdGFuZ2VudCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdmYWNlQmlub3JtJywgYmlub3JtYWwpO1xuICAgIH1cblxuICAgIC8vIERlY2xhcmVzIHZlcnRleCBmb3JtYXQsIGNyZWF0ZXMgVkIgYW5kIElCXG4gICAgX2FsbG9jYXRlKG51bVBhcnRpY2xlcykge1xuICAgICAgICBjb25zdCBwc3lzVmVydENvdW50ID0gbnVtUGFydGljbGVzICogdGhpcy5udW1QYXJ0aWNsZVZlcnRzO1xuICAgICAgICBjb25zdCBwc3lzSW5kZXhDb3VudCA9IG51bVBhcnRpY2xlcyAqIHRoaXMubnVtUGFydGljbGVJbmRpY2VzO1xuXG4gICAgICAgIGlmICgodGhpcy52ZXJ0ZXhCdWZmZXIgPT09IHVuZGVmaW5lZCkgfHwgKHRoaXMudmVydGV4QnVmZmVyLmdldE51bVZlcnRpY2VzKCkgIT09IHBzeXNWZXJ0Q291bnQpKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIHBhcnRpY2xlIHZlcnRleCBmb3JtYXRcbiAgICAgICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgICAgICAvLyBHUFU6IFhZWiA9IHF1YWQgdmVydGV4IHBvc2l0aW9uOyBXID0gSU5UOiBwYXJ0aWNsZSBJRCwgRlJBQzogcmFuZG9tIGZhY3RvclxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gW3tcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIwLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiA0LFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9XTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIxLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcGFydGljbGVGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIGVsZW1lbnRzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gbmV3IFZlcnRleEJ1ZmZlcih0aGlzLmdyYXBoaWNzRGV2aWNlLCBwYXJ0aWNsZUZvcm1hdCwgcHN5c1ZlcnRDb3VudCwgQlVGRkVSX0RZTkFNSUMpO1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIodGhpcy5ncmFwaGljc0RldmljZSwgSU5ERVhGT1JNQVRfVUlOVDE2LCBwc3lzSW5kZXhDb3VudCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gW3tcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIwLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiA0LFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogNCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjIsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIzLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiAxLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSNCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogdGhpcy51c2VNZXNoID8gNCA6IDIsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH1dO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRpY2xlRm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBlbGVtZW50cyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIodGhpcy5ncmFwaGljc0RldmljZSwgcGFydGljbGVGb3JtYXQsIHBzeXNWZXJ0Q291bnQsIEJVRkZFUl9EWU5BTUlDKTtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIElOREVYRk9STUFUX1VJTlQxNiwgcHN5c0luZGV4Q291bnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaWxsIHRoZSB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLnZlcnRleEJ1ZmZlci5sb2NrKCkpO1xuICAgICAgICAgICAgbGV0IG1lc2hEYXRhLCBzdHJpZGUsIHRleENvb3JkT2Zmc2V0O1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgIG1lc2hEYXRhID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm1lc2gudmVydGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICAgICAgc3RyaWRlID0gbWVzaERhdGEubGVuZ3RoIC8gdGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBlbGVtID0gMDsgZWxlbSA8IHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgZWxlbSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tlbGVtXS5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleENvb3JkT2Zmc2V0ID0gdGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbZWxlbV0ub2Zmc2V0IC8gNDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBzeXNWZXJ0Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gTWF0aC5mbG9vcihpIC8gdGhpcy5udW1QYXJ0aWNsZVZlcnRzKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0SUQgPSBpICUgNDtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNF0gPSBwYXJ0aWNsZVZlcnRzW3ZlcnRJRF1bMF07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDQgKyAxXSA9IHBhcnRpY2xlVmVydHNbdmVydElEXVsxXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNCArIDJdID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNCArIDNdID0gaWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVydCA9IGkgJSB0aGlzLm51bVBhcnRpY2xlVmVydHM7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDZdID0gbWVzaERhdGFbdmVydCAqIHN0cmlkZV07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyAxXSA9IG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGUgKyAxXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDJdID0gbWVzaERhdGFbdmVydCAqIHN0cmlkZSArIDJdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgM10gPSBpZDtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDRdID0gbWVzaERhdGFbdmVydCAqIHN0cmlkZSArIHRleENvb3JkT2Zmc2V0ICsgMF07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyA1XSA9IDEuMCAtIG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGUgKyB0ZXhDb29yZE9mZnNldCArIDFdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICAgICAgdGhpcy52YkNQVSA9IG5ldyBGbG9hdDMyQXJyYXkoZGF0YSk7XG4gICAgICAgICAgICAgICAgdGhpcy52Yk9sZCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy52YkNQVS5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNoLnZlcnRleEJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRmlsbCB0aGUgaW5kZXggYnVmZmVyXG4gICAgICAgICAgICBsZXQgZHN0ID0gMDtcbiAgICAgICAgICAgIGNvbnN0IGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkodGhpcy5pbmRleEJ1ZmZlci5sb2NrKCkpO1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkgbWVzaERhdGEgPSBuZXcgVWludDE2QXJyYXkodGhpcy5tZXNoLmluZGV4QnVmZmVyWzBdLmxvY2soKSk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVBhcnRpY2xlczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFzZUluZGV4ID0gaSAqIDQ7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleCArIDE7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4ICsgMjtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4ICsgMjtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXggKyAzO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5udW1QYXJ0aWNsZUluZGljZXM7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tpICogdGhpcy5udW1QYXJ0aWNsZUluZGljZXMgKyBqXSA9IG1lc2hEYXRhW2pdICsgaSAqIHRoaXMubnVtUGFydGljbGVWZXJ0cztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VNZXNoKSB0aGlzLm1lc2guaW5kZXhCdWZmZXJbMF0udW5sb2NrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXNldCgpIHtcbiAgICAgICAgdGhpcy5iZWVuUmVzZXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnNlZWQgPSBNYXRoLnJhbmRvbSgpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignc2VlZCcsIHRoaXMuc2VlZCk7XG4gICAgICAgIGlmICh0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4W2ldID0gdGhpcy5wYXJ0aWNsZVRleFN0YXJ0W2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faW5pdGlhbGl6ZVRleHR1cmVzKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZXNldFdvcmxkQm91bmRzKCk7XG4gICAgICAgIHRoaXMucmVzZXRUaW1lKCk7XG4gICAgICAgIGNvbnN0IG9yaWdMb29wID0gdGhpcy5sb29wO1xuICAgICAgICB0aGlzLmxvb3AgPSB0cnVlO1xuICAgICAgICB0aGlzLmFkZFRpbWUoMCwgZmFsc2UpO1xuICAgICAgICB0aGlzLmxvb3AgPSBvcmlnTG9vcDtcbiAgICAgICAgaWYgKHRoaXMucHJlV2FybSkge1xuICAgICAgICAgICAgdGhpcy5wcmV3YXJtKHRoaXMubGlmZXRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJld2FybSh0aW1lKSB7XG4gICAgICAgIGNvbnN0IGxpZmV0aW1lRnJhY3Rpb24gPSB0aW1lIC8gdGhpcy5saWZldGltZTtcbiAgICAgICAgY29uc3QgaXRlcmF0aW9ucyA9IE1hdGgubWluKE1hdGguZmxvb3IobGlmZXRpbWVGcmFjdGlvbiAqIHRoaXMucHJlY2lzaW9uKSwgdGhpcy5wcmVjaXNpb24pO1xuICAgICAgICBjb25zdCBzdGVwRGVsdGEgPSB0aW1lIC8gaXRlcmF0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVyYXRpb25zOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVGltZShzdGVwRGVsdGEsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc2V0VGltZSgpIHtcbiAgICAgICAgdGhpcy5lbmRUaW1lID0gY2FsY0VuZFRpbWUodGhpcyk7XG4gICAgfVxuXG4gICAgZmluaXNoRnJhbWUoKSB7XG4gICAgICAgIGlmICh0aGlzLnVzZUNwdSkgdGhpcy52ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgfVxuXG4gICAgYWRkVGltZShkZWx0YSwgaXNPblN0b3ApIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLnNpbVRpbWVUb3RhbCArPSBkZWx0YTtcblxuICAgICAgICB0aGlzLmNhbGN1bGF0ZVdvcmxkQm91bmRzKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2lzQW5pbWF0ZWQoKSkge1xuICAgICAgICAgICAgY29uc3QgdGlsZXNQYXJhbXMgPSB0aGlzLmFuaW1UaWxlc1BhcmFtcztcbiAgICAgICAgICAgIHRpbGVzUGFyYW1zWzBdID0gMS4wIC8gdGhpcy5hbmltVGlsZXNYOyAvLyBhbmltVGV4VGlsZXNQYXJhbXMueFxuICAgICAgICAgICAgdGlsZXNQYXJhbXNbMV0gPSAxLjAgLyB0aGlzLmFuaW1UaWxlc1k7IC8vIGFuaW1UZXhUaWxlc1BhcmFtcy55XG5cbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHRoaXMuYW5pbVBhcmFtcztcbiAgICAgICAgICAgIHBhcmFtc1swXSA9IHRoaXMuYW5pbVN0YXJ0RnJhbWU7IC8vIGFuaW1UZXhQYXJhbXMueFxuICAgICAgICAgICAgcGFyYW1zWzFdID0gdGhpcy5hbmltTnVtRnJhbWVzICogdGhpcy5hbmltU3BlZWQ7IC8vIGFuaW1UZXhQYXJhbXMueVxuICAgICAgICAgICAgcGFyYW1zWzJdID0gdGhpcy5hbmltTnVtRnJhbWVzIC0gMTsgLy8gYW5pbVRleFBhcmFtcy56XG4gICAgICAgICAgICBwYXJhbXNbM10gPSB0aGlzLmFuaW1OdW1BbmltYXRpb25zIC0gMTsgLy8gYW5pbVRleFBhcmFtcy53XG5cbiAgICAgICAgICAgIGNvbnN0IGFuaW1JbmRleFBhcmFtcyA9IHRoaXMuYW5pbUluZGV4UGFyYW1zO1xuICAgICAgICAgICAgYW5pbUluZGV4UGFyYW1zWzBdID0gdGhpcy5hbmltSW5kZXg7IC8vIGFuaW1UZXhJbmRleFBhcmFtcy54XG4gICAgICAgICAgICBhbmltSW5kZXhQYXJhbXNbMV0gPSB0aGlzLnJhbmRvbWl6ZUFuaW1JbmRleDsgLy8gYW5pbVRleEluZGV4UGFyYW1zLnlcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNjZW5lKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jYW1lcmEgIT09IHRoaXMuc2NlbmUuX2FjdGl2ZUNhbWVyYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FtZXJhID0gdGhpcy5zY2VuZS5fYWN0aXZlQ2FtZXJhO1xuICAgICAgICAgICAgICAgIHRoaXMub25DaGFuZ2VDYW1lcmEoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCkge1xuICAgICAgICAgICAgZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtWzBdID0gdGhpcy5lbWl0dGVyRXh0ZW50cy54ICE9PSAwID8gdGhpcy5lbWl0dGVyRXh0ZW50c0lubmVyLnggLyB0aGlzLmVtaXR0ZXJFeHRlbnRzLnggOiAwO1xuICAgICAgICAgICAgZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtWzFdID0gdGhpcy5lbWl0dGVyRXh0ZW50cy55ICE9PSAwID8gdGhpcy5lbWl0dGVyRXh0ZW50c0lubmVyLnkgLyB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgOiAwO1xuICAgICAgICAgICAgZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtWzJdID0gdGhpcy5lbWl0dGVyRXh0ZW50cy56ICE9PSAwID8gdGhpcy5lbWl0dGVyRXh0ZW50c0lubmVyLnogLyB0aGlzLmVtaXR0ZXJFeHRlbnRzLnogOiAwO1xuICAgICAgICAgICAgaWYgKHRoaXMubWVzaEluc3RhbmNlLm5vZGUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBzcGF3bk1hdHJpeC5zZXRUUlMoVmVjMy5aRVJPLCBRdWF0LklERU5USVRZLCB0aGlzLmVtaXR0ZXJFeHRlbnRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgdGhpcy5tZXNoSW5zdGFuY2Uubm9kZS5nZXRSb3RhdGlvbigpLCB0bXBWZWMzLmNvcHkodGhpcy5lbWl0dGVyRXh0ZW50cykubXVsKHRoaXMubWVzaEluc3RhbmNlLm5vZGUubG9jYWxTY2FsZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGVtaXR0ZXJQb3M7XG4gICAgICAgIGNvbnN0IGVtaXR0ZXJTY2FsZSA9IHRoaXMubWVzaEluc3RhbmNlLm5vZGUgPT09IG51bGwgPyBWZWMzLk9ORSA6IHRoaXMubWVzaEluc3RhbmNlLm5vZGUubG9jYWxTY2FsZTtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtWzBdID0gZW1pdHRlclNjYWxlLng7XG4gICAgICAgIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybVsxXSA9IGVtaXR0ZXJTY2FsZS55O1xuICAgICAgICB0aGlzLmVtaXR0ZXJTY2FsZVVuaWZvcm1bMl0gPSBlbWl0dGVyU2NhbGUuejtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2VtaXR0ZXJTY2FsZScsIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybSk7XG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UgJiYgdGhpcy5tZXNoSW5zdGFuY2Uubm9kZSkge1xuICAgICAgICAgICAgZW1pdHRlclBvcyA9IHRoaXMubWVzaEluc3RhbmNlLm5vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm1bMF0gPSBlbWl0dGVyUG9zLng7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtWzFdID0gZW1pdHRlclBvcy55O1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyUG9zVW5pZm9ybVsyXSA9IGVtaXR0ZXJQb3MuejtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdlbWl0dGVyUG9zJywgdGhpcy5lbWl0dGVyUG9zVW5pZm9ybSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jb21wUGFydGljbGVGYWNlUGFyYW1zKCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgdGhpcy5fZ3B1VXBkYXRlci51cGRhdGUoZGV2aWNlLCBzcGF3bk1hdHJpeCwgZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtLCBkZWx0YSwgaXNPblN0b3ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXIubG9jaygpKTtcbiAgICAgICAgICAgIHRoaXMuX2NwdVVwZGF0ZXIudXBkYXRlKGRhdGEsIHRoaXMudmJUb1NvcnQsIHRoaXMucGFydGljbGVUZXgsIHNwYXduTWF0cml4LCBleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0sIGVtaXR0ZXJQb3MsIGRlbHRhLCBpc09uU3RvcCk7XG4gICAgICAgICAgICAvLyB0aGlzLnZlcnRleEJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5sb29wKSB7XG4gICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSA+IHRoaXMuZW5kVGltZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9uRmluaXNoZWQpIHRoaXMub25GaW5pc2hlZCgpO1xuICAgICAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm1lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5kcmF3T3JkZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2FkZFRpbWVUaW1lICs9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBfZGVzdHJveVJlc291cmNlcygpIHtcbiAgICAgICAgaWYgKHRoaXMucGFydGljbGVUZXhJTikge1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleElOLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wYXJ0aWNsZVRleE9VVCkge1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleE9VVC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VUID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnBhcnRpY2xlVGV4U3RhcnQgJiYgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0LmRlc3Ryb3kpIHtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucnRQYXJ0aWNsZVRleElOKSB7XG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhJTi5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhJTiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5ydFBhcnRpY2xlVGV4T1VUKSB7XG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhPVVQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4T1VUID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmludGVybmFsVGV4MCkge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDAuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJuYWxUZXgxKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbnRlcm5hbFRleDIpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmludGVybmFsVGV4Mykge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29sb3JQYXJhbSkge1xuICAgICAgICAgICAgdGhpcy5jb2xvclBhcmFtLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuY29sb3JQYXJhbSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gdW5kZWZpbmVkOyAvLyB3ZSBhcmUgdGVzdGluZyBpZiB2YiBpcyB1bmRlZmluZWQgaW4gc29tZSBjb2RlLCBubyBpZGVhIHdoeVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm90ZTogc2hhZGVycyBzaG91bGQgbm90IGJlIGRlc3Ryb3llZCBhcyB0aGV5IGNvdWxkIGJlIHNoYXJlZCBiZXR3ZWVuIGVtaXR0ZXJzXG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5jYW1lcmEgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lSZXNvdXJjZXMoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9O1xuIl0sIm5hbWVzIjpbInBhcnRpY2xlVmVydHMiLCJfY3JlYXRlVGV4dHVyZSIsImRldmljZSIsIndpZHRoIiwiaGVpZ2h0IiwicGl4ZWxEYXRhIiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIm11bHQ4Qml0IiwiZmlsdGVyIiwibWlwRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIkZJTFRFUl9MSU5FQVIiLCJ0ZXh0dXJlIiwiVGV4dHVyZSIsImN1YmVtYXAiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsIm5hbWUiLCJwaXhlbHMiLCJsb2NrIiwidGVtcCIsIlVpbnQ4QXJyYXkiLCJsZW5ndGgiLCJpIiwic2V0IiwidW5sb2NrIiwic2F0dXJhdGUiLCJ4IiwiTWF0aCIsIm1heCIsIm1pbiIsImRlZmF1bHQwQ3VydmUiLCJDdXJ2ZSIsImRlZmF1bHQxQ3VydmUiLCJkZWZhdWx0MEN1cnZlMyIsIkN1cnZlU2V0IiwiZGVmYXVsdDFDdXJ2ZTMiLCJwYXJ0aWNsZVRleEhlaWdodCIsInBhcnRpY2xlVGV4Q2hhbm5lbHMiLCJleHRlbnRzSW5uZXJSYXRpb1VuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJzcGF3bk1hdHJpeCIsIk1hdDQiLCJ0bXBWZWMzIiwiVmVjMyIsImJNaW4iLCJiTWF4Iiwic2V0UHJvcGVydHlUYXJnZXQiLCJzZXRQcm9wZXJ0eU9wdGlvbnMiLCJzZXRQcm9wZXJ0eSIsInBOYW1lIiwiZGVmYXVsdFZhbCIsInVuZGVmaW5lZCIsInBhY2szTkZsb2F0cyIsImEiLCJiIiwiYyIsInBhY2tlZCIsInBhY2tUZXh0dXJlWFlaX05YWVoiLCJxWFlaIiwicVhZWjIiLCJudW0iLCJjb2xvcnMiLCJBcnJheSIsInBhY2tUZXh0dXJlUkdCQSIsInFSR0IiLCJxQSIsInBhY2tUZXh0dXJlNUZsb2F0cyIsInFCIiwicUMiLCJxRCIsInFFIiwicGFja1RleHR1cmUyRmxvYXRzIiwiY2FsY0VuZFRpbWUiLCJlbWl0dGVyIiwiaW50ZXJ2YWwiLCJyYXRlIiwicmF0ZTIiLCJudW1QYXJ0aWNsZXMiLCJsaWZldGltZSIsIkRhdGUiLCJub3ciLCJzdWJHcmFwaCIsIkEiLCJCIiwiciIsIm1heFVuc2lnbmVkR3JhcGhWYWx1ZSIsIm91dFVNYXgiLCJjaGFucyIsInZhbHVlcyIsImoiLCJhYnMiLCJub3JtYWxpemVHcmFwaCIsInVNYXgiLCJkaXZHcmFwaEZyb20yQ3VydmVzIiwiY3VydmUxIiwiY3VydmUyIiwic3ViIiwicGFydGljbGVFbWl0dGVyRGV2aWNlQ2FjaGUiLCJEZXZpY2VDYWNoZSIsIlBhcnRpY2xlRW1pdHRlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJvcHRpb25zIiwiZ2QiLCJwcmVjaXNpb24iLCJfYWRkVGltZVRpbWUiLCJtYXhUZXh0dXJlU2l6ZSIsIkRlYnVnIiwid2FybiIsIkVNSVRURVJTSEFQRV9CT1giLCJkZWZhdWx0UGFyYW1UZXh0dXJlIiwiUEFSVElDTEVTT1JUX05PTkUiLCJQQVJUSUNMRU1PREVfR1BVIiwiUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4iLCJCTEVORF9OT1JNQUwiLCJzdGFydEFuZ2xlIiwiX2dwdVVwZGF0ZXIiLCJQYXJ0aWNsZUdQVVVwZGF0ZXIiLCJfY3B1VXBkYXRlciIsIlBhcnRpY2xlQ1BVVXBkYXRlciIsImNvbnN0YW50TGlnaHRDdWJlIiwic2NvcGUiLCJyZXNvbHZlIiwiZW1pdHRlclBvc1VuaWZvcm0iLCJ3cmFwQm91bmRzVW5pZm9ybSIsImVtaXR0ZXJTY2FsZVVuaWZvcm0iLCJjb2xvckdyYXBoIiwic2NhbGVHcmFwaCIsImFscGhhR3JhcGgiLCJsb2NhbFZlbG9jaXR5R3JhcGgiLCJ2ZWxvY2l0eUdyYXBoIiwicm90YXRpb25TcGVlZEdyYXBoIiwicmFkaWFsU3BlZWRHcmFwaCIsImxpZ2h0Q3ViZSIsImxpZ2h0Q3ViZURpciIsImFuaW1UaWxlc1BhcmFtcyIsImFuaW1QYXJhbXMiLCJhbmltSW5kZXhQYXJhbXMiLCJpbnRlcm5hbFRleDAiLCJpbnRlcm5hbFRleDEiLCJpbnRlcm5hbFRleDIiLCJjb2xvclBhcmFtIiwidmJUb1NvcnQiLCJ2Yk9sZCIsInBhcnRpY2xlRGlzdGFuY2UiLCJjYW1lcmEiLCJzd2FwVGV4IiwidXNlTWVzaCIsInVzZUNwdSIsInN1cHBvcnRzR3B1UGFydGljbGVzIiwicGFjazgiLCJsb2NhbEJvdW5kcyIsIkJvdW5kaW5nQm94Iiwid29ybGRCb3VuZHNOb1RyYWlsIiwid29ybGRCb3VuZHNUcmFpbCIsIndvcmxkQm91bmRzIiwid29ybGRCb3VuZHNTaXplIiwicHJldldvcmxkQm91bmRzU2l6ZSIsInByZXZXb3JsZEJvdW5kc0NlbnRlciIsInByZXZFbWl0dGVyRXh0ZW50cyIsImVtaXR0ZXJFeHRlbnRzIiwicHJldkVtaXR0ZXJSYWRpdXMiLCJlbWl0dGVyUmFkaXVzIiwid29ybGRCb3VuZHNNdWwiLCJ3b3JsZEJvdW5kc0FkZCIsInRpbWVUb1N3aXRjaEJvdW5kcyIsInNoYWRlclBhcnRpY2xlVXBkYXRlUmVzcGF3biIsInNoYWRlclBhcnRpY2xlVXBkYXRlTm9SZXNwYXduIiwic2hhZGVyUGFydGljbGVVcGRhdGVPblN0b3AiLCJudW1QYXJ0aWNsZVZlcnRzIiwibnVtUGFydGljbGVJbmRpY2VzIiwibWF0ZXJpYWwiLCJtZXNoSW5zdGFuY2UiLCJkcmF3T3JkZXIiLCJzZWVkIiwicmFuZG9tIiwiZml4ZWRUaW1lU3RlcCIsIm1heFN1YlN0ZXBzIiwic2ltVGltZSIsInNpbVRpbWVUb3RhbCIsImJlZW5SZXNldCIsIl9sYXllciIsInJlYnVpbGQiLCJhc3NlcnQiLCJnZXQiLCJyZXNvbHV0aW9uIiwiY2VudGVyUG9pbnQiLCJkdGV4IiwieSIsInhncmFkIiwieWdyYWQiLCJzcXJ0IiwicCIsIm9uQ2hhbmdlQ2FtZXJhIiwicmVnZW5TaGFkZXIiLCJyZXNldE1hdGVyaWFsIiwiY2FsY3VsYXRlQm91bmRzTWFkIiwieiIsImNvcHkiLCJjZW50ZXIiLCJtdWwiLCJtdWxTY2FsYXIiLCJjYWxjdWxhdGVXb3JsZEJvdW5kcyIsIm5vZGUiLCJyZWNhbGN1bGF0ZUxvY2FsQm91bmRzIiwiZW1pdHRlclNoYXBlIiwiZXF1YWxzIiwiY2FsY3VsYXRlTG9jYWxCb3VuZHMiLCJub2RlV1QiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImxvY2FsU3BhY2UiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwiYWRkIiwiaGFsZkV4dGVudHMiLCJhYWJiIiwibWVzaCIsIl9hYWJiVmVyIiwicmVzZXRXb3JsZEJvdW5kcyIsIklERU5USVRZIiwibWlueCIsIk51bWJlciIsIk1BWF9WQUxVRSIsIm1pbnkiLCJtaW56IiwibWF4eCIsIm1heHkiLCJtYXh6IiwibWF4UiIsIm1heFNjYWxlIiwic3RlcFdlaWdodCIsIndWZWxzIiwicVZlbG9jaXR5IiwicVZlbG9jaXR5MiIsImxWZWxzIiwicUxvY2FsVmVsb2NpdHkiLCJxTG9jYWxWZWxvY2l0eTIiLCJhY2N1bVgiLCJhY2N1bVkiLCJhY2N1bVoiLCJhY2N1bVIiLCJhY2N1bVciLCJpbmRleCIsInFSYWRpYWxTcGVlZCIsInFSYWRpYWxTcGVlZDIiLCJxU2NhbGUiLCJ3Iiwic2V0TWluTWF4IiwiY29sb3JNYXAiLCJzcGF3bkJvdW5kcyIsInNvcnQiLCJtYXhWZXJ0ZXhUZXh0dXJlcyIsImZyYWdtZW50VW5pZm9ybXNDb3VudCIsImZvcmNlQ3B1UGFydGljbGVzIiwiZXh0VGV4dHVyZUZsb2F0IiwiX2Rlc3Ryb3lSZXNvdXJjZXMiLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwidG90YWxWZXJ0Q291bnQiLCJ2ZXJ0ZXhCdWZmZXIiLCJudW1WZXJ0aWNlcyIsIm51bVBhcnRpY2xlc1BvdCIsIm1hdGgiLCJuZXh0UG93ZXJPZlR3byIsInJlYnVpbGRHcmFwaHMiLCJpU29ydCIsInJhbmRvbWl6ZSIsInBhcnRpY2xlVGV4IiwiZW1pdHRlclBvcyIsIlpFUk8iLCJnZXRQb3NpdGlvbiIsInNldFRSUyIsIlF1YXQiLCJnZXRSb3RhdGlvbiIsImxvY2FsU2NhbGUiLCJlbWl0dGVyRXh0ZW50c0lubmVyIiwiY2FsY1NwYXduUG9zaXRpb24iLCJwYXJ0aWNsZVRleFN0YXJ0IiwicGFydGljbGVUZXhJTiIsInBhcnRpY2xlVGV4T1VUIiwicnRQYXJ0aWNsZVRleElOIiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJkZXB0aCIsInJ0UGFydGljbGVUZXhPVVQiLCJzaGFkZXJDb2RlU3RhcnQiLCJzaGFkZXJDaHVua3MiLCJwYXJ0aWNsZVVwZGF0ZXJJbml0UFMiLCJwYXJ0aWNsZUlucHV0UmdiYThQUyIsInBhcnRpY2xlT3V0cHV0UmdiYThQUyIsInBhcnRpY2xlSW5wdXRGbG9hdFBTIiwicGFydGljbGVPdXRwdXRGbG9hdFBTIiwicGFydGljbGVVcGRhdGVyQUFCQlBTIiwicGFydGljbGVVcGRhdGVyU3BoZXJlUFMiLCJwYXJ0aWNsZVVwZGF0ZXJTdGFydFBTIiwic2hhZGVyQ29kZVJlc3Bhd24iLCJwYXJ0aWNsZVVwZGF0ZXJSZXNwYXduUFMiLCJwYXJ0aWNsZVVwZGF0ZXJFbmRQUyIsInNoYWRlckNvZGVOb1Jlc3Bhd24iLCJwYXJ0aWNsZVVwZGF0ZXJOb1Jlc3Bhd25QUyIsInNoYWRlckNvZGVPblN0b3AiLCJwYXJ0aWNsZVVwZGF0ZXJPblN0b3BQUyIsInBhcmFtcyIsImNyZWF0ZVNoYWRlckZyb21Db2RlIiwiZnVsbHNjcmVlblF1YWRWUyIsImluZGV4QnVmZmVyIiwibnVtSW5kaWNlcyIsIl9hbGxvY2F0ZSIsIk1lc2giLCJwcmltaXRpdmUiLCJ0eXBlIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsImJhc2UiLCJjb3VudCIsImluZGV4ZWQiLCJNYXRlcmlhbCIsImN1bGwiLCJDVUxMRkFDRV9OT05FIiwiYWxwaGFXcml0ZSIsImJsZW5kVHlwZSIsImRlcHRoV3JpdGUiLCJ3YXNWaXNpYmxlIiwidmlzaWJsZSIsIk1lc2hJbnN0YW5jZSIsInBpY2siLCJ1cGRhdGVLZXkiLCJfbm9EZXB0aERyYXdHbDEiLCJfdXBkYXRlQWFiYiIsIl9pbml0aWFsaXplVGV4dHVyZXMiLCJyZXNldFRpbWUiLCJhZGRUaW1lIiwicHJlV2FybSIsInByZXdhcm0iLCJfaXNBbmltYXRlZCIsImFuaW1OdW1GcmFtZXMiLCJhbmltVGlsZXNYIiwiYW5pbVRpbGVzWSIsIm5vcm1hbE1hcCIsInF1YW50aXplIiwicUNvbG9yIiwicXVhbnRpemVDbGFtcGVkIiwicVJvdFNwZWVkIiwicUFscGhhIiwibG9jYWxWZWxvY2l0eUdyYXBoMiIsInZlbG9jaXR5R3JhcGgyIiwicUNvbG9yMiIsImNvbG9yR3JhcGgyIiwicVJvdFNwZWVkMiIsInJvdGF0aW9uU3BlZWRHcmFwaDIiLCJxU2NhbGUyIiwic2NhbGVHcmFwaDIiLCJxQWxwaGEyIiwiYWxwaGFHcmFwaDIiLCJyYWRpYWxTcGVlZEdyYXBoMiIsIkRFR19UT19SQUQiLCJsb2NhbFZlbG9jaXR5VU1heCIsInZlbG9jaXR5VU1heCIsImNvbG9yVU1heCIsInJvdFNwZWVkVU1heCIsInNjYWxlVU1heCIsImFscGhhVU1heCIsInJhZGlhbFNwZWVkVU1heCIsInFMb2NhbFZlbG9jaXR5RGl2IiwicVZlbG9jaXR5RGl2IiwicUNvbG9yRGl2IiwicVJvdFNwZWVkRGl2IiwicVNjYWxlRGl2IiwicUFscGhhRGl2IiwicVJhZGlhbFNwZWVkRGl2IiwidW1heCIsInVtYXgyIiwibHVtYXgiLCJsdW1heDIiLCJydW1heCIsInJ1bWF4MiIsIm1heFZlbCIsImxtYXhWZWwiLCJtYXhSYWQiLCJpbnRlcm5hbFRleDMiLCJzZXRQYXJhbWV0ZXIiLCJsaWdodGluZyIsInByb2dyYW1MaWIiLCJnZXRQcm9ncmFtTGlicmFyeSIsInJlZ2lzdGVyIiwicGFydGljbGUiLCJoYXNOb3JtYWwiLCJub3JtYWxPcHRpb24iLCJnZXRTaGFkZXJWYXJpYW50IiwiZGV2Iiwic2MiLCJkZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsInNjZW5lIiwiX2FjdGl2ZUNhbWVyYSIsImluVG9vbHMiLCJwcm9jZXNzaW5nT3B0aW9ucyIsIlNoYWRlclByb2Nlc3Nvck9wdGlvbnMiLCJzaGFkZXIiLCJnZXRQcm9ncmFtIiwibm9ybWFsIiwiaGFsZmxhbWJlcnQiLCJoYWxmTGFtYmVydCIsInN0cmV0Y2giLCJhbGlnblRvTW90aW9uIiwic29mdCIsImRlcHRoU29mdGVuaW5nIiwiZ2FtbWEiLCJnYW1tYUNvcnJlY3Rpb24iLCJ0b25lTWFwIiwidG9uZU1hcHBpbmciLCJmb2ciLCJub0ZvZyIsIndyYXAiLCJ3cmFwQm91bmRzIiwic2NyZWVuU3BhY2UiLCJibGVuZCIsImFuaW1UZXgiLCJhbmltVGV4TG9vcCIsImFuaW1Mb29wIiwiY3VzdG9tRmFjZSIsIm9yaWVudGF0aW9uIiwiaW50ZW5zaXR5IiwiX3NldElucHV0Qm91bmRzIiwiaW5Cb3VuZHNTaXplVW5pZm9ybSIsImluQm91bmRzQ2VudGVyVW5pZm9ybSIsIl9jb21wUGFydGljbGVGYWNlUGFyYW1zIiwidGFuZ2VudCIsImJpbm9ybWFsIiwibiIsIlBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQiLCJwYXJ0aWNsZU5vcm1hbCIsIm5vcm1hbGl6ZSIsImVtaXR0ZXJNYXQiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJ0IiwiZG90IiwiY3Jvc3MiLCJwc3lzVmVydENvdW50IiwicHN5c0luZGV4Q291bnQiLCJnZXROdW1WZXJ0aWNlcyIsImVsZW1lbnRzIiwic2VtYW50aWMiLCJTRU1BTlRJQ19BVFRSMCIsImNvbXBvbmVudHMiLCJUWVBFX0ZMT0FUMzIiLCJwdXNoIiwiU0VNQU5USUNfQVRUUjEiLCJwYXJ0aWNsZUZvcm1hdCIsIlZlcnRleEZvcm1hdCIsIlZlcnRleEJ1ZmZlciIsIkJVRkZFUl9EWU5BTUlDIiwiSW5kZXhCdWZmZXIiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJTRU1BTlRJQ19BVFRSMiIsIlNFTUFOVElDX0FUVFIzIiwiU0VNQU5USUNfQVRUUjQiLCJkYXRhIiwibWVzaERhdGEiLCJzdHJpZGUiLCJ0ZXhDb29yZE9mZnNldCIsImVsZW0iLCJTRU1BTlRJQ19URVhDT09SRDAiLCJvZmZzZXQiLCJpZCIsImZsb29yIiwidmVydElEIiwidmVydCIsInZiQ1BVIiwiZHN0IiwiaW5kaWNlcyIsIlVpbnQxNkFycmF5IiwiYmFzZUluZGV4IiwicmVzZXQiLCJvcmlnTG9vcCIsImxvb3AiLCJ0aW1lIiwibGlmZXRpbWVGcmFjdGlvbiIsIml0ZXJhdGlvbnMiLCJzdGVwRGVsdGEiLCJlbmRUaW1lIiwiZmluaXNoRnJhbWUiLCJkZWx0YSIsImlzT25TdG9wIiwic3RhcnRUaW1lIiwidGlsZXNQYXJhbXMiLCJhbmltU3RhcnRGcmFtZSIsImFuaW1TcGVlZCIsImFuaW1OdW1BbmltYXRpb25zIiwiYW5pbUluZGV4IiwicmFuZG9taXplQW5pbUluZGV4IiwiZW1pdHRlclNjYWxlIiwiT05FIiwidXBkYXRlIiwib25GaW5pc2hlZCIsImRlc3Ryb3kiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQThDQSxNQUFNQSxhQUFhLEdBQUcsQ0FDbEIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUNSLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQ1AsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQ04sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FDVixDQUFBO0FBRUQsU0FBU0MsY0FBYyxDQUFDQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxFQUFFQyxTQUFTLEVBQUVDLE1BQU0sR0FBR0MsbUJBQW1CLEVBQUVDLFFBQVEsRUFBRUMsTUFBTSxFQUFFO0VBRXRHLElB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
