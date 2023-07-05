import { path } from '../../core/path.js';
import { GlbContainerParser } from '../parsers/glb-container-parser.js';

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
   *     const entity = asset.resource.instantiateModelEntity({
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
   *     const entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *
   *     // find all render components containing mesh instances, and change blend mode on their materials
   *     const renders = entity.findComponents("render");
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
   *     const entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *     const materialVariants = asset.resource.getMaterialVariants();
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
   *     const entity = asset.resource.instantiateRenderEntity({
   *         castShadows: true
   *     });
   *     app.root.addChild(entity);
   *     const materialVariants = asset.resource.getMaterialVariants();
   *     const renders = entity.findComponents("render");
   *     for (let i = 0; i < renders.length; i++) {
   *         const renderComponent = renders[i];
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
 * [options.morphPreferHighPrecision] - When true, high precision storage for morph targets should
 * be prefered. This is faster to create and allows higher precision, but takes more memory and
 * might be slower to render. Defaults to false.
 * [options.skipMeshes] - When true, the meshes from the container are not created. This can be
 * useful if you only need access to textures or animations and similar.
 *
 * For example, to receive a texture preprocess callback:
 *
 * ```javascript
 * const containerAsset = new pc.Asset(filename, 'container', { url: url, filename: filename }, null, {
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
   * Create a new ContainerResource instance.
   *
   * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
  constructor(app) {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    this.handlerType = "container";
    this.glbContainerParser = new GlbContainerParser(app.graphicsDevice, app.assets, 0);
    this.parsers = {};
  }
  set maxRetries(value) {
    this.glbContainerParser.maxRetries = value;
    for (const parser in this.parsers) {
      if (this.parsers.hasOwnProperty(parser)) {
        this.parsers[parser].maxRetries = value;
      }
    }
  }
  get maxRetries() {
    return this.glbContainerParser.maxRetries;
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
    return this.parsers[ext] || this.glbContainerParser;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGFpbmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2NvbnRhaW5lci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9wYXRoLmpzJztcblxuaW1wb3J0IHsgR2xiQ29udGFpbmVyUGFyc2VyIH0gZnJvbSAnLi4vcGFyc2Vycy9nbGItY29udGFpbmVyLXBhcnNlci5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2hhbmRsZXIuanMnKS5SZXNvdXJjZUhhbmRsZXJ9IFJlc291cmNlSGFuZGxlciAqL1xuXG4vKipcbiAqIEBpbnRlcmZhY2VcbiAqIEBuYW1lIENvbnRhaW5lclJlc291cmNlXG4gKiBAZGVzY3JpcHRpb24gQ29udGFpbmVyIGZvciBhIGxpc3Qgb2YgYW5pbWF0aW9ucywgdGV4dHVyZXMsIG1hdGVyaWFscywgcmVuZGVycyBhbmQgYSBtb2RlbC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0W119IHJlbmRlcnMgQW4gYXJyYXkgb2YgdGhlIFJlbmRlciBhc3NldHMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldFtdfSBtYXRlcmlhbHMgQW4gYXJyYXkgb2Yge0BsaW5rIE1hdGVyaWFsfSBhbmQvb3Ige0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWx9IGFzc2V0cy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0W119IHRleHR1cmVzIEFuIGFycmF5IG9mIHRoZSB7QGxpbmsgVGV4dHVyZX0gYXNzZXRzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXRbXX0gYW5pbWF0aW9ucyBBbiBhcnJheSBvZiB0aGUge0BsaW5rIEFuaW1hdGlvbn0gYXNzZXRzLlxuICovXG5jbGFzcyBDb250YWluZXJSZXNvdXJjZSB7XG4gICAgLyoqXG4gICAgICogSW5zdGFudGlhdGVzIGFuIGVudGl0eSB3aXRoIGEgbW9kZWwgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIFRoZSBpbml0aWFsaXphdGlvbiBkYXRhIGZvciB0aGUgbW9kZWwgY29tcG9uZW50IHR5cGVcbiAgICAgKiB7QGxpbmsgTW9kZWxDb21wb25lbnR9LlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gQSBzaW5nbGUgZW50aXR5IHdpdGggYSBtb2RlbCBjb21wb25lbnQuIE1vZGVsXG4gICAgICogY29tcG9uZW50IGludGVybmFsbHkgY29udGFpbnMgYSBoaWVyYXJjaHkgYmFzZWQgb24ge0BsaW5rIEdyYXBoTm9kZX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBsb2FkIGEgZ2xiIGZpbGUgYW5kIGluc3RhbnRpYXRlIGFuIGVudGl0eSB3aXRoIGEgbW9kZWwgY29tcG9uZW50IGJhc2VkIG9uIGl0XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybChcInN0YXR1ZS5nbGJcIiwgXCJjb250YWluZXJcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc3QgZW50aXR5ID0gYXNzZXQucmVzb3VyY2UuaW5zdGFudGlhdGVNb2RlbEVudGl0eSh7XG4gICAgICogICAgICAgICBjYXN0U2hhZG93czogdHJ1ZVxuICAgICAqICAgICB9KTtcbiAgICAgKiAgICAgYXBwLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbnN0YW50aWF0ZU1vZGVsRW50aXR5KG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zdGFudGlhdGVzIGFuIGVudGl0eSB3aXRoIGEgcmVuZGVyIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgaW5pdGlhbGl6YXRpb24gZGF0YSBmb3IgdGhlIHJlbmRlciBjb21wb25lbnQgdHlwZVxuICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnR9LlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gQSBoaWVyYXJjaHkgb2YgZW50aXRpZXMgd2l0aCByZW5kZXIgY29tcG9uZW50cyBvblxuICAgICAqIGVudGl0aWVzIGNvbnRhaW5pbmcgcmVuZGVyYWJsZSBnZW9tZXRyeS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgYSBnbGIgZmlsZSBhbmQgaW5zdGFudGlhdGUgYW4gZW50aXR5IHdpdGggYSByZW5kZXIgY29tcG9uZW50IGJhc2VkIG9uIGl0XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybChcInN0YXR1ZS5nbGJcIiwgXCJjb250YWluZXJcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc3QgZW50aXR5ID0gYXNzZXQucmVzb3VyY2UuaW5zdGFudGlhdGVSZW5kZXJFbnRpdHkoe1xuICAgICAqICAgICAgICAgY2FzdFNoYWRvd3M6IHRydWVcbiAgICAgKiAgICAgfSk7XG4gICAgICogICAgIGFwcC5yb290LmFkZENoaWxkKGVudGl0eSk7XG4gICAgICpcbiAgICAgKiAgICAgLy8gZmluZCBhbGwgcmVuZGVyIGNvbXBvbmVudHMgY29udGFpbmluZyBtZXNoIGluc3RhbmNlcywgYW5kIGNoYW5nZSBibGVuZCBtb2RlIG9uIHRoZWlyIG1hdGVyaWFsc1xuICAgICAqICAgICBjb25zdCByZW5kZXJzID0gZW50aXR5LmZpbmRDb21wb25lbnRzKFwicmVuZGVyXCIpO1xuICAgICAqICAgICByZW5kZXJzLmZvckVhY2goZnVuY3Rpb24gKHJlbmRlcikge1xuICAgICAqICAgICAgICAgcmVuZGVyLm1lc2hJbnN0YW5jZXMuZm9yRWFjaChmdW5jdGlvbiAobWVzaEluc3RhbmNlKSB7XG4gICAgICogICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsLmJsZW5kVHlwZSA9IHBjLkJMRU5EX01VTFRJUExJQ0FUSVZFO1xuICAgICAqICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqICAgICB9KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbnN0YW50aWF0ZVJlbmRlckVudGl0eShvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGxpc3Qgb2YgYXZhaWxhYmxlIG1hdGVyaWFsIHZhcmlhbnRzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ1tdfSBBbiBhcnJheSBvZiB2YXJpYW50IG5hbWVzLlxuICAgICAqL1xuICAgIGdldE1hdGVyaWFsVmFyaWFudHMoKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGxpZXMgYSBtYXRlcmlhbCB2YXJpYW50IHRvIGFuIGVudGl0eSBoaWVyYXJjaHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHJvb3QgdG8gd2hpY2ggbWF0ZXJpYWwgdmFyaWFudHNcbiAgICAgKiB3aWxsIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSB2YXJpYW50LCBhcyBxdWVyaWVkIGZyb20gZ2V0TWF0ZXJpYWxWYXJpYW50cyxcbiAgICAgKiBpZiBudWxsIHRoZSB2YXJpYW50IHdpbGwgYmUgcmVzZXQgdG8gdGhlIGRlZmF1bHQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBsb2FkIGEgZ2xiIGZpbGUgYW5kIGluc3RhbnRpYXRlIGFuIGVudGl0eSB3aXRoIGEgcmVuZGVyIGNvbXBvbmVudCBiYXNlZCBvbiBpdFxuICAgICAqIGFwcC5hc3NldHMubG9hZEZyb21VcmwoXCJzdGF0dWUuZ2xiXCIsIFwiY29udGFpbmVyXCIsIGZ1bmN0aW9uIChlcnIsIGFzc2V0KSB7XG4gICAgICogICAgIGNvbnN0IGVudGl0eSA9IGFzc2V0LnJlc291cmNlLmluc3RhbnRpYXRlUmVuZGVyRW50aXR5KHtcbiAgICAgKiAgICAgICAgIGNhc3RTaGFkb3dzOiB0cnVlXG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqICAgICBjb25zdCBtYXRlcmlhbFZhcmlhbnRzID0gYXNzZXQucmVzb3VyY2UuZ2V0TWF0ZXJpYWxWYXJpYW50cygpO1xuICAgICAqICAgICBhc3NldC5yZXNvdXJjZS5hcHBseU1hdGVyaWFsVmFyaWFudChlbnRpdHksIG1hdGVyaWFsVmFyaWFudHNbMF0pO1xuICAgICAqL1xuICAgIGFwcGx5TWF0ZXJpYWxWYXJpYW50KGVudGl0eSwgbmFtZSkge31cblxuICAgIC8qKlxuICAgICAqIEFwcGxpZXMgYSBtYXRlcmlhbCB2YXJpYW50IHRvIGEgc2V0IG9mIG1lc2ggaW5zdGFuY2VzLiBDb21wYXJlZCB0byB0aGUgYXBwbHlNYXRlcmlhbFZhcmlhbnQsXG4gICAgICogdGhpcyBtZXRob2QgYWxsb3dzIGZvciBzZXR0aW5nIHRoZSB2YXJpYW50IG9uIGEgc3BlY2lmaWMgc2V0IG9mIG1lc2ggaW5zdGFuY2VzIGluc3RlYWQgb2YgdGhlXG4gICAgICogd2hvbGUgZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UnKS5NZXNoSW5zdGFuY2VbXX0gaW5zdGFuY2VzIC0gQW4gYXJyYXkgb2YgbWVzaFxuICAgICAqIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIC0gVGhlIHRoZSBuYW1lIG9mIHRoZSB2YXJpYW50LCBhcyBxdWVyZWQgZnJvbSBnZXRNYXRlcmlhbFZhcmlhbnRzLFxuICAgICAqIGlmIG51bGwgdGhlIHZhcmlhbnQgd2lsbCBiZSByZXNldCB0byB0aGUgZGVmYXVsdFxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gbG9hZCBhIGdsYiBmaWxlIGFuZCBpbnN0YW50aWF0ZSBhbiBlbnRpdHkgd2l0aCBhIHJlbmRlciBjb21wb25lbnQgYmFzZWQgb24gaXRcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWRGcm9tVXJsKFwic3RhdHVlLmdsYlwiLCBcImNvbnRhaW5lclwiLCBmdW5jdGlvbiAoZXJyLCBhc3NldCkge1xuICAgICAqICAgICBjb25zdCBlbnRpdHkgPSBhc3NldC5yZXNvdXJjZS5pbnN0YW50aWF0ZVJlbmRlckVudGl0eSh7XG4gICAgICogICAgICAgICBjYXN0U2hhZG93czogdHJ1ZVxuICAgICAqICAgICB9KTtcbiAgICAgKiAgICAgYXBwLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcbiAgICAgKiAgICAgY29uc3QgbWF0ZXJpYWxWYXJpYW50cyA9IGFzc2V0LnJlc291cmNlLmdldE1hdGVyaWFsVmFyaWFudHMoKTtcbiAgICAgKiAgICAgY29uc3QgcmVuZGVycyA9IGVudGl0eS5maW5kQ29tcG9uZW50cyhcInJlbmRlclwiKTtcbiAgICAgKiAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICogICAgICAgICBjb25zdCByZW5kZXJDb21wb25lbnQgPSByZW5kZXJzW2ldO1xuICAgICAqICAgICAgICAgYXNzZXQucmVzb3VyY2UuYXBwbHlNYXRlcmlhbFZhcmlhbnRJbnN0YW5jZXMocmVuZGVyQ29tcG9uZW50Lm1lc2hJbnN0YW5jZXMsIG1hdGVyaWFsVmFyaWFudHNbMF0pO1xuICAgICAqICAgICB9XG4gICAgICovXG4gICAgYXBwbHlNYXRlcmlhbFZhcmlhbnRJbnN0YW5jZXMoaW5zdGFuY2VzLCBuYW1lKSB7fVxufVxuXG4vKipcbiAqIExvYWRzIGZpbGVzIHRoYXQgY29udGFpbiBtdWx0aXBsZSByZXNvdXJjZXMuIEZvciBleGFtcGxlIGdsVEYgZmlsZXMgY2FuIGNvbnRhaW4gdGV4dHVyZXMsIG1vZGVsc1xuICogYW5kIGFuaW1hdGlvbnMuXG4gKlxuICogRm9yIGdsVEYgZmlsZXMsIHRoZSBhc3NldCBvcHRpb25zIG9iamVjdCBjYW4gYmUgdXNlZCB0byBwYXNzIGxvYWQgdGltZSBjYWxsYmFja3MgZm9yIGhhbmRsaW5nXG4gKiB0aGUgdmFyaW91cyByZXNvdXJjZXMgYXQgZGlmZmVyZW50IHN0YWdlcyBvZiBsb2FkaW5nLiBUaGUgdGFibGUgYmVsb3cgbGlzdHMgdGhlIHJlc291cmNlIHR5cGVzXG4gKiBhbmQgdGhlIGNvcnJlc3BvbmRpbmcgc3VwcG9ydGVkIHByb2Nlc3MgZnVuY3Rpb25zLlxuICpcbiAqIGBgYFxuICogfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAqIHwgIHJlc291cmNlICAgfCAgcHJlcHJvY2VzcyB8ICAgcHJvY2VzcyAgIHxwcm9jZXNzQXN5bmMgfCBwb3N0cHJvY2VzcyB8XG4gKiB8LS0tLS0tLS0tLS0tLSstLS0tLS0tLS0tLS0tKy0tLS0tLS0tLS0tLS0rLS0tLS0tLS0tLS0tLSstLS0tLS0tLS0tLS0tfFxuICogfCBnbG9iYWwgICAgICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgICAgICAgICB8ICAgICAgeCAgICAgIHxcbiAqIHwgbm9kZSAgICAgICAgfCAgICAgIHggICAgICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgIHggICAgICB8XG4gKiB8IGxpZ2h0ICAgICAgIHwgICAgICB4ICAgICAgfCAgICAgIHggICAgICB8ICAgICAgICAgICAgIHwgICAgICB4ICAgICAgfFxuICogfCBjYW1lcmEgICAgICB8ICAgICAgeCAgICAgIHwgICAgICB4ICAgICAgfCAgICAgICAgICAgICB8ICAgICAgeCAgICAgIHxcbiAqIHwgYW5pbWF0aW9uICAgfCAgICAgIHggICAgICB8ICAgICAgICAgICAgIHwgICAgICAgICAgICAgfCAgICAgIHggICAgICB8XG4gKiB8IG1hdGVyaWFsICAgIHwgICAgICB4ICAgICAgfCAgICAgIHggICAgICB8ICAgICAgICAgICAgIHwgICAgICB4ICAgICAgfFxuICogfCBpbWFnZSAgICAgICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgIHggICAgICB8ICAgICAgeCAgICAgIHxcbiAqIHwgdGV4dHVyZSAgICAgfCAgICAgIHggICAgICB8ICAgICAgICAgICAgIHwgICAgICB4ICAgICAgfCAgICAgIHggICAgICB8XG4gKiB8IGJ1ZmZlciAgICAgIHwgICAgICB4ICAgICAgfCAgICAgICAgICAgICB8ICAgICAgeCAgICAgIHwgICAgICB4ICAgICAgfFxuICogfCBidWZmZXJWaWV3ICB8ICAgICAgeCAgICAgIHwgICAgICAgICAgICAgfCAgICAgIHggICAgICB8ICAgICAgeCAgICAgIHxcbiAqIHwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18XG4gKiBgYGBcbiAqXG4gKiBBZGRpdGlvbmFsIG9wdGlvbnMgdGhhdCBjYW4gYmUgcGFzc2VkIGZvciBnbFRGIGZpbGVzOlxuICogW29wdGlvbnMubW9ycGhQcmVzZXJ2ZURhdGFdIC0gV2hlbiB0cnVlLCB0aGUgbW9ycGggdGFyZ2V0IGtlZXBzIGl0cyBkYXRhIHBhc3NlZCB1c2luZyB0aGUgb3B0aW9ucyxcbiAqIGFsbG93aW5nIHRoZSBjbG9uZSBvcGVyYXRpb24uXG4gKiBbb3B0aW9ucy5tb3JwaFByZWZlckhpZ2hQcmVjaXNpb25dIC0gV2hlbiB0cnVlLCBoaWdoIHByZWNpc2lvbiBzdG9yYWdlIGZvciBtb3JwaCB0YXJnZXRzIHNob3VsZFxuICogYmUgcHJlZmVyZWQuIFRoaXMgaXMgZmFzdGVyIHRvIGNyZWF0ZSBhbmQgYWxsb3dzIGhpZ2hlciBwcmVjaXNpb24sIGJ1dCB0YWtlcyBtb3JlIG1lbW9yeSBhbmRcbiAqIG1pZ2h0IGJlIHNsb3dlciB0byByZW5kZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICogW29wdGlvbnMuc2tpcE1lc2hlc10gLSBXaGVuIHRydWUsIHRoZSBtZXNoZXMgZnJvbSB0aGUgY29udGFpbmVyIGFyZSBub3QgY3JlYXRlZC4gVGhpcyBjYW4gYmVcbiAqIHVzZWZ1bCBpZiB5b3Ugb25seSBuZWVkIGFjY2VzcyB0byB0ZXh0dXJlcyBvciBhbmltYXRpb25zIGFuZCBzaW1pbGFyLlxuICpcbiAqIEZvciBleGFtcGxlLCB0byByZWNlaXZlIGEgdGV4dHVyZSBwcmVwcm9jZXNzIGNhbGxiYWNrOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGNvbnN0IGNvbnRhaW5lckFzc2V0ID0gbmV3IHBjLkFzc2V0KGZpbGVuYW1lLCAnY29udGFpbmVyJywgeyB1cmw6IHVybCwgZmlsZW5hbWU6IGZpbGVuYW1lIH0sIG51bGwsIHtcbiAqICAgICB0ZXh0dXJlOiB7XG4gKiAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZlRleHR1cmUpIHsgY29uc29sZS5sb2coXCJ0ZXh0dXJlIHByZXByb2Nlc3NcIik7IH1cbiAqICAgICB9LFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAaW1wbGVtZW50cyB7UmVzb3VyY2VIYW5kbGVyfVxuICovXG5jbGFzcyBDb250YWluZXJIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHRoZSByZXNvdXJjZSB0aGUgaGFuZGxlciBoYW5kbGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBoYW5kbGVyVHlwZSA9IFwiY29udGFpbmVyXCI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ29udGFpbmVyUmVzb3VyY2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICB0aGlzLmdsYkNvbnRhaW5lclBhcnNlciA9IG5ldyBHbGJDb250YWluZXJQYXJzZXIoYXBwLmdyYXBoaWNzRGV2aWNlLCBhcHAuYXNzZXRzLCAwKTtcbiAgICAgICAgdGhpcy5wYXJzZXJzID0geyB9O1xuICAgIH1cblxuICAgIHNldCBtYXhSZXRyaWVzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZ2xiQ29udGFpbmVyUGFyc2VyLm1heFJldHJpZXMgPSB2YWx1ZTtcbiAgICAgICAgZm9yIChjb25zdCBwYXJzZXIgaW4gdGhpcy5wYXJzZXJzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJzZXJzLmhhc093blByb3BlcnR5KHBhcnNlcikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlcnNbcGFyc2VyXS5tYXhSZXRyaWVzID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF4UmV0cmllcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2xiQ29udGFpbmVyUGFyc2VyLm1heFJldHJpZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSByZXNvdXJjZSBVUkwuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIFVSTCB3aXRoIHF1ZXJ5IHBhcmFtZXRlcnMgcmVtb3ZlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRVcmxXaXRob3V0UGFyYW1zKHVybCkge1xuICAgICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA+PSAwID8gdXJsLnNwbGl0KCc/JylbMF0gOiB1cmw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSByZXNvdXJjZSBVUkwuXG4gICAgICogQHJldHVybnMgeyp9IEEgc3VpdGFibGUgcGFyc2VyIHRvIHBhcnNlIHRoZSByZXNvdXJjZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRQYXJzZXIodXJsKSB7XG4gICAgICAgIGNvbnN0IGV4dCA9IHVybCA/IHBhdGguZ2V0RXh0ZW5zaW9uKHRoaXMuX2dldFVybFdpdGhvdXRQYXJhbXModXJsKSkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKCcuJywgJycpIDogbnVsbDtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2Vyc1tleHRdIHx8IHRoaXMuZ2xiQ29udGFpbmVyUGFyc2VyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gdXJsIC0gRWl0aGVyIHRoZSBVUkwgb2YgdGhlIHJlc291cmNlIHRvIGxvYWQgb3IgYSBzdHJ1Y3R1cmVcbiAgICAgKiBjb250YWluaW5nIHRoZSBsb2FkIGFuZCBvcmlnaW5hbCBVUkwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFt1cmwubG9hZF0gLSBUaGUgVVJMIHRvIGJlIHVzZWQgZm9yIGxvYWRpbmcgdGhlIHJlc291cmNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbdXJsLm9yaWdpbmFsXSAtIFRoZSBvcmlnaW5hbCBVUkwgdG8gYmUgdXNlZCBmb3IgaWRlbnRpZnlpbmcgdGhlIHJlc291cmNlXG4gICAgICogZm9ybWF0LiBUaGlzIGlzIG5lY2Vzc2FyeSB3aGVuIGxvYWRpbmcsIGZvciBleGFtcGxlIGZyb20gYmxvYi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9oYW5kbGVyLmpzJykuUmVzb3VyY2VIYW5kbGVyQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGNhbGxiYWNrIHVzZWQgd2hlblxuICAgICAqIHRoZSByZXNvdXJjZSBpcyBsb2FkZWQgb3IgYW4gZXJyb3Igb2NjdXJzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBbYXNzZXRdIC0gT3B0aW9uYWwgYXNzZXQgdGhhdCBpcyBwYXNzZWQgYnlcbiAgICAgKiBSZXNvdXJjZUxvYWRlci5cbiAgICAgKi9cbiAgICBsb2FkKHVybCwgY2FsbGJhY2ssIGFzc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2YgdXJsID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdXJsID0ge1xuICAgICAgICAgICAgICAgIGxvYWQ6IHVybCxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbDogdXJsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZ2V0UGFyc2VyKHVybC5vcmlnaW5hbCkubG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgb2YgdGhlIHJlc291cmNlIHRvIG9wZW4uXG4gICAgICogQHBhcmFtIHsqfSBkYXRhIC0gVGhlIHJhdyByZXNvdXJjZSBkYXRhIHBhc3NlZCBieSBjYWxsYmFjayBmcm9tIHtAbGluayBSZXNvdXJjZUhhbmRsZXIjbG9hZH0uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXR9IFthc3NldF0gLSBPcHRpb25hbCBhc3NldCB0aGF0IGlzIHBhc3NlZCBieVxuICAgICAqIFJlc291cmNlTG9hZGVyLlxuICAgICAqIEByZXR1cm5zIHsqfSBUaGUgcGFyc2VkIHJlc291cmNlIGRhdGEuXG4gICAgICovXG4gICAgb3Blbih1cmwsIGRhdGEsIGFzc2V0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRQYXJzZXIodXJsKS5vcGVuKHVybCwgZGF0YSwgYXNzZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0byBwYXRjaC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnKS5Bc3NldFJlZ2lzdHJ5fSBhc3NldHMgLSBUaGUgYXNzZXQgcmVnaXN0cnkuXG4gICAgICovXG4gICAgcGF0Y2goYXNzZXQsIGFzc2V0cykge1xuXG4gICAgfVxufVxuXG5leHBvcnQgeyBDb250YWluZXJSZXNvdXJjZSwgQ29udGFpbmVySGFuZGxlciB9O1xuIl0sIm5hbWVzIjpbIkNvbnRhaW5lclJlc291cmNlIiwiaW5zdGFudGlhdGVNb2RlbEVudGl0eSIsIm9wdGlvbnMiLCJpbnN0YW50aWF0ZVJlbmRlckVudGl0eSIsImdldE1hdGVyaWFsVmFyaWFudHMiLCJhcHBseU1hdGVyaWFsVmFyaWFudCIsImVudGl0eSIsIm5hbWUiLCJhcHBseU1hdGVyaWFsVmFyaWFudEluc3RhbmNlcyIsImluc3RhbmNlcyIsIkNvbnRhaW5lckhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsImhhbmRsZXJUeXBlIiwiZ2xiQ29udGFpbmVyUGFyc2VyIiwiR2xiQ29udGFpbmVyUGFyc2VyIiwiZ3JhcGhpY3NEZXZpY2UiLCJhc3NldHMiLCJwYXJzZXJzIiwibWF4UmV0cmllcyIsInZhbHVlIiwicGFyc2VyIiwiaGFzT3duUHJvcGVydHkiLCJfZ2V0VXJsV2l0aG91dFBhcmFtcyIsInVybCIsImluZGV4T2YiLCJzcGxpdCIsIl9nZXRQYXJzZXIiLCJleHQiLCJwYXRoIiwiZ2V0RXh0ZW5zaW9uIiwidG9Mb3dlckNhc2UiLCJyZXBsYWNlIiwibG9hZCIsImNhbGxiYWNrIiwiYXNzZXQiLCJvcmlnaW5hbCIsIm9wZW4iLCJkYXRhIiwicGF0Y2giXSwibWFwcGluZ3MiOiI7OztBQUlBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGlCQUFpQixDQUFDO0FBQ3BCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLHNCQUFzQkEsQ0FBQ0MsT0FBTyxFQUFFO0FBQzVCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLHVCQUF1QkEsQ0FBQ0QsT0FBTyxFQUFFO0FBQzdCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUUsRUFBQUEsbUJBQW1CQSxHQUFHO0FBQ2xCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsb0JBQW9CQSxDQUFDQyxNQUFNLEVBQUVDLElBQUksRUFBRSxFQUFDOztBQUVwQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLDZCQUE2QkEsQ0FBQ0MsU0FBUyxFQUFFRixJQUFJLEVBQUUsRUFBQztBQUNwRCxDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUcsZ0JBQWdCLENBQUM7QUFR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
