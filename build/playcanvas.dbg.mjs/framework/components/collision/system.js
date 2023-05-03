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
const _schema = ['enabled', 'type', 'halfExtents', 'linearOffset', 'angularOffset', 'radius', 'axis', 'height', 'asset', 'renderAsset', 'shape', 'model', 'render'];

// Collision system implementations
class CollisionSystemImpl {
  constructor(system) {
    this.system = system;
  }

  // Called before the call to system.super.initializeComponentData is made
  beforeInitialize(component, data) {
    data.shape = null;
    data.model = new Model();
    data.model.graph = new GraphNode();
  }

  // Called after the call to system.super.initializeComponentData is made
  afterInitialize(component, data) {
    this.recreatePhysicalShapes(component);
    component.data.initialized = true;
  }

  // Called when a collision component changes type in order to recreate debug and physical shapes
  reset(component, data) {
    this.beforeInitialize(component, data);
    this.afterInitialize(component, data);
  }

  // Re-creates rigid bodies / triggers
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

  // Creates a physical shape for the collision. This consists
  // of the actual shape that will be used for the rigid bodies / triggers of
  // the collision.
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

  // Called when the collision is removed
  remove(entity, data) {
    if (entity.rigidbody && entity.rigidbody.body) {
      entity.rigidbody.disableSimulation();
    }
    if (entity.trigger) {
      entity.trigger.destroy();
      delete entity.trigger;
    }
  }

