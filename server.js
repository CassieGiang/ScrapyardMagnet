import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/game.js': ['game.js', 'text/javascript'], '/engine.js': ['engine.js', 'text/javascript'] };
const server = http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { const body = await readFile(new URL(file[0], import.meta.url)); res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(body); }
  catch { res.writeHead(500); res.end('Unable to load game'); }
});
server.listen(Number(process.env.PORT) || 4173, '127.0.0.1', () => console.log('Scrapyard Magnet: http://127.0.0.1:' + server.address().port));
