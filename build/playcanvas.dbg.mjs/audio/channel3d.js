/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { math } from '../math/math.js';
import { Vec3 } from '../math/vec3.js';
import { DISTANCE_INVERSE, DISTANCE_LINEAR, DISTANCE_EXPONENTIAL } from './constants.js';
import { hasAudioContext } from './capabilities.js';
import { Channel } from './channel.js';

const MAX_DISTANCE = 10000;

class Channel3d extends Channel {
  constructor(manager, sound, options) {
    super(manager, sound, options);
    this.position = new Vec3();
    this.velocity = new Vec3();

    if (hasAudioContext()) {
      this.panner = manager.context.createPanner();
    } else {
      this.maxDistance = MAX_DISTANCE;
      this.minDistance = 1;
      this.rollOffFactor = 1;
      this.distanceModel = DISTANCE_INVERSE;
    }
  }

  getPosition() {
    return this.position;
  }

  setPosition(position) {
    this.position.copy(position);
    const panner = this.panner;

    if ('positionX' in panner) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else if (panner.setPosition) {
      panner.setPosition(position.x, position.y, position.z);
    }
  }

  getVelocity() {
    Debug.warn('Channel3d#getVelocity is not implemented.');
    return this.velocity;
  }

  setVelocity(velocity) {
    Debug.warn('Channel3d#setVelocity is not implemented.');
    this.velocity.copy(velocity);
  }

  getMaxDistance() {
    return this.panner.maxDistance;
  }

  setMaxDistance(max) {
    this.panner.maxDistance = max;
  }

  getMinDistance() {
    return this.panner.refDistance;
  }

  setMinDistance(min) {
    this.panner.refDistance = min;
  }

  getRollOffFactor() {
    return this.panner.rolloffFactor;
  }

  setRollOffFactor(factor) {
    this.panner.rolloffFactor = factor;
  }

  getDistanceModel() {
    return this.panner.distanceModel;
  }

  setDistanceModel(distanceModel) {
    this.panner.distanceModel = distanceModel;
  }

  _createSource() {
    const context = this.manager.context;
    this.source = context.createBufferSource();
    this.source.buffer = this.sound.buffer;
    this.source.connect(this.panner);
    this.panner.connect(this.gain);
    this.gain.connect(context.destination);

    if (!this.loop) {
      this.source.onended = this.pause.bind(this);
    }
  }

}

if (!hasAudioContext()) {
  let offset = new Vec3();

  const fallOff = function fallOff(posOne, posTwo, refDistance, maxDistance, rolloffFactor, distanceModel) {
    offset = offset.sub2(posOne, posTwo);
    const distance = offset.length();

    if (distance < refDistance) {
      return 1;
    } else if (distance > maxDistance) {
      return 0;
    }

    let result = 0;

    if (distanceModel === DISTANCE_LINEAR) {
      result = 1 - rolloffFactor * (distance - refDistance) / (maxDistance - refDistance);
    } else if (distanceModel === DISTANCE_INVERSE) {
      result = refDistance / (refDistance + rolloffFactor * (distance - refDistance));
    } else if (distanceModel === DISTANCE_EXPONENTIAL) {
      result = Math.pow(distance / refDistance, -rolloffFactor);
    }

    return math.clamp(result, 0, 1);
  };

  Object.assign(Channel3d.prototype, {
    setPosition: function (position) {
      this.position.copy(position);

      if (this.source) {
        const listener = this.manager.listener;
        const lpos = listener.getPosition();
        const factor = fallOff(lpos, this.position, this.minDistance, this.maxDistance, this.rollOffFactor, this.distanceModel);
        const v = this.getVolume();
        this.source.volume = v * factor;
      }
    },
    getMaxDistance: function () {
      return this.maxDistance;
    },
    setMaxDistance: function (max) {
      this.maxDistance = max;
    },
    getMinDistance: function () {
      return this.minDistance;
    },
    setMinDistance: function (min) {
      this.minDistance = min;
    },
    getRollOffFactor: function () {
      return this.rollOffFactor;
    },
    setRollOffFactor: function (factor) {
      this.rollOffFactor = factor;
    },
    getDistanceModel: function () {
      return this.distanceModel;
    },
    setDistanceModel: function (distanceModel) {
      this.distanceModel = distanceModel;
    }
  });
}

