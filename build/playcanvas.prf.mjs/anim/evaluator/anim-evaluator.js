/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { AnimTargetValue } from './anim-target-value.js';

class AnimEvaluator {
  constructor(binder) {
    this._binder = binder;
    this._clips = [];
    this._inputs = [];
    this._outputs = [];
    this._targets = {};
  }

  get clips() {
    return this._clips;
  }

  static _dot(a, b) {
    const len = a.length;
    let result = 0;

    for (let i = 0; i < len; ++i) {
      result += a[i] * b[i];
    }

    return result;
  }

  static _normalize(a) {
    let l = AnimEvaluator._dot(a, a);

    if (l > 0) {
      l = 1.0 / Math.sqrt(l);
      const len = a.length;

      for (let i = 0; i < len; ++i) {
        a[i] *= l;
      }
    }
  }

  static _set(a, b, type) {
    const len = a.length;

    if (type === 'quaternion') {
      let l = AnimEvaluator._dot(b, b);

      if (l > 0) {
        l = 1.0 / Math.sqrt(l);
      }

      for (let i = 0; i < len; ++i) {
        a[i] = b[i] * l;
      }
    } else {
      for (let i = 0; i < len; ++i) {
        a[i] = b[i];
      }
    }
  }

  static _blendVec(a, b, t, additive) {
    const it = additive ? 1.0 : 1.0 - t;
    const len = a.length;

    for (let i = 0; i < len; ++i) {
      a[i] = a[i] * it + b[i] * t;
    }
  }

  static _blendQuat(a, b, t, additive) {
    const len = a.length;
    const it = additive ? 1.0 : 1.0 - t;

    if (AnimEvaluator._dot(a, b) < 0) {
      t = -t;
    }

    for (let i = 0; i < len; ++i) {
      a[i] = a[i] * it + b[i] * t;
    }

    if (!additive) {
      AnimEvaluator._normalize(a);
    }
  }

  static _blend(a, b, t, type, additive) {
    if (type === 'quaternion') {
      AnimEvaluator._blendQuat(a, b, t, additive);
    } else {
      AnimEvaluator._blendVec(a, b, t, additive);
    }
  }

  static _stableSort(a, lessFunc) {
    const len = a.length;

    for (let i = 0; i < len - 1; ++i) {
      for (let j = i + 1; j < len; ++j) {
        if (lessFunc(a[j], a[i])) {
          const tmp = a[i];
          a[i] = a[j];
          a[j] = tmp;
        }
      }
    }
  }

  addClip(clip) {
    const targets = this._targets;
    const binder = this._binder;
    const curves = clip.track.curves;
    const snapshot = clip.snapshot;
    const inputs = [];
    const outputs = [];

    for (let i = 0; i < curves.length; ++i) {
      const curve = curves[i];
      const paths = curve.paths;

      for (let j = 0; j < paths.length; ++j) {
        const path = paths[j];
        const resolved = binder.resolve(path);
        let target = targets[resolved && resolved.targetPath || null];

        if (!target && resolved) {
          target = {
            target: resolved,
            value: [],
            curves: 0,
            blendCounter: 0
          };

          for (let k = 0; k < target.target.components; ++k) {
            target.value.push(0);
          }

          targets[resolved.targetPath] = target;

          if (binder.animComponent) {
            if (!binder.animComponent.targets[resolved.targetPath]) {
              let type;

              if (resolved.targetPath.substring(resolved.targetPath.length - 13) === 'localRotation') {
                type = AnimTargetValue.TYPE_QUAT;
              } else {
                type = AnimTargetValue.TYPE_VEC3;
              }

              binder.animComponent.targets[resolved.targetPath] = new AnimTargetValue(binder.animComponent, type);
            }

            binder.animComponent.targets[resolved.targetPath].layerCounter++;
            binder.animComponent.targets[resolved.targetPath].setMask(binder.layerIndex, 1);
          }
        }

        if (target) {
          target.curves++;
          inputs.push(snapshot._results[i]);
          outputs.push(target);
        }
      }
    }

    this._clips.push(clip);

    this._inputs.push(inputs);

    this._outputs.push(outputs);
  }

  removeClip(index) {
    const targets = this._targets;
    const binder = this._binder;
    const clips = this._clips;
    const clip = clips[index];
    const curves = clip.track.curves;

    for (let i = 0; i < curves.length; ++i) {
      const curve = curves[i];
      const paths = curve.paths;

      for (let j = 0; j < paths.length; ++j) {
        const path = paths[j];

        const target = this._binder.resolve(path);

        if (target) {
          target.curves--;

          if (target.curves === 0) {
            binder.unresolve(path);
            delete targets[target.targetPath];

            if (binder.animComponent) {
              binder.animComponent.targets[target.targetPath].layerCounter--;
            }
          }
        }
      }
    }

    clips.splice(index, 1);

    this._inputs.splice(index, 1);

    this._outputs.splice(index, 1);
  }

  removeClips() {
    while (this._clips.length > 0) {
      this.removeClip(0);
    }
  }

  findClip(name) {
    const clips = this._clips;

    for (let i = 0; i < clips.length; ++i) {
      const clip = clips[i];

      if (clip.name === name) {
        return clip;
      }
    }

    return null;
  }

  rebind() {
    this._binder.rebind();

    this._targets = {};
    const clips = [...this.clips];
    this.removeClips();
    clips.forEach(clip => {
      this.addClip(clip);
    });
  }

  assignMask(mask) {
    return this._binder.assignMask(mask);
  }

  update(deltaTime) {
    const clips = this._clips;
    const order = clips.map(function (c, i) {
      return i;
    });

    AnimEvaluator._stableSort(order, function (a, b) {
      return clips[a].blendOrder < clips[b].blendOrder;
    });

    for (let i = 0; i < order.length; ++i) {
      const index = order[i];
      const clip = clips[index];
      const inputs = this._inputs[index];
      const outputs = this._outputs[index];
      const blendWeight = clip.blendWeight;

      if (blendWeight > 0.0) {
        clip._update(deltaTime);
      }

      let input;
      let output;
      let value;

      if (blendWeight >= 1.0) {
        for (let j = 0; j < inputs.length; ++j) {
          input = inputs[j];
          output = outputs[j];
          value = output.value;

          AnimEvaluator._set(value, input, output.target.type);

          output.blendCounter++;
        }
      } else if (blendWeight > 0.0) {
        for (let j = 0; j < inputs.length; ++j) {
          input = inputs[j];
          output = outputs[j];
          value = output.value;

          if (output.blendCounter === 0) {
            AnimEvaluator._set(value, input, output.target.type);
          } else {
            AnimEvaluator._blend(value, input, blendWeight, output.target.type);
          }

          output.blendCounter++;
        }
      }
    }

    const targets = this._targets;
    const binder = this._binder;

    for (const path in targets) {
      if (targets.hasOwnProperty(path)) {
        const target = targets[path];

        if (binder.animComponent && target.target.isTransform) {
          const animTarget = binder.animComponent.targets[path];

          if (animTarget.counter === animTarget.layerCounter) {
            animTarget.counter = 0;
          }

          if (!animTarget.path) {
            animTarget.path = path;
            animTarget.baseValue = target.target.get();
            animTarget.setter = target.target.set;
          }

          animTarget.updateValue(binder.layerIndex, target.value);
          animTarget.counter++;
        } else {
          target.target.set(target.value);
        }

        target.blendCounter = 0;
      }
    }

    binder.update(deltaTime);
  }

}

export { AnimEvaluator };
