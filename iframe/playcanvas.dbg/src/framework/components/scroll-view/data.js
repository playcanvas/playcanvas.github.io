import { Vec2 } from '../../../core/math/vec2.js';

const DEFAULT_DRAG_THRESHOLD = 10;
class ScrollViewComponentData {
  constructor() {
    this.enabled = true;
    /** @type {boolean} */
    this.horizontal = void 0;
    /** @type {boolean} */
    this.vertical = void 0;
    /** @type {number} */
    this.scrollMode = void 0;
    /** @type {number} */
    this.bounceAmount = void 0;
    /** @type {number} */
    this.friction = void 0;
    this.dragThreshold = DEFAULT_DRAG_THRESHOLD;
    this.useMouseWheel = true;
    this.mouseWheelSensitivity = new Vec2(1, 1);
    /** @type {number} */
    this.horizontalScrollbarVisibility = void 0;
    /** @type {number} */
    this.verticalScrollbarVisibility = void 0;
    /** @type {import('../../../framework/entity.js').Entity} */
    this.viewportEntity = void 0;
    /** @type {import('../../../framework/entity.js').Entity} */
    this.contentEntity = void 0;
    /** @type {import('../../../framework/entity.js').Entity} */
    this.horizontalScrollbarEntity = void 0;
    /** @type {import('../../../framework/entity.js').Entity} */
    this.verticalScrollbarEntity = void 0;
  }
}

export { ScrollViewComponentData };
