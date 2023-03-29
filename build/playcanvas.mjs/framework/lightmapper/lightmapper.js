import '../../core/tracing.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_RGBM, CHUNKAPI_1_62, CULLFACE_NONE, TEXTURETYPE_DEFAULT, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { LightingParams } from '../../scene/lighting/lighting-params.js';
import { WorldClusters } from '../../scene/lighting/world-clusters.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../../scene/shader-lib/chunks/chunks-lightmapper.js';
import { PROJECTION_ORTHOGRAPHIC, MASK_AFFECT_LIGHTMAPPED, BAKE_COLORDIR, MASK_BAKE, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, FOG_NONE, LIGHTTYPE_SPOT, PROJECTION_PERSPECTIVE, LIGHTTYPE_OMNI, SHADER_FORWARDHDR, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT } from '../../scene/constants.js';
import { Camera } from '../../scene/camera.js';
import { GraphNode } from '../../scene/graph-node.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { BakeLightSimple } from './bake-light-simple.js';
import { BakeLightAmbient } from './bake-light-ambient.js';
import { BakeMeshNode } from './bake-mesh-node.js';
import { LightmapCache } from '../../scene/graphics/lightmap-cache.js';
import { LightmapFilters } from './lightmap-filters.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';

const MAX_LIGHTMAP_SIZE = 2048;
const PASS_COLOR = 0;
const PASS_DIR = 1;
const tempVec = new Vec3();
class Lightmapper {
	constructor(device, root, scene, renderer, assets) {
		this.device = device;
		this.root = root;
		this.scene = scene;
		this.renderer = renderer;
		this.assets = assets;
		this.shadowMapCache = renderer.shadowMapCache;
		this._tempSet = new Set();
		this._initCalled = false;
		this.passMaterials = [];
		this.ambientAOMaterial = null;
		this.fog = '';
		this.ambientLight = new Color();
		this.renderTargets = new Map();
		this.stats = {
			renderPasses: 0,
			lightmapCount: 0,
			totalRenderTime: 0,
			forwardTime: 0,
			fboTime: 0,
			shadowMapTime: 0,
			compileTime: 0,
			shadersLinked: 0
		};
	}
	destroy() {
		LightmapCache.decRef(this.blackTex);
		this.blackTex = null;
		LightmapCache.destroy();
		this.device = null;
		this.root = null;
		this.scene = null;
		this.renderer = null;
		this.assets = null;
	}
	initBake(device) {
		if (!this._initCalled) {
			this._initCalled = true;
			this.lightmapFilters = new LightmapFilters(device);
			this.constantBakeDir = device.scope.resolve('bakeDir');
			this.materials = [];
			this.blackTex = new Texture(this.device, {
				width: 4,
				height: 4,
				format: PIXELFORMAT_RGBA8,
				type: TEXTURETYPE_RGBM,
				name: 'lightmapBlack'
			});
			LightmapCache.incRef(this.blackTex);
			const camera = new Camera();
			camera.clearColor.set(0, 0, 0, 0);
			camera.clearColorBuffer = true;
			camera.clearDepthBuffer = false;
			camera.clearStencilBuffer = false;
			camera.frustumCulling = false;
			camera.projection = PROJECTION_ORTHOGRAPHIC;
			camera.aspectRatio = 1;
			camera.node = new GraphNode();
			this.camera = camera;
		}
		if (this.scene.clusteredLightingEnabled) {
			const lightingParams = new LightingParams(device.supportsAreaLights, device.maxTextureSize, () => {});
			this.lightingParams = lightingParams;
			const srcParams = this.scene.lighting;
			lightingParams.shadowsEnabled = srcParams.shadowsEnabled;
			lightingParams.shadowAtlasResolution = srcParams.shadowAtlasResolution;
			lightingParams.cookiesEnabled = srcParams.cookiesEnabled;
			lightingParams.cookieAtlasResolution = srcParams.cookieAtlasResolution;
			lightingParams.areaLightsEnabled = srcParams.areaLightsEnabled;
			lightingParams.cells = new Vec3(3, 3, 3);
			lightingParams.maxLightsPerCell = 4;
			this.worldClusters = new WorldClusters(device);
			this.worldClusters.name = 'ClusterLightmapper';
		}
	}
	finishBake(bakeNodes) {
		this.materials = [];
		function destroyRT(rt) {
			LightmapCache.decRef(rt.colorBuffer);
			rt.destroy();
		}
		this.renderTargets.forEach(rt => {
			destroyRT(rt);
		});
		this.renderTargets.clear();
		bakeNodes.forEach(node => {
			node.renderTargets.forEach(rt => {
				destroyRT(rt);
			});
			node.renderTargets.length = 0;
		});
		this.ambientAOMaterial = null;
		if (this.worldClusters) {
			this.worldClusters.destroy();
			this.worldClusters = null;
		}
	}
	createMaterialForPass(device, scene, pass, addAmbient) {
		const material = new StandardMaterial();
		material.name = `lmMaterial-pass:${pass}-ambient:${addAmbient}`;
		material.chunks.APIVersion = CHUNKAPI_1_62;
		material.chunks.transformVS = '#define UV1LAYOUT\n' + shaderChunks.transformVS;
		if (pass === PASS_COLOR) {
			let bakeLmEndChunk = shaderChunksLightmapper.bakeLmEndPS;
			if (addAmbient) {
				bakeLmEndChunk = `
										dDiffuseLight = ((dDiffuseLight - 0.5) * max(${scene.ambientBakeOcclusionContrast.toFixed(1)} + 1.0, 0.0)) + 0.5;
										dDiffuseLight += vec3(${scene.ambientBakeOcclusionBrightness.toFixed(1)});
										dDiffuseLight = saturate(dDiffuseLight);
										dDiffuseLight *= dAmbientLight;
								` + bakeLmEndChunk;
			} else {
				material.ambient = new Color(0, 0, 0);
				material.ambientTint = true;
			}
			material.chunks.basePS = shaderChunks.basePS + (scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? '\n#define LIGHTMAP_RGBM\n' : '');
			material.chunks.endPS = bakeLmEndChunk;
			material.lightMap = this.blackTex;
		} else {
			material.chunks.basePS = shaderChunks.basePS + '\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n';
			material.chunks.endPS = shaderChunksLightmapper.bakeDirLmEndPS;
		}
		material.chunks.outputAlphaPS = '\n';
		material.chunks.outputAlphaOpaquePS = '\n';
		material.chunks.outputAlphaPremulPS = '\n';
		material.cull = CULLFACE_NONE;
		material.forceUv1 = true;
		material.update();
		return material;
	}
	createMaterials(device, scene, passCount) {
		for (let pass = 0; pass < passCount; pass++) {
			if (!this.passMaterials[pass]) {
				this.passMaterials[pass] = this.createMaterialForPass(device, scene, pass, false);
			}
		}
		if (!this.ambientAOMaterial) {
			this.ambientAOMaterial = this.createMaterialForPass(device, scene, 0, true);
			this.ambientAOMaterial.onUpdateShader = function (options) {
				options.litOptions.lightMapWithoutAmbient = true;
				options.litOptions.separateAmbient = true;
				return options;
			};
		}
	}
	createTexture(size, name) {
		return new Texture(this.device, {
			width: size,
			height: size,
			format: this.scene.lightmapPixelFormat,
			mipmaps: false,
			type: this.scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT,
			minFilter: FILTER_NEAREST,
			magFilter: FILTER_NEAREST,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			name: name
		});
	}
	collectModels(node, bakeNodes, allNodes) {
		var _node$model, _node$model2, _node$render;
		if (!node.enabled) return;
		let meshInstances;
		if ((_node$model = node.model) != null && _node$model.model && (_node$model2 = node.model) != null && _node$model2.enabled) {
			if (allNodes) allNodes.push(new BakeMeshNode(node));
			if (node.model.lightmapped) {
				if (bakeNodes) {
					meshInstances = node.model.model.meshInstances;
				}
			}
		}
		if ((_node$render = node.render) != null && _node$render.enabled) {
			if (allNodes) allNodes.push(new BakeMeshNode(node));
			if (node.render.lightmapped) {
				if (bakeNodes) {
					meshInstances = node.render.meshInstances;
				}
			}
		}
		if (meshInstances) {
			let hasUv1 = true;
			for (let i = 0; i < meshInstances.length; i++) {
				if (!meshInstances[i].mesh.vertexBuffer.format.hasUv1) {
					hasUv1 = false;
					break;
				}
			}
			if (hasUv1) {
				const notInstancedMeshInstances = [];
				for (let i = 0; i < meshInstances.length; i++) {
					const mesh = meshInstances[i].mesh;
					if (this._tempSet.has(mesh)) {
						bakeNodes.push(new BakeMeshNode(node, [meshInstances[i]]));
					} else {
						notInstancedMeshInstances.push(meshInstances[i]);
					}
					this._tempSet.add(mesh);
				}
				this._tempSet.clear();
				if (notInstancedMeshInstances.length > 0) {
					bakeNodes.push(new BakeMeshNode(node, notInstancedMeshInstances));
				}
			}
		}
		for (let i = 0; i < node._children.length; i++) {
			this.collectModels(node._children[i], bakeNodes, allNodes);
		}
	}
	prepareShadowCasters(nodes) {
		const casters = [];
		for (let n = 0; n < nodes.length; n++) {
			const component = nodes[n].component;
			component.castShadows = component.castShadowsLightmap;
			if (component.castShadowsLightmap) {
				const meshes = nodes[n].meshInstances;
				for (let i = 0; i < meshes.length; i++) {
					meshes[i].visibleThisFrame = true;
					casters.push(meshes[i]);
				}
			}
		}
		return casters;
	}
	updateTransforms(nodes) {
		for (let i = 0; i < nodes.length; i++) {
			const meshInstances = nodes[i].meshInstances;
			for (let j = 0; j < meshInstances.length; j++) {
				meshInstances[j].node.getWorldTransform();
			}
		}
	}
	calculateLightmapSize(node) {
		let data;
		const sizeMult = this.scene.lightmapSizeMultiplier || 16;
		const scale = tempVec;
		let srcArea, lightmapSizeMultiplier;
		if (node.model) {
			lightmapSizeMultiplier = node.model.lightmapSizeMultiplier;
			if (node.model.asset) {
				data = this.assets.get(node.model.asset).data;
				if (data.area) {
					srcArea = data.area;
				}
			} else if (node.model._area) {
				data = node.model;
				if (data._area) {
					srcArea = data._area;
				}
			}
		} else if (node.render) {
			lightmapSizeMultiplier = node.render.lightmapSizeMultiplier;
			if (node.render.type !== 'asset') {
				if (node.render._area) {
					data = node.render;
					if (data._area) {
						srcArea = data._area;
					}
				}
			}
		}
		const area = {
			x: 1,
			y: 1,
			z: 1,
			uv: 1
		};
		if (srcArea) {
			area.x = srcArea.x;
			area.y = srcArea.y;
			area.z = srcArea.z;
			area.uv = srcArea.uv;
		}
		const areaMult = lightmapSizeMultiplier || 1;
		area.x *= areaMult;
		area.y *= areaMult;
		area.z *= areaMult;
		const component = node.render || node.model;
		const bounds = this.computeNodeBounds(component.meshInstances);
		scale.copy(bounds.halfExtents);
		let totalArea = area.x * scale.y * scale.z + area.y * scale.x * scale.z + area.z * scale.x * scale.y;
		totalArea /= area.uv;
		totalArea = Math.sqrt(totalArea);
		const lightmapSize = Math.min(math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || MAX_LIGHTMAP_SIZE);
		return lightmapSize;
	}
	setLightmapping(nodes, value, passCount, shaderDefs) {
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			const meshInstances = node.meshInstances;
			for (let j = 0; j < meshInstances.length; j++) {
				const meshInstance = meshInstances[j];
				meshInstance.setLightmapped(value);
				if (value) {
					if (shaderDefs) {
						meshInstance._shaderDefs |= shaderDefs;
					}
					meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;
					for (let pass = 0; pass < passCount; pass++) {
						const tex = node.renderTargets[pass].colorBuffer;
						tex.minFilter = FILTER_LINEAR;
						tex.magFilter = FILTER_LINEAR;
						meshInstance.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tex);
					}
				}
			}
		}
	}
	bake(nodes, mode = BAKE_COLORDIR) {
		const device = this.device;
		const startTime = now();
		this.scene._updateSky(device);
		this.stats.renderPasses = 0;
		this.stats.shadowMapTime = 0;
		this.stats.forwardTime = 0;
		const startShaders = device._shaderStats.linked;
		const startFboTime = device._renderTargetCreationTime;
		const startCompileTime = device._shaderStats.compileTime;
		const bakeNodes = [];
		const allNodes = [];
		if (nodes) {
			for (let i = 0; i < nodes.length; i++) {
				this.collectModels(nodes[i], bakeNodes, null);
			}
			this.collectModels(this.root, null, allNodes);
		} else {
			this.collectModels(this.root, bakeNodes, allNodes);
		}
		if (bakeNodes.length > 0) {
			const passCount = mode === BAKE_COLORDIR ? 2 : 1;
			this.setLightmapping(bakeNodes, false, passCount);
			this.initBake(device);
			this.bakeInternal(passCount, bakeNodes, allNodes);
			let shaderDefs = SHADERDEF_LM;
			if (mode === BAKE_COLORDIR) {
				shaderDefs |= SHADERDEF_DIRLM;
			}
			if (this.scene.ambientBake) {
				shaderDefs |= SHADERDEF_LMAMBIENT;
			}
			this.setLightmapping(bakeNodes, true, passCount, shaderDefs);
			this.finishBake(bakeNodes);
		}
		const nowTime = now();
		this.stats.totalRenderTime = nowTime - startTime;
		this.stats.shadersLinked = device._shaderStats.linked - startShaders;
		this.stats.compileTime = device._shaderStats.compileTime - startCompileTime;
		this.stats.fboTime = device._renderTargetCreationTime - startFboTime;
		this.stats.lightmapCount = bakeNodes.length;
	}
	allocateTextures(bakeNodes, passCount) {
		for (let i = 0; i < bakeNodes.length; i++) {
			const bakeNode = bakeNodes[i];
			const size = this.calculateLightmapSize(bakeNode.node);
			for (let pass = 0; pass < passCount; pass++) {
				const tex = this.createTexture(size, 'lightmapper_lightmap_' + i);
				LightmapCache.incRef(tex);
				bakeNode.renderTargets[pass] = new RenderTarget({
					colorBuffer: tex,
					depth: false
				});
			}
			if (!this.renderTargets.has(size)) {
				const tex = this.createTexture(size, 'lightmapper_temp_lightmap_' + size);
				LightmapCache.incRef(tex);
				this.renderTargets.set(size, new RenderTarget({
					colorBuffer: tex,
					depth: false
				}));
			}
		}
	}
	prepareLightsToBake(layerComposition, allLights, bakeLights) {
		if (this.scene.ambientBake) {
			const ambientLight = new BakeLightAmbient(this.scene);
			bakeLights.push(ambientLight);
		}
		const sceneLights = layerComposition._lights;
		for (let i = 0; i < sceneLights.length; i++) {
			const light = sceneLights[i];
			const bakeLight = new BakeLightSimple(this.scene, light);
			allLights.push(bakeLight);
			if (light.enabled && (light.mask & MASK_BAKE) !== 0) {
				light.isStatic = false;
				light.mask = 0xFFFFFFFF;
				light.shadowUpdateMode = light.type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
				bakeLights.push(bakeLight);
			}
		}
		bakeLights.sort();
	}
	restoreLights(allLights) {
		for (let i = 0; i < allLights.length; i++) {
			allLights[i].restore();
		}
	}
	setupScene() {
		this.revertStatic = false;
		if (this.scene._needsStaticPrepare) {
			this.scene._needsStaticPrepare = false;
			this.revertStatic = true;
		}
		this.fog = this.scene.fog;
		this.ambientLight.copy(this.scene.ambientLight);
		this.scene.fog = FOG_NONE;
		if (!this.scene.ambientBake) {
			this.scene.ambientLight.set(0, 0, 0);
		}
		this.renderer.setSceneConstants();
	}
	restoreScene() {
		this.scene.fog = this.fog;
		this.scene.ambientLight.copy(this.ambientLight);
		if (this.revertStatic) {
			this.scene._needsStaticPrepare = true;
		}
	}
	computeNodeBounds(meshInstances) {
		const bounds = new BoundingBox();
		if (meshInstances.length > 0) {
			bounds.copy(meshInstances[0].aabb);
			for (let m = 1; m < meshInstances.length; m++) {
				bounds.add(meshInstances[m].aabb);
			}
		}
		return bounds;
	}
	computeNodesBounds(nodes) {
		for (let i = 0; i < nodes.length; i++) {
			const meshInstances = nodes[i].meshInstances;
			nodes[i].bounds = this.computeNodeBounds(meshInstances);
		}
	}
	computeBounds(meshInstances) {
		const bounds = new BoundingBox();
		for (let i = 0; i < meshInstances.length; i++) {
			bounds.copy(meshInstances[0].aabb);
			for (let m = 1; m < meshInstances.length; m++) {
				bounds.add(meshInstances[m].aabb);
			}
		}
		return bounds;
	}
	backupMaterials(meshInstances) {
		for (let i = 0; i < meshInstances.length; i++) {
			this.materials[i] = meshInstances[i].material;
		}
	}
	restoreMaterials(meshInstances) {
		for (let i = 0; i < meshInstances.length; i++) {
			meshInstances[i].material = this.materials[i];
		}
	}
	lightCameraPrepare(device, bakeLight) {
		const light = bakeLight.light;
		let shadowCam;
		if (light.type === LIGHTTYPE_SPOT) {
			const lightRenderData = light.getRenderData(null, 0);
			shadowCam = lightRenderData.shadowCamera;
			shadowCam._node.setPosition(light._node.getPosition());
			shadowCam._node.setRotation(light._node.getRotation());
			shadowCam._node.rotateLocal(-90, 0, 0);
			shadowCam.projection = PROJECTION_PERSPECTIVE;
			shadowCam.nearClip = light.attenuationEnd / 1000;
			shadowCam.farClip = light.attenuationEnd;
			shadowCam.aspectRatio = 1;
			shadowCam.fov = light._outerConeAngle * 2;
			this.renderer.updateCameraFrustum(shadowCam);
		}
		return shadowCam;
	}
	lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds) {
		const light = bakeLight.light;
		let lightAffectsNode = true;
		if (light.type === LIGHTTYPE_DIRECTIONAL) {
			tempVec.copy(casterBounds.center);
			tempVec.y += casterBounds.halfExtents.y;
			this.camera.node.setPosition(tempVec);
			this.camera.node.setEulerAngles(-90, 0, 0);
			this.camera.nearClip = 0;
			this.camera.farClip = casterBounds.halfExtents.y * 2;
			const frustumSize = Math.max(casterBounds.halfExtents.x, casterBounds.halfExtents.z);
			this.camera.orthoHeight = frustumSize;
		} else {
			if (!bakeLight.lightBounds.intersects(bakeNode.bounds)) {
				lightAffectsNode = false;
			}
		}
		if (light.type === LIGHTTYPE_SPOT) {
			let nodeVisible = false;
			const meshInstances = bakeNode.meshInstances;
			for (let i = 0; i < meshInstances.length; i++) {
				if (meshInstances[i]._isVisible(shadowCam)) {
					nodeVisible = true;
					break;
				}
			}
			if (!nodeVisible) {
				lightAffectsNode = false;
			}
		}
		return lightAffectsNode;
	}
	setupLightArray(lightArray, light) {
		lightArray[LIGHTTYPE_DIRECTIONAL].length = 0;
		lightArray[LIGHTTYPE_OMNI].length = 0;
		lightArray[LIGHTTYPE_SPOT].length = 0;
		lightArray[light.type][0] = light;
		light.visibleThisFrame = true;
	}
	renderShadowMap(shadowMapRendered, casters, bakeLight) {
		const light = bakeLight.light;
		const isClustered = this.scene.clusteredLightingEnabled;
		if (!shadowMapRendered && light.castShadows) {
			if (!light.shadowMap && !isClustered) {
				light.shadowMap = this.shadowMapCache.get(this.device, light);
			}
			if (light.type === LIGHTTYPE_DIRECTIONAL) {
				this.renderer._shadowRendererDirectional.cull(light, casters, this.camera);
			} else {
				this.renderer._shadowRendererLocal.cull(light, casters);
			}
			const insideRenderPass = false;
			this.renderer.shadowRenderer.render(light, this.camera, insideRenderPass);
		}
		return true;
	}
	postprocessTextures(device, bakeNodes, passCount) {
		const numDilates2x = 1;
		const dilateShader = this.lightmapFilters.shaderDilate;
		const filterLightmap = this.scene.lightmapFilterEnabled;
		if (filterLightmap) {
			this.lightmapFilters.prepareDenoise(this.scene.lightmapFilterRange, this.scene.lightmapFilterSmoothness);
		}
		device.setBlendState(BlendState.DEFAULT);
		device.setDepthState(DepthState.NODEPTH);
		for (let node = 0; node < bakeNodes.length; node++) {
			const bakeNode = bakeNodes[node];
			for (let pass = 0; pass < passCount; pass++) {
				const nodeRT = bakeNode.renderTargets[pass];
				const lightmap = nodeRT.colorBuffer;
				const tempRT = this.renderTargets.get(lightmap.width);
				const tempTex = tempRT.colorBuffer;
				this.lightmapFilters.prepare(lightmap.width, lightmap.height);
				for (let i = 0; i < numDilates2x; i++) {
					this.lightmapFilters.setSourceTexture(lightmap);
					const bilateralFilterEnabled = filterLightmap && pass === 0 && i === 0;
					drawQuadWithShader(device, tempRT, bilateralFilterEnabled ? this.lightmapFilters.shaderDenoise : dilateShader);
					this.lightmapFilters.setSourceTexture(tempTex);
					drawQuadWithShader(device, nodeRT, dilateShader);
				}
			}
		}
	}
	bakeInternal(passCount, bakeNodes, allNodes) {
		const scene = this.scene;
		const device = this.device;
		const clusteredLightingEnabled = scene.clusteredLightingEnabled;
		this.createMaterials(device, scene, passCount);
		this.setupScene();
		scene.layers._update();
		this.computeNodesBounds(bakeNodes);
		this.allocateTextures(bakeNodes, passCount);
		const allLights = [],
			bakeLights = [];
		this.prepareLightsToBake(scene.layers, allLights, bakeLights);
		this.updateTransforms(allNodes);
		const casters = this.prepareShadowCasters(allNodes);
		this.renderer.updateCpuSkinMatrices(casters);
		this.renderer.gpuUpdate(casters);
		const casterBounds = this.computeBounds(casters);
		let i, j, rcv, m;
		for (i = 0; i < bakeNodes.length; i++) {
			const bakeNode = bakeNodes[i];
			rcv = bakeNode.meshInstances;
			for (j = 0; j < rcv.length; j++) {
				m = rcv[j];
				m.setLightmapped(false);
				m.mask = MASK_BAKE;
				m.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], m.material.lightMap ? m.material.lightMap : this.blackTex);
				m.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], this.blackTex);
			}
		}
		for (j = 0; j < bakeLights.length; j++) {
			bakeLights[j].light.enabled = false;
		}
		const lightArray = [[], [], []];
		let pass, node;
		let shadersUpdatedOn1stPass = false;
		for (i = 0; i < bakeLights.length; i++) {
			const bakeLight = bakeLights[i];
			const isAmbientLight = bakeLight instanceof BakeLightAmbient;
			let numVirtualLights = bakeLight.numVirtualLights;
			if (passCount > 1 && numVirtualLights > 1 && bakeLight.light.bakeDir) {
				numVirtualLights = 1;
			}
			for (let virtualLightIndex = 0; virtualLightIndex < numVirtualLights; virtualLightIndex++) {
				if (numVirtualLights > 1) {
					bakeLight.prepareVirtualLight(virtualLightIndex, numVirtualLights);
				}
				bakeLight.startBake();
				let shadowMapRendered = false;
				const shadowCam = this.lightCameraPrepare(device, bakeLight);
				for (node = 0; node < bakeNodes.length; node++) {
					const bakeNode = bakeNodes[node];
					rcv = bakeNode.meshInstances;
					const lightAffectsNode = this.lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds);
					if (!lightAffectsNode) {
						continue;
					}
					this.setupLightArray(lightArray, bakeLight.light);
					if (clusteredLightingEnabled) {
						this.renderer.lightTextureAtlas.update(lightArray[LIGHTTYPE_SPOT], lightArray[LIGHTTYPE_OMNI], this.lightingParams);
					}
					shadowMapRendered = this.renderShadowMap(shadowMapRendered, casters, bakeLight);
					if (clusteredLightingEnabled) {
						const clusterLights = lightArray[LIGHTTYPE_SPOT].concat(lightArray[LIGHTTYPE_OMNI]);
						this.worldClusters.update(clusterLights, this.scene.gammaCorrection, this.lightingParams);
					}
					this.backupMaterials(rcv);
					for (pass = 0; pass < passCount; pass++) {
						if (pass > 0 && virtualLightIndex > 0) {
							break;
						}
						if (isAmbientLight && pass > 0) {
							break;
						}
						const nodeRT = bakeNode.renderTargets[pass];
						const lightmapSize = bakeNode.renderTargets[pass].colorBuffer.width;
						const tempRT = this.renderTargets.get(lightmapSize);
						const tempTex = tempRT.colorBuffer;
						if (pass === 0) {
							shadersUpdatedOn1stPass = scene.updateShaders;
						} else if (shadersUpdatedOn1stPass) {
							scene.updateShaders = true;
						}
						let passMaterial = this.passMaterials[pass];
						if (isAmbientLight) {
							const lastVirtualLightForPass = virtualLightIndex + 1 === numVirtualLights;
							if (lastVirtualLightForPass && pass === 0) {
								passMaterial = this.ambientAOMaterial;
							}
						}
						for (j = 0; j < rcv.length; j++) {
							rcv[j].material = passMaterial;
						}
						this.renderer.updateShaders(rcv);
						this.renderer.setCamera(this.camera, tempRT, true);
						if (pass === PASS_DIR) {
							this.constantBakeDir.setValue(bakeLight.light.bakeDir ? 1 : 0);
						}
						if (clusteredLightingEnabled) {
							this.worldClusters.activate();
						}
						this.renderer._forwardTime = 0;
						this.renderer._shadowMapTime = 0;
						this.renderer.renderForward(this.camera, rcv, rcv.length, lightArray, SHADER_FORWARDHDR);
						device.updateEnd();
						bakeNode.renderTargets[pass] = tempRT;
						this.renderTargets.set(lightmapSize, nodeRT);
						for (j = 0; j < rcv.length; j++) {
							m = rcv[j];
							m.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tempTex);
							m._shaderDefs |= SHADERDEF_LM;
						}
					}
					this.restoreMaterials(rcv);
				}
				bakeLight.endBake(this.shadowMapCache);
			}
		}
		this.postprocessTextures(device, bakeNodes, passCount);
		for (node = 0; node < allNodes.length; node++) {
			allNodes[node].restore();
		}
		this.restoreLights(allLights);
		this.restoreScene();
		if (!clusteredLightingEnabled) {
			this.shadowMapCache.clear();
		}
	}
}

export { Lightmapper };
