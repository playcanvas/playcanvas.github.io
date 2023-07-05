import '../../core/debug.js';
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
class VertexIteratorAccessor {
	constructor(buffer, vertexElement, vertexFormat) {
		this.index = 0;
		this.numComponents = vertexElement.numComponents;
		if (vertexFormat.interleaved) {
			this.array = new typedArrayTypes[vertexElement.dataType](buffer, vertexElement.offset);
		} else {
			this.array = new typedArrayTypes[vertexElement.dataType](buffer, vertexElement.offset, vertexFormat.vertexCount * vertexElement.numComponents);
		}
		this.stride = vertexElement.stride / this.array.constructor.BYTES_PER_ELEMENT;
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
	get(offset) {
		return this.array[this.index + offset];
	}
	set(a, b, c, d) {}
	getToArray(offset, outputArray, outputIndex) {}
	setFromArray(index, inputArray, inputIndex) {}
}
class VertexIterator {
	constructor(vertexBuffer) {
		this.vertexBuffer = vertexBuffer;
		this.vertexFormatSize = vertexBuffer.getFormat().size;
		this.buffer = this.vertexBuffer.lock();
		this.accessors = [];
		this.element = {};
		const vertexFormat = this.vertexBuffer.getFormat();
		for (let i = 0; i < vertexFormat.elements.length; i++) {
			const vertexElement = vertexFormat.elements[i];
			this.accessors[i] = new VertexIteratorAccessor(this.buffer, vertexElement, vertexFormat);
			this.element[vertexElement.name] = this.accessors[i];
		}
	}
	next(count = 1) {
		let i = 0;
		const accessors = this.accessors;
		const numAccessors = this.accessors.length;
		while (i < numAccessors) {
			const accessor = accessors[i++];
			accessor.index += count * accessor.stride;
		}
	}
	end() {
		this.vertexBuffer.unlock();
	}
	writeData(semantic, data, numVertices) {
		const element = this.element[semantic];
		if (element) {
			if (numVertices > this.vertexBuffer.numVertices) {
				numVertices = this.vertexBuffer.numVertices;
			}
			const numComponents = element.numComponents;
			if (this.vertexBuffer.getFormat().interleaved) {
				let index = 0;
				for (let i = 0; i < numVertices; i++) {
					element.setFromArray(index, data, i * numComponents);
					index += element.stride;
				}
			} else {
				if (data.length > numVertices * numComponents) {
					const copyCount = numVertices * numComponents;
					if (ArrayBuffer.isView(data)) {
						data = data.subarray(0, copyCount);
						element.array.set(data);
					} else {
						for (let i = 0; i < copyCount; i++) element.array[i] = data[i];
					}
				} else {
					element.array.set(data);
				}
			}
		}
	}
	readData(semantic, data) {
		const element = this.element[semantic];
		let count = 0;
		if (element) {
			count = this.vertexBuffer.numVertices;
			let i;
			const numComponents = element.numComponents;
			if (this.vertexBuffer.getFormat().interleaved) {
				if (Array.isArray(data)) data.length = 0;
				element.index = 0;
				let offset = 0;
				for (i = 0; i < count; i++) {
					element.getToArray(offset, data, i * numComponents);
					offset += element.stride;
				}
			} else {
				if (ArrayBuffer.isView(data)) {
					data.set(element.array);
				} else {
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
