var n="\nvec3 getNormal() {\n\t\tdNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);\n\t\treturn normalize(dNormalMatrix * vertex_normal);\n}\n";export{n as default};
