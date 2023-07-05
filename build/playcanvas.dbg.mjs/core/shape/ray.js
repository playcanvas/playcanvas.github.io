import { Vec3 } from '../math/vec3.js';

/**
 * An infinite ray.
 */
class Ray {
  /**
   * Creates a new Ray instance. The ray is infinite, starting at a given origin and pointing in
   * a given direction.
   *
   * @param {Vec3} [origin] - The starting point of the ray. The constructor copies
   * this parameter. Defaults to the origin (0, 0, 0).
   * @param {Vec3} [direction] - The direction of the ray. The constructor copies
   * this parameter. Defaults to a direction down the world negative Z axis (0, 0, -1).
   * @example
   * // Create a new ray starting at the position of this entity and pointing down
   * // the entity's negative Z axis
   * const ray = new pc.Ray(this.entity.getPosition(), this.entity.forward);
   */
  constructor(origin, direction) {
    /**
     * The starting point of the ray.
     *
     * @readonly
     * @type {Vec3}
     */
    this.origin = new Vec3();
    /**
     * The direction of the ray.
     *
     * @readonly
     * @type {Vec3}
     */
    this.direction = Vec3.FORWARD.clone();
    if (origin) {
      this.origin.copy(origin);
    }
    if (direction) {
      this.direction.copy(direction);
    }
  }

  /**
   * Sets origin and direction to the supplied vector values.
   *
   * @param {Vec3} origin - The starting point of the ray.
   * @param {Vec3} direction - The direction of the ray.
   * @returns {Ray} Self for chaining.
   */
  set(origin, direction) {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }

  /**
   * Copies the contents of a source Ray.
   *
   * @param {Ray} src - The Ray to copy from.
   * @returns {Ray} Self for chaining.
   */
  copy(src) {
    return this.set(src.origin, src.direction);
  }

  /**
   * Returns a clone of the Ray.
   *
   * @returns {this} A duplicate Ray.
   */
  clone() {
    return new this.constructor(this.origin, this.direction);
  }
}

