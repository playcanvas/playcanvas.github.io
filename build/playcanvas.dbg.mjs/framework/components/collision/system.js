/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Model } from '../../../scene/model.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { CollisionComponent } from './component.js';
import { CollisionComponentData } from './data.js';
import { Trigger } from './trigger.js';

const mat4 = new Mat4();
const vec3 = new Vec3();
const quat = new Quat();
const tempGraphNode = new GraphNode();
const _schema = ['enabled', 'type', 'halfExtents', 'radius', 'axis', 'height', 'asset', 'renderAsset', 'shape', 'model', 'render'];

class CollisionSystemImpl {
  constructor(system) {
    this.system = system;
  }

  beforeInitialize(component, data) {
    data.shape = null;
    data.model = new Model();
    data.model.graph = new GraphNode();
  }

  afterInitialize(component, data) {
    this.recreatePhysicalShapes(component);
    component.data.initialized = true;
  }

  reset(component, data) {
    this.beforeInitialize(component, data);
    this.afterInitialize(component, data);
  }

  recreatePhysicalShapes(component) {
    const entity = component.entity;
    const data = component.data;
    if (typeof Ammo !== 'undefined') {
      if (entity.trigger) {
        entity.trigger.destroy();
        delete entity.trigger;
      }
      if (data.shape) {
        if (component._compoundParent) {
          this.system._removeCompoundChild(component._compoundParent, data.shape);
          if (component._compoundParent.entity.rigidbody) component._compoundParent.entity.rigidbody.activate();
        }
        Ammo.destroy(data.shape);
        data.shape = null;
      }
      data.shape = this.createPhysicalShape(component.entity, data);
      const firstCompoundChild = !component._compoundParent;
      if (data.type === 'compound' && (!component._compoundParent || component === component._compoundParent)) {
        component._compoundParent = component;
        entity.forEach(this._addEachDescendant, component);
      } else if (data.type !== 'compound') {
        if (component._compoundParent && component === component._compoundParent) {
          entity.forEach(this.system.implementations.compound._updateEachDescendant, component);
        }
        if (!component.rigidbody) {
          component._compoundParent = null;
          let parent = entity.parent;
          while (parent) {
            if (parent.collision && parent.collision.type === 'compound') {
              component._compoundParent = parent.collision;
              break;
            }
            parent = parent.parent;
          }
        }
      }
      if (component._compoundParent) {
        if (component !== component._compoundParent) {
          if (firstCompoundChild && component._compoundParent.shape.getNumChildShapes() === 0) {
            this.system.recreatePhysicalShapes(component._compoundParent);
          } else {
            this.system.updateCompoundChildTransform(entity);
            if (component._compoundParent.entity.rigidbody) component._compoundParent.entity.rigidbody.activate();
          }
        }
      }
      if (entity.rigidbody) {
        entity.rigidbody.disableSimulation();
        entity.rigidbody.createBody();
        if (entity.enabled && entity.rigidbody.enabled) {
          entity.rigidbody.enableSimulation();
        }
      } else if (!component._compoundParent) {
        if (!entity.trigger) {
          entity.trigger = new Trigger(this.system.app, component, data);
        } else {
          entity.trigger.initialize(data);
        }
      }
    }
  }

  createPhysicalShape(entity, data) {
    return undefined;
  }
  updateTransform(component, position, rotation, scale) {
    if (component.entity.trigger) {
      component.entity.trigger.updateTransform();
    }
  }
  beforeRemove(entity, component) {
    if (component.data.shape) {
      if (component._compoundParent && !component._compoundParent.entity._destroying) {
        this.system._removeCompoundChild(component._compoundParent, component.data.shape);
        if (component._compoundParent.entity.rigidbody) component._compoundParent.entity.rigidbody.activate();
      }
      component._compoundParent = null;
      Ammo.destroy(component.data.shape);
      component.data.shape = null;
    }
  }

  remove(entity, data) {
    if (entity.rigidbody && entity.rigidbody.body) {
      entity.rigidbody.disableSimulation();
    }
    if (entity.trigger) {
      entity.trigger.destroy();
      delete entity.trigger;
    }
  }

  clone(entity, clone) {
    const src = this.system.store[entity.getGuid()];
    const data = {
      enabled: src.data.enabled,
      type: src.data.type,
      halfExtents: [src.data.halfExtents.x, src.data.halfExtents.y, src.data.halfExtents.z],
      radius: src.data.radius,
      axis: src.data.axis,
      height: src.data.height,
      asset: src.data.asset,
      renderAsset: src.data.renderAsset,
      model: src.data.model,
      render: src.data.render
    };
    return this.system.addComponent(clone, data);
  }
}

class CollisionBoxSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    if (typeof Ammo !== 'undefined') {
      const he = data.halfExtents;
      const ammoHe = new Ammo.btVector3(he ? he.x : 0.5, he ? he.y : 0.5, he ? he.z : 0.5);
      const shape = new Ammo.btBoxShape(ammoHe);
      Ammo.destroy(ammoHe);
      return shape;
    }
    return undefined;
  }
}

class CollisionSphereSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    if (typeof Ammo !== 'undefined') {
      return new Ammo.btSphereShape(data.radius);
    }
    return undefined;
  }
}

class CollisionCapsuleSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    const axis = data.axis !== undefined ? data.axis : 1;
    const radius = data.radius || 0.5;
    const height = Math.max((data.height || 2) - 2 * radius, 0);
    let shape = null;
    if (typeof Ammo !== 'undefined') {
      switch (axis) {
        case 0:
          shape = new Ammo.btCapsuleShapeX(radius, height);
          break;
        case 1:
          shape = new Ammo.btCapsuleShape(radius, height);
          break;
        case 2:
          shape = new Ammo.btCapsuleShapeZ(radius, height);
          break;
      }
    }
    return shape;
  }
}

class CollisionCylinderSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    const axis = data.axis !== undefined ? data.axis : 1;
    const radius = data.radius !== undefined ? data.radius : 0.5;
    const height = data.height !== undefined ? data.height : 1;
    let halfExtents = null;
    let shape = null;
    if (typeof Ammo !== 'undefined') {
      switch (axis) {
        case 0:
          halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
          shape = new Ammo.btCylinderShapeX(halfExtents);
          break;
        case 1:
          halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
          shape = new Ammo.btCylinderShape(halfExtents);
          break;
        case 2:
          halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
          shape = new Ammo.btCylinderShapeZ(halfExtents);
          break;
      }
    }
    if (halfExtents) Ammo.destroy(halfExtents);
    return shape;
  }
}

class CollisionConeSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    const axis = data.axis !== undefined ? data.axis : 1;
    const radius = data.radius !== undefined ? data.radius : 0.5;
    const height = data.height !== undefined ? data.height : 1;
    let shape = null;
    if (typeof Ammo !== 'undefined') {
      switch (axis) {
        case 0:
          shape = new Ammo.btConeShapeX(radius, height);
          break;
        case 1:
          shape = new Ammo.btConeShape(radius, height);
          break;
        case 2:
          shape = new Ammo.btConeShapeZ(radius, height);
          break;
      }
    }
    return shape;
  }
}

