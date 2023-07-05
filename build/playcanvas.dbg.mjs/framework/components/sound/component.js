import { Debug } from '../../../core/debug.js';
import { DISTANCE_LINEAR } from '../../../platform/audio/constants.js';
import { Component } from '../component.js';
import { SoundSlot } from './slot.js';

/**
 * The Sound Component controls playback of {@link Sound}s.
 *
 * @augments Component
 */
class SoundComponent extends Component {
  /**
   * Create a new Sound Component.
   *
   * @param {import('./system.js').SoundComponentSystem} system - The ComponentSystem that
   * created this component.
   * @param {import('../../entity.js').Entity} entity - The entity that the Component is attached
   * to.
   */
  constructor(system, entity) {
    super(system, entity);

    /** @private */
    this._volume = 1;
    /** @private */
    this._pitch = 1;
    /** @private */
    this._positional = true;
    /** @private */
    this._refDistance = 1;
    /** @private */
    this._maxDistance = 10000;
    /** @private */
    this._rollOffFactor = 1;
    /** @private */
    this._distanceModel = DISTANCE_LINEAR;

    /**
     * @type {Object<string, SoundSlot>}
     * @private
     */
    this._slots = {};

    /** @private */
    this._playingBeforeDisable = {};
  }

  /**
   * Fired when a sound instance starts playing.
   *
   * @event SoundComponent#play
   * @param {SoundSlot} slot - The slot whose instance started playing.
   * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
   * that started playing.
   */

  /**
   * Fired when a sound instance is paused.
   *
   * @event SoundComponent#pause
   * @param {SoundSlot} slot - The slot whose instance was paused.
   * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
   * that was paused created to play the sound.
   */

  /**
   * Fired when a sound instance is resumed.
   *
   * @event SoundComponent#resume
   * @param {SoundSlot} slot - The slot whose instance was resumed.
   * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
   * that was resumed.
   */

  /**
   * Fired when a sound instance is stopped.
   *
   * @event SoundComponent#stop
   * @param {SoundSlot} slot - The slot whose instance was stopped.
   * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
   * that was stopped.
   */

  /**
   * Fired when a sound instance stops playing because it reached its ending.
   *
   * @event SoundComponent#end
   * @param {SoundSlot} slot - The slot whose instance ended.
   * @param {import('../../../platform/sound/instance.js').SoundInstance} instance - The instance
   * that ended.
   */

  /**
   * Update the specified property on all sound instances.
   *
   * @param {string} property - The name of the SoundInstance property to update.
   * @param {string|number} value - The value to set the property to.
   * @param {boolean} isFactor - True if the value is a factor of the slot property or false
   * if it is an absolute value.
   * @private
   */
  _updateSoundInstances(property, value, isFactor) {
    const slots = this._slots;
    for (const key in slots) {
      const slot = slots[key];
      // only change value of non-overlapping instances
      if (!slot.overlap) {
        const instances = slot.instances;
        for (let i = 0, len = instances.length; i < len; i++) {
          instances[i][property] = isFactor ? slot[property] * value : value;
        }
      }
    }
  }

  /**
   * Determines which algorithm to use to reduce the volume of the sound as it moves away from
   * the listener. Can be:
   *
   * - {@link DISTANCE_LINEAR}
   * - {@link DISTANCE_INVERSE}
   * - {@link DISTANCE_EXPONENTIAL}
   *
   * Defaults to {@link DISTANCE_LINEAR}.
   *
   * @type {string}
   */
  set distanceModel(value) {
    this._distanceModel = value;
    this._updateSoundInstances('distanceModel', value, false);
  }
  get distanceModel() {
    return this._distanceModel;
  }

  /**
   * The maximum distance from the listener at which audio falloff stops. Note the volume of the
   * audio is not 0 after this distance, but just doesn't fall off anymore. Defaults to 10000.
   *
   * @type {number}
   */
  set maxDistance(value) {
    this._maxDistance = value;
    this._updateSoundInstances('maxDistance', value, false);
  }
  get maxDistance() {
    return this._maxDistance;
  }

  /**
   * The reference distance for reducing volume as the sound source moves further from the
   * listener. Defaults to 1.
   *
   * @type {number}
   */
  set refDistance(value) {
    this._refDistance = value;
    this._updateSoundInstances('refDistance', value, false);
  }
  get refDistance() {
    return this._refDistance;
  }

  /**
   * The factor used in the falloff equation. Defaults to 1.
   *
   * @type {number}
   */
  set rollOffFactor(value) {
    this._rollOffFactor = value;
    this._updateSoundInstances('rollOffFactor', value, false);
  }
  get rollOffFactor() {
    return this._rollOffFactor;
  }

  /**
   * The pitch modifier to play the audio with. Must be larger than 0.01. Defaults to 1.
   *
   * @type {number}
   */
  set pitch(value) {
    this._pitch = value;
    this._updateSoundInstances('pitch', value, true);
  }
  get pitch() {
    return this._pitch;
  }

  /**
   * The volume modifier to play the audio with. In range 0-1. Defaults to 1.
   *
   * @type {number}
   */
  set volume(value) {
    this._volume = value;
    this._updateSoundInstances('volume', value, true);
  }
  get volume() {
    return this._volume;
  }

  /**
   * If true the audio will play back at the location of the Entity in space, so the audio will
   * be affected by the position of the {@link AudioListenerComponent}. Defaults to true.
   *
   * @type {boolean}
   */
  set positional(newValue) {
    this._positional = newValue;
    const slots = this._slots;
    for (const key in slots) {
      const slot = slots[key];
      // recreate non overlapping sounds
      if (!slot.overlap) {
        const instances = slot.instances;
        const oldLength = instances.length;

        // When the instance is stopped, it gets removed from the slot.instances array
        // so we are going backwards to compensate for that

        for (let i = oldLength - 1; i >= 0; i--) {
          const isPlaying = instances[i].isPlaying || instances[i].isSuspended;
          const currentTime = instances[i].currentTime;
          if (isPlaying) instances[i].stop();
          const instance = slot._createInstance();
          if (isPlaying) {
            instance.play();
            instance.currentTime = currentTime;
          }
          instances.push(instance);
        }
      }
    }
  }
  get positional() {
    return this._positional;
  }

