import { Vec3 } from '../../core/math/vec3.js';
import { SKYTYPE_INFINITE } from '../constants.js';
import { GraphNode } from '../graph-node.js';
import { SkyMesh } from './sky-mesh.js';

class Sky {
  constructor(scene) {
    this._type = SKYTYPE_INFINITE;
    this._center = new Vec3(0, 1, 0);
    this.skyMesh = null;
    this.node = new GraphNode('SkyMeshNode');
    this.device = scene.device;
    this.scene = scene;
    this.center = new Vec3(0, 1, 0);
    this.centerArray = new Float32Array(3);
    this.projectedSkydomeCenterId = this.device.scope.resolve('projectedSkydomeCenter');
  }
  applySettings(render) {
    var _render$skyType, _render$skyMeshPositi, _render$skyMeshRotati, _render$skyMeshScale;
    this.type = (_render$skyType = render.skyType) != null ? _render$skyType : SKYTYPE_INFINITE;
    this.node.setLocalPosition(new Vec3((_render$skyMeshPositi = render.skyMeshPosition) != null ? _render$skyMeshPositi : [0, 0, 0]));
    this.node.setLocalEulerAngles(new Vec3((_render$skyMeshRotati = render.skyMeshRotation) != null ? _render$skyMeshRotati : [0, 0, 0]));
    this.node.setLocalScale(new Vec3((_render$skyMeshScale = render.skyMeshScale) != null ? _render$skyMeshScale : [1, 1, 1]));
    if (render.skyCenter) {
      this._center = new Vec3(render.skyCenter);
    }
  }
  set type(value) {
    if (this._type !== value) {
      this._type = value;
      this.scene.updateShaders = true;
      this.updateSkyMesh();
    }
  }
  get type() {
    return this._type;
  }
  set center(value) {
    this._center.copy(value);
  }
  get center() {
    return this._center;
  }
  updateSkyMesh() {
    const texture = this.scene._getSkyboxTex();
    if (texture) {
      this.resetSkyMesh();
      this.skyMesh = new SkyMesh(this.device, this.scene, this.node, texture, this.type);
      this.scene.fire('set:skybox', texture);
    }
  }
  resetSkyMesh() {
    var _this$skyMesh;
    (_this$skyMesh = this.skyMesh) == null || _this$skyMesh.destroy();
    this.skyMesh = null;
  }
  update() {
    if (this.type !== SKYTYPE_INFINITE) {
      const {
        center,
        centerArray
      } = this;
      const temp = new Vec3();
      this.node.getWorldTransform().transformPoint(center, temp);
      centerArray[0] = temp.x;
      centerArray[1] = temp.y;
      centerArray[2] = temp.z;
      this.projectedSkydomeCenterId.setValue(centerArray);
    }
  }
}

export { Sky };
