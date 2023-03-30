import '../../core/time.js';
import '../../core/tracing.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';
import { FUNC_ALWAYS, STENCILOP_KEEP } from '../../platform/graphics/constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, FOG_NONE, FOG_LINEAR, LAYERID_DEPTH, COMPUPDATED_LIGHTS } from '../constants.js';
import { Renderer } from './renderer.js';
import { LightCamera } from './light-camera.js';
import '../lighting/world-clusters-debug.js';
import { SceneGrab } from '../graphics/scene-grab.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

const webgl1DepthClearColor = new Color(254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255);
const _drawCallList = {
	drawCalls: [],
	isNewMaterial: [],
	lightMaskChanged: []
};
class ForwardRenderer extends Renderer {
	constructor(graphicsDevice) {
		super(graphicsDevice);
		const device = this.device;
		this._forwardDrawCalls = 0;
		this._materialSwitches = 0;
		this._depthMapTime = 0;
		this._forwardTime = 0;
		this._sortTime = 0;
		const scope = device.scope;
		this.fogColorId = scope.resolve('fog_color');
		this.fogStartId = scope.resolve('fog_start');
		this.fogEndId = scope.resolve('fog_end');
		this.fogDensityId = scope.resolve('fog_density');
		this.ambientId = scope.resolve('light_globalAmbient');
		this.skyboxIntensityId = scope.resolve('skyboxIntensity');
		this.cubeMapRotationMatrixId = scope.resolve('cubeMapRotationMatrix');
		this.lightColorId = [];
		this.lightDir = [];
		this.lightDirId = [];
		this.lightShadowMapId = [];
		this.lightShadowMatrixId = [];
		this.lightShadowParamsId = [];
		this.lightShadowIntensity = [];
		this.lightRadiusId = [];
		this.lightPos = [];
		this.lightPosId = [];
		this.lightWidth = [];
		this.lightWidthId = [];
		this.lightHeight = [];
		this.lightHeightId = [];
		this.lightInAngleId = [];
		this.lightOutAngleId = [];
		this.lightCookieId = [];
		this.lightCookieIntId = [];
		this.lightCookieMatrixId = [];
		this.lightCookieOffsetId = [];
		this.shadowMatrixPaletteId = [];
		this.shadowCascadeDistancesId = [];
		this.shadowCascadeCountId = [];
		this.screenSizeId = scope.resolve('uScreenSize');
		this._screenSize = new Float32Array(4);
		this.fogColor = new Float32Array(3);
		this.ambientColor = new Float32Array(3);
	}
	destroy() {
		super.destroy();
	}
	dispatchGlobalLights(scene) {
		this.ambientColor[0] = scene.ambientLight.r;
		this.ambientColor[1] = scene.ambientLight.g;
		this.ambientColor[2] = scene.ambientLight.b;
		if (scene.gammaCorrection) {
			for (let i = 0; i < 3; i++) {
				this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
			}
		}
		if (scene.physicalUnits) {
			for (let i = 0; i < 3; i++) {
				this.ambientColor[i] *= scene.ambientLuminance;
			}
		}
		this.ambientId.setValue(this.ambientColor);
		this.skyboxIntensityId.setValue(scene.physicalUnits ? scene.skyboxLuminance : scene.skyboxIntensity);
		this.cubeMapRotationMatrixId.setValue(scene._skyboxRotationMat3.data);
	}
	_resolveLight(scope, i) {
		const light = 'light' + i;
		this.lightColorId[i] = scope.resolve(light + '_color');
		this.lightDir[i] = new Float32Array(3);
		this.lightDirId[i] = scope.resolve(light + '_direction');
		this.lightShadowMapId[i] = scope.resolve(light + '_shadowMap');
		this.lightShadowMatrixId[i] = scope.resolve(light + '_shadowMatrix');
		this.lightShadowParamsId[i] = scope.resolve(light + '_shadowParams');
		this.lightShadowIntensity[i] = scope.resolve(light + '_shadowIntensity');
		this.lightRadiusId[i] = scope.resolve(light + '_radius');
		this.lightPos[i] = new Float32Array(3);
		this.lightPosId[i] = scope.resolve(light + '_position');
		this.lightWidth[i] = new Float32Array(3);
		this.lightWidthId[i] = scope.resolve(light + '_halfWidth');
		this.lightHeight[i] = new Float32Array(3);
		this.lightHeightId[i] = scope.resolve(light + '_halfHeight');
		this.lightInAngleId[i] = scope.resolve(light + '_innerConeAngle');
		this.lightOutAngleId[i] = scope.resolve(light + '_outerConeAngle');
		this.lightCookieId[i] = scope.resolve(light + '_cookie');
		this.lightCookieIntId[i] = scope.resolve(light + '_cookieIntensity');
		this.lightCookieMatrixId[i] = scope.resolve(light + '_cookieMatrix');
		this.lightCookieOffsetId[i] = scope.resolve(light + '_cookieOffset');
		this.shadowMatrixPaletteId[i] = scope.resolve(light + '_shadowMatrixPalette[0]');
		this.shadowCascadeDistancesId[i] = scope.resolve(light + '_shadowCascadeDistances[0]');
		this.shadowCascadeCountId[i] = scope.resolve(light + '_shadowCascadeCount');
	}
	setLTCDirectionalLight(wtm, cnt, dir, campos, far) {
		this.lightPos[cnt][0] = campos.x - dir.x * far;
		this.lightPos[cnt][1] = campos.y - dir.y * far;
		this.lightPos[cnt][2] = campos.z - dir.z * far;
		this.lightPosId[cnt].setValue(this.lightPos[cnt]);
		const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
		this.lightWidth[cnt][0] = hWidth.x * far;
		this.lightWidth[cnt][1] = hWidth.y * far;
		this.lightWidth[cnt][2] = hWidth.z * far;
		this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
		const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
		this.lightHeight[cnt][0] = hHeight.x * far;
		this.lightHeight[cnt][1] = hHeight.y * far;
		this.lightHeight[cnt][2] = hHeight.z * far;
		this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
	}
	dispatchDirectLights(dirs, scene, mask, camera) {
		let cnt = 0;
		const scope = this.device.scope;
		for (let i = 0; i < dirs.length; i++) {
			if (!(dirs[i].mask & mask)) continue;
			const directional = dirs[i];
			const wtm = directional._node.getWorldTransform();
			if (!this.lightColorId[cnt]) {
				this._resolveLight(scope, cnt);
			}
			this.lightColorId[cnt].setValue(scene.gammaCorrection ? directional._linearFinalColor : directional._finalColor);
			wtm.getY(directional._direction).mulScalar(-1);
			directional._direction.normalize();
			this.lightDir[cnt][0] = directional._direction.x;
			this.lightDir[cnt][1] = directional._direction.y;
			this.lightDir[cnt][2] = directional._direction.z;
			this.lightDirId[cnt].setValue(this.lightDir[cnt]);
			if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
				this.setLTCDirectionalLight(wtm, cnt, directional._direction, camera._node.getPosition(), camera.farClip);
			}
			if (directional.castShadows) {
				const lightRenderData = directional.getRenderData(camera, 0);
				const biases = directional._getUniformBiasValues(lightRenderData);
				this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
				this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
				this.shadowMatrixPaletteId[cnt].setValue(directional._shadowMatrixPalette);
				this.shadowCascadeDistancesId[cnt].setValue(directional._shadowCascadeDistances);
				this.shadowCascadeCountId[cnt].setValue(directional.numCascades);
				this.lightShadowIntensity[cnt].setValue(directional.shadowIntensity);
				const params = directional._shadowRenderParams;
				params.length = 3;
				params[0] = directional._shadowResolution;
				params[1] = biases.normalBias;
				params[2] = biases.bias;
				this.lightShadowParamsId[cnt].setValue(params);
			}
			cnt++;
		}
		return cnt;
	}
	setLTCPositionalLight(wtm, cnt) {
		const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
		this.lightWidth[cnt][0] = hWidth.x;
		this.lightWidth[cnt][1] = hWidth.y;
		this.lightWidth[cnt][2] = hWidth.z;
		this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
		const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
		this.lightHeight[cnt][0] = hHeight.x;
		this.lightHeight[cnt][1] = hHeight.y;
		this.lightHeight[cnt][2] = hHeight.z;
		this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
	}
	dispatchOmniLight(scene, scope, omni, cnt) {
		const wtm = omni._node.getWorldTransform();
		if (!this.lightColorId[cnt]) {
			this._resolveLight(scope, cnt);
		}
		this.lightRadiusId[cnt].setValue(omni.attenuationEnd);
		this.lightColorId[cnt].setValue(scene.gammaCorrection ? omni._linearFinalColor : omni._finalColor);
		wtm.getTranslation(omni._position);
		this.lightPos[cnt][0] = omni._position.x;
		this.lightPos[cnt][1] = omni._position.y;
		this.lightPos[cnt][2] = omni._position.z;
		this.lightPosId[cnt].setValue(this.lightPos[cnt]);
		if (omni.shape !== LIGHTSHAPE_PUNCTUAL) {
			this.setLTCPositionalLight(wtm, cnt);
		}
		if (omni.castShadows) {
			const lightRenderData = omni.getRenderData(null, 0);
			this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
			const biases = omni._getUniformBiasValues(lightRenderData);
			const params = omni._shadowRenderParams;
			params.length = 4;
			params[0] = omni._shadowResolution;
			params[1] = biases.normalBias;
			params[2] = biases.bias;
			params[3] = 1.0 / omni.attenuationEnd;
			this.lightShadowParamsId[cnt].setValue(params);
			this.lightShadowIntensity[cnt].setValue(omni.shadowIntensity);
		}
		if (omni._cookie) {
			this.lightCookieId[cnt].setValue(omni._cookie);
			this.lightShadowMatrixId[cnt].setValue(wtm.data);
			this.lightCookieIntId[cnt].setValue(omni.cookieIntensity);
		}
	}
	dispatchSpotLight(scene, scope, spot, cnt) {
		const wtm = spot._node.getWorldTransform();
		if (!this.lightColorId[cnt]) {
			this._resolveLight(scope, cnt);
		}
		this.lightInAngleId[cnt].setValue(spot._innerConeAngleCos);
		this.lightOutAngleId[cnt].setValue(spot._outerConeAngleCos);
		this.lightRadiusId[cnt].setValue(spot.attenuationEnd);
		this.lightColorId[cnt].setValue(scene.gammaCorrection ? spot._linearFinalColor : spot._finalColor);
		wtm.getTranslation(spot._position);
		this.lightPos[cnt][0] = spot._position.x;
		this.lightPos[cnt][1] = spot._position.y;
		this.lightPos[cnt][2] = spot._position.z;
		this.lightPosId[cnt].setValue(this.lightPos[cnt]);
		if (spot.shape !== LIGHTSHAPE_PUNCTUAL) {
			this.setLTCPositionalLight(wtm, cnt);
		}
		wtm.getY(spot._direction).mulScalar(-1);
		spot._direction.normalize();
		this.lightDir[cnt][0] = spot._direction.x;
		this.lightDir[cnt][1] = spot._direction.y;
		this.lightDir[cnt][2] = spot._direction.z;
		this.lightDirId[cnt].setValue(this.lightDir[cnt]);
		if (spot.castShadows) {
			const lightRenderData = spot.getRenderData(null, 0);
			this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
			this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
			const biases = spot._getUniformBiasValues(lightRenderData);
			const params = spot._shadowRenderParams;
			params.length = 4;
			params[0] = spot._shadowResolution;
			params[1] = biases.normalBias;
			params[2] = biases.bias;
			params[3] = 1.0 / spot.attenuationEnd;
			this.lightShadowParamsId[cnt].setValue(params);
			this.lightShadowIntensity[cnt].setValue(spot.shadowIntensity);
		}
		if (spot._cookie) {
			if (!spot.castShadows) {
				const cookieMatrix = LightCamera.evalSpotCookieMatrix(spot);
				this.lightShadowMatrixId[cnt].setValue(cookieMatrix.data);
			}
			this.lightCookieId[cnt].setValue(spot._cookie);
			this.lightCookieIntId[cnt].setValue(spot.cookieIntensity);
			if (spot._cookieTransform) {
				spot._cookieTransformUniform[0] = spot._cookieTransform.x;
				spot._cookieTransformUniform[1] = spot._cookieTransform.y;
				spot._cookieTransformUniform[2] = spot._cookieTransform.z;
				spot._cookieTransformUniform[3] = spot._cookieTransform.w;
				this.lightCookieMatrixId[cnt].setValue(spot._cookieTransformUniform);
				spot._cookieOffsetUniform[0] = spot._cookieOffset.x;
				spot._cookieOffsetUniform[1] = spot._cookieOffset.y;
				this.lightCookieOffsetId[cnt].setValue(spot._cookieOffsetUniform);
			}
		}
	}
	dispatchLocalLights(sortedLights, scene, mask, usedDirLights, staticLightList) {
		let cnt = usedDirLights;
		const scope = this.device.scope;
		const omnis = sortedLights[LIGHTTYPE_OMNI];
		const numOmnis = omnis.length;
		for (let i = 0; i < numOmnis; i++) {
			const omni = omnis[i];
			if (!(omni.mask & mask)) continue;
			if (omni.isStatic) continue;
			this.dispatchOmniLight(scene, scope, omni, cnt);
			cnt++;
		}
		let staticId = 0;
		if (staticLightList) {
			let omni = staticLightList[staticId];
			while (omni && omni._type === LIGHTTYPE_OMNI) {
				this.dispatchOmniLight(scene, scope, omni, cnt);
				cnt++;
				staticId++;
				omni = staticLightList[staticId];
			}
		}
		const spts = sortedLights[LIGHTTYPE_SPOT];
		const numSpts = spts.length;
		for (let i = 0; i < numSpts; i++) {
			const spot = spts[i];
			if (!(spot.mask & mask)) continue;
			if (spot.isStatic) continue;
			this.dispatchSpotLight(scene, scope, spot, cnt);
			cnt++;
		}
		if (staticLightList) {
			let spot = staticLightList[staticId];
			while (spot && spot._type === LIGHTTYPE_SPOT) {
				this.dispatchSpotLight(scene, scope, spot, cnt);
				cnt++;
				staticId++;
				spot = staticLightList[staticId];
			}
		}
	}
	renderForwardPrepareMaterials(camera, drawCalls, drawCallsCount, sortedLights, cullingMask, layer, pass) {
		const addCall = (drawCall, isNewMaterial, lightMaskChanged) => {
			_drawCallList.drawCalls.push(drawCall);
			_drawCallList.isNewMaterial.push(isNewMaterial);
			_drawCallList.lightMaskChanged.push(lightMaskChanged);
		};
		_drawCallList.drawCalls.length = 0;
		_drawCallList.isNewMaterial.length = 0;
		_drawCallList.lightMaskChanged.length = 0;
		const device = this.device;
		const scene = this.scene;
		const lightHash = layer ? layer._lightHash : 0;
		let prevMaterial = null,
			prevObjDefs,
			prevStatic,
			prevLightMask;
		for (let i = 0; i < drawCallsCount; i++) {
			const drawCall = drawCalls[i];
			if (cullingMask && drawCall.mask && !(cullingMask & drawCall.mask)) continue;
			if (drawCall.command) {
				addCall(drawCall, false, false);
			} else {
				drawCall.ensureMaterial(device);
				const material = drawCall.material;
				const objDefs = drawCall._shaderDefs;
				const lightMask = drawCall.mask;
				if (material && material === prevMaterial && objDefs !== prevObjDefs) {
					prevMaterial = null;
				}
				if (drawCall.isStatic || prevStatic) {
					prevMaterial = null;
				}
				if (material !== prevMaterial) {
					this._materialSwitches++;
					material._scene = scene;
					if (material.dirty) {
						material.updateUniforms(device, scene);
						material.dirty = false;
					}
					if (material._dirtyBlend) {
						scene.layers._dirtyBlend = true;
					}
				}
				if (!drawCall._shader[pass] || drawCall._shaderDefs !== objDefs || drawCall._lightHash !== lightHash) {
					if (!drawCall.isStatic) {
						const variantKey = pass + '_' + objDefs + '_' + lightHash;
						drawCall._shader[pass] = material.variants[variantKey];
						if (!drawCall._shader[pass]) {
							drawCall.updatePassShader(scene, pass, null, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
							material.variants[variantKey] = drawCall._shader[pass];
						}
					} else {
						drawCall.updatePassShader(scene, pass, drawCall._staticLightList, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
					}
					drawCall._lightHash = lightHash;
				}
				addCall(drawCall, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);
				prevMaterial = material;
				prevObjDefs = objDefs;
				prevLightMask = lightMask;
				prevStatic = drawCall.isStatic;
			}
		}
		device.endShaderBatch == null ? void 0 : device.endShaderBatch();
		return _drawCallList;
	}
	renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
		const device = this.device;
		const scene = this.scene;
		const passFlag = 1 << pass;
		const flipFactor = flipFaces ? -1 : 1;
		let skipMaterial = false;
		const preparedCallsCount = preparedCalls.drawCalls.length;
		for (let i = 0; i < preparedCallsCount; i++) {
			const drawCall = preparedCalls.drawCalls[i];
			if (drawCall.command) {
				drawCall.command();
			} else {
				const newMaterial = preparedCalls.isNewMaterial[i];
				const lightMaskChanged = preparedCalls.lightMaskChanged[i];
				const material = drawCall.material;
				drawCall._shaderDefs;
				const lightMask = drawCall.mask;
				if (newMaterial) {
					const shader = drawCall._shader[pass];
					if (!shader.failed && !device.setShader(shader)) ;
					skipMaterial = shader.failed;
					if (skipMaterial) break;
					material.setParameters(device);
					if (lightMaskChanged) {
						const usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);
						this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
					}
					this.alphaTestId.setValue(material.alphaTest);
					device.setBlendState(material.blendState);
					device.setDepthState(material.depthState);
					device.setAlphaToCoverage(material.alphaToCoverage);
					if (material.depthBias || material.slopeDepthBias) {
						device.setDepthBias(true);
						device.setDepthBiasValues(material.depthBias, material.slopeDepthBias);
					} else {
						device.setDepthBias(false);
					}
				}
				this.setupCullMode(camera._cullFaces, flipFactor, drawCall);
				const stencilFront = drawCall.stencilFront || material.stencilFront;
				const stencilBack = drawCall.stencilBack || material.stencilBack;
				if (stencilFront || stencilBack) {
					device.setStencilTest(true);
					if (stencilFront === stencilBack) {
						device.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
						device.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
					} else {
						if (stencilFront) {
							device.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
							device.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
						} else {
							device.setStencilFuncFront(FUNC_ALWAYS, 0, 0xFF);
							device.setStencilOperationFront(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
						}
						if (stencilBack) {
							device.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
							device.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
						} else {
							device.setStencilFuncBack(FUNC_ALWAYS, 0, 0xFF);
							device.setStencilOperationBack(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
						}
					}
				} else {
					device.setStencilTest(false);
				}
				const mesh = drawCall.mesh;
				drawCall.setParameters(device, passFlag);
				this.setVertexBuffers(device, mesh);
				this.setMorphing(device, drawCall.morphInstance);
				this.setSkinning(device, drawCall);
				this.setupMeshUniformBuffers(drawCall, pass);
				const style = drawCall.renderStyle;
				device.setIndexBuffer(mesh.indexBuffer[style]);
				if (drawCallback) {
					drawCallback(drawCall, i);
				}
				if (camera.xr && camera.xr.session && camera.xr.views.length) {
					const views = camera.xr.views;
					for (let v = 0; v < views.length; v++) {
						const view = views[v];
						device.setViewport(view.viewport.x, view.viewport.y, view.viewport.z, view.viewport.w);
						this.projId.setValue(view.projMat.data);
						this.projSkyboxId.setValue(view.projMat.data);
						this.viewId.setValue(view.viewOffMat.data);
						this.viewInvId.setValue(view.viewInvOffMat.data);
						this.viewId3.setValue(view.viewMat3.data);
						this.viewProjId.setValue(view.projViewOffMat.data);
						this.viewPosId.setValue(view.position);
						if (v === 0) {
							this.drawInstance(device, drawCall, mesh, style, true);
						} else {
							this.drawInstance2(device, drawCall, mesh, style);
						}
						this._forwardDrawCalls++;
					}
				} else {
					this.drawInstance(device, drawCall, mesh, style, true);
					this._forwardDrawCalls++;
				}
				if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
					material.setParameters(device, drawCall.parameters);
				}
			}
		}
	}
	renderForward(camera, allDrawCalls, allDrawCallsCount, sortedLights, pass, cullingMask, drawCallback, layer, flipFaces) {
		const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, allDrawCallsCount, sortedLights, cullingMask, layer, pass);
		this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);
		_drawCallList.length = 0;
	}
	setSceneConstants() {
		const scene = this.scene;
		this.dispatchGlobalLights(scene);
		if (scene.fog !== FOG_NONE) {
			this.fogColor[0] = scene.fogColor.r;
			this.fogColor[1] = scene.fogColor.g;
			this.fogColor[2] = scene.fogColor.b;
			if (scene.gammaCorrection) {
				for (let i = 0; i < 3; i++) {
					this.fogColor[i] = Math.pow(this.fogColor[i], 2.2);
				}
			}
			this.fogColorId.setValue(this.fogColor);
			if (scene.fog === FOG_LINEAR) {
				this.fogStartId.setValue(scene.fogStart);
				this.fogEndId.setValue(scene.fogEnd);
			} else {
				this.fogDensityId.setValue(scene.fogDensity);
			}
		}
		const device = this.device;
		this._screenSize[0] = device.width;
		this._screenSize[1] = device.height;
		this._screenSize[2] = 1 / device.width;
		this._screenSize[3] = 1 / device.height;
		this.screenSizeId.setValue(this._screenSize);
	}
	updateLightStats(comp, compUpdatedFlags) {}
	buildFrameGraph(frameGraph, layerComposition) {
		const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
		frameGraph.reset();
		this.update(layerComposition);
		if (clusteredLightingEnabled) {
			{
				const renderPass = new RenderPass(this.device, () => {
					if (this.scene.lighting.cookiesEnabled) {
						this.renderCookies(layerComposition._splitLights[LIGHTTYPE_SPOT]);
						this.renderCookies(layerComposition._splitLights[LIGHTTYPE_OMNI]);
					}
				});
				renderPass.requiresCubemaps = false;
				frameGraph.addRenderPass(renderPass);
			}
			{
				const renderPass = new RenderPass(this.device);
				renderPass.requiresCubemaps = false;
				frameGraph.addRenderPass(renderPass);
				if (this.scene.lighting.shadowsEnabled) {
					const splitLights = layerComposition._splitLights;
					this._shadowRendererLocal.prepareClusteredRenderPass(renderPass, splitLights[LIGHTTYPE_SPOT], splitLights[LIGHTTYPE_OMNI]);
				}
				renderPass.after = () => {
					this.updateClusters(layerComposition);
				};
			}
		} else {
			const splitLights = layerComposition._splitLights;
			this._shadowRendererLocal.buildNonClusteredRenderPasses(frameGraph, splitLights[LIGHTTYPE_SPOT], splitLights[LIGHTTYPE_OMNI]);
		}
		let startIndex = 0;
		let newStart = true;
		let renderTarget = null;
		const renderActions = layerComposition._renderActions;
		for (let i = startIndex; i < renderActions.length; i++) {
			const renderAction = renderActions[i];
			const layer = layerComposition.layerList[renderAction.layerIndex];
			const camera = layer.cameras[renderAction.cameraIndex];
			if (!renderAction.isLayerEnabled(layerComposition)) {
				continue;
			}
			const isDepthLayer = layer.id === LAYERID_DEPTH;
			const isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);
			if (renderAction.hasDirectionalShadowLights && camera) {
				this._shadowRendererDirectional.buildFrameGraph(frameGraph, renderAction, camera);
			}
			if (newStart) {
				newStart = false;
				startIndex = i;
				renderTarget = renderAction.renderTarget;
			}
			let nextIndex = i + 1;
			while (renderActions[nextIndex] && !renderActions[nextIndex].isLayerEnabled(layerComposition)) {
				nextIndex++;
			}
			const nextRenderAction = renderActions[nextIndex];
			const isNextLayerDepth = nextRenderAction ? layerComposition.layerList[nextRenderAction.layerIndex].id === LAYERID_DEPTH : false;
			const isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap);
			if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget || nextRenderAction.hasDirectionalShadowLights || isNextLayerGrabPass || isGrabPass) {
				this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i, isGrabPass);
				if (renderAction.triggerPostprocess && camera != null && camera.onPostprocessing) {
					const renderPass = new RenderPass(this.device, () => {
						this.renderPassPostprocessing(renderAction, layerComposition);
					});
					renderPass.requiresCubemaps = false;
					frameGraph.addRenderPass(renderPass);
				}
				newStart = true;
			}
		}
	}
	addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex, isGrabPass) {
		const range = {
			start: startIndex,
			end: endIndex
		};
		const renderPass = new RenderPass(this.device, () => {
			this.renderPassRenderActions(layerComposition, range);
		});
		const renderActions = layerComposition._renderActions;
		const startRenderAction = renderActions[startIndex];
		const endRenderAction = renderActions[endIndex];
		const startLayer = layerComposition.layerList[startRenderAction.layerIndex];
		const camera = startLayer.cameras[startRenderAction.cameraIndex];
		if (camera) {
			if (startRenderAction.firstCameraUse && camera.onPreRender) {
				renderPass.before = () => {
					camera.onPreRender();
				};
			}
			if (endRenderAction.lastCameraUse && camera.onPostRender) {
				renderPass.after = () => {
					camera.onPostRender();
				};
			}
		}
		const grabPassRequired = isGrabPass && SceneGrab.requiresRenderPass(this.device, camera);
		const isRealPass = !isGrabPass || grabPassRequired;
		if (isRealPass) {
			renderPass.init(renderTarget);
			renderPass.fullSizeClearRect = camera.camera.fullSizeClearRect;
			if (grabPassRequired) {
				renderPass.setClearColor(webgl1DepthClearColor);
				renderPass.setClearDepth(1.0);
			} else if (renderPass.fullSizeClearRect) {
				if (startRenderAction.clearColor) {
					renderPass.setClearColor(camera.camera.clearColor);
				}
				if (startRenderAction.clearDepth) {
					renderPass.setClearDepth(camera.camera.clearDepth);
				}
				if (startRenderAction.clearStencil) {
					renderPass.setClearStencil(camera.camera.clearStencil);
				}
			}
		}
		frameGraph.addRenderPass(renderPass);
	}
	update(comp) {
		this.frameUpdate();
		this.shadowRenderer.frameUpdate();
		const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
		this.scene._updateSky(this.device);
		const updated = this.updateLayerComposition(comp, clusteredLightingEnabled);
		const lightsChanged = (updated & COMPUPDATED_LIGHTS) !== 0;
		this.updateLightStats(comp, updated);
		this.beginFrame(comp, lightsChanged);
		this.setSceneConstants();
		this.cullComposition(comp);
		this.gpuUpdate(comp._meshInstances);
	}
	renderPassPostprocessing(renderAction, layerComposition) {
		const layer = layerComposition.layerList[renderAction.layerIndex];
		const camera = layer.cameras[renderAction.cameraIndex];
		camera.onPostprocessing();
	}
	renderPassRenderActions(comp, range) {
		const renderActions = comp._renderActions;
		for (let i = range.start; i <= range.end; i++) {
			this.renderRenderAction(comp, renderActions[i], i === range.start);
		}
	}
	renderRenderAction(comp, renderAction, firstRenderAction) {
		const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
		const device = this.device;
		const layerIndex = renderAction.layerIndex;
		const layer = comp.layerList[layerIndex];
		const transparent = comp.subLayerList[layerIndex];
		const cameraPass = renderAction.cameraIndex;
		const camera = layer.cameras[cameraPass];
		if (!renderAction.isLayerEnabled(comp)) {
			return;
		}
		if (!transparent && layer.onPreRenderOpaque) {
			layer.onPreRenderOpaque(cameraPass);
		} else if (transparent && layer.onPreRenderTransparent) {
			layer.onPreRenderTransparent(cameraPass);
		}
		if (!(layer._preRenderCalledForCameras & 1 << cameraPass)) {
			if (layer.onPreRender) {
				layer.onPreRender(cameraPass);
			}
			layer._preRenderCalledForCameras |= 1 << cameraPass;
		}
		if (camera) {
			var _renderAction$renderT;
			this.setupViewport(camera.camera, renderAction.renderTarget);
			if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
				this.clear(camera.camera, renderAction.clearColor, renderAction.clearDepth, renderAction.clearStencil);
			}
			layer._sortVisible(transparent, camera.camera.node, cameraPass);
			const objects = layer.instances;
			const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];
			this.scene.immediate.onPreRenderLayer(layer, visible, transparent);
			if (clusteredLightingEnabled && renderAction.lightClusters) {
				renderAction.lightClusters.activate(this.lightTextureAtlas);
				if (!this.clustersDebugRendered && this.scene.lighting.debugLayer === layer.id) {
					this.clustersDebugRendered = true;
				}
			}
			this.scene._activeCamera = camera.camera;
			const viewCount = this.setCameraUniforms(camera.camera, renderAction.renderTarget);
			if (device.supportsUniformBuffers) {
				this.setupViewUniformBuffers(renderAction.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, viewCount);
			}
			const flipFaces = !!(camera.camera._flipFaces ^ (renderAction == null ? void 0 : (_renderAction$renderT = renderAction.renderTarget) == null ? void 0 : _renderAction$renderT.flipY));
			const draws = this._forwardDrawCalls;
			this.renderForward(camera.camera, visible.list, visible.length, layer._splitLights, layer.shaderPass, layer.cullingMask, layer.onDrawCall, layer, flipFaces);
			layer._forwardDrawCalls += this._forwardDrawCalls - draws;
			device.setBlendState(BlendState.DEFAULT);
			device.setStencilTest(false);
			device.setAlphaToCoverage(false);
			device.setDepthBias(false);
		}
		if (!transparent && layer.onPostRenderOpaque) {
			layer.onPostRenderOpaque(cameraPass);
		} else if (transparent && layer.onPostRenderTransparent) {
			layer.onPostRenderTransparent(cameraPass);
		}
		if (layer.onPostRender && !(layer._postRenderCalledForCameras & 1 << cameraPass)) {
			layer._postRenderCounter &= ~(transparent ? 2 : 1);
			if (layer._postRenderCounter === 0) {
				layer.onPostRender(cameraPass);
				layer._postRenderCalledForCameras |= 1 << cameraPass;
				layer._postRenderCounter = layer._postRenderCounterMax;
			}
		}
	}
}

export { ForwardRenderer };
