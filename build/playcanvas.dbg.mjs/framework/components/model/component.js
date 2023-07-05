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
   * Create a new ModelComponent instance.
   *
   * @param {import('./system.js').ModelComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    /**
     * @type {string}
     * @private
     */
    this._type = 'asset';
    /**
     * @type {Asset|number|null}
     * @private
     */
    this._asset = null;
    /**
     * @type {Model|null}
     * @private
     */
    this._model = null;
    /**
     * @type {Object<string, number>}
     * @private
     */
    this._mapping = {};
    /**
     * @type {boolean}
     * @private
     */
    this._castShadows = true;
    /**
     * @type {boolean}
     * @private
     */
    this._receiveShadows = true;
    /**
     * @type {Asset|number|null}
     * @private
     */
    this._materialAsset = null;
    /**
     * @type {import('../../../scene/materials/material.js').Material}
     * @private
     */
    this._material = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._castShadowsLightmap = true;
    /**
     * @type {boolean}
     * @private
     */
    this._lightmapped = false;
    /**
     * @type {number}
     * @private
     */
    this._lightmapSizeMultiplier = 1;
    /**
     * @type {boolean}
     * @private
     */
    this._isStatic = false;
    /**
     * @type {number[]}
     * @private
     */
    this._layers = [LAYERID_WORLD];
    // assign to the default world layer
    /**
     * @type {number}
     * @private
     */
    this._batchGroupId = -1;
    /**
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     * @private
     */
    this._customAabb = null;
    this._area = null;
    this._materialEvents = null;
    /**
     * @type {boolean}
     * @private
     */
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
      this._model.getGraph().destroy();
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
   * @param {import('../../../scene/layer.js').Layer} layer - The layer that was added.
   * @private
   */
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances(this.meshInstances);
  }

  /**
   * @param {import('../../../scene/layer.js').Layer} layer - The layer that was removed.
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbW9kZWwvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQge1xuICAgIExBWUVSSURfV09STERcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJhdGNoR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRTaGFwZVByaW1pdGl2ZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSBtb2RlbCBvciBhIHByaW1pdGl2ZSBzaGFwZS4gVGhpcyBDb21wb25lbnQgYXR0YWNoZXMgYWRkaXRpb25hbFxuICogbW9kZWwgZ2VvbWV0cnkgaW4gdG8gdGhlIHNjZW5lIGdyYXBoIGJlbG93IHRoZSBFbnRpdHkuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBNb2RlbENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gJ2Fzc2V0JztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TW9kZWx8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tb2RlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgbnVtYmVyPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXBwaW5nID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYXN0U2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZWNlaXZlU2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nhc3RTaGFkb3dzTGlnaHRtYXAgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBwZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JhdGNoR3JvdXBJZCA9IC0xO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgX2FyZWEgPSBudWxsO1xuXG4gICAgX21hdGVyaWFsRXZlbnRzID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nsb25lZE1vZGVsID0gZmFsc2U7XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgX2JhdGNoR3JvdXAgPSBudWxsO1xuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1vZGVsQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuTW9kZWxDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcblxuICAgICAgICAvLyBoYW5kbGUgZXZlbnRzIHdoZW4gdGhlIGVudGl0eSBpcyBkaXJlY3RseSAob3IgaW5kaXJlY3RseSBhcyBhIGNoaWxkIG9mIHN1Yi1oaWVyYXJjaHkpIGFkZGVkIG9yIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmVoaWVyYXJjaHknLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0aGllcmFyY2h5JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBtZXNoSW5zdGFuY2VzIGNvbnRhaW5lZCBpbiB0aGUgY29tcG9uZW50J3MgbW9kZWwuIElmIG1vZGVsIGlzIG5vdCBzZXQgb3IgbG9hZGVkXG4gICAgICogZm9yIGNvbXBvbmVudCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge01lc2hJbnN0YW5jZVtdfG51bGx9XG4gICAgICovXG4gICAgc2V0IG1lc2hJbnN0YW5jZXModmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG1lc2hJbnN0YW5jZXMoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQsIHRoZSBvYmplY3Qgc3BhY2UgYm91bmRpbmcgYm94IGlzIHVzZWQgYXMgYSBib3VuZGluZyBib3ggZm9yIHZpc2liaWxpdHkgY3VsbGluZyBvZlxuICAgICAqIGF0dGFjaGVkIG1lc2ggaW5zdGFuY2VzLiBUaGlzIGlzIGFuIG9wdGltaXphdGlvbiwgYWxsb3dpbmcgb3ZlcnNpemVkIGJvdW5kaW5nIGJveCB0byBiZVxuICAgICAqIHNwZWNpZmllZCBmb3Igc2tpbm5lZCBjaGFyYWN0ZXJzIGluIG9yZGVyIHRvIGF2b2lkIHBlciBmcmFtZSBib3VuZGluZyBib3ggY29tcHV0YXRpb25zIGJhc2VkXG4gICAgICogb24gYm9uZSBwb3NpdGlvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fG51bGx9XG4gICAgICovXG4gICAgc2V0IGN1c3RvbUFhYmIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHNldCBpdCBvbiBtZXNoSW5zdGFuY2VzXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXN0b21BYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgbW9kZWwuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0gXCJhc3NldFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgbW9kZWwgYXNzZXRcbiAgICAgKiAtIFwiYm94XCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBib3ggKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwiY2Fwc3VsZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY2Fwc3VsZSAocmFkaXVzIDAuNSwgaGVpZ2h0IDIpXG4gICAgICogLSBcImNvbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNvbmUgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJjeWxpbmRlclwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY3lsaW5kZXIgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJwbGFuZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgcGxhbmUgKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwic3BoZXJlXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBzcGhlcmUgKHJhZGl1cyAwLjUpXG4gICAgICogLSBcInRvcnVzXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSB0b3J1cyAodHViZVJhZGl1czogMC4yLCByaW5nUmFkaXVzOiAwLjMpXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2FyZWEgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgPT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGdldCAvIGNyZWF0ZSBtZXNoIG9mIHR5cGVcbiAgICAgICAgICAgIGNvbnN0IHByaW1EYXRhID0gZ2V0U2hhcGVQcmltaXRpdmUodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzLl9hcmVhID0gcHJpbURhdGEuYXJlYTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBwcmltRGF0YS5tZXNoO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsLmdyYXBoID0gbm9kZTtcblxuICAgICAgICAgICAgbW9kZWwubWVzaEluc3RhbmNlcyA9IFtuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX21hdGVyaWFsLCBub2RlKV07XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXNzZXQgZm9yIHRoZSBtb2RlbCAob25seSBhcHBsaWVzIHRvIG1vZGVscyBvZiB0eXBlICdhc3NldCcpIGNhbiBhbHNvIGJlIGFuIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0fG51bWJlcnxudWxsfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCkge1xuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBwcmV2aW91cyBhc3NldFxuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uTW9kZWxBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNb2RlbEFzc2V0KF9wcmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9hc3NldCwgdGhpcy5fb25Nb2RlbEFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1vZGVsIHRoYXQgaXMgYWRkZWQgdG8gdGhlIHNjZW5lIGdyYXBoLiBJdCBjYW4gYmUgbm90IHNldCBvciBsb2FkZWQsIHNvIHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TW9kZWx9XG4gICAgICovXG4gICAgc2V0IG1vZGVsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gcmV0dXJuIGlmIHRoZSBtb2RlbCBoYXMgYmVlbiBmbGFnZ2VkIGFzIGltbXV0YWJsZVxuICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUuX2ltbXV0YWJsZSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBhc3NpZ24gYSBtb2RlbCB0byBtdWx0aXBsZSBNb2RlbENvbXBvbmVudHMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwuX2ltbXV0YWJsZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwuZ2V0R3JhcGgoKS5kZXN0cm95KCk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWwuX2VudGl0eTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2Nsb25lZE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZWwuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2Nsb25lZE1vZGVsID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tb2RlbCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgLy8gZmxhZyB0aGUgbW9kZWwgYXMgYmVpbmcgYXNzaWduZWQgdG8gYSBjb21wb25lbnRcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLl9pbW11dGFibGUgPSB0cnVlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdGhpcy5fY2FzdFNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5yZWNlaXZlU2hhZG93ID0gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5pc1N0YXRpYyA9IHRoaXMuX2lzU3RhdGljO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5saWdodG1hcHBlZCA9IHRoaXMuX2xpZ2h0bWFwcGVkOyAvLyB1cGRhdGUgbWVzaEluc3RhbmNlc1xuXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5hZGRDaGlsZCh0aGlzLl9tb2RlbC5ncmFwaCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTdG9yZSB0aGUgZW50aXR5IHRoYXQgb3ducyB0aGlzIG1vZGVsXG4gICAgICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gdGhpcy5lbnRpdHk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBhbnkgYW5pbWF0aW9uIGNvbXBvbmVudFxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmFuaW1hdGlvbilcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5hbmltYXRpb24uc2V0TW9kZWwodGhpcy5fbW9kZWwpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgYW55IGFuaW0gY29tcG9uZW50XG4gICAgICAgICAgICBpZiAodGhpcy5lbnRpdHkuYW5pbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW50aXR5LmFuaW0ucmViaW5kKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGV2ZW50IGhhbmRsZXIgdG8gbG9hZCBtYXBwaW5nXG4gICAgICAgICAgICAvLyBmb3IgbmV3IG1vZGVsXG4gICAgICAgICAgICBpZiAodGhpcy50eXBlID09PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXBwaW5nID0gdGhpcy5fbWFwcGluZztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1vZGVsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGJlIGxpZ2h0bWFwcGVkIGFmdGVyIHVzaW5nIGxpZ2h0bWFwcGVyLmJha2UoKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2xpZ2h0bWFwcGVkKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0bWFwcGVkID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcHBlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGlzIG1vZGVsIHdpbGwgY2FzdCBzaGFkb3dzIGZvciBsaWdodHMgdGhhdCBoYXZlIHNoYWRvdyBjYXN0aW5nIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWw7XG5cbiAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICYmICF2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBtb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fY2FzdFNoYWRvd3MgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmFkZFNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBzaGFkb3dzIHdpbGwgYmUgY2FzdCBvbiB0aGlzIG1vZGVsLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHJlY2VpdmVTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWNlaXZlU2hhZG93cyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93cyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ucmVjZWl2ZVNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlY2VpdmVTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGNhc3Qgc2hhZG93cyB3aGVuIHJlbmRlcmluZyBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3NMaWdodG1hcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIG1vZGVsIGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGlzU3RhdGljKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc1N0YXRpYyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9pc1N0YXRpYyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgcmN2ID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmN2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbSA9IHJjdltpXTtcbiAgICAgICAgICAgICAgICBtLmlzU3RhdGljID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaXNTdGF0aWMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc1N0YXRpYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgbW9kZWwgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCwgcG9wLFxuICAgICAqIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcblxuICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgYWxsIG1lc2ggaW5zdGFuY2VzIGZyb20gb2xkIGxheWVyc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdGhlIGxheWVyIGxpc3RcbiAgICAgICAgdGhpcy5fbGF5ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXSA9IHZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZG9uJ3QgYWRkIGludG8gbGF5ZXJzIHVudGlsIHdlJ3JlIGVuYWJsZWRcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQgfHwgIXRoaXMubWVzaEluc3RhbmNlcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGFkZCBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gbmV3IGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIG1vZGVsIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLk1PREVMLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHZhbHVlID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5NT0RFTCwgdmFsdWUsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIHJlLWFkZCBtb2RlbCB0byBzY2VuZSwgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYmF0Y2hHcm91cElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCB7QGxpbmsgQXNzZXR9IHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciB0aGUgbW9kZWwgKG5vdCB1c2VkIG9uIG1vZGVscyBvZiB0eXBlXG4gICAgICogJ2Fzc2V0JykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsQXNzZXQodmFsdWUpIHtcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmIChfaWQgIT09IHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTWF0ZXJpYWxBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsQXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHtAbGluayBNYXRlcmlhbH0gdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtb2RlbCAobm90IHVzZWQgb24gbW9kZWxzIG9mXG4gICAgICogdHlwZSAnYXNzZXQnKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWwodmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGljdGlvbmFyeSB0aGF0IGhvbGRzIG1hdGVyaWFsIG92ZXJyaWRlcyBmb3IgZWFjaCBtZXNoIGluc3RhbmNlLiBPbmx5IGFwcGxpZXMgdG8gbW9kZWxcbiAgICAgKiBjb21wb25lbnRzIG9mIHR5cGUgJ2Fzc2V0Jy4gVGhlIG1hcHBpbmcgY29udGFpbnMgcGFpcnMgb2YgbWVzaCBpbnN0YW5jZSBpbmRleCAtIG1hdGVyaWFsXG4gICAgICogYXNzZXQgaWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgbnVtYmVyPn1cbiAgICAgKi9cbiAgICBzZXQgbWFwcGluZyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gJ2Fzc2V0JylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIG9sZCBldmVudHNcbiAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuXG4gICAgICAgIC8vIGNhbid0IGhhdmUgYSBudWxsIG1hcHBpbmdcbiAgICAgICAgaWYgKCF2YWx1ZSlcbiAgICAgICAgICAgIHZhbHVlID0ge307XG5cbiAgICAgICAgdGhpcy5fbWFwcGluZyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgbW9kZWxBc3NldCA9IHRoaXMuYXNzZXQgPyB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLmFzc2V0KSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGFzc2V0TWFwcGluZyA9IG1vZGVsQXNzZXQgPyBtb2RlbEFzc2V0LmRhdGEubWFwcGluZyA6IG51bGw7XG4gICAgICAgIGxldCBhc3NldCA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodmFsdWVbaV0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwoYXNzZXQsIG1lc2hJbnN0YW5jZXNbaV0sIGkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhc3NldE1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRNYXBwaW5nW2ldICYmIChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwgfHwgYXNzZXRNYXBwaW5nW2ldLnBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFzc2V0TWFwcGluZ1tpXS5wYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IHRoaXMuX2dldE1hdGVyaWFsQXNzZXRVcmwoYXNzZXRNYXBwaW5nW2ldLnBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXRCeVVybCh1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbChhc3NldCwgbWVzaEluc3RhbmNlc1tpXSwgaSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFwcGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcHBpbmc7XG4gICAgfVxuXG4gICAgYWRkTW9kZWxUb0xheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlQ2hpbGQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbClcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgb25JbnNlcnRDaGlsZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKVxuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuYXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuXG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdpbnNlcnQnLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG9sZENvbXAgLSBUaGVcbiAgICAgKiBvbGQgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbmV3Q29tcCAtIFRoZVxuICAgICAqIG5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gVGhlIGxheWVyIHRoYXQgd2FzIGFkZGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9sYXllci5qcycpLkxheWVyfSBsYXllciAtIFRoZSBsYXllciB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gVGhlIGluZGV4IG9mIHRoZSBtZXNoIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCAtIFRoZSBhc3NldCBpZC5cbiAgICAgKiBAcGFyYW0geyp9IGhhbmRsZXIgLSBUaGUgaGFuZGxlciBmdW5jdGlvbiB0byBiZSBib3VuZCB0byB0aGUgc3BlY2lmaWVkIGV2ZW50LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldE1hdGVyaWFsRXZlbnQoaW5kZXgsIGV2ZW50LCBpZCwgaGFuZGxlcikge1xuICAgICAgICBjb25zdCBldnQgPSBldmVudCArICc6JyArIGlkO1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLm9uKGV2dCwgaGFuZGxlciwgdGhpcyk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9tYXRlcmlhbEV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsRXZlbnRzID0gW107XG5cbiAgICAgICAgaWYgKCF0aGlzLl9tYXRlcmlhbEV2ZW50c1tpbmRleF0pXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEV2ZW50c1tpbmRleF0gPSB7IH07XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxFdmVudHNbaW5kZXhdW2V2dF0gPSB7XG4gICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3Vuc2V0TWF0ZXJpYWxFdmVudHMoKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuX21hdGVyaWFsRXZlbnRzO1xuICAgICAgICBpZiAoIWV2ZW50cylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZXZlbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWV2ZW50c1tpXSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBldnQgPSBldmVudHNbaV07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBldnQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKGtleSwgZXZ0W2tleV0uaGFuZGxlciwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXRlcmlhbEV2ZW50cyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlkT3JQYXRoIC0gVGhlIGFzc2V0IGlkIG9yIHBhdGguXG4gICAgICogQHJldHVybnMge0Fzc2V0fG51bGx9IFRoZSBhc3NldC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRBc3NldEJ5SWRPclBhdGgoaWRPclBhdGgpIHtcbiAgICAgICAgbGV0IGFzc2V0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgaXNQYXRoID0gaXNOYU4ocGFyc2VJbnQoaWRPclBhdGgsIDEwKSk7XG5cbiAgICAgICAgLy8gZ2V0IGFzc2V0IGJ5IGlkIG9yIHVybFxuICAgICAgICBpZiAoIWlzUGF0aCkge1xuICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChpZE9yUGF0aCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5hc3NldCkge1xuICAgICAgICAgICAgY29uc3QgdXJsID0gdGhpcy5fZ2V0TWF0ZXJpYWxBc3NldFVybChpZE9yUGF0aCk7XG4gICAgICAgICAgICBpZiAodXJsKVxuICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXRCeVVybCh1cmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFzc2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIC0gVGhlIHBhdGggb2YgdGhlIG1vZGVsIGFzc2V0LlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gVGhlIG1vZGVsIGFzc2V0IFVSTCBvciBudWxsIGlmIHRoZSBhc3NldCBpcyBub3QgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldE1hdGVyaWFsQXNzZXRVcmwocGF0aCkge1xuICAgICAgICBpZiAoIXRoaXMuYXNzZXQpIHJldHVybiBudWxsO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsQXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLmFzc2V0KTtcblxuICAgICAgICByZXR1cm4gbW9kZWxBc3NldCA/IG1vZGVsQXNzZXQuZ2V0QWJzb2x1dGVVcmwocGF0aCkgOiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IG1hdGVyaWFsQXNzZXQgLVRoZSBtYXRlcmlhbCBhc3NldCB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlfSBtZXNoSW5zdGFuY2UgLSBUaGUgbWVzaCBpbnN0YW5jZSB0byBhc3NpZ24gdGhlIG1hdGVyaWFsIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgbWVzaCBpbnN0YW5jZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwobWF0ZXJpYWxBc3NldCwgbWVzaEluc3RhbmNlLCBpbmRleCkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmICghbWF0ZXJpYWxBc3NldClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobWF0ZXJpYWxBc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWxBc3NldC5yZXNvdXJjZTtcblxuICAgICAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWxFdmVudChpbmRleCwgJ3JlbW92ZScsIG1hdGVyaWFsQXNzZXQuaWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsRXZlbnQoaW5kZXgsICdsb2FkJywgbWF0ZXJpYWxBc3NldC5pZCwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gYXNzZXQucmVzb3VyY2U7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbEV2ZW50KGluZGV4LCAncmVtb3ZlJywgbWF0ZXJpYWxBc3NldC5pZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKVxuICAgICAgICAgICAgICAgIGFzc2V0cy5sb2FkKG1hdGVyaWFsQXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzQXNzZXQgPSAodGhpcy5fdHlwZSA9PT0gJ2Fzc2V0Jyk7XG5cbiAgICAgICAgbGV0IGFzc2V0O1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQXNzZXQgJiYgdGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgIC8vIGJpbmQgYW5kIGxvYWQgbW9kZWwgYXNzZXQgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgICBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCAmJiBhc3NldC5yZXNvdXJjZSAhPT0gdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTW9kZWxBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgLy8gYmluZCBhbmQgbG9hZCBtYXRlcmlhbCBhc3NldCBpZiBuZWNlc3NhcnlcbiAgICAgICAgICAgIGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX21hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzQXNzZXQpIHtcbiAgICAgICAgICAgIC8vIGJpbmQgbWFwcGVkIGFzc2V0c1xuICAgICAgICAgICAgLy8gVE9ETzogcmVwbGFjZVxuICAgICAgICAgICAgaWYgKHRoaXMuX21hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX21hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX21hcHBpbmdbaW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuX2dldEFzc2V0QnlJZE9yUGF0aCh0aGlzLl9tYXBwaW5nW2luZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXQgJiYgIWFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLk1PREVMLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIGFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5NT0RFTCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3AgcmVuZGVyaW5nIG1vZGVsIHdpdGhvdXQgcmVtb3ZpbmcgaXQgZnJvbSB0aGUgc2NlbmUgaGllcmFyY2h5LiBUaGlzIG1ldGhvZCBzZXRzIHRoZVxuICAgICAqIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZX0gcHJvcGVydHkgb2YgZXZlcnkgTWVzaEluc3RhbmNlIGluIHRoZSBtb2RlbCB0byBmYWxzZSBOb3RlLCB0aGlzXG4gICAgICogZG9lcyBub3QgcmVtb3ZlIHRoZSBtb2RlbCBvciBtZXNoIGluc3RhbmNlcyBmcm9tIHRoZSBzY2VuZSBoaWVyYXJjaHkgb3IgZHJhdyBjYWxsIGxpc3QuIFNvXG4gICAgICogdGhlIG1vZGVsIGNvbXBvbmVudCBzdGlsbCBpbmN1cnMgc29tZSBDUFUgb3ZlcmhlYWQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHRoaXMudGltZXIgPSAwO1xuICAgICAqIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgICogLy8gLi4uXG4gICAgICogLy8gYmxpbmsgbW9kZWwgZXZlcnkgMC4xIHNlY29uZHNcbiAgICAgKiB0aGlzLnRpbWVyICs9IGR0O1xuICAgICAqIGlmICh0aGlzLnRpbWVyID4gMC4xKSB7XG4gICAgICogICAgIGlmICghdGhpcy52aXNpYmxlKSB7XG4gICAgICogICAgICAgICB0aGlzLmVudGl0eS5tb2RlbC5zaG93KCk7XG4gICAgICogICAgICAgICB0aGlzLnZpc2libGUgPSB0cnVlO1xuICAgICAqICAgICB9IGVsc2Uge1xuICAgICAqICAgICAgICAgdGhpcy5lbnRpdHkubW9kZWwuaGlkZSgpO1xuICAgICAqICAgICAgICAgdGhpcy52aXNpYmxlID0gZmFsc2U7XG4gICAgICogICAgIH1cbiAgICAgKiAgICAgdGhpcy50aW1lciA9IDA7XG4gICAgICogfVxuICAgICAqL1xuICAgIGhpZGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIG9mIHRoZSBtb2RlbCBpZiBoaWRkZW4gdXNpbmcge0BsaW5rIE1vZGVsQ29tcG9uZW50I2hpZGV9LiBUaGlzIG1ldGhvZCBzZXRzXG4gICAgICogYWxsIHRoZSB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGV9IHByb3BlcnR5IG9uIGFsbCBtZXNoIGluc3RhbmNlcyB0byB0cnVlLlxuICAgICAqL1xuICAgIHNob3coKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IHRvIGJpbmQgZXZlbnRzIHRvLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTWF0ZXJpYWxBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IHRvIHVuYmluZCBldmVudHMgZnJvbS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91bmJpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGFkZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRBZGQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uTWF0ZXJpYWxBc3NldEFkZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgbG9hZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCB1bmxvYWQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgcmVtb3ZlIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWF0ZXJpYWxBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbk1hdGVyaWFsQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGNoYW5nZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCB0byBiaW5kIGV2ZW50cyB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9iaW5kTW9kZWxBc3NldChhc3NldCkge1xuICAgICAgICB0aGlzLl91bmJpbmRNb2RlbEFzc2V0KGFzc2V0KTtcblxuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25Nb2RlbEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTW9kZWxBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbk1vZGVsQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25Nb2RlbEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IHRvIHVuYmluZCBldmVudHMgZnJvbS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91bmJpbmRNb2RlbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25Nb2RlbEFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1vZGVsQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGFkZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25Nb2RlbEFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAoYXNzZXQuaWQgPT09IHRoaXMuX2Fzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kTW9kZWxBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBsb2FkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tb2RlbCA9IGFzc2V0LnJlc291cmNlLmNsb25lKCk7XG4gICAgICAgIHRoaXMuX2Nsb25lZE1vZGVsID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCB1bmxvYWQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb2RlbEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGNoYW5nZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYXR0ciAtIFRoZSBhdHRyaWJ1dGUgdGhhdCB3YXMgY2hhbmdlZC5cbiAgICAgKiBAcGFyYW0geyp9IF9uZXcgLSBUaGUgbmV3IHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHsqfSBfb2xkIC0gVGhlIG9sZCB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldENoYW5nZShhc3NldCwgYXR0ciwgX25ldywgX29sZCkge1xuICAgICAgICBpZiAoYXR0ciA9PT0gJ2RhdGEnKSB7XG4gICAgICAgICAgICB0aGlzLm1hcHBpbmcgPSB0aGlzLl9tYXBwaW5nO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgcmVtb3ZlIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvXG4gICAgICogYmUgc2V0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldE1hdGVyaWFsKG1hdGVyaWFsKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbCA9PT0gbWF0ZXJpYWwpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBtYXRlcmlhbDtcblxuICAgICAgICBjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsO1xuICAgICAgICBpZiAobW9kZWwgJiYgdGhpcy5fdHlwZSAhPT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG1vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTW9kZWxDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJNb2RlbENvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3R5cGUiLCJfYXNzZXQiLCJfbW9kZWwiLCJfbWFwcGluZyIsIl9jYXN0U2hhZG93cyIsIl9yZWNlaXZlU2hhZG93cyIsIl9tYXRlcmlhbEFzc2V0IiwiX21hdGVyaWFsIiwiX2Nhc3RTaGFkb3dzTGlnaHRtYXAiLCJfbGlnaHRtYXBwZWQiLCJfbGlnaHRtYXBTaXplTXVsdGlwbGllciIsIl9pc1N0YXRpYyIsIl9sYXllcnMiLCJMQVlFUklEX1dPUkxEIiwiX2JhdGNoR3JvdXBJZCIsIl9jdXN0b21BYWJiIiwiX2FyZWEiLCJfbWF0ZXJpYWxFdmVudHMiLCJfY2xvbmVkTW9kZWwiLCJfYmF0Y2hHcm91cCIsImRlZmF1bHRNYXRlcmlhbCIsIm9uIiwib25SZW1vdmVDaGlsZCIsIm9uSW5zZXJ0Q2hpbGQiLCJtZXNoSW5zdGFuY2VzIiwidmFsdWUiLCJjdXN0b21BYWJiIiwibWkiLCJpIiwibGVuZ3RoIiwic2V0Q3VzdG9tQWFiYiIsInR5cGUiLCJfYmluZE1vZGVsQXNzZXQiLCJtb2RlbCIsInByaW1EYXRhIiwiZ2V0U2hhcGVQcmltaXRpdmUiLCJhcHAiLCJncmFwaGljc0RldmljZSIsImFyZWEiLCJtZXNoIiwibm9kZSIsIkdyYXBoTm9kZSIsIk1vZGVsIiwiZ3JhcGgiLCJNZXNoSW5zdGFuY2UiLCJhc3NldCIsImFzc2V0cyIsIl9pZCIsIkFzc2V0IiwiaWQiLCJvZmYiLCJfb25Nb2RlbEFzc2V0QWRkZWQiLCJfcHJldiIsImdldCIsIl91bmJpbmRNb2RlbEFzc2V0IiwiX2ltbXV0YWJsZSIsIkRlYnVnIiwiZXJyb3IiLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJnZXRHcmFwaCIsImRlc3Ryb3kiLCJfZW50aXR5IiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJpc1N0YXRpYyIsImxpZ2h0bWFwcGVkIiwiYWRkQ2hpbGQiLCJlbmFibGVkIiwiYWRkTW9kZWxUb0xheWVycyIsImFuaW1hdGlvbiIsInNldE1vZGVsIiwiYW5pbSIsInJlYmluZCIsIm1hcHBpbmciLCJfdW5zZXRNYXRlcmlhbEV2ZW50cyIsInNldExpZ2h0bWFwcGVkIiwiY2FzdFNoYWRvd3MiLCJsYXllcnMiLCJzY2VuZSIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZWNlaXZlU2hhZG93cyIsImxlbiIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwicmN2IiwibSIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwiYmF0Y2hHcm91cElkIiwiX3RoaXMkc3lzdGVtJGFwcCRiYXRjIiwiYmF0Y2hlciIsInJlbW92ZSIsIkJhdGNoR3JvdXAiLCJNT0RFTCIsIl90aGlzJHN5c3RlbSRhcHAkYmF0YzIiLCJpbnNlcnQiLCJtYXRlcmlhbEFzc2V0IiwiX29uTWF0ZXJpYWxBc3NldEFkZCIsIl91bmJpbmRNYXRlcmlhbEFzc2V0IiwiX3NldE1hdGVyaWFsIiwiX2JpbmRNYXRlcmlhbEFzc2V0IiwibWF0ZXJpYWwiLCJtb2RlbEFzc2V0IiwiYXNzZXRNYXBwaW5nIiwiZGF0YSIsInVuZGVmaW5lZCIsIl9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwiLCJwYXRoIiwidXJsIiwiX2dldE1hdGVyaWFsQXNzZXRVcmwiLCJnZXRCeVVybCIsIm9uUmVtb3ZlIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaW5kZXhPZiIsIl9zZXRNYXRlcmlhbEV2ZW50IiwiZXZlbnQiLCJoYW5kbGVyIiwiZXZ0IiwiZXZlbnRzIiwia2V5IiwiX2dldEFzc2V0QnlJZE9yUGF0aCIsImlkT3JQYXRoIiwiaXNQYXRoIiwiaXNOYU4iLCJwYXJzZUludCIsImdldEFic29sdXRlVXJsIiwibWVzaEluc3RhbmNlIiwicmVzb3VyY2UiLCJsb2FkIiwib25FbmFibGUiLCJpc0Fzc2V0IiwiX2FwcCRiYXRjaGVyIiwib25EaXNhYmxlIiwiX2FwcCRiYXRjaGVyMiIsImhpZGUiLCJpbnN0YW5jZXMiLCJsIiwidmlzaWJsZSIsInNob3ciLCJfb25NYXRlcmlhbEFzc2V0TG9hZCIsIl9vbk1hdGVyaWFsQXNzZXRVbmxvYWQiLCJfb25NYXRlcmlhbEFzc2V0UmVtb3ZlIiwiX29uTWF0ZXJpYWxBc3NldENoYW5nZSIsIl9vbk1vZGVsQXNzZXRMb2FkIiwiX29uTW9kZWxBc3NldFVubG9hZCIsIl9vbk1vZGVsQXNzZXRDaGFuZ2UiLCJfb25Nb2RlbEFzc2V0UmVtb3ZlIiwiY2xvbmUiLCJhdHRyIiwiX25ldyIsIl9vbGQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxjQUFjLFNBQVNDLFNBQVMsQ0FBQztBQXlHbkM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtBQWpIekI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxLQUFLLEdBQUcsT0FBTyxDQUFBO0FBRWY7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxRQUFRLEdBQUcsRUFBRSxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRW5CO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUV0QjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLGNBQWMsR0FBRyxJQUFJLENBQUE7QUFFckI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVQ7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxvQkFBb0IsR0FBRyxJQUFJLENBQUE7QUFFM0I7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxZQUFZLEdBQUcsS0FBSyxDQUFBO0FBRXBCO0FBQ0o7QUFDQTtBQUNBO0lB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
