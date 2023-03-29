/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_TBNVS = /* glsl */`
    mat3 rot3 = mat3(rotMatrix[0][0], rotMatrix[0][1], 0.0, rotMatrix[1][0], rotMatrix[1][1], 0.0, 0.0, 0.0, 1.0);
    ParticleMat = mat3(-matrix_viewInverse[0].xyz, -matrix_viewInverse[1].xyz, matrix_viewInverse[2].xyz) * rot3;
`;

export { particle_TBNVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfVEJOLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvdmVydC9wYXJ0aWNsZV9UQk4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBtYXQzIHJvdDMgPSBtYXQzKHJvdE1hdHJpeFswXVswXSwgcm90TWF0cml4WzBdWzFdLCAwLjAsIHJvdE1hdHJpeFsxXVswXSwgcm90TWF0cml4WzFdWzFdLCAwLjAsIDAuMCwgMC4wLCAxLjApO1xuICAgIFBhcnRpY2xlTWF0ID0gbWF0MygtbWF0cml4X3ZpZXdJbnZlcnNlWzBdLnh5eiwgLW1hdHJpeF92aWV3SW52ZXJzZVsxXS54eXosIG1hdHJpeF92aWV3SW52ZXJzZVsyXS54eXopICogcm90MztcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBQUM7Ozs7In0=
