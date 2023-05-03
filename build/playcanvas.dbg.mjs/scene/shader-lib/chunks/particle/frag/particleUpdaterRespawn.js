var particleUpdaterRespawnPS = /* glsl */`
    if (outLife >= lifetime) {
        outLife -= max(lifetime, (numParticles - 1.0) * particleRate);
        visMode = 1.0;
    }
    visMode = outLife < 0.0? 1.0: visMode;
`;

export { particleUpdaterRespawnPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyUmVzcGF3bi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVVcGRhdGVyUmVzcGF3bi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIGlmIChvdXRMaWZlID49IGxpZmV0aW1lKSB7XG4gICAgICAgIG91dExpZmUgLT0gbWF4KGxpZmV0aW1lLCAobnVtUGFydGljbGVzIC0gMS4wKSAqIHBhcnRpY2xlUmF0ZSk7XG4gICAgICAgIHZpc01vZGUgPSAxLjA7XG4gICAgfVxuICAgIHZpc01vZGUgPSBvdXRMaWZlIDwgMC4wPyAxLjA6IHZpc01vZGU7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLCtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
