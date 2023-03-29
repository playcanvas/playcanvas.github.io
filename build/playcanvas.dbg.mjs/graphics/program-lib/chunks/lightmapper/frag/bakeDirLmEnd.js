/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var bakeDirLmEndPS = `
    vec4 dirLm = texture2D(texture_dirLightMap, vUv1);

    if (bakeDir > 0.5) {
        if (dAtten > 0.00001) {
            dirLm.xyz = dirLm.xyz * 2.0 - vec3(1.0);
            dAtten = saturate(dAtten);
            gl_FragColor.rgb = normalize(dLightDirNormW.xyz*dAtten + dirLm.xyz*dirLm.w) * 0.5 + vec3(0.5);
            gl_FragColor.a = dirLm.w + dAtten;
            gl_FragColor.a = max(gl_FragColor.a, 1.0 / 255.0);
        } else {
            gl_FragColor = dirLm;
        }
    } else {
        gl_FragColor.rgb = dirLm.xyz;
        gl_FragColor.a = max(dirLm.w, dAtten > 0.00001? (1.0/255.0) : 0.0);
    }
`;

export { bakeDirLmEndPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFrZURpckxtRW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpZ2h0bWFwcGVyL2ZyYWcvYmFrZURpckxtRW5kLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgdmVjNCBkaXJMbSA9IHRleHR1cmUyRCh0ZXh0dXJlX2RpckxpZ2h0TWFwLCB2VXYxKTtcblxuICAgIGlmIChiYWtlRGlyID4gMC41KSB7XG4gICAgICAgIGlmIChkQXR0ZW4gPiAwLjAwMDAxKSB7XG4gICAgICAgICAgICBkaXJMbS54eXogPSBkaXJMbS54eXogKiAyLjAgLSB2ZWMzKDEuMCk7XG4gICAgICAgICAgICBkQXR0ZW4gPSBzYXR1cmF0ZShkQXR0ZW4pO1xuICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IG5vcm1hbGl6ZShkTGlnaHREaXJOb3JtVy54eXoqZEF0dGVuICsgZGlyTG0ueHl6KmRpckxtLncpICogMC41ICsgdmVjMygwLjUpO1xuICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yLmEgPSBkaXJMbS53ICsgZEF0dGVuO1xuICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yLmEgPSBtYXgoZ2xfRnJhZ0NvbG9yLmEsIDEuMCAvIDI1NS4wKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGdsX0ZyYWdDb2xvciA9IGRpckxtO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IGRpckxtLnh5ejtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yLmEgPSBtYXgoZGlyTG0udywgZEF0dGVuID4gMC4wMDAwMT8gKDEuMC8yNTUuMCkgOiAwLjApO1xuICAgIH1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBakJBOzs7OyJ9