  /**
   * A dictionary that contains the {@link SoundSlot}s managed by this SoundComponent.
   *
   * @type {Object<string, SoundSlot>}
   */
  set slots(newValue) {
    const oldValue = this._slots;

    // stop previous slots
    if (oldValue) {
      for (const key in oldValue) {
        oldValue[key].stop();
      }
    }
    const slots = {};

    // convert data to slots
    for (const key in newValue) {
      if (!(newValue[key] instanceof SoundSlot)) {
        if (newValue[key].name) {
          slots[newValue[key].name] = new SoundSlot(this, newValue[key].name, newValue[key]);
        }
      } else {
        slots[newValue[key].name] = newValue[key];
      }
    }
    this._slots = slots;

    // call onEnable in order to start autoPlay slots
    if (this.enabled && this.entity.enabled) this.onEnable();
  }
  get slots() {
    return this._slots;
  }
  onEnable() {
    // do not run if running in Editor
    if (this.system._inTools) {
      return;
    }
    const slots = this._slots;
    const playingBeforeDisable = this._playingBeforeDisable;
    for (const key in slots) {
      const slot = slots[key];
      // play if autoPlay is true or
      // if the slot was paused when the component
      // got disabled
      if (slot.autoPlay && slot.isStopped) {
        slot.play();
      } else if (playingBeforeDisable[key]) {
        slot.resume();
      } else if (!slot.isLoaded) {
        // start loading slots
        slot.load();
      }
    }
  }
  onDisable() {
    const slots = this._slots;
    const playingBeforeDisable = {};
    for (const key in slots) {
      // pause non-overlapping sounds
      if (!slots[key].overlap) {
        if (slots[key].isPlaying) {
          slots[key].pause();
          // remember sounds playing when we disable
          // so we can resume them on enable
          playingBeforeDisable[key] = true;
        }
      }
    }
    this._playingBeforeDisable = playingBeforeDisable;
  }
  onRemove() {
    this.off();
  }

  /**
   * Creates a new {@link SoundSlot} with the specified name.
   *
   * @param {string} name - The name of the slot.
   * @param {object} [options] - Settings for the slot.
   * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
   * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
   * @param {boolean} [options.loop=false] - If true the sound will restart when it reaches the end.
   * @param {number} [options.startTime=0] - The start time from which the sound will start playing.
   * @param {number} [options.duration=null] - The duration of the sound that the slot will play
   * starting from startTime.
   * @param {boolean} [options.overlap=false] - If true then sounds played from slot will be
   * played independently of each other. Otherwise the slot will first stop the current sound
   * before starting the new one.
   * @param {boolean} [options.autoPlay=false] - If true the slot will start playing as soon as
   * its audio asset is loaded.
   * @param {number} [options.asset=null] - The asset id of the audio asset that is going to be
   * played by this slot.
   * @returns {SoundSlot|null} The new slot or null if the slot already exists.
   * @example
   * // get an asset by id
   * const asset = app.assets.get(10);
   * // add a slot
   * this.entity.sound.addSlot('beep', {
   *     asset: asset
   * });
   * // play
   * this.entity.sound.play('beep');
   */
  addSlot(name, options) {
    const slots = this._slots;
    if (slots[name]) {
      Debug.warn(`A sound slot with name ${name} already exists on Entity ${this.entity.path}`);
      return null;
    }
    const slot = new SoundSlot(this, name, options);
    slots[name] = slot;
    if (slot.autoPlay && this.enabled && this.entity.enabled) {
      slot.play();
    }
    return slot;
  }

  /**
   * Removes the {@link SoundSlot} with the specified name.
   *
   * @param {string} name - The name of the slot.
   * @example
   * // remove a slot called 'beep'
   * this.entity.sound.removeSlot('beep');
   */
  removeSlot(name) {
    const slots = this._slots;
    if (slots[name]) {
      slots[name].stop();
      delete slots[name];
    }
  }

  /**
   * Returns the slot with the specified name.
   *
   * @param {string} name - The name of the slot.
   * @returns {SoundSlot|undefined} The slot.
   * @example
   * // get a slot and set its volume
   * this.entity.sound.slot('beep').volume = 0.5;
   *
   */
  slot(name) {
    return this._slots[name];
  }

  /**
   * Return a property from the slot with the specified name.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @param {string} property - The name of the property to look for.
   * @returns {*} The value from the looked property inside the slot with specified name. May be undefined if slot does not exist.
   * @private
   */
  _getSlotProperty(name, property) {
    if (!this.enabled || !this.entity.enabled) {
      return undefined;
    }
    const slot = this._slots[name];
    if (!slot) {
      Debug.warn(`Trying to get ${property} from sound slot with name ${name} which does not exist`);
      return undefined;
    }
    return slot[property];
  }

  /**
   * Returns true if the slot with the specified name is currently playing.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and is currently playing.
   */
  isPlaying(name) {
    return this._getSlotProperty(name, 'isPlaying') || false;
  }

  /**
   * Returns true if the asset of the slot with the specified name is loaded..
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and its asset is loaded.
   */
  isLoaded(name) {
    return this._getSlotProperty(name, 'isLoaded') || false;
  }

  /**
   * Returns true if the slot with the specified name is currently paused.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and is currently paused.
   */
  isPaused(name) {
    return this._getSlotProperty(name, 'isPaused') || false;
  }

  /**
   * Returns true if the slot with the specified name is currently stopped.
   *
   * @param {string} name - The name of the {@link SoundSlot} to look for.
   * @returns {boolean} True if the slot with the specified name exists and is currently stopped.
   */
  isStopped(name) {
    return this._getSlotProperty(name, 'isStopped') || false;
  }

