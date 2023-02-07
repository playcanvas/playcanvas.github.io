/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var TBNObjectSpacePS = /* glsl */`
void getTBN() {

    vec3 B = cross(dVertexNormalW, vObjectSpaceUpW);
    vec3 T = cross(dVertexNormalW, B);

    if (dot(B,B)==0.0) // deal with case when vObjectSpaceUpW dVertexNormalW are parallel
    {
        float major=max(max(dVertexNormalW.x, dVertexNormalW.y),dVertexNormalW.z);

        if (dVertexNormalW.x==major)
        {
            B=cross(dVertexNormalW, vec3(0,1,0));
            T=cross(dVertexNormalW, B);
        }
        else if (dVertexNormalW.y==major)
        {
            B=cross(dVertexNormalW, vec3(0,0,1));
            T=cross(dVertexNormalW, B);
        }
        else if (dVertexNormalW.z==major)
        {
            B=cross(dVertexNormalW, vec3(1,0,0));
            T=cross(dVertexNormalW, B);
        }
    }

    dTBN = mat3(normalize(T), normalize(B), normalize(dVertexNormalW));
}
`;

export { TBNObjectSpacePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOT2JqZWN0U3BhY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9UQk5PYmplY3RTcGFjZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBnZXRUQk4oKSB7XG5cbiAgICB2ZWMzIEIgPSBjcm9zcyhkVmVydGV4Tm9ybWFsVywgdk9iamVjdFNwYWNlVXBXKTtcbiAgICB2ZWMzIFQgPSBjcm9zcyhkVmVydGV4Tm9ybWFsVywgQik7XG5cbiAgICBpZiAoZG90KEIsQik9PTAuMCkgLy8gZGVhbCB3aXRoIGNhc2Ugd2hlbiB2T2JqZWN0U3BhY2VVcFcgZFZlcnRleE5vcm1hbFcgYXJlIHBhcmFsbGVsXG4gICAge1xuICAgICAgICBmbG9hdCBtYWpvcj1tYXgobWF4KGRWZXJ0ZXhOb3JtYWxXLngsIGRWZXJ0ZXhOb3JtYWxXLnkpLGRWZXJ0ZXhOb3JtYWxXLnopO1xuXG4gICAgICAgIGlmIChkVmVydGV4Tm9ybWFsVy54PT1tYWpvcilcbiAgICAgICAge1xuICAgICAgICAgICAgQj1jcm9zcyhkVmVydGV4Tm9ybWFsVywgdmVjMygwLDEsMCkpO1xuICAgICAgICAgICAgVD1jcm9zcyhkVmVydGV4Tm9ybWFsVywgQik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZFZlcnRleE5vcm1hbFcueT09bWFqb3IpXG4gICAgICAgIHtcbiAgICAgICAgICAgIEI9Y3Jvc3MoZFZlcnRleE5vcm1hbFcsIHZlYzMoMCwwLDEpKTtcbiAgICAgICAgICAgIFQ9Y3Jvc3MoZFZlcnRleE5vcm1hbFcsIEIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGRWZXJ0ZXhOb3JtYWxXLno9PW1ham9yKVxuICAgICAgICB7XG4gICAgICAgICAgICBCPWNyb3NzKGRWZXJ0ZXhOb3JtYWxXLCB2ZWMzKDEsMCwwKSk7XG4gICAgICAgICAgICBUPWNyb3NzKGRWZXJ0ZXhOb3JtYWxXLCBCKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRUQk4gPSBtYXQzKG5vcm1hbGl6ZShUKSwgbm9ybWFsaXplKEIpLCBub3JtYWxpemUoZFZlcnRleE5vcm1hbFcpKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
