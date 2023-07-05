var a="\nfloat getFalloffLinear(float lightRadius) {\n    float d = length(dLightDirW);\n    return max(((lightRadius - d) / lightRadius), 0.0);\n}\n";export{a as default};
