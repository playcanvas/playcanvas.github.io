/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { AnimComponent } from './component.js';
import { AnimComponentData } from './data.js';

const _schema = ['enabled'];

class AnimComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'anim';
    this.ComponentType = AnimComponent;
    this.DataType = AnimComponentData;
    this.schema = _schema;
    this.on('beforeremove', this.onBeforeRemove, this);
    this.app.systems.on('animationUpdate', this.onAnimationUpdate, this);
  }
  initializeComponentData(component, data, properties) {
    super.initializeComponentData(component, data, _schema);
    const complexProperties = ['animationAssets', 'stateGraph', 'layers', 'masks'];
    Object.keys(data).forEach(key => {
      if (complexProperties.includes(key)) return;
      component[key] = data[key];
    });
    if (data.stateGraph) {
      component.stateGraph = data.stateGraph;
      component.loadStateGraph(component.stateGraph);
    }
    if (data.layers) {
      data.layers.forEach((layer, i) => {
        layer._controller.states.forEach(stateKey => {
          layer._controller._states[stateKey]._animationList.forEach(node => {
            component.layers[i].assignAnimation(node.name, node.animTrack);
          });
        });
      });
    } else if (data.animationAssets) {
      component.animationAssets = Object.assign(component.animationAssets, data.animationAssets);
    }
    if (data.masks) {
      Object.keys(data.masks).forEach(key => {
        if (component.layers[key]) {
          const maskData = data.masks[key].mask;
          const mask = {};
          Object.keys(maskData).forEach(maskKey => {
            mask[decodeURI(maskKey)] = maskData[maskKey];
          });
          component.layers[key].mask = mask;
        }
      });
    }
  }
  onAnimationUpdate(dt) {
    const components = this.store;
    for (const id in components) {
      if (components.hasOwnProperty(id)) {
        const component = components[id].entity.anim;
        const componentData = component.data;
        if (componentData.enabled && component.entity.enabled && component.playing) {
          component.update(dt);
        }
      }
    }
  }
  cloneComponent(entity, clone) {
    let masks;
    if (!entity.anim.rootBone || entity.anim.rootBone === entity) {
      masks = {};
      entity.anim.layers.forEach((layer, i) => {
        if (layer.mask) {
          const mask = {};
          Object.keys(layer.mask).forEach(path => {
            const pathArr = path.split('/');
            pathArr.shift();
            const clonePath = [clone.name, ...pathArr].join('/');
            mask[clonePath] = layer.mask[path];
          });
          masks[i] = {
            mask
          };
        }
      });
    }
    const data = {
      stateGraphAsset: entity.anim.stateGraphAsset,
      animationAssets: entity.anim.animationAssets,
      speed: entity.anim.speed,
      activate: entity.anim.activate,
      playing: entity.anim.playing,
      rootBone: entity.anim.rootBone,
      stateGraph: entity.anim.stateGraph,
      layers: entity.anim.layers,
      layerIndices: entity.anim.layerIndices,
      parameters: entity.anim.parameters,
      normalizeWeights: entity.anim.normalizeWeights,
      masks
    };
    return this.addComponent(clone, data);
  }
  onBeforeRemove(entity, component) {
    component.onBeforeRemove();
  }
  destroy() {
    super.destroy();
    this.app.systems.off('animationUpdate', this.onAnimationUpdate, this);
  }
}
Component._buildAccessors(AnimComponent.prototype, _schema);

export { AnimComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IEFuaW1Db21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBBbmltQ29tcG9uZW50RGF0YSB9IGZyb20gJy4vZGF0YS5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IEFwcEJhc2UgKi9cblxuY29uc3QgX3NjaGVtYSA9IFtcbiAgICAnZW5hYmxlZCdcbl07XG5cbi8qKlxuICogVGhlIEFuaW1Db21wb25lbnRTeXN0ZW0gbWFuYWdlcyBjcmVhdGluZyBhbmQgZGVsZXRpbmcgQW5pbUNvbXBvbmVudHMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICovXG5jbGFzcyBBbmltQ29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gQW5pbUNvbXBvbmVudFN5c3RlbSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uIG1hbmFnaW5nIHRoaXMgc3lzdGVtLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ2FuaW0nO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IEFuaW1Db21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBBbmltQ29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub24oJ2FuaW1hdGlvblVwZGF0ZScsIHRoaXMub25BbmltYXRpb25VcGRhdGUsIHRoaXMpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIF9zY2hlbWEpO1xuICAgICAgICBjb25zdCBjb21wbGV4UHJvcGVydGllcyA9IFsnYW5pbWF0aW9uQXNzZXRzJywgJ3N0YXRlR3JhcGgnLCAnbGF5ZXJzJywgJ21hc2tzJ107XG4gICAgICAgIE9iamVjdC5rZXlzKGRhdGEpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgICAgLy8gdGhlc2UgcHJvcGVydGllcyB3aWxsIGJlIGluaXRpYWxpemVkIG1hbnVhbGx5IGJlbG93XG4gICAgICAgICAgICBpZiAoY29tcGxleFByb3BlcnRpZXMuaW5jbHVkZXMoa2V5KSkgcmV0dXJuO1xuICAgICAgICAgICAgY29tcG9uZW50W2tleV0gPSBkYXRhW2tleV07XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZGF0YS5zdGF0ZUdyYXBoKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuc3RhdGVHcmFwaCA9IGRhdGEuc3RhdGVHcmFwaDtcbiAgICAgICAgICAgIGNvbXBvbmVudC5sb2FkU3RhdGVHcmFwaChjb21wb25lbnQuc3RhdGVHcmFwaCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEubGF5ZXJzKSB7XG4gICAgICAgICAgICBkYXRhLmxheWVycy5mb3JFYWNoKChsYXllciwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGxheWVyLl9jb250cm9sbGVyLnN0YXRlcy5mb3JFYWNoKChzdGF0ZUtleSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5fY29udHJvbGxlci5fc3RhdGVzW3N0YXRlS2V5XS5fYW5pbWF0aW9uTGlzdC5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQubGF5ZXJzW2ldLmFzc2lnbkFuaW1hdGlvbihub2RlLm5hbWUsIG5vZGUuYW5pbVRyYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChkYXRhLmFuaW1hdGlvbkFzc2V0cykge1xuICAgICAgICAgICAgY29tcG9uZW50LmFuaW1hdGlvbkFzc2V0cyA9IE9iamVjdC5hc3NpZ24oY29tcG9uZW50LmFuaW1hdGlvbkFzc2V0cywgZGF0YS5hbmltYXRpb25Bc3NldHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEubWFza3MpIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGRhdGEubWFza3MpLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQubGF5ZXJzW2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWFza0RhdGEgPSBkYXRhLm1hc2tzW2tleV0ubWFzaztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWFzayA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhtYXNrRGF0YSkuZm9yRWFjaCgobWFza0tleSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWFza1tkZWNvZGVVUkkobWFza0tleSldID0gbWFza0RhdGFbbWFza0tleV07XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQubGF5ZXJzW2tleV0ubWFzayA9IG1hc2s7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkFuaW1hdGlvblVwZGF0ZShkdCkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gdGhpcy5zdG9yZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnRzLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IGNvbXBvbmVudHNbaWRdLmVudGl0eS5hbmltO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudERhdGEgPSBjb21wb25lbnQuZGF0YTtcblxuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnREYXRhLmVuYWJsZWQgJiYgY29tcG9uZW50LmVudGl0eS5lbmFibGVkICYmIGNvbXBvbmVudC5wbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC51cGRhdGUoZHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgbGV0IG1hc2tzO1xuICAgICAgICAvLyBJZiB0aGUgY29tcG9uZW50IGFuaW1haXRlcyBmcm9tIHRoZSBjb21wb25lbnRzIGVudGl0eSwgYW55IGxheWVyIG1hc2sgaGllcmFyY2h5IHNob3VsZCBiZSB1cGRhdGVkIGZyb20gdGhlIG9sZCBlbnRpdHkgdG8gdGhlIGNsb25lZCBlbnRpdHkuXG4gICAgICAgIGlmICghZW50aXR5LmFuaW0ucm9vdEJvbmUgfHwgZW50aXR5LmFuaW0ucm9vdEJvbmUgPT09IGVudGl0eSkge1xuICAgICAgICAgICAgbWFza3MgPSB7fTtcbiAgICAgICAgICAgIGVudGl0eS5hbmltLmxheWVycy5mb3JFYWNoKChsYXllciwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChsYXllci5tYXNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hc2sgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMobGF5ZXIubWFzaykuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgYWxsIG1hc2sgcGF0aHMgc2hvdWxkIGJlIG1hcHBlZCBmcm9tIHRoZSBwcmV2aW91cyBlbnRpdHkgdG8gdGhlIGNsb25lZCBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhdGhBcnIgPSBwYXRoLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoQXJyLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbG9uZVBhdGggPSBbY2xvbmUubmFtZSwgLi4ucGF0aEFycl0uam9pbignLycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWFza1tjbG9uZVBhdGhdID0gbGF5ZXIubWFza1twYXRoXTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIG1hc2tzW2ldID0geyBtYXNrIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIHN0YXRlR3JhcGhBc3NldDogZW50aXR5LmFuaW0uc3RhdGVHcmFwaEFzc2V0LFxuICAgICAgICAgICAgYW5pbWF0aW9uQXNzZXRzOiBlbnRpdHkuYW5pbS5hbmltYXRpb25Bc3NldHMsXG4gICAgICAgICAgICBzcGVlZDogZW50aXR5LmFuaW0uc3BlZWQsXG4gICAgICAgICAgICBhY3RpdmF0ZTogZW50aXR5LmFuaW0uYWN0aXZhdGUsXG4gICAgICAgICAgICBwbGF5aW5nOiBlbnRpdHkuYW5pbS5wbGF5aW5nLFxuICAgICAgICAgICAgcm9vdEJvbmU6IGVudGl0eS5hbmltLnJvb3RCb25lLFxuICAgICAgICAgICAgc3RhdGVHcmFwaDogZW50aXR5LmFuaW0uc3RhdGVHcmFwaCxcbiAgICAgICAgICAgIGxheWVyczogZW50aXR5LmFuaW0ubGF5ZXJzLFxuICAgICAgICAgICAgbGF5ZXJJbmRpY2VzOiBlbnRpdHkuYW5pbS5sYXllckluZGljZXMsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBlbnRpdHkuYW5pbS5wYXJhbWV0ZXJzLFxuICAgICAgICAgICAgbm9ybWFsaXplV2VpZ2h0czogZW50aXR5LmFuaW0ubm9ybWFsaXplV2VpZ2h0cyxcbiAgICAgICAgICAgIG1hc2tzXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29tcG9uZW50Lm9uQmVmb3JlUmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKCdhbmltYXRpb25VcGRhdGUnLCB0aGlzLm9uQW5pbWF0aW9uVXBkYXRlLCB0aGlzKTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoQW5pbUNvbXBvbmVudC5wcm90b3R5cGUsIF9zY2hlbWEpO1xuXG5leHBvcnQgeyBBbmltQ29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsiX3NjaGVtYSIsIkFuaW1Db21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJjb25zdHJ1Y3RvciIsImFwcCIsImlkIiwiQ29tcG9uZW50VHlwZSIsIkFuaW1Db21wb25lbnQiLCJEYXRhVHlwZSIsIkFuaW1Db21wb25lbnREYXRhIiwic2NoZW1hIiwib24iLCJvbkJlZm9yZVJlbW92ZSIsInN5c3RlbXMiLCJvbkFuaW1hdGlvblVwZGF0ZSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJjb21wbGV4UHJvcGVydGllcyIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwia2V5IiwiaW5jbHVkZXMiLCJzdGF0ZUdyYXBoIiwibG9hZFN0YXRlR3JhcGgiLCJsYXllcnMiLCJsYXllciIsImkiLCJfY29udHJvbGxlciIsInN0YXRlcyIsInN0YXRlS2V5IiwiX3N0YXRlcyIsIl9hbmltYXRpb25MaXN0Iiwibm9kZSIsImFzc2lnbkFuaW1hdGlvbiIsIm5hbWUiLCJhbmltVHJhY2siLCJhbmltYXRpb25Bc3NldHMiLCJhc3NpZ24iLCJtYXNrcyIsIm1hc2tEYXRhIiwibWFzayIsIm1hc2tLZXkiLCJkZWNvZGVVUkkiLCJkdCIsImNvbXBvbmVudHMiLCJzdG9yZSIsImhhc093blByb3BlcnR5IiwiZW50aXR5IiwiYW5pbSIsImNvbXBvbmVudERhdGEiLCJlbmFibGVkIiwicGxheWluZyIsInVwZGF0ZSIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJyb290Qm9uZSIsInBhdGgiLCJwYXRoQXJyIiwic3BsaXQiLCJzaGlmdCIsImNsb25lUGF0aCIsImpvaW4iLCJzdGF0ZUdyYXBoQXNzZXQiLCJzcGVlZCIsImFjdGl2YXRlIiwibGF5ZXJJbmRpY2VzIiwicGFyYW1ldGVycyIsIm5vcm1hbGl6ZVdlaWdodHMiLCJhZGRDb21wb25lbnQiLCJkZXN0cm95Iiwib2ZmIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBUUEsTUFBTUEsT0FBTyxHQUFHLENBQ1osU0FBUyxDQUNaLENBQUE7O0FBT0QsTUFBTUMsbUJBQW1CLFNBQVNDLGVBQWUsQ0FBQztFQU85Q0MsV0FBVyxDQUFDQyxHQUFHLEVBQUU7SUFDYixLQUFLLENBQUNBLEdBQUcsQ0FBQyxDQUFBO0lBRVYsSUFBSSxDQUFDQyxFQUFFLEdBQUcsTUFBTSxDQUFBO0lBRWhCLElBQUksQ0FB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