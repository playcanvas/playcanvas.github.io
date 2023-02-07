/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
