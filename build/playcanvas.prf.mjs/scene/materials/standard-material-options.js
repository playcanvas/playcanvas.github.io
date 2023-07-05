import { LitOptions } from './lit-options.js';

class StandardMaterialOptions {
	constructor() {
		this._pass = 0;
		this._isForwardPass = false;
		this.chunks = [];
		this.forceUv1 = false;
		this.ambientTint = false;
		this.diffuseTint = false;
		this.specularTint = false;
		this.metalnessTint = false;
		this.glossTint = false;
		this.emissiveTint = false;
		this.opacityTint = false;
		this.emissiveEncoding = 'linear';
		this.lightMapEncoding = 'linear';
		this.packedNormal = false;
		this.glossInvert = false;
		this.sheenGlossInvert = false;
		this.clearCoatGlossInvert = false;
		this.litOptions = new LitOptions();
	}
	set pass(p) {
		this._pass = p;
		this.litOptions._pass = p;
	}
	get pass() {
		return this._pass;
	}
	set isForwardPass(value) {
		this._isForwardPass = value;
		this.litOptions._isForwardPass = value;
	}
	get isForwardPass() {
		return this._isForwardPass;
	}
}

export { StandardMaterialOptions };
