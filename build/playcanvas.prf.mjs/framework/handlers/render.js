import { Render } from '../../scene/render.js';

function onContainerAssetLoaded(containerAsset) {
	const renderAsset = this;
	if (!renderAsset.resource) return;
	const containerResource = containerAsset.resource;
	const render = containerResource.renders && containerResource.renders[renderAsset.data.renderIndex];
	if (render) {
		renderAsset.resource.meshes = render.resource.meshes;
	}
}
function onContainerAssetAdded(containerAsset) {
	const renderAsset = this;
	renderAsset.registry.off('load:' + containerAsset.id, onContainerAssetLoaded, renderAsset);
	renderAsset.registry.on('load:' + containerAsset.id, onContainerAssetLoaded, renderAsset);
	renderAsset.registry.off('remove:' + containerAsset.id, onContainerAssetRemoved, renderAsset);
	renderAsset.registry.once('remove:' + containerAsset.id, onContainerAssetRemoved, renderAsset);
	if (!containerAsset.resource) {
		renderAsset.registry.load(containerAsset);
	} else {
		onContainerAssetLoaded.call(renderAsset, containerAsset);
	}
}
function onContainerAssetRemoved(containerAsset) {
	const renderAsset = this;
	renderAsset.registry.off('load:' + containerAsset.id, onContainerAssetLoaded, renderAsset);
	if (renderAsset.resource) {
		renderAsset.resource.destroy();
	}
}
class RenderHandler {
	constructor(app) {
		this.handlerType = "render";
		this._registry = app.assets;
	}
	load(url, callback, asset) {}
	open(url, data) {
		return new Render();
	}
	patch(asset, registry) {
		if (!asset.data.containerAsset) return;
		const containerAsset = registry.get(asset.data.containerAsset);
		if (!containerAsset) {
			registry.once('add:' + asset.data.containerAsset, onContainerAssetAdded, asset);
			return;
		}
		onContainerAssetAdded.call(asset, containerAsset);
	}
}

export { RenderHandler };
