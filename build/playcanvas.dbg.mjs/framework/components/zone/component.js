import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';

/**
 * The ZoneComponent allows you to define an area in world space of certain size. This can be used
 * in various ways, such as affecting audio reverb when {@link AudioListenerComponent} is within
 * zone. Or create culling system with portals between zones to hide whole indoor sections for
 * performance reasons. And many other possible options. Zones are building blocks and meant to be
 * used in many different ways.
 *
 * @augments Component
 * @ignore
 */
class ZoneComponent extends Component {
  /**
   * Create a new ZoneComponent instance.
   *
   * @param {import('./system.js').ZoneComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    this._oldState = true;
    this._size = new Vec3();
    this.on('set_enabled', this._onSetEnabled, this);
  }

  /**
   * Fired when Component becomes enabled. Note: this event does not take in account entity or
   * any of its parent enabled state.
   *
   * @event ZoneComponent#enable
   * @example
   * entity.zone.on('enable', function () {
   *     // component is enabled
   * });
   * @ignore
   */

  /**
   * Fired when Component becomes disabled. Note: this event does not take in account entity or
   * any of its parent enabled state.
   *
   * @event ZoneComponent#disable
   * @example
   * entity.zone.on('disable', function () {
   *     // component is disabled
   * });
   * @ignore
   */

  /**
   * Fired when Component changes state to enabled or disabled. Note: this event does not take in
   * account entity or any of its parent enabled state.
   *
   * @event ZoneComponent#state
   * @param {boolean} enabled - True if now enabled, False if disabled.
   * @example
   * entity.zone.on('state', function (enabled) {
   *     // component changed state
   * });
   * @ignore
   */

  /**
   * Fired when a zone is removed from an entity.
   *
   * @event ZoneComponent#remove
   * @example
   * entity.zone.on('remove', function () {
   *     // zone has been removed from an entity
   * });
   * @ignore
   */

  /**
   * The size of the axis-aligned box of this ZoneComponent.
   *
   * @type {Vec3}
   */
  set size(data) {
    if (data instanceof Vec3) {
      this._size.copy(data);
    } else if (data instanceof Array && data.length >= 3) {
      this.size.set(data[0], data[1], data[2]);
    }
  }
  get size() {
    return this._size;
  }
  onEnable() {
    this._checkState();
  }
  onDisable() {
    this._checkState();
  }
  _onSetEnabled(prop, old, value) {
    this._checkState();
  }
  _checkState() {
    const state = this.enabled && this.entity.enabled;
    if (state === this._oldState) return;
    this._oldState = state;
    this.fire('enable');
    this.fire('state', this.enabled);
  }
  _onBeforeRemove() {
    this.fire('remove');
  }
}

export { ZoneComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvem9uZS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqXG4gKiBUaGUgWm9uZUNvbXBvbmVudCBhbGxvd3MgeW91IHRvIGRlZmluZSBhbiBhcmVhIGluIHdvcmxkIHNwYWNlIG9mIGNlcnRhaW4gc2l6ZS4gVGhpcyBjYW4gYmUgdXNlZFxuICogaW4gdmFyaW91cyB3YXlzLCBzdWNoIGFzIGFmZmVjdGluZyBhdWRpbyByZXZlcmIgd2hlbiB7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudH0gaXMgd2l0aGluXG4gKiB6b25lLiBPciBjcmVhdGUgY3VsbGluZyBzeXN0ZW0gd2l0aCBwb3J0YWxzIGJldHdlZW4gem9uZXMgdG8gaGlkZSB3aG9sZSBpbmRvb3Igc2VjdGlvbnMgZm9yXG4gKiBwZXJmb3JtYW5jZSByZWFzb25zLiBBbmQgbWFueSBvdGhlciBwb3NzaWJsZSBvcHRpb25zLiBab25lcyBhcmUgYnVpbGRpbmcgYmxvY2tzIGFuZCBtZWFudCB0byBiZVxuICogdXNlZCBpbiBtYW55IGRpZmZlcmVudCB3YXlzLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgWm9uZUNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFpvbmVDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5ab25lQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9vbGRTdGF0ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3NpemUgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfZW5hYmxlZCcsIHRoaXMuX29uU2V0RW5hYmxlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBDb21wb25lbnQgYmVjb21lcyBlbmFibGVkLiBOb3RlOiB0aGlzIGV2ZW50IGRvZXMgbm90IHRha2UgaW4gYWNjb3VudCBlbnRpdHkgb3JcbiAgICAgKiBhbnkgb2YgaXRzIHBhcmVudCBlbmFibGVkIHN0YXRlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFpvbmVDb21wb25lbnQjZW5hYmxlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuem9uZS5vbignZW5hYmxlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAqIH0pO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gQ29tcG9uZW50IGJlY29tZXMgZGlzYWJsZWQuIE5vdGU6IHRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpbiBhY2NvdW50IGVudGl0eSBvclxuICAgICAqIGFueSBvZiBpdHMgcGFyZW50IGVuYWJsZWQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWm9uZUNvbXBvbmVudCNkaXNhYmxlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuem9uZS5vbignZGlzYWJsZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gY29tcG9uZW50IGlzIGRpc2FibGVkXG4gICAgICogfSk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBDb21wb25lbnQgY2hhbmdlcyBzdGF0ZSB0byBlbmFibGVkIG9yIGRpc2FibGVkLiBOb3RlOiB0aGlzIGV2ZW50IGRvZXMgbm90IHRha2UgaW5cbiAgICAgKiBhY2NvdW50IGVudGl0eSBvciBhbnkgb2YgaXRzIHBhcmVudCBlbmFibGVkIHN0YXRlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFpvbmVDb21wb25lbnQjc3RhdGVcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIGlmIG5vdyBlbmFibGVkLCBGYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS56b25lLm9uKCdzdGF0ZScsIGZ1bmN0aW9uIChlbmFibGVkKSB7XG4gICAgICogICAgIC8vIGNvbXBvbmVudCBjaGFuZ2VkIHN0YXRlXG4gICAgICogfSk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHpvbmUgaXMgcmVtb3ZlZCBmcm9tIGFuIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEBldmVudCBab25lQ29tcG9uZW50I3JlbW92ZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnpvbmUub24oJ3JlbW92ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gem9uZSBoYXMgYmVlbiByZW1vdmVkIGZyb20gYW4gZW50aXR5XG4gICAgICogfSk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNpemUgb2YgdGhlIGF4aXMtYWxpZ25lZCBib3ggb2YgdGhpcyBab25lQ29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IHNpemUoZGF0YSkge1xuICAgICAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NpemUuY29weShkYXRhKTtcbiAgICAgICAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgQXJyYXkgJiYgZGF0YS5sZW5ndGggPj0gMykge1xuICAgICAgICAgICAgdGhpcy5zaXplLnNldChkYXRhWzBdLCBkYXRhWzFdLCBkYXRhWzJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2l6ZTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuICAgIH1cblxuICAgIF9vblNldEVuYWJsZWQocHJvcCwgb2xkLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jaGVja1N0YXRlKCk7XG4gICAgfVxuXG4gICAgX2NoZWNrU3RhdGUoKSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQ7XG4gICAgICAgIGlmIChzdGF0ZSA9PT0gdGhpcy5fb2xkU3RhdGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fb2xkU3RhdGUgPSBzdGF0ZTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2VuYWJsZScpO1xuICAgICAgICB0aGlzLmZpcmUoJ3N0YXRlJywgdGhpcy5lbmFibGVkKTtcbiAgICB9XG5cbiAgICBfb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBab25lQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiWm9uZUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX29sZFN0YXRlIiwiX3NpemUiLCJWZWMzIiwib24iLCJfb25TZXRFbmFibGVkIiwic2l6ZSIsImRhdGEiLCJjb3B5IiwiQXJyYXkiLCJsZW5ndGgiLCJzZXQiLCJvbkVuYWJsZSIsIl9jaGVja1N0YXRlIiwib25EaXNhYmxlIiwicHJvcCIsIm9sZCIsInZhbHVlIiwic3RhdGUiLCJlbmFibGVkIiwiZmlyZSIsIl9vbkJlZm9yZVJlbW92ZSJdLCJtYXBwaW5ncyI6Ijs7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxhQUFhLFNBQVNDLFNBQVMsQ0FBQztBQUNsQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFO0FBQ3hCLElBQUEsS0FBSyxDQUFDRCxNQUFNLEVBQUVDLE1BQU0sQ0FBQyxDQUFBO0lBRXJCLElBQUksQ0FBQ0MsU0FBUyxHQUFHLElBQUksQ0FBQTtBQUNyQixJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0MsRUFBRSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUNDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNwRCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlDLElBQUlBLENBQUNDLElBQUksRUFBRTtJQUNYLElBQUlBLElBQUksWUFBWUosSUFBSSxFQUFFO0FBQ3RCLE1BQUEsSUFBSSxDQUFDRCxLQUFLLENBQUNNLElBQUksQ0FBQ0QsSUFBSSxDQUFDLENBQUE7S0FDeEIsTUFBTSxJQUFJQSxJQUFJLFlBQVlFLEtBQUssSUFBSUYsSUFBSSxDQUFDRyxNQUFNLElBQUksQ0FBQyxFQUFFO0FBQ2xELE1BQUEsSUFBSSxDQUFDSixJQUFJLENBQUNLLEdBQUcsQ0FBQ0osSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFQSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUVBLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzVDLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUQsSUFBSUEsR0FBRztJQUNQLE9BQU8sSUFBSSxDQUFDSixLQUFLLENBQUE7QUFDckIsR0FBQTtBQUVBVSxFQUFBQSxRQUFRQSxHQUFHO0lBQ1AsSUFBSSxDQUFDQyxXQUFXLEVBQUUsQ0FBQTtBQUN0QixHQUFBO0FBRUFDLEVBQUFBLFNBQVNBLEdBQUc7SUFDUixJQUFJLENBQUNELFdBQVcsRUFBRSxDQUFBO0FBQ3RCLEdBQUE7QUFFQVIsRUFBQUEsYUFBYUEsQ0FBQ1UsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLEtBQUssRUFBRTtJQUM1QixJQUFJLENBQUNKLFdBQVcsRUFBRSxDQUFBO0FBQ3RCLEdBQUE7QUFFQUEsRUFBQUEsV0FBV0EsR0FBRztJQUNWLE1BQU1LLEtBQUssR0FBRyxJQUFJLENBQUNDLE9BQU8sSUFBSSxJQUFJLENBQUNuQixNQUFNLENBQUNtQixPQUFPLENBQUE7QUFDakQsSUFBQSxJQUFJRCxLQUFLLEtBQUssSUFBSSxDQUFDakIsU0FBUyxFQUN4QixPQUFBO0lBRUosSUFBSSxDQUFDQSxTQUFTLEdBQUdpQixLQUFLLENBQUE7QUFFdEIsSUFBQSxJQUFJLENBQUNFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQTtJQUNuQixJQUFJLENBQUNBLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDRCxPQUFPLENBQUMsQ0FBQTtBQUNwQyxHQUFBO0FBRUFFLEVBQUFBLGVBQWVBLEdBQUc7QUFDZCxJQUFBLElBQUksQ0FBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ3ZCLEdBQUE7QUFDSjs7OzsifQ==
