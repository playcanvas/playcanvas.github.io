/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { IndexedList } from '../../../core/indexed-list.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ScreenComponent } from './component.js';
import { ScreenComponentData } from './data.js';

const _schema = ['enabled'];

class ScreenComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'screen';
    this.ComponentType = ScreenComponent;
    this.DataType = ScreenComponentData;
    this.schema = _schema;
    this.windowResolution = new Vec2();

    this._drawOrderSyncQueue = new IndexedList();
    this.app.graphicsDevice.on('resizecanvas', this._onResize, this);
    this.app.systems.on('update', this._onUpdate, this);
    this.on('beforeremove', this.onRemoveComponent, this);
  }
  initializeComponentData(component, data, properties) {
    if (data.priority !== undefined) component.priority = data.priority;
    if (data.screenSpace !== undefined) component.screenSpace = data.screenSpace;
    component.cull = component.screenSpace;
    if (data.scaleMode !== undefined) component.scaleMode = data.scaleMode;
    if (data.scaleBlend !== undefined) component.scaleBlend = data.scaleBlend;
    if (data.resolution !== undefined) {
      if (data.resolution instanceof Vec2) {
        component._resolution.copy(data.resolution);
      } else {
        component._resolution.set(data.resolution[0], data.resolution[1]);
      }
      component.resolution = component._resolution;
    }
    if (data.referenceResolution !== undefined) {
      if (data.referenceResolution instanceof Vec2) {
        component._referenceResolution.copy(data.referenceResolution);
      } else {
        component._referenceResolution.set(data.referenceResolution[0], data.referenceResolution[1]);
      }
      component.referenceResolution = component._referenceResolution;
    }

    component.syncDrawOrder();
    super.initializeComponentData(component, data, properties);
  }
  destroy() {
    super.destroy();
    this.app.graphicsDevice.off('resizecanvas', this._onResize, this);
    this.app.systems.off('update', this._onUpdate, this);
  }
  _onUpdate(dt) {
    const components = this.store;
    for (const id in components) {
      if (components[id].entity.screen.update) components[id].entity.screen.update(dt);
    }
  }
  _onResize(width, height) {
    this.windowResolution.x = width;
    this.windowResolution.y = height;
  }
  cloneComponent(entity, clone) {
    const screen = entity.screen;
    return this.addComponent(clone, {
      enabled: screen.enabled,
      screenSpace: screen.screenSpace,
      scaleMode: screen.scaleMode,
      resolution: screen.resolution.clone(),
      referenceResolution: screen.referenceResolution.clone()
    });
  }
  onRemoveComponent(entity, component) {
    component.onRemove();
  }
  processDrawOrderSyncQueue() {
    const list = this._drawOrderSyncQueue.list();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      item.callback.call(item.scope);
    }
    this._drawOrderSyncQueue.clear();
  }
  queueDrawOrderSync(id, fn, scope) {
    if (!this._drawOrderSyncQueue.list().length) {
      this.app.once('prerender', this.processDrawOrderSyncQueue, this);
    }
    if (!this._drawOrderSyncQueue.has(id)) {
      this._drawOrderSyncQueue.push(id, {
        callback: fn,
        scope: scope
      });
    }
  }
}
Component._buildAccessors(ScreenComponent.prototype, _schema);

export { ScreenComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyZWVuL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmRleGVkTGlzdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvaW5kZXhlZC1saXN0LmpzJztcblxuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IFNjcmVlbkNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFNjcmVlbkNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBBcHBCYXNlICovXG5cbmNvbnN0IF9zY2hlbWEgPSBbJ2VuYWJsZWQnXTtcblxuLyoqXG4gKiBNYW5hZ2VzIGNyZWF0aW9uIG9mIHtAbGluayBTY3JlZW5Db21wb25lbnR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKi9cbmNsYXNzIFNjcmVlbkNvbXBvbmVudFN5c3RlbSBleHRlbmRzIENvbXBvbmVudFN5c3RlbSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjcmVlbkNvbXBvbmVudFN5c3RlbSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ3NjcmVlbic7XG5cbiAgICAgICAgdGhpcy5Db21wb25lbnRUeXBlID0gU2NyZWVuQ29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gU2NyZWVuQ29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy53aW5kb3dSZXNvbHV0aW9uID0gbmV3IFZlYzIoKTtcblxuICAgICAgICAvLyBxdWV1ZSBvZiBjYWxsYmFja3NcbiAgICAgICAgdGhpcy5fZHJhd09yZGVyU3luY1F1ZXVlID0gbmV3IEluZGV4ZWRMaXN0KCk7XG5cbiAgICAgICAgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uub24oJ3Jlc2l6ZWNhbnZhcycsIHRoaXMuX29uUmVzaXplLCB0aGlzKTtcblxuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKCd1cGRhdGUnLCB0aGlzLl9vblVwZGF0ZSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vblJlbW92ZUNvbXBvbmVudCwgdGhpcyk7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmIChkYXRhLnByaW9yaXR5ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5wcmlvcml0eSA9IGRhdGEucHJpb3JpdHk7XG4gICAgICAgIGlmIChkYXRhLnNjcmVlblNwYWNlICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zY3JlZW5TcGFjZSA9IGRhdGEuc2NyZWVuU3BhY2U7XG4gICAgICAgIGNvbXBvbmVudC5jdWxsID0gY29tcG9uZW50LnNjcmVlblNwYWNlO1xuICAgICAgICBpZiAoZGF0YS5zY2FsZU1vZGUgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnNjYWxlTW9kZSA9IGRhdGEuc2NhbGVNb2RlO1xuICAgICAgICBpZiAoZGF0YS5zY2FsZUJsZW5kICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zY2FsZUJsZW5kID0gZGF0YS5zY2FsZUJsZW5kO1xuICAgICAgICBpZiAoZGF0YS5yZXNvbHV0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLnJlc29sdXRpb24gaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9yZXNvbHV0aW9uLmNvcHkoZGF0YS5yZXNvbHV0aW9uKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9yZXNvbHV0aW9uLnNldChkYXRhLnJlc29sdXRpb25bMF0sIGRhdGEucmVzb2x1dGlvblsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb21wb25lbnQucmVzb2x1dGlvbiA9IGNvbXBvbmVudC5fcmVzb2x1dGlvbjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5yZWZlcmVuY2VSZXNvbHV0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLnJlZmVyZW5jZVJlc29sdXRpb24gaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9yZWZlcmVuY2VSZXNvbHV0aW9uLmNvcHkoZGF0YS5yZWZlcmVuY2VSZXNvbHV0aW9uKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9yZWZlcmVuY2VSZXNvbHV0aW9uLnNldChkYXRhLnJlZmVyZW5jZVJlc29sdXRpb25bMF0sIGRhdGEucmVmZXJlbmNlUmVzb2x1dGlvblsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb21wb25lbnQucmVmZXJlbmNlUmVzb2x1dGlvbiA9IGNvbXBvbmVudC5fcmVmZXJlbmNlUmVzb2x1dGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHF1ZXVlIHVwIGEgZHJhdyBvcmRlciBzeW5jXG4gICAgICAgIGNvbXBvbmVudC5zeW5jRHJhd09yZGVyKCk7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLm9mZigncmVzaXplY2FudmFzJywgdGhpcy5fb25SZXNpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZigndXBkYXRlJywgdGhpcy5fb25VcGRhdGUsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblVwZGF0ZShkdCkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gdGhpcy5zdG9yZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnRzW2lkXS5lbnRpdHkuc2NyZWVuLnVwZGF0ZSkgY29tcG9uZW50c1tpZF0uZW50aXR5LnNjcmVlbi51cGRhdGUoZHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVzaXplKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy53aW5kb3dSZXNvbHV0aW9uLnggPSB3aWR0aDtcbiAgICAgICAgdGhpcy53aW5kb3dSZXNvbHV0aW9uLnkgPSBoZWlnaHQ7XG4gICAgfVxuXG4gICAgY2xvbmVDb21wb25lbnQoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICBjb25zdCBzY3JlZW4gPSBlbnRpdHkuc2NyZWVuO1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwge1xuICAgICAgICAgICAgZW5hYmxlZDogc2NyZWVuLmVuYWJsZWQsXG4gICAgICAgICAgICBzY3JlZW5TcGFjZTogc2NyZWVuLnNjcmVlblNwYWNlLFxuICAgICAgICAgICAgc2NhbGVNb2RlOiBzY3JlZW4uc2NhbGVNb2RlLFxuICAgICAgICAgICAgcmVzb2x1dGlvbjogc2NyZWVuLnJlc29sdXRpb24uY2xvbmUoKSxcbiAgICAgICAgICAgIHJlZmVyZW5jZVJlc29sdXRpb246IHNjcmVlbi5yZWZlcmVuY2VSZXNvbHV0aW9uLmNsb25lKClcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgb25SZW1vdmVDb21wb25lbnQoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29tcG9uZW50Lm9uUmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgcHJvY2Vzc0RyYXdPcmRlclN5bmNRdWV1ZSgpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMuX2RyYXdPcmRlclN5bmNRdWV1ZS5saXN0KCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gbGlzdFtpXTtcbiAgICAgICAgICAgIGl0ZW0uY2FsbGJhY2suY2FsbChpdGVtLnNjb3BlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kcmF3T3JkZXJTeW5jUXVldWUuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBxdWV1ZURyYXdPcmRlclN5bmMoaWQsIGZuLCBzY29wZSkge1xuICAgICAgICAvLyBmaXJzdCBxdWV1ZWQgc3luYyB0aGlzIGZyYW1lXG4gICAgICAgIC8vIGF0dGFjaCBhbiBldmVudCBsaXN0ZW5lclxuICAgICAgICBpZiAoIXRoaXMuX2RyYXdPcmRlclN5bmNRdWV1ZS5saXN0KCkubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmFwcC5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLnByb2Nlc3NEcmF3T3JkZXJTeW5jUXVldWUsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kcmF3T3JkZXJTeW5jUXVldWUuaGFzKGlkKSkge1xuICAgICAgICAgICAgdGhpcy5fZHJhd09yZGVyU3luY1F1ZXVlLnB1c2goaWQsIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogZm4sXG4gICAgICAgICAgICAgICAgc2NvcGU6IHNjb3BlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhTY3JlZW5Db21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgU2NyZWVuQ29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsiX3NjaGVtYSIsIlNjcmVlbkNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsImNvbnN0cnVjdG9yIiwiYXBwIiwiaWQiLCJDb21wb25lbnRUeXBlIiwiU2NyZWVuQ29tcG9uZW50IiwiRGF0YVR5cGUiLCJTY3JlZW5Db21wb25lbnREYXRhIiwic2NoZW1hIiwid2luZG93UmVzb2x1dGlvbiIsIlZlYzIiLCJfZHJhd09yZGVyU3luY1F1ZXVlIiwiSW5kZXhlZExpc3QiLCJncmFwaGljc0RldmljZSIsIm9uIiwiX29uUmVzaXplIiwic3lzdGVtcyIsIl9vblVwZGF0ZSIsIm9uUmVtb3ZlQ29tcG9uZW50IiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsInByaW9yaXR5IiwidW5kZWZpbmVkIiwic2NyZWVuU3BhY2UiLCJjdWxsIiwic2NhbGVNb2RlIiwic2NhbGVCbGVuZCIsInJlc29sdXRpb24iLCJfcmVzb2x1dGlvbiIsImNvcHkiLCJzZXQiLCJyZWZlcmVuY2VSZXNvbHV0aW9uIiwiX3JlZmVyZW5jZVJlc29sdXRpb24iLCJzeW5jRHJhd09yZGVyIiwiZGVzdHJveSIsIm9mZiIsImR0IiwiY29tcG9uZW50cyIsInN0b3JlIiwiZW50aXR5Iiwic2NyZWVuIiwidXBkYXRlIiwid2lkdGgiLCJoZWlnaHQiLCJ4IiwieSIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJhZGRDb21wb25lbnQiLCJlbmFibGVkIiwib25SZW1vdmUiLCJwcm9jZXNzRHJhd09yZGVyU3luY1F1ZXVlIiwibGlzdCIsImkiLCJsZW5ndGgiLCJpdGVtIiwiY2FsbGJhY2siLCJjYWxsIiwic2NvcGUiLCJjbGVhciIsInF1ZXVlRHJhd09yZGVyU3luYyIsImZuIiwib25jZSIsImhhcyIsInB1c2giLCJDb21wb25lbnQiLCJfYnVpbGRBY2Nlc3NvcnMiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQVlBLE1BQU1BLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFBOztBQU8zQixNQUFNQyxxQkFBcUIsU0FBU0MsZUFBZSxDQUFDO0VBT2hEQyxXQUFXLENBQUNDLEdBQUcsRUFBRTtJQUNiLEtBQUssQ0FBQ0EsR0FBRyxDQUFDLENBQUE7SUFFVixJQUFJLENBQUNDLEVBQUUsR0FBRyxRQUFRLENBQUE7SUFFbEIsSUFBSSxDQUFDQyxhQUFhLEdBQUdDLGVBQWUsQ0FBQTtJQUNwQyxJQUFJLENBQUNDLFFBQVEsR0FBR0MsbUJBQW1CLENBQUE7SUFFbkMsSUFBSSxDQUFDQyxNQUFNLEdBQUdWLE9BQU8sQ0FBQTtBQUVyQixJQUFBLElBQUksQ0FBQ1csZ0JBQWdCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7O0FBR2xDLElBQUEsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxJQUFJQyxXQUFXLEVBQUUsQ0FBQTtBQUU1QyxJQUFBLElBQUksQ0FBQ1YsR0FBRyxDQUFDVyxjQUFjLENBQUNDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFFaEUsSUFBQSxJQUFJLENBQUNiLEdBQUcsQ0FBQ2MsT0FBTyxDQUFDRixFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ0csU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFBO0lBRW5ELElBQUksQ0FBQ0gsRUFBRSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUNJLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3pELEdBQUE7QUFFQUMsRUFBQUEsdUJBQXVCLENBQUNDLFNBQVMsRUFBRUMsSUFBSSxFQUFFQyxVQUFVLEVBQUU7QUFDakQsSUFBQSxJQUFJRCxJQUFJLENBQUNFLFFBQVEsS0FB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