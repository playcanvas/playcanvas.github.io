class StringIds {
  constructor() {
    this.map = new Map();
    this.id = 0;
  }
  get(name) {
    let value = this.map.get(name);
    if (value === undefined) {
      value = this.id++;
      this.map.set(name, value);
    }
    return value;
  }
}

export { StringIds };
