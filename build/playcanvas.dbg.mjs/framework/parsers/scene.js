/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Entity } from '../entity.js';
import { CompressUtils } from '../../scene/compress/compress-utils.js';
import { Decompress } from '../../scene/compress/decompress.js';
import { Debug } from '../../core/debug.js';

class SceneParser {
  constructor(app, isTemplate) {
    this._app = app;
    this._isTemplate = isTemplate;
  }
  parse(data) {
    const entities = {};
    let parent = null;
    const compressed = data.compressedFormat;
    if (compressed && !data.entDecompressed) {
      data.entDecompressed = true;
      data.entities = new Decompress(data.entities, compressed).run();
    }

    // instantiate entities
    for (const id in data.entities) {
      const curData = data.entities[id];
      const curEnt = this._createEntity(curData, compressed);
      entities[id] = curEnt;
      if (curData.parent === null) {
        parent = curEnt;
      }
    }

    // put entities into hierarchy
    for (const id in data.entities) {
      const curEnt = entities[id];
      const children = data.entities[id].children;
      const len = children.length;
      for (let i = 0; i < len; i++) {
        const childEnt = entities[children[i]];
        if (childEnt) {
          curEnt.addChild(childEnt);
        }
      }
    }
    this._openComponentData(parent, data.entities);
    return parent;
  }
  _createEntity(data, compressed) {
    const entity = new Entity(data.name, this._app);
    entity.setGuid(data.resource_id);
    this._setPosRotScale(entity, data, compressed);
    entity._enabled = data.enabled !== undefined ? data.enabled : true;
    if (this._isTemplate) {
      entity._template = true;
    } else {
      entity._enabledInHierarchy = entity._enabled;
    }
    entity.template = data.template;
    if (data.tags) {
      for (let i = 0; i < data.tags.length; i++) {
        entity.tags.add(data.tags[i]);
      }
    }
    if (data.labels) {
      data.labels.forEach(function (label) {
        entity.addLabel(label);
      });
    }
    return entity;
  }
  _setPosRotScale(entity, data, compressed) {
    if (compressed) {
      CompressUtils.setCompressedPRS(entity, data, compressed);
    } else {
      const p = data.position;
      const r = data.rotation;
      const s = data.scale;
      entity.setLocalPosition(p[0], p[1], p[2]);
      entity.setLocalEulerAngles(r[0], r[1], r[2]);
      entity.setLocalScale(s[0], s[1], s[2]);
    }
  }
  _openComponentData(entity, entities) {
    // Create components in order
    const systemsList = this._app.systems.list;
    let len = systemsList.length;
    const entityData = entities[entity.getGuid()];
    for (let i = 0; i < len; i++) {
      const system = systemsList[i];
      const componentData = entityData.components[system.id];
      if (componentData) {
        system.addComponent(entity, componentData);
      }
    }

    // Open all children and add them to the node
    len = entityData.children.length;
    const children = entity._children;
    for (let i = 0; i < len; i++) {
      if (children[i]) {
        children[i] = this._openComponentData(children[i], entities);
      } else {
        Debug.warn(`Scene data is invalid where a child under "${entity.name}" Entity doesn't exist. Please check the scene data.`);
      }
    }
    return entity;
  }
}

export { SceneParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvcGFyc2Vycy9zY2VuZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuLi9lbnRpdHkuanMnO1xuXG5pbXBvcnQgeyBDb21wcmVzc1V0aWxzIH0gZnJvbSAnLi4vLi4vc2NlbmUvY29tcHJlc3MvY29tcHJlc3MtdXRpbHMuanMnO1xuaW1wb3J0IHsgRGVjb21wcmVzcyB9IGZyb20gJy4uLy4uL3NjZW5lL2NvbXByZXNzL2RlY29tcHJlc3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tIFwiLi4vLi4vY29yZS9kZWJ1Zy5qc1wiO1xuXG5jbGFzcyBTY2VuZVBhcnNlciB7XG4gICAgY29uc3RydWN0b3IoYXBwLCBpc1RlbXBsYXRlKSB7XG4gICAgICAgIHRoaXMuX2FwcCA9IGFwcDtcblxuICAgICAgICB0aGlzLl9pc1RlbXBsYXRlID0gaXNUZW1wbGF0ZTtcbiAgICB9XG5cbiAgICBwYXJzZShkYXRhKSB7XG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0ge307XG4gICAgICAgIGxldCBwYXJlbnQgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IGNvbXByZXNzZWQgPSBkYXRhLmNvbXByZXNzZWRGb3JtYXQ7XG4gICAgICAgIGlmIChjb21wcmVzc2VkICYmICFkYXRhLmVudERlY29tcHJlc3NlZCkge1xuICAgICAgICAgICAgZGF0YS5lbnREZWNvbXByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgZGF0YS5lbnRpdGllcyA9IG5ldyBEZWNvbXByZXNzKGRhdGEuZW50aXRpZXMsIGNvbXByZXNzZWQpLnJ1bigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5zdGFudGlhdGUgZW50aXRpZXNcbiAgICAgICAgZm9yIChjb25zdCBpZCBpbiBkYXRhLmVudGl0aWVzKSB7XG4gICAgICAgICAgICBjb25zdCBjdXJEYXRhID0gZGF0YS5lbnRpdGllc1tpZF07XG4gICAgICAgICAgICBjb25zdCBjdXJFbnQgPSB0aGlzLl9jcmVhdGVFbnRpdHkoY3VyRGF0YSwgY29tcHJlc3NlZCk7XG4gICAgICAgICAgICBlbnRpdGllc1tpZF0gPSBjdXJFbnQ7XG4gICAgICAgICAgICBpZiAoY3VyRGF0YS5wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBjdXJFbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwdXQgZW50aXRpZXMgaW50byBoaWVyYXJjaHlcbiAgICAgICAgZm9yIChjb25zdCBpZCBpbiBkYXRhLmVudGl0aWVzKSB7XG4gICAgICAgICAgICBjb25zdCBjdXJFbnQgPSBlbnRpdGllc1tpZF07XG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IGRhdGEuZW50aXRpZXNbaWRdLmNoaWxkcmVuO1xuICAgICAgICAgICAgY29uc3QgbGVuID0gY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkRW50ID0gZW50aXRpZXNbY2hpbGRyZW5baV1dO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZEVudCkge1xuICAgICAgICAgICAgICAgICAgICBjdXJFbnQuYWRkQ2hpbGQoY2hpbGRFbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29wZW5Db21wb25lbnREYXRhKHBhcmVudCwgZGF0YS5lbnRpdGllcyk7XG5cbiAgICAgICAgcmV0dXJuIHBhcmVudDtcbiAgICB9XG5cbiAgICBfY3JlYXRlRW50aXR5KGRhdGEsIGNvbXByZXNzZWQpIHtcbiAgICAgICAgY29uc3QgZW50aXR5ID0gbmV3IEVudGl0eShkYXRhLm5hbWUsIHRoaXMuX2FwcCk7XG5cbiAgICAgICAgZW50aXR5LnNldEd1aWQoZGF0YS5yZXNvdXJjZV9pZCk7XG4gICAgICAgIHRoaXMuX3NldFBvc1JvdFNjYWxlKGVudGl0eSwgZGF0YSwgY29tcHJlc3NlZCk7XG4gICAgICAgIGVudGl0eS5fZW5hYmxlZCA9IGRhdGEuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gZGF0YS5lbmFibGVkIDogdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5faXNUZW1wbGF0ZSkge1xuICAgICAgICAgICAgZW50aXR5Ll90ZW1wbGF0ZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbnRpdHkuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGVudGl0eS5fZW5hYmxlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGVudGl0eS50ZW1wbGF0ZSA9IGRhdGEudGVtcGxhdGU7XG5cbiAgICAgICAgaWYgKGRhdGEudGFncykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLnRhZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkudGFncy5hZGQoZGF0YS50YWdzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLmxhYmVscykge1xuICAgICAgICAgICAgZGF0YS5sYWJlbHMuZm9yRWFjaChmdW5jdGlvbiAobGFiZWwpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkuYWRkTGFiZWwobGFiZWwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZW50aXR5O1xuICAgIH1cblxuICAgIF9zZXRQb3NSb3RTY2FsZShlbnRpdHksIGRhdGEsIGNvbXByZXNzZWQpIHtcbiAgICAgICAgaWYgKGNvbXByZXNzZWQpIHtcbiAgICAgICAgICAgIENvbXByZXNzVXRpbHMuc2V0Q29tcHJlc3NlZFBSUyhlbnRpdHksIGRhdGEsIGNvbXByZXNzZWQpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwID0gZGF0YS5wb3NpdGlvbjtcbiAgICAgICAgICAgIGNvbnN0IHIgPSBkYXRhLnJvdGF0aW9uO1xuICAgICAgICAgICAgY29uc3QgcyA9IGRhdGEuc2NhbGU7XG5cbiAgICAgICAgICAgIGVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHBbMF0sIHBbMV0sIHBbMl0pO1xuICAgICAgICAgICAgZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoclswXSwgclsxXSwgclsyXSk7XG4gICAgICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZShzWzBdLCBzWzFdLCBzWzJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vcGVuQ29tcG9uZW50RGF0YShlbnRpdHksIGVudGl0aWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBjb21wb25lbnRzIGluIG9yZGVyXG4gICAgICAgIGNvbnN0IHN5c3RlbXNMaXN0ID0gdGhpcy5fYXBwLnN5c3RlbXMubGlzdDtcblxuICAgICAgICBsZXQgbGVuID0gc3lzdGVtc0xpc3QubGVuZ3RoO1xuICAgICAgICBjb25zdCBlbnRpdHlEYXRhID0gZW50aXRpZXNbZW50aXR5LmdldEd1aWQoKV07XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHN5c3RlbSA9IHN5c3RlbXNMaXN0W2ldO1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50RGF0YSA9IGVudGl0eURhdGEuY29tcG9uZW50c1tzeXN0ZW0uaWRdO1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudERhdGEpIHtcbiAgICAgICAgICAgICAgICBzeXN0ZW0uYWRkQ29tcG9uZW50KGVudGl0eSwgY29tcG9uZW50RGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPcGVuIGFsbCBjaGlsZHJlbiBhbmQgYWRkIHRoZW0gdG8gdGhlIG5vZGVcbiAgICAgICAgbGVuID0gZW50aXR5RGF0YS5jaGlsZHJlbi5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gZW50aXR5Ll9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW5baV0gPSB0aGlzLl9vcGVuQ29tcG9uZW50RGF0YShjaGlsZHJlbltpXSwgZW50aXRpZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKGBTY2VuZSBkYXRhIGlzIGludmFsaWQgd2hlcmUgYSBjaGlsZCB1bmRlciBcIiR7ZW50aXR5Lm5hbWV9XCIgRW50aXR5IGRvZXNuJ3QgZXhpc3QuIFBsZWFzZSBjaGVjayB0aGUgc2NlbmUgZGF0YS5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbnRpdHk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY2VuZVBhcnNlciB9O1xuIl0sIm5hbWVzIjpbIlNjZW5lUGFyc2VyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJpc1RlbXBsYXRlIiwiX2FwcCIsIl9pc1RlbXBsYXRlIiwicGFyc2UiLCJkYXRhIiwiZW50aXRpZXMiLCJwYXJlbnQiLCJjb21wcmVzc2VkIiwiY29tcHJlc3NlZEZvcm1hdCIsImVudERlY29tcHJlc3NlZCIsIkRlY29tcHJlc3MiLCJydW4iLCJpZCIsImN1ckRhdGEiLCJjdXJFbnQiLCJfY3JlYXRlRW50aXR5IiwiY2hpbGRyZW4iLCJsZW4iLCJsZW5ndGgiLCJpIiwiY2hpbGRFbnQiLCJhZGRDaGlsZCIsIl9vcGVuQ29tcG9uZW50RGF0YSIsImVudGl0eSIsIkVudGl0eSIsIm5hbWUiLCJzZXRHdWlkIiwicmVzb3VyY2VfaWQiLCJfc2V0UG9zUm90U2NhbGUiLCJfZW5hYmxlZCIsImVuYWJsZWQiLCJ1bmRlZmluZWQiLCJfdGVtcGxhdGUiLCJfZW5hYmxlZEluSGllcmFyY2h5IiwidGVtcGxhdGUiLCJ0YWdzIiwiYWRkIiwibGFiZWxzIiwiZm9yRWFjaCIsImxhYmVsIiwiYWRkTGFiZWwiLCJDb21wcmVzc1V0aWxzIiwic2V0Q29tcHJlc3NlZFBSUyIsInAiLCJwb3NpdGlvbiIsInIiLCJyb3RhdGlvbiIsInMiLCJzY2FsZSIsInNldExvY2FsUG9zaXRpb24iLCJzZXRMb2NhbEV1bGVyQW5nbGVzIiwic2V0TG9jYWxTY2FsZSIsInN5c3RlbXNMaXN0Iiwic3lzdGVtcyIsImxpc3QiLCJlbnRpdHlEYXRhIiwiZ2V0R3VpZCIsInN5c3RlbSIsImNvbXBvbmVudERhdGEiLCJjb21wb25lbnRzIiwiYWRkQ29tcG9uZW50IiwiX2NoaWxkcmVuIiwiRGVidWciLCJ3YXJuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBTUEsTUFBTUEsV0FBVyxDQUFDO0FBQ2RDLEVBQUFBLFdBQVcsQ0FBQ0MsR0FBRyxFQUFFQyxVQUFVLEVBQUU7SUFDekIsSUFBSSxDQUFDQyxJQUFJLEdBQUdGLEdBQUcsQ0FBQTtJQUVmLElBQUksQ0FBQ0csV0FBVyxHQUFHRixVQUFVLENBQUE7QUFDakMsR0FBQTtFQUVBRyxLQUFLLENBQUNDLElBQUksRUFBRTtJQUNSLE1BQU1DLFFBQVEsR0FBRyxFQUFFLENBQUE7SUFDbkIsSUFBSUMsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUVqQixJQUFBLE1BQU1DLFVBQVUsR0FBR0gsSUFBSSxDQUFDSSxnQkFBZ0IsQ0FBQTtBQUN4QyxJQUFBLElBQUlELFVBQVUsSUFBSSxDQUFDSCxJQUFJLENBQUNLLGVBQWUsRUFBRTtNQUNyQ0wsSUFBSSxDQUFDSyxlQUFlLEdBQUcsSUFBSSxDQUFBO0FBQzNCTCxNQUFBQSxJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJSyxVQUFVLENBQUNOLElBQUksQ0FBQ0MsUUFBUSxFQUFFRSxVQUFVLENBQUMsQ0FBQ0ksR0FBRyxFQUFFLENBQUE7QUFDbkUsS0FBQTs7QUFFQTtBQUNBLElBQUEsS0FBSyxNQUFNQyxFQUFFLElBQUlSLElBQUksQ0FBQ0MsUUFBUSxFQUFFO0FBQzVCLE1BQUEsTUFBTVEsT0FBTyxHQUFHVCxJQUFJLENB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
