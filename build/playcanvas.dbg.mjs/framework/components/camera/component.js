import { Debug } from '../../../core/debug.js';
import { LAYERID_UI, LAYERID_DEPTH, ASPECT_AUTO } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { ShaderPass } from '../../../scene/shader-pass.js';
import { Component } from '../component.js';
import { PostEffectQueue } from './post-effect-queue.js';

/**
 * Callback used by {@link CameraComponent#calculateTransform} and {@link CameraComponent#calculateProjection}.
 *
 * @callback CalculateMatrixCallback
 * @param {import('../../../core/math/mat4.js').Mat4} transformMatrix - Output of the function.
 * @param {number} view - Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}. Left and right are only used in stereo rendering.
 */

/**
 * The Camera Component enables an Entity to render the scene. A scene requires at least one
 * enabled camera component to be rendered. Note that multiple camera components can be enabled
 * simultaneously (for split-screen or offscreen rendering, for example).
 *
 * ```javascript
 * // Add a pc.CameraComponent to an entity
 * const entity = new pc.Entity();
 * entity.addComponent('camera', {
 *     nearClip: 1,
 *     farClip: 100,
 *     fov: 55
 * });
 *
 * // Get the pc.CameraComponent on an entity
 * const cameraComponent = entity.camera;
 *
 * // Update a property on a camera component
 * entity.camera.nearClip = 2;
 * ```
 *
 * @augments Component
 */
class CameraComponent extends Component {
  /**
   * Create a new CameraComponent instance.
   *
   * @param {import('./system.js').CameraComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    /**
     * Custom function that is called when postprocessing should execute.
     *
     * @type {Function}
     * @ignore
     */
    this.onPostprocessing = null;
    /**
     * Custom function that is called before the camera renders the scene.
     *
     * @type {Function}
     */
    this.onPreRender = null;
    /**
     * Custom function that is called after the camera renders the scene.
     *
     * @type {Function}
     */
    this.onPostRender = null;
    /**
     * A counter of requests of depth map rendering.
     *
     * @type {number}
     * @private
     */
    this._renderSceneDepthMap = 0;
    /**
     * A counter of requests of color map rendering.
     *
     * @type {number}
     * @private
     */
    this._renderSceneColorMap = 0;
    /** @private */
    this._sceneDepthMapRequested = false;
    /** @private */
    this._sceneColorMapRequested = false;
    /** @private */
    this._priority = 0;
    /**
     * Layer id at which the postprocessing stops for the camera.
     *
     * @type {number}
     * @private
     */
    this._disablePostEffectsLayer = LAYERID_UI;
    /** @private */
    this._camera = new Camera();
    this._camera.node = entity;

