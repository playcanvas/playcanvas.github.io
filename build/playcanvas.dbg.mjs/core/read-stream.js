/**
 * Helper class for organized reading of memory.
 *
 * @ignore
 */
class ReadStream {
  constructor(arraybuffer) {
    this.arraybuffer = arraybuffer;
    this.dataView = new DataView(arraybuffer);
    this.offset = 0;
    this.stack = [];
  }
  get remainingBytes() {
    return this.dataView.byteLength - this.offset;
  }
  reset(offset = 0) {
    this.offset = offset;
  }
  skip(bytes) {
    this.offset += bytes;
  }
  align(bytes) {
    this.offset = this.offset + bytes - 1 & ~(bytes - 1);
  }
  _inc(amount) {
    this.offset += amount;
    return this.offset - amount;
  }
  readChar() {
    return String.fromCharCode(this.dataView.getUint8(this.offset++));
  }
  readChars(numChars) {
    let result = '';
    for (let i = 0; i < numChars; ++i) {
      result += this.readChar();
    }
    return result;
  }
  readU8() {
    return this.dataView.getUint8(this.offset++);
  }
  readU16() {
    return this.dataView.getUint16(this._inc(2), true);
  }
  readU32() {
    return this.dataView.getUint32(this._inc(4), true);
  }
  readU64() {
    return this.readU32() + 2 ** 32 * this.readU32();
  }

  // big-endian
  readU32be() {
    return this.dataView.getUint32(this._inc(4), false);
  }
  readArray(result) {
    for (let i = 0; i < result.length; ++i) {
      result[i] = this.readU8();
    }
  }
  readLine() {
    const view = this.dataView;
    let result = '';
    while (true) {
      if (this.offset >= view.byteLength) {
        break;
      }
      const c = String.fromCharCode(this.readU8());
      if (c === '\n') {
        break;
      }
      result += c;
    }
    return result;
  }
}

export { ReadStream };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhZC1zdHJlYW0uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL3JlYWQtc3RyZWFtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSGVscGVyIGNsYXNzIGZvciBvcmdhbml6ZWQgcmVhZGluZyBvZiBtZW1vcnkuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZWFkU3RyZWFtIHtcbiAgICBjb25zdHJ1Y3RvcihhcnJheWJ1ZmZlcikge1xuICAgICAgICB0aGlzLmFycmF5YnVmZmVyID0gYXJyYXlidWZmZXI7XG4gICAgICAgIHRoaXMuZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcoYXJyYXlidWZmZXIpO1xuICAgICAgICB0aGlzLm9mZnNldCA9IDA7XG4gICAgICAgIHRoaXMuc3RhY2sgPSBbXTtcbiAgICB9XG5cbiAgICBnZXQgcmVtYWluaW5nQnl0ZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFWaWV3LmJ5dGVMZW5ndGggLSB0aGlzLm9mZnNldDtcbiAgICB9XG5cbiAgICByZXNldChvZmZzZXQgPSAwKSB7XG4gICAgICAgIHRoaXMub2Zmc2V0ID0gb2Zmc2V0O1xuICAgIH1cblxuICAgIHNraXAoYnl0ZXMpIHtcbiAgICAgICAgdGhpcy5vZmZzZXQgKz0gYnl0ZXM7XG4gICAgfVxuXG4gICAgYWxpZ24oYnl0ZXMpIHtcbiAgICAgICAgdGhpcy5vZmZzZXQgPSAodGhpcy5vZmZzZXQgKyBieXRlcyAtIDEpICYgKH4oYnl0ZXMgLSAxKSk7XG4gICAgfVxuXG4gICAgX2luYyhhbW91bnQpIHtcbiAgICAgICAgdGhpcy5vZmZzZXQgKz0gYW1vdW50O1xuICAgICAgICByZXR1cm4gdGhpcy5vZmZzZXQgLSBhbW91bnQ7XG4gICAgfVxuXG4gICAgcmVhZENoYXIoKSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMuZGF0YVZpZXcuZ2V0VWludDgodGhpcy5vZmZzZXQrKykpO1xuICAgIH1cblxuICAgIHJlYWRDaGFycyhudW1DaGFycykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQ2hhcnM7ICsraSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IHRoaXMucmVhZENoYXIoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHJlYWRVOCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVZpZXcuZ2V0VWludDgodGhpcy5vZmZzZXQrKyk7XG4gICAgfVxuXG4gICAgcmVhZFUxNigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVZpZXcuZ2V0VWludDE2KHRoaXMuX2luYygyKSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgcmVhZFUzMigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVZpZXcuZ2V0VWludDMyKHRoaXMuX2luYyg0KSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgcmVhZFU2NCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVhZFUzMigpICsgMiAqKiAzMiAqIHRoaXMucmVhZFUzMigpO1xuICAgIH1cblxuICAgIC8vIGJpZy1lbmRpYW5cbiAgICByZWFkVTMyYmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFWaWV3LmdldFVpbnQzMih0aGlzLl9pbmMoNCksIGZhbHNlKTtcbiAgICB9XG5cbiAgICByZWFkQXJyYXkocmVzdWx0KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICByZXN1bHRbaV0gPSB0aGlzLnJlYWRVOCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVhZExpbmUoKSB7XG4gICAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmRhdGFWaWV3O1xuICAgICAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vZmZzZXQgPj0gdmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGMgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucmVhZFU4KCkpO1xuICAgICAgICAgICAgaWYgKGMgPT09ICdcXG4nKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQgKz0gYztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVhZFN0cmVhbSB9O1xuIl0sIm5hbWVzIjpbIlJlYWRTdHJlYW0iLCJjb25zdHJ1Y3RvciIsImFycmF5YnVmZmVyIiwiZGF0YVZpZXciLCJEYXRhVmlldyIsIm9mZnNldCIsInN0YWNrIiwicmVtYWluaW5nQnl0ZXMiLCJieXRlTGVuZ3RoIiwicmVzZXQiLCJza2lwIiwiYnl0ZXMiLCJhbGlnbiIsIl9pbmMiLCJhbW91bnQiLCJyZWFkQ2hhciIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImdldFVpbnQ4IiwicmVhZENoYXJzIiwibnVtQ2hhcnMiLCJyZXN1bHQiLCJpIiwicmVhZFU4IiwicmVhZFUxNiIsImdldFVpbnQxNiIsInJlYWRVMzIiLCJnZXRVaW50MzIiLCJyZWFkVTY0IiwicmVhZFUzMmJlIiwicmVhZEFycmF5IiwibGVuZ3RoIiwicmVhZExpbmUiLCJ2aWV3IiwiYyJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFVBQVUsQ0FBQztFQUNiQyxXQUFXQSxDQUFDQyxXQUFXLEVBQUU7SUFDckIsSUFBSSxDQUFDQSxXQUFXLEdBQUdBLFdBQVcsQ0FBQTtBQUM5QixJQUFBLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUlDLFFBQVEsQ0FBQ0YsV0FBVyxDQUFDLENBQUE7SUFDekMsSUFBSSxDQUFDRyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBQ2YsSUFBSSxDQUFD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
