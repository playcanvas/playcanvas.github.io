/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var dilatePS = `
#define SHADER_NAME Dilate

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlsYXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpZ2h0bWFwcGVyL2ZyYWcvZGlsYXRlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jZGVmaW5lIFNIQURFUl9OQU1FIERpbGF0ZVxuXG52YXJ5aW5nIHZlYzIgdlV2MDtcblxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudW5pZm9ybSB2ZWMyIHBpeGVsT2Zmc2V0O1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIHZlYzQgYyA9IHRleHR1cmUyRChzb3VyY2UsIHZVdjApO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCAtIHBpeGVsT2Zmc2V0KTtcbiAgICBjID0gYy5hPjAuMD8gYyA6IHRleHR1cmUyRChzb3VyY2UsIHZVdjAgKyB2ZWMyKDAsIC1waXhlbE9mZnNldC55KSk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkQoc291cmNlLCB2VXYwICsgdmVjMihwaXhlbE9mZnNldC54LCAtcGl4ZWxPZmZzZXQueSkpO1xuICAgIGMgPSBjLmE+MC4wPyBjIDogdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCArIHZlYzIoLXBpeGVsT2Zmc2V0LngsIDApKTtcbiAgICBjID0gYy5hPjAuMD8gYyA6IHRleHR1cmUyRChzb3VyY2UsIHZVdjAgKyB2ZWMyKHBpeGVsT2Zmc2V0LngsIDApKTtcbiAgICBjID0gYy5hPjAuMD8gYyA6IHRleHR1cmUyRChzb3VyY2UsIHZVdjAgKyB2ZWMyKC1waXhlbE9mZnNldC54LCBwaXhlbE9mZnNldC55KSk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkQoc291cmNlLCB2VXYwICsgdmVjMigwLCBwaXhlbE9mZnNldC55KSk7XG4gICAgYyA9IGMuYT4wLjA/IGMgOiB0ZXh0dXJlMkQoc291cmNlLCB2VXYwICsgcGl4ZWxPZmZzZXQpO1xuICAgIGdsX0ZyYWdDb2xvciA9IGM7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBcEJBOzs7OyJ9
