/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../../core/event-handler.js';
import { math } from '../../../core/math/math.js';
import { Asset } from '../../asset/asset.js';
import { SPRITE_RENDERMODE_SIMPLE } from '../../../scene/constants.js';

/**
 * Handles playing of sprite animations and loading of relevant sprite assets.
 *
 * @augments EventHandler
 */
class SpriteAnimationClip extends EventHandler {
  /**
   * Create a new SpriteAnimationClip instance.
   *
   * @param {import('./component.js').SpriteComponent} component - The sprite component managing
   * this clip.
   * @param {object} data - Data for the new animation clip.
   * @param {number} [data.fps] - Frames per second for the animation clip.
   * @param {boolean} [data.loop] - Whether to loop the animation clip.
   * @param {string} [data.name] - The name of the new animation clip.
   * @param {number} [data.spriteAsset] - The id of the sprite asset that this clip will play.
   */
  constructor(component, data) {
    super();
    this._component = component;
    this._frame = 0;
    this._sprite = null;
    this._spriteAsset = null;
    this.spriteAsset = data.spriteAsset;
    this.name = data.name;
    this.fps = data.fps || 0;
    this.loop = data.loop || false;
    this._playing = false;
    this._paused = false;
    this._time = 0;
  }

  /**
   * Fired when the clip starts playing.
   *
   * @event SpriteAnimationClip#play
   */

  /**
   * Fired when the clip is paused.
   *
   * @event SpriteAnimationClip#pause
   */

  /**
   * Fired when the clip is resumed.
   *
   * @event SpriteAnimationClip#resume
   */

  /**
   * Fired when the clip is stopped.
   *
   * @event SpriteAnimationClip#stop
   */

  /**
   * Fired when the clip stops playing because it reached its ending.
   *
   * @event SpriteAnimationClip#end
   */

  /**
   * Fired when the clip reached the end of its current loop.
   *
   * @event SpriteAnimationClip#loop
   */

  /**
   * The total duration of the animation in seconds.
   *
   * @type {number}
   */
  get duration() {
    if (this._sprite) {
      const fps = this.fps || Number.MIN_VALUE;
      return this._sprite.frameKeys.length / Math.abs(fps);
    }
    return 0;
  }

  /**
   * The index of the frame of the {@link Sprite} currently being rendered.
   *
   * @type {number}
   */
  set frame(value) {
    this._setFrame(value);

    // update time to start of frame
    const fps = this.fps || Number.MIN_VALUE;
    this._setTime(this._frame / fps);
  }
  get frame() {
    return this._frame;
  }

  /**
   * Whether the animation is currently paused.
   *
   * @type {boolean}
   */
  get isPaused() {
    return this._paused;
  }

  /**
   * Whether the animation is currently playing.
   *
   * @type {boolean}
   */
  get isPlaying() {
    return this._playing;
  }

  /**
   * The current sprite used to play the animation.
   *
   * @type {import('../../../scene/sprite.js').Sprite}
   */
  set sprite(value) {
    if (this._sprite) {
      this._sprite.off('set:meshes', this._onSpriteMeshesChange, this);
      this._sprite.off('set:pixelsPerUnit', this._onSpritePpuChanged, this);
      this._sprite.off('set:atlas', this._onSpriteMeshesChange, this);
      if (this._sprite.atlas) {
        this._sprite.atlas.off('set:texture', this._onSpriteMeshesChange, this);
      }
    }
    this._sprite = value;
    if (this._sprite) {
      this._sprite.on('set:meshes', this._onSpriteMeshesChange, this);
      this._sprite.on('set:pixelsPerUnit', this._onSpritePpuChanged, this);
      this._sprite.on('set:atlas', this._onSpriteMeshesChange, this);
      if (this._sprite.atlas) {
        this._sprite.atlas.on('set:texture', this._onSpriteMeshesChange, this);
      }
    }
    if (this._component.currentClip === this) {
      let mi;

      // if we are clearing the sprite clear old mesh instance parameters
      if (!value || !value.atlas) {
        mi = this._component._meshInstance;
        if (mi) {
          mi.deleteParameter('texture_emissiveMap');
          mi.deleteParameter('texture_opacityMap');
        }
        this._component._hideModel();
      } else {
        // otherwise show sprite

        // update texture
        if (value.atlas.texture) {
          mi = this._component._meshInstance;
          if (mi) {
            mi.setParameter('texture_emissiveMap', value.atlas.texture);
            mi.setParameter('texture_opacityMap', value.atlas.texture);
          }
          if (this._component.enabled && this._component.entity.enabled) {
            this._component._showModel();
          }
        }

        // if we have a time then force update
        // frame based on the time (check if fps is not 0 otherwise time will be Infinity)

        /* eslint-disable no-self-assign */
        if (this.time && this.fps) {
          this.time = this.time;
        } else {
          // if we don't have a time
          // then force update frame counter
          this.frame = this.frame;
        }
        /* eslint-enable no-self-assign */
      }
    }
  }

