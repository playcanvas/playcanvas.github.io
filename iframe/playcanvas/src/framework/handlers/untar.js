import { EventHandler } from '../../core/event-handler.js';

class Untar extends EventHandler {
  constructor(fetchPromise, assetsPrefix = '') {
    super();
    this.headerSize = 512;
    this.paddingSize = 512;
    this.bytesRead = 0;
    this.bytesReceived = 0;
    this.headerRead = false;
    this.reader = null;
    this.data = new Uint8Array(0);
    this.decoder = null;
    this.prefix = '';
    this.fileName = '';
    this.fileSize = 0;
    this.fileType = '';
    this.ustarFormat = '';
    this.prefix = assetsPrefix || '';
    this.reader = fetchPromise.body.getReader();
    this.reader.read().then(res => {
      this.pump(res.done, res.value);
    }).catch(err => {
      this.fire('error', err);
    });
  }
  pump(done, value) {
    if (done) {
      this.fire('done');
      return null;
    }
    this.bytesReceived += value.byteLength;
    const data = new Uint8Array(this.data.length + value.length);
    data.set(this.data);
    data.set(value, this.data.length);
    this.data = data;
    while (this.readFile());
    return this.reader.read().then(res => {
      this.pump(res.done, res.value);
    }).catch(err => {
      this.fire('error', err);
    });
  }
  readFile() {
    if (!this.headerRead && this.bytesReceived > this.bytesRead + this.headerSize) {
      var _this$decoder;
      this.headerRead = true;
      const view = new DataView(this.data.buffer, this.bytesRead, this.headerSize);
      (_this$decoder = this.decoder) != null ? _this$decoder : this.decoder = new TextDecoder('windows-1252');
      const headers = this.decoder.decode(view);
      this.fileName = headers.substring(0, 100).replace(/\0/g, '');
      this.fileSize = parseInt(headers.substring(124, 136), 8);
      this.fileType = headers.substring(156, 157);
      this.ustarFormat = headers.substring(257, 263);
      if (this.ustarFormat.indexOf('ustar') !== -1) {
        const prefix = headers.substring(345, 500).replace(/\0/g, '');
        if (prefix.length > 0) {
          this.fileName = prefix.trim() + this.fileName.trim();
        }
      }
      this.bytesRead += 512;
    }
    if (this.headerRead) {
      if (this.bytesReceived < this.bytesRead + this.fileSize) {
        return false;
      }
      if (this.fileType === '' || this.fileType === '0') {
        const dataView = new DataView(this.data.buffer, this.bytesRead, this.fileSize);
        const file = {
          name: this.prefix + this.fileName,
          size: this.fileSize,
          data: dataView
        };
        this.fire('file', file);
      }
      this.bytesRead += this.fileSize;
      this.headerRead = false;
      const bytesRemained = this.bytesRead % this.paddingSize;
      if (bytesRemained !== 0) this.bytesRead += this.paddingSize - bytesRemained;
      return true;
    }
    return false;
  }
}

export { Untar };
