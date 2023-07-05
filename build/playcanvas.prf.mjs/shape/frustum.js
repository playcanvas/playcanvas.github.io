/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../scene/constants.js';

const _frustumPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];

class Frustum {
  constructor() {
    this.planes = [];

    for (let i = 0; i < 6; i++) this.planes[i] = [];
  }

  setFromMat4(matrix) {
    const vpm = matrix.data;
    let plane;
    const planes = this.planes;
    plane = planes[0];
    plane[0] = vpm[3] - vpm[0];
    plane[1] = vpm[7] - vpm[4];
    plane[2] = vpm[11] - vpm[8];
    plane[3] = vpm[15] - vpm[12];
    let t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
    plane[0] /= t;
    plane[1] /= t;
    plane[2] /= t;
    plane[3] /= t;
    plane = planes[1];
    plane[0] = vpm[3] + vpm[0];
    plane[1] = vpm[7] + vpm[4];
    plane[2] = vpm[11] + vpm[8];
    plane[3] = vpm[15] + vpm[12];
    t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
    plane[0] /= t;
    plane[1] /= t;
    plane[2] /= t;
    plane[3] /= t;
    plane = planes[2];
    plane[0] = vpm[3] + vpm[1];
    plane[1] = vpm[7] + vpm[5];
    plane[2] = vpm[11] + vpm[9];
    plane[3] = vpm[15] + vpm[13];
    t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
    plane[0] /= t;
    plane[1] /= t;
    plane[2] /= t;
    plane[3] /= t;
    plane = planes[3];
    plane[0] = vpm[3] - vpm[1];
    plane[1] = vpm[7] - vpm[5];
    plane[2] = vpm[11] - vpm[9];
    plane[3] = vpm[15] - vpm[13];
    t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
    plane[0] /= t;
    plane[1] /= t;
    plane[2] /= t;
    plane[3] /= t;
    plane = planes[4];
    plane[0] = vpm[3] - vpm[2];
    plane[1] = vpm[7] - vpm[6];
    plane[2] = vpm[11] - vpm[10];
    plane[3] = vpm[15] - vpm[14];
    t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
    plane[0] /= t;
    plane[1] /= t;
    plane[2] /= t;
    plane[3] /= t;
    plane = planes[5];
    plane[0] = vpm[3] + vpm[2];
    plane[1] = vpm[7] + vpm[6];
    plane[2] = vpm[11] + vpm[10];
    plane[3] = vpm[15] + vpm[14];
    t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
    plane[0] /= t;
    plane[1] /= t;
    plane[2] /= t;
    plane[3] /= t;
  }

  containsPoint(point) {
    let p, plane;

    for (p = 0; p < 6; p++) {
      plane = this.planes[p];

      if (plane[0] * point.x + plane[1] * point.y + plane[2] * point.z + plane[3] <= 0) {
        return false;
      }
    }

    return true;
  }

  containsSphere(sphere) {
    let c = 0;
    let d;
    let p;
    const sr = sphere.radius;
    const sc = sphere.center;
    const scx = sc.x;
    const scy = sc.y;
    const scz = sc.z;
    const planes = this.planes;
    let plane;

    for (p = 0; p < 6; p++) {
      plane = planes[p];
      d = plane[0] * scx + plane[1] * scy + plane[2] * scz + plane[3];
      if (d <= -sr) return 0;
      if (d > sr) c++;
    }

    return c === 6 ? 2 : 1;
  }

  static getPoints(camera, near, far) {
    near = near || camera._nearClip;
    far = far || camera._farClip;
    const fov = camera._fov * Math.PI / 180.0;
    let y = camera._projection === PROJECTION_PERSPECTIVE ? Math.tan(fov / 2.0) * near : camera._orthoHeight;
    let x = y * camera._aspectRatio;
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

    if (camera._projection === PROJECTION_PERSPECTIVE) {
      y = Math.tan(fov / 2.0) * far;
      x = y * camera._aspectRatio;
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

export { Frustum };
