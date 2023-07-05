/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_softPS = `
    float depth = getLinearScreenDepth();
    float particleDepth = vDepth;
    float depthDiff = saturate(abs(particleDepth - depth) * softening);
    a *= depthDiff;
`;

export { particle_softPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfc29mdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlX3NvZnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBmbG9hdCBkZXB0aCA9IGdldExpbmVhclNjcmVlbkRlcHRoKCk7XG4gICAgZmxvYXQgcGFydGljbGVEZXB0aCA9IHZEZXB0aDtcbiAgICBmbG9hdCBkZXB0aERpZmYgPSBzYXR1cmF0ZShhYnMocGFydGljbGVEZXB0aCAtIGRlcHRoKSAqIHNvZnRlbmluZyk7XG4gICAgYSAqPSBkZXB0aERpZmY7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsc0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUxBOzs7OyJ9
