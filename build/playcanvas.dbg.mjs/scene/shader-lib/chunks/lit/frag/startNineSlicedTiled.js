var startNineSlicedTiledPS = /* glsl */`
    vec2 tileMask = step(vMask, vec2(0.99999));
    vec2 tileSize = 0.5 * (innerOffset.xy + innerOffset.zw);
    vec2 tileScale = vec2(1.0) / (vec2(1.0) - tileSize);
    vec2 clampedUv = mix(innerOffset.xy * 0.5, vec2(1.0) - innerOffset.zw * 0.5, fract((vTiledUv - tileSize) * tileScale));
    clampedUv = clampedUv * atlasRect.zw + atlasRect.xy;
    nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2(1.0) - tileMask);
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;
    
`;

export { startNineSlicedTiledPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhcnROaW5lU2xpY2VkVGlsZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zdGFydE5pbmVTbGljZWRUaWxlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHZlYzIgdGlsZU1hc2sgPSBzdGVwKHZNYXNrLCB2ZWMyKDAuOTk5OTkpKTtcbiAgICB2ZWMyIHRpbGVTaXplID0gMC41ICogKGlubmVyT2Zmc2V0Lnh5ICsgaW5uZXJPZmZzZXQuencpO1xuICAgIHZlYzIgdGlsZVNjYWxlID0gdmVjMigxLjApIC8gKHZlYzIoMS4wKSAtIHRpbGVTaXplKTtcbiAgICB2ZWMyIGNsYW1wZWRVdiA9IG1peChpbm5lck9mZnNldC54eSAqIDAuNSwgdmVjMigxLjApIC0gaW5uZXJPZmZzZXQuencgKiAwLjUsIGZyYWN0KCh2VGlsZWRVdiAtIHRpbGVTaXplKSAqIHRpbGVTY2FsZSkpO1xuICAgIGNsYW1wZWRVdiA9IGNsYW1wZWRVdiAqIGF0bGFzUmVjdC56dyArIGF0bGFzUmVjdC54eTtcbiAgICBuaW5lU2xpY2VkVXYgPSB2VXYwICogdGlsZU1hc2sgKyBjbGFtcGVkVXYgKiAodmVjMigxLjApIC0gdGlsZU1hc2spO1xuICAgIG5pbmVTbGljZWRVdi55ID0gMS4wIC0gbmluZVNsaWNlZFV2Lnk7XG4gICAgXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDZCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
