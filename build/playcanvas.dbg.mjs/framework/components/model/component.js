/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { LAYERID_WORLD } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { getShapePrimitive } from '../../../scene/procedural.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

class ModelComponent extends Component {

  constructor(system, entity) {
    super(system, entity);
    this._type = 'asset';
    this._asset = null;
    this._model = null;
    this._mapping = {};
    this._castShadows = true;
    this._receiveShadows = true;
    this._materialAsset = null;
    this._material = void 0;
    this._castShadowsLightmap = true;
    this._lightmapped = false;
    this._lightmapSizeMultiplier = 1;
    this._isStatic = false;
    this._layers = [LAYERID_WORLD];
    this._batchGroupId = -1;
    this._customAabb = null;
    this._area = null;
    this._materialEvents = null;
    this._clonedModel = false;
    this._batchGroup = null;
    this._material = system.defaultMaterial;

    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }

  set meshInstances(value) {
    if (!this._model) return;
    this._model.meshInstances = value;
  }
  get meshInstances() {
    if (!this._model) return null;
    return this._model.meshInstances;
  }

  set customAabb(value) {
    this._customAabb = value;

    if (this._model) {
      const mi = this._model.meshInstances;
      if (mi) {
        for (let i = 0; i < mi.length; i++) {
          mi[i].setCustomAabb(this._customAabb);
        }
      }
    }
  }
  get customAabb() {
    return this._customAabb;
  }

  set type(value) {
    if (this._type === value) return;
    this._area = null;
    this._type = value;
    if (value === 'asset') {
      if (this._asset !== null) {
        this._bindModelAsset(this._asset);
      } else {
        this.model = null;
      }
    } else {
      const primData = getShapePrimitive(this.system.app.graphicsDevice, value);
      this._area = primData.area;
      const mesh = primData.mesh;
      const node = new GraphNode();
      const model = new Model();
      model.graph = node;
      model.meshInstances = [new MeshInstance(mesh, this._material, node)];
      this.model = model;
      this._asset = null;
    }
  }
  get type() {
    return this._type;
  }

  set asset(value) {
    const assets = this.system.app.assets;
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    if (this._asset !== _id) {
      if (this._asset) {
        assets.off('add:' + this._asset, this._onModelAssetAdded, this);
        const _prev = assets.get(this._asset);
        if (_prev) {
          this._unbindModelAsset(_prev);
        }
      }
      this._asset = _id;
      if (this._asset) {
        const asset = assets.get(this._asset);
        if (!asset) {
          this.model = null;
          assets.on('add:' + this._asset, this._onModelAssetAdded, this);
        } else {
          this._bindModelAsset(asset);
        }
      } else {
        this.model = null;
      }
    }
  }
  get asset() {
    return this._asset;
  }

  set model(value) {
    if (this._model === value) return;

    if (value && value._immutable) {
      Debug.error('Invalid attempt to assign a model to multiple ModelComponents');
      return;
    }
    if (this._model) {
      this._model._immutable = false;
      this.removeModelFromLayers();
      this.entity.removeChild(this._model.getGraph());
      delete this._model._entity;
      if (this._clonedModel) {
        this._model.destroy();
        this._clonedModel = false;
      }
    }
    this._model = value;
    if (this._model) {
      this._model._immutable = true;
      const meshInstances = this._model.meshInstances;
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].castShadow = this._castShadows;
        meshInstances[i].receiveShadow = this._receiveShadows;
        meshInstances[i].isStatic = this._isStatic;
        meshInstances[i].setCustomAabb(this._customAabb);
      }
      this.lightmapped = this._lightmapped;

      this.entity.addChild(this._model.graph);
      if (this.enabled && this.entity.enabled) {
        this.addModelToLayers();
      }

      this._model._entity = this.entity;

      if (this.entity.animation) this.entity.animation.setModel(this._model);

