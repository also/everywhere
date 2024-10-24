import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import send from 'send';

export default function ({ _: [cert, ...directories] }: { _: string[] }) {
  const options = {
    key: fs.readFileSync(`${cert}.key`),
    cert: fs.readFileSync(`${cert}.cer`),
  };

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      console.error('Directory does not exist:', dir);
      process.exit(1);
    }
  }

  function onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.url?.match(/^\/[A-Za-z0-9]+\.MP4$/)) {
      for (const dir of directories) {
        const filename = path.join(dir, req.url);
        if (fs.existsSync(filename)) {
          send(req, filename).pipe(res);
          return;
        }
      }
    }
    console.log('404', req.url);
    res.statusCode = 404;
    res.end();
  }
  http.createServer(onRequest).listen(3000, '0.0.0.0');

  https.createServer(options, onRequest).listen(443);
}
