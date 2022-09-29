import '../core/tracing.js';
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

    if (!hasAudioContext() && !this._forceWebAudioApi) ;

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
              self._context.resume().then(() => {}, e => {}).catch(e => {});
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
      }, e => {}).catch(e => {});
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
