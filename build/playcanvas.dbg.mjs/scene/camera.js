/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { math } from '../core/math/math.js';
import { Frustum } from '../core/shape/frustum.js';
import { ASPECT_AUTO, LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE, PROJECTION_PERSPECTIVE } from './constants.js';

// pre-allocated temp variables
const _deviceCoord = new Vec3();
const _halfSize = new Vec3();
const _point = new Vec3();
const _invViewProjMat = new Mat4();
const _frustumPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];

/**
 * A camera.
 *
 * @ignore
 */
class Camera {
  constructor() {
    this._aspectRatio = 16 / 9;
    this._aspectRatioMode = ASPECT_AUTO;
    this._calculateProjection = null;
    this._calculateTransform = null;
    this._clearColor = new Color(0.75, 0.75, 0.75, 1);
    this._clearColorBuffer = true;
    this._clearDepth = 1;
    this._clearDepthBuffer = true;
    this._clearStencil = 0;
    this._clearStencilBuffer = true;
    this._cullingMask = 0xFFFFFFFF;
    this._cullFaces = true;
    this._farClip = 1000;
    this._flipFaces = false;
    this._fov = 45;
    this._frustumCulling = true;
    this._horizontalFov = false;
    this._layers = [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE];
    this._layersSet = new Set(this._layers);
    this._nearClip = 0.1;
    this._node = null;
    this._orthoHeight = 10;
    this._projection = PROJECTION_PERSPECTIVE;
    this._rect = new Vec4(0, 0, 1, 1);
    this._renderTarget = null;
    this._scissorRect = new Vec4(0, 0, 1, 1);
    this._scissorRectClear = false; // by default rect is used when clearing. this allows scissorRect to be used when clearing.
    this._aperture = 16.0;
    this._shutter = 1.0 / 1000.0;
    this._sensitivity = 1000;
    this._projMat = new Mat4();
    this._projMatDirty = true;
    this._projMatSkybox = new Mat4(); // projection matrix used by skybox rendering shader is always perspective
    this._viewMat = new Mat4();
    this._viewMatDirty = true;
    this._viewProjMat = new Mat4();
    this._viewProjMatDirty = true;
    this.frustum = new Frustum();

    // Set by XrManager
    this._xr = null;
    this._xrProperties = {
      horizontalFov: this._horizontalFov,
      fov: this._fov,
      aspectRatio: this._aspectRatio,
      farClip: this._farClip,
      nearClip: this._nearClip
    };
  }

  /**
   * True if the camera clears the full render target. (viewport / scissor are full size)
   */
  get fullSizeClearRect() {
    const rect = this._scissorRectClear ? this.scissorRect : this._rect;
    return rect.x === 0 && rect.y === 0 && rect.z === 1 && rect.w === 1;
  }
  set aspectRatio(newValue) {
    if (this._aspectRatio !== newValue) {
      this._aspectRatio = newValue;
      this._projMatDirty = true;
    }
  }
  get aspectRatio() {
    var _this$xr;
    return (_this$xr = this.xr) != null && _this$xr.active ? this._xrProperties.aspectRatio : this._aspectRatio;
  }
  set aspectRatioMode(newValue) {
    if (this._aspectRatioMode !== newValue) {
      this._aspectRatioMode = newValue;
      this._projMatDirty = true;
    }
  }
  get aspectRatioMode() {
    return this._aspectRatioMode;
  }
  set calculateProjection(newValue) {
    this._calculateProjection = newValue;
    this._projMatDirty = true;
  }
  get calculateProjection() {
    return this._calculateProjection;
  }
  set calculateTransform(newValue) {
    this._calculateTransform = newValue;
  }
  get calculateTransform() {
    return this._calculateTransform;
  }
  set clearColor(newValue) {
    this._clearColor.copy(newValue);
  }
  get clearColor() {
    return this._clearColor;
  }
  set clearColorBuffer(newValue) {
    this._clearColorBuffer = newValue;
  }
  get clearColorBuffer() {
    return this._clearColorBuffer;
  }
  set clearDepth(newValue) {
    this._clearDepth = newValue;
  }
  get clearDepth() {
    return this._clearDepth;
  }
  set clearDepthBuffer(newValue) {
    this._clearDepthBuffer = newValue;
  }
  get clearDepthBuffer() {
    return this._clearDepthBuffer;
  }
  set clearStencil(newValue) {
    this._clearStencil = newValue;
  }
  get clearStencil() {
    return this._clearStencil;
  }
  set clearStencilBuffer(newValue) {
    this._clearStencilBuffer = newValue;
  }
  get clearStencilBuffer() {
    return this._clearStencilBuffer;
  }
  set cullingMask(newValue) {
    this._cullingMask = newValue;
  }
  get cullingMask() {
    return this._cullingMask;
  }
  set cullFaces(newValue) {
    this._cullFaces = newValue;
  }
  get cullFaces() {
    return this._cullFaces;
  }
  set farClip(newValue) {
    if (this._farClip !== newValue) {
      this._farClip = newValue;
      this._projMatDirty = true;
    }
  }
  get farClip() {
    var _this$xr2;
    return (_this$xr2 = this.xr) != null && _this$xr2.active ? this._xrProperties.farClip : this._farClip;
  }
  set flipFaces(newValue) {
    this._flipFaces = newValue;
  }
  get flipFaces() {
    return this._flipFaces;
  }
  set fov(newValue) {
    if (this._fov !== newValue) {
      this._fov = newValue;
      this._projMatDirty = true;
    }
  }
  get fov() {
    var _this$xr3;
    return (_this$xr3 = this.xr) != null && _this$xr3.active ? this._xrProperties.fov : this._fov;
  }
  set frustumCulling(newValue) {
    this._frustumCulling = newValue;
  }
  get frustumCulling() {
    return this._frustumCulling;
  }
  set horizontalFov(newValue) {
    if (this._horizontalFov !== newValue) {
      this._horizontalFov = newValue;
      this._projMatDirty = true;
    }
  }
  get horizontalFov() {
    var _this$xr4;
    return (_this$xr4 = this.xr) != null && _this$xr4.active ? this._xrProperties.horizontalFov : this._horizontalFov;
  }
  set layers(newValue) {
    this._layers = newValue.slice(0);
    this._layersSet = new Set(this._layers);
  }
  get layers() {
    return this._layers;
  }
  get layersSet() {
    return this._layersSet;
  }
  set nearClip(newValue) {
    if (this._nearClip !== newValue) {
      this._nearClip = newValue;
      this._projMatDirty = true;
    }
  }
  get nearClip() {
    var _this$xr5;
    return (_this$xr5 = this.xr) != null && _this$xr5.active ? this._xrProperties.nearClip : this._nearClip;
  }
  set node(newValue) {
    this._node = newValue;
  }
  get node() {
    return this._node;
  }
  set orthoHeight(newValue) {
    if (this._orthoHeight !== newValue) {
      this._orthoHeight = newValue;
      this._projMatDirty = true;
    }
  }
  get orthoHeight() {
    return this._orthoHeight;
  }
  set projection(newValue) {
    if (this._projection !== newValue) {
      this._projection = newValue;
      this._projMatDirty = true;
    }
  }
  get projection() {
    return this._projection;
  }
  get projectionMatrix() {
    this._evaluateProjectionMatrix();
    return this._projMat;
  }
  set rect(newValue) {
    this._rect.copy(newValue);
  }
  get rect() {
    return this._rect;
  }
  set renderTarget(newValue) {
    this._renderTarget = newValue;
  }
  get renderTarget() {
    return this._renderTarget;
  }
  set scissorRect(newValue) {
    this._scissorRect.copy(newValue);
  }
  get scissorRect() {
    return this._scissorRect;
  }
  get viewMatrix() {
    if (this._viewMatDirty) {
      const wtm = this._node.getWorldTransform();
      this._viewMat.copy(wtm).invert();
      this._viewMatDirty = false;
    }
    return this._viewMat;
  }
  set aperture(newValue) {
    this._aperture = newValue;
  }
  get aperture() {
    return this._aperture;
  }
  set sensitivity(newValue) {
    this._sensitivity = newValue;
  }
  get sensitivity() {
    return this._sensitivity;
  }
  set shutter(newValue) {
    this._shutter = newValue;
  }
  get shutter() {
    return this._shutter;
  }
  set xr(newValue) {
    if (this._xr !== newValue) {
      this._xr = newValue;
      this._projMatDirty = true;
    }
  }
  get xr() {
    return this._xr;
  }

