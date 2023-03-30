/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

const _vec3 = new Vec3();
const _quat = new Quat();

/**
 * A collision volume. Use this in conjunction with a {@link RigidBodyComponent} to make a
 * collision volume that can be simulated using the physics engine.
 *
 * If the {@link Entity} does not have a {@link RigidBodyComponent} then this collision volume will
 * act as a trigger volume. When an entity with a dynamic or kinematic body enters or leaves an
 * entity with a trigger volume, both entities will receive trigger events.
 *
 * The following table shows all the events that can be fired between two Entities:
 *
 * |                                       | Rigid Body (Static)                                                   | Rigid Body (Dynamic or Kinematic)                                     | Trigger Volume                                      |
 * | ------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
 * | **Rigid Body (Static)**               |                                                                       | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> |                                                     |
 * | **Rigid Body (Dynamic or Kinematic)** | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>contact</li><li>collisionstart</li><li>collisionend</li></ul> | <ul><li>triggerenter</li><li>triggerleave</li></ul> |
 * | **Trigger Volume**                    |                                                                       | <ul><li>triggerenter</li><li>triggerleave</li></ul>                   |                                                     |
 *
 * @property {string} type The type of the collision volume. Can be:
 *
 * - "box": A box-shaped collision volume.
 * - "capsule": A capsule-shaped collision volume.
 * - "compound": A compound shape. Any descendant entities with a collision component
 * of type box, capsule, cone, cylinder or sphere will be combined into a single, rigid
 * shape.
 * - "cone": A cone-shaped collision volume.
 * - "cylinder": A cylinder-shaped collision volume.
 * - "mesh": A collision volume that uses a model asset as its shape.
 * - "sphere": A sphere-shaped collision volume.
 *
 * Defaults to "box".
 * @property {Vec3} halfExtents The half-extents of the
 * box-shaped collision volume in the x, y and z axes. Defaults to [0.5, 0.5, 0.5].
 * @property {Vec3} linearOffset The positional offset of the collision shape from the Entity position along the local axes.
 * Defaults to [0, 0, 0].
 * @property {Quat} angularOffset The rotational offset of the collision shape from the Entity rotation in local space.
 * Defaults to identity.
 * @property {number} radius The radius of the sphere, capsule, cylinder or cone-shaped collision
 * volumes. Defaults to 0.5.
 * @property {number} axis The local space axis with which the capsule, cylinder or cone-shaped
 * collision volume's length is aligned. 0 for X, 1 for Y and 2 for Z. Defaults to 1 (Y-axis).
 * @property {number} height The total height of the capsule, cylinder or cone-shaped collision
 * volume from tip to tip. Defaults to 2.
 * @property {Asset|number} asset The asset for the model of the mesh collision volume - can also
 * be an asset id. Defaults to null.
 * @property {Asset|number} renderAsset The render asset of the mesh collision volume - can also be
 * an asset id. Defaults to null. If not set then the asset property will be checked instead.
 * @property {import('../../../scene/model.js').Model} model The model that is added to the scene
 * graph for the mesh collision volume.
 * @augments Component
 */
