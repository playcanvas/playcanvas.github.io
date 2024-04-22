const BitPacking = {
  set(storage, value, shift, mask = 1) {
    const data = storage & ~(mask << shift);
    return data | value << shift;
  },
  get(storage, shift, mask = 1) {
    return storage >> shift & mask;
  },
  all(storage, shift, mask = 1) {
    const shifted = mask << shift;
    return (storage & shifted) === shifted;
  },
  any(storage, shift, mask = 1) {
    return (storage & mask << shift) !== 0;
  }
};

export { BitPacking };
