import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Curve } from '../../core/math/curve.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Asset } from '../asset/asset.js';

const components = ['x', 'y', 'z', 'w'];
const vecLookup = [undefined, undefined, Vec2, Vec3, Vec4];
function rawToValue(app, args, value, old) {
  switch (args.type) {
    case 'boolean':
      return !!value;
    case 'number':
      if (typeof value === 'number') {
        return value;
      } else if (typeof value === 'string') {
        const v = parseInt(value, 10);
        if (isNaN(v)) return null;
        return v;
      } else if (typeof value === 'boolean') {
        return 0 + value;
      }
      return null;
    case 'json':
      {
        const result = {};
        if (Array.isArray(args.schema)) {
          if (!value || typeof value !== 'object') {
            value = {};
          }
          for (let i = 0; i < args.schema.length; i++) {
            const field = args.schema[i];
            if (!field.name) continue;
            if (field.array) {
              result[field.name] = [];
              const arr = Array.isArray(value[field.name]) ? value[field.name] : [];
              for (let j = 0; j < arr.length; j++) {
                result[field.name].push(rawToValue(app, field, arr[j]));
              }
            } else {
              // use the value of the field as it's passed into rawToValue otherwise
              // use the default field value
              const val = value.hasOwnProperty(field.name) ? value[field.name] : field.default;
              result[field.name] = rawToValue(app, field, val);
            }
          }
        }
        return result;
      }
    case 'asset':
      if (value instanceof Asset) {
        return value;
      } else if (typeof value === 'number') {
        return app.assets.get(value) || null;
      } else if (typeof value === 'string') {
        return app.assets.get(parseInt(value, 10)) || null;
      }
      return null;
    case 'entity':
      if (value instanceof GraphNode) {
        return value;
      } else if (typeof value === 'string') {
        return app.getEntityFromIndex(value);
      }
      return null;
    case 'rgb':
    case 'rgba':
      if (value instanceof Color) {
        if (old instanceof Color) {
          old.copy(value);
          return old;
        }
        return value.clone();
      } else if (value instanceof Array && value.length >= 3 && value.length <= 4) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'number') return null;
        }
        if (!old) old = new Color();
        old.r = value[0];
        old.g = value[1];
        old.b = value[2];
        old.a = value.length === 3 ? 1 : value[3];
        return old;
      } else if (typeof value === 'string' && /#([0-9abcdef]{2}){3,4}/i.test(value)) {
        if (!old) old = new Color();
        old.fromString(value);
        return old;
      }
      return null;
    case 'vec2':
    case 'vec3':
    case 'vec4':
      {
        const len = parseInt(args.type.slice(3), 10);
        const vecType = vecLookup[len];
        if (value instanceof vecType) {
          if (old instanceof vecType) {
            old.copy(value);
            return old;
          }
          return value.clone();
        } else if (value instanceof Array && value.length === len) {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'number') return null;
          }
          if (!old) old = new vecType();
          for (let i = 0; i < len; i++) old[components[i]] = value[i];
          return old;
        }
        return null;
      }
    case 'curve':
      if (value) {
        let curve;
        if (value instanceof Curve || value instanceof CurveSet) {
          curve = value.clone();
        } else {
          const CurveType = value.keys[0] instanceof Array ? CurveSet : Curve;
          curve = new CurveType(value.keys);
          curve.type = value.type;
        }
        return curve;
      }
      break;
  }
  return value;
}

/**
 * Container of Script Attribute definitions. Implements an interface to add/remove attributes and
 * store their definition for a {@link ScriptType}. Note: An instance of ScriptAttributes is
 * created automatically by each {@link ScriptType}.
 */
