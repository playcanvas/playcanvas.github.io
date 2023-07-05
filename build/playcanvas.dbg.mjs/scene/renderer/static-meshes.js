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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljLW1lc2hlcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL3N0YXRpYy1tZXNoZXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcbmltcG9ydCB7IEJvdW5kaW5nU3BoZXJlIH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMnO1xuXG5pbXBvcnQgeyBQUklNSVRJVkVfVFJJQU5HTEVTLCBTRU1BTlRJQ19QT1NJVElPTiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5cbmltcG9ydCB7IExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVCB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi9tZXNoLWluc3RhbmNlLmpzJztcblxuY29uc3QgdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuXG5jbGFzcyBTdGF0aWNNZXNoZXMge1xuICAgIHN0YXRpYyBsaWdodENvbXBhcmUobGlnaHRBLCBsaWdodEIpIHtcbiAgICAgICAgcmV0dXJuIGxpZ2h0QS5rZXkgLSBsaWdodEIua2V5O1xuICAgIH1cblxuICAgIHN0YXRpYyBwcmVwYXJlKGRldmljZSwgc2NlbmUsIG1lc2hJbnN0YW5jZXMsIGxpZ2h0cykge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHByZXBhcmVUaW1lID0gbm93KCk7XG4gICAgICAgIGxldCBzZWFyY2hUaW1lID0gMDtcbiAgICAgICAgbGV0IHN1YlNlYXJjaFRpbWUgPSAwO1xuICAgICAgICBsZXQgdHJpQWFiYlRpbWUgPSAwO1xuICAgICAgICBsZXQgc3ViVHJpQWFiYlRpbWUgPSAwO1xuICAgICAgICBsZXQgd3JpdGVNZXNoVGltZSA9IDA7XG4gICAgICAgIGxldCBzdWJXcml0ZU1lc2hUaW1lID0gMDtcbiAgICAgICAgbGV0IGNvbWJpbmVUaW1lID0gMDtcbiAgICAgICAgbGV0IHN1YkNvbWJpbmVUaW1lID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzID0gbWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuXG4gICAgICAgIGNvbnN0IG5ld0RyYXdDYWxscyA9IFtdO1xuICAgICAgICBjb25zdCBtaW5WZWMgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBtYXhWZWMgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBsb2NhbExpZ2h0Qm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIGNvbnN0IGludk1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIGNvbnN0IHRyaUxpZ2h0Q29tYiA9IFtdO1xuICAgICAgICBjb25zdCBsaWdodEFhYmIgPSBbXTtcbiAgICAgICAgY29uc3QgdHJpQm91bmRzID0gW107XG4gICAgICAgIGNvbnN0IHN0YXRpY0xpZ2h0cyA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgbmV3RHJhd0NhbGxzLnB1c2goZHJhd0NhbGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhYWJiID0gZHJhd0NhbGwuYWFiYjtcbiAgICAgICAgICAgICAgICBzdGF0aWNMaWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBsaWdodFR5cGVQYXNzID0gTElHSFRUWVBFX09NTkk7IGxpZ2h0VHlwZVBhc3MgPD0gTElHSFRUWVBFX1NQT1Q7IGxpZ2h0VHlwZVBhc3MrKykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IGxpZ2h0VHlwZVBhc3MpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQubWFzayAmIGRyYXdDYWxsLm1hc2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0QWFiYltqXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0QWFiYltqXSA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0LmdldEJvdW5kaW5nQm94KGxpZ2h0QWFiYltqXSk7IC8vIGJveCBmcm9tIHNwaGVyZSBzZWVtcyB0byBnaXZlIGJldHRlciBncmFudWxhcml0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Ll9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQuZ2V0Qm91bmRpbmdTcGhlcmUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRBYWJiW2pdLmNlbnRlci5jb3B5KHRlbXBTcGhlcmUuY2VudGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodEFhYmJbal0uaGFsZkV4dGVudHMuc2V0KHRlbXBTcGhlcmUucmFkaXVzLCB0ZW1wU3BoZXJlLnJhZGl1cywgdGVtcFNwaGVyZS5yYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodEFhYmJbal0uaW50ZXJzZWN0cyhhYWJiKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0aWNMaWdodHMucHVzaChqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzdGF0aWNMaWdodHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IGRyYXdDYWxsLm1lc2g7XG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gbWVzaC52ZXJ0ZXhCdWZmZXI7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSBtZXNoLmluZGV4QnVmZmVyW2RyYXdDYWxsLnJlbmRlclN0eWxlXTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gaW5kZXhCdWZmZXIuYnl0ZXNQZXJJbmRleCA9PT0gMiA/IG5ldyBVaW50MTZBcnJheShpbmRleEJ1ZmZlci5sb2NrKCkpIDogbmV3IFVpbnQzMkFycmF5KGluZGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbnVtVHJpcyA9IG1lc2gucHJpbWl0aXZlW2RyYXdDYWxsLnJlbmRlclN0eWxlXS5jb3VudCAvIDM7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZUluZGV4ID0gbWVzaC5wcmltaXRpdmVbZHJhd0NhbGwucmVuZGVyU3R5bGVdLmJhc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbXMgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRTaXplID0gdmVydGV4QnVmZmVyLmZvcm1hdC5zaXplIC8gNDsgLy8gLyA0IGJlY2F1c2UgZmxvYXRcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0cyA9IG5ldyBGbG9hdDMyQXJyYXkodmVydGV4QnVmZmVyLnN0b3JhZ2UpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG9mZnNldFA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBlbGVtcy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbXNba10ubmFtZSA9PT0gU0VNQU5USUNfUE9TSVRJT04pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldFAgPSBlbGVtc1trXS5vZmZzZXQgLyA0OyAvLyAvIDQgYmVjYXVzZSBmbG9hdFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgIHN1YlRyaUFhYmJUaW1lID0gbm93KCk7XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICB0cmlMaWdodENvbWIubGVuZ3RoID0gbnVtVHJpcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IG51bVRyaXM7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAvLyB0cmlMaWdodENvbWJba10gPSBcIlwiOyAvLyB1bmNvbW1lbnQgdG8gcmVtb3ZlIDMyIGxpZ2h0cyBsaW1pdFxuICAgICAgICAgICAgICAgICAgICB0cmlMaWdodENvbWJba10gPSAwOyAvLyBjb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IHRyaUxpZ2h0Q29tYlVzZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHRyaUJvdW5kcy5sZW5ndGggPSBudW1UcmlzICogNjtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IG51bVRyaXM7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWlueCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgICAgICAgICAgICAgIGxldCBtaW55ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG1pbnogPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eCA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eSA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eiA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IDM7IHYrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGluZGV4ID0gaW5kaWNlc1trICogMyArIHYgKyBiYXNlSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRleCAqIHZlcnRTaXplICsgb2Zmc2V0UDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IF94ID0gdmVydHNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3kgPSB2ZXJ0c1tpbmRleCArIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3ogPSB2ZXJ0c1tpbmRleCArIDJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF94IDwgbWlueCkgbWlueCA9IF94O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95IDwgbWlueSkgbWlueSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF96IDwgbWlueikgbWlueiA9IF96O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF94ID4gbWF4eCkgbWF4eCA9IF94O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95ID4gbWF4eSkgbWF4eSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF96ID4gbWF4eikgbWF4eiA9IF96O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gayAqIDY7XG4gICAgICAgICAgICAgICAgICAgIHRyaUJvdW5kc1tpbmRleF0gPSBtaW54O1xuICAgICAgICAgICAgICAgICAgICB0cmlCb3VuZHNbaW5kZXggKyAxXSA9IG1pbnk7XG4gICAgICAgICAgICAgICAgICAgIHRyaUJvdW5kc1tpbmRleCArIDJdID0gbWluejtcbiAgICAgICAgICAgICAgICAgICAgdHJpQm91bmRzW2luZGV4ICsgM10gPSBtYXh4O1xuICAgICAgICAgICAgICAgICAgICB0cmlCb3VuZHNbaW5kZXggKyA0XSA9IG1heHk7XG4gICAgICAgICAgICAgICAgICAgIHRyaUJvdW5kc1tpbmRleCArIDVdID0gbWF4ejtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgIHRyaUFhYmJUaW1lICs9IG5vdygpIC0gc3ViVHJpQWFiYlRpbWU7XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgc3ViU2VhcmNoVGltZSA9IG5vdygpO1xuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgc3RhdGljTGlnaHRzLmxlbmd0aDsgcysrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGogPSBzdGF0aWNMaWdodHNbc107XG5cbiAgICAgICAgICAgICAgICAgICAgaW52TWF0cml4LmNvcHkoZHJhd0NhbGwubm9kZS53b3JsZFRyYW5zZm9ybSkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsTGlnaHRCb3VuZHMuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihsaWdodEFhYmJbal0sIGludk1hdHJpeCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pbnYgPSBsb2NhbExpZ2h0Qm91bmRzLmdldE1pbigpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXh2ID0gbG9jYWxMaWdodEJvdW5kcy5nZXRNYXgoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYml0ID0gMSA8PCBzO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgbnVtVHJpczsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IGsgKiA2O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCh0cmlCb3VuZHNbaW5kZXhdIDw9IG1heHYueCkgJiYgKHRyaUJvdW5kc1tpbmRleCArIDNdID49IG1pbnYueCkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAodHJpQm91bmRzW2luZGV4ICsgMV0gPD0gbWF4di55KSAmJiAodHJpQm91bmRzW2luZGV4ICsgNF0gPj0gbWludi55KSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICh0cmlCb3VuZHNbaW5kZXggKyAyXSA8PSBtYXh2LnopICYmICh0cmlCb3VuZHNbaW5kZXggKyA1XSA+PSBtaW52LnopKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0cmlMaWdodENvbWJba10gKz0gaiArIFwiX1wiOyAgLy8gdW5jb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmlMaWdodENvbWJba10gfD0gYml0OyAvLyBjb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmlMaWdodENvbWJVc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgc2VhcmNoVGltZSArPSBub3coKSAtIHN1YlNlYXJjaFRpbWU7XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBpZiAodHJpTGlnaHRDb21iVXNlZCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgc3ViQ29tYmluZVRpbWUgPSBub3coKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tYkluZGljZXMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBudW1UcmlzOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGogPSBrICogMyArIGJhc2VJbmRleDsgLy8gY2FuIGdvIGJleW9uZCAweEZGRkYgaWYgYmFzZSB3YXMgbm9uLXplcm8/XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21iSWJOYW1lID0gdHJpTGlnaHRDb21iW2tdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjb21iSW5kaWNlc1tjb21iSWJOYW1lXSkgY29tYkluZGljZXNbY29tYkliTmFtZV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbWJJYiA9IGNvbWJJbmRpY2VzW2NvbWJJYk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tYkliLnB1c2goaW5kaWNlc1tqXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21iSWIucHVzaChpbmRpY2VzW2ogKyAxXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21iSWIucHVzaChpbmRpY2VzW2ogKyAyXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgICAgIGNvbWJpbmVUaW1lICs9IG5vdygpIC0gc3ViQ29tYmluZVRpbWU7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgc3ViV3JpdGVNZXNoVGltZSA9IG5vdygpO1xuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbWJJYk5hbWUgaW4gY29tYkluZGljZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbWJJYiA9IGNvbWJJbmRpY2VzW2NvbWJJYk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaWIgPSBuZXcgSW5kZXhCdWZmZXIoZGV2aWNlLCBpbmRleEJ1ZmZlci5mb3JtYXQsIGNvbWJJYi5sZW5ndGgsIGluZGV4QnVmZmVyLnVzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGliMiA9IGliLmJ5dGVzUGVySW5kZXggPT09IDIgPyBuZXcgVWludDE2QXJyYXkoaWIubG9jaygpKSA6IG5ldyBVaW50MzJBcnJheShpYi5sb2NrKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWIyLnNldChjb21iSWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWIudW5sb2NrKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW54ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW55ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW56ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtYXh4ID0gLU51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbWF4eSA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1heHogPSAtTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgY29tYkliLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSBjb21iSWJba107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3ggPSB2ZXJ0c1tpbmRleCAqIHZlcnRTaXplICsgb2Zmc2V0UF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX3kgPSB2ZXJ0c1tpbmRleCAqIHZlcnRTaXplICsgb2Zmc2V0UCArIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IF96ID0gdmVydHNbaW5kZXggKiB2ZXJ0U2l6ZSArIG9mZnNldFAgKyAyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoX3ggPCBtaW54KSBtaW54ID0gX3g7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95IDwgbWlueSkgbWlueSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfeiA8IG1pbnopIG1pbnogPSBfejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoX3ggPiBtYXh4KSBtYXh4ID0gX3g7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF95ID4gbWF4eSkgbWF4eSA9IF95O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfeiA+IG1heHopIG1heHogPSBfejtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1pblZlYy5zZXQobWlueCwgbWlueSwgbWlueik7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhWZWMuc2V0KG1heHgsIG1heHksIG1heHopO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2h1bmtBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaHVua0FhYmIuc2V0TWluTWF4KG1pblZlYywgbWF4VmVjKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaDIgPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaDIudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaDIuaW5kZXhCdWZmZXJbMF0gPSBpYjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2gyLnByaW1pdGl2ZVswXS50eXBlID0gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2gyLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2gyLnByaW1pdGl2ZVswXS5jb3VudCA9IGNvbWJJYi5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoMi5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoMi5hYWJiID0gY2h1bmtBYWJiO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaDIsIGRyYXdDYWxsLm1hdGVyaWFsLCBkcmF3Q2FsbC5ub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmlzU3RhdGljID0gZHJhd0NhbGwuaXNTdGF0aWM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS52aXNpYmxlID0gZHJhd0NhbGwudmlzaWJsZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmxheWVyID0gZHJhd0NhbGwubGF5ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5jYXN0U2hhZG93ID0gZHJhd0NhbGwuY2FzdFNoYWRvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9yZWNlaXZlU2hhZG93ID0gZHJhd0NhbGwuX3JlY2VpdmVTaGFkb3c7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5jdWxsID0gZHJhd0NhbGwuY3VsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLnBpY2sgPSBkcmF3Q2FsbC5waWNrO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UubWFzayA9IGRyYXdDYWxsLm1hc2s7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5wYXJhbWV0ZXJzID0gZHJhd0NhbGwucGFyYW1ldGVycztcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9zaGFkZXJEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5fc3RhdGljU291cmNlID0gZHJhd0NhbGw7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuX3N0YXRpY0xpZ2h0TGlzdCA9IGRyYXdDYWxsLl9zdGF0aWNMaWdodExpc3Q7IC8vIGFkZCBmb3JjZWQgYXNzaWduZWQgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9zdGF0aWNMaWdodExpc3QgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdW5jb21tZW50IHRvIHJlbW92ZSAzMiBsaWdodHMgbGltaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxldCBsbmFtZXMgPSBjb21iSWJOYW1lLnNwbGl0KFwiX1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxuYW1lcy5sZW5ndGggPSBsbmFtZXMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvcihrID0gMDsgayA8IGxuYW1lcy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgIGluc3RhbmNlLl9zdGF0aWNMaWdodExpc3Rba10gPSBsaWdodHNbcGFyc2VJbnQobG5hbWVzW2tdKV07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbW1lbnQgdG8gcmVtb3ZlIDMyIGxpZ2h0cyBsaW1pdFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBzdGF0aWNMaWdodHMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaXQgPSAxIDw8IGs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbWJJYk5hbWUgJiBiaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGh0ID0gbGlnaHRzW3N0YXRpY0xpZ2h0c1trXV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5fc3RhdGljTGlnaHRMaXN0LmluZGV4T2YobGh0KSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLl9zdGF0aWNMaWdodExpc3QucHVzaChsaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5fc3RhdGljTGlnaHRMaXN0LnNvcnQoU3RhdGljTWVzaGVzLmxpZ2h0Q29tcGFyZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVNZXNoVGltZSArPSBub3coKSAtIHN1YldyaXRlTWVzaFRpbWU7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2V0IGFycmF5IHRvIG5ld1xuICAgICAgICBtZXNoSW5zdGFuY2VzLmxlbmd0aCA9IG5ld0RyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmV3RHJhd0NhbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldID0gbmV3RHJhd0NhbGxzW2ldO1xuICAgICAgICB9XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlRnVsbFRpbWUgPSBub3coKSAtIHByZXBhcmVUaW1lO1xuICAgICAgICBzY2VuZS5fc3RhdHMubGFzdFN0YXRpY1ByZXBhcmVTZWFyY2hUaW1lID0gc2VhcmNoVGltZTtcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlV3JpdGVUaW1lID0gd3JpdGVNZXNoVGltZTtcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlVHJpQWFiYlRpbWUgPSB0cmlBYWJiVGltZTtcbiAgICAgICAgc2NlbmUuX3N0YXRzLmxhc3RTdGF0aWNQcmVwYXJlQ29tYmluZVRpbWUgPSBjb21iaW5lVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgc3RhdGljIHJldmVydChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IG1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgbmV3RHJhd0NhbGxzID0gW107XG5cbiAgICAgICAgbGV0IHByZXZTdGF0aWNTb3VyY2U7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuX3N0YXRpY1NvdXJjZSkge1xuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5fc3RhdGljU291cmNlICE9PSBwcmV2U3RhdGljU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsLl9zdGF0aWNTb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICBwcmV2U3RhdGljU291cmNlID0gZHJhd0NhbGwuX3N0YXRpY1NvdXJjZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld0RyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCBhcnJheSB0byBuZXdcbiAgICAgICAgbWVzaEluc3RhbmNlcy5sZW5ndGggPSBuZXdEcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld0RyYXdDYWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXSA9IG5ld0RyYXdDYWxsc1tpXTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgU3RhdGljTWVzaGVzIH07XG4iXSwibmFtZXMiOlsidGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiU3RhdGljTWVzaGVzIiwibGlnaHRDb21wYXJlIiwibGlnaHRBIiwibGlnaHRCIiwia2V5IiwicHJlcGFyZSIsImRldmljZSIsInNjZW5lIiwibWVzaEluc3RhbmNlcyIsImxpZ2h0cyIsInByZXBhcmVUaW1lIiwibm93Iiwic2VhcmNoVGltZSIsInN1YlNlYXJjaFRpbWUiLCJ0cmlBYWJiVGltZSIsInN1YlRyaUFhYmJUaW1lIiwid3JpdGVNZXNoVGltZSIsInN1YldyaXRlTWVzaFRpbWUiLCJjb21iaW5lVGltZSIsInN1YkNvbWJpbmVUaW1lIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJsZW5ndGgiLCJuZXdEcmF3Q2FsbHMiLCJtaW5WZWMiLCJWZWMzIiwibWF4VmVjIiwibG9jYWxMaWdodEJvdW5kcyIsIkJvdW5kaW5nQm94IiwiaW52TWF0cml4IiwiTWF0NCIsInRyaUxpZ2h0Q29tYiIsImxpZ2h0QWFiYiIsInRyaUJvdW5kcyIsInN0YXRpY0xpZ2h0cyIsImkiLCJkcmF3Q2FsbCIsImlzU3RhdGljIiwicHVzaCIsImFhYmIiLCJsaWdodFR5cGVQYXNzIiwiTElHSFRUWVBFX09NTkkiLCJMSUdIVFRZUEVfU1BPVCIsImoiLCJsaWdodCIsIl90eXBlIiwiZW5hYmxlZCIsIm1hc2siLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0Qm91bmRpbmdTcGhlcmUiLCJjZW50ZXIiLCJjb3B5IiwiaGFsZkV4dGVudHMiLCJzZXQiLCJyYWRpdXMiLCJpbnRlcnNlY3RzIiwibWVzaCIsInZlcnRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwicmVuZGVyU3R5bGUiLCJpbmRpY2VzIiwiYnl0ZXNQZXJJbmRleCIsIlVpbnQxNkFycmF5IiwibG9jayIsIlVpbnQzMkFycmF5IiwibnVtVHJpcyIsInByaW1pdGl2ZSIsImNvdW50IiwiYmFzZUluZGV4IiwiYmFzZSIsImVsZW1zIiwiZm9ybWF0IiwiZWxlbWVudHMiLCJ2ZXJ0U2l6ZSIsInNpemUiLCJ2ZXJ0cyIsIkZsb2F0MzJBcnJheSIsInN0b3JhZ2UiLCJvZmZzZXRQIiwiayIsIm5hbWUiLCJTRU1BTlRJQ19QT1NJVElPTiIsIm9mZnNldCIsInRyaUxpZ2h0Q29tYlVzZWQiLCJtaW54IiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwibWlueSIsIm1pbnoiLCJtYXh4IiwibWF4eSIsIm1heHoiLCJ2IiwiaW5kZXgiLCJfeCIsIl95IiwiX3oiLCJzIiwibm9kZSIsIndvcmxkVHJhbnNmb3JtIiwiaW52ZXJ0Iiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsIm1pbnYiLCJnZXRNaW4iLCJtYXh2IiwiZ2V0TWF4IiwiYml0IiwieCIsInkiLCJ6IiwiY29tYkluZGljZXMiLCJjb21iSWJOYW1lIiwiY29tYkliIiwiaWIiLCJJbmRleEJ1ZmZlciIsInVzYWdlIiwiaWIyIiwidW5sb2NrIiwiY2h1bmtBYWJiIiwic2V0TWluTWF4IiwibWVzaDIiLCJNZXNoIiwidHlwZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJpbmRleGVkIiwiaW5zdGFuY2UiLCJNZXNoSW5zdGFuY2UiLCJtYXRlcmlhbCIsInZpc2libGUiLCJsYXllciIsImNhc3RTaGFkb3ciLCJfcmVjZWl2ZVNoYWRvdyIsImN1bGwiLCJwaWNrIiwicGFyYW1ldGVycyIsIl9zaGFkZXJEZWZzIiwiX3N0YXRpY1NvdXJjZSIsIl9zdGF0aWNMaWdodExpc3QiLCJsaHQiLCJpbmRleE9mIiwic29ydCIsIl9zdGF0cyIsImxhc3RTdGF0aWNQcmVwYXJlRnVsbFRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZVNlYXJjaFRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZVdyaXRlVGltZSIsImxhc3RTdGF0aWNQcmVwYXJlVHJpQWFiYlRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZUNvbWJpbmVUaW1lIiwicmV2ZXJ0IiwicHJldlN0YXRpY1NvdXJjZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFjQSxNQUFNQSxVQUFVLEdBQUcsSUFBSUMsY0FBYyxFQUFFLENBQUE7QUFFdkMsTUFBTUMsWUFBWSxDQUFDO0FBQ2YsRUFBQSxPQUFPQyxZQUFZQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUNoQyxJQUFBLE9BQU9ELE1BQU0sQ0FBQ0UsR0FBRyxHQUFHRCxNQUFNLENBQUNDLEdBQUcsQ0FBQTtBQUNsQyxHQUFBO0VBRUEsT0FBT0MsT0FBT0EsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLGFBQWEsRUFBRUMsTUFBTSxFQUFFO0FBRWpELElBQUEsTUFBTUMsV0FBVyxHQUFHQyxHQUFHLEVBQUUsQ0FBQTtJQUN6QixJQUFJQyxVQUFVLEdBQUcsQ0FB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
