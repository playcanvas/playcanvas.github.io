/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../math/vec3.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { SEMANTIC_POSITION, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, BUFFER_STATIC, BUFFER_DYNAMIC, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD, SEMANTIC_COLOR, PRIMITIVE_TRIANGLES, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, PRIMITIVE_POINTS, typedArrayIndexFormats, PRIMITIVE_LINES } from '../graphics/constants.js';
import { IndexBuffer } from '../graphics/index-buffer.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';
import { VertexIterator } from '../graphics/vertex-iterator.js';
import { RENDERSTYLE_WIREFRAME, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID } from './constants.js';
import { getApplication } from '../framework/globals.js';

let id = 0;

class GeometryData {
  constructor() {
    this.initDefaults();
  }

  initDefaults() {
    this.recreate = false;
    this.verticesUsage = BUFFER_STATIC;
    this.indicesUsage = BUFFER_STATIC;
    this.maxVertices = 0;
    this.maxIndices = 0;
    this.vertexCount = 0;
    this.indexCount = 0;
    this.vertexStreamsUpdated = false;
    this.indexStreamUpdated = false;
    this.vertexStreamDictionary = {};
    this.indices = null;
  }

  _changeVertexCount(count, semantic) {
    if (!this.vertexCount) {
      this.vertexCount = count;
    } else {
      Debug.assert(this.vertexCount === count, `Vertex stream ${semantic} has ${count} vertices, which does not match already set streams with ${this.vertexCount} vertices.`);
    }
  }

}

GeometryData.DEFAULT_COMPONENTS_POSITION = 3;
GeometryData.DEFAULT_COMPONENTS_NORMAL = 3;
GeometryData.DEFAULT_COMPONENTS_UV = 2;
GeometryData.DEFAULT_COMPONENTS_COLORS = 4;

class GeometryVertexStream {
  constructor(data, componentCount, dataType, dataTypeNormalize) {
    this.data = data;
    this.componentCount = componentCount;
    this.dataType = dataType;
    this.dataTypeNormalize = dataTypeNormalize;
  }

}

class Mesh extends RefCountedObject {
  constructor(graphicsDevice) {
    super();
    this.id = id++;
    this.device = graphicsDevice || getApplication().graphicsDevice;
    this.vertexBuffer = null;
    this.indexBuffer = [null];
    this.primitive = [{
      type: 0,
      base: 0,
      count: 0
    }];
    this.skin = null;
    this._morph = null;
    this._geometryData = null;
    this._aabb = new BoundingBox();
    this.boneAabb = null;
  }

  set morph(morph) {
    if (morph !== this._morph) {
      if (this._morph) {
        this._morph.decRefCount();
      }

      this._morph = morph;

      if (morph) {
        morph.incRefCount();
      }
    }
  }

  get morph() {
    return this._morph;
  }

  set aabb(aabb) {
    this._aabb = aabb;
  }

  get aabb() {
    return this._aabb;
  }

  destroy() {
    const morph = this.morph;

    if (morph) {
      this.morph = null;

      if (morph.refCount < 1) {
        morph.destroy();
      }
    }

    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }

    for (let j = 0; j < this.indexBuffer.length; j++) {
      this._destroyIndexBuffer(j);
    }

    this.indexBuffer.length = 0;
    this._geometryData = null;
  }

  _destroyIndexBuffer(index) {
    if (this.indexBuffer[index]) {
      this.indexBuffer[index].destroy();
      this.indexBuffer[index] = null;
    }
  }

  _initBoneAabbs(morphTargets) {
    this.boneAabb = [];
    this.boneUsed = [];
    let x, y, z;
    let bMax, bMin;
    const boneMin = [];
    const boneMax = [];
    const boneUsed = this.boneUsed;
    const numBones = this.skin.boneNames.length;
    let maxMorphX, maxMorphY, maxMorphZ;

    for (let i = 0; i < numBones; i++) {
      boneMin[i] = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      boneMax[i] = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    }

    const iterator = new VertexIterator(this.vertexBuffer);
    const posElement = iterator.element[SEMANTIC_POSITION];
    const weightsElement = iterator.element[SEMANTIC_BLENDWEIGHT];
    const indicesElement = iterator.element[SEMANTIC_BLENDINDICES];
    const numVerts = this.vertexBuffer.numVertices;

    for (let j = 0; j < numVerts; j++) {
      for (let k = 0; k < 4; k++) {
        const boneWeight = weightsElement.array[weightsElement.index + k];

        if (boneWeight > 0) {
          const boneIndex = indicesElement.array[indicesElement.index + k];
          boneUsed[boneIndex] = true;
          x = posElement.array[posElement.index];
          y = posElement.array[posElement.index + 1];
          z = posElement.array[posElement.index + 2];
          bMax = boneMax[boneIndex];
          bMin = boneMin[boneIndex];
          if (bMin.x > x) bMin.x = x;
          if (bMin.y > y) bMin.y = y;
          if (bMin.z > z) bMin.z = z;
          if (bMax.x < x) bMax.x = x;
          if (bMax.y < y) bMax.y = y;
          if (bMax.z < z) bMax.z = z;

          if (morphTargets) {
            let minMorphX = maxMorphX = x;
            let minMorphY = maxMorphY = y;
            let minMorphZ = maxMorphZ = z;

            for (let l = 0; l < morphTargets.length; l++) {
              const target = morphTargets[l];
              const dx = target.deltaPositions[j * 3];
              const dy = target.deltaPositions[j * 3 + 1];
              const dz = target.deltaPositions[j * 3 + 2];

              if (dx < 0) {
                minMorphX += dx;
              } else {
                maxMorphX += dx;
              }

              if (dy < 0) {
                minMorphY += dy;
              } else {
                maxMorphY += dy;
              }

              if (dz < 0) {
                minMorphZ += dz;
              } else {
                maxMorphZ += dz;
              }
            }

            if (bMin.x > minMorphX) bMin.x = minMorphX;
            if (bMin.y > minMorphY) bMin.y = minMorphY;
            if (bMin.z > minMorphZ) bMin.z = minMorphZ;
            if (bMax.x < maxMorphX) bMax.x = maxMorphX;
            if (bMax.y < maxMorphY) bMax.y = maxMorphY;
            if (bMax.z < maxMorphZ) bMax.z = maxMorphZ;
          }
        }
      }

      iterator.next();
    }

    const positionElement = this.vertexBuffer.getFormat().elements.find(e => e.name === SEMANTIC_POSITION);

    if (positionElement && positionElement.normalize) {
      const func = (() => {
        switch (positionElement.dataType) {
          case TYPE_INT8:
            return x => Math.max(x / 127.0, -1.0);

          case TYPE_UINT8:
            return x => x / 255.0;

          case TYPE_INT16:
            return x => Math.max(x / 32767.0, -1.0);

          case TYPE_UINT16:
            return x => x / 65535.0;

          default:
            return x => x;
        }
      })();

      for (let i = 0; i < numBones; i++) {
        if (boneUsed[i]) {
          const min = boneMin[i];
          const max = boneMax[i];
          min.set(func(min.x), func(min.y), func(min.z));
          max.set(func(max.x), func(max.y), func(max.z));
        }
      }
    }

    for (let i = 0; i < numBones; i++) {
      const aabb = new BoundingBox();
      aabb.setMinMax(boneMin[i], boneMax[i]);
      this.boneAabb.push(aabb);
    }
  }

  _initGeometryData() {
    if (!this._geometryData) {
      this._geometryData = new GeometryData();

      if (this.vertexBuffer) {
        this._geometryData.vertexCount = this.vertexBuffer.numVertices;
        this._geometryData.maxVertices = this.vertexBuffer.numVertices;
      }

      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        this._geometryData.indexCount = this.indexBuffer[0].numIndices;
        this._geometryData.maxIndices = this.indexBuffer[0].numIndices;
      }
    }
  }

  clear(verticesDynamic, indicesDynamic, maxVertices = 0, maxIndices = 0) {
    this._initGeometryData();

    this._geometryData.initDefaults();

    this._geometryData.recreate = true;
    this._geometryData.maxVertices = maxVertices;
    this._geometryData.maxIndices = maxIndices;
    this._geometryData.verticesUsage = verticesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
    this._geometryData.indicesUsage = indicesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
  }

  setVertexStream(semantic, data, componentCount, numVertices, dataType = TYPE_FLOAT32, dataTypeNormalize = false) {
    this._initGeometryData();

    const vertexCount = numVertices || data.length / componentCount;

    this._geometryData._changeVertexCount(vertexCount, semantic);

    this._geometryData.vertexStreamsUpdated = true;
    this._geometryData.vertexStreamDictionary[semantic] = new GeometryVertexStream(data, componentCount, dataType, dataTypeNormalize);
  }

  getVertexStream(semantic, data) {
    let count = 0;
    let done = false;

    if (this._geometryData) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];

      if (stream) {
        done = true;
        count = this._geometryData.vertexCount;

        if (ArrayBuffer.isView(data)) {
          data.set(stream.data);
        } else {
          data.length = 0;
          data.push(stream.data);
        }
      }
    }

    if (!done) {
      if (this.vertexBuffer) {
        const iterator = new VertexIterator(this.vertexBuffer);
        count = iterator.readData(semantic, data);
      }
    }

    return count;
  }

  setPositions(positions, componentCount = GeometryData.DEFAULT_COMPONENTS_POSITION, numVertices) {
    this.setVertexStream(SEMANTIC_POSITION, positions, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  setNormals(normals, componentCount = GeometryData.DEFAULT_COMPONENTS_NORMAL, numVertices) {
    this.setVertexStream(SEMANTIC_NORMAL, normals, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  setUvs(channel, uvs, componentCount = GeometryData.DEFAULT_COMPONENTS_UV, numVertices) {
    this.setVertexStream(SEMANTIC_TEXCOORD + channel, uvs, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  setColors(colors, componentCount = GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices) {
    this.setVertexStream(SEMANTIC_COLOR, colors, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  setColors32(colors, numVertices) {
    this.setVertexStream(SEMANTIC_COLOR, colors, GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices, TYPE_UINT8, true);
  }

  setIndices(indices, numIndices) {
    this._initGeometryData();

    this._geometryData.indexStreamUpdated = true;
    this._geometryData.indices = indices;
    this._geometryData.indexCount = numIndices || indices.length;
  }

  getPositions(positions) {
    return this.getVertexStream(SEMANTIC_POSITION, positions);
  }

  getNormals(normals) {
    return this.getVertexStream(SEMANTIC_NORMAL, normals);
  }

  getUvs(channel, uvs) {
    return this.getVertexStream(SEMANTIC_TEXCOORD + channel, uvs);
  }

  getColors(colors) {
    return this.getVertexStream(SEMANTIC_COLOR, colors);
  }

  getIndices(indices) {
    let count = 0;

    if (this._geometryData && this._geometryData.indices) {
      const streamIndices = this._geometryData.indices;
      count = this._geometryData.indexCount;

      if (ArrayBuffer.isView(indices)) {
        indices.set(streamIndices);
      } else {
        indices.length = 0;
        indices.push(streamIndices);
      }
    } else {
      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        const indexBuffer = this.indexBuffer[0];
        count = indexBuffer.readData(indices);
      }
    }

    return count;
  }

  update(primitiveType = PRIMITIVE_TRIANGLES, updateBoundingBox = true) {
    if (this._geometryData) {
      if (updateBoundingBox) {
        const stream = this._geometryData.vertexStreamDictionary[SEMANTIC_POSITION];

        if (stream) {
          if (stream.componentCount === 3) {
            this._aabb.compute(stream.data, this._geometryData.vertexCount);
          }
        }
      }

      let destroyVB = this._geometryData.recreate;

      if (this._geometryData.vertexCount > this._geometryData.maxVertices) {
        destroyVB = true;
        this._geometryData.maxVertices = this._geometryData.vertexCount;
      }

      if (destroyVB) {
        if (this.vertexBuffer) {
          this.vertexBuffer.destroy();
          this.vertexBuffer = null;
        }
      }

      let destroyIB = this._geometryData.recreate;

      if (this._geometryData.indexCount > this._geometryData.maxIndices) {
        destroyIB = true;
        this._geometryData.maxIndices = this._geometryData.indexCount;
      }

      if (destroyIB) {
        if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
          this.indexBuffer[0].destroy();
          this.indexBuffer[0] = null;
        }
      }

      if (this._geometryData.vertexStreamsUpdated) {
        this._updateVertexBuffer();
      }

      if (this._geometryData.indexStreamUpdated) {
        this._updateIndexBuffer();
      }

      this.primitive[0].type = primitiveType;

      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        if (this._geometryData.indexStreamUpdated) {
          this.primitive[0].count = this._geometryData.indexCount;
          this.primitive[0].indexed = true;
        }
      } else {
        if (this._geometryData.vertexStreamsUpdated) {
          this.primitive[0].count = this._geometryData.vertexCount;
          this.primitive[0].indexed = false;
        }
      }

      this._geometryData.vertexCount = 0;
      this._geometryData.indexCount = 0;
      this._geometryData.vertexStreamsUpdated = false;
      this._geometryData.indexStreamUpdated = false;
      this._geometryData.recreate = false;
      this.updateRenderStates();
    }
  }

  _buildVertexFormat(vertexCount) {
    const vertexDesc = [];

    for (const semantic in this._geometryData.vertexStreamDictionary) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];
      vertexDesc.push({
        semantic: semantic,
        components: stream.componentCount,
        type: stream.dataType,
        normalize: stream.dataTypeNormalize
      });
    }

    return new VertexFormat(this.device, vertexDesc, vertexCount);
  }

  _updateVertexBuffer() {
    if (!this.vertexBuffer) {
      const allocateVertexCount = this._geometryData.maxVertices;

      const format = this._buildVertexFormat(allocateVertexCount);

      this.vertexBuffer = new VertexBuffer(this.device, format, allocateVertexCount, this._geometryData.verticesUsage);
    }

    const iterator = new VertexIterator(this.vertexBuffer);
    const numVertices = this._geometryData.vertexCount;

    for (const semantic in this._geometryData.vertexStreamDictionary) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];
      iterator.writeData(semantic, stream.data, numVertices);
      delete this._geometryData.vertexStreamDictionary[semantic];
    }

    iterator.end();
  }

  _updateIndexBuffer() {
    if (this.indexBuffer.length <= 0 || !this.indexBuffer[0]) {
      const createFormat = this._geometryData.maxVertices > 0xffff ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
      this.indexBuffer[0] = new IndexBuffer(this.device, createFormat, this._geometryData.maxIndices, this._geometryData.indicesUsage);
    }

    const srcIndices = this._geometryData.indices;

    if (srcIndices) {
      const indexBuffer = this.indexBuffer[0];
      indexBuffer.writeData(srcIndices, this._geometryData.indexCount);
      this._geometryData.indices = null;
    }
  }

  prepareRenderState(renderStyle) {
    if (renderStyle === RENDERSTYLE_WIREFRAME) {
      this.generateWireframe();
    } else if (renderStyle === RENDERSTYLE_POINTS) {
      this.primitive[RENDERSTYLE_POINTS] = {
        type: PRIMITIVE_POINTS,
        base: 0,
        count: this.vertexBuffer ? this.vertexBuffer.numVertices : 0,
        indexed: false
      };
    }
  }

  updateRenderStates() {
    if (this.primitive[RENDERSTYLE_POINTS]) {
      this.prepareRenderState(RENDERSTYLE_POINTS);
    }

    if (this.primitive[RENDERSTYLE_WIREFRAME]) {
      this.prepareRenderState(RENDERSTYLE_WIREFRAME);
    }
  }

  generateWireframe() {
    this._destroyIndexBuffer(RENDERSTYLE_WIREFRAME);

    const lines = [];
    let format;

    if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
      const offsets = [[0, 1], [1, 2], [2, 0]];
      const base = this.primitive[RENDERSTYLE_SOLID].base;
      const count = this.primitive[RENDERSTYLE_SOLID].count;
      const indexBuffer = this.indexBuffer[RENDERSTYLE_SOLID];
      const srcIndices = new typedArrayIndexFormats[indexBuffer.format](indexBuffer.storage);
      const uniqueLineIndices = {};

      for (let j = base; j < base + count; j += 3) {
        for (let k = 0; k < 3; k++) {
          const i1 = srcIndices[j + offsets[k][0]];
          const i2 = srcIndices[j + offsets[k][1]];
          const line = i1 > i2 ? i2 << 16 | i1 : i1 << 16 | i2;

          if (uniqueLineIndices[line] === undefined) {
            uniqueLineIndices[line] = 0;
            lines.push(i1, i2);
          }
        }
      }

      format = indexBuffer.format;
    } else {
      for (let i = 0; i < this.vertexBuffer.numVertices; i += 3) {
        lines.push(i, i + 1, i + 1, i + 2, i + 2, i);
      }

      format = lines.length > 65535 ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
    }

    const wireBuffer = new IndexBuffer(this.vertexBuffer.device, format, lines.length);
    const dstIndices = new typedArrayIndexFormats[wireBuffer.format](wireBuffer.storage);
    dstIndices.set(lines);
    wireBuffer.unlock();
    this.primitive[RENDERSTYLE_WIREFRAME] = {
      type: PRIMITIVE_LINES,
      base: 0,
      count: lines.length,
      indexed: true
    };
    this.indexBuffer[RENDERSTYLE_WIREFRAME] = wireBuffer;
  }

}