class ScriptAttributes {
  /**
   * Create a new ScriptAttributes instance.
   *
   * @param {Class<import('./script-type.js').ScriptType>} scriptType - Script Type that attributes relate to.
   */
  constructor(scriptType) {
    this.scriptType = scriptType;
    this.index = {};
  }
  /**
   * Add Attribute.
   *
   * @param {string} name - Name of an attribute.
   * @param {object} args - Object with Arguments for an attribute.
   * @param {("boolean"|"number"|"string"|"json"|"asset"|"entity"|"rgb"|"rgba"|"vec2"|"vec3"|"vec4"|"curve")} args.type - Type
   * of an attribute value.  Can be:
   *
   * - "asset"
   * - "boolean"
   * - "curve"
   * - "entity"
   * - "json"
   * - "number"
   * - "rgb"
   * - "rgba"
   * - "string"
   * - "vec2"
   * - "vec3"
   * - "vec4"
   *
   * @param {*} [args.default] - Default attribute value.
   * @param {string} [args.title] - Title for Editor's for field UI.
   * @param {string} [args.description] - Description for Editor's for field UI.
   * @param {string|string[]} [args.placeholder] - Placeholder for Editor's for field UI.
   * For multi-field types, such as vec2, vec3, and others use array of strings.
   * @param {boolean} [args.array] - If attribute can hold single or multiple values.
   * @param {number} [args.size] - If attribute is array, maximum number of values can be set.
   * @param {number} [args.min] - Minimum value for type 'number', if max and min defined, slider
   * will be rendered in Editor's UI.
   * @param {number} [args.max] - Maximum value for type 'number', if max and min defined, slider
   * will be rendered in Editor's UI.
   * @param {number} [args.precision] - Level of precision for field type 'number' with floating
   * values.
   * @param {number} [args.step] - Step value for type 'number'. The amount used to increment the
   * value when using the arrow keys in the Editor's UI.
   * @param {string} [args.assetType] - Name of asset type to be used in 'asset' type attribute
   * picker in Editor's UI, defaults to '*' (all).
   * @param {string[]} [args.curves] - List of names for Curves for field type 'curve'.
   * @param {string} [args.color] - String of color channels for Curves for field type 'curve',
   * can be any combination of `rgba` characters. Defining this property will render Gradient in
   * Editor's field UI.
   * @param {object[]} [args.enum] - List of fixed choices for field, defined as array of objects,
   * where key in object is a title of an option.
   * @param {object[]} [args.schema] - List of attributes for type 'json'. Each attribute
   * description is an object with the same properties as regular script attributes but with an
   * added 'name' field to specify the name of each attribute in the JSON.
   * @example
   * PlayerController.attributes.add('fullName', {
   *     type: 'string'
   * });
   * @example
   * PlayerController.attributes.add('speed', {
   *     type: 'number',
   *     title: 'Speed',
   *     placeholder: 'km/h',
   *     default: 22.2
   * });
   * @example
   * PlayerController.attributes.add('resolution', {
   *     type: 'number',
   *     default: 32,
   *     enum: [
   *         { '32x32': 32 },
   *         { '64x64': 64 },
   *         { '128x128': 128 }
   *     ]
   * });
   * @example
   * PlayerController.attributes.add('config', {
   *     type: 'json',
   *     schema: [{
   *         name: 'speed',
   *         type: 'number',
   *         title: 'Speed',
   *         placeholder: 'km/h',
   *         default: 22.2
   *     }, {
   *         name: 'resolution',
   *         type: 'number',
   *         default: 32,
   *         enum: [
   *             { '32x32': 32 },
   *             { '64x64': 64 },
   *             { '128x128': 128 }
   *         ]
   *     }]
   * });
   */
  add(name, args) {
    if (this.index[name]) {
      Debug.warn(`attribute '${name}' is already defined for script type '${this.scriptType.name}'`);
      return;
    } else if (ScriptAttributes.reservedNames.has(name)) {
      Debug.warn(`attribute '${name}' is a reserved attribute name`);
      return;
    }
    this.index[name] = args;
    Object.defineProperty(this.scriptType.prototype, name, {
      get: function () {
        return this.__attributes[name];
      },
      set: function (raw) {
        const evt = 'attr';
        const evtName = 'attr:' + name;
        const old = this.__attributes[name];
        // keep copy of old for the event below
        let oldCopy = old;
        // json types might have a 'clone' field in their
        // schema so make sure it's not that
        // entities should not be cloned as well
        if (old && args.type !== 'json' && args.type !== 'entity' && old.clone) {
          // check if an event handler is there
          // before cloning for performance
          if (this._callbacks[evt] || this._callbacks[evtName]) {
            oldCopy = old.clone();
          }
        }

        // convert to appropriate type
        if (args.array) {
          this.__attributes[name] = [];
          if (raw) {
            for (let i = 0, len = raw.length; i < len; i++) {
              this.__attributes[name].push(rawToValue(this.app, args, raw[i], old ? old[i] : null));
            }
          }
        } else {
          this.__attributes[name] = rawToValue(this.app, args, raw, old);
        }
        this.fire(evt, name, this.__attributes[name], oldCopy);
        this.fire(evtName, this.__attributes[name], oldCopy);
      }
    });
  }

