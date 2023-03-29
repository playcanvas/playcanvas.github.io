/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var TBNObjectSpacePS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOT2JqZWN0U3BhY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvVEJOT2JqZWN0U3BhY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgZ2V0VEJOKCkge1xuXG4gICAgdmVjMyBCID0gY3Jvc3MoZFZlcnRleE5vcm1hbFcsIHZPYmplY3RTcGFjZVVwVyk7XG4gICAgdmVjMyBUID0gY3Jvc3MoZFZlcnRleE5vcm1hbFcsIEIpO1xuXG4gICAgaWYgKGRvdChCLEIpPT0wLjApIC8vIGRlYWwgd2l0aCBjYXNlIHdoZW4gdk9iamVjdFNwYWNlVXBXIGRWZXJ0ZXhOb3JtYWxXIGFyZSBwYXJhbGxlbFxuICAgIHtcbiAgICAgICAgZmxvYXQgbWFqb3I9bWF4KG1heChkVmVydGV4Tm9ybWFsVy54LCBkVmVydGV4Tm9ybWFsVy55KSxkVmVydGV4Tm9ybWFsVy56KTtcblxuICAgICAgICBpZiAoZFZlcnRleE5vcm1hbFcueD09bWFqb3IpXG4gICAgICAgIHtcbiAgICAgICAgICAgIEI9Y3Jvc3MoZFZlcnRleE5vcm1hbFcsIHZlYzMoMCwxLDApKTtcbiAgICAgICAgICAgIFQ9Y3Jvc3MoZFZlcnRleE5vcm1hbFcsIEIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGRWZXJ0ZXhOb3JtYWxXLnk9PW1ham9yKVxuICAgICAgICB7XG4gICAgICAgICAgICBCPWNyb3NzKGRWZXJ0ZXhOb3JtYWxXLCB2ZWMzKDAsMCwxKSk7XG4gICAgICAgICAgICBUPWNyb3NzKGRWZXJ0ZXhOb3JtYWxXLCBCKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChkVmVydGV4Tm9ybWFsVy56PT1tYWpvcilcbiAgICAgICAge1xuICAgICAgICAgICAgQj1jcm9zcyhkVmVydGV4Tm9ybWFsVywgdmVjMygxLDAsMCkpO1xuICAgICAgICAgICAgVD1jcm9zcyhkVmVydGV4Tm9ybWFsVywgQik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkVEJOID0gbWF0Myhub3JtYWxpemUoVCksIG5vcm1hbGl6ZShCKSwgbm9ybWFsaXplKGRWZXJ0ZXhOb3JtYWxXKSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQTdCQTs7OzsifQ==
