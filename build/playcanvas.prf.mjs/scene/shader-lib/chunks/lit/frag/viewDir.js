var viewDirPS = `
void getViewDir() {
		dViewDirW = normalize(view_position - vPositionW);
}
`;

export { viewDirPS as default };