  /**
   * Remove Attribute.
   *
   * @param {string} name - Name of an attribute.
   * @returns {boolean} True if removed or false if not defined.
   * @example
   * PlayerController.attributes.remove('fullName');
   */
  remove(name) {
    if (!this.index[name]) return false;
    delete this.index[name];
    delete this.scriptType.prototype[name];
    return true;
  }

  /**
   * Detect if Attribute is added.
   *
   * @param {string} name - Name of an attribute.
   * @returns {boolean} True if Attribute is defined.
   * @example
   * if (PlayerController.attributes.has('fullName')) {
   *     // attribute fullName is defined
   * }
   */
  has(name) {
    return !!this.index[name];
  }

  /**
   * Get object with attribute arguments. Note: Changing argument properties will not affect
   * existing Script Instances.
   *
   * @param {string} name - Name of an attribute.
   * @returns {?object} Arguments with attribute properties.
   * @example
   * // changing default value for an attribute 'fullName'
   * var attr = PlayerController.attributes.get('fullName');
   * if (attr) attr.default = 'Unknown';
   */
  get(name) {
    return this.index[name] || null;
  }
}
ScriptAttributes.reservedNames = new Set(['app', 'entity', 'enabled', '_enabled', '_enabledOld', '_destroyed', '__attributes', '__attributesRaw', '__scriptType', '__executionOrder', '_callbacks', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent']);

export { ScriptAttributes };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0LWF0dHJpYnV0ZXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvc2NyaXB0L3NjcmlwdC1hdHRyaWJ1dGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBDdXJ2ZSB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBDdXJ2ZVNldCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS1zZXQuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi9hc3NldC9hc3NldC5qcyc7XG5cbmNvbnN0IGNvbXBvbmVudHMgPSBbJ3gnLCAneScsICd6JywgJ3cnXTtcbmNvbnN0IHZlY0xvb2t1cCA9IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgVmVjMiwgVmVjMywgVmVjNF07XG5cbmZ1bmN0aW9uIHJhd1RvVmFsdWUoYXBwLCBhcmdzLCB2YWx1ZSwgb2xkKSB7XG4gICAgc3dpdGNoIChhcmdzLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICByZXR1cm4gISF2YWx1ZTtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdiA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XG4gICAgICAgICAgICAgICAgaWYgKGlzTmFOKHYpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMCArIHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGNhc2UgJ2pzb24nOiB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSB7fTtcblxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXJncy5zY2hlbWEpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0ge307XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLnNjaGVtYS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWVsZCA9IGFyZ3Muc2NoZW1hW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWZpZWxkLm5hbWUpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZC5hcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2ZpZWxkLm5hbWVdID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFyciA9IEFycmF5LmlzQXJyYXkodmFsdWVbZmllbGQubmFtZV0pID8gdmFsdWVbZmllbGQubmFtZV0gOiBbXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBhcnIubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRbZmllbGQubmFtZV0ucHVzaChyYXdUb1ZhbHVlKGFwcCwgZmllbGQsIGFycltqXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHRoZSB2YWx1ZSBvZiB0aGUgZmllbGQgYXMgaXQncyBwYXNzZWQgaW50byByYXdUb1ZhbHVlIG90aGVyd2lzZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHRoZSBkZWZhdWx0IGZpZWxkIHZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWwgPSB2YWx1ZS5oYXNPd25Qcm9wZXJ0eShmaWVsZC5uYW1lKSA/IHZhbHVlW2ZpZWxkLm5hbWVdIDogZmllbGQuZGVmYXVsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFtmaWVsZC5uYW1lXSA9IHJhd1RvVmFsdWUoYXBwLCBmaWVsZCwgdmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBjYXNlICdhc3NldCc6XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcHAuYXNzZXRzLmdldCh2YWx1ZSkgfHwgbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcHAuYXNzZXRzLmdldChwYXJzZUludCh2YWx1ZSwgMTApKSB8fCBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGNhc2UgJ2VudGl0eSc6XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBHcmFwaE5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXBwLmdldEVudGl0eUZyb21JbmRleCh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgY2FzZSAncmdiJzpcbiAgICAgICAgY2FzZSAncmdiYSc6XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBDb2xvcikge1xuICAgICAgICAgICAgICAgIGlmIChvbGQgaW5zdGFuY2VvZiBDb2xvcikge1xuICAgICAgICAgICAgICAgICAgICBvbGQuY29weSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5jbG9uZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ICYmIHZhbHVlLmxlbmd0aCA+PSAzICYmIHZhbHVlLmxlbmd0aCA8PSA0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlW2ldICE9PSAnbnVtYmVyJylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIW9sZCkgb2xkID0gbmV3IENvbG9yKCk7XG5cbiAgICAgICAgICAgICAgICBvbGQuciA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgICAgIG9sZC5nID0gdmFsdWVbMV07XG4gICAgICAgICAgICAgICAgb2xkLmIgPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgICAgICBvbGQuYSA9ICh2YWx1ZS5sZW5ndGggPT09IDMpID8gMSA6IHZhbHVlWzNdO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9sZDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiAvIyhbMC05YWJjZGVmXXsyfSl7Myw0fS9pLnRlc3QodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFvbGQpXG4gICAgICAgICAgICAgICAgICAgIG9sZCA9IG5ldyBDb2xvcigpO1xuXG4gICAgICAgICAgICAgICAgb2xkLmZyb21TdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBvbGQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgY2FzZSAndmVjMic6XG4gICAgICAgIGNhc2UgJ3ZlYzMnOlxuICAgICAgICBjYXNlICd2ZWM0Jzoge1xuICAgICAgICAgICAgY29uc3QgbGVuID0gcGFyc2VJbnQoYXJncy50eXBlLnNsaWNlKDMpLCAxMCk7XG4gICAgICAgICAgICBjb25zdCB2ZWNUeXBlID0gdmVjTG9va3VwW2xlbl07XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIHZlY1R5cGUpIHtcbiAgICAgICAgICAgICAgICBpZiAob2xkIGluc3RhbmNlb2YgdmVjVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBvbGQuY29weSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5jbG9uZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ICYmIHZhbHVlLmxlbmd0aCA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlW2ldICE9PSAnbnVtYmVyJylcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIW9sZCkgb2xkID0gbmV3IHZlY1R5cGUoKTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgICAgICAgICAgIG9sZFtjb21wb25lbnRzW2ldXSA9IHZhbHVlW2ldO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9sZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgJ2N1cnZlJzpcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGxldCBjdXJ2ZTtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBDdXJ2ZSB8fCB2YWx1ZSBpbnN0YW5jZW9mIEN1cnZlU2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnZlID0gdmFsdWUuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBDdXJ2ZVR5cGUgPSB2YWx1ZS5rZXlzWzBdIGluc3RhbmNlb2YgQXJyYXkgPyBDdXJ2ZVNldCA6IEN1cnZlO1xuICAgICAgICAgICAgICAgICAgICBjdXJ2ZSA9IG5ldyBDdXJ2ZVR5cGUodmFsdWUua2V5cyk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnZlLnR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gY3VydmU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG59XG5cbi8qKlxuICogQ29udGFpbmVyIG9mIFNjcmlwdCBBdHRyaWJ1dGUgZGVmaW5pdGlvbnMuIEltcGxlbWVudHMgYW4gaW50ZXJmYWNlIHRvIGFkZC9yZW1vdmUgYXR0cmlidXRlcyBhbmRcbiAqIHN0b3JlIHRoZWlyIGRlZmluaXRpb24gZm9yIGEge0BsaW5rIFNjcmlwdFR5cGV9LiBOb3RlOiBBbiBpbnN0YW5jZSBvZiBTY3JpcHRBdHRyaWJ1dGVzIGlzXG4gKiBjcmVhdGVkIGF1dG9tYXRpY2FsbHkgYnkgZWFjaCB7QGxpbmsgU2NyaXB0VHlwZX0uXG4gKi9cbmNsYXNzIFNjcmlwdEF0dHJpYnV0ZXMge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTY3JpcHRBdHRyaWJ1dGVzIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDbGFzczxpbXBvcnQoJy4vc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlPn0gc2NyaXB0VHlwZSAtIFNjcmlwdCBUeXBlIHRoYXQgYXR0cmlidXRlcyByZWxhdGUgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc2NyaXB0VHlwZSkge1xuICAgICAgICB0aGlzLnNjcmlwdFR5cGUgPSBzY3JpcHRUeXBlO1xuICAgICAgICB0aGlzLmluZGV4ID0ge307XG4gICAgfVxuXG4gICAgc3RhdGljIHJlc2VydmVkTmFtZXMgPSBuZXcgU2V0KFtcbiAgICAgICAgJ2FwcCcsICdlbnRpdHknLCAnZW5hYmxlZCcsICdfZW5hYmxlZCcsICdfZW5hYmxlZE9sZCcsICdfZGVzdHJveWVkJyxcbiAgICAgICAgJ19fYXR0cmlidXRlcycsICdfX2F0dHJpYnV0ZXNSYXcnLCAnX19zY3JpcHRUeXBlJywgJ19fZXhlY3V0aW9uT3JkZXInLFxuICAgICAgICAnX2NhbGxiYWNrcycsICdoYXMnLCAnZ2V0JywgJ29uJywgJ29mZicsICdmaXJlJywgJ29uY2UnLCAnaGFzRXZlbnQnXG4gICAgXSk7XG5cbiAgICAvKipcbiAgICAgKiBBZGQgQXR0cmlidXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIGFuIGF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gYXJncyAtIE9iamVjdCB3aXRoIEFyZ3VtZW50cyBmb3IgYW4gYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7KFwiYm9vbGVhblwifFwibnVtYmVyXCJ8XCJzdHJpbmdcInxcImpzb25cInxcImFzc2V0XCJ8XCJlbnRpdHlcInxcInJnYlwifFwicmdiYVwifFwidmVjMlwifFwidmVjM1wifFwidmVjNFwifFwiY3VydmVcIil9IGFyZ3MudHlwZSAtIFR5cGVcbiAgICAgKiBvZiBhbiBhdHRyaWJ1dGUgdmFsdWUuICBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIFwiYXNzZXRcIlxuICAgICAqIC0gXCJib29sZWFuXCJcbiAgICAgKiAtIFwiY3VydmVcIlxuICAgICAqIC0gXCJlbnRpdHlcIlxuICAgICAqIC0gXCJqc29uXCJcbiAgICAgKiAtIFwibnVtYmVyXCJcbiAgICAgKiAtIFwicmdiXCJcbiAgICAgKiAtIFwicmdiYVwiXG4gICAgICogLSBcInN0cmluZ1wiXG4gICAgICogLSBcInZlYzJcIlxuICAgICAqIC0gXCJ2ZWMzXCJcbiAgICAgKiAtIFwidmVjNFwiXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IFthcmdzLmRlZmF1bHRdIC0gRGVmYXVsdCBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFthcmdzLnRpdGxlXSAtIFRpdGxlIGZvciBFZGl0b3IncyBmb3IgZmllbGQgVUkuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFthcmdzLmRlc2NyaXB0aW9uXSAtIERlc2NyaXB0aW9uIGZvciBFZGl0b3IncyBmb3IgZmllbGQgVUkuXG4gICAgICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IFthcmdzLnBsYWNlaG9sZGVyXSAtIFBsYWNlaG9sZGVyIGZvciBFZGl0b3IncyBmb3IgZmllbGQgVUkuXG4gICAgICogRm9yIG11bHRpLWZpZWxkIHR5cGVzLCBzdWNoIGFzIHZlYzIsIHZlYzMsIGFuZCBvdGhlcnMgdXNlIGFycmF5IG9mIHN0cmluZ3MuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYXJncy5hcnJheV0gLSBJZiBhdHRyaWJ1dGUgY2FuIGhvbGQgc2luZ2xlIG9yIG11bHRpcGxlIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3Muc2l6ZV0gLSBJZiBhdHRyaWJ1dGUgaXMgYXJyYXksIG1heGltdW0gbnVtYmVyIG9mIHZhbHVlcyBjYW4gYmUgc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJncy5taW5dIC0gTWluaW11bSB2YWx1ZSBmb3IgdHlwZSAnbnVtYmVyJywgaWYgbWF4IGFuZCBtaW4gZGVmaW5lZCwgc2xpZGVyXG4gICAgICogd2lsbCBiZSByZW5kZXJlZCBpbiBFZGl0b3IncyBVSS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3MubWF4XSAtIE1heGltdW0gdmFsdWUgZm9yIHR5cGUgJ251bWJlcicsIGlmIG1heCBhbmQgbWluIGRlZmluZWQsIHNsaWRlclxuICAgICAqIHdpbGwgYmUgcmVuZGVyZWQgaW4gRWRpdG9yJ3MgVUkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFthcmdzLnByZWNpc2lvbl0gLSBMZXZlbCBvZiBwcmVjaXNpb24gZm9yIGZpZWxkIHR5cGUgJ251bWJlcicgd2l0aCBmbG9hdGluZ1xuICAgICAqIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3Muc3RlcF0gLSBTdGVwIHZhbHVlIGZvciB0eXBlICdudW1iZXInLiBUaGUgYW1vdW50IHVzZWQgdG8gaW5jcmVtZW50IHRoZVxuICAgICAqIHZhbHVlIHdoZW4gdXNpbmcgdGhlIGFycm93IGtleXMgaW4gdGhlIEVkaXRvcidzIFVJLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbYXJncy5hc3NldFR5cGVdIC0gTmFtZSBvZiBhc3NldCB0eXBlIHRvIGJlIHVzZWQgaW4gJ2Fzc2V0JyB0eXBlIGF0dHJpYnV0ZVxuICAgICAqIHBpY2tlciBpbiBFZGl0b3IncyBVSSwgZGVmYXVsdHMgdG8gJyonIChhbGwpLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFthcmdzLmN1cnZlc10gLSBMaXN0IG9mIG5hbWVzIGZvciBDdXJ2ZXMgZm9yIGZpZWxkIHR5cGUgJ2N1cnZlJy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2FyZ3MuY29sb3JdIC0gU3RyaW5nIG9mIGNvbG9yIGNoYW5uZWxzIGZvciBDdXJ2ZXMgZm9yIGZpZWxkIHR5cGUgJ2N1cnZlJyxcbiAgICAgKiBjYW4gYmUgYW55IGNvbWJpbmF0aW9uIG9mIGByZ2JhYCBjaGFyYWN0ZXJzLiBEZWZpbmluZyB0aGlzIHByb3BlcnR5IHdpbGwgcmVuZGVyIEdyYWRpZW50IGluXG4gICAgICogRWRpdG9yJ3MgZmllbGQgVUkuXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gW2FyZ3MuZW51bV0gLSBMaXN0IG9mIGZpeGVkIGNob2ljZXMgZm9yIGZpZWxkLCBkZWZpbmVkIGFzIGFycmF5IG9mIG9iamVjdHMsXG4gICAgICogd2hlcmUga2V5IGluIG9iamVjdCBpcyBhIHRpdGxlIG9mIGFuIG9wdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSBbYXJncy5zY2hlbWFdIC0gTGlzdCBvZiBhdHRyaWJ1dGVzIGZvciB0eXBlICdqc29uJy4gRWFjaCBhdHRyaWJ1dGVcbiAgICAgKiBkZXNjcmlwdGlvbiBpcyBhbiBvYmplY3Qgd2l0aCB0aGUgc2FtZSBwcm9wZXJ0aWVzIGFzIHJlZ3VsYXIgc2NyaXB0IGF0dHJpYnV0ZXMgYnV0IHdpdGggYW5cbiAgICAgKiBhZGRlZCAnbmFtZScgZmllbGQgdG8gc3BlY2lmeSB0aGUgbmFtZSBvZiBlYWNoIGF0dHJpYnV0ZSBpbiB0aGUgSlNPTi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFBsYXllckNvbnRyb2xsZXIuYXR0cmlidXRlcy5hZGQoJ2Z1bGxOYW1lJywge1xuICAgICAqICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5hdHRyaWJ1dGVzLmFkZCgnc3BlZWQnLCB7XG4gICAgICogICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAqICAgICB0aXRsZTogJ1NwZWVkJyxcbiAgICAgKiAgICAgcGxhY2Vob2xkZXI6ICdrbS9oJyxcbiAgICAgKiAgICAgZGVmYXVsdDogMjIuMlxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5hdHRyaWJ1dGVzLmFkZCgncmVzb2x1dGlvbicsIHtcbiAgICAgKiAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICogICAgIGRlZmF1bHQ6IDMyLFxuICAgICAqICAgICBlbnVtOiBbXG4gICAgICogICAgICAgICB7ICczMngzMic6IDMyIH0sXG4gICAgICogICAgICAgICB7ICc2NHg2NCc6IDY0IH0sXG4gICAgICogICAgICAgICB7ICcxMjh4MTI4JzogMTI4IH1cbiAgICAgKiAgICAgXVxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5hdHRyaWJ1dGVzLmFkZCgnY29uZmlnJywge1xuICAgICAqICAgICB0eXBlOiAnanNvbicsXG4gICAgICogICAgIHNjaGVtYTogW3tcbiAgICAgKiAgICAgICAgIG5hbWU6ICdzcGVlZCcsXG4gICAgICogICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgKiAgICAgICAgIHRpdGxlOiAnU3BlZWQnLFxuICAgICAqICAgICAgICAgcGxhY2Vob2xkZXI6ICdrbS9oJyxcbiAgICAgKiAgICAgICAgIGRlZmF1bHQ6IDIyLjJcbiAgICAgKiAgICAgfSwge1xuICAgICAqICAgICAgICAgbmFtZTogJ3Jlc29sdXRpb24nLFxuICAgICAqICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICogICAgICAgICBkZWZhdWx0OiAzMixcbiAgICAgKiAgICAgICAgIGVudW06IFtcbiAgICAgKiAgICAgICAgICAgICB7ICczMngzMic6IDMyIH0sXG4gICAgICogICAgICAgICAgICAgeyAnNjR4NjQnOiA2NCB9LFxuICAgICAqICAgICAgICAgICAgIHsgJzEyOHgxMjgnOiAxMjggfVxuICAgICAqICAgICAgICAgXVxuICAgICAqICAgICB9XVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGFkZChuYW1lLCBhcmdzKSB7XG4gICAgICAgIGlmICh0aGlzLmluZGV4W25hbWVdKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBhdHRyaWJ1dGUgJyR7bmFtZX0nIGlzIGFscmVhZHkgZGVmaW5lZCBmb3Igc2NyaXB0IHR5cGUgJyR7dGhpcy5zY3JpcHRUeXBlLm5hbWV9J2ApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKFNjcmlwdEF0dHJpYnV0ZXMucmVzZXJ2ZWROYW1lcy5oYXMobmFtZSkpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGF0dHJpYnV0ZSAnJHtuYW1lfScgaXMgYSByZXNlcnZlZCBhdHRyaWJ1dGUgbmFtZWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbmRleFtuYW1lXSA9IGFyZ3M7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMuc2NyaXB0VHlwZS5wcm90b3R5cGUsIG5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9fYXR0cmlidXRlc1tuYW1lXTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChyYXcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBldnQgPSAnYXR0cic7XG4gICAgICAgICAgICAgICAgY29uc3QgZXZ0TmFtZSA9ICdhdHRyOicgKyBuYW1lO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5fX2F0dHJpYnV0ZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgLy8ga2VlcCBjb3B5IG9mIG9sZCBmb3IgdGhlIGV2ZW50IGJlbG93XG4gICAgICAgICAgICAgICAgbGV0IG9sZENvcHkgPSBvbGQ7XG4gICAgICAgICAgICAgICAgLy8ganNvbiB0eXBlcyBtaWdodCBoYXZlIGEgJ2Nsb25lJyBmaWVsZCBpbiB0aGVpclxuICAgICAgICAgICAgICAgIC8vIHNjaGVtYSBzbyBtYWtlIHN1cmUgaXQncyBub3QgdGhhdFxuICAgICAgICAgICAgICAgIC8vIGVudGl0aWVzIHNob3VsZCBub3QgYmUgY2xvbmVkIGFzIHdlbGxcbiAgICAgICAgICAgICAgICBpZiAob2xkICYmIGFyZ3MudHlwZSAhPT0gJ2pzb24nICYmIGFyZ3MudHlwZSAhPT0gJ2VudGl0eScgJiYgb2xkLmNsb25lKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIGFuIGV2ZW50IGhhbmRsZXIgaXMgdGhlcmVcbiAgICAgICAgICAgICAgICAgICAgLy8gYmVmb3JlIGNsb25pbmcgZm9yIHBlcmZvcm1hbmNlXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jYWxsYmFja3NbZXZ0XSB8fCB0aGlzLl9jYWxsYmFja3NbZXZ0TmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZENvcHkgPSBvbGQuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgdG8gYXBwcm9wcmlhdGUgdHlwZVxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX19hdHRyaWJ1dGVzW25hbWVdID0gW107XG4gICAgICAgICAgICAgICAgICAgIGlmIChyYXcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSByYXcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9fYXR0cmlidXRlc1tuYW1lXS5wdXNoKHJhd1RvVmFsdWUodGhpcy5hcHAsIGFyZ3MsIHJhd1tpXSwgb2xkID8gb2xkW2ldIDogbnVsbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2F0dHJpYnV0ZXNbbmFtZV0gPSByYXdUb1ZhbHVlKHRoaXMuYXBwLCBhcmdzLCByYXcsIG9sZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKGV2dCwgbmFtZSwgdGhpcy5fX2F0dHJpYnV0ZXNbbmFtZV0sIG9sZENvcHkpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZShldnROYW1lLCB0aGlzLl9fYXR0cmlidXRlc1tuYW1lXSwgb2xkQ29weSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBBdHRyaWJ1dGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIE5hbWUgb2YgYW4gYXR0cmlidXRlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHJlbW92ZWQgb3IgZmFsc2UgaWYgbm90IGRlZmluZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLmF0dHJpYnV0ZXMucmVtb3ZlKCdmdWxsTmFtZScpO1xuICAgICAqL1xuICAgIHJlbW92ZShuYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5pbmRleFtuYW1lXSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBkZWxldGUgdGhpcy5pbmRleFtuYW1lXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuc2NyaXB0VHlwZS5wcm90b3R5cGVbbmFtZV07XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGVjdCBpZiBBdHRyaWJ1dGUgaXMgYWRkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIE5hbWUgb2YgYW4gYXR0cmlidXRlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIEF0dHJpYnV0ZSBpcyBkZWZpbmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKFBsYXllckNvbnRyb2xsZXIuYXR0cmlidXRlcy5oYXMoJ2Z1bGxOYW1lJykpIHtcbiAgICAgKiAgICAgLy8gYXR0cmlidXRlIGZ1bGxOYW1lIGlzIGRlZmluZWRcbiAgICAgKiB9XG4gICAgICovXG4gICAgaGFzKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5pbmRleFtuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgb2JqZWN0IHdpdGggYXR0cmlidXRlIGFyZ3VtZW50cy4gTm90ZTogQ2hhbmdpbmcgYXJndW1lbnQgcHJvcGVydGllcyB3aWxsIG5vdCBhZmZlY3RcbiAgICAgKiBleGlzdGluZyBTY3JpcHQgSW5zdGFuY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIGFuIGF0dHJpYnV0ZS5cbiAgICAgKiBAcmV0dXJucyB7P29iamVjdH0gQXJndW1lbnRzIHdpdGggYXR0cmlidXRlIHByb3BlcnRpZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBjaGFuZ2luZyBkZWZhdWx0IHZhbHVlIGZvciBhbiBhdHRyaWJ1dGUgJ2Z1bGxOYW1lJ1xuICAgICAqIHZhciBhdHRyID0gUGxheWVyQ29udHJvbGxlci5hdHRyaWJ1dGVzLmdldCgnZnVsbE5hbWUnKTtcbiAgICAgKiBpZiAoYXR0cikgYXR0ci5kZWZhdWx0ID0gJ1Vua25vd24nO1xuICAgICAqL1xuICAgIGdldChuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluZGV4W25hbWVdIHx8IG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY3JpcHRBdHRyaWJ1dGVzIH07XG4iXSwibmFtZXMiOlsiY29tcG9uZW50cyIsInZlY0xvb2t1cCIsInVuZGVmaW5lZCIsIlZlYzIiLCJWZWMzIiwiVmVjNCIsInJhd1RvVmFsdWUiLCJhcHAiLCJhcmdzIiwidmFsdWUiLCJvbGQiLCJ0eXBlIiwidiIsInBhcnNlSW50IiwiaXNOYU4iLCJyZXN1bHQiLCJBcnJheSIsImlzQXJyYXkiLCJzY2hlbWEiLCJpIiwibGVuZ3RoIiwiZmllbGQiLCJuYW1lIiwiYXJyYXkiLCJhcnIiLCJqIiwicHVzaCIsInZhbCIsImhhc093blByb3BlcnR5IiwiZGVmYXVsdCIsIkFzc2V0IiwiYXNzZXRzIiwiZ2V0IiwiR3JhcGhOb2RlIiwiZ2V0RW50aXR5RnJvbUluZGV4IiwiQ29sb3IiLCJjb3B5IiwiY2xvbmUiLCJyIiwiZyIsImIiLCJhIiwidGVzdCIsImZyb21TdHJpbmciLCJsZW4iLCJzbGljZSIsInZlY1R5cGUiLCJjdXJ2ZSIsIkN1cnZlIiwiQ3VydmVTZXQiLCJDdXJ2ZVR5cGUiLCJrZXlzIiwiU2NyaXB0QXR0cmlidXRlcyIsImNvbnN0cnVjdG9yIiwic2NyaXB0VHlwZSIsImluZGV4IiwiYWRkIiwiRGVidWciLCJ3YXJuIiwicmVzZXJ2ZWROYW1lcyIsImhhcyIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwicHJvdG90eXBlIiwiX19hdHRyaWJ1dGVzIiwic2V0IiwicmF3IiwiZXZ0IiwiZXZ0TmFtZSIsIm9sZENvcHkiLCJfY2FsbGJhY2tzIiwiZmlyZSIsInJlbW92ZSIsIlNldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQVlBLE1BQU1BLFVBQVUsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcs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
