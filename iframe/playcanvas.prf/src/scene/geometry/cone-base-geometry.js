import { Vec3 } from '../../core/math/vec3.js';
import { Geometry } from './geometry.js';

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;
class ConeBaseGeometry extends Geometry {
  constructor(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
    super();
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
    this.positions = positions;
    this.normals = normals;
    this.uvs = uvs;
    this.uvs1 = uvs1;
    this.indices = indices;
  }
}

export { ConeBaseGeometry };
