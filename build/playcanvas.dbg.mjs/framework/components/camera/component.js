/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_UI, LAYERID_DEPTH, ASPECT_AUTO } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { Component } from '../component.js';
import { PostEffectQueue } from './post-effect-queue.js';
import { Debug } from '../../../core/debug.js';

// note: when this list is modified, the copy() function needs to be adjusted
const properties = [{
  name: 'aspectRatio',
  readonly: false
}, {
  name: 'aspectRatioMode',
  readonly: false
}, {
  name: 'calculateProjection',
  readonly: false
}, {
  name: 'calculateTransform',
  readonly: false
}, {
  name: 'clearColor',
  readonly: false
}, {
  name: 'cullFaces',
  readonly: false
}, {
  name: 'farClip',
  readonly: false
}, {
  name: 'flipFaces',
  readonly: false
}, {
  name: 'fov',
  readonly: false
}, {
  name: 'frustumCulling',
  readonly: false
}, {
  name: 'horizontalFov',
  readonly: false
}, {
  name: 'nearClip',
  readonly: false
}, {
  name: 'orthoHeight',
  readonly: false
}, {
  name: 'projection',
  readonly: false
}, {
  name: 'scissorRect',
  readonly: false
}, {
  name: 'aperture',
  readonly: false
}, {
  name: 'shutter',
  readonly: false
}, {
  name: 'sensitivity',
  readonly: false
}];

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
 * @property {number} projection The type of projection used to render the camera. Can be:
 *
 * - {@link PROJECTION_PERSPECTIVE}: A perspective projection. The camera frustum
 * resembles a truncated pyramid.
 * - {@link PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera
 * frustum is a cuboid.
 *
 * Defaults to {@link PROJECTION_PERSPECTIVE}.
 * @property {number} aspectRatio The aspect ratio (width divided by height) of the camera. If
 * aspectRatioMode is {@link ASPECT_AUTO}, then this value will be automatically calculated every
 * frame, and you can only read it. If it's ASPECT_MANUAL, you can set the value.
 * @property {number} aspectRatioMode The aspect ratio mode of the camera. Can be:
 *
 * - {@link ASPECT_AUTO}: aspect ratio will be calculated from the current render
 * target's width divided by height.
 * - {@link ASPECT_MANUAL}: use the aspectRatio value.
 *
 * Defaults to {@link ASPECT_AUTO}.
 * @property {import('../../../core/math/color.js').Color} clearColor The color used to clear the
 * canvas to before the camera starts to render. Defaults to [0.75, 0.75, 0.75, 1].
 * @property {number} farClip The distance from the camera after which no rendering will take
 * place. Defaults to 1000.
 * @property {number} fov The field of view of the camera in degrees. Usually this is the Y-axis
 * field of view, see {@link CameraComponent#horizontalFov}. Used for
 * {@link PROJECTION_PERSPECTIVE} cameras only. Defaults to 45.
 * @property {boolean} horizontalFov Set which axis to use for the Field of View calculation.
 * Defaults to false.
 * @property {number} nearClip The distance from the camera before which no rendering will take
 * place. Defaults to 0.1.
 * @property {number} orthoHeight The half-height of the orthographic view window (in the Y-axis).
 * Used for {@link PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
 * @property {import('../../../core/math/vec4.js').Vec4} scissorRect Clips all pixels which are
 * not in the rectangle. The order of the values is [x, y, width, height]. Defaults to [0, 0, 1, 1].
 * @property {boolean} frustumCulling Controls the culling of mesh instances against the camera
 * frustum, i.e. if objects outside of camera should be omitted from rendering. If false, all mesh
 * instances in the scene are rendered by the camera, regardless of visibility. Defaults to false.
 * @property {CalculateMatrixCallback} calculateTransform Custom function you can provide to
 * calculate the camera transformation matrix manually. Can be used for complex effects like
 * reflections. Function is called using component's scope. Arguments:
 *
 * - {@link Mat4} transformMatrix: output of the function.
 * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
 *
 * Left and right are only used in stereo rendering.
 * @property {CalculateMatrixCallback} calculateProjection Custom function you can provide to
 * calculate the camera projection matrix manually. Can be used for complex effects like doing
 * oblique projection. Function is called using component's scope. Arguments:
 *
 * - {@link Mat4} transformMatrix: output of the function
 * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
 *
 * Left and right are only used in stereo rendering.
 * @property {boolean} cullFaces If true the camera will take material.cull into account. Otherwise
 * both front and back faces will be rendered. Defaults to true.
 * @property {boolean} flipFaces If true the camera will invert front and back faces. Can be useful
 * for reflection rendering. Defaults to false.
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
    this._camera = new Camera();
    this._camera.node = entity;
    this._priority = 0;

    // layer id at which the postprocessing stops for the camera
    this._disablePostEffectsLayer = LAYERID_UI;

    // postprocessing management
    this._postEffects = new PostEffectQueue(system.app, this);
    this._sceneDepthMapRequested = false;
    this._sceneColorMapRequested = false;
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

  // based on the value, the depth layer's enable counter is incremented or decremented
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
   * is accummulative, and for each enable request, a disable request need to be called.
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

  /**
   * Request the scene to generate a texture containing the scene depth map. Note that this call
   * is accummulative, and for each enable request, a disable request need to be called.
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
   * Queries the camera's frustum shape.
   *
   * @type {import('../../../core/shape/frustum.js').Frustum}
   */
  get frustum() {
    return this._camera.frustum;
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
   * The post effects queue for this camera. Use this to add or remove post effects from the camera.
   *
   * @type {PostEffectQueue}
   */
  get postEffectsEnabled() {
    return this._postEffects.enabled;
  }
  get postEffects() {
    return this._postEffects;
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
   * Queries the camera's projection matrix.
   *
   * @type {import('../../../core/math/mat4.js').Mat4}
   */
  get projectionMatrix() {
    return this._camera.projectionMatrix;
  }

  /**
   * Set camera aperture in f-stops, the default value is 16.0. Higher value means less exposure.
   *
   * @type {number}
   */
  set aperture(newValue) {
    this._camera.aperture = newValue;
  }
  get aperture() {
    return this._camera.aperture;
  }

  /**
   * Set camera sensitivity in ISO, the default value is 1000. Higher value means more exposure.
   *
   * @type {number}
   */
  set sensitivity(newValue) {
    this._camera.sensitivity = newValue;
  }
  get sensitivity() {
    return this._camera.sensitivity;
  }

  /**
   * Set camera shutter speed in seconds, the default value is 1/1000s. Longer shutter means more exposure.
   *
   * @type {number}
   */
  set shutter(newValue) {
    this._camera.shutter = newValue;
  }
  get shutter() {
    return this._camera.shutter;
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
   * Queries the camera's view matrix.
   *
   * @type {import('../../../core/math/mat4.js').Mat4}
   */
  get viewMatrix() {
    return this._camera.viewMatrix;
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

  // called before application renders the scene
  onAppPrerender() {
    this._camera._viewMatDirty = true;
    this._camera._viewProjMatDirty = true;
  }
  addCameraToLayers() {
    const layers = this.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (layer) {
        layer.addCamera(this);
      }
    }
  }
  removeCameraFromLayers() {
    const layers = this.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(layers[i]);
      if (layer) {
        layer.removeCamera(this);
      }
    }
  }
  onLayersChanged(oldComp, newComp) {
    this.addCameraToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addCamera(this);
  }
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

  // function to copy properties from the source CameraComponent.
  // properties not copied: postEffects
  // inherited properties not copied (all): system, entity, enabled)
  copy(source) {
    // copy data driven properties
    properties.forEach(property => {
      if (!property.readonly) {
        const name = property.name;
        this[name] = source[name];
      }
    });

    // other properties
    this.clearColorBuffer = source.clearColorBuffer;
    this.clearDepthBuffer = source.clearDepthBuffer;
    this.clearStencilBuffer = source.clearStencilBuffer;
    this.disablePostEffectsLayer = source.disablePostEffectsLayer;
    this.layers = source.layers;
    this.priority = source.priority;
    this.renderTarget = source.renderTarget;
    this.rect = source.rect;
    this.aperture = source.aperture;
    this.sensitivity = source.sensitivity;
    this.shutter = source.shutter;
  }
}

// for common properties, create getters and setters which use this._camera as a storage for their values
properties.forEach(function (property) {
  const name = property.name;
  const options = {};

  // getter
  options.get = function () {
    return this._camera[name];
  };

  // setter
  if (!property.readonly) {
    options.set = function (newValue) {
      this._camera[name] = newValue;
    };
  }
  Object.defineProperty(CameraComponent.prototype, name, options);
});

export { CameraComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBU1BFQ1RfQVVUTywgTEFZRVJJRF9VSSwgTEFZRVJJRF9ERVBUSCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDYW1lcmEgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jYW1lcmEuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBQb3N0RWZmZWN0UXVldWUgfSBmcm9tICcuL3Bvc3QtZWZmZWN0LXF1ZXVlLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbi8vIG5vdGU6IHdoZW4gdGhpcyBsaXN0IGlzIG1vZGlmaWVkLCB0aGUgY29weSgpIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIGFkanVzdGVkXG5jb25zdCBwcm9wZXJ0aWVzID0gW1xuICAgIHsgbmFtZTogJ2FzcGVjdFJhdGlvJywgcmVhZG9ubHk6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnYXNwZWN0UmF0aW9Nb2RlJywgcmVhZG9ubHk6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnY2FsY3VsYXRlUHJvamVjdGlvbicsIHJlYWRvbmx5OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ2NhbGN1bGF0ZVRyYW5zZm9ybScsIHJlYWRvbmx5OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ2NsZWFyQ29sb3InLCByZWFkb25seTogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdjdWxsRmFjZXMnLCByZWFkb25seTogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdmYXJDbGlwJywgcmVhZG9ubHk6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnZmxpcEZhY2VzJywgcmVhZG9ubHk6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnZm92JywgcmVhZG9ubHk6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnZnJ1c3R1bUN1bGxpbmcnLCByZWFkb25seTogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdob3Jpem9udGFsRm92JywgcmVhZG9ubHk6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnbmVhckNsaXAnLCByZWFkb25seTogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdvcnRob0hlaWdodCcsIHJlYWRvbmx5OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ3Byb2plY3Rpb24nLCByZWFkb25seTogZmFsc2UgfSxcbiAgICB7IG5hbWU6ICdzY2lzc29yUmVjdCcsIHJlYWRvbmx5OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ2FwZXJ0dXJlJywgcmVhZG9ubHk6IGZhbHNlIH0sXG4gICAgeyBuYW1lOiAnc2h1dHRlcicsIHJlYWRvbmx5OiBmYWxzZSB9LFxuICAgIHsgbmFtZTogJ3NlbnNpdGl2aXR5JywgcmVhZG9ubHk6IGZhbHNlIH1cbl07XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVRyYW5zZm9ybX0gYW5kIHtAbGluayBDYW1lcmFDb21wb25lbnQjY2FsY3VsYXRlUHJvamVjdGlvbn0uXG4gKlxuICogQGNhbGxiYWNrIENhbGN1bGF0ZU1hdHJpeENhbGxiYWNrXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnKS5NYXQ0fSB0cmFuc2Zvcm1NYXRyaXggLSBPdXRwdXQgb2YgdGhlIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtudW1iZXJ9IHZpZXcgLSBUeXBlIG9mIHZpZXcuIENhbiBiZSB7QGxpbmsgVklFV19DRU5URVJ9LCB7QGxpbmsgVklFV19MRUZUfSBvciB7QGxpbmsgVklFV19SSUdIVH0uIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqL1xuXG4vKipcbiAqIFRoZSBDYW1lcmEgQ29tcG9uZW50IGVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciB0aGUgc2NlbmUuIEEgc2NlbmUgcmVxdWlyZXMgYXQgbGVhc3Qgb25lXG4gKiBlbmFibGVkIGNhbWVyYSBjb21wb25lbnQgdG8gYmUgcmVuZGVyZWQuIE5vdGUgdGhhdCBtdWx0aXBsZSBjYW1lcmEgY29tcG9uZW50cyBjYW4gYmUgZW5hYmxlZFxuICogc2ltdWx0YW5lb3VzbHkgKGZvciBzcGxpdC1zY3JlZW4gb3Igb2Zmc2NyZWVuIHJlbmRlcmluZywgZm9yIGV4YW1wbGUpLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIEFkZCBhIHBjLkNhbWVyYUNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAqIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gKiBlbnRpdHkuYWRkQ29tcG9uZW50KCdjYW1lcmEnLCB7XG4gKiAgICAgbmVhckNsaXA6IDEsXG4gKiAgICAgZmFyQ2xpcDogMTAwLFxuICogICAgIGZvdjogNTVcbiAqIH0pO1xuICpcbiAqIC8vIEdldCB0aGUgcGMuQ2FtZXJhQ29tcG9uZW50IG9uIGFuIGVudGl0eVxuICogdmFyIGNhbWVyYUNvbXBvbmVudCA9IGVudGl0eS5jYW1lcmE7XG4gKlxuICogLy8gVXBkYXRlIGEgcHJvcGVydHkgb24gYSBjYW1lcmEgY29tcG9uZW50XG4gKiBlbnRpdHkuY2FtZXJhLm5lYXJDbGlwID0gMjtcbiAqIGBgYFxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBwcm9qZWN0aW9uIFRoZSB0eXBlIG9mIHByb2plY3Rpb24gdXNlZCB0byByZW5kZXIgdGhlIGNhbWVyYS4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkV9OiBBIHBlcnNwZWN0aXZlIHByb2plY3Rpb24uIFRoZSBjYW1lcmEgZnJ1c3R1bVxuICogcmVzZW1ibGVzIGEgdHJ1bmNhdGVkIHB5cmFtaWQuXG4gKiAtIHtAbGluayBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQ306IEFuIG9ydGhvZ3JhcGhpYyBwcm9qZWN0aW9uLiBUaGUgY2FtZXJhXG4gKiBmcnVzdHVtIGlzIGEgY3Vib2lkLlxuICpcbiAqIERlZmF1bHRzIHRvIHtAbGluayBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFfS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhc3BlY3RSYXRpbyBUaGUgYXNwZWN0IHJhdGlvICh3aWR0aCBkaXZpZGVkIGJ5IGhlaWdodCkgb2YgdGhlIGNhbWVyYS4gSWZcbiAqIGFzcGVjdFJhdGlvTW9kZSBpcyB7QGxpbmsgQVNQRUNUX0FVVE99LCB0aGVuIHRoaXMgdmFsdWUgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNhbGN1bGF0ZWQgZXZlcnlcbiAqIGZyYW1lLCBhbmQgeW91IGNhbiBvbmx5IHJlYWQgaXQuIElmIGl0J3MgQVNQRUNUX01BTlVBTCwgeW91IGNhbiBzZXQgdGhlIHZhbHVlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFzcGVjdFJhdGlvTW9kZSBUaGUgYXNwZWN0IHJhdGlvIG1vZGUgb2YgdGhlIGNhbWVyYS4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIEFTUEVDVF9BVVRPfTogYXNwZWN0IHJhdGlvIHdpbGwgYmUgY2FsY3VsYXRlZCBmcm9tIHRoZSBjdXJyZW50IHJlbmRlclxuICogdGFyZ2V0J3Mgd2lkdGggZGl2aWRlZCBieSBoZWlnaHQuXG4gKiAtIHtAbGluayBBU1BFQ1RfTUFOVUFMfTogdXNlIHRoZSBhc3BlY3RSYXRpbyB2YWx1ZS5cbiAqXG4gKiBEZWZhdWx0cyB0byB7QGxpbmsgQVNQRUNUX0FVVE99LlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcycpLkNvbG9yfSBjbGVhckNvbG9yIFRoZSBjb2xvciB1c2VkIHRvIGNsZWFyIHRoZVxuICogY2FudmFzIHRvIGJlZm9yZSB0aGUgY2FtZXJhIHN0YXJ0cyB0byByZW5kZXIuIERlZmF1bHRzIHRvIFswLjc1LCAwLjc1LCAwLjc1LCAxXS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmYXJDbGlwIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgYWZ0ZXIgd2hpY2ggbm8gcmVuZGVyaW5nIHdpbGwgdGFrZVxuICogcGxhY2UuIERlZmF1bHRzIHRvIDEwMDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZm92IFRoZSBmaWVsZCBvZiB2aWV3IG9mIHRoZSBjYW1lcmEgaW4gZGVncmVlcy4gVXN1YWxseSB0aGlzIGlzIHRoZSBZLWF4aXNcbiAqIGZpZWxkIG9mIHZpZXcsIHNlZSB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2hvcml6b250YWxGb3Z9LiBVc2VkIGZvclxuICoge0BsaW5rIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkV9IGNhbWVyYXMgb25seS4gRGVmYXVsdHMgdG8gNDUuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGhvcml6b250YWxGb3YgU2V0IHdoaWNoIGF4aXMgdG8gdXNlIGZvciB0aGUgRmllbGQgb2YgVmlldyBjYWxjdWxhdGlvbi5cbiAqIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5lYXJDbGlwIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgYmVmb3JlIHdoaWNoIG5vIHJlbmRlcmluZyB3aWxsIHRha2VcbiAqIHBsYWNlLiBEZWZhdWx0cyB0byAwLjEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3J0aG9IZWlnaHQgVGhlIGhhbGYtaGVpZ2h0IG9mIHRoZSBvcnRob2dyYXBoaWMgdmlldyB3aW5kb3cgKGluIHRoZSBZLWF4aXMpLlxuICogVXNlZCBmb3Ige0BsaW5rIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDfSBjYW1lcmFzIG9ubHkuIERlZmF1bHRzIHRvIDEwLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH0gc2Npc3NvclJlY3QgQ2xpcHMgYWxsIHBpeGVscyB3aGljaCBhcmVcbiAqIG5vdCBpbiB0aGUgcmVjdGFuZ2xlLiBUaGUgb3JkZXIgb2YgdGhlIHZhbHVlcyBpcyBbeCwgeSwgd2lkdGgsIGhlaWdodF0uIERlZmF1bHRzIHRvIFswLCAwLCAxLCAxXS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZnJ1c3R1bUN1bGxpbmcgQ29udHJvbHMgdGhlIGN1bGxpbmcgb2YgbWVzaCBpbnN0YW5jZXMgYWdhaW5zdCB0aGUgY2FtZXJhXG4gKiBmcnVzdHVtLCBpLmUuIGlmIG9iamVjdHMgb3V0c2lkZSBvZiBjYW1lcmEgc2hvdWxkIGJlIG9taXR0ZWQgZnJvbSByZW5kZXJpbmcuIElmIGZhbHNlLCBhbGwgbWVzaFxuICogaW5zdGFuY2VzIGluIHRoZSBzY2VuZSBhcmUgcmVuZGVyZWQgYnkgdGhlIGNhbWVyYSwgcmVnYXJkbGVzcyBvZiB2aXNpYmlsaXR5LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7Q2FsY3VsYXRlTWF0cml4Q2FsbGJhY2t9IGNhbGN1bGF0ZVRyYW5zZm9ybSBDdXN0b20gZnVuY3Rpb24geW91IGNhbiBwcm92aWRlIHRvXG4gKiBjYWxjdWxhdGUgdGhlIGNhbWVyYSB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggbWFudWFsbHkuIENhbiBiZSB1c2VkIGZvciBjb21wbGV4IGVmZmVjdHMgbGlrZVxuICogcmVmbGVjdGlvbnMuIEZ1bmN0aW9uIGlzIGNhbGxlZCB1c2luZyBjb21wb25lbnQncyBzY29wZS4gQXJndW1lbnRzOlxuICpcbiAqIC0ge0BsaW5rIE1hdDR9IHRyYW5zZm9ybU1hdHJpeDogb3V0cHV0IG9mIHRoZSBmdW5jdGlvbi5cbiAqIC0gdmlldzogVHlwZSBvZiB2aWV3LiBDYW4gYmUge0BsaW5rIFZJRVdfQ0VOVEVSfSwge0BsaW5rIFZJRVdfTEVGVH0gb3Ige0BsaW5rIFZJRVdfUklHSFR9LlxuICpcbiAqIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqIEBwcm9wZXJ0eSB7Q2FsY3VsYXRlTWF0cml4Q2FsbGJhY2t9IGNhbGN1bGF0ZVByb2plY3Rpb24gQ3VzdG9tIGZ1bmN0aW9uIHlvdSBjYW4gcHJvdmlkZSB0b1xuICogY2FsY3VsYXRlIHRoZSBjYW1lcmEgcHJvamVjdGlvbiBtYXRyaXggbWFudWFsbHkuIENhbiBiZSB1c2VkIGZvciBjb21wbGV4IGVmZmVjdHMgbGlrZSBkb2luZ1xuICogb2JsaXF1ZSBwcm9qZWN0aW9uLiBGdW5jdGlvbiBpcyBjYWxsZWQgdXNpbmcgY29tcG9uZW50J3Mgc2NvcGUuIEFyZ3VtZW50czpcbiAqXG4gKiAtIHtAbGluayBNYXQ0fSB0cmFuc2Zvcm1NYXRyaXg6IG91dHB1dCBvZiB0aGUgZnVuY3Rpb25cbiAqIC0gdmlldzogVHlwZSBvZiB2aWV3LiBDYW4gYmUge0BsaW5rIFZJRVdfQ0VOVEVSfSwge0BsaW5rIFZJRVdfTEVGVH0gb3Ige0BsaW5rIFZJRVdfUklHSFR9LlxuICpcbiAqIExlZnQgYW5kIHJpZ2h0IGFyZSBvbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gY3VsbEZhY2VzIElmIHRydWUgdGhlIGNhbWVyYSB3aWxsIHRha2UgbWF0ZXJpYWwuY3VsbCBpbnRvIGFjY291bnQuIE90aGVyd2lzZVxuICogYm90aCBmcm9udCBhbmQgYmFjayBmYWNlcyB3aWxsIGJlIHJlbmRlcmVkLiBEZWZhdWx0cyB0byB0cnVlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBmbGlwRmFjZXMgSWYgdHJ1ZSB0aGUgY2FtZXJhIHdpbGwgaW52ZXJ0IGZyb250IGFuZCBiYWNrIGZhY2VzLiBDYW4gYmUgdXNlZnVsXG4gKiBmb3IgcmVmbGVjdGlvbiByZW5kZXJpbmcuIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBDYW1lcmFDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIHBvc3Rwcm9jZXNzaW5nIHNob3VsZCBleGVjdXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBvblBvc3Rwcm9jZXNzaW5nID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgdGhlIGNhbWVyYSByZW5kZXJzIHRoZSBzY2VuZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgKi9cbiAgICBvblByZVJlbmRlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIGNhbWVyYSByZW5kZXJzIHRoZSBzY2VuZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgKi9cbiAgICBvblBvc3RSZW5kZXIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQSBjb3VudGVyIG9mIHJlcXVlc3RzIG9mIGRlcHRoIG1hcCByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlbmRlclNjZW5lRGVwdGhNYXAgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQSBjb3VudGVyIG9mIHJlcXVlc3RzIG9mIGNvbG9yIG1hcCByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlbmRlclNjZW5lQ29sb3JNYXAgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENhbWVyYUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLkNhbWVyYUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXNcbiAgICAgKiBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhID0gbmV3IENhbWVyYSgpO1xuICAgICAgICB0aGlzLl9jYW1lcmEubm9kZSA9IGVudGl0eTtcblxuICAgICAgICB0aGlzLl9wcmlvcml0eSA9IDA7XG5cbiAgICAgICAgLy8gbGF5ZXIgaWQgYXQgd2hpY2ggdGhlIHBvc3Rwcm9jZXNzaW5nIHN0b3BzIGZvciB0aGUgY2FtZXJhXG4gICAgICAgIHRoaXMuX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyID0gTEFZRVJJRF9VSTtcblxuICAgICAgICAvLyBwb3N0cHJvY2Vzc2luZyBtYW5hZ2VtZW50XG4gICAgICAgIHRoaXMuX3Bvc3RFZmZlY3RzID0gbmV3IFBvc3RFZmZlY3RRdWV1ZShzeXN0ZW0uYXBwLCB0aGlzKTtcblxuICAgICAgICB0aGlzLl9zY2VuZURlcHRoTWFwUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSBjYW1lcmEgY29tcG9uZW50J3MgdW5kZXJseWluZyBDYW1lcmEgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q2FtZXJhfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgY2FtZXJhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGNhbWVyYSB3aWxsIGNsZWFyIHRoZSBjb2xvciBidWZmZXIgdG8gdGhlIGNvbG9yIHNldCBpbiBjbGVhckNvbG9yLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyQ29sb3JCdWZmZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNsZWFyQ29sb3JCdWZmZXIgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3JCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyRGVwdGhCdWZmZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNsZWFyRGVwdGhCdWZmZXIgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyRGVwdGhCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgc3RlbmNpbCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2xlYXJTdGVuY2lsQnVmZmVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jbGVhclN0ZW5jaWxCdWZmZXIgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGF5ZXIgSUQgb2YgYSBsYXllciBvbiB3aGljaCB0aGUgcG9zdHByb2Nlc3Npbmcgb2YgdGhlIGNhbWVyYSBzdG9wcyBiZWluZyBhcHBsaWVkIHRvLlxuICAgICAqIERlZmF1bHRzIHRvIExBWUVSSURfVUksIHdoaWNoIGNhdXNlcyBwb3N0IHByb2Nlc3NpbmcgdG8gbm90IGJlIGFwcGxpZWQgdG8gVUkgbGF5ZXIgYW5kIGFueVxuICAgICAqIGZvbGxvd2luZyBsYXllcnMgZm9yIHRoZSBjYW1lcmEuIFNldCB0byB1bmRlZmluZWQgZm9yIHBvc3QtcHJvY2Vzc2luZyB0byBiZSBhcHBsaWVkIHRvIGFsbFxuICAgICAqIGxheWVycyBvZiB0aGUgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy5kaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGRpc2FibGVQb3N0RWZmZWN0c0xheWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXI7XG4gICAgfVxuXG4gICAgLy8gYmFzZWQgb24gdGhlIHZhbHVlLCB0aGUgZGVwdGggbGF5ZXIncyBlbmFibGUgY291bnRlciBpcyBpbmNyZW1lbnRlZCBvciBkZWNyZW1lbnRlZFxuICAgIF9lbmFibGVEZXB0aExheWVyKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGhhc0RlcHRoTGF5ZXIgPSB0aGlzLmxheWVycy5maW5kKGxheWVySWQgPT4gbGF5ZXJJZCA9PT0gTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChoYXNEZXB0aExheWVyKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9sYXllci5qcycpLkxheWVyfSAqL1xuICAgICAgICAgICAgY29uc3QgZGVwdGhMYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfREVQVEgpO1xuXG4gICAgICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBkZXB0aExheWVyPy5pbmNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlcHRoTGF5ZXI/LmRlY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVxdWVzdCB0aGUgc2NlbmUgdG8gZ2VuZXJhdGUgYSB0ZXh0dXJlIGNvbnRhaW5pbmcgdGhlIHNjZW5lIGNvbG9yIG1hcC4gTm90ZSB0aGF0IHRoaXMgY2FsbFxuICAgICAqIGlzIGFjY3VtbXVsYXRpdmUsIGFuZCBmb3IgZWFjaCBlbmFibGUgcmVxdWVzdCwgYSBkaXNhYmxlIHJlcXVlc3QgbmVlZCB0byBiZSBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIHRvIHJlcXVlc3QgdGhlIGdlbmVyYXRpb24sIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgcmVxdWVzdFNjZW5lQ29sb3JNYXAoZW5hYmxlZCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTY2VuZUNvbG9yTWFwICs9IGVuYWJsZWQgPyAxIDogLTE7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9yZW5kZXJTY2VuZUNvbG9yTWFwID49IDApO1xuICAgICAgICBjb25zdCBvayA9IHRoaXMuX2VuYWJsZURlcHRoTGF5ZXIoZW5hYmxlZCk7XG4gICAgICAgIGlmICghb2spIHtcbiAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lQ29sb3JNYXAgd2FzIGNhbGxlZCwgYnV0IHRoZSBjYW1lcmEgZG9lcyBub3QgaGF2ZSBhIERlcHRoIGxheWVyLCBpZ25vcmluZy4nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCByZW5kZXJTY2VuZUNvbG9yTWFwKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fc2NlbmVDb2xvck1hcFJlcXVlc3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U2NlbmVDb2xvck1hcCh0cnVlKTtcbiAgICAgICAgICAgIHRoaXMuX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdFNjZW5lQ29sb3JNYXAoZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fc2NlbmVDb2xvck1hcFJlcXVlc3RlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclNjZW5lQ29sb3JNYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTY2VuZUNvbG9yTWFwID4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXF1ZXN0IHRoZSBzY2VuZSB0byBnZW5lcmF0ZSBhIHRleHR1cmUgY29udGFpbmluZyB0aGUgc2NlbmUgZGVwdGggbWFwLiBOb3RlIHRoYXQgdGhpcyBjYWxsXG4gICAgICogaXMgYWNjdW1tdWxhdGl2ZSwgYW5kIGZvciBlYWNoIGVuYWJsZSByZXF1ZXN0LCBhIGRpc2FibGUgcmVxdWVzdCBuZWVkIHRvIGJlIGNhbGxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgdG8gcmVxdWVzdCB0aGUgZ2VuZXJhdGlvbiwgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKi9cbiAgICByZXF1ZXN0U2NlbmVEZXB0aE1hcChlbmFibGVkKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlclNjZW5lRGVwdGhNYXAgKz0gZW5hYmxlZCA/IDEgOiAtMTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuX3JlbmRlclNjZW5lRGVwdGhNYXAgPj0gMCk7XG4gICAgICAgIGNvbnN0IG9rID0gdGhpcy5fZW5hYmxlRGVwdGhMYXllcihlbmFibGVkKTtcbiAgICAgICAgaWYgKCFvaykge1xuICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoJ0NhbWVyYUNvbXBvbmVudC5yZXF1ZXN0U2NlbmVEZXB0aE1hcCB3YXMgY2FsbGVkLCBidXQgdGhlIGNhbWVyYSBkb2VzIG5vdCBoYXZlIGEgRGVwdGggbGF5ZXIsIGlnbm9yaW5nLicpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0IHJlbmRlclNjZW5lRGVwdGhNYXAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICYmICF0aGlzLl9zY2VuZURlcHRoTWFwUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RTY2VuZURlcHRoTWFwKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fc2NlbmVEZXB0aE1hcFJlcXVlc3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U2NlbmVEZXB0aE1hcChmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl9zY2VuZURlcHRoTWFwUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU2NlbmVEZXB0aE1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclNjZW5lRGVwdGhNYXAgPiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIGNhbWVyYSdzIGZydXN0dW0gc2hhcGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2ZydXN0dW0uanMnKS5GcnVzdHVtfVxuICAgICAqL1xuICAgIGdldCBmcnVzdHVtKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmZydXN0dW07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbGF5ZXIgSURzICh7QGxpbmsgTGF5ZXIjaWR9KSB0byB3aGljaCB0aGlzIGNhbWVyYSBzaG91bGQgYmVsb25nLiBEb24ndCBwdXNoLFxuICAgICAqIHBvcCwgc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQsIHNldCBhIG5ldyBvbmUgaW5zdGVhZC4gRGVmYXVsdHNcbiAgICAgKiB0byBbTEFZRVJJRF9XT1JMRCwgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9TS1lCT1gsIExBWUVSSURfVUksIExBWUVSSURfSU1NRURJQVRFXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgbGF5ZXJzKG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuX2NhbWVyYS5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZUNhbWVyYSh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbWVyYS5sYXllcnMgPSBuZXdWYWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmV3VmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobmV3VmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5hZGRDYW1lcmEodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmxheWVycztcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzU2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLmxheWVyc1NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcG9zdCBlZmZlY3RzIHF1ZXVlIGZvciB0aGlzIGNhbWVyYS4gVXNlIHRoaXMgdG8gYWRkIG9yIHJlbW92ZSBwb3N0IGVmZmVjdHMgZnJvbSB0aGUgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHR5cGUge1Bvc3RFZmZlY3RRdWV1ZX1cbiAgICAgKi9cbiAgICBnZXQgcG9zdEVmZmVjdHNFbmFibGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcG9zdEVmZmVjdHMuZW5hYmxlZDtcbiAgICB9XG5cbiAgICBnZXQgcG9zdEVmZmVjdHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wb3N0RWZmZWN0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyB0aGUgb3JkZXIgaW4gd2hpY2ggY2FtZXJhcyBhcmUgcmVuZGVyZWQuIENhbWVyYXMgd2l0aCBzbWFsbGVyIHZhbHVlcyBmb3IgcHJpb3JpdHlcbiAgICAgKiBhcmUgcmVuZGVyZWQgZmlyc3QuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBwcmlvcml0eShuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9wcmlvcml0eSA9IG5ld1ZhbHVlO1xuICAgICAgICB0aGlzLmRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKTtcbiAgICB9XG5cbiAgICBnZXQgcHJpb3JpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmlvcml0eTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJykuTWF0NH1cbiAgICAgKi9cbiAgICBnZXQgcHJvamVjdGlvbk1hdHJpeCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBjYW1lcmEgYXBlcnR1cmUgaW4gZi1zdG9wcywgdGhlIGRlZmF1bHQgdmFsdWUgaXMgMTYuMC4gSGlnaGVyIHZhbHVlIG1lYW5zIGxlc3MgZXhwb3N1cmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhcGVydHVyZShuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuYXBlcnR1cmUgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXBlcnR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEuYXBlcnR1cmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IGNhbWVyYSBzZW5zaXRpdml0eSBpbiBJU08sIHRoZSBkZWZhdWx0IHZhbHVlIGlzIDEwMDAuIEhpZ2hlciB2YWx1ZSBtZWFucyBtb3JlIGV4cG9zdXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2Vuc2l0aXZpdHkobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnNlbnNpdGl2aXR5ID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNlbnNpdGl2aXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNlbnNpdGl2aXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBjYW1lcmEgc2h1dHRlciBzcGVlZCBpbiBzZWNvbmRzLCB0aGUgZGVmYXVsdCB2YWx1ZSBpcyAxLzEwMDBzLiBMb25nZXIgc2h1dHRlciBtZWFucyBtb3JlIGV4cG9zdXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2h1dHRlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jYW1lcmEuc2h1dHRlciA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzaHV0dGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNodXR0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgd2hlcmUgb24gdGhlIHNjcmVlbiB0aGUgY2FtZXJhIHdpbGwgYmUgcmVuZGVyZWQgaW4gbm9ybWFsaXplZCBzY3JlZW4gY29vcmRpbmF0ZXMuXG4gICAgICogRGVmYXVsdHMgdG8gWzAsIDAsIDEsIDFdLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fVxuICAgICAqL1xuICAgIHNldCByZWN0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5yZWN0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnJlY3QnLCB0aGlzLl9jYW1lcmEucmVjdCk7XG4gICAgfVxuXG4gICAgZ2V0IHJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEucmVjdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgdGFyZ2V0IHRvIHdoaWNoIHJlbmRlcmluZyBvZiB0aGUgY2FtZXJhcyBpcyBwZXJmb3JtZWQuIElmIG5vdCBzZXQsIGl0IHdpbGwgcmVuZGVyXG4gICAgICogc2ltcGx5IHRvIHRoZSBzY3JlZW4uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fVxuICAgICAqL1xuICAgIHNldCByZW5kZXJUYXJnZXQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLnJlbmRlclRhcmdldCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSBjYW1lcmEncyB2aWV3IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJykuTWF0NH1cbiAgICAgKi9cbiAgICBnZXQgdmlld01hdHJpeCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbWVyYS52aWV3TWF0cml4O1xuICAgIH1cblxuICAgIGRpcnR5TGF5ZXJDb21wb3NpdGlvbkNhbWVyYXMoKSB7XG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uIG5lZWRzIHRvIHVwZGF0ZSBvcmRlclxuICAgICAgICBjb25zdCBsYXllckNvbXAgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBsYXllckNvbXAuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gMkQgc2NyZWVuIHNwYWNlIHRvIDNEIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjcmVlbnggLSBYIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2VcbiAgICAgKiAwIHRvIGBjYW52YXMub2Zmc2V0V2lkdGhgIG9mIHRoZSBhcHBsaWNhdGlvbidzIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY3JlZW55IC0gWSBjb29yZGluYXRlIG9uIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LiBTaG91bGQgYmUgaW4gdGhlIHJhbmdlXG4gICAgICogMCB0byBgY2FudmFzLm9mZnNldEhlaWdodGAgb2YgdGhlIGFwcGxpY2F0aW9uJ3MgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNhbWVyYXogLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgY2FtZXJhIGluIHdvcmxkIHNwYWNlIHRvIGNyZWF0ZSB0aGUgbmV3XG4gICAgICogcG9pbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gW3dvcmxkQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmUgd29ybGRcbiAgICAgKiBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCB0aGUgc3RhcnQgYW5kIGVuZCBwb2ludHMgb2YgYSAzRCByYXkgZmlyZWQgZnJvbSBhIHNjcmVlbiBjbGljayBwb3NpdGlvblxuICAgICAqIHZhciBzdGFydCA9IGVudGl0eS5jYW1lcmEuc2NyZWVuVG9Xb3JsZChjbGlja1gsIGNsaWNrWSwgZW50aXR5LmNhbWVyYS5uZWFyQ2xpcCk7XG4gICAgICogdmFyIGVuZCA9IGVudGl0eS5jYW1lcmEuc2NyZWVuVG9Xb3JsZChjbGlja1gsIGNsaWNrWSwgZW50aXR5LmNhbWVyYS5mYXJDbGlwKTtcbiAgICAgKlxuICAgICAqIC8vIFVzZSB0aGUgcmF5IGNvb3JkaW5hdGVzIHRvIHBlcmZvcm0gYSByYXljYXN0XG4gICAgICogYXBwLnN5c3RlbXMucmlnaWRib2R5LnJheWNhc3RGaXJzdChzdGFydCwgZW5kLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiRW50aXR5IFwiICsgcmVzdWx0LmVudGl0eS5uYW1lICsgXCIgd2FzIHNlbGVjdGVkXCIpO1xuICAgICAqIH0pO1xuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gVGhlIHdvcmxkIHNwYWNlIGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgc2NyZWVuVG9Xb3JsZChzY3JlZW54LCBzY3JlZW55LCBjYW1lcmF6LCB3b3JsZENvb3JkKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdyA9IGRldmljZS5jbGllbnRSZWN0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gZGV2aWNlLmNsaWVudFJlY3QuaGVpZ2h0O1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLnNjcmVlblRvV29ybGQoc2NyZWVueCwgc2NyZWVueSwgY2FtZXJheiwgdywgaCwgd29ybGRDb29yZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gM0Qgd29ybGQgc3BhY2UgdG8gMkQgc2NyZWVuIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gd29ybGRDb29yZCAtIFRoZSB3b3JsZCBzcGFjZSBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IFtzY3JlZW5Db29yZF0gLSAzRCB2ZWN0b3IgdG8gcmVjZWl2ZVxuICAgICAqIHNjcmVlbiBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IFRoZSBzY3JlZW4gc3BhY2UgY29vcmRpbmF0ZS5cbiAgICAgKi9cbiAgICB3b3JsZFRvU2NyZWVuKHdvcmxkQ29vcmQsIHNjcmVlbkNvb3JkKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdyA9IGRldmljZS5jbGllbnRSZWN0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gZGV2aWNlLmNsaWVudFJlY3QuaGVpZ2h0O1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhLndvcmxkVG9TY3JlZW4od29ybGRDb29yZCwgdywgaCwgc2NyZWVuQ29vcmQpO1xuICAgIH1cblxuICAgIC8vIGNhbGxlZCBiZWZvcmUgYXBwbGljYXRpb24gcmVuZGVycyB0aGUgc2NlbmVcbiAgICBvbkFwcFByZXJlbmRlcigpIHtcbiAgICAgICAgdGhpcy5fY2FtZXJhLl92aWV3TWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jYW1lcmEuX3ZpZXdQcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIGFkZENhbWVyYVRvTGF5ZXJzKCkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLmFkZENhbWVyYSh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUNhbWVyYUZyb21MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMubGF5ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChsYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgdGhpcy5hZGRDYW1lcmFUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIuYWRkQ2FtZXJhKHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLnN5c3RlbTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBzeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICBjb25zdCBsYXllcnMgPSBzY2VuZS5sYXllcnM7XG5cbiAgICAgICAgc3lzdGVtLmFkZENhbWVyYSh0aGlzKTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKGxheWVycykge1xuICAgICAgICAgICAgbGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBsYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmFkZENhbWVyYVRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3RFZmZlY3RzLmVuYWJsZSgpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3Qgc3lzdGVtID0gdGhpcy5zeXN0ZW07XG4gICAgICAgIGNvbnN0IHNjZW5lID0gc3lzdGVtLmFwcC5zY2VuZTtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gc2NlbmUubGF5ZXJzO1xuXG4gICAgICAgIHRoaXMucG9zdEVmZmVjdHMuZGlzYWJsZSgpO1xuXG4gICAgICAgIHRoaXMucmVtb3ZlQ2FtZXJhRnJvbUxheWVycygpO1xuXG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKGxheWVycykge1xuICAgICAgICAgICAgbGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgbGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBzeXN0ZW0ucmVtb3ZlQ2FtZXJhKHRoaXMpO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLm9uRGlzYWJsZSgpO1xuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZXMgYXNwZWN0IHJhdGlvIHZhbHVlIGZvciBhIGdpdmVuIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gW3J0XSAtIE9wdGlvbmFsXG4gICAgICogcmVuZGVyIHRhcmdldC4gSWYgdW5zcGVjaWZpZWQsIHRoZSBiYWNrYnVmZmVyIGlzIHVzZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgcmVuZGVyIHRhcmdldCAob3IgYmFja2J1ZmZlcikuXG4gICAgICovXG4gICAgY2FsY3VsYXRlQXNwZWN0UmF0aW8ocnQpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBjb25zdCB3aWR0aCA9IHJ0ID8gcnQud2lkdGggOiBkZXZpY2Uud2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IHJ0ID8gcnQuaGVpZ2h0IDogZGV2aWNlLmhlaWdodDtcbiAgICAgICAgcmV0dXJuICh3aWR0aCAqIHRoaXMucmVjdC56KSAvIChoZWlnaHQgKiB0aGlzLnJlY3Qudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJlcGFyZSB0aGUgY2FtZXJhIGZvciBmcmFtZSByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gcnQgLSBSZW5kZXJcbiAgICAgKiB0YXJnZXQgdG8gd2hpY2ggcmVuZGVyaW5nIHdpbGwgYmUgcGVyZm9ybWVkLiBXaWxsIGFmZmVjdCBjYW1lcmEncyBhc3BlY3QgcmF0aW8sIGlmXG4gICAgICogYXNwZWN0UmF0aW9Nb2RlIGlzIHtAbGluayBBU1BFQ1RfQVVUT30uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGZyYW1lVXBkYXRlKHJ0KSB7XG4gICAgICAgIGlmICh0aGlzLmFzcGVjdFJhdGlvTW9kZSA9PT0gQVNQRUNUX0FVVE8pIHtcbiAgICAgICAgICAgIHRoaXMuYXNwZWN0UmF0aW8gPSB0aGlzLmNhbGN1bGF0ZUFzcGVjdFJhdGlvKHJ0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gc3RhcnQgWFIgc2Vzc2lvbiB3aXRoIHRoaXMgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgdHlwZSBvZiBzZXNzaW9uLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRZUEVfSU5MSU5FfTogSW5saW5lIC0gYWx3YXlzIGF2YWlsYWJsZSB0eXBlIG9mIHNlc3Npb24uIEl0IGhhcyBsaW1pdGVkIGZlYXR1cmVcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIHRoZSBWUiBkZXZpY2VcbiAgICAgKiB3aXRoIHRoZSBiZXN0IGF2YWlsYWJsZSB0cmFja2luZyBmZWF0dXJlcy5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfQVJ9OiBJbW1lcnNpdmUgQVIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byB0aGUgVlIvQVJcbiAgICAgKiBkZXZpY2UgdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggdGhlIHJlYWwtd29ybGQgZW52aXJvbm1lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3BhY2VUeXBlIC0gUmVmZXJlbmNlIHNwYWNlIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVklFV0VSfTogVmlld2VyIC0gYWx3YXlzIHN1cHBvcnRlZCBzcGFjZSB3aXRoIHNvbWUgYmFzaWMgdHJhY2tpbmdcbiAgICAgKiBjYXBhYmlsaXRpZXMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTH06IExvY2FsIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luIG5lYXIgdGhlXG4gICAgICogdmlld2VyIGF0IHRoZSB0aW1lIG9mIGNyZWF0aW9uLiBJdCBpcyBtZWFudCBmb3Igc2VhdGVkIG9yIGJhc2ljIGxvY2FsIFhSIHNlc3Npb25zLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUxGTE9PUn06IExvY2FsIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luXG4gICAgICogYXQgdGhlIGZsb29yIGluIGEgc2FmZSBwb3NpdGlvbiBmb3IgdGhlIHVzZXIgdG8gc3RhbmQuIFRoZSB5LWF4aXMgZXF1YWxzIDAgYXQgZmxvb3IgbGV2ZWwuXG4gICAgICogRmxvb3IgbGV2ZWwgdmFsdWUgbWlnaHQgYmUgZXN0aW1hdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIHBsYXRmb3JtLiBJdCBpcyBtZWFudCBmb3Igc2VhdGVkIG9yXG4gICAgICogYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9CT1VOREVERkxPT1J9OiBCb3VuZGVkIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggaXRzIG5hdGl2ZVxuICAgICAqIG9yaWdpbiBhdCB0aGUgZmxvb3IsIHdoZXJlIHRoZSB1c2VyIGlzIGV4cGVjdGVkIHRvIG1vdmUgd2l0aGluIGEgcHJlLWVzdGFibGlzaGVkIGJvdW5kYXJ5LlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVU5CT1VOREVEfTogVW5ib3VuZGVkIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdoZXJlIHRoZSB1c2VyIGlzXG4gICAgICogZXhwZWN0ZWQgdG8gbW92ZSBmcmVlbHkgYXJvdW5kIHRoZWlyIGVudmlyb25tZW50LCBwb3RlbnRpYWxseSBsb25nIGRpc3RhbmNlcyBmcm9tIHRoZWlyXG4gICAgICogc3RhcnRpbmcgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IHdpdGggb3B0aW9ucyBmb3IgWFIgc2Vzc2lvbiBpbml0aWFsaXphdGlvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzXSAtIE9wdGlvbmFsIGZlYXR1cmVzIGZvciBYUlNlc3Npb24gc3RhcnQuIEl0IGlzXG4gICAgICogdXNlZCBmb3IgZ2V0dGluZyBhY2Nlc3MgdG8gYWRkaXRpb25hbCBXZWJYUiBzcGVjIGV4dGVuc2lvbnMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5pbWFnZVRyYWNraW5nXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlIHtAbGluayBYckltYWdlVHJhY2tpbmd9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucGxhbmVEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyUGxhbmVEZXRlY3Rpb259LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi94ci94ci1tYW5hZ2VyLmpzJykuWHJFcnJvckNhbGxiYWNrfSBbb3B0aW9ucy5jYWxsYmFja10gLSBPcHRpb25hbFxuICAgICAqIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHRoZSBzZXNzaW9uIGlzIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC1cbiAgICAgKiBpdCBpcyBudWxsIGlmIHRoZSBYUiBzZXNzaW9uIHN0YXJ0ZWQgc3VjY2Vzc2Z1bGx5LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5kZXB0aFNlbnNpbmddIC0gT3B0aW9uYWwgb2JqZWN0IHdpdGggZGVwdGggc2Vuc2luZyBwYXJhbWV0ZXJzIHRvXG4gICAgICogYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyRGVwdGhTZW5zaW5nfS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZV0gLSBPcHRpb25hbCB1c2FnZSBwcmVmZXJlbmNlIGZvciBkZXB0aFxuICAgICAqIHNlbnNpbmcsIGNhbiBiZSAnY3B1LW9wdGltaXplZCcgb3IgJ2dwdS1vcHRpbWl6ZWQnIChYUkRFUFRIU0VOU0lOR1VTQUdFXyopLCBkZWZhdWx0cyB0b1xuICAgICAqICdjcHUtb3B0aW1pemVkJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZyBkZXB0aCBzZW5zaW5nXG4gICAgICogc3lzdGVtLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2VdIC0gT3B0aW9uYWwgZGF0YSBmb3JtYXRcbiAgICAgKiBwcmVmZXJlbmNlIGZvciBkZXB0aCBzZW5zaW5nLiBDYW4gYmUgJ2x1bWluYW5jZS1hbHBoYScgb3IgJ2Zsb2F0MzInIChYUkRFUFRIU0VOU0lOR0ZPUk1BVF8qKSxcbiAgICAgKiBkZWZhdWx0cyB0byAnbHVtaW5hbmNlLWFscGhhJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZ1xuICAgICAqIGRlcHRoIHNlbnNpbmcgc3lzdGVtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gT24gYW4gZW50aXR5IHdpdGggYSBjYW1lcmEgY29tcG9uZW50XG4gICAgICogdGhpcy5lbnRpdHkuY2FtZXJhLnN0YXJ0WHIocGMuWFJUWVBFX1ZSLCBwYy5YUlNQQUNFX0xPQ0FMLCB7XG4gICAgICogICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICogICAgICAgICBpZiAoZXJyKSB7XG4gICAgICogICAgICAgICAgICAgLy8gZmFpbGVkIHRvIHN0YXJ0IFhSIHNlc3Npb25cbiAgICAgKiAgICAgICAgIH0gZWxzZSB7XG4gICAgICogICAgICAgICAgICAgLy8gaW4gWFJcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0WHIodHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC54ci5zdGFydCh0aGlzLCB0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gZW5kIFhSIHNlc3Npb24gb2YgdGhpcyBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4veHIveHItbWFuYWdlci5qcycpLlhyRXJyb3JDYWxsYmFja30gW2NhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrXG4gICAgICogZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvbiBpcyBlbmRlZC4gVGhlIGNhbGxiYWNrIGhhcyBvbmUgYXJndW1lbnQgRXJyb3IgLSBpdCBpcyBudWxsIGlmXG4gICAgICogc3VjY2Vzc2Z1bGx5IGVuZGVkIFhSIHNlc3Npb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBPbiBhbiBlbnRpdHkgd2l0aCBhIGNhbWVyYSBjb21wb25lbnRcbiAgICAgKiB0aGlzLmVudGl0eS5jYW1lcmEuZW5kWHIoZnVuY3Rpb24gKGVycikge1xuICAgICAqICAgICAvLyBub3QgYW55bW9yZSBpbiBYUlxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGVuZFhyKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fY2FtZXJhLnhyKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG5ldyBFcnJvcignQ2FtZXJhIGlzIG5vdCBpbiBYUicpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbWVyYS54ci5lbmQoY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIHRvIGNvcHkgcHJvcGVydGllcyBmcm9tIHRoZSBzb3VyY2UgQ2FtZXJhQ29tcG9uZW50LlxuICAgIC8vIHByb3BlcnRpZXMgbm90IGNvcGllZDogcG9zdEVmZmVjdHNcbiAgICAvLyBpbmhlcml0ZWQgcHJvcGVydGllcyBub3QgY29waWVkIChhbGwpOiBzeXN0ZW0sIGVudGl0eSwgZW5hYmxlZClcbiAgICBjb3B5KHNvdXJjZSkge1xuXG4gICAgICAgIC8vIGNvcHkgZGF0YSBkcml2ZW4gcHJvcGVydGllc1xuICAgICAgICBwcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG4gICAgICAgICAgICBpZiAoIXByb3BlcnR5LnJlYWRvbmx5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IHByb3BlcnR5Lm5hbWU7XG4gICAgICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHNvdXJjZVtuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gb3RoZXIgcHJvcGVydGllc1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3JCdWZmZXIgPSBzb3VyY2UuY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoQnVmZmVyID0gc291cmNlLmNsZWFyRGVwdGhCdWZmZXI7XG4gICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsQnVmZmVyID0gc291cmNlLmNsZWFyU3RlbmNpbEJ1ZmZlcjtcbiAgICAgICAgdGhpcy5kaXNhYmxlUG9zdEVmZmVjdHNMYXllciA9IHNvdXJjZS5kaXNhYmxlUG9zdEVmZmVjdHNMYXllcjtcbiAgICAgICAgdGhpcy5sYXllcnMgPSBzb3VyY2UubGF5ZXJzO1xuICAgICAgICB0aGlzLnByaW9yaXR5ID0gc291cmNlLnByaW9yaXR5O1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHNvdXJjZS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIHRoaXMucmVjdCA9IHNvdXJjZS5yZWN0O1xuICAgICAgICB0aGlzLmFwZXJ0dXJlID0gc291cmNlLmFwZXJ0dXJlO1xuICAgICAgICB0aGlzLnNlbnNpdGl2aXR5ID0gc291cmNlLnNlbnNpdGl2aXR5O1xuICAgICAgICB0aGlzLnNodXR0ZXIgPSBzb3VyY2Uuc2h1dHRlcjtcbiAgICB9XG59XG5cbi8vIGZvciBjb21tb24gcHJvcGVydGllcywgY3JlYXRlIGdldHRlcnMgYW5kIHNldHRlcnMgd2hpY2ggdXNlIHRoaXMuX2NhbWVyYSBhcyBhIHN0b3JhZ2UgZm9yIHRoZWlyIHZhbHVlc1xucHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wZXJ0eSkge1xuICAgIGNvbnN0IG5hbWUgPSBwcm9wZXJ0eS5uYW1lO1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7fTtcblxuICAgIC8vIGdldHRlclxuICAgIG9wdGlvbnMuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhW25hbWVdO1xuICAgIH07XG5cbiAgICAvLyBzZXR0ZXJcbiAgICBpZiAoIXByb3BlcnR5LnJlYWRvbmx5KSB7XG4gICAgICAgIG9wdGlvbnMuc2V0ID0gZnVuY3Rpb24gKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmFbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FtZXJhQ29tcG9uZW50LnByb3RvdHlwZSwgbmFtZSwgb3B0aW9ucyk7XG59KTtcblxuZXhwb3J0IHsgQ2FtZXJhQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsicHJvcGVydGllcyIsIm5hbWUiLCJyZWFkb25seSIsIkNhbWVyYUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5Iiwib25Qb3N0cHJvY2Vzc2luZyIsIm9uUHJlUmVuZGVyIiwib25Qb3N0UmVuZGVyIiwiX3JlbmRlclNjZW5lRGVwdGhNYXAiLCJfcmVuZGVyU2NlbmVDb2xvck1hcCIsIl9jYW1lcmEiLCJDYW1lcmEiLCJub2RlIiwiX3ByaW9yaXR5IiwiX2Rpc2FibGVQb3N0RWZmZWN0c0xheWVyIiwiTEFZRVJJRF9VSSIsIl9wb3N0RWZmZWN0cyIsIlBvc3RFZmZlY3RRdWV1ZSIsImFwcCIsIl9zY2VuZURlcHRoTWFwUmVxdWVzdGVkIiwiX3NjZW5lQ29sb3JNYXBSZXF1ZXN0ZWQiLCJjYW1lcmEiLCJjbGVhckNvbG9yQnVmZmVyIiwidmFsdWUiLCJkaXJ0eUxheWVyQ29tcG9zaXRpb25DYW1lcmFzIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsImRpc2FibGVQb3N0RWZmZWN0c0xheWVyIiwibGF5ZXIiLCJfZW5hYmxlRGVwdGhMYXllciIsImhhc0RlcHRoTGF5ZXIiLCJsYXllcnMiLCJmaW5kIiwibGF5ZXJJZCIsIkxBWUVSSURfREVQVEgiLCJkZXB0aExheWVyIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJpbmNyZW1lbnRDb3VudGVyIiwiZGVjcmVtZW50Q291bnRlciIsInJlcXVlc3RTY2VuZUNvbG9yTWFwIiwiZW5hYmxlZCIsIkRlYnVnIiwiYXNzZXJ0Iiwib2siLCJ3YXJuT25jZSIsInJlbmRlclNjZW5lQ29sb3JNYXAiLCJyZXF1ZXN0U2NlbmVEZXB0aE1hcCIsInJlbmRlclNjZW5lRGVwdGhNYXAiLCJmcnVzdHVtIiwibmV3VmFsdWUiLCJpIiwibGVuZ3RoIiwicmVtb3ZlQ2FtZXJhIiwiYWRkQ2FtZXJhIiwibGF5ZXJzU2V0IiwicG9zdEVmZmVjdHNFbmFibGVkIiwicG9zdEVmZmVjdHMiLCJwcmlvcml0eSIsInByb2plY3Rpb25NYXRyaXgiLCJhcGVydHVyZSIsInNlbnNpdGl2aXR5Iiwic2h1dHRlciIsInJlY3QiLCJmaXJlIiwicmVuZGVyVGFyZ2V0Iiwidmlld01hdHJpeCIsImxheWVyQ29tcCIsIl9kaXJ0eUNhbWVyYXMiLCJzY3JlZW5Ub1dvcmxkIiwic2NyZWVueCIsInNjcmVlbnkiLCJjYW1lcmF6Iiwid29ybGRDb29yZCIsImRldmljZSIsImdyYXBoaWNzRGV2aWNlIiwidyIsImNsaWVudFJlY3QiLCJ3aWR0aCIsImgiLCJoZWlnaHQiLCJ3b3JsZFRvU2NyZWVuIiwic2NyZWVuQ29vcmQiLCJvbkFwcFByZXJlbmRlciIsIl92aWV3TWF0RGlydHkiLCJfdmlld1Byb2pNYXREaXJ0eSIsImFkZENhbWVyYVRvTGF5ZXJzIiwicmVtb3ZlQ2FtZXJhRnJvbUxheWVycyIsIm9uTGF5ZXJzQ2hhbmdlZCIsIm9sZENvbXAiLCJuZXdDb21wIiwib2ZmIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJvbiIsImluZGV4IiwiaW5kZXhPZiIsImlkIiwib25FbmFibGUiLCJlbmFibGUiLCJvbkRpc2FibGUiLCJkaXNhYmxlIiwib25SZW1vdmUiLCJjYWxjdWxhdGVBc3BlY3RSYXRpbyIsInJ0IiwieiIsImZyYW1lVXBkYXRlIiwiYXNwZWN0UmF0aW9Nb2RlIiwiQVNQRUNUX0FVVE8iLCJhc3BlY3RSYXRpbyIsInN0YXJ0WHIiLCJ0eXBlIiwic3BhY2VUeXBlIiwib3B0aW9ucyIsInhyIiwic3RhcnQiLCJlbmRYciIsImNhbGxiYWNrIiwiRXJyb3IiLCJlbmQiLCJjb3B5Iiwic291cmNlIiwiZm9yRWFjaCIsInByb3BlcnR5IiwiZ2V0Iiwic2V0IiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBUUE7QUFDQSxNQUFNQSxVQUFVLEdBQUcsQ0FDZjtBQUFFQyxFQUFBQSxJQUFJLEVBQUUsYUFBYTtBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDeEM7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLGlCQUFpQjtBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDNUM7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLHFCQUFxQjtBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDaEQ7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLG9CQUFvQjtBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDL0M7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLFlBQVk7QUFBRUMsRUFBQUEsUUFBUSxFQUFFLEtBQUE7QUFBTSxDQUFDLEVBQ3ZDO0FBQUVELEVBQUFBLElBQUksRUFBRSxXQUFXO0FBQUVDLEVBQUFBLFFBQVEsRUFBRSxLQUFBO0FBQU0sQ0FBQyxFQUN0QztBQUFFRCxFQUFBQSxJQUFJLEVBQUUsU0FBUztBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDcEM7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLFdBQVc7QUFBRUMsRUFBQUEsUUFBUSxFQUFFLEtBQUE7QUFBTSxDQUFDLEVBQ3RDO0FBQUVELEVBQUFBLElBQUksRUFBRSxLQUFLO0FBQUVDLEVBQUFBLFFBQVEsRUFBRSxLQUFBO0FBQU0sQ0FBQyxFQUNoQztBQUFFRCxFQUFBQSxJQUFJLEVBQUUsZ0JBQWdCO0FBQUVDLEVBQUFBLFFBQVEsRUFBRSxLQUFBO0FBQU0sQ0FBQyxFQUMzQztBQUFFRCxFQUFBQSxJQUFJLEVBQUUsZUFBZTtBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDMUM7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLFVBQVU7QUFBRUMsRUFBQUEsUUFBUSxFQUFFLEtBQUE7QUFBTSxDQUFDLEVBQ3JDO0FBQUVELEVBQUFBLElBQUksRUFBRSxhQUFhO0FBQUVDLEVBQUFBLFFBQVEsRUFBRSxLQUFBO0FBQU0sQ0FBQyxFQUN4QztBQUFFRCxFQUFBQSxJQUFJLEVBQUUsWUFBWTtBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDdkM7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLGFBQWE7QUFBRUMsRUFBQUEsUUFBUSxFQUFFLEtBQUE7QUFBTSxDQUFDLEVBQ3hDO0FBQUVELEVBQUFBLElBQUksRUFBRSxVQUFVO0FBQUVDLEVBQUFBLFFBQVEsRUFBRSxLQUFBO0FBQU0sQ0FBQyxFQUNyQztBQUFFRCxFQUFBQSxJQUFJLEVBQUUsU0FBUztBQUFFQyxFQUFBQSxRQUFRLEVBQUUsS0FBQTtBQUFNLENBQUMsRUFDcEM7QUFBRUQsRUFBQUEsSUFBSSxFQUFFLGFBQWE7QUFBRUMsRUFBQUEsUUFBUSxFQUFFLEtBQUE7QUFBTSxDQUFDLENBQzNDLENBQUE7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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
