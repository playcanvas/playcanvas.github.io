/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../math/mat4.js';
import { Quat } from '../../../math/quat.js';
import { Vec3 } from '../../../math/vec3.js';
import { SEMANTIC_POSITION } from '../../../graphics/constants.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY29sbGlzaW9uL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFNFTUFOVElDX1BPU0lUSU9OIH0gZnJvbSAnLi4vLi4vLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vZGVsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuaW1wb3J0IHsgVHJpZ2dlciB9IGZyb20gJy4vdHJpZ2dlci5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IEFwcEJhc2UgKi9cblxuY29uc3QgbWF0NCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2ZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgdGVtcEdyYXBoTm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcblxuY29uc3QgX3NjaGVtYSA9IFtcbiAgICAnZW5hYmxlZCcsXG4gICAgJ3R5cGUnLFxuICAgICdoYWxmRXh0ZW50cycsXG4gICAgJ3JhZGl1cycsXG4gICAgJ2F4aXMnLFxuICAgICdoZWlnaHQnLFxuICAgICdhc3NldCcsXG4gICAgJ3JlbmRlckFzc2V0JyxcbiAgICAnc2hhcGUnLFxuICAgICdtb2RlbCcsXG4gICAgJ3JlbmRlcidcbl07XG5cbi8vIENvbGxpc2lvbiBzeXN0ZW0gaW1wbGVtZW50YXRpb25zXG5jbGFzcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0pIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0gPSBzeXN0ZW07XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIGJlZm9yZSB0aGUgY2FsbCB0byBzeXN0ZW0uc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEgaXMgbWFkZVxuICAgIGJlZm9yZUluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGRhdGEubW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgZGF0YS5tb2RlbC5ncmFwaCA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgYWZ0ZXIgdGhlIGNhbGwgdG8gc3lzdGVtLnN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhIGlzIG1hZGVcbiAgICBhZnRlckluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpO1xuICAgICAgICBjb21wb25lbnQuZGF0YS5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIHdoZW4gYSBjb2xsaXNpb24gY29tcG9uZW50IGNoYW5nZXMgdHlwZSBpbiBvcmRlciB0byByZWNyZWF0ZSBkZWJ1ZyBhbmQgcGh5c2ljYWwgc2hhcGVzXG4gICAgcmVzZXQoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICB0aGlzLmFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFJlLWNyZWF0ZXMgcmlnaWQgYm9kaWVzIC8gdHJpZ2dlcnNcbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSBjb21wb25lbnQuZW50aXR5O1xuICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcmVtb3ZlQ29tcG91bmRDaGlsZChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LCBkYXRhLnNoYXBlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5KVxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgQW1tby5kZXN0cm95KGRhdGEuc2hhcGUpO1xuICAgICAgICAgICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkYXRhLnNoYXBlID0gdGhpcy5jcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudC5lbnRpdHksIGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBmaXJzdENvbXBvdW5kQ2hpbGQgPSAhY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudDtcblxuICAgICAgICAgICAgaWYgKGRhdGEudHlwZSA9PT0gJ2NvbXBvdW5kJyAmJiAoIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgfHwgY29tcG9uZW50ID09PSBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgPSBjb21wb25lbnQ7XG5cbiAgICAgICAgICAgICAgICBlbnRpdHkuZm9yRWFjaCh0aGlzLl9hZGRFYWNoRGVzY2VuZGFudCwgY29tcG9uZW50KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS50eXBlICE9PSAnY29tcG91bmQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgJiYgY29tcG9uZW50ID09PSBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5mb3JFYWNoKHRoaXMuc3lzdGVtLmltcGxlbWVudGF0aW9ucy5jb21wb3VuZC5fdXBkYXRlRWFjaERlc2NlbmRhbnQsIGNvbXBvbmVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnQucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50ID0gZW50aXR5LnBhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudC5jb2xsaXNpb24gJiYgcGFyZW50LmNvbGxpc2lvbi50eXBlID09PSAnY29tcG91bmQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IHBhcmVudC5jb2xsaXNpb247XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQgIT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpcnN0Q29tcG91bmRDaGlsZCAmJiBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LnNoYXBlLmdldE51bUNoaWxkU2hhcGVzKCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS51cGRhdGVDb21wb3VuZENoaWxkVHJhbnNmb3JtKGVudGl0eSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbnRpdHkucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuY3JlYXRlQm9keSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5lbmFibGVkICYmIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlciA9IG5ldyBUcmlnZ2VyKHRoaXMuc3lzdGVtLmFwcCwgY29tcG9uZW50LCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5pbml0aWFsaXplKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZXMgYSBwaHlzaWNhbCBzaGFwZSBmb3IgdGhlIGNvbGxpc2lvbi4gVGhpcyBjb25zaXN0c1xuICAgIC8vIG9mIHRoZSBhY3R1YWwgc2hhcGUgdGhhdCB3aWxsIGJlIHVzZWQgZm9yIHRoZSByaWdpZCBib2RpZXMgLyB0cmlnZ2VycyBvZlxuICAgIC8vIHRoZSBjb2xsaXNpb24uXG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB1cGRhdGVUcmFuc2Zvcm0oY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5lbnRpdHkudHJpZ2dlci51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoY29tcG9uZW50LmRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50ICYmICFjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5fZGVzdHJveWluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9yZW1vdmVDb21wb3VuZENoaWxkKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQsIGNvbXBvbmVudC5kYXRhLnNoYXBlKTtcblxuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50ID0gbnVsbDtcblxuICAgICAgICAgICAgQW1tby5kZXN0cm95KGNvbXBvbmVudC5kYXRhLnNoYXBlKTtcbiAgICAgICAgICAgIGNvbXBvbmVudC5kYXRhLnNoYXBlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENhbGxlZCB3aGVuIHRoZSBjb2xsaXNpb24gaXMgcmVtb3ZlZFxuICAgIHJlbW92ZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkgJiYgZW50aXR5LnJpZ2lkYm9keS5ib2R5KSB7XG4gICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENhbGxlZCB3aGVuIHRoZSBjb2xsaXNpb24gaXMgY2xvbmVkIHRvIGFub3RoZXIgZW50aXR5XG4gICAgY2xvbmUoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICBjb25zdCBzcmMgPSB0aGlzLnN5c3RlbS5zdG9yZVtlbnRpdHkuZ2V0R3VpZCgpXTtcblxuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgZW5hYmxlZDogc3JjLmRhdGEuZW5hYmxlZCxcbiAgICAgICAgICAgIHR5cGU6IHNyYy5kYXRhLnR5cGUsXG4gICAgICAgICAgICBoYWxmRXh0ZW50czogW3NyYy5kYXRhLmhhbGZFeHRlbnRzLngsIHNyYy5kYXRhLmhhbGZFeHRlbnRzLnksIHNyYy5kYXRhLmhhbGZFeHRlbnRzLnpdLFxuICAgICAgICAgICAgcmFkaXVzOiBzcmMuZGF0YS5yYWRpdXMsXG4gICAgICAgICAgICBheGlzOiBzcmMuZGF0YS5heGlzLFxuICAgICAgICAgICAgaGVpZ2h0OiBzcmMuZGF0YS5oZWlnaHQsXG4gICAgICAgICAgICBhc3NldDogc3JjLmRhdGEuYXNzZXQsXG4gICAgICAgICAgICByZW5kZXJBc3NldDogc3JjLmRhdGEucmVuZGVyQXNzZXQsXG4gICAgICAgICAgICBtb2RlbDogc3JjLmRhdGEubW9kZWwsXG4gICAgICAgICAgICByZW5kZXI6IHNyYy5kYXRhLnJlbmRlclxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnN5c3RlbS5hZGRDb21wb25lbnQoY2xvbmUsIGRhdGEpO1xuICAgIH1cbn1cblxuLy8gQm94IENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkJveFN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBoZSA9IGRhdGEuaGFsZkV4dGVudHM7XG4gICAgICAgICAgICBjb25zdCBhbW1vSGUgPSBuZXcgQW1tby5idFZlY3RvcjMoaGUgPyBoZS54IDogMC41LCBoZSA/IGhlLnkgOiAwLjUsIGhlID8gaGUueiA6IDAuNSk7XG4gICAgICAgICAgICBjb25zdCBzaGFwZSA9IG5ldyBBbW1vLmJ0Qm94U2hhcGUoYW1tb0hlKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShhbW1vSGUpO1xuICAgICAgICAgICAgcmV0dXJuIHNoYXBlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vLyBTcGhlcmUgQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uU3BoZXJlU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQW1tby5idFNwaGVyZVNoYXBlKGRhdGEucmFkaXVzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuLy8gQ2Fwc3VsZSBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25DYXBzdWxlU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSAoZGF0YS5heGlzICE9PSB1bmRlZmluZWQpID8gZGF0YS5heGlzIDogMTtcbiAgICAgICAgY29uc3QgcmFkaXVzID0gZGF0YS5yYWRpdXMgfHwgMC41O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLm1heCgoZGF0YS5oZWlnaHQgfHwgMikgLSAyICogcmFkaXVzLCAwKTtcblxuICAgICAgICBsZXQgc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoYXhpcykge1xuICAgICAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENhcHN1bGVTaGFwZVgocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDYXBzdWxlU2hhcGUocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDYXBzdWxlU2hhcGVaKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgfVxufVxuXG4vLyBDeWxpbmRlciBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25DeWxpbmRlclN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBjb25zdCBheGlzID0gKGRhdGEuYXhpcyAhPT0gdW5kZWZpbmVkKSA/IGRhdGEuYXhpcyA6IDE7XG4gICAgICAgIGNvbnN0IHJhZGl1cyA9IChkYXRhLnJhZGl1cyAhPT0gdW5kZWZpbmVkKSA/IGRhdGEucmFkaXVzIDogMC41O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSAoZGF0YS5oZWlnaHQgIT09IHVuZGVmaW5lZCkgPyBkYXRhLmhlaWdodCA6IDE7XG5cbiAgICAgICAgbGV0IGhhbGZFeHRlbnRzID0gbnVsbDtcbiAgICAgICAgbGV0IHNoYXBlID0gbnVsbDtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGF4aXMpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgIGhhbGZFeHRlbnRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKGhlaWdodCAqIDAuNSwgcmFkaXVzLCByYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q3lsaW5kZXJTaGFwZVgoaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIGhhbGZFeHRlbnRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKHJhZGl1cywgaGVpZ2h0ICogMC41LCByYWRpdXMpO1xuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q3lsaW5kZXJTaGFwZShoYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgaGFsZkV4dGVudHMgPSBuZXcgQW1tby5idFZlY3RvcjMocmFkaXVzLCByYWRpdXMsIGhlaWdodCAqIDAuNSk7XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDeWxpbmRlclNoYXBlWihoYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhbGZFeHRlbnRzKVxuICAgICAgICAgICAgQW1tby5kZXN0cm95KGhhbGZFeHRlbnRzKTtcblxuICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgfVxufVxuXG4vLyBDb25lIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkNvbmVTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgY29uc3QgYXhpcyA9IChkYXRhLmF4aXMgIT09IHVuZGVmaW5lZCkgPyBkYXRhLmF4aXMgOiAxO1xuICAgICAgICBjb25zdCByYWRpdXMgPSAoZGF0YS5yYWRpdXMgIT09IHVuZGVmaW5lZCkgPyBkYXRhLnJhZGl1cyA6IDAuNTtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gKGRhdGEuaGVpZ2h0ICE9PSB1bmRlZmluZWQpID8gZGF0YS5oZWlnaHQgOiAxO1xuXG4gICAgICAgIGxldCBzaGFwZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgc3dpdGNoIChheGlzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q29uZVNoYXBlWChyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENvbmVTaGFwZShyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENvbmVTaGFwZVoocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzaGFwZTtcbiAgICB9XG59XG5cbi8vIE1lc2ggQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICAvLyBvdmVycmlkZSBmb3IgdGhlIG1lc2ggaW1wbGVtZW50YXRpb24gYmVjYXVzZSB0aGUgYXNzZXQgbW9kZWwgbmVlZHNcbiAgICAvLyBzcGVjaWFsIGhhbmRsaW5nXG4gICAgYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpIHt9XG5cbiAgICBjcmVhdGVBbW1vTWVzaChtZXNoLCBub2RlLCBzaGFwZSkge1xuICAgICAgICBsZXQgdHJpTWVzaDtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uX3RyaU1lc2hDYWNoZVttZXNoLmlkXSkge1xuICAgICAgICAgICAgdHJpTWVzaCA9IHRoaXMuc3lzdGVtLl90cmlNZXNoQ2FjaGVbbWVzaC5pZF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB2YiA9IG1lc2gudmVydGV4QnVmZmVyO1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXQgPSB2Yi5nZXRGb3JtYXQoKTtcbiAgICAgICAgICAgIGxldCBzdHJpZGU7XG4gICAgICAgICAgICBsZXQgcG9zaXRpb25zO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmb3JtYXQuZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1BPU0lUSU9OKSB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9ucyA9IG5ldyBGbG9hdDMyQXJyYXkodmIubG9jaygpLCBlbGVtZW50Lm9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIHN0cmlkZSA9IGVsZW1lbnQuc3RyaWRlIC8gNDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gW107XG4gICAgICAgICAgICBtZXNoLmdldEluZGljZXMoaW5kaWNlcyk7XG4gICAgICAgICAgICBjb25zdCBudW1UcmlhbmdsZXMgPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCAvIDM7XG5cbiAgICAgICAgICAgIGNvbnN0IHYxID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBjb25zdCB2MiA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgY29uc3QgdjMgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGxldCBpMSwgaTIsIGkzO1xuXG4gICAgICAgICAgICBjb25zdCBiYXNlID0gbWVzaC5wcmltaXRpdmVbMF0uYmFzZTtcbiAgICAgICAgICAgIHRyaU1lc2ggPSBuZXcgQW1tby5idFRyaWFuZ2xlTWVzaCgpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3RyaU1lc2hDYWNoZVttZXNoLmlkXSA9IHRyaU1lc2g7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVHJpYW5nbGVzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpMSA9IGluZGljZXNbYmFzZSArIGkgKiAzXSAqIHN0cmlkZTtcbiAgICAgICAgICAgICAgICBpMiA9IGluZGljZXNbYmFzZSArIGkgKiAzICsgMV0gKiBzdHJpZGU7XG4gICAgICAgICAgICAgICAgaTMgPSBpbmRpY2VzW2Jhc2UgKyBpICogMyArIDJdICogc3RyaWRlO1xuICAgICAgICAgICAgICAgIHYxLnNldFZhbHVlKHBvc2l0aW9uc1tpMV0sIHBvc2l0aW9uc1tpMSArIDFdLCBwb3NpdGlvbnNbaTEgKyAyXSk7XG4gICAgICAgICAgICAgICAgdjIuc2V0VmFsdWUocG9zaXRpb25zW2kyXSwgcG9zaXRpb25zW2kyICsgMV0sIHBvc2l0aW9uc1tpMiArIDJdKTtcbiAgICAgICAgICAgICAgICB2My5zZXRWYWx1ZShwb3NpdGlvbnNbaTNdLCBwb3NpdGlvbnNbaTMgKyAxXSwgcG9zaXRpb25zW2kzICsgMl0pO1xuICAgICAgICAgICAgICAgIHRyaU1lc2guYWRkVHJpYW5nbGUodjEsIHYyLCB2MywgdHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh2MSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodjIpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHYzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbiA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRyaU1lc2hTaGFwZSA9IG5ldyBBbW1vLmJ0QnZoVHJpYW5nbGVNZXNoU2hhcGUodHJpTWVzaCwgdXNlUXVhbnRpemVkQWFiYkNvbXByZXNzaW9uKTtcblxuICAgICAgICBjb25zdCBzY2FsaW5nID0gdGhpcy5zeXN0ZW0uX2dldE5vZGVTY2FsaW5nKG5vZGUpO1xuICAgICAgICB0cmlNZXNoU2hhcGUuc2V0TG9jYWxTY2FsaW5nKHNjYWxpbmcpO1xuICAgICAgICBBbW1vLmRlc3Ryb3koc2NhbGluZyk7XG5cbiAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gdGhpcy5zeXN0ZW0uX2dldE5vZGVUcmFuc2Zvcm0obm9kZSk7XG4gICAgICAgIHNoYXBlLmFkZENoaWxkU2hhcGUodHJhbnNmb3JtLCB0cmlNZXNoU2hhcGUpO1xuICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcbiAgICB9XG5cbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChkYXRhLm1vZGVsIHx8IGRhdGEucmVuZGVyKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYXBlID0gbmV3IEFtbW8uYnRDb21wb3VuZFNoYXBlKCk7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm1vZGVsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGRhdGEubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVBbW1vTWVzaChtZXNoSW5zdGFuY2VzW2ldLm1lc2gsIG1lc2hJbnN0YW5jZXNbaV0ubm9kZSwgc2hhcGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5yZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoZXMgPSBkYXRhLnJlbmRlci5tZXNoZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVBbW1vTWVzaChtZXNoZXNbaV0sIHRlbXBHcmFwaE5vZGUsIHNoYXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVRyYW5zZm9ybSA9IGVudGl0eS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgY29uc3Qgc2NhbGUgPSBlbnRpdHlUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHZlYyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhzY2FsZS54LCBzY2FsZS55LCBzY2FsZS56KTtcbiAgICAgICAgICAgIHNoYXBlLnNldExvY2FsU2NhbGluZyh2ZWMpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHZlYyk7XG5cbiAgICAgICAgICAgIHJldHVybiBzaGFwZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNvbXBvbmVudC5kYXRhO1xuXG4gICAgICAgIGlmIChkYXRhLnJlbmRlckFzc2V0IHx8IGRhdGEuYXNzZXQpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuZW5hYmxlZCAmJiBjb21wb25lbnQuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRBc3NldChcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnJlbmRlckFzc2V0IHx8IGRhdGEuYXNzZXQsXG4gICAgICAgICAgICAgICAgICAgIGRhdGEucmVuZGVyQXNzZXQgPyAncmVuZGVyJyA6ICdtb2RlbCdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBsb2FkQXNzZXQoY29tcG9uZW50LCBpZCwgcHJvcGVydHkpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNvbXBvbmVudC5kYXRhO1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChpZCk7XG4gICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgYXNzZXQucmVhZHkoKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB0aGlzLmRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFzc2V0cy5vbmNlKCdhZGQ6JyArIGlkLCAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBhc3NldC5yZWFkeSgoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IGNvbXBvbmVudC5lbnRpdHk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBjb21wb25lbnQuZGF0YTtcblxuICAgICAgICBpZiAoZGF0YS5tb2RlbCB8fCBkYXRhLnJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95U2hhcGUoZGF0YSk7XG5cbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSB0aGlzLmNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5jcmVhdGVCb2R5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmVuYWJsZWQgJiYgZW50aXR5LnJpZ2lkYm9keS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlciA9IG5ldyBUcmlnZ2VyKHRoaXMuc3lzdGVtLmFwcCwgY29tcG9uZW50LCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5pbml0aWFsaXplKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVudGl0eSwgZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVUcmFuc2Zvcm0oY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuc2hhcGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVRyYW5zZm9ybSA9IGNvbXBvbmVudC5lbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIGNvbnN0IHdvcmxkU2NhbGUgPSBlbnRpdHlUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHNjYWxlIGNoYW5nZWQgdGhlbiByZWNyZWF0ZSB0aGUgc2hhcGVcbiAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzU2NhbGUgPSBjb21wb25lbnQuc2hhcGUuZ2V0TG9jYWxTY2FsaW5nKCk7XG4gICAgICAgICAgICBpZiAod29ybGRTY2FsZS54ICE9PSBwcmV2aW91c1NjYWxlLngoKSB8fFxuICAgICAgICAgICAgICAgIHdvcmxkU2NhbGUueSAhPT0gcHJldmlvdXNTY2FsZS55KCkgfHxcbiAgICAgICAgICAgICAgICB3b3JsZFNjYWxlLnogIT09IHByZXZpb3VzU2NhbGUueigpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3VwZXIudXBkYXRlVHJhbnNmb3JtKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSk7XG4gICAgfVxuXG4gICAgZGVzdHJveVNoYXBlKGRhdGEpIHtcbiAgICAgICAgaWYgKCFkYXRhLnNoYXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG51bVNoYXBlcyA9IGRhdGEuc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TaGFwZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2hhcGUgPSBkYXRhLnNoYXBlLmdldENoaWxkU2hhcGUoaSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3koc2hhcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KGRhdGEuc2hhcGUpO1xuICAgICAgICBkYXRhLnNoYXBlID0gbnVsbDtcbiAgICB9XG5cbiAgICByZW1vdmUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuZGVzdHJveVNoYXBlKGRhdGEpO1xuICAgICAgICBzdXBlci5yZW1vdmUoZW50aXR5LCBkYXRhKTtcbiAgICB9XG59XG5cbi8vIENvbXBvdW5kIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkNvbXBvdW5kU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQW1tby5idENvbXBvdW5kU2hhcGUoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIF9hZGRFYWNoRGVzY2VuZGFudChlbnRpdHkpIHtcbiAgICAgICAgaWYgKCFlbnRpdHkuY29sbGlzaW9uIHx8IGVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQgPSB0aGlzO1xuXG4gICAgICAgIGlmIChlbnRpdHkgIT09IHRoaXMuZW50aXR5KSB7XG4gICAgICAgICAgICBlbnRpdHkuY29sbGlzaW9uLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUVhY2hEZXNjZW5kYW50KGVudGl0eSkge1xuICAgICAgICBpZiAoIWVudGl0eS5jb2xsaXNpb24pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ICE9PSB0aGlzKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ID0gbnVsbDtcblxuICAgICAgICBpZiAoZW50aXR5ICE9PSB0aGlzLmVudGl0eSAmJiAhZW50aXR5LnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhlbnRpdHkuY29sbGlzaW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVFYWNoRGVzY2VuZGFudFRyYW5zZm9ybShlbnRpdHkpIHtcbiAgICAgICAgaWYgKCFlbnRpdHkuY29sbGlzaW9uIHx8IGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ICE9PSB0aGlzLmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb24uc3lzdGVtLnVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0oZW50aXR5KTtcbiAgICB9XG59XG5cbi8qKlxuICogTWFuYWdlcyBjcmVhdGlvbiBvZiB7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50fXMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICovXG5jbGFzcyBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnY29sbGlzaW9uJztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBDb2xsaXNpb25Db21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBDb2xsaXNpb25Db21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hID0gX3NjaGVtYTtcblxuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9ucyA9IHsgfTtcblxuICAgICAgICB0aGlzLl90cmlNZXNoQ2FjaGUgPSB7IH07XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgX2RhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgcHJvcGVydGllcyA9IFtcbiAgICAgICAgICAgICd0eXBlJyxcbiAgICAgICAgICAgICdoYWxmRXh0ZW50cycsXG4gICAgICAgICAgICAncmFkaXVzJyxcbiAgICAgICAgICAgICdheGlzJyxcbiAgICAgICAgICAgICdoZWlnaHQnLFxuICAgICAgICAgICAgJ3NoYXBlJyxcbiAgICAgICAgICAgICdtb2RlbCcsXG4gICAgICAgICAgICAnYXNzZXQnLFxuICAgICAgICAgICAgJ3JlbmRlcicsXG4gICAgICAgICAgICAncmVuZGVyQXNzZXQnLFxuICAgICAgICAgICAgJ2VuYWJsZWQnXG4gICAgICAgIF07XG5cbiAgICAgICAgLy8gZHVwbGljYXRlIHRoZSBpbnB1dCBkYXRhIGJlY2F1c2Ugd2UgYXJlIG1vZGlmeWluZyBpdFxuICAgICAgICBjb25zdCBkYXRhID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wZXJ0aWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IHByb3BlcnRpZXNbaV07XG4gICAgICAgICAgICBkYXRhW3Byb3BlcnR5XSA9IF9kYXRhW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2V0IHRha2VzIHByaW9yaXR5IG92ZXIgbW9kZWxcbiAgICAgICAgLy8gYnV0IHRoZXkgYXJlIGJvdGggdHJ5aW5nIHRvIGNoYW5nZSB0aGUgbWVzaFxuICAgICAgICAvLyBzbyByZW1vdmUgb25lIG9mIHRoZW0gdG8gYXZvaWQgY29uZmxpY3RzXG4gICAgICAgIGxldCBpZHg7XG4gICAgICAgIGlmIChfZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXNzZXQnKSkge1xuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdtb2RlbCcpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdyZW5kZXInKTtcbiAgICAgICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChfZGF0YS5oYXNPd25Qcm9wZXJ0eSgnbW9kZWwnKSkge1xuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdhc3NldCcpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkYXRhLnR5cGUpIHtcbiAgICAgICAgICAgIGRhdGEudHlwZSA9IGNvbXBvbmVudC5kYXRhLnR5cGU7XG4gICAgICAgIH1cbiAgICAgICAgY29tcG9uZW50LmRhdGEudHlwZSA9IGRhdGEudHlwZTtcblxuICAgICAgICBpZiAoZGF0YS5oYWxmRXh0ZW50cyAmJiBBcnJheS5pc0FycmF5KGRhdGEuaGFsZkV4dGVudHMpKSB7XG4gICAgICAgICAgICBkYXRhLmhhbGZFeHRlbnRzID0gbmV3IFZlYzMoZGF0YS5oYWxmRXh0ZW50c1swXSwgZGF0YS5oYWxmRXh0ZW50c1sxXSwgZGF0YS5oYWxmRXh0ZW50c1syXSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbXBsID0gdGhpcy5fY3JlYXRlSW1wbGVtZW50YXRpb24oZGF0YS50eXBlKTtcbiAgICAgICAgaW1wbC5iZWZvcmVJbml0aWFsaXplKGNvbXBvbmVudCwgZGF0YSk7XG5cbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKTtcblxuICAgICAgICBpbXBsLmFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZXMgYW4gaW1wbGVtZW50YXRpb24gYmFzZWQgb24gdGhlIGNvbGxpc2lvbiB0eXBlIGFuZCBjYWNoZXMgaXRcbiAgICAvLyBpbiBhbiBpbnRlcm5hbCBpbXBsZW1lbnRhdGlvbnMgc3RydWN0dXJlLCBiZWZvcmUgcmV0dXJuaW5nIGl0LlxuICAgIF9jcmVhdGVJbXBsZW1lbnRhdGlvbih0eXBlKSB7XG4gICAgICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uc1t0eXBlXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZXQgaW1wbDtcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2JveCc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQm94U3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3BoZXJlJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjYXBzdWxlJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25DYXBzdWxlU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY3lsaW5kZXInOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbkN5bGluZGVyU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY29uZSc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ29uZVN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ21lc2gnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbk1lc2hTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wb3VuZCc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ29tcG91bmRTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgX2NyZWF0ZUltcGxlbWVudGF0aW9uOiBJbnZhbGlkIGNvbGxpc2lvbiBzeXN0ZW0gdHlwZTogJHt0eXBlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbdHlwZV0gPSBpbXBsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb25zW3R5cGVdO1xuICAgIH1cblxuICAgIC8vIEdldHMgYW4gZXhpc3RpbmcgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgZW50aXR5XG4gICAgX2dldEltcGxlbWVudGF0aW9uKGVudGl0eSkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbnNbZW50aXR5LmNvbGxpc2lvbi5kYXRhLnR5cGVdO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEltcGxlbWVudGF0aW9uKGVudGl0eSkuY2xvbmUoZW50aXR5LCBjbG9uZSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbY29tcG9uZW50LmRhdGEudHlwZV0uYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgICAgY29tcG9uZW50Lm9uQmVmb3JlUmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW2RhdGEudHlwZV0ucmVtb3ZlKGVudGl0eSwgZGF0YSk7XG4gICAgfVxuXG4gICAgdXBkYXRlQ29tcG91bmRDaGlsZFRyYW5zZm9ybShlbnRpdHkpIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyB1c2UgdXBkYXRlQ2hpbGRUcmFuc2Zvcm0gb25jZSBpdCBpcyBleHBvc2VkIGluIGFtbW8uanNcblxuICAgICAgICB0aGlzLl9yZW1vdmVDb21wb3VuZENoaWxkKGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50LCBlbnRpdHkuY29sbGlzaW9uLmRhdGEuc2hhcGUpO1xuXG4gICAgICAgIGlmIChlbnRpdHkuZW5hYmxlZCAmJiBlbnRpdHkuY29sbGlzaW9uLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybSA9IHRoaXMuX2dldE5vZGVUcmFuc2Zvcm0oZW50aXR5LCBlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudC5lbnRpdHkpO1xuICAgICAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQuc2hhcGUuYWRkQ2hpbGRTaGFwZSh0cmFuc2Zvcm0sIGVudGl0eS5jb2xsaXNpb24uZGF0YS5zaGFwZSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW1vdmVDb21wb3VuZENoaWxkKGNvbGxpc2lvbiwgc2hhcGUpIHtcbiAgICAgICAgaWYgKGNvbGxpc2lvbi5zaGFwZS5yZW1vdmVDaGlsZFNoYXBlKSB7XG4gICAgICAgICAgICBjb2xsaXNpb24uc2hhcGUucmVtb3ZlQ2hpbGRTaGFwZShzaGFwZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBpbmQgPSBjb2xsaXNpb24uX2dldENvbXBvdW5kQ2hpbGRTaGFwZUluZGV4KHNoYXBlKTtcbiAgICAgICAgICAgIGlmIChpbmQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb2xsaXNpb24uc2hhcGUucmVtb3ZlQ2hpbGRTaGFwZUJ5SW5kZXgoaW5kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uVHJhbnNmb3JtQ2hhbmdlZChjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbY29tcG9uZW50LmRhdGEudHlwZV0udXBkYXRlVHJhbnNmb3JtKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSk7XG4gICAgfVxuXG4gICAgLy8gRGVzdHJveXMgdGhlIHByZXZpb3VzIGNvbGxpc2lvbiB0eXBlIGFuZCBjcmVhdGVzIGEgbmV3IG9uZSBiYXNlZCBvbiB0aGUgbmV3IHR5cGUgcHJvdmlkZWRcbiAgICBjaGFuZ2VUeXBlKGNvbXBvbmVudCwgcHJldmlvdXNUeXBlLCBuZXdUeXBlKSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW3ByZXZpb3VzVHlwZV0uYmVmb3JlUmVtb3ZlKGNvbXBvbmVudC5lbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW3ByZXZpb3VzVHlwZV0ucmVtb3ZlKGNvbXBvbmVudC5lbnRpdHksIGNvbXBvbmVudC5kYXRhKTtcbiAgICAgICAgdGhpcy5fY3JlYXRlSW1wbGVtZW50YXRpb24obmV3VHlwZSkucmVzZXQoY29tcG9uZW50LCBjb21wb25lbnQuZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gUmVjcmVhdGVzIHJpZ2lkIGJvZGllcyBvciB0cmlnZ2VycyBmb3IgdGhlIHNwZWNpZmllZCBjb21wb25lbnRcbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1tjb21wb25lbnQuZGF0YS50eXBlXS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybShub2RlLCByZWxhdGl2ZSkge1xuICAgICAgICBpZiAobm9kZSA9PT0gcmVsYXRpdmUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFNjYWxlKCk7XG4gICAgICAgICAgICBtYXQ0LnNldFNjYWxlKHNjYWxlLngsIHNjYWxlLnksIHNjYWxlLnopO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlTm9kZVJlbGF0aXZlVHJhbnNmb3JtKG5vZGUucGFyZW50LCByZWxhdGl2ZSk7XG4gICAgICAgICAgICBtYXQ0Lm11bChub2RlLmdldExvY2FsVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2dldE5vZGVTY2FsaW5nKG5vZGUpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICBjb25zdCBzY2wgPSB3dG0uZ2V0U2NhbGUoKTtcbiAgICAgICAgcmV0dXJuIG5ldyBBbW1vLmJ0VmVjdG9yMyhzY2wueCwgc2NsLnksIHNjbC56KTtcbiAgICB9XG5cbiAgICBfZ2V0Tm9kZVRyYW5zZm9ybShub2RlLCByZWxhdGl2ZSkge1xuICAgICAgICBsZXQgcG9zLCByb3Q7XG5cbiAgICAgICAgaWYgKHJlbGF0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVOb2RlUmVsYXRpdmVUcmFuc2Zvcm0obm9kZSwgcmVsYXRpdmUpO1xuXG4gICAgICAgICAgICBwb3MgPSB2ZWMzO1xuICAgICAgICAgICAgcm90ID0gcXVhdDtcblxuICAgICAgICAgICAgbWF0NC5nZXRUcmFuc2xhdGlvbihwb3MpO1xuICAgICAgICAgICAgcm90LnNldEZyb21NYXQ0KG1hdDQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zID0gbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgcm90ID0gbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gbmV3IEFtbW8uYnRUcmFuc2Zvcm0oKTtcbiAgICAgICAgdHJhbnNmb3JtLnNldElkZW50aXR5KCk7XG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IHRyYW5zZm9ybS5nZXRPcmlnaW4oKTtcbiAgICAgICAgb3JpZ2luLnNldFZhbHVlKHBvcy54LCBwb3MueSwgcG9zLnopO1xuXG4gICAgICAgIGNvbnN0IGFtbW9RdWF0ID0gbmV3IEFtbW8uYnRRdWF0ZXJuaW9uKCk7XG4gICAgICAgIGFtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcbiAgICAgICAgdHJhbnNmb3JtLnNldFJvdGF0aW9uKGFtbW9RdWF0KTtcbiAgICAgICAgQW1tby5kZXN0cm95KGFtbW9RdWF0KTtcbiAgICAgICAgQW1tby5kZXN0cm95KG9yaWdpbik7XG5cbiAgICAgICAgcmV0dXJuIHRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl90cmlNZXNoQ2FjaGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLl90cmlNZXNoQ2FjaGVba2V5XSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90cmlNZXNoQ2FjaGUgPSBudWxsO1xuXG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoQ29sbGlzaW9uQ29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIm1hdDQiLCJNYXQ0IiwidmVjMyIsIlZlYzMiLCJxdWF0IiwiUXVhdCIsInRlbXBHcmFwaE5vZGUiLCJHcmFwaE5vZGUiLCJfc2NoZW1hIiwiQ29sbGlzaW9uU3lzdGVtSW1wbCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiYmVmb3JlSW5pdGlhbGl6ZSIsImNvbXBvbmVudCIsImRhdGEiLCJzaGFwZSIsIm1vZGVsIiwiTW9kZWwiLCJncmFwaCIsImFmdGVySW5pdGlhbGl6ZSIsInJlY3JlYXRlUGh5c2ljYWxTaGFwZXMiLCJpbml0aWFsaXplZCIsInJlc2V0IiwiZW50aXR5IiwiQW1tbyIsInRyaWdnZXIiLCJkZXN0cm95IiwiX2NvbXBvdW5kUGFyZW50IiwiX3JlbW92ZUNvbXBvdW5kQ2hpbGQiLCJyaWdpZGJvZHkiLCJhY3RpdmF0ZSIsImNyZWF0ZVBoeXNpY2FsU2hhcGUiLCJmaXJzdENvbXBvdW5kQ2hpbGQiLCJ0eXBlIiwiZm9yRWFjaCIsIl9hZGRFYWNoRGVzY2VuZGFudCIsImltcGxlbWVudGF0aW9ucyIsImNvbXBvdW5kIiwiX3VwZGF0ZUVhY2hEZXNjZW5kYW50IiwicGFyZW50IiwiY29sbGlzaW9uIiwiZ2V0TnVtQ2hpbGRTaGFwZXMiLCJ1cGRhdGVDb21wb3VuZENoaWxkVHJhbnNmb3JtIiwiZGlzYWJsZVNpbXVsYXRpb24iLCJjcmVhdGVCb2R5IiwiZW5hYmxlZCIsImVuYWJsZVNpbXVsYXRpb24iLCJUcmlnZ2VyIiwiYXBwIiwiaW5pdGlhbGl6ZSIsInVuZGVmaW5lZCIsInVwZGF0ZVRyYW5zZm9ybSIsInBvc2l0aW9uIiwicm90YXRpb24iLCJzY2FsZSIsImJlZm9yZVJlbW92ZSIsIl9kZXN0cm95aW5nIiwicmVtb3ZlIiwiYm9keSIsImNsb25lIiwic3JjIiwic3RvcmUiLCJnZXRHdWlkIiwiaGFsZkV4dGVudHMiLCJ4IiwieSIsInoiLCJyYWRpdXMiLCJheGlzIiwiaGVpZ2h0IiwiYXNzZXQiLCJyZW5kZXJBc3NldCIsInJlbmRlciIsImFkZENvbXBvbmVudCIsIkNvbGxpc2lvbkJveFN5c3RlbUltcGwiLCJoZSIsImFtbW9IZSIsImJ0VmVjdG9yMyIsImJ0Qm94U2hhcGUiLCJDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsIiwiYnRTcGhlcmVTaGFwZSIsIkNvbGxpc2lvbkNhcHN1bGVTeXN0ZW1JbXBsIiwiTWF0aCIsIm1heCIsImJ0Q2Fwc3VsZVNoYXBlWCIsImJ0Q2Fwc3VsZVNoYXBlIiwiYnRDYXBzdWxlU2hhcGVaIiwiQ29sbGlzaW9uQ3lsaW5kZXJTeXN0ZW1JbXBsIiwiYnRDeWxpbmRlclNoYXBlWCIsImJ0Q3lsaW5kZXJTaGFwZSIsImJ0Q3lsaW5kZXJTaGFwZVoiLCJDb2xsaXNpb25Db25lU3lzdGVtSW1wbCIsImJ0Q29uZVNoYXBlWCIsImJ0Q29uZVNoYXBlIiwiYnRDb25lU2hhcGVaIiwiQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwiLCJjcmVhdGVBbW1vTWVzaCIsIm1lc2giLCJub2RlIiwidHJpTWVzaCIsIl90cmlNZXNoQ2FjaGUiLCJpZCIsInZiIiwidmVydGV4QnVmZmVyIiwiZm9ybWF0IiwiZ2V0Rm9ybWF0Iiwic3RyaWRlIiwicG9zaXRpb25zIiwiaSIsImVsZW1lbnRzIiwibGVuZ3RoIiwiZWxlbWVudCIsIm5hbWUiLCJTRU1BTlRJQ19QT1NJVElPTiIsIkZsb2F0MzJBcnJheSIsImxvY2siLCJvZmZzZXQiLCJpbmRpY2VzIiwiZ2V0SW5kaWNlcyIsIm51bVRyaWFuZ2xlcyIsInByaW1pdGl2ZSIsImNvdW50IiwidjEiLCJ2MiIsInYzIiwiaTEiLCJpMiIsImkzIiwiYmFzZSIsImJ0VHJpYW5nbGVNZXNoIiwic2V0VmFsdWUiLCJhZGRUcmlhbmdsZSIsInVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbiIsInRyaU1lc2hTaGFwZSIsImJ0QnZoVHJpYW5nbGVNZXNoU2hhcGUiLCJzY2FsaW5nIiwiX2dldE5vZGVTY2FsaW5nIiwic2V0TG9jYWxTY2FsaW5nIiwidHJhbnNmb3JtIiwiX2dldE5vZGVUcmFuc2Zvcm0iLCJhZGRDaGlsZFNoYXBlIiwiYnRDb21wb3VuZFNoYXBlIiwibWVzaEluc3RhbmNlcyIsIm1lc2hlcyIsImVudGl0eVRyYW5zZm9ybSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0U2NhbGUiLCJ2ZWMiLCJsb2FkQXNzZXQiLCJkb1JlY3JlYXRlUGh5c2ljYWxTaGFwZSIsInByb3BlcnR5IiwiYXNzZXRzIiwiZ2V0IiwicmVhZHkiLCJyZXNvdXJjZSIsImxvYWQiLCJvbmNlIiwiZGVzdHJveVNoYXBlIiwid29ybGRTY2FsZSIsInByZXZpb3VzU2NhbGUiLCJnZXRMb2NhbFNjYWxpbmciLCJudW1TaGFwZXMiLCJnZXRDaGlsZFNoYXBlIiwiQ29sbGlzaW9uQ29tcG91bmRTeXN0ZW1JbXBsIiwiX3VwZGF0ZUVhY2hEZXNjZW5kYW50VHJhbnNmb3JtIiwiQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50VHlwZSIsIkNvbGxpc2lvbkNvbXBvbmVudCIsIkRhdGFUeXBlIiwiQ29sbGlzaW9uQ29tcG9uZW50RGF0YSIsInNjaGVtYSIsIm9uIiwib25CZWZvcmVSZW1vdmUiLCJvblJlbW92ZSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiX2RhdGEiLCJwcm9wZXJ0aWVzIiwibGVuIiwiaWR4IiwiaGFzT3duUHJvcGVydHkiLCJpbmRleE9mIiwic3BsaWNlIiwiQXJyYXkiLCJpc0FycmF5IiwiaW1wbCIsIl9jcmVhdGVJbXBsZW1lbnRhdGlvbiIsIkRlYnVnIiwiZXJyb3IiLCJfZ2V0SW1wbGVtZW50YXRpb24iLCJjbG9uZUNvbXBvbmVudCIsInJlbW92ZUNoaWxkU2hhcGUiLCJpbmQiLCJfZ2V0Q29tcG91bmRDaGlsZFNoYXBlSW5kZXgiLCJyZW1vdmVDaGlsZFNoYXBlQnlJbmRleCIsIm9uVHJhbnNmb3JtQ2hhbmdlZCIsImNoYW5nZVR5cGUiLCJwcmV2aW91c1R5cGUiLCJuZXdUeXBlIiwiX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybSIsInJlbGF0aXZlIiwic2V0U2NhbGUiLCJtdWwiLCJnZXRMb2NhbFRyYW5zZm9ybSIsInd0bSIsInNjbCIsInBvcyIsInJvdCIsImdldFRyYW5zbGF0aW9uIiwic2V0RnJvbU1hdDQiLCJnZXRQb3NpdGlvbiIsImdldFJvdGF0aW9uIiwiYnRUcmFuc2Zvcm0iLCJzZXRJZGVudGl0eSIsIm9yaWdpbiIsImdldE9yaWdpbiIsImFtbW9RdWF0IiwiYnRRdWF0ZXJuaW9uIiwidyIsInNldFJvdGF0aW9uIiwia2V5IiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsTUFBTUEsSUFBSSxHQUFHLElBQUlDLElBQUosRUFBYixDQUFBO0FBQ0EsTUFBTUMsSUFBSSxHQUFHLElBQUlDLElBQUosRUFBYixDQUFBO0FBQ0EsTUFBTUMsSUFBSSxHQUFHLElBQUlDLElBQUosRUFBYixDQUFBO0FBQ0EsTUFBTUMsYUFBYSxHQUFHLElBQUlDLFNBQUosRUFBdEIsQ0FBQTtBQUVBLE1BQU1DLE9BQU8sR0FBRyxDQUNaLFNBRFksRUFFWixNQUZZLEVBR1osYUFIWSxFQUlaLFFBSlksRUFLWixNQUxZLEVBTVosUUFOWSxFQU9aLE9BUFksRUFRWixhQVJZLEVBU1osT0FUWSxFQVVaLE9BVlksRUFXWixRQVhZLENBQWhCLENBQUE7O0FBZUEsTUFBTUMsbUJBQU4sQ0FBMEI7RUFDdEJDLFdBQVcsQ0FBQ0MsTUFBRCxFQUFTO0lBQ2hCLElBQUtBLENBQUFBLE1BQUwsR0FBY0EsTUFBZCxDQUFBO0FBQ0gsR0FBQTs7QUFHREMsRUFBQUEsZ0JBQWdCLENBQUNDLFNBQUQsRUFBWUMsSUFBWixFQUFrQjtJQUM5QkEsSUFBSSxDQUFDQyxLQUFMLEdBQWEsSUFBYixDQUFBO0FBRUFELElBQUFBLElBQUksQ0FBQ0UsS0FBTCxHQUFhLElBQUlDLEtBQUosRUFBYixDQUFBO0FBQ0FILElBQUFBLElBQUksQ0FBQ0UsS0FBTCxD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
