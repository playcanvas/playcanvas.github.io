/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

/**
 * Enables an Entity to render a model or a primitive shape. This Component attaches additional
 * model geometry in to the scene graph below the Entity.
 *
 * @augments Component
 */
class ModelComponent extends Component {
  /**
   * @type {string}
   * @private
   */

  /**
   * @type {Asset|number|null}
   * @private
   */

  /**
   * @type {Model|null}
   * @private
   */

  /**
   * @type {Object<string, number>}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {Asset|number|null}
   * @private
   */

  /**
   * @type {import('../../../scene/materials/material.js').Material}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {number[]}
   * @private
   */
  // assign to the default world layer

  /**
   * @type {number}
   * @private
   */

  /**
   * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * Create a new ModelComponent instance.
   *
   * @param {import('./system.js').ModelComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
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

    // handle events when the entity is directly (or indirectly as a child of sub-hierarchy) added or removed from the parent
    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }

  /**
   * An array of meshInstances contained in the component's model. If model is not set or loaded
   * for component it will return null.
   *
   * @type {MeshInstance[]|null}
   */
  set meshInstances(value) {
    if (!this._model) return;
    this._model.meshInstances = value;
  }
  get meshInstances() {
    if (!this._model) return null;
    return this._model.meshInstances;
  }

  /**
   * If set, the object space bounding box is used as a bounding box for visibility culling of
   * attached mesh instances. This is an optimization, allowing oversized bounding box to be
   * specified for skinned characters in order to avoid per frame bounding box computations based
   * on bone positions.
   *
   * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
   */
  set customAabb(value) {
    this._customAabb = value;

    // set it on meshInstances
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

  /**
   * The type of the model. Can be:
   *
   * - "asset": The component will render a model asset
   * - "box": The component will render a box (1 unit in each dimension)
   * - "capsule": The component will render a capsule (radius 0.5, height 2)
   * - "cone": The component will render a cone (radius 0.5, height 1)
   * - "cylinder": The component will render a cylinder (radius 0.5, height 1)
   * - "plane": The component will render a plane (1 unit in each dimension)
   * - "sphere": The component will render a sphere (radius 0.5)
   * - "torus": The component will render a torus (tubeRadius: 0.2, ringRadius: 0.3)
   *
   * @type {string}
   */
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
      // get / create mesh of type
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

  /**
   * The asset for the model (only applies to models of type 'asset') can also be an asset id.
   *
   * @type {Asset|number|null}
   */
  set asset(value) {
    const assets = this.system.app.assets;
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    if (this._asset !== _id) {
      if (this._asset) {
        // remove previous asset
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

  /**
   * The model that is added to the scene graph. It can be not set or loaded, so will return null.
   *
   * @type {Model}
   */
  set model(value) {
    if (this._model === value) return;

    // return if the model has been flagged as immutable
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
      // flag the model as being assigned to a component
      this._model._immutable = true;
      const meshInstances = this._model.meshInstances;
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].castShadow = this._castShadows;
        meshInstances[i].receiveShadow = this._receiveShadows;
        meshInstances[i].isStatic = this._isStatic;
        meshInstances[i].setCustomAabb(this._customAabb);
      }
      this.lightmapped = this._lightmapped; // update meshInstances

      this.entity.addChild(this._model.graph);
      if (this.enabled && this.entity.enabled) {
        this.addModelToLayers();
      }

      // Store the entity that owns this model
      this._model._entity = this.entity;

      // Update any animation component
      if (this.entity.animation) this.entity.animation.setModel(this._model);

      // Update any anim component
      if (this.entity.anim) {
        this.entity.anim.rebind();
      }
      // trigger event handler to load mapping
      // for new model
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

  /**
   * If true, this model will be lightmapped after using lightmapper.bake().
   *
   * @type {boolean}
   */
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

  /**
   * If true, this model will cast shadows for lights that have shadow casting enabled.
   *
   * @type {boolean}
   */
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

  /**
   * If true, shadows will be cast on this model.
   *
   * @type {boolean}
   */
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

  /**
   * If true, this model will cast shadows when rendering lightmaps.
   *
   * @type {boolean}
   */
  set castShadowsLightmap(value) {
    this._castShadowsLightmap = value;
  }
  get castShadowsLightmap() {
    return this._castShadowsLightmap;
  }

  /**
   * Lightmap resolution multiplier.
   *
   * @type {number}
   */
  set lightmapSizeMultiplier(value) {
    this._lightmapSizeMultiplier = value;
  }
  get lightmapSizeMultiplier() {
    return this._lightmapSizeMultiplier;
  }

  /**
   * Mark model as non-movable (optimization).
   *
   * @type {boolean}
   */
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

  /**
   * An array of layer IDs ({@link Layer#id}) to which this model should belong. Don't push, pop,
   * splice or modify this array, if you want to change it - set a new one instead.
   *
   * @type {number[]}
   */
  set layers(value) {
    const layers = this.system.app.scene.layers;
    if (this.meshInstances) {
      // remove all mesh instances from old layers
      for (let i = 0; i < this._layers.length; i++) {
        const layer = layers.getLayerById(this._layers[i]);
        if (!layer) continue;
        layer.removeMeshInstances(this.meshInstances);
      }
    }

    // set the layer list
    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }

    // don't add into layers until we're enabled
    if (!this.enabled || !this.entity.enabled || !this.meshInstances) return;

    // add all mesh instances to new layers
    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (!layer) continue;
      layer.addMeshInstances(this.meshInstances);
    }
  }
  get layers() {
    return this._layers;
  }

  /**
   * Assign model to a specific batch group (see {@link BatchGroup}). Default is -1 (no group).
   *
   * @type {number}
   */
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
      // re-add model to scene, in case it was removed by batching
      this.addModelToLayers();
    }
    this._batchGroupId = value;
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  /**
   * The material {@link Asset} that will be used to render the model (not used on models of type
   * 'asset').
   *
   * @type {Asset|number|null}
   */
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

