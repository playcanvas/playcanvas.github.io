var _Vec;
class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = void 0;
    this.y = void 0;
    this.z = void 0;
    if (x.length === 3) {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2];
    } else {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  add(rhs) {
    this.x += rhs.x;
    this.y += rhs.y;
    this.z += rhs.z;
    return this;
  }
  add2(lhs, rhs) {
    this.x = lhs.x + rhs.x;
    this.y = lhs.y + rhs.y;
    this.z = lhs.z + rhs.z;
    return this;
  }
  addScalar(scalar) {
    this.x += scalar;
    this.y += scalar;
    this.z += scalar;
    return this;
  }
  addScaled(rhs, scalar) {
    this.x += rhs.x * scalar;
    this.y += rhs.y * scalar;
    this.z += rhs.z * scalar;
    return this;
  }
  clone() {
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z);
  }
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    return this;
  }
  cross(lhs, rhs) {
    const lx = lhs.x;
    const ly = lhs.y;
    const lz = lhs.z;
    const rx = rhs.x;
    const ry = rhs.y;
    const rz = rhs.z;
    this.x = ly * rz - ry * lz;
    this.y = lz * rx - rz * lx;
    this.z = lx * ry - rx * ly;
    return this;
  }
  distance(rhs) {
    const x = this.x - rhs.x;
    const y = this.y - rhs.y;
    const z = this.z - rhs.z;
    return Math.sqrt(x * x + y * y + z * z);
  }
  div(rhs) {
    this.x /= rhs.x;
    this.y /= rhs.y;
    this.z /= rhs.z;
    return this;
  }
  div2(lhs, rhs) {
    this.x = lhs.x / rhs.x;
    this.y = lhs.y / rhs.y;
    this.z = lhs.z / rhs.z;
    return this;
  }
  divScalar(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    return this;
  }
  dot(rhs) {
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
  }
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
  }
  equalsApprox(rhs, epsilon = 1e-6) {
    return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  lerp(lhs, rhs, alpha) {
    this.x = lhs.x + alpha * (rhs.x - lhs.x);
    this.y = lhs.y + alpha * (rhs.y - lhs.y);
    this.z = lhs.z + alpha * (rhs.z - lhs.z);
    return this;
  }
  mul(rhs) {
    this.x *= rhs.x;
    this.y *= rhs.y;
    this.z *= rhs.z;
    return this;
  }
  mul2(lhs, rhs) {
    this.x = lhs.x * rhs.x;
    this.y = lhs.y * rhs.y;
    this.z = lhs.z * rhs.z;
    return this;
  }
  mulScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  normalize(src = this) {
    const lengthSq = src.x * src.x + src.y * src.y + src.z * src.z;
    if (lengthSq > 0) {
      const invLength = 1 / Math.sqrt(lengthSq);
      this.x = src.x * invLength;
      this.y = src.y * invLength;
      this.z = src.z * invLength;
    }
    return this;
  }
  floor(src = this) {
    this.x = Math.floor(src.x);
    this.y = Math.floor(src.y);
    this.z = Math.floor(src.z);
    return this;
  }
  ceil(src = this) {
    this.x = Math.ceil(src.x);
    this.y = Math.ceil(src.y);
    this.z = Math.ceil(src.z);
    return this;
  }
  round(src = this) {
    this.x = Math.round(src.x);
    this.y = Math.round(src.y);
    this.z = Math.round(src.z);
    return this;
  }
  min(rhs) {
    if (rhs.x < this.x) this.x = rhs.x;
    if (rhs.y < this.y) this.y = rhs.y;
    if (rhs.z < this.z) this.z = rhs.z;
    return this;
  }
  max(rhs) {
    if (rhs.x > this.x) this.x = rhs.x;
    if (rhs.y > this.y) this.y = rhs.y;
    if (rhs.z > this.z) this.z = rhs.z;
    return this;
  }
  project(rhs) {
    const a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
    const b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
    const s = a_dot_b / b_dot_b;
    this.x = rhs.x * s;
    this.y = rhs.y * s;
    this.z = rhs.z * s;
    return this;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  sub(rhs) {
    this.x -= rhs.x;
    this.y -= rhs.y;
    this.z -= rhs.z;
    return this;
  }
  sub2(lhs, rhs) {
    this.x = lhs.x - rhs.x;
    this.y = lhs.y - rhs.y;
    this.z = lhs.z - rhs.z;
    return this;
  }
  subScalar(scalar) {
    this.x -= scalar;
    this.y -= scalar;
    this.z -= scalar;
    return this;
  }
  toString() {
    return `[${this.x}, ${this.y}, ${this.z}]`;
  }
}
_Vec = Vec3;
Vec3.ZERO = Object.freeze(new _Vec(0, 0, 0));
Vec3.ONE = Object.freeze(new _Vec(1, 1, 1));
Vec3.UP = Object.freeze(new _Vec(0, 1, 0));
Vec3.DOWN = Object.freeze(new _Vec(0, -1, 0));
Vec3.RIGHT = Object.freeze(new _Vec(1, 0, 0));
Vec3.LEFT = Object.freeze(new _Vec(-1, 0, 0));
Vec3.FORWARD = Object.freeze(new _Vec(0, 0, -1));
Vec3.BACK = Object.freeze(new _Vec(0, 0, 1));

export { Vec3 };
