import { LAYERID_DEPTH } from '../../../scene/constants.js';
import { Mesh } from '../../../scene/mesh.js';
import { ParticleEmitter } from '../../../scene/particle-system/particle-emitter.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

const SIMPLE_PROPERTIES = ['emitterExtents', 'emitterRadius', 'emitterExtentsInner', 'emitterRadiusInner', 'loop', 'initialVelocity', 'animSpeed', 'normalMap', 'particleNormal'];
const COMPLEX_PROPERTIES = ['numParticles', 'lifetime', 'rate', 'rate2', 'startAngle', 'startAngle2', 'lighting', 'halfLambert', 'intensity', 'wrap', 'wrapBounds', 'depthWrite', 'noFog', 'sort', 'stretch', 'alignToMotion', 'preWarm', 'emitterShape', 'animTilesX', 'animTilesY', 'animStartFrame', 'animNumFrames', 'animNumAnimations', 'animIndex', 'randomizeAnimIndex', 'animLoop', 'colorMap', 'localSpace', 'screenSpace', 'orientation'];
const GRAPH_PROPERTIES = ['scaleGraph', 'scaleGraph2', 'colorGraph', 'colorGraph2', 'alphaGraph', 'alphaGraph2', 'velocityGraph', 'velocityGraph2', 'localVelocityGraph', 'localVelocityGraph2', 'rotationSpeedGraph', 'rotationSpeedGraph2', 'radialSpeedGraph', 'radialSpeedGraph2'];
const ASSET_PROPERTIES = ['colorMapAsset', 'normalMapAsset', 'meshAsset', 'renderAsset'];
let depthLayer;
class ParticleSystemComponent extends Component {
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
  get data() {
    const record = this.system.store[this.entity.getGuid()];
    return record ? record.data : null;
  }
  set enabled(arg) {
    this._setValue('enabled', arg);
  }
  get enabled() {
    return this.data.enabled;
  }
  set autoPlay(arg) {
    this._setValue('autoPlay', arg);
  }
  get autoPlay() {
    return this.data.autoPlay;
  }
  set numParticles(arg) {
    this._setValue('numParticles', arg);
  }
  get numParticles() {
    return this.data.numParticles;
  }
  set lifetime(arg) {
    this._setValue('lifetime', arg);
  }
  get lifetime() {
    return this.data.lifetime;
  }
  set rate(arg) {
    this._setValue('rate', arg);
  }
  get rate() {
    return this.data.rate;
  }
  set rate2(arg) {
    this._setValue('rate2', arg);
  }
  get rate2() {
    return this.data.rate2;
  }
  set startAngle(arg) {
    this._setValue('startAngle', arg);
  }
  get startAngle() {
    return this.data.startAngle;
  }
  set startAngle2(arg) {
    this._setValue('startAngle2', arg);
  }
  get startAngle2() {
    return this.data.startAngle2;
  }
  set loop(arg) {
    this._setValue('loop', arg);
  }
  get loop() {
    return this.data.loop;
  }
  set preWarm(arg) {
    this._setValue('preWarm', arg);
  }
  get preWarm() {
    return this.data.preWarm;
  }
  set lighting(arg) {
    this._setValue('lighting', arg);
  }
  get lighting() {
    return this.data.lighting;
  }
  set halfLambert(arg) {
    this._setValue('halfLambert', arg);
  }
  get halfLambert() {
    return this.data.halfLambert;
  }
  set intensity(arg) {
    this._setValue('intensity', arg);
  }
  get intensity() {
    return this.data.intensity;
  }
  set depthWrite(arg) {
    this._setValue('depthWrite', arg);
  }
  get depthWrite() {
    return this.data.depthWrite;
  }
  set noFog(arg) {
    this._setValue('noFog', arg);
  }
  get noFog() {
    return this.data.noFog;
  }
  set depthSoftening(arg) {
    this._setValue('depthSoftening', arg);
  }
  get depthSoftening() {
    return this.data.depthSoftening;
  }
  set sort(arg) {
    this._setValue('sort', arg);
  }
  get sort() {
    return this.data.sort;
  }
  set blendType(arg) {
    this._setValue('blendType', arg);
  }
  get blendType() {
    return this.data.blendType;
  }
  set stretch(arg) {
    this._setValue('stretch', arg);
  }
  get stretch() {
    return this.data.stretch;
  }
  set alignToMotion(arg) {
    this._setValue('alignToMotion', arg);
  }
  get alignToMotion() {
    return this.data.alignToMotion;
  }
  set emitterShape(arg) {
    this._setValue('emitterShape', arg);
  }
  get emitterShape() {
    return this.data.emitterShape;
  }
  set emitterExtents(arg) {
    this._setValue('emitterExtents', arg);
  }
  get emitterExtents() {
    return this.data.emitterExtents;
  }
  set emitterExtentsInner(arg) {
    this._setValue('emitterExtentsInner', arg);
  }
  get emitterExtentsInner() {
    return this.data.emitterExtentsInner;
  }
  set emitterRadius(arg) {
    this._setValue('emitterRadius', arg);
  }
  get emitterRadius() {
    return this.data.emitterRadius;
  }
  set emitterRadiusInner(arg) {
    this._setValue('emitterRadiusInner', arg);
  }
  get emitterRadiusInner() {
    return this.data.emitterRadiusInner;
  }
  set initialVelocity(arg) {
    this._setValue('initialVelocity', arg);
  }
  get initialVelocity() {
    return this.data.initialVelocity;
  }
  set wrap(arg) {
    this._setValue('wrap', arg);
  }
  get wrap() {
    return this.data.wrap;
  }
  set wrapBounds(arg) {
    this._setValue('wrapBounds', arg);
  }
  get wrapBounds() {
    return this.data.wrapBounds;
  }
  set localSpace(arg) {
    this._setValue('localSpace', arg);
  }
  get localSpace() {
    return this.data.localSpace;
  }
  set screenSpace(arg) {
    this._setValue('screenSpace', arg);
  }
  get screenSpace() {
    return this.data.screenSpace;
  }
  set colorMapAsset(arg) {
    this._setValue('colorMapAsset', arg);
  }
  get colorMapAsset() {
    return this.data.colorMapAsset;
  }
  set normalMapAsset(arg) {
    this._setValue('normalMapAsset', arg);
  }
  get normalMapAsset() {
    return this.data.normalMapAsset;
  }
  set mesh(arg) {
    this._setValue('mesh', arg);
  }
  get mesh() {
    return this.data.mesh;
  }
  set meshAsset(arg) {
    this._setValue('meshAsset', arg);
  }
  get meshAsset() {
    return this.data.meshAsset;
  }
  set renderAsset(arg) {
    this._setValue('renderAsset', arg);
  }
  get renderAsset() {
    return this.data.renderAsset;
  }
  set orientation(arg) {
    this._setValue('orientation', arg);
  }
  get orientation() {
    return this.data.orientation;
  }
  set particleNormal(arg) {
    this._setValue('particleNormal', arg);
  }
  get particleNormal() {
    return this.data.particleNormal;
  }
  set localVelocityGraph(arg) {
    this._setValue('localVelocityGraph', arg);
  }
  get localVelocityGraph() {
    return this.data.localVelocityGraph;
  }
  set localVelocityGraph2(arg) {
    this._setValue('localVelocityGraph2', arg);
  }
  get localVelocityGraph2() {
    return this.data.localVelocityGraph2;
  }
  set velocityGraph(arg) {
    this._setValue('velocityGraph', arg);
  }
  get velocityGraph() {
    return this.data.velocityGraph;
  }
  set velocityGraph2(arg) {
    this._setValue('velocityGraph2', arg);
  }
  get velocityGraph2() {
    return this.data.velocityGraph2;
  }
  set rotationSpeedGraph(arg) {
    this._setValue('rotationSpeedGraph', arg);
  }
  get rotationSpeedGraph() {
    return this.data.rotationSpeedGraph;
  }
  set rotationSpeedGraph2(arg) {
    this._setValue('rotationSpeedGraph2', arg);
  }
  get rotationSpeedGraph2() {
    return this.data.rotationSpeedGraph2;
  }
  set radialSpeedGraph(arg) {
    this._setValue('radialSpeedGraph', arg);
  }
  get radialSpeedGraph() {
    return this.data.radialSpeedGraph;
  }
  set radialSpeedGraph2(arg) {
    this._setValue('radialSpeedGraph2', arg);
  }
  get radialSpeedGraph2() {
    return this.data.radialSpeedGraph2;
  }
  set scaleGraph(arg) {
    this._setValue('scaleGraph', arg);
  }
  get scaleGraph() {
    return this.data.scaleGraph;
  }
  set scaleGraph2(arg) {
    this._setValue('scaleGraph2', arg);
  }
  get scaleGraph2() {
    return this.data.scaleGraph2;
  }
  set colorGraph(arg) {
    this._setValue('colorGraph', arg);
  }
  get colorGraph() {
    return this.data.colorGraph;
  }
  set colorGraph2(arg) {
    this._setValue('colorGraph2', arg);
  }
  get colorGraph2() {
    return this.data.colorGraph2;
  }
  set alphaGraph(arg) {
    this._setValue('alphaGraph', arg);
  }
  get alphaGraph() {
    return this.data.alphaGraph;
  }
  set alphaGraph2(arg) {
    this._setValue('alphaGraph2', arg);
  }
  get alphaGraph2() {
    return this.data.alphaGraph2;
  }
  set colorMap(arg) {
    this._setValue('colorMap', arg);
  }
  get colorMap() {
    return this.data.colorMap;
  }
  set normalMap(arg) {
    this._setValue('normalMap', arg);
  }
  get normalMap() {
    return this.data.normalMap;
  }
  set animTilesX(arg) {
    this._setValue('animTilesX', arg);
  }
  get animTilesX() {
    return this.data.animTilesX;
  }
  set animTilesY(arg) {
    this._setValue('animTilesY', arg);
  }
  get animTilesY() {
    return this.data.animTilesY;
  }
  set animStartFrame(arg) {
    this._setValue('animStartFrame', arg);
  }
  get animStartFrame() {
    return this.data.animStartFrame;
  }
  set animNumFrames(arg) {
    this._setValue('animNumFrames', arg);
  }
  get animNumFrames() {
    return this.data.animNumFrames;
  }
  set animNumAnimations(arg) {
    this._setValue('animNumAnimations', arg);
  }
  get animNumAnimations() {
    return this.data.animNumAnimations;
  }
  set animIndex(arg) {
    this._setValue('animIndex', arg);
  }
  get animIndex() {
    return this.data.animIndex;
  }
  set randomizeAnimIndex(arg) {
    this._setValue('randomizeAnimIndex', arg);
  }
  get randomizeAnimIndex() {
    return this.data.randomizeAnimIndex;
  }
  set animSpeed(arg) {
    this._setValue('animSpeed', arg);
  }
  get animSpeed() {
    return this.data.animSpeed;
  }
  set animLoop(arg) {
    this._setValue('animLoop', arg);
  }
  get animLoop() {
    return this.data.animLoop;
  }
  set layers(arg) {
    this._setValue('layers', arg);
  }
  get layers() {
    return this.data.layers;
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
  _setValue(name, value) {
    const data = this.data;
    const oldValue = data[name];
    data[name] = value;
    this.fire('set', name, oldValue, value);
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
    if (!newValue || newValue instanceof Asset || typeof newValue === 'number') {
      this.meshAsset = newValue;
    } else {
      this._onMeshChanged(newValue);
    }
  }
  _onMeshChanged(mesh) {
    if (mesh && !(mesh instanceof Mesh)) {
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
    const data = this.data;
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
    if (this.system.app.graphicsDevice.disableParticleSystem) {
      return;
    }
    if (!this.emitter) {
      let mesh = data.mesh;
      if (!(mesh instanceof Mesh)) {
        mesh = null;
      }
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
    for (let i = 0; i < ASSET_PROPERTIES.length; i++) {
      const prop = ASSET_PROPERTIES[i];
      if (this.data[prop]) {
        this[prop] = null;
      }
    }
    this.off();
  }
  reset() {
    if (this.emitter) {
      this.emitter.reset();
    }
  }
  stop() {
    if (this.emitter) {
      this.emitter.loop = false;
      this.emitter.resetTime();
      this.emitter.addTime(0, true);
    }
  }
  pause() {
    this.data.paused = true;
  }
  unpause() {
    this.data.paused = false;
  }
  play() {
    this.data.paused = false;
    if (this.emitter) {
      this.emitter.meshInstance.visible = true;
      this.emitter.loop = this.data.loop;
      this.emitter.resetTime();
    }
  }
  isPlaying() {
    if (this.data.paused) {
      return false;
    }
    if (this.emitter && this.emitter.loop) {
      return true;
    }
    return Date.now() <= this.emitter.endTime;
  }
  rebuild() {
    const enabled = this.enabled;
    this.enabled = false;
    if (this.emitter) {
      this.emitter.rebuild();
      this.emitter.meshInstance.node = this.entity;
    }
    this.enabled = enabled;
  }
}

export { ParticleSystemComponent };
