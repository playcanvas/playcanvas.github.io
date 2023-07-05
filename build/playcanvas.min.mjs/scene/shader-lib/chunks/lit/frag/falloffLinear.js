var t="\nfloat getFalloffLinear(float lightRadius, vec3 lightDir) {\n\t\tfloat d = length(lightDir);\n\t\treturn max(((lightRadius - d) / lightRadius), 0.0);\n}\n";export{t as default};