class CollisionMeshSystemImpl extends CollisionSystemImpl {
  beforeInitialize(component, data) {}
  createAmmoMesh(mesh, node, shape) {
    let triMesh;
    if (this.system._triMeshCache[mesh.id]) {
      triMesh = this.system._triMeshCache[mesh.id];
    } else {
      const vb = mesh.vertexBuffer;
      const format = vb.getFormat();
      let stride;
      let positions;
      for (let i = 0; i < format.elements.length; i++) {
        const element = format.elements[i];
        if (element.name === SEMANTIC_POSITION) {
          positions = new Float32Array(vb.lock(), element.offset);
          stride = element.stride / 4;
          break;
        }
      }
      const indices = [];
      mesh.getIndices(indices);
      const numTriangles = mesh.primitive[0].count / 3;
      const v1 = new Ammo.btVector3();
      const v2 = new Ammo.btVector3();
      const v3 = new Ammo.btVector3();
      let i1, i2, i3;
      const base = mesh.primitive[0].base;
      triMesh = new Ammo.btTriangleMesh();
      this.system._triMeshCache[mesh.id] = triMesh;
      for (let i = 0; i < numTriangles; i++) {
        i1 = indices[base + i * 3] * stride;
        i2 = indices[base + i * 3 + 1] * stride;
        i3 = indices[base + i * 3 + 2] * stride;
        v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
        v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
        v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
        triMesh.addTriangle(v1, v2, v3, true);
      }
      Ammo.destroy(v1);
      Ammo.destroy(v2);
      Ammo.destroy(v3);
    }
    const useQuantizedAabbCompression = true;
    const triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);
    const scaling = this.system._getNodeScaling(node);
    triMeshShape.setLocalScaling(scaling);
    Ammo.destroy(scaling);
    const transform = this.system._getNodeTransform(node);
    shape.addChildShape(transform, triMeshShape);
    Ammo.destroy(transform);
  }
  createPhysicalShape(entity, data) {
    if (typeof Ammo === 'undefined') return undefined;
    if (data.model || data.render) {
      const shape = new Ammo.btCompoundShape();
      if (data.model) {
        const meshInstances = data.model.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
          this.createAmmoMesh(meshInstances[i].mesh, meshInstances[i].node, shape);
        }
      } else if (data.render) {
        const meshes = data.render.meshes;
        for (let i = 0; i < meshes.length; i++) {
          this.createAmmoMesh(meshes[i], tempGraphNode, shape);
        }
      }
      const entityTransform = entity.getWorldTransform();
      const scale = entityTransform.getScale();
      const vec = new Ammo.btVector3(scale.x, scale.y, scale.z);
      shape.setLocalScaling(vec);
      Ammo.destroy(vec);
      return shape;
    }
    return undefined;
  }
  recreatePhysicalShapes(component) {
    const data = component.data;
    if (data.renderAsset || data.asset) {
      if (component.enabled && component.entity.enabled) {
        this.loadAsset(component, data.renderAsset || data.asset, data.renderAsset ? 'render' : 'model');
        return;
      }
    }
    this.doRecreatePhysicalShape(component);
  }
  loadAsset(component, id, property) {
    const data = component.data;
    const assets = this.system.app.assets;
    const asset = assets.get(id);
    if (asset) {
      asset.ready(asset => {
        data[property] = asset.resource;
        this.doRecreatePhysicalShape(component);
      });
      assets.load(asset);
    } else {
      assets.once('add:' + id, asset => {
        asset.ready(asset => {
          data[property] = asset.resource;
          this.doRecreatePhysicalShape(component);
        });
        assets.load(asset);
      });
    }
  }
  doRecreatePhysicalShape(component) {
    const entity = component.entity;
    const data = component.data;
    if (data.model || data.render) {
      this.destroyShape(data);
      data.shape = this.createPhysicalShape(entity, data);
      if (entity.rigidbody) {
        entity.rigidbody.disableSimulation();
        entity.rigidbody.createBody();
        if (entity.enabled && entity.rigidbody.enabled) {
          entity.rigidbody.enableSimulation();
        }
      } else {
        if (!entity.trigger) {
          entity.trigger = new Trigger(this.system.app, component, data);
        } else {
          entity.trigger.initialize(data);
        }
      }
    } else {
      this.beforeRemove(entity, component);
      this.remove(entity, data);
    }
  }
  updateTransform(component, position, rotation, scale) {
    if (component.shape) {
      const entityTransform = component.entity.getWorldTransform();
      const worldScale = entityTransform.getScale();

      const previousScale = component.shape.getLocalScaling();
      if (worldScale.x !== previousScale.x() || worldScale.y !== previousScale.y() || worldScale.z !== previousScale.z()) {
        this.doRecreatePhysicalShape(component);
      }
    }
    super.updateTransform(component, position, rotation, scale);
  }
  destroyShape(data) {
    if (!data.shape) return;
    const numShapes = data.shape.getNumChildShapes();
    for (let i = 0; i < numShapes; i++) {
      const shape = data.shape.getChildShape(i);
      Ammo.destroy(shape);
    }
    Ammo.destroy(data.shape);
    data.shape = null;
  }
  remove(entity, data) {
    this.destroyShape(data);
    super.remove(entity, data);
  }
}

class CollisionCompoundSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    if (typeof Ammo !== 'undefined') {
      return new Ammo.btCompoundShape();
    }
    return undefined;
  }
  _addEachDescendant(entity) {
    if (!entity.collision || entity.rigidbody) return;
    entity.collision._compoundParent = this;
    if (entity !== this.entity) {
      entity.collision.system.recreatePhysicalShapes(entity.collision);
    }
  }
  _updateEachDescendant(entity) {
    if (!entity.collision) return;
    if (entity.collision._compoundParent !== this) return;
    entity.collision._compoundParent = null;
    if (entity !== this.entity && !entity.rigidbody) {
      entity.collision.system.recreatePhysicalShapes(entity.collision);
    }
  }
  _updateEachDescendantTransform(entity) {
    if (!entity.collision || entity.collision._compoundParent !== this.collision._compoundParent) return;
    this.collision.system.updateCompoundChildTransform(entity);
  }
}

class CollisionComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'collision';
    this.ComponentType = CollisionComponent;
    this.DataType = CollisionComponentData;
    this.schema = _schema;
    this.implementations = {};
    this._triMeshCache = {};
    this.on('beforeremove', this.onBeforeRemove, this);
    this.on('remove', this.onRemove, this);
  }
  initializeComponentData(component, _data, properties) {
    properties = ['type', 'halfExtents', 'radius', 'axis', 'height', 'shape', 'model', 'asset', 'render', 'renderAsset', 'enabled'];

    const data = {};
    for (let i = 0, len = properties.length; i < len; i++) {
      const property = properties[i];
      data[property] = _data[property];
    }

    let idx;
    if (_data.hasOwnProperty('asset')) {
      idx = properties.indexOf('model');
      if (idx !== -1) {
        properties.splice(idx, 1);
      }
      idx = properties.indexOf('render');
      if (idx !== -1) {
        properties.splice(idx, 1);
      }
    } else if (_data.hasOwnProperty('model')) {
      idx = properties.indexOf('asset');
      if (idx !== -1) {
        properties.splice(idx, 1);
      }
    }
    if (!data.type) {
      data.type = component.data.type;
    }
    component.data.type = data.type;
    if (data.halfExtents && Array.isArray(data.halfExtents)) {
      data.halfExtents = new Vec3(data.halfExtents[0], data.halfExtents[1], data.halfExtents[2]);
    }
    const impl = this._createImplementation(data.type);
    impl.beforeInitialize(component, data);
    super.initializeComponentData(component, data, properties);
    impl.afterInitialize(component, data);
  }

  _createImplementation(type) {
    if (this.implementations[type] === undefined) {
      let impl;
      switch (type) {
        case 'box':
          impl = new CollisionBoxSystemImpl(this);
          break;
        case 'sphere':
          impl = new CollisionSphereSystemImpl(this);
          break;
        case 'capsule':
          impl = new CollisionCapsuleSystemImpl(this);
          break;
        case 'cylinder':
          impl = new CollisionCylinderSystemImpl(this);
          break;
        case 'cone':
          impl = new CollisionConeSystemImpl(this);
          break;
        case 'mesh':
          impl = new CollisionMeshSystemImpl(this);
          break;
        case 'compound':
          impl = new CollisionCompoundSystemImpl(this);
          break;
        default:
          Debug.error(`_createImplementation: Invalid collision system type: ${type}`);
      }
      this.implementations[type] = impl;
    }
    return this.implementations[type];
  }

  _getImplementation(entity) {
    return this.implementations[entity.collision.data.type];
  }
  cloneComponent(entity, clone) {
    return this._getImplementation(entity).clone(entity, clone);
  }
  onBeforeRemove(entity, component) {
    this.implementations[component.data.type].beforeRemove(entity, component);
    component.onBeforeRemove();
  }
  onRemove(entity, data) {
    this.implementations[data.type].remove(entity, data);
  }
  updateCompoundChildTransform(entity) {

    this._removeCompoundChild(entity.collision._compoundParent, entity.collision.data.shape);
    if (entity.enabled && entity.collision.enabled) {
      const transform = this._getNodeTransform(entity, entity.collision._compoundParent.entity);
      entity.collision._compoundParent.shape.addChildShape(transform, entity.collision.data.shape);
      Ammo.destroy(transform);
    }
  }
  _removeCompoundChild(collision, shape) {
    if (collision.shape.removeChildShape) {
      collision.shape.removeChildShape(shape);
    } else {
      const ind = collision._getCompoundChildShapeIndex(shape);
      if (ind !== null) {
        collision.shape.removeChildShapeByIndex(ind);
      }
    }
  }
  onTransformChanged(component, position, rotation, scale) {
    this.implementations[component.data.type].updateTransform(component, position, rotation, scale);
  }

  changeType(component, previousType, newType) {
    this.implementations[previousType].beforeRemove(component.entity, component);
    this.implementations[previousType].remove(component.entity, component.data);
    this._createImplementation(newType).reset(component, component.data);
  }

  recreatePhysicalShapes(component) {
    this.implementations[component.data.type].recreatePhysicalShapes(component);
  }
  _calculateNodeRelativeTransform(node, relative) {
    if (node === relative) {
      const scale = node.getWorldTransform().getScale();
      mat4.setScale(scale.x, scale.y, scale.z);
    } else {
      this._calculateNodeRelativeTransform(node.parent, relative);
      mat4.mul(node.getLocalTransform());
    }
  }
  _getNodeScaling(node) {
    const wtm = node.getWorldTransform();
    const scl = wtm.getScale();
    return new Ammo.btVector3(scl.x, scl.y, scl.z);
  }
  _getNodeTransform(node, relative) {
    let pos, rot;
    if (relative) {
      this._calculateNodeRelativeTransform(node, relative);
      pos = vec3;
      rot = quat;
      mat4.getTranslation(pos);
      rot.setFromMat4(mat4);
    } else {
      pos = node.getPosition();
      rot = node.getRotation();
    }
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const origin = transform.getOrigin();
    origin.setValue(pos.x, pos.y, pos.z);
    const ammoQuat = new Ammo.btQuaternion();
    ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
    transform.setRotation(ammoQuat);
    Ammo.destroy(ammoQuat);
    Ammo.destroy(origin);
    return transform;
  }
  destroy() {
    for (const key in this._triMeshCache) {
      Ammo.destroy(this._triMeshCache[key]);
    }
    this._triMeshCache = null;
    super.destroy();
  }
}
Component._buildAccessors(CollisionComponent.prototype, _schema);

export { CollisionComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY29sbGlzaW9uL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFNFTUFOVElDX1BPU0lUSU9OIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vZGVsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuaW1wb3J0IHsgVHJpZ2dlciB9IGZyb20gJy4vdHJpZ2dlci5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IEFwcEJhc2UgKi9cblxuY29uc3QgbWF0NCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2ZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgdGVtcEdyYXBoTm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcblxuY29uc3QgX3NjaGVtYSA9IFtcbiAgICAnZW5hYmxlZCcsXG4gICAgJ3R5cGUnLFxuICAgICdoYWxmRXh0ZW50cycsXG4gICAgJ3JhZGl1cycsXG4gICAgJ2F4aXMnLFxuICAgICdoZWlnaHQnLFxuICAgICdhc3NldCcsXG4gICAgJ3JlbmRlckFzc2V0JyxcbiAgICAnc2hhcGUnLFxuICAgICdtb2RlbCcsXG4gICAgJ3JlbmRlcidcbl07XG5cbi8vIENvbGxpc2lvbiBzeXN0ZW0gaW1wbGVtZW50YXRpb25zXG5jbGFzcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0pIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0gPSBzeXN0ZW07XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIGJlZm9yZSB0aGUgY2FsbCB0byBzeXN0ZW0uc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEgaXMgbWFkZVxuICAgIGJlZm9yZUluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGRhdGEubW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgZGF0YS5tb2RlbC5ncmFwaCA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgYWZ0ZXIgdGhlIGNhbGwgdG8gc3lzdGVtLnN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhIGlzIG1hZGVcbiAgICBhZnRlckluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpO1xuICAgICAgICBjb21wb25lbnQuZGF0YS5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIHdoZW4gYSBjb2xsaXNpb24gY29tcG9uZW50IGNoYW5nZXMgdHlwZSBpbiBvcmRlciB0byByZWNyZWF0ZSBkZWJ1ZyBhbmQgcGh5c2ljYWwgc2hhcGVzXG4gICAgcmVzZXQoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICB0aGlzLmFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFJlLWNyZWF0ZXMgcmlnaWQgYm9kaWVzIC8gdHJpZ2dlcnNcbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSBjb21wb25lbnQuZW50aXR5O1xuICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcmVtb3ZlQ29tcG91bmRDaGlsZChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LCBkYXRhLnNoYXBlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5KVxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgQW1tby5kZXN0cm95KGRhdGEuc2hhcGUpO1xuICAgICAgICAgICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkYXRhLnNoYXBlID0gdGhpcy5jcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudC5lbnRpdHksIGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBmaXJzdENvbXBvdW5kQ2hpbGQgPSAhY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudDtcblxuICAgICAgICAgICAgaWYgKGRhdGEudHlwZSA9PT0gJ2NvbXBvdW5kJyAmJiAoIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgfHwgY29tcG9uZW50ID09PSBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgPSBjb21wb25lbnQ7XG5cbiAgICAgICAgICAgICAgICBlbnRpdHkuZm9yRWFjaCh0aGlzLl9hZGRFYWNoRGVzY2VuZGFudCwgY29tcG9uZW50KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS50eXBlICE9PSAnY29tcG91bmQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgJiYgY29tcG9uZW50ID09PSBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5mb3JFYWNoKHRoaXMuc3lzdGVtLmltcGxlbWVudGF0aW9ucy5jb21wb3VuZC5fdXBkYXRlRWFjaERlc2NlbmRhbnQsIGNvbXBvbmVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnQucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50ID0gZW50aXR5LnBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudC5jb2xsaXNpb24gJiYgcGFyZW50LmNvbGxpc2lvbi50eXBlID09PSAnY29tcG91bmQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IHBhcmVudC5jb2xsaXNpb247XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQgIT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpcnN0Q29tcG91bmRDaGlsZCAmJiBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LnNoYXBlLmdldE51bUNoaWxkU2hhcGVzKCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS51cGRhdGVDb21wb3VuZENoaWxkVHJhbnNmb3JtKGVudGl0eSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbnRpdHkucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuY3JlYXRlQm9keSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5lbmFibGVkICYmIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlciA9IG5ldyBUcmlnZ2VyKHRoaXMuc3lzdGVtLmFwcCwgY29tcG9uZW50LCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5pbml0aWFsaXplKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZXMgYSBwaHlzaWNhbCBzaGFwZSBmb3IgdGhlIGNvbGxpc2lvbi4gVGhpcyBjb25zaXN0c1xuICAgIC8vIG9mIHRoZSBhY3R1YWwgc2hhcGUgdGhhdCB3aWxsIGJlIHVzZWQgZm9yIHRoZSByaWdpZCBib2RpZXMgLyB0cmlnZ2VycyBvZlxuICAgIC8vIHRoZSBjb2xsaXNpb24uXG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB1cGRhdGVUcmFuc2Zvcm0oY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5lbnRpdHkudHJpZ2dlci51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoY29tcG9uZW50LmRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50ICYmICFjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5fZGVzdHJveWluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9yZW1vdmVDb21wb3VuZENoaWxkKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQsIGNvbXBvbmVudC5kYXRhLnNoYXBlKTtcblxuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50ID0gbnVsbDtcblxuICAgICAgICAgICAgQW1tby5kZXN0cm95KGNvbXBvbmVudC5kYXRhLnNoYXBlKTtcbiAgICAgICAgICAgIGNvbXBvbmVudC5kYXRhLnNoYXBlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENhbGxlZCB3aGVuIHRoZSBjb2xsaXNpb24gaXMgcmVtb3ZlZFxuICAgIHJlbW92ZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkgJiYgZW50aXR5LnJpZ2lkYm9keS5ib2R5KSB7XG4gICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENhbGxlZCB3aGVuIHRoZSBjb2xsaXNpb24gaXMgY2xvbmVkIHRvIGFub3RoZXIgZW50aXR5XG4gICAgY2xvbmUoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICBjb25zdCBzcmMgPSB0aGlzLnN5c3RlbS5zdG9yZVtlbnRpdHkuZ2V0R3VpZCgpXTtcblxuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgZW5hYmxlZDogc3JjLmRhdGEuZW5hYmxlZCxcbiAgICAgICAgICAgIHR5cGU6IHNyYy5kYXRhLnR5cGUsXG4gICAgICAgICAgICBoYWxmRXh0ZW50czogW3NyYy5kYXRhLmhhbGZFeHRlbnRzLngsIHNyYy5kYXRhLmhhbGZFeHRlbnRzLnksIHNyYy5kYXRhLmhhbGZFeHRlbnRzLnpdLFxuICAgICAgICAgICAgcmFkaXVzOiBzcmMuZGF0YS5yYWRpdXMsXG4gICAgICAgICAgICBheGlzOiBzcmMuZGF0YS5heGlzLFxuICAgICAgICAgICAgaGVpZ2h0OiBzcmMuZGF0YS5oZWlnaHQsXG4gICAgICAgICAgICBhc3NldDogc3JjLmRhdGEuYXNzZXQsXG4gICAgICAgICAgICByZW5kZXJBc3NldDogc3JjLmRhdGEucmVuZGVyQXNzZXQsXG4gICAgICAgICAgICBtb2RlbDogc3JjLmRhdGEubW9kZWwsXG4gICAgICAgICAgICByZW5kZXI6IHNyYy5kYXRhLnJlbmRlclxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnN5c3RlbS5hZGRDb21wb25lbnQoY2xvbmUsIGRhdGEpO1xuICAgIH1cbn1cblxuLy8gQm94IENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkJveFN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBoZSA9IGRhdGEuaGFsZkV4dGVudHM7XG4gICAgICAgICAgICBjb25zdCBhbW1vSGUgPSBuZXcgQW1tby5idFZlY3RvcjMoaGUgPyBoZS54IDogMC41LCBoZSA/IGhlLnkgOiAwLjUsIGhlID8gaGUueiA6IDAuNSk7XG4gICAgICAgICAgICBjb25zdCBzaGFwZSA9IG5ldyBBbW1vLmJ0Qm94U2hhcGUoYW1tb0hlKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShhbW1vSGUpO1xuICAgICAgICAgICAgcmV0dXJuIHNoYXBlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vLyBTcGhlcmUgQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uU3BoZXJlU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQW1tby5idFNwaGVyZVNoYXBlKGRhdGEucmFkaXVzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuLy8gQ2Fwc3VsZSBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25DYXBzdWxlU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSAoZGF0YS5heGlzICE9PSB1bmRlZmluZWQpID8gZGF0YS5heGlzIDogMTtcbiAgICAgICAgY29uc3QgcmFkaXVzID0gZGF0YS5yYWRpdXMgfHwgMC41O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLm1heCgoZGF0YS5oZWlnaHQgfHwgMikgLSAyICogcmFkaXVzLCAwKTtcblxuICAgICAgICBsZXQgc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoYXhpcykge1xuICAgICAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENhcHN1bGVTaGFwZVgocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDYXBzdWxlU2hhcGUocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDYXBzdWxlU2hhcGVaKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgfVxufVxuXG4vLyBDeWxpbmRlciBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25DeWxpbmRlclN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBjb25zdCBheGlzID0gKGRhdGEuYXhpcyAhPT0gdW5kZWZpbmVkKSA/IGRhdGEuYXhpcyA6IDE7XG4gICAgICAgIGNvbnN0IHJhZGl1cyA9IChkYXRhLnJhZGl1cyAhPT0gdW5kZWZpbmVkKSA/IGRhdGEucmFkaXVzIDogMC41O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSAoZGF0YS5oZWlnaHQgIT09IHVuZGVmaW5lZCkgPyBkYXRhLmhlaWdodCA6IDE7XG5cbiAgICAgICAgbGV0IGhhbGZFeHRlbnRzID0gbnVsbDtcbiAgICAgICAgbGV0IHNoYXBlID0gbnVsbDtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGF4aXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgIGhhbGZFeHRlbnRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKGhlaWdodCAqIDAuNSwgcmFkaXVzLCByYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q3lsaW5kZXJTaGFwZVgoaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIGhhbGZFeHRlbnRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKHJhZGl1cywgaGVpZ2h0ICogMC41LCByYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q3lsaW5kZXJTaGFwZShoYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgaGFsZkV4dGVudHMgPSBuZXcgQW1tby5idFZlY3RvcjMocmFkaXVzLCByYWRpdXMsIGhlaWdodCAqIDAuNSk7XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDeWxpbmRlclNoYXBlWihoYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhbGZFeHRlbnRzKVxuICAgICAgICAgICAgQW1tby5kZXN0cm95KGhhbGZFeHRlbnRzKTtcblxuICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgfVxufVxuXG4vLyBDb25lIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkNvbmVTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgY29uc3QgYXhpcyA9IChkYXRhLmF4aXMgIT09IHVuZGVmaW5lZCkgPyBkYXRhLmF4aXMgOiAxO1xuICAgICAgICBjb25zdCByYWRpdXMgPSAoZGF0YS5yYWRpdXMgIT09IHVuZGVmaW5lZCkgPyBkYXRhLnJhZGl1cyA6IDAuNTtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gKGRhdGEuaGVpZ2h0ICE9PSB1bmRlZmluZWQpID8gZGF0YS5oZWlnaHQgOiAxO1xuXG4gICAgICAgIGxldCBzaGFwZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgc3dpdGNoIChheGlzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q29uZVNoYXBlWChyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENvbmVTaGFwZShyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENvbmVTaGFwZVoocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzaGFwZTtcbiAgICB9XG59XG5cbi8vIE1lc2ggQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICAvLyBvdmVycmlkZSBmb3IgdGhlIG1lc2ggaW1wbGVtZW50YXRpb24gYmVjYXVzZSB0aGUgYXNzZXQgbW9kZWwgbmVlZHNcbiAgICAvLyBzcGVjaWFsIGhhbmRsaW5nXG4gICAgYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpIHt9XG5cbiAgICBjcmVhdGVBbW1vTWVzaChtZXNoLCBub2RlLCBzaGFwZSkge1xuICAgICAgICBsZXQgdHJpTWVzaDtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uX3RyaU1lc2hDYWNoZVttZXNoLmlkXSkge1xuICAgICAgICAgICAgdHJpTWVzaCA9IHRoaXMuc3lzdGVtLl90cmlNZXNoQ2FjaGVbbWVzaC5pZF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB2YiA9IG1lc2gudmVydGV4QnVmZmVyO1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXQgPSB2Yi5nZXRGb3JtYXQoKTtcbiAgICAgICAgICAgIGxldCBzdHJpZGU7XG4gICAgICAgICAgICBsZXQgcG9zaXRpb25zO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmb3JtYXQuZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1BPU0lUSU9OKSB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9ucyA9IG5ldyBGbG9hdDMyQXJyYXkodmIubG9jaygpLCBlbGVtZW50Lm9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIHN0cmlkZSA9IGVsZW1lbnQuc3RyaWRlIC8gNDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gW107XG4gICAgICAgICAgICBtZXNoLmdldEluZGljZXMoaW5kaWNlcyk7XG4gICAgICAgICAgICBjb25zdCBudW1UcmlhbmdsZXMgPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCAvIDM7XG5cbiAgICAgICAgICAgIGNvbnN0IHYxID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBjb25zdCB2MiA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgY29uc3QgdjMgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGxldCBpMSwgaTIsIGkzO1xuXG4gICAgICAgICAgICBjb25zdCBiYXNlID0gbWVzaC5wcmltaXRpdmVbMF0uYmFzZTtcbiAgICAgICAgICAgIHRyaU1lc2ggPSBuZXcgQW1tby5idFRyaWFuZ2xlTWVzaCgpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3RyaU1lc2hDYWNoZVttZXNoLmlkXSA9IHRyaU1lc2g7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVHJpYW5nbGVzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpMSA9IGluZGljZXNbYmFzZSArIGkgKiAzXSAqIHN0cmlkZTtcbiAgICAgICAgICAgICAgICBpMiA9IGluZGljZXNbYmFzZSArIGkgKiAzICsgMV0gKiBzdHJpZGU7XG4gICAgICAgICAgICAgICAgaTMgPSBpbmRpY2VzW2Jhc2UgKyBpICogMyArIDJdICogc3RyaWRlO1xuICAgICAgICAgICAgICAgIHYxLnNldFZhbHVlKHBvc2l0aW9uc1tpMV0sIHBvc2l0aW9uc1tpMSArIDFdLCBwb3NpdGlvbnNbaTEgKyAyXSk7XG4gICAgICAgICAgICAgICAgdjIuc2V0VmFsdWUocG9zaXRpb25zW2kyXSwgcG9zaXRpb25zW2kyICsgMV0sIHBvc2l0aW9uc1tpMiArIDJdKTtcbiAgICAgICAgICAgICAgICB2My5zZXRWYWx1ZShwb3NpdGlvbnNbaTNdLCBwb3NpdGlvbnNbaTMgKyAxXSwgcG9zaXRpb25zW2kzICsgMl0pO1xuICAgICAgICAgICAgICAgIHRyaU1lc2guYWRkVHJpYW5nbGUodjEsIHYyLCB2MywgdHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh2MSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodjIpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHYzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbiA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRyaU1lc2hTaGFwZSA9IG5ldyBBbW1vLmJ0QnZoVHJpYW5nbGVNZXNoU2hhcGUodHJpTWVzaCwgdXNlUXVhbnRpemVkQWFiYkNvbXByZXNzaW9uKTtcblxuICAgICAgICBjb25zdCBzY2FsaW5nID0gdGhpcy5zeXN0ZW0uX2dldE5vZGVTY2FsaW5nKG5vZGUpO1xuICAgICAgICB0cmlNZXNoU2hhcGUuc2V0TG9jYWxTY2FsaW5nKHNjYWxpbmcpO1xuICAgICAgICBBbW1vLmRlc3Ryb3koc2NhbGluZyk7XG5cbiAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gdGhpcy5zeXN0ZW0uX2dldE5vZGVUcmFuc2Zvcm0obm9kZSk7XG4gICAgICAgIHNoYXBlLmFkZENoaWxkU2hhcGUodHJhbnNmb3JtLCB0cmlNZXNoU2hhcGUpO1xuICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcbiAgICB9XG5cbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChkYXRhLm1vZGVsIHx8IGRhdGEucmVuZGVyKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYXBlID0gbmV3IEFtbW8uYnRDb21wb3VuZFNoYXBlKCk7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm1vZGVsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGRhdGEubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVBbW1vTWVzaChtZXNoSW5zdGFuY2VzW2ldLm1lc2gsIG1lc2hJbnN0YW5jZXNbaV0ubm9kZSwgc2hhcGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5yZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoZXMgPSBkYXRhLnJlbmRlci5tZXNoZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVBbW1vTWVzaChtZXNoZXNbaV0sIHRlbXBHcmFwaE5vZGUsIHNoYXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVRyYW5zZm9ybSA9IGVudGl0eS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgY29uc3Qgc2NhbGUgPSBlbnRpdHlUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHZlYyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhzY2FsZS54LCBzY2FsZS55LCBzY2FsZS56KTtcbiAgICAgICAgICAgIHNoYXBlLnNldExvY2FsU2NhbGluZyh2ZWMpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHZlYyk7XG5cbiAgICAgICAgICAgIHJldHVybiBzaGFwZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNvbXBvbmVudC5kYXRhO1xuXG4gICAgICAgIGlmIChkYXRhLnJlbmRlckFzc2V0IHx8IGRhdGEuYXNzZXQpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuZW5hYmxlZCAmJiBjb21wb25lbnQuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRBc3NldChcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnJlbmRlckFzc2V0IHx8IGRhdGEuYXNzZXQsXG4gICAgICAgICAgICAgICAgICAgIGRhdGEucmVuZGVyQXNzZXQgPyAncmVuZGVyJyA6ICdtb2RlbCdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBsb2FkQXNzZXQoY29tcG9uZW50LCBpZCwgcHJvcGVydHkpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNvbXBvbmVudC5kYXRhO1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChpZCk7XG4gICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgYXNzZXQucmVhZHkoKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB0aGlzLmRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFzc2V0cy5vbmNlKCdhZGQ6JyArIGlkLCAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBhc3NldC5yZWFkeSgoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IGNvbXBvbmVudC5lbnRpdHk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBjb21wb25lbnQuZGF0YTtcblxuICAgICAgICBpZiAoZGF0YS5tb2RlbCB8fCBkYXRhLnJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95U2hhcGUoZGF0YSk7XG5cbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSB0aGlzLmNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5jcmVhdGVCb2R5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmVuYWJsZWQgJiYgZW50aXR5LnJpZ2lkYm9keS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlciA9IG5ldyBUcmlnZ2VyKHRoaXMuc3lzdGVtLmFwcCwgY29tcG9uZW50LCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5pbml0aWFsaXplKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVudGl0eSwgZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVUcmFuc2Zvcm0oY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuc2hhcGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVRyYW5zZm9ybSA9IGNvbXBvbmVudC5lbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIGNvbnN0IHdvcmxkU2NhbGUgPSBlbnRpdHlUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHNjYWxlIGNoYW5nZWQgdGhlbiByZWNyZWF0ZSB0aGUgc2hhcGVcbiAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzU2NhbGUgPSBjb21wb25lbnQuc2hhcGUuZ2V0TG9jYWxTY2FsaW5nKCk7XG4gICAgICAgICAgICBpZiAod29ybGRTY2FsZS54ICE9PSBwcmV2aW91c1NjYWxlLngoKSB8fFxuICAgICAgICAgICAgICAgIHdvcmxkU2NhbGUueSAhPT0gcHJldmlvdXNTY2FsZS55KCkgfHxcbiAgICAgICAgICAgICAgICB3b3JsZFNjYWxlLnogIT09IHByZXZpb3VzU2NhbGUueigpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3VwZXIudXBkYXRlVHJhbnNmb3JtKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSk7XG4gICAgfVxuXG4gICAgZGVzdHJveVNoYXBlKGRhdGEpIHtcbiAgICAgICAgaWYgKCFkYXRhLnNoYXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG51bVNoYXBlcyA9IGRhdGEuc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TaGFwZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2hhcGUgPSBkYXRhLnNoYXBlLmdldENoaWxkU2hhcGUoaSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3koc2hhcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KGRhdGEuc2hhcGUpO1xuICAgICAgICBkYXRhLnNoYXBlID0gbnVsbDtcbiAgICB9XG5cbiAgICByZW1vdmUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuZGVzdHJveVNoYXBlKGRhdGEpO1xuICAgICAgICBzdXBlci5yZW1vdmUoZW50aXR5LCBkYXRhKTtcbiAgICB9XG59XG5cbi8vIENvbXBvdW5kIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkNvbXBvdW5kU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQW1tby5idENvbXBvdW5kU2hhcGUoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIF9hZGRFYWNoRGVzY2VuZGFudChlbnRpdHkpIHtcbiAgICAgICAgaWYgKCFlbnRpdHkuY29sbGlzaW9uIHx8IGVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQgPSB0aGlzO1xuXG4gICAgICAgIGlmIChlbnRpdHkgIT09IHRoaXMuZW50aXR5KSB7XG4gICAgICAgICAgICBlbnRpdHkuY29sbGlzaW9uLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUVhY2hEZXNjZW5kYW50KGVudGl0eSkge1xuICAgICAgICBpZiAoIWVudGl0eS5jb2xsaXNpb24pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ICE9PSB0aGlzKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ID0gbnVsbDtcblxuICAgICAgICBpZiAoZW50aXR5ICE9PSB0aGlzLmVudGl0eSAmJiAhZW50aXR5LnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhlbnRpdHkuY29sbGlzaW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVFYWNoRGVzY2VuZGFudFRyYW5zZm9ybShlbnRpdHkpIHtcbiAgICAgICAgaWYgKCFlbnRpdHkuY29sbGlzaW9uIHx8IGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ICE9PSB0aGlzLmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb24uc3lzdGVtLnVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0oZW50aXR5KTtcbiAgICB9XG59XG5cbi8qKlxuICogTWFuYWdlcyBjcmVhdGlvbiBvZiB7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50fXMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICovXG5jbGFzcyBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnY29sbGlzaW9uJztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBDb2xsaXNpb25Db21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBDb2xsaXNpb25Db21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hID0gX3NjaGVtYTtcblxuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9ucyA9IHsgfTtcblxuICAgICAgICB0aGlzLl90cmlNZXNoQ2FjaGUgPSB7IH07XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgX2RhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgcHJvcGVydGllcyA9IFtcbiAgICAgICAgICAgICd0eXBlJyxcbiAgICAgICAgICAgICdoYWxmRXh0ZW50cycsXG4gICAgICAgICAgICAncmFkaXVzJyxcbiAgICAgICAgICAgICdheGlzJyxcbiAgICAgICAgICAgICdoZWlnaHQnLFxuICAgICAgICAgICAgJ3NoYXBlJyxcbiAgICAgICAgICAgICdtb2RlbCcsXG4gICAgICAgICAgICAnYXNzZXQnLFxuICAgICAgICAgICAgJ3JlbmRlcicsXG4gICAgICAgICAgICAncmVuZGVyQXNzZXQnLFxuICAgICAgICAgICAgJ2VuYWJsZWQnXG4gICAgICAgIF07XG5cbiAgICAgICAgLy8gZHVwbGljYXRlIHRoZSBpbnB1dCBkYXRhIGJlY2F1c2Ugd2UgYXJlIG1vZGlmeWluZyBpdFxuICAgICAgICBjb25zdCBkYXRhID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wZXJ0aWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IHByb3BlcnRpZXNbaV07XG4gICAgICAgICAgICBkYXRhW3Byb3BlcnR5XSA9IF9kYXRhW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2V0IHRha2VzIHByaW9yaXR5IG92ZXIgbW9kZWxcbiAgICAgICAgLy8gYnV0IHRoZXkgYXJlIGJvdGggdHJ5aW5nIHRvIGNoYW5nZSB0aGUgbWVzaFxuICAgICAgICAvLyBzbyByZW1vdmUgb25lIG9mIHRoZW0gdG8gYXZvaWQgY29uZmxpY3RzXG4gICAgICAgIGxldCBpZHg7XG4gICAgICAgIGlmIChfZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXNzZXQnKSkge1xuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdtb2RlbCcpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdyZW5kZXInKTtcbiAgICAgICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChfZGF0YS5oYXNPd25Qcm9wZXJ0eSgnbW9kZWwnKSkge1xuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdhc3NldCcpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkYXRhLnR5cGUpIHtcbiAgICAgICAgICAgIGRhdGEudHlwZSA9IGNvbXBvbmVudC5kYXRhLnR5cGU7XG4gICAgICAgIH1cbiAgICAgICAgY29tcG9uZW50LmRhdGEudHlwZSA9IGRhdGEudHlwZTtcblxuICAgICAgICBpZiAoZGF0YS5oYWxmRXh0ZW50cyAmJiBBcnJheS5pc0FycmF5KGRhdGEuaGFsZkV4dGVudHMpKSB7XG4gICAgICAgICAgICBkYXRhLmhhbGZFeHRlbnRzID0gbmV3IFZlYzMoZGF0YS5oYWxmRXh0ZW50c1swXSwgZGF0YS5oYWxmRXh0ZW50c1sxXSwgZGF0YS5oYWxmRXh0ZW50c1syXSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbXBsID0gdGhpcy5fY3JlYXRlSW1wbGVtZW50YXRpb24oZGF0YS50eXBlKTtcbiAgICAgICAgaW1wbC5iZWZvcmVJbml0aWFsaXplKGNvbXBvbmVudCwgZGF0YSk7XG5cbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKTtcblxuICAgICAgICBpbXBsLmFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZXMgYW4gaW1wbGVtZW50YXRpb24gYmFzZWQgb24gdGhlIGNvbGxpc2lvbiB0eXBlIGFuZCBjYWNoZXMgaXRcbiAgICAvLyBpbiBhbiBpbnRlcm5hbCBpbXBsZW1lbnRhdGlvbnMgc3RydWN0dXJlLCBiZWZvcmUgcmV0dXJuaW5nIGl0LlxuICAgIF9jcmVhdGVJbXBsZW1lbnRhdGlvbih0eXBlKSB7XG4gICAgICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uc1t0eXBlXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZXQgaW1wbDtcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2JveCc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQm94U3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3BoZXJlJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjYXBzdWxlJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25DYXBzdWxlU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY3lsaW5kZXInOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbkN5bGluZGVyU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY29uZSc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ29uZVN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ21lc2gnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbk1lc2hTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wb3VuZCc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ29tcG91bmRTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgX2NyZWF0ZUltcGxlbWVudGF0aW9uOiBJbnZhbGlkIGNvbGxpc2lvbiBzeXN0ZW0gdHlwZTogJHt0eXBlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbdHlwZV0gPSBpbXBsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb25zW3R5cGVdO1xuICAgIH1cblxuICAgIC8vIEdldHMgYW4gZXhpc3RpbmcgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgZW50aXR5XG4gICAgX2dldEltcGxlbWVudGF0aW9uKGVudGl0eSkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbnNbZW50aXR5LmNvbGxpc2lvbi5kYXRhLnR5cGVdO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEltcGxlbWVudGF0aW9uKGVudGl0eSkuY2xvbmUoZW50aXR5LCBjbG9uZSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbY29tcG9uZW50LmRhdGEudHlwZV0uYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgICAgY29tcG9uZW50Lm9uQmVmb3JlUmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW2RhdGEudHlwZV0ucmVtb3ZlKGVudGl0eSwgZGF0YSk7XG4gICAgfVxuXG4gICAgdXBkYXRlQ29tcG91bmRDaGlsZFRyYW5zZm9ybShlbnRpdHkpIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyB1c2UgdXBkYXRlQ2hpbGRUcmFuc2Zvcm0gb25jZSBpdCBpcyBleHBvc2VkIGluIGFtbW8uanNcblxuICAgICAgICB0aGlzLl9yZW1vdmVDb21wb3VuZENoaWxkKGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50LCBlbnRpdHkuY29sbGlzaW9uLmRhdGEuc2hhcGUpO1xuXG4gICAgICAgIGlmIChlbnRpdHkuZW5hYmxlZCAmJiBlbnRpdHkuY29sbGlzaW9uLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybSA9IHRoaXMuX2dldE5vZGVUcmFuc2Zvcm0oZW50aXR5LCBlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudC5lbnRpdHkpO1xuICAgICAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQuc2hhcGUuYWRkQ2hpbGRTaGFwZSh0cmFuc2Zvcm0sIGVudGl0eS5jb2xsaXNpb24uZGF0YS5zaGFwZSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW1vdmVDb21wb3VuZENoaWxkKGNvbGxpc2lvbiwgc2hhcGUpIHtcbiAgICAgICAgaWYgKGNvbGxpc2lvbi5zaGFwZS5yZW1vdmVDaGlsZFNoYXBlKSB7XG4gICAgICAgICAgICBjb2xsaXNpb24uc2hhcGUucmVtb3ZlQ2hpbGRTaGFwZShzaGFwZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBpbmQgPSBjb2xsaXNpb24uX2dldENvbXBvdW5kQ2hpbGRTaGFwZUluZGV4KHNoYXBlKTtcbiAgICAgICAgICAgIGlmIChpbmQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb2xsaXNpb24uc2hhcGUucmVtb3ZlQ2hpbGRTaGFwZUJ5SW5kZXgoaW5kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uVHJhbnNmb3JtQ2hhbmdlZChjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbY29tcG9uZW50LmRhdGEudHlwZV0udXBkYXRlVHJhbnNmb3JtKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSk7XG4gICAgfVxuXG4gICAgLy8gRGVzdHJveXMgdGhlIHByZXZpb3VzIGNvbGxpc2lvbiB0eXBlIGFuZCBjcmVhdGVzIGEgbmV3IG9uZSBiYXNlZCBvbiB0aGUgbmV3IHR5cGUgcHJvdmlkZWRcbiAgICBjaGFuZ2VUeXBlKGNvbXBvbmVudCwgcHJldmlvdXNUeXBlLCBuZXdUeXBlKSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW3ByZXZpb3VzVHlwZV0uYmVmb3JlUmVtb3ZlKGNvbXBvbmVudC5lbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW3ByZXZpb3VzVHlwZV0ucmVtb3ZlKGNvbXBvbmVudC5lbnRpdHksIGNvbXBvbmVudC5kYXRhKTtcbiAgICAgICAgdGhpcy5fY3JlYXRlSW1wbGVtZW50YXRpb24obmV3VHlwZSkucmVzZXQoY29tcG9uZW50LCBjb21wb25lbnQuZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gUmVjcmVhdGVzIHJpZ2lkIGJvZGllcyBvciB0cmlnZ2VycyBmb3IgdGhlIHNwZWNpZmllZCBjb21wb25lbnRcbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1tjb21wb25lbnQuZGF0YS50eXBlXS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybShub2RlLCByZWxhdGl2ZSkge1xuICAgICAgICBpZiAobm9kZSA9PT0gcmVsYXRpdmUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFNjYWxlKCk7XG4gICAgICAgICAgICBtYXQ0LnNldFNjYWxlKHNjYWxlLngsIHNjYWxlLnksIHNjYWxlLnopO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlTm9kZVJlbGF0aXZlVHJhbnNmb3JtKG5vZGUucGFyZW50LCByZWxhdGl2ZSk7XG4gICAgICAgICAgICBtYXQ0Lm11bChub2RlLmdldExvY2FsVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2dldE5vZGVTY2FsaW5nKG5vZGUpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICBjb25zdCBzY2wgPSB3dG0uZ2V0U2NhbGUoKTtcbiAgICAgICAgcmV0dXJuIG5ldyBBbW1vLmJ0VmVjdG9yMyhzY2wueCwgc2NsLnksIHNjbC56KTtcbiAgICB9XG5cbiAgICBfZ2V0Tm9kZVRyYW5zZm9ybShub2RlLCByZWxhdGl2ZSkge1xuICAgICAgICBsZXQgcG9zLCByb3Q7XG5cbiAgICAgICAgaWYgKHJlbGF0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVOb2RlUmVsYXRpdmVUcmFuc2Zvcm0obm9kZSwgcmVsYXRpdmUpO1xuXG4gICAgICAgICAgICBwb3MgPSB2ZWMzO1xuICAgICAgICAgICAgcm90ID0gcXVhdDtcblxuICAgICAgICAgICAgbWF0NC5nZXRUcmFuc2xhdGlvbihwb3MpO1xuICAgICAgICAgICAgcm90LnNldEZyb21NYXQ0KG1hdDQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zID0gbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgcm90ID0gbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gbmV3IEFtbW8uYnRUcmFuc2Zvcm0oKTtcbiAgICAgICAgdHJhbnNmb3JtLnNldElkZW50aXR5KCk7XG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IHRyYW5zZm9ybS5nZXRPcmlnaW4oKTtcbiAgICAgICAgb3JpZ2luLnNldFZhbHVlKHBvcy54LCBwb3MueSwgcG9zLnopO1xuXG4gICAgICAgIGNvbnN0IGFtbW9RdWF0ID0gbmV3IEFtbW8uYnRRdWF0ZXJuaW9uKCk7XG4gICAgICAgIGFtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcbiAgICAgICAgdHJhbnNmb3JtLnNldFJvdGF0aW9uKGFtbW9RdWF0KTtcbiAgICAgICAgQW1tby5kZXN0cm95KGFtbW9RdWF0KTtcbiAgICAgICAgQW1tby5kZXN0cm95KG9yaWdpbik7XG5cbiAgICAgICAgcmV0dXJuIHRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl90cmlNZXNoQ2FjaGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLl90cmlNZXNoQ2FjaGVba2V5XSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90cmlNZXNoQ2FjaGUgPSBudWxsO1xuXG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoQ29sbGlzaW9uQ29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIm1hdDQiLCJNYXQ0IiwidmVjMyIsIlZlYzMiLCJxdWF0IiwiUXVhdCIsInRlbXBHcmFwaE5vZGUiLCJHcmFwaE5vZGUiLCJfc2NoZW1hIiwiQ29sbGlzaW9uU3lzdGVtSW1wbCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiYmVmb3JlSW5pdGlhbGl6ZSIsImNvbXBvbmVudCIsImRhdGEiLCJzaGFwZSIsIm1vZGVsIiwiTW9kZWwiLCJncmFwaCIsImFmdGVySW5pdGlhbGl6ZSIsInJlY3JlYXRlUGh5c2ljYWxTaGFwZXMiLCJpbml0aWFsaXplZCIsInJlc2V0IiwiZW50aXR5IiwiQW1tbyIsInRyaWdnZXIiLCJkZXN0cm95IiwiX2NvbXBvdW5kUGFyZW50IiwiX3JlbW92ZUNvbXBvdW5kQ2hpbGQiLCJyaWdpZGJvZHkiLCJhY3RpdmF0ZSIsImNyZWF0ZVBoeXNpY2FsU2hhcGUiLCJmaXJzdENvbXBvdW5kQ2hpbGQiLCJ0eXBlIiwiZm9yRWFjaCIsIl9hZGRFYWNoRGVzY2VuZGFudCIsImltcGxlbWVudGF0aW9ucyIsImNvbXBvdW5kIiwiX3VwZGF0ZUVhY2hEZXNjZW5kYW50IiwicGFyZW50IiwiY29sbGlzaW9uIiwiZ2V0TnVtQ2hpbGRTaGFwZXMiLCJ1cGRhdGVDb21wb3VuZENoaWxkVHJhbnNmb3JtIiwiZGlzYWJsZVNpbXVsYXRpb24iLCJjcmVhdGVCb2R5IiwiZW5hYmxlZCIsImVuYWJsZVNpbXVsYXRpb24iLCJUcmlnZ2VyIiwiYXBwIiwiaW5pdGlhbGl6ZSIsInVuZGVmaW5lZCIsInVwZGF0ZVRyYW5zZm9ybSIsInBvc2l0aW9uIiwicm90YXRpb24iLCJzY2FsZSIsImJlZm9yZVJlbW92ZSIsIl9kZXN0cm95aW5nIiwicmVtb3ZlIiwiYm9keSIsImNsb25lIiwic3JjIiwic3RvcmUiLCJnZXRHdWlkIiwiaGFsZkV4dGVudHMiLCJ4IiwieSIsInoiLCJyYWRpdXMiLCJheGlzIiwiaGVpZ2h0IiwiYXNzZXQiLCJyZW5kZXJBc3NldCIsInJlbmRlciIsImFkZENvbXBvbmVudCIsIkNvbGxpc2lvbkJveFN5c3RlbUltcGwiLCJoZSIsImFtbW9IZSIsImJ0VmVjdG9yMyIsImJ0Qm94U2hhcGUiLCJDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsIiwiYnRTcGhlcmVTaGFwZSIsIkNvbGxpc2lvbkNhcHN1bGVTeXN0ZW1JbXBsIiwiTWF0aCIsIm1heCIsImJ0Q2Fwc3VsZVNoYXBlWCIsImJ0Q2Fwc3VsZVNoYXBlIiwiYnRDYXBzdWxlU2hhcGVaIiwiQ29sbGlzaW9uQ3lsaW5kZXJTeXN0ZW1JbXBsIiwiYnRDeWxpbmRlclNoYXBlWCIsImJ0Q3lsaW5kZXJTaGFwZSIsImJ0Q3lsaW5kZXJTaGFwZVoiLCJDb2xsaXNpb25Db25lU3lzdGVtSW1wbCIsImJ0Q29uZVNoYXBlWCIsImJ0Q29uZVNoYXBlIiwiYnRDb25lU2hhcGVaIiwiQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwiLCJjcmVhdGVBbW1vTWVzaCIsIm1lc2giLCJub2RlIiwidHJpTWVzaCIsIl90cmlNZXNoQ2FjaGUiLCJpZCIsInZiIiwidmVydGV4QnVmZmVyIiwiZm9ybWF0IiwiZ2V0Rm9ybWF0Iiwic3RyaWRlIiwicG9zaXRpb25zIiwiaSIsImVsZW1lbnRzIiwibGVuZ3RoIiwiZWxlbWVudCIsIm5hbWUiLCJTRU1BTlRJQ19QT1NJVElPTiIsIkZsb2F0MzJBcnJheSIsImxvY2siLCJvZmZzZXQiLCJpbmRpY2VzIiwiZ2V0SW5kaWNlcyIsIm51bVRyaWFuZ2xlcyIsInByaW1pdGl2ZSIsImNvdW50IiwidjEiLCJ2MiIsInYzIiwiaTEiLCJpMiIsImkzIiwiYmFzZSIsImJ0VHJpYW5nbGVNZXNoIiwic2V0VmFsdWUiLCJhZGRUcmlhbmdsZSIsInVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbiIsInRyaU1lc2hTaGFwZSIsImJ0QnZoVHJpYW5nbGVNZXNoU2hhcGUiLCJzY2FsaW5nIiwiX2dldE5vZGVTY2FsaW5nIiwic2V0TG9jYWxTY2FsaW5nIiwidHJhbnNmb3JtIiwiX2dldE5vZGVUcmFuc2Zvcm0iLCJhZGRDaGlsZFNoYXBlIiwiYnRDb21wb3VuZFNoYXBlIiwibWVzaEluc3RhbmNlcyIsIm1lc2hlcyIsImVudGl0eVRyYW5zZm9ybSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0U2NhbGUiLCJ2ZWMiLCJsb2FkQXNzZXQiLCJkb1JlY3JlYXRlUGh5c2ljYWxTaGFwZSIsInByb3BlcnR5IiwiYXNzZXRzIiwiZ2V0IiwicmVhZHkiLCJyZXNvdXJjZSIsImxvYWQiLCJvbmNlIiwiZGVzdHJveVNoYXBlIiwid29ybGRTY2FsZSIsInByZXZpb3VzU2NhbGUiLCJnZXRMb2NhbFNjYWxpbmciLCJudW1TaGFwZXMiLCJnZXRDaGlsZFNoYXBlIiwiQ29sbGlzaW9uQ29tcG91bmRTeXN0ZW1JbXBsIiwiX3VwZGF0ZUVhY2hEZXNjZW5kYW50VHJhbnNmb3JtIiwiQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50VHlwZSIsIkNvbGxpc2lvbkNvbXBvbmVudCIsIkRhdGFUeXBlIiwiQ29sbGlzaW9uQ29tcG9uZW50RGF0YSIsInNjaGVtYSIsIm9uIiwib25CZWZvcmVSZW1vdmUiLCJvblJlbW92ZSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiX2RhdGEiLCJwcm9wZXJ0aWVzIiwibGVuIiwiaWR4IiwiaGFzT3duUHJvcGVydHkiLCJpbmRleE9mIiwic3BsaWNlIiwiQXJyYXkiLCJpc0FycmF5IiwiaW1wbCIsIl9jcmVhdGVJbXBsZW1lbnRhdGlvbiIsIkRlYnVnIiwiZXJyb3IiLCJfZ2V0SW1wbGVtZW50YXRpb24iLCJjbG9uZUNvbXBvbmVudCIsInJlbW92ZUNoaWxkU2hhcGUiLCJpbmQiLCJfZ2V0Q29tcG91bmRDaGlsZFNoYXBlSW5kZXgiLCJyZW1vdmVDaGlsZFNoYXBlQnlJbmRleCIsIm9uVHJhbnNmb3JtQ2hhbmdlZCIsImNoYW5nZVR5cGUiLCJwcmV2aW91c1R5cGUiLCJuZXdUeXBlIiwiX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybSIsInJlbGF0aXZlIiwic2V0U2NhbGUiLCJtdWwiLCJnZXRMb2NhbFRyYW5zZm9ybSIsInd0bSIsInNjbCIsInBvcyIsInJvdCIsImdldFRyYW5zbGF0aW9uIiwic2V0RnJvbU1hdDQiLCJnZXRQb3NpdGlvbiIsImdldFJvdGF0aW9uIiwiYnRUcmFuc2Zvcm0iLCJzZXRJZGVudGl0eSIsIm9yaWdpbiIsImdldE9yaWdpbiIsImFtbW9RdWF0IiwiYnRRdWF0ZXJuaW9uIiwidyIsInNldFJvdGF0aW9uIiwia2V5IiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsTUFBTUEsSUFBSSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3ZCLE1BQU1DLElBQUksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN2QixNQUFNQyxJQUFJLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUMsYUFBYSxHQUFHLElBQUlDLFNBQVMsRUFBRSxDQUFBO0FBRXJDLE1BQU1DLE9BQU8sR0FBRyxDQUNaLFNBQVMsRUFDVCxNQUFNLEVBQ04sYUFBYSxFQUNiLFFBQVEsRUFDUixNQUFNLEVBQ04sUUFBUSxFQUNSLE9BQU8sRUFDUCxhQUFhLEVBQ2IsT0FBTyxFQUNQLE9BQU8sRUFDUCxRQUFRLENBQ1gsQ0FBQTs7QUFHRCxNQUFNQyxtQkFBbUIsQ0FBQztFQUN0QkMsV0FBVyxDQUFDQyxNQUFNLEVBQUU7SUFDaEIsSUFBSSxDQUFDQSxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtBQUN4QixHQUFBOztBQUdBQyxFQUFBQSxnQkFBZ0IsQ0FBQ0MsU0FBUyxFQUFFQyxJQUFJLEVBQUU7SUFDOUJBLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUVqQkQsSUFBQUEsSUFBSSxDQUFDRSxLQUFLLEdBQUcsSUFBSUMsS0FBSyxFQUFFLENBQUE7QUFD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
