/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Debug } from '../core/debug.js';
import { SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, TYPE_UINT8, SEMANTIC_BLENDWEIGHT } from '../graphics/constants.js';
import { Mesh } from './mesh.js';

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;
const shapePrimitives = [];

function calculateNormals(positions, indices) {
  const triangleCount = indices.length / 3;
  const vertexCount = positions.length / 3;
  const p1 = new Vec3();
  const p2 = new Vec3();
  const p3 = new Vec3();
  const p1p2 = new Vec3();
  const p1p3 = new Vec3();
  const faceNormal = new Vec3();
  const normals = [];

  for (let i = 0; i < positions.length; i++) {
    normals[i] = 0;
  }

  for (let i = 0; i < triangleCount; i++) {
    const i1 = indices[i * 3];
    const i2 = indices[i * 3 + 1];
    const i3 = indices[i * 3 + 2];
    p1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    p2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
    p3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
    p1p2.sub2(p2, p1);
    p1p3.sub2(p3, p1);
    faceNormal.cross(p1p2, p1p3).normalize();
    normals[i1 * 3] += faceNormal.x;
    normals[i1 * 3 + 1] += faceNormal.y;
    normals[i1 * 3 + 2] += faceNormal.z;
    normals[i2 * 3] += faceNormal.x;
    normals[i2 * 3 + 1] += faceNormal.y;
    normals[i2 * 3 + 2] += faceNormal.z;
    normals[i3 * 3] += faceNormal.x;
    normals[i3 * 3 + 1] += faceNormal.y;
    normals[i3 * 3 + 2] += faceNormal.z;
  }

  for (let i = 0; i < vertexCount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
    normals[i * 3] *= invLen;
    normals[i * 3 + 1] *= invLen;
    normals[i * 3 + 2] *= invLen;
  }

  return normals;
}

function calculateTangents(positions, normals, uvs, indices) {
  const triangleCount = indices.length / 3;
  const vertexCount = positions.length / 3;
  const v1 = new Vec3();
  const v2 = new Vec3();
  const v3 = new Vec3();
  const w1 = new Vec2();
  const w2 = new Vec2();
  const w3 = new Vec2();
  const sdir = new Vec3();
  const tdir = new Vec3();
  const tan1 = new Float32Array(vertexCount * 3);
  const tan2 = new Float32Array(vertexCount * 3);
  const tangents = [];

  for (let i = 0; i < triangleCount; i++) {
    const i1 = indices[i * 3];
    const i2 = indices[i * 3 + 1];
    const i3 = indices[i * 3 + 2];
    v1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    v2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
    v3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
    w1.set(uvs[i1 * 2], uvs[i1 * 2 + 1]);
    w2.set(uvs[i2 * 2], uvs[i2 * 2 + 1]);
    w3.set(uvs[i3 * 2], uvs[i3 * 2 + 1]);
    const x1 = v2.x - v1.x;
    const x2 = v3.x - v1.x;
    const y1 = v2.y - v1.y;
    const y2 = v3.y - v1.y;
    const z1 = v2.z - v1.z;
    const z2 = v3.z - v1.z;
    const s1 = w2.x - w1.x;
    const s2 = w3.x - w1.x;

    const _t = w2.y - w1.y;

    const _t2 = w3.y - w1.y;

    const area = s1 * _t2 - s2 * _t;

    if (area === 0) {
      sdir.set(0, 1, 0);
      tdir.set(1, 0, 0);
    } else {
      const r = 1 / area;
      sdir.set((_t2 * x1 - _t * x2) * r, (_t2 * y1 - _t * y2) * r, (_t2 * z1 - _t * z2) * r);
      tdir.set((s1 * x2 - s2 * x1) * r, (s1 * y2 - s2 * y1) * r, (s1 * z2 - s2 * z1) * r);
    }

    tan1[i1 * 3 + 0] += sdir.x;
    tan1[i1 * 3 + 1] += sdir.y;
    tan1[i1 * 3 + 2] += sdir.z;
    tan1[i2 * 3 + 0] += sdir.x;
    tan1[i2 * 3 + 1] += sdir.y;
    tan1[i2 * 3 + 2] += sdir.z;
    tan1[i3 * 3 + 0] += sdir.x;
    tan1[i3 * 3 + 1] += sdir.y;
    tan1[i3 * 3 + 2] += sdir.z;
    tan2[i1 * 3 + 0] += tdir.x;
    tan2[i1 * 3 + 1] += tdir.y;
    tan2[i1 * 3 + 2] += tdir.z;
    tan2[i2 * 3 + 0] += tdir.x;
    tan2[i2 * 3 + 1] += tdir.y;
    tan2[i2 * 3 + 2] += tdir.z;
    tan2[i3 * 3 + 0] += tdir.x;
    tan2[i3 * 3 + 1] += tdir.y;
    tan2[i3 * 3 + 2] += tdir.z;
  }

  const t1 = new Vec3();
  const t2 = new Vec3();
  const n = new Vec3();
  const temp = new Vec3();

  for (let i = 0; i < vertexCount; i++) {
    n.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    t1.set(tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
    t2.set(tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);
    const ndott = n.dot(t1);
    temp.copy(n).mulScalar(ndott);
    temp.sub2(t1, temp).normalize();
    tangents[i * 4] = temp.x;
    tangents[i * 4 + 1] = temp.y;
    tangents[i * 4 + 2] = temp.z;
    temp.cross(n, t1);
    tangents[i * 4 + 3] = temp.dot(t2) < 0.0 ? -1.0 : 1.0;
  }

  return tangents;
}

function createMesh(device, positions, opts) {
  const mesh = new Mesh(device);
  mesh.setPositions(positions);

  if (opts) {
    if (opts.normals) {
      mesh.setNormals(opts.normals);
    }

    if (opts.tangents) {
      mesh.setVertexStream(SEMANTIC_TANGENT, opts.tangents, 4);
    }

    if (opts.colors) {
      mesh.setColors32(opts.colors);
    }

    if (opts.uvs) {
      mesh.setUvs(0, opts.uvs);
    }

    if (opts.uvs1) {
      mesh.setUvs(1, opts.uvs1);
    }

    if (opts.blendIndices) {
      mesh.setVertexStream(SEMANTIC_BLENDINDICES, opts.blendIndices, 4, opts.blendIndices.length / 4, TYPE_UINT8);
    }

    if (opts.blendWeights) {
      mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, opts.blendWeights, 4);
    }

    if (opts.indices) {
      mesh.setIndices(opts.indices);
    }
  }

  mesh.update();
  return mesh;
}

function createTorus(device, opts) {
  const rc = opts && opts.tubeRadius !== undefined ? opts.tubeRadius : 0.2;
  const rt = opts && opts.ringRadius !== undefined ? opts.ringRadius : 0.3;
  const segments = opts && opts.segments !== undefined ? opts.segments : 30;
  const sides = opts && opts.sides !== undefined ? opts.sides : 20;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= sides; i++) {
    for (let j = 0; j <= segments; j++) {
      const x = Math.cos(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
      const y = Math.sin(2 * Math.PI * i / sides) * rc;
      const z = Math.sin(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
      const nx = Math.cos(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);
      const ny = Math.sin(2 * Math.PI * i / sides);
      const nz = Math.sin(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);
      const u = i / sides;
      const v = 1 - j / segments;
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(u, 1.0 - v);

      if (i < sides && j < segments) {
        const first = i * (segments + 1) + j;
        const second = (i + 1) * (segments + 1) + j;
        const third = i * (segments + 1) + (j + 1);
        const fourth = (i + 1) * (segments + 1) + (j + 1);
        indices.push(first, second, third);
        indices.push(second, fourth, third);
      }
    }
  }

  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs,
    indices: indices
  };

  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }

  return createMesh(device, positions, options);
}

function _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
  const pos = new Vec3();
  const bottomToTop = new Vec3();
  const norm = new Vec3();
  const top = new Vec3();
  const bottom = new Vec3();
  const tangent = new Vec3();
  const positions = [];
  const normals = [];
  const uvs = [];
  const uvs1 = [];
  const indices = [];
  let offset;

  if (height > 0) {
    for (let i = 0; i <= heightSegments; i++) {
      for (let j = 0; j <= capSegments; j++) {
        const theta = j / capSegments * 2 * Math.PI - Math.PI;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        bottom.set(sinTheta * baseRadius, -height / 2, cosTheta * baseRadius);
        top.set(sinTheta * peakRadius, height / 2, cosTheta * peakRadius);
        pos.lerp(bottom, top, i / heightSegments);
        bottomToTop.sub2(top, bottom).normalize();
        tangent.set(cosTheta, 0, -sinTheta);
        norm.cross(tangent, bottomToTop).normalize();
        positions.push(pos.x, pos.y, pos.z);
        normals.push(norm.x, norm.y, norm.z);
        let u = j / capSegments;
        let v = i / heightSegments;
        uvs.push(u, 1 - v);
        const _v = v;
        v = u;
        u = _v;
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        uvs1.push(u, 1 - v);

        if (i < heightSegments && j < capSegments) {
          const first = i * (capSegments + 1) + j;
          const second = i * (capSegments + 1) + (j + 1);
          const third = (i + 1) * (capSegments + 1) + j;
          const fourth = (i + 1) * (capSegments + 1) + (j + 1);
          indices.push(first, second, third);
          indices.push(second, fourth, third);
        }
      }
    }
  }

  if (roundedCaps) {
    const latitudeBands = Math.floor(capSegments / 2);
    const longitudeBands = capSegments;
    const capOffset = height / 2;

    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = lat * Math.PI * 0.5 / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= longitudeBands; lon++) {
        const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        let u = 1 - lon / longitudeBands;
        let v = 1 - lat / latitudeBands;
        positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
        normals.push(x, y, z);
        uvs.push(u, 1 - v);
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 1.0 / 3;
        uvs1.push(u, 1 - v);
      }
    }

    offset = (heightSegments + 1) * (capSegments + 1);

    for (let lat = 0; lat < latitudeBands; ++lat) {
      for (let lon = 0; lon < longitudeBands; ++lon) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        indices.push(offset + first + 1, offset + second, offset + first);
        indices.push(offset + first + 1, offset + second + 1, offset + second);
      }
    }

    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = Math.PI * 0.5 + lat * Math.PI * 0.5 / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= longitudeBands; lon++) {
        const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        let u = 1 - lon / longitudeBands;
        let v = 1 - lat / latitudeBands;
        positions.push(x * peakRadius, y * peakRadius - capOffset, z * peakRadius);
        normals.push(x, y, z);
        uvs.push(u, 1 - v);
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 2.0 / 3;
        uvs1.push(u, 1 - v);
      }
    }

    offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);

    for (let lat = 0; lat < latitudeBands; ++lat) {
      for (let lon = 0; lon < longitudeBands; ++lon) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        indices.push(offset + first + 1, offset + second, offset + first);
        indices.push(offset + first + 1, offset + second + 1, offset + second);
      }
    }
  } else {
    offset = (heightSegments + 1) * (capSegments + 1);

    if (baseRadius > 0) {
      for (let i = 0; i < capSegments; i++) {
        const theta = i / capSegments * 2 * Math.PI;
        const x = Math.sin(theta);
        const y = -height / 2;
        const z = Math.cos(theta);
        let u = 1 - (x + 1) / 2;
        let v = (z + 1) / 2;
        positions.push(x * baseRadius, y, z * baseRadius);
        normals.push(0, -1, 0);
        uvs.push(u, 1 - v);
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 1 / 3;
        uvs1.push(u, 1 - v);

        if (i > 1) {
          indices.push(offset, offset + i, offset + i - 1);
        }
      }
    }

    offset += capSegments;

    if (peakRadius > 0) {
      for (let i = 0; i < capSegments; i++) {
        const theta = i / capSegments * 2 * Math.PI;
        const x = Math.sin(theta);
        const y = height / 2;
        const z = Math.cos(theta);
        let u = 1 - (x + 1) / 2;
        let v = (z + 1) / 2;
        positions.push(x * peakRadius, y, z * peakRadius);
        normals.push(0, 1, 0);
        uvs.push(u, 1 - v);
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += 2 / 3;
        uvs1.push(u, 1 - v);

        if (i > 1) {
          indices.push(offset, offset + i - 1, offset + i);
        }
      }
    }
  }

  return {
    positions: positions,
    normals: normals,
    uvs: uvs,
    uvs1: uvs1,
    indices: indices
  };
}

