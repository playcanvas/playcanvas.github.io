/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_DEPTH } from '../../../scene/constants.js';
import { Mesh } from '../../../scene/mesh.js';
import { ParticleEmitter } from '../../../scene/particle-system/particle-emitter.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

// properties that do not need rebuilding the particle system
const SIMPLE_PROPERTIES = ['emitterExtents', 'emitterRadius', 'emitterExtentsInner', 'emitterRadiusInner', 'loop', 'initialVelocity', 'animSpeed', 'normalMap', 'particleNormal'];

// properties that need rebuilding the particle system
const COMPLEX_PROPERTIES = ['numParticles', 'lifetime', 'rate', 'rate2', 'startAngle', 'startAngle2', 'lighting', 'halfLambert', 'intensity', 'wrap', 'wrapBounds', 'depthWrite', 'noFog', 'sort', 'stretch', 'alignToMotion', 'preWarm', 'emitterShape', 'animTilesX', 'animTilesY', 'animStartFrame', 'animNumFrames', 'animNumAnimations', 'animIndex', 'randomizeAnimIndex', 'animLoop', 'colorMap', 'localSpace', 'screenSpace', 'orientation'];
const GRAPH_PROPERTIES = ['scaleGraph', 'scaleGraph2', 'colorGraph', 'colorGraph2', 'alphaGraph', 'alphaGraph2', 'velocityGraph', 'velocityGraph2', 'localVelocityGraph', 'localVelocityGraph2', 'rotationSpeedGraph', 'rotationSpeedGraph2', 'radialSpeedGraph', 'radialSpeedGraph2'];
const ASSET_PROPERTIES = ['colorMapAsset', 'normalMapAsset', 'meshAsset', 'renderAsset'];
let depthLayer;

/**
 * Used to simulate particles and produce renderable particle mesh on either CPU or GPU. GPU
 * simulation is generally much faster than its CPU counterpart, because it avoids slow CPU-GPU
 * synchronization and takes advantage of many GPU cores. However, it requires client to support
 * reasonable uniform count, reading from multiple textures in vertex shader and OES_texture_float
 * extension, including rendering into float textures. Most mobile devices fail to satisfy these
 * requirements, so it's not recommended to simulate thousands of particles on them. GPU version
 * also can't sort particles, so enabling sorting forces CPU mode too. Particle rotation is
 * specified by a single angle parameter: default billboard particles rotate around camera facing
 * axis, while mesh particles rotate around 2 different view-independent axes. Most of the
 * simulation parameters are specified with {@link Curve} or {@link CurveSet}. Curves are
 * interpolated based on each particle's lifetime, therefore parameters are able to change over
 * time. Most of the curve parameters can also be specified by 2 minimum/maximum curves, this way
 * each particle will pick a random value in-between.
 *
 * @property {boolean} autoPlay Controls whether the particle system plays automatically on
 * creation. If set to false, it is necessary to call {@link ParticleSystemComponent#play} for the
 * particle system to play. Defaults to true.
 * @property {boolean} loop Enables or disables respawning of particles.
 * @property {boolean} preWarm If enabled, the particle system will be initialized as though it had
 * already completed a full cycle. This only works with looping particle systems.
 * @property {boolean} lighting If enabled, particles will be lit by ambient and directional
 * lights.
 * @property {boolean} halfLambert Enabling Half Lambert lighting avoids particles looking too flat
 * in shadowed areas. It is a completely non-physical lighting model but can give more pleasing
 * visual results.
 * @property {boolean} alignToMotion Orient particles in their direction of motion.
 * @property {boolean} depthWrite If enabled, the particles will write to the depth buffer. If
 * disabled, the depth buffer is left unchanged and particles will be guaranteed to overwrite one
 * another in the order in which they are rendered.
 * @property {boolean} noFog Disable fogging.
 * @property {boolean} localSpace Binds particles to emitter transformation rather then world
 * space.
 * @property {boolean} screenSpace Renders particles in 2D screen space. This needs to be set when
 * particle system is part of hierarchy with {@link ScreenComponent} as its ancestor, and allows
 * particle system to integrate with the rendering of {@link ElementComponent}s. Note that an
 * entity with ParticleSystem component cannot be parented directly to {@link ScreenComponent}, but
 * has to be a child of a {@link ElementComponent}, for example {@link LayoutGroupComponent}.
 * @property {number} numParticles Maximum number of simulated particles.
 * @property {number} rate Minimal interval in seconds between particle births.
 * @property {number} rate2 Maximal interval in seconds between particle births.
 * @property {number} startAngle Minimal initial Euler angle of a particle.
 * @property {number} startAngle2 Maximal initial Euler angle of a particle.
 * @property {number} lifetime The length of time in seconds between a particle's birth and its
 * death.
 * @property {number} stretch A value in world units that controls the amount by which particles
 * are stretched based on their velocity. Particles are stretched from their center towards their
 * previous position.
 * @property {number} intensity Color multiplier.
 * @property {boolean} animLoop Controls whether the sprite sheet animation plays once or loops
 * continuously.
 * @property {number} animTilesX Number of horizontal tiles in the sprite sheet.
 * @property {number} animTilesY Number of vertical tiles in the sprite sheet.
 * @property {number} animNumAnimations Number of sprite sheet animations contained within the
 * current sprite sheet. The number of animations multiplied by number of frames should be a value
 * less than animTilesX multiplied by animTilesY.
 * @property {number} animNumFrames Number of sprite sheet frames in the current sprite sheet
 * animation. The number of animations multiplied by number of frames should be a value less than
 * animTilesX multiplied by animTilesY.
 * @property {number} animStartFrame The sprite sheet frame that the animation should begin playing
 * from. Indexed from the start of the current animation.
 * @property {number} animIndex When animNumAnimations is greater than 1, the sprite sheet
 * animation index determines which animation the particle system should play.
 * @property {number} randomizeAnimIndex Each particle emitted by the system will play a random
 * animation from the sprite sheet, up to animNumAnimations.
 * @property {number} animSpeed Sprite sheet animation speed. 1 = particle lifetime, 2 = twice
 * during lifetime etc...
 * @property {number} depthSoftening Controls fading of particles near their intersections with
 * scene geometry. This effect, when it's non-zero, requires scene depth map to be rendered.
 * Multiple depth-dependent effects can share the same map, but if you only use it for particles,
 * bear in mind that it can double engine draw calls.
 * @property {number} initialVelocity Defines magnitude of the initial emitter velocity. Direction
 * is given by emitter shape.
 * @property {import('../../../core/math/vec3.js').Vec3} emitterExtents (Only for EMITTERSHAPE_BOX)
 * The extents of a local space bounding box within which particles are spawned at random positions.
 * @property {import('../../../core/math/vec3.js').Vec3} emitterExtentsInner (Only for
 * EMITTERSHAPE_BOX) The exception of extents of a local space bounding box within which particles
 * are not spawned. Aligned to the center of EmitterExtents.
 * @property {number} emitterRadius (Only for EMITTERSHAPE_SPHERE) The radius within which
 * particles are spawned at random positions.
 * @property {number} emitterRadiusInner (Only for EMITTERSHAPE_SPHERE) The inner radius within
 * which particles are not spawned.
 * @property {import('../../../core/math/vec3.js').Vec3} wrapBounds The half extents of a world
 * space box volume centered on the owner entity's position. If a particle crosses the boundary of
 * one side of the volume, it teleports to the opposite side.
 * @property {Asset} colorMapAsset The {@link Asset} used to set the colorMap.
 * @property {Asset} normalMapAsset The {@link Asset} used to set the normalMap.
 * @property {Asset} meshAsset The {@link Asset} used to set the mesh.
 * @property {Asset} renderAsset The Render {@link Asset} used to set the mesh.
 * @property {Texture} colorMap The color map texture to apply to all particles in the system. If
 * no texture is assigned, a default spot texture is used.
 * @property {Texture} normalMap The normal map texture to apply to all particles in the system. If
 * no texture is assigned, an approximate spherical normal is calculated for each vertex.
 * @property {number} emitterShape Shape of the emitter. Defines the bounds inside which particles
 * are spawned. Also affects the direction of initial velocity.
 *
 * - {@link EMITTERSHAPE_BOX}: Box shape parameterized by emitterExtents. Initial velocity is
 * directed towards local Z axis.
 * - {@link EMITTERSHAPE_SPHERE}: Sphere shape parameterized by emitterRadius. Initial velocity is
 * directed outwards from the center.
 *
 * @property {number} sort Sorting mode. Forces CPU simulation, so be careful.
 *
 * - {@link PARTICLESORT_NONE}: No sorting, particles are drawn in arbitrary order. Can be
 * simulated on GPU.
 * - {@link PARTICLESORT_DISTANCE}: Sorting based on distance to the camera. CPU only.
 * - {@link PARTICLESORT_NEWER_FIRST}: Newer particles are drawn first. CPU only.
 * - {@link PARTICLESORT_OLDER_FIRST}: Older particles are drawn first. CPU only.
 *
 * @property {Mesh} mesh Triangular mesh to be used as a particle. Only first vertex/index buffer
 * is used. Vertex buffer must contain local position at first 3 floats of each vertex.
 * @property {number} blendType Controls how particles are blended when being written to the currently
 * active render target. Can be:
 *
 * - {@link BLEND_SUBTRACTIVE}: Subtract the color of the source fragment from the destination
 * fragment and write the result to the frame buffer.
 * - {@link BLEND_ADDITIVE}: Add the color of the source fragment to the destination fragment and
 * write the result to the frame buffer.
 * - {@link BLEND_NORMAL}: Enable simple translucency for materials such as glass. This is
 * equivalent to enabling a source blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination
 * blend mode of {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
 * - {@link BLEND_NONE}: Disable blending.
 * - {@link BLEND_PREMULTIPLIED}: Similar to {@link BLEND_NORMAL} expect the source fragment is
 * assumed to have already been multiplied by the source alpha value.
 * - {@link BLEND_MULTIPLICATIVE}: Multiply the color of the source fragment by the color of the
 * destination fragment and write the result to the frame buffer.
 * - {@link BLEND_ADDITIVEALPHA}: Same as {@link BLEND_ADDITIVE} except the source RGB is
 * multiplied by the source alpha.
 *
 * @property {number} orientation Sorting mode. Forces CPU simulation, so be careful.
 *
 * - {@link PARTICLEORIENTATION_SCREEN}: Particles are facing camera.
 * - {@link PARTICLEORIENTATION_WORLD}: User defines world space normal (particleNormal) to set
 * planes orientation.
 * - {@link PARTICLEORIENTATION_EMITTER}: Similar to previous, but the normal is affected by
 * emitter (entity) transformation.
 *
 * @property {import('../../../core/math/vec3.js').Vec3} particleNormal (Only for
 * PARTICLEORIENTATION_WORLD and PARTICLEORIENTATION_EMITTER) The exception of extents of a local
 * space bounding box within which particles are not spawned. Aligned to the center of
 * EmitterExtents.
 * @property {import('../../../core/math/curve-set.js').CurveSet} localVelocityGraph Velocity
 * relative to emitter over lifetime.
 * @property {import('../../../core/math/curve-set.js').CurveSet} localVelocityGraph2 If not null,
 * particles pick random values between localVelocityGraph and localVelocityGraph2.
 * @property {import('../../../core/math/curve-set.js').CurveSet} velocityGraph World-space
 * velocity over lifetime.
 * @property {import('../../../core/math/curve-set.js').CurveSet} velocityGraph2 If not null,
 * particles pick random values between velocityGraph and velocityGraph2.
 * @property {import('../../../core/math/curve-set.js').CurveSet} colorGraph Color over lifetime.
 * @property {import('../../../core/math/curve.js').Curve} rotationSpeedGraph Rotation speed over
 * lifetime.
 * @property {import('../../../core/math/curve.js').Curve} rotationSpeedGraph2 If not null,
 * particles pick random values between rotationSpeedGraph and rotationSpeedGraph2.
 * @property {import('../../../core/math/curve.js').Curve} radialSpeedGraph Radial speed over
 * lifetime, velocity vector points from emitter origin to particle pos.
 * @property {import('../../../core/math/curve.js').Curve} radialSpeedGraph2 If not null, particles
 * pick random values between radialSpeedGraph and radialSpeedGraph2.
 * @property {import('../../../core/math/curve.js').Curve} scaleGraph Scale over lifetime.
 * @property {import('../../../core/math/curve.js').Curve} scaleGraph2 If not null, particles pick
 * random values between scaleGraph and scaleGraph2.
 * @property {import('../../../core/math/curve.js').Curve} alphaGraph Alpha over lifetime.
 * @property {import('../../../core/math/curve.js').Curve} alphaGraph2 If not null, particles pick
 * random values between alphaGraph and alphaGraph2.
 * @property {number[]} layers An array of layer IDs ({@link Layer#id}) to which this particle
 * system should belong. Don't push/pop/splice or modify this array, if you want to change it - set
 * a new one instead.
 * @augments Component
 */
