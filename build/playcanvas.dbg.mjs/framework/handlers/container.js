/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { GlbParser } from '../parsers/glb-parser.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * @interface
 * @name ContainerResource
 * @description Container for a list of animations, textures, materials, renders and a model.
 * @property {import('../asset/asset.js').Asset[]} renders An array of the Render assets.
 * @property {import('../asset/asset.js').Asset[]} materials An array of {@link Material} and/or {@link StandardMaterial} assets.
 * @property {import('../asset/asset.js').Asset[]} textures An array of the {@link Texture} assets.
 * @property {import('../asset/asset.js').Asset[]} animations An array of the {@link Animation} assets.
 */
class ContainerResource {
  /**
   * Instantiates an entity with a model component.
   *
   * @param {object} [options] - The initialization data for the model component type
   * {@link ModelComponent}.
   * @returns {import('../entity.js').Entity} A single entity with a model component. Model
   * component internally contains a hierarchy based on {@link GraphNode}.
   * @example
   * // load a glb file and instantiate an entity with a model component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     var entity = asset.resource.instantiateModelEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   * });
   */
  instantiateModelEntity(options) {
    return null;
  }

  /**
   * Instantiates an entity with a render component.
   *
   * @param {object} [options] - The initialization data for the render component type
   * {@link RenderComponent}.
   * @returns {import('../entity.js').Entity} A hierarchy of entities with render components on
   * entities containing renderable geometry.
   * @example
   * // load a glb file and instantiate an entity with a render component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     var entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *
   *     // find all render components containing mesh instances, and change blend mode on their materials
   *     var renders = entity.findComponents("render");
   *     renders.forEach(function (render) {
   *         render.meshInstances.forEach(function (meshInstance) {
   *             meshInstance.material.blendType = pc.BLEND_MULTIPLICATIVE;
   *             meshInstance.material.update();
   *         });
   *     });
   * });
   */
  instantiateRenderEntity(options) {
    return null;
  }

  /**
   * Queries the list of available material variants.
   *
   * @returns {string[]} An array of variant names.
   */
  getMaterialVariants() {
    return null;
  }

  /**
   * Applies a material variant to an entity hierarchy.
   *
   * @param {import('../entity.js').Entity} entity - The entity root to which material variants
   * will be applied.
   * @param {string} [name] - The name of the variant, as queried from getMaterialVariants,
   * if null the variant will be reset to the default.
   * @example
   * // load a glb file and instantiate an entity with a render component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     var entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *     var materialVariants = asset.resource.getMaterialVariants();
   *     asset.resource.applyMaterialVariant(entity, materialVariants[0]);
   */
  applyMaterialVariant(entity, name) {}

  /**
   * Applies a material variant to a set of mesh instances. Compared to the applyMaterialVariant,
   * this method allows for setting the variant on a specific set of mesh instances instead of the
   * whole entity.
   *
   * @param {import('../../scene/mesh-instance').MeshInstance[]} instances - An array of mesh
   * instances.
   * @param {string} [name] - The the name of the variant, as quered from getMaterialVariants,
   * if null the variant will be reset to the default
   * @example
   * // load a glb file and instantiate an entity with a render component based on it
   * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
   *     var entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *     var materialVariants = asset.resource.getMaterialVariants();
   *     var renders = entity.findComponents("render");
   *     for (var i = 0; i < renders.length; i++) {
   *         var renderComponent = renders[i];
   *         asset.resource.applyMaterialVariantInstances(renderComponent.meshInstances, materialVariants[0]);
   *     }
   */
  applyMaterialVariantInstances(instances, name) {}
}

