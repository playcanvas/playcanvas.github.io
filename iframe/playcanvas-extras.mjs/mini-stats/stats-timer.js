/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 29eb79929
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
class StatsTimer {
  constructor(app, statNames, decimalPlaces, unitsName, multiplier) {
    this.app = app;
    this.values = [];
    this.statNames = statNames;
    if (this.statNames.length > 3) this.statNames.length = 3;
    this.unitsName = unitsName;
    this.decimalPlaces = decimalPlaces;
    this.multiplier = multiplier || 1;
    const resolve = (path, obj) => {
      return path.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : null;
      }, obj || this);
    };
    app.on('frameupdate', ms => {
      for (let i = 0; i < this.statNames.length; i++) {
        this.values[i] = resolve(this.statNames[i], this.app.stats) * this.multiplier;
      }
    });
  }
  get timings() {
    return this.values;
  }
}

export { StatsTimer };