      if (this.entity.anim) {
        this.entity.anim.rebind();
      }
      if (this.type === 'asset') {
        this.mapping = this._mapping;
      } else {
        this._unsetMaterialEvents();
      }
    }
  }
  get model() {
    return this._model;
  }

  set lightmapped(value) {
    if (value !== this._lightmapped) {
      this._lightmapped = value;
      if (this._model) {
        const mi = this._model.meshInstances;
        for (let i = 0; i < mi.length; i++) {
          mi[i].setLightmapped(value);
        }
      }
    }
  }
  get lightmapped() {
    return this._lightmapped;
  }

  set castShadows(value) {
    if (this._castShadows === value) return;
    const model = this._model;
    if (model) {
      const layers = this.layers;
      const scene = this.system.app.scene;
      if (this._castShadows && !value) {
        for (let i = 0; i < layers.length; i++) {
          const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
          if (!layer) continue;
          layer.removeShadowCasters(model.meshInstances);
        }
      }
      const meshInstances = model.meshInstances;
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].castShadow = value;
      }
      if (!this._castShadows && value) {
        for (let i = 0; i < layers.length; i++) {
          const layer = scene.layers.getLayerById(layers[i]);
          if (!layer) continue;
          layer.addShadowCasters(model.meshInstances);
        }
      }
    }
    this._castShadows = value;
  }
  get castShadows() {
    return this._castShadows;
  }

  set receiveShadows(value) {
    if (this._receiveShadows === value) return;
    this._receiveShadows = value;
    if (this._model) {
      const meshInstances = this._model.meshInstances;
      for (let i = 0, len = meshInstances.length; i < len; i++) {
        meshInstances[i].receiveShadow = value;
      }
    }
  }
  get receiveShadows() {
    return this._receiveShadows;
  }

  set castShadowsLightmap(value) {
    this._castShadowsLightmap = value;
  }
  get castShadowsLightmap() {
    return this._castShadowsLightmap;
  }

  set lightmapSizeMultiplier(value) {
    this._lightmapSizeMultiplier = value;
  }
  get lightmapSizeMultiplier() {
    return this._lightmapSizeMultiplier;
  }

  set isStatic(value) {
    if (this._isStatic === value) return;
    this._isStatic = value;
    if (this._model) {
      const rcv = this._model.meshInstances;
      for (let i = 0; i < rcv.length; i++) {
        const m = rcv[i];
        m.isStatic = value;
      }
    }
  }
  get isStatic() {
    return this._isStatic;
  }

  set layers(value) {
    const layers = this.system.app.scene.layers;
    if (this.meshInstances) {
      for (let i = 0; i < this._layers.length; i++) {
        const layer = layers.getLayerById(this._layers[i]);
        if (!layer) continue;
        layer.removeMeshInstances(this.meshInstances);
      }
    }

    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }

    if (!this.enabled || !this.entity.enabled || !this.meshInstances) return;

    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (!layer) continue;
      layer.addMeshInstances(this.meshInstances);
    }
  }
  get layers() {
    return this._layers;
  }

  set batchGroupId(value) {
    if (this._batchGroupId === value) return;
    if (this.entity.enabled && this._batchGroupId >= 0) {
      var _this$system$app$batc;
      (_this$system$app$batc = this.system.app.batcher) == null ? void 0 : _this$system$app$batc.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
    }
    if (this.entity.enabled && value >= 0) {
      var _this$system$app$batc2;
      (_this$system$app$batc2 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc2.insert(BatchGroup.MODEL, value, this.entity);
    }
    if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
      this.addModelToLayers();
    }
    this._batchGroupId = value;
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  set materialAsset(value) {
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    const assets = this.system.app.assets;
    if (_id !== this._materialAsset) {
      if (this._materialAsset) {
        assets.off('add:' + this._materialAsset, this._onMaterialAssetAdd, this);
        const _prev = assets.get(this._materialAsset);
        if (_prev) {
          this._unbindMaterialAsset(_prev);
        }
      }
      this._materialAsset = _id;
      if (this._materialAsset) {
        const asset = assets.get(this._materialAsset);
        if (!asset) {
          this._setMaterial(this.system.defaultMaterial);
          assets.on('add:' + this._materialAsset, this._onMaterialAssetAdd, this);
        } else {
          this._bindMaterialAsset(asset);
        }
      } else {
        this._setMaterial(this.system.defaultMaterial);
      }
    }
  }
  get materialAsset() {
    return this._materialAsset;
  }

  set material(value) {
    if (this._material === value) return;
    this.materialAsset = null;
    this._setMaterial(value);
  }
  get material() {
    return this._material;
  }

  set mapping(value) {
    if (this._type !== 'asset') return;

    this._unsetMaterialEvents();

    if (!value) value = {};
    this._mapping = value;
    if (!this._model) return;
    const meshInstances = this._model.meshInstances;
    const modelAsset = this.asset ? this.system.app.assets.get(this.asset) : null;
    const assetMapping = modelAsset ? modelAsset.data.mapping : null;
    let asset = null;
    for (let i = 0, len = meshInstances.length; i < len; i++) {
      if (value[i] !== undefined) {
        if (value[i]) {
          asset = this.system.app.assets.get(value[i]);
          this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
        } else {
          meshInstances[i].material = this.system.defaultMaterial;
        }
      } else if (assetMapping) {
        if (assetMapping[i] && (assetMapping[i].material || assetMapping[i].path)) {
          if (assetMapping[i].material !== undefined) {
            asset = this.system.app.assets.get(assetMapping[i].material);
          } else if (assetMapping[i].path !== undefined) {
            const url = this._getMaterialAssetUrl(assetMapping[i].path);
            if (url) {
              asset = this.system.app.assets.getByUrl(url);
            }
          }
          this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
        } else {
          meshInstances[i].material = this.system.defaultMaterial;
        }
      }
    }
  }
  get mapping() {
    return this._mapping;
  }
  addModelToLayers() {
    const layers = this.system.app.scene.layers;
    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(this.meshInstances);
      }
    }
  }
  removeModelFromLayers() {
    const layers = this.system.app.scene.layers;
    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (!layer) continue;
      layer.removeMeshInstances(this.meshInstances);
    }
  }
  onRemoveChild() {
    if (this._model) this.removeModelFromLayers();
  }
  onInsertChild() {
    if (this._model && this.enabled && this.entity.enabled) this.addModelToLayers();
  }
  onRemove() {
    this.asset = null;
    this.model = null;
    this.materialAsset = null;
    this._unsetMaterialEvents();
    this.entity.off('remove', this.onRemoveChild, this);
    this.entity.off('insert', this.onInsertChild, this);
  }

  onLayersChanged(oldComp, newComp) {
    this.addModelToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }

  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances(this.meshInstances);
  }

  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances(this.meshInstances);
  }

  _setMaterialEvent(index, event, id, handler) {
    const evt = event + ':' + id;
    this.system.app.assets.on(evt, handler, this);
    if (!this._materialEvents) this._materialEvents = [];
    if (!this._materialEvents[index]) this._materialEvents[index] = {};
    this._materialEvents[index][evt] = {
      id: id,
      handler: handler
    };
  }

  _unsetMaterialEvents() {
    const assets = this.system.app.assets;
    const events = this._materialEvents;
    if (!events) return;
    for (let i = 0, len = events.length; i < len; i++) {
      if (!events[i]) continue;
      const evt = events[i];
      for (const key in evt) {
        assets.off(key, evt[key].handler, this);
      }
    }
    this._materialEvents = null;
  }

  _getAssetByIdOrPath(idOrPath) {
    let asset = null;
    const isPath = isNaN(parseInt(idOrPath, 10));

    if (!isPath) {
      asset = this.system.app.assets.get(idOrPath);
    } else if (this.asset) {
      const url = this._getMaterialAssetUrl(idOrPath);
      if (url) asset = this.system.app.assets.getByUrl(url);
    }
    return asset;
  }

  _getMaterialAssetUrl(path) {
    if (!this.asset) return null;
    const modelAsset = this.system.app.assets.get(this.asset);
    return modelAsset ? modelAsset.getAbsoluteUrl(path) : null;
  }

  _loadAndSetMeshInstanceMaterial(materialAsset, meshInstance, index) {
    const assets = this.system.app.assets;
    if (!materialAsset) return;
    if (materialAsset.resource) {
      meshInstance.material = materialAsset.resource;
      this._setMaterialEvent(index, 'remove', materialAsset.id, function () {
        meshInstance.material = this.system.defaultMaterial;
      });
    } else {
      this._setMaterialEvent(index, 'load', materialAsset.id, function (asset) {
        meshInstance.material = asset.resource;
        this._setMaterialEvent(index, 'remove', materialAsset.id, function () {
          meshInstance.material = this.system.defaultMaterial;
        });
      });
      if (this.enabled && this.entity.enabled) assets.load(materialAsset);
    }
  }
  onEnable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.on('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this.onLayerAdded, this);
      scene.layers.on('remove', this.onLayerRemoved, this);
    }
    const isAsset = this._type === 'asset';
    let asset;
    if (this._model) {
      this.addModelToLayers();
    } else if (isAsset && this._asset) {
      asset = app.assets.get(this._asset);
      if (asset && asset.resource !== this._model) {
        this._bindModelAsset(asset);
      }
    }
    if (this._materialAsset) {
      asset = app.assets.get(this._materialAsset);
      if (asset && asset.resource !== this._material) {
        this._bindMaterialAsset(asset);
      }
    }
    if (isAsset) {
      if (this._mapping) {
        for (const index in this._mapping) {
          if (this._mapping[index]) {
            asset = this._getAssetByIdOrPath(this._mapping[index]);
            if (asset && !asset.resource) {
              app.assets.load(asset);
            }
          }
        }
      }
    }
    if (this._batchGroupId >= 0) {
      var _app$batcher;
      (_app$batcher = app.batcher) == null ? void 0 : _app$batcher.insert(BatchGroup.MODEL, this.batchGroupId, this.entity);
    }
  }
  onDisable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.off('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.off('add', this.onLayerAdded, this);
      scene.layers.off('remove', this.onLayerRemoved, this);
    }
    if (this._batchGroupId >= 0) {
      var _app$batcher2;
      (_app$batcher2 = app.batcher) == null ? void 0 : _app$batcher2.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
    }
    if (this._model) {
      this.removeModelFromLayers();
    }
  }

  hide() {
    if (this._model) {
      const instances = this._model.meshInstances;
      for (let i = 0, l = instances.length; i < l; i++) {
        instances[i].visible = false;
      }
    }
  }

  show() {
    if (this._model) {
      const instances = this._model.meshInstances;
      for (let i = 0, l = instances.length; i < l; i++) {
        instances[i].visible = true;
      }
    }
  }

  _bindMaterialAsset(asset) {
    asset.on('load', this._onMaterialAssetLoad, this);
    asset.on('unload', this._onMaterialAssetUnload, this);
    asset.on('remove', this._onMaterialAssetRemove, this);
    asset.on('change', this._onMaterialAssetChange, this);
    if (asset.resource) {
      this._onMaterialAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }

  _unbindMaterialAsset(asset) {
    asset.off('load', this._onMaterialAssetLoad, this);
    asset.off('unload', this._onMaterialAssetUnload, this);
    asset.off('remove', this._onMaterialAssetRemove, this);
    asset.off('change', this._onMaterialAssetChange, this);
  }

  _onMaterialAssetAdd(asset) {
    this.system.app.assets.off('add:' + asset.id, this._onMaterialAssetAdd, this);
    if (this._materialAsset === asset.id) {
      this._bindMaterialAsset(asset);
    }
  }

  _onMaterialAssetLoad(asset) {
    this._setMaterial(asset.resource);
  }

  _onMaterialAssetUnload(asset) {
    this._setMaterial(this.system.defaultMaterial);
  }

  _onMaterialAssetRemove(asset) {
    this._onMaterialAssetUnload(asset);
  }

  _onMaterialAssetChange(asset) {}

  _bindModelAsset(asset) {
    this._unbindModelAsset(asset);
    asset.on('load', this._onModelAssetLoad, this);
    asset.on('unload', this._onModelAssetUnload, this);
    asset.on('change', this._onModelAssetChange, this);
    asset.on('remove', this._onModelAssetRemove, this);
    if (asset.resource) {
      this._onModelAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }

  _unbindModelAsset(asset) {
    asset.off('load', this._onModelAssetLoad, this);
    asset.off('unload', this._onModelAssetUnload, this);
    asset.off('change', this._onModelAssetChange, this);
    asset.off('remove', this._onModelAssetRemove, this);
  }

  _onModelAssetAdded(asset) {
    this.system.app.assets.off('add:' + asset.id, this._onModelAssetAdded, this);
    if (asset.id === this._asset) {
      this._bindModelAsset(asset);
    }
  }

  _onModelAssetLoad(asset) {
    this.model = asset.resource.clone();
    this._clonedModel = true;
  }

  _onModelAssetUnload(asset) {
    this.model = null;
  }

  _onModelAssetChange(asset, attr, _new, _old) {
    if (attr === 'data') {
      this.mapping = this._mapping;
    }
  }

  _onModelAssetRemove(asset) {
    this.model = null;
  }

  _setMaterial(material) {
    if (this._material === material) return;
    this._material = material;
    const model = this._model;
    if (model && this._type !== 'asset') {
      const meshInstances = model.meshInstances;
      for (let i = 0, len = meshInstances.length; i < len; i++) {
        meshInstances[i].material = material;
      }
    }
  }
}

export { ModelComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbW9kZWwvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQge1xuICAgIExBWUVSSURfV09STERcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJhdGNoR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRTaGFwZVByaW1pdGl2ZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gTGF5ZXJDb21wb3NpdGlvbiAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfSBNYXRlcmlhbCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJykuQm91bmRpbmdCb3h9IEJvdW5kaW5nQm94ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLk1vZGVsQ29tcG9uZW50U3lzdGVtfSBNb2RlbENvbXBvbmVudFN5c3RlbSAqL1xuXG4vKipcbiAqIEVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciBhIG1vZGVsIG9yIGEgcHJpbWl0aXZlIHNoYXBlLiBUaGlzIENvbXBvbmVudCBhdHRhY2hlcyBhZGRpdGlvbmFsXG4gKiBtb2RlbCBnZW9tZXRyeSBpbiB0byB0aGUgc2NlbmUgZ3JhcGggYmVsb3cgdGhlIEVudGl0eS5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIE1vZGVsQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3R5cGUgPSAnYXNzZXQnO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Fzc2V0fG51bWJlcnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Fzc2V0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNb2RlbHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21vZGVsID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBudW1iZXI+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hcHBpbmcgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nhc3RTaGFkb3dzID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlY2VpdmVTaGFkb3dzID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbEFzc2V0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXRlcmlhbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nhc3RTaGFkb3dzTGlnaHRtYXAgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBwZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JhdGNoR3JvdXBJZCA9IC0xO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY3VzdG9tQWFiYiA9IG51bGw7XG5cbiAgICBfYXJlYSA9IG51bGw7XG5cbiAgICBfbWF0ZXJpYWxFdmVudHMgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2xvbmVkTW9kZWwgPSBmYWxzZTtcblxuICAgIC8vICNpZiBfREVCVUdcbiAgICBfYmF0Y2hHcm91cCA9IG51bGw7XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTW9kZWxDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01vZGVsQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG5cbiAgICAgICAgLy8gaGFuZGxlIGV2ZW50cyB3aGVuIHRoZSBlbnRpdHkgaXMgZGlyZWN0bHkgKG9yIGluZGlyZWN0bHkgYXMgYSBjaGlsZCBvZiBzdWItaGllcmFyY2h5KSBhZGRlZCBvciByZW1vdmVkIGZyb20gdGhlIHBhcmVudFxuICAgICAgICBlbnRpdHkub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlaGllcmFyY2h5JywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdpbnNlcnQnLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydGhpZXJhcmNoeScsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbWVzaEluc3RhbmNlcyBjb250YWluZWQgaW4gdGhlIGNvbXBvbmVudCdzIG1vZGVsLiBJZiBtb2RlbCBpcyBub3Qgc2V0IG9yIGxvYWRlZFxuICAgICAqIGZvciBjb21wb25lbnQgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNZXNoSW5zdGFuY2VbXXxudWxsfVxuICAgICAqL1xuICAgIHNldCBtZXNoSW5zdGFuY2VzKHZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBtZXNoSW5zdGFuY2VzKCkge1xuICAgICAgICBpZiAoIXRoaXMuX21vZGVsKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgc2V0LCB0aGUgb2JqZWN0IHNwYWNlIGJvdW5kaW5nIGJveCBpcyB1c2VkIGFzIGEgYm91bmRpbmcgYm94IGZvciB2aXNpYmlsaXR5IGN1bGxpbmcgb2ZcbiAgICAgKiBhdHRhY2hlZCBtZXNoIGluc3RhbmNlcy4gVGhpcyBpcyBhbiBvcHRpbWl6YXRpb24sIGFsbG93aW5nIG92ZXJzaXplZCBib3VuZGluZyBib3ggdG8gYmVcbiAgICAgKiBzcGVjaWZpZWQgZm9yIHNraW5uZWQgY2hhcmFjdGVycyBpbiBvcmRlciB0byBhdm9pZCBwZXIgZnJhbWUgYm91bmRpbmcgYm94IGNvbXB1dGF0aW9ucyBiYXNlZFxuICAgICAqIG9uIGJvbmUgcG9zaXRpb25zLlxuICAgICAqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fG51bGx9XG4gICAgICovXG4gICAgc2V0IGN1c3RvbUFhYmIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHNldCBpdCBvbiBtZXNoSW5zdGFuY2VzXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXN0b21BYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgbW9kZWwuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0gXCJhc3NldFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgbW9kZWwgYXNzZXRcbiAgICAgKiAtIFwiYm94XCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBib3ggKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwiY2Fwc3VsZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY2Fwc3VsZSAocmFkaXVzIDAuNSwgaGVpZ2h0IDIpXG4gICAgICogLSBcImNvbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNvbmUgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJjeWxpbmRlclwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY3lsaW5kZXIgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJwbGFuZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgcGxhbmUgKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwic3BoZXJlXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBzcGhlcmUgKHJhZGl1cyAwLjUpXG4gICAgICogLSBcInRvcnVzXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSB0b3J1cyAodHViZVJhZGl1czogMC4yLCByaW5nUmFkaXVzOiAwLjMpXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2FyZWEgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgPT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGdldCAvIGNyZWF0ZSBtZXNoIG9mIHR5cGVcbiAgICAgICAgICAgIGNvbnN0IHByaW1EYXRhID0gZ2V0U2hhcGVQcmltaXRpdmUodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzLl9hcmVhID0gcHJpbURhdGEuYXJlYTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBwcmltRGF0YS5tZXNoO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsLmdyYXBoID0gbm9kZTtcblxuICAgICAgICAgICAgbW9kZWwubWVzaEluc3RhbmNlcyA9IFtuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX21hdGVyaWFsLCBub2RlKV07XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXNzZXQgZm9yIHRoZSBtb2RlbCAob25seSBhcHBsaWVzIHRvIG1vZGVscyBvZiB0eXBlICdhc3NldCcpIGNhbiBhbHNvIGJlIGFuIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0fG51bWJlcnxudWxsfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCkge1xuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBwcmV2aW91cyBhc3NldFxuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uTW9kZWxBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNb2RlbEFzc2V0KF9wcmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9hc3NldCwgdGhpcy5fb25Nb2RlbEFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1vZGVsIHRoYXQgaXMgYWRkZWQgdG8gdGhlIHNjZW5lIGdyYXBoLiBJdCBjYW4gYmUgbm90IHNldCBvciBsb2FkZWQsIHNvIHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TW9kZWx9XG4gICAgICovXG4gICAgc2V0IG1vZGVsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gcmV0dXJuIGlmIHRoZSBtb2RlbCBoYXMgYmVlbiBmbGFnZ2VkIGFzIGltbXV0YWJsZVxuICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUuX2ltbXV0YWJsZSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBhc3NpZ24gYSBtb2RlbCB0byBtdWx0aXBsZSBNb2RlbENvbXBvbmVudHMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwuX2ltbXV0YWJsZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkucmVtb3ZlQ2hpbGQodGhpcy5fbW9kZWwuZ2V0R3JhcGgoKSk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWwuX2VudGl0eTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2Nsb25lZE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZWwuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2Nsb25lZE1vZGVsID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tb2RlbCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgLy8gZmxhZyB0aGUgbW9kZWwgYXMgYmVpbmcgYXNzaWduZWQgdG8gYSBjb21wb25lbnRcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLl9pbW11dGFibGUgPSB0cnVlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdGhpcy5fY2FzdFNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5yZWNlaXZlU2hhZG93ID0gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5pc1N0YXRpYyA9IHRoaXMuX2lzU3RhdGljO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5saWdodG1hcHBlZCA9IHRoaXMuX2xpZ2h0bWFwcGVkOyAvLyB1cGRhdGUgbWVzaEluc3RhbmNlc1xuXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5hZGRDaGlsZCh0aGlzLl9tb2RlbC5ncmFwaCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTdG9yZSB0aGUgZW50aXR5IHRoYXQgb3ducyB0aGlzIG1vZGVsXG4gICAgICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gdGhpcy5lbnRpdHk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBhbnkgYW5pbWF0aW9uIGNvbXBvbmVudFxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmFuaW1hdGlvbilcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5hbmltYXRpb24uc2V0TW9kZWwodGhpcy5fbW9kZWwpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgYW55IGFuaW0gY29tcG9uZW50XG4gICAgICAgICAgICBpZiAodGhpcy5lbnRpdHkuYW5pbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW50aXR5LmFuaW0ucmViaW5kKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGV2ZW50IGhhbmRsZXIgdG8gbG9hZCBtYXBwaW5nXG4gICAgICAgICAgICAvLyBmb3IgbmV3IG1vZGVsXG4gICAgICAgICAgICBpZiAodGhpcy50eXBlID09PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXBwaW5nID0gdGhpcy5fbWFwcGluZztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1vZGVsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGJlIGxpZ2h0bWFwcGVkIGFmdGVyIHVzaW5nIGxpZ2h0bWFwcGVyLmJha2UoKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2xpZ2h0bWFwcGVkKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0bWFwcGVkID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcHBlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGlzIG1vZGVsIHdpbGwgY2FzdCBzaGFkb3dzIGZvciBsaWdodHMgdGhhdCBoYXZlIHNoYWRvdyBjYXN0aW5nIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWw7XG5cbiAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICYmICF2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBtb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fY2FzdFNoYWRvd3MgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmFkZFNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBzaGFkb3dzIHdpbGwgYmUgY2FzdCBvbiB0aGlzIG1vZGVsLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHJlY2VpdmVTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWNlaXZlU2hhZG93cyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93cyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ucmVjZWl2ZVNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlY2VpdmVTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGNhc3Qgc2hhZG93cyB3aGVuIHJlbmRlcmluZyBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3NMaWdodG1hcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIG1vZGVsIGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGlzU3RhdGljKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc1N0YXRpYyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9pc1N0YXRpYyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgcmN2ID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmN2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbSA9IHJjdltpXTtcbiAgICAgICAgICAgICAgICBtLmlzU3RhdGljID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaXNTdGF0aWMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc1N0YXRpYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgbW9kZWwgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCwgcG9wLFxuICAgICAqIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcblxuICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgYWxsIG1lc2ggaW5zdGFuY2VzIGZyb20gb2xkIGxheWVyc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdGhlIGxheWVyIGxpc3RcbiAgICAgICAgdGhpcy5fbGF5ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXSA9IHZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZG9uJ3QgYWRkIGludG8gbGF5ZXJzIHVudGlsIHdlJ3JlIGVuYWJsZWRcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQgfHwgIXRoaXMubWVzaEluc3RhbmNlcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGFkZCBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gbmV3IGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIG1vZGVsIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLk1PREVMLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHZhbHVlID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5NT0RFTCwgdmFsdWUsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIHJlLWFkZCBtb2RlbCB0byBzY2VuZSwgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYmF0Y2hHcm91cElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCB7QGxpbmsgQXNzZXR9IHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciB0aGUgbW9kZWwgKG5vdCB1c2VkIG9uIG1vZGVscyBvZiB0eXBlXG4gICAgICogJ2Fzc2V0JykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsQXNzZXQodmFsdWUpIHtcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmIChfaWQgIT09IHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTWF0ZXJpYWxBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsQXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHtAbGluayBNYXRlcmlhbH0gdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtb2RlbCAobm90IHVzZWQgb24gbW9kZWxzIG9mXG4gICAgICogdHlwZSAnYXNzZXQnKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXRlcmlhbH1cbiAgICAgKi9cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsQXNzZXQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGRpY3Rpb25hcnkgdGhhdCBob2xkcyBtYXRlcmlhbCBvdmVycmlkZXMgZm9yIGVhY2ggbWVzaCBpbnN0YW5jZS4gT25seSBhcHBsaWVzIHRvIG1vZGVsXG4gICAgICogY29tcG9uZW50cyBvZiB0eXBlICdhc3NldCcuIFRoZSBtYXBwaW5nIGNvbnRhaW5zIHBhaXJzIG9mIG1lc2ggaW5zdGFuY2UgaW5kZXggLSBtYXRlcmlhbFxuICAgICAqIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIG51bWJlcj59XG4gICAgICovXG4gICAgc2V0IG1hcHBpbmcodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgIT09ICdhc3NldCcpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gdW5zdWJzY3JpYmUgZnJvbSBvbGQgZXZlbnRzXG4gICAgICAgIHRoaXMuX3Vuc2V0TWF0ZXJpYWxFdmVudHMoKTtcblxuICAgICAgICAvLyBjYW4ndCBoYXZlIGEgbnVsbCBtYXBwaW5nXG4gICAgICAgIGlmICghdmFsdWUpXG4gICAgICAgICAgICB2YWx1ZSA9IHt9O1xuXG4gICAgICAgIHRoaXMuX21hcHBpbmcgPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuX21vZGVsKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IG1vZGVsQXNzZXQgPSB0aGlzLmFzc2V0ID8gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5hc3NldCkgOiBudWxsO1xuICAgICAgICBjb25zdCBhc3NldE1hcHBpbmcgPSBtb2RlbEFzc2V0ID8gbW9kZWxBc3NldC5kYXRhLm1hcHBpbmcgOiBudWxsO1xuICAgICAgICBsZXQgYXNzZXQgPSBudWxsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodmFsdWVbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZVtpXSkge1xuICAgICAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHZhbHVlW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZEFuZFNldE1lc2hJbnN0YW5jZU1hdGVyaWFsKGFzc2V0LCBtZXNoSW5zdGFuY2VzW2ldLCBpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXNzZXRNYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0TWFwcGluZ1tpXSAmJiAoYXNzZXRNYXBwaW5nW2ldLm1hdGVyaWFsIHx8IGFzc2V0TWFwcGluZ1tpXS5wYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRNYXBwaW5nW2ldLm1hdGVyaWFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoYXNzZXRNYXBwaW5nW2ldLm1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhc3NldE1hcHBpbmdbaV0ucGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSB0aGlzLl9nZXRNYXRlcmlhbEFzc2V0VXJsKGFzc2V0TWFwcGluZ1tpXS5wYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cmwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0QnlVcmwodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwoYXNzZXQsIG1lc2hJbnN0YW5jZXNbaV0sIGkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hcHBpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXBwaW5nO1xuICAgIH1cblxuICAgIGFkZE1vZGVsVG9MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZU1vZGVsRnJvbUxheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblJlbW92ZUNoaWxkKCkge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuICAgIH1cblxuICAgIG9uSW5zZXJ0Q2hpbGQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Vuc2V0TWF0ZXJpYWxFdmVudHMoKTtcblxuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ3JlbW92ZScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZignaW5zZXJ0JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IG9sZENvbXAgLSBUaGUgb2xkIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gbmV3Q29tcCAtIFRoZSBuZXcgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnMoKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gVGhlIGxheWVyIHRoYXQgd2FzIGFkZGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gVGhlIGxheWVyIHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgaW5kZXggb2YgdGhlIG1lc2ggaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gVGhlIGFzc2V0IGlkLlxuICAgICAqIEBwYXJhbSB7Kn0gaGFuZGxlciAtIFRoZSBoYW5kbGVyIGZ1bmN0aW9uIHRvIGJlIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgZXZlbnQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0TWF0ZXJpYWxFdmVudChpbmRleCwgZXZlbnQsIGlkLCBoYW5kbGVyKSB7XG4gICAgICAgIGNvbnN0IGV2dCA9IGV2ZW50ICsgJzonICsgaWQ7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMub24oZXZ0LCBoYW5kbGVyLCB0aGlzKTtcblxuICAgICAgICBpZiAoIXRoaXMuX21hdGVyaWFsRXZlbnRzKVxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxFdmVudHMgPSBbXTtcblxuICAgICAgICBpZiAoIXRoaXMuX21hdGVyaWFsRXZlbnRzW2luZGV4XSlcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsRXZlbnRzW2luZGV4XSA9IHsgfTtcblxuICAgICAgICB0aGlzLl9tYXRlcmlhbEV2ZW50c1tpbmRleF1bZXZ0XSA9IHtcbiAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgIGhhbmRsZXI6IGhhbmRsZXJcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdW5zZXRNYXRlcmlhbEV2ZW50cygpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgY29uc3QgZXZlbnRzID0gdGhpcy5fbWF0ZXJpYWxFdmVudHM7XG4gICAgICAgIGlmICghZXZlbnRzKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBldmVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghZXZlbnRzW2ldKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IGV2dCA9IGV2ZW50c1tpXTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGV2dCkge1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoa2V5LCBldnRba2V5XS5oYW5kbGVyLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsRXZlbnRzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaWRPclBhdGggLSBUaGUgYXNzZXQgaWQgb3IgcGF0aC5cbiAgICAgKiBAcmV0dXJucyB7QXNzZXR8bnVsbH0gVGhlIGFzc2V0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldEFzc2V0QnlJZE9yUGF0aChpZE9yUGF0aCkge1xuICAgICAgICBsZXQgYXNzZXQgPSBudWxsO1xuICAgICAgICBjb25zdCBpc1BhdGggPSBpc05hTihwYXJzZUludChpZE9yUGF0aCwgMTApKTtcblxuICAgICAgICAvLyBnZXQgYXNzZXQgYnkgaWQgb3IgdXJsXG4gICAgICAgIGlmICghaXNQYXRoKSB7XG4gICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KGlkT3JQYXRoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSB0aGlzLl9nZXRNYXRlcmlhbEFzc2V0VXJsKGlkT3JQYXRoKTtcbiAgICAgICAgICAgIGlmICh1cmwpXG4gICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldEJ5VXJsKHVybCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGggLSBUaGUgcGF0aCBvZiB0aGUgbW9kZWwgYXNzZXQuXG4gICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBUaGUgbW9kZWwgYXNzZXQgVVJMIG9yIG51bGwgaWYgdGhlIGFzc2V0IGlzIG5vdCBpbiB0aGUgcmVnaXN0cnkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0TWF0ZXJpYWxBc3NldFVybChwYXRoKSB7XG4gICAgICAgIGlmICghdGhpcy5hc3NldCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgbW9kZWxBc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuYXNzZXQpO1xuXG4gICAgICAgIHJldHVybiBtb2RlbEFzc2V0ID8gbW9kZWxBc3NldC5nZXRBYnNvbHV0ZVVybChwYXRoKSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gbWF0ZXJpYWxBc3NldCAtVGhlIG1hdGVyaWFsIGFzc2V0IHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlIHRvIGFzc2lnbiB0aGUgbWF0ZXJpYWwgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gVGhlIGluZGV4IG9mIHRoZSBtZXNoIGluc3RhbmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbChtYXRlcmlhbEFzc2V0LCBtZXNoSW5zdGFuY2UsIGluZGV4KSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgaWYgKCFtYXRlcmlhbEFzc2V0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChtYXRlcmlhbEFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSBtYXRlcmlhbEFzc2V0LnJlc291cmNlO1xuXG4gICAgICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbEV2ZW50KGluZGV4LCAncmVtb3ZlJywgbWF0ZXJpYWxBc3NldC5pZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWxFdmVudChpbmRleCwgJ2xvYWQnLCBtYXRlcmlhbEFzc2V0LmlkLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSBhc3NldC5yZXNvdXJjZTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsRXZlbnQoaW5kZXgsICdyZW1vdmUnLCBtYXRlcmlhbEFzc2V0LmlkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpXG4gICAgICAgICAgICAgICAgYXNzZXRzLmxvYWQobWF0ZXJpYWxBc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNBc3NldCA9ICh0aGlzLl90eXBlID09PSAnYXNzZXQnKTtcblxuICAgICAgICBsZXQgYXNzZXQ7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNBc3NldCAmJiB0aGlzLl9hc3NldCkge1xuICAgICAgICAgICAgLy8gYmluZCBhbmQgbG9hZCBtb2RlbCBhc3NldCBpZiBuZWNlc3NhcnlcbiAgICAgICAgICAgIGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAvLyBiaW5kIGFuZCBsb2FkIG1hdGVyaWFsIGFzc2V0IGlmIG5lY2Vzc2FyeVxuICAgICAgICAgICAgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCAmJiBhc3NldC5yZXNvdXJjZSAhPT0gdGhpcy5fbWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNBc3NldCkge1xuICAgICAgICAgICAgLy8gYmluZCBtYXBwZWQgYXNzZXRzXG4gICAgICAgICAgICAvLyBUT0RPOiByZXBsYWNlXG4gICAgICAgICAgICBpZiAodGhpcy5fbWFwcGluZykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fbWFwcGluZykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWFwcGluZ1tpbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5fZ2V0QXNzZXRCeUlkT3JQYXRoKHRoaXMuX21hcHBpbmdbaW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuTU9ERUwsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLk1PREVMLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcCByZW5kZXJpbmcgbW9kZWwgd2l0aG91dCByZW1vdmluZyBpdCBmcm9tIHRoZSBzY2VuZSBoaWVyYXJjaHkuIFRoaXMgbWV0aG9kIHNldHMgdGhlXG4gICAgICoge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvZiBldmVyeSBNZXNoSW5zdGFuY2UgaW4gdGhlIG1vZGVsIHRvIGZhbHNlIE5vdGUsIHRoaXNcbiAgICAgKiBkb2VzIG5vdCByZW1vdmUgdGhlIG1vZGVsIG9yIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeSBvciBkcmF3IGNhbGwgbGlzdC4gU29cbiAgICAgKiB0aGUgbW9kZWwgY29tcG9uZW50IHN0aWxsIGluY3VycyBzb21lIENQVSBvdmVyaGVhZC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdGhpcy50aW1lciA9IDA7XG4gICAgICogdGhpcy52aXNpYmxlID0gdHJ1ZTtcbiAgICAgKiAvLyAuLi5cbiAgICAgKiAvLyBibGluayBtb2RlbCBldmVyeSAwLjEgc2Vjb25kc1xuICAgICAqIHRoaXMudGltZXIgKz0gZHQ7XG4gICAgICogaWYgKHRoaXMudGltZXIgPiAwLjEpIHtcbiAgICAgKiAgICAgaWYgKCF0aGlzLnZpc2libGUpIHtcbiAgICAgKiAgICAgICAgIHRoaXMuZW50aXR5Lm1vZGVsLnNob3coKTtcbiAgICAgKiAgICAgICAgIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgICogICAgIH0gZWxzZSB7XG4gICAgICogICAgICAgICB0aGlzLmVudGl0eS5tb2RlbC5oaWRlKCk7XG4gICAgICogICAgICAgICB0aGlzLnZpc2libGUgPSBmYWxzZTtcbiAgICAgKiAgICAgfVxuICAgICAqICAgICB0aGlzLnRpbWVyID0gMDtcbiAgICAgKiB9XG4gICAgICovXG4gICAgaGlkZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSByZW5kZXJpbmcgb2YgdGhlIG1vZGVsIGlmIGhpZGRlbiB1c2luZyB7QGxpbmsgTW9kZWxDb21wb25lbnQjaGlkZX0uIFRoaXMgbWV0aG9kIHNldHNcbiAgICAgKiBhbGwgdGhlIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZX0gcHJvcGVydHkgb24gYWxsIG1lc2ggaW5zdGFuY2VzIHRvIHRydWUuXG4gICAgICovXG4gICAgc2hvdygpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgdG8gYmluZCBldmVudHMgdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWF0ZXJpYWxBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgdG8gdW5iaW5kIGV2ZW50cyBmcm9tLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VuYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTWF0ZXJpYWxBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgYWRkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWF0ZXJpYWxBc3NldEFkZChhc3NldCkge1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25NYXRlcmlhbEFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQgPT09IGFzc2V0LmlkKSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBsb2FkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWF0ZXJpYWxBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWwoYXNzZXQucmVzb3VyY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IHVubG9hZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWwodGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCByZW1vdmUgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uTWF0ZXJpYWxBc3NldFVubG9hZChhc3NldCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgY2hhbmdlIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWF0ZXJpYWxBc3NldENoYW5nZShhc3NldCkge1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IHRvIGJpbmQgZXZlbnRzIHRvLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JpbmRNb2RlbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3VuYmluZE1vZGVsQXNzZXQoYXNzZXQpO1xuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25Nb2RlbEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk1vZGVsQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Nb2RlbEFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTW9kZWxBc3NldFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1vZGVsQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgdG8gdW5iaW5kIGV2ZW50cyBmcm9tLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VuYmluZE1vZGVsQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Nb2RlbEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25Nb2RlbEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vbk1vZGVsQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTW9kZWxBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgYWRkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldEFkZGVkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbk1vZGVsQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgIGlmIChhc3NldC5pZCA9PT0gdGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGxvYWQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb2RlbEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm1vZGVsID0gYXNzZXQucmVzb3VyY2UuY2xvbmUoKTtcbiAgICAgICAgdGhpcy5fY2xvbmVkTW9kZWwgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IHVubG9hZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgY2hhbmdlIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBhdHRyIC0gVGhlIGF0dHJpYnV0ZSB0aGF0IHdhcyBjaGFuZ2VkLlxuICAgICAqIEBwYXJhbSB7Kn0gX25ldyAtIFRoZSBuZXcgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0geyp9IF9vbGQgLSBUaGUgb2xkIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb2RlbEFzc2V0Q2hhbmdlKGFzc2V0LCBhdHRyLCBfbmV3LCBfb2xkKSB7XG4gICAgICAgIGlmIChhdHRyID09PSAnZGF0YScpIHtcbiAgICAgICAgICAgIHRoaXMubWFwcGluZyA9IHRoaXMuX21hcHBpbmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCByZW1vdmUgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb2RlbEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIGJlIHNldC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRNYXRlcmlhbChtYXRlcmlhbCkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IG1hdGVyaWFsKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbWF0ZXJpYWw7XG5cbiAgICAgICAgY29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbDtcbiAgICAgICAgaWYgKG1vZGVsICYmIHRoaXMuX3R5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBtb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IE1vZGVsQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiTW9kZWxDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl90eXBlIiwiX2Fzc2V0IiwiX21vZGVsIiwiX21hcHBpbmciLCJfY2FzdFNoYWRvd3MiLCJfcmVjZWl2ZVNoYWRvd3MiLCJfbWF0ZXJpYWxBc3NldCIsIl9tYXRlcmlhbCIsIl9jYXN0U2hhZG93c0xpZ2h0bWFwIiwiX2xpZ2h0bWFwcGVkIiwiX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJfaXNTdGF0aWMiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9iYXRjaEdyb3VwSWQiLCJfY3VzdG9tQWFiYiIsIl9hcmVhIiwiX21hdGVyaWFsRXZlbnRzIiwiX2Nsb25lZE1vZGVsIiwiX2JhdGNoR3JvdXAiLCJkZWZhdWx0TWF0ZXJpYWwiLCJvbiIsIm9uUmVtb3ZlQ2hpbGQiLCJvbkluc2VydENoaWxkIiwibWVzaEluc3RhbmNlcyIsInZhbHVlIiwiY3VzdG9tQWFiYiIsIm1pIiwiaSIsImxlbmd0aCIsInNldEN1c3RvbUFhYmIiLCJ0eXBlIiwiX2JpbmRNb2RlbEFzc2V0IiwibW9kZWwiLCJwcmltRGF0YSIsImdldFNoYXBlUHJpbWl0aXZlIiwiYXBwIiwiZ3JhcGhpY3NEZXZpY2UiLCJhcmVhIiwibWVzaCIsIm5vZGUiLCJHcmFwaE5vZGUiLCJNb2RlbCIsImdyYXBoIiwiTWVzaEluc3RhbmNlIiwiYXNzZXQiLCJhc3NldHMiLCJfaWQiLCJBc3NldCIsImlkIiwib2ZmIiwiX29uTW9kZWxBc3NldEFkZGVkIiwiX3ByZXYiLCJnZXQiLCJfdW5iaW5kTW9kZWxBc3NldCIsIl9pbW11dGFibGUiLCJEZWJ1ZyIsImVycm9yIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwicmVtb3ZlQ2hpbGQiLCJnZXRHcmFwaCIsIl9lbnRpdHkiLCJkZXN0cm95IiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJpc1N0YXRpYyIsImxpZ2h0bWFwcGVkIiwiYWRkQ2hpbGQiLCJlbmFibGVkIiwiYWRkTW9kZWxUb0xheWVycyIsImFuaW1hdGlvbiIsInNldE1vZGVsIiwiYW5pbSIsInJlYmluZCIsIm1hcHBpbmciLCJfdW5zZXRNYXRlcmlhbEV2ZW50cyIsInNldExpZ2h0bWFwcGVkIiwiY2FzdFNoYWRvd3MiLCJsYXllcnMiLCJzY2VuZSIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZWNlaXZlU2hhZG93cyIsImxlbiIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwicmN2IiwibSIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwiYmF0Y2hHcm91cElkIiwiYmF0Y2hlciIsInJlbW92ZSIsIkJhdGNoR3JvdXAiLCJNT0RFTCIsImluc2VydCIsIm1hdGVyaWFsQXNzZXQiLCJfb25NYXRlcmlhbEFzc2V0QWRkIiwiX3VuYmluZE1hdGVyaWFsQXNzZXQiLCJfc2V0TWF0ZXJpYWwiLCJfYmluZE1hdGVyaWFsQXNzZXQiLCJtYXRlcmlhbCIsIm1vZGVsQXNzZXQiLCJhc3NldE1hcHBpbmciLCJkYXRhIiwidW5kZWZpbmVkIiwiX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbCIsInBhdGgiLCJ1cmwiLCJfZ2V0TWF0ZXJpYWxBc3NldFVybCIsImdldEJ5VXJsIiwib25SZW1vdmUiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwiX3NldE1hdGVyaWFsRXZlbnQiLCJldmVudCIsImhhbmRsZXIiLCJldnQiLCJldmVudHMiLCJrZXkiLCJfZ2V0QXNzZXRCeUlkT3JQYXRoIiwiaWRPclBhdGgiLCJpc1BhdGgiLCJpc05hTiIsInBhcnNlSW50IiwiZ2V0QWJzb2x1dGVVcmwiLCJtZXNoSW5zdGFuY2UiLCJyZXNvdXJjZSIsImxvYWQiLCJvbkVuYWJsZSIsImlzQXNzZXQiLCJvbkRpc2FibGUiLCJoaWRlIiwiaW5zdGFuY2VzIiwibCIsInZpc2libGUiLCJzaG93IiwiX29uTWF0ZXJpYWxBc3NldExvYWQiLCJfb25NYXRlcmlhbEFzc2V0VW5sb2FkIiwiX29uTWF0ZXJpYWxBc3NldFJlbW92ZSIsIl9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UiLCJfb25Nb2RlbEFzc2V0TG9hZCIsIl9vbk1vZGVsQXNzZXRVbmxvYWQiLCJfb25Nb2RlbEFzc2V0Q2hhbmdlIiwiX29uTW9kZWxBc3NldFJlbW92ZSIsImNsb25lIiwiYXR0ciIsIl9uZXciLCJfb2xkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUEwQkEsTUFBTUEsY0FBYyxTQUFTQyxTQUFTLENB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
