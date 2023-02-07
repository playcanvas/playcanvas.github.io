/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Version } from './version.js';

let idCounter = 0;
class VersionedObject {
  constructor() {
    // Increment the global object ID counter
    idCounter++;

    // Create a version for this object
    this.version = new Version();

    // Set the unique object ID
    this.version.globalId = idCounter;
  }
  increment() {
    // Increment the revision number
    this.version.revision++;
  }
}

export { VersionedObject };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVyc2lvbmVkLW9iamVjdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnNpb25lZC1vYmplY3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVyc2lvbiB9IGZyb20gJy4vdmVyc2lvbi5qcyc7XG5cbmxldCBpZENvdW50ZXIgPSAwO1xuXG5jbGFzcyBWZXJzaW9uZWRPYmplY3Qge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBJbmNyZW1lbnQgdGhlIGdsb2JhbCBvYmplY3QgSUQgY291bnRlclxuICAgICAgICBpZENvdW50ZXIrKztcblxuICAgICAgICAvLyBDcmVhdGUgYSB2ZXJzaW9uIGZvciB0aGlzIG9iamVjdFxuICAgICAgICB0aGlzLnZlcnNpb24gPSBuZXcgVmVyc2lvbigpO1xuXG4gICAgICAgIC8vIFNldCB0aGUgdW5pcXVlIG9iamVjdCBJRFxuICAgICAgICB0aGlzLnZlcnNpb24uZ2xvYmFsSWQgPSBpZENvdW50ZXI7XG4gICAgfVxuXG4gICAgaW5jcmVtZW50KCkge1xuICAgICAgICAvLyBJbmNyZW1lbnQgdGhlIHJldmlzaW9uIG51bWJlclxuICAgICAgICB0aGlzLnZlcnNpb24ucmV2aXNpb24rKztcbiAgICB9XG59XG5cbmV4cG9ydCB7IFZlcnNpb25lZE9iamVjdCB9O1xuIl0sIm5hbWVzIjpbImlkQ291bnRlciIsIlZlcnNpb25lZE9iamVjdCIsImNvbnN0cnVjdG9yIiwidmVyc2lvbiIsIlZlcnNpb24iLCJnbG9iYWxJZCIsImluY3JlbWVudCIsInJldmlzaW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUEsSUFBSUEsU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUVqQixNQUFNQyxlQUFlLENBQUM7QUFDbEJDLEVBQUFBLFdBQVcsR0FBRztBQUNWO0FBQ0FGLElBQUFBLFNBQVMsRUFBRSxDQUFBOztBQUVYO0FBQ0EsSUFBQSxJQUFJLENBQUNHLE9BQU8sR0FBRyxJQUFJQyxPQUFPLEVBQUUsQ0FBQTs7QUFFNUI7QUFDQSxJQUFBLElBQUksQ0FBQ0QsT0FBTyxDQUFDRSxRQUFRLEdBQUdMLFNBQVMsQ0FBQTtBQUNyQyxHQUFBO0FBRUFNLEVBQUFBLFNBQVMsR0FBRztBQUNSO0FBQ0EsSUFBQSxJQUFJLENBQUNILE9BQU8sQ0FBQ0ksUUFBUSxFQUFFLENBQUE7QUFDM0IsR0FBQTtBQUNKOzs7OyJ9
