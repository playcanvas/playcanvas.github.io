/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { SEMANTIC_POSITION, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';

const tempSphere = new BoundingSphere();
class StaticMeshes {
  static lightCompare(lightA, lightB) {
    return lightA.key - lightB.key;
  }
  static prepare(device, scene, meshInstances, lights) {
    const prepareTime = now();
    let searchTime = 0;
    let subSearchTime = 0;
    let triAabbTime = 0;
    let subTriAabbTime = 0;
    let writeMeshTime = 0;
    let subWriteMeshTime = 0;
    let combineTime = 0;
    let subCombineTime = 0;
    const drawCalls = meshInstances;
    const drawCallsCount = drawCalls.length;
    const newDrawCalls = [];
    const minVec = new Vec3();
    const maxVec = new Vec3();
    const localLightBounds = new BoundingBox();
    const invMatrix = new Mat4();
    const triLightComb = [];
    const lightAabb = [];
    const triBounds = [];
    const staticLights = [];
    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];
      if (!drawCall.isStatic) {
        newDrawCalls.push(drawCall);
      } else {
        const aabb = drawCall.aabb;
        staticLights.length = 0;
        for (let lightTypePass = LIGHTTYPE_OMNI; lightTypePass <= LIGHTTYPE_SPOT; lightTypePass++) {
          for (let j = 0; j < lights.length; j++) {
            const light = lights[j];
            if (light._type !== lightTypePass) continue;
            if (light.enabled) {
              if (light.mask & drawCall.mask) {
                if (light.isStatic) {
                  if (!lightAabb[j]) {
                    lightAabb[j] = new BoundingBox();
                    // light.getBoundingBox(lightAabb[j]); // box from sphere seems to give better granularity
                    light._node.getWorldTransform();
                    light.getBoundingSphere(tempSphere);
                    lightAabb[j].center.copy(tempSphere.center);
                    lightAabb[j].halfExtents.set(tempSphere.radius, tempSphere.radius, tempSphere.radius);
                  }
                  if (!lightAabb[j].intersects(aabb)) continue;
                  staticLights.push(j);
                }
              }
            }
          }
        }
        if (staticLights.length === 0) {
          newDrawCalls.push(drawCall);
          continue;
        }
        const mesh = drawCall.mesh;
        const vertexBuffer = mesh.vertexBuffer;
        const indexBuffer = mesh.indexBuffer[drawCall.renderStyle];
        const indices = indexBuffer.bytesPerIndex === 2 ? new Uint16Array(indexBuffer.lock()) : new Uint32Array(indexBuffer.lock());
        const numTris = mesh.primitive[drawCall.renderStyle].count / 3;
        const baseIndex = mesh.primitive[drawCall.renderStyle].base;
        const elems = vertexBuffer.format.elements;
        const vertSize = vertexBuffer.format.size / 4; // / 4 because float
        const verts = new Float32Array(vertexBuffer.storage);
        let offsetP;
        for (let k = 0; k < elems.length; k++) {
          if (elems[k].name === SEMANTIC_POSITION) {
            offsetP = elems[k].offset / 4; // / 4 because float
          }
        }

        subTriAabbTime = now();
        triLightComb.length = numTris;
        for (let k = 0; k < numTris; k++) {
          // triLightComb[k] = ""; // uncomment to remove 32 lights limit
          triLightComb[k] = 0; // comment to remove 32 lights limit
        }

        let triLightCombUsed = false;
        triBounds.length = numTris * 6;
        for (let k = 0; k < numTris; k++) {
          let minx = Number.MAX_VALUE;
          let miny = Number.MAX_VALUE;
          let minz = Number.MAX_VALUE;
          let maxx = -Number.MAX_VALUE;
          let maxy = -Number.MAX_VALUE;
          let maxz = -Number.MAX_VALUE;
          for (let v = 0; v < 3; v++) {
            let _index = indices[k * 3 + v + baseIndex];
            _index = _index * vertSize + offsetP;
            const _x = verts[_index];
            const _y = verts[_index + 1];
            const _z = verts[_index + 2];
            if (_x < minx) minx = _x;
            if (_y < miny) miny = _y;
            if (_z < minz) minz = _z;
            if (_x > maxx) maxx = _x;
            if (_y > maxy) maxy = _y;
            if (_z > maxz) maxz = _z;
          }
          const index = k * 6;
          triBounds[index] = minx;
          triBounds[index + 1] = miny;
          triBounds[index + 2] = minz;
          triBounds[index + 3] = maxx;
          triBounds[index + 4] = maxy;
          triBounds[index + 5] = maxz;
        }
        triAabbTime += now() - subTriAabbTime;
        subSearchTime = now();
        for (let s = 0; s < staticLights.length; s++) {
          const j = staticLights[s];
          invMatrix.copy(drawCall.node.worldTransform).invert();
          localLightBounds.setFromTransformedAabb(lightAabb[j], invMatrix);
          const minv = localLightBounds.getMin();
          const maxv = localLightBounds.getMax();
          const bit = 1 << s;
          for (let k = 0; k < numTris; k++) {
            const index = k * 6;
            if (triBounds[index] <= maxv.x && triBounds[index + 3] >= minv.x && triBounds[index + 1] <= maxv.y && triBounds[index + 4] >= minv.y && triBounds[index + 2] <= maxv.z && triBounds[index + 5] >= minv.z) {
              // triLightComb[k] += j + "_";  // uncomment to remove 32 lights limit
              triLightComb[k] |= bit; // comment to remove 32 lights limit
              triLightCombUsed = true;
            }
          }
        }
        searchTime += now() - subSearchTime;
        if (triLightCombUsed) {
          subCombineTime = now();
          const combIndices = {};
          for (let k = 0; k < numTris; k++) {
            const j = k * 3 + baseIndex; // can go beyond 0xFFFF if base was non-zero?
            const combIbName = triLightComb[k];
            if (!combIndices[combIbName]) combIndices[combIbName] = [];
            const combIb = combIndices[combIbName];
            combIb.push(indices[j]);
            combIb.push(indices[j + 1]);
            combIb.push(indices[j + 2]);
          }
          combineTime += now() - subCombineTime;
          subWriteMeshTime = now();
          for (const combIbName in combIndices) {
            const combIb = combIndices[combIbName];
            const ib = new IndexBuffer(device, indexBuffer.format, combIb.length, indexBuffer.usage);
            const ib2 = ib.bytesPerIndex === 2 ? new Uint16Array(ib.lock()) : new Uint32Array(ib.lock());
            ib2.set(combIb);
            ib.unlock();
            let minx = Number.MAX_VALUE;
            let miny = Number.MAX_VALUE;
            let minz = Number.MAX_VALUE;
            let maxx = -Number.MAX_VALUE;
            let maxy = -Number.MAX_VALUE;
            let maxz = -Number.MAX_VALUE;
            for (let k = 0; k < combIb.length; k++) {
              const index = combIb[k];
              const _x = verts[index * vertSize + offsetP];
              const _y = verts[index * vertSize + offsetP + 1];
              const _z = verts[index * vertSize + offsetP + 2];
              if (_x < minx) minx = _x;
              if (_y < miny) miny = _y;
              if (_z < minz) minz = _z;
              if (_x > maxx) maxx = _x;
              if (_y > maxy) maxy = _y;
              if (_z > maxz) maxz = _z;
            }
            minVec.set(minx, miny, minz);
            maxVec.set(maxx, maxy, maxz);
            const chunkAabb = new BoundingBox();
            chunkAabb.setMinMax(minVec, maxVec);
            const mesh2 = new Mesh(device);
            mesh2.vertexBuffer = vertexBuffer;
            mesh2.indexBuffer[0] = ib;
            mesh2.primitive[0].type = PRIMITIVE_TRIANGLES;
            mesh2.primitive[0].base = 0;
            mesh2.primitive[0].count = combIb.length;
            mesh2.primitive[0].indexed = true;
            mesh2.aabb = chunkAabb;
            const instance = new MeshInstance(mesh2, drawCall.material, drawCall.node);
            instance.isStatic = drawCall.isStatic;
            instance.visible = drawCall.visible;
            instance.layer = drawCall.layer;
            instance.castShadow = drawCall.castShadow;
            instance._receiveShadow = drawCall._receiveShadow;
            instance.cull = drawCall.cull;
            instance.pick = drawCall.pick;
            instance.mask = drawCall.mask;
            instance.parameters = drawCall.parameters;
            instance._shaderDefs = drawCall._shaderDefs;
            instance._staticSource = drawCall;
            if (drawCall._staticLightList) {
              instance._staticLightList = drawCall._staticLightList; // add forced assigned lights
            } else {
              instance._staticLightList = [];
            }

            // uncomment to remove 32 lights limit
            // let lnames = combIbName.split("_");
            // lnames.length = lnames.length - 1;
            // for(k = 0; k < lnames.length; k++) {
            //     instance._staticLightList[k] = lights[parseInt(lnames[k])];
            // }

            // comment to remove 32 lights limit
            for (let k = 0; k < staticLights.length; k++) {
              const bit = 1 << k;
              if (combIbName & bit) {
                const lht = lights[staticLights[k]];
                if (instance._staticLightList.indexOf(lht) < 0) {
                  instance._staticLightList.push(lht);
                }
              }
            }
            instance._staticLightList.sort(StaticMeshes.lightCompare);
            newDrawCalls.push(instance);
          }
          writeMeshTime += now() - subWriteMeshTime;
        } else {
          newDrawCalls.push(drawCall);
        }
      }
    }
    // Set array to new
    meshInstances.length = newDrawCalls.length;
    for (let i = 0; i < newDrawCalls.length; i++) {
      meshInstances[i] = newDrawCalls[i];
    }
    scene._stats.lastStaticPrepareFullTime = now() - prepareTime;
    scene._stats.lastStaticPrepareSearchTime = searchTime;
    scene._stats.lastStaticPrepareWriteTime = writeMeshTime;
    scene._stats.lastStaticPrepareTriAabbTime = triAabbTime;
    scene._stats.lastStaticPrepareCombineTime = combineTime;
  }
  static revert(meshInstances) {
    const drawCalls = meshInstances;
    const drawCallsCount = drawCalls.length;
    const newDrawCalls = [];
    let prevStaticSource;
    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];
      if (drawCall._staticSource) {
        if (drawCall._staticSource !== prevStaticSource) {
          newDrawCalls.push(drawCall._staticSource);
          prevStaticSource = drawCall._staticSource;
        }
      } else {
        newDrawCalls.push(drawCall);
      }
    }

    // Set array to new
    meshInstances.length = newDrawCalls.length;
    for (let i = 0; i < newDrawCalls.length; i++) {
      meshInstances[i] = newDrawCalls[i];
    }
  }
}

