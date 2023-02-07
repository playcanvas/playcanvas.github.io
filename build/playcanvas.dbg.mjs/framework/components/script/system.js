/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { SortedLoopArray } from '../../../core/sorted-loop-array.js';
import { ComponentSystem } from '../system.js';
import { ScriptComponent } from './component.js';
import { ScriptComponentData } from './data.js';

const METHOD_INITIALIZE_ATTRIBUTES = '_onInitializeAttributes';
const METHOD_INITIALIZE = '_onInitialize';
const METHOD_POST_INITIALIZE = '_onPostInitialize';
const METHOD_UPDATE = '_onUpdate';
const METHOD_POST_UPDATE = '_onPostUpdate';

// Ever-increasing integer used as the execution order of new script components. We are using an
// ever-increasing number and not the order of the script component in the components array because
// if we ever remove components from the array, we would have to re-calculate the execution order
// for all subsequent script components in the array every time, which would be slow.
let executionOrderCounter = 0;

/**
 * Allows scripts to be attached to an Entity and executed.
 *
 * @augments ComponentSystem
 */
class ScriptComponentSystem extends ComponentSystem {
  /**
   * Create a new ScriptComponentSystem.
   *
   * @param {import('../../app-base.js').AppBase} app - The application.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    this.id = 'script';
    this.ComponentType = ScriptComponent;
    this.DataType = ScriptComponentData;

    // list of all entities script components
    // we are using pc.SortedLoopArray because it is
    // safe to modify while looping through it
    this._components = new SortedLoopArray({
      sortBy: '_executionOrder'
    });

    // holds all the enabled script components
    // (whose entities are also enabled). We are using pc.SortedLoopArray
    // because it is safe to modify while looping through it. This array often
    // change during update and postUpdate loops as entities and components get
    // enabled or disabled
    this._enabledComponents = new SortedLoopArray({
      sortBy: '_executionOrder'
    });

    // if true then we are currently preloading scripts
    this.preloading = true;
    this.on('beforeremove', this._onBeforeRemove, this);
    this.app.systems.on('initialize', this._onInitialize, this);
    this.app.systems.on('postInitialize', this._onPostInitialize, this);
    this.app.systems.on('update', this._onUpdate, this);
    this.app.systems.on('postUpdate', this._onPostUpdate, this);
  }
  initializeComponentData(component, data) {
    // Set execution order to an ever-increasing number
    // and add to the end of the components array.
    component._executionOrder = executionOrderCounter++;
    this._components.append(component);

    // check we don't overflow executionOrderCounter
    if (executionOrderCounter > Number.MAX_SAFE_INTEGER) {
      this._resetExecutionOrder();
    }
    component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;
    // if enabled then add this component to the end of the enabledComponents array
    // Note, we should be OK to just append this to the end instead of using insert()
    // which will search for the right slot to insert the component based on execution order,
    // because the execution order of this script should be larger than all the others in the
    // enabledComponents array since it was just added.
    if (component.enabled && component.entity.enabled) {
      this._enabledComponents.append(component);
    }
    if (data.hasOwnProperty('order') && data.hasOwnProperty('scripts')) {
      component._scriptsData = data.scripts;
      for (let i = 0; i < data.order.length; i++) {
        component.create(data.order[i], {
          enabled: data.scripts[data.order[i]].enabled,
          attributes: data.scripts[data.order[i]].attributes,
          preloading: this.preloading
        });
      }
    }
  }
  cloneComponent(entity, clone) {
    const order = [];
    const scripts = {};
    for (let i = 0; i < entity.script._scripts.length; i++) {
      const scriptInstance = entity.script._scripts[i];
      const scriptName = scriptInstance.__scriptType.__name;
      order.push(scriptName);
      const attributes = {};
      for (const key in scriptInstance.__attributes) attributes[key] = scriptInstance.__attributes[key];
      scripts[scriptName] = {
        enabled: scriptInstance._enabled,
        attributes: attributes
      };
    }
    for (const key in entity.script._scriptsIndex) {
      if (key.awaiting) {
        order.splice(key.ind, 0, key);
      }
    }
    const data = {
      enabled: entity.script.enabled,
      order: order,
      scripts: scripts
    };
    return this.addComponent(clone, data);
  }
  _resetExecutionOrder() {
    executionOrderCounter = 0;
    for (let i = 0, len = this._components.length; i < len; i++) {
      this._components.items[i]._executionOrder = executionOrderCounter++;
    }
  }
  _callComponentMethod(components, name, dt) {
    for (components.loopIndex = 0; components.loopIndex < components.length; components.loopIndex++) {
      components.items[components.loopIndex][name](dt);
    }
  }
  _onInitialize() {
    this.preloading = false;

    // initialize attributes on all components
    this._callComponentMethod(this._components, METHOD_INITIALIZE_ATTRIBUTES);

    // call onInitialize on enabled components
    this._callComponentMethod(this._enabledComponents, METHOD_INITIALIZE);
  }
  _onPostInitialize() {
    // call onPostInitialize on enabled components
    this._callComponentMethod(this._enabledComponents, METHOD_POST_INITIALIZE);
  }
  _onUpdate(dt) {
    // call onUpdate on enabled components
    this._callComponentMethod(this._enabledComponents, METHOD_UPDATE, dt);
  }
  _onPostUpdate(dt) {
    // call onPostUpdate on enabled components
    this._callComponentMethod(this._enabledComponents, METHOD_POST_UPDATE, dt);
  }

  // inserts the component into the enabledComponents array
  // which finds the right slot based on component._executionOrder
  _addComponentToEnabled(component) {
    this._enabledComponents.insert(component);
  }

  // removes the component from the enabledComponents array
  _removeComponentFromEnabled(component) {
    this._enabledComponents.remove(component);
  }
  _onBeforeRemove(entity, component) {
    const ind = this._components.items.indexOf(component);
    if (ind >= 0) {
      component._onBeforeRemove();
    }
    this._removeComponentFromEnabled(component);

    // remove from components array
    this._components.remove(component);
  }
  destroy() {
    super.destroy();
    this.app.systems.off('initialize', this._onInitialize, this);
    this.app.systems.off('postInitialize', this._onPostInitialize, this);
    this.app.systems.off('update', this._onUpdate, this);
    this.app.systems.off('postUpdate', this._onPostUpdate, this);
  }
}

export { ScriptComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0L3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTb3J0ZWRMb29wQXJyYXkgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3NvcnRlZC1sb29wLWFycmF5LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vc3lzdGVtLmpzJztcblxuaW1wb3J0IHsgU2NyaXB0Q29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgU2NyaXB0Q29tcG9uZW50RGF0YSB9IGZyb20gJy4vZGF0YS5qcyc7XG5cbmNvbnN0IE1FVEhPRF9JTklUSUFMSVpFX0FUVFJJQlVURVMgPSAnX29uSW5pdGlhbGl6ZUF0dHJpYnV0ZXMnO1xuY29uc3QgTUVUSE9EX0lOSVRJQUxJWkUgPSAnX29uSW5pdGlhbGl6ZSc7XG5jb25zdCBNRVRIT0RfUE9TVF9JTklUSUFMSVpFID0gJ19vblBvc3RJbml0aWFsaXplJztcbmNvbnN0IE1FVEhPRF9VUERBVEUgPSAnX29uVXBkYXRlJztcbmNvbnN0IE1FVEhPRF9QT1NUX1VQREFURSA9ICdfb25Qb3N0VXBkYXRlJztcblxuLy8gRXZlci1pbmNyZWFzaW5nIGludGVnZXIgdXNlZCBhcyB0aGUgZXhlY3V0aW9uIG9yZGVyIG9mIG5ldyBzY3JpcHQgY29tcG9uZW50cy4gV2UgYXJlIHVzaW5nIGFuXG4vLyBldmVyLWluY3JlYXNpbmcgbnVtYmVyIGFuZCBub3QgdGhlIG9yZGVyIG9mIHRoZSBzY3JpcHQgY29tcG9uZW50IGluIHRoZSBjb21wb25lbnRzIGFycmF5IGJlY2F1c2Vcbi8vIGlmIHdlIGV2ZXIgcmVtb3ZlIGNvbXBvbmVudHMgZnJvbSB0aGUgYXJyYXksIHdlIHdvdWxkIGhhdmUgdG8gcmUtY2FsY3VsYXRlIHRoZSBleGVjdXRpb24gb3JkZXJcbi8vIGZvciBhbGwgc3Vic2VxdWVudCBzY3JpcHQgY29tcG9uZW50cyBpbiB0aGUgYXJyYXkgZXZlcnkgdGltZSwgd2hpY2ggd291bGQgYmUgc2xvdy5cbmxldCBleGVjdXRpb25PcmRlckNvdW50ZXIgPSAwO1xuXG4vKipcbiAqIEFsbG93cyBzY3JpcHRzIHRvIGJlIGF0dGFjaGVkIHRvIGFuIEVudGl0eSBhbmQgZXhlY3V0ZWQuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICovXG5jbGFzcyBTY3JpcHRDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTY3JpcHRDb21wb25lbnRTeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnc2NyaXB0JztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBTY3JpcHRDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBTY3JpcHRDb21wb25lbnREYXRhO1xuXG4gICAgICAgIC8vIGxpc3Qgb2YgYWxsIGVudGl0aWVzIHNjcmlwdCBjb21wb25lbnRzXG4gICAgICAgIC8vIHdlIGFyZSB1c2luZyBwYy5Tb3J0ZWRMb29wQXJyYXkgYmVjYXVzZSBpdCBpc1xuICAgICAgICAvLyBzYWZlIHRvIG1vZGlmeSB3aGlsZSBsb29waW5nIHRocm91Z2ggaXRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50cyA9IG5ldyBTb3J0ZWRMb29wQXJyYXkoe1xuICAgICAgICAgICAgc29ydEJ5OiAnX2V4ZWN1dGlvbk9yZGVyJ1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBob2xkcyBhbGwgdGhlIGVuYWJsZWQgc2NyaXB0IGNvbXBvbmVudHNcbiAgICAgICAgLy8gKHdob3NlIGVudGl0aWVzIGFyZSBhbHNvIGVuYWJsZWQpLiBXZSBhcmUgdXNpbmcgcGMuU29ydGVkTG9vcEFycmF5XG4gICAgICAgIC8vIGJlY2F1c2UgaXQgaXMgc2FmZSB0byBtb2RpZnkgd2hpbGUgbG9vcGluZyB0aHJvdWdoIGl0LiBUaGlzIGFycmF5IG9mdGVuXG4gICAgICAgIC8vIGNoYW5nZSBkdXJpbmcgdXBkYXRlIGFuZCBwb3N0VXBkYXRlIGxvb3BzIGFzIGVudGl0aWVzIGFuZCBjb21wb25lbnRzIGdldFxuICAgICAgICAvLyBlbmFibGVkIG9yIGRpc2FibGVkXG4gICAgICAgIHRoaXMuX2VuYWJsZWRDb21wb25lbnRzID0gbmV3IFNvcnRlZExvb3BBcnJheSh7XG4gICAgICAgICAgICBzb3J0Qnk6ICdfZXhlY3V0aW9uT3JkZXInXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgLy8gaWYgdHJ1ZSB0aGVuIHdlIGFyZSBjdXJyZW50bHkgcHJlbG9hZGluZyBzY3JpcHRzXG4gICAgICAgIHRoaXMucHJlbG9hZGluZyA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5fb25CZWZvcmVSZW1vdmUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKCdpbml0aWFsaXplJywgdGhpcy5fb25Jbml0aWFsaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbigncG9zdEluaXRpYWxpemUnLCB0aGlzLl9vblBvc3RJbml0aWFsaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbigndXBkYXRlJywgdGhpcy5fb25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKCdwb3N0VXBkYXRlJywgdGhpcy5fb25Qb3N0VXBkYXRlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEpIHtcbiAgICAgICAgLy8gU2V0IGV4ZWN1dGlvbiBvcmRlciB0byBhbiBldmVyLWluY3JlYXNpbmcgbnVtYmVyXG4gICAgICAgIC8vIGFuZCBhZGQgdG8gdGhlIGVuZCBvZiB0aGUgY29tcG9uZW50cyBhcnJheS5cbiAgICAgICAgY29tcG9uZW50Ll9leGVjdXRpb25PcmRlciA9IGV4ZWN1dGlvbk9yZGVyQ291bnRlcisrO1xuICAgICAgICB0aGlzLl9jb21wb25lbnRzLmFwcGVuZChjb21wb25lbnQpO1xuXG4gICAgICAgIC8vIGNoZWNrIHdlIGRvbid0IG92ZXJmbG93IGV4ZWN1dGlvbk9yZGVyQ291bnRlclxuICAgICAgICBpZiAoZXhlY3V0aW9uT3JkZXJDb3VudGVyID4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBvbmVudC5lbmFibGVkID0gZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZW5hYmxlZCcpID8gISFkYXRhLmVuYWJsZWQgOiB0cnVlO1xuICAgICAgICAvLyBpZiBlbmFibGVkIHRoZW4gYWRkIHRoaXMgY29tcG9uZW50IHRvIHRoZSBlbmQgb2YgdGhlIGVuYWJsZWRDb21wb25lbnRzIGFycmF5XG4gICAgICAgIC8vIE5vdGUsIHdlIHNob3VsZCBiZSBPSyB0byBqdXN0IGFwcGVuZCB0aGlzIHRvIHRoZSBlbmQgaW5zdGVhZCBvZiB1c2luZyBpbnNlcnQoKVxuICAgICAgICAvLyB3aGljaCB3aWxsIHNlYXJjaCBmb3IgdGhlIHJpZ2h0IHNsb3QgdG8gaW5zZXJ0IHRoZSBjb21wb25lbnQgYmFzZWQgb24gZXhlY3V0aW9uIG9yZGVyLFxuICAgICAgICAvLyBiZWNhdXNlIHRoZSBleGVjdXRpb24gb3JkZXIgb2YgdGhpcyBzY3JpcHQgc2hvdWxkIGJlIGxhcmdlciB0aGFuIGFsbCB0aGUgb3RoZXJzIGluIHRoZVxuICAgICAgICAvLyBlbmFibGVkQ29tcG9uZW50cyBhcnJheSBzaW5jZSBpdCB3YXMganVzdCBhZGRlZC5cbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbmFibGVkICYmIGNvbXBvbmVudC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZENvbXBvbmVudHMuYXBwZW5kKGNvbXBvbmVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnb3JkZXInKSAmJiBkYXRhLmhhc093blByb3BlcnR5KCdzY3JpcHRzJykpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5fc2NyaXB0c0RhdGEgPSBkYXRhLnNjcmlwdHM7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5vcmRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5jcmVhdGUoZGF0YS5vcmRlcltpXSwge1xuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBkYXRhLnNjcmlwdHNbZGF0YS5vcmRlcltpXV0uZW5hYmxlZCxcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogZGF0YS5zY3JpcHRzW2RhdGEub3JkZXJbaV1dLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHByZWxvYWRpbmc6IHRoaXMucHJlbG9hZGluZ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY2xvbmVDb21wb25lbnQoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICBjb25zdCBvcmRlciA9IFtdO1xuICAgICAgICBjb25zdCBzY3JpcHRzID0geyB9O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW50aXR5LnNjcmlwdC5fc2NyaXB0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0SW5zdGFuY2UgPSBlbnRpdHkuc2NyaXB0Ll9zY3JpcHRzW2ldO1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0TmFtZSA9IHNjcmlwdEluc3RhbmNlLl9fc2NyaXB0VHlwZS5fX25hbWU7XG4gICAgICAgICAgICBvcmRlci5wdXNoKHNjcmlwdE5hbWUpO1xuXG4gICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0geyB9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gc2NyaXB0SW5zdGFuY2UuX19hdHRyaWJ1dGVzKVxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHNjcmlwdEluc3RhbmNlLl9fYXR0cmlidXRlc1trZXldO1xuXG4gICAgICAgICAgICBzY3JpcHRzW3NjcmlwdE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHNjcmlwdEluc3RhbmNlLl9lbmFibGVkLFxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBlbnRpdHkuc2NyaXB0Ll9zY3JpcHRzSW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChrZXkuYXdhaXRpbmcpIHtcbiAgICAgICAgICAgICAgICBvcmRlci5zcGxpY2Uoa2V5LmluZCwgMCwga2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgICBlbmFibGVkOiBlbnRpdHkuc2NyaXB0LmVuYWJsZWQsXG4gICAgICAgICAgICBvcmRlcjogb3JkZXIsXG4gICAgICAgICAgICBzY3JpcHRzOiBzY3JpcHRzXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50KGNsb25lLCBkYXRhKTtcbiAgICB9XG5cbiAgICBfcmVzZXRFeGVjdXRpb25PcmRlcigpIHtcbiAgICAgICAgZXhlY3V0aW9uT3JkZXJDb3VudGVyID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2NvbXBvbmVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudHMuaXRlbXNbaV0uX2V4ZWN1dGlvbk9yZGVyID0gZXhlY3V0aW9uT3JkZXJDb3VudGVyKys7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY2FsbENvbXBvbmVudE1ldGhvZChjb21wb25lbnRzLCBuYW1lLCBkdCkge1xuICAgICAgICBmb3IgKGNvbXBvbmVudHMubG9vcEluZGV4ID0gMDsgY29tcG9uZW50cy5sb29wSW5kZXggPCBjb21wb25lbnRzLmxlbmd0aDsgY29tcG9uZW50cy5sb29wSW5kZXgrKykge1xuICAgICAgICAgICAgY29tcG9uZW50cy5pdGVtc1tjb21wb25lbnRzLmxvb3BJbmRleF1bbmFtZV0oZHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uSW5pdGlhbGl6ZSgpIHtcbiAgICAgICAgdGhpcy5wcmVsb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBhdHRyaWJ1dGVzIG9uIGFsbCBjb21wb25lbnRzXG4gICAgICAgIHRoaXMuX2NhbGxDb21wb25lbnRNZXRob2QodGhpcy5fY29tcG9uZW50cywgTUVUSE9EX0lOSVRJQUxJWkVfQVRUUklCVVRFUyk7XG5cbiAgICAgICAgLy8gY2FsbCBvbkluaXRpYWxpemUgb24gZW5hYmxlZCBjb21wb25lbnRzXG4gICAgICAgIHRoaXMuX2NhbGxDb21wb25lbnRNZXRob2QodGhpcy5fZW5hYmxlZENvbXBvbmVudHMsIE1FVEhPRF9JTklUSUFMSVpFKTtcbiAgICB9XG5cbiAgICBfb25Qb3N0SW5pdGlhbGl6ZSgpIHtcbiAgICAgICAgLy8gY2FsbCBvblBvc3RJbml0aWFsaXplIG9uIGVuYWJsZWQgY29tcG9uZW50c1xuICAgICAgICB0aGlzLl9jYWxsQ29tcG9uZW50TWV0aG9kKHRoaXMuX2VuYWJsZWRDb21wb25lbnRzLCBNRVRIT0RfUE9TVF9JTklUSUFMSVpFKTtcbiAgICB9XG5cbiAgICBfb25VcGRhdGUoZHQpIHtcbiAgICAgICAgLy8gY2FsbCBvblVwZGF0ZSBvbiBlbmFibGVkIGNvbXBvbmVudHNcbiAgICAgICAgdGhpcy5fY2FsbENvbXBvbmVudE1ldGhvZCh0aGlzLl9lbmFibGVkQ29tcG9uZW50cywgTUVUSE9EX1VQREFURSwgZHQpO1xuICAgIH1cblxuICAgIF9vblBvc3RVcGRhdGUoZHQpIHtcbiAgICAgICAgLy8gY2FsbCBvblBvc3RVcGRhdGUgb24gZW5hYmxlZCBjb21wb25lbnRzXG4gICAgICAgIHRoaXMuX2NhbGxDb21wb25lbnRNZXRob2QodGhpcy5fZW5hYmxlZENvbXBvbmVudHMsIE1FVEhPRF9QT1NUX1VQREFURSwgZHQpO1xuICAgIH1cblxuICAgIC8vIGluc2VydHMgdGhlIGNvbXBvbmVudCBpbnRvIHRoZSBlbmFibGVkQ29tcG9uZW50cyBhcnJheVxuICAgIC8vIHdoaWNoIGZpbmRzIHRoZSByaWdodCBzbG90IGJhc2VkIG9uIGNvbXBvbmVudC5fZXhlY3V0aW9uT3JkZXJcbiAgICBfYWRkQ29tcG9uZW50VG9FbmFibGVkKGNvbXBvbmVudCkge1xuICAgICAgICB0aGlzLl9lbmFibGVkQ29tcG9uZW50cy5pbnNlcnQoY29tcG9uZW50KTtcbiAgICB9XG5cbiAgICAvLyByZW1vdmVzIHRoZSBjb21wb25lbnQgZnJvbSB0aGUgZW5hYmxlZENvbXBvbmVudHMgYXJyYXlcbiAgICBfcmVtb3ZlQ29tcG9uZW50RnJvbUVuYWJsZWQoY29tcG9uZW50KSB7XG4gICAgICAgIHRoaXMuX2VuYWJsZWRDb21wb25lbnRzLnJlbW92ZShjb21wb25lbnQpO1xuICAgIH1cblxuICAgIF9vbkJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9jb21wb25lbnRzLml0ZW1zLmluZGV4T2YoY29tcG9uZW50KTtcbiAgICAgICAgaWYgKGluZCA+PSAwKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX29uQmVmb3JlUmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9yZW1vdmVDb21wb25lbnRGcm9tRW5hYmxlZChjb21wb25lbnQpO1xuXG4gICAgICAgIC8vIHJlbW92ZSBmcm9tIGNvbXBvbmVudHMgYXJyYXlcbiAgICAgICAgdGhpcy5fY29tcG9uZW50cy5yZW1vdmUoY29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ2luaXRpYWxpemUnLCB0aGlzLl9vbkluaXRpYWxpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZigncG9zdEluaXRpYWxpemUnLCB0aGlzLl9vblBvc3RJbml0aWFsaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3VwZGF0ZScsIHRoaXMuX29uVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3Bvc3RVcGRhdGUnLCB0aGlzLl9vblBvc3RVcGRhdGUsIHRoaXMpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NyaXB0Q29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsiTUVUSE9EX0lOSVRJQUxJWkVfQVRUUklCVVRFUyIsIk1FVEhPRF9JTklUSUFMSVpFIiwiTUVUSE9EX1BPU1RfSU5JVElBTElaRSIsIk1FVEhPRF9VUERBVEUiLCJNRVRIT0RfUE9TVF9VUERBVEUiLCJleGVjdXRpb25PcmRlckNvdW50ZXIiLCJTY3JpcHRDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJjb25zdHJ1Y3RvciIsImFwcCIsImlkIiwiQ29tcG9uZW50VHlwZSIsIlNjcmlwdENvbXBvbmVudCIsIkRhdGFUeXBlIiwiU2NyaXB0Q29tcG9uZW50RGF0YSIsIl9jb21wb25lbnRzIiwiU29ydGVkTG9vcEFycmF5Iiwic29ydEJ5IiwiX2VuYWJsZWRDb21wb25lbnRzIiwicHJlbG9hZGluZyIsIm9uIiwiX29uQmVmb3JlUmVtb3ZlIiwic3lzdGVtcyIsIl9vbkluaXRpYWxpemUiLCJfb25Qb3N0SW5pdGlhbGl6ZSIsIl9vblVwZGF0ZSIsIl9vblBvc3RVcGRhdGUiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsImNvbXBvbmVudCIsImRhdGEiLCJfZXhlY3V0aW9uT3JkZXIiLCJhcHBlbmQiLCJOdW1iZXIiLCJNQVhfU0FGRV9JTlRFR0VSIiwiX3Jlc2V0RXhlY3V0aW9uT3JkZXIiLCJlbmFibGVkIiwiaGFzT3duUHJvcGVydHkiLCJlbnRpdHkiLCJfc2NyaXB0c0RhdGEiLCJzY3JpcHRzIiwiaSIsIm9yZGVyIiwibGVuZ3RoIiwiY3JlYXRlIiwiYXR0cmlidXRlcyIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJzY3JpcHQiLCJfc2NyaXB0cyIsInNjcmlwdEluc3RhbmNlIiwic2NyaXB0TmFtZSIsIl9fc2NyaXB0VHlwZSIsIl9fbmFtZSIsInB1c2giLCJrZXkiLCJfX2F0dHJpYnV0ZXMiLCJfZW5hYmxlZCIsIl9zY3JpcHRzSW5kZXgiLCJhd2FpdGluZyIsInNwbGljZSIsImluZCIsImFkZENvbXBvbmVudCIsImxlbiIsIml0ZW1zIiwiX2NhbGxDb21wb25lbnRNZXRob2QiLCJjb21wb25lbnRzIiwibmFtZSIsImR0IiwibG9vcEluZGV4IiwiX2FkZENvbXBvbmVudFRvRW5hYmxlZCIsImluc2VydCIsIl9yZW1vdmVDb21wb25lbnRGcm9tRW5hYmxlZCIsInJlbW92ZSIsImluZGV4T2YiLCJkZXN0cm95Iiwib2ZmIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBT0EsTUFBTUEsNEJBQTRCLEdBQUcseUJBQXlCLENBQUE7QUFDOUQsTUFBTUMsaUJBQWlCLEdBQUcsZUFBZSxDQUFBO0FBQ3pDLE1BQU1DLHNCQUFzQixHQUFHLG1CQUFtQixDQUFBO0FBQ2xELE1BQU1DLGFBQWEsR0FBRyxXQUFXLENBQUE7QUFDakMsTUFBTUMsa0JBQWtCLEdBQUcsZUFBZSxDQUFBOztBQUUxQztBQUNBO0FBQ0E7QUFDQTtB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
