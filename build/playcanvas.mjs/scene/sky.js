import { Mat3 } from '../math/mat3.js';
import { Mat4 } from '../math/mat4.js';
import { Vec3 } from '../math/vec3.js';
import { Quat } from '../math/quat.js';
import { CULLFACE_FRONT } from '../graphics/constants.js';
import { SHADER_FORWARDHDR, GAMMA_SRGBHDR, GAMMA_NONE, TONEMAP_LINEAR, LAYERID_SKYBOX } from './constants.js';
import { createBox } from './procedural.js';
import { GraphNode } from './graph-node.js';
import { Material } from './materials/material.js';
import { MeshInstance } from './mesh-instance.js';
import { skybox } from '../graphics/program-lib/programs/skybox.js';

let _mat4;

class Sky {
  constructor(device, scene, texture) {
    this.meshInstance = void 0;
    this._rotationMat3 = void 0;
    const material = new Material();

    material.getShaderVariant = function (dev, sc, defs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
      const library = device.getProgramLibrary();
      library.register('skybox', skybox);

      if (texture.cubemap) {
        return library.getProgram('skybox', {
          type: 'cubemap',
          encoding: texture.encoding,
          useIntensity: scene.skyboxIntensity !== 1 || scene.skyboxLuminance !== 0,
          mip: texture.fixCubemapSeams ? scene.skyboxMip : 0,
          fixSeams: texture.fixCubemapSeams,
          gamma: pass === SHADER_FORWARDHDR ? scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE : scene.gammaCorrection,
          toneMapping: pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping
        });
      }

      return library.getProgram('skybox', {
        type: 'envAtlas',
        encoding: texture.encoding,
        useIntensity: scene.skyboxIntensity !== 1 || scene.skyboxLuminance !== 0,
        gamma: pass === SHADER_FORWARDHDR ? scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE : scene.gammaCorrection,
        toneMapping: pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping
      });
    };

    if (texture.cubemap) {
      material.setParameter('texture_cubeMap', texture);
    } else {
      material.setParameter('texture_envAtlas', texture);
      material.setParameter('mipLevel', scene._skyboxMip);
    }

    if (!scene.skyboxRotation.equals(Quat.IDENTITY)) {
      _mat4 = _mat4 || new Mat4();
      this._rotationMat3 = this._rotationMat3 || new Mat3();

      _mat4.setTRS(Vec3.ZERO, scene._skyboxRotation, Vec3.ONE);

      _mat4.invertTo3x3(this._rotationMat3);

      material.setParameter('cubeMapRotationMatrix', this._rotationMat3.data);
    } else {
      material.setParameter('cubeMapRotationMatrix', Mat3.IDENTITY.data);
    }

    material.cull = CULLFACE_FRONT;
    material.depthWrite = false;
    const skyLayer = scene.layers.getLayerById(LAYERID_SKYBOX);

    if (skyLayer) {
      const node = new GraphNode('Skybox');
      const mesh = createBox(device);
      const meshInstance = new MeshInstance(mesh, material, node);
      this.meshInstance = meshInstance;
      meshInstance.cull = false;
      meshInstance._noDepthDrawGl1 = true;
      meshInstance.pick = false;
      skyLayer.addMeshInstances([meshInstance]);
      this.skyLayer = skyLayer;
    }
  }

  destroy() {
    if (this.meshInstance) {
      if (this.skyLayer) {
        this.skyLayer.removeMeshInstances([this.meshInstance]);
      }

      this.meshInstance.destroy();
      this.meshInstance = null;
    }
  }

}

export { Sky };
