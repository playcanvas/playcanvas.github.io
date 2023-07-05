var particleOutputFloatPS = /* glsl */`
void writeOutput() {
    if (gl_FragCoord.y<1.0) {
        gl_FragColor = vec4(outPos, (outAngle + 1000.0) * visMode);
    } else {
        gl_FragColor = vec4(outVel, outLife);
    }
}
`;

export { particleOutputFloatPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVPdXRwdXRGbG9hdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVPdXRwdXRGbG9hdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCB3cml0ZU91dHB1dCgpIHtcbiAgICBpZiAoZ2xfRnJhZ0Nvb3JkLnk8MS4wKSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQob3V0UG9zLCAob3V0QW5nbGUgKyAxMDAwLjApICogdmlzTW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChvdXRWZWwsIG91dExpZmUpO1xuICAgIH1cbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsNEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
