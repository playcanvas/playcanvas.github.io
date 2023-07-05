const CompressUtils = {
	setCompressedPRS: function (entity, data, compressed) {
		const a = compressed.singleVecs;
		let b, i;
		const v = data.___1;
		if (!v) {
			b = compressed.tripleVecs;
			i = data.___2;
		}
		let n = v ? v[0] : b[i];
		entity.setLocalPosition(a[n], a[n + 1], a[n + 2]);
		n = v ? v[1] : b[i + 1];
		entity.setLocalEulerAngles(a[n], a[n + 1], a[n + 2]);
		n = v ? v[2] : b[i + 2];
		entity.setLocalScale(a[n], a[n + 1], a[n + 2]);
	},
	oneCharToKey: function (s, data) {
		const i = s.charCodeAt(0) - data.fieldFirstCode;
		return data.fieldArray[i];
	},
	multCharToKey: function (s, data) {
		let ind = 0;
		for (let i = 0; i < s.length; i++) {
			ind = ind * data.fieldCodeBase + s.charCodeAt(i) - data.fieldFirstCode;
		}
		return data.fieldArray[ind];
	}
};

export { CompressUtils };
