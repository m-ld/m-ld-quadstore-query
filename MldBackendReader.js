module.exports = class MldBackendReader {
  constructor(stream) {
    this.stream = stream;
    this.buffer = Buffer.alloc(0);
    this.pos = 0;
    stream.on('error', err => this.err = err);
    stream.on('readable', () => this.readableData = true);
  }

  static async readInto(backend, stream) {
    const reading = new MldBackendReader(stream);
    while (true) {
      const [key, value] = await reading.readKeyValue();
      if (key != null && value != null)
        await new Promise((resolve, reject) =>
          backend.put(key, value, err => err ? reject(err) : resolve()));
      else
        break;
    }
  }

  async readKeyValue() {
    const key = await this.readNext();
    if (key != null) {
      const value = await this.readNext();
      if (value == null)
        throw new Error('Unexpected EOF');
      return [key, value];
    }
    return [];
  }

  async readNext() {
    const lenBuf = await this.readBuffer(4);
    return lenBuf != null ? await this.readBuffer(lenBuf.readUInt32LE()) : null;
  }

  async readBuffer(length) {
    if (this.pos + length <= this.buffer.length) {
      return this.buffer.slice(this.pos, this.pos += length);
    } else {
      const buffer = Buffer.alloc(length);
      for (let i = 0; i < length; i++) {
        if (this.pos >= this.buffer.length) {
          const data = await this.readFromStream();
          if (data == null)
            return null;
          this.buffer = data;
          this.pos = 0;
        }
        buffer[i] = this.buffer[this.pos++];
      }
      return buffer;
    }
  }

  async readFromStream() {
    if (this.err) {
      throw err;
    } else if (this.stream.readableEnded) {
      return null;
    } else if (this.readableData) {
      const data = this.stream.read();
      if (data != null)
        return data;
      else
        this.readableData = false;
    } else {
      await new Promise((resolve, reject) => {
        this.stream.once('readable', resolve);
        this.stream.once('error', reject);
      });
    }
    return this.readFromStream();
  }
}
