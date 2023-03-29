/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';

/**
 * Store, access and delete instances of the various ComponentSystems.
 */
class ComponentSystemRegistry extends EventHandler {
  /**
   * Gets the {@link AnimComponentSystem} from the registry.
   *
   * @type {import('./anim/system.js').AnimComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link AnimationComponentSystem} from the registry.
   *
   * @type {import('./animation/system.js').AnimationComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link AudioListenerComponentSystem} from the registry.
   *
   * @type {import('./audio-listener/system.js').AudioListenerComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link AudioSourceComponentSystem} from the registry.
   *
   * @type {import('./audio-source/system.js').AudioSourceComponentSystem|undefined}
   * @readonly
   * @ignore
   */

  /**
   * Gets the {@link ButtonComponentSystem} from the registry.
   *
   * @type {import('./button/system.js').ButtonComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link CameraComponentSystem} from the registry.
   *
   * @type {import('./camera/system.js').CameraComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link CollisionComponentSystem} from the registry.
   *
   * @type {import('./collision/system.js').CollisionComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ElementComponentSystem} from the registry.
   *
   * @type {import('./element/system.js').ElementComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link JointComponentSystem} from the registry.
   *
   * @type {import('./joint/system.js').JointComponentSystem|undefined}
   * @readonly
   * @ignore
   */

  /**
   * Gets the {@link LayoutChildComponentSystem} from the registry.
   *
   * @type {import('./layout-child/system.js').LayoutChildComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link LayoutGroupComponentSystem} from the registry.
   *
   * @type {import('./layout-group/system.js').LayoutGroupComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link LightComponentSystem} from the registry.
   *
   * @type {import('./light/system.js').LightComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ModelComponentSystem} from the registry.
   *
   * @type {import('./model/system.js').ModelComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ParticleSystemComponentSystem} from the registry.
   *
   * @type {import('./particle-system/system.js').ParticleSystemComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link RenderComponentSystem} from the registry.
   *
   * @type {import('./render/system.js').RenderComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link RigidBodyComponentSystem} from the registry.
   *
   * @type {import('./rigid-body/system.js').RigidBodyComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScreenComponentSystem} from the registry.
   *
   * @type {import('./screen/system.js').ScreenComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScriptComponentSystem} from the registry.
   *
   * @type {import('./script/system.js').ScriptComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScrollbarComponentSystem} from the registry.
   *
   * @type {import('./scrollbar/system.js').ScrollbarComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScrollViewComponentSystem} from the registry.
   *
   * @type {import('./scroll-view/system.js').ScrollViewComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link SoundComponentSystem} from the registry.
   *
   * @type {import('./sound/system.js').SoundComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link SpriteComponentSystem} from the registry.
   *
   * @type {import('./sprite/system.js').SpriteComponentSystem|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ZoneComponentSystem} from the registry.
   *
   * @type {import('./zone/system.js').ZoneComponentSystem|undefined}
   * @readonly
   * @ignore
   */

