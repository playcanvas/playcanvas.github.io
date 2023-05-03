// Storage of data the LayerComposition needs to manage a light
class LightCompositionData {
  constructor() {
    // stored in a set for fast de-duplication
    this.shadowCastersSet = new Set();

    // stored in an array for fast iteration
    this.shadowCastersList = [];
  }
  clearShadowCasters() {
    this.shadowCastersSet.clear();
    this.shadowCastersList.length = 0;
  }
  addShadowCasters(casters) {
    // add unique casters to the set and the list
    for (let i = 0; i < casters.length; i++) {
      const item = casters[i];
      if (!this.shadowCastersSet.has(item)) {
        this.shadowCastersSet.add(item);
        this.shadowCastersList.push(item);
      }
    }
  }
}

export { LightCompositionData };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQtY29tcG9zaXRpb24tZGF0YS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2NvbXBvc2l0aW9uL2xpZ2h0LWNvbXBvc2l0aW9uLWRhdGEuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gU3RvcmFnZSBvZiBkYXRhIHRoZSBMYXllckNvbXBvc2l0aW9uIG5lZWRzIHRvIG1hbmFnZSBhIGxpZ2h0XG5jbGFzcyBMaWdodENvbXBvc2l0aW9uRGF0YSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG5cbiAgICAgICAgLy8gc3RvcmVkIGluIGEgc2V0IGZvciBmYXN0IGRlLWR1cGxpY2F0aW9uXG4gICAgICAgIHRoaXMuc2hhZG93Q2FzdGVyc1NldCA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvLyBzdG9yZWQgaW4gYW4gYXJyYXkgZm9yIGZhc3QgaXRlcmF0aW9uXG4gICAgICAgIHRoaXMuc2hhZG93Q2FzdGVyc0xpc3QgPSBbXTtcbiAgICB9XG5cbiAgICBjbGVhclNoYWRvd0Nhc3RlcnMoKSB7XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzdGVyc1NldC5jbGVhcigpO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc3RlcnNMaXN0Lmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgYWRkU2hhZG93Q2FzdGVycyhjYXN0ZXJzKSB7XG5cbiAgICAgICAgLy8gYWRkIHVuaXF1ZSBjYXN0ZXJzIHRvIHRoZSBzZXQgYW5kIHRoZSBsaXN0XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FzdGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgaXRlbSA9IGNhc3RlcnNbaV07XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hhZG93Q2FzdGVyc1NldC5oYXMoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd0Nhc3RlcnNTZXQuYWRkKGl0ZW0pO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzdGVyc0xpc3QucHVzaChpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHRDb21wb3NpdGlvbkRhdGEgfTtcbiJdLCJuYW1lcyI6WyJMaWdodENvbXBvc2l0aW9uRGF0YSIsImNvbnN0cnVjdG9yIiwic2hhZG93Q2FzdGVyc1NldCIsIlNldCIsInNoYWRvd0Nhc3RlcnNMaXN0IiwiY2xlYXJTaGFkb3dDYXN0ZXJzIiwiY2xlYXIiLCJsZW5ndGgiLCJhZGRTaGFkb3dDYXN0ZXJzIiwiY2FzdGVycyIsImkiLCJpdGVtIiwiaGFzIiwiYWRkIiwicHVzaCJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQSxNQUFNQSxvQkFBb0IsQ0FBQztBQUN2QkMsRUFBQUEsV0FBV0EsR0FBRztBQUVWO0FBQ0EsSUFBQSxJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQUVqQztJQUNBLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsRUFBRSxDQUFBO0FBQy9CLEdBQUE7QUFFQUMsRUFBQUEsa0JBQWtCQSxHQUFHO0FBQ2pCLElBQUEsSUFBSSxDQUFDSCxnQkFBZ0IsQ0FBQ0ksS0FBSyxFQUFFLENBQUE7QUFDN0IsSUFBQSxJQUFJLENBQUNGLGlCQUFpQixDQUFDRyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ3JDLEdBQUE7RUFFQUMsZ0JBQWdCQSxDQUFDQyxPQUFPLEVBQUU7QUFFdEI7QUFDQSxJQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxPQUFPLENBQUNGLE1BQU0sRUFBRUcsQ0FBQyxFQUFFLEVBQUU7QUFDckMsTUFBQSxNQUFNQyxJQUFJLEdBQUdGLE9BQU8sQ0FBQ0MsQ0FBQyxDQUFDLENBQUE7TUFDdkIsSUFBSSxDQUFDLElBQUksQ0FBQ1IsZ0JBQWdCLENBQUNVLEdBQUcsQ0FBQ0QsSUFBSSxDQUFDLEVBQUU7QUFDbEMsUUFBQSxJQUFJLENBQUNULGdCQUFnQixDQUFDVyxHQUFHLENBQUNGLElBQUksQ0FBQyxDQUFBO0FBQy9CLFFBQUEsSUFBSSxDQUFDUCxpQkFBaUIsQ0FBQ1UsSUFBSSxDQUFDSCxJQUFJLENBQUMsQ0FBQTtBQUNyQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFDSjs7OzsifQ==
