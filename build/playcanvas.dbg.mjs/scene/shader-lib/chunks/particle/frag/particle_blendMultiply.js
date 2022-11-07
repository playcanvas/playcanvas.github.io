/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendMultiplyPS = `
    rgb = mix(vec3(1.0), rgb, vec3(a));
    if (rgb.r + rgb.g + rgb.b > 2.99) discard;
`;

export { particle_blendMultiplyPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfYmxlbmRNdWx0aXBseS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVfYmxlbmRNdWx0aXBseS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHJnYiA9IG1peCh2ZWMzKDEuMCksIHJnYiwgdmVjMyhhKSk7XG4gICAgaWYgKHJnYi5yICsgcmdiLmcgKyByZ2IuYiA+IDIuOTkpIGRpc2NhcmQ7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsK0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBQUM7Ozs7In0=
