/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { LAYERID_WORLD } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { getShapePrimitive } from '../../../scene/procedural.js';
import { Asset } from '../../../asset/asset.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbW9kZWwvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQge1xuICAgIExBWUVSSURfV09STERcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJhdGNoR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRTaGFwZVByaW1pdGl2ZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gTGF5ZXJDb21wb3NpdGlvbiAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfSBNYXRlcmlhbCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uLy4uL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fSBCb3VuZGluZ0JveCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gRW50aXR5ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5Nb2RlbENvbXBvbmVudFN5c3RlbX0gTW9kZWxDb21wb25lbnRTeXN0ZW0gKi9cblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSBtb2RlbCBvciBhIHByaW1pdGl2ZSBzaGFwZS4gVGhpcyBDb21wb25lbnQgYXR0YWNoZXMgYWRkaXRpb25hbFxuICogbW9kZWwgZ2VvbWV0cnkgaW4gdG8gdGhlIHNjZW5lIGdyYXBoIGJlbG93IHRoZSBFbnRpdHkuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBNb2RlbENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gJ2Fzc2V0JztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TW9kZWx8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tb2RlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgbnVtYmVyPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXBwaW5nID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYXN0U2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZWNlaXZlU2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0ZXJpYWx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYXN0U2hhZG93c0xpZ2h0bWFwID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xpZ2h0bWFwcGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSAxO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaXNTdGF0aWMgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sYXllcnMgPSBbTEFZRVJJRF9XT1JMRF07IC8vIGFzc2lnbiB0byB0aGUgZGVmYXVsdCB3b3JsZCBsYXllclxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9iYXRjaEdyb3VwSWQgPSAtMTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgX2FyZWEgPSBudWxsO1xuXG4gICAgX21hdGVyaWFsRXZlbnRzID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nsb25lZE1vZGVsID0gZmFsc2U7XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgX2JhdGNoR3JvdXAgPSBudWxsO1xuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1vZGVsQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNb2RlbENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBzeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuXG4gICAgICAgIC8vIGhhbmRsZSBldmVudHMgd2hlbiB0aGUgZW50aXR5IGlzIGRpcmVjdGx5IChvciBpbmRpcmVjdGx5IGFzIGEgY2hpbGQgb2Ygc3ViLWhpZXJhcmNoeSkgYWRkZWQgb3IgcmVtb3ZlZCBmcm9tIHRoZSBwYXJlbnRcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ3JlbW92ZWhpZXJhcmNoeScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdpbnNlcnRoaWVyYXJjaHknLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIG1lc2hJbnN0YW5jZXMgY29udGFpbmVkIGluIHRoZSBjb21wb25lbnQncyBtb2RlbC4gSWYgbW9kZWwgaXMgbm90IHNldCBvciBsb2FkZWRcbiAgICAgKiBmb3IgY29tcG9uZW50IGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW118bnVsbH1cbiAgICAgKi9cbiAgICBzZXQgbWVzaEluc3RhbmNlcyh2YWx1ZSkge1xuICAgICAgICBpZiAoIXRoaXMuX21vZGVsKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbWVzaEluc3RhbmNlcygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbClcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHNldCwgdGhlIG9iamVjdCBzcGFjZSBib3VuZGluZyBib3ggaXMgdXNlZCBhcyBhIGJvdW5kaW5nIGJveCBmb3IgdmlzaWJpbGl0eSBjdWxsaW5nIG9mXG4gICAgICogYXR0YWNoZWQgbWVzaCBpbnN0YW5jZXMuIFRoaXMgaXMgYW4gb3B0aW1pemF0aW9uLCBhbGxvd2luZyBvdmVyc2l6ZWQgYm91bmRpbmcgYm94IHRvIGJlXG4gICAgICogc3BlY2lmaWVkIGZvciBza2lubmVkIGNoYXJhY3RlcnMgaW4gb3JkZXIgdG8gYXZvaWQgcGVyIGZyYW1lIGJvdW5kaW5nIGJveCBjb21wdXRhdGlvbnMgYmFzZWRcbiAgICAgKiBvbiBib25lIHBvc2l0aW9ucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCb3VuZGluZ0JveHxudWxsfVxuICAgICAqL1xuICAgIHNldCBjdXN0b21BYWJiKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSB2YWx1ZTtcblxuICAgICAgICAvLyBzZXQgaXQgb24gbWVzaEluc3RhbmNlc1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY3VzdG9tQWFiYigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1c3RvbUFhYmI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIG1vZGVsLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIFwiYXNzZXRcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIG1vZGVsIGFzc2V0XG4gICAgICogLSBcImJveFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgYm94ICgxIHVuaXQgaW4gZWFjaCBkaW1lbnNpb24pXG4gICAgICogLSBcImNhcHN1bGVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNhcHN1bGUgKHJhZGl1cyAwLjUsIGhlaWdodCAyKVxuICAgICAqIC0gXCJjb25lXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBjb25lIChyYWRpdXMgMC41LCBoZWlnaHQgMSlcbiAgICAgKiAtIFwiY3lsaW5kZXJcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGN5bGluZGVyIChyYWRpdXMgMC41LCBoZWlnaHQgMSlcbiAgICAgKiAtIFwicGxhbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHBsYW5lICgxIHVuaXQgaW4gZWFjaCBkaW1lbnNpb24pXG4gICAgICogLSBcInNwaGVyZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgc3BoZXJlIChyYWRpdXMgMC41KVxuICAgICAqIC0gXCJ0b3J1c1wiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgdG9ydXMgKHR1YmVSYWRpdXM6IDAuMiwgcmluZ1JhZGl1czogMC4zKVxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgdHlwZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9hcmVhID0gbnVsbDtcblxuICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYXNzZXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTW9kZWxBc3NldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBnZXQgLyBjcmVhdGUgbWVzaCBvZiB0eXBlXG4gICAgICAgICAgICBjb25zdCBwcmltRGF0YSA9IGdldFNoYXBlUHJpbWl0aXZlKHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZSwgdmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5fYXJlYSA9IHByaW1EYXRhLmFyZWE7XG4gICAgICAgICAgICBjb25zdCBtZXNoID0gcHJpbURhdGEubWVzaDtcblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gbmV3IE1vZGVsKCk7XG4gICAgICAgICAgICBtb2RlbC5ncmFwaCA9IG5vZGU7XG5cbiAgICAgICAgICAgIG1vZGVsLm1lc2hJbnN0YW5jZXMgPSBbbmV3IE1lc2hJbnN0YW5jZShtZXNoLCB0aGlzLl9tYXRlcmlhbCwgbm9kZSldO1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG4gICAgICAgICAgICB0aGlzLl9hc3NldCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGZvciB0aGUgbW9kZWwgKG9ubHkgYXBwbGllcyB0byBtb2RlbHMgb2YgdHlwZSAnYXNzZXQnKSBjYW4gYWxzbyBiZSBhbiBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ8bnVsbH1cbiAgICAgKi9cbiAgICBzZXQgYXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldCAhPT0gX2lkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyByZW1vdmUgcHJldmlvdXMgYXNzZXRcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX2Fzc2V0LCB0aGlzLl9vbk1vZGVsQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgX3ByZXYgPSBhc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTW9kZWxBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9hc3NldCA9IF9pZDtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2Fzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub24oJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uTW9kZWxBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTW9kZWxBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtb2RlbCB0aGF0IGlzIGFkZGVkIHRvIHRoZSBzY2VuZSBncmFwaC4gSXQgY2FuIGJlIG5vdCBzZXQgb3IgbG9hZGVkLCBzbyB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge01vZGVsfVxuICAgICAqL1xuICAgIHNldCBtb2RlbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIHJldHVybiBpZiB0aGUgbW9kZWwgaGFzIGJlZW4gZmxhZ2dlZCBhcyBpbW11dGFibGVcbiAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLl9pbW11dGFibGUpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdJbnZhbGlkIGF0dGVtcHQgdG8gYXNzaWduIGEgbW9kZWwgdG8gbXVsdGlwbGUgTW9kZWxDb21wb25lbnRzJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLl9pbW11dGFibGUgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnJlbW92ZUNoaWxkKHRoaXMuX21vZGVsLmdldEdyYXBoKCkpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX21vZGVsLl9lbnRpdHk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9jbG9uZWRNb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21vZGVsLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jbG9uZWRNb2RlbCA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbW9kZWwgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIC8vIGZsYWcgdGhlIG1vZGVsIGFzIGJlaW5nIGFzc2lnbmVkIHRvIGEgY29tcG9uZW50XG4gICAgICAgICAgICB0aGlzLl9tb2RlbC5faW1tdXRhYmxlID0gdHJ1ZTtcblxuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uY2FzdFNoYWRvdyA9IHRoaXMuX2Nhc3RTaGFkb3dzO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ucmVjZWl2ZVNoYWRvdyA9IHRoaXMuX3JlY2VpdmVTaGFkb3dzO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uaXNTdGF0aWMgPSB0aGlzLl9pc1N0YXRpYztcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLnNldEN1c3RvbUFhYmIodGhpcy5fY3VzdG9tQWFiYik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBwZWQgPSB0aGlzLl9saWdodG1hcHBlZDsgLy8gdXBkYXRlIG1lc2hJbnN0YW5jZXNcblxuICAgICAgICAgICAgdGhpcy5lbnRpdHkuYWRkQ2hpbGQodGhpcy5fbW9kZWwuZ3JhcGgpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnMoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU3RvcmUgdGhlIGVudGl0eSB0aGF0IG93bnMgdGhpcyBtb2RlbFxuICAgICAgICAgICAgdGhpcy5fbW9kZWwuX2VudGl0eSA9IHRoaXMuZW50aXR5O1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgYW55IGFuaW1hdGlvbiBjb21wb25lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLmVudGl0eS5hbmltYXRpb24pXG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuYW5pbWF0aW9uLnNldE1vZGVsKHRoaXMuX21vZGVsKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIGFueSBhbmltIGNvbXBvbmVudFxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmFuaW0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5hbmltLnJlYmluZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gdHJpZ2dlciBldmVudCBoYW5kbGVyIHRvIGxvYWQgbWFwcGluZ1xuICAgICAgICAgICAgLy8gZm9yIG5ldyBtb2RlbFxuICAgICAgICAgICAgaWYgKHRoaXMudHlwZSA9PT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgICAgIHRoaXMubWFwcGluZyA9IHRoaXMuX21hcHBpbmc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Vuc2V0TWF0ZXJpYWxFdmVudHMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtb2RlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoaXMgbW9kZWwgd2lsbCBiZSBsaWdodG1hcHBlZCBhZnRlciB1c2luZyBsaWdodG1hcHBlci5iYWtlKCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbGlnaHRtYXBwZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9saWdodG1hcHBlZCkge1xuXG4gICAgICAgICAgICB0aGlzLl9saWdodG1hcHBlZCA9IHZhbHVlO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5zZXRMaWdodG1hcHBlZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwcGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBwZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGNhc3Qgc2hhZG93cyBmb3IgbGlnaHRzIHRoYXQgaGF2ZSBzaGFkb3cgY2FzdGluZyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNhc3RTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsO1xuXG4gICAgICAgIGlmIChtb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5sYXllcnM7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyAmJiAhdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZVNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uY2FzdFNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX2Nhc3RTaGFkb3dzICYmIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBzY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBsYXllci5hZGRTaGFkb3dDYXN0ZXJzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgc2hhZG93cyB3aWxsIGJlIGNhc3Qgb24gdGhpcyBtb2RlbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCByZWNlaXZlU2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fcmVjZWl2ZVNoYWRvd3MgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvd3MgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLnJlY2VpdmVTaGFkb3cgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZWNlaXZlU2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY2VpdmVTaGFkb3dzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoaXMgbW9kZWwgd2lsbCBjYXN0IHNoYWRvd3Mgd2hlbiByZW5kZXJpbmcgbGlnaHRtYXBzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3NMaWdodG1hcCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93c0xpZ2h0bWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3NMaWdodG1hcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaWdodG1hcCByZXNvbHV0aW9uIG11bHRpcGxpZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBTaXplTXVsdGlwbGllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayBtb2RlbCBhcyBub24tbW92YWJsZSAob3B0aW1pemF0aW9uKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBpc1N0YXRpYyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faXNTdGF0aWMgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5faXNTdGF0aWMgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IHJjdiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJjdi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG0gPSByY3ZbaV07XG4gICAgICAgICAgICAgICAgbS5pc1N0YXRpYyA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGlzU3RhdGljKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNTdGF0aWM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbGF5ZXIgSURzICh7QGxpbmsgTGF5ZXIjaWR9KSB0byB3aGljaCB0aGlzIG1vZGVsIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gsIHBvcCxcbiAgICAgKiBzcGxpY2Ugb3IgbW9kaWZ5IHRoaXMgYXJyYXksIGlmIHlvdSB3YW50IHRvIGNoYW5nZSBpdCAtIHNldCBhIG5ldyBvbmUgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgbGF5ZXJzKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnM7XG5cbiAgICAgICAgaWYgKHRoaXMubWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGFsbCBtZXNoIGluc3RhbmNlcyBmcm9tIG9sZCBsYXllcnNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHRoZSBsYXllciBsaXN0XG4gICAgICAgIHRoaXMuX2xheWVycy5sZW5ndGggPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXllcnNbaV0gPSB2YWx1ZVtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRvbid0IGFkZCBpbnRvIGxheWVycyB1bnRpbCB3ZSdyZSBlbmFibGVkXG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkIHx8ICF0aGlzLm1lc2hJbnN0YW5jZXMpIHJldHVybjtcblxuICAgICAgICAvLyBhZGQgYWxsIG1lc2ggaW5zdGFuY2VzIHRvIG5ldyBsYXllcnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBtb2RlbCB0byBhIHNwZWNpZmljIGJhdGNoIGdyb3VwIChzZWUge0BsaW5rIEJhdGNoR3JvdXB9KS4gRGVmYXVsdCBpcyAtMSAobm8gZ3JvdXApLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYmF0Y2hHcm91cElkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5NT0RFTCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB2YWx1ZSA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuTU9ERUwsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUgPCAwICYmIHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAvLyByZS1hZGQgbW9kZWwgdG8gc2NlbmUsIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cElkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGJhdGNoR3JvdXBJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoR3JvdXBJZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF0ZXJpYWwge0BsaW5rIEFzc2V0fSB0aGF0IHdpbGwgYmUgdXNlZCB0byByZW5kZXIgdGhlIG1vZGVsIChub3QgdXNlZCBvbiBtb2RlbHMgb2YgdHlwZVxuICAgICAqICdhc3NldCcpLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0fG51bWJlcnxudWxsfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbEFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGxldCBfaWQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAoX2lkICE9PSB0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fbWF0ZXJpYWxBc3NldCwgdGhpcy5fb25NYXRlcmlhbEFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKF9wcmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZE1hdGVyaWFsQXNzZXQoX3ByZXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IF9pZDtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbCh0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub24oJ2FkZDonICsgdGhpcy5fbWF0ZXJpYWxBc3NldCwgdGhpcy5fb25NYXRlcmlhbEFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbCh0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbEFzc2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCB7QGxpbmsgTWF0ZXJpYWx9IHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciB0aGUgbW9kZWwgKG5vdCB1c2VkIG9uIG1vZGVscyBvZlxuICAgICAqIHR5cGUgJ2Fzc2V0JykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0ZXJpYWx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbCh2YWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBkaWN0aW9uYXJ5IHRoYXQgaG9sZHMgbWF0ZXJpYWwgb3ZlcnJpZGVzIGZvciBlYWNoIG1lc2ggaW5zdGFuY2UuIE9ubHkgYXBwbGllcyB0byBtb2RlbFxuICAgICAqIGNvbXBvbmVudHMgb2YgdHlwZSAnYXNzZXQnLiBUaGUgbWFwcGluZyBjb250YWlucyBwYWlycyBvZiBtZXNoIGluc3RhbmNlIGluZGV4IC0gbWF0ZXJpYWxcbiAgICAgKiBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBudW1iZXI+fVxuICAgICAqL1xuICAgIHNldCBtYXBwaW5nKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlICE9PSAnYXNzZXQnKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gb2xkIGV2ZW50c1xuICAgICAgICB0aGlzLl91bnNldE1hdGVyaWFsRXZlbnRzKCk7XG5cbiAgICAgICAgLy8gY2FuJ3QgaGF2ZSBhIG51bGwgbWFwcGluZ1xuICAgICAgICBpZiAoIXZhbHVlKVxuICAgICAgICAgICAgdmFsdWUgPSB7fTtcblxuICAgICAgICB0aGlzLl9tYXBwaW5nID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBtb2RlbEFzc2V0ID0gdGhpcy5hc3NldCA/IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuYXNzZXQpIDogbnVsbDtcbiAgICAgICAgY29uc3QgYXNzZXRNYXBwaW5nID0gbW9kZWxBc3NldCA/IG1vZGVsQXNzZXQuZGF0YS5tYXBwaW5nIDogbnVsbDtcbiAgICAgICAgbGV0IGFzc2V0ID0gbnVsbDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKHZhbHVlW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWVbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh2YWx1ZVtpXSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbChhc3NldCwgbWVzaEluc3RhbmNlc1tpXSwgaSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFzc2V0TWFwcGluZykge1xuICAgICAgICAgICAgICAgIGlmIChhc3NldE1hcHBpbmdbaV0gJiYgKGFzc2V0TWFwcGluZ1tpXS5tYXRlcmlhbCB8fCBhc3NldE1hcHBpbmdbaV0ucGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0TWFwcGluZ1tpXS5tYXRlcmlhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KGFzc2V0TWFwcGluZ1tpXS5tYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYXNzZXRNYXBwaW5nW2ldLnBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXJsID0gdGhpcy5fZ2V0TWF0ZXJpYWxBc3NldFVybChhc3NldE1hcHBpbmdbaV0ucGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldEJ5VXJsKHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZEFuZFNldE1lc2hJbnN0YW5jZU1hdGVyaWFsKGFzc2V0LCBtZXNoSW5zdGFuY2VzW2ldLCBpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXBwaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFwcGluZztcbiAgICB9XG5cbiAgICBhZGRNb2RlbFRvTGF5ZXJzKCkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVNb2RlbEZyb21MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmVDaGlsZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKVxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICBvbkluc2VydENoaWxkKCkge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpXG4gICAgICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnMoKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICB0aGlzLm1hdGVyaWFsQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl91bnNldE1hdGVyaWFsRXZlbnRzKCk7XG5cbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBvbGRDb21wIC0gVGhlIG9sZCBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IG5ld0NvbXAgLSBUaGUgbmV3IGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIFRoZSBsYXllciB0aGF0IHdhcyBhZGRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIFRoZSBsYXllciB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gVGhlIGluZGV4IG9mIHRoZSBtZXNoIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCAtIFRoZSBhc3NldCBpZC5cbiAgICAgKiBAcGFyYW0geyp9IGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBiZSBib3VuZCB0byB0aGUgc3BlY2lmaWVkIGV2ZW50LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldE1hdGVyaWFsRXZlbnQoaW5kZXgsIGV2ZW50LCBpZCwgaGFuZGxlcikge1xuICAgICAgICBjb25zdCBldnQgPSBldmVudCArICc6JyArIGlkO1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLm9uKGV2dCwgaGFuZGxlciwgdGhpcyk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9tYXRlcmlhbEV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsRXZlbnRzID0gW107XG5cbiAgICAgICAgaWYgKCF0aGlzLl9tYXRlcmlhbEV2ZW50c1tpbmRleF0pXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEV2ZW50c1tpbmRleF0gPSB7IH07XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxFdmVudHNbaW5kZXhdW2V2dF0gPSB7XG4gICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3Vuc2V0TWF0ZXJpYWxFdmVudHMoKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuX21hdGVyaWFsRXZlbnRzO1xuICAgICAgICBpZiAoIWV2ZW50cylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZXZlbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWV2ZW50c1tpXSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBldnQgPSBldmVudHNbaV07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBldnQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKGtleSwgZXZ0W2tleV0uaGFuZGxlciwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXRlcmlhbEV2ZW50cyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlkT3JQYXRoIC0gVGhlIGFzc2V0IGlkIG9yIHBhdGguXG4gICAgICogQHJldHVybnMge0Fzc2V0fG51bGx9IFRoZSBhc3NldC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRBc3NldEJ5SWRPclBhdGgoaWRPclBhdGgpIHtcbiAgICAgICAgbGV0IGFzc2V0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgaXNQYXRoID0gaXNOYU4ocGFyc2VJbnQoaWRPclBhdGgsIDEwKSk7XG5cbiAgICAgICAgLy8gZ2V0IGFzc2V0IGJ5IGlkIG9yIHVybFxuICAgICAgICBpZiAoIWlzUGF0aCkge1xuICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChpZE9yUGF0aCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5hc3NldCkge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gdGhpcy5fZ2V0TWF0ZXJpYWxBc3NldFVybChpZE9yUGF0aCk7XG4gICAgICAgICAgICBpZiAodXJsKVxuICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXRCeVVybCh1cmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFzc2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIC0gVGhlIHBhdGggb2YgdGhlIG1vZGVsIGFzc2V0LlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gVGhlIG1vZGVsIGFzc2V0IFVSTCBvciBudWxsIGlmIHRoZSBhc3NldCBpcyBub3QgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldE1hdGVyaWFsQXNzZXRVcmwocGF0aCkge1xuICAgICAgICBpZiAoIXRoaXMuYXNzZXQpIHJldHVybiBudWxsO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsQXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLmFzc2V0KTtcblxuICAgICAgICByZXR1cm4gbW9kZWxBc3NldCA/IG1vZGVsQXNzZXQuZ2V0QWJzb2x1dGVVcmwocGF0aCkgOiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IG1hdGVyaWFsQXNzZXQgLVRoZSBtYXRlcmlhbCBhc3NldCB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlfSBtZXNoSW5zdGFuY2UgLSBUaGUgbWVzaCBpbnN0YW5jZSB0byBhc3NpZ24gdGhlIG1hdGVyaWFsIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgbWVzaCBpbnN0YW5jZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwobWF0ZXJpYWxBc3NldCwgbWVzaEluc3RhbmNlLCBpbmRleCkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmICghbWF0ZXJpYWxBc3NldClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobWF0ZXJpYWxBc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWxBc3NldC5yZXNvdXJjZTtcblxuICAgICAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWxFdmVudChpbmRleCwgJ3JlbW92ZScsIG1hdGVyaWFsQXNzZXQuaWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsRXZlbnQoaW5kZXgsICdsb2FkJywgbWF0ZXJpYWxBc3NldC5pZCwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gYXNzZXQucmVzb3VyY2U7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbEV2ZW50KGluZGV4LCAncmVtb3ZlJywgbWF0ZXJpYWxBc3NldC5pZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKVxuICAgICAgICAgICAgICAgIGFzc2V0cy5sb2FkKG1hdGVyaWFsQXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzQXNzZXQgPSAodGhpcy5fdHlwZSA9PT0gJ2Fzc2V0Jyk7XG5cbiAgICAgICAgbGV0IGFzc2V0O1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQXNzZXQgJiYgdGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgIC8vIGJpbmQgYW5kIGxvYWQgbW9kZWwgYXNzZXQgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgICBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCAmJiBhc3NldC5yZXNvdXJjZSAhPT0gdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTW9kZWxBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgLy8gYmluZCBhbmQgbG9hZCBtYXRlcmlhbCBhc3NldCBpZiBuZWNlc3NhcnlcbiAgICAgICAgICAgIGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX21hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzQXNzZXQpIHtcbiAgICAgICAgICAgIC8vIGJpbmQgbWFwcGVkIGFzc2V0c1xuICAgICAgICAgICAgLy8gVE9ETzogcmVwbGFjZVxuICAgICAgICAgICAgaWYgKHRoaXMuX21hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX21hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX21hcHBpbmdbaW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuX2dldEFzc2V0QnlJZE9yUGF0aCh0aGlzLl9tYXBwaW5nW2luZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXQgJiYgIWFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLk1PREVMLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIGFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5NT0RFTCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3AgcmVuZGVyaW5nIG1vZGVsIHdpdGhvdXQgcmVtb3ZpbmcgaXQgZnJvbSB0aGUgc2NlbmUgaGllcmFyY2h5LiBUaGlzIG1ldGhvZCBzZXRzIHRoZVxuICAgICAqIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZX0gcHJvcGVydHkgb2YgZXZlcnkgTWVzaEluc3RhbmNlIGluIHRoZSBtb2RlbCB0byBmYWxzZSBOb3RlLCB0aGlzXG4gICAgICogZG9lcyBub3QgcmVtb3ZlIHRoZSBtb2RlbCBvciBtZXNoIGluc3RhbmNlcyBmcm9tIHRoZSBzY2VuZSBoaWVyYXJjaHkgb3IgZHJhdyBjYWxsIGxpc3QuIFNvXG4gICAgICogdGhlIG1vZGVsIGNvbXBvbmVudCBzdGlsbCBpbmN1cnMgc29tZSBDUFUgb3ZlcmhlYWQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHRoaXMudGltZXIgPSAwO1xuICAgICAqIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgICogLy8gLi4uXG4gICAgICogLy8gYmxpbmsgbW9kZWwgZXZlcnkgMC4xIHNlY29uZHNcbiAgICAgKiB0aGlzLnRpbWVyICs9IGR0O1xuICAgICAqIGlmICh0aGlzLnRpbWVyID4gMC4xKSB7XG4gICAgICogICAgIGlmICghdGhpcy52aXNpYmxlKSB7XG4gICAgICogICAgICAgICB0aGlzLmVudGl0eS5tb2RlbC5zaG93KCk7XG4gICAgICogICAgICAgICB0aGlzLnZpc2libGUgPSB0cnVlO1xuICAgICAqICAgICB9IGVsc2Uge1xuICAgICAqICAgICAgICAgdGhpcy5lbnRpdHkubW9kZWwuaGlkZSgpO1xuICAgICAqICAgICAgICAgdGhpcy52aXNpYmxlID0gZmFsc2U7XG4gICAgICogICAgIH1cbiAgICAgKiAgICAgdGhpcy50aW1lciA9IDA7XG4gICAgICogfVxuICAgICAqL1xuICAgIGhpZGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIG9mIHRoZSBtb2RlbCBpZiBoaWRkZW4gdXNpbmcge0BsaW5rIE1vZGVsQ29tcG9uZW50I2hpZGV9LiBUaGlzIG1ldGhvZCBzZXRzXG4gICAgICogYWxsIHRoZSB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGV9IHByb3BlcnR5IG9uIGFsbCBtZXNoIGluc3RhbmNlcyB0byB0cnVlLlxuICAgICAqL1xuICAgIHNob3coKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IHRvIGJpbmQgZXZlbnRzIHRvLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTWF0ZXJpYWxBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IHRvIHVuYmluZCBldmVudHMgZnJvbS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91bmJpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGFkZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRBZGQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uTWF0ZXJpYWxBc3NldEFkZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgbG9hZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCB1bmxvYWQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgcmVtb3ZlIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWF0ZXJpYWxBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbk1hdGVyaWFsQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGNoYW5nZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCB0byBiaW5kIGV2ZW50cyB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9iaW5kTW9kZWxBc3NldChhc3NldCkge1xuICAgICAgICB0aGlzLl91bmJpbmRNb2RlbEFzc2V0KGFzc2V0KTtcblxuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25Nb2RlbEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTW9kZWxBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbk1vZGVsQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25Nb2RlbEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IHRvIHVuYmluZCBldmVudHMgZnJvbS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91bmJpbmRNb2RlbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25Nb2RlbEFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1vZGVsQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGFkZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25Nb2RlbEFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAoYXNzZXQuaWQgPT09IHRoaXMuX2Fzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kTW9kZWxBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBsb2FkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tb2RlbCA9IGFzc2V0LnJlc291cmNlLmNsb25lKCk7XG4gICAgICAgIHRoaXMuX2Nsb25lZE1vZGVsID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCB1bmxvYWQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb2RlbEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGNoYW5nZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYXR0ciAtIFRoZSBhdHRyaWJ1dGUgdGhhdCB3YXMgY2hhbmdlZC5cbiAgICAgKiBAcGFyYW0geyp9IF9uZXcgLSBUaGUgbmV3IHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHsqfSBfb2xkIC0gVGhlIG9sZCB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldENoYW5nZShhc3NldCwgYXR0ciwgX25ldywgX29sZCkge1xuICAgICAgICBpZiAoYXR0ciA9PT0gJ2RhdGEnKSB7XG4gICAgICAgICAgICB0aGlzLm1hcHBpbmcgPSB0aGlzLl9tYXBwaW5nO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgcmVtb3ZlIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB0byBiZSBzZXQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0TWF0ZXJpYWwobWF0ZXJpYWwpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsID09PSBtYXRlcmlhbClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IG1hdGVyaWFsO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWw7XG4gICAgICAgIGlmIChtb2RlbCAmJiB0aGlzLl90eXBlICE9PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBNb2RlbENvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIk1vZGVsQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdHlwZSIsIl9hc3NldCIsIl9tb2RlbCIsIl9tYXBwaW5nIiwiX2Nhc3RTaGFkb3dzIiwiX3JlY2VpdmVTaGFkb3dzIiwiX21hdGVyaWFsQXNzZXQiLCJfbWF0ZXJpYWwiLCJfY2FzdFNoYWRvd3NMaWdodG1hcCIsIl9saWdodG1hcHBlZCIsIl9saWdodG1hcFNpemVNdWx0aXBsaWVyIiwiX2lzU3RhdGljIiwiX2xheWVycyIsIkxBWUVSSURfV09STEQiLCJfYmF0Y2hHcm91cElkIiwiX2N1c3RvbUFhYmIiLCJfYXJlYSIsIl9tYXRlcmlhbEV2ZW50cyIsIl9jbG9uZWRNb2RlbCIsIl9iYXRjaEdyb3VwIiwiZGVmYXVsdE1hdGVyaWFsIiwib24iLCJvblJlbW92ZUNoaWxkIiwib25JbnNlcnRDaGlsZCIsIm1lc2hJbnN0YW5jZXMiLCJ2YWx1ZSIsImN1c3RvbUFhYmIiLCJtaSIsImkiLCJsZW5ndGgiLCJzZXRDdXN0b21BYWJiIiwidHlwZSIsIl9iaW5kTW9kZWxBc3NldCIsIm1vZGVsIiwicHJpbURhdGEiLCJnZXRTaGFwZVByaW1pdGl2ZSIsImFwcCIsImdyYXBoaWNzRGV2aWNlIiwiYXJlYSIsIm1lc2giLCJub2RlIiwiR3JhcGhOb2RlIiwiTW9kZWwiLCJncmFwaCIsIk1lc2hJbnN0YW5jZSIsImFzc2V0IiwiYXNzZXRzIiwiX2lkIiwiQXNzZXQiLCJpZCIsIm9mZiIsIl9vbk1vZGVsQXNzZXRBZGRlZCIsIl9wcmV2IiwiZ2V0IiwiX3VuYmluZE1vZGVsQXNzZXQiLCJfaW1tdXRhYmxlIiwiRGVidWciLCJlcnJvciIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsInJlbW92ZUNoaWxkIiwiZ2V0R3JhcGgiLCJfZW50aXR5IiwiZGVzdHJveSIsImNhc3RTaGFkb3ciLCJyZWNlaXZlU2hhZG93IiwiaXNTdGF0aWMiLCJsaWdodG1hcHBlZCIsImFkZENoaWxkIiwiZW5hYmxlZCIsImFkZE1vZGVsVG9MYXllcnMiLCJhbmltYXRpb24iLCJzZXRNb2RlbCIsImFuaW0iLCJyZWJpbmQiLCJtYXBwaW5nIiwiX3Vuc2V0TWF0ZXJpYWxFdmVudHMiLCJzZXRMaWdodG1hcHBlZCIsImNhc3RTaGFkb3dzIiwibGF5ZXJzIiwic2NlbmUiLCJsYXllciIsImdldExheWVyQnlJZCIsInJlbW92ZVNoYWRvd0Nhc3RlcnMiLCJhZGRTaGFkb3dDYXN0ZXJzIiwicmVjZWl2ZVNoYWRvd3MiLCJsZW4iLCJjYXN0U2hhZG93c0xpZ2h0bWFwIiwibGlnaHRtYXBTaXplTXVsdGlwbGllciIsInJjdiIsIm0iLCJyZW1vdmVNZXNoSW5zdGFuY2VzIiwiYWRkTWVzaEluc3RhbmNlcyIsImJhdGNoR3JvdXBJZCIsImJhdGNoZXIiLCJyZW1vdmUiLCJCYXRjaEdyb3VwIiwiTU9ERUwiLCJpbnNlcnQiLCJtYXRlcmlhbEFzc2V0IiwiX29uTWF0ZXJpYWxBc3NldEFkZCIsIl91bmJpbmRNYXRlcmlhbEFzc2V0IiwiX3NldE1hdGVyaWFsIiwiX2JpbmRNYXRlcmlhbEFzc2V0IiwibWF0ZXJpYWwiLCJtb2RlbEFzc2V0IiwiYXNzZXRNYXBwaW5nIiwiZGF0YSIsInVuZGVmaW5lZCIsIl9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwiLCJwYXRoIiwidXJsIiwiX2dldE1hdGVyaWFsQXNzZXRVcmwiLCJnZXRCeVVybCIsIm9uUmVtb3ZlIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaW5kZXhPZiIsIl9zZXRNYXRlcmlhbEV2ZW50IiwiZXZlbnQiLCJoYW5kbGVyIiwiZXZ0IiwiZXZlbnRzIiwia2V5IiwiX2dldEFzc2V0QnlJZE9yUGF0aCIsImlkT3JQYXRoIiwiaXNQYXRoIiwiaXNOYU4iLCJwYXJzZUludCIsImdldEFic29sdXRlVXJsIiwibWVzaEluc3RhbmNlIiwicmVzb3VyY2UiLCJsb2FkIiwib25FbmFibGUiLCJpc0Fzc2V0Iiwib25EaXNhYmxlIiwiaGlkZSIsImluc3RhbmNlcyIsImwiLCJ2aXNpYmxlIiwic2hvdyIsIl9vbk1hdGVyaWFsQXNzZXRMb2FkIiwiX29uTWF0ZXJpYWxBc3NldFVubG9hZCIsIl9vbk1hdGVyaWFsQXNzZXRSZW1vdmUiLCJfb25NYXRlcmlhbEFzc2V0Q2hhbmdlIiwiX29uTW9kZWxBc3NldExvYWQiLCJfb25Nb2RlbEFzc2V0VW5sb2FkIiwiX29uTW9kZWxBc3NldENoYW5nZSIsIl9vbk1vZGVsQXNzZXRSZW1vdmUiLCJjbG9uZSIsImF0dHIiLCJfbmV3IiwiX29sZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBMEJBLE1BQU1BLGNBQU4sU0FBNkJDLFNBQTdCLENB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
