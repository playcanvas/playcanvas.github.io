var t="\nfloat getFalloffLinear(float lightRadius) {\n\t\tfloat d = length(dLightDirW);\n\t\treturn max(((lightRadius - d) / lightRadius), 0.0);\n}\n";export{t as default};