class ParticleSystemComponent extends Component {
  /** @private */

  /** @private */

  /**
   * Create a new ParticleSystemComponent.
   *
   * @param {import('./system.js').ParticleSystemComponentSystem} system - The ComponentSystem
   * that created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity this Component is attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    this._requestedDepth = false;
    this._drawOrder = 0;
    this.on('set_colorMapAsset', this.onSetColorMapAsset, this);
    this.on('set_normalMapAsset', this.onSetNormalMapAsset, this);
    this.on('set_meshAsset', this.onSetMeshAsset, this);
    this.on('set_mesh', this.onSetMesh, this);
    this.on('set_renderAsset', this.onSetRenderAsset, this);
    this.on('set_loop', this.onSetLoop, this);
    this.on('set_blendType', this.onSetBlendType, this);
    this.on('set_depthSoftening', this.onSetDepthSoftening, this);
    this.on('set_layers', this.onSetLayers, this);
    SIMPLE_PROPERTIES.forEach(prop => {
      this.on(`set_${prop}`, this.onSetSimpleProperty, this);
    });
    COMPLEX_PROPERTIES.forEach(prop => {
      this.on(`set_${prop}`, this.onSetComplexProperty, this);
    });
    GRAPH_PROPERTIES.forEach(prop => {
      this.on(`set_${prop}`, this.onSetGraphProperty, this);
    });
  }
  set drawOrder(drawOrder) {
    this._drawOrder = drawOrder;
    if (this.emitter) {
      this.emitter.drawOrder = drawOrder;
    }
  }
  get drawOrder() {
    return this._drawOrder;
  }
  addMeshInstanceToLayers() {
    if (!this.emitter) return;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.addMeshInstances([this.emitter.meshInstance]);
      this.emitter._layer = layer;
    }
  }
  removeMeshInstanceFromLayers() {
    if (!this.emitter) return;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.removeMeshInstances([this.emitter.meshInstance]);
    }
  }
  onSetLayers(name, oldValue, newValue) {
    if (!this.emitter) return;
    for (let i = 0; i < oldValue.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
      if (!layer) continue;
      layer.removeMeshInstances([this.emitter.meshInstance]);
    }
    if (!this.enabled || !this.entity.enabled) return;
    for (let i = 0; i < newValue.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
      if (!layer) continue;
      layer.addMeshInstances([this.emitter.meshInstance]);
    }
  }
  onLayersChanged(oldComp, newComp) {
    this.addMeshInstanceToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }
  onLayerAdded(layer) {
    if (!this.emitter) return;
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances([this.emitter.meshInstance]);
  }
  onLayerRemoved(layer) {
    if (!this.emitter) return;
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances([this.emitter.meshInstance]);
  }
  _bindColorMapAsset(asset) {
    asset.on('load', this._onColorMapAssetLoad, this);
    asset.on('unload', this._onColorMapAssetUnload, this);
    asset.on('remove', this._onColorMapAssetRemove, this);
    asset.on('change', this._onColorMapAssetChange, this);
    if (asset.resource) {
      this._onColorMapAssetLoad(asset);
    } else {
      // don't trigger an asset load unless the component is enabled
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindColorMapAsset(asset) {
    asset.off('load', this._onColorMapAssetLoad, this);
    asset.off('unload', this._onColorMapAssetUnload, this);
    asset.off('remove', this._onColorMapAssetRemove, this);
    asset.off('change', this._onColorMapAssetChange, this);
  }
  _onColorMapAssetLoad(asset) {
    this.colorMap = asset.resource;
  }
  _onColorMapAssetUnload(asset) {
    this.colorMap = null;
  }
  _onColorMapAssetRemove(asset) {
    this._onColorMapAssetUnload(asset);
  }
  _onColorMapAssetChange(asset) {}
  onSetColorMapAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindColorMapAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.colorMapAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindColorMapAsset(asset);
      } else {
        assets.once('add:' + newValue, asset => {
          this._bindColorMapAsset(asset);
        });
      }
    } else {
      this.colorMap = null;
    }
  }
  _bindNormalMapAsset(asset) {
    asset.on('load', this._onNormalMapAssetLoad, this);
    asset.on('unload', this._onNormalMapAssetUnload, this);
    asset.on('remove', this._onNormalMapAssetRemove, this);
    asset.on('change', this._onNormalMapAssetChange, this);
    if (asset.resource) {
      this._onNormalMapAssetLoad(asset);
    } else {
      // don't trigger an asset load unless the component is enabled
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindNormalMapAsset(asset) {
    asset.off('load', this._onNormalMapAssetLoad, this);
    asset.off('unload', this._onNormalMapAssetUnload, this);
    asset.off('remove', this._onNormalMapAssetRemove, this);
    asset.off('change', this._onNormalMapAssetChange, this);
  }
  _onNormalMapAssetLoad(asset) {
    this.normalMap = asset.resource;
  }
  _onNormalMapAssetUnload(asset) {
    this.normalMap = null;
  }
  _onNormalMapAssetRemove(asset) {
    this._onNormalMapAssetUnload(asset);
  }
  _onNormalMapAssetChange(asset) {}
  onSetNormalMapAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindNormalMapAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.normalMapAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindNormalMapAsset(asset);
      } else {
        assets.once('add:' + newValue, asset => {
          this._bindNormalMapAsset(asset);
        });
      }
    } else {
      this.normalMap = null;
    }
  }
  _bindMeshAsset(asset) {
    asset.on('load', this._onMeshAssetLoad, this);
    asset.on('unload', this._onMeshAssetUnload, this);
    asset.on('remove', this._onMeshAssetRemove, this);
    asset.on('change', this._onMeshAssetChange, this);
    if (asset.resource) {
      this._onMeshAssetLoad(asset);
    } else {
      // don't trigger an asset load unless the component is enabled
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindMeshAsset(asset) {
    asset.off('load', this._onMeshAssetLoad, this);
    asset.off('unload', this._onMeshAssetUnload, this);
    asset.off('remove', this._onMeshAssetRemove, this);
    asset.off('change', this._onMeshAssetChange, this);
  }
  _onMeshAssetLoad(asset) {
    this._onMeshChanged(asset.resource);
  }
  _onMeshAssetUnload(asset) {
    this.mesh = null;
  }
  _onMeshAssetRemove(asset) {
    this._onMeshAssetUnload(asset);
  }
  _onMeshAssetChange(asset) {}
  onSetMeshAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindMeshAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.meshAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindMeshAsset(asset);
      }
    } else {
      this._onMeshChanged(null);
    }
  }
  onSetMesh(name, oldValue, newValue) {
    // hack this for now
    // if the value being set is null, an asset or an asset id, then assume we are
    // setting the mesh asset, which will in turn update the mesh
    if (!newValue || newValue instanceof Asset || typeof newValue === 'number') {
      this.meshAsset = newValue;
    } else {
      this._onMeshChanged(newValue);
    }
  }
  _onMeshChanged(mesh) {
    if (mesh && !(mesh instanceof Mesh)) {
      // if mesh is a pc.Model, use the first meshInstance
      if (mesh.meshInstances[0]) {
        mesh = mesh.meshInstances[0].mesh;
      } else {
        mesh = null;
      }
    }
    this.data.mesh = mesh;
    if (this.emitter) {
      this.emitter.mesh = mesh;
      this.emitter.resetMaterial();
      this.rebuild();
    }
  }
  onSetRenderAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindRenderAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.renderAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindRenderAsset(asset);
      }
    } else {
      this._onRenderChanged(null);
    }
  }
  _bindRenderAsset(asset) {
    asset.on('load', this._onRenderAssetLoad, this);
    asset.on('unload', this._onRenderAssetUnload, this);
    asset.on('remove', this._onRenderAssetRemove, this);
    if (asset.resource) {
      this._onRenderAssetLoad(asset);
    } else {
      // don't trigger an asset load unless the component is enabled
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindRenderAsset(asset) {
    asset.off('load', this._onRenderAssetLoad, this);
    asset.off('unload', this._onRenderAssetUnload, this);
    asset.off('remove', this._onRenderAssetRemove, this);
    if (asset.resource) {
      asset.resource.off('set:meshes', this._onRenderSetMeshes, this);
    }
  }
  _onRenderAssetLoad(asset) {
    this._onRenderChanged(asset.resource);
  }
  _onRenderAssetUnload(asset) {
    this._onRenderChanged(null);
  }
  _onRenderAssetRemove(asset) {
    this._onRenderAssetUnload(asset);
  }
  _onRenderChanged(render) {
    if (!render) {
      this._onMeshChanged(null);
      return;
    }
    render.off('set:meshes', this._onRenderSetMeshes, this);
    render.on('set:meshes', this._onRenderSetMeshes, this);
    if (render.meshes) {
      this._onRenderSetMeshes(render.meshes);
    }
  }
  _onRenderSetMeshes(meshes) {
    this._onMeshChanged(meshes && meshes[0]);
  }
  onSetLoop(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetTime();
    }
  }
  onSetBlendType(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.material.blendType = newValue;
      this.emitter.resetMaterial();
      this.rebuild();
    }
  }
  _requestDepth() {
    if (this._requestedDepth) return;
    if (!depthLayer) depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);
    if (depthLayer) {
      depthLayer.incrementCounter();
      this._requestedDepth = true;
    }
  }
  _releaseDepth() {
    if (!this._requestedDepth) return;
    if (depthLayer) {
      depthLayer.decrementCounter();
      this._requestedDepth = false;
    }
  }
  onSetDepthSoftening(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (newValue) {
        if (this.enabled && this.entity.enabled) this._requestDepth();
        if (this.emitter) this.emitter[name] = newValue;
      } else {
        if (this.enabled && this.entity.enabled) this._releaseDepth();
        if (this.emitter) this.emitter[name] = newValue;
      }
      if (this.emitter) {
        this.reset();
        this.emitter.resetMaterial();
        this.rebuild();
      }
    }
  }
  onSetSimpleProperty(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetMaterial();
    }
  }
  onSetComplexProperty(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetMaterial();
      this.rebuild();
      this.reset();
    }
  }
  onSetGraphProperty(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.rebuildGraphs();
      this.emitter.resetMaterial();
    }
  }
  onEnable() {
    // get data store once
    const data = this.data;

    // load any assets that haven't been loaded yet
    for (let i = 0, len = ASSET_PROPERTIES.length; i < len; i++) {
      let asset = data[ASSET_PROPERTIES[i]];
      if (asset) {
        if (!(asset instanceof Asset)) {
          const id = parseInt(asset, 10);
          if (id >= 0) {
            asset = this.system.app.assets.get(asset);
          } else {
            continue;
          }
        }
        if (asset && !asset.resource) {
          this.system.app.assets.load(asset);
        }
      }
    }
    if (!this.emitter) {
      let mesh = data.mesh;

      // mesh might be an asset id of an asset
      // that hasn't been loaded yet
      if (!(mesh instanceof Mesh)) mesh = null;
      this.emitter = new ParticleEmitter(this.system.app.graphicsDevice, {
        numParticles: data.numParticles,
        emitterExtents: data.emitterExtents,
        emitterExtentsInner: data.emitterExtentsInner,
        emitterRadius: data.emitterRadius,
        emitterRadiusInner: data.emitterRadiusInner,
        emitterShape: data.emitterShape,
        initialVelocity: data.initialVelocity,
        wrap: data.wrap,
        localSpace: data.localSpace,
        screenSpace: data.screenSpace,
        wrapBounds: data.wrapBounds,
        lifetime: data.lifetime,
        rate: data.rate,
        rate2: data.rate2,
        orientation: data.orientation,
        particleNormal: data.particleNormal,
        animTilesX: data.animTilesX,
        animTilesY: data.animTilesY,
        animStartFrame: data.animStartFrame,
        animNumFrames: data.animNumFrames,
        animNumAnimations: data.animNumAnimations,
        animIndex: data.animIndex,
        randomizeAnimIndex: data.randomizeAnimIndex,
        animSpeed: data.animSpeed,
        animLoop: data.animLoop,
        startAngle: data.startAngle,
        startAngle2: data.startAngle2,
        scaleGraph: data.scaleGraph,
        scaleGraph2: data.scaleGraph2,
        colorGraph: data.colorGraph,
        colorGraph2: data.colorGraph2,
        alphaGraph: data.alphaGraph,
        alphaGraph2: data.alphaGraph2,
        localVelocityGraph: data.localVelocityGraph,
        localVelocityGraph2: data.localVelocityGraph2,
        velocityGraph: data.velocityGraph,
        velocityGraph2: data.velocityGraph2,
        rotationSpeedGraph: data.rotationSpeedGraph,
        rotationSpeedGraph2: data.rotationSpeedGraph2,
        radialSpeedGraph: data.radialSpeedGraph,
        radialSpeedGraph2: data.radialSpeedGraph2,
        colorMap: data.colorMap,
        normalMap: data.normalMap,
        loop: data.loop,
        preWarm: data.preWarm,
        sort: data.sort,
        stretch: data.stretch,
        alignToMotion: data.alignToMotion,
        lighting: data.lighting,
        halfLambert: data.halfLambert,
        intensity: data.intensity,
        depthSoftening: data.depthSoftening,
        scene: this.system.app.scene,
        mesh: mesh,
        depthWrite: data.depthWrite,
        noFog: data.noFog,
        node: this.entity,
        blendType: data.blendType
      });
      this.emitter.meshInstance.node = this.entity;
      this.emitter.drawOrder = this.drawOrder;
      if (!data.autoPlay) {
        this.pause();
        this.emitter.meshInstance.visible = false;
      }
    }
    if (this.emitter.colorMap) {
      this.addMeshInstanceToLayers();
    }
    this.system.app.scene.on('set:layers', this.onLayersChanged, this);
    if (this.system.app.scene.layers) {
      this.system.app.scene.layers.on('add', this.onLayerAdded, this);
      this.system.app.scene.layers.on('remove', this.onLayerRemoved, this);
    }
    if (this.enabled && this.entity.enabled && data.depthSoftening) {
      this._requestDepth();
    }
  }
  onDisable() {
    this.system.app.scene.off('set:layers', this.onLayersChanged, this);
    if (this.system.app.scene.layers) {
      this.system.app.scene.layers.off('add', this.onLayerAdded, this);
      this.system.app.scene.layers.off('remove', this.onLayerRemoved, this);
    }
    if (this.emitter) {
      this.removeMeshInstanceFromLayers();
      if (this.data.depthSoftening) this._releaseDepth();

      // clear camera as it isn't updated while disabled and we don't want to hold
      // onto old reference
      this.emitter.camera = null;
    }
  }
  onBeforeRemove() {
    if (this.enabled) {
      this.enabled = false;
    }
    if (this.emitter) {
      this.emitter.destroy();
      this.emitter = null;
    }

    // clear all asset properties to remove any event listeners
    for (let i = 0; i < ASSET_PROPERTIES.length; i++) {
      const prop = ASSET_PROPERTIES[i];
      if (this.data[prop]) {
        this[prop] = null;
      }
    }
    this.off();
  }

  /**
   * Resets particle state, doesn't affect playing.
   */
  reset() {
    if (this.emitter) {
      this.emitter.reset();
    }
  }

