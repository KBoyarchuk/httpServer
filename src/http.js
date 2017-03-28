import { createServer } from 'net';
import { Readable, Writable } from 'stream';
import EventEmitter from 'events';

class MyHttpRequest extends Readable {
  constructor(socket) {
    super();
    this.socket = socket;
    this.state = false;
    this.buffer = Buffer.alloc(0);
    this.socket
      .on('data', this.onData.bind(this))
      .on('error', this.onError.bind(this))
      .on('end', this.onEnd.bind(this));
  }
  _read() {
    this.socket.resume();
  }
  onData(dataChunk) {
    if (!this.state) {
      this.buffer = Buffer.concat([this.buffer, dataChunk]);

      const indxDelimiter = this.findDelimiter(this.buffer);

      if (indxDelimiter !== -1) {
        this.state = true;
        this.socket.pause();

        const msgHeader = this.buffer.slice(0, indxDelimiter);
        const msgBuffer = this.buffer.slice(indxDelimiter + 4);

        this.processHeaders(msgHeader);
        this.push(msgBuffer);
        this.emit('headers', this);
      }
    } else {
      this.push(dataChunk);
      this.socket.pause();
    }
  }
  onError(err) {
    this.emit('error', err);
  }
  onEnd() {
    this.push(null);
  }
  findDelimiter(buffer) {
    return buffer.indexOf(`\r\n\r\n`);
  }
  processHeaders(buffer) {
    const headers = buffer.toString().split(`\r\n`);
    this.setRequestLine(headers.shift());
    this.setRequestHeaders(headers);
  }
  setRequestLine(requestLine) {
    const splitter = requestLine.split(' ');
    this.method = splitter.shift();
    this.url = splitter.shift();
    this.version = splitter.shift();
  }
  setRequestHeaders(headers) {
    this.headers = headers.reduce(
      (acc, val) => {
        const parseHeader = val.split(': ');
        return Object.assign({}, acc, { [parseHeader[0]]: parseHeader[1] });
      },
      {},
    );
  }
}

class MyHttpResponse extends Writable {
  constructor(socket) {
    super();
    this.socket = socket;
    this.isHeadersSent = false;
    this.headers = new Map([]);
    this.commonStatusCode = new Map([
      [200, 'OK'],
      [403, 'Forbidden'],
      [404, 'Not Found'],
      [500, 'Internal Server Error'],
    ]);
  }
  _write(chunk, encoding, cb) {
    if (!this.isHeadersSent) {
      this.sendHeaders();
    }
    this.socket.write(chunk);
    cb();
  }
  end() {
    this.socket.end();
  }
  setHeader(headerName, value) {
    if (this.isHeadersSent) {
      this.emit('error');
      return;
    }
    this.headers.set(headerName, value);
  }
  sendHeaders() {
    const statusCode = this.statusCode || '';
    const reasonPhrase = this.commonStatusCode.get(statusCode) || '';
    this.socket.write(`HTTP/1.1 ${statusCode} ${reasonPhrase}`);
    let requestHeaders = '';
    this.headers.forEach((resHeaderValue, resHeaderName) => {
      requestHeaders += `'${resHeaderName}': '${resHeaderValue}'\r\n`;
    });
    this.socket.write(requestHeaders);
    this.socket.write(`\r\n`);
    this.isHeadersSent = true;
  }
  writeHead(statusCode) {
    this.statusCode = statusCode;
  }
}

class MyHttpServer extends EventEmitter {
  constructor() {
    super();
    this.server = createServer();
    this.server.on('connection', socket => {
      const req = new MyHttpRequest(socket);
      const res = new MyHttpResponse(socket);
      req.on('headers', () => {
        this.emit('request', req, res);
      });
    });
  }
  listen(port = '127.0.0.1') {
    this.server.listen(port, () => {
      console.log(`Listening server on ${port} port`);
    });
  }
}

export default {
  createServer() {
    return new MyHttpServer();
  },
};
