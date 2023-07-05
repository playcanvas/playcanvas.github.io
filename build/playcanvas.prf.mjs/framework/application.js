import { platform } from '../core/platform.js';
import { WebglGraphicsDevice } from '../platform/graphics/webgl/webgl-graphics-device.js';
import { SoundManager } from '../platform/sound/manager.js';
import { Lightmapper } from './lightmapper/lightmapper.js';
import { BatchManager } from '../scene/batching/batch-manager.js';
import { AppBase } from './app-base.js';
import { AppOptions } from './app-options.js';
import { script } from './script.js';
import { AnimationComponentSystem } from './components/animation/system.js';
import { AnimComponentSystem } from './components/anim/system.js';
import { AudioListenerComponentSystem } from './components/audio-listener/system.js';
import { AudioSourceComponentSystem } from './components/audio-source/system.js';
import { ButtonComponentSystem } from './components/button/system.js';
import { CollisionComponentSystem } from './components/collision/system.js';
import { ElementComponentSystem } from './components/element/system.js';
import { JointComponentSystem } from './components/joint/system.js';
import { LayoutChildComponentSystem } from './components/layout-child/system.js';
import { LayoutGroupComponentSystem } from './components/layout-group/system.js';
import { ModelComponentSystem } from './components/model/system.js';
import { ParticleSystemComponentSystem } from './components/particle-system/system.js';
import { RenderComponentSystem } from './components/render/system.js';
import { RigidBodyComponentSystem } from './components/rigid-body/system.js';
import { ScreenComponentSystem } from './components/screen/system.js';
import { ScriptLegacyComponentSystem } from './components/script-legacy/system.js';
import { ScrollViewComponentSystem } from './components/scroll-view/system.js';
import { ScrollbarComponentSystem } from './components/scrollbar/system.js';
import { SoundComponentSystem } from './components/sound/system.js';
import { SpriteComponentSystem } from './components/sprite/system.js';
import { ZoneComponentSystem } from './components/zone/system.js';
import { CameraComponentSystem } from './components/camera/system.js';
import { LightComponentSystem } from './components/light/system.js';
import { ScriptComponentSystem } from './components/script/system.js';
import { RenderHandler } from './handlers/render.js';
import { AnimationHandler } from './handlers/animation.js';
import { AnimClipHandler } from './handlers/anim-clip.js';
import { AnimStateGraphHandler } from './handlers/anim-state-graph.js';
import { AudioHandler } from './handlers/audio.js';
import { BinaryHandler } from './handlers/binary.js';
import { ContainerHandler } from './handlers/container.js';
import { CssHandler } from './handlers/css.js';
import { CubemapHandler } from './handlers/cubemap.js';
import { FolderHandler } from './handlers/folder.js';
import { FontHandler } from './handlers/font.js';
import { HierarchyHandler } from './handlers/hierarchy.js';
import { HtmlHandler } from './handlers/html.js';
import { JsonHandler } from './handlers/json.js';
import { MaterialHandler } from './handlers/material.js';
import { ModelHandler } from './handlers/model.js';
import { SceneHandler } from './handlers/scene.js';
import { ScriptHandler } from './handlers/script.js';
import { ShaderHandler } from './handlers/shader.js';
import { SpriteHandler } from './handlers/sprite.js';
import { TemplateHandler } from './handlers/template.js';
import { TextHandler } from './handlers/text.js';
import { TextureAtlasHandler } from './handlers/texture-atlas.js';
import { TextureHandler } from './handlers/texture.js';
import { XrManager } from './xr/xr-manager.js';

class Application extends AppBase {
	constructor(canvas, options = {}) {
		super(canvas);
		const appOptions = new AppOptions();
		appOptions.graphicsDevice = this.createDevice(canvas, options);
		this.addComponentSystems(appOptions);
		this.addResourceHandles(appOptions);
		appOptions.elementInput = options.elementInput;
		appOptions.keyboard = options.keyboard;
		appOptions.mouse = options.mouse;
		appOptions.touch = options.touch;
		appOptions.gamepads = options.gamepads;
		appOptions.scriptPrefix = options.scriptPrefix;
		appOptions.assetPrefix = options.assetPrefix;
		appOptions.scriptsOrder = options.scriptsOrder;
		appOptions.soundManager = new SoundManager();
		appOptions.lightmapper = Lightmapper;
		appOptions.batchManager = BatchManager;
		appOptions.xr = XrManager;
		this.init(appOptions);
	}
	createDevice(canvas, options) {
		if (!options.graphicsDeviceOptions) {
			options.graphicsDeviceOptions = {};
		}
		if (platform.browser && !!navigator.xr) {
			options.graphicsDeviceOptions.xrCompatible = true;
		}
		options.graphicsDeviceOptions.alpha = options.graphicsDeviceOptions.alpha || false;
		return new WebglGraphicsDevice(canvas, options.graphicsDeviceOptions);
	}
	addComponentSystems(appOptions) {
		appOptions.componentSystems = [RigidBodyComponentSystem, CollisionComponentSystem, JointComponentSystem, AnimationComponentSystem, AnimComponentSystem, ModelComponentSystem, RenderComponentSystem, CameraComponentSystem, LightComponentSystem, script.legacy ? ScriptLegacyComponentSystem : ScriptComponentSystem, AudioSourceComponentSystem, SoundComponentSystem, AudioListenerComponentSystem, ParticleSystemComponentSystem, ScreenComponentSystem, ElementComponentSystem, ButtonComponentSystem, ScrollViewComponentSystem, ScrollbarComponentSystem, SpriteComponentSystem, LayoutGroupComponentSystem, LayoutChildComponentSystem, ZoneComponentSystem];
	}
	addResourceHandles(appOptions) {
		appOptions.resourceHandlers = [RenderHandler, AnimationHandler, AnimClipHandler, AnimStateGraphHandler, ModelHandler, MaterialHandler, TextureHandler, TextHandler, JsonHandler, AudioHandler, ScriptHandler, SceneHandler, CubemapHandler, HtmlHandler, CssHandler, ShaderHandler, HierarchyHandler, FolderHandler, FontHandler, BinaryHandler, TextureAtlasHandler, SpriteHandler, TemplateHandler, ContainerHandler];
	}
}

export { Application };
