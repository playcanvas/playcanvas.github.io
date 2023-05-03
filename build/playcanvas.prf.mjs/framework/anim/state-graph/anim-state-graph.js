class AnimStateGraph {
	constructor(data) {
		this._layers = [];
		this._parameters = {};
		if (!Array.isArray(data.layers)) {
			for (const layerId in data.layers) {
				const dataLayer = data.layers[layerId];
				const layer = {
					name: dataLayer.name,
					blendType: dataLayer.blendType,
					weight: dataLayer.weight,
					states: [],
					transitions: []
				};
				for (let i = 0; i < dataLayer.states.length; i++) {
					layer.states.push(data.states[dataLayer.states[i]]);
				}
				for (let i = 0; i < dataLayer.transitions.length; i++) {
					const dataLayerTransition = data.transitions[dataLayer.transitions[i]];
					if (dataLayerTransition.conditions && !Array.isArray(dataLayerTransition.conditions)) {
						const conditionKeys = Object.keys(dataLayerTransition.conditions);
						const conditions = [];
						for (let j = 0; j < conditionKeys.length; j++) {
							const condition = dataLayerTransition.conditions[conditionKeys[j]];
							if (condition.parameterName) {
								conditions.push(condition);
							}
						}
						dataLayerTransition.conditions = conditions;
					}
					if (Number.isInteger(dataLayerTransition.from)) {
						dataLayerTransition.from = data.states[dataLayerTransition.from].name;
					}
					if (Number.isInteger(dataLayerTransition.to)) {
						dataLayerTransition.to = data.states[dataLayerTransition.to].name;
					}
					layer.transitions.push(dataLayerTransition);
				}
				this._layers.push(layer);
			}
		} else {
			this._layers = data.layers;
		}
		for (const paramId in data.parameters) {
			const param = data.parameters[paramId];
			this._parameters[param.name] = {
				type: param.type,
				value: param.value
			};
		}
	}
	get parameters() {
		return Object.assign({}, this._parameters);
	}
	get layers() {
		return this._layers;
	}
}

export { AnimStateGraph };
