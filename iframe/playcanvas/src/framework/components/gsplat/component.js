import { LAYERID_WORLD } from '../../../scene/constants.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';

class GSplatComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this._layers = [LAYERID_WORLD];
    this._instance = null;
    this._customAabb = null;
    this._assetReference = void 0;
    this._materialOptions = null;
    this._assetReference = new AssetReference('asset', this, system.app.assets, {
      add: this._onGSplatAssetAdded,
      load: this._onGSplatAssetLoad,
      remove: this._onGSplatAssetRemove,
      unload: this._onGSplatAssetUnload
    }, this);
    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }
  set customAabb(value) {
    var _this$_instance;
    this._customAabb = value;
    (_this$_instance = this._instance) == null || (_this$_instance = _this$_instance.meshInstance) == null || _this$_instance.setCustomAabb(this._customAabb);
  }
  get customAabb() {
    return this._customAabb;
  }
  set instance(value) {
    var _this$_instance2;
    this.destroyInstance();
    this._instance = value;
    if ((_this$_instance2 = this._instance) != null && _this$_instance2.meshInstance) {
      const mi = this._instance.meshInstance;
      if (!mi.node) {
        mi.node = this.entity;
      }
      mi.setCustomAabb(this._customAabb);
      if (this._materialOptions) {
        this._instance.createMaterial(this._materialOptions);
      }
      if (this.enabled && this.entity.enabled) {
        this.addToLayers();
      }
    }
  }
  get instance() {
    return this._instance;
  }
  set materialOptions(value) {
    this._materialOptions = Object.assign({}, value);
    if (this._instance) {
      this._instance.createMaterial(this._materialOptions);
    }
  }
  get materialOptions() {
    return this._materialOptions;
  }
  get material() {
    var _this$_instance3;
    return (_this$_instance3 = this._instance) == null ? void 0 : _this$_instance3.material;
  }
  set layers(value) {
    this.removeFromLayers();
    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }
    if (!this.enabled || !this.entity.enabled) return;
    this.addToLayers();
  }
  get layers() {
    return this._layers;
  }
  set asset(value) {
    const id = value instanceof Asset ? value.id : value;
    if (this._assetReference.id === id) return;
    if (this._assetReference.asset && this._assetReference.asset.resource) {
      this._onGSplatAssetRemove();
    }
    this._assetReference.id = id;
    if (this._assetReference.asset) {
      this._onGSplatAssetAdded();
    }
  }
  get asset() {
    return this._assetReference.id;
  }
  assignAsset(asset) {
    const id = asset instanceof Asset ? asset.id : asset;
    this._assetReference.id = id;
  }
  destroyInstance() {
    if (this._instance) {
      var _this$_instance4;
      this.removeFromLayers();
      (_this$_instance4 = this._instance) == null || _this$_instance4.destroy();
      this._instance = null;
    }
  }
  addToLayers() {
    var _this$instance;
    const meshInstance = (_this$instance = this.instance) == null ? void 0 : _this$instance.meshInstance;
    if (meshInstance) {
      const layers = this.system.app.scene.layers;
      for (let i = 0; i < this._layers.length; i++) {
        var _layers$getLayerById;
        (_layers$getLayerById = layers.getLayerById(this._layers[i])) == null || _layers$getLayerById.addMeshInstances([meshInstance]);
      }
    }
  }
  removeFromLayers() {
    var _this$instance2;
    const meshInstance = (_this$instance2 = this.instance) == null ? void 0 : _this$instance2.meshInstance;
    if (meshInstance) {
      const layers = this.system.app.scene.layers;
      for (let i = 0; i < this._layers.length; i++) {
        var _layers$getLayerById2;
        (_layers$getLayerById2 = layers.getLayerById(this._layers[i])) == null || _layers$getLayerById2.removeMeshInstances([meshInstance]);
      }
    }
  }
  onRemoveChild() {
    this.removeFromLayers();
  }
  onInsertChild() {
    if (this._instance && this.enabled && this.entity.enabled) {
      this.addToLayers();
    }
  }
  onRemove() {
    this.destroyInstance();
    this.asset = null;
    this._assetReference.id = null;
    this.entity.off('remove', this.onRemoveChild, this);
    this.entity.off('insert', this.onInsertChild, this);
  }
  onLayersChanged(oldComp, newComp) {
    this.addToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    if (this._instance) {
      layer.addMeshInstances(this._instance.meshInstance);
    }
  }
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    if (this._instance) {
      layer.removeMeshInstances(this._instance.meshInstance);
    }
  }
  onEnable() {
    const scene = this.system.app.scene;
    scene.on('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this.onLayerAdded, this);
      scene.layers.on('remove', this.onLayerRemoved, this);
    }
    if (this._instance) {
      this.addToLayers();
    } else if (this.asset) {
      this._onGSplatAssetAdded();
    }
  }
  onDisable() {
    const scene = this.system.app.scene;
    scene.off('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.off('add', this.onLayerAdded, this);
      scene.layers.off('remove', this.onLayerRemoved, this);
    }
    this.removeFromLayers();
  }
  hide() {
    if (this._instance) {
      this._instance.meshInstance.visible = false;
    }
  }
  show() {
    if (this._instance) {
      this._instance.meshInstance.visible = true;
    }
  }
  _onGSplatAssetAdded() {
    if (!this._assetReference.asset) return;
    if (this._assetReference.asset.resource) {
      this._onGSplatAssetLoad();
    } else if (this.enabled && this.entity.enabled) {
      this.system.app.assets.load(this._assetReference.asset);
    }
  }
  _onGSplatAssetLoad() {
    this.destroyInstance();
    const asset = this._assetReference.asset;
    if (asset) {
      this.instance = asset.resource.createInstance();
    }
  }
  _onGSplatAssetUnload() {
    this.destroyInstance();
  }
  _onGSplatAssetRemove() {
    this._onGSplatAssetUnload();
  }
}

export { GSplatComponent };
