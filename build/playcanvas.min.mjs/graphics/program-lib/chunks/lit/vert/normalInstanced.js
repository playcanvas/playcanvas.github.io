var n="\nvec3 getNormal() {\n    dNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);\n    return normalize(dNormalMatrix * vertex_normal);\n}\n";export{n as default};
