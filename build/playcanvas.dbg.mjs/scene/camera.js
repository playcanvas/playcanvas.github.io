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
    /**
     * @type {import('./shader-pass.js').ShaderPassInfo|null}
     */
    this.shaderPassInfo = void 0;
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
    this.shaderPassInfo = other.shaderPassInfo;
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
    Object.assign(this._xrProperties, properties);
    this._projMatDirty = true;
  }
}

export { Camera };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FtZXJhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvY2FtZXJhLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IEZydXN0dW0gfSBmcm9tICcuLi9jb3JlL3NoYXBlL2ZydXN0dW0uanMnO1xuXG5pbXBvcnQge1xuICAgIEFTUEVDVF9BVVRPLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIExBWUVSSURfV09STEQsIExBWUVSSURfREVQVEgsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX0lNTUVESUFURVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8vIHByZS1hbGxvY2F0ZWQgdGVtcCB2YXJpYWJsZXNcbmNvbnN0IF9kZXZpY2VDb29yZCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfaGFsZlNpemUgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BvaW50ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9pbnZWaWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfZnJ1c3R1bVBvaW50cyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcblxuLyoqXG4gKiBBIGNhbWVyYS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIENhbWVyYSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9zaGFkZXItcGFzcy5qcycpLlNoYWRlclBhc3NJbmZvfG51bGx9XG4gICAgICovXG4gICAgc2hhZGVyUGFzc0luZm87XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5fYXNwZWN0UmF0aW8gPSAxNiAvIDk7XG4gICAgICAgIHRoaXMuX2FzcGVjdFJhdGlvTW9kZSA9IEFTUEVDVF9BVVRPO1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVQcm9qZWN0aW9uID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlVHJhbnNmb3JtID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvciA9IG5ldyBDb2xvcigwLjc1LCAwLjc1LCAwLjc1LCAxKTtcbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvckJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGggPSAxO1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsID0gMDtcbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY3VsbGluZ01hc2sgPSAweEZGRkZGRkZGO1xuICAgICAgICB0aGlzLl9jdWxsRmFjZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9mYXJDbGlwID0gMTAwMDtcbiAgICAgICAgdGhpcy5fZmxpcEZhY2VzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZvdiA9IDQ1O1xuICAgICAgICB0aGlzLl9mcnVzdHVtQ3VsbGluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuX2hvcml6b250YWxGb3YgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gW0xBWUVSSURfV09STEQsIExBWUVSSURfREVQVEgsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX0lNTUVESUFURV07XG4gICAgICAgIHRoaXMuX2xheWVyc1NldCA9IG5ldyBTZXQodGhpcy5fbGF5ZXJzKTtcbiAgICAgICAgdGhpcy5fbmVhckNsaXAgPSAwLjE7XG4gICAgICAgIHRoaXMuX25vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9vcnRob0hlaWdodCA9IDEwO1xuICAgICAgICB0aGlzLl9wcm9qZWN0aW9uID0gUFJPSkVDVElPTl9QRVJTUEVDVElWRTtcbiAgICAgICAgdGhpcy5fcmVjdCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuICAgICAgICB0aGlzLl9yZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9zY2lzc29yUmVjdCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuICAgICAgICB0aGlzLl9zY2lzc29yUmVjdENsZWFyID0gZmFsc2U7IC8vIGJ5IGRlZmF1bHQgcmVjdCBpcyB1c2VkIHdoZW4gY2xlYXJpbmcuIHRoaXMgYWxsb3dzIHNjaXNzb3JSZWN0IHRvIGJlIHVzZWQgd2hlbiBjbGVhcmluZy5cbiAgICAgICAgdGhpcy5fYXBlcnR1cmUgPSAxNi4wO1xuICAgICAgICB0aGlzLl9zaHV0dGVyID0gMS4wIC8gMTAwMC4wO1xuICAgICAgICB0aGlzLl9zZW5zaXRpdml0eSA9IDEwMDA7XG5cbiAgICAgICAgdGhpcy5fcHJvak1hdCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3Byb2pNYXRTa3lib3ggPSBuZXcgTWF0NCgpOyAvLyBwcm9qZWN0aW9uIG1hdHJpeCB1c2VkIGJ5IHNreWJveCByZW5kZXJpbmcgc2hhZGVyIGlzIGFsd2F5cyBwZXJzcGVjdGl2ZVxuICAgICAgICB0aGlzLl92aWV3TWF0ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgdGhpcy5fdmlld01hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fdmlld1Byb2pNYXQgPSBuZXcgTWF0NCgpO1xuICAgICAgICB0aGlzLl92aWV3UHJvak1hdERpcnR5ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLmZydXN0dW0gPSBuZXcgRnJ1c3R1bSgpO1xuXG4gICAgICAgIC8vIFNldCBieSBYck1hbmFnZXJcbiAgICAgICAgdGhpcy5feHIgPSBudWxsO1xuICAgICAgICB0aGlzLl94clByb3BlcnRpZXMgPSB7XG4gICAgICAgICAgICBob3Jpem9udGFsRm92OiB0aGlzLl9ob3Jpem9udGFsRm92LFxuICAgICAgICAgICAgZm92OiB0aGlzLl9mb3YsXG4gICAgICAgICAgICBhc3BlY3RSYXRpbzogdGhpcy5fYXNwZWN0UmF0aW8sXG4gICAgICAgICAgICBmYXJDbGlwOiB0aGlzLl9mYXJDbGlwLFxuICAgICAgICAgICAgbmVhckNsaXA6IHRoaXMuX25lYXJDbGlwXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgY2FtZXJhIGNsZWFycyB0aGUgZnVsbCByZW5kZXIgdGFyZ2V0LiAodmlld3BvcnQgLyBzY2lzc29yIGFyZSBmdWxsIHNpemUpXG4gICAgICovXG4gICAgZ2V0IGZ1bGxTaXplQ2xlYXJSZWN0KCkge1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5fc2Npc3NvclJlY3RDbGVhciA/IHRoaXMuc2Npc3NvclJlY3QgOiB0aGlzLl9yZWN0O1xuICAgICAgICByZXR1cm4gcmVjdC54ID09PSAwICYmIHJlY3QueSA9PT0gMCAmJiByZWN0LnogPT09IDEgJiYgcmVjdC53ID09PSAxO1xuICAgIH1cblxuICAgIHNldCBhc3BlY3RSYXRpbyhuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYXNwZWN0UmF0aW8gIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9hc3BlY3RSYXRpbyA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhc3BlY3RSYXRpbygpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLnhyPy5hY3RpdmUpID8gdGhpcy5feHJQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvIDogdGhpcy5fYXNwZWN0UmF0aW87XG4gICAgfVxuXG4gICAgc2V0IGFzcGVjdFJhdGlvTW9kZShuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYXNwZWN0UmF0aW9Nb2RlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYXNwZWN0UmF0aW9Nb2RlID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzcGVjdFJhdGlvTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FzcGVjdFJhdGlvTW9kZTtcbiAgICB9XG5cbiAgICBzZXQgY2FsY3VsYXRlUHJvamVjdGlvbihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVQcm9qZWN0aW9uID0gbmV3VmFsdWU7XG4gICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVByb2plY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWxjdWxhdGVQcm9qZWN0aW9uO1xuICAgIH1cblxuICAgIHNldCBjYWxjdWxhdGVUcmFuc2Zvcm0obmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlVHJhbnNmb3JtID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZVRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJDb2xvcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhckNvbG9yLmNvcHkobmV3VmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBjbGVhckNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJDb2xvcjtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJDb2xvckJ1ZmZlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhckNvbG9yQnVmZmVyID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3JCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckNvbG9yQnVmZmVyO1xuICAgIH1cblxuICAgIHNldCBjbGVhckRlcHRoKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGggPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJEZXB0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyRGVwdGg7XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyRGVwdGhCdWZmZXIobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlciA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJTdGVuY2lsKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbCA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhclN0ZW5jaWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhclN0ZW5jaWw7XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXIgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJTdGVuY2lsQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgIH1cblxuICAgIHNldCBjdWxsaW5nTWFzayhuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jdWxsaW5nTWFzayA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjdWxsaW5nTWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1bGxpbmdNYXNrO1xuICAgIH1cblxuICAgIHNldCBjdWxsRmFjZXMobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VsbEZhY2VzID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGN1bGxGYWNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1bGxGYWNlcztcbiAgICB9XG5cbiAgICBzZXQgZmFyQ2xpcChuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZmFyQ2xpcCAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZhckNsaXAgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZmFyQ2xpcCgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLnhyPy5hY3RpdmUpID8gdGhpcy5feHJQcm9wZXJ0aWVzLmZhckNsaXAgOiB0aGlzLl9mYXJDbGlwO1xuICAgIH1cblxuICAgIHNldCBmbGlwRmFjZXMobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZmxpcEZhY2VzID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBGYWNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZsaXBGYWNlcztcbiAgICB9XG5cbiAgICBzZXQgZm92KG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mb3YgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9mb3YgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZm92KCkge1xuICAgICAgICByZXR1cm4gKHRoaXMueHI/LmFjdGl2ZSkgPyB0aGlzLl94clByb3BlcnRpZXMuZm92IDogdGhpcy5fZm92O1xuICAgIH1cblxuICAgIHNldCBmcnVzdHVtQ3VsbGluZyhuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9mcnVzdHVtQ3VsbGluZyA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmcnVzdHVtQ3VsbGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZydXN0dW1DdWxsaW5nO1xuICAgIH1cblxuICAgIHNldCBob3Jpem9udGFsRm92KG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9ob3Jpem9udGFsRm92ICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5faG9yaXpvbnRhbEZvdiA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBob3Jpem9udGFsRm92KCkge1xuICAgICAgICByZXR1cm4gKHRoaXMueHI/LmFjdGl2ZSkgPyB0aGlzLl94clByb3BlcnRpZXMuaG9yaXpvbnRhbEZvdiA6IHRoaXMuX2hvcml6b250YWxGb3Y7XG4gICAgfVxuXG4gICAgc2V0IGxheWVycyhuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBuZXdWYWx1ZS5zbGljZSgwKTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzU2V0ID0gbmV3IFNldCh0aGlzLl9sYXllcnMpO1xuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVyc1NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyc1NldDtcbiAgICB9XG5cbiAgICBzZXQgbmVhckNsaXAobmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX25lYXJDbGlwICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbmVhckNsaXAgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbmVhckNsaXAoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy54cj8uYWN0aXZlKSA/IHRoaXMuX3hyUHJvcGVydGllcy5uZWFyQ2xpcCA6IHRoaXMuX25lYXJDbGlwO1xuICAgIH1cblxuICAgIHNldCBub2RlKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX25vZGUgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbm9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25vZGU7XG4gICAgfVxuXG4gICAgc2V0IG9ydGhvSGVpZ2h0KG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9vcnRob0hlaWdodCAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX29ydGhvSGVpZ2h0ID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9ydGhvSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3J0aG9IZWlnaHQ7XG4gICAgfVxuXG4gICAgc2V0IHByb2plY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9wcm9qZWN0aW9uID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHByb2plY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9qZWN0aW9uO1xuICAgIH1cblxuICAgIGdldCBwcm9qZWN0aW9uTWF0cml4KCkge1xuICAgICAgICB0aGlzLl9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2pNYXQ7XG4gICAgfVxuXG4gICAgc2V0IHJlY3QobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVjdC5jb3B5KG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgcmVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY3Q7XG4gICAgfVxuXG4gICAgc2V0IHJlbmRlclRhcmdldChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9yZW5kZXJUYXJnZXQgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyVGFyZ2V0O1xuICAgIH1cblxuICAgIHNldCBzY2lzc29yUmVjdChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9zY2lzc29yUmVjdC5jb3B5KG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgc2Npc3NvclJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zY2lzc29yUmVjdDtcbiAgICB9XG5cbiAgICBnZXQgdmlld01hdHJpeCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3ZpZXdNYXREaXJ0eSkge1xuICAgICAgICAgICAgY29uc3Qgd3RtID0gdGhpcy5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgdGhpcy5fdmlld01hdC5jb3B5KHd0bSkuaW52ZXJ0KCk7XG4gICAgICAgICAgICB0aGlzLl92aWV3TWF0RGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdmlld01hdDtcbiAgICB9XG5cbiAgICBzZXQgYXBlcnR1cmUobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXBlcnR1cmUgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXBlcnR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hcGVydHVyZTtcbiAgICB9XG5cbiAgICBzZXQgc2Vuc2l0aXZpdHkobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2Vuc2l0aXZpdHkgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc2Vuc2l0aXZpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zZW5zaXRpdml0eTtcbiAgICB9XG5cbiAgICBzZXQgc2h1dHRlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9zaHV0dGVyID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNodXR0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaHV0dGVyO1xuICAgIH1cblxuICAgIHNldCB4cihuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5feHIgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl94ciA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB4cigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBkdXBsaWNhdGUgb2YgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtDYW1lcmF9IEEgY2xvbmVkIENhbWVyYS5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDYW1lcmEoKS5jb3B5KHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyBvbmUgY2FtZXJhIHRvIGFub3RoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NhbWVyYX0gb3RoZXIgLSBDYW1lcmEgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7Q2FtZXJhfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBjb3B5KG90aGVyKSB7XG4gICAgICAgIC8vIFdlIGFyZW4ndCB1c2luZyB0aGUgZ2V0dGVycyBhbmQgc2V0dGVycyBiZWNhdXNlIHRoZXJlIGlzIGFkZGl0aW9uYWwgbG9naWNcbiAgICAgICAgLy8gYXJvdW5kIHVzaW5nIFdlYlhSIGluIHRoZSBnZXR0ZXJzIGZvciB0aGVzZSBwcm9wZXJ0aWVzIHNvIHRoYXQgZnVuY3Rpb25zXG4gICAgICAgIC8vIGxpa2Ugc2NyZWVuVG9Xb3JsZCB3b3JrIGNvcnJlY3RseSB3aXRoIG90aGVyIHN5c3RlbXMgbGlrZSB0aGUgVUkgaW5wdXRcbiAgICAgICAgLy8gc3lzdGVtXG4gICAgICAgIHRoaXMuX2FzcGVjdFJhdGlvID0gb3RoZXIuX2FzcGVjdFJhdGlvO1xuICAgICAgICB0aGlzLl9mYXJDbGlwID0gb3RoZXIuX2ZhckNsaXA7XG4gICAgICAgIHRoaXMuX2ZvdiA9IG90aGVyLl9mb3Y7XG4gICAgICAgIHRoaXMuX2hvcml6b250YWxGb3YgPSBvdGhlci5faG9yaXpvbnRhbEZvdjtcbiAgICAgICAgdGhpcy5fbmVhckNsaXAgPSBvdGhlci5fbmVhckNsaXA7XG5cbiAgICAgICAgdGhpcy5feHJQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvID0gb3RoZXIuX3hyUHJvcGVydGllcy5hc3BlY3RSYXRpbztcbiAgICAgICAgdGhpcy5feHJQcm9wZXJ0aWVzLmZhckNsaXAgPSBvdGhlci5feHJQcm9wZXJ0aWVzLmZhckNsaXA7XG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcy5mb3YgPSBvdGhlci5feHJQcm9wZXJ0aWVzLmZvdjtcbiAgICAgICAgdGhpcy5feHJQcm9wZXJ0aWVzLmhvcml6b250YWxGb3YgPSBvdGhlci5feHJQcm9wZXJ0aWVzLmhvcml6b250YWxGb3Y7XG4gICAgICAgIHRoaXMuX3hyUHJvcGVydGllcy5uZWFyQ2xpcCA9IG90aGVyLl94clByb3BlcnRpZXMubmVhckNsaXA7XG5cbiAgICAgICAgdGhpcy5hc3BlY3RSYXRpb01vZGUgPSBvdGhlci5hc3BlY3RSYXRpb01vZGU7XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlUHJvamVjdGlvbiA9IG90aGVyLmNhbGN1bGF0ZVByb2plY3Rpb247XG4gICAgICAgIHRoaXMuY2FsY3VsYXRlVHJhbnNmb3JtID0gb3RoZXIuY2FsY3VsYXRlVHJhbnNmb3JtO1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBvdGhlci5jbGVhckNvbG9yO1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3JCdWZmZXIgPSBvdGhlci5jbGVhckNvbG9yQnVmZmVyO1xuICAgICAgICB0aGlzLmNsZWFyRGVwdGggPSBvdGhlci5jbGVhckRlcHRoO1xuICAgICAgICB0aGlzLmNsZWFyRGVwdGhCdWZmZXIgPSBvdGhlci5jbGVhckRlcHRoQnVmZmVyO1xuICAgICAgICB0aGlzLmNsZWFyU3RlbmNpbCA9IG90aGVyLmNsZWFyU3RlbmNpbDtcbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWxCdWZmZXIgPSBvdGhlci5jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgICAgIHRoaXMuY3VsbEZhY2VzID0gb3RoZXIuY3VsbEZhY2VzO1xuICAgICAgICB0aGlzLmN1bGxpbmdNYXNrID0gb3RoZXIuY3VsbGluZ01hc2s7XG4gICAgICAgIHRoaXMuZmxpcEZhY2VzID0gb3RoZXIuZmxpcEZhY2VzO1xuICAgICAgICB0aGlzLmZydXN0dW1DdWxsaW5nID0gb3RoZXIuZnJ1c3R1bUN1bGxpbmc7XG4gICAgICAgIHRoaXMubGF5ZXJzID0gb3RoZXIubGF5ZXJzO1xuICAgICAgICB0aGlzLm9ydGhvSGVpZ2h0ID0gb3RoZXIub3J0aG9IZWlnaHQ7XG4gICAgICAgIHRoaXMucHJvamVjdGlvbiA9IG90aGVyLnByb2plY3Rpb247XG4gICAgICAgIHRoaXMucmVjdCA9IG90aGVyLnJlY3Q7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gb3RoZXIucmVuZGVyVGFyZ2V0O1xuICAgICAgICB0aGlzLnNjaXNzb3JSZWN0ID0gb3RoZXIuc2Npc3NvclJlY3Q7XG4gICAgICAgIHRoaXMuYXBlcnR1cmUgPSBvdGhlci5hcGVydHVyZTtcbiAgICAgICAgdGhpcy5zaHV0dGVyID0gb3RoZXIuc2h1dHRlcjtcbiAgICAgICAgdGhpcy5zZW5zaXRpdml0eSA9IG90aGVyLnNlbnNpdGl2aXR5O1xuXG4gICAgICAgIHRoaXMuc2hhZGVyUGFzc0luZm8gPSBvdGhlci5zaGFkZXJQYXNzSW5mbztcblxuICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIF91cGRhdGVWaWV3UHJvak1hdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Byb2pNYXREaXJ0eSB8fCB0aGlzLl92aWV3TWF0RGlydHkgfHwgdGhpcy5fdmlld1Byb2pNYXREaXJ0eSkge1xuICAgICAgICAgICAgdGhpcy5fdmlld1Byb2pNYXQubXVsMih0aGlzLnByb2plY3Rpb25NYXRyaXgsIHRoaXMudmlld01hdHJpeCk7XG4gICAgICAgICAgICB0aGlzLl92aWV3UHJvak1hdERpcnR5ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGEgcG9pbnQgZnJvbSAzRCB3b3JsZCBzcGFjZSB0byAyRCBjYW52YXMgcGl4ZWwgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHdvcmxkQ29vcmQgLSBUaGUgd29ybGQgc3BhY2UgY29vcmRpbmF0ZSB0byB0cmFuc2Zvcm0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGN3IC0gVGhlIHdpZHRoIG9mIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjaCAtIFRoZSBoZWlnaHQgb2YgUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbc2NyZWVuQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmUgc2NyZWVuIGNvb3JkaW5hdGUgcmVzdWx0LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgc2NyZWVuIHNwYWNlIGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgd29ybGRUb1NjcmVlbih3b3JsZENvb3JkLCBjdywgY2gsIHNjcmVlbkNvb3JkID0gbmV3IFZlYzMoKSkge1xuICAgICAgICB0aGlzLl91cGRhdGVWaWV3UHJvak1hdCgpO1xuICAgICAgICB0aGlzLl92aWV3UHJvak1hdC50cmFuc2Zvcm1Qb2ludCh3b3JsZENvb3JkLCBzY3JlZW5Db29yZCk7XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHcgY28tY29vcmRcbiAgICAgICAgY29uc3QgdnBtID0gdGhpcy5fdmlld1Byb2pNYXQuZGF0YTtcbiAgICAgICAgY29uc3QgdyA9IHdvcmxkQ29vcmQueCAqIHZwbVszXSArXG4gICAgICAgICAgICAgICAgd29ybGRDb29yZC55ICogdnBtWzddICtcbiAgICAgICAgICAgICAgICB3b3JsZENvb3JkLnogKiB2cG1bMTFdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIDEgKiB2cG1bMTVdO1xuXG4gICAgICAgIHNjcmVlbkNvb3JkLnggPSAoc2NyZWVuQ29vcmQueCAvIHcgKyAxKSAqIDAuNSAqIGN3O1xuICAgICAgICBzY3JlZW5Db29yZC55ID0gKDEgLSBzY3JlZW5Db29yZC55IC8gdykgKiAwLjUgKiBjaDtcblxuICAgICAgICByZXR1cm4gc2NyZWVuQ29vcmQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCBhIHBvaW50IGZyb20gMkQgY2FudmFzIHBpeGVsIHNwYWNlIHRvIDNEIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBYIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBZIGNvb3JkaW5hdGUgb24gUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgY2FtZXJhIGluIHdvcmxkIHNwYWNlIHRvIGNyZWF0ZSB0aGUgbmV3IHBvaW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdyAtIFRoZSB3aWR0aCBvZiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2ggLSBUaGUgaGVpZ2h0IG9mIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3dvcmxkQ29vcmRdIC0gM0QgdmVjdG9yIHRvIHJlY2VpdmUgd29ybGQgY29vcmRpbmF0ZSByZXN1bHQuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBjb29yZGluYXRlLlxuICAgICAqL1xuICAgIHNjcmVlblRvV29ybGQoeCwgeSwgeiwgY3csIGNoLCB3b3JsZENvb3JkID0gbmV3IFZlYzMoKSkge1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgc2NyZWVuIGNsaWNrIGFzIGEgcG9pbnQgb24gdGhlIGZhciBwbGFuZSBvZiB0aGUgbm9ybWFsaXplZCBkZXZpY2UgY29vcmRpbmF0ZSAnYm94JyAoej0xKVxuICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMuZmFyQ2xpcCAtIHRoaXMubmVhckNsaXA7XG4gICAgICAgIF9kZXZpY2VDb29yZC5zZXQoeCAvIGN3LCAoY2ggLSB5KSAvIGNoLCB6IC8gcmFuZ2UpO1xuICAgICAgICBfZGV2aWNlQ29vcmQubXVsU2NhbGFyKDIpO1xuICAgICAgICBfZGV2aWNlQ29vcmQuc3ViKFZlYzMuT05FKTtcblxuICAgICAgICBpZiAodGhpcy5fcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9QRVJTUEVDVElWRSkge1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgaGFsZiB3aWR0aCBhbmQgaGVpZ2h0IGF0IHRoZSBuZWFyIGNsaXAgcGxhbmVcbiAgICAgICAgICAgIE1hdDQuX2dldFBlcnNwZWN0aXZlSGFsZlNpemUoX2hhbGZTaXplLCB0aGlzLmZvdiwgdGhpcy5hc3BlY3RSYXRpbywgdGhpcy5uZWFyQ2xpcCwgdGhpcy5ob3Jpem9udGFsRm92KTtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYnkgbm9ybWFsaXplZCBzY3JlZW4gY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIF9oYWxmU2l6ZS54ICo9IF9kZXZpY2VDb29yZC54O1xuICAgICAgICAgICAgX2hhbGZTaXplLnkgKj0gX2RldmljZUNvb3JkLnk7XG5cbiAgICAgICAgICAgIC8vIHRyYW5zZm9ybSB0byB3b3JsZCBzcGFjZVxuICAgICAgICAgICAgY29uc3QgaW52VmlldyA9IHRoaXMuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIF9oYWxmU2l6ZS56ID0gLXRoaXMubmVhckNsaXA7XG4gICAgICAgICAgICBpbnZWaWV3LnRyYW5zZm9ybVBvaW50KF9oYWxmU2l6ZSwgX3BvaW50KTtcblxuICAgICAgICAgICAgLy8gcG9pbnQgYWxvbmcgY2FtZXJhLT5fcG9pbnQgcmF5IGF0IGRpc3RhbmNlIHogZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFQb3MgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB3b3JsZENvb3JkLnN1YjIoX3BvaW50LCBjYW1lcmFQb3MpO1xuICAgICAgICAgICAgd29ybGRDb29yZC5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHdvcmxkQ29vcmQubXVsU2NhbGFyKHopO1xuICAgICAgICAgICAgd29ybGRDb29yZC5hZGQoY2FtZXJhUG9zKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB0aGlzLl91cGRhdGVWaWV3UHJvak1hdCgpO1xuICAgICAgICAgICAgX2ludlZpZXdQcm9qTWF0LmNvcHkodGhpcy5fdmlld1Byb2pNYXQpLmludmVydCgpO1xuXG4gICAgICAgICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICBfaW52Vmlld1Byb2pNYXQudHJhbnNmb3JtUG9pbnQoX2RldmljZUNvb3JkLCB3b3JsZENvb3JkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB3b3JsZENvb3JkO1xuICAgIH1cblxuICAgIF9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgoKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcm9qTWF0RGlydHkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvak1hdC5zZXRQZXJzcGVjdGl2ZSh0aGlzLmZvdiwgdGhpcy5hc3BlY3RSYXRpbywgdGhpcy5uZWFyQ2xpcCwgdGhpcy5mYXJDbGlwLCB0aGlzLmhvcml6b250YWxGb3YpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Byb2pNYXRTa3lib3guY29weSh0aGlzLl9wcm9qTWF0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IHRoaXMuX29ydGhvSGVpZ2h0O1xuICAgICAgICAgICAgICAgIGNvbnN0IHggPSB5ICogdGhpcy5hc3BlY3RSYXRpbztcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9qTWF0LnNldE9ydGhvKC14LCB4LCAteSwgeSwgdGhpcy5uZWFyQ2xpcCwgdGhpcy5mYXJDbGlwKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9qTWF0U2t5Ym94LnNldFBlcnNwZWN0aXZlKHRoaXMuZm92LCB0aGlzLmFzcGVjdFJhdGlvLCB0aGlzLm5lYXJDbGlwLCB0aGlzLmZhckNsaXApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldFByb2plY3Rpb25NYXRyaXhTa3lib3goKSB7XG4gICAgICAgIHRoaXMuX2V2YWx1YXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJvak1hdFNreWJveDtcbiAgICB9XG5cbiAgICBnZXRFeHBvc3VyZSgpIHtcbiAgICAgICAgY29uc3QgZXYxMDAgPSBNYXRoLmxvZzIoKHRoaXMuX2FwZXJ0dXJlICogdGhpcy5fYXBlcnR1cmUpIC8gdGhpcy5fc2h1dHRlciAqIDEwMC4wIC8gdGhpcy5fc2Vuc2l0aXZpdHkpO1xuICAgICAgICByZXR1cm4gMS4wIC8gKE1hdGgucG93KDIuMCwgZXYxMDApICogMS4yKTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGVzdGltYXRlZCBzaXplIG9mIHRoZSBzcGhlcmUgb24gdGhlIHNjcmVlbiBpbiByYW5nZSBvZiBbMC4uMV1cbiAgICAvLyAwIC0gaW5maW5pdGVseSBzbWFsbCwgMSAtIGZ1bGwgc2NyZWVuIG9yIGxhcmdlclxuICAgIGdldFNjcmVlblNpemUoc3BoZXJlKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpIHtcblxuICAgICAgICAgICAgLy8gY2FtZXJhIHRvIHNwaGVyZSBkaXN0YW5jZVxuICAgICAgICAgICAgY29uc3QgZGlzdGFuY2UgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCkuZGlzdGFuY2Uoc3BoZXJlLmNlbnRlcik7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlJ3JlIGluc2lkZSB0aGUgc3BoZXJlXG4gICAgICAgICAgICBpZiAoZGlzdGFuY2UgPCBzcGhlcmUucmFkaXVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRoZSB2aWV3LWFuZ2xlIG9mIHRoZSBib3VuZGluZyBzcGhlcmUgcmVuZGVyZWQgb24gc2NyZWVuXG4gICAgICAgICAgICBjb25zdCB2aWV3QW5nbGUgPSBNYXRoLmFzaW4oc3BoZXJlLnJhZGl1cyAvIGRpc3RhbmNlKTtcblxuICAgICAgICAgICAgLy8gVGhpcyBhc3N1bWVzIHRoZSBuZWFyIGNsaXBwaW5nIHBsYW5lIGlzIGF0IGEgZGlzdGFuY2Ugb2YgMVxuICAgICAgICAgICAgY29uc3Qgc3BoZXJlVmlld0hlaWdodCA9IE1hdGgudGFuKHZpZXdBbmdsZSk7XG5cbiAgICAgICAgICAgIC8vIFRoZSBzaXplIG9mIChoYWxmKSB0aGUgc2NyZWVuIGlmIHRoZSBuZWFyIGNsaXBwaW5nIHBsYW5lIGlzIGF0IGEgZGlzdGFuY2Ugb2YgMVxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuVmlld0hlaWdodCA9IE1hdGgudGFuKCh0aGlzLmZvdiAvIDIpICogbWF0aC5ERUdfVE9fUkFEKTtcblxuICAgICAgICAgICAgLy8gVGhlIHJhdGlvIG9mIHRoZSBnZW9tZXRyeSdzIHNjcmVlbiBzaXplIGNvbXBhcmVkIHRvIHRoZSBhY3R1YWwgc2l6ZSBvZiB0aGUgc2NyZWVuXG4gICAgICAgICAgICByZXR1cm4gTWF0aC5taW4oc3BoZXJlVmlld0hlaWdodCAvIHNjcmVlblZpZXdIZWlnaHQsIDEpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvLyBvcnRob1xuICAgICAgICByZXR1cm4gbWF0aC5jbGFtcChzcGhlcmUucmFkaXVzIC8gdGhpcy5fb3J0aG9IZWlnaHQsIDAsIDEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gYXJyYXkgb2YgY29ybmVycyBvZiB0aGUgZnJ1c3R1bSBvZiB0aGUgY2FtZXJhIGluIHRoZSBsb2NhbCBjb29yZGluYXRlIHN5c3RlbSBvZiB0aGUgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtuZWFyXSAtIE5lYXIgZGlzdGFuY2UgZm9yIHRoZSBmcnVzdHVtIHBvaW50cy4gRGVmYXVsdHMgdG8gdGhlIG5lYXIgY2xpcCBkaXN0YW5jZSBvZiB0aGUgY2FtZXJhLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZmFyXSAtIEZhciBkaXN0YW5jZSBmb3IgdGhlIGZydXN0dW0gcG9pbnRzLiBEZWZhdWx0cyB0byB0aGUgZmFyIGNsaXAgZGlzdGFuY2Ugb2YgdGhlIGNhbWVyYS5cbiAgICAgKiBAcmV0dXJucyB7VmVjM1tdfSAtIEFuIGFycmF5IG9mIGNvcm5lcnMsIHVzaW5nIGEgZ2xvYmFsIHN0b3JhZ2Ugc3BhY2UuXG4gICAgICovXG4gICAgZ2V0RnJ1c3R1bUNvcm5lcnMobmVhciA9IHRoaXMubmVhckNsaXAsIGZhciA9IHRoaXMuZmFyQ2xpcCkge1xuXG4gICAgICAgIGNvbnN0IGZvdiA9IHRoaXMuZm92ICogTWF0aC5QSSAvIDE4MC4wO1xuICAgICAgICBsZXQgeSA9IHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUgPyBNYXRoLnRhbihmb3YgLyAyLjApICogbmVhciA6IHRoaXMuX29ydGhvSGVpZ2h0O1xuICAgICAgICBsZXQgeCA9IHkgKiB0aGlzLmFzcGVjdFJhdGlvO1xuXG4gICAgICAgIGNvbnN0IHBvaW50cyA9IF9mcnVzdHVtUG9pbnRzO1xuICAgICAgICBwb2ludHNbMF0ueCA9IHg7XG4gICAgICAgIHBvaW50c1swXS55ID0gLXk7XG4gICAgICAgIHBvaW50c1swXS56ID0gLW5lYXI7XG4gICAgICAgIHBvaW50c1sxXS54ID0geDtcbiAgICAgICAgcG9pbnRzWzFdLnkgPSB5O1xuICAgICAgICBwb2ludHNbMV0ueiA9IC1uZWFyO1xuICAgICAgICBwb2ludHNbMl0ueCA9IC14O1xuICAgICAgICBwb2ludHNbMl0ueSA9IHk7XG4gICAgICAgIHBvaW50c1syXS56ID0gLW5lYXI7XG4gICAgICAgIHBvaW50c1szXS54ID0gLXg7XG4gICAgICAgIHBvaW50c1szXS55ID0gLXk7XG4gICAgICAgIHBvaW50c1szXS56ID0gLW5lYXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpIHtcbiAgICAgICAgICAgIHkgPSBNYXRoLnRhbihmb3YgLyAyLjApICogZmFyO1xuICAgICAgICAgICAgeCA9IHkgKiB0aGlzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgICAgIHBvaW50c1s0XS54ID0geDtcbiAgICAgICAgcG9pbnRzWzRdLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzRdLnogPSAtZmFyO1xuICAgICAgICBwb2ludHNbNV0ueCA9IHg7XG4gICAgICAgIHBvaW50c1s1XS55ID0geTtcbiAgICAgICAgcG9pbnRzWzVdLnogPSAtZmFyO1xuICAgICAgICBwb2ludHNbNl0ueCA9IC14O1xuICAgICAgICBwb2ludHNbNl0ueSA9IHk7XG4gICAgICAgIHBvaW50c1s2XS56ID0gLWZhcjtcbiAgICAgICAgcG9pbnRzWzddLnggPSAteDtcbiAgICAgICAgcG9pbnRzWzddLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzddLnogPSAtZmFyO1xuXG4gICAgICAgIHJldHVybiBwb2ludHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBYUiBjYW1lcmEgcHJvcGVydGllcyB0aGF0IHNob3VsZCBiZSBkZXJpdmVkIHBoeXNpY2FsIGNhbWVyYSBpbiB7QGxpbmsgWHJNYW5hZ2VyfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbcHJvcGVydGllc10gLSBQcm9wZXJ0aWVzIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Byb3BlcnRpZXMuYXNwZWN0UmF0aW9dIC0gQXNwZWN0IHJhdGlvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHJvcGVydGllcy5mYXJDbGlwXSAtIEZhciBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHJvcGVydGllcy5mb3ZdIC0gRmllbGQgb2Ygdmlldy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtwcm9wZXJ0aWVzLmhvcml6b250YWxGb3ZdIC0gRW5hYmxlIGhvcml6b250YWwgZmllbGQgb2Ygdmlldy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Byb3BlcnRpZXMubmVhckNsaXBdIC0gTmVhciBjbGlwLlxuICAgICAqL1xuICAgIHNldFhyUHJvcGVydGllcyhwcm9wZXJ0aWVzKSB7XG4gICAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5feHJQcm9wZXJ0aWVzLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IENhbWVyYSB9O1xuIl0sIm5hbWVzIjpbIl9kZXZpY2VDb29yZCIsIlZlYzMiLCJfaGFsZlNpemUiLCJfcG9pbnQiLCJfaW52Vmlld1Byb2pNYXQiLCJNYXQ0IiwiX2ZydXN0dW1Qb2ludHMiLCJDYW1lcmEiLCJjb25zdHJ1Y3RvciIsInNoYWRlclBhc3NJbmZvIiwiX2FzcGVjdFJhdGlvIiwiX2FzcGVjdFJhdGlvTW9kZSIsIkFTUEVDVF9BVVRPIiwiX2NhbGN1bGF0ZVByb2plY3Rpb24iLCJfY2FsY3VsYXRlVHJhbnNmb3JtIiwiX2NsZWFyQ29sb3IiLCJDb2xvciIsIl9jbGVhckNvbG9yQnVmZmVyIiwiX2NsZWFyRGVwdGgiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsIl9jbGVhclN0ZW5jaWwiLCJfY2xlYXJTdGVuY2lsQnVmZmVyIiwiX2N1bGxpbmdNYXNrIiwiX2N1bGxGYWNlcyIsIl9mYXJDbGlwIiwiX2ZsaXBGYWNlcyIsIl9mb3YiLCJfZnJ1c3R1bUN1bGxpbmciLCJfaG9yaXpvbnRhbEZvdiIsIl9sYXllcnMiLCJMQVlFUklEX1dPUkxEIiwiTEFZRVJJRF9ERVBUSCIsIkxBWUVSSURfU0tZQk9YIiwiTEFZRVJJRF9VSSIsIkxBWUVSSURfSU1NRURJQVRFIiwiX2xheWVyc1NldCIsIlNldCIsIl9uZWFyQ2xpcCIsIl9ub2RlIiwiX29ydGhvSGVpZ2h0IiwiX3Byb2plY3Rpb24iLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiX3JlY3QiLCJWZWM0IiwiX3JlbmRlclRhcmdldCIsIl9zY2lzc29yUmVjdCIsIl9zY2lzc29yUmVjdENsZWFyIiwiX2FwZXJ0dXJlIiwiX3NodXR0ZXIiLCJfc2Vuc2l0aXZpdHkiLCJfcHJvak1hdCIsIl9wcm9qTWF0RGlydHkiLCJfcHJvak1hdFNreWJveCIsIl92aWV3TWF0IiwiX3ZpZXdNYXREaXJ0eSIsIl92aWV3UHJvak1hdCIsIl92aWV3UHJvak1hdERpcnR5IiwiZnJ1c3R1bSIsIkZydXN0dW0iLCJfeHIiLCJfeHJQcm9wZXJ0aWVzIiwiaG9yaXpvbnRhbEZvdiIsImZvdiIsImFzcGVjdFJhdGlvIiwiZmFyQ2xpcCIsIm5lYXJDbGlwIiwiZnVsbFNpemVDbGVhclJlY3QiLCJyZWN0Iiwic2Npc3NvclJlY3QiLCJ4IiwieSIsInoiLCJ3IiwibmV3VmFsdWUiLCJfdGhpcyR4ciIsInhyIiwiYWN0aXZlIiwiYXNwZWN0UmF0aW9Nb2RlIiwiY2FsY3VsYXRlUHJvamVjdGlvbiIsImNhbGN1bGF0ZVRyYW5zZm9ybSIsImNsZWFyQ29sb3IiLCJjb3B5IiwiY2xlYXJDb2xvckJ1ZmZlciIsImNsZWFyRGVwdGgiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwiY3VsbGluZ01hc2siLCJjdWxsRmFjZXMiLCJfdGhpcyR4cjIiLCJmbGlwRmFjZXMiLCJfdGhpcyR4cjMiLCJmcnVzdHVtQ3VsbGluZyIsIl90aGlzJHhyNCIsImxheWVycyIsInNsaWNlIiwibGF5ZXJzU2V0IiwiX3RoaXMkeHI1Iiwibm9kZSIsIm9ydGhvSGVpZ2h0IiwicHJvamVjdGlvbiIsInByb2plY3Rpb25NYXRyaXgiLCJfZXZhbHVhdGVQcm9qZWN0aW9uTWF0cml4IiwicmVuZGVyVGFyZ2V0Iiwidmlld01hdHJpeCIsInd0bSIsImdldFdvcmxkVHJhbnNmb3JtIiwiaW52ZXJ0IiwiYXBlcnR1cmUiLCJzZW5zaXRpdml0eSIsInNodXR0ZXIiLCJjbG9uZSIsIm90aGVyIiwiX3VwZGF0ZVZpZXdQcm9qTWF0IiwibXVsMiIsIndvcmxkVG9TY3JlZW4iLCJ3b3JsZENvb3JkIiwiY3ciLCJjaCIsInNjcmVlbkNvb3JkIiwidHJhbnNmb3JtUG9pbnQiLCJ2cG0iLCJkYXRhIiwic2NyZWVuVG9Xb3JsZCIsInJhbmdlIiwic2V0IiwibXVsU2NhbGFyIiwic3ViIiwiT05FIiwiX2dldFBlcnNwZWN0aXZlSGFsZlNpemUiLCJpbnZWaWV3IiwiY2FtZXJhUG9zIiwiZ2V0UG9zaXRpb24iLCJzdWIyIiwibm9ybWFsaXplIiwiYWRkIiwic2V0UGVyc3BlY3RpdmUiLCJzZXRPcnRobyIsImdldFByb2plY3Rpb25NYXRyaXhTa3lib3giLCJnZXRFeHBvc3VyZSIsImV2MTAwIiwiTWF0aCIsImxvZzIiLCJwb3ciLCJnZXRTY3JlZW5TaXplIiwic3BoZXJlIiwiZGlzdGFuY2UiLCJjZW50ZXIiLCJyYWRpdXMiLCJ2aWV3QW5nbGUiLCJhc2luIiwic3BoZXJlVmlld0hlaWdodCIsInRhbiIsInNjcmVlblZpZXdIZWlnaHQiLCJtYXRoIiwiREVHX1RPX1JBRCIsIm1pbiIsImNsYW1wIiwiZ2V0RnJ1c3R1bUNvcm5lcnMiLCJuZWFyIiwiZmFyIiwiUEkiLCJwb2ludHMiLCJzZXRYclByb3BlcnRpZXMiLCJwcm9wZXJ0aWVzIiwiT2JqZWN0IiwiYXNzaWduIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWFBO0FBQ0EsTUFBTUEsWUFBWSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQy9CLE1BQU1DLFNBQVMsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUM1QixNQUFNRSxNQUFNLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDekIsTUFBTUcsZUFBZSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ2xDLE1BQU1DLGNBQWMsR0FBRyxDQUFDLElBQUlMLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxFQUFFLElBQUlBLElBQUksRUFBRSxDQUFDLENBQUE7O0FBRXZIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNTSxNQUFNLENBQUM7QUFNVEMsRUFBQUEsV0FBV0EsR0FBRztBQUxkO0FBQ0o7QUFDQTtBQUZJLElBQUEsSUFBQSxDQUdBQyxjQUFjLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFHVixJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBR0MsV0FBVyxDQUFBO0lBQ25DLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsSUFBSSxDQUFBO0lBQ2hDLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsSUFB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