/**
 * Loads files that contain multiple resources. For example glTF files can contain textures, models
 * and animations.
 *
 * For glTF files, the asset options object can be used to pass load time callbacks for handling
 * the various resources at different stages of loading. The table below lists the resource types
 * and the corresponding supported process functions.
 *
 * ```
 * |---------------------------------------------------------------------|
 * |  resource   |  preprocess |   process   |processAsync | postprocess |
 * |-------------+-------------+-------------+-------------+-------------|
 * | global      |      x      |             |             |      x      |
 * | node        |      x      |      x      |             |      x      |
 * | light       |      x      |      x      |             |      x      |
 * | camera      |      x      |      x      |             |      x      |
 * | animation   |      x      |             |             |      x      |
 * | material    |      x      |      x      |             |      x      |
 * | image       |      x      |             |      x      |      x      |
 * | texture     |      x      |             |      x      |      x      |
 * | buffer      |      x      |             |      x      |      x      |
 * | bufferView  |      x      |             |      x      |      x      |
 * |---------------------------------------------------------------------|
 * ```
 *
 * Additional options that can be passed for glTF files:
 * [options.morphPreserveData] - When true, the morph target keeps its data passed using the options,
 * allowing the clone operation.
 * [options.skipMeshes] - When true, the meshes from the container are not created. This can be
 * useful if you only need access to textures or animations and similar.
 *
 * For example, to receive a texture preprocess callback:
 *
 * ```javascript
 * var containerAsset = new pc.Asset(filename, 'container', { url: url, filename: filename }, null, {
 *     texture: {
 *         preprocess(gltfTexture) { console.log("texture preprocess"); }
 *     },
 * });
 * ```
 *
 * @implements {ResourceHandler}
 */
class ContainerHandler {
  /**
   * Type of the resource the handler handles.
   *
   * @type {string}
   */

  /**
   * Create a new ContainerResource instance.
   *
   * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
  constructor(app) {
    this.handlerType = "container";
    this.glbParser = new GlbParser(app.graphicsDevice, app.assets, 0);
    this.parsers = {};
  }
  set maxRetries(value) {
    this.glbParser.maxRetries = value;
    for (const parser in this.parsers) {
      if (this.parsers.hasOwnProperty(parser)) {
        this.parsers[parser].maxRetries = value;
      }
    }
  }
  get maxRetries() {
    return this.glbParser.maxRetries;
  }

  /**
   * @param {string} url - The resource URL.
   * @returns {string} The URL with query parameters removed.
   * @private
   */
  _getUrlWithoutParams(url) {
    return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
  }

  /**
   * @param {string} url - The resource URL.
   * @returns {*} A suitable parser to parse the resource.
   * @private
   */
  _getParser(url) {
    const ext = url ? path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '') : null;
    return this.parsers[ext] || this.glbParser;
  }

  /**
   * @param {string|object} url - Either the URL of the resource to load or a structure
   * containing the load and original URL.
   * @param {string} [url.load] - The URL to be used for loading the resource.
   * @param {string} [url.original] - The original URL to be used for identifying the resource
   * format. This is necessary when loading, for example from blob.
   * @param {import('./handler.js').ResourceHandlerCallback} callback - The callback used when
   * the resource is loaded or an error occurs.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   */
  load(url, callback, asset) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    this._getParser(url.original).load(url, callback, asset);
  }

  /**
   * @param {string} url - The URL of the resource to open.
   * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   * @returns {*} The parsed resource data.
   */
  open(url, data, asset) {
    return this._getParser(url).open(url, data, asset);
  }

  /**
   * @param {import('../asset/asset.js').Asset} asset - The asset to patch.
   * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
   */
  patch(asset, assets) {}
}

