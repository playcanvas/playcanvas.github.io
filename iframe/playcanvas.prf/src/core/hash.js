function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
function hash32Fnv1a(array) {
  const prime = 16777619;
  let hash = 2166136261;
  for (let i = 0; i < array.length; i++) {
    hash ^= array[i];
    hash *= prime;
  }
  return hash >>> 0;
}

export { hash32Fnv1a, hashCode };