    // postprocessing management
    this._postEffects = new PostEffectQueue(system.app, this);
  }

  /**
   * Sets the name of the shader pass the camera will use when rendering.
   *
   * @param {string} name - The name of the shader pass. Defaults to undefined, which is
   * equivalent to {@link SHADERPASS_FORWARD}. Can be:
   *
   * - {@link SHADERPASS_FORWARD}
   * - {@link SHADERPASS_ALBEDO}
   * - {@link SHADERPASS_OPACITY}
   * - {@link SHADERPASS_WORLDNORMAL}
   * - {@link SHADERPASS_SPECULARITY}
   * - {@link SHADERPASS_GLOSS}
   * - {@link SHADERPASS_METALNESS}
   * - {@link SHADERPASS_AO}
   * - {@link SHADERPASS_EMISSION}
   * - {@link SHADERPASS_LIGHTING}
   * - {@link SHADERPASS_UV0}
   *
   * Additionally, a new name can be specified, which creates a new shader pass with the given
   * name. The name provided can only use alphanumeric characters and underscores. When a shader
   * is compiled for the new pass, a define is added to the shader. For example, if the name is
   * 'custom_rendering', the define 'CUSTOM_RENDERING_PASS' is added to the shader, allowing the
   * shader code to conditionally execute code only when that shader pass is active.
   *
   * Another instance where this approach may prove useful is when a camera needs to render a more
   * cost-effective version of shaders, such as when creating a reflection texture. To accomplish
   * this, a callback on the material that triggers during shader compilation can be used. This
   * callback can modify the shader generation options specifically for this shader pass.
   *
   * ```javascript
   * const shaderPassId = camera.setShaderPass('custom_rendering');
   *
   * material.onUpdateShader = function (options) {
   *    if (options.pass === shaderPassId) {
   *        options.litOptions.normalMapEnabled = false;
   *        options.litOptions.useSpecular = false;
   *    }
   *    return options;
   * };
   * ```
   *
   * @returns {number} The id of the shader pass.
   */
  setShaderPass(name) {
    const shaderPass = ShaderPass.get(this.system.app.graphicsDevice);
    const shaderPassInfo = name ? shaderPass.allocate(name, {
      isForward: true
    }) : null;
    this._camera.shaderPassInfo = shaderPassInfo;
    return shaderPassInfo.index;
  }

  /**
   * Shader pass name.
   *
   * @returns {string} The name of the shader pass, or undefined if no shader pass is set.
   */
  getShaderPass() {
    var _this$_camera$shaderP;
    return (_this$_camera$shaderP = this._camera.shaderPassInfo) == null ? void 0 : _this$_camera$shaderP.name;
  }

  /**
   * Set camera aperture in f-stops, the default value is 16.0. Higher value means less exposure.
   *
   * @type {number}
   */
  set aperture(value) {
    this._camera.aperture = value;
  }
  get aperture() {
    return this._camera.aperture;
  }

  /**
   * The aspect ratio (width divided by height) of the camera. If aspectRatioMode is
   * {@link ASPECT_AUTO}, then this value will be automatically calculated every frame, and you
   * can only read it. If it's ASPECT_MANUAL, you can set the value.
   *
   * @type {number}
   */
  set aspectRatio(value) {
    this._camera.aspectRatio = value;
  }
  get aspectRatio() {
    return this._camera.aspectRatio;
  }

  /**
   * The aspect ratio mode of the camera. Can be:
   *
   * - {@link ASPECT_AUTO}: aspect ratio will be calculated from the current render
   * target's width divided by height.
   * - {@link ASPECT_MANUAL}: use the aspectRatio value.
   *
   * Defaults to {@link ASPECT_AUTO}.
   *
   * @type {number}
   */
  set aspectRatioMode(value) {
    this._camera.aspectRatioMode = value;
  }
  get aspectRatioMode() {
    return this._camera.aspectRatioMode;
  }

  /**
   * Custom function you can provide to calculate the camera projection matrix manually. Can be
   * used for complex effects like doing oblique projection. Function is called using component's
   * scope. Arguments:
   *
   * - {@link Mat4} transformMatrix: output of the function
   * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
   *
   * Left and right are only used in stereo rendering.
   *
   * @type {CalculateMatrixCallback}
   */
  set calculateProjection(value) {
    this._camera.calculateProjection = value;
  }
  get calculateProjection() {
    return this._camera.calculateProjection;
  }

  /**
   * Custom function you can provide to calculate the camera transformation matrix manually. Can
   * be used for complex effects like reflections. Function is called using component's scope.
   * Arguments:
   *
   * - {@link Mat4} transformMatrix: output of the function.
   * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
   *
   * Left and right are only used in stereo rendering.
   *
   * @type {CalculateMatrixCallback}
   */
  set calculateTransform(value) {
    this._camera.calculateTransform = value;
  }
  get calculateTransform() {
    return this._camera.calculateTransform;
  }

  /**
   * Queries the camera component's underlying Camera instance.
   *
   * @type {Camera}
   * @ignore
   */
  get camera() {
    return this._camera;
  }

  /**
   * The color used to clear the canvas to before the camera starts to render. Defaults to
   * [0.75, 0.75, 0.75, 1].
   *
   * @type {import('../../../core/math/color.js').Color}
   */
  set clearColor(value) {
    this._camera.clearColor = value;
  }
  get clearColor() {
    return this._camera.clearColor;
  }

  /**
   * If true the camera will clear the color buffer to the color set in clearColor. Defaults to true.
   *
   * @type {boolean}
   */
  set clearColorBuffer(value) {
    this._camera.clearColorBuffer = value;
    this.dirtyLayerCompositionCameras();
  }
  get clearColorBuffer() {
    return this._camera.clearColorBuffer;
  }

  /**
   * If true the camera will clear the depth buffer. Defaults to true.
   *
   * @type {boolean}
   */
  set clearDepthBuffer(value) {
    this._camera.clearDepthBuffer = value;
    this.dirtyLayerCompositionCameras();
  }
  get clearDepthBuffer() {
    return this._camera.clearDepthBuffer;
  }

  /**
   * If true the camera will clear the stencil buffer. Defaults to true.
   *
   * @type {boolean}
   */
  set clearStencilBuffer(value) {
    this._camera.clearStencilBuffer = value;
    this.dirtyLayerCompositionCameras();
  }
  get clearStencilBuffer() {
    return this._camera.clearStencilBuffer;
  }

  /**
   * If true the camera will take material.cull into account. Otherwise both front and back faces
   * will be rendered. Defaults to true.
   *
   * @type {boolean}
   */
  set cullFaces(value) {
    this._camera.cullFaces = value;
  }
  get cullFaces() {
    return this._camera.cullFaces;
  }

  /**
   * Layer ID of a layer on which the postprocessing of the camera stops being applied to.
   * Defaults to LAYERID_UI, which causes post processing to not be applied to UI layer and any
   * following layers for the camera. Set to undefined for post-processing to be applied to all
   * layers of the camera.
   *
   * @type {number}
   */
  set disablePostEffectsLayer(layer) {
    this._disablePostEffectsLayer = layer;
    this.dirtyLayerCompositionCameras();
  }
  get disablePostEffectsLayer() {
    return this._disablePostEffectsLayer;
  }

  /**
   * The distance from the camera after which no rendering will take place. Defaults to 1000.
   *
   * @type {number}
   */
  set farClip(value) {
    this._camera.farClip = value;
  }
  get farClip() {
    return this._camera.farClip;
  }

  /**
   * If true the camera will invert front and back faces. Can be useful for reflection rendering.
   * Defaults to false.
   *
   * @type {boolean}
   */
  set flipFaces(value) {
    this._camera.flipFaces = value;
  }
  get flipFaces() {
    return this._camera.flipFaces;
  }

  /**
   * The field of view of the camera in degrees. Usually this is the Y-axis field of view, see
   * {@link CameraComponent#horizontalFov}. Used for {@link PROJECTION_PERSPECTIVE} cameras only.
   * Defaults to 45.
   *
   * @type {number}
   */
  set fov(value) {
    this._camera.fov = value;
  }
  get fov() {
    return this._camera.fov;
  }

  /**
   * Queries the camera's frustum shape.
   *
   * @type {import('../../../core/shape/frustum.js').Frustum}
   */
  get frustum() {
    return this._camera.frustum;
  }

  /**
   * Controls the culling of mesh instances against the camera frustum, i.e. if objects outside
   * of camera should be omitted from rendering. If false, all mesh instances in the scene are
   * rendered by the camera, regardless of visibility. Defaults to false.
   *
   * @type {boolean}
   */
  set frustumCulling(value) {
    this._camera.frustumCulling = value;
  }
  get frustumCulling() {
    return this._camera.frustumCulling;
  }

  /**
   * Set which axis to use for the Field of View calculation. Defaults to false.
   *
   * @type {boolean}
   */
  set horizontalFov(value) {
    this._camera.horizontalFov = value;
  }
  get horizontalFov() {
    return this._camera.horizontalFov;
  }

  /**
   * An array of layer IDs ({@link Layer#id}) to which this camera should belong. Don't push,
   * pop, splice or modify this array, if you want to change it, set a new one instead. Defaults
   * to [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE].
   *
   * @type {number[]}
   */
  set layers(newValue) {
    const layers = this._camera.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (!layer) continue;
      layer.removeCamera(this);
    }
    this._camera.layers = newValue;
    if (!this.enabled || !this.entity.enabled) return;
    for (let i = 0; i < newValue.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
      if (!layer) continue;
      layer.addCamera(this);
    }
  }
  get layers() {
    return this._camera.layers;
  }
  get layersSet() {
    return this._camera.layersSet;
  }

  /**
   * The distance from the camera before which no rendering will take place. Defaults to 0.1.
   *
   * @type {number}
   */
  set nearClip(value) {
    this._camera.nearClip = value;
  }
  get nearClip() {
    return this._camera.nearClip;
  }

  /**
   * The half-height of the orthographic view window (in the Y-axis). Used for
   * {@link PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
   *
   * @type {number}
   */
  set orthoHeight(value) {
    this._camera.orthoHeight = value;
  }
  get orthoHeight() {
    return this._camera.orthoHeight;
  }
  get postEffects() {
    return this._postEffects;
  }

  /**
   * The post effects queue for this camera. Use this to add or remove post effects from the camera.
   *
   * @type {PostEffectQueue}
   */
  get postEffectsEnabled() {
    return this._postEffects.enabled;
  }

  /**
   * Controls the order in which cameras are rendered. Cameras with smaller values for priority
   * are rendered first. Defaults to 0.
   *
   * @type {number}
   */
  set priority(newValue) {
    this._priority = newValue;
    this.dirtyLayerCompositionCameras();
  }
  get priority() {
    return this._priority;
  }

  /**
   * The type of projection used to render the camera. Can be:
   *
   * - {@link PROJECTION_PERSPECTIVE}: A perspective projection. The camera frustum
   * resembles a truncated pyramid.
   * - {@link PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera
   * frustum is a cuboid.
   *
   * Defaults to {@link PROJECTION_PERSPECTIVE}.
   *
   * @type {number}
   */
  set projection(value) {
    this._camera.projection = value;
  }
  get projection() {
    return this._camera.projection;
  }

  /**
   * Queries the camera's projection matrix.
   *
   * @type {import('../../../core/math/mat4.js').Mat4}
   */
  get projectionMatrix() {
    return this._camera.projectionMatrix;
  }

  /**
   * Controls where on the screen the camera will be rendered in normalized screen coordinates.
   * Defaults to [0, 0, 1, 1].
   *
   * @type {import('../../../core/math/vec4.js').Vec4}
   */
  set rect(value) {
    this._camera.rect = value;
    this.fire('set:rect', this._camera.rect);
  }
  get rect() {
    return this._camera.rect;
  }
  set renderSceneColorMap(value) {
    if (value && !this._sceneColorMapRequested) {
      this.requestSceneColorMap(true);
      this._sceneColorMapRequested = true;
    } else if (this._sceneColorMapRequested) {
      this.requestSceneColorMap(false);
      this._sceneColorMapRequested = false;
    }
  }
  get renderSceneColorMap() {
    return this._renderSceneColorMap > 0;
  }
  set renderSceneDepthMap(value) {
    if (value && !this._sceneDepthMapRequested) {
      this.requestSceneDepthMap(true);
      this._sceneDepthMapRequested = true;
    } else if (this._sceneDepthMapRequested) {
      this.requestSceneDepthMap(false);
      this._sceneDepthMapRequested = false;
    }
  }
  get renderSceneDepthMap() {
    return this._renderSceneDepthMap > 0;
  }

  /**
   * Render target to which rendering of the cameras is performed. If not set, it will render
   * simply to the screen.
   *
   * @type {import('../../../platform/graphics/render-target.js').RenderTarget}
   */
  set renderTarget(value) {
    this._camera.renderTarget = value;
    this.dirtyLayerCompositionCameras();
  }
  get renderTarget() {
    return this._camera.renderTarget;
  }

  /**
   * Clips all pixels which are not in the rectangle. The order of the values is
   * [x, y, width, height]. Defaults to [0, 0, 1, 1].
   *
   * @type {import('../../../core/math/vec4.js').Vec4}
   */
  set scissorRect(value) {
    this._camera.scissorRect = value;
  }
  get scissorRect() {
    return this._camera.scissorRect;
  }

  /**
   * Set camera sensitivity in ISO, the default value is 1000. Higher value means more exposure.
   *
   * @type {number}
   */
  set sensitivity(value) {
    this._camera.sensitivity = value;
  }
  get sensitivity() {
    return this._camera.sensitivity;
  }

  /**
   * Set camera shutter speed in seconds, the default value is 1/1000s. Longer shutter means more exposure.
   *
   * @type {number}
   */
  set shutter(value) {
    this._camera.shutter = value;
  }
  get shutter() {
    return this._camera.shutter;
  }

  /**
   * Queries the camera's view matrix.
   *
   * @type {import('../../../core/math/mat4.js').Mat4}
   */
  get viewMatrix() {
    return this._camera.viewMatrix;
  }

  /**
   * Based on the value, the depth layer's enable counter is incremented or decremented.
   *
   * @param {boolean} value - True to increment the counter, false to decrement it.
   * @returns {boolean} True if the counter was incremented or decremented, false if the depth
   * layer is not present.
   * @private
   */
  _enableDepthLayer(value) {
    const hasDepthLayer = this.layers.find(layerId => layerId === LAYERID_DEPTH);
    if (hasDepthLayer) {
      /** @type {import('../../../scene/layer.js').Layer} */
      const depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);
      if (value) {
        depthLayer == null ? void 0 : depthLayer.incrementCounter();
      } else {
        depthLayer == null ? void 0 : depthLayer.decrementCounter();
      }
    } else if (value) {
      return false;
    }
    return true;
  }

  /**
   * Request the scene to generate a texture containing the scene color map. Note that this call
   * is accumulative, and for each enable request, a disable request need to be called.
   *
   * @param {boolean} enabled - True to request the generation, false to disable it.
   */
  requestSceneColorMap(enabled) {
    this._renderSceneColorMap += enabled ? 1 : -1;
    Debug.assert(this._renderSceneColorMap >= 0);
    const ok = this._enableDepthLayer(enabled);
    if (!ok) {
      Debug.warnOnce('CameraComponent.requestSceneColorMap was called, but the camera does not have a Depth layer, ignoring.');
    }
  }

  /**
   * Request the scene to generate a texture containing the scene depth map. Note that this call
   * is accumulative, and for each enable request, a disable request need to be called.
   *
   * @param {boolean} enabled - True to request the generation, false to disable it.
   */
  requestSceneDepthMap(enabled) {
    this._renderSceneDepthMap += enabled ? 1 : -1;
    Debug.assert(this._renderSceneDepthMap >= 0);
    const ok = this._enableDepthLayer(enabled);
    if (!ok) {
      Debug.warnOnce('CameraComponent.requestSceneDepthMap was called, but the camera does not have a Depth layer, ignoring.');
    }
  }
  dirtyLayerCompositionCameras() {
    // layer composition needs to update order
    const layerComp = this.system.app.scene.layers;
    layerComp._dirtyCameras = true;
  }

  /**
   * Convert a point from 2D screen space to 3D world space.
   *
   * @param {number} screenx - X coordinate on PlayCanvas' canvas element. Should be in the range
   * 0 to `canvas.offsetWidth` of the application's canvas element.
   * @param {number} screeny - Y coordinate on PlayCanvas' canvas element. Should be in the range
   * 0 to `canvas.offsetHeight` of the application's canvas element.
   * @param {number} cameraz - The distance from the camera in world space to create the new
   * point.
   * @param {import('../../../core/math/vec3.js').Vec3} [worldCoord] - 3D vector to receive world
   * coordinate result.
   * @example
   * // Get the start and end points of a 3D ray fired from a screen click position
   * const start = entity.camera.screenToWorld(clickX, clickY, entity.camera.nearClip);
   * const end = entity.camera.screenToWorld(clickX, clickY, entity.camera.farClip);
   *
   * // Use the ray coordinates to perform a raycast
   * app.systems.rigidbody.raycastFirst(start, end, function (result) {
   *     console.log("Entity " + result.entity.name + " was selected");
   * });
   * @returns {import('../../../core/math/vec3.js').Vec3} The world space coordinate.
   */
  screenToWorld(screenx, screeny, cameraz, worldCoord) {
    const device = this.system.app.graphicsDevice;
    const w = device.clientRect.width;
    const h = device.clientRect.height;
    return this._camera.screenToWorld(screenx, screeny, cameraz, w, h, worldCoord);
  }

  /**
   * Convert a point from 3D world space to 2D screen space.
   *
   * @param {import('../../../core/math/vec3.js').Vec3} worldCoord - The world space coordinate.
   * @param {import('../../../core/math/vec3.js').Vec3} [screenCoord] - 3D vector to receive
   * screen coordinate result.
   * @returns {import('../../../core/math/vec3.js').Vec3} The screen space coordinate.
   */
  worldToScreen(worldCoord, screenCoord) {
    const device = this.system.app.graphicsDevice;
    const w = device.clientRect.width;
    const h = device.clientRect.height;
    return this._camera.worldToScreen(worldCoord, w, h, screenCoord);
  }

  /**
   * Called before application renders the scene.
   *
   * @ignore
   */
  onAppPrerender() {
    this._camera._viewMatDirty = true;
    this._camera._viewProjMatDirty = true;
  }

  /** @private */
  addCameraToLayers() {
    const layers = this.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (layer) {
        layer.addCamera(this);
      }
    }
  }

  /** @private */
  removeCameraFromLayers() {
    const layers = this.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (layer) {
        layer.removeCamera(this);
      }
    }
  }

  /**
   * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} oldComp - Old layer composition.
   * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} newComp - New layer composition.
   * @private
   */
  onLayersChanged(oldComp, newComp) {
    this.addCameraToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }

  /**
   * @param {import('../../../scene/layer.js').Layer} layer - The layer to add the camera to.
   * @private
   */
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addCamera(this);
  }

  /**
   * @param {import('../../../scene/layer.js').Layer} layer - The layer to remove the camera from.
   * @private
   */
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeCamera(this);
  }
  onEnable() {
    const system = this.system;
    const scene = system.app.scene;
    const layers = scene.layers;
    system.addCamera(this);
    scene.on('set:layers', this.onLayersChanged, this);
    if (layers) {
      layers.on('add', this.onLayerAdded, this);
      layers.on('remove', this.onLayerRemoved, this);
    }
    if (this.enabled && this.entity.enabled) {
      this.addCameraToLayers();
    }
    this.postEffects.enable();
  }
  onDisable() {
    const system = this.system;
    const scene = system.app.scene;
    const layers = scene.layers;
    this.postEffects.disable();
    this.removeCameraFromLayers();
    scene.off('set:layers', this.onLayersChanged, this);
    if (layers) {
      layers.off('add', this.onLayerAdded, this);
      layers.off('remove', this.onLayerRemoved, this);
    }
    system.removeCamera(this);
  }
  onRemove() {
    this.onDisable();
    this.off();
  }

  /**
   * Calculates aspect ratio value for a given render target.
   *
   * @param {import('../../../platform/graphics/render-target.js').RenderTarget} [rt] - Optional
   * render target. If unspecified, the backbuffer is used.
   * @returns {number} The aspect ratio of the render target (or backbuffer).
   */
  calculateAspectRatio(rt) {
    const device = this.system.app.graphicsDevice;
    const width = rt ? rt.width : device.width;
    const height = rt ? rt.height : device.height;
    return width * this.rect.z / (height * this.rect.w);
  }

  /**
   * Prepare the camera for frame rendering.
   *
   * @param {import('../../../platform/graphics/render-target.js').RenderTarget} rt - Render
   * target to which rendering will be performed. Will affect camera's aspect ratio, if
   * aspectRatioMode is {@link ASPECT_AUTO}.
   * @ignore
   */
  frameUpdate(rt) {
    if (this.aspectRatioMode === ASPECT_AUTO) {
      this.aspectRatio = this.calculateAspectRatio(rt);
    }
  }

  /**
   * Attempt to start XR session with this camera.
   *
   * @param {string} type - The type of session. Can be one of the following:
   *
   * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited feature
   * availability and is rendered into HTML element.
   * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to the VR device
   * with the best available tracking features.
   * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to the VR/AR
   * device that is intended to be blended with the real-world environment.
   *
   * @param {string} spaceType - Reference space type. Can be one of the following:
   *
   * - {@link XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking
   * capabilities.
   * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
   * viewer at the time of creation. It is meant for seated or basic local XR sessions.
   * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
   * at the floor in a safe position for the user to stand. The y-axis equals 0 at floor level.
   * Floor level value might be estimated by the underlying platform. It is meant for seated or
   * basic local XR sessions.
   * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
   * origin at the floor, where the user is expected to move within a pre-established boundary.
   * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
   * expected to move freely around their environment, potentially long distances from their
   * starting point.
   *
   * @param {object} [options] - Object with options for XR session initialization.
   * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is
   * used for getting access to additional WebXR spec extensions.
   * @param {boolean} [options.imageTracking] - Set to true to attempt to enable {@link XrImageTracking}.
   * @param {boolean} [options.planeDetection] - Set to true to attempt to enable {@link XrPlaneDetection}.
   * @param {import('../../xr/xr-manager.js').XrErrorCallback} [options.callback] - Optional
   * callback function called once the session is started. The callback has one argument Error -
   * it is null if the XR session started successfully.
   * @param {object} [options.depthSensing] - Optional object with depth sensing parameters to
   * attempt to enable {@link XrDepthSensing}.
   * @param {string} [options.depthSensing.usagePreference] - Optional usage preference for depth
   * sensing, can be 'cpu-optimized' or 'gpu-optimized' (XRDEPTHSENSINGUSAGE_*), defaults to
   * 'cpu-optimized'. Most preferred and supported will be chosen by the underlying depth sensing
   * system.
   * @param {string} [options.depthSensing.dataFormatPreference] - Optional data format
   * preference for depth sensing. Can be 'luminance-alpha' or 'float32' (XRDEPTHSENSINGFORMAT_*),
   * defaults to 'luminance-alpha'. Most preferred and supported will be chosen by the underlying
   * depth sensing system.
   * @example
   * // On an entity with a camera component
   * this.entity.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
   *     callback: function (err) {
   *         if (err) {
   *             // failed to start XR session
   *         } else {
   *             // in XR
   *         }
   *     }
   * });
   */
  startXr(type, spaceType, options) {
    this.system.app.xr.start(this, type, spaceType, options);
  }

  /**
   * Attempt to end XR session of this camera.
   *
   * @param {import('../../xr/xr-manager.js').XrErrorCallback} [callback] - Optional callback
   * function called once session is ended. The callback has one argument Error - it is null if
   * successfully ended XR session.
   * @example
   * // On an entity with a camera component
   * this.entity.camera.endXr(function (err) {
   *     // not anymore in XR
   * });
   */
  endXr(callback) {
    if (!this._camera.xr) {
      if (callback) callback(new Error('Camera is not in XR'));
      return;
    }
    this._camera.xr.end(callback);
  }

  /**
   * Function to copy properties from the source CameraComponent.
   * Properties not copied: postEffects.
   * Inherited properties not copied (all): system, entity, enabled.
   *
   * @param {CameraComponent} source - The source component.
   * @ignore
   */
  copy(source) {
    this.aperture = source.aperture;
    this.aspectRatio = source.aspectRatio;
    this.aspectRatioMode = source.aspectRatioMode;
    this.calculateProjection = source.calculateProjection;
    this.calculateTransform = source.calculateTransform;
    this.clearColor = source.clearColor;
    this.clearColorBuffer = source.clearColorBuffer;
    this.clearDepthBuffer = source.clearDepthBuffer;
    this.clearStencilBuffer = source.clearStencilBuffer;
    this.cullFaces = source.cullFaces;
    this.disablePostEffectsLayer = source.disablePostEffectsLayer;
    this.farClip = source.farClip;
    this.flipFaces = source.flipFaces;
    this.fov = source.fov;
    this.frustumCulling = source.frustumCulling;
    this.horizontalFov = source.horizontalFov;
    this.layers = source.layers;
    this.nearClip = source.nearClip;
    this.orthoHeight = source.orthoHeight;
    this.priority = source.priority;
    this.projection = source.projection;
    this.rect = source.rect;
    this.renderTarget = source.renderTarget;
    this.scissorRect = source.scissorRect;
    this.sensitivity = source.sensitivity;
    this.shutter = source.shutter;
  }
}

export { CameraComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBU1BFQ1RfQVVUTywgTEFZRVJJRF9VSSwgTEFZRVJJRF9ERVBUSCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDYW1lcmEgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jYW1lcmEuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3NoYWRlci1wYXNzLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHsgUG9zdEVmZmVjdFF1ZXVlIH0gZnJvbSAnLi9wb3N0LWVmZmVjdC1xdWV1ZS5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVRyYW5zZm9ybX0gYW5kIHtAbGluayBDYW1lcmFDb21wb25lbnQjY2FsY3VsYXRlUHJvamVjdGlvbn0uXG4gKlxuICogQGNhbGxiYWNrIENhbGN1bGF0ZU1hdHJpeENhbGxiYWNrXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0fSB0cmFuc2Zvcm1NYXRyaXggLSBPdXRwdXQgb2YgdGhlIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtudW1iZXJ9IHZpZXcgLSBUeXBlIG9mIHZpZXcuIENhbiBiZSB7QGxpbmsgVklFV19DRU5URVJ9LCB7QGxpbmsgVklFV19MRUZUfSBvciB7QGxpbmsgVklFV19SSUdIVH0uIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqL1xuXG4vKipcbiAqIFRoZSBDYW1lcmEgQ29tcG9uZW50IGVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciB0aGUgc2NlbmUuIEEgc2NlbmUgcmVxdWlyZXMgYXQgbGVhc3Qgb25lXG4gKiBlbmFibGVkIGNhbWVyYSBjb21wb25lbnQgdG8gYmUgcmVuZGVyZWQuIE5vdGUgdGhhdCBtdWx0aXBsZSBjYW1lcmEgY29tcG9uZW50cyBjYW4gYmUgZW5hYmxlZFxuICogc2ltdWx0YW5lb3VzbHkgKGZvciBzcGxpdC1zY3JlZW4gb3Igb2Zmc2NyZWVuIHJlbmRlcmluZywgZm9yIGV4YW1wbGUpLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIEFkZCBhIHBjLkNhbWVyYUNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAqIGNvbnN0IGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoJ2NhbWVyYScsIHtcbiAqICAgICBuZWFyQ2xpcDogMSxcbiAqICAgICBmYXJDbGlwOiAxMDAsXG4gKiAgICAgZm92OiA1NVxuICogfSk7XG4gKlxuICogLy8gR2V0IHRoZSBwYy5DYW1lcmFDb21wb25lbnQgb24gYW4gZW50aXR5XG4gKiBjb25zdCBjYW1lcmFDb21wb25lbnQgPSBlbnRpdHkuY2FtZXJhO1xuICpcbiAqIC8vIFVwZGF0ZSBhIHByb3BlcnR5IG9uIGEgY2FtZXJhIGNvbXBvbmVudFxuICogZW50aXR5LmNhbWVyYS5uZWFyQ2xpcCA9IDI7XG4gKiBgYGBcbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIENhbWVyYUNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdoZW4gcG9zdHByb2Nlc3Npbmcgc2hvdWxkIGV4ZWN1dGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIG9uUG9zdHByb2Nlc3NpbmcgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSB0aGUgY2FtZXJhIHJlbmRlcnMgdGhlIHNjZW5lLlxuICAgICAqXG4gICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAqL1xuICAgIG9uUHJlUmVuZGVyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgY2FtZXJhIHJlbmRlcnMgdGhlIHNjZW5lLlxuICAgICAqXG4gICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAqL1xuICAgIG9uUG9zdFJlbmRlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvdW50ZXIgb2YgcmVxdWVzdHMgb2YgZGVwdGggbWFwIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVuZGVyU2NlbmVEZXB0aE1hcCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvdW50ZXIgb2YgcmVxdWVzdHMgb2YgY29sb3IgbWFwIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVuZGVyU2NlbmVDb2xvck1hcCA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9wcmlvcml0eSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBMYXllciBpZCBhdCB3aGljaCB0aGUgcG9zdHByb2Nlc3Npbmcgc3RvcHMgZm9yIHRoZSBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyID0gTEFZRVJJRF9VSTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9jYW1lcmEgPSBuZXcgQ2FtZXJhKCk7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ2FtZXJhQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQ2FtZXJhQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9jYW1lcmEubm9kZSA9IGVudGl0eTtcblxuICAgICAgICAvLyBwb3N0cHJvY2Vzc2luZyBtYW5hZ2VtZW50XG4gICAgICAgIHRoaXMuX3Bvc3RFZmZlY3RzID0gbmV3IFBvc3RFZmZlY3RRdWV1ZShzeXN0ZW0uYXBwLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBuYW1lIG9mIHRoZSBzaGFkZXIgcGFzcyB0aGUgY2FtZXJhIHdpbGwgdXNlIHdoZW4gcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyIHBhc3MuIERlZmF1bHRzIHRvIHVuZGVmaW5lZCwgd2hpY2ggaXNcbiAgICAgKiBlcXVpdmFsZW50IHRvIHtAbGluayBTSEFERVJQQVNTX0ZPUldBUkR9LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTSEFERVJQQVNTX0ZPUldBUkR9XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19BTEJFRE99XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19PUEFDSVRZfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfV09STEROT1JNQUx9XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19TUEVDVUxBUklUWX1cbiAgICAgKiAtIHtAbGluayBTSEFERVJQQVNTX0dMT1NTfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfTUVUQUxORVNTfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfQU99XG4gICAgICogLSB7QGxpbmsgU0hBREVSUEFTU19FTUlTU0lPTn1cbiAgICAgKiAtIHtAbGluayBTSEFERVJQQVNTX0xJR0hUSU5HfVxuICAgICAqIC0ge0BsaW5rIFNIQURFUlBBU1NfVVYwfVxuICAgICAqXG4gICAgICogQWRkaXRpb25hbGx5LCBhIG5ldyBuYW1lIGNhbiBiZSBzcGVjaWZpZWQsIHdoaWNoIGNyZWF0ZXMgYSBuZXcgc2hhZGVyIHBhc3Mgd2l0aCB0aGUgZ2l2ZW5cbiAgICAgKiBuYW1lLiBUaGUgbmFtZSBwcm92aWRlZCBjYW4gb25seSB1c2UgYWxwaGFudW1lcmljIGNoYXJhY3RlcnMgYW5kIHVuZGVyc2NvcmVzLiBXaGVuIGEgc2hhZGVyXG4gICAgICogaXMgY29tcGlsZWQgZm9yIHRoZSBuZXcgcGFzcywgYSBkZWZpbmUgaXMgYWRkZWQgdG8gdGhlIHNoYWRlci4gRm9yIGV4YW1wbGUsIGlmIHRoZSBuYW1lIGlzXG4gICAgICogJ2N1c3RvbV9yZW5kZXJpbmcnLCB0aGUgZGVmaW5lICdDVVNUT01fUkVOREVSSU5HX1BBU1MnIGlzIGFkZGVkIHRvIHRoZSBzaGFkZXIsIGFsbG93aW5nIHRoZVxuICAgICAqIHNoYWRlciBjb2RlIHRvIGNvbmRpdGlvbmFsbHkgZXhlY3V0ZSBjb2RlIG9ubHkgd2hlbiB0aGF0IHNoYWRlciBwYXNzIGlzIGFjdGl2ZS5cbiAgICAgKlxuICAgICAqIEFub3RoZXIgaW5zdGFuY2Ugd2hlcmUgdGhpcyBhcHByb2FjaCBtYXkgcHJvdmUgdXNlZnVsIGlzIHdoZW4gYSBjYW1lcmEgbmVlZHMgdG8gcmVuZGVyIGEgbW9yZVxuICAgICAqIGNvc3QtZWZmZWN0aXZlIHZlcnNpb24gb2Ygc2hhZGVycywgc3VjaCBhcyB3aGVuIGNyZWF0aW5nIGEgcmVmbGVjdGlvbiB0ZXh0dXJlLiBUbyBhY2NvbXBsaXNoXG4gICAgICogdGhpcywgYSBjYWxsYmFjayBvbiB0aGUgbWF0ZXJpYWwgdGhhdCB0cmlnZ2VycyBkdXJpbmcgc2hhZGVyIGNvbXBpbGF0aW9uIGNhbiBiZSB1c2VkLiBUaGlzXG4gICAgICogY2FsbGJhY2sgY2FuIG1vZGlmeSB0aGUgc2hhZGVyIGdlbmVyYXRpb24gb3B0aW9ucyBzcGVjaWZpY2FsbHkgZm9yIHRoaXMgc2hhZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBgYGBqYXZhc2NyaXB0XG4gICAgICogY29uc3Qgc2hhZGVyUGFzc0lkID0gY2FtZXJhLnNldFNoYWRlclBhc3MoJ2N1c3RvbV9yZW5kZXJpbmcnKTtcbiAgICAgKlxuICAgICAqIG1hdGVyaWFsLm9uVXBkYXRlU2hhZGVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgKiAgICBpZiAob3B0aW9ucy5wYXNzID09PSBzaGFkZXJQYXNzSWQpIHtcbiAgICAgKiAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLm5vcm1hbE1hcEVuYWJsZWQgPSBmYWxzZTtcbiAgICAgKiAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyID0gZmFsc2U7XG4gICAgICogICAgfVxuICAgICAqICAgIHJldHVybiBvcHRpb25zO1xuICAgICAqIH07XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgaWQgb2YgdGhlIHNoYWRlciBwYXNzLlxuICAgICAqL1xuICAgIHNldFNoYWRlclBhc3MobmFtZSkge1xuICAgICAgICBjb25zdCBzaGFkZXJQYXNzID0gIFNoYWRlclBhc3MuZ2V0KHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZSk7XG4gICAgICAgIGNvbnN0IHNoYWRlclBhc3NJbmZvID0gbmFtZSA/IHNoYWRlclBhc3MuYWxsb2NhdGUobmFtZSwge1xuICAgICAgICAgICAgaXNGb3J3YXJkOiB0cnVlXG4gICAgICAgIH0pIDogbnVsbDtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnNoYWRlclBhc3NJbmZvID0gc2hhZGVyUGFzc0luZm87XG5cbiAgICAgICAgcmV0dXJuIHNoYWRlclBhc3NJbmZvLmluZGV4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNoYWRlciBwYXNzIG5hbWUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyIHBhc3MsIG9yIHVuZGVmaW5lZCBpZiBubyBzaGFkZXIgcGFzcyBpcyBzZXQuXG4gICAgICovXG4gICAgZ2V0U2hhZGVyUGFzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5zaGFkZXJQYXNzSW5mbz8ubmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgY2FtZXJhIGFwZXJ0dXJlIGluIGYtc3RvcHMsIHRoZSBkZWZhdWx0IHZhbHVlIGlzIDE2LjAuIEhpZ2hlciB2YWx1ZSBtZWFucyBsZXNzIGV4cG9zdXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYXBlcnR1cmUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmFwZXJ0dXJlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFwZXJ0dXJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmFwZXJ0dXJlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3BlY3QgcmF0aW8gKHdpZHRoIGRpdmlkZWQgYnkgaGVpZ2h0KSBvZiB0aGUgY2FtZXJhLiBJZiBhc3BlY3RSYXRpb01vZGUgaXNcbiAgICAgKiB7QGxpbmsgQVNQRUNUX0FVVE99LCB0aGVuIHRoaXMgdmFsdWUgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNhbGN1bGF0ZWQgZXZlcnkgZnJhbWUsIGFuZCB5b3VcbiAgICAgKiBjYW4gb25seSByZWFkIGl0LiBJZiBpdCdzIEFTUEVDVF9NQU5VQUwsIHlvdSBjYW4gc2V0IHRoZSB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFzcGVjdFJhdGlvKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5hc3BlY3RSYXRpbyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhc3BlY3RSYXRpbygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5hc3BlY3RSYXRpbztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXNwZWN0IHJhdGlvIG1vZGUgb2YgdGhlIGNhbWVyYS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQVNQRUNUX0FVVE99OiBhc3BlY3QgcmF0aW8gd2lsbCBiZSBjYWxjdWxhdGVkIGZyb20gdGhlIGN1cnJlbnQgcmVuZGVyXG4gICAgICogdGFyZ2V0J3Mgd2lkdGggZGl2aWRlZCBieSBoZWlnaHQuXG4gICAgICogLSB7QGxpbmsgQVNQRUNUX01BTlVBTH06IHVzZSB0aGUgYXNwZWN0UmF0aW8gdmFsdWUuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQVNQRUNUX0FVVE99LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYXNwZWN0UmF0aW9Nb2RlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5hc3BlY3RSYXRpb01vZGUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXNwZWN0UmF0aW9Nb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmFzcGVjdFJhdGlvTW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24geW91IGNhbiBwcm92aWRlIHRvIGNhbGN1bGF0ZSB0aGUgY2FtZXJhIHByb2plY3Rpb24gbWF0cml4IG1hbnVhbGx5LiBDYW4gYmVcbiAgICAgKiB1c2VkIGZvciBjb21wbGV4IGVmZmVjdHMgbGlrZSBkb2luZyBvYmxpcXVlIHByb2plY3Rpb24uIEZ1bmN0aW9uIGlzIGNhbGxlZCB1c2luZyBjb21wb25lbnQnc1xuICAgICAqIHNjb3BlLiBBcmd1bWVudHM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBNYXQ0fSB0cmFuc2Zvcm1NYXRyaXg6IG91dHB1dCBvZiB0aGUgZnVuY3Rpb25cbiAgICAgKiAtIHZpZXc6IFR5cGUgb2Ygdmlldy4gQ2FuIGJlIHtAbGluayBWSUVXX0NFTlRFUn0sIHtAbGluayBWSUVXX0xFRlR9IG9yIHtAbGluayBWSUVXX1JJR0hUfS5cbiAgICAgKlxuICAgICAqIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDYWxjdWxhdGVNYXRyaXhDYWxsYmFja31cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlUHJvamVjdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbiA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVQcm9qZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZ1bmN0aW9uIHlvdSBjYW4gcHJvdmlkZSB0byBjYWxjdWxhdGUgdGhlIGNhbWVyYSB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggbWFudWFsbHkuIENhblxuICAgICAqIGJlIHVzZWQgZm9yIGNvbXBsZXggZWZmZWN0cyBsaWtlIHJlZmxlY3Rpb25zLiBGdW5jdGlvbiBpcyBjYWxsZWQgdXNpbmcgY29tcG9uZW50J3Mgc2NvcGUuXG4gICAgICogQXJndW1lbnRzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgTWF0NH0gdHJhbnNmb3JtTWF0cml4OiBvdXRwdXQgb2YgdGhlIGZ1bmN0aW9uLlxuICAgICAqIC0gdmlldzogVHlwZSBvZiB2aWV3LiBDYW4gYmUge0BsaW5rIFZJRVdfQ0VOVEVSfSwge0BsaW5rIFZJRVdfTEVGVH0gb3Ige0BsaW5rIFZJRVdfUklHSFR9LlxuICAgICAqXG4gICAgICogTGVmdCBhbmQgcmlnaHQgYXJlIG9ubHkgdXNlZCBpbiBzdGVyZW8gcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge0NhbGN1bGF0ZU1hdHJpeENhbGxiYWNrfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVUcmFuc2Zvcm0odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVUcmFuc2Zvcm0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSBjb21wb25lbnQncyB1bmRlcmx5aW5nIENhbWVyYSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDYW1lcmF9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBjYW1lcmEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIHVzZWQgdG8gY2xlYXIgdGhlIGNhbnZhcyB0byBiZWZvcmUgdGhlIGNhbWVyYSBzdGFydHMgdG8gcmVuZGVyLiBEZWZhdWx0cyB0b1xuICAgICAqIFswLjc1LCAwLjc1LCAwLjc1LCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcycpLkNvbG9yfVxuICAgICAqL1xuICAgIHNldCBjbGVhckNvbG9yKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhckNvbG9yID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJDb2xvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgY29sb3IgYnVmZmVyIHRvIHRoZSBjb2xvciBzZXQgaW4gY2xlYXJDb2xvci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckNvbG9yQnVmZmVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhckNvbG9yQnVmZmVyID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBjbGVhckNvbG9yQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmNsZWFyQ29sb3JCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckRlcHRoQnVmZmVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhckRlcHRoQnVmZmVyID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmNsZWFyRGVwdGhCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2xlYXJTdGVuY2lsQnVmZmVyID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBjbGVhclN0ZW5jaWxCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGNhbWVyYSB3aWxsIHRha2UgbWF0ZXJpYWwuY3VsbCBpbnRvIGFjY291bnQuIE90aGVyd2lzZSBib3RoIGZyb250IGFuZCBiYWNrIGZhY2VzXG4gICAgICogd2lsbCBiZSByZW5kZXJlZC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjdWxsRmFjZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmN1bGxGYWNlcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjdWxsRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY3VsbEZhY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExheWVyIElEIG9mIGEgbGF5ZXIgb24gd2hpY2ggdGhlIHBvc3Rwcm9jZXNzaW5nIG9mIHRoZSBjYW1lcmEgc3RvcHMgYmVpbmcgYXBwbGllZCB0by5cbiAgICAgKiBEZWZhdWx0cyB0byBMQVlFUklEX1VJLCB3aGljaCBjYXVzZXMgcG9zdCBwcm9jZXNzaW5nIHRvIG5vdCBiZSBhcHBsaWVkIHRvIFVJIGxheWVyIGFuZCBhbnlcbiAgICAgKiBmb2xsb3dpbmcgbGF5ZXJzIGZvciB0aGUgY2FtZXJhLiBTZXQgdG8gdW5kZWZpbmVkIGZvciBwb3N0LXByb2Nlc3NpbmcgdG8gYmUgYXBwbGllZCB0byBhbGxcbiAgICAgKiBsYXllcnMgb2YgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRpc2FibGVQb3N0RWZmZWN0c0xheWVyKGxheWVyKSB7XG4gICAgICAgIHRoaXMuX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBkaXNhYmxlUG9zdEVmZmVjdHNMYXllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgYWZ0ZXIgd2hpY2ggbm8gcmVuZGVyaW5nIHdpbGwgdGFrZSBwbGFjZS4gRGVmYXVsdHMgdG8gMTAwMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZhckNsaXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmZhckNsaXAgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZmFyQ2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5mYXJDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGNhbWVyYSB3aWxsIGludmVydCBmcm9udCBhbmQgYmFjayBmYWNlcy4gQ2FuIGJlIHVzZWZ1bCBmb3IgcmVmbGVjdGlvbiByZW5kZXJpbmcuXG4gICAgICogRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZmxpcEZhY2VzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5mbGlwRmFjZXMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcEZhY2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmZsaXBGYWNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmllbGQgb2YgdmlldyBvZiB0aGUgY2FtZXJhIGluIGRlZ3JlZXMuIFVzdWFsbHkgdGhpcyBpcyB0aGUgWS1heGlzIGZpZWxkIG9mIHZpZXcsIHNlZVxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnQjaG9yaXpvbnRhbEZvdn0uIFVzZWQgZm9yIHtAbGluayBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFfSBjYW1lcmFzIG9ubHkuXG4gICAgICogRGVmYXVsdHMgdG8gNDUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmb3YodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmZvdiA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmb3YoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuZm92O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSdzIGZydXN0dW0gc2hhcGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2ZydXN0dW0uanMnKS5GcnVzdHVtfVxuICAgICAqL1xuICAgIGdldCBmcnVzdHVtKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmZydXN0dW07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgdGhlIGN1bGxpbmcgb2YgbWVzaCBpbnN0YW5jZXMgYWdhaW5zdCB0aGUgY2FtZXJhIGZydXN0dW0sIGkuZS4gaWYgb2JqZWN0cyBvdXRzaWRlXG4gICAgICogb2YgY2FtZXJhIHNob3VsZCBiZSBvbWl0dGVkIGZyb20gcmVuZGVyaW5nLiBJZiBmYWxzZSwgYWxsIG1lc2ggaW5zdGFuY2VzIGluIHRoZSBzY2VuZSBhcmVcbiAgICAgKiByZW5kZXJlZCBieSB0aGUgY2FtZXJhLCByZWdhcmRsZXNzIG9mIHZpc2liaWxpdHkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZydXN0dW1DdWxsaW5nKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5mcnVzdHVtQ3VsbGluZyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmcnVzdHVtQ3VsbGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5mcnVzdHVtQ3VsbGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgd2hpY2ggYXhpcyB0byB1c2UgZm9yIHRoZSBGaWVsZCBvZiBWaWV3IGNhbGN1bGF0aW9uLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBob3Jpem9udGFsRm92KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5ob3Jpem9udGFsRm92ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGhvcml6b250YWxGb3YoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuaG9yaXpvbnRhbEZvdjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgY2FtZXJhIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gsXG4gICAgICogcG9wLCBzcGxpY2Ugb3IgbW9kaWZ5IHRoaXMgYXJyYXksIGlmIHlvdSB3YW50IHRvIGNoYW5nZSBpdCwgc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLiBEZWZhdWx0c1xuICAgICAqIHRvIFtMQVlFUklEX1dPUkxELCBMQVlFUklEX0RFUFRILCBMQVlFUklEX1NLWUJPWCwgTEFZRVJJRF9VSSwgTEFZRVJJRF9JTU1FRElBVEVdLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnMobmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5fY2FtZXJhLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhLmxheWVycyA9IG5ld1ZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChuZXdWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZENhbWVyYSh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEubGF5ZXJzO1xuICAgIH1cblxuICAgIGdldCBsYXllcnNTZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEubGF5ZXJzU2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgYmVmb3JlIHdoaWNoIG5vIHJlbmRlcmluZyB3aWxsIHRha2UgcGxhY2UuIERlZmF1bHRzIHRvIDAuMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG5lYXJDbGlwKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5uZWFyQ2xpcCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBuZWFyQ2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5uZWFyQ2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGFsZi1oZWlnaHQgb2YgdGhlIG9ydGhvZ3JhcGhpYyB2aWV3IHdpbmRvdyAoaW4gdGhlIFktYXhpcykuIFVzZWQgZm9yXG4gICAgICoge0BsaW5rIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDfSBjYW1lcmFzIG9ubHkuIERlZmF1bHRzIHRvIDEwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgb3J0aG9IZWlnaHQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLm9ydGhvSGVpZ2h0ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG9ydGhvSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLm9ydGhvSGVpZ2h0O1xuICAgIH1cblxuICAgIGdldCBwb3N0RWZmZWN0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc3RFZmZlY3RzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwb3N0IGVmZmVjdHMgcXVldWUgZm9yIHRoaXMgY2FtZXJhLiBVc2UgdGhpcyB0byBhZGQgb3IgcmVtb3ZlIHBvc3QgZWZmZWN0cyBmcm9tIHRoZSBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UG9zdEVmZmVjdFF1ZXVlfVxuICAgICAqL1xuICAgIGdldCBwb3N0RWZmZWN0c0VuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wb3N0RWZmZWN0cy5lbmFibGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHRoZSBvcmRlciBpbiB3aGljaCBjYW1lcmFzIGFyZSByZW5kZXJlZC4gQ2FtZXJhcyB3aXRoIHNtYWxsZXIgdmFsdWVzIGZvciBwcmlvcml0eVxuICAgICAqIGFyZSByZW5kZXJlZCBmaXJzdC4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHByaW9yaXR5KG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gbmV3VmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBwcmlvcml0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByaW9yaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHByb2plY3Rpb24gdXNlZCB0byByZW5kZXIgdGhlIGNhbWVyYS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUFJPSkVDVElPTl9QRVJTUEVDVElWRX06IEEgcGVyc3BlY3RpdmUgcHJvamVjdGlvbi4gVGhlIGNhbWVyYSBmcnVzdHVtXG4gICAgICogcmVzZW1ibGVzIGEgdHJ1bmNhdGVkIHB5cmFtaWQuXG4gICAgICogLSB7QGxpbmsgUFJPSkVDVElPTl9PUlRIT0dSQVBISUN9OiBBbiBvcnRob2dyYXBoaWMgcHJvamVjdGlvbi4gVGhlIGNhbWVyYVxuICAgICAqIGZydXN0dW0gaXMgYSBjdWJvaWQuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUFJPSkVDVElPTl9QRVJTUEVDVElWRX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBwcm9qZWN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5wcm9qZWN0aW9uID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHByb2plY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEucHJvamVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJykuTWF0NH1cbiAgICAgKi9cbiAgICBnZXQgcHJvamVjdGlvbk1hdHJpeCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHdoZXJlIG9uIHRoZSBzY3JlZW4gdGhlIGNhbWVyYSB3aWxsIGJlIHJlbmRlcmVkIGluIG5vcm1hbGl6ZWQgc2NyZWVuIGNvb3JkaW5hdGVzLlxuICAgICAqIERlZmF1bHRzIHRvIFswLCAwLCAxLCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH1cbiAgICAgKi9cbiAgICBzZXQgcmVjdCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEucmVjdCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpyZWN0JywgdGhpcy5fY2FtZXJhLnJlY3QpO1xuICAgIH1cblxuICAgIGdldCByZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnJlY3Q7XG4gICAgfVxuXG4gICAgc2V0IHJlbmRlclNjZW5lQ29sb3JNYXAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICYmICF0aGlzLl9zY2VuZUNvbG9yTWFwUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RTY2VuZUNvbG9yTWFwKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5fc2NlbmVDb2xvck1hcFJlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fc2NlbmVDb2xvck1hcFJlcXVlc3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U2NlbmVDb2xvck1hcChmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl9zY2VuZUNvbG9yTWFwUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU2NlbmVDb2xvck1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclNjZW5lQ29sb3JNYXAgPiAwO1xuICAgIH1cblxuICAgIHNldCByZW5kZXJTY2VuZURlcHRoTWFwKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U2NlbmVEZXB0aE1hcCh0cnVlKTtcbiAgICAgICAgICAgIHRoaXMuX3NjZW5lRGVwdGhNYXBSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3NjZW5lRGVwdGhNYXBSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdFNjZW5lRGVwdGhNYXAoZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclNjZW5lRGVwdGhNYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwID4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgdGFyZ2V0IHRvIHdoaWNoIHJlbmRlcmluZyBvZiB0aGUgY2FtZXJhcyBpcyBwZXJmb3JtZWQuIElmIG5vdCBzZXQsIGl0IHdpbGwgcmVuZGVyXG4gICAgICogc2ltcGx5IHRvIHRoZSBzY3JlZW4uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fVxuICAgICAqL1xuICAgIHNldCByZW5kZXJUYXJnZXQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnJlbmRlclRhcmdldCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGlwcyBhbGwgcGl4ZWxzIHdoaWNoIGFyZSBub3QgaW4gdGhlIHJlY3RhbmdsZS4gVGhlIG9yZGVyIG9mIHRoZSB2YWx1ZXMgaXNcbiAgICAgKiBbeCwgeSwgd2lkdGgsIGhlaWdodF0uIERlZmF1bHRzIHRvIFswLCAwLCAxLCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH1cbiAgICAgKi9cbiAgICBzZXQgc2Npc3NvclJlY3QodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnNjaXNzb3JSZWN0ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNjaXNzb3JSZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNjaXNzb3JSZWN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBjYW1lcmEgc2Vuc2l0aXZpdHkgaW4gSVNPLCB0aGUgZGVmYXVsdCB2YWx1ZSBpcyAxMDAwLiBIaWdoZXIgdmFsdWUgbWVhbnMgbW9yZSBleHBvc3VyZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNlbnNpdGl2aXR5KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5zZW5zaXRpdml0eSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzZW5zaXRpdml0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5zZW5zaXRpdml0eTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgY2FtZXJhIHNodXR0ZXIgc3BlZWQgaW4gc2Vjb25kcywgdGhlIGRlZmF1bHQgdmFsdWUgaXMgMS8xMDAwcy4gTG9uZ2VyIHNodXR0ZXIgbWVhbnMgbW9yZSBleHBvc3VyZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNodXR0ZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnNodXR0ZXIgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc2h1dHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5zaHV0dGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSdzIHZpZXcgbWF0cml4LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0fVxuICAgICAqL1xuICAgIGdldCB2aWV3TWF0cml4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnZpZXdNYXRyaXg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmFzZWQgb24gdGhlIHZhbHVlLCB0aGUgZGVwdGggbGF5ZXIncyBlbmFibGUgY291bnRlciBpcyBpbmNyZW1lbnRlZCBvciBkZWNyZW1lbnRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdmFsdWUgLSBUcnVlIHRvIGluY3JlbWVudCB0aGUgY291bnRlciwgZmFsc2UgdG8gZGVjcmVtZW50IGl0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjb3VudGVyIHdhcyBpbmNyZW1lbnRlZCBvciBkZWNyZW1lbnRlZCwgZmFsc2UgaWYgdGhlIGRlcHRoXG4gICAgICogbGF5ZXIgaXMgbm90IHByZXNlbnQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZW5hYmxlRGVwdGhMYXllcih2YWx1ZSkge1xuICAgICAgICBjb25zdCBoYXNEZXB0aExheWVyID0gdGhpcy5sYXllcnMuZmluZChsYXllcklkID0+IGxheWVySWQgPT09IExBWUVSSURfREVQVEgpO1xuICAgICAgICBpZiAoaGFzRGVwdGhMYXllcikge1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbGF5ZXIuanMnKS5MYXllcn0gKi9cbiAgICAgICAgICAgIGNvbnN0IGRlcHRoTGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0RFUFRIKTtcblxuICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZGVwdGhMYXllcj8uaW5jcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXB0aExheWVyPy5kZWNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3QgdGhlIHNjZW5lIHRvIGdlbmVyYXRlIGEgdGV4dHVyZSBjb250YWluaW5nIHRoZSBzY2VuZSBjb2xvciBtYXAuIE5vdGUgdGhhdCB0aGlzIGNhbGxcbiAgICAgKiBpcyBhY2N1bXVsYXRpdmUsIGFuZCBmb3IgZWFjaCBlbmFibGUgcmVxdWVzdCwgYSBkaXNhYmxlIHJlcXVlc3QgbmVlZCB0byBiZSBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIHRvIHJlcXVlc3QgdGhlIGdlbmVyYXRpb24sIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgcmVxdWVzdFNjZW5lQ29sb3JNYXAoZW5hYmxlZCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTY2VuZUNvbG9yTWFwICs9IGVuYWJsZWQgPyAxIDogLTE7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9yZW5kZXJTY2VuZUNvbG9yTWFwID49IDApO1xuICAgICAgICBjb25zdCBvayA9IHRoaXMuX2VuYWJsZURlcHRoTGF5ZXIoZW5hYmxlZCk7XG4gICAgICAgIGlmICghb2spIHtcbiAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lQ29sb3JNYXAgd2FzIGNhbGxlZCwgYnV0IHRoZSBjYW1lcmEgZG9lcyBub3QgaGF2ZSBhIERlcHRoIGxheWVyLCBpZ25vcmluZy4nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3QgdGhlIHNjZW5lIHRvIGdlbmVyYXRlIGEgdGV4dHVyZSBjb250YWluaW5nIHRoZSBzY2VuZSBkZXB0aCBtYXAuIE5vdGUgdGhhdCB0aGlzIGNhbGxcbiAgICAgKiBpcyBhY2N1bXVsYXRpdmUsIGFuZCBmb3IgZWFjaCBlbmFibGUgcmVxdWVzdCwgYSBkaXNhYmxlIHJlcXVlc3QgbmVlZCB0byBiZSBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIHRvIHJlcXVlc3QgdGhlIGdlbmVyYXRpb24sIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgcmVxdWVzdFNjZW5lRGVwdGhNYXAoZW5hYmxlZCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwICs9IGVuYWJsZWQgPyAxIDogLTE7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwID49IDApO1xuICAgICAgICBjb25zdCBvayA9IHRoaXMuX2VuYWJsZURlcHRoTGF5ZXIoZW5hYmxlZCk7XG4gICAgICAgIGlmICghb2spIHtcbiAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lRGVwdGhNYXAgd2FzIGNhbGxlZCwgYnV0IHRoZSBjYW1lcmEgZG9lcyBub3QgaGF2ZSBhIERlcHRoIGxheWVyLCBpZ25vcmluZy4nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKSB7XG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uIG5lZWRzIHRvIHVwZGF0ZSBvcmRlclxuICAgICAgICBjb25zdCBsYXllckNvbXAgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBsYXllckNvbXAuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gMkQgc2NyZWVuIHNwYWNlIHRvIDNEIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjcmVlbnggLSBYIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2VcbiAgICAgKiAwIHRvIGBjYW52YXMub2Zmc2V0V2lkdGhgIG9mIHRoZSBhcHBsaWNhdGlvbidzIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY3JlZW55IC0gWSBjb29yZGluYXRlIG9uIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LiBTaG91bGQgYmUgaW4gdGhlIHJhbmdlXG4gICAgICogMCB0byBgY2FudmFzLm9mZnNldEhlaWdodGAgb2YgdGhlIGFwcGxpY2F0aW9uJ3MgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNhbWVyYXogLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgY2FtZXJhIGluIHdvcmxkIHNwYWNlIHRvIGNyZWF0ZSB0aGUgbmV3XG4gICAgICogcG9pbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gW3dvcmxkQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmUgd29ybGRcbiAgICAgKiBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCB0aGUgc3RhcnQgYW5kIGVuZCBwb2ludHMgb2YgYSAzRCByYXkgZmlyZWQgZnJvbSBhIHNjcmVlbiBjbGljayBwb3NpdGlvblxuICAgICAqIGNvbnN0IHN0YXJ0ID0gZW50aXR5LmNhbWVyYS5zY3JlZW5Ub1dvcmxkKGNsaWNrWCwgY2xpY2tZLCBlbnRpdHkuY2FtZXJhLm5lYXJDbGlwKTtcbiAgICAgKiBjb25zdCBlbmQgPSBlbnRpdHkuY2FtZXJhLnNjcmVlblRvV29ybGQoY2xpY2tYLCBjbGlja1ksIGVudGl0eS5jYW1lcmEuZmFyQ2xpcCk7XG4gICAgICpcbiAgICAgKiAvLyBVc2UgdGhlIHJheSBjb29yZGluYXRlcyB0byBwZXJmb3JtIGEgcmF5Y2FzdFxuICAgICAqIGFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0Rmlyc3Qoc3RhcnQsIGVuZCwgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhcIkVudGl0eSBcIiArIHJlc3VsdC5lbnRpdHkubmFtZSArIFwiIHdhcyBzZWxlY3RlZFwiKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IFRoZSB3b3JsZCBzcGFjZSBjb29yZGluYXRlLlxuICAgICAqL1xuICAgIHNjcmVlblRvV29ybGQoc2NyZWVueCwgc2NyZWVueSwgY2FtZXJheiwgd29ybGRDb29yZCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHcgPSBkZXZpY2UuY2xpZW50UmVjdC53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IGRldmljZS5jbGllbnRSZWN0LmhlaWdodDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5zY3JlZW5Ub1dvcmxkKHNjcmVlbngsIHNjcmVlbnksIGNhbWVyYXosIHcsIGgsIHdvcmxkQ29vcmQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgYSBwb2ludCBmcm9tIDNEIHdvcmxkIHNwYWNlIHRvIDJEIHNjcmVlbiBzcGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IHdvcmxkQ29vcmQgLSBUaGUgd29ybGQgc3BhY2UgY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBbc2NyZWVuQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmVcbiAgICAgKiBzY3JlZW4gY29vcmRpbmF0ZSByZXN1bHQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBUaGUgc2NyZWVuIHNwYWNlIGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgd29ybGRUb1NjcmVlbih3b3JsZENvb3JkLCBzY3JlZW5Db29yZCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHcgPSBkZXZpY2UuY2xpZW50UmVjdC53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IGRldmljZS5jbGllbnRSZWN0LmhlaWdodDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS53b3JsZFRvU2NyZWVuKHdvcmxkQ29vcmQsIHcsIGgsIHNjcmVlbkNvb3JkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgYmVmb3JlIGFwcGxpY2F0aW9uIHJlbmRlcnMgdGhlIHNjZW5lLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIG9uQXBwUHJlcmVuZGVyKCkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuX3ZpZXdNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5fdmlld1Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYWRkQ2FtZXJhVG9MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMubGF5ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChsYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkQ2FtZXJhKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgcmVtb3ZlQ2FtZXJhRnJvbUxheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVDYW1lcmEodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBvbGRDb21wIC0gT2xkIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG5ld0NvbXAgLSBOZXcgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICB0aGlzLmFkZENhbWVyYVRvTGF5ZXJzKCk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdG8gYWRkIHRoZSBjYW1lcmEgdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5hZGRDYW1lcmEodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gVGhlIGxheWVyIHRvIHJlbW92ZSB0aGUgY2FtZXJhIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZUNhbWVyYSh0aGlzKTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3Qgc3lzdGVtID0gdGhpcy5zeXN0ZW07XG4gICAgICAgIGNvbnN0IHNjZW5lID0gc3lzdGVtLmFwcC5zY2VuZTtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gc2NlbmUubGF5ZXJzO1xuXG4gICAgICAgIHN5c3RlbS5hZGRDYW1lcmEodGhpcyk7XG5cbiAgICAgICAgc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChsYXllcnMpIHtcbiAgICAgICAgICAgIGxheWVycy5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgbGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5hZGRDYW1lcmFUb0xheWVycygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wb3N0RWZmZWN0cy5lbmFibGUoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGNvbnN0IHN5c3RlbSA9IHRoaXMuc3lzdGVtO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHN5c3RlbS5hcHAuc2NlbmU7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHNjZW5lLmxheWVycztcblxuICAgICAgICB0aGlzLnBvc3RFZmZlY3RzLmRpc2FibGUoKTtcblxuICAgICAgICB0aGlzLnJlbW92ZUNhbWVyYUZyb21MYXllcnMoKTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChsYXllcnMpIHtcbiAgICAgICAgICAgIGxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIGxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgc3lzdGVtLnJlbW92ZUNhbWVyYSh0aGlzKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5vbkRpc2FibGUoKTtcbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGVzIGFzcGVjdCByYXRpbyB2YWx1ZSBmb3IgYSBnaXZlbiByZW5kZXIgdGFyZ2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IFtydF0gLSBPcHRpb25hbFxuICAgICAqIHJlbmRlciB0YXJnZXQuIElmIHVuc3BlY2lmaWVkLCB0aGUgYmFja2J1ZmZlciBpcyB1c2VkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBhc3BlY3QgcmF0aW8gb2YgdGhlIHJlbmRlciB0YXJnZXQgKG9yIGJhY2tidWZmZXIpLlxuICAgICAqL1xuICAgIGNhbGN1bGF0ZUFzcGVjdFJhdGlvKHJ0KSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3Qgd2lkdGggPSBydCA/IHJ0LndpZHRoIDogZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBydCA/IHJ0LmhlaWdodCA6IGRldmljZS5oZWlnaHQ7XG4gICAgICAgIHJldHVybiAod2lkdGggKiB0aGlzLnJlY3QueikgLyAoaGVpZ2h0ICogdGhpcy5yZWN0LncpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByZXBhcmUgdGhlIGNhbWVyYSBmb3IgZnJhbWUgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IHJ0IC0gUmVuZGVyXG4gICAgICogdGFyZ2V0IHRvIHdoaWNoIHJlbmRlcmluZyB3aWxsIGJlIHBlcmZvcm1lZC4gV2lsbCBhZmZlY3QgY2FtZXJhJ3MgYXNwZWN0IHJhdGlvLCBpZlxuICAgICAqIGFzcGVjdFJhdGlvTW9kZSBpcyB7QGxpbmsgQVNQRUNUX0FVVE99LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBmcmFtZVVwZGF0ZShydCkge1xuICAgICAgICBpZiAodGhpcy5hc3BlY3RSYXRpb01vZGUgPT09IEFTUEVDVF9BVVRPKSB7XG4gICAgICAgICAgICB0aGlzLmFzcGVjdFJhdGlvID0gdGhpcy5jYWxjdWxhdGVBc3BlY3RSYXRpbyhydCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0IHRvIHN0YXJ0IFhSIHNlc3Npb24gd2l0aCB0aGlzIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVGhlIHR5cGUgb2Ygc2Vzc2lvbi4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0lOTElORX06IElubGluZSAtIGFsd2F5cyBhdmFpbGFibGUgdHlwZSBvZiBzZXNzaW9uLiBJdCBoYXMgbGltaXRlZCBmZWF0dXJlXG4gICAgICogYXZhaWxhYmlsaXR5IGFuZCBpcyByZW5kZXJlZCBpbnRvIEhUTUwgZWxlbWVudC5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfVlJ9OiBJbW1lcnNpdmUgVlIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byB0aGUgVlIgZGV2aWNlXG4gICAgICogd2l0aCB0aGUgYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gdGhlIFZSL0FSXG4gICAgICogZGV2aWNlIHRoYXQgaXMgaW50ZW5kZWQgdG8gYmUgYmxlbmRlZCB3aXRoIHRoZSByZWFsLXdvcmxkIGVudmlyb25tZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNwYWNlVHlwZSAtIFJlZmVyZW5jZSBzcGFjZSB0eXBlLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1ZJRVdFUn06IFZpZXdlciAtIGFsd2F5cyBzdXBwb3J0ZWQgc3BhY2Ugd2l0aCBzb21lIGJhc2ljIHRyYWNraW5nXG4gICAgICogY2FwYWJpbGl0aWVzLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUx9OiBMb2NhbCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpbiBuZWFyIHRoZVxuICAgICAqIHZpZXdlciBhdCB0aGUgdGltZSBvZiBjcmVhdGlvbi4gSXQgaXMgbWVhbnQgZm9yIHNlYXRlZCBvciBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMRkxPT1J9OiBMb2NhbCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpblxuICAgICAqIGF0IHRoZSBmbG9vciBpbiBhIHNhZmUgcG9zaXRpb24gZm9yIHRoZSB1c2VyIHRvIHN0YW5kLiBUaGUgeS1heGlzIGVxdWFscyAwIGF0IGZsb29yIGxldmVsLlxuICAgICAqIEZsb29yIGxldmVsIHZhbHVlIG1pZ2h0IGJlIGVzdGltYXRlZCBieSB0aGUgdW5kZXJseWluZyBwbGF0Zm9ybS4gSXQgaXMgbWVhbnQgZm9yIHNlYXRlZCBvclxuICAgICAqIGJhc2ljIGxvY2FsIFhSIHNlc3Npb25zLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfQk9VTkRFREZMT09SfTogQm91bmRlZCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGl0cyBuYXRpdmVcbiAgICAgKiBvcmlnaW4gYXQgdGhlIGZsb29yLCB3aGVyZSB0aGUgdXNlciBpcyBleHBlY3RlZCB0byBtb3ZlIHdpdGhpbiBhIHByZS1lc3RhYmxpc2hlZCBib3VuZGFyeS5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1VOQk9VTkRFRH06IFVuYm91bmRlZCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aGVyZSB0aGUgdXNlciBpc1xuICAgICAqIGV4cGVjdGVkIHRvIG1vdmUgZnJlZWx5IGFyb3VuZCB0aGVpciBlbnZpcm9ubWVudCwgcG90ZW50aWFsbHkgbG9uZyBkaXN0YW5jZXMgZnJvbSB0aGVpclxuICAgICAqIHN0YXJ0aW5nIHBvaW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9iamVjdCB3aXRoIG9wdGlvbnMgZm9yIFhSIHNlc3Npb24gaW5pdGlhbGl6YXRpb24uXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMub3B0aW9uYWxGZWF0dXJlc10gLSBPcHRpb25hbCBmZWF0dXJlcyBmb3IgWFJTZXNzaW9uIHN0YXJ0LiBJdCBpc1xuICAgICAqIHVzZWQgZm9yIGdldHRpbmcgYWNjZXNzIHRvIGFkZGl0aW9uYWwgV2ViWFIgc3BlYyBleHRlbnNpb25zLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaW1hZ2VUcmFja2luZ10gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZSB7QGxpbmsgWHJJbWFnZVRyYWNraW5nfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnBsYW5lRGV0ZWN0aW9uXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlIHtAbGluayBYclBsYW5lRGV0ZWN0aW9ufS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4veHIveHItbWFuYWdlci5qcycpLlhyRXJyb3JDYWxsYmFja30gW29wdGlvbnMuY2FsbGJhY2tdIC0gT3B0aW9uYWxcbiAgICAgKiBjYWxsYmFjayBmdW5jdGlvbiBjYWxsZWQgb25jZSB0aGUgc2Vzc2lvbiBpcyBzdGFydGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtXG4gICAgICogaXQgaXMgbnVsbCBpZiB0aGUgWFIgc2Vzc2lvbiBzdGFydGVkIHN1Y2Nlc3NmdWxseS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnMuZGVwdGhTZW5zaW5nXSAtIE9wdGlvbmFsIG9iamVjdCB3aXRoIGRlcHRoIHNlbnNpbmcgcGFyYW1ldGVycyB0b1xuICAgICAqIGF0dGVtcHQgdG8gZW5hYmxlIHtAbGluayBYckRlcHRoU2Vuc2luZ30uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2VdIC0gT3B0aW9uYWwgdXNhZ2UgcHJlZmVyZW5jZSBmb3IgZGVwdGhcbiAgICAgKiBzZW5zaW5nLCBjYW4gYmUgJ2NwdS1vcHRpbWl6ZWQnIG9yICdncHUtb3B0aW1pemVkJyAoWFJERVBUSFNFTlNJTkdVU0FHRV8qKSwgZGVmYXVsdHMgdG9cbiAgICAgKiAnY3B1LW9wdGltaXplZCcuIE1vc3QgcHJlZmVycmVkIGFuZCBzdXBwb3J0ZWQgd2lsbCBiZSBjaG9zZW4gYnkgdGhlIHVuZGVybHlpbmcgZGVwdGggc2Vuc2luZ1xuICAgICAqIHN5c3RlbS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLmRhdGFGb3JtYXRQcmVmZXJlbmNlXSAtIE9wdGlvbmFsIGRhdGEgZm9ybWF0XG4gICAgICogcHJlZmVyZW5jZSBmb3IgZGVwdGggc2Vuc2luZy4gQ2FuIGJlICdsdW1pbmFuY2UtYWxwaGEnIG9yICdmbG9hdDMyJyAoWFJERVBUSFNFTlNJTkdGT1JNQVRfKiksXG4gICAgICogZGVmYXVsdHMgdG8gJ2x1bWluYW5jZS1hbHBoYScuIE1vc3QgcHJlZmVycmVkIGFuZCBzdXBwb3J0ZWQgd2lsbCBiZSBjaG9zZW4gYnkgdGhlIHVuZGVybHlpbmdcbiAgICAgKiBkZXB0aCBzZW5zaW5nIHN5c3RlbS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIE9uIGFuIGVudGl0eSB3aXRoIGEgY2FtZXJhIGNvbXBvbmVudFxuICAgICAqIHRoaXMuZW50aXR5LmNhbWVyYS5zdGFydFhyKHBjLlhSVFlQRV9WUiwgcGMuWFJTUEFDRV9MT0NBTCwge1xuICAgICAqICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVycikge1xuICAgICAqICAgICAgICAgaWYgKGVycikge1xuICAgICAqICAgICAgICAgICAgIC8vIGZhaWxlZCB0byBzdGFydCBYUiBzZXNzaW9uXG4gICAgICogICAgICAgICB9IGVsc2Uge1xuICAgICAqICAgICAgICAgICAgIC8vIGluIFhSXG4gICAgICogICAgICAgICB9XG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGFydFhyKHR5cGUsIHNwYWNlVHlwZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAueHIuc3RhcnQodGhpcywgdHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0IHRvIGVuZCBYUiBzZXNzaW9uIG9mIHRoaXMgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3hyL3hyLW1hbmFnZXIuanMnKS5YckVycm9yQ2FsbGJhY2t9IFtjYWxsYmFja10gLSBPcHRpb25hbCBjYWxsYmFja1xuICAgICAqIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHNlc3Npb24gaXMgZW5kZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZlxuICAgICAqIHN1Y2Nlc3NmdWxseSBlbmRlZCBYUiBzZXNzaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gT24gYW4gZW50aXR5IHdpdGggYSBjYW1lcmEgY29tcG9uZW50XG4gICAgICogdGhpcy5lbnRpdHkuY2FtZXJhLmVuZFhyKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgKiAgICAgLy8gbm90IGFueW1vcmUgaW4gWFJcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBlbmRYcihjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX2NhbWVyYS54cikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ0NhbWVyYSBpcyBub3QgaW4gWFInKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jYW1lcmEueHIuZW5kKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0byBjb3B5IHByb3BlcnRpZXMgZnJvbSB0aGUgc291cmNlIENhbWVyYUNvbXBvbmVudC5cbiAgICAgKiBQcm9wZXJ0aWVzIG5vdCBjb3BpZWQ6IHBvc3RFZmZlY3RzLlxuICAgICAqIEluaGVyaXRlZCBwcm9wZXJ0aWVzIG5vdCBjb3BpZWQgKGFsbCk6IHN5c3RlbSwgZW50aXR5LCBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IHNvdXJjZSAtIFRoZSBzb3VyY2UgY29tcG9uZW50LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjb3B5KHNvdXJjZSkge1xuICAgICAgICB0aGlzLmFwZXJ0dXJlID0gc291cmNlLmFwZXJ0dXJlO1xuICAgICAgICB0aGlzLmFzcGVjdFJhdGlvID0gc291cmNlLmFzcGVjdFJhdGlvO1xuICAgICAgICB0aGlzLmFzcGVjdFJhdGlvTW9kZSA9IHNvdXJjZS5hc3BlY3RSYXRpb01vZGU7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlUHJvamVjdGlvbiA9IHNvdXJjZS5jYWxjdWxhdGVQcm9qZWN0aW9uO1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVRyYW5zZm9ybSA9IHNvdXJjZS5jYWxjdWxhdGVUcmFuc2Zvcm07XG4gICAgICAgIHRoaXMuY2xlYXJDb2xvciA9IHNvdXJjZS5jbGVhckNvbG9yO1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3JCdWZmZXIgPSBzb3VyY2UuY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoQnVmZmVyID0gc291cmNlLmNsZWFyRGVwdGhCdWZmZXI7XG4gICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsQnVmZmVyID0gc291cmNlLmNsZWFyU3RlbmNpbEJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jdWxsRmFjZXMgPSBzb3VyY2UuY3VsbEZhY2VzO1xuICAgICAgICB0aGlzLmRpc2FibGVQb3N0RWZmZWN0c0xheWVyID0gc291cmNlLmRpc2FibGVQb3N0RWZmZWN0c0xheWVyO1xuICAgICAgICB0aGlzLmZhckNsaXAgPSBzb3VyY2UuZmFyQ2xpcDtcbiAgICAgICAgdGhpcy5mbGlwRmFjZXMgPSBzb3VyY2UuZmxpcEZhY2VzO1xuICAgICAgICB0aGlzLmZvdiA9IHNvdXJjZS5mb3Y7XG4gICAgICAgIHRoaXMuZnJ1c3R1bUN1bGxpbmcgPSBzb3VyY2UuZnJ1c3R1bUN1bGxpbmc7XG4gICAgICAgIHRoaXMuaG9yaXpvbnRhbEZvdiA9IHNvdXJjZS5ob3Jpem9udGFsRm92O1xuICAgICAgICB0aGlzLmxheWVycyA9IHNvdXJjZS5sYXllcnM7XG4gICAgICAgIHRoaXMubmVhckNsaXAgPSBzb3VyY2UubmVhckNsaXA7XG4gICAgICAgIHRoaXMub3J0aG9IZWlnaHQgPSBzb3VyY2Uub3J0aG9IZWlnaHQ7XG4gICAgICAgIHRoaXMucHJpb3JpdHkgPSBzb3VyY2UucHJpb3JpdHk7XG4gICAgICAgIHRoaXMucHJvamVjdGlvbiA9IHNvdXJjZS5wcm9qZWN0aW9uO1xuICAgICAgICB0aGlzLnJlY3QgPSBzb3VyY2UucmVjdDtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBzb3VyY2UucmVuZGVyVGFyZ2V0O1xuICAgICAgICB0aGlzLnNjaXNzb3JSZWN0ID0gc291cmNlLnNjaXNzb3JSZWN0O1xuICAgICAgICB0aGlzLnNlbnNpdGl2aXR5ID0gc291cmNlLnNlbnNpdGl2aXR5O1xuICAgICAgICB0aGlzLnNodXR0ZXIgPSBzb3VyY2Uuc2h1dHRlcjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IENhbWVyYUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIkNhbWVyYUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5Iiwib25Qb3N0cHJvY2Vzc2luZyIsIm9uUHJlUmVuZGVyIiwib25Qb3N0UmVuZGVyIiwiX3JlbmRlclNjZW5lRGVwdGhNYXAiLCJfcmVuZGVyU2NlbmVDb2xvck1hcCIsIl9zY2VuZURlcHRoTWFwUmVxdWVzdGVkIiwiX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQiLCJfcHJpb3JpdHkiLCJfZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIiLCJMQVlFUklEX1VJIiwiX2NhbWVyYSIsIkNhbWVyYSIsIm5vZGUiLCJfcG9zdEVmZmVjdHMiLCJQb3N0RWZmZWN0UXVldWUiLCJhcHAiLCJzZXRTaGFkZXJQYXNzIiwibmFtZSIsInNoYWRlclBhc3MiLCJTaGFkZXJQYXNzIiwiZ2V0IiwiZ3JhcGhpY3NEZXZpY2UiLCJzaGFkZXJQYXNzSW5mbyIsImFsbG9jYXRlIiwiaXNGb3J3YXJkIiwiaW5kZXgiLCJnZXRTaGFkZXJQYXNzIiwiX3RoaXMkX2NhbWVyYSRzaGFkZXJQIiwiYXBlcnR1cmUiLCJ2YWx1ZSIsImFzcGVjdFJhdGlvIiwiYXNwZWN0UmF0aW9Nb2RlIiwiY2FsY3VsYXRlUHJvamVjdGlvbiIsImNhbGN1bGF0ZVRyYW5zZm9ybSIsImNhbWVyYSIsImNsZWFyQ29sb3IiLCJjbGVhckNvbG9yQnVmZmVyIiwiZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcyIsImNsZWFyRGVwdGhCdWZmZXIiLCJjbGVhclN0ZW5jaWxCdWZmZXIiLCJjdWxsRmFjZXMiLCJkaXNhYmxlUG9zdEVmZmVjdHNMYXllciIsImxheWVyIiwiZmFyQ2xpcCIsImZsaXBGYWNlcyIsImZvdiIsImZydXN0dW0iLCJmcnVzdHVtQ3VsbGluZyIsImhvcml6b250YWxGb3YiLCJsYXllcnMiLCJuZXdWYWx1ZSIsImkiLCJsZW5ndGgiLCJzY2VuZSIsImdldExheWVyQnlJZCIsInJlbW92ZUNhbWVyYSIsImVuYWJsZWQiLCJhZGRDYW1lcmEiLCJsYXllcnNTZXQiLCJuZWFyQ2xpcCIsIm9ydGhvSGVpZ2h0IiwicG9zdEVmZmVjdHMiLCJwb3N0RWZmZWN0c0VuYWJsZWQiLCJwcmlvcml0eSIsInByb2plY3Rpb24iLCJwcm9qZWN0aW9uTWF0cml4IiwicmVjdCIsImZpcmUiLCJyZW5kZXJTY2VuZUNvbG9yTWFwIiwicmVxdWVzdFNjZW5lQ29sb3JNYXAiLCJyZW5kZXJTY2VuZURlcHRoTWFwIiwicmVxdWVzdFNjZW5lRGVwdGhNYXAiLCJyZW5kZXJUYXJnZXQiLCJzY2lzc29yUmVjdCIsInNlbnNpdGl2aXR5Iiwic2h1dHRlciIsInZpZXdNYXRyaXgiLCJfZW5hYmxlRGVwdGhMYXllciIsImhhc0RlcHRoTGF5ZXIiLCJmaW5kIiwibGF5ZXJJZCIsIkxBWUVSSURfREVQVEgiLCJkZXB0aExheWVyIiwiaW5jcmVtZW50Q291bnRlciIsImRlY3JlbWVudENvdW50ZXIiLCJEZWJ1ZyIsImFzc2VydCIsIm9rIiwid2Fybk9uY2UiLCJsYXllckNvbXAiLCJfZGlydHlDYW1lcmFzIiwic2NyZWVuVG9Xb3JsZCIsInNjcmVlbngiLCJzY3JlZW55IiwiY2FtZXJheiIsIndvcmxkQ29vcmQiLCJkZXZpY2UiLCJ3IiwiY2xpZW50UmVjdCIsIndpZHRoIiwiaCIsImhlaWdodCIsIndvcmxkVG9TY3JlZW4iLCJzY3JlZW5Db29yZCIsIm9uQXBwUHJlcmVuZGVyIiwiX3ZpZXdNYXREaXJ0eSIsIl92aWV3UHJvak1hdERpcnR5IiwiYWRkQ2FtZXJhVG9MYXllcnMiLCJyZW1vdmVDYW1lcmFGcm9tTGF5ZXJzIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvZmYiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsIm9uIiwiaW5kZXhPZiIsImlkIiwib25FbmFibGUiLCJlbmFibGUiLCJvbkRpc2FibGUiLCJkaXNhYmxlIiwib25SZW1vdmUiLCJjYWxjdWxhdGVBc3BlY3RSYXRpbyIsInJ0IiwieiIsImZyYW1lVXBkYXRlIiwiQVNQRUNUX0FVVE8iLCJzdGFydFhyIiwidHlwZSIsInNwYWNlVHlwZSIsIm9wdGlvbnMiLCJ4ciIsInN0YXJ0IiwiZW5kWHIiLCJjYWxsYmFjayIsIkVycm9yIiwiZW5kIiwiY29weSIsInNvdXJjZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQTJEcEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtBQW5FekI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO0FBRXZCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBRWxCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFK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
