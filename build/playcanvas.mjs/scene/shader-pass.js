import '../core/debug.js';
import { SHADER_DEPTH, SHADER_PICK, SHADER_FORWARD, SHADER_FORWARDHDR } from './constants.js';
import { DeviceCache } from '../platform/graphics/device-cache.js';

const shaderPassDeviceCache = new DeviceCache();
class ShaderPassInfo {
	constructor(name, index, options = {}) {
		this.index = void 0;
		this.name = void 0;
		this.shaderDefine = void 0;
		this.name = name;
		this.index = index;
		Object.assign(this, options);
		this.initShaderDefines();
	}
	initShaderDefines() {
		let keyword;
		if (this.isShadow) {
			keyword = 'SHADOW';
		} else if (this.isForward) {
			keyword = 'FORWARD';
		} else if (this.index === SHADER_DEPTH) {
			keyword = 'DEPTH';
		} else if (this.index === SHADER_PICK) {
			keyword = 'PICK';
		}
		const define1 = keyword ? `#define ${keyword}_PASS\n` : '';
		const define2 = `#define ${this.name.toUpperCase()}_PASS\n`;
		this.shaderDefines = define1 + define2;
	}
}
class ShaderPass {
	constructor() {
		this.passesNamed = new Map();
		this.passesIndexed = [];
		this.nextIndex = 0;
		const add = (name, index, options) => {
			this.allocate(name, options);
		};
		add('forward', SHADER_FORWARD, {
			isForward: true
		});
		add('forward_hdr', SHADER_FORWARDHDR, {
			isForward: true
		});
		add('depth');
		add('pick');
		add('shadow');
	}
	static get(device) {
		return shaderPassDeviceCache.get(device, () => {
			return new ShaderPass();
		});
	}
	allocate(name, options) {
		let info = this.passesNamed.get(name);
		if (info === undefined) {
			info = new ShaderPassInfo(name, this.nextIndex, options);
			this.passesNamed.set(info.name, info);
			this.passesIndexed[info.index] = info;
			this.nextIndex++;
		}
		return info;
	}
	getByIndex(index) {
		const info = this.passesIndexed[index];
		return info;
	}
	getByName(name) {
		return this.passesNamed.get(name);
	}
}

export { ShaderPass, ShaderPassInfo };
