import { path } from '../../core/path.js';
import { string } from '../../core/string.js';
import { http } from '../../platform/net/http.js';
import { Font } from '../font/font.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

function upgradeDataSchema(data) {
  // convert v1 and v2 to v3 font data schema
  if (data.version < 3) {
    if (data.version < 2) {
      data.info.maps = data.info.maps || [{
        width: data.info.width,
        height: data.info.height
      }];
    }
    data.chars = Object.keys(data.chars || {}).reduce(function (newChars, key) {
      const existing = data.chars[key];
      // key by letter instead of char code
      const newKey = existing.letter !== undefined ? existing.letter : string.fromCodePoint(key);
      if (data.version < 2) {
        existing.map = existing.map || 0;
      }
      newChars[newKey] = existing;
      return newChars;
    }, {});
    data.version = 3;
  }
  return data;
}

/**
 * Resource handler used for loading {@link Font} resources.
 *
 * @implements {ResourceHandler}
 */
class FontHandler {
  /**
   * Type of the resource the handler handles.
   *
   * @type {string}
   */

  /**
   * Create a new FontHandler instance.
   *
   * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
  constructor(app) {
    this.handlerType = "font";
    this._loader = app.loader;
    this.maxRetries = 0;
  }
  load(url, callback, asset) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    const self = this;
    if (path.getExtension(url.original) === '.json') {
      // load json data then load texture of same name
      http.get(url.load, {
        retry: this.maxRetries > 0,
        maxRetries: this.maxRetries
      }, function (err, response) {
        // update asset data
        if (!err) {
          const data = upgradeDataSchema(response);
          self._loadTextures(url.load.replace('.json', '.png'), data, function (err, textures) {
            if (err) return callback(err);
            callback(null, {
              data: data,
              textures: textures
            });
          });
        } else {
          callback(`Error loading font resource: ${url.original} [${err}]`);
        }
      });
    } else {
      // upgrade asset data
      if (asset && asset.data) {
        asset.data = upgradeDataSchema(asset.data);
      }
      this._loadTextures(url.load, asset && asset.data, callback);
    }
  }
  _loadTextures(url, data, callback) {
    const numTextures = data.info.maps.length;
    let numLoaded = 0;
    let error = null;
    const textures = new Array(numTextures);
    const loader = this._loader;
    const loadTexture = function loadTexture(index) {
      const onLoaded = function onLoaded(err, texture) {
        if (error) return;
        if (err) {
          error = err;
          return callback(err);
        }
        texture.upload();
        textures[index] = texture;
        numLoaded++;
        if (numLoaded === numTextures) {
          callback(null, textures);
        }
      };
      if (index === 0) {
        loader.load(url, 'texture', onLoaded);
      } else {
        loader.load(url.replace('.png', index + '.png'), 'texture', onLoaded);
      }
    };
    for (let i = 0; i < numTextures; i++) loadTexture(i);
  }
  open(url, data, asset) {
    let font;
    if (data.textures) {
      // both data and textures exist
      font = new Font(data.textures, data.data);
    } else {
      // only textures
      font = new Font(data, null);
    }
    return font;
  }
  patch(asset, assets) {
    // if not already set, get font data block from asset
    // and assign to font resource
    const font = asset.resource;
    if (!font.data && asset.data) {
      // font data present in asset but not in font
      font.data = asset.data;
    } else if (!asset.data && font.data) {
      // font data present in font but not in asset
      asset.data = font.data;
    }
    if (asset.data) {
      asset.data = upgradeDataSchema(asset.data);
    }
  }
}

export { FontHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9udC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9oYW5kbGVycy9mb250LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgc3RyaW5nIH0gZnJvbSAnLi4vLi4vY29yZS9zdHJpbmcuanMnO1xuXG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQgeyBGb250IH0gZnJvbSAnLi4vZm9udC9mb250LmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vaGFuZGxlci5qcycpLlJlc291cmNlSGFuZGxlcn0gUmVzb3VyY2VIYW5kbGVyICovXG5cbmZ1bmN0aW9uIHVwZ3JhZGVEYXRhU2NoZW1hKGRhdGEpIHtcbiAgICAvLyBjb252ZXJ0IHYxIGFuZCB2MiB0byB2MyBmb250IGRhdGEgc2NoZW1hXG4gICAgaWYgKGRhdGEudmVyc2lvbiA8IDMpIHtcbiAgICAgICAgaWYgKGRhdGEudmVyc2lvbiA8IDIpIHtcbiAgICAgICAgICAgIGRhdGEuaW5mby5tYXBzID0gZGF0YS5pbmZvLm1hcHMgfHwgW3tcbiAgICAgICAgICAgICAgICB3aWR0aDogZGF0YS5pbmZvLndpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogZGF0YS5pbmZvLmhlaWdodFxuICAgICAgICAgICAgfV07XG4gICAgICAgIH1cbiAgICAgICAgZGF0YS5jaGFycyA9IE9iamVjdC5rZXlzKGRhdGEuY2hhcnMgfHwge30pLnJlZHVjZShmdW5jdGlvbiAobmV3Q2hhcnMsIGtleSkge1xuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBkYXRhLmNoYXJzW2tleV07XG4gICAgICAgICAgICAvLyBrZXkgYnkgbGV0dGVyIGluc3RlYWQgb2YgY2hhciBjb2RlXG4gICAgICAgICAgICBjb25zdCBuZXdLZXkgPSBleGlzdGluZy5sZXR0ZXIgIT09IHVuZGVmaW5lZCA/IGV4aXN0aW5nLmxldHRlciA6IHN0cmluZy5mcm9tQ29kZVBvaW50KGtleSk7XG4gICAgICAgICAgICBpZiAoZGF0YS52ZXJzaW9uIDwgMikge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nLm1hcCA9IGV4aXN0aW5nLm1hcCB8fCAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV3Q2hhcnNbbmV3S2V5XSA9IGV4aXN0aW5nO1xuICAgICAgICAgICAgcmV0dXJuIG5ld0NoYXJzO1xuICAgICAgICB9LCB7fSk7XG4gICAgICAgIGRhdGEudmVyc2lvbiA9IDM7XG4gICAgfVxuICAgIHJldHVybiBkYXRhO1xufVxuXG4vKipcbiAqIFJlc291cmNlIGhhbmRsZXIgdXNlZCBmb3IgbG9hZGluZyB7QGxpbmsgRm9udH0gcmVzb3VyY2VzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtSZXNvdXJjZUhhbmRsZXJ9XG4gKi9cbmNsYXNzIEZvbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHRoZSByZXNvdXJjZSB0aGUgaGFuZGxlciBoYW5kbGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBoYW5kbGVyVHlwZSA9IFwiZm9udFwiO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEZvbnRIYW5kbGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIHJ1bm5pbmcge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fbG9hZGVyID0gYXBwLmxvYWRlcjtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gMDtcbiAgICB9XG5cbiAgICBsb2FkKHVybCwgY2FsbGJhY2ssIGFzc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2YgdXJsID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdXJsID0ge1xuICAgICAgICAgICAgICAgIGxvYWQ6IHVybCxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbDogdXJsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIGlmIChwYXRoLmdldEV4dGVuc2lvbih1cmwub3JpZ2luYWwpID09PSAnLmpzb24nKSB7XG4gICAgICAgICAgICAvLyBsb2FkIGpzb24gZGF0YSB0aGVuIGxvYWQgdGV4dHVyZSBvZiBzYW1lIG5hbWVcbiAgICAgICAgICAgIGh0dHAuZ2V0KHVybC5sb2FkLCB7XG4gICAgICAgICAgICAgICAgcmV0cnk6IHRoaXMubWF4UmV0cmllcyA+IDAsXG4gICAgICAgICAgICAgICAgbWF4UmV0cmllczogdGhpcy5tYXhSZXRyaWVzXG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBhc3NldCBkYXRhXG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHVwZ3JhZGVEYXRhU2NoZW1hKHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fbG9hZFRleHR1cmVzKHVybC5sb2FkLnJlcGxhY2UoJy5qc29uJywgJy5wbmcnKSwgZGF0YSwgZnVuY3Rpb24gKGVyciwgdGV4dHVyZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlczogdGV4dHVyZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhgRXJyb3IgbG9hZGluZyBmb250IHJlc291cmNlOiAke3VybC5vcmlnaW5hbH0gWyR7ZXJyfV1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdXBncmFkZSBhc3NldCBkYXRhXG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQuZGF0YSkge1xuICAgICAgICAgICAgICAgIGFzc2V0LmRhdGEgPSB1cGdyYWRlRGF0YVNjaGVtYShhc3NldC5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2xvYWRUZXh0dXJlcyh1cmwubG9hZCwgYXNzZXQgJiYgYXNzZXQuZGF0YSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2xvYWRUZXh0dXJlcyh1cmwsIGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IG51bVRleHR1cmVzID0gZGF0YS5pbmZvLm1hcHMubGVuZ3RoO1xuICAgICAgICBsZXQgbnVtTG9hZGVkID0gMDtcbiAgICAgICAgbGV0IGVycm9yID0gbnVsbDtcblxuICAgICAgICBjb25zdCB0ZXh0dXJlcyA9IG5ldyBBcnJheShudW1UZXh0dXJlcyk7XG4gICAgICAgIGNvbnN0IGxvYWRlciA9IHRoaXMuX2xvYWRlcjtcblxuICAgICAgICBjb25zdCBsb2FkVGV4dHVyZSA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICAgICAgY29uc3Qgb25Mb2FkZWQgPSBmdW5jdGlvbiAoZXJyLCB0ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yKSByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0ZXh0dXJlLnVwbG9hZCgpO1xuICAgICAgICAgICAgICAgIHRleHR1cmVzW2luZGV4XSA9IHRleHR1cmU7XG4gICAgICAgICAgICAgICAgbnVtTG9hZGVkKys7XG4gICAgICAgICAgICAgICAgaWYgKG51bUxvYWRlZCA9PT0gbnVtVGV4dHVyZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdGV4dHVyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxvYWRlci5sb2FkKHVybCwgJ3RleHR1cmUnLCBvbkxvYWRlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvYWRlci5sb2FkKHVybC5yZXBsYWNlKCcucG5nJywgaW5kZXggKyAnLnBuZycpLCAndGV4dHVyZScsIG9uTG9hZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVRleHR1cmVzOyBpKyspXG4gICAgICAgICAgICBsb2FkVGV4dHVyZShpKTtcbiAgICB9XG5cbiAgICBvcGVuKHVybCwgZGF0YSwgYXNzZXQpIHtcbiAgICAgICAgbGV0IGZvbnQ7XG4gICAgICAgIGlmIChkYXRhLnRleHR1cmVzKSB7XG4gICAgICAgICAgICAvLyBib3RoIGRhdGEgYW5kIHRleHR1cmVzIGV4aXN0XG4gICAgICAgICAgICBmb250ID0gbmV3IEZvbnQoZGF0YS50ZXh0dXJlcywgZGF0YS5kYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG9ubHkgdGV4dHVyZXNcbiAgICAgICAgICAgIGZvbnQgPSBuZXcgRm9udChkYXRhLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZm9udDtcbiAgICB9XG5cbiAgICBwYXRjaChhc3NldCwgYXNzZXRzKSB7XG4gICAgICAgIC8vIGlmIG5vdCBhbHJlYWR5IHNldCwgZ2V0IGZvbnQgZGF0YSBibG9jayBmcm9tIGFzc2V0XG4gICAgICAgIC8vIGFuZCBhc3NpZ24gdG8gZm9udCByZXNvdXJjZVxuICAgICAgICBjb25zdCBmb250ID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgIGlmICghZm9udC5kYXRhICYmIGFzc2V0LmRhdGEpIHtcbiAgICAgICAgICAgIC8vIGZvbnQgZGF0YSBwcmVzZW50IGluIGFzc2V0IGJ1dCBub3QgaW4gZm9udFxuICAgICAgICAgICAgZm9udC5kYXRhID0gYXNzZXQuZGF0YTtcbiAgICAgICAgfSBlbHNlIGlmICghYXNzZXQuZGF0YSAmJiBmb250LmRhdGEpIHtcbiAgICAgICAgICAgIC8vIGZvbnQgZGF0YSBwcmVzZW50IGluIGZvbnQgYnV0IG5vdCBpbiBhc3NldFxuICAgICAgICAgICAgYXNzZXQuZGF0YSA9IGZvbnQuZGF0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhc3NldC5kYXRhKSB7XG4gICAgICAgICAgICBhc3NldC5kYXRhID0gdXBncmFkZURhdGFTY2hlbWEoYXNzZXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IEZvbnRIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsidXBncmFkZURhdGFTY2hlbWEiLCJkYXRhIiwidmVyc2lvbiIsImluZm8iLCJtYXBzIiwid2lkdGgiLCJoZWlnaHQiLCJjaGFycyIsIk9iamVjdCIsImtleXMiLCJyZWR1Y2UiLCJuZXdDaGFycyIsImtleSIsImV4aXN0aW5nIiwibmV3S2V5IiwibGV0dGVyIiwidW5kZWZpbmVkIiwic3RyaW5nIiwiZnJvbUNvZGVQb2ludCIsIm1hcCIsIkZvbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJoYW5kbGVyVHlwZSIsIl9sb2FkZXIiLCJsb2FkZXIiLCJtYXhSZXRyaWVzIiwibG9hZCIsInVybCIsImNhbGxiYWNrIiwiYXNzZXQiLCJvcmlnaW5hbCIsInNlbGYiLCJwYXRoIiwiZ2V0RXh0ZW5zaW9uIiwiaHR0cCIsImdldCIsInJldHJ5IiwiZXJyIiwicmVzcG9uc2UiLCJfbG9hZFRleHR1cmVzIiwicmVwbGFjZSIsInRleHR1cmVzIiwibnVtVGV4dHVyZXMiLCJsZW5ndGgiLCJudW1Mb2FkZWQiLCJlcnJvciIsIkFycmF5IiwibG9hZFRleHR1cmUiLCJpbmRleCIsIm9uTG9hZGVkIiwidGV4dHVyZSIsInVwbG9hZCIsImkiLCJvcGVuIiwiZm9udCIsIkZvbnQiLCJwYXRjaCIsImFzc2V0cyIsInJlc291cmNlIl0sIm1hcHBpbmdzIjoiOzs7OztBQU9BOztBQUVBLFNBQVNBLGlCQUFpQkEsQ0FBQ0MsSUFBSSxFQUFFO0FBQzdCO0FBQ0EsRUFBQSxJQUFJQSxJQUFJLENBQUNDLE9BQU8sR0FBRyxDQUFDLEVBQUU7QUFDbEIsSUFBQSxJQUFJRCxJQUFJLENBQUNDLE9BQU8sR0FBRyxDQUFDLEVBQUU7TUFDbEJELElBQUksQ0FBQ0UsSUFBSSxDQUFDQyxJQUFJLEdBQUdILElBQUksQ0FBQ0UsSUFBSSxDQUFDQyxJQUFJLElBQUksQ0FBQztBQUNoQ0MsUUFBQUEsS0FBSyxFQUFFSixJQUFJLENBQUNFLElBQUksQ0FBQ0UsS0FBSztBQUN0QkMsUUFBQUEsTUFBTSxFQUFFTCxJQUFJLENBQUNFLElBQUksQ0FBQ0csTUFBQUE7QUFDdEIsT0FBQyxDQUFDLENBQUE7QUFDTixLQUFBO0lBQ0FMLElBQUksQ0FBQ00sS0FBSyxHQUFHQyxNQUFNLENBQUNDLElBQUksQ0FBQ1IsSUFBSSxDQUFDTSxLQUFLLElBQUksRUFBRSxDQUFDLENBQUNHLE1BQU0sQ0FBQyxVQUFVQyxRQUFRLEVBQUVDLEdBQUcsRUFBRTtBQUN2RSxNQUFBLE1BQU1DLFFBQVEsR0FBR1osSUFBSSxDQUFDTSxLQUFLLENBQUNLLEdBQUcsQ0FBQyxDQUFBO0FBQ2hDO0FBQ0EsTUFBQSxNQUFNRSxNQUFNLEdB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
