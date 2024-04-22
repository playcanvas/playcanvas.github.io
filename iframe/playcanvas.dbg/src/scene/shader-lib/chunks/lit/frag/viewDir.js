var viewDirPS = /* glsl */`
void getViewDir() {
    dViewDirW = normalize(view_position - vPositionW);
}
`;

export { viewDirPS as default };