export { StaticMeshes };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljLW1lc2hlcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL3N0YXRpYy1tZXNoZXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcbmltcG9ydCB7IEJvdW5kaW5nU3BoZXJlIH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMnO1xuXG5pbXBvcnQgeyBQUklNSVRJVkVfVFJJQU5HTEVTLCBTRU1BTlRJQ19QT1NJVElPTiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5cbmltcG9ydCB7IExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVCB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi9tZXNoLWluc3RhbmNlLmpzJztcblxuY29uc3QgdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuXG5jbGFzcyBTdGF0aWNNZXNoZXMge1xuICAgIHN0YXRpYyBsaWdodENvbXBhcmUobGlnaHRBLCBsaWdodEIpIHtcbiAgICAgICAgcmV0dXJuIGxpZ2h0QS5rZXkgLSBsaWdodEIua2V5O1xuICAgIH1cblxuICAgIHN0YXRpYyBwcmVwYXJlKGRldmljZSwgc2NlbmUsIG1lc2hJbnN0YW5jZXMsIGxpZ2h0cykge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHByZXBhcmVUaW1lID0gbm93KCk7XG4gICAgICAgIGxldCBzZWFyY2hUaW1lID0gMDtcbiAgICAgICAgbGV0IHN1YlNlYXJjaFRpbWUgPSAwO1xuICAgICAgICBsZXQgdHJpQWFiYlRpbWUgPSAwO1xuICAgICAgICBsZXQgc3ViVHJpQWFiYlRpbWUgPSAwO1xuICAgICAgICBsZXQgd3JpdGVNZXNoVGltZSA9IDA7XG4gICAgICAgIGxldCBzdWJXcml0ZU1lc2hUaW1lID0gMDtcbiAgICAgICAgbGV0IGNvbWJpbmVUaW1lID0gMDtcbiAgICAgICAgbGV0IHN1YkNvbWJpbmVUaW1lID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzID0gbWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuXG4gICAgICAgIGNvbnN0IG5ld0RyYXdDYWxscyA9IFtdO1xuICAgICAgICBjb25zdCBtaW5WZWMgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBtYXhWZWMgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBsb2NhbExpZ2h0Qm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIGNvbnN0IGludk1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIGNvbnN0IHRyaUxpZ2h0Q29tYiA9IFtdO1xuICAgICAgICBjb25zdCBsaWdodEFhYmIgPSBbXTtcbiAgICAgICAgY29uc3QgdHJpQm91bmRzID0gW107XG4gICAgICAgIGNvbnN0IHN0YXRpY0xpZ2h0cyA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgbmV3RHJhd0NhbGxzLnB1c2goZHJhd0NhbGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhYWJiID0gZHJhd0NhbGwuYWFiYjtcbiAgICAgICAgICAgICAgICBzdGF0aWNMaWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBsaWdodFR5cGVQYXNzID0gTElHSFRUWVBFX09NTkk7IGxpZ2h0VHlwZVBhc3MgPD0gTElHSFRUWVBFX1NQT1Q7IGxpZ2h0VHlwZVBhc3MrKykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IGxpZ2h0VHlwZVBhc3MpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQubWFzayAmIGRyYXdDYWxsLm1hc2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0QWFiYltqXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0QWFiYltqXSA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0LmdldEJvdW5kaW5nQm94KGxpZ2h0QWFiYltqXSk7IC8vIGJveCBmcm9tIHNwaGVyZSBzZWVtcyB0byBnaXZlIGJldHRlciBncmFudWxhcml0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Ll9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQuZ2V0Qm91bmRpbmdTcGhlcmUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRBYWJiW2pdLmNlbnRlci5jb3B5KHRlbXBTcGhlcmUuY2VudGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodEFhYmJbal0uaGFsZkV4dGVudHMuc2V0KHRlbXBTcGhlcmUucmFkaXVzLCB0ZW1wU3BoZXJlLnJhZGl1cywgdGVtcFNwaGVyZS5yYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodEFhYmJbal0uaW50ZXJzZWN0cyhhYWJiKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0aWNMaWdodHMucHVzaChqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzdGF0aWNMaWdodHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IGRyYXdDYWxsLm1lc2g7XG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gbWVzaC52ZXJ0ZXhCdWZmZXI7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSBtZXNoLmluZGV4QnVmZmVyW2RyYXdDYWxsLnJlbmRlclN0eWxlXTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gaW5kZXhCdWZmZXIuYnl0ZXNQZXJJbmRleCA9PT0gMiA/IG5ldyBVaW50MTZBcnJheShpbmRleEJ1ZmZlci5sb2NrKCkpIDogbmV3IFVpbnQzMkFycmF5KGluZGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbnVtVHJpcyA9IG1lc2gucHJpbWl0aXZlW2RyYXdDYWxsLnJlbmRlclN0eWxlXS5jb3VudCAvIDM7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZUluZGV4ID0gbWVzaC5wcmltaXRpdmVbZHJhd0NhbGwucmVuZGVyU3R5bGVdLmJhc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbXMgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRTaXplID0gdmVydGV4QnVmZmVyLmZvcm1hdC5zaXplIC8gNDsgLy8gLyA0IGJlY2F1c2UgZmxvYXRcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0cyA9IG5ldyBGbG9hdDMyQXJyYXkodmVydGV4QnVmZmVyLnN0b3JhZ2UpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG9mZnNldFA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBlbGVtcy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbXNba10ubmFtZSA9PT0gU0VNQU5USUNfUE9TSVRJT04pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldFAgPSBlbGVtc1trXS5vZmZzZXQgLyA0OyAvLyAvIDQgYmVjYXVzZSBmbG9hdFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgIHN1YlRyaUFhYmJUaW1lID0gbm93KCk7XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICB0cmlMaWdodENvbWIubGVuZ3RoID0gbnVtVHJpcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IG51bVRyaXM7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAvLyB0cmlMaWdodENvbWJba10gPSBcIlwiOyAvLyB1bmNvbW1lbnQgdG8gcmVtb3ZlIDMyIGxpZ2h0cyBsaW1pdFxuICAgICAgICAgICAgICAgICAgICB0cmlMaWdodENvbWJba10gPSAwOyAvLyBjb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IHRyaUxpZ2h0Q29tYlVzZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHRyaUJvdW5kcy5sZW5ndGggPSBudW1UcmlzICogNjtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IG51bVRyaXM7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWlueCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgICAgICAgICAgICAgIGxldCBtaW55ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG1pbnogPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eCA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eSA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eiA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IDM7IHYrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGluZGV4ID0gaW5kaWNlc1trICogMyArIHYgKyBiYXNlSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRleCAqIHZlcnRTaXplICsgb2Zmc2V0UDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IF94ID0gdmVydHNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3kgPSB2ZXJ0c1tpbmRleCArIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3ogPSB2ZXJ0c1tpbmRleCArIDJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF94IDwgbWlueCkgbWlueCA9IF94O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95IDwgbWlueSkgbWlueSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF96IDwgbWlueikgbWlueiA9IF96O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF94ID4gbWF4eCkgbWF4eCA9IF94O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95ID4gbWF4eSkgbWF4eSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF96ID4gbWF4eikgbWF4eiA9IF96O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gayAqIDY7XG4gICAgICAgICAgICAgICAgICAgIHRyaUJvdW5kc1tpbmRleF0gPSBtaW54O1xuICAgICAgICAgICAgICAgICAgICB0cmlCb3VuZHNbaW5kZXggKyAxXSA9IG1pbnk7XG4gICAgICAgICAgICAgICAgICAgIHRyaUJvdW5kc1tpbmRleCArIDJdID0gbWluejtcbiAgICAgICAgICAgICAgICAgICAgdHJpQm91bmRzW2luZGV4ICsgM10gPSBtYXh4O1xuICAgICAgICAgICAgICAgICAgICB0cmlCb3VuZHNbaW5kZXggKyA0XSA9IG1heHk7XG4gICAgICAgICAgICAgICAgICAgIHRyaUJvdW5kc1tpbmRleCArIDVdID0gbWF4ejtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgIHRyaUFhYmJUaW1lICs9IG5vdygpIC0gc3ViVHJpQWFiYlRpbWU7XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgc3ViU2VhcmNoVGltZSA9IG5vdygpO1xuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgc3RhdGljTGlnaHRzLmxlbmd0aDsgcysrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGogPSBzdGF0aWNMaWdodHNbc107XG5cbiAgICAgICAgICAgICAgICAgICAgaW52TWF0cml4LmNvcHkoZHJhd0NhbGwubm9kZS53b3JsZFRyYW5zZm9ybSkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsTGlnaHRCb3VuZHMuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihsaWdodEFhYmJbal0sIGludk1hdHJpeCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pbnYgPSBsb2NhbExpZ2h0Qm91bmRzLmdldE1pbigpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXh2ID0gbG9jYWxMaWdodEJvdW5kcy5nZXRNYXgoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYml0ID0gMSA8PCBzO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgbnVtVHJpczsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IGsgKiA2O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh0cmlCb3VuZHNbaW5kZXhdIDw9IG1heHYueCkgJiYgKHRyaUJvdW5kc1tpbmRleCArIDNdID49IG1pbnYueCkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAodHJpQm91bmRzW2luZGV4ICsgMV0gPD0gbWF4di55KSAmJiAodHJpQm91bmRzW2luZGV4ICsgNF0gPj0gbWludi55KSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICh0cmlCb3VuZHNbaW5kZXggKyAyXSA8PSBtYXh2LnopICYmICh0cmlCb3VuZHNbaW5kZXggKyA1XSA+PSBtaW52LnopKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0cmlMaWdodENvbWJba10gKz0gaiArIFwiX1wiOyAgLy8gdW5jb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmlMaWdodENvbWJba10gfD0gYml0OyAvLyBjb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmlMaWdodENvbWJVc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgc2VhcmNoVGltZSArPSBub3coKSAtIHN1YlNlYXJjaFRpbWU7XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBpZiAodHJpTGlnaHRDb21iVXNlZCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgc3ViQ29tYmluZVRpbWUgPSBub3coKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tYkluZGljZXMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBudW1UcmlzOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGogPSBrICogMyArIGJhc2VJbmRleDsgLy8gY2FuIGdvIGJleW9uZCAweEZGRkYgaWYgYmFzZSB3YXMgbm9uLXplcm8/XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21iSWJOYW1lID0gdHJpTGlnaHRDb21iW2tdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjb21iSW5kaWNlc1tjb21iSWJOYW1lXSkgY29tYkluZGljZXNbY29tYkliTmFtZV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbWJJYiA9IGNvbWJJbmRpY2VzW2NvbWJJYk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tYkliLnB1c2goaW5kaWNlc1tqXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21iSWIucHVzaChpbmRpY2VzW2ogKyAxXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21iSWIucHVzaChpbmRpY2VzW2ogKyAyXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgICAgIGNvbWJpbmVUaW1lICs9IG5vdygpIC0gc3ViQ29tYmluZVRpbWU7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgc3ViV3JpdGVNZXNoVGltZSA9IG5vdygpO1xuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbWJJYk5hbWUgaW4gY29tYkluZGljZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbWJJYiA9IGNvbWJJbmRpY2VzW2NvbWJJYk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaWIgPSBuZXcgSW5kZXhCdWZmZXIoZGV2aWNlLCBpbmRleEJ1ZmZlci5mb3JtYXQsIGNvbWJJYi5sZW5ndGgsIGluZGV4QnVmZmVyLnVzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGliMiA9IGliLmJ5dGVzUGVySW5kZXggPT09IDIgPyBuZXcgVWludDE2QXJyYXkoaWIubG9jaygpKSA6IG5ldyBVaW50MzJBcnJheShpYi5sb2NrKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWIyLnNldChjb21iSWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWIudW5sb2NrKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW54ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW55ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW56ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtYXh4ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eSA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1heHogPSAtTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgY29tYkliLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSBjb21iSWJba107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3ggPSB2ZXJ0c1tpbmRleCAqIHZlcnRTaXplICsgb2Zmc2V0UF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3kgPSB2ZXJ0c1tpbmRleCAqIHZlcnRTaXplICsgb2Zmc2V0UCArIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IF96ID0gdmVydHNbaW5kZXggKiB2ZXJ0U2l6ZSArIG9mZnNldFAgKyAyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoX3ggPCBtaW54KSBtaW54ID0gX3g7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95IDwgbWlueSkgbWlueSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfeiA8IG1pbnopIG1pbnogPSBfejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoX3ggPiBtYXh4KSBtYXh4ID0gX3g7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95ID4gbWF4eSkgbWF4eSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfeiA+IG1heHopIG1heHogPSBfejtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1pblZlYy5zZXQobWlueCwgbWlueSwgbWlueik7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhWZWMuc2V0KG1heHgsIG1heHksIG1heHopO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2h1bmtBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaHVua0FhYmIuc2V0TWluTWF4KG1pblZlYywgbWF4VmVjKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaDIgPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaDIudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaDIuaW5kZXhCdWZmZXJbMF0gPSBpYjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2gyLnByaW1pdGl2ZVswXS50eXBlID0gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2gyLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2gyLnByaW1pdGl2ZVswXS5jb3VudCA9IGNvbWJJYi5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoMi5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoMi5hYWJiID0gY2h1bmtBYWJiO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaDIsIGRyYXdDYWxsLm1hdGVyaWFsLCBkcmF3Q2FsbC5ub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmlzU3RhdGljID0gZHJhd0NhbGwuaXNTdGF0aWM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS52aXNpYmxlID0gZHJhd0NhbGwudmlzaWJsZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmxheWVyID0gZHJhd0NhbGwubGF5ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5jYXN0U2hhZG93ID0gZHJhd0NhbGwuY2FzdFNoYWRvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9yZWNlaXZlU2hhZG93ID0gZHJhd0NhbGwuX3JlY2VpdmVTaGFkb3c7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5jdWxsID0gZHJhd0NhbGwuY3VsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLnBpY2sgPSBkcmF3Q2FsbC5waWNrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UubWFzayA9IGRyYXdDYWxsLm1hc2s7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5wYXJhbWV0ZXJzID0gZHJhd0NhbGwucGFyYW1ldGVycztcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9zaGFkZXJEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5fc3RhdGljU291cmNlID0gZHJhd0NhbGw7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuX3N0YXRpY0xpZ2h0TGlzdCA9IGRyYXdDYWxsLl9zdGF0aWNMaWdodExpc3Q7IC8vIGFkZCBmb3JjZWQgYXNzaWduZWQgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9zdGF0aWNMaWdodExpc3QgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdW5jb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxldCBsbmFtZXMgPSBjb21iSWJOYW1lLnNwbGl0KFwiX1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxuYW1lcy5sZW5ndGggPSBsbmFtZXMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvcihrID0gMDsgayA8IGxuYW1lcy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgIGluc3RhbmNlLl9zdGF0aWNMaWdodExpc3Rba10gPSBsaWdodHNbcGFyc2VJbnQobG5hbWVzW2tdKV07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbW1lbnQgdG8gcmVtb3ZlIDMyIGxpZ2h0cyBsaW1pdFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBzdGF0aWNMaWdodHMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaXQgPSAxIDw8IGs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbWJJYk5hbWUgJiBiaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGh0ID0gbGlnaHRzW3N0YXRpY0xpZ2h0c1trXV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5fc3RhdGljTGlnaHRMaXN0LmluZGV4T2YobGh0KSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9zdGF0aWNMaWdodExpc3QucHVzaChsaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5fc3RhdGljTGlnaHRMaXN0LnNvcnQoU3RhdGljTWVzaGVzLmxpZ2h0Q29tcGFyZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVNZXNoVGltZSArPSBub3coKSAtIHN1YldyaXRlTWVzaFRpbWU7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2V0IGFycmF5IHRvIG5ld1xuICAgICAgICBtZXNoSW5zdGFuY2VzLmxlbmd0aCA9IG5ld0RyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmV3RHJhd0NhbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldID0gbmV3RHJhd0NhbGxzW2ldO1xuICAgICAgICB9XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlRnVsbFRpbWUgPSBub3coKSAtIHByZXBhcmVUaW1lO1xuICAgICAgICBzY2VuZS5fc3RhdHMubGFzdFN0YXRpY1ByZXBhcmVTZWFyY2hUaW1lID0gc2VhcmNoVGltZTtcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlV3JpdGVUaW1lID0gd3JpdGVNZXNoVGltZTtcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlVHJpQWFiYlRpbWUgPSB0cmlBYWJiVGltZTtcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlQ29tYmluZVRpbWUgPSBjb21iaW5lVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgc3RhdGljIHJldmVydChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IG1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgbmV3RHJhd0NhbGxzID0gW107XG5cbiAgICAgICAgbGV0IHByZXZTdGF0aWNTb3VyY2U7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuX3N0YXRpY1NvdXJjZSkge1xuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5fc3RhdGljU291cmNlICE9PSBwcmV2U3RhdGljU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsLl9zdGF0aWNTb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICBwcmV2U3RhdGljU291cmNlID0gZHJhd0NhbGwuX3N0YXRpY1NvdXJjZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCBhcnJheSB0byBuZXdcbiAgICAgICAgbWVzaEluc3RhbmNlcy5sZW5ndGggPSBuZXdEcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld0RyYXdDYWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXSA9IG5ld0RyYXdDYWxsc1tpXTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgU3RhdGljTWVzaGVzIH07XG4iXSwibmFtZXMiOlsidGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiU3RhdGljTWVzaGVzIiwibGlnaHRDb21wYXJlIiwibGlnaHRBIiwibGlnaHRCIiwia2V5IiwicHJlcGFyZSIsImRldmljZSIsInNjZW5lIiwibWVzaEluc3RhbmNlcyIsImxpZ2h0cyIsInByZXBhcmVUaW1lIiwibm93Iiwic2VhcmNoVGltZSIsInN1YlNlYXJjaFRpbWUiLCJ0cmlBYWJiVGltZSIsInN1YlRyaUFhYmJUaW1lIiwid3JpdGVNZXNoVGltZSIsInN1YldyaXRlTWVzaFRpbWUiLCJjb21iaW5lVGltZSIsInN1YkNvbWJpbmVUaW1lIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJsZW5ndGgiLCJuZXdEcmF3Q2FsbHMiLCJtaW5WZWMiLCJWZWMzIiwibWF4VmVjIiwibG9jYWxMaWdodEJvdW5kcyIsIkJvdW5kaW5nQm94IiwiaW52TWF0cml4IiwiTWF0NCIsInRyaUxpZ2h0Q29tYiIsImxpZ2h0QWFiYiIsInRyaUJvdW5kcyIsInN0YXRpY0xpZ2h0cyIsImkiLCJkcmF3Q2FsbCIsImlzU3RhdGljIiwicHVzaCIsImFhYmIiLCJsaWdodFR5cGVQYXNzIiwiTElHSFRUWVBFX09NTkkiLCJMSUdIVFRZUEVfU1BPVCIsImoiLCJsaWdodCIsIl90eXBlIiwiZW5hYmxlZCIsIm1hc2siLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0Qm91bmRpbmdTcGhlcmUiLCJjZW50ZXIiLCJjb3B5IiwiaGFsZkV4dGVudHMiLCJzZXQiLCJyYWRpdXMiLCJpbnRlcnNlY3RzIiwibWVzaCIsInZlcnRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwicmVuZGVyU3R5bGUiLCJpbmRpY2VzIiwiYnl0ZXNQZXJJbmRleCIsIlVpbnQxNkFycmF5IiwibG9jayIsIlVpbnQzMkFycmF5IiwibnVtVHJpcyIsInByaW1pdGl2ZSIsImNvdW50IiwiYmFzZUluZGV4IiwiYmFzZSIsImVsZW1zIiwiZm9ybWF0IiwiZWxlbWVudHMiLCJ2ZXJ0U2l6ZSIsInNpemUiLCJ2ZXJ0cyIsIkZsb2F0MzJBcnJheSIsInN0b3JhZ2UiLCJvZmZzZXRQIiwiayIsIm5hbWUiLCJTRU1BTlRJQ19QT1NJVElPTiIsIm9mZnNldCIsInRyaUxpZ2h0Q29tYlVzZWQiLCJtaW54IiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwibWlueSIsIm1pbnoiLCJtYXh4IiwibWF4eSIsIm1heHoiLCJ2IiwiaW5kZXgiLCJfeCIsIl95IiwiX3oiLCJzIiwibm9kZSIsIndvcmxkVHJhbnNmb3JtIiwiaW52ZXJ0Iiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsIm1pbnYiLCJnZXRNaW4iLCJtYXh2IiwiZ2V0TWF4IiwiYml0IiwieCIsInkiLCJ6IiwiY29tYkluZGljZXMiLCJjb21iSWJOYW1lIiwiY29tYkliIiwiaWIiLCJJbmRleEJ1ZmZlciIsInVzYWdlIiwiaWIyIiwidW5sb2NrIiwiY2h1bmtBYWJiIiwic2V0TWluTWF4IiwibWVzaDIiLCJNZXNoIiwidHlwZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJpbmRleGVkIiwiaW5zdGFuY2UiLCJNZXNoSW5zdGFuY2UiLCJtYXRlcmlhbCIsInZpc2libGUiLCJsYXllciIsImNhc3RTaGFkb3ciLCJfcmVjZWl2ZVNoYWRvdyIsImN1bGwiLCJwaWNrIiwicGFyYW1ldGVycyIsIl9zaGFkZXJEZWZzIiwiX3N0YXRpY1NvdXJjZSIsIl9zdGF0aWNMaWdodExpc3QiLCJsaHQiLCJpbmRleE9mIiwic29ydCIsIl9zdGF0cyIsImxhc3RTdGF0aWNQcmVwYXJlRnVsbFRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZVNlYXJjaFRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZVdyaXRlVGltZSIsImxhc3RTdGF0aWNQcmVwYXJlVHJpQWFiYlRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZUNvbWJpbmVUaW1lIiwicmV2ZXJ0IiwicHJldlN0YXRpY1NvdXJjZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQWNBLE1BQU1BLFVBQVUsR0FBRyxJQUFJQyxjQUFjLEVBQUUsQ0FBQTtBQUV2QyxNQUFNQyxZQUFZLENBQUM7QUFDZixFQUFBLE9BQU9DLFlBQVksQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFDaEMsSUFBQSxPQUFPRCxNQUFNLENBQUNFLEdBQUcsR0FBR0QsTUFBTSxDQUFDQyxHQUFHLENBQUE7QUFDbEMsR0FBQTtFQUVBLE9BQU9DLE9BQU8sQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLGFBQWEsRUFBRUMsTUFBTSxFQUFFO0lBRWpELE1BQU1DLFdBQVcsR0FBR0MsR0FBRyxFQUFFLENBQUE7SUFDekIsSUFBSUMsVUFBVSxHQUFHLENBQUMs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