  /**
   * Disables the emission of new particles, lets existing to finish their simulation.
   */
  stop() {
    if (this.emitter) {
      this.emitter.loop = false;
      this.emitter.resetTime();
      this.emitter.addTime(0, true);
    }
  }

  /**
   * Freezes the simulation.
   */
  pause() {
    this.data.paused = true;
  }

  /**
   * Unfreezes the simulation.
   */
  unpause() {
    this.data.paused = false;
  }

  /**
   * Enables/unfreezes the simulation.
   */
  play() {
    this.data.paused = false;
    if (this.emitter) {
      this.emitter.meshInstance.visible = true;
      this.emitter.loop = this.data.loop;
      this.emitter.resetTime();
    }
  }

  /**
   * Checks if simulation is in progress.
   *
   * @returns {boolean} True if the particle system is currently playing and false otherwise.
   */
  isPlaying() {
    if (this.data.paused) {
      return false;
    }
    if (this.emitter && this.emitter.loop) {
      return true;
    }

    // possible bug here what happens if the non looping emitter
    // was paused in the meantime?
    return Date.now() <= this.emitter.endTime;
  }

  /**
   * Rebuilds all data used by this particle system.
   *
   * @private
   */
  rebuild() {
    const enabled = this.enabled;
    this.enabled = false;
    if (this.emitter) {
      this.emitter.rebuild(); // worst case: required to rebuild buffers/shaders
      this.emitter.meshInstance.node = this.entity;
    }
    this.enabled = enabled;
  }
}

export { ParticleSystemComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcGFydGljbGUtc3lzdGVtL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX0RFUFRIIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8vIHByb3BlcnRpZXMgdGhhdCBkbyBub3QgbmVlZCByZWJ1aWxkaW5nIHRoZSBwYXJ0aWNsZSBzeXN0ZW1cbmNvbnN0IFNJTVBMRV9QUk9QRVJUSUVTID0gW1xuICAgICdlbWl0dGVyRXh0ZW50cycsXG4gICAgJ2VtaXR0ZXJSYWRpdXMnLFxuICAgICdlbWl0dGVyRXh0ZW50c0lubmVyJyxcbiAgICAnZW1pdHRlclJhZGl1c0lubmVyJyxcbiAgICAnbG9vcCcsXG4gICAgJ2luaXRpYWxWZWxvY2l0eScsXG4gICAgJ2FuaW1TcGVlZCcsXG4gICAgJ25vcm1hbE1hcCcsXG4gICAgJ3BhcnRpY2xlTm9ybWFsJ1xuXTtcblxuLy8gcHJvcGVydGllcyB0aGF0IG5lZWQgcmVidWlsZGluZyB0aGUgcGFydGljbGUgc3lzdGVtXG5jb25zdCBDT01QTEVYX1BST1BFUlRJRVMgPSBbXG4gICAgJ251bVBhcnRpY2xlcycsXG4gICAgJ2xpZmV0aW1lJyxcbiAgICAncmF0ZScsXG4gICAgJ3JhdGUyJyxcbiAgICAnc3RhcnRBbmdsZScsXG4gICAgJ3N0YXJ0QW5nbGUyJyxcbiAgICAnbGlnaHRpbmcnLFxuICAgICdoYWxmTGFtYmVydCcsXG4gICAgJ2ludGVuc2l0eScsXG4gICAgJ3dyYXAnLFxuICAgICd3cmFwQm91bmRzJyxcbiAgICAnZGVwdGhXcml0ZScsXG4gICAgJ25vRm9nJyxcbiAgICAnc29ydCcsXG4gICAgJ3N0cmV0Y2gnLFxuICAgICdhbGlnblRvTW90aW9uJyxcbiAgICAncHJlV2FybScsXG4gICAgJ2VtaXR0ZXJTaGFwZScsXG4gICAgJ2FuaW1UaWxlc1gnLFxuICAgICdhbmltVGlsZXNZJyxcbiAgICAnYW5pbVN0YXJ0RnJhbWUnLFxuICAgICdhbmltTnVtRnJhbWVzJyxcbiAgICAnYW5pbU51bUFuaW1hdGlvbnMnLFxuICAgICdhbmltSW5kZXgnLFxuICAgICdyYW5kb21pemVBbmltSW5kZXgnLFxuICAgICdhbmltTG9vcCcsXG4gICAgJ2NvbG9yTWFwJyxcbiAgICAnbG9jYWxTcGFjZScsXG4gICAgJ3NjcmVlblNwYWNlJyxcbiAgICAnb3JpZW50YXRpb24nXG5dO1xuXG5jb25zdCBHUkFQSF9QUk9QRVJUSUVTID0gW1xuICAgICdzY2FsZUdyYXBoJyxcbiAgICAnc2NhbGVHcmFwaDInLFxuXG4gICAgJ2NvbG9yR3JhcGgnLFxuICAgICdjb2xvckdyYXBoMicsXG5cbiAgICAnYWxwaGFHcmFwaCcsXG4gICAgJ2FscGhhR3JhcGgyJyxcblxuICAgICd2ZWxvY2l0eUdyYXBoJyxcbiAgICAndmVsb2NpdHlHcmFwaDInLFxuXG4gICAgJ2xvY2FsVmVsb2NpdHlHcmFwaCcsXG4gICAgJ2xvY2FsVmVsb2NpdHlHcmFwaDInLFxuXG4gICAgJ3JvdGF0aW9uU3BlZWRHcmFwaCcsXG4gICAgJ3JvdGF0aW9uU3BlZWRHcmFwaDInLFxuXG4gICAgJ3JhZGlhbFNwZWVkR3JhcGgnLFxuICAgICdyYWRpYWxTcGVlZEdyYXBoMidcbl07XG5cbmNvbnN0IEFTU0VUX1BST1BFUlRJRVMgPSBbXG4gICAgJ2NvbG9yTWFwQXNzZXQnLFxuICAgICdub3JtYWxNYXBBc3NldCcsXG4gICAgJ21lc2hBc3NldCcsXG4gICAgJ3JlbmRlckFzc2V0J1xuXTtcblxubGV0IGRlcHRoTGF5ZXI7XG5cbi8qKlxuICogVXNlZCB0byBzaW11bGF0ZSBwYXJ0aWNsZXMgYW5kIHByb2R1Y2UgcmVuZGVyYWJsZSBwYXJ0aWNsZSBtZXNoIG9uIGVpdGhlciBDUFUgb3IgR1BVLiBHUFVcbiAqIHNpbXVsYXRpb24gaXMgZ2VuZXJhbGx5IG11Y2ggZmFzdGVyIHRoYW4gaXRzIENQVSBjb3VudGVycGFydCwgYmVjYXVzZSBpdCBhdm9pZHMgc2xvdyBDUFUtR1BVXG4gKiBzeW5jaHJvbml6YXRpb24gYW5kIHRha2VzIGFkdmFudGFnZSBvZiBtYW55IEdQVSBjb3Jlcy4gSG93ZXZlciwgaXQgcmVxdWlyZXMgY2xpZW50IHRvIHN1cHBvcnRcbiAqIHJlYXNvbmFibGUgdW5pZm9ybSBjb3VudCwgcmVhZGluZyBmcm9tIG11bHRpcGxlIHRleHR1cmVzIGluIHZlcnRleCBzaGFkZXIgYW5kIE9FU190ZXh0dXJlX2Zsb2F0XG4gKiBleHRlbnNpb24sIGluY2x1ZGluZyByZW5kZXJpbmcgaW50byBmbG9hdCB0ZXh0dXJlcy4gTW9zdCBtb2JpbGUgZGV2aWNlcyBmYWlsIHRvIHNhdGlzZnkgdGhlc2VcbiAqIHJlcXVpcmVtZW50cywgc28gaXQncyBub3QgcmVjb21tZW5kZWQgdG8gc2ltdWxhdGUgdGhvdXNhbmRzIG9mIHBhcnRpY2xlcyBvbiB0aGVtLiBHUFUgdmVyc2lvblxuICogYWxzbyBjYW4ndCBzb3J0IHBhcnRpY2xlcywgc28gZW5hYmxpbmcgc29ydGluZyBmb3JjZXMgQ1BVIG1vZGUgdG9vLiBQYXJ0aWNsZSByb3RhdGlvbiBpc1xuICogc3BlY2lmaWVkIGJ5IGEgc2luZ2xlIGFuZ2xlIHBhcmFtZXRlcjogZGVmYXVsdCBiaWxsYm9hcmQgcGFydGljbGVzIHJvdGF0ZSBhcm91bmQgY2FtZXJhIGZhY2luZ1xuICogYXhpcywgd2hpbGUgbWVzaCBwYXJ0aWNsZXMgcm90YXRlIGFyb3VuZCAyIGRpZmZlcmVudCB2aWV3LWluZGVwZW5kZW50IGF4ZXMuIE1vc3Qgb2YgdGhlXG4gKiBzaW11bGF0aW9uIHBhcmFtZXRlcnMgYXJlIHNwZWNpZmllZCB3aXRoIHtAbGluayBDdXJ2ZX0gb3Ige0BsaW5rIEN1cnZlU2V0fS4gQ3VydmVzIGFyZVxuICogaW50ZXJwb2xhdGVkIGJhc2VkIG9uIGVhY2ggcGFydGljbGUncyBsaWZldGltZSwgdGhlcmVmb3JlIHBhcmFtZXRlcnMgYXJlIGFibGUgdG8gY2hhbmdlIG92ZXJcbiAqIHRpbWUuIE1vc3Qgb2YgdGhlIGN1cnZlIHBhcmFtZXRlcnMgY2FuIGFsc28gYmUgc3BlY2lmaWVkIGJ5IDIgbWluaW11bS9tYXhpbXVtIGN1cnZlcywgdGhpcyB3YXlcbiAqIGVhY2ggcGFydGljbGUgd2lsbCBwaWNrIGEgcmFuZG9tIHZhbHVlIGluLWJldHdlZW4uXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvUGxheSBDb250cm9scyB3aGV0aGVyIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gcGxheXMgYXV0b21hdGljYWxseSBvblxuICogY3JlYXRpb24uIElmIHNldCB0byBmYWxzZSwgaXQgaXMgbmVjZXNzYXJ5IHRvIGNhbGwge0BsaW5rIFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50I3BsYXl9IGZvciB0aGVcbiAqIHBhcnRpY2xlIHN5c3RlbSB0byBwbGF5LiBEZWZhdWx0cyB0byB0cnVlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsb29wIEVuYWJsZXMgb3IgZGlzYWJsZXMgcmVzcGF3bmluZyBvZiBwYXJ0aWNsZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHByZVdhcm0gSWYgZW5hYmxlZCwgdGhlIHBhcnRpY2xlIHN5c3RlbSB3aWxsIGJlIGluaXRpYWxpemVkIGFzIHRob3VnaCBpdCBoYWRcbiAqIGFscmVhZHkgY29tcGxldGVkIGEgZnVsbCBjeWNsZS4gVGhpcyBvbmx5IHdvcmtzIHdpdGggbG9vcGluZyBwYXJ0aWNsZSBzeXN0ZW1zLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsaWdodGluZyBJZiBlbmFibGVkLCBwYXJ0aWNsZXMgd2lsbCBiZSBsaXQgYnkgYW1iaWVudCBhbmQgZGlyZWN0aW9uYWxcbiAqIGxpZ2h0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaGFsZkxhbWJlcnQgRW5hYmxpbmcgSGFsZiBMYW1iZXJ0IGxpZ2h0aW5nIGF2b2lkcyBwYXJ0aWNsZXMgbG9va2luZyB0b28gZmxhdFxuICogaW4gc2hhZG93ZWQgYXJlYXMuIEl0IGlzIGEgY29tcGxldGVseSBub24tcGh5c2ljYWwgbGlnaHRpbmcgbW9kZWwgYnV0IGNhbiBnaXZlIG1vcmUgcGxlYXNpbmdcbiAqIHZpc3VhbCByZXN1bHRzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhbGlnblRvTW90aW9uIE9yaWVudCBwYXJ0aWNsZXMgaW4gdGhlaXIgZGlyZWN0aW9uIG9mIG1vdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZGVwdGhXcml0ZSBJZiBlbmFibGVkLCB0aGUgcGFydGljbGVzIHdpbGwgd3JpdGUgdG8gdGhlIGRlcHRoIGJ1ZmZlci4gSWZcbiAqIGRpc2FibGVkLCB0aGUgZGVwdGggYnVmZmVyIGlzIGxlZnQgdW5jaGFuZ2VkIGFuZCBwYXJ0aWNsZXMgd2lsbCBiZSBndWFyYW50ZWVkIHRvIG92ZXJ3cml0ZSBvbmVcbiAqIGFub3RoZXIgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZXkgYXJlIHJlbmRlcmVkLlxuICogQHByb3BlcnR5IHtib29sZWFufSBub0ZvZyBEaXNhYmxlIGZvZ2dpbmcuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGxvY2FsU3BhY2UgQmluZHMgcGFydGljbGVzIHRvIGVtaXR0ZXIgdHJhbnNmb3JtYXRpb24gcmF0aGVyIHRoZW4gd29ybGRcbiAqIHNwYWNlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzY3JlZW5TcGFjZSBSZW5kZXJzIHBhcnRpY2xlcyBpbiAyRCBzY3JlZW4gc3BhY2UuIFRoaXMgbmVlZHMgdG8gYmUgc2V0IHdoZW5cbiAqIHBhcnRpY2xlIHN5c3RlbSBpcyBwYXJ0IG9mIGhpZXJhcmNoeSB3aXRoIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFzIGl0cyBhbmNlc3RvciwgYW5kIGFsbG93c1xuICogcGFydGljbGUgc3lzdGVtIHRvIGludGVncmF0ZSB3aXRoIHRoZSByZW5kZXJpbmcgb2Yge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy4gTm90ZSB0aGF0IGFuXG4gKiBlbnRpdHkgd2l0aCBQYXJ0aWNsZVN5c3RlbSBjb21wb25lbnQgY2Fubm90IGJlIHBhcmVudGVkIGRpcmVjdGx5IHRvIHtAbGluayBTY3JlZW5Db21wb25lbnR9LCBidXRcbiAqIGhhcyB0byBiZSBhIGNoaWxkIG9mIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9LCBmb3IgZXhhbXBsZSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG51bVBhcnRpY2xlcyBNYXhpbXVtIG51bWJlciBvZiBzaW11bGF0ZWQgcGFydGljbGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhdGUgTWluaW1hbCBpbnRlcnZhbCBpbiBzZWNvbmRzIGJldHdlZW4gcGFydGljbGUgYmlydGhzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhdGUyIE1heGltYWwgaW50ZXJ2YWwgaW4gc2Vjb25kcyBiZXR3ZWVuIHBhcnRpY2xlIGJpcnRocy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdGFydEFuZ2xlIE1pbmltYWwgaW5pdGlhbCBFdWxlciBhbmdsZSBvZiBhIHBhcnRpY2xlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN0YXJ0QW5nbGUyIE1heGltYWwgaW5pdGlhbCBFdWxlciBhbmdsZSBvZiBhIHBhcnRpY2xlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGxpZmV0aW1lIFRoZSBsZW5ndGggb2YgdGltZSBpbiBzZWNvbmRzIGJldHdlZW4gYSBwYXJ0aWNsZSdzIGJpcnRoIGFuZCBpdHNcbiAqIGRlYXRoLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN0cmV0Y2ggQSB2YWx1ZSBpbiB3b3JsZCB1bml0cyB0aGF0IGNvbnRyb2xzIHRoZSBhbW91bnQgYnkgd2hpY2ggcGFydGljbGVzXG4gKiBhcmUgc3RyZXRjaGVkIGJhc2VkIG9uIHRoZWlyIHZlbG9jaXR5LiBQYXJ0aWNsZXMgYXJlIHN0cmV0Y2hlZCBmcm9tIHRoZWlyIGNlbnRlciB0b3dhcmRzIHRoZWlyXG4gKiBwcmV2aW91cyBwb3NpdGlvbi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnRlbnNpdHkgQ29sb3IgbXVsdGlwbGllci5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYW5pbUxvb3AgQ29udHJvbHMgd2hldGhlciB0aGUgc3ByaXRlIHNoZWV0IGFuaW1hdGlvbiBwbGF5cyBvbmNlIG9yIGxvb3BzXG4gKiBjb250aW51b3VzbHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbVRpbGVzWCBOdW1iZXIgb2YgaG9yaXpvbnRhbCB0aWxlcyBpbiB0aGUgc3ByaXRlIHNoZWV0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1UaWxlc1kgTnVtYmVyIG9mIHZlcnRpY2FsIHRpbGVzIGluIHRoZSBzcHJpdGUgc2hlZXQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbU51bUFuaW1hdGlvbnMgTnVtYmVyIG9mIHNwcml0ZSBzaGVldCBhbmltYXRpb25zIGNvbnRhaW5lZCB3aXRoaW4gdGhlXG4gKiBjdXJyZW50IHNwcml0ZSBzaGVldC4gVGhlIG51bWJlciBvZiBhbmltYXRpb25zIG11bHRpcGxpZWQgYnkgbnVtYmVyIG9mIGZyYW1lcyBzaG91bGQgYmUgYSB2YWx1ZVxuICogbGVzcyB0aGFuIGFuaW1UaWxlc1ggbXVsdGlwbGllZCBieSBhbmltVGlsZXNZLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1OdW1GcmFtZXMgTnVtYmVyIG9mIHNwcml0ZSBzaGVldCBmcmFtZXMgaW4gdGhlIGN1cnJlbnQgc3ByaXRlIHNoZWV0XG4gKiBhbmltYXRpb24uIFRoZSBudW1iZXIgb2YgYW5pbWF0aW9ucyBtdWx0aXBsaWVkIGJ5IG51bWJlciBvZiBmcmFtZXMgc2hvdWxkIGJlIGEgdmFsdWUgbGVzcyB0aGFuXG4gKiBhbmltVGlsZXNYIG11bHRpcGxpZWQgYnkgYW5pbVRpbGVzWS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltU3RhcnRGcmFtZSBUaGUgc3ByaXRlIHNoZWV0IGZyYW1lIHRoYXQgdGhlIGFuaW1hdGlvbiBzaG91bGQgYmVnaW4gcGxheWluZ1xuICogZnJvbS4gSW5kZXhlZCBmcm9tIHRoZSBzdGFydCBvZiB0aGUgY3VycmVudCBhbmltYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbUluZGV4IFdoZW4gYW5pbU51bUFuaW1hdGlvbnMgaXMgZ3JlYXRlciB0aGFuIDEsIHRoZSBzcHJpdGUgc2hlZXRcbiAqIGFuaW1hdGlvbiBpbmRleCBkZXRlcm1pbmVzIHdoaWNoIGFuaW1hdGlvbiB0aGUgcGFydGljbGUgc3lzdGVtIHNob3VsZCBwbGF5LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmRvbWl6ZUFuaW1JbmRleCBFYWNoIHBhcnRpY2xlIGVtaXR0ZWQgYnkgdGhlIHN5c3RlbSB3aWxsIHBsYXkgYSByYW5kb21cbiAqIGFuaW1hdGlvbiBmcm9tIHRoZSBzcHJpdGUgc2hlZXQsIHVwIHRvIGFuaW1OdW1BbmltYXRpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1TcGVlZCBTcHJpdGUgc2hlZXQgYW5pbWF0aW9uIHNwZWVkLiAxID0gcGFydGljbGUgbGlmZXRpbWUsIDIgPSB0d2ljZVxuICogZHVyaW5nIGxpZmV0aW1lIGV0Yy4uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRlcHRoU29mdGVuaW5nIENvbnRyb2xzIGZhZGluZyBvZiBwYXJ0aWNsZXMgbmVhciB0aGVpciBpbnRlcnNlY3Rpb25zIHdpdGhcbiAqIHNjZW5lIGdlb21ldHJ5LiBUaGlzIGVmZmVjdCwgd2hlbiBpdCdzIG5vbi16ZXJvLCByZXF1aXJlcyBzY2VuZSBkZXB0aCBtYXAgdG8gYmUgcmVuZGVyZWQuXG4gKiBNdWx0aXBsZSBkZXB0aC1kZXBlbmRlbnQgZWZmZWN0cyBjYW4gc2hhcmUgdGhlIHNhbWUgbWFwLCBidXQgaWYgeW91IG9ubHkgdXNlIGl0IGZvciBwYXJ0aWNsZXMsXG4gKiBiZWFyIGluIG1pbmQgdGhhdCBpdCBjYW4gZG91YmxlIGVuZ2luZSBkcmF3IGNhbGxzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGluaXRpYWxWZWxvY2l0eSBEZWZpbmVzIG1hZ25pdHVkZSBvZiB0aGUgaW5pdGlhbCBlbWl0dGVyIHZlbG9jaXR5LiBEaXJlY3Rpb25cbiAqIGlzIGdpdmVuIGJ5IGVtaXR0ZXIgc2hhcGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBlbWl0dGVyRXh0ZW50cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX0JPWClcbiAqIFRoZSBleHRlbnRzIG9mIGEgbG9jYWwgc3BhY2UgYm91bmRpbmcgYm94IHdpdGhpbiB3aGljaCBwYXJ0aWNsZXMgYXJlIHNwYXduZWQgYXQgcmFuZG9tIHBvc2l0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGVtaXR0ZXJFeHRlbnRzSW5uZXIgKE9ubHkgZm9yXG4gKiBFTUlUVEVSU0hBUEVfQk9YKSBUaGUgZXhjZXB0aW9uIG9mIGV4dGVudHMgb2YgYSBsb2NhbCBzcGFjZSBib3VuZGluZyBib3ggd2l0aGluIHdoaWNoIHBhcnRpY2xlc1xuICogYXJlIG5vdCBzcGF3bmVkLiBBbGlnbmVkIHRvIHRoZSBjZW50ZXIgb2YgRW1pdHRlckV4dGVudHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pdHRlclJhZGl1cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX1NQSEVSRSkgVGhlIHJhZGl1cyB3aXRoaW4gd2hpY2hcbiAqIHBhcnRpY2xlcyBhcmUgc3Bhd25lZCBhdCByYW5kb20gcG9zaXRpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGVtaXR0ZXJSYWRpdXNJbm5lciAoT25seSBmb3IgRU1JVFRFUlNIQVBFX1NQSEVSRSkgVGhlIGlubmVyIHJhZGl1cyB3aXRoaW5cbiAqIHdoaWNoIHBhcnRpY2xlcyBhcmUgbm90IHNwYXduZWQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSB3cmFwQm91bmRzIFRoZSBoYWxmIGV4dGVudHMgb2YgYSB3b3JsZFxuICogc3BhY2UgYm94IHZvbHVtZSBjZW50ZXJlZCBvbiB0aGUgb3duZXIgZW50aXR5J3MgcG9zaXRpb24uIElmIGEgcGFydGljbGUgY3Jvc3NlcyB0aGUgYm91bmRhcnkgb2ZcbiAqIG9uZSBzaWRlIG9mIHRoZSB2b2x1bWUsIGl0IHRlbGVwb3J0cyB0byB0aGUgb3Bwb3NpdGUgc2lkZS5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IGNvbG9yTWFwQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIGNvbG9yTWFwLlxuICogQHByb3BlcnR5IHtBc3NldH0gbm9ybWFsTWFwQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIG5vcm1hbE1hcC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IG1lc2hBc3NldCBUaGUge0BsaW5rIEFzc2V0fSB1c2VkIHRvIHNldCB0aGUgbWVzaC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IHJlbmRlckFzc2V0IFRoZSBSZW5kZXIge0BsaW5rIEFzc2V0fSB1c2VkIHRvIHNldCB0aGUgbWVzaC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gY29sb3JNYXAgVGhlIGNvbG9yIG1hcCB0ZXh0dXJlIHRvIGFwcGx5IHRvIGFsbCBwYXJ0aWNsZXMgaW4gdGhlIHN5c3RlbS4gSWZcbiAqIG5vIHRleHR1cmUgaXMgYXNzaWduZWQsIGEgZGVmYXVsdCBzcG90IHRleHR1cmUgaXMgdXNlZC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gbm9ybWFsTWFwIFRoZSBub3JtYWwgbWFwIHRleHR1cmUgdG8gYXBwbHkgdG8gYWxsIHBhcnRpY2xlcyBpbiB0aGUgc3lzdGVtLiBJZlxuICogbm8gdGV4dHVyZSBpcyBhc3NpZ25lZCwgYW4gYXBwcm94aW1hdGUgc3BoZXJpY2FsIG5vcm1hbCBpcyBjYWxjdWxhdGVkIGZvciBlYWNoIHZlcnRleC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWl0dGVyU2hhcGUgU2hhcGUgb2YgdGhlIGVtaXR0ZXIuIERlZmluZXMgdGhlIGJvdW5kcyBpbnNpZGUgd2hpY2ggcGFydGljbGVzXG4gKiBhcmUgc3Bhd25lZC4gQWxzbyBhZmZlY3RzIHRoZSBkaXJlY3Rpb24gb2YgaW5pdGlhbCB2ZWxvY2l0eS5cbiAqXG4gKiAtIHtAbGluayBFTUlUVEVSU0hBUEVfQk9YfTogQm94IHNoYXBlIHBhcmFtZXRlcml6ZWQgYnkgZW1pdHRlckV4dGVudHMuIEluaXRpYWwgdmVsb2NpdHkgaXNcbiAqIGRpcmVjdGVkIHRvd2FyZHMgbG9jYWwgWiBheGlzLlxuICogLSB7QGxpbmsgRU1JVFRFUlNIQVBFX1NQSEVSRX06IFNwaGVyZSBzaGFwZSBwYXJhbWV0ZXJpemVkIGJ5IGVtaXR0ZXJSYWRpdXMuIEluaXRpYWwgdmVsb2NpdHkgaXNcbiAqIGRpcmVjdGVkIG91dHdhcmRzIGZyb20gdGhlIGNlbnRlci5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gc29ydCBTb3J0aW5nIG1vZGUuIEZvcmNlcyBDUFUgc2ltdWxhdGlvbiwgc28gYmUgY2FyZWZ1bC5cbiAqXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfTk9ORX06IE5vIHNvcnRpbmcsIHBhcnRpY2xlcyBhcmUgZHJhd24gaW4gYXJiaXRyYXJ5IG9yZGVyLiBDYW4gYmVcbiAqIHNpbXVsYXRlZCBvbiBHUFUuXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfRElTVEFOQ0V9OiBTb3J0aW5nIGJhc2VkIG9uIGRpc3RhbmNlIHRvIHRoZSBjYW1lcmEuIENQVSBvbmx5LlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX05FV0VSX0ZJUlNUfTogTmV3ZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfT0xERVJfRklSU1R9OiBPbGRlciBwYXJ0aWNsZXMgYXJlIGRyYXduIGZpcnN0LiBDUFUgb25seS5cbiAqXG4gKiBAcHJvcGVydHkge01lc2h9IG1lc2ggVHJpYW5ndWxhciBtZXNoIHRvIGJlIHVzZWQgYXMgYSBwYXJ0aWNsZS4gT25seSBmaXJzdCB2ZXJ0ZXgvaW5kZXggYnVmZmVyXG4gKiBpcyB1c2VkLiBWZXJ0ZXggYnVmZmVyIG11c3QgY29udGFpbiBsb2NhbCBwb3NpdGlvbiBhdCBmaXJzdCAzIGZsb2F0cyBvZiBlYWNoIHZlcnRleC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBibGVuZFR5cGUgQ29udHJvbHMgaG93IHBhcnRpY2xlcyBhcmUgYmxlbmRlZCB3aGVuIGJlaW5nIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRseVxuICogYWN0aXZlIHJlbmRlciB0YXJnZXQuIENhbiBiZTpcbiAqXG4gKiAtIHtAbGluayBCTEVORF9TVUJUUkFDVElWRX06IFN1YnRyYWN0IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGZyb20gdGhlIGRlc3RpbmF0aW9uXG4gKiBmcmFnbWVudCBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfQURESVRJVkV9OiBBZGQgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgdG8gdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50IGFuZFxuICogd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfTk9STUFMfTogRW5hYmxlIHNpbXBsZSB0cmFuc2x1Y2VuY3kgZm9yIG1hdGVyaWFscyBzdWNoIGFzIGdsYXNzLiBUaGlzIGlzXG4gKiBlcXVpdmFsZW50IHRvIGVuYWJsaW5nIGEgc291cmNlIGJsZW5kIG1vZGUgb2Yge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9IGFuZCBhIGRlc3RpbmF0aW9uXG4gKiBibGVuZCBtb2RlIG9mIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX0uXG4gKiAtIHtAbGluayBCTEVORF9OT05FfTogRGlzYWJsZSBibGVuZGluZy5cbiAqIC0ge0BsaW5rIEJMRU5EX1BSRU1VTFRJUExJRUR9OiBTaW1pbGFyIHRvIHtAbGluayBCTEVORF9OT1JNQUx9IGV4cGVjdCB0aGUgc291cmNlIGZyYWdtZW50IGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYWxyZWFkeSBiZWVuIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYSB2YWx1ZS5cbiAqIC0ge0BsaW5rIEJMRU5EX01VTFRJUExJQ0FUSVZFfTogTXVsdGlwbHkgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgYnkgdGhlIGNvbG9yIG9mIHRoZVxuICogZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG8gdGhlIGZyYW1lIGJ1ZmZlci5cbiAqIC0ge0BsaW5rIEJMRU5EX0FERElUSVZFQUxQSEF9OiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzXG4gKiBtdWx0aXBsaWVkIGJ5IHRoZSBzb3VyY2UgYWxwaGEuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9yaWVudGF0aW9uIFNvcnRpbmcgbW9kZS4gRm9yY2VzIENQVSBzaW11bGF0aW9uLCBzbyBiZSBjYXJlZnVsLlxuICpcbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOfTogUGFydGljbGVzIGFyZSBmYWNpbmcgY2FtZXJhLlxuICogLSB7QGxpbmsgUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRH06IFVzZXIgZGVmaW5lcyB3b3JsZCBzcGFjZSBub3JtYWwgKHBhcnRpY2xlTm9ybWFsKSB0byBzZXRcbiAqIHBsYW5lcyBvcmllbnRhdGlvbi5cbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fRU1JVFRFUn06IFNpbWlsYXIgdG8gcHJldmlvdXMsIGJ1dCB0aGUgbm9ybWFsIGlzIGFmZmVjdGVkIGJ5XG4gKiBlbWl0dGVyIChlbnRpdHkpIHRyYW5zZm9ybWF0aW9uLlxuICpcbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IHBhcnRpY2xlTm9ybWFsIChPbmx5IGZvclxuICogUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRCBhbmQgUEFSVElDTEVPUklFTlRBVElPTl9FTUlUVEVSKSBUaGUgZXhjZXB0aW9uIG9mIGV4dGVudHMgb2YgYSBsb2NhbFxuICogc3BhY2UgYm91bmRpbmcgYm94IHdpdGhpbiB3aGljaCBwYXJ0aWNsZXMgYXJlIG5vdCBzcGF3bmVkLiBBbGlnbmVkIHRvIHRoZSBjZW50ZXIgb2ZcbiAqIEVtaXR0ZXJFeHRlbnRzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS1zZXQuanMnKS5DdXJ2ZVNldH0gbG9jYWxWZWxvY2l0eUdyYXBoIFZlbG9jaXR5XG4gKiByZWxhdGl2ZSB0byBlbWl0dGVyIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLXNldC5qcycpLkN1cnZlU2V0fSBsb2NhbFZlbG9jaXR5R3JhcGgyIElmIG5vdCBudWxsLFxuICogcGFydGljbGVzIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIGxvY2FsVmVsb2NpdHlHcmFwaCBhbmQgbG9jYWxWZWxvY2l0eUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJykuQ3VydmVTZXR9IHZlbG9jaXR5R3JhcGggV29ybGQtc3BhY2VcbiAqIHZlbG9jaXR5IG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLXNldC5qcycpLkN1cnZlU2V0fSB2ZWxvY2l0eUdyYXBoMiBJZiBub3QgbnVsbCxcbiAqIHBhcnRpY2xlcyBwaWNrIHJhbmRvbSB2YWx1ZXMgYmV0d2VlbiB2ZWxvY2l0eUdyYXBoIGFuZCB2ZWxvY2l0eUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJykuQ3VydmVTZXR9IGNvbG9yR3JhcGggQ29sb3Igb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gcm90YXRpb25TcGVlZEdyYXBoIFJvdGF0aW9uIHNwZWVkIG92ZXJcbiAqIGxpZmV0aW1lLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSByb3RhdGlvblNwZWVkR3JhcGgyIElmIG5vdCBudWxsLFxuICogcGFydGljbGVzIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHJvdGF0aW9uU3BlZWRHcmFwaCBhbmQgcm90YXRpb25TcGVlZEdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gcmFkaWFsU3BlZWRHcmFwaCBSYWRpYWwgc3BlZWQgb3ZlclxuICogbGlmZXRpbWUsIHZlbG9jaXR5IHZlY3RvciBwb2ludHMgZnJvbSBlbWl0dGVyIG9yaWdpbiB0byBwYXJ0aWNsZSBwb3MuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IHJhZGlhbFNwZWVkR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXNcbiAqIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHJhZGlhbFNwZWVkR3JhcGggYW5kIHJhZGlhbFNwZWVkR3JhcGgyLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSBzY2FsZUdyYXBoIFNjYWxlIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IHNjYWxlR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGlja1xuICogcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHNjYWxlR3JhcGggYW5kIHNjYWxlR3JhcGgyLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSBhbHBoYUdyYXBoIEFscGhhIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IGFscGhhR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGlja1xuICogcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIGFscGhhR3JhcGggYW5kIGFscGhhR3JhcGgyLlxuICogQHByb3BlcnR5IHtudW1iZXJbXX0gbGF5ZXJzIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBwYXJ0aWNsZVxuICogc3lzdGVtIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gvcG9wL3NwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0XG4gKiBhIG5ldyBvbmUgaW5zdGVhZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUGFydGljbGVTeXN0ZW1Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZXF1ZXN0ZWREZXB0aCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RyYXdPcmRlciA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUGFydGljbGVTeXN0ZW1Db21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5QYXJ0aWNsZVN5c3RlbUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbVxuICAgICAqIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLm9uKCdzZXRfY29sb3JNYXBBc3NldCcsIHRoaXMub25TZXRDb2xvck1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X25vcm1hbE1hcEFzc2V0JywgdGhpcy5vblNldE5vcm1hbE1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X21lc2hBc3NldCcsIHRoaXMub25TZXRNZXNoQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbWVzaCcsIHRoaXMub25TZXRNZXNoLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X3JlbmRlckFzc2V0JywgdGhpcy5vblNldFJlbmRlckFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xvb3AnLCB0aGlzLm9uU2V0TG9vcCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9ibGVuZFR5cGUnLCB0aGlzLm9uU2V0QmxlbmRUeXBlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2RlcHRoU29mdGVuaW5nJywgdGhpcy5vblNldERlcHRoU29mdGVuaW5nLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xheWVycycsIHRoaXMub25TZXRMYXllcnMsIHRoaXMpO1xuXG4gICAgICAgIFNJTVBMRV9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldFNpbXBsZVByb3BlcnR5LCB0aGlzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQ09NUExFWF9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldENvbXBsZXhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEdSQVBIX1BST1BFUlRJRVMuZm9yRWFjaCgocHJvcCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbihgc2V0XyR7cHJvcH1gLCB0aGlzLm9uU2V0R3JhcGhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldCBkcmF3T3JkZXIoZHJhd09yZGVyKSB7XG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkcmF3T3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzKCkge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhbdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRMYXllcnMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQob2xkVmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChuZXdWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBfYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uQ29sb3JNYXBBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Db2xvck1hcEFzc2V0Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uQ29sb3JNYXBBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldENvbG9yTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG9sZFZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5jb2xvck1hcEFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRDb2xvck1hcEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2FkZDonICsgbmV3VmFsdWUsIChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kQ29sb3JNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yTWFwID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubm9ybWFsTWFwID0gbnVsbDtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldENoYW5nZShhc3NldCkge1xuICAgIH1cblxuICAgIG9uU2V0Tm9ybWFsTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgaWYgKG9sZFZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQob2xkVmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5ub3JtYWxNYXBBc3NldCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChuZXdWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub25jZSgnYWRkOicgKyBuZXdWYWx1ZSwgKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmROb3JtYWxNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk1lc2hBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1lc2hBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1lc2hBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NZXNoQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk1lc2hBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25NZXNoQ2hhbmdlZChhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25NZXNoQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldE1lc2hBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNZXNoQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5tZXNoQXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgICAgICBuZXdWYWx1ZSA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1lc2hBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRNZXNoKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICAvLyBoYWNrIHRoaXMgZm9yIG5vd1xuICAgICAgICAvLyBpZiB0aGUgdmFsdWUgYmVpbmcgc2V0IGlzIG51bGwsIGFuIGFzc2V0IG9yIGFuIGFzc2V0IGlkLCB0aGVuIGFzc3VtZSB3ZSBhcmVcbiAgICAgICAgLy8gc2V0dGluZyB0aGUgbWVzaCBhc3NldCwgd2hpY2ggd2lsbCBpbiB0dXJuIHVwZGF0ZSB0aGUgbWVzaFxuICAgICAgICBpZiAoIW5ld1ZhbHVlIHx8IG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQgfHwgdHlwZW9mIG5ld1ZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5tZXNoQXNzZXQgPSBuZXdWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobmV3VmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTWVzaENoYW5nZWQobWVzaCkge1xuICAgICAgICBpZiAobWVzaCAmJiAhKG1lc2ggaW5zdGFuY2VvZiBNZXNoKSkge1xuICAgICAgICAgICAgLy8gaWYgbWVzaCBpcyBhIHBjLk1vZGVsLCB1c2UgdGhlIGZpcnN0IG1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgaWYgKG1lc2gubWVzaEluc3RhbmNlc1swXSkge1xuICAgICAgICAgICAgICAgIG1lc2ggPSBtZXNoLm1lc2hJbnN0YW5jZXNbMF0ubWVzaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzaCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRhdGEubWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2ggPSBtZXNoO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICAgICAgICAgIHRoaXMucmVidWlsZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRSZW5kZXJBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLnJlbmRlckFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZFJlbmRlckFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRSZW5kZXJBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vblJlbmRlckFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25SZW5kZXJBc3NldFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBhc3NldC5yZXNvdXJjZS5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJDaGFuZ2VkKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZChhc3NldCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQ2hhbmdlZChyZW5kZXIpIHtcbiAgICAgICAgaWYgKCFyZW5kZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobnVsbCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZW5kZXIub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25SZW5kZXJTZXRNZXNoZXMsIHRoaXMpO1xuICAgICAgICByZW5kZXIub24oJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG5cbiAgICAgICAgaWYgKHJlbmRlci5tZXNoZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyU2V0TWVzaGVzKHJlbmRlci5tZXNoZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyU2V0TWVzaGVzKG1lc2hlcykge1xuICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG1lc2hlcyAmJiBtZXNoZXNbMF0pO1xuICAgIH1cblxuICAgIG9uU2V0TG9vcChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEJsZW5kVHlwZShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWF0ZXJpYWwuYmxlbmRUeXBlID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVxdWVzdERlcHRoKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKCFkZXB0aExheWVyKSBkZXB0aExheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChkZXB0aExheWVyKSB7XG4gICAgICAgICAgICBkZXB0aExheWVyLmluY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuX3JlcXVlc3RlZERlcHRoID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZWxlYXNlRGVwdGgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKGRlcHRoTGF5ZXIpIHtcbiAgICAgICAgICAgIGRlcHRoTGF5ZXIuZGVjcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdGVkRGVwdGggPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0RGVwdGhTb2Z0ZW5pbmcobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVxdWVzdERlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVsZWFzZURlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldFNpbXBsZVByb3BlcnR5KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldENvbXBsZXhQcm9wZXJ0eShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEdyYXBoUHJvcGVydHkobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlcltuYW1lXSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlYnVpbGRHcmFwaHMoKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgLy8gZ2V0IGRhdGEgc3RvcmUgb25jZVxuICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIC8vIGxvYWQgYW55IGFzc2V0cyB0aGF0IGhhdmVuJ3QgYmVlbiBsb2FkZWQgeWV0XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBBU1NFVF9QUk9QRVJUSUVTLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYXNzZXQgPSBkYXRhW0FTU0VUX1BST1BFUlRJRVNbaV1dO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgaWYgKCEoYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaWQgPSBwYXJzZUludChhc3NldCwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgbGV0IG1lc2ggPSBkYXRhLm1lc2g7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggbWlnaHQgYmUgYW4gYXNzZXQgaWQgb2YgYW4gYXNzZXRcbiAgICAgICAgICAgIC8vIHRoYXQgaGFzbid0IGJlZW4gbG9hZGVkIHlldFxuICAgICAgICAgICAgaWYgKCEobWVzaCBpbnN0YW5jZW9mIE1lc2gpKVxuICAgICAgICAgICAgICAgIG1lc2ggPSBudWxsO1xuXG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIgPSBuZXcgUGFydGljbGVFbWl0dGVyKHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZSwge1xuICAgICAgICAgICAgICAgIG51bVBhcnRpY2xlczogZGF0YS5udW1QYXJ0aWNsZXMsXG4gICAgICAgICAgICAgICAgZW1pdHRlckV4dGVudHM6IGRhdGEuZW1pdHRlckV4dGVudHMsXG4gICAgICAgICAgICAgICAgZW1pdHRlckV4dGVudHNJbm5lcjogZGF0YS5lbWl0dGVyRXh0ZW50c0lubmVyLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJSYWRpdXM6IGRhdGEuZW1pdHRlclJhZGl1cyxcbiAgICAgICAgICAgICAgICBlbWl0dGVyUmFkaXVzSW5uZXI6IGRhdGEuZW1pdHRlclJhZGl1c0lubmVyLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJTaGFwZTogZGF0YS5lbWl0dGVyU2hhcGUsXG4gICAgICAgICAgICAgICAgaW5pdGlhbFZlbG9jaXR5OiBkYXRhLmluaXRpYWxWZWxvY2l0eSxcbiAgICAgICAgICAgICAgICB3cmFwOiBkYXRhLndyYXAsXG4gICAgICAgICAgICAgICAgbG9jYWxTcGFjZTogZGF0YS5sb2NhbFNwYWNlLFxuICAgICAgICAgICAgICAgIHNjcmVlblNwYWNlOiBkYXRhLnNjcmVlblNwYWNlLFxuICAgICAgICAgICAgICAgIHdyYXBCb3VuZHM6IGRhdGEud3JhcEJvdW5kcyxcbiAgICAgICAgICAgICAgICBsaWZldGltZTogZGF0YS5saWZldGltZSxcbiAgICAgICAgICAgICAgICByYXRlOiBkYXRhLnJhdGUsXG4gICAgICAgICAgICAgICAgcmF0ZTI6IGRhdGEucmF0ZTIsXG5cbiAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogZGF0YS5vcmllbnRhdGlvbixcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZU5vcm1hbDogZGF0YS5wYXJ0aWNsZU5vcm1hbCxcblxuICAgICAgICAgICAgICAgIGFuaW1UaWxlc1g6IGRhdGEuYW5pbVRpbGVzWCxcbiAgICAgICAgICAgICAgICBhbmltVGlsZXNZOiBkYXRhLmFuaW1UaWxlc1ksXG4gICAgICAgICAgICAgICAgYW5pbVN0YXJ0RnJhbWU6IGRhdGEuYW5pbVN0YXJ0RnJhbWUsXG4gICAgICAgICAgICAgICAgYW5pbU51bUZyYW1lczogZGF0YS5hbmltTnVtRnJhbWVzLFxuICAgICAgICAgICAgICAgIGFuaW1OdW1BbmltYXRpb25zOiBkYXRhLmFuaW1OdW1BbmltYXRpb25zLFxuICAgICAgICAgICAgICAgIGFuaW1JbmRleDogZGF0YS5hbmltSW5kZXgsXG4gICAgICAgICAgICAgICAgcmFuZG9taXplQW5pbUluZGV4OiBkYXRhLnJhbmRvbWl6ZUFuaW1JbmRleCxcbiAgICAgICAgICAgICAgICBhbmltU3BlZWQ6IGRhdGEuYW5pbVNwZWVkLFxuICAgICAgICAgICAgICAgIGFuaW1Mb29wOiBkYXRhLmFuaW1Mb29wLFxuXG4gICAgICAgICAgICAgICAgc3RhcnRBbmdsZTogZGF0YS5zdGFydEFuZ2xlLFxuICAgICAgICAgICAgICAgIHN0YXJ0QW5nbGUyOiBkYXRhLnN0YXJ0QW5nbGUyLFxuXG4gICAgICAgICAgICAgICAgc2NhbGVHcmFwaDogZGF0YS5zY2FsZUdyYXBoLFxuICAgICAgICAgICAgICAgIHNjYWxlR3JhcGgyOiBkYXRhLnNjYWxlR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgY29sb3JHcmFwaDogZGF0YS5jb2xvckdyYXBoLFxuICAgICAgICAgICAgICAgIGNvbG9yR3JhcGgyOiBkYXRhLmNvbG9yR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgYWxwaGFHcmFwaDogZGF0YS5hbHBoYUdyYXBoLFxuICAgICAgICAgICAgICAgIGFscGhhR3JhcGgyOiBkYXRhLmFscGhhR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgbG9jYWxWZWxvY2l0eUdyYXBoOiBkYXRhLmxvY2FsVmVsb2NpdHlHcmFwaCxcbiAgICAgICAgICAgICAgICBsb2NhbFZlbG9jaXR5R3JhcGgyOiBkYXRhLmxvY2FsVmVsb2NpdHlHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICB2ZWxvY2l0eUdyYXBoOiBkYXRhLnZlbG9jaXR5R3JhcGgsXG4gICAgICAgICAgICAgICAgdmVsb2NpdHlHcmFwaDI6IGRhdGEudmVsb2NpdHlHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICByb3RhdGlvblNwZWVkR3JhcGg6IGRhdGEucm90YXRpb25TcGVlZEdyYXBoLFxuICAgICAgICAgICAgICAgIHJvdGF0aW9uU3BlZWRHcmFwaDI6IGRhdGEucm90YXRpb25TcGVlZEdyYXBoMixcblxuICAgICAgICAgICAgICAgIHJhZGlhbFNwZWVkR3JhcGg6IGRhdGEucmFkaWFsU3BlZWRHcmFwaCxcbiAgICAgICAgICAgICAgICByYWRpYWxTcGVlZEdyYXBoMjogZGF0YS5yYWRpYWxTcGVlZEdyYXBoMixcblxuICAgICAgICAgICAgICAgIGNvbG9yTWFwOiBkYXRhLmNvbG9yTWFwLFxuICAgICAgICAgICAgICAgIG5vcm1hbE1hcDogZGF0YS5ub3JtYWxNYXAsXG4gICAgICAgICAgICAgICAgbG9vcDogZGF0YS5sb29wLFxuICAgICAgICAgICAgICAgIHByZVdhcm06IGRhdGEucHJlV2FybSxcbiAgICAgICAgICAgICAgICBzb3J0OiBkYXRhLnNvcnQsXG4gICAgICAgICAgICAgICAgc3RyZXRjaDogZGF0YS5zdHJldGNoLFxuICAgICAgICAgICAgICAgIGFsaWduVG9Nb3Rpb246IGRhdGEuYWxpZ25Ub01vdGlvbixcbiAgICAgICAgICAgICAgICBsaWdodGluZzogZGF0YS5saWdodGluZyxcbiAgICAgICAgICAgICAgICBoYWxmTGFtYmVydDogZGF0YS5oYWxmTGFtYmVydCxcbiAgICAgICAgICAgICAgICBpbnRlbnNpdHk6IGRhdGEuaW50ZW5zaXR5LFxuICAgICAgICAgICAgICAgIGRlcHRoU29mdGVuaW5nOiBkYXRhLmRlcHRoU29mdGVuaW5nLFxuICAgICAgICAgICAgICAgIHNjZW5lOiB0aGlzLnN5c3RlbS5hcHAuc2NlbmUsXG4gICAgICAgICAgICAgICAgbWVzaDogbWVzaCxcbiAgICAgICAgICAgICAgICBkZXB0aFdyaXRlOiBkYXRhLmRlcHRoV3JpdGUsXG4gICAgICAgICAgICAgICAgbm9Gb2c6IGRhdGEubm9Gb2csXG4gICAgICAgICAgICAgICAgbm9kZTogdGhpcy5lbnRpdHksXG4gICAgICAgICAgICAgICAgYmxlbmRUeXBlOiBkYXRhLmJsZW5kVHlwZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2Uubm9kZSA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRyYXdPcmRlciA9IHRoaXMuZHJhd09yZGVyO1xuXG4gICAgICAgICAgICBpZiAoIWRhdGEuYXV0b1BsYXkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyLmNvbG9yTWFwKSB7XG4gICAgICAgICAgICB0aGlzLmFkZE1lc2hJbnN0YW5jZVRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCAmJiBkYXRhLmRlcHRoU29mdGVuaW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXF1ZXN0RGVwdGgoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1lc2hJbnN0YW5jZUZyb21MYXllcnMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuZGVwdGhTb2Z0ZW5pbmcpIHRoaXMuX3JlbGVhc2VEZXB0aCgpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBjYW1lcmEgYXMgaXQgaXNuJ3QgdXBkYXRlZCB3aGlsZSBkaXNhYmxlZCBhbmQgd2UgZG9uJ3Qgd2FudCB0byBob2xkXG4gICAgICAgICAgICAvLyBvbnRvIG9sZCByZWZlcmVuY2VcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5jYW1lcmEgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBhbGwgYXNzZXQgcHJvcGVydGllcyB0byByZW1vdmUgYW55IGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IEFTU0VUX1BST1BFUlRJRVMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBBU1NFVF9QUk9QRVJUSUVTW2ldO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhW3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twcm9wXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyBwYXJ0aWNsZSBzdGF0ZSwgZG9lc24ndCBhZmZlY3QgcGxheWluZy5cbiAgICAgKi9cbiAgICByZXNldCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNhYmxlcyB0aGUgZW1pc3Npb24gb2YgbmV3IHBhcnRpY2xlcywgbGV0cyBleGlzdGluZyB0byBmaW5pc2ggdGhlaXIgc2ltdWxhdGlvbi5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubG9vcCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0VGltZSgpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmFkZFRpbWUoMCwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlemVzIHRoZSBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLmRhdGEucGF1c2VkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmZyZWV6ZXMgdGhlIHNpbXVsYXRpb24uXG4gICAgICovXG4gICAgdW5wYXVzZSgpIHtcbiAgICAgICAgdGhpcy5kYXRhLnBhdXNlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMvdW5mcmVlemVzIHRoZSBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5wYXVzZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5sb29wID0gdGhpcy5kYXRhLmxvb3A7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgc2ltdWxhdGlvbiBpcyBpbiBwcm9ncmVzcy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gaXMgY3VycmVudGx5IHBsYXlpbmcgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpc1BsYXlpbmcoKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEucGF1c2VkKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlciAmJiB0aGlzLmVtaXR0ZXIubG9vcCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3NzaWJsZSBidWcgaGVyZSB3aGF0IGhhcHBlbnMgaWYgdGhlIG5vbiBsb29waW5nIGVtaXR0ZXJcbiAgICAgICAgLy8gd2FzIHBhdXNlZCBpbiB0aGUgbWVhbnRpbWU/XG4gICAgICAgIHJldHVybiBEYXRlLm5vdygpIDw9IHRoaXMuZW1pdHRlci5lbmRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYnVpbGRzIGFsbCBkYXRhIHVzZWQgYnkgdGhpcyBwYXJ0aWNsZSBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHJlYnVpbGQoKSB7XG4gICAgICAgIGNvbnN0IGVuYWJsZWQgPSB0aGlzLmVuYWJsZWQ7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVidWlsZCgpOyAvLyB3b3JzdCBjYXNlOiByZXF1aXJlZCB0byByZWJ1aWxkIGJ1ZmZlcnMvc2hhZGVyc1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS5ub2RlID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbmFibGVkID0gZW5hYmxlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiU0lNUExFX1BST1BFUlRJRVMiLCJDT01QTEVYX1BST1BFUlRJRVMiLCJHUkFQSF9QUk9QRVJUSUVTIiwiQVNTRVRfUFJPUEVSVElFUyIsImRlcHRoTGF5ZXIiLCJQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3JlcXVlc3RlZERlcHRoIiwiX2RyYXdPcmRlciIsIm9uIiwib25TZXRDb2xvck1hcEFzc2V0Iiwib25TZXROb3JtYWxNYXBBc3NldCIsIm9uU2V0TWVzaEFzc2V0Iiwib25TZXRNZXNoIiwib25TZXRSZW5kZXJBc3NldCIsIm9uU2V0TG9vcCIsIm9uU2V0QmxlbmRUeXBlIiwib25TZXREZXB0aFNvZnRlbmluZyIsIm9uU2V0TGF5ZXJzIiwiZm9yRWFjaCIsInByb3AiLCJvblNldFNpbXBsZVByb3BlcnR5Iiwib25TZXRDb21wbGV4UHJvcGVydHkiLCJvblNldEdyYXBoUHJvcGVydHkiLCJkcmF3T3JkZXIiLCJlbWl0dGVyIiwiYWRkTWVzaEluc3RhbmNlVG9MYXllcnMiLCJpIiwibGF5ZXJzIiwibGVuZ3RoIiwibGF5ZXIiLCJhcHAiLCJzY2VuZSIsImdldExheWVyQnlJZCIsImFkZE1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2UiLCJfbGF5ZXIiLCJyZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm5hbWUiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwiZW5hYmxlZCIsIm9uTGF5ZXJzQ2hhbmdlZCIsIm9sZENvbXAiLCJuZXdDb21wIiwib2ZmIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJpbmRleCIsImluZGV4T2YiLCJpZCIsIl9iaW5kQ29sb3JNYXBBc3NldCIsImFzc2V0IiwiX29uQ29sb3JNYXBBc3NldExvYWQiLCJfb25Db2xvck1hcEFzc2V0VW5sb2FkIiwiX29uQ29sb3JNYXBBc3NldFJlbW92ZSIsIl9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UiLCJyZXNvdXJjZSIsImFzc2V0cyIsImxvYWQiLCJfdW5iaW5kQ29sb3JNYXBBc3NldCIsImNvbG9yTWFwIiwiZ2V0IiwiQXNzZXQiLCJkYXRhIiwiY29sb3JNYXBBc3NldCIsIm9uY2UiLCJfYmluZE5vcm1hbE1hcEFzc2V0IiwiX29uTm9ybWFsTWFwQXNzZXRMb2FkIiwiX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQiLCJfb25Ob3JtYWxNYXBBc3NldFJlbW92ZSIsIl9vbk5vcm1hbE1hcEFzc2V0Q2hhbmdlIiwiX3VuYmluZE5vcm1hbE1hcEFzc2V0Iiwibm9ybWFsTWFwIiwibm9ybWFsTWFwQXNzZXQiLCJfYmluZE1lc2hBc3NldCIsIl9vbk1lc2hBc3NldExvYWQiLCJfb25NZXNoQXNzZXRVbmxvYWQiLCJfb25NZXNoQXNzZXRSZW1vdmUiLCJfb25NZXNoQXNzZXRDaGFuZ2UiLCJfdW5iaW5kTWVzaEFzc2V0IiwiX29uTWVzaENoYW5nZWQiLCJtZXNoIiwibWVzaEFzc2V0IiwiTWVzaCIsIm1lc2hJbnN0YW5jZXMiLCJyZXNldE1hdGVyaWFsIiwicmVidWlsZCIsIl91bmJpbmRSZW5kZXJBc3NldCIsInJlbmRlckFzc2V0IiwiX2JpbmRSZW5kZXJBc3NldCIsIl9vblJlbmRlckNoYW5nZWQiLCJfb25SZW5kZXJBc3NldExvYWQiLCJfb25SZW5kZXJBc3NldFVubG9hZCIsIl9vblJlbmRlckFzc2V0UmVtb3ZlIiwiX29uUmVuZGVyU2V0TWVzaGVzIiwicmVuZGVyIiwibWVzaGVzIiwicmVzZXRUaW1lIiwibWF0ZXJpYWwiLCJibGVuZFR5cGUiLCJfcmVxdWVzdERlcHRoIiwiTEFZRVJJRF9ERVBUSCIsImluY3JlbWVudENvdW50ZXIiLCJfcmVsZWFzZURlcHRoIiwiZGVjcmVtZW50Q291bnRlciIsInJlc2V0IiwicmVidWlsZEdyYXBocyIsIm9uRW5hYmxlIiwibGVuIiwicGFyc2VJbnQiLCJQYXJ0aWNsZUVtaXR0ZXIiLCJncmFwaGljc0RldmljZSIsIm51bVBhcnRpY2xlcyIsImVtaXR0ZXJFeHRlbnRzIiwiZW1pdHRlckV4dGVudHNJbm5lciIsImVtaXR0ZXJSYWRpdXMiLCJlbWl0dGVyUmFkaXVzSW5uZXIiLCJlbWl0dGVyU2hhcGUiLCJpbml0aWFsVmVsb2NpdHkiLCJ3cmFwIiwibG9jYWxTcGFjZSIsInNjcmVlblNwYWNlIiwid3JhcEJvdW5kcyIsImxpZmV0aW1lIiwicmF0ZSIsInJhdGUyIiwib3JpZW50YXRpb24iLCJwYXJ0aWNsZU5vcm1hbCIsImFuaW1UaWxlc1giLCJhbmltVGlsZXNZIiwiYW5pbVN0YXJ0RnJhbWUiLCJhbmltTnVtRnJhbWVzIiwiYW5pbU51bUFuaW1hdGlvbnMiLCJhbmltSW5kZXgiLCJyYW5kb21pemVBbmltSW5kZXgiLCJhbmltU3BlZWQiLCJhbmltTG9vcCIsInN0YXJ0QW5nbGUiLCJzdGFydEFuZ2xlMiIsInNjYWxlR3JhcGgiLCJzY2FsZUdyYXBoMiIsImNvbG9yR3JhcGgiLCJjb2xvckdyYXBoMiIsImFscGhhR3JhcGgiLCJhbHBoYUdyYXBoMiIsImxvY2FsVmVsb2NpdHlHcmFwaCIsImxvY2FsVmVsb2NpdHlHcmFwaDIiLCJ2ZWxvY2l0eUdyYXBoIiwidmVsb2NpdHlHcmFwaDIiLCJyb3RhdGlvblNwZWVkR3JhcGgiLCJyb3RhdGlvblNwZWVkR3JhcGgyIiwicmFkaWFsU3BlZWRHcmFwaCIsInJhZGlhbFNwZWVkR3JhcGgyIiwibG9vcCIsInByZVdhcm0iLCJzb3J0Iiwic3RyZXRjaCIsImFsaWduVG9Nb3Rpb24iLCJsaWdodGluZyIsImhhbGZMYW1iZXJ0IiwiaW50ZW5zaXR5IiwiZGVwdGhTb2Z0ZW5pbmciLCJkZXB0aFdyaXRlIiwibm9Gb2ciLCJub2RlIiwiYXV0b1BsYXkiLCJwYXVzZSIsInZpc2libGUiLCJvbkRpc2FibGUiLCJjYW1lcmEiLCJvbkJlZm9yZVJlbW92ZSIsImRlc3Ryb3kiLCJzdG9wIiwiYWRkVGltZSIsInBhdXNlZCIsInVucGF1c2UiLCJwbGF5IiwiaXNQbGF5aW5nIiwiRGF0ZSIsIm5vdyIsImVuZFRpbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBUUE7QUFDQSxNQUFNQSxpQkFBaUIsR0FBRyxDQUN0QixnQkFBZ0IsRUFDaEIsZUFBZSxFQUNmLHFCQUFxQixFQUNyQixvQkFBb0IsRUFDcEIsTUFBTSxFQUNOLGlCQUFpQixFQUNqQixXQUFXLEVBQ1gsV0FBVyxFQUNYLGdCQUFnQixDQUNuQixDQUFBOztBQUVEO0FBQ0EsTUFBTUMsa0JBQWtCLEdBQUcsQ0FDdkIsY0FBYyxFQUNkLFVBQVUsRUFDVixNQUFNLEVBQ04sT0FBTyxFQUNQLFlBQVksRUFDWixhQUFhLEVBQ2IsVUFBVSxFQUNWLGFBQWEsRUFDYixXQUFXLEVBQ1gsTUFBTSxFQUNOLFlBQVksRUFDWixZQUFZLEVBQ1osT0FBTyxFQUNQLE1BQU0sRUFDTixTQUFTLEVBQ1QsZUFBZSxFQUNmLFNBQVMsRUFDVCxjQUFjLEVBQ2QsWUFBWSxFQUNaLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsZUFBZSxFQUNmLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsb0JBQW9CLEVBQ3BCLFVBQVUsRUFDVixVQUFVLEVBQ1YsWUFBWSxFQUNaLGFBQWEsRUFDYixhQUFhLENBQ2hCLENBQUE7QUFFRCxNQUFNQyxnQkFBZ0IsR0FBRyxDQUNyQixZQUFZLEVBQ1osYUFB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