function createCylinder(device, opts) {
  if (opts && opts.hasOwnProperty('baseRadius') && !opts.hasOwnProperty('radius')) {
    Debug.deprecated('"baseRadius" in arguments, use "radius" instead');
  }

  let radius = opts && (opts.radius || opts.baseRadius);
  radius = radius !== undefined ? radius : 0.5;
  const height = opts && opts.height !== undefined ? opts.height : 1.0;
  const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
  const capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 20;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  const options = _createConeData(radius, radius, height, heightSegments, capSegments, false);

  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }

  return createMesh(device, options.positions, options);
}

function createCapsule(device, opts) {
  const radius = opts && opts.radius !== undefined ? opts.radius : 0.3;
  const height = opts && opts.height !== undefined ? opts.height : 1.0;
  const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
  const sides = opts && opts.sides !== undefined ? opts.sides : 20;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  const options = _createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);

  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }

  return createMesh(device, options.positions, options);
}

function createCone(device, opts) {
  const baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
  const peakRadius = opts && opts.peakRadius !== undefined ? opts.peakRadius : 0.0;
  const height = opts && opts.height !== undefined ? opts.height : 1.0;
  const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
  const capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  const options = _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);

  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }

  return createMesh(device, options.positions, options);
}

function createSphere(device, opts) {
  const radius = opts && opts.radius !== undefined ? opts.radius : 0.5;
  const latitudeBands = opts && opts.latitudeBands !== undefined ? opts.latitudeBands : 16;
  const longitudeBands = opts && opts.longitudeBands !== undefined ? opts.longitudeBands : 16;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = lat * Math.PI / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longitudeBands; lon++) {
      const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;
      const u = 1 - lon / longitudeBands;
      const v = 1 - lat / latitudeBands;
      positions.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
      uvs.push(u, 1 - v);
    }
  }

  for (let lat = 0; lat < latitudeBands; ++lat) {
    for (let lon = 0; lon < longitudeBands; ++lon) {
      const first = lat * (longitudeBands + 1) + lon;
      const second = first + longitudeBands + 1;
      indices.push(first + 1, second, first);
      indices.push(first + 1, second + 1, second);
    }
  }

  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs,
    indices: indices
  };

  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }

  return createMesh(device, positions, options);
}

function createPlane(device, opts) {
  const he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec2(0.5, 0.5);
  const ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 5;
  const ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 5;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vcounter = 0;

  for (let i = 0; i <= ws; i++) {
    for (let j = 0; j <= ls; j++) {
      const x = -he.x + 2 * he.x * i / ws;
      const y = 0.0;
      const z = -(-he.y + 2 * he.y * j / ls);
      const u = i / ws;
      const v = j / ls;
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(u, 1 - v);

      if (i < ws && j < ls) {
        indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
        indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
      }

      vcounter++;
    }
  }

  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs,
    indices: indices
  };

  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }

  return createMesh(device, positions, options);
}

function createBox(device, opts) {
  const he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec3(0.5, 0.5, 0.5);
  const ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 1;
  const ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 1;
  const hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;
  const corners = [new Vec3(-he.x, -he.y, he.z), new Vec3(he.x, -he.y, he.z), new Vec3(he.x, he.y, he.z), new Vec3(-he.x, he.y, he.z), new Vec3(he.x, -he.y, -he.z), new Vec3(-he.x, -he.y, -he.z), new Vec3(-he.x, he.y, -he.z), new Vec3(he.x, he.y, -he.z)];
  const faceAxes = [[0, 1, 3], [4, 5, 7], [3, 2, 6], [1, 0, 4], [1, 4, 2], [5, 0, 6]];
  const faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  const sides = {
    FRONT: 0,
    BACK: 1,
    TOP: 2,
    BOTTOM: 3,
    RIGHT: 4,
    LEFT: 5
  };
  const positions = [];
  const normals = [];
  const uvs = [];
  const uvs1 = [];
  const indices = [];
  let vcounter = 0;

  const generateFace = (side, uSegments, vSegments) => {
    const temp1 = new Vec3();
    const temp2 = new Vec3();
    const temp3 = new Vec3();
    const r = new Vec3();

    for (let i = 0; i <= uSegments; i++) {
      for (let j = 0; j <= vSegments; j++) {
        temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
        temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
        temp3.sub2(temp2, corners[faceAxes[side][0]]);
        r.add2(temp1, temp3);
        let u = i / uSegments;
        let v = j / vSegments;
        positions.push(r.x, r.y, r.z);
        normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
        uvs.push(u, 1 - v);
        u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
        v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
        u /= 3;
        v /= 3;
        u += side % 3 / 3;
        v += Math.floor(side / 3) / 3;
        uvs1.push(u, 1 - v);

        if (i < uSegments && j < vSegments) {
          indices.push(vcounter + vSegments + 1, vcounter + 1, vcounter);
          indices.push(vcounter + vSegments + 1, vcounter + vSegments + 2, vcounter + 1);
        }

        vcounter++;
      }
    }
  };

  generateFace(sides.FRONT, ws, hs);
  generateFace(sides.BACK, ws, hs);
  generateFace(sides.TOP, ws, ls);
  generateFace(sides.BOTTOM, ws, ls);
  generateFace(sides.RIGHT, ls, hs);
  generateFace(sides.LEFT, ls, hs);
  const options = {
    normals: normals,
    uvs: uvs,
    uvs1: uvs1,
    indices: indices
  };

  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }

  return createMesh(device, positions, options);
}

function getShapePrimitive(device, type) {
  let primData = null;

  for (let i = 0; i < shapePrimitives.length; i++) {
    if (shapePrimitives[i].type === type && shapePrimitives[i].device === device) {
      primData = shapePrimitives[i].primData;
    }
  }

  if (!primData) {
    let mesh, area;

    switch (type) {
      case 'box':
        mesh = createBox(device, {
          halfExtents: new Vec3(0.5, 0.5, 0.5)
        });
        area = {
          x: 2,
          y: 2,
          z: 2,
          uv: 2.0 / 3
        };
        break;

      case 'capsule':
        mesh = createCapsule(device, {
          radius: 0.5,
          height: 2
        });
        area = {
          x: Math.PI * 2,
          y: Math.PI,
          z: Math.PI * 2,
          uv: 1.0 / 3 + 1.0 / 3 / 3 * 2
        };
        break;

      case 'cone':
        mesh = createCone(device, {
          baseRadius: 0.5,
          peakRadius: 0,
          height: 1
        });
        area = {
          x: 2.54,
          y: 2.54,
          z: 2.54,
          uv: 1.0 / 3 + 1.0 / 3 / 3
        };
        break;

      case 'cylinder':
        mesh = createCylinder(device, {
          radius: 0.5,
          height: 1
        });
        area = {
          x: Math.PI,
          y: 0.79 * 2,
          z: Math.PI,
          uv: 1.0 / 3 + 1.0 / 3 / 3 * 2
        };
        break;

      case 'plane':
        mesh = createPlane(device, {
          halfExtents: new Vec2(0.5, 0.5),
          widthSegments: 1,
          lengthSegments: 1
        });
        area = {
          x: 0,
          y: 1,
          z: 0,
          uv: 1
        };
        break;

      case 'sphere':
        mesh = createSphere(device, {
          radius: 0.5
        });
        area = {
          x: Math.PI,
          y: Math.PI,
          z: Math.PI,
          uv: 1
        };
        break;

      case 'torus':
        mesh = createTorus(device, {
          tubeRadius: 0.2,
          ringRadius: 0.3
        });
        area = {
          x: Math.PI * 0.5 * 0.5 - Math.PI * 0.1 * 0.1,
          y: 0.4,
          z: 0.4,
          uv: 1
        };
        break;

      default:
        throw new Error('Invalid primitive type: ' + type);
    }

    mesh.incRefCount();
    primData = {
      mesh: mesh,
      area: area
    };
    shapePrimitives.push({
      type: type,
      device: device,
      primData: primData
    });
  }

  return primData;
}

