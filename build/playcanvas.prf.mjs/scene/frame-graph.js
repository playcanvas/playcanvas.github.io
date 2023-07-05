class FrameGraph {
	constructor() {
		this.renderPasses = [];
		this.renderTargetMap = new Map();
	}
	addRenderPass(renderPass) {
		this.renderPasses.push(renderPass);
	}
	reset() {
		this.renderPasses.length = 0;
	}
	compile() {
		const renderTargetMap = this.renderTargetMap;
		const renderPasses = this.renderPasses;
		for (let i = 0; i < renderPasses.length; i++) {
			const renderPass = renderPasses[i];
			const renderTarget = renderPass.renderTarget;
			if (renderTarget !== undefined) {
				const prevPass = renderTargetMap.get(renderTarget);
				if (prevPass) {
					const count = renderPass.colorArrayOps.length;
					for (let j = 0; j < count; j++) {
						const colorOps = renderPass.colorArrayOps[j];
						if (!colorOps.clear) {
							prevPass.colorArrayOps[j].store = true;
						}
					}
					if (!renderPass.depthStencilOps.clearDepth) {
						prevPass.depthStencilOps.storeDepth = true;
					}
					if (!renderPass.depthStencilOps.clearStencil) {
						prevPass.depthStencilOps.storeStencil = true;
					}
				}
				renderTargetMap.set(renderTarget, renderPass);
			}
		}
		let lastCubeTexture = null;
		let lastCubeRenderPass = null;
		for (let i = 0; i < renderPasses.length; i++) {
			const renderPass = renderPasses[i];
			const renderTarget = renderPass.renderTarget;
			const thisTexture = renderTarget == null ? void 0 : renderTarget.colorBuffer;
			if (thisTexture != null && thisTexture.cubemap) {
				if (lastCubeTexture === thisTexture) {
					const count = lastCubeRenderPass.colorArrayOps.length;
					for (let j = 0; j < count; j++) {
						lastCubeRenderPass.colorArrayOps[j].mipmaps = false;
					}
				}
				lastCubeTexture = renderTarget.colorBuffer;
				lastCubeRenderPass = renderPass;
			} else if (renderPass.requiresCubemaps) {
				lastCubeTexture = null;
				lastCubeRenderPass = null;
			}
		}
		renderTargetMap.forEach((renderPass, renderTarget) => {
			if (renderTarget === null) {
				renderPass.colorOps.store = true;
				renderPass.colorOps.resolve = false;
				renderPass.colorOps.mipmaps = false;
			}
		});
		renderTargetMap.clear();
	}
	render(device) {
		this.compile();
		const renderPasses = this.renderPasses;
		for (let i = 0; i < renderPasses.length; i++) {
			renderPasses[i].render();
		}
	}
}

export { FrameGraph };
