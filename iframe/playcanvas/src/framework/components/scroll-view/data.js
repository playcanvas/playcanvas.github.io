import { Vec2 } from '../../../core/math/vec2.js';

const DEFAULT_DRAG_THRESHOLD = 10;
class ScrollViewComponentData {
  constructor() {
    this.enabled = true;
    this.horizontal = void 0;
    this.vertical = void 0;
    this.scrollMode = void 0;
    this.bounceAmount = void 0;
    this.friction = void 0;
    this.dragThreshold = DEFAULT_DRAG_THRESHOLD;
    this.useMouseWheel = true;
    this.mouseWheelSensitivity = new Vec2(1, 1);
    this.horizontalScrollbarVisibility = void 0;
    this.verticalScrollbarVisibility = void 0;
    this.viewportEntity = void 0;
    this.contentEntity = void 0;
    this.horizontalScrollbarEntity = void 0;
    this.verticalScrollbarEntity = void 0;
  }
}

export { ScrollViewComponentData };
