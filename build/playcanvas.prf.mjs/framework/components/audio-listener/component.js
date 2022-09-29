/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Component } from '../component.js';

class AudioListenerComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
  }

  setCurrentListener() {
    if (this.enabled && this.entity.audiolistener && this.entity.enabled) {
      this.system.current = this.entity;
      const position = this.system.current.getPosition();
      this.system.manager.listener.setPosition(position);
    }
  }

  onEnable() {
    this.setCurrentListener();
  }

  onDisable() {
    if (this.system.current === this.entity) {
      this.system.current = null;
    }
  }

}

export { AudioListenerComponent };
