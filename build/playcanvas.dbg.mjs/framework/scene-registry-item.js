/**
 * Item to be stored in the {@link SceneRegistry}.
 */
class SceneRegistryItem {
  /**
   * Creates a new SceneRegistryItem instance.
   *
   * @param {string} name - The name of the scene.
   * @param {string} url - The url of the scene file.
   */
  constructor(name, url) {
    /**
     * The name of the scene.
     *
     * @type {string}
     */
    this.name = name;
    /**
     * The url of the scene file.
     *
     * @type {string}
     */
    this.url = url;
    this.data = null;
    this._loading = false;
    this._onLoadedCallbacks = [];
  }

  /**
   * Returns true if the scene data has loaded.
   *
   * @type {boolean}
   */
  get loaded() {
    return !!this.data;
  }

  /**
   * Returns true if the scene data is still being loaded.
   *
   * @type {boolean}
   */
  get loading() {
    return this._loading;
  }
}

export { SceneRegistryItem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtcmVnaXN0cnktaXRlbS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9zY2VuZS1yZWdpc3RyeS1pdGVtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSXRlbSB0byBiZSBzdG9yZWQgaW4gdGhlIHtAbGluayBTY2VuZVJlZ2lzdHJ5fS5cbiAqL1xuY2xhc3MgU2NlbmVSZWdpc3RyeUl0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgU2NlbmVSZWdpc3RyeUl0ZW0gaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIHVybCBvZiB0aGUgc2NlbmUgZmlsZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lLCB1cmwpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdXJsIG9mIHRoZSBzY2VuZSBmaWxlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51cmwgPSB1cmw7XG4gICAgICAgIHRoaXMuZGF0YSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2xvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fb25Mb2FkZWRDYWxsYmFja3MgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNjZW5lIGRhdGEgaGFzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBsb2FkZWQoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuZGF0YTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNjZW5lIGRhdGEgaXMgc3RpbGwgYmVpbmcgbG9hZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGxvYWRpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2FkaW5nO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NlbmVSZWdpc3RyeUl0ZW0gfTtcbiJdLCJuYW1lcyI6WyJTY2VuZVJlZ2lzdHJ5SXRlbSIsImNvbnN0cnVjdG9yIiwibmFtZSIsInVybCIsImRhdGEiLCJfbG9hZGluZyIsIl9vbkxvYWRlZENhbGxiYWNrcyIsImxvYWRlZCIsImxvYWRpbmciXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGlCQUFpQixDQUFDO0FBQ3BCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxJQUFJLEVBQUVDLEdBQUcsRUFBRTtBQUNuQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDRCxJQUFJLEdBQUdBLElBQUksQ0FBQTtBQUNoQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxHQUFHLEdBQUdBLEdBQUcsQ0FBQTtJQUNkLElBQUksQ0FBQ0MsSUFBSSxHQUFHLElBQUksQ0FBQTtJQUNoQixJQUFJLENBQUNDLFFBQVEsR0FBRyxLQUFLLENBQUE7SUFDckIsSUFBSSxDQUFDQyxrQkFBa0IsR0FBRyxFQUFFLENBQUE7QUFDaEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsTUFBTUEsR0FBRztBQUNULElBQUEsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDSCxJQUFJLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUksT0FBT0EsR0FBRztJQUNWLE9BQU8sSUFBSSxDQUFDSCxRQUFRLENBQUE7QUFDeEIsR0FBQTtBQUNKOzs7OyJ9
