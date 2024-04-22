import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { GSplatComponent } from './component.js';
import { GSplatComponentData } from './data.js';

const _schema = ['enabled'];
const _properties = ['instance', 'asset', 'layers'];
class GSplatComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'gsplat';
    this.ComponentType = GSplatComponent;
    this.DataType = GSplatComponentData;
    this.schema = _schema;
    this.on('beforeremove', this.onRemove, this);
  }
  initializeComponentData(component, _data, properties) {
    if (_data.layers && _data.layers.length) {
      _data.layers = _data.layers.slice(0);
    }
    for (let i = 0; i < _properties.length; i++) {
      if (_data.hasOwnProperty(_properties[i])) {
        component[_properties[i]] = _data[_properties[i]];
      }
    }
    if (_data.aabbCenter && _data.aabbHalfExtents) {
      component.customAabb = new BoundingBox(new Vec3(_data.aabbCenter), new Vec3(_data.aabbHalfExtents));
    }
    super.initializeComponentData(component, _data, _schema);
  }
  cloneComponent(entity, clone) {
    const gSplatComponent = entity.gsplat;
    const data = {};
    for (let i = 0; i < _properties.length; i++) {
      data[_properties[i]] = gSplatComponent[_properties[i]];
    }
    data.enabled = gSplatComponent.enabled;
    delete data.instance;
    const component = this.addComponent(clone, data);
    component.instance = gSplatComponent.instance.clone();
    if (gSplatComponent.customAabb) {
      component.customAabb = gSplatComponent.customAabb.clone();
    }
    return component;
  }
  onRemove(entity, component) {
    component.onRemove();
  }
}
Component._buildAccessors(GSplatComponent.prototype, _schema);

export { GSplatComponentSystem };
