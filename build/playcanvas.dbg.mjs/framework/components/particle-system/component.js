/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
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
 * @property {number} blend Controls how particles are blended when being written to the currently
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcGFydGljbGUtc3lzdGVtL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX0RFUFRIIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8vIHByb3BlcnRpZXMgdGhhdCBkbyBub3QgbmVlZCByZWJ1aWxkaW5nIHRoZSBwYXJ0aWNsZSBzeXN0ZW1cbmNvbnN0IFNJTVBMRV9QUk9QRVJUSUVTID0gW1xuICAgICdlbWl0dGVyRXh0ZW50cycsXG4gICAgJ2VtaXR0ZXJSYWRpdXMnLFxuICAgICdlbWl0dGVyRXh0ZW50c0lubmVyJyxcbiAgICAnZW1pdHRlclJhZGl1c0lubmVyJyxcbiAgICAnbG9vcCcsXG4gICAgJ2luaXRpYWxWZWxvY2l0eScsXG4gICAgJ2FuaW1TcGVlZCcsXG4gICAgJ25vcm1hbE1hcCcsXG4gICAgJ3BhcnRpY2xlTm9ybWFsJ1xuXTtcblxuLy8gcHJvcGVydGllcyB0aGF0IG5lZWQgcmVidWlsZGluZyB0aGUgcGFydGljbGUgc3lzdGVtXG5jb25zdCBDT01QTEVYX1BST1BFUlRJRVMgPSBbXG4gICAgJ251bVBhcnRpY2xlcycsXG4gICAgJ2xpZmV0aW1lJyxcbiAgICAncmF0ZScsXG4gICAgJ3JhdGUyJyxcbiAgICAnc3RhcnRBbmdsZScsXG4gICAgJ3N0YXJ0QW5nbGUyJyxcbiAgICAnbGlnaHRpbmcnLFxuICAgICdoYWxmTGFtYmVydCcsXG4gICAgJ2ludGVuc2l0eScsXG4gICAgJ3dyYXAnLFxuICAgICd3cmFwQm91bmRzJyxcbiAgICAnZGVwdGhXcml0ZScsXG4gICAgJ25vRm9nJyxcbiAgICAnc29ydCcsXG4gICAgJ3N0cmV0Y2gnLFxuICAgICdhbGlnblRvTW90aW9uJyxcbiAgICAncHJlV2FybScsXG4gICAgJ2VtaXR0ZXJTaGFwZScsXG4gICAgJ2FuaW1UaWxlc1gnLFxuICAgICdhbmltVGlsZXNZJyxcbiAgICAnYW5pbVN0YXJ0RnJhbWUnLFxuICAgICdhbmltTnVtRnJhbWVzJyxcbiAgICAnYW5pbU51bUFuaW1hdGlvbnMnLFxuICAgICdhbmltSW5kZXgnLFxuICAgICdyYW5kb21pemVBbmltSW5kZXgnLFxuICAgICdhbmltTG9vcCcsXG4gICAgJ2NvbG9yTWFwJyxcbiAgICAnbG9jYWxTcGFjZScsXG4gICAgJ3NjcmVlblNwYWNlJyxcbiAgICAnb3JpZW50YXRpb24nXG5dO1xuXG5jb25zdCBHUkFQSF9QUk9QRVJUSUVTID0gW1xuICAgICdzY2FsZUdyYXBoJyxcbiAgICAnc2NhbGVHcmFwaDInLFxuXG4gICAgJ2NvbG9yR3JhcGgnLFxuICAgICdjb2xvckdyYXBoMicsXG5cbiAgICAnYWxwaGFHcmFwaCcsXG4gICAgJ2FscGhhR3JhcGgyJyxcblxuICAgICd2ZWxvY2l0eUdyYXBoJyxcbiAgICAndmVsb2NpdHlHcmFwaDInLFxuXG4gICAgJ2xvY2FsVmVsb2NpdHlHcmFwaCcsXG4gICAgJ2xvY2FsVmVsb2NpdHlHcmFwaDInLFxuXG4gICAgJ3JvdGF0aW9uU3BlZWRHcmFwaCcsXG4gICAgJ3JvdGF0aW9uU3BlZWRHcmFwaDInLFxuXG4gICAgJ3JhZGlhbFNwZWVkR3JhcGgnLFxuICAgICdyYWRpYWxTcGVlZEdyYXBoMidcbl07XG5cbmNvbnN0IEFTU0VUX1BST1BFUlRJRVMgPSBbXG4gICAgJ2NvbG9yTWFwQXNzZXQnLFxuICAgICdub3JtYWxNYXBBc3NldCcsXG4gICAgJ21lc2hBc3NldCcsXG4gICAgJ3JlbmRlckFzc2V0J1xuXTtcblxubGV0IGRlcHRoTGF5ZXI7XG5cbi8qKlxuICogVXNlZCB0byBzaW11bGF0ZSBwYXJ0aWNsZXMgYW5kIHByb2R1Y2UgcmVuZGVyYWJsZSBwYXJ0aWNsZSBtZXNoIG9uIGVpdGhlciBDUFUgb3IgR1BVLiBHUFVcbiAqIHNpbXVsYXRpb24gaXMgZ2VuZXJhbGx5IG11Y2ggZmFzdGVyIHRoYW4gaXRzIENQVSBjb3VudGVycGFydCwgYmVjYXVzZSBpdCBhdm9pZHMgc2xvdyBDUFUtR1BVXG4gKiBzeW5jaHJvbml6YXRpb24gYW5kIHRha2VzIGFkdmFudGFnZSBvZiBtYW55IEdQVSBjb3Jlcy4gSG93ZXZlciwgaXQgcmVxdWlyZXMgY2xpZW50IHRvIHN1cHBvcnRcbiAqIHJlYXNvbmFibGUgdW5pZm9ybSBjb3VudCwgcmVhZGluZyBmcm9tIG11bHRpcGxlIHRleHR1cmVzIGluIHZlcnRleCBzaGFkZXIgYW5kIE9FU190ZXh0dXJlX2Zsb2F0XG4gKiBleHRlbnNpb24sIGluY2x1ZGluZyByZW5kZXJpbmcgaW50byBmbG9hdCB0ZXh0dXJlcy4gTW9zdCBtb2JpbGUgZGV2aWNlcyBmYWlsIHRvIHNhdGlzZnkgdGhlc2VcbiAqIHJlcXVpcmVtZW50cywgc28gaXQncyBub3QgcmVjb21tZW5kZWQgdG8gc2ltdWxhdGUgdGhvdXNhbmRzIG9mIHBhcnRpY2xlcyBvbiB0aGVtLiBHUFUgdmVyc2lvblxuICogYWxzbyBjYW4ndCBzb3J0IHBhcnRpY2xlcywgc28gZW5hYmxpbmcgc29ydGluZyBmb3JjZXMgQ1BVIG1vZGUgdG9vLiBQYXJ0aWNsZSByb3RhdGlvbiBpc1xuICogc3BlY2lmaWVkIGJ5IGEgc2luZ2xlIGFuZ2xlIHBhcmFtZXRlcjogZGVmYXVsdCBiaWxsYm9hcmQgcGFydGljbGVzIHJvdGF0ZSBhcm91bmQgY2FtZXJhIGZhY2luZ1xuICogYXhpcywgd2hpbGUgbWVzaCBwYXJ0aWNsZXMgcm90YXRlIGFyb3VuZCAyIGRpZmZlcmVudCB2aWV3LWluZGVwZW5kZW50IGF4ZXMuIE1vc3Qgb2YgdGhlXG4gKiBzaW11bGF0aW9uIHBhcmFtZXRlcnMgYXJlIHNwZWNpZmllZCB3aXRoIHtAbGluayBDdXJ2ZX0gb3Ige0BsaW5rIEN1cnZlU2V0fS4gQ3VydmVzIGFyZVxuICogaW50ZXJwb2xhdGVkIGJhc2VkIG9uIGVhY2ggcGFydGljbGUncyBsaWZldGltZSwgdGhlcmVmb3JlIHBhcmFtZXRlcnMgYXJlIGFibGUgdG8gY2hhbmdlIG92ZXJcbiAqIHRpbWUuIE1vc3Qgb2YgdGhlIGN1cnZlIHBhcmFtZXRlcnMgY2FuIGFsc28gYmUgc3BlY2lmaWVkIGJ5IDIgbWluaW11bS9tYXhpbXVtIGN1cnZlcywgdGhpcyB3YXlcbiAqIGVhY2ggcGFydGljbGUgd2lsbCBwaWNrIGEgcmFuZG9tIHZhbHVlIGluLWJldHdlZW4uXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvUGxheSBDb250cm9scyB3aGV0aGVyIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gcGxheXMgYXV0b21hdGljYWxseSBvblxuICogY3JlYXRpb24uIElmIHNldCB0byBmYWxzZSwgaXQgaXMgbmVjZXNzYXJ5IHRvIGNhbGwge0BsaW5rIFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50I3BsYXl9IGZvciB0aGVcbiAqIHBhcnRpY2xlIHN5c3RlbSB0byBwbGF5LiBEZWZhdWx0cyB0byB0cnVlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsb29wIEVuYWJsZXMgb3IgZGlzYWJsZXMgcmVzcGF3bmluZyBvZiBwYXJ0aWNsZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHByZVdhcm0gSWYgZW5hYmxlZCwgdGhlIHBhcnRpY2xlIHN5c3RlbSB3aWxsIGJlIGluaXRpYWxpemVkIGFzIHRob3VnaCBpdCBoYWRcbiAqIGFscmVhZHkgY29tcGxldGVkIGEgZnVsbCBjeWNsZS4gVGhpcyBvbmx5IHdvcmtzIHdpdGggbG9vcGluZyBwYXJ0aWNsZSBzeXN0ZW1zLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsaWdodGluZyBJZiBlbmFibGVkLCBwYXJ0aWNsZXMgd2lsbCBiZSBsaXQgYnkgYW1iaWVudCBhbmQgZGlyZWN0aW9uYWxcbiAqIGxpZ2h0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaGFsZkxhbWJlcnQgRW5hYmxpbmcgSGFsZiBMYW1iZXJ0IGxpZ2h0aW5nIGF2b2lkcyBwYXJ0aWNsZXMgbG9va2luZyB0b28gZmxhdFxuICogaW4gc2hhZG93ZWQgYXJlYXMuIEl0IGlzIGEgY29tcGxldGVseSBub24tcGh5c2ljYWwgbGlnaHRpbmcgbW9kZWwgYnV0IGNhbiBnaXZlIG1vcmUgcGxlYXNpbmdcbiAqIHZpc3VhbCByZXN1bHRzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhbGlnblRvTW90aW9uIE9yaWVudCBwYXJ0aWNsZXMgaW4gdGhlaXIgZGlyZWN0aW9uIG9mIG1vdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZGVwdGhXcml0ZSBJZiBlbmFibGVkLCB0aGUgcGFydGljbGVzIHdpbGwgd3JpdGUgdG8gdGhlIGRlcHRoIGJ1ZmZlci4gSWZcbiAqIGRpc2FibGVkLCB0aGUgZGVwdGggYnVmZmVyIGlzIGxlZnQgdW5jaGFuZ2VkIGFuZCBwYXJ0aWNsZXMgd2lsbCBiZSBndWFyYW50ZWVkIHRvIG92ZXJ3cml0ZSBvbmVcbiAqIGFub3RoZXIgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZXkgYXJlIHJlbmRlcmVkLlxuICogQHByb3BlcnR5IHtib29sZWFufSBub0ZvZyBEaXNhYmxlIGZvZ2dpbmcuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGxvY2FsU3BhY2UgQmluZHMgcGFydGljbGVzIHRvIGVtaXR0ZXIgdHJhbnNmb3JtYXRpb24gcmF0aGVyIHRoZW4gd29ybGRcbiAqIHNwYWNlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzY3JlZW5TcGFjZSBSZW5kZXJzIHBhcnRpY2xlcyBpbiAyRCBzY3JlZW4gc3BhY2UuIFRoaXMgbmVlZHMgdG8gYmUgc2V0IHdoZW5cbiAqIHBhcnRpY2xlIHN5c3RlbSBpcyBwYXJ0IG9mIGhpZXJhcmNoeSB3aXRoIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFzIGl0cyBhbmNlc3RvciwgYW5kIGFsbG93c1xuICogcGFydGljbGUgc3lzdGVtIHRvIGludGVncmF0ZSB3aXRoIHRoZSByZW5kZXJpbmcgb2Yge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy4gTm90ZSB0aGF0IGFuXG4gKiBlbnRpdHkgd2l0aCBQYXJ0aWNsZVN5c3RlbSBjb21wb25lbnQgY2Fubm90IGJlIHBhcmVudGVkIGRpcmVjdGx5IHRvIHtAbGluayBTY3JlZW5Db21wb25lbnR9LCBidXRcbiAqIGhhcyB0byBiZSBhIGNoaWxkIG9mIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9LCBmb3IgZXhhbXBsZSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG51bVBhcnRpY2xlcyBNYXhpbXVtIG51bWJlciBvZiBzaW11bGF0ZWQgcGFydGljbGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhdGUgTWluaW1hbCBpbnRlcnZhbCBpbiBzZWNvbmRzIGJldHdlZW4gcGFydGljbGUgYmlydGhzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhdGUyIE1heGltYWwgaW50ZXJ2YWwgaW4gc2Vjb25kcyBiZXR3ZWVuIHBhcnRpY2xlIGJpcnRocy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdGFydEFuZ2xlIE1pbmltYWwgaW5pdGlhbCBFdWxlciBhbmdsZSBvZiBhIHBhcnRpY2xlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN0YXJ0QW5nbGUyIE1heGltYWwgaW5pdGlhbCBFdWxlciBhbmdsZSBvZiBhIHBhcnRpY2xlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGxpZmV0aW1lIFRoZSBsZW5ndGggb2YgdGltZSBpbiBzZWNvbmRzIGJldHdlZW4gYSBwYXJ0aWNsZSdzIGJpcnRoIGFuZCBpdHNcbiAqIGRlYXRoLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN0cmV0Y2ggQSB2YWx1ZSBpbiB3b3JsZCB1bml0cyB0aGF0IGNvbnRyb2xzIHRoZSBhbW91bnQgYnkgd2hpY2ggcGFydGljbGVzXG4gKiBhcmUgc3RyZXRjaGVkIGJhc2VkIG9uIHRoZWlyIHZlbG9jaXR5LiBQYXJ0aWNsZXMgYXJlIHN0cmV0Y2hlZCBmcm9tIHRoZWlyIGNlbnRlciB0b3dhcmRzIHRoZWlyXG4gKiBwcmV2aW91cyBwb3NpdGlvbi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnRlbnNpdHkgQ29sb3IgbXVsdGlwbGllci5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYW5pbUxvb3AgQ29udHJvbHMgd2hldGhlciB0aGUgc3ByaXRlIHNoZWV0IGFuaW1hdGlvbiBwbGF5cyBvbmNlIG9yIGxvb3BzXG4gKiBjb250aW51b3VzbHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbVRpbGVzWCBOdW1iZXIgb2YgaG9yaXpvbnRhbCB0aWxlcyBpbiB0aGUgc3ByaXRlIHNoZWV0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1UaWxlc1kgTnVtYmVyIG9mIHZlcnRpY2FsIHRpbGVzIGluIHRoZSBzcHJpdGUgc2hlZXQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbU51bUFuaW1hdGlvbnMgTnVtYmVyIG9mIHNwcml0ZSBzaGVldCBhbmltYXRpb25zIGNvbnRhaW5lZCB3aXRoaW4gdGhlXG4gKiBjdXJyZW50IHNwcml0ZSBzaGVldC4gVGhlIG51bWJlciBvZiBhbmltYXRpb25zIG11bHRpcGxpZWQgYnkgbnVtYmVyIG9mIGZyYW1lcyBzaG91bGQgYmUgYSB2YWx1ZVxuICogbGVzcyB0aGFuIGFuaW1UaWxlc1ggbXVsdGlwbGllZCBieSBhbmltVGlsZXNZLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1OdW1GcmFtZXMgTnVtYmVyIG9mIHNwcml0ZSBzaGVldCBmcmFtZXMgaW4gdGhlIGN1cnJlbnQgc3ByaXRlIHNoZWV0XG4gKiBhbmltYXRpb24uIFRoZSBudW1iZXIgb2YgYW5pbWF0aW9ucyBtdWx0aXBsaWVkIGJ5IG51bWJlciBvZiBmcmFtZXMgc2hvdWxkIGJlIGEgdmFsdWUgbGVzcyB0aGFuXG4gKiBhbmltVGlsZXNYIG11bHRpcGxpZWQgYnkgYW5pbVRpbGVzWS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltU3RhcnRGcmFtZSBUaGUgc3ByaXRlIHNoZWV0IGZyYW1lIHRoYXQgdGhlIGFuaW1hdGlvbiBzaG91bGQgYmVnaW4gcGxheWluZ1xuICogZnJvbS4gSW5kZXhlZCBmcm9tIHRoZSBzdGFydCBvZiB0aGUgY3VycmVudCBhbmltYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbUluZGV4IFdoZW4gYW5pbU51bUFuaW1hdGlvbnMgaXMgZ3JlYXRlciB0aGFuIDEsIHRoZSBzcHJpdGUgc2hlZXRcbiAqIGFuaW1hdGlvbiBpbmRleCBkZXRlcm1pbmVzIHdoaWNoIGFuaW1hdGlvbiB0aGUgcGFydGljbGUgc3lzdGVtIHNob3VsZCBwbGF5LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmRvbWl6ZUFuaW1JbmRleCBFYWNoIHBhcnRpY2xlIGVtaXR0ZWQgYnkgdGhlIHN5c3RlbSB3aWxsIHBsYXkgYSByYW5kb21cbiAqIGFuaW1hdGlvbiBmcm9tIHRoZSBzcHJpdGUgc2hlZXQsIHVwIHRvIGFuaW1OdW1BbmltYXRpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1TcGVlZCBTcHJpdGUgc2hlZXQgYW5pbWF0aW9uIHNwZWVkLiAxID0gcGFydGljbGUgbGlmZXRpbWUsIDIgPSB0d2ljZVxuICogZHVyaW5nIGxpZmV0aW1lIGV0Yy4uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRlcHRoU29mdGVuaW5nIENvbnRyb2xzIGZhZGluZyBvZiBwYXJ0aWNsZXMgbmVhciB0aGVpciBpbnRlcnNlY3Rpb25zIHdpdGhcbiAqIHNjZW5lIGdlb21ldHJ5LiBUaGlzIGVmZmVjdCwgd2hlbiBpdCdzIG5vbi16ZXJvLCByZXF1aXJlcyBzY2VuZSBkZXB0aCBtYXAgdG8gYmUgcmVuZGVyZWQuXG4gKiBNdWx0aXBsZSBkZXB0aC1kZXBlbmRlbnQgZWZmZWN0cyBjYW4gc2hhcmUgdGhlIHNhbWUgbWFwLCBidXQgaWYgeW91IG9ubHkgdXNlIGl0IGZvciBwYXJ0aWNsZXMsXG4gKiBiZWFyIGluIG1pbmQgdGhhdCBpdCBjYW4gZG91YmxlIGVuZ2luZSBkcmF3IGNhbGxzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGluaXRpYWxWZWxvY2l0eSBEZWZpbmVzIG1hZ25pdHVkZSBvZiB0aGUgaW5pdGlhbCBlbWl0dGVyIHZlbG9jaXR5LiBEaXJlY3Rpb25cbiAqIGlzIGdpdmVuIGJ5IGVtaXR0ZXIgc2hhcGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBlbWl0dGVyRXh0ZW50cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX0JPWClcbiAqIFRoZSBleHRlbnRzIG9mIGEgbG9jYWwgc3BhY2UgYm91bmRpbmcgYm94IHdpdGhpbiB3aGljaCBwYXJ0aWNsZXMgYXJlIHNwYXduZWQgYXQgcmFuZG9tIHBvc2l0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGVtaXR0ZXJFeHRlbnRzSW5uZXIgKE9ubHkgZm9yXG4gKiBFTUlUVEVSU0hBUEVfQk9YKSBUaGUgZXhjZXB0aW9uIG9mIGV4dGVudHMgb2YgYSBsb2NhbCBzcGFjZSBib3VuZGluZyBib3ggd2l0aGluIHdoaWNoIHBhcnRpY2xlc1xuICogYXJlIG5vdCBzcGF3bmVkLiBBbGlnbmVkIHRvIHRoZSBjZW50ZXIgb2YgRW1pdHRlckV4dGVudHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pdHRlclJhZGl1cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX1NQSEVSRSkgVGhlIHJhZGl1cyB3aXRoaW4gd2hpY2hcbiAqIHBhcnRpY2xlcyBhcmUgc3Bhd25lZCBhdCByYW5kb20gcG9zaXRpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGVtaXR0ZXJSYWRpdXNJbm5lciAoT25seSBmb3IgRU1JVFRFUlNIQVBFX1NQSEVSRSkgVGhlIGlubmVyIHJhZGl1cyB3aXRoaW5cbiAqIHdoaWNoIHBhcnRpY2xlcyBhcmUgbm90IHNwYXduZWQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSB3cmFwQm91bmRzIFRoZSBoYWxmIGV4dGVudHMgb2YgYSB3b3JsZFxuICogc3BhY2UgYm94IHZvbHVtZSBjZW50ZXJlZCBvbiB0aGUgb3duZXIgZW50aXR5J3MgcG9zaXRpb24uIElmIGEgcGFydGljbGUgY3Jvc3NlcyB0aGUgYm91bmRhcnkgb2ZcbiAqIG9uZSBzaWRlIG9mIHRoZSB2b2x1bWUsIGl0IHRlbGVwb3J0cyB0byB0aGUgb3Bwb3NpdGUgc2lkZS5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IGNvbG9yTWFwQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIGNvbG9yTWFwLlxuICogQHByb3BlcnR5IHtBc3NldH0gbm9ybWFsTWFwQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIG5vcm1hbE1hcC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IG1lc2hBc3NldCBUaGUge0BsaW5rIEFzc2V0fSB1c2VkIHRvIHNldCB0aGUgbWVzaC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IHJlbmRlckFzc2V0IFRoZSBSZW5kZXIge0BsaW5rIEFzc2V0fSB1c2VkIHRvIHNldCB0aGUgbWVzaC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gY29sb3JNYXAgVGhlIGNvbG9yIG1hcCB0ZXh0dXJlIHRvIGFwcGx5IHRvIGFsbCBwYXJ0aWNsZXMgaW4gdGhlIHN5c3RlbS4gSWZcbiAqIG5vIHRleHR1cmUgaXMgYXNzaWduZWQsIGEgZGVmYXVsdCBzcG90IHRleHR1cmUgaXMgdXNlZC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gbm9ybWFsTWFwIFRoZSBub3JtYWwgbWFwIHRleHR1cmUgdG8gYXBwbHkgdG8gYWxsIHBhcnRpY2xlcyBpbiB0aGUgc3lzdGVtLiBJZlxuICogbm8gdGV4dHVyZSBpcyBhc3NpZ25lZCwgYW4gYXBwcm94aW1hdGUgc3BoZXJpY2FsIG5vcm1hbCBpcyBjYWxjdWxhdGVkIGZvciBlYWNoIHZlcnRleC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWl0dGVyU2hhcGUgU2hhcGUgb2YgdGhlIGVtaXR0ZXIuIERlZmluZXMgdGhlIGJvdW5kcyBpbnNpZGUgd2hpY2ggcGFydGljbGVzXG4gKiBhcmUgc3Bhd25lZC4gQWxzbyBhZmZlY3RzIHRoZSBkaXJlY3Rpb24gb2YgaW5pdGlhbCB2ZWxvY2l0eS5cbiAqXG4gKiAtIHtAbGluayBFTUlUVEVSU0hBUEVfQk9YfTogQm94IHNoYXBlIHBhcmFtZXRlcml6ZWQgYnkgZW1pdHRlckV4dGVudHMuIEluaXRpYWwgdmVsb2NpdHkgaXNcbiAqIGRpcmVjdGVkIHRvd2FyZHMgbG9jYWwgWiBheGlzLlxuICogLSB7QGxpbmsgRU1JVFRFUlNIQVBFX1NQSEVSRX06IFNwaGVyZSBzaGFwZSBwYXJhbWV0ZXJpemVkIGJ5IGVtaXR0ZXJSYWRpdXMuIEluaXRpYWwgdmVsb2NpdHkgaXNcbiAqIGRpcmVjdGVkIG91dHdhcmRzIGZyb20gdGhlIGNlbnRlci5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gc29ydCBTb3J0aW5nIG1vZGUuIEZvcmNlcyBDUFUgc2ltdWxhdGlvbiwgc28gYmUgY2FyZWZ1bC5cbiAqXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfTk9ORX06IE5vIHNvcnRpbmcsIHBhcnRpY2xlcyBhcmUgZHJhd24gaW4gYXJiaXRyYXJ5IG9yZGVyLiBDYW4gYmVcbiAqIHNpbXVsYXRlZCBvbiBHUFUuXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfRElTVEFOQ0V9OiBTb3J0aW5nIGJhc2VkIG9uIGRpc3RhbmNlIHRvIHRoZSBjYW1lcmEuIENQVSBvbmx5LlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX05FV0VSX0ZJUlNUfTogTmV3ZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfT0xERVJfRklSU1R9OiBPbGRlciBwYXJ0aWNsZXMgYXJlIGRyYXduIGZpcnN0LiBDUFUgb25seS5cbiAqXG4gKiBAcHJvcGVydHkge01lc2h9IG1lc2ggVHJpYW5ndWxhciBtZXNoIHRvIGJlIHVzZWQgYXMgYSBwYXJ0aWNsZS4gT25seSBmaXJzdCB2ZXJ0ZXgvaW5kZXggYnVmZmVyXG4gKiBpcyB1c2VkLiBWZXJ0ZXggYnVmZmVyIG11c3QgY29udGFpbiBsb2NhbCBwb3NpdGlvbiBhdCBmaXJzdCAzIGZsb2F0cyBvZiBlYWNoIHZlcnRleC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBibGVuZCBDb250cm9scyBob3cgcGFydGljbGVzIGFyZSBibGVuZGVkIHdoZW4gYmVpbmcgd3JpdHRlbiB0byB0aGUgY3VycmVudGx5XG4gKiBhY3RpdmUgcmVuZGVyIHRhcmdldC4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIEJMRU5EX1NVQlRSQUNUSVZFfTogU3VidHJhY3QgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgZnJvbSB0aGUgZGVzdGluYXRpb25cbiAqIGZyYWdtZW50IGFuZCB3cml0ZSB0aGUgcmVzdWx0IHRvIHRoZSBmcmFtZSBidWZmZXIuXG4gKiAtIHtAbGluayBCTEVORF9BRERJVElWRX06IEFkZCB0aGUgY29sb3Igb2YgdGhlIHNvdXJjZSBmcmFnbWVudCB0byB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kXG4gKiB3cml0ZSB0aGUgcmVzdWx0IHRvIHRoZSBmcmFtZSBidWZmZXIuXG4gKiAtIHtAbGluayBCTEVORF9OT1JNQUx9OiBFbmFibGUgc2ltcGxlIHRyYW5zbHVjZW5jeSBmb3IgbWF0ZXJpYWxzIHN1Y2ggYXMgZ2xhc3MuIFRoaXMgaXNcbiAqIGVxdWl2YWxlbnQgdG8gZW5hYmxpbmcgYSBzb3VyY2UgYmxlbmQgbW9kZSBvZiB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQX0gYW5kIGEgZGVzdGluYXRpb25cbiAqIGJsZW5kIG1vZGUgb2Yge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBfS5cbiAqIC0ge0BsaW5rIEJMRU5EX05PTkV9OiBEaXNhYmxlIGJsZW5kaW5nLlxuICogLSB7QGxpbmsgQkxFTkRfUFJFTVVMVElQTElFRH06IFNpbWlsYXIgdG8ge0BsaW5rIEJMRU5EX05PUk1BTH0gZXhwZWN0IHRoZSBzb3VyY2UgZnJhZ21lbnQgaXNcbiAqIGFzc3VtZWQgdG8gaGF2ZSBhbHJlYWR5IGJlZW4gbXVsdGlwbGllZCBieSB0aGUgc291cmNlIGFscGhhIHZhbHVlLlxuICogLSB7QGxpbmsgQkxFTkRfTVVMVElQTElDQVRJVkV9OiBNdWx0aXBseSB0aGUgY29sb3Igb2YgdGhlIHNvdXJjZSBmcmFnbWVudCBieSB0aGUgY29sb3Igb2YgdGhlXG4gKiBkZXN0aW5hdGlvbiBmcmFnbWVudCBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfQURESVRJVkVBTFBIQX06IFNhbWUgYXMge0BsaW5rIEJMRU5EX0FERElUSVZFfSBleGNlcHQgdGhlIHNvdXJjZSBSR0IgaXNcbiAqIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYS5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3JpZW50YXRpb24gU29ydGluZyBtb2RlLiBGb3JjZXMgQ1BVIHNpbXVsYXRpb24sIHNvIGJlIGNhcmVmdWwuXG4gKlxuICogLSB7QGxpbmsgUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU59OiBQYXJ0aWNsZXMgYXJlIGZhY2luZyBjYW1lcmEuXG4gKiAtIHtAbGluayBQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxEfTogVXNlciBkZWZpbmVzIHdvcmxkIHNwYWNlIG5vcm1hbCAocGFydGljbGVOb3JtYWwpIHRvIHNldFxuICogcGxhbmVzIG9yaWVudGF0aW9uLlxuICogLSB7QGxpbmsgUEFSVElDTEVPUklFTlRBVElPTl9FTUlUVEVSfTogU2ltaWxhciB0byBwcmV2aW91cywgYnV0IHRoZSBub3JtYWwgaXMgYWZmZWN0ZWQgYnlcbiAqIGVtaXR0ZXIgKGVudGl0eSkgdHJhbnNmb3JtYXRpb24uXG4gKlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gcGFydGljbGVOb3JtYWwgKE9ubHkgZm9yXG4gKiBQQVJUSUNMRU9SSUVOVEFUSU9OX1dPUkxEIGFuZCBQQVJUSUNMRU9SSUVOVEFUSU9OX0VNSVRURVIpIFRoZSBleGNlcHRpb24gb2YgZXh0ZW50cyBvZiBhIGxvY2FsXG4gKiBzcGFjZSBib3VuZGluZyBib3ggd2l0aGluIHdoaWNoIHBhcnRpY2xlcyBhcmUgbm90IHNwYXduZWQuIEFsaWduZWQgdG8gdGhlIGNlbnRlciBvZlxuICogRW1pdHRlckV4dGVudHMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLXNldC5qcycpLkN1cnZlU2V0fSBsb2NhbFZlbG9jaXR5R3JhcGggVmVsb2NpdHlcbiAqIHJlbGF0aXZlIHRvIGVtaXR0ZXIgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJykuQ3VydmVTZXR9IGxvY2FsVmVsb2NpdHlHcmFwaDIgSWYgbm90IG51bGwsXG4gKiBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW4gbG9jYWxWZWxvY2l0eUdyYXBoIGFuZCBsb2NhbFZlbG9jaXR5R3JhcGgyLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS1zZXQuanMnKS5DdXJ2ZVNldH0gdmVsb2NpdHlHcmFwaCBXb3JsZC1zcGFjZVxuICogdmVsb2NpdHkgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJykuQ3VydmVTZXR9IHZlbG9jaXR5R3JhcGgyIElmIG5vdCBudWxsLFxuICogcGFydGljbGVzIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHZlbG9jaXR5R3JhcGggYW5kIHZlbG9jaXR5R3JhcGgyLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS1zZXQuanMnKS5DdXJ2ZVNldH0gY29sb3JHcmFwaCBDb2xvciBvdmVyIGxpZmV0aW1lLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSByb3RhdGlvblNwZWVkR3JhcGggUm90YXRpb24gc3BlZWQgb3ZlclxuICogbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IHJvdGF0aW9uU3BlZWRHcmFwaDIgSWYgbm90IG51bGwsXG4gKiBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW4gcm90YXRpb25TcGVlZEdyYXBoIGFuZCByb3RhdGlvblNwZWVkR3JhcGgyLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSByYWRpYWxTcGVlZEdyYXBoIFJhZGlhbCBzcGVlZCBvdmVyXG4gKiBsaWZldGltZSwgdmVsb2NpdHkgdmVjdG9yIHBvaW50cyBmcm9tIGVtaXR0ZXIgb3JpZ2luIHRvIHBhcnRpY2xlIHBvcy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gcmFkaWFsU3BlZWRHcmFwaDIgSWYgbm90IG51bGwsIHBhcnRpY2xlc1xuICogcGljayByYW5kb20gdmFsdWVzIGJldHdlZW4gcmFkaWFsU3BlZWRHcmFwaCBhbmQgcmFkaWFsU3BlZWRHcmFwaDIuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IHNjYWxlR3JhcGggU2NhbGUgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gc2NhbGVHcmFwaDIgSWYgbm90IG51bGwsIHBhcnRpY2xlcyBwaWNrXG4gKiByYW5kb20gdmFsdWVzIGJldHdlZW4gc2NhbGVHcmFwaCBhbmQgc2NhbGVHcmFwaDIuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IGFscGhhR3JhcGggQWxwaGEgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gYWxwaGFHcmFwaDIgSWYgbm90IG51bGwsIHBhcnRpY2xlcyBwaWNrXG4gKiByYW5kb20gdmFsdWVzIGJldHdlZW4gYWxwaGFHcmFwaCBhbmQgYWxwaGFHcmFwaDIuXG4gKiBAcHJvcGVydHkge251bWJlcltdfSBsYXllcnMgQW4gYXJyYXkgb2YgbGF5ZXIgSURzICh7QGxpbmsgTGF5ZXIjaWR9KSB0byB3aGljaCB0aGlzIHBhcnRpY2xlXG4gKiBzeXN0ZW0gc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaC9wb3Avc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQgLSBzZXRcbiAqIGEgbmV3IG9uZSBpbnN0ZWFkLlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JlcXVlc3RlZERlcHRoID0gZmFsc2U7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZHJhd09yZGVyID0gMDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlBhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtXG4gICAgICogdGhhdCBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMub24oJ3NldF9jb2xvck1hcEFzc2V0JywgdGhpcy5vblNldENvbG9yTWFwQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbm9ybWFsTWFwQXNzZXQnLCB0aGlzLm9uU2V0Tm9ybWFsTWFwQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbWVzaEFzc2V0JywgdGhpcy5vblNldE1lc2hBc3NldCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9tZXNoJywgdGhpcy5vblNldE1lc2gsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfcmVuZGVyQXNzZXQnLCB0aGlzLm9uU2V0UmVuZGVyQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbG9vcCcsIHRoaXMub25TZXRMb29wLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2JsZW5kVHlwZScsIHRoaXMub25TZXRCbGVuZFR5cGUsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfZGVwdGhTb2Z0ZW5pbmcnLCB0aGlzLm9uU2V0RGVwdGhTb2Z0ZW5pbmcsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbGF5ZXJzJywgdGhpcy5vblNldExheWVycywgdGhpcyk7XG5cbiAgICAgICAgU0lNUExFX1BST1BFUlRJRVMuZm9yRWFjaCgocHJvcCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbihgc2V0XyR7cHJvcH1gLCB0aGlzLm9uU2V0U2ltcGxlUHJvcGVydHksIHRoaXMpO1xuICAgICAgICB9KTtcblxuICAgICAgICBDT01QTEVYX1BST1BFUlRJRVMuZm9yRWFjaCgocHJvcCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbihgc2V0XyR7cHJvcH1gLCB0aGlzLm9uU2V0Q29tcGxleFByb3BlcnR5LCB0aGlzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgR1JBUEhfUFJPUEVSVElFUy5mb3JFYWNoKChwcm9wKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uKGBzZXRfJHtwcm9wfWAsIHRoaXMub25TZXRHcmFwaFByb3BlcnR5LCB0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0IGRyYXdPcmRlcihkcmF3T3JkZXIpIHtcbiAgICAgICAgdGhpcy5fZHJhd09yZGVyID0gZHJhd09yZGVyO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuZHJhd09yZGVyID0gZHJhd09yZGVyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdPcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RyYXdPcmRlcjtcbiAgICB9XG5cbiAgICBhZGRNZXNoSW5zdGFuY2VUb0xheWVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLmVtaXR0ZXIpIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZU1lc2hJbnN0YW5jZUZyb21MYXllcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldExheWVycyhuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmVtaXR0ZXIpIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGRWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChvbGRWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld1ZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKG5ld1ZhbHVlW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhbdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgdGhpcy5hZGRNZXNoSW5zdGFuY2VUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhbdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZV0pO1xuICAgIH1cblxuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhbdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZV0pO1xuICAgIH1cblxuICAgIF9iaW5kQ29sb3JNYXBBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uQ29sb3JNYXBBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uQ29sb3JNYXBBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25Db2xvck1hcEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kQ29sb3JNYXBBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCd1bmxvYWQnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uQ29sb3JNYXBBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25Db2xvck1hcEFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25Db2xvck1hcEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLmNvbG9yTWFwID0gYXNzZXQucmVzb3VyY2U7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLmNvbG9yTWFwID0gbnVsbDtcbiAgICB9XG5cbiAgICBfb25Db2xvck1hcEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uQ29sb3JNYXBBc3NldFVubG9hZChhc3NldCk7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldENoYW5nZShhc3NldCkge1xuICAgIH1cblxuICAgIG9uU2V0Q29sb3JNYXBBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgaWYgKG9sZFZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQob2xkVmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kQ29sb3JNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLmNvbG9yTWFwQXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgICAgICBuZXdWYWx1ZSA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub25jZSgnYWRkOicgKyBuZXdWYWx1ZSwgKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRDb2xvck1hcEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY29sb3JNYXAgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2JpbmROb3JtYWxNYXBBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmROb3JtYWxNYXBBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uTm9ybWFsTWFwQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubm9ybWFsTWFwID0gYXNzZXQucmVzb3VyY2U7XG4gICAgfVxuXG4gICAgX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5ub3JtYWxNYXAgPSBudWxsO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0Q2hhbmdlKGFzc2V0KSB7XG4gICAgfVxuXG4gICAgb25TZXROb3JtYWxNYXBBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmROb3JtYWxNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLm5vcm1hbE1hcEFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmROb3JtYWxNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vbmNlKCdhZGQ6JyArIG5ld1ZhbHVlLCAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZE5vcm1hbE1hcEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsTWFwID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTWVzaEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25NZXNoQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTWVzaEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTWVzaEFzc2V0Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTWVzaEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25NZXNoQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTWVzaEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vbk1lc2hBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25NZXNoQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tZXNoID0gbnVsbDtcbiAgICB9XG5cbiAgICBfb25NZXNoQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25NZXNoQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vbk1lc2hBc3NldENoYW5nZShhc3NldCkge1xuICAgIH1cblxuICAgIG9uU2V0TWVzaEFzc2V0KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG9sZFZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZE1lc2hBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLm1lc2hBc3NldCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChuZXdWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTWVzaEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldE1lc2gobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIC8vIGhhY2sgdGhpcyBmb3Igbm93XG4gICAgICAgIC8vIGlmIHRoZSB2YWx1ZSBiZWluZyBzZXQgaXMgbnVsbCwgYW4gYXNzZXQgb3IgYW4gYXNzZXQgaWQsIHRoZW4gYXNzdW1lIHdlIGFyZVxuICAgICAgICAvLyBzZXR0aW5nIHRoZSBtZXNoIGFzc2V0LCB3aGljaCB3aWxsIGluIHR1cm4gdXBkYXRlIHRoZSBtZXNoXG4gICAgICAgIGlmICghbmV3VmFsdWUgfHwgbmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCB8fCB0eXBlb2YgbmV3VmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aGlzLm1lc2hBc3NldCA9IG5ld1ZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25NZXNoQ2hhbmdlZChuZXdWYWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25NZXNoQ2hhbmdlZChtZXNoKSB7XG4gICAgICAgIGlmIChtZXNoICYmICEobWVzaCBpbnN0YW5jZW9mIE1lc2gpKSB7XG4gICAgICAgICAgICAvLyBpZiBtZXNoIGlzIGEgcGMuTW9kZWwsIHVzZSB0aGUgZmlyc3QgbWVzaEluc3RhbmNlXG4gICAgICAgICAgICBpZiAobWVzaC5tZXNoSW5zdGFuY2VzWzBdKSB7XG4gICAgICAgICAgICAgICAgbWVzaCA9IG1lc2gubWVzaEluc3RhbmNlc1swXS5tZXNoO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNoID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGF0YS5tZXNoID0gbWVzaDtcblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWVzaCA9IG1lc2g7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldFJlbmRlckFzc2V0KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG9sZFZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZFJlbmRlckFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEucmVuZGVyQXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgICAgICBuZXdWYWx1ZSA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZFJlbmRlckFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQ2hhbmdlZChudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kUmVuZGVyQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vblJlbmRlckFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vblJlbmRlckFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uUmVuZGVyQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZFJlbmRlckFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCd1bmxvYWQnLCB0aGlzLl9vblJlbmRlckFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIGFzc2V0LnJlc291cmNlLm9mZignc2V0Om1lc2hlcycsIHRoaXMuX29uUmVuZGVyU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQoYXNzZXQucmVzb3VyY2UpO1xuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uUmVuZGVyQ2hhbmdlZChudWxsKTtcbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vblJlbmRlckFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25SZW5kZXJDaGFuZ2VkKHJlbmRlcikge1xuICAgICAgICBpZiAoIXJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5fb25NZXNoQ2hhbmdlZChudWxsKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlbmRlci5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgIHJlbmRlci5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uUmVuZGVyU2V0TWVzaGVzLCB0aGlzKTtcblxuICAgICAgICBpZiAocmVuZGVyLm1lc2hlcykge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJTZXRNZXNoZXMocmVuZGVyLm1lc2hlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJTZXRNZXNoZXMobWVzaGVzKSB7XG4gICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobWVzaGVzICYmIG1lc2hlc1swXSk7XG4gICAgfVxuXG4gICAgb25TZXRMb29wKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldFRpbWUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0QmxlbmRUeXBlKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5tYXRlcmlhbC5ibGVuZFR5cGUgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgICAgICB0aGlzLnJlYnVpbGQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZXF1ZXN0RGVwdGgoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZXF1ZXN0ZWREZXB0aCkgcmV0dXJuO1xuICAgICAgICBpZiAoIWRlcHRoTGF5ZXIpIGRlcHRoTGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0RFUFRIKTtcbiAgICAgICAgaWYgKGRlcHRoTGF5ZXIpIHtcbiAgICAgICAgICAgIGRlcHRoTGF5ZXIuaW5jcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdGVkRGVwdGggPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbGVhc2VEZXB0aCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9yZXF1ZXN0ZWREZXB0aCkgcmV0dXJuO1xuICAgICAgICBpZiAoZGVwdGhMYXllcikge1xuICAgICAgICAgICAgZGVwdGhMYXllci5kZWNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICB0aGlzLl9yZXF1ZXN0ZWREZXB0aCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXREZXB0aFNvZnRlbmluZyhuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKG9sZFZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB0aGlzLl9yZXF1ZXN0RGVwdGgoKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB0aGlzLl9yZWxlYXNlRGVwdGgoKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlYnVpbGQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0U2ltcGxlUHJvcGVydHkobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlcltuYW1lXSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0Q29tcGxleFByb3BlcnR5KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgICAgICB0aGlzLnJlYnVpbGQoKTtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0R3JhcGhQcm9wZXJ0eShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVidWlsZEdyYXBocygpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICAvLyBnZXQgZGF0YSBzdG9yZSBvbmNlXG4gICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgLy8gbG9hZCBhbnkgYXNzZXRzIHRoYXQgaGF2ZW4ndCBiZWVuIGxvYWRlZCB5ZXRcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IEFTU0VUX1BST1BFUlRJRVMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBhc3NldCA9IGRhdGFbQVNTRVRfUFJPUEVSVElFU1tpXV07XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIShhc3NldCBpbnN0YW5jZW9mIEFzc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpZCA9IHBhcnNlSW50KGFzc2V0LCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpZCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0ICYmICFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICBsZXQgbWVzaCA9IGRhdGEubWVzaDtcblxuICAgICAgICAgICAgLy8gbWVzaCBtaWdodCBiZSBhbiBhc3NldCBpZCBvZiBhbiBhc3NldFxuICAgICAgICAgICAgLy8gdGhhdCBoYXNuJ3QgYmVlbiBsb2FkZWQgeWV0XG4gICAgICAgICAgICBpZiAoIShtZXNoIGluc3RhbmNlb2YgTWVzaCkpXG4gICAgICAgICAgICAgICAgbWVzaCA9IG51bGw7XG5cbiAgICAgICAgICAgIHRoaXMuZW1pdHRlciA9IG5ldyBQYXJ0aWNsZUVtaXR0ZXIodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgbnVtUGFydGljbGVzOiBkYXRhLm51bVBhcnRpY2xlcyxcbiAgICAgICAgICAgICAgICBlbWl0dGVyRXh0ZW50czogZGF0YS5lbWl0dGVyRXh0ZW50cyxcbiAgICAgICAgICAgICAgICBlbWl0dGVyRXh0ZW50c0lubmVyOiBkYXRhLmVtaXR0ZXJFeHRlbnRzSW5uZXIsXG4gICAgICAgICAgICAgICAgZW1pdHRlclJhZGl1czogZGF0YS5lbWl0dGVyUmFkaXVzLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJSYWRpdXNJbm5lcjogZGF0YS5lbWl0dGVyUmFkaXVzSW5uZXIsXG4gICAgICAgICAgICAgICAgZW1pdHRlclNoYXBlOiBkYXRhLmVtaXR0ZXJTaGFwZSxcbiAgICAgICAgICAgICAgICBpbml0aWFsVmVsb2NpdHk6IGRhdGEuaW5pdGlhbFZlbG9jaXR5LFxuICAgICAgICAgICAgICAgIHdyYXA6IGRhdGEud3JhcCxcbiAgICAgICAgICAgICAgICBsb2NhbFNwYWNlOiBkYXRhLmxvY2FsU3BhY2UsXG4gICAgICAgICAgICAgICAgc2NyZWVuU3BhY2U6IGRhdGEuc2NyZWVuU3BhY2UsXG4gICAgICAgICAgICAgICAgd3JhcEJvdW5kczogZGF0YS53cmFwQm91bmRzLFxuICAgICAgICAgICAgICAgIGxpZmV0aW1lOiBkYXRhLmxpZmV0aW1lLFxuICAgICAgICAgICAgICAgIHJhdGU6IGRhdGEucmF0ZSxcbiAgICAgICAgICAgICAgICByYXRlMjogZGF0YS5yYXRlMixcblxuICAgICAgICAgICAgICAgIG9yaWVudGF0aW9uOiBkYXRhLm9yaWVudGF0aW9uLFxuICAgICAgICAgICAgICAgIHBhcnRpY2xlTm9ybWFsOiBkYXRhLnBhcnRpY2xlTm9ybWFsLFxuXG4gICAgICAgICAgICAgICAgYW5pbVRpbGVzWDogZGF0YS5hbmltVGlsZXNYLFxuICAgICAgICAgICAgICAgIGFuaW1UaWxlc1k6IGRhdGEuYW5pbVRpbGVzWSxcbiAgICAgICAgICAgICAgICBhbmltU3RhcnRGcmFtZTogZGF0YS5hbmltU3RhcnRGcmFtZSxcbiAgICAgICAgICAgICAgICBhbmltTnVtRnJhbWVzOiBkYXRhLmFuaW1OdW1GcmFtZXMsXG4gICAgICAgICAgICAgICAgYW5pbU51bUFuaW1hdGlvbnM6IGRhdGEuYW5pbU51bUFuaW1hdGlvbnMsXG4gICAgICAgICAgICAgICAgYW5pbUluZGV4OiBkYXRhLmFuaW1JbmRleCxcbiAgICAgICAgICAgICAgICByYW5kb21pemVBbmltSW5kZXg6IGRhdGEucmFuZG9taXplQW5pbUluZGV4LFxuICAgICAgICAgICAgICAgIGFuaW1TcGVlZDogZGF0YS5hbmltU3BlZWQsXG4gICAgICAgICAgICAgICAgYW5pbUxvb3A6IGRhdGEuYW5pbUxvb3AsXG5cbiAgICAgICAgICAgICAgICBzdGFydEFuZ2xlOiBkYXRhLnN0YXJ0QW5nbGUsXG4gICAgICAgICAgICAgICAgc3RhcnRBbmdsZTI6IGRhdGEuc3RhcnRBbmdsZTIsXG5cbiAgICAgICAgICAgICAgICBzY2FsZUdyYXBoOiBkYXRhLnNjYWxlR3JhcGgsXG4gICAgICAgICAgICAgICAgc2NhbGVHcmFwaDI6IGRhdGEuc2NhbGVHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICBjb2xvckdyYXBoOiBkYXRhLmNvbG9yR3JhcGgsXG4gICAgICAgICAgICAgICAgY29sb3JHcmFwaDI6IGRhdGEuY29sb3JHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICBhbHBoYUdyYXBoOiBkYXRhLmFscGhhR3JhcGgsXG4gICAgICAgICAgICAgICAgYWxwaGFHcmFwaDI6IGRhdGEuYWxwaGFHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICBsb2NhbFZlbG9jaXR5R3JhcGg6IGRhdGEubG9jYWxWZWxvY2l0eUdyYXBoLFxuICAgICAgICAgICAgICAgIGxvY2FsVmVsb2NpdHlHcmFwaDI6IGRhdGEubG9jYWxWZWxvY2l0eUdyYXBoMixcblxuICAgICAgICAgICAgICAgIHZlbG9jaXR5R3JhcGg6IGRhdGEudmVsb2NpdHlHcmFwaCxcbiAgICAgICAgICAgICAgICB2ZWxvY2l0eUdyYXBoMjogZGF0YS52ZWxvY2l0eUdyYXBoMixcblxuICAgICAgICAgICAgICAgIHJvdGF0aW9uU3BlZWRHcmFwaDogZGF0YS5yb3RhdGlvblNwZWVkR3JhcGgsXG4gICAgICAgICAgICAgICAgcm90YXRpb25TcGVlZEdyYXBoMjogZGF0YS5yb3RhdGlvblNwZWVkR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgcmFkaWFsU3BlZWRHcmFwaDogZGF0YS5yYWRpYWxTcGVlZEdyYXBoLFxuICAgICAgICAgICAgICAgIHJhZGlhbFNwZWVkR3JhcGgyOiBkYXRhLnJhZGlhbFNwZWVkR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgY29sb3JNYXA6IGRhdGEuY29sb3JNYXAsXG4gICAgICAgICAgICAgICAgbm9ybWFsTWFwOiBkYXRhLm5vcm1hbE1hcCxcbiAgICAgICAgICAgICAgICBsb29wOiBkYXRhLmxvb3AsXG4gICAgICAgICAgICAgICAgcHJlV2FybTogZGF0YS5wcmVXYXJtLFxuICAgICAgICAgICAgICAgIHNvcnQ6IGRhdGEuc29ydCxcbiAgICAgICAgICAgICAgICBzdHJldGNoOiBkYXRhLnN0cmV0Y2gsXG4gICAgICAgICAgICAgICAgYWxpZ25Ub01vdGlvbjogZGF0YS5hbGlnblRvTW90aW9uLFxuICAgICAgICAgICAgICAgIGxpZ2h0aW5nOiBkYXRhLmxpZ2h0aW5nLFxuICAgICAgICAgICAgICAgIGhhbGZMYW1iZXJ0OiBkYXRhLmhhbGZMYW1iZXJ0LFxuICAgICAgICAgICAgICAgIGludGVuc2l0eTogZGF0YS5pbnRlbnNpdHksXG4gICAgICAgICAgICAgICAgZGVwdGhTb2Z0ZW5pbmc6IGRhdGEuZGVwdGhTb2Z0ZW5pbmcsXG4gICAgICAgICAgICAgICAgc2NlbmU6IHRoaXMuc3lzdGVtLmFwcC5zY2VuZSxcbiAgICAgICAgICAgICAgICBtZXNoOiBtZXNoLFxuICAgICAgICAgICAgICAgIGRlcHRoV3JpdGU6IGRhdGEuZGVwdGhXcml0ZSxcbiAgICAgICAgICAgICAgICBub0ZvZzogZGF0YS5ub0ZvZyxcbiAgICAgICAgICAgICAgICBub2RlOiB0aGlzLmVudGl0eSxcbiAgICAgICAgICAgICAgICBibGVuZFR5cGU6IGRhdGEuYmxlbmRUeXBlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS5ub2RlID0gdGhpcy5lbnRpdHk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuZHJhd09yZGVyID0gdGhpcy5kcmF3T3JkZXI7XG5cbiAgICAgICAgICAgIGlmICghZGF0YS5hdXRvUGxheSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIuY29sb3JNYXApIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkICYmIGRhdGEuZGVwdGhTb2Z0ZW5pbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlcXVlc3REZXB0aCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTWVzaEluc3RhbmNlRnJvbUxheWVycygpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YS5kZXB0aFNvZnRlbmluZykgdGhpcy5fcmVsZWFzZURlcHRoKCk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGNhbWVyYSBhcyBpdCBpc24ndCB1cGRhdGVkIHdoaWxlIGRpc2FibGVkIGFuZCB3ZSBkb24ndCB3YW50IHRvIGhvbGRcbiAgICAgICAgICAgIC8vIG9udG8gb2xkIHJlZmVyZW5jZVxuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmNhbWVyYSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkJlZm9yZVJlbW92ZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGFsbCBhc3NldCBwcm9wZXJ0aWVzIHRvIHJlbW92ZSBhbnkgZXZlbnQgbGlzdGVuZXJzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgQVNTRVRfUFJPUEVSVElFUy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcHJvcCA9IEFTU0VUX1BST1BFUlRJRVNbaV07XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGFbcHJvcF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzW3Byb3BdID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMub2ZmKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzZXRzIHBhcnRpY2xlIHN0YXRlLCBkb2Vzbid0IGFmZmVjdCBwbGF5aW5nLlxuICAgICAqL1xuICAgIHJlc2V0KCkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpc2FibGVzIHRoZSBlbWlzc2lvbiBvZiBuZXcgcGFydGljbGVzLCBsZXRzIGV4aXN0aW5nIHRvIGZpbmlzaCB0aGVpciBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5sb29wID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuYWRkVGltZSgwLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWV6ZXMgdGhlIHNpbXVsYXRpb24uXG4gICAgICovXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5wYXVzZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVuZnJlZXplcyB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKi9cbiAgICB1bnBhdXNlKCkge1xuICAgICAgICB0aGlzLmRhdGEucGF1c2VkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcy91bmZyZWV6ZXMgdGhlIHNpbXVsYXRpb24uXG4gICAgICovXG4gICAgcGxheSgpIHtcbiAgICAgICAgdGhpcy5kYXRhLnBhdXNlZCA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlLnZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmxvb3AgPSB0aGlzLmRhdGEubG9vcDtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldFRpbWUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBzaW11bGF0aW9uIGlzIGluIHByb2dyZXNzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHBhcnRpY2xlIHN5c3RlbSBpcyBjdXJyZW50bHkgcGxheWluZyBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGlzUGxheWluZygpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5wYXVzZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyICYmIHRoaXMuZW1pdHRlci5sb29wKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHBvc3NpYmxlIGJ1ZyBoZXJlIHdoYXQgaGFwcGVucyBpZiB0aGUgbm9uIGxvb3BpbmcgZW1pdHRlclxuICAgICAgICAvLyB3YXMgcGF1c2VkIGluIHRoZSBtZWFudGltZT9cbiAgICAgICAgcmV0dXJuIERhdGUubm93KCkgPD0gdGhpcy5lbWl0dGVyLmVuZFRpbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVidWlsZHMgYWxsIGRhdGEgdXNlZCBieSB0aGlzIHBhcnRpY2xlIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcmVidWlsZCgpIHtcbiAgICAgICAgY29uc3QgZW5hYmxlZCA9IHRoaXMuZW5hYmxlZDtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZWJ1aWxkKCk7IC8vIHdvcnN0IGNhc2U6IHJlcXVpcmVkIHRvIHJlYnVpbGQgYnVmZmVycy9zaGFkZXJzXG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlLm5vZGUgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUGFydGljbGVTeXN0ZW1Db21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJTSU1QTEVfUFJPUEVSVElFUyIsIkNPTVBMRVhfUFJPUEVSVElFUyIsIkdSQVBIX1BST1BFUlRJRVMiLCJBU1NFVF9QUk9QRVJUSUVTIiwiZGVwdGhMYXllciIsIlBhcnRpY2xlU3lzdGVtQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfcmVxdWVzdGVkRGVwdGgiLCJfZHJhd09yZGVyIiwib24iLCJvblNldENvbG9yTWFwQXNzZXQiLCJvblNldE5vcm1hbE1hcEFzc2V0Iiwib25TZXRNZXNoQXNzZXQiLCJvblNldE1lc2giLCJvblNldFJlbmRlckFzc2V0Iiwib25TZXRMb29wIiwib25TZXRCbGVuZFR5cGUiLCJvblNldERlcHRoU29mdGVuaW5nIiwib25TZXRMYXllcnMiLCJmb3JFYWNoIiwicHJvcCIsIm9uU2V0U2ltcGxlUHJvcGVydHkiLCJvblNldENvbXBsZXhQcm9wZXJ0eSIsIm9uU2V0R3JhcGhQcm9wZXJ0eSIsImRyYXdPcmRlciIsImVtaXR0ZXIiLCJhZGRNZXNoSW5zdGFuY2VUb0xheWVycyIsImkiLCJsYXllcnMiLCJsZW5ndGgiLCJsYXllciIsImFwcCIsInNjZW5lIiwiZ2V0TGF5ZXJCeUlkIiwiYWRkTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZSIsIl9sYXllciIsInJlbW92ZU1lc2hJbnN0YW5jZUZyb21MYXllcnMiLCJyZW1vdmVNZXNoSW5zdGFuY2VzIiwibmFtZSIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJlbmFibGVkIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvZmYiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaW5kZXhPZiIsImlkIiwiX2JpbmRDb2xvck1hcEFzc2V0IiwiYXNzZXQiLCJfb25Db2xvck1hcEFzc2V0TG9hZCIsIl9vbkNvbG9yTWFwQXNzZXRVbmxvYWQiLCJfb25Db2xvck1hcEFzc2V0UmVtb3ZlIiwiX29uQ29sb3JNYXBBc3NldENoYW5nZSIsInJlc291cmNlIiwiYXNzZXRzIiwibG9hZCIsIl91bmJpbmRDb2xvck1hcEFzc2V0IiwiY29sb3JNYXAiLCJnZXQiLCJBc3NldCIsImRhdGEiLCJjb2xvck1hcEFzc2V0Iiwib25jZSIsIl9iaW5kTm9ybWFsTWFwQXNzZXQiLCJfb25Ob3JtYWxNYXBBc3NldExvYWQiLCJfb25Ob3JtYWxNYXBBc3NldFVubG9hZCIsIl9vbk5vcm1hbE1hcEFzc2V0UmVtb3ZlIiwiX29uTm9ybWFsTWFwQXNzZXRDaGFuZ2UiLCJfdW5iaW5kTm9ybWFsTWFwQXNzZXQiLCJub3JtYWxNYXAiLCJub3JtYWxNYXBBc3NldCIsIl9iaW5kTWVzaEFzc2V0IiwiX29uTWVzaEFzc2V0TG9hZCIsIl9vbk1lc2hBc3NldFVubG9hZCIsIl9vbk1lc2hBc3NldFJlbW92ZSIsIl9vbk1lc2hBc3NldENoYW5nZSIsIl91bmJpbmRNZXNoQXNzZXQiLCJfb25NZXNoQ2hhbmdlZCIsIm1lc2giLCJtZXNoQXNzZXQiLCJNZXNoIiwibWVzaEluc3RhbmNlcyIsInJlc2V0TWF0ZXJpYWwiLCJyZWJ1aWxkIiwiX3VuYmluZFJlbmRlckFzc2V0IiwicmVuZGVyQXNzZXQiLCJfYmluZFJlbmRlckFzc2V0IiwiX29uUmVuZGVyQ2hhbmdlZCIsIl9vblJlbmRlckFzc2V0TG9hZCIsIl9vblJlbmRlckFzc2V0VW5sb2FkIiwiX29uUmVuZGVyQXNzZXRSZW1vdmUiLCJfb25SZW5kZXJTZXRNZXNoZXMiLCJyZW5kZXIiLCJtZXNoZXMiLCJyZXNldFRpbWUiLCJtYXRlcmlhbCIsImJsZW5kVHlwZSIsIl9yZXF1ZXN0RGVwdGgiLCJMQVlFUklEX0RFUFRIIiwiaW5jcmVtZW50Q291bnRlciIsIl9yZWxlYXNlRGVwdGgiLCJkZWNyZW1lbnRDb3VudGVyIiwicmVzZXQiLCJyZWJ1aWxkR3JhcGhzIiwib25FbmFibGUiLCJsZW4iLCJwYXJzZUludCIsIlBhcnRpY2xlRW1pdHRlciIsImdyYXBoaWNzRGV2aWNlIiwibnVtUGFydGljbGVzIiwiZW1pdHRlckV4dGVudHMiLCJlbWl0dGVyRXh0ZW50c0lubmVyIiwiZW1pdHRlclJhZGl1cyIsImVtaXR0ZXJSYWRpdXNJbm5lciIsImVtaXR0ZXJTaGFwZSIsImluaXRpYWxWZWxvY2l0eSIsIndyYXAiLCJsb2NhbFNwYWNlIiwic2NyZWVuU3BhY2UiLCJ3cmFwQm91bmRzIiwibGlmZXRpbWUiLCJyYXRlIiwicmF0ZTIiLCJvcmllbnRhdGlvbiIsInBhcnRpY2xlTm9ybWFsIiwiYW5pbVRpbGVzWCIsImFuaW1UaWxlc1kiLCJhbmltU3RhcnRGcmFtZSIsImFuaW1OdW1GcmFtZXMiLCJhbmltTnVtQW5pbWF0aW9ucyIsImFuaW1JbmRleCIsInJhbmRvbWl6ZUFuaW1JbmRleCIsImFuaW1TcGVlZCIsImFuaW1Mb29wIiwic3RhcnRBbmdsZSIsInN0YXJ0QW5nbGUyIiwic2NhbGVHcmFwaCIsInNjYWxlR3JhcGgyIiwiY29sb3JHcmFwaCIsImNvbG9yR3JhcGgyIiwiYWxwaGFHcmFwaCIsImFscGhhR3JhcGgyIiwibG9jYWxWZWxvY2l0eUdyYXBoIiwibG9jYWxWZWxvY2l0eUdyYXBoMiIsInZlbG9jaXR5R3JhcGgiLCJ2ZWxvY2l0eUdyYXBoMiIsInJvdGF0aW9uU3BlZWRHcmFwaCIsInJvdGF0aW9uU3BlZWRHcmFwaDIiLCJyYWRpYWxTcGVlZEdyYXBoIiwicmFkaWFsU3BlZWRHcmFwaDIiLCJsb29wIiwicHJlV2FybSIsInNvcnQiLCJzdHJldGNoIiwiYWxpZ25Ub01vdGlvbiIsImxpZ2h0aW5nIiwiaGFsZkxhbWJlcnQiLCJpbnRlbnNpdHkiLCJkZXB0aFNvZnRlbmluZyIsImRlcHRoV3JpdGUiLCJub0ZvZyIsIm5vZGUiLCJhdXRvUGxheSIsInBhdXNlIiwidmlzaWJsZSIsIm9uRGlzYWJsZSIsImNhbWVyYSIsIm9uQmVmb3JlUmVtb3ZlIiwiZGVzdHJveSIsInN0b3AiLCJhZGRUaW1lIiwicGF1c2VkIiwidW5wYXVzZSIsInBsYXkiLCJpc1BsYXlpbmciLCJEYXRlIiwibm93IiwiZW5kVGltZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFRQTtBQUNBLE1BQU1BLGlCQUFpQixHQUFHLENBQ3RCLGdCQUFnQixFQUNoQixlQUFlLEVBQ2YscUJBQXFCLEVBQ3JCLG9CQUFvQixFQUNwQixNQUFNLEVBQ04saUJBQWlCLEVBQ2pCLFdBQVcsRUFDWCxXQUFXLEVBQ1gsZ0JBQWdCLENBQ25CLENBQUE7O0FBRUQ7QUFDQSxNQUFNQyxrQkFBa0IsR0FBRyxDQUN2QixjQUFjLEVBQ2QsVUFBVSxFQUNWLE1BQU0sRUFDTixPQUFPLEVBQ1AsWUFBWSxFQUNaLGFBQWEsRUFDYixVQUFVLEVBQ1YsYUFBYSxFQUNiLFdBQVcsRUFDWCxNQUFNLEVBQ04sWUFBWSxFQUNaLFlBQVksRUFDWixPQUFPLEVBQ1AsTUFBTSxFQUNOLFNBQVMsRUFDVCxlQUFlLEVBQ2YsU0FBUyxFQUNULGNBQWMsRUFDZCxZQUFZLEVBQ1osWUFBWSxFQUNaLGdCQUFnQixFQUNoQixlQUFlLEVBQ2YsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxvQkFBb0IsRUFDcEIsVUFBVSxFQUNWLFVBQVUsRUFDVixZQUFZLEVBQ1osYUFBYSxFQUNiLGFBQWEsQ0FDaEIsQ0FBQTtBQUVELE1BQU1DLGdCQUFnQixHQUFHLENBQ3JCLFlBQVksRUFDWixhQUFhLEVB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
