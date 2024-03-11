/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 2a805ddb9
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Vec3, Mat4, EventHandler, math, Entity, PROJECTION_PERSPECTIVE } from 'playcanvas';

const tmpV1 = new Vec3();
const tmpM1 = new Mat4();
const tmpM2 = new Mat4();
const xstart = new Vec3();
const xdir = new Vec3();
const MIN_GIZMO_SCALE = 1e-4;
const PERS_SCALE_RATIO = 0.3;
const PERS_CANVAS_RATIO = 1300;
const ORTHO_SCALE_RATIO = 0.32;
const GIZMO_LOCAL = 'local';
const GIZMO_WORLD = 'world';
class Gizmo extends EventHandler {
  constructor(app, camera, layer) {
    super();
    this._size = 1;
    this._scale = 1;
    this._coordSpace = GIZMO_WORLD;
    this._app = void 0;
    this._device = void 0;
    this._camera = void 0;
    this._layer = void 0;
    this.nodes = [];
    this.root = void 0;
    this.intersectData = [];
    this._app = app;
    this._device = app.graphicsDevice;
    this._camera = camera;
    this._layer = layer;
    this._createGizmo();
    this._updateScale();
    this._onPointerDown = e => {
      if (!this.root.enabled || document.pointerLockElement) {
        return;
      }
      const selection = this._getSelection(e.offsetX, e.offsetY);
      if (selection[0]) {
        e.preventDefault();
      }
      this.fire(Gizmo.EVENT_POINTERDOWN, e.offsetX, e.offsetY, selection[0]);
    };
    this._onPointerMove = e => {
      if (!this.root.enabled || document.pointerLockElement) {
        return;
      }
      const selection = this._getSelection(e.offsetX, e.offsetY);
      if (selection[0]) {
        e.preventDefault();
      }
      this.fire(Gizmo.EVENT_POINTERMOVE, e.offsetX, e.offsetY, selection[0]);
    };
    this._onPointerUp = e => {
      if (!this.root.enabled || document.pointerLockElement) {
        return;
      }
      this.fire(Gizmo.EVENT_POINTERUP);
    };
    this._device.canvas.addEventListener('pointerdown', this._onPointerDown);
    this._device.canvas.addEventListener('pointermove', this._onPointerMove);
    this._device.canvas.addEventListener('pointerup', this._onPointerUp);
    app.on('update', () => this._updateScale());
    app.on('destroy', () => this.destroy());
  }
  set coordSpace(value) {
    this._coordSpace = value != null ? value : GIZMO_WORLD;
    this._updateRotation();
  }
  get coordSpace() {
    return this._coordSpace;
  }
  set size(value) {
    this._size = value;
    this._updateScale();
  }
  get size() {
    return this._size;
  }
  _getProjFrustumWidth() {
    const gizmoPos = this.root.getPosition();
    const cameraPos = this._camera.entity.getPosition();
    const dist = tmpV1.copy(gizmoPos).sub(cameraPos).dot(this._camera.entity.forward);
    return dist * Math.tan(this._camera.fov * math.DEG_TO_RAD / 2);
  }
  _createGizmo() {
    this.root = new Entity('gizmo');
    this._app.root.addChild(this.root);
    this.root.enabled = false;
  }
  _updatePosition() {
    tmpV1.set(0, 0, 0);
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      tmpV1.add(node.getPosition());
    }
    tmpV1.mulScalar(1.0 / (this.nodes.length || 1));
    this.root.setPosition(tmpV1);
    this.fire(Gizmo.EVENT_POSITIONUPDATE, tmpV1);
  }
  _updateRotation() {
    tmpV1.set(0, 0, 0);
    if (this._coordSpace === GIZMO_LOCAL && this.nodes.length !== 0) {
      tmpV1.copy(this.nodes[this.nodes.length - 1].getEulerAngles());
    }
    this.root.setEulerAngles(tmpV1);
    this.fire(Gizmo.EVENT_ROTATIONUPDATE, tmpV1);
  }
  _updateScale() {
    if (this._camera.projection === PROJECTION_PERSPECTIVE) {
      let canvasMult = 1;
      if (this._device.width > 0 && this._device.height > 0) {
        canvasMult = PERS_CANVAS_RATIO / Math.min(this._device.width, this._device.height);
      }
      this._scale = this._getProjFrustumWidth() * canvasMult * PERS_SCALE_RATIO;
    } else {
      this._scale = this._camera.orthoHeight * ORTHO_SCALE_RATIO;
    }
    this._scale = Math.max(this._scale * this._size, MIN_GIZMO_SCALE);
    this.root.setLocalScale(this._scale, this._scale, this._scale);
    this.fire(Gizmo.EVENT_SCALEUPDATE, this._scale);
  }
  _getSelection(x, y) {
    const start = this._camera.screenToWorld(x, y, 1);
    const end = this._camera.screenToWorld(x, y, this._camera.farClip);
    const dir = end.clone().sub(start).normalize();
    const selection = [];
    for (let i = 0; i < this.intersectData.length; i++) {
      const {
        meshTriDataList,
        parent,
        meshInstances
      } = this.intersectData[i];
      const wtm = parent.getWorldTransform().clone();
      for (let j = 0; j < meshTriDataList.length; j++) {
        const {
          tris,
          ptm,
          priority
        } = meshTriDataList[j];
        tmpM1.copy(wtm).mul(ptm);
        tmpM2.copy(tmpM1).invert();
        tmpM2.transformPoint(start, xstart);
        tmpM2.transformVector(dir, xdir);
        xdir.normalize();
        for (let k = 0; k < tris.length; k++) {
          if (tris[k].intersectRay(xstart, xdir, tmpV1)) {
            selection.push({
              dist: tmpM1.transformPoint(tmpV1).sub(start).length(),
              meshInstances: meshInstances,
              priority: priority
            });
          }
        }
      }
    }
    if (selection.length) {
      selection.sort((s0, s1) => {
        if (s0.priority !== 0 && s1.priority !== 0) {
          return s1.priority - s0.priority;
        }
        return s0.dist - s1.dist;
      });
      return selection[0].meshInstances;
    }
    return [];
  }
  attach(nodes = []) {
    if (nodes.length === 0) {
      return;
    }
    this.nodes = nodes;
    this._updatePosition();
    this._updateRotation();
    this.fire(Gizmo.EVENT_NODESATTACH);
    this.root.enabled = true;
    this.fire(Gizmo.EVENT_RENDERUPDATE);
  }
  detach() {
    this.root.enabled = false;
    this.fire(Gizmo.EVENT_RENDERUPDATE);
    this.fire(Gizmo.EVENT_NODESDETACH);
    this.nodes = [];
  }
  destroy() {
    this.detach();
    this._device.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this._device.canvas.removeEventListener('pointermove', this._onPointerMove);
    this._device.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.root.destroy();
  }
}
Gizmo.EVENT_POINTERDOWN = 'pointer:down';
Gizmo.EVENT_POINTERMOVE = 'pointer:move';
Gizmo.EVENT_POINTERUP = 'pointer:up';
Gizmo.EVENT_POSITIONUPDATE = 'position:update';
Gizmo.EVENT_ROTATIONUPDATE = 'rotation:update';
Gizmo.EVENT_SCALEUPDATE = 'scale:update';
Gizmo.EVENT_NODESATTACH = 'nodes:attach';
Gizmo.EVENT_NODESDETACH = 'nodes:detach';
Gizmo.EVENT_RENDERUPDATE = 'render:update';

export { GIZMO_LOCAL, GIZMO_WORLD, Gizmo };
