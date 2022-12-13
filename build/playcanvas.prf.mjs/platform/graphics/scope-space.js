/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { ScopeId } from './scope-id.js';

class ScopeSpace {
  constructor(name) {
    this.name = name;

    this.variables = new Map();
  }

  resolve(name) {
    if (!this.variables.has(name)) {
      this.variables.set(name, new ScopeId(name));
    }

    return this.variables.get(name);
  }

  removeValue(value) {
    for (const uniformName in this.variables) {
      const uniform = this.variables[uniformName];
      if (uniform.value === value) {
        uniform.value = null;
      }
    }
  }
}

export { ScopeSpace };