  /**
   * Creates a duplicate of the camera.
   *
   * @returns {Camera} A cloned Camera.
   */
  clone() {
    return new Camera().copy(this);
  }

  /**
   * Copies one camera to another.
   *
   * @param {Camera} other - Camera to copy.
   * @returns {Camera} Self for chaining.
   */
  copy(other) {
    // We aren't using the getters and setters because there is additional logic
    // around using WebXR in the getters for these properties so that functions
    // like screenToWorld work correctly with other systems like the UI input
    // system
    this._aspectRatio = other._aspectRatio;
    this._farClip = other._farClip;
    this._fov = other._fov;
    this._horizontalFov = other._horizontalFov;
    this._nearClip = other._nearClip;
    this._xrProperties.aspectRatio = other._xrProperties.aspectRatio;
    this._xrProperties.farClip = other._xrProperties.farClip;
    this._xrProperties.fov = other._xrProperties.fov;
    this._xrProperties.horizontalFov = other._xrProperties.horizontalFov;
    this._xrProperties.nearClip = other._xrProperties.nearClip;
    this.aspectRatioMode = other.aspectRatioMode;
    this.calculateProjection = other.calculateProjection;
    this.calculateTransform = other.calculateTransform;
    this.clearColor = other.clearColor;
    this.clearColorBuffer = other.clearColorBuffer;
    this.clearDepth = other.clearDepth;
    this.clearDepthBuffer = other.clearDepthBuffer;
    this.clearStencil = other.clearStencil;
    this.clearStencilBuffer = other.clearStencilBuffer;
    this.cullFaces = other.cullFaces;
    this.cullingMask = other.cullingMask;
    this.flipFaces = other.flipFaces;
    this.frustumCulling = other.frustumCulling;
    this.layers = other.layers;
    this.orthoHeight = other.orthoHeight;
    this.projection = other.projection;
    this.rect = other.rect;
    this.renderTarget = other.renderTarget;
    this.scissorRect = other.scissorRect;
    this.aperture = other.aperture;
    this.shutter = other.shutter;
    this.sensitivity = other.sensitivity;
    this._projMatDirty = true;
    return this;
  }
  _updateViewProjMat() {
    if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
      this._viewProjMat.mul2(this.projectionMatrix, this.viewMatrix);
      this._viewProjMatDirty = false;
    }
  }

  /**
   * Convert a point from 3D world space to 2D canvas pixel space.
   *
   * @param {Vec3} worldCoord - The world space coordinate to transform.
   * @param {number} cw - The width of PlayCanvas' canvas element.
   * @param {number} ch - The height of PlayCanvas' canvas element.
   * @param {Vec3} [screenCoord] - 3D vector to receive screen coordinate result.
   * @returns {Vec3} The screen space coordinate.
   */
  worldToScreen(worldCoord, cw, ch, screenCoord = new Vec3()) {
    this._updateViewProjMat();
    this._viewProjMat.transformPoint(worldCoord, screenCoord);

    // calculate w co-coord
    const vpm = this._viewProjMat.data;
    const w = worldCoord.x * vpm[3] + worldCoord.y * vpm[7] + worldCoord.z * vpm[11] + 1 * vpm[15];
    screenCoord.x = (screenCoord.x / w + 1) * 0.5 * cw;
    screenCoord.y = (1 - screenCoord.y / w) * 0.5 * ch;
    return screenCoord;
  }

  /**
   * Convert a point from 2D canvas pixel space to 3D world space.
   *
   * @param {number} x - X coordinate on PlayCanvas' canvas element.
   * @param {number} y - Y coordinate on PlayCanvas' canvas element.
   * @param {number} z - The distance from the camera in world space to create the new point.
   * @param {number} cw - The width of PlayCanvas' canvas element.
   * @param {number} ch - The height of PlayCanvas' canvas element.
   * @param {Vec3} [worldCoord] - 3D vector to receive world coordinate result.
   * @returns {Vec3} The world space coordinate.
   */
  screenToWorld(x, y, z, cw, ch, worldCoord = new Vec3()) {
    // Calculate the screen click as a point on the far plane of the normalized device coordinate 'box' (z=1)
    const range = this.farClip - this.nearClip;
    _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
    _deviceCoord.mulScalar(2);
    _deviceCoord.sub(Vec3.ONE);
    if (this._projection === PROJECTION_PERSPECTIVE) {
      // calculate half width and height at the near clip plane
      Mat4._getPerspectiveHalfSize(_halfSize, this.fov, this.aspectRatio, this.nearClip, this.horizontalFov);

      // scale by normalized screen coordinates
      _halfSize.x *= _deviceCoord.x;
      _halfSize.y *= _deviceCoord.y;

      // transform to world space
      const invView = this._node.getWorldTransform();
      _halfSize.z = -this.nearClip;
      invView.transformPoint(_halfSize, _point);

      // point along camera->_point ray at distance z from the camera
      const cameraPos = this._node.getPosition();
      worldCoord.sub2(_point, cameraPos);
      worldCoord.normalize();
      worldCoord.mulScalar(z);
      worldCoord.add(cameraPos);
    } else {
      this._updateViewProjMat();
      _invViewProjMat.copy(this._viewProjMat).invert();

      // Transform to world space
      _invViewProjMat.transformPoint(_deviceCoord, worldCoord);
    }
    return worldCoord;
  }
  _evaluateProjectionMatrix() {
    if (this._projMatDirty) {
      if (this._projection === PROJECTION_PERSPECTIVE) {
        this._projMat.setPerspective(this.fov, this.aspectRatio, this.nearClip, this.farClip, this.horizontalFov);
        this._projMatSkybox.copy(this._projMat);
      } else {
        const y = this._orthoHeight;
        const x = y * this.aspectRatio;
        this._projMat.setOrtho(-x, x, -y, y, this.nearClip, this.farClip);
        this._projMatSkybox.setPerspective(this.fov, this.aspectRatio, this.nearClip, this.farClip);
      }
      this._projMatDirty = false;
    }
  }
  getProjectionMatrixSkybox() {
    this._evaluateProjectionMatrix();
    return this._projMatSkybox;
  }
  getExposure() {
    const ev100 = Math.log2(this._aperture * this._aperture / this._shutter * 100.0 / this._sensitivity);
    return 1.0 / (Math.pow(2.0, ev100) * 1.2);
  }

  // returns estimated size of the sphere on the screen in range of [0..1]
  // 0 - infinitely small, 1 - full screen or larger
  getScreenSize(sphere) {
    if (this._projection === PROJECTION_PERSPECTIVE) {
      // camera to sphere distance
      const distance = this._node.getPosition().distance(sphere.center);

      // if we're inside the sphere
      if (distance < sphere.radius) {
        return 1;
      }

      // The view-angle of the bounding sphere rendered on screen
      const viewAngle = Math.asin(sphere.radius / distance);

      // This assumes the near clipping plane is at a distance of 1
      const sphereViewHeight = Math.tan(viewAngle);

      // The size of (half) the screen if the near clipping plane is at a distance of 1
      const screenViewHeight = Math.tan(this.fov / 2 * math.DEG_TO_RAD);

      // The ratio of the geometry's screen size compared to the actual size of the screen
      return Math.min(sphereViewHeight / screenViewHeight, 1);
    }

    // ortho
    return math.clamp(sphere.radius / this._orthoHeight, 0, 1);
  }

  /**
   * Returns an array of corners of the frustum of the camera in the local coordinate system of the camera.
   *
   * @param {number} [near] - Near distance for the frustum points. Defaults to the near clip distance of the camera.
   * @param {number} [far] - Far distance for the frustum points. Defaults to the far clip distance of the camera.
   * @returns {Vec3[]} - An array of corners, using a global storage space.
   */
  getFrustumCorners(near = this.nearClip, far = this.farClip) {
    const fov = this.fov * Math.PI / 180.0;
    let y = this._projection === PROJECTION_PERSPECTIVE ? Math.tan(fov / 2.0) * near : this._orthoHeight;
    let x = y * this.aspectRatio;
    const points = _frustumPoints;
    points[0].x = x;
    points[0].y = -y;
    points[0].z = -near;
    points[1].x = x;
    points[1].y = y;
    points[1].z = -near;
    points[2].x = -x;
    points[2].y = y;
    points[2].z = -near;
    points[3].x = -x;
    points[3].y = -y;
    points[3].z = -near;
    if (this._projection === PROJECTION_PERSPECTIVE) {
      y = Math.tan(fov / 2.0) * far;
      x = y * this.aspectRatio;
    }
    points[4].x = x;
    points[4].y = -y;
    points[4].z = -far;
    points[5].x = x;
    points[5].y = y;
    points[5].z = -far;
    points[6].x = -x;
    points[6].y = y;
    points[6].z = -far;
    points[7].x = -x;
    points[7].y = -y;
    points[7].z = -far;
    return points;
  }

  /**
   * Sets XR camera properties that should be derived physical camera in {@link XrManager}.
   *
   * @param {object} [properties] - Properties object.
   * @param {number} [properties.aspectRatio] - Aspect ratio.
   * @param {number} [properties.farClip] - Far clip.
   * @param {number} [properties.fov] - Field of view.
   * @param {boolean} [properties.horizontalFov] - Enable horizontal field of view.
   * @param {number} [properties.nearClip] - Near clip.
   */
  setXrProperties(properties) {
    Object.assign(properties, this._xrProperties);
    this._projMatDirty = true;
  }
}

