var ambientSHPS = /* glsl */`
uniform vec3 ambientSH[9];

void addAmbient(vec3 worldNormal) {
    vec3 n = cubeMapRotate(worldNormal);

    vec3 color =
        ambientSH[0] +
        ambientSH[1] * n.x +
        ambientSH[2] * n.y +
        ambientSH[3] * n.z +
        ambientSH[4] * n.x * n.z +
        ambientSH[5] * n.z * n.y +
        ambientSH[6] * n.y * n.x +
        ambientSH[7] * (3.0 * n.z * n.z - 1.0) +
        ambientSH[8] * (n.x * n.x - n.y * n.y);

    dDiffuseLight += processEnvironment(max(color, vec3(0.0)));
}
`;

export { ambientSHPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1iaWVudFNILmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW1iaWVudFNILmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHZlYzMgYW1iaWVudFNIWzldO1xuXG52b2lkIGFkZEFtYmllbnQodmVjMyB3b3JsZE5vcm1hbCkge1xuICAgIHZlYzMgbiA9IGN1YmVNYXBSb3RhdGUod29ybGROb3JtYWwpO1xuXG4gICAgdmVjMyBjb2xvciA9XG4gICAgICAgIGFtYmllbnRTSFswXSArXG4gICAgICAgIGFtYmllbnRTSFsxXSAqIG4ueCArXG4gICAgICAgIGFtYmllbnRTSFsyXSAqIG4ueSArXG4gICAgICAgIGFtYmllbnRTSFszXSAqIG4ueiArXG4gICAgICAgIGFtYmllbnRTSFs0XSAqIG4ueCAqIG4ueiArXG4gICAgICAgIGFtYmllbnRTSFs1XSAqIG4ueiAqIG4ueSArXG4gICAgICAgIGFtYmllbnRTSFs2XSAqIG4ueSAqIG4ueCArXG4gICAgICAgIGFtYmllbnRTSFs3XSAqICgzLjAgKiBuLnogKiBuLnogLSAxLjApICtcbiAgICAgICAgYW1iaWVudFNIWzhdICogKG4ueCAqIG4ueCAtIG4ueSAqIG4ueSk7XG5cbiAgICBkRGlmZnVzZUxpZ2h0ICs9IHByb2Nlc3NFbnZpcm9ubWVudChtYXgoY29sb3IsIHZlYzMoMC4wKSkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
