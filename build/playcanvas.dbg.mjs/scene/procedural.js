import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
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
 * const normals = pc.calculateNormals(positions, indices);
 * const mesh = pc.createMesh(graphicsDevice, positions, {
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
 * const tangents = pc.calculateTangents(positions, normals, uvs, indices);
 * const mesh = pc.createMesh(graphicsDevice, positions, {
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
 * const mesh = pc.createMesh(graphicsDevice, [0, 0, 0, 1, 0, 0, 0, 1, 0], {
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
function createTorus(device, opts = {}) {
  var _opts$tubeRadius, _opts$ringRadius, _opts$segments, _opts$sides, _opts$calculateTangen;
  // Check the supplied options and provide defaults for unspecified ones
  const rc = (_opts$tubeRadius = opts.tubeRadius) != null ? _opts$tubeRadius : 0.2;
  const rt = (_opts$ringRadius = opts.ringRadius) != null ? _opts$ringRadius : 0.3;
  const segments = (_opts$segments = opts.segments) != null ? _opts$segments : 30;
  const sides = (_opts$sides = opts.sides) != null ? _opts$sides : 20;
  const calcTangents = (_opts$calculateTangen = opts.calculateTangents) != null ? _opts$calculateTangen : false;

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
function createCylinder(device, opts = {}) {
  var _opts$radius, _opts$height, _opts$heightSegments, _opts$capSegments, _opts$calculateTangen2;
  // Check the supplied options and provide defaults for unspecified ones
  const radius = (_opts$radius = opts.radius) != null ? _opts$radius : 0.5;
  const height = (_opts$height = opts.height) != null ? _opts$height : 1;
  const heightSegments = (_opts$heightSegments = opts.heightSegments) != null ? _opts$heightSegments : 5;
  const capSegments = (_opts$capSegments = opts.capSegments) != null ? _opts$capSegments : 20;
  const calcTangents = (_opts$calculateTangen2 = opts.calculateTangents) != null ? _opts$calculateTangen2 : false;

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
function createCapsule(device, opts = {}) {
  var _opts$radius2, _opts$height2, _opts$heightSegments2, _opts$sides2, _opts$calculateTangen3;
  // Check the supplied options and provide defaults for unspecified ones
  const radius = (_opts$radius2 = opts.radius) != null ? _opts$radius2 : 0.3;
  const height = (_opts$height2 = opts.height) != null ? _opts$height2 : 1;
  const heightSegments = (_opts$heightSegments2 = opts.heightSegments) != null ? _opts$heightSegments2 : 1;
  const sides = (_opts$sides2 = opts.sides) != null ? _opts$sides2 : 20;
  const calcTangents = (_opts$calculateTangen3 = opts.calculateTangents) != null ? _opts$calculateTangen3 : false;

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
function createCone(device, opts = {}) {
  var _opts$baseRadius, _opts$peakRadius, _opts$height3, _opts$heightSegments3, _opts$capSegments2, _opts$calculateTangen4;
  // Check the supplied options and provide defaults for unspecified ones
  const baseRadius = (_opts$baseRadius = opts.baseRadius) != null ? _opts$baseRadius : 0.5;
  const peakRadius = (_opts$peakRadius = opts.peakRadius) != null ? _opts$peakRadius : 0;
  const height = (_opts$height3 = opts.height) != null ? _opts$height3 : 1;
  const heightSegments = (_opts$heightSegments3 = opts.heightSegments) != null ? _opts$heightSegments3 : 5;
  const capSegments = (_opts$capSegments2 = opts.capSegments) != null ? _opts$capSegments2 : 18;
  const calcTangents = (_opts$calculateTangen4 = opts.calculateTangents) != null ? _opts$calculateTangen4 : false;
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
function createSphere(device, opts = {}) {
  var _opts$radius3, _opts$latitudeBands, _opts$longitudeBands, _opts$calculateTangen5;
  // Check the supplied options and provide defaults for unspecified ones
  const radius = (_opts$radius3 = opts.radius) != null ? _opts$radius3 : 0.5;
  const latitudeBands = (_opts$latitudeBands = opts.latitudeBands) != null ? _opts$latitudeBands : 16;
  const longitudeBands = (_opts$longitudeBands = opts.longitudeBands) != null ? _opts$longitudeBands : 16;
  const calcTangents = (_opts$calculateTangen5 = opts.calculateTangents) != null ? _opts$calculateTangen5 : false;

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
function createPlane(device, opts = {}) {
  var _opts$halfExtents, _opts$widthSegments, _opts$lengthSegments, _opts$calculateTangen6;
  // Check the supplied options and provide defaults for unspecified ones
  const he = (_opts$halfExtents = opts.halfExtents) != null ? _opts$halfExtents : new Vec2(0.5, 0.5);
  const ws = (_opts$widthSegments = opts.widthSegments) != null ? _opts$widthSegments : 5;
  const ls = (_opts$lengthSegments = opts.lengthSegments) != null ? _opts$lengthSegments : 5;
  const calcTangents = (_opts$calculateTangen6 = opts.calculateTangents) != null ? _opts$calculateTangen6 : false;

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
function createBox(device, opts = {}) {
  var _opts$halfExtents2, _opts$widthSegments2, _opts$lengthSegments2, _opts$heightSegments4, _opts$calculateTangen7;
  // Check the supplied options and provide defaults for unspecified ones
  const he = (_opts$halfExtents2 = opts.halfExtents) != null ? _opts$halfExtents2 : new Vec3(0.5, 0.5, 0.5);
  const ws = (_opts$widthSegments2 = opts.widthSegments) != null ? _opts$widthSegments2 : 1;
  const ls = (_opts$lengthSegments2 = opts.lengthSegments) != null ? _opts$lengthSegments2 : 1;
  const hs = (_opts$heightSegments4 = opts.heightSegments) != null ? _opts$heightSegments4 : 1;
  const calcTangents = (_opts$calculateTangen7 = opts.calculateTangents) != null ? _opts$calculateTangen7 : false;
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
        mesh = createBox(device);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2VkdXJhbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3Byb2NlZHVyYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgU0VNQU5USUNfVEFOR0VOVCwgU0VNQU5USUNfQkxFTkRXRUlHSFQsIFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICBUWVBFX1VJTlQ4XG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuL21lc2guanMnO1xuXG5jb25zdCBwcmltaXRpdmVVdjFQYWRkaW5nID0gNC4wIC8gNjQ7XG5jb25zdCBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgPSAxLjAgLSBwcmltaXRpdmVVdjFQYWRkaW5nICogMjtcblxuLy8gY2FjaGVkIG1lc2ggcHJpbWl0aXZlc1xuY29uc3Qgc2hhcGVQcmltaXRpdmVzID0gW107XG5cbi8qKlxuICogR2VuZXJhdGVzIG5vcm1hbCBpbmZvcm1hdGlvbiBmcm9tIHRoZSBzcGVjaWZpZWQgcG9zaXRpb25zIGFuZCB0cmlhbmdsZSBpbmRpY2VzLiBTZWVcbiAqIHtAbGluayBjcmVhdGVNZXNofS5cbiAqXG4gKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBwb3NpdGlvbnMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBpbmRpY2VzIC0gQW4gYXJyYXkgb2YgdHJpYW5nbGUgaW5kaWNlcy5cbiAqIEByZXR1cm5zIHtudW1iZXJbXX0gQW4gYXJyYXkgb2YgMy1kaW1lbnNpb25hbCB2ZXJ0ZXggbm9ybWFscy5cbiAqIEBleGFtcGxlXG4gKiBjb25zdCBub3JtYWxzID0gcGMuY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICogY29uc3QgbWVzaCA9IHBjLmNyZWF0ZU1lc2goZ3JhcGhpY3NEZXZpY2UsIHBvc2l0aW9ucywge1xuICogICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gKiAgICAgdXZzOiB1dnMsXG4gKiAgICAgaW5kaWNlczogaW5kaWNlc1xuICogfSk7XG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZU5vcm1hbHMocG9zaXRpb25zLCBpbmRpY2VzKSB7XG4gICAgY29uc3QgdHJpYW5nbGVDb3VudCA9IGluZGljZXMubGVuZ3RoIC8gMztcbiAgICBjb25zdCB2ZXJ0ZXhDb3VudCAgID0gcG9zaXRpb25zLmxlbmd0aCAvIDM7XG4gICAgY29uc3QgcDEgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHAyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMiA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcDFwMyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgZmFjZU5vcm1hbCA9IG5ldyBWZWMzKCk7XG5cbiAgICBjb25zdCBub3JtYWxzID0gW107XG5cbiAgICAvLyBJbml0aWFsaXplIHRoZSBub3JtYWwgYXJyYXkgdG8gemVyb1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9zaXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG5vcm1hbHNbaV0gPSAwO1xuICAgIH1cblxuICAgIC8vIEFjY3VtdWxhdGUgZmFjZSBub3JtYWxzIGZvciBlYWNoIHZlcnRleFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVDb3VudDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGkxID0gaW5kaWNlc1tpICogM107XG4gICAgICAgIGNvbnN0IGkyID0gaW5kaWNlc1tpICogMyArIDFdO1xuICAgICAgICBjb25zdCBpMyA9IGluZGljZXNbaSAqIDMgKyAyXTtcblxuICAgICAgICBwMS5zZXQocG9zaXRpb25zW2kxICogM10sIHBvc2l0aW9uc1tpMSAqIDMgKyAxXSwgcG9zaXRpb25zW2kxICogMyArIDJdKTtcbiAgICAgICAgcDIuc2V0KHBvc2l0aW9uc1tpMiAqIDNdLCBwb3NpdGlvbnNbaTIgKiAzICsgMV0sIHBvc2l0aW9uc1tpMiAqIDMgKyAyXSk7XG4gICAgICAgIHAzLnNldChwb3NpdGlvbnNbaTMgKiAzXSwgcG9zaXRpb25zW2kzICogMyArIDFdLCBwb3NpdGlvbnNbaTMgKiAzICsgMl0pO1xuXG4gICAgICAgIHAxcDIuc3ViMihwMiwgcDEpO1xuICAgICAgICBwMXAzLnN1YjIocDMsIHAxKTtcbiAgICAgICAgZmFjZU5vcm1hbC5jcm9zcyhwMXAyLCBwMXAzKS5ub3JtYWxpemUoKTtcblxuICAgICAgICBub3JtYWxzW2kxICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMSAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTEgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kyICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMiAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTIgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgICAgICBub3JtYWxzW2kzICogM10gICAgICs9IGZhY2VOb3JtYWwueDtcbiAgICAgICAgbm9ybWFsc1tpMyAqIDMgKyAxXSArPSBmYWNlTm9ybWFsLnk7XG4gICAgICAgIG5vcm1hbHNbaTMgKiAzICsgMl0gKz0gZmFjZU5vcm1hbC56O1xuICAgIH1cblxuICAgIC8vIE5vcm1hbGl6ZSBhbGwgbm9ybWFsc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICBjb25zdCBueCA9IG5vcm1hbHNbaSAqIDNdO1xuICAgICAgICBjb25zdCBueSA9IG5vcm1hbHNbaSAqIDMgKyAxXTtcbiAgICAgICAgY29uc3QgbnogPSBub3JtYWxzW2kgKiAzICsgMl07XG4gICAgICAgIGNvbnN0IGludkxlbiA9IDEgLyBNYXRoLnNxcnQobnggKiBueCArIG55ICogbnkgKyBueiAqIG56KTtcbiAgICAgICAgbm9ybWFsc1tpICogM10gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMV0gKj0gaW52TGVuO1xuICAgICAgICBub3JtYWxzW2kgKiAzICsgMl0gKj0gaW52TGVuO1xuICAgIH1cblxuICAgIHJldHVybiBub3JtYWxzO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyB0YW5nZW50IGluZm9ybWF0aW9uIGZyb20gdGhlIHNwZWNpZmllZCBwb3NpdGlvbnMsIG5vcm1hbHMsIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kXG4gKiB0cmlhbmdsZSBpbmRpY2VzLiBTZWUge0BsaW5rIGNyZWF0ZU1lc2h9LlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IHBvc2l0aW9ucy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IG5vcm1hbHMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBub3JtYWxzLlxuICogQHBhcmFtIHtudW1iZXJbXX0gdXZzIC0gQW4gYXJyYXkgb2YgMi1kaW1lbnNpb25hbCB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlcy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IGluZGljZXMgLSBBbiBhcnJheSBvZiB0cmlhbmdsZSBpbmRpY2VzLlxuICogQHJldHVybnMge251bWJlcltdfSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCB0YW5nZW50cy5cbiAqIEBleGFtcGxlXG4gKiBjb25zdCB0YW5nZW50cyA9IHBjLmNhbGN1bGF0ZVRhbmdlbnRzKHBvc2l0aW9ucywgbm9ybWFscywgdXZzLCBpbmRpY2VzKTtcbiAqIGNvbnN0IG1lc2ggPSBwYy5jcmVhdGVNZXNoKGdyYXBoaWNzRGV2aWNlLCBwb3NpdGlvbnMsIHtcbiAqICAgICBub3JtYWxzOiBub3JtYWxzLFxuICogICAgIHRhbmdlbnRzOiB0YW5nZW50cyxcbiAqICAgICB1dnM6IHV2cyxcbiAqICAgICBpbmRpY2VzOiBpbmRpY2VzXG4gKiB9KTtcbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpIHtcbiAgICAvLyBMZW5neWVsJ3MgTWV0aG9kXG4gICAgLy8gaHR0cDovL3dlYi5hcmNoaXZlLm9yZy93ZWIvMjAxODA2MjAwMjQ0MzkvaHR0cDovL3d3dy50ZXJhdGhvbi5jb20vY29kZS90YW5nZW50Lmh0bWxcbiAgICBjb25zdCB0cmlhbmdsZUNvdW50ID0gaW5kaWNlcy5sZW5ndGggLyAzO1xuICAgIGNvbnN0IHZlcnRleENvdW50ICAgPSBwb3NpdGlvbnMubGVuZ3RoIC8gMztcbiAgICBjb25zdCB2MSAgID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB2MiAgID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB2MyAgID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB3MSAgID0gbmV3IFZlYzIoKTtcbiAgICBjb25zdCB3MiAgID0gbmV3IFZlYzIoKTtcbiAgICBjb25zdCB3MyAgID0gbmV3IFZlYzIoKTtcbiAgICBjb25zdCBzZGlyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0ZGlyID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0YW4xID0gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0ZXhDb3VudCAqIDMpO1xuICAgIGNvbnN0IHRhbjIgPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRleENvdW50ICogMyk7XG5cbiAgICBjb25zdCB0YW5nZW50cyA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmlhbmdsZUNvdW50OyBpKyspIHtcbiAgICAgICAgY29uc3QgaTEgPSBpbmRpY2VzW2kgKiAzXTtcbiAgICAgICAgY29uc3QgaTIgPSBpbmRpY2VzW2kgKiAzICsgMV07XG4gICAgICAgIGNvbnN0IGkzID0gaW5kaWNlc1tpICogMyArIDJdO1xuXG4gICAgICAgIHYxLnNldChwb3NpdGlvbnNbaTEgKiAzXSwgcG9zaXRpb25zW2kxICogMyArIDFdLCBwb3NpdGlvbnNbaTEgKiAzICsgMl0pO1xuICAgICAgICB2Mi5zZXQocG9zaXRpb25zW2kyICogM10sIHBvc2l0aW9uc1tpMiAqIDMgKyAxXSwgcG9zaXRpb25zW2kyICogMyArIDJdKTtcbiAgICAgICAgdjMuc2V0KHBvc2l0aW9uc1tpMyAqIDNdLCBwb3NpdGlvbnNbaTMgKiAzICsgMV0sIHBvc2l0aW9uc1tpMyAqIDMgKyAyXSk7XG5cbiAgICAgICAgdzEuc2V0KHV2c1tpMSAqIDJdLCB1dnNbaTEgKiAyICsgMV0pO1xuICAgICAgICB3Mi5zZXQodXZzW2kyICogMl0sIHV2c1tpMiAqIDIgKyAxXSk7XG4gICAgICAgIHczLnNldCh1dnNbaTMgKiAyXSwgdXZzW2kzICogMiArIDFdKTtcblxuICAgICAgICBjb25zdCB4MSA9IHYyLnggLSB2MS54O1xuICAgICAgICBjb25zdCB4MiA9IHYzLnggLSB2MS54O1xuICAgICAgICBjb25zdCB5MSA9IHYyLnkgLSB2MS55O1xuICAgICAgICBjb25zdCB5MiA9IHYzLnkgLSB2MS55O1xuICAgICAgICBjb25zdCB6MSA9IHYyLnogLSB2MS56O1xuICAgICAgICBjb25zdCB6MiA9IHYzLnogLSB2MS56O1xuXG4gICAgICAgIGNvbnN0IHMxID0gdzIueCAtIHcxLng7XG4gICAgICAgIGNvbnN0IHMyID0gdzMueCAtIHcxLng7XG4gICAgICAgIGNvbnN0IHQxID0gdzIueSAtIHcxLnk7XG4gICAgICAgIGNvbnN0IHQyID0gdzMueSAtIHcxLnk7XG5cbiAgICAgICAgY29uc3QgYXJlYSA9IHMxICogdDIgLSBzMiAqIHQxO1xuXG4gICAgICAgIC8vIEFyZWEgY2FuIGJlIDAgZm9yIGRlZ2VuZXJhdGUgdHJpYW5nbGVzIG9yIGJhZCB1diBjb29yZGluYXRlc1xuICAgICAgICBpZiAoYXJlYSA9PT0gMCkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gZGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgICAgIHNkaXIuc2V0KDAsIDEsIDApO1xuICAgICAgICAgICAgdGRpci5zZXQoMSwgMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByID0gMSAvIGFyZWE7XG4gICAgICAgICAgICBzZGlyLnNldCgodDIgKiB4MSAtIHQxICogeDIpICogcixcbiAgICAgICAgICAgICAgICAgICAgICh0MiAqIHkxIC0gdDEgKiB5MikgKiByLFxuICAgICAgICAgICAgICAgICAgICAgKHQyICogejEgLSB0MSAqIHoyKSAqIHIpO1xuICAgICAgICAgICAgdGRpci5zZXQoKHMxICogeDIgLSBzMiAqIHgxKSAqIHIsXG4gICAgICAgICAgICAgICAgICAgICAoczEgKiB5MiAtIHMyICogeTEpICogcixcbiAgICAgICAgICAgICAgICAgICAgIChzMSAqIHoyIC0gczIgKiB6MSkgKiByKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhbjFbaTEgKiAzICsgMF0gKz0gc2Rpci54O1xuICAgICAgICB0YW4xW2kxICogMyArIDFdICs9IHNkaXIueTtcbiAgICAgICAgdGFuMVtpMSAqIDMgKyAyXSArPSBzZGlyLno7XG4gICAgICAgIHRhbjFbaTIgKiAzICsgMF0gKz0gc2Rpci54O1xuICAgICAgICB0YW4xW2kyICogMyArIDFdICs9IHNkaXIueTtcbiAgICAgICAgdGFuMVtpMiAqIDMgKyAyXSArPSBzZGlyLno7XG4gICAgICAgIHRhbjFbaTMgKiAzICsgMF0gKz0gc2Rpci54O1xuICAgICAgICB0YW4xW2kzICogMyArIDFdICs9IHNkaXIueTtcbiAgICAgICAgdGFuMVtpMyAqIDMgKyAyXSArPSBzZGlyLno7XG5cbiAgICAgICAgdGFuMltpMSAqIDMgKyAwXSArPSB0ZGlyLng7XG4gICAgICAgIHRhbjJbaTEgKiAzICsgMV0gKz0gdGRpci55O1xuICAgICAgICB0YW4yW2kxICogMyArIDJdICs9IHRkaXIuejtcbiAgICAgICAgdGFuMltpMiAqIDMgKyAwXSArPSB0ZGlyLng7XG4gICAgICAgIHRhbjJbaTIgKiAzICsgMV0gKz0gdGRpci55O1xuICAgICAgICB0YW4yW2kyICogMyArIDJdICs9IHRkaXIuejtcbiAgICAgICAgdGFuMltpMyAqIDMgKyAwXSArPSB0ZGlyLng7XG4gICAgICAgIHRhbjJbaTMgKiAzICsgMV0gKz0gdGRpci55O1xuICAgICAgICB0YW4yW2kzICogMyArIDJdICs9IHRkaXIuejtcbiAgICB9XG5cbiAgICBjb25zdCB0MSA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgdDIgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IG4gPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRlbXAgPSBuZXcgVmVjMygpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhDb3VudDsgaSsrKSB7XG4gICAgICAgIG4uc2V0KG5vcm1hbHNbaSAqIDNdLCBub3JtYWxzW2kgKiAzICsgMV0sIG5vcm1hbHNbaSAqIDMgKyAyXSk7XG4gICAgICAgIHQxLnNldCh0YW4xW2kgKiAzXSwgdGFuMVtpICogMyArIDFdLCB0YW4xW2kgKiAzICsgMl0pO1xuICAgICAgICB0Mi5zZXQodGFuMltpICogM10sIHRhbjJbaSAqIDMgKyAxXSwgdGFuMltpICogMyArIDJdKTtcblxuICAgICAgICAvLyBHcmFtLVNjaG1pZHQgb3J0aG9nb25hbGl6ZVxuICAgICAgICBjb25zdCBuZG90dCA9IG4uZG90KHQxKTtcbiAgICAgICAgdGVtcC5jb3B5KG4pLm11bFNjYWxhcihuZG90dCk7XG4gICAgICAgIHRlbXAuc3ViMih0MSwgdGVtcCkubm9ybWFsaXplKCk7XG5cbiAgICAgICAgdGFuZ2VudHNbaSAqIDRdICAgICA9IHRlbXAueDtcbiAgICAgICAgdGFuZ2VudHNbaSAqIDQgKyAxXSA9IHRlbXAueTtcbiAgICAgICAgdGFuZ2VudHNbaSAqIDQgKyAyXSA9IHRlbXAuejtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgaGFuZGVkbmVzc1xuICAgICAgICB0ZW1wLmNyb3NzKG4sIHQxKTtcbiAgICAgICAgdGFuZ2VudHNbaSAqIDQgKyAzXSA9ICh0ZW1wLmRvdCh0MikgPCAwLjApID8gLTEuMCA6IDEuMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFuZ2VudHM7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBtZXNoIG9iamVjdCBmcm9tIHRoZSBzdXBwbGllZCB2ZXJ0ZXggaW5mb3JtYXRpb24gYW5kIHRvcG9sb2d5LlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCBwb3NpdGlvbnMuXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5ub3JtYWxzXSAtIEFuIGFycmF5IG9mIDMtZGltZW5zaW9uYWwgdmVydGV4IG5vcm1hbHMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy50YW5nZW50c10gLSBBbiBhcnJheSBvZiAzLWRpbWVuc2lvbmFsIHZlcnRleCB0YW5nZW50cy5cbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmNvbG9yc10gLSBBbiBhcnJheSBvZiA0LWRpbWVuc2lvbmFsIHZlcnRleCBjb2xvcnMgd2hlcmUgZWFjaCBjb21wb25lbnRcbiAqIGlzIGFuIGludGVnZXIgaW4gdGhlIHJhbmdlIDAgdG8gMjU1LlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdHMudXZzXSAtIEFuIGFycmF5IG9mIDItZGltZW5zaW9uYWwgdmVydGV4IHRleHR1cmUgY29vcmRpbmF0ZXMuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy51dnMxXSAtIFNhbWUgYXMgb3B0cy51dnMsIGJ1dCBmb3IgYWRkaXRpb25hbCBVViBzZXRcbiAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRzLmJsZW5kSW5kaWNlc10gLSBBbiBhcnJheSBvZiA0LWRpbWVuc2lvbmFsIGJvbmUgaW5kaWNlcyB3aGVyZSBlYWNoXG4gKiBjb21wb25lbnQgaXMgYW4gaW50ZWdlciBpbiB0aGUgcmFuZ2UgMCB0byAyNTUuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5ibGVuZFdlaWdodHNdIC0gQW4gYXJyYXkgb2YgNC1kaW1lbnNpb25hbCBib25lIHdlaWdodHMgd2hlcmUgZWFjaFxuICogY29tcG9uZW50IGlzIGluIHRoZSByYW5nZSAwIHRvIDEgYW5kIHRoZSBzdW0gb2YgdGhlIHdlaWdodHMgc2hvdWxkIGVxdWFsIDEuXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0cy5pbmRpY2VzXSAtIEFuIGFycmF5IG9mIHRyaWFuZ2xlIGluZGljZXMuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgTWVzaCBjb25zdHJ1Y3RlZCBmcm9tIHRoZSBzdXBwbGllZCB2ZXJ0ZXggYW5kIHRyaWFuZ2xlIGRhdGEuXG4gKiBAZXhhbXBsZVxuICogLy8gQ3JlYXRlIGEgc2ltcGxlLCBpbmRleGVkIHRyaWFuZ2xlICh3aXRoIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kIHZlcnRleCBub3JtYWxzKVxuICogY29uc3QgbWVzaCA9IHBjLmNyZWF0ZU1lc2goZ3JhcGhpY3NEZXZpY2UsIFswLCAwLCAwLCAxLCAwLCAwLCAwLCAxLCAwXSwge1xuICogICAgIG5vcm1hbHM6IFswLCAwLCAxLCAwLCAwLCAxLCAwLCAwLCAxXSxcbiAqICAgICB1dnM6IFswLCAwLCAxLCAwLCAwLCAxXSxcbiAqICAgICBpbmRpY2VzOiBbMCwgMSwgMl1cbiAqIH0pO1xuICovXG5mdW5jdGlvbiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRzKSB7XG5cbiAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICBtZXNoLnNldFBvc2l0aW9ucyhwb3NpdGlvbnMpO1xuXG4gICAgaWYgKG9wdHMpIHtcbiAgICAgICAgaWYgKG9wdHMubm9ybWFscykge1xuICAgICAgICAgICAgbWVzaC5zZXROb3JtYWxzKG9wdHMubm9ybWFscyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy50YW5nZW50cykge1xuICAgICAgICAgICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfVEFOR0VOVCwgb3B0cy50YW5nZW50cywgNCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5jb2xvcnMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0Q29sb3JzMzIob3B0cy5jb2xvcnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMudXZzKSB7XG4gICAgICAgICAgICBtZXNoLnNldFV2cygwLCBvcHRzLnV2cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy51dnMxKSB7XG4gICAgICAgICAgICBtZXNoLnNldFV2cygxLCBvcHRzLnV2czEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuYmxlbmRJbmRpY2VzKSB7XG4gICAgICAgICAgICBtZXNoLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19CTEVORElORElDRVMsIG9wdHMuYmxlbmRJbmRpY2VzLCA0LCBvcHRzLmJsZW5kSW5kaWNlcy5sZW5ndGggLyA0LCBUWVBFX1VJTlQ4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmJsZW5kV2VpZ2h0cykge1xuICAgICAgICAgICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQkxFTkRXRUlHSFQsIG9wdHMuYmxlbmRXZWlnaHRzLCA0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRzLmluZGljZXMpIHtcbiAgICAgICAgICAgIG1lc2guc2V0SW5kaWNlcyhvcHRzLmluZGljZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWVzaC51cGRhdGUoKTtcbiAgICByZXR1cm4gbWVzaDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCB0b3J1cy1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIHRvcnVzIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvblxuICogcGFyYW1ldGVycy4gQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgdG9ydXMgaW4gdGhlIFhaLXBsYW5lIHdpdGggYSB0dWJlIHJhZGl1cyBvZlxuICogMC4yLCBhIHJpbmcgcmFkaXVzIG9mIDAuMywgMjAgc2VnbWVudHMgYW5kIDMwIHNpZGVzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgdG9ydXMgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSB0b3J1cydzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy50dWJlUmFkaXVzXSAtIFRoZSByYWRpdXMgb2YgdGhlIHR1YmUgZm9ybWluZyB0aGUgYm9keSBvZiB0aGUgdG9ydXNcbiAqIChkZWZhdWx0cyB0byAwLjIpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJpbmdSYWRpdXNdIC0gVGhlIHJhZGl1cyBmcm9tIHRoZSBjZW50cmUgb2YgdGhlIHRvcnVzIHRvIHRoZSBjZW50cmUgb2YgdGhlXG4gKiB0dWJlIChkZWZhdWx0cyB0byAwLjMpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgcmFkaWFsIGRpdmlzaW9ucyBmb3JtaW5nIGNyb3NzLXNlY3Rpb25zIG9mIHRoZVxuICogdG9ydXMgcmluZyAoZGVmYXVsdHMgdG8gMjApLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnNpZGVzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFyb3VuZCB0aGUgdHVidWxhciBib2R5IG9mIHRoZSB0b3J1cyByaW5nXG4gKiAoZGVmYXVsdHMgdG8gMzApLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgdG9ydXMtc2hhcGVkIG1lc2guXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVRvcnVzKGRldmljZSwgb3B0cyA9IHt9KSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCByYyA9IG9wdHMudHViZVJhZGl1cyA/PyAwLjI7XG4gICAgY29uc3QgcnQgPSBvcHRzLnJpbmdSYWRpdXMgPz8gMC4zO1xuICAgIGNvbnN0IHNlZ21lbnRzID0gb3B0cy5zZWdtZW50cyA/PyAzMDtcbiAgICBjb25zdCBzaWRlcyA9IG9wdHMuc2lkZXMgPz8gMjA7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA/PyBmYWxzZTtcblxuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCBpbmRpY2VzID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBzaWRlczsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IHNlZ21lbnRzOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSBNYXRoLmNvcygyICogTWF0aC5QSSAqIGogLyBzZWdtZW50cykgKiAocnQgKyByYyAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKSk7XG4gICAgICAgICAgICBjb25zdCB5ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpICogcmM7XG4gICAgICAgICAgICBjb25zdCB6ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBqIC8gc2VnbWVudHMpICogKHJ0ICsgcmMgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcykpO1xuXG4gICAgICAgICAgICBjb25zdCBueCA9IE1hdGguY29zKDIgKiBNYXRoLlBJICogaiAvIHNlZ21lbnRzKSAqIE1hdGguY29zKDIgKiBNYXRoLlBJICogaSAvIHNpZGVzKTtcbiAgICAgICAgICAgIGNvbnN0IG55ID0gTWF0aC5zaW4oMiAqIE1hdGguUEkgKiBpIC8gc2lkZXMpO1xuICAgICAgICAgICAgY29uc3QgbnogPSBNYXRoLnNpbigyICogTWF0aC5QSSAqIGogLyBzZWdtZW50cykgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBzaWRlcyk7XG5cbiAgICAgICAgICAgIGNvbnN0IHUgPSBpIC8gc2lkZXM7XG4gICAgICAgICAgICBjb25zdCB2ID0gMSAtIGogLyBzZWdtZW50cztcblxuICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICBub3JtYWxzLnB1c2gobngsIG55LCBueik7XG4gICAgICAgICAgICB1dnMucHVzaCh1LCAxLjAgLSB2KTtcblxuICAgICAgICAgICAgaWYgKChpIDwgc2lkZXMpICYmIChqIDwgc2VnbWVudHMpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3QgID0gKChpKSkgICAgICogKHNlZ21lbnRzICsgMSkgKyAoKGopKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgPSAoKGkgKyAxKSkgKiAoc2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRoaXJkICA9ICgoaSkpICAgICAqIChzZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvdXJ0aCA9ICgoaSArIDEpKSAqIChzZWdtZW50cyArIDEpICsgKChqICsgMSkpO1xuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0LCBzZWNvbmQsIHRoaXJkKTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goc2Vjb25kLCBmb3VydGgsIHRoaXJkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMsXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gX2NyZWF0ZUNvbmVEYXRhKGJhc2VSYWRpdXMsIHBlYWtSYWRpdXMsIGhlaWdodCwgaGVpZ2h0U2VnbWVudHMsIGNhcFNlZ21lbnRzLCByb3VuZGVkQ2Fwcykge1xuICAgIC8vIFZhcmlhYmxlIGRlY2xhcmF0aW9uc1xuICAgIGNvbnN0IHBvcyA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgYm90dG9tVG9Ub3AgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IG5vcm0gPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHRvcCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgYm90dG9tID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCB0YW5nZW50ID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgdXZzMSA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcbiAgICBsZXQgb2Zmc2V0O1xuXG4gICAgLy8gRGVmaW5lIHRoZSBib2R5IG9mIHRoZSBjb25lL2N5bGluZGVyXG4gICAgaWYgKGhlaWdodCA+IDApIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gaGVpZ2h0U2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPD0gY2FwU2VnbWVudHM7IGorKykge1xuICAgICAgICAgICAgICAgIC8vIFN3ZWVwIHRoZSBjb25lIGJvZHkgZnJvbSB0aGUgcG9zaXRpdmUgWSBheGlzIHRvIG1hdGNoIGEgM0RTIE1heCBjb25lL2N5bGluZGVyXG4gICAgICAgICAgICAgICAgY29uc3QgdGhldGEgPSAoaiAvIGNhcFNlZ21lbnRzKSAqIDIgKiBNYXRoLlBJIC0gTWF0aC5QSTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguY29zKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBib3R0b20uc2V0KHNpblRoZXRhICogYmFzZVJhZGl1cywgLWhlaWdodCAvIDIsIGNvc1RoZXRhICogYmFzZVJhZGl1cyk7XG4gICAgICAgICAgICAgICAgdG9wLnNldChzaW5UaGV0YSAqIHBlYWtSYWRpdXMsIGhlaWdodCAvIDIsIGNvc1RoZXRhICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgcG9zLmxlcnAoYm90dG9tLCB0b3AsIGkgLyBoZWlnaHRTZWdtZW50cyk7XG4gICAgICAgICAgICAgICAgYm90dG9tVG9Ub3Auc3ViMih0b3AsIGJvdHRvbSkubm9ybWFsaXplKCk7XG4gICAgICAgICAgICAgICAgdGFuZ2VudC5zZXQoY29zVGhldGEsIDAsIC1zaW5UaGV0YSk7XG4gICAgICAgICAgICAgICAgbm9ybS5jcm9zcyh0YW5nZW50LCBib3R0b21Ub1RvcCkubm9ybWFsaXplKCk7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaChwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2gobm9ybS54LCBub3JtLnksIG5vcm0ueik7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSBqIC8gY2FwU2VnbWVudHM7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSBpIC8gaGVpZ2h0U2VnbWVudHM7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gMXN0IHRoaXJkXG4gICAgICAgICAgICAgICAgY29uc3QgX3YgPSB2O1xuICAgICAgICAgICAgICAgIHYgPSB1O1xuICAgICAgICAgICAgICAgIHUgPSBfdjtcbiAgICAgICAgICAgICAgICB1ID0gdSAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdiA9IHYgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHUgLz0gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKChpIDwgaGVpZ2h0U2VnbWVudHMpICYmIChqIDwgY2FwU2VnbWVudHMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICAgPSAoKGkpKSAgICAgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmQgID0gKChpKSkgICAgICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRoaXJkICAgPSAoKGkgKyAxKSkgKiAoY2FwU2VnbWVudHMgKyAxKSArICgoaikpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3VydGggID0gKChpICsgMSkpICogKGNhcFNlZ21lbnRzICsgMSkgKyAoKGogKyAxKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0LCBzZWNvbmQsIHRoaXJkKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHNlY29uZCwgZm91cnRoLCB0aGlyZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJvdW5kZWRDYXBzKSB7XG4gICAgICAgIGNvbnN0IGxhdGl0dWRlQmFuZHMgPSBNYXRoLmZsb29yKGNhcFNlZ21lbnRzIC8gMik7XG4gICAgICAgIGNvbnN0IGxvbmdpdHVkZUJhbmRzID0gY2FwU2VnbWVudHM7XG4gICAgICAgIGNvbnN0IGNhcE9mZnNldCA9IGhlaWdodCAvIDI7XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgdG9wIGNhcFxuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPD0gbGF0aXR1ZGVCYW5kczsgbGF0KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGxhdCAqIE1hdGguUEkgKiAwLjUpIC8gbGF0aXR1ZGVCYW5kcztcbiAgICAgICAgICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgY29uc3QgY29zVGhldGEgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8PSBsb25naXR1ZGVCYW5kczsgbG9uKyspIHtcbiAgICAgICAgICAgICAgICAvLyBTd2VlcCB0aGUgc3BoZXJlIGZyb20gdGhlIHBvc2l0aXZlIFogYXhpcyB0byBtYXRjaCBhIDNEUyBNYXggc3BoZXJlXG4gICAgICAgICAgICAgICAgY29uc3QgcGhpID0gbG9uICogMiAqIE1hdGguUEkgLyBsb25naXR1ZGVCYW5kcyAtIE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpblBoaSA9IE1hdGguc2luKHBoaSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29zUGhpID0gTWF0aC5jb3MocGhpKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHggPSBjb3NQaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gY29zVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IHNpblBoaSAqIHNpblRoZXRhO1xuICAgICAgICAgICAgICAgIGxldCB1ID0gMSAtIGxvbiAvIGxvbmdpdHVkZUJhbmRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gMSAtIGxhdCAvIGxhdGl0dWRlQmFuZHM7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnMucHVzaCh4ICogcGVha1JhZGl1cywgeSAqIHBlYWtSYWRpdXMgKyBjYXBPZmZzZXQsIHogKiBwZWFrUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goeCwgeSwgeik7XG4gICAgICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgLy8gUGFjayBVVjEgdG8gMm5kIHRoaXJkXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuICAgICAgICAgICAgICAgIHUgKz0gMS4wIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb2Zmc2V0ID0gKGhlaWdodFNlZ21lbnRzICsgMSkgKiAoY2FwU2VnbWVudHMgKyAxKTtcbiAgICAgICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDwgbGF0aXR1ZGVCYW5kczsgKytsYXQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGxvbiA9IDA7IGxvbiA8IGxvbmdpdHVkZUJhbmRzOyArK2xvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0ICA9IChsYXQgKiAobG9uZ2l0dWRlQmFuZHMgKyAxKSkgKyBsb247XG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gZmlyc3QgKyBsb25naXR1ZGVCYW5kcyArIDE7XG5cbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQsIG9mZnNldCArIGZpcnN0KTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2gob2Zmc2V0ICsgZmlyc3QgKyAxLCBvZmZzZXQgKyBzZWNvbmQgKyAxLCBvZmZzZXQgKyBzZWNvbmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgYm90dG9tIGNhcFxuICAgICAgICBmb3IgKGxldCBsYXQgPSAwOyBsYXQgPD0gbGF0aXR1ZGVCYW5kczsgbGF0KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gTWF0aC5QSSAqIDAuNSArIChsYXQgKiBNYXRoLlBJICogMC41KSAvIGxhdGl0dWRlQmFuZHM7XG4gICAgICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5jb3ModGhldGEpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPD0gbG9uZ2l0dWRlQmFuZHM7IGxvbisrKSB7XG4gICAgICAgICAgICAgICAgLy8gU3dlZXAgdGhlIHNwaGVyZSBmcm9tIHRoZSBwb3NpdGl2ZSBaIGF4aXMgdG8gbWF0Y2ggYSAzRFMgTWF4IHNwaGVyZVxuICAgICAgICAgICAgICAgIGNvbnN0IHBoaSA9IGxvbiAqIDIgKiBNYXRoLlBJIC8gbG9uZ2l0dWRlQmFuZHMgLSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgICAgICBjb25zdCBzaW5QaGkgPSBNYXRoLnNpbihwaGkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvc1BoaSA9IE1hdGguY29zKHBoaSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gY29zUGhpICogc2luVGhldGE7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IGNvc1RoZXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBzaW5QaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSBsb24gLyBsb25naXR1ZGVCYW5kcztcbiAgICAgICAgICAgICAgICBsZXQgdiA9IDEgLSBsYXQgLyBsYXRpdHVkZUJhbmRzO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIHBlYWtSYWRpdXMsIHkgKiBwZWFrUmFkaXVzIC0gY2FwT2Zmc2V0LCB6ICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDNyZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDIuMCAvIDM7XG4gICAgICAgICAgICAgICAgdXZzMS5wdXNoKHUsIDEgLSB2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9mZnNldCA9IChoZWlnaHRTZWdtZW50cyArIDEpICogKGNhcFNlZ21lbnRzICsgMSkgKyAobG9uZ2l0dWRlQmFuZHMgKyAxKSAqIChsYXRpdHVkZUJhbmRzICsgMSk7XG4gICAgICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8IGxhdGl0dWRlQmFuZHM7ICsrbGF0KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBsb24gPSAwOyBsb24gPCBsb25naXR1ZGVCYW5kczsgKytsb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXJzdCAgPSAobGF0ICogKGxvbmdpdHVkZUJhbmRzICsgMSkpICsgbG9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9IGZpcnN0ICsgbG9uZ2l0dWRlQmFuZHMgKyAxO1xuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kLCBvZmZzZXQgKyBmaXJzdCk7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCArIGZpcnN0ICsgMSwgb2Zmc2V0ICsgc2Vjb25kICsgMSwgb2Zmc2V0ICsgc2Vjb25kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEdlbmVyYXRlIGJvdHRvbSBjYXBcbiAgICAgICAgb2Zmc2V0ID0gKGhlaWdodFNlZ21lbnRzICsgMSkgKiAoY2FwU2VnbWVudHMgKyAxKTtcbiAgICAgICAgaWYgKGJhc2VSYWRpdXMgPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcFNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0aGV0YSA9IChpIC8gY2FwU2VnbWVudHMpICogMiAqIE1hdGguUEk7XG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBjb25zdCB5ID0gLWhlaWdodCAvIDI7XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IE1hdGguY29zKHRoZXRhKTtcbiAgICAgICAgICAgICAgICBsZXQgdSA9IDEgLSAoeCArIDEpIC8gMjtcbiAgICAgICAgICAgICAgICBsZXQgdiA9ICh6ICsgMSkgLyAyO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zLnB1c2goeCAqIGJhc2VSYWRpdXMsIHksIHogKiBiYXNlUmFkaXVzKTtcbiAgICAgICAgICAgICAgICBub3JtYWxzLnB1c2goMCwgLTEsIDApO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDJuZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDEgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCwgb2Zmc2V0ICsgaSwgb2Zmc2V0ICsgaSAtIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIHRvcCBjYXBcbiAgICAgICAgb2Zmc2V0ICs9IGNhcFNlZ21lbnRzO1xuICAgICAgICBpZiAocGVha1JhZGl1cyA+IDApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FwU2VnbWVudHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRoZXRhID0gKGkgLyBjYXBTZWdtZW50cykgKiAyICogTWF0aC5QSTtcbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gTWF0aC5zaW4odGhldGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSBoZWlnaHQgLyAyO1xuICAgICAgICAgICAgICAgIGNvbnN0IHogPSBNYXRoLmNvcyh0aGV0YSk7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSAxIC0gKHggKyAxKSAvIDI7XG4gICAgICAgICAgICAgICAgbGV0IHYgPSAoeiArIDEpIC8gMjtcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiBwZWFrUmFkaXVzLCB5LCB6ICogcGVha1JhZGl1cyk7XG4gICAgICAgICAgICAgICAgbm9ybWFscy5wdXNoKDAsIDEsIDApO1xuICAgICAgICAgICAgICAgIHV2cy5wdXNoKHUsIDEgLSB2KTtcblxuICAgICAgICAgICAgICAgIC8vIFBhY2sgVVYxIHRvIDNyZCB0aGlyZFxuICAgICAgICAgICAgICAgIHUgPSB1ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB2ID0gdiAqIHByaW1pdGl2ZVV2MVBhZGRpbmdTY2FsZSArIHByaW1pdGl2ZVV2MVBhZGRpbmc7XG4gICAgICAgICAgICAgICAgdSAvPSAzO1xuICAgICAgICAgICAgICAgIHYgLz0gMztcbiAgICAgICAgICAgICAgICB1ICs9IDIgLyAzO1xuICAgICAgICAgICAgICAgIHV2czEucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICBpZiAoaSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKG9mZnNldCwgb2Zmc2V0ICsgaSAtIDEsIG9mZnNldCArIGkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHBvc2l0aW9uczogcG9zaXRpb25zLFxuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzMSxcbiAgICAgICAgaW5kaWNlczogaW5kaWNlc1xuICAgIH07XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgY3lsaW5kZXItc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjeWxpbmRlciBjYW4gYmUgY29udHJvbGxlZCB2aWEgZnVuY3Rpb25cbiAqIHBhcmFtZXRlcnMuIEJ5IGRlZmF1bHQsIHRoZSBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIGN5bGluZGVyIHN0YW5kaW5nIHZlcnRpY2FsbHkgY2VudGVyZWQgb24gdGhlXG4gKiBYWi1wbGFuZSB3aXRoIGEgcmFkaXVzIG9mIDAuNSwgYSBoZWlnaHQgb2YgMS4wLCAxIGhlaWdodCBzZWdtZW50IGFuZCAyMCBjYXAgc2VnbWVudHMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBjeWxpbmRlciBpcyBjcmVhdGVkIHdpdGggVVZzIGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGN5bGluZGVyJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICogZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSB0dWJlIGZvcm1pbmcgdGhlIGJvZHkgb2YgdGhlIGN5bGluZGVyXG4gKiAoZGVmYXVsdHMgdG8gMC41KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRdIC0gVGhlIGxlbmd0aCBvZiB0aGUgYm9keSBvZiB0aGUgY3lsaW5kZXIgKGRlZmF1bHRzIHRvIDEuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIGxlbmd0aCBvZiB0aGUgY3lsaW5kZXJcbiAqIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5jYXBTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhcm91bmQgdGhlIHR1YnVsYXIgYm9keSBvZiB0aGVcbiAqIGN5bGluZGVyIChkZWZhdWx0cyB0byAyMCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBjeWxpbmRlci1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ3lsaW5kZXIoZGV2aWNlLCBvcHRzID0ge30pIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IHJhZGl1cyA9IG9wdHMucmFkaXVzID8/IDAuNTtcbiAgICBjb25zdCBoZWlnaHQgPSBvcHRzLmhlaWdodCA/PyAxO1xuICAgIGNvbnN0IGhlaWdodFNlZ21lbnRzID0gb3B0cy5oZWlnaHRTZWdtZW50cyA/PyA1O1xuICAgIGNvbnN0IGNhcFNlZ21lbnRzID0gb3B0cy5jYXBTZWdtZW50cyA/PyAyMDtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzID8/IGZhbHNlO1xuXG4gICAgLy8gQ3JlYXRlIHZlcnRleCBkYXRhIGZvciBhIGNvbmUgdGhhdCBoYXMgYSBiYXNlIGFuZCBwZWFrIHJhZGl1cyB0aGF0IGlzIHRoZSBzYW1lIChpLmUuIGEgY3lsaW5kZXIpXG4gICAgY29uc3Qgb3B0aW9ucyA9IF9jcmVhdGVDb25lRGF0YShyYWRpdXMsIHJhZGl1cywgaGVpZ2h0LCBoZWlnaHRTZWdtZW50cywgY2FwU2VnbWVudHMsIGZhbHNlKTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zLm5vcm1hbHMsIG9wdGlvbnMudXZzLCBvcHRpb25zLmluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgb3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIGNhcHN1bGUtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBjYXBzdWxlIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvblxuICogcGFyYW1ldGVycy4gQnkgZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgY2Fwc3VsZSBzdGFuZGluZyB2ZXJ0aWNhbGx5IGNlbnRlcmVkIG9uIHRoZVxuICogWFotcGxhbmUgd2l0aCBhIHJhZGl1cyBvZiAwLjI1LCBhIGhlaWdodCBvZiAxLjAsIDEgaGVpZ2h0IHNlZ21lbnQgYW5kIDEwIGNhcCBzZWdtZW50cy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGNhcHN1bGUgaXMgY3JlYXRlZCB3aXRoIFVWcyBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBBZGRpdGlvbmFsbHksIHRhbmdlbnRcbiAqIGluZm9ybWF0aW9uIGlzIGdlbmVyYXRlZCBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyIG9mIHRoZSBjYXBzdWxlJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICogZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSB0dWJlIGZvcm1pbmcgdGhlIGJvZHkgb2YgdGhlIGNhcHN1bGUgKGRlZmF1bHRzXG4gKiB0byAwLjMpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmhlaWdodF0gLSBUaGUgbGVuZ3RoIG9mIHRoZSBib2R5IG9mIHRoZSBjYXBzdWxlIGZyb20gdGlwIHRvIHRpcCAoZGVmYXVsdHNcbiAqIHRvIDEuMCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuaGVpZ2h0U2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIHR1YnVsYXIgbGVuZ3RoIG9mIHRoZVxuICogY2Fwc3VsZSAoZGVmYXVsdHMgdG8gMSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuc2lkZXNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYXJvdW5kIHRoZSB0dWJ1bGFyIGJvZHkgb2YgdGhlIGNhcHN1bGVcbiAqIChkZWZhdWx0cyB0byAyMCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBjeWxpbmRlci1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2Fwc3VsZShkZXZpY2UsIG9wdHMgPSB7fSkge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgcmFkaXVzID0gb3B0cy5yYWRpdXMgPz8gMC4zO1xuICAgIGNvbnN0IGhlaWdodCA9IG9wdHMuaGVpZ2h0ID8/IDE7XG4gICAgY29uc3QgaGVpZ2h0U2VnbWVudHMgPSBvcHRzLmhlaWdodFNlZ21lbnRzID8/IDE7XG4gICAgY29uc3Qgc2lkZXMgPSBvcHRzLnNpZGVzID8/IDIwO1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgPz8gZmFsc2U7XG5cbiAgICAvLyBDcmVhdGUgdmVydGV4IGRhdGEgZm9yIGEgY29uZSB0aGF0IGhhcyBhIGJhc2UgYW5kIHBlYWsgcmFkaXVzIHRoYXQgaXMgdGhlIHNhbWUgKGkuZS4gYSBjeWxpbmRlcilcbiAgICBjb25zdCBvcHRpb25zID0gX2NyZWF0ZUNvbmVEYXRhKHJhZGl1cywgcmFkaXVzLCBoZWlnaHQgLSAyICogcmFkaXVzLCBoZWlnaHRTZWdtZW50cywgc2lkZXMsIHRydWUpO1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMob3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMubm9ybWFscywgb3B0aW9ucy51dnMsIG9wdGlvbnMuaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBvcHRpb25zLnBvc2l0aW9ucywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIHByb2NlZHVyYWwgY29uZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSwgc2hhcGUgYW5kIHRlc3NlbGF0aW9uIHByb3BlcnRpZXMgb2YgdGhlIGNvbmUgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uXG4gKiBwYXJhbWV0ZXJzLiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBjb25lIHN0YW5kaW5nIHZlcnRpY2FsbHkgY2VudGVyZWQgb24gdGhlXG4gKiBYWi1wbGFuZSB3aXRoIGEgYmFzZSByYWRpdXMgb2YgMC41LCBhIGhlaWdodCBvZiAxLjAsIDUgaGVpZ2h0IHNlZ21lbnRzIGFuZCAyMCBjYXAgc2VnbWVudHMuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBjb25lIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50IGluZm9ybWF0aW9uXG4gKiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgY29uZSdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5iYXNlUmFkaXVzXSAtIFRoZSBiYXNlIHJhZGl1cyBvZiB0aGUgY29uZSAoZGVmYXVsdHMgdG8gMC41KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5wZWFrUmFkaXVzXSAtIFRoZSBwZWFrIHJhZGl1cyBvZiB0aGUgY29uZSAoZGVmYXVsdHMgdG8gMC4wKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRdIC0gVGhlIGxlbmd0aCBvZiB0aGUgYm9keSBvZiB0aGUgY29uZSAoZGVmYXVsdHMgdG8gMS4wKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgbGVuZ3RoIG9mIHRoZSBjb25lXG4gKiAoZGVmYXVsdHMgdG8gNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMuY2FwU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYXJvdW5kIHRoZSB0dWJ1bGFyIGJvZHkgb2YgdGhlIGNvbmVcbiAqIChkZWZhdWx0cyB0byAxOCkuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzXSAtIEdlbmVyYXRlIHRhbmdlbnQgaW5mb3JtYXRpb24gKGRlZmF1bHRzIHRvIGZhbHNlKS5cbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBjb25lLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVDb25lKGRldmljZSwgb3B0cyA9IHt9KSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCBiYXNlUmFkaXVzID0gb3B0cy5iYXNlUmFkaXVzID8/IDAuNTtcbiAgICBjb25zdCBwZWFrUmFkaXVzID0gb3B0cy5wZWFrUmFkaXVzID8/IDA7XG4gICAgY29uc3QgaGVpZ2h0ID0gb3B0cy5oZWlnaHQgPz8gMTtcbiAgICBjb25zdCBoZWlnaHRTZWdtZW50cyA9IG9wdHMuaGVpZ2h0U2VnbWVudHMgPz8gNTtcbiAgICBjb25zdCBjYXBTZWdtZW50cyA9IG9wdHMuY2FwU2VnbWVudHMgPz8gMTg7XG4gICAgY29uc3QgY2FsY1RhbmdlbnRzID0gb3B0cy5jYWxjdWxhdGVUYW5nZW50cyA/PyBmYWxzZTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSBfY3JlYXRlQ29uZURhdGEoYmFzZVJhZGl1cywgcGVha1JhZGl1cywgaGVpZ2h0LCBoZWlnaHRTZWdtZW50cywgY2FwU2VnbWVudHMsIGZhbHNlKTtcblxuICAgIGlmIChjYWxjVGFuZ2VudHMpIHtcbiAgICAgICAgb3B0aW9ucy50YW5nZW50cyA9IGNhbGN1bGF0ZVRhbmdlbnRzKG9wdGlvbnMucG9zaXRpb25zLCBvcHRpb25zLm5vcm1hbHMsIG9wdGlvbnMudXZzLCBvcHRpb25zLmluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgb3B0aW9ucy5wb3NpdGlvbnMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9jZWR1cmFsIHNwaGVyZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgc3BoZXJlIGNhbiBiZSBjb250cm9sbGVkIHZpYSBmdW5jdGlvbiBwYXJhbWV0ZXJzLiBCeVxuICogZGVmYXVsdCwgdGhlIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgc3BoZXJlIGNlbnRlcmVkIG9uIHRoZSBvYmplY3Qgc3BhY2Ugb3JpZ2luIHdpdGggYSByYWRpdXMgb2ZcbiAqIDAuNSBhbmQgMTYgc2VnbWVudHMgaW4gYm90aCBsb25naXR1ZGUgYW5kIGxhdGl0dWRlLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgc3BoZXJlIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgc3BoZXJlJ3MgbWVzaC5cbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICogZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoZSBtZXNoLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAtIEFuIG9iamVjdCB0aGF0IHNwZWNpZmllcyBvcHRpb25hbCBpbnB1dHMgZm9yIHRoZSBmdW5jdGlvbiBhcyBmb2xsb3dzOlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLnJhZGl1c10gLSBUaGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUgKGRlZmF1bHRzIHRvIDAuNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubGF0aXR1ZGVCYW5kc10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgbGF0aXR1ZGluYWwgYXhpcyBvZiB0aGVcbiAqIHNwaGVyZSAoZGVmYXVsdHMgdG8gMTYpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRzLmxvbmdpdHVkZUJhbmRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBsb25naXR1ZGluYWwgYXhpcyBvZlxuICogdGhlIHNwaGVyZSAoZGVmYXVsdHMgdG8gMTYpLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5jYWxjdWxhdGVUYW5nZW50c10gLSBHZW5lcmF0ZSB0YW5nZW50IGluZm9ybWF0aW9uIChkZWZhdWx0cyB0byBmYWxzZSkuXG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgc3BoZXJlLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVTcGhlcmUoZGV2aWNlLCBvcHRzID0ge30pIHtcbiAgICAvLyBDaGVjayB0aGUgc3VwcGxpZWQgb3B0aW9ucyBhbmQgcHJvdmlkZSBkZWZhdWx0cyBmb3IgdW5zcGVjaWZpZWQgb25lc1xuICAgIGNvbnN0IHJhZGl1cyA9IG9wdHMucmFkaXVzID8/IDAuNTtcbiAgICBjb25zdCBsYXRpdHVkZUJhbmRzID0gb3B0cy5sYXRpdHVkZUJhbmRzID8/IDE2O1xuICAgIGNvbnN0IGxvbmdpdHVkZUJhbmRzID0gb3B0cy5sb25naXR1ZGVCYW5kcyA/PyAxNjtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzID8/IGZhbHNlO1xuXG4gICAgLy8gVmFyaWFibGUgZGVjbGFyYXRpb25zXG4gICAgY29uc3QgcG9zaXRpb25zID0gW107XG4gICAgY29uc3Qgbm9ybWFscyA9IFtdO1xuICAgIGNvbnN0IHV2cyA9IFtdO1xuICAgIGNvbnN0IGluZGljZXMgPSBbXTtcblxuICAgIGZvciAobGV0IGxhdCA9IDA7IGxhdCA8PSBsYXRpdHVkZUJhbmRzOyBsYXQrKykge1xuICAgICAgICBjb25zdCB0aGV0YSA9IGxhdCAqIE1hdGguUEkgLyBsYXRpdHVkZUJhbmRzO1xuICAgICAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc2luKHRoZXRhKTtcbiAgICAgICAgY29uc3QgY29zVGhldGEgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDw9IGxvbmdpdHVkZUJhbmRzOyBsb24rKykge1xuICAgICAgICAgICAgLy8gU3dlZXAgdGhlIHNwaGVyZSBmcm9tIHRoZSBwb3NpdGl2ZSBaIGF4aXMgdG8gbWF0Y2ggYSAzRFMgTWF4IHNwaGVyZVxuICAgICAgICAgICAgY29uc3QgcGhpID0gbG9uICogMiAqIE1hdGguUEkgLyBsb25naXR1ZGVCYW5kcyAtIE1hdGguUEkgLyAyO1xuICAgICAgICAgICAgY29uc3Qgc2luUGhpID0gTWF0aC5zaW4ocGhpKTtcbiAgICAgICAgICAgIGNvbnN0IGNvc1BoaSA9IE1hdGguY29zKHBoaSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHggPSBjb3NQaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgIGNvbnN0IHkgPSBjb3NUaGV0YTtcbiAgICAgICAgICAgIGNvbnN0IHogPSBzaW5QaGkgKiBzaW5UaGV0YTtcbiAgICAgICAgICAgIGNvbnN0IHUgPSAxIC0gbG9uIC8gbG9uZ2l0dWRlQmFuZHM7XG4gICAgICAgICAgICBjb25zdCB2ID0gMSAtIGxhdCAvIGxhdGl0dWRlQmFuZHM7XG5cbiAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHggKiByYWRpdXMsIHkgKiByYWRpdXMsIHogKiByYWRpdXMpO1xuICAgICAgICAgICAgbm9ybWFscy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgbGF0ID0gMDsgbGF0IDwgbGF0aXR1ZGVCYW5kczsgKytsYXQpIHtcbiAgICAgICAgZm9yIChsZXQgbG9uID0gMDsgbG9uIDwgbG9uZ2l0dWRlQmFuZHM7ICsrbG9uKSB7XG4gICAgICAgICAgICBjb25zdCBmaXJzdCAgPSAobGF0ICogKGxvbmdpdHVkZUJhbmRzICsgMSkpICsgbG9uO1xuICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gZmlyc3QgKyBsb25naXR1ZGVCYW5kcyArIDE7XG5cbiAgICAgICAgICAgIGluZGljZXMucHVzaChmaXJzdCArIDEsIHNlY29uZCwgZmlyc3QpO1xuICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGZpcnN0ICsgMSwgc2Vjb25kICsgMSwgc2Vjb25kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIG5vcm1hbHM6IG5vcm1hbHMsXG4gICAgICAgIHV2czogdXZzLFxuICAgICAgICB1dnMxOiB1dnMsIC8vIFVWMSA9IFVWMCBmb3Igc3BoZXJlXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBwbGFuZS1zaGFwZWQgbWVzaC5cbiAqXG4gKiBUaGUgc2l6ZSBhbmQgdGVzc2VsYXRpb24gcHJvcGVydGllcyBvZiB0aGUgcGxhbmUgY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uIHBhcmFtZXRlcnMuIEJ5XG4gKiBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBwbGFuZSBjZW50ZXJlZCBvbiB0aGUgb2JqZWN0IHNwYWNlIG9yaWdpbiB3aXRoIGEgd2lkdGggYW5kXG4gKiBsZW5ndGggb2YgMS4wIGFuZCA1IHNlZ21lbnRzIGluIGVpdGhlciBheGlzICg1MCB0cmlhbmdsZXMpLiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgcGxhbmUgaXNcbiAqIGFsaWduZWQgYWxvbmcgdGhlIHBvc2l0aXZlIFkgYXhpcy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHBsYW5lIGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gQWRkaXRpb25hbGx5LCB0YW5nZW50XG4gKiBpbmZvcm1hdGlvbiBpcyBnZW5lcmF0ZWQgaW50byB0aGUgdmVydGV4IGJ1ZmZlciBvZiB0aGUgcGxhbmUncyBtZXNoLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gKiBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdHNdIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcGFyYW0ge1ZlYzJ9IFtvcHRzLmhhbGZFeHRlbnRzXSAtIFRoZSBoYWxmIGRpbWVuc2lvbnMgb2YgdGhlIHBsYW5lIGluIHRoZSBYIGFuZCBaIGF4ZXNcbiAqIChkZWZhdWx0cyB0byBbMC41LCAwLjVdKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy53aWR0aFNlZ21lbnRzXSAtIFRoZSBudW1iZXIgb2YgZGl2aXNpb25zIGFsb25nIHRoZSBYIGF4aXMgb2YgdGhlIHBsYW5lXG4gKiAoZGVmYXVsdHMgdG8gNSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMubGVuZ3RoU2VnbWVudHNdIC0gVGhlIG51bWJlciBvZiBkaXZpc2lvbnMgYWxvbmcgdGhlIFogYXhpcyBvZiB0aGUgcGxhbmVcbiAqIChkZWZhdWx0cyB0byA1KS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IHBsYW5lLXNoYXBlZCBtZXNoLlxuICovXG5mdW5jdGlvbiBjcmVhdGVQbGFuZShkZXZpY2UsIG9wdHMgPSB7fSkge1xuICAgIC8vIENoZWNrIHRoZSBzdXBwbGllZCBvcHRpb25zIGFuZCBwcm92aWRlIGRlZmF1bHRzIGZvciB1bnNwZWNpZmllZCBvbmVzXG4gICAgY29uc3QgaGUgPSBvcHRzLmhhbGZFeHRlbnRzID8/IG5ldyBWZWMyKDAuNSwgMC41KTtcbiAgICBjb25zdCB3cyA9IG9wdHMud2lkdGhTZWdtZW50cyA/PyA1O1xuICAgIGNvbnN0IGxzID0gb3B0cy5sZW5ndGhTZWdtZW50cyA/PyA1O1xuICAgIGNvbnN0IGNhbGNUYW5nZW50cyA9IG9wdHMuY2FsY3VsYXRlVGFuZ2VudHMgPz8gZmFsc2U7XG5cbiAgICAvLyBWYXJpYWJsZSBkZWNsYXJhdGlvbnNcbiAgICBjb25zdCBwb3NpdGlvbnMgPSBbXTtcbiAgICBjb25zdCBub3JtYWxzID0gW107XG4gICAgY29uc3QgdXZzID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgcGxhbmUgYXMgZm9sbG93cyAoYXNzaWduZWQgVVZzIGRlbm90ZWQgYXQgY29ybmVycyk6XG4gICAgLy8gKDAsMSl4LS0tLS0tLS0teCgxLDEpXG4gICAgLy8gICAgICB8ICAgICAgICAgfFxuICAgIC8vICAgICAgfCAgICAgICAgIHxcbiAgICAvLyAgICAgIHwgICAgTy0tWCB8bGVuZ3RoXG4gICAgLy8gICAgICB8ICAgIHwgICAgfFxuICAgIC8vICAgICAgfCAgICBaICAgIHxcbiAgICAvLyAoMCwwKXgtLS0tLS0tLS14KDEsMClcbiAgICAvLyB3aWR0aFxuICAgIGxldCB2Y291bnRlciA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSB3czsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IGxzOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSAtaGUueCArIDIgKiBoZS54ICogaSAvIHdzO1xuICAgICAgICAgICAgY29uc3QgeSA9IDAuMDtcbiAgICAgICAgICAgIGNvbnN0IHogPSAtKC1oZS55ICsgMiAqIGhlLnkgKiBqIC8gbHMpO1xuICAgICAgICAgICAgY29uc3QgdSA9IGkgLyB3cztcbiAgICAgICAgICAgIGNvbnN0IHYgPSBqIC8gbHM7XG5cbiAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHgsIHksIHopO1xuICAgICAgICAgICAgbm9ybWFscy5wdXNoKDAsIDEsIDApO1xuICAgICAgICAgICAgdXZzLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICBpZiAoKGkgPCB3cykgJiYgKGogPCBscykpIHtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2godmNvdW50ZXIgKyBscyArIDEsIHZjb3VudGVyICsgMSwgdmNvdW50ZXIpO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCh2Y291bnRlciArIGxzICsgMSwgdmNvdW50ZXIgKyBscyArIDIsIHZjb3VudGVyICsgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZjb3VudGVyKys7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBub3JtYWxzOiBub3JtYWxzLFxuICAgICAgICB1dnM6IHV2cyxcbiAgICAgICAgdXZzMTogdXZzLCAvLyBVVjEgPSBVVjAgZm9yIHBsYW5lXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcHJvY2VkdXJhbCBib3gtc2hhcGVkIG1lc2guXG4gKlxuICogVGhlIHNpemUsIHNoYXBlIGFuZCB0ZXNzZWxhdGlvbiBwcm9wZXJ0aWVzIG9mIHRoZSBib3ggY2FuIGJlIGNvbnRyb2xsZWQgdmlhIGZ1bmN0aW9uIHBhcmFtZXRlcnMuXG4gKiBCeSBkZWZhdWx0LCB0aGUgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBib3ggY2VudGVyZWQgb24gdGhlIG9iamVjdCBzcGFjZSBvcmlnaW4gd2l0aCBhIHdpZHRoLFxuICogbGVuZ3RoIGFuZCBoZWlnaHQgb2YgMS4wIHVuaXQgYW5kIDEwIHNlZ21lbnRzIGluIGVpdGhlciBheGlzICg1MCB0cmlhbmdsZXMgcGVyIGZhY2UpLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgYm94IGlzIGNyZWF0ZWQgd2l0aCBVVnMgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMSBvbiBlYWNoIGZhY2UuIEFkZGl0aW9uYWxseSwgdGFuZ2VudFxuICogaW5mb3JtYXRpb24gaXMgZ2VuZXJhdGVkIGludG8gdGhlIHZlcnRleCBidWZmZXIgb2YgdGhlIGJveCdzIG1lc2guXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAqIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEBwYXJhbSB7VmVjM30gW29wdHMuaGFsZkV4dGVudHNdIC0gVGhlIGhhbGYgZGltZW5zaW9ucyBvZiB0aGUgYm94IGluIGVhY2ggYXhpcyAoZGVmYXVsdHMgdG9cbiAqIFswLjUsIDAuNSwgMC41XSkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdHMud2lkdGhTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWCBheGlzIG9mIHRoZSBib3hcbiAqIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5sZW5ndGhTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWiBheGlzIG9mIHRoZSBib3hcbiAqIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5oZWlnaHRTZWdtZW50c10gLSBUaGUgbnVtYmVyIG9mIGRpdmlzaW9ucyBhbG9uZyB0aGUgWSBheGlzIG9mIHRoZSBib3hcbiAqIChkZWZhdWx0cyB0byAxKS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuY2FsY3VsYXRlVGFuZ2VudHNdIC0gR2VuZXJhdGUgdGFuZ2VudCBpbmZvcm1hdGlvbiAoZGVmYXVsdHMgdG8gZmFsc2UpLlxuICogQHJldHVybnMge01lc2h9IEEgbmV3IGJveC1zaGFwZWQgbWVzaC5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQm94KGRldmljZSwgb3B0cyA9IHt9KSB7XG4gICAgLy8gQ2hlY2sgdGhlIHN1cHBsaWVkIG9wdGlvbnMgYW5kIHByb3ZpZGUgZGVmYXVsdHMgZm9yIHVuc3BlY2lmaWVkIG9uZXNcbiAgICBjb25zdCBoZSA9IG9wdHMuaGFsZkV4dGVudHMgPz8gbmV3IFZlYzMoMC41LCAwLjUsIDAuNSk7XG4gICAgY29uc3Qgd3MgPSBvcHRzLndpZHRoU2VnbWVudHMgPz8gMTtcbiAgICBjb25zdCBscyA9IG9wdHMubGVuZ3RoU2VnbWVudHMgPz8gMTtcbiAgICBjb25zdCBocyA9IG9wdHMuaGVpZ2h0U2VnbWVudHMgPz8gMTtcbiAgICBjb25zdCBjYWxjVGFuZ2VudHMgPSBvcHRzLmNhbGN1bGF0ZVRhbmdlbnRzID8/IGZhbHNlO1xuXG4gICAgY29uc3QgY29ybmVycyA9IFtcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIC1oZS55LCBoZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgLWhlLnksIGhlLnopLFxuICAgICAgICBuZXcgVmVjMyhoZS54LCBoZS55LCBoZS56KSxcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIGhlLnksIGhlLnopLFxuICAgICAgICBuZXcgVmVjMyhoZS54LCAtaGUueSwgLWhlLnopLFxuICAgICAgICBuZXcgVmVjMygtaGUueCwgLWhlLnksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoLWhlLngsIGhlLnksIC1oZS56KSxcbiAgICAgICAgbmV3IFZlYzMoaGUueCwgaGUueSwgLWhlLnopXG4gICAgXTtcblxuICAgIGNvbnN0IGZhY2VBeGVzID0gW1xuICAgICAgICBbMCwgMSwgM10sIC8vIEZST05UXG4gICAgICAgIFs0LCA1LCA3XSwgLy8gQkFDS1xuICAgICAgICBbMywgMiwgNl0sIC8vIFRPUFxuICAgICAgICBbMSwgMCwgNF0sIC8vIEJPVFRPTVxuICAgICAgICBbMSwgNCwgMl0sIC8vIFJJR0hUXG4gICAgICAgIFs1LCAwLCA2XSAgLy8gTEVGVFxuICAgIF07XG5cbiAgICBjb25zdCBmYWNlTm9ybWFscyA9IFtcbiAgICAgICAgWzAsICAwLCAgMV0sIC8vIEZST05UXG4gICAgICAgIFswLCAgMCwgLTFdLCAvLyBCQUNLXG4gICAgICAgIFswLCAgMSwgIDBdLCAvLyBUT1BcbiAgICAgICAgWzAsIC0xLCAgMF0sIC8vIEJPVFRPTVxuICAgICAgICBbMSwgIDAsICAwXSwgLy8gUklHSFRcbiAgICAgICAgWy0xLCAgMCwgIDBdICAvLyBMRUZUXG4gICAgXTtcblxuICAgIGNvbnN0IHNpZGVzID0ge1xuICAgICAgICBGUk9OVDogMCxcbiAgICAgICAgQkFDSzogMSxcbiAgICAgICAgVE9QOiAyLFxuICAgICAgICBCT1RUT006IDMsXG4gICAgICAgIFJJR0hUOiA0LFxuICAgICAgICBMRUZUOiA1XG4gICAgfTtcblxuICAgIGNvbnN0IHBvc2l0aW9ucyA9IFtdO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBbXTtcbiAgICBjb25zdCB1dnMgPSBbXTtcbiAgICBjb25zdCB1dnMxID0gW107XG4gICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuICAgIGxldCB2Y291bnRlciA9IDA7XG5cbiAgICBjb25zdCBnZW5lcmF0ZUZhY2UgPSAoc2lkZSwgdVNlZ21lbnRzLCB2U2VnbWVudHMpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcDEgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCB0ZW1wMiA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IHRlbXAzID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgciA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gdVNlZ21lbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDw9IHZTZWdtZW50czsgaisrKSB7XG4gICAgICAgICAgICAgICAgdGVtcDEubGVycChjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzBdXSwgY29ybmVyc1tmYWNlQXhlc1tzaWRlXVsxXV0sIGkgLyB1U2VnbWVudHMpO1xuICAgICAgICAgICAgICAgIHRlbXAyLmxlcnAoY29ybmVyc1tmYWNlQXhlc1tzaWRlXVswXV0sIGNvcm5lcnNbZmFjZUF4ZXNbc2lkZV1bMl1dLCBqIC8gdlNlZ21lbnRzKTtcbiAgICAgICAgICAgICAgICB0ZW1wMy5zdWIyKHRlbXAyLCBjb3JuZXJzW2ZhY2VBeGVzW3NpZGVdWzBdXSk7XG4gICAgICAgICAgICAgICAgci5hZGQyKHRlbXAxLCB0ZW1wMyk7XG4gICAgICAgICAgICAgICAgbGV0IHUgPSBpIC8gdVNlZ21lbnRzO1xuICAgICAgICAgICAgICAgIGxldCB2ID0gaiAvIHZTZWdtZW50cztcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9ucy5wdXNoKHIueCwgci55LCByLnopO1xuICAgICAgICAgICAgICAgIG5vcm1hbHMucHVzaChmYWNlTm9ybWFsc1tzaWRlXVswXSwgZmFjZU5vcm1hbHNbc2lkZV1bMV0sIGZhY2VOb3JtYWxzW3NpZGVdWzJdKTtcbiAgICAgICAgICAgICAgICB1dnMucHVzaCh1LCAxIC0gdik7XG5cbiAgICAgICAgICAgICAgICAvLyBwYWNrIGFzIDN4Mi4gMS8zIHdpbGwgYmUgZW1wdHksIGJ1dCBpdCdzIGVpdGhlciB0aGF0IG9yIHN0cmV0Y2hlZCBwaXhlbHNcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmF0ZSBub24tcmVjdGFuZ3VsYXIgbGlnaHRNYXBzLCBzbyB3ZSBjb3VsZCB1c2Ugc3BhY2Ugd2l0aG91dCBzdHJldGNoaW5nXG4gICAgICAgICAgICAgICAgdSA9IHUgKiBwcmltaXRpdmVVdjFQYWRkaW5nU2NhbGUgKyBwcmltaXRpdmVVdjFQYWRkaW5nO1xuICAgICAgICAgICAgICAgIHYgPSB2ICogcHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlICsgcHJpbWl0aXZlVXYxUGFkZGluZztcbiAgICAgICAgICAgICAgICB1IC89IDM7XG4gICAgICAgICAgICAgICAgdiAvPSAzO1xuXG4gICAgICAgICAgICAgICAgdSArPSAoc2lkZSAlIDMpIC8gMztcbiAgICAgICAgICAgICAgICB2ICs9IE1hdGguZmxvb3Ioc2lkZSAvIDMpIC8gMztcbiAgICAgICAgICAgICAgICB1dnMxLnB1c2godSwgMSAtIHYpO1xuXG4gICAgICAgICAgICAgICAgaWYgKChpIDwgdVNlZ21lbnRzKSAmJiAoaiA8IHZTZWdtZW50cykpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZjb3VudGVyICsgdlNlZ21lbnRzICsgMSwgdmNvdW50ZXIgKyAxLCB2Y291bnRlcik7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCh2Y291bnRlciArIHZTZWdtZW50cyArIDEsIHZjb3VudGVyICsgdlNlZ21lbnRzICsgMiwgdmNvdW50ZXIgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2Y291bnRlcisrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5GUk9OVCwgd3MsIGhzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuQkFDSywgd3MsIGhzKTtcbiAgICBnZW5lcmF0ZUZhY2Uoc2lkZXMuVE9QLCB3cywgbHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5CT1RUT00sIHdzLCBscyk7XG4gICAgZ2VuZXJhdGVGYWNlKHNpZGVzLlJJR0hULCBscywgaHMpO1xuICAgIGdlbmVyYXRlRmFjZShzaWRlcy5MRUZULCBscywgaHMpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgbm9ybWFsczogbm9ybWFscyxcbiAgICAgICAgdXZzOiB1dnMsXG4gICAgICAgIHV2czE6IHV2czEsXG4gICAgICAgIGluZGljZXM6IGluZGljZXNcbiAgICB9O1xuXG4gICAgaWYgKGNhbGNUYW5nZW50cykge1xuICAgICAgICBvcHRpb25zLnRhbmdlbnRzID0gY2FsY3VsYXRlVGFuZ2VudHMocG9zaXRpb25zLCBub3JtYWxzLCB1dnMsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgcG9zaXRpb25zLCBvcHRpb25zKTtcbn1cblxuLy8gcmV0dXJucyBQcmltaXRpdmUgZGF0YSwgdXNlZCBieSBNb2RlbENvbXBvbmVudCBhbmQgUmVuZGVyQ29tcG9uZW50XG5mdW5jdGlvbiBnZXRTaGFwZVByaW1pdGl2ZShkZXZpY2UsIHR5cGUpIHtcblxuICAgIC8vIGZpbmQgaW4gY2FjaGVcbiAgICBsZXQgcHJpbURhdGEgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhcGVQcmltaXRpdmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChzaGFwZVByaW1pdGl2ZXNbaV0udHlwZSA9PT0gdHlwZSAmJiBzaGFwZVByaW1pdGl2ZXNbaV0uZGV2aWNlID09PSBkZXZpY2UpIHtcbiAgICAgICAgICAgIHByaW1EYXRhID0gc2hhcGVQcmltaXRpdmVzW2ldLnByaW1EYXRhO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gbm90IGluIGNhY2hlLCBjcmVhdGUgbmV3XG4gICAgaWYgKCFwcmltRGF0YSkge1xuXG4gICAgICAgIGxldCBtZXNoLCBhcmVhO1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcblxuICAgICAgICAgICAgY2FzZSAnYm94JzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQm94KGRldmljZSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogMiwgeTogMiwgejogMiwgdXY6ICgyLjAgLyAzKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjYXBzdWxlJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQ2Fwc3VsZShkZXZpY2UsIHsgcmFkaXVzOiAwLjUsIGhlaWdodDogMiB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAoTWF0aC5QSSAqIDIpLCB5OiBNYXRoLlBJLCB6OiAoTWF0aC5QSSAqIDIpLCB1djogKDEuMCAvIDMgKyAoKDEuMCAvIDMpIC8gMykgKiAyKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdjb25lJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlQ29uZShkZXZpY2UsIHsgYmFzZVJhZGl1czogMC41LCBwZWFrUmFkaXVzOiAwLCBoZWlnaHQ6IDEgfSk7XG4gICAgICAgICAgICAgICAgYXJlYSA9IHsgeDogMi41NCwgeTogMi41NCwgejogMi41NCwgdXY6ICgxLjAgLyAzICsgKDEuMCAvIDMpIC8gMykgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnY3lsaW5kZXInOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVDeWxpbmRlcihkZXZpY2UsIHsgcmFkaXVzOiAwLjUsIGhlaWdodDogMSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiBNYXRoLlBJLCB5OiAoMC43OSAqIDIpLCB6OiBNYXRoLlBJLCB1djogKDEuMCAvIDMgKyAoKDEuMCAvIDMpIC8gMykgKiAyKSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdwbGFuZSc6XG4gICAgICAgICAgICAgICAgbWVzaCA9IGNyZWF0ZVBsYW5lKGRldmljZSwgeyBoYWxmRXh0ZW50czogbmV3IFZlYzIoMC41LCAwLjUpLCB3aWR0aFNlZ21lbnRzOiAxLCBsZW5ndGhTZWdtZW50czogMSB9KTtcbiAgICAgICAgICAgICAgICBhcmVhID0geyB4OiAwLCB5OiAxLCB6OiAwLCB1djogMSB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdzcGhlcmUnOlxuICAgICAgICAgICAgICAgIG1lc2ggPSBjcmVhdGVTcGhlcmUoZGV2aWNlLCB7IHJhZGl1czogMC41IH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IE1hdGguUEksIHk6IE1hdGguUEksIHo6IE1hdGguUEksIHV2OiAxIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ3RvcnVzJzpcbiAgICAgICAgICAgICAgICBtZXNoID0gY3JlYXRlVG9ydXMoZGV2aWNlLCB7IHR1YmVSYWRpdXM6IDAuMiwgcmluZ1JhZGl1czogMC4zIH0pO1xuICAgICAgICAgICAgICAgIGFyZWEgPSB7IHg6IE1hdGguUEkgKiAwLjUgKiAwLjUgLSBNYXRoLlBJICogMC4xICogMC4xLCB5OiAwLjQsIHo6IDAuNCwgdXY6IDEgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJpbWl0aXZlIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluYyByZWZlcmVuY2UgdG8ga2VlcCBwcmltaXRpdmUgYWxpdmVcbiAgICAgICAgbWVzaC5pbmNSZWZDb3VudCgpO1xuXG4gICAgICAgIHByaW1EYXRhID0geyBtZXNoOiBtZXNoLCBhcmVhOiBhcmVhIH07XG5cbiAgICAgICAgLy8gYWRkIHRvIGNhY2hlXG4gICAgICAgIHNoYXBlUHJpbWl0aXZlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgICAgICBkZXZpY2U6IGRldmljZSxcbiAgICAgICAgICAgIHByaW1EYXRhOiBwcmltRGF0YVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJpbURhdGE7XG59XG5cbmV4cG9ydCB7IGNhbGN1bGF0ZU5vcm1hbHMsIGNhbGN1bGF0ZVRhbmdlbnRzLCBjcmVhdGVCb3gsIGNyZWF0ZUNhcHN1bGUsIGNyZWF0ZUNvbmUsIGNyZWF0ZUN5bGluZGVyLCBjcmVhdGVNZXNoLCBjcmVhdGVQbGFuZSwgY3JlYXRlU3BoZXJlLCBjcmVhdGVUb3J1cywgZ2V0U2hhcGVQcmltaXRpdmUgfTtcbiJdLCJuYW1lcyI6WyJwcmltaXRpdmVVdjFQYWRkaW5nIiwicHJpbWl0aXZlVXYxUGFkZGluZ1NjYWxlIiwic2hhcGVQcmltaXRpdmVzIiwiY2FsY3VsYXRlTm9ybWFscyIsInBvc2l0aW9ucyIsImluZGljZXMiLCJ0cmlhbmdsZUNvdW50IiwibGVuZ3RoIiwidmVydGV4Q291bnQiLCJwMSIsIlZlYzMiLCJwMiIsInAzIiwicDFwMiIsInAxcDMiLCJmYWNlTm9ybWFsIiwibm9ybWFscyIsImkiLCJpMSIsImkyIiwiaTMiLCJzZXQiLCJzdWIyIiwiY3Jvc3MiLCJub3JtYWxpemUiLCJ4IiwieSIsInoiLCJueCIsIm55IiwibnoiLCJpbnZMZW4iLCJNYXRoIiwic3FydCIsImNhbGN1bGF0ZVRhbmdlbnRzIiwidXZzIiwidjEiLCJ2MiIsInYzIiwidzEiLCJWZWMyIiwidzIiLCJ3MyIsInNkaXIiLCJ0ZGlyIiwidGFuMSIsIkZsb2F0MzJBcnJheSIsInRhbjIiLCJ0YW5nZW50cyIsIngxIiwieDIiLCJ5MSIsInkyIiwiejEiLCJ6MiIsInMxIiwiczIiLCJ0MSIsInQyIiwiYXJlYSIsInIiLCJuIiwidGVtcCIsIm5kb3R0IiwiZG90IiwiY29weSIsIm11bFNjYWxhciIsImNyZWF0ZU1lc2giLCJkZXZpY2UiLCJvcHRzIiwibWVzaCIsIk1lc2giLCJzZXRQb3NpdGlvbnMiLCJzZXROb3JtYWxzIiwic2V0VmVydGV4U3RyZWFtIiwiU0VNQU5USUNfVEFOR0VOVCIsImNvbG9ycyIsInNldENvbG9yczMyIiwic2V0VXZzIiwidXZzMSIsImJsZW5kSW5kaWNlcyIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIlRZUEVfVUlOVDgiLCJibGVuZFdlaWdodHMiLCJTRU1BTlRJQ19CTEVORFdFSUdIVCIsInNldEluZGljZXMiLCJ1cGRhdGUiLCJjcmVhdGVUb3J1cyIsIl9vcHRzJHR1YmVSYWRpdXMiLCJfb3B0cyRyaW5nUmFkaXVzIiwiX29wdHMkc2VnbWVudHMiLCJfb3B0cyRzaWRlcyIsIl9vcHRzJGNhbGN1bGF0ZVRhbmdlbiIsInJjIiwidHViZVJhZGl1cyIsInJ0IiwicmluZ1JhZGl1cyIsInNlZ21lbnRzIiwic2lkZXMiLCJjYWxjVGFuZ2VudHMiLCJqIiwiY29zIiwiUEkiLCJzaW4iLCJ1IiwidiIsInB1c2giLCJmaXJzdCIsInNlY29uZCIsInRoaXJkIiwiZm91cnRoIiwib3B0aW9ucyIsIl9jcmVhdGVDb25lRGF0YSIsImJhc2VSYWRpdXMiLCJwZWFrUmFkaXVzIiwiaGVpZ2h0IiwiaGVpZ2h0U2VnbWVudHMiLCJjYXBTZWdtZW50cyIsInJvdW5kZWRDYXBzIiwicG9zIiwiYm90dG9tVG9Ub3AiLCJub3JtIiwidG9wIiwiYm90dG9tIiwidGFuZ2VudCIsIm9mZnNldCIsInRoZXRhIiwic2luVGhldGEiLCJjb3NUaGV0YSIsImxlcnAiLCJfdiIsImxhdGl0dWRlQmFuZHMiLCJmbG9vciIsImxvbmdpdHVkZUJhbmRzIiwiY2FwT2Zmc2V0IiwibGF0IiwibG9uIiwicGhpIiwic2luUGhpIiwiY29zUGhpIiwiY3JlYXRlQ3lsaW5kZXIiLCJfb3B0cyRyYWRpdXMiLCJfb3B0cyRoZWlnaHQiLCJfb3B0cyRoZWlnaHRTZWdtZW50cyIsIl9vcHRzJGNhcFNlZ21lbnRzIiwiX29wdHMkY2FsY3VsYXRlVGFuZ2VuMiIsInJhZGl1cyIsImNyZWF0ZUNhcHN1bGUiLCJfb3B0cyRyYWRpdXMyIiwiX29wdHMkaGVpZ2h0MiIsIl9vcHRzJGhlaWdodFNlZ21lbnRzMiIsIl9vcHRzJHNpZGVzMiIsIl9vcHRzJGNhbGN1bGF0ZVRhbmdlbjMiLCJjcmVhdGVDb25lIiwiX29wdHMkYmFzZVJhZGl1cyIsIl9vcHRzJHBlYWtSYWRpdXMiLCJfb3B0cyRoZWlnaHQzIiwiX29wdHMkaGVpZ2h0U2VnbWVudHMzIiwiX29wdHMkY2FwU2VnbWVudHMyIiwiX29wdHMkY2FsY3VsYXRlVGFuZ2VuNCIsImNyZWF0ZVNwaGVyZSIsIl9vcHRzJHJhZGl1czMiLCJfb3B0cyRsYXRpdHVkZUJhbmRzIiwiX29wdHMkbG9uZ2l0dWRlQmFuZHMiLCJfb3B0cyRjYWxjdWxhdGVUYW5nZW41IiwiY3JlYXRlUGxhbmUiLCJfb3B0cyRoYWxmRXh0ZW50cyIsIl9vcHRzJHdpZHRoU2VnbWVudHMiLCJfb3B0cyRsZW5ndGhTZWdtZW50cyIsIl9vcHRzJGNhbGN1bGF0ZVRhbmdlbjYiLCJoZSIsImhhbGZFeHRlbnRzIiwid3MiLCJ3aWR0aFNlZ21lbnRzIiwibHMiLCJsZW5ndGhTZWdtZW50cyIsInZjb3VudGVyIiwiY3JlYXRlQm94IiwiX29wdHMkaGFsZkV4dGVudHMyIiwiX29wdHMkd2lkdGhTZWdtZW50czIiLCJfb3B0cyRsZW5ndGhTZWdtZW50czIiLCJfb3B0cyRoZWlnaHRTZWdtZW50czQiLCJfb3B0cyRjYWxjdWxhdGVUYW5nZW43IiwiaHMiLCJjb3JuZXJzIiwiZmFjZUF4ZXMiLCJmYWNlTm9ybWFscyIsIkZST05UIiwiQkFDSyIsIlRPUCIsIkJPVFRPTSIsIlJJR0hUIiwiTEVGVCIsImdlbmVyYXRlRmFjZSIsInNpZGUiLCJ1U2VnbWVudHMiLCJ2U2VnbWVudHMiLCJ0ZW1wMSIsInRlbXAyIiwidGVtcDMiLCJhZGQyIiwiZ2V0U2hhcGVQcmltaXRpdmUiLCJ0eXBlIiwicHJpbURhdGEiLCJ1diIsIkVycm9yIiwiaW5jUmVmQ291bnQiXSwibWFwcGluZ3MiOiI7Ozs7O0FBVUEsTUFBTUEsbUJBQW1CLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQTtBQUNwQyxNQUFNQyx3QkFBd0IsR0FBRyxHQUFHLEdBQUdELG1CQUFtQixHQUFHLENBQUMsQ0FBQTs7QUFFOUQ7QUFDQSxNQUFNRSxlQUFlLEdBQUcsRUFBRSxDQUFBOztBQUUxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyxnQkFBZ0JBLENBQUNDLFNBQVMsRUFBRUMsT0FBTyxFQUFFO0FBQzFDLEVBQUEsTUFBTUMsYUFBYSxHQUFHRCxPQUFPLENBQUNFLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDeEMsRUFBQSxNQUFN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
