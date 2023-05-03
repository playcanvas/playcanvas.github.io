import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { getDefaultMaterial } from '../../../scene/materials/default-material.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { RenderComponent } from './component.js';
import { RenderComponentData } from './data.js';

const _schema = [{
	name: 'rootBone',
	type: 'entity'
}, 'enabled'];
const _properties = ['material', 'meshInstances', 'asset', 'materialAssets', 'castShadows', 'receiveShadows', 'castShadowsLightmap', 'lightmapped', 'lightmapSizeMultiplier', 'renderStyle', 'type', 'layers', 'isStatic', 'batchGroupId'];
class RenderComponentSystem extends ComponentSystem {
	constructor(app) {
		super(app);
		this.id = 'render';
		this.ComponentType = RenderComponent;
		this.DataType = RenderComponentData;
		this.schema = _schema;
		this.defaultMaterial = getDefaultMaterial(app.graphicsDevice);
		this.on('beforeremove', this.onRemove, this);
	}
	initializeComponentData(component, _data, properties) {
		if (_data.batchGroupId === null || _data.batchGroupId === undefined) {
			_data.batchGroupId = -1;
		}
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
		const data = {};
		for (let i = 0; i < _properties.length; i++) {
			data[_properties[i]] = entity.render[_properties[i]];
		}
		data.enabled = entity.render.enabled;
		delete data.meshInstances;
		const component = this.addComponent(clone, data);
		const srcMeshInstances = entity.render.meshInstances;
		const meshes = srcMeshInstances.map(mi => mi.mesh);
		component._onSetMeshes(meshes);
		for (let m = 0; m < srcMeshInstances.length; m++) {
			component.meshInstances[m].material = srcMeshInstances[m].material;
		}
		if (entity.render.customAabb) {
			component.customAabb = entity.render.customAabb.clone();
		}
		return component;
	}
	onRemove(entity, component) {
		component.onRemove();
	}
}
Component._buildAccessors(RenderComponent.prototype, _schema);

export { RenderComponentSystem };
