/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 2a805ddb9
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Vec3 } from 'playcanvas';
import { AxisBoxCenter, AxisPlane, AxisBoxLine } from './axis-shapes.js';
import { GIZMO_LOCAL } from './gizmo.js';
import { TransformGizmo } from './transform-gizmo.js';

class ScaleGizmo extends TransformGizmo {
  constructor(app, camera, layer) {
    super(app, camera, layer);
    this._shapes = {
      xyz: new AxisBoxCenter(this._device, {
        axis: 'xyz',
        layers: [this._layer.id],
        defaultColor: this._meshColors.axis.xyz,
        hoverColor: this._meshColors.hover.xyz
      }),
      yz: new AxisPlane(this._device, {
        axis: 'x',
        flipAxis: 'y',
        layers: [this._layer.id],
        rotation: new Vec3(0, 0, -90),
        defaultColor: this._meshColors.axis.x,
        hoverColor: this._meshColors.hover.x
      }),
      xz: new AxisPlane(this._device, {
        axis: 'y',
        flipAxis: 'z',
        layers: [this._layer.id],
        rotation: new Vec3(0, 0, 0),
        defaultColor: this._meshColors.axis.y,
        hoverColor: this._meshColors.hover.y
      }),
      xy: new AxisPlane(this._device, {
        axis: 'z',
        flipAxis: 'x',
        layers: [this._layer.id],
        rotation: new Vec3(90, 0, 0),
        defaultColor: this._meshColors.axis.z,
        hoverColor: this._meshColors.hover.z
      }),
      x: new AxisBoxLine(this._device, {
        axis: 'x',
        layers: [this._layer.id],
        rotation: new Vec3(0, 0, -90),
        defaultColor: this._meshColors.axis.x,
        hoverColor: this._meshColors.hover.x
      }),
      y: new AxisBoxLine(this._device, {
        axis: 'y',
        layers: [this._layer.id],
        rotation: new Vec3(0, 0, 0),
        defaultColor: this._meshColors.axis.y,
        hoverColor: this._meshColors.hover.y
      }),
      z: new AxisBoxLine(this._device, {
        axis: 'z',
        layers: [this._layer.id],
        rotation: new Vec3(90, 0, 0),
        defaultColor: this._meshColors.axis.z,
        hoverColor: this._meshColors.hover.z
      })
    };
    this._coordSpace = GIZMO_LOCAL;
    this._nodeScales = new Map();
    this.snapIncrement = 1;
    this._createTransform();
    this.on('transform:start', () => {
      this._selectionStartPoint.sub(Vec3.ONE);
      this._storeNodeScales();
    });
    this.on('transform:move', pointDelta => {
      if (this.snap) {
        pointDelta.mulScalar(1 / this.snapIncrement);
        pointDelta.round();
        pointDelta.mulScalar(this.snapIncrement);
      }
      this._setNodeScales(pointDelta);
    });
    this.on('nodes:detach', () => {
      this._nodeScales.clear();
    });
  }
  set coordSpace(value) {}
  get coordSpace() {
    return this._coordSpace;
  }
  set uniform(value) {
    this._useUniformScaling = value != null ? value : true;
  }
  get uniform() {
    return this._useUniformScaling;
  }
  set axisGap(value) {
    this._setArrowProp('gap', value);
  }
  get axisGap() {
    return this._shapes.x.gap;
  }
  set axisLineThickness(value) {
    this._setArrowProp('lineThickness', value);
  }
  get axisLineThickness() {
    return this._shapes.x.lineThickness;
  }
  set axisLineLength(value) {
    this._setArrowProp('lineLength', value);
  }
  get axisLineLength() {
    return this._shapes.x.lineLength;
  }
  set axisLineTolerance(value) {
    this._setArrowProp('tolerance', value);
  }
  get axisLineTolerance() {
    return this._shapes.x.tolerance;
  }
  set axisBoxSize(value) {
    this._setArrowProp('boxSize', value);
  }
  get axisBoxSize() {
    return this._shapes.x.boxSize;
  }
  set axisPlaneSize(value) {
    this._setPlaneProp('size', value);
  }
  get axisPlaneSize() {
    return this._shapes.yz.size;
  }
  set axisPlaneGap(value) {
    this._setPlaneProp('gap', value);
  }
  get axisPlaneGap() {
    return this._shapes.yz.gap;
  }
  set axisCenterSize(value) {
    this._shapes.xyz.size = value;
  }
  get axisCenterSize() {
    return this._shapes.xyz.size;
  }
  set axisCenterTolerance(value) {
    this._shapes.xyz.tolerance = value;
  }
  get axisCenterTolerance() {
    return this._shapes.xyz.tolerance;
  }
  _setArrowProp(prop, value) {
    this._shapes.x[prop] = value;
    this._shapes.y[prop] = value;
    this._shapes.z[prop] = value;
  }
  _setPlaneProp(prop, value) {
    this._shapes.yz[prop] = value;
    this._shapes.xz[prop] = value;
    this._shapes.xy[prop] = value;
  }
  _storeNodeScales() {
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      this._nodeScales.set(node, node.getLocalScale().clone());
    }
  }
  _setNodeScales(pointDelta) {
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      node.setLocalScale(this._nodeScales.get(node).clone().mul(pointDelta));
    }
  }
}

export { ScaleGizmo };
