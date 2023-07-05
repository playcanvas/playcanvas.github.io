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
const p1 = new Vec3();
const p2 = new Vec3();
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
        this.destroyShape(data);
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
  destroyShape(data) {
    if (data.shape) {
      Ammo.destroy(data.shape);
      data.shape = null;
    }
  }
  beforeRemove(entity, component) {
    if (component.data.shape) {
      if (component._compoundParent && !component._compoundParent.entity._destroying) {
        this.system._removeCompoundChild(component._compoundParent, component.data.shape);
        if (component._compoundParent.entity.rigidbody) component._compoundParent.entity.rigidbody.activate();
      }
      component._compoundParent = null;
      this.destroyShape(component.data);
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
      pos = p1;
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
      const newOrigin = p2;
      quat.copy(rot).transformVector(lo, newOrigin);
      newOrigin.add(pos);
      quat.copy(rot).mul(ao);
      origin.setValue(newOrigin.x, newOrigin.y, newOrigin.z);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY29sbGlzaW9uL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFNFTUFOVElDX1BPU0lUSU9OIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vZGVsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuaW1wb3J0IHsgVHJpZ2dlciB9IGZyb20gJy4vdHJpZ2dlci5qcyc7XG5cbmNvbnN0IG1hdDQgPSBuZXcgTWF0NCgpO1xuY29uc3QgcDEgPSBuZXcgVmVjMygpO1xuY29uc3QgcDIgPSBuZXcgVmVjMygpO1xuY29uc3QgcXVhdCA9IG5ldyBRdWF0KCk7XG5jb25zdCB0ZW1wR3JhcGhOb2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuXG5jb25zdCBfc2NoZW1hID0gW1xuICAgICdlbmFibGVkJyxcbiAgICAndHlwZScsXG4gICAgJ2hhbGZFeHRlbnRzJyxcbiAgICAnbGluZWFyT2Zmc2V0JyxcbiAgICAnYW5ndWxhck9mZnNldCcsXG4gICAgJ3JhZGl1cycsXG4gICAgJ2F4aXMnLFxuICAgICdoZWlnaHQnLFxuICAgICdhc3NldCcsXG4gICAgJ3JlbmRlckFzc2V0JyxcbiAgICAnc2hhcGUnLFxuICAgICdtb2RlbCcsXG4gICAgJ3JlbmRlcidcbl07XG5cbi8vIENvbGxpc2lvbiBzeXN0ZW0gaW1wbGVtZW50YXRpb25zXG5jbGFzcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0pIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0gPSBzeXN0ZW07XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIGJlZm9yZSB0aGUgY2FsbCB0byBzeXN0ZW0uc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEgaXMgbWFkZVxuICAgIGJlZm9yZUluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuXG4gICAgICAgIGRhdGEubW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgZGF0YS5tb2RlbC5ncmFwaCA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgYWZ0ZXIgdGhlIGNhbGwgdG8gc3lzdGVtLnN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhIGlzIG1hZGVcbiAgICBhZnRlckluaXRpYWxpemUoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpO1xuICAgICAgICBjb21wb25lbnQuZGF0YS5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIHdoZW4gYSBjb2xsaXNpb24gY29tcG9uZW50IGNoYW5nZXMgdHlwZSBpbiBvcmRlciB0byByZWNyZWF0ZSBkZWJ1ZyBhbmQgcGh5c2ljYWwgc2hhcGVzXG4gICAgcmVzZXQoY29tcG9uZW50LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICB0aGlzLmFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFJlLWNyZWF0ZXMgcmlnaWQgYm9kaWVzIC8gdHJpZ2dlcnNcbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSBjb21wb25lbnQuZW50aXR5O1xuICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcmVtb3ZlQ29tcG91bmRDaGlsZChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LCBkYXRhLnNoYXBlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5KVxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95U2hhcGUoZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSB0aGlzLmNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50LmVudGl0eSwgZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGZpcnN0Q29tcG91bmRDaGlsZCA9ICFjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50O1xuXG4gICAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSAnY29tcG91bmQnICYmICghY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCB8fCBjb21wb25lbnQgPT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IGNvbXBvbmVudDtcblxuICAgICAgICAgICAgICAgIGVudGl0eS5mb3JFYWNoKHRoaXMuX2FkZEVhY2hEZXNjZW5kYW50LCBjb21wb25lbnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnR5cGUgIT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCAmJiBjb21wb25lbnQgPT09IGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LmZvckVhY2godGhpcy5zeXN0ZW0uaW1wbGVtZW50YXRpb25zLmNvbXBvdW5kLl91cGRhdGVFYWNoRGVzY2VuZGFudCwgY29tcG9uZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudC5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnQgPSBlbnRpdHkucGFyZW50O1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50LmNvbGxpc2lvbiAmJiBwYXJlbnQuY29sbGlzaW9uLnR5cGUgPT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50ID0gcGFyZW50LmNvbGxpc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCAhPT0gY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmlyc3RDb21wb3VuZENoaWxkICYmIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0oZW50aXR5KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5jcmVhdGVCb2R5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmVuYWJsZWQgJiYgZW50aXR5LnJpZ2lkYm9keS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyID0gbmV3IFRyaWdnZXIodGhpcy5zeXN0ZW0uYXBwLCBjb21wb25lbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmluaXRpYWxpemUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlcyBhIHBoeXNpY2FsIHNoYXBlIGZvciB0aGUgY29sbGlzaW9uLiBUaGlzIGNvbnNpc3RzXG4gICAgLy8gb2YgdGhlIGFjdHVhbCBzaGFwZSB0aGF0IHdpbGwgYmUgdXNlZCBmb3IgdGhlIHJpZ2lkIGJvZGllcyAvIHRyaWdnZXJzIG9mXG4gICAgLy8gdGhlIGNvbGxpc2lvbi5cbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHVwZGF0ZVRyYW5zZm9ybShjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgY29tcG9uZW50LmVudGl0eS50cmlnZ2VyLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVzdHJveVNoYXBlKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEuc2hhcGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShkYXRhLnNoYXBlKTtcbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuZGF0YS5zaGFwZSkge1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgJiYgIWNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5Ll9kZXN0cm95aW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3JlbW92ZUNvbXBvdW5kQ2hpbGQoY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudCwgY29tcG9uZW50LmRhdGEuc2hhcGUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5fY29tcG91bmRQYXJlbnQgPSBudWxsO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lTaGFwZShjb21wb25lbnQuZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgd2hlbiB0aGUgY29sbGlzaW9uIGlzIHJlbW92ZWRcbiAgICByZW1vdmUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmIChlbnRpdHkucmlnaWRib2R5ICYmIGVudGl0eS5yaWdpZGJvZHkuYm9keSkge1xuICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5kZXN0cm95KCk7XG4gICAgICAgICAgICBkZWxldGUgZW50aXR5LnRyaWdnZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgd2hlbiB0aGUgY29sbGlzaW9uIGlzIGNsb25lZCB0byBhbm90aGVyIGVudGl0eVxuICAgIGNsb25lKGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgY29uc3Qgc3JjID0gdGhpcy5zeXN0ZW0uc3RvcmVbZW50aXR5LmdldEd1aWQoKV07XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHNyYy5kYXRhLmVuYWJsZWQsXG4gICAgICAgICAgICB0eXBlOiBzcmMuZGF0YS50eXBlLFxuICAgICAgICAgICAgaGFsZkV4dGVudHM6IFtzcmMuZGF0YS5oYWxmRXh0ZW50cy54LCBzcmMuZGF0YS5oYWxmRXh0ZW50cy55LCBzcmMuZGF0YS5oYWxmRXh0ZW50cy56XSxcbiAgICAgICAgICAgIGxpbmVhck9mZnNldDogW3NyYy5kYXRhLmxpbmVhck9mZnNldC54LCBzcmMuZGF0YS5saW5lYXJPZmZzZXQueSwgc3JjLmRhdGEubGluZWFyT2Zmc2V0LnpdLFxuICAgICAgICAgICAgYW5ndWxhck9mZnNldDogW3NyYy5kYXRhLmFuZ3VsYXJPZmZzZXQueCwgc3JjLmRhdGEuYW5ndWxhck9mZnNldC55LCBzcmMuZGF0YS5hbmd1bGFyT2Zmc2V0LnosIHNyYy5kYXRhLmFuZ3VsYXJPZmZzZXQud10sXG4gICAgICAgICAgICByYWRpdXM6IHNyYy5kYXRhLnJhZGl1cyxcbiAgICAgICAgICAgIGF4aXM6IHNyYy5kYXRhLmF4aXMsXG4gICAgICAgICAgICBoZWlnaHQ6IHNyYy5kYXRhLmhlaWdodCxcbiAgICAgICAgICAgIGFzc2V0OiBzcmMuZGF0YS5hc3NldCxcbiAgICAgICAgICAgIHJlbmRlckFzc2V0OiBzcmMuZGF0YS5yZW5kZXJBc3NldCxcbiAgICAgICAgICAgIG1vZGVsOiBzcmMuZGF0YS5tb2RlbCxcbiAgICAgICAgICAgIHJlbmRlcjogc3JjLmRhdGEucmVuZGVyXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuc3lzdGVtLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxufVxuXG4vLyBCb3ggQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uQm94U3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGhlID0gZGF0YS5oYWxmRXh0ZW50cztcbiAgICAgICAgICAgIGNvbnN0IGFtbW9IZSA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhoZSA/IGhlLnggOiAwLjUsIGhlID8gaGUueSA6IDAuNSwgaGUgPyBoZS56IDogMC41KTtcbiAgICAgICAgICAgIGNvbnN0IHNoYXBlID0gbmV3IEFtbW8uYnRCb3hTaGFwZShhbW1vSGUpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KGFtbW9IZSk7XG4gICAgICAgICAgICByZXR1cm4gc2hhcGU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8vIFNwaGVyZSBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBbW1vLmJ0U3BoZXJlU2hhcGUoZGF0YS5yYWRpdXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vLyBDYXBzdWxlIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkNhcHN1bGVTeXN0ZW1JbXBsIGV4dGVuZHMgQ29sbGlzaW9uU3lzdGVtSW1wbCB7XG4gICAgY3JlYXRlUGh5c2ljYWxTaGFwZShlbnRpdHksIGRhdGEpIHtcbiAgICAgICAgY29uc3QgYXhpcyA9IGRhdGEuYXhpcyA/PyAxO1xuICAgICAgICBjb25zdCByYWRpdXMgPSBkYXRhLnJhZGl1cyA/PyAwLjU7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IE1hdGgubWF4KChkYXRhLmhlaWdodCA/PyAyKSAtIDIgKiByYWRpdXMsIDApO1xuXG4gICAgICAgIGxldCBzaGFwZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgc3dpdGNoIChheGlzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q2Fwc3VsZVNoYXBlWChyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENhcHN1bGVTaGFwZShyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENhcHN1bGVTaGFwZVoocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzaGFwZTtcbiAgICB9XG59XG5cbi8vIEN5bGluZGVyIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkN5bGluZGVyU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSBkYXRhLmF4aXMgPz8gMTtcbiAgICAgICAgY29uc3QgcmFkaXVzID0gZGF0YS5yYWRpdXMgPz8gMC41O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBkYXRhLmhlaWdodCA/PyAxO1xuXG4gICAgICAgIGxldCBoYWxmRXh0ZW50cyA9IG51bGw7XG4gICAgICAgIGxldCBzaGFwZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgc3dpdGNoIChheGlzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICAgICAgICBoYWxmRXh0ZW50cyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhoZWlnaHQgKiAwLjUsIHJhZGl1cywgcmFkaXVzKTtcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idEN5bGluZGVyU2hhcGVYKGhhbGZFeHRlbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgICAgICBoYWxmRXh0ZW50cyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhyYWRpdXMsIGhlaWdodCAqIDAuNSwgcmFkaXVzKTtcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idEN5bGluZGVyU2hhcGUoaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgIGhhbGZFeHRlbnRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKHJhZGl1cywgcmFkaXVzLCBoZWlnaHQgKiAwLjUpO1xuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q3lsaW5kZXJTaGFwZVooaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChoYWxmRXh0ZW50cylcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShoYWxmRXh0ZW50cyk7XG5cbiAgICAgICAgcmV0dXJuIHNoYXBlO1xuICAgIH1cbn1cblxuLy8gQ29uZSBDb2xsaXNpb24gU3lzdGVtXG5jbGFzcyBDb2xsaXNpb25Db25lU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSBkYXRhLmF4aXMgPz8gMTtcbiAgICAgICAgY29uc3QgcmFkaXVzID0gZGF0YS5yYWRpdXMgPz8gMC41O1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBkYXRhLmhlaWdodCA/PyAxO1xuXG4gICAgICAgIGxldCBzaGFwZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgc3dpdGNoIChheGlzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICAgICAgICBzaGFwZSA9IG5ldyBBbW1vLmJ0Q29uZVNoYXBlWChyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENvbmVTaGFwZShyYWRpdXMsIGhlaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgc2hhcGUgPSBuZXcgQW1tby5idENvbmVTaGFwZVoocmFkaXVzLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzaGFwZTtcbiAgICB9XG59XG5cbi8vIE1lc2ggQ29sbGlzaW9uIFN5c3RlbVxuY2xhc3MgQ29sbGlzaW9uTWVzaFN5c3RlbUltcGwgZXh0ZW5kcyBDb2xsaXNpb25TeXN0ZW1JbXBsIHtcbiAgICAvLyBvdmVycmlkZSBmb3IgdGhlIG1lc2ggaW1wbGVtZW50YXRpb24gYmVjYXVzZSB0aGUgYXNzZXQgbW9kZWwgbmVlZHNcbiAgICAvLyBzcGVjaWFsIGhhbmRsaW5nXG4gICAgYmVmb3JlSW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpIHt9XG5cbiAgICBjcmVhdGVBbW1vTWVzaChtZXNoLCBub2RlLCBzaGFwZSkge1xuICAgICAgICBsZXQgdHJpTWVzaDtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uX3RyaU1lc2hDYWNoZVttZXNoLmlkXSkge1xuICAgICAgICAgICAgdHJpTWVzaCA9IHRoaXMuc3lzdGVtLl90cmlNZXNoQ2FjaGVbbWVzaC5pZF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB2YiA9IG1lc2gudmVydGV4QnVmZmVyO1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXQgPSB2Yi5nZXRGb3JtYXQoKTtcbiAgICAgICAgICAgIGxldCBzdHJpZGU7XG4gICAgICAgICAgICBsZXQgcG9zaXRpb25zO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmb3JtYXQuZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1BPU0lUSU9OKSB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9ucyA9IG5ldyBGbG9hdDMyQXJyYXkodmIubG9jaygpLCBlbGVtZW50Lm9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIHN0cmlkZSA9IGVsZW1lbnQuc3RyaWRlIC8gNDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gW107XG4gICAgICAgICAgICBtZXNoLmdldEluZGljZXMoaW5kaWNlcyk7XG4gICAgICAgICAgICBjb25zdCBudW1UcmlhbmdsZXMgPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCAvIDM7XG5cbiAgICAgICAgICAgIGNvbnN0IHYxID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBjb25zdCB2MiA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgY29uc3QgdjMgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGxldCBpMSwgaTIsIGkzO1xuXG4gICAgICAgICAgICBjb25zdCBiYXNlID0gbWVzaC5wcmltaXRpdmVbMF0uYmFzZTtcbiAgICAgICAgICAgIHRyaU1lc2ggPSBuZXcgQW1tby5idFRyaWFuZ2xlTWVzaCgpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3RyaU1lc2hDYWNoZVttZXNoLmlkXSA9IHRyaU1lc2g7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVHJpYW5nbGVzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpMSA9IGluZGljZXNbYmFzZSArIGkgKiAzXSAqIHN0cmlkZTtcbiAgICAgICAgICAgICAgICBpMiA9IGluZGljZXNbYmFzZSArIGkgKiAzICsgMV0gKiBzdHJpZGU7XG4gICAgICAgICAgICAgICAgaTMgPSBpbmRpY2VzW2Jhc2UgKyBpICogMyArIDJdICogc3RyaWRlO1xuICAgICAgICAgICAgICAgIHYxLnNldFZhbHVlKHBvc2l0aW9uc1tpMV0sIHBvc2l0aW9uc1tpMSArIDFdLCBwb3NpdGlvbnNbaTEgKyAyXSk7XG4gICAgICAgICAgICAgICAgdjIuc2V0VmFsdWUocG9zaXRpb25zW2kyXSwgcG9zaXRpb25zW2kyICsgMV0sIHBvc2l0aW9uc1tpMiArIDJdKTtcbiAgICAgICAgICAgICAgICB2My5zZXRWYWx1ZShwb3NpdGlvbnNbaTNdLCBwb3NpdGlvbnNbaTMgKyAxXSwgcG9zaXRpb25zW2kzICsgMl0pO1xuICAgICAgICAgICAgICAgIHRyaU1lc2guYWRkVHJpYW5nbGUodjEsIHYyLCB2MywgdHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh2MSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodjIpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHYzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZVF1YW50aXplZEFhYmJDb21wcmVzc2lvbiA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRyaU1lc2hTaGFwZSA9IG5ldyBBbW1vLmJ0QnZoVHJpYW5nbGVNZXNoU2hhcGUodHJpTWVzaCwgdXNlUXVhbnRpemVkQWFiYkNvbXByZXNzaW9uKTtcblxuICAgICAgICBjb25zdCBzY2FsaW5nID0gdGhpcy5zeXN0ZW0uX2dldE5vZGVTY2FsaW5nKG5vZGUpO1xuICAgICAgICB0cmlNZXNoU2hhcGUuc2V0TG9jYWxTY2FsaW5nKHNjYWxpbmcpO1xuICAgICAgICBBbW1vLmRlc3Ryb3koc2NhbGluZyk7XG5cbiAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gdGhpcy5zeXN0ZW0uX2dldE5vZGVUcmFuc2Zvcm0obm9kZSk7XG4gICAgICAgIHNoYXBlLmFkZENoaWxkU2hhcGUodHJhbnNmb3JtLCB0cmlNZXNoU2hhcGUpO1xuICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcbiAgICB9XG5cbiAgICBjcmVhdGVQaHlzaWNhbFNoYXBlKGVudGl0eSwgZGF0YSkge1xuICAgICAgICBpZiAodHlwZW9mIEFtbW8gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChkYXRhLm1vZGVsIHx8IGRhdGEucmVuZGVyKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYXBlID0gbmV3IEFtbW8uYnRDb21wb3VuZFNoYXBlKCk7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm1vZGVsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGRhdGEubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVBbW1vTWVzaChtZXNoSW5zdGFuY2VzW2ldLm1lc2gsIG1lc2hJbnN0YW5jZXNbaV0ubm9kZSwgc2hhcGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5yZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoZXMgPSBkYXRhLnJlbmRlci5tZXNoZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVBbW1vTWVzaChtZXNoZXNbaV0sIHRlbXBHcmFwaE5vZGUsIHNoYXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVRyYW5zZm9ybSA9IGVudGl0eS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgY29uc3Qgc2NhbGUgPSBlbnRpdHlUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHZlYyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhzY2FsZS54LCBzY2FsZS55LCBzY2FsZS56KTtcbiAgICAgICAgICAgIHNoYXBlLnNldExvY2FsU2NhbGluZyh2ZWMpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHZlYyk7XG5cbiAgICAgICAgICAgIHJldHVybiBzaGFwZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNvbXBvbmVudC5kYXRhO1xuXG4gICAgICAgIGlmIChkYXRhLnJlbmRlckFzc2V0IHx8IGRhdGEuYXNzZXQpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuZW5hYmxlZCAmJiBjb21wb25lbnQuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRBc3NldChcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnJlbmRlckFzc2V0IHx8IGRhdGEuYXNzZXQsXG4gICAgICAgICAgICAgICAgICAgIGRhdGEucmVuZGVyQXNzZXQgPyAncmVuZGVyJyA6ICdtb2RlbCdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBsb2FkQXNzZXQoY29tcG9uZW50LCBpZCwgcHJvcGVydHkpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNvbXBvbmVudC5kYXRhO1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChpZCk7XG4gICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgYXNzZXQucmVhZHkoKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB0aGlzLmRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlKGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFzc2V0cy5vbmNlKCdhZGQ6JyArIGlkLCAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBhc3NldC5yZWFkeSgoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtwcm9wZXJ0eV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUoY29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IGNvbXBvbmVudC5lbnRpdHk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBjb21wb25lbnQuZGF0YTtcblxuICAgICAgICBpZiAoZGF0YS5tb2RlbCB8fCBkYXRhLnJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95U2hhcGUoZGF0YSk7XG5cbiAgICAgICAgICAgIGRhdGEuc2hhcGUgPSB0aGlzLmNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKTtcblxuICAgICAgICAgICAgaWYgKGVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkucmlnaWRib2R5LmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgZW50aXR5LnJpZ2lkYm9keS5jcmVhdGVCb2R5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmVuYWJsZWQgJiYgZW50aXR5LnJpZ2lkYm9keS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5yaWdpZGJvZHkuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlciA9IG5ldyBUcmlnZ2VyKHRoaXMuc3lzdGVtLmFwcCwgY29tcG9uZW50LCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5pbml0aWFsaXplKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKGVudGl0eSwgZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVUcmFuc2Zvcm0oY29tcG9uZW50LCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuc2hhcGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVRyYW5zZm9ybSA9IGNvbXBvbmVudC5lbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIGNvbnN0IHdvcmxkU2NhbGUgPSBlbnRpdHlUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHNjYWxlIGNoYW5nZWQgdGhlbiByZWNyZWF0ZSB0aGUgc2hhcGVcbiAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzU2NhbGUgPSBjb21wb25lbnQuc2hhcGUuZ2V0TG9jYWxTY2FsaW5nKCk7XG4gICAgICAgICAgICBpZiAod29ybGRTY2FsZS54ICE9PSBwcmV2aW91c1NjYWxlLngoKSB8fFxuICAgICAgICAgICAgICAgIHdvcmxkU2NhbGUueSAhPT0gcHJldmlvdXNTY2FsZS55KCkgfHxcbiAgICAgICAgICAgICAgICB3b3JsZFNjYWxlLnogIT09IHByZXZpb3VzU2NhbGUueigpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb1JlY3JlYXRlUGh5c2ljYWxTaGFwZShjb21wb25lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3VwZXIudXBkYXRlVHJhbnNmb3JtKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSk7XG4gICAgfVxuXG4gICAgZGVzdHJveVNoYXBlKGRhdGEpIHtcbiAgICAgICAgaWYgKCFkYXRhLnNoYXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG51bVNoYXBlcyA9IGRhdGEuc2hhcGUuZ2V0TnVtQ2hpbGRTaGFwZXMoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TaGFwZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2hhcGUgPSBkYXRhLnNoYXBlLmdldENoaWxkU2hhcGUoaSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3koc2hhcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KGRhdGEuc2hhcGUpO1xuICAgICAgICBkYXRhLnNoYXBlID0gbnVsbDtcbiAgICB9XG59XG5cbi8vIENvbXBvdW5kIENvbGxpc2lvbiBTeXN0ZW1cbmNsYXNzIENvbGxpc2lvbkNvbXBvdW5kU3lzdGVtSW1wbCBleHRlbmRzIENvbGxpc2lvblN5c3RlbUltcGwge1xuICAgIGNyZWF0ZVBoeXNpY2FsU2hhcGUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQW1tby5idENvbXBvdW5kU2hhcGUoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIF9hZGRFYWNoRGVzY2VuZGFudChlbnRpdHkpIHtcbiAgICAgICAgaWYgKCFlbnRpdHkuY29sbGlzaW9uIHx8IGVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQgPSB0aGlzO1xuXG4gICAgICAgIGlmIChlbnRpdHkgIT09IHRoaXMuZW50aXR5KSB7XG4gICAgICAgICAgICBlbnRpdHkuY29sbGlzaW9uLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUVhY2hEZXNjZW5kYW50KGVudGl0eSkge1xuICAgICAgICBpZiAoIWVudGl0eS5jb2xsaXNpb24pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ICE9PSB0aGlzKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ID0gbnVsbDtcblxuICAgICAgICBpZiAoZW50aXR5ICE9PSB0aGlzLmVudGl0eSAmJiAhZW50aXR5LnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyhlbnRpdHkuY29sbGlzaW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVFYWNoRGVzY2VuZGFudFRyYW5zZm9ybShlbnRpdHkpIHtcbiAgICAgICAgaWYgKCFlbnRpdHkuY29sbGlzaW9uIHx8IGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50ICE9PSB0aGlzLmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb24uc3lzdGVtLnVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0oZW50aXR5KTtcbiAgICB9XG59XG5cbi8qKlxuICogTWFuYWdlcyBjcmVhdGlvbiBvZiB7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50fXMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICovXG5jbGFzcyBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIHJ1bm5pbmcge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ2NvbGxpc2lvbic7XG5cbiAgICAgICAgdGhpcy5Db21wb25lbnRUeXBlID0gQ29sbGlzaW9uQ29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gQ29sbGlzaW9uQ29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnMgPSB7IH07XG5cbiAgICAgICAgdGhpcy5fdHJpTWVzaENhY2hlID0geyB9O1xuXG4gICAgICAgIHRoaXMub24oJ2JlZm9yZXJlbW92ZScsIHRoaXMub25CZWZvcmVSZW1vdmUsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIF9kYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIHByb3BlcnRpZXMgPSBbXG4gICAgICAgICAgICAndHlwZScsXG4gICAgICAgICAgICAnaGFsZkV4dGVudHMnLFxuICAgICAgICAgICAgJ3JhZGl1cycsXG4gICAgICAgICAgICAnYXhpcycsXG4gICAgICAgICAgICAnaGVpZ2h0JyxcbiAgICAgICAgICAgICdzaGFwZScsXG4gICAgICAgICAgICAnbW9kZWwnLFxuICAgICAgICAgICAgJ2Fzc2V0JyxcbiAgICAgICAgICAgICdyZW5kZXInLFxuICAgICAgICAgICAgJ3JlbmRlckFzc2V0JyxcbiAgICAgICAgICAgICdlbmFibGVkJyxcbiAgICAgICAgICAgICdsaW5lYXJPZmZzZXQnLFxuICAgICAgICAgICAgJ2FuZ3VsYXJPZmZzZXQnXG4gICAgICAgIF07XG5cbiAgICAgICAgLy8gZHVwbGljYXRlIHRoZSBpbnB1dCBkYXRhIGJlY2F1c2Ugd2UgYXJlIG1vZGlmeWluZyBpdFxuICAgICAgICBjb25zdCBkYXRhID0ge307XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wZXJ0aWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IHByb3BlcnRpZXNbaV07XG4gICAgICAgICAgICBkYXRhW3Byb3BlcnR5XSA9IF9kYXRhW3Byb3BlcnR5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2V0IHRha2VzIHByaW9yaXR5IG92ZXIgbW9kZWxcbiAgICAgICAgLy8gYnV0IHRoZXkgYXJlIGJvdGggdHJ5aW5nIHRvIGNoYW5nZSB0aGUgbWVzaFxuICAgICAgICAvLyBzbyByZW1vdmUgb25lIG9mIHRoZW0gdG8gYXZvaWQgY29uZmxpY3RzXG4gICAgICAgIGxldCBpZHg7XG4gICAgICAgIGlmIChfZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXNzZXQnKSkge1xuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdtb2RlbCcpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdyZW5kZXInKTtcbiAgICAgICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChfZGF0YS5oYXNPd25Qcm9wZXJ0eSgnbW9kZWwnKSkge1xuICAgICAgICAgICAgaWR4ID0gcHJvcGVydGllcy5pbmRleE9mKCdhc3NldCcpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkYXRhLnR5cGUpIHtcbiAgICAgICAgICAgIGRhdGEudHlwZSA9IGNvbXBvbmVudC5kYXRhLnR5cGU7XG4gICAgICAgIH1cbiAgICAgICAgY29tcG9uZW50LmRhdGEudHlwZSA9IGRhdGEudHlwZTtcblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmhhbGZFeHRlbnRzKSkge1xuICAgICAgICAgICAgZGF0YS5oYWxmRXh0ZW50cyA9IG5ldyBWZWMzKGRhdGEuaGFsZkV4dGVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YS5saW5lYXJPZmZzZXQpKSB7XG4gICAgICAgICAgICBkYXRhLmxpbmVhck9mZnNldCA9IG5ldyBWZWMzKGRhdGEubGluZWFyT2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEuYW5ndWxhck9mZnNldCkpIHtcbiAgICAgICAgICAgIC8vIEFsbG93IGZvciBldWxlciBhbmdsZXMgdG8gYmUgcGFzc2VkIGFzIGEgMyBsZW5ndGggYXJyYXlcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlcyA9IGRhdGEuYW5ndWxhck9mZnNldDtcbiAgICAgICAgICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5hbmd1bGFyT2Zmc2V0ID0gbmV3IFF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXModmFsdWVzWzBdLCB2YWx1ZXNbMV0sIHZhbHVlc1syXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRhdGEuYW5ndWxhck9mZnNldCA9IG5ldyBRdWF0KGRhdGEuYW5ndWxhck9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbXBsID0gdGhpcy5fY3JlYXRlSW1wbGVtZW50YXRpb24oZGF0YS50eXBlKTtcbiAgICAgICAgaW1wbC5iZWZvcmVJbml0aWFsaXplKGNvbXBvbmVudCwgZGF0YSk7XG5cbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKTtcblxuICAgICAgICBpbXBsLmFmdGVySW5pdGlhbGl6ZShjb21wb25lbnQsIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZXMgYW4gaW1wbGVtZW50YXRpb24gYmFzZWQgb24gdGhlIGNvbGxpc2lvbiB0eXBlIGFuZCBjYWNoZXMgaXRcbiAgICAvLyBpbiBhbiBpbnRlcm5hbCBpbXBsZW1lbnRhdGlvbnMgc3RydWN0dXJlLCBiZWZvcmUgcmV0dXJuaW5nIGl0LlxuICAgIF9jcmVhdGVJbXBsZW1lbnRhdGlvbih0eXBlKSB7XG4gICAgICAgIGlmICh0aGlzLmltcGxlbWVudGF0aW9uc1t0eXBlXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZXQgaW1wbDtcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2JveCc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQm94U3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3BoZXJlJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25TcGhlcmVTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjYXBzdWxlJzpcbiAgICAgICAgICAgICAgICAgICAgaW1wbCA9IG5ldyBDb2xsaXNpb25DYXBzdWxlU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY3lsaW5kZXInOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbkN5bGluZGVyU3lzdGVtSW1wbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnY29uZSc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ29uZVN5c3RlbUltcGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ21lc2gnOlxuICAgICAgICAgICAgICAgICAgICBpbXBsID0gbmV3IENvbGxpc2lvbk1lc2hTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wb3VuZCc6XG4gICAgICAgICAgICAgICAgICAgIGltcGwgPSBuZXcgQ29sbGlzaW9uQ29tcG91bmRTeXN0ZW1JbXBsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgX2NyZWF0ZUltcGxlbWVudGF0aW9uOiBJbnZhbGlkIGNvbGxpc2lvbiBzeXN0ZW0gdHlwZTogJHt0eXBlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbdHlwZV0gPSBpbXBsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGVtZW50YXRpb25zW3R5cGVdO1xuICAgIH1cblxuICAgIC8vIEdldHMgYW4gZXhpc3RpbmcgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgZW50aXR5XG4gICAgX2dldEltcGxlbWVudGF0aW9uKGVudGl0eSkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbXBsZW1lbnRhdGlvbnNbZW50aXR5LmNvbGxpc2lvbi5kYXRhLnR5cGVdO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEltcGxlbWVudGF0aW9uKGVudGl0eSkuY2xvbmUoZW50aXR5LCBjbG9uZSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbY29tcG9uZW50LmRhdGEudHlwZV0uYmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgICAgY29tcG9uZW50Lm9uQmVmb3JlUmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoZW50aXR5LCBkYXRhKSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW2RhdGEudHlwZV0ucmVtb3ZlKGVudGl0eSwgZGF0YSk7XG4gICAgfVxuXG4gICAgdXBkYXRlQ29tcG91bmRDaGlsZFRyYW5zZm9ybShlbnRpdHkpIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyB1c2UgdXBkYXRlQ2hpbGRUcmFuc2Zvcm0gb25jZSBpdCBpcyBleHBvc2VkIGluIGFtbW8uanNcblxuICAgICAgICB0aGlzLl9yZW1vdmVDb21wb3VuZENoaWxkKGVudGl0eS5jb2xsaXNpb24uX2NvbXBvdW5kUGFyZW50LCBlbnRpdHkuY29sbGlzaW9uLmRhdGEuc2hhcGUpO1xuXG4gICAgICAgIGlmIChlbnRpdHkuZW5hYmxlZCAmJiBlbnRpdHkuY29sbGlzaW9uLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybSA9IHRoaXMuX2dldE5vZGVUcmFuc2Zvcm0oZW50aXR5LCBlbnRpdHkuY29sbGlzaW9uLl9jb21wb3VuZFBhcmVudC5lbnRpdHkpO1xuICAgICAgICAgICAgZW50aXR5LmNvbGxpc2lvbi5fY29tcG91bmRQYXJlbnQuc2hhcGUuYWRkQ2hpbGRTaGFwZSh0cmFuc2Zvcm0sIGVudGl0eS5jb2xsaXNpb24uZGF0YS5zaGFwZSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodHJhbnNmb3JtKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW1vdmVDb21wb3VuZENoaWxkKGNvbGxpc2lvbiwgc2hhcGUpIHtcbiAgICAgICAgaWYgKGNvbGxpc2lvbi5zaGFwZS5yZW1vdmVDaGlsZFNoYXBlKSB7XG4gICAgICAgICAgICBjb2xsaXNpb24uc2hhcGUucmVtb3ZlQ2hpbGRTaGFwZShzaGFwZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBpbmQgPSBjb2xsaXNpb24uX2dldENvbXBvdW5kQ2hpbGRTaGFwZUluZGV4KHNoYXBlKTtcbiAgICAgICAgICAgIGlmIChpbmQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb2xsaXNpb24uc2hhcGUucmVtb3ZlQ2hpbGRTaGFwZUJ5SW5kZXgoaW5kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uVHJhbnNmb3JtQ2hhbmdlZChjb21wb25lbnQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgdGhpcy5pbXBsZW1lbnRhdGlvbnNbY29tcG9uZW50LmRhdGEudHlwZV0udXBkYXRlVHJhbnNmb3JtKGNvbXBvbmVudCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSk7XG4gICAgfVxuXG4gICAgLy8gRGVzdHJveXMgdGhlIHByZXZpb3VzIGNvbGxpc2lvbiB0eXBlIGFuZCBjcmVhdGVzIGEgbmV3IG9uZSBiYXNlZCBvbiB0aGUgbmV3IHR5cGUgcHJvdmlkZWRcbiAgICBjaGFuZ2VUeXBlKGNvbXBvbmVudCwgcHJldmlvdXNUeXBlLCBuZXdUeXBlKSB7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW3ByZXZpb3VzVHlwZV0uYmVmb3JlUmVtb3ZlKGNvbXBvbmVudC5lbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICAgIHRoaXMuaW1wbGVtZW50YXRpb25zW3ByZXZpb3VzVHlwZV0ucmVtb3ZlKGNvbXBvbmVudC5lbnRpdHksIGNvbXBvbmVudC5kYXRhKTtcbiAgICAgICAgdGhpcy5fY3JlYXRlSW1wbGVtZW50YXRpb24obmV3VHlwZSkucmVzZXQoY29tcG9uZW50LCBjb21wb25lbnQuZGF0YSk7XG4gICAgfVxuXG4gICAgLy8gUmVjcmVhdGVzIHJpZ2lkIGJvZGllcyBvciB0cmlnZ2VycyBmb3IgdGhlIHNwZWNpZmllZCBjb21wb25lbnRcbiAgICByZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCkge1xuICAgICAgICB0aGlzLmltcGxlbWVudGF0aW9uc1tjb21wb25lbnQuZGF0YS50eXBlXS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZU5vZGVSZWxhdGl2ZVRyYW5zZm9ybShub2RlLCByZWxhdGl2ZSkge1xuICAgICAgICBpZiAobm9kZSA9PT0gcmVsYXRpdmUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFNjYWxlKCk7XG4gICAgICAgICAgICBtYXQ0LnNldFNjYWxlKHNjYWxlLngsIHNjYWxlLnksIHNjYWxlLnopO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlTm9kZVJlbGF0aXZlVHJhbnNmb3JtKG5vZGUucGFyZW50LCByZWxhdGl2ZSk7XG4gICAgICAgICAgICBtYXQ0Lm11bChub2RlLmdldExvY2FsVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2dldE5vZGVTY2FsaW5nKG5vZGUpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICBjb25zdCBzY2wgPSB3dG0uZ2V0U2NhbGUoKTtcbiAgICAgICAgcmV0dXJuIG5ldyBBbW1vLmJ0VmVjdG9yMyhzY2wueCwgc2NsLnksIHNjbC56KTtcbiAgICB9XG5cbiAgICBfZ2V0Tm9kZVRyYW5zZm9ybShub2RlLCByZWxhdGl2ZSkge1xuICAgICAgICBsZXQgcG9zLCByb3Q7XG5cbiAgICAgICAgaWYgKHJlbGF0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVOb2RlUmVsYXRpdmVUcmFuc2Zvcm0obm9kZSwgcmVsYXRpdmUpO1xuXG4gICAgICAgICAgICBwb3MgPSBwMTtcbiAgICAgICAgICAgIHJvdCA9IHF1YXQ7XG5cbiAgICAgICAgICAgIG1hdDQuZ2V0VHJhbnNsYXRpb24ocG9zKTtcbiAgICAgICAgICAgIHJvdC5zZXRGcm9tTWF0NChtYXQ0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvcyA9IG5vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIHJvdCA9IG5vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbW1vUXVhdCA9IG5ldyBBbW1vLmJ0UXVhdGVybmlvbigpO1xuICAgICAgICBjb25zdCB0cmFuc2Zvcm0gPSBuZXcgQW1tby5idFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRJZGVudGl0eSgpO1xuICAgICAgICBjb25zdCBvcmlnaW4gPSB0cmFuc2Zvcm0uZ2V0T3JpZ2luKCk7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGUuY29sbGlzaW9uO1xuXG4gICAgICAgIGlmIChjb21wb25lbnQgJiYgY29tcG9uZW50Ll9oYXNPZmZzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGxvID0gY29tcG9uZW50LmRhdGEubGluZWFyT2Zmc2V0O1xuICAgICAgICAgICAgY29uc3QgYW8gPSBjb21wb25lbnQuZGF0YS5hbmd1bGFyT2Zmc2V0O1xuICAgICAgICAgICAgY29uc3QgbmV3T3JpZ2luID0gcDI7XG5cbiAgICAgICAgICAgIHF1YXQuY29weShyb3QpLnRyYW5zZm9ybVZlY3RvcihsbywgbmV3T3JpZ2luKTtcbiAgICAgICAgICAgIG5ld09yaWdpbi5hZGQocG9zKTtcbiAgICAgICAgICAgIHF1YXQuY29weShyb3QpLm11bChhbyk7XG5cbiAgICAgICAgICAgIG9yaWdpbi5zZXRWYWx1ZShuZXdPcmlnaW4ueCwgbmV3T3JpZ2luLnksIG5ld09yaWdpbi56KTtcbiAgICAgICAgICAgIGFtbW9RdWF0LnNldFZhbHVlKHF1YXQueCwgcXVhdC55LCBxdWF0LnosIHF1YXQudyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcmlnaW4uc2V0VmFsdWUocG9zLngsIHBvcy55LCBwb3Mueik7XG4gICAgICAgICAgICBhbW1vUXVhdC5zZXRWYWx1ZShyb3QueCwgcm90LnksIHJvdC56LCByb3Qudyk7XG4gICAgICAgIH1cblxuICAgICAgICB0cmFuc2Zvcm0uc2V0Um90YXRpb24oYW1tb1F1YXQpO1xuICAgICAgICBBbW1vLmRlc3Ryb3koYW1tb1F1YXQpO1xuICAgICAgICBBbW1vLmRlc3Ryb3kob3JpZ2luKTtcblxuICAgICAgICByZXR1cm4gdHJhbnNmb3JtO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuX3RyaU1lc2hDYWNoZSkge1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuX3RyaU1lc2hDYWNoZVtrZXldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3RyaU1lc2hDYWNoZSA9IG51bGw7XG5cbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhDb2xsaXNpb25Db21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsibWF0NCIsIk1hdDQiLCJwMSIsIlZlYzMiLCJwMiIsInF1YXQiLCJRdWF0IiwidGVtcEdyYXBoTm9kZSIsIkdyYXBoTm9kZSIsIl9zY2hlbWEiLCJDb2xsaXNpb25TeXN0ZW1JbXBsIiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJiZWZvcmVJbml0aWFsaXplIiwiY29tcG9uZW50IiwiZGF0YSIsInNoYXBlIiwibW9kZWwiLCJNb2RlbCIsImdyYXBoIiwiYWZ0ZXJJbml0aWFsaXplIiwicmVjcmVhdGVQaHlzaWNhbFNoYXBlcyIsImluaXRpYWxpemVkIiwicmVzZXQiLCJlbnRpdHkiLCJBbW1vIiwidHJpZ2dlciIsImRlc3Ryb3kiLCJfY29tcG91bmRQYXJlbnQiLCJfcmVtb3ZlQ29tcG91bmRDaGlsZCIsInJpZ2lkYm9keSIsImFjdGl2YXRlIiwiZGVzdHJveVNoYXBlIiwiY3JlYXRlUGh5c2ljYWxTaGFwZSIsImZpcnN0Q29tcG91bmRDaGlsZCIsInR5cGUiLCJmb3JFYWNoIiwiX2FkZEVhY2hEZXNjZW5kYW50IiwiaW1wbGVtZW50YXRpb25zIiwiY29tcG91bmQiLCJfdXBkYXRlRWFjaERlc2NlbmRhbnQiLCJwYXJlbnQiLCJjb2xsaXNpb24iLCJnZXROdW1DaGlsZFNoYXBlcyIsInVwZGF0ZUNvbXBvdW5kQ2hpbGRUcmFuc2Zvcm0iLCJkaXNhYmxlU2ltdWxhdGlvbiIsImNyZWF0ZUJvZHkiLCJlbmFibGVkIiwiZW5hYmxlU2ltdWxhdGlvbiIsIlRyaWdnZXIiLCJhcHAiLCJpbml0aWFsaXplIiwidW5kZWZpbmVkIiwidXBkYXRlVHJhbnNmb3JtIiwicG9zaXRpb24iLCJyb3RhdGlvbiIsInNjYWxlIiwiYmVmb3JlUmVtb3ZlIiwiX2Rlc3Ryb3lpbmciLCJyZW1vdmUiLCJib2R5IiwiY2xvbmUiLCJzcmMiLCJzdG9yZSIsImdldEd1aWQiLCJoYWxmRXh0ZW50cyIsIngiLCJ5IiwieiIsImxpbmVhck9mZnNldCIsImFuZ3VsYXJPZmZzZXQiLCJ3IiwicmFkaXVzIiwiYXhpcyIsImhlaWdodCIsImFzc2V0IiwicmVuZGVyQXNzZXQiLCJyZW5kZXIiLCJhZGRDb21wb25lbnQiLCJDb2xsaXNpb25Cb3hTeXN0ZW1JbXBsIiwiaGUiLCJhbW1vSGUiLCJidFZlY3RvcjMiLCJidEJveFNoYXBlIiwiQ29sbGlzaW9uU3BoZXJlU3lzdGVtSW1wbCIsImJ0U3BoZXJlU2hhcGUiLCJDb2xsaXNpb25DYXBzdWxlU3lzdGVtSW1wbCIsIl9kYXRhJGF4aXMiLCJfZGF0YSRyYWRpdXMiLCJfZGF0YSRoZWlnaHQiLCJNYXRoIiwibWF4IiwiYnRDYXBzdWxlU2hhcGVYIiwiYnRDYXBzdWxlU2hhcGUiLCJidENhcHN1bGVTaGFwZVoiLCJDb2xsaXNpb25DeWxpbmRlclN5c3RlbUltcGwiLCJfZGF0YSRheGlzMiIsIl9kYXRhJHJhZGl1czIiLCJfZGF0YSRoZWlnaHQyIiwiYnRDeWxpbmRlclNoYXBlWCIsImJ0Q3lsaW5kZXJTaGFwZSIsImJ0Q3lsaW5kZXJTaGFwZVoiLCJDb2xsaXNpb25Db25lU3lzdGVtSW1wbCIsIl9kYXRhJGF4aXMzIiwiX2RhdGEkcmFkaXVzMyIsIl9kYXRhJGhlaWdodDMiLCJidENvbmVTaGFwZVgiLCJidENvbmVTaGFwZSIsImJ0Q29uZVNoYXBlWiIsIkNvbGxpc2lvbk1lc2hTeXN0ZW1JbXBsIiwiY3JlYXRlQW1tb01lc2giLCJtZXNoIiwibm9kZSIsInRyaU1lc2giLCJfdHJpTWVzaENhY2hlIiwiaWQiLCJ2YiIsInZlcnRleEJ1ZmZlciIsImZvcm1hdCIsImdldEZvcm1hdCIsInN0cmlkZSIsInBvc2l0aW9ucyIsImkiLCJlbGVtZW50cyIsImxlbmd0aCIsImVsZW1lbnQiLCJuYW1lIiwiU0VNQU5USUNfUE9TSVRJT04iLCJGbG9hdDMyQXJyYXkiLCJsb2NrIiwib2Zmc2V0IiwiaW5kaWNlcyIsImdldEluZGljZXMiLCJudW1UcmlhbmdsZXMiLCJwcmltaXRpdmUiLCJjb3VudCIsInYxIiwidjIiLCJ2MyIsImkxIiwiaTIiLCJpMyIsImJhc2UiLCJidFRyaWFuZ2xlTWVzaCIsInNldFZhbHVlIiwiYWRkVHJpYW5nbGUiLCJ1c2VRdWFudGl6ZWRBYWJiQ29tcHJlc3Npb24iLCJ0cmlNZXNoU2hhcGUiLCJidEJ2aFRyaWFuZ2xlTWVzaFNoYXBlIiwic2NhbGluZyIsIl9nZXROb2RlU2NhbGluZyIsInNldExvY2FsU2NhbGluZyIsInRyYW5zZm9ybSIsIl9nZXROb2RlVHJhbnNmb3JtIiwiYWRkQ2hpbGRTaGFwZSIsImJ0Q29tcG91bmRTaGFwZSIsIm1lc2hJbnN0YW5jZXMiLCJtZXNoZXMiLCJlbnRpdHlUcmFuc2Zvcm0iLCJnZXRXb3JsZFRyYW5zZm9ybSIsImdldFNjYWxlIiwidmVjIiwibG9hZEFzc2V0IiwiZG9SZWNyZWF0ZVBoeXNpY2FsU2hhcGUiLCJwcm9wZXJ0eSIsImFzc2V0cyIsImdldCIsInJlYWR5IiwicmVzb3VyY2UiLCJsb2FkIiwib25jZSIsIndvcmxkU2NhbGUiLCJwcmV2aW91c1NjYWxlIiwiZ2V0TG9jYWxTY2FsaW5nIiwibnVtU2hhcGVzIiwiZ2V0Q2hpbGRTaGFwZSIsIkNvbGxpc2lvbkNvbXBvdW5kU3lzdGVtSW1wbCIsIl91cGRhdGVFYWNoRGVzY2VuZGFudFRyYW5zZm9ybSIsIkNvbGxpc2lvbkNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFR5cGUiLCJDb2xsaXNpb25Db21wb25lbnQiLCJEYXRhVHlwZSIsIkNvbGxpc2lvbkNvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwib25SZW1vdmUiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsIl9kYXRhIiwicHJvcGVydGllcyIsImxlbiIsImlkeCIsImhhc093blByb3BlcnR5IiwiaW5kZXhPZiIsInNwbGljZSIsIkFycmF5IiwiaXNBcnJheSIsInZhbHVlcyIsInNldEZyb21FdWxlckFuZ2xlcyIsImltcGwiLCJfY3JlYXRlSW1wbGVtZW50YXRpb24iLCJEZWJ1ZyIsImVycm9yIiwiX2dldEltcGxlbWVudGF0aW9uIiwiY2xvbmVDb21wb25lbnQiLCJyZW1vdmVDaGlsZFNoYXBlIiwiaW5kIiwiX2dldENvbXBvdW5kQ2hpbGRTaGFwZUluZGV4IiwicmVtb3ZlQ2hpbGRTaGFwZUJ5SW5kZXgiLCJvblRyYW5zZm9ybUNoYW5nZWQiLCJjaGFuZ2VUeXBlIiwicHJldmlvdXNUeXBlIiwibmV3VHlwZSIsIl9jYWxjdWxhdGVOb2RlUmVsYXRpdmVUcmFuc2Zvcm0iLCJyZWxhdGl2ZSIsInNldFNjYWxlIiwibXVsIiwiZ2V0TG9jYWxUcmFuc2Zvcm0iLCJ3dG0iLCJzY2wiLCJwb3MiLCJyb3QiLCJnZXRUcmFuc2xhdGlvbiIsInNldEZyb21NYXQ0IiwiZ2V0UG9zaXRpb24iLCJnZXRSb3RhdGlvbiIsImFtbW9RdWF0IiwiYnRRdWF0ZXJuaW9uIiwiYnRUcmFuc2Zvcm0iLCJzZXRJZGVudGl0eSIsIm9yaWdpbiIsImdldE9yaWdpbiIsIl9oYXNPZmZzZXQiLCJsbyIsImFvIiwibmV3T3JpZ2luIiwiY29weSIsInRyYW5zZm9ybVZlY3RvciIsImFkZCIsInNldFJvdGF0aW9uIiwia2V5IiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBa0JBLE1BQU1BLElBQUksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN2QixNQUFNQyxFQUFFLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7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