  /**
   * Create a new ComponentSystemRegistry instance.
   */
  constructor() {
    super();

    // An array of pc.ComponentSystem objects
    this.anim = void 0;
    this.animation = void 0;
    this.audiolistener = void 0;
    this.audiosource = void 0;
    this.button = void 0;
    this.camera = void 0;
    this.collision = void 0;
    this.element = void 0;
    this.joint = void 0;
    this.layoutchild = void 0;
    this.layoutgroup = void 0;
    this.light = void 0;
    this.model = void 0;
    this.particlesystem = void 0;
    this.render = void 0;
    this.rigidbody = void 0;
    this.screen = void 0;
    this.script = void 0;
    this.scrollbar = void 0;
    this.scrollview = void 0;
    this.sound = void 0;
    this.sprite = void 0;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvY29tcG9uZW50cy9yZWdpc3RyeS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG4vKipcbiAqIFN0b3JlLCBhY2Nlc3MgYW5kIGRlbGV0ZSBpbnN0YW5jZXMgb2YgdGhlIHZhcmlvdXMgQ29tcG9uZW50U3lzdGVtcy5cbiAqL1xuY2xhc3MgQ29tcG9uZW50U3lzdGVtUmVnaXN0cnkgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBbmltQ29tcG9uZW50U3lzdGVtfSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYW5pbS9zeXN0ZW0uanMnKS5BbmltQ29tcG9uZW50U3lzdGVtfHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBhbmltO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEFuaW1hdGlvbkNvbXBvbmVudFN5c3RlbX0gZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2FuaW1hdGlvbi9zeXN0ZW0uanMnKS5BbmltYXRpb25Db21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGFuaW1hdGlvbjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50U3lzdGVtfSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYXVkaW8tbGlzdGVuZXIvc3lzdGVtLmpzJykuQXVkaW9MaXN0ZW5lckNvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgYXVkaW9saXN0ZW5lcjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBdWRpb1NvdXJjZUNvbXBvbmVudFN5c3RlbX0gZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2F1ZGlvLXNvdXJjZS9zeXN0ZW0uanMnKS5BdWRpb1NvdXJjZUNvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGF1ZGlvc291cmNlO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEJ1dHRvbkNvbXBvbmVudFN5c3RlbX0gZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2J1dHRvbi9zeXN0ZW0uanMnKS5CdXR0b25Db21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGJ1dHRvbjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBDYW1lcmFDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jYW1lcmEvc3lzdGVtLmpzJykuQ2FtZXJhQ29tcG9uZW50U3lzdGVtfHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBjYW1lcmE7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtfSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29sbGlzaW9uL3N5c3RlbS5qcycpLkNvbGxpc2lvbkNvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY29sbGlzaW9uO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEVsZW1lbnRDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9lbGVtZW50L3N5c3RlbS5qcycpLkVsZW1lbnRDb21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGVsZW1lbnQ7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgSm9pbnRDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9qb2ludC9zeXN0ZW0uanMnKS5Kb2ludENvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGpvaW50O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIExheW91dENoaWxkQ29tcG9uZW50U3lzdGVtfSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbGF5b3V0LWNoaWxkL3N5c3RlbS5qcycpLkxheW91dENoaWxkQ29tcG9uZW50U3lzdGVtfHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBsYXlvdXRjaGlsZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudFN5c3RlbX0gZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xheW91dC1ncm91cC9zeXN0ZW0uanMnKS5MYXlvdXRHcm91cENvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbGF5b3V0Z3JvdXA7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgTGlnaHRDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9saWdodC9zeXN0ZW0uanMnKS5MaWdodENvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbGlnaHQ7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgTW9kZWxDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tb2RlbC9zeXN0ZW0uanMnKS5Nb2RlbENvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbW9kZWw7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9wYXJ0aWNsZS1zeXN0ZW0vc3lzdGVtLmpzJykuUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHBhcnRpY2xlc3lzdGVtO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFJlbmRlckNvbXBvbmVudFN5c3RlbX0gZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3JlbmRlci9zeXN0ZW0uanMnKS5SZW5kZXJDb21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHJlbmRlcjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9yaWdpZC1ib2R5L3N5c3RlbS5qcycpLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcmlnaWRib2R5O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcmVlbkNvbXBvbmVudFN5c3RlbX0gZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NjcmVlbi9zeXN0ZW0uanMnKS5TY3JlZW5Db21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNjcmVlbjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBTY3JpcHRDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9zY3JpcHQvc3lzdGVtLmpzJykuU2NyaXB0Q29tcG9uZW50U3lzdGVtfHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzY3JpcHQ7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgU2Nyb2xsYmFyQ29tcG9uZW50U3lzdGVtfSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2Nyb2xsYmFyL3N5c3RlbS5qcycpLlNjcm9sbGJhckNvbXBvbmVudFN5c3RlbXx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2Nyb2xsYmFyO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcm9sbFZpZXdDb21wb25lbnRTeXN0ZW19IGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9zY3JvbGwtdmlldy9zeXN0ZW0uanMnKS5TY3JvbGxWaWV3Q29tcG9uZW50U3lzdGVtfHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzY3JvbGx2aWV3O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNvdW5kQ29tcG9uZW50U3lzdGVtfSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc291bmQvc3lzdGVtLmpzJykuU291bmRDb21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNvdW5kO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNwcml0ZUNvbXBvbmVudFN5c3RlbX0gZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3Nwcml0ZS9zeXN0ZW0uanMnKS5TcHJpdGVDb21wb25lbnRTeXN0ZW18dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNwcml0ZTtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBab25lQ29tcG9uZW50U3lzdGVtfSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vem9uZS9zeXN0ZW0uanMnKS5ab25lQ29tcG9uZW50U3lzdGVtfHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgem9uZTtcblxuICAgICAvKipcbiAgICAgICogQ3JlYXRlIGEgbmV3IENvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5IGluc3RhbmNlLlxuICAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyBBbiBhcnJheSBvZiBwYy5Db21wb25lbnRTeXN0ZW0gb2JqZWN0c1xuICAgICAgICB0aGlzLmxpc3QgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBjb21wb25lbnQgc3lzdGVtIHRvIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzeXN0ZW0gLSBUaGUge0BsaW5rIENvbXBvbmVudFN5c3RlbX0gaW5zdGFuY2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkZChzeXN0ZW0pIHtcbiAgICAgICAgY29uc3QgaWQgPSBzeXN0ZW0uaWQ7XG4gICAgICAgIGlmICh0aGlzW2lkXSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnRTeXN0ZW0gbmFtZSAnJHtpZH0nIGFscmVhZHkgcmVnaXN0ZXJlZCBvciBub3QgYWxsb3dlZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpc1tpZF0gPSBzeXN0ZW07XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBjb21wb25lbnQgc3lzdGVtIGFycmF5XG4gICAgICAgIHRoaXMubGlzdC5wdXNoKHN5c3RlbSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGEgY29tcG9uZW50IHN5c3RlbSBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzeXN0ZW0gLSBUaGUge0BsaW5rIENvbXBvbmVudFN5c3RlbX0gaW5zdGFuY2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbW92ZShzeXN0ZW0pIHtcbiAgICAgICAgY29uc3QgaWQgPSBzeXN0ZW0uaWQ7XG4gICAgICAgIGlmICghdGhpc1tpZF0pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gQ29tcG9uZW50U3lzdGVtIG5hbWVkICcke2lkfScgcmVnaXN0ZXJlZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZXRlIHRoaXNbaWRdO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgY29tcG9uZW50IHN5c3RlbSBhcnJheVxuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGlzdC5pbmRleE9mKHRoaXNbaWRdKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5saXN0LnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLm9mZigpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RbaV0uZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSB9O1xuIl0sIm5hbWVzIjpbIkNvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhbmltIiwiYW5pbWF0aW9uIiwiYXVkaW9saXN0ZW5lciIsImF1ZGlvc291cmNlIiwiYnV0dG9uIiwiY2FtZXJhIiwiY29sbGlzaW9uIiwiZWxlbWVudCIsImpvaW50IiwibGF5b3V0Y2hpbGQiLCJsYXlvdXRncm91cCIsImxpZ2h0IiwibW9kZWwiLCJwYXJ0aWNsZXN5c3RlbSIsInJlbmRlciIsInJpZ2lkYm9keSIsInNjcmVlbiIsInNjcmlwdCIsInNjcm9sbGJhciIsInNjcm9sbHZpZXciLCJzb3VuZCIsInNwcml0ZSIsInpvbmUiLCJsaXN0IiwiYWRkIiwic3lzdGVtIiwiaWQiLCJFcnJvciIsInB1c2giLCJyZW1vdmUiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJkZXN0cm95Iiwib2ZmIiwiaSIsImxlbmd0aCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLHVCQUF1QixTQUFTQyxZQUFZLENBQUM7QUFDL0M7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSztBQUNMO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxHQUFHO0FBQ1YsSUFBQSxLQUFLLEVBQUUsQ0FBQTs7QUFFUDtBQUFBLElBQUEsSUFBQSxDQTNMSkMsSUFBSSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUUpDLFNBQVMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFUQyxhQUFhLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FTYkMsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVhDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFOQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVRDLE9BQU8sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVNQQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTEMsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVhDLFdBQVcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFYQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTEMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUUxDLGNBQWMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFkQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVRDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFOQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVRDLFVBQVUsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFWQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTEMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBU05DLElBQUksR0FBQSxLQUFBLENBQUEsQ0FBQTtJQVNBLElBQUksQ0FBQ0MsSUFBSSxHQUFHLEVBQUUsQ0FBQTtBQUNsQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxHQUFHLENBQUNDLE1BQU0sRUFBRTtBQUNSLElBQUEsTUFBTUMsRUFBRSxHQUFHRCxNQUFNLENBQUNDLEVBQUUsQ0FBQTtBQUNwQixJQUFBLElBQUksSUFBSSxDQUFDQSxFQUFFLENBQUMsRUFBRTtBQUNWLE1BQUEsTUFBTSxJQUFJQyxLQUFLLENBQUUsQ0FBd0JELHNCQUFBQSxFQUFBQSxFQUFHLHFDQUFvQyxDQUFDLENBQUE7QUFDckYsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDQSxFQUFFLENBQUMsR0FBR0QsTUFBTSxDQUFBOztBQUVqQjtBQUNBLElBQUEsSUFBSSxDQUFDRixJQUFJLENBQUNLLElBQUksQ0FBQ0gsTUFBTSxDQUFDLENBQUE7QUFDMUIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUksTUFBTSxDQUFDSixNQUFNLEVBQUU7QUFDWCxJQUFBLE1BQU1DLEVBQUUsR0FBR0QsTUFBTSxDQUFDQyxFQUFFLENBQUE7QUFDcEIsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDQSxFQUFFLENBQUMsRUFBRTtBQUNYLE1BQUEsTUFBTSxJQUFJQyxLQUFLLENBQUUsQ0FBNEJELDBCQUFBQSxFQUFBQSxFQUFHLGNBQWEsQ0FBQyxDQUFBO0FBQ2xFLEtBQUE7SUFFQSxPQUFPLElBQUksQ0FBQ0EsRUFBRSxDQUFDLENBQUE7O0FBRWY7QUFDQSxJQUFBLE1BQU1JLEtBQUssR0FBRyxJQUFJLENBQUNQLElBQUksQ0FBQ1EsT0FBTyxDQUFDLElBQUksQ0FBQ0wsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN6QyxJQUFBLElBQUlJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRTtNQUNkLElBQUksQ0FBQ1AsSUFBSSxDQUFDUyxNQUFNLENBQUNGLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUM5QixLQUFBO0FBQ0osR0FBQTtBQUVBRyxFQUFBQSxPQUFPLEdBQUc7SUFDTixJQUFJLENBQUNDLEdBQUcsRUFBRSxDQUFBO0FBRVYsSUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNaLElBQUksQ0FBQ2EsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUN2QyxNQUFBLElBQUksQ0FBQ1osSUFBSSxDQUFDWSxDQUFDLENBQUMsQ0FBQ0YsT0FBTyxFQUFFLENBQUE7QUFDMUIsS0FBQTtBQUNKLEdBQUE7QUFDSjs7OzsifQ==
