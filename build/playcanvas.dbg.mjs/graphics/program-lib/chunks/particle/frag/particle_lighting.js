/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_lightingPS = `
    vec3 light = negNormal.x*lightCube[0] + posNormal.x*lightCube[1] +
                        negNormal.y*lightCube[2] + posNormal.y*lightCube[3] +
                        negNormal.z*lightCube[4] + posNormal.z*lightCube[5];

    rgb *= light;
`;

export { particle_lightingPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbGlnaHRpbmcuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZV9saWdodGluZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHZlYzMgbGlnaHQgPSBuZWdOb3JtYWwueCpsaWdodEN1YmVbMF0gKyBwb3NOb3JtYWwueCpsaWdodEN1YmVbMV0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgbmVnTm9ybWFsLnkqbGlnaHRDdWJlWzJdICsgcG9zTm9ybWFsLnkqbGlnaHRDdWJlWzNdICtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5lZ05vcm1hbC56KmxpZ2h0Q3ViZVs0XSArIHBvc05vcm1hbC56KmxpZ2h0Q3ViZVs1XTtcblxuICAgIHJnYiAqPSBsaWdodDtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwwQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FOQTs7OzsifQ==