class CollisionComponent extends Component {
  /**
   * Create a new CollisionComponent.
   *
   * @param {import('./system.js').CollisionComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);

    /** @private */
    this._compoundParent = null;
    this._hasOffset = false;
    this.entity.on('insert', this._onInsert, this);
    this.on('set_type', this.onSetType, this);
    this.on('set_halfExtents', this.onSetHalfExtents, this);
    this.on('set_linearOffset', this.onSetOffset, this);
    this.on('set_angularOffset', this.onSetOffset, this);
    this.on('set_radius', this.onSetRadius, this);
    this.on('set_height', this.onSetHeight, this);
    this.on('set_axis', this.onSetAxis, this);
    this.on('set_asset', this.onSetAsset, this);
    this.on('set_renderAsset', this.onSetRenderAsset, this);
    this.on('set_model', this.onSetModel, this);
    this.on('set_render', this.onSetRender, this);
  }

  /**
   * The 'contact' event is fired when a contact occurs between two rigid bodies.
   *
   * @event CollisionComponent#contact
   * @param {ContactResult} result - Details of the contact between the two rigid bodies.
   */

  /**
   * Fired when two rigid bodies start touching.
   *
   * @event CollisionComponent#collisionstart
   * @param {ContactResult} result - Details of the contact between the two Entities.
   */

  /**
   * Fired two rigid-bodies stop touching.
   *
   * @event CollisionComponent#collisionend
   * @param {import('../../entity.js').Entity} other - The {@link Entity} that stopped touching this collision volume.
   */

  /**
   * Fired when a rigid body enters a trigger volume.
   *
   * @event CollisionComponent#triggerenter
   * @param {import('../../entity.js').Entity} other - The {@link Entity} that entered this collision volume.
   */

  /**
   * Fired when a rigid body exits a trigger volume.
   *
   * @event CollisionComponent#triggerleave
   * @param {import('../../entity.js').Entity} other - The {@link Entity} that exited this collision volume.
   */

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetType(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.system.changeType(this, oldValue, newValue);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetHalfExtents(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && t === 'box') {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetOffset(name, oldValue, newValue) {
    this._hasOffset = !this.data.linearOffset.equals(Vec3.ZERO) || !this.data.angularOffset.equals(Quat.IDENTITY);
    if (this.data.initialized) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetRadius(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && (t === 'sphere' || t === 'capsule' || t === 'cylinder' || t === 'cone')) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetHeight(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetAxis(name, oldValue, newValue) {
    const t = this.data.type;
    if (this.data.initialized && (t === 'capsule' || t === 'cylinder' || t === 'cone')) {
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      // Remove old listeners
      const asset = assets.get(oldValue);
      if (asset) {
        asset.off('remove', this.onAssetRemoved, this);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.asset = newValue.id;
      }
      const asset = assets.get(this.data.asset);
      if (asset) {
        // make sure we don't subscribe twice
        asset.off('remove', this.onAssetRemoved, this);
        asset.on('remove', this.onAssetRemoved, this);
      }
    }
    if (this.data.initialized && this.data.type === 'mesh') {
      if (!newValue) {
        // if asset is null set model to null
        // so that it's going to be removed from the simulation
        this.data.model = null;
      }
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetRenderAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      // Remove old listeners
      const asset = assets.get(oldValue);
      if (asset) {
        asset.off('remove', this.onRenderAssetRemoved, this);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.renderAsset = newValue.id;
      }
      const asset = assets.get(this.data.renderAsset);
      if (asset) {
        // make sure we don't subscribe twice
        asset.off('remove', this.onRenderAssetRemoved, this);
        asset.on('remove', this.onRenderAssetRemoved, this);
      }
    }
    if (this.data.initialized && this.data.type === 'mesh') {
      if (!newValue) {
        // if render asset is null set render to null
        // so that it's going to be removed from the simulation
        this.data.render = null;
      }
      this.system.recreatePhysicalShapes(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetModel(name, oldValue, newValue) {
    if (this.data.initialized && this.data.type === 'mesh') {
      // recreate physical shapes skipping loading the model
      // from the 'asset' as the model passed in newValue might
      // have been created procedurally
      this.system.implementations.mesh.doRecreatePhysicalShape(this);
    }
  }

  /**
   * @param {string} name - Property name.
   * @param {*} oldValue - Previous value of the property.
   * @param {*} newValue - New value of the property.
   * @private
   */
  onSetRender(name, oldValue, newValue) {
    this.onSetModel(name, oldValue, newValue);
  }

  /**
   * @param {Asset} asset - Asset that was removed.
   * @private
   */
  onAssetRemoved(asset) {
    asset.off('remove', this.onAssetRemoved, this);
    if (this.data.asset === asset.id) {
      this.asset = null;
    }
  }

  /**
   * @param {Asset} asset - Asset that was removed.
   * @private
   */
  onRenderAssetRemoved(asset) {
    asset.off('remove', this.onRenderAssetRemoved, this);
    if (this.data.renderAsset === asset.id) {
      this.renderAsset = null;
    }
  }

  /**
   * @param {*} shape - Ammo shape.
   * @returns {number|null} The shape's index in the child array of the compound shape.
   * @private
   */
  _getCompoundChildShapeIndex(shape) {
    const compound = this.data.shape;
    const shapes = compound.getNumChildShapes();
    for (let i = 0; i < shapes; i++) {
      const childShape = compound.getChildShape(i);
      if (childShape.ptr === shape.ptr) {
        return i;
      }
    }
    return null;
  }

  /**
   * @param {GraphNode} parent - The parent node.
   * @private
   */
  _onInsert(parent) {
    // TODO
    // if is child of compound shape
    // and there is no change of compoundParent, then update child transform
    // once updateChildTransform is exposed in ammo.js

    if (typeof Ammo === 'undefined') return;
    if (this._compoundParent) {
      this.system.recreatePhysicalShapes(this);
    } else if (!this.entity.rigidbody) {
      let ancestor = this.entity.parent;
      while (ancestor) {
        if (ancestor.collision && ancestor.collision.type === 'compound') {
          if (ancestor.collision.shape.getNumChildShapes() === 0) {
            this.system.recreatePhysicalShapes(ancestor.collision);
          } else {
            this.system.recreatePhysicalShapes(this);
          }
          break;
        }
        ancestor = ancestor.parent;
      }
    }
  }

  /** @private */
  _updateCompound() {
    const entity = this.entity;
    if (entity._dirtyWorld) {
      let dirty = entity._dirtyLocal;
      let parent = entity;
      while (parent && !dirty) {
        if (parent.collision && parent.collision === this._compoundParent) break;
        if (parent._dirtyLocal) dirty = true;
        parent = parent.parent;
      }
      if (dirty) {
        entity.forEach(this.system.implementations.compound._updateEachDescendantTransform, entity);
        const bodyComponent = this._compoundParent.entity.rigidbody;
        if (bodyComponent) bodyComponent.activate();
      }
    }
  }

  /**
   * @description Returns the world position for the collision shape taking into account of any offsets.
   * @returns {Vec3} The world position for the collision shape.
   */
  getShapePosition() {
    const pos = this.entity.getPosition();
    if (this._hasOffset) {
      const rot = this.entity.getRotation();
      const lo = this.data.linearOffset;
      _quat.copy(rot).transformVector(lo, _vec3);
      return _vec3.add(pos);
    }
    return pos;
  }

  /**
   * @description Returns the world rotation for the collision shape taking into account of any offsets.
   * @returns {Quat} The world rotation for the collision.
   */
  getShapeRotation() {
    const rot = this.entity.getRotation();
    if (this._hasOffset) {
      return _quat.copy(rot).mul(this.data.angularOffset);
    }
    return rot;
  }

  /** @private */
  onEnable() {
    if (this.data.type === 'mesh' && (this.data.asset || this.data.renderAsset) && this.data.initialized) {
      const asset = this.system.app.assets.get(this.data.asset || this.data.renderAsset);
      // recreate the collision shape if the model asset is not loaded
      // or the shape does not exist
      if (asset && (!asset.resource || !this.data.shape)) {
        this.system.recreatePhysicalShapes(this);
        return;
      }
    }
    if (this.entity.rigidbody) {
      if (this.entity.rigidbody.enabled) {
        this.entity.rigidbody.enableSimulation();
      }
    } else if (this._compoundParent && this !== this._compoundParent) {
      if (this._compoundParent.shape.getNumChildShapes() === 0) {
        this.system.recreatePhysicalShapes(this._compoundParent);
      } else {
        const transform = this.system._getNodeTransform(this.entity, this._compoundParent.entity);
        this._compoundParent.shape.addChildShape(transform, this.data.shape);
        Ammo.destroy(transform);
        if (this._compoundParent.entity.rigidbody) this._compoundParent.entity.rigidbody.activate();
      }
    } else if (this.entity.trigger) {
      this.entity.trigger.enable();
    }
  }

  /** @private */
  onDisable() {
    if (this.entity.rigidbody) {
      this.entity.rigidbody.disableSimulation();
    } else if (this._compoundParent && this !== this._compoundParent) {
      if (!this._compoundParent.entity._destroying) {
        this.system._removeCompoundChild(this._compoundParent, this.data.shape);
        if (this._compoundParent.entity.rigidbody) this._compoundParent.entity.rigidbody.activate();
      }
    } else if (this.entity.trigger) {
      this.entity.trigger.disable();
    }
  }

  /** @private */
  onBeforeRemove() {
    if (this.asset) {
      this.asset = null;
    }
    if (this.renderAsset) {
      this.renderAsset = null;
    }
    this.entity.off('insert', this._onInsert, this);
    this.off();
  }
}

export { CollisionComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvY29sbGlzaW9uL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmNvbnN0IF92ZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9xdWF0ID0gbmV3IFF1YXQoKTtcblxuLyoqXG4gKiBBIGNvbGxpc2lvbiB2b2x1bWUuIFVzZSB0aGlzIGluIGNvbmp1bmN0aW9uIHdpdGggYSB7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50fSB0byBtYWtlIGFcbiAqIGNvbGxpc2lvbiB2b2x1bWUgdGhhdCBjYW4gYmUgc2ltdWxhdGVkIHVzaW5nIHRoZSBwaHlzaWNzIGVuZ2luZS5cbiAqXG4gKiBJZiB0aGUge0BsaW5rIEVudGl0eX0gZG9lcyBub3QgaGF2ZSBhIHtAbGluayBSaWdpZEJvZHlDb21wb25lbnR9IHRoZW4gdGhpcyBjb2xsaXNpb24gdm9sdW1lIHdpbGxcbiAqIGFjdCBhcyBhIHRyaWdnZXIgdm9sdW1lLiBXaGVuIGFuIGVudGl0eSB3aXRoIGEgZHluYW1pYyBvciBraW5lbWF0aWMgYm9keSBlbnRlcnMgb3IgbGVhdmVzIGFuXG4gKiBlbnRpdHkgd2l0aCBhIHRyaWdnZXIgdm9sdW1lLCBib3RoIGVudGl0aWVzIHdpbGwgcmVjZWl2ZSB0cmlnZ2VyIGV2ZW50cy5cbiAqXG4gKiBUaGUgZm9sbG93aW5nIHRhYmxlIHNob3dzIGFsbCB0aGUgZXZlbnRzIHRoYXQgY2FuIGJlIGZpcmVkIGJldHdlZW4gdHdvIEVudGl0aWVzOlxuICpcbiAqIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFJpZ2lkIEJvZHkgKFN0YXRpYykgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFJpZ2lkIEJvZHkgKER5bmFtaWMgb3IgS2luZW1hdGljKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8IFRyaWdnZXIgVm9sdW1lICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gfFxuICogfCAqKlJpZ2lkIEJvZHkgKFN0YXRpYykqKiAgICAgICAgICAgICAgIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgPHVsPjxsaT5jb250YWN0PC9saT48bGk+Y29sbGlzaW9uc3RhcnQ8L2xpPjxsaT5jb2xsaXNpb25lbmQ8L2xpPjwvdWw+IHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgKipSaWdpZCBCb2R5IChEeW5hbWljIG9yIEtpbmVtYXRpYykqKiB8IDx1bD48bGk+Y29udGFjdDwvbGk+PGxpPmNvbGxpc2lvbnN0YXJ0PC9saT48bGk+Y29sbGlzaW9uZW5kPC9saT48L3VsPiB8IDx1bD48bGk+Y29udGFjdDwvbGk+PGxpPmNvbGxpc2lvbnN0YXJ0PC9saT48bGk+Y29sbGlzaW9uZW5kPC9saT48L3VsPiB8IDx1bD48bGk+dHJpZ2dlcmVudGVyPC9saT48bGk+dHJpZ2dlcmxlYXZlPC9saT48L3VsPiB8XG4gKiB8ICoqVHJpZ2dlciBWb2x1bWUqKiAgICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCA8dWw+PGxpPnRyaWdnZXJlbnRlcjwvbGk+PGxpPnRyaWdnZXJsZWF2ZTwvbGk+PC91bD4gICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB0eXBlIFRoZSB0eXBlIG9mIHRoZSBjb2xsaXNpb24gdm9sdW1lLiBDYW4gYmU6XG4gKlxuICogLSBcImJveFwiOiBBIGJveC1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZS5cbiAqIC0gXCJjYXBzdWxlXCI6IEEgY2Fwc3VsZS1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZS5cbiAqIC0gXCJjb21wb3VuZFwiOiBBIGNvbXBvdW5kIHNoYXBlLiBBbnkgZGVzY2VuZGFudCBlbnRpdGllcyB3aXRoIGEgY29sbGlzaW9uIGNvbXBvbmVudFxuICogb2YgdHlwZSBib3gsIGNhcHN1bGUsIGNvbmUsIGN5bGluZGVyIG9yIHNwaGVyZSB3aWxsIGJlIGNvbWJpbmVkIGludG8gYSBzaW5nbGUsIHJpZ2lkXG4gKiBzaGFwZS5cbiAqIC0gXCJjb25lXCI6IEEgY29uZS1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZS5cbiAqIC0gXCJjeWxpbmRlclwiOiBBIGN5bGluZGVyLXNoYXBlZCBjb2xsaXNpb24gdm9sdW1lLlxuICogLSBcIm1lc2hcIjogQSBjb2xsaXNpb24gdm9sdW1lIHRoYXQgdXNlcyBhIG1vZGVsIGFzc2V0IGFzIGl0cyBzaGFwZS5cbiAqIC0gXCJzcGhlcmVcIjogQSBzcGhlcmUtc2hhcGVkIGNvbGxpc2lvbiB2b2x1bWUuXG4gKlxuICogRGVmYXVsdHMgdG8gXCJib3hcIi5cbiAqIEBwcm9wZXJ0eSB7VmVjM30gaGFsZkV4dGVudHMgVGhlIGhhbGYtZXh0ZW50cyBvZiB0aGVcbiAqIGJveC1zaGFwZWQgY29sbGlzaW9uIHZvbHVtZSBpbiB0aGUgeCwgeSBhbmQgeiBheGVzLiBEZWZhdWx0cyB0byBbMC41LCAwLjUsIDAuNV0uXG4gKiBAcHJvcGVydHkge1ZlYzN9IGxpbmVhck9mZnNldCBUaGUgcG9zaXRpb25hbCBvZmZzZXQgb2YgdGhlIGNvbGxpc2lvbiBzaGFwZSBmcm9tIHRoZSBFbnRpdHkgcG9zaXRpb24gYWxvbmcgdGhlIGxvY2FsIGF4ZXMuXG4gKiBEZWZhdWx0cyB0byBbMCwgMCwgMF0uXG4gKiBAcHJvcGVydHkge1F1YXR9IGFuZ3VsYXJPZmZzZXQgVGhlIHJvdGF0aW9uYWwgb2Zmc2V0IG9mIHRoZSBjb2xsaXNpb24gc2hhcGUgZnJvbSB0aGUgRW50aXR5IHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlLlxuICogRGVmYXVsdHMgdG8gaWRlbnRpdHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gcmFkaXVzIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSwgY2Fwc3VsZSwgY3lsaW5kZXIgb3IgY29uZS1zaGFwZWQgY29sbGlzaW9uXG4gKiB2b2x1bWVzLiBEZWZhdWx0cyB0byAwLjUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYXhpcyBUaGUgbG9jYWwgc3BhY2UgYXhpcyB3aXRoIHdoaWNoIHRoZSBjYXBzdWxlLCBjeWxpbmRlciBvciBjb25lLXNoYXBlZFxuICogY29sbGlzaW9uIHZvbHVtZSdzIGxlbmd0aCBpcyBhbGlnbmVkLiAwIGZvciBYLCAxIGZvciBZIGFuZCAyIGZvciBaLiBEZWZhdWx0cyB0byAxIChZLWF4aXMpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhlaWdodCBUaGUgdG90YWwgaGVpZ2h0IG9mIHRoZSBjYXBzdWxlLCBjeWxpbmRlciBvciBjb25lLXNoYXBlZCBjb2xsaXNpb25cbiAqIHZvbHVtZSBmcm9tIHRpcCB0byB0aXAuIERlZmF1bHRzIHRvIDIuXG4gKiBAcHJvcGVydHkge0Fzc2V0fG51bWJlcn0gYXNzZXQgVGhlIGFzc2V0IGZvciB0aGUgbW9kZWwgb2YgdGhlIG1lc2ggY29sbGlzaW9uIHZvbHVtZSAtIGNhbiBhbHNvXG4gKiBiZSBhbiBhc3NldCBpZC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR8bnVtYmVyfSByZW5kZXJBc3NldCBUaGUgcmVuZGVyIGFzc2V0IG9mIHRoZSBtZXNoIGNvbGxpc2lvbiB2b2x1bWUgLSBjYW4gYWxzbyBiZVxuICogYW4gYXNzZXQgaWQuIERlZmF1bHRzIHRvIG51bGwuIElmIG5vdCBzZXQgdGhlbiB0aGUgYXNzZXQgcHJvcGVydHkgd2lsbCBiZSBjaGVja2VkIGluc3RlYWQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnKS5Nb2RlbH0gbW9kZWwgVGhlIG1vZGVsIHRoYXQgaXMgYWRkZWQgdG8gdGhlIHNjZW5lXG4gKiBncmFwaCBmb3IgdGhlIG1lc2ggY29sbGlzaW9uIHZvbHVtZS5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgQ29sbGlzaW9uQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ29sbGlzaW9uQ29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fY29tcG91bmRQYXJlbnQgPSBudWxsO1xuICAgICAgICB0aGlzLl9oYXNPZmZzZXQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmVudGl0eS5vbignaW5zZXJ0JywgdGhpcy5fb25JbnNlcnQsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMub24oJ3NldF90eXBlJywgdGhpcy5vblNldFR5cGUsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfaGFsZkV4dGVudHMnLCB0aGlzLm9uU2V0SGFsZkV4dGVudHMsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbGluZWFyT2Zmc2V0JywgdGhpcy5vblNldE9mZnNldCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9hbmd1bGFyT2Zmc2V0JywgdGhpcy5vblNldE9mZnNldCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9yYWRpdXMnLCB0aGlzLm9uU2V0UmFkaXVzLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2hlaWdodCcsIHRoaXMub25TZXRIZWlnaHQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfYXhpcycsIHRoaXMub25TZXRBeGlzLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2Fzc2V0JywgdGhpcy5vblNldEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X3JlbmRlckFzc2V0JywgdGhpcy5vblNldFJlbmRlckFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X21vZGVsJywgdGhpcy5vblNldE1vZGVsLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X3JlbmRlcicsIHRoaXMub25TZXRSZW5kZXIsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSAnY29udGFjdCcgZXZlbnQgaXMgZmlyZWQgd2hlbiBhIGNvbnRhY3Qgb2NjdXJzIGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudCBDb2xsaXNpb25Db21wb25lbnQjY29udGFjdFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0YXJ0IHRvdWNoaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IENvbGxpc2lvbkNvbXBvbmVudCNjb2xsaXNpb25zdGFydFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gRW50aXRpZXMuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB0d28gcmlnaWQtYm9kaWVzIHN0b3AgdG91Y2hpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQ29sbGlzaW9uQ29tcG9uZW50I2NvbGxpc2lvbmVuZFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IG90aGVyIC0gVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgc3RvcHBlZCB0b3VjaGluZyB0aGlzIGNvbGxpc2lvbiB2b2x1bWUuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgcmlnaWQgYm9keSBlbnRlcnMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBDb2xsaXNpb25Db21wb25lbnQjdHJpZ2dlcmVudGVyXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gdGhhdCBlbnRlcmVkIHRoaXMgY29sbGlzaW9uIHZvbHVtZS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSByaWdpZCBib2R5IGV4aXRzIGEgdHJpZ2dlciB2b2x1bWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQ29sbGlzaW9uQ29tcG9uZW50I3RyaWdnZXJsZWF2ZVxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IG90aGVyIC0gVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgZXhpdGVkIHRoaXMgY29sbGlzaW9uIHZvbHVtZS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRUeXBlKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAob2xkVmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5jaGFuZ2VUeXBlKHRoaXMsIG9sZFZhbHVlLCBuZXdWYWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFByb3BlcnR5IG5hbWUuXG4gICAgICogQHBhcmFtIHsqfSBvbGRWYWx1ZSAtIFByZXZpb3VzIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcGFyYW0geyp9IG5ld1ZhbHVlIC0gTmV3IHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uU2V0SGFsZkV4dGVudHMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLmRhdGEudHlwZTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5pbml0aWFsaXplZCAmJiB0ID09PSAnYm94Jykge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRPZmZzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2hhc09mZnNldCA9ICF0aGlzLmRhdGEubGluZWFyT2Zmc2V0LmVxdWFscyhWZWMzLlpFUk8pIHx8ICF0aGlzLmRhdGEuYW5ndWxhck9mZnNldC5lcXVhbHMoUXVhdC5JREVOVElUWSk7XG5cbiAgICAgICAgaWYgKHRoaXMuZGF0YS5pbml0aWFsaXplZCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRSYWRpdXMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLmRhdGEudHlwZTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5pbml0aWFsaXplZCAmJiAodCA9PT0gJ3NwaGVyZScgfHwgdCA9PT0gJ2NhcHN1bGUnIHx8IHQgPT09ICdjeWxpbmRlcicgfHwgdCA9PT0gJ2NvbmUnKSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRIZWlnaHQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLmRhdGEudHlwZTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5pbml0aWFsaXplZCAmJiAodCA9PT0gJ2NhcHN1bGUnIHx8IHQgPT09ICdjeWxpbmRlcicgfHwgdCA9PT0gJ2NvbmUnKSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRBeGlzKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBjb25zdCB0ID0gdGhpcy5kYXRhLnR5cGU7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuaW5pdGlhbGl6ZWQgJiYgKHQgPT09ICdjYXBzdWxlJyB8fCB0ID09PSAnY3lsaW5kZXInIHx8IHQgPT09ICdjb25lJykpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXModGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFByb3BlcnR5IG5hbWUuXG4gICAgICogQHBhcmFtIHsqfSBvbGRWYWx1ZSAtIFByZXZpb3VzIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcGFyYW0geyp9IG5ld1ZhbHVlIC0gTmV3IHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uU2V0QXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgaWYgKG9sZFZhbHVlKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgb2xkIGxpc3RlbmVyc1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG9sZFZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLmFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLmRhdGEuYXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGRvbid0IHN1YnNjcmliZSB0d2ljZVxuICAgICAgICAgICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZGF0YS5pbml0aWFsaXplZCAmJiB0aGlzLmRhdGEudHlwZSA9PT0gJ21lc2gnKSB7XG4gICAgICAgICAgICBpZiAoIW5ld1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgYXNzZXQgaXMgbnVsbCBzZXQgbW9kZWwgdG8gbnVsbFxuICAgICAgICAgICAgICAgIC8vIHNvIHRoYXQgaXQncyBnb2luZyB0byBiZSByZW1vdmVkIGZyb20gdGhlIHNpbXVsYXRpb25cbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEubW9kZWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ucmVjcmVhdGVQaHlzaWNhbFNoYXBlcyh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gUHJvcGVydHkgbmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IG9sZFZhbHVlIC0gUHJldmlvdXMgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBOZXcgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25TZXRSZW5kZXJBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQgbGlzdGVuZXJzXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQob2xkVmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uUmVuZGVyQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEucmVuZGVyQXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuZGF0YS5yZW5kZXJBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYWtlIHN1cmUgd2UgZG9uJ3Qgc3Vic2NyaWJlIHR3aWNlXG4gICAgICAgICAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uUmVuZGVyQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5vblJlbmRlckFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5kYXRhLmluaXRpYWxpemVkICYmIHRoaXMuZGF0YS50eXBlID09PSAnbWVzaCcpIHtcbiAgICAgICAgICAgIGlmICghbmV3VmFsdWUpIHtcbiAgICAgICAgICAgICAgICAvLyBpZiByZW5kZXIgYXNzZXQgaXMgbnVsbCBzZXQgcmVuZGVyIHRvIG51bGxcbiAgICAgICAgICAgICAgICAvLyBzbyB0aGF0IGl0J3MgZ29pbmcgdG8gYmUgcmVtb3ZlZCBmcm9tIHRoZSBzaW11bGF0aW9uXG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLnJlbmRlciA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldE1vZGVsKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5kYXRhLmluaXRpYWxpemVkICYmIHRoaXMuZGF0YS50eXBlID09PSAnbWVzaCcpIHtcbiAgICAgICAgICAgIC8vIHJlY3JlYXRlIHBoeXNpY2FsIHNoYXBlcyBza2lwcGluZyBsb2FkaW5nIHRoZSBtb2RlbFxuICAgICAgICAgICAgLy8gZnJvbSB0aGUgJ2Fzc2V0JyBhcyB0aGUgbW9kZWwgcGFzc2VkIGluIG5ld1ZhbHVlIG1pZ2h0XG4gICAgICAgICAgICAvLyBoYXZlIGJlZW4gY3JlYXRlZCBwcm9jZWR1cmFsbHlcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmltcGxlbWVudGF0aW9ucy5tZXNoLmRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBQcm9wZXJ0eSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBQcmV2aW91cyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblNldFJlbmRlcihuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgdGhpcy5vblNldE1vZGVsKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBBc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25Bc3NldFJlbW92ZWQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5hc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuYXNzZXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBBc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25SZW5kZXJBc3NldFJlbW92ZWQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uUmVuZGVyQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5yZW5kZXJBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQXNzZXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBzaGFwZSAtIEFtbW8gc2hhcGUuXG4gICAgICogQHJldHVybnMge251bWJlcnxudWxsfSBUaGUgc2hhcGUncyBpbmRleCBpbiB0aGUgY2hpbGQgYXJyYXkgb2YgdGhlIGNvbXBvdW5kIHNoYXBlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldENvbXBvdW5kQ2hpbGRTaGFwZUluZGV4KHNoYXBlKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvdW5kID0gdGhpcy5kYXRhLnNoYXBlO1xuICAgICAgICBjb25zdCBzaGFwZXMgPSBjb21wb3VuZC5nZXROdW1DaGlsZFNoYXBlcygpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhcGVzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkU2hhcGUgPSBjb21wb3VuZC5nZXRDaGlsZFNoYXBlKGkpO1xuICAgICAgICAgICAgaWYgKGNoaWxkU2hhcGUucHRyID09PSBzaGFwZS5wdHIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBwYXJlbnQgLSBUaGUgcGFyZW50IG5vZGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25JbnNlcnQocGFyZW50KSB7XG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gaWYgaXMgY2hpbGQgb2YgY29tcG91bmQgc2hhcGVcbiAgICAgICAgLy8gYW5kIHRoZXJlIGlzIG5vIGNoYW5nZSBvZiBjb21wb3VuZFBhcmVudCwgdGhlbiB1cGRhdGUgY2hpbGQgdHJhbnNmb3JtXG4gICAgICAgIC8vIG9uY2UgdXBkYXRlQ2hpbGRUcmFuc2Zvcm0gaXMgZXhwb3NlZCBpbiBhbW1vLmpzXG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vID09PSAndW5kZWZpbmVkJylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fY29tcG91bmRQYXJlbnQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXModGhpcyk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuZW50aXR5LnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgbGV0IGFuY2VzdG9yID0gdGhpcy5lbnRpdHkucGFyZW50O1xuICAgICAgICAgICAgd2hpbGUgKGFuY2VzdG9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuY2VzdG9yLmNvbGxpc2lvbiAmJiBhbmNlc3Rvci5jb2xsaXNpb24udHlwZSA9PT0gJ2NvbXBvdW5kJykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYW5jZXN0b3IuY29sbGlzaW9uLnNoYXBlLmdldE51bUNoaWxkU2hhcGVzKCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXMoYW5jZXN0b3IuY29sbGlzaW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXModGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFuY2VzdG9yID0gYW5jZXN0b3IucGFyZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3VwZGF0ZUNvbXBvdW5kKCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgaWYgKGVudGl0eS5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgbGV0IGRpcnR5ID0gZW50aXR5Ll9kaXJ0eUxvY2FsO1xuICAgICAgICAgICAgbGV0IHBhcmVudCA9IGVudGl0eTtcbiAgICAgICAgICAgIHdoaWxlIChwYXJlbnQgJiYgIWRpcnR5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHBhcmVudC5jb2xsaXNpb24gJiYgcGFyZW50LmNvbGxpc2lvbiA9PT0gdGhpcy5fY29tcG91bmRQYXJlbnQpXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgaWYgKHBhcmVudC5fZGlydHlMb2NhbClcbiAgICAgICAgICAgICAgICAgICAgZGlydHkgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRpcnR5KSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LmZvckVhY2godGhpcy5zeXN0ZW0uaW1wbGVtZW50YXRpb25zLmNvbXBvdW5kLl91cGRhdGVFYWNoRGVzY2VuZGFudFRyYW5zZm9ybSwgZW50aXR5KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHlDb21wb25lbnQgPSB0aGlzLl9jb21wb3VuZFBhcmVudC5lbnRpdHkucmlnaWRib2R5O1xuICAgICAgICAgICAgICAgIGlmIChib2R5Q29tcG9uZW50KVxuICAgICAgICAgICAgICAgICAgICBib2R5Q29tcG9uZW50LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvbiBSZXR1cm5zIHRoZSB3b3JsZCBwb3NpdGlvbiBmb3IgdGhlIGNvbGxpc2lvbiBzaGFwZSB0YWtpbmcgaW50byBhY2NvdW50IG9mIGFueSBvZmZzZXRzLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgcG9zaXRpb24gZm9yIHRoZSBjb2xsaXNpb24gc2hhcGUuXG4gICAgICovXG4gICAgZ2V0U2hhcGVQb3NpdGlvbigpIHtcbiAgICAgICAgY29uc3QgcG9zID0gdGhpcy5lbnRpdHkuZ2V0UG9zaXRpb24oKTtcblxuICAgICAgICBpZiAodGhpcy5faGFzT2Zmc2V0KSB7XG4gICAgICAgICAgICBjb25zdCByb3QgPSB0aGlzLmVudGl0eS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgY29uc3QgbG8gPSB0aGlzLmRhdGEubGluZWFyT2Zmc2V0O1xuXG4gICAgICAgICAgICBfcXVhdC5jb3B5KHJvdCkudHJhbnNmb3JtVmVjdG9yKGxvLCBfdmVjMyk7XG4gICAgICAgICAgICByZXR1cm4gX3ZlYzMuYWRkKHBvcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcG9zO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvbiBSZXR1cm5zIHRoZSB3b3JsZCByb3RhdGlvbiBmb3IgdGhlIGNvbGxpc2lvbiBzaGFwZSB0YWtpbmcgaW50byBhY2NvdW50IG9mIGFueSBvZmZzZXRzLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgd29ybGQgcm90YXRpb24gZm9yIHRoZSBjb2xsaXNpb24uXG4gICAgICovXG4gICAgZ2V0U2hhcGVSb3RhdGlvbigpIHtcbiAgICAgICAgY29uc3Qgcm90ID0gdGhpcy5lbnRpdHkuZ2V0Um90YXRpb24oKTtcblxuICAgICAgICBpZiAodGhpcy5faGFzT2Zmc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4gX3F1YXQuY29weShyb3QpLm11bCh0aGlzLmRhdGEuYW5ndWxhck9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm90O1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5kYXRhLnR5cGUgPT09ICdtZXNoJyAmJiAodGhpcy5kYXRhLmFzc2V0IHx8IHRoaXMuZGF0YS5yZW5kZXJBc3NldCkgJiYgdGhpcy5kYXRhLmluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuZGF0YS5hc3NldCB8fCB0aGlzLmRhdGEucmVuZGVyQXNzZXQpO1xuICAgICAgICAgICAgLy8gcmVjcmVhdGUgdGhlIGNvbGxpc2lvbiBzaGFwZSBpZiB0aGUgbW9kZWwgYXNzZXQgaXMgbm90IGxvYWRlZFxuICAgICAgICAgICAgLy8gb3IgdGhlIHNoYXBlIGRvZXMgbm90IGV4aXN0XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgKCFhc3NldC5yZXNvdXJjZSB8fCAhdGhpcy5kYXRhLnNoYXBlKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLnJlY3JlYXRlUGh5c2ljYWxTaGFwZXModGhpcyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LnJpZ2lkYm9keS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkucmlnaWRib2R5LmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9jb21wb3VuZFBhcmVudCAmJiB0aGlzICE9PSB0aGlzLl9jb21wb3VuZFBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NvbXBvdW5kUGFyZW50LnNoYXBlLmdldE51bUNoaWxkU2hhcGVzKCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5yZWNyZWF0ZVBoeXNpY2FsU2hhcGVzKHRoaXMuX2NvbXBvdW5kUGFyZW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gdGhpcy5zeXN0ZW0uX2dldE5vZGVUcmFuc2Zvcm0odGhpcy5lbnRpdHksIHRoaXMuX2NvbXBvdW5kUGFyZW50LmVudGl0eSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29tcG91bmRQYXJlbnQuc2hhcGUuYWRkQ2hpbGRTaGFwZSh0cmFuc2Zvcm0sIHRoaXMuZGF0YS5zaGFwZSk7XG4gICAgICAgICAgICAgICAgQW1tby5kZXN0cm95KHRyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29tcG91bmRQYXJlbnQuZW50aXR5LnJpZ2lkYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnRyaWdnZXIuZW5hYmxlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2NvbXBvdW5kUGFyZW50ICYmIHRoaXMgIT09IHRoaXMuX2NvbXBvdW5kUGFyZW50KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5fZGVzdHJveWluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9yZW1vdmVDb21wb3VuZENoaWxkKHRoaXMuX2NvbXBvdW5kUGFyZW50LCB0aGlzLmRhdGEuc2hhcGUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbXBvdW5kUGFyZW50LmVudGl0eS5yaWdpZGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS50cmlnZ2VyLmRpc2FibGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIG9uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICBpZiAodGhpcy5hc3NldCkge1xuICAgICAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMucmVuZGVyQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyQXNzZXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdpbnNlcnQnLCB0aGlzLl9vbkluc2VydCwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IENvbGxpc2lvbkNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIl92ZWMzIiwiVmVjMyIsIl9xdWF0IiwiUXVhdCIsIkNvbGxpc2lvbkNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX2NvbXBvdW5kUGFyZW50IiwiX2hhc09mZnNldCIsIm9uIiwiX29uSW5zZXJ0Iiwib25TZXRUeXBlIiwib25TZXRIYWxmRXh0ZW50cyIsIm9uU2V0T2Zmc2V0Iiwib25TZXRSYWRpdXMiLCJvblNldEhlaWdodCIsIm9uU2V0QXhpcyIsIm9uU2V0QXNzZXQiLCJvblNldFJlbmRlckFzc2V0Iiwib25TZXRNb2RlbCIsIm9uU2V0UmVuZGVyIiwibmFtZSIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJjaGFuZ2VUeXBlIiwidCIsImRhdGEiLCJ0eXBlIiwiaW5pdGlhbGl6ZWQiLCJyZWNyZWF0ZVBoeXNpY2FsU2hhcGVzIiwibGluZWFyT2Zmc2V0IiwiZXF1YWxzIiwiWkVSTyIsImFuZ3VsYXJPZmZzZXQiLCJJREVOVElUWSIsImFzc2V0cyIsImFwcCIsImFzc2V0IiwiZ2V0Iiwib2ZmIiwib25Bc3NldFJlbW92ZWQiLCJBc3NldCIsImlkIiwibW9kZWwiLCJvblJlbmRlckFzc2V0UmVtb3ZlZCIsInJlbmRlckFzc2V0IiwicmVuZGVyIiwiaW1wbGVtZW50YXRpb25zIiwibWVzaCIsImRvUmVjcmVhdGVQaHlzaWNhbFNoYXBlIiwiX2dldENvbXBvdW5kQ2hpbGRTaGFwZUluZGV4Iiwic2hhcGUiLCJjb21wb3VuZCIsInNoYXBlcyIsImdldE51bUNoaWxkU2hhcGVzIiwiaSIsImNoaWxkU2hhcGUiLCJnZXRDaGlsZFNoYXBlIiwicHRyIiwicGFyZW50IiwiQW1tbyIsInJpZ2lkYm9keSIsImFuY2VzdG9yIiwiY29sbGlzaW9uIiwiX3VwZGF0ZUNvbXBvdW5kIiwiX2RpcnR5V29ybGQiLCJkaXJ0eSIsIl9kaXJ0eUxvY2FsIiwiZm9yRWFjaCIsIl91cGRhdGVFYWNoRGVzY2VuZGFudFRyYW5zZm9ybSIsImJvZHlDb21wb25lbnQiLCJhY3RpdmF0ZSIsImdldFNoYXBlUG9zaXRpb24iLCJwb3MiLCJnZXRQb3NpdGlvbiIsInJvdCIsImdldFJvdGF0aW9uIiwibG8iLCJjb3B5IiwidHJhbnNmb3JtVmVjdG9yIiwiYWRkIiwiZ2V0U2hhcGVSb3RhdGlvbiIsIm11bCIsIm9uRW5hYmxlIiwicmVzb3VyY2UiLCJlbmFibGVkIiwiZW5hYmxlU2ltdWxhdGlvbiIsInRyYW5zZm9ybSIsIl9nZXROb2RlVHJhbnNmb3JtIiwiYWRkQ2hpbGRTaGFwZSIsImRlc3Ryb3kiLCJ0cmlnZ2VyIiwiZW5hYmxlIiwib25EaXNhYmxlIiwiZGlzYWJsZVNpbXVsYXRpb24iLCJfZGVzdHJveWluZyIsIl9yZW1vdmVDb21wb3VuZENoaWxkIiwiZGlzYWJsZSIsIm9uQmVmb3JlUmVtb3ZlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBT0EsTUFBTUEsS0FBSyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3hCLE1BQU1DLEtBQUssR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTs7QUFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
