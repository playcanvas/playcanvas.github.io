/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { math } from '../math/math.js';
import { hasAudioContext } from '../audio/capabilities.js';
import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';
import { Listener } from './listener.js';

const CONTEXT_STATE_RUNNING = 'running';
const CONTEXT_STATE_INTERRUPTED = 'interrupted';
const USER_INPUT_EVENTS = ['click', 'contextmenu', 'auxclick', 'dblclick', 'mousedown', 'mouseup', 'pointerup', 'touchend', 'keydown', 'keyup'];

class SoundManager extends EventHandler {
  constructor(options) {
    super();
    this._context = null;
    this._forceWebAudioApi = options.forceWebAudioApi;
    this._resumeContextCallback = null;
    this._selfSuspended = false;
    this._unlocked = false;
    this._unlocking = false;

    if (!hasAudioContext() && !this._forceWebAudioApi) {
      Debug.warn('No support for 3D audio found');
    }

    this.listener = new Listener(this);
    this._volume = 1;
  }

  set volume(volume) {
    volume = math.clamp(volume, 0, 1);
    this._volume = volume;
    this.fire('volumechange', volume);
  }

  get volume() {
    return this._volume;
  }

  get suspended() {
    return !this._context || !this._unlocked || this._context.state !== CONTEXT_STATE_RUNNING;
  }

  get context() {
    if (!this._context) {
      if (hasAudioContext() || this._forceWebAudioApi) {
        if (typeof AudioContext !== 'undefined') {
          this._context = new AudioContext();
        } else if (typeof webkitAudioContext !== 'undefined') {
          this._context = new webkitAudioContext();
        }

        if (this._context) {
          this._unlocked = this._context.state === CONTEXT_STATE_RUNNING;

          if (!this._unlocked) {
            this._addContextUnlockListeners();
          }

          const self = this;

          this._context.onstatechange = function () {
            if (self._unlocked && !self._selfSuspended && self._context.state !== CONTEXT_STATE_RUNNING) {
              self._context.resume().then(() => {}, e => {
                Debug.error(`Attempted to resume the AudioContext on onstatechange, but it was rejected`, e);
              }).catch(e => {
                Debug.error(`Attempted to resume the AudioContext on onstatechange, but threw an exception`, e);
              });
            }
          };
        }
      }
    }

    return this._context;
  }

  suspend() {
    this._selfSuspended = true;

    if (this.suspended) {
      return;
    }

    this.fire('suspend');
  }

  resume() {
    this._selfSuspended = false;

    if (!this._context || !this._unlocked && !this._unlocking) {
      return;
    }

    if (this._context.state === CONTEXT_STATE_INTERRUPTED) {
      this._context.resume().then(() => {
        this.fire('resume');
      }, e => {
        Debug.error(`Attempted to resume the AudioContext on SoundManager.resume(), but it was rejected`, e);
      }).catch(e => {
        Debug.error(`Attempted to resume the AudioContext on SoundManager.resume(), but threw an exception`, e);
      });
    } else {
      this.fire('resume');
    }
  }

  destroy() {
    this._removeUserInputListeners();

    this.fire('destroy');

    if (this._context && this._context.close) {
      this._context.close();

      this._context = null;
    }
  }

  playSound(sound, options = {}) {
    let channel = null;

    if (Channel) {
      channel = new Channel(this, sound, options);
      channel.play();
    }

    return channel;
  }

  playSound3d(sound, position, options = {}) {
    let channel = null;

    if (Channel3d) {
      channel = new Channel3d(this, sound, options);
      channel.setPosition(position);

      if (options.volume) {
        channel.setVolume(options.volume);
      }

      if (options.loop) {
        channel.setLoop(options.loop);
      }

      if (options.maxDistance) {
        channel.setMaxDistance(options.maxDistance);
      }

      if (options.minDistance) {
        channel.setMinDistance(options.minDistance);
      }

      if (options.rollOffFactor) {
        channel.setRollOffFactor(options.rollOffFactor);
      }

      if (options.distanceModel) {
        channel.setDistanceModel(options.distanceModel);
      }

      channel.play();
    }

    return channel;
  }

