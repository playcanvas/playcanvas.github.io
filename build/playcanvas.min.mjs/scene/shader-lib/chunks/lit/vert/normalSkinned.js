var r="\nvec3 getNormal() {\n\t\tdNormalMatrix = mat3(dModelMatrix[0].xyz, dModelMatrix[1].xyz, dModelMatrix[2].xyz);\n\t\treturn normalize(dNormalMatrix * vertex_normal);\n}\n";export{r as default};
