/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { PRIMITIVE_TRISTRIP } from '../../platform/graphics/constants.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { BLEND_NORMAL } from '../constants.js';
import { BasicMaterial } from '../materials/basic-material.js';
import { GraphNode } from '../graph-node.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { ImmediateBatches } from './immediate-batches.js';

const tempPoints = [];
class Immediate {
  constructor(device) {
    this.device = device;
    this.quadMesh = null;
    this.textureShader = null;
    this.depthTextureShader = null;
    this.cubeLocalPos = null;
    this.cubeWorldPos = null;

    this.batchesMap = new Map();

    this.allBatches = new Set();

    this.updatedLayers = new Set();

    this._materialDepth = null;
    this._materialNoDepth = null;

    this.layerMeshInstances = new Map();
  }

  createMaterial(depthTest) {
    const material = new BasicMaterial();
    material.vertexColors = true;
    material.blend = true;
    material.blendType = BLEND_NORMAL;
    material.depthTest = depthTest;
    material.update();
    return material;
  }

  get materialDepth() {
    if (!this._materialDepth) {
      this._materialDepth = this.createMaterial(true);
    }
    return this._materialDepth;
  }

  get materialNoDepth() {
    if (!this._materialNoDepth) {
      this._materialNoDepth = this.createMaterial(false);
    }
    return this._materialNoDepth;
  }

  getBatch(layer, depthTest) {
    let batches = this.batchesMap.get(layer);
    if (!batches) {
      batches = new ImmediateBatches(this.device);
      this.batchesMap.set(layer, batches);
    }

    this.allBatches.add(batches);

    const material = depthTest ? this.materialDepth : this.materialNoDepth;
    return batches.getBatch(material, layer);
  }

  static getTextureVS() {
    return `
            attribute vec2 vertex_position;
            uniform mat4 matrix_model;
            varying vec2 uv0;
            void main(void) {
                gl_Position = matrix_model * vec4(vertex_position, 0, 1);
                uv0 = vertex_position.xy + 0.5;
            }
        `;
  }

  getTextureShader() {
    if (!this.textureShader) {
      const fshader = `
                varying vec2 uv0;
                uniform sampler2D colorMap;
                void main (void) {
                    gl_FragColor = vec4(texture2D(colorMap, uv0).xyz, 1);
                }
            `;
      this.textureShader = createShaderFromCode(this.device, Immediate.getTextureVS(), fshader, 'DebugTextureShader');
    }
    return this.textureShader;
  }

  getDepthTextureShader() {
    if (!this.depthTextureShader) {
      const fshader = `
                ${shaderChunks.screenDepthPS}
                varying vec2 uv0;
                void main() {
                    float depth = getLinearScreenDepth(uv0) * camera_params.x;
                    gl_FragColor = vec4(vec3(depth), 1.0);
                }
            `;
      this.depthTextureShader = createShaderFromCode(this.device, Immediate.getTextureVS(), fshader, 'DebugDepthTextureShader');
    }
    return this.depthTextureShader;
  }

