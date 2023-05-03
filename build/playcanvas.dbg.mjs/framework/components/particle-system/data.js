import { Vec3 } from '../../../core/math/vec3.js';
import { EMITTERSHAPE_BOX, PARTICLEMODE_GPU, PARTICLEORIENTATION_SCREEN, BLEND_NORMAL, LAYERID_WORLD } from '../../../scene/constants.js';

class ParticleSystemComponentData {
  constructor() {
    this.numParticles = 1; // Amount of particles allocated (max particles = max GL texture width at this moment)
    this.rate = 1; // Emission rate
    this.rate2 = null;
    this.startAngle = 0;
    this.startAngle2 = null;
    this.lifetime = 50; // Particle lifetime
    this.emitterExtents = new Vec3(); // Spawn point divergence
    this.emitterExtentsInner = new Vec3();
    this.emitterRadius = 0;
    this.emitterRadiusInner = 0;
    this.emitterShape = EMITTERSHAPE_BOX;
    this.initialVelocity = 0;
    this.wrapBounds = new Vec3();
    this.localSpace = false;
    this.screenSpace = false;
    this.colorMap = null;
    this.colorMapAsset = null;
    this.normalMap = null;
    this.normalMapAsset = null;
    this.loop = true;
    this.preWarm = false;
    this.sort = 0; // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;   Forces CPU mode if not 0
    this.mode = PARTICLEMODE_GPU;
    this.scene = null;
    this.lighting = false;
    this.halfLambert = false; // Uses half-lambert lighting instead of Lambert
    this.intensity = 1;
    this.stretch = 0.0;
    this.alignToMotion = false;
    this.depthSoftening = 0;
    this.meshAsset = null;
    this.mesh = null; // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
    // Leave undefined to use simple quads
    this.depthWrite = false;
    this.noFog = false;
    this.orientation = PARTICLEORIENTATION_SCREEN;
    this.particleNormal = new Vec3(0, 1, 0);
    this.animTilesX = 1;
    this.animTilesY = 1;
    this.animStartFrame = 0;
    this.animNumFrames = 1;
    this.animNumAnimations = 1;
    this.animIndex = 0;
    this.randomizeAnimIndex = false;
    this.animSpeed = 1;
    this.animLoop = true;

    // Time-dependent parameters
    this.scaleGraph = null;
    this.scaleGraph2 = null;
    this.colorGraph = null;
    this.colorGraph2 = null;
    this.alphaGraph = null;
    this.alphaGraph2 = null;
    this.localVelocityGraph = null;
    this.localVelocityGraph2 = null;
    this.velocityGraph = null;
    this.velocityGraph2 = null;
    this.rotationSpeedGraph = null;
    this.rotationSpeedGraph2 = null;
    this.radialSpeedGraph = null;
    this.radialSpeedGraph2 = null;
    this.blendType = BLEND_NORMAL;
    this.enabled = true;
    this.paused = false;
    this.autoPlay = true;
    this.layers = [LAYERID_WORLD]; // assign to the default world layer
  }
}