export { Ray };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmF5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY29yZS9zaGFwZS9yYXkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL21hdGgvdmVjMy5qcyc7XG5cbi8qKlxuICogQW4gaW5maW5pdGUgcmF5LlxuICovXG5jbGFzcyBSYXkge1xuICAgIC8qKlxuICAgICAqIFRoZSBzdGFydGluZyBwb2ludCBvZiB0aGUgcmF5LlxuICAgICAqXG4gICAgICogQHJlYWRvbmx5XG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgb3JpZ2luID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXJlY3Rpb24gb2YgdGhlIHJheS5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGRpcmVjdGlvbiA9IFZlYzMuRk9SV0FSRC5jbG9uZSgpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBSYXkgaW5zdGFuY2UuIFRoZSByYXkgaXMgaW5maW5pdGUsIHN0YXJ0aW5nIGF0IGEgZ2l2ZW4gb3JpZ2luIGFuZCBwb2ludGluZyBpblxuICAgICAqIGEgZ2l2ZW4gZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbb3JpZ2luXSAtIFRoZSBzdGFydGluZyBwb2ludCBvZiB0aGUgcmF5LiBUaGUgY29uc3RydWN0b3IgY29waWVzXG4gICAgICogdGhpcyBwYXJhbWV0ZXIuIERlZmF1bHRzIHRvIHRoZSBvcmlnaW4gKDAsIDAsIDApLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2RpcmVjdGlvbl0gLSBUaGUgZGlyZWN0aW9uIG9mIHRoZSByYXkuIFRoZSBjb25zdHJ1Y3RvciBjb3BpZXNcbiAgICAgKiB0aGlzIHBhcmFtZXRlci4gRGVmYXVsdHMgdG8gYSBkaXJlY3Rpb24gZG93biB0aGUgd29ybGQgbmVnYXRpdmUgWiBheGlzICgwLCAwLCAtMSkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBuZXcgcmF5IHN0YXJ0aW5nIGF0IHRoZSBwb3NpdGlvbiBvZiB0aGlzIGVudGl0eSBhbmQgcG9pbnRpbmcgZG93blxuICAgICAqIC8vIHRoZSBlbnRpdHkncyBuZWdhdGl2ZSBaIGF4aXNcbiAgICAgKiBjb25zdCByYXkgPSBuZXcgcGMuUmF5KHRoaXMuZW50aXR5LmdldFBvc2l0aW9uKCksIHRoaXMuZW50aXR5LmZvcndhcmQpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9yaWdpbiwgZGlyZWN0aW9uKSB7XG4gICAgICAgIGlmIChvcmlnaW4pIHtcbiAgICAgICAgICAgIHRoaXMub3JpZ2luLmNvcHkob3JpZ2luKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlyZWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmRpcmVjdGlvbi5jb3B5KGRpcmVjdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIG9yaWdpbiBhbmQgZGlyZWN0aW9uIHRvIHRoZSBzdXBwbGllZCB2ZWN0b3IgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBvcmlnaW4gLSBUaGUgc3RhcnRpbmcgcG9pbnQgb2YgdGhlIHJheS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGRpcmVjdGlvbiAtIFRoZSBkaXJlY3Rpb24gb2YgdGhlIHJheS5cbiAgICAgKiBAcmV0dXJucyB7UmF5fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBzZXQob3JpZ2luLCBkaXJlY3Rpb24pIHtcbiAgICAgICAgdGhpcy5vcmlnaW4uY29weShvcmlnaW4pO1xuICAgICAgICB0aGlzLmRpcmVjdGlvbi5jb3B5KGRpcmVjdGlvbik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgUmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSYXl9IHNyYyAtIFRoZSBSYXkgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtSYXl9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIGNvcHkoc3JjKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldChzcmMub3JpZ2luLCBzcmMuZGlyZWN0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgY2xvbmUgb2YgdGhlIFJheS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIGR1cGxpY2F0ZSBSYXkuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLm9yaWdpbiwgdGhpcy5kaXJlY3Rpb24pO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmF5IH07XG4iXSwibmFtZXMiOlsiUmF5IiwiY29uc3RydWN0b3IiLCJvcmlnaW4iLCJkaXJlY3Rpb24iLCJWZWMzIiwiRk9SV0FSRCIsImNsb25lIiwiY29weSIsInNldCIsInNyYyJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxHQUFHLENBQUM7QUFpQk47QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxTQUFTLEVBQUU7QUE3Qi9CO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BRCxNQUFNLEdBQUcsSUFBSUUsSUFBSSxFQUFFLENBQUE7QUFFbkI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUQsQ0FBQUEsU0FBUyxHQUFHQyxJQUFJLENBQUNDLE9BQU8sQ0FBQ0MsS0FBSyxFQUFFLENBQUE7QUFnQjVCLElBQUEsSUFBSUosTUFBTSxFQUFFO0FBQ1IsTUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ0ssSUFBSSxDQUFDTCxNQUFNLENBQUMsQ0FBQTtBQUM1QixLQUFBO0FBQ0EsSUFBQSxJQUFJQyxTQUFTLEVBQUU7QUFDWCxNQUFBLElBQUksQ0FBQ0EsU0FBUyxDQUFDSSxJQUFJLENBQUNKLFNBQVMsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lLLEVBQUFBLEdBQUdBLENBQUNOLE1BQU0sRUFBRUMsU0FBUyxFQUFFO0FBQ25CLElBQUEsSUFBSSxDQUFDRCxNQUFNLENBQUNLLElBQUksQ0FBQ0wsTUFBTSxDQUFDLENBQUE7QUFDeEIsSUFBQSxJQUFJLENBQUNDLFNBQVMsQ0FBQ0ksSUFBSSxDQUFDSixTQUFTLENBQUMsQ0FBQTtBQUM5QixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUksSUFBSUEsQ0FBQ0UsR0FBRyxFQUFFO0lBQ04sT0FBTyxJQUFJLENBQUNELEdBQUcsQ0FBQ0MsR0FBRyxDQUFDUCxNQUFNLEVBQUVPLEdBQUcsQ0FBQ04sU0FBUyxDQUFDLENBQUE7QUFDOUMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lHLEVBQUFBLEtBQUtBLEdBQUc7QUFDSixJQUFBLE9BQU8sSUFBSSxJQUFJLENBQUNMLFdBQVcsQ0FBQyxJQUFJLENBQUNDLE1BQU0sRUFBRSxJQUFJLENBQUNDLFNBQVMsQ0FBQyxDQUFBO0FBQzVELEdBQUE7QUFDSjs7OzsifQ==
