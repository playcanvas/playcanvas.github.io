import { path } from '../../core/path.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Http, http } from '../../platform/net/http.js';
import { Animation, Node, Key } from '../../scene/animation/animation.js';
import { AnimEvents } from '../anim/evaluator/anim-events.js';
import { GlbParser } from '../parsers/glb-parser.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Resource handler used for loading {@link Animation} resources.
 *
 * @implements {ResourceHandler}
 */
class AnimationHandler {
  /**
   * Type of the resource the handler handles.
   *
   * @type {string}
   */

  /** @hideconstructor */
  constructor(app) {
    this.handlerType = "animation";
    this.device = app.graphicsDevice;
    this.assets = app.assets;
    this.maxRetries = 0;
  }
  load(url, callback, asset) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }

    // we need to specify JSON for blob URLs
    const options = {
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    };
    if (url.load.startsWith('blob:') || url.load.startsWith('data:')) {
      if (path.getExtension(url.original).toLowerCase() === '.glb') {
        options.responseType = Http.ResponseType.ARRAY_BUFFER;
      } else {
        options.responseType = Http.ResponseType.JSON;
      }
    }
    http.get(url.load, options, (err, response) => {
      if (err) {
        callback(`Error loading animation resource: ${url.original} [${err}]`);
      } else {
        // parse the result immediately (this used to happen during open)
        if (path.getExtension(url.original).toLowerCase() === '.glb') {
          var _asset$options;
          GlbParser.parse('filename.glb', '', response, this.device, this.assets, (_asset$options = asset == null ? void 0 : asset.options) != null ? _asset$options : {}, (err, parseResult) => {
            if (err) {
              callback(err);
            } else {
              var _asset$data;
              const animations = parseResult.animations;
              if (asset != null && (_asset$data = asset.data) != null && _asset$data.events) {
                for (let i = 0; i < animations.length; i++) {
                  animations[i].events = new AnimEvents(Object.values(asset.data.events));
                }
              }
              parseResult.destroy();
              callback(null, animations);
            }
          });
        } else {
          callback(null, this['_parseAnimationV' + response.animation.version](response));
        }
      }
    });
  }
  open(url, data, asset) {
    return data;
  }
  patch(asset, assets) {}
  _parseAnimationV3(data) {
    const animData = data.animation;
    const anim = new Animation();
    anim.name = animData.name;
    anim.duration = animData.duration;
    for (let i = 0; i < animData.nodes.length; i++) {
      const node = new Node();
      const n = animData.nodes[i];
      node._name = n.name;
      for (let j = 0; j < n.keys.length; j++) {
        const k = n.keys[j];
        const t = k.time;
        const p = k.pos;
        const r = k.rot;
        const s = k.scale;
        const pos = new Vec3(p[0], p[1], p[2]);
        const rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
        const scl = new Vec3(s[0], s[1], s[2]);
        const key = new Key(t, pos, rot, scl);
        node._keys.push(key);
      }
      anim.addNode(node);
    }
    return anim;
  }
  _parseAnimationV4(data) {
    const animData = data.animation;
    const anim = new Animation();
    anim.name = animData.name;
    anim.duration = animData.duration;
    for (let i = 0; i < animData.nodes.length; i++) {
      const node = new Node();
      const n = animData.nodes[i];
      node._name = n.name;
      const defPos = n.defaults.p;
      const defRot = n.defaults.r;
      const defScl = n.defaults.s;
      for (let j = 0; j < n.keys.length; j++) {
        const k = n.keys[j];
        const t = k.t;
        const p = defPos ? defPos : k.p;
        const r = defRot ? defRot : k.r;
        const s = defScl ? defScl : k.s;
        const pos = new Vec3(p[0], p[1], p[2]);
        const rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
        const scl = new Vec3(s[0], s[1], s[2]);
        const key = new Key(t, pos, rot, scl);
        node._keys.push(key);
      }
      anim.addNode(node);
    }
    return anim;
  }
}

export { AnimationHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbWF0aW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2FuaW1hdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9wYXRoLmpzJztcblxuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IGh0dHAsIEh0dHAgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7IEFuaW1hdGlvbiwgS2V5LCBOb2RlIH0gZnJvbSAnLi4vLi4vc2NlbmUvYW5pbWF0aW9uL2FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgeyBBbmltRXZlbnRzIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmVudHMuanMnO1xuXG5pbXBvcnQgeyBHbGJQYXJzZXIgfSBmcm9tICcuLi9wYXJzZXJzL2dsYi1wYXJzZXIuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9oYW5kbGVyLmpzJykuUmVzb3VyY2VIYW5kbGVyfSBSZXNvdXJjZUhhbmRsZXIgKi9cblxuLyoqXG4gKiBSZXNvdXJjZSBoYW5kbGVyIHVzZWQgZm9yIGxvYWRpbmcge0BsaW5rIEFuaW1hdGlvbn0gcmVzb3VyY2VzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtSZXNvdXJjZUhhbmRsZXJ9XG4gKi9cbmNsYXNzIEFuaW1hdGlvbkhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIFR5cGUgb2YgdGhlIHJlc291cmNlIHRoZSBoYW5kbGVyIGhhbmRsZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGhhbmRsZXJUeXBlID0gXCJhbmltYXRpb25cIjtcblxuICAgIC8qKiBAaGlkZWNvbnN0cnVjdG9yICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IGFwcC5hc3NldHM7XG4gICAgICAgIHRoaXMubWF4UmV0cmllcyA9IDA7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBpZiAodHlwZW9mIHVybCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHVybCA9IHtcbiAgICAgICAgICAgICAgICBsb2FkOiB1cmwsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWw6IHVybFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gc3BlY2lmeSBKU09OIGZvciBibG9iIFVSTHNcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHJldHJ5OiB0aGlzLm1heFJldHJpZXMgPiAwLFxuICAgICAgICAgICAgbWF4UmV0cmllczogdGhpcy5tYXhSZXRyaWVzXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHVybC5sb2FkLnN0YXJ0c1dpdGgoJ2Jsb2I6JykgfHwgdXJsLmxvYWQuc3RhcnRzV2l0aCgnZGF0YTonKSkge1xuICAgICAgICAgICAgaWYgKHBhdGguZ2V0RXh0ZW5zaW9uKHVybC5vcmlnaW5hbCkudG9Mb3dlckNhc2UoKSA9PT0gJy5nbGInKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5yZXNwb25zZVR5cGUgPSBIdHRwLlJlc3BvbnNlVHlwZS5BUlJBWV9CVUZGRVI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMucmVzcG9uc2VUeXBlID0gSHR0cC5SZXNwb25zZVR5cGUuSlNPTjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGh0dHAuZ2V0KHVybC5sb2FkLCBvcHRpb25zLCAoZXJyLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGBFcnJvciBsb2FkaW5nIGFuaW1hdGlvbiByZXNvdXJjZTogJHt1cmwub3JpZ2luYWx9IFske2Vycn1dYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHBhcnNlIHRoZSByZXN1bHQgaW1tZWRpYXRlbHkgKHRoaXMgdXNlZCB0byBoYXBwZW4gZHVyaW5nIG9wZW4pXG4gICAgICAgICAgICAgICAgaWYgKHBhdGguZ2V0RXh0ZW5zaW9uKHVybC5vcmlnaW5hbCkudG9Mb3dlckNhc2UoKSA9PT0gJy5nbGInKSB7XG4gICAgICAgICAgICAgICAgICAgIEdsYlBhcnNlci5wYXJzZSgnZmlsZW5hbWUuZ2xiJywgJycsIHJlc3BvbnNlLCB0aGlzLmRldmljZSwgdGhpcy5hc3NldHMsIGFzc2V0Py5vcHRpb25zID8/IHt9LCAoZXJyLCBwYXJzZVJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFuaW1hdGlvbnMgPSBwYXJzZVJlc3VsdC5hbmltYXRpb25zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NldD8uZGF0YT8uZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uc1tpXS5ldmVudHMgPSBuZXcgQW5pbUV2ZW50cyhPYmplY3QudmFsdWVzKGFzc2V0LmRhdGEuZXZlbnRzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VSZXN1bHQuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGFuaW1hdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzWydfcGFyc2VBbmltYXRpb25WJyArIHJlc3BvbnNlLmFuaW1hdGlvbi52ZXJzaW9uXShyZXNwb25zZSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgb3Blbih1cmwsIGRhdGEsIGFzc2V0KSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcbiAgICB9XG5cbiAgICBfcGFyc2VBbmltYXRpb25WMyhkYXRhKSB7XG4gICAgICAgIGNvbnN0IGFuaW1EYXRhID0gZGF0YS5hbmltYXRpb247XG5cbiAgICAgICAgY29uc3QgYW5pbSA9IG5ldyBBbmltYXRpb24oKTtcbiAgICAgICAgYW5pbS5uYW1lID0gYW5pbURhdGEubmFtZTtcbiAgICAgICAgYW5pbS5kdXJhdGlvbiA9IGFuaW1EYXRhLmR1cmF0aW9uO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYW5pbURhdGEubm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBuZXcgTm9kZSgpO1xuXG4gICAgICAgICAgICBjb25zdCBuID0gYW5pbURhdGEubm9kZXNbaV07XG4gICAgICAgICAgICBub2RlLl9uYW1lID0gbi5uYW1lO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG4ua2V5cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGsgPSBuLmtleXNbal07XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ID0gay50aW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IHAgPSBrLnBvcztcbiAgICAgICAgICAgICAgICBjb25zdCByID0gay5yb3Q7XG4gICAgICAgICAgICAgICAgY29uc3QgcyA9IGsuc2NhbGU7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9zID0gbmV3IFZlYzMocFswXSwgcFsxXSwgcFsyXSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm90ID0gbmV3IFF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoclswXSwgclsxXSwgclsyXSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NsID0gbmV3IFZlYzMoc1swXSwgc1sxXSwgc1syXSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBuZXcgS2V5KHQsIHBvcywgcm90LCBzY2wpO1xuXG4gICAgICAgICAgICAgICAgbm9kZS5fa2V5cy5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFuaW0uYWRkTm9kZShub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhbmltO1xuICAgIH1cblxuICAgIF9wYXJzZUFuaW1hdGlvblY0KGRhdGEpIHtcbiAgICAgICAgY29uc3QgYW5pbURhdGEgPSBkYXRhLmFuaW1hdGlvbjtcblxuICAgICAgICBjb25zdCBhbmltID0gbmV3IEFuaW1hdGlvbigpO1xuICAgICAgICBhbmltLm5hbWUgPSBhbmltRGF0YS5uYW1lO1xuICAgICAgICBhbmltLmR1cmF0aW9uID0gYW5pbURhdGEuZHVyYXRpb247XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbmltRGF0YS5ub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IG5ldyBOb2RlKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG4gPSBhbmltRGF0YS5ub2Rlc1tpXTtcbiAgICAgICAgICAgIG5vZGUuX25hbWUgPSBuLm5hbWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGRlZlBvcyA9IG4uZGVmYXVsdHMucDtcbiAgICAgICAgICAgIGNvbnN0IGRlZlJvdCA9IG4uZGVmYXVsdHMucjtcbiAgICAgICAgICAgIGNvbnN0IGRlZlNjbCA9IG4uZGVmYXVsdHMucztcblxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBuLmtleXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBrID0gbi5rZXlzW2pdO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdCA9IGsudDtcbiAgICAgICAgICAgICAgICBjb25zdCBwID0gZGVmUG9zID8gZGVmUG9zIDogay5wO1xuICAgICAgICAgICAgICAgIGNvbnN0IHIgPSBkZWZSb3QgPyBkZWZSb3QgOiBrLnI7XG4gICAgICAgICAgICAgICAgY29uc3QgcyA9IGRlZlNjbCA/IGRlZlNjbCA6IGsucztcbiAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBuZXcgVmVjMyhwWzBdLCBwWzFdLCBwWzJdKTtcbiAgICAgICAgICAgICAgICBjb25zdCByb3QgPSBuZXcgUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcyhyWzBdLCByWzFdLCByWzJdKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2wgPSBuZXcgVmVjMyhzWzBdLCBzWzFdLCBzWzJdKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IG5ldyBLZXkodCwgcG9zLCByb3QsIHNjbCk7XG5cbiAgICAgICAgICAgICAgICBub2RlLl9rZXlzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYW5pbS5hZGROb2RlKG5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFuaW07XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltYXRpb25IYW5kbGVyIH07XG4iXSwibmFtZXMiOlsiQW5pbWF0aW9uSGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiaGFuZGxlclR5cGUiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsImFzc2V0cyIsIm1heFJldHJpZXMiLCJsb2FkIiwidXJsIiwiY2FsbGJhY2siLCJhc3NldCIsIm9yaWdpbmFsIiwib3B0aW9ucyIsInJldHJ5Iiwic3RhcnRzV2l0aCIsInBhdGgiLCJnZXRFeHRlbnNpb24iLCJ0b0xvd2VyQ2FzZSIsInJlc3BvbnNlVHlwZSIsIkh0dHAiLCJSZXNwb25zZVR5cGUiLCJBUlJBWV9CVUZGRVIiLCJKU09OIiwiaHR0cCIsImdldCIsImVyciIsInJlc3BvbnNlIiwiX2Fzc2V0JG9wdGlvbnMiLCJHbGJQYXJzZXIiLCJwYXJzZSIsInBhcnNlUmVzdWx0IiwiX2Fzc2V0JGRhdGEiLCJhbmltYXRpb25zIiwiZGF0YSIsImV2ZW50cyIsImkiLCJsZW5ndGgiLCJBbmltRXZlbnRzIiwiT2JqZWN0IiwidmFsdWVzIiwiZGVzdHJveSIsImFuaW1hdGlvbiIsInZlcnNpb24iLCJvcGVuIiwicGF0Y2giLCJfcGFyc2VBbmltYXRpb25WMyIsImFuaW1EYXRhIiwiYW5pbSIsIkFuaW1hdGlvbiIsIm5hbWUiLCJkdXJhdGlvbiIsIm5vZGVzIiwibm9kZSIsIk5vZGUiLCJuIiwiX25hbWUiLCJqIiwia2V5cyIsImsiLCJ0IiwidGltZSIsInAiLCJwb3MiLCJyIiwicm90IiwicyIsInNjYWxlIiwiVmVjMyIsIlF1YXQiLCJzZXRGcm9tRXVsZXJBbmdsZXMiLCJzY2wiLCJrZXkiLCJLZXkiLCJfa2V5cyIsInB1c2giLCJhZGROb2RlIiwiX3BhcnNlQW5pbWF0aW9uVjQiLCJkZWZQb3MiLCJkZWZhdWx0cyIsImRlZlJvdCIsImRlZlNjbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFZQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZ0JBQWdCLENBQUM7QUFDbkI7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtFQUNBQyxXQUFXQSxDQUFDQyxHQUFHLEVBQUU7SUFBQSxJQUhq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
