import { Vec2 } from '../../core/math/vec2.js';
import { random } from '../../core/math/random.js';
import { LIGHTTYPE_DIRECTIONAL } from '../../scene/constants.js';
import { BakeLight } from './bake-light.js';

const _tempPoint = new Vec2();
class BakeLightSimple extends BakeLight {
	get numVirtualLights() {
		if (this.light.type === LIGHTTYPE_DIRECTIONAL) {
			return this.light.bakeNumSamples;
		}
		return 1;
	}
	prepareVirtualLight(index, numVirtualLights) {
		const light = this.light;
		light._node.setLocalRotation(this.rotation);
		if (index > 0) {
			const directionalSpreadAngle = light.bakeArea;
			random.circlePointDeterministic(_tempPoint, index, numVirtualLights);
			_tempPoint.mulScalar(directionalSpreadAngle * 0.5);
			light._node.rotateLocal(_tempPoint.x, 0, _tempPoint.y);
		}
		light._node.getWorldTransform();
		const gamma = this.scene.gammaCorrection ? 2.2 : 1;
		const linearIntensity = Math.pow(this.intensity, gamma);
		light.intensity = Math.pow(linearIntensity / numVirtualLights, 1 / gamma);
	}
}

export { BakeLightSimple };