export { ContainerHandler, ContainerResource };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGFpbmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2NvbnRhaW5lci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9wYXRoLmpzJztcblxuaW1wb3J0IHsgR2xiUGFyc2VyIH0gZnJvbSAnLi4vcGFyc2Vycy9nbGItcGFyc2VyLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vaGFuZGxlci5qcycpLlJlc291cmNlSGFuZGxlcn0gUmVzb3VyY2VIYW5kbGVyICovXG5cbi8qKlxuICogQGludGVyZmFjZVxuICogQG5hbWUgQ29udGFpbmVyUmVzb3VyY2VcbiAqIEBkZXNjcmlwdGlvbiBDb250YWluZXIgZm9yIGEgbGlzdCBvZiBhbmltYXRpb25zLCB0ZXh0dXJlcywgbWF0ZXJpYWxzLCByZW5kZXJzIGFuZCBhIG1vZGVsLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXRbXX0gcmVuZGVycyBBbiBhcnJheSBvZiB0aGUgUmVuZGVyIGFzc2V0cy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0W119IG1hdGVyaWFscyBBbiBhcnJheSBvZiB7QGxpbmsgTWF0ZXJpYWx9IGFuZC9vciB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbH0gYXNzZXRzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXRbXX0gdGV4dHVyZXMgQW4gYXJyYXkgb2YgdGhlIHtAbGluayBUZXh0dXJlfSBhc3NldHMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldFtdfSBhbmltYXRpb25zIEFuIGFycmF5IG9mIHRoZSB7QGxpbmsgQW5pbWF0aW9ufSBhc3NldHMuXG4gKi9cbmNsYXNzIENvbnRhaW5lclJlc291cmNlIHtcbiAgICAvKipcbiAgICAgKiBJbnN0YW50aWF0ZXMgYW4gZW50aXR5IHdpdGggYSBtb2RlbCBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gVGhlIGluaXRpYWxpemF0aW9uIGRhdGEgZm9yIHRoZSBtb2RlbCBjb21wb25lbnQgdHlwZVxuICAgICAqIHtAbGluayBNb2RlbENvbXBvbmVudH0uXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5fSBBIHNpbmdsZSBlbnRpdHkgd2l0aCBhIG1vZGVsIGNvbXBvbmVudC4gTW9kZWxcbiAgICAgKiBjb21wb25lbnQgaW50ZXJuYWxseSBjb250YWlucyBhIGhpZXJhcmNoeSBiYXNlZCBvbiB7QGxpbmsgR3JhcGhOb2RlfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgYSBnbGIgZmlsZSBhbmQgaW5zdGFudGlhdGUgYW4gZW50aXR5IHdpdGggYSBtb2RlbCBjb21wb25lbnQgYmFzZWQgb24gaXRcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWRGcm9tVXJsKFwic3RhdHVlLmdsYlwiLCBcImNvbnRhaW5lclwiLCBmdW5jdGlvbiAoZXJyLCBhc3NldCkge1xuICAgICAqICAgICB2YXIgZW50aXR5ID0gYXNzZXQucmVzb3VyY2UuaW5zdGFudGlhdGVNb2RlbEVudGl0eSh7XG4gICAgICogICAgICAgICBjYXN0U2hhZG93czogdHJ1ZVxuICAgICAqICAgICB9KTtcbiAgICAgKiAgICAgYXBwLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbnN0YW50aWF0ZU1vZGVsRW50aXR5KG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zdGFudGlhdGVzIGFuIGVudGl0eSB3aXRoIGEgcmVuZGVyIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgaW5pdGlhbGl6YXRpb24gZGF0YSBmb3IgdGhlIHJlbmRlciBjb21wb25lbnQgdHlwZVxuICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnR9LlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gQSBoaWVyYXJjaHkgb2YgZW50aXRpZXMgd2l0aCByZW5kZXIgY29tcG9uZW50cyBvblxuICAgICAqIGVudGl0aWVzIGNvbnRhaW5pbmcgcmVuZGVyYWJsZSBnZW9tZXRyeS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgYSBnbGIgZmlsZSBhbmQgaW5zdGFudGlhdGUgYW4gZW50aXR5IHdpdGggYSByZW5kZXIgY29tcG9uZW50IGJhc2VkIG9uIGl0XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybChcInN0YXR1ZS5nbGJcIiwgXCJjb250YWluZXJcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgdmFyIGVudGl0eSA9IGFzc2V0LnJlc291cmNlLmluc3RhbnRpYXRlUmVuZGVyRW50aXR5KHtcbiAgICAgKiAgICAgICAgIGNhc3RTaGFkb3dzOiB0cnVlXG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqXG4gICAgICogICAgIC8vIGZpbmQgYWxsIHJlbmRlciBjb21wb25lbnRzIGNvbnRhaW5pbmcgbWVzaCBpbnN0YW5jZXMsIGFuZCBjaGFuZ2UgYmxlbmQgbW9kZSBvbiB0aGVpciBtYXRlcmlhbHNcbiAgICAgKiAgICAgdmFyIHJlbmRlcnMgPSBlbnRpdHkuZmluZENvbXBvbmVudHMoXCJyZW5kZXJcIik7XG4gICAgICogICAgIHJlbmRlcnMuZm9yRWFjaChmdW5jdGlvbiAocmVuZGVyKSB7XG4gICAgICogICAgICAgICByZW5kZXIubWVzaEluc3RhbmNlcy5mb3JFYWNoKGZ1bmN0aW9uIChtZXNoSW5zdGFuY2UpIHtcbiAgICAgKiAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWF0ZXJpYWwuYmxlbmRUeXBlID0gcGMuQkxFTkRfTVVMVElQTElDQVRJVkU7XG4gICAgICogICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsLnVwZGF0ZSgpO1xuICAgICAqICAgICAgICAgfSk7XG4gICAgICogICAgIH0pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluc3RhbnRpYXRlUmVuZGVyRW50aXR5KG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgbGlzdCBvZiBhdmFpbGFibGUgbWF0ZXJpYWwgdmFyaWFudHMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119IEFuIGFycmF5IG9mIHZhcmlhbnQgbmFtZXMuXG4gICAgICovXG4gICAgZ2V0TWF0ZXJpYWxWYXJpYW50cygpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbGllcyBhIG1hdGVyaWFsIHZhcmlhbnQgdG8gYW4gZW50aXR5IGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgcm9vdCB0byB3aGljaCBtYXRlcmlhbCB2YXJpYW50c1xuICAgICAqIHdpbGwgYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIHZhcmlhbnQsIGFzIHF1ZXJpZWQgZnJvbSBnZXRNYXRlcmlhbFZhcmlhbnRzLFxuICAgICAqIGlmIG51bGwgdGhlIHZhcmlhbnQgd2lsbCBiZSByZXNldCB0byB0aGUgZGVmYXVsdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgYSBnbGIgZmlsZSBhbmQgaW5zdGFudGlhdGUgYW4gZW50aXR5IHdpdGggYSByZW5kZXIgY29tcG9uZW50IGJhc2VkIG9uIGl0XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybChcInN0YXR1ZS5nbGJcIiwgXCJjb250YWluZXJcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgdmFyIGVudGl0eSA9IGFzc2V0LnJlc291cmNlLmluc3RhbnRpYXRlUmVuZGVyRW50aXR5KHtcbiAgICAgKiAgICAgICAgIGNhc3RTaGFkb3dzOiB0cnVlXG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqICAgICB2YXIgbWF0ZXJpYWxWYXJpYW50cyA9IGFzc2V0LnJlc291cmNlLmdldE1hdGVyaWFsVmFyaWFudHMoKTtcbiAgICAgKiAgICAgYXNzZXQucmVzb3VyY2UuYXBwbHlNYXRlcmlhbFZhcmlhbnQoZW50aXR5LCBtYXRlcmlhbFZhcmlhbnRzWzBdKTtcbiAgICAgKi9cbiAgICBhcHBseU1hdGVyaWFsVmFyaWFudChlbnRpdHksIG5hbWUpIHt9XG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIGEgbWF0ZXJpYWwgdmFyaWFudCB0byBhIHNldCBvZiBtZXNoIGluc3RhbmNlcy4gQ29tcGFyZWQgdG8gdGhlIGFwcGx5TWF0ZXJpYWxWYXJpYW50LFxuICAgICAqIHRoaXMgbWV0aG9kIGFsbG93cyBmb3Igc2V0dGluZyB0aGUgdmFyaWFudCBvbiBhIHNwZWNpZmljIHNldCBvZiBtZXNoIGluc3RhbmNlcyBpbnN0ZWFkIG9mIHRoZVxuICAgICAqIHdob2xlIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlJykuTWVzaEluc3RhbmNlW119IGluc3RhbmNlcyAtIEFuIGFycmF5IG9mIG1lc2hcbiAgICAgKiBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSB0aGUgbmFtZSBvZiB0aGUgdmFyaWFudCwgYXMgcXVlcmVkIGZyb20gZ2V0TWF0ZXJpYWxWYXJpYW50cyxcbiAgICAgKiBpZiBudWxsIHRoZSB2YXJpYW50IHdpbGwgYmUgcmVzZXQgdG8gdGhlIGRlZmF1bHRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgYSBnbGIgZmlsZSBhbmQgaW5zdGFudGlhdGUgYW4gZW50aXR5IHdpdGggYSByZW5kZXIgY29tcG9uZW50IGJhc2VkIG9uIGl0XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybChcInN0YXR1ZS5nbGJcIiwgXCJjb250YWluZXJcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgdmFyIGVudGl0eSA9IGFzc2V0LnJlc291cmNlLmluc3RhbnRpYXRlUmVuZGVyRW50aXR5KHtcbiAgICAgKiAgICAgICAgIGNhc3RTaGFkb3dzOiB0cnVlXG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqICAgICB2YXIgbWF0ZXJpYWxWYXJpYW50cyA9IGFzc2V0LnJlc291cmNlLmdldE1hdGVyaWFsVmFyaWFudHMoKTtcbiAgICAgKiAgICAgdmFyIHJlbmRlcnMgPSBlbnRpdHkuZmluZENvbXBvbmVudHMoXCJyZW5kZXJcIik7XG4gICAgICogICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVuZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAqICAgICAgICAgdmFyIHJlbmRlckNvbXBvbmVudCA9IHJlbmRlcnNbaV07XG4gICAgICogICAgICAgICBhc3NldC5yZXNvdXJjZS5hcHBseU1hdGVyaWFsVmFyaWFudEluc3RhbmNlcyhyZW5kZXJDb21wb25lbnQubWVzaEluc3RhbmNlcywgbWF0ZXJpYWxWYXJpYW50c1swXSk7XG4gICAgICogICAgIH1cbiAgICAgKi9cbiAgICBhcHBseU1hdGVyaWFsVmFyaWFudEluc3RhbmNlcyhpbnN0YW5jZXMsIG5hbWUpIHt9XG59XG5cbi8qKlxuICogTG9hZHMgZmlsZXMgdGhhdCBjb250YWluIG11bHRpcGxlIHJlc291cmNlcy4gRm9yIGV4YW1wbGUgZ2xURiBmaWxlcyBjYW4gY29udGFpbiB0ZXh0dXJlcywgbW9kZWxzXG4gKiBhbmQgYW5pbWF0aW9ucy5cbiAqXG4gKiBGb3IgZ2xURiBmaWxlcywgdGhlIGFzc2V0IG9wdGlvbnMgb2JqZWN0IGNhbiBiZSB1c2VkIHRvIHBhc3MgbG9hZCB0aW1lIGNhbGxiYWNrcyBmb3IgaGFuZGxpbmdcbiAqIHRoZSB2YXJpb3VzIHJlc291cmNlcyBhdCBkaWZmZXJlbnQgc3RhZ2VzIG9mIGxvYWRpbmcuIFRoZSB0YWJsZSBiZWxvdyBsaXN0cyB0aGUgcmVzb3VyY2UgdHlwZXNcbiAqIGFuZCB0aGUgY29ycmVzcG9uZGluZyBzdXBwb3J0ZWQgcHJvY2VzcyBmdW5jdGlvbnMuXG4gKlxuICogYGBgXG4gKiB8LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICogfCAgcmVzb3VyY2UgICB8ICBwcmVwcm9jZXNzIHwgICBwcm9jZXNzICAgfHByb2Nlc3NBc3luYyB8IHBvc3Rwcm9jZXNzIHxcbiAqIHwtLS0tLS0tLS0tLS0tKy0tLS0tLS0tLS0tLS0rLS0tLS0tLS0tLS0tLSstLS0tLS0tLS0tLS0tKy0tLS0tLS0tLS0tLS18XG4gKiB8IGdsb2JhbCAgICAgIHwgICAgICB4ICAgICAgfCAgICAgICAgICAgICB8ICAgICAgICAgICAgIHwgICAgICB4ICAgICAgfFxuICogfCBub2RlICAgICAgICB8ICAgICAgeCAgICAgIHwgICAgICB4ICAgICAgfCAgICAgICAgICAgICB8ICAgICAgeCAgICAgIHxcbiAqIHwgbGlnaHQgICAgICAgfCAgICAgIHggICAgICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgIHggICAgICB8XG4gKiB8IGNhbWVyYSAgICAgIHwgICAgICB4ICAgICAgfCAgICAgIHggICAgICB8ICAgICAgICAgICAgIHwgICAgICB4ICAgICAgfFxuICogfCBhbmltYXRpb24gICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgICAgICAgICB8ICAgICAgeCAgICAgIHxcbiAqIHwgbWF0ZXJpYWwgICAgfCAgICAgIHggICAgICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgIHggICAgICB8XG4gKiB8IGltYWdlICAgICAgIHwgICAgICB4ICAgICAgfCAgICAgICAgICAgICB8ICAgICAgeCAgICAgIHwgICAgICB4ICAgICAgfFxuICogfCB0ZXh0dXJlICAgICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgIHggICAgICB8ICAgICAgeCAgICAgIHxcbiAqIHwgYnVmZmVyICAgICAgfCAgICAgIHggICAgICB8ICAgICAgICAgICAgIHwgICAgICB4ICAgICAgfCAgICAgIHggICAgICB8XG4gKiB8IGJ1ZmZlclZpZXcgIHwgICAgICB4ICAgICAgfCAgICAgICAgICAgICB8ICAgICAgeCAgICAgIHwgICAgICB4ICAgICAgfFxuICogfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAqIGBgYFxuICpcbiAqIEFkZGl0aW9uYWwgb3B0aW9ucyB0aGF0IGNhbiBiZSBwYXNzZWQgZm9yIGdsVEYgZmlsZXM6XG4gKiBbb3B0aW9ucy5tb3JwaFByZXNlcnZlRGF0YV0gLSBXaGVuIHRydWUsIHRoZSBtb3JwaCB0YXJnZXQga2VlcHMgaXRzIGRhdGEgcGFzc2VkIHVzaW5nIHRoZSBvcHRpb25zLFxuICogYWxsb3dpbmcgdGhlIGNsb25lIG9wZXJhdGlvbi5cbiAqIFtvcHRpb25zLnNraXBNZXNoZXNdIC0gV2hlbiB0cnVlLCB0aGUgbWVzaGVzIGZyb20gdGhlIGNvbnRhaW5lciBhcmUgbm90IGNyZWF0ZWQuIFRoaXMgY2FuIGJlXG4gKiB1c2VmdWwgaWYgeW91IG9ubHkgbmVlZCBhY2Nlc3MgdG8gdGV4dHVyZXMgb3IgYW5pbWF0aW9ucyBhbmQgc2ltaWxhci5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgdG8gcmVjZWl2ZSBhIHRleHR1cmUgcHJlcHJvY2VzcyBjYWxsYmFjazpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgY29udGFpbmVyQXNzZXQgPSBuZXcgcGMuQXNzZXQoZmlsZW5hbWUsICdjb250YWluZXInLCB7IHVybDogdXJsLCBmaWxlbmFtZTogZmlsZW5hbWUgfSwgbnVsbCwge1xuICogICAgIHRleHR1cmU6IHtcbiAqICAgICAgICAgcHJlcHJvY2VzcyhnbHRmVGV4dHVyZSkgeyBjb25zb2xlLmxvZyhcInRleHR1cmUgcHJlcHJvY2Vzc1wiKTsgfVxuICogICAgIH0sXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEBpbXBsZW1lbnRzIHtSZXNvdXJjZUhhbmRsZXJ9XG4gKi9cbmNsYXNzIENvbnRhaW5lckhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIFR5cGUgb2YgdGhlIHJlc291cmNlIHRoZSBoYW5kbGVyIGhhbmRsZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGhhbmRsZXJUeXBlID0gXCJjb250YWluZXJcIjtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWluZXJSZXNvdXJjZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBydW5uaW5nIHtAbGluayBBcHBCYXNlfS5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHRoaXMuZ2xiUGFyc2VyID0gbmV3IEdsYlBhcnNlcihhcHAuZ3JhcGhpY3NEZXZpY2UsIGFwcC5hc3NldHMsIDApO1xuICAgICAgICB0aGlzLnBhcnNlcnMgPSB7IH07XG4gICAgfVxuXG4gICAgc2V0IG1heFJldHJpZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5nbGJQYXJzZXIubWF4UmV0cmllcyA9IHZhbHVlO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcnNlciBpbiB0aGlzLnBhcnNlcnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcnNlcnMuaGFzT3duUHJvcGVydHkocGFyc2VyKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyc2Vyc1twYXJzZXJdLm1heFJldHJpZXMgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXhSZXRyaWVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nbGJQYXJzZXIubWF4UmV0cmllcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIHJlc291cmNlIFVSTC5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgVVJMIHdpdGggcXVlcnkgcGFyYW1ldGVycyByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFVybFdpdGhvdXRQYXJhbXModXJsKSB7XG4gICAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID49IDAgPyB1cmwuc3BsaXQoJz8nKVswXSA6IHVybDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIHJlc291cmNlIFVSTC5cbiAgICAgKiBAcmV0dXJucyB7Kn0gQSBzdWl0YWJsZSBwYXJzZXIgdG8gcGFyc2UgdGhlIHJlc291cmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFBhcnNlcih1cmwpIHtcbiAgICAgICAgY29uc3QgZXh0ID0gdXJsID8gcGF0aC5nZXRFeHRlbnNpb24odGhpcy5fZ2V0VXJsV2l0aG91dFBhcmFtcyh1cmwpKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoJy4nLCAnJykgOiBudWxsO1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZXJzW2V4dF0gfHwgdGhpcy5nbGJQYXJzZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSB1cmwgLSBFaXRoZXIgdGhlIFVSTCBvZiB0aGUgcmVzb3VyY2UgdG8gbG9hZCBvciBhIHN0cnVjdHVyZVxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGxvYWQgYW5kIG9yaWdpbmFsIFVSTC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3VybC5sb2FkXSAtIFRoZSBVUkwgdG8gYmUgdXNlZCBmb3IgbG9hZGluZyB0aGUgcmVzb3VyY2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFt1cmwub3JpZ2luYWxdIC0gVGhlIG9yaWdpbmFsIFVSTCB0byBiZSB1c2VkIGZvciBpZGVudGlmeWluZyB0aGUgcmVzb3VyY2VcbiAgICAgKiBmb3JtYXQuIFRoaXMgaXMgbmVjZXNzYXJ5IHdoZW4gbG9hZGluZywgZm9yIGV4YW1wbGUgZnJvbSBibG9iLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2hhbmRsZXIuanMnKS5SZXNvdXJjZUhhbmRsZXJDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgdXNlZCB3aGVuXG4gICAgICogdGhlIHJlc291cmNlIGlzIGxvYWRlZCBvciBhbiBlcnJvciBvY2N1cnMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXR9IFthc3NldF0gLSBPcHRpb25hbCBhc3NldCB0aGF0IGlzIHBhc3NlZCBieVxuICAgICAqIFJlc291cmNlTG9hZGVyLlxuICAgICAqL1xuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSB7XG4gICAgICAgICAgICAgICAgbG9hZDogdXJsLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsOiB1cmxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9nZXRQYXJzZXIodXJsLm9yaWdpbmFsKS5sb2FkKHVybCwgY2FsbGJhY2ssIGFzc2V0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIFVSTCBvZiB0aGUgcmVzb3VyY2UgdG8gb3Blbi5cbiAgICAgKiBAcGFyYW0geyp9IGRhdGEgLSBUaGUgcmF3IHJlc291cmNlIGRhdGEgcGFzc2VkIGJ5IGNhbGxiYWNrIGZyb20ge0BsaW5rIFJlc291cmNlSGFuZGxlciNsb2FkfS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gW2Fzc2V0XSAtIE9wdGlvbmFsIGFzc2V0IHRoYXQgaXMgcGFzc2VkIGJ5XG4gICAgICogUmVzb3VyY2VMb2FkZXIuXG4gICAgICogQHJldHVybnMgeyp9IFRoZSBwYXJzZWQgcmVzb3VyY2UgZGF0YS5cbiAgICAgKi9cbiAgICBvcGVuKHVybCwgZGF0YSwgYXNzZXQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFBhcnNlcih1cmwpLm9wZW4odXJsLCBkYXRhLCBhc3NldCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRvIHBhdGNoLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcycpLkFzc2V0UmVnaXN0cnl9IGFzc2V0cyAtIFRoZSBhc3NldCByZWdpc3RyeS5cbiAgICAgKi9cbiAgICBwYXRjaChhc3NldCwgYXNzZXRzKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCB7IENvbnRhaW5lclJlc291cmNlLCBDb250YWluZXJIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsiQ29udGFpbmVyUmVzb3VyY2UiLCJpbnN0YW50aWF0ZU1vZGVsRW50aXR5Iiwib3B0aW9ucyIsImluc3RhbnRpYXRlUmVuZGVyRW50aXR5IiwiZ2V0TWF0ZXJpYWxWYXJpYW50cyIsImFwcGx5TWF0ZXJpYWxWYXJpYW50IiwiZW50aXR5IiwibmFtZSIsImFwcGx5TWF0ZXJpYWxWYXJpYW50SW5zdGFuY2VzIiwiaW5zdGFuY2VzIiwiQ29udGFpbmVySGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiaGFuZGxlclR5cGUiLCJnbGJQYXJzZXIiLCJHbGJQYXJzZXIiLCJncmFwaGljc0RldmljZSIsImFzc2V0cyIsInBhcnNlcnMiLCJtYXhSZXRyaWVzIiwidmFsdWUiLCJwYXJzZXIiLCJoYXNPd25Qcm9wZXJ0eSIsIl9nZXRVcmxXaXRob3V0UGFyYW1zIiwidXJsIiwiaW5kZXhPZiIsInNwbGl0IiwiX2dldFBhcnNlciIsImV4dCIsInBhdGgiLCJnZXRFeHRlbnNpb24iLCJ0b0xvd2VyQ2FzZSIsInJlcGxhY2UiLCJsb2FkIiwiY2FsbGJhY2siLCJhc3NldCIsIm9yaWdpbmFsIiwib3BlbiIsImRhdGEiLCJwYXRjaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFJQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxpQkFBaUIsQ0FBQztBQUNwQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxzQkFBc0IsQ0FBQ0MsT0FBTyxFQUFFO0FBQzVCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLHVCQUF1QixDQUFDRCxPQUFPLEVBQUU7QUFDN0IsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJRSxFQUFBQSxtQkFBbUIsR0FBRztBQUNsQixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtB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
