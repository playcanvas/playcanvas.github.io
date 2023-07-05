var shadowVSM_commonPS = /* glsl */`
float linstep(float a, float b, float v) {
    return saturate((v - a) / (b - a));
}

float reduceLightBleeding(float pMax, float amount) {
   // Remove the [0, amount] tail and linearly rescale (amount, 1].
   return linstep(amount, 1.0, pMax);
}

float chebyshevUpperBound(vec2 moments, float mean, float minVariance, float lightBleedingReduction) {
    // Compute variance
    float variance = moments.y - (moments.x * moments.x);
    variance = max(variance, minVariance);

    // Compute probabilistic upper bound
    float d = mean - moments.x;
    float pMax = variance / (variance + (d * d));

    pMax = reduceLightBleeding(pMax, lightBleedingReduction);

    // One-tailed Chebyshev
    return (mean <= moments.x ? 1.0 : pMax);
}

float calculateEVSM(vec3 moments, float Z, float vsmBias, float exponent) {
    Z = 2.0 * Z - 1.0;
    float warpedDepth = exp(exponent * Z);

    moments.xy += vec2(warpedDepth, warpedDepth*warpedDepth) * (1.0 - moments.z);

    float VSMBias = vsmBias;//0.01 * 0.25;
    float depthScale = VSMBias * exponent * warpedDepth;
    float minVariance1 = depthScale * depthScale;
    return chebyshevUpperBound(moments.xy, warpedDepth, minVariance1, 0.1);
}
`;

export { shadowVSM_commonPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93VlNNX2NvbW1vbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3NoYWRvd1ZTTV9jb21tb24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGxpbnN0ZXAoZmxvYXQgYSwgZmxvYXQgYiwgZmxvYXQgdikge1xuICAgIHJldHVybiBzYXR1cmF0ZSgodiAtIGEpIC8gKGIgLSBhKSk7XG59XG5cbmZsb2F0IHJlZHVjZUxpZ2h0QmxlZWRpbmcoZmxvYXQgcE1heCwgZmxvYXQgYW1vdW50KSB7XG4gICAvLyBSZW1vdmUgdGhlIFswLCBhbW91bnRdIHRhaWwgYW5kIGxpbmVhcmx5IHJlc2NhbGUgKGFtb3VudCwgMV0uXG4gICByZXR1cm4gbGluc3RlcChhbW91bnQsIDEuMCwgcE1heCk7XG59XG5cbmZsb2F0IGNoZWJ5c2hldlVwcGVyQm91bmQodmVjMiBtb21lbnRzLCBmbG9hdCBtZWFuLCBmbG9hdCBtaW5WYXJpYW5jZSwgZmxvYXQgbGlnaHRCbGVlZGluZ1JlZHVjdGlvbikge1xuICAgIC8vIENvbXB1dGUgdmFyaWFuY2VcbiAgICBmbG9hdCB2YXJpYW5jZSA9IG1vbWVudHMueSAtIChtb21lbnRzLnggKiBtb21lbnRzLngpO1xuICAgIHZhcmlhbmNlID0gbWF4KHZhcmlhbmNlLCBtaW5WYXJpYW5jZSk7XG5cbiAgICAvLyBDb21wdXRlIHByb2JhYmlsaXN0aWMgdXBwZXIgYm91bmRcbiAgICBmbG9hdCBkID0gbWVhbiAtIG1vbWVudHMueDtcbiAgICBmbG9hdCBwTWF4ID0gdmFyaWFuY2UgLyAodmFyaWFuY2UgKyAoZCAqIGQpKTtcblxuICAgIHBNYXggPSByZWR1Y2VMaWdodEJsZWVkaW5nKHBNYXgsIGxpZ2h0QmxlZWRpbmdSZWR1Y3Rpb24pO1xuXG4gICAgLy8gT25lLXRhaWxlZCBDaGVieXNoZXZcbiAgICByZXR1cm4gKG1lYW4gPD0gbW9tZW50cy54ID8gMS4wIDogcE1heCk7XG59XG5cbmZsb2F0IGNhbGN1bGF0ZUVWU00odmVjMyBtb21lbnRzLCBmbG9hdCBaLCBmbG9hdCB2c21CaWFzLCBmbG9hdCBleHBvbmVudCkge1xuICAgIFogPSAyLjAgKiBaIC0gMS4wO1xuICAgIGZsb2F0IHdhcnBlZERlcHRoID0gZXhwKGV4cG9uZW50ICogWik7XG5cbiAgICBtb21lbnRzLnh5ICs9IHZlYzIod2FycGVkRGVwdGgsIHdhcnBlZERlcHRoKndhcnBlZERlcHRoKSAqICgxLjAgLSBtb21lbnRzLnopO1xuXG4gICAgZmxvYXQgVlNNQmlhcyA9IHZzbUJpYXM7Ly8wLjAxICogMC4yNTtcbiAgICBmbG9hdCBkZXB0aFNjYWxlID0gVlNNQmlhcyAqIGV4cG9uZW50ICogd2FycGVkRGVwdGg7XG4gICAgZmxvYXQgbWluVmFyaWFuY2UxID0gZGVwdGhTY2FsZSAqIGRlcHRoU2NhbGU7XG4gICAgcmV0dXJuIGNoZWJ5c2hldlVwcGVyQm91bmQobW9tZW50cy54eSwgd2FycGVkRGVwdGgsIG1pblZhcmlhbmNlMSwgMC4xKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEseUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
