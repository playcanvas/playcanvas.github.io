/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var webgpuVS = `
#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)

#define GL2
#define VERTEXSHADER
`;

export { webgpuVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLWNodW5rcy92ZXJ0L3dlYmdwdS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2RlZmluZSB0ZXh0dXJlMkQocmVzLCB1dikgdGV4dHVyZShzYW1wbGVyMkQocmVzLCByZXMgIyMgX3NhbXBsZXIpLCB1dilcblxuI2RlZmluZSBHTDJcbiNkZWZpbmUgVkVSVEVYU0hBREVSXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
