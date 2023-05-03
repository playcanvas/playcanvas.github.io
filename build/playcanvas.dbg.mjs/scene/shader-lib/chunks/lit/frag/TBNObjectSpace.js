var TBNObjectSpacePS = /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {

    vec3 B = cross(normal, vObjectSpaceUpW);
    vec3 T = cross(normal, B);

    if (dot(B,B)==0.0) // deal with case when vObjectSpaceUpW normal are parallel
    {
        float major=max(max(normal.x, normal.y), normal.z);

        if (normal.x == major)
        {
            B=cross(normal, vec3(0,1,0));
            T=cross(normal, B);
        }
        else if (normal.y == major)
        {
            B=cross(normal, vec3(0,0,1));
            T=cross(normal, B);
        }
        else if (normal.z == major)
        {
            B=cross(normal, vec3(1,0,0));
            T=cross(normal, B);
        }
    }

    dTBN = mat3(normalize(T), normalize(B), normalize(normal));
}
`;

export { TBNObjectSpacePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOT2JqZWN0U3BhY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9UQk5PYmplY3RTcGFjZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBnZXRUQk4odmVjMyB0YW5nZW50LCB2ZWMzIGJpbm9ybWFsLCB2ZWMzIG5vcm1hbCkge1xuXG4gICAgdmVjMyBCID0gY3Jvc3Mobm9ybWFsLCB2T2JqZWN0U3BhY2VVcFcpO1xuICAgIHZlYzMgVCA9IGNyb3NzKG5vcm1hbCwgQik7XG5cbiAgICBpZiAoZG90KEIsQik9PTAuMCkgLy8gZGVhbCB3aXRoIGNhc2Ugd2hlbiB2T2JqZWN0U3BhY2VVcFcgbm9ybWFsIGFyZSBwYXJhbGxlbFxuICAgIHtcbiAgICAgICAgZmxvYXQgbWFqb3I9bWF4KG1heChub3JtYWwueCwgbm9ybWFsLnkpLCBub3JtYWwueik7XG5cbiAgICAgICAgaWYgKG5vcm1hbC54ID09IG1ham9yKVxuICAgICAgICB7XG4gICAgICAgICAgICBCPWNyb3NzKG5vcm1hbCwgdmVjMygwLDEsMCkpO1xuICAgICAgICAgICAgVD1jcm9zcyhub3JtYWwsIEIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG5vcm1hbC55ID09IG1ham9yKVxuICAgICAgICB7XG4gICAgICAgICAgICBCPWNyb3NzKG5vcm1hbCwgdmVjMygwLDAsMSkpO1xuICAgICAgICAgICAgVD1jcm9zcyhub3JtYWwsIEIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG5vcm1hbC56ID09IG1ham9yKVxuICAgICAgICB7XG4gICAgICAgICAgICBCPWNyb3NzKG5vcm1hbCwgdmVjMygxLDAsMCkpO1xuICAgICAgICAgICAgVD1jcm9zcyhub3JtYWwsIEIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZFRCTiA9IG1hdDMobm9ybWFsaXplKFQpLCBub3JtYWxpemUoQiksIG5vcm1hbGl6ZShub3JtYWwpKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsdUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
