/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';

/**
 * A WebGPU helper class implementing a viewport clear operation. When rendering to a texture,
 * the whole surface can be cleared using loadOp, but if only a viewport needs to be cleared, or if
 * it needs to be cleared later during the rendering, this need to be archieved by rendering a quad.
 *
 * @ignore
 */
class WebgpuClearRenderer {
  clear(device, renderTarget, options) {
    // this needs to handle (by rendering a quad):
    // - clearing of a viewport
    // - clearing of full render target in the middle of the render pass
    Debug.logOnce("WebgpuGraphicsDevice.clear not implemented.");
  }
}

export { WebgpuClearRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWNsZWFyLXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ3B1L3dlYmdwdS1jbGVhci1yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlL2RlYnVnLmpzXCI7XG5cbi8qKlxuICogQSBXZWJHUFUgaGVscGVyIGNsYXNzIGltcGxlbWVudGluZyBhIHZpZXdwb3J0IGNsZWFyIG9wZXJhdGlvbi4gV2hlbiByZW5kZXJpbmcgdG8gYSB0ZXh0dXJlLFxuICogdGhlIHdob2xlIHN1cmZhY2UgY2FuIGJlIGNsZWFyZWQgdXNpbmcgbG9hZE9wLCBidXQgaWYgb25seSBhIHZpZXdwb3J0IG5lZWRzIHRvIGJlIGNsZWFyZWQsIG9yIGlmXG4gKiBpdCBuZWVkcyB0byBiZSBjbGVhcmVkIGxhdGVyIGR1cmluZyB0aGUgcmVuZGVyaW5nLCB0aGlzIG5lZWQgdG8gYmUgYXJjaGlldmVkIGJ5IHJlbmRlcmluZyBhIHF1YWQuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJncHVDbGVhclJlbmRlcmVyIHtcbiAgICBjbGVhcihkZXZpY2UsIHJlbmRlclRhcmdldCwgb3B0aW9ucykge1xuXG4gICAgICAgIC8vIHRoaXMgbmVlZHMgdG8gaGFuZGxlIChieSByZW5kZXJpbmcgYSBxdWFkKTpcbiAgICAgICAgLy8gLSBjbGVhcmluZyBvZiBhIHZpZXdwb3J0XG4gICAgICAgIC8vIC0gY2xlYXJpbmcgb2YgZnVsbCByZW5kZXIgdGFyZ2V0IGluIHRoZSBtaWRkbGUgb2YgdGhlIHJlbmRlciBwYXNzXG4gICAgICAgIERlYnVnLmxvZ09uY2UoXCJXZWJncHVHcmFwaGljc0RldmljZS5jbGVhciBub3QgaW1wbGVtZW50ZWQuXCIpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ3B1Q2xlYXJSZW5kZXJlciB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdUNsZWFyUmVuZGVyZXIiLCJjbGVhciIsImRldmljZSIsInJlbmRlclRhcmdldCIsIm9wdGlvbnMiLCJEZWJ1ZyIsImxvZ09uY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLG1CQUFtQixDQUFDO0FBQ3RCQyxFQUFBQSxLQUFLLENBQUNDLE1BQU0sRUFBRUMsWUFBWSxFQUFFQyxPQUFPLEVBQUU7QUFFakM7QUFDQTtBQUNBO0FBQ0FDLElBQUFBLEtBQUssQ0FBQ0MsT0FBTyxDQUFDLDZDQUE2QyxDQUFDLENBQUE7QUFDaEUsR0FBQTtBQUNKOzs7OyJ9
