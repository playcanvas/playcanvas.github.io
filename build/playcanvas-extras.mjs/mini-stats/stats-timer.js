/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
