/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccConstSimplePS = /* glsl */`
void occludeSpecular() {
    dSpecularLight *= dAo;
    dReflection *= dAo;
}
`;

export { aoSpecOccConstSimplePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjQ29uc3RTaW1wbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9hb1NwZWNPY2NDb25zdFNpbXBsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBvY2NsdWRlU3BlY3VsYXIoKSB7XG4gICAgZFNwZWN1bGFyTGlnaHQgKj0gZEFvO1xuICAgIGRSZWZsZWN0aW9uICo9IGRBbztcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw2QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
