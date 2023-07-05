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
  /**
   * Create a new ParticleSystemComponent.
   *
   * @param {import('./system.js').ParticleSystemComponentSystem} system - The ComponentSystem
   * that created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity this Component is attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    /** @private */
    this._requestedDepth = false;
    /** @private */
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

    // WebGPU does not support particle systems, ignore them
    if (this.system.app.graphicsDevice.disableParticleSystem) {
      return;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcGFydGljbGUtc3lzdGVtL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX0RFUFRIIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8vIHByb3BlcnRpZXMgdGhhdCBkbyBub3QgbmVlZCByZWJ1aWxkaW5nIHRoZSBwYXJ0aWNsZSBzeXN0ZW1cbmNvbnN0IFNJTVBMRV9QUk9QRVJUSUVTID0gW1xuICAgICdlbWl0dGVyRXh0ZW50cycsXG4gICAgJ2VtaXR0ZXJSYWRpdXMnLFxuICAgICdlbWl0dGVyRXh0ZW50c0lubmVyJyxcbiAgICAnZW1pdHRlclJhZGl1c0lubmVyJyxcbiAgICAnbG9vcCcsXG4gICAgJ2luaXRpYWxWZWxvY2l0eScsXG4gICAgJ2FuaW1TcGVlZCcsXG4gICAgJ25vcm1hbE1hcCcsXG4gICAgJ3BhcnRpY2xlTm9ybWFsJ1xuXTtcblxuLy8gcHJvcGVydGllcyB0aGF0IG5lZWQgcmVidWlsZGluZyB0aGUgcGFydGljbGUgc3lzdGVtXG5jb25zdCBDT01QTEVYX1BST1BFUlRJRVMgPSBbXG4gICAgJ251bVBhcnRpY2xlcycsXG4gICAgJ2xpZmV0aW1lJyxcbiAgICAncmF0ZScsXG4gICAgJ3JhdGUyJyxcbiAgICAnc3RhcnRBbmdsZScsXG4gICAgJ3N0YXJ0QW5nbGUyJyxcbiAgICAnbGlnaHRpbmcnLFxuICAgICdoYWxmTGFtYmVydCcsXG4gICAgJ2ludGVuc2l0eScsXG4gICAgJ3dyYXAnLFxuICAgICd3cmFwQm91bmRzJyxcbiAgICAnZGVwdGhXcml0ZScsXG4gICAgJ25vRm9nJyxcbiAgICAnc29ydCcsXG4gICAgJ3N0cmV0Y2gnLFxuICAgICdhbGlnblRvTW90aW9uJyxcbiAgICAncHJlV2FybScsXG4gICAgJ2VtaXR0ZXJTaGFwZScsXG4gICAgJ2FuaW1UaWxlc1gnLFxuICAgICdhbmltVGlsZXNZJyxcbiAgICAnYW5pbVN0YXJ0RnJhbWUnLFxuICAgICdhbmltTnVtRnJhbWVzJyxcbiAgICAnYW5pbU51bUFuaW1hdGlvbnMnLFxuICAgICdhbmltSW5kZXgnLFxuICAgICdyYW5kb21pemVBbmltSW5kZXgnLFxuICAgICdhbmltTG9vcCcsXG4gICAgJ2NvbG9yTWFwJyxcbiAgICAnbG9jYWxTcGFjZScsXG4gICAgJ3NjcmVlblNwYWNlJyxcbiAgICAnb3JpZW50YXRpb24nXG5dO1xuXG5jb25zdCBHUkFQSF9QUk9QRVJUSUVTID0gW1xuICAgICdzY2FsZUdyYXBoJyxcbiAgICAnc2NhbGVHcmFwaDInLFxuXG4gICAgJ2NvbG9yR3JhcGgnLFxuICAgICdjb2xvckdyYXBoMicsXG5cbiAgICAnYWxwaGFHcmFwaCcsXG4gICAgJ2FscGhhR3JhcGgyJyxcblxuICAgICd2ZWxvY2l0eUdyYXBoJyxcbiAgICAndmVsb2NpdHlHcmFwaDInLFxuXG4gICAgJ2xvY2FsVmVsb2NpdHlHcmFwaCcsXG4gICAgJ2xvY2FsVmVsb2NpdHlHcmFwaDInLFxuXG4gICAgJ3JvdGF0aW9uU3BlZWRHcmFwaCcsXG4gICAgJ3JvdGF0aW9uU3BlZWRHcmFwaDInLFxuXG4gICAgJ3JhZGlhbFNwZWVkR3JhcGgnLFxuICAgICdyYWRpYWxTcGVlZEdyYXBoMidcbl07XG5cbmNvbnN0IEFTU0VUX1BST1BFUlRJRVMgPSBbXG4gICAgJ2NvbG9yTWFwQXNzZXQnLFxuICAgICdub3JtYWxNYXBBc3NldCcsXG4gICAgJ21lc2hBc3NldCcsXG4gICAgJ3JlbmRlckFzc2V0J1xuXTtcblxubGV0IGRlcHRoTGF5ZXI7XG5cbi8qKlxuICogVXNlZCB0byBzaW11bGF0ZSBwYXJ0aWNsZXMgYW5kIHByb2R1Y2UgcmVuZGVyYWJsZSBwYXJ0aWNsZSBtZXNoIG9uIGVpdGhlciBDUFUgb3IgR1BVLiBHUFVcbiAqIHNpbXVsYXRpb24gaXMgZ2VuZXJhbGx5IG11Y2ggZmFzdGVyIHRoYW4gaXRzIENQVSBjb3VudGVycGFydCwgYmVjYXVzZSBpdCBhdm9pZHMgc2xvdyBDUFUtR1BVXG4gKiBzeW5jaHJvbml6YXRpb24gYW5kIHRha2VzIGFkdmFudGFnZSBvZiBtYW55IEdQVSBjb3Jlcy4gSG93ZXZlciwgaXQgcmVxdWlyZXMgY2xpZW50IHRvIHN1cHBvcnRcbiAqIHJlYXNvbmFibGUgdW5pZm9ybSBjb3VudCwgcmVhZGluZyBmcm9tIG11bHRpcGxlIHRleHR1cmVzIGluIHZlcnRleCBzaGFkZXIgYW5kIE9FU190ZXh0dXJlX2Zsb2F0XG4gKiBleHRlbnNpb24sIGluY2x1ZGluZyByZW5kZXJpbmcgaW50byBmbG9hdCB0ZXh0dXJlcy4gTW9zdCBtb2JpbGUgZGV2aWNlcyBmYWlsIHRvIHNhdGlzZnkgdGhlc2VcbiAqIHJlcXVpcmVtZW50cywgc28gaXQncyBub3QgcmVjb21tZW5kZWQgdG8gc2ltdWxhdGUgdGhvdXNhbmRzIG9mIHBhcnRpY2xlcyBvbiB0aGVtLiBHUFUgdmVyc2lvblxuICogYWxzbyBjYW4ndCBzb3J0IHBhcnRpY2xlcywgc28gZW5hYmxpbmcgc29ydGluZyBmb3JjZXMgQ1BVIG1vZGUgdG9vLiBQYXJ0aWNsZSByb3RhdGlvbiBpc1xuICogc3BlY2lmaWVkIGJ5IGEgc2luZ2xlIGFuZ2xlIHBhcmFtZXRlcjogZGVmYXVsdCBiaWxsYm9hcmQgcGFydGljbGVzIHJvdGF0ZSBhcm91bmQgY2FtZXJhIGZhY2luZ1xuICogYXhpcywgd2hpbGUgbWVzaCBwYXJ0aWNsZXMgcm90YXRlIGFyb3VuZCAyIGRpZmZlcmVudCB2aWV3LWluZGVwZW5kZW50IGF4ZXMuIE1vc3Qgb2YgdGhlXG4gKiBzaW11bGF0aW9uIHBhcmFtZXRlcnMgYXJlIHNwZWNpZmllZCB3aXRoIHtAbGluayBDdXJ2ZX0gb3Ige0BsaW5rIEN1cnZlU2V0fS4gQ3VydmVzIGFyZVxuICogaW50ZXJwb2xhdGVkIGJhc2VkIG9uIGVhY2ggcGFydGljbGUncyBsaWZldGltZSwgdGhlcmVmb3JlIHBhcmFtZXRlcnMgYXJlIGFibGUgdG8gY2hhbmdlIG92ZXJcbiAqIHRpbWUuIE1vc3Qgb2YgdGhlIGN1cnZlIHBhcmFtZXRlcnMgY2FuIGFsc28gYmUgc3BlY2lmaWVkIGJ5IDIgbWluaW11bS9tYXhpbXVtIGN1cnZlcywgdGhpcyB3YXlcbiAqIGVhY2ggcGFydGljbGUgd2lsbCBwaWNrIGEgcmFuZG9tIHZhbHVlIGluLWJldHdlZW4uXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvUGxheSBDb250cm9scyB3aGV0aGVyIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gcGxheXMgYXV0b21hdGljYWxseSBvblxuICogY3JlYXRpb24uIElmIHNldCB0byBmYWxzZSwgaXQgaXMgbmVjZXNzYXJ5IHRvIGNhbGwge0BsaW5rIFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50I3BsYXl9IGZvciB0aGVcbiAqIHBhcnRpY2xlIHN5c3RlbSB0byBwbGF5LiBEZWZhdWx0cyB0byB0cnVlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsb29wIEVuYWJsZXMgb3IgZGlzYWJsZXMgcmVzcGF3bmluZyBvZiBwYXJ0aWNsZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHByZVdhcm0gSWYgZW5hYmxlZCwgdGhlIHBhcnRpY2xlIHN5c3RlbSB3aWxsIGJlIGluaXRpYWxpemVkIGFzIHRob3VnaCBpdCBoYWRcbiAqIGFscmVhZHkgY29tcGxldGVkIGEgZnVsbCBjeWNsZS4gVGhpcyBvbmx5IHdvcmtzIHdpdGggbG9vcGluZyBwYXJ0aWNsZSBzeXN0ZW1zLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsaWdodGluZyBJZiBlbmFibGVkLCBwYXJ0aWNsZXMgd2lsbCBiZSBsaXQgYnkgYW1iaWVudCBhbmQgZGlyZWN0aW9uYWxcbiAqIGxpZ2h0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaGFsZkxhbWJlcnQgRW5hYmxpbmcgSGFsZiBMYW1iZXJ0IGxpZ2h0aW5nIGF2b2lkcyBwYXJ0aWNsZXMgbG9va2luZyB0b28gZmxhdFxuICogaW4gc2hhZG93ZWQgYXJlYXMuIEl0IGlzIGEgY29tcGxldGVseSBub24tcGh5c2ljYWwgbGlnaHRpbmcgbW9kZWwgYnV0IGNhbiBnaXZlIG1vcmUgcGxlYXNpbmdcbiAqIHZpc3VhbCByZXN1bHRzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhbGlnblRvTW90aW9uIE9yaWVudCBwYXJ0aWNsZXMgaW4gdGhlaXIgZGlyZWN0aW9uIG9mIG1vdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZGVwdGhXcml0ZSBJZiBlbmFibGVkLCB0aGUgcGFydGljbGVzIHdpbGwgd3JpdGUgdG8gdGhlIGRlcHRoIGJ1ZmZlci4gSWZcbiAqIGRpc2FibGVkLCB0aGUgZGVwdGggYnVmZmVyIGlzIGxlZnQgdW5jaGFuZ2VkIGFuZCBwYXJ0aWNsZXMgd2lsbCBiZSBndWFyYW50ZWVkIHRvIG92ZXJ3cml0ZSBvbmVcbiAqIGFub3RoZXIgaW4gdGhlIG9yZGVyIGluIHdoaWNoIHRoZXkgYXJlIHJlbmRlcmVkLlxuICogQHByb3BlcnR5IHtib29sZWFufSBub0ZvZyBEaXNhYmxlIGZvZ2dpbmcuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGxvY2FsU3BhY2UgQmluZHMgcGFydGljbGVzIHRvIGVtaXR0ZXIgdHJhbnNmb3JtYXRpb24gcmF0aGVyIHRoZW4gd29ybGRcbiAqIHNwYWNlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzY3JlZW5TcGFjZSBSZW5kZXJzIHBhcnRpY2xlcyBpbiAyRCBzY3JlZW4gc3BhY2UuIFRoaXMgbmVlZHMgdG8gYmUgc2V0IHdoZW5cbiAqIHBhcnRpY2xlIHN5c3RlbSBpcyBwYXJ0IG9mIGhpZXJhcmNoeSB3aXRoIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFzIGl0cyBhbmNlc3RvciwgYW5kIGFsbG93c1xuICogcGFydGljbGUgc3lzdGVtIHRvIGludGVncmF0ZSB3aXRoIHRoZSByZW5kZXJpbmcgb2Yge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy4gTm90ZSB0aGF0IGFuXG4gKiBlbnRpdHkgd2l0aCBQYXJ0aWNsZVN5c3RlbSBjb21wb25lbnQgY2Fubm90IGJlIHBhcmVudGVkIGRpcmVjdGx5IHRvIHtAbGluayBTY3JlZW5Db21wb25lbnR9LCBidXRcbiAqIGhhcyB0byBiZSBhIGNoaWxkIG9mIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9LCBmb3IgZXhhbXBsZSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG51bVBhcnRpY2xlcyBNYXhpbXVtIG51bWJlciBvZiBzaW11bGF0ZWQgcGFydGljbGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhdGUgTWluaW1hbCBpbnRlcnZhbCBpbiBzZWNvbmRzIGJldHdlZW4gcGFydGljbGUgYmlydGhzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhdGUyIE1heGltYWwgaW50ZXJ2YWwgaW4gc2Vjb25kcyBiZXR3ZWVuIHBhcnRpY2xlIGJpcnRocy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdGFydEFuZ2xlIE1pbmltYWwgaW5pdGlhbCBFdWxlciBhbmdsZSBvZiBhIHBhcnRpY2xlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN0YXJ0QW5nbGUyIE1heGltYWwgaW5pdGlhbCBFdWxlciBhbmdsZSBvZiBhIHBhcnRpY2xlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGxpZmV0aW1lIFRoZSBsZW5ndGggb2YgdGltZSBpbiBzZWNvbmRzIGJldHdlZW4gYSBwYXJ0aWNsZSdzIGJpcnRoIGFuZCBpdHNcbiAqIGRlYXRoLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHN0cmV0Y2ggQSB2YWx1ZSBpbiB3b3JsZCB1bml0cyB0aGF0IGNvbnRyb2xzIHRoZSBhbW91bnQgYnkgd2hpY2ggcGFydGljbGVzXG4gKiBhcmUgc3RyZXRjaGVkIGJhc2VkIG9uIHRoZWlyIHZlbG9jaXR5LiBQYXJ0aWNsZXMgYXJlIHN0cmV0Y2hlZCBmcm9tIHRoZWlyIGNlbnRlciB0b3dhcmRzIHRoZWlyXG4gKiBwcmV2aW91cyBwb3NpdGlvbi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnRlbnNpdHkgQ29sb3IgbXVsdGlwbGllci5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYW5pbUxvb3AgQ29udHJvbHMgd2hldGhlciB0aGUgc3ByaXRlIHNoZWV0IGFuaW1hdGlvbiBwbGF5cyBvbmNlIG9yIGxvb3BzXG4gKiBjb250aW51b3VzbHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbVRpbGVzWCBOdW1iZXIgb2YgaG9yaXpvbnRhbCB0aWxlcyBpbiB0aGUgc3ByaXRlIHNoZWV0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1UaWxlc1kgTnVtYmVyIG9mIHZlcnRpY2FsIHRpbGVzIGluIHRoZSBzcHJpdGUgc2hlZXQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbU51bUFuaW1hdGlvbnMgTnVtYmVyIG9mIHNwcml0ZSBzaGVldCBhbmltYXRpb25zIGNvbnRhaW5lZCB3aXRoaW4gdGhlXG4gKiBjdXJyZW50IHNwcml0ZSBzaGVldC4gVGhlIG51bWJlciBvZiBhbmltYXRpb25zIG11bHRpcGxpZWQgYnkgbnVtYmVyIG9mIGZyYW1lcyBzaG91bGQgYmUgYSB2YWx1ZVxuICogbGVzcyB0aGFuIGFuaW1UaWxlc1ggbXVsdGlwbGllZCBieSBhbmltVGlsZXNZLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1OdW1GcmFtZXMgTnVtYmVyIG9mIHNwcml0ZSBzaGVldCBmcmFtZXMgaW4gdGhlIGN1cnJlbnQgc3ByaXRlIHNoZWV0XG4gKiBhbmltYXRpb24uIFRoZSBudW1iZXIgb2YgYW5pbWF0aW9ucyBtdWx0aXBsaWVkIGJ5IG51bWJlciBvZiBmcmFtZXMgc2hvdWxkIGJlIGEgdmFsdWUgbGVzcyB0aGFuXG4gKiBhbmltVGlsZXNYIG11bHRpcGxpZWQgYnkgYW5pbVRpbGVzWS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltU3RhcnRGcmFtZSBUaGUgc3ByaXRlIHNoZWV0IGZyYW1lIHRoYXQgdGhlIGFuaW1hdGlvbiBzaG91bGQgYmVnaW4gcGxheWluZ1xuICogZnJvbS4gSW5kZXhlZCBmcm9tIHRoZSBzdGFydCBvZiB0aGUgY3VycmVudCBhbmltYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbUluZGV4IFdoZW4gYW5pbU51bUFuaW1hdGlvbnMgaXMgZ3JlYXRlciB0aGFuIDEsIHRoZSBzcHJpdGUgc2hlZXRcbiAqIGFuaW1hdGlvbiBpbmRleCBkZXRlcm1pbmVzIHdoaWNoIGFuaW1hdGlvbiB0aGUgcGFydGljbGUgc3lzdGVtIHNob3VsZCBwbGF5LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmRvbWl6ZUFuaW1JbmRleCBFYWNoIHBhcnRpY2xlIGVtaXR0ZWQgYnkgdGhlIHN5c3RlbSB3aWxsIHBsYXkgYSByYW5kb21cbiAqIGFuaW1hdGlvbiBmcm9tIHRoZSBzcHJpdGUgc2hlZXQsIHVwIHRvIGFuaW1OdW1BbmltYXRpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1TcGVlZCBTcHJpdGUgc2hlZXQgYW5pbWF0aW9uIHNwZWVkLiAxID0gcGFydGljbGUgbGlmZXRpbWUsIDIgPSB0d2ljZVxuICogZHVyaW5nIGxpZmV0aW1lIGV0Yy4uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRlcHRoU29mdGVuaW5nIENvbnRyb2xzIGZhZGluZyBvZiBwYXJ0aWNsZXMgbmVhciB0aGVpciBpbnRlcnNlY3Rpb25zIHdpdGhcbiAqIHNjZW5lIGdlb21ldHJ5LiBUaGlzIGVmZmVjdCwgd2hlbiBpdCdzIG5vbi16ZXJvLCByZXF1aXJlcyBzY2VuZSBkZXB0aCBtYXAgdG8gYmUgcmVuZGVyZWQuXG4gKiBNdWx0aXBsZSBkZXB0aC1kZXBlbmRlbnQgZWZmZWN0cyBjYW4gc2hhcmUgdGhlIHNhbWUgbWFwLCBidXQgaWYgeW91IG9ubHkgdXNlIGl0IGZvciBwYXJ0aWNsZXMsXG4gKiBiZWFyIGluIG1pbmQgdGhhdCBpdCBjYW4gZG91YmxlIGVuZ2luZSBkcmF3IGNhbGxzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGluaXRpYWxWZWxvY2l0eSBEZWZpbmVzIG1hZ25pdHVkZSBvZiB0aGUgaW5pdGlhbCBlbWl0dGVyIHZlbG9jaXR5LiBEaXJlY3Rpb25cbiAqIGlzIGdpdmVuIGJ5IGVtaXR0ZXIgc2hhcGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBlbWl0dGVyRXh0ZW50cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX0JPWClcbiAqIFRoZSBleHRlbnRzIG9mIGEgbG9jYWwgc3BhY2UgYm91bmRpbmcgYm94IHdpdGhpbiB3aGljaCBwYXJ0aWNsZXMgYXJlIHNwYXduZWQgYXQgcmFuZG9tIHBvc2l0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGVtaXR0ZXJFeHRlbnRzSW5uZXIgKE9ubHkgZm9yXG4gKiBFTUlUVEVSU0hBUEVfQk9YKSBUaGUgZXhjZXB0aW9uIG9mIGV4dGVudHMgb2YgYSBsb2NhbCBzcGFjZSBib3VuZGluZyBib3ggd2l0aGluIHdoaWNoIHBhcnRpY2xlc1xuICogYXJlIG5vdCBzcGF3bmVkLiBBbGlnbmVkIHRvIHRoZSBjZW50ZXIgb2YgRW1pdHRlckV4dGVudHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pdHRlclJhZGl1cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX1NQSEVSRSkgVGhlIHJhZGl1cyB3aXRoaW4gd2hpY2hcbiAqIHBhcnRpY2xlcyBhcmUgc3Bhd25lZCBhdCByYW5kb20gcG9zaXRpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGVtaXR0ZXJSYWRpdXNJbm5lciAoT25seSBmb3IgRU1JVFRFUlNIQVBFX1NQSEVSRSkgVGhlIGlubmVyIHJhZGl1cyB3aXRoaW5cbiAqIHdoaWNoIHBhcnRpY2xlcyBhcmUgbm90IHNwYXduZWQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSB3cmFwQm91bmRzIFRoZSBoYWxmIGV4dGVudHMgb2YgYSB3b3JsZFxuICogc3BhY2UgYm94IHZvbHVtZSBjZW50ZXJlZCBvbiB0aGUgb3duZXIgZW50aXR5J3MgcG9zaXRpb24uIElmIGEgcGFydGljbGUgY3Jvc3NlcyB0aGUgYm91bmRhcnkgb2ZcbiAqIG9uZSBzaWRlIG9mIHRoZSB2b2x1bWUsIGl0IHRlbGVwb3J0cyB0byB0aGUgb3Bwb3NpdGUgc2lkZS5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IGNvbG9yTWFwQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIGNvbG9yTWFwLlxuICogQHByb3BlcnR5IHtBc3NldH0gbm9ybWFsTWFwQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIG5vcm1hbE1hcC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IG1lc2hBc3NldCBUaGUge0BsaW5rIEFzc2V0fSB1c2VkIHRvIHNldCB0aGUgbWVzaC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IHJlbmRlckFzc2V0IFRoZSBSZW5kZXIge0BsaW5rIEFzc2V0fSB1c2VkIHRvIHNldCB0aGUgbWVzaC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gY29sb3JNYXAgVGhlIGNvbG9yIG1hcCB0ZXh0dXJlIHRvIGFwcGx5IHRvIGFsbCBwYXJ0aWNsZXMgaW4gdGhlIHN5c3RlbS4gSWZcbiAqIG5vIHRleHR1cmUgaXMgYXNzaWduZWQsIGEgZGVmYXVsdCBzcG90IHRleHR1cmUgaXMgdXNlZC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gbm9ybWFsTWFwIFRoZSBub3JtYWwgbWFwIHRleHR1cmUgdG8gYXBwbHkgdG8gYWxsIHBhcnRpY2xlcyBpbiB0aGUgc3lzdGVtLiBJZlxuICogbm8gdGV4dHVyZSBpcyBhc3NpZ25lZCwgYW4gYXBwcm94aW1hdGUgc3BoZXJpY2FsIG5vcm1hbCBpcyBjYWxjdWxhdGVkIGZvciBlYWNoIHZlcnRleC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWl0dGVyU2hhcGUgU2hhcGUgb2YgdGhlIGVtaXR0ZXIuIERlZmluZXMgdGhlIGJvdW5kcyBpbnNpZGUgd2hpY2ggcGFydGljbGVzXG4gKiBhcmUgc3Bhd25lZC4gQWxzbyBhZmZlY3RzIHRoZSBkaXJlY3Rpb24gb2YgaW5pdGlhbCB2ZWxvY2l0eS5cbiAqXG4gKiAtIHtAbGluayBFTUlUVEVSU0hBUEVfQk9YfTogQm94IHNoYXBlIHBhcmFtZXRlcml6ZWQgYnkgZW1pdHRlckV4dGVudHMuIEluaXRpYWwgdmVsb2NpdHkgaXNcbiAqIGRpcmVjdGVkIHRvd2FyZHMgbG9jYWwgWiBheGlzLlxuICogLSB7QGxpbmsgRU1JVFRFUlNIQVBFX1NQSEVSRX06IFNwaGVyZSBzaGFwZSBwYXJhbWV0ZXJpemVkIGJ5IGVtaXR0ZXJSYWRpdXMuIEluaXRpYWwgdmVsb2NpdHkgaXNcbiAqIGRpcmVjdGVkIG91dHdhcmRzIGZyb20gdGhlIGNlbnRlci5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gc29ydCBTb3J0aW5nIG1vZGUuIEZvcmNlcyBDUFUgc2ltdWxhdGlvbiwgc28gYmUgY2FyZWZ1bC5cbiAqXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfTk9ORX06IE5vIHNvcnRpbmcsIHBhcnRpY2xlcyBhcmUgZHJhd24gaW4gYXJiaXRyYXJ5IG9yZGVyLiBDYW4gYmVcbiAqIHNpbXVsYXRlZCBvbiBHUFUuXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfRElTVEFOQ0V9OiBTb3J0aW5nIGJhc2VkIG9uIGRpc3RhbmNlIHRvIHRoZSBjYW1lcmEuIENQVSBvbmx5LlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX05FV0VSX0ZJUlNUfTogTmV3ZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKiAtIHtAbGluayBQQVJUSUNMRVNPUlRfT0xERVJfRklSU1R9OiBPbGRlciBwYXJ0aWNsZXMgYXJlIGRyYXduIGZpcnN0LiBDUFUgb25seS5cbiAqXG4gKiBAcHJvcGVydHkge01lc2h9IG1lc2ggVHJpYW5ndWxhciBtZXNoIHRvIGJlIHVzZWQgYXMgYSBwYXJ0aWNsZS4gT25seSBmaXJzdCB2ZXJ0ZXgvaW5kZXggYnVmZmVyXG4gKiBpcyB1c2VkLiBWZXJ0ZXggYnVmZmVyIG11c3QgY29udGFpbiBsb2NhbCBwb3NpdGlvbiBhdCBmaXJzdCAzIGZsb2F0cyBvZiBlYWNoIHZlcnRleC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBibGVuZFR5cGUgQ29udHJvbHMgaG93IHBhcnRpY2xlcyBhcmUgYmxlbmRlZCB3aGVuIGJlaW5nIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRseVxuICogYWN0aXZlIHJlbmRlciB0YXJnZXQuIENhbiBiZTpcbiAqXG4gKiAtIHtAbGluayBCTEVORF9TVUJUUkFDVElWRX06IFN1YnRyYWN0IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGZyb20gdGhlIGRlc3RpbmF0aW9uXG4gKiBmcmFnbWVudCBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfQURESVRJVkV9OiBBZGQgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgdG8gdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50IGFuZFxuICogd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfTk9STUFMfTogRW5hYmxlIHNpbXBsZSB0cmFuc2x1Y2VuY3kgZm9yIG1hdGVyaWFscyBzdWNoIGFzIGdsYXNzLiBUaGlzIGlzXG4gKiBlcXVpdmFsZW50IHRvIGVuYWJsaW5nIGEgc291cmNlIGJsZW5kIG1vZGUgb2Yge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9IGFuZCBhIGRlc3RpbmF0aW9uXG4gKiBibGVuZCBtb2RlIG9mIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX0uXG4gKiAtIHtAbGluayBCTEVORF9OT05FfTogRGlzYWJsZSBibGVuZGluZy5cbiAqIC0ge0BsaW5rIEJMRU5EX1BSRU1VTFRJUExJRUR9OiBTaW1pbGFyIHRvIHtAbGluayBCTEVORF9OT1JNQUx9IGV4cGVjdCB0aGUgc291cmNlIGZyYWdtZW50IGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYWxyZWFkeSBiZWVuIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYSB2YWx1ZS5cbiAqIC0ge0BsaW5rIEJMRU5EX01VTFRJUExJQ0FUSVZFfTogTXVsdGlwbHkgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgYnkgdGhlIGNvbG9yIG9mIHRoZVxuICogZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG8gdGhlIGZyYW1lIGJ1ZmZlci5cbiAqIC0ge0BsaW5rIEJMRU5EX0FERElUSVZFQUxQSEF9OiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzXG4gKiBtdWx0aXBsaWVkIGJ5IHRoZSBzb3VyY2UgYWxwaGEuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9yaWVudGF0aW9uIFNvcnRpbmcgbW9kZS4gRm9yY2VzIENQVSBzaW11bGF0aW9uLCBzbyBiZSBjYXJlZnVsLlxuICpcbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOfTogUGFydGljbGVzIGFyZSBmYWNpbmcgY2FtZXJhLlxuICogLSB7QGxpbmsgUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRH06IFVzZXIgZGVmaW5lcyB3b3JsZCBzcGFjZSBub3JtYWwgKHBhcnRpY2xlTm9ybWFsKSB0byBzZXRcbiAqIHBsYW5lcyBvcmllbnRhdGlvbi5cbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fRU1JVFRFUn06IFNpbWlsYXIgdG8gcHJldmlvdXMsIGJ1dCB0aGUgbm9ybWFsIGlzIGFmZmVjdGVkIGJ5XG4gKiBlbWl0dGVyIChlbnRpdHkpIHRyYW5zZm9ybWF0aW9uLlxuICpcbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IHBhcnRpY2xlTm9ybWFsIChPbmx5IGZvclxuICogUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRCBhbmQgUEFSVElDTEVPUklFTlRBVElPTl9FTUlUVEVSKSBUaGUgZXhjZXB0aW9uIG9mIGV4dGVudHMgb2YgYSBsb2NhbFxuICogc3BhY2UgYm91bmRpbmcgYm94IHdpdGhpbiB3aGljaCBwYXJ0aWNsZXMgYXJlIG5vdCBzcGF3bmVkLiBBbGlnbmVkIHRvIHRoZSBjZW50ZXIgb2ZcbiAqIEVtaXR0ZXJFeHRlbnRzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS1zZXQuanMnKS5DdXJ2ZVNldH0gbG9jYWxWZWxvY2l0eUdyYXBoIFZlbG9jaXR5XG4gKiByZWxhdGl2ZSB0byBlbWl0dGVyIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLXNldC5qcycpLkN1cnZlU2V0fSBsb2NhbFZlbG9jaXR5R3JhcGgyIElmIG5vdCBudWxsLFxuICogcGFydGljbGVzIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIGxvY2FsVmVsb2NpdHlHcmFwaCBhbmQgbG9jYWxWZWxvY2l0eUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJykuQ3VydmVTZXR9IHZlbG9jaXR5R3JhcGggV29ybGQtc3BhY2VcbiAqIHZlbG9jaXR5IG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLXNldC5qcycpLkN1cnZlU2V0fSB2ZWxvY2l0eUdyYXBoMiBJZiBub3QgbnVsbCxcbiAqIHBhcnRpY2xlcyBwaWNrIHJhbmRvbSB2YWx1ZXMgYmV0d2VlbiB2ZWxvY2l0eUdyYXBoIGFuZCB2ZWxvY2l0eUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJykuQ3VydmVTZXR9IGNvbG9yR3JhcGggQ29sb3Igb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gcm90YXRpb25TcGVlZEdyYXBoIFJvdGF0aW9uIHNwZWVkIG92ZXJcbiAqIGxpZmV0aW1lLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSByb3RhdGlvblNwZWVkR3JhcGgyIElmIG5vdCBudWxsLFxuICogcGFydGljbGVzIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHJvdGF0aW9uU3BlZWRHcmFwaCBhbmQgcm90YXRpb25TcGVlZEdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gcmFkaWFsU3BlZWRHcmFwaCBSYWRpYWwgc3BlZWQgb3ZlclxuICogbGlmZXRpbWUsIHZlbG9jaXR5IHZlY3RvciBwb2ludHMgZnJvbSBlbWl0dGVyIG9yaWdpbiB0byBwYXJ0aWNsZSBwb3MuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IHJhZGlhbFNwZWVkR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXNcbiAqIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHJhZGlhbFNwZWVkR3JhcGggYW5kIHJhZGlhbFNwZWVkR3JhcGgyLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSBzY2FsZUdyYXBoIFNjYWxlIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IHNjYWxlR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGlja1xuICogcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHNjYWxlR3JhcGggYW5kIHNjYWxlR3JhcGgyLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcycpLkN1cnZlfSBhbHBoYUdyYXBoIEFscGhhIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IGFscGhhR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGlja1xuICogcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIGFscGhhR3JhcGggYW5kIGFscGhhR3JhcGgyLlxuICogQHByb3BlcnR5IHtudW1iZXJbXX0gbGF5ZXJzIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBwYXJ0aWNsZVxuICogc3lzdGVtIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gvcG9wL3NwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0XG4gKiBhIG5ldyBvbmUgaW5zdGVhZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUGFydGljbGVTeXN0ZW1Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZXF1ZXN0ZWREZXB0aCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RyYXdPcmRlciA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUGFydGljbGVTeXN0ZW1Db21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5QYXJ0aWNsZVN5c3RlbUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbVxuICAgICAqIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLm9uKCdzZXRfY29sb3JNYXBBc3NldCcsIHRoaXMub25TZXRDb2xvck1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X25vcm1hbE1hcEFzc2V0JywgdGhpcy5vblNldE5vcm1hbE1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X21lc2hBc3NldCcsIHRoaXMub25TZXRNZXNoQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbWVzaCcsIHRoaXMub25TZXRNZXNoLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X3JlbmRlckFzc2V0JywgdGhpcy5vblNldFJlbmRlckFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xvb3AnLCB0aGlzLm9uU2V0TG9vcCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9ibGVuZFR5cGUnLCB0aGlzLm9uU2V0QmxlbmRUeXBlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2RlcHRoU29mdGVuaW5nJywgdGhpcy5vblNldERlcHRoU29mdGVuaW5nLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xheWVycycsIHRoaXMub25TZXRMYXllcnMsIHRoaXMpO1xuXG4gICAgICAgIFNJTVBMRV9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldFNpbXBsZVByb3BlcnR5LCB0aGlzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQ09NUExFWF9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldENvbXBsZXhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEdSQVBIX1BST1BFUlRJRVMuZm9yRWFjaCgocHJvcCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbihgc2V0XyR7cHJvcH1gLCB0aGlzLm9uU2V0R3JhcGhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldCBkcmF3T3JkZXIoZHJhd09yZGVyKSB7XG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkcmF3T3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzKCkge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhbdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRMYXllcnMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQob2xkVmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChuZXdWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBfYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uQ29sb3JNYXBBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Db2xvck1hcEFzc2V0Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uQ29sb3JNYXBBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldENvbG9yTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG9sZFZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5jb2xvck1hcEFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRDb2xvck1hcEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2FkZDonICsgbmV3VmFsdWUsIChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kQ29sb3JNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yTWFwID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubm9ybWFsTWFwID0gbnVsbDtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldENoYW5nZShhc3NldCkge1xuICAgIH1cblxuICAgIG9uU2V0Tm9ybWFsTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgaWYgKG9sZFZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQob2xkVmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5ub3JtYWxNYXBBc3NldCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChuZXdWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub25jZSgnYWRkOicgKyBuZXdWYWx1ZSwgKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmROb3JtYWxNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk1lc2hBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1lc2hBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1lc2hBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NZXNoQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk1lc2hBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25NZXNoQ2hhbmdlZChhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25NZXNoQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldE1lc2hBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNZXNoQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5tZXNoQXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgICAgICBuZXdWYWx1ZSA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1lc2hBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRNZXNoKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICAvLyBoYWNrIHRoaXMgZm9yIG5vd1xuICAgICAgICAvLyBpZiB0aGUgdmFsdWUgYmVpbmcgc2V0IGlzIG51bGwsIGFuIGFzc2V0IG9yIGFuIGFzc2V0IGlkLCB0aGVuIGFzc3VtZSB3ZSBhcmVcbiAgICAgICAgLy8gc2V0dGluZyB0aGUgbWVzaCBhc3NldCwgd2hpY2ggd2lsbCBpbiB0dXJuIHVwZGF0ZSB0aGUgbWVzaFxuICAgICAgICBpZiAoIW5ld1ZhbHVlIHx8IG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQgfHwgdHlwZW9mIG5ld1ZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5tZXNoQXNzZXQgPSBuZXdWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobmV3VmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTWVzaENoYW5nZWQobWVzaCkge1xuICAgICAgICBpZiAobWVzaCAmJiAhKG1lc2ggaW5zdGFuY2VvZiBNZXNoKSkge1xuICAgICAgICAgICAgLy8gaWYgbWVzaCBpcyBhIHBjLk1vZGVsLCB1c2UgdGhlIGZpcnN0IG1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgaWYgKG1lc2gubWVzaEluc3RhbmNlc1swXSkge1xuICAgICAgICAgICAgICAgIG1lc2ggPSBtZXNoLm1lc2hJbnN0YW5jZXNbMF0ubWVzaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzaCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRhdGEubWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2ggPSBtZXNoO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICAgICAgICAgIHRoaXMucmVidWlsZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRSZW5kZXJBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLnJlbmRlckFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZFJlbmRlckFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRSZW5kZXJBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vblJlbmRlckFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25SZW5kZXJBc3NldFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBhc3NldC5yZXNvdXJjZS5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJDaGFuZ2VkKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZChhc3NldCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQ2hhbmdlZChyZW5kZXIpIHtcbiAgICAgICAgaWYgKCFyZW5kZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobnVsbCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZW5kZXIub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25SZW5kZXJTZXRNZXNoZXMsIHRoaXMpO1xuICAgICAgICByZW5kZXIub24oJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG5cbiAgICAgICAgaWYgKHJlbmRlci5tZXNoZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyU2V0TWVzaGVzKHJlbmRlci5tZXNoZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyU2V0TWVzaGVzKG1lc2hlcykge1xuICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG1lc2hlcyAmJiBtZXNoZXNbMF0pO1xuICAgIH1cblxuICAgIG9uU2V0TG9vcChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEJsZW5kVHlwZShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWF0ZXJpYWwuYmxlbmRUeXBlID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVxdWVzdERlcHRoKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKCFkZXB0aExheWVyKSBkZXB0aExheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChkZXB0aExheWVyKSB7XG4gICAgICAgICAgICBkZXB0aExheWVyLmluY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuX3JlcXVlc3RlZERlcHRoID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZWxlYXNlRGVwdGgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKGRlcHRoTGF5ZXIpIHtcbiAgICAgICAgICAgIGRlcHRoTGF5ZXIuZGVjcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdGVkRGVwdGggPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0RGVwdGhTb2Z0ZW5pbmcobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVxdWVzdERlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVsZWFzZURlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldFNpbXBsZVByb3BlcnR5KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldENvbXBsZXhQcm9wZXJ0eShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEdyYXBoUHJvcGVydHkobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlcltuYW1lXSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlYnVpbGRHcmFwaHMoKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgLy8gZ2V0IGRhdGEgc3RvcmUgb25jZVxuICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIC8vIGxvYWQgYW55IGFzc2V0cyB0aGF0IGhhdmVuJ3QgYmVlbiBsb2FkZWQgeWV0XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBBU1NFVF9QUk9QRVJUSUVTLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYXNzZXQgPSBkYXRhW0FTU0VUX1BST1BFUlRJRVNbaV1dO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgaWYgKCEoYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaWQgPSBwYXJzZUludChhc3NldCwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXZWJHUFUgZG9lcyBub3Qgc3VwcG9ydCBwYXJ0aWNsZSBzeXN0ZW1zLCBpZ25vcmUgdGhlbVxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLmRpc2FibGVQYXJ0aWNsZVN5c3RlbSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIGxldCBtZXNoID0gZGF0YS5tZXNoO1xuXG4gICAgICAgICAgICAvLyBtZXNoIG1pZ2h0IGJlIGFuIGFzc2V0IGlkIG9mIGFuIGFzc2V0XG4gICAgICAgICAgICAvLyB0aGF0IGhhc24ndCBiZWVuIGxvYWRlZCB5ZXRcbiAgICAgICAgICAgIGlmICghKG1lc2ggaW5zdGFuY2VvZiBNZXNoKSlcbiAgICAgICAgICAgICAgICBtZXNoID0gbnVsbDtcblxuICAgICAgICAgICAgdGhpcy5lbWl0dGVyID0gbmV3IFBhcnRpY2xlRW1pdHRlcih0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2UsIHtcbiAgICAgICAgICAgICAgICBudW1QYXJ0aWNsZXM6IGRhdGEubnVtUGFydGljbGVzLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJFeHRlbnRzOiBkYXRhLmVtaXR0ZXJFeHRlbnRzLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJFeHRlbnRzSW5uZXI6IGRhdGEuZW1pdHRlckV4dGVudHNJbm5lcixcbiAgICAgICAgICAgICAgICBlbWl0dGVyUmFkaXVzOiBkYXRhLmVtaXR0ZXJSYWRpdXMsXG4gICAgICAgICAgICAgICAgZW1pdHRlclJhZGl1c0lubmVyOiBkYXRhLmVtaXR0ZXJSYWRpdXNJbm5lcixcbiAgICAgICAgICAgICAgICBlbWl0dGVyU2hhcGU6IGRhdGEuZW1pdHRlclNoYXBlLFxuICAgICAgICAgICAgICAgIGluaXRpYWxWZWxvY2l0eTogZGF0YS5pbml0aWFsVmVsb2NpdHksXG4gICAgICAgICAgICAgICAgd3JhcDogZGF0YS53cmFwLFxuICAgICAgICAgICAgICAgIGxvY2FsU3BhY2U6IGRhdGEubG9jYWxTcGFjZSxcbiAgICAgICAgICAgICAgICBzY3JlZW5TcGFjZTogZGF0YS5zY3JlZW5TcGFjZSxcbiAgICAgICAgICAgICAgICB3cmFwQm91bmRzOiBkYXRhLndyYXBCb3VuZHMsXG4gICAgICAgICAgICAgICAgbGlmZXRpbWU6IGRhdGEubGlmZXRpbWUsXG4gICAgICAgICAgICAgICAgcmF0ZTogZGF0YS5yYXRlLFxuICAgICAgICAgICAgICAgIHJhdGUyOiBkYXRhLnJhdGUyLFxuXG4gICAgICAgICAgICAgICAgb3JpZW50YXRpb246IGRhdGEub3JpZW50YXRpb24sXG4gICAgICAgICAgICAgICAgcGFydGljbGVOb3JtYWw6IGRhdGEucGFydGljbGVOb3JtYWwsXG5cbiAgICAgICAgICAgICAgICBhbmltVGlsZXNYOiBkYXRhLmFuaW1UaWxlc1gsXG4gICAgICAgICAgICAgICAgYW5pbVRpbGVzWTogZGF0YS5hbmltVGlsZXNZLFxuICAgICAgICAgICAgICAgIGFuaW1TdGFydEZyYW1lOiBkYXRhLmFuaW1TdGFydEZyYW1lLFxuICAgICAgICAgICAgICAgIGFuaW1OdW1GcmFtZXM6IGRhdGEuYW5pbU51bUZyYW1lcyxcbiAgICAgICAgICAgICAgICBhbmltTnVtQW5pbWF0aW9uczogZGF0YS5hbmltTnVtQW5pbWF0aW9ucyxcbiAgICAgICAgICAgICAgICBhbmltSW5kZXg6IGRhdGEuYW5pbUluZGV4LFxuICAgICAgICAgICAgICAgIHJhbmRvbWl6ZUFuaW1JbmRleDogZGF0YS5yYW5kb21pemVBbmltSW5kZXgsXG4gICAgICAgICAgICAgICAgYW5pbVNwZWVkOiBkYXRhLmFuaW1TcGVlZCxcbiAgICAgICAgICAgICAgICBhbmltTG9vcDogZGF0YS5hbmltTG9vcCxcblxuICAgICAgICAgICAgICAgIHN0YXJ0QW5nbGU6IGRhdGEuc3RhcnRBbmdsZSxcbiAgICAgICAgICAgICAgICBzdGFydEFuZ2xlMjogZGF0YS5zdGFydEFuZ2xlMixcblxuICAgICAgICAgICAgICAgIHNjYWxlR3JhcGg6IGRhdGEuc2NhbGVHcmFwaCxcbiAgICAgICAgICAgICAgICBzY2FsZUdyYXBoMjogZGF0YS5zY2FsZUdyYXBoMixcblxuICAgICAgICAgICAgICAgIGNvbG9yR3JhcGg6IGRhdGEuY29sb3JHcmFwaCxcbiAgICAgICAgICAgICAgICBjb2xvckdyYXBoMjogZGF0YS5jb2xvckdyYXBoMixcblxuICAgICAgICAgICAgICAgIGFscGhhR3JhcGg6IGRhdGEuYWxwaGFHcmFwaCxcbiAgICAgICAgICAgICAgICBhbHBoYUdyYXBoMjogZGF0YS5hbHBoYUdyYXBoMixcblxuICAgICAgICAgICAgICAgIGxvY2FsVmVsb2NpdHlHcmFwaDogZGF0YS5sb2NhbFZlbG9jaXR5R3JhcGgsXG4gICAgICAgICAgICAgICAgbG9jYWxWZWxvY2l0eUdyYXBoMjogZGF0YS5sb2NhbFZlbG9jaXR5R3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgdmVsb2NpdHlHcmFwaDogZGF0YS52ZWxvY2l0eUdyYXBoLFxuICAgICAgICAgICAgICAgIHZlbG9jaXR5R3JhcGgyOiBkYXRhLnZlbG9jaXR5R3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgcm90YXRpb25TcGVlZEdyYXBoOiBkYXRhLnJvdGF0aW9uU3BlZWRHcmFwaCxcbiAgICAgICAgICAgICAgICByb3RhdGlvblNwZWVkR3JhcGgyOiBkYXRhLnJvdGF0aW9uU3BlZWRHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICByYWRpYWxTcGVlZEdyYXBoOiBkYXRhLnJhZGlhbFNwZWVkR3JhcGgsXG4gICAgICAgICAgICAgICAgcmFkaWFsU3BlZWRHcmFwaDI6IGRhdGEucmFkaWFsU3BlZWRHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICBjb2xvck1hcDogZGF0YS5jb2xvck1hcCxcbiAgICAgICAgICAgICAgICBub3JtYWxNYXA6IGRhdGEubm9ybWFsTWFwLFxuICAgICAgICAgICAgICAgIGxvb3A6IGRhdGEubG9vcCxcbiAgICAgICAgICAgICAgICBwcmVXYXJtOiBkYXRhLnByZVdhcm0sXG4gICAgICAgICAgICAgICAgc29ydDogZGF0YS5zb3J0LFxuICAgICAgICAgICAgICAgIHN0cmV0Y2g6IGRhdGEuc3RyZXRjaCxcbiAgICAgICAgICAgICAgICBhbGlnblRvTW90aW9uOiBkYXRhLmFsaWduVG9Nb3Rpb24sXG4gICAgICAgICAgICAgICAgbGlnaHRpbmc6IGRhdGEubGlnaHRpbmcsXG4gICAgICAgICAgICAgICAgaGFsZkxhbWJlcnQ6IGRhdGEuaGFsZkxhbWJlcnQsXG4gICAgICAgICAgICAgICAgaW50ZW5zaXR5OiBkYXRhLmludGVuc2l0eSxcbiAgICAgICAgICAgICAgICBkZXB0aFNvZnRlbmluZzogZGF0YS5kZXB0aFNvZnRlbmluZyxcbiAgICAgICAgICAgICAgICBzY2VuZTogdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLFxuICAgICAgICAgICAgICAgIG1lc2g6IG1lc2gsXG4gICAgICAgICAgICAgICAgZGVwdGhXcml0ZTogZGF0YS5kZXB0aFdyaXRlLFxuICAgICAgICAgICAgICAgIG5vRm9nOiBkYXRhLm5vRm9nLFxuICAgICAgICAgICAgICAgIG5vZGU6IHRoaXMuZW50aXR5LFxuICAgICAgICAgICAgICAgIGJsZW5kVHlwZTogZGF0YS5ibGVuZFR5cGVcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlLm5vZGUgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5kcmF3T3JkZXIgPSB0aGlzLmRyYXdPcmRlcjtcblxuICAgICAgICAgICAgaWYgKCFkYXRhLmF1dG9QbGF5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2UudmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlci5jb2xvck1hcCkge1xuICAgICAgICAgICAgdGhpcy5hZGRNZXNoSW5zdGFuY2VUb0xheWVycygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgZGF0YS5kZXB0aFNvZnRlbmluZykge1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdERlcHRoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhLmRlcHRoU29mdGVuaW5nKSB0aGlzLl9yZWxlYXNlRGVwdGgoKTtcblxuICAgICAgICAgICAgLy8gY2xlYXIgY2FtZXJhIGFzIGl0IGlzbid0IHVwZGF0ZWQgd2hpbGUgZGlzYWJsZWQgYW5kIHdlIGRvbid0IHdhbnQgdG8gaG9sZFxuICAgICAgICAgICAgLy8gb250byBvbGQgcmVmZXJlbmNlXG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuY2FtZXJhID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2xlYXIgYWxsIGFzc2V0IHByb3BlcnRpZXMgdG8gcmVtb3ZlIGFueSBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBBU1NFVF9QUk9QRVJUSUVTLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wID0gQVNTRVRfUFJPUEVSVElFU1tpXTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YVtwcm9wXSkge1xuICAgICAgICAgICAgICAgIHRoaXNbcHJvcF0gPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNldHMgcGFydGljbGUgc3RhdGUsIGRvZXNuJ3QgYWZmZWN0IHBsYXlpbmcuXG4gICAgICovXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGlzYWJsZXMgdGhlIGVtaXNzaW9uIG9mIG5ldyBwYXJ0aWNsZXMsIGxldHMgZXhpc3RpbmcgdG8gZmluaXNoIHRoZWlyIHNpbXVsYXRpb24uXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmxvb3AgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldFRpbWUoKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5hZGRUaW1lKDAsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXplcyB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKi9cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5kYXRhLnBhdXNlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVW5mcmVlemVzIHRoZSBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHVucGF1c2UoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5wYXVzZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzL3VuZnJlZXplcyB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKi9cbiAgICBwbGF5KCkge1xuICAgICAgICB0aGlzLmRhdGEucGF1c2VkID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2UudmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubG9vcCA9IHRoaXMuZGF0YS5sb29wO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0VGltZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIHNpbXVsYXRpb24gaXMgaW4gcHJvZ3Jlc3MuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgcGFydGljbGUgc3lzdGVtIGlzIGN1cnJlbnRseSBwbGF5aW5nIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgaXNQbGF5aW5nKCkge1xuICAgICAgICBpZiAodGhpcy5kYXRhLnBhdXNlZCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIgJiYgdGhpcy5lbWl0dGVyLmxvb3ApIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgYnVnIGhlcmUgd2hhdCBoYXBwZW5zIGlmIHRoZSBub24gbG9vcGluZyBlbWl0dGVyXG4gICAgICAgIC8vIHdhcyBwYXVzZWQgaW4gdGhlIG1lYW50aW1lP1xuICAgICAgICByZXR1cm4gRGF0ZS5ub3coKSA8PSB0aGlzLmVtaXR0ZXIuZW5kVGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWJ1aWxkcyBhbGwgZGF0YSB1c2VkIGJ5IHRoaXMgcGFydGljbGUgc3lzdGVtLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZWJ1aWxkKCkge1xuICAgICAgICBjb25zdCBlbmFibGVkID0gdGhpcy5lbmFibGVkO1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlYnVpbGQoKTsgLy8gd29yc3QgY2FzZTogcmVxdWlyZWQgdG8gcmVidWlsZCBidWZmZXJzL3NoYWRlcnNcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2Uubm9kZSA9IHRoaXMuZW50aXR5O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIlNJTVBMRV9QUk9QRVJUSUVTIiwiQ09NUExFWF9QUk9QRVJUSUVTIiwiR1JBUEhfUFJPUEVSVElFUyIsIkFTU0VUX1BST1BFUlRJRVMiLCJkZXB0aExheWVyIiwiUGFydGljbGVTeXN0ZW1Db21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9yZXF1ZXN0ZWREZXB0aCIsIl9kcmF3T3JkZXIiLCJvbiIsIm9uU2V0Q29sb3JNYXBBc3NldCIsIm9uU2V0Tm9ybWFsTWFwQXNzZXQiLCJvblNldE1lc2hBc3NldCIsIm9uU2V0TWVzaCIsIm9uU2V0UmVuZGVyQXNzZXQiLCJvblNldExvb3AiLCJvblNldEJsZW5kVHlwZSIsIm9uU2V0RGVwdGhTb2Z0ZW5pbmciLCJvblNldExheWVycyIsImZvckVhY2giLCJwcm9wIiwib25TZXRTaW1wbGVQcm9wZXJ0eSIsIm9uU2V0Q29tcGxleFByb3BlcnR5Iiwib25TZXRHcmFwaFByb3BlcnR5IiwiZHJhd09yZGVyIiwiZW1pdHRlciIsImFkZE1lc2hJbnN0YW5jZVRvTGF5ZXJzIiwiaSIsImxheWVycyIsImxlbmd0aCIsImxheWVyIiwiYXBwIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJhZGRNZXNoSW5zdGFuY2VzIiwibWVzaEluc3RhbmNlIiwiX2xheWVyIiwicmVtb3ZlTWVzaEluc3RhbmNlRnJvbUxheWVycyIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJuYW1lIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsImVuYWJsZWQiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9mZiIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwiaWQiLCJfYmluZENvbG9yTWFwQXNzZXQiLCJhc3NldCIsIl9vbkNvbG9yTWFwQXNzZXRMb2FkIiwiX29uQ29sb3JNYXBBc3NldFVubG9hZCIsIl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUiLCJfb25Db2xvck1hcEFzc2V0Q2hhbmdlIiwicmVzb3VyY2UiLCJhc3NldHMiLCJsb2FkIiwiX3VuYmluZENvbG9yTWFwQXNzZXQiLCJjb2xvck1hcCIsImdldCIsIkFzc2V0IiwiZGF0YSIsImNvbG9yTWFwQXNzZXQiLCJvbmNlIiwiX2JpbmROb3JtYWxNYXBBc3NldCIsIl9vbk5vcm1hbE1hcEFzc2V0TG9hZCIsIl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkIiwiX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUiLCJfb25Ob3JtYWxNYXBBc3NldENoYW5nZSIsIl91bmJpbmROb3JtYWxNYXBBc3NldCIsIm5vcm1hbE1hcCIsIm5vcm1hbE1hcEFzc2V0IiwiX2JpbmRNZXNoQXNzZXQiLCJfb25NZXNoQXNzZXRMb2FkIiwiX29uTWVzaEFzc2V0VW5sb2FkIiwiX29uTWVzaEFzc2V0UmVtb3ZlIiwiX29uTWVzaEFzc2V0Q2hhbmdlIiwiX3VuYmluZE1lc2hBc3NldCIsIl9vbk1lc2hDaGFuZ2VkIiwibWVzaCIsIm1lc2hBc3NldCIsIk1lc2giLCJtZXNoSW5zdGFuY2VzIiwicmVzZXRNYXRlcmlhbCIsInJlYnVpbGQiLCJfdW5iaW5kUmVuZGVyQXNzZXQiLCJyZW5kZXJBc3NldCIsIl9iaW5kUmVuZGVyQXNzZXQiLCJfb25SZW5kZXJDaGFuZ2VkIiwiX29uUmVuZGVyQXNzZXRMb2FkIiwiX29uUmVuZGVyQXNzZXRVbmxvYWQiLCJfb25SZW5kZXJBc3NldFJlbW92ZSIsIl9vblJlbmRlclNldE1lc2hlcyIsInJlbmRlciIsIm1lc2hlcyIsInJlc2V0VGltZSIsIm1hdGVyaWFsIiwiYmxlbmRUeXBlIiwiX3JlcXVlc3REZXB0aCIsIkxBWUVSSURfREVQVEgiLCJpbmNyZW1lbnRDb3VudGVyIiwiX3JlbGVhc2VEZXB0aCIsImRlY3JlbWVudENvdW50ZXIiLCJyZXNldCIsInJlYnVpbGRHcmFwaHMiLCJvbkVuYWJsZSIsImxlbiIsInBhcnNlSW50IiwiZ3JhcGhpY3NEZXZpY2UiLCJkaXNhYmxlUGFydGljbGVTeXN0ZW0iLCJQYXJ0aWNsZUVtaXR0ZXIiLCJudW1QYXJ0aWNsZXMiLCJlbWl0dGVyRXh0ZW50cyIsImVtaXR0ZXJFeHRlbnRzSW5uZXIiLCJlbWl0dGVyUmFkaXVzIiwiZW1pdHRlclJhZGl1c0lubmVyIiwiZW1pdHRlclNoYXBlIiwiaW5pdGlhbFZlbG9jaXR5Iiwid3JhcCIsImxvY2FsU3BhY2UiLCJzY3JlZW5TcGFjZSIsIndyYXBCb3VuZHMiLCJsaWZldGltZSIsInJhdGUiLCJyYXRlMiIsIm9yaWVudGF0aW9uIiwicGFydGljbGVOb3JtYWwiLCJhbmltVGlsZXNYIiwiYW5pbVRpbGVzWSIsImFuaW1TdGFydEZyYW1lIiwiYW5pbU51bUZyYW1lcyIsImFuaW1OdW1BbmltYXRpb25zIiwiYW5pbUluZGV4IiwicmFuZG9taXplQW5pbUluZGV4IiwiYW5pbVNwZWVkIiwiYW5pbUxvb3AiLCJzdGFydEFuZ2xlIiwic3RhcnRBbmdsZTIiLCJzY2FsZUdyYXBoIiwic2NhbGVHcmFwaDIiLCJjb2xvckdyYXBoIiwiY29sb3JHcmFwaDIiLCJhbHBoYUdyYXBoIiwiYWxwaGFHcmFwaDIiLCJsb2NhbFZlbG9jaXR5R3JhcGgiLCJsb2NhbFZlbG9jaXR5R3JhcGgyIiwidmVsb2NpdHlHcmFwaCIsInZlbG9jaXR5R3JhcGgyIiwicm90YXRpb25TcGVlZEdyYXBoIiwicm90YXRpb25TcGVlZEdyYXBoMiIsInJhZGlhbFNwZWVkR3JhcGgiLCJyYWRpYWxTcGVlZEdyYXBoMiIsImxvb3AiLCJwcmVXYXJtIiwic29ydCIsInN0cmV0Y2giLCJhbGlnblRvTW90aW9uIiwibGlnaHRpbmciLCJoYWxmTGFtYmVydCIsImludGVuc2l0eSIsImRlcHRoU29mdGVuaW5nIiwiZGVwdGhXcml0ZSIsIm5vRm9nIiwibm9kZSIsImF1dG9QbGF5IiwicGF1c2UiLCJ2aXNpYmxlIiwib25EaXNhYmxlIiwiY2FtZXJhIiwib25CZWZvcmVSZW1vdmUiLCJkZXN0cm95Iiwic3RvcCIsImFkZFRpbWUiLCJwYXVzZWQiLCJ1bnBhdXNlIiwicGxheSIsImlzUGxheWluZyIsIkRhdGUiLCJub3ciLCJlbmRUaW1lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFRQTtBQUNBLE1BQU1BLGlCQUFpQixHQUFHLENBQ3RCLGdCQUFnQixFQUNoQixlQUFlLEVBQ2YscUJBQXFCLEVBQ3JCLG9CQUFvQixFQUNwQixNQUFNLEVBQ04saUJBQWlCLEVBQ2pCLFdBQVcsRUFDWCxXQUFXLEVBQ1gsZ0JBQWdCLENBQ25CLENBQUE7O0FBRUQ7QUFDQSxNQUFNQyxrQkFBa0IsR0FBRyxDQUN2QixjQUFjLEVBQ2QsVUFBVSxFQUNWLE1BQU0sRUFDTixPQUFPLEVBQ1AsWUFBWSxFQUNaLGFBQWEsRUFDYixVQUFVLEVBQ1YsYUFBYSxFQUNiLFdBQVcsRUFDWCxNQUFNLEVBQ04sWUFBWSxFQUNaLFlBQVksRUFDWixPQUFPLEVBQ1AsTUFBTSxFQUNOLFNBQVMsRUFDVCxlQUFlLEVBQ2YsU0FBUyxFQUNU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
