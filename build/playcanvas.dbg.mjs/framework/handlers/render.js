/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Render } from '../../scene/render.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

// The scope of this function is the render asset
function onContainerAssetLoaded(containerAsset) {
  const renderAsset = this;
  if (!renderAsset.resource) return;
  const containerResource = containerAsset.resource;
  const render = containerResource.renders && containerResource.renders[renderAsset.data.renderIndex];
  if (render) {
    renderAsset.resource.meshes = render.resource.meshes;
  }
}

// The scope of this function is the render asset
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

/**
 * Resource handler used for loading {@link Render} resources.
 *
 * @implements {ResourceHandler}
 */
class RenderHandler {
  /**
   * Type of the resource the handler handles.
   *
   * @type {string}
   */

  /**
   * Create a new RenderHandler instance.
   *
   * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL3JlbmRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9oYW5kbGVyLmpzJykuUmVzb3VyY2VIYW5kbGVyfSBSZXNvdXJjZUhhbmRsZXIgKi9cblxuLy8gVGhlIHNjb3BlIG9mIHRoaXMgZnVuY3Rpb24gaXMgdGhlIHJlbmRlciBhc3NldFxuZnVuY3Rpb24gb25Db250YWluZXJBc3NldExvYWRlZChjb250YWluZXJBc3NldCkge1xuICAgIGNvbnN0IHJlbmRlckFzc2V0ID0gdGhpcztcbiAgICBpZiAoIXJlbmRlckFzc2V0LnJlc291cmNlKSByZXR1cm47XG5cbiAgICBjb25zdCBjb250YWluZXJSZXNvdXJjZSA9IGNvbnRhaW5lckFzc2V0LnJlc291cmNlO1xuXG4gICAgY29uc3QgcmVuZGVyID0gY29udGFpbmVyUmVzb3VyY2UucmVuZGVycyAmJiBjb250YWluZXJSZXNvdXJjZS5yZW5kZXJzW3JlbmRlckFzc2V0LmRhdGEucmVuZGVySW5kZXhdO1xuICAgIGlmIChyZW5kZXIpIHtcbiAgICAgICAgcmVuZGVyQXNzZXQucmVzb3VyY2UubWVzaGVzID0gcmVuZGVyLnJlc291cmNlLm1lc2hlcztcbiAgICB9XG59XG5cbi8vIFRoZSBzY29wZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIHRoZSByZW5kZXIgYXNzZXRcbmZ1bmN0aW9uIG9uQ29udGFpbmVyQXNzZXRBZGRlZChjb250YWluZXJBc3NldCkge1xuICAgIGNvbnN0IHJlbmRlckFzc2V0ID0gdGhpcztcblxuICAgIHJlbmRlckFzc2V0LnJlZ2lzdHJ5Lm9mZignbG9hZDonICsgY29udGFpbmVyQXNzZXQuaWQsIG9uQ29udGFpbmVyQXNzZXRMb2FkZWQsIHJlbmRlckFzc2V0KTtcbiAgICByZW5kZXJBc3NldC5yZWdpc3RyeS5vbignbG9hZDonICsgY29udGFpbmVyQXNzZXQuaWQsIG9uQ29udGFpbmVyQXNzZXRMb2FkZWQsIHJlbmRlckFzc2V0KTtcbiAgICByZW5kZXJBc3NldC5yZWdpc3RyeS5vZmYoJ3JlbW92ZTonICsgY29udGFpbmVyQXNzZXQuaWQsIG9uQ29udGFpbmVyQXNzZXRSZW1vdmVkLCByZW5kZXJBc3NldCk7XG4gICAgcmVuZGVyQXNzZXQucmVnaXN0cnkub25jZSgncmVtb3ZlOicgKyBjb250YWluZXJBc3NldC5pZCwgb25Db250YWluZXJBc3NldFJlbW92ZWQsIHJlbmRlckFzc2V0KTtcblxuICAgIGlmICghY29udGFpbmVyQXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgcmVuZGVyQXNzZXQucmVnaXN0cnkubG9hZChjb250YWluZXJBc3NldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb25Db250YWluZXJBc3NldExvYWRlZC5jYWxsKHJlbmRlckFzc2V0LCBjb250YWluZXJBc3NldCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBvbkNvbnRhaW5lckFzc2V0UmVtb3ZlZChjb250YWluZXJBc3NldCkge1xuICAgIGNvbnN0IHJlbmRlckFzc2V0ID0gdGhpcztcblxuICAgIHJlbmRlckFzc2V0LnJlZ2lzdHJ5Lm9mZignbG9hZDonICsgY29udGFpbmVyQXNzZXQuaWQsIG9uQ29udGFpbmVyQXNzZXRMb2FkZWQsIHJlbmRlckFzc2V0KTtcblxuICAgIGlmIChyZW5kZXJBc3NldC5yZXNvdXJjZSkge1xuICAgICAgICByZW5kZXJBc3NldC5yZXNvdXJjZS5kZXN0cm95KCk7XG4gICAgfVxufVxuXG4vKipcbiAqIFJlc291cmNlIGhhbmRsZXIgdXNlZCBmb3IgbG9hZGluZyB7QGxpbmsgUmVuZGVyfSByZXNvdXJjZXMuXG4gKlxuICogQGltcGxlbWVudHMge1Jlc291cmNlSGFuZGxlcn1cbiAqL1xuY2xhc3MgUmVuZGVySGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVHlwZSBvZiB0aGUgcmVzb3VyY2UgdGhlIGhhbmRsZXIgaGFuZGxlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgaGFuZGxlclR5cGUgPSBcInJlbmRlclwiO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJlbmRlckhhbmRsZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICB0aGlzLl9yZWdpc3RyeSA9IGFwcC5hc3NldHM7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVuZGVyKCk7XG4gICAgfVxuXG4gICAgcGF0Y2goYXNzZXQsIHJlZ2lzdHJ5KSB7XG4gICAgICAgIGlmICghYXNzZXQuZGF0YS5jb250YWluZXJBc3NldClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBjb250YWluZXJBc3NldCA9IHJlZ2lzdHJ5LmdldChhc3NldC5kYXRhLmNvbnRhaW5lckFzc2V0KTtcbiAgICAgICAgaWYgKCFjb250YWluZXJBc3NldCkge1xuICAgICAgICAgICAgcmVnaXN0cnkub25jZSgnYWRkOicgKyBhc3NldC5kYXRhLmNvbnRhaW5lckFzc2V0LCBvbkNvbnRhaW5lckFzc2V0QWRkZWQsIGFzc2V0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIG9uQ29udGFpbmVyQXNzZXRBZGRlZC5jYWxsKGFzc2V0LCBjb250YWluZXJBc3NldCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZW5kZXJIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsib25Db250YWluZXJBc3NldExvYWRlZCIsImNvbnRhaW5lckFzc2V0IiwicmVuZGVyQXNzZXQiLCJyZXNvdXJjZSIsImNvbnRhaW5lclJlc291cmNlIiwicmVuZGVyIiwicmVuZGVycyIsImRhdGEiLCJyZW5kZXJJbmRleCIsIm1lc2hlcyIsIm9uQ29udGFpbmVyQXNzZXRBZGRlZCIsInJlZ2lzdHJ5Iiwib2ZmIiwiaWQiLCJvbiIsIm9uQ29udGFpbmVyQXNzZXRSZW1vdmVkIiwib25jZSIsImxvYWQiLCJjYWxsIiwiZGVzdHJveSIsIlJlbmRlckhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsImhhbmRsZXJUeXBlIiwiX3JlZ2lzdHJ5IiwiYXNzZXRzIiwidXJsIiwiY2FsbGJhY2siLCJhc3NldCIsIm9wZW4iLCJSZW5kZXIiLCJwYXRjaCIsImdldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBOztBQUVBO0FBQ0EsU0FBU0Esc0JBQXNCLENBQUNDLGNBQWMsRUFBRTtFQUM1QyxNQUFNQyxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQ3hCLEVBQUEsSUFBSSxDQUFDQSxXQUFXLENBQUNDLFFBQVEsRUFBRSxPQUFBO0FBRTNCLEVBQUEsTUFBTUMsaUJBQWlCLEdBQUdILGNBQWMsQ0FBQ0UsUUFBUSxDQUFBO0FBRWpELEVBQUEsTUFBTUUsTUFBTSxHQUFHRCxpQkFBaUIsQ0FBQ0UsT0FBTyxJQUFJRixpQkFBaUIsQ0FBQ0UsT0FBTyxDQUFDSixXQUFXLENBQUNLLElBQUksQ0FBQ0MsV0FBVyxDQUFDLENBQUE7QUFDbkcsRUFBQSxJQUFJSCxNQUFNLEVBQUU7SUFDUkgsV0FBVyxDQUFDQyxRQUFRLENBQUNNLE1BQU0sR0FBR0osTUFBTSxDQUFDRixRQUFRLENBQUNNLE1BQU0sQ0FBQTtBQUN4RCxHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBLFNBQVNDLHFCQUFxQixDQUFDVCxjQUFjLEVBQUU7RUFDM0MsTUFBTUMsV0FBVyxHQUFHLElBQUksQ0FBQTtBQUV4QkEsRUFBQUEsV0FB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
