/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
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
    this.material.blend = true;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUtZW1pdHRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ3VydmUgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUuanMnO1xuaW1wb3J0IHsgQ3VydmVTZXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQlVGRkVSX0RZTkFNSUMsXG4gICAgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVCxcbiAgICBJTkRFWEZPUk1BVF9VSU5UMTYsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX1JHQkEzMkYsXG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMywgU0VNQU5USUNfQVRUUjQsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGV2aWNlLWNhY2hlLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IFNoYWRlclByb2Nlc3Nvck9wdGlvbnMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXItcHJvY2Vzc29yLW9wdGlvbnMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PUk1BTCxcbiAgICBFTUlUVEVSU0hBUEVfQk9YLFxuICAgIFBBUlRJQ0xFTU9ERV9HUFUsXG4gICAgUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4sIFBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQsXG4gICAgUEFSVElDTEVTT1JUX05PTkVcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi9tZXNoLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zaGFkZXItbGliL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuLi9zaGFkZXItbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBwYXJ0aWNsZSB9IGZyb20gJy4uL3NoYWRlci1saWIvcHJvZ3JhbXMvcGFydGljbGUuanMnO1xuaW1wb3J0IHsgUGFydGljbGVDUFVVcGRhdGVyIH0gZnJvbSAnLi9jcHUtdXBkYXRlci5qcyc7XG5pbXBvcnQgeyBQYXJ0aWNsZUdQVVVwZGF0ZXIgfSBmcm9tICcuL2dwdS11cGRhdGVyLmpzJztcblxuY29uc3QgcGFydGljbGVWZXJ0cyA9IFtcbiAgICBbLTEsIC0xXSxcbiAgICBbMSwgLTFdLFxuICAgIFsxLCAxXSxcbiAgICBbLTEsIDFdXG5dO1xuXG5mdW5jdGlvbiBfY3JlYXRlVGV4dHVyZShkZXZpY2UsIHdpZHRoLCBoZWlnaHQsIHBpeGVsRGF0YSwgZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTMyRiwgbXVsdDhCaXQsIGZpbHRlcikge1xuXG4gICAgbGV0IG1pcEZpbHRlciA9IEZJTFRFUl9ORUFSRVNUO1xuICAgIGlmIChmaWx0ZXIgJiYgZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOClcbiAgICAgICAgbWlwRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcblxuICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgIGN1YmVtYXA6IGZhbHNlLFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBtaXBGaWx0ZXIsXG4gICAgICAgIG1hZ0ZpbHRlcjogbWlwRmlsdGVyLFxuICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICBuYW1lOiAnUGFydGljbGVTeXN0ZW1UZXh0dXJlJ1xuICAgIH0pO1xuXG4gICAgY29uc3QgcGl4ZWxzID0gdGV4dHVyZS5sb2NrKCk7XG5cbiAgICBpZiAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCkge1xuICAgICAgICBjb25zdCB0ZW1wID0gbmV3IFVpbnQ4QXJyYXkocGl4ZWxEYXRhLmxlbmd0aCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGl4ZWxEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0ZW1wW2ldID0gcGl4ZWxEYXRhW2ldICogbXVsdDhCaXQgKiAyNTU7XG4gICAgICAgIH1cbiAgICAgICAgcGl4ZWxEYXRhID0gdGVtcDtcbiAgICB9XG5cbiAgICBwaXhlbHMuc2V0KHBpeGVsRGF0YSk7XG5cbiAgICB0ZXh0dXJlLnVubG9jaygpO1xuXG4gICAgcmV0dXJuIHRleHR1cmU7XG59XG5cbmZ1bmN0aW9uIHNhdHVyYXRlKHgpIHtcbiAgICByZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4oeCwgMSksIDApO1xufVxuXG5jb25zdCBkZWZhdWx0MEN1cnZlID0gbmV3IEN1cnZlKFswLCAwLCAxLCAwXSk7XG5jb25zdCBkZWZhdWx0MUN1cnZlID0gbmV3IEN1cnZlKFswLCAxLCAxLCAxXSk7XG5jb25zdCBkZWZhdWx0MEN1cnZlMyA9IG5ldyBDdXJ2ZVNldChbMCwgMCwgMSwgMF0sIFswLCAwLCAxLCAwXSwgWzAsIDAsIDEsIDBdKTtcbmNvbnN0IGRlZmF1bHQxQ3VydmUzID0gbmV3IEN1cnZlU2V0KFswLCAxLCAxLCAxXSwgWzAsIDEsIDEsIDFdLCBbMCwgMSwgMSwgMV0pO1xuXG5sZXQgcGFydGljbGVUZXhIZWlnaHQgPSAyO1xuY29uc3QgcGFydGljbGVUZXhDaGFubmVscyA9IDQ7IC8vIHRoZXJlIGlzIGEgZHVwbGljYXRlIGluIGNwdSB1cGRhdGVyXG5cbmNvbnN0IGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5jb25zdCBzcGF3bk1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbmNvbnN0IHRtcFZlYzMgPSBuZXcgVmVjMygpO1xuY29uc3QgYk1pbiA9IG5ldyBWZWMzKCk7XG5jb25zdCBiTWF4ID0gbmV3IFZlYzMoKTtcblxubGV0IHNldFByb3BlcnR5VGFyZ2V0O1xubGV0IHNldFByb3BlcnR5T3B0aW9ucztcblxuZnVuY3Rpb24gc2V0UHJvcGVydHkocE5hbWUsIGRlZmF1bHRWYWwpIHtcbiAgICBpZiAoc2V0UHJvcGVydHlPcHRpb25zW3BOYW1lXSAhPT0gdW5kZWZpbmVkICYmIHNldFByb3BlcnR5T3B0aW9uc1twTmFtZV0gIT09IG51bGwpIHtcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXRbcE5hbWVdID0gc2V0UHJvcGVydHlPcHRpb25zW3BOYW1lXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXRQcm9wZXJ0eVRhcmdldFtwTmFtZV0gPSBkZWZhdWx0VmFsO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFjazNORmxvYXRzKGEsIGIsIGMpIHtcbiAgICBjb25zdCBwYWNrZWQgPSAoKGEgKiAyNTUpIDw8IDE2KSB8ICgoYiAqIDI1NSkgPDwgOCkgfCAoYyAqIDI1NSk7XG4gICAgcmV0dXJuIChwYWNrZWQpIC8gKDEgPDwgMjQpO1xufVxuXG5mdW5jdGlvbiBwYWNrVGV4dHVyZVhZWl9OWFlaKHFYWVosIHFYWVoyKSB7XG4gICAgY29uc3QgbnVtID0gcVhZWi5sZW5ndGggLyAzO1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShudW0gKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bTsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxWFlaW2kgKiAzXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxWFlaW2kgKiAzICsgMV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gcVhZWltpICogMyArIDJdO1xuXG4gICAgICAgIGNvbG9yc1tpICogNCArIDNdID0gcGFjazNORmxvYXRzKHFYWVoyW2kgKiAzXSwgcVhZWjJbaSAqIDMgKyAxXSwgcVhZWjJbaSAqIDMgKyAyXSk7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlUkdCQShxUkdCLCBxQSkge1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShxQS5sZW5ndGggKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHFBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxUkdCW2kgKiAzXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxUkdCW2kgKiAzICsgMV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gcVJHQltpICogMyArIDJdO1xuXG4gICAgICAgIGNvbG9yc1tpICogNCArIDNdID0gcUFbaV07XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIHBhY2tUZXh0dXJlNUZsb2F0cyhxQSwgcUIsIHFDLCBxRCwgcUUpIHtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgQXJyYXkocUEubGVuZ3RoICogNCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxQS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2xvcnNbaSAqIDRdID0gcUFbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDFdID0gcUJbaV07XG4gICAgICAgIGNvbG9yc1tpICogNCArIDJdID0gMDtcblxuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IHBhY2szTkZsb2F0cyhxQ1tpXSwgcURbaV0sIHFFW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbG9ycztcbn1cblxuZnVuY3Rpb24gcGFja1RleHR1cmUyRmxvYXRzKHFBLCBxQikge1xuICAgIGNvbnN0IGNvbG9ycyA9IG5ldyBBcnJheShxQS5sZW5ndGggKiA0KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHFBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbG9yc1tpICogNF0gPSBxQVtpXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMV0gPSBxQltpXTtcbiAgICAgICAgY29sb3JzW2kgKiA0ICsgMl0gPSAwO1xuICAgICAgICBjb2xvcnNbaSAqIDQgKyAzXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiBjb2xvcnM7XG59XG5cbmZ1bmN0aW9uIGNhbGNFbmRUaW1lKGVtaXR0ZXIpIHtcbiAgICBjb25zdCBpbnRlcnZhbCA9IChNYXRoLm1heChlbWl0dGVyLnJhdGUsIGVtaXR0ZXIucmF0ZTIpICogZW1pdHRlci5udW1QYXJ0aWNsZXMgKyBlbWl0dGVyLmxpZmV0aW1lKTtcbiAgICByZXR1cm4gRGF0ZS5ub3coKSArIGludGVydmFsICogMTAwMDtcbn1cblxuZnVuY3Rpb24gc3ViR3JhcGgoQSwgQikge1xuICAgIGNvbnN0IHIgPSBuZXcgRmxvYXQzMkFycmF5KEEubGVuZ3RoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IEEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcltpXSA9IEFbaV0gLSBCW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcjtcbn1cblxuZnVuY3Rpb24gbWF4VW5zaWduZWRHcmFwaFZhbHVlKEEsIG91dFVNYXgpIHtcbiAgICBjb25zdCBjaGFucyA9IG91dFVNYXgubGVuZ3RoO1xuICAgIGNvbnN0IHZhbHVlcyA9IEEubGVuZ3RoIC8gY2hhbnM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXM7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNoYW5zOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGEgPSBNYXRoLmFicyhBW2kgKiBjaGFucyArIGpdKTtcbiAgICAgICAgICAgIG91dFVNYXhbal0gPSBNYXRoLm1heChvdXRVTWF4W2pdLCBhKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplR3JhcGgoQSwgdU1heCkge1xuICAgIGNvbnN0IGNoYW5zID0gdU1heC5sZW5ndGg7XG4gICAgY29uc3QgdmFsdWVzID0gQS5sZW5ndGggLyBjaGFucztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlczsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY2hhbnM7IGorKykge1xuICAgICAgICAgICAgQVtpICogY2hhbnMgKyBqXSAvPSAodU1heFtqXSA9PT0gMCA/IDEgOiB1TWF4W2pdKTtcbiAgICAgICAgICAgIEFbaSAqIGNoYW5zICsgal0gKj0gMC41O1xuICAgICAgICAgICAgQVtpICogY2hhbnMgKyBqXSArPSAwLjU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpdkdyYXBoRnJvbTJDdXJ2ZXMoY3VydmUxLCBjdXJ2ZTIsIG91dFVNYXgpIHtcbiAgICBjb25zdCBzdWIgPSBzdWJHcmFwaChjdXJ2ZTIsIGN1cnZlMSk7XG4gICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHN1Yiwgb3V0VU1heCk7XG4gICAgbm9ybWFsaXplR3JhcGgoc3ViLCBvdXRVTWF4KTtcbiAgICByZXR1cm4gc3ViO1xufVxuXG4vLyBhIGRldmljZSBjYWNoZSBzdG9yaW5nIGRlZmF1bHQgcGFyYW1ldGVyIHRleHR1cmUgZm9yIHRoZSBlbWl0dGVyXG5jb25zdCBwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jbGFzcyBQYXJ0aWNsZUVtaXR0ZXIge1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgZ2QgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgcHJlY2lzaW9uID0gMzI7XG4gICAgICAgIHRoaXMucHJlY2lzaW9uID0gcHJlY2lzaW9uO1xuXG4gICAgICAgIHRoaXMuX2FkZFRpbWVUaW1lID0gMDtcblxuICAgICAgICAvLyBHbG9iYWwgc3lzdGVtIHBhcmFtZXRlcnNcbiAgICAgICAgc2V0UHJvcGVydHlUYXJnZXQgPSB0aGlzO1xuICAgICAgICBzZXRQcm9wZXJ0eU9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnbnVtUGFydGljbGVzJywgMSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbW91bnQgb2YgcGFydGljbGVzIGFsbG9jYXRlZCAobWF4IHBhcnRpY2xlcyA9IG1heCBHTCB0ZXh0dXJlIHdpZHRoIGF0IHRoaXMgbW9tZW50KVxuXG4gICAgICAgIGlmICh0aGlzLm51bVBhcnRpY2xlcyA+IGdyYXBoaWNzRGV2aWNlLm1heFRleHR1cmVTaXplKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBXQVJOSU5HOiBjYW4ndCBjcmVhdGUgbW9yZSB0aGFuICR7Z3JhcGhpY3NEZXZpY2UubWF4VGV4dHVyZVNpemV9IHBhcnRpY2xlcyBvbiB0aGlzIGRldmljZS5gKTtcbiAgICAgICAgICAgIHRoaXMubnVtUGFydGljbGVzID0gZ3JhcGhpY3NEZXZpY2UubWF4VGV4dHVyZVNpemU7XG4gICAgICAgIH1cblxuICAgICAgICBzZXRQcm9wZXJ0eSgncmF0ZScsIDEpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBFbWlzc2lvbiByYXRlXG4gICAgICAgIHNldFByb3BlcnR5KCdyYXRlMicsIHRoaXMucmF0ZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsaWZldGltZScsIDUwKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBhcnRpY2xlIGxpZmV0aW1lXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyRXh0ZW50cycsIG5ldyBWZWMzKDAsIDAsIDApKTsgICAgICAgIC8vIFNwYXduIHBvaW50IGRpdmVyZ2VuY2VcbiAgICAgICAgc2V0UHJvcGVydHkoJ2VtaXR0ZXJFeHRlbnRzSW5uZXInLCBuZXcgVmVjMygwLCAwLCAwKSk7ICAgLy8gVm9sdW1lIGluc2lkZSBlbWl0dGVyRXh0ZW50cyB0byBleGNsdWRlIGZyb20gcmVnZW5lcmF0aW9uXG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyUmFkaXVzJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdlbWl0dGVyUmFkaXVzSW5uZXInLCAwKTsgICAgICAgICAgICAgICAgICAgICAgIC8vIFNhbWUgYXMgRXh0ZW50c0lubmVyIGJ1dCBmb3Igc3BoZXJpY2FsIHZvbHVtZVxuICAgICAgICBzZXRQcm9wZXJ0eSgnZW1pdHRlclNoYXBlJywgRU1JVFRFUlNIQVBFX0JPWCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdpbml0aWFsVmVsb2NpdHknLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3dyYXAnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFNwYWNlJywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnc2NyZWVuU3BhY2UnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCd3cmFwQm91bmRzJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvck1hcCcsIHRoaXMuZGVmYXVsdFBhcmFtVGV4dHVyZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub3JtYWxNYXAnLCBudWxsKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2xvb3AnLCB0cnVlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3ByZVdhcm0nLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzb3J0JywgUEFSVElDTEVTT1JUX05PTkUpOyAvLyBTb3J0aW5nIG1vZGU6IDAgPSBub25lLCAxID0gYnkgZGlzdGFuY2UsIDIgPSBieSBsaWZlLCAzID0gYnkgLWxpZmU7ICBGb3JjZXMgQ1BVIG1vZGUgaWYgbm90IDBcbiAgICAgICAgc2V0UHJvcGVydHkoJ21vZGUnLCBQQVJUSUNMRU1PREVfR1BVKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjZW5lJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsaWdodGluZycsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2hhbGZMYW1iZXJ0JywgZmFsc2UpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnaW50ZW5zaXR5JywgMS4wKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3N0cmV0Y2gnLCAwLjApO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxpZ25Ub01vdGlvbicsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2RlcHRoU29mdGVuaW5nJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdtZXNoJywgbnVsbCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWVzaCB0byBiZSB1c2VkIGFzIHBhcnRpY2xlLiBWZXJ0ZXggYnVmZmVyIGlzIHN1cHBvc2VkIHRvIGhvbGQgdmVydGV4IHBvc2l0aW9uIGluIGZpcnN0IDMgZmxvYXRzIG9mIGVhY2ggdmVydGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGVhdmUgdW5kZWZpbmVkIHRvIHVzZSBzaW1wbGUgcXVhZHNcbiAgICAgICAgc2V0UHJvcGVydHkoJ3BhcnRpY2xlTm9ybWFsJywgbmV3IFZlYzMoMCwgMSwgMCkpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnb3JpZW50YXRpb24nLCBQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTik7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2RlcHRoV3JpdGUnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub0ZvZycsIGZhbHNlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2JsZW5kVHlwZScsIEJMRU5EX05PUk1BTCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdub2RlJywgbnVsbCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdGFydEFuZ2xlJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdzdGFydEFuZ2xlMicsIHRoaXMuc3RhcnRBbmdsZSk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1UaWxlc1gnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1UaWxlc1knLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1TdGFydEZyYW1lJywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTnVtRnJhbWVzJywgMSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltTnVtQW5pbWF0aW9ucycsIDEpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYW5pbUluZGV4JywgMCk7XG4gICAgICAgIHNldFByb3BlcnR5KCdyYW5kb21pemVBbmltSW5kZXgnLCBmYWxzZSk7XG4gICAgICAgIHNldFByb3BlcnR5KCdhbmltU3BlZWQnLCAxKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ2FuaW1Mb29wJywgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5fZ3B1VXBkYXRlciA9IG5ldyBQYXJ0aWNsZUdQVVVwZGF0ZXIodGhpcywgZ2QpO1xuICAgICAgICB0aGlzLl9jcHVVcGRhdGVyID0gbmV3IFBhcnRpY2xlQ1BVVXBkYXRlcih0aGlzKTtcblxuICAgICAgICB0aGlzLmNvbnN0YW50TGlnaHRDdWJlID0gZ2Quc2NvcGUucmVzb2x2ZSgnbGlnaHRDdWJlWzBdJyk7XG4gICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLndyYXBCb3VuZHNVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pO1xuXG4gICAgICAgIC8vIFRpbWUtZGVwZW5kZW50IHBhcmFtZXRlcnNcbiAgICAgICAgc2V0UHJvcGVydHkoJ2NvbG9yR3JhcGgnLCBkZWZhdWx0MUN1cnZlMyk7XG4gICAgICAgIHNldFByb3BlcnR5KCdjb2xvckdyYXBoMicsIHRoaXMuY29sb3JHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjYWxlR3JhcGgnLCBkZWZhdWx0MUN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3NjYWxlR3JhcGgyJywgdGhpcy5zY2FsZUdyYXBoKTtcblxuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxwaGFHcmFwaCcsIGRlZmF1bHQxQ3VydmUpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgnYWxwaGFHcmFwaDInLCB0aGlzLmFscGhhR3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFZlbG9jaXR5R3JhcGgnLCBkZWZhdWx0MEN1cnZlMyk7XG4gICAgICAgIHNldFByb3BlcnR5KCdsb2NhbFZlbG9jaXR5R3JhcGgyJywgdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCd2ZWxvY2l0eUdyYXBoJywgZGVmYXVsdDBDdXJ2ZTMpO1xuICAgICAgICBzZXRQcm9wZXJ0eSgndmVsb2NpdHlHcmFwaDInLCB0aGlzLnZlbG9jaXR5R3JhcGgpO1xuXG4gICAgICAgIHNldFByb3BlcnR5KCdyb3RhdGlvblNwZWVkR3JhcGgnLCBkZWZhdWx0MEN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3JvdGF0aW9uU3BlZWRHcmFwaDInLCB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaCk7XG5cbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhZGlhbFNwZWVkR3JhcGgnLCBkZWZhdWx0MEN1cnZlKTtcbiAgICAgICAgc2V0UHJvcGVydHkoJ3JhZGlhbFNwZWVkR3JhcGgyJywgdGhpcy5yYWRpYWxTcGVlZEdyYXBoKTtcblxuICAgICAgICB0aGlzLmxpZ2h0Q3ViZSA9IG5ldyBGbG9hdDMyQXJyYXkoNiAqIDMpO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpciA9IG5ldyBBcnJheSg2KTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbMF0gPSBuZXcgVmVjMygtMSwgMCwgMCk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzFdID0gbmV3IFZlYzMoMSwgMCwgMCk7XG4gICAgICAgIHRoaXMubGlnaHRDdWJlRGlyWzJdID0gbmV3IFZlYzMoMCwgLTEsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpclszXSA9IG5ldyBWZWMzKDAsIDEsIDApO1xuICAgICAgICB0aGlzLmxpZ2h0Q3ViZURpcls0XSA9IG5ldyBWZWMzKDAsIDAsIC0xKTtcbiAgICAgICAgdGhpcy5saWdodEN1YmVEaXJbNV0gPSBuZXcgVmVjMygwLCAwLCAxKTtcblxuICAgICAgICB0aGlzLmFuaW1UaWxlc1BhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuYW5pbVBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuYW5pbUluZGV4UGFyYW1zID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuICAgICAgICB0aGlzLmludGVybmFsVGV4MCA9IG51bGw7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbnRlcm5hbFRleDIgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbG9yUGFyYW0gPSBudWxsO1xuXG4gICAgICAgIHRoaXMudmJUb1NvcnQgPSBudWxsO1xuICAgICAgICB0aGlzLnZiT2xkID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJ0aWNsZURpc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNhbWVyYSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zd2FwVGV4ID0gZmFsc2U7XG4gICAgICAgIHRoaXMudXNlTWVzaCA9IHRydWU7XG4gICAgICAgIHRoaXMudXNlQ3B1ID0gIWdyYXBoaWNzRGV2aWNlLnN1cHBvcnRzR3B1UGFydGljbGVzO1xuXG4gICAgICAgIHRoaXMucGFjazggPSB0cnVlO1xuICAgICAgICB0aGlzLmxvY2FsQm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbCA9IFtuZXcgQm91bmRpbmdCb3goKSwgbmV3IEJvdW5kaW5nQm94KCldO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1NpemUgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzU2l6ZSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5wcmV2RW1pdHRlckV4dGVudHMgPSB0aGlzLmVtaXR0ZXJFeHRlbnRzO1xuICAgICAgICB0aGlzLnByZXZFbWl0dGVyUmFkaXVzID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzTXVsID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMudGltZVRvU3dpdGNoQm91bmRzID0gMDtcbiAgICAgICAgLy8gdGhpcy5wcmV2UG9zID0gbmV3IFZlYzMoKTtcblxuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlUmVzcGF3biA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZGVyUGFydGljbGVVcGRhdGVOb1Jlc3Bhd24gPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wID0gbnVsbDtcblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlVmVydHMgPSAwO1xuICAgICAgICB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyA9IDA7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIHRoaXMuc2VlZCA9IE1hdGgucmFuZG9tKCk7XG5cbiAgICAgICAgdGhpcy5maXhlZFRpbWVTdGVwID0gMS4wIC8gNjA7XG4gICAgICAgIHRoaXMubWF4U3ViU3RlcHMgPSAxMDtcbiAgICAgICAgdGhpcy5zaW1UaW1lID0gMDtcbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgPSAwO1xuXG4gICAgICAgIHRoaXMuYmVlblJlc2V0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucmVidWlsZCgpO1xuICAgIH1cblxuICAgIGdldCBkZWZhdWx0UGFyYW1UZXh0dXJlKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5ncmFwaGljc0RldmljZSk7XG4gICAgICAgIHJldHVybiBwYXJ0aWNsZUVtaXR0ZXJEZXZpY2VDYWNoZS5nZXQodGhpcy5ncmFwaGljc0RldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IDE2O1xuICAgICAgICAgICAgY29uc3QgY2VudGVyUG9pbnQgPSByZXNvbHV0aW9uICogMC41ICsgMC41O1xuICAgICAgICAgICAgY29uc3QgZHRleCA9IG5ldyBGbG9hdDMyQXJyYXkocmVzb2x1dGlvbiAqIHJlc29sdXRpb24gKiA0KTtcbiAgICAgICAgICAgIGZvciAobGV0IHkgPSAwOyB5IDwgcmVzb2x1dGlvbjsgeSsrKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCByZXNvbHV0aW9uOyB4KyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeGdyYWQgPSAoeCArIDEpIC0gY2VudGVyUG9pbnQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHlncmFkID0gKHkgKyAxKSAtIGNlbnRlclBvaW50O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjID0gc2F0dXJhdGUoKDEgLSBzYXR1cmF0ZShNYXRoLnNxcnQoeGdyYWQgKiB4Z3JhZCArIHlncmFkICogeWdyYWQpIC8gcmVzb2x1dGlvbikpIC0gMC41KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcCA9IHkgKiByZXNvbHV0aW9uICsgeDtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNF0gPSAgICAgMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDFdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDJdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgZHRleFtwICogNCArIDNdID0gYztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSBfY3JlYXRlVGV4dHVyZSh0aGlzLmdyYXBoaWNzRGV2aWNlLCByZXNvbHV0aW9uLCByZXNvbHV0aW9uLCBkdGV4LCBQSVhFTEZPUk1BVF9SR0JBOCwgMS4wLCB0cnVlKTtcbiAgICAgICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgIHRleHR1cmUubWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBvbkNoYW5nZUNhbWVyYSgpIHtcbiAgICAgICAgdGhpcy5yZWdlblNoYWRlcigpO1xuICAgICAgICB0aGlzLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVCb3VuZHNNYWQoKSB7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueCA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLng7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueSA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLnk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNNdWwueiA9IDEuMCAvIHRoaXMud29ybGRCb3VuZHNTaXplLno7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKS5tdWwodGhpcy53b3JsZEJvdW5kc011bCkubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC54ICs9IDAuNTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC55ICs9IDAuNTtcbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc0FkZC56ICs9IDAuNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVXb3JsZEJvdW5kcygpIHtcbiAgICAgICAgaWYgKCF0aGlzLm5vZGUpIHJldHVybjtcblxuICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzQ2VudGVyLmNvcHkodGhpcy53b3JsZEJvdW5kcy5jZW50ZXIpO1xuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGxldCByZWNhbGN1bGF0ZUxvY2FsQm91bmRzID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgICAgICByZWNhbGN1bGF0ZUxvY2FsQm91bmRzID0gIXRoaXMuZW1pdHRlckV4dGVudHMuZXF1YWxzKHRoaXMucHJldkVtaXR0ZXJFeHRlbnRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVjYWxjdWxhdGVMb2NhbEJvdW5kcyA9ICEodGhpcy5lbWl0dGVyUmFkaXVzID09PSB0aGlzLnByZXZFbWl0dGVyUmFkaXVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZWNhbGN1bGF0ZUxvY2FsQm91bmRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxjdWxhdGVMb2NhbEJvdW5kcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBjb25zdCBub2RlV1QgPSB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgaWYgKHRoaXMubG9jYWxTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc05vVHJhaWwuY29weSh0aGlzLmxvY2FsQm91bmRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNOb1RyYWlsLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy5sb2NhbEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFswXS5hZGQodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uYWRkKHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcblxuICAgICAgICBjb25zdCBub3cgPSB0aGlzLnNpbVRpbWVUb3RhbDtcbiAgICAgICAgaWYgKG5vdyA+PSB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcykge1xuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kc1RyYWlsWzFdKTtcbiAgICAgICAgICAgIHRoaXMud29ybGRCb3VuZHNUcmFpbFsxXS5jb3B5KHRoaXMud29ybGRCb3VuZHNOb1RyYWlsKTtcbiAgICAgICAgICAgIHRoaXMudGltZVRvU3dpdGNoQm91bmRzID0gbm93ICsgdGhpcy5saWZldGltZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHMuY29weSh0aGlzLndvcmxkQm91bmRzVHJhaWxbMF0pO1xuXG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuXG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYih0aGlzLndvcmxkQm91bmRzLCBub2RlV1QpO1xuICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UubWVzaC5hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy53b3JsZEJvdW5kcywgbm9kZVdUKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuY29weSh0aGlzLndvcmxkQm91bmRzKTtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm1lc2guYWFiYi5jb3B5KHRoaXMud29ybGRCb3VuZHMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyID0gMSAtIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyO1xuXG4gICAgICAgIGlmICh0aGlzLnBhY2s4KSB0aGlzLmNhbGN1bGF0ZUJvdW5kc01hZCgpO1xuICAgIH1cblxuICAgIHJlc2V0V29ybGRCb3VuZHMoKSB7XG4gICAgICAgIGlmICghdGhpcy5ub2RlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc05vVHJhaWwuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihcbiAgICAgICAgICAgIHRoaXMubG9jYWxCb3VuZHMsIHRoaXMubG9jYWxTcGFjZSA/IE1hdDQuSURFTlRJVFkgOiB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kc05vVHJhaWwpO1xuICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzTm9UcmFpbCk7XG5cbiAgICAgICAgdGhpcy53b3JsZEJvdW5kcy5jb3B5KHRoaXMud29ybGRCb3VuZHNUcmFpbFswXSk7XG4gICAgICAgIHRoaXMud29ybGRCb3VuZHNTaXplLmNvcHkodGhpcy53b3JsZEJvdW5kcy5oYWxmRXh0ZW50cykubXVsU2NhbGFyKDIpO1xuXG4gICAgICAgIHRoaXMucHJldldvcmxkQm91bmRzU2l6ZS5jb3B5KHRoaXMud29ybGRCb3VuZHNTaXplKTtcbiAgICAgICAgdGhpcy5wcmV2V29ybGRCb3VuZHNDZW50ZXIuY29weSh0aGlzLndvcmxkQm91bmRzLmNlbnRlcik7XG5cbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgPSAwO1xuICAgICAgICB0aGlzLnRpbWVUb1N3aXRjaEJvdW5kcyA9IDA7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTG9jYWxCb3VuZHMoKSB7XG4gICAgICAgIGxldCBtaW54ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgbGV0IG1pbnkgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICBsZXQgbWlueiA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh4ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh5ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXh6ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIGxldCBtYXhSID0gMDtcbiAgICAgICAgbGV0IG1heFNjYWxlID0gMDtcbiAgICAgICAgY29uc3Qgc3RlcFdlaWdodCA9IHRoaXMubGlmZXRpbWUgLyB0aGlzLnByZWNpc2lvbjtcbiAgICAgICAgY29uc3Qgd1ZlbHMgPSBbdGhpcy5xVmVsb2NpdHksIHRoaXMucVZlbG9jaXR5Ml07XG4gICAgICAgIGNvbnN0IGxWZWxzID0gW3RoaXMucUxvY2FsVmVsb2NpdHksIHRoaXMucUxvY2FsVmVsb2NpdHkyXTtcbiAgICAgICAgY29uc3QgYWNjdW1YID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVkgPSBbMCwgMF07XG4gICAgICAgIGNvbnN0IGFjY3VtWiA9IFswLCAwXTtcbiAgICAgICAgY29uc3QgYWNjdW1SID0gWzAsIDBdO1xuICAgICAgICBjb25zdCBhY2N1bVcgPSBbMCwgMF07XG4gICAgICAgIGxldCB4LCB5LCB6O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucHJlY2lzaW9uICsgMTsgaSsrKSB7IC8vIHRha2UgZXh0cmEgc3RlcCB0byBwcmV2ZW50IHBvc2l0aW9uIGdsaXRjaGVzXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IE1hdGgubWluKGksIHRoaXMucHJlY2lzaW9uIC0gMSk7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDI7IGorKykge1xuICAgICAgICAgICAgICAgIHggPSBsVmVsc1tqXVtpbmRleCAqIDMgKyAwXSAqIHN0ZXBXZWlnaHQgKyBhY2N1bVhbal07XG4gICAgICAgICAgICAgICAgeSA9IGxWZWxzW2pdW2luZGV4ICogMyArIDFdICogc3RlcFdlaWdodCArIGFjY3VtWVtqXTtcbiAgICAgICAgICAgICAgICB6ID0gbFZlbHNbal1baW5kZXggKiAzICsgMl0gKiBzdGVwV2VpZ2h0ICsgYWNjdW1aW2pdO1xuXG4gICAgICAgICAgICAgICAgbWlueCA9IE1hdGgubWluKHgsIG1pbngpO1xuICAgICAgICAgICAgICAgIG1pbnkgPSBNYXRoLm1pbih5LCBtaW55KTtcbiAgICAgICAgICAgICAgICBtaW56ID0gTWF0aC5taW4oeiwgbWlueik7XG4gICAgICAgICAgICAgICAgbWF4eCA9IE1hdGgubWF4KHgsIG1heHgpO1xuICAgICAgICAgICAgICAgIG1heHkgPSBNYXRoLm1heCh5LCBtYXh5KTtcbiAgICAgICAgICAgICAgICBtYXh6ID0gTWF0aC5tYXgoeiwgbWF4eik7XG5cbiAgICAgICAgICAgICAgICBhY2N1bVhbal0gPSB4O1xuICAgICAgICAgICAgICAgIGFjY3VtWVtqXSA9IHk7XG4gICAgICAgICAgICAgICAgYWNjdW1aW2pdID0gejtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgMjsgaisrKSB7XG4gICAgICAgICAgICAgICAgYWNjdW1XW2pdICs9IHN0ZXBXZWlnaHQgKiBNYXRoLnNxcnQoXG4gICAgICAgICAgICAgICAgICAgIHdWZWxzW2pdW2luZGV4ICogMyArIDBdICogd1ZlbHNbal1baW5kZXggKiAzICsgMF0gK1xuICAgICAgICAgICAgICAgICAgICB3VmVsc1tqXVtpbmRleCAqIDMgKyAxXSAqIHdWZWxzW2pdW2luZGV4ICogMyArIDFdICtcbiAgICAgICAgICAgICAgICAgICAgd1ZlbHNbal1baW5kZXggKiAzICsgMl0gKiB3VmVsc1tqXVtpbmRleCAqIDMgKyAyXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFjY3VtUlswXSArPSB0aGlzLnFSYWRpYWxTcGVlZFtpbmRleF0gKiBzdGVwV2VpZ2h0O1xuICAgICAgICAgICAgYWNjdW1SWzFdICs9IHRoaXMucVJhZGlhbFNwZWVkMltpbmRleF0gKiBzdGVwV2VpZ2h0O1xuICAgICAgICAgICAgbWF4UiA9IE1hdGgubWF4KG1heFIsIE1hdGgubWF4KE1hdGguYWJzKGFjY3VtUlswXSksIE1hdGguYWJzKGFjY3VtUlsxXSkpKTtcblxuICAgICAgICAgICAgbWF4U2NhbGUgPSBNYXRoLm1heChtYXhTY2FsZSwgdGhpcy5xU2NhbGVbaW5kZXhdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCkge1xuICAgICAgICAgICAgeCA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAqIDAuNTtcbiAgICAgICAgICAgIHkgPSB0aGlzLmVtaXR0ZXJFeHRlbnRzLnkgKiAwLjU7XG4gICAgICAgICAgICB6ID0gdGhpcy5lbWl0dGVyRXh0ZW50cy56ICogMC41O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IHRoaXMuZW1pdHRlclJhZGl1cztcbiAgICAgICAgICAgIHkgPSB0aGlzLmVtaXR0ZXJSYWRpdXM7XG4gICAgICAgICAgICB6ID0gdGhpcy5lbWl0dGVyUmFkaXVzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdyA9IE1hdGgubWF4KGFjY3VtV1swXSwgYWNjdW1XWzFdKTtcbiAgICAgICAgYk1pbi54ID0gbWlueCAtIG1heFNjYWxlIC0geCAtIG1heFIgLSB3O1xuICAgICAgICBiTWluLnkgPSBtaW55IC0gbWF4U2NhbGUgLSB5IC0gbWF4UiAtIHc7XG4gICAgICAgIGJNaW4ueiA9IG1pbnogLSBtYXhTY2FsZSAtIHogLSBtYXhSIC0gdztcbiAgICAgICAgYk1heC54ID0gbWF4eCArIG1heFNjYWxlICsgeCArIG1heFIgKyB3O1xuICAgICAgICBiTWF4LnkgPSBtYXh5ICsgbWF4U2NhbGUgKyB5ICsgbWF4UiArIHc7XG4gICAgICAgIGJNYXgueiA9IG1heHogKyBtYXhTY2FsZSArIHogKyBtYXhSICsgdztcbiAgICAgICAgdGhpcy5sb2NhbEJvdW5kcy5zZXRNaW5NYXgoYk1pbiwgYk1heCk7XG4gICAgfVxuXG4gICAgcmVidWlsZCgpIHtcbiAgICAgICAgY29uc3QgZ2QgPSB0aGlzLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIGlmICh0aGlzLmNvbG9yTWFwID09PSBudWxsKSB0aGlzLmNvbG9yTWFwID0gdGhpcy5kZWZhdWx0UGFyYW1UZXh0dXJlO1xuXG4gICAgICAgIHRoaXMuc3Bhd25Cb3VuZHMgPSB0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCA/IHRoaXMuZW1pdHRlckV4dGVudHMgOiB0aGlzLmVtaXR0ZXJSYWRpdXM7XG5cbiAgICAgICAgdGhpcy51c2VDcHUgPSB0aGlzLnVzZUNwdSB8fCB0aGlzLnNvcnQgPiBQQVJUSUNMRVNPUlRfTk9ORSB8fCAgLy8gZm9yY2UgQ1BVIGlmIGRlc2lyYWJsZSBieSB1c2VyIG9yIHNvcnRpbmcgaXMgZW5hYmxlZFxuICAgICAgICBnZC5tYXhWZXJ0ZXhUZXh0dXJlcyA8PSAxIHx8IC8vIGZvcmNlIENQVSBpZiBjYW4ndCB1c2UgZW5vdWdoIHZlcnRleCB0ZXh0dXJlc1xuICAgICAgICBnZC5mcmFnbWVudFVuaWZvcm1zQ291bnQgPCA2NCB8fCAvLyBmb3JjZSBDUFUgaWYgY2FuJ3QgdXNlIG1hbnkgdW5pZm9ybXM7IFRPRE86IGNoYW5nZSB0byBtb3JlIHJlYWxpc3RpYyB2YWx1ZSAodGhpcyBvbmUgaXMgaXBob25lJ3MpXG4gICAgICAgIGdkLmZvcmNlQ3B1UGFydGljbGVzIHx8XG4gICAgICAgICFnZC5leHRUZXh0dXJlRmxvYXQ7IC8vIG5vIGZsb2F0IHRleHR1cmUgZXh0ZW5zaW9uXG5cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlc291cmNlcygpO1xuXG4gICAgICAgIHRoaXMucGFjazggPSAodGhpcy5wYWNrOCB8fCAhZ2QudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgJiYgIXRoaXMudXNlQ3B1O1xuXG4gICAgICAgIHBhcnRpY2xlVGV4SGVpZ2h0ID0gKHRoaXMudXNlQ3B1IHx8IHRoaXMucGFjazgpID8gNCA6IDI7XG5cbiAgICAgICAgdGhpcy51c2VNZXNoID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgIGNvbnN0IHRvdGFsVmVydENvdW50ID0gdGhpcy5udW1QYXJ0aWNsZXMgKiB0aGlzLm1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgaWYgKHRvdGFsVmVydENvdW50ID4gNjU1MzUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdXQVJOSU5HOiBwYXJ0aWNsZSBzeXN0ZW0gY2FuXFwndCByZW5kZXIgbWVzaCBwYXJ0aWNsZXMgYmVjYXVzZSBudW1QYXJ0aWNsZXMgKiBudW1WZXJ0aWNlcyBpcyBtb3JlIHRoYW4gNjVrLiBSZXZlcnRpbmcgdG8gcXVhZCBwYXJ0aWNsZXMuJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudXNlTWVzaCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm51bVBhcnRpY2xlc1BvdCA9IG1hdGgubmV4dFBvd2VyT2ZUd28odGhpcy5udW1QYXJ0aWNsZXMpO1xuICAgICAgICB0aGlzLnJlYnVpbGRHcmFwaHMoKTtcbiAgICAgICAgdGhpcy5jYWxjdWxhdGVMb2NhbEJvdW5kcygpO1xuICAgICAgICB0aGlzLnJlc2V0V29ybGRCb3VuZHMoKTtcblxuICAgICAgICBpZiAodGhpcy5ub2RlKSB7XG4gICAgICAgICAgICAvLyB0aGlzLnByZXZQb3MuY29weSh0aGlzLm5vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoXG4gICAgICAgICAgICAgICAgdGhpcy5sb2NhbEJvdW5kcywgdGhpcy5sb2NhbFNwYWNlID8gTWF0NC5JREVOVElUWSA6IHRoaXMubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcblxuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1RyYWlsWzBdLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQm91bmRzVHJhaWxbMV0uY29weSh0aGlzLndvcmxkQm91bmRzKTtcblxuICAgICAgICAgICAgdGhpcy53b3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzLmhhbGZFeHRlbnRzKS5tdWxTY2FsYXIoMik7XG4gICAgICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc1NpemUuY29weSh0aGlzLndvcmxkQm91bmRzU2l6ZSk7XG4gICAgICAgICAgICB0aGlzLnByZXZXb3JsZEJvdW5kc0NlbnRlci5jb3B5KHRoaXMud29ybGRCb3VuZHMuY2VudGVyKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhY2s4KSB0aGlzLmNhbGN1bGF0ZUJvdW5kc01hZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRHluYW1pYyBzaW11bGF0aW9uIGRhdGFcbiAgICAgICAgdGhpcy52YlRvU29ydCA9IG5ldyBBcnJheSh0aGlzLm51bVBhcnRpY2xlcyk7XG4gICAgICAgIGZvciAobGV0IGlTb3J0ID0gMDsgaVNvcnQgPCB0aGlzLm51bVBhcnRpY2xlczsgaVNvcnQrKykgdGhpcy52YlRvU29ydFtpU29ydF0gPSBbMCwgMF07XG4gICAgICAgIHRoaXMucGFydGljbGVEaXN0YW5jZSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXMpO1xuXG4gICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIucmFuZG9taXplKCk7XG5cbiAgICAgICAgdGhpcy5wYXJ0aWNsZVRleCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXNQb3QgKiBwYXJ0aWNsZVRleEhlaWdodCAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMpO1xuICAgICAgICBjb25zdCBlbWl0dGVyUG9zID0gKHRoaXMubm9kZSA9PT0gbnVsbCB8fCB0aGlzLmxvY2FsU3BhY2UpID8gVmVjMy5aRVJPIDogdGhpcy5ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCkge1xuICAgICAgICAgICAgaWYgKHRoaXMubm9kZSA9PT0gbnVsbCB8fCB0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBzcGF3bk1hdHJpeC5zZXRUUlMoVmVjMy5aRVJPLCBRdWF0LklERU5USVRZLCB0aGlzLnNwYXduQm91bmRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgdGhpcy5ub2RlLmdldFJvdGF0aW9uKCksIHRtcFZlYzMuY29weSh0aGlzLnNwYXduQm91bmRzKS5tdWwodGhpcy5ub2RlLmxvY2FsU2NhbGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVswXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci54IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy54IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsxXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueSAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci55IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy55IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsyXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueiAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci56IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy56IDogMDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubnVtUGFydGljbGVzOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NwdVVwZGF0ZXIuY2FsY1NwYXduUG9zaXRpb24odGhpcy5wYXJ0aWNsZVRleCwgc3Bhd25NYXRyaXgsIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSwgZW1pdHRlclBvcywgaSk7XG4gICAgICAgICAgICBpZiAodGhpcy51c2VDcHUpIHRoaXMucGFydGljbGVUZXhbaSAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMgKyAzICsgdGhpcy5udW1QYXJ0aWNsZXNQb3QgKiAyICogcGFydGljbGVUZXhDaGFubmVsc10gPSAxOyAvLyBoaWRlL3Nob3dcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFydGljbGVUZXhTdGFydCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1QYXJ0aWNsZXNQb3QgKiBwYXJ0aWNsZVRleEhlaWdodCAqIHBhcnRpY2xlVGV4Q2hhbm5lbHMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFydGljbGVUZXhTdGFydC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0W2ldID0gdGhpcy5wYXJ0aWNsZVRleFtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhY2s4KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleElOID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCwgUElYRUxGT1JNQVRfUkdCQTgsIDEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4T1VUID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHRoaXMubnVtUGFydGljbGVzUG90LCBwYXJ0aWNsZVRleEhlaWdodCwgdGhpcy5wYXJ0aWNsZVRleCwgUElYRUxGT1JNQVRfUkdCQTgsIDEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQsIFBJWEVMRk9STUFUX1JHQkE4LCAxLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTiA9IF9jcmVhdGVUZXh0dXJlKGdkLCB0aGlzLm51bVBhcnRpY2xlc1BvdCwgcGFydGljbGVUZXhIZWlnaHQsIHRoaXMucGFydGljbGVUZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhPVVQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQgPSBfY3JlYXRlVGV4dHVyZShnZCwgdGhpcy5udW1QYXJ0aWNsZXNQb3QsIHBhcnRpY2xlVGV4SGVpZ2h0LCB0aGlzLnBhcnRpY2xlVGV4U3RhcnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJ0UGFydGljbGVUZXhJTiA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLnBhcnRpY2xlVGV4SU4sXG4gICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleE9VVCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLnBhcnRpY2xlVGV4T1VULFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnN3YXBUZXggPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVTdGFydCA9ICh0aGlzLmxvY2FsU3BhY2UgPyAnI2RlZmluZSBMT0NBTF9TUEFDRVxcbicgOiAnJykgKyBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVySW5pdFBTICtcbiAgICAgICAgKHRoaXMucGFjazggPyAoc2hhZGVyQ2h1bmtzLnBhcnRpY2xlSW5wdXRSZ2JhOFBTICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlT3V0cHV0UmdiYThQUykgOlxuICAgICAgICAgICAgKHNoYWRlckNodW5rcy5wYXJ0aWNsZUlucHV0RmxvYXRQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZU91dHB1dEZsb2F0UFMpKSArXG4gICAgICAgICh0aGlzLmVtaXR0ZXJTaGFwZSA9PT0gRU1JVFRFUlNIQVBFX0JPWCA/IHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJBQUJCUFMgOiBzaGFkZXJDaHVua3MucGFydGljbGVVcGRhdGVyU3BoZXJlUFMpICtcbiAgICAgICAgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclN0YXJ0UFM7XG4gICAgICAgIGNvbnN0IHNoYWRlckNvZGVSZXNwYXduID0gc2hhZGVyQ29kZVN0YXJ0ICsgc2hhZGVyQ2h1bmtzLnBhcnRpY2xlVXBkYXRlclJlc3Bhd25QUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcbiAgICAgICAgY29uc3Qgc2hhZGVyQ29kZU5vUmVzcGF3biA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJOb1Jlc3Bhd25QUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcbiAgICAgICAgY29uc3Qgc2hhZGVyQ29kZU9uU3RvcCA9IHNoYWRlckNvZGVTdGFydCArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJPblN0b3BQUyArIHNoYWRlckNodW5rcy5wYXJ0aWNsZVVwZGF0ZXJFbmRQUztcblxuICAgICAgICAvLyBOb3RlOiBjcmVhdGVTaGFkZXJGcm9tQ29kZSBjYW4gcmV0dXJuIGEgc2hhZGVyIGZyb20gdGhlIGNhY2hlIChub3QgYSBuZXcgc2hhZGVyKSBzbyB3ZSAqc2hvdWxkIG5vdCogZGVsZXRlIHRoZXNlIHNoYWRlcnNcbiAgICAgICAgLy8gd2hlbiB0aGUgcGFydGljbGUgZW1pdHRlciBpcyBkZXN0cm95ZWRcbiAgICAgICAgY29uc3QgcGFyYW1zID0gdGhpcy5lbWl0dGVyU2hhcGUgKyAnJyArIHRoaXMucGFjazggKyAnJyArIHRoaXMubG9jYWxTcGFjZTtcbiAgICAgICAgdGhpcy5zaGFkZXJQYXJ0aWNsZVVwZGF0ZVJlc3Bhd24gPSBjcmVhdGVTaGFkZXJGcm9tQ29kZShnZCwgc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlMsIHNoYWRlckNvZGVSZXNwYXduLCAnZnNRdWFkMCcgKyBwYXJhbXMpO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlTm9SZXNwYXduID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlTm9SZXNwYXduLCAnZnNRdWFkMScgKyBwYXJhbXMpO1xuICAgICAgICB0aGlzLnNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ2QsIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFZTLCBzaGFkZXJDb2RlT25TdG9wLCAnZnNRdWFkMicgKyBwYXJhbXMpO1xuXG4gICAgICAgIHRoaXMubnVtUGFydGljbGVWZXJ0cyA9IHRoaXMudXNlTWVzaCA/IHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMgOiA0O1xuICAgICAgICB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcyA9IHRoaXMudXNlTWVzaCA/IHRoaXMubWVzaC5pbmRleEJ1ZmZlclswXS5udW1JbmRpY2VzIDogNjtcbiAgICAgICAgdGhpcy5fYWxsb2NhdGUodGhpcy5udW1QYXJ0aWNsZXMpO1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChnZCk7XG4gICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdGhpcy52ZXJ0ZXhCdWZmZXI7XG4gICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSB0aGlzLmluZGV4QnVmZmVyO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS50eXBlID0gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IDA7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gKHRoaXMubnVtUGFydGljbGVzICogdGhpcy5udW1QYXJ0aWNsZUluZGljZXMpO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbmV3IE1hdGVyaWFsKCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwubmFtZSA9IHRoaXMubm9kZS5uYW1lO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9OT05FO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5ibGVuZCA9IHRydWU7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuYmxlbmRUeXBlID0gdGhpcy5ibGVuZFR5cGU7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbC5kZXB0aFdyaXRlID0gdGhpcy5kZXB0aFdyaXRlO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmVtaXR0ZXIgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMucmVnZW5TaGFkZXIoKTtcbiAgICAgICAgdGhpcy5yZXNldE1hdGVyaWFsKCk7XG5cbiAgICAgICAgY29uc3Qgd2FzVmlzaWJsZSA9IHRoaXMubWVzaEluc3RhbmNlID8gdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA6IHRydWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCB0aGlzLm1hdGVyaWFsLCB0aGlzLm5vZGUpO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5waWNrID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnVwZGF0ZUtleSgpOyAvLyBzaG91bGRuJ3QgYmUgaGVyZT9cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuY3VsbCA9IHRydWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9ub0RlcHRoRHJhd0dsMSA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmxvY2FsU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYih0aGlzLndvcmxkQm91bmRzLCB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5hYWJiLmNvcHkodGhpcy53b3JsZEJvdW5kcyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmIgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9IHdhc1Zpc2libGU7XG5cbiAgICAgICAgdGhpcy5faW5pdGlhbGl6ZVRleHR1cmVzKCk7XG5cbiAgICAgICAgdGhpcy5yZXNldFRpbWUoKTtcblxuICAgICAgICB0aGlzLmFkZFRpbWUoMCwgZmFsc2UpOyAvLyBmaWxsIGR5bmFtaWMgdGV4dHVyZXMgYW5kIGNvbnN0YW50cyB3aXRoIGluaXRpYWwgZGF0YVxuICAgICAgICBpZiAodGhpcy5wcmVXYXJtKSB0aGlzLnByZXdhcm0odGhpcy5saWZldGltZSk7XG4gICAgfVxuXG4gICAgX2lzQW5pbWF0ZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFuaW1OdW1GcmFtZXMgPj0gMSAmJlxuICAgICAgICAgICAgICAgKHRoaXMuYW5pbVRpbGVzWCA+IDEgfHwgdGhpcy5hbmltVGlsZXNZID4gMSkgJiZcbiAgICAgICAgICAgICAgICh0aGlzLmNvbG9yTWFwICYmIHRoaXMuY29sb3JNYXAgIT09IHRoaXMuZGVmYXVsdFBhcmFtVGV4dHVyZSB8fCB0aGlzLm5vcm1hbE1hcCk7XG4gICAgfVxuXG4gICAgcmVidWlsZEdyYXBocygpIHtcbiAgICAgICAgY29uc3QgcHJlY2lzaW9uID0gdGhpcy5wcmVjaXNpb247XG4gICAgICAgIGNvbnN0IGdkID0gdGhpcy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICB0aGlzLnFMb2NhbFZlbG9jaXR5ID0gdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xVmVsb2NpdHkgPSB0aGlzLnZlbG9jaXR5R3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xQ29sb3IgPSAgICAgICAgIHRoaXMuY29sb3JHcmFwaC5xdWFudGl6ZUNsYW1wZWQocHJlY2lzaW9uLCAwLCAxKTtcbiAgICAgICAgdGhpcy5xUm90U3BlZWQgPSAgICAgIHRoaXMucm90YXRpb25TcGVlZEdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucVNjYWxlID0gICAgICAgICB0aGlzLnNjYWxlR3JhcGgucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xQWxwaGEgPSAgICAgICAgIHRoaXMuYWxwaGFHcmFwaC5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFSYWRpYWxTcGVlZCA9ICAgdGhpcy5yYWRpYWxTcGVlZEdyYXBoLnF1YW50aXplKHByZWNpc2lvbik7XG5cbiAgICAgICAgdGhpcy5xTG9jYWxWZWxvY2l0eTIgPSB0aGlzLmxvY2FsVmVsb2NpdHlHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xVmVsb2NpdHkyID0gICAgICB0aGlzLnZlbG9jaXR5R3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUNvbG9yMiA9ICAgICAgICAgdGhpcy5jb2xvckdyYXBoMi5xdWFudGl6ZUNsYW1wZWQocHJlY2lzaW9uLCAwLCAxKTtcbiAgICAgICAgdGhpcy5xUm90U3BlZWQyID0gICAgICB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgdGhpcy5xU2NhbGUyID0gICAgICAgICB0aGlzLnNjYWxlR3JhcGgyLnF1YW50aXplKHByZWNpc2lvbik7XG4gICAgICAgIHRoaXMucUFscGhhMiA9ICAgICAgICAgdGhpcy5hbHBoYUdyYXBoMi5xdWFudGl6ZShwcmVjaXNpb24pO1xuICAgICAgICB0aGlzLnFSYWRpYWxTcGVlZDIgPSAgIHRoaXMucmFkaWFsU3BlZWRHcmFwaDIucXVhbnRpemUocHJlY2lzaW9uKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWNpc2lvbjsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnFSb3RTcGVlZFtpXSAqPSBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICB0aGlzLnFSb3RTcGVlZDJbaV0gKj0gbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2NhbFZlbG9jaXR5VU1heCA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMudmVsb2NpdHlVTWF4ID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5jb2xvclVNYXggPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLnJvdFNwZWVkVU1heCA9IFswXTtcbiAgICAgICAgdGhpcy5zY2FsZVVNYXggPSAgICBbMF07XG4gICAgICAgIHRoaXMuYWxwaGFVTWF4ID0gICAgWzBdO1xuICAgICAgICB0aGlzLnJhZGlhbFNwZWVkVU1heCA9IFswXTtcbiAgICAgICAgdGhpcy5xTG9jYWxWZWxvY2l0eURpdiA9IGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xTG9jYWxWZWxvY2l0eSwgdGhpcy5xTG9jYWxWZWxvY2l0eTIsIHRoaXMubG9jYWxWZWxvY2l0eVVNYXgpO1xuICAgICAgICB0aGlzLnFWZWxvY2l0eURpdiA9ICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFWZWxvY2l0eSwgdGhpcy5xVmVsb2NpdHkyLCB0aGlzLnZlbG9jaXR5VU1heCk7XG4gICAgICAgIHRoaXMucUNvbG9yRGl2ID0gICAgICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucUNvbG9yLCB0aGlzLnFDb2xvcjIsIHRoaXMuY29sb3JVTWF4KTtcbiAgICAgICAgdGhpcy5xUm90U3BlZWREaXYgPSAgICAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xUm90U3BlZWQsIHRoaXMucVJvdFNwZWVkMiwgdGhpcy5yb3RTcGVlZFVNYXgpO1xuICAgICAgICB0aGlzLnFTY2FsZURpdiA9ICAgICAgICAgZGl2R3JhcGhGcm9tMkN1cnZlcyh0aGlzLnFTY2FsZSwgdGhpcy5xU2NhbGUyLCB0aGlzLnNjYWxlVU1heCk7XG4gICAgICAgIHRoaXMucUFscGhhRGl2ID0gICAgICAgICBkaXZHcmFwaEZyb20yQ3VydmVzKHRoaXMucUFscGhhLCB0aGlzLnFBbHBoYTIsIHRoaXMuYWxwaGFVTWF4KTtcbiAgICAgICAgdGhpcy5xUmFkaWFsU3BlZWREaXYgPSAgIGRpdkdyYXBoRnJvbTJDdXJ2ZXModGhpcy5xUmFkaWFsU3BlZWQsIHRoaXMucVJhZGlhbFNwZWVkMiwgdGhpcy5yYWRpYWxTcGVlZFVNYXgpO1xuXG4gICAgICAgIGlmICh0aGlzLnBhY2s4KSB7XG4gICAgICAgICAgICBjb25zdCB1bWF4ID0gWzAsIDAsIDBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVZlbG9jaXR5LCB1bWF4KTtcbiAgICAgICAgICAgIGNvbnN0IHVtYXgyID0gWzAsIDAsIDBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVZlbG9jaXR5MiwgdW1heDIpO1xuXG4gICAgICAgICAgICBjb25zdCBsdW1heCA9IFswLCAwLCAwXTtcbiAgICAgICAgICAgIG1heFVuc2lnbmVkR3JhcGhWYWx1ZSh0aGlzLnFMb2NhbFZlbG9jaXR5LCBsdW1heCk7XG4gICAgICAgICAgICBjb25zdCBsdW1heDIgPSBbMCwgMCwgMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xTG9jYWxWZWxvY2l0eTIsIGx1bWF4Mik7XG5cbiAgICAgICAgICAgIGNvbnN0IHJ1bWF4ID0gWzBdO1xuICAgICAgICAgICAgbWF4VW5zaWduZWRHcmFwaFZhbHVlKHRoaXMucVJhZGlhbFNwZWVkLCBydW1heCk7XG4gICAgICAgICAgICBjb25zdCBydW1heDIgPSBbMF07XG4gICAgICAgICAgICBtYXhVbnNpZ25lZEdyYXBoVmFsdWUodGhpcy5xUmFkaWFsU3BlZWQyLCBydW1heDIpO1xuXG4gICAgICAgICAgICBsZXQgbWF4VmVsID0gTWF0aC5tYXgodW1heFswXSwgdW1heDJbMF0pO1xuICAgICAgICAgICAgbWF4VmVsID0gTWF0aC5tYXgobWF4VmVsLCB1bWF4WzFdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heDJbMV0pO1xuICAgICAgICAgICAgbWF4VmVsID0gTWF0aC5tYXgobWF4VmVsLCB1bWF4WzJdKTtcbiAgICAgICAgICAgIG1heFZlbCA9IE1hdGgubWF4KG1heFZlbCwgdW1heDJbMl0pO1xuXG4gICAgICAgICAgICBsZXQgbG1heFZlbCA9IE1hdGgubWF4KGx1bWF4WzBdLCBsdW1heDJbMF0pO1xuICAgICAgICAgICAgbG1heFZlbCA9IE1hdGgubWF4KGxtYXhWZWwsIGx1bWF4WzFdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heDJbMV0pO1xuICAgICAgICAgICAgbG1heFZlbCA9IE1hdGgubWF4KGxtYXhWZWwsIGx1bWF4WzJdKTtcbiAgICAgICAgICAgIGxtYXhWZWwgPSBNYXRoLm1heChsbWF4VmVsLCBsdW1heDJbMl0pO1xuXG4gICAgICAgICAgICBjb25zdCBtYXhSYWQgPSBNYXRoLm1heChydW1heFswXSwgcnVtYXgyWzBdKTtcblxuICAgICAgICAgICAgdGhpcy5tYXhWZWwgPSBtYXhWZWwgKyBsbWF4VmVsICsgbWF4UmFkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDAgPSBfY3JlYXRlVGV4dHVyZShnZCwgcHJlY2lzaW9uLCAxLCBwYWNrVGV4dHVyZVhZWl9OWFlaKHRoaXMucUxvY2FsVmVsb2NpdHksIHRoaXMucUxvY2FsVmVsb2NpdHlEaXYpKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgxID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmVYWVpfTlhZWih0aGlzLnFWZWxvY2l0eSwgdGhpcy5xVmVsb2NpdHlEaXYpKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgyID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmU1RmxvYXRzKHRoaXMucVJvdFNwZWVkLCB0aGlzLnFTY2FsZSwgdGhpcy5xU2NhbGVEaXYsIHRoaXMucVJvdFNwZWVkRGl2LCB0aGlzLnFBbHBoYURpdikpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDMgPSBfY3JlYXRlVGV4dHVyZShnZCwgcHJlY2lzaW9uLCAxLCBwYWNrVGV4dHVyZTJGbG9hdHModGhpcy5xUmFkaWFsU3BlZWQsIHRoaXMucVJhZGlhbFNwZWVkRGl2KSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb2xvclBhcmFtID0gX2NyZWF0ZVRleHR1cmUoZ2QsIHByZWNpc2lvbiwgMSwgcGFja1RleHR1cmVSR0JBKHRoaXMucUNvbG9yLCB0aGlzLnFBbHBoYSksIFBJWEVMRk9STUFUX1JHQkE4LCAxLjAsIHRydWUpO1xuICAgIH1cblxuICAgIF9pbml0aWFsaXplVGV4dHVyZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbG9yTWFwKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignY29sb3JNYXAnLCB0aGlzLmNvbG9yTWFwKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nICYmIHRoaXMubm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ25vcm1hbE1hcCcsIHRoaXMubm9ybWFsTWFwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlZ2VuU2hhZGVyKCkge1xuICAgICAgICBjb25zdCBwcm9ncmFtTGliID0gZ2V0UHJvZ3JhbUxpYnJhcnkodGhpcy5ncmFwaGljc0RldmljZSk7XG4gICAgICAgIHByb2dyYW1MaWIucmVnaXN0ZXIoJ3BhcnRpY2xlJywgcGFydGljbGUpO1xuXG4gICAgICAgIGNvbnN0IGhhc05vcm1hbCA9ICh0aGlzLm5vcm1hbE1hcCAhPT0gbnVsbCk7XG4gICAgICAgIHRoaXMubm9ybWFsT3B0aW9uID0gMDtcbiAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcpIHtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsT3B0aW9uID0gaGFzTm9ybWFsID8gMiA6IDE7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZ2V0U2hhZGVyVmFyaWFudCBpcyBhbHNvIGNhbGxlZCBieSBwYy5TY2VuZSB3aGVuIGFsbCBzaGFkZXJzIG5lZWQgdG8gYmUgdXBkYXRlZFxuICAgICAgICB0aGlzLm1hdGVyaWFsLmdldFNoYWRlclZhcmlhbnQgPSBmdW5jdGlvbiAoZGV2LCBzYywgZGVmcywgc3RhdGljTGlnaHRMaXN0LCBwYXNzLCBzb3J0ZWRMaWdodHMsIHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIFRoZSBhcHAgd29ya3MgbGlrZSB0aGlzOlxuICAgICAgICAgICAgLy8gMS4gRW1pdHRlciBpbml0XG4gICAgICAgICAgICAvLyAyLiBVcGRhdGUuIE5vIGNhbWVyYSBpcyBhc3NpZ25lZCB0byBlbWl0dGVyc1xuICAgICAgICAgICAgLy8gMy4gUmVuZGVyOyBhY3RpdmVDYW1lcmEgPSBjYW1lcmE7IHNoYWRlciBpbml0XG4gICAgICAgICAgICAvLyA0LiBVcGRhdGUuIGFjdGl2ZUNhbWVyYSBpcyBzZXQgdG8gZW1pdHRlcnNcbiAgICAgICAgICAgIC8vIC0tLS0tXG4gICAgICAgICAgICAvLyBUaGUgcHJvYmxlbSB3aXRoIDFzdCBmcmFtZSByZW5kZXIgaXMgdGhhdCB3ZSBpbml0IHRoZSBzaGFkZXIgd2l0aG91dCBoYXZpbmcgYW55IGNhbWVyYSBzZXQgdG8gZW1pdHRlciAtXG4gICAgICAgICAgICAvLyBzbyB3cm9uZyBzaGFkZXIgaXMgYmVpbmcgY29tcGlsZWQuXG4gICAgICAgICAgICAvLyBUbyBmaXggaXQsIHdlIG5lZWQgdG8gY2hlY2sgYWN0aXZlQ2FtZXJhIT1lbWl0dGVyLmNhbWVyYSBpbiBzaGFkZXIgaW5pdCB0b29cbiAgICAgICAgICAgIGlmICh0aGlzLmVtaXR0ZXIuc2NlbmUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyLmNhbWVyYSAhPT0gdGhpcy5lbWl0dGVyLnNjZW5lLl9hY3RpdmVDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmNhbWVyYSA9IHRoaXMuZW1pdHRlci5zY2VuZS5fYWN0aXZlQ2FtZXJhO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXR0ZXIub25DaGFuZ2VDYW1lcmEoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBieSBFZGl0b3IgaWYgcnVubmluZyBpbnNpZGUgZWRpdG9yXG4gICAgICAgICAgICBjb25zdCBpblRvb2xzID0gdGhpcy5lbWl0dGVyLmluVG9vbHM7XG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzaW5nT3B0aW9ucyA9IG5ldyBTaGFkZXJQcm9jZXNzb3JPcHRpb25zKHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KTtcblxuICAgICAgICAgICAgY29uc3Qgc2hhZGVyID0gcHJvZ3JhbUxpYi5nZXRQcm9ncmFtKCdwYXJ0aWNsZScsIHtcbiAgICAgICAgICAgICAgICB1c2VDcHU6IHRoaXMuZW1pdHRlci51c2VDcHUsXG4gICAgICAgICAgICAgICAgbm9ybWFsOiB0aGlzLmVtaXR0ZXIubm9ybWFsT3B0aW9uLFxuICAgICAgICAgICAgICAgIGhhbGZsYW1iZXJ0OiB0aGlzLmVtaXR0ZXIuaGFsZkxhbWJlcnQsXG4gICAgICAgICAgICAgICAgc3RyZXRjaDogdGhpcy5lbWl0dGVyLnN0cmV0Y2gsXG4gICAgICAgICAgICAgICAgYWxpZ25Ub01vdGlvbjogdGhpcy5lbWl0dGVyLmFsaWduVG9Nb3Rpb24sXG4gICAgICAgICAgICAgICAgc29mdDogdGhpcy5lbWl0dGVyLmRlcHRoU29mdGVuaW5nLFxuICAgICAgICAgICAgICAgIG1lc2g6IHRoaXMuZW1pdHRlci51c2VNZXNoLFxuICAgICAgICAgICAgICAgIGdhbW1hOiB0aGlzLmVtaXR0ZXIuc2NlbmUgPyB0aGlzLmVtaXR0ZXIuc2NlbmUuZ2FtbWFDb3JyZWN0aW9uIDogMCxcbiAgICAgICAgICAgICAgICB0b25lTWFwOiB0aGlzLmVtaXR0ZXIuc2NlbmUgPyB0aGlzLmVtaXR0ZXIuc2NlbmUudG9uZU1hcHBpbmcgOiAwLFxuICAgICAgICAgICAgICAgIGZvZzogKHRoaXMuZW1pdHRlci5zY2VuZSAmJiAhdGhpcy5lbWl0dGVyLm5vRm9nKSA/IHRoaXMuZW1pdHRlci5zY2VuZS5mb2cgOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgd3JhcDogdGhpcy5lbWl0dGVyLndyYXAgJiYgdGhpcy5lbWl0dGVyLndyYXBCb3VuZHMsXG4gICAgICAgICAgICAgICAgbG9jYWxTcGFjZTogdGhpcy5lbWl0dGVyLmxvY2FsU3BhY2UsXG5cbiAgICAgICAgICAgICAgICAvLyBpbiBFZGl0b3IsIHNjcmVlbiBzcGFjZSBwYXJ0aWNsZXMgKGNoaWxkcmVuIG9mIDJEIFNjcmVlbikgYXJlIHN0aWxsIHJlbmRlcmVkIGluIDNkIHNwYWNlXG4gICAgICAgICAgICAgICAgc2NyZWVuU3BhY2U6IGluVG9vbHMgPyBmYWxzZSA6IHRoaXMuZW1pdHRlci5zY3JlZW5TcGFjZSxcblxuICAgICAgICAgICAgICAgIGJsZW5kOiB0aGlzLmJsZW5kVHlwZSxcbiAgICAgICAgICAgICAgICBhbmltVGV4OiB0aGlzLmVtaXR0ZXIuX2lzQW5pbWF0ZWQoKSxcbiAgICAgICAgICAgICAgICBhbmltVGV4TG9vcDogdGhpcy5lbWl0dGVyLmFuaW1Mb29wLFxuICAgICAgICAgICAgICAgIHBhY2s4OiB0aGlzLmVtaXR0ZXIucGFjazgsXG4gICAgICAgICAgICAgICAgY3VzdG9tRmFjZTogdGhpcy5lbWl0dGVyLm9yaWVudGF0aW9uICE9PSBQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTlxuICAgICAgICAgICAgfSwgcHJvY2Vzc2luZ09wdGlvbnMpO1xuXG4gICAgICAgICAgICByZXR1cm4gc2hhZGVyO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnNoYWRlciA9IHRoaXMubWF0ZXJpYWwuZ2V0U2hhZGVyVmFyaWFudCgpO1xuICAgIH1cblxuICAgIHJlc2V0TWF0ZXJpYWwoKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbDtcblxuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3N0cmV0Y2gnLCB0aGlzLnN0cmV0Y2gpO1xuICAgICAgICBpZiAodGhpcy5faXNBbmltYXRlZCgpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FuaW1UZXhUaWxlc1BhcmFtcycsIHRoaXMuYW5pbVRpbGVzUGFyYW1zKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignYW5pbVRleFBhcmFtcycsIHRoaXMuYW5pbVBhcmFtcyk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FuaW1UZXhJbmRleFBhcmFtcycsIHRoaXMuYW5pbUluZGV4UGFyYW1zKTtcbiAgICAgICAgfVxuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2NvbG9yTXVsdCcsIHRoaXMuaW50ZW5zaXR5KTtcbiAgICAgICAgaWYgKCF0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbnRlcm5hbFRleDAnLCB0aGlzLmludGVybmFsVGV4MCk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2ludGVybmFsVGV4MScsIHRoaXMuaW50ZXJuYWxUZXgxKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignaW50ZXJuYWxUZXgyJywgdGhpcy5pbnRlcm5hbFRleDIpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbnRlcm5hbFRleDMnLCB0aGlzLmludGVybmFsVGV4Myk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdjb2xvclBhcmFtJywgdGhpcy5jb2xvclBhcmFtKTtcblxuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ251bVBhcnRpY2xlcycsIHRoaXMubnVtUGFydGljbGVzKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdudW1QYXJ0aWNsZXNQb3QnLCB0aGlzLm51bVBhcnRpY2xlc1BvdCk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbGlmZXRpbWUnLCB0aGlzLmxpZmV0aW1lKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdyYXRlJywgdGhpcy5yYXRlKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdyYXRlRGl2JywgdGhpcy5yYXRlMiAtIHRoaXMucmF0ZSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignc2VlZCcsIHRoaXMuc2VlZCk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignc2NhbGVEaXZNdWx0JywgdGhpcy5zY2FsZVVNYXhbMF0pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2FscGhhRGl2TXVsdCcsIHRoaXMuYWxwaGFVTWF4WzBdKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdyYWRpYWxTcGVlZERpdk11bHQnLCB0aGlzLnJhZGlhbFNwZWVkVU1heFswXSk7XG4gICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZ3JhcGhOdW1TYW1wbGVzJywgdGhpcy5wcmVjaXNpb24pO1xuICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2dyYXBoU2FtcGxlU2l6ZScsIDEuMCAvIHRoaXMucHJlY2lzaW9uKTtcbiAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdlbWl0dGVyU2NhbGUnLCBuZXcgRmxvYXQzMkFycmF5KFsxLCAxLCAxXSkpO1xuXG4gICAgICAgIGlmICh0aGlzLnBhY2s4KSB7XG4gICAgICAgICAgICB0aGlzLl9ncHVVcGRhdGVyLl9zZXRJbnB1dEJvdW5kcygpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbkJvdW5kc1NpemUnLCB0aGlzLl9ncHVVcGRhdGVyLmluQm91bmRzU2l6ZVVuaWZvcm0pO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdpbkJvdW5kc0NlbnRlcicsIHRoaXMuX2dwdVVwZGF0ZXIuaW5Cb3VuZHNDZW50ZXJVbmlmb3JtKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbWF4VmVsJywgdGhpcy5tYXhWZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud3JhcCAmJiB0aGlzLndyYXBCb3VuZHMpIHtcbiAgICAgICAgICAgIHRoaXMud3JhcEJvdW5kc1VuaWZvcm1bMF0gPSB0aGlzLndyYXBCb3VuZHMueDtcbiAgICAgICAgICAgIHRoaXMud3JhcEJvdW5kc1VuaWZvcm1bMV0gPSB0aGlzLndyYXBCb3VuZHMueTtcbiAgICAgICAgICAgIHRoaXMud3JhcEJvdW5kc1VuaWZvcm1bMl0gPSB0aGlzLndyYXBCb3VuZHMuejtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignd3JhcEJvdW5kcycsIHRoaXMud3JhcEJvdW5kc1VuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29sb3JNYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignY29sb3JNYXAnLCB0aGlzLmNvbG9yTWFwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5ub3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ25vcm1hbE1hcCcsIHRoaXMubm9ybWFsTWFwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5kZXB0aFNvZnRlbmluZyA+IDApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignc29mdGVuaW5nJywgMS4wIC8gKHRoaXMuZGVwdGhTb2Z0ZW5pbmcgKiB0aGlzLmRlcHRoU29mdGVuaW5nICogMTAwKSk7IC8vIHJlbWFwIHRvIG1vcmUgcGVyY2VwdHVhbGx5IGxpbmVhclxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0cmV0Y2ggPiAwLjApIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9OT05FO1xuXG4gICAgICAgIHRoaXMuX2NvbXBQYXJ0aWNsZUZhY2VQYXJhbXMoKTtcbiAgICB9XG5cbiAgICBfY29tcFBhcnRpY2xlRmFjZVBhcmFtcygpIHtcbiAgICAgICAgbGV0IHRhbmdlbnQsIGJpbm9ybWFsO1xuICAgICAgICBpZiAodGhpcy5vcmllbnRhdGlvbiA9PT0gUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4pIHtcbiAgICAgICAgICAgIHRhbmdlbnQgPSBuZXcgRmxvYXQzMkFycmF5KFsxLCAwLCAwXSk7XG4gICAgICAgICAgICBiaW5vcm1hbCA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsIDFdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBuO1xuICAgICAgICAgICAgaWYgKHRoaXMub3JpZW50YXRpb24gPT09IFBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQpIHtcbiAgICAgICAgICAgICAgICBuID0gdGhpcy5wYXJ0aWNsZU5vcm1hbC5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW1pdHRlck1hdCA9IHRoaXMubm9kZSA9PT0gbnVsbCA/XG4gICAgICAgICAgICAgICAgICAgIE1hdDQuSURFTlRJVFkgOiB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgICAgICBuID0gZW1pdHRlck1hdC50cmFuc2Zvcm1WZWN0b3IodGhpcy5wYXJ0aWNsZU5vcm1hbCkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0ID0gbmV3IFZlYzMoMSwgMCwgMCk7XG4gICAgICAgICAgICBpZiAoTWF0aC5hYnModC5kb3QobikpID09PSAxKVxuICAgICAgICAgICAgICAgIHQuc2V0KDAsIDAsIDEpO1xuICAgICAgICAgICAgY29uc3QgYiA9IG5ldyBWZWMzKCkuY3Jvc3MobiwgdCkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB0LmNyb3NzKGIsIG4pLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdGFuZ2VudCA9IG5ldyBGbG9hdDMyQXJyYXkoW3QueCwgdC55LCB0LnpdKTtcbiAgICAgICAgICAgIGJpbm9ybWFsID0gbmV3IEZsb2F0MzJBcnJheShbYi54LCBiLnksIGIuel0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdmYWNlVGFuZ2VudCcsIHRhbmdlbnQpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZmFjZUJpbm9ybScsIGJpbm9ybWFsKTtcbiAgICB9XG5cbiAgICAvLyBEZWNsYXJlcyB2ZXJ0ZXggZm9ybWF0LCBjcmVhdGVzIFZCIGFuZCBJQlxuICAgIF9hbGxvY2F0ZShudW1QYXJ0aWNsZXMpIHtcbiAgICAgICAgY29uc3QgcHN5c1ZlcnRDb3VudCA9IG51bVBhcnRpY2xlcyAqIHRoaXMubnVtUGFydGljbGVWZXJ0cztcbiAgICAgICAgY29uc3QgcHN5c0luZGV4Q291bnQgPSBudW1QYXJ0aWNsZXMgKiB0aGlzLm51bVBhcnRpY2xlSW5kaWNlcztcblxuICAgICAgICBpZiAoKHRoaXMudmVydGV4QnVmZmVyID09PSB1bmRlZmluZWQpIHx8ICh0aGlzLnZlcnRleEJ1ZmZlci5nZXROdW1WZXJ0aWNlcygpICE9PSBwc3lzVmVydENvdW50KSkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBwYXJ0aWNsZSB2ZXJ0ZXggZm9ybWF0XG4gICAgICAgICAgICBpZiAoIXRoaXMudXNlQ3B1KSB7XG4gICAgICAgICAgICAgICAgLy8gR1BVOiBYWVogPSBxdWFkIHZlcnRleCBwb3NpdGlvbjsgVyA9IElOVDogcGFydGljbGUgSUQsIEZSQUM6IHJhbmRvbSBmYWN0b3JcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IFt7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogNCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfV07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRpY2xlRm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBlbGVtZW50cyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIodGhpcy5ncmFwaGljc0RldmljZSwgcGFydGljbGVGb3JtYXQsIHBzeXNWZXJ0Q291bnQsIEJVRkZFUl9EWU5BTUlDKTtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIElOREVYRk9STUFUX1VJTlQxNiwgcHN5c0luZGV4Q291bnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IFt7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogNCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjEsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IDQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgc2VtYW50aWM6IFNFTUFOVElDX0FUVFIyLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiA0LFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBTRU1BTlRJQ19BVFRSMyxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogMSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBzZW1hbnRpYzogU0VNQU5USUNfQVRUUjQsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IHRoaXMudXNlTWVzaCA/IDQgOiAyLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICAgICAgICAgICAgICB9XTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0aWNsZUZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcy5ncmFwaGljc0RldmljZSwgZWxlbWVudHMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIHBhcnRpY2xlRm9ybWF0LCBwc3lzVmVydENvdW50LCBCVUZGRVJfRFlOQU1JQyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLmdyYXBoaWNzRGV2aWNlLCBJTkRFWEZPUk1BVF9VSU5UMTYsIHBzeXNJbmRleENvdW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRmlsbCB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXIubG9jaygpKTtcbiAgICAgICAgICAgIGxldCBtZXNoRGF0YSwgc3RyaWRlLCB0ZXhDb29yZE9mZnNldDtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICBtZXNoRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5sb2NrKCkpO1xuICAgICAgICAgICAgICAgIHN0cmlkZSA9IG1lc2hEYXRhLmxlbmd0aCAvIHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZWxlbSA9IDA7IGVsZW0gPCB0aGlzLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7IGVsZW0rKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbZWxlbV0ubmFtZSA9PT0gU0VNQU5USUNfVEVYQ09PUkQwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXhDb29yZE9mZnNldCA9IHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2VsZW1dLm9mZnNldCAvIDQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwc3lzVmVydENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IE1hdGguZmxvb3IoaSAvIHRoaXMubnVtUGFydGljbGVWZXJ0cyk7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnVzZU1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVydElEID0gaSAlIDQ7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDRdID0gcGFydGljbGVWZXJ0c1t2ZXJ0SURdWzBdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA0ICsgMV0gPSBwYXJ0aWNsZVZlcnRzW3ZlcnRJRF1bMV07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDQgKyAyXSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDQgKyAzXSA9IGlkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnQgPSBpICUgdGhpcy5udW1QYXJ0aWNsZVZlcnRzO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2XSA9IG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGVdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgMV0gPSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgMV07XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyAyXSA9IG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGUgKyAyXTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtpICogNiArIDNdID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbaSAqIDYgKyA0XSA9IG1lc2hEYXRhW3ZlcnQgKiBzdHJpZGUgKyB0ZXhDb29yZE9mZnNldCArIDBdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW2kgKiA2ICsgNV0gPSAxLjAgLSBtZXNoRGF0YVt2ZXJ0ICogc3RyaWRlICsgdGV4Q29vcmRPZmZzZXQgKyAxXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnVzZUNwdSkge1xuICAgICAgICAgICAgICAgIHRoaXMudmJDUFUgPSBuZXcgRmxvYXQzMkFycmF5KGRhdGEpO1xuICAgICAgICAgICAgICAgIHRoaXMudmJPbGQgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMudmJDUFUubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWVzaC52ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbGwgdGhlIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgbGV0IGRzdCA9IDA7XG4gICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuaW5kZXhCdWZmZXIubG9jaygpKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnVzZU1lc2gpIG1lc2hEYXRhID0gbmV3IFVpbnQxNkFycmF5KHRoaXMubWVzaC5pbmRleEJ1ZmZlclswXS5sb2NrKCkpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1QYXJ0aWNsZXM7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy51c2VNZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VJbmRleCA9IGkgKiA0O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tkc3QrK10gPSBiYXNlSW5kZXggKyAxO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleCArIDI7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2RzdCsrXSA9IGJhc2VJbmRleCArIDI7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbZHN0KytdID0gYmFzZUluZGV4ICsgMztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMubnVtUGFydGljbGVJbmRpY2VzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGljZXNbaSAqIHRoaXMubnVtUGFydGljbGVJbmRpY2VzICsgal0gPSBtZXNoRGF0YVtqXSArIGkgKiB0aGlzLm51bVBhcnRpY2xlVmVydHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICAgICAgaWYgKHRoaXMudXNlTWVzaCkgdGhpcy5tZXNoLmluZGV4QnVmZmVyWzBdLnVubG9jaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIHRoaXMuYmVlblJlc2V0ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zZWVkID0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ3NlZWQnLCB0aGlzLnNlZWQpO1xuICAgICAgICBpZiAodGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFtpXSA9IHRoaXMucGFydGljbGVUZXhTdGFydFtpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2luaXRpYWxpemVUZXh0dXJlcygpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVzZXRXb3JsZEJvdW5kcygpO1xuICAgICAgICB0aGlzLnJlc2V0VGltZSgpO1xuICAgICAgICBjb25zdCBvcmlnTG9vcCA9IHRoaXMubG9vcDtcbiAgICAgICAgdGhpcy5sb29wID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hZGRUaW1lKDAsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5sb29wID0gb3JpZ0xvb3A7XG4gICAgICAgIGlmICh0aGlzLnByZVdhcm0pIHtcbiAgICAgICAgICAgIHRoaXMucHJld2FybSh0aGlzLmxpZmV0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByZXdhcm0odGltZSkge1xuICAgICAgICBjb25zdCBsaWZldGltZUZyYWN0aW9uID0gdGltZSAvIHRoaXMubGlmZXRpbWU7XG4gICAgICAgIGNvbnN0IGl0ZXJhdGlvbnMgPSBNYXRoLm1pbihNYXRoLmZsb29yKGxpZmV0aW1lRnJhY3Rpb24gKiB0aGlzLnByZWNpc2lvbiksIHRoaXMucHJlY2lzaW9uKTtcbiAgICAgICAgY29uc3Qgc3RlcERlbHRhID0gdGltZSAvIGl0ZXJhdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlcmF0aW9uczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFRpbWUoc3RlcERlbHRhLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXNldFRpbWUoKSB7XG4gICAgICAgIHRoaXMuZW5kVGltZSA9IGNhbGNFbmRUaW1lKHRoaXMpO1xuICAgIH1cblxuICAgIGZpbmlzaEZyYW1lKCkge1xuICAgICAgICBpZiAodGhpcy51c2VDcHUpIHRoaXMudmVydGV4QnVmZmVyLnVubG9jaygpO1xuICAgIH1cblxuICAgIGFkZFRpbWUoZGVsdGEsIGlzT25TdG9wKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5zaW1UaW1lVG90YWwgKz0gZGVsdGE7XG5cbiAgICAgICAgdGhpcy5jYWxjdWxhdGVXb3JsZEJvdW5kcygpO1xuXG4gICAgICAgIGlmICh0aGlzLl9pc0FuaW1hdGVkKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHRpbGVzUGFyYW1zID0gdGhpcy5hbmltVGlsZXNQYXJhbXM7XG4gICAgICAgICAgICB0aWxlc1BhcmFtc1swXSA9IDEuMCAvIHRoaXMuYW5pbVRpbGVzWDsgLy8gYW5pbVRleFRpbGVzUGFyYW1zLnhcbiAgICAgICAgICAgIHRpbGVzUGFyYW1zWzFdID0gMS4wIC8gdGhpcy5hbmltVGlsZXNZOyAvLyBhbmltVGV4VGlsZXNQYXJhbXMueVxuXG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSB0aGlzLmFuaW1QYXJhbXM7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSB0aGlzLmFuaW1TdGFydEZyYW1lOyAvLyBhbmltVGV4UGFyYW1zLnhcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IHRoaXMuYW5pbU51bUZyYW1lcyAqIHRoaXMuYW5pbVNwZWVkOyAvLyBhbmltVGV4UGFyYW1zLnlcbiAgICAgICAgICAgIHBhcmFtc1syXSA9IHRoaXMuYW5pbU51bUZyYW1lcyAtIDE7IC8vIGFuaW1UZXhQYXJhbXMuelxuICAgICAgICAgICAgcGFyYW1zWzNdID0gdGhpcy5hbmltTnVtQW5pbWF0aW9ucyAtIDE7IC8vIGFuaW1UZXhQYXJhbXMud1xuXG4gICAgICAgICAgICBjb25zdCBhbmltSW5kZXhQYXJhbXMgPSB0aGlzLmFuaW1JbmRleFBhcmFtcztcbiAgICAgICAgICAgIGFuaW1JbmRleFBhcmFtc1swXSA9IHRoaXMuYW5pbUluZGV4OyAvLyBhbmltVGV4SW5kZXhQYXJhbXMueFxuICAgICAgICAgICAgYW5pbUluZGV4UGFyYW1zWzFdID0gdGhpcy5yYW5kb21pemVBbmltSW5kZXg7IC8vIGFuaW1UZXhJbmRleFBhcmFtcy55XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zY2VuZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuY2FtZXJhICE9PSB0aGlzLnNjZW5lLl9hY3RpdmVDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbWVyYSA9IHRoaXMuc2NlbmUuX2FjdGl2ZUNhbWVyYTtcbiAgICAgICAgICAgICAgICB0aGlzLm9uQ2hhbmdlQ2FtZXJhKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyU2hhcGUgPT09IEVNSVRURVJTSEFQRV9CT1gpIHtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVswXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueCAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci54IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy54IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsxXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueSAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci55IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy55IDogMDtcbiAgICAgICAgICAgIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybVsyXSA9IHRoaXMuZW1pdHRlckV4dGVudHMueiAhPT0gMCA/IHRoaXMuZW1pdHRlckV4dGVudHNJbm5lci56IC8gdGhpcy5lbWl0dGVyRXh0ZW50cy56IDogMDtcbiAgICAgICAgICAgIGlmICh0aGlzLm1lc2hJbnN0YW5jZS5ub2RlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc3Bhd25NYXRyaXguc2V0VFJTKFZlYzMuWkVSTywgUXVhdC5JREVOVElUWSwgdGhpcy5lbWl0dGVyRXh0ZW50cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNwYXduTWF0cml4LnNldFRSUyhWZWMzLlpFUk8sIHRoaXMubWVzaEluc3RhbmNlLm5vZGUuZ2V0Um90YXRpb24oKSwgdG1wVmVjMy5jb3B5KHRoaXMuZW1pdHRlckV4dGVudHMpLm11bCh0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmxvY2FsU2NhbGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBlbWl0dGVyUG9zO1xuICAgICAgICBjb25zdCBlbWl0dGVyU2NhbGUgPSB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlID09PSBudWxsID8gVmVjMy5PTkUgOiB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmxvY2FsU2NhbGU7XG4gICAgICAgIHRoaXMuZW1pdHRlclNjYWxlVW5pZm9ybVswXSA9IGVtaXR0ZXJTY2FsZS54O1xuICAgICAgICB0aGlzLmVtaXR0ZXJTY2FsZVVuaWZvcm1bMV0gPSBlbWl0dGVyU2NhbGUueTtcbiAgICAgICAgdGhpcy5lbWl0dGVyU2NhbGVVbmlmb3JtWzJdID0gZW1pdHRlclNjYWxlLno7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdlbWl0dGVyU2NhbGUnLCB0aGlzLmVtaXR0ZXJTY2FsZVVuaWZvcm0pO1xuICAgICAgICBpZiAodGhpcy5sb2NhbFNwYWNlICYmIHRoaXMubWVzaEluc3RhbmNlLm5vZGUpIHtcbiAgICAgICAgICAgIGVtaXR0ZXJQb3MgPSB0aGlzLm1lc2hJbnN0YW5jZS5ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJQb3NVbmlmb3JtWzBdID0gZW1pdHRlclBvcy54O1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyUG9zVW5pZm9ybVsxXSA9IGVtaXR0ZXJQb3MueTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlclBvc1VuaWZvcm1bMl0gPSBlbWl0dGVyUG9zLno7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsLnNldFBhcmFtZXRlcignZW1pdHRlclBvcycsIHRoaXMuZW1pdHRlclBvc1VuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29tcFBhcnRpY2xlRmFjZVBhcmFtcygpO1xuXG4gICAgICAgIGlmICghdGhpcy51c2VDcHUpIHtcbiAgICAgICAgICAgIHRoaXMuX2dwdVVwZGF0ZXIudXBkYXRlKGRldmljZSwgc3Bhd25NYXRyaXgsIGV4dGVudHNJbm5lclJhdGlvVW5pZm9ybSwgZGVsdGEsIGlzT25TdG9wKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMudmVydGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICB0aGlzLl9jcHVVcGRhdGVyLnVwZGF0ZShkYXRhLCB0aGlzLnZiVG9Tb3J0LCB0aGlzLnBhcnRpY2xlVGV4LCBzcGF3bk1hdHJpeCwgZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtLCBlbWl0dGVyUG9zLCBkZWx0YSwgaXNPblN0b3ApO1xuICAgICAgICAgICAgLy8gdGhpcy52ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMubG9vcCkge1xuICAgICAgICAgICAgaWYgKERhdGUubm93KCkgPiB0aGlzLmVuZFRpbWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vbkZpbmlzaGVkKSB0aGlzLm9uRmluaXNoZWQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHRoaXMuZHJhd09yZGVyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9hZGRUaW1lVGltZSArPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgX2Rlc3Ryb3lSZXNvdXJjZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcnRpY2xlVGV4SU4pIHtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhJTi5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4SU4gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGFydGljbGVUZXhPVVQpIHtcbiAgICAgICAgICAgIHRoaXMucGFydGljbGVUZXhPVVQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleE9VVCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wYXJ0aWNsZVRleFN0YXJ0ICYmIHRoaXMucGFydGljbGVUZXhTdGFydC5kZXN0cm95KSB7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2xlVGV4U3RhcnQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5wYXJ0aWNsZVRleFN0YXJ0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJ0UGFydGljbGVUZXhJTikge1xuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4SU4uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4SU4gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucnRQYXJ0aWNsZVRleE9VVCkge1xuICAgICAgICAgICAgdGhpcy5ydFBhcnRpY2xlVGV4T1VULmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMucnRQYXJ0aWNsZVRleE9VVCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbnRlcm5hbFRleDApIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgwLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgwID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmludGVybmFsVGV4MSkge1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDEuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbFRleDEgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJuYWxUZXgyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4Mi5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsVGV4MiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5pbnRlcm5hbFRleDMpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxUZXgzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbG9yUGFyYW0pIHtcbiAgICAgICAgICAgIHRoaXMuY29sb3JQYXJhbS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmNvbG9yUGFyYW0gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IHVuZGVmaW5lZDsgLy8gd2UgYXJlIHRlc3RpbmcgaWYgdmIgaXMgdW5kZWZpbmVkIGluIHNvbWUgY29kZSwgbm8gaWRlYSB3aHlcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5tYXRlcmlhbCkge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vdGU6IHNoYWRlcnMgc2hvdWxkIG5vdCBiZSBkZXN0cm95ZWQgYXMgdGhleSBjb3VsZCBiZSBzaGFyZWQgYmV0d2VlbiBlbWl0dGVyc1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuY2FtZXJhID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9kZXN0cm95UmVzb3VyY2VzKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQYXJ0aWNsZUVtaXR0ZXIgfTtcbiJdLCJuYW1lcyI6WyJwYXJ0aWNsZVZlcnRzIiwiX2NyZWF0ZVRleHR1cmUiLCJkZXZpY2UiLCJ3aWR0aCIsImhlaWdodCIsInBpeGVsRGF0YSIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJtdWx0OEJpdCIsImZpbHRlciIsIm1pcEZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwiUElYRUxGT1JNQVRfUkdCQTgiLCJGSUxURVJfTElORUFSIiwidGV4dHVyZSIsIlRleHR1cmUiLCJjdWJlbWFwIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJuYW1lIiwicGl4ZWxzIiwibG9jayIsInRlbXAiLCJVaW50OEFycmF5IiwibGVuZ3RoIiwiaSIsInNldCIsInVubG9jayIsInNhdHVyYXRlIiwieCIsIk1hdGgiLCJtYXgiLCJtaW4iLCJkZWZhdWx0MEN1cnZlIiwiQ3VydmUiLCJkZWZhdWx0MUN1cnZlIiwiZGVmYXVsdDBDdXJ2ZTMiLCJDdXJ2ZVNldCIsImRlZmF1bHQxQ3VydmUzIiwicGFydGljbGVUZXhIZWlnaHQiLCJwYXJ0aWNsZVRleENoYW5uZWxzIiwiZXh0ZW50c0lubmVyUmF0aW9Vbmlmb3JtIiwiRmxvYXQzMkFycmF5Iiwic3Bhd25NYXRyaXgiLCJNYXQ0IiwidG1wVmVjMyIsIlZlYzMiLCJiTWluIiwiYk1heCIsInNldFByb3BlcnR5VGFyZ2V0Iiwic2V0UHJvcGVydHlPcHRpb25zIiwic2V0UHJvcGVydHkiLCJwTmFtZSIsImRlZmF1bHRWYWwiLCJ1bmRlZmluZWQiLCJwYWNrM05GbG9hdHMiLCJhIiwiYiIsImMiLCJwYWNrZWQiLCJwYWNrVGV4dHVyZVhZWl9OWFlaIiwicVhZWiIsInFYWVoyIiwibnVtIiwiY29sb3JzIiwiQXJyYXkiLCJwYWNrVGV4dHVyZVJHQkEiLCJxUkdCIiwicUEiLCJwYWNrVGV4dHVyZTVGbG9hdHMiLCJxQiIsInFDIiwicUQiLCJxRSIsInBhY2tUZXh0dXJlMkZsb2F0cyIsImNhbGNFbmRUaW1lIiwiZW1pdHRlciIsImludGVydmFsIiwicmF0ZSIsInJhdGUyIiwibnVtUGFydGljbGVzIiwibGlmZXRpbWUiLCJEYXRlIiwibm93Iiwic3ViR3JhcGgiLCJBIiwiQiIsInIiLCJtYXhVbnNpZ25lZEdyYXBoVmFsdWUiLCJvdXRVTWF4IiwiY2hhbnMiLCJ2YWx1ZXMiLCJqIiwiYWJzIiwibm9ybWFsaXplR3JhcGgiLCJ1TWF4IiwiZGl2R3JhcGhGcm9tMkN1cnZlcyIsImN1cnZlMSIsImN1cnZlMiIsInN1YiIsInBhcnRpY2xlRW1pdHRlckRldmljZUNhY2hlIiwiRGV2aWNlQ2FjaGUiLCJQYXJ0aWNsZUVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwib3B0aW9ucyIsImdkIiwicHJlY2lzaW9uIiwiX2FkZFRpbWVUaW1lIiwibWF4VGV4dHVyZVNpemUiLCJEZWJ1ZyIsIndhcm4iLCJFTUlUVEVSU0hBUEVfQk9YIiwiZGVmYXVsdFBhcmFtVGV4dHVyZSIsIlBBUlRJQ0xFU09SVF9OT05FIiwiUEFSVElDTEVNT0RFX0dQVSIsIlBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOIiwiQkxFTkRfTk9STUFMIiwic3RhcnRBbmdsZSIsIl9ncHVVcGRhdGVyIiwiUGFydGljbGVHUFVVcGRhdGVyIiwiX2NwdVVwZGF0ZXIiLCJQYXJ0aWNsZUNQVVVwZGF0ZXIiLCJjb25zdGFudExpZ2h0Q3ViZSIsInNjb3BlIiwicmVzb2x2ZSIsImVtaXR0ZXJQb3NVbmlmb3JtIiwid3JhcEJvdW5kc1VuaWZvcm0iLCJlbWl0dGVyU2NhbGVVbmlmb3JtIiwiY29sb3JHcmFwaCIsInNjYWxlR3JhcGgiLCJhbHBoYUdyYXBoIiwibG9jYWxWZWxvY2l0eUdyYXBoIiwidmVsb2NpdHlHcmFwaCIsInJvdGF0aW9uU3BlZWRHcmFwaCIsInJhZGlhbFNwZWVkR3JhcGgiLCJsaWdodEN1YmUiLCJsaWdodEN1YmVEaXIiLCJhbmltVGlsZXNQYXJhbXMiLCJhbmltUGFyYW1zIiwiYW5pbUluZGV4UGFyYW1zIiwiaW50ZXJuYWxUZXgwIiwiaW50ZXJuYWxUZXgxIiwiaW50ZXJuYWxUZXgyIiwiY29sb3JQYXJhbSIsInZiVG9Tb3J0IiwidmJPbGQiLCJwYXJ0aWNsZURpc3RhbmNlIiwiY2FtZXJhIiwic3dhcFRleCIsInVzZU1lc2giLCJ1c2VDcHUiLCJzdXBwb3J0c0dwdVBhcnRpY2xlcyIsInBhY2s4IiwibG9jYWxCb3VuZHMiLCJCb3VuZGluZ0JveCIsIndvcmxkQm91bmRzTm9UcmFpbCIsIndvcmxkQm91bmRzVHJhaWwiLCJ3b3JsZEJvdW5kcyIsIndvcmxkQm91bmRzU2l6ZSIsInByZXZXb3JsZEJvdW5kc1NpemUiLCJwcmV2V29ybGRCb3VuZHNDZW50ZXIiLCJwcmV2RW1pdHRlckV4dGVudHMiLCJlbWl0dGVyRXh0ZW50cyIsInByZXZFbWl0dGVyUmFkaXVzIiwiZW1pdHRlclJhZGl1cyIsIndvcmxkQm91bmRzTXVsIiwid29ybGRCb3VuZHNBZGQiLCJ0aW1lVG9Td2l0Y2hCb3VuZHMiLCJzaGFkZXJQYXJ0aWNsZVVwZGF0ZVJlc3Bhd24iLCJzaGFkZXJQYXJ0aWNsZVVwZGF0ZU5vUmVzcGF3biIsInNoYWRlclBhcnRpY2xlVXBkYXRlT25TdG9wIiwibnVtUGFydGljbGVWZXJ0cyIsIm51bVBhcnRpY2xlSW5kaWNlcyIsIm1hdGVyaWFsIiwibWVzaEluc3RhbmNlIiwiZHJhd09yZGVyIiwic2VlZCIsInJhbmRvbSIsImZpeGVkVGltZVN0ZXAiLCJtYXhTdWJTdGVwcyIsInNpbVRpbWUiLCJzaW1UaW1lVG90YWwiLCJiZWVuUmVzZXQiLCJfbGF5ZXIiLCJyZWJ1aWxkIiwiYXNzZXJ0IiwiZ2V0IiwicmVzb2x1dGlvbiIsImNlbnRlclBvaW50IiwiZHRleCIsInkiLCJ4Z3JhZCIsInlncmFkIiwic3FydCIsInAiLCJvbkNoYW5nZUNhbWVyYSIsInJlZ2VuU2hhZGVyIiwicmVzZXRNYXRlcmlhbCIsImNhbGN1bGF0ZUJvdW5kc01hZCIsInoiLCJjb3B5IiwiY2VudGVyIiwibXVsIiwibXVsU2NhbGFyIiwiY2FsY3VsYXRlV29ybGRCb3VuZHMiLCJub2RlIiwicmVjYWxjdWxhdGVMb2NhbEJvdW5kcyIsImVtaXR0ZXJTaGFwZSIsImVxdWFscyIsImNhbGN1bGF0ZUxvY2FsQm91bmRzIiwibm9kZVdUIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJsb2NhbFNwYWNlIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImFkZCIsImhhbGZFeHRlbnRzIiwiYWFiYiIsIm1lc2giLCJfYWFiYlZlciIsInJlc2V0V29ybGRCb3VuZHMiLCJJREVOVElUWSIsIm1pbngiLCJOdW1iZXIiLCJNQVhfVkFMVUUiLCJtaW55IiwibWlueiIsIm1heHgiLCJtYXh5IiwibWF4eiIsIm1heFIiLCJtYXhTY2FsZSIsInN0ZXBXZWlnaHQiLCJ3VmVscyIsInFWZWxvY2l0eSIsInFWZWxvY2l0eTIiLCJsVmVscyIsInFMb2NhbFZlbG9jaXR5IiwicUxvY2FsVmVsb2NpdHkyIiwiYWNjdW1YIiwiYWNjdW1ZIiwiYWNjdW1aIiwiYWNjdW1SIiwiYWNjdW1XIiwiaW5kZXgiLCJxUmFkaWFsU3BlZWQiLCJxUmFkaWFsU3BlZWQyIiwicVNjYWxlIiwidyIsInNldE1pbk1heCIsImNvbG9yTWFwIiwic3Bhd25Cb3VuZHMiLCJzb3J0IiwibWF4VmVydGV4VGV4dHVyZXMiLCJmcmFnbWVudFVuaWZvcm1zQ291bnQiLCJmb3JjZUNwdVBhcnRpY2xlcyIsImV4dFRleHR1cmVGbG9hdCIsIl9kZXN0cm95UmVzb3VyY2VzIiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsInRvdGFsVmVydENvdW50IiwidmVydGV4QnVmZmVyIiwibnVtVmVydGljZXMiLCJudW1QYXJ0aWNsZXNQb3QiLCJtYXRoIiwibmV4dFBvd2VyT2ZUd28iLCJyZWJ1aWxkR3JhcGhzIiwiaVNvcnQiLCJyYW5kb21pemUiLCJwYXJ0aWNsZVRleCIsImVtaXR0ZXJQb3MiLCJaRVJPIiwiZ2V0UG9zaXRpb24iLCJzZXRUUlMiLCJRdWF0IiwiZ2V0Um90YXRpb24iLCJsb2NhbFNjYWxlIiwiZW1pdHRlckV4dGVudHNJbm5lciIsImNhbGNTcGF3blBvc2l0aW9uIiwicGFydGljbGVUZXhTdGFydCIsInBhcnRpY2xlVGV4SU4iLCJwYXJ0aWNsZVRleE9VVCIsInJ0UGFydGljbGVUZXhJTiIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJydFBhcnRpY2xlVGV4T1VUIiwic2hhZGVyQ29kZVN0YXJ0Iiwic2hhZGVyQ2h1bmtzIiwicGFydGljbGVVcGRhdGVySW5pdFBTIiwicGFydGljbGVJbnB1dFJnYmE4UFMiLCJwYXJ0aWNsZU91dHB1dFJnYmE4UFMiLCJwYXJ0aWNsZUlucHV0RmxvYXRQUyIsInBhcnRpY2xlT3V0cHV0RmxvYXRQUyIsInBhcnRpY2xlVXBkYXRlckFBQkJQUyIsInBhcnRpY2xlVXBkYXRlclNwaGVyZVBTIiwicGFydGljbGVVcGRhdGVyU3RhcnRQUyIsInNoYWRlckNvZGVSZXNwYXduIiwicGFydGljbGVVcGRhdGVyUmVzcGF3blBTIiwicGFydGljbGVVcGRhdGVyRW5kUFMiLCJzaGFkZXJDb2RlTm9SZXNwYXduIiwicGFydGljbGVVcGRhdGVyTm9SZXNwYXduUFMiLCJzaGFkZXJDb2RlT25TdG9wIiwicGFydGljbGVVcGRhdGVyT25TdG9wUFMiLCJwYXJhbXMiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsImZ1bGxzY3JlZW5RdWFkVlMiLCJpbmRleEJ1ZmZlciIsIm51bUluZGljZXMiLCJfYWxsb2NhdGUiLCJNZXNoIiwicHJpbWl0aXZlIiwidHlwZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwiTWF0ZXJpYWwiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsImFscGhhV3JpdGUiLCJibGVuZCIsImJsZW5kVHlwZSIsImRlcHRoV3JpdGUiLCJ3YXNWaXNpYmxlIiwidmlzaWJsZSIsIk1lc2hJbnN0YW5jZSIsInBpY2siLCJ1cGRhdGVLZXkiLCJfbm9EZXB0aERyYXdHbDEiLCJfdXBkYXRlQWFiYiIsIl9pbml0aWFsaXplVGV4dHVyZXMiLCJyZXNldFRpbWUiLCJhZGRUaW1lIiwicHJlV2FybSIsInByZXdhcm0iLCJfaXNBbmltYXRlZCIsImFuaW1OdW1GcmFtZXMiLCJhbmltVGlsZXNYIiwiYW5pbVRpbGVzWSIsIm5vcm1hbE1hcCIsInF1YW50aXplIiwicUNvbG9yIiwicXVhbnRpemVDbGFtcGVkIiwicVJvdFNwZWVkIiwicUFscGhhIiwibG9jYWxWZWxvY2l0eUdyYXBoMiIsInZlbG9jaXR5R3JhcGgyIiwicUNvbG9yMiIsImNvbG9yR3JhcGgyIiwicVJvdFNwZWVkMiIsInJvdGF0aW9uU3BlZWRHcmFwaDIiLCJxU2NhbGUyIiwic2NhbGVHcmFwaDIiLCJxQWxwaGEyIiwiYWxwaGFHcmFwaDIiLCJyYWRpYWxTcGVlZEdyYXBoMiIsIkRFR19UT19SQUQiLCJsb2NhbFZlbG9jaXR5VU1heCIsInZlbG9jaXR5VU1heCIsImNvbG9yVU1heCIsInJvdFNwZWVkVU1heCIsInNjYWxlVU1heCIsImFscGhhVU1heCIsInJhZGlhbFNwZWVkVU1heCIsInFMb2NhbFZlbG9jaXR5RGl2IiwicVZlbG9jaXR5RGl2IiwicUNvbG9yRGl2IiwicVJvdFNwZWVkRGl2IiwicVNjYWxlRGl2IiwicUFscGhhRGl2IiwicVJhZGlhbFNwZWVkRGl2IiwidW1heCIsInVtYXgyIiwibHVtYXgiLCJsdW1heDIiLCJydW1heCIsInJ1bWF4MiIsIm1heFZlbCIsImxtYXhWZWwiLCJtYXhSYWQiLCJpbnRlcm5hbFRleDMiLCJzZXRQYXJhbWV0ZXIiLCJsaWdodGluZyIsInByb2dyYW1MaWIiLCJnZXRQcm9ncmFtTGlicmFyeSIsInJlZ2lzdGVyIiwicGFydGljbGUiLCJoYXNOb3JtYWwiLCJub3JtYWxPcHRpb24iLCJnZXRTaGFkZXJWYXJpYW50IiwiZGV2Iiwic2MiLCJkZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsInNjZW5lIiwiX2FjdGl2ZUNhbWVyYSIsImluVG9vbHMiLCJwcm9jZXNzaW5nT3B0aW9ucyIsIlNoYWRlclByb2Nlc3Nvck9wdGlvbnMiLCJzaGFkZXIiLCJnZXRQcm9ncmFtIiwibm9ybWFsIiwiaGFsZmxhbWJlcnQiLCJoYWxmTGFtYmVydCIsInN0cmV0Y2giLCJhbGlnblRvTW90aW9uIiwic29mdCIsImRlcHRoU29mdGVuaW5nIiwiZ2FtbWEiLCJnYW1tYUNvcnJlY3Rpb24iLCJ0b25lTWFwIiwidG9uZU1hcHBpbmciLCJmb2ciLCJub0ZvZyIsIndyYXAiLCJ3cmFwQm91bmRzIiwic2NyZWVuU3BhY2UiLCJhbmltVGV4IiwiYW5pbVRleExvb3AiLCJhbmltTG9vcCIsImN1c3RvbUZhY2UiLCJvcmllbnRhdGlvbiIsImludGVuc2l0eSIsIl9zZXRJbnB1dEJvdW5kcyIsImluQm91bmRzU2l6ZVVuaWZvcm0iLCJpbkJvdW5kc0NlbnRlclVuaWZvcm0iLCJfY29tcFBhcnRpY2xlRmFjZVBhcmFtcyIsInRhbmdlbnQiLCJiaW5vcm1hbCIsIm4iLCJQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxEIiwicGFydGljbGVOb3JtYWwiLCJub3JtYWxpemUiLCJlbWl0dGVyTWF0IiwidHJhbnNmb3JtVmVjdG9yIiwidCIsImRvdCIsImNyb3NzIiwicHN5c1ZlcnRDb3VudCIsInBzeXNJbmRleENvdW50IiwiZ2V0TnVtVmVydGljZXMiLCJlbGVtZW50cyIsInNlbWFudGljIiwiU0VNQU5USUNfQVRUUjAiLCJjb21wb25lbnRzIiwiVFlQRV9GTE9BVDMyIiwicHVzaCIsIlNFTUFOVElDX0FUVFIxIiwicGFydGljbGVGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfRFlOQU1JQyIsIkluZGV4QnVmZmVyIiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiU0VNQU5USUNfQVRUUjIiLCJTRU1BTlRJQ19BVFRSMyIsIlNFTUFOVElDX0FUVFI0IiwiZGF0YSIsIm1lc2hEYXRhIiwic3RyaWRlIiwidGV4Q29vcmRPZmZzZXQiLCJlbGVtIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwib2Zmc2V0IiwiaWQiLCJmbG9vciIsInZlcnRJRCIsInZlcnQiLCJ2YkNQVSIsImRzdCIsImluZGljZXMiLCJVaW50MTZBcnJheSIsImJhc2VJbmRleCIsInJlc2V0Iiwib3JpZ0xvb3AiLCJsb29wIiwidGltZSIsImxpZmV0aW1lRnJhY3Rpb24iLCJpdGVyYXRpb25zIiwic3RlcERlbHRhIiwiZW5kVGltZSIsImZpbmlzaEZyYW1lIiwiZGVsdGEiLCJpc09uU3RvcCIsInN0YXJ0VGltZSIsInRpbGVzUGFyYW1zIiwiYW5pbVN0YXJ0RnJhbWUiLCJhbmltU3BlZWQiLCJhbmltTnVtQW5pbWF0aW9ucyIsImFuaW1JbmRleCIsInJhbmRvbWl6ZUFuaW1JbmRleCIsImVtaXR0ZXJTY2FsZSIsIk9ORSIsInVwZGF0ZSIsIm9uRmluaXNoZWQiLCJkZXN0cm95Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE4Q0EsTUFBTUEsYUFBYSxHQUFHLENBQ2xCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFDUixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUNQLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUNOLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQ1YsQ0FBQTtBQUVELFNBQVNDLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsU0FBUyxFQUFFQyxNQUFNLEdBQUdDLG1CQUFt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
