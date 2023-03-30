/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_UI, LAYERID_DEPTH, ASPECT_AUTO } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { Component } from '../component.js';
import { PostEffectQueue } from './post-effect-queue.js';
import { Debug } from '../../../core/debug.js';

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
 * var entity = new pc.Entity();
 * entity.addComponent('camera', {
 *     nearClip: 1,
 *     farClip: 100,
 *     fov: 55
 * });
 *
 * // Get the pc.CameraComponent on an entity
 * var cameraComponent = entity.camera;
 *
 * // Update a property on a camera component
 * entity.camera.nearClip = 2;
 * ```
 *
 * @augments Component
 */
class CameraComponent extends Component {
  /**
   * Custom function that is called when postprocessing should execute.
   *
   * @type {Function}
   * @ignore
   */

  /**
   * Custom function that is called before the camera renders the scene.
   *
   * @type {Function}
   */

  /**
   * Custom function that is called after the camera renders the scene.
   *
   * @type {Function}
   */

  /**
   * A counter of requests of depth map rendering.
   *
   * @type {number}
   * @private
   */

  /**
   * A counter of requests of color map rendering.
   *
   * @type {number}
   * @private
   */

  /** @private */

  /** @private */

  /** @private */

  /**
   * Layer id at which the postprocessing stops for the camera.
   *
   * @type {number}
   * @private
   */

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
    this.onPostprocessing = null;
    this.onPreRender = null;
    this.onPostRender = null;
    this._renderSceneDepthMap = 0;
    this._renderSceneColorMap = 0;
    this._sceneDepthMapRequested = false;
    this._sceneColorMapRequested = false;
    this._priority = 0;
    this._disablePostEffectsLayer = LAYERID_UI;
    this._camera = new Camera();
    this._camera.node = entity;

    // postprocessing management
    this._postEffects = new PostEffectQueue(system.app, this);
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
   * var start = entity.camera.screenToWorld(clickX, clickY, entity.camera.nearClip);
   * var end = entity.camera.screenToWorld(clickX, clickY, entity.camera.farClip);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBU1BFQ1RfQVVUTywgTEFZRVJJRF9VSSwgTEFZRVJJRF9ERVBUSCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDYW1lcmEgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jYW1lcmEuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBQb3N0RWZmZWN0UXVldWUgfSBmcm9tICcuL3Bvc3QtZWZmZWN0LXF1ZXVlLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVRyYW5zZm9ybX0gYW5kIHtAbGluayBDYW1lcmFDb21wb25lbnQjY2FsY3VsYXRlUHJvamVjdGlvbn0uXG4gKlxuICogQGNhbGxiYWNrIENhbGN1bGF0ZU1hdHJpeENhbGxiYWNrXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0fSB0cmFuc2Zvcm1NYXRyaXggLSBPdXRwdXQgb2YgdGhlIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtudW1iZXJ9IHZpZXcgLSBUeXBlIG9mIHZpZXcuIENhbiBiZSB7QGxpbmsgVklFV19DRU5URVJ9LCB7QGxpbmsgVklFV19MRUZUfSBvciB7QGxpbmsgVklFV19SSUdIVH0uIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqL1xuXG4vKipcbiAqIFRoZSBDYW1lcmEgQ29tcG9uZW50IGVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciB0aGUgc2NlbmUuIEEgc2NlbmUgcmVxdWlyZXMgYXQgbGVhc3Qgb25lXG4gKiBlbmFibGVkIGNhbWVyYSBjb21wb25lbnQgdG8gYmUgcmVuZGVyZWQuIE5vdGUgdGhhdCBtdWx0aXBsZSBjYW1lcmEgY29tcG9uZW50cyBjYW4gYmUgZW5hYmxlZFxuICogc2ltdWx0YW5lb3VzbHkgKGZvciBzcGxpdC1zY3JlZW4gb3Igb2Zmc2NyZWVuIHJlbmRlcmluZywgZm9yIGV4YW1wbGUpLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIEFkZCBhIHBjLkNhbWVyYUNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAqIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gKiBlbnRpdHkuYWRkQ29tcG9uZW50KCdjYW1lcmEnLCB7XG4gKiAgICAgbmVhckNsaXA6IDEsXG4gKiAgICAgZmFyQ2xpcDogMTAwLFxuICogICAgIGZvdjogNTVcbiAqIH0pO1xuICpcbiAqIC8vIEdldCB0aGUgcGMuQ2FtZXJhQ29tcG9uZW50IG9uIGFuIGVudGl0eVxuICogdmFyIGNhbWVyYUNvbXBvbmVudCA9IGVudGl0eS5jYW1lcmE7XG4gKlxuICogLy8gVXBkYXRlIGEgcHJvcGVydHkgb24gYSBjYW1lcmEgY29tcG9uZW50XG4gKiBlbnRpdHkuY2FtZXJhLm5lYXJDbGlwID0gMjtcbiAqIGBgYFxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgQ2FtZXJhQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBwb3N0cHJvY2Vzc2luZyBzaG91bGQgZXhlY3V0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25Qb3N0cHJvY2Vzc2luZyA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHRoZSBjYW1lcmEgcmVuZGVycyB0aGUgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICovXG4gICAgb25QcmVSZW5kZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBjYW1lcmEgcmVuZGVycyB0aGUgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICovXG4gICAgb25Qb3N0UmVuZGVyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEEgY291bnRlciBvZiByZXF1ZXN0cyBvZiBkZXB0aCBtYXAgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZW5kZXJTY2VuZURlcHRoTWFwID0gMDtcblxuICAgIC8qKlxuICAgICAqIEEgY291bnRlciBvZiByZXF1ZXN0cyBvZiBjb2xvciBtYXAgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZW5kZXJTY2VuZUNvbG9yTWFwID0gMDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9zY2VuZURlcHRoTWFwUmVxdWVzdGVkID0gZmFsc2U7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc2NlbmVDb2xvck1hcFJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3ByaW9yaXR5ID0gMDtcblxuICAgIC8qKlxuICAgICAqIExheWVyIGlkIGF0IHdoaWNoIHRoZSBwb3N0cHJvY2Vzc2luZyBzdG9wcyBmb3IgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIgPSBMQVlFUklEX1VJO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENhbWVyYUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLkNhbWVyYUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXNcbiAgICAgKiBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhID0gbmV3IENhbWVyYSgpO1xuICAgICAgICB0aGlzLl9jYW1lcmEubm9kZSA9IGVudGl0eTtcblxuICAgICAgICAvLyBwb3N0cHJvY2Vzc2luZyBtYW5hZ2VtZW50XG4gICAgICAgIHRoaXMuX3Bvc3RFZmZlY3RzID0gbmV3IFBvc3RFZmZlY3RRdWV1ZShzeXN0ZW0uYXBwLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgY2FtZXJhIGFwZXJ0dXJlIGluIGYtc3RvcHMsIHRoZSBkZWZhdWx0IHZhbHVlIGlzIDE2LjAuIEhpZ2hlciB2YWx1ZSBtZWFucyBsZXNzIGV4cG9zdXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYXBlcnR1cmUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmFwZXJ0dXJlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFwZXJ0dXJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmFwZXJ0dXJlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3BlY3QgcmF0aW8gKHdpZHRoIGRpdmlkZWQgYnkgaGVpZ2h0KSBvZiB0aGUgY2FtZXJhLiBJZiBhc3BlY3RSYXRpb01vZGUgaXNcbiAgICAgKiB7QGxpbmsgQVNQRUNUX0FVVE99LCB0aGVuIHRoaXMgdmFsdWUgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNhbGN1bGF0ZWQgZXZlcnkgZnJhbWUsIGFuZCB5b3VcbiAgICAgKiBjYW4gb25seSByZWFkIGl0LiBJZiBpdCdzIEFTUEVDVF9NQU5VQUwsIHlvdSBjYW4gc2V0IHRoZSB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFzcGVjdFJhdGlvKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5hc3BlY3RSYXRpbyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhc3BlY3RSYXRpbygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5hc3BlY3RSYXRpbztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXNwZWN0IHJhdGlvIG1vZGUgb2YgdGhlIGNhbWVyYS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQVNQRUNUX0FVVE99OiBhc3BlY3QgcmF0aW8gd2lsbCBiZSBjYWxjdWxhdGVkIGZyb20gdGhlIGN1cnJlbnQgcmVuZGVyXG4gICAgICogdGFyZ2V0J3Mgd2lkdGggZGl2aWRlZCBieSBoZWlnaHQuXG4gICAgICogLSB7QGxpbmsgQVNQRUNUX01BTlVBTH06IHVzZSB0aGUgYXNwZWN0UmF0aW8gdmFsdWUuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQVNQRUNUX0FVVE99LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYXNwZWN0UmF0aW9Nb2RlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5hc3BlY3RSYXRpb01vZGUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXNwZWN0UmF0aW9Nb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmFzcGVjdFJhdGlvTW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24geW91IGNhbiBwcm92aWRlIHRvIGNhbGN1bGF0ZSB0aGUgY2FtZXJhIHByb2plY3Rpb24gbWF0cml4IG1hbnVhbGx5LiBDYW4gYmVcbiAgICAgKiB1c2VkIGZvciBjb21wbGV4IGVmZmVjdHMgbGlrZSBkb2luZyBvYmxpcXVlIHByb2plY3Rpb24uIEZ1bmN0aW9uIGlzIGNhbGxlZCB1c2luZyBjb21wb25lbnQnc1xuICAgICAqIHNjb3BlLiBBcmd1bWVudHM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBNYXQ0fSB0cmFuc2Zvcm1NYXRyaXg6IG91dHB1dCBvZiB0aGUgZnVuY3Rpb25cbiAgICAgKiAtIHZpZXc6IFR5cGUgb2Ygdmlldy4gQ2FuIGJlIHtAbGluayBWSUVXX0NFTlRFUn0sIHtAbGluayBWSUVXX0xFRlR9IG9yIHtAbGluayBWSUVXX1JJR0hUfS5cbiAgICAgKlxuICAgICAqIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDYWxjdWxhdGVNYXRyaXhDYWxsYmFja31cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlUHJvamVjdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbiA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVQcm9qZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZ1bmN0aW9uIHlvdSBjYW4gcHJvdmlkZSB0byBjYWxjdWxhdGUgdGhlIGNhbWVyYSB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggbWFudWFsbHkuIENhblxuICAgICAqIGJlIHVzZWQgZm9yIGNvbXBsZXggZWZmZWN0cyBsaWtlIHJlZmxlY3Rpb25zLiBGdW5jdGlvbiBpcyBjYWxsZWQgdXNpbmcgY29tcG9uZW50J3Mgc2NvcGUuXG4gICAgICogQXJndW1lbnRzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgTWF0NH0gdHJhbnNmb3JtTWF0cml4OiBvdXRwdXQgb2YgdGhlIGZ1bmN0aW9uLlxuICAgICAqIC0gdmlldzogVHlwZSBvZiB2aWV3LiBDYW4gYmUge0BsaW5rIFZJRVdfQ0VOVEVSfSwge0BsaW5rIFZJRVdfTEVGVH0gb3Ige0BsaW5rIFZJRVdfUklHSFR9LlxuICAgICAqXG4gICAgICogTGVmdCBhbmQgcmlnaHQgYXJlIG9ubHkgdXNlZCBpbiBzdGVyZW8gcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge0NhbGN1bGF0ZU1hdHJpeENhbGxiYWNrfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVUcmFuc2Zvcm0odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVUcmFuc2Zvcm0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSBjb21wb25lbnQncyB1bmRlcmx5aW5nIENhbWVyYSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDYW1lcmF9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBjYW1lcmEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIHVzZWQgdG8gY2xlYXIgdGhlIGNhbnZhcyB0byBiZWZvcmUgdGhlIGNhbWVyYSBzdGFydHMgdG8gcmVuZGVyLiBEZWZhdWx0cyB0b1xuICAgICAqIFswLjc1LCAwLjc1LCAwLjc1LCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcycpLkNvbG9yfVxuICAgICAqL1xuICAgIHNldCBjbGVhckNvbG9yKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhckNvbG9yID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJDb2xvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgY29sb3IgYnVmZmVyIHRvIHRoZSBjb2xvciBzZXQgaW4gY2xlYXJDb2xvci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckNvbG9yQnVmZmVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhckNvbG9yQnVmZmVyID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBjbGVhckNvbG9yQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmNsZWFyQ29sb3JCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckRlcHRoQnVmZmVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhckRlcHRoQnVmZmVyID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmNsZWFyRGVwdGhCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2xlYXJTdGVuY2lsQnVmZmVyID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBjbGVhclN0ZW5jaWxCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGNhbWVyYSB3aWxsIHRha2UgbWF0ZXJpYWwuY3VsbCBpbnRvIGFjY291bnQuIE90aGVyd2lzZSBib3RoIGZyb250IGFuZCBiYWNrIGZhY2VzXG4gICAgICogd2lsbCBiZSByZW5kZXJlZC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjdWxsRmFjZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmN1bGxGYWNlcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjdWxsRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY3VsbEZhY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExheWVyIElEIG9mIGEgbGF5ZXIgb24gd2hpY2ggdGhlIHBvc3Rwcm9jZXNzaW5nIG9mIHRoZSBjYW1lcmEgc3RvcHMgYmVpbmcgYXBwbGllZCB0by5cbiAgICAgKiBEZWZhdWx0cyB0byBMQVlFUklEX1VJLCB3aGljaCBjYXVzZXMgcG9zdCBwcm9jZXNzaW5nIHRvIG5vdCBiZSBhcHBsaWVkIHRvIFVJIGxheWVyIGFuZCBhbnlcbiAgICAgKiBmb2xsb3dpbmcgbGF5ZXJzIGZvciB0aGUgY2FtZXJhLiBTZXQgdG8gdW5kZWZpbmVkIGZvciBwb3N0LXByb2Nlc3NpbmcgdG8gYmUgYXBwbGllZCB0byBhbGxcbiAgICAgKiBsYXllcnMgb2YgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRpc2FibGVQb3N0RWZmZWN0c0xheWVyKGxheWVyKSB7XG4gICAgICAgIHRoaXMuX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBkaXNhYmxlUG9zdEVmZmVjdHNMYXllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgYWZ0ZXIgd2hpY2ggbm8gcmVuZGVyaW5nIHdpbGwgdGFrZSBwbGFjZS4gRGVmYXVsdHMgdG8gMTAwMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZhckNsaXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmZhckNsaXAgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZmFyQ2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5mYXJDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGNhbWVyYSB3aWxsIGludmVydCBmcm9udCBhbmQgYmFjayBmYWNlcy4gQ2FuIGJlIHVzZWZ1bCBmb3IgcmVmbGVjdGlvbiByZW5kZXJpbmcuXG4gICAgICogRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZmxpcEZhY2VzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5mbGlwRmFjZXMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcEZhY2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmZsaXBGYWNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmllbGQgb2YgdmlldyBvZiB0aGUgY2FtZXJhIGluIGRlZ3JlZXMuIFVzdWFsbHkgdGhpcyBpcyB0aGUgWS1heGlzIGZpZWxkIG9mIHZpZXcsIHNlZVxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnQjaG9yaXpvbnRhbEZvdn0uIFVzZWQgZm9yIHtAbGluayBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFfSBjYW1lcmFzIG9ubHkuXG4gICAgICogRGVmYXVsdHMgdG8gNDUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmb3YodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmZvdiA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmb3YoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuZm92O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSdzIGZydXN0dW0gc2hhcGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2ZydXN0dW0uanMnKS5GcnVzdHVtfVxuICAgICAqL1xuICAgIGdldCBmcnVzdHVtKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmZydXN0dW07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgdGhlIGN1bGxpbmcgb2YgbWVzaCBpbnN0YW5jZXMgYWdhaW5zdCB0aGUgY2FtZXJhIGZydXN0dW0sIGkuZS4gaWYgb2JqZWN0cyBvdXRzaWRlXG4gICAgICogb2YgY2FtZXJhIHNob3VsZCBiZSBvbWl0dGVkIGZyb20gcmVuZGVyaW5nLiBJZiBmYWxzZSwgYWxsIG1lc2ggaW5zdGFuY2VzIGluIHRoZSBzY2VuZSBhcmVcbiAgICAgKiByZW5kZXJlZCBieSB0aGUgY2FtZXJhLCByZWdhcmRsZXNzIG9mIHZpc2liaWxpdHkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZydXN0dW1DdWxsaW5nKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5mcnVzdHVtQ3VsbGluZyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmcnVzdHVtQ3VsbGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5mcnVzdHVtQ3VsbGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgd2hpY2ggYXhpcyB0byB1c2UgZm9yIHRoZSBGaWVsZCBvZiBWaWV3IGNhbGN1bGF0aW9uLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBob3Jpem9udGFsRm92KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5ob3Jpem9udGFsRm92ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGhvcml6b250YWxGb3YoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuaG9yaXpvbnRhbEZvdjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgY2FtZXJhIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gsXG4gICAgICogcG9wLCBzcGxpY2Ugb3IgbW9kaWZ5IHRoaXMgYXJyYXksIGlmIHlvdSB3YW50IHRvIGNoYW5nZSBpdCwgc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLiBEZWZhdWx0c1xuICAgICAqIHRvIFtMQVlFUklEX1dPUkxELCBMQVlFUklEX0RFUFRILCBMQVlFUklEX1NLWUJPWCwgTEFZRVJJRF9VSSwgTEFZRVJJRF9JTU1FRElBVEVdLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnMobmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5fY2FtZXJhLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhLmxheWVycyA9IG5ld1ZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChuZXdWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZENhbWVyYSh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEubGF5ZXJzO1xuICAgIH1cblxuICAgIGdldCBsYXllcnNTZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEubGF5ZXJzU2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgYmVmb3JlIHdoaWNoIG5vIHJlbmRlcmluZyB3aWxsIHRha2UgcGxhY2UuIERlZmF1bHRzIHRvIDAuMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG5lYXJDbGlwKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5uZWFyQ2xpcCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBuZWFyQ2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5uZWFyQ2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGFsZi1oZWlnaHQgb2YgdGhlIG9ydGhvZ3JhcGhpYyB2aWV3IHdpbmRvdyAoaW4gdGhlIFktYXhpcykuIFVzZWQgZm9yXG4gICAgICoge0BsaW5rIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDfSBjYW1lcmFzIG9ubHkuIERlZmF1bHRzIHRvIDEwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgb3J0aG9IZWlnaHQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLm9ydGhvSGVpZ2h0ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG9ydGhvSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLm9ydGhvSGVpZ2h0O1xuICAgIH1cblxuICAgIGdldCBwb3N0RWZmZWN0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc3RFZmZlY3RzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwb3N0IGVmZmVjdHMgcXVldWUgZm9yIHRoaXMgY2FtZXJhLiBVc2UgdGhpcyB0byBhZGQgb3IgcmVtb3ZlIHBvc3QgZWZmZWN0cyBmcm9tIHRoZSBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UG9zdEVmZmVjdFF1ZXVlfVxuICAgICAqL1xuICAgIGdldCBwb3N0RWZmZWN0c0VuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wb3N0RWZmZWN0cy5lbmFibGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHRoZSBvcmRlciBpbiB3aGljaCBjYW1lcmFzIGFyZSByZW5kZXJlZC4gQ2FtZXJhcyB3aXRoIHNtYWxsZXIgdmFsdWVzIGZvciBwcmlvcml0eVxuICAgICAqIGFyZSByZW5kZXJlZCBmaXJzdC4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHByaW9yaXR5KG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gbmV3VmFsdWU7XG4gICAgICAgIHRoaXMuZGlydHlMYXllckNvbXBvc2l0aW9uQ2FtZXJhcygpO1xuICAgIH1cblxuICAgIGdldCBwcmlvcml0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByaW9yaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHByb2plY3Rpb24gdXNlZCB0byByZW5kZXIgdGhlIGNhbWVyYS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUFJPSkVDVElPTl9QRVJTUEVDVElWRX06IEEgcGVyc3BlY3RpdmUgcHJvamVjdGlvbi4gVGhlIGNhbWVyYSBmcnVzdHVtXG4gICAgICogcmVzZW1ibGVzIGEgdHJ1bmNhdGVkIHB5cmFtaWQuXG4gICAgICogLSB7QGxpbmsgUFJPSkVDVElPTl9PUlRIT0dSQVBISUN9OiBBbiBvcnRob2dyYXBoaWMgcHJvamVjdGlvbi4gVGhlIGNhbWVyYVxuICAgICAqIGZydXN0dW0gaXMgYSBjdWJvaWQuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUFJPSkVDVElPTl9QRVJTUEVDVElWRX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBwcm9qZWN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5wcm9qZWN0aW9uID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHByb2plY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEucHJvamVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJykuTWF0NH1cbiAgICAgKi9cbiAgICBnZXQgcHJvamVjdGlvbk1hdHJpeCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHdoZXJlIG9uIHRoZSBzY3JlZW4gdGhlIGNhbWVyYSB3aWxsIGJlIHJlbmRlcmVkIGluIG5vcm1hbGl6ZWQgc2NyZWVuIGNvb3JkaW5hdGVzLlxuICAgICAqIERlZmF1bHRzIHRvIFswLCAwLCAxLCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH1cbiAgICAgKi9cbiAgICBzZXQgcmVjdCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEucmVjdCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpyZWN0JywgdGhpcy5fY2FtZXJhLnJlY3QpO1xuICAgIH1cblxuICAgIGdldCByZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnJlY3Q7XG4gICAgfVxuXG4gICAgc2V0IHJlbmRlclNjZW5lQ29sb3JNYXAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICYmICF0aGlzLl9zY2VuZUNvbG9yTWFwUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RTY2VuZUNvbG9yTWFwKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5fc2NlbmVDb2xvck1hcFJlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fc2NlbmVDb2xvck1hcFJlcXVlc3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U2NlbmVDb2xvck1hcChmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl9zY2VuZUNvbG9yTWFwUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU2NlbmVDb2xvck1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclNjZW5lQ29sb3JNYXAgPiAwO1xuICAgIH1cblxuICAgIHNldCByZW5kZXJTY2VuZURlcHRoTWFwKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U2NlbmVEZXB0aE1hcCh0cnVlKTtcbiAgICAgICAgICAgIHRoaXMuX3NjZW5lRGVwdGhNYXBSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3NjZW5lRGVwdGhNYXBSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdFNjZW5lRGVwdGhNYXAoZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclNjZW5lRGVwdGhNYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwID4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgdGFyZ2V0IHRvIHdoaWNoIHJlbmRlcmluZyBvZiB0aGUgY2FtZXJhcyBpcyBwZXJmb3JtZWQuIElmIG5vdCBzZXQsIGl0IHdpbGwgcmVuZGVyXG4gICAgICogc2ltcGx5IHRvIHRoZSBzY3JlZW4uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fVxuICAgICAqL1xuICAgIHNldCByZW5kZXJUYXJnZXQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnJlbmRlclRhcmdldCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGlwcyBhbGwgcGl4ZWxzIHdoaWNoIGFyZSBub3QgaW4gdGhlIHJlY3RhbmdsZS4gVGhlIG9yZGVyIG9mIHRoZSB2YWx1ZXMgaXNcbiAgICAgKiBbeCwgeSwgd2lkdGgsIGhlaWdodF0uIERlZmF1bHRzIHRvIFswLCAwLCAxLCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH1cbiAgICAgKi9cbiAgICBzZXQgc2Npc3NvclJlY3QodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnNjaXNzb3JSZWN0ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNjaXNzb3JSZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNjaXNzb3JSZWN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBjYW1lcmEgc2Vuc2l0aXZpdHkgaW4gSVNPLCB0aGUgZGVmYXVsdCB2YWx1ZSBpcyAxMDAwLiBIaWdoZXIgdmFsdWUgbWVhbnMgbW9yZSBleHBvc3VyZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNlbnNpdGl2aXR5KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5zZW5zaXRpdml0eSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzZW5zaXRpdml0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5zZW5zaXRpdml0eTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgY2FtZXJhIHNodXR0ZXIgc3BlZWQgaW4gc2Vjb25kcywgdGhlIGRlZmF1bHQgdmFsdWUgaXMgMS8xMDAwcy4gTG9uZ2VyIHNodXR0ZXIgbWVhbnMgbW9yZSBleHBvc3VyZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNodXR0ZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnNodXR0ZXIgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc2h1dHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5zaHV0dGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSdzIHZpZXcgbWF0cml4LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0fVxuICAgICAqL1xuICAgIGdldCB2aWV3TWF0cml4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnZpZXdNYXRyaXg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmFzZWQgb24gdGhlIHZhbHVlLCB0aGUgZGVwdGggbGF5ZXIncyBlbmFibGUgY291bnRlciBpcyBpbmNyZW1lbnRlZCBvciBkZWNyZW1lbnRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdmFsdWUgLSBUcnVlIHRvIGluY3JlbWVudCB0aGUgY291bnRlciwgZmFsc2UgdG8gZGVjcmVtZW50IGl0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjb3VudGVyIHdhcyBpbmNyZW1lbnRlZCBvciBkZWNyZW1lbnRlZCwgZmFsc2UgaWYgdGhlIGRlcHRoXG4gICAgICogbGF5ZXIgaXMgbm90IHByZXNlbnQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZW5hYmxlRGVwdGhMYXllcih2YWx1ZSkge1xuICAgICAgICBjb25zdCBoYXNEZXB0aExheWVyID0gdGhpcy5sYXllcnMuZmluZChsYXllcklkID0+IGxheWVySWQgPT09IExBWUVSSURfREVQVEgpO1xuICAgICAgICBpZiAoaGFzRGVwdGhMYXllcikge1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbGF5ZXIuanMnKS5MYXllcn0gKi9cbiAgICAgICAgICAgIGNvbnN0IGRlcHRoTGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0RFUFRIKTtcblxuICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZGVwdGhMYXllcj8uaW5jcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXB0aExheWVyPy5kZWNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3QgdGhlIHNjZW5lIHRvIGdlbmVyYXRlIGEgdGV4dHVyZSBjb250YWluaW5nIHRoZSBzY2VuZSBjb2xvciBtYXAuIE5vdGUgdGhhdCB0aGlzIGNhbGxcbiAgICAgKiBpcyBhY2N1bXVsYXRpdmUsIGFuZCBmb3IgZWFjaCBlbmFibGUgcmVxdWVzdCwgYSBkaXNhYmxlIHJlcXVlc3QgbmVlZCB0byBiZSBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIHRvIHJlcXVlc3QgdGhlIGdlbmVyYXRpb24sIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgcmVxdWVzdFNjZW5lQ29sb3JNYXAoZW5hYmxlZCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTY2VuZUNvbG9yTWFwICs9IGVuYWJsZWQgPyAxIDogLTE7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9yZW5kZXJTY2VuZUNvbG9yTWFwID49IDApO1xuICAgICAgICBjb25zdCBvayA9IHRoaXMuX2VuYWJsZURlcHRoTGF5ZXIoZW5hYmxlZCk7XG4gICAgICAgIGlmICghb2spIHtcbiAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lQ29sb3JNYXAgd2FzIGNhbGxlZCwgYnV0IHRoZSBjYW1lcmEgZG9lcyBub3QgaGF2ZSBhIERlcHRoIGxheWVyLCBpZ25vcmluZy4nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3QgdGhlIHNjZW5lIHRvIGdlbmVyYXRlIGEgdGV4dHVyZSBjb250YWluaW5nIHRoZSBzY2VuZSBkZXB0aCBtYXAuIE5vdGUgdGhhdCB0aGlzIGNhbGxcbiAgICAgKiBpcyBhY2N1bXVsYXRpdmUsIGFuZCBmb3IgZWFjaCBlbmFibGUgcmVxdWVzdCwgYSBkaXNhYmxlIHJlcXVlc3QgbmVlZCB0byBiZSBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIHRvIHJlcXVlc3QgdGhlIGdlbmVyYXRpb24sIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgcmVxdWVzdFNjZW5lRGVwdGhNYXAoZW5hYmxlZCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwICs9IGVuYWJsZWQgPyAxIDogLTE7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9yZW5kZXJTY2VuZURlcHRoTWFwID49IDApO1xuICAgICAgICBjb25zdCBvayA9IHRoaXMuX2VuYWJsZURlcHRoTGF5ZXIoZW5hYmxlZCk7XG4gICAgICAgIGlmICghb2spIHtcbiAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lRGVwdGhNYXAgd2FzIGNhbGxlZCwgYnV0IHRoZSBjYW1lcmEgZG9lcyBub3QgaGF2ZSBhIERlcHRoIGxheWVyLCBpZ25vcmluZy4nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKSB7XG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uIG5lZWRzIHRvIHVwZGF0ZSBvcmRlclxuICAgICAgICBjb25zdCBsYXllckNvbXAgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBsYXllckNvbXAuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gMkQgc2NyZWVuIHNwYWNlIHRvIDNEIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjcmVlbnggLSBYIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2VcbiAgICAgKiAwIHRvIGBjYW52YXMub2Zmc2V0V2lkdGhgIG9mIHRoZSBhcHBsaWNhdGlvbidzIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY3JlZW55IC0gWSBjb29yZGluYXRlIG9uIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LiBTaG91bGQgYmUgaW4gdGhlIHJhbmdlXG4gICAgICogMCB0byBgY2FudmFzLm9mZnNldEhlaWdodGAgb2YgdGhlIGFwcGxpY2F0aW9uJ3MgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNhbWVyYXogLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgY2FtZXJhIGluIHdvcmxkIHNwYWNlIHRvIGNyZWF0ZSB0aGUgbmV3XG4gICAgICogcG9pbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gW3dvcmxkQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmUgd29ybGRcbiAgICAgKiBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCB0aGUgc3RhcnQgYW5kIGVuZCBwb2ludHMgb2YgYSAzRCByYXkgZmlyZWQgZnJvbSBhIHNjcmVlbiBjbGljayBwb3NpdGlvblxuICAgICAqIHZhciBzdGFydCA9IGVudGl0eS5jYW1lcmEuc2NyZWVuVG9Xb3JsZChjbGlja1gsIGNsaWNrWSwgZW50aXR5LmNhbWVyYS5uZWFyQ2xpcCk7XG4gICAgICogdmFyIGVuZCA9IGVudGl0eS5jYW1lcmEuc2NyZWVuVG9Xb3JsZChjbGlja1gsIGNsaWNrWSwgZW50aXR5LmNhbWVyYS5mYXJDbGlwKTtcbiAgICAgKlxuICAgICAqIC8vIFVzZSB0aGUgcmF5IGNvb3JkaW5hdGVzIHRvIHBlcmZvcm0gYSByYXljYXN0XG4gICAgICogYXBwLnN5c3RlbXMucmlnaWRib2R5LnJheWNhc3RGaXJzdChzdGFydCwgZW5kLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiRW50aXR5IFwiICsgcmVzdWx0LmVudGl0eS5uYW1lICsgXCIgd2FzIHNlbGVjdGVkXCIpO1xuICAgICAqIH0pO1xuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gVGhlIHdvcmxkIHNwYWNlIGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgc2NyZWVuVG9Xb3JsZChzY3JlZW54LCBzY3JlZW55LCBjYW1lcmF6LCB3b3JsZENvb3JkKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdyA9IGRldmljZS5jbGllbnRSZWN0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gZGV2aWNlLmNsaWVudFJlY3QuaGVpZ2h0O1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNjcmVlblRvV29ybGQoc2NyZWVueCwgc2NyZWVueSwgY2FtZXJheiwgdywgaCwgd29ybGRDb29yZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gM0Qgd29ybGQgc3BhY2UgdG8gMkQgc2NyZWVuIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gd29ybGRDb29yZCAtIFRoZSB3b3JsZCBzcGFjZSBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IFtzY3JlZW5Db29yZF0gLSAzRCB2ZWN0b3IgdG8gcmVjZWl2ZVxuICAgICAqIHNjcmVlbiBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IFRoZSBzY3JlZW4gc3BhY2UgY29vcmRpbmF0ZS5cbiAgICAgKi9cbiAgICB3b3JsZFRvU2NyZWVuKHdvcmxkQ29vcmQsIHNjcmVlbkNvb3JkKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdyA9IGRldmljZS5jbGllbnRSZWN0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gZGV2aWNlLmNsaWVudFJlY3QuaGVpZ2h0O1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLndvcmxkVG9TY3JlZW4od29ybGRDb29yZCwgdywgaCwgc2NyZWVuQ29vcmQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBiZWZvcmUgYXBwbGljYXRpb24gcmVuZGVycyB0aGUgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25BcHBQcmVyZW5kZXIoKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5fdmlld01hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLl92aWV3UHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBhZGRDYW1lcmFUb0xheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRDYW1lcmEodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICByZW1vdmVDYW1lcmFGcm9tTGF5ZXJzKCkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZUNhbWVyYSh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG9sZENvbXAgLSBPbGQgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbmV3Q29tcCAtIE5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkQ2FtZXJhVG9MYXllcnMoKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9sYXllci5qcycpLkxheWVyfSBsYXllciAtIFRoZSBsYXllciB0byBhZGQgdGhlIGNhbWVyYSB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLmFkZENhbWVyYSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdG8gcmVtb3ZlIHRoZSBjYW1lcmEgZnJvbS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLnN5c3RlbTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBzeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICBjb25zdCBsYXllcnMgPSBzY2VuZS5sYXllcnM7XG5cbiAgICAgICAgc3lzdGVtLmFkZENhbWVyYSh0aGlzKTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKGxheWVycykge1xuICAgICAgICAgICAgbGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBsYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmFkZENhbWVyYVRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3RFZmZlY3RzLmVuYWJsZSgpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3Qgc3lzdGVtID0gdGhpcy5zeXN0ZW07XG4gICAgICAgIGNvbnN0IHNjZW5lID0gc3lzdGVtLmFwcC5zY2VuZTtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gc2NlbmUubGF5ZXJzO1xuXG4gICAgICAgIHRoaXMucG9zdEVmZmVjdHMuZGlzYWJsZSgpO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlQ2FtZXJhRnJvbUxheWVycygpO1xuXG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKGxheWVycykge1xuICAgICAgICAgICAgbGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgbGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBzeXN0ZW0ucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLm9uRGlzYWJsZSgpO1xuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZXMgYXNwZWN0IHJhdGlvIHZhbHVlIGZvciBhIGdpdmVuIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gW3J0XSAtIE9wdGlvbmFsXG4gICAgICogcmVuZGVyIHRhcmdldC4gSWYgdW5zcGVjaWZpZWQsIHRoZSBiYWNrYnVmZmVyIGlzIHVzZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgcmVuZGVyIHRhcmdldCAob3IgYmFja2J1ZmZlcikuXG4gICAgICovXG4gICAgY2FsY3VsYXRlQXNwZWN0UmF0aW8ocnQpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBjb25zdCB3aWR0aCA9IHJ0ID8gcnQud2lkdGggOiBkZXZpY2Uud2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHJ0ID8gcnQuaGVpZ2h0IDogZGV2aWNlLmhlaWdodDtcbiAgICAgICAgcmV0dXJuICh3aWR0aCAqIHRoaXMucmVjdC56KSAvIChoZWlnaHQgKiB0aGlzLnJlY3Qudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJlcGFyZSB0aGUgY2FtZXJhIGZvciBmcmFtZSByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gcnQgLSBSZW5kZXJcbiAgICAgKiB0YXJnZXQgdG8gd2hpY2ggcmVuZGVyaW5nIHdpbGwgYmUgcGVyZm9ybWVkLiBXaWxsIGFmZmVjdCBjYW1lcmEncyBhc3BlY3QgcmF0aW8sIGlmXG4gICAgICogYXNwZWN0UmF0aW9Nb2RlIGlzIHtAbGluayBBU1BFQ1RfQVVUT30uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGZyYW1lVXBkYXRlKHJ0KSB7XG4gICAgICAgIGlmICh0aGlzLmFzcGVjdFJhdGlvTW9kZSA9PT0gQVNQRUNUX0FVVE8pIHtcbiAgICAgICAgICAgIHRoaXMuYXNwZWN0UmF0aW8gPSB0aGlzLmNhbGN1bGF0ZUFzcGVjdFJhdGlvKHJ0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gc3RhcnQgWFIgc2Vzc2lvbiB3aXRoIHRoaXMgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgdHlwZSBvZiBzZXNzaW9uLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRZUEVfSU5MSU5FfTogSW5saW5lIC0gYWx3YXlzIGF2YWlsYWJsZSB0eXBlIG9mIHNlc3Npb24uIEl0IGhhcyBsaW1pdGVkIGZlYXR1cmVcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIHRoZSBWUiBkZXZpY2VcbiAgICAgKiB3aXRoIHRoZSBiZXN0IGF2YWlsYWJsZSB0cmFja2luZyBmZWF0dXJlcy5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfQVJ9OiBJbW1lcnNpdmUgQVIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byB0aGUgVlIvQVJcbiAgICAgKiBkZXZpY2UgdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggdGhlIHJlYWwtd29ybGQgZW52aXJvbm1lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3BhY2VUeXBlIC0gUmVmZXJlbmNlIHNwYWNlIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVklFV0VSfTogVmlld2VyIC0gYWx3YXlzIHN1cHBvcnRlZCBzcGFjZSB3aXRoIHNvbWUgYmFzaWMgdHJhY2tpbmdcbiAgICAgKiBjYXBhYmlsaXRpZXMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTH06IExvY2FsIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luIG5lYXIgdGhlXG4gICAgICogdmlld2VyIGF0IHRoZSB0aW1lIG9mIGNyZWF0aW9uLiBJdCBpcyBtZWFudCBmb3Igc2VhdGVkIG9yIGJhc2ljIGxvY2FsIFhSIHNlc3Npb25zLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUxGTE9PUn06IExvY2FsIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luXG4gICAgICogYXQgdGhlIGZsb29yIGluIGEgc2FmZSBwb3NpdGlvbiBmb3IgdGhlIHVzZXIgdG8gc3RhbmQuIFRoZSB5LWF4aXMgZXF1YWxzIDAgYXQgZmxvb3IgbGV2ZWwuXG4gICAgICogRmxvb3IgbGV2ZWwgdmFsdWUgbWlnaHQgYmUgZXN0aW1hdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIHBsYXRmb3JtLiBJdCBpcyBtZWFudCBmb3Igc2VhdGVkIG9yXG4gICAgICogYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9CT1VOREVERkxPT1J9OiBCb3VuZGVkIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggaXRzIG5hdGl2ZVxuICAgICAqIG9yaWdpbiBhdCB0aGUgZmxvb3IsIHdoZXJlIHRoZSB1c2VyIGlzIGV4cGVjdGVkIHRvIG1vdmUgd2l0aGluIGEgcHJlLWVzdGFibGlzaGVkIGJvdW5kYXJ5LlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVU5CT1VOREVEfTogVW5ib3VuZGVkIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdoZXJlIHRoZSB1c2VyIGlzXG4gICAgICogZXhwZWN0ZWQgdG8gbW92ZSBmcmVlbHkgYXJvdW5kIHRoZWlyIGVudmlyb25tZW50LCBwb3RlbnRpYWxseSBsb25nIGRpc3RhbmNlcyBmcm9tIHRoZWlyXG4gICAgICogc3RhcnRpbmcgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IHdpdGggb3B0aW9ucyBmb3IgWFIgc2Vzc2lvbiBpbml0aWFsaXphdGlvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzXSAtIE9wdGlvbmFsIGZlYXR1cmVzIGZvciBYUlNlc3Npb24gc3RhcnQuIEl0IGlzXG4gICAgICogdXNlZCBmb3IgZ2V0dGluZyBhY2Nlc3MgdG8gYWRkaXRpb25hbCBXZWJYUiBzcGVjIGV4dGVuc2lvbnMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5pbWFnZVRyYWNraW5nXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlIHtAbGluayBYckltYWdlVHJhY2tpbmd9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucGxhbmVEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyUGxhbmVEZXRlY3Rpb259LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi94ci94ci1tYW5hZ2VyLmpzJykuWHJFcnJvckNhbGxiYWNrfSBbb3B0aW9ucy5jYWxsYmFja10gLSBPcHRpb25hbFxuICAgICAqIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHRoZSBzZXNzaW9uIGlzIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC1cbiAgICAgKiBpdCBpcyBudWxsIGlmIHRoZSBYUiBzZXNzaW9uIHN0YXJ0ZWQgc3VjY2Vzc2Z1bGx5LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5kZXB0aFNlbnNpbmddIC0gT3B0aW9uYWwgb2JqZWN0IHdpdGggZGVwdGggc2Vuc2luZyBwYXJhbWV0ZXJzIHRvXG4gICAgICogYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyRGVwdGhTZW5zaW5nfS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZV0gLSBPcHRpb25hbCB1c2FnZSBwcmVmZXJlbmNlIGZvciBkZXB0aFxuICAgICAqIHNlbnNpbmcsIGNhbiBiZSAnY3B1LW9wdGltaXplZCcgb3IgJ2dwdS1vcHRpbWl6ZWQnIChYUkRFUFRIU0VOU0lOR1VTQUdFXyopLCBkZWZhdWx0cyB0b1xuICAgICAqICdjcHUtb3B0aW1pemVkJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZyBkZXB0aCBzZW5zaW5nXG4gICAgICogc3lzdGVtLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2VdIC0gT3B0aW9uYWwgZGF0YSBmb3JtYXRcbiAgICAgKiBwcmVmZXJlbmNlIGZvciBkZXB0aCBzZW5zaW5nLiBDYW4gYmUgJ2x1bWluYW5jZS1hbHBoYScgb3IgJ2Zsb2F0MzInIChYUkRFUFRIU0VOU0lOR0ZPUk1BVF8qKSxcbiAgICAgKiBkZWZhdWx0cyB0byAnbHVtaW5hbmNlLWFscGhhJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZ1xuICAgICAqIGRlcHRoIHNlbnNpbmcgc3lzdGVtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gT24gYW4gZW50aXR5IHdpdGggYSBjYW1lcmEgY29tcG9uZW50XG4gICAgICogdGhpcy5lbnRpdHkuY2FtZXJhLnN0YXJ0WHIocGMuWFJUWVBFX1ZSLCBwYy5YUlNQQUNFX0xPQ0FMLCB7XG4gICAgICogICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICogICAgICAgICBpZiAoZXJyKSB7XG4gICAgICogICAgICAgICAgICAgLy8gZmFpbGVkIHRvIHN0YXJ0IFhSIHNlc3Npb25cbiAgICAgKiAgICAgICAgIH0gZWxzZSB7XG4gICAgICogICAgICAgICAgICAgLy8gaW4gWFJcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0WHIodHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC54ci5zdGFydCh0aGlzLCB0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gZW5kIFhSIHNlc3Npb24gb2YgdGhpcyBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4veHIveHItbWFuYWdlci5qcycpLlhyRXJyb3JDYWxsYmFja30gW2NhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrXG4gICAgICogZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvbiBpcyBlbmRlZC4gVGhlIGNhbGxiYWNrIGhhcyBvbmUgYXJndW1lbnQgRXJyb3IgLSBpdCBpcyBudWxsIGlmXG4gICAgICogc3VjY2Vzc2Z1bGx5IGVuZGVkIFhSIHNlc3Npb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBPbiBhbiBlbnRpdHkgd2l0aCBhIGNhbWVyYSBjb21wb25lbnRcbiAgICAgKiB0aGlzLmVudGl0eS5jYW1lcmEuZW5kWHIoZnVuY3Rpb24gKGVycikge1xuICAgICAqICAgICAvLyBub3QgYW55bW9yZSBpbiBYUlxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGVuZFhyKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fY2FtZXJhLnhyKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG5ldyBFcnJvcignQ2FtZXJhIGlzIG5vdCBpbiBYUicpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbWVyYS54ci5lbmQoY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHRvIGNvcHkgcHJvcGVydGllcyBmcm9tIHRoZSBzb3VyY2UgQ2FtZXJhQ29tcG9uZW50LlxuICAgICAqIFByb3BlcnRpZXMgbm90IGNvcGllZDogcG9zdEVmZmVjdHMuXG4gICAgICogSW5oZXJpdGVkIHByb3BlcnRpZXMgbm90IGNvcGllZCAoYWxsKTogc3lzdGVtLCBlbnRpdHksIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gc291cmNlIC0gVGhlIHNvdXJjZSBjb21wb25lbnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNvcHkoc291cmNlKSB7XG4gICAgICAgIHRoaXMuYXBlcnR1cmUgPSBzb3VyY2UuYXBlcnR1cmU7XG4gICAgICAgIHRoaXMuYXNwZWN0UmF0aW8gPSBzb3VyY2UuYXNwZWN0UmF0aW87XG4gICAgICAgIHRoaXMuYXNwZWN0UmF0aW9Nb2RlID0gc291cmNlLmFzcGVjdFJhdGlvTW9kZTtcbiAgICAgICAgdGhpcy5jYWxjdWxhdGVQcm9qZWN0aW9uID0gc291cmNlLmNhbGN1bGF0ZVByb2plY3Rpb247XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlVHJhbnNmb3JtID0gc291cmNlLmNhbGN1bGF0ZVRyYW5zZm9ybTtcbiAgICAgICAgdGhpcy5jbGVhckNvbG9yID0gc291cmNlLmNsZWFyQ29sb3I7XG4gICAgICAgIHRoaXMuY2xlYXJDb2xvckJ1ZmZlciA9IHNvdXJjZS5jbGVhckNvbG9yQnVmZmVyO1xuICAgICAgICB0aGlzLmNsZWFyRGVwdGhCdWZmZXIgPSBzb3VyY2UuY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWxCdWZmZXIgPSBzb3VyY2UuY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgICAgICB0aGlzLmN1bGxGYWNlcyA9IHNvdXJjZS5jdWxsRmFjZXM7XG4gICAgICAgIHRoaXMuZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIgPSBzb3VyY2UuZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXI7XG4gICAgICAgIHRoaXMuZmFyQ2xpcCA9IHNvdXJjZS5mYXJDbGlwO1xuICAgICAgICB0aGlzLmZsaXBGYWNlcyA9IHNvdXJjZS5mbGlwRmFjZXM7XG4gICAgICAgIHRoaXMuZm92ID0gc291cmNlLmZvdjtcbiAgICAgICAgdGhpcy5mcnVzdHVtQ3VsbGluZyA9IHNvdXJjZS5mcnVzdHVtQ3VsbGluZztcbiAgICAgICAgdGhpcy5ob3Jpem9udGFsRm92ID0gc291cmNlLmhvcml6b250YWxGb3Y7XG4gICAgICAgIHRoaXMubGF5ZXJzID0gc291cmNlLmxheWVycztcbiAgICAgICAgdGhpcy5uZWFyQ2xpcCA9IHNvdXJjZS5uZWFyQ2xpcDtcbiAgICAgICAgdGhpcy5vcnRob0hlaWdodCA9IHNvdXJjZS5vcnRob0hlaWdodDtcbiAgICAgICAgdGhpcy5wcmlvcml0eSA9IHNvdXJjZS5wcmlvcml0eTtcbiAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gc291cmNlLnByb2plY3Rpb247XG4gICAgICAgIHRoaXMucmVjdCA9IHNvdXJjZS5yZWN0O1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHNvdXJjZS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIHRoaXMuc2Npc3NvclJlY3QgPSBzb3VyY2Uuc2Npc3NvclJlY3Q7XG4gICAgICAgIHRoaXMuc2Vuc2l0aXZpdHkgPSBzb3VyY2Uuc2Vuc2l0aXZpdHk7XG4gICAgICAgIHRoaXMuc2h1dHRlciA9IHNvdXJjZS5zaHV0dGVyO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQ2FtZXJhQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiQ2FtZXJhQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJvblBvc3Rwcm9jZXNzaW5nIiwib25QcmVSZW5kZXIiLCJvblBvc3RSZW5kZXIiLCJfcmVuZGVyU2NlbmVEZXB0aE1hcCIsIl9yZW5kZXJTY2VuZUNvbG9yTWFwIiwiX3NjZW5lRGVwdGhNYXBSZXF1ZXN0ZWQiLCJfc2NlbmVDb2xvck1hcFJlcXVlc3RlZCIsIl9wcmlvcml0eSIsIl9kaXNhYmxlUG9zdEVmZmVjdHNMYXllciIsIkxBWUVSSURfVUkiLCJfY2FtZXJhIiwiQ2FtZXJhIiwibm9kZSIsIl9wb3N0RWZmZWN0cyIsIlBvc3RFZmZlY3RRdWV1ZSIsImFwcCIsImFwZXJ0dXJlIiwidmFsdWUiLCJhc3BlY3RSYXRpbyIsImFzcGVjdFJhdGlvTW9kZSIsImNhbGN1bGF0ZVByb2plY3Rpb24iLCJjYWxjdWxhdGVUcmFuc2Zvcm0iLCJjYW1lcmEiLCJjbGVhckNvbG9yIiwiY2xlYXJDb2xvckJ1ZmZlciIsImRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwiY3VsbEZhY2VzIiwiZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIiLCJsYXllciIsImZhckNsaXAiLCJmbGlwRmFjZXMiLCJmb3YiLCJmcnVzdHVtIiwiZnJ1c3R1bUN1bGxpbmciLCJob3Jpem9udGFsRm92IiwibGF5ZXJzIiwibmV3VmFsdWUiLCJpIiwibGVuZ3RoIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJyZW1vdmVDYW1lcmEiLCJlbmFibGVkIiwiYWRkQ2FtZXJhIiwibGF5ZXJzU2V0IiwibmVhckNsaXAiLCJvcnRob0hlaWdodCIsInBvc3RFZmZlY3RzIiwicG9zdEVmZmVjdHNFbmFibGVkIiwicHJpb3JpdHkiLCJwcm9qZWN0aW9uIiwicHJvamVjdGlvbk1hdHJpeCIsInJlY3QiLCJmaXJlIiwicmVuZGVyU2NlbmVDb2xvck1hcCIsInJlcXVlc3RTY2VuZUNvbG9yTWFwIiwicmVuZGVyU2NlbmVEZXB0aE1hcCIsInJlcXVlc3RTY2VuZURlcHRoTWFwIiwicmVuZGVyVGFyZ2V0Iiwic2Npc3NvclJlY3QiLCJzZW5zaXRpdml0eSIsInNodXR0ZXIiLCJ2aWV3TWF0cml4IiwiX2VuYWJsZURlcHRoTGF5ZXIiLCJoYXNEZXB0aExheWVyIiwiZmluZCIsImxheWVySWQiLCJMQVlFUklEX0RFUFRIIiwiZGVwdGhMYXllciIsImluY3JlbWVudENvdW50ZXIiLCJkZWNyZW1lbnRDb3VudGVyIiwiRGVidWciLCJhc3NlcnQiLCJvayIsIndhcm5PbmNlIiwibGF5ZXJDb21wIiwiX2RpcnR5Q2FtZXJhcyIsInNjcmVlblRvV29ybGQiLCJzY3JlZW54Iiwic2NyZWVueSIsImNhbWVyYXoiLCJ3b3JsZENvb3JkIiwiZGV2aWNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJ3IiwiY2xpZW50UmVjdCIsIndpZHRoIiwiaCIsImhlaWdodCIsIndvcmxkVG9TY3JlZW4iLCJzY3JlZW5Db29yZCIsIm9uQXBwUHJlcmVuZGVyIiwiX3ZpZXdNYXREaXJ0eSIsIl92aWV3UHJvak1hdERpcnR5IiwiYWRkQ2FtZXJhVG9MYXllcnMiLCJyZW1vdmVDYW1lcmFGcm9tTGF5ZXJzIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvZmYiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsIm9uIiwiaW5kZXgiLCJpbmRleE9mIiwiaWQiLCJvbkVuYWJsZSIsImVuYWJsZSIsIm9uRGlzYWJsZSIsImRpc2FibGUiLCJvblJlbW92ZSIsImNhbGN1bGF0ZUFzcGVjdFJhdGlvIiwicnQiLCJ6IiwiZnJhbWVVcGRhdGUiLCJBU1BFQ1RfQVVUTyIsInN0YXJ0WHIiLCJ0eXBlIiwic3BhY2VUeXBlIiwib3B0aW9ucyIsInhyIiwic3RhcnQiLCJlbmRYciIsImNhbGxiYWNrIiwiRXJyb3IiLCJlbmQiLCJjb3B5Iiwic291cmNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQUNwQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7O0FBR0E7O0FBR0E7O0FBR0E7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFDeEIsSUFBQSxLQUFLLENBQUNELE1BQU0sRUFBRUMsTUFBTSxDQUFDLENBQUE7SUFBQyxJQTFEMUJDLENBQUFBLGdCQUFnQixHQUFHLElBQUksQ0FBQTtJQUFBLElBT3ZCQyxD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