export { Channel3d };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbm5lbDNkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYXVkaW8vY2hhbm5lbDNkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IERJU1RBTkNFX0VYUE9ORU5USUFMLCBESVNUQU5DRV9JTlZFUlNFLCBESVNUQU5DRV9MSU5FQVIgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBoYXNBdWRpb0NvbnRleHQgfSBmcm9tICcuL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBDaGFubmVsIH0gZnJvbSAnLi9jaGFubmVsLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3NvdW5kL3NvdW5kLmpzJykuU291bmR9IFNvdW5kICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn0gU291bmRNYW5hZ2VyICovXG5cbi8vIGRlZmF1bHQgbWF4RGlzdGFuY2UsIHNhbWUgYXMgV2ViIEF1ZGlvIEFQSVxuY29uc3QgTUFYX0RJU1RBTkNFID0gMTAwMDA7XG5cbi8qKlxuICogM0QgYXVkaW8gY2hhbm5lbC5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIENoYW5uZWwzZCBleHRlbmRzIENoYW5uZWwge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDaGFubmVsM2QgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NvdW5kTWFuYWdlcn0gbWFuYWdlciAtIFRoZSBTb3VuZE1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtTb3VuZH0gc291bmQgLSBUaGUgc291bmQgdG8gcGxheWJhY2suXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy52b2x1bWU9MV0gLSBUaGUgcGxheWJhY2sgdm9sdW1lLCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnBpdGNoPTFdIC0gVGhlIHJlbGF0aXZlIHBpdGNoLCBkZWZhdWx0IG9mIDEsIHBsYXlzIGF0IG5vcm1hbCBwaXRjaC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxvb3A9ZmFsc2VdIC0gV2hldGhlciB0aGUgc291bmQgc2hvdWxkIGxvb3Agd2hlbiBpdCByZWFjaGVzIHRoZVxuICAgICAqIGVuZCBvciBub3QuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobWFuYWdlciwgc291bmQsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIobWFuYWdlciwgc291bmQsIG9wdGlvbnMpO1xuXG4gICAgICAgIHRoaXMucG9zaXRpb24gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLnZlbG9jaXR5ID0gbmV3IFZlYzMoKTtcblxuICAgICAgICBpZiAoaGFzQXVkaW9Db250ZXh0KCkpIHtcbiAgICAgICAgICAgIHRoaXMucGFubmVyID0gbWFuYWdlci5jb250ZXh0LmNyZWF0ZVBhbm5lcigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5tYXhEaXN0YW5jZSA9IE1BWF9ESVNUQU5DRTtcbiAgICAgICAgICAgIHRoaXMubWluRGlzdGFuY2UgPSAxO1xuICAgICAgICAgICAgdGhpcy5yb2xsT2ZmRmFjdG9yID0gMTtcbiAgICAgICAgICAgIHRoaXMuZGlzdGFuY2VNb2RlbCA9IERJU1RBTkNFX0lOVkVSU0U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRQb3NpdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zaXRpb247XG4gICAgfVxuXG4gICAgc2V0UG9zaXRpb24ocG9zaXRpb24pIHtcbiAgICAgICAgdGhpcy5wb3NpdGlvbi5jb3B5KHBvc2l0aW9uKTtcbiAgICAgICAgY29uc3QgcGFubmVyID0gdGhpcy5wYW5uZXI7XG4gICAgICAgIGlmICgncG9zaXRpb25YJyBpbiBwYW5uZXIpIHtcbiAgICAgICAgICAgIHBhbm5lci5wb3NpdGlvblgudmFsdWUgPSBwb3NpdGlvbi54O1xuICAgICAgICAgICAgcGFubmVyLnBvc2l0aW9uWS52YWx1ZSA9IHBvc2l0aW9uLnk7XG4gICAgICAgICAgICBwYW5uZXIucG9zaXRpb25aLnZhbHVlID0gcG9zaXRpb24uejtcbiAgICAgICAgfSBlbHNlIGlmIChwYW5uZXIuc2V0UG9zaXRpb24pIHsgLy8gRmlyZWZveCAoYW5kIGxlZ2FjeSBicm93c2VycylcbiAgICAgICAgICAgIHBhbm5lci5zZXRQb3NpdGlvbihwb3NpdGlvbi54LCBwb3NpdGlvbi55LCBwb3NpdGlvbi56KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldFZlbG9jaXR5KCkge1xuICAgICAgICBEZWJ1Zy53YXJuKCdDaGFubmVsM2QjZ2V0VmVsb2NpdHkgaXMgbm90IGltcGxlbWVudGVkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy52ZWxvY2l0eTtcbiAgICB9XG5cbiAgICBzZXRWZWxvY2l0eSh2ZWxvY2l0eSkge1xuICAgICAgICBEZWJ1Zy53YXJuKCdDaGFubmVsM2Qjc2V0VmVsb2NpdHkgaXMgbm90IGltcGxlbWVudGVkLicpO1xuICAgICAgICB0aGlzLnZlbG9jaXR5LmNvcHkodmVsb2NpdHkpO1xuICAgIH1cblxuICAgIGdldE1heERpc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYW5uZXIubWF4RGlzdGFuY2U7XG4gICAgfVxuXG4gICAgc2V0TWF4RGlzdGFuY2UobWF4KSB7XG4gICAgICAgIHRoaXMucGFubmVyLm1heERpc3RhbmNlID0gbWF4O1xuICAgIH1cblxuICAgIGdldE1pbkRpc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYW5uZXIucmVmRGlzdGFuY2U7XG4gICAgfVxuXG4gICAgc2V0TWluRGlzdGFuY2UobWluKSB7XG4gICAgICAgIHRoaXMucGFubmVyLnJlZkRpc3RhbmNlID0gbWluO1xuICAgIH1cblxuICAgIGdldFJvbGxPZmZGYWN0b3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhbm5lci5yb2xsb2ZmRmFjdG9yO1xuICAgIH1cblxuICAgIHNldFJvbGxPZmZGYWN0b3IoZmFjdG9yKSB7XG4gICAgICAgIHRoaXMucGFubmVyLnJvbGxvZmZGYWN0b3IgPSBmYWN0b3I7XG4gICAgfVxuXG4gICAgZ2V0RGlzdGFuY2VNb2RlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFubmVyLmRpc3RhbmNlTW9kZWw7XG4gICAgfVxuXG4gICAgc2V0RGlzdGFuY2VNb2RlbChkaXN0YW5jZU1vZGVsKSB7XG4gICAgICAgIHRoaXMucGFubmVyLmRpc3RhbmNlTW9kZWwgPSBkaXN0YW5jZU1vZGVsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSB0aGUgYnVmZmVyIHNvdXJjZSBhbmQgY29ubmVjdCBpdCB1cCB0byB0aGUgY29ycmVjdCBhdWRpbyBub2Rlcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZVNvdXJjZSgpIHtcbiAgICAgICAgY29uc3QgY29udGV4dCA9IHRoaXMubWFuYWdlci5jb250ZXh0O1xuXG4gICAgICAgIHRoaXMuc291cmNlID0gY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgdGhpcy5zb3VyY2UuYnVmZmVyID0gdGhpcy5zb3VuZC5idWZmZXI7XG5cbiAgICAgICAgLy8gQ29ubmVjdCB1cCB0aGUgbm9kZXNcbiAgICAgICAgdGhpcy5zb3VyY2UuY29ubmVjdCh0aGlzLnBhbm5lcik7XG4gICAgICAgIHRoaXMucGFubmVyLmNvbm5lY3QodGhpcy5nYWluKTtcbiAgICAgICAgdGhpcy5nYWluLmNvbm5lY3QoY29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgaWYgKCF0aGlzLmxvb3ApIHtcbiAgICAgICAgICAgIC8vIG1hcmsgc291cmNlIGFzIHBhdXNlZCB3aGVuIGl0IGVuZHNcbiAgICAgICAgICAgIHRoaXMuc291cmNlLm9uZW5kZWQgPSB0aGlzLnBhdXNlLmJpbmQodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmICghaGFzQXVkaW9Db250ZXh0KCkpIHtcbiAgICAvLyB0ZW1wIHZlY3RvciBzdG9yYWdlXG4gICAgbGV0IG9mZnNldCA9IG5ldyBWZWMzKCk7XG5cbiAgICAvLyBGYWxsIG9mZiBmdW5jdGlvbiB3aGljaCBzaG91bGQgYmUgdGhlIHNhbWUgYXMgdGhlIG9uZSBpbiB0aGUgV2ViIEF1ZGlvIEFQSVxuICAgIC8vIFRha2VuIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1Bhbm5lck5vZGUvZGlzdGFuY2VNb2RlbFxuICAgIGNvbnN0IGZhbGxPZmYgPSBmdW5jdGlvbiAocG9zT25lLCBwb3NUd28sIHJlZkRpc3RhbmNlLCBtYXhEaXN0YW5jZSwgcm9sbG9mZkZhY3RvciwgZGlzdGFuY2VNb2RlbCkge1xuICAgICAgICBvZmZzZXQgPSBvZmZzZXQuc3ViMihwb3NPbmUsIHBvc1R3byk7XG4gICAgICAgIGNvbnN0IGRpc3RhbmNlID0gb2Zmc2V0Lmxlbmd0aCgpO1xuXG4gICAgICAgIGlmIChkaXN0YW5jZSA8IHJlZkRpc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmIChkaXN0YW5jZSA+IG1heERpc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xuICAgICAgICBpZiAoZGlzdGFuY2VNb2RlbCA9PT0gRElTVEFOQ0VfTElORUFSKSB7XG4gICAgICAgICAgICByZXN1bHQgPSAxIC0gcm9sbG9mZkZhY3RvciAqIChkaXN0YW5jZSAtIHJlZkRpc3RhbmNlKSAvIChtYXhEaXN0YW5jZSAtIHJlZkRpc3RhbmNlKTtcbiAgICAgICAgfSBlbHNlIGlmIChkaXN0YW5jZU1vZGVsID09PSBESVNUQU5DRV9JTlZFUlNFKSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZWZEaXN0YW5jZSAvIChyZWZEaXN0YW5jZSArIHJvbGxvZmZGYWN0b3IgKiAoZGlzdGFuY2UgLSByZWZEaXN0YW5jZSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGRpc3RhbmNlTW9kZWwgPT09IERJU1RBTkNFX0VYUE9ORU5USUFMKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBNYXRoLnBvdyhkaXN0YW5jZSAvIHJlZkRpc3RhbmNlLCAtcm9sbG9mZkZhY3Rvcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGguY2xhbXAocmVzdWx0LCAwLCAxKTtcbiAgICB9O1xuXG4gICAgT2JqZWN0LmFzc2lnbihDaGFubmVsM2QucHJvdG90eXBlLCB7XG4gICAgICAgIHNldFBvc2l0aW9uOiBmdW5jdGlvbiAocG9zaXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMucG9zaXRpb24uY29weShwb3NpdGlvbik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gdGhpcy5tYW5hZ2VyLmxpc3RlbmVyO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbHBvcyA9IGxpc3RlbmVyLmdldFBvc2l0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBmYWN0b3IgPSBmYWxsT2ZmKGxwb3MsIHRoaXMucG9zaXRpb24sIHRoaXMubWluRGlzdGFuY2UsIHRoaXMubWF4RGlzdGFuY2UsIHRoaXMucm9sbE9mZkZhY3RvciwgdGhpcy5kaXN0YW5jZU1vZGVsKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHYgPSB0aGlzLmdldFZvbHVtZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnZvbHVtZSA9IHYgKiBmYWN0b3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0TWF4RGlzdGFuY2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1heERpc3RhbmNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldE1heERpc3RhbmNlOiBmdW5jdGlvbiAobWF4KSB7XG4gICAgICAgICAgICB0aGlzLm1heERpc3RhbmNlID0gbWF4O1xuICAgICAgICB9LFxuXG4gICAgICAgIGdldE1pbkRpc3RhbmNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5taW5EaXN0YW5jZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXRNaW5EaXN0YW5jZTogZnVuY3Rpb24gKG1pbikge1xuICAgICAgICAgICAgdGhpcy5taW5EaXN0YW5jZSA9IG1pbjtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRSb2xsT2ZmRmFjdG9yOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yb2xsT2ZmRmFjdG9yO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldFJvbGxPZmZGYWN0b3I6IGZ1bmN0aW9uIChmYWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMucm9sbE9mZkZhY3RvciA9IGZhY3RvcjtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXREaXN0YW5jZU1vZGVsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaXN0YW5jZU1vZGVsO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldERpc3RhbmNlTW9kZWw6IGZ1bmN0aW9uIChkaXN0YW5jZU1vZGVsKSB7XG4gICAgICAgICAgICB0aGlzLmRpc3RhbmNlTW9kZWwgPSBkaXN0YW5jZU1vZGVsO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmV4cG9ydCB7IENoYW5uZWwzZCB9O1xuIl0sIm5hbWVzIjpbIk1BWF9ESVNUQU5DRSIsIkNoYW5uZWwzZCIsIkNoYW5uZWwiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJzb3VuZCIsIm9wdGlvbnMiLCJwb3NpdGlvbiIsIlZlYzMiLCJ2ZWxvY2l0eSIsImhhc0F1ZGlvQ29udGV4dCIsInBhbm5lciIsImNvbnRleHQiLCJjcmVhdGVQYW5uZXIiLCJtYXhEaXN0YW5jZSIsIm1pbkRpc3RhbmNlIiwicm9sbE9mZkZhY3RvciIsImRpc3RhbmNlTW9kZWwiLCJESVNUQU5DRV9JTlZFUlNFIiwiZ2V0UG9zaXRpb24iLCJzZXRQb3NpdGlvbiIsImNvcHkiLCJwb3NpdGlvblgiLCJ2YWx1ZSIsIngiLCJwb3NpdGlvblkiLCJ5IiwicG9zaXRpb25aIiwieiIsImdldFZlbG9jaXR5IiwiRGVidWciLCJ3YXJuIiwic2V0VmVsb2NpdHkiLCJnZXRNYXhEaXN0YW5jZSIsInNldE1heERpc3RhbmNlIiwibWF4IiwiZ2V0TWluRGlzdGFuY2UiLCJyZWZEaXN0YW5jZSIsInNldE1pbkRpc3RhbmNlIiwibWluIiwiZ2V0Um9sbE9mZkZhY3RvciIsInJvbGxvZmZGYWN0b3IiLCJzZXRSb2xsT2ZmRmFjdG9yIiwiZmFjdG9yIiwiZ2V0RGlzdGFuY2VNb2RlbCIsInNldERpc3RhbmNlTW9kZWwiLCJfY3JlYXRlU291cmNlIiwic291cmNlIiwiY3JlYXRlQnVmZmVyU291cmNlIiwiYnVmZmVyIiwiY29ubmVjdCIsImdhaW4iLCJkZXN0aW5hdGlvbiIsImxvb3AiLCJvbmVuZGVkIiwicGF1c2UiLCJiaW5kIiwib2Zmc2V0IiwiZmFsbE9mZiIsInBvc09uZSIsInBvc1R3byIsInN1YjIiLCJkaXN0YW5jZSIsImxlbmd0aCIsInJlc3VsdCIsIkRJU1RBTkNFX0xJTkVBUiIsIkRJU1RBTkNFX0VYUE9ORU5USUFMIiwiTWF0aCIsInBvdyIsIm1hdGgiLCJjbGFtcCIsIk9iamVjdCIsImFzc2lnbiIsInByb3RvdHlwZSIsImxpc3RlbmVyIiwibHBvcyIsInYiLCJnZXRWb2x1bWUiLCJ2b2x1bWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7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
