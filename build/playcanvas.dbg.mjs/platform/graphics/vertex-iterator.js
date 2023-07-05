import { Debug } from '../../core/debug.js';
import { typedArrayTypes } from './constants.js';

function set1(a) {
  this.array[this.index] = a;
}
function set2(a, b) {
  this.array[this.index] = a;
  this.array[this.index + 1] = b;
}
function set3(a, b, c) {
  this.array[this.index] = a;
  this.array[this.index + 1] = b;
  this.array[this.index + 2] = c;
}
function set4(a, b, c, d) {
  this.array[this.index] = a;
  this.array[this.index + 1] = b;
  this.array[this.index + 2] = c;
  this.array[this.index + 3] = d;
}
function arraySet1(index, inputArray, inputIndex) {
  this.array[index] = inputArray[inputIndex];
}
function arraySet2(index, inputArray, inputIndex) {
  this.array[index] = inputArray[inputIndex];
  this.array[index + 1] = inputArray[inputIndex + 1];
}
function arraySet3(index, inputArray, inputIndex) {
  this.array[index] = inputArray[inputIndex];
  this.array[index + 1] = inputArray[inputIndex + 1];
  this.array[index + 2] = inputArray[inputIndex + 2];
}
function arraySet4(index, inputArray, inputIndex) {
  this.array[index] = inputArray[inputIndex];
  this.array[index + 1] = inputArray[inputIndex + 1];
  this.array[index + 2] = inputArray[inputIndex + 2];
  this.array[index + 3] = inputArray[inputIndex + 3];
}
function arrayGet1(offset, outputArray, outputIndex) {
  outputArray[outputIndex] = this.array[offset];
}
function arrayGet2(offset, outputArray, outputIndex) {
  outputArray[outputIndex] = this.array[offset];
  outputArray[outputIndex + 1] = this.array[offset + 1];
}
function arrayGet3(offset, outputArray, outputIndex) {
  outputArray[outputIndex] = this.array[offset];
  outputArray[outputIndex + 1] = this.array[offset + 1];
  outputArray[outputIndex + 2] = this.array[offset + 2];
}
function arrayGet4(offset, outputArray, outputIndex) {
  outputArray[outputIndex] = this.array[offset];
  outputArray[outputIndex + 1] = this.array[offset + 1];
  outputArray[outputIndex + 2] = this.array[offset + 2];
  outputArray[outputIndex + 3] = this.array[offset + 3];
}

/**
 * Helps with accessing a specific vertex attribute.
 */
class VertexIteratorAccessor {
  /**
   * Create a new VertexIteratorAccessor instance.
   *
   * @param {ArrayBuffer} buffer - The vertex buffer containing the attribute to be accessed.
   * @param {object} vertexElement - The vertex attribute to be accessed.
   * @param {string} vertexElement.name - The meaning of the vertex element. This is used to link
   * the vertex data to a shader input. Can be:
   *
   * - {@link SEMANTIC_POSITION}
   * - {@link SEMANTIC_NORMAL}
   * - {@link SEMANTIC_TANGENT}
   * - {@link SEMANTIC_BLENDWEIGHT}
   * - {@link SEMANTIC_BLENDINDICES}
   * - {@link SEMANTIC_COLOR}
   * - {@link SEMANTIC_TEXCOORD0}
   * - {@link SEMANTIC_TEXCOORD1}
   * - {@link SEMANTIC_TEXCOORD2}
   * - {@link SEMANTIC_TEXCOORD3}
   * - {@link SEMANTIC_TEXCOORD4}
   * - {@link SEMANTIC_TEXCOORD5}
   * - {@link SEMANTIC_TEXCOORD6}
   * - {@link SEMANTIC_TEXCOORD7}
   *
   * If vertex data has a meaning other that one of those listed above, use the user-defined
   * semantics: {@link SEMANTIC_ATTR0} to {@link SEMANTIC_ATTR15}.
   * @param {number} vertexElement.numComponents - The number of components of the vertex
   * attribute. Can be 1, 2, 3 or 4.
   * @param {number} vertexElement.dataType - The data type of the attribute. Can be:
   *
   * - {@link TYPE_INT8}
   * - {@link TYPE_UINT8}
   * - {@link TYPE_INT16}
   * - {@link TYPE_UINT16}
   * - {@link TYPE_INT32}
   * - {@link TYPE_UINT32}
   * - {@link TYPE_FLOAT32}
   * @param {boolean} vertexElement.normalize - If true, vertex attribute data will be mapped
   * from a 0 to 255 range down to 0 to 1 when fed to a shader. If false, vertex attribute data
   * is left unchanged. If this property is unspecified, false is assumed.
   * @param {number} vertexElement.offset - The number of initial bytes at the start of a vertex
   * that are not relevant to this attribute.
   * @param {number} vertexElement.stride - The number of total bytes that are between the start
   * of one vertex, and the start of the next.
   * @param {import('./scope-id.js').ScopeId} vertexElement.scopeId - The shader input variable
   * corresponding to the attribute.
   * @param {number} vertexElement.size - The size of the attribute in bytes.
   * @param {import('./vertex-format.js').VertexFormat} vertexFormat - A vertex format that
   * defines the layout of vertex data inside the buffer.
   */
  constructor(buffer, vertexElement, vertexFormat) {
    this.index = 0;
    this.numComponents = vertexElement.numComponents;

    // create the typed array based on the element data type
    if (vertexFormat.interleaved) {
      this.array = new typedArrayTypes[vertexElement.dataType](buffer, vertexElement.offset);
    } else {
      this.array = new typedArrayTypes[vertexElement.dataType](buffer, vertexElement.offset, vertexFormat.vertexCount * vertexElement.numComponents);
    }

    // BYTES_PER_ELEMENT is on the instance and constructor for Chrome, Safari and Firefox, but just the constructor for Opera
    this.stride = vertexElement.stride / this.array.constructor.BYTES_PER_ELEMENT;

    // Methods
    switch (vertexElement.numComponents) {
      case 1:
        this.set = set1;
        this.getToArray = arrayGet1;
        this.setFromArray = arraySet1;
        break;
      case 2:
        this.set = set2;
        this.getToArray = arrayGet2;
        this.setFromArray = arraySet2;
        break;
      case 3:
        this.set = set3;
        this.getToArray = arrayGet3;
        this.setFromArray = arraySet3;
        break;
      case 4:
        this.set = set4;
        this.getToArray = arrayGet4;
        this.setFromArray = arraySet4;
        break;
    }
  }

  /**
   * Get a attribute component at the iterator's current index.
   *
   * @param {number} offset - The component offset. Should be either 0, 1, 2, or 3.
   * @returns {number} The value of a attribute component.
   */
  get(offset) {
    return this.array[this.index + offset];
  }

  /**
   * Set all the attribute components at the iterator's current index.
   *
   * @param {number} a - The first component value.
   * @param {number} [b] - The second component value (if applicable).
   * @param {number} [c] - The third component value (if applicable).
   * @param {number} [d] - The fourth component value (if applicable).
   */
  set(a, b, c, d) {
    // Will be replaced with specialized implementation based on number of components
  }

  /**
   * Read attribute components to an output array.
   *
   * @param {number} offset - The component offset at which to read data from the buffer. Will be
   * used instead of the iterator's current index.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} outputArray - The output array to write data into.
   * @param {number} outputIndex - The output index at which to write into the output array.
   */
  getToArray(offset, outputArray, outputIndex) {
    // Will be replaced with specialized implementation based on number of components
  }

