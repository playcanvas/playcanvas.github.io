/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { math } from '../core/math/math.js';
import { Frustum } from '../core/shape/frustum.js';
import { ASPECT_AUTO, LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE, PROJECTION_PERSPECTIVE } from './constants.js';

const _deviceCoord = new Vec3();
const _halfSize = new Vec3();
const _point = new Vec3();
const _invViewProjMat = new Mat4();
const _frustumPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];

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
    this._scissorRectClear = false;
    this._aperture = 16.0;
    this._shutter = 1.0 / 1000.0;
    this._sensitivity = 1000;
    this._projMat = new Mat4();
    this._projMatDirty = true;
    this._projMatSkybox = new Mat4();
    this._viewMat = new Mat4();
    this._viewMatDirty = true;
    this._viewProjMat = new Mat4();
    this._viewProjMatDirty = true;
    this.frustum = new Frustum();
  }

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
    return this._aspectRatio;
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
    return this._farClip;
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
    return this._fov;
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
    return this._horizontalFov;
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
    return this._nearClip;
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

  clone() {
    return new Camera().copy(this);
  }

  copy(other) {
    this.aspectRatio = other.aspectRatio;
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
    this.farClip = other.farClip;
    this.flipFaces = other.flipFaces;
    this.fov = other.fov;
    this.frustumCulling = other.frustumCulling;
    this.horizontalFov = other.horizontalFov;
    this.layers = other.layers;
    this.nearClip = other.nearClip;
    this.orthoHeight = other.orthoHeight;
    this.projection = other.projection;
    this.rect = other.rect;
    this.renderTarget = other.renderTarget;
    this.scissorRect = other.scissorRect;
    this.aperture = other.aperture;
    this.shutter = other.shutter;
    this.sensitivity = other.sensitivity;
    return this;
  }
  _updateViewProjMat() {
    if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
      this._viewProjMat.mul2(this.projectionMatrix, this.viewMatrix);
      this._viewProjMatDirty = false;
    }
  }

  worldToScreen(worldCoord, cw, ch, screenCoord = new Vec3()) {
    this._updateViewProjMat();
    this._viewProjMat.transformPoint(worldCoord, screenCoord);

    const vpm = this._viewProjMat.data;
    const w = worldCoord.x * vpm[3] + worldCoord.y * vpm[7] + worldCoord.z * vpm[11] + 1 * vpm[15];
    screenCoord.x = (screenCoord.x / w + 1) * 0.5 * cw;
    screenCoord.y = (1 - screenCoord.y / w) * 0.5 * ch;
    return screenCoord;
  }

  screenToWorld(x, y, z, cw, ch, worldCoord = new Vec3()) {
    const range = this._farClip - this._nearClip;
    _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
    _deviceCoord.mulScalar(2);
    _deviceCoord.sub(Vec3.ONE);
    if (this._projection === PROJECTION_PERSPECTIVE) {
      Mat4._getPerspectiveHalfSize(_halfSize, this._fov, this._aspectRatio, this._nearClip, this._horizontalFov);

      _halfSize.x *= _deviceCoord.x;
      _halfSize.y *= _deviceCoord.y;

      const invView = this._node.getWorldTransform();
      _halfSize.z = -this._nearClip;
      invView.transformPoint(_halfSize, _point);

      const cameraPos = this._node.getPosition();
      worldCoord.sub2(_point, cameraPos);
      worldCoord.normalize();
      worldCoord.mulScalar(z);
      worldCoord.add(cameraPos);
    } else {
      this._updateViewProjMat();
      _invViewProjMat.copy(this._viewProjMat).invert();

      _invViewProjMat.transformPoint(_deviceCoord, worldCoord);
    }
    return worldCoord;
  }
  _evaluateProjectionMatrix() {
    if (this._projMatDirty) {
      if (this._projection === PROJECTION_PERSPECTIVE) {
        this._projMat.setPerspective(this._fov, this._aspectRatio, this._nearClip, this._farClip, this._horizontalFov);
        this._projMatSkybox.copy(this._projMat);
      } else {
        const y = this._orthoHeight;
        const x = y * this._aspectRatio;
        this._projMat.setOrtho(-x, x, -y, y, this._nearClip, this._farClip);
        this._projMatSkybox.setPerspective(this._fov, this._aspectRatio, this._nearClip, this._farClip);
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

  getScreenSize(sphere) {
    if (this._projection === PROJECTION_PERSPECTIVE) {
      const distance = this._node.getPosition().distance(sphere.center);

      if (distance < sphere.radius) {
        return 1;
      }

      const viewAngle = Math.asin(sphere.radius / distance);

      const sphereViewHeight = Math.tan(viewAngle);

      const screenViewHeight = Math.tan(this._fov / 2 * math.DEG_TO_RAD);

      return Math.min(sphereViewHeight / screenViewHeight, 1);
    }

    return math.clamp(sphere.radius / this._orthoHeight, 0, 1);
  }

  getFrustumCorners(near = this._nearClip, far = this._farClip) {
    const fov = this._fov * Math.PI / 180.0;
    let y = this._projection === PROJECTION_PERSPECTIVE ? Math.tan(fov / 2.0) * near : this._orthoHeight;
    let x = y * this._aspectRatio;
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
      x = y * this._aspectRatio;
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
}

export { Camera };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FtZXJhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvY2FtZXJhLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IEZydXN0dW0gfSBmcm9tICcuLi9jb3JlL3NoYXBlL2ZydXN0dW0uanMnO1xuXG5pbXBvcnQge1xuICAgIEFTUEVDVF9BVVRPLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIExBWUVSSURfV09STEQsIExBWUVSSURfREVQVEgsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX0lNTUVESUFURVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8vIHByZS1hbGxvY2F0ZWQgdGVtcCB2YXJpYWJsZXNcbmNvbnN0IF9kZXZpY2VDb29yZCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfaGFsZlNpemUgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BvaW50ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9pbnZWaWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfZnJ1c3R1bVBvaW50cyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcblxuLyoqXG4gKiBBIGNhbWVyYS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIENhbWVyYSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuX2FzcGVjdFJhdGlvID0gMTYgLyA5O1xuICAgICAgICB0aGlzLl9hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfQVVUTztcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlUHJvamVjdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVRyYW5zZm9ybSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMC43NSwgMC43NSwgMC43NSwgMSk7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXIgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoID0gMTtcbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbCA9IDA7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2N1bGxpbmdNYXNrID0gMHhGRkZGRkZGRjtcbiAgICAgICAgdGhpcy5fY3VsbEZhY2VzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZmFyQ2xpcCA9IDEwMDA7XG4gICAgICAgIHRoaXMuX2ZsaXBGYWNlcyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9mb3YgPSA0NTtcbiAgICAgICAgdGhpcy5fZnJ1c3R1bUN1bGxpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9ob3Jpem9udGFsRm92ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1dPUkxELCBMQVlFUklEX0RFUFRILCBMQVlFUklEX1NLWUJPWCwgTEFZRVJJRF9VSSwgTEFZRVJJRF9JTU1FRElBVEVdO1xuICAgICAgICB0aGlzLl9sYXllcnNTZXQgPSBuZXcgU2V0KHRoaXMuX2xheWVycyk7XG4gICAgICAgIHRoaXMuX25lYXJDbGlwID0gMC4xO1xuICAgICAgICB0aGlzLl9ub2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fb3J0aG9IZWlnaHQgPSAxMDtcbiAgICAgICAgdGhpcy5fcHJvamVjdGlvbiA9IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgICAgIHRoaXMuX3JlY3QgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2Npc3NvclJlY3QgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fc2Npc3NvclJlY3RDbGVhciA9IGZhbHNlOyAvLyBieSBkZWZhdWx0IHJlY3QgaXMgdXNlZCB3aGVuIGNsZWFyaW5nLiB0aGlzIGFsbG93cyBzY2lzc29yUmVjdCB0byBiZSB1c2VkIHdoZW4gY2xlYXJpbmcuXG4gICAgICAgIHRoaXMuX2FwZXJ0dXJlID0gMTYuMDtcbiAgICAgICAgdGhpcy5fc2h1dHRlciA9IDEuMCAvIDEwMDAuMDtcbiAgICAgICAgdGhpcy5fc2Vuc2l0aXZpdHkgPSAxMDAwO1xuXG4gICAgICAgIHRoaXMuX3Byb2pNYXQgPSBuZXcgTWF0NCgpO1xuICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9wcm9qTWF0U2t5Ym94ID0gbmV3IE1hdDQoKTsgLy8gcHJvamVjdGlvbiBtYXRyaXggdXNlZCBieSBza3lib3ggcmVuZGVyaW5nIHNoYWRlciBpcyBhbHdheXMgcGVyc3BlY3RpdmVcbiAgICAgICAgdGhpcy5fdmlld01hdCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIHRoaXMuX3ZpZXdNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3ZpZXdQcm9qTWF0ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgdGhpcy5fdmlld1Byb2pNYXREaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5mcnVzdHVtID0gbmV3IEZydXN0dW0oKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBjYW1lcmEgY2xlYXJzIHRoZSBmdWxsIHJlbmRlciB0YXJnZXQuICh2aWV3cG9ydCAvIHNjaXNzb3IgYXJlIGZ1bGwgc2l6ZSlcbiAgICAgKi9cbiAgICBnZXQgZnVsbFNpemVDbGVhclJlY3QoKSB7XG5cbiAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuX3NjaXNzb3JSZWN0Q2xlYXIgPyB0aGlzLnNjaXNzb3JSZWN0IDogdGhpcy5fcmVjdDtcbiAgICAgICAgcmV0dXJuIHJlY3QueCA9PT0gMCAmJiByZWN0LnkgPT09IDAgJiYgcmVjdC56ID09PSAxICYmIHJlY3QudyA9PT0gMTtcbiAgICB9XG5cbiAgICBzZXQgYXNwZWN0UmF0aW8obmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FzcGVjdFJhdGlvICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYXNwZWN0UmF0aW8gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXNwZWN0UmF0aW8oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3BlY3RSYXRpbztcbiAgICB9XG5cbiAgICBzZXQgYXNwZWN0UmF0aW9Nb2RlKG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hc3BlY3RSYXRpb01vZGUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9hc3BlY3RSYXRpb01vZGUgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXNwZWN0UmF0aW9Nb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNwZWN0UmF0aW9Nb2RlO1xuICAgIH1cblxuICAgIHNldCBjYWxjdWxhdGVQcm9qZWN0aW9uKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVByb2plY3Rpb24gPSBuZXdWYWx1ZTtcbiAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FsY3VsYXRlUHJvamVjdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZVByb2plY3Rpb247XG4gICAgfVxuXG4gICAgc2V0IGNhbGN1bGF0ZVRyYW5zZm9ybShuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVUcmFuc2Zvcm0gPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FsY3VsYXRlVHJhbnNmb3JtKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIHNldCBjbGVhckNvbG9yKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3IuY29weShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckNvbG9yO1xuICAgIH1cblxuICAgIHNldCBjbGVhckNvbG9yQnVmZmVyKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXIgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJDb2xvckJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXI7XG4gICAgfVxuXG4gICAgc2V0IGNsZWFyRGVwdGgobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aCA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJEZXB0aDtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJEZXB0aEJ1ZmZlcihuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoQnVmZmVyID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyRGVwdGhCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckRlcHRoQnVmZmVyO1xuICAgIH1cblxuICAgIHNldCBjbGVhclN0ZW5jaWwobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyU3RlbmNpbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyU3RlbmNpbDtcbiAgICB9XG5cbiAgICBzZXQgY2xlYXJTdGVuY2lsQnVmZmVyKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlciA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhclN0ZW5jaWxCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgfVxuXG4gICAgc2V0IGN1bGxpbmdNYXNrKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1bGxpbmdNYXNrID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGN1bGxpbmdNYXNrKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VsbGluZ01hc2s7XG4gICAgfVxuXG4gICAgc2V0IGN1bGxGYWNlcyhuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9jdWxsRmFjZXMgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY3VsbEZhY2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VsbEZhY2VzO1xuICAgIH1cblxuICAgIHNldCBmYXJDbGlwKG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mYXJDbGlwICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZmFyQ2xpcCA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmYXJDbGlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmFyQ2xpcDtcbiAgICB9XG5cbiAgICBzZXQgZmxpcEZhY2VzKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2ZsaXBGYWNlcyA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmbGlwRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwRmFjZXM7XG4gICAgfVxuXG4gICAgc2V0IGZvdihuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZm92ICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZm92ID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZvdigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZvdjtcbiAgICB9XG5cbiAgICBzZXQgZnJ1c3R1bUN1bGxpbmcobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZnJ1c3R1bUN1bGxpbmcgPSBuZXdWYWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZnJ1c3R1bUN1bGxpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mcnVzdHVtQ3VsbGluZztcbiAgICB9XG5cbiAgICBzZXQgaG9yaXpvbnRhbEZvdihuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faG9yaXpvbnRhbEZvdiAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2hvcml6b250YWxGb3YgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaG9yaXpvbnRhbEZvdigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hvcml6b250YWxGb3Y7XG4gICAgfVxuXG4gICAgc2V0IGxheWVycyhuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBuZXdWYWx1ZS5zbGljZSgwKTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzU2V0ID0gbmV3IFNldCh0aGlzLl9sYXllcnMpO1xuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVyc1NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyc1NldDtcbiAgICB9XG5cbiAgICBzZXQgbmVhckNsaXAobmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX25lYXJDbGlwICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbmVhckNsaXAgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Byb2pNYXREaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbmVhckNsaXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9uZWFyQ2xpcDtcbiAgICB9XG5cbiAgICBzZXQgbm9kZShuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLl9ub2RlID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG5vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ub2RlO1xuICAgIH1cblxuICAgIHNldCBvcnRob0hlaWdodChuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fb3J0aG9IZWlnaHQgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9vcnRob0hlaWdodCA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcnRob0hlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29ydGhvSGVpZ2h0O1xuICAgIH1cblxuICAgIHNldCBwcm9qZWN0aW9uKG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcm9qZWN0aW9uICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcHJvamVjdGlvbiA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcHJvak1hdERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwcm9qZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJvamVjdGlvbjtcbiAgICB9XG5cbiAgICBnZXQgcHJvamVjdGlvbk1hdHJpeCgpIHtcbiAgICAgICAgdGhpcy5fZXZhbHVhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcm9qTWF0O1xuICAgIH1cblxuICAgIHNldCByZWN0KG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlY3QuY29weShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWN0O1xuICAgIH1cblxuICAgIHNldCByZW5kZXJUYXJnZXQobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0ID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclRhcmdldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICBzZXQgc2Npc3NvclJlY3QobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2Npc3NvclJlY3QuY29weShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHNjaXNzb3JSZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2Npc3NvclJlY3Q7XG4gICAgfVxuXG4gICAgZ2V0IHZpZXdNYXRyaXgoKSB7XG4gICAgICAgIGlmICh0aGlzLl92aWV3TWF0RGlydHkpIHtcbiAgICAgICAgICAgIGNvbnN0IHd0bSA9IHRoaXMuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIHRoaXMuX3ZpZXdNYXQuY29weSh3dG0pLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5fdmlld01hdERpcnR5ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZpZXdNYXQ7XG4gICAgfVxuXG4gICAgc2V0IGFwZXJ0dXJlKG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FwZXJ0dXJlID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFwZXJ0dXJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXBlcnR1cmU7XG4gICAgfVxuXG4gICAgc2V0IHNlbnNpdGl2aXR5KG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NlbnNpdGl2aXR5ID0gbmV3VmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNlbnNpdGl2aXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2Vuc2l0aXZpdHk7XG4gICAgfVxuXG4gICAgc2V0IHNodXR0ZXIobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2h1dHRlciA9IG5ld1ZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzaHV0dGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2h1dHRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZHVwbGljYXRlIG9mIHRoZSBjYW1lcmEuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Q2FtZXJhfSBBIGNsb25lZCBDYW1lcmEuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgQ2FtZXJhKCkuY29weSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgb25lIGNhbWVyYSB0byBhbm90aGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDYW1lcmF9IG90aGVyIC0gQ2FtZXJhIHRvIGNvcHkuXG4gICAgICogQHJldHVybnMge0NhbWVyYX0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY29weShvdGhlcikge1xuICAgICAgICB0aGlzLmFzcGVjdFJhdGlvID0gb3RoZXIuYXNwZWN0UmF0aW87XG4gICAgICAgIHRoaXMuYXNwZWN0UmF0aW9Nb2RlID0gb3RoZXIuYXNwZWN0UmF0aW9Nb2RlO1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVByb2plY3Rpb24gPSBvdGhlci5jYWxjdWxhdGVQcm9qZWN0aW9uO1xuICAgICAgICB0aGlzLmNhbGN1bGF0ZVRyYW5zZm9ybSA9IG90aGVyLmNhbGN1bGF0ZVRyYW5zZm9ybTtcbiAgICAgICAgdGhpcy5jbGVhckNvbG9yID0gb3RoZXIuY2xlYXJDb2xvcjtcbiAgICAgICAgdGhpcy5jbGVhckNvbG9yQnVmZmVyID0gb3RoZXIuY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gb3RoZXIuY2xlYXJEZXB0aDtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoQnVmZmVyID0gb3RoZXIuY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSBvdGhlci5jbGVhclN0ZW5jaWw7XG4gICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsQnVmZmVyID0gb3RoZXIuY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgICAgICB0aGlzLmN1bGxGYWNlcyA9IG90aGVyLmN1bGxGYWNlcztcbiAgICAgICAgdGhpcy5jdWxsaW5nTWFzayA9IG90aGVyLmN1bGxpbmdNYXNrO1xuICAgICAgICB0aGlzLmZhckNsaXAgPSBvdGhlci5mYXJDbGlwO1xuICAgICAgICB0aGlzLmZsaXBGYWNlcyA9IG90aGVyLmZsaXBGYWNlcztcbiAgICAgICAgdGhpcy5mb3YgPSBvdGhlci5mb3Y7XG4gICAgICAgIHRoaXMuZnJ1c3R1bUN1bGxpbmcgPSBvdGhlci5mcnVzdHVtQ3VsbGluZztcbiAgICAgICAgdGhpcy5ob3Jpem9udGFsRm92ID0gb3RoZXIuaG9yaXpvbnRhbEZvdjtcbiAgICAgICAgdGhpcy5sYXllcnMgPSBvdGhlci5sYXllcnM7XG4gICAgICAgIHRoaXMubmVhckNsaXAgPSBvdGhlci5uZWFyQ2xpcDtcbiAgICAgICAgdGhpcy5vcnRob0hlaWdodCA9IG90aGVyLm9ydGhvSGVpZ2h0O1xuICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBvdGhlci5wcm9qZWN0aW9uO1xuICAgICAgICB0aGlzLnJlY3QgPSBvdGhlci5yZWN0O1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG90aGVyLnJlbmRlclRhcmdldDtcbiAgICAgICAgdGhpcy5zY2lzc29yUmVjdCA9IG90aGVyLnNjaXNzb3JSZWN0O1xuICAgICAgICB0aGlzLmFwZXJ0dXJlID0gb3RoZXIuYXBlcnR1cmU7XG4gICAgICAgIHRoaXMuc2h1dHRlciA9IG90aGVyLnNodXR0ZXI7XG4gICAgICAgIHRoaXMuc2Vuc2l0aXZpdHkgPSBvdGhlci5zZW5zaXRpdml0eTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVZpZXdQcm9qTWF0KCkge1xuICAgICAgICBpZiAodGhpcy5fcHJvak1hdERpcnR5IHx8IHRoaXMuX3ZpZXdNYXREaXJ0eSB8fCB0aGlzLl92aWV3UHJvak1hdERpcnR5KSB7XG4gICAgICAgICAgICB0aGlzLl92aWV3UHJvak1hdC5tdWwyKHRoaXMucHJvamVjdGlvbk1hdHJpeCwgdGhpcy52aWV3TWF0cml4KTtcbiAgICAgICAgICAgIHRoaXMuX3ZpZXdQcm9qTWF0RGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgYSBwb2ludCBmcm9tIDNEIHdvcmxkIHNwYWNlIHRvIDJEIGNhbnZhcyBwaXhlbCBzcGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gd29ybGRDb29yZCAtIFRoZSB3b3JsZCBzcGFjZSBjb29yZGluYXRlIHRvIHRyYW5zZm9ybS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY3cgLSBUaGUgd2lkdGggb2YgUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNoIC0gVGhlIGhlaWdodCBvZiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtzY3JlZW5Db29yZF0gLSAzRCB2ZWN0b3IgdG8gcmVjZWl2ZSBzY3JlZW4gY29vcmRpbmF0ZSByZXN1bHQuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBzY3JlZW4gc3BhY2UgY29vcmRpbmF0ZS5cbiAgICAgKi9cbiAgICB3b3JsZFRvU2NyZWVuKHdvcmxkQ29vcmQsIGN3LCBjaCwgc2NyZWVuQ29vcmQgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpZXdQcm9qTWF0KCk7XG4gICAgICAgIHRoaXMuX3ZpZXdQcm9qTWF0LnRyYW5zZm9ybVBvaW50KHdvcmxkQ29vcmQsIHNjcmVlbkNvb3JkKTtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgdyBjby1jb29yZFxuICAgICAgICBjb25zdCB2cG0gPSB0aGlzLl92aWV3UHJvak1hdC5kYXRhO1xuICAgICAgICBjb25zdCB3ID0gd29ybGRDb29yZC54ICogdnBtWzNdICtcbiAgICAgICAgICAgICAgICB3b3JsZENvb3JkLnkgKiB2cG1bN10gK1xuICAgICAgICAgICAgICAgIHdvcmxkQ29vcmQueiAqIHZwbVsxMV0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgMSAqIHZwbVsxNV07XG5cbiAgICAgICAgc2NyZWVuQ29vcmQueCA9IChzY3JlZW5Db29yZC54IC8gdyArIDEpICogMC41ICogY3c7XG4gICAgICAgIHNjcmVlbkNvb3JkLnkgPSAoMSAtIHNjcmVlbkNvb3JkLnkgLyB3KSAqIDAuNSAqIGNoO1xuXG4gICAgICAgIHJldHVybiBzY3JlZW5Db29yZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGEgcG9pbnQgZnJvbSAyRCBjYW52YXMgcGl4ZWwgc3BhY2UgdG8gM0Qgd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFggY29vcmRpbmF0ZSBvbiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFkgY29vcmRpbmF0ZSBvbiBQbGF5Q2FudmFzJyBjYW52YXMgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBjYW1lcmEgaW4gd29ybGQgc3BhY2UgdG8gY3JlYXRlIHRoZSBuZXcgcG9pbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGN3IC0gVGhlIHdpZHRoIG9mIFBsYXlDYW52YXMnIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjaCAtIFRoZSBoZWlnaHQgb2YgUGxheUNhbnZhcycgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbd29ybGRDb29yZF0gLSAzRCB2ZWN0b3IgdG8gcmVjZWl2ZSB3b3JsZCBjb29yZGluYXRlIHJlc3VsdC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgc2NyZWVuVG9Xb3JsZCh4LCB5LCB6LCBjdywgY2gsIHdvcmxkQ29vcmQgPSBuZXcgVmVjMygpKSB7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIHRoZSBzY3JlZW4gY2xpY2sgYXMgYSBwb2ludCBvbiB0aGUgZmFyIHBsYW5lIG9mIHRoZSBub3JtYWxpemVkIGRldmljZSBjb29yZGluYXRlICdib3gnICh6PTEpXG4gICAgICAgIGNvbnN0IHJhbmdlID0gdGhpcy5fZmFyQ2xpcCAtIHRoaXMuX25lYXJDbGlwO1xuICAgICAgICBfZGV2aWNlQ29vcmQuc2V0KHggLyBjdywgKGNoIC0geSkgLyBjaCwgeiAvIHJhbmdlKTtcbiAgICAgICAgX2RldmljZUNvb3JkLm11bFNjYWxhcigyKTtcbiAgICAgICAgX2RldmljZUNvb3JkLnN1YihWZWMzLk9ORSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpIHtcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGhhbGYgd2lkdGggYW5kIGhlaWdodCBhdCB0aGUgbmVhciBjbGlwIHBsYW5lXG4gICAgICAgICAgICBNYXQ0Ll9nZXRQZXJzcGVjdGl2ZUhhbGZTaXplKF9oYWxmU2l6ZSwgdGhpcy5fZm92LCB0aGlzLl9hc3BlY3RSYXRpbywgdGhpcy5fbmVhckNsaXAsIHRoaXMuX2hvcml6b250YWxGb3YpO1xuXG4gICAgICAgICAgICAvLyBzY2FsZSBieSBub3JtYWxpemVkIHNjcmVlbiBjb29yZGluYXRlc1xuICAgICAgICAgICAgX2hhbGZTaXplLnggKj0gX2RldmljZUNvb3JkLng7XG4gICAgICAgICAgICBfaGFsZlNpemUueSAqPSBfZGV2aWNlQ29vcmQueTtcblxuICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICBjb25zdCBpbnZWaWV3ID0gdGhpcy5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgX2hhbGZTaXplLnogPSAtdGhpcy5fbmVhckNsaXA7XG4gICAgICAgICAgICBpbnZWaWV3LnRyYW5zZm9ybVBvaW50KF9oYWxmU2l6ZSwgX3BvaW50KTtcblxuICAgICAgICAgICAgLy8gcG9pbnQgYWxvbmcgY2FtZXJhLT5fcG9pbnQgcmF5IGF0IGRpc3RhbmNlIHogZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFQb3MgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB3b3JsZENvb3JkLnN1YjIoX3BvaW50LCBjYW1lcmFQb3MpO1xuICAgICAgICAgICAgd29ybGRDb29yZC5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHdvcmxkQ29vcmQubXVsU2NhbGFyKHopO1xuICAgICAgICAgICAgd29ybGRDb29yZC5hZGQoY2FtZXJhUG9zKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB0aGlzLl91cGRhdGVWaWV3UHJvak1hdCgpO1xuICAgICAgICAgICAgX2ludlZpZXdQcm9qTWF0LmNvcHkodGhpcy5fdmlld1Byb2pNYXQpLmludmVydCgpO1xuXG4gICAgICAgICAgICAgICAgLy8gVHJhbnNmb3JtIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICBfaW52Vmlld1Byb2pNYXQudHJhbnNmb3JtUG9pbnQoX2RldmljZUNvb3JkLCB3b3JsZENvb3JkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB3b3JsZENvb3JkO1xuICAgIH1cblxuICAgIF9ldmFsdWF0ZVByb2plY3Rpb25NYXRyaXgoKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcm9qTWF0RGlydHkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvak1hdC5zZXRQZXJzcGVjdGl2ZSh0aGlzLl9mb3YsIHRoaXMuX2FzcGVjdFJhdGlvLCB0aGlzLl9uZWFyQ2xpcCwgdGhpcy5fZmFyQ2xpcCwgdGhpcy5faG9yaXpvbnRhbEZvdik7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJvak1hdFNreWJveC5jb3B5KHRoaXMuX3Byb2pNYXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gdGhpcy5fb3J0aG9IZWlnaHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IHkgKiB0aGlzLl9hc3BlY3RSYXRpbztcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9qTWF0LnNldE9ydGhvKC14LCB4LCAteSwgeSwgdGhpcy5fbmVhckNsaXAsIHRoaXMuX2ZhckNsaXApO1xuICAgICAgICAgICAgICAgIHRoaXMuX3Byb2pNYXRTa3lib3guc2V0UGVyc3BlY3RpdmUodGhpcy5fZm92LCB0aGlzLl9hc3BlY3RSYXRpbywgdGhpcy5fbmVhckNsaXAsIHRoaXMuX2ZhckNsaXApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9wcm9qTWF0RGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldFByb2plY3Rpb25NYXRyaXhTa3lib3goKSB7XG4gICAgICAgIHRoaXMuX2V2YWx1YXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJvak1hdFNreWJveDtcbiAgICB9XG5cbiAgICBnZXRFeHBvc3VyZSgpIHtcbiAgICAgICAgY29uc3QgZXYxMDAgPSBNYXRoLmxvZzIoKHRoaXMuX2FwZXJ0dXJlICogdGhpcy5fYXBlcnR1cmUpIC8gdGhpcy5fc2h1dHRlciAqIDEwMC4wIC8gdGhpcy5fc2Vuc2l0aXZpdHkpO1xuICAgICAgICByZXR1cm4gMS4wIC8gKE1hdGgucG93KDIuMCwgZXYxMDApICogMS4yKTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGVzdGltYXRlZCBzaXplIG9mIHRoZSBzcGhlcmUgb24gdGhlIHNjcmVlbiBpbiByYW5nZSBvZiBbMC4uMV1cbiAgICAvLyAwIC0gaW5maW5pdGVseSBzbWFsbCwgMSAtIGZ1bGwgc2NyZWVuIG9yIGxhcmdlclxuICAgIGdldFNjcmVlblNpemUoc3BoZXJlKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Byb2plY3Rpb24gPT09IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpIHtcblxuICAgICAgICAgICAgLy8gY2FtZXJhIHRvIHNwaGVyZSBkaXN0YW5jZVxuICAgICAgICAgICAgY29uc3QgZGlzdGFuY2UgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCkuZGlzdGFuY2Uoc3BoZXJlLmNlbnRlcik7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlJ3JlIGluc2lkZSB0aGUgc3BoZXJlXG4gICAgICAgICAgICBpZiAoZGlzdGFuY2UgPCBzcGhlcmUucmFkaXVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRoZSB2aWV3LWFuZ2xlIG9mIHRoZSBib3VuZGluZyBzcGhlcmUgcmVuZGVyZWQgb24gc2NyZWVuXG4gICAgICAgICAgICBjb25zdCB2aWV3QW5nbGUgPSBNYXRoLmFzaW4oc3BoZXJlLnJhZGl1cyAvIGRpc3RhbmNlKTtcblxuICAgICAgICAgICAgLy8gVGhpcyBhc3N1bWVzIHRoZSBuZWFyIGNsaXBwaW5nIHBsYW5lIGlzIGF0IGEgZGlzdGFuY2Ugb2YgMVxuICAgICAgICAgICAgY29uc3Qgc3BoZXJlVmlld0hlaWdodCA9IE1hdGgudGFuKHZpZXdBbmdsZSk7XG5cbiAgICAgICAgICAgIC8vIFRoZSBzaXplIG9mIChoYWxmKSB0aGUgc2NyZWVuIGlmIHRoZSBuZWFyIGNsaXBwaW5nIHBsYW5lIGlzIGF0IGEgZGlzdGFuY2Ugb2YgMVxuICAgICAgICAgICAgY29uc3Qgc2NyZWVuVmlld0hlaWdodCA9IE1hdGgudGFuKCh0aGlzLl9mb3YgLyAyKSAqIG1hdGguREVHX1RPX1JBRCk7XG5cbiAgICAgICAgICAgIC8vIFRoZSByYXRpbyBvZiB0aGUgZ2VvbWV0cnkncyBzY3JlZW4gc2l6ZSBjb21wYXJlZCB0byB0aGUgYWN0dWFsIHNpemUgb2YgdGhlIHNjcmVlblxuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWluKHNwaGVyZVZpZXdIZWlnaHQgLyBzY3JlZW5WaWV3SGVpZ2h0LCAxKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gb3J0aG9cbiAgICAgICAgcmV0dXJuIG1hdGguY2xhbXAoc3BoZXJlLnJhZGl1cyAvIHRoaXMuX29ydGhvSGVpZ2h0LCAwLCAxKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGNvcm5lcnMgb2YgdGhlIGZydXN0dW0gb2YgdGhlIGNhbWVyYSBpbiB0aGUgbG9jYWwgY29vcmRpbmF0ZSBzeXN0ZW0gb2YgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbmVhcl0gLSBOZWFyIGRpc3RhbmNlIGZvciB0aGUgZnJ1c3R1bSBwb2ludHMuIERlZmF1bHRzIHRvIHRoZSBuZWFyIGNsaXAgZGlzdGFuY2Ugb2YgdGhlIGNhbWVyYS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2Zhcl0gLSBGYXIgZGlzdGFuY2UgZm9yIHRoZSBmcnVzdHVtIHBvaW50cy4gRGVmYXVsdHMgdG8gdGhlIGZhciBjbGlwIGRpc3RhbmNlIG9mIHRoZSBjYW1lcmEuXG4gICAgICogQHJldHVybnMge1ZlYzNbXX0gLSBBbiBhcnJheSBvZiBjb3JuZXJzLCB1c2luZyBhIGdsb2JhbCBzdG9yYWdlIHNwYWNlLlxuICAgICAqL1xuICAgIGdldEZydXN0dW1Db3JuZXJzKG5lYXIgPSB0aGlzLl9uZWFyQ2xpcCwgZmFyID0gdGhpcy5fZmFyQ2xpcCkge1xuXG4gICAgICAgIGNvbnN0IGZvdiA9IHRoaXMuX2ZvdiAqIE1hdGguUEkgLyAxODAuMDtcbiAgICAgICAgbGV0IHkgPSB0aGlzLl9wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFID8gTWF0aC50YW4oZm92IC8gMi4wKSAqIG5lYXIgOiB0aGlzLl9vcnRob0hlaWdodDtcbiAgICAgICAgbGV0IHggPSB5ICogdGhpcy5fYXNwZWN0UmF0aW87XG5cbiAgICAgICAgY29uc3QgcG9pbnRzID0gX2ZydXN0dW1Qb2ludHM7XG4gICAgICAgIHBvaW50c1swXS54ID0geDtcbiAgICAgICAgcG9pbnRzWzBdLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzBdLnogPSAtbmVhcjtcbiAgICAgICAgcG9pbnRzWzFdLnggPSB4O1xuICAgICAgICBwb2ludHNbMV0ueSA9IHk7XG4gICAgICAgIHBvaW50c1sxXS56ID0gLW5lYXI7XG4gICAgICAgIHBvaW50c1syXS54ID0gLXg7XG4gICAgICAgIHBvaW50c1syXS55ID0geTtcbiAgICAgICAgcG9pbnRzWzJdLnogPSAtbmVhcjtcbiAgICAgICAgcG9pbnRzWzNdLnggPSAteDtcbiAgICAgICAgcG9pbnRzWzNdLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzNdLnogPSAtbmVhcjtcblxuICAgICAgICBpZiAodGhpcy5fcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9QRVJTUEVDVElWRSkge1xuICAgICAgICAgICAgeSA9IE1hdGgudGFuKGZvdiAvIDIuMCkgKiBmYXI7XG4gICAgICAgICAgICB4ID0geSAqIHRoaXMuX2FzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgICAgIHBvaW50c1s0XS54ID0geDtcbiAgICAgICAgcG9pbnRzWzRdLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzRdLnogPSAtZmFyO1xuICAgICAgICBwb2ludHNbNV0ueCA9IHg7XG4gICAgICAgIHBvaW50c1s1XS55ID0geTtcbiAgICAgICAgcG9pbnRzWzVdLnogPSAtZmFyO1xuICAgICAgICBwb2ludHNbNl0ueCA9IC14O1xuICAgICAgICBwb2ludHNbNl0ueSA9IHk7XG4gICAgICAgIHBvaW50c1s2XS56ID0gLWZhcjtcbiAgICAgICAgcG9pbnRzWzddLnggPSAteDtcbiAgICAgICAgcG9pbnRzWzddLnkgPSAteTtcbiAgICAgICAgcG9pbnRzWzddLnogPSAtZmFyO1xuXG4gICAgICAgIHJldHVybiBwb2ludHM7XG4gICAgfVxufVxuXG5leHBvcnQgeyBDYW1lcmEgfTtcbiJdLCJuYW1lcyI6WyJfZGV2aWNlQ29vcmQiLCJWZWMzIiwiX2hhbGZTaXplIiwiX3BvaW50IiwiX2ludlZpZXdQcm9qTWF0IiwiTWF0NCIsIl9mcnVzdHVtUG9pbnRzIiwiQ2FtZXJhIiwiY29uc3RydWN0b3IiLCJfYXNwZWN0UmF0aW8iLCJfYXNwZWN0UmF0aW9Nb2RlIiwiQVNQRUNUX0FVVE8iLCJfY2FsY3VsYXRlUHJvamVjdGlvbiIsIl9jYWxjdWxhdGVUcmFuc2Zvcm0iLCJfY2xlYXJDb2xvciIsIkNvbG9yIiwiX2NsZWFyQ29sb3JCdWZmZXIiLCJfY2xlYXJEZXB0aCIsIl9jbGVhckRlcHRoQnVmZmVyIiwiX2NsZWFyU3RlbmNpbCIsIl9jbGVhclN0ZW5jaWxCdWZmZXIiLCJfY3VsbGluZ01hc2siLCJfY3VsbEZhY2VzIiwiX2ZhckNsaXAiLCJfZmxpcEZhY2VzIiwiX2ZvdiIsIl9mcnVzdHVtQ3VsbGluZyIsIl9ob3Jpem9udGFsRm92IiwiX2xheWVycyIsIkxBWUVSSURfV09STEQiLCJMQVlFUklEX0RFUFRIIiwiTEFZRVJJRF9TS1lCT1giLCJMQVlFUklEX1VJIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJfbGF5ZXJzU2V0IiwiU2V0IiwiX25lYXJDbGlwIiwiX25vZGUiLCJfb3J0aG9IZWlnaHQiLCJfcHJvamVjdGlvbiIsIlBST0pFQ1RJT05fUEVSU1BFQ1RJVkUiLCJfcmVjdCIsIlZlYzQiLCJfcmVuZGVyVGFyZ2V0IiwiX3NjaXNzb3JSZWN0IiwiX3NjaXNzb3JSZWN0Q2xlYXIiLCJfYXBlcnR1cmUiLCJfc2h1dHRlciIsIl9zZW5zaXRpdml0eSIsIl9wcm9qTWF0IiwiX3Byb2pNYXREaXJ0eSIsIl9wcm9qTWF0U2t5Ym94IiwiX3ZpZXdNYXQiLCJfdmlld01hdERpcnR5IiwiX3ZpZXdQcm9qTWF0IiwiX3ZpZXdQcm9qTWF0RGlydHkiLCJmcnVzdHVtIiwiRnJ1c3R1bSIsImZ1bGxTaXplQ2xlYXJSZWN0IiwicmVjdCIsInNjaXNzb3JSZWN0IiwieCIsInkiLCJ6IiwidyIsImFzcGVjdFJhdGlvIiwibmV3VmFsdWUiLCJhc3BlY3RSYXRpb01vZGUiLCJjYWxjdWxhdGVQcm9qZWN0aW9uIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwiY2xlYXJDb2xvciIsImNvcHkiLCJjbGVhckNvbG9yQnVmZmVyIiwiY2xlYXJEZXB0aCIsImNsZWFyRGVwdGhCdWZmZXIiLCJjbGVhclN0ZW5jaWwiLCJjbGVhclN0ZW5jaWxCdWZmZXIiLCJjdWxsaW5nTWFzayIsImN1bGxGYWNlcyIsImZhckNsaXAiLCJmbGlwRmFjZXMiLCJmb3YiLCJmcnVzdHVtQ3VsbGluZyIsImhvcml6b250YWxGb3YiLCJsYXllcnMiLCJzbGljZSIsImxheWVyc1NldCIsIm5lYXJDbGlwIiwibm9kZSIsIm9ydGhvSGVpZ2h0IiwicHJvamVjdGlvbiIsInByb2plY3Rpb25NYXRyaXgiLCJfZXZhbHVhdGVQcm9qZWN0aW9uTWF0cml4IiwicmVuZGVyVGFyZ2V0Iiwidmlld01hdHJpeCIsInd0bSIsImdldFdvcmxkVHJhbnNmb3JtIiwiaW52ZXJ0IiwiYXBlcnR1cmUiLCJzZW5zaXRpdml0eSIsInNodXR0ZXIiLCJjbG9uZSIsIm90aGVyIiwiX3VwZGF0ZVZpZXdQcm9qTWF0IiwibXVsMiIsIndvcmxkVG9TY3JlZW4iLCJ3b3JsZENvb3JkIiwiY3ciLCJjaCIsInNjcmVlbkNvb3JkIiwidHJhbnNmb3JtUG9pbnQiLCJ2cG0iLCJkYXRhIiwic2NyZWVuVG9Xb3JsZCIsInJhbmdlIiwic2V0IiwibXVsU2NhbGFyIiwic3ViIiwiT05FIiwiX2dldFBlcnNwZWN0aXZlSGFsZlNpemUiLCJpbnZWaWV3IiwiY2FtZXJhUG9zIiwiZ2V0UG9zaXRpb24iLCJzdWIyIiwibm9ybWFsaXplIiwiYWRkIiwic2V0UGVyc3BlY3RpdmUiLCJzZXRPcnRobyIsImdldFByb2plY3Rpb25NYXRyaXhTa3lib3giLCJnZXRFeHBvc3VyZSIsImV2MTAwIiwiTWF0aCIsImxvZzIiLCJwb3ciLCJnZXRTY3JlZW5TaXplIiwic3BoZXJlIiwiZGlzdGFuY2UiLCJjZW50ZXIiLCJyYWRpdXMiLCJ2aWV3QW5nbGUiLCJhc2luIiwic3BoZXJlVmlld0hlaWdodCIsInRhbiIsInNjcmVlblZpZXdIZWlnaHQiLCJtYXRoIiwiREVHX1RPX1JBRCIsIm1pbiIsImNsYW1wIiwiZ2V0RnJ1c3R1bUNvcm5lcnMiLCJuZWFyIiwiZmFyIiwiUEkiLCJwb2ludHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFjQSxNQUFNQSxZQUFZLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDL0IsTUFBTUMsU0FBUyxHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBQzVCLE1BQU1FLE1BQU0sR0FBRyxJQUFJRixJQUFJLEVBQUUsQ0FBQTtBQUN6QixNQUFNRyxlQUFlLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDbEMsTUFBTUMsY0FBYyxHQUFHLENBQUMsSUFBSUwsSUFBSSxFQUFFLEVBQUUsSUFBSUEsSUFBSSxFQUFFLEVBQUUsSUFBSUEsSUFBSSxFQUFFLEVBQUUsSUFBSUEsSUFBSSxFQUFFLEVBQUUsSUFBSUEsSUFBSSxFQUFFLEVBQUUsSUFBSUEsSUFBSSxFQUFFLEVBQUUsSUFBSUEsSUFB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