export { calculateNormals, calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus, getShapePrimitive };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2VkdXJhbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3Byb2NlZHVyYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgU0VNQU5USUNfVEFOR0VOVCwgU0VNQU5USUNfQkxFTkRXRUlHSFQsIFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICBUWVBFX1VJTlQ4XG59IGZyb20gJy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuL21lc2guanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG5cbmNvbnN0IHByaW1pdGl2ZVV2MVBhZGRpbmcgPSA0LjAgLyA2NDtcbmNvbnN0IHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSA9IDEuMCAtIHByaW1pdGl2ZVV2MVBhZGRpbmcgKiAyO1xuXG4vLyBjYWNoZWQgbWVzaCBwcmltaXRpdmVzXG5jb25zdCBzaGFwZVByaW1pdGl2ZXMgPSBbXTtcblxuLyoqXG4gKiBHZW5lcmF0ZXMgbm9ybWFsIGluZm9ybWF0aW9uIGZyb20gdGhlIHNwZWNpZmllZCBwb3NpdGlvbnMgYW5kIHRyaWFuZ2xlIGluZGljZXMuIFNlZVxuICoge0BsaW5rIGNyZWF0ZU1lc2h9LlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHBvc2l0aW9ucy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IGluZGljZXMgLSBBbiBhcnJheSBvZiB0cmlhbmdsZSBpbmRpY2VzLlxuICogQHJldHVybnMge251bWJlcltdfSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBub3JtYWxzLlxuICogQGV4YW1wbGVcbiAqIHZhciBub3JtYWxzID0gcGMuY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICogdmFyIHRhbmdlbnRzID0gcGMuY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICogdmFyIG1lc2ggPSBwYy5jcmVhdGVNZXNoKHBvc2l0aW9ucywgbm9ybWFscywgdGFuZ2VudHMsIHV2cywgaW5kaWNlcyk7XG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZU5vcm1hbHMocG9zaXRpb25zLCBpbmRpY2VzKSB7XG4gICAgY29uc3QgdHJpYW5nbGVDb3VudCA9IGluZGljZXMubGVuZ3RoIC8gMztcbiAgICBjb25zdCB2ZXJ0ZXhDb3VudCAgID0gcG9zaXRpb25zLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgcDEgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHAyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgZmFjZU5vcm1hbCA9IG5ldyBWZWMzKCk7XG5cbiAgICBjb25zdCBub3JtYWxzID0gW107XG5cbiAgICAvLyBJbml0aWFsaXplIHRoZSBub3JtYWwgYXJyYXkgdG8gemVyb1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9zaXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5vcm1hbHNbaV0gPSAwO1xuICAgIH1cblxuICAgIC8vIEFjY3VtdWxhdGUgZmFjZSBub3JtYWxzIGZvciBlYWNoIHZlcnRleFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVDb3VudDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGkxID0gaW5kaWNlc1tpICogM107XG4gICAgICAgIGNvbnN0IGkyID0gaW5kaWNlc1tpICogMyArIDFdO1xuICAgICAgICBjb25zdCBpMyA9IGluZGljZXNbaSAqIDMgKyAyXTtcblxuICAgICAgICBwMS5zZXQocG9zaXRpb25zW2kxICogM10sIHBvc2l0aW9uc1tpMSAqIDMgKyAxXSwgcG9zaXRpb25zW2kxICogMyArIDJdKTtcbiAgICAgICAgcDIuc2V0KHBvc2l0aW9uc1tpMiAqIDNdLCBwb3NpdGlvbnNbaTIgKiAzICsgMV0sIHBvc2l0aW9uc1tpMiAqIDMgKyAyXSk7XG4gICAgICAgIHAzLnNldChwb3NpdGlvbnNbaTMgKiAzXSwgcG9zaXRpb25zW2kzICogMyArIDFdLCBwb3NpdGlvbnNbaTMgKiAzICsgMl0pO1xuXG4gICAgICAgIHAxcDIuc3ViMihwMiwgcDEpO1xuICAgICAgICBwMXAzLnN1YjIocDMsIHAxKTtcbiAgICAgICAgZmFjZU5vcm1hbC5jcm9zcyhwMXAyLCBwMXAzKS5ub3JtYWxpemUoKTtcblxuICAgICAgICBub3JtYWxzW2kxICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMSAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTEgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kyICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMiAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTIgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kzICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMyAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTMgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgIH1cblxuICAgIC8vIE5vcm1hbGl6ZSBhbGwgbm9ybWFsc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBueCA9IG5vcm1hbHNbaSAqIDNdO1xuICAgICAgICBjb25zdCBueSA9IG5vcm1hbHNbaSAqIDMgKyAxXTtcbiAgICAgICAgY29uc3QgbnogPSBub3JtYWxzW2kgKiAzICsgMl07XG4gICAgICAgIGNvbnN0IGludkxlbiA9IDEgLyBNYXRoLnNxcnQobnggKiBueCArIG55ICogbnkgKyBueiAqIG56KTtcbiAgICAgICAgbm9ybWFsc1tpICogM10gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMV0gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMl0gKj0gaW52TGVuO1xuICAgIH1cblxuICAgIHJldHVybiBub3JtYWxzO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB0YW5nZW50IGluZm9ybWF0aW9uIGZyb20gdGhlIHNwZWNpZmllZCBwb3NpdGlvbnMsIG5vcm1hbHMsIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kXG4gKiB0cmlhbmdsZSBpbmRpY2VzLiBTZWUge0BsaW5rIGNyZWF0ZU1lc2h9LlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHBvc2l0aW9ucy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IG5vcm1hbHMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBub3JtYWxzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gdXZzIC0gQW4gYXJyYXkgb2YgMi1kaW1lbnNpb25hbCB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlcy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IGluZGljZXMgLSBBbiBhcnJheSBvZiB0cmlhbmdsZSBpbmRpY2VzLlxuICogQHJldHVybnMge251bWJlcltdfSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCB0YW5nZW50cy5cbiAqIEBleGFtcGxlXG4gKiB2YXIgdGFuZ2VudHMgPSBwYy5jYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcyk7XG4gKiB2YXIgbWVzaCA9IHBjLmNyZWF0ZU1lc2gocG9zaXRpb25zLCBub3JtYWxzLCB0YW5nZW50cywgdXZzLCBpbmRpY2VzKTtcbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpIHtcbiAgICAvLyBMZW5neWVsJ3MgTWV0aG9kXG4gICAgLy8gaHR0cDovL3dlYi5hcmNoaXZlLm9yZy93ZWIvMjAxODA2MjAwMjQ0MzkvaHR0cDovL3d3dy50ZXJhdGhvbi5jb20vY29kZS90YW5nZW50Lmh0bWxcbiAgICBjb25zdCB0cmlhbmdsZUNvdW50ID0gaW5kaWNlcy5sZW5ndGggLyAzO1xuICAgIGNvbnN0IHZlcnRleENvdW50ICAgPSBwb3NpdGlvbnMubGVuZ3RoIC8gMztcbiAgICBjb25zdCB2MSAgID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB2MiAgID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB2MyAgID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB3MSAgID0gbmV3IFZlYzIoKTtcbiAgICBjb25zdCB3MiAgID0gbmV3IFZlYzIoKTtcbiAgICBjb25zdCB3MyAgID0gbmV3IFZlYzIoKTtcbiAgICBjb25zdCBzZGlyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0ZGlyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0YW4xID0gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0ZXhDb3VudCAqIDMpO1xuICAgIGNvbnN0IHRhbjIgPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRleENvdW50ICogMyk7XG5cbiAgICBjb25zdCB0YW5nZW50cyA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmlhbmdsZUNvdW50OyBpKyspIHtcbiAgICAgICAgY29uc3QgaTEgPSBpbmRpY2VzW2kgKiAzXTtcbiAgICAgICAgY29uc3QgaTIgPSBpbmRpY2VzW2kgKiAzICsgMV07XG4gICAgICAgIGNvbnN0IGkzID0gaW5kaWNlc1tpICogMyArIDJdO1xuXG4gICAgICAgIHYxLnNldChwb3NpdGlvbnNbaTEgKiAzXSwgcG9zaXRpb25zW2kxICogMyArIDFdLCBwb3NpdGlvbnNbaTEgKiAzICsgMl0pO1xuICAgICAgICB2Mi5zZXQocG9zaXRpb25zW2kyICogM10sIHBvc2l0aW9uc1tpMiAqIDMgKyAxXSwgcG9zaXRpb25zW2kyICogMyArIDJdKTtcbiAgICAgICAgdjMuc2V0KHBvc2l0aW9uc1tpMyAqIDNdLCBwb3NpdGlvbnNbaTMgKiAzICsgMV0sIHBvc2l0aW9uc1tpMyAqIDMgKyAyXSk7XG5cbiAgICAgICAgdzEuc2V0KHV2c1tpMSAqIDJdLCB1dnNbaTEgKiAyICsgMV0pO1xuICAgICAgICB3Mi5zZXQodXZzW2kyICogMl0sIHV2c1tpMiAqIDIgKyAxXSk7XG4gICAgICAgIHczLnNldCh1dnNbaTMgKiAyXSwgdXZzW2kzICogMiArIDFdKTtcblxuICAgICAgICBjb25zdCB4MSA9IHYyLnggLSB2MS54O1xuICAgICAgICBjb25zdCB4MiA9IHYzLnggLSB2MS54O1xuICAgICAgICBjb25zdCB5MSA9IHYyLnkgLSB2MS55O1xuICAgICAgICBjb25zdCB5MiA9IHYzLnkgLSB2MS55O1xuICAgICAgICBjb25zdCB6MSA9IHYyLnogLSB2MS56O1xuICAgICAgICBjb25zdCB6MiA9IHYzLnogLSB2MS56O1xuXG4gICAgICAgIGNvbnN0IHMxID0gdzIueCAtIHcxLng7XG4gICAgICAgIGNvbnN0IHMyID0gdzMueCAtIHcxLng7XG4gICAgICAgIGNvbnN0IHQxID0gdzIueSAtIHcxLnk7XG4gICAgICAgIGNvbnN0IHQyID0gdzMueSAtIHcxLnk7XG5cbiAgICAgICAgY29uc3QgYXJlYSA9IHMxICogdDIgLSBzMiAqIHQxO1xuXG4gICAgICAgIC8vIEFyZWEgY2FuIGJlIDAgZm9yIGRlZ2VuZXJhdGUgdHJpYW5nbGVzIG9yIGJhZCB1diBjb29yZGluYXRlc1xuICAgICAgICBpZiAoYXJlYSA9PT0gMCkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gZGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgICAgIHNkaXIuc2V0KDAsIDEsIDApO1xuICAgICAgICAgICAgdGRpci5zZXQoMSwgMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByID0gMSAvIGFyZWE7XG4gICAgICAgICAgICBzZGlyLnNldCgodDIgKiB4MSAtIHQxICogeDIpICogcixcbiAgICAgICAgICAgICAgICAgICAgICh0MiAqIHkxIC0gdDEgKiB5MikgKiByLFxuICAgICAgICAgICAgICAgICAgICAgKHQyICogejEgLSB0MSAqIHoyKSAqIHIpO1xuICAgICAgICAgICAgdGRpci5zZXQoKHMxICogeDIgLSBzMiAqIHgxKSAqIHIsXG4gICAgICAgICAgICAgICAgICAgICAoczEgKiB5MiAtIHMyICogeTEpICogcixcbiAgICAgICAgICAgICAgICAgICAgIChzMSAqIHoyIC0gczIgKiB6MSkgKiByKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhbjFbaTEgKiAzICsgMF0gKz0gc2Rpci54O1xuICAgICAgICB0YW4xW2kxICogMyArIDFdICs9IHNkaXIueTtcbiAgICAgICAgdGFuMVtpMSAqIDMgKyAyXSArPSBzZGlyLno7XG4gICAgICAgIHRhbjFbaTIgKiAzICsgMF0gKz0gc2Rpci54O1xuICAgICAgICB0YW4xW2kyICogMyArIDFdICs9IHNkaXIueTtcbiAgICAgICAgdGFuMVtpMiAqIDMgKyAyXSArPSBzZGlyLno7XG4gICAgICAgIHRhbjFbaTMgKiAzICsgMF0gKz0gc2Rpci54O1xuICAgICAgICB0YW4xW2kzICogMyArIDFdICs9IHNkaXIueTtcbiAgICAgICAgdGFuMVtpMyAqIDMgKyAyXSArPSBzZGlyLno7XG5cbiAgICAgICAgdGFuMltpMSAqIDMgKyAwXSArPSB0ZGlyLng7XG4gICAgICAgIHRhbjJbaTEgKiAzICsgMV0gKz0gdGRpci55O1xuICAgICAgICB0YW4yW2kxICogMyArIDJdICs9IHRkaXIuejtcbiAgICAgICAgdGFuMltpMiAqIDMgKyAwXSArPSB0ZGlyLng7XG4gICAgICAgIHRhbjJbaTIgKiAzICsgMV0gKz0gdGRpci55O1xuICAgICAgICB0YW4yW2kyICogMyArIDJdICs9IHRkaXIuejtcbiAgICAgICAgdGFuMltpMyAqIDMgKyAwXSArPSB0ZGlyLng7XG4gICAgICAgIHRhbjJbaTMgKiAzICsgMV0gKz0gdGRpci55O1xuICAgICAgICB0YW4yW2kzICogMyArIDJdICs9IHRkaXIuejtcbiAgICB9XG5cbiAgICBjb25zdCB0MSA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdDIgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IG4gPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRlbXAgPSBuZXcgVmVjMygpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhDb3VudDsgaSsrKSB7XG4gICAgICAgIG4uc2V0KG5vcm1hbHNbaSAqIDNdLCBub3JtYWxzW2kgKiAzICsgMV0sIG5vcm1hbHNbaSAqIDMgKyAyXSk7XG4gICAgICAgIHQxLnNldCh0YW4xW2kgKiAzXSwgdGFuMVtpICogMyArIDFdLCB0YW4xW2kgKiAzICsgMl0pO1xuICAgICAgICB0Mi5zZXQodGFuMltpICogM10sIHRhbjJbaSAqIDMgKyAxXSwgdGFuMltpICogMyArIDJdKTtcblxuICAgICAgICAvLyBHcmFtLVNjaG1pZHQgb3J0aG9nb25hbGl6ZVxuICAgICAgICBjb25zdCBuZG90dCA9IG4uZG90KHQxKTtcbiAgICAgICAgdGVtcC5jb3B5KG4pLm11bFNjYWxhcihuZG90dCk7XG4gICAgICAgIHRlbXAuc3ViMih0MSwgdGVtcCkubm9ybWFsaXplKCk7XG5cbiAgICAgICAgdGFuZ2VudHNbaSAqIDRdICAgICA9IHRlbXAueDtcbiAgICAgICAgdGFuZ2VudHNbaSAqIDQgKyAxXSA9IHRlbXAueTtcbiAgICAgICAgdGFuZ2VudHNbaSAqIDQgKyAyXSA9IHRlbXAuejtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgaGFuZGVkbmVzc1xuICAgICAgICB0ZW1wLmNyb3NzKG4sIHQxKTtcbiAgICAgICAgdGFuZ2VudHNbaSAqIDQgKyAzXSA9ICh0ZW1wLmRvdCh0MikgPCAwLjApID8gLTEuMCA6IDEuMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFuZ2VudHM7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBtZXNoIG9iamVjdCBmcm9tIHRoZSBzdXBwbGllZCB2ZXJ0ZXggaW5mb3JtYXRpb24gYW5kIHRvcG9sb2d5LlxuICpcbiAqIEBwYXJhbSB7R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBwb3NpdGlvbnMuXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5ub3JtYWxzXSAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IG5vcm1hbHMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy50YW5nZW50c10gLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCB0YW5nZW50cy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmNvbG9yc10gLSBBbiBhcnJheSBvZiA0LWRpbWVuc2lvbmFsIHZlcnRleCBjb2xvcnMgd2hlcmUgZWFjaCBjb21wb25lbnRcbiAqIGlzIGFuIGludGVnZXIgaW4gdGhlIHJhbmdlIDAgdG8gMjU1LlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMudXZzXSAtIEFuIGFycmF5IG9mIDItZGltZW5zaW9uYWwgdmVydGV4IHRleHR1cmUgY29vcmRpbmF0ZXMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy51dnMxXSAtIFNhbWUgYXMgb3B0cy51dnMsIGJ1dCBmb3IgYWRkaXRpb25hbCBVViBzZXRcbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmJsZW5kSW5kaWNlc10gLSBBbiBhcnJheSBvZiA0LWRpbWVuc2lvbmFsIGJvbmUgaW5kaWNlcyB3aGVyZSBlYWNoXG4gKiBjb21wb25lbnQgaXMgYW4gaW50ZWdlciBpbiB0aGUgcmFuZ2UgMCB0byAyNTUuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5ibGVuZFdlaWdodHNdIC0gQW4gYXJyYXkgb2YgNC1kaW1lbnNpb25hbCBib25lIHdlaWdodHMgd2hlcmUgZWFjaFxuICogY29tcG9uZW50IGlzIGluIHRoZSByYW5nZSAwIHRvIDEgYW5kIHRoZSBzdW0gb2YgdGhlIHdlaWdodHMgc2hvdWxkIGVxdWFsIDEuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5pbmRpY2VzXSAtIEFuIGFycmF5IG9mIHRyaWFuZ2xlIGluZGljZXMuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgTWVzaCBjb25zdHJ1Y3RlZCBmcm9tIHRoZSBzdXBwbGllZCB2ZXJ0ZXggYW5kIHRyaWFuZ2xlIGRhdGEuXG4gKiBAZXhhbXBsZVxuICogLy8gQ3JlYXRlIGEgc2ltcGxlLCBpbmRleGVkIHRyaWFuZ2xlICh3aXRoIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kIHZlcnRleCBub3JtYWxzKVxuICogdmFyIG1lc2ggPSBwYy5jcmVhdGVNZXNoKGdyYXBoaWNzRGV2aWNlLCBbMCwgMCwgMCwgMSwgMCwgMCwgMCwgMSwgMF0sIHtcbiAqICAgICBub3JtYWxzOiBbMCwgMCwgMSwgMCwgMCwgMSwgMCwgMCwgMV0sXG4gKiAgICAgdXZzOiBbMCwgMCwgMSwgMCwgMCwgMV0sXG4gKiAgICAgaW5kaWNlczogWzAsIDEsIDJdXG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gY3JlYXRlTWVzaChkZXZpY2UsIHBvc2l0aW9ucywgb3B0cykge1xuXG4gICAgY29uc3QgbWVzaCA9IG5ldyBNZXNoKGRldmljZSk7XG4gICAgbWVzaC5zZXRQb3NpdGlvbnMocG9zaXRpb25zKTtcblxuICAgIGlmIChvcHRzKSB7XG4gICAgICAgIGlmIChvcHRzLm5vcm1hbHMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0Tm9ybWFscyhvcHRzLm5vcm1hbHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMudGFuZ2VudHMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX1RBTkdFTlQsIG9wdHMudGFuZ2VudHMsIDQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuY29sb3JzKSB7XG4gICAgICAgICAgICBtZXNoLnNldENvbG9yczMyKG9wdHMuY29sb3JzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLnV2cykge1xuICAgICAgICAgICAgbWVzaC5zZXRVdnMoMCwgb3B0cy51dnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMudXZzMSkge1xuICAgICAgICAgICAgbWVzaC5zZXRVdnMoMSwgb3B0cy51dnMxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmJsZW5kSW5kaWNlcykge1xuICAgICAgICAgICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBvcHRzLmJsZW5kSW5kaWNlcywgNCwgb3B0cy5ibGVuZEluZGljZXMubGVuZ3RoIC8gNCwgVFlQRV9VSU5UOCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5ibGVuZFdlaWdodHMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX0JMRU5EV0VJR0hULCBvcHRzLmJsZW5kV2VpZ2h0cywgNCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5pbmRpY2VzKSB7XG4gICAgICAgICAgICBtZXNoLnNldEluZGljZXMob3B0cy5pbmRpY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1lc2gudXBkYXRlKCk7XG4gICAgcmV0dXJuIG1lc2g7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgdG9ydXMtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSB0b3J1cyBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb25cbiAqIHBhcmFtZXRlcnMuIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIHRvcnVzIGluIHRoZSBYWi1wbGFuZSB3aXRoIGEgdHViZSByYWRpdXMgb2ZcbiAqIDAuMiwgYSByaW5nIHJhZGl1cyBvZiAwLjMsIDIwIHNlZ21lbnRzIGFuZCAzMCBzaWRlcy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHRvcnVzIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgdG9ydXMncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMudHViZVJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSB0dWJlIGZvcm1pbmcgdGhlIGJvZHkgb2YgdGhlIHRvcnVzXG4gKiAoZGVmYXVsdHMgdG8gMC4yKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5yaW5nUmFkaXVzXSAtIFRoZSByYWRpdXMgZnJvbSB0aGUgY2VudHJlIG9mIHRoZSB0b3J1cyB0byB0aGUgY2VudHJlIG9mIHRoZVxuICogdHViZSAoZGVmYXVsdHMgdG8gMC4zKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5zZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIHJhZGlhbCBkaXZpc2lvbnMgZm9ybWluZyBjcm9zcy1zZWN0aW9ucyBvZiB0aGVcbiAqIHRvcnVzIHJpbmcgKGRlZmF1bHRzIHRvIDIwKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5zaWRlc10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhcm91bmQgdGhlIHR1YnVsYXIgYm9keSBvZiB0aGUgdG9ydXMgcmluZ1xuICogKGRlZmF1bHRzIHRvIDMwKS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IHRvcnVzLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVUb3J1cyhkZXZpY2UsIG9wdHMpIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IHJjID0gb3B0cyAmJiBvcHRzLnR1YmVSYWRpdXMgIT09IHVuZGVmaW5lZCA/IG9wdHMudHViZVJhZGl1cyA6IDAuMjtcbiAgICBjb25zdCBydCA9IG9wdHMgJiYgb3B0cy5yaW5nUmFkaXVzICE9PSB1bmRlZmluZWQgPyBvcHRzLnJpbmdSYWRpdXMgOiAwLjM7XG4gICAgY29uc3Qgc2VnbWVudHMgPSBvcHRzICYmIG9wdHMuc2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuc2VnbWVudHMgOiAzMDtcbiAgICBjb25zdCBzaWRlcyA9IG9wdHMgJiYgb3B0cy5zaWRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5zaWRlcyA6IDIwO1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMgJiYgb3B0cy5jYWxjdWxhdGVUYW5nZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA6IGZhbHNlO1xuXG4gICAgLy8gVmFyaWFibGUgZGVjbGFyYXRpb25zXG4gICAgY29uc3QgcG9zaXRpb25zID0gW107XG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuICAgIGNvbnN0IHV2cyA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHNpZGVzOyBpKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPD0gc2VnbWVudHM7IGorKykge1xuICAgICAgICAgICAgY29uc3QgeCA9IE1hdGguY29zKDIgKiBNYXRoLlBJICogaiAvIHNlZ21lbnRzKSAqIChydCArIHJjICogTWF0aC5jb3MoMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpKTtcbiAgICAgICAgICAgIGNvbnN0IHkgPSBNYXRoLnNpbigyICogTWF0aC5QSSAqIGkgLyBzaWRlcykgKiByYztcbiAgICAgICAgICAgIGNvbnN0IHogPSBNYXRoLnNpbigyICogTWF0aC5QSSAqIGogLyBzZWdtZW50cykgKiAocnQgKyByYyAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG54ID0gTWF0aC5jb3MoMiAqIE1hdGguUEkgKiBqIC8gc2VnbWVudHMpICogTWF0aC5jb3MoMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpO1xuICAgICAgICAgICAgY29uc3QgbnkgPSBNYXRoLnNpbigyICogTWF0aC5QSSAqIGkgLyBzaWRlcyk7XG4gICAgICAgICAgICBjb25zdCBueiA9IE1hdGguc2luKDIgKiBNYXRoLlBJICogaiAvIHNlZ21lbnRzKSAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKTtcblxuICAgICAgICAgICAgY29uc3QgdSA9IGkgLyBzaWRlcztcbiAgICAgICAgICAgIGNvbnN0IHYgPSAxIC0gaiAvIHNlZ21lbnRzO1xuXG4gICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4LCB5LCB6KTtcbiAgICAgICAgICAgIG5vcm1hbHMucHVzaChueCwgbnksIG56KTtcbiAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEuMCAtIHYpO1xuXG4gICAgICAgICAgICBpZiAoKGkgPCBzaWRlcykgJiYgKGogPCBzZWdtZW50cykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXJzdCAgPSAoKGkpKSAgICAgKiAoc2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9ICgoaSArIDEpKSAqIChzZWdtZW50cyArIDEpICsgKChqKSk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGhpcmQgID0gKChpKSkgICAgICogKHNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZm91cnRoID0gKChpICsgMSkpICogKHNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG5cbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goZmlyc3QsIHNlY29uZCwgdGhpcmQpO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChzZWNvbmQsIGZvdXJ0aCwgdGhpcmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2cyxcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBwb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlQ29uZURhdGEoYmFzZVJhZGl1cywgcGVha1JhZGl1cywgaGVpZ2h0LCBoZWlnaHRTZWdtZW50cywgY2FwU2VnbWVudHMsIHJvdW5kZWRDYXBzKSB7XG4gICAgLy8gVmFyaWFibGUgZGVjbGFyYXRpb25zXG4gICAgY29uc3QgcG9zID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBib3R0b21Ub1RvcCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3Qgbm9ybSA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdG9wID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBib3R0b20gPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRhbmdlbnQgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCB1dnMxID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuICAgIGxldCBvZmZzZXQ7XG5cbiAgICAvLyBEZWZpbmUgdGhlIGJvZHkgb2YgdGhlIGNvbmUvY3lsaW5kZXJcbiAgICBpZiAoaGVpZ2h0ID4gMCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBoZWlnaHRTZWdtZW50czsgaSsrKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8PSBjYXBTZWdtZW50czsgaisrKSB7XG4gICAgICAgICAgICAgICAgLy8gU3dlZXAgdGhlIGNvbmUgYm9keSBmcm9tIHRoZSBwb3NpdGl2ZSBZIGF4aXMgdG8gbWF0Y2ggYSAzRFMgTWF4IGNvbmUvY3lsaW5kZXJcbiAgICAgICAgICAgICAgICBjb25zdCB0aGV0YSA9IChqIC8gY2FwU2VnbWVudHMpICogMiAqIE1hdGguUEkgLSBNYXRoLlBJO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5jb3ModGhldGEpO1xuICAgICAgICAgICAgICAgIGJvdHRvbS5zZXQoc2luVGhldGEgKiBiYXNlUmFkaXVzLCAtaGVpZ2h0IC8gMiwgY29zVGhldGEgKiBiYXNlUmFkaXVzKTtcbiAgICAgICAgICAgICAgICB0b3Auc2V0KHNpblRoZXRhICogcGVha1JhZGl1cywgaGVpZ2h0IC8gMiwgY29zVGhldGEgKiBwZWFrUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBwb3MubGVycChib3R0b20sIHRvcCwgaSAvIGhlaWdodFNlZ21lbnRzKTtcbiAgICAgICAgICAgICAgICBib3R0b21Ub1RvcC5zdWIyKHRvcCwgYm90dG9tKS5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgICAgICB0YW5nZW50LnNldChjb3NUaGV0YSwgMCwgLXNpblRoZXRhKTtcbiAgICAgICAgICAgICAgICBub3JtLmNyb3NzKHRhbmdlbnQsIGJvdHRvbVRvVG9wKS5ub3JtYWxpemUoKTtcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHBvcy54LCBwb3MueSwgcG9zLnopO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaChub3JtLngsIG5vcm0ueSwgbm9ybS56KTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IGogLyBjYXBTZWdtZW50cztcbiAgICAgICAgICAgICAgICBsZXQgdiA9IGkgLyBoZWlnaHRTZWdtZW50cztcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBQYWNrIFVWMSB0byAxc3QgdGhpcmRcbiAgICAgICAgICAgICAgICBjb25zdCBfdiA9IHY7XG4gICAgICAgICAgICAgICAgdiA9IHU7XG4gICAgICAgICAgICAgICAgdSA9IF92O1xuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoKGkgPCBoZWlnaHRTZWdtZW50cykgJiYgKGogPCBjYXBTZWdtZW50cykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlyc3QgICA9ICgoaSkpICAgICAqIChjYXBTZWdtZW50cyArIDEpICsgKChqKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlY29uZCAgPSAoKGkpKSAgICAgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaiArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGhpcmQgICA9ICgoaSArIDEpKSAqIChjYXBTZWdtZW50cyArIDEpICsgKChqKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvdXJ0aCAgPSAoKGkgKyAxKSkgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaiArIDEpKTtcblxuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goZmlyc3QsIHNlY29uZCwgdGhpcmQpO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goc2Vjb25kLCBmb3VydGgsIHRoaXJkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocm91bmRlZENhcHMpIHtcbiAgICAgICAgY29uc3QgbGF0aXR1ZGVCYW5kcyA9IE1hdGguZmxvb3IoY2FwU2VnbWVudHMgLyAyKTtcbiAgICAgICAgY29uc3QgbG9uZ2l0dWRlQmFuZHMgPSBjYXBTZWdtZW50cztcbiAgICAgICAgY29uc3QgY2FwT2Zmc2V0ID0gaGVpZ2h0IC8gMjtcblxuICAgICAgICAvLyBHZW5lcmF0ZSB0b3AgY2FwXG4gICAgICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8PSBsYXRpdHVkZUJhbmRzOyBsYXQrKykge1xuICAgICAgICAgICAgY29uc3QgdGhldGEgPSAobGF0ICogTWF0aC5QSSAqIDAuNSkgLyBsYXRpdHVkZUJhbmRzO1xuICAgICAgICAgICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNpbih0aGV0YSk7XG4gICAgICAgICAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguY29zKHRoZXRhKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDw9IGxvbmdpdHVkZUJhbmRzOyBsb24rKykge1xuICAgICAgICAgICAgICAgIC8vIFN3ZWVwIHRoZSBzcGhlcmUgZnJvbSB0aGUgcG9zaXRpdmUgWiBheGlzIHRvIG1hdGNoIGEgM0RTIE1heCBzcGhlcmVcbiAgICAgICAgICAgICAgICBjb25zdCBwaGkgPSBsb24gKiAyICogTWF0aC5QSSAvIGxvbmdpdHVkZUJhbmRzIC0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2luUGhpID0gTWF0aC5zaW4ocGhpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb3NQaGkgPSBNYXRoLmNvcyhwaGkpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IGNvc1BoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSBjb3NUaGV0YTtcbiAgICAgICAgICAgICAgICBjb25zdCB6ID0gc2luUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSAxIC0gbG9uIC8gbG9uZ2l0dWRlQmFuZHM7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSAxIC0gbGF0IC8gbGF0aXR1ZGVCYW5kcztcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiBwZWFrUmFkaXVzLCB5ICogcGVha1JhZGl1cyArIGNhcE9mZnNldCwgeiAqIHBlYWtSYWRpdXMpO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaCh4LCB5LCB6KTtcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBQYWNrIFVWMSB0byAybmQgdGhpcmRcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB2IC89IDM7XG4gICAgICAgICAgICAgICAgdSArPSAxLjAgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBvZmZzZXQgPSAoaGVpZ2h0U2VnbWVudHMgKyAxKSAqIChjYXBTZWdtZW50cyArIDEpO1xuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPCBsYXRpdHVkZUJhbmRzOyArK2xhdCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDwgbG9uZ2l0dWRlQmFuZHM7ICsrbG9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3QgID0gKGxhdCAqIChsb25naXR1ZGVCYW5kcyArIDEpKSArIGxvbjtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgPSBmaXJzdCArIGxvbmdpdHVkZUJhbmRzICsgMTtcblxuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChvZmZzZXQgKyBmaXJzdCArIDEsIG9mZnNldCArIHNlY29uZCwgb2Zmc2V0ICsgZmlyc3QpO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChvZmZzZXQgKyBmaXJzdCArIDEsIG9mZnNldCArIHNlY29uZCArIDEsIG9mZnNldCArIHNlY29uZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSBib3R0b20gY2FwXG4gICAgICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8PSBsYXRpdHVkZUJhbmRzOyBsYXQrKykge1xuICAgICAgICAgICAgY29uc3QgdGhldGEgPSBNYXRoLlBJICogMC41ICsgKGxhdCAqIE1hdGguUEkgKiAwLjUpIC8gbGF0aXR1ZGVCYW5kcztcbiAgICAgICAgICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgY29uc3QgY29zVGhldGEgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8PSBsb25naXR1ZGVCYW5kczsgbG9uKyspIHtcbiAgICAgICAgICAgICAgICAvLyBTd2VlcCB0aGUgc3BoZXJlIGZyb20gdGhlIHBvc2l0aXZlIFogYXhpcyB0byBtYXRjaCBhIDNEUyBNYXggc3BoZXJlXG4gICAgICAgICAgICAgICAgY29uc3QgcGhpID0gbG9uICogMiAqIE1hdGguUEkgLyBsb25naXR1ZGVCYW5kcyAtIE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpblBoaSA9IE1hdGguc2luKHBoaSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29zUGhpID0gTWF0aC5jb3MocGhpKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHggPSBjb3NQaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gY29zVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IHNpblBoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gMSAtIGxvbiAvIGxvbmdpdHVkZUJhbmRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gMSAtIGxhdCAvIGxhdGl0dWRlQmFuZHM7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4ICogcGVha1JhZGl1cywgeSAqIHBlYWtSYWRpdXMgLSBjYXBPZmZzZXQsIHogKiBwZWFrUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gM3JkIHRoaXJkXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuICAgICAgICAgICAgICAgIHUgKz0gMi4wIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb2Zmc2V0ID0gKGhlaWdodFNlZ21lbnRzICsgMSkgKiAoY2FwU2VnbWVudHMgKyAxKSArIChsb25naXR1ZGVCYW5kcyArIDEpICogKGxhdGl0dWRlQmFuZHMgKyAxKTtcbiAgICAgICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDwgbGF0aXR1ZGVCYW5kczsgKytsYXQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8IGxvbmdpdHVkZUJhbmRzOyArK2xvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICA9IChsYXQgKiAobG9uZ2l0dWRlQmFuZHMgKyAxKSkgKyBsb247XG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gZmlyc3QgKyBsb25naXR1ZGVCYW5kcyArIDE7XG5cbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQsIG9mZnNldCArIGZpcnN0KTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQgKyAxLCBvZmZzZXQgKyBzZWNvbmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gR2VuZXJhdGUgYm90dG9tIGNhcFxuICAgICAgICBvZmZzZXQgPSAoaGVpZ2h0U2VnbWVudHMgKyAxKSAqIChjYXBTZWdtZW50cyArIDEpO1xuICAgICAgICBpZiAoYmFzZVJhZGl1cyA+IDApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FwU2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGkgLyBjYXBTZWdtZW50cykgKiAyICogTWF0aC5QSTtcbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSAtaGVpZ2h0IC8gMjtcbiAgICAgICAgICAgICAgICBjb25zdCB6ID0gTWF0aC5jb3ModGhldGEpO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gMSAtICh4ICsgMSkgLyAyO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gKHogKyAxKSAvIDI7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4ICogYmFzZVJhZGl1cywgeSwgeiAqIGJhc2VSYWRpdXMpO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaCgwLCAtMSwgMCk7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gMm5kIHRoaXJkXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuICAgICAgICAgICAgICAgIHUgKz0gMSAvIDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIGlmIChpID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0LCBvZmZzZXQgKyBpLCBvZmZzZXQgKyBpIC0gMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgdG9wIGNhcFxuICAgICAgICBvZmZzZXQgKz0gY2FwU2VnbWVudHM7XG4gICAgICAgIGlmIChwZWFrUmFkaXVzID4gMCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYXBTZWdtZW50czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGhldGEgPSAoaSAvIGNhcFNlZ21lbnRzKSAqIDIgKiBNYXRoLlBJO1xuICAgICAgICAgICAgICAgIGNvbnN0IHggPSBNYXRoLnNpbih0aGV0YSk7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IGhlaWdodCAvIDI7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IE1hdGguY29zKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSAoeCArIDEpIC8gMjtcbiAgICAgICAgICAgICAgICBsZXQgdiA9ICh6ICsgMSkgLyAyO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIHBlYWtSYWRpdXMsIHksIHogKiBwZWFrUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goMCwgMSwgMCk7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gM3JkIHRoaXJkXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuICAgICAgICAgICAgICAgIHUgKz0gMiAvIDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIGlmIChpID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0LCBvZmZzZXQgKyBpIC0gMSwgb2Zmc2V0ICsgaSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcG9zaXRpb25zOiBwb3NpdGlvbnMsXG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMxLFxuICAgICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gICAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBjeWxpbmRlci1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIGN5bGluZGVyIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvblxuICogcGFyYW1ldGVycy4gQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgY3lsaW5kZXIgc3RhbmRpbmcgdmVydGljYWxseSBjZW50ZXJlZCBvbiB0aGVcbiAqIFhaLXBsYW5lIHdpdGggYSByYWRpdXMgb2YgMC41LCBhIGhlaWdodCBvZiAxLjAsIDEgaGVpZ2h0IHNlZ21lbnQgYW5kIDIwIGNhcCBzZWdtZW50cy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGN5bGluZGVyIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgY3lsaW5kZXIncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMucmFkaXVzXSAtIFRoZSByYWRpdXMgb2YgdGhlIHR1YmUgZm9ybWluZyB0aGUgYm9keSBvZiB0aGUgY3lsaW5kZXIgKGRlZmF1bHRzIHRvIDAuNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0XSAtIFRoZSBsZW5ndGggb2YgdGhlIGJvZHkgb2YgdGhlIGN5bGluZGVyIChkZWZhdWx0cyB0byAxLjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBsZW5ndGggb2YgdGhlIGN5bGluZGVyIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5jYXBTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhcm91bmQgdGhlIHR1YnVsYXIgYm9keSBvZiB0aGUgY3lsaW5kZXIgKGRlZmF1bHRzIHRvIDIwKS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IGN5bGluZGVyLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVDeWxpbmRlcihkZXZpY2UsIG9wdHMpIHtcbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgaWYgKG9wdHMgJiYgb3B0cy5oYXNPd25Qcm9wZXJ0eSgnYmFzZVJhZGl1cycpICYmICFvcHRzLmhhc093blByb3BlcnR5KCdyYWRpdXMnKSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdcImJhc2VSYWRpdXNcIiBpbiBhcmd1bWVudHMsIHVzZSBcInJhZGl1c1wiIGluc3RlYWQnKTtcbiAgICB9XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGxldCByYWRpdXMgPSBvcHRzICYmIChvcHRzLnJhZGl1cyB8fCBvcHRzLmJhc2VSYWRpdXMpO1xuICAgIHJhZGl1cyA9IHJhZGl1cyAhPT0gdW5kZWZpbmVkID8gcmFkaXVzIDogMC41O1xuICAgIGNvbnN0IGhlaWdodCA9IG9wdHMgJiYgb3B0cy5oZWlnaHQgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGVpZ2h0IDogMS4wO1xuICAgIGNvbnN0IGhlaWdodFNlZ21lbnRzID0gb3B0cyAmJiBvcHRzLmhlaWdodFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmhlaWdodFNlZ21lbnRzIDogNTtcbiAgICBjb25zdCBjYXBTZWdtZW50cyA9IG9wdHMgJiYgb3B0cy5jYXBTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYXBTZWdtZW50cyA6IDIwO1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMgJiYgb3B0cy5jYWxjdWxhdGVUYW5nZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA6IGZhbHNlO1xuXG4gICAgLy8gQ3JlYXRlIHZlcnRleCBkYXRhIGZvciBhIGNvbmUgdGhhdCBoYXMgYSBiYXNlIGFuZCBwZWFrIHJhZGl1cyB0aGF0IGlzIHRoZSBzYW1lIChpLmUuIGEgY3lsaW5kZXIpXG4gICAgY29uc3Qgb3B0aW9ucyA9IF9jcmVhdGVDb25lRGF0YShyYWRpdXMsIHJhZGl1cywgaGVpZ2h0LCBoZWlnaHRTZWdtZW50cywgY2FwU2VnbWVudHMsIGZhbHNlKTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zLm5vcm1hbHMsIG9wdGlvbnMudXZzLCBvcHRpb25zLmluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgb3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIGNhcHN1bGUtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjYXBzdWxlIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvblxuICogcGFyYW1ldGVycy4gQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgY2Fwc3VsZSBzdGFuZGluZyB2ZXJ0aWNhbGx5IGNlbnRlcmVkIG9uIHRoZVxuICogWFotcGxhbmUgd2l0aCBhIHJhZGl1cyBvZiAwLjI1LCBhIGhlaWdodCBvZiAxLjAsIDEgaGVpZ2h0IHNlZ21lbnQgYW5kIDEwIGNhcCBzZWdtZW50cy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGNhcHN1bGUgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBjYXBzdWxlJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSB0dWJlIGZvcm1pbmcgdGhlIGJvZHkgb2YgdGhlIGNhcHN1bGUgKGRlZmF1bHRzXG4gKiB0byAwLjMpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodF0gLSBUaGUgbGVuZ3RoIG9mIHRoZSBib2R5IG9mIHRoZSBjYXBzdWxlIGZyb20gdGlwIHRvIHRpcCAoZGVmYXVsdHNcbiAqIHRvIDEuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIHR1YnVsYXIgbGVuZ3RoIG9mIHRoZVxuICogY2Fwc3VsZSAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuc2lkZXNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYXJvdW5kIHRoZSB0dWJ1bGFyIGJvZHkgb2YgdGhlIGNhcHN1bGVcbiAqIChkZWZhdWx0cyB0byAyMCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBjeWxpbmRlci1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2Fwc3VsZShkZXZpY2UsIG9wdHMpIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IHJhZGl1cyA9IG9wdHMgJiYgb3B0cy5yYWRpdXMgIT09IHVuZGVmaW5lZCA/IG9wdHMucmFkaXVzIDogMC4zO1xuICAgIGNvbnN0IGhlaWdodCA9IG9wdHMgJiYgb3B0cy5oZWlnaHQgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGVpZ2h0IDogMS4wO1xuICAgIGNvbnN0IGhlaWdodFNlZ21lbnRzID0gb3B0cyAmJiBvcHRzLmhlaWdodFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmhlaWdodFNlZ21lbnRzIDogMTtcbiAgICBjb25zdCBzaWRlcyA9IG9wdHMgJiYgb3B0cy5zaWRlcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5zaWRlcyA6IDIwO1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMgJiYgb3B0cy5jYWxjdWxhdGVUYW5nZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA6IGZhbHNlO1xuXG4gICAgLy8gQ3JlYXRlIHZlcnRleCBkYXRhIGZvciBhIGNvbmUgdGhhdCBoYXMgYSBiYXNlIGFuZCBwZWFrIHJhZGl1cyB0aGF0IGlzIHRoZSBzYW1lIChpLmUuIGEgY3lsaW5kZXIpXG4gICAgY29uc3Qgb3B0aW9ucyA9IF9jcmVhdGVDb25lRGF0YShyYWRpdXMsIHJhZGl1cywgaGVpZ2h0IC0gMiAqIHJhZGl1cywgaGVpZ2h0U2VnbWVudHMsIHNpZGVzLCB0cnVlKTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zLm5vcm1hbHMsIG9wdGlvbnMudXZzLCBvcHRpb25zLmluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgb3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIGNvbmUtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjb25lIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvblxuICogcGFyYW1ldGVycy4gQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgY29uZSBzdGFuZGluZyB2ZXJ0aWNhbGx5IGNlbnRlcmVkIG9uIHRoZVxuICogWFotcGxhbmUgd2l0aCBhIGJhc2UgcmFkaXVzIG9mIDAuNSwgYSBoZWlnaHQgb2YgMS4wLCA1IGhlaWdodCBzZWdtZW50cyBhbmQgMjAgY2FwIHNlZ21lbnRzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgY29uZSBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudCBpbmZvcm1hdGlvblxuICogaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGNvbmUncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuYmFzZVJhZGl1c10gLSBUaGUgYmFzZSByYWRpdXMgb2YgdGhlIGNvbmUgKGRlZmF1bHRzIHRvIDAuNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMucGVha1JhZGl1c10gLSBUaGUgcGVhayByYWRpdXMgb2YgdGhlIGNvbmUgKGRlZmF1bHRzIHRvIDAuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0XSAtIFRoZSBsZW5ndGggb2YgdGhlIGJvZHkgb2YgdGhlIGNvbmUgKGRlZmF1bHRzIHRvIDEuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIGxlbmd0aCBvZiB0aGUgY29uZVxuICogKGRlZmF1bHRzIHRvIDUpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmNhcFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFyb3VuZCB0aGUgdHVidWxhciBib2R5IG9mIHRoZSBjb25lXG4gKiAoZGVmYXVsdHMgdG8gMTgpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgY29uZS1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ29uZShkZXZpY2UsIG9wdHMpIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IGJhc2VSYWRpdXMgPSBvcHRzICYmIG9wdHMuYmFzZVJhZGl1cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5iYXNlUmFkaXVzIDogMC41O1xuICAgIGNvbnN0IHBlYWtSYWRpdXMgPSBvcHRzICYmIG9wdHMucGVha1JhZGl1cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5wZWFrUmFkaXVzIDogMC4wO1xuICAgIGNvbnN0IGhlaWdodCA9IG9wdHMgJiYgb3B0cy5oZWlnaHQgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGVpZ2h0IDogMS4wO1xuICAgIGNvbnN0IGhlaWdodFNlZ21lbnRzID0gb3B0cyAmJiBvcHRzLmhlaWdodFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmhlaWdodFNlZ21lbnRzIDogNTtcbiAgICBjb25zdCBjYXBTZWdtZW50cyA9IG9wdHMgJiYgb3B0cy5jYXBTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYXBTZWdtZW50cyA6IDE4O1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMgJiYgb3B0cy5jYWxjdWxhdGVUYW5nZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA6IGZhbHNlO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IF9jcmVhdGVDb25lRGF0YShiYXNlUmFkaXVzLCBwZWFrUmFkaXVzLCBoZWlnaHQsIGhlaWdodFNlZ21lbnRzLCBjYXBTZWdtZW50cywgZmFsc2UpO1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMob3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMubm9ybWFscywgb3B0aW9ucy51dnMsIG9wdGlvbnMuaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgc3BoZXJlLXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBzcGhlcmUgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uIHBhcmFtZXRlcnMuIEJ5XG4gKiBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBzcGhlcmUgY2VudGVyZWQgb24gdGhlIG9iamVjdCBzcGFjZSBvcmlnaW4gd2l0aCBhIHJhZGl1cyBvZlxuICogMC41IGFuZCAxNiBzZWdtZW50cyBpbiBib3RoIGxvbmdpdHVkZSBhbmQgbGF0aXR1ZGUuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBzcGhlcmUgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBzcGhlcmUncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMucmFkaXVzXSAtIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSAoZGVmYXVsdHMgdG8gMC41KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5sYXRpdHVkZUJhbmRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBsYXRpdHVkaW5hbCBheGlzIG9mIHRoZVxuICogc3BoZXJlIChkZWZhdWx0cyB0byAxNikuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubG9uZ2l0dWRlQmFuZHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIGxvbmdpdHVkaW5hbCBheGlzIG9mXG4gKiB0aGUgc3BoZXJlIChkZWZhdWx0cyB0byAxNikuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBzcGhlcmUtc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVNwaGVyZShkZXZpY2UsIG9wdHMpIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IHJhZGl1cyA9IG9wdHMgJiYgb3B0cy5yYWRpdXMgIT09IHVuZGVmaW5lZCA/IG9wdHMucmFkaXVzIDogMC41O1xuICAgIGNvbnN0IGxhdGl0dWRlQmFuZHMgPSBvcHRzICYmIG9wdHMubGF0aXR1ZGVCYW5kcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5sYXRpdHVkZUJhbmRzIDogMTY7XG4gICAgY29uc3QgbG9uZ2l0dWRlQmFuZHMgPSBvcHRzICYmIG9wdHMubG9uZ2l0dWRlQmFuZHMgIT09IHVuZGVmaW5lZCA/IG9wdHMubG9uZ2l0dWRlQmFuZHMgOiAxNjtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzICYmIG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgOiBmYWxzZTtcblxuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCBpbmRpY2VzID0gW107XG5cbiAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPD0gbGF0aXR1ZGVCYW5kczsgbGF0KyspIHtcbiAgICAgICAgY29uc3QgdGhldGEgPSBsYXQgKiBNYXRoLlBJIC8gbGF0aXR1ZGVCYW5kcztcbiAgICAgICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNpbih0aGV0YSk7XG4gICAgICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5jb3ModGhldGEpO1xuXG4gICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8PSBsb25naXR1ZGVCYW5kczsgbG9uKyspIHtcbiAgICAgICAgICAgIC8vIFN3ZWVwIHRoZSBzcGhlcmUgZnJvbSB0aGUgcG9zaXRpdmUgWiBheGlzIHRvIG1hdGNoIGEgM0RTIE1heCBzcGhlcmVcbiAgICAgICAgICAgIGNvbnN0IHBoaSA9IGxvbiAqIDIgKiBNYXRoLlBJIC8gbG9uZ2l0dWRlQmFuZHMgLSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgIGNvbnN0IHNpblBoaSA9IE1hdGguc2luKHBoaSk7XG4gICAgICAgICAgICBjb25zdCBjb3NQaGkgPSBNYXRoLmNvcyhwaGkpO1xuXG4gICAgICAgICAgICBjb25zdCB4ID0gY29zUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICBjb25zdCB5ID0gY29zVGhldGE7XG4gICAgICAgICAgICBjb25zdCB6ID0gc2luUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICBjb25zdCB1ID0gMSAtIGxvbiAvIGxvbmdpdHVkZUJhbmRzO1xuICAgICAgICAgICAgY29uc3QgdiA9IDEgLSBsYXQgLyBsYXRpdHVkZUJhbmRzO1xuXG4gICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4ICogcmFkaXVzLCB5ICogcmFkaXVzLCB6ICogcmFkaXVzKTtcbiAgICAgICAgICAgIG5vcm1hbHMucHVzaCh4LCB5LCB6KTtcbiAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8IGxhdGl0dWRlQmFuZHM7ICsrbGF0KSB7XG4gICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8IGxvbmdpdHVkZUJhbmRzOyArK2xvbikge1xuICAgICAgICAgICAgY29uc3QgZmlyc3QgID0gKGxhdCAqIChsb25naXR1ZGVCYW5kcyArIDEpKSArIGxvbjtcbiAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9IGZpcnN0ICsgbG9uZ2l0dWRlQmFuZHMgKyAxO1xuXG4gICAgICAgICAgICBpbmRpY2VzLnB1c2goZmlyc3QgKyAxLCBzZWNvbmQsIGZpcnN0KTtcbiAgICAgICAgICAgIGluZGljZXMucHVzaChmaXJzdCArIDEsIHNlY29uZCArIDEsIHNlY29uZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzLCAvLyBVVjEgPSBVVjAgZm9yIHNwaGVyZVxuICAgICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gICAgfTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIHBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgcGxhbmUtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIHBsYW5lIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvbiBwYXJhbWV0ZXJzLiBCeVxuICogZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgcGxhbmUgY2VudGVyZWQgb24gdGhlIG9iamVjdCBzcGFjZSBvcmlnaW4gd2l0aCBhIHdpZHRoIGFuZFxuICogbGVuZ3RoIG9mIDEuMCBhbmQgNSBzZWdtZW50cyBpbiBlaXRoZXIgYXhpcyAoNTAgdHJpYW5nbGVzKS4gVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIHBsYW5lIGlzXG4gKiBhbGlnbmVkIGFsb25nIHRoZSBwb3NpdGl2ZSBZIGF4aXMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBwbGFuZSBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIHBsYW5lJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtWZWMyfSBbb3B0cy5oYWxmRXh0ZW50c10gLSBUaGUgaGFsZiBkaW1lbnNpb25zIG9mIHRoZSBwbGFuZSBpbiB0aGUgWCBhbmQgWiBheGVzXG4gKiAoZGVmYXVsdHMgdG8gWzAuNSwgMC41XSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMud2lkdGhTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWCBheGlzIG9mIHRoZSBwbGFuZVxuICogKGRlZmF1bHRzIHRvIDUpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmxlbmd0aFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBaIGF4aXMgb2YgdGhlIHBsYW5lXG4gKiAoZGVmYXVsdHMgdG8gNSkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBwbGFuZS1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGxhbmUoZGV2aWNlLCBvcHRzKSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCBoZSA9IG9wdHMgJiYgb3B0cy5oYWxmRXh0ZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5oYWxmRXh0ZW50cyA6IG5ldyBWZWMyKDAuNSwgMC41KTtcbiAgICBjb25zdCB3cyA9IG9wdHMgJiYgb3B0cy53aWR0aFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLndpZHRoU2VnbWVudHMgOiA1O1xuICAgIGNvbnN0IGxzID0gb3B0cyAmJiBvcHRzLmxlbmd0aFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmxlbmd0aFNlZ21lbnRzIDogNTtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzICYmIG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgOiBmYWxzZTtcblxuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCBpbmRpY2VzID0gW107XG5cbiAgICAvLyBHZW5lcmF0ZSBwbGFuZSBhcyBmb2xsb3dzIChhc3NpZ25lZCBVVnMgZGVub3RlZCBhdCBjb3JuZXJzKTpcbiAgICAvLyAoMCwxKXgtLS0tLS0tLS14KDEsMSlcbiAgICAvLyAgICAgIHwgICAgICAgICB8XG4gICAgLy8gICAgICB8ICAgICAgICAgfFxuICAgIC8vICAgICAgfCAgICBPLS1YIHxsZW5ndGhcbiAgICAvLyAgICAgIHwgICAgfCAgICB8XG4gICAgLy8gICAgICB8ICAgIFogICAgfFxuICAgIC8vICgwLDApeC0tLS0tLS0tLXgoMSwwKVxuICAgIC8vIHdpZHRoXG4gICAgbGV0IHZjb3VudGVyID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHdzOyBpKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPD0gbHM7IGorKykge1xuICAgICAgICAgICAgY29uc3QgeCA9IC1oZS54ICsgMiAqIGhlLnggKiBpIC8gd3M7XG4gICAgICAgICAgICBjb25zdCB5ID0gMC4wO1xuICAgICAgICAgICAgY29uc3QgeiA9IC0oLWhlLnkgKyAyICogaGUueSAqIGogLyBscyk7XG4gICAgICAgICAgICBjb25zdCB1ID0gaSAvIHdzO1xuICAgICAgICAgICAgY29uc3QgdiA9IGogLyBscztcblxuICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICBub3JtYWxzLnB1c2goMCwgMSwgMCk7XG4gICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgIGlmICgoaSA8IHdzKSAmJiAoaiA8IGxzKSkge1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCh2Y291bnRlciArIGxzICsgMSwgdmNvdW50ZXIgKyAxLCB2Y291bnRlcik7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZjb3VudGVyICsgbHMgKyAxLCB2Y291bnRlciArIGxzICsgMiwgdmNvdW50ZXIgKyAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmNvdW50ZXIrKztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMsIC8vIFVWMSA9IFVWMCBmb3IgcGxhbmVcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBwb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIGJveC1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIGJveCBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb24gcGFyYW1ldGVycy5cbiAqIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIGJveCBjZW50ZXJlZCBvbiB0aGUgb2JqZWN0IHNwYWNlIG9yaWdpbiB3aXRoIGEgd2lkdGgsXG4gKiBsZW5ndGggYW5kIGhlaWdodCBvZiAxLjAgdW5pdCBhbmQgMTAgc2VnbWVudHMgaW4gZWl0aGVyIGF4aXMgKDUwIHRyaWFuZ2xlcyBwZXIgZmFjZSkuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBib3ggaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxIG9uIGVhY2ggZmFjZS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgYm94J3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtWZWMzfSBbb3B0cy5oYWxmRXh0ZW50c10gLSBUaGUgaGFsZiBkaW1lbnNpb25zIG9mIHRoZSBib3ggaW4gZWFjaCBheGlzIChkZWZhdWx0cyB0b1xuICogWzAuNSwgMC41LCAwLjVdKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy53aWR0aFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBYIGF4aXMgb2YgdGhlIGJveFxuICogKGRlZmF1bHRzIHRvIDEpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmxlbmd0aFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBaIGF4aXMgb2YgdGhlIGJveFxuICogKGRlZmF1bHRzIHRvIDEpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBZIGF4aXMgb2YgdGhlIGJveFxuICogKGRlZmF1bHRzIHRvIDEpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgYm94LXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVCb3goZGV2aWNlLCBvcHRzKSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCBoZSA9IG9wdHMgJiYgb3B0cy5oYWxmRXh0ZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5oYWxmRXh0ZW50cyA6IG5ldyBWZWMzKDAuNSwgMC41LCAwLjUpO1xuICAgIGNvbnN0IHdzID0gb3B0cyAmJiBvcHRzLndpZHRoU2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMud2lkdGhTZWdtZW50cyA6IDE7XG4gICAgY29uc3QgbHMgPSBvcHRzICYmIG9wdHMubGVuZ3RoU2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMubGVuZ3RoU2VnbWVudHMgOiAxO1xuICAgIGNvbnN0IGhzID0gb3B0cyAmJiBvcHRzLmhlaWdodFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmhlaWdodFNlZ21lbnRzIDogMTtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzICYmIG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgOiBmYWxzZTtcblxuICAgIGNvbnN0IGNvcm5lcnMgPSBbXG4gICAgICAgIG5ldyBWZWMzKC1oZS54LCAtaGUueSwgaGUueiksXG4gICAgICAgIG5ldyBWZWMzKGhlLngsIC1oZS55LCBoZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgaGUueSwgaGUueiksXG4gICAgICAgIG5ldyBWZWMzKC1oZS54LCBoZS55LCBoZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgLWhlLnksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIC1oZS55LCAtaGUueiksXG4gICAgICAgIG5ldyBWZWMzKC1oZS54LCBoZS55LCAtaGUueiksXG4gICAgICAgIG5ldyBWZWMzKGhlLngsIGhlLnksIC1oZS56KVxuICAgIF07XG5cbiAgICBjb25zdCBmYWNlQXhlcyA9IFtcbiAgICAgICAgWzAsIDEsIDNdLCAvLyBGUk9OVFxuICAgICAgICBbNCwgNSwgN10sIC8vIEJBQ0tcbiAgICAgICAgWzMsIDIsIDZdLCAvLyBUT1BcbiAgICAgICAgWzEsIDAsIDRdLCAvLyBCT1RUT01cbiAgICAgICAgWzEsIDQsIDJdLCAvLyBSSUdIVFxuICAgICAgICBbNSwgMCwgNl0gIC8vIExFRlRcbiAgICBdO1xuXG4gICAgY29uc3QgZmFjZU5vcm1hbHMgPSBbXG4gICAgICAgIFswLCAgMCwgIDFdLCAvLyBGUk9OVFxuICAgICAgICBbMCwgIDAsIC0xXSwgLy8gQkFDS1xuICAgICAgICBbMCwgIDEsICAwXSwgLy8gVE9QXG4gICAgICAgIFswLCAtMSwgIDBdLCAvLyBCT1RUT01cbiAgICAgICAgWzEsICAwLCAgMF0sIC8vIFJJR0hUXG4gICAgICAgIFstMSwgIDAsICAwXSAgLy8gTEVGVFxuICAgIF07XG5cbiAgICBjb25zdCBzaWRlcyA9IHtcbiAgICAgICAgRlJPTlQ6IDAsXG4gICAgICAgIEJBQ0s6IDEsXG4gICAgICAgIFRPUDogMixcbiAgICAgICAgQk9UVE9NOiAzLFxuICAgICAgICBSSUdIVDogNCxcbiAgICAgICAgTEVGVDogNVxuICAgIH07XG5cbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgdXZzMSA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcbiAgICBsZXQgdmNvdW50ZXIgPSAwO1xuXG4gICAgY29uc3QgZ2VuZXJhdGVGYWNlID0gKHNpZGUsIHVTZWdtZW50cywgdlNlZ21lbnRzKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXAxID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgdGVtcDIgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCB0ZW1wMyA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IHIgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHVTZWdtZW50czsgaSsrKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8PSB2U2VnbWVudHM7IGorKykge1xuICAgICAgICAgICAgICAgIHRlbXAxLmxlcnAoY29ybmVyc1tmYWNlQXhlc1tzaWRlXVswXV0sIGNvcm5lcnNbZmFjZUF4ZXNbc2lkZV1bMV1dLCBpIC8gdVNlZ21lbnRzKTtcbiAgICAgICAgICAgICAgICB0ZW1wMi5sZXJwKGNvcm5lcnNbZmFjZUF4ZXNbc2lkZV1bMF1dLCBjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzJdXSwgaiAvIHZTZWdtZW50cyk7XG4gICAgICAgICAgICAgICAgdGVtcDMuc3ViMih0ZW1wMiwgY29ybmVyc1tmYWNlQXhlc1tzaWRlXVswXV0pO1xuICAgICAgICAgICAgICAgIHIuYWRkMih0ZW1wMSwgdGVtcDMpO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gaSAvIHVTZWdtZW50cztcbiAgICAgICAgICAgICAgICBsZXQgdiA9IGogLyB2U2VnbWVudHM7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaChyLngsIHIueSwgci56KTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goZmFjZU5vcm1hbHNbc2lkZV1bMF0sIGZhY2VOb3JtYWxzW3NpZGVdWzFdLCBmYWNlTm9ybWFsc1tzaWRlXVsyXSk7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gcGFjayBhcyAzeDIuIDEvMyB3aWxsIGJlIGVtcHR5LCBidXQgaXQncyBlaXRoZXIgdGhhdCBvciBzdHJldGNoZWQgcGl4ZWxzXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogZ2VuZXJhdGUgbm9uLXJlY3Rhbmd1bGFyIGxpZ2h0TWFwcywgc28gd2UgY291bGQgdXNlIHNwYWNlIHdpdGhvdXQgc3RyZXRjaGluZ1xuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcblxuICAgICAgICAgICAgICAgIHUgKz0gKHNpZGUgJSAzKSAvIDM7XG4gICAgICAgICAgICAgICAgdiArPSBNYXRoLmZsb29yKHNpZGUgLyAzKSAvIDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIGlmICgoaSA8IHVTZWdtZW50cykgJiYgKGogPCB2U2VnbWVudHMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCh2Y291bnRlciArIHZTZWdtZW50cyArIDEsIHZjb3VudGVyICsgMSwgdmNvdW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2godmNvdW50ZXIgKyB2U2VnbWVudHMgKyAxLCB2Y291bnRlciArIHZTZWdtZW50cyArIDIsIHZjb3VudGVyICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmNvdW50ZXIrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuRlJPTlQsIHdzLCBocyk7XG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLkJBQ0ssIHdzLCBocyk7XG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLlRPUCwgd3MsIGxzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuQk9UVE9NLCB3cywgbHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5SSUdIVCwgbHMsIGhzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuTEVGVCwgbHMsIGhzKTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMxLFxuICAgICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gICAgfTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIHBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8vIHJldHVybnMgUHJpbWl0aXZlIGRhdGEsIHVzZWQgYnkgTW9kZWxDb21wb25lbnQgYW5kIFJlbmRlckNvbXBvbmVudFxuZnVuY3Rpb24gZ2V0U2hhcGVQcmltaXRpdmUoZGV2aWNlLCB0eXBlKSB7XG5cbiAgICAvLyBmaW5kIGluIGNhY2hlXG4gICAgbGV0IHByaW1EYXRhID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNoYXBlUHJpbWl0aXZlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoc2hhcGVQcmltaXRpdmVzW2ldLnR5cGUgPT09IHR5cGUgJiYgc2hhcGVQcmltaXRpdmVzW2ldLmRldmljZSA9PT0gZGV2aWNlKSB7XG4gICAgICAgICAgICBwcmltRGF0YSA9IHNoYXBlUHJpbWl0aXZlc1tpXS5wcmltRGF0YTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG5vdCBpbiBjYWNoZSwgY3JlYXRlIG5ld1xuICAgIGlmICghcHJpbURhdGEpIHtcblxuICAgICAgICBsZXQgbWVzaCwgYXJlYTtcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG5cbiAgICAgICAgICAgIGNhc2UgJ2JveCc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZUJveChkZXZpY2UsIHsgaGFsZkV4dGVudHM6IG5ldyBWZWMzKDAuNSwgMC41LCAwLjUpIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IDIsIHk6IDIsIHo6IDIsIHV2OiAoMi4wIC8gMykgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnY2Fwc3VsZSc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZUNhcHN1bGUoZGV2aWNlLCB7IHJhZGl1czogMC41LCBoZWlnaHQ6IDIgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogKE1hdGguUEkgKiAyKSwgeTogTWF0aC5QSSwgejogKE1hdGguUEkgKiAyKSwgdXY6ICgxLjAgLyAzICsgKCgxLjAgLyAzKSAvIDMpICogMikgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnY29uZSc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZUNvbmUoZGV2aWNlLCB7IGJhc2VSYWRpdXM6IDAuNSwgcGVha1JhZGl1czogMCwgaGVpZ2h0OiAxIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IDIuNTQsIHk6IDIuNTQsIHo6IDIuNTQsIHV2OiAoMS4wIC8gMyArICgxLjAgLyAzKSAvIDMpIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ2N5bGluZGVyJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQ3lsaW5kZXIoZGV2aWNlLCB7IHJhZGl1czogMC41LCBoZWlnaHQ6IDEgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogTWF0aC5QSSwgeTogKDAuNzkgKiAyKSwgejogTWF0aC5QSSwgdXY6ICgxLjAgLyAzICsgKCgxLjAgLyAzKSAvIDMpICogMikgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAncGxhbmUnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVQbGFuZShkZXZpY2UsIHsgaGFsZkV4dGVudHM6IG5ldyBWZWMyKDAuNSwgMC41KSwgd2lkdGhTZWdtZW50czogMSwgbGVuZ3RoU2VnbWVudHM6IDEgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogMCwgeTogMSwgejogMCwgdXY6IDEgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnc3BoZXJlJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlU3BoZXJlKGRldmljZSwgeyByYWRpdXM6IDAuNSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiBNYXRoLlBJLCB5OiBNYXRoLlBJLCB6OiBNYXRoLlBJLCB1djogMSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICd0b3J1cyc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZVRvcnVzKGRldmljZSwgeyB0dWJlUmFkaXVzOiAwLjIsIHJpbmdSYWRpdXM6IDAuMyB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiBNYXRoLlBJICogMC41ICogMC41IC0gTWF0aC5QSSAqIDAuMSAqIDAuMSwgeTogMC40LCB6OiAwLjQsIHV2OiAxIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHByaW1pdGl2ZSB0eXBlOiAnICsgdHlwZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbmMgcmVmZXJlbmNlIHRvIGtlZXAgcHJpbWl0aXZlIGFsaXZlXG4gICAgICAgIG1lc2guaW5jUmVmQ291bnQoKTtcblxuICAgICAgICBwcmltRGF0YSA9IHsgbWVzaDogbWVzaCwgYXJlYTogYXJlYSB9O1xuXG4gICAgICAgIC8vIGFkZCB0byBjYWNoZVxuICAgICAgICBzaGFwZVByaW1pdGl2ZXMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICAgICAgZGV2aWNlOiBkZXZpY2UsXG4gICAgICAgICAgICBwcmltRGF0YTogcHJpbURhdGFcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByaW1EYXRhO1xufVxuXG5leHBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzLCBjYWxjdWxhdGVUYW5nZW50cywgY3JlYXRlQm94LCBjcmVhdGVDYXBzdWxlLCBjcmVhdGVDb25lLCBjcmVhdGVDeWxpbmRlciwgY3JlYXRlTWVzaCwgY3JlYXRlUGxhbmUsIGNyZWF0ZVNwaGVyZSwgY3JlYXRlVG9ydXMsIGdldFNoYXBlUHJpbWl0aXZlIH07XG4iXSwibmFtZXMiOlsicHJpbWl0aXZlVXYxUGFkZGluZyIsInByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSIsInNoYXBlUHJpbWl0aXZlcyIsImNhbGN1bGF0ZU5vcm1hbHMiLCJwb3NpdGlvbnMiLCJpbmRpY2VzIiwidHJpYW5nbGVDb3VudCIsImxlbmd0aCIsInZlcnRleENvdW50IiwicDEiLCJWZWMzIiwicDIiLCJwMyIsInAxcDIiLCJwMXAzIiwiZmFjZU5vcm1hbCIsIm5vcm1hbHMiLCJpIiwiaTEiLCJpMiIsImkzIiwic2V0Iiwic3ViMiIsImNyb3NzIiwibm9ybWFsaXplIiwieCIsInkiLCJ6IiwibngiLCJueSIsIm56IiwiaW52TGVuIiwiTWF0aCIsInNxcnQiLCJjYWxjdWxhdGVUYW5nZW50cyIsInV2cyIsInYxIiwidjIiLCJ2MyIsIncxIiwiVmVjMiIsIncyIiwidzMiLCJzZGlyIiwidGRpciIsInRhbjEiLCJGbG9hdDMyQXJyYXkiLCJ0YW4yIiwidGFuZ2VudHMiLCJ4MSIsIngyIiwieTEiLCJ5MiIsInoxIiwiejIiLCJzMSIsInMyIiwidDEiLCJ0MiIsImFyZWEiLCJyIiwibiIsInRlbXAiLCJuZG90dCIsImRvdCIsImNvcHkiLCJtdWxTY2FsYXIiLCJjcmVhdGVNZXNoIiwiZGV2aWNlIiwib3B0cyIsIm1lc2giLCJNZXNoIiwic2V0UG9zaXRpb25zIiwic2V0Tm9ybWFscyIsInNldFZlcnRleFN0cmVhbSIsIlNFTUFOVElDX1RBTkdFTlQiLCJjb2xvcnMiLCJzZXRDb2xvcnMzMiIsInNldFV2cyIsInV2czEiLCJibGVuZEluZGljZXMiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJUWVBFX1VJTlQ4IiwiYmxlbmRXZWlnaHRzIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJzZXRJbmRpY2VzIiwidXBkYXRlIiwiY3JlYXRlVG9ydXMiLCJyYyIsInR1YmVSYWRpdXMiLCJ1bmRlZmluZWQiLCJydCIsInJpbmdSYWRpdXMiLCJzZWdtZW50cyIsInNpZGVzIiwiY2FsY1RhbmdlbnRzIiwiaiIsImNvcyIsIlBJIiwic2luIiwidSIsInYiLCJwdXNoIiwiZmlyc3QiLCJzZWNvbmQiLCJ0aGlyZCIsImZvdXJ0aCIsIm9wdGlvbnMiLCJfY3JlYXRlQ29uZURhdGEiLCJiYXNlUmFkaXVzIiwicGVha1JhZGl1cyIsImhlaWdodCIsImhlaWdodFNlZ21lbnRzIiwiY2FwU2VnbWVudHMiLCJyb3VuZGVkQ2FwcyIsInBvcyIsImJvdHRvbVRvVG9wIiwibm9ybSIsInRvcCIsImJvdHRvbSIsInRhbmdlbnQiLCJvZmZzZXQiLCJ0aGV0YSIsInNpblRoZXRhIiwiY29zVGhldGEiLCJsZXJwIiwiX3YiLCJsYXRpdHVkZUJhbmRzIiwiZmxvb3IiLCJsb25naXR1ZGVCYW5kcyIsImNhcE9mZnNldCIsImxhdCIsImxvbiIsInBoaSIsInNpblBoaSIsImNvc1BoaSIsImNyZWF0ZUN5bGluZGVyIiwiaGFzT3duUHJvcGVydHkiLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJyYWRpdXMiLCJjcmVhdGVDYXBzdWxlIiwiY3JlYXRlQ29uZSIsImNyZWF0ZVNwaGVyZSIsImNyZWF0ZVBsYW5lIiwiaGUiLCJoYWxmRXh0ZW50cyIsIndzIiwid2lkdGhTZWdtZW50cyIsImxzIiwibGVuZ3RoU2VnbWVudHMiLCJ2Y291bnRlciIsImNyZWF0ZUJveCIsImhzIiwiY29ybmVycyIsImZhY2VBeGVzIiwiZmFjZU5vcm1hbHMiLCJGUk9OVCIsIkJBQ0siLCJUT1AiLCJCT1RUT00iLCJSSUdIVCIsIkxFRlQiLCJnZW5lcmF0ZUZhY2UiLCJzaWRlIiwidVNlZ21lbnRzIiwidlNlZ21lbnRzIiwidGVtcDEiLCJ0ZW1wMiIsInRlbXAzIiwiYWRkMiIsImdldFNoYXBlUHJpbWl0aXZlIiwidHlwZSIsInByaW1EYXRhIiwidXYiLCJFcnJvciIsImluY1JlZkNvdW50Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQWFBLE1BQU1BLG1CQUFtQixHQUFHLEdBQUEsR0FBTSxFQUFsQyxDQUFBO0FBQ0EsTUFBTUMsd0JBQXdCLEdBQUcsR0FBTUQsR0FBQUEsbUJBQW1CLEdBQUcsQ0FBN0QsQ0FBQTtBQUdBLE1BQU1FLGVBQWUsR0FBRyxFQUF4QixDQUFBOztBQWNBLFNBQVNDLGdCQUFULENBQTBCQyxTQUExQixFQUFxQ0MsT0FBckMsRUFBOEM7QUFDMUMsRUFBQSxNQUFNQyxhQUFhLEdBQUdELE9BQU8sQ0FBQ0UsTUFBUixHQUFpQixDQUF2QyxDQUFBO0FBQ0EsRUFBQSxNQUFNQyxXQUFXLEdBQUtKLFNBQVMsQ0FBQ0csTUFBVixHQUFtQixDQUF6QyxDQUFBO0FBQ0EsRUFBQSxNQUFNRSxFQUFFLEdBQUcsSUFBSUMsSUFBSixFQUFYLENBQUE7QUFDQSxFQUFBLE1BQU1DLEVBQUUsR0FBRyxJQUFJRCxJQUFKLEVBQVgsQ0FBQTtBQUNBLEVBQUEsTUFBTUUsRUFBRSxHQUFHLElBQUlGLElBQUosRUFBWCxDQUFBO0FBQ0EsRUFBQSxNQUFNRyxJQUFJLEdBQUcsSUFBSUgsSUFBSixFQUFiLENBQUE7QUFDQSxFQUFBLE1BQU1JLElBQUksR0FBRyxJQUFJSixJQUFKLEVBQWIsQ0FBQTtBQUNBLEVBQUEsTUFBTUssVUFBVSxHQUFHLElBQUlMLElBQUosRUFBbkIsQ0FBQTtFQUVBLE1BQU1NLE9BQU8sR0FBRyxFQUFoQixDQUFBOztBQUdBLEVBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcs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
