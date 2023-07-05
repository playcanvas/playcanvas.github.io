import { Debug } from '../core/debug.js';
import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { SEMANTIC_POSITION, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, BUFFER_STATIC, BUFFER_DYNAMIC, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD, SEMANTIC_COLOR, PRIMITIVE_TRIANGLES, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, PRIMITIVE_POINTS, typedArrayIndexFormats, PRIMITIVE_LINES } from '../platform/graphics/constants.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { VertexIterator } from '../platform/graphics/vertex-iterator.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { RENDERSTYLE_WIREFRAME, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID } from './constants.js';

let id = 0;

// Helper class used to store vertex / index data streams and related properties, when mesh is programmatically modified
class GeometryData {
  constructor() {
    this.initDefaults();
  }
  initDefaults() {
    // by default, existing mesh is updated but not recreated, until .clear function is called
    this.recreate = false;

    // usage for buffers
    this.verticesUsage = BUFFER_STATIC;
    this.indicesUsage = BUFFER_STATIC;

    // vertex and index buffer allocated size (maximum number of vertices / indices that can be stored in those without the need to reallocate them)
    this.maxVertices = 0;
    this.maxIndices = 0;

    // current number of vertices and indices in use
    this.vertexCount = 0;
    this.indexCount = 0;

    // dirty flags representing what needs be updated
    this.vertexStreamsUpdated = false;
    this.indexStreamUpdated = false;

    // dictionary of vertex streams that need to be updated, looked up by semantic
    this.vertexStreamDictionary = {};

    // index stream data that needs to be updated
    this.indices = null;
  }

  // function called when vertex stream is requested to be updated, and validates / updates currently used vertex count
  _changeVertexCount(count, semantic) {
    // update vertex count and validate it with existing streams
    if (!this.vertexCount) {
      this.vertexCount = count;
    } else {
      Debug.assert(this.vertexCount === count, `Vertex stream ${semantic} has ${count} vertices, which does not match already set streams with ${this.vertexCount} vertices.`);
    }
  }

  // default counts for vertex components
}

// class storing information about single vertex data stream
GeometryData.DEFAULT_COMPONENTS_POSITION = 3;
GeometryData.DEFAULT_COMPONENTS_NORMAL = 3;
GeometryData.DEFAULT_COMPONENTS_UV = 2;
GeometryData.DEFAULT_COMPONENTS_COLORS = 4;
class GeometryVertexStream {
  constructor(data, componentCount, dataType, dataTypeNormalize) {
    this.data = data; // array of data
    this.componentCount = componentCount; // number of components
    this.dataType = dataType; // format of elements (pc.TYPE_FLOAT32 ..)
    this.dataTypeNormalize = dataTypeNormalize; // normalize element (divide by 255)
  }
}

/**
 * A graphical primitive. The mesh is defined by a {@link VertexBuffer} and an optional
 * {@link IndexBuffer}. It also contains a primitive definition which controls the type of the
 * primitive and the portion of the vertex or index buffer to use.
 *
 * ## Mesh APIs
 * There are two ways a mesh can be generated or updated.
 *
 * ### Simple Mesh API
 * {@link Mesh} class provides interfaces such as {@link Mesh#setPositions} and {@link Mesh#setUvs}
 * that provide a simple way to provide vertex and index data for the Mesh, and hiding the
 * complexity of creating the {@link VertexFormat}. This is the recommended interface to use.
 *
 * A simple example which creates a Mesh with 3 vertices, containing position coordinates only, to
 * form a single triangle.
 *
 * ```javascript
 * const mesh = new pc.Mesh(device);
 * const positions = [
 *     0, 0, 0, // pos 0
 *     1, 0, 0, // pos 1
 *     1, 1, 0  // pos 2
 * ];
 * mesh.setPositions(positions);
 * mesh.update();
 * ```
 *
 * An example which creates a Mesh with 4 vertices, containing position and uv coordinates in
 * channel 0, and an index buffer to form two triangles. Float32Array is used for positions and uvs.
 *
 * ```javascript
 * const mesh = new pc.Mesh(device);
 * const positions = new Float32Array([
 *     0, 0, 0, // pos 0
 *     1, 0, 0, // pos 1
 *     1, 1, 0, // pos 2
 *     0, 1, 0  // pos 3
 * ]);
 * const uvs = new Float32Array([
 *     0, 0, // uv 0
 *     1, 0, // uv 1
 *     1, 1, // uv 2
 *     0, 1  // uv 3
 * ]);
 * const indices = [
 *     0, 1, 2, // triangle 0
 *     0, 2, 3  // triangle 1
 * ];
 * mesh.setPositions(positions);
 * mesh.setUvs(0, uvs);
 * mesh.setIndices(indices);
 * mesh.update();
 * ```
 *
 * This example demonstrates that vertex attributes such as position and normals, and also indices
 * can be provided using Arrays ([]) and also Typed Arrays (Float32Array and similar). Note that
 * typed arrays have higher performance, and are generally recommended for per-frame operations or
 * larger meshes, but their construction using new operator is costly operation. If you only need
 * to operate on a small number of vertices or indices, consider using Arrays to avoid the overhead
 * associated with allocating Typed Arrays.
 *
 * Follow these links for more complex examples showing the functionality.
 *
 * - {@link http://playcanvas.github.io/#graphics/mesh-decals}
 * - {@link http://playcanvas.github.io/#graphics/mesh-deformation}
 * - {@link http://playcanvas.github.io/#graphics/mesh-generation}
 * - {@link http://playcanvas.github.io/#graphics/point-cloud-simulation}
 *
 * ### Update Vertex and Index buffers
 * This allows greater flexibility, but is more complex to use. It allows more advanced setups, for
 * example sharing a Vertex or Index Buffer between multiple meshes. See {@link VertexBuffer},
 * {@link IndexBuffer} and {@link VertexFormat} for details.
 */
class Mesh extends RefCountedObject {
  /**
   * Create a new Mesh instance.
   *
   * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} [graphicsDevice] -
   * The graphics device used to manage this mesh. If it is not provided, a device is obtained
   * from the {@link Application}.
   */
  constructor(graphicsDevice) {
    super();
    this.id = id++;
    Debug.assertDeprecated(graphicsDevice, "Mesh constructor takes a GraphicsDevice as a parameter, and it was not provided.");
    this.device = graphicsDevice || GraphicsDeviceAccess.get();

    /**
     * The vertex buffer holding the vertex data of the mesh.
     *
     * @type {VertexBuffer}
     */
    this.vertexBuffer = null;

    /**
     * An array of index buffers. For unindexed meshes, this array can be empty. The first
     * index buffer in the array is used by {@link MeshInstance}s with a renderStyle property
     * set to {@link RENDERSTYLE_SOLID}. The second index buffer in the array is used if
     * renderStyle is set to {@link RENDERSTYLE_WIREFRAME}.
     *
     * @type {IndexBuffer[]}
     */
    this.indexBuffer = [null];

    /**
     * Array of primitive objects defining how vertex (and index) data in the mesh should be
     * interpreted by the graphics device.
     *
     * - `type` is the type of primitive to render. Can be:
     *
     *   - {@link PRIMITIVE_POINTS}
     *   - {@link PRIMITIVE_LINES}
     *   - {@link PRIMITIVE_LINELOOP}
     *   - {@link PRIMITIVE_LINESTRIP}
     *   - {@link PRIMITIVE_TRIANGLES}
     *   - {@link PRIMITIVE_TRISTRIP}
     *   - {@link PRIMITIVE_TRIFAN}
     *
     * - `base` is the offset of the first index or vertex to dispatch in the draw call.
     * - `count` is the number of indices or vertices to dispatch in the draw call.
     * - `indexed` specifies whether to interpret the primitive as indexed, thereby using the
     * currently set index buffer.
     *
     * @type {Array.<{type: number, base: number, count: number, indexed: boolean|undefined}>}
     */
    this.primitive = [{
      type: 0,
      base: 0,
      count: 0
    }];

    /**
     * The skin data (if any) that drives skinned mesh animations for this mesh.
     *
     * @type {import('./skin.js').Skin|null}
     */
    this.skin = null;
    this._morph = null;
    this._geometryData = null;

    // AABB for object space mesh vertices
    this._aabb = new BoundingBox();

    // Array of object space AABBs of vertices affected by each bone
    this.boneAabb = null;
  }

  /**
   * The morph data (if any) that drives morph target animations for this mesh.
   *
   * @type {import('./morph.js').Morph|null}
   */
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

  /**
   * The axis-aligned bounding box for the object space vertices of this mesh.
   *
   * @type {BoundingBox}
   */
  set aabb(aabb) {
    this._aabb = aabb;
  }
  get aabb() {
    return this._aabb;
  }

  /**
   * Destroys {@link VertexBuffer} and {@link IndexBuffer} associate with the mesh. This is
   * normally called by {@link Model#destroy} and does not need to be called manually.
   */
  destroy() {
    const morph = this.morph;
    if (morph) {
      // this decreases ref count on the morph
      this.morph = null;

      // destroy morph
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

  // initializes local bounding boxes for each bone based on vertices affected by the bone
  // if morph targets are provided, it also adjusts local bone bounding boxes by maximum morph displacement
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

    // start with empty bone bounds
    for (let i = 0; i < numBones; i++) {
      boneMin[i] = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      boneMax[i] = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    }

    // access to mesh from vertex buffer
    const iterator = new VertexIterator(this.vertexBuffer);
    const posElement = iterator.element[SEMANTIC_POSITION];
    const weightsElement = iterator.element[SEMANTIC_BLENDWEIGHT];
    const indicesElement = iterator.element[SEMANTIC_BLENDINDICES];

    // Find bone AABBs of attached vertices
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

          // adjust bounds of a bone by the vertex
          bMax = boneMax[boneIndex];
          bMin = boneMin[boneIndex];
          if (bMin.x > x) bMin.x = x;
          if (bMin.y > y) bMin.y = y;
          if (bMin.z > z) bMin.z = z;
          if (bMax.x < x) bMax.x = x;
          if (bMax.y < y) bMax.y = y;
          if (bMax.z < z) bMax.z = z;
          if (morphTargets) {
            // find maximum displacement of the vertex by all targets
            let minMorphX = maxMorphX = x;
            let minMorphY = maxMorphY = y;
            let minMorphZ = maxMorphZ = z;

            // morph this vertex by all morph targets
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

    // account for normalized positional data
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

    // store bone bounding boxes
    for (let i = 0; i < numBones; i++) {
      const aabb = new BoundingBox();
      aabb.setMinMax(boneMin[i], boneMax[i]);
      this.boneAabb.push(aabb);
    }
  }

  // when mesh API to modify vertex / index data are used, this allocates structure to store the data
  _initGeometryData() {
    if (!this._geometryData) {
      this._geometryData = new GeometryData();

      // if vertex buffer exists already, store the sizes
      if (this.vertexBuffer) {
        this._geometryData.vertexCount = this.vertexBuffer.numVertices;
        this._geometryData.maxVertices = this.vertexBuffer.numVertices;
      }

      // if index buffer exists already, store the sizes
      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        this._geometryData.indexCount = this.indexBuffer[0].numIndices;
        this._geometryData.maxIndices = this.indexBuffer[0].numIndices;
      }
    }
  }

  /**
   * Clears the mesh of existing vertices and indices and resets the {@link VertexFormat}
   * associated with the mesh. This call is typically followed by calls to methods such as
   * {@link Mesh#setPositions}, {@link Mesh#setVertexStream} or {@link Mesh#setIndices} and
   * finally {@link Mesh#update} to rebuild the mesh, allowing different {@link VertexFormat}.
   *
   * @param {boolean} [verticesDynamic] - Indicates the {@link VertexBuffer} should be created
   * with {@link BUFFER_DYNAMIC} usage. If not specified, {@link BUFFER_STATIC} is used.
   * @param {boolean} [indicesDynamic] - Indicates the {@link IndexBuffer} should be created with
   * {@link BUFFER_DYNAMIC} usage. If not specified, {@link BUFFER_STATIC} is used.
   * @param {number} [maxVertices] - A {@link VertexBuffer} will be allocated with at least
   * maxVertices, allowing additional vertices to be added to it without the allocation. If no
   * value is provided, a size to fit the provided vertices will be allocated.
   * @param {number} [maxIndices] - An {@link IndexBuffer} will be allocated with at least
   * maxIndices, allowing additional indices to be added to it without the allocation. If no
   * value is provided, a size to fit the provided indices will be allocated.
   */
  clear(verticesDynamic, indicesDynamic, maxVertices = 0, maxIndices = 0) {
    this._initGeometryData();
    this._geometryData.initDefaults();
    this._geometryData.recreate = true;
    this._geometryData.maxVertices = maxVertices;
    this._geometryData.maxIndices = maxIndices;
    this._geometryData.verticesUsage = verticesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
    this._geometryData.indicesUsage = indicesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
  }

  /**
   * Sets the vertex data for any supported semantic.
   *
   * @param {string} semantic - The meaning of the vertex element. For supported semantics, see
   * SEMANTIC_* in {@link VertexFormat}.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - Vertex
   * data for the specified semantic.
   * @param {number} componentCount - The number of values that form a single Vertex element. For
   * example when setting a 3D position represented by 3 numbers per vertex, number 3 should be
   * specified.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   * @param {number} [dataType] - The format of data when stored in the {@link VertexBuffer}, see
   * TYPE_* in {@link VertexFormat}. When not specified, {@link TYPE_FLOAT32} is used.
   * @param {boolean} [dataTypeNormalize] - If true, vertex attribute data will be mapped from a
   * 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data is left
   * unchanged. If this property is unspecified, false is assumed.
   */
  setVertexStream(semantic, data, componentCount, numVertices, dataType = TYPE_FLOAT32, dataTypeNormalize = false) {
    this._initGeometryData();
    const vertexCount = numVertices || data.length / componentCount;
    this._geometryData._changeVertexCount(vertexCount, semantic);
    this._geometryData.vertexStreamsUpdated = true;
    this._geometryData.vertexStreamDictionary[semantic] = new GeometryVertexStream(data, componentCount, dataType, dataTypeNormalize);
  }

  /**
   * Gets the vertex data corresponding to a semantic.
   *
   * @param {string} semantic - The semantic of the vertex element to get. For supported
   * semantics, see SEMANTIC_* in {@link VertexFormat}.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getVertexStream(semantic, data) {
    let count = 0;
    let done = false;

    // see if we have un-applied stream
    if (this._geometryData) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];
      if (stream) {
        done = true;
        count = this._geometryData.vertexCount;
        if (ArrayBuffer.isView(data)) {
          // destination data is typed array
          data.set(stream.data);
        } else {
          // destination data is array
          data.length = 0;
          data.push(stream.data);
        }
      }
    }
    if (!done) {
      // get stream from VertexBuffer
      if (this.vertexBuffer) {
        // note: there is no need to .end the iterator, as we are only reading data from it
        const iterator = new VertexIterator(this.vertexBuffer);
        count = iterator.readData(semantic, data);
      }
    }
    return count;
  }

  /**
   * Sets the vertex positions array. Vertices are stored using {@link TYPE_FLOAT32} format.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} positions - Vertex
   * data containing positions.
   * @param {number} [componentCount] - The number of values that form a single position element.
   * Defaults to 3 if not specified, corresponding to x, y and z coordinates.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setPositions(positions, componentCount = GeometryData.DEFAULT_COMPONENTS_POSITION, numVertices) {
    this.setVertexStream(SEMANTIC_POSITION, positions, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex normals array. Normals are stored using {@link TYPE_FLOAT32} format.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} normals - Vertex
   * data containing normals.
   * @param {number} [componentCount] - The number of values that form a single normal element.
   * Defaults to 3 if not specified, corresponding to x, y and z direction.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setNormals(normals, componentCount = GeometryData.DEFAULT_COMPONENTS_NORMAL, numVertices) {
    this.setVertexStream(SEMANTIC_NORMAL, normals, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex uv array. Uvs are stored using {@link TYPE_FLOAT32} format.
   *
   * @param {number} channel - The uv channel in [0..7] range.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} uvs - Vertex
   * data containing uv-coordinates.
   * @param {number} [componentCount] - The number of values that form a single uv element.
   * Defaults to 2 if not specified, corresponding to u and v coordinates.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setUvs(channel, uvs, componentCount = GeometryData.DEFAULT_COMPONENTS_UV, numVertices) {
    this.setVertexStream(SEMANTIC_TEXCOORD + channel, uvs, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex color array. Colors are stored using {@link TYPE_FLOAT32} format, which is
   * useful for HDR colors.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - Vertex
   * data containing colors.
   * @param {number} [componentCount] - The number of values that form a single color element.
   * Defaults to 4 if not specified, corresponding to r, g, b and a.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setColors(colors, componentCount = GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices) {
    this.setVertexStream(SEMANTIC_COLOR, colors, componentCount, numVertices, TYPE_FLOAT32, false);
  }

  /**
   * Sets the vertex color array. Colors are stored using {@link TYPE_UINT8} format, which is
   * useful for LDR colors. Values in the array are expected in [0..255] range, and are mapped to
   * [0..1] range in the shader.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - Vertex
   * data containing colors. The array is expected to contain 4 components per vertex,
   * corresponding to r, g, b and a.
   * @param {number} [numVertices] - The number of vertices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setColors32(colors, numVertices) {
    this.setVertexStream(SEMANTIC_COLOR, colors, GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices, TYPE_UINT8, true);
  }

  /**
   * Sets the index array. Indices are stored using 16-bit format by default, unless more than
   * 65535 vertices are specified, in which case 32-bit format is used.
   *
   * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - The array of indices that
   * define primitives (lines, triangles, etc.).
   * @param {number} [numIndices] - The number of indices to be used from data array. If not
   * provided, the whole data array is used. This allows to use only part of the data array.
   */
  setIndices(indices, numIndices) {
    this._initGeometryData();
    this._geometryData.indexStreamUpdated = true;
    this._geometryData.indices = indices;
    this._geometryData.indexCount = numIndices || indices.length;
  }

  /**
   * Gets the vertex positions data.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} positions - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getPositions(positions) {
    return this.getVertexStream(SEMANTIC_POSITION, positions);
  }

  /**
   * Gets the vertex normals data.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} normals - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getNormals(normals) {
    return this.getVertexStream(SEMANTIC_NORMAL, normals);
  }

  /**
   * Gets the vertex uv data.
   *
   * @param {number} channel - The uv channel in [0..7] range.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} uvs - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getUvs(channel, uvs) {
    return this.getVertexStream(SEMANTIC_TEXCOORD + channel, uvs);
  }

  /**
   * Gets the vertex color data.
   *
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} colors - An
   * array to populate with the vertex data. When typed array is supplied, enough space needs to
   * be reserved, otherwise only partial data is copied.
   * @returns {number} Returns the number of vertices populated.
   */
  getColors(colors) {
    return this.getVertexStream(SEMANTIC_COLOR, colors);
  }

  /**
   * Gets the index data.
   *
   * @param {number[]|Uint8Array|Uint16Array|Uint32Array} indices - An array to populate with the
   * index data. When a typed array is supplied, enough space needs to be reserved, otherwise
   * only partial data is copied.
   * @returns {number} Returns the number of indices populated.
   */
  getIndices(indices) {
    let count = 0;

    // see if we have un-applied indices
    if (this._geometryData && this._geometryData.indices) {
      const streamIndices = this._geometryData.indices;
      count = this._geometryData.indexCount;
      if (ArrayBuffer.isView(indices)) {
        // destination data is typed array
        indices.set(streamIndices);
      } else {
        // destination data is array
        indices.length = 0;
        indices.push(streamIndices);
      }
    } else {
      // get data from IndexBuffer
      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        const indexBuffer = this.indexBuffer[0];
        count = indexBuffer.readData(indices);
      }
    }
    return count;
  }

