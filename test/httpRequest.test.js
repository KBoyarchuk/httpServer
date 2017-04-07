import test from 'ava';
import sinon from 'sinon';
import EventEmitter from 'events';
import proxyquire from 'proxyquire';
import { Readable, Writable } from 'stream';
import myHttp, { MyHttpRequest, MyHttpResponse, MyHttpServer } from '../src/http';

const headersRequest = `GET / HTTP/1.1
Connection: keep-alive
Content-Type: text/html

`.replace(/\n/g, '\r\n');

test.cb(`Should correctly handle when headers come in multiple chunks`, t => {
  const fakeSocket = new Readable({
    read: () => {},
  });
  const myStream = new MyHttpRequest(fakeSocket);
  myStream.on('headers', () => {
    t.end();
  });

  const fakeHeadersF = headersRequest.substr(0, Math.ceil(headersRequest.length / 2));
  const fakeHeadersS = headersRequest.substr(fakeHeadersF.length + 1);
  fakeSocket.push(fakeHeadersF);
  setTimeout(() => fakeSocket.push(fakeHeadersS));
});

test(`Call to setHeader after headers have been sent should emit error`, t => {
  const fakeSocket = new Writable({
    write: () => {},
  });
  const myStream = new MyHttpResponse(fakeSocket);
  myStream.setHeader('Content-Type', 'application/json');
  myStream.write('body');
  t.throws(() => {
    myStream.setHeader('Content-Type', 'text/html');
  });
});

test.cb(`Call to writeHead shoud send headers with corresponding status line`, t => {
  const fakeSocket = new Writable({
    write: chunk => {
      const [head] = chunk.toString('utf8').split('/r/n');
      t.true(!head.includes(200));
      t.end();
    },
  });
  const myStream = new MyHttpResponse(fakeSocket);
  myStream.writeHead(404);
  myStream.write('body');
});

test.cb(`Should correctly parse headers, method & url fields`, t => {
  const fakeSocket = new Readable({
    read: () => {},
  });
  const myStream = new MyHttpRequest(fakeSocket);
  myStream.on('headers', data => {
    t.deepEqual(
      [data.method, data.url, data.headers],
      [
        'GET',
        '/',
        {
          Connection: 'keep-alive',
          'Content-Type': 'text/html',
        },
      ],
    );
    t.end();
  });
  fakeSocket.push(headersRequest);
});

test(`Call to writeHead after head was already written should emit error`, t => {
  const fakeSocket = new Writable({
    write: () => {},
  });
  const myStream = new MyHttpResponse(fakeSocket);
  myStream.writeHead(200);
  myStream.write('body');
  t.throws(() => {
    myStream.writeHead(404);
  });
});

test.cb(`HttpRequest is ReadableStream and contain body without headers`, t => {
  const fakeSocket = new Readable({
    read: () => {},
  });
  const myStream = new MyHttpRequest(fakeSocket);
  fakeSocket.push(headersRequest);
  fakeSocket.push('body');
  t.true(myStream instanceof Readable);
  t.end();
});

test.cb(`HttpResponse have setHeader method`, t => {
  const fakeSocket = new Writable({
    write: () => {},
  });
  const myStream = new MyHttpResponse(fakeSocket);
  t.true('setHeader' in myStream);
  const setH = sinon.spy(myStream, 'setHeader');
  const sendH = sinon.spy(myStream, 'sendHeaders');
  myStream.setHeader('Accept-Language', 'ru');
  sinon.assert.called(setH);
  sinon.assert.notCalled(sendH);
  t.end();
});

test.cb(`All headers added with setHeader should be sent to socket`, t => {
  const fakeSocket = new Writable({
    write: () => {},
  });
  const myStream = new MyHttpResponse(fakeSocket);
  const sendH = sinon.spy(myStream, 'sendHeaders');
  myStream.setHeader('Accept-Language', 'ru');
  myStream.sendHeaders();
  t.deepEqual(myStream.headers, new Map([]).set(`Accept-Language`, `ru`));
  sinon.assert.called(sendH);
  t.end();
});

test.cb(`Should contain createServer function`, t => {
  t.true(Object.hasOwnProperty.call(myHttp, 'createServer'));
  const createS = sinon.spy(myHttp, 'createServer');
  myHttp.createServer();
  const spyCall = createS.returnValues[0];
  t.true(spyCall instanceof MyHttpServer);
  t.end();
});

test.cb(`setHeader method should overwrite header with the same name `, t => {
  const fakeSocket = new Writable({
    write: () => {},
  });
  const myStream = new MyHttpResponse(fakeSocket);
  myStream.setHeader('Content-Type', 'application/json');
  myStream.setHeader('Accept-Ranges', 'bytes');
  myStream.setHeader('Content-Type', 'text/html');
  t.deepEqual(
    myStream.headers,
    new Map([]).set('Content-Type', 'text/html').set('Accept-Ranges', 'bytes'),
  );
  t.end();
});

test.cb(`HttpRequest should emit close event if socket was closed`, t => {
  class FakeSocket extends EventEmitter {}
  const socket = new FakeSocket();
  const myStream = new MyHttpRequest(socket);
  myStream.on('close', () => {
    t.end();
  });
  socket.emit('close');
});

test.only(`Call to HttpServer listen should start server on corresponding port`, t => {
  const port = 4000;
  const foo = proxyquire('../src/http', {
    net: {
      createServer() {
        return {
          on() {},
          listen(serverPort) {
            t.is(serverPort, 3000);
          },
        };
      },
    },
  });

  console.log(foo);
  const server = foo.default.createServer();
  server.listen(port);
  t.pass();
});

test.cb(`HttpResponse should be WritableStream`, t => {
  const fakeSocket = new Writable({
    read: () => {},
  });
  const myStream = new MyHttpResponse(fakeSocket);
  t.true(myStream instanceof Writable);
  t.end();
});
