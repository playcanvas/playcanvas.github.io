import { Vec3 } from '../../core/math/vec3.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;
class BoxGeometry extends Geometry {
  constructor(opts = {}) {
    var _opts$halfExtents, _opts$widthSegments, _opts$lengthSegments, _opts$heightSegments, _opts$yOffset;
    super();
    const he = (_opts$halfExtents = opts.halfExtents) != null ? _opts$halfExtents : new Vec3(0.5, 0.5, 0.5);
    const ws = (_opts$widthSegments = opts.widthSegments) != null ? _opts$widthSegments : 1;
    const ls = (_opts$lengthSegments = opts.lengthSegments) != null ? _opts$lengthSegments : 1;
    const hs = (_opts$heightSegments = opts.heightSegments) != null ? _opts$heightSegments : 1;
    const yOffset = (_opts$yOffset = opts.yOffset) != null ? _opts$yOffset : 0;
    const minY = -he.y + yOffset;
    const maxY = he.y + yOffset;
    const corners = [new Vec3(-he.x, minY, he.z), new Vec3(he.x, minY, he.z), new Vec3(he.x, maxY, he.z), new Vec3(-he.x, maxY, he.z), new Vec3(he.x, minY, -he.z), new Vec3(-he.x, minY, -he.z), new Vec3(-he.x, maxY, -he.z), new Vec3(he.x, maxY, -he.z)];
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
    this.positions = positions;
    this.normals = normals;
    this.uvs = uvs;
    this.uvs1 = uvs;
    this.indices = indices;
    if (opts.calculateTangents) {
      this.tangents = calculateTangents(positions, normals, uvs, indices);
    }
  }
}

export { BoxGeometry };
