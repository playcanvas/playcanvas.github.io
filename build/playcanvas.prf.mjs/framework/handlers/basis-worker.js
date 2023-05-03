function BasisWorker() {
	const BASIS_FORMAT = {
		cTFETC1: 0,
		cTFETC2: 1,
		cTFBC1: 2,
		cTFBC3: 3,
		cTFPVRTC1_4_RGB: 8,
		cTFPVRTC1_4_RGBA: 9,
		cTFASTC_4x4: 10,
		cTFATC_RGB: 11,
		cTFATC_RGBA_INTERPOLATED_ALPHA: 12,
		cTFRGBA32: 13,
		cTFRGB565: 14,
		cTFRGBA4444: 16
	};
	const opaqueMapping = {
		astc: BASIS_FORMAT.cTFASTC_4x4,
		dxt: BASIS_FORMAT.cTFBC1,
		etc1: BASIS_FORMAT.cTFETC1,
		etc2: BASIS_FORMAT.cTFETC1,
		pvr: BASIS_FORMAT.cTFPVRTC1_4_RGB,
		atc: BASIS_FORMAT.cTFATC_RGB,
		none: BASIS_FORMAT.cTFRGB565
	};
	const alphaMapping = {
		astc: BASIS_FORMAT.cTFASTC_4x4,
		dxt: BASIS_FORMAT.cTFBC3,
		etc1: BASIS_FORMAT.cTFRGBA4444,
		etc2: BASIS_FORMAT.cTFETC2,
		pvr: BASIS_FORMAT.cTFPVRTC1_4_RGBA,
		atc: BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA,
		none: BASIS_FORMAT.cTFRGBA4444
	};
	const PIXEL_FORMAT = {
		ETC1: 21,
		ETC2_RGB: 22,
		ETC2_RGBA: 23,
		DXT1: 8,
		DXT5: 10,
		PVRTC_4BPP_RGB_1: 26,
		PVRTC_4BPP_RGBA_1: 27,
		ASTC_4x4: 28,
		ATC_RGB: 29,
		ATC_RGBA: 30,
		R8_G8_B8_A8: 7,
		R5_G6_B5: 3,
		R4_G4_B4_A4: 5
	};
	const basisToEngineMapping = (basisFormat, deviceDetails) => {
		switch (basisFormat) {
			case BASIS_FORMAT.cTFETC1:
				return deviceDetails.formats.etc1 ? PIXEL_FORMAT.ETC1 : PIXEL_FORMAT.ETC2_RGB;
			case BASIS_FORMAT.cTFETC2:
				return PIXEL_FORMAT.ETC2_RGBA;
			case BASIS_FORMAT.cTFBC1:
				return PIXEL_FORMAT.DXT1;
			case BASIS_FORMAT.cTFBC3:
				return PIXEL_FORMAT.DXT5;
			case BASIS_FORMAT.cTFPVRTC1_4_RGB:
				return PIXEL_FORMAT.PVRTC_4BPP_RGB_1;
			case BASIS_FORMAT.cTFPVRTC1_4_RGBA:
				return PIXEL_FORMAT.PVRTC_4BPP_RGBA_1;
			case BASIS_FORMAT.cTFASTC_4x4:
				return PIXEL_FORMAT.ASTC_4x4;
			case BASIS_FORMAT.cTFATC_RGB:
				return PIXEL_FORMAT.ATC_RGB;
			case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA:
				return PIXEL_FORMAT.ATC_RGBA;
			case BASIS_FORMAT.cTFRGBA32:
				return PIXEL_FORMAT.R8_G8_B8_A8;
			case BASIS_FORMAT.cTFRGB565:
				return PIXEL_FORMAT.R5_G6_B5;
			case BASIS_FORMAT.cTFRGBA4444:
				return PIXEL_FORMAT.R4_G4_B4_A4;
		}
	};
	const unswizzleGGGR = data => {
		const genB = function genB(R, G) {
			const r = R * (2.0 / 255.0) - 1.0;
			const g = G * (2.0 / 255.0) - 1.0;
			const b = Math.sqrt(1.0 - Math.min(1.0, r * r + g * g));
			return Math.max(0, Math.min(255, Math.floor((b + 1.0) * 0.5 * 255.0)));
		};
		for (let offset = 0; offset < data.length; offset += 4) {
			const R = data[offset + 3];
			const G = data[offset + 1];
			data[offset + 0] = R;
			data[offset + 2] = genB(R, G);
			data[offset + 3] = 255;
		}
		return data;
	};
	const pack565 = data => {
		const result = new Uint16Array(data.length / 4);
		for (let offset = 0; offset < data.length; offset += 4) {
			const R = data[offset + 0];
			const G = data[offset + 1];
			const B = data[offset + 2];
			result[offset / 4] = (R & 0xf8) << 8 | (G & 0xfc) << 3 | B >> 3;
		}
		return result;
	};
	const isPOT = (width, height) => {
		return (width & width - 1) === 0 && (height & height - 1) === 0;
	};
	const performanceNow = () => {
		return typeof performance !== 'undefined' ? performance.now() : 0;
	};
	let basis;
	let rgbPriority;
	let rgbaPriority;
	const chooseTargetFormat = (deviceDetails, hasAlpha, isUASTC) => {
		if (isUASTC) {
			if (deviceDetails.formats.astc) {
				return 'astc';
			}
		} else {
			if (hasAlpha) {
				if (deviceDetails.formats.etc2) {
					return 'etc2';
				}
			} else {
				if (deviceDetails.formats.etc1 || deviceDetails.formats.etc2) {
					return 'etc1';
				}
			}
		}
		const testInOrder = priority => {
			for (let i = 0; i < priority.length; ++i) {
				const format = priority[i];
				if (deviceDetails.formats[format]) {
					return format;
				}
			}
			return 'none';
		};
		return testInOrder(hasAlpha ? rgbaPriority : rgbPriority);
	};
	const dimensionsValid = (width, height, format, webgl2) => {
		switch (format) {
			case BASIS_FORMAT.cTFETC1:
			case BASIS_FORMAT.cTFETC2:
				return true;
			case BASIS_FORMAT.cTFBC1:
			case BASIS_FORMAT.cTFBC3:
				return (width & 0x3) === 0 && (height & 0x3) === 0;
			case BASIS_FORMAT.cTFPVRTC1_4_RGB:
			case BASIS_FORMAT.cTFPVRTC1_4_RGBA:
				return isPOT(width, height) && (width === height || webgl2);
			case BASIS_FORMAT.cTFASTC_4x4:
				return true;
			case BASIS_FORMAT.cTFATC_RGB:
			case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA:
				return true;
		}
	};
	const transcodeKTX2 = (url, data, options) => {
		if (!basis.KTX2File) {
			throw new Error('Basis transcoder module does not include support for KTX2.');
		}
		const funcStart = performanceNow();
		const basisFile = new basis.KTX2File(new Uint8Array(data));
		const width = basisFile.getWidth();
		const height = basisFile.getHeight();
		const levels = basisFile.getLevels();
		const hasAlpha = !!basisFile.getHasAlpha();
		const isUASTC = basisFile.isUASTC && basisFile.isUASTC();
		if (!width || !height || !levels) {
			basisFile.close();
			basisFile.delete();
			throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} levels=${levels}`);
		}
		const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);
		const unswizzle = !!options.isGGGR && format === 'pvr';
		let basisFormat;
		if (unswizzle) {
			basisFormat = BASIS_FORMAT.cTFRGBA32;
		} else {
			basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];
			if (!dimensionsValid(width, height, basisFormat, options.deviceDetails.webgl2)) {
				basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
			}
		}
		if (!basisFile.startTranscoding()) {
			basisFile.close();
			basisFile.delete();
			throw new Error('Failed to start transcoding url=' + url);
		}
		let i;
		const levelData = [];
		for (let mip = 0; mip < levels; ++mip) {
			const dstSize = basisFile.getImageTranscodedSizeInBytes(mip, 0, 0, basisFormat);
			const dst = new Uint8Array(dstSize);
			if (!basisFile.transcodeImage(dst, mip, 0, 0, basisFormat, 0, -1, -1)) {
				basisFile.close();
				basisFile.delete();
				throw new Error('Failed to transcode image url=' + url);
			}
			const is16BitFormat = basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444;
			levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
		}
		basisFile.close();
		basisFile.delete();
		if (unswizzle) {
			basisFormat = BASIS_FORMAT.cTFRGB565;
			for (i = 0; i < levelData.length; ++i) {
				levelData[i] = pack565(unswizzleGGGR(levelData[i]));
			}
		}
		return {
			format: basisToEngineMapping(basisFormat, options.deviceDetails),
			width: width,
			height: height,
			levels: levelData,
			cubemap: false,
			transcodeTime: performanceNow() - funcStart,
			url: url,
			unswizzledGGGR: unswizzle
		};
	};
	const transcodeBasis = (url, data, options) => {
		const funcStart = performanceNow();
		const basisFile = new basis.BasisFile(new Uint8Array(data));
		const width = basisFile.getImageWidth(0, 0);
		const height = basisFile.getImageHeight(0, 0);
		const images = basisFile.getNumImages();
		const levels = basisFile.getNumLevels(0);
		const hasAlpha = !!basisFile.getHasAlpha();
		const isUASTC = basisFile.isUASTC && basisFile.isUASTC();
		if (!width || !height || !images || !levels) {
			basisFile.close();
			basisFile.delete();
			throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} images=${images} levels=${levels}`);
		}
		const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);
		const unswizzle = !!options.isGGGR && format === 'pvr';
		let basisFormat;
		if (unswizzle) {
			basisFormat = BASIS_FORMAT.cTFRGBA32;
		} else {
			basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];
			if (!dimensionsValid(width, height, basisFormat, options.deviceDetails.webgl2)) {
				basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
			}
		}
		if (!basisFile.startTranscoding()) {
			basisFile.close();
			basisFile.delete();
			throw new Error('Failed to start transcoding url=' + url);
		}
		let i;
		const levelData = [];
		for (let mip = 0; mip < levels; ++mip) {
			const dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, basisFormat);
			const dst = new Uint8Array(dstSize);
			if (!basisFile.transcodeImage(dst, 0, mip, basisFormat, 0, 0)) {
				basisFile.close();
				basisFile.delete();
				throw new Error('Failed to transcode image url=' + url);
			}
			const is16BitFormat = basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444;
			levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
		}
		basisFile.close();
		basisFile.delete();
		if (unswizzle) {
			basisFormat = BASIS_FORMAT.cTFRGB565;
			for (i = 0; i < levelData.length; ++i) {
				levelData[i] = pack565(unswizzleGGGR(levelData[i]));
			}
		}
		return {
			format: basisToEngineMapping(basisFormat, options.deviceDetails),
			width: width,
			height: height,
			levels: levelData,
			cubemap: false,
			transcodeTime: performanceNow() - funcStart,
			url: url,
			unswizzledGGGR: unswizzle
		};
	};
	const transcode = (url, data, options) => {
		return options.isKTX2 ? transcodeKTX2(url, data, options) : transcodeBasis(url, data, options);
	};
	const workerTranscode = (url, data, options) => {
		try {
			const result = transcode(url, data, options);
			result.levels = result.levels.map(v => v.buffer);
			self.postMessage({
				url: url,
				data: result
			}, result.levels);
		} catch (err) {
			self.postMessage({
				url: url,
				err: err
			}, null);
		}
	};
	const workerInit = (config, callback) => {
		const instantiateWasmFunc = (imports, successCallback) => {
			WebAssembly.instantiate(config.module, imports).then(result => {
				successCallback(result);
			}).catch(reason => {
				console.error('instantiate failed + ' + reason);
			});
			return {};
		};
		self.BASIS(config.module ? {
			instantiateWasm: instantiateWasmFunc
		} : null).then(instance => {
			instance.initializeBasis();
			basis = instance;
			rgbPriority = config.rgbPriority;
			rgbaPriority = config.rgbaPriority;
			callback(null);
		});
	};
	const queue = [];
	self.onmessage = message => {
		const data = message.data;
		switch (data.type) {
			case 'init':
				workerInit(data.config, () => {
					for (let i = 0; i < queue.length; ++i) {
						workerTranscode(queue[i].url, queue[i].data, queue[i].options);
					}
					queue.length = 0;
				});
				break;
			case 'transcode':
				if (basis) {
					workerTranscode(data.url, data.data, data.options);
				} else {
					queue.push(data);
				}
				break;
		}
	};
}

export { BasisWorker };
