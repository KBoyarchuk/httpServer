import fs from 'mz/fs';
import myHttp from './http';

const server = myHttp.createServer();

server
  .on('request', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    fs.createReadStream('D:/Node/static/index.html').pipe(res);
  })
  .listen(3000);
