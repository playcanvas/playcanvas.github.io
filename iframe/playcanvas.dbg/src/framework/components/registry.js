import { EventHandler } from '../../core/event-handler.js';

/**
 * Store, access and delete instances of the various ComponentSystems.
 */
class ComponentSystemRegistry extends EventHandler {
  /**
   * Create a new ComponentSystemRegistry instance.
   */
  constructor() {
    super();

    // An array of pc.ComponentSystem objects
    /**
     * Gets the {@link AnimComponentSystem} from the registry.
     *
     * @type {import('./anim/system.js').AnimComponentSystem|undefined}
     * @readonly
     */
    this.anim = void 0;
    /**
     * Gets the {@link AnimationComponentSystem} from the registry.
     *
     * @type {import('./animation/system.js').AnimationComponentSystem|undefined}
     * @readonly
     */
    this.animation = void 0;
    /**
     * Gets the {@link AudioListenerComponentSystem} from the registry.
     *
     * @type {import('./audio-listener/system.js').AudioListenerComponentSystem|undefined}
     * @readonly
     */
    this.audiolistener = void 0;
    /**
     * Gets the {@link AudioSourceComponentSystem} from the registry.
     *
     * @type {import('./audio-source/system.js').AudioSourceComponentSystem|undefined}
     * @readonly
     * @ignore
     */
    this.audiosource = void 0;
    /**
     * Gets the {@link ButtonComponentSystem} from the registry.
     *
     * @type {import('./button/system.js').ButtonComponentSystem|undefined}
     * @readonly
     */
    this.button = void 0;
    /**
     * Gets the {@link CameraComponentSystem} from the registry.
     *
     * @type {import('./camera/system.js').CameraComponentSystem|undefined}
     * @readonly
     */
    this.camera = void 0;
    /**
     * Gets the {@link CollisionComponentSystem} from the registry.
     *
     * @type {import('./collision/system.js').CollisionComponentSystem|undefined}
     * @readonly
     */
    this.collision = void 0;
    /**
     * Gets the {@link ElementComponentSystem} from the registry.
     *
     * @type {import('./element/system.js').ElementComponentSystem|undefined}
     * @readonly
     */
    this.element = void 0;
    /**
     * Gets the {@link JointComponentSystem} from the registry.
     *
     * @type {import('./joint/system.js').JointComponentSystem|undefined}
     * @readonly
     * @ignore
     */
    this.joint = void 0;
    /**
     * Gets the {@link LayoutChildComponentSystem} from the registry.
     *
     * @type {import('./layout-child/system.js').LayoutChildComponentSystem|undefined}
     * @readonly
     */
    this.layoutchild = void 0;
    /**
     * Gets the {@link LayoutGroupComponentSystem} from the registry.
     *
     * @type {import('./layout-group/system.js').LayoutGroupComponentSystem|undefined}
     * @readonly
     */
    this.layoutgroup = void 0;
    /**
     * Gets the {@link LightComponentSystem} from the registry.
     *
     * @type {import('./light/system.js').LightComponentSystem|undefined}
     * @readonly
     */
    this.light = void 0;
    /**
     * Gets the {@link ModelComponentSystem} from the registry.
     *
     * @type {import('./model/system.js').ModelComponentSystem|undefined}
     * @readonly
     */
    this.model = void 0;
    /**
     * Gets the {@link ParticleSystemComponentSystem} from the registry.
     *
     * @type {import('./particle-system/system.js').ParticleSystemComponentSystem|undefined}
     * @readonly
     */
    this.particlesystem = void 0;
    /**
     * Gets the {@link RenderComponentSystem} from the registry.
     *
     * @type {import('./render/system.js').RenderComponentSystem|undefined}
     * @readonly
     */
    this.render = void 0;
    /**
     * Gets the {@link RigidBodyComponentSystem} from the registry.
     *
     * @type {import('./rigid-body/system.js').RigidBodyComponentSystem|undefined}
     * @readonly
     */
    this.rigidbody = void 0;
    /**
     * Gets the {@link ScreenComponentSystem} from the registry.
     *
     * @type {import('./screen/system.js').ScreenComponentSystem|undefined}
     * @readonly
     */
    this.screen = void 0;
    /**
     * Gets the {@link ScriptComponentSystem} from the registry.
     *
     * @type {import('./script/system.js').ScriptComponentSystem|undefined}
     * @readonly
     */
    this.script = void 0;
    /**
     * Gets the {@link ScrollbarComponentSystem} from the registry.
     *
     * @type {import('./scrollbar/system.js').ScrollbarComponentSystem|undefined}
     * @readonly
     */
    this.scrollbar = void 0;
    /**
     * Gets the {@link ScrollViewComponentSystem} from the registry.
     *
     * @type {import('./scroll-view/system.js').ScrollViewComponentSystem|undefined}
     * @readonly
     */
    this.scrollview = void 0;
    /**
     * Gets the {@link SoundComponentSystem} from the registry.
     *
     * @type {import('./sound/system.js').SoundComponentSystem|undefined}
     * @readonly
     */
    this.sound = void 0;
    /**
     * Gets the {@link SpriteComponentSystem} from the registry.
     *
     * @type {import('./sprite/system.js').SpriteComponentSystem|undefined}
     * @readonly
     */
    this.sprite = void 0;
    /**
     * Gets the {@link ZoneComponentSystem} from the registry.
     *
     * @type {import('./zone/system.js').ZoneComponentSystem|undefined}
     * @readonly
     * @ignore
     */
    this.zone = void 0;
    this.list = [];
  }

  /**
   * Add a component system to the registry.
   *
   * @param {object} system - The {@link ComponentSystem} instance.
   * @ignore
   */
  add(system) {
    const id = system.id;
    if (this[id]) {
      throw new Error(`ComponentSystem name '${id}' already registered or not allowed`);
    }
    this[id] = system;

    // Update the component system array
    this.list.push(system);
  }

  /**
   * Remove a component system from the registry.
   *
   * @param {object} system - The {@link ComponentSystem} instance.
   * @ignore
   */
  remove(system) {
    const id = system.id;
    if (!this[id]) {
      throw new Error(`No ComponentSystem named '${id}' registered`);
    }
    delete this[id];

    // Update the component system array
    const index = this.list.indexOf(this[id]);
    if (index !== -1) {
      this.list.splice(index, 1);
    }
  }
  destroy() {
    this.off();
    for (let i = 0; i < this.list.length; i++) {
      this.list[i].destroy();
    }
  }
}

export { ComponentSystemRegistry };
