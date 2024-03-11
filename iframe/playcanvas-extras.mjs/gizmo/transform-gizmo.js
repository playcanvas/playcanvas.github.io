/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 29eb79929
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Vec3, Quat, Color, PROJECTION_PERSPECTIVE, math, PROJECTION_ORTHOGRAPHIC } from 'playcanvas';
import { COLOR_RED, COLOR_GREEN, COLOR_BLUE, COLOR_YELLOW, COLOR_GRAY } from './default-colors.js';
import { Gizmo } from './gizmo.js';

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpQ1 = new Quat();
const pointDelta = new Vec3();
const VEC3_AXES = Object.keys(tmpV1);
const FACING_EPSILON = 0.2;
const SPANLINE_SIZE = 1e3;
const ROTATE_SCALE = 900;
const colorSemi = color => {
  const clone = color.clone();
  clone.a = 0.6;
  return clone;
};
class TransformGizmo extends Gizmo {
  constructor(app, camera, layer) {
    super(app, camera, layer);
    this._meshColors = {
      axis: {
        x: colorSemi(COLOR_RED),
        y: colorSemi(COLOR_GREEN),
        z: colorSemi(COLOR_BLUE),
        xyz: colorSemi(Color.WHITE),
        face: colorSemi(Color.WHITE)
      },
      hover: {
        x: COLOR_RED.clone(),
        y: COLOR_GREEN.clone(),
        z: COLOR_BLUE.clone(),
        xyz: Color.WHITE.clone(),
        face: COLOR_YELLOW.clone()
      },
      disabled: COLOR_GRAY.clone()
    };
    this._guideColors = {
      x: COLOR_RED.clone(),
      y: COLOR_GREEN.clone(),
      z: COLOR_BLUE.clone(),
      face: COLOR_YELLOW.clone()
    };
    this._gizmoRotationStart = new Quat();
    this._shapes = {};
    this._shapeMap = new Map();
    this._hoverShape = null;
    this._hoverAxis = '';
    this._hoverIsPlane = false;
    this._selectedAxis = '';
    this._selectedIsPlane = false;
    this._selectionStartPoint = new Vec3();
    this._selectionStartAngle = 0;
    this._isRotation = false;
    this._useUniformScaling = false;
    this._dragging = false;
    this._snap = false;
    this.snapIncrement = 1;
    app.on('update', () => {
      if (!this.root.enabled) {
        return;
      }
      this._drawGuideLines();
    });
    this.on('pointer:down', (x, y, meshInstance) => {
      const shape = this._shapeMap.get(meshInstance);
      if (shape != null && shape.disabled) {
        return;
      }
      if (this._dragging) {
        return;
      }
      if (!meshInstance) {
        return;
      }
      this._selectedAxis = this._getAxis(meshInstance);
      this._selectedIsPlane = this._getIsPlane(meshInstance);
      this._gizmoRotationStart.copy(this.root.getRotation());
      const pointInfo = this._calcPoint(x, y);
      this._selectionStartPoint.copy(pointInfo.point);
      this._selectionStartAngle = pointInfo.angle;
      this._dragging = true;
      this.fire(TransformGizmo.EVENT_TRANSFORMSTART);
    });
    this.on('pointer:move', (x, y, meshInstance) => {
      const shape = this._shapeMap.get(meshInstance);
      if (shape != null && shape.disabled) {
        return;
      }
      this._hover(meshInstance);
      if (!this._dragging) {
        return;
      }
      const pointInfo = this._calcPoint(x, y);
      pointDelta.copy(pointInfo.point).sub(this._selectionStartPoint);
      const angleDelta = pointInfo.angle - this._selectionStartAngle;
      this.fire(TransformGizmo.EVENT_TRANSFORMMOVE, pointDelta, angleDelta);
      this._hoverAxis = '';
      this._hoverIsPlane = false;
    });
    this.on('pointer:up', () => {
      if (!this._dragging) {
        return;
      }
      this._dragging = false;
      this.fire(TransformGizmo.EVENT_TRANSFORMEND);
      this._selectedAxis = '';
      this._selectedIsPlane = false;
    });
    this.on('nodes:detach', () => {
      this.snap = false;
      this._hoverAxis = '';
      this._hoverIsPlane = false;
      this._hover(null);
      this.fire('pointer:up');
    });
  }
  set snap(value) {
    this._snap = this.root.enabled && value;
  }
  get snap() {
    return this._snap;
  }
  set xAxisColor(value) {
    this._updateAxisColor('x', value);
  }
  get xAxisColor() {
    return this._meshColors.axis.x;
  }
  set yAxisColor(value) {
    this._updateAxisColor('y', value);
  }
  get yAxisColor() {
    return this._meshColors.axis.y;
  }
  set zAxisColor(value) {
    this._updateAxisColor('z', value);
  }
  get zAxisColor() {
    return this._meshColors.axis.z;
  }
  _updateAxisColor(axis, value) {
    this._guideColors[axis].copy(value);
    this._meshColors.axis[axis].copy(colorSemi(value));
    this._meshColors.hover[axis].copy(value);
    for (const name in this._shapes) {
      this._shapes[name].hover(!!this._hoverAxis);
    }
  }
  _getAxis(meshInstance) {
    if (!meshInstance) {
      return '';
    }
    return meshInstance.node.name.split(":")[1];
  }
  _getIsPlane(meshInstance) {
    if (!meshInstance) {
      return false;
    }
    return meshInstance.node.name.indexOf('plane') !== -1;
  }
  _hover(meshInstance) {
    if (this._dragging) {
      return;
    }
    this._hoverAxis = this._getAxis(meshInstance);
    this._hoverIsPlane = this._getIsPlane(meshInstance);
    const shape = this._shapeMap.get(meshInstance) || null;
    if (shape === this._hoverShape) {
      return;
    }
    if (this._hoverShape) {
      this._hoverShape.hover(false);
      this._hoverShape = null;
    }
    if (shape) {
      shape.hover(true);
      this._hoverShape = shape;
    }
    this.fire('render:update');
  }
  _calcPoint(x, y) {
    const gizmoPos = this.root.getPosition();
    const mouseWPos = this._camera.screenToWorld(x, y, 1);
    const cameraRot = this._camera.entity.getRotation();
    const rayOrigin = this._camera.entity.getPosition();
    const rayDir = new Vec3();
    const planeNormal = new Vec3();
    const axis = this._selectedAxis;
    const isPlane = this._selectedIsPlane;
    const isRotation = this._isRotation;
    const isUniform = this._useUniformScaling && isPlane;
    const isAllAxes = axis === 'xyz';
    const isFacing = axis === 'face';
    if (this._camera.projection === PROJECTION_PERSPECTIVE) {
      rayDir.copy(mouseWPos).sub(rayOrigin).normalize();
    } else {
      rayOrigin.add(mouseWPos);
      this._camera.entity.getWorldTransform().transformVector(tmpV1.set(0, 0, -1), rayDir);
    }
    if (isUniform || isAllAxes || isFacing) {
      planeNormal.copy(rayOrigin).sub(gizmoPos).normalize();
    } else {
      planeNormal[axis] = 1;
      tmpQ1.copy(this._gizmoRotationStart).transformVector(planeNormal, planeNormal);
      if (!isPlane && !isRotation) {
        tmpV1.copy(rayOrigin).sub(gizmoPos).normalize();
        planeNormal.copy(tmpV1.sub(planeNormal.mulScalar(planeNormal.dot(tmpV1))).normalize());
      }
    }
    const rayPlaneDot = planeNormal.dot(rayDir);
    const planeDist = gizmoPos.dot(planeNormal);
    const pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
    const point = rayDir.mulScalar(-pointPlaneDist).add(rayOrigin);
    if (isRotation) {
      point.sub(gizmoPos);
    }
    if (isUniform) {
      tmpV1.copy(point).sub(gizmoPos).normalize();
      switch (axis) {
        case 'x':
          tmpV2.copy(this.root.up);
          tmpV3.copy(this.root.forward).mulScalar(-1);
          break;
        case 'y':
          tmpV2.copy(this.root.right);
          tmpV3.copy(this.root.forward).mulScalar(-1);
          break;
        case 'z':
          tmpV2.copy(this.root.up);
          tmpV3.copy(this.root.right);
          break;
        default:
          tmpV2.set(0, 0, 0);
          tmpV3.set(0, 0, 0);
          break;
      }
      tmpV2.add(tmpV3).normalize();
      const v = point.sub(gizmoPos).length() * tmpV1.dot(tmpV2);
      point.set(v, v, v);
      point[axis] = 1;
    } else if (isAllAxes) {
      tmpV1.copy(point).sub(gizmoPos).normalize();
      tmpV2.copy(this._camera.entity.up).add(this._camera.entity.right).normalize();
      const v = point.sub(gizmoPos).length() * tmpV1.dot(tmpV2);
      point.set(v, v, v);
    } else if (!isFacing) {
      if (!isPlane && !isRotation) {
        planeNormal.set(0, 0, 0);
        planeNormal[axis] = 1;
        tmpQ1.transformVector(planeNormal, planeNormal);
        point.copy(planeNormal.mulScalar(planeNormal.dot(point)));
      }
      tmpQ1.invert().transformVector(point, point);
      if (!isPlane && !isRotation) {
        const v = point[axis];
        point.set(0, 0, 0);
        point[axis] = v;
      }
    }
    let angle = 0;
    if (isRotation) {
      let isAxisFacing = isFacing;
      tmpV1.copy(rayOrigin).sub(gizmoPos).normalize();
      tmpV2.cross(planeNormal, tmpV1);
      isAxisFacing || (isAxisFacing = tmpV2.length() < FACING_EPSILON);
      if (isAxisFacing) {
        switch (axis) {
          case 'x':
            angle = Math.atan2(point.z, point.y) * math.RAD_TO_DEG;
            break;
          case 'y':
            angle = Math.atan2(point.x, point.z) * math.RAD_TO_DEG;
            break;
          case 'z':
            angle = Math.atan2(point.y, point.x) * math.RAD_TO_DEG;
            break;
          case 'face':
            cameraRot.invert().transformVector(point, tmpV1);
            angle = Math.atan2(tmpV1.y, tmpV1.x) * math.RAD_TO_DEG;
            break;
        }
      } else {
        angle = mouseWPos.dot(tmpV2.normalize()) * ROTATE_SCALE;
        if (this._camera.projection === PROJECTION_ORTHOGRAPHIC) {
          angle /= this._camera.orthoHeight || 1;
        }
      }
    }
    return {
      point,
      angle
    };
  }
  _drawGuideLines() {
    const gizmoPos = this.root.getPosition();
    const gizmoRot = tmpQ1.copy(this.root.getRotation());
    const checkAxis = this._hoverAxis || this._selectedAxis;
    const checkIsPlane = this._hoverIsPlane || this._selectedIsPlane;
    for (let i = 0; i < VEC3_AXES.length; i++) {
      const axis = VEC3_AXES[i];
      if (checkAxis === 'xyz') {
        this._drawSpanLine(gizmoPos, gizmoRot, axis);
        continue;
      }
      if (checkIsPlane) {
        if (axis !== checkAxis) {
          this._drawSpanLine(gizmoPos, gizmoRot, axis);
        }
      } else {
        if (axis === checkAxis) {
          this._drawSpanLine(gizmoPos, gizmoRot, axis);
        }
      }
    }
  }
  _drawSpanLine(pos, rot, axis) {
    tmpV1.set(0, 0, 0);
    tmpV1[axis] = 1;
    tmpV1.mulScalar(SPANLINE_SIZE);
    tmpV2.copy(tmpV1).mulScalar(-1);
    rot.transformVector(tmpV1, tmpV1);
    rot.transformVector(tmpV2, tmpV2);
    this._app.drawLine(tmpV1.add(pos), tmpV2.add(pos), this._guideColors[axis], true);
  }
  _createTransform() {
    for (const key in this._shapes) {
      const shape = this._shapes[key];
      this.root.addChild(shape.entity);
      this.intersectData.push({
        meshTriDataList: shape.meshTriDataList,
        parent: shape.entity,
        meshInstances: shape.meshInstances
      });
      for (let i = 0; i < shape.meshInstances.length; i++) {
        this._shapeMap.set(shape.meshInstances[i], shape);
      }
    }
  }
  enableShape(shapeAxis, enabled) {
    if (!this._shapes.hasOwnProperty(shapeAxis)) {
      return;
    }
    this._shapes[shapeAxis].disabled = !enabled;
  }
  isShapeEnabled(shapeAxis) {
    if (!this._shapes.hasOwnProperty(shapeAxis)) {
      return false;
    }
    return !this._shapes[shapeAxis].disabled;
  }
  destroy() {
    for (const key in this._shapes) {
      this._shapes[key].destroy();
    }
    super.destroy();
  }
}
TransformGizmo.EVENT_TRANSFORMSTART = 'transform:start';
TransformGizmo.EVENT_TRANSFORMMOVE = 'transform:move';
TransformGizmo.EVENT_TRANSFORMEND = 'transform:end';

export { TransformGizmo };
