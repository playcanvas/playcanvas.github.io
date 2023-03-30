/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Debug } from '../core/debug.js';
import { SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, TYPE_UINT8, SEMANTIC_BLENDWEIGHT } from '../platform/graphics/constants.js';
import { Mesh } from './mesh.js';

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

// cached mesh primitives
const shapePrimitives = [];

/**
 * Generates normal information from the specified positions and triangle indices. See
 * {@link createMesh}.
 *
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {number[]} indices - An array of triangle indices.
 * @returns {number[]} An array of 3-dimensional vertex normals.
 * @example
 * var normals = pc.calculateNormals(positions, indices);
 * var mesh = pc.createMesh(graphicsDevice, positions, {
 *     normals: normals,
 *     uvs: uvs,
 *     indices: indices
 * });
 */
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

  // Initialize the normal array to zero
  for (let i = 0; i < positions.length; i++) {
    normals[i] = 0;
  }

  // Accumulate face normals for each vertex
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

  // Normalize all normals
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

/**
 * Generates tangent information from the specified positions, normals, texture coordinates and
 * triangle indices. See {@link createMesh}.
 *
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {number[]} normals - An array of 3-dimensional vertex normals.
 * @param {number[]} uvs - An array of 2-dimensional vertex texture coordinates.
 * @param {number[]} indices - An array of triangle indices.
 * @returns {number[]} An array of 3-dimensional vertex tangents.
 * @example
 * var tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * var mesh = pc.createMesh(graphicsDevice, positions, {
 *     normals: normals,
 *     tangents: tangents,
 *     uvs: uvs,
 *     indices: indices
 * });
 */
function calculateTangents(positions, normals, uvs, indices) {
  // Lengyel's Method
  // http://web.archive.org/web/20180620024439/http://www.terathon.com/code/tangent.html
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

    // Area can be 0 for degenerate triangles or bad uv coordinates
    if (area === 0) {
      // Fallback to default values
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

    // Gram-Schmidt orthogonalize
    const ndott = n.dot(t1);
    temp.copy(n).mulScalar(ndott);
    temp.sub2(t1, temp).normalize();
    tangents[i * 4] = temp.x;
    tangents[i * 4 + 1] = temp.y;
    tangents[i * 4 + 2] = temp.z;

    // Calculate handedness
    temp.cross(n, t1);
    tangents[i * 4 + 3] = temp.dot(t2) < 0.0 ? -1.0 : 1.0;
  }
  return tangents;
}

/**
 * Creates a new mesh object from the supplied vertex information and topology.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {number[]} positions - An array of 3-dimensional vertex positions.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number[]} [opts.normals] - An array of 3-dimensional vertex normals.
 * @param {number[]} [opts.tangents] - An array of 3-dimensional vertex tangents.
 * @param {number[]} [opts.colors] - An array of 4-dimensional vertex colors where each component
 * is an integer in the range 0 to 255.
 * @param {number[]} [opts.uvs] - An array of 2-dimensional vertex texture coordinates.
 * @param {number[]} [opts.uvs1] - Same as opts.uvs, but for additional UV set
 * @param {number[]} [opts.blendIndices] - An array of 4-dimensional bone indices where each
 * component is an integer in the range 0 to 255.
 * @param {number[]} [opts.blendWeights] - An array of 4-dimensional bone weights where each
 * component is in the range 0 to 1 and the sum of the weights should equal 1.
 * @param {number[]} [opts.indices] - An array of triangle indices.
 * @returns {Mesh} A new Mesh constructed from the supplied vertex and triangle data.
 * @example
 * // Create a simple, indexed triangle (with texture coordinates and vertex normals)
 * var mesh = pc.createMesh(graphicsDevice, [0, 0, 0, 1, 0, 0, 0, 1, 0], {
 *     normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
 *     uvs: [0, 0, 1, 0, 0, 1],
 *     indices: [0, 1, 2]
 * });
 */
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

/**
 * Creates a procedural torus-shaped mesh.
 *
 * The size, shape and tesselation properties of the torus can be controlled via function
 * parameters. By default, the function will create a torus in the XZ-plane with a tube radius of
 * 0.2, a ring radius of 0.3, 20 segments and 30 sides.
 *
 * Note that the torus is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the torus's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.tubeRadius] - The radius of the tube forming the body of the torus
 * (defaults to 0.2).
 * @param {number} [opts.ringRadius] - The radius from the centre of the torus to the centre of the
 * tube (defaults to 0.3).
 * @param {number} [opts.segments] - The number of radial divisions forming cross-sections of the
 * torus ring (defaults to 20).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the torus ring
 * (defaults to 30).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new torus-shaped mesh.
 */
