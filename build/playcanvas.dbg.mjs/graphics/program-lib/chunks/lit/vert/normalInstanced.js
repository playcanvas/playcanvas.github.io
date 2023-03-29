/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalInstancedVS = `
vec3 getNormal() {
    dNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);
    return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalInstancedVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsSW5zdGFuY2VkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC92ZXJ0L25vcm1hbEluc3RhbmNlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBnZXROb3JtYWwoKSB7XG4gICAgZE5vcm1hbE1hdHJpeCA9IG1hdDMoaW5zdGFuY2VfbGluZTEueHl6LCBpbnN0YW5jZV9saW5lMi54eXosIGluc3RhbmNlX2xpbmUzLnh5eik7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZShkTm9ybWFsTWF0cml4ICogdmVydGV4X25vcm1hbCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUxBOzs7OyJ9