  get sprite() {
    return this._sprite;
  }

  /**
   * The id of the sprite asset used to play the animation.
   *
   * @type {number}
   */
  set spriteAsset(value) {
    const assets = this._component.system.app.assets;
    let id = value;
    if (value instanceof Asset) {
      id = value.id;
    }
    if (this._spriteAsset !== id) {
      if (this._spriteAsset) {
        // clean old event listeners
        const prev = assets.get(this._spriteAsset);
        if (prev) {
          this._unbindSpriteAsset(prev);
        }
      }
      this._spriteAsset = id;

      // bind sprite asset
      if (this._spriteAsset) {
        const asset = assets.get(this._spriteAsset);
        if (!asset) {
          this.sprite = null;
          assets.on('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
        } else {
          this._bindSpriteAsset(asset);
        }
      } else {
        this.sprite = null;
      }
    }
  }
  get spriteAsset() {
    return this._spriteAsset;
  }

  /**
   * The current time of the animation in seconds.
   *
   * @type {number}
   */
  set time(value) {
    this._setTime(value);
    if (this._sprite) {
      this.frame = Math.min(this._sprite.frameKeys.length - 1, Math.floor(this._time * Math.abs(this.fps)));
    } else {
      this.frame = 0;
    }
  }
  get time() {
    return this._time;
  }

  // When sprite asset is added bind it
  _onSpriteAssetAdded(asset) {
    this._component.system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
    if (this._spriteAsset === asset.id) {
      this._bindSpriteAsset(asset);
    }
  }

  // Hook up event handlers on sprite asset
  _bindSpriteAsset(asset) {
    asset.on('load', this._onSpriteAssetLoad, this);
    asset.on('remove', this._onSpriteAssetRemove, this);
    if (asset.resource) {
      this._onSpriteAssetLoad(asset);
    } else {
      this._component.system.app.assets.load(asset);
    }
  }
  _unbindSpriteAsset(asset) {
    asset.off('load', this._onSpriteAssetLoad, this);
    asset.off('remove', this._onSpriteAssetRemove, this);

    // unbind atlas
    if (asset.resource && asset.resource.atlas) {
      this._component.system.app.assets.off('load:' + asset.data.textureAtlasAsset, this._onTextureAtlasLoad, this);
    }
  }

  // When sprite asset is loaded make sure the texture atlas asset is loaded too
  // If so then set the sprite, otherwise wait for the atlas to be loaded first
  _onSpriteAssetLoad(asset) {
    if (!asset.resource) {
      this.sprite = null;
    } else {
      if (!asset.resource.atlas) {
        const atlasAssetId = asset.data.textureAtlasAsset;
        const assets = this._component.system.app.assets;
        assets.off('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
        assets.once('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
      } else {
        this.sprite = asset.resource;
      }
    }
  }

  // When atlas is loaded try to reset the sprite asset
  _onTextureAtlasLoad(atlasAsset) {
    const spriteAsset = this._spriteAsset;
    if (spriteAsset instanceof Asset) {
      this._onSpriteAssetLoad(spriteAsset);
    } else {
      this._onSpriteAssetLoad(this._component.system.app.assets.get(spriteAsset));
    }
  }
  _onSpriteAssetRemove(asset) {
    this.sprite = null;
  }

  // If the meshes are re-created make sure
  // we update them in the mesh instance
  _onSpriteMeshesChange() {
    if (this._component.currentClip === this) {
      this._component._showFrame(this.frame);
    }
  }

  // Update frame if ppu changes for 9-sliced sprites
  _onSpritePpuChanged() {
    if (this._component.currentClip === this) {
      if (this.sprite.renderMode !== SPRITE_RENDERMODE_SIMPLE) {
        this._component._showFrame(this.frame);
      }
    }
  }

  /**
   * Advances the animation, looping if necessary.
   *
   * @param {number} dt - The delta time.
   * @private
   */
  _update(dt) {
    if (this.fps === 0) return;
    if (!this._playing || this._paused || !this._sprite) return;
    const dir = this.fps < 0 ? -1 : 1;
    const time = this._time + dt * this._component.speed * dir;
    const duration = this.duration;
    const end = time > duration || time < 0;
    this._setTime(time);
    let frame = this.frame;
    if (this._sprite) {
      frame = Math.floor(this._sprite.frameKeys.length * this._time / duration);
    } else {
      frame = 0;
    }
    if (frame !== this._frame) {
      this._setFrame(frame);
    }
    if (end) {
      if (this.loop) {
        this.fire('loop');
        this._component.fire('loop', this);
      } else {
        this._playing = false;
        this._paused = false;
        this.fire('end');
        this._component.fire('end', this);
      }
    }
  }
  _setTime(value) {
    this._time = value;
    const duration = this.duration;
    if (this._time < 0) {
      if (this.loop) {
        this._time = this._time % duration + duration;
      } else {
        this._time = 0;
      }
    } else if (this._time > duration) {
      if (this.loop) {
        this._time %= duration;
      } else {
        this._time = duration;
      }
    }
  }
  _setFrame(value) {
    if (this._sprite) {
      // clamp frame
      this._frame = math.clamp(value, 0, this._sprite.frameKeys.length - 1);
    } else {
      this._frame = value;
    }
    if (this._component.currentClip === this) {
      this._component._showFrame(this._frame);
    }
  }
  _destroy() {
    // remove sprite
    if (this._sprite) {
      this.sprite = null;
    }

    // remove sprite asset
    if (this._spriteAsset) {
      this.spriteAsset = null;
    }
  }

  /**
   * Plays the animation. If it's already playing then this does nothing.
   */
  play() {
    if (this._playing) return;
    this._playing = true;
    this._paused = false;
    this.frame = 0;
    this.fire('play');
    this._component.fire('play', this);
  }

  /**
   * Pauses the animation.
   */
  pause() {
    if (!this._playing || this._paused) return;
    this._paused = true;
    this.fire('pause');
    this._component.fire('pause', this);
  }

  /**
   * Resumes the paused animation.
   */
  resume() {
    if (!this._paused) return;
    this._paused = false;
    this.fire('resume');
    this._component.fire('resume', this);
  }

  /**
   * Stops the animation and resets the animation to the first frame.
   */
  stop() {
    if (!this._playing) return;
    this._playing = false;
    this._paused = false;
    this._time = 0;
    this.frame = 0;
    this.fire('stop');
    this._component.fire('stop', this);
  }
}

export { SpriteAnimationClip };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ByaXRlLWFuaW1hdGlvbi1jbGlwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL3Nwcml0ZS1hbmltYXRpb24tY2xpcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBIYW5kbGVzIHBsYXlpbmcgb2Ygc3ByaXRlIGFuaW1hdGlvbnMgYW5kIGxvYWRpbmcgb2YgcmVsZXZhbnQgc3ByaXRlIGFzc2V0cy5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFNwcml0ZUFuaW1hdGlvbkNsaXAgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTcHJpdGVBbmltYXRpb25DbGlwIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vY29tcG9uZW50LmpzJykuU3ByaXRlQ29tcG9uZW50fSBjb21wb25lbnQgLSBUaGUgc3ByaXRlIGNvbXBvbmVudCBtYW5hZ2luZ1xuICAgICAqIHRoaXMgY2xpcC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIERhdGEgZm9yIHRoZSBuZXcgYW5pbWF0aW9uIGNsaXAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtkYXRhLmZwc10gLSBGcmFtZXMgcGVyIHNlY29uZCBmb3IgdGhlIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RhdGEubG9vcF0gLSBXaGV0aGVyIHRvIGxvb3AgdGhlIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGF0YS5uYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBuZXcgYW5pbWF0aW9uIGNsaXAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtkYXRhLnNwcml0ZUFzc2V0XSAtIFRoZSBpZCBvZiB0aGUgc3ByaXRlIGFzc2V0IHRoYXQgdGhpcyBjbGlwIHdpbGwgcGxheS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihjb21wb25lbnQsIGRhdGEpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9jb21wb25lbnQgPSBjb21wb25lbnQ7XG5cbiAgICAgICAgdGhpcy5fZnJhbWUgPSAwO1xuICAgICAgICB0aGlzLl9zcHJpdGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBkYXRhLnNwcml0ZUFzc2V0O1xuXG4gICAgICAgIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcbiAgICAgICAgdGhpcy5mcHMgPSBkYXRhLmZwcyB8fCAwO1xuICAgICAgICB0aGlzLmxvb3AgPSBkYXRhLmxvb3AgfHwgZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9wYXVzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl90aW1lID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjbGlwIHN0YXJ0cyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUFuaW1hdGlvbkNsaXAjcGxheVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgY2xpcCBpcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQW5pbWF0aW9uQ2xpcCNwYXVzZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgY2xpcCBpcyByZXN1bWVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUFuaW1hdGlvbkNsaXAjcmVzdW1lXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjbGlwIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQW5pbWF0aW9uQ2xpcCNzdG9wXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjbGlwIHN0b3BzIHBsYXlpbmcgYmVjYXVzZSBpdCByZWFjaGVkIGl0cyBlbmRpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQW5pbWF0aW9uQ2xpcCNlbmRcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGNsaXAgcmVhY2hlZCB0aGUgZW5kIG9mIGl0cyBjdXJyZW50IGxvb3AuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQW5pbWF0aW9uQ2xpcCNsb29wXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBUaGUgdG90YWwgZHVyYXRpb24gb2YgdGhlIGFuaW1hdGlvbiBpbiBzZWNvbmRzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZHVyYXRpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZwcyA9IHRoaXMuZnBzIHx8IE51bWJlci5NSU5fVkFMVUU7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLyBNYXRoLmFicyhmcHMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBpbmRleCBvZiB0aGUgZnJhbWUgb2YgdGhlIHtAbGluayBTcHJpdGV9IGN1cnJlbnRseSBiZWluZyByZW5kZXJlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZyYW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldEZyYW1lKHZhbHVlKTtcblxuICAgICAgICAvLyB1cGRhdGUgdGltZSB0byBzdGFydCBvZiBmcmFtZVxuICAgICAgICBjb25zdCBmcHMgPSB0aGlzLmZwcyB8fCBOdW1iZXIuTUlOX1ZBTFVFO1xuICAgICAgICB0aGlzLl9zZXRUaW1lKHRoaXMuX2ZyYW1lIC8gZnBzKTtcbiAgICB9XG5cbiAgICBnZXQgZnJhbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mcmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBhbmltYXRpb24gaXMgY3VycmVudGx5IHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1BhdXNlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhdXNlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBhbmltYXRpb24gaXMgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxheWluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBzcHJpdGUgdXNlZCB0byBwbGF5IHRoZSBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9zcHJpdGUuanMnKS5TcHJpdGV9XG4gICAgICovXG4gICAgc2V0IHNwcml0ZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9zcHJpdGUub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlLm9mZignc2V0OnBpeGVsc1BlclVuaXQnLCB0aGlzLl9vblNwcml0ZVBwdUNoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlLm9mZignc2V0OmF0bGFzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nwcml0ZS5hdGxhcy5vZmYoJ3NldDp0ZXh0dXJlJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3ByaXRlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlLm9uKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlLm9uKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9zcHJpdGUub24oJ3NldDphdGxhcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nwcml0ZS5hdGxhcy5vbignc2V0OnRleHR1cmUnLCB0aGlzLl9vblNwcml0ZU1lc2hlc0NoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fY29tcG9uZW50LmN1cnJlbnRDbGlwID09PSB0aGlzKSB7XG4gICAgICAgICAgICBsZXQgbWk7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGFyZSBjbGVhcmluZyB0aGUgc3ByaXRlIGNsZWFyIG9sZCBtZXNoIGluc3RhbmNlIHBhcmFtZXRlcnNcbiAgICAgICAgICAgIGlmICghdmFsdWUgfHwgIXZhbHVlLmF0bGFzKSB7XG4gICAgICAgICAgICAgICAgbWkgPSB0aGlzLl9jb21wb25lbnQuX21lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWkuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJyk7XG4gICAgICAgICAgICAgICAgICAgIG1pLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50Ll9oaWRlTW9kZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHNob3cgc3ByaXRlXG5cbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgdGV4dHVyZVxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZS5hdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pID0gdGhpcy5fY29tcG9uZW50Ll9tZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJywgdmFsdWUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcsIHZhbHVlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudC5lbmFibGVkICYmIHRoaXMuX2NvbXBvbmVudC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50Ll9zaG93TW9kZWwoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgYSB0aW1lIHRoZW4gZm9yY2UgdXBkYXRlXG4gICAgICAgICAgICAgICAgLy8gZnJhbWUgYmFzZWQgb24gdGhlIHRpbWUgKGNoZWNrIGlmIGZwcyBpcyBub3QgMCBvdGhlcndpc2UgdGltZSB3aWxsIGJlIEluZmluaXR5KVxuXG4gICAgICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgICAgICBpZiAodGhpcy50aW1lICYmIHRoaXMuZnBzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGltZSA9IHRoaXMudGltZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB3ZSBkb24ndCBoYXZlIGEgdGltZVxuICAgICAgICAgICAgICAgICAgICAvLyB0aGVuIGZvcmNlIHVwZGF0ZSBmcmFtZSBjb3VudGVyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnJhbWUgPSB0aGlzLmZyYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBpZCBvZiB0aGUgc3ByaXRlIGFzc2V0IHVzZWQgdG8gcGxheSB0aGUgYW5pbWF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc3ByaXRlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgaWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCAhPT0gaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIC8vIGNsZWFuIG9sZCBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgICAgICAgICBjb25zdCBwcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKHByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kU3ByaXRlQXNzZXQocHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IGlkO1xuXG4gICAgICAgICAgICAvLyBiaW5kIHNwcml0ZSBhc3NldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX3Nwcml0ZUFzc2V0LCB0aGlzLl9vblNwcml0ZUFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcHJpdGVBc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCB0aW1lIG9mIHRoZSBhbmltYXRpb24gaW4gc2Vjb25kcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHRpbWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2V0VGltZSh2YWx1ZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5mcmFtZSA9IE1hdGgubWluKHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoIC0gMSwgTWF0aC5mbG9vcih0aGlzLl90aW1lICogTWF0aC5hYnModGhpcy5mcHMpKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmZyYW1lID0gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0aW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGltZTtcbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBhZGRlZCBiaW5kIGl0XG4gICAgX29uU3ByaXRlQXNzZXRBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9jb21wb25lbnQuc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vblNwcml0ZUFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQgPT09IGFzc2V0LmlkKSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gSG9vayB1cCBldmVudCBoYW5kbGVycyBvbiBzcHJpdGUgYXNzZXRcbiAgICBfYmluZFNwcml0ZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25TcHJpdGVBc3NldFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wb25lbnQuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kU3ByaXRlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uU3ByaXRlQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIC8vIHVuYmluZCBhdGxhc1xuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UgJiYgYXNzZXQucmVzb3VyY2UuYXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudC5zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2xvYWQ6JyArIGFzc2V0LmRhdGEudGV4dHVyZUF0bGFzQXNzZXQsIHRoaXMuX29uVGV4dHVyZUF0bGFzTG9hZCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBsb2FkZWQgbWFrZSBzdXJlIHRoZSB0ZXh0dXJlIGF0bGFzIGFzc2V0IGlzIGxvYWRlZCB0b29cbiAgICAvLyBJZiBzbyB0aGVuIHNldCB0aGUgc3ByaXRlLCBvdGhlcndpc2Ugd2FpdCBmb3IgdGhlIGF0bGFzIHRvIGJlIGxvYWRlZCBmaXJzdFxuICAgIF9vblNwcml0ZUFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICBpZiAoIWFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIWFzc2V0LnJlc291cmNlLmF0bGFzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXRsYXNBc3NldElkID0gYXNzZXQuZGF0YS50ZXh0dXJlQXRsYXNBc3NldDtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9jb21wb25lbnQuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignbG9hZDonICsgYXRsYXNBc3NldElkLCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vbmNlKCdsb2FkOicgKyBhdGxhc0Fzc2V0SWQsIHRoaXMuX29uVGV4dHVyZUF0bGFzTG9hZCwgdGhpcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIGF0bGFzIGlzIGxvYWRlZCB0cnkgdG8gcmVzZXQgdGhlIHNwcml0ZSBhc3NldFxuICAgIF9vblRleHR1cmVBdGxhc0xvYWQoYXRsYXNBc3NldCkge1xuICAgICAgICBjb25zdCBzcHJpdGVBc3NldCA9IHRoaXMuX3Nwcml0ZUFzc2V0O1xuICAgICAgICBpZiAoc3ByaXRlQXNzZXQgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoc3ByaXRlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQodGhpcy5fY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzLmdldChzcHJpdGVBc3NldCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU3ByaXRlQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBtZXNoZXMgYXJlIHJlLWNyZWF0ZWQgbWFrZSBzdXJlXG4gICAgLy8gd2UgdXBkYXRlIHRoZW0gaW4gdGhlIG1lc2ggaW5zdGFuY2VcbiAgICBfb25TcHJpdGVNZXNoZXNDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb21wb25lbnQuY3VycmVudENsaXAgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudC5fc2hvd0ZyYW1lKHRoaXMuZnJhbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGZyYW1lIGlmIHBwdSBjaGFuZ2VzIGZvciA5LXNsaWNlZCBzcHJpdGVzXG4gICAgX29uU3ByaXRlUHB1Q2hhbmdlZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudC5jdXJyZW50Q2xpcCA9PT0gdGhpcykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgIT09IFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudC5fc2hvd0ZyYW1lKHRoaXMuZnJhbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWR2YW5jZXMgdGhlIGFuaW1hdGlvbiwgbG9vcGluZyBpZiBuZWNlc3NhcnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgZGVsdGEgdGltZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGUoZHQpIHtcbiAgICAgICAgaWYgKHRoaXMuZnBzID09PSAwKSByZXR1cm47XG4gICAgICAgIGlmICghdGhpcy5fcGxheWluZyB8fCB0aGlzLl9wYXVzZWQgfHwgIXRoaXMuX3Nwcml0ZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGRpciA9IHRoaXMuZnBzIDwgMCA/IC0xIDogMTtcbiAgICAgICAgY29uc3QgdGltZSA9IHRoaXMuX3RpbWUgKyBkdCAqIHRoaXMuX2NvbXBvbmVudC5zcGVlZCAqIGRpcjtcbiAgICAgICAgY29uc3QgZHVyYXRpb24gPSB0aGlzLmR1cmF0aW9uO1xuICAgICAgICBjb25zdCBlbmQgPSAodGltZSA+IGR1cmF0aW9uIHx8IHRpbWUgPCAwKTtcblxuICAgICAgICB0aGlzLl9zZXRUaW1lKHRpbWUpO1xuXG4gICAgICAgIGxldCBmcmFtZSA9IHRoaXMuZnJhbWU7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIGZyYW1lID0gTWF0aC5mbG9vcih0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAqIHRoaXMuX3RpbWUgLyBkdXJhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmFtZSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnJhbWUgIT09IHRoaXMuX2ZyYW1lKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRGcmFtZShmcmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW5kKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdsb29wJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ2xvb3AnLCB0aGlzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhdXNlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZW5kJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ2VuZCcsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldFRpbWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdGltZSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBkdXJhdGlvbiA9IHRoaXMuZHVyYXRpb247XG4gICAgICAgIGlmICh0aGlzLl90aW1lIDwgMCkge1xuICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RpbWUgPSB0aGlzLl90aW1lICUgZHVyYXRpb24gKyBkdXJhdGlvbjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdGltZSA+IGR1cmF0aW9uKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZSAlPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZSA9IGR1cmF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldEZyYW1lKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIC8vIGNsYW1wIGZyYW1lXG4gICAgICAgICAgICB0aGlzLl9mcmFtZSA9IG1hdGguY2xhbXAodmFsdWUsIDAsIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoIC0gMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9mcmFtZSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudC5jdXJyZW50Q2xpcCA9PT0gdGhpcykge1xuICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50Ll9zaG93RnJhbWUodGhpcy5fZnJhbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Rlc3Ryb3koKSB7XG4gICAgICAgIC8vIHJlbW92ZSBzcHJpdGVcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIHNwcml0ZSBhc3NldFxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGxheXMgdGhlIGFuaW1hdGlvbi4gSWYgaXQncyBhbHJlYWR5IHBsYXlpbmcgdGhlbiB0aGlzIGRvZXMgbm90aGluZy5cbiAgICAgKi9cbiAgICBwbGF5KCkge1xuICAgICAgICBpZiAodGhpcy5fcGxheWluZylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9wbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fcGF1c2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuXG4gICAgICAgIHRoaXMuZmlyZSgncGxheScpO1xuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgncGxheScsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyB0aGUgYW5pbWF0aW9uLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3BsYXlpbmcgfHwgdGhpcy5fcGF1c2VkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3BhdXNlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5maXJlKCdwYXVzZScpO1xuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgncGF1c2UnLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIHRoZSBwYXVzZWQgYW5pbWF0aW9uLlxuICAgICAqL1xuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXVzZWQpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9wYXVzZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5maXJlKCdyZXN1bWUnKTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3Jlc3VtZScsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3BzIHRoZSBhbmltYXRpb24gYW5kIHJlc2V0cyB0aGUgYW5pbWF0aW9uIHRvIHRoZSBmaXJzdCBmcmFtZS5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3BsYXlpbmcpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3BhdXNlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90aW1lID0gMDtcbiAgICAgICAgdGhpcy5mcmFtZSA9IDA7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzdG9wJyk7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdzdG9wJywgdGhpcyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTcHJpdGVBbmltYXRpb25DbGlwIH07XG4iXSwibmFtZXMiOlsiU3ByaXRlQW5pbWF0aW9uQ2xpcCIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiY29tcG9uZW50IiwiZGF0YSIsIl9jb21wb25lbnQiLCJfZnJhbWUiLCJfc3ByaXRlIiwiX3Nwcml0ZUFzc2V0Iiwic3ByaXRlQXNzZXQiLCJuYW1lIiwiZnBzIiwibG9vcCIsIl9wbGF5aW5nIiwiX3BhdXNlZCIsIl90aW1lIiwiZHVyYXRpb24iLCJOdW1iZXIiLCJNSU5fVkFMVUUiLCJmcmFtZUtleXMiLCJsZW5ndGgiLCJNYXRoIiwiYWJzIiwiZnJhbWUiLCJ2YWx1ZSIsIl9zZXRGcmFtZSIsIl9zZXRUaW1lIiwiaXNQYXVzZWQiLCJpc1BsYXlpbmciLCJzcHJpdGUiLCJvZmYiLCJfb25TcHJpdGVNZXNoZXNDaGFuZ2UiLCJfb25TcHJpdGVQcHVDaGFuZ2VkIiwiYXRsYXMiLCJvbiIsImN1cnJlbnRDbGlwIiwibWkiLCJfbWVzaEluc3RhbmNlIiwiZGVsZXRlUGFyYW1ldGVyIiwiX2hpZGVNb2RlbCIsInRleHR1cmUiLCJzZXRQYXJhbWV0ZXIiLCJlbmFibGVkIiwiZW50aXR5IiwiX3Nob3dNb2RlbCIsInRpbWUiLCJhc3NldHMiLCJzeXN0ZW0iLCJhcHAiLCJpZCIsIkFzc2V0IiwicHJldiIsImdldCIsIl91bmJpbmRTcHJpdGVBc3NldCIsImFzc2V0IiwiX29uU3ByaXRlQXNzZXRBZGRlZCIsIl9iaW5kU3ByaXRlQXNzZXQiLCJtaW4iLCJmbG9vciIsIl9vblNwcml0ZUFzc2V0TG9hZCIsIl9vblNwcml0ZUFzc2V0UmVtb3ZlIiwicmVzb3VyY2UiLCJsb2FkIiwidGV4dHVyZUF0bGFzQXNzZXQiLCJfb25UZXh0dXJlQXRsYXNMb2FkIiwiYXRsYXNBc3NldElkIiwib25jZSIsImF0bGFzQXNzZXQiLCJfc2hvd0ZyYW1lIiwicmVuZGVyTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSIsIl91cGRhdGUiLCJkdCIsImRpciIsInNwZWVkIiwiZW5kIiwiZmlyZSIsIm1hdGgiLCJjbGFtcCIsIl9kZXN0cm95IiwicGxheSIsInBhdXNlIiwicmVzdW1lIiwic3RvcCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxtQkFBbUIsU0FBU0MsWUFBWSxDQUFDO0FBQzNDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxDQUFDQyxTQUFTLEVBQUVDLElBQUksRUFBRTtBQUN6QixJQUFBLEtBQUssRUFBRSxDQUFBO0lBRVAsSUFBSSxDQUFDQyxVQUFVLEdBQUdGLFNBQVMsQ0FBQTtJQUUzQixJQUFJLENBQUNHLE1BQU0sR0FBRyxDQUFDLENBQUE7SUFDZixJQUFJLENBQUNDLE9BQU8sR0FBRyxJQUFJLENBQUE7SUFDbkIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBQ3hCLElBQUEsSUFBSSxDQUFDQyxXQUFX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