  /**
   * Begins playing the sound slot with the specified name. The slot will restart playing if it
   * is already playing unless the overlap field is true in which case a new sound will be
   * created and played.
   *
   * @param {string} name - The name of the {@link SoundSlot} to play.
   * @returns {import('../../../platform/sound/instance.js').SoundInstance|null} The sound
   * instance that will be played. Returns null if the component or its parent entity is disabled
   * or if the SoundComponent has no slot with the specified name.
   * @example
   * // get asset by id
   * const asset = app.assets.get(10);
   * // create a slot and play it
   * this.entity.sound.addSlot('beep', {
   *     asset: asset
   * });
   * this.entity.sound.play('beep');
   */
  play(name) {
    if (!this.enabled || !this.entity.enabled) {
      return null;
    }
    const slot = this._slots[name];
    if (!slot) {
      Debug.warn(`Trying to play sound slot with name ${name} which does not exist`);
      return null;
    }
    return slot.play();
  }

  /**
   * Pauses playback of the slot with the specified name. If the name is undefined then all slots
   * currently played will be paused. The slots can be resumed by calling {@link SoundComponent#resume}.
   *
   * @param {string} [name] - The name of the slot to pause. Leave undefined to pause everything.
   * @example
   * // pause all sounds
   * this.entity.sound.pause();
   * // pause a specific sound
   * this.entity.sound.pause('beep');
   */
  pause(name) {
    const slots = this._slots;
    if (name) {
      const slot = slots[name];
      if (!slot) {
        Debug.warn(`Trying to pause sound slot with name ${name} which does not exist`);
        return;
      }
      slot.pause();
    } else {
      for (const key in slots) {
        slots[key].pause();
      }
    }
  }

  /**
   * Resumes playback of the sound slot with the specified name if it's paused. If no name is
   * specified all slots will be resumed.
   *
   * @param {string} [name] - The name of the slot to resume. Leave undefined to resume everything.
   * @example
   * // resume all sounds
   * this.entity.sound.resume();
   * // resume a specific sound
   * this.entity.sound.resume('beep');
   */
  resume(name) {
    const slots = this._slots;
    if (name) {
      const slot = slots[name];
      if (!slot) {
        Debug.warn(`Trying to resume sound slot with name ${name} which does not exist`);
        return;
      }
      if (slot.isPaused) {
        slot.resume();
      }
    } else {
      for (const key in slots) {
        slots[key].resume();
      }
    }
  }

  /**
   * Stops playback of the sound slot with the specified name if it's paused. If no name is
   * specified all slots will be stopped.
   *
   * @param {string} [name] - The name of the slot to stop. Leave undefined to stop everything.
   * @example
   * // stop all sounds
   * this.entity.sound.stop();
   * // stop a specific sound
   * this.entity.sound.stop('beep');
   */
  stop(name) {
    const slots = this._slots;
    if (name) {
      const slot = slots[name];
      if (!slot) {
        Debug.warn(`Trying to stop sound slot with name ${name} which does not exist`);
        return;
      }
      slot.stop();
    } else {
      for (const key in slots) {
        slots[key].stop();
      }
    }
  }
}

export { SoundComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc291bmQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IERJU1RBTkNFX0xJTkVBUiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2F1ZGlvL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmltcG9ydCB7IFNvdW5kU2xvdCB9IGZyb20gJy4vc2xvdC5qcyc7XG5cbi8qKlxuICogVGhlIFNvdW5kIENvbXBvbmVudCBjb250cm9scyBwbGF5YmFjayBvZiB7QGxpbmsgU291bmR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIFNvdW5kQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU291bmQgQ29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuU291bmRDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBjb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSB0aGF0IHRoZSBDb21wb25lbnQgaXMgYXR0YWNoZWRcbiAgICAgKiB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IDE7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9waXRjaCA9IDE7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9wb3NpdGlvbmFsID0gdHJ1ZTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3JlZkRpc3RhbmNlID0gMTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX21heERpc3RhbmNlID0gMTAwMDA7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9yb2xsT2ZmRmFjdG9yID0gMTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX2Rpc3RhbmNlTW9kZWwgPSBESVNUQU5DRV9MSU5FQVI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBTb3VuZFNsb3Q+fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2xvdHMgPSB7fTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fcGxheWluZ0JlZm9yZURpc2FibGUgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2Ugc3RhcnRzIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRDb21wb25lbnQjcGxheVxuICAgICAqIEBwYXJhbSB7U291bmRTbG90fSBzbG90IC0gVGhlIHNsb3Qgd2hvc2UgaW5zdGFuY2Ugc3RhcnRlZCBwbGF5aW5nLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcycpLlNvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlXG4gICAgICogdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kQ29tcG9uZW50I3BhdXNlXG4gICAgICogQHBhcmFtIHtTb3VuZFNsb3R9IHNsb3QgLSBUaGUgc2xvdCB3aG9zZSBpbnN0YW5jZSB3YXMgcGF1c2VkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcycpLlNvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlXG4gICAgICogdGhhdCB3YXMgcGF1c2VkIGNyZWF0ZWQgdG8gcGxheSB0aGUgc291bmQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZENvbXBvbmVudCNyZXN1bWVcbiAgICAgKiBAcGFyYW0ge1NvdW5kU2xvdH0gc2xvdCAtIFRoZSBzbG90IHdob3NlIGluc3RhbmNlIHdhcyByZXN1bWVkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcycpLlNvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlXG4gICAgICogdGhhdCB3YXMgcmVzdW1lZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBpcyBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kQ29tcG9uZW50I3N0b3BcbiAgICAgKiBAcGFyYW0ge1NvdW5kU2xvdH0gc2xvdCAtIFRoZSBzbG90IHdob3NlIGluc3RhbmNlIHdhcyBzdG9wcGVkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcycpLlNvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlXG4gICAgICogdGhhdCB3YXMgc3RvcHBlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBzdG9wcyBwbGF5aW5nIGJlY2F1c2UgaXQgcmVhY2hlZCBpdHMgZW5kaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kQ29tcG9uZW50I2VuZFxuICAgICAqIEBwYXJhbSB7U291bmRTbG90fSBzbG90IC0gVGhlIHNsb3Qgd2hvc2UgaW5zdGFuY2UgZW5kZWQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlLmpzJykuU291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2VcbiAgICAgKiB0aGF0IGVuZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBzcGVjaWZpZWQgcHJvcGVydHkgb24gYWxsIHNvdW5kIGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eSAtIFRoZSBuYW1lIG9mIHRoZSBTb3VuZEluc3RhbmNlIHByb3BlcnR5IHRvIHVwZGF0ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIHNldCB0aGUgcHJvcGVydHkgdG8uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc0ZhY3RvciAtIFRydWUgaWYgdGhlIHZhbHVlIGlzIGEgZmFjdG9yIG9mIHRoZSBzbG90IHByb3BlcnR5IG9yIGZhbHNlXG4gICAgICogaWYgaXQgaXMgYW4gYWJzb2x1dGUgdmFsdWUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlU291bmRJbnN0YW5jZXMocHJvcGVydHksIHZhbHVlLCBpc0ZhY3Rvcikge1xuICAgICAgICBjb25zdCBzbG90cyA9IHRoaXMuX3Nsb3RzO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBzbG90cykge1xuICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHNsb3RzW2tleV07XG4gICAgICAgICAgICAvLyBvbmx5IGNoYW5nZSB2YWx1ZSBvZiBub24tb3ZlcmxhcHBpbmcgaW5zdGFuY2VzXG4gICAgICAgICAgICBpZiAoIXNsb3Qub3ZlcmxhcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHNsb3QuaW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldW3Byb3BlcnR5XSA9IGlzRmFjdG9yID8gc2xvdFtwcm9wZXJ0eV0gKiB2YWx1ZSA6IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGVybWluZXMgd2hpY2ggYWxnb3JpdGhtIHRvIHVzZSB0byByZWR1Y2UgdGhlIHZvbHVtZSBvZiB0aGUgc291bmQgYXMgaXQgbW92ZXMgYXdheSBmcm9tXG4gICAgICogdGhlIGxpc3RlbmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBESVNUQU5DRV9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRElTVEFOQ0VfSU5WRVJTRX1cbiAgICAgKiAtIHtAbGluayBESVNUQU5DRV9FWFBPTkVOVElBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBESVNUQU5DRV9MSU5FQVJ9LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgZGlzdGFuY2VNb2RlbCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kaXN0YW5jZU1vZGVsID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVNvdW5kSW5zdGFuY2VzKCdkaXN0YW5jZU1vZGVsJywgdmFsdWUsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBnZXQgZGlzdGFuY2VNb2RlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Rpc3RhbmNlTW9kZWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gZGlzdGFuY2UgZnJvbSB0aGUgbGlzdGVuZXIgYXQgd2hpY2ggYXVkaW8gZmFsbG9mZiBzdG9wcy4gTm90ZSB0aGUgdm9sdW1lIG9mIHRoZVxuICAgICAqIGF1ZGlvIGlzIG5vdCAwIGFmdGVyIHRoaXMgZGlzdGFuY2UsIGJ1dCBqdXN0IGRvZXNuJ3QgZmFsbCBvZmYgYW55bW9yZS4gRGVmYXVsdHMgdG8gMTAwMDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXhEaXN0YW5jZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXhEaXN0YW5jZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVTb3VuZEluc3RhbmNlcygnbWF4RGlzdGFuY2UnLCB2YWx1ZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIGdldCBtYXhEaXN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21heERpc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByZWZlcmVuY2UgZGlzdGFuY2UgZm9yIHJlZHVjaW5nIHZvbHVtZSBhcyB0aGUgc291bmQgc291cmNlIG1vdmVzIGZ1cnRoZXIgZnJvbSB0aGVcbiAgICAgKiBsaXN0ZW5lci4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlZkRpc3RhbmNlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlZkRpc3RhbmNlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVNvdW5kSW5zdGFuY2VzKCdyZWZEaXN0YW5jZScsIHZhbHVlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgZ2V0IHJlZkRpc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVmRGlzdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGZhY3RvciB1c2VkIGluIHRoZSBmYWxsb2ZmIGVxdWF0aW9uLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcm9sbE9mZkZhY3Rvcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9yb2xsT2ZmRmFjdG9yID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVNvdW5kSW5zdGFuY2VzKCdyb2xsT2ZmRmFjdG9yJywgdmFsdWUsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBnZXQgcm9sbE9mZkZhY3RvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JvbGxPZmZGYWN0b3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpdGNoIG1vZGlmaWVyIHRvIHBsYXkgdGhlIGF1ZGlvIHdpdGguIE11c3QgYmUgbGFyZ2VyIHRoYW4gMC4wMS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHBpdGNoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BpdGNoID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVNvdW5kSW5zdGFuY2VzKCdwaXRjaCcsIHZhbHVlLCB0cnVlKTtcbiAgICB9XG5cbiAgICBnZXQgcGl0Y2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXRjaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdm9sdW1lIG1vZGlmaWVyIHRvIHBsYXkgdGhlIGF1ZGlvIHdpdGguIEluIHJhbmdlIDAtMS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHZvbHVtZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl92b2x1bWUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlU291bmRJbnN0YW5jZXMoJ3ZvbHVtZScsIHZhbHVlLCB0cnVlKTtcbiAgICB9XG5cbiAgICBnZXQgdm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGF1ZGlvIHdpbGwgcGxheSBiYWNrIGF0IHRoZSBsb2NhdGlvbiBvZiB0aGUgRW50aXR5IGluIHNwYWNlLCBzbyB0aGUgYXVkaW8gd2lsbFxuICAgICAqIGJlIGFmZmVjdGVkIGJ5IHRoZSBwb3NpdGlvbiBvZiB0aGUge0BsaW5rIEF1ZGlvTGlzdGVuZXJDb21wb25lbnR9LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHBvc2l0aW9uYWwobmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcG9zaXRpb25hbCA9IG5ld1ZhbHVlO1xuXG4gICAgICAgIGNvbnN0IHNsb3RzID0gdGhpcy5fc2xvdHM7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHNsb3RzKSB7XG4gICAgICAgICAgICBjb25zdCBzbG90ID0gc2xvdHNba2V5XTtcbiAgICAgICAgICAgIC8vIHJlY3JlYXRlIG5vbiBvdmVybGFwcGluZyBzb3VuZHNcbiAgICAgICAgICAgIGlmICghc2xvdC5vdmVybGFwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gc2xvdC5pbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkTGVuZ3RoID0gaW5zdGFuY2VzLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgIC8vIFdoZW4gdGhlIGluc3RhbmNlIGlzIHN0b3BwZWQsIGl0IGdldHMgcmVtb3ZlZCBmcm9tIHRoZSBzbG90Lmluc3RhbmNlcyBhcnJheVxuICAgICAgICAgICAgICAgIC8vIHNvIHdlIGFyZSBnb2luZyBiYWNrd2FyZHMgdG8gY29tcGVuc2F0ZSBmb3IgdGhhdFxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IG9sZExlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzUGxheWluZyA9IGluc3RhbmNlc1tpXS5pc1BsYXlpbmcgfHwgaW5zdGFuY2VzW2ldLmlzU3VzcGVuZGVkO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IGluc3RhbmNlc1tpXS5jdXJyZW50VGltZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUGxheWluZylcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdG9wKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2UgPSBzbG90Ll9jcmVhdGVJbnN0YW5jZSgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5wbGF5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5jdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwb3NpdGlvbmFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcG9zaXRpb25hbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGRpY3Rpb25hcnkgdGhhdCBjb250YWlucyB0aGUge0BsaW5rIFNvdW5kU2xvdH1zIG1hbmFnZWQgYnkgdGhpcyBTb3VuZENvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBTb3VuZFNsb3Q+fVxuICAgICAqL1xuICAgIHNldCBzbG90cyhuZXdWYWx1ZSkge1xuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXMuX3Nsb3RzO1xuXG4gICAgICAgIC8vIHN0b3AgcHJldmlvdXMgc2xvdHNcbiAgICAgICAgaWYgKG9sZFZhbHVlKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBvbGRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIG9sZFZhbHVlW2tleV0uc3RvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2xvdHMgPSB7fTtcblxuICAgICAgICAvLyBjb252ZXJ0IGRhdGEgdG8gc2xvdHNcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmICghKG5ld1ZhbHVlW2tleV0gaW5zdGFuY2VvZiBTb3VuZFNsb3QpKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1ZhbHVlW2tleV0ubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBzbG90c1tuZXdWYWx1ZVtrZXldLm5hbWVdID0gbmV3IFNvdW5kU2xvdCh0aGlzLCBuZXdWYWx1ZVtrZXldLm5hbWUsIG5ld1ZhbHVlW2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2xvdHNbbmV3VmFsdWVba2V5XS5uYW1lXSA9IG5ld1ZhbHVlW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zbG90cyA9IHNsb3RzO1xuXG4gICAgICAgIC8vIGNhbGwgb25FbmFibGUgaW4gb3JkZXIgdG8gc3RhcnQgYXV0b1BsYXkgc2xvdHNcbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKVxuICAgICAgICAgICAgdGhpcy5vbkVuYWJsZSgpO1xuICAgIH1cblxuICAgIGdldCBzbG90cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nsb3RzO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICAvLyBkbyBub3QgcnVuIGlmIHJ1bm5pbmcgaW4gRWRpdG9yXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5faW5Ub29scykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLl9zbG90cztcbiAgICAgICAgY29uc3QgcGxheWluZ0JlZm9yZURpc2FibGUgPSB0aGlzLl9wbGF5aW5nQmVmb3JlRGlzYWJsZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBzbG90cykge1xuICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHNsb3RzW2tleV07XG4gICAgICAgICAgICAvLyBwbGF5IGlmIGF1dG9QbGF5IGlzIHRydWUgb3JcbiAgICAgICAgICAgIC8vIGlmIHRoZSBzbG90IHdhcyBwYXVzZWQgd2hlbiB0aGUgY29tcG9uZW50XG4gICAgICAgICAgICAvLyBnb3QgZGlzYWJsZWRcbiAgICAgICAgICAgIGlmIChzbG90LmF1dG9QbGF5ICYmIHNsb3QuaXNTdG9wcGVkKSB7XG4gICAgICAgICAgICAgICAgc2xvdC5wbGF5KCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBsYXlpbmdCZWZvcmVEaXNhYmxlW2tleV0pIHtcbiAgICAgICAgICAgICAgICBzbG90LnJlc3VtZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghc2xvdC5pc0xvYWRlZCkge1xuICAgICAgICAgICAgICAgIC8vIHN0YXJ0IGxvYWRpbmcgc2xvdHNcbiAgICAgICAgICAgICAgICBzbG90LmxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLl9zbG90cztcbiAgICAgICAgY29uc3QgcGxheWluZ0JlZm9yZURpc2FibGUgPSB7fTtcblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBzbG90cykge1xuICAgICAgICAgICAgLy8gcGF1c2Ugbm9uLW92ZXJsYXBwaW5nIHNvdW5kc1xuICAgICAgICAgICAgaWYgKCFzbG90c1trZXldLm92ZXJsYXApIHtcbiAgICAgICAgICAgICAgICBpZiAoc2xvdHNba2V5XS5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgc2xvdHNba2V5XS5wYXVzZSgpO1xuICAgICAgICAgICAgICAgICAgICAvLyByZW1lbWJlciBzb3VuZHMgcGxheWluZyB3aGVuIHdlIGRpc2FibGVcbiAgICAgICAgICAgICAgICAgICAgLy8gc28gd2UgY2FuIHJlc3VtZSB0aGVtIG9uIGVuYWJsZVxuICAgICAgICAgICAgICAgICAgICBwbGF5aW5nQmVmb3JlRGlzYWJsZVtrZXldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wbGF5aW5nQmVmb3JlRGlzYWJsZSA9IHBsYXlpbmdCZWZvcmVEaXNhYmxlO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcge0BsaW5rIFNvdW5kU2xvdH0gd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBTZXR0aW5ncyBmb3IgdGhlIHNsb3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnZvbHVtZT0xXSAtIFRoZSBwbGF5YmFjayB2b2x1bWUsIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMucGl0Y2g9MV0gLSBUaGUgcmVsYXRpdmUgcGl0Y2gsIGRlZmF1bHQgb2YgMSwgcGxheXMgYXQgbm9ybWFsIHBpdGNoLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubG9vcD1mYWxzZV0gLSBJZiB0cnVlIHRoZSBzb3VuZCB3aWxsIHJlc3RhcnQgd2hlbiBpdCByZWFjaGVzIHRoZSBlbmQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0VGltZT0wXSAtIFRoZSBzdGFydCB0aW1lIGZyb20gd2hpY2ggdGhlIHNvdW5kIHdpbGwgc3RhcnQgcGxheWluZy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZHVyYXRpb249bnVsbF0gLSBUaGUgZHVyYXRpb24gb2YgdGhlIHNvdW5kIHRoYXQgdGhlIHNsb3Qgd2lsbCBwbGF5XG4gICAgICogc3RhcnRpbmcgZnJvbSBzdGFydFRpbWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5vdmVybGFwPWZhbHNlXSAtIElmIHRydWUgdGhlbiBzb3VuZHMgcGxheWVkIGZyb20gc2xvdCB3aWxsIGJlXG4gICAgICogcGxheWVkIGluZGVwZW5kZW50bHkgb2YgZWFjaCBvdGhlci4gT3RoZXJ3aXNlIHRoZSBzbG90IHdpbGwgZmlyc3Qgc3RvcCB0aGUgY3VycmVudCBzb3VuZFxuICAgICAqIGJlZm9yZSBzdGFydGluZyB0aGUgbmV3IG9uZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmF1dG9QbGF5PWZhbHNlXSAtIElmIHRydWUgdGhlIHNsb3Qgd2lsbCBzdGFydCBwbGF5aW5nIGFzIHNvb24gYXNcbiAgICAgKiBpdHMgYXVkaW8gYXNzZXQgaXMgbG9hZGVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hc3NldD1udWxsXSAtIFRoZSBhc3NldCBpZCBvZiB0aGUgYXVkaW8gYXNzZXQgdGhhdCBpcyBnb2luZyB0byBiZVxuICAgICAqIHBsYXllZCBieSB0aGlzIHNsb3QuXG4gICAgICogQHJldHVybnMge1NvdW5kU2xvdHxudWxsfSBUaGUgbmV3IHNsb3Qgb3IgbnVsbCBpZiB0aGUgc2xvdCBhbHJlYWR5IGV4aXN0cy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGdldCBhbiBhc3NldCBieSBpZFxuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQoMTApO1xuICAgICAqIC8vIGFkZCBhIHNsb3RcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5hZGRTbG90KCdiZWVwJywge1xuICAgICAqICAgICBhc3NldDogYXNzZXRcbiAgICAgKiB9KTtcbiAgICAgKiAvLyBwbGF5XG4gICAgICogdGhpcy5lbnRpdHkuc291bmQucGxheSgnYmVlcCcpO1xuICAgICAqL1xuICAgIGFkZFNsb3QobmFtZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBzbG90cyA9IHRoaXMuX3Nsb3RzO1xuICAgICAgICBpZiAoc2xvdHNbbmFtZV0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYEEgc291bmQgc2xvdCB3aXRoIG5hbWUgJHtuYW1lfSBhbHJlYWR5IGV4aXN0cyBvbiBFbnRpdHkgJHt0aGlzLmVudGl0eS5wYXRofWApO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzbG90ID0gbmV3IFNvdW5kU2xvdCh0aGlzLCBuYW1lLCBvcHRpb25zKTtcbiAgICAgICAgc2xvdHNbbmFtZV0gPSBzbG90O1xuXG4gICAgICAgIGlmIChzbG90LmF1dG9QbGF5ICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICBzbG90LnBsYXkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzbG90O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIHtAbGluayBTb3VuZFNsb3R9IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2xvdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHJlbW92ZSBhIHNsb3QgY2FsbGVkICdiZWVwJ1xuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnJlbW92ZVNsb3QoJ2JlZXAnKTtcbiAgICAgKi9cbiAgICByZW1vdmVTbG90KG5hbWUpIHtcbiAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLl9zbG90cztcbiAgICAgICAgaWYgKHNsb3RzW25hbWVdKSB7XG4gICAgICAgICAgICBzbG90c1tuYW1lXS5zdG9wKCk7XG4gICAgICAgICAgICBkZWxldGUgc2xvdHNbbmFtZV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2xvdC5cbiAgICAgKiBAcmV0dXJucyB7U291bmRTbG90fHVuZGVmaW5lZH0gVGhlIHNsb3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBnZXQgYSBzbG90IGFuZCBzZXQgaXRzIHZvbHVtZVxuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnNsb3QoJ2JlZXAnKS52b2x1bWUgPSAwLjU7XG4gICAgICpcbiAgICAgKi9cbiAgICBzbG90KG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nsb3RzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhIHByb3BlcnR5IGZyb20gdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB7QGxpbmsgU291bmRTbG90fSB0byBsb29rIGZvci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHkgLSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gbG9vayBmb3IuXG4gICAgICogQHJldHVybnMgeyp9IFRoZSB2YWx1ZSBmcm9tIHRoZSBsb29rZWQgcHJvcGVydHkgaW5zaWRlIHRoZSBzbG90IHdpdGggc3BlY2lmaWVkIG5hbWUuIE1heSBiZSB1bmRlZmluZWQgaWYgc2xvdCBkb2VzIG5vdCBleGlzdC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRTbG90UHJvcGVydHkobmFtZSwgcHJvcGVydHkpIHtcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5fc2xvdHNbbmFtZV07XG4gICAgICAgIGlmICghc2xvdCkge1xuICAgICAgICAgICAgRGVidWcud2FybihgVHJ5aW5nIHRvIGdldCAke3Byb3BlcnR5fSBmcm9tIHNvdW5kIHNsb3Qgd2l0aCBuYW1lICR7bmFtZX0gd2hpY2ggZG9lcyBub3QgZXhpc3RgKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2xvdFtwcm9wZXJ0eV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lIGlzIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUge0BsaW5rIFNvdW5kU2xvdH0gdG8gbG9vayBmb3IuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgZXhpc3RzIGFuZCBpcyBjdXJyZW50bHkgcGxheWluZy5cbiAgICAgKi9cbiAgICBpc1BsYXlpbmcobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2xvdFByb3BlcnR5KG5hbWUsICdpc1BsYXlpbmcnKSB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGFzc2V0IG9mIHRoZSBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lIGlzIGxvYWRlZC4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB7QGxpbmsgU291bmRTbG90fSB0byBsb29rIGZvci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBleGlzdHMgYW5kIGl0cyBhc3NldCBpcyBsb2FkZWQuXG4gICAgICovXG4gICAgaXNMb2FkZWQobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2xvdFByb3BlcnR5KG5hbWUsICdpc0xvYWRlZCcpIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBpcyBjdXJyZW50bHkgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUge0BsaW5rIFNvdW5kU2xvdH0gdG8gbG9vayBmb3IuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgZXhpc3RzIGFuZCBpcyBjdXJyZW50bHkgcGF1c2VkLlxuICAgICAqL1xuICAgIGlzUGF1c2VkKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNsb3RQcm9wZXJ0eShuYW1lLCAnaXNQYXVzZWQnKSB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgaXMgY3VycmVudGx5IHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB7QGxpbmsgU291bmRTbG90fSB0byBsb29rIGZvci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBleGlzdHMgYW5kIGlzIGN1cnJlbnRseSBzdG9wcGVkLlxuICAgICAqL1xuICAgIGlzU3RvcHBlZChuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTbG90UHJvcGVydHkobmFtZSwgJ2lzU3RvcHBlZCcpIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJlZ2lucyBwbGF5aW5nIHRoZSBzb3VuZCBzbG90IHdpdGggdGhlIHNwZWNpZmllZCBuYW1lLiBUaGUgc2xvdCB3aWxsIHJlc3RhcnQgcGxheWluZyBpZiBpdFxuICAgICAqIGlzIGFscmVhZHkgcGxheWluZyB1bmxlc3MgdGhlIG92ZXJsYXAgZmllbGQgaXMgdHJ1ZSBpbiB3aGljaCBjYXNlIGEgbmV3IHNvdW5kIHdpbGwgYmVcbiAgICAgKiBjcmVhdGVkIGFuZCBwbGF5ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB7QGxpbmsgU291bmRTbG90fSB0byBwbGF5LlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlLmpzJykuU291bmRJbnN0YW5jZXxudWxsfSBUaGUgc291bmRcbiAgICAgKiBpbnN0YW5jZSB0aGF0IHdpbGwgYmUgcGxheWVkLiBSZXR1cm5zIG51bGwgaWYgdGhlIGNvbXBvbmVudCBvciBpdHMgcGFyZW50IGVudGl0eSBpcyBkaXNhYmxlZFxuICAgICAqIG9yIGlmIHRoZSBTb3VuZENvbXBvbmVudCBoYXMgbm8gc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGdldCBhc3NldCBieSBpZFxuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQoMTApO1xuICAgICAqIC8vIGNyZWF0ZSBhIHNsb3QgYW5kIHBsYXkgaXRcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5hZGRTbG90KCdiZWVwJywge1xuICAgICAqICAgICBhc3NldDogYXNzZXRcbiAgICAgKiB9KTtcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5wbGF5KCdiZWVwJyk7XG4gICAgICovXG4gICAgcGxheShuYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLl9zbG90c1tuYW1lXTtcbiAgICAgICAgaWYgKCFzbG90KSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gcGxheSBzb3VuZCBzbG90IHdpdGggbmFtZSAke25hbWV9IHdoaWNoIGRvZXMgbm90IGV4aXN0YCk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzbG90LnBsYXkoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgcGxheWJhY2sgb2YgdGhlIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUuIElmIHRoZSBuYW1lIGlzIHVuZGVmaW5lZCB0aGVuIGFsbCBzbG90c1xuICAgICAqIGN1cnJlbnRseSBwbGF5ZWQgd2lsbCBiZSBwYXVzZWQuIFRoZSBzbG90cyBjYW4gYmUgcmVzdW1lZCBieSBjYWxsaW5nIHtAbGluayBTb3VuZENvbXBvbmVudCNyZXN1bWV9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90IHRvIHBhdXNlLiBMZWF2ZSB1bmRlZmluZWQgdG8gcGF1c2UgZXZlcnl0aGluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHBhdXNlIGFsbCBzb3VuZHNcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5wYXVzZSgpO1xuICAgICAqIC8vIHBhdXNlIGEgc3BlY2lmaWMgc291bmRcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5wYXVzZSgnYmVlcCcpO1xuICAgICAqL1xuICAgIHBhdXNlKG5hbWUpIHtcbiAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLl9zbG90cztcblxuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHNsb3RzW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFzbG90KSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybihgVHJ5aW5nIHRvIHBhdXNlIHNvdW5kIHNsb3Qgd2l0aCBuYW1lICR7bmFtZX0gd2hpY2ggZG9lcyBub3QgZXhpc3RgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNsb3QucGF1c2UoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHNsb3RzKSB7XG4gICAgICAgICAgICAgICAgc2xvdHNba2V5XS5wYXVzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyBwbGF5YmFjayBvZiB0aGUgc291bmQgc2xvdCB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBpZiBpdCdzIHBhdXNlZC4gSWYgbm8gbmFtZSBpc1xuICAgICAqIHNwZWNpZmllZCBhbGwgc2xvdHMgd2lsbCBiZSByZXN1bWVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90IHRvIHJlc3VtZS4gTGVhdmUgdW5kZWZpbmVkIHRvIHJlc3VtZSBldmVyeXRoaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gcmVzdW1lIGFsbCBzb3VuZHNcbiAgICAgKiB0aGlzLmVudGl0eS5zb3VuZC5yZXN1bWUoKTtcbiAgICAgKiAvLyByZXN1bWUgYSBzcGVjaWZpYyBzb3VuZFxuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnJlc3VtZSgnYmVlcCcpO1xuICAgICAqL1xuICAgIHJlc3VtZShuYW1lKSB7XG4gICAgICAgIGNvbnN0IHNsb3RzID0gdGhpcy5fc2xvdHM7XG5cbiAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNsb3QgPSBzbG90c1tuYW1lXTtcbiAgICAgICAgICAgIGlmICghc2xvdCkge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oYFRyeWluZyB0byByZXN1bWUgc291bmQgc2xvdCB3aXRoIG5hbWUgJHtuYW1lfSB3aGljaCBkb2VzIG5vdCBleGlzdGApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNsb3QuaXNQYXVzZWQpIHtcbiAgICAgICAgICAgICAgICBzbG90LnJlc3VtZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2xvdHMpIHtcbiAgICAgICAgICAgICAgICBzbG90c1trZXldLnJlc3VtZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgcGxheWJhY2sgb2YgdGhlIHNvdW5kIHNsb3Qgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgaWYgaXQncyBwYXVzZWQuIElmIG5vIG5hbWUgaXNcbiAgICAgKiBzcGVjaWZpZWQgYWxsIHNsb3RzIHdpbGwgYmUgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgc2xvdCB0byBzdG9wLiBMZWF2ZSB1bmRlZmluZWQgdG8gc3RvcCBldmVyeXRoaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gc3RvcCBhbGwgc291bmRzXG4gICAgICogdGhpcy5lbnRpdHkuc291bmQuc3RvcCgpO1xuICAgICAqIC8vIHN0b3AgYSBzcGVjaWZpYyBzb3VuZFxuICAgICAqIHRoaXMuZW50aXR5LnNvdW5kLnN0b3AoJ2JlZXAnKTtcbiAgICAgKi9cbiAgICBzdG9wKG5hbWUpIHtcbiAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLl9zbG90cztcblxuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHNsb3RzW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFzbG90KSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybihgVHJ5aW5nIHRvIHN0b3Agc291bmQgc2xvdCB3aXRoIG5hbWUgJHtuYW1lfSB3aGljaCBkb2VzIG5vdCBleGlzdGApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2xvdC5zdG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBzbG90cykge1xuICAgICAgICAgICAgICAgIHNsb3RzW2tleV0uc3RvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBTb3VuZENvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIlNvdW5kQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdm9sdW1lIiwiX3BpdGNoIiwiX3Bvc2l0aW9uYWwiLCJfcmVmRGlzdGFuY2UiLCJfbWF4RGlzdGFuY2UiLCJfcm9sbE9mZkZhY3RvciIsIl9kaXN0YW5jZU1vZGVsIiwiRElTVEFOQ0VfTElORUFSIiwiX3Nsb3RzIiwiX3BsYXlpbmdCZWZvcmVEaXNhYmxlIiwiX3VwZGF0ZVNvdW5kSW5zdGFuY2VzIiwicHJvcGVydHkiLCJ2YWx1ZSIsImlzRmFjdG9yIiwic2xvdHMiLCJrZXkiLCJzbG90Iiwib3ZlcmxhcCIsImluc3RhbmNlcyIsImkiLCJsZW4iLCJsZW5ndGgiLCJkaXN0YW5jZU1vZGVsIiwibWF4RGlzdGFuY2UiLCJyZWZEaXN0YW5jZSIsInJvbGxPZmZGYWN0b3IiLCJwaXRjaCIsInZvbHVtZSIsInBvc2l0aW9uYWwiLCJuZXdWYWx1ZSIsIm9sZExlbmd0aCIsImlzUGxheWluZyIsImlzU3VzcGVuZGVkIiwiY3VycmVudFRpbWUiLCJzdG9wIiwiaW5zdGFuY2UiLCJfY3JlYXRlSW5zdGFuY2UiLCJwbGF5IiwicHVzaCIsIm9sZFZhbHVlIiwiU291bmRTbG90IiwibmFtZSIsImVuYWJsZWQiLCJvbkVuYWJsZSIsIl9pblRvb2xzIiwicGxheWluZ0JlZm9yZURpc2FibGUiLCJhdXRvUGxheSIsImlzU3RvcHBlZCIsInJlc3VtZSIsImlzTG9hZGVkIiwibG9hZCIsIm9uRGlzYWJsZSIsInBhdXNlIiwib25SZW1vdmUiLCJvZmYiLCJhZGRTbG90Iiwib3B0aW9ucyIsIkRlYnVnIiwid2FybiIsInBhdGgiLCJyZW1vdmVTbG90IiwiX2dldFNsb3RQcm9wZXJ0eSIsInVuZGVmaW5lZCIsImlzUGF1c2VkIl0sIm1hcHBpbmdzIjoiOzs7OztBQVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxjQUFjLFNBQVNDLFNBQVMsQ0FBQztBQUNuQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFO0FBQ3hCLElBQUEsS0FBSyxDQUFDRCxNQUFNLEVBQUVDLE1BQU0sQ0FBQyxDQUFBOztBQUVyQjtJQUNBLElBQUksQ0FBQ0MsT0FBTyxHQUFHLENBQUMsQ0FBQTtBQUNoQjtJQUNBLElBQUksQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUNmO0lBQ0EsSUFBSSxDQUFDQyxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCO0lBQ0EsSUFBSSxDQUFDQyxZQUFZLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCO0lBQ0EsSUFBSSxDQUFDQyxZQUFZLEdBQUcsS0FBSyxDQUFBO0FBQ3pCO0lBQ0EsSUFBSSxDQUFDQyxjQUFjLEdBQUcsQ0FBQyxDQUFBO0FBQ3ZCO0lBQ0EsSUFBSSxDQUFDQyxjQUFjLEdBQUdDLGVBQWUsQ0FBQTs7QUFFckM7QUFDUjtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsTUFB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