export { ParticleSystemComponentData };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL3BhcnRpY2xlLXN5c3RlbS9kYXRhLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IEJMRU5EX05PUk1BTCwgRU1JVFRFUlNIQVBFX0JPWCwgTEFZRVJJRF9XT1JMRCwgUEFSVElDTEVNT0RFX0dQVSwgUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU4gfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuXG5jbGFzcyBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudERhdGEge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLm51bVBhcnRpY2xlcyA9IDE7ICAgICAgICAgICAgICAgICAgLy8gQW1vdW50IG9mIHBhcnRpY2xlcyBhbGxvY2F0ZWQgKG1heCBwYXJ0aWNsZXMgPSBtYXggR0wgdGV4dHVyZSB3aWR0aCBhdCB0aGlzIG1vbWVudClcbiAgICAgICAgdGhpcy5yYXRlID0gMTsgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVtaXNzaW9uIHJhdGVcbiAgICAgICAgdGhpcy5yYXRlMiA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RhcnRBbmdsZSA9IDA7XG4gICAgICAgIHRoaXMuc3RhcnRBbmdsZTIgPSBudWxsO1xuICAgICAgICB0aGlzLmxpZmV0aW1lID0gNTA7ICAgICAgICAgICAgICAgICAgICAgLy8gUGFydGljbGUgbGlmZXRpbWVcbiAgICAgICAgdGhpcy5lbWl0dGVyRXh0ZW50cyA9IG5ldyBWZWMzKCk7ICAgICAgIC8vIFNwYXduIHBvaW50IGRpdmVyZ2VuY2VcbiAgICAgICAgdGhpcy5lbWl0dGVyRXh0ZW50c0lubmVyID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5lbWl0dGVyUmFkaXVzID0gMDtcbiAgICAgICAgdGhpcy5lbWl0dGVyUmFkaXVzSW5uZXIgPSAwO1xuICAgICAgICB0aGlzLmVtaXR0ZXJTaGFwZSA9IEVNSVRURVJTSEFQRV9CT1g7XG4gICAgICAgIHRoaXMuaW5pdGlhbFZlbG9jaXR5ID0gMDtcbiAgICAgICAgdGhpcy53cmFwQm91bmRzID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5sb2NhbFNwYWNlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuc2NyZWVuU3BhY2UgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29sb3JNYXBBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMubm9ybWFsTWFwID0gbnVsbDtcbiAgICAgICAgdGhpcy5ub3JtYWxNYXBBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMubG9vcCA9IHRydWU7XG4gICAgICAgIHRoaXMucHJlV2FybSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnNvcnQgPSAwOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU29ydGluZyBtb2RlOiAwID0gbm9uZSwgMSA9IGJ5IGRpc3RhbmNlLCAyID0gYnkgbGlmZSwgMyA9IGJ5IC1saWZlOyAgIEZvcmNlcyBDUFUgbW9kZSBpZiBub3QgMFxuICAgICAgICB0aGlzLm1vZGUgPSBQQVJUSUNMRU1PREVfR1BVO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcbiAgICAgICAgdGhpcy5saWdodGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmhhbGZMYW1iZXJ0ID0gZmFsc2U7ICAgICAgICAgICAgLy8gVXNlcyBoYWxmLWxhbWJlcnQgbGlnaHRpbmcgaW5zdGVhZCBvZiBMYW1iZXJ0XG4gICAgICAgIHRoaXMuaW50ZW5zaXR5ID0gMTtcbiAgICAgICAgdGhpcy5zdHJldGNoID0gMC4wO1xuICAgICAgICB0aGlzLmFsaWduVG9Nb3Rpb24gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kZXB0aFNvZnRlbmluZyA9IDA7XG4gICAgICAgIHRoaXMubWVzaEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tZXNoID0gbnVsbDsgICAgICAgICAgICAgICAgICAgICAgIC8vIE1lc2ggdG8gYmUgdXNlZCBhcyBwYXJ0aWNsZS4gVmVydGV4IGJ1ZmZlciBpcyBzdXBwb3NlZCB0byBob2xkIHZlcnRleCBwb3NpdGlvbiBpbiBmaXJzdCAzIGZsb2F0cyBvZiBlYWNoIHZlcnRleFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTGVhdmUgdW5kZWZpbmVkIHRvIHVzZSBzaW1wbGUgcXVhZHNcbiAgICAgICAgdGhpcy5kZXB0aFdyaXRlID0gZmFsc2U7XG4gICAgICAgIHRoaXMubm9Gb2cgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLm9yaWVudGF0aW9uID0gUEFSVElDTEVPUklFTlRBVElPTl9TQ1JFRU47XG4gICAgICAgIHRoaXMucGFydGljbGVOb3JtYWwgPSBuZXcgVmVjMygwLCAxLCAwKTtcblxuICAgICAgICB0aGlzLmFuaW1UaWxlc1ggPSAxO1xuICAgICAgICB0aGlzLmFuaW1UaWxlc1kgPSAxO1xuICAgICAgICB0aGlzLmFuaW1TdGFydEZyYW1lID0gMDtcbiAgICAgICAgdGhpcy5hbmltTnVtRnJhbWVzID0gMTtcbiAgICAgICAgdGhpcy5hbmltTnVtQW5pbWF0aW9ucyA9IDE7XG4gICAgICAgIHRoaXMuYW5pbUluZGV4ID0gMDtcbiAgICAgICAgdGhpcy5yYW5kb21pemVBbmltSW5kZXggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5hbmltU3BlZWQgPSAxO1xuICAgICAgICB0aGlzLmFuaW1Mb29wID0gdHJ1ZTtcblxuICAgICAgICAvLyBUaW1lLWRlcGVuZGVudCBwYXJhbWV0ZXJzXG4gICAgICAgIHRoaXMuc2NhbGVHcmFwaCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NhbGVHcmFwaDIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY29sb3JHcmFwaCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29sb3JHcmFwaDIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuYWxwaGFHcmFwaCA9IG51bGw7XG4gICAgICAgIHRoaXMuYWxwaGFHcmFwaDIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubG9jYWxWZWxvY2l0eUdyYXBoID0gbnVsbDtcbiAgICAgICAgdGhpcy5sb2NhbFZlbG9jaXR5R3JhcGgyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnZlbG9jaXR5R3JhcGggPSBudWxsO1xuICAgICAgICB0aGlzLnZlbG9jaXR5R3JhcGgyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnJvdGF0aW9uU3BlZWRHcmFwaCA9IG51bGw7XG4gICAgICAgIHRoaXMucm90YXRpb25TcGVlZEdyYXBoMiA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5yYWRpYWxTcGVlZEdyYXBoID0gbnVsbDtcbiAgICAgICAgdGhpcy5yYWRpYWxTcGVlZEdyYXBoMiA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG5cbiAgICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuYXV0b1BsYXkgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMubGF5ZXJzID0gW0xBWUVSSURfV09STERdOyAvLyBhc3NpZ24gdG8gdGhlIGRlZmF1bHQgd29ybGQgbGF5ZXJcbiAgICB9XG59XG5cbmV4cG9ydCB7IFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50RGF0YSB9O1xuIl0sIm5hbWVzIjpbIlBhcnRpY2xlU3lzdGVtQ29tcG9uZW50RGF0YSIsImNvbnN0cnVjdG9yIiwibnVtUGFydGljbGVzIiwicmF0ZSIsInJhdGUyIiwic3RhcnRBbmdsZSIsInN0YXJ0QW5nbGUyIiwibGlmZXRpbWUiLCJlbWl0dGVyRXh0ZW50cyIsIlZlYzMiLCJlbWl0dGVyRXh0ZW50c0lubmVyIiwiZW1pdHRlclJhZGl1cyIsImVtaXR0ZXJSYWRpdXNJbm5lciIsImVtaXR0ZXJTaGFwZSIsIkVNSVRURVJTSEFQRV9CT1giLCJpbml0aWFsVmVsb2NpdHkiLCJ3cmFwQm91bmRzIiwibG9jYWxTcGFjZSIsInNjcmVlblNwYWNlIiwiY29sb3JNYXAiLCJjb2xvck1hcEFzc2V0Iiwibm9ybWFsTWFwIiwibm9ybWFsTWFwQXNzZXQiLCJsb29wIiwicHJlV2FybSIsInNvcnQiLCJtb2RlIiwiUEFSVElDTEVNT0RFX0dQVSIsInNjZW5lIiwibGlnaHRpbmciLCJoYWxmTGFtYmVydCIsImludGVuc2l0eSIsInN0cmV0Y2giLCJhbGlnblRvTW90aW9uIiwiZGVwdGhTb2Z0ZW5pbmciLCJtZXNoQXNzZXQiLCJtZXNoIiwiZGVwdGhXcml0ZSIsIm5vRm9nIiwib3JpZW50YXRpb24iLCJQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTiIsInBhcnRpY2xlTm9ybWFsIiwiYW5pbVRpbGVzWCIsImFuaW1UaWxlc1kiLCJhbmltU3RhcnRGcmFtZSIsImFuaW1OdW1GcmFtZXMiLCJhbmltTnVtQW5pbWF0aW9ucyIsImFuaW1JbmRleCIsInJhbmRvbWl6ZUFuaW1JbmRleCIsImFuaW1TcGVlZCIsImFuaW1Mb29wIiwic2NhbGVHcmFwaCIsInNjYWxlR3JhcGgyIiwiY29sb3JHcmFwaCIsImNvbG9yR3JhcGgyIiwiYWxwaGFHcmFwaCIsImFscGhhR3JhcGgyIiwibG9jYWxWZWxvY2l0eUdyYXBoIiwibG9jYWxWZWxvY2l0eUdyYXBoMiIsInZlbG9jaXR5R3JhcGgiLCJ2ZWxvY2l0eUdyYXBoMiIsInJvdGF0aW9uU3BlZWRHcmFwaCIsInJvdGF0aW9uU3BlZWRHcmFwaDIiLCJyYWRpYWxTcGVlZEdyYXBoIiwicmFkaWFsU3BlZWRHcmFwaDIiLCJibGVuZFR5cGUiLCJCTEVORF9OT1JNQUwiLCJlbmFibGVkIiwicGF1c2VkIiwiYXV0b1BsYXkiLCJsYXllcnMiLCJMQVlFUklEX1dPUkxEIl0sIm1hcHBpbmdzIjoiOzs7QUFJQSxNQUFNQSwyQkFBMkIsQ0FBQztBQUM5QkMsRUFBQUEsV0FBV0EsR0FBRztB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
