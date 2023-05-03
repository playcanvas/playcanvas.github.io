import { RefCountedObject } from '../core/ref-counted-object.js';
import { SkinInstance } from './skin-instance.js';

class SkinInstanceCachedObject extends RefCountedObject {
	constructor(skin, skinInstance) {
		super();
		this.skin = skin;
		this.skinInstance = skinInstance;
	}
}
class SkinInstanceCache {
	static createCachedSkinInstance(skin, rootBone, entity) {
		let skinInst = SkinInstanceCache.getCachedSkinInstance(skin, rootBone);
		if (!skinInst) {
			skinInst = new SkinInstance(skin);
			skinInst.resolve(rootBone, entity);
			SkinInstanceCache.addCachedSkinInstance(skin, rootBone, skinInst);
		}
		return skinInst;
	}
	static getCachedSkinInstance(skin, rootBone) {
		let skinInstance = null;
		const cachedObjArray = SkinInstanceCache._skinInstanceCache.get(rootBone);
		if (cachedObjArray) {
			const cachedObj = cachedObjArray.find(element => element.skin === skin);
			if (cachedObj) {
				cachedObj.incRefCount();
				skinInstance = cachedObj.skinInstance;
			}
		}
		return skinInstance;
	}
	static addCachedSkinInstance(skin, rootBone, skinInstance) {
		let cachedObjArray = SkinInstanceCache._skinInstanceCache.get(rootBone);
		if (!cachedObjArray) {
			cachedObjArray = [];
			SkinInstanceCache._skinInstanceCache.set(rootBone, cachedObjArray);
		}
		let cachedObj = cachedObjArray.find(element => element.skin === skin);
		if (!cachedObj) {
			cachedObj = new SkinInstanceCachedObject(skin, skinInstance);
			cachedObjArray.push(cachedObj);
		}
		cachedObj.incRefCount();
	}
	static removeCachedSkinInstance(skinInstance) {
		if (skinInstance) {
			const rootBone = skinInstance.rootBone;
			if (rootBone) {
				const cachedObjArray = SkinInstanceCache._skinInstanceCache.get(rootBone);
				if (cachedObjArray) {
					const cachedObjIndex = cachedObjArray.findIndex(element => element.skinInstance === skinInstance);
					if (cachedObjIndex >= 0) {
						const cachedObj = cachedObjArray[cachedObjIndex];
						cachedObj.decRefCount();
						if (cachedObj.refCount === 0) {
							cachedObjArray.splice(cachedObjIndex, 1);
							if (!cachedObjArray.length) {
								SkinInstanceCache._skinInstanceCache.delete(rootBone);
							}
							if (skinInstance) {
								skinInstance.destroy();
								cachedObj.skinInstance = null;
							}
						}
					}
				}
			}
		}
	}
}
SkinInstanceCache._skinInstanceCache = new Map();

export { SkinInstanceCache };
