/**
 * A WebGPU implementation of the Buffer.
 *
 * @ignore
 */
class WebgpuBuffer {
  constructor() {
    this.buffer = null;
  }
  destroy(device) {
    if (this.buffer) {
      this.buffer.destroy();
      this.buffer = null;
    }
  }
  get initialized() {
    return !!this.buffer;
  }
  loseContext() {}

  /**
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - Graphics device.
   * @param {*} usage -
   * @param {*} target -
   * @param {*} storage -
   */
  unlock(device, usage, target, storage) {
    var _storage$byteOffset, _storage$buffer;
    const wgpu = device.wgpu;

    // offset of getMappedRange must me a multiple of 8
    // size of getMappedRange must be a multiple of 4

    if (!this.buffer) {
      // size needs to be a multiple of 4
      const size = storage.byteLength + 3 & ~3;
      this.buffer = device.wgpu.createBuffer({
        size: size,
        usage: target | GPUBufferUsage.COPY_DST
      });

      // mappedAtCreation path - this could be used when the data is provided

      // this.buffer = device.wgpu.createBuffer({
      //     size: size,
      //     usage: target,
      //     mappedAtCreation: true
      // });

      // const dest = new Uint8Array(this.buffer.getMappedRange());
      // const src = new Uint8Array(storage.buffer ? storage.buffer : storage);
      // dest.set(src);
      // this.buffer.unmap();
    }

    // src size needs to be a multiple of 4 as well
    const srcOffset = (_storage$byteOffset = storage.byteOffset) != null ? _storage$byteOffset : 0;
    const srcData = new Uint8Array((_storage$buffer = storage.buffer) != null ? _storage$buffer : storage, srcOffset, storage.byteLength);
    const data = new Uint8Array(this.buffer.size);
    data.set(srcData);

    // copy data to the gpu buffer
    wgpu.queue.writeBuffer(this.buffer, 0, data, 0, data.length);

    // TODO: handle usage types:
    // - BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, BUFFER_GPUDYNAMIC
  }
}

export { WebgpuBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtYnVmZmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSBXZWJHUFUgaW1wbGVtZW50YXRpb24gb2YgdGhlIEJ1ZmZlci5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdwdUJ1ZmZlciB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVUJ1ZmZlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGJ1ZmZlciA9IG51bGw7XG5cbiAgICBkZXN0cm95KGRldmljZSkge1xuICAgICAgICBpZiAodGhpcy5idWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbml0aWFsaXplZCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5idWZmZXI7XG4gICAgfVxuXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vd2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdwdUdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBHcmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHsqfSB1c2FnZSAtXG4gICAgICogQHBhcmFtIHsqfSB0YXJnZXQgLVxuICAgICAqIEBwYXJhbSB7Kn0gc3RvcmFnZSAtXG4gICAgICovXG4gICAgdW5sb2NrKGRldmljZSwgdXNhZ2UsIHRhcmdldCwgc3RvcmFnZSkge1xuXG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcblxuICAgICAgICAvLyBvZmZzZXQgb2YgZ2V0TWFwcGVkUmFuZ2UgbXVzdCBtZSBhIG11bHRpcGxlIG9mIDhcbiAgICAgICAgLy8gc2l6ZSBvZiBnZXRNYXBwZWRSYW5nZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNFxuXG4gICAgICAgIGlmICghdGhpcy5idWZmZXIpIHtcbiAgICAgICAgICAgIC8vIHNpemUgbmVlZHMgdG8gYmUgYSBtdWx0aXBsZSBvZiA0XG4gICAgICAgICAgICBjb25zdCBzaXplID0gKHN0b3JhZ2UuYnl0ZUxlbmd0aCArIDMpICYgfjM7XG5cbiAgICAgICAgICAgIHRoaXMuYnVmZmVyID0gZGV2aWNlLndncHUuY3JlYXRlQnVmZmVyKHtcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIHVzYWdlOiB0YXJnZXQgfCBHUFVCdWZmZXJVc2FnZS5DT1BZX0RTVFxuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgLy8gbWFwcGVkQXRDcmVhdGlvbiBwYXRoIC0gdGhpcyBjb3VsZCBiZSB1c2VkIHdoZW4gdGhlIGRhdGEgaXMgcHJvdmlkZWRcblxuICAgICAgICAgICAgLy8gdGhpcy5idWZmZXIgPSBkZXZpY2Uud2dwdS5jcmVhdGVCdWZmZXIoe1xuICAgICAgICAgICAgLy8gICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICAvLyAgICAgdXNhZ2U6IHRhcmdldCxcbiAgICAgICAgICAgIC8vICAgICBtYXBwZWRBdENyZWF0aW9uOiB0cnVlXG4gICAgICAgICAgICAvLyB9KTtcblxuICAgICAgICAgICAgLy8gY29uc3QgZGVzdCA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmdldE1hcHBlZFJhbmdlKCkpO1xuICAgICAgICAgICAgLy8gY29uc3Qgc3JjID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZS5idWZmZXIgPyBzdG9yYWdlLmJ1ZmZlciA6IHN0b3JhZ2UpO1xuICAgICAgICAgICAgLy8gZGVzdC5zZXQoc3JjKTtcbiAgICAgICAgICAgIC8vIHRoaXMuYnVmZmVyLnVubWFwKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzcmMgc2l6ZSBuZWVkcyB0byBiZSBhIG11bHRpcGxlIG9mIDQgYXMgd2VsbFxuICAgICAgICBjb25zdCBzcmNPZmZzZXQgPSBzdG9yYWdlLmJ5dGVPZmZzZXQgPz8gMDtcbiAgICAgICAgY29uc3Qgc3JjRGF0YSA9IG5ldyBVaW50OEFycmF5KHN0b3JhZ2UuYnVmZmVyID8/IHN0b3JhZ2UsIHNyY09mZnNldCwgc3RvcmFnZS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLnNpemUpO1xuICAgICAgICBkYXRhLnNldChzcmNEYXRhKTtcblxuICAgICAgICAvLyBjb3B5IGRhdGEgdG8gdGhlIGdwdSBidWZmZXJcbiAgICAgICAgd2dwdS5xdWV1ZS53cml0ZUJ1ZmZlcih0aGlzLmJ1ZmZlciwgMCwgZGF0YSwgMCwgZGF0YS5sZW5ndGgpO1xuXG4gICAgICAgIC8vIFRPRE86IGhhbmRsZSB1c2FnZSB0eXBlczpcbiAgICAgICAgLy8gLSBCVUZGRVJfU1RBVElDLCBCVUZGRVJfRFlOQU1JQywgQlVGRkVSX1NUUkVBTSwgQlVGRkVSX0dQVURZTkFNSUNcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdwdUJ1ZmZlciB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdUJ1ZmZlciIsImNvbnN0cnVjdG9yIiwiYnVmZmVyIiwiZGVzdHJveSIsImRldmljZSIsImluaXRpYWxpemVkIiwibG9zZUNvbnRleHQiLCJ1bmxvY2siLCJ1c2FnZSIsInRhcmdldCIsInN0b3JhZ2UiLCJfc3RvcmFnZSRieXRlT2Zmc2V0IiwiX3N0b3JhZ2UkYnVmZmVyIiwid2dwdSIsInNpemUiLCJieXRlTGVuZ3RoIiwiY3JlYXRlQnVmZmVyIiwiR1BVQnVmZmVyVXNhZ2UiLCJDT1BZX0RTVCIsInNyY09mZnNldCIsImJ5dGVPZmZzZXQiLCJzcmNEYXRhIiwiVWludDhBcnJheSIsImRhdGEiLCJzZXQiLCJxdWV1ZSIsIndyaXRlQnVmZmVyIiwibGVuZ3RoIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsWUFBWSxDQUFDO0VBQUFDLFdBQUEsR0FBQTtJQUFBLElBS2ZDLENBQUFBLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFBQSxHQUFBO0VBRWJDLE9BQU9BLENBQUNDLE1BQU0sRUFBRTtJQUNaLElBQUksSUFBSSxDQUFDRixNQUFNLEVBQUU7QUFDYixNQUFBLElBQUksQ0FBQ0EsTUFBTSxDQUFDQyxPQUFPLEVBQUUsQ0FBQTtNQUNyQixJQUFJLENBQUNELE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDdEIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJRyxXQUFXQSxHQUFHO0FBQ2QsSUFBQSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUNILE1BQU0sQ0FBQTtBQUN4QixHQUFBO0VBRUFJLFdBQVdBLEdBQUcsRUFDZDs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsTUFBTUEsQ0FBQ0gsTUFBTSxFQUFFSSxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsT0FBTyxFQUFFO0lBQUEsSUFBQUMsbUJBQUEsRUFBQUMsZUFBQSxDQUFBO0FBRW5DLElBQUEsTUFBTUMsSUFBSSxHQUFHVCxNQUFNLENBQUNTLElBQUksQ0FBQTs7QUFFeEI7QUFDQTs7QUFFQSxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNYLE1BQU0sRUFBRTtBQUNkO01BQ0EsTUFBTVksSUFBSSxHQUFJSixPQUFPLENBQUNLLFVBQVUsR0FBRyxDQUFDLEdBQUksQ0FBQyxDQUFDLENBQUE7TUFFMUMsSUFBSSxDQUFDYixNQUFNLEdBQUdFLE1BQU0sQ0FBQ1MsSUFBSSxDQUFDRyxZQUFZLENBQUM7QUFDbkNGLFFBQUFBLElBQUksRUFBRUEsSUFBSTtBQUNWTixRQUFBQSxLQUFLLEVBQUVDLE1BQU0sR0FBR1EsY0FBYyxDQUFDQyxRQUFBQTtBQUNuQyxPQUFDLENBQUMsQ0FBQTs7QUFHRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0osS0FBQTs7QUFFQTtJQUNBLE1BQU1DLFNBQVMsR0FBQVIsQ0FBQUEsbUJBQUEsR0FBR0QsT0FBTyxDQUFDVSxVQUFVLEtBQUEsSUFBQSxHQUFBVCxtQkFBQSxHQUFJLENBQUMsQ0FBQTtJQUN6QyxNQUFNVSxPQUFPLEdBQUcsSUFBSUMsVUFBVSxFQUFBVixlQUFBLEdBQUNGLE9BQU8sQ0FBQ1IsTUFBTSxZQUFBVSxlQUFBLEdBQUlGLE9BQU8sRUFBRVMsU0FBUyxFQUFFVCxPQUFPLENBQUNLLFVBQVUsQ0FBQyxDQUFBO0lBQ3hGLE1BQU1RLElBQUksR0FBRyxJQUFJRCxVQUFVLENBQUMsSUFBSSxDQUFDcEIsTUFBTSxDQUFDWSxJQUFJLENBQUMsQ0FBQTtBQUM3Q1MsSUFBQUEsSUFBSSxDQUFDQyxHQUFHLENBQUNILE9BQU8sQ0FBQyxDQUFBOztBQUVqQjtBQUNBUixJQUFBQSxJQUFJLENBQUNZLEtBQUssQ0FBQ0MsV0FBVyxDQUFDLElBQUksQ0FBQ3hCLE1BQU0sRUFBRSxDQUFDLEVBQUVxQixJQUFJLEVBQUUsQ0FBQyxFQUFFQSxJQUFJLENBQUNJLE1BQU0sQ0FBQyxDQUFBOztBQUU1RDtBQUNBO0FBQ0osR0FBQTtBQUNKOzs7OyJ9
