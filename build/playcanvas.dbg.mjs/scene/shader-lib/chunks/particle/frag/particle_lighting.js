var particle_lightingPS = /* glsl */`
    vec3 light = negNormal.x*lightCube[0] + posNormal.x*lightCube[1] +
                        negNormal.y*lightCube[2] + posNormal.y*lightCube[3] +
                        negNormal.z*lightCube[4] + posNormal.z*lightCube[5];

    rgb *= light;
`;

export { particle_lightingPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbGlnaHRpbmcuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlX2xpZ2h0aW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgdmVjMyBsaWdodCA9IG5lZ05vcm1hbC54KmxpZ2h0Q3ViZVswXSArIHBvc05vcm1hbC54KmxpZ2h0Q3ViZVsxXSArXG4gICAgICAgICAgICAgICAgICAgICAgICBuZWdOb3JtYWwueSpsaWdodEN1YmVbMl0gKyBwb3NOb3JtYWwueSpsaWdodEN1YmVbM10gK1xuICAgICAgICAgICAgICAgICAgICAgICAgbmVnTm9ybWFsLnoqbGlnaHRDdWJlWzRdICsgcG9zTm9ybWFsLnoqbGlnaHRDdWJlWzVdO1xuXG4gICAgcmdiICo9IGxpZ2h0O1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
