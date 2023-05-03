import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';

/**
 * Component Systems contain the logic and functionality to update all Components of a particular
 * type.
 *
 * @augments EventHandler
 */
class ComponentSystem extends EventHandler {
  /**
   * Create a new ComponentSystem instance.
   *
   * @param {import('../app-base.js').AppBase} app - The application managing this system.
   */
  constructor(app) {
    super();
    this.app = app;

    // The store where all ComponentData objects are kept
    this.store = {};
    this.schema = [];
  }

  /**
   * Create new {@link Component} and component data instances and attach them to the entity.
   *
   * @param {import('../entity.js').Entity} entity - The Entity to attach this component to.
   * @param {object} [data] - The source data with which to create the component.
   * @returns {import('./component.js').Component} Returns a Component of type defined by the
   * component system.
   * @example
   * const entity = new pc.Entity(app);
   * app.systems.model.addComponent(entity, { type: 'box' });
   * // entity.model is now set to a pc.ModelComponent
   * @ignore
   */
  addComponent(entity, data = {}) {
    const component = new this.ComponentType(this, entity);
    const componentData = new this.DataType();
    this.store[entity.getGuid()] = {
      entity: entity,
      data: componentData
    };
    entity[this.id] = component;
    entity.c[this.id] = component;
    this.initializeComponentData(component, data, []);
    this.fire('add', entity, component);
    return component;
  }

  /**
   * Remove the {@link Component} from the entity and delete the associated component data.
   *
   * @param {import('../entity.js').Entity} entity - The entity to remove the component from.
   * @example
   * app.systems.model.removeComponent(entity);
   * // entity.model === undefined
   * @ignore
   */
  removeComponent(entity) {
    const record = this.store[entity.getGuid()];
    const component = entity.c[this.id];
    this.fire('beforeremove', entity, component);
    delete this.store[entity.getGuid()];
    entity[this.id] = undefined;
    delete entity.c[this.id];
    this.fire('remove', entity, record.data);
  }

  /**
   * Create a clone of component. This creates a copy of all component data variables.
   *
   * @param {import('../entity.js').Entity} entity - The entity to clone the component from.
   * @param {import('../entity.js').Entity} clone - The entity to clone the component into.
   * @returns {import('./component.js').Component} The newly cloned component.
   * @ignore
   */
  cloneComponent(entity, clone) {
    // default clone is just to add a new component with existing data
    const src = this.store[entity.getGuid()];
    return this.addComponent(clone, src.data);
  }

  /**
   * Called during {@link ComponentSystem#addComponent} to initialize the component data in the
   * store. This can be overridden by derived Component Systems and either called by the derived
   * System or replaced entirely.
   *
   * @param {import('./component.js').Component} component - The component being initialized.
   * @param {object} data - The data block used to initialize the component.
   * @param {Array<string | {name: string, type: string}>} properties - The array of property
   * descriptors for the component. A descriptor can be either a plain property name, or an
   * object specifying the name and type.
   * @ignore
   */
  initializeComponentData(component, data = {}, properties) {
    // initialize
    for (let i = 0, len = properties.length; i < len; i++) {
      const descriptor = properties[i];
      let name, type;

      // If the descriptor is an object, it will have `name` and `type` members
      if (typeof descriptor === 'object') {
        name = descriptor.name;
        type = descriptor.type;
      } else {
        // Otherwise, the descriptor is just the property name
        name = descriptor;
        type = undefined;
      }
      let value = data[name];
      if (value !== undefined) {
        // If we know the intended type of the value, convert the raw data
        // into an instance of the specified type.
        if (type !== undefined) {
          value = convertValue(value, type);
        }
        component[name] = value;
      } else {
        component[name] = component.data[name];
      }
    }

    // after component is initialized call onEnable
    if (component.enabled && component.entity.enabled) {
      component.onEnable();
    }
  }

  /**
   * Searches the component schema for properties that match the specified type.
   *
   * @param {string} type - The type to search for.
   * @returns {string[]|object[]} An array of property descriptors matching the specified type.
   * @ignore
   */
  getPropertiesOfType(type) {
    const matchingProperties = [];
    const schema = this.schema || [];
    schema.forEach(function (descriptor) {
      if (descriptor && typeof descriptor === 'object' && descriptor.type === type) {
        matchingProperties.push(descriptor);
      }
    });
    return matchingProperties;
  }
  destroy() {
    this.off();
  }
}
function convertValue(value, type) {
  if (!value) {
    return value;
  }
  switch (type) {
    case 'rgb':
      if (value instanceof Color) {
        return value.clone();
      }
      return new Color(value[0], value[1], value[2]);
    case 'rgba':
      if (value instanceof Color) {
        return value.clone();
      }
      return new Color(value[0], value[1], value[2], value[3]);
    case 'vec2':
      if (value instanceof Vec2) {
        return value.clone();
      }
      return new Vec2(value[0], value[1]);
    case 'vec3':
      if (value instanceof Vec3) {
        return value.clone();
      }
      return new Vec3(value[0], value[1], value[2]);
    case 'vec4':
      if (value instanceof Vec4) {
        return value.clone();
      }
      return new Vec4(value[0], value[1], value[2], value[3]);
    case 'boolean':
    case 'number':
    case 'string':
      return value;
    case 'entity':
      return value;
    // Entity fields should just be a string guid
    default:
      throw new Error('Could not convert unhandled type: ' + type);
  }
}

export { ComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3lzdGVtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5cbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuLyoqXG4gKiBDb21wb25lbnQgU3lzdGVtcyBjb250YWluIHRoZSBsb2dpYyBhbmQgZnVuY3Rpb25hbGl0eSB0byB1cGRhdGUgYWxsIENvbXBvbmVudHMgb2YgYSBwYXJ0aWN1bGFyXG4gKiB0eXBlLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgQ29tcG9uZW50U3lzdGVtIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ29tcG9uZW50U3lzdGVtIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uIG1hbmFnaW5nIHRoaXMgc3lzdGVtLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuYXBwID0gYXBwO1xuXG4gICAgICAgIC8vIFRoZSBzdG9yZSB3aGVyZSBhbGwgQ29tcG9uZW50RGF0YSBvYmplY3RzIGFyZSBrZXB0XG4gICAgICAgIHRoaXMuc3RvcmUgPSB7fTtcbiAgICAgICAgdGhpcy5zY2hlbWEgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgbmV3IHtAbGluayBDb21wb25lbnR9IGFuZCBjb21wb25lbnQgZGF0YSBpbnN0YW5jZXMgYW5kIGF0dGFjaCB0aGVtIHRvIHRoZSBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRvIGF0dGFjaCB0aGlzIGNvbXBvbmVudCB0by5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2RhdGFdIC0gVGhlIHNvdXJjZSBkYXRhIHdpdGggd2hpY2ggdG8gY3JlYXRlIHRoZSBjb21wb25lbnQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi9jb21wb25lbnQuanMnKS5Db21wb25lbnR9IFJldHVybnMgYSBDb21wb25lbnQgb2YgdHlwZSBkZWZpbmVkIGJ5IHRoZVxuICAgICAqIGNvbXBvbmVudCBzeXN0ZW0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogYXBwLnN5c3RlbXMubW9kZWwuYWRkQ29tcG9uZW50KGVudGl0eSwgeyB0eXBlOiAnYm94JyB9KTtcbiAgICAgKiAvLyBlbnRpdHkubW9kZWwgaXMgbm93IHNldCB0byBhIHBjLk1vZGVsQ29tcG9uZW50XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkZENvbXBvbmVudChlbnRpdHksIGRhdGEgPSB7fSkge1xuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgdGhpcy5Db21wb25lbnRUeXBlKHRoaXMsIGVudGl0eSk7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudERhdGEgPSBuZXcgdGhpcy5EYXRhVHlwZSgpO1xuXG4gICAgICAgIHRoaXMuc3RvcmVbZW50aXR5LmdldEd1aWQoKV0gPSB7XG4gICAgICAgICAgICBlbnRpdHk6IGVudGl0eSxcbiAgICAgICAgICAgIGRhdGE6IGNvbXBvbmVudERhdGFcbiAgICAgICAgfTtcblxuICAgICAgICBlbnRpdHlbdGhpcy5pZF0gPSBjb21wb25lbnQ7XG4gICAgICAgIGVudGl0eS5jW3RoaXMuaWRdID0gY29tcG9uZW50O1xuXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBbXSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBlbnRpdHksIGNvbXBvbmVudCk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhlIHtAbGluayBDb21wb25lbnR9IGZyb20gdGhlIGVudGl0eSBhbmQgZGVsZXRlIHRoZSBhc3NvY2lhdGVkIGNvbXBvbmVudCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBmcm9tLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnN5c3RlbXMubW9kZWwucmVtb3ZlQ29tcG9uZW50KGVudGl0eSk7XG4gICAgICogLy8gZW50aXR5Lm1vZGVsID09PSB1bmRlZmluZWRcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVtb3ZlQ29tcG9uZW50KGVudGl0eSkge1xuICAgICAgICBjb25zdCByZWNvcmQgPSB0aGlzLnN0b3JlW2VudGl0eS5nZXRHdWlkKCldO1xuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBlbnRpdHkuY1t0aGlzLmlkXTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2JlZm9yZXJlbW92ZScsIGVudGl0eSwgY29tcG9uZW50KTtcblxuICAgICAgICBkZWxldGUgdGhpcy5zdG9yZVtlbnRpdHkuZ2V0R3VpZCgpXTtcblxuICAgICAgICBlbnRpdHlbdGhpcy5pZF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGRlbGV0ZSBlbnRpdHkuY1t0aGlzLmlkXTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGVudGl0eSwgcmVjb3JkLmRhdGEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIGNsb25lIG9mIGNvbXBvbmVudC4gVGhpcyBjcmVhdGVzIGEgY29weSBvZiBhbGwgY29tcG9uZW50IGRhdGEgdmFyaWFibGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSB0byBjbG9uZSB0aGUgY29tcG9uZW50IGZyb20uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gY2xvbmUgLSBUaGUgZW50aXR5IHRvIGNsb25lIHRoZSBjb21wb25lbnQgaW50by5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL2NvbXBvbmVudC5qcycpLkNvbXBvbmVudH0gVGhlIG5ld2x5IGNsb25lZCBjb21wb25lbnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gZGVmYXVsdCBjbG9uZSBpcyBqdXN0IHRvIGFkZCBhIG5ldyBjb21wb25lbnQgd2l0aCBleGlzdGluZyBkYXRhXG4gICAgICAgIGNvbnN0IHNyYyA9IHRoaXMuc3RvcmVbZW50aXR5LmdldEd1aWQoKV07XG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgc3JjLmRhdGEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBkdXJpbmcge0BsaW5rIENvbXBvbmVudFN5c3RlbSNhZGRDb21wb25lbnR9IHRvIGluaXRpYWxpemUgdGhlIGNvbXBvbmVudCBkYXRhIGluIHRoZVxuICAgICAqIHN0b3JlLiBUaGlzIGNhbiBiZSBvdmVycmlkZGVuIGJ5IGRlcml2ZWQgQ29tcG9uZW50IFN5c3RlbXMgYW5kIGVpdGhlciBjYWxsZWQgYnkgdGhlIGRlcml2ZWRcbiAgICAgKiBTeXN0ZW0gb3IgcmVwbGFjZWQgZW50aXJlbHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9jb21wb25lbnQuanMnKS5Db21wb25lbnR9IGNvbXBvbmVudCAtIFRoZSBjb21wb25lbnQgYmVpbmcgaW5pdGlhbGl6ZWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBUaGUgZGF0YSBibG9jayB1c2VkIHRvIGluaXRpYWxpemUgdGhlIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0FycmF5PHN0cmluZyB8IHtuYW1lOiBzdHJpbmcsIHR5cGU6IHN0cmluZ30+fSBwcm9wZXJ0aWVzIC0gVGhlIGFycmF5IG9mIHByb3BlcnR5XG4gICAgICogZGVzY3JpcHRvcnMgZm9yIHRoZSBjb21wb25lbnQuIEEgZGVzY3JpcHRvciBjYW4gYmUgZWl0aGVyIGEgcGxhaW4gcHJvcGVydHkgbmFtZSwgb3IgYW5cbiAgICAgKiBvYmplY3Qgc3BlY2lmeWluZyB0aGUgbmFtZSBhbmQgdHlwZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhID0ge30sIHByb3BlcnRpZXMpIHtcbiAgICAgICAgLy8gaW5pdGlhbGl6ZVxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcGVydGllcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IHByb3BlcnRpZXNbaV07XG4gICAgICAgICAgICBsZXQgbmFtZSwgdHlwZTtcblxuICAgICAgICAgICAgLy8gSWYgdGhlIGRlc2NyaXB0b3IgaXMgYW4gb2JqZWN0LCBpdCB3aWxsIGhhdmUgYG5hbWVgIGFuZCBgdHlwZWAgbWVtYmVyc1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBkZXNjcmlwdG9yID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIG5hbWUgPSBkZXNjcmlwdG9yLm5hbWU7XG4gICAgICAgICAgICAgICAgdHlwZSA9IGRlc2NyaXB0b3IudHlwZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCB0aGUgZGVzY3JpcHRvciBpcyBqdXN0IHRoZSBwcm9wZXJ0eSBuYW1lXG4gICAgICAgICAgICAgICAgbmFtZSA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgdHlwZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHZhbHVlID0gZGF0YVtuYW1lXTtcblxuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSBrbm93IHRoZSBpbnRlbmRlZCB0eXBlIG9mIHRoZSB2YWx1ZSwgY29udmVydCB0aGUgcmF3IGRhdGFcbiAgICAgICAgICAgICAgICAvLyBpbnRvIGFuIGluc3RhbmNlIG9mIHRoZSBzcGVjaWZpZWQgdHlwZS5cbiAgICAgICAgICAgICAgICBpZiAodHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gY29udmVydFZhbHVlKHZhbHVlLCB0eXBlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb21wb25lbnRbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50W25hbWVdID0gY29tcG9uZW50LmRhdGFbbmFtZV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZnRlciBjb21wb25lbnQgaXMgaW5pdGlhbGl6ZWQgY2FsbCBvbkVuYWJsZVxuICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQgJiYgY29tcG9uZW50LmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQub25FbmFibGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaGVzIHRoZSBjb21wb25lbnQgc2NoZW1hIGZvciBwcm9wZXJ0aWVzIHRoYXQgbWF0Y2ggdGhlIHNwZWNpZmllZCB0eXBlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgdHlwZSB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmdbXXxvYmplY3RbXX0gQW4gYXJyYXkgb2YgcHJvcGVydHkgZGVzY3JpcHRvcnMgbWF0Y2hpbmcgdGhlIHNwZWNpZmllZCB0eXBlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRQcm9wZXJ0aWVzT2ZUeXBlKHR5cGUpIHtcbiAgICAgICAgY29uc3QgbWF0Y2hpbmdQcm9wZXJ0aWVzID0gW107XG4gICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuc2NoZW1hIHx8IFtdO1xuXG4gICAgICAgIHNjaGVtYS5mb3JFYWNoKGZ1bmN0aW9uIChkZXNjcmlwdG9yKSB7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ29iamVjdCcgJiYgZGVzY3JpcHRvci50eXBlID09PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hpbmdQcm9wZXJ0aWVzLnB1c2goZGVzY3JpcHRvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBtYXRjaGluZ1Byb3BlcnRpZXM7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRWYWx1ZSh2YWx1ZSwgdHlwZSkge1xuICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlICdyZ2InOlxuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgQ29sb3IodmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSk7XG4gICAgICAgIGNhc2UgJ3JnYmEnOlxuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgQ29sb3IodmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSwgdmFsdWVbM10pO1xuICAgICAgICBjYXNlICd2ZWMyJzpcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgVmVjMih2YWx1ZVswXSwgdmFsdWVbMV0pO1xuICAgICAgICBjYXNlICd2ZWMzJzpcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgVmVjMyh2YWx1ZVswXSwgdmFsdWVbMV0sIHZhbHVlWzJdKTtcbiAgICAgICAgY2FzZSAndmVjNCc6XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBWZWM0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmNsb25lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IFZlYzQodmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSwgdmFsdWVbM10pO1xuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgY2FzZSAnZW50aXR5JzpcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTsgLy8gRW50aXR5IGZpZWxkcyBzaG91bGQganVzdCBiZSBhIHN0cmluZyBndWlkXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBjb252ZXJ0IHVuaGFuZGxlZCB0eXBlOiAnICsgdHlwZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfTtcbiJdLCJuYW1lcyI6WyJDb21wb25lbnRTeXN0ZW0iLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsInN0b3JlIiwic2NoZW1hIiwiYWRkQ29tcG9uZW50IiwiZW50aXR5IiwiZGF0YSIsImNvbXBvbmVudCIsIkNvbXBvbmVudFR5cGUiLCJjb21wb25lbnREYXRhIiwiRGF0YVR5cGUiLCJnZXRHdWlkIiwiaWQiLCJjIiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJmaXJlIiwicmVtb3ZlQ29tcG9uZW50IiwicmVjb3JkIiwidW5kZWZpbmVkIiwiY2xvbmVDb21wb25lbnQiLCJjbG9uZSIsInNyYyIsInByb3BlcnRpZXMiLCJpIiwibGVuIiwibGVuZ3RoIiwiZGVzY3JpcHRvciIsIm5hbWUiLCJ0eXBlIiwidmFsdWUiLCJjb252ZXJ0VmFsdWUiLCJlbmFibGVkIiwib25FbmFibGUiLCJnZXRQcm9wZXJ0aWVzT2ZUeXBlIiwibWF0Y2hpbmdQcm9wZXJ0aWVzIiwiZm9yRWFjaCIsInB1c2giLCJkZXN0cm95Iiwib2ZmIiwiQ29sb3IiLCJWZWMyIiwiVmVjMyIsIlZlYzQiLCJFcnJvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxTQUFTQyxZQUFZLENBQUM7QUFDdkM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxHQUFHLEVBQUU7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