  /**
   * Write attribute components from an input array.
   *
   * @param {number} index - The starting index at which to write data into the buffer. Will be
   * used instead of the iterator's current index.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} inputArray - The input array to read data from.
   * @param {number} inputIndex - The input index at which to read from the input array.
   */
  setFromArray(index, inputArray, inputIndex) {
    // Will be replaced with specialized implementation based on number of components
  }
}

/**
 * A vertex iterator simplifies the process of writing vertex data to a vertex buffer.
 */
class VertexIterator {
  /**
   * Create a new VertexIterator instance.
   *
   * @param {import('./vertex-buffer.js').VertexBuffer} vertexBuffer - The vertex buffer to be
   * iterated.
   */
  constructor(vertexBuffer) {
    // Store the vertex buffer
    this.vertexBuffer = vertexBuffer;
    this.vertexFormatSize = vertexBuffer.getFormat().size;

    // Lock the vertex buffer
    this.buffer = this.vertexBuffer.lock();

    // Create an empty list
    this.accessors = [];

    /**
     * The vertex buffer elements.
     *
     * @type {Object<string, VertexIteratorAccessor>}
     */
    this.element = {};

    // Add a new 'setter' function for each element
    const vertexFormat = this.vertexBuffer.getFormat();
    for (let i = 0; i < vertexFormat.elements.length; i++) {
      const vertexElement = vertexFormat.elements[i];
      this.accessors[i] = new VertexIteratorAccessor(this.buffer, vertexElement, vertexFormat);
      this.element[vertexElement.name] = this.accessors[i];
    }
  }

  /**
   * Moves the vertex iterator on to the next vertex.
   *
   * @param {number} [count] - Optional number of steps to move on when calling next. Defaults to
   * 1.
   * @example
   * const iterator = new pc.VertexIterator(vertexBuffer);
   * iterator.element[pc.SEMANTIC_POSITION].set(-0.9, -0.9, 0.0);
   * iterator.element[pc.SEMANTIC_COLOR].set(255, 0, 0, 255);
   * iterator.next();
   * iterator.element[pc.SEMANTIC_POSITION].set(0.9, -0.9, 0.0);
   * iterator.element[pc.SEMANTIC_COLOR].set(0, 255, 0, 255);
   * iterator.next();
   * iterator.element[pc.SEMANTIC_POSITION].set(0.0, 0.9, 0.0);
   * iterator.element[pc.SEMANTIC_COLOR].set(0, 0, 255, 255);
   * iterator.end();
   */
  next(count = 1) {
    let i = 0;
    const accessors = this.accessors;
    const numAccessors = this.accessors.length;
    while (i < numAccessors) {
      const accessor = accessors[i++];
      accessor.index += count * accessor.stride;
    }
  }

  /**
   * Notifies the vertex buffer being iterated that writes are complete. Internally the vertex
   * buffer is unlocked and vertex data is uploaded to video memory.
   *
   * @example
   * const iterator = new pc.VertexIterator(vertexBuffer);
   * iterator.element[pc.SEMANTIC_POSITION].set(-0.9, -0.9, 0.0);
   * iterator.element[pc.SEMANTIC_COLOR].set(255, 0, 0, 255);
   * iterator.next();
   * iterator.element[pc.SEMANTIC_POSITION].set(0.9, -0.9, 0.0);
   * iterator.element[pc.SEMANTIC_COLOR].set(0, 255, 0, 255);
   * iterator.next();
   * iterator.element[pc.SEMANTIC_POSITION].set(0.0, 0.9, 0.0);
   * iterator.element[pc.SEMANTIC_COLOR].set(0, 0, 255, 255);
   * iterator.end();
   */
  end() {
    // Unlock the vertex buffer
    this.vertexBuffer.unlock();
  }

  /**
   * Copies data for specified semantic into vertex buffer. Works with both interleaved (slower)
   * and non-interleaved (fast) vertex buffers.
   *
   * @param {string} semantic - The semantic of the vertex element to set.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - The data to set.
   * @param {number} numVertices - The number of vertices to write.
   * @ignore
   */
  writeData(semantic, data, numVertices) {
    const element = this.element[semantic];
    if (element) {
      if (numVertices > this.vertexBuffer.numVertices) {
        Debug.error(`NumVertices provided to setData: ${numVertices} is larger than space in VertexBuffer: ${this.vertexBuffer.numVertices}`);

        // avoid overwrite
        numVertices = this.vertexBuffer.numVertices;
      }
      const numComponents = element.numComponents;

      // copy data to interleaved buffer by looping over vertices and copying them manually
      if (this.vertexBuffer.getFormat().interleaved) {
        let index = 0;
        for (let i = 0; i < numVertices; i++) {
          element.setFromArray(index, data, i * numComponents);
          index += element.stride;
        }
      } else {
        // non-interleaved copy

        // if data contains more  data than needed, copy from its subarray
        if (data.length > numVertices * numComponents) {
          const copyCount = numVertices * numComponents;

          // if data is typed array
          if (ArrayBuffer.isView(data)) {
            data = data.subarray(0, copyCount);
            element.array.set(data);
          } else {
            // data is array, copy right amount manually
            for (let i = 0; i < copyCount; i++) element.array[i] = data[i];
          }
        } else {
          // copy whole data
          element.array.set(data);
        }
      }
    }
  }

  /**
   * Function to extract elements of a specified semantic from vertex buffer into flat array
   * (data). Works with both interleaved (slower) and non-interleaved (fast) vertex buffers.
   * Returns number of vertices. Note: when data is a typed array and is smaller than needed,
   * only part of the data gets copied out (typed arrays ignore read/write out of range).
   *
   * @param {string} semantic - The semantic of the vertex element to read.
   * @param {number[]|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array} data - The
   * array to receive the data.
   * @returns {number} The number of vertices read.
   * @ignore
   */
  readData(semantic, data) {
    const element = this.element[semantic];
    let count = 0;
    if (element) {
      count = this.vertexBuffer.numVertices;
      let i;
      const numComponents = element.numComponents;
      if (this.vertexBuffer.getFormat().interleaved) {
        // extract data from interleaved buffer by looping over vertices and copying them manually
        if (Array.isArray(data)) data.length = 0;
        element.index = 0;
        let offset = 0;
        for (i = 0; i < count; i++) {
          element.getToArray(offset, data, i * numComponents);
          offset += element.stride;
        }
      } else {
        if (ArrayBuffer.isView(data)) {
          // destination data is typed array
          data.set(element.array);
        } else {
          // destination data is array
          data.length = 0;
          const copyCount = count * numComponents;
          for (i = 0; i < copyCount; i++) data[i] = element.array[i];
        }
      }
    }
    return count;
  }
}

