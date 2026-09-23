import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = { '/': ['demo/index.html', 'text/html'], '/demo.js': ['demo/demo.js', 'application/javascript'] };
const server = http.createServer(async (req, res) => {
  const file = files[req.url];
  if (!file) { res.writeHead(404); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store' }); res.end(await readFile(file[0])); }
  catch { res.writeHead(500); res.end('Could not load demo.'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Fictional demo: http://127.0.0.1:4173'));
