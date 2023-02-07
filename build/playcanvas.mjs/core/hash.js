function hashCode(str) {
	let hash = 0;
	for (let i = 0, len = str.length; i < len; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return hash;
}

export { hashCode };
