/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../core/path.js';
import { http } from '../net/http.js';
import { Sprite } from '../scene/sprite.js';

function onTextureAtlasLoaded(atlasAsset) {
  const spriteAsset = this;

  if (spriteAsset.resource) {
    spriteAsset.resource.atlas = atlasAsset.resource;
  }
}

function onTextureAtlasAdded(atlasAsset) {
  const spriteAsset = this;
  spriteAsset.registry.load(atlasAsset);
}

class SpriteHandler {
  constructor(app) {
    this.handlerType = "sprite";
    this._assets = app.assets;
    this._device = app.graphicsDevice;
    this.maxRetries = 0;
  }

  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }

    if (path.getExtension(url.original) === '.json') {
      http.get(url.load, {
        retry: this.maxRetries > 0,
        maxRetries: this.maxRetries
      }, function (err, response) {
        if (!err) {
          callback(null, response);
        } else {
          callback(err);
        }
      });
    }
  }

  open(url, data) {
    const sprite = new Sprite(this._device);

    if (url) {
      sprite.__data = data;
    }

    return sprite;
  }

  patch(asset, assets) {
    const sprite = asset.resource;

    if (sprite.__data) {
      asset.data.pixelsPerUnit = sprite.__data.pixelsPerUnit;
      asset.data.renderMode = sprite.__data.renderMode;
      asset.data.frameKeys = sprite.__data.frameKeys;

      if (sprite.__data.textureAtlasAsset) {
        const atlas = assets.getByUrl(sprite.__data.textureAtlasAsset);

        if (atlas) {
          asset.data.textureAtlasAsset = atlas.id;
        } else {
          console.warn('Could not find textureatlas with url: ' + sprite.__data.textureAtlasAsset);
        }
      }
    }

    sprite.startUpdate();
    sprite.renderMode = asset.data.renderMode;
    sprite.pixelsPerUnit = asset.data.pixelsPerUnit;
    sprite.frameKeys = asset.data.frameKeys;

    this._updateAtlas(asset);

    sprite.endUpdate();
    asset.off('change', this._onAssetChange, this);
    asset.on('change', this._onAssetChange, this);
  }

  _updateAtlas(asset) {
    const sprite = asset.resource;

    if (!asset.data.textureAtlasAsset) {
      sprite.atlas = null;
      return;
    }

    this._assets.off('load:' + asset.data.textureAtlasAsset, onTextureAtlasLoaded, asset);

    this._assets.on('load:' + asset.data.textureAtlasAsset, onTextureAtlasLoaded, asset);

    const atlasAsset = this._assets.get(asset.data.textureAtlasAsset);

    if (atlasAsset && atlasAsset.resource) {
      sprite.atlas = atlasAsset.resource;
    } else {
      if (!atlasAsset) {
        this._assets.off('add:' + asset.data.textureAtlasAsset, onTextureAtlasAdded, asset);

        this._assets.on('add:' + asset.data.textureAtlasAsset, onTextureAtlasAdded, asset);
      } else {
        this._assets.load(atlasAsset);
      }
    }
  }

  _onAssetChange(asset, attribute, value, oldValue) {
    if (attribute === 'data') {
      if (value && value.textureAtlasAsset && oldValue && value.textureAtlasAsset !== oldValue.textureAtlasAsset) {
        this._assets.off('load:' + oldValue.textureAtlasAsset, onTextureAtlasLoaded, asset);

        this._assets.off('add:' + oldValue.textureAtlasAsset, onTextureAtlasAdded, asset);
      }
    }
  }

}

export { SpriteHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ByaXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcmVzb3VyY2VzL3Nwcml0ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vY29yZS9wYXRoLmpzJztcblxuaW1wb3J0IHsgaHR0cCB9IGZyb20gJy4uL25ldC9odHRwLmpzJztcblxuaW1wb3J0IHsgU3ByaXRlIH0gZnJvbSAnLi4vc2NlbmUvc3ByaXRlLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IEFwcEJhc2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2hhbmRsZXIuanMnKS5SZXNvdXJjZUhhbmRsZXJ9IFJlc291cmNlSGFuZGxlciAqL1xuXG4vLyBUaGUgc2NvcGUgb2YgdGhpcyBmdW5jdGlvbiBpcyB0aGUgc3ByaXRlIGFzc2V0XG5mdW5jdGlvbiBvblRleHR1cmVBdGxhc0xvYWRlZChhdGxhc0Fzc2V0KSB7XG4gICAgY29uc3Qgc3ByaXRlQXNzZXQgPSB0aGlzO1xuICAgIGlmIChzcHJpdGVBc3NldC5yZXNvdXJjZSkge1xuICAgICAgICBzcHJpdGVBc3NldC5yZXNvdXJjZS5hdGxhcyA9IGF0bGFzQXNzZXQucmVzb3VyY2U7XG4gICAgfVxufVxuXG4vLyBUaGUgc2NvcGUgb2YgdGhpcyBmdW5jdGlvbiBpcyB0aGUgc3ByaXRlIGFzc2V0XG5mdW5jdGlvbiBvblRleHR1cmVBdGxhc0FkZGVkKGF0bGFzQXNzZXQpIHtcbiAgICBjb25zdCBzcHJpdGVBc3NldCA9IHRoaXM7XG4gICAgc3ByaXRlQXNzZXQucmVnaXN0cnkubG9hZChhdGxhc0Fzc2V0KTtcbn1cblxuLyoqXG4gKiBSZXNvdXJjZSBoYW5kbGVyIHVzZWQgZm9yIGxvYWRpbmcge0BsaW5rIFNwcml0ZX0gcmVzb3VyY2VzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtSZXNvdXJjZUhhbmRsZXJ9XG4gKi9cbmNsYXNzIFNwcml0ZUhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIFR5cGUgb2YgdGhlIHJlc291cmNlIHRoZSBoYW5kbGVyIGhhbmRsZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGhhbmRsZXJUeXBlID0gXCJzcHJpdGVcIjtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTcHJpdGVIYW5kbGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICB0aGlzLl9hc3NldHMgPSBhcHAuYXNzZXRzO1xuICAgICAgICB0aGlzLl9kZXZpY2UgPSBhcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIHRoaXMubWF4UmV0cmllcyA9IDA7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdXJsID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdXJsID0ge1xuICAgICAgICAgICAgICAgIGxvYWQ6IHVybCxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbDogdXJsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgZ2l2ZW4gYSBqc29uIGZpbGUgKHByb2JhYmx5IGVuZ2luZS1vbmx5IHVzZSBjYXNlKVxuICAgICAgICBpZiAocGF0aC5nZXRFeHRlbnNpb24odXJsLm9yaWdpbmFsKSA9PT0gJy5qc29uJykge1xuICAgICAgICAgICAgaHR0cC5nZXQodXJsLmxvYWQsIHtcbiAgICAgICAgICAgICAgICByZXRyeTogdGhpcy5tYXhSZXRyaWVzID4gMCxcbiAgICAgICAgICAgICAgICBtYXhSZXRyaWVzOiB0aGlzLm1heFJldHJpZXNcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgc3ByaXRlIHJlc291cmNlXG4gICAgb3Blbih1cmwsIGRhdGEpIHtcbiAgICAgICAgY29uc3Qgc3ByaXRlID0gbmV3IFNwcml0ZSh0aGlzLl9kZXZpY2UpO1xuICAgICAgICBpZiAodXJsKSB7XG4gICAgICAgICAgICAvLyBpZiB1cmwgZmllbGQgaXMgcHJlc2VudCBqc29uIGRhdGEgaXMgYmVpbmcgbG9hZGVkIGZyb20gZmlsZVxuICAgICAgICAgICAgLy8gc3RvcmUgZGF0YSBvbiBzcHJpdGUgb2JqZWN0IHRlbXBvcmFyaWx5XG4gICAgICAgICAgICBzcHJpdGUuX19kYXRhID0gZGF0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzcHJpdGU7XG4gICAgfVxuXG4gICAgLy8gU2V0IHNwcml0ZSBkYXRhXG4gICAgcGF0Y2goYXNzZXQsIGFzc2V0cykge1xuICAgICAgICBjb25zdCBzcHJpdGUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgaWYgKHNwcml0ZS5fX2RhdGEpIHtcbiAgICAgICAgICAgIC8vIGxvYWRpbmcgZnJvbSBhIGpzb24gZmlsZSB3ZSBoYXZlIGFzc2V0IGRhdGEgc3RvcmUgdGVtcG9yYXJpbHkgb24gdGhlIHNwcml0ZSByZXNvdXJjZVxuICAgICAgICAgICAgLy8gY29weSBpdCBpbnRvIGFzc2V0LmRhdGEgYW5kIGRlbGV0ZVxuXG4gICAgICAgICAgICBhc3NldC5kYXRhLnBpeGVsc1BlclVuaXQgPSBzcHJpdGUuX19kYXRhLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBhc3NldC5kYXRhLnJlbmRlck1vZGUgPSBzcHJpdGUuX19kYXRhLnJlbmRlck1vZGU7XG4gICAgICAgICAgICBhc3NldC5kYXRhLmZyYW1lS2V5cyA9IHNwcml0ZS5fX2RhdGEuZnJhbWVLZXlzO1xuXG4gICAgICAgICAgICBpZiAoc3ByaXRlLl9fZGF0YS50ZXh0dXJlQXRsYXNBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0bGFzID0gYXNzZXRzLmdldEJ5VXJsKHNwcml0ZS5fX2RhdGEudGV4dHVyZUF0bGFzQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChhdGxhcykge1xuICAgICAgICAgICAgICAgICAgICBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0ID0gYXRsYXMuaWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdDb3VsZCBub3QgZmluZCB0ZXh0dXJlYXRsYXMgd2l0aCB1cmw6ICcgKyBzcHJpdGUuX19kYXRhLnRleHR1cmVBdGxhc0Fzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG5vdGU6IHdlIGRvbid0IHJlbW92ZSBzcHJpdGUuX19kYXRhIGluIGNhc2UgYW5vdGhlciBhc3NldCBpcyBsb2FkZWQgZnJvbSB0aGUgc2FtZSBVUkwgd2hlbiBpdCBpcyBmZXRjaGVkIGZyb20gdGhlIGNhY2hlXG4gICAgICAgICAgICAvLyB0aGUgX19kYXRhIGlzIG5vdCByZS1hc3NpZ25lZCBhbmQgc28gYXNzZXQuZGF0YSBpcyBub3Qgc2V0IHVwLlxuICAgICAgICB9XG5cbiAgICAgICAgc3ByaXRlLnN0YXJ0VXBkYXRlKCk7XG4gICAgICAgIHNwcml0ZS5yZW5kZXJNb2RlID0gYXNzZXQuZGF0YS5yZW5kZXJNb2RlO1xuICAgICAgICBzcHJpdGUucGl4ZWxzUGVyVW5pdCA9IGFzc2V0LmRhdGEucGl4ZWxzUGVyVW5pdDtcbiAgICAgICAgc3ByaXRlLmZyYW1lS2V5cyA9IGFzc2V0LmRhdGEuZnJhbWVLZXlzO1xuICAgICAgICB0aGlzLl91cGRhdGVBdGxhcyhhc3NldCk7XG4gICAgICAgIHNwcml0ZS5lbmRVcGRhdGUoKTtcblxuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Bc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLy8gTG9hZCBhdGxhc1xuICAgIF91cGRhdGVBdGxhcyhhc3NldCkge1xuICAgICAgICBjb25zdCBzcHJpdGUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgaWYgKCFhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0KSB7XG4gICAgICAgICAgICBzcHJpdGUuYXRsYXMgPSBudWxsO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYXNzZXRzLm9mZignbG9hZDonICsgYXNzZXQuZGF0YS50ZXh0dXJlQXRsYXNBc3NldCwgb25UZXh0dXJlQXRsYXNMb2FkZWQsIGFzc2V0KTtcbiAgICAgICAgdGhpcy5fYXNzZXRzLm9uKCdsb2FkOicgKyBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0LCBvblRleHR1cmVBdGxhc0xvYWRlZCwgYXNzZXQpO1xuXG4gICAgICAgIGNvbnN0IGF0bGFzQXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KGFzc2V0LmRhdGEudGV4dHVyZUF0bGFzQXNzZXQpO1xuICAgICAgICBpZiAoYXRsYXNBc3NldCAmJiBhdGxhc0Fzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBzcHJpdGUuYXRsYXMgPSBhdGxhc0Fzc2V0LnJlc291cmNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKCFhdGxhc0Fzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0LCBvblRleHR1cmVBdGxhc0FkZGVkLCBhc3NldCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9uKCdhZGQ6JyArIGFzc2V0LmRhdGEudGV4dHVyZUF0bGFzQXNzZXQsIG9uVGV4dHVyZUF0bGFzQWRkZWQsIGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXNzZXRzLmxvYWQoYXRsYXNBc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25Bc3NldENoYW5nZShhc3NldCwgYXR0cmlidXRlLCB2YWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZSA9PT0gJ2RhdGEnKSB7XG4gICAgICAgICAgICAvLyBpZiB0aGUgdGV4dHVyZSBhdGxhcyBjaGFuZ2VkLCBjbGVhciBldmVudHMgZm9yIG9sZCBhdGxhcyBhc3NldFxuICAgICAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLnRleHR1cmVBdGxhc0Fzc2V0ICYmIG9sZFZhbHVlICYmIHZhbHVlLnRleHR1cmVBdGxhc0Fzc2V0ICE9PSBvbGRWYWx1ZS50ZXh0dXJlQXRsYXNBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5vZmYoJ2xvYWQ6JyArIG9sZFZhbHVlLnRleHR1cmVBdGxhc0Fzc2V0LCBvblRleHR1cmVBdGxhc0xvYWRlZCwgYXNzZXQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5vZmYoJ2FkZDonICsgb2xkVmFsdWUudGV4dHVyZUF0bGFzQXNzZXQsIG9uVGV4dHVyZUF0bGFzQWRkZWQsIGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgU3ByaXRlSGFuZGxlciB9O1xuIl0sIm5hbWVzIjpbIm9uVGV4dHVyZUF0bGFzTG9hZGVkIiwiYXRsYXNBc3NldCIsInNwcml0ZUFzc2V0IiwicmVzb3VyY2UiLCJhdGxhcyIsIm9uVGV4dHVyZUF0bGFzQWRkZWQiLCJyZWdpc3RyeSIsImxvYWQiLCJTcHJpdGVIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJoYW5kbGVyVHlwZSIsIl9hc3NldHMiLCJhc3NldHMiLCJfZGV2aWNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJtYXhSZXRyaWVzIiwidXJsIiwiY2FsbGJhY2siLCJvcmlnaW5hbCIsInBhdGgiLCJnZXRFeHRlbnNpb24iLCJodHRwIiwiZ2V0IiwicmV0cnkiLCJlcnIiLCJyZXNwb25zZSIsIm9wZW4iLCJkYXRhIiwic3ByaXRlIiwiU3ByaXRlIiwiX19kYXRhIiwicGF0Y2giLCJhc3NldCIsInBpeGVsc1BlclVuaXQiLCJyZW5kZXJNb2RlIiwiZnJhbWVLZXlzIiwidGV4dHVyZUF0bGFzQXNzZXQiLCJnZXRCeVVybCIsImlkIiwiY29uc29sZSIsIndhcm4iLCJzdGFydFVwZGF0ZSIsIl91cGRhdGVBdGxhcyIsImVuZFVwZGF0ZSIsIm9mZiIsIl9vbkFzc2V0Q2hhbmdlIiwib24iLCJhdHRyaWJ1dGUiLCJ2YWx1ZSIsIm9sZFZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFVQSxTQUFTQSxvQkFBVCxDQUE4QkMsVUFBOUIsRUFBMEM7RUFDdEMsTUFBTUMsV0FBVyxHQUFHLElBQXBCLENBQUE7O0VBQ0EsSUFBSUEsV0FBVyxDQUFDQyxRQUFoQixFQUEwQjtBQUN0QkQsSUFBQUEsV0FBVyxDQUFDQyxRQUFaLENBQXFCQyxLQUFyQixHQUE2QkgsVUFBVSxDQUFDRSxRQUF4QyxDQUFBO0FBQ0gsR0FBQTtBQUNKLENBQUE7O0FBR0QsU0FBU0UsbUJBQVQsQ0FBNkJKLFVBQTdCLEVBQXlDO0VBQ3JDLE1BQU1DLFdBQVcsR0FBRyxJQUFwQixDQUFBO0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQ0ksUUFBWixDQUFxQkMsSUFBckIsQ0FBMEJOLFVBQTFCLENBQUEsQ0FBQTtBQUNILENBQUE7O0FBT0QsTUFBTU8sYUFBTixDQUFvQjtFQWNoQkMsV0FBVyxDQUFDQyxHQUFELEVBQU07SUFBQSxJ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