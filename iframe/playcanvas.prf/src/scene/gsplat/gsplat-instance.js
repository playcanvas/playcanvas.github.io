import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { SEMANTIC_POSITION, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { createGSplatMaterial } from './gsplat-material.js';
import { GSplatSorter } from './gsplat-sorter.js';

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];
class GSplatInstance {
  constructor(splat, options) {
    this.splat = void 0;
    this.mesh = void 0;
    this.meshInstance = void 0;
    this.material = void 0;
    this.vb = void 0;
    this.options = {};
    this.sorter = null;
    this.lastCameraPosition = new Vec3();
    this.lastCameraDirection = new Vec3();
    this.cameras = [];
    this.splat = splat;
    options = Object.assign(this.options, options);
    const device = splat.device;
    if (device.isWebGL1) return;
    this.createMaterial(options);
    const numSplats = splat.numSplats;
    const indices = new Uint32Array(numSplats * 6);
    const ids = new Uint32Array(numSplats * 4);
    for (let i = 0; i < numSplats; ++i) {
      const base = i * 4;
      ids[base + 0] = i;
      ids[base + 1] = i;
      ids[base + 2] = i;
      ids[base + 3] = i;
      const triBase = i * 6;
      indices[triBase + 0] = base;
      indices[triBase + 1] = base + 1;
      indices[triBase + 2] = base + 2;
      indices[triBase + 3] = base;
      indices[triBase + 4] = base + 2;
      indices[triBase + 5] = base + 3;
    }
    const mesh = new Mesh(device);
    mesh.setVertexStream(SEMANTIC_POSITION, ids, 1, numSplats * 4, TYPE_UINT32, false, !device.isWebGL1);
    mesh.setIndices(indices);
    mesh.update();
    this.mesh = mesh;
    this.mesh.aabb.copy(splat.aabb);
    this.meshInstance = new MeshInstance(this.mesh, this.material);
    this.meshInstance.gsplatInstance = this;
    this.centers = new Float32Array(splat.centers);
    if (!options.dither || options.dither === DITHER_NONE) {
      this.sorter = new GSplatSorter();
      this.sorter.init(mesh.vertexBuffer, this.centers, !this.splat.device.isWebGL1);
    }
  }
  destroy() {
    var _this$material, _this$meshInstance, _this$sorter;
    (_this$material = this.material) == null || _this$material.destroy();
    (_this$meshInstance = this.meshInstance) == null || _this$meshInstance.destroy();
    (_this$sorter = this.sorter) == null || _this$sorter.destroy();
  }
  clone() {
    return new GSplatInstance(this.splat, this.options);
  }
  createMaterial(options) {
    this.material = createGSplatMaterial(options);
    this.splat.setupMaterial(this.material);
    if (this.meshInstance) {
      this.meshInstance.material = this.material;
    }
  }
  updateViewport() {
    const device = this.splat.device;
    viewport[0] = device.width;
    viewport[1] = device.height;
    this.material.setParameter('viewport', viewport);
  }
  sort(cameraNode) {
    if (this.sorter) {
      const cameraMat = cameraNode.getWorldTransform();
      cameraMat.getTranslation(cameraPosition);
      cameraMat.getZ(cameraDirection);
      const modelMat = this.meshInstance.node.getWorldTransform();
      const invModelMat = mat.invert(modelMat);
      invModelMat.transformPoint(cameraPosition, cameraPosition);
      invModelMat.transformVector(cameraDirection, cameraDirection);
      if (!cameraPosition.equalsApprox(this.lastCameraPosition) || !cameraDirection.equalsApprox(this.lastCameraDirection)) {
        this.lastCameraPosition.copy(cameraPosition);
        this.lastCameraDirection.copy(cameraDirection);
        this.sorter.setCamera(cameraPosition, cameraDirection);
      }
    }
    this.updateViewport();
  }
  update() {
    if (this.cameras.length > 0) {
      const camera = this.cameras[0];
      this.sort(camera._node);
      this.cameras.length = 0;
    }
  }
}

export { GSplatInstance };
