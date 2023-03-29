/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccConstSimplePS = `
void occludeSpecular() {
    dSpecularLight *= dAo;
    dReflection *= dAo;
}
`;

export { aoSpecOccConstSimplePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjQ29uc3RTaW1wbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW9TcGVjT2NjQ29uc3RTaW1wbGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgb2NjbHVkZVNwZWN1bGFyKCkge1xuICAgIGRTcGVjdWxhckxpZ2h0ICo9IGRBbztcbiAgICBkUmVmbGVjdGlvbiAqPSBkQW87XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNkJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUxBOzs7OyJ9