function createTorus(device, opts) {
  // Check the supplied options and provide defaults for unspecified ones
  const rc = opts && opts.tubeRadius !== undefined ? opts.tubeRadius : 0.2;
  const rt = opts && opts.ringRadius !== undefined ? opts.ringRadius : 0.3;
  const segments = opts && opts.segments !== undefined ? opts.segments : 30;
  const sides = opts && opts.sides !== undefined ? opts.sides : 20;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  // Variable declarations
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
  // Variable declarations
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

  // Define the body of the cone/cylinder
  if (height > 0) {
    for (let i = 0; i <= heightSegments; i++) {
      for (let j = 0; j <= capSegments; j++) {
        // Sweep the cone body from the positive Y axis to match a 3DS Max cone/cylinder
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

        // Pack UV1 to 1st third
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

    // Generate top cap
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = lat * Math.PI * 0.5 / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= longitudeBands; lon++) {
        // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
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

        // Pack UV1 to 2nd third
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

    // Generate bottom cap
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = Math.PI * 0.5 + lat * Math.PI * 0.5 / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= longitudeBands; lon++) {
        // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
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

        // Pack UV1 to 3rd third
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
    // Generate bottom cap
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

        // Pack UV1 to 2nd third
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

    // Generate top cap
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

        // Pack UV1 to 3rd third
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

/**
 * Creates a procedural cylinder-shaped mesh.
 *
 * The size, shape and tesselation properties of the cylinder can be controlled via function
 * parameters. By default, the function will create a cylinder standing vertically centered on the
 * XZ-plane with a radius of 0.5, a height of 1.0, 1 height segment and 20 cap segments.
 *
 * Note that the cylinder is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the cylinder's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the cylinder
 * (defaults to 0.5).
 * @param {number} [opts.height] - The length of the body of the cylinder (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cylinder
 * (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the
 * cylinder (defaults to 20).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cylinder-shaped mesh.
 */
function createCylinder(device, opts) {
  if (opts && opts.hasOwnProperty('baseRadius') && !opts.hasOwnProperty('radius')) {
    Debug.deprecated('"baseRadius" in arguments, use "radius" instead');
  }

  // Check the supplied options and provide defaults for unspecified ones
  let radius = opts && (opts.radius || opts.baseRadius);
  radius = radius !== undefined ? radius : 0.5;
  const height = opts && opts.height !== undefined ? opts.height : 1.0;
  const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
  const capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 20;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
  const options = _createConeData(radius, radius, height, heightSegments, capSegments, false);
  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }
  return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural capsule-shaped mesh.
 *
 * The size, shape and tesselation properties of the capsule can be controlled via function
 * parameters. By default, the function will create a capsule standing vertically centered on the
 * XZ-plane with a radius of 0.25, a height of 1.0, 1 height segment and 10 cap segments.
 *
 * Note that the capsule is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the capsule's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the tube forming the body of the capsule (defaults
 * to 0.3).
 * @param {number} [opts.height] - The length of the body of the capsule from tip to tip (defaults
 * to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the tubular length of the
 * capsule (defaults to 1).
 * @param {number} [opts.sides] - The number of divisions around the tubular body of the capsule
 * (defaults to 20).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cylinder-shaped mesh.
 */
function createCapsule(device, opts) {
  // Check the supplied options and provide defaults for unspecified ones
  const radius = opts && opts.radius !== undefined ? opts.radius : 0.3;
  const height = opts && opts.height !== undefined ? opts.height : 1.0;
  const heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
  const sides = opts && opts.sides !== undefined ? opts.sides : 20;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  // Create vertex data for a cone that has a base and peak radius that is the same (i.e. a cylinder)
  const options = _createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);
  if (calcTangents) {
    options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
  }
  return createMesh(device, options.positions, options);
}

/**
 * Creates a procedural cone-shaped mesh.
 *
 * The size, shape and tesselation properties of the cone can be controlled via function
 * parameters. By default, the function will create a cone standing vertically centered on the
 * XZ-plane with a base radius of 0.5, a height of 1.0, 5 height segments and 20 cap segments.
 *
 * Note that the cone is created with UVs in the range of 0 to 1. Additionally, tangent information
 * is generated into the vertex buffer of the cone's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.baseRadius] - The base radius of the cone (defaults to 0.5).
 * @param {number} [opts.peakRadius] - The peak radius of the cone (defaults to 0.0).
 * @param {number} [opts.height] - The length of the body of the cone (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cone
 * (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the cone
 * (defaults to 18).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new cone-shaped mesh.
 */
function createCone(device, opts) {
  // Check the supplied options and provide defaults for unspecified ones
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

/**
 * Creates a procedural sphere-shaped mesh.
 *
 * The size and tesselation properties of the sphere can be controlled via function parameters. By
 * default, the function will create a sphere centered on the object space origin with a radius of
 * 0.5 and 16 segments in both longitude and latitude.
 *
 * Note that the sphere is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the sphere's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.radius] - The radius of the sphere (defaults to 0.5).
 * @param {number} [opts.latitudeBands] - The number of divisions along the latitudinal axis of the
 * sphere (defaults to 16).
 * @param {number} [opts.longitudeBands] - The number of divisions along the longitudinal axis of
 * the sphere (defaults to 16).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new sphere-shaped mesh.
 */
function createSphere(device, opts) {
  // Check the supplied options and provide defaults for unspecified ones
  const radius = opts && opts.radius !== undefined ? opts.radius : 0.5;
  const latitudeBands = opts && opts.latitudeBands !== undefined ? opts.latitudeBands : 16;
  const longitudeBands = opts && opts.longitudeBands !== undefined ? opts.longitudeBands : 16;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  // Variable declarations
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = lat * Math.PI / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let lon = 0; lon <= longitudeBands; lon++) {
      // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
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
    // UV1 = UV0 for sphere
    indices: indices
  };
  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }
  return createMesh(device, positions, options);
}

/**
 * Creates a procedural plane-shaped mesh.
 *
 * The size and tesselation properties of the plane can be controlled via function parameters. By
 * default, the function will create a plane centered on the object space origin with a width and
 * length of 1.0 and 5 segments in either axis (50 triangles). The normal vector of the plane is
 * aligned along the positive Y axis.
 *
 * Note that the plane is created with UVs in the range of 0 to 1. Additionally, tangent
 * information is generated into the vertex buffer of the plane's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec2} [opts.halfExtents] - The half dimensions of the plane in the X and Z axes
 * (defaults to [0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the plane
 * (defaults to 5).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the plane
 * (defaults to 5).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new plane-shaped mesh.
 */
function createPlane(device, opts) {
  // Check the supplied options and provide defaults for unspecified ones
  const he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec2(0.5, 0.5);
  const ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 5;
  const ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 5;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;

  // Variable declarations
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Generate plane as follows (assigned UVs denoted at corners):
  // (0,1)x---------x(1,1)
  //      |         |
  //      |         |
  //      |    O--X |length
  //      |    |    |
  //      |    Z    |
  // (0,0)x---------x(1,0)
  // width
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
    // UV1 = UV0 for plane
    indices: indices
  };
  if (calcTangents) {
    options.tangents = calculateTangents(positions, normals, uvs, indices);
  }
  return createMesh(device, positions, options);
}

/**
 * Creates a procedural box-shaped mesh.
 *
 * The size, shape and tesselation properties of the box can be controlled via function parameters.
 * By default, the function will create a box centered on the object space origin with a width,
 * length and height of 1.0 unit and 10 segments in either axis (50 triangles per face).
 *
 * Note that the box is created with UVs in the range of 0 to 1 on each face. Additionally, tangent
 * information is generated into the vertex buffer of the box's mesh.
 *
 * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {Vec3} [opts.halfExtents] - The half dimensions of the box in each axis (defaults to
 * [0.5, 0.5, 0.5]).
 * @param {number} [opts.widthSegments] - The number of divisions along the X axis of the box
 * (defaults to 1).
 * @param {number} [opts.lengthSegments] - The number of divisions along the Z axis of the box
 * (defaults to 1).
 * @param {number} [opts.heightSegments] - The number of divisions along the Y axis of the box
 * (defaults to 1).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @returns {Mesh} A new box-shaped mesh.
 */
function createBox(device, opts) {
  // Check the supplied options and provide defaults for unspecified ones
  const he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new Vec3(0.5, 0.5, 0.5);
  const ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 1;
  const ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 1;
  const hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
  const calcTangents = opts && opts.calculateTangents !== undefined ? opts.calculateTangents : false;
  const corners = [new Vec3(-he.x, -he.y, he.z), new Vec3(he.x, -he.y, he.z), new Vec3(he.x, he.y, he.z), new Vec3(-he.x, he.y, he.z), new Vec3(he.x, -he.y, -he.z), new Vec3(-he.x, -he.y, -he.z), new Vec3(-he.x, he.y, -he.z), new Vec3(he.x, he.y, -he.z)];
  const faceAxes = [[0, 1, 3],
  // FRONT
  [4, 5, 7],
  // BACK
  [3, 2, 6],
  // TOP
  [1, 0, 4],
  // BOTTOM
  [1, 4, 2],
  // RIGHT
  [5, 0, 6] // LEFT
  ];

  const faceNormals = [[0, 0, 1],
  // FRONT
  [0, 0, -1],
  // BACK
  [0, 1, 0],
  // TOP
  [0, -1, 0],
  // BOTTOM
  [1, 0, 0],
  // RIGHT
  [-1, 0, 0] // LEFT
  ];

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

        // pack as 3x2. 1/3 will be empty, but it's either that or stretched pixels
        // TODO: generate non-rectangular lightMaps, so we could use space without stretching
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

// returns Primitive data, used by ModelComponent and RenderComponent
function getShapePrimitive(device, type) {
  // find in cache
  let primData = null;
  for (let i = 0; i < shapePrimitives.length; i++) {
    if (shapePrimitives[i].type === type && shapePrimitives[i].device === device) {
      primData = shapePrimitives[i].primData;
    }
  }

  // not in cache, create new
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

    // inc reference to keep primitive alive
    mesh.incRefCount();
    primData = {
      mesh: mesh,
      area: area
    };

    // add to cache
    shapePrimitives.push({
      type: type,
      device: device,
      primData: primData
    });
  }
  return primData;
}

export { calculateNormals, calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus, getShapePrimitive };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2VkdXJhbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3Byb2NlZHVyYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQge1xuICAgIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0JMRU5EV0VJR0hULCBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgVFlQRV9VSU5UOFxufSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi9tZXNoLmpzJztcblxuY29uc3QgcHJpbWl0aXZlVXYxUGFkZGluZyA9IDQuMCAvIDY0O1xuY29uc3QgcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlID0gMS4wIC0gcHJpbWl0aXZlVXYxUGFkZGluZyAqIDI7XG5cbi8vIGNhY2hlZCBtZXNoIHByaW1pdGl2ZXNcbmNvbnN0IHNoYXBlUHJpbWl0aXZlcyA9IFtdO1xuXG4vKipcbiAqIEdlbmVyYXRlcyBub3JtYWwgaW5mb3JtYXRpb24gZnJvbSB0aGUgc3BlY2lmaWVkIHBvc2l0aW9ucyBhbmQgdHJpYW5nbGUgaW5kaWNlcy4gU2VlXG4gKiB7QGxpbmsgY3JlYXRlTWVzaH0uXG4gKlxuICogQHBhcmFtIHtudW1iZXJbXX0gcG9zaXRpb25zIC0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggcG9zaXRpb25zLlxuICogQHBhcmFtIHtudW1iZXJbXX0gaW5kaWNlcyAtIEFuIGFycmF5IG9mIHRyaWFuZ2xlIGluZGljZXMuXG4gKiBAcmV0dXJucyB7bnVtYmVyW119IEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IG5vcm1hbHMuXG4gKiBAZXhhbXBsZVxuICogdmFyIG5vcm1hbHMgPSBwYy5jYWxjdWxhdGVOb3JtYWxzKHBvc2l0aW9ucywgaW5kaWNlcyk7XG4gKiB2YXIgbWVzaCA9IHBjLmNyZWF0ZU1lc2goZ3JhcGhpY3NEZXZpY2UsIHBvc2l0aW9ucywge1xuICogICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gKiAgICAgdXZzOiB1dnMsXG4gKiAgICAgaW5kaWNlczogaW5kaWNlc1xuICogfSk7XG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZU5vcm1hbHMocG9zaXRpb25zLCBpbmRpY2VzKSB7XG4gICAgY29uc3QgdHJpYW5nbGVDb3VudCA9IGluZGljZXMubGVuZ3RoIC8gMztcbiAgICBjb25zdCB2ZXJ0ZXhDb3VudCAgID0gcG9zaXRpb25zLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgcDEgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHAyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgZmFjZU5vcm1hbCA9IG5ldyBWZWMzKCk7XG5cbiAgICBjb25zdCBub3JtYWxzID0gW107XG5cbiAgICAvLyBJbml0aWFsaXplIHRoZSBub3JtYWwgYXJyYXkgdG8gemVyb1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9zaXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5vcm1hbHNbaV0gPSAwO1xuICAgIH1cblxuICAgIC8vIEFjY3VtdWxhdGUgZmFjZSBub3JtYWxzIGZvciBlYWNoIHZlcnRleFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVDb3VudDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGkxID0gaW5kaWNlc1tpICogM107XG4gICAgICAgIGNvbnN0IGkyID0gaW5kaWNlc1tpICogMyArIDFdO1xuICAgICAgICBjb25zdCBpMyA9IGluZGljZXNbaSAqIDMgKyAyXTtcblxuICAgICAgICBwMS5zZXQocG9zaXRpb25zW2kxICogM10sIHBvc2l0aW9uc1tpMSAqIDMgKyAxXSwgcG9zaXRpb25zW2kxICogMyArIDJdKTtcbiAgICAgICAgcDIuc2V0KHBvc2l0aW9uc1tpMiAqIDNdLCBwb3NpdGlvbnNbaTIgKiAzICsgMV0sIHBvc2l0aW9uc1tpMiAqIDMgKyAyXSk7XG4gICAgICAgIHAzLnNldChwb3NpdGlvbnNbaTMgKiAzXSwgcG9zaXRpb25zW2kzICogMyArIDFdLCBwb3NpdGlvbnNbaTMgKiAzICsgMl0pO1xuXG4gICAgICAgIHAxcDIuc3ViMihwMiwgcDEpO1xuICAgICAgICBwMXAzLnN1YjIocDMsIHAxKTtcbiAgICAgICAgZmFjZU5vcm1hbC5jcm9zcyhwMXAyLCBwMXAzKS5ub3JtYWxpemUoKTtcblxuICAgICAgICBub3JtYWxzW2kxICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMSAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTEgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kyICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMiAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTIgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kzICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMyAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTMgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgIH1cblxuICAgIC8vIE5vcm1hbGl6ZSBhbGwgbm9ybWFsc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBueCA9IG5vcm1hbHNbaSAqIDNdO1xuICAgICAgICBjb25zdCBueSA9IG5vcm1hbHNbaSAqIDMgKyAxXTtcbiAgICAgICAgY29uc3QgbnogPSBub3JtYWxzW2kgKiAzICsgMl07XG4gICAgICAgIGNvbnN0IGludkxlbiA9IDEgLyBNYXRoLnNxcnQobnggKiBueCArIG55ICogbnkgKyBueiAqIG56KTtcbiAgICAgICAgbm9ybWFsc1tpICogM10gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMV0gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMl0gKj0gaW52TGVuO1xuICAgIH1cblxuICAgIHJldHVybiBub3JtYWxzO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB0YW5nZW50IGluZm9ybWF0aW9uIGZyb20gdGhlIHNwZWNpZmllZCBwb3NpdGlvbnMsIG5vcm1hbHMsIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kXG4gKiB0cmlhbmdsZSBpbmRpY2VzLiBTZWUge0BsaW5rIGNyZWF0ZU1lc2h9LlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHBvc2l0aW9ucy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IG5vcm1hbHMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBub3JtYWxzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gdXZzIC0gQW4gYXJyYXkgb2YgMi1kaW1lbnNpb25hbCB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlcy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IGluZGljZXMgLSBBbiBhcnJheSBvZiB0cmlhbmdsZSBpbmRpY2VzLlxuICogQHJldHVybnMge251bWJlcltdfSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCB0YW5nZW50cy5cbiAqIEBleGFtcGxlXG4gKiB2YXIgdGFuZ2VudHMgPSBwYy5jYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcyk7XG4gKiB2YXIgbWVzaCA9IHBjLmNyZWF0ZU1lc2goZ3JhcGhpY3NEZXZpY2UsIHBvc2l0aW9ucywge1xuICogICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gKiAgICAgdGFuZ2VudHM6IHRhbmdlbnRzLFxuICogICAgIHV2czogdXZzLFxuICogICAgIGluZGljZXM6IGluZGljZXNcbiAqIH0pO1xuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVUYW5nZW50cyhwb3NpdGlvbnMsIG5vcm1hbHMsIHV2cywgaW5kaWNlcykge1xuICAgIC8vIExlbmd5ZWwncyBNZXRob2RcbiAgICAvLyBodHRwOi8vd2ViLmFyY2hpdmUub3JnL3dlYi8yMDE4MDYyMDAyNDQzOS9odHRwOi8vd3d3LnRlcmF0aG9uLmNvbS9jb2RlL3RhbmdlbnQuaHRtbFxuICAgIGNvbnN0IHRyaWFuZ2xlQ291bnQgPSBpbmRpY2VzLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgdmVydGV4Q291bnQgICA9IHBvc2l0aW9ucy5sZW5ndGggLyAzO1xuICAgIGNvbnN0IHYxICAgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHYyICAgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHYzICAgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHcxICAgPSBuZXcgVmVjMigpO1xuICAgIGNvbnN0IHcyICAgPSBuZXcgVmVjMigpO1xuICAgIGNvbnN0IHczICAgPSBuZXcgVmVjMigpO1xuICAgIGNvbnN0IHNkaXIgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRkaXIgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRhbjEgPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRleENvdW50ICogMyk7XG4gICAgY29uc3QgdGFuMiA9IG5ldyBGbG9hdDMyQXJyYXkodmVydGV4Q291bnQgKiAzKTtcblxuICAgIGNvbnN0IHRhbmdlbnRzID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaWFuZ2xlQ291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBpMSA9IGluZGljZXNbaSAqIDNdO1xuICAgICAgICBjb25zdCBpMiA9IGluZGljZXNbaSAqIDMgKyAxXTtcbiAgICAgICAgY29uc3QgaTMgPSBpbmRpY2VzW2kgKiAzICsgMl07XG5cbiAgICAgICAgdjEuc2V0KHBvc2l0aW9uc1tpMSAqIDNdLCBwb3NpdGlvbnNbaTEgKiAzICsgMV0sIHBvc2l0aW9uc1tpMSAqIDMgKyAyXSk7XG4gICAgICAgIHYyLnNldChwb3NpdGlvbnNbaTIgKiAzXSwgcG9zaXRpb25zW2kyICogMyArIDFdLCBwb3NpdGlvbnNbaTIgKiAzICsgMl0pO1xuICAgICAgICB2My5zZXQocG9zaXRpb25zW2kzICogM10sIHBvc2l0aW9uc1tpMyAqIDMgKyAxXSwgcG9zaXRpb25zW2kzICogMyArIDJdKTtcblxuICAgICAgICB3MS5zZXQodXZzW2kxICogMl0sIHV2c1tpMSAqIDIgKyAxXSk7XG4gICAgICAgIHcyLnNldCh1dnNbaTIgKiAyXSwgdXZzW2kyICogMiArIDFdKTtcbiAgICAgICAgdzMuc2V0KHV2c1tpMyAqIDJdLCB1dnNbaTMgKiAyICsgMV0pO1xuXG4gICAgICAgIGNvbnN0IHgxID0gdjIueCAtIHYxLng7XG4gICAgICAgIGNvbnN0IHgyID0gdjMueCAtIHYxLng7XG4gICAgICAgIGNvbnN0IHkxID0gdjIueSAtIHYxLnk7XG4gICAgICAgIGNvbnN0IHkyID0gdjMueSAtIHYxLnk7XG4gICAgICAgIGNvbnN0IHoxID0gdjIueiAtIHYxLno7XG4gICAgICAgIGNvbnN0IHoyID0gdjMueiAtIHYxLno7XG5cbiAgICAgICAgY29uc3QgczEgPSB3Mi54IC0gdzEueDtcbiAgICAgICAgY29uc3QgczIgPSB3My54IC0gdzEueDtcbiAgICAgICAgY29uc3QgdDEgPSB3Mi55IC0gdzEueTtcbiAgICAgICAgY29uc3QgdDIgPSB3My55IC0gdzEueTtcblxuICAgICAgICBjb25zdCBhcmVhID0gczEgKiB0MiAtIHMyICogdDE7XG5cbiAgICAgICAgLy8gQXJlYSBjYW4gYmUgMCBmb3IgZGVnZW5lcmF0ZSB0cmlhbmdsZXMgb3IgYmFkIHV2IGNvb3JkaW5hdGVzXG4gICAgICAgIGlmIChhcmVhID09PSAwKSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byBkZWZhdWx0IHZhbHVlc1xuICAgICAgICAgICAgc2Rpci5zZXQoMCwgMSwgMCk7XG4gICAgICAgICAgICB0ZGlyLnNldCgxLCAwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSAxIC8gYXJlYTtcbiAgICAgICAgICAgIHNkaXIuc2V0KCh0MiAqIHgxIC0gdDEgKiB4MikgKiByLFxuICAgICAgICAgICAgICAgICAgICAgKHQyICogeTEgLSB0MSAqIHkyKSAqIHIsXG4gICAgICAgICAgICAgICAgICAgICAodDIgKiB6MSAtIHQxICogejIpICogcik7XG4gICAgICAgICAgICB0ZGlyLnNldCgoczEgKiB4MiAtIHMyICogeDEpICogcixcbiAgICAgICAgICAgICAgICAgICAgIChzMSAqIHkyIC0gczIgKiB5MSkgKiByLFxuICAgICAgICAgICAgICAgICAgICAgKHMxICogejIgLSBzMiAqIHoxKSAqIHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFuMVtpMSAqIDMgKyAwXSArPSBzZGlyLng7XG4gICAgICAgIHRhbjFbaTEgKiAzICsgMV0gKz0gc2Rpci55O1xuICAgICAgICB0YW4xW2kxICogMyArIDJdICs9IHNkaXIuejtcbiAgICAgICAgdGFuMVtpMiAqIDMgKyAwXSArPSBzZGlyLng7XG4gICAgICAgIHRhbjFbaTIgKiAzICsgMV0gKz0gc2Rpci55O1xuICAgICAgICB0YW4xW2kyICogMyArIDJdICs9IHNkaXIuejtcbiAgICAgICAgdGFuMVtpMyAqIDMgKyAwXSArPSBzZGlyLng7XG4gICAgICAgIHRhbjFbaTMgKiAzICsgMV0gKz0gc2Rpci55O1xuICAgICAgICB0YW4xW2kzICogMyArIDJdICs9IHNkaXIuejtcblxuICAgICAgICB0YW4yW2kxICogMyArIDBdICs9IHRkaXIueDtcbiAgICAgICAgdGFuMltpMSAqIDMgKyAxXSArPSB0ZGlyLnk7XG4gICAgICAgIHRhbjJbaTEgKiAzICsgMl0gKz0gdGRpci56O1xuICAgICAgICB0YW4yW2kyICogMyArIDBdICs9IHRkaXIueDtcbiAgICAgICAgdGFuMltpMiAqIDMgKyAxXSArPSB0ZGlyLnk7XG4gICAgICAgIHRhbjJbaTIgKiAzICsgMl0gKz0gdGRpci56O1xuICAgICAgICB0YW4yW2kzICogMyArIDBdICs9IHRkaXIueDtcbiAgICAgICAgdGFuMltpMyAqIDMgKyAxXSArPSB0ZGlyLnk7XG4gICAgICAgIHRhbjJbaTMgKiAzICsgMl0gKz0gdGRpci56O1xuICAgIH1cblxuICAgIGNvbnN0IHQxID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0MiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgbiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdGVtcCA9IG5ldyBWZWMzKCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleENvdW50OyBpKyspIHtcbiAgICAgICAgbi5zZXQobm9ybWFsc1tpICogM10sIG5vcm1hbHNbaSAqIDMgKyAxXSwgbm9ybWFsc1tpICogMyArIDJdKTtcbiAgICAgICAgdDEuc2V0KHRhbjFbaSAqIDNdLCB0YW4xW2kgKiAzICsgMV0sIHRhbjFbaSAqIDMgKyAyXSk7XG4gICAgICAgIHQyLnNldCh0YW4yW2kgKiAzXSwgdGFuMltpICogMyArIDFdLCB0YW4yW2kgKiAzICsgMl0pO1xuXG4gICAgICAgIC8vIEdyYW0tU2NobWlkdCBvcnRob2dvbmFsaXplXG4gICAgICAgIGNvbnN0IG5kb3R0ID0gbi5kb3QodDEpO1xuICAgICAgICB0ZW1wLmNvcHkobikubXVsU2NhbGFyKG5kb3R0KTtcbiAgICAgICAgdGVtcC5zdWIyKHQxLCB0ZW1wKS5ub3JtYWxpemUoKTtcblxuICAgICAgICB0YW5nZW50c1tpICogNF0gICAgID0gdGVtcC54O1xuICAgICAgICB0YW5nZW50c1tpICogNCArIDFdID0gdGVtcC55O1xuICAgICAgICB0YW5nZW50c1tpICogNCArIDJdID0gdGVtcC56O1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBoYW5kZWRuZXNzXG4gICAgICAgIHRlbXAuY3Jvc3MobiwgdDEpO1xuICAgICAgICB0YW5nZW50c1tpICogNCArIDNdID0gKHRlbXAuZG90KHQyKSA8IDAuMCkgPyAtMS4wIDogMS4wO1xuICAgIH1cblxuICAgIHJldHVybiB0YW5nZW50cztcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IG1lc2ggb2JqZWN0IGZyb20gdGhlIHN1cHBsaWVkIHZlcnRleCBpbmZvcm1hdGlvbiBhbmQgdG9wb2xvZ3kuXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHBvc2l0aW9ucy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLm5vcm1hbHNdIC0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggbm9ybWFscy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLnRhbmdlbnRzXSAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHRhbmdlbnRzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMuY29sb3JzXSAtIEFuIGFycmF5IG9mIDQtZGltZW5zaW9uYWwgdmVydGV4IGNvbG9ycyB3aGVyZSBlYWNoIGNvbXBvbmVudFxuICogaXMgYW4gaW50ZWdlciBpbiB0aGUgcmFuZ2UgMCB0byAyNTUuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy51dnNdIC0gQW4gYXJyYXkgb2YgMi1kaW1lbnNpb25hbCB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlcy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLnV2czFdIC0gU2FtZSBhcyBvcHRzLnV2cywgYnV0IGZvciBhZGRpdGlvbmFsIFVWIHNldFxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMuYmxlbmRJbmRpY2VzXSAtIEFuIGFycmF5IG9mIDQtZGltZW5zaW9uYWwgYm9uZSBpbmRpY2VzIHdoZXJlIGVhY2hcbiAqIGNvbXBvbmVudCBpcyBhbiBpbnRlZ2VyIGluIHRoZSByYW5nZSAwIHRvIDI1NS5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmJsZW5kV2VpZ2h0c10gLSBBbiBhcnJheSBvZiA0LWRpbWVuc2lvbmFsIGJvbmUgd2VpZ2h0cyB3aGVyZSBlYWNoXG4gKiBjb21wb25lbnQgaXMgaW4gdGhlIHJhbmdlIDAgdG8gMSBhbmQgdGhlIHN1bSBvZiB0aGUgd2VpZ2h0cyBzaG91bGQgZXF1YWwgMS5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmluZGljZXNdIC0gQW4gYXJyYXkgb2YgdHJpYW5nbGUgaW5kaWNlcy5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBNZXNoIGNvbnN0cnVjdGVkIGZyb20gdGhlIHN1cHBsaWVkIHZlcnRleCBhbmQgdHJpYW5nbGUgZGF0YS5cbiAqIEBleGFtcGxlXG4gKiAvLyBDcmVhdGUgYSBzaW1wbGUsIGluZGV4ZWQgdHJpYW5nbGUgKHdpdGggdGV4dHVyZSBjb29yZGluYXRlcyBhbmQgdmVydGV4IG5vcm1hbHMpXG4gKiB2YXIgbWVzaCA9IHBjLmNyZWF0ZU1lc2goZ3JhcGhpY3NEZXZpY2UsIFswLCAwLCAwLCAxLCAwLCAwLCAwLCAxLCAwXSwge1xuICogICAgIG5vcm1hbHM6IFswLCAwLCAxLCAwLCAwLCAxLCAwLCAwLCAxXSxcbiAqICAgICB1dnM6IFswLCAwLCAxLCAwLCAwLCAxXSxcbiAqICAgICBpbmRpY2VzOiBbMCwgMSwgMl1cbiAqIH0pO1xuICovXG5mdW5jdGlvbiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRzKSB7XG5cbiAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICBtZXNoLnNldFBvc2l0aW9ucyhwb3NpdGlvbnMpO1xuXG4gICAgaWYgKG9wdHMpIHtcbiAgICAgICAgaWYgKG9wdHMubm9ybWFscykge1xuICAgICAgICAgICAgbWVzaC5zZXROb3JtYWxzKG9wdHMubm9ybWFscyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy50YW5nZW50cykge1xuICAgICAgICAgICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfVEFOR0VOVCwgb3B0cy50YW5nZW50cywgNCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5jb2xvcnMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0Q29sb3JzMzIob3B0cy5jb2xvcnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMudXZzKSB7XG4gICAgICAgICAgICBtZXNoLnNldFV2cygwLCBvcHRzLnV2cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy51dnMxKSB7XG4gICAgICAgICAgICBtZXNoLnNldFV2cygxLCBvcHRzLnV2czEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuYmxlbmRJbmRpY2VzKSB7XG4gICAgICAgICAgICBtZXNoLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19CTEVORElORElDRVMsIG9wdHMuYmxlbmRJbmRpY2VzLCA0LCBvcHRzLmJsZW5kSW5kaWNlcy5sZW5ndGggLyA0LCBUWVBFX1VJTlQ4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmJsZW5kV2VpZ2h0cykge1xuICAgICAgICAgICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQkxFTkRXRUlHSFQsIG9wdHMuYmxlbmRXZWlnaHRzLCA0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmluZGljZXMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0SW5kaWNlcyhvcHRzLmluZGljZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWVzaC51cGRhdGUoKTtcbiAgICByZXR1cm4gbWVzaDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCB0b3J1cy1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIHRvcnVzIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvblxuICogcGFyYW1ldGVycy4gQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgdG9ydXMgaW4gdGhlIFhaLXBsYW5lIHdpdGggYSB0dWJlIHJhZGl1cyBvZlxuICogMC4yLCBhIHJpbmcgcmFkaXVzIG9mIDAuMywgMjAgc2VnbWVudHMgYW5kIDMwIHNpZGVzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgdG9ydXMgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSB0b3J1cydzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy50dWJlUmFkaXVzXSAtIFRoZSByYWRpdXMgb2YgdGhlIHR1YmUgZm9ybWluZyB0aGUgYm9keSBvZiB0aGUgdG9ydXNcbiAqIChkZWZhdWx0cyB0byAwLjIpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJpbmdSYWRpdXNdIC0gVGhlIHJhZGl1cyBmcm9tIHRoZSBjZW50cmUgb2YgdGhlIHRvcnVzIHRvIHRoZSBjZW50cmUgb2YgdGhlXG4gKiB0dWJlIChkZWZhdWx0cyB0byAwLjMpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgcmFkaWFsIGRpdmlzaW9ucyBmb3JtaW5nIGNyb3NzLXNlY3Rpb25zIG9mIHRoZVxuICogdG9ydXMgcmluZyAoZGVmYXVsdHMgdG8gMjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnNpZGVzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFyb3VuZCB0aGUgdHVidWxhciBib2R5IG9mIHRoZSB0b3J1cyByaW5nXG4gKiAoZGVmYXVsdHMgdG8gMzApLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgdG9ydXMtc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVRvcnVzKGRldmljZSwgb3B0cykge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgcmMgPSBvcHRzICYmIG9wdHMudHViZVJhZGl1cyAhPT0gdW5kZWZpbmVkID8gb3B0cy50dWJlUmFkaXVzIDogMC4yO1xuICAgIGNvbnN0IHJ0ID0gb3B0cyAmJiBvcHRzLnJpbmdSYWRpdXMgIT09IHVuZGVmaW5lZCA/IG9wdHMucmluZ1JhZGl1cyA6IDAuMztcbiAgICBjb25zdCBzZWdtZW50cyA9IG9wdHMgJiYgb3B0cy5zZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5zZWdtZW50cyA6IDMwO1xuICAgIGNvbnN0IHNpZGVzID0gb3B0cyAmJiBvcHRzLnNpZGVzICE9PSB1bmRlZmluZWQgPyBvcHRzLnNpZGVzIDogMjA7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cyAmJiBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzIDogZmFsc2U7XG5cbiAgICAvLyBWYXJpYWJsZSBkZWNsYXJhdGlvbnNcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gc2lkZXM7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8PSBzZWdtZW50czsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCB4ID0gTWF0aC5jb3MoMiAqIE1hdGguUEkgKiBqIC8gc2VnbWVudHMpICogKHJ0ICsgcmMgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcykpO1xuICAgICAgICAgICAgY29uc3QgeSA9IE1hdGguc2luKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKSAqIHJjO1xuICAgICAgICAgICAgY29uc3QgeiA9IE1hdGguc2luKDIgKiBNYXRoLlBJICogaiAvIHNlZ21lbnRzKSAqIChydCArIHJjICogTWF0aC5jb3MoMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpKTtcblxuICAgICAgICAgICAgY29uc3QgbnggPSBNYXRoLmNvcygyICogTWF0aC5QSSAqIGogLyBzZWdtZW50cykgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcyk7XG4gICAgICAgICAgICBjb25zdCBueSA9IE1hdGguc2luKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKTtcbiAgICAgICAgICAgIGNvbnN0IG56ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBqIC8gc2VnbWVudHMpICogTWF0aC5jb3MoMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpO1xuXG4gICAgICAgICAgICBjb25zdCB1ID0gaSAvIHNpZGVzO1xuICAgICAgICAgICAgY29uc3QgdiA9IDEgLSBqIC8gc2VnbWVudHM7XG5cbiAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgbm9ybWFscy5wdXNoKG54LCBueSwgbnopO1xuICAgICAgICAgICAgdXZzLnB1c2godSwgMS4wIC0gdik7XG5cbiAgICAgICAgICAgIGlmICgoaSA8IHNpZGVzKSAmJiAoaiA8IHNlZ21lbnRzKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICA9ICgoaSkpICAgICAqIChzZWdtZW50cyArIDEpICsgKChqKSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gKChpICsgMSkpICogKHNlZ21lbnRzICsgMSkgKyAoKGopKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0aGlyZCAgPSAoKGkpKSAgICAgKiAoc2VnbWVudHMgKyAxKSArICgoaiArIDEpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VydGggPSAoKGkgKyAxKSkgKiAoc2VnbWVudHMgKyAxKSArICgoaiArIDEpKTtcblxuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChmaXJzdCwgc2Vjb25kLCB0aGlyZCk7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHNlY29uZCwgZm91cnRoLCB0aGlyZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzLFxuICAgICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gICAgfTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIHBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVDb25lRGF0YShiYXNlUmFkaXVzLCBwZWFrUmFkaXVzLCBoZWlnaHQsIGhlaWdodFNlZ21lbnRzLCBjYXBTZWdtZW50cywgcm91bmRlZENhcHMpIHtcbiAgICAvLyBWYXJpYWJsZSBkZWNsYXJhdGlvbnNcbiAgICBjb25zdCBwb3MgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IGJvdHRvbVRvVG9wID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBub3JtID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0b3AgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IGJvdHRvbSA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdGFuZ2VudCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcG9zaXRpb25zID0gW107XG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuICAgIGNvbnN0IHV2cyA9IFtdO1xuICAgIGNvbnN0IHV2czEgPSBbXTtcbiAgICBjb25zdCBpbmRpY2VzID0gW107XG4gICAgbGV0IG9mZnNldDtcblxuICAgIC8vIERlZmluZSB0aGUgYm9keSBvZiB0aGUgY29uZS9jeWxpbmRlclxuICAgIGlmIChoZWlnaHQgPiAwKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IGhlaWdodFNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IGNhcFNlZ21lbnRzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAvLyBTd2VlcCB0aGUgY29uZSBib2R5IGZyb20gdGhlIHBvc2l0aXZlIFkgYXhpcyB0byBtYXRjaCBhIDNEUyBNYXggY29uZS9jeWxpbmRlclxuICAgICAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGogLyBjYXBTZWdtZW50cykgKiAyICogTWF0aC5QSSAtIE1hdGguUEk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNpbih0aGV0YSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29zVGhldGEgPSBNYXRoLmNvcyh0aGV0YSk7XG4gICAgICAgICAgICAgICAgYm90dG9tLnNldChzaW5UaGV0YSAqIGJhc2VSYWRpdXMsIC1oZWlnaHQgLyAyLCBjb3NUaGV0YSAqIGJhc2VSYWRpdXMpO1xuICAgICAgICAgICAgICAgIHRvcC5zZXQoc2luVGhldGEgKiBwZWFrUmFkaXVzLCBoZWlnaHQgLyAyLCBjb3NUaGV0YSAqIHBlYWtSYWRpdXMpO1xuICAgICAgICAgICAgICAgIHBvcy5sZXJwKGJvdHRvbSwgdG9wLCBpIC8gaGVpZ2h0U2VnbWVudHMpO1xuICAgICAgICAgICAgICAgIGJvdHRvbVRvVG9wLnN1YjIodG9wLCBib3R0b20pLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgICAgIHRhbmdlbnQuc2V0KGNvc1RoZXRhLCAwLCAtc2luVGhldGEpO1xuICAgICAgICAgICAgICAgIG5vcm0uY3Jvc3ModGFuZ2VudCwgYm90dG9tVG9Ub3ApLm5vcm1hbGl6ZSgpO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2gocG9zLngsIHBvcy55LCBwb3Mueik7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKG5vcm0ueCwgbm9ybS55LCBub3JtLnopO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gaiAvIGNhcFNlZ21lbnRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gaSAvIGhlaWdodFNlZ21lbnRzO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDFzdCB0aGlyZFxuICAgICAgICAgICAgICAgIGNvbnN0IF92ID0gdjtcbiAgICAgICAgICAgICAgICB2ID0gdTtcbiAgICAgICAgICAgICAgICB1ID0gX3Y7XG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIGlmICgoaSA8IGhlaWdodFNlZ21lbnRzKSAmJiAoaiA8IGNhcFNlZ21lbnRzKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaXJzdCAgID0gKChpKSkgICAgICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGopKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Vjb25kICA9ICgoaSkpICAgICAqIChjYXBTZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0aGlyZCAgID0gKChpICsgMSkpICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGopKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm91cnRoICA9ICgoaSArIDEpKSAqIChjYXBTZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChmaXJzdCwgc2Vjb25kLCB0aGlyZCk7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChzZWNvbmQsIGZvdXJ0aCwgdGhpcmQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChyb3VuZGVkQ2Fwcykge1xuICAgICAgICBjb25zdCBsYXRpdHVkZUJhbmRzID0gTWF0aC5mbG9vcihjYXBTZWdtZW50cyAvIDIpO1xuICAgICAgICBjb25zdCBsb25naXR1ZGVCYW5kcyA9IGNhcFNlZ21lbnRzO1xuICAgICAgICBjb25zdCBjYXBPZmZzZXQgPSBoZWlnaHQgLyAyO1xuXG4gICAgICAgIC8vIEdlbmVyYXRlIHRvcCBjYXBcbiAgICAgICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDw9IGxhdGl0dWRlQmFuZHM7IGxhdCsrKSB7XG4gICAgICAgICAgICBjb25zdCB0aGV0YSA9IChsYXQgKiBNYXRoLlBJICogMC41KSAvIGxhdGl0dWRlQmFuZHM7XG4gICAgICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5jb3ModGhldGEpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPD0gbG9uZ2l0dWRlQmFuZHM7IGxvbisrKSB7XG4gICAgICAgICAgICAgICAgLy8gU3dlZXAgdGhlIHNwaGVyZSBmcm9tIHRoZSBwb3NpdGl2ZSBaIGF4aXMgdG8gbWF0Y2ggYSAzRFMgTWF4IHNwaGVyZVxuICAgICAgICAgICAgICAgIGNvbnN0IHBoaSA9IGxvbiAqIDIgKiBNYXRoLlBJIC8gbG9uZ2l0dWRlQmFuZHMgLSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgICAgICBjb25zdCBzaW5QaGkgPSBNYXRoLnNpbihwaGkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvc1BoaSA9IE1hdGguY29zKHBoaSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gY29zUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IGNvc1RoZXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBzaW5QaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSBsb24gLyBsb25naXR1ZGVCYW5kcztcbiAgICAgICAgICAgICAgICBsZXQgdiA9IDEgLSBsYXQgLyBsYXRpdHVkZUJhbmRzO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIHBlYWtSYWRpdXMsIHkgKiBwZWFrUmFkaXVzICsgY2FwT2Zmc2V0LCB6ICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDJuZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDEuMCAvIDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9mZnNldCA9IChoZWlnaHRTZWdtZW50cyArIDEpICogKGNhcFNlZ21lbnRzICsgMSk7XG4gICAgICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8IGxhdGl0dWRlQmFuZHM7ICsrbGF0KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPCBsb25naXR1ZGVCYW5kczsgKytsb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXJzdCAgPSAobGF0ICogKGxvbmdpdHVkZUJhbmRzICsgMSkpICsgbG9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9IGZpcnN0ICsgbG9uZ2l0dWRlQmFuZHMgKyAxO1xuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kLCBvZmZzZXQgKyBmaXJzdCk7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kICsgMSwgb2Zmc2V0ICsgc2Vjb25kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIGJvdHRvbSBjYXBcbiAgICAgICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDw9IGxhdGl0dWRlQmFuZHM7IGxhdCsrKSB7XG4gICAgICAgICAgICBjb25zdCB0aGV0YSA9IE1hdGguUEkgKiAwLjUgKyAobGF0ICogTWF0aC5QSSAqIDAuNSkgLyBsYXRpdHVkZUJhbmRzO1xuICAgICAgICAgICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNpbih0aGV0YSk7XG4gICAgICAgICAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguY29zKHRoZXRhKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDw9IGxvbmdpdHVkZUJhbmRzOyBsb24rKykge1xuICAgICAgICAgICAgICAgIC8vIFN3ZWVwIHRoZSBzcGhlcmUgZnJvbSB0aGUgcG9zaXRpdmUgWiBheGlzIHRvIG1hdGNoIGEgM0RTIE1heCBzcGhlcmVcbiAgICAgICAgICAgICAgICBjb25zdCBwaGkgPSBsb24gKiAyICogTWF0aC5QSSAvIGxvbmdpdHVkZUJhbmRzIC0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2luUGhpID0gTWF0aC5zaW4ocGhpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb3NQaGkgPSBNYXRoLmNvcyhwaGkpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IGNvc1BoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSBjb3NUaGV0YTtcbiAgICAgICAgICAgICAgICBjb25zdCB6ID0gc2luUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSAxIC0gbG9uIC8gbG9uZ2l0dWRlQmFuZHM7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSAxIC0gbGF0IC8gbGF0aXR1ZGVCYW5kcztcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiBwZWFrUmFkaXVzLCB5ICogcGVha1JhZGl1cyAtIGNhcE9mZnNldCwgeiAqIHBlYWtSYWRpdXMpO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaCh4LCB5LCB6KTtcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBQYWNrIFVWMSB0byAzcmQgdGhpcmRcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB2IC89IDM7XG4gICAgICAgICAgICAgICAgdSArPSAyLjAgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBvZmZzZXQgPSAoaGVpZ2h0U2VnbWVudHMgKyAxKSAqIChjYXBTZWdtZW50cyArIDEpICsgKGxvbmdpdHVkZUJhbmRzICsgMSkgKiAobGF0aXR1ZGVCYW5kcyArIDEpO1xuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPCBsYXRpdHVkZUJhbmRzOyArK2xhdCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDwgbG9uZ2l0dWRlQmFuZHM7ICsrbG9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3QgID0gKGxhdCAqIChsb25naXR1ZGVCYW5kcyArIDEpKSArIGxvbjtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgPSBmaXJzdCArIGxvbmdpdHVkZUJhbmRzICsgMTtcblxuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChvZmZzZXQgKyBmaXJzdCArIDEsIG9mZnNldCArIHNlY29uZCwgb2Zmc2V0ICsgZmlyc3QpO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChvZmZzZXQgKyBmaXJzdCArIDEsIG9mZnNldCArIHNlY29uZCArIDEsIG9mZnNldCArIHNlY29uZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBHZW5lcmF0ZSBib3R0b20gY2FwXG4gICAgICAgIG9mZnNldCA9IChoZWlnaHRTZWdtZW50cyArIDEpICogKGNhcFNlZ21lbnRzICsgMSk7XG4gICAgICAgIGlmIChiYXNlUmFkaXVzID4gMCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYXBTZWdtZW50czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGhldGEgPSAoaSAvIGNhcFNlZ21lbnRzKSAqIDIgKiBNYXRoLlBJO1xuICAgICAgICAgICAgICAgIGNvbnN0IHggPSBNYXRoLnNpbih0aGV0YSk7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IC1oZWlnaHQgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBNYXRoLmNvcyh0aGV0YSk7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSAxIC0gKHggKyAxKSAvIDI7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSAoeiArIDEpIC8gMjtcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiBiYXNlUmFkaXVzLCB5LCB6ICogYmFzZVJhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKDAsIC0xLCAwKTtcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBQYWNrIFVWMSB0byAybmQgdGhpcmRcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB2IC89IDM7XG4gICAgICAgICAgICAgICAgdSArPSAxIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChvZmZzZXQsIG9mZnNldCArIGksIG9mZnNldCArIGkgLSAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSB0b3AgY2FwXG4gICAgICAgIG9mZnNldCArPSBjYXBTZWdtZW50cztcbiAgICAgICAgaWYgKHBlYWtSYWRpdXMgPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcFNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0aGV0YSA9IChpIC8gY2FwU2VnbWVudHMpICogMiAqIE1hdGguUEk7XG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gaGVpZ2h0IC8gMjtcbiAgICAgICAgICAgICAgICBjb25zdCB6ID0gTWF0aC5jb3ModGhldGEpO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gMSAtICh4ICsgMSkgLyAyO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gKHogKyAxKSAvIDI7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4ICogcGVha1JhZGl1cywgeSwgeiAqIHBlYWtSYWRpdXMpO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaCgwLCAxLCAwKTtcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBQYWNrIFVWMSB0byAzcmQgdGhpcmRcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB2IC89IDM7XG4gICAgICAgICAgICAgICAgdSArPSAyIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChvZmZzZXQsIG9mZnNldCArIGkgLSAxLCBvZmZzZXQgKyBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBwb3NpdGlvbnM6IHBvc2l0aW9ucyxcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2czEsXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIGN5bGluZGVyLXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplLCBzaGFwZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgY3lsaW5kZXIgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uXG4gKiBwYXJhbWV0ZXJzLiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBjeWxpbmRlciBzdGFuZGluZyB2ZXJ0aWNhbGx5IGNlbnRlcmVkIG9uIHRoZVxuICogWFotcGxhbmUgd2l0aCBhIHJhZGl1cyBvZiAwLjUsIGEgaGVpZ2h0IG9mIDEuMCwgMSBoZWlnaHQgc2VnbWVudCBhbmQgMjAgY2FwIHNlZ21lbnRzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgY3lsaW5kZXIgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBjeWxpbmRlcidzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5yYWRpdXNdIC0gVGhlIHJhZGl1cyBvZiB0aGUgdHViZSBmb3JtaW5nIHRoZSBib2R5IG9mIHRoZSBjeWxpbmRlclxuICogKGRlZmF1bHRzIHRvIDAuNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0XSAtIFRoZSBsZW5ndGggb2YgdGhlIGJvZHkgb2YgdGhlIGN5bGluZGVyIChkZWZhdWx0cyB0byAxLjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBsZW5ndGggb2YgdGhlIGN5bGluZGVyXG4gKiAoZGVmYXVsdHMgdG8gNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuY2FwU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYXJvdW5kIHRoZSB0dWJ1bGFyIGJvZHkgb2YgdGhlXG4gKiBjeWxpbmRlciAoZGVmYXVsdHMgdG8gMjApLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgY3lsaW5kZXItc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUN5bGluZGVyKGRldmljZSwgb3B0cykge1xuICAgIC8vICNpZiBfREVCVUdcbiAgICBpZiAob3B0cyAmJiBvcHRzLmhhc093blByb3BlcnR5KCdiYXNlUmFkaXVzJykgJiYgIW9wdHMuaGFzT3duUHJvcGVydHkoJ3JhZGl1cycpKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ1wiYmFzZVJhZGl1c1wiIGluIGFyZ3VtZW50cywgdXNlIFwicmFkaXVzXCIgaW5zdGVhZCcpO1xuICAgIH1cbiAgICAvLyAjZW5kaWZcblxuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgbGV0IHJhZGl1cyA9IG9wdHMgJiYgKG9wdHMucmFkaXVzIHx8IG9wdHMuYmFzZVJhZGl1cyk7XG4gICAgcmFkaXVzID0gcmFkaXVzICE9PSB1bmRlZmluZWQgPyByYWRpdXMgOiAwLjU7XG4gICAgY29uc3QgaGVpZ2h0ID0gb3B0cyAmJiBvcHRzLmhlaWdodCAhPT0gdW5kZWZpbmVkID8gb3B0cy5oZWlnaHQgOiAxLjA7XG4gICAgY29uc3QgaGVpZ2h0U2VnbWVudHMgPSBvcHRzICYmIG9wdHMuaGVpZ2h0U2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGVpZ2h0U2VnbWVudHMgOiA1O1xuICAgIGNvbnN0IGNhcFNlZ21lbnRzID0gb3B0cyAmJiBvcHRzLmNhcFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhcFNlZ21lbnRzIDogMjA7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cyAmJiBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzIDogZmFsc2U7XG5cbiAgICAvLyBDcmVhdGUgdmVydGV4IGRhdGEgZm9yIGEgY29uZSB0aGF0IGhhcyBhIGJhc2UgYW5kIHBlYWsgcmFkaXVzIHRoYXQgaXMgdGhlIHNhbWUgKGkuZS4gYSBjeWxpbmRlcilcbiAgICBjb25zdCBvcHRpb25zID0gX2NyZWF0ZUNvbmVEYXRhKHJhZGl1cywgcmFkaXVzLCBoZWlnaHQsIGhlaWdodFNlZ21lbnRzLCBjYXBTZWdtZW50cywgZmFsc2UpO1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMob3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMubm9ybWFscywgb3B0aW9ucy51dnMsIG9wdGlvbnMuaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgY2Fwc3VsZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIGNhcHN1bGUgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uXG4gKiBwYXJhbWV0ZXJzLiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBjYXBzdWxlIHN0YW5kaW5nIHZlcnRpY2FsbHkgY2VudGVyZWQgb24gdGhlXG4gKiBYWi1wbGFuZSB3aXRoIGEgcmFkaXVzIG9mIDAuMjUsIGEgaGVpZ2h0IG9mIDEuMCwgMSBoZWlnaHQgc2VnbWVudCBhbmQgMTAgY2FwIHNlZ21lbnRzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgY2Fwc3VsZSBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGNhcHN1bGUncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMucmFkaXVzXSAtIFRoZSByYWRpdXMgb2YgdGhlIHR1YmUgZm9ybWluZyB0aGUgYm9keSBvZiB0aGUgY2Fwc3VsZSAoZGVmYXVsdHNcbiAqIHRvIDAuMykuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0XSAtIFRoZSBsZW5ndGggb2YgdGhlIGJvZHkgb2YgdGhlIGNhcHN1bGUgZnJvbSB0aXAgdG8gdGlwIChkZWZhdWx0c1xuICogdG8gMS4wKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgdHVidWxhciBsZW5ndGggb2YgdGhlXG4gKiBjYXBzdWxlIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5zaWRlc10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhcm91bmQgdGhlIHR1YnVsYXIgYm9keSBvZiB0aGUgY2Fwc3VsZVxuICogKGRlZmF1bHRzIHRvIDIwKS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IGN5bGluZGVyLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVDYXBzdWxlKGRldmljZSwgb3B0cykge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgcmFkaXVzID0gb3B0cyAmJiBvcHRzLnJhZGl1cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5yYWRpdXMgOiAwLjM7XG4gICAgY29uc3QgaGVpZ2h0ID0gb3B0cyAmJiBvcHRzLmhlaWdodCAhPT0gdW5kZWZpbmVkID8gb3B0cy5oZWlnaHQgOiAxLjA7XG4gICAgY29uc3QgaGVpZ2h0U2VnbWVudHMgPSBvcHRzICYmIG9wdHMuaGVpZ2h0U2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGVpZ2h0U2VnbWVudHMgOiAxO1xuICAgIGNvbnN0IHNpZGVzID0gb3B0cyAmJiBvcHRzLnNpZGVzICE9PSB1bmRlZmluZWQgPyBvcHRzLnNpZGVzIDogMjA7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cyAmJiBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzIDogZmFsc2U7XG5cbiAgICAvLyBDcmVhdGUgdmVydGV4IGRhdGEgZm9yIGEgY29uZSB0aGF0IGhhcyBhIGJhc2UgYW5kIHBlYWsgcmFkaXVzIHRoYXQgaXMgdGhlIHNhbWUgKGkuZS4gYSBjeWxpbmRlcilcbiAgICBjb25zdCBvcHRpb25zID0gX2NyZWF0ZUNvbmVEYXRhKHJhZGl1cywgcmFkaXVzLCBoZWlnaHQgLSAyICogcmFkaXVzLCBoZWlnaHRTZWdtZW50cywgc2lkZXMsIHRydWUpO1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMob3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMubm9ybWFscywgb3B0aW9ucy51dnMsIG9wdGlvbnMuaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgY29uZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIGNvbmUgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uXG4gKiBwYXJhbWV0ZXJzLiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBjb25lIHN0YW5kaW5nIHZlcnRpY2FsbHkgY2VudGVyZWQgb24gdGhlXG4gKiBYWi1wbGFuZSB3aXRoIGEgYmFzZSByYWRpdXMgb2YgMC41LCBhIGhlaWdodCBvZiAxLjAsIDUgaGVpZ2h0IHNlZ21lbnRzIGFuZCAyMCBjYXAgc2VnbWVudHMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBjb25lIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50IGluZm9ybWF0aW9uXG4gKiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgY29uZSdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5iYXNlUmFkaXVzXSAtIFRoZSBiYXNlIHJhZGl1cyBvZiB0aGUgY29uZSAoZGVmYXVsdHMgdG8gMC41KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5wZWFrUmFkaXVzXSAtIFRoZSBwZWFrIHJhZGl1cyBvZiB0aGUgY29uZSAoZGVmYXVsdHMgdG8gMC4wKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRdIC0gVGhlIGxlbmd0aCBvZiB0aGUgYm9keSBvZiB0aGUgY29uZSAoZGVmYXVsdHMgdG8gMS4wKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgbGVuZ3RoIG9mIHRoZSBjb25lXG4gKiAoZGVmYXVsdHMgdG8gNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuY2FwU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYXJvdW5kIHRoZSB0dWJ1bGFyIGJvZHkgb2YgdGhlIGNvbmVcbiAqIChkZWZhdWx0cyB0byAxOCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBjb25lLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVDb25lKGRldmljZSwgb3B0cykge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgYmFzZVJhZGl1cyA9IG9wdHMgJiYgb3B0cy5iYXNlUmFkaXVzICE9PSB1bmRlZmluZWQgPyBvcHRzLmJhc2VSYWRpdXMgOiAwLjU7XG4gICAgY29uc3QgcGVha1JhZGl1cyA9IG9wdHMgJiYgb3B0cy5wZWFrUmFkaXVzICE9PSB1bmRlZmluZWQgPyBvcHRzLnBlYWtSYWRpdXMgOiAwLjA7XG4gICAgY29uc3QgaGVpZ2h0ID0gb3B0cyAmJiBvcHRzLmhlaWdodCAhPT0gdW5kZWZpbmVkID8gb3B0cy5oZWlnaHQgOiAxLjA7XG4gICAgY29uc3QgaGVpZ2h0U2VnbWVudHMgPSBvcHRzICYmIG9wdHMuaGVpZ2h0U2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGVpZ2h0U2VnbWVudHMgOiA1O1xuICAgIGNvbnN0IGNhcFNlZ21lbnRzID0gb3B0cyAmJiBvcHRzLmNhcFNlZ21lbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhcFNlZ21lbnRzIDogMTg7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cyAmJiBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzIDogZmFsc2U7XG5cbiAgICBjb25zdCBvcHRpb25zID0gX2NyZWF0ZUNvbmVEYXRhKGJhc2VSYWRpdXMsIHBlYWtSYWRpdXMsIGhlaWdodCwgaGVpZ2h0U2VnbWVudHMsIGNhcFNlZ21lbnRzLCBmYWxzZSk7XG5cbiAgICBpZiAoY2FsY1RhbmdlbnRzKSB7XG4gICAgICAgIG9wdGlvbnMudGFuZ2VudHMgPSBjYWxjdWxhdGVUYW5nZW50cyhvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucy5ub3JtYWxzLCBvcHRpb25zLnV2cywgb3B0aW9ucy5pbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBzcGhlcmUtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIHNwaGVyZSBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb24gcGFyYW1ldGVycy4gQnlcbiAqIGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIHNwaGVyZSBjZW50ZXJlZCBvbiB0aGUgb2JqZWN0IHNwYWNlIG9yaWdpbiB3aXRoIGEgcmFkaXVzIG9mXG4gKiAwLjUgYW5kIDE2IHNlZ21lbnRzIGluIGJvdGggbG9uZ2l0dWRlIGFuZCBsYXRpdHVkZS5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHNwaGVyZSBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIHNwaGVyZSdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5yYWRpdXNdIC0gVGhlIHJhZGl1cyBvZiB0aGUgc3BoZXJlIChkZWZhdWx0cyB0byAwLjUpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmxhdGl0dWRlQmFuZHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIGxhdGl0dWRpbmFsIGF4aXMgb2YgdGhlXG4gKiBzcGhlcmUgKGRlZmF1bHRzIHRvIDE2KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5sb25naXR1ZGVCYW5kc10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgbG9uZ2l0dWRpbmFsIGF4aXMgb2ZcbiAqIHRoZSBzcGhlcmUgKGRlZmF1bHRzIHRvIDE2KS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IHNwaGVyZS1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlU3BoZXJlKGRldmljZSwgb3B0cykge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgcmFkaXVzID0gb3B0cyAmJiBvcHRzLnJhZGl1cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5yYWRpdXMgOiAwLjU7XG4gICAgY29uc3QgbGF0aXR1ZGVCYW5kcyA9IG9wdHMgJiYgb3B0cy5sYXRpdHVkZUJhbmRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmxhdGl0dWRlQmFuZHMgOiAxNjtcbiAgICBjb25zdCBsb25naXR1ZGVCYW5kcyA9IG9wdHMgJiYgb3B0cy5sb25naXR1ZGVCYW5kcyAhPT0gdW5kZWZpbmVkID8gb3B0cy5sb25naXR1ZGVCYW5kcyA6IDE2O1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMgJiYgb3B0cy5jYWxjdWxhdGVUYW5nZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA6IGZhbHNlO1xuXG4gICAgLy8gVmFyaWFibGUgZGVjbGFyYXRpb25zXG4gICAgY29uc3QgcG9zaXRpb25zID0gW107XG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuICAgIGNvbnN0IHV2cyA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcblxuICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8PSBsYXRpdHVkZUJhbmRzOyBsYXQrKykge1xuICAgICAgICBjb25zdCB0aGV0YSA9IGxhdCAqIE1hdGguUEkgLyBsYXRpdHVkZUJhbmRzO1xuICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgY29uc3QgY29zVGhldGEgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDw9IGxvbmdpdHVkZUJhbmRzOyBsb24rKykge1xuICAgICAgICAgICAgLy8gU3dlZXAgdGhlIHNwaGVyZSBmcm9tIHRoZSBwb3NpdGl2ZSBaIGF4aXMgdG8gbWF0Y2ggYSAzRFMgTWF4IHNwaGVyZVxuICAgICAgICAgICAgY29uc3QgcGhpID0gbG9uICogMiAqIE1hdGguUEkgLyBsb25naXR1ZGVCYW5kcyAtIE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgY29uc3Qgc2luUGhpID0gTWF0aC5zaW4ocGhpKTtcbiAgICAgICAgICAgIGNvbnN0IGNvc1BoaSA9IE1hdGguY29zKHBoaSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHggPSBjb3NQaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgIGNvbnN0IHkgPSBjb3NUaGV0YTtcbiAgICAgICAgICAgIGNvbnN0IHogPSBzaW5QaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgIGNvbnN0IHUgPSAxIC0gbG9uIC8gbG9uZ2l0dWRlQmFuZHM7XG4gICAgICAgICAgICBjb25zdCB2ID0gMSAtIGxhdCAvIGxhdGl0dWRlQmFuZHM7XG5cbiAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiByYWRpdXMsIHkgKiByYWRpdXMsIHogKiByYWRpdXMpO1xuICAgICAgICAgICAgbm9ybWFscy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDwgbGF0aXR1ZGVCYW5kczsgKytsYXQpIHtcbiAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDwgbG9uZ2l0dWRlQmFuZHM7ICsrbG9uKSB7XG4gICAgICAgICAgICBjb25zdCBmaXJzdCAgPSAobGF0ICogKGxvbmdpdHVkZUJhbmRzICsgMSkpICsgbG9uO1xuICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gZmlyc3QgKyBsb25naXR1ZGVCYW5kcyArIDE7XG5cbiAgICAgICAgICAgIGluZGljZXMucHVzaChmaXJzdCArIDEsIHNlY29uZCwgZmlyc3QpO1xuICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0ICsgMSwgc2Vjb25kICsgMSwgc2Vjb25kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMsIC8vIFVWMSA9IFVWMCBmb3Igc3BoZXJlXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBwbGFuZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgcGxhbmUgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uIHBhcmFtZXRlcnMuIEJ5XG4gKiBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBwbGFuZSBjZW50ZXJlZCBvbiB0aGUgb2JqZWN0IHNwYWNlIG9yaWdpbiB3aXRoIGEgd2lkdGggYW5kXG4gKiBsZW5ndGggb2YgMS4wIGFuZCA1IHNlZ21lbnRzIGluIGVpdGhlciBheGlzICg1MCB0cmlhbmdsZXMpLiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgcGxhbmUgaXNcbiAqIGFsaWduZWQgYWxvbmcgdGhlIHBvc2l0aXZlIFkgYXhpcy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHBsYW5lIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgcGxhbmUncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge1ZlYzJ9IFtvcHRzLmhhbGZFeHRlbnRzXSAtIFRoZSBoYWxmIGRpbWVuc2lvbnMgb2YgdGhlIHBsYW5lIGluIHRoZSBYIGFuZCBaIGF4ZXNcbiAqIChkZWZhdWx0cyB0byBbMC41LCAwLjVdKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy53aWR0aFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBYIGF4aXMgb2YgdGhlIHBsYW5lXG4gKiAoZGVmYXVsdHMgdG8gNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubGVuZ3RoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFogYXhpcyBvZiB0aGUgcGxhbmVcbiAqIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IHBsYW5lLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVQbGFuZShkZXZpY2UsIG9wdHMpIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IGhlID0gb3B0cyAmJiBvcHRzLmhhbGZFeHRlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmhhbGZFeHRlbnRzIDogbmV3IFZlYzIoMC41LCAwLjUpO1xuICAgIGNvbnN0IHdzID0gb3B0cyAmJiBvcHRzLndpZHRoU2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMud2lkdGhTZWdtZW50cyA6IDU7XG4gICAgY29uc3QgbHMgPSBvcHRzICYmIG9wdHMubGVuZ3RoU2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMubGVuZ3RoU2VnbWVudHMgOiA1O1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMgJiYgb3B0cy5jYWxjdWxhdGVUYW5nZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA6IGZhbHNlO1xuXG4gICAgLy8gVmFyaWFibGUgZGVjbGFyYXRpb25zXG4gICAgY29uc3QgcG9zaXRpb25zID0gW107XG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuICAgIGNvbnN0IHV2cyA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcblxuICAgIC8vIEdlbmVyYXRlIHBsYW5lIGFzIGZvbGxvd3MgKGFzc2lnbmVkIFVWcyBkZW5vdGVkIGF0IGNvcm5lcnMpOlxuICAgIC8vICgwLDEpeC0tLS0tLS0tLXgoMSwxKVxuICAgIC8vICAgICAgfCAgICAgICAgIHxcbiAgICAvLyAgICAgIHwgICAgICAgICB8XG4gICAgLy8gICAgICB8ICAgIE8tLVggfGxlbmd0aFxuICAgIC8vICAgICAgfCAgICB8ICAgIHxcbiAgICAvLyAgICAgIHwgICAgWiAgICB8XG4gICAgLy8gKDAsMCl4LS0tLS0tLS0teCgxLDApXG4gICAgLy8gd2lkdGhcbiAgICBsZXQgdmNvdW50ZXIgPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gd3M7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8PSBsczsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCB4ID0gLWhlLnggKyAyICogaGUueCAqIGkgLyB3cztcbiAgICAgICAgICAgIGNvbnN0IHkgPSAwLjA7XG4gICAgICAgICAgICBjb25zdCB6ID0gLSgtaGUueSArIDIgKiBoZS55ICogaiAvIGxzKTtcbiAgICAgICAgICAgIGNvbnN0IHUgPSBpIC8gd3M7XG4gICAgICAgICAgICBjb25zdCB2ID0gaiAvIGxzO1xuXG4gICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4LCB5LCB6KTtcbiAgICAgICAgICAgIG5vcm1hbHMucHVzaCgwLCAxLCAwKTtcbiAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgaWYgKChpIDwgd3MpICYmIChqIDwgbHMpKSB7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZjb3VudGVyICsgbHMgKyAxLCB2Y291bnRlciArIDEsIHZjb3VudGVyKTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2godmNvdW50ZXIgKyBscyArIDEsIHZjb3VudGVyICsgbHMgKyAyLCB2Y291bnRlciArIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2Y291bnRlcisrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2cywgLy8gVVYxID0gVVYwIGZvciBwbGFuZVxuICAgICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gICAgfTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIHBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgYm94LXNoYXBlZCBtZXNoLlxuICpcbiAqIFRoZSBzaXplLCBzaGFwZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgYm94IGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvbiBwYXJhbWV0ZXJzLlxuICogQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgYm94IGNlbnRlcmVkIG9uIHRoZSBvYmplY3Qgc3BhY2Ugb3JpZ2luIHdpdGggYSB3aWR0aCxcbiAqIGxlbmd0aCBhbmQgaGVpZ2h0IG9mIDEuMCB1bml0IGFuZCAxMCBzZWdtZW50cyBpbiBlaXRoZXIgYXhpcyAoNTAgdHJpYW5nbGVzIHBlciBmYWNlKS5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGJveCBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEgb24gZWFjaCBmYWNlLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBib3gncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge1ZlYzN9IFtvcHRzLmhhbGZFeHRlbnRzXSAtIFRoZSBoYWxmIGRpbWVuc2lvbnMgb2YgdGhlIGJveCBpbiBlYWNoIGF4aXMgKGRlZmF1bHRzIHRvXG4gKiBbMC41LCAwLjUsIDAuNV0pLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLndpZHRoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFggYXhpcyBvZiB0aGUgYm94XG4gKiAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubGVuZ3RoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFogYXhpcyBvZiB0aGUgYm94XG4gKiAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFkgYXhpcyBvZiB0aGUgYm94XG4gKiAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBib3gtc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUJveChkZXZpY2UsIG9wdHMpIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IGhlID0gb3B0cyAmJiBvcHRzLmhhbGZFeHRlbnRzICE9PSB1bmRlZmluZWQgPyBvcHRzLmhhbGZFeHRlbnRzIDogbmV3IFZlYzMoMC41LCAwLjUsIDAuNSk7XG4gICAgY29uc3Qgd3MgPSBvcHRzICYmIG9wdHMud2lkdGhTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy53aWR0aFNlZ21lbnRzIDogMTtcbiAgICBjb25zdCBscyA9IG9wdHMgJiYgb3B0cy5sZW5ndGhTZWdtZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5sZW5ndGhTZWdtZW50cyA6IDE7XG4gICAgY29uc3QgaHMgPSBvcHRzICYmIG9wdHMuaGVpZ2h0U2VnbWVudHMgIT09IHVuZGVmaW5lZCA/IG9wdHMuaGVpZ2h0U2VnbWVudHMgOiAxO1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMgJiYgb3B0cy5jYWxjdWxhdGVUYW5nZW50cyAhPT0gdW5kZWZpbmVkID8gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA6IGZhbHNlO1xuXG4gICAgY29uc3QgY29ybmVycyA9IFtcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIC1oZS55LCBoZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgLWhlLnksIGhlLnopLFxuICAgICAgICBuZXcgVmVjMyhoZS54LCBoZS55LCBoZS56KSxcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIGhlLnksIGhlLnopLFxuICAgICAgICBuZXcgVmVjMyhoZS54LCAtaGUueSwgLWhlLnopLFxuICAgICAgICBuZXcgVmVjMygtaGUueCwgLWhlLnksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIGhlLnksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgaGUueSwgLWhlLnopXG4gICAgXTtcblxuICAgIGNvbnN0IGZhY2VBeGVzID0gW1xuICAgICAgICBbMCwgMSwgM10sIC8vIEZST05UXG4gICAgICAgIFs0LCA1LCA3XSwgLy8gQkFDS1xuICAgICAgICBbMywgMiwgNl0sIC8vIFRPUFxuICAgICAgICBbMSwgMCwgNF0sIC8vIEJPVFRPTVxuICAgICAgICBbMSwgNCwgMl0sIC8vIFJJR0hUXG4gICAgICAgIFs1LCAwLCA2XSAgLy8gTEVGVFxuICAgIF07XG5cbiAgICBjb25zdCBmYWNlTm9ybWFscyA9IFtcbiAgICAgICAgWzAsICAwLCAgMV0sIC8vIEZST05UXG4gICAgICAgIFswLCAgMCwgLTFdLCAvLyBCQUNLXG4gICAgICAgIFswLCAgMSwgIDBdLCAvLyBUT1BcbiAgICAgICAgWzAsIC0xLCAgMF0sIC8vIEJPVFRPTVxuICAgICAgICBbMSwgIDAsICAwXSwgLy8gUklHSFRcbiAgICAgICAgWy0xLCAgMCwgIDBdICAvLyBMRUZUXG4gICAgXTtcblxuICAgIGNvbnN0IHNpZGVzID0ge1xuICAgICAgICBGUk9OVDogMCxcbiAgICAgICAgQkFDSzogMSxcbiAgICAgICAgVE9QOiAyLFxuICAgICAgICBCT1RUT006IDMsXG4gICAgICAgIFJJR0hUOiA0LFxuICAgICAgICBMRUZUOiA1XG4gICAgfTtcblxuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCB1dnMxID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuICAgIGxldCB2Y291bnRlciA9IDA7XG5cbiAgICBjb25zdCBnZW5lcmF0ZUZhY2UgPSAoc2lkZSwgdVNlZ21lbnRzLCB2U2VnbWVudHMpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcDEgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCB0ZW1wMiA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IHRlbXAzID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgciA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gdVNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IHZTZWdtZW50czsgaisrKSB7XG4gICAgICAgICAgICAgICAgdGVtcDEubGVycChjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzBdXSwgY29ybmVyc1tmYWNlQXhlc1tzaWRlXVsxXV0sIGkgLyB1U2VnbWVudHMpO1xuICAgICAgICAgICAgICAgIHRlbXAyLmxlcnAoY29ybmVyc1tmYWNlQXhlc1tzaWRlXVswXV0sIGNvcm5lcnNbZmFjZUF4ZXNbc2lkZV1bMl1dLCBqIC8gdlNlZ21lbnRzKTtcbiAgICAgICAgICAgICAgICB0ZW1wMy5zdWIyKHRlbXAyLCBjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzBdXSk7XG4gICAgICAgICAgICAgICAgci5hZGQyKHRlbXAxLCB0ZW1wMyk7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSBpIC8gdVNlZ21lbnRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gaiAvIHZTZWdtZW50cztcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHIueCwgci55LCByLnopO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaChmYWNlTm9ybWFsc1tzaWRlXVswXSwgZmFjZU5vcm1hbHNbc2lkZV1bMV0sIGZhY2VOb3JtYWxzW3NpZGVdWzJdKTtcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBwYWNrIGFzIDN4Mi4gMS8zIHdpbGwgYmUgZW1wdHksIGJ1dCBpdCdzIGVpdGhlciB0aGF0IG9yIHN0cmV0Y2hlZCBwaXhlbHNcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmF0ZSBub24tcmVjdGFuZ3VsYXIgbGlnaHRNYXBzLCBzbyB3ZSBjb3VsZCB1c2Ugc3BhY2Ugd2l0aG91dCBzdHJldGNoaW5nXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuXG4gICAgICAgICAgICAgICAgdSArPSAoc2lkZSAlIDMpIC8gMztcbiAgICAgICAgICAgICAgICB2ICs9IE1hdGguZmxvb3Ioc2lkZSAvIDMpIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKChpIDwgdVNlZ21lbnRzKSAmJiAoaiA8IHZTZWdtZW50cykpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZjb3VudGVyICsgdlNlZ21lbnRzICsgMSwgdmNvdW50ZXIgKyAxLCB2Y291bnRlcik7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCh2Y291bnRlciArIHZTZWdtZW50cyArIDEsIHZjb3VudGVyICsgdlNlZ21lbnRzICsgMiwgdmNvdW50ZXIgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2Y291bnRlcisrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5GUk9OVCwgd3MsIGhzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuQkFDSywgd3MsIGhzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuVE9QLCB3cywgbHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5CT1RUT00sIHdzLCBscyk7XG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLlJJR0hULCBscywgaHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5MRUZULCBscywgaHMpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2czEsXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLy8gcmV0dXJucyBQcmltaXRpdmUgZGF0YSwgdXNlZCBieSBNb2RlbENvbXBvbmVudCBhbmQgUmVuZGVyQ29tcG9uZW50XG5mdW5jdGlvbiBnZXRTaGFwZVByaW1pdGl2ZShkZXZpY2UsIHR5cGUpIHtcblxuICAgIC8vIGZpbmQgaW4gY2FjaGVcbiAgICBsZXQgcHJpbURhdGEgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhcGVQcmltaXRpdmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChzaGFwZVByaW1pdGl2ZXNbaV0udHlwZSA9PT0gdHlwZSAmJiBzaGFwZVByaW1pdGl2ZXNbaV0uZGV2aWNlID09PSBkZXZpY2UpIHtcbiAgICAgICAgICAgIHByaW1EYXRhID0gc2hhcGVQcmltaXRpdmVzW2ldLnByaW1EYXRhO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gbm90IGluIGNhY2hlLCBjcmVhdGUgbmV3XG4gICAgaWYgKCFwcmltRGF0YSkge1xuXG4gICAgICAgIGxldCBtZXNoLCBhcmVhO1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcblxuICAgICAgICAgICAgY2FzZSAnYm94JzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQm94KGRldmljZSwgeyBoYWxmRXh0ZW50czogbmV3IFZlYzMoMC41LCAwLjUsIDAuNSkgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogMiwgeTogMiwgejogMiwgdXY6ICgyLjAgLyAzKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjYXBzdWxlJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQ2Fwc3VsZShkZXZpY2UsIHsgcmFkaXVzOiAwLjUsIGhlaWdodDogMiB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAoTWF0aC5QSSAqIDIpLCB5OiBNYXRoLlBJLCB6OiAoTWF0aC5QSSAqIDIpLCB1djogKDEuMCAvIDMgKyAoKDEuMCAvIDMpIC8gMykgKiAyKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjb25lJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQ29uZShkZXZpY2UsIHsgYmFzZVJhZGl1czogMC41LCBwZWFrUmFkaXVzOiAwLCBoZWlnaHQ6IDEgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogMi41NCwgeTogMi41NCwgejogMi41NCwgdXY6ICgxLjAgLyAzICsgKDEuMCAvIDMpIC8gMykgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnY3lsaW5kZXInOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVDeWxpbmRlcihkZXZpY2UsIHsgcmFkaXVzOiAwLjUsIGhlaWdodDogMSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiBNYXRoLlBJLCB5OiAoMC43OSAqIDIpLCB6OiBNYXRoLlBJLCB1djogKDEuMCAvIDMgKyAoKDEuMCAvIDMpIC8gMykgKiAyKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdwbGFuZSc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZVBsYW5lKGRldmljZSwgeyBoYWxmRXh0ZW50czogbmV3IFZlYzIoMC41LCAwLjUpLCB3aWR0aFNlZ21lbnRzOiAxLCBsZW5ndGhTZWdtZW50czogMSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAwLCB5OiAxLCB6OiAwLCB1djogMSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdzcGhlcmUnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVTcGhlcmUoZGV2aWNlLCB7IHJhZGl1czogMC41IH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IE1hdGguUEksIHk6IE1hdGguUEksIHo6IE1hdGguUEksIHV2OiAxIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3RvcnVzJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlVG9ydXMoZGV2aWNlLCB7IHR1YmVSYWRpdXM6IDAuMiwgcmluZ1JhZGl1czogMC4zIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IE1hdGguUEkgKiAwLjUgKiAwLjUgLSBNYXRoLlBJICogMC4xICogMC4xLCB5OiAwLjQsIHo6IDAuNCwgdXY6IDEgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJpbWl0aXZlIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluYyByZWZlcmVuY2UgdG8ga2VlcCBwcmltaXRpdmUgYWxpdmVcbiAgICAgICAgbWVzaC5pbmNSZWZDb3VudCgpO1xuXG4gICAgICAgIHByaW1EYXRhID0geyBtZXNoOiBtZXNoLCBhcmVhOiBhcmVhIH07XG5cbiAgICAgICAgLy8gYWRkIHRvIGNhY2hlXG4gICAgICAgIHNoYXBlUHJpbWl0aXZlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgICAgICBkZXZpY2U6IGRldmljZSxcbiAgICAgICAgICAgIHByaW1EYXRhOiBwcmltRGF0YVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJpbURhdGE7XG59XG5cbmV4cG9ydCB7IGNhbGN1bGF0ZU5vcm1hbHMsIGNhbGN1bGF0ZVRhbmdlbnRzLCBjcmVhdGVCb3gsIGNyZWF0ZUNhcHN1bGUsIGNyZWF0ZUNvbmUsIGNyZWF0ZUN5bGluZGVyLCBjcmVhdGVNZXNoLCBjcmVhdGVQbGFuZSwgY3JlYXRlU3BoZXJlLCBjcmVhdGVUb3J1cywgZ2V0U2hhcGVQcmltaXRpdmUgfTtcbiJdLCJuYW1lcyI6WyJwcmltaXRpdmVVdjFQYWRkaW5nIiwicHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlIiwic2hhcGVQcmltaXRpdmVzIiwiY2FsY3VsYXRlTm9ybWFscyIsInBvc2l0aW9ucyIsImluZGljZXMiLCJ0cmlhbmdsZUNvdW50IiwibGVuZ3RoIiwidmVydGV4Q291bnQiLCJwMSIsIlZlYzMiLCJwMiIsInAzIiwicDFwMiIsInAxcDMiLCJmYWNlTm9ybWFsIiwibm9ybWFscyIsImkiLCJpMSIsImkyIiwiaTMiLCJzZXQiLCJzdWIyIiwiY3Jvc3MiLCJub3JtYWxpemUiLCJ4IiwieSIsInoiLCJueCIsIm55IiwibnoiLCJpbnZMZW4iLCJNYXRoIiwic3FydCIsImNhbGN1bGF0ZVRhbmdlbnRzIiwidXZzIiwidjEiLCJ2MiIsInYzIiwidzEiLCJWZWMyIiwidzIiLCJ3MyIsInNkaXIiLCJ0ZGlyIiwidGFuMSIsIkZsb2F0MzJBcnJheSIsInRhbjIiLCJ0YW5nZW50cyIsIngxIiwieDIiLCJ5MSIsInkyIiwiejEiLCJ6MiIsInMxIiwiczIiLCJ0MSIsInQyIiwiYXJlYSIsInIiLCJuIiwidGVtcCIsIm5kb3R0IiwiZG90IiwiY29weSIsIm11bFNjYWxhciIsImNyZWF0ZU1lc2giLCJkZXZpY2UiLCJvcHRzIiwibWVzaCIsIk1lc2giLCJzZXRQb3NpdGlvbnMiLCJzZXROb3JtYWxzIiwic2V0VmVydGV4U3RyZWFtIiwiU0VNQU5USUNfVEFOR0VOVCIsImNvbG9ycyIsInNldENvbG9yczMyIiwic2V0VXZzIiwidXZzMSIsImJsZW5kSW5kaWNlcyIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIlRZUEVfVUlOVDgiLCJibGVuZFdlaWdodHMiLCJTRU1BTlRJQ19CTEVORFdFSUdIVCIsInNldEluZGljZXMiLCJ1cGRhdGUiLCJjcmVhdGVUb3J1cyIsInJjIiwidHViZVJhZGl1cyIsInVuZGVmaW5lZCIsInJ0IiwicmluZ1JhZGl1cyIsInNlZ21lbnRzIiwic2lkZXMiLCJjYWxjVGFuZ2VudHMiLCJqIiwiY29zIiwiUEkiLCJzaW4iLCJ1IiwidiIsInB1c2giLCJmaXJzdCIsInNlY29uZCIsInRoaXJkIiwiZm91cnRoIiwib3B0aW9ucyIsIl9jcmVhdGVDb25lRGF0YSIsImJhc2VSYWRpdXMiLCJwZWFrUmFkaXVzIiwiaGVpZ2h0IiwiaGVpZ2h0U2VnbWVudHMiLCJjYXBTZWdtZW50cyIsInJvdW5kZWRDYXBzIiwicG9zIiwiYm90dG9tVG9Ub3AiLCJub3JtIiwidG9wIiwiYm90dG9tIiwidGFuZ2VudCIsIm9mZnNldCIsInRoZXRhIiwic2luVGhldGEiLCJjb3NUaGV0YSIsImxlcnAiLCJfdiIsImxhdGl0dWRlQmFuZHMiLCJmbG9vciIsImxvbmdpdHVkZUJhbmRzIiwiY2FwT2Zmc2V0IiwibGF0IiwibG9uIiwicGhpIiwic2luUGhpIiwiY29zUGhpIiwiY3JlYXRlQ3lsaW5kZXIiLCJoYXNPd25Qcm9wZXJ0eSIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsInJhZGl1cyIsImNyZWF0ZUNhcHN1bGUiLCJjcmVhdGVDb25lIiwiY3JlYXRlU3BoZXJlIiwiY3JlYXRlUGxhbmUiLCJoZSIsImhhbGZFeHRlbnRzIiwid3MiLCJ3aWR0aFNlZ21lbnRzIiwibHMiLCJsZW5ndGhTZWdtZW50cyIsInZjb3VudGVyIiwiY3JlYXRlQm94IiwiaHMiLCJjb3JuZXJzIiwiZmFjZUF4ZXMiLCJmYWNlTm9ybWFscyIsIkZST05UIiwiQkFDSyIsIlRPUCIsIkJPVFRPTSIsIlJJR0hUIiwiTEVGVCIsImdlbmVyYXRlRmFjZSIsInNpZGUiLCJ1U2VnbWVudHMiLCJ2U2VnbWVudHMiLCJ0ZW1wMSIsInRlbXAyIiwidGVtcDMiLCJhZGQyIiwiZ2V0U2hhcGVQcmltaXRpdmUiLCJ0eXBlIiwicHJpbURhdGEiLCJ1diIsIkVycm9yIiwiaW5jUmVmQ291bnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBV0EsTUFBTUEsbUJBQW1CLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQTtBQUNwQyxNQUFNQyx3QkFBd0IsR0FBRyxHQUFHLEdBQUdELG1CQUFtQixHQUFHLENBQUMsQ0FBQTs7QUFFOUQ7QUFDQSxNQUFNRSxlQUFlLEdBQUcsRUFBRSxDQUFBOztBQUUxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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
