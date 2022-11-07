/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Debug } from '../core/debug.js';
import { SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, TYPE_UINT8, SEMANTIC_BLENDWEIGHT } from '../platform/graphics/constants.js';
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
  const faceAxes = [[0, 1, 3],
  [4, 5, 7],
  [3, 2, 6],
  [1, 0, 4],
  [1, 4, 2],
  [5, 0, 6]];

  const faceNormals = [[0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0]];

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2VkdXJhbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3Byb2NlZHVyYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQge1xuICAgIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0JMRU5EV0VJR0hULCBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgVFlQRV9VSU5UOFxufSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi9tZXNoLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBHcmFwaGljc0RldmljZSAqL1xuXG5jb25zdCBwcmltaXRpdmVVdjFQYWRkaW5nID0gNC4wIC8gNjQ7XG5jb25zdCBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgPSAxLjAgLSBwcmltaXRpdmVVdjFQYWRkaW5nICogMjtcblxuLy8gY2FjaGVkIG1lc2ggcHJpbWl0aXZlc1xuY29uc3Qgc2hhcGVQcmltaXRpdmVzID0gW107XG5cbi8qKlxuICogR2VuZXJhdGVzIG5vcm1hbCBpbmZvcm1hdGlvbiBmcm9tIHRoZSBzcGVjaWZpZWQgcG9zaXRpb25zIGFuZCB0cmlhbmdsZSBpbmRpY2VzLiBTZWVcbiAqIHtAbGluayBjcmVhdGVNZXNofS5cbiAqXG4gKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBwb3NpdGlvbnMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBpbmRpY2VzIC0gQW4gYXJyYXkgb2YgdHJpYW5nbGUgaW5kaWNlcy5cbiAqIEByZXR1cm5zIHtudW1iZXJbXX0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggbm9ybWFscy5cbiAqIEBleGFtcGxlXG4gKiB2YXIgbm9ybWFscyA9IHBjLmNhbGN1bGF0ZU5vcm1hbHMocG9zaXRpb25zLCBpbmRpY2VzKTtcbiAqIHZhciB0YW5nZW50cyA9IHBjLmNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAqIHZhciBtZXNoID0gcGMuY3JlYXRlTWVzaChwb3NpdGlvbnMsIG5vcm1hbHMsIHRhbmdlbnRzLCB1dnMsIGluZGljZXMpO1xuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVOb3JtYWxzKHBvc2l0aW9ucywgaW5kaWNlcykge1xuICAgIGNvbnN0IHRyaWFuZ2xlQ291bnQgPSBpbmRpY2VzLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgdmVydGV4Q291bnQgICA9IHBvc2l0aW9ucy5sZW5ndGggLyAzO1xuICAgIGNvbnN0IHAxID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwMiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDMgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHAxcDIgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHAxcDMgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IGZhY2VOb3JtYWwgPSBuZXcgVmVjMygpO1xuXG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSB0aGUgbm9ybWFsIGFycmF5IHRvIHplcm9cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvc2l0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICBub3JtYWxzW2ldID0gMDtcbiAgICB9XG5cbiAgICAvLyBBY2N1bXVsYXRlIGZhY2Ugbm9ybWFscyBmb3IgZWFjaCB2ZXJ0ZXhcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaWFuZ2xlQ291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBpMSA9IGluZGljZXNbaSAqIDNdO1xuICAgICAgICBjb25zdCBpMiA9IGluZGljZXNbaSAqIDMgKyAxXTtcbiAgICAgICAgY29uc3QgaTMgPSBpbmRpY2VzW2kgKiAzICsgMl07XG5cbiAgICAgICAgcDEuc2V0KHBvc2l0aW9uc1tpMSAqIDNdLCBwb3NpdGlvbnNbaTEgKiAzICsgMV0sIHBvc2l0aW9uc1tpMSAqIDMgKyAyXSk7XG4gICAgICAgIHAyLnNldChwb3NpdGlvbnNbaTIgKiAzXSwgcG9zaXRpb25zW2kyICogMyArIDFdLCBwb3NpdGlvbnNbaTIgKiAzICsgMl0pO1xuICAgICAgICBwMy5zZXQocG9zaXRpb25zW2kzICogM10sIHBvc2l0aW9uc1tpMyAqIDMgKyAxXSwgcG9zaXRpb25zW2kzICogMyArIDJdKTtcblxuICAgICAgICBwMXAyLnN1YjIocDIsIHAxKTtcbiAgICAgICAgcDFwMy5zdWIyKHAzLCBwMSk7XG4gICAgICAgIGZhY2VOb3JtYWwuY3Jvc3MocDFwMiwgcDFwMykubm9ybWFsaXplKCk7XG5cbiAgICAgICAgbm9ybWFsc1tpMSAqIDNdICAgICArPSBmYWNlTm9ybWFsLng7XG4gICAgICAgIG5vcm1hbHNbaTEgKiAzICsgMV0gKz0gZmFjZU5vcm1hbC55O1xuICAgICAgICBub3JtYWxzW2kxICogMyArIDJdICs9IGZhY2VOb3JtYWwuejtcbiAgICAgICAgbm9ybWFsc1tpMiAqIDNdICAgICArPSBmYWNlTm9ybWFsLng7XG4gICAgICAgIG5vcm1hbHNbaTIgKiAzICsgMV0gKz0gZmFjZU5vcm1hbC55O1xuICAgICAgICBub3JtYWxzW2kyICogMyArIDJdICs9IGZhY2VOb3JtYWwuejtcbiAgICAgICAgbm9ybWFsc1tpMyAqIDNdICAgICArPSBmYWNlTm9ybWFsLng7XG4gICAgICAgIG5vcm1hbHNbaTMgKiAzICsgMV0gKz0gZmFjZU5vcm1hbC55O1xuICAgICAgICBub3JtYWxzW2kzICogMyArIDJdICs9IGZhY2VOb3JtYWwuejtcbiAgICB9XG5cbiAgICAvLyBOb3JtYWxpemUgYWxsIG5vcm1hbHNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleENvdW50OyBpKyspIHtcbiAgICAgICAgY29uc3QgbnggPSBub3JtYWxzW2kgKiAzXTtcbiAgICAgICAgY29uc3QgbnkgPSBub3JtYWxzW2kgKiAzICsgMV07XG4gICAgICAgIGNvbnN0IG56ID0gbm9ybWFsc1tpICogMyArIDJdO1xuICAgICAgICBjb25zdCBpbnZMZW4gPSAxIC8gTWF0aC5zcXJ0KG54ICogbnggKyBueSAqIG55ICsgbnogKiBueik7XG4gICAgICAgIG5vcm1hbHNbaSAqIDNdICo9IGludkxlbjtcbiAgICAgICAgbm9ybWFsc1tpICogMyArIDFdICo9IGludkxlbjtcbiAgICAgICAgbm9ybWFsc1tpICogMyArIDJdICo9IGludkxlbjtcbiAgICB9XG5cbiAgICByZXR1cm4gbm9ybWFscztcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgdGFuZ2VudCBpbmZvcm1hdGlvbiBmcm9tIHRoZSBzcGVjaWZpZWQgcG9zaXRpb25zLCBub3JtYWxzLCB0ZXh0dXJlIGNvb3JkaW5hdGVzIGFuZFxuICogdHJpYW5nbGUgaW5kaWNlcy4gU2VlIHtAbGluayBjcmVhdGVNZXNofS5cbiAqXG4gKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBwb3NpdGlvbnMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBub3JtYWxzIC0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggbm9ybWFscy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IHV2cyAtIEFuIGFycmF5IG9mIDItZGltZW5zaW9uYWwgdmVydGV4IHRleHR1cmUgY29vcmRpbmF0ZXMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBpbmRpY2VzIC0gQW4gYXJyYXkgb2YgdHJpYW5nbGUgaW5kaWNlcy5cbiAqIEByZXR1cm5zIHtudW1iZXJbXX0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggdGFuZ2VudHMuXG4gKiBAZXhhbXBsZVxuICogdmFyIHRhbmdlbnRzID0gcGMuY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICogdmFyIG1lc2ggPSBwYy5jcmVhdGVNZXNoKHBvc2l0aW9ucywgbm9ybWFscywgdGFuZ2VudHMsIHV2cywgaW5kaWNlcyk7XG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKSB7XG4gICAgLy8gTGVuZ3llbCdzIE1ldGhvZFxuICAgIC8vIGh0dHA6Ly93ZWIuYXJjaGl2ZS5vcmcvd2ViLzIwMTgwNjIwMDI0NDM5L2h0dHA6Ly93d3cudGVyYXRob24uY29tL2NvZGUvdGFuZ2VudC5odG1sXG4gICAgY29uc3QgdHJpYW5nbGVDb3VudCA9IGluZGljZXMubGVuZ3RoIC8gMztcbiAgICBjb25zdCB2ZXJ0ZXhDb3VudCAgID0gcG9zaXRpb25zLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgdjEgICA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdjIgICA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdjMgICA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdzEgICA9IG5ldyBWZWMyKCk7XG4gICAgY29uc3QgdzIgICA9IG5ldyBWZWMyKCk7XG4gICAgY29uc3QgdzMgICA9IG5ldyBWZWMyKCk7XG4gICAgY29uc3Qgc2RpciA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdGRpciA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdGFuMSA9IG5ldyBGbG9hdDMyQXJyYXkodmVydGV4Q291bnQgKiAzKTtcbiAgICBjb25zdCB0YW4yID0gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0ZXhDb3VudCAqIDMpO1xuXG4gICAgY29uc3QgdGFuZ2VudHMgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVDb3VudDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGkxID0gaW5kaWNlc1tpICogM107XG4gICAgICAgIGNvbnN0IGkyID0gaW5kaWNlc1tpICogMyArIDFdO1xuICAgICAgICBjb25zdCBpMyA9IGluZGljZXNbaSAqIDMgKyAyXTtcblxuICAgICAgICB2MS5zZXQocG9zaXRpb25zW2kxICogM10sIHBvc2l0aW9uc1tpMSAqIDMgKyAxXSwgcG9zaXRpb25zW2kxICogMyArIDJdKTtcbiAgICAgICAgdjIuc2V0KHBvc2l0aW9uc1tpMiAqIDNdLCBwb3NpdGlvbnNbaTIgKiAzICsgMV0sIHBvc2l0aW9uc1tpMiAqIDMgKyAyXSk7XG4gICAgICAgIHYzLnNldChwb3NpdGlvbnNbaTMgKiAzXSwgcG9zaXRpb25zW2kzICogMyArIDFdLCBwb3NpdGlvbnNbaTMgKiAzICsgMl0pO1xuXG4gICAgICAgIHcxLnNldCh1dnNbaTEgKiAyXSwgdXZzW2kxICogMiArIDFdKTtcbiAgICAgICAgdzIuc2V0KHV2c1tpMiAqIDJdLCB1dnNbaTIgKiAyICsgMV0pO1xuICAgICAgICB3My5zZXQodXZzW2kzICogMl0sIHV2c1tpMyAqIDIgKyAxXSk7XG5cbiAgICAgICAgY29uc3QgeDEgPSB2Mi54IC0gdjEueDtcbiAgICAgICAgY29uc3QgeDIgPSB2My54IC0gdjEueDtcbiAgICAgICAgY29uc3QgeTEgPSB2Mi55IC0gdjEueTtcbiAgICAgICAgY29uc3QgeTIgPSB2My55IC0gdjEueTtcbiAgICAgICAgY29uc3QgejEgPSB2Mi56IC0gdjEuejtcbiAgICAgICAgY29uc3QgejIgPSB2My56IC0gdjEuejtcblxuICAgICAgICBjb25zdCBzMSA9IHcyLnggLSB3MS54O1xuICAgICAgICBjb25zdCBzMiA9IHczLnggLSB3MS54O1xuICAgICAgICBjb25zdCB0MSA9IHcyLnkgLSB3MS55O1xuICAgICAgICBjb25zdCB0MiA9IHczLnkgLSB3MS55O1xuXG4gICAgICAgIGNvbnN0IGFyZWEgPSBzMSAqIHQyIC0gczIgKiB0MTtcblxuICAgICAgICAvLyBBcmVhIGNhbiBiZSAwIGZvciBkZWdlbmVyYXRlIHRyaWFuZ2xlcyBvciBiYWQgdXYgY29vcmRpbmF0ZXNcbiAgICAgICAgaWYgKGFyZWEgPT09IDApIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGRlZmF1bHQgdmFsdWVzXG4gICAgICAgICAgICBzZGlyLnNldCgwLCAxLCAwKTtcbiAgICAgICAgICAgIHRkaXIuc2V0KDEsIDAsIDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgciA9IDEgLyBhcmVhO1xuICAgICAgICAgICAgc2Rpci5zZXQoKHQyICogeDEgLSB0MSAqIHgyKSAqIHIsXG4gICAgICAgICAgICAgICAgICAgICAodDIgKiB5MSAtIHQxICogeTIpICogcixcbiAgICAgICAgICAgICAgICAgICAgICh0MiAqIHoxIC0gdDEgKiB6MikgKiByKTtcbiAgICAgICAgICAgIHRkaXIuc2V0KChzMSAqIHgyIC0gczIgKiB4MSkgKiByLFxuICAgICAgICAgICAgICAgICAgICAgKHMxICogeTIgLSBzMiAqIHkxKSAqIHIsXG4gICAgICAgICAgICAgICAgICAgICAoczEgKiB6MiAtIHMyICogejEpICogcik7XG4gICAgICAgIH1cblxuICAgICAgICB0YW4xW2kxICogMyArIDBdICs9IHNkaXIueDtcbiAgICAgICAgdGFuMVtpMSAqIDMgKyAxXSArPSBzZGlyLnk7XG4gICAgICAgIHRhbjFbaTEgKiAzICsgMl0gKz0gc2Rpci56O1xuICAgICAgICB0YW4xW2kyICogMyArIDBdICs9IHNkaXIueDtcbiAgICAgICAgdGFuMVtpMiAqIDMgKyAxXSArPSBzZGlyLnk7XG4gICAgICAgIHRhbjFbaTIgKiAzICsgMl0gKz0gc2Rpci56O1xuICAgICAgICB0YW4xW2kzICogMyArIDBdICs9IHNkaXIueDtcbiAgICAgICAgdGFuMVtpMyAqIDMgKyAxXSArPSBzZGlyLnk7XG4gICAgICAgIHRhbjFbaTMgKiAzICsgMl0gKz0gc2Rpci56O1xuXG4gICAgICAgIHRhbjJbaTEgKiAzICsgMF0gKz0gdGRpci54O1xuICAgICAgICB0YW4yW2kxICogMyArIDFdICs9IHRkaXIueTtcbiAgICAgICAgdGFuMltpMSAqIDMgKyAyXSArPSB0ZGlyLno7XG4gICAgICAgIHRhbjJbaTIgKiAzICsgMF0gKz0gdGRpci54O1xuICAgICAgICB0YW4yW2kyICogMyArIDFdICs9IHRkaXIueTtcbiAgICAgICAgdGFuMltpMiAqIDMgKyAyXSArPSB0ZGlyLno7XG4gICAgICAgIHRhbjJbaTMgKiAzICsgMF0gKz0gdGRpci54O1xuICAgICAgICB0YW4yW2kzICogMyArIDFdICs9IHRkaXIueTtcbiAgICAgICAgdGFuMltpMyAqIDMgKyAyXSArPSB0ZGlyLno7XG4gICAgfVxuXG4gICAgY29uc3QgdDEgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHQyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBuID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0ZW1wID0gbmV3IFZlYzMoKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICBuLnNldChub3JtYWxzW2kgKiAzXSwgbm9ybWFsc1tpICogMyArIDFdLCBub3JtYWxzW2kgKiAzICsgMl0pO1xuICAgICAgICB0MS5zZXQodGFuMVtpICogM10sIHRhbjFbaSAqIDMgKyAxXSwgdGFuMVtpICogMyArIDJdKTtcbiAgICAgICAgdDIuc2V0KHRhbjJbaSAqIDNdLCB0YW4yW2kgKiAzICsgMV0sIHRhbjJbaSAqIDMgKyAyXSk7XG5cbiAgICAgICAgLy8gR3JhbS1TY2htaWR0IG9ydGhvZ29uYWxpemVcbiAgICAgICAgY29uc3QgbmRvdHQgPSBuLmRvdCh0MSk7XG4gICAgICAgIHRlbXAuY29weShuKS5tdWxTY2FsYXIobmRvdHQpO1xuICAgICAgICB0ZW1wLnN1YjIodDEsIHRlbXApLm5vcm1hbGl6ZSgpO1xuXG4gICAgICAgIHRhbmdlbnRzW2kgKiA0XSAgICAgPSB0ZW1wLng7XG4gICAgICAgIHRhbmdlbnRzW2kgKiA0ICsgMV0gPSB0ZW1wLnk7XG4gICAgICAgIHRhbmdlbnRzW2kgKiA0ICsgMl0gPSB0ZW1wLno7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGhhbmRlZG5lc3NcbiAgICAgICAgdGVtcC5jcm9zcyhuLCB0MSk7XG4gICAgICAgIHRhbmdlbnRzW2kgKiA0ICsgM10gPSAodGVtcC5kb3QodDIpIDwgMC4wKSA/IC0xLjAgOiAxLjA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhbmdlbnRzO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgbWVzaCBvYmplY3QgZnJvbSB0aGUgc3VwcGxpZWQgdmVydGV4IGluZm9ybWF0aW9uIGFuZCB0b3BvbG9neS5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtudW1iZXJbXX0gcG9zaXRpb25zIC0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggcG9zaXRpb25zLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMubm9ybWFsc10gLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBub3JtYWxzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMudGFuZ2VudHNdIC0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggdGFuZ2VudHMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5jb2xvcnNdIC0gQW4gYXJyYXkgb2YgNC1kaW1lbnNpb25hbCB2ZXJ0ZXggY29sb3JzIHdoZXJlIGVhY2ggY29tcG9uZW50XG4gKiBpcyBhbiBpbnRlZ2VyIGluIHRoZSByYW5nZSAwIHRvIDI1NS5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLnV2c10gLSBBbiBhcnJheSBvZiAyLWRpbWVuc2lvbmFsIHZlcnRleCB0ZXh0dXJlIGNvb3JkaW5hdGVzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMudXZzMV0gLSBTYW1lIGFzIG9wdHMudXZzLCBidXQgZm9yIGFkZGl0aW9uYWwgVVYgc2V0XG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5ibGVuZEluZGljZXNdIC0gQW4gYXJyYXkgb2YgNC1kaW1lbnNpb25hbCBib25lIGluZGljZXMgd2hlcmUgZWFjaFxuICogY29tcG9uZW50IGlzIGFuIGludGVnZXIgaW4gdGhlIHJhbmdlIDAgdG8gMjU1LlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMuYmxlbmRXZWlnaHRzXSAtIEFuIGFycmF5IG9mIDQtZGltZW5zaW9uYWwgYm9uZSB3ZWlnaHRzIHdoZXJlIGVhY2hcbiAqIGNvbXBvbmVudCBpcyBpbiB0aGUgcmFuZ2UgMCB0byAxIGFuZCB0aGUgc3VtIG9mIHRoZSB3ZWlnaHRzIHNob3VsZCBlcXVhbCAxLlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMuaW5kaWNlc10gLSBBbiBhcnJheSBvZiB0cmlhbmdsZSBpbmRpY2VzLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IE1lc2ggY29uc3RydWN0ZWQgZnJvbSB0aGUgc3VwcGxpZWQgdmVydGV4IGFuZCB0cmlhbmdsZSBkYXRhLlxuICogQGV4YW1wbGVcbiAqIC8vIENyZWF0ZSBhIHNpbXBsZSwgaW5kZXhlZCB0cmlhbmdsZSAod2l0aCB0ZXh0dXJlIGNvb3JkaW5hdGVzIGFuZCB2ZXJ0ZXggbm9ybWFscylcbiAqIHZhciBtZXNoID0gcGMuY3JlYXRlTWVzaChncmFwaGljc0RldmljZSwgWzAsIDAsIDAsIDEsIDAsIDAsIDAsIDEsIDBdLCB7XG4gKiAgICAgbm9ybWFsczogWzAsIDAsIDEsIDAsIDAsIDEsIDAsIDAsIDFdLFxuICogICAgIHV2czogWzAsIDAsIDEsIDAsIDAsIDFdLFxuICogICAgIGluZGljZXM6IFswLCAxLCAyXVxuICogfSk7XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU1lc2goZGV2aWNlLCBwb3NpdGlvbnMsIG9wdHMpIHtcblxuICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgIG1lc2guc2V0UG9zaXRpb25zKHBvc2l0aW9ucyk7XG5cbiAgICBpZiAob3B0cykge1xuICAgICAgICBpZiAob3B0cy5ub3JtYWxzKSB7XG4gICAgICAgICAgICBtZXNoLnNldE5vcm1hbHMob3B0cy5ub3JtYWxzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLnRhbmdlbnRzKSB7XG4gICAgICAgICAgICBtZXNoLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19UQU5HRU5ULCBvcHRzLnRhbmdlbnRzLCA0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmNvbG9ycykge1xuICAgICAgICAgICAgbWVzaC5zZXRDb2xvcnMzMihvcHRzLmNvbG9ycyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy51dnMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0VXZzKDAsIG9wdHMudXZzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLnV2czEpIHtcbiAgICAgICAgICAgIG1lc2guc2V0VXZzKDEsIG9wdHMudXZzMSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5ibGVuZEluZGljZXMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX0JMRU5ESU5ESUNFUywgb3B0cy5ibGVuZEluZGljZXMsIDQsIG9wdHMuYmxlbmRJbmRpY2VzLmxlbmd0aCAvIDQsIFRZUEVfVUlOVDgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuYmxlbmRXZWlnaHRzKSB7XG4gICAgICAgICAgICBtZXNoLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19CTEVORFdFSUdIVCwgb3B0cy5ibGVuZFdlaWdodHMsIDQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuaW5kaWNlcykge1xuICAgICAgICAgICAgbWVzaC5zZXRJbmRpY2VzKG9wdHMuaW5kaWNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtZXNoLnVwZGF0ZSgpO1xuICAgIHJldHVybiBtZXNoO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIHRvcnVzLXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplLCBzaGFwZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgdG9ydXMgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uXG4gKiBwYXJhbWV0ZXJzLiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSB0b3J1cyBpbiB0aGUgWFotcGxhbmUgd2l0aCBhIHR1YmUgcmFkaXVzIG9mXG4gKiAwLjIsIGEgcmluZyByYWRpdXMgb2YgMC4zLCAyMCBzZWdtZW50cyBhbmQgMzAgc2lkZXMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSB0b3J1cyBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIHRvcnVzJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnR1YmVSYWRpdXNdIC0gVGhlIHJhZGl1cyBvZiB0aGUgdHViZSBmb3JtaW5nIHRoZSBib2R5IG9mIHRoZSB0b3J1c1xuICogKGRlZmF1bHRzIHRvIDAuMikuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMucmluZ1JhZGl1c10gLSBUaGUgcmFkaXVzIGZyb20gdGhlIGNlbnRyZSBvZiB0aGUgdG9ydXMgdG8gdGhlIGNlbnRyZSBvZiB0aGVcbiAqIHR1YmUgKGRlZmF1bHRzIHRvIDAuMykuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuc2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiByYWRpYWwgZGl2aXNpb25zIGZvcm1pbmcgY3Jvc3Mtc2VjdGlvbnMgb2YgdGhlXG4gKiB0b3J1cyByaW5nIChkZWZhdWx0cyB0byAyMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuc2lkZXNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYXJvdW5kIHRoZSB0dWJ1bGFyIGJvZHkgb2YgdGhlIHRvcnVzIHJpbmdcbiAqIChkZWZhdWx0cyB0byAzMCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyB0b3J1cy1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlVG9ydXMoZGV2aWNlLCBvcHRzKSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCByYyA9IG9wdHMgJiYgb3B0cy50dWJlUmFkaXVzICE9PSB1bmRlZmluZWQgPyBvcHRzLnR1YmVSYWRpdXMgOiAwLjI7XG4gICAgY29uc3QgcnQgPSBvcHRzICYmIG9wdHMucmluZ1JhZGl1cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5yaW5nUmFkaXVzIDogMC4zO1xuICAgIGNvbnN0IHNlZ21lbnRzID0gb3B0cyAmJiBvcHRzLnNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLnNlZ21lbnRzIDogMzA7XG4gICAgY29uc3Qgc2lkZXMgPSBvcHRzICYmIG9wdHMuc2lkZXMgIT09IHVuZGVmaW5lZCA/IG9wdHMuc2lkZXMgOiAyMDtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzICYmIG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgOiBmYWxzZTtcblxuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCBpbmRpY2VzID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBzaWRlczsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IHNlZ21lbnRzOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSBNYXRoLmNvcygyICogTWF0aC5QSSAqIGogLyBzZWdtZW50cykgKiAocnQgKyByYyAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKSk7XG4gICAgICAgICAgICBjb25zdCB5ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpICogcmM7XG4gICAgICAgICAgICBjb25zdCB6ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBqIC8gc2VnbWVudHMpICogKHJ0ICsgcmMgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcykpO1xuXG4gICAgICAgICAgICBjb25zdCBueCA9IE1hdGguY29zKDIgKiBNYXRoLlBJICogaiAvIHNlZ21lbnRzKSAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKTtcbiAgICAgICAgICAgIGNvbnN0IG55ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpO1xuICAgICAgICAgICAgY29uc3QgbnogPSBNYXRoLnNpbigyICogTWF0aC5QSSAqIGogLyBzZWdtZW50cykgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcyk7XG5cbiAgICAgICAgICAgIGNvbnN0IHUgPSBpIC8gc2lkZXM7XG4gICAgICAgICAgICBjb25zdCB2ID0gMSAtIGogLyBzZWdtZW50cztcblxuICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICBub3JtYWxzLnB1c2gobngsIG55LCBueik7XG4gICAgICAgICAgICB1dnMucHVzaCh1LCAxLjAgLSB2KTtcblxuICAgICAgICAgICAgaWYgKChpIDwgc2lkZXMpICYmIChqIDwgc2VnbWVudHMpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3QgID0gKChpKSkgICAgICogKHNlZ21lbnRzICsgMSkgKyAoKGopKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgPSAoKGkgKyAxKSkgKiAoc2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRoaXJkICA9ICgoaSkpICAgICAqIChzZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvdXJ0aCA9ICgoaSArIDEpKSAqIChzZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0LCBzZWNvbmQsIHRoaXJkKTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goc2Vjb25kLCBmb3VydGgsIHRoaXJkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMsXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gX2NyZWF0ZUNvbmVEYXRhKGJhc2VSYWRpdXMsIHBlYWtSYWRpdXMsIGhlaWdodCwgaGVpZ2h0U2VnbWVudHMsIGNhcFNlZ21lbnRzLCByb3VuZGVkQ2Fwcykge1xuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvcyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgYm90dG9tVG9Ub3AgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IG5vcm0gPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRvcCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgYm90dG9tID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0YW5nZW50ID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgdXZzMSA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcbiAgICBsZXQgb2Zmc2V0O1xuXG4gICAgLy8gRGVmaW5lIHRoZSBib2R5IG9mIHRoZSBjb25lL2N5bGluZGVyXG4gICAgaWYgKGhlaWdodCA+IDApIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gaGVpZ2h0U2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPD0gY2FwU2VnbWVudHM7IGorKykge1xuICAgICAgICAgICAgICAgIC8vIFN3ZWVwIHRoZSBjb25lIGJvZHkgZnJvbSB0aGUgcG9zaXRpdmUgWSBheGlzIHRvIG1hdGNoIGEgM0RTIE1heCBjb25lL2N5bGluZGVyXG4gICAgICAgICAgICAgICAgY29uc3QgdGhldGEgPSAoaiAvIGNhcFNlZ21lbnRzKSAqIDIgKiBNYXRoLlBJIC0gTWF0aC5QSTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguY29zKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBib3R0b20uc2V0KHNpblRoZXRhICogYmFzZVJhZGl1cywgLWhlaWdodCAvIDIsIGNvc1RoZXRhICogYmFzZVJhZGl1cyk7XG4gICAgICAgICAgICAgICAgdG9wLnNldChzaW5UaGV0YSAqIHBlYWtSYWRpdXMsIGhlaWdodCAvIDIsIGNvc1RoZXRhICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgcG9zLmxlcnAoYm90dG9tLCB0b3AsIGkgLyBoZWlnaHRTZWdtZW50cyk7XG4gICAgICAgICAgICAgICAgYm90dG9tVG9Ub3Auc3ViMih0b3AsIGJvdHRvbSkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICAgICAgdGFuZ2VudC5zZXQoY29zVGhldGEsIDAsIC1zaW5UaGV0YSk7XG4gICAgICAgICAgICAgICAgbm9ybS5jcm9zcyh0YW5nZW50LCBib3R0b21Ub1RvcCkubm9ybWFsaXplKCk7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaChwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2gobm9ybS54LCBub3JtLnksIG5vcm0ueik7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSBqIC8gY2FwU2VnbWVudHM7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSBpIC8gaGVpZ2h0U2VnbWVudHM7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gMXN0IHRoaXJkXG4gICAgICAgICAgICAgICAgY29uc3QgX3YgPSB2O1xuICAgICAgICAgICAgICAgIHYgPSB1O1xuICAgICAgICAgICAgICAgIHUgPSBfdjtcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKChpIDwgaGVpZ2h0U2VnbWVudHMpICYmIChqIDwgY2FwU2VnbWVudHMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICAgPSAoKGkpKSAgICAgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgID0gKChpKSkgICAgICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRoaXJkICAgPSAoKGkgKyAxKSkgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3VydGggID0gKChpICsgMSkpICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0LCBzZWNvbmQsIHRoaXJkKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHNlY29uZCwgZm91cnRoLCB0aGlyZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJvdW5kZWRDYXBzKSB7XG4gICAgICAgIGNvbnN0IGxhdGl0dWRlQmFuZHMgPSBNYXRoLmZsb29yKGNhcFNlZ21lbnRzIC8gMik7XG4gICAgICAgIGNvbnN0IGxvbmdpdHVkZUJhbmRzID0gY2FwU2VnbWVudHM7XG4gICAgICAgIGNvbnN0IGNhcE9mZnNldCA9IGhlaWdodCAvIDI7XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgdG9wIGNhcFxuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPD0gbGF0aXR1ZGVCYW5kczsgbGF0KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGxhdCAqIE1hdGguUEkgKiAwLjUpIC8gbGF0aXR1ZGVCYW5kcztcbiAgICAgICAgICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgY29uc3QgY29zVGhldGEgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8PSBsb25naXR1ZGVCYW5kczsgbG9uKyspIHtcbiAgICAgICAgICAgICAgICAvLyBTd2VlcCB0aGUgc3BoZXJlIGZyb20gdGhlIHBvc2l0aXZlIFogYXhpcyB0byBtYXRjaCBhIDNEUyBNYXggc3BoZXJlXG4gICAgICAgICAgICAgICAgY29uc3QgcGhpID0gbG9uICogMiAqIE1hdGguUEkgLyBsb25naXR1ZGVCYW5kcyAtIE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpblBoaSA9IE1hdGguc2luKHBoaSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29zUGhpID0gTWF0aC5jb3MocGhpKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHggPSBjb3NQaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gY29zVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IHNpblBoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gMSAtIGxvbiAvIGxvbmdpdHVkZUJhbmRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gMSAtIGxhdCAvIGxhdGl0dWRlQmFuZHM7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4ICogcGVha1JhZGl1cywgeSAqIHBlYWtSYWRpdXMgKyBjYXBPZmZzZXQsIHogKiBwZWFrUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gMm5kIHRoaXJkXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuICAgICAgICAgICAgICAgIHUgKz0gMS4wIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb2Zmc2V0ID0gKGhlaWdodFNlZ21lbnRzICsgMSkgKiAoY2FwU2VnbWVudHMgKyAxKTtcbiAgICAgICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDwgbGF0aXR1ZGVCYW5kczsgKytsYXQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8IGxvbmdpdHVkZUJhbmRzOyArK2xvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICA9IChsYXQgKiAobG9uZ2l0dWRlQmFuZHMgKyAxKSkgKyBsb247XG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gZmlyc3QgKyBsb25naXR1ZGVCYW5kcyArIDE7XG5cbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQsIG9mZnNldCArIGZpcnN0KTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQgKyAxLCBvZmZzZXQgKyBzZWNvbmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgYm90dG9tIGNhcFxuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPD0gbGF0aXR1ZGVCYW5kczsgbGF0KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gTWF0aC5QSSAqIDAuNSArIChsYXQgKiBNYXRoLlBJICogMC41KSAvIGxhdGl0dWRlQmFuZHM7XG4gICAgICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5jb3ModGhldGEpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPD0gbG9uZ2l0dWRlQmFuZHM7IGxvbisrKSB7XG4gICAgICAgICAgICAgICAgLy8gU3dlZXAgdGhlIHNwaGVyZSBmcm9tIHRoZSBwb3NpdGl2ZSBaIGF4aXMgdG8gbWF0Y2ggYSAzRFMgTWF4IHNwaGVyZVxuICAgICAgICAgICAgICAgIGNvbnN0IHBoaSA9IGxvbiAqIDIgKiBNYXRoLlBJIC8gbG9uZ2l0dWRlQmFuZHMgLSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgICAgICBjb25zdCBzaW5QaGkgPSBNYXRoLnNpbihwaGkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvc1BoaSA9IE1hdGguY29zKHBoaSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gY29zUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IGNvc1RoZXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBzaW5QaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSBsb24gLyBsb25naXR1ZGVCYW5kcztcbiAgICAgICAgICAgICAgICBsZXQgdiA9IDEgLSBsYXQgLyBsYXRpdHVkZUJhbmRzO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIHBlYWtSYWRpdXMsIHkgKiBwZWFrUmFkaXVzIC0gY2FwT2Zmc2V0LCB6ICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDNyZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDIuMCAvIDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9mZnNldCA9IChoZWlnaHRTZWdtZW50cyArIDEpICogKGNhcFNlZ21lbnRzICsgMSkgKyAobG9uZ2l0dWRlQmFuZHMgKyAxKSAqIChsYXRpdHVkZUJhbmRzICsgMSk7XG4gICAgICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8IGxhdGl0dWRlQmFuZHM7ICsrbGF0KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPCBsb25naXR1ZGVCYW5kczsgKytsb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXJzdCAgPSAobGF0ICogKGxvbmdpdHVkZUJhbmRzICsgMSkpICsgbG9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9IGZpcnN0ICsgbG9uZ2l0dWRlQmFuZHMgKyAxO1xuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kLCBvZmZzZXQgKyBmaXJzdCk7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kICsgMSwgb2Zmc2V0ICsgc2Vjb25kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEdlbmVyYXRlIGJvdHRvbSBjYXBcbiAgICAgICAgb2Zmc2V0ID0gKGhlaWdodFNlZ21lbnRzICsgMSkgKiAoY2FwU2VnbWVudHMgKyAxKTtcbiAgICAgICAgaWYgKGJhc2VSYWRpdXMgPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcFNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0aGV0YSA9IChpIC8gY2FwU2VnbWVudHMpICogMiAqIE1hdGguUEk7XG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gLWhlaWdodCAvIDI7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IE1hdGguY29zKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSAoeCArIDEpIC8gMjtcbiAgICAgICAgICAgICAgICBsZXQgdiA9ICh6ICsgMSkgLyAyO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIGJhc2VSYWRpdXMsIHksIHogKiBiYXNlUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goMCwgLTEsIDApO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDJuZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDEgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCwgb2Zmc2V0ICsgaSwgb2Zmc2V0ICsgaSAtIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIHRvcCBjYXBcbiAgICAgICAgb2Zmc2V0ICs9IGNhcFNlZ21lbnRzO1xuICAgICAgICBpZiAocGVha1JhZGl1cyA+IDApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FwU2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGkgLyBjYXBTZWdtZW50cykgKiAyICogTWF0aC5QSTtcbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSBoZWlnaHQgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBNYXRoLmNvcyh0aGV0YSk7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSAxIC0gKHggKyAxKSAvIDI7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSAoeiArIDEpIC8gMjtcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiBwZWFrUmFkaXVzLCB5LCB6ICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKDAsIDEsIDApO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDNyZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDIgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCwgb2Zmc2V0ICsgaSAtIDEsIG9mZnNldCArIGkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHBvc2l0aW9uczogcG9zaXRpb25zLFxuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzMSxcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgY3lsaW5kZXItc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjeWxpbmRlciBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb25cbiAqIHBhcmFtZXRlcnMuIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIGN5bGluZGVyIHN0YW5kaW5nIHZlcnRpY2FsbHkgY2VudGVyZWQgb24gdGhlXG4gKiBYWi1wbGFuZSB3aXRoIGEgcmFkaXVzIG9mIDAuNSwgYSBoZWlnaHQgb2YgMS4wLCAxIGhlaWdodCBzZWdtZW50IGFuZCAyMCBjYXAgc2VnbWVudHMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBjeWxpbmRlciBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGN5bGluZGVyJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSB0dWJlIGZvcm1pbmcgdGhlIGJvZHkgb2YgdGhlIGN5bGluZGVyIChkZWZhdWx0cyB0byAwLjUpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodF0gLSBUaGUgbGVuZ3RoIG9mIHRoZSBib2R5IG9mIHRoZSBjeWxpbmRlciAoZGVmYXVsdHMgdG8gMS4wKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgbGVuZ3RoIG9mIHRoZSBjeWxpbmRlciAoZGVmYXVsdHMgdG8gNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuY2FwU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYXJvdW5kIHRoZSB0dWJ1bGFyIGJvZHkgb2YgdGhlIGN5bGluZGVyIChkZWZhdWx0cyB0byAyMCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBjeWxpbmRlci1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ3lsaW5kZXIoZGV2aWNlLCBvcHRzKSB7XG4gICAgLy8gI2lmIF9ERUJVR1xuICAgIGlmIChvcHRzICYmIG9wdHMuaGFzT3duUHJvcGVydHkoJ2Jhc2VSYWRpdXMnKSAmJiAhb3B0cy5oYXNPd25Qcm9wZXJ0eSgncmFkaXVzJykpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgnXCJiYXNlUmFkaXVzXCIgaW4gYXJndW1lbnRzLCB1c2UgXCJyYWRpdXNcIiBpbnN0ZWFkJyk7XG4gICAgfVxuICAgIC8vICNlbmRpZlxuXG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBsZXQgcmFkaXVzID0gb3B0cyAmJiAob3B0cy5yYWRpdXMgfHwgb3B0cy5iYXNlUmFkaXVzKTtcbiAgICByYWRpdXMgPSByYWRpdXMgIT09IHVuZGVmaW5lZCA/IHJhZGl1cyA6IDAuNTtcbiAgICBjb25zdCBoZWlnaHQgPSBvcHRzICYmIG9wdHMuaGVpZ2h0ICE9PSB1bmRlZmluZWQgPyBvcHRzLmhlaWdodCA6IDEuMDtcbiAgICBjb25zdCBoZWlnaHRTZWdtZW50cyA9IG9wdHMgJiYgb3B0cy5oZWlnaHRTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5oZWlnaHRTZWdtZW50cyA6IDU7XG4gICAgY29uc3QgY2FwU2VnbWVudHMgPSBvcHRzICYmIG9wdHMuY2FwU2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FwU2VnbWVudHMgOiAyMDtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzICYmIG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgOiBmYWxzZTtcblxuICAgIC8vIENyZWF0ZSB2ZXJ0ZXggZGF0YSBmb3IgYSBjb25lIHRoYXQgaGFzIGEgYmFzZSBhbmQgcGVhayByYWRpdXMgdGhhdCBpcyB0aGUgc2FtZSAoaS5lLiBhIGN5bGluZGVyKVxuICAgIGNvbnN0IG9wdGlvbnMgPSBfY3JlYXRlQ29uZURhdGEocmFkaXVzLCByYWRpdXMsIGhlaWdodCwgaGVpZ2h0U2VnbWVudHMsIGNhcFNlZ21lbnRzLCBmYWxzZSk7XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucy5ub3JtYWxzLCBvcHRpb25zLnV2cywgb3B0aW9ucy5pbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBjYXBzdWxlLXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplLCBzaGFwZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgY2Fwc3VsZSBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb25cbiAqIHBhcmFtZXRlcnMuIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIGNhcHN1bGUgc3RhbmRpbmcgdmVydGljYWxseSBjZW50ZXJlZCBvbiB0aGVcbiAqIFhaLXBsYW5lIHdpdGggYSByYWRpdXMgb2YgMC4yNSwgYSBoZWlnaHQgb2YgMS4wLCAxIGhlaWdodCBzZWdtZW50IGFuZCAxMCBjYXAgc2VnbWVudHMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBjYXBzdWxlIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgY2Fwc3VsZSdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5yYWRpdXNdIC0gVGhlIHJhZGl1cyBvZiB0aGUgdHViZSBmb3JtaW5nIHRoZSBib2R5IG9mIHRoZSBjYXBzdWxlIChkZWZhdWx0c1xuICogdG8gMC4zKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRdIC0gVGhlIGxlbmd0aCBvZiB0aGUgYm9keSBvZiB0aGUgY2Fwc3VsZSBmcm9tIHRpcCB0byB0aXAgKGRlZmF1bHRzXG4gKiB0byAxLjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSB0dWJ1bGFyIGxlbmd0aCBvZiB0aGVcbiAqIGNhcHN1bGUgKGRlZmF1bHRzIHRvIDEpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnNpZGVzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFyb3VuZCB0aGUgdHVidWxhciBib2R5IG9mIHRoZSBjYXBzdWxlXG4gKiAoZGVmYXVsdHMgdG8gMjApLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgY3lsaW5kZXItc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNhcHN1bGUoZGV2aWNlLCBvcHRzKSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCByYWRpdXMgPSBvcHRzICYmIG9wdHMucmFkaXVzICE9PSB1bmRlZmluZWQgPyBvcHRzLnJhZGl1cyA6IDAuMztcbiAgICBjb25zdCBoZWlnaHQgPSBvcHRzICYmIG9wdHMuaGVpZ2h0ICE9PSB1bmRlZmluZWQgPyBvcHRzLmhlaWdodCA6IDEuMDtcbiAgICBjb25zdCBoZWlnaHRTZWdtZW50cyA9IG9wdHMgJiYgb3B0cy5oZWlnaHRTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5oZWlnaHRTZWdtZW50cyA6IDE7XG4gICAgY29uc3Qgc2lkZXMgPSBvcHRzICYmIG9wdHMuc2lkZXMgIT09IHVuZGVmaW5lZCA/IG9wdHMuc2lkZXMgOiAyMDtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzICYmIG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgOiBmYWxzZTtcblxuICAgIC8vIENyZWF0ZSB2ZXJ0ZXggZGF0YSBmb3IgYSBjb25lIHRoYXQgaGFzIGEgYmFzZSBhbmQgcGVhayByYWRpdXMgdGhhdCBpcyB0aGUgc2FtZSAoaS5lLiBhIGN5bGluZGVyKVxuICAgIGNvbnN0IG9wdGlvbnMgPSBfY3JlYXRlQ29uZURhdGEocmFkaXVzLCByYWRpdXMsIGhlaWdodCAtIDIgKiByYWRpdXMsIGhlaWdodFNlZ21lbnRzLCBzaWRlcywgdHJ1ZSk7XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucy5ub3JtYWxzLCBvcHRpb25zLnV2cywgb3B0aW9ucy5pbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBjb25lLXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplLCBzaGFwZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgY29uZSBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb25cbiAqIHBhcmFtZXRlcnMuIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIGNvbmUgc3RhbmRpbmcgdmVydGljYWxseSBjZW50ZXJlZCBvbiB0aGVcbiAqIFhaLXBsYW5lIHdpdGggYSBiYXNlIHJhZGl1cyBvZiAwLjUsIGEgaGVpZ2h0IG9mIDEuMCwgNSBoZWlnaHQgc2VnbWVudHMgYW5kIDIwIGNhcCBzZWdtZW50cy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGNvbmUgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnQgaW5mb3JtYXRpb25cbiAqIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBjb25lJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmJhc2VSYWRpdXNdIC0gVGhlIGJhc2UgcmFkaXVzIG9mIHRoZSBjb25lIChkZWZhdWx0cyB0byAwLjUpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnBlYWtSYWRpdXNdIC0gVGhlIHBlYWsgcmFkaXVzIG9mIHRoZSBjb25lIChkZWZhdWx0cyB0byAwLjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodF0gLSBUaGUgbGVuZ3RoIG9mIHRoZSBib2R5IG9mIHRoZSBjb25lIChkZWZhdWx0cyB0byAxLjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBsZW5ndGggb2YgdGhlIGNvbmVcbiAqIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5jYXBTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhcm91bmQgdGhlIHR1YnVsYXIgYm9keSBvZiB0aGUgY29uZVxuICogKGRlZmF1bHRzIHRvIDE4KS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IGNvbmUtc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNvbmUoZGV2aWNlLCBvcHRzKSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCBiYXNlUmFkaXVzID0gb3B0cyAmJiBvcHRzLmJhc2VSYWRpdXMgIT09IHVuZGVmaW5lZCA/IG9wdHMuYmFzZVJhZGl1cyA6IDAuNTtcbiAgICBjb25zdCBwZWFrUmFkaXVzID0gb3B0cyAmJiBvcHRzLnBlYWtSYWRpdXMgIT09IHVuZGVmaW5lZCA/IG9wdHMucGVha1JhZGl1cyA6IDAuMDtcbiAgICBjb25zdCBoZWlnaHQgPSBvcHRzICYmIG9wdHMuaGVpZ2h0ICE9PSB1bmRlZmluZWQgPyBvcHRzLmhlaWdodCA6IDEuMDtcbiAgICBjb25zdCBoZWlnaHRTZWdtZW50cyA9IG9wdHMgJiYgb3B0cy5oZWlnaHRTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5oZWlnaHRTZWdtZW50cyA6IDU7XG4gICAgY29uc3QgY2FwU2VnbWVudHMgPSBvcHRzICYmIG9wdHMuY2FwU2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FwU2VnbWVudHMgOiAxODtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzICYmIG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgOiBmYWxzZTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSBfY3JlYXRlQ29uZURhdGEoYmFzZVJhZGl1cywgcGVha1JhZGl1cywgaGVpZ2h0LCBoZWlnaHRTZWdtZW50cywgY2FwU2VnbWVudHMsIGZhbHNlKTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zLm5vcm1hbHMsIG9wdGlvbnMudXZzLCBvcHRpb25zLmluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgb3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIHNwaGVyZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgc3BoZXJlIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvbiBwYXJhbWV0ZXJzLiBCeVxuICogZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgc3BoZXJlIGNlbnRlcmVkIG9uIHRoZSBvYmplY3Qgc3BhY2Ugb3JpZ2luIHdpdGggYSByYWRpdXMgb2ZcbiAqIDAuNSBhbmQgMTYgc2VnbWVudHMgaW4gYm90aCBsb25naXR1ZGUgYW5kIGxhdGl0dWRlLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgc3BoZXJlIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgc3BoZXJlJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUgKGRlZmF1bHRzIHRvIDAuNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubGF0aXR1ZGVCYW5kc10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgbGF0aXR1ZGluYWwgYXhpcyBvZiB0aGVcbiAqIHNwaGVyZSAoZGVmYXVsdHMgdG8gMTYpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmxvbmdpdHVkZUJhbmRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBsb25naXR1ZGluYWwgYXhpcyBvZlxuICogdGhlIHNwaGVyZSAoZGVmYXVsdHMgdG8gMTYpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgc3BoZXJlLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVTcGhlcmUoZGV2aWNlLCBvcHRzKSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCByYWRpdXMgPSBvcHRzICYmIG9wdHMucmFkaXVzICE9PSB1bmRlZmluZWQgPyBvcHRzLnJhZGl1cyA6IDAuNTtcbiAgICBjb25zdCBsYXRpdHVkZUJhbmRzID0gb3B0cyAmJiBvcHRzLmxhdGl0dWRlQmFuZHMgIT09IHVuZGVmaW5lZCA/IG9wdHMubGF0aXR1ZGVCYW5kcyA6IDE2O1xuICAgIGNvbnN0IGxvbmdpdHVkZUJhbmRzID0gb3B0cyAmJiBvcHRzLmxvbmdpdHVkZUJhbmRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmxvbmdpdHVkZUJhbmRzIDogMTY7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cyAmJiBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzIDogZmFsc2U7XG5cbiAgICAvLyBWYXJpYWJsZSBkZWNsYXJhdGlvbnNcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuXG4gICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDw9IGxhdGl0dWRlQmFuZHM7IGxhdCsrKSB7XG4gICAgICAgIGNvbnN0IHRoZXRhID0gbGF0ICogTWF0aC5QSSAvIGxhdGl0dWRlQmFuZHM7XG4gICAgICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguY29zKHRoZXRhKTtcblxuICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPD0gbG9uZ2l0dWRlQmFuZHM7IGxvbisrKSB7XG4gICAgICAgICAgICAvLyBTd2VlcCB0aGUgc3BoZXJlIGZyb20gdGhlIHBvc2l0aXZlIFogYXhpcyB0byBtYXRjaCBhIDNEUyBNYXggc3BoZXJlXG4gICAgICAgICAgICBjb25zdCBwaGkgPSBsb24gKiAyICogTWF0aC5QSSAvIGxvbmdpdHVkZUJhbmRzIC0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICBjb25zdCBzaW5QaGkgPSBNYXRoLnNpbihwaGkpO1xuICAgICAgICAgICAgY29uc3QgY29zUGhpID0gTWF0aC5jb3MocGhpKTtcblxuICAgICAgICAgICAgY29uc3QgeCA9IGNvc1BoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgY29uc3QgeSA9IGNvc1RoZXRhO1xuICAgICAgICAgICAgY29uc3QgeiA9IHNpblBoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgY29uc3QgdSA9IDEgLSBsb24gLyBsb25naXR1ZGVCYW5kcztcbiAgICAgICAgICAgIGNvbnN0IHYgPSAxIC0gbGF0IC8gbGF0aXR1ZGVCYW5kcztcblxuICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIHJhZGl1cywgeSAqIHJhZGl1cywgeiAqIHJhZGl1cyk7XG4gICAgICAgICAgICBub3JtYWxzLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPCBsYXRpdHVkZUJhbmRzOyArK2xhdCkge1xuICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPCBsb25naXR1ZGVCYW5kczsgKytsb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0ICA9IChsYXQgKiAobG9uZ2l0dWRlQmFuZHMgKyAxKSkgKyBsb247XG4gICAgICAgICAgICBjb25zdCBzZWNvbmQgPSBmaXJzdCArIGxvbmdpdHVkZUJhbmRzICsgMTtcblxuICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0ICsgMSwgc2Vjb25kLCBmaXJzdCk7XG4gICAgICAgICAgICBpbmRpY2VzLnB1c2goZmlyc3QgKyAxLCBzZWNvbmQgKyAxLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2cywgLy8gVVYxID0gVVYwIGZvciBzcGhlcmVcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBwb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIHBsYW5lLXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBwbGFuZSBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb24gcGFyYW1ldGVycy4gQnlcbiAqIGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIHBsYW5lIGNlbnRlcmVkIG9uIHRoZSBvYmplY3Qgc3BhY2Ugb3JpZ2luIHdpdGggYSB3aWR0aCBhbmRcbiAqIGxlbmd0aCBvZiAxLjAgYW5kIDUgc2VnbWVudHMgaW4gZWl0aGVyIGF4aXMgKDUwIHRyaWFuZ2xlcykuIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBwbGFuZSBpc1xuICogYWxpZ25lZCBhbG9uZyB0aGUgcG9zaXRpdmUgWSBheGlzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgcGxhbmUgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBwbGFuZSdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7VmVjMn0gW29wdHMuaGFsZkV4dGVudHNdIC0gVGhlIGhhbGYgZGltZW5zaW9ucyBvZiB0aGUgcGxhbmUgaW4gdGhlIFggYW5kIFogYXhlc1xuICogKGRlZmF1bHRzIHRvIFswLjUsIDAuNV0pLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLndpZHRoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFggYXhpcyBvZiB0aGUgcGxhbmVcbiAqIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5sZW5ndGhTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWiBheGlzIG9mIHRoZSBwbGFuZVxuICogKGRlZmF1bHRzIHRvIDUpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgcGxhbmUtc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVBsYW5lKGRldmljZSwgb3B0cykge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgaGUgPSBvcHRzICYmIG9wdHMuaGFsZkV4dGVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGFsZkV4dGVudHMgOiBuZXcgVmVjMigwLjUsIDAuNSk7XG4gICAgY29uc3Qgd3MgPSBvcHRzICYmIG9wdHMud2lkdGhTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy53aWR0aFNlZ21lbnRzIDogNTtcbiAgICBjb25zdCBscyA9IG9wdHMgJiYgb3B0cy5sZW5ndGhTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5sZW5ndGhTZWdtZW50cyA6IDU7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cyAmJiBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzIDogZmFsc2U7XG5cbiAgICAvLyBWYXJpYWJsZSBkZWNsYXJhdGlvbnNcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgcGxhbmUgYXMgZm9sbG93cyAoYXNzaWduZWQgVVZzIGRlbm90ZWQgYXQgY29ybmVycyk6XG4gICAgLy8gKDAsMSl4LS0tLS0tLS0teCgxLDEpXG4gICAgLy8gICAgICB8ICAgICAgICAgfFxuICAgIC8vICAgICAgfCAgICAgICAgIHxcbiAgICAvLyAgICAgIHwgICAgTy0tWCB8bGVuZ3RoXG4gICAgLy8gICAgICB8ICAgIHwgICAgfFxuICAgIC8vICAgICAgfCAgICBaICAgIHxcbiAgICAvLyAoMCwwKXgtLS0tLS0tLS14KDEsMClcbiAgICAvLyB3aWR0aFxuICAgIGxldCB2Y291bnRlciA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSB3czsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IGxzOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSAtaGUueCArIDIgKiBoZS54ICogaSAvIHdzO1xuICAgICAgICAgICAgY29uc3QgeSA9IDAuMDtcbiAgICAgICAgICAgIGNvbnN0IHogPSAtKC1oZS55ICsgMiAqIGhlLnkgKiBqIC8gbHMpO1xuICAgICAgICAgICAgY29uc3QgdSA9IGkgLyB3cztcbiAgICAgICAgICAgIGNvbnN0IHYgPSBqIC8gbHM7XG5cbiAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgbm9ybWFscy5wdXNoKDAsIDEsIDApO1xuICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICBpZiAoKGkgPCB3cykgJiYgKGogPCBscykpIHtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2godmNvdW50ZXIgKyBscyArIDEsIHZjb3VudGVyICsgMSwgdmNvdW50ZXIpO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCh2Y291bnRlciArIGxzICsgMSwgdmNvdW50ZXIgKyBscyArIDIsIHZjb3VudGVyICsgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZjb3VudGVyKys7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzLCAvLyBVVjEgPSBVVjAgZm9yIHBsYW5lXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBib3gtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBib3ggY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uIHBhcmFtZXRlcnMuXG4gKiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBib3ggY2VudGVyZWQgb24gdGhlIG9iamVjdCBzcGFjZSBvcmlnaW4gd2l0aCBhIHdpZHRoLFxuICogbGVuZ3RoIGFuZCBoZWlnaHQgb2YgMS4wIHVuaXQgYW5kIDEwIHNlZ21lbnRzIGluIGVpdGhlciBheGlzICg1MCB0cmlhbmdsZXMgcGVyIGZhY2UpLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgYm94IGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMSBvbiBlYWNoIGZhY2UuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGJveCdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7VmVjM30gW29wdHMuaGFsZkV4dGVudHNdIC0gVGhlIGhhbGYgZGltZW5zaW9ucyBvZiB0aGUgYm94IGluIGVhY2ggYXhpcyAoZGVmYXVsdHMgdG9cbiAqIFswLjUsIDAuNSwgMC41XSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMud2lkdGhTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWCBheGlzIG9mIHRoZSBib3hcbiAqIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5sZW5ndGhTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWiBheGlzIG9mIHRoZSBib3hcbiAqIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWSBheGlzIG9mIHRoZSBib3hcbiAqIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IGJveC1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQm94KGRldmljZSwgb3B0cykge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgaGUgPSBvcHRzICYmIG9wdHMuaGFsZkV4dGVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGFsZkV4dGVudHMgOiBuZXcgVmVjMygwLjUsIDAuNSwgMC41KTtcbiAgICBjb25zdCB3cyA9IG9wdHMgJiYgb3B0cy53aWR0aFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLndpZHRoU2VnbWVudHMgOiAxO1xuICAgIGNvbnN0IGxzID0gb3B0cyAmJiBvcHRzLmxlbmd0aFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmxlbmd0aFNlZ21lbnRzIDogMTtcbiAgICBjb25zdCBocyA9IG9wdHMgJiYgb3B0cy5oZWlnaHRTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5oZWlnaHRTZWdtZW50cyA6IDE7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cyAmJiBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzIDogZmFsc2U7XG5cbiAgICBjb25zdCBjb3JuZXJzID0gW1xuICAgICAgICBuZXcgVmVjMygtaGUueCwgLWhlLnksIGhlLnopLFxuICAgICAgICBuZXcgVmVjMyhoZS54LCAtaGUueSwgaGUueiksXG4gICAgICAgIG5ldyBWZWMzKGhlLngsIGhlLnksIGhlLnopLFxuICAgICAgICBuZXcgVmVjMygtaGUueCwgaGUueSwgaGUueiksXG4gICAgICAgIG5ldyBWZWMzKGhlLngsIC1oZS55LCAtaGUueiksXG4gICAgICAgIG5ldyBWZWMzKC1oZS54LCAtaGUueSwgLWhlLnopLFxuICAgICAgICBuZXcgVmVjMygtaGUueCwgaGUueSwgLWhlLnopLFxuICAgICAgICBuZXcgVmVjMyhoZS54LCBoZS55LCAtaGUueilcbiAgICBdO1xuXG4gICAgY29uc3QgZmFjZUF4ZXMgPSBbXG4gICAgICAgIFswLCAxLCAzXSwgLy8gRlJPTlRcbiAgICAgICAgWzQsIDUsIDddLCAvLyBCQUNLXG4gICAgICAgIFszLCAyLCA2XSwgLy8gVE9QXG4gICAgICAgIFsxLCAwLCA0XSwgLy8gQk9UVE9NXG4gICAgICAgIFsxLCA0LCAyXSwgLy8gUklHSFRcbiAgICAgICAgWzUsIDAsIDZdICAvLyBMRUZUXG4gICAgXTtcblxuICAgIGNvbnN0IGZhY2VOb3JtYWxzID0gW1xuICAgICAgICBbMCwgIDAsICAxXSwgLy8gRlJPTlRcbiAgICAgICAgWzAsICAwLCAtMV0sIC8vIEJBQ0tcbiAgICAgICAgWzAsICAxLCAgMF0sIC8vIFRPUFxuICAgICAgICBbMCwgLTEsICAwXSwgLy8gQk9UVE9NXG4gICAgICAgIFsxLCAgMCwgIDBdLCAvLyBSSUdIVFxuICAgICAgICBbLTEsICAwLCAgMF0gIC8vIExFRlRcbiAgICBdO1xuXG4gICAgY29uc3Qgc2lkZXMgPSB7XG4gICAgICAgIEZST05UOiAwLFxuICAgICAgICBCQUNLOiAxLFxuICAgICAgICBUT1A6IDIsXG4gICAgICAgIEJPVFRPTTogMyxcbiAgICAgICAgUklHSFQ6IDQsXG4gICAgICAgIExFRlQ6IDVcbiAgICB9O1xuXG4gICAgY29uc3QgcG9zaXRpb25zID0gW107XG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuICAgIGNvbnN0IHV2cyA9IFtdO1xuICAgIGNvbnN0IHV2czEgPSBbXTtcbiAgICBjb25zdCBpbmRpY2VzID0gW107XG4gICAgbGV0IHZjb3VudGVyID0gMDtcblxuICAgIGNvbnN0IGdlbmVyYXRlRmFjZSA9IChzaWRlLCB1U2VnbWVudHMsIHZTZWdtZW50cykgPT4ge1xuICAgICAgICBjb25zdCB0ZW1wMSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IHRlbXAyID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgdGVtcDMgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCByID0gbmV3IFZlYzMoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSB1U2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPD0gdlNlZ21lbnRzOyBqKyspIHtcbiAgICAgICAgICAgICAgICB0ZW1wMS5sZXJwKGNvcm5lcnNbZmFjZUF4ZXNbc2lkZV1bMF1dLCBjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzFdXSwgaSAvIHVTZWdtZW50cyk7XG4gICAgICAgICAgICAgICAgdGVtcDIubGVycChjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzBdXSwgY29ybmVyc1tmYWNlQXhlc1tzaWRlXVsyXV0sIGogLyB2U2VnbWVudHMpO1xuICAgICAgICAgICAgICAgIHRlbXAzLnN1YjIodGVtcDIsIGNvcm5lcnNbZmFjZUF4ZXNbc2lkZV1bMF1dKTtcbiAgICAgICAgICAgICAgICByLmFkZDIodGVtcDEsIHRlbXAzKTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IGkgLyB1U2VnbWVudHM7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSBqIC8gdlNlZ21lbnRzO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goci54LCByLnksIHIueik7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKGZhY2VOb3JtYWxzW3NpZGVdWzBdLCBmYWNlTm9ybWFsc1tzaWRlXVsxXSwgZmFjZU5vcm1hbHNbc2lkZV1bMl0pO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIHBhY2sgYXMgM3gyLiAxLzMgd2lsbCBiZSBlbXB0eSwgYnV0IGl0J3MgZWl0aGVyIHRoYXQgb3Igc3RyZXRjaGVkIHBpeGVsc1xuICAgICAgICAgICAgICAgIC8vIFRPRE86IGdlbmVyYXRlIG5vbi1yZWN0YW5ndWxhciBsaWdodE1hcHMsIHNvIHdlIGNvdWxkIHVzZSBzcGFjZSB3aXRob3V0IHN0cmV0Y2hpbmdcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB2IC89IDM7XG5cbiAgICAgICAgICAgICAgICB1ICs9IChzaWRlICUgMykgLyAzO1xuICAgICAgICAgICAgICAgIHYgKz0gTWF0aC5mbG9vcihzaWRlIC8gMykgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoKGkgPCB1U2VnbWVudHMpICYmIChqIDwgdlNlZ21lbnRzKSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2godmNvdW50ZXIgKyB2U2VnbWVudHMgKyAxLCB2Y291bnRlciArIDEsIHZjb3VudGVyKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZjb3VudGVyICsgdlNlZ21lbnRzICsgMSwgdmNvdW50ZXIgKyB2U2VnbWVudHMgKyAyLCB2Y291bnRlciArIDEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZjb3VudGVyKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLkZST05ULCB3cywgaHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5CQUNLLCB3cywgaHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5UT1AsIHdzLCBscyk7XG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLkJPVFRPTSwgd3MsIGxzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuUklHSFQsIGxzLCBocyk7XG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLkxFRlQsIGxzLCBocyk7XG5cbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzMSxcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBwb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vLyByZXR1cm5zIFByaW1pdGl2ZSBkYXRhLCB1c2VkIGJ5IE1vZGVsQ29tcG9uZW50IGFuZCBSZW5kZXJDb21wb25lbnRcbmZ1bmN0aW9uIGdldFNoYXBlUHJpbWl0aXZlKGRldmljZSwgdHlwZSkge1xuXG4gICAgLy8gZmluZCBpbiBjYWNoZVxuICAgIGxldCBwcmltRGF0YSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaGFwZVByaW1pdGl2ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHNoYXBlUHJpbWl0aXZlc1tpXS50eXBlID09PSB0eXBlICYmIHNoYXBlUHJpbWl0aXZlc1tpXS5kZXZpY2UgPT09IGRldmljZSkge1xuICAgICAgICAgICAgcHJpbURhdGEgPSBzaGFwZVByaW1pdGl2ZXNbaV0ucHJpbURhdGE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBub3QgaW4gY2FjaGUsIGNyZWF0ZSBuZXdcbiAgICBpZiAoIXByaW1EYXRhKSB7XG5cbiAgICAgICAgbGV0IG1lc2gsIGFyZWE7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuXG4gICAgICAgICAgICBjYXNlICdib3gnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVCb3goZGV2aWNlLCB7IGhhbGZFeHRlbnRzOiBuZXcgVmVjMygwLjUsIDAuNSwgMC41KSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAyLCB5OiAyLCB6OiAyLCB1djogKDIuMCAvIDMpIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ2NhcHN1bGUnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVDYXBzdWxlKGRldmljZSwgeyByYWRpdXM6IDAuNSwgaGVpZ2h0OiAyIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IChNYXRoLlBJICogMiksIHk6IE1hdGguUEksIHo6IChNYXRoLlBJICogMiksIHV2OiAoMS4wIC8gMyArICgoMS4wIC8gMykgLyAzKSAqIDIpIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ2NvbmUnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVDb25lKGRldmljZSwgeyBiYXNlUmFkaXVzOiAwLjUsIHBlYWtSYWRpdXM6IDAsIGhlaWdodDogMSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAyLjU0LCB5OiAyLjU0LCB6OiAyLjU0LCB1djogKDEuMCAvIDMgKyAoMS4wIC8gMykgLyAzKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjeWxpbmRlcic6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZUN5bGluZGVyKGRldmljZSwgeyByYWRpdXM6IDAuNSwgaGVpZ2h0OiAxIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IE1hdGguUEksIHk6ICgwLjc5ICogMiksIHo6IE1hdGguUEksIHV2OiAoMS4wIC8gMyArICgoMS4wIC8gMykgLyAzKSAqIDIpIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3BsYW5lJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlUGxhbmUoZGV2aWNlLCB7IGhhbGZFeHRlbnRzOiBuZXcgVmVjMigwLjUsIDAuNSksIHdpZHRoU2VnbWVudHM6IDEsIGxlbmd0aFNlZ21lbnRzOiAxIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IDAsIHk6IDEsIHo6IDAsIHV2OiAxIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3NwaGVyZSc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZVNwaGVyZShkZXZpY2UsIHsgcmFkaXVzOiAwLjUgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogTWF0aC5QSSwgeTogTWF0aC5QSSwgejogTWF0aC5QSSwgdXY6IDEgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAndG9ydXMnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVUb3J1cyhkZXZpY2UsIHsgdHViZVJhZGl1czogMC4yLCByaW5nUmFkaXVzOiAwLjMgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogTWF0aC5QSSAqIDAuNSAqIDAuNSAtIE1hdGguUEkgKiAwLjEgKiAwLjEsIHk6IDAuNCwgejogMC40LCB1djogMSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwcmltaXRpdmUgdHlwZTogJyArIHR5cGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5jIHJlZmVyZW5jZSB0byBrZWVwIHByaW1pdGl2ZSBhbGl2ZVxuICAgICAgICBtZXNoLmluY1JlZkNvdW50KCk7XG5cbiAgICAgICAgcHJpbURhdGEgPSB7IG1lc2g6IG1lc2gsIGFyZWE6IGFyZWEgfTtcblxuICAgICAgICAvLyBhZGQgdG8gY2FjaGVcbiAgICAgICAgc2hhcGVQcmltaXRpdmVzLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgICAgIGRldmljZTogZGV2aWNlLFxuICAgICAgICAgICAgcHJpbURhdGE6IHByaW1EYXRhXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBwcmltRGF0YTtcbn1cblxuZXhwb3J0IHsgY2FsY3VsYXRlTm9ybWFscywgY2FsY3VsYXRlVGFuZ2VudHMsIGNyZWF0ZUJveCwgY3JlYXRlQ2Fwc3VsZSwgY3JlYXRlQ29uZSwgY3JlYXRlQ3lsaW5kZXIsIGNyZWF0ZU1lc2gsIGNyZWF0ZVBsYW5lLCBjcmVhdGVTcGhlcmUsIGNyZWF0ZVRvcnVzLCBnZXRTaGFwZVByaW1pdGl2ZSB9O1xuIl0sIm5hbWVzIjpbInByaW1pdGl2ZVV2MVBhZGRpbmciLCJwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUiLCJzaGFwZVByaW1pdGl2ZXMiLCJjYWxjdWxhdGVOb3JtYWxzIiwicG9zaXRpb25zIiwiaW5kaWNlcyIsInRyaWFuZ2xlQ291bnQiLCJsZW5ndGgiLCJ2ZXJ0ZXhDb3VudCIsInAxIiwiVmVjMyIsInAyIiwicDMiLCJwMXAyIiwicDFwMyIsImZhY2VOb3JtYWwiLCJub3JtYWxzIiwiaSIsImkxIiwiaTIiLCJpMyIsInNldCIsInN1YjIiLCJjcm9zcyIsIm5vcm1hbGl6ZSIsIngiLCJ5IiwieiIsIm54IiwibnkiLCJueiIsImludkxlbiIsIk1hdGgiLCJzcXJ0IiwiY2FsY3VsYXRlVGFuZ2VudHMiLCJ1dnMiLCJ2MSIsInYyIiwidjMiLCJ3MSIsIlZlYzIiLCJ3MiIsInczIiwic2RpciIsInRkaXIiLCJ0YW4xIiwiRmxvYXQzMkFycmF5IiwidGFuMiIsInRhbmdlbnRzIiwieDEiLCJ4MiIsInkxIiwieTIiLCJ6MSIsInoyIiwiczEiLCJzMiIsInQxIiwidDIiLCJhcmVhIiwiciIsIm4iLCJ0ZW1wIiwibmRvdHQiLCJkb3QiLCJjb3B5IiwibXVsU2NhbGFyIiwiY3JlYXRlTWVzaCIsImRldmljZSIsIm9wdHMiLCJtZXNoIiwiTWVzaCIsInNldFBvc2l0aW9ucyIsInNldE5vcm1hbHMiLCJzZXRWZXJ0ZXhTdHJlYW0iLCJTRU1BTlRJQ19UQU5HRU5UIiwiY29sb3JzIiwic2V0Q29sb3JzMzIiLCJzZXRVdnMiLCJ1dnMxIiwiYmxlbmRJbmRpY2VzIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiVFlQRV9VSU5UOCIsImJsZW5kV2VpZ2h0cyIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwic2V0SW5kaWNlcyIsInVwZGF0ZSIsImNyZWF0ZVRvcnVzIiwicmMiLCJ0dWJlUmFkaXVzIiwidW5kZWZpbmVkIiwicnQiLCJyaW5nUmFkaXVzIiwic2VnbWVudHMiLCJzaWRlcyIsImNhbGNUYW5nZW50cyIsImoiLCJjb3MiLCJQSSIsInNpbiIsInUiLCJ2IiwicHVzaCIsImZpcnN0Iiwic2Vjb25kIiwidGhpcmQiLCJmb3VydGgiLCJvcHRpb25zIiwiX2NyZWF0ZUNvbmVEYXRhIiwiYmFzZVJhZGl1cyIsInBlYWtSYWRpdXMiLCJoZWlnaHQiLCJoZWlnaHRTZWdtZW50cyIsImNhcFNlZ21lbnRzIiwicm91bmRlZENhcHMiLCJwb3MiLCJib3R0b21Ub1RvcCIsIm5vcm0iLCJ0b3AiLCJib3R0b20iLCJ0YW5nZW50Iiwib2Zmc2V0IiwidGhldGEiLCJzaW5UaGV0YSIsImNvc1RoZXRhIiwibGVycCIsIl92IiwibGF0aXR1ZGVCYW5kcyIsImZsb29yIiwibG9uZ2l0dWRlQmFuZHMiLCJjYXBPZmZzZXQiLCJsYXQiLCJsb24iLCJwaGkiLCJzaW5QaGkiLCJjb3NQaGkiLCJjcmVhdGVDeWxpbmRlciIsImhhc093blByb3BlcnR5IiwiRGVidWciLCJkZXByZWNhdGVkIiwicmFkaXVzIiwiY3JlYXRlQ2Fwc3VsZSIsImNyZWF0ZUNvbmUiLCJjcmVhdGVTcGhlcmUiLCJjcmVhdGVQbGFuZSIsImhlIiwiaGFsZkV4dGVudHMiLCJ3cyIsIndpZHRoU2VnbWVudHMiLCJscyIsImxlbmd0aFNlZ21lbnRzIiwidmNvdW50ZXIiLCJjcmVhdGVCb3giLCJocyIsImNvcm5lcnMiLCJmYWNlQXhlcyIsImZhY2VOb3JtYWxzIiwiRlJPTlQiLCJCQUNLIiwiVE9QIiwiQk9UVE9NIiwiUklHSFQiLCJMRUZUIiwiZ2VuZXJhdGVGYWNlIiwic2lkZSIsInVTZWdtZW50cyIsInZTZWdtZW50cyIsInRlbXAxIiwidGVtcDIiLCJ0ZW1wMyIsImFkZDIiLCJnZXRTaGFwZVByaW1pdGl2ZSIsInR5cGUiLCJwcmltRGF0YSIsInV2IiwiRXJyb3IiLCJpbmNSZWZDb3VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFhQSxNQUFNQSxtQkFBbUIsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFBO0FBQ3BDLE1BQU1DLHdCQUF3QixHQUFHLEdBQUcsR0FBR0QsbUJBQW1CLEdBQUcsQ0FBQyxDQUFBOztBQUc5RCxNQUFNRSxlQUFlLEdBQUcsRUFBRSxDQUFBOztBQWMxQixTQUFTQyxnQkFBZ0IsQ0FBQ0MsU0FBUyxFQUFFQyxPQUFPLEVBQUU7QUFDMUMsRUFBQSxNQUFNQyxhQUFhLEdBQUdELE9BQU8sQ0FBQ0UsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUN4QyxFQUFBLE1BQU1DLFdBQVcsR0FBS0osU0FBUyxDQUFDRyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQzFDLEVBQUEsTUFBTUUsRUFBRSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3JCLEVBQUEsTUFBTUMsRUFBRSxHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBQ3JCLEVBQUEsTUFBTUUsRUFBRSxHQUFHLElBQUlGLElBQUksRUFBRSxDQUFBO0FBQ3JCLEVBQUEsTUFBTUcsSUFBSSxHQUFHLElBQUlILElBQUksRUFBRSxDQUFBO0FBQ3ZCLEVBQUEsTUFBTUksSUFBSSxHQUFHLElBQUlKLElBQUksRUFBRSxDQUFBO0FBQ3ZCLEVBQUEsTUFBTUssVUFBVSxHQUFHLElBQUlMLElBQUksRUFBRSxDQUFBO0VBRTdCLE1BQU1NLE9BQU8sR0FBRyxFQUFFLENBQUE7O0FBR2xC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