  _addContextUnlockListeners() {
    this._unlocking = false;

    if (!this._resumeContextCallback) {
      this._resumeContextCallback = () => {
        if (!this._context || this._unlocked || this._unlocking) {
          return;
        }

        this._unlocking = true;
        this.resume();

        const buffer = this._context.createBuffer(1, 1, this._context.sampleRate);

        const source = this._context.createBufferSource();

        source.buffer = buffer;
        source.connect(this._context.destination);
        source.start(0);

        source.onended = event => {
          source.disconnect(0);
          this._unlocked = true;
          this._unlocking = false;

          this._removeUserInputListeners();
        };
      };
    }

    USER_INPUT_EVENTS.forEach(eventName => {
      window.addEventListener(eventName, this._resumeContextCallback, false);
    });
  }

  _removeUserInputListeners() {
    if (!this._resumeContextCallback) {
      return;
    }

    USER_INPUT_EVENTS.forEach(eventName => {
      window.removeEventListener(eventName, this._resumeContextCallback, false);
    });
    this._resumeContextCallback = null;
  }

}

export { SoundManager };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NvdW5kL21hbmFnZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IGhhc0F1ZGlvQ29udGV4dCB9IGZyb20gJy4uL2F1ZGlvL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBDaGFubmVsIH0gZnJvbSAnLi4vYXVkaW8vY2hhbm5lbC5qcyc7XG5pbXBvcnQgeyBDaGFubmVsM2QgfSBmcm9tICcuLi9hdWRpby9jaGFubmVsM2QuanMnO1xuXG5pbXBvcnQgeyBMaXN0ZW5lciB9IGZyb20gJy4vbGlzdGVuZXIuanMnO1xuXG5jb25zdCBDT05URVhUX1NUQVRFX1JVTk5JTkcgPSAncnVubmluZyc7XG5jb25zdCBDT05URVhUX1NUQVRFX0lOVEVSUlVQVEVEID0gJ2ludGVycnVwdGVkJztcblxuLyoqXG4gKiBMaXN0IG9mIFdpbmRvdyBldmVudHMgdG8gbGlzdGVuIHdoZW4gQXVkaW9Db250ZXh0IG5lZWRzIHRvIGJlIHVubG9ja2VkLlxuICovXG5jb25zdCBVU0VSX0lOUFVUX0VWRU5UUyA9IFtcbiAgICAnY2xpY2snLCAnY29udGV4dG1lbnUnLCAnYXV4Y2xpY2snLCAnZGJsY2xpY2snLCAnbW91c2Vkb3duJyxcbiAgICAnbW91c2V1cCcsICdwb2ludGVydXAnLCAndG91Y2hlbmQnLCAna2V5ZG93bicsICdrZXl1cCdcbl07XG5cbi8qKlxuICogVGhlIFNvdW5kTWFuYWdlciBpcyB1c2VkIHRvIGxvYWQgYW5kIHBsYXkgYXVkaW8uIEl0IGFsc28gYXBwbGllcyBzeXN0ZW0td2lkZSBzZXR0aW5ncyBsaWtlXG4gKiBnbG9iYWwgdm9sdW1lLCBzdXNwZW5kIGFuZCByZXN1bWUuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBTb3VuZE1hbmFnZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZE1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9ucyBvcHRpb25zIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZvcmNlV2ViQXVkaW9BcGldIC0gQWx3YXlzIHVzZSB0aGUgV2ViIEF1ZGlvIEFQSSwgZXZlbiBpZiBjaGVja1xuICAgICAqIGluZGljYXRlcyB0aGF0IGl0IGlzIG5vdCBhdmFpbGFibGUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdW5kZXJseWluZyBBdWRpb0NvbnRleHQsIGxhenkgbG9hZGVkIGluIHRoZSAnY29udGV4dCcgcHJvcGVydHkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtBdWRpb0NvbnRleHR9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jb250ZXh0ID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9mb3JjZVdlYkF1ZGlvQXBpID0gb3B0aW9ucy5mb3JjZVdlYkF1ZGlvQXBpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZnVuY3Rpb24gY2FsbGJhY2sgYXR0YWNoZWQgdG8gdGhlIFdpbmRvdyBldmVudHMgVVNFUl9JTlBVVF9FVkVOVFNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0V2ZW50TGlzdGVuZXJPckV2ZW50TGlzdGVuZXJPYmplY3R9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9yZXN1bWVDb250ZXh0Q2FsbGJhY2sgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgdG8gdG8gdHJ1ZSB3aGVuIHN1c3BlbmQoKSB3YXMgY2FsbGVkIGV4cGxpdGx5IChlaXRoZXIgbWFudWFsbHkgb3Igb24gdmlzaWJpbGl0eSBjaGFuZ2UpLFxuICAgICAgICAgKiBhbmQgcmVzZXQgdG8gZmFsc2UgYWZ0ZXIgcmVzdW1lKCkgaXMgY2FsbGVkLlxuICAgICAgICAgKiBUaGlzIHZhbHVlIGlzIG5vdCBkaXJlY3RseSBib3VuZCB0byBBdWRpb0NvbnRleHQuc3RhdGUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2VsZlN1c3BlbmRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiB0cnVlLCB0aGUgQXVkaW9Db250ZXh0IGlzIGluIGEgc3BlY2lhbCAnc3VzcGVuZGVkJyBzdGF0ZSB3aGVyZSBpdCBuZWVkcyB0byBiZSByZXN1bWVkXG4gICAgICAgICAqIGZyb20gYSBVc2VyIGV2ZW50LiBJbiBhZGRpdGlvbiwgc29tZSBkZXZpY2VzIGFuZCBicm93c2VycyByZXF1aXJlIHRoYXQgYSBibGFuayBzb3VuZCBiZSBwbGF5ZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdW5sb2NrZWQgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IGFmdGVyIHRoZSB1bmxvY2sgZmxvdyBpcyB0cmlnZ2VyZWQsIGJ1dCBoYXNuJ3QgY29tcGxldGVkIHlldC5cbiAgICAgICAgICogVXNlZCB0byBhdm9pZCBzdGFydGluZyBtdWx0aXBsZSAndW5sb2NrJyBmbG93cyBhdCB0aGUgc2FtZSB0aW1lLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3VubG9ja2luZyA9IGZhbHNlO1xuXG4gICAgICAgIGlmICghaGFzQXVkaW9Db250ZXh0KCkgJiYgIXRoaXMuX2ZvcmNlV2ViQXVkaW9BcGkpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ05vIHN1cHBvcnQgZm9yIDNEIGF1ZGlvIGZvdW5kJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpc3RlbmVyID0gbmV3IExpc3RlbmVyKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IDE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2xvYmFsIHZvbHVtZSBmb3IgdGhlIG1hbmFnZXIuIEFsbCB7QGxpbmsgU291bmRJbnN0YW5jZX1zIHdpbGwgc2NhbGUgdGhlaXIgdm9sdW1lIHdpdGggdGhpc1xuICAgICAqIHZvbHVtZS4gVmFsaWQgYmV0d2VlbiBbMCwgMV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCB2b2x1bWUodm9sdW1lKSB7XG4gICAgICAgIHZvbHVtZSA9IG1hdGguY2xhbXAodm9sdW1lLCAwLCAxKTtcbiAgICAgICAgdGhpcy5fdm9sdW1lID0gdm9sdW1lO1xuICAgICAgICB0aGlzLmZpcmUoJ3ZvbHVtZWNoYW5nZScsIHZvbHVtZSk7XG4gICAgfVxuXG4gICAgZ2V0IHZvbHVtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICB9XG5cbiAgICBnZXQgc3VzcGVuZGVkKCkge1xuICAgICAgICByZXR1cm4gIXRoaXMuX2NvbnRleHQgfHwgIXRoaXMuX3VubG9ja2VkIHx8IHRoaXMuX2NvbnRleHQuc3RhdGUgIT09IENPTlRFWFRfU1RBVEVfUlVOTklORztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIFdlYiBBdWRpbyBBUEkgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBdWRpb0NvbnRleHR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBjb250ZXh0KCkge1xuICAgICAgICAvLyBsYXp5IGNyZWF0ZSB0aGUgQXVkaW9Db250ZXh0XG4gICAgICAgIGlmICghdGhpcy5fY29udGV4dCkge1xuICAgICAgICAgICAgaWYgKGhhc0F1ZGlvQ29udGV4dCgpIHx8IHRoaXMuX2ZvcmNlV2ViQXVkaW9BcGkpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIEF1ZGlvQ29udGV4dCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB3ZWJraXRBdWRpb0NvbnRleHQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbnRleHQgPSBuZXcgd2Via2l0QXVkaW9Db250ZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgY29udGV4dCB3YXMgc3VjY2Vzc2Z1bGx5IGNyZWF0ZWQsIGluaXRpYWxpemUgaXRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY29udGV4dCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBBdWRpb0NvbnRleHQgd2lsbCBzdGFydCBpbiBhICdzdXNwZW5kZWQnIHN0YXRlIGlmIGl0IGlzIGxvY2tlZCBieSB0aGUgYnJvd3NlclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmxvY2tlZCA9IHRoaXMuX2NvbnRleHQuc3RhdGUgPT09IENPTlRFWFRfU1RBVEVfUlVOTklORztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl91bmxvY2tlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWRkQ29udGV4dFVubG9ja0xpc3RlbmVycygpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gV2hlbiB0aGUgYnJvd3NlciB3aW5kb3cgbG9zZXMgZm9jdXMgKGkuZS4gc3dpdGNoaW5nIHRhYiwgaGlkaW5nIHRoZSBhcHAgb24gbW9iaWxlLCBldGMpLFxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgQXVkaW9Db250ZXh0IHN0YXRlIHdpbGwgYmUgc2V0IHRvICdpbnRlcnJ1cHRlZCcgKG9uIGlPUyBTYWZhcmkpIG9yICdzdXNwZW5kZWQnIChvbiBvdGhlclxuICAgICAgICAgICAgICAgICAgICAvLyBicm93c2VycyksIGFuZCAncmVzdW1lJyBtdXN0IGJlIGV4cGxpY2x0eSBjYWxsZWQuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jb250ZXh0Lm9uc3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGV4cGxpY2l0bHkgY2FsbCAucmVzdW1lKCkgd2hlbiBwcmV2aW91cyBzdGF0ZSB3YXMgc3VzcGVuZGVkIG9yIGludGVycnVwdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5fdW5sb2NrZWQgJiYgIXNlbGYuX3NlbGZTdXNwZW5kZWQgJiYgc2VsZi5fY29udGV4dC5zdGF0ZSAhPT0gQ09OVEVYVF9TVEFURV9SVU5OSU5HKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fY29udGV4dC5yZXN1bWUoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8tb3BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCAoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgQXR0ZW1wdGVkIHRvIHJlc3VtZSB0aGUgQXVkaW9Db250ZXh0IG9uIG9uc3RhdGVjaGFuZ2UsIGJ1dCBpdCB3YXMgcmVqZWN0ZWRgLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgQXR0ZW1wdGVkIHRvIHJlc3VtZSB0aGUgQXVkaW9Db250ZXh0IG9uIG9uc3RhdGVjaGFuZ2UsIGJ1dCB0aHJldyBhbiBleGNlcHRpb25gLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fY29udGV4dDtcbiAgICB9XG5cbiAgICBzdXNwZW5kKCkge1xuICAgICAgICB0aGlzLl9zZWxmU3VzcGVuZGVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5zdXNwZW5kZWQpIHtcbiAgICAgICAgICAgIC8vIGFscmVhZHkgc3VzcGVuZGVkXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3N1c3BlbmQnKTtcbiAgICB9XG5cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIHRoaXMuX3NlbGZTdXNwZW5kZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyBjYW5ub3QgcmVzdW1lIGNvbnRleHQgaWYgaXQgd2Fzbid0IGNyZWF0ZWQgeWV0IG9yIGlmIGl0J3Mgc3RpbGwgbG9ja2VkXG4gICAgICAgIGlmICghdGhpcy5fY29udGV4dCB8fCAoIXRoaXMuX3VubG9ja2VkICYmICF0aGlzLl91bmxvY2tpbmcpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBAdHMtaWdub3JlICdpbnRlcnJ1cHRlZCcgaXMgYSB2YWxpZCBzdGF0ZSBvbiBpT1NcbiAgICAgICAgaWYgKHRoaXMuX2NvbnRleHQuc3RhdGUgPT09IENPTlRFWFRfU1RBVEVfSU5URVJSVVBURUQpIHtcbiAgICAgICAgICAgIC8vIGV4cGxpY3RseSByZXN1bWUoKSBjb250ZXh0LCBhbmQgb25seSBmaXJlICdyZXN1bWUnIGV2ZW50IGFmdGVyIGNvbnRleHQgaGFzIHJlc3VtZWRcbiAgICAgICAgICAgIHRoaXMuX2NvbnRleHQucmVzdW1lKCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdyZXN1bWUnKTtcbiAgICAgICAgICAgIH0sIChlKSA9PiB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYEF0dGVtcHRlZCB0byByZXN1bWUgdGhlIEF1ZGlvQ29udGV4dCBvbiBTb3VuZE1hbmFnZXIucmVzdW1lKCksIGJ1dCBpdCB3YXMgcmVqZWN0ZWRgLCBlKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYEF0dGVtcHRlZCB0byByZXN1bWUgdGhlIEF1ZGlvQ29udGV4dCBvbiBTb3VuZE1hbmFnZXIucmVzdW1lKCksIGJ1dCB0aHJldyBhbiBleGNlcHRpb25gLCBlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdyZXN1bWUnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX3JlbW92ZVVzZXJJbnB1dExpc3RlbmVycygpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveScpO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb250ZXh0ICYmIHRoaXMuX2NvbnRleHQuY2xvc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnRleHQuY2xvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuX2NvbnRleHQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IHtAbGluayBDaGFubmVsfSBhbmQgYmVnaW4gcGxheWJhY2sgb2YgdGhlIHNvdW5kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTb3VuZH0gc291bmQgLSBUaGUgU291bmQgb2JqZWN0IHRvIHBsYXkuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBPcHRpb25hbCBvcHRpb25zIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMudm9sdW1lXSAtIFRoZSB2b2x1bWUgdG8gcGxheWJhY2sgYXQsIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxvb3BdIC0gV2hldGhlciB0byBsb29wIHRoZSBzb3VuZCB3aGVuIGl0IHJlYWNoZXMgdGhlIGVuZC5cbiAgICAgKiBAcmV0dXJucyB7Q2hhbm5lbH0gVGhlIGNoYW5uZWwgcGxheWluZyB0aGUgc291bmQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwbGF5U291bmQoc291bmQsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBsZXQgY2hhbm5lbCA9IG51bGw7XG4gICAgICAgIGlmIChDaGFubmVsKSB7XG4gICAgICAgICAgICBjaGFubmVsID0gbmV3IENoYW5uZWwodGhpcywgc291bmQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgY2hhbm5lbC5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYW5uZWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IHtAbGluayBDaGFubmVsM2R9IGFuZCBiZWdpbiBwbGF5YmFjayBvZiB0aGUgc291bmQgYXQgdGhlIHBvc2l0aW9uIHNwZWNpZmllZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U291bmR9IHNvdW5kIC0gVGhlIFNvdW5kIG9iamVjdCB0byBwbGF5LlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIHNvdW5kIGluIDNEIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnZvbHVtZV0gLSBUaGUgdm9sdW1lIHRvIHBsYXliYWNrIGF0LCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5sb29wXSAtIFdoZXRoZXIgdG8gbG9vcCB0aGUgc291bmQgd2hlbiBpdCByZWFjaGVzIHRoZSBlbmQuXG4gICAgICogQHJldHVybnMge0NoYW5uZWwzZH0gVGhlIDNEIGNoYW5uZWwgcGxheWluZyB0aGUgc291bmQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwbGF5U291bmQzZChzb3VuZCwgcG9zaXRpb24sIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBsZXQgY2hhbm5lbCA9IG51bGw7XG4gICAgICAgIGlmIChDaGFubmVsM2QpIHtcbiAgICAgICAgICAgIGNoYW5uZWwgPSBuZXcgQ2hhbm5lbDNkKHRoaXMsIHNvdW5kLCBvcHRpb25zKTtcbiAgICAgICAgICAgIGNoYW5uZWwuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudm9sdW1lKSB7XG4gICAgICAgICAgICAgICAgY2hhbm5lbC5zZXRWb2x1bWUob3B0aW9ucy52b2x1bWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubG9vcCkge1xuICAgICAgICAgICAgICAgIGNoYW5uZWwuc2V0TG9vcChvcHRpb25zLmxvb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubWF4RGlzdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBjaGFubmVsLnNldE1heERpc3RhbmNlKG9wdGlvbnMubWF4RGlzdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubWluRGlzdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBjaGFubmVsLnNldE1pbkRpc3RhbmNlKG9wdGlvbnMubWluRGlzdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMucm9sbE9mZkZhY3Rvcikge1xuICAgICAgICAgICAgICAgIGNoYW5uZWwuc2V0Um9sbE9mZkZhY3RvcihvcHRpb25zLnJvbGxPZmZGYWN0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuZGlzdGFuY2VNb2RlbCkge1xuICAgICAgICAgICAgICAgIGNoYW5uZWwuc2V0RGlzdGFuY2VNb2RlbChvcHRpb25zLmRpc3RhbmNlTW9kZWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjaGFubmVsLnBsYXkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGFubmVsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCB0aGUgbmVjZXNzYXJ5IFdpbmRvdyBFdmVudExpc3RlbmVycyB0byBjb21wbHkgd2l0aCBhdXRvLXBsYXkgcG9saWNpZXMsXG4gICAgICogYW5kIGNvcnJlY3RseSB1bmxvY2sgYW5kIHJlc3VtZSB0aGUgQXVkaW9Db250ZXh0LlxuICAgICAqIEZvciBtb3JlIGluZm8sIGh0dHBzOi8vZGV2ZWxvcGVycy5nb29nbGUuY29tL3dlYi91cGRhdGVzLzIwMTgvMTEvd2ViLWF1ZGlvLWF1dG9wbGF5LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkQ29udGV4dFVubG9ja0xpc3RlbmVycygpIHtcbiAgICAgICAgdGhpcy5fdW5sb2NraW5nID0gZmFsc2U7XG5cbiAgICAgICAgLy8gcmVzdW1lIEF1ZGlvQ29udGV4dCBvbiB1c2VyIGludGVyYWN0aW9uIGJlY2F1c2Ugb2YgYXV0b3BsYXkgcG9saWN5XG4gICAgICAgIGlmICghdGhpcy5fcmVzdW1lQ29udGV4dENhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXN1bWVDb250ZXh0Q2FsbGJhY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gcHJldmVudCBtdWx0aXBsZSB1bmxvY2sgY2FsbHNcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NvbnRleHQgfHwgdGhpcy5fdW5sb2NrZWQgfHwgdGhpcy5fdW5sb2NraW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5sb2NraW5nID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIC8vIHRyaWdnZXIgdGhlIHJlc3VtZSBmbG93IGZyb20gYSBVc2VyLWluaXRpYXRlZCBldmVudFxuICAgICAgICAgICAgICAgIHRoaXMucmVzdW1lKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBTb21lIHBsYXRmb3JtcyAobW9zdGx5IGlPUykgcmVxdWlyZSBhbiBhZGRpdGlvbmFsIHNvdW5kIHRvIGJlIHBsYXllZC5cbiAgICAgICAgICAgICAgICAvLyBUaGlzIGFsc28gcGVyZm9ybXMgYSBzYW5pdHkgY2hlY2sgYW5kIHZlcmlmaWVzIHNvdW5kcyBjYW4gYmUgcGxheWVkLlxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IHRoaXMuX2NvbnRleHQuY3JlYXRlQnVmZmVyKDEsIDEsIHRoaXMuX2NvbnRleHQuc2FtcGxlUmF0ZSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5fY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgICAgICAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgICAgICAgICAgIHNvdXJjZS5jb25uZWN0KHRoaXMuX2NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICAgICAgICAgIHNvdXJjZS5zdGFydCgwKTtcblxuICAgICAgICAgICAgICAgIC8vIG9uZW5kZWQgaXMgb25seSBjYWxsZWQgaWYgZXZlcnl0aGluZyB3b3JrZWQgYXMgZXhwZWN0ZWQgKGNvbnRleHQgaXMgcnVubmluZylcbiAgICAgICAgICAgICAgICBzb3VyY2Uub25lbmRlZCA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzb3VyY2UuZGlzY29ubmVjdCgwKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyB1bmxvY2tlZCFcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5sb2NrZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmxvY2tpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVtb3ZlVXNlcklucHV0TGlzdGVuZXJzKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhdHRhY2ggdG8gYWxsIHVzZXIgaW5wdXQgZXZlbnRzXG4gICAgICAgIFVTRVJfSU5QVVRfRVZFTlRTLmZvckVhY2goKGV2ZW50TmFtZSkgPT4ge1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCB0aGlzLl9yZXN1bWVDb250ZXh0Q2FsbGJhY2ssIGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGFsbCBVU0VSX0lOUFVUX0VWRU5UUyB1bmxvY2sgZXZlbnQgbGlzdGVuZXJzLCBpZiB0aGV5J3JlIHN0aWxsIGF0dGFjaGVkLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVtb3ZlVXNlcklucHV0TGlzdGVuZXJzKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Jlc3VtZUNvbnRleHRDYWxsYmFjaykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgVVNFUl9JTlBVVF9FVkVOVFMuZm9yRWFjaCgoZXZlbnROYW1lKSA9PiB7XG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIHRoaXMuX3Jlc3VtZUNvbnRleHRDYWxsYmFjaywgZmFsc2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fcmVzdW1lQ29udGV4dENhbGxiYWNrID0gbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNvdW5kTWFuYWdlciB9O1xuIl0sIm5hbWVzIjpbIkNPTlRFWFRfU1RBVEVfUlVOTklORyIsIkNPTlRFWFRfU1RBVEVfSU5URVJSVVBURUQiLCJVU0VSX0lOUFVUX0VWRU5UUyIsIlNvdW5kTWFuYWdlciIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsIl9jb250ZXh0IiwiX2ZvcmNlV2ViQXVkaW9BcGkiLCJmb3JjZVdlYkF1ZGlvQXBpIiwiX3Jlc3VtZUNvbnRleHRDYWxsYmFjayIsIl9zZWxmU3VzcGVuZGVkIiwiX3VubG9ja2VkIiwiX3VubG9ja2luZyIsImhhc0F1ZGlvQ29udGV4dCIsIkRlYnVnIiwid2FybiIsImxpc3RlbmVyIiwiTGlzdGVuZXIiLCJfdm9sdW1lIiwidm9sdW1lIiwibWF0aCIsImNsYW1wIiwiZmlyZSIsInN1c3BlbmRlZCIsInN0YXRlIiwiY29udGV4dCIsIkF1ZGlvQ29udGV4dCIsIndlYmtpdEF1ZGlvQ29udGV4dCIsIl9hZGRDb250ZXh0VW5sb2NrTGlzdGVuZXJzIiwic2VsZiIsIm9uc3RhdGVjaGFuZ2UiLCJyZXN1bWUiLCJ0aGVuIiwiZSIsImVycm9yIiwiY2F0Y2giLCJzdXNwZW5kIiwiZGVzdHJveSIsIl9yZW1vdmVVc2VySW5wdXRMaXN0ZW5lcnMiLCJjbG9zZSIsInBsYXlTb3VuZCIsInNvdW5kIiwiY2hhbm5lbCIsIkNoYW5uZWwiLCJwbGF5IiwicGxheVNvdW5kM2QiLCJwb3NpdGlvbiIsIkNoYW5uZWwzZCIsInNldFBvc2l0aW9uIiwic2V0Vm9sdW1lIiwibG9vcCIsInNldExvb3AiLCJtYXhEaXN0YW5jZSIsInNldE1heERpc3RhbmNlIiwibWluRGlzdGFuY2UiLCJzZXRNaW5EaXN0YW5jZSIsInJvbGxPZmZGYWN0b3IiLCJzZXRSb2xsT2ZmRmFjdG9yIiwiZGlzdGFuY2VNb2RlbCIsInNldERpc3RhbmNlTW9kZWwiLCJidWZmZXIiLCJjcmVhdGVCdWZmZXIiLCJzYW1wbGVSYXRlIiwic291cmNlIiwiY3JlYXRlQnVmZmVyU291cmNlIiwiY29ubmVjdCIsImRlc3RpbmF0aW9uIiwic3RhcnQiLCJvbmVuZGVkIiwiZXZlbnQiLCJkaXNjb25uZWN0IiwiZm9yRWFjaCIsImV2ZW50TmFtZSIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBWUEsTUFBTUEscUJBQXFCLEdBQUcsU0FBOUIsQ0FBQTtBQUNBLE1BQU1DLHlCQUF5QixHQUFHLGFBQWxDLENBQUE7QUFLQSxNQUFNQyxpQkFBaUIsR0FBRyxDQUN0QixPQURzQixFQUNiLGFBRGEsRUFDRSxVQURGLEVBQ2MsVUFEZCxFQUMwQixXQUQxQixFQUV0QixTQUZzQixFQUVYLFdBRlcsRUFFRSxVQUZGLEVBRWMsU0FGZCxFQUV5QixPQUZ6QixDQUExQixDQUFBOztBQVdBLE1BQU1DLFlBQU4sU0FBMkJDLFlBQTNCLENBQXdDO0VBUXBDQyxXQUFXLENBQUNDLE9BQUQsRUFBVTtBQUNqQixJQUFBLEtBQUEsRUFBQSxDQUFBO0lBUUEsSUFBS0MsQ0FBQUEsUUFBTCxHQUFnQixJQUFoQixDQUFBO0FBTUEsSUFBQSxJQUFBLENBQUtDLGlCQUFMLEdBQXlCRixPQUFPLENBQUNHLGdCQUFqQyxDQUFBO0lBUUEsSUFBS0MsQ0FBQUEsc0JBQUwsR0FBOEIsSUFBOUIsQ0FBQTtJQVVBLElBQUtDLENBQUFBLGNBQUwsR0FBc0IsS0FBdEIsQ0FBQTtJQVNBLElBQUtDLENBQUFBLFNBQUwsR0FBaUIsS0FBakIsQ0FBQTtJQVNBLElBQUtDLENBQUFBLFVBQUwsR0FBa0IsS0FBbEIsQ0FBQTs7QUFFQSxJQUFBLElBQUks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