export { Camera };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FtZXJhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvY2FtZXJhLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IEZydXN0dW0gfSBmcm9tICcuLi9jb3JlL3NoYXBlL2ZydXN0dW0uanMnO1xuXG5pbXBvcnQge1xuICAgIEFTUEVDVF9BVVRPLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIExBWUVSSURfV09STEQsIExBWUVSSURfREVQVEgsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX0lNTUVESUFURVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8vIHByZS1hbGxvY2F0ZWQgdGVtcCB2YXJpYWJsZXNcbmNvbnN0IF9kZXZpY2VDb29yZCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfaGFsZlNpemUgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BvaW50ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9pbnZWaWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfZnJ1c3R1bVBvaW50cyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcblxuLyoqXG4gKiBBIGNhbWVyYS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIENhbWVyYSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuX2FzcGVjdFJhdGlvID0gMTYgLyA5O1xuICAgICAgICB0aGlzLl9hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfQVVUTztcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlUHJvamVjdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVRyYW5zZm9ybSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMC43NSwgMC43NSwgMC43NSwgMSk7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXIgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoID0gMTtcbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbCA9IDA7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2N1bGxpbmdNYXNrID0gMHhGRkZGRkZGRjtcbiAgICAgICAgdGhpcy5fY3VsbEZhY2VzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZmFyQ2xpcCA9IDEwMDA7XG4gICAgICAgIHRoaXMuX2ZsaXBGYWNlcyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9mb3YgPSA0NTtcbiAgICAgICAgdGhpcy5fZnJ1c3R1bUN1bGxpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9ob3Jpem9udGFsRm92ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1dPUkxELCBMQVlFUklEX0RFUFRILCBMQVlFUklEX1NLWUJPWCwgTEFZRVJJRF9VSSwgTEFZRVJJRF9JTU1FRElBVEVdO1xuICAgICAgICB0aGlzLl9sYXllcnNTZXQgPSBuZXcgU2V0KHRoaXMuX2xheWVycyk7XG4gICAgICAgIHRoaXMuX25lYXJDbGlwID0gMC4xO1xuICAgICAgICB0aGlzLl9ub2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fb3J0aG9IZWlnaHQgPSAxMDtcbiAgICAgICAgdGhpcy5fcHJvamVjdGlvbiA9IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgICAgIHRoaXMuX3JlY3QgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2Npc3NvclJlY3QgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fc2Npc3NvclJlY3RDbGVhciA9IGZhbHNlOyAvLyBieSBkZWZhdWx0IHJlY3QgaXMgdXNlZCB3aGVuIGNsZWFyaW5nLiB0aGlzIGFsbG93cyBzY2lzc29yUmVjdCB0byBiZSB1c2VkIHdoZW4gY2xlYXJpbmcuXG4gICAgICAgIHRoaXMuX2FwZXJ0dXJlID0gMTYuMDtcbiAgICAgICAgdGhpcy5fc2h1dHRlciA9IDEuMCAvIDEwMDAuMDtcbiAgICAgICAgdGhpcy5fc2Vuc2l0aXZpdHkgPSAxMDAwO1xuXG4gICAgICAgIHRoaXMuX3Byb2pNYXQgPSBuZXcgTWF0NCgpO1xuICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9wcm9qTWF0U2t5Ym94ID0gbmV3IE1hdDQoKTsgLy8gcHJvamVjdGlvbiBtYXRyaXggdXNlZCBieSBza3lib3ggcmVuZGVyaW5nIHNoYWRlciBpcyBhbHdheXMgcGVyc3BlY3RpdmVcbiAgICAgICAgdGhpcy5fdmlld01hdCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIHRoaXMuX3ZpZXdNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3ZpZXdQcm9qTWF0ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgdGhpcy5fdmlld1Byb2pNYXREaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5mcnVzdHVtID0gbmV3IEZydXN0dW0oKTtcblxuICAgICAgICAvLyBTZXQgYnkgWHJNYW5hZ2VyXG4gICAgICAgIHRoaXMuX3hyID0gbnVsbDtcbiAgICAgICAgdGhpcy5feHJQcm9wZXJ0aWVzID0ge1xuICAgICAgICAgICAgaG9yaXpvbnRhbEZvdjogdGhpcy5faG9yaXpvbnRhbEZvdixcbiAgICAgICAgICAgIGZvdjogdGhpcy5fZm92LFxuICAgICAgICAgICAgYXNwZWN0UmF0aW86IHRoaXMuX2FzcGVjdFJhdGlvLFxuICAgICAgICAgICAgZmFyQ2xpcDogdGhpcy5fZmFyQ2xpcCxcbiAgICAgICAgICAgIG5lYXJDbGlwOiB0aGlzLl9uZWFyQ2xpcFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGNhbWVyYSBjbGVhcnMgdGhlIGZ1bGwgcmVuZGVyIHRhcmdldC4gKHZpZXdwb3J0IC8gc2Npc3NvciBhcmUgZnVsbCBzaXplKVxuICAgICAqL1xuICAgIGdldCBmdWxsU2l6ZUNsZWFyUmVjdCgpIHtcbiAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuX3NjaXNzb3JSZWN0Q2xlYXIgPyB0aGlzLnNjaXNzb3JSZWN0IDogdGhpcy5fcmVjdDtcbiAgICAgICAgcmV0dXJuIHJlY3QueCA9PT0gMCAmJiByZWN0LnkgPT09IDAgJiYgcmVjdC56ID09PSAxICYmIHJlY3QudyA9PT0gMTtcbiAgICB9XG5cbiAgICBzZXQgYXNwZWN0UmF0aW8obmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FzcGVjdFJhdGlvICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYXNwZWN0UmF0aW8gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXNwZWN0UmF0aW8oKSB7XG4gICAgICAgIHJldHVybiAodGhpcy54cj8uYWN0aXZlKSA/IHRoaXMuX3hyUHJvcGVydGllcy5hc3BlY3RSYXRpbyA6IHRoaXMuX2FzcGVjdFJhdGlvO1xuICAgIH1cblxuICAgIHNldCBhc3BlY3RSYXRpb01vZGUobmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FzcGVjdFJhdGlvTW9kZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2FzcGVjdFJhdGlvTW9kZSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhc3BlY3RSYXRpb01vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3BlY3RSYXRpb01vZGU7XG4gICAgfVxuXG4gICAgc2V0IGNhbGN1bGF0ZVByb2plY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlUHJvamVjdGlvbiA9IG5ld1ZhbHVlO1xuICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVQcm9qZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlUHJvamVjdGlvbjtcbiAgICB9XG5cbiAgICBzZXQgY2FsY3VsYXRlVHJhbnNmb3JtKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVRyYW5zZm9ybSA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVUcmFuc2Zvcm0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWxjdWxhdGVUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyQ29sb3IobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvci5jb3B5KG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJDb2xvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyQ29sb3I7XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyQ29sb3JCdWZmZXIobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvckJ1ZmZlciA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckNvbG9yQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJEZXB0aChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyRGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckRlcHRoO1xuICAgIH1cblxuICAgIHNldCBjbGVhckRlcHRoQnVmZmVyKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGhCdWZmZXIgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJEZXB0aEJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyRGVwdGhCdWZmZXI7XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyU3RlbmNpbChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhclN0ZW5jaWwgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJTdGVuY2lsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJTdGVuY2lsO1xuICAgIH1cblxuICAgIHNldCBjbGVhclN0ZW5jaWxCdWZmZXIobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlcjtcbiAgICB9XG5cbiAgICBzZXQgY3VsbGluZ01hc2sobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VsbGluZ01hc2sgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY3VsbGluZ01hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdWxsaW5nTWFzaztcbiAgICB9XG5cbiAgICBzZXQgY3VsbEZhY2VzKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1bGxGYWNlcyA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjdWxsRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdWxsRmFjZXM7XG4gICAgfVxuXG4gICAgc2V0IGZhckNsaXAobmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZhckNsaXAgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9mYXJDbGlwID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZhckNsaXAoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy54cj8uYWN0aXZlKSA/IHRoaXMuX3hyUHJvcGVydGllcy5mYXJDbGlwIDogdGhpcy5fZmFyQ2xpcDtcbiAgICB9XG5cbiAgICBzZXQgZmxpcEZhY2VzKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2ZsaXBGYWNlcyA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmbGlwRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwRmFjZXM7XG4gICAgfVxuXG4gICAgc2V0IGZvdihuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZm92ICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZm92ID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZvdigpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLnhyPy5hY3RpdmUpID8gdGhpcy5feHJQcm9wZXJ0aWVzLmZvdiA6IHRoaXMuX2ZvdjtcbiAgICB9XG5cbiAgICBzZXQgZnJ1c3R1bUN1bGxpbmcobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZnJ1c3R1bUN1bGxpbmcgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZnJ1c3R1bUN1bGxpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mcnVzdHVtQ3VsbGluZztcbiAgICB9XG5cbiAgICBzZXQgaG9yaXpvbnRhbEZvdihuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faG9yaXpvbnRhbEZvdiAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2hvcml6b250YWxGb3YgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaG9yaXpvbnRhbEZvdigpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLnhyPy5hY3RpdmUpID8gdGhpcy5feHJQcm9wZXJ0aWVzLmhvcml6b250YWxGb3YgOiB0aGlzLl9ob3Jpem9udGFsRm92O1xuICAgIH1cblxuICAgIHNldCBsYXllcnMobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gbmV3VmFsdWUuc2xpY2UoMCk7XG4gICAgICAgIHRoaXMuX2xheWVyc1NldCA9IG5ldyBTZXQodGhpcy5fbGF5ZXJzKTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIGdldCBsYXllcnNTZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnNTZXQ7XG4gICAgfVxuXG4gICAgc2V0IG5lYXJDbGlwKG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9uZWFyQ2xpcCAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJDbGlwID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG5lYXJDbGlwKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMueHI/LmFjdGl2ZSkgPyB0aGlzLl94clByb3BlcnRpZXMubmVhckNsaXAgOiB0aGlzLl9uZWFyQ2xpcDtcbiAgICB9XG5cbiAgICBzZXQgbm9kZShuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9ub2RlID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG5vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ub2RlO1xuICAgIH1cblxuICAgIHNldCBvcnRob0hlaWdodChuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fb3J0aG9IZWlnaHQgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9vcnRob0hlaWdodCA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcnRob0hlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29ydGhvSGVpZ2h0O1xuICAgIH1cblxuICAgIHNldCBwcm9qZWN0aW9uKG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcm9qZWN0aW9uICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcHJvamVjdGlvbiA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwcm9qZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJvamVjdGlvbjtcbiAgICB9XG5cbiAgICBnZXQgcHJvamVjdGlvbk1hdHJpeCgpIHtcbiAgICAgICAgdGhpcy5fZXZhbHVhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9qTWF0O1xuICAgIH1cblxuICAgIHNldCByZWN0KG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlY3QuY29weShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWN0O1xuICAgIH1cblxuICAgIHNldCByZW5kZXJUYXJnZXQobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0ID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclRhcmdldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICBzZXQgc2Npc3NvclJlY3QobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2Npc3NvclJlY3QuY29weShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHNjaXNzb3JSZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2Npc3NvclJlY3Q7XG4gICAgfVxuXG4gICAgZ2V0IHZpZXdNYXRyaXgoKSB7XG4gICAgICAgIGlmICh0aGlzLl92aWV3TWF0RGlydHkpIHtcbiAgICAgICAgICAgIGNvbnN0IHd0bSA9IHRoaXMuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIHRoaXMuX3ZpZXdNYXQuY29weSh3dG0pLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5fdmlld01hdERpcnR5ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZpZXdNYXQ7XG4gICAgfVxuXG4gICAgc2V0IGFwZXJ0dXJlKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FwZXJ0dXJlID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFwZXJ0dXJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXBlcnR1cmU7XG4gICAgfVxuXG4gICAgc2V0IHNlbnNpdGl2aXR5KG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NlbnNpdGl2aXR5ID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNlbnNpdGl2aXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2Vuc2l0aXZpdHk7XG4gICAgfVxuXG4gICAgc2V0IHNodXR0ZXIobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2h1dHRlciA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzaHV0dGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2h1dHRlcjtcbiAgICB9XG5cbiAgICBzZXQgeHIobmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3hyICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5feHIgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgeHIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZHVwbGljYXRlIG9mIHRoZSBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Q2FtZXJhfSBBIGNsb25lZCBDYW1lcmEuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgQ2FtZXJhKCkuY29weSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgb25lIGNhbWVyYSB0byBhbm90aGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDYW1lcmF9IG90aGVyIC0gQ2FtZXJhIHRvIGNvcHkuXG4gICAgICogQHJldHVybnMge0NhbWVyYX0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY29weShvdGhlcikge1xuICAgICAgICAvLyBXZSBhcmVuJ3QgdXNpbmcgdGhlIGdldHRlcnMgYW5kIHNldHRlcnMgYmVjYXVzZSB0aGVyZSBpcyBhZGRpdGlvbmFsIGxvZ2ljXG4gICAgICAgIC8vIGFyb3VuZCB1c2luZyBXZWJYUiBpbiB0aGUgZ2V0dGVycyBmb3IgdGhlc2UgcHJvcGVydGllcyBzbyB0aGF0IGZ1bmN0aW9uc1xuICAgICAgICAvLyBsaWtlIHNjcmVlblRvV29ybGQgd29yayBjb3JyZWN0bHkgd2l0aCBvdGhlciBzeXN0ZW1zIGxpa2UgdGhlIFVJIGlucHV0XG4gICAgICAgIC8vIHN5c3RlbVxuICAgICAgICB0aGlzLl9hc3BlY3RSYXRpbyA9IG90aGVyLl9hc3BlY3RSYXRpbztcbiAgICAgICAgdGhpcy5fZmFyQ2xpcCA9IG90aGVyLl9mYXJDbGlwO1xuICAgICAgICB0aGlzLl9mb3YgPSBvdGhlci5fZm92O1xuICAgICAgICB0aGlzLl9ob3Jpem9udGFsRm92ID0gb3RoZXIuX2hvcml6b250YWxGb3Y7XG4gICAgICAgIHRoaXMuX25lYXJDbGlwID0gb3RoZXIuX25lYXJDbGlwO1xuXG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcy5hc3BlY3RSYXRpbyA9IG90aGVyLl94clByb3BlcnRpZXMuYXNwZWN0UmF0aW87XG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcy5mYXJDbGlwID0gb3RoZXIuX3hyUHJvcGVydGllcy5mYXJDbGlwO1xuICAgICAgICB0aGlzLl94clByb3BlcnRpZXMuZm92ID0gb3RoZXIuX3hyUHJvcGVydGllcy5mb3Y7XG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcy5ob3Jpem9udGFsRm92ID0gb3RoZXIuX3hyUHJvcGVydGllcy5ob3Jpem9udGFsRm92O1xuICAgICAgICB0aGlzLl94clByb3BlcnRpZXMubmVhckNsaXAgPSBvdGhlci5feHJQcm9wZXJ0aWVzLm5lYXJDbGlwO1xuXG4gICAgICAgIHRoaXMuYXNwZWN0UmF0aW9Nb2RlID0gb3RoZXIuYXNwZWN0UmF0aW9Nb2RlO1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVByb2plY3Rpb24gPSBvdGhlci5jYWxjdWxhdGVQcm9qZWN0aW9uO1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVRyYW5zZm9ybSA9IG90aGVyLmNhbGN1bGF0ZVRyYW5zZm9ybTtcbiAgICAgICAgdGhpcy5jbGVhckNvbG9yID0gb3RoZXIuY2xlYXJDb2xvcjtcbiAgICAgICAgdGhpcy5jbGVhckNvbG9yQnVmZmVyID0gb3RoZXIuY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gb3RoZXIuY2xlYXJEZXB0aDtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoQnVmZmVyID0gb3RoZXIuY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSBvdGhlci5jbGVhclN0ZW5jaWw7XG4gICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsQnVmZmVyID0gb3RoZXIuY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgICAgICB0aGlzLmN1bGxGYWNlcyA9IG90aGVyLmN1bGxGYWNlcztcbiAgICAgICAgdGhpcy5jdWxsaW5nTWFzayA9IG90aGVyLmN1bGxpbmdNYXNrO1xuICAgICAgICB0aGlzLmZsaXBGYWNlcyA9IG90aGVyLmZsaXBGYWNlcztcbiAgICAgICAgdGhpcy5mcnVzdHVtQ3VsbGluZyA9IG90aGVyLmZydXN0dW1DdWxsaW5nO1xuICAgICAgICB0aGlzLmxheWVycyA9IG90aGVyLmxheWVycztcbiAgICAgICAgdGhpcy5vcnRob0hlaWdodCA9IG90aGVyLm9ydGhvSGVpZ2h0O1xuICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBvdGhlci5wcm9qZWN0aW9uO1xuICAgICAgICB0aGlzLnJlY3QgPSBvdGhlci5yZWN0O1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG90aGVyLnJlbmRlclRhcmdldDtcbiAgICAgICAgdGhpcy5zY2lzc29yUmVjdCA9IG90aGVyLnNjaXNzb3JSZWN0O1xuICAgICAgICB0aGlzLmFwZXJ0dXJlID0gb3RoZXIuYXBlcnR1cmU7XG4gICAgICAgIHRoaXMuc2h1dHRlciA9IG90aGVyLnNodXR0ZXI7XG4gICAgICAgIHRoaXMuc2Vuc2l0aXZpdHkgPSBvdGhlci5zZW5zaXRpdml0eTtcblxuICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIF91cGRhdGVWaWV3UHJvak1hdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Byb2pNYXREaXJ0eSB8fCB0aGlzLl92aWV3TWF0RGlydHkgfHwgdGhpcy5fdmlld1Byb2pNYXREaXJ0eSkge1xuICAgICAgICAgICAgdGhpcy5fdmlld1Byb2pNYXQubXVsMih0aGlzLnByb2plY3Rpb25NYXRyaXgsIHRoaXMudmlld01hdHJpeCk7XG4gICAgICAgICAgICB0aGlzLl92aWV3UHJvak1hdERpcnR5ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGEgcG9pbnQgZnJvbSAzRCB3b3JsZCBzcGFjZSB0byAyRCBjYW52YXMgcGl4ZWwgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHdvcmxkQ29vcmQgLSBUaGUgd29ybGQgc3BhY2UgY29vcmRpbmF0ZSB0byB0cmFuc2Zvcm0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGN3IC0gVGhlIHdpZHRoIG9mIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjaCAtIFRoZSBoZWlnaHQgb2YgUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbc2NyZWVuQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmUgc2NyZWVuIGNvb3JkaW5hdGUgcmVzdWx0LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgc2NyZWVuIHNwYWNlIGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgd29ybGRUb1NjcmVlbih3b3JsZENvb3JkLCBjdywgY2gsIHNjcmVlbkNvb3JkID0gbmV3IFZlYzMoKSkge1xuICAgICAgICB0aGlzLl91cGRhdGVWaWV3UHJvak1hdCgpO1xuICAgICAgICB0aGlzLl92aWV3UHJvak1hdC50cmFuc2Zvcm1Qb2ludCh3b3JsZENvb3JkLCBzY3JlZW5Db29yZCk7XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHcgY28tY29vcmRcbiAgICAgICAgY29uc3QgdnBtID0gdGhpcy5fdmlld1Byb2pNYXQuZGF0YTtcbiAgICAgICAgY29uc3QgdyA9IHdvcmxkQ29vcmQueCAqIHZwbVszXSArXG4gICAgICAgICAgICAgICAgd29ybGRDb29yZC55ICogdnBtWzddICtcbiAgICAgICAgICAgICAgICB3b3JsZENvb3JkLnogKiB2cG1bMTFdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIDEgKiB2cG1bMTVdO1xuXG4gICAgICAgIHNjcmVlbkNvb3JkLnggPSAoc2NyZWVuQ29vcmQueCAvIHcgKyAxKSAqIDAuNSAqIGN3O1xuICAgICAgICBzY3JlZW5Db29yZC55ID0gKDEgLSBzY3JlZW5Db29yZC55IC8gdykgKiAwLjUgKiBjaDtcblxuICAgICAgICByZXR1cm4gc2NyZWVuQ29vcmQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gMkQgY2FudmFzIHBpeGVsIHNwYWNlIHRvIDNEIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBYIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBZIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgY2FtZXJhIGluIHdvcmxkIHNwYWNlIHRvIGNyZWF0ZSB0aGUgbmV3IHBvaW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdyAtIFRoZSB3aWR0aCBvZiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2ggLSBUaGUgaGVpZ2h0IG9mIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3dvcmxkQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmUgd29ybGQgY29vcmRpbmF0ZSByZXN1bHQuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBjb29yZGluYXRlLlxuICAgICAqL1xuICAgIHNjcmVlblRvV29ybGQoeCwgeSwgeiwgY3csIGNoLCB3b3JsZENvb3JkID0gbmV3IFZlYzMoKSkge1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgc2NyZWVuIGNsaWNrIGFzIGEgcG9pbnQgb24gdGhlIGZhciBwbGFuZSBvZiB0aGUgbm9ybWFsaXplZCBkZXZpY2UgY29vcmRpbmF0ZSAnYm94JyAoej0xKVxuICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMuZmFyQ2xpcCAtIHRoaXMubmVhckNsaXA7XG4gICAgICAgIF9kZXZpY2VDb29yZC5zZXQoeCAvIGN3LCAoY2ggLSB5KSAvIGNoLCB6IC8gcmFuZ2UpO1xuICAgICAgICBfZGV2aWNlQ29vcmQubXVsU2NhbGFyKDIpO1xuICAgICAgICBfZGV2aWNlQ29vcmQuc3ViKFZlYzMuT05FKTtcblxuICAgICAgICBpZiAodGhpcy5fcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9QRVJTUEVDVElWRSkge1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgaGFsZiB3aWR0aCBhbmQgaGVpZ2h0IGF0IHRoZSBuZWFyIGNsaXAgcGxhbmVcbiAgICAgICAgICAgIE1hdDQuX2dldFBlcnNwZWN0aXZlSGFsZlNpemUoX2hhbGZTaXplLCB0aGlzLmZvdiwgdGhpcy5hc3BlY3RSYXRpbywgdGhpcy5uZWFyQ2xpcCwgdGhpcy5ob3Jpem9udGFsRm92KTtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYnkgbm9ybWFsaXplZCBzY3JlZW4gY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIF9oYWxmU2l6ZS54ICo9IF9kZXZpY2VDb29yZC54O1xuICAgICAgICAgICAgX2hhbGZTaXplLnkgKj0gX2RldmljZUNvb3JkLnk7XG5cbiAgICAgICAgICAgIC8vIHRyYW5zZm9ybSB0byB3b3JsZCBzcGFjZVxuICAgICAgICAgICAgY29uc3QgaW52VmlldyA9IHRoaXMuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIF9oYWxmU2l6ZS56ID0gLXRoaXMubmVhckNsaXA7XG4gICAgICAgICAgICBpbnZWaWV3LnRyYW5zZm9ybVBvaW50KF9oYWxmU2l6ZSwgX3BvaW50KTtcblxuICAgICAgICAgICAgLy8gcG9pbnQgYWxvbmcgY2FtZXJhLT5fcG9pbnQgcmF5IGF0IGRpc3RhbmNlIHogZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFQb3MgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB3b3JsZENvb3JkLnN1YjIoX3BvaW50LCBjYW1lcmFQb3MpO1xuICAgICAgICAgICAgd29ybGRDb29yZC5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHdvcmxkQ29vcmQubXVsU2NhbGFyKHopO1xuICAgICAgICAgICAgd29ybGRDb29yZC5hZGQoY2FtZXJhUG9zKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB0aGlzLl91cGRhdGVWaWV3UHJvak1hdCgpO1xuICAgICAgICAgICAgX2ludlZpZXdQcm9qTWF0LmNvcHkodGhpcy5fdmlld1Byb2pNYXQpLmludmVydCgpO1xuXG4gICAgICAgICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICBfaW52Vmlld1Byb2pNYXQudHJhbnNmb3JtUG9pbnQoX2RldmljZUNvb3JkLCB3b3JsZENvb3JkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB3b3JsZENvb3JkO1xuICAgIH1cblxuICAgIF9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgoKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcm9qTWF0RGlydHkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvak1hdC5zZXRQZXJzcGVjdGl2ZSh0aGlzLmZvdiwgdGhpcy5hc3BlY3RSYXRpbywgdGhpcy5uZWFyQ2xpcCwgdGhpcy5mYXJDbGlwLCB0aGlzLmhvcml6b250YWxGb3YpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Byb2pNYXRTa3lib3guY29weSh0aGlzLl9wcm9qTWF0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IHRoaXMuX29ydGhvSGVpZ2h0O1xuICAgICAgICAgICAgICAgIGNvbnN0IHggPSB5ICogdGhpcy5hc3BlY3RSYXRpbztcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9qTWF0LnNldE9ydGhvKC14LCB4LCAteSwgeSwgdGhpcy5uZWFyQ2xpcCwgdGhpcy5mYXJDbGlwKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9qTWF0U2t5Ym94LnNldFBlcnNwZWN0aXZlKHRoaXMuZm92LCB0aGlzLmFzcGVjdFJhdGlvLCB0aGlzLm5lYXJDbGlwLCB0aGlzLmZhckNsaXApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldFByb2plY3Rpb25NYXRyaXhTa3lib3goKSB7XG4gICAgICAgIHRoaXMuX2V2YWx1YXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJvak1hdFNreWJveDtcbiAgICB9XG5cbiAgICBnZXRFeHBvc3VyZSgpIHtcbiAgICAgICAgY29uc3QgZXYxMDAgPSBNYXRoLmxvZzIoKHRoaXMuX2FwZXJ0dXJlICogdGhpcy5fYXBlcnR1cmUpIC8gdGhpcy5fc2h1dHRlciAqIDEwMC4wIC8gdGhpcy5fc2Vuc2l0aXZpdHkpO1xuICAgICAgICByZXR1cm4gMS4wIC8gKE1hdGgucG93KDIuMCwgZXYxMDApICogMS4yKTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGVzdGltYXRlZCBzaXplIG9mIHRoZSBzcGhlcmUgb24gdGhlIHNjcmVlbiBpbiByYW5nZSBvZiBbMC4uMV1cbiAgICAvLyAwIC0gaW5maW5pdGVseSBzbWFsbCwgMSAtIGZ1bGwgc2NyZWVuIG9yIGxhcmdlclxuICAgIGdldFNjcmVlblNpemUoc3BoZXJlKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpIHtcblxuICAgICAgICAgICAgLy8gY2FtZXJhIHRvIHNwaGVyZSBkaXN0YW5jZVxuICAgICAgICAgICAgY29uc3QgZGlzdGFuY2UgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCkuZGlzdGFuY2Uoc3BoZXJlLmNlbnRlcik7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlJ3JlIGluc2lkZSB0aGUgc3BoZXJlXG4gICAgICAgICAgICBpZiAoZGlzdGFuY2UgPCBzcGhlcmUucmFkaXVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRoZSB2aWV3LWFuZ2xlIG9mIHRoZSBib3VuZGluZyBzcGhlcmUgcmVuZGVyZWQgb24gc2NyZWVuXG4gICAgICAgICAgICBjb25zdCB2aWV3QW5nbGUgPSBNYXRoLmFzaW4oc3BoZXJlLnJhZGl1cyAvIGRpc3RhbmNlKTtcblxuICAgICAgICAgICAgLy8gVGhpcyBhc3N1bWVzIHRoZSBuZWFyIGNsaXBwaW5nIHBsYW5lIGlzIGF0IGEgZGlzdGFuY2Ugb2YgMVxuICAgICAgICAgICAgY29uc3Qgc3BoZXJlVmlld0hlaWdodCA9IE1hdGgudGFuKHZpZXdBbmdsZSk7XG5cbiAgICAgICAgICAgIC8vIFRoZSBzaXplIG9mIChoYWxmKSB0aGUgc2NyZWVuIGlmIHRoZSBuZWFyIGNsaXBwaW5nIHBsYW5lIGlzIGF0IGEgZGlzdGFuY2Ugb2YgMVxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuVmlld0hlaWdodCA9IE1hdGgudGFuKCh0aGlzLmZvdiAvIDIpICogbWF0aC5ERUdfVE9fUkFEKTtcblxuICAgICAgICAgICAgLy8gVGhlIHJhdGlvIG9mIHRoZSBnZW9tZXRyeSdzIHNjcmVlbiBzaXplIGNvbXBhcmVkIHRvIHRoZSBhY3R1YWwgc2l6ZSBvZiB0aGUgc2NyZWVuXG4gICAgICAgICAgICByZXR1cm4gTWF0aC5taW4oc3BoZXJlVmlld0hlaWdodCAvIHNjcmVlblZpZXdIZWlnaHQsIDEpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvLyBvcnRob1xuICAgICAgICByZXR1cm4gbWF0aC5jbGFtcChzcGhlcmUucmFkaXVzIC8gdGhpcy5fb3J0aG9IZWlnaHQsIDAsIDEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gYXJyYXkgb2YgY29ybmVycyBvZiB0aGUgZnJ1c3R1bSBvZiB0aGUgY2FtZXJhIGluIHRoZSBsb2NhbCBjb29yZGluYXRlIHN5c3RlbSBvZiB0aGUgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtuZWFyXSAtIE5lYXIgZGlzdGFuY2UgZm9yIHRoZSBmcnVzdHVtIHBvaW50cy4gRGVmYXVsdHMgdG8gdGhlIG5lYXIgY2xpcCBkaXN0YW5jZSBvZiB0aGUgY2FtZXJhLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZmFyXSAtIEZhciBkaXN0YW5jZSBmb3IgdGhlIGZydXN0dW0gcG9pbnRzLiBEZWZhdWx0cyB0byB0aGUgZmFyIGNsaXAgZGlzdGFuY2Ugb2YgdGhlIGNhbWVyYS5cbiAgICAgKiBAcmV0dXJucyB7VmVjM1tdfSAtIEFuIGFycmF5IG9mIGNvcm5lcnMsIHVzaW5nIGEgZ2xvYmFsIHN0b3JhZ2Ugc3BhY2UuXG4gICAgICovXG4gICAgZ2V0RnJ1c3R1bUNvcm5lcnMobmVhciA9IHRoaXMubmVhckNsaXAsIGZhciA9IHRoaXMuZmFyQ2xpcCkge1xuXG4gICAgICAgIGNvbnN0IGZvdiA9IHRoaXMuZm92ICogTWF0aC5QSSAvIDE4MC4wO1xuICAgICAgICBsZXQgeSA9IHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUgPyBNYXRoLnRhbihmb3YgLyAyLjApICogbmVhciA6IHRoaXMuX29ydGhvSGVpZ2h0O1xuICAgICAgICBsZXQgeCA9IHkgKiB0aGlzLmFzcGVjdFJhdGlvO1xuXG4gICAgICAgIGNvbnN0IHBvaW50cyA9IF9mcnVzdHVtUG9pbnRzO1xuICAgICAgICBwb2ludHNbMF0ueCA9IHg7XG4gICAgICAgIHBvaW50c1swXS55ID0gLXk7XG4gICAgICAgIHBvaW50c1swXS56ID0gLW5lYXI7XG4gICAgICAgIHBvaW50c1sxXS54ID0geDtcbiAgICAgICAgcG9pbnRzWzFdLnkgPSB5O1xuICAgICAgICBwb2ludHNbMV0ueiA9IC1uZWFyO1xuICAgICAgICBwb2ludHNbMl0ueCA9IC14O1xuICAgICAgICBwb2ludHNbMl0ueSA9IHk7XG4gICAgICAgIHBvaW50c1syXS56ID0gLW5lYXI7XG4gICAgICAgIHBvaW50c1szXS54ID0gLXg7XG4gICAgICAgIHBvaW50c1szXS55ID0gLXk7XG4gICAgICAgIHBvaW50c1szXS56ID0gLW5lYXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpIHtcbiAgICAgICAgICAgIHkgPSBNYXRoLnRhbihmb3YgLyAyLjApICogZmFyO1xuICAgICAgICAgICAgeCA9IHkgKiB0aGlzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgICAgIHBvaW50c1s0XS54ID0geDtcbiAgICAgICAgcG9pbnRzWzRdLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzRdLnogPSAtZmFyO1xuICAgICAgICBwb2ludHNbNV0ueCA9IHg7XG4gICAgICAgIHBvaW50c1s1XS55ID0geTtcbiAgICAgICAgcG9pbnRzWzVdLnogPSAtZmFyO1xuICAgICAgICBwb2ludHNbNl0ueCA9IC14O1xuICAgICAgICBwb2ludHNbNl0ueSA9IHk7XG4gICAgICAgIHBvaW50c1s2XS56ID0gLWZhcjtcbiAgICAgICAgcG9pbnRzWzddLnggPSAteDtcbiAgICAgICAgcG9pbnRzWzddLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzddLnogPSAtZmFyO1xuXG4gICAgICAgIHJldHVybiBwb2ludHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBYUiBjYW1lcmEgcHJvcGVydGllcyB0aGF0IHNob3VsZCBiZSBkZXJpdmVkIHBoeXNpY2FsIGNhbWVyYSBpbiB7QGxpbmsgWHJNYW5hZ2VyfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbcHJvcGVydGllc10gLSBQcm9wZXJ0aWVzIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Byb3BlcnRpZXMuYXNwZWN0UmF0aW9dIC0gQXNwZWN0IHJhdGlvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHJvcGVydGllcy5mYXJDbGlwXSAtIEZhciBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHJvcGVydGllcy5mb3ZdIC0gRmllbGQgb2Ygdmlldy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtwcm9wZXJ0aWVzLmhvcml6b250YWxGb3ZdIC0gRW5hYmxlIGhvcml6b250YWwgZmllbGQgb2Ygdmlldy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Byb3BlcnRpZXMubmVhckNsaXBdIC0gTmVhciBjbGlwLlxuICAgICAqL1xuICAgIHNldFhyUHJvcGVydGllcyhwcm9wZXJ0aWVzKSB7XG4gICAgICAgIE9iamVjdC5hc3NpZ24ocHJvcGVydGllcywgdGhpcy5feHJQcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IENhbWVyYSB9O1xuIl0sIm5hbWVzIjpbIl9kZXZpY2VDb29yZCIsIlZlYzMiLCJfaGFsZlNpemUiLCJfcG9pbnQiLCJfaW52Vmlld1Byb2pNYXQiLCJNYXQ0IiwiX2ZydXN0dW1Qb2ludHMiLCJDYW1lcmEiLCJjb25zdHJ1Y3RvciIsIl9hc3BlY3RSYXRpbyIsIl9hc3BlY3RSYXRpb01vZGUiLCJBU1BFQ1RfQVVUTyIsIl9jYWxjdWxhdGVQcm9qZWN0aW9uIiwiX2NhbGN1bGF0ZVRyYW5zZm9ybSIsIl9jbGVhckNvbG9yIiwiQ29sb3IiLCJfY2xlYXJDb2xvckJ1ZmZlciIsIl9jbGVhckRlcHRoIiwiX2NsZWFyRGVwdGhCdWZmZXIiLCJfY2xlYXJTdGVuY2lsIiwiX2NsZWFyU3RlbmNpbEJ1ZmZlciIsIl9jdWxsaW5nTWFzayIsIl9jdWxsRmFjZXMiLCJfZmFyQ2xpcCIsIl9mbGlwRmFjZXMiLCJfZm92IiwiX2ZydXN0dW1DdWxsaW5nIiwiX2hvcml6b250YWxGb3YiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIkxBWUVSSURfREVQVEgiLCJMQVlFUklEX1NLWUJPWCIsIkxBWUVSSURfVUkiLCJMQVlFUklEX0lNTUVESUFURSIsIl9sYXllcnNTZXQiLCJTZXQiLCJfbmVhckNsaXAiLCJfbm9kZSIsIl9vcnRob0hlaWdodCIsIl9wcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsIl9yZWN0IiwiVmVjNCIsIl9yZW5kZXJUYXJnZXQiLCJfc2Npc3NvclJlY3QiLCJfc2Npc3NvclJlY3RDbGVhciIsIl9hcGVydHVyZSIsIl9zaHV0dGVyIiwiX3NlbnNpdGl2aXR5IiwiX3Byb2pNYXQiLCJfcHJvak1hdERpcnR5IiwiX3Byb2pNYXRTa3lib3giLCJfdmlld01hdCIsIl92aWV3TWF0RGlydHkiLCJfdmlld1Byb2pNYXQiLCJfdmlld1Byb2pNYXREaXJ0eSIsImZydXN0dW0iLCJGcnVzdHVtIiwiX3hyIiwiX3hyUHJvcGVydGllcyIsImhvcml6b250YWxGb3YiLCJmb3YiLCJhc3BlY3RSYXRpbyIsImZhckNsaXAiLCJuZWFyQ2xpcCIsImZ1bGxTaXplQ2xlYXJSZWN0IiwicmVjdCIsInNjaXNzb3JSZWN0IiwieCIsInkiLCJ6IiwidyIsIm5ld1ZhbHVlIiwieHIiLCJhY3RpdmUiLCJhc3BlY3RSYXRpb01vZGUiLCJjYWxjdWxhdGVQcm9qZWN0aW9uIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwiY2xlYXJDb2xvciIsImNvcHkiLCJjbGVhckNvbG9yQnVmZmVyIiwiY2xlYXJEZXB0aCIsImNsZWFyRGVwdGhCdWZmZXIiLCJjbGVhclN0ZW5jaWwiLCJjbGVhclN0ZW5jaWxCdWZmZXIiLCJjdWxsaW5nTWFzayIsImN1bGxGYWNlcyIsImZsaXBGYWNlcyIsImZydXN0dW1DdWxsaW5nIiwibGF5ZXJzIiwic2xpY2UiLCJsYXllcnNTZXQiLCJub2RlIiwib3J0aG9IZWlnaHQiLCJwcm9qZWN0aW9uIiwicHJvamVjdGlvbk1hdHJpeCIsIl9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgiLCJyZW5kZXJUYXJnZXQiLCJ2aWV3TWF0cml4Iiwid3RtIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJpbnZlcnQiLCJhcGVydHVyZSIsInNlbnNpdGl2aXR5Iiwic2h1dHRlciIsImNsb25lIiwib3RoZXIiLCJfdXBkYXRlVmlld1Byb2pNYXQiLCJtdWwyIiwid29ybGRUb1NjcmVlbiIsIndvcmxkQ29vcmQiLCJjdyIsImNoIiwic2NyZWVuQ29vcmQiLCJ0cmFuc2Zvcm1Qb2ludCIsInZwbSIsImRhdGEiLCJzY3JlZW5Ub1dvcmxkIiwicmFuZ2UiLCJzZXQiLCJtdWxTY2FsYXIiLCJzdWIiLCJPTkUiLCJfZ2V0UGVyc3BlY3RpdmVIYWxmU2l6ZSIsImludlZpZXciLCJjYW1lcmFQb3MiLCJnZXRQb3NpdGlvbiIsInN1YjIiLCJub3JtYWxpemUiLCJhZGQiLCJzZXRQZXJzcGVjdGl2ZSIsInNldE9ydGhvIiwiZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCIsImdldEV4cG9zdXJlIiwiZXYxMDAiLCJNYXRoIiwibG9nMiIsInBvdyIsImdldFNjcmVlblNpemUiLCJzcGhlcmUiLCJkaXN0YW5jZSIsImNlbnRlciIsInJhZGl1cyIsInZpZXdBbmdsZSIsImFzaW4iLCJzcGhlcmVWaWV3SGVpZ2h0IiwidGFuIiwic2NyZWVuVmlld0hlaWdodCIsIm1hdGgiLCJERUdfVE9fUkFEIiwibWluIiwiY2xhbXAiLCJnZXRGcnVzdHVtQ29ybmVycyIsIm5lYXIiLCJmYXIiLCJQSSIsInBvaW50cyIsInNldFhyUHJvcGVydGllcyIsInByb3BlcnRpZXMiLCJPYmplY3QiLCJhc3NpZ24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7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
