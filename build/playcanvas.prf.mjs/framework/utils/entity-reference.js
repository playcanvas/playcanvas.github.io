import { Component } from '../components/component.js';
import { Entity } from '../entity.js';
import { EventHandler } from '../../core/event-handler.js';

class EntityReference extends EventHandler {
	constructor(parentComponent, entityPropertyName, eventConfig) {
		super();
		if (!parentComponent || !(parentComponent instanceof Component)) {
			throw new Error('The parentComponent argument is required and must be a Component');
		} else if (!entityPropertyName || typeof entityPropertyName !== 'string') {
			throw new Error('The propertyName argument is required and must be a string');
		} else if (eventConfig && typeof eventConfig !== 'object') {
			throw new Error('If provided, the eventConfig argument must be an object');
		}
		this._parentComponent = parentComponent;
		this._entityPropertyName = entityPropertyName;
		this._entity = null;
		this._app = parentComponent.system.app;
		this._configureEventListeners(eventConfig || {}, {
			'entity#destroy': this._onEntityDestroy
		});
		this._toggleLifecycleListeners('on');
	}
	_configureEventListeners(externalEventConfig, internalEventConfig) {
		const externalEventListenerConfigs = this._parseEventListenerConfig(externalEventConfig, 'external', this._parentComponent);
		const internalEventListenerConfigs = this._parseEventListenerConfig(internalEventConfig, 'internal', this);
		this._eventListenerConfigs = externalEventListenerConfigs.concat(internalEventListenerConfigs);
		this._listenerStatusFlags = {};
		this._gainListeners = {};
		this._loseListeners = {};
	}
	_parseEventListenerConfig(eventConfig, prefix, scope) {
		return Object.keys(eventConfig).map(function (listenerDescription, index) {
			const listenerDescriptionParts = listenerDescription.split('#');
			const sourceName = listenerDescriptionParts[0];
			const eventName = listenerDescriptionParts[1];
			const callback = eventConfig[listenerDescription];
			if (listenerDescriptionParts.length !== 2 || typeof sourceName !== 'string' || sourceName.length === 0 || typeof eventName !== 'string' || eventName.length === 0) {
				throw new Error('Invalid event listener description: `' + listenerDescription + '`');
			}
			if (typeof callback !== 'function') {
				throw new Error('Invalid or missing callback for event listener `' + listenerDescription + '`');
			}
			return {
				id: prefix + '_' + index + '_' + listenerDescription,
				sourceName: sourceName,
				eventName: eventName,
				callback: callback,
				scope: scope
			};
		}, this);
	}
	_toggleLifecycleListeners(onOrOff) {
		this._parentComponent[onOrOff]('set_' + this._entityPropertyName, this._onSetEntity, this);
		this._parentComponent.system[onOrOff]('beforeremove', this._onParentComponentRemove, this);
		this._app.systems[onOrOff]('postPostInitialize', this._updateEntityReference, this);
		this._app[onOrOff]('tools:sceneloaded', this._onSceneLoaded, this);
		const allComponentSystems = [];
		for (let i = 0; i < this._eventListenerConfigs.length; ++i) {
			const config = this._eventListenerConfigs[i];
			const componentSystem = this._app.systems[config.sourceName];
			if (componentSystem) {
				if (allComponentSystems.indexOf(componentSystem) === -1) {
					allComponentSystems.push(componentSystem);
				}
				if (componentSystem && config.eventName === 'gain') {
					this._gainListeners[config.sourceName] = config;
				}
				if (componentSystem && config.eventName === 'lose') {
					this._loseListeners[config.sourceName] = config;
				}
			}
		}
		for (let i = 0; i < allComponentSystems.length; ++i) {
			allComponentSystems[i][onOrOff]('add', this._onComponentAdd, this);
			allComponentSystems[i][onOrOff]('beforeremove', this._onComponentRemove, this);
		}
	}
	_onSetEntity(name, oldValue, newValue) {
		if (newValue instanceof Entity) {
			this._updateEntityReference();
		} else {
			if (newValue !== null && newValue !== undefined && typeof newValue !== 'string') {
				console.warn("Entity field `" + this._entityPropertyName + "` was set to unexpected type '" + typeof newValue + "'");
				return;
			}
			if (oldValue !== newValue) {
				this._updateEntityReference();
			}
		}
	}
	onParentComponentEnable() {
		if (!this._entity) {
			this._updateEntityReference();
		}
	}
	_onSceneLoaded() {
		this._updateEntityReference();
	}
	_updateEntityReference() {
		let nextEntityGuid = this._parentComponent.data[this._entityPropertyName];
		let nextEntity;
		if (nextEntityGuid instanceof Entity) {
			nextEntity = nextEntityGuid;
			nextEntityGuid = nextEntity.getGuid();
			this._parentComponent.data[this._entityPropertyName] = nextEntityGuid;
		} else {
			const root = this._parentComponent.system.app.root;
			const isOnSceneGraph = this._parentComponent.entity.isDescendantOf(root);
			nextEntity = isOnSceneGraph && nextEntityGuid ? root.findByGuid(nextEntityGuid) : null;
		}
		const hasChanged = this._entity !== nextEntity;
		if (hasChanged) {
			if (this._entity) {
				this._onBeforeEntityChange();
			}
			this._entity = nextEntity;
			if (this._entity) {
				this._onAfterEntityChange();
			}
			this.fire('set:entity', this._entity);
		}
	}
	_onBeforeEntityChange() {
		this._toggleEntityListeners('off');
		this._callAllGainOrLoseListeners(this._loseListeners);
	}
	_onAfterEntityChange() {
		this._toggleEntityListeners('on');
		this._callAllGainOrLoseListeners(this._gainListeners);
	}
	_onComponentAdd(entity, component) {
		const componentName = component.system.id;
		if (entity === this._entity) {
			this._callGainOrLoseListener(componentName, this._gainListeners);
			this._toggleComponentListeners('on', componentName);
		}
	}
	_onComponentRemove(entity, component) {
		const componentName = component.system.id;
		if (entity === this._entity) {
			this._callGainOrLoseListener(componentName, this._loseListeners);
			this._toggleComponentListeners('off', componentName, true);
		}
	}
	_callAllGainOrLoseListeners(listenerMap) {
		for (const componentName in this._entity.c) {
			this._callGainOrLoseListener(componentName, listenerMap);
		}
	}
	_callGainOrLoseListener(componentName, listenerMap) {
		if (this._entity.c.hasOwnProperty(componentName) && listenerMap[componentName]) {
			const config = listenerMap[componentName];
			config.callback.call(config.scope);
		}
	}
	_toggleEntityListeners(onOrOff, isDestroying) {
		if (this._entity) {
			for (let i = 0; i < this._eventListenerConfigs.length; ++i) {
				this._safeToggleListener(onOrOff, this._eventListenerConfigs[i], isDestroying);
			}
		}
	}
	_toggleComponentListeners(onOrOff, componentName, isDestroying) {
		for (let i = 0; i < this._eventListenerConfigs.length; ++i) {
			const config = this._eventListenerConfigs[i];
			if (config.sourceName === componentName) {
				this._safeToggleListener(onOrOff, config, isDestroying);
			}
		}
	}
	_safeToggleListener(onOrOff, config, isDestroying) {
		const isAdding = onOrOff === 'on';
		if (isAdding && this._listenerStatusFlags[config.id]) {
			return;
		}
		const source = this._getEventSource(config.sourceName, isDestroying);
		if (source) {
			source[onOrOff](config.eventName, config.callback, config.scope);
			this._listenerStatusFlags[config.id] = isAdding;
		}
	}
	_getEventSource(sourceName, isDestroying) {
		if (sourceName === 'entity') {
			return this._entity;
		}
		const component = this._entity[sourceName];
		if (component) {
			return component;
		}
		if (!isDestroying) {
			console.warn('Entity has no component with name ' + sourceName);
		}
		return null;
	}
	_onEntityDestroy(entity) {
		if (this._entity === entity) {
			this._toggleEntityListeners('off', true);
			this._entity = null;
		}
	}
	_onParentComponentRemove(entity, component) {
		if (component === this._parentComponent) {
			this._toggleLifecycleListeners('off');
			this._toggleEntityListeners('off', true);
		}
	}
	hasComponent(componentName) {
		return this._entity && this._entity.c ? !!this._entity.c[componentName] : false;
	}
	get entity() {
		return this._entity;
	}
}

export { EntityReference };