  /**
   * Applies any changes to vertex stream and indices to mesh. This allocates or reallocates
   * {@link vertexBuffer} or {@link IndexBuffer} to fit all provided vertices and indices, and
   * fills them with data.
   *
   * @param {number} [primitiveType] - The type of primitive to render.  Can be:
   *
   * - {@link PRIMITIVE_POINTS}
   * - {@link PRIMITIVE_LINES}
   * - {@link PRIMITIVE_LINELOOP}
   * - {@link PRIMITIVE_LINESTRIP}
   * - {@link PRIMITIVE_TRIANGLES}
   * - {@link PRIMITIVE_TRISTRIP}
   * - {@link PRIMITIVE_TRIFAN}
   *
   * Defaults to {@link PRIMITIVE_TRIANGLES} if unspecified.
   * @param {boolean} [updateBoundingBox] - True to update bounding box. Bounding box is updated
   * only if positions were set since last time update was called, and componentCount for
   * position was 3, otherwise bounding box is not updated. See {@link Mesh#setPositions}.
   * Defaults to true if unspecified. Set this to false to avoid update of the bounding box and
   * use aabb property to set it instead.
   */
  update(primitiveType = PRIMITIVE_TRIANGLES, updateBoundingBox = true) {
    if (this._geometryData) {
      // update bounding box if needed
      if (updateBoundingBox) {
        // find vec3 position stream
        const stream = this._geometryData.vertexStreamDictionary[SEMANTIC_POSITION];
        if (stream) {
          if (stream.componentCount === 3) {
            this._aabb.compute(stream.data, this._geometryData.vertexCount);
          }
        }
      }

      // destroy vertex buffer if recreate was requested or if vertices don't fit
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

      // destroy index buffer if recreate was requested or if indices don't fit
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

      // update vertices if needed
      if (this._geometryData.vertexStreamsUpdated) {
        this._updateVertexBuffer();
      }

      // update indices if needed
      if (this._geometryData.indexStreamUpdated) {
        this._updateIndexBuffer();
      }

      // set up primitive parameters
      this.primitive[0].type = primitiveType;
      if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
        // indexed
        if (this._geometryData.indexStreamUpdated) {
          this.primitive[0].count = this._geometryData.indexCount;
          this.primitive[0].indexed = true;
        }
      } else {
        // non-indexed
        if (this._geometryData.vertexStreamsUpdated) {
          this.primitive[0].count = this._geometryData.vertexCount;
          this.primitive[0].indexed = false;
        }
      }

      // counts can be changed on next frame, so set them to 0
      this._geometryData.vertexCount = 0;
      this._geometryData.indexCount = 0;
      this._geometryData.vertexStreamsUpdated = false;
      this._geometryData.indexStreamUpdated = false;
      this._geometryData.recreate = false;

      // update other render states
      this.updateRenderStates();
    }
  }

  // builds vertex format based on attached vertex streams
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

  // copy attached data into vertex buffer
  _updateVertexBuffer() {
    // if we don't have vertex buffer, create new one, otherwise update existing one
    if (!this.vertexBuffer) {
      const allocateVertexCount = this._geometryData.maxVertices;
      const format = this._buildVertexFormat(allocateVertexCount);
      this.vertexBuffer = new VertexBuffer(this.device, format, allocateVertexCount, this._geometryData.verticesUsage);
    }

    // lock vertex buffer and create typed access arrays for individual elements
    const iterator = new VertexIterator(this.vertexBuffer);

    // copy all stream data into vertex buffer
    const numVertices = this._geometryData.vertexCount;
    for (const semantic in this._geometryData.vertexStreamDictionary) {
      const stream = this._geometryData.vertexStreamDictionary[semantic];
      iterator.writeData(semantic, stream.data, numVertices);

      // remove stream
      delete this._geometryData.vertexStreamDictionary[semantic];
    }
    iterator.end();
  }

  // copy attached data into index buffer
  _updateIndexBuffer() {
    // if we don't have index buffer, create new one, otherwise update existing one
    if (this.indexBuffer.length <= 0 || !this.indexBuffer[0]) {
      const createFormat = this._geometryData.maxVertices > 0xffff ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
      this.indexBuffer[0] = new IndexBuffer(this.device, createFormat, this._geometryData.maxIndices, this._geometryData.indicesUsage);
    }
    const srcIndices = this._geometryData.indices;
    if (srcIndices) {
      const indexBuffer = this.indexBuffer[0];
      indexBuffer.writeData(srcIndices, this._geometryData.indexCount);

      // remove data
      this._geometryData.indices = null;
    }
  }

  // prepares the mesh to be rendered with specific render style
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

  // updates existing render states with changes to solid render state
  updateRenderStates() {
    if (this.primitive[RENDERSTYLE_POINTS]) {
      this.prepareRenderState(RENDERSTYLE_POINTS);
    }
    if (this.primitive[RENDERSTYLE_WIREFRAME]) {
      this.prepareRenderState(RENDERSTYLE_WIREFRAME);
    }
  }
  generateWireframe() {
    // release existing IB
    this._destroyIndexBuffer(RENDERSTYLE_WIREFRAME);
    const numVertices = this.vertexBuffer.numVertices;
    const lines = [];
    let format;
    if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
      const offsets = [[0, 1], [1, 2], [2, 0]];
      const base = this.primitive[RENDERSTYLE_SOLID].base;
      const count = this.primitive[RENDERSTYLE_SOLID].count;
      const indexBuffer = this.indexBuffer[RENDERSTYLE_SOLID];
      const srcIndices = new typedArrayIndexFormats[indexBuffer.format](indexBuffer.storage);
      const seen = new Set();
      for (let j = base; j < base + count; j += 3) {
        for (let k = 0; k < 3; k++) {
          const i1 = srcIndices[j + offsets[k][0]];
          const i2 = srcIndices[j + offsets[k][1]];
          const hash = i1 > i2 ? i2 * numVertices + i1 : i1 * numVertices + i2;
          if (!seen.has(hash)) {
            seen.add(hash);
            lines.push(i1, i2);
          }
        }
      }
      format = indexBuffer.format;
    } else {
      for (let i = 0; i < numVertices; i += 3) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFJlZkNvdW50ZWRPYmplY3QgfSBmcm9tICcuLi9jb3JlL3JlZi1jb3VudGVkLW9iamVjdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcyc7XG5cbmltcG9ydCB7XG4gICAgQlVGRkVSX0RZTkFNSUMsIEJVRkZFUl9TVEFUSUMsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDE2LCBJTkRFWEZPUk1BVF9VSU5UMzIsXG4gICAgUFJJTUlUSVZFX0xJTkVTLCBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfUE9JTlRTLFxuICAgIFNFTUFOVElDX0JMRU5ESU5ESUNFUywgU0VNQU5USUNfQkxFTkRXRUlHSFQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19URVhDT09SRCxcbiAgICBUWVBFX0ZMT0FUMzIsIFRZUEVfVUlOVDgsIFRZUEVfSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsXG4gICAgdHlwZWRBcnJheUluZGV4Rm9ybWF0c1xufSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSW5kZXhCdWZmZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IFZlcnRleEl0ZXJhdG9yIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWl0ZXJhdG9yLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlQWNjZXNzIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLWFjY2Vzcy5qcyc7XG5cbmltcG9ydCB7IFJFTkRFUlNUWUxFX1NPTElELCBSRU5ERVJTVFlMRV9XSVJFRlJBTUUsIFJFTkRFUlNUWUxFX1BPSU5UUyB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxubGV0IGlkID0gMDtcblxuLy8gSGVscGVyIGNsYXNzIHVzZWQgdG8gc3RvcmUgdmVydGV4IC8gaW5kZXggZGF0YSBzdHJlYW1zIGFuZCByZWxhdGVkIHByb3BlcnRpZXMsIHdoZW4gbWVzaCBpcyBwcm9ncmFtbWF0aWNhbGx5IG1vZGlmaWVkXG5jbGFzcyBHZW9tZXRyeURhdGEge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmluaXREZWZhdWx0cygpO1xuICAgIH1cblxuICAgIGluaXREZWZhdWx0cygpIHtcblxuICAgICAgICAvLyBieSBkZWZhdWx0LCBleGlzdGluZyBtZXNoIGlzIHVwZGF0ZWQgYnV0IG5vdCByZWNyZWF0ZWQsIHVudGlsIC5jbGVhciBmdW5jdGlvbiBpcyBjYWxsZWRcbiAgICAgICAgdGhpcy5yZWNyZWF0ZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHVzYWdlIGZvciBidWZmZXJzXG4gICAgICAgIHRoaXMudmVydGljZXNVc2FnZSA9IEJVRkZFUl9TVEFUSUM7XG4gICAgICAgIHRoaXMuaW5kaWNlc1VzYWdlID0gQlVGRkVSX1NUQVRJQztcblxuICAgICAgICAvLyB2ZXJ0ZXggYW5kIGluZGV4IGJ1ZmZlciBhbGxvY2F0ZWQgc2l6ZSAobWF4aW11bSBudW1iZXIgb2YgdmVydGljZXMgLyBpbmRpY2VzIHRoYXQgY2FuIGJlIHN0b3JlZCBpbiB0aG9zZSB3aXRob3V0IHRoZSBuZWVkIHRvIHJlYWxsb2NhdGUgdGhlbSlcbiAgICAgICAgdGhpcy5tYXhWZXJ0aWNlcyA9IDA7XG4gICAgICAgIHRoaXMubWF4SW5kaWNlcyA9IDA7XG5cbiAgICAgICAgLy8gY3VycmVudCBudW1iZXIgb2YgdmVydGljZXMgYW5kIGluZGljZXMgaW4gdXNlXG4gICAgICAgIHRoaXMudmVydGV4Q291bnQgPSAwO1xuICAgICAgICB0aGlzLmluZGV4Q291bnQgPSAwO1xuXG4gICAgICAgIC8vIGRpcnR5IGZsYWdzIHJlcHJlc2VudGluZyB3aGF0IG5lZWRzIGJlIHVwZGF0ZWRcbiAgICAgICAgdGhpcy52ZXJ0ZXhTdHJlYW1zVXBkYXRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmluZGV4U3RyZWFtVXBkYXRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGRpY3Rpb25hcnkgb2YgdmVydGV4IHN0cmVhbXMgdGhhdCBuZWVkIHRvIGJlIHVwZGF0ZWQsIGxvb2tlZCB1cCBieSBzZW1hbnRpY1xuICAgICAgICB0aGlzLnZlcnRleFN0cmVhbURpY3Rpb25hcnkgPSB7fTtcblxuICAgICAgICAvLyBpbmRleCBzdHJlYW0gZGF0YSB0aGF0IG5lZWRzIHRvIGJlIHVwZGF0ZWRcbiAgICAgICAgdGhpcy5pbmRpY2VzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBjYWxsZWQgd2hlbiB2ZXJ0ZXggc3RyZWFtIGlzIHJlcXVlc3RlZCB0byBiZSB1cGRhdGVkLCBhbmQgdmFsaWRhdGVzIC8gdXBkYXRlcyBjdXJyZW50bHkgdXNlZCB2ZXJ0ZXggY291bnRcbiAgICBfY2hhbmdlVmVydGV4Q291bnQoY291bnQsIHNlbWFudGljKSB7XG5cbiAgICAgICAgLy8gdXBkYXRlIHZlcnRleCBjb3VudCBhbmQgdmFsaWRhdGUgaXQgd2l0aCBleGlzdGluZyBzdHJlYW1zXG4gICAgICAgIGlmICghdGhpcy52ZXJ0ZXhDb3VudCkge1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhDb3VudCA9IGNvdW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMudmVydGV4Q291bnQgPT09IGNvdW50LCBgVmVydGV4IHN0cmVhbSAke3NlbWFudGljfSBoYXMgJHtjb3VudH0gdmVydGljZXMsIHdoaWNoIGRvZXMgbm90IG1hdGNoIGFscmVhZHkgc2V0IHN0cmVhbXMgd2l0aCAke3RoaXMudmVydGV4Q291bnR9IHZlcnRpY2VzLmApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZGVmYXVsdCBjb3VudHMgZm9yIHZlcnRleCBjb21wb25lbnRzXG4gICAgc3RhdGljIERFRkFVTFRfQ09NUE9ORU5UU19QT1NJVElPTiA9IDM7XG5cbiAgICBzdGF0aWMgREVGQVVMVF9DT01QT05FTlRTX05PUk1BTCA9IDM7XG5cbiAgICBzdGF0aWMgREVGQVVMVF9DT01QT05FTlRTX1VWID0gMjtcblxuICAgIHN0YXRpYyBERUZBVUxUX0NPTVBPTkVOVFNfQ09MT1JTID0gNDtcbn1cblxuLy8gY2xhc3Mgc3RvcmluZyBpbmZvcm1hdGlvbiBhYm91dCBzaW5nbGUgdmVydGV4IGRhdGEgc3RyZWFtXG5jbGFzcyBHZW9tZXRyeVZlcnRleFN0cmVhbSB7XG4gICAgY29uc3RydWN0b3IoZGF0YSwgY29tcG9uZW50Q291bnQsIGRhdGFUeXBlLCBkYXRhVHlwZU5vcm1hbGl6ZSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhOyAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFycmF5IG9mIGRhdGFcbiAgICAgICAgdGhpcy5jb21wb25lbnRDb3VudCA9IGNvbXBvbmVudENvdW50OyAgICAgICAvLyBudW1iZXIgb2YgY29tcG9uZW50c1xuICAgICAgICB0aGlzLmRhdGFUeXBlID0gZGF0YVR5cGU7ICAgICAgICAgICAgICAgICAgIC8vIGZvcm1hdCBvZiBlbGVtZW50cyAocGMuVFlQRV9GTE9BVDMyIC4uKVxuICAgICAgICB0aGlzLmRhdGFUeXBlTm9ybWFsaXplID0gZGF0YVR5cGVOb3JtYWxpemU7IC8vIG5vcm1hbGl6ZSBlbGVtZW50IChkaXZpZGUgYnkgMjU1KVxuICAgIH1cbn1cblxuLyoqXG4gKiBBIGdyYXBoaWNhbCBwcmltaXRpdmUuIFRoZSBtZXNoIGlzIGRlZmluZWQgYnkgYSB7QGxpbmsgVmVydGV4QnVmZmVyfSBhbmQgYW4gb3B0aW9uYWxcbiAqIHtAbGluayBJbmRleEJ1ZmZlcn0uIEl0IGFsc28gY29udGFpbnMgYSBwcmltaXRpdmUgZGVmaW5pdGlvbiB3aGljaCBjb250cm9scyB0aGUgdHlwZSBvZiB0aGVcbiAqIHByaW1pdGl2ZSBhbmQgdGhlIHBvcnRpb24gb2YgdGhlIHZlcnRleCBvciBpbmRleCBidWZmZXIgdG8gdXNlLlxuICpcbiAqICMjIE1lc2ggQVBJc1xuICogVGhlcmUgYXJlIHR3byB3YXlzIGEgbWVzaCBjYW4gYmUgZ2VuZXJhdGVkIG9yIHVwZGF0ZWQuXG4gKlxuICogIyMjIFNpbXBsZSBNZXNoIEFQSVxuICoge0BsaW5rIE1lc2h9IGNsYXNzIHByb3ZpZGVzIGludGVyZmFjZXMgc3VjaCBhcyB7QGxpbmsgTWVzaCNzZXRQb3NpdGlvbnN9IGFuZCB7QGxpbmsgTWVzaCNzZXRVdnN9XG4gKiB0aGF0IHByb3ZpZGUgYSBzaW1wbGUgd2F5IHRvIHByb3ZpZGUgdmVydGV4IGFuZCBpbmRleCBkYXRhIGZvciB0aGUgTWVzaCwgYW5kIGhpZGluZyB0aGVcbiAqIGNvbXBsZXhpdHkgb2YgY3JlYXRpbmcgdGhlIHtAbGluayBWZXJ0ZXhGb3JtYXR9LiBUaGlzIGlzIHRoZSByZWNvbW1lbmRlZCBpbnRlcmZhY2UgdG8gdXNlLlxuICpcbiAqIEEgc2ltcGxlIGV4YW1wbGUgd2hpY2ggY3JlYXRlcyBhIE1lc2ggd2l0aCAzIHZlcnRpY2VzLCBjb250YWluaW5nIHBvc2l0aW9uIGNvb3JkaW5hdGVzIG9ubHksIHRvXG4gKiBmb3JtIGEgc2luZ2xlIHRyaWFuZ2xlLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGNvbnN0IG1lc2ggPSBuZXcgcGMuTWVzaChkZXZpY2UpO1xuICogY29uc3QgcG9zaXRpb25zID0gW1xuICogICAgIDAsIDAsIDAsIC8vIHBvcyAwXG4gKiAgICAgMSwgMCwgMCwgLy8gcG9zIDFcbiAqICAgICAxLCAxLCAwICAvLyBwb3MgMlxuICogXTtcbiAqIG1lc2guc2V0UG9zaXRpb25zKHBvc2l0aW9ucyk7XG4gKiBtZXNoLnVwZGF0ZSgpO1xuICogYGBgXG4gKlxuICogQW4gZXhhbXBsZSB3aGljaCBjcmVhdGVzIGEgTWVzaCB3aXRoIDQgdmVydGljZXMsIGNvbnRhaW5pbmcgcG9zaXRpb24gYW5kIHV2IGNvb3JkaW5hdGVzIGluXG4gKiBjaGFubmVsIDAsIGFuZCBhbiBpbmRleCBidWZmZXIgdG8gZm9ybSB0d28gdHJpYW5nbGVzLiBGbG9hdDMyQXJyYXkgaXMgdXNlZCBmb3IgcG9zaXRpb25zIGFuZCB1dnMuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogY29uc3QgbWVzaCA9IG5ldyBwYy5NZXNoKGRldmljZSk7XG4gKiBjb25zdCBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KFtcbiAqICAgICAwLCAwLCAwLCAvLyBwb3MgMFxuICogICAgIDEsIDAsIDAsIC8vIHBvcyAxXG4gKiAgICAgMSwgMSwgMCwgLy8gcG9zIDJcbiAqICAgICAwLCAxLCAwICAvLyBwb3MgM1xuICogXSk7XG4gKiBjb25zdCB1dnMgPSBuZXcgRmxvYXQzMkFycmF5KFtcbiAqICAgICAwLCAwLCAvLyB1diAwXG4gKiAgICAgMSwgMCwgLy8gdXYgMVxuICogICAgIDEsIDEsIC8vIHV2IDJcbiAqICAgICAwLCAxICAvLyB1diAzXG4gKiBdKTtcbiAqIGNvbnN0IGluZGljZXMgPSBbXG4gKiAgICAgMCwgMSwgMiwgLy8gdHJpYW5nbGUgMFxuICogICAgIDAsIDIsIDMgIC8vIHRyaWFuZ2xlIDFcbiAqIF07XG4gKiBtZXNoLnNldFBvc2l0aW9ucyhwb3NpdGlvbnMpO1xuICogbWVzaC5zZXRVdnMoMCwgdXZzKTtcbiAqIG1lc2guc2V0SW5kaWNlcyhpbmRpY2VzKTtcbiAqIG1lc2gudXBkYXRlKCk7XG4gKiBgYGBcbiAqXG4gKiBUaGlzIGV4YW1wbGUgZGVtb25zdHJhdGVzIHRoYXQgdmVydGV4IGF0dHJpYnV0ZXMgc3VjaCBhcyBwb3NpdGlvbiBhbmQgbm9ybWFscywgYW5kIGFsc28gaW5kaWNlc1xuICogY2FuIGJlIHByb3ZpZGVkIHVzaW5nIEFycmF5cyAoW10pIGFuZCBhbHNvIFR5cGVkIEFycmF5cyAoRmxvYXQzMkFycmF5IGFuZCBzaW1pbGFyKS4gTm90ZSB0aGF0XG4gKiB0eXBlZCBhcnJheXMgaGF2ZSBoaWdoZXIgcGVyZm9ybWFuY2UsIGFuZCBhcmUgZ2VuZXJhbGx5IHJlY29tbWVuZGVkIGZvciBwZXItZnJhbWUgb3BlcmF0aW9ucyBvclxuICogbGFyZ2VyIG1lc2hlcywgYnV0IHRoZWlyIGNvbnN0cnVjdGlvbiB1c2luZyBuZXcgb3BlcmF0b3IgaXMgY29zdGx5IG9wZXJhdGlvbi4gSWYgeW91IG9ubHkgbmVlZFxuICogdG8gb3BlcmF0ZSBvbiBhIHNtYWxsIG51bWJlciBvZiB2ZXJ0aWNlcyBvciBpbmRpY2VzLCBjb25zaWRlciB1c2luZyBBcnJheXMgdG8gYXZvaWQgdGhlIG92ZXJoZWFkXG4gKiBhc3NvY2lhdGVkIHdpdGggYWxsb2NhdGluZyBUeXBlZCBBcnJheXMuXG4gKlxuICogRm9sbG93IHRoZXNlIGxpbmtzIGZvciBtb3JlIGNvbXBsZXggZXhhbXBsZXMgc2hvd2luZyB0aGUgZnVuY3Rpb25hbGl0eS5cbiAqXG4gKiAtIHtAbGluayBodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI2dyYXBoaWNzL21lc2gtZGVjYWxzfVxuICogLSB7QGxpbmsgaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyNncmFwaGljcy9tZXNoLWRlZm9ybWF0aW9ufVxuICogLSB7QGxpbmsgaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyNncmFwaGljcy9tZXNoLWdlbmVyYXRpb259XG4gKiAtIHtAbGluayBodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI2dyYXBoaWNzL3BvaW50LWNsb3VkLXNpbXVsYXRpb259XG4gKlxuICogIyMjIFVwZGF0ZSBWZXJ0ZXggYW5kIEluZGV4IGJ1ZmZlcnNcbiAqIFRoaXMgYWxsb3dzIGdyZWF0ZXIgZmxleGliaWxpdHksIGJ1dCBpcyBtb3JlIGNvbXBsZXggdG8gdXNlLiBJdCBhbGxvd3MgbW9yZSBhZHZhbmNlZCBzZXR1cHMsIGZvclxuICogZXhhbXBsZSBzaGFyaW5nIGEgVmVydGV4IG9yIEluZGV4IEJ1ZmZlciBiZXR3ZWVuIG11bHRpcGxlIG1lc2hlcy4gU2VlIHtAbGluayBWZXJ0ZXhCdWZmZXJ9LFxuICoge0BsaW5rIEluZGV4QnVmZmVyfSBhbmQge0BsaW5rIFZlcnRleEZvcm1hdH0gZm9yIGRldGFpbHMuXG4gKi9cbmNsYXNzIE1lc2ggZXh0ZW5kcyBSZWZDb3VudGVkT2JqZWN0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTWVzaCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gW2dyYXBoaWNzRGV2aWNlXSAtXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGlzIG1lc2guIElmIGl0IGlzIG5vdCBwcm92aWRlZCwgYSBkZXZpY2UgaXMgb2J0YWluZWRcbiAgICAgKiBmcm9tIHRoZSB7QGxpbmsgQXBwbGljYXRpb259LlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuICAgICAgICBEZWJ1Zy5hc3NlcnREZXByZWNhdGVkKGdyYXBoaWNzRGV2aWNlLCBcIk1lc2ggY29uc3RydWN0b3IgdGFrZXMgYSBHcmFwaGljc0RldmljZSBhcyBhIHBhcmFtZXRlciwgYW5kIGl0IHdhcyBub3QgcHJvdmlkZWQuXCIpO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlIHx8IEdyYXBoaWNzRGV2aWNlQWNjZXNzLmdldCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdmVydGV4IGJ1ZmZlciBob2xkaW5nIHRoZSB2ZXJ0ZXggZGF0YSBvZiB0aGUgbWVzaC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlcnRleEJ1ZmZlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQW4gYXJyYXkgb2YgaW5kZXggYnVmZmVycy4gRm9yIHVuaW5kZXhlZCBtZXNoZXMsIHRoaXMgYXJyYXkgY2FuIGJlIGVtcHR5LiBUaGUgZmlyc3RcbiAgICAgICAgICogaW5kZXggYnVmZmVyIGluIHRoZSBhcnJheSBpcyB1c2VkIGJ5IHtAbGluayBNZXNoSW5zdGFuY2V9cyB3aXRoIGEgcmVuZGVyU3R5bGUgcHJvcGVydHlcbiAgICAgICAgICogc2V0IHRvIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH0uIFRoZSBzZWNvbmQgaW5kZXggYnVmZmVyIGluIHRoZSBhcnJheSBpcyB1c2VkIGlmXG4gICAgICAgICAqIHJlbmRlclN0eWxlIGlzIHNldCB0byB7QGxpbmsgUkVOREVSU1RZTEVfV0lSRUZSQU1FfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0luZGV4QnVmZmVyW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gW251bGxdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSBvZiBwcmltaXRpdmUgb2JqZWN0cyBkZWZpbmluZyBob3cgdmVydGV4IChhbmQgaW5kZXgpIGRhdGEgaW4gdGhlIG1lc2ggc2hvdWxkIGJlXG4gICAgICAgICAqIGludGVycHJldGVkIGJ5IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIC0gYHR5cGVgIGlzIHRoZSB0eXBlIG9mIHByaW1pdGl2ZSB0byByZW5kZXIuIENhbiBiZTpcbiAgICAgICAgICpcbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfUE9JTlRTfVxuICAgICAgICAgKiAgIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU31cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfTElORUxPT1B9XG4gICAgICAgICAqICAgLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTVFJJUH1cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfVFJJQU5HTEVTfVxuICAgICAgICAgKiAgIC0ge0BsaW5rIFBSSU1JVElWRV9UUklTVFJJUH1cbiAgICAgICAgICogICAtIHtAbGluayBQUklNSVRJVkVfVFJJRkFOfVxuICAgICAgICAgKlxuICAgICAgICAgKiAtIGBiYXNlYCBpcyB0aGUgb2Zmc2V0IG9mIHRoZSBmaXJzdCBpbmRleCBvciB2ZXJ0ZXggdG8gZGlzcGF0Y2ggaW4gdGhlIGRyYXcgY2FsbC5cbiAgICAgICAgICogLSBgY291bnRgIGlzIHRoZSBudW1iZXIgb2YgaW5kaWNlcyBvciB2ZXJ0aWNlcyB0byBkaXNwYXRjaCBpbiB0aGUgZHJhdyBjYWxsLlxuICAgICAgICAgKiAtIGBpbmRleGVkYCBzcGVjaWZpZXMgd2hldGhlciB0byBpbnRlcnByZXQgdGhlIHByaW1pdGl2ZSBhcyBpbmRleGVkLCB0aGVyZWJ5IHVzaW5nIHRoZVxuICAgICAgICAgKiBjdXJyZW50bHkgc2V0IGluZGV4IGJ1ZmZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0FycmF5Ljx7dHlwZTogbnVtYmVyLCBiYXNlOiBudW1iZXIsIGNvdW50OiBudW1iZXIsIGluZGV4ZWQ6IGJvb2xlYW58dW5kZWZpbmVkfT59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnByaW1pdGl2ZSA9IFt7XG4gICAgICAgICAgICB0eXBlOiAwLFxuICAgICAgICAgICAgYmFzZTogMCxcbiAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgIH1dO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2tpbiBkYXRhIChpZiBhbnkpIHRoYXQgZHJpdmVzIHNraW5uZWQgbWVzaCBhbmltYXRpb25zIGZvciB0aGlzIG1lc2guXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2tpbi5qcycpLlNraW58bnVsbH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2tpbiA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fbW9ycGggPSBudWxsO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEgPSBudWxsO1xuXG4gICAgICAgIC8vIEFBQkIgZm9yIG9iamVjdCBzcGFjZSBtZXNoIHZlcnRpY2VzXG4gICAgICAgIHRoaXMuX2FhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcblxuICAgICAgICAvLyBBcnJheSBvZiBvYmplY3Qgc3BhY2UgQUFCQnMgb2YgdmVydGljZXMgYWZmZWN0ZWQgYnkgZWFjaCBib25lXG4gICAgICAgIHRoaXMuYm9uZUFhYmIgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtb3JwaCBkYXRhIChpZiBhbnkpIHRoYXQgZHJpdmVzIG1vcnBoIHRhcmdldCBhbmltYXRpb25zIGZvciB0aGlzIG1lc2guXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21vcnBoLmpzJykuTW9ycGh8bnVsbH1cbiAgICAgKi9cbiAgICBzZXQgbW9ycGgobW9ycGgpIHtcblxuICAgICAgICBpZiAobW9ycGggIT09IHRoaXMuX21vcnBoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbW9ycGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tb3JwaC5kZWNSZWZDb3VudCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tb3JwaCA9IG1vcnBoO1xuXG4gICAgICAgICAgICBpZiAobW9ycGgpIHtcbiAgICAgICAgICAgICAgICBtb3JwaC5pbmNSZWZDb3VudCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1vcnBoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9ycGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3ggZm9yIHRoZSBvYmplY3Qgc3BhY2UgdmVydGljZXMgb2YgdGhpcyBtZXNoLlxuICAgICAqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAqL1xuICAgIHNldCBhYWJiKGFhYmIpIHtcbiAgICAgICAgdGhpcy5fYWFiYiA9IGFhYmI7XG4gICAgfVxuXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hYWJiO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHtAbGluayBWZXJ0ZXhCdWZmZXJ9IGFuZCB7QGxpbmsgSW5kZXhCdWZmZXJ9IGFzc29jaWF0ZSB3aXRoIHRoZSBtZXNoLiBUaGlzIGlzXG4gICAgICogbm9ybWFsbHkgY2FsbGVkIGJ5IHtAbGluayBNb2RlbCNkZXN0cm95fSBhbmQgZG9lcyBub3QgbmVlZCB0byBiZSBjYWxsZWQgbWFudWFsbHkuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBjb25zdCBtb3JwaCA9IHRoaXMubW9ycGg7XG4gICAgICAgIGlmIChtb3JwaCkge1xuXG4gICAgICAgICAgICAvLyB0aGlzIGRlY3JlYXNlcyByZWYgY291bnQgb24gdGhlIG1vcnBoXG4gICAgICAgICAgICB0aGlzLm1vcnBoID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSBtb3JwaFxuICAgICAgICAgICAgaWYgKG1vcnBoLnJlZkNvdW50IDwgMSkge1xuICAgICAgICAgICAgICAgIG1vcnBoLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLmluZGV4QnVmZmVyLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95SW5kZXhCdWZmZXIoaik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluZGV4QnVmZmVyLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgX2Rlc3Ryb3lJbmRleEJ1ZmZlcihpbmRleCkge1xuICAgICAgICBpZiAodGhpcy5pbmRleEJ1ZmZlcltpbmRleF0pIHtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXJbaW5kZXhdLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXJbaW5kZXhdID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluaXRpYWxpemVzIGxvY2FsIGJvdW5kaW5nIGJveGVzIGZvciBlYWNoIGJvbmUgYmFzZWQgb24gdmVydGljZXMgYWZmZWN0ZWQgYnkgdGhlIGJvbmVcbiAgICAvLyBpZiBtb3JwaCB0YXJnZXRzIGFyZSBwcm92aWRlZCwgaXQgYWxzbyBhZGp1c3RzIGxvY2FsIGJvbmUgYm91bmRpbmcgYm94ZXMgYnkgbWF4aW11bSBtb3JwaCBkaXNwbGFjZW1lbnRcbiAgICBfaW5pdEJvbmVBYWJicyhtb3JwaFRhcmdldHMpIHtcblxuICAgICAgICB0aGlzLmJvbmVBYWJiID0gW107XG4gICAgICAgIHRoaXMuYm9uZVVzZWQgPSBbXTtcbiAgICAgICAgbGV0IHgsIHksIHo7XG4gICAgICAgIGxldCBiTWF4LCBiTWluO1xuICAgICAgICBjb25zdCBib25lTWluID0gW107XG4gICAgICAgIGNvbnN0IGJvbmVNYXggPSBbXTtcbiAgICAgICAgY29uc3QgYm9uZVVzZWQgPSB0aGlzLmJvbmVVc2VkO1xuICAgICAgICBjb25zdCBudW1Cb25lcyA9IHRoaXMuc2tpbi5ib25lTmFtZXMubGVuZ3RoO1xuICAgICAgICBsZXQgbWF4TW9ycGhYLCBtYXhNb3JwaFksIG1heE1vcnBoWjtcblxuICAgICAgICAvLyBzdGFydCB3aXRoIGVtcHR5IGJvbmUgYm91bmRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQm9uZXM7IGkrKykge1xuICAgICAgICAgICAgYm9uZU1pbltpXSA9IG5ldyBWZWMzKE51bWJlci5NQVhfVkFMVUUsIE51bWJlci5NQVhfVkFMVUUsIE51bWJlci5NQVhfVkFMVUUpO1xuICAgICAgICAgICAgYm9uZU1heFtpXSA9IG5ldyBWZWMzKC1OdW1iZXIuTUFYX1ZBTFVFLCAtTnVtYmVyLk1BWF9WQUxVRSwgLU51bWJlci5NQVhfVkFMVUUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWNjZXNzIHRvIG1lc2ggZnJvbSB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gbmV3IFZlcnRleEl0ZXJhdG9yKHRoaXMudmVydGV4QnVmZmVyKTtcbiAgICAgICAgY29uc3QgcG9zRWxlbWVudCA9IGl0ZXJhdG9yLmVsZW1lbnRbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgICAgICBjb25zdCB3ZWlnaHRzRWxlbWVudCA9IGl0ZXJhdG9yLmVsZW1lbnRbU0VNQU5USUNfQkxFTkRXRUlHSFRdO1xuICAgICAgICBjb25zdCBpbmRpY2VzRWxlbWVudCA9IGl0ZXJhdG9yLmVsZW1lbnRbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXTtcblxuICAgICAgICAvLyBGaW5kIGJvbmUgQUFCQnMgb2YgYXR0YWNoZWQgdmVydGljZXNcbiAgICAgICAgY29uc3QgbnVtVmVydHMgPSB0aGlzLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1WZXJ0czsgaisrKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IDQ7IGsrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVXZWlnaHQgPSB3ZWlnaHRzRWxlbWVudC5hcnJheVt3ZWlnaHRzRWxlbWVudC5pbmRleCArIGtdO1xuICAgICAgICAgICAgICAgIGlmIChib25lV2VpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib25lSW5kZXggPSBpbmRpY2VzRWxlbWVudC5hcnJheVtpbmRpY2VzRWxlbWVudC5pbmRleCArIGtdO1xuICAgICAgICAgICAgICAgICAgICBib25lVXNlZFtib25lSW5kZXhdID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICB4ID0gcG9zRWxlbWVudC5hcnJheVtwb3NFbGVtZW50LmluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgeSA9IHBvc0VsZW1lbnQuYXJyYXlbcG9zRWxlbWVudC5pbmRleCArIDFdO1xuICAgICAgICAgICAgICAgICAgICB6ID0gcG9zRWxlbWVudC5hcnJheVtwb3NFbGVtZW50LmluZGV4ICsgMl07XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRqdXN0IGJvdW5kcyBvZiBhIGJvbmUgYnkgdGhlIHZlcnRleFxuICAgICAgICAgICAgICAgICAgICBiTWF4ID0gYm9uZU1heFtib25lSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBiTWluID0gYm9uZU1pbltib25lSW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChiTWluLnggPiB4KSBiTWluLnggPSB4O1xuICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbi55ID4geSkgYk1pbi55ID0geTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJNaW4ueiA+IHopIGJNaW4ueiA9IHo7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGJNYXgueCA8IHgpIGJNYXgueCA9IHg7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiTWF4LnkgPCB5KSBiTWF4LnkgPSB5O1xuICAgICAgICAgICAgICAgICAgICBpZiAoYk1heC56IDwgeikgYk1heC56ID0gejtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobW9ycGhUYXJnZXRzKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpbmQgbWF4aW11bSBkaXNwbGFjZW1lbnQgb2YgdGhlIHZlcnRleCBieSBhbGwgdGFyZ2V0c1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1pbk1vcnBoWCA9IG1heE1vcnBoWCA9IHg7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbWluTW9ycGhZID0gbWF4TW9ycGhZID0geTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtaW5Nb3JwaFogPSBtYXhNb3JwaFogPSB6O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtb3JwaCB0aGlzIHZlcnRleCBieSBhbGwgbW9ycGggdGFyZ2V0c1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgbCA9IDA7IGwgPCBtb3JwaFRhcmdldHMubGVuZ3RoOyBsKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBtb3JwaFRhcmdldHNbbF07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkeCA9IHRhcmdldC5kZWx0YVBvc2l0aW9uc1tqICogM107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHkgPSB0YXJnZXQuZGVsdGFQb3NpdGlvbnNbaiAqIDMgKyAxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkeiA9IHRhcmdldC5kZWx0YVBvc2l0aW9uc1tqICogMyArIDJdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGR4IDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5Nb3JwaFggKz0gZHg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4TW9ycGhYICs9IGR4O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkeSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluTW9ycGhZICs9IGR5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heE1vcnBoWSArPSBkeTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZHogPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbk1vcnBoWiArPSBkejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhNb3JwaFogKz0gZHo7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbi54ID4gbWluTW9ycGhYKSBiTWluLnggPSBtaW5Nb3JwaFg7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbi55ID4gbWluTW9ycGhZKSBiTWluLnkgPSBtaW5Nb3JwaFk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYk1pbi56ID4gbWluTW9ycGhaKSBiTWluLnogPSBtaW5Nb3JwaFo7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWF4LnggPCBtYXhNb3JwaFgpIGJNYXgueCA9IG1heE1vcnBoWDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWF4LnkgPCBtYXhNb3JwaFkpIGJNYXgueSA9IG1heE1vcnBoWTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiTWF4LnogPCBtYXhNb3JwaFopIGJNYXgueiA9IG1heE1vcnBoWjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFjY291bnQgZm9yIG5vcm1hbGl6ZWQgcG9zaXRpb25hbCBkYXRhXG4gICAgICAgIGNvbnN0IHBvc2l0aW9uRWxlbWVudCA9IHRoaXMudmVydGV4QnVmZmVyLmdldEZvcm1hdCgpLmVsZW1lbnRzLmZpbmQoZSA9PiBlLm5hbWUgPT09IFNFTUFOVElDX1BPU0lUSU9OKTtcbiAgICAgICAgaWYgKHBvc2l0aW9uRWxlbWVudCAmJiBwb3NpdGlvbkVsZW1lbnQubm9ybWFsaXplKSB7XG4gICAgICAgICAgICBjb25zdCBmdW5jID0gKCgpID0+IHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHBvc2l0aW9uRWxlbWVudC5kYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRZUEVfSU5UODogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDEyNy4wLCAtMS4wKTtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OiByZXR1cm4geCA9PiB4IC8gMjU1LjA7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9JTlQxNjogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDMyNzY3LjAsIC0xLjApO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDE2OiByZXR1cm4geCA9PiB4IC8gNjU1MzUuMDtcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogcmV0dXJuIHggPT4geDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUJvbmVzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoYm9uZVVzZWRbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWluID0gYm9uZU1pbltpXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF4ID0gYm9uZU1heFtpXTtcbiAgICAgICAgICAgICAgICAgICAgbWluLnNldChmdW5jKG1pbi54KSwgZnVuYyhtaW4ueSksIGZ1bmMobWluLnopKTtcbiAgICAgICAgICAgICAgICAgICAgbWF4LnNldChmdW5jKG1heC54KSwgZnVuYyhtYXgueSksIGZ1bmMobWF4LnopKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSBib25lIGJvdW5kaW5nIGJveGVzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQm9uZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICAgICAgYWFiYi5zZXRNaW5NYXgoYm9uZU1pbltpXSwgYm9uZU1heFtpXSk7XG4gICAgICAgICAgICB0aGlzLmJvbmVBYWJiLnB1c2goYWFiYik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3aGVuIG1lc2ggQVBJIHRvIG1vZGlmeSB2ZXJ0ZXggLyBpbmRleCBkYXRhIGFyZSB1c2VkLCB0aGlzIGFsbG9jYXRlcyBzdHJ1Y3R1cmUgdG8gc3RvcmUgdGhlIGRhdGFcbiAgICBfaW5pdEdlb21ldHJ5RGF0YSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9nZW9tZXRyeURhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YSA9IG5ldyBHZW9tZXRyeURhdGEoKTtcblxuICAgICAgICAgICAgLy8gaWYgdmVydGV4IGJ1ZmZlciBleGlzdHMgYWxyZWFkeSwgc3RvcmUgdGhlIHNpemVzXG4gICAgICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4Q291bnQgPSB0aGlzLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEubWF4VmVydGljZXMgPSB0aGlzLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgaW5kZXggYnVmZmVyIGV4aXN0cyBhbHJlYWR5LCBzdG9yZSB0aGUgc2l6ZXNcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4QnVmZmVyLmxlbmd0aCA+IDAgJiYgdGhpcy5pbmRleEJ1ZmZlclswXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50ID0gdGhpcy5pbmRleEJ1ZmZlclswXS5udW1JbmRpY2VzO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhJbmRpY2VzID0gdGhpcy5pbmRleEJ1ZmZlclswXS5udW1JbmRpY2VzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBtZXNoIG9mIGV4aXN0aW5nIHZlcnRpY2VzIGFuZCBpbmRpY2VzIGFuZCByZXNldHMgdGhlIHtAbGluayBWZXJ0ZXhGb3JtYXR9XG4gICAgICogYXNzb2NpYXRlZCB3aXRoIHRoZSBtZXNoLiBUaGlzIGNhbGwgaXMgdHlwaWNhbGx5IGZvbGxvd2VkIGJ5IGNhbGxzIHRvIG1ldGhvZHMgc3VjaCBhc1xuICAgICAqIHtAbGluayBNZXNoI3NldFBvc2l0aW9uc30sIHtAbGluayBNZXNoI3NldFZlcnRleFN0cmVhbX0gb3Ige0BsaW5rIE1lc2gjc2V0SW5kaWNlc30gYW5kXG4gICAgICogZmluYWxseSB7QGxpbmsgTWVzaCN1cGRhdGV9IHRvIHJlYnVpbGQgdGhlIG1lc2gsIGFsbG93aW5nIGRpZmZlcmVudCB7QGxpbmsgVmVydGV4Rm9ybWF0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3ZlcnRpY2VzRHluYW1pY10gLSBJbmRpY2F0ZXMgdGhlIHtAbGluayBWZXJ0ZXhCdWZmZXJ9IHNob3VsZCBiZSBjcmVhdGVkXG4gICAgICogd2l0aCB7QGxpbmsgQlVGRkVSX0RZTkFNSUN9IHVzYWdlLiBJZiBub3Qgc3BlY2lmaWVkLCB7QGxpbmsgQlVGRkVSX1NUQVRJQ30gaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtpbmRpY2VzRHluYW1pY10gLSBJbmRpY2F0ZXMgdGhlIHtAbGluayBJbmRleEJ1ZmZlcn0gc2hvdWxkIGJlIGNyZWF0ZWQgd2l0aFxuICAgICAqIHtAbGluayBCVUZGRVJfRFlOQU1JQ30gdXNhZ2UuIElmIG5vdCBzcGVjaWZpZWQsIHtAbGluayBCVUZGRVJfU1RBVElDfSBpcyB1c2VkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWF4VmVydGljZXNdIC0gQSB7QGxpbmsgVmVydGV4QnVmZmVyfSB3aWxsIGJlIGFsbG9jYXRlZCB3aXRoIGF0IGxlYXN0XG4gICAgICogbWF4VmVydGljZXMsIGFsbG93aW5nIGFkZGl0aW9uYWwgdmVydGljZXMgdG8gYmUgYWRkZWQgdG8gaXQgd2l0aG91dCB0aGUgYWxsb2NhdGlvbi4gSWYgbm9cbiAgICAgKiB2YWx1ZSBpcyBwcm92aWRlZCwgYSBzaXplIHRvIGZpdCB0aGUgcHJvdmlkZWQgdmVydGljZXMgd2lsbCBiZSBhbGxvY2F0ZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttYXhJbmRpY2VzXSAtIEFuIHtAbGluayBJbmRleEJ1ZmZlcn0gd2lsbCBiZSBhbGxvY2F0ZWQgd2l0aCBhdCBsZWFzdFxuICAgICAqIG1heEluZGljZXMsIGFsbG93aW5nIGFkZGl0aW9uYWwgaW5kaWNlcyB0byBiZSBhZGRlZCB0byBpdCB3aXRob3V0IHRoZSBhbGxvY2F0aW9uLiBJZiBub1xuICAgICAqIHZhbHVlIGlzIHByb3ZpZGVkLCBhIHNpemUgdG8gZml0IHRoZSBwcm92aWRlZCBpbmRpY2VzIHdpbGwgYmUgYWxsb2NhdGVkLlxuICAgICAqL1xuICAgIGNsZWFyKHZlcnRpY2VzRHluYW1pYywgaW5kaWNlc0R5bmFtaWMsIG1heFZlcnRpY2VzID0gMCwgbWF4SW5kaWNlcyA9IDApIHtcbiAgICAgICAgdGhpcy5faW5pdEdlb21ldHJ5RGF0YSgpO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5pdERlZmF1bHRzKCk7XG5cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnJlY3JlYXRlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLm1heFZlcnRpY2VzID0gbWF4VmVydGljZXM7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhJbmRpY2VzID0gbWF4SW5kaWNlcztcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRpY2VzVXNhZ2UgPSB2ZXJ0aWNlc0R5bmFtaWMgPyBCVUZGRVJfU1RBVElDIDogQlVGRkVSX0RZTkFNSUM7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRpY2VzVXNhZ2UgPSBpbmRpY2VzRHluYW1pYyA/IEJVRkZFUl9TVEFUSUMgOiBCVUZGRVJfRFlOQU1JQztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2ZXJ0ZXggZGF0YSBmb3IgYW55IHN1cHBvcnRlZCBzZW1hbnRpYy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZW1hbnRpYyAtIFRoZSBtZWFuaW5nIG9mIHRoZSB2ZXJ0ZXggZWxlbWVudC4gRm9yIHN1cHBvcnRlZCBzZW1hbnRpY3MsIHNlZVxuICAgICAqIFNFTUFOVElDXyogaW4ge0BsaW5rIFZlcnRleEZvcm1hdH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBkYXRhIC0gVmVydGV4XG4gICAgICogZGF0YSBmb3IgdGhlIHNwZWNpZmllZCBzZW1hbnRpYy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY29tcG9uZW50Q291bnQgLSBUaGUgbnVtYmVyIG9mIHZhbHVlcyB0aGF0IGZvcm0gYSBzaW5nbGUgVmVydGV4IGVsZW1lbnQuIEZvclxuICAgICAqIGV4YW1wbGUgd2hlbiBzZXR0aW5nIGEgM0QgcG9zaXRpb24gcmVwcmVzZW50ZWQgYnkgMyBudW1iZXJzIHBlciB2ZXJ0ZXgsIG51bWJlciAzIHNob3VsZCBiZVxuICAgICAqIHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bVZlcnRpY2VzXSAtIFRoZSBudW1iZXIgb2YgdmVydGljZXMgdG8gYmUgdXNlZCBmcm9tIGRhdGEgYXJyYXkuIElmIG5vdFxuICAgICAqIHByb3ZpZGVkLCB0aGUgd2hvbGUgZGF0YSBhcnJheSBpcyB1c2VkLiBUaGlzIGFsbG93cyB0byB1c2Ugb25seSBwYXJ0IG9mIHRoZSBkYXRhIGFycmF5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZGF0YVR5cGVdIC0gVGhlIGZvcm1hdCBvZiBkYXRhIHdoZW4gc3RvcmVkIGluIHRoZSB7QGxpbmsgVmVydGV4QnVmZmVyfSwgc2VlXG4gICAgICogVFlQRV8qIGluIHtAbGluayBWZXJ0ZXhGb3JtYXR9LiBXaGVuIG5vdCBzcGVjaWZpZWQsIHtAbGluayBUWVBFX0ZMT0FUMzJ9IGlzIHVzZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGF0YVR5cGVOb3JtYWxpemVdIC0gSWYgdHJ1ZSwgdmVydGV4IGF0dHJpYnV0ZSBkYXRhIHdpbGwgYmUgbWFwcGVkIGZyb20gYVxuICAgICAqIDAgdG8gMjU1IHJhbmdlIGRvd24gdG8gMCB0byAxIHdoZW4gZmVkIHRvIGEgc2hhZGVyLiBJZiBmYWxzZSwgdmVydGV4IGF0dHJpYnV0ZSBkYXRhIGlzIGxlZnRcbiAgICAgKiB1bmNoYW5nZWQuIElmIHRoaXMgcHJvcGVydHkgaXMgdW5zcGVjaWZpZWQsIGZhbHNlIGlzIGFzc3VtZWQuXG4gICAgICovXG4gICAgc2V0VmVydGV4U3RyZWFtKHNlbWFudGljLCBkYXRhLCBjb21wb25lbnRDb3VudCwgbnVtVmVydGljZXMsIGRhdGFUeXBlID0gVFlQRV9GTE9BVDMyLCBkYXRhVHlwZU5vcm1hbGl6ZSA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuX2luaXRHZW9tZXRyeURhdGEoKTtcbiAgICAgICAgY29uc3QgdmVydGV4Q291bnQgPSBudW1WZXJ0aWNlcyB8fCBkYXRhLmxlbmd0aCAvIGNvbXBvbmVudENvdW50O1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuX2NoYW5nZVZlcnRleENvdW50KHZlcnRleENvdW50LCBzZW1hbnRpYyk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1zVXBkYXRlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnlbc2VtYW50aWNdID0gbmV3IEdlb21ldHJ5VmVydGV4U3RyZWFtKFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIGNvbXBvbmVudENvdW50LFxuICAgICAgICAgICAgZGF0YVR5cGUsXG4gICAgICAgICAgICBkYXRhVHlwZU5vcm1hbGl6ZVxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZlcnRleCBkYXRhIGNvcnJlc3BvbmRpbmcgdG8gYSBzZW1hbnRpYy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZW1hbnRpYyAtIFRoZSBzZW1hbnRpYyBvZiB0aGUgdmVydGV4IGVsZW1lbnQgdG8gZ2V0LiBGb3Igc3VwcG9ydGVkXG4gICAgICogc2VtYW50aWNzLCBzZWUgU0VNQU5USUNfKiBpbiB7QGxpbmsgVmVydGV4Rm9ybWF0fS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IGRhdGEgLSBBblxuICAgICAqIGFycmF5IHRvIHBvcHVsYXRlIHdpdGggdGhlIHZlcnRleCBkYXRhLiBXaGVuIHR5cGVkIGFycmF5IGlzIHN1cHBsaWVkLCBlbm91Z2ggc3BhY2UgbmVlZHMgdG9cbiAgICAgKiBiZSByZXNlcnZlZCwgb3RoZXJ3aXNlIG9ubHkgcGFydGlhbCBkYXRhIGlzIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgdmVydGljZXMgcG9wdWxhdGVkLlxuICAgICAqL1xuICAgIGdldFZlcnRleFN0cmVhbShzZW1hbnRpYywgZGF0YSkge1xuICAgICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgICBsZXQgZG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHNlZSBpZiB3ZSBoYXZlIHVuLWFwcGxpZWQgc3RyZWFtXG4gICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0cmVhbSA9IHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5W3NlbWFudGljXTtcbiAgICAgICAgICAgIGlmIChzdHJlYW0pIHtcbiAgICAgICAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb3VudCA9IHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhDb3VudDtcblxuICAgICAgICAgICAgICAgIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVzdGluYXRpb24gZGF0YSBpcyB0eXBlZCBhcnJheVxuICAgICAgICAgICAgICAgICAgICBkYXRhLnNldChzdHJlYW0uZGF0YSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVzdGluYXRpb24gZGF0YSBpcyBhcnJheVxuICAgICAgICAgICAgICAgICAgICBkYXRhLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEucHVzaChzdHJlYW0uZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkb25lKSB7XG4gICAgICAgICAgICAvLyBnZXQgc3RyZWFtIGZyb20gVmVydGV4QnVmZmVyXG4gICAgICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiB0aGVyZSBpcyBubyBuZWVkIHRvIC5lbmQgdGhlIGl0ZXJhdG9yLCBhcyB3ZSBhcmUgb25seSByZWFkaW5nIGRhdGEgZnJvbSBpdFxuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gbmV3IFZlcnRleEl0ZXJhdG9yKHRoaXMudmVydGV4QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBjb3VudCA9IGl0ZXJhdG9yLnJlYWREYXRhKHNlbWFudGljLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb3VudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2ZXJ0ZXggcG9zaXRpb25zIGFycmF5LiBWZXJ0aWNlcyBhcmUgc3RvcmVkIHVzaW5nIHtAbGluayBUWVBFX0ZMT0FUMzJ9IGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gcG9zaXRpb25zIC0gVmVydGV4XG4gICAgICogZGF0YSBjb250YWluaW5nIHBvc2l0aW9ucy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2NvbXBvbmVudENvdW50XSAtIFRoZSBudW1iZXIgb2YgdmFsdWVzIHRoYXQgZm9ybSBhIHNpbmdsZSBwb3NpdGlvbiBlbGVtZW50LlxuICAgICAqIERlZmF1bHRzIHRvIDMgaWYgbm90IHNwZWNpZmllZCwgY29ycmVzcG9uZGluZyB0byB4LCB5IGFuZCB6IGNvb3JkaW5hdGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtVmVydGljZXNdIC0gVGhlIG51bWJlciBvZiB2ZXJ0aWNlcyB0byBiZSB1c2VkIGZyb20gZGF0YSBhcnJheS4gSWYgbm90XG4gICAgICogcHJvdmlkZWQsIHRoZSB3aG9sZSBkYXRhIGFycmF5IGlzIHVzZWQuIFRoaXMgYWxsb3dzIHRvIHVzZSBvbmx5IHBhcnQgb2YgdGhlIGRhdGEgYXJyYXkuXG4gICAgICovXG4gICAgc2V0UG9zaXRpb25zKHBvc2l0aW9ucywgY29tcG9uZW50Q291bnQgPSBHZW9tZXRyeURhdGEuREVGQVVMVF9DT01QT05FTlRTX1BPU0lUSU9OLCBudW1WZXJ0aWNlcykge1xuICAgICAgICB0aGlzLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19QT1NJVElPTiwgcG9zaXRpb25zLCBjb21wb25lbnRDb3VudCwgbnVtVmVydGljZXMsIFRZUEVfRkxPQVQzMiwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZlcnRleCBub3JtYWxzIGFycmF5LiBOb3JtYWxzIGFyZSBzdG9yZWQgdXNpbmcge0BsaW5rIFRZUEVfRkxPQVQzMn0gZm9ybWF0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBub3JtYWxzIC0gVmVydGV4XG4gICAgICogZGF0YSBjb250YWluaW5nIG5vcm1hbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtjb21wb25lbnRDb3VudF0gLSBUaGUgbnVtYmVyIG9mIHZhbHVlcyB0aGF0IGZvcm0gYSBzaW5nbGUgbm9ybWFsIGVsZW1lbnQuXG4gICAgICogRGVmYXVsdHMgdG8gMyBpZiBub3Qgc3BlY2lmaWVkLCBjb3JyZXNwb25kaW5nIHRvIHgsIHkgYW5kIHogZGlyZWN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtVmVydGljZXNdIC0gVGhlIG51bWJlciBvZiB2ZXJ0aWNlcyB0byBiZSB1c2VkIGZyb20gZGF0YSBhcnJheS4gSWYgbm90XG4gICAgICogcHJvdmlkZWQsIHRoZSB3aG9sZSBkYXRhIGFycmF5IGlzIHVzZWQuIFRoaXMgYWxsb3dzIHRvIHVzZSBvbmx5IHBhcnQgb2YgdGhlIGRhdGEgYXJyYXkuXG4gICAgICovXG4gICAgc2V0Tm9ybWFscyhub3JtYWxzLCBjb21wb25lbnRDb3VudCA9IEdlb21ldHJ5RGF0YS5ERUZBVUxUX0NPTVBPTkVOVFNfTk9STUFMLCBudW1WZXJ0aWNlcykge1xuICAgICAgICB0aGlzLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19OT1JNQUwsIG5vcm1hbHMsIGNvbXBvbmVudENvdW50LCBudW1WZXJ0aWNlcywgVFlQRV9GTE9BVDMyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmVydGV4IHV2IGFycmF5LiBVdnMgYXJlIHN0b3JlZCB1c2luZyB7QGxpbmsgVFlQRV9GTE9BVDMyfSBmb3JtYXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2hhbm5lbCAtIFRoZSB1diBjaGFubmVsIGluIFswLi43XSByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IHV2cyAtIFZlcnRleFxuICAgICAqIGRhdGEgY29udGFpbmluZyB1di1jb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2NvbXBvbmVudENvdW50XSAtIFRoZSBudW1iZXIgb2YgdmFsdWVzIHRoYXQgZm9ybSBhIHNpbmdsZSB1diBlbGVtZW50LlxuICAgICAqIERlZmF1bHRzIHRvIDIgaWYgbm90IHNwZWNpZmllZCwgY29ycmVzcG9uZGluZyB0byB1IGFuZCB2IGNvb3JkaW5hdGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtVmVydGljZXNdIC0gVGhlIG51bWJlciBvZiB2ZXJ0aWNlcyB0byBiZSB1c2VkIGZyb20gZGF0YSBhcnJheS4gSWYgbm90XG4gICAgICogcHJvdmlkZWQsIHRoZSB3aG9sZSBkYXRhIGFycmF5IGlzIHVzZWQuIFRoaXMgYWxsb3dzIHRvIHVzZSBvbmx5IHBhcnQgb2YgdGhlIGRhdGEgYXJyYXkuXG4gICAgICovXG4gICAgc2V0VXZzKGNoYW5uZWwsIHV2cywgY29tcG9uZW50Q291bnQgPSBHZW9tZXRyeURhdGEuREVGQVVMVF9DT01QT05FTlRTX1VWLCBudW1WZXJ0aWNlcykge1xuICAgICAgICB0aGlzLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19URVhDT09SRCArIGNoYW5uZWwsIHV2cywgY29tcG9uZW50Q291bnQsIG51bVZlcnRpY2VzLCBUWVBFX0ZMT0FUMzIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2ZXJ0ZXggY29sb3IgYXJyYXkuIENvbG9ycyBhcmUgc3RvcmVkIHVzaW5nIHtAbGluayBUWVBFX0ZMT0FUMzJ9IGZvcm1hdCwgd2hpY2ggaXNcbiAgICAgKiB1c2VmdWwgZm9yIEhEUiBjb2xvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IGNvbG9ycyAtIFZlcnRleFxuICAgICAqIGRhdGEgY29udGFpbmluZyBjb2xvcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtjb21wb25lbnRDb3VudF0gLSBUaGUgbnVtYmVyIG9mIHZhbHVlcyB0aGF0IGZvcm0gYSBzaW5nbGUgY29sb3IgZWxlbWVudC5cbiAgICAgKiBEZWZhdWx0cyB0byA0IGlmIG5vdCBzcGVjaWZpZWQsIGNvcnJlc3BvbmRpbmcgdG8gciwgZywgYiBhbmQgYS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bVZlcnRpY2VzXSAtIFRoZSBudW1iZXIgb2YgdmVydGljZXMgdG8gYmUgdXNlZCBmcm9tIGRhdGEgYXJyYXkuIElmIG5vdFxuICAgICAqIHByb3ZpZGVkLCB0aGUgd2hvbGUgZGF0YSBhcnJheSBpcyB1c2VkLiBUaGlzIGFsbG93cyB0byB1c2Ugb25seSBwYXJ0IG9mIHRoZSBkYXRhIGFycmF5LlxuICAgICAqL1xuICAgIHNldENvbG9ycyhjb2xvcnMsIGNvbXBvbmVudENvdW50ID0gR2VvbWV0cnlEYXRhLkRFRkFVTFRfQ09NUE9ORU5UU19DT0xPUlMsIG51bVZlcnRpY2VzKSB7XG4gICAgICAgIHRoaXMuc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX0NPTE9SLCBjb2xvcnMsIGNvbXBvbmVudENvdW50LCBudW1WZXJ0aWNlcywgVFlQRV9GTE9BVDMyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmVydGV4IGNvbG9yIGFycmF5LiBDb2xvcnMgYXJlIHN0b3JlZCB1c2luZyB7QGxpbmsgVFlQRV9VSU5UOH0gZm9ybWF0LCB3aGljaCBpc1xuICAgICAqIHVzZWZ1bCBmb3IgTERSIGNvbG9ycy4gVmFsdWVzIGluIHRoZSBhcnJheSBhcmUgZXhwZWN0ZWQgaW4gWzAuLjI1NV0gcmFuZ2UsIGFuZCBhcmUgbWFwcGVkIHRvXG4gICAgICogWzAuLjFdIHJhbmdlIGluIHRoZSBzaGFkZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IGNvbG9ycyAtIFZlcnRleFxuICAgICAqIGRhdGEgY29udGFpbmluZyBjb2xvcnMuIFRoZSBhcnJheSBpcyBleHBlY3RlZCB0byBjb250YWluIDQgY29tcG9uZW50cyBwZXIgdmVydGV4LFxuICAgICAqIGNvcnJlc3BvbmRpbmcgdG8gciwgZywgYiBhbmQgYS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bVZlcnRpY2VzXSAtIFRoZSBudW1iZXIgb2YgdmVydGljZXMgdG8gYmUgdXNlZCBmcm9tIGRhdGEgYXJyYXkuIElmIG5vdFxuICAgICAqIHByb3ZpZGVkLCB0aGUgd2hvbGUgZGF0YSBhcnJheSBpcyB1c2VkLiBUaGlzIGFsbG93cyB0byB1c2Ugb25seSBwYXJ0IG9mIHRoZSBkYXRhIGFycmF5LlxuICAgICAqL1xuICAgIHNldENvbG9yczMyKGNvbG9ycywgbnVtVmVydGljZXMpIHtcbiAgICAgICAgdGhpcy5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQ09MT1IsIGNvbG9ycywgR2VvbWV0cnlEYXRhLkRFRkFVTFRfQ09NUE9ORU5UU19DT0xPUlMsIG51bVZlcnRpY2VzLCBUWVBFX1VJTlQ4LCB0cnVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBpbmRleCBhcnJheS4gSW5kaWNlcyBhcmUgc3RvcmVkIHVzaW5nIDE2LWJpdCBmb3JtYXQgYnkgZGVmYXVsdCwgdW5sZXNzIG1vcmUgdGhhblxuICAgICAqIDY1NTM1IHZlcnRpY2VzIGFyZSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2UgMzItYml0IGZvcm1hdCBpcyB1c2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxVaW50OEFycmF5fFVpbnQxNkFycmF5fFVpbnQzMkFycmF5fSBpbmRpY2VzIC0gVGhlIGFycmF5IG9mIGluZGljZXMgdGhhdFxuICAgICAqIGRlZmluZSBwcmltaXRpdmVzIChsaW5lcywgdHJpYW5nbGVzLCBldGMuKS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bUluZGljZXNdIC0gVGhlIG51bWJlciBvZiBpbmRpY2VzIHRvIGJlIHVzZWQgZnJvbSBkYXRhIGFycmF5LiBJZiBub3RcbiAgICAgKiBwcm92aWRlZCwgdGhlIHdob2xlIGRhdGEgYXJyYXkgaXMgdXNlZC4gVGhpcyBhbGxvd3MgdG8gdXNlIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBhcnJheS5cbiAgICAgKi9cbiAgICBzZXRJbmRpY2VzKGluZGljZXMsIG51bUluZGljZXMpIHtcbiAgICAgICAgdGhpcy5faW5pdEdlb21ldHJ5RGF0YSgpO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhTdHJlYW1VcGRhdGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXMgPSBpbmRpY2VzO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhDb3VudCA9IG51bUluZGljZXMgfHwgaW5kaWNlcy5sZW5ndGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdmVydGV4IHBvc2l0aW9ucyBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBwb3NpdGlvbnMgLSBBblxuICAgICAqIGFycmF5IHRvIHBvcHVsYXRlIHdpdGggdGhlIHZlcnRleCBkYXRhLiBXaGVuIHR5cGVkIGFycmF5IGlzIHN1cHBsaWVkLCBlbm91Z2ggc3BhY2UgbmVlZHMgdG9cbiAgICAgKiBiZSByZXNlcnZlZCwgb3RoZXJ3aXNlIG9ubHkgcGFydGlhbCBkYXRhIGlzIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgdmVydGljZXMgcG9wdWxhdGVkLlxuICAgICAqL1xuICAgIGdldFBvc2l0aW9ucyhwb3NpdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX1BPU0lUSU9OLCBwb3NpdGlvbnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZlcnRleCBub3JtYWxzIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IG5vcm1hbHMgLSBBblxuICAgICAqIGFycmF5IHRvIHBvcHVsYXRlIHdpdGggdGhlIHZlcnRleCBkYXRhLiBXaGVuIHR5cGVkIGFycmF5IGlzIHN1cHBsaWVkLCBlbm91Z2ggc3BhY2UgbmVlZHMgdG9cbiAgICAgKiBiZSByZXNlcnZlZCwgb3RoZXJ3aXNlIG9ubHkgcGFydGlhbCBkYXRhIGlzIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgdmVydGljZXMgcG9wdWxhdGVkLlxuICAgICAqL1xuICAgIGdldE5vcm1hbHMobm9ybWFscykge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfTk9STUFMLCBub3JtYWxzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB2ZXJ0ZXggdXYgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjaGFubmVsIC0gVGhlIHV2IGNoYW5uZWwgaW4gWzAuLjddIHJhbmdlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gdXZzIC0gQW5cbiAgICAgKiBhcnJheSB0byBwb3B1bGF0ZSB3aXRoIHRoZSB2ZXJ0ZXggZGF0YS4gV2hlbiB0eXBlZCBhcnJheSBpcyBzdXBwbGllZCwgZW5vdWdoIHNwYWNlIG5lZWRzIHRvXG4gICAgICogYmUgcmVzZXJ2ZWQsIG90aGVyd2lzZSBvbmx5IHBhcnRpYWwgZGF0YSBpcyBjb3BpZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyIG9mIHZlcnRpY2VzIHBvcHVsYXRlZC5cbiAgICAgKi9cbiAgICBnZXRVdnMoY2hhbm5lbCwgdXZzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZlcnRleFN0cmVhbShTRU1BTlRJQ19URVhDT09SRCArIGNoYW5uZWwsIHV2cyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdmVydGV4IGNvbG9yIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IGNvbG9ycyAtIEFuXG4gICAgICogYXJyYXkgdG8gcG9wdWxhdGUgd2l0aCB0aGUgdmVydGV4IGRhdGEuIFdoZW4gdHlwZWQgYXJyYXkgaXMgc3VwcGxpZWQsIGVub3VnaCBzcGFjZSBuZWVkcyB0b1xuICAgICAqIGJlIHJlc2VydmVkLCBvdGhlcndpc2Ugb25seSBwYXJ0aWFsIGRhdGEgaXMgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlciBvZiB2ZXJ0aWNlcyBwb3B1bGF0ZWQuXG4gICAgICovXG4gICAgZ2V0Q29sb3JzKGNvbG9ycykge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQ09MT1IsIGNvbG9ycyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgaW5kZXggZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118VWludDhBcnJheXxVaW50MTZBcnJheXxVaW50MzJBcnJheX0gaW5kaWNlcyAtIEFuIGFycmF5IHRvIHBvcHVsYXRlIHdpdGggdGhlXG4gICAgICogaW5kZXggZGF0YS4gV2hlbiBhIHR5cGVkIGFycmF5IGlzIHN1cHBsaWVkLCBlbm91Z2ggc3BhY2UgbmVlZHMgdG8gYmUgcmVzZXJ2ZWQsIG90aGVyd2lzZVxuICAgICAqIG9ubHkgcGFydGlhbCBkYXRhIGlzIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgaW5kaWNlcyBwb3B1bGF0ZWQuXG4gICAgICovXG4gICAgZ2V0SW5kaWNlcyhpbmRpY2VzKSB7XG4gICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgLy8gc2VlIGlmIHdlIGhhdmUgdW4tYXBwbGllZCBpbmRpY2VzXG4gICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEgJiYgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0cmVhbUluZGljZXMgPSB0aGlzLl9nZW9tZXRyeURhdGEuaW5kaWNlcztcbiAgICAgICAgICAgIGNvdW50ID0gdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQ7XG5cbiAgICAgICAgICAgIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoaW5kaWNlcykpIHtcbiAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbiBkYXRhIGlzIHR5cGVkIGFycmF5XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5zZXQoc3RyZWFtSW5kaWNlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uIGRhdGEgaXMgYXJyYXlcbiAgICAgICAgICAgICAgICBpbmRpY2VzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHN0cmVhbUluZGljZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZ2V0IGRhdGEgZnJvbSBJbmRleEJ1ZmZlclxuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoID4gMCAmJiB0aGlzLmluZGV4QnVmZmVyWzBdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSB0aGlzLmluZGV4QnVmZmVyWzBdO1xuICAgICAgICAgICAgICAgIGNvdW50ID0gaW5kZXhCdWZmZXIucmVhZERhdGEoaW5kaWNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY291bnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbGllcyBhbnkgY2hhbmdlcyB0byB2ZXJ0ZXggc3RyZWFtIGFuZCBpbmRpY2VzIHRvIG1lc2guIFRoaXMgYWxsb2NhdGVzIG9yIHJlYWxsb2NhdGVzXG4gICAgICoge0BsaW5rIHZlcnRleEJ1ZmZlcn0gb3Ige0BsaW5rIEluZGV4QnVmZmVyfSB0byBmaXQgYWxsIHByb3ZpZGVkIHZlcnRpY2VzIGFuZCBpbmRpY2VzLCBhbmRcbiAgICAgKiBmaWxscyB0aGVtIHdpdGggZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHJpbWl0aXZlVHlwZV0gLSBUaGUgdHlwZSBvZiBwcmltaXRpdmUgdG8gcmVuZGVyLiAgQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1BPSU5UU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVMT09QfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUZBTn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBQUklNSVRJVkVfVFJJQU5HTEVTfSBpZiB1bnNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFt1cGRhdGVCb3VuZGluZ0JveF0gLSBUcnVlIHRvIHVwZGF0ZSBib3VuZGluZyBib3guIEJvdW5kaW5nIGJveCBpcyB1cGRhdGVkXG4gICAgICogb25seSBpZiBwb3NpdGlvbnMgd2VyZSBzZXQgc2luY2UgbGFzdCB0aW1lIHVwZGF0ZSB3YXMgY2FsbGVkLCBhbmQgY29tcG9uZW50Q291bnQgZm9yXG4gICAgICogcG9zaXRpb24gd2FzIDMsIG90aGVyd2lzZSBib3VuZGluZyBib3ggaXMgbm90IHVwZGF0ZWQuIFNlZSB7QGxpbmsgTWVzaCNzZXRQb3NpdGlvbnN9LlxuICAgICAqIERlZmF1bHRzIHRvIHRydWUgaWYgdW5zcGVjaWZpZWQuIFNldCB0aGlzIHRvIGZhbHNlIHRvIGF2b2lkIHVwZGF0ZSBvZiB0aGUgYm91bmRpbmcgYm94IGFuZFxuICAgICAqIHVzZSBhYWJiIHByb3BlcnR5IHRvIHNldCBpdCBpbnN0ZWFkLlxuICAgICAqL1xuICAgIHVwZGF0ZShwcmltaXRpdmVUeXBlID0gUFJJTUlUSVZFX1RSSUFOR0xFUywgdXBkYXRlQm91bmRpbmdCb3ggPSB0cnVlKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJ5RGF0YSkge1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgYm91bmRpbmcgYm94IGlmIG5lZWRlZFxuICAgICAgICAgICAgaWYgKHVwZGF0ZUJvdW5kaW5nQm94KSB7XG5cbiAgICAgICAgICAgICAgICAvLyBmaW5kIHZlYzMgcG9zaXRpb24gc3RyZWFtXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RyZWFtID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnlbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgICAgICAgICAgICAgIGlmIChzdHJlYW0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0cmVhbS5jb21wb25lbnRDb3VudCA9PT0gMykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWFiYi5jb21wdXRlKHN0cmVhbS5kYXRhLCB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4Q291bnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZXN0cm95IHZlcnRleCBidWZmZXIgaWYgcmVjcmVhdGUgd2FzIHJlcXVlc3RlZCBvciBpZiB2ZXJ0aWNlcyBkb24ndCBmaXRcbiAgICAgICAgICAgIGxldCBkZXN0cm95VkIgPSB0aGlzLl9nZW9tZXRyeURhdGEucmVjcmVhdGU7XG4gICAgICAgICAgICBpZiAodGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50ID4gdGhpcy5fZ2VvbWV0cnlEYXRhLm1heFZlcnRpY2VzKSB7XG4gICAgICAgICAgICAgICAgZGVzdHJveVZCID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEubWF4VmVydGljZXMgPSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4Q291bnQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXN0cm95VkIpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZXN0cm95IGluZGV4IGJ1ZmZlciBpZiByZWNyZWF0ZSB3YXMgcmVxdWVzdGVkIG9yIGlmIGluZGljZXMgZG9uJ3QgZml0XG4gICAgICAgICAgICBsZXQgZGVzdHJveUlCID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnJlY3JlYXRlO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleENvdW50ID4gdGhpcy5fZ2VvbWV0cnlEYXRhLm1heEluZGljZXMpIHtcbiAgICAgICAgICAgICAgICBkZXN0cm95SUIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5tYXhJbmRpY2VzID0gdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXN0cm95SUIpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pbmRleEJ1ZmZlci5sZW5ndGggPiAwICYmIHRoaXMuaW5kZXhCdWZmZXJbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlclswXS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXJbMF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIHZlcnRpY2VzIGlmIG5lZWRlZFxuICAgICAgICAgICAgaWYgKHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1zVXBkYXRlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVZlcnRleEJ1ZmZlcigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgaW5kaWNlcyBpZiBuZWVkZWRcbiAgICAgICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhTdHJlYW1VcGRhdGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlSW5kZXhCdWZmZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IHVwIHByaW1pdGl2ZSBwYXJhbWV0ZXJzXG4gICAgICAgICAgICB0aGlzLnByaW1pdGl2ZVswXS50eXBlID0gcHJpbWl0aXZlVHlwZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoID4gMCAmJiB0aGlzLmluZGV4QnVmZmVyWzBdKSB7ICAgICAgLy8gaW5kZXhlZFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhTdHJlYW1VcGRhdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJpbWl0aXZlWzBdLmNvdW50ID0gdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7ICAgICAgICAvLyBub24taW5kZXhlZFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtc1VwZGF0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmltaXRpdmVbMF0uY291bnQgPSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4Q291bnQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvdW50cyBjYW4gYmUgY2hhbmdlZCBvbiBuZXh0IGZyYW1lLCBzbyBzZXQgdGhlbSB0byAwXG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4Q291bnQgPSAwO1xuICAgICAgICAgICAgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGV4Q291bnQgPSAwO1xuXG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtc1VwZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5pbmRleFN0cmVhbVVwZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2dlb21ldHJ5RGF0YS5yZWNyZWF0ZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgb3RoZXIgcmVuZGVyIHN0YXRlc1xuICAgICAgICAgICAgdGhpcy51cGRhdGVSZW5kZXJTdGF0ZXMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGJ1aWxkcyB2ZXJ0ZXggZm9ybWF0IGJhc2VkIG9uIGF0dGFjaGVkIHZlcnRleCBzdHJlYW1zXG4gICAgX2J1aWxkVmVydGV4Rm9ybWF0KHZlcnRleENvdW50KSB7XG5cbiAgICAgICAgY29uc3QgdmVydGV4RGVzYyA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3Qgc2VtYW50aWMgaW4gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleFN0cmVhbURpY3Rpb25hcnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0cmVhbSA9IHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5W3NlbWFudGljXTtcbiAgICAgICAgICAgIHZlcnRleERlc2MucHVzaCh7XG4gICAgICAgICAgICAgICAgc2VtYW50aWM6IHNlbWFudGljLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IHN0cmVhbS5jb21wb25lbnRDb3VudCxcbiAgICAgICAgICAgICAgICB0eXBlOiBzdHJlYW0uZGF0YVR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiBzdHJlYW0uZGF0YVR5cGVOb3JtYWxpemVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBWZXJ0ZXhGb3JtYXQodGhpcy5kZXZpY2UsIHZlcnRleERlc2MsIHZlcnRleENvdW50KTtcbiAgICB9XG5cbiAgICAvLyBjb3B5IGF0dGFjaGVkIGRhdGEgaW50byB2ZXJ0ZXggYnVmZmVyXG4gICAgX3VwZGF0ZVZlcnRleEJ1ZmZlcigpIHtcblxuICAgICAgICAvLyBpZiB3ZSBkb24ndCBoYXZlIHZlcnRleCBidWZmZXIsIGNyZWF0ZSBuZXcgb25lLCBvdGhlcndpc2UgdXBkYXRlIGV4aXN0aW5nIG9uZVxuICAgICAgICBpZiAoIXRoaXMudmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICBjb25zdCBhbGxvY2F0ZVZlcnRleENvdW50ID0gdGhpcy5fZ2VvbWV0cnlEYXRhLm1heFZlcnRpY2VzO1xuICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gdGhpcy5fYnVpbGRWZXJ0ZXhGb3JtYXQoYWxsb2NhdGVWZXJ0ZXhDb3VudCk7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIodGhpcy5kZXZpY2UsIGZvcm1hdCwgYWxsb2NhdGVWZXJ0ZXhDb3VudCwgdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRpY2VzVXNhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9jayB2ZXJ0ZXggYnVmZmVyIGFuZCBjcmVhdGUgdHlwZWQgYWNjZXNzIGFycmF5cyBmb3IgaW5kaXZpZHVhbCBlbGVtZW50c1xuICAgICAgICBjb25zdCBpdGVyYXRvciA9IG5ldyBWZXJ0ZXhJdGVyYXRvcih0aGlzLnZlcnRleEJ1ZmZlcik7XG5cbiAgICAgICAgLy8gY29weSBhbGwgc3RyZWFtIGRhdGEgaW50byB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gdGhpcy5fZ2VvbWV0cnlEYXRhLnZlcnRleENvdW50O1xuICAgICAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHRoaXMuX2dlb21ldHJ5RGF0YS52ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5KSB7XG4gICAgICAgICAgICBjb25zdCBzdHJlYW0gPSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeVtzZW1hbnRpY107XG4gICAgICAgICAgICBpdGVyYXRvci53cml0ZURhdGEoc2VtYW50aWMsIHN0cmVhbS5kYXRhLCBudW1WZXJ0aWNlcyk7XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBzdHJlYW1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9nZW9tZXRyeURhdGEudmVydGV4U3RyZWFtRGljdGlvbmFyeVtzZW1hbnRpY107XG4gICAgICAgIH1cblxuICAgICAgICBpdGVyYXRvci5lbmQoKTtcbiAgICB9XG5cbiAgICAvLyBjb3B5IGF0dGFjaGVkIGRhdGEgaW50byBpbmRleCBidWZmZXJcbiAgICBfdXBkYXRlSW5kZXhCdWZmZXIoKSB7XG5cbiAgICAgICAgLy8gaWYgd2UgZG9uJ3QgaGF2ZSBpbmRleCBidWZmZXIsIGNyZWF0ZSBuZXcgb25lLCBvdGhlcndpc2UgdXBkYXRlIGV4aXN0aW5nIG9uZVxuICAgICAgICBpZiAodGhpcy5pbmRleEJ1ZmZlci5sZW5ndGggPD0gMCB8fCAhdGhpcy5pbmRleEJ1ZmZlclswXSkge1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlRm9ybWF0ID0gdGhpcy5fZ2VvbWV0cnlEYXRhLm1heFZlcnRpY2VzID4gMHhmZmZmID8gSU5ERVhGT1JNQVRfVUlOVDMyIDogSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgdGhpcy5pbmRleEJ1ZmZlclswXSA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLmRldmljZSwgY3JlYXRlRm9ybWF0LCB0aGlzLl9nZW9tZXRyeURhdGEubWF4SW5kaWNlcywgdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXNVc2FnZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcmNJbmRpY2VzID0gdGhpcy5fZ2VvbWV0cnlEYXRhLmluZGljZXM7XG4gICAgICAgIGlmIChzcmNJbmRpY2VzKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gdGhpcy5pbmRleEJ1ZmZlclswXTtcbiAgICAgICAgICAgIGluZGV4QnVmZmVyLndyaXRlRGF0YShzcmNJbmRpY2VzLCB0aGlzLl9nZW9tZXRyeURhdGEuaW5kZXhDb3VudCk7XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBkYXRhXG4gICAgICAgICAgICB0aGlzLl9nZW9tZXRyeURhdGEuaW5kaWNlcyA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlcyB0aGUgbWVzaCB0byBiZSByZW5kZXJlZCB3aXRoIHNwZWNpZmljIHJlbmRlciBzdHlsZVxuICAgIHByZXBhcmVSZW5kZXJTdGF0ZShyZW5kZXJTdHlsZSkge1xuICAgICAgICBpZiAocmVuZGVyU3R5bGUgPT09IFJFTkRFUlNUWUxFX1dJUkVGUkFNRSkge1xuICAgICAgICAgICAgdGhpcy5nZW5lcmF0ZVdpcmVmcmFtZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlbmRlclN0eWxlID09PSBSRU5ERVJTVFlMRV9QT0lOVFMpIHtcbiAgICAgICAgICAgIHRoaXMucHJpbWl0aXZlW1JFTkRFUlNUWUxFX1BPSU5UU10gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogUFJJTUlUSVZFX1BPSU5UUyxcbiAgICAgICAgICAgICAgICBiYXNlOiAwLFxuICAgICAgICAgICAgICAgIGNvdW50OiB0aGlzLnZlcnRleEJ1ZmZlciA/IHRoaXMudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzIDogMCxcbiAgICAgICAgICAgICAgICBpbmRleGVkOiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgZXhpc3RpbmcgcmVuZGVyIHN0YXRlcyB3aXRoIGNoYW5nZXMgdG8gc29saWQgcmVuZGVyIHN0YXRlXG4gICAgdXBkYXRlUmVuZGVyU3RhdGVzKCkge1xuXG4gICAgICAgIGlmICh0aGlzLnByaW1pdGl2ZVtSRU5ERVJTVFlMRV9QT0lOVFNdKSB7XG4gICAgICAgICAgICB0aGlzLnByZXBhcmVSZW5kZXJTdGF0ZShSRU5ERVJTVFlMRV9QT0lOVFMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucHJpbWl0aXZlW1JFTkRFUlNUWUxFX1dJUkVGUkFNRV0pIHtcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZVJlbmRlclN0YXRlKFJFTkRFUlNUWUxFX1dJUkVGUkFNRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZVdpcmVmcmFtZSgpIHtcblxuICAgICAgICAvLyByZWxlYXNlIGV4aXN0aW5nIElCXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lJbmRleEJ1ZmZlcihSRU5ERVJTVFlMRV9XSVJFRlJBTUUpO1xuXG4gICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gdGhpcy52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG5cbiAgICAgICAgY29uc3QgbGluZXMgPSBbXTtcbiAgICAgICAgbGV0IGZvcm1hdDtcbiAgICAgICAgaWYgKHRoaXMuaW5kZXhCdWZmZXIubGVuZ3RoID4gMCAmJiB0aGlzLmluZGV4QnVmZmVyWzBdKSB7XG4gICAgICAgICAgICBjb25zdCBvZmZzZXRzID0gW1swLCAxXSwgWzEsIDJdLCBbMiwgMF1dO1xuXG4gICAgICAgICAgICBjb25zdCBiYXNlID0gdGhpcy5wcmltaXRpdmVbUkVOREVSU1RZTEVfU09MSURdLmJhc2U7XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMucHJpbWl0aXZlW1JFTkRFUlNUWUxFX1NPTElEXS5jb3VudDtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gdGhpcy5pbmRleEJ1ZmZlcltSRU5ERVJTVFlMRV9TT0xJRF07XG4gICAgICAgICAgICBjb25zdCBzcmNJbmRpY2VzID0gbmV3IHR5cGVkQXJyYXlJbmRleEZvcm1hdHNbaW5kZXhCdWZmZXIuZm9ybWF0XShpbmRleEJ1ZmZlci5zdG9yYWdlKTtcblxuICAgICAgICAgICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IGJhc2U7IGogPCBiYXNlICsgY291bnQ7IGogKz0gMykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgMzsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGkxID0gc3JjSW5kaWNlc1tqICsgb2Zmc2V0c1trXVswXV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGkyID0gc3JjSW5kaWNlc1tqICsgb2Zmc2V0c1trXVsxXV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc2ggPSAoaTEgPiBpMikgPyAoKGkyICogbnVtVmVydGljZXMpICsgaTEpIDogKChpMSAqIG51bVZlcnRpY2VzKSArIGkyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzZWVuLmhhcyhoYXNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2Vlbi5hZGQoaGFzaCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lcy5wdXNoKGkxLCBpMik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3JtYXQgPSBpbmRleEJ1ZmZlci5mb3JtYXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVZlcnRpY2VzOyBpICs9IDMpIHtcbiAgICAgICAgICAgICAgICBsaW5lcy5wdXNoKGksIGkgKyAxLCBpICsgMSwgaSArIDIsIGkgKyAyLCBpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvcm1hdCA9IGxpbmVzLmxlbmd0aCA+IDY1NTM1ID8gSU5ERVhGT1JNQVRfVUlOVDMyIDogSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2lyZUJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLnZlcnRleEJ1ZmZlci5kZXZpY2UsIGZvcm1hdCwgbGluZXMubGVuZ3RoKTtcbiAgICAgICAgY29uc3QgZHN0SW5kaWNlcyA9IG5ldyB0eXBlZEFycmF5SW5kZXhGb3JtYXRzW3dpcmVCdWZmZXIuZm9ybWF0XSh3aXJlQnVmZmVyLnN0b3JhZ2UpO1xuICAgICAgICBkc3RJbmRpY2VzLnNldChsaW5lcyk7XG4gICAgICAgIHdpcmVCdWZmZXIudW5sb2NrKCk7XG5cbiAgICAgICAgdGhpcy5wcmltaXRpdmVbUkVOREVSU1RZTEVfV0lSRUZSQU1FXSA9IHtcbiAgICAgICAgICAgIHR5cGU6IFBSSU1JVElWRV9MSU5FUyxcbiAgICAgICAgICAgIGJhc2U6IDAsXG4gICAgICAgICAgICBjb3VudDogbGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmluZGV4QnVmZmVyW1JFTkRFUlNUWUxFX1dJUkVGUkFNRV0gPSB3aXJlQnVmZmVyO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTWVzaCB9O1xuIl0sIm5hbWVzIjpbImlkIiwiR2VvbWV0cnlEYXRhIiwiY29uc3RydWN0b3IiLCJpbml0RGVmYXVsdHMiLCJyZWNyZWF0ZSIsInZlcnRpY2VzVXNhZ2UiLCJCVUZGRVJfU1RBVElDIiwiaW5kaWNlc1VzYWdlIiwibWF4VmVydGljZXMiLCJtYXhJbmRpY2VzIiwidmVydGV4Q291bnQiLCJpbmRleENvdW50IiwidmVydGV4U3RyZWFtc1VwZGF0ZWQiLCJpbmRleFN0cmVhbVVwZGF0ZWQiLCJ2ZXJ0ZXhTdHJlYW1EaWN0aW9uYXJ5IiwiaW5kaWNlcyIsIl9jaGFuZ2VWZXJ0ZXhDb3VudCIsImNvdW50Iiwic2VtYW50aWMiLCJEZWJ1ZyIsImFzc2VydCIsIkRFRkFVTFRfQ09NUE9ORU5UU19QT1NJVElPTiIsIkRFRkFVTFRfQ09NUE9ORU5UU19OT1JNQUwiLCJERUZBVUxUX0NPTVBPTkVOVFNfVVYiLCJERUZBVUxUX0NPTVBPTkVOVFNfQ09MT1JTIiwiR2VvbWV0cnlWZXJ0ZXhTdHJlYW0iLCJkYXRhIiwiY29tcG9uZW50Q291bnQiLCJkYXRhVHlwZSIsImRhdGFUeXBlTm9ybWFsaXplIiwiTWVzaCIsIlJlZkNvdW50ZWRPYmplY3QiLCJncmFwaGljc0RldmljZSIsImFzc2VydERlcHJlY2F0ZWQiLCJkZXZpY2UiLCJHcmFwaGljc0RldmljZUFjY2VzcyIsImdldCIsInZlcnRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwicHJpbWl0aXZlIiwidHlwZSIsImJhc2UiLCJza2luIiwiX21vcnBoIiwiX2dlb21ldHJ5RGF0YSIsIl9hYWJiIiwiQm91bmRpbmdCb3giLCJib25lQWFiYiIsIm1vcnBoIiwiZGVjUmVmQ291bnQiLCJpbmNSZWZDb3VudCIsImFhYmIiLCJkZXN0cm95IiwicmVmQ291bnQiLCJqIiwibGVuZ3RoIiwiX2Rlc3Ryb3lJbmRleEJ1ZmZlciIsImluZGV4IiwiX2luaXRCb25lQWFiYnMiLCJtb3JwaFRhcmdldHMiLCJib25lVXNlZCIsIngiLCJ5IiwieiIsImJNYXgiLCJiTWluIiwiYm9uZU1pbiIsImJvbmVNYXgiLCJudW1Cb25lcyIsImJvbmVOYW1lcyIsIm1heE1vcnBoWCIsIm1heE1vcnBoWSIsIm1heE1vcnBoWiIsImkiLCJWZWMzIiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwiaXRlcmF0b3IiLCJWZXJ0ZXhJdGVyYXRvciIsInBvc0VsZW1lbnQiLCJlbGVtZW50IiwiU0VNQU5USUNfUE9TSVRJT04iLCJ3ZWlnaHRzRWxlbWVudCIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwiaW5kaWNlc0VsZW1lbnQiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJudW1WZXJ0cyIsIm51bVZlcnRpY2VzIiwiayIsImJvbmVXZWlnaHQiLCJhcnJheSIsImJvbmVJbmRleCIsIm1pbk1vcnBoWCIsIm1pbk1vcnBoWSIsIm1pbk1vcnBoWiIsImwiLCJ0YXJnZXQiLCJkeCIsImRlbHRhUG9zaXRpb25zIiwiZHkiLCJkeiIsIm5leHQiLCJwb3NpdGlvbkVsZW1lbnQiLCJnZXRGb3JtYXQiLCJlbGVtZW50cyIsImZpbmQiLCJlIiwibmFtZSIsIm5vcm1hbGl6ZSIsImZ1bmMiLCJUWVBFX0lOVDgiLCJNYXRoIiwibWF4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIm1pbiIsInNldCIsInNldE1pbk1heCIsInB1c2giLCJfaW5pdEdlb21ldHJ5RGF0YSIsIm51bUluZGljZXMiLCJjbGVhciIsInZlcnRpY2VzRHluYW1pYyIsImluZGljZXNEeW5hbWljIiwiQlVGRkVSX0RZTkFNSUMiLCJzZXRWZXJ0ZXhTdHJlYW0iLCJUWVBFX0ZMT0FUMzIiLCJnZXRWZXJ0ZXhTdHJlYW0iLCJkb25lIiwic3RyZWFtIiwiQXJyYXlCdWZmZXIiLCJpc1ZpZXciLCJyZWFkRGF0YSIsInNldFBvc2l0aW9ucyIsInBvc2l0aW9ucyIsInNldE5vcm1hbHMiLCJub3JtYWxzIiwiU0VNQU5USUNfTk9STUFMIiwic2V0VXZzIiwiY2hhbm5lbCIsInV2cyIsIlNFTUFOVElDX1RFWENPT1JEIiwic2V0Q29sb3JzIiwiY29sb3JzIiwiU0VNQU5USUNfQ09MT1IiLCJzZXRDb2xvcnMzMiIsInNldEluZGljZXMiLCJnZXRQb3NpdGlvbnMiLCJnZXROb3JtYWxzIiwiZ2V0VXZzIiwiZ2V0Q29sb3JzIiwiZ2V0SW5kaWNlcyIsInN0cmVhbUluZGljZXMiLCJ1cGRhdGUiLCJwcmltaXRpdmVUeXBlIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsInVwZGF0ZUJvdW5kaW5nQm94IiwiY29tcHV0ZSIsImRlc3Ryb3lWQiIsImRlc3Ryb3lJQiIsIl91cGRhdGVWZXJ0ZXhCdWZmZXIiLCJfdXBkYXRlSW5kZXhCdWZmZXIiLCJpbmRleGVkIiwidXBkYXRlUmVuZGVyU3RhdGVzIiwiX2J1aWxkVmVydGV4Rm9ybWF0IiwidmVydGV4RGVzYyIsImNvbXBvbmVudHMiLCJWZXJ0ZXhGb3JtYXQiLCJhbGxvY2F0ZVZlcnRleENvdW50IiwiZm9ybWF0IiwiVmVydGV4QnVmZmVyIiwid3JpdGVEYXRhIiwiZW5kIiwiY3JlYXRlRm9ybWF0IiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiSW5kZXhCdWZmZXIiLCJzcmNJbmRpY2VzIiwicHJlcGFyZVJlbmRlclN0YXRlIiwicmVuZGVyU3R5bGUiLCJSRU5ERVJTVFlMRV9XSVJFRlJBTUUiLCJnZW5lcmF0ZVdpcmVmcmFtZSIsIlJFTkRFUlNUWUxFX1BPSU5UUyIsIlBSSU1JVElWRV9QT0lOVFMiLCJsaW5lcyIsIm9mZnNldHMiLCJSRU5ERVJTVFlMRV9TT0xJRCIsInR5cGVkQXJyYXlJbmRleEZvcm1hdHMiLCJzdG9yYWdlIiwic2VlbiIsIlNldCIsImkxIiwiaTIiLCJoYXNoIiwiaGFzIiwiYWRkIiwid2lyZUJ1ZmZlciIsImRzdEluZGljZXMiLCJ1bmxvY2si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