export { Mesh };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFJlZkNvdW50ZWRPYmplY3QgfSBmcm9tICcuLi9jb3JlL3JlZi1jb3VudGVkLW9iamVjdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEJVRkZFUl9EWU5BTUlDLCBCVUZGRVJfU1RBVElDLFxuICAgIElOREVYRk9STUFUX1VJTlQxNiwgSU5ERVhGT1JNQVRfVUlOVDMyLFxuICAgIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1BPSU5UUyxcbiAgICBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfVEVYQ09PUkQsXG4gICAgVFlQRV9GTE9BVDMyLCBUWVBFX1VJTlQ4LCBUWVBFX0lOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LFxuICAgIHR5cGVkQXJyYXlJbmRleEZvcm1hdHNcbn0gZnJvbSAnLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhJdGVyYXRvciB9IGZyb20gJy4uL2dyYXBoaWNzL3ZlcnRleC1pdGVyYXRvci5qcyc7XG5cbmltcG9ydCB7IFJFTkRFUlNUWUxFX1NPTElELCBSRU5ERVJTVFlMRV9XSVJFRlJBTUUsIFJFTkRFUlNUWUxFX1BPSU5UUyB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgZ2V0QXBwbGljYXRpb24gfSBmcm9tICcuLi9mcmFtZXdvcmsvZ2xvYmFscy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL21vcnBoLmpzJykuTW9ycGh9IE1vcnBoICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9za2luLmpzJykuU2tpbn0gU2tpbiAqL1xuXG5sZXQgaWQgPSAwO1xuXG4vLyBIZWxwZXIgY2xhc3MgdXNlZCB0byBzdG9yZSB2ZXJ0ZXggLyBpbmRleCBkYXRhIHN0cmVhbXMgYW5kIHJlbGF0ZWQgcHJvcGVydGllcywgd2hlbiBtZXNoIGlzIHByb2dyYW1tYXRpY2FsbHkgbW9kaWZpZWRcbmNsYXNzIEdlb21ldHJ5RGF0YSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuaW5pdERlZmF1bHRzKCk7XG4gICAgfVxuXG4gICAgaW5pdERlZmF1bHRzKCkge1xuXG4gICAgICAgIC8vIGJ5IGRlZmF1bHQsIGV4aXN0aW5nIG1lc2ggaXMgdXBkYXRlZCBidXQgbm90IHJlY3JlYXRlZCwgdW50aWwgLmNsZWFyIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICAgICAgICB0aGlzLnJlY3JlYXRlID0gZmFsc2U7XG5cbiAgICAgICAgLy8gdXNhZ2UgZm9yIGJ1ZmZlcnNcbiAgICAgICAgdGhpcy52ZXJ0aWNlc1VzYWdlID0gQlVGRkVSX1NUQVRJQztcbiAgICAgICAgdGhpcy5pbmRpY2VzVXNhZ2UgPSBCVUZGRVJfU1RBVElDO1xuXG4gICAgICAgIC8vIHZlcnRleCBhbmQgaW5kZXggYnVmZmVyIGFsbG9jYXRlZCBzaXplIChtYXhpbXVtIG51bWJlciBvZiB2ZXJ0aWNlcyAvIGluZGljZXMgdGhhdCBjYW4gYmUgc3RvcmVkIGluIHRob3NlIHdpdGhvdXQgdGhlIG5lZWQgdG8gcmVhbGxvY2F0ZSB0aGVtKVxuICAgICAgICB0aGlzLm1heFZlcnRpY2VzID0gMDtcbiAgICAgICAgdGhpcy5tYXhJbmRpY2VzID0gMDtcblxuICAgICAgICAvLyBjdXJyZW50IG51bWJlciBvZiB2ZXJ0aWNlcyBhbmQgaW5kaWNlcyBpbiB1c2VcbiAgICAgICAgdGhpcy52ZXJ0ZXhDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuaW5kZXhDb3VudCA9IDA7XG5cbiAgICAgICAgLy8gZGlydHkgZmxhZ3MgcmVwcmVzZW50aW5nIHdoYXQgbmVlZHMgYmUgdXBkYXRlZFxuICAgICAgICB0aGlzLnZlcnRleFN0cmVhbXNVcGRhdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuaW5kZXhTdHJlYW1VcGRhdGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gZGljdGlvbmFyeSBvZiB2ZXJ0ZXggc3RyZWFtcyB0aGF0IG5lZWQgdG8gYmUgdXBkYXRlZCwgbG9va2VkIHVwIGJ5IHNlbWFudGljXG4gICAgICAgIHRoaXMudmVydGV4U3RyZWFtRGljdGlvbmFyeSA9IHt9O1xuXG4gICAgICAgIC8vIGluZGV4IHN0cmVhbSBkYXRhIHRoYXQgbmVlZHMgdG8gYmUgdXBkYXRlZFxuICAgICAgICB0aGlzLmluZGljZXMgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIGNhbGxlZCB3aGVuIHZlcnRleCBzdHJlYW0gaXMgcmVxdWVzdGVkIHRvIGJlIHVwZGF0ZWQsIGFuZCB2YWxpZGF0ZXMgLyB1cGRhdGVzIGN1cnJlbnRseSB1c2VkIHZlcnRleCBjb3VudFxuICAgIF9jaGFuZ2VWZXJ0ZXhDb3VudChjb3VudCwgc2VtYW50aWMpIHtcblxuICAgICAgICAvLyB1cGRhdGUgdmVydGV4IGNvdW50IGFuZCB2YWxpZGF0ZSBpdCB3aXRoIGV4aXN0aW5nIHN0cmVhbXNcbiAgICAgICAgaWYgKCF0aGlzLnZlcnRleENvdW50KSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleENvdW50ID0gY291bnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy52ZXJ0ZXhDb3VudCA9PT0gY291bnQsIGBWZXJ0ZXggc3RyZWFtICR7c2VtYW50aWN9IGhhcyAke2NvdW50fSB2ZXJ0aWNlcywgd2hpY2ggZG9lcyBub3QgbWF0Y2ggYWxyZWFkeSBzZXQgc3RyZWFtcyB3aXRoICR7dGhpcy52ZXJ0ZXhDb3VudH0gdmVydGljZXMuYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBkZWZhdWx0IGNvdW50cyBmb3IgdmVydGV4IGNvbXBvbmVudHNcbiAgICBzdGF0aWMgREVGQVVMVF9DT01QT05FTlRTX1BPU0lUSU9OID0gMztcblxuICAgIHN0YXRpYyBERUZBVUxUX0NPTVBPTkVOVFNfTk9STUFMID0gMztcblxuICAgIHN0YXRpYyBERUZBVUxUX0NPTVBPTkVOVFNfVVYgPSAyO1xuXG4gICAgc3RhdGljIERFRkFVTFRfQ09NUE9ORU5UU19DT0xPUlMgPSA0O1xufVxuXG4vLyBjbGFzcyBzdG9yaW5nIGluZm9ybWF0aW9uIGFib3V0IHNpbmdsZSB2ZXJ0ZXggZGF0YSBzdHJlYW1cbmNsYXNzIEdlb21ldHJ5VmVydGV4U3RyZWFtIHtcbiAgICBjb25zdHJ1Y3RvcihkYXRhLCBjb21wb25lbnRDb3VudCwgZGF0YVR5cGUsIGRhdGFUeXBlTm9ybWFsaXplKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7ICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJyYXkgb2YgZGF0YVxuICAgICAgICB0aGlzLmNvbXBvbmVudENvdW50ID0gY29tcG9uZW50Q291bnQ7ICAgICAgIC8vIG51bWJlciBvZiBjb21wb25lbnRzXG4gICAgICAgIHRoaXMuZGF0YVR5cGUgPSBkYXRhVHlwZTsgICAgICAgICAgICAgICAgICAgLy8gZm9ybWF0IG9mIGVsZW1lbnRzIChwYy5UWVBFX0ZMT0FUMzIgLi4pXG4gICAgICAgIHRoaXMuZGF0YVR5cGVOb3JtYWxpemUgPSBkYXRhVHlwZU5vcm1hbGl6ZTsgLy8gbm9ybWFsaXplIGVsZW1lbnQgKGRpdmlkZSBieSAyNTUpXG4gICAgfVxufVxuXG4vKipcbiAqIEEgZ3JhcGhpY2FsIHByaW1pdGl2ZS4gVGhlIG1lc2ggaXMgZGVmaW5lZCBieSBhIHtAbGluayBWZXJ0ZXhCdWZmZXJ9IGFuZCBhbiBvcHRpb25hbFxuICoge0BsaW5rIEluZGV4QnVmZmVyfS4gSXQgYWxzbyBjb250YWlucyBhIHByaW1pdGl2ZSBkZWZpbml0aW9uIHdoaWNoIGNvbnRyb2xzIHRoZSB0eXBlIG9mIHRoZVxuICogcHJpbWl0aXZlIGFuZCB0aGUgcG9ydGlvbiBvZiB0aGUgdmVydGV4IG9yIGluZGV4IGJ1ZmZlciB0byB1c2UuXG4gKlxuICogIyMgTWVzaCBBUElzXG4gKiBUaGVyZSBhcmUgdHdvIHdheXMgYSBtZXNoIGNhbiBiZSBnZW5lcmF0ZWQgb3IgdXBkYXRlZC5cbiAqXG4gKiAjIyMgU2ltcGxlIE1lc2ggQVBJXG4gKiB7QGxpbmsgTWVzaH0gY2xhc3MgcHJvdmlkZXMgaW50ZXJmYWNlcyBzdWNoIGFzIHtAbGluayBNZXNoI3NldFBvc2l0aW9uc30gYW5kIHtAbGluayBNZXNoI3NldFV2c31cbiAqIHRoYXQgcHJvdmlkZSBhIHNpbXBsZSB3YXkgdG8gcHJvdmlkZSB2ZXJ0ZXggYW5kIGluZGV4IGRhdGEgZm9yIHRoZSBNZXNoLCBhbmQgaGlkaW5nIHRoZVxuICogY29tcGxleGl0eSBvZiBjcmVhdGluZyB0aGUge0BsaW5rIFZlcnRleEZvcm1hdH0uIFRoaXMgaXMgdGhlIHJlY29tbWVuZGVkIGludGVyZmFjZSB0byB1c2UuXG4gKlxuICogQSBzaW1wbGUgZXhhbXBsZSB3aGljaCBjcmVhdGVzIGEgTWVzaCB3aXRoIDMgdmVydGljZXMsIGNvbnRhaW5pbmcgcG9zaXRpb24gY29vcmRpbmF0ZXMgb25seSwgdG9cbiAqIGZvcm0gYSBzaW5nbGUgdHJpYW5nbGUuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIG1lc2ggPSBuZXcgcGMuTWVzaChkZXZpY2UpO1xuICogdmFyIHBvc2l0aW9ucyA9IFtcbiAqICAgICAwLCAwLCAwLCAvLyBwb3MgMFxuICogICAgIDEsIDAsIDAsIC8vIHBvcyAxXG4gKiAgICAgMSwgMSwgMCAgLy8gcG9zIDJcbiAqIF07XG4gKiBtZXNoLnNldFBvc2l0aW9ucyhwb3NpdGlvbnMpO1xuICogbWVzaC51cGRhdGUoKTtcbiAqIGBgYFxuICpcbiAqIEFuIGV4YW1wbGUgd2hpY2ggY3JlYXRlcyBhIE1lc2ggd2l0aCA0IHZlcnRpY2VzLCBjb250YWluaW5nIHBvc2l0aW9uIGFuZCB1diBjb29yZGluYXRlcyBpblxuICogY2hhbm5lbCAwLCBhbmQgYW4gaW5kZXggYnVmZmVyIHRvIGZvcm0gdHdvIHRyaWFuZ2xlcy4gRmxvYXQzMkFycmF5IGlzIHVzZWQgZm9yIHBvc2l0aW9ucyBhbmQgdXZzLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBtZXNoID0gbmV3IHBjLk1lc2goZGV2aWNlKTtcbiAqIHZhciBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KFtcbiAqICAgICAwLCAwLCAwLCAvLyBwb3MgMFxuICogICAgIDEsIDAsIDAsIC8vIHBvcyAxXG4gKiAgICAgMSwgMSwgMCwgLy8gcG9zIDJcbiAqICAgICAwLCAxLCAwICAvLyBwb3MgM1xuICogXSk7XG4gKiB2YXIgdXZzID0gbmV3IEZsb2F0MzJBcnJheShbXG4gKiAgICAgMCwgMCwgLy8gdXYgMFxuICogICAgIDEsIDAsIC8vIHV2IDFcbiAqICAgICAxLCAxLCAvLyB1diAyXG4gKiAgICAgMCwgMSAgLy8gdXYgM1xuICogXSk7XG4gKiB2YXIgaW5kaWNlcyA9IFtcbiAqICAgICAwLCAxLCAyLCAvLyB0cmlhbmdsZSAwXG4gKiAgICAgMCwgMiwgMyAgLy8gdHJpYW5nbGUgMVxuICogXTtcbiAqIG1lc2guc2V0UG9zaXRpb25zKHBvc2l0aW9ucyk7XG4gKiBtZXNoLnNldFV2cygwLCB1dnMpO1xuICogbWVzaC5zZXRJbmRpY2VzKGluZGljZXMpO1xuICogbWVzaC51cGRhdGUoKTtcbiAqIGBgYFxuICpcbiAqIFRoaXMgZXhhbXBsZSBkZW1vbnN0cmF0ZXMgdGhhdCB2ZXJ0ZXggYXR0cmlidXRlcyBzdWNoIGFzIHBvc2l0aW9uIGFuZCBub3JtYWxzLCBhbmQgYWxzbyBpbmRpY2VzXG4gKiBjYW4gYmUgcHJvdmlkZWQgdXNpbmcgQXJyYXlzIChbXSkgYW5kIGFsc28gVHlwZWQgQXJyYXlzIChGbG9hdDMyQXJyYXkgYW5kIHNpbWlsYXIpLiBOb3RlIHRoYXRcbiAqIHR5cGVkIGFycmF5cyBoYXZlIGhpZ2hlciBwZXJmb3JtYW5jZSwgYW5kIGFyZSBnZW5lcmFsbHkgcmVjb21tZW5kZWQgZm9yIHBlci1mcmFtZSBvcGVyYXRpb25zIG9yXG4gKiBsYXJnZXIgbWVzaGVzLCBidXQgdGhlaXIgY29uc3RydWN0aW9uIHVzaW5nIG5ldyBvcGVyYXRvciBpcyBjb3N0bHkgb3BlcmF0aW9uLiBJZiB5b3Ugb25seSBuZWVkXG4gKiB0byBvcGVyYXRlIG9uIGEgc21hbGwgbnVtYmVyIG9mIHZlcnRpY2VzIG9yIGluZGljZXMsIGNvbnNpZGVyIHVzaW5nIEFycmF5cyB0byBhdm9pZCB0aGUgb3ZlcmhlYWRcbiAqIGFzc29jaWF0ZWQgd2l0aCBhbGxvY2F0aW5nIFR5cGVkIEFycmF5cy5cbiAqXG4gKiBGb2xsb3cgdGhlc2UgbGlua3MgZm9yIG1vcmUgY29tcGxleCBleGFtcGxlcyBzaG93aW5nIHRoZSBmdW5jdGlvbmFsaXR5LlxuICpcbiAqIC0ge0BsaW5rIGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jZ3JhcGhpY3MvbWVzaC1kZWNhbHN9XG4gKiAtIHtAbGluayBodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI2dyYXBoaWNzL21lc2gtZGVmb3JtYXRpb259XG4gKiAtIHtAbGluayBodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI2dyYXBoaWNzL21lc2gtZ2VuZXJhdGlvbn1cbiAqIC0ge0BsaW5rIGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jZ3JhcGhpY3MvcG9pbnQtY2xvdWQtc2ltdWxhdGlvbn1cbiAqXG4gKiAjIyMgVXBkYXRlIFZlcnRleCBhbmQgSW5kZXggYnVmZmVyc1xuICogVGhpcyBhbGxvd3MgZ3JlYXRlciBmbGV4aWJpbGl0eSwgYnV0IGlzIG1vcmUgY29tcGxleCB0byB1c2UuIEl0IGFsbG93cyBtb3JlIGFkdmFuY2VkIHNldHVwcywgZm9yXG4gKiBleGFtcGxlIHNoYXJpbmcgYSBWZXJ0ZXggb3IgSW5kZXggQnVmZmVyIGJldHdlZW4gbXVsdGlwbGUgbWVzaGVzLiBTZWUge0BsaW5rIFZlcnRleEJ1ZmZlcn0sXG4gKiB7QGxpbmsgSW5kZXhCdWZmZXJ9IGFuZCB7QGxpbmsgVmVydGV4Rm9ybWF0fSBmb3IgZGV0YWlscy5cbiAqL1xuY2xhc3MgTWVzaCBleHRlbmRzIFJlZkNvdW50ZWRPYmplY3Qge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBNZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gW2dyYXBoaWNzRGV2aWNlXSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhpcyBtZXNoLiBJZlxuICAgICAqIGl0IGlzIG5vdCBwcm92aWRlZCwgYSBkZXZpY2UgaXMgb2J0YWluZWQgZnJvbSB0aGUge0BsaW5rIEFwcGxpY2F0aW9ufS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmlkID0gaWQrKztcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZSB8fCBnZXRBcHBsaWNhdGlvbigpLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdmVydGV4IGJ1ZmZlciBob2xkaW5nIHRoZSB2ZXJ0ZXggZGF0YSBvZiB0aGUgbWVzaC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlcnRleEJ1ZmZlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQW4gYXJyYXkgb2YgaW5kZXggYnVmZmVycy4gRm9yIHVuaW5kZXhlZCBtZXNoZXMsIHRoaXMgYXJyYXkgY2FuIGJlIGVtcHR5LiBUaGUgZmlyc3RcbiAgICAgICAgICogaW5kZXggYnVmZmVyIGluIHRoZSBhcnJheSBpcyB1c2VkIGJ5IHtAbGluayBNZXNoSW5zdGFuY2V9cyB3aXRoIGEgcmVuZGVyU3R5bGUgcHJvcGVydHlcbiAgICAgICAgICogc2V0IHRvIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH0uIFRoZSBzZWNvbmQgaW5kZXggYnVmZmVyIGluIHRoZSBhcnJheSBpcyB1c2VkIGlmXG4gICAgICAgICAqIHJlbmRlclN0eWxlIGlzIHNldCB0byB7QGxpbmsgUkVOREVSU1RZTEVfV0lSRUZSQU1FfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0luZGV4QnVmZmVyW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gW251bGxdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSBvZiBwcmltaXRpdmUgb2JqZWN0cyBkZWZpbmluZyBob3cgdmVydGV4IChhbmQgaW5kZXgpIGRhdGEgaW4gdGhlIG1lc2ggc2hvdWxkIGJlXG4gICAgICAgICAqIGludGVycHJldGVkIGJ5IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIC0gYHR5cGVgIGlzIHRoZSB0eXBlIG9mIHByaW1pdGl2ZSB0byByZW5kZXIuIENhbiBiZTpcbiAgICAgICAgICpcbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfUE9JTlRTfVxuICAgICAgICAgKiAgIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU31cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfTElORUxPT1B9XG4gICAgICAgICAqICAgLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTVFJJUH1cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfVFJJQU5HTEVTfVxuICAgICAgICAgKiAgIC0ge0BsaW5rIFBSSU1JVElWRV9UUklTVFJJUH1cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfVFJJRkFOfVxuICAgICAgICAgKlxuICAgICAgICAgKiAtIGBiYXNlYCBpcyB0aGUgb2Zmc2V0IG9mIHRoZSBmaXJzdCBpbmRleCBvciB2ZXJ0ZXggdG8gZGlzcGF0Y2ggaW4gdGhlIGRyYXcgY2FsbC5cbiAgICAgICAgICogLSBgY291bnRgIGlzIHRoZSBudW1iZXIgb2YgaW5kaWNlcyBvciB2ZXJ0aWNlcyB0byBkaXNwYXRjaCBpbiB0aGUgZHJhdyBjYWxsLlxuICAgICAgICAgKiAtIGBpbmRleGVkYCBzcGVjaWZpZXMgd2hldGhlciB0byBpbnRlcnByZXQgdGhlIHByaW1pdGl2ZSBhcyBpbmRleGVkLCB0aGVyZWJ5IHVzaW5nIHRoZVxuICAgICAgICAgKiBjdXJyZW50bHkgc2V0IGluZGV4IGJ1ZmZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0FycmF5Ljx7dHlwZTogbnVtYmVyLCBiYXNlOiBudW1iZXIsIGNvdW50OiBudW1iZXIsIGluZGV4ZWQ6IGJvb2xlYW58dW5kZWZpbmVkfT59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnByaW1pdGl2ZSA9IFt7XG4gICAgICAgICAgICB0eXBlOiAwLFxuICAgICAgICAgICAgYmFzZTogMCxcbiAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgIH1dO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2tpbiBkYXRhIChpZiBhbnkpIHRoYXQgZHJpdmVzIHNraW5uZWQgbWVzaCBhbmltYXRpb25zIGZvciB0aGlzIG1lc2guXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTa2lufG51bGx9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNraW4gPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX21vcnBoID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhID0gbnVsbDtcblxuICAgICAgICAvLyBBQUJCIGZvciBvYmplY3Qgc3BhY2UgbWVzaCB2ZXJ0aWNlc1xuICAgICAgICB0aGlzLl9hYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgLy8gQXJyYXkgb2Ygb2JqZWN0IHNwYWNlIEFBQkJzIG9mIHZlcnRpY2VzIGFmZmVjdGVkIGJ5IGVhY2ggYm9uZVxuICAgICAgICB0aGlzLmJvbmVBYWJiID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbW9ycGggZGF0YSAoaWYgYW55KSB0aGF0IGRyaXZlcyBtb3JwaCB0YXJnZXQgYW5pbWF0aW9ucyBmb3IgdGhpcyBtZXNoLlxuICAgICAqXG4gICAgICogQHR5cGUge01vcnBofG51bGx9XG4gICAgICovXG4gICAgc2V0IG1vcnBoKG1vcnBoKSB7XG5cbiAgICAgICAgaWYgKG1vcnBoICE9PSB0aGlzLl9tb3JwaCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21vcnBoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9ycGguZGVjUmVmQ291bnQoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbW9ycGggPSBtb3JwaDtcblxuICAgICAgICAgICAgaWYgKG1vcnBoKSB7XG4gICAgICAgICAgICAgICAgbW9ycGguaW5jUmVmQ291bnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtb3JwaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vcnBoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94IGZvciB0aGUgb2JqZWN0IHNwYWNlIHZlcnRpY2VzIG9mIHRoaXMgbWVzaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCb3VuZGluZ0JveH1cbiAgICAgKi9cbiAgICBzZXQgYWFiYihhYWJiKSB7XG4gICAgICAgIHRoaXMuX2FhYmIgPSBhYWJiO1xuICAgIH1cblxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB7QGxpbmsgVmVydGV4QnVmZmVyfSBhbmQge0BsaW5rIEluZGV4QnVmZmVyfSBhc3NvY2lhdGUgd2l0aCB0aGUgbWVzaC4gVGhpcyBpc1xuICAgICAqIG5vcm1hbGx5IGNhbGxlZCBieSB7QGxpbmsgTW9kZWwjZGVzdHJveX0gYW5kIGRvZXMgbm90IG5lZWQgdG8gYmUgY2FsbGVkIG1hbnVhbGx5LlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgY29uc3QgbW9ycGggPSB0aGlzLm1vcnBoO1xuICAgICAgICBpZiAobW9ycGgpIHtcblxuICAgICAgICAgICAgLy8gdGhpcyBkZWNyZWFzZXMgcmVmIGNvdW50IG9uIHRoZSBtb3JwaFxuICAgICAgICAgICAgdGhpcy5tb3JwaCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgbW9ycGhcbiAgICAgICAgICAgIGlmIChtb3JwaC5yZWZDb3VudCA8IDEpIHtcbiAgICAgICAgICAgICAgICBtb3JwaC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5pbmRleEJ1ZmZlci5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveUluZGV4QnVmZmVyKGopO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlci5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIF9kZXN0cm95SW5kZXhCdWZmZXIoaW5kZXgpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXJbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyW2luZGV4XS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyW2luZGV4XSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbml0aWFsaXplcyBsb2NhbCBib3VuZGluZyBib3hlcyBmb3IgZWFjaCBib25lIGJhc2VkIG9uIHZlcnRpY2VzIGFmZmVjdGVkIGJ5IHRoZSBib25lXG4gICAgLy8gaWYgbW9ycGggdGFyZ2V0cyBhcmUgcHJvdmlkZWQsIGl0IGFsc28gYWRqdXN0cyBsb2NhbCBib25lIGJvdW5kaW5nIGJveGVzIGJ5IG1heGltdW0gbW9ycGggZGlzcGxhY2VtZW50XG4gICAgX2luaXRCb25lQWFiYnMobW9ycGhUYXJnZXRzKSB7XG5cbiAgICAgICAgdGhpcy5ib25lQWFiYiA9IFtdO1xuICAgICAgICB0aGlzLmJvbmVVc2VkID0gW107XG4gICAgICAgIGxldCB4LCB5LCB6O1xuICAgICAgICBsZXQgYk1heCwgYk1pbjtcbiAgICAgICAgY29uc3QgYm9uZU1pbiA9IFtdO1xuICAgICAgICBjb25zdCBib25lTWF4ID0gW107XG4gICAgICAgIGNvbnN0IGJvbmVVc2VkID0gdGhpcy5ib25lVXNlZDtcbiAgICAgICAgY29uc3QgbnVtQm9uZXMgPSB0aGlzLnNraW4uYm9uZU5hbWVzLmxlbmd0aDtcbiAgICAgICAgbGV0IG1heE1vcnBoWCwgbWF4TW9ycGhZLCBtYXhNb3JwaFo7XG5cbiAgICAgICAgLy8gc3RhcnQgd2l0aCBlbXB0eSBib25lIGJvdW5kc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUJvbmVzOyBpKyspIHtcbiAgICAgICAgICAgIGJvbmVNaW5baV0gPSBuZXcgVmVjMyhOdW1iZXIuTUFYX1ZBTFVFLCBOdW1iZXIuTUFYX1ZBTFVFLCBOdW1iZXIuTUFYX1ZBTFVFKTtcbiAgICAgICAgICAgIGJvbmVNYXhbaV0gPSBuZXcgVmVjMygtTnVtYmVyLk1BWF9WQUxVRSwgLU51bWJlci5NQVhfVkFMVUUsIC1OdW1iZXIuTUFYX1ZBTFVFKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFjY2VzcyB0byBtZXNoIGZyb20gdmVydGV4IGJ1ZmZlclxuICAgICAgICBjb25zdCBpdGVyYXRvciA9IG5ldyBWZXJ0ZXhJdGVyYXRvcih0aGlzLnZlcnRleEJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IHBvc0VsZW1lbnQgPSBpdGVyYXRvci5lbGVtZW50W1NFTUFOVElDX1BPU0lUSU9OXTtcbiAgICAgICAgY29uc3Qgd2VpZ2h0c0VsZW1lbnQgPSBpdGVyYXRvci5lbGVtZW50W1NFTUFOVElDX0JMRU5EV0VJR0hUXTtcbiAgICAgICAgY29uc3QgaW5kaWNlc0VsZW1lbnQgPSBpdGVyYXRvci5lbGVtZW50W1NFTUFOVElDX0JMRU5ESU5ESUNFU107XG5cbiAgICAgICAgLy8gRmluZCBib25lIEFBQkJzIG9mIGF0dGFjaGVkIHZlcnRpY2VzXG4gICAgICAgIGNvbnN0IG51bVZlcnRzID0gdGhpcy52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtVmVydHM7IGorKykge1xuICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCA0OyBrKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib25lV2VpZ2h0ID0gd2VpZ2h0c0VsZW1lbnQuYXJyYXlbd2VpZ2h0c0VsZW1lbnQuaW5kZXggKyBrXTtcbiAgICAgICAgICAgICAgICBpZiAoYm9uZVdlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm9uZUluZGV4ID0gaW5kaWNlc0VsZW1lbnQuYXJyYXlbaW5kaWNlc0VsZW1lbnQuaW5kZXggKyBrXTtcbiAgICAgICAgICAgICAgICAgICAgYm9uZVVzZWRbYm9uZUluZGV4XSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgeCA9IHBvc0VsZW1lbnQuYXJyYXlbcG9zRWxlbWVudC5pbmRleF07XG4gICAgICAgICAgICAgICAgICAgIHkgPSBwb3NFbGVtZW50LmFycmF5W3Bvc0VsZW1lbnQuaW5kZXggKyAxXTtcbiAgICAgICAgICAgICAgICAgICAgeiA9IHBvc0VsZW1lbnQuYXJyYXlbcG9zRWxlbWVudC5pbmRleCArIDJdO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkanVzdCBib3VuZHMgb2YgYSBib25lIGJ5IHRoZSB2ZXJ0ZXhcbiAgICAgICAgICAgICAgICAgICAgYk1heCA9IGJvbmVNYXhbYm9uZUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgYk1pbiA9IGJvbmVNaW5bYm9uZUluZGV4XTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbi54ID4geCkgYk1pbi54ID0geDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW4ueSA+IHkpIGJNaW4ueSA9IHk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiTWluLnogPiB6KSBiTWluLnogPSB6O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChiTWF4LnggPCB4KSBiTWF4LnggPSB4O1xuICAgICAgICAgICAgICAgICAgICBpZiAoYk1heC55IDwgeSkgYk1heC55ID0geTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJNYXgueiA8IHopIGJNYXgueiA9IHo7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vcnBoVGFyZ2V0cykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmaW5kIG1heGltdW0gZGlzcGxhY2VtZW50IG9mIHRoZSB2ZXJ0ZXggYnkgYWxsIHRhcmdldHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW5Nb3JwaFggPSBtYXhNb3JwaFggPSB4O1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1pbk1vcnBoWSA9IG1heE1vcnBoWSA9IHk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbWluTW9ycGhaID0gbWF4TW9ycGhaID0gejtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbW9ycGggdGhpcyB2ZXJ0ZXggYnkgYWxsIG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGwgPSAwOyBsIDwgbW9ycGhUYXJnZXRzLmxlbmd0aDsgbCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gbW9ycGhUYXJnZXRzW2xdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHggPSB0YXJnZXQuZGVsdGFQb3NpdGlvbnNbaiAqIDNdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGR5ID0gdGFyZ2V0LmRlbHRhUG9zaXRpb25zW2ogKiAzICsgMV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHogPSB0YXJnZXQuZGVsdGFQb3NpdGlvbnNbaiAqIDMgKyAyXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkeCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluTW9ycGhYICs9IGR4O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heE1vcnBoWCArPSBkeDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZHkgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbk1vcnBoWSArPSBkeTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhNb3JwaFkgKz0gZHk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGR6IDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5Nb3JwaFogKz0gZHo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4TW9ycGhaICs9IGR6O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW4ueCA+IG1pbk1vcnBoWCkgYk1pbi54ID0gbWluTW9ycGhYO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW4ueSA+IG1pbk1vcnBoWSkgYk1pbi55ID0gbWluTW9ycGhZO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW4ueiA+IG1pbk1vcnBoWikgYk1pbi56ID0gbWluTW9ycGhaO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1heC54IDwgbWF4TW9ycGhYKSBiTWF4LnggPSBtYXhNb3JwaFg7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1heC55IDwgbWF4TW9ycGhZKSBiTWF4LnkgPSBtYXhNb3JwaFk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1heC56IDwgbWF4TW9ycGhaKSBiTWF4LnogPSBtYXhNb3JwaFo7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhY2NvdW50IGZvciBub3JtYWxpemVkIHBvc2l0aW9uYWwgZGF0YVxuICAgICAgICBjb25zdCBwb3NpdGlvbkVsZW1lbnQgPSB0aGlzLnZlcnRleEJ1ZmZlci5nZXRGb3JtYXQoKS5lbGVtZW50cy5maW5kKGUgPT4gZS5uYW1lID09PSBTRU1BTlRJQ19QT1NJVElPTik7XG4gICAgICAgIGlmIChwb3NpdGlvbkVsZW1lbnQgJiYgcG9zaXRpb25FbGVtZW50Lm5vcm1hbGl6ZSkge1xuICAgICAgICAgICAgY29uc3QgZnVuYyA9ICgoKSA9PiB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChwb3NpdGlvbkVsZW1lbnQuZGF0YVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUWVBFX0lOVDg6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAxMjcuMCwgLTEuMCk7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UODogcmV0dXJuIHggPT4geCAvIDI1NS4wO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRZUEVfSU5UMTY6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAzMjc2Ny4wLCAtMS4wKTtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjogcmV0dXJuIHggPT4geCAvIDY1NTM1LjA7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHJldHVybiB4ID0+IHg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Cb25lczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJvbmVVc2VkW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pbiA9IGJvbmVNaW5baV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1heCA9IGJvbmVNYXhbaV07XG4gICAgICAgICAgICAgICAgICAgIG1pbi5zZXQoZnVuYyhtaW4ueCksIGZ1bmMobWluLnkpLCBmdW5jKG1pbi56KSk7XG4gICAgICAgICAgICAgICAgICAgIG1heC5zZXQoZnVuYyhtYXgueCksIGZ1bmMobWF4LnkpLCBmdW5jKG1heC56KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgYm9uZSBib3VuZGluZyBib3hlc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUJvbmVzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGFhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcbiAgICAgICAgICAgIGFhYmIuc2V0TWluTWF4KGJvbmVNaW5baV0sIGJvbmVNYXhbaV0pO1xuICAgICAgICAgICAgdGhpcy5ib25lQWFiYi5wdXNoKGFhYmIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gd2hlbiBtZXNoIEFQSSB0byBtb2RpZnkgdmVydGV4IC8gaW5kZXggZGF0YSBhcmUgdXNlZCwgdGhpcyBhbGxvY2F0ZXMgc3RydWN0dXJlIHRvIHN0b3JlIHRoZSBkYXRhXG4gICAgX2luaXRHZW9tZXRyeURhdGEoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZ2VvbWV0cnlEYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEgPSBuZXcgR2VvbWV0cnlEYXRhKCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHZlcnRleCBidWZmZXIgZXhpc3RzIGFscmVhZHksIHN0b3JlIHRoZSBzaXplc1xuICAgICAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50ID0gdGhpcy52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heFZlcnRpY2VzID0gdGhpcy52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIGluZGV4IGJ1ZmZlciBleGlzdHMgYWxyZWFkeSwgc3RvcmUgdGhlIHNpemVzXG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleEJ1ZmZlci5sZW5ndGggPiAwICYmIHRoaXMuaW5kZXhCdWZmZXJbMF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhDb3VudCA9IHRoaXMuaW5kZXhCdWZmZXJbMF0ubnVtSW5kaWNlcztcbiAgICAgICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEubWF4SW5kaWNlcyA9IHRoaXMuaW5kZXhCdWZmZXJbMF0ubnVtSW5kaWNlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyB0aGUgbWVzaCBvZiBleGlzdGluZyB2ZXJ0aWNlcyBhbmQgaW5kaWNlcyBhbmQgcmVzZXRzIHRoZSB7QGxpbmsgVmVydGV4Rm9ybWF0fVxuICAgICAqIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWVzaC4gVGhpcyBjYWxsIGlzIHR5cGljYWxseSBmb2xsb3dlZCBieSBjYWxscyB0byBtZXRob2RzIHN1Y2ggYXNcbiAgICAgKiB7QGxpbmsgTWVzaCNzZXRQb3NpdGlvbnN9LCB7QGxpbmsgTWVzaCNzZXRWZXJ0ZXhTdHJlYW19IG9yIHtAbGluayBNZXNoI3NldEluZGljZXN9IGFuZFxuICAgICAqIGZpbmFsbHkge0BsaW5rIE1lc2gjdXBkYXRlfSB0byByZWJ1aWxkIHRoZSBtZXNoLCBhbGxvd2luZyBkaWZmZXJlbnQge0BsaW5rIFZlcnRleEZvcm1hdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFt2ZXJ0aWNlc0R5bmFtaWNdIC0gSW5kaWNhdGVzIHRoZSB7QGxpbmsgVmVydGV4QnVmZmVyfSBzaG91bGQgYmUgY3JlYXRlZFxuICAgICAqIHdpdGgge0BsaW5rIEJVRkZFUl9EWU5BTUlDfSB1c2FnZS4gSWYgbm90IHNwZWNpZmllZCwge0BsaW5rIEJVRkZFUl9TVEFUSUN9IGlzIHVzZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbaW5kaWNlc0R5bmFtaWNdIC0gSW5kaWNhdGVzIHRoZSB7QGxpbmsgSW5kZXhCdWZmZXJ9IHNob3VsZCBiZSBjcmVhdGVkIHdpdGhcbiAgICAgKiB7QGxpbmsgQlVGRkVSX0RZTkFNSUN9IHVzYWdlLiBJZiBub3Qgc3BlY2lmaWVkLCB7QGxpbmsgQlVGRkVSX1NUQVRJQ30gaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21heFZlcnRpY2VzXSAtIEEge0BsaW5rIFZlcnRleEJ1ZmZlcn0gd2lsbCBiZSBhbGxvY2F0ZWQgd2l0aCBhdCBsZWFzdFxuICAgICAqIG1heFZlcnRpY2VzLCBhbGxvd2luZyBhZGRpdGlvbmFsIHZlcnRpY2VzIHRvIGJlIGFkZGVkIHRvIGl0IHdpdGhvdXQgdGhlIGFsbG9jYXRpb24uIElmIG5vXG4gICAgICogdmFsdWUgaXMgcHJvdmlkZWQsIGEgc2l6ZSB0byBmaXQgdGhlIHByb3ZpZGVkIHZlcnRpY2VzIHdpbGwgYmUgYWxsb2NhdGVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWF4SW5kaWNlc10gLSBBbiB7QGxpbmsgSW5kZXhCdWZmZXJ9IHdpbGwgYmUgYWxsb2NhdGVkIHdpdGggYXQgbGVhc3RcbiAgICAgKiBtYXhJbmRpY2VzLCBhbGxvd2luZyBhZGRpdGlvbmFsIGluZGljZXMgdG8gYmUgYWRkZWQgdG8gaXQgd2l0aG91dCB0aGUgYWxsb2NhdGlvbi4gSWYgbm9cbiAgICAgKiB2YWx1ZSBpcyBwcm92aWRlZCwgYSBzaXplIHRvIGZpdCB0aGUgcHJvdmlkZWQgaW5kaWNlcyB3aWxsIGJlIGFsbG9jYXRlZC5cbiAgICAgKi9cbiAgICBjbGVhcih2ZXJ0aWNlc0R5bmFtaWMsIGluZGljZXNEeW5hbWljLCBtYXhWZXJ0aWNlcyA9IDAsIG1heEluZGljZXMgPSAwKSB7XG4gICAgICAgIHRoaXMuX2luaXRHZW9tZXRyeURhdGEoKTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluaXREZWZhdWx0cygpO1xuXG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5yZWNyZWF0ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcyA9IG1heFZlcnRpY2VzO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEubWF4SW5kaWNlcyA9IG1heEluZGljZXM7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0aWNlc1VzYWdlID0gdmVydGljZXNEeW5hbWljID8gQlVGRkVSX1NUQVRJQyA6IEJVRkZFUl9EWU5BTUlDO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kaWNlc1VzYWdlID0gaW5kaWNlc0R5bmFtaWMgPyBCVUZGRVJfU1RBVElDIDogQlVGRkVSX0RZTkFNSUM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmVydGV4IGRhdGEgZm9yIGFueSBzdXBwb3J0ZWQgc2VtYW50aWMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VtYW50aWMgLSBUaGUgbWVhbmluZyBvZiB0aGUgdmVydGV4IGVsZW1lbnQuIEZvciBzdXBwb3J0ZWQgc2VtYW50aWNzLCBzZWVcbiAgICAgKiBTRU1BTlRJQ18qIGluIHtAbGluayBWZXJ0ZXhGb3JtYXR9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gZGF0YSAtIFZlcnRleFxuICAgICAqIGRhdGEgZm9yIHRoZSBzcGVjaWZpZWQgc2VtYW50aWMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbXBvbmVudENvdW50IC0gVGhlIG51bWJlciBvZiB2YWx1ZXMgdGhhdCBmb3JtIGEgc2luZ2xlIFZlcnRleCBlbGVtZW50LiBGb3JcbiAgICAgKiBleGFtcGxlIHdoZW4gc2V0dGluZyBhIDNEIHBvc2l0aW9uIHJlcHJlc2VudGVkIGJ5IDMgbnVtYmVycyBwZXIgdmVydGV4LCBudW1iZXIgMyBzaG91bGQgYmVcbiAgICAgKiBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1WZXJ0aWNlc10gLSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHRvIGJlIHVzZWQgZnJvbSBkYXRhIGFycmF5LiBJZiBub3RcbiAgICAgKiBwcm92aWRlZCwgdGhlIHdob2xlIGRhdGEgYXJyYXkgaXMgdXNlZC4gVGhpcyBhbGxvd3MgdG8gdXNlIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBhcnJheS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2RhdGFUeXBlXSAtIFRoZSBmb3JtYXQgb2YgZGF0YSB3aGVuIHN0b3JlZCBpbiB0aGUge0BsaW5rIFZlcnRleEJ1ZmZlcn0sIHNlZVxuICAgICAqIFRZUEVfKiBpbiB7QGxpbmsgVmVydGV4Rm9ybWF0fS4gV2hlbiBub3Qgc3BlY2lmaWVkLCB7QGxpbmsgVFlQRV9GTE9BVDMyfSBpcyB1c2VkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RhdGFUeXBlTm9ybWFsaXplXSAtIElmIHRydWUsIHZlcnRleCBhdHRyaWJ1dGUgZGF0YSB3aWxsIGJlIG1hcHBlZCBmcm9tIGFcbiAgICAgKiAwIHRvIDI1NSByYW5nZSBkb3duIHRvIDAgdG8gMSB3aGVuIGZlZCB0byBhIHNoYWRlci4gSWYgZmFsc2UsIHZlcnRleCBhdHRyaWJ1dGUgZGF0YSBpcyBsZWZ0XG4gICAgICogdW5jaGFuZ2VkLiBJZiB0aGlzIHByb3BlcnR5IGlzIHVuc3BlY2lmaWVkLCBmYWxzZSBpcyBhc3N1bWVkLlxuICAgICAqL1xuICAgIHNldFZlcnRleFN0cmVhbShzZW1hbnRpYywgZGF0YSwgY29tcG9uZW50Q291bnQsIG51bVZlcnRpY2VzLCBkYXRhVHlwZSA9IFRZUEVfRkxPQVQzMiwgZGF0YVR5cGVOb3JtYWxpemUgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLl9pbml0R2VvbWV0cnlEYXRhKCk7XG4gICAgICAgIGNvbnN0IHZlcnRleENvdW50ID0gbnVtVmVydGljZXMgfHwgZGF0YS5sZW5ndGggLyBjb21wb25lbnRDb3VudDtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLl9jaGFuZ2VWZXJ0ZXhDb3VudCh2ZXJ0ZXhDb3VudCwgc2VtYW50aWMpO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtc1VwZGF0ZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5W3NlbWFudGljXSA9IG5ldyBHZW9tZXRyeVZlcnRleFN0cmVhbShcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBjb21wb25lbnRDb3VudCxcbiAgICAgICAgICAgIGRhdGFUeXBlLFxuICAgICAgICAgICAgZGF0YVR5cGVOb3JtYWxpemVcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB2ZXJ0ZXggZGF0YSBjb3JyZXNwb25kaW5nIHRvIGEgc2VtYW50aWMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VtYW50aWMgLSBUaGUgc2VtYW50aWMgb2YgdGhlIHZlcnRleCBlbGVtZW50IHRvIGdldC4gRm9yIHN1cHBvcnRlZFxuICAgICAqIHNlbWFudGljcywgc2VlIFNFTUFOVElDXyogaW4ge0BsaW5rIFZlcnRleEZvcm1hdH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBkYXRhIC0gQW5cbiAgICAgKiBhcnJheSB0byBwb3B1bGF0ZSB3aXRoIHRoZSB2ZXJ0ZXggZGF0YS4gV2hlbiB0eXBlZCBhcnJheSBpcyBzdXBwbGllZCwgZW5vdWdoIHNwYWNlIG5lZWRzIHRvXG4gICAgICogYmUgcmVzZXJ2ZWQsIG90aGVyd2lzZSBvbmx5IHBhcnRpYWwgZGF0YSBpcyBjb3BpZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHZlcnRpY2VzIHBvcHVsYXRlZC5cbiAgICAgKi9cbiAgICBnZXRWZXJ0ZXhTdHJlYW0oc2VtYW50aWMsIGRhdGEpIHtcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgbGV0IGRvbmUgPSBmYWxzZTtcblxuICAgICAgICAvLyBzZWUgaWYgd2UgaGF2ZSB1bi1hcHBsaWVkIHN0cmVhbVxuICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhKSB7XG4gICAgICAgICAgICBjb25zdCBzdHJlYW0gPSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeVtzZW1hbnRpY107XG4gICAgICAgICAgICBpZiAoc3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgY291bnQgPSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4Q291bnQ7XG5cbiAgICAgICAgICAgICAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uIGRhdGEgaXMgdHlwZWQgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5zZXQoc3RyZWFtLmRhdGEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uIGRhdGEgaXMgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgICAgICBkYXRhLnB1c2goc3RyZWFtLmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZG9uZSkge1xuICAgICAgICAgICAgLy8gZ2V0IHN0cmVhbSBmcm9tIFZlcnRleEJ1ZmZlclxuICAgICAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90ZTogdGhlcmUgaXMgbm8gbmVlZCB0byAuZW5kIHRoZSBpdGVyYXRvciwgYXMgd2UgYXJlIG9ubHkgcmVhZGluZyBkYXRhIGZyb20gaXRcbiAgICAgICAgICAgICAgICBjb25zdCBpdGVyYXRvciA9IG5ldyBWZXJ0ZXhJdGVyYXRvcih0aGlzLnZlcnRleEJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgY291bnQgPSBpdGVyYXRvci5yZWFkRGF0YShzZW1hbnRpYywgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY291bnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmVydGV4IHBvc2l0aW9ucyBhcnJheS4gVmVydGljZXMgYXJlIHN0b3JlZCB1c2luZyB7QGxpbmsgVFlQRV9GTE9BVDMyfSBmb3JtYXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IHBvc2l0aW9ucyAtIFZlcnRleFxuICAgICAqIGRhdGEgY29udGFpbmluZyBwb3NpdGlvbnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtjb21wb25lbnRDb3VudF0gLSBUaGUgbnVtYmVyIG9mIHZhbHVlcyB0aGF0IGZvcm0gYSBzaW5nbGUgcG9zaXRpb24gZWxlbWVudC5cbiAgICAgKiBEZWZhdWx0cyB0byAzIGlmIG5vdCBzcGVjaWZpZWQsIGNvcnJlc3BvbmRpbmcgdG8geCwgeSBhbmQgeiBjb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bVZlcnRpY2VzXSAtIFRoZSBudW1iZXIgb2YgdmVydGljZXMgdG8gYmUgdXNlZCBmcm9tIGRhdGEgYXJyYXkuIElmIG5vdFxuICAgICAqIHByb3ZpZGVkLCB0aGUgd2hvbGUgZGF0YSBhcnJheSBpcyB1c2VkLiBUaGlzIGFsbG93cyB0byB1c2Ugb25seSBwYXJ0IG9mIHRoZSBkYXRhIGFycmF5LlxuICAgICAqL1xuICAgIHNldFBvc2l0aW9ucyhwb3NpdGlvbnMsIGNvbXBvbmVudENvdW50ID0gR2VvbWV0cnlEYXRhLkRFRkFVTFRfQ09NUE9ORU5UU19QT1NJVElPTiwgbnVtVmVydGljZXMpIHtcbiAgICAgICAgdGhpcy5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfUE9TSVRJT04sIHBvc2l0aW9ucywgY29tcG9uZW50Q291bnQsIG51bVZlcnRpY2VzLCBUWVBFX0ZMT0FUMzIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2ZXJ0ZXggbm9ybWFscyBhcnJheS4gTm9ybWFscyBhcmUgc3RvcmVkIHVzaW5nIHtAbGluayBUWVBFX0ZMT0FUMzJ9IGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gbm9ybWFscyAtIFZlcnRleFxuICAgICAqIGRhdGEgY29udGFpbmluZyBub3JtYWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbY29tcG9uZW50Q291bnRdIC0gVGhlIG51bWJlciBvZiB2YWx1ZXMgdGhhdCBmb3JtIGEgc2luZ2xlIG5vcm1hbCBlbGVtZW50LlxuICAgICAqIERlZmF1bHRzIHRvIDMgaWYgbm90IHNwZWNpZmllZCwgY29ycmVzcG9uZGluZyB0byB4LCB5IGFuZCB6IGRpcmVjdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bVZlcnRpY2VzXSAtIFRoZSBudW1iZXIgb2YgdmVydGljZXMgdG8gYmUgdXNlZCBmcm9tIGRhdGEgYXJyYXkuIElmIG5vdFxuICAgICAqIHByb3ZpZGVkLCB0aGUgd2hvbGUgZGF0YSBhcnJheSBpcyB1c2VkLiBUaGlzIGFsbG93cyB0byB1c2Ugb25seSBwYXJ0IG9mIHRoZSBkYXRhIGFycmF5LlxuICAgICAqL1xuICAgIHNldE5vcm1hbHMobm9ybWFscywgY29tcG9uZW50Q291bnQgPSBHZW9tZXRyeURhdGEuREVGQVVMVF9DT01QT05FTlRTX05PUk1BTCwgbnVtVmVydGljZXMpIHtcbiAgICAgICAgdGhpcy5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfTk9STUFMLCBub3JtYWxzLCBjb21wb25lbnRDb3VudCwgbnVtVmVydGljZXMsIFRZUEVfRkxPQVQzMiwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZlcnRleCB1diBhcnJheS4gVXZzIGFyZSBzdG9yZWQgdXNpbmcge0BsaW5rIFRZUEVfRkxPQVQzMn0gZm9ybWF0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNoYW5uZWwgLSBUaGUgdXYgY2hhbm5lbCBpbiBbMC4uN10gcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSB1dnMgLSBWZXJ0ZXhcbiAgICAgKiBkYXRhIGNvbnRhaW5pbmcgdXYtY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtjb21wb25lbnRDb3VudF0gLSBUaGUgbnVtYmVyIG9mIHZhbHVlcyB0aGF0IGZvcm0gYSBzaW5nbGUgdXYgZWxlbWVudC5cbiAgICAgKiBEZWZhdWx0cyB0byAyIGlmIG5vdCBzcGVjaWZpZWQsIGNvcnJlc3BvbmRpbmcgdG8gdSBhbmQgdiBjb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bVZlcnRpY2VzXSAtIFRoZSBudW1iZXIgb2YgdmVydGljZXMgdG8gYmUgdXNlZCBmcm9tIGRhdGEgYXJyYXkuIElmIG5vdFxuICAgICAqIHByb3ZpZGVkLCB0aGUgd2hvbGUgZGF0YSBhcnJheSBpcyB1c2VkLiBUaGlzIGFsbG93cyB0byB1c2Ugb25seSBwYXJ0IG9mIHRoZSBkYXRhIGFycmF5LlxuICAgICAqL1xuICAgIHNldFV2cyhjaGFubmVsLCB1dnMsIGNvbXBvbmVudENvdW50ID0gR2VvbWV0cnlEYXRhLkRFRkFVTFRfQ09NUE9ORU5UU19VViwgbnVtVmVydGljZXMpIHtcbiAgICAgICAgdGhpcy5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfVEVYQ09PUkQgKyBjaGFubmVsLCB1dnMsIGNvbXBvbmVudENvdW50LCBudW1WZXJ0aWNlcywgVFlQRV9GTE9BVDMyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmVydGV4IGNvbG9yIGFycmF5LiBDb2xvcnMgYXJlIHN0b3JlZCB1c2luZyB7QGxpbmsgVFlQRV9GTE9BVDMyfSBmb3JtYXQsIHdoaWNoIGlzXG4gICAgICogdXNlZnVsIGZvciBIRFIgY29sb3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBjb2xvcnMgLSBWZXJ0ZXhcbiAgICAgKiBkYXRhIGNvbnRhaW5pbmcgY29sb3JzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbY29tcG9uZW50Q291bnRdIC0gVGhlIG51bWJlciBvZiB2YWx1ZXMgdGhhdCBmb3JtIGEgc2luZ2xlIGNvbG9yIGVsZW1lbnQuXG4gICAgICogRGVmYXVsdHMgdG8gNCBpZiBub3Qgc3BlY2lmaWVkLCBjb3JyZXNwb25kaW5nIHRvIHIsIGcsIGIgYW5kIGEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1WZXJ0aWNlc10gLSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHRvIGJlIHVzZWQgZnJvbSBkYXRhIGFycmF5LiBJZiBub3RcbiAgICAgKiBwcm92aWRlZCwgdGhlIHdob2xlIGRhdGEgYXJyYXkgaXMgdXNlZC4gVGhpcyBhbGxvd3MgdG8gdXNlIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBhcnJheS5cbiAgICAgKi9cbiAgICBzZXRDb2xvcnMoY29sb3JzLCBjb21wb25lbnRDb3VudCA9IEdlb21ldHJ5RGF0YS5ERUZBVUxUX0NPTVBPTkVOVFNfQ09MT1JTLCBudW1WZXJ0aWNlcykge1xuICAgICAgICB0aGlzLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19DT0xPUiwgY29sb3JzLCBjb21wb25lbnRDb3VudCwgbnVtVmVydGljZXMsIFRZUEVfRkxPQVQzMiwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZlcnRleCBjb2xvciBhcnJheS4gQ29sb3JzIGFyZSBzdG9yZWQgdXNpbmcge0BsaW5rIFRZUEVfVUlOVDh9IGZvcm1hdCwgd2hpY2ggaXNcbiAgICAgKiB1c2VmdWwgZm9yIExEUiBjb2xvcnMuIFZhbHVlcyBpbiB0aGUgYXJyYXkgYXJlIGV4cGVjdGVkIGluIFswLi4yNTVdIHJhbmdlLCBhbmQgYXJlIG1hcHBlZCB0b1xuICAgICAqIFswLi4xXSByYW5nZSBpbiB0aGUgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBjb2xvcnMgLSBWZXJ0ZXhcbiAgICAgKiBkYXRhIGNvbnRhaW5pbmcgY29sb3JzLiBUaGUgYXJyYXkgaXMgZXhwZWN0ZWQgdG8gY29udGFpbiA0IGNvbXBvbmVudHMgcGVyIHZlcnRleCxcbiAgICAgKiBjb3JyZXNwb25kaW5nIHRvIHIsIGcsIGIgYW5kIGEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1WZXJ0aWNlc10gLSBUaGUgbnVtYmVyIG9mIHZlcnRpY2VzIHRvIGJlIHVzZWQgZnJvbSBkYXRhIGFycmF5LiBJZiBub3RcbiAgICAgKiBwcm92aWRlZCwgdGhlIHdob2xlIGRhdGEgYXJyYXkgaXMgdXNlZC4gVGhpcyBhbGxvd3MgdG8gdXNlIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBhcnJheS5cbiAgICAgKi9cbiAgICBzZXRDb2xvcnMzMihjb2xvcnMsIG51bVZlcnRpY2VzKSB7XG4gICAgICAgIHRoaXMuc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX0NPTE9SLCBjb2xvcnMsIEdlb21ldHJ5RGF0YS5ERUZBVUxUX0NPTVBPTkVOVFNfQ09MT1JTLCBudW1WZXJ0aWNlcywgVFlQRV9VSU5UOCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgaW5kZXggYXJyYXkuIEluZGljZXMgYXJlIHN0b3JlZCB1c2luZyAxNi1iaXQgZm9ybWF0IGJ5IGRlZmF1bHQsIHVubGVzcyBtb3JlIHRoYW5cbiAgICAgKiA2NTUzNSB2ZXJ0aWNlcyBhcmUgc3BlY2lmaWVkLCBpbiB3aGljaCBjYXNlIDMyLWJpdCBmb3JtYXQgaXMgdXNlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118VWludDhBcnJheXxVaW50MTZBcnJheXxVaW50MzJBcnJheX0gaW5kaWNlcyAtIFRoZSBhcnJheSBvZiBpbmRpY2VzIHRoYXRcbiAgICAgKiBkZWZpbmUgcHJpbWl0aXZlcyAobGluZXMsIHRyaWFuZ2xlcywgZXRjLikuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1JbmRpY2VzXSAtIFRoZSBudW1iZXIgb2YgaW5kaWNlcyB0byBiZSB1c2VkIGZyb20gZGF0YSBhcnJheS4gSWYgbm90XG4gICAgICogcHJvdmlkZWQsIHRoZSB3aG9sZSBkYXRhIGFycmF5IGlzIHVzZWQuIFRoaXMgYWxsb3dzIHRvIHVzZSBvbmx5IHBhcnQgb2YgdGhlIGRhdGEgYXJyYXkuXG4gICAgICovXG4gICAgc2V0SW5kaWNlcyhpbmRpY2VzLCBudW1JbmRpY2VzKSB7XG4gICAgICAgIHRoaXMuX2luaXRHZW9tZXRyeURhdGEoKTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4U3RyZWFtVXBkYXRlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzID0gaW5kaWNlcztcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQgPSBudW1JbmRpY2VzIHx8IGluZGljZXMubGVuZ3RoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZlcnRleCBwb3NpdGlvbnMgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gcG9zaXRpb25zIC0gQW5cbiAgICAgKiBhcnJheSB0byBwb3B1bGF0ZSB3aXRoIHRoZSB2ZXJ0ZXggZGF0YS4gV2hlbiB0eXBlZCBhcnJheSBpcyBzdXBwbGllZCwgZW5vdWdoIHNwYWNlIG5lZWRzIHRvXG4gICAgICogYmUgcmVzZXJ2ZWQsIG90aGVyd2lzZSBvbmx5IHBhcnRpYWwgZGF0YSBpcyBjb3BpZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHZlcnRpY2VzIHBvcHVsYXRlZC5cbiAgICAgKi9cbiAgICBnZXRQb3NpdGlvbnMocG9zaXRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZlcnRleFN0cmVhbShTRU1BTlRJQ19QT1NJVElPTiwgcG9zaXRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB2ZXJ0ZXggbm9ybWFscyBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBub3JtYWxzIC0gQW5cbiAgICAgKiBhcnJheSB0byBwb3B1bGF0ZSB3aXRoIHRoZSB2ZXJ0ZXggZGF0YS4gV2hlbiB0eXBlZCBhcnJheSBpcyBzdXBwbGllZCwgZW5vdWdoIHNwYWNlIG5lZWRzIHRvXG4gICAgICogYmUgcmVzZXJ2ZWQsIG90aGVyd2lzZSBvbmx5IHBhcnRpYWwgZGF0YSBpcyBjb3BpZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHZlcnRpY2VzIHBvcHVsYXRlZC5cbiAgICAgKi9cbiAgICBnZXROb3JtYWxzKG5vcm1hbHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX05PUk1BTCwgbm9ybWFscyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdmVydGV4IHV2IGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2hhbm5lbCAtIFRoZSB1diBjaGFubmVsIGluIFswLi43XSByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IHV2cyAtIEFuXG4gICAgICogYXJyYXkgdG8gcG9wdWxhdGUgd2l0aCB0aGUgdmVydGV4IGRhdGEuIFdoZW4gdHlwZWQgYXJyYXkgaXMgc3VwcGxpZWQsIGVub3VnaCBzcGFjZSBuZWVkcyB0b1xuICAgICAqIGJlIHJlc2VydmVkLCBvdGhlcndpc2Ugb25seSBwYXJ0aWFsIGRhdGEgaXMgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlciBvZiB2ZXJ0aWNlcyBwb3B1bGF0ZWQuXG4gICAgICovXG4gICAgZ2V0VXZzKGNoYW5uZWwsIHV2cykge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfVEVYQ09PUkQgKyBjaGFubmVsLCB1dnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZlcnRleCBjb2xvciBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBjb2xvcnMgLSBBblxuICAgICAqIGFycmF5IHRvIHBvcHVsYXRlIHdpdGggdGhlIHZlcnRleCBkYXRhLiBXaGVuIHR5cGVkIGFycmF5IGlzIHN1cHBsaWVkLCBlbm91Z2ggc3BhY2UgbmVlZHMgdG9cbiAgICAgKiBiZSByZXNlcnZlZCwgb3RoZXJ3aXNlIG9ubHkgcGFydGlhbCBkYXRhIGlzIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgdmVydGljZXMgcG9wdWxhdGVkLlxuICAgICAqL1xuICAgIGdldENvbG9ycyhjb2xvcnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX0NPTE9SLCBjb2xvcnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGluZGV4IGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfFVpbnQ4QXJyYXl8VWludDE2QXJyYXl8VWludDMyQXJyYXl9IGluZGljZXMgLSBBbiBhcnJheSB0byBwb3B1bGF0ZSB3aXRoIHRoZVxuICAgICAqIGluZGV4IGRhdGEuIFdoZW4gYSB0eXBlZCBhcnJheSBpcyBzdXBwbGllZCwgZW5vdWdoIHNwYWNlIG5lZWRzIHRvIGJlIHJlc2VydmVkLCBvdGhlcndpc2VcbiAgICAgKiBvbmx5IHBhcnRpYWwgZGF0YSBpcyBjb3BpZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyIG9mIGluZGljZXMgcG9wdWxhdGVkLlxuICAgICAqL1xuICAgIGdldEluZGljZXMoaW5kaWNlcykge1xuICAgICAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgICAgIC8vIHNlZSBpZiB3ZSBoYXZlIHVuLWFwcGxpZWQgaW5kaWNlc1xuICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhICYmIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzKSB7XG4gICAgICAgICAgICBjb25zdCBzdHJlYW1JbmRpY2VzID0gdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXM7XG4gICAgICAgICAgICBjb3VudCA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50O1xuXG4gICAgICAgICAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KGluZGljZXMpKSB7XG4gICAgICAgICAgICAgICAgLy8gZGVzdGluYXRpb24gZGF0YSBpcyB0eXBlZCBhcnJheVxuICAgICAgICAgICAgICAgIGluZGljZXMuc2V0KHN0cmVhbUluZGljZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbiBkYXRhIGlzIGFycmF5XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaChzdHJlYW1JbmRpY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGdldCBkYXRhIGZyb20gSW5kZXhCdWZmZXJcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyLmxlbmd0aCA+IDAgJiYgdGhpcy5pbmRleEJ1ZmZlclswXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gdGhpcy5pbmRleEJ1ZmZlclswXTtcbiAgICAgICAgICAgICAgICBjb3VudCA9IGluZGV4QnVmZmVyLnJlYWREYXRhKGluZGljZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGxpZXMgYW55IGNoYW5nZXMgdG8gdmVydGV4IHN0cmVhbSBhbmQgaW5kaWNlcyB0byBtZXNoLiBUaGlzIGFsbG9jYXRlcyBvciByZWFsbG9jYXRlc1xuICAgICAqIHtAbGluayB2ZXJ0ZXhCdWZmZXJ9IG9yIHtAbGluayBJbmRleEJ1ZmZlcn0gdG8gZml0IGFsbCBwcm92aWRlZCB2ZXJ0aWNlcyBhbmQgaW5kaWNlcywgYW5kXG4gICAgICogZmlsbHMgdGhlbSB3aXRoIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ByaW1pdGl2ZVR5cGVdIC0gVGhlIHR5cGUgb2YgcHJpbWl0aXZlIHRvIHJlbmRlci4gIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9QT0lOVFN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FTE9PUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVNUUklQfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklBTkdMRVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSVNUUklQfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklGQU59XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU30gaWYgdW5zcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbdXBkYXRlQm91bmRpbmdCb3hdIC0gVHJ1ZSB0byB1cGRhdGUgYm91bmRpbmcgYm94LiBCb3VuZGluZyBib3ggaXMgdXBkYXRlZFxuICAgICAqIG9ubHkgaWYgcG9zaXRpb25zIHdlcmUgc2V0IHNpbmNlIGxhc3QgdGltZSB1cGRhdGUgd2FzIGNhbGxlZCwgYW5kIGNvbXBvbmVudENvdW50IGZvclxuICAgICAqIHBvc2l0aW9uIHdhcyAzLCBvdGhlcndpc2UgYm91bmRpbmcgYm94IGlzIG5vdCB1cGRhdGVkLiBTZWUge0BsaW5rIE1lc2gjc2V0UG9zaXRpb25zfS5cbiAgICAgKiBEZWZhdWx0cyB0byB0cnVlIGlmIHVuc3BlY2lmaWVkLiBTZXQgdGhpcyB0byBmYWxzZSB0byBhdm9pZCB1cGRhdGUgb2YgdGhlIGJvdW5kaW5nIGJveCBhbmRcbiAgICAgKiB1c2UgYWFiYiBwcm9wZXJ0eSB0byBzZXQgaXQgaW5zdGVhZC5cbiAgICAgKi9cbiAgICB1cGRhdGUocHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9UUklBTkdMRVMsIHVwZGF0ZUJvdW5kaW5nQm94ID0gdHJ1ZSkge1xuXG4gICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEpIHtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIGJvdW5kaW5nIGJveCBpZiBuZWVkZWRcbiAgICAgICAgICAgIGlmICh1cGRhdGVCb3VuZGluZ0JveCkge1xuXG4gICAgICAgICAgICAgICAgLy8gZmluZCB2ZWMzIHBvc2l0aW9uIHN0cmVhbVxuICAgICAgICAgICAgICAgIGNvbnN0IHN0cmVhbSA9IHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5W1NFTUFOVElDX1BPU0lUSU9OXTtcbiAgICAgICAgICAgICAgICBpZiAoc3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdHJlYW0uY29tcG9uZW50Q291bnQgPT09IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2FhYmIuY29tcHV0ZShzdHJlYW0uZGF0YSwgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGVzdHJveSB2ZXJ0ZXggYnVmZmVyIGlmIHJlY3JlYXRlIHdhcyByZXF1ZXN0ZWQgb3IgaWYgdmVydGljZXMgZG9uJ3QgZml0XG4gICAgICAgICAgICBsZXQgZGVzdHJveVZCID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnJlY3JlYXRlO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhDb3VudCA+IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcykge1xuICAgICAgICAgICAgICAgIGRlc3Ryb3lWQiA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heFZlcnRpY2VzID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVzdHJveVZCKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGVzdHJveSBpbmRleCBidWZmZXIgaWYgcmVjcmVhdGUgd2FzIHJlcXVlc3RlZCBvciBpZiBpbmRpY2VzIGRvbid0IGZpdFxuICAgICAgICAgICAgbGV0IGRlc3Ryb3lJQiA9IHRoaXMuX2dlb21ldHJ5RGF0YS5yZWNyZWF0ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhDb3VudCA+IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhJbmRpY2VzKSB7XG4gICAgICAgICAgICAgICAgZGVzdHJveUlCID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEubWF4SW5kaWNlcyA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVzdHJveUlCKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoID4gMCAmJiB0aGlzLmluZGV4QnVmZmVyWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXJbMF0uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyWzBdID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSB2ZXJ0aWNlcyBpZiBuZWVkZWRcbiAgICAgICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtc1VwZGF0ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVWZXJ0ZXhCdWZmZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGluZGljZXMgaWYgbmVlZGVkXG4gICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4U3RyZWFtVXBkYXRlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUluZGV4QnVmZmVyKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCB1cCBwcmltaXRpdmUgcGFyYW1ldGVyc1xuICAgICAgICAgICAgdGhpcy5wcmltaXRpdmVbMF0udHlwZSA9IHByaW1pdGl2ZVR5cGU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyLmxlbmd0aCA+IDAgJiYgdGhpcy5pbmRleEJ1ZmZlclswXSkgeyAgICAgIC8vIGluZGV4ZWRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4U3RyZWFtVXBkYXRlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVswXS5jb3VudCA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVswXS5pbmRleGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgeyAgICAgICAgLy8gbm9uLWluZGV4ZWRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbXNVcGRhdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJpbWl0aXZlWzBdLmNvdW50ID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVswXS5pbmRleGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjb3VudHMgY2FuIGJlIGNoYW5nZWQgb24gbmV4dCBmcmFtZSwgc28gc2V0IHRoZW0gdG8gMFxuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50ID0gMDtcbiAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50ID0gMDtcblxuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbXNVcGRhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhTdHJlYW1VcGRhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEucmVjcmVhdGUgPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIG90aGVyIHJlbmRlciBzdGF0ZXNcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUmVuZGVyU3RhdGVzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBidWlsZHMgdmVydGV4IGZvcm1hdCBiYXNlZCBvbiBhdHRhY2hlZCB2ZXJ0ZXggc3RyZWFtc1xuICAgIF9idWlsZFZlcnRleEZvcm1hdCh2ZXJ0ZXhDb3VudCkge1xuXG4gICAgICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5KSB7XG4gICAgICAgICAgICBjb25zdCBzdHJlYW0gPSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeVtzZW1hbnRpY107XG4gICAgICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzdHJlYW0uY29tcG9uZW50Q291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogc3RyZWFtLmRhdGFUeXBlLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogc3RyZWFtLmRhdGFUeXBlTm9ybWFsaXplXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgVmVydGV4Rm9ybWF0KHRoaXMuZGV2aWNlLCB2ZXJ0ZXhEZXNjLCB2ZXJ0ZXhDb3VudCk7XG4gICAgfVxuXG4gICAgLy8gY29weSBhdHRhY2hlZCBkYXRhIGludG8gdmVydGV4IGJ1ZmZlclxuICAgIF91cGRhdGVWZXJ0ZXhCdWZmZXIoKSB7XG5cbiAgICAgICAgLy8gaWYgd2UgZG9uJ3QgaGF2ZSB2ZXJ0ZXggYnVmZmVyLCBjcmVhdGUgbmV3IG9uZSwgb3RoZXJ3aXNlIHVwZGF0ZSBleGlzdGluZyBvbmVcbiAgICAgICAgaWYgKCF0aGlzLnZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgY29uc3QgYWxsb2NhdGVWZXJ0ZXhDb3VudCA9IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcztcbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IHRoaXMuX2J1aWxkVmVydGV4Rm9ybWF0KGFsbG9jYXRlVmVydGV4Q291bnQpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMuZGV2aWNlLCBmb3JtYXQsIGFsbG9jYXRlVmVydGV4Q291bnQsIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0aWNlc1VzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvY2sgdmVydGV4IGJ1ZmZlciBhbmQgY3JlYXRlIHR5cGVkIGFjY2VzcyBhcnJheXMgZm9yIGluZGl2aWR1YWwgZWxlbWVudHNcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBuZXcgVmVydGV4SXRlcmF0b3IodGhpcy52ZXJ0ZXhCdWZmZXIpO1xuXG4gICAgICAgIC8vIGNvcHkgYWxsIHN0cmVhbSBkYXRhIGludG8gdmVydGV4IGJ1ZmZlclxuICAgICAgICBjb25zdCBudW1WZXJ0aWNlcyA9IHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhDb3VudDtcbiAgICAgICAgZm9yIChjb25zdCBzZW1hbnRpYyBpbiB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeSkge1xuICAgICAgICAgICAgY29uc3Qgc3RyZWFtID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnlbc2VtYW50aWNdO1xuICAgICAgICAgICAgaXRlcmF0b3Iud3JpdGVEYXRhKHNlbWFudGljLCBzdHJlYW0uZGF0YSwgbnVtVmVydGljZXMpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgc3RyZWFtXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnlbc2VtYW50aWNdO1xuICAgICAgICB9XG5cbiAgICAgICAgaXRlcmF0b3IuZW5kKCk7XG4gICAgfVxuXG4gICAgLy8gY29weSBhdHRhY2hlZCBkYXRhIGludG8gaW5kZXggYnVmZmVyXG4gICAgX3VwZGF0ZUluZGV4QnVmZmVyKCkge1xuXG4gICAgICAgIC8vIGlmIHdlIGRvbid0IGhhdmUgaW5kZXggYnVmZmVyLCBjcmVhdGUgbmV3IG9uZSwgb3RoZXJ3aXNlIHVwZGF0ZSBleGlzdGluZyBvbmVcbiAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoIDw9IDAgfHwgIXRoaXMuaW5kZXhCdWZmZXJbMF0pIHtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZUZvcm1hdCA9IHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhWZXJ0aWNlcyA+IDB4ZmZmZiA/IElOREVYRk9STUFUX1VJTlQzMiA6IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXJbMF0gPSBuZXcgSW5kZXhCdWZmZXIodGhpcy5kZXZpY2UsIGNyZWF0ZUZvcm1hdCwgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heEluZGljZXMsIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzVXNhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3JjSW5kaWNlcyA9IHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzO1xuICAgICAgICBpZiAoc3JjSW5kaWNlcykge1xuXG4gICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IHRoaXMuaW5kZXhCdWZmZXJbMF07XG4gICAgICAgICAgICBpbmRleEJ1ZmZlci53cml0ZURhdGEoc3JjSW5kaWNlcywgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgZGF0YVxuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgdGhlIG1lc2ggdG8gYmUgcmVuZGVyZWQgd2l0aCBzcGVjaWZpYyByZW5kZXIgc3R5bGVcbiAgICBwcmVwYXJlUmVuZGVyU3RhdGUocmVuZGVyU3R5bGUpIHtcbiAgICAgICAgaWYgKHJlbmRlclN0eWxlID09PSBSRU5ERVJTVFlMRV9XSVJFRlJBTUUpIHtcbiAgICAgICAgICAgIHRoaXMuZ2VuZXJhdGVXaXJlZnJhbWUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChyZW5kZXJTdHlsZSA9PT0gUkVOREVSU1RZTEVfUE9JTlRTKSB7XG4gICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVtSRU5ERVJTVFlMRV9QT0lOVFNdID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgICAgICAgICAgICAgYmFzZTogMCxcbiAgICAgICAgICAgICAgICBjb3VudDogdGhpcy52ZXJ0ZXhCdWZmZXIgPyB0aGlzLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyA6IDAsXG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2VcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIGV4aXN0aW5nIHJlbmRlciBzdGF0ZXMgd2l0aCBjaGFuZ2VzIHRvIHNvbGlkIHJlbmRlciBzdGF0ZVxuICAgIHVwZGF0ZVJlbmRlclN0YXRlcygpIHtcblxuICAgICAgICBpZiAodGhpcy5wcmltaXRpdmVbUkVOREVSU1RZTEVfUE9JTlRTXSkge1xuICAgICAgICAgICAgdGhpcy5wcmVwYXJlUmVuZGVyU3RhdGUoUkVOREVSU1RZTEVfUE9JTlRTKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnByaW1pdGl2ZVtSRU5ERVJTVFlMRV9XSVJFRlJBTUVdKSB7XG4gICAgICAgICAgICB0aGlzLnByZXBhcmVSZW5kZXJTdGF0ZShSRU5ERVJTVFlMRV9XSVJFRlJBTUUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVXaXJlZnJhbWUoKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSBleGlzdGluZyBJQlxuICAgICAgICB0aGlzLl9kZXN0cm95SW5kZXhCdWZmZXIoUkVOREVSU1RZTEVfV0lSRUZSQU1FKTtcblxuICAgICAgICBjb25zdCBsaW5lcyA9IFtdO1xuICAgICAgICBsZXQgZm9ybWF0O1xuICAgICAgICBpZiAodGhpcy5pbmRleEJ1ZmZlci5sZW5ndGggPiAwICYmIHRoaXMuaW5kZXhCdWZmZXJbMF0pIHtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldHMgPSBbWzAsIDFdLCBbMSwgMl0sIFsyLCAwXV07XG5cbiAgICAgICAgICAgIGNvbnN0IGJhc2UgPSB0aGlzLnByaW1pdGl2ZVtSRU5ERVJTVFlMRV9TT0xJRF0uYmFzZTtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5wcmltaXRpdmVbUkVOREVSU1RZTEVfU09MSURdLmNvdW50O1xuICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSB0aGlzLmluZGV4QnVmZmVyW1JFTkRFUlNUWUxFX1NPTElEXTtcbiAgICAgICAgICAgIGNvbnN0IHNyY0luZGljZXMgPSBuZXcgdHlwZWRBcnJheUluZGV4Rm9ybWF0c1tpbmRleEJ1ZmZlci5mb3JtYXRdKGluZGV4QnVmZmVyLnN0b3JhZ2UpO1xuXG4gICAgICAgICAgICBjb25zdCB1bmlxdWVMaW5lSW5kaWNlcyA9IHt9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gYmFzZTsgaiA8IGJhc2UgKyBjb3VudDsgaiArPSAzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCAzOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaTEgPSBzcmNJbmRpY2VzW2ogKyBvZmZzZXRzW2tdWzBdXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaTIgPSBzcmNJbmRpY2VzW2ogKyBvZmZzZXRzW2tdWzFdXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IChpMSA+IGkyKSA/ICgoaTIgPDwgMTYpIHwgaTEpIDogKChpMSA8PCAxNikgfCBpMik7XG4gICAgICAgICAgICAgICAgICAgIGlmICh1bmlxdWVMaW5lSW5kaWNlc1tsaW5lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVMaW5lSW5kaWNlc1tsaW5lXSA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lcy5wdXNoKGkxLCBpMik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3JtYXQgPSBpbmRleEJ1ZmZlci5mb3JtYXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzOyBpICs9IDMpIHtcbiAgICAgICAgICAgICAgICBsaW5lcy5wdXNoKGksIGkgKyAxLCBpICsgMSwgaSArIDIsIGkgKyAyLCBpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvcm1hdCA9IGxpbmVzLmxlbmd0aCA+IDY1NTM1ID8gSU5ERVhGT1JNQVRfVUlOVDMyIDogSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2lyZUJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLnZlcnRleEJ1ZmZlci5kZXZpY2UsIGZvcm1hdCwgbGluZXMubGVuZ3RoKTtcbiAgICAgICAgY29uc3QgZHN0SW5kaWNlcyA9IG5ldyB0eXBlZEFycmF5SW5kZXhGb3JtYXRzW3dpcmVCdWZmZXIuZm9ybWF0XSh3aXJlQnVmZmVyLnN0b3JhZ2UpO1xuICAgICAgICBkc3RJbmRpY2VzLnNldChsaW5lcyk7XG4gICAgICAgIHdpcmVCdWZmZXIudW5sb2NrKCk7XG5cbiAgICAgICAgdGhpcy5wcmltaXRpdmVbUkVOREVSU1RZTEVfV0lSRUZSQU1FXSA9IHtcbiAgICAgICAgICAgIHR5cGU6IFBSSU1JVElWRV9MSU5FUyxcbiAgICAgICAgICAgIGJhc2U6IDAsXG4gICAgICAgICAgICBjb3VudDogbGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmluZGV4QnVmZmVyW1JFTkRFUlNUWUxFX1dJUkVGUkFNRV0gPSB3aXJlQnVmZmVyO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTWVzaCB9O1xuIl0sIm5hbWVzIjpbImlkIiwiR2VvbWV0cnlEYXRhIiwiY29uc3RydWN0b3IiLCJpbml0RGVmYXVsdHMiLCJyZWNyZWF0ZSIsInZlcnRpY2VzVXNhZ2UiLCJCVUZGRVJfU1RBVElDIiwiaW5kaWNlc1VzYWdlIiwibWF4VmVydGljZXMiLCJtYXhJbmRpY2VzIiwidmVydGV4Q291bnQiLCJpbmRleENvdW50IiwidmVydGV4U3RyZWFtc1VwZGF0ZWQiLCJpbmRleFN0cmVhbVVwZGF0ZWQiLCJ2ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5IiwiaW5kaWNlcyIsIl9jaGFuZ2VWZXJ0ZXhDb3VudCIsImNvdW50Iiwic2VtYW50aWMiLCJEZWJ1ZyIsImFzc2VydCIsIkRFRkFVTFRfQ09NUE9ORU5UU19QT1NJVElPTiIsIkRFRkFVTFRfQ09NUE9ORU5UU19OT1JNQUwiLCJERUZBVUxUX0NPTVBPTkVOVFNfVVYiLCJERUZBVUxUX0NPTVBPTkVOVFNfQ09MT1JTIiwiR2VvbWV0cnlWZXJ0ZXhTdHJlYW0iLCJkYXRhIiwiY29tcG9uZW50Q291bnQiLCJkYXRhVHlwZSIsImRhdGFUeXBlTm9ybWFsaXplIiwiTWVzaCIsIlJlZkNvdW50ZWRPYmplY3QiLCJncmFwaGljc0RldmljZSIsImRldmljZSIsImdldEFwcGxpY2F0aW9uIiwidmVydGV4QnVmZmVyIiwiaW5kZXhCdWZmZXIiLCJwcmltaXRpdmUiLCJ0eXBlIiwiYmFzZSIsInNraW4iLCJfbW9ycGgiLCJfZ2VvbWV0cnlEYXRhIiwiX2FhYmIiLCJCb3VuZGluZ0JveCIsImJvbmVBYWJiIiwibW9ycGgiLCJkZWNSZWZDb3VudCIsImluY1JlZkNvdW50IiwiYWFiYiIsImRlc3Ryb3kiLCJyZWZDb3VudCIsImoiLCJsZW5ndGgiLCJfZGVzdHJveUluZGV4QnVmZmVyIiwiaW5kZXgiLCJfaW5pdEJvbmVBYWJicyIsIm1vcnBoVGFyZ2V0cyIsImJvbmVVc2VkIiwieCIsInkiLCJ6IiwiYk1heCIsImJNaW4iLCJib25lTWluIiwiYm9uZU1heCIsIm51bUJvbmVzIiwiYm9uZU5hbWVzIiwibWF4TW9ycGhYIiwibWF4TW9ycGhZIiwibWF4TW9ycGhaIiwiaSIsIlZlYzMiLCJOdW1iZXIiLCJNQVhfVkFMVUUiLCJpdGVyYXRvciIsIlZlcnRleEl0ZXJhdG9yIiwicG9zRWxlbWVudCIsImVsZW1lbnQiLCJTRU1BTlRJQ19QT1NJVElPTiIsIndlaWdodHNFbGVtZW50IiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJpbmRpY2VzRWxlbWVudCIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIm51bVZlcnRzIiwibnVtVmVydGljZXMiLCJrIiwiYm9uZVdlaWdodCIsImFycmF5IiwiYm9uZUluZGV4IiwibWluTW9ycGhYIiwibWluTW9ycGhZIiwibWluTW9ycGhaIiwibCIsInRhcmdldCIsImR4IiwiZGVsdGFQb3NpdGlvbnMiLCJkeSIsImR6IiwibmV4dCIsInBvc2l0aW9uRWxlbWVudCIsImdldEZvcm1hdCIsImVsZW1lbnRzIiwiZmluZCIsImUiLCJuYW1lIiwibm9ybWFsaXplIiwiZnVuYyIsIlRZUEVfSU5UOCIsIk1hdGgiLCJtYXgiLCJUWVBFX1VJTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfVUlOVDE2IiwibWluIiwic2V0Iiwic2V0TWluTWF4IiwicHVzaCIsIl9pbml0R2VvbWV0cnlEYXRhIiwibnVtSW5kaWNlcyIsImNsZWFyIiwidmVydGljZXNEeW5hbWljIiwiaW5kaWNlc0R5bmFtaWMiLCJCVUZGRVJfRFlOQU1JQyIsInNldFZlcnRleFN0cmVhbSIsIlRZUEVfRkxPQVQzMiIsImdldFZlcnRleFN0cmVhbSIsImRvbmUiLCJzdHJlYW0iLCJBcnJheUJ1ZmZlciIsImlzVmlldyIsInJlYWREYXRhIiwic2V0UG9zaXRpb25zIiwicG9zaXRpb25zIiwic2V0Tm9ybWFscyIsIm5vcm1hbHMiLCJTRU1BTlRJQ19OT1JNQUwiLCJzZXRVdnMiLCJjaGFubmVsIiwidXZzIiwiU0VNQU5USUNfVEVYQ09PUkQiLCJzZXRDb2xvcnMiLCJjb2xvcnMiLCJTRU1BTlRJQ19DT0xPUiIsInNldENvbG9yczMyIiwic2V0SW5kaWNlcyIsImdldFBvc2l0aW9ucyIsImdldE5vcm1hbHMiLCJnZXRVdnMiLCJnZXRDb2xvcnMiLCJnZXRJbmRpY2VzIiwic3RyZWFtSW5kaWNlcyIsInVwZGF0ZSIsInByaW1pdGl2ZVR5cGUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwidXBkYXRlQm91bmRpbmdCb3giLCJjb21wdXRlIiwiZGVzdHJveVZCIiwiZGVzdHJveUlCIiwiX3VwZGF0ZVZlcnRleEJ1ZmZlciIsIl91cGRhdGVJbmRleEJ1ZmZlciIsImluZGV4ZWQiLCJ1cGRhdGVSZW5kZXJTdGF0ZXMiLCJfYnVpbGRWZXJ0ZXhGb3JtYXQiLCJ2ZXJ0ZXhEZXNjIiwiY29tcG9uZW50cyIsIlZlcnRleEZvcm1hdCIsImFsbG9jYXRlVmVydGV4Q291bnQiLCJmb3JtYXQiLCJWZXJ0ZXhCdWZmZXIiLCJ3cml0ZURhdGEiLCJlbmQiLCJjcmVhdGVGb3JtYXQiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJbmRleEJ1ZmZlciIsInNyY0luZGljZXMiLCJwcmVwYXJlUmVuZGVyU3RhdGUiLCJyZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1dJUkVGUkFNRSIsImdlbmVyYXRlV2lyZWZyYW1lIiwiUkVOREVSU1RZTEVfUE9JTlRTIiwiUFJJTUlUSVZFX1BPSU5UUyIsImxpbmVzIiwib2Zmc2V0cyIsIlJFTkRFUlNUWUxFX1NPTElEIiwidHlwZWRBcnJheUluZGV4Rm9ybWF0cyIsInN0b3JhZ2UiLCJ1bmlxdWVMaW5lSW5kaWNlcyIsImkxIiwiaTIiLCJsaW5lIiwidW5kZWZpbmVkIiwid2lyZUJ1ZmZlciIsImRzdEluZGljZXMiLCJ1bmxvY2siLCJQUklNSVRJVkVfTElORVMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMkJBLElBQUlBLEVBQUUsR0FBRyxDQUFULENBQUE7O0FBR0EsTUFBTUMsWUFBTixDQUFtQjtBQUNmQyxFQUFBQSxXQUFXLEdBQUc7QUFDVixJQUFBLElBQUEsQ0FBS0MsWUFBTCxFQUFBLENBQUE7QUFDSCxHQUFB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