  // Called when the collision is cloned to another entity
  clone(entity, clone) {
    const src = this.system.store[entity.getGuid()];
    const data = {
      enabled: src.data.enabled,
      type: src.data.type,
      halfExtents: [src.data.halfExtents.x, src.data.halfExtents.y, src.data.halfExtents.z],
      linearOffset: [src.data.linearOffset.x, src.data.linearOffset.y, src.data.linearOffset.z],
      angularOffset: [src.data.angularOffset.x, src.data.angularOffset.y, src.data.angularOffset.z, src.data.angularOffset.w],
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

// Box Collision System
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

// Sphere Collision System
class CollisionSphereSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    if (typeof Ammo !== 'undefined') {
      return new Ammo.btSphereShape(data.radius);
    }
    return undefined;
  }
}

// Capsule Collision System
class CollisionCapsuleSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    var _data$axis, _data$radius, _data$height;
    const axis = (_data$axis = data.axis) != null ? _data$axis : 1;
    const radius = (_data$radius = data.radius) != null ? _data$radius : 0.5;
    const height = Math.max(((_data$height = data.height) != null ? _data$height : 2) - 2 * radius, 0);
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

// Cylinder Collision System
class CollisionCylinderSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    var _data$axis2, _data$radius2, _data$height2;
    const axis = (_data$axis2 = data.axis) != null ? _data$axis2 : 1;
    const radius = (_data$radius2 = data.radius) != null ? _data$radius2 : 0.5;
    const height = (_data$height2 = data.height) != null ? _data$height2 : 1;
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

// Cone Collision System
class CollisionConeSystemImpl extends CollisionSystemImpl {
  createPhysicalShape(entity, data) {
    var _data$axis3, _data$radius3, _data$height3;
    const axis = (_data$axis3 = data.axis) != null ? _data$axis3 : 1;
    const radius = (_data$radius3 = data.radius) != null ? _data$radius3 : 0.5;
    const height = (_data$height3 = data.height) != null ? _data$height3 : 1;
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

// Mesh Collision System
class CollisionMeshSystemImpl extends CollisionSystemImpl {
  // override for the mesh implementation because the asset model needs
  // special handling
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

      // if the scale changed then recreate the shape
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

// Compound Collision System
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

/**
 * Manages creation of {@link CollisionComponent}s.
 *
 * @augments ComponentSystem
 */
class CollisionComponentSystem extends ComponentSystem {
  /**
   * Creates a new CollisionComponentSystem instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
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
    properties = ['type', 'halfExtents', 'radius', 'axis', 'height', 'shape', 'model', 'asset', 'render', 'renderAsset', 'enabled', 'linearOffset', 'angularOffset'];

    // duplicate the input data because we are modifying it
    const data = {};
    for (let i = 0, len = properties.length; i < len; i++) {
      const property = properties[i];
      data[property] = _data[property];
    }

    // asset takes priority over model
    // but they are both trying to change the mesh
    // so remove one of them to avoid conflicts
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
    if (Array.isArray(data.halfExtents)) {
      data.halfExtents = new Vec3(data.halfExtents);
    }
    if (Array.isArray(data.linearOffset)) {
      data.linearOffset = new Vec3(data.linearOffset);
    }
    if (Array.isArray(data.angularOffset)) {
      // Allow for euler angles to be passed as a 3 length array
      const values = data.angularOffset;
      if (values.length === 3) {
        data.angularOffset = new Quat().setFromEulerAngles(values[0], values[1], values[2]);
      } else {
        data.angularOffset = new Quat(data.angularOffset);
      }
    }
    const impl = this._createImplementation(data.type);
    impl.beforeInitialize(component, data);
    super.initializeComponentData(component, data, properties);
    impl.afterInitialize(component, data);
  }

  // Creates an implementation based on the collision type and caches it
  // in an internal implementations structure, before returning it.
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

  // Gets an existing implementation for the specified entity
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
    // TODO
    // use updateChildTransform once it is exposed in ammo.js

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

  // Destroys the previous collision type and creates a new one based on the new type provided
  changeType(component, previousType, newType) {
    this.implementations[previousType].beforeRemove(component.entity, component);
    this.implementations[previousType].remove(component.entity, component.data);
    this._createImplementation(newType).reset(component, component.data);
  }

  // Recreates rigid bodies or triggers for the specified component
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
    const ammoQuat = new Ammo.btQuaternion();
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const origin = transform.getOrigin();
    const component = node.collision;
    if (component && component._hasOffset) {
      const lo = component.data.linearOffset;
      const ao = component.data.angularOffset;
      quat.copy(rot).transformVector(lo, vec3);
      vec3.add(pos);
      quat.copy(rot).mul(ao);
      origin.setValue(vec3.x, vec3.y, vec3.z);
      ammoQuat.setValue(quat.x, quat.y, quat.z, quat.w);
    } else {
      origin.setValue(pos.x, pos.y, pos.z);
      ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY29sbGlzaW9uL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFNFTUFOVElDX1BPU0lUSU9OIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vZGVsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuaW1wb3J0IHsgVHJpZ2dlciB9IGZyb20gJy4vdHJpZ2dlci5qcyc7XG5cbmNvbnN0IG1hdDQgPSBuZXcgTWF0NCgpO1xuY29uc3QgdmVjMyA9IG5ldyBWZWMzKCk7XG5jb25zdCBxdWF0ID0gbmV3IFF1YXQoKTtcbmNvbnN0IHRlbXBHcmFwaE5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG5cbmNvbnN0IF9zY2hlbWEgPSBbXG4gICAgJ2VuYWJsZWQnLFxuICAgICd0eXBlJyxcbiAgICAnaGFsZkV4dGVudHMnLFxuICAgICdsaW5lYXJPZmZzZXQnLFxuICAgICdhbmd1bGFyT2Zmc2V0JyxcbiAgICAncmFkaXVzJyxcbiAgICAnYXhpcycsXG4gICAgJ2hlaWdodCcsXG4gICAgJ2Fzc2V0JyxcbiAgICAncmVuZGVyQXNzZXQnLFxuICAgICdzaGFwZScsXG4gICAgJ21vZGVsJyxcbiAgICAncmVuZGVyJ1xuXTtcblxuLy8gQ29sbGlzaW9uIHN5c3RlbSBpbXBsZW1lbnRhdGlvbnNcbmNsYXNzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSkge1xuICAgICAgICB0aGlzLnN5c3RlbSA9IHN5c3RlbTtcbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgYmVmb3JlIHRoZSBjYWxsIHRvIHN5c3RlbS5zdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YSBpcyBtYWRlXG4gICAgYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpIHtcbiAgICAgICAgZGF0YS5zaGFwZSA9IG51bGw7XG5cbiAgICAgICAgZGF0YS5tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICBkYXRhLm1vZGVsLmdyYXBoID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgIH1cblxuICAgIC8vIENhbGxlZCBhZnRlciB0aGUgY2FsbCB0byBzeXN0ZW0uc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEgaXMgbWFkZVxuICAgIGFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCk7XG4gICAgICAgIGNvbXBvbmVudC5kYXRhLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgd2hlbiBhIGNvbGxpc2lvbiBjb21wb25lbnQgY2hhbmdlcyB0eXBlIGluIG9yZGVyIHRvIHJlY3JlYXRlIGRlYnVnIGFuZCBwaHlzaWNhbCBzaGFwZXNcbiAgICByZXNldChjb21wb25lbnQsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5iZWZvcmVJbml0aWFsaXplKGNvbXBvbmVudCwgZGF0YSk7XG4gICAgICAgIHRoaXMuYWZ0ZXJJbml0aWFsaXplKGNvbXBvbmVudCwgZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gUmUtY3JlYXRlcyByaWdpZCBib2RpZXMgLyB0cmlnZ2Vyc1xuICAgIHJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoY29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IGNvbXBvbmVudC5lbnRpdHk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBjb21wb25lbnQuZGF0YTtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGVudGl0eS50cmlnZ2VyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGF0YS5zaGFwZSkge1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9yZW1vdmVDb21wb3VuZENoaWxkKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQsIGRhdGEuc2hhcGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBBbW1vLmRlc3Ryb3koZGF0YS5zaGFwZSk7XG4gICAgICAgICAgICAgICAgZGF0YS5zaGFwZSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSB0aGlzLmNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50LmVudGl0eSwgZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGZpcnN0Q29tcG91bmRDaGlsZCA9ICFjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50O1xuXG4gICAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSAnY29tcG91bmQnICYmICghY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCB8fCBjb21wb25lbnQgPT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IGNvbXBvbmVudDtcblxuICAgICAgICAgICAgICAgIGVudGl0eS5mb3JFYWNoKHRoaXMuX2FkZEVhY2hEZXNjZW5kYW50LCBjb21wb25lbnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnR5cGUgIT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCAmJiBjb21wb25lbnQgPT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LmZvckVhY2godGhpcy5zeXN0ZW0uaW1wbGVtZW50YXRpb25zLmNvbXBvdW5kLl91cGRhdGVFYWNoRGVzY2VuZGFudCwgY29tcG9uZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudC5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnQgPSBlbnRpdHkucGFyZW50O1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50LmNvbGxpc2lvbiAmJiBwYXJlbnQuY29sbGlzaW9uLnR5cGUgPT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50ID0gcGFyZW50LmNvbGxpc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCAhPT0gY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmlyc3RDb21wb3VuZENoaWxkICYmIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0oZW50aXR5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5jcmVhdGVCb2R5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmVuYWJsZWQgJiYgZW50aXR5LnJpZ2lkYm9keS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyID0gbmV3IFRyaWdnZXIodGhpcy5zeXN0ZW0uYXBwLCBjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmluaXRpYWxpemUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlcyBhIHBoeXNpY2FsIHNoYXBlIGZvciB0aGUgY29sbGlzaW9uLiBUaGlzIGNvbnNpc3RzXG4gICAgLy8gb2YgdGhlIGFjdHVhbCBzaGFwZSB0aGF0IHdpbGwgYmUgdXNlZCBmb3IgdGhlIHJpZ2lkIGJvZGllcyAvIHRyaWdnZXJzIG9mXG4gICAgLy8gdGhlIGNvbGxpc2lvbi5cbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHVwZGF0ZVRyYW5zZm9ybShjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgY29tcG9uZW50LmVudGl0eS50cmlnZ2VyLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuZGF0YS5zaGFwZSkge1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgJiYgIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5Ll9kZXN0cm95aW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3JlbW92ZUNvbXBvdW5kQ2hpbGQoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCwgY29tcG9uZW50LmRhdGEuc2hhcGUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgPSBudWxsO1xuXG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3koY29tcG9uZW50LmRhdGEuc2hhcGUpO1xuICAgICAgICAgICAgY29tcG9uZW50LmRhdGEuc2hhcGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIHdoZW4gdGhlIGNvbGxpc2lvbiBpcyByZW1vdmVkXG4gICAgcmVtb3ZlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAoZW50aXR5LnJpZ2lkYm9keSAmJiBlbnRpdHkucmlnaWRib2R5LmJvZHkpIHtcbiAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgZGVsZXRlIGVudGl0eS50cmlnZ2VyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIHdoZW4gdGhlIGNvbGxpc2lvbiBpcyBjbG9uZWQgdG8gYW5vdGhlciBlbnRpdHlcbiAgICBjbG9uZShlbnRpdHksIGNsb25lKSB7XG4gICAgICAgIGNvbnN0IHNyYyA9IHRoaXMuc3lzdGVtLnN0b3JlW2VudGl0eS5nZXRHdWlkKCldO1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgICBlbmFibGVkOiBzcmMuZGF0YS5lbmFibGVkLFxuICAgICAgICAgICAgdHlwZTogc3JjLmRhdGEudHlwZSxcbiAgICAgICAgICAgIGhhbGZFeHRlbnRzOiBbc3JjLmRhdGEuaGFsZkV4dGVudHMueCwgc3JjLmRhdGEuaGFsZkV4dGVudHMueSwgc3JjLmRhdGEuaGFsZkV4dGVudHMuel0sXG4gICAgICAgICAgICBsaW5lYXJPZmZzZXQ6IFtzcmMuZGF0YS5saW5lYXJPZmZzZXQueCwgc3JjLmRhdGEubGluZWFyT2Zmc2V0LnksIHNyYy5kYXRhLmxpbmVhck9mZnNldC56XSxcbiAgICAgICAgICAgIGFuZ3VsYXJPZmZzZXQ6IFtzcmMuZGF0YS5hbmd1bGFyT2Zmc2V0LngsIHNyYy5kYXRhLmFuZ3VsYXJPZmZzZXQueSwgc3JjLmRhdGEuYW5ndWxhck9mZnNldC56LCBzcmMuZGF0YS5hbmd1bGFyT2Zmc2V0LnddLFxuICAgICAgICAgICAgcmFkaXVzOiBzcmMuZGF0YS5yYWRpdXMsXG4gICAgICAgICAgICBheGlzOiBzcmMuZGF0YS5heGlzLFxuICAgICAgICAgICAgaGVpZ2h0OiBzcmMuZGF0YS5oZWlnaHQsXG4gICAgICAgICAgICBhc3NldDogc3JjLmRhdGEuYXNzZXQsXG4gICAgICAgICAgICByZW5kZXJBc3NldDogc3JjLmRhdGEucmVuZGVyQXNzZXQsXG4gICAgICAgICAgICBtb2RlbDogc3JjLmRhdGEubW9kZWwsXG4gICAgICAgICAgICByZW5kZXI6IHNyYy5kYXRhLnJlbmRlclxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLnN5c3RlbS5hZGRDb21wb25lbnQoY2xvbmUsIGRhdGEpO1xuICAgIH1cbn1cblxuLy8gQm94IENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkJveFN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBoZSA9IGRhdGEuaGFsZkV4dGVudHM7XG4gICAgICAgICAgICBjb25zdCBhbW1vSGUgPSBuZXcgQW1tby5idFZlY3RvcjMoaGUgPyBoZS54IDogMC41LCBoZSA/IGhlLnkgOiAwLjUsIGhlID8gaGUueiA6IDAuNSk7XG4gICAgICAgICAgICBjb25zdCBzaGFwZSA9IG5ldyBBbW1vLmJ0Qm94U2hhcGUoYW1tb0hlKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShhbW1vSGUpO1xuICAgICAgICAgICAgcmV0dXJuIHNoYXBlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vLyBTcGhlcmUgQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uU3BoZXJlU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQW1tby5idFNwaGVyZVNoYXBlKGRhdGEucmFkaXVzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuLy8gQ2Fwc3VsZSBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25DYXBzdWxlU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSBkYXRhLmF4aXMgPz8gMTtcbiAgICAgICAgY29uc3QgcmFkaXVzID0gZGF0YS5yYWRpdXMgPz8gMC41O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLm1heCgoZGF0YS5oZWlnaHQgPz8gMikgLSAyICogcmFkaXVzLCAwKTtcblxuICAgICAgICBsZXQgc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoYXhpcykge1xuICAgICAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENhcHN1bGVTaGFwZVgocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDYXBzdWxlU2hhcGUocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDYXBzdWxlU2hhcGVaKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgfVxufVxuXG4vLyBDeWxpbmRlciBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25DeWxpbmRlclN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBjb25zdCBheGlzID0gZGF0YS5heGlzID8/IDE7XG4gICAgICAgIGNvbnN0IHJhZGl1cyA9IGRhdGEucmFkaXVzID8/IDAuNTtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gZGF0YS5oZWlnaHQgPz8gMTtcblxuICAgICAgICBsZXQgaGFsZkV4dGVudHMgPSBudWxsO1xuICAgICAgICBsZXQgc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoYXhpcykge1xuICAgICAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICAgICAgaGFsZkV4dGVudHMgPSBuZXcgQW1tby5idFZlY3RvcjMoaGVpZ2h0ICogMC41LCByYWRpdXMsIHJhZGl1cyk7XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDeWxpbmRlclNoYXBlWChoYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgaGFsZkV4dGVudHMgPSBuZXcgQW1tby5idFZlY3RvcjMocmFkaXVzLCBoZWlnaHQgKiAwLjUsIHJhZGl1cyk7XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDeWxpbmRlclNoYXBlKGhhbGZFeHRlbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgICAgICBoYWxmRXh0ZW50cyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhyYWRpdXMsIHJhZGl1cywgaGVpZ2h0ICogMC41KTtcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idEN5bGluZGVyU2hhcGVaKGhhbGZFeHRlbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFsZkV4dGVudHMpXG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3koaGFsZkV4dGVudHMpO1xuXG4gICAgICAgIHJldHVybiBzaGFwZTtcbiAgICB9XG59XG5cbi8vIENvbmUgQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uQ29uZVN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBjb25zdCBheGlzID0gZGF0YS5heGlzID8/IDE7XG4gICAgICAgIGNvbnN0IHJhZGl1cyA9IGRhdGEucmFkaXVzID8/IDAuNTtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gZGF0YS5oZWlnaHQgPz8gMTtcblxuICAgICAgICBsZXQgc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoYXhpcykge1xuICAgICAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENvbmVTaGFwZVgocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDb25lU2hhcGUocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgIHNoYXBlID0gbmV3IEFtbW8uYnRDb25lU2hhcGVaKHJhZGl1cywgaGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgfVxufVxuXG4vLyBNZXNoIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbk1lc2hTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgLy8gb3ZlcnJpZGUgZm9yIHRoZSBtZXNoIGltcGxlbWVudGF0aW9uIGJlY2F1c2UgdGhlIGFzc2V0IG1vZGVsIG5lZWRzXG4gICAgLy8gc3BlY2lhbCBoYW5kbGluZ1xuICAgIGJlZm9yZUluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7fVxuXG4gICAgY3JlYXRlQW1tb01lc2gobWVzaCwgbm9kZSwgc2hhcGUpIHtcbiAgICAgICAgbGV0IHRyaU1lc2g7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLl90cmlNZXNoQ2FjaGVbbWVzaC5pZF0pIHtcbiAgICAgICAgICAgIHRyaU1lc2ggPSB0aGlzLnN5c3RlbS5fdHJpTWVzaENhY2hlW21lc2guaWRdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdmIgPSBtZXNoLnZlcnRleEJ1ZmZlcjtcblxuICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gdmIuZ2V0Rm9ybWF0KCk7XG4gICAgICAgICAgICBsZXQgc3RyaWRlO1xuICAgICAgICAgICAgbGV0IHBvc2l0aW9ucztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19QT1NJVElPTikge1xuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KHZiLmxvY2soKSwgZWxlbWVudC5vZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICBzdHJpZGUgPSBlbGVtZW50LnN0cmlkZSAvIDQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IFtdO1xuICAgICAgICAgICAgbWVzaC5nZXRJbmRpY2VzKGluZGljZXMpO1xuICAgICAgICAgICAgY29uc3QgbnVtVHJpYW5nbGVzID0gbWVzaC5wcmltaXRpdmVbMF0uY291bnQgLyAzO1xuXG4gICAgICAgICAgICBjb25zdCB2MSA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgY29uc3QgdjIgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGNvbnN0IHYzID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBsZXQgaTEsIGkyLCBpMztcblxuICAgICAgICAgICAgY29uc3QgYmFzZSA9IG1lc2gucHJpbWl0aXZlWzBdLmJhc2U7XG4gICAgICAgICAgICB0cmlNZXNoID0gbmV3IEFtbW8uYnRUcmlhbmdsZU1lc2goKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLl90cmlNZXNoQ2FjaGVbbWVzaC5pZF0gPSB0cmlNZXNoO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVRyaWFuZ2xlczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaTEgPSBpbmRpY2VzW2Jhc2UgKyBpICogM10gKiBzdHJpZGU7XG4gICAgICAgICAgICAgICAgaTIgPSBpbmRpY2VzW2Jhc2UgKyBpICogMyArIDFdICogc3RyaWRlO1xuICAgICAgICAgICAgICAgIGkzID0gaW5kaWNlc1tiYXNlICsgaSAqIDMgKyAyXSAqIHN0cmlkZTtcbiAgICAgICAgICAgICAgICB2MS5zZXRWYWx1ZShwb3NpdGlvbnNbaTFdLCBwb3NpdGlvbnNbaTEgKyAxXSwgcG9zaXRpb25zW2kxICsgMl0pO1xuICAgICAgICAgICAgICAgIHYyLnNldFZhbHVlKHBvc2l0aW9uc1tpMl0sIHBvc2l0aW9uc1tpMiArIDFdLCBwb3NpdGlvbnNbaTIgKyAyXSk7XG4gICAgICAgICAgICAgICAgdjMuc2V0VmFsdWUocG9zaXRpb25zW2kzXSwgcG9zaXRpb25zW2kzICsgMV0sIHBvc2l0aW9uc1tpMyArIDJdKTtcbiAgICAgICAgICAgICAgICB0cmlNZXNoLmFkZFRyaWFuZ2xlKHYxLCB2MiwgdjMsIHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodjEpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHYyKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh2Myk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1c2VRdWFudGl6ZWRBYWJiQ29tcHJlc3Npb24gPSB0cnVlO1xuICAgICAgICBjb25zdCB0cmlNZXNoU2hhcGUgPSBuZXcgQW1tby5idEJ2aFRyaWFuZ2xlTWVzaFNoYXBlKHRyaU1lc2gsIHVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbik7XG5cbiAgICAgICAgY29uc3Qgc2NhbGluZyA9IHRoaXMuc3lzdGVtLl9nZXROb2RlU2NhbGluZyhub2RlKTtcbiAgICAgICAgdHJpTWVzaFNoYXBlLnNldExvY2FsU2NhbGluZyhzY2FsaW5nKTtcbiAgICAgICAgQW1tby5kZXN0cm95KHNjYWxpbmcpO1xuXG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybSA9IHRoaXMuc3lzdGVtLl9nZXROb2RlVHJhbnNmb3JtKG5vZGUpO1xuICAgICAgICBzaGFwZS5hZGRDaGlsZFNoYXBlKHRyYW5zZm9ybSwgdHJpTWVzaFNoYXBlKTtcbiAgICAgICAgQW1tby5kZXN0cm95KHRyYW5zZm9ybSk7XG4gICAgfVxuXG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vID09PSAndW5kZWZpbmVkJykgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAoZGF0YS5tb2RlbCB8fCBkYXRhLnJlbmRlcikge1xuXG4gICAgICAgICAgICBjb25zdCBzaGFwZSA9IG5ldyBBbW1vLmJ0Q29tcG91bmRTaGFwZSgpO1xuXG4gICAgICAgICAgICBpZiAoZGF0YS5tb2RlbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBkYXRhLm1vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlQW1tb01lc2gobWVzaEluc3RhbmNlc1tpXS5tZXNoLCBtZXNoSW5zdGFuY2VzW2ldLm5vZGUsIHNoYXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEucmVuZGVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaGVzID0gZGF0YS5yZW5kZXIubWVzaGVzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlQW1tb01lc2gobWVzaGVzW2ldLCB0ZW1wR3JhcGhOb2RlLCBzaGFwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBlbnRpdHlUcmFuc2Zvcm0gPSBlbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gZW50aXR5VHJhbnNmb3JtLmdldFNjYWxlKCk7XG4gICAgICAgICAgICBjb25zdCB2ZWMgPSBuZXcgQW1tby5idFZlY3RvcjMoc2NhbGUueCwgc2NhbGUueSwgc2NhbGUueik7XG4gICAgICAgICAgICBzaGFwZS5zZXRMb2NhbFNjYWxpbmcodmVjKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh2ZWMpO1xuXG4gICAgICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoY29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBjb21wb25lbnQuZGF0YTtcblxuICAgICAgICBpZiAoZGF0YS5yZW5kZXJBc3NldCB8fCBkYXRhLmFzc2V0KSB7XG4gICAgICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQgJiYgY29tcG9uZW50LmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkQXNzZXQoXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5yZW5kZXJBc3NldCB8fCBkYXRhLmFzc2V0LFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnJlbmRlckFzc2V0ID8gJ3JlbmRlcicgOiAnbW9kZWwnXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgbG9hZEFzc2V0KGNvbXBvbmVudCwgaWQsIHByb3BlcnR5KSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBjb21wb25lbnQuZGF0YTtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQoaWQpO1xuICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgIGFzc2V0LnJlYWR5KChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIGRhdGFbcHJvcGVydHldID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBhc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhc3NldHMub25jZSgnYWRkOicgKyBpZCwgKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgYXNzZXQucmVhZHkoKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbcHJvcGVydHldID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBhc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSBjb21wb25lbnQuZW50aXR5O1xuICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG5cbiAgICAgICAgaWYgKGRhdGEubW9kZWwgfHwgZGF0YS5yZW5kZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveVNoYXBlKGRhdGEpO1xuXG4gICAgICAgICAgICBkYXRhLnNoYXBlID0gdGhpcy5jcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSk7XG5cbiAgICAgICAgICAgIGlmIChlbnRpdHkucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuY3JlYXRlQm9keSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5lbmFibGVkICYmIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIgPSBuZXcgVHJpZ2dlcih0aGlzLnN5c3RlbS5hcHAsIGNvbXBvbmVudCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuaW5pdGlhbGl6ZShkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZShlbnRpdHksIGRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlVHJhbnNmb3JtKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSkge1xuICAgICAgICBpZiAoY29tcG9uZW50LnNoYXBlKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRpdHlUcmFuc2Zvcm0gPSBjb21wb25lbnQuZW50aXR5LmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICBjb25zdCB3b3JsZFNjYWxlID0gZW50aXR5VHJhbnNmb3JtLmdldFNjYWxlKCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBzY2FsZSBjaGFuZ2VkIHRoZW4gcmVjcmVhdGUgdGhlIHNoYXBlXG4gICAgICAgICAgICBjb25zdCBwcmV2aW91c1NjYWxlID0gY29tcG9uZW50LnNoYXBlLmdldExvY2FsU2NhbGluZygpO1xuICAgICAgICAgICAgaWYgKHdvcmxkU2NhbGUueCAhPT0gcHJldmlvdXNTY2FsZS54KCkgfHxcbiAgICAgICAgICAgICAgICB3b3JsZFNjYWxlLnkgIT09IHByZXZpb3VzU2NhbGUueSgpIHx8XG4gICAgICAgICAgICAgICAgd29ybGRTY2FsZS56ICE9PSBwcmV2aW91c1NjYWxlLnooKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLnVwZGF0ZVRyYW5zZm9ybShjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpO1xuICAgIH1cblxuICAgIGRlc3Ryb3lTaGFwZShkYXRhKSB7XG4gICAgICAgIGlmICghZGF0YS5zaGFwZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBudW1TaGFwZXMgPSBkYXRhLnNoYXBlLmdldE51bUNoaWxkU2hhcGVzKCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2hhcGVzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXBlID0gZGF0YS5zaGFwZS5nZXRDaGlsZFNoYXBlKGkpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHNoYXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIEFtbW8uZGVzdHJveShkYXRhLnNoYXBlKTtcbiAgICAgICAgZGF0YS5zaGFwZSA9IG51bGw7XG4gICAgfVxuXG4gICAgcmVtb3ZlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lTaGFwZShkYXRhKTtcbiAgICAgICAgc3VwZXIucmVtb3ZlKGVudGl0eSwgZGF0YSk7XG4gICAgfVxufVxuXG4vLyBDb21wb3VuZCBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25Db21wb3VuZFN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFtbW8uYnRDb21wb3VuZFNoYXBlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBfYWRkRWFjaERlc2NlbmRhbnQoZW50aXR5KSB7XG4gICAgICAgIGlmICghZW50aXR5LmNvbGxpc2lvbiB8fCBlbnRpdHkucmlnaWRib2R5KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ID0gdGhpcztcblxuICAgICAgICBpZiAoZW50aXR5ICE9PSB0aGlzLmVudGl0eSkge1xuICAgICAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhlbnRpdHkuY29sbGlzaW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVFYWNoRGVzY2VuZGFudChlbnRpdHkpIHtcbiAgICAgICAgaWYgKCFlbnRpdHkuY29sbGlzaW9uKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudCAhPT0gdGhpcylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudCA9IG51bGw7XG5cbiAgICAgICAgaWYgKGVudGl0eSAhPT0gdGhpcy5lbnRpdHkgJiYgIWVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgIGVudGl0eS5jb2xsaXNpb24uc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoZW50aXR5LmNvbGxpc2lvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlRWFjaERlc2NlbmRhbnRUcmFuc2Zvcm0oZW50aXR5KSB7XG4gICAgICAgIGlmICghZW50aXR5LmNvbGxpc2lvbiB8fCBlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudCAhPT0gdGhpcy5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuY29sbGlzaW9uLnN5c3RlbS51cGRhdGVDb21wb3VuZENoaWxkVHJhbnNmb3JtKGVudGl0eSk7XG4gICAgfVxufVxuXG4vKipcbiAqIE1hbmFnZXMgY3JlYXRpb24gb2Yge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH1zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IENvbGxpc2lvbkNvbXBvbmVudFN5c3RlbSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBydW5uaW5nIHtAbGluayBBcHBCYXNlfS5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdjb2xsaXNpb24nO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IENvbGxpc2lvbkNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5EYXRhVHlwZSA9IENvbGxpc2lvbkNvbXBvbmVudERhdGE7XG5cbiAgICAgICAgdGhpcy5zY2hlbWEgPSBfc2NoZW1hO1xuXG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zID0geyB9O1xuXG4gICAgICAgIHRoaXMuX3RyaU1lc2hDYWNoZSA9IHsgfTtcblxuICAgICAgICB0aGlzLm9uKCdiZWZvcmVyZW1vdmUnLCB0aGlzLm9uQmVmb3JlUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbigncmVtb3ZlJywgdGhpcy5vblJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBfZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBwcm9wZXJ0aWVzID0gW1xuICAgICAgICAgICAgJ3R5cGUnLFxuICAgICAgICAgICAgJ2hhbGZFeHRlbnRzJyxcbiAgICAgICAgICAgICdyYWRpdXMnLFxuICAgICAgICAgICAgJ2F4aXMnLFxuICAgICAgICAgICAgJ2hlaWdodCcsXG4gICAgICAgICAgICAnc2hhcGUnLFxuICAgICAgICAgICAgJ21vZGVsJyxcbiAgICAgICAgICAgICdhc3NldCcsXG4gICAgICAgICAgICAncmVuZGVyJyxcbiAgICAgICAgICAgICdyZW5kZXJBc3NldCcsXG4gICAgICAgICAgICAnZW5hYmxlZCcsXG4gICAgICAgICAgICAnbGluZWFyT2Zmc2V0JyxcbiAgICAgICAgICAgICdhbmd1bGFyT2Zmc2V0J1xuICAgICAgICBdO1xuXG4gICAgICAgIC8vIGR1cGxpY2F0ZSB0aGUgaW5wdXQgZGF0YSBiZWNhdXNlIHdlIGFyZSBtb2RpZnlpbmcgaXRcbiAgICAgICAgY29uc3QgZGF0YSA9IHt9O1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcGVydGllcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcHJvcGVydHkgPSBwcm9wZXJ0aWVzW2ldO1xuICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBfZGF0YVtwcm9wZXJ0eV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhc3NldCB0YWtlcyBwcmlvcml0eSBvdmVyIG1vZGVsXG4gICAgICAgIC8vIGJ1dCB0aGV5IGFyZSBib3RoIHRyeWluZyB0byBjaGFuZ2UgdGhlIG1lc2hcbiAgICAgICAgLy8gc28gcmVtb3ZlIG9uZSBvZiB0aGVtIHRvIGF2b2lkIGNvbmZsaWN0c1xuICAgICAgICBsZXQgaWR4O1xuICAgICAgICBpZiAoX2RhdGEuaGFzT3duUHJvcGVydHkoJ2Fzc2V0JykpIHtcbiAgICAgICAgICAgIGlkeCA9IHByb3BlcnRpZXMuaW5kZXhPZignbW9kZWwnKTtcbiAgICAgICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlkeCA9IHByb3BlcnRpZXMuaW5kZXhPZigncmVuZGVyJyk7XG4gICAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnRpZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoX2RhdGEuaGFzT3duUHJvcGVydHkoJ21vZGVsJykpIHtcbiAgICAgICAgICAgIGlkeCA9IHByb3BlcnRpZXMuaW5kZXhPZignYXNzZXQnKTtcbiAgICAgICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZGF0YS50eXBlKSB7XG4gICAgICAgICAgICBkYXRhLnR5cGUgPSBjb21wb25lbnQuZGF0YS50eXBlO1xuICAgICAgICB9XG4gICAgICAgIGNvbXBvbmVudC5kYXRhLnR5cGUgPSBkYXRhLnR5cGU7XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YS5oYWxmRXh0ZW50cykpIHtcbiAgICAgICAgICAgIGRhdGEuaGFsZkV4dGVudHMgPSBuZXcgVmVjMyhkYXRhLmhhbGZFeHRlbnRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEubGluZWFyT2Zmc2V0KSkge1xuICAgICAgICAgICAgZGF0YS5saW5lYXJPZmZzZXQgPSBuZXcgVmVjMyhkYXRhLmxpbmVhck9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmFuZ3VsYXJPZmZzZXQpKSB7XG4gICAgICAgICAgICAvLyBBbGxvdyBmb3IgZXVsZXIgYW5nbGVzIHRvIGJlIHBhc3NlZCBhcyBhIDMgbGVuZ3RoIGFycmF5XG4gICAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBkYXRhLmFuZ3VsYXJPZmZzZXQ7XG4gICAgICAgICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgICAgIGRhdGEuYW5ndWxhck9mZnNldCA9IG5ldyBRdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKHZhbHVlc1swXSwgdmFsdWVzWzFdLCB2YWx1ZXNbMl0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkYXRhLmFuZ3VsYXJPZmZzZXQgPSBuZXcgUXVhdChkYXRhLmFuZ3VsYXJPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW1wbCA9IHRoaXMuX2NyZWF0ZUltcGxlbWVudGF0aW9uKGRhdGEudHlwZSk7XG4gICAgICAgIGltcGwuYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcyk7XG5cbiAgICAgICAgaW1wbC5hZnRlckluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGVzIGFuIGltcGxlbWVudGF0aW9uIGJhc2VkIG9uIHRoZSBjb2xsaXNpb24gdHlwZSBhbmQgY2FjaGVzIGl0XG4gICAgLy8gaW4gYW4gaW50ZXJuYWwgaW1wbGVtZW50YXRpb25zIHN0cnVjdHVyZSwgYmVmb3JlIHJldHVybmluZyBpdC5cbiAgICBfY3JlYXRlSW1wbGVtZW50YXRpb24odHlwZSkge1xuICAgICAgICBpZiAodGhpcy5pbXBsZW1lbnRhdGlvbnNbdHlwZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGV0IGltcGw7XG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdib3gnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbkJveFN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NwaGVyZSc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uU3BoZXJlU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY2Fwc3VsZSc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ2Fwc3VsZVN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2N5bGluZGVyJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25DeWxpbmRlclN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbmUnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbkNvbmVTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdtZXNoJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25NZXNoU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY29tcG91bmQnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbkNvbXBvdW5kU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYF9jcmVhdGVJbXBsZW1lbnRhdGlvbjogSW52YWxpZCBjb2xsaXNpb24gc3lzdGVtIHR5cGU6ICR7dHlwZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW3R5cGVdID0gaW1wbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmltcGxlbWVudGF0aW9uc1t0eXBlXTtcbiAgICB9XG5cbiAgICAvLyBHZXRzIGFuIGV4aXN0aW5nIGltcGxlbWVudGF0aW9uIGZvciB0aGUgc3BlY2lmaWVkIGVudGl0eVxuICAgIF9nZXRJbXBsZW1lbnRhdGlvbihlbnRpdHkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb25zW2VudGl0eS5jb2xsaXNpb24uZGF0YS50eXBlXTtcbiAgICB9XG5cbiAgICBjbG9uZUNvbXBvbmVudChlbnRpdHksIGNsb25lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRJbXBsZW1lbnRhdGlvbihlbnRpdHkpLmNsb25lKGVudGl0eSwgY2xvbmUpO1xuICAgIH1cblxuICAgIG9uQmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW2NvbXBvbmVudC5kYXRhLnR5cGVdLmJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICAgIGNvbXBvbmVudC5vbkJlZm9yZVJlbW92ZSgpO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1tkYXRhLnR5cGVdLnJlbW92ZShlbnRpdHksIGRhdGEpO1xuICAgIH1cblxuICAgIHVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0oZW50aXR5KSB7XG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gdXNlIHVwZGF0ZUNoaWxkVHJhbnNmb3JtIG9uY2UgaXQgaXMgZXhwb3NlZCBpbiBhbW1vLmpzXG5cbiAgICAgICAgdGhpcy5fcmVtb3ZlQ29tcG91bmRDaGlsZChlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudCwgZW50aXR5LmNvbGxpc2lvbi5kYXRhLnNoYXBlKTtcblxuICAgICAgICBpZiAoZW50aXR5LmVuYWJsZWQgJiYgZW50aXR5LmNvbGxpc2lvbi5lbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zdCB0cmFuc2Zvcm0gPSB0aGlzLl9nZXROb2RlVHJhbnNmb3JtKGVudGl0eSwgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQuZW50aXR5KTtcbiAgICAgICAgICAgIGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50LnNoYXBlLmFkZENoaWxkU2hhcGUodHJhbnNmb3JtLCBlbnRpdHkuY29sbGlzaW9uLmRhdGEuc2hhcGUpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRyYW5zZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlQ29tcG91bmRDaGlsZChjb2xsaXNpb24sIHNoYXBlKSB7XG4gICAgICAgIGlmIChjb2xsaXNpb24uc2hhcGUucmVtb3ZlQ2hpbGRTaGFwZSkge1xuICAgICAgICAgICAgY29sbGlzaW9uLnNoYXBlLnJlbW92ZUNoaWxkU2hhcGUoc2hhcGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgaW5kID0gY29sbGlzaW9uLl9nZXRDb21wb3VuZENoaWxkU2hhcGVJbmRleChzaGFwZSk7XG4gICAgICAgICAgICBpZiAoaW5kICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29sbGlzaW9uLnNoYXBlLnJlbW92ZUNoaWxkU2hhcGVCeUluZGV4KGluZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblRyYW5zZm9ybUNoYW5nZWQoY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW2NvbXBvbmVudC5kYXRhLnR5cGVdLnVwZGF0ZVRyYW5zZm9ybShjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpO1xuICAgIH1cblxuICAgIC8vIERlc3Ryb3lzIHRoZSBwcmV2aW91cyBjb2xsaXNpb24gdHlwZSBhbmQgY3JlYXRlcyBhIG5ldyBvbmUgYmFzZWQgb24gdGhlIG5ldyB0eXBlIHByb3ZpZGVkXG4gICAgY2hhbmdlVHlwZShjb21wb25lbnQsIHByZXZpb3VzVHlwZSwgbmV3VHlwZSkge1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1twcmV2aW91c1R5cGVdLmJlZm9yZVJlbW92ZShjb21wb25lbnQuZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1twcmV2aW91c1R5cGVdLnJlbW92ZShjb21wb25lbnQuZW50aXR5LCBjb21wb25lbnQuZGF0YSk7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUltcGxlbWVudGF0aW9uKG5ld1R5cGUpLnJlc2V0KGNvbXBvbmVudCwgY29tcG9uZW50LmRhdGEpO1xuICAgIH1cblxuICAgIC8vIFJlY3JlYXRlcyByaWdpZCBib2RpZXMgb3IgdHJpZ2dlcnMgZm9yIHRoZSBzcGVjaWZpZWQgY29tcG9uZW50XG4gICAgcmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbY29tcG9uZW50LmRhdGEudHlwZV0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpO1xuICAgIH1cblxuICAgIF9jYWxjdWxhdGVOb2RlUmVsYXRpdmVUcmFuc2Zvcm0obm9kZSwgcmVsYXRpdmUpIHtcbiAgICAgICAgaWYgKG5vZGUgPT09IHJlbGF0aXZlKSB7XG4gICAgICAgICAgICBjb25zdCBzY2FsZSA9IG5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRTY2FsZSgpO1xuICAgICAgICAgICAgbWF0NC5zZXRTY2FsZShzY2FsZS54LCBzY2FsZS55LCBzY2FsZS56KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybShub2RlLnBhcmVudCwgcmVsYXRpdmUpO1xuICAgICAgICAgICAgbWF0NC5tdWwobm9kZS5nZXRMb2NhbFRyYW5zZm9ybSgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9nZXROb2RlU2NhbGluZyhub2RlKSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IG5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgY29uc3Qgc2NsID0gd3RtLmdldFNjYWxlKCk7XG4gICAgICAgIHJldHVybiBuZXcgQW1tby5idFZlY3RvcjMoc2NsLngsIHNjbC55LCBzY2wueik7XG4gICAgfVxuXG4gICAgX2dldE5vZGVUcmFuc2Zvcm0obm9kZSwgcmVsYXRpdmUpIHtcbiAgICAgICAgbGV0IHBvcywgcm90O1xuXG4gICAgICAgIGlmIChyZWxhdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlTm9kZVJlbGF0aXZlVHJhbnNmb3JtKG5vZGUsIHJlbGF0aXZlKTtcblxuICAgICAgICAgICAgcG9zID0gdmVjMztcbiAgICAgICAgICAgIHJvdCA9IHF1YXQ7XG5cbiAgICAgICAgICAgIG1hdDQuZ2V0VHJhbnNsYXRpb24ocG9zKTtcbiAgICAgICAgICAgIHJvdC5zZXRGcm9tTWF0NChtYXQ0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvcyA9IG5vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIHJvdCA9IG5vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbW1vUXVhdCA9IG5ldyBBbW1vLmJ0UXVhdGVybmlvbigpO1xuICAgICAgICBjb25zdCB0cmFuc2Zvcm0gPSBuZXcgQW1tby5idFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRJZGVudGl0eSgpO1xuICAgICAgICBjb25zdCBvcmlnaW4gPSB0cmFuc2Zvcm0uZ2V0T3JpZ2luKCk7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGUuY29sbGlzaW9uO1xuXG4gICAgICAgIGlmIChjb21wb25lbnQgJiYgY29tcG9uZW50Ll9oYXNPZmZzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGxvID0gY29tcG9uZW50LmRhdGEubGluZWFyT2Zmc2V0O1xuICAgICAgICAgICAgY29uc3QgYW8gPSBjb21wb25lbnQuZGF0YS5hbmd1bGFyT2Zmc2V0O1xuXG4gICAgICAgICAgICBxdWF0LmNvcHkocm90KS50cmFuc2Zvcm1WZWN0b3IobG8sIHZlYzMpO1xuICAgICAgICAgICAgdmVjMy5hZGQoKHBvcykpO1xuICAgICAgICAgICAgcXVhdC5jb3B5KHJvdCkubXVsKGFvKTtcblxuICAgICAgICAgICAgb3JpZ2luLnNldFZhbHVlKHZlYzMueCwgdmVjMy55LCB2ZWMzLnopO1xuICAgICAgICAgICAgYW1tb1F1YXQuc2V0VmFsdWUocXVhdC54LCBxdWF0LnksIHF1YXQueiwgcXVhdC53KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9yaWdpbi5zZXRWYWx1ZShwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgICAgIGFtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRSb3RhdGlvbihhbW1vUXVhdCk7XG4gICAgICAgIEFtbW8uZGVzdHJveShhbW1vUXVhdCk7XG4gICAgICAgIEFtbW8uZGVzdHJveShvcmlnaW4pO1xuXG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm07XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fdHJpTWVzaENhY2hlKSB7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5fdHJpTWVzaENhY2hlW2tleV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdHJpTWVzaENhY2hlID0gbnVsbDtcblxuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKENvbGxpc2lvbkNvbXBvbmVudC5wcm90b3R5cGUsIF9zY2hlbWEpO1xuXG5leHBvcnQgeyBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW0gfTtcbiJdLCJuYW1lcyI6WyJtYXQ0IiwiTWF0NCIsInZlYzMiLCJWZWMzIiwicXVhdCIsIlF1YXQiLCJ0ZW1wR3JhcGhOb2RlIiwiR3JhcGhOb2RlIiwiX3NjaGVtYSIsIkNvbGxpc2lvblN5c3RlbUltcGwiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImJlZm9yZUluaXRpYWxpemUiLCJjb21wb25lbnQiLCJkYXRhIiwic2hhcGUiLCJtb2RlbCIsIk1vZGVsIiwiZ3JhcGgiLCJhZnRlckluaXRpYWxpemUiLCJyZWNyZWF0ZVBoeXNpY2FsU2hhcGVzIiwiaW5pdGlhbGl6ZWQiLCJyZXNldCIsImVudGl0eSIsIkFtbW8iLCJ0cmlnZ2VyIiwiZGVzdHJveSIsIl9jb21wb3VuZFBhcmVudCIsIl9yZW1vdmVDb21wb3VuZENoaWxkIiwicmlnaWRib2R5IiwiYWN0aXZhdGUiLCJjcmVhdGVQaHlzaWNhbFNoYXBlIiwiZmlyc3RDb21wb3VuZENoaWxkIiwidHlwZSIsImZvckVhY2giLCJfYWRkRWFjaERlc2NlbmRhbnQiLCJpbXBsZW1lbnRhdGlvbnMiLCJjb21wb3VuZCIsIl91cGRhdGVFYWNoRGVzY2VuZGFudCIsInBhcmVudCIsImNvbGxpc2lvbiIsImdldE51bUNoaWxkU2hhcGVzIiwidXBkYXRlQ29tcG91bmRDaGlsZFRyYW5zZm9ybSIsImRpc2FibGVTaW11bGF0aW9uIiwiY3JlYXRlQm9keSIsImVuYWJsZWQiLCJlbmFibGVTaW11bGF0aW9uIiwiVHJpZ2dlciIsImFwcCIsImluaXRpYWxpemUiLCJ1bmRlZmluZWQiLCJ1cGRhdGVUcmFuc2Zvcm0iLCJwb3NpdGlvbiIsInJvdGF0aW9uIiwic2NhbGUiLCJiZWZvcmVSZW1vdmUiLCJfZGVzdHJveWluZyIsInJlbW92ZSIsImJvZHkiLCJjbG9uZSIsInNyYyIsInN0b3JlIiwiZ2V0R3VpZCIsImhhbGZFeHRlbnRzIiwieCIsInkiLCJ6IiwibGluZWFyT2Zmc2V0IiwiYW5ndWxhck9mZnNldCIsInciLCJyYWRpdXMiLCJheGlzIiwiaGVpZ2h0IiwiYXNzZXQiLCJyZW5kZXJBc3NldCIsInJlbmRlciIsImFkZENvbXBvbmVudCIsIkNvbGxpc2lvbkJveFN5c3RlbUltcGwiLCJoZSIsImFtbW9IZSIsImJ0VmVjdG9yMyIsImJ0Qm94U2hhcGUiLCJDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsIiwiYnRTcGhlcmVTaGFwZSIsIkNvbGxpc2lvbkNhcHN1bGVTeXN0ZW1JbXBsIiwiX2RhdGEkYXhpcyIsIl9kYXRhJHJhZGl1cyIsIl9kYXRhJGhlaWdodCIsIk1hdGgiLCJtYXgiLCJidENhcHN1bGVTaGFwZVgiLCJidENhcHN1bGVTaGFwZSIsImJ0Q2Fwc3VsZVNoYXBlWiIsIkNvbGxpc2lvbkN5bGluZGVyU3lzdGVtSW1wbCIsIl9kYXRhJGF4aXMyIiwiX2RhdGEkcmFkaXVzMiIsIl9kYXRhJGhlaWdodDIiLCJidEN5bGluZGVyU2hhcGVYIiwiYnRDeWxpbmRlclNoYXBlIiwiYnRDeWxpbmRlclNoYXBlWiIsIkNvbGxpc2lvbkNvbmVTeXN0ZW1JbXBsIiwiX2RhdGEkYXhpczMiLCJfZGF0YSRyYWRpdXMzIiwiX2RhdGEkaGVpZ2h0MyIsImJ0Q29uZVNoYXBlWCIsImJ0Q29uZVNoYXBlIiwiYnRDb25lU2hhcGVaIiwiQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwiLCJjcmVhdGVBbW1vTWVzaCIsIm1lc2giLCJub2RlIiwidHJpTWVzaCIsIl90cmlNZXNoQ2FjaGUiLCJpZCIsInZiIiwidmVydGV4QnVmZmVyIiwiZm9ybWF0IiwiZ2V0Rm9ybWF0Iiwic3RyaWRlIiwicG9zaXRpb25zIiwiaSIsImVsZW1lbnRzIiwibGVuZ3RoIiwiZWxlbWVudCIsIm5hbWUiLCJTRU1BTlRJQ19QT1NJVElPTiIsIkZsb2F0MzJBcnJheSIsImxvY2siLCJvZmZzZXQiLCJpbmRpY2VzIiwiZ2V0SW5kaWNlcyIsIm51bVRyaWFuZ2xlcyIsInByaW1pdGl2ZSIsImNvdW50IiwidjEiLCJ2MiIsInYzIiwiaTEiLCJpMiIsImkzIiwiYmFzZSIsImJ0VHJpYW5nbGVNZXNoIiwic2V0VmFsdWUiLCJhZGRUcmlhbmdsZSIsInVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbiIsInRyaU1lc2hTaGFwZSIsImJ0QnZoVHJpYW5nbGVNZXNoU2hhcGUiLCJzY2FsaW5nIiwiX2dldE5vZGVTY2FsaW5nIiwic2V0TG9jYWxTY2FsaW5nIiwidHJhbnNmb3JtIiwiX2dldE5vZGVUcmFuc2Zvcm0iLCJhZGRDaGlsZFNoYXBlIiwiYnRDb21wb3VuZFNoYXBlIiwibWVzaEluc3RhbmNlcyIsIm1lc2hlcyIsImVudGl0eVRyYW5zZm9ybSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0U2NhbGUiLCJ2ZWMiLCJsb2FkQXNzZXQiLCJkb1JlY3JlYXRlUGh5c2ljYWxTaGFwZSIsInByb3BlcnR5IiwiYXNzZXRzIiwiZ2V0IiwicmVhZHkiLCJyZXNvdXJjZSIsImxvYWQiLCJvbmNlIiwiZGVzdHJveVNoYXBlIiwid29ybGRTY2FsZSIsInByZXZpb3VzU2NhbGUiLCJnZXRMb2NhbFNjYWxpbmciLCJudW1TaGFwZXMiLCJnZXRDaGlsZFNoYXBlIiwiQ29sbGlzaW9uQ29tcG91bmRTeXN0ZW1JbXBsIiwiX3VwZGF0ZUVhY2hEZXNjZW5kYW50VHJhbnNmb3JtIiwiQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50VHlwZSIsIkNvbGxpc2lvbkNvbXBvbmVudCIsIkRhdGFUeXBlIiwiQ29sbGlzaW9uQ29tcG9uZW50RGF0YSIsInNjaGVtYSIsIm9uIiwib25CZWZvcmVSZW1vdmUiLCJvblJlbW92ZSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiX2RhdGEiLCJwcm9wZXJ0aWVzIiwibGVuIiwiaWR4IiwiaGFzT3duUHJvcGVydHkiLCJpbmRleE9mIiwic3BsaWNlIiwiQXJyYXkiLCJpc0FycmF5IiwidmFsdWVzIiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiaW1wbCIsIl9jcmVhdGVJbXBsZW1lbnRhdGlvbiIsIkRlYnVnIiwiZXJyb3IiLCJfZ2V0SW1wbGVtZW50YXRpb24iLCJjbG9uZUNvbXBvbmVudCIsInJlbW92ZUNoaWxkU2hhcGUiLCJpbmQiLCJfZ2V0Q29tcG91bmRDaGlsZFNoYXBlSW5kZXgiLCJyZW1vdmVDaGlsZFNoYXBlQnlJbmRleCIsIm9uVHJhbnNmb3JtQ2hhbmdlZCIsImNoYW5nZVR5cGUiLCJwcmV2aW91c1R5cGUiLCJuZXdUeXBlIiwiX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybSIsInJlbGF0aXZlIiwic2V0U2NhbGUiLCJtdWwiLCJnZXRMb2NhbFRyYW5zZm9ybSIsInd0bSIsInNjbCIsInBvcyIsInJvdCIsImdldFRyYW5zbGF0aW9uIiwic2V0RnJvbU1hdDQiLCJnZXRQb3NpdGlvbiIsImdldFJvdGF0aW9uIiwiYW1tb1F1YXQiLCJidFF1YXRlcm5pb24iLCJidFRyYW5zZm9ybSIsInNldElkZW50aXR5Iiwib3JpZ2luIiwiZ2V0T3JpZ2luIiwiX2hhc09mZnNldCIsImxvIiwiYW8iLCJjb3B5IiwidHJhbnNmb3JtVmVjdG9yIiwiYWRkIiwic2V0Um90YXRpb24iLCJrZXkiLCJDb21wb25lbnQiLCJfYnVpbGRBY2Nlc3NvcnMiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFrQkEsTUFBTUEsSUFBSSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3ZCLE1BQU1DLElBQUksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN2QixNQUFNQyxJQUFJLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDdkIs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