  /**
   * The material {@link Material} that will be used to render the model (not used on models of
   * type 'asset').
   *
   * @type {import('../../../scene/materials/material.js').Material}
   */
  set material(value) {
    if (this._material === value) return;
    this.materialAsset = null;
    this._setMaterial(value);
  }
  get material() {
    return this._material;
  }

  /**
   * A dictionary that holds material overrides for each mesh instance. Only applies to model
   * components of type 'asset'. The mapping contains pairs of mesh instance index - material
   * asset id.
   *
   * @type {Object<string, number>}
   */
  set mapping(value) {
    if (this._type !== 'asset') return;

    // unsubscribe from old events
    this._unsetMaterialEvents();

    // can't have a null mapping
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

  /**
   * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} oldComp - The
   * old layer composition.
   * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} newComp - The
   * new layer composition.
   * @private
   */
  onLayersChanged(oldComp, newComp) {
    this.addModelToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }

  /**
   * @param {Layer} layer - The layer that was added.
   * @private
   */
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances(this.meshInstances);
  }

  /**
   * @param {Layer} layer - The layer that was removed.
   * @private
   */
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances(this.meshInstances);
  }

  /**
   * @param {number} index - The index of the mesh instance.
   * @param {string} event - The event name.
   * @param {number} id - The asset id.
   * @param {*} handler - The handler function to be bound to the specified event.
   * @private
   */
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

  /** @private */
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

  /**
   * @param {string} idOrPath - The asset id or path.
   * @returns {Asset|null} The asset.
   * @private
   */
  _getAssetByIdOrPath(idOrPath) {
    let asset = null;
    const isPath = isNaN(parseInt(idOrPath, 10));

    // get asset by id or url
    if (!isPath) {
      asset = this.system.app.assets.get(idOrPath);
    } else if (this.asset) {
      const url = this._getMaterialAssetUrl(idOrPath);
      if (url) asset = this.system.app.assets.getByUrl(url);
    }
    return asset;
  }

  /**
   * @param {string} path - The path of the model asset.
   * @returns {string|null} The model asset URL or null if the asset is not in the registry.
   * @private
   */
  _getMaterialAssetUrl(path) {
    if (!this.asset) return null;
    const modelAsset = this.system.app.assets.get(this.asset);
    return modelAsset ? modelAsset.getAbsoluteUrl(path) : null;
  }

  /**
   * @param {Asset} materialAsset -The material asset to load.
   * @param {MeshInstance} meshInstance - The mesh instance to assign the material to.
   * @param {number} index - The index of the mesh instance.
   * @private
   */
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
      // bind and load model asset if necessary
      asset = app.assets.get(this._asset);
      if (asset && asset.resource !== this._model) {
        this._bindModelAsset(asset);
      }
    }
    if (this._materialAsset) {
      // bind and load material asset if necessary
      asset = app.assets.get(this._materialAsset);
      if (asset && asset.resource !== this._material) {
        this._bindMaterialAsset(asset);
      }
    }
    if (isAsset) {
      // bind mapped assets
      // TODO: replace
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

  /**
   * Stop rendering model without removing it from the scene hierarchy. This method sets the
   * {@link MeshInstance#visible} property of every MeshInstance in the model to false Note, this
   * does not remove the model or mesh instances from the scene hierarchy or draw call list. So
   * the model component still incurs some CPU overhead.
   *
   * @example
   * this.timer = 0;
   * this.visible = true;
   * // ...
   * // blink model every 0.1 seconds
   * this.timer += dt;
   * if (this.timer > 0.1) {
   *     if (!this.visible) {
   *         this.entity.model.show();
   *         this.visible = true;
   *     } else {
   *         this.entity.model.hide();
   *         this.visible = false;
   *     }
   *     this.timer = 0;
   * }
   */
  hide() {
    if (this._model) {
      const instances = this._model.meshInstances;
      for (let i = 0, l = instances.length; i < l; i++) {
        instances[i].visible = false;
      }
    }
  }

  /**
   * Enable rendering of the model if hidden using {@link ModelComponent#hide}. This method sets
   * all the {@link MeshInstance#visible} property on all mesh instances to true.
   */
  show() {
    if (this._model) {
      const instances = this._model.meshInstances;
      for (let i = 0, l = instances.length; i < l; i++) {
        instances[i].visible = true;
      }
    }
  }

  /**
   * @param {Asset} asset - The material asset to bind events to.
   * @private
   */
  _bindMaterialAsset(asset) {
    asset.on('load', this._onMaterialAssetLoad, this);
    asset.on('unload', this._onMaterialAssetUnload, this);
    asset.on('remove', this._onMaterialAssetRemove, this);
    asset.on('change', this._onMaterialAssetChange, this);
    if (asset.resource) {
      this._onMaterialAssetLoad(asset);
    } else {
      // don't trigger an asset load unless the component is enabled
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }

  /**
   * @param {Asset} asset - The material asset to unbind events from.
   * @private
   */
  _unbindMaterialAsset(asset) {
    asset.off('load', this._onMaterialAssetLoad, this);
    asset.off('unload', this._onMaterialAssetUnload, this);
    asset.off('remove', this._onMaterialAssetRemove, this);
    asset.off('change', this._onMaterialAssetChange, this);
  }

  /**
   * @param {Asset} asset - The material asset on which an asset add event has been fired.
   * @private
   */
  _onMaterialAssetAdd(asset) {
    this.system.app.assets.off('add:' + asset.id, this._onMaterialAssetAdd, this);
    if (this._materialAsset === asset.id) {
      this._bindMaterialAsset(asset);
    }
  }

  /**
   * @param {Asset} asset - The material asset on which an asset load event has been fired.
   * @private
   */
  _onMaterialAssetLoad(asset) {
    this._setMaterial(asset.resource);
  }

  /**
   * @param {Asset} asset - The material asset on which an asset unload event has been fired.
   * @private
   */
  _onMaterialAssetUnload(asset) {
    this._setMaterial(this.system.defaultMaterial);
  }

  /**
   * @param {Asset} asset - The material asset on which an asset remove event has been fired.
   * @private
   */
  _onMaterialAssetRemove(asset) {
    this._onMaterialAssetUnload(asset);
  }

  /**
   * @param {Asset} asset - The material asset on which an asset change event has been fired.
   * @private
   */
  _onMaterialAssetChange(asset) {}

  /**
   * @param {Asset} asset - The model asset to bind events to.
   * @private
   */
  _bindModelAsset(asset) {
    this._unbindModelAsset(asset);
    asset.on('load', this._onModelAssetLoad, this);
    asset.on('unload', this._onModelAssetUnload, this);
    asset.on('change', this._onModelAssetChange, this);
    asset.on('remove', this._onModelAssetRemove, this);
    if (asset.resource) {
      this._onModelAssetLoad(asset);
    } else {
      // don't trigger an asset load unless the component is enabled
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }

  /**
   * @param {Asset} asset - The model asset to unbind events from.
   * @private
   */
  _unbindModelAsset(asset) {
    asset.off('load', this._onModelAssetLoad, this);
    asset.off('unload', this._onModelAssetUnload, this);
    asset.off('change', this._onModelAssetChange, this);
    asset.off('remove', this._onModelAssetRemove, this);
  }

  /**
   * @param {Asset} asset - The model asset on which an asset add event has been fired.
   * @private
   */
  _onModelAssetAdded(asset) {
    this.system.app.assets.off('add:' + asset.id, this._onModelAssetAdded, this);
    if (asset.id === this._asset) {
      this._bindModelAsset(asset);
    }
  }

  /**
   * @param {Asset} asset - The model asset on which an asset load event has been fired.
   * @private
   */
  _onModelAssetLoad(asset) {
    this.model = asset.resource.clone();
    this._clonedModel = true;
  }

  /**
   * @param {Asset} asset - The model asset on which an asset unload event has been fired.
   * @private
   */
  _onModelAssetUnload(asset) {
    this.model = null;
  }

  /**
   * @param {Asset} asset - The model asset on which an asset change event has been fired.
   * @param {string} attr - The attribute that was changed.
   * @param {*} _new - The new value of the attribute.
   * @param {*} _old - The old value of the attribute.
   * @private
   */
  _onModelAssetChange(asset, attr, _new, _old) {
    if (attr === 'data') {
      this.mapping = this._mapping;
    }
  }

  /**
   * @param {Asset} asset - The model asset on which an asset remove event has been fired.
   * @private
   */
  _onModelAssetRemove(asset) {
    this.model = null;
  }

  /**
   * @param {import('../../../scene/materials/material.js').Material} material - The material to
   * be set.
   * @private
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbW9kZWwvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQge1xuICAgIExBWUVSSURfV09STERcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJhdGNoR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRTaGFwZVByaW1pdGl2ZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSBtb2RlbCBvciBhIHByaW1pdGl2ZSBzaGFwZS4gVGhpcyBDb21wb25lbnQgYXR0YWNoZXMgYWRkaXRpb25hbFxuICogbW9kZWwgZ2VvbWV0cnkgaW4gdG8gdGhlIHNjZW5lIGdyYXBoIGJlbG93IHRoZSBFbnRpdHkuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBNb2RlbENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gJ2Fzc2V0JztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TW9kZWx8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tb2RlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgbnVtYmVyPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXBwaW5nID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYXN0U2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZWNlaXZlU2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nhc3RTaGFkb3dzTGlnaHRtYXAgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBwZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JhdGNoR3JvdXBJZCA9IC0xO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgX2FyZWEgPSBudWxsO1xuXG4gICAgX21hdGVyaWFsRXZlbnRzID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nsb25lZE1vZGVsID0gZmFsc2U7XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgX2JhdGNoR3JvdXAgPSBudWxsO1xuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1vZGVsQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuTW9kZWxDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcblxuICAgICAgICAvLyBoYW5kbGUgZXZlbnRzIHdoZW4gdGhlIGVudGl0eSBpcyBkaXJlY3RseSAob3IgaW5kaXJlY3RseSBhcyBhIGNoaWxkIG9mIHN1Yi1oaWVyYXJjaHkpIGFkZGVkIG9yIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmVoaWVyYXJjaHknLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0aGllcmFyY2h5JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBtZXNoSW5zdGFuY2VzIGNvbnRhaW5lZCBpbiB0aGUgY29tcG9uZW50J3MgbW9kZWwuIElmIG1vZGVsIGlzIG5vdCBzZXQgb3IgbG9hZGVkXG4gICAgICogZm9yIGNvbXBvbmVudCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge01lc2hJbnN0YW5jZVtdfG51bGx9XG4gICAgICovXG4gICAgc2V0IG1lc2hJbnN0YW5jZXModmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG1lc2hJbnN0YW5jZXMoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQsIHRoZSBvYmplY3Qgc3BhY2UgYm91bmRpbmcgYm94IGlzIHVzZWQgYXMgYSBib3VuZGluZyBib3ggZm9yIHZpc2liaWxpdHkgY3VsbGluZyBvZlxuICAgICAqIGF0dGFjaGVkIG1lc2ggaW5zdGFuY2VzLiBUaGlzIGlzIGFuIG9wdGltaXphdGlvbiwgYWxsb3dpbmcgb3ZlcnNpemVkIGJvdW5kaW5nIGJveCB0byBiZVxuICAgICAqIHNwZWNpZmllZCBmb3Igc2tpbm5lZCBjaGFyYWN0ZXJzIGluIG9yZGVyIHRvIGF2b2lkIHBlciBmcmFtZSBib3VuZGluZyBib3ggY29tcHV0YXRpb25zIGJhc2VkXG4gICAgICogb24gYm9uZSBwb3NpdGlvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fG51bGx9XG4gICAgICovXG4gICAgc2V0IGN1c3RvbUFhYmIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHNldCBpdCBvbiBtZXNoSW5zdGFuY2VzXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXN0b21BYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgbW9kZWwuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0gXCJhc3NldFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgbW9kZWwgYXNzZXRcbiAgICAgKiAtIFwiYm94XCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBib3ggKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwiY2Fwc3VsZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY2Fwc3VsZSAocmFkaXVzIDAuNSwgaGVpZ2h0IDIpXG4gICAgICogLSBcImNvbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNvbmUgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJjeWxpbmRlclwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY3lsaW5kZXIgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJwbGFuZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgcGxhbmUgKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwic3BoZXJlXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBzcGhlcmUgKHJhZGl1cyAwLjUpXG4gICAgICogLSBcInRvcnVzXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSB0b3J1cyAodHViZVJhZGl1czogMC4yLCByaW5nUmFkaXVzOiAwLjMpXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2FyZWEgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgPT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGdldCAvIGNyZWF0ZSBtZXNoIG9mIHR5cGVcbiAgICAgICAgICAgIGNvbnN0IHByaW1EYXRhID0gZ2V0U2hhcGVQcmltaXRpdmUodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzLl9hcmVhID0gcHJpbURhdGEuYXJlYTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBwcmltRGF0YS5tZXNoO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsLmdyYXBoID0gbm9kZTtcblxuICAgICAgICAgICAgbW9kZWwubWVzaEluc3RhbmNlcyA9IFtuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX21hdGVyaWFsLCBub2RlKV07XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXNzZXQgZm9yIHRoZSBtb2RlbCAob25seSBhcHBsaWVzIHRvIG1vZGVscyBvZiB0eXBlICdhc3NldCcpIGNhbiBhbHNvIGJlIGFuIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0fG51bWJlcnxudWxsfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCkge1xuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBwcmV2aW91cyBhc3NldFxuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uTW9kZWxBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNb2RlbEFzc2V0KF9wcmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9hc3NldCwgdGhpcy5fb25Nb2RlbEFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1vZGVsIHRoYXQgaXMgYWRkZWQgdG8gdGhlIHNjZW5lIGdyYXBoLiBJdCBjYW4gYmUgbm90IHNldCBvciBsb2FkZWQsIHNvIHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TW9kZWx9XG4gICAgICovXG4gICAgc2V0IG1vZGVsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gcmV0dXJuIGlmIHRoZSBtb2RlbCBoYXMgYmVlbiBmbGFnZ2VkIGFzIGltbXV0YWJsZVxuICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUuX2ltbXV0YWJsZSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBhc3NpZ24gYSBtb2RlbCB0byBtdWx0aXBsZSBNb2RlbENvbXBvbmVudHMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwuX2ltbXV0YWJsZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkucmVtb3ZlQ2hpbGQodGhpcy5fbW9kZWwuZ2V0R3JhcGgoKSk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWwuX2VudGl0eTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2Nsb25lZE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZWwuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2Nsb25lZE1vZGVsID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tb2RlbCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgLy8gZmxhZyB0aGUgbW9kZWwgYXMgYmVpbmcgYXNzaWduZWQgdG8gYSBjb21wb25lbnRcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLl9pbW11dGFibGUgPSB0cnVlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdGhpcy5fY2FzdFNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5yZWNlaXZlU2hhZG93ID0gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5pc1N0YXRpYyA9IHRoaXMuX2lzU3RhdGljO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5saWdodG1hcHBlZCA9IHRoaXMuX2xpZ2h0bWFwcGVkOyAvLyB1cGRhdGUgbWVzaEluc3RhbmNlc1xuXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5hZGRDaGlsZCh0aGlzLl9tb2RlbC5ncmFwaCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTdG9yZSB0aGUgZW50aXR5IHRoYXQgb3ducyB0aGlzIG1vZGVsXG4gICAgICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gdGhpcy5lbnRpdHk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBhbnkgYW5pbWF0aW9uIGNvbXBvbmVudFxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmFuaW1hdGlvbilcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5hbmltYXRpb24uc2V0TW9kZWwodGhpcy5fbW9kZWwpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgYW55IGFuaW0gY29tcG9uZW50XG4gICAgICAgICAgICBpZiAodGhpcy5lbnRpdHkuYW5pbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW50aXR5LmFuaW0ucmViaW5kKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGV2ZW50IGhhbmRsZXIgdG8gbG9hZCBtYXBwaW5nXG4gICAgICAgICAgICAvLyBmb3IgbmV3IG1vZGVsXG4gICAgICAgICAgICBpZiAodGhpcy50eXBlID09PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXBwaW5nID0gdGhpcy5fbWFwcGluZztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1vZGVsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGJlIGxpZ2h0bWFwcGVkIGFmdGVyIHVzaW5nIGxpZ2h0bWFwcGVyLmJha2UoKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2xpZ2h0bWFwcGVkKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0bWFwcGVkID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcHBlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGlzIG1vZGVsIHdpbGwgY2FzdCBzaGFkb3dzIGZvciBsaWdodHMgdGhhdCBoYXZlIHNoYWRvdyBjYXN0aW5nIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWw7XG5cbiAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICYmICF2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBtb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fY2FzdFNoYWRvd3MgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmFkZFNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBzaGFkb3dzIHdpbGwgYmUgY2FzdCBvbiB0aGlzIG1vZGVsLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHJlY2VpdmVTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWNlaXZlU2hhZG93cyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93cyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ucmVjZWl2ZVNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlY2VpdmVTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGNhc3Qgc2hhZG93cyB3aGVuIHJlbmRlcmluZyBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3NMaWdodG1hcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIG1vZGVsIGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGlzU3RhdGljKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc1N0YXRpYyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9pc1N0YXRpYyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgcmN2ID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmN2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbSA9IHJjdltpXTtcbiAgICAgICAgICAgICAgICBtLmlzU3RhdGljID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaXNTdGF0aWMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc1N0YXRpYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgbW9kZWwgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCwgcG9wLFxuICAgICAqIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcblxuICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgYWxsIG1lc2ggaW5zdGFuY2VzIGZyb20gb2xkIGxheWVyc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdGhlIGxheWVyIGxpc3RcbiAgICAgICAgdGhpcy5fbGF5ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXSA9IHZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZG9uJ3QgYWRkIGludG8gbGF5ZXJzIHVudGlsIHdlJ3JlIGVuYWJsZWRcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQgfHwgIXRoaXMubWVzaEluc3RhbmNlcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGFkZCBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gbmV3IGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIG1vZGVsIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLk1PREVMLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHZhbHVlID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5NT0RFTCwgdmFsdWUsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIHJlLWFkZCBtb2RlbCB0byBzY2VuZSwgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYmF0Y2hHcm91cElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCB7QGxpbmsgQXNzZXR9IHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciB0aGUgbW9kZWwgKG5vdCB1c2VkIG9uIG1vZGVscyBvZiB0eXBlXG4gICAgICogJ2Fzc2V0JykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsQXNzZXQodmFsdWUpIHtcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmIChfaWQgIT09IHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTWF0ZXJpYWxBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsQXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHtAbGluayBNYXRlcmlhbH0gdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtb2RlbCAobm90IHVzZWQgb24gbW9kZWxzIG9mXG4gICAgICogdHlwZSAnYXNzZXQnKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWwodmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGljdGlvbmFyeSB0aGF0IGhvbGRzIG1hdGVyaWFsIG92ZXJyaWRlcyBmb3IgZWFjaCBtZXNoIGluc3RhbmNlLiBPbmx5IGFwcGxpZXMgdG8gbW9kZWxcbiAgICAgKiBjb21wb25lbnRzIG9mIHR5cGUgJ2Fzc2V0Jy4gVGhlIG1hcHBpbmcgY29udGFpbnMgcGFpcnMgb2YgbWVzaCBpbnN0YW5jZSBpbmRleCAtIG1hdGVyaWFsXG4gICAgICogYXNzZXQgaWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgbnVtYmVyPn1cbiAgICAgKi9cbiAgICBzZXQgbWFwcGluZyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gJ2Fzc2V0JylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIG9sZCBldmVudHNcbiAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuXG4gICAgICAgIC8vIGNhbid0IGhhdmUgYSBudWxsIG1hcHBpbmdcbiAgICAgICAgaWYgKCF2YWx1ZSlcbiAgICAgICAgICAgIHZhbHVlID0ge307XG5cbiAgICAgICAgdGhpcy5fbWFwcGluZyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgbW9kZWxBc3NldCA9IHRoaXMuYXNzZXQgPyB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLmFzc2V0KSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGFzc2V0TWFwcGluZyA9IG1vZGVsQXNzZXQgPyBtb2RlbEFzc2V0LmRhdGEubWFwcGluZyA6IG51bGw7XG4gICAgICAgIGxldCBhc3NldCA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodmFsdWVbaV0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwoYXNzZXQsIG1lc2hJbnN0YW5jZXNbaV0sIGkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhc3NldE1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRNYXBwaW5nW2ldICYmIChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwgfHwgYXNzZXRNYXBwaW5nW2ldLnBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFzc2V0TWFwcGluZ1tpXS5wYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IHRoaXMuX2dldE1hdGVyaWFsQXNzZXRVcmwoYXNzZXRNYXBwaW5nW2ldLnBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXRCeVVybCh1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbChhc3NldCwgbWVzaEluc3RhbmNlc1tpXSwgaSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFwcGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcHBpbmc7XG4gICAgfVxuXG4gICAgYWRkTW9kZWxUb0xheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlQ2hpbGQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbClcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgb25JbnNlcnRDaGlsZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKVxuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuYXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuXG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdpbnNlcnQnLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG9sZENvbXAgLSBUaGVcbiAgICAgKiBvbGQgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbmV3Q29tcCAtIFRoZVxuICAgICAqIG5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdGhhdCB3YXMgYWRkZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdGhhdCB3YXMgcmVtb3ZlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgbWVzaCBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQgLSBUaGUgZXZlbnQgbmFtZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBUaGUgYXNzZXQgaWQuXG4gICAgICogQHBhcmFtIHsqfSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gYmUgYm91bmQgdG8gdGhlIHNwZWNpZmllZCBldmVudC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRNYXRlcmlhbEV2ZW50KGluZGV4LCBldmVudCwgaWQsIGhhbmRsZXIpIHtcbiAgICAgICAgY29uc3QgZXZ0ID0gZXZlbnQgKyAnOicgKyBpZDtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vbihldnQsIGhhbmRsZXIsIHRoaXMpO1xuXG4gICAgICAgIGlmICghdGhpcy5fbWF0ZXJpYWxFdmVudHMpXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEV2ZW50cyA9IFtdO1xuXG4gICAgICAgIGlmICghdGhpcy5fbWF0ZXJpYWxFdmVudHNbaW5kZXhdKVxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxFdmVudHNbaW5kZXhdID0geyB9O1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsRXZlbnRzW2luZGV4XVtldnRdID0ge1xuICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91bnNldE1hdGVyaWFsRXZlbnRzKCkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBjb25zdCBldmVudHMgPSB0aGlzLl9tYXRlcmlhbEV2ZW50cztcbiAgICAgICAgaWYgKCFldmVudHMpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGV2ZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKCFldmVudHNbaV0pIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgZXZ0ID0gZXZlbnRzW2ldO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZXZ0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZihrZXksIGV2dFtrZXldLmhhbmRsZXIsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxFdmVudHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpZE9yUGF0aCAtIFRoZSBhc3NldCBpZCBvciBwYXRoLlxuICAgICAqIEByZXR1cm5zIHtBc3NldHxudWxsfSBUaGUgYXNzZXQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0QXNzZXRCeUlkT3JQYXRoKGlkT3JQYXRoKSB7XG4gICAgICAgIGxldCBhc3NldCA9IG51bGw7XG4gICAgICAgIGNvbnN0IGlzUGF0aCA9IGlzTmFOKHBhcnNlSW50KGlkT3JQYXRoLCAxMCkpO1xuXG4gICAgICAgIC8vIGdldCBhc3NldCBieSBpZCBvciB1cmxcbiAgICAgICAgaWYgKCFpc1BhdGgpIHtcbiAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoaWRPclBhdGgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuYXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IHRoaXMuX2dldE1hdGVyaWFsQXNzZXRVcmwoaWRPclBhdGgpO1xuICAgICAgICAgICAgaWYgKHVybClcbiAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0QnlVcmwodXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aCAtIFRoZSBwYXRoIG9mIHRoZSBtb2RlbCBhc3NldC5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IFRoZSBtb2RlbCBhc3NldCBVUkwgb3IgbnVsbCBpZiB0aGUgYXNzZXQgaXMgbm90IGluIHRoZSByZWdpc3RyeS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRNYXRlcmlhbEFzc2V0VXJsKHBhdGgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmFzc2V0KSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCBtb2RlbEFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5hc3NldCk7XG5cbiAgICAgICAgcmV0dXJuIG1vZGVsQXNzZXQgPyBtb2RlbEFzc2V0LmdldEFic29sdXRlVXJsKHBhdGgpIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBtYXRlcmlhbEFzc2V0IC1UaGUgbWF0ZXJpYWwgYXNzZXQgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZX0gbWVzaEluc3RhbmNlIC0gVGhlIG1lc2ggaW5zdGFuY2UgdG8gYXNzaWduIHRoZSBtYXRlcmlhbCB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgaW5kZXggb2YgdGhlIG1lc2ggaW5zdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9hZEFuZFNldE1lc2hJbnN0YW5jZU1hdGVyaWFsKG1hdGVyaWFsQXNzZXQsIG1lc2hJbnN0YW5jZSwgaW5kZXgpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAoIW1hdGVyaWFsQXNzZXQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG1hdGVyaWFsQXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsQXNzZXQucmVzb3VyY2U7XG5cbiAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsRXZlbnQoaW5kZXgsICdyZW1vdmUnLCBtYXRlcmlhbEFzc2V0LmlkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbEV2ZW50KGluZGV4LCAnbG9hZCcsIG1hdGVyaWFsQXNzZXQuaWQsIGZ1bmN0aW9uIChhc3NldCkge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWxFdmVudChpbmRleCwgJ3JlbW92ZScsIG1hdGVyaWFsQXNzZXQuaWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgICAgICBhc3NldHMubG9hZChtYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0Fzc2V0ID0gKHRoaXMuX3R5cGUgPT09ICdhc3NldCcpO1xuXG4gICAgICAgIGxldCBhc3NldDtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnMoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0Fzc2V0ICYmIHRoaXMuX2Fzc2V0KSB7XG4gICAgICAgICAgICAvLyBiaW5kIGFuZCBsb2FkIG1vZGVsIGFzc2V0IGlmIG5lY2Vzc2FyeVxuICAgICAgICAgICAgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1vZGVsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIC8vIGJpbmQgYW5kIGxvYWQgbWF0ZXJpYWwgYXNzZXQgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgICBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9tYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0Fzc2V0KSB7XG4gICAgICAgICAgICAvLyBiaW5kIG1hcHBlZCBhc3NldHNcbiAgICAgICAgICAgIC8vIFRPRE86IHJlcGxhY2VcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tYXBwaW5nW2luZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLl9nZXRBc3NldEJ5SWRPclBhdGgodGhpcy5fbWFwcGluZ1tpbmRleF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0ICYmICFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIGFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5NT0RFTCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuTU9ERUwsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIHJlbmRlcmluZyBtb2RlbCB3aXRob3V0IHJlbW92aW5nIGl0IGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeS4gVGhpcyBtZXRob2Qgc2V0cyB0aGVcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGV9IHByb3BlcnR5IG9mIGV2ZXJ5IE1lc2hJbnN0YW5jZSBpbiB0aGUgbW9kZWwgdG8gZmFsc2UgTm90ZSwgdGhpc1xuICAgICAqIGRvZXMgbm90IHJlbW92ZSB0aGUgbW9kZWwgb3IgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGUgc2NlbmUgaGllcmFyY2h5IG9yIGRyYXcgY2FsbCBsaXN0LiBTb1xuICAgICAqIHRoZSBtb2RlbCBjb21wb25lbnQgc3RpbGwgaW5jdXJzIHNvbWUgQ1BVIG92ZXJoZWFkLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB0aGlzLnRpbWVyID0gMDtcbiAgICAgKiB0aGlzLnZpc2libGUgPSB0cnVlO1xuICAgICAqIC8vIC4uLlxuICAgICAqIC8vIGJsaW5rIG1vZGVsIGV2ZXJ5IDAuMSBzZWNvbmRzXG4gICAgICogdGhpcy50aW1lciArPSBkdDtcbiAgICAgKiBpZiAodGhpcy50aW1lciA+IDAuMSkge1xuICAgICAqICAgICBpZiAoIXRoaXMudmlzaWJsZSkge1xuICAgICAqICAgICAgICAgdGhpcy5lbnRpdHkubW9kZWwuc2hvdygpO1xuICAgICAqICAgICAgICAgdGhpcy52aXNpYmxlID0gdHJ1ZTtcbiAgICAgKiAgICAgfSBlbHNlIHtcbiAgICAgKiAgICAgICAgIHRoaXMuZW50aXR5Lm1vZGVsLmhpZGUoKTtcbiAgICAgKiAgICAgICAgIHRoaXMudmlzaWJsZSA9IGZhbHNlO1xuICAgICAqICAgICB9XG4gICAgICogICAgIHRoaXMudGltZXIgPSAwO1xuICAgICAqIH1cbiAgICAgKi9cbiAgICBoaWRlKCkge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0udmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHJlbmRlcmluZyBvZiB0aGUgbW9kZWwgaWYgaGlkZGVuIHVzaW5nIHtAbGluayBNb2RlbENvbXBvbmVudCNoaWRlfS4gVGhpcyBtZXRob2Qgc2V0c1xuICAgICAqIGFsbCB0aGUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvbiBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBzaG93KCkge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0udmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCB0byBiaW5kIGV2ZW50cyB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCB0byB1bmJpbmQgZXZlbnRzIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdW5iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCd1bmxvYWQnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBhZGQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0QWRkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGxvYWQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbChhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgdW5sb2FkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWF0ZXJpYWxBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbCh0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IHJlbW92ZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25NYXRlcmlhbEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBjaGFuZ2UgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0Q2hhbmdlKGFzc2V0KSB7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgdG8gYmluZCBldmVudHMgdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYmluZE1vZGVsQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fdW5iaW5kTW9kZWxBc3NldChhc3NldCk7XG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk1vZGVsQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1vZGVsQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25Nb2RlbEFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTW9kZWxBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCB0byB1bmJpbmQgZXZlbnRzIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdW5iaW5kTW9kZWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1vZGVsQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCd1bmxvYWQnLCB0aGlzLl9vbk1vZGVsQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTW9kZWxBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Nb2RlbEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBhZGQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb2RlbEFzc2V0QWRkZWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uTW9kZWxBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKGFzc2V0LmlkID09PSB0aGlzLl9hc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZE1vZGVsQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgbG9hZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubW9kZWwgPSBhc3NldC5yZXNvdXJjZS5jbG9uZSgpO1xuICAgICAgICB0aGlzLl9jbG9uZWRNb2RlbCA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgdW5sb2FkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBjaGFuZ2UgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGF0dHIgLSBUaGUgYXR0cmlidXRlIHRoYXQgd2FzIGNoYW5nZWQuXG4gICAgICogQHBhcmFtIHsqfSBfbmV3IC0gVGhlIG5ldyB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7Kn0gX29sZCAtIFRoZSBvbGQgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRDaGFuZ2UoYXNzZXQsIGF0dHIsIF9uZXcsIF9vbGQpIHtcbiAgICAgICAgaWYgKGF0dHIgPT09ICdkYXRhJykge1xuICAgICAgICAgICAgdGhpcy5tYXBwaW5nID0gdGhpcy5fbWFwcGluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IHJlbW92ZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB0b1xuICAgICAqIGJlIHNldC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRNYXRlcmlhbChtYXRlcmlhbCkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IG1hdGVyaWFsKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbWF0ZXJpYWw7XG5cbiAgICAgICAgY29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbDtcbiAgICAgICAgaWYgKG1vZGVsICYmIHRoaXMuX3R5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBtb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IE1vZGVsQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiTW9kZWxDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl90eXBlIiwiX2Fzc2V0IiwiX21vZGVsIiwiX21hcHBpbmciLCJfY2FzdFNoYWRvd3MiLCJfcmVjZWl2ZVNoYWRvd3MiLCJfbWF0ZXJpYWxBc3NldCIsIl9tYXRlcmlhbCIsIl9jYXN0U2hhZG93c0xpZ2h0bWFwIiwiX2xpZ2h0bWFwcGVkIiwiX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJfaXNTdGF0aWMiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9iYXRjaEdyb3VwSWQiLCJfY3VzdG9tQWFiYiIsIl9hcmVhIiwiX21hdGVyaWFsRXZlbnRzIiwiX2Nsb25lZE1vZGVsIiwiX2JhdGNoR3JvdXAiLCJkZWZhdWx0TWF0ZXJpYWwiLCJvbiIsIm9uUmVtb3ZlQ2hpbGQiLCJvbkluc2VydENoaWxkIiwibWVzaEluc3RhbmNlcyIsInZhbHVlIiwiY3VzdG9tQWFiYiIsIm1pIiwiaSIsImxlbmd0aCIsInNldEN1c3RvbUFhYmIiLCJ0eXBlIiwiX2JpbmRNb2RlbEFzc2V0IiwibW9kZWwiLCJwcmltRGF0YSIsImdldFNoYXBlUHJpbWl0aXZlIiwiYXBwIiwiZ3JhcGhpY3NEZXZpY2UiLCJhcmVhIiwibWVzaCIsIm5vZGUiLCJHcmFwaE5vZGUiLCJNb2RlbCIsImdyYXBoIiwiTWVzaEluc3RhbmNlIiwiYXNzZXQiLCJhc3NldHMiLCJfaWQiLCJBc3NldCIsImlkIiwib2ZmIiwiX29uTW9kZWxBc3NldEFkZGVkIiwiX3ByZXYiLCJnZXQiLCJfdW5iaW5kTW9kZWxBc3NldCIsIl9pbW11dGFibGUiLCJEZWJ1ZyIsImVycm9yIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwicmVtb3ZlQ2hpbGQiLCJnZXRHcmFwaCIsIl9lbnRpdHkiLCJkZXN0cm95IiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJpc1N0YXRpYyIsImxpZ2h0bWFwcGVkIiwiYWRkQ2hpbGQiLCJlbmFibGVkIiwiYWRkTW9kZWxUb0xheWVycyIsImFuaW1hdGlvbiIsInNldE1vZGVsIiwiYW5pbSIsInJlYmluZCIsIm1hcHBpbmciLCJfdW5zZXRNYXRlcmlhbEV2ZW50cyIsInNldExpZ2h0bWFwcGVkIiwiY2FzdFNoYWRvd3MiLCJsYXllcnMiLCJzY2VuZSIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZWNlaXZlU2hhZG93cyIsImxlbiIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwicmN2IiwibSIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwiYmF0Y2hHcm91cElkIiwiYmF0Y2hlciIsInJlbW92ZSIsIkJhdGNoR3JvdXAiLCJNT0RFTCIsImluc2VydCIsIm1hdGVyaWFsQXNzZXQiLCJfb25NYXRlcmlhbEFzc2V0QWRkIiwiX3VuYmluZE1hdGVyaWFsQXNzZXQiLCJfc2V0TWF0ZXJpYWwiLCJfYmluZE1hdGVyaWFsQXNzZXQiLCJtYXRlcmlhbCIsIm1vZGVsQXNzZXQiLCJhc3NldE1hcHBpbmciLCJkYXRhIiwidW5kZWZpbmVkIiwiX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbCIsInBhdGgiLCJ1cmwiLCJfZ2V0TWF0ZXJpYWxBc3NldFVybCIsImdldEJ5VXJsIiwib25SZW1vdmUiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwiX3NldE1hdGVyaWFsRXZlbnQiLCJldmVudCIsImhhbmRsZXIiLCJldnQiLCJldmVudHMiLCJrZXkiLCJfZ2V0QXNzZXRCeUlkT3JQYXRoIiwiaWRPclBhdGgiLCJpc1BhdGgiLCJpc05hTiIsInBhcnNlSW50IiwiZ2V0QWJzb2x1dGVVcmwiLCJtZXNoSW5zdGFuY2UiLCJyZXNvdXJjZSIsImxvYWQiLCJvbkVuYWJsZSIsImlzQXNzZXQiLCJvbkRpc2FibGUiLCJoaWRlIiwiaW5zdGFuY2VzIiwibCIsInZpc2libGUiLCJzaG93IiwiX29uTWF0ZXJpYWxBc3NldExvYWQiLCJfb25NYXRlcmlhbEFzc2V0VW5sb2FkIiwiX29uTWF0ZXJpYWxBc3NldFJlbW92ZSIsIl9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UiLCJfb25Nb2RlbEFzc2V0TG9hZCIsIl9vbk1vZGVsQXNzZXRVbmxvYWQiLCJfb25Nb2RlbEFzc2V0Q2hhbmdlIiwiX29uTW9kZWxBc3NldFJlbW92ZSIsImNsb25lIiwiYXR0ciIsIl9uZXciLCJfb2xkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFjQTtBQUNBO0FBQ0E7QUFDQTtB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