export { VertexIterator, VertexIteratorAccessor };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVydGV4LWl0ZXJhdG9yLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWl0ZXJhdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyB0eXBlZEFycmF5VHlwZXMgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmZ1bmN0aW9uIHNldDEoYSkge1xuICAgIHRoaXMuYXJyYXlbdGhpcy5pbmRleF0gPSBhO1xufVxuXG5mdW5jdGlvbiBzZXQyKGEsIGIpIHtcbiAgICB0aGlzLmFycmF5W3RoaXMuaW5kZXhdID0gYTtcbiAgICB0aGlzLmFycmF5W3RoaXMuaW5kZXggKyAxXSA9IGI7XG59XG5cbmZ1bmN0aW9uIHNldDMoYSwgYiwgYykge1xuICAgIHRoaXMuYXJyYXlbdGhpcy5pbmRleF0gPSBhO1xuICAgIHRoaXMuYXJyYXlbdGhpcy5pbmRleCArIDFdID0gYjtcbiAgICB0aGlzLmFycmF5W3RoaXMuaW5kZXggKyAyXSA9IGM7XG59XG5cbmZ1bmN0aW9uIHNldDQoYSwgYiwgYywgZCkge1xuICAgIHRoaXMuYXJyYXlbdGhpcy5pbmRleF0gPSBhO1xuICAgIHRoaXMuYXJyYXlbdGhpcy5pbmRleCArIDFdID0gYjtcbiAgICB0aGlzLmFycmF5W3RoaXMuaW5kZXggKyAyXSA9IGM7XG4gICAgdGhpcy5hcnJheVt0aGlzLmluZGV4ICsgM10gPSBkO1xufVxuXG5mdW5jdGlvbiBhcnJheVNldDEoaW5kZXgsIGlucHV0QXJyYXksIGlucHV0SW5kZXgpIHtcbiAgICB0aGlzLmFycmF5W2luZGV4XSA9IGlucHV0QXJyYXlbaW5wdXRJbmRleF07XG59XG5cbmZ1bmN0aW9uIGFycmF5U2V0MihpbmRleCwgaW5wdXRBcnJheSwgaW5wdXRJbmRleCkge1xuICAgIHRoaXMuYXJyYXlbaW5kZXhdID0gaW5wdXRBcnJheVtpbnB1dEluZGV4XTtcbiAgICB0aGlzLmFycmF5W2luZGV4ICsgMV0gPSBpbnB1dEFycmF5W2lucHV0SW5kZXggKyAxXTtcbn1cblxuZnVuY3Rpb24gYXJyYXlTZXQzKGluZGV4LCBpbnB1dEFycmF5LCBpbnB1dEluZGV4KSB7XG4gICAgdGhpcy5hcnJheVtpbmRleF0gPSBpbnB1dEFycmF5W2lucHV0SW5kZXhdO1xuICAgIHRoaXMuYXJyYXlbaW5kZXggKyAxXSA9IGlucHV0QXJyYXlbaW5wdXRJbmRleCArIDFdO1xuICAgIHRoaXMuYXJyYXlbaW5kZXggKyAyXSA9IGlucHV0QXJyYXlbaW5wdXRJbmRleCArIDJdO1xufVxuXG5mdW5jdGlvbiBhcnJheVNldDQoaW5kZXgsIGlucHV0QXJyYXksIGlucHV0SW5kZXgpIHtcbiAgICB0aGlzLmFycmF5W2luZGV4XSA9IGlucHV0QXJyYXlbaW5wdXRJbmRleF07XG4gICAgdGhpcy5hcnJheVtpbmRleCArIDFdID0gaW5wdXRBcnJheVtpbnB1dEluZGV4ICsgMV07XG4gICAgdGhpcy5hcnJheVtpbmRleCArIDJdID0gaW5wdXRBcnJheVtpbnB1dEluZGV4ICsgMl07XG4gICAgdGhpcy5hcnJheVtpbmRleCArIDNdID0gaW5wdXRBcnJheVtpbnB1dEluZGV4ICsgM107XG59XG5cbmZ1bmN0aW9uIGFycmF5R2V0MShvZmZzZXQsIG91dHB1dEFycmF5LCBvdXRwdXRJbmRleCkge1xuICAgIG91dHB1dEFycmF5W291dHB1dEluZGV4XSA9IHRoaXMuYXJyYXlbb2Zmc2V0XTtcbn1cblxuZnVuY3Rpb24gYXJyYXlHZXQyKG9mZnNldCwgb3V0cHV0QXJyYXksIG91dHB1dEluZGV4KSB7XG4gICAgb3V0cHV0QXJyYXlbb3V0cHV0SW5kZXhdID0gdGhpcy5hcnJheVtvZmZzZXRdO1xuICAgIG91dHB1dEFycmF5W291dHB1dEluZGV4ICsgMV0gPSB0aGlzLmFycmF5W29mZnNldCArIDFdO1xufVxuXG5mdW5jdGlvbiBhcnJheUdldDMob2Zmc2V0LCBvdXRwdXRBcnJheSwgb3V0cHV0SW5kZXgpIHtcbiAgICBvdXRwdXRBcnJheVtvdXRwdXRJbmRleF0gPSB0aGlzLmFycmF5W29mZnNldF07XG4gICAgb3V0cHV0QXJyYXlbb3V0cHV0SW5kZXggKyAxXSA9IHRoaXMuYXJyYXlbb2Zmc2V0ICsgMV07XG4gICAgb3V0cHV0QXJyYXlbb3V0cHV0SW5kZXggKyAyXSA9IHRoaXMuYXJyYXlbb2Zmc2V0ICsgMl07XG59XG5cbmZ1bmN0aW9uIGFycmF5R2V0NChvZmZzZXQsIG91dHB1dEFycmF5LCBvdXRwdXRJbmRleCkge1xuICAgIG91dHB1dEFycmF5W291dHB1dEluZGV4XSA9IHRoaXMuYXJyYXlbb2Zmc2V0XTtcbiAgICBvdXRwdXRBcnJheVtvdXRwdXRJbmRleCArIDFdID0gdGhpcy5hcnJheVtvZmZzZXQgKyAxXTtcbiAgICBvdXRwdXRBcnJheVtvdXRwdXRJbmRleCArIDJdID0gdGhpcy5hcnJheVtvZmZzZXQgKyAyXTtcbiAgICBvdXRwdXRBcnJheVtvdXRwdXRJbmRleCArIDNdID0gdGhpcy5hcnJheVtvZmZzZXQgKyAzXTtcbn1cblxuLyoqXG4gKiBIZWxwcyB3aXRoIGFjY2Vzc2luZyBhIHNwZWNpZmljIHZlcnRleCBhdHRyaWJ1dGUuXG4gKi9cbmNsYXNzIFZlcnRleEl0ZXJhdG9yQWNjZXNzb3Ige1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBWZXJ0ZXhJdGVyYXRvckFjY2Vzc29yIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheUJ1ZmZlcn0gYnVmZmVyIC0gVGhlIHZlcnRleCBidWZmZXIgY29udGFpbmluZyB0aGUgYXR0cmlidXRlIHRvIGJlIGFjY2Vzc2VkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB2ZXJ0ZXhFbGVtZW50IC0gVGhlIHZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgYWNjZXNzZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZlcnRleEVsZW1lbnQubmFtZSAtIFRoZSBtZWFuaW5nIG9mIHRoZSB2ZXJ0ZXggZWxlbWVudC4gVGhpcyBpcyB1c2VkIHRvIGxpbmtcbiAgICAgKiB0aGUgdmVydGV4IGRhdGEgdG8gYSBzaGFkZXIgaW5wdXQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNFTUFOVElDX1BPU0lUSU9OfVxuICAgICAqIC0ge0BsaW5rIFNFTUFOVElDX05PUk1BTH1cbiAgICAgKiAtIHtAbGluayBTRU1BTlRJQ19UQU5HRU5UfVxuICAgICAqIC0ge0BsaW5rIFNFTUFOVElDX0JMRU5EV0VJR0hUfVxuICAgICAqIC0ge0BsaW5rIFNFTUFOVElDX0JMRU5ESU5ESUNFU31cbiAgICAgKiAtIHtAbGluayBTRU1BTlRJQ19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBTRU1BTlRJQ19URVhDT09SRDB9XG4gICAgICogLSB7QGxpbmsgU0VNQU5USUNfVEVYQ09PUkQxfVxuICAgICAqIC0ge0BsaW5rIFNFTUFOVElDX1RFWENPT1JEMn1cbiAgICAgKiAtIHtAbGluayBTRU1BTlRJQ19URVhDT09SRDN9XG4gICAgICogLSB7QGxpbmsgU0VNQU5USUNfVEVYQ09PUkQ0fVxuICAgICAqIC0ge0BsaW5rIFNFTUFOVElDX1RFWENPT1JENX1cbiAgICAgKiAtIHtAbGluayBTRU1BTlRJQ19URVhDT09SRDZ9XG4gICAgICogLSB7QGxpbmsgU0VNQU5USUNfVEVYQ09PUkQ3fVxuICAgICAqXG4gICAgICogSWYgdmVydGV4IGRhdGEgaGFzIGEgbWVhbmluZyBvdGhlciB0aGF0IG9uZSBvZiB0aG9zZSBsaXN0ZWQgYWJvdmUsIHVzZSB0aGUgdXNlci1kZWZpbmVkXG4gICAgICogc2VtYW50aWNzOiB7QGxpbmsgU0VNQU5USUNfQVRUUjB9IHRvIHtAbGluayBTRU1BTlRJQ19BVFRSMTV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2ZXJ0ZXhFbGVtZW50Lm51bUNvbXBvbmVudHMgLSBUaGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgb2YgdGhlIHZlcnRleFxuICAgICAqIGF0dHJpYnV0ZS4gQ2FuIGJlIDEsIDIsIDMgb3IgNC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmVydGV4RWxlbWVudC5kYXRhVHlwZSAtIFRoZSBkYXRhIHR5cGUgb2YgdGhlIGF0dHJpYnV0ZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVFlQRV9JTlQ4fVxuICAgICAqIC0ge0BsaW5rIFRZUEVfVUlOVDh9XG4gICAgICogLSB7QGxpbmsgVFlQRV9JTlQxNn1cbiAgICAgKiAtIHtAbGluayBUWVBFX1VJTlQxNn1cbiAgICAgKiAtIHtAbGluayBUWVBFX0lOVDMyfVxuICAgICAqIC0ge0BsaW5rIFRZUEVfVUlOVDMyfVxuICAgICAqIC0ge0BsaW5rIFRZUEVfRkxPQVQzMn1cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHZlcnRleEVsZW1lbnQubm9ybWFsaXplIC0gSWYgdHJ1ZSwgdmVydGV4IGF0dHJpYnV0ZSBkYXRhIHdpbGwgYmUgbWFwcGVkXG4gICAgICogZnJvbSBhIDAgdG8gMjU1IHJhbmdlIGRvd24gdG8gMCB0byAxIHdoZW4gZmVkIHRvIGEgc2hhZGVyLiBJZiBmYWxzZSwgdmVydGV4IGF0dHJpYnV0ZSBkYXRhXG4gICAgICogaXMgbGVmdCB1bmNoYW5nZWQuIElmIHRoaXMgcHJvcGVydHkgaXMgdW5zcGVjaWZpZWQsIGZhbHNlIGlzIGFzc3VtZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZlcnRleEVsZW1lbnQub2Zmc2V0IC0gVGhlIG51bWJlciBvZiBpbml0aWFsIGJ5dGVzIGF0IHRoZSBzdGFydCBvZiBhIHZlcnRleFxuICAgICAqIHRoYXQgYXJlIG5vdCByZWxldmFudCB0byB0aGlzIGF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmVydGV4RWxlbWVudC5zdHJpZGUgLSBUaGUgbnVtYmVyIG9mIHRvdGFsIGJ5dGVzIHRoYXQgYXJlIGJldHdlZW4gdGhlIHN0YXJ0XG4gICAgICogb2Ygb25lIHZlcnRleCwgYW5kIHRoZSBzdGFydCBvZiB0aGUgbmV4dC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zY29wZS1pZC5qcycpLlNjb3BlSWR9IHZlcnRleEVsZW1lbnQuc2NvcGVJZCAtIFRoZSBzaGFkZXIgaW5wdXQgdmFyaWFibGVcbiAgICAgKiBjb3JyZXNwb25kaW5nIHRvIHRoZSBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZlcnRleEVsZW1lbnQuc2l6ZSAtIFRoZSBzaXplIG9mIHRoZSBhdHRyaWJ1dGUgaW4gYnl0ZXMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vdmVydGV4LWZvcm1hdC5qcycpLlZlcnRleEZvcm1hdH0gdmVydGV4Rm9ybWF0IC0gQSB2ZXJ0ZXggZm9ybWF0IHRoYXRcbiAgICAgKiBkZWZpbmVzIHRoZSBsYXlvdXQgb2YgdmVydGV4IGRhdGEgaW5zaWRlIHRoZSBidWZmZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYnVmZmVyLCB2ZXJ0ZXhFbGVtZW50LCB2ZXJ0ZXhGb3JtYXQpIHtcbiAgICAgICAgdGhpcy5pbmRleCA9IDA7XG4gICAgICAgIHRoaXMubnVtQ29tcG9uZW50cyA9IHZlcnRleEVsZW1lbnQubnVtQ29tcG9uZW50cztcblxuICAgICAgICAvLyBjcmVhdGUgdGhlIHR5cGVkIGFycmF5IGJhc2VkIG9uIHRoZSBlbGVtZW50IGRhdGEgdHlwZVxuICAgICAgICBpZiAodmVydGV4Rm9ybWF0LmludGVybGVhdmVkKSB7XG4gICAgICAgICAgICB0aGlzLmFycmF5ID0gbmV3IHR5cGVkQXJyYXlUeXBlc1t2ZXJ0ZXhFbGVtZW50LmRhdGFUeXBlXShidWZmZXIsIHZlcnRleEVsZW1lbnQub2Zmc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYXJyYXkgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3ZlcnRleEVsZW1lbnQuZGF0YVR5cGVdKGJ1ZmZlciwgdmVydGV4RWxlbWVudC5vZmZzZXQsIHZlcnRleEZvcm1hdC52ZXJ0ZXhDb3VudCAqIHZlcnRleEVsZW1lbnQubnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCWVRFU19QRVJfRUxFTUVOVCBpcyBvbiB0aGUgaW5zdGFuY2UgYW5kIGNvbnN0cnVjdG9yIGZvciBDaHJvbWUsIFNhZmFyaSBhbmQgRmlyZWZveCwgYnV0IGp1c3QgdGhlIGNvbnN0cnVjdG9yIGZvciBPcGVyYVxuICAgICAgICB0aGlzLnN0cmlkZSA9IHZlcnRleEVsZW1lbnQuc3RyaWRlIC8gdGhpcy5hcnJheS5jb25zdHJ1Y3Rvci5CWVRFU19QRVJfRUxFTUVOVDtcblxuICAgICAgICAvLyBNZXRob2RzXG4gICAgICAgIHN3aXRjaCAodmVydGV4RWxlbWVudC5udW1Db21wb25lbnRzKSB7XG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgdGhpcy5zZXQgPSBzZXQxO1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0VG9BcnJheSA9IGFycmF5R2V0MTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldEZyb21BcnJheSA9IGFycmF5U2V0MTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgIHRoaXMuc2V0ID0gc2V0MjtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFRvQXJyYXkgPSBhcnJheUdldDI7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRGcm9tQXJyYXkgPSBhcnJheVNldDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICB0aGlzLnNldCA9IHNldDM7XG4gICAgICAgICAgICAgICAgdGhpcy5nZXRUb0FycmF5ID0gYXJyYXlHZXQzO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0RnJvbUFycmF5ID0gYXJyYXlTZXQzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICAgICAgdGhpcy5zZXQgPSBzZXQ0O1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0VG9BcnJheSA9IGFycmF5R2V0NDtcbiAgICAgICAgICAgICAgICB0aGlzLnNldEZyb21BcnJheSA9IGFycmF5U2V0NDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhIGF0dHJpYnV0ZSBjb21wb25lbnQgYXQgdGhlIGl0ZXJhdG9yJ3MgY3VycmVudCBpbmRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXQgLSBUaGUgY29tcG9uZW50IG9mZnNldC4gU2hvdWxkIGJlIGVpdGhlciAwLCAxLCAyLCBvciAzLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSB2YWx1ZSBvZiBhIGF0dHJpYnV0ZSBjb21wb25lbnQuXG4gICAgICovXG4gICAgZ2V0KG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hcnJheVt0aGlzLmluZGV4ICsgb2Zmc2V0XTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgYWxsIHRoZSBhdHRyaWJ1dGUgY29tcG9uZW50cyBhdCB0aGUgaXRlcmF0b3IncyBjdXJyZW50IGluZGV4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBUaGUgZmlyc3QgY29tcG9uZW50IHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYl0gLSBUaGUgc2Vjb25kIGNvbXBvbmVudCB2YWx1ZSAoaWYgYXBwbGljYWJsZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtjXSAtIFRoZSB0aGlyZCBjb21wb25lbnQgdmFsdWUgKGlmIGFwcGxpY2FibGUpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZF0gLSBUaGUgZm91cnRoIGNvbXBvbmVudCB2YWx1ZSAoaWYgYXBwbGljYWJsZSkuXG4gICAgICovXG4gICAgc2V0KGEsIGIsIGMsIGQpIHtcbiAgICAgICAgLy8gV2lsbCBiZSByZXBsYWNlZCB3aXRoIHNwZWNpYWxpemVkIGltcGxlbWVudGF0aW9uIGJhc2VkIG9uIG51bWJlciBvZiBjb21wb25lbnRzXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVhZCBhdHRyaWJ1dGUgY29tcG9uZW50cyB0byBhbiBvdXRwdXQgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0IC0gVGhlIGNvbXBvbmVudCBvZmZzZXQgYXQgd2hpY2ggdG8gcmVhZCBkYXRhIGZyb20gdGhlIGJ1ZmZlci4gV2lsbCBiZVxuICAgICAqIHVzZWQgaW5zdGVhZCBvZiB0aGUgaXRlcmF0b3IncyBjdXJyZW50IGluZGV4LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gb3V0cHV0QXJyYXkgLSBUaGUgb3V0cHV0IGFycmF5IHRvIHdyaXRlIGRhdGEgaW50by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3V0cHV0SW5kZXggLSBUaGUgb3V0cHV0IGluZGV4IGF0IHdoaWNoIHRvIHdyaXRlIGludG8gdGhlIG91dHB1dCBhcnJheS5cbiAgICAgKi9cbiAgICBnZXRUb0FycmF5KG9mZnNldCwgb3V0cHV0QXJyYXksIG91dHB1dEluZGV4KSB7XG4gICAgICAgIC8vIFdpbGwgYmUgcmVwbGFjZWQgd2l0aCBzcGVjaWFsaXplZCBpbXBsZW1lbnRhdGlvbiBiYXNlZCBvbiBudW1iZXIgb2YgY29tcG9uZW50c1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdyaXRlIGF0dHJpYnV0ZSBjb21wb25lbnRzIGZyb20gYW4gaW5wdXQgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgc3RhcnRpbmcgaW5kZXggYXQgd2hpY2ggdG8gd3JpdGUgZGF0YSBpbnRvIHRoZSBidWZmZXIuIFdpbGwgYmVcbiAgICAgKiB1c2VkIGluc3RlYWQgb2YgdGhlIGl0ZXJhdG9yJ3MgY3VycmVudCBpbmRleC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEludDhBcnJheXxVaW50OEFycmF5fFVpbnQ4Q2xhbXBlZEFycmF5fEludDE2QXJyYXl8VWludDE2QXJyYXl8SW50MzJBcnJheXxVaW50MzJBcnJheXxGbG9hdDMyQXJyYXl9IGlucHV0QXJyYXkgLSBUaGUgaW5wdXQgYXJyYXkgdG8gcmVhZCBkYXRhIGZyb20uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlucHV0SW5kZXggLSBUaGUgaW5wdXQgaW5kZXggYXQgd2hpY2ggdG8gcmVhZCBmcm9tIHRoZSBpbnB1dCBhcnJheS5cbiAgICAgKi9cbiAgICBzZXRGcm9tQXJyYXkoaW5kZXgsIGlucHV0QXJyYXksIGlucHV0SW5kZXgpIHtcbiAgICAgICAgLy8gV2lsbCBiZSByZXBsYWNlZCB3aXRoIHNwZWNpYWxpemVkIGltcGxlbWVudGF0aW9uIGJhc2VkIG9uIG51bWJlciBvZiBjb21wb25lbnRzXG4gICAgfVxufVxuXG4vKipcbiAqIEEgdmVydGV4IGl0ZXJhdG9yIHNpbXBsaWZpZXMgdGhlIHByb2Nlc3Mgb2Ygd3JpdGluZyB2ZXJ0ZXggZGF0YSB0byBhIHZlcnRleCBidWZmZXIuXG4gKi9cbmNsYXNzIFZlcnRleEl0ZXJhdG9yIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVmVydGV4SXRlcmF0b3IgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi92ZXJ0ZXgtYnVmZmVyLmpzJykuVmVydGV4QnVmZmVyfSB2ZXJ0ZXhCdWZmZXIgLSBUaGUgdmVydGV4IGJ1ZmZlciB0byBiZVxuICAgICAqIGl0ZXJhdGVkLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICAvLyBTdG9yZSB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcbiAgICAgICAgdGhpcy52ZXJ0ZXhGb3JtYXRTaXplID0gdmVydGV4QnVmZmVyLmdldEZvcm1hdCgpLnNpemU7XG5cbiAgICAgICAgLy8gTG9jayB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICB0aGlzLmJ1ZmZlciA9IHRoaXMudmVydGV4QnVmZmVyLmxvY2soKTtcblxuICAgICAgICAvLyBDcmVhdGUgYW4gZW1wdHkgbGlzdFxuICAgICAgICB0aGlzLmFjY2Vzc29ycyA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdmVydGV4IGJ1ZmZlciBlbGVtZW50cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIFZlcnRleEl0ZXJhdG9yQWNjZXNzb3I+fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbGVtZW50ID0ge307XG5cbiAgICAgICAgLy8gQWRkIGEgbmV3ICdzZXR0ZXInIGZ1bmN0aW9uIGZvciBlYWNoIGVsZW1lbnRcbiAgICAgICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gdGhpcy52ZXJ0ZXhCdWZmZXIuZ2V0Rm9ybWF0KCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Rm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhFbGVtZW50ID0gdmVydGV4Rm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgdGhpcy5hY2Nlc3NvcnNbaV0gPSBuZXcgVmVydGV4SXRlcmF0b3JBY2Nlc3Nvcih0aGlzLmJ1ZmZlciwgdmVydGV4RWxlbWVudCwgdmVydGV4Rm9ybWF0KTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudFt2ZXJ0ZXhFbGVtZW50Lm5hbWVdID0gdGhpcy5hY2Nlc3NvcnNbaV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNb3ZlcyB0aGUgdmVydGV4IGl0ZXJhdG9yIG9uIHRvIHRoZSBuZXh0IHZlcnRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbY291bnRdIC0gT3B0aW9uYWwgbnVtYmVyIG9mIHN0ZXBzIHRvIG1vdmUgb24gd2hlbiBjYWxsaW5nIG5leHQuIERlZmF1bHRzIHRvXG4gICAgICogMS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGl0ZXJhdG9yID0gbmV3IHBjLlZlcnRleEl0ZXJhdG9yKHZlcnRleEJ1ZmZlcik7XG4gICAgICogaXRlcmF0b3IuZWxlbWVudFtwYy5TRU1BTlRJQ19QT1NJVElPTl0uc2V0KC0wLjksIC0wLjksIDAuMCk7XG4gICAgICogaXRlcmF0b3IuZWxlbWVudFtwYy5TRU1BTlRJQ19DT0xPUl0uc2V0KDI1NSwgMCwgMCwgMjU1KTtcbiAgICAgKiBpdGVyYXRvci5uZXh0KCk7XG4gICAgICogaXRlcmF0b3IuZWxlbWVudFtwYy5TRU1BTlRJQ19QT1NJVElPTl0uc2V0KDAuOSwgLTAuOSwgMC4wKTtcbiAgICAgKiBpdGVyYXRvci5lbGVtZW50W3BjLlNFTUFOVElDX0NPTE9SXS5zZXQoMCwgMjU1LCAwLCAyNTUpO1xuICAgICAqIGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgKiBpdGVyYXRvci5lbGVtZW50W3BjLlNFTUFOVElDX1BPU0lUSU9OXS5zZXQoMC4wLCAwLjksIDAuMCk7XG4gICAgICogaXRlcmF0b3IuZWxlbWVudFtwYy5TRU1BTlRJQ19DT0xPUl0uc2V0KDAsIDAsIDI1NSwgMjU1KTtcbiAgICAgKiBpdGVyYXRvci5lbmQoKTtcbiAgICAgKi9cbiAgICBuZXh0KGNvdW50ID0gMSkge1xuICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgIGNvbnN0IGFjY2Vzc29ycyA9IHRoaXMuYWNjZXNzb3JzO1xuICAgICAgICBjb25zdCBudW1BY2Nlc3NvcnMgPSB0aGlzLmFjY2Vzc29ycy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpIDwgbnVtQWNjZXNzb3JzKSB7XG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NvciA9IGFjY2Vzc29yc1tpKytdO1xuICAgICAgICAgICAgYWNjZXNzb3IuaW5kZXggKz0gY291bnQgKiBhY2Nlc3Nvci5zdHJpZGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBOb3RpZmllcyB0aGUgdmVydGV4IGJ1ZmZlciBiZWluZyBpdGVyYXRlZCB0aGF0IHdyaXRlcyBhcmUgY29tcGxldGUuIEludGVybmFsbHkgdGhlIHZlcnRleFxuICAgICAqIGJ1ZmZlciBpcyB1bmxvY2tlZCBhbmQgdmVydGV4IGRhdGEgaXMgdXBsb2FkZWQgdG8gdmlkZW8gbWVtb3J5LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBpdGVyYXRvciA9IG5ldyBwYy5WZXJ0ZXhJdGVyYXRvcih2ZXJ0ZXhCdWZmZXIpO1xuICAgICAqIGl0ZXJhdG9yLmVsZW1lbnRbcGMuU0VNQU5USUNfUE9TSVRJT05dLnNldCgtMC45LCAtMC45LCAwLjApO1xuICAgICAqIGl0ZXJhdG9yLmVsZW1lbnRbcGMuU0VNQU5USUNfQ09MT1JdLnNldCgyNTUsIDAsIDAsIDI1NSk7XG4gICAgICogaXRlcmF0b3IubmV4dCgpO1xuICAgICAqIGl0ZXJhdG9yLmVsZW1lbnRbcGMuU0VNQU5USUNfUE9TSVRJT05dLnNldCgwLjksIC0wLjksIDAuMCk7XG4gICAgICogaXRlcmF0b3IuZWxlbWVudFtwYy5TRU1BTlRJQ19DT0xPUl0uc2V0KDAsIDI1NSwgMCwgMjU1KTtcbiAgICAgKiBpdGVyYXRvci5uZXh0KCk7XG4gICAgICogaXRlcmF0b3IuZWxlbWVudFtwYy5TRU1BTlRJQ19QT1NJVElPTl0uc2V0KDAuMCwgMC45LCAwLjApO1xuICAgICAqIGl0ZXJhdG9yLmVsZW1lbnRbcGMuU0VNQU5USUNfQ09MT1JdLnNldCgwLCAwLCAyNTUsIDI1NSk7XG4gICAgICogaXRlcmF0b3IuZW5kKCk7XG4gICAgICovXG4gICAgZW5kKCkge1xuICAgICAgICAvLyBVbmxvY2sgdGhlIHZlcnRleCBidWZmZXJcbiAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIGRhdGEgZm9yIHNwZWNpZmllZCBzZW1hbnRpYyBpbnRvIHZlcnRleCBidWZmZXIuIFdvcmtzIHdpdGggYm90aCBpbnRlcmxlYXZlZCAoc2xvd2VyKVxuICAgICAqIGFuZCBub24taW50ZXJsZWF2ZWQgKGZhc3QpIHZlcnRleCBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbWFudGljIC0gVGhlIHNlbWFudGljIG9mIHRoZSB2ZXJ0ZXggZWxlbWVudCB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxJbnQ4QXJyYXl8VWludDhBcnJheXxVaW50OENsYW1wZWRBcnJheXxJbnQxNkFycmF5fFVpbnQxNkFycmF5fEludDMyQXJyYXl8VWludDMyQXJyYXl8RmxvYXQzMkFycmF5fSBkYXRhIC0gVGhlIGRhdGEgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1WZXJ0aWNlcyAtIFRoZSBudW1iZXIgb2YgdmVydGljZXMgdG8gd3JpdGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHdyaXRlRGF0YShzZW1hbnRpYywgZGF0YSwgbnVtVmVydGljZXMpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudFtzZW1hbnRpY107XG4gICAgICAgIGlmIChlbGVtZW50KSB7XG5cbiAgICAgICAgICAgIGlmIChudW1WZXJ0aWNlcyA+IHRoaXMudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE51bVZlcnRpY2VzIHByb3ZpZGVkIHRvIHNldERhdGE6ICR7bnVtVmVydGljZXN9IGlzIGxhcmdlciB0aGFuIHNwYWNlIGluIFZlcnRleEJ1ZmZlcjogJHt0aGlzLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlc31gKTtcblxuICAgICAgICAgICAgICAgIC8vIGF2b2lkIG92ZXJ3cml0ZVxuICAgICAgICAgICAgICAgIG51bVZlcnRpY2VzID0gdGhpcy52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG51bUNvbXBvbmVudHMgPSBlbGVtZW50Lm51bUNvbXBvbmVudHM7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgZGF0YSB0byBpbnRlcmxlYXZlZCBidWZmZXIgYnkgbG9vcGluZyBvdmVyIHZlcnRpY2VzIGFuZCBjb3B5aW5nIHRoZW0gbWFudWFsbHlcbiAgICAgICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlci5nZXRGb3JtYXQoKS5pbnRlcmxlYXZlZCkge1xuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc2V0RnJvbUFycmF5KGluZGV4LCBkYXRhLCBpICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ICs9IGVsZW1lbnQuc3RyaWRlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7ICAgIC8vIG5vbi1pbnRlcmxlYXZlZCBjb3B5XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBkYXRhIGNvbnRhaW5zIG1vcmUgIGRhdGEgdGhhbiBuZWVkZWQsIGNvcHkgZnJvbSBpdHMgc3ViYXJyYXlcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5sZW5ndGggPiBudW1WZXJ0aWNlcyAqIG51bUNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29weUNvdW50ID0gbnVtVmVydGljZXMgKiBudW1Db21wb25lbnRzO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIGRhdGEgaXMgdHlwZWQgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhkYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IGRhdGEuc3ViYXJyYXkoMCwgY29weUNvdW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuYXJyYXkuc2V0KGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGF0YSBpcyBhcnJheSwgY29weSByaWdodCBhbW91bnQgbWFudWFsbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29weUNvdW50OyBpKyspXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hcnJheVtpXSA9IGRhdGFbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb3B5IHdob2xlIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hcnJheS5zZXQoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVuY3Rpb24gdG8gZXh0cmFjdCBlbGVtZW50cyBvZiBhIHNwZWNpZmllZCBzZW1hbnRpYyBmcm9tIHZlcnRleCBidWZmZXIgaW50byBmbGF0IGFycmF5XG4gICAgICogKGRhdGEpLiBXb3JrcyB3aXRoIGJvdGggaW50ZXJsZWF2ZWQgKHNsb3dlcikgYW5kIG5vbi1pbnRlcmxlYXZlZCAoZmFzdCkgdmVydGV4IGJ1ZmZlcnMuXG4gICAgICogUmV0dXJucyBudW1iZXIgb2YgdmVydGljZXMuIE5vdGU6IHdoZW4gZGF0YSBpcyBhIHR5cGVkIGFycmF5IGFuZCBpcyBzbWFsbGVyIHRoYW4gbmVlZGVkLFxuICAgICAqIG9ubHkgcGFydCBvZiB0aGUgZGF0YSBnZXRzIGNvcGllZCBvdXQgKHR5cGVkIGFycmF5cyBpZ25vcmUgcmVhZC93cml0ZSBvdXQgb2YgcmFuZ2UpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbWFudGljIC0gVGhlIHNlbWFudGljIG9mIHRoZSB2ZXJ0ZXggZWxlbWVudCB0byByZWFkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118SW50OEFycmF5fFVpbnQ4QXJyYXl8VWludDhDbGFtcGVkQXJyYXl8SW50MTZBcnJheXxVaW50MTZBcnJheXxJbnQzMkFycmF5fFVpbnQzMkFycmF5fEZsb2F0MzJBcnJheX0gZGF0YSAtIFRoZVxuICAgICAqIGFycmF5IHRvIHJlY2VpdmUgdGhlIGRhdGEuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG51bWJlciBvZiB2ZXJ0aWNlcyByZWFkLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZWFkRGF0YShzZW1hbnRpYywgZGF0YSkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50W3NlbWFudGljXTtcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvdW50ID0gdGhpcy52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICBsZXQgaTtcbiAgICAgICAgICAgIGNvbnN0IG51bUNvbXBvbmVudHMgPSBlbGVtZW50Lm51bUNvbXBvbmVudHM7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlci5nZXRGb3JtYXQoKS5pbnRlcmxlYXZlZCkge1xuXG4gICAgICAgICAgICAgICAgLy8gZXh0cmFjdCBkYXRhIGZyb20gaW50ZXJsZWF2ZWQgYnVmZmVyIGJ5IGxvb3Bpbmcgb3ZlciB2ZXJ0aWNlcyBhbmQgY29weWluZyB0aGVtIG1hbnVhbGx5XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpXG4gICAgICAgICAgICAgICAgICAgIGRhdGEubGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgICAgIGVsZW1lbnQuaW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIGxldCBvZmZzZXQgPSAwO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuZ2V0VG9BcnJheShvZmZzZXQsIGRhdGEsIGkgKiBudW1Db21wb25lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ICs9IGVsZW1lbnQuc3RyaWRlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhkYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbiBkYXRhIGlzIHR5cGVkIGFycmF5XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuc2V0KGVsZW1lbnQuYXJyYXkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uIGRhdGEgaXMgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb3B5Q291bnQgPSBjb3VudCAqIG51bUNvbXBvbmVudHM7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjb3B5Q291bnQ7IGkrKylcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbaV0gPSBlbGVtZW50LmFycmF5W2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb3VudDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFZlcnRleEl0ZXJhdG9yLCBWZXJ0ZXhJdGVyYXRvckFjY2Vzc29yIH07XG4iXSwibmFtZXMiOlsic2V0MSIsImEiLCJhcnJheSIsImluZGV4Iiwic2V0MiIsImIiLCJzZXQzIiwiYyIsInNldDQiLCJkIiwiYXJyYXlTZXQxIiwiaW5wdXRBcnJheSIsImlucHV0SW5kZXgiLCJhcnJheVNldDIiLCJhcnJheVNldDMiLCJhcnJheVNldDQiLCJhcnJheUdldDEiLCJvZmZzZXQiLCJvdXRwdXRBcnJheSIsIm91dHB1dEluZGV4IiwiYXJyYXlHZXQyIiwiYXJyYXlHZXQzIiwiYXJyYXlHZXQ0IiwiVmVydGV4SXRlcmF0b3JBY2Nlc3NvciIsImNvbnN0cnVjdG9yIiwiYnVmZmVyIiwidmVydGV4RWxlbWVudCIsInZlcnRleEZvcm1hdCIsIm51bUNvbXBvbmVudHMiLCJpbnRlcmxlYXZlZCIsInR5cGVkQXJyYXlUeXBlcyIsImRhdGFUeXBlIiwidmVydGV4Q291bnQiLCJzdHJpZGUiLCJCWVRFU19QRVJfRUxFTUVOVCIsInNldCIsImdldFRvQXJyYXkiLCJzZXRGcm9tQXJyYXkiLCJnZXQiLCJWZXJ0ZXhJdGVyYXRvciIsInZlcnRleEJ1ZmZlciIsInZlcnRleEZvcm1hdFNpemUiLCJnZXRGb3JtYXQiLCJzaXplIiwibG9jayIsImFjY2Vzc29ycyIsImVsZW1lbnQiLCJpIiwiZWxlbWVudHMiLCJsZW5ndGgiLCJuYW1lIiwibmV4dCIsImNvdW50IiwibnVtQWNjZXNzb3JzIiwiYWNjZXNzb3IiLCJlbmQiLCJ1bmxvY2siLCJ3cml0ZURhdGEiLCJzZW1hbnRpYyIsImRhdGEiLCJudW1WZXJ0aWNlcyIsIkRlYnVnIiwiZXJyb3IiLCJjb3B5Q291bnQiLCJBcnJheUJ1ZmZlciIsImlzVmlldyIsInN1YmFycmF5IiwicmVhZERhdGEiLCJBcnJheSIsImlzQXJyYXkiXSwibWFwcGluZ3MiOiI7OztBQUdBLFNBQVNBLElBQUlBLENBQUNDLENBQUMsRUFBRTtFQUNiLElBQUksQ0FBQ0MsS0FBSyxDQUFDLElBQUksQ0FBQ0MsS0FBSyxDQUFDLEdBQUdGLENBQUMsQ0FBQTtBQUM5QixDQUFBO0FBRUEsU0FBU0csSUFBSUEsQ0FBQ0gsQ0FBQyxFQUFFSSxDQUFDLEVBQUU7RUFDaEIsSUFBSSxDQUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDQyxLQUFLLENBQUMsR0FBR0YsQ0FBQyxDQUFBO0VBQzFCLElBQUksQ0FBQ0MsS0FBSyxDQUFDLElBQUksQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHRSxDQUFDLENBQUE7QUFDbEMsQ0FBQTtBQUVBLFNBQVNDLElBQUlBLENBQUNMLENBQUMsRUFBRUksQ0FBQyxFQUFFRSxDQUFDLEVBQUU7RUFDbkIsSUFBSSxDQUFDTCxLQUFLLENBQUMsSUFBSSxDQUFDQyxLQUFLLENBQUMsR0FBR0YsQ0FBQyxDQUFBO0VBQzFCLElBQUksQ0FBQ0MsS0FBSyxDQUFDLElBQUksQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHRSxDQUFDLENBQUE7RUFDOUIsSUFBSSxDQUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUdJLENBQUMsQ0FBQTtBQUNsQyxDQUFBO0FBRUEsU0FBU0MsSUFBSUEsQ0FBQ1AsQ0FBQyxFQUFFSSxDQUFDLEVBQUVFLENBQUMsRUFBRUUsQ0FBQyxFQUFFO0VBQ3RCLElBQUksQ0FBQ1AsS0FBSyxDQUFDLElBQUksQ0FBQ0MsS0FBSyxDQUFDLEdBQUdGLENBQUMsQ0FBQTtFQUMxQixJQUFJLENBQUNDLEtBQUssQ0FBQyxJQUFJLENBQUNDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBR0UsQ0FBQyxDQUFBO0VBQzlCLElBQUksQ0FBQ0gsS0FBSyxDQUFDLElBQUksQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHSSxDQUFDLENBQUE7RUFDOUIsSUFBSSxDQUFDTCxLQUFLLENBQUMsSUFBSSxDQUFDQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUdNLENBQUMsQ0FBQTtBQUNsQyxDQUFBO0FBRUEsU0FBU0MsU0FBU0EsQ0FBQ1AsS0FBSyxFQUFFUSxVQUFVLEVBQUVDLFVBQVUsRUFBRTtFQUM5QyxJQUFJLENBQUNWLEtBQUssQ0FBQ0MsS0FBSyxDQUFDLEdBQUdRLFVBQVUsQ0FBQ0MsVUFBVSxDQUFDLENBQUE7QUFDOUMsQ0FBQTtBQUVBLFNBQVNDLFNBQVNBLENBQUNWLEtBQUssRUFBRVEsVUFBVSxFQUFFQyxVQUFVLEVBQUU7RUFDOUMsSUFBSSxDQUFDVixLQUFLLENBQUNDLEtBQUssQ0FBQyxHQUFHUSxVQUFVLENBQUNDLFVBQVUsQ0FBQyxDQUFBO0FBQzFDLEVBQUEsSUFBSSxDQUFDVixLQUFLLENBQUNDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBR1EsVUFBVSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDdEQsQ0FBQTtBQUVBLFNBQVNFLFNBQVNBLENBQUNYLEtBQUssRUFBRVEsVUFBVSxFQUFFQyxVQUFVLEVBQUU7RUFDOUMsSUFBSSxDQUFDVixLQUFLLENBQUNDLEtBQUssQ0FBQyxHQUFHUSxVQUFVLENBQUNDLFVBQVUsQ0FBQyxDQUFBO0FBQzFDLEVBQUEsSUFBSSxDQUFDVixLQUFLLENBQUNDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBR1EsVUFBVSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDbEQsRUFBQSxJQUFJLENBQUNWLEtBQUssQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHUSxVQUFVLENBQUNDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN0RCxDQUFBO0FBRUEsU0FBU0csU0FBU0EsQ0FBQ1osS0FBSyxFQUFFUSxVQUFVLEVBQUVDLFVBQVUsRUFBRTtFQUM5QyxJQUFJLENBQUNWLEtBQUssQ0FBQ0MsS0FBSyxDQUFDLEdBQUdRLFVBQVUsQ0FBQ0MsVUFBVSxDQUFDLENBQUE7QUFDMUMsRUFBQSxJQUFJLENBQUNWLEtBQUssQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHUSxVQUFVLENBQUNDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNsRCxFQUFBLElBQUksQ0FBQ1YsS0FBSyxDQUFDQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUdRLFVBQVUsQ0FBQ0MsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2xELEVBQUEsSUFBSSxDQUFDVixLQUFLLENBQUNDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBR1EsVUFBVSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDdEQsQ0FBQTtBQUVBLFNBQVNJLFNBQVNBLENBQUNDLE1BQU0sRUFBRUMsV0FBVyxFQUFFQyxXQUFXLEVBQUU7RUFDakRELFdBQVcsQ0FBQ0MsV0FBVyxDQUFDLEdBQUcsSUFBSSxDQUFDakIsS0FBSyxDQUFDZSxNQUFNLENBQUMsQ0FBQTtBQUNqRCxDQUFBO0FBRUEsU0FBU0csU0FBU0EsQ0FBQ0gsTUFBTSxFQUFFQyxXQUFXLEVBQUVDLFdBQVcsRUFBRTtFQUNqREQsV0FBVyxDQUFDQyxXQUFXLENBQUMsR0FBRyxJQUFJLENBQUNqQixLQUFLLENBQUNlLE1BQU0sQ0FBQyxDQUFBO0FBQzdDQyxFQUFBQSxXQUFXLENBQUNDLFdBQVcsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUNqQixLQUFLLENBQUNlLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN6RCxDQUFBO0FBRUEsU0FBU0ksU0FBU0EsQ0FBQ0osTUFBTSxFQUFFQyxXQUFXLEVBQUVDLFdBQVcsRUFBRTtFQUNqREQsV0FBVyxDQUFDQyxXQUFXLENBQUMsR0FBRyxJQUFJLENBQUNqQixLQUFLLENBQUNlLE1BQU0sQ0FBQyxDQUFBO0FBQzdDQyxFQUFBQSxXQUFXLENBQUNDLFdBQVcsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUNqQixLQUFLLENBQUNlLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNyREMsRUFBQUEsV0FBVyxDQUFDQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDakIsS0FBSyxDQUFDZSxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDekQsQ0FBQTtBQUVBLFNBQVNLLFNBQVNBLENBQUNMLE1BQU0sRUFBRUMsV0FBVyxFQUFFQyxXQUFXLEVBQUU7RUFDakRELFdBQVcsQ0FBQ0MsV0FBVyxDQUFDLEdBQUcsSUFBSSxDQUFDakIsS0FBSyxDQUFDZSxNQUFNLENBQUMsQ0FBQTtBQUM3Q0MsRUFBQUEsV0FBVyxDQUFDQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDakIsS0FBSyxDQUFDZSxNQUFNLEdBQUcsQ0FBQyxDQUFD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
