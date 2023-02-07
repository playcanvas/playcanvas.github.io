/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var outputAlphaPremulPS = /* glsl */`
gl_FragColor.rgb *= dAlpha;
gl_FragColor.a = dAlpha;
`;

export { outputAlphaPremulPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0QWxwaGFQcmVtdWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9vdXRwdXRBbHBoYVByZW11bC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZ2xfRnJhZ0NvbG9yLnJnYiAqPSBkQWxwaGE7XG5nbF9GcmFnQ29sb3IuYSA9IGRBbHBoYTtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwwQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBQUM7Ozs7In0=
