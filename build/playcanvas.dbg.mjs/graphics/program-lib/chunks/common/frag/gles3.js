/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var gles3PS = `
#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
#define texture2DBias texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
#define GL2
#define SUPPORTS_TEXLOD
`;

export { gles3PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xlczMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvZ2xlczMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNkZWZpbmUgdmFyeWluZyBpblxub3V0IGhpZ2hwIHZlYzQgcGNfZnJhZ0NvbG9yO1xuI2RlZmluZSBnbF9GcmFnQ29sb3IgcGNfZnJhZ0NvbG9yXG4jZGVmaW5lIHRleHR1cmUyRCB0ZXh0dXJlXG4jZGVmaW5lIHRleHR1cmUyREJpYXMgdGV4dHVyZVxuI2RlZmluZSB0ZXh0dXJlQ3ViZSB0ZXh0dXJlXG4jZGVmaW5lIHRleHR1cmUyRFByb2ogdGV4dHVyZVByb2pcbiNkZWZpbmUgdGV4dHVyZTJETG9kRVhUIHRleHR1cmVMb2RcbiNkZWZpbmUgdGV4dHVyZTJEUHJvakxvZEVYVCB0ZXh0dXJlUHJvakxvZFxuI2RlZmluZSB0ZXh0dXJlQ3ViZUxvZEVYVCB0ZXh0dXJlTG9kXG4jZGVmaW5lIHRleHR1cmUyREdyYWRFWFQgdGV4dHVyZUdyYWRcbiNkZWZpbmUgdGV4dHVyZTJEUHJvakdyYWRFWFQgdGV4dHVyZVByb2pHcmFkXG4jZGVmaW5lIHRleHR1cmVDdWJlR3JhZEVYVCB0ZXh0dXJlR3JhZFxuI2RlZmluZSBHTDJcbiNkZWZpbmUgU1VQUE9SVFNfVEVYTE9EXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsY0FBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQWhCQTs7OzsifQ==
