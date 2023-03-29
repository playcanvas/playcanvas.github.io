/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { LayoutGroupComponent } from './component.js';
import { LayoutGroupComponentData } from './data.js';

const _schema = ['enabled'];
const MAX_ITERATIONS = 100;

/**
 * Manages creation of {@link LayoutGroupComponent}s.
 *
 * @augments ComponentSystem
 */
class LayoutGroupComponentSystem extends ComponentSystem {
  /**
   * Create a new LayoutGroupComponentSystem instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The application.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    this.id = 'layoutgroup';
    this.ComponentType = LayoutGroupComponent;
    this.DataType = LayoutGroupComponentData;
    this.schema = _schema;
    this._reflowQueue = [];
    this.on('beforeremove', this._onRemoveComponent, this);

    // Perform reflow when running in the engine
    this.app.systems.on('postUpdate', this._onPostUpdate, this);
  }
  initializeComponentData(component, data, properties) {
    if (data.enabled !== undefined) component.enabled = data.enabled;
    if (data.orientation !== undefined) component.orientation = data.orientation;
    if (data.reverseX !== undefined) component.reverseX = data.reverseX;
    if (data.reverseY !== undefined) component.reverseY = data.reverseY;
    if (data.alignment !== undefined) {
      component.alignment = Array.isArray(data.alignment) ? new Vec2(data.alignment) : data.alignment;
    }
    if (data.padding !== undefined) {
      component.padding = Array.isArray(data.padding) ? new Vec4(data.padding) : data.padding;
    }
    if (data.spacing !== undefined) {
      component.spacing = Array.isArray(data.spacing) ? new Vec2(data.spacing) : data.spacing;
    }
    if (data.widthFitting !== undefined) component.widthFitting = data.widthFitting;
    if (data.heightFitting !== undefined) component.heightFitting = data.heightFitting;
    if (data.wrap !== undefined) component.wrap = data.wrap;
    super.initializeComponentData(component, data, properties);
  }
  cloneComponent(entity, clone) {
    const layoutGroup = entity.layoutgroup;
    return this.addComponent(clone, {
      enabled: layoutGroup.enabled,
      orientation: layoutGroup.orientation,
      reverseX: layoutGroup.reverseX,
      reverseY: layoutGroup.reverseY,
      alignment: layoutGroup.alignment,
      padding: layoutGroup.padding,
      spacing: layoutGroup.spacing,
      widthFitting: layoutGroup.widthFitting,
      heightFitting: layoutGroup.heightFitting,
      wrap: layoutGroup.wrap
    });
  }
  scheduleReflow(component) {
    if (this._reflowQueue.indexOf(component) === -1) {
      this._reflowQueue.push(component);
    }
  }
  _onPostUpdate() {
    this._processReflowQueue();
  }
  _processReflowQueue() {
    if (this._reflowQueue.length === 0) {
      return;
    }
    let iterationCount = 0;
    while (this._reflowQueue.length > 0) {
      // Create a copy of the queue to sort and process. If processing the reflow of any
      // layout groups results in additional groups being pushed to the queue, they will
      // be processed on the next iteration of the while loop.
      const queue = this._reflowQueue.slice();
      this._reflowQueue.length = 0;

      // Sort in ascending order of depth within the graph (i.e. outermost first), so that
      // any layout groups which are children of other layout groups will always have their
      // new size set before their own reflow is calculated.
      queue.sort(function (componentA, componentB) {
        return componentA.entity.graphDepth - componentB.entity.graphDepth;
      });
      for (let i = 0; i < queue.length; ++i) {
        queue[i].reflow();
      }
      if (++iterationCount >= MAX_ITERATIONS) {
        console.warn('Max reflow iterations limit reached, bailing.');
        break;
      }
    }
  }
  _onRemoveComponent(entity, component) {
    component.onRemove();
  }
  destroy() {
    super.destroy();
    this.app.systems.off('postUpdate', this._onPostUpdate, this);
  }
}
Component._buildAccessors(LayoutGroupComponent.prototype, _schema);

export { LayoutGroupComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbGF5b3V0LWdyb3VwL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IExheW91dEdyb3VwQ29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgTGF5b3V0R3JvdXBDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuY29uc3QgX3NjaGVtYSA9IFsnZW5hYmxlZCddO1xuXG5jb25zdCBNQVhfSVRFUkFUSU9OUyA9IDEwMDtcblxuLyoqXG4gKiBNYW5hZ2VzIGNyZWF0aW9uIG9mIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH1zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgTGF5b3V0R3JvdXBDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBMYXlvdXRHcm91cENvbXBvbmVudFN5c3RlbSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdsYXlvdXRncm91cCc7XG5cbiAgICAgICAgdGhpcy5Db21wb25lbnRUeXBlID0gTGF5b3V0R3JvdXBDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBMYXlvdXRHcm91cENvbXBvbmVudERhdGE7XG5cbiAgICAgICAgdGhpcy5zY2hlbWEgPSBfc2NoZW1hO1xuXG4gICAgICAgIHRoaXMuX3JlZmxvd1F1ZXVlID0gW107XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5fb25SZW1vdmVDb21wb25lbnQsIHRoaXMpO1xuXG4gICAgICAgIC8vIFBlcmZvcm0gcmVmbG93IHdoZW4gcnVubmluZyBpbiB0aGUgZW5naW5lXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub24oJ3Bvc3RVcGRhdGUnLCB0aGlzLl9vblBvc3RVcGRhdGUsIHRoaXMpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBpZiAoZGF0YS5lbmFibGVkICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5lbmFibGVkID0gZGF0YS5lbmFibGVkO1xuICAgICAgICBpZiAoZGF0YS5vcmllbnRhdGlvbiAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQub3JpZW50YXRpb24gPSBkYXRhLm9yaWVudGF0aW9uO1xuICAgICAgICBpZiAoZGF0YS5yZXZlcnNlWCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQucmV2ZXJzZVggPSBkYXRhLnJldmVyc2VYO1xuICAgICAgICBpZiAoZGF0YS5yZXZlcnNlWSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQucmV2ZXJzZVkgPSBkYXRhLnJldmVyc2VZO1xuICAgICAgICBpZiAoZGF0YS5hbGlnbm1lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50LmFsaWdubWVudCA9IEFycmF5LmlzQXJyYXkoZGF0YS5hbGlnbm1lbnQpID8gbmV3IFZlYzIoZGF0YS5hbGlnbm1lbnQpIDogZGF0YS5hbGlnbm1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEucGFkZGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQucGFkZGluZyA9IEFycmF5LmlzQXJyYXkoZGF0YS5wYWRkaW5nKSA/IG5ldyBWZWM0KGRhdGEucGFkZGluZykgOiBkYXRhLnBhZGRpbmc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEuc3BhY2luZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuc3BhY2luZyA9IEFycmF5LmlzQXJyYXkoZGF0YS5zcGFjaW5nKSA/IG5ldyBWZWMyKGRhdGEuc3BhY2luZykgOiBkYXRhLnNwYWNpbmc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEud2lkdGhGaXR0aW5nICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC53aWR0aEZpdHRpbmcgPSBkYXRhLndpZHRoRml0dGluZztcbiAgICAgICAgaWYgKGRhdGEuaGVpZ2h0Rml0dGluZyAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuaGVpZ2h0Rml0dGluZyA9IGRhdGEuaGVpZ2h0Rml0dGluZztcbiAgICAgICAgaWYgKGRhdGEud3JhcCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQud3JhcCA9IGRhdGEud3JhcDtcblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgY29uc3QgbGF5b3V0R3JvdXAgPSBlbnRpdHkubGF5b3V0Z3JvdXA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50KGNsb25lLCB7XG4gICAgICAgICAgICBlbmFibGVkOiBsYXlvdXRHcm91cC5lbmFibGVkLFxuICAgICAgICAgICAgb3JpZW50YXRpb246IGxheW91dEdyb3VwLm9yaWVudGF0aW9uLFxuICAgICAgICAgICAgcmV2ZXJzZVg6IGxheW91dEdyb3VwLnJldmVyc2VYLFxuICAgICAgICAgICAgcmV2ZXJzZVk6IGxheW91dEdyb3VwLnJldmVyc2VZLFxuICAgICAgICAgICAgYWxpZ25tZW50OiBsYXlvdXRHcm91cC5hbGlnbm1lbnQsXG4gICAgICAgICAgICBwYWRkaW5nOiBsYXlvdXRHcm91cC5wYWRkaW5nLFxuICAgICAgICAgICAgc3BhY2luZzogbGF5b3V0R3JvdXAuc3BhY2luZyxcbiAgICAgICAgICAgIHdpZHRoRml0dGluZzogbGF5b3V0R3JvdXAud2lkdGhGaXR0aW5nLFxuICAgICAgICAgICAgaGVpZ2h0Rml0dGluZzogbGF5b3V0R3JvdXAuaGVpZ2h0Rml0dGluZyxcbiAgICAgICAgICAgIHdyYXA6IGxheW91dEdyb3VwLndyYXBcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2NoZWR1bGVSZWZsb3coY29tcG9uZW50KSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWZsb3dRdWV1ZS5pbmRleE9mKGNvbXBvbmVudCkgPT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLl9yZWZsb3dRdWV1ZS5wdXNoKGNvbXBvbmVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25Qb3N0VXBkYXRlKCkge1xuICAgICAgICB0aGlzLl9wcm9jZXNzUmVmbG93UXVldWUoKTtcbiAgICB9XG5cbiAgICBfcHJvY2Vzc1JlZmxvd1F1ZXVlKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVmbG93UXVldWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaXRlcmF0aW9uQ291bnQgPSAwO1xuXG4gICAgICAgIHdoaWxlICh0aGlzLl9yZWZsb3dRdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBjb3B5IG9mIHRoZSBxdWV1ZSB0byBzb3J0IGFuZCBwcm9jZXNzLiBJZiBwcm9jZXNzaW5nIHRoZSByZWZsb3cgb2YgYW55XG4gICAgICAgICAgICAvLyBsYXlvdXQgZ3JvdXBzIHJlc3VsdHMgaW4gYWRkaXRpb25hbCBncm91cHMgYmVpbmcgcHVzaGVkIHRvIHRoZSBxdWV1ZSwgdGhleSB3aWxsXG4gICAgICAgICAgICAvLyBiZSBwcm9jZXNzZWQgb24gdGhlIG5leHQgaXRlcmF0aW9uIG9mIHRoZSB3aGlsZSBsb29wLlxuICAgICAgICAgICAgY29uc3QgcXVldWUgPSB0aGlzLl9yZWZsb3dRdWV1ZS5zbGljZSgpO1xuICAgICAgICAgICAgdGhpcy5fcmVmbG93UXVldWUubGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgLy8gU29ydCBpbiBhc2NlbmRpbmcgb3JkZXIgb2YgZGVwdGggd2l0aGluIHRoZSBncmFwaCAoaS5lLiBvdXRlcm1vc3QgZmlyc3QpLCBzbyB0aGF0XG4gICAgICAgICAgICAvLyBhbnkgbGF5b3V0IGdyb3VwcyB3aGljaCBhcmUgY2hpbGRyZW4gb2Ygb3RoZXIgbGF5b3V0IGdyb3VwcyB3aWxsIGFsd2F5cyBoYXZlIHRoZWlyXG4gICAgICAgICAgICAvLyBuZXcgc2l6ZSBzZXQgYmVmb3JlIHRoZWlyIG93biByZWZsb3cgaXMgY2FsY3VsYXRlZC5cbiAgICAgICAgICAgIHF1ZXVlLnNvcnQoZnVuY3Rpb24gKGNvbXBvbmVudEEsIGNvbXBvbmVudEIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGNvbXBvbmVudEEuZW50aXR5LmdyYXBoRGVwdGggLSBjb21wb25lbnRCLmVudGl0eS5ncmFwaERlcHRoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgcXVldWVbaV0ucmVmbG93KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgrK2l0ZXJhdGlvbkNvdW50ID49IE1BWF9JVEVSQVRJT05TKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdNYXggcmVmbG93IGl0ZXJhdGlvbnMgbGltaXQgcmVhY2hlZCwgYmFpbGluZy4nKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbW92ZUNvbXBvbmVudChlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQub25SZW1vdmUoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3Bvc3RVcGRhdGUnLCB0aGlzLl9vblBvc3RVcGRhdGUsIHRoaXMpO1xuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhMYXlvdXRHcm91cENvbXBvbmVudC5wcm90b3R5cGUsIF9zY2hlbWEpO1xuXG5leHBvcnQgeyBMYXlvdXRHcm91cENvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIl9zY2hlbWEiLCJNQVhfSVRFUkFUSU9OUyIsIkxheW91dEdyb3VwQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiY29uc3RydWN0b3IiLCJhcHAiLCJpZCIsIkNvbXBvbmVudFR5cGUiLCJMYXlvdXRHcm91cENvbXBvbmVudCIsIkRhdGFUeXBlIiwiTGF5b3V0R3JvdXBDb21wb25lbnREYXRhIiwic2NoZW1hIiwiX3JlZmxvd1F1ZXVlIiwib24iLCJfb25SZW1vdmVDb21wb25lbnQiLCJzeXN0ZW1zIiwiX29uUG9zdFVwZGF0ZSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJlbmFibGVkIiwidW5kZWZpbmVkIiwib3JpZW50YXRpb24iLCJyZXZlcnNlWCIsInJldmVyc2VZIiwiYWxpZ25tZW50IiwiQXJyYXkiLCJpc0FycmF5IiwiVmVjMiIsInBhZGRpbmciLCJWZWM0Iiwic3BhY2luZyIsIndpZHRoRml0dGluZyIsImhlaWdodEZpdHRpbmciLCJ3cmFwIiwiY2xvbmVDb21wb25lbnQiLCJlbnRpdHkiLCJjbG9uZSIsImxheW91dEdyb3VwIiwibGF5b3V0Z3JvdXAiLCJhZGRDb21wb25lbnQiLCJzY2hlZHVsZVJlZmxvdyIsImluZGV4T2YiLCJwdXNoIiwiX3Byb2Nlc3NSZWZsb3dRdWV1ZSIsImxlbmd0aCIsIml0ZXJhdGlvbkNvdW50IiwicXVldWUiLCJzbGljZSIsInNvcnQiLCJjb21wb25lbnRBIiwiY29tcG9uZW50QiIsImdyYXBoRGVwdGgiLCJpIiwicmVmbG93IiwiY29uc29sZSIsIndhcm4iLCJvblJlbW92ZSIsImRlc3Ryb3kiLCJvZmYiLCJDb21wb25lbnQiLCJfYnVpbGRBY2Nlc3NvcnMiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQVNBLE1BQU1BLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFBO0FBRTNCLE1BQU1DLGNBQWMsR0FBRyxHQUFHLENBQUE7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQywwQkFBMEIsU0FBU0MsZUFBZSxDQUFDO0FBQ3JEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXLENBQUNDLEdBQUcsRUFBRTtJQUNiLEtBQUssQ0FBQ0EsR0FBRyxDQUFDLENBQUE7SUFFVixJQUFJLENBQUNDLEVBQUUsR0FBRyxhQUFhLENBQUE7SUFFdkIsSUFBSSxDQUFDQyxhQUFhLEdBQUdDLG9CQUFvQixDQUFBO0lBQ3pDLElBQUksQ0FBQ0MsUUFBUSxHQUFHQyx3QkFBd0IsQ0FBQTtJQUV4QyxJQUFJLENBQUNDLE1BQU0sR0FBR1gsT0FBTyxDQUFBO0lBRXJCLElBQUksQ0FBQ1ksWUFBWSxHQUFHLEVBQUUsQ0FBQTtJQUV0QixJQUFJLENBQUNDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQTs7QUFFdEQ7QUFDQSxJQUFBLElBQUksQ0FBQ1QsR0FBRyxDQUFD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
