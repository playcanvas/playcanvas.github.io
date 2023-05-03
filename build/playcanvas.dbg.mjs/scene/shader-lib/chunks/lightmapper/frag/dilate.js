var dilatePS = /* glsl */`

varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

void main(void) {
    vec4 c = texture2D(source, vUv0);
    c = c.a>0.0? c : texture2D(source, vUv0 - pixelOffset);
    c = c.a>0.0? c : texture2D(source, vUv0 + vec2(0, -pixelOffset.y));
    c = c.a>0.0? c : texture2D(source, vUv0 + vec2(pixelOffset.x, -pixelOffset.y));
    c = c.a>0.0? c : texture2D(source, vUv0 + vec2(-pixelOffset.x, 0));
    c = c.a>0.0? c : texture2D(source, vUv0 + vec2(pixelOffset.x, 0));
    c = c.a>0.0? c : texture2D(source, vUv0 + vec2(-pixelOffset.x, pixelOffset.y));
    c = c.a>0.0? c : texture2D(source, vUv0 + vec2(0, pixelOffset.y));
    c = c.a>0.0? c : texture2D(source, vUv0 + pixelOffset);
    gl_FragColor = c;
}
`;

export { dilatePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlsYXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGlnaHRtYXBwZXIvZnJhZy9kaWxhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcblxudmFyeWluZyB2ZWMyIHZVdjA7XG5cbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcbnVuaWZvcm0gdmVjMiBwaXhlbE9mZnNldDtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICB2ZWM0IGMgPSB0ZXh0dXJlMkQoc291cmNlLCB2VXYwKTtcbiAgICBjID0gYy5hPjAuMD8gYyA6IHRleHR1cmUyRChzb3VyY2UsIHZVdjAgLSBwaXhlbE9mZnNldCk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkQoc291cmNlLCB2VXYwICsgdmVjMigwLCAtcGl4ZWxPZmZzZXQueSkpO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCArIHZlYzIocGl4ZWxPZmZzZXQueCwgLXBpeGVsT2Zmc2V0LnkpKTtcbiAgICBjID0gYy5hPjAuMD8gYyA6IHRleHR1cmUyRChzb3VyY2UsIHZVdjAgKyB2ZWMyKC1waXhlbE9mZnNldC54LCAwKSk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkQoc291cmNlLCB2VXYwICsgdmVjMihwaXhlbE9mZnNldC54LCAwKSk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkQoc291cmNlLCB2VXYwICsgdmVjMigtcGl4ZWxPZmZzZXQueCwgcGl4ZWxPZmZzZXQueSkpO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCArIHZlYzIoMCwgcGl4ZWxPZmZzZXQueSkpO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCArIHBpeGVsT2Zmc2V0KTtcbiAgICBnbF9GcmFnQ29sb3IgPSBjO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxlQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