  getQuadMesh() {
    if (!this.quadMesh) {
      this.quadMesh = new Mesh(this.device);
      this.quadMesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]);
      this.quadMesh.update(PRIMITIVE_TRISTRIP);
    }
    return this.quadMesh;
  }

  drawMesh(material, matrix, mesh, meshInstance, layer) {
    if (!meshInstance) {
      const graphNode = this.getGraphNode(matrix);
      meshInstance = new MeshInstance(mesh, material, graphNode);
    }

    let layerMeshInstances = this.layerMeshInstances.get(layer);
    if (!layerMeshInstances) {
      layerMeshInstances = [];
      this.layerMeshInstances.set(layer, layerMeshInstances);
    }
    layerMeshInstances.push(meshInstance);
  }
  drawWireAlignedBox(min, max, color, depthTest, layer) {
    tempPoints.push(min.x, min.y, min.z, min.x, max.y, min.z, min.x, max.y, min.z, max.x, max.y, min.z, max.x, max.y, min.z, max.x, min.y, min.z, max.x, min.y, min.z, min.x, min.y, min.z, min.x, min.y, max.z, min.x, max.y, max.z, min.x, max.y, max.z, max.x, max.y, max.z, max.x, max.y, max.z, max.x, min.y, max.z, max.x, min.y, max.z, min.x, min.y, max.z, min.x, min.y, min.z, min.x, min.y, max.z, min.x, max.y, min.z, min.x, max.y, max.z, max.x, max.y, min.z, max.x, max.y, max.z, max.x, min.y, min.z, max.x, min.y, max.z);
    const batch = this.getBatch(layer, depthTest);
    batch.addLinesArrays(tempPoints, color);
    tempPoints.length = 0;
  }
  drawWireSphere(center, radius, color, numSegments, depthTest, layer) {
    const step = 2 * Math.PI / numSegments;
    let angle = 0;
    for (let i = 0; i < numSegments; i++) {
      const sin0 = Math.sin(angle);
      const cos0 = Math.cos(angle);
      angle += step;
      const sin1 = Math.sin(angle);
      const cos1 = Math.cos(angle);
      tempPoints.push(center.x + radius * sin0, center.y, center.z + radius * cos0);
      tempPoints.push(center.x + radius * sin1, center.y, center.z + radius * cos1);
      tempPoints.push(center.x + radius * sin0, center.y + radius * cos0, center.z);
      tempPoints.push(center.x + radius * sin1, center.y + radius * cos1, center.z);
      tempPoints.push(center.x, center.y + radius * sin0, center.z + radius * cos0);
      tempPoints.push(center.x, center.y + radius * sin1, center.z + radius * cos1);
    }
    const batch = this.getBatch(layer, depthTest);
    batch.addLinesArrays(tempPoints, color);
    tempPoints.length = 0;
  }
  getGraphNode(matrix) {
    const graphNode = new GraphNode('ImmediateDebug');
    graphNode.worldTransform = matrix;
    graphNode._dirtyWorld = graphNode._dirtyNormal = false;
    return graphNode;
  }

  onPreRenderLayer(layer, visibleList, transparent) {
    this.batchesMap.forEach((batches, batchLayer) => {
      if (batchLayer === layer) {
        batches.onPreRender(visibleList, transparent);
      }
    });

    if (!this.updatedLayers.has(layer)) {
      this.updatedLayers.add(layer);

      const meshInstances = this.layerMeshInstances.get(layer);
      if (meshInstances) {
        for (let i = 0; i < meshInstances.length; i++) {
          visibleList.list[visibleList.length + i] = meshInstances[i];
        }
        visibleList.length += meshInstances.length;
        meshInstances.length = 0;
      }
    }
  }

  onPostRender() {
    this.allBatches.clear();

    this.updatedLayers.clear();
  }
}

