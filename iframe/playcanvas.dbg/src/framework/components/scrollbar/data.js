import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';

class ScrollbarComponentData {
  constructor() {
    this.enabled = true;
    this.orientation = ORIENTATION_HORIZONTAL;
    this.value = 0;
    /** @type {number} */
    this.handleSize = void 0;
    /** @type {import('../../../framework/entity').Entity} */
    this.handleEntity = void 0;
  }
}

export { ScrollbarComponentData };
