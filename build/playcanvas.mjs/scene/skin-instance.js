import '../core/debug.js';
import { math } from '../core/math/math.js';
import { Mat4 } from '../core/math/mat4.js';
import { PIXELFORMAT_RGBA32F, FILTER_NEAREST } from '../platform/graphics/constants.js';
import { Texture } from '../platform/graphics/texture.js';

const _invMatrix = new Mat4();
class SkinInstance {
	constructor(skin) {
		this.bones = void 0;
		this._dirty = true;
		this._rootBone = null;
		this._skinUpdateIndex = -1;
		this._updateBeforeCull = true;
		if (skin) {
			this.initSkin(skin);
		}
	}
	set rootBone(rootBone) {
		this._rootBone = rootBone;
	}
	get rootBone() {
		return this._rootBone;
	}
	init(device, numBones) {
		if (device.supportsBoneTextures) {
			const numPixels = numBones * 3;
			let width = Math.ceil(Math.sqrt(numPixels));
			width = math.roundUp(width, 3);
			const height = Math.ceil(numPixels / width);
			this.boneTexture = new Texture(device, {
				width: width,
				height: height,
				format: PIXELFORMAT_RGBA32F,
				mipmaps: false,
				minFilter: FILTER_NEAREST,
				magFilter: FILTER_NEAREST,
				name: 'skin'
			});
			this.matrixPalette = this.boneTexture.lock();
		} else {
			this.matrixPalette = new Float32Array(numBones * 12);
		}
	}
	destroy() {
		if (this.boneTexture) {
			this.boneTexture.destroy();
			this.boneTexture = null;
		}
	}
	resolve(rootBone, entity) {
		this.rootBone = rootBone;
		const skin = this.skin;
		const bones = [];
		for (let j = 0; j < skin.boneNames.length; j++) {
			const boneName = skin.boneNames[j];
			let bone = rootBone.findByName(boneName);
			if (!bone) {
				bone = entity;
			}
			bones.push(bone);
		}
		this.bones = bones;
	}
	initSkin(skin) {
		this.skin = skin;
		this.bones = [];
		const numBones = skin.inverseBindPose.length;
		this.init(skin.device, numBones);
		this.matrices = [];
		for (let i = 0; i < numBones; i++) {
			this.matrices[i] = new Mat4();
		}
	}
	uploadBones(device) {
		if (device.supportsBoneTextures) {
			this.boneTexture.lock();
			this.boneTexture.unlock();
		}
	}
	_updateMatrices(rootNode, skinUpdateIndex) {
		if (this._skinUpdateIndex !== skinUpdateIndex) {
			this._skinUpdateIndex = skinUpdateIndex;
			_invMatrix.copy(rootNode.getWorldTransform()).invert();
			for (let i = this.bones.length - 1; i >= 0; i--) {
				this.matrices[i].mulAffine2(_invMatrix, this.bones[i].getWorldTransform());
				this.matrices[i].mulAffine2(this.matrices[i], this.skin.inverseBindPose[i]);
			}
		}
	}
	updateMatrices(rootNode, skinUpdateIndex) {
		if (this._updateBeforeCull) {
			this._updateMatrices(rootNode, skinUpdateIndex);
		}
	}
	updateMatrixPalette(rootNode, skinUpdateIndex) {
		this._updateMatrices(rootNode, skinUpdateIndex);
		const mp = this.matrixPalette;
		const count = this.bones.length;
		for (let i = 0; i < count; i++) {
			const pe = this.matrices[i].data;
			const base = i * 12;
			mp[base] = pe[0];
			mp[base + 1] = pe[4];
			mp[base + 2] = pe[8];
			mp[base + 3] = pe[12];
			mp[base + 4] = pe[1];
			mp[base + 5] = pe[5];
			mp[base + 6] = pe[9];
			mp[base + 7] = pe[13];
			mp[base + 8] = pe[2];
			mp[base + 9] = pe[6];
			mp[base + 10] = pe[10];
			mp[base + 11] = pe[14];
		}
		this.uploadBones(this.skin.device);
	}
}

export { SkinInstance };