export { Immediate };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1tZWRpYXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvaW1tZWRpYXRlL2ltbWVkaWF0ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQUklNSVRJVkVfVFJJU1RSSVAgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vLi4vc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi4vLi4vc2NlbmUvc2hhZGVyLWxpYi91dGlscy5qcyc7XG5cbmltcG9ydCB7IEJMRU5EX05PUk1BTCB9IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXNpY01hdGVyaWFsIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL2Jhc2ljLW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBJbW1lZGlhdGVCYXRjaGVzIH0gZnJvbSAnLi4vaW1tZWRpYXRlL2ltbWVkaWF0ZS1iYXRjaGVzLmpzJztcblxuY29uc3QgdGVtcFBvaW50cyA9IFtdO1xuXG5jbGFzcyBJbW1lZGlhdGUge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5xdWFkTWVzaCA9IG51bGw7XG4gICAgICAgIHRoaXMudGV4dHVyZVNoYWRlciA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVwdGhUZXh0dXJlU2hhZGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5jdWJlTG9jYWxQb3MgPSBudWxsO1xuICAgICAgICB0aGlzLmN1YmVXb3JsZFBvcyA9IG51bGw7XG5cbiAgICAgICAgLy8gbWFwIG9mIExheWVyIHRvIEltbWVkaWF0ZUJhdGNoZXMsIHN0b3JpbmcgbGluZSBiYXRjaGVzIGZvciBhIGxheWVyXG4gICAgICAgIHRoaXMuYmF0Y2hlc01hcCA9IG5ldyBNYXAoKTtcblxuICAgICAgICAvLyBzZXQgb2YgYWxsIGJhdGNoZXMgdGhhdCB3ZXJlIHVzZWQgaW4gdGhlIGZyYW1lXG4gICAgICAgIHRoaXMuYWxsQmF0Y2hlcyA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvLyBzZXQgb2YgYWxsIGxheWVycyB1cGRhdGVkIGR1cmluZyB0aGlzIGZyYW1lXG4gICAgICAgIHRoaXMudXBkYXRlZExheWVycyA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvLyBsaW5lIG1hdGVyaWFsc1xuICAgICAgICB0aGlzLl9tYXRlcmlhbERlcHRoID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxOb0RlcHRoID0gbnVsbDtcblxuICAgICAgICAvLyBtYXAgb2YgbWVzaGVzIGluc3RhbmNlcyBhZGRlZCB0byBhIGxheWVyLiBUaGUga2V5IGlzIGxheWVyLCB0aGUgdmFsdWUgaXMgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5sYXllck1lc2hJbnN0YW5jZXMgPSBuZXcgTWFwKCk7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlcyBtYXRlcmlhbCBmb3IgbGluZSByZW5kZXJpbmdcbiAgICBjcmVhdGVNYXRlcmlhbChkZXB0aFRlc3QpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgQmFzaWNNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC52ZXJ0ZXhDb2xvcnMgPSB0cnVlO1xuICAgICAgICBtYXRlcmlhbC5ibGVuZCA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICAgICAgbWF0ZXJpYWwuZGVwdGhUZXN0ID0gZGVwdGhUZXN0O1xuICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH1cblxuICAgIC8vIG1hdGVyaWFsIGZvciBsaW5lIHJlbmRlcmluZyB3aXRoIGRlcHRoIHRlc3Rpbmcgb25cbiAgICBnZXQgbWF0ZXJpYWxEZXB0aCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tYXRlcmlhbERlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbERlcHRoID0gdGhpcy5jcmVhdGVNYXRlcmlhbCh0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWxEZXB0aDtcbiAgICB9XG5cbiAgICAvLyBtYXRlcmlhbCBmb3IgbGluZSByZW5kZXJpbmcgd2l0aCBkZXB0aCB0ZXN0aW5nIG9mZlxuICAgIGdldCBtYXRlcmlhbE5vRGVwdGgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbWF0ZXJpYWxOb0RlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbE5vRGVwdGggPSB0aGlzLmNyZWF0ZU1hdGVyaWFsKGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWxOb0RlcHRoO1xuICAgIH1cblxuICAgIC8vIHJldHVybnMgYSBiYXRjaCBmb3IgcmVuZGVyaW5nIGxpbmVzIHRvIGEgbGF5ZXIgd2l0aCByZXF1aXJlZCBkZXB0aCB0ZXN0aW5nIHN0YXRlXG4gICAgZ2V0QmF0Y2gobGF5ZXIsIGRlcHRoVGVzdCkge1xuXG4gICAgICAgIC8vIGdldCBiYXRjaGVzIGZvciB0aGUgbGF5ZXJcbiAgICAgICAgbGV0IGJhdGNoZXMgPSB0aGlzLmJhdGNoZXNNYXAuZ2V0KGxheWVyKTtcbiAgICAgICAgaWYgKCFiYXRjaGVzKSB7XG4gICAgICAgICAgICBiYXRjaGVzID0gbmV3IEltbWVkaWF0ZUJhdGNoZXModGhpcy5kZXZpY2UpO1xuICAgICAgICAgICAgdGhpcy5iYXRjaGVzTWFwLnNldChsYXllciwgYmF0Y2hlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgaXQgZm9yIHJlbmRlcmluZ1xuICAgICAgICB0aGlzLmFsbEJhdGNoZXMuYWRkKGJhdGNoZXMpO1xuXG4gICAgICAgIC8vIGdldCBiYXRjaCBmb3IgdGhlIG1hdGVyaWFsXG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZGVwdGhUZXN0ID8gdGhpcy5tYXRlcmlhbERlcHRoIDogdGhpcy5tYXRlcmlhbE5vRGVwdGg7XG4gICAgICAgIHJldHVybiBiYXRjaGVzLmdldEJhdGNoKG1hdGVyaWFsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLy8gc2hhcmVkIHZlcnRleCBzaGFkZXIgZm9yIHRleHR1cmVkIHF1YWQgcmVuZGVyaW5nXG4gICAgc3RhdGljIGdldFRleHR1cmVWUygpIHtcbiAgICAgICAgcmV0dXJuIGBcbiAgICAgICAgICAgIGF0dHJpYnV0ZSB2ZWMyIHZlcnRleF9wb3NpdGlvbjtcbiAgICAgICAgICAgIHVuaWZvcm0gbWF0NCBtYXRyaXhfbW9kZWw7XG4gICAgICAgICAgICB2YXJ5aW5nIHZlYzIgdXYwO1xuICAgICAgICAgICAgdm9pZCBtYWluKHZvaWQpIHtcbiAgICAgICAgICAgICAgICBnbF9Qb3NpdGlvbiA9IG1hdHJpeF9tb2RlbCAqIHZlYzQodmVydGV4X3Bvc2l0aW9uLCAwLCAxKTtcbiAgICAgICAgICAgICAgICB1djAgPSB2ZXJ0ZXhfcG9zaXRpb24ueHkgKyAwLjU7XG4gICAgICAgICAgICB9XG4gICAgICAgIGA7XG4gICAgfVxuXG4gICAgLy8gc2hhZGVyIHVzZWQgdG8gZGlzcGxheSB0ZXh0dXJlXG4gICAgZ2V0VGV4dHVyZVNoYWRlcigpIHtcbiAgICAgICAgaWYgKCF0aGlzLnRleHR1cmVTaGFkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGZzaGFkZXIgPSBgXG4gICAgICAgICAgICAgICAgdmFyeWluZyB2ZWMyIHV2MDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtIHNhbXBsZXIyRCBjb2xvck1hcDtcbiAgICAgICAgICAgICAgICB2b2lkIG1haW4gKHZvaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCh0ZXh0dXJlMkQoY29sb3JNYXAsIHV2MCkueHl6LCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBgO1xuXG4gICAgICAgICAgICB0aGlzLnRleHR1cmVTaGFkZXIgPSBjcmVhdGVTaGFkZXJGcm9tQ29kZSh0aGlzLmRldmljZSwgSW1tZWRpYXRlLmdldFRleHR1cmVWUygpLCBmc2hhZGVyLCAnRGVidWdUZXh0dXJlU2hhZGVyJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy50ZXh0dXJlU2hhZGVyO1xuICAgIH1cblxuICAgIC8vIHNoYWRlciB1c2VkIHRvIGRpc3BsYXkgZGVwdGggdGV4dHVyZVxuICAgIGdldERlcHRoVGV4dHVyZVNoYWRlcigpIHtcbiAgICAgICAgaWYgKCF0aGlzLmRlcHRoVGV4dHVyZVNoYWRlcikge1xuICAgICAgICAgICAgY29uc3QgZnNoYWRlciA9IGBcbiAgICAgICAgICAgICAgICAke3NoYWRlckNodW5rcy5zY3JlZW5EZXB0aFBTfVxuICAgICAgICAgICAgICAgIHZhcnlpbmcgdmVjMiB1djA7XG4gICAgICAgICAgICAgICAgdm9pZCBtYWluKCkge1xuICAgICAgICAgICAgICAgICAgICBmbG9hdCBkZXB0aCA9IGdldExpbmVhclNjcmVlbkRlcHRoKHV2MCkgKiBjYW1lcmFfcGFyYW1zLng7XG4gICAgICAgICAgICAgICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQodmVjMyhkZXB0aCksIDEuMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgYDtcblxuICAgICAgICAgICAgdGhpcy5kZXB0aFRleHR1cmVTaGFkZXIgPSBjcmVhdGVTaGFkZXJGcm9tQ29kZSh0aGlzLmRldmljZSwgSW1tZWRpYXRlLmdldFRleHR1cmVWUygpLCBmc2hhZGVyLCAnRGVidWdEZXB0aFRleHR1cmVTaGFkZXInKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmRlcHRoVGV4dHVyZVNoYWRlcjtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGVzIG1lc2ggdXNlZCB0byByZW5kZXIgYSBxdWFkXG4gICAgZ2V0UXVhZE1lc2goKSB7XG4gICAgICAgIGlmICghdGhpcy5xdWFkTWVzaCkge1xuICAgICAgICAgICAgdGhpcy5xdWFkTWVzaCA9IG5ldyBNZXNoKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMucXVhZE1lc2guc2V0UG9zaXRpb25zKFtcbiAgICAgICAgICAgICAgICAtMC41LCAtMC41LCAwLFxuICAgICAgICAgICAgICAgIDAuNSwgLTAuNSwgMCxcbiAgICAgICAgICAgICAgICAtMC41LCAwLjUsIDAsXG4gICAgICAgICAgICAgICAgMC41LCAwLjUsIDBcbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgdGhpcy5xdWFkTWVzaC51cGRhdGUoUFJJTUlUSVZFX1RSSVNUUklQKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5xdWFkTWVzaDtcbiAgICB9XG5cbiAgICAvLyBEcmF3IG1lc2ggYXQgdGhpcyBmcmFtZVxuICAgIGRyYXdNZXNoKG1hdGVyaWFsLCBtYXRyaXgsIG1lc2gsIG1lc2hJbnN0YW5jZSwgbGF5ZXIpIHtcblxuICAgICAgICAvLyBjcmVhdGUgYSBtZXNoIGluc3RhbmNlIGZvciB0aGUgbWVzaCBpZiBuZWVkZWRcbiAgICAgICAgaWYgKCFtZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoTm9kZSA9IHRoaXMuZ2V0R3JhcGhOb2RlKG1hdHJpeCk7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIG1hdGVyaWFsLCBncmFwaE5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIHRoZSBtZXNoIGluc3RhbmNlIHRvIGFuIGFycmF5IHBlciBsYXllciwgdGhleSBnZXQgYWRkZWQgdG8gbGF5ZXJzIGJlZm9yZSByZW5kZXJpbmdcbiAgICAgICAgbGV0IGxheWVyTWVzaEluc3RhbmNlcyA9IHRoaXMubGF5ZXJNZXNoSW5zdGFuY2VzLmdldChsYXllcik7XG4gICAgICAgIGlmICghbGF5ZXJNZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBsYXllck1lc2hJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMubGF5ZXJNZXNoSW5zdGFuY2VzLnNldChsYXllciwgbGF5ZXJNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgICAgICBsYXllck1lc2hJbnN0YW5jZXMucHVzaChtZXNoSW5zdGFuY2UpO1xuICAgIH1cblxuICAgIGRyYXdXaXJlQWxpZ25lZEJveChtaW4sIG1heCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpIHtcbiAgICAgICAgdGVtcFBvaW50cy5wdXNoKFxuICAgICAgICAgICAgbWluLngsIG1pbi55LCBtaW4ueiwgbWluLngsIG1heC55LCBtaW4ueixcbiAgICAgICAgICAgIG1pbi54LCBtYXgueSwgbWluLnosIG1heC54LCBtYXgueSwgbWluLnosXG4gICAgICAgICAgICBtYXgueCwgbWF4LnksIG1pbi56LCBtYXgueCwgbWluLnksIG1pbi56LFxuICAgICAgICAgICAgbWF4LngsIG1pbi55LCBtaW4ueiwgbWluLngsIG1pbi55LCBtaW4ueixcbiAgICAgICAgICAgIG1pbi54LCBtaW4ueSwgbWF4LnosIG1pbi54LCBtYXgueSwgbWF4LnosXG4gICAgICAgICAgICBtaW4ueCwgbWF4LnksIG1heC56LCBtYXgueCwgbWF4LnksIG1heC56LFxuICAgICAgICAgICAgbWF4LngsIG1heC55LCBtYXgueiwgbWF4LngsIG1pbi55LCBtYXgueixcbiAgICAgICAgICAgIG1heC54LCBtaW4ueSwgbWF4LnosIG1pbi54LCBtaW4ueSwgbWF4LnosXG4gICAgICAgICAgICBtaW4ueCwgbWluLnksIG1pbi56LCBtaW4ueCwgbWluLnksIG1heC56LFxuICAgICAgICAgICAgbWluLngsIG1heC55LCBtaW4ueiwgbWluLngsIG1heC55LCBtYXgueixcbiAgICAgICAgICAgIG1heC54LCBtYXgueSwgbWluLnosIG1heC54LCBtYXgueSwgbWF4LnosXG4gICAgICAgICAgICBtYXgueCwgbWluLnksIG1pbi56LCBtYXgueCwgbWluLnksIG1heC56XG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgICAgICBiYXRjaC5hZGRMaW5lc0FycmF5cyh0ZW1wUG9pbnRzLCBjb2xvcik7XG4gICAgICAgIHRlbXBQb2ludHMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBkcmF3V2lyZVNwaGVyZShjZW50ZXIsIHJhZGl1cywgY29sb3IsIG51bVNlZ21lbnRzLCBkZXB0aFRlc3QsIGxheWVyKSB7XG5cbiAgICAgICAgY29uc3Qgc3RlcCA9IDIgKiBNYXRoLlBJIC8gbnVtU2VnbWVudHM7XG4gICAgICAgIGxldCBhbmdsZSA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TZWdtZW50czsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzaW4wID0gTWF0aC5zaW4oYW5nbGUpO1xuICAgICAgICAgICAgY29uc3QgY29zMCA9IE1hdGguY29zKGFuZ2xlKTtcbiAgICAgICAgICAgIGFuZ2xlICs9IHN0ZXA7XG4gICAgICAgICAgICBjb25zdCBzaW4xID0gTWF0aC5zaW4oYW5nbGUpO1xuICAgICAgICAgICAgY29uc3QgY29zMSA9IE1hdGguY29zKGFuZ2xlKTtcblxuICAgICAgICAgICAgdGVtcFBvaW50cy5wdXNoKGNlbnRlci54ICsgcmFkaXVzICogc2luMCwgY2VudGVyLnksIGNlbnRlci56ICsgcmFkaXVzICogY29zMCk7XG4gICAgICAgICAgICB0ZW1wUG9pbnRzLnB1c2goY2VudGVyLnggKyByYWRpdXMgKiBzaW4xLCBjZW50ZXIueSwgY2VudGVyLnogKyByYWRpdXMgKiBjb3MxKTtcbiAgICAgICAgICAgIHRlbXBQb2ludHMucHVzaChjZW50ZXIueCArIHJhZGl1cyAqIHNpbjAsIGNlbnRlci55ICsgcmFkaXVzICogY29zMCwgY2VudGVyLnopO1xuICAgICAgICAgICAgdGVtcFBvaW50cy5wdXNoKGNlbnRlci54ICsgcmFkaXVzICogc2luMSwgY2VudGVyLnkgKyByYWRpdXMgKiBjb3MxLCBjZW50ZXIueik7XG4gICAgICAgICAgICB0ZW1wUG9pbnRzLnB1c2goY2VudGVyLngsIGNlbnRlci55ICsgcmFkaXVzICogc2luMCwgY2VudGVyLnogKyByYWRpdXMgKiBjb3MwKTtcbiAgICAgICAgICAgIHRlbXBQb2ludHMucHVzaChjZW50ZXIueCwgY2VudGVyLnkgKyByYWRpdXMgKiBzaW4xLCBjZW50ZXIueiArIHJhZGl1cyAqIGNvczEpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgICAgICBiYXRjaC5hZGRMaW5lc0FycmF5cyh0ZW1wUG9pbnRzLCBjb2xvcik7XG4gICAgICAgIHRlbXBQb2ludHMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBnZXRHcmFwaE5vZGUobWF0cml4KSB7XG4gICAgICAgIGNvbnN0IGdyYXBoTm9kZSA9IG5ldyBHcmFwaE5vZGUoJ0ltbWVkaWF0ZURlYnVnJyk7XG4gICAgICAgIGdyYXBoTm9kZS53b3JsZFRyYW5zZm9ybSA9IG1hdHJpeDtcbiAgICAgICAgZ3JhcGhOb2RlLl9kaXJ0eVdvcmxkID0gZ3JhcGhOb2RlLl9kaXJ0eU5vcm1hbCA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiBncmFwaE5vZGU7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpcyBjYWxsZWQganVzdCBiZWZvcmUgdGhlIGxheWVyIGlzIHJlbmRlcmVkIHRvIGFsbG93IGxpbmVzIGZvciB0aGUgbGF5ZXIgdG8gYmUgYWRkZWQgZnJvbSBpbnNpZGVcbiAgICAvLyB0aGUgZnJhbWUgZ2V0dGluZyByZW5kZXJlZFxuICAgIG9uUHJlUmVuZGVyTGF5ZXIobGF5ZXIsIHZpc2libGVMaXN0LCB0cmFuc3BhcmVudCkge1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsaW5lIGJhdGNoZXMgZm9yIHRoZSBzcGVjaWZpZWQgc3ViLWxheWVyXG4gICAgICAgIHRoaXMuYmF0Y2hlc01hcC5mb3JFYWNoKChiYXRjaGVzLCBiYXRjaExheWVyKSA9PiB7XG4gICAgICAgICAgICBpZiAoYmF0Y2hMYXllciA9PT0gbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBiYXRjaGVzLm9uUHJlUmVuZGVyKHZpc2libGVMaXN0LCB0cmFuc3BhcmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIG9ubHkgdXBkYXRlIG1lc2hlcyBvbmNlIGZvciBlYWNoIGxheWVyICh0aGV5J3JlIG5vdCBwZXIgc3ViLWxheWVyIGF0IHRoZSBtb21lbnQpXG4gICAgICAgIGlmICghdGhpcy51cGRhdGVkTGF5ZXJzLmhhcyhsYXllcikpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlZExheWVycy5hZGQobGF5ZXIpO1xuXG4gICAgICAgICAgICAvLyBhZGQgbWVzaCBpbnN0YW5jZXMgZm9yIHNwZWNpZmllZCBsYXllciB0byB2aXNpYmxlIGxpc3RcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0aGlzLmxheWVyTWVzaEluc3RhbmNlcy5nZXQobGF5ZXIpO1xuICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZUxpc3QubGlzdFt2aXNpYmxlTGlzdC5sZW5ndGggKyBpXSA9IG1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZpc2libGVMaXN0Lmxlbmd0aCArPSBtZXNoSW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxsZWQgYWZ0ZXIgdGhlIGZyYW1lIHdhcyByZW5kZXJlZCwgY2xlYXJzIGRhdGFcbiAgICBvblBvc3RSZW5kZXIoKSB7XG5cbiAgICAgICAgLy8gY2xlYW4gdXAgbGluZSBiYXRjaGVzXG4gICAgICAgIHRoaXMuYWxsQmF0Y2hlcy5jbGVhcigpO1xuXG4gICAgICAgIC8vIGFsbCBiYXRjaGVzIG5lZWQgdXBkYXRpbmcgbmV4dCBmcmFtZVxuICAgICAgICB0aGlzLnVwZGF0ZWRMYXllcnMuY2xlYXIoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEltbWVkaWF0ZSB9O1xuIl0sIm5hbWVzIjpbInRlbXBQb2ludHMiLCJJbW1lZGlhdGUiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsInF1YWRNZXNoIiwidGV4dHVyZVNoYWRlciIsImRlcHRoVGV4dHVyZVNoYWRlciIsImN1YmVMb2NhbFBvcyIsImN1YmVXb3JsZFBvcyIsImJhdGNoZXNNYXAiLCJNYXAiLCJhbGxCYXRjaGVzIiwiU2V0IiwidXBkYXRlZExheWVycyIsIl9tYXRlcmlhbERlcHRoIiwiX21hdGVyaWFsTm9EZXB0aCIsImxheWVyTWVzaEluc3RhbmNlcyIsImNyZWF0ZU1hdGVyaWFsIiwiZGVwdGhUZXN0IiwibWF0ZXJpYWwiLCJCYXNpY01hdGVyaWFsIiwidmVydGV4Q29sb3JzIiwiYmxlbmQiLCJibGVuZFR5cGUiLCJCTEVORF9OT1JNQUwiLCJ1cGRhdGUiLCJtYXRlcmlhbERlcHRoIiwibWF0ZXJpYWxOb0RlcHRoIiwiZ2V0QmF0Y2giLCJsYXllciIsImJhdGNoZXMiLCJnZXQiLCJJbW1lZGlhdGVCYXRjaGVzIiwic2V0IiwiYWRkIiwiZ2V0VGV4dHVyZVZTIiwiZ2V0VGV4dHVyZVNoYWRlciIsImZzaGFkZXIiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsImdldERlcHRoVGV4dHVyZVNoYWRlciIsInNoYWRlckNodW5rcyIsInNjcmVlbkRlcHRoUFMiLCJnZXRRdWFkTWVzaCIsIk1lc2giLCJzZXRQb3NpdGlvbnMiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJkcmF3TWVzaCIsIm1hdHJpeCIsIm1lc2giLCJtZXNoSW5zdGFuY2UiLCJncmFwaE5vZGUiLCJnZXRHcmFwaE5vZGUiLCJNZXNoSW5zdGFuY2UiLCJwdXNoIiwiZHJhd1dpcmVBbGlnbmVkQm94IiwibWluIiwibWF4IiwiY29sb3IiLCJ4IiwieSIsInoiLCJiYXRjaCIsImFkZExpbmVzQXJyYXlzIiwibGVuZ3RoIiwiZHJhd1dpcmVTcGhlcmUiLCJjZW50ZXIiLCJyYWRpdXMiLCJudW1TZWdtZW50cyIsInN0ZXAiLCJNYXRoIiwiUEkiLCJhbmdsZSIsImkiLCJzaW4wIiwic2luIiwiY29zMCIsImNvcyIsInNpbjEiLCJjb3MxIiwiR3JhcGhOb2RlIiwid29ybGRUcmFuc2Zvcm0iLCJfZGlydHlXb3JsZCIsIl9kaXJ0eU5vcm1hbCIsIm9uUHJlUmVuZGVyTGF5ZXIiLCJ2aXNpYmxlTGlzdCIsInRyYW5zcGFyZW50IiwiZm9yRWFjaCIsImJhdGNoTGF5ZXIiLCJvblByZVJlbmRlciIsImhhcyIsIm1lc2hJbnN0YW5jZXMiLCJsaXN0Iiwib25Qb3N0UmVuZGVyIiwiY2xlYXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQVdBLE1BQU1BLFVBQVUsR0FBRyxFQUFFLENBQUE7QUFFckIsTUFBTUMsU0FBUyxDQUFDO0VBQ1pDLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFO0lBQ2hCLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUksQ0FBQTtJQUN6QixJQUFJLENBQUNDLGtCQUFrQixHQUFH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RUFDeENMLEdBQUcsQ0FBQ0csQ0FBQyxFQUFFRixHQUFHLENBQUNHLENBQUMsRUFBRUosR0FBRyxDQUFDSyxDQUFDLEVBQUVKLEdBQUcsQ0FBQ0UsQ0FBQyxFQUFFRixHQUFHLENBQUNHLENBQUMsRUFBRUosR0FBRyxDQUFDSyxDQUFDLEVBQ3hDSixHQUFHLENBQUNFLENBQUMsRUFBRUYsR0FBRyxDQUFDRyxDQUFDLEVBQUVKLEdBQUcsQ0FBQ0ssQ0FBQyxFQUFFSixHQUFHLENBQUNFLENBQUMsRUFBRUgsR0FBRyxDQUFDSSxDQUFDLEVBQUVKLEdBQUcsQ0FBQ0ssQ0FBQyxFQUN4Q0osR0FBRyxDQUFDRSxDQUFDLEVBQUVILEdBQUcsQ0FBQ0ksQ0FBQyxFQUFFSixHQUFHLENBQUNLLENBQUMsRUFBRUwsR0FBRyxDQUFDRyxDQUFDLEVBQUVILEdBQUcsQ0FBQ0ksQ0FBQyxFQUFFSixHQUFHLENBQUNLLENBQUMsRUFDeENMLEdBQUcsQ0FBQ0csQ0FBQyxFQUFFSCxHQUFHLENBQUNJLENBQUMsRUFBRUgsR0FBRyxDQUFDSSxDQUFDLEVBQUVMLEdBQUcsQ0FBQ0csQ0FBQyxFQUFFRixHQUFHLENBQUNHLENBQUMsRUFBRUgsR0FBRyxDQUFDSSxDQUFDLEVBQ3hDTCxHQUFHLENBQUNHLENBQUMsRUFBRUYsR0FBRyxDQUFDRyxDQUFDLEVBQUVILEdBQUcsQ0FBQ0ksQ0FBQyxFQUFFSixHQUFHLENBQUNFLENBQUMsRUFBRUYsR0FBRyxDQUFDRyxDQUFDLEVBQUVILEdBQUcsQ0FBQ0ksQ0FBQyxFQUN4Q0osR0FBRyxDQUFDRSxDQUFDLEVBQUVGLEdBQUcsQ0FBQ0csQ0FBQyxFQUFFSCxHQUFHLENBQUNJLENBQUMsRUFBRUosR0FBRyxDQUFDRSxDQUFDLEVBQUVILEdBQUcsQ0FBQ0ksQ0FBQyxFQUFFSCxHQUFHLENBQUNJLENBQUMsRUFDeENKLEdBQUcsQ0FBQ0UsQ0FBQyxFQUFFSCxHQUFHLENBQUNJLENBQUMsRUFBRUgsR0FBRyxDQUFDSSxDQUFDLEVBQUVMLEdBQUcsQ0FBQ0csQ0FBQyxFQUFFSCxHQUFHLENB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