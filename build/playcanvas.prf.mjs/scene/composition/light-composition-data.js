class LightCompositionData {
	constructor() {
		this.shadowCastersSet = new Set();
		this.shadowCastersList = [];
	}
	clearShadowCasters() {
		this.shadowCastersSet.clear();
		this.shadowCastersList.length = 0;
	}
	addShadowCasters(casters) {
		for (let i = 0; i < casters.length; i++) {
			const item = casters[i];
			if (!this.shadowCastersSet.has(item)) {
				this.shadowCastersSet.add(item);
				this.shadowCastersList.push(item);
			}
		}
	}
}

export { LightCompositionData };
