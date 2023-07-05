var n="\n#ifndef VIEWMATRIX\n#define VIEWMATRIX\nuniform mat4 matrix_view;\n#endif\n\nvec3 getViewNormal() {\n\t\treturn mat3(matrix_view) * vNormalW;\n}\n";export{n as default};
