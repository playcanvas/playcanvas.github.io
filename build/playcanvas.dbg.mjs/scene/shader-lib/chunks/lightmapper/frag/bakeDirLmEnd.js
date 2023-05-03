var bakeDirLmEndPS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFrZURpckxtRW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGlnaHRtYXBwZXIvZnJhZy9iYWtlRGlyTG1FbmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICB2ZWM0IGRpckxtID0gdGV4dHVyZTJEKHRleHR1cmVfZGlyTGlnaHRNYXAsIHZVdjEpO1xuXG4gICAgaWYgKGJha2VEaXIgPiAwLjUpIHtcbiAgICAgICAgaWYgKGRBdHRlbiA+IDAuMDAwMDEpIHtcbiAgICAgICAgICAgIGRpckxtLnh5eiA9IGRpckxtLnh5eiAqIDIuMCAtIHZlYzMoMS4wKTtcbiAgICAgICAgICAgIGRBdHRlbiA9IHNhdHVyYXRlKGRBdHRlbik7XG4gICAgICAgICAgICBnbF9GcmFnQ29sb3IucmdiID0gbm9ybWFsaXplKGRMaWdodERpck5vcm1XLnh5eipkQXR0ZW4gKyBkaXJMbS54eXoqZGlyTG0udykgKiAwLjUgKyB2ZWMzKDAuNSk7XG4gICAgICAgICAgICBnbF9GcmFnQ29sb3IuYSA9IGRpckxtLncgKyBkQXR0ZW47XG4gICAgICAgICAgICBnbF9GcmFnQ29sb3IuYSA9IG1heChnbF9GcmFnQ29sb3IuYSwgMS4wIC8gMjU1LjApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yID0gZGlyTG07XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBnbF9GcmFnQ29sb3IucmdiID0gZGlyTG0ueHl6O1xuICAgICAgICBnbF9GcmFnQ29sb3IuYSA9IG1heChkaXJMbS53LCBkQXR0ZW4gPiAwLjAwMDAxPyAoMS4wLzI1NS4wKSA6IDAuMCk7XG4gICAgfVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
