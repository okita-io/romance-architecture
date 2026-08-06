// Local HTTPS server for Story Roulette
// Usage: node serve.js
// Then open https://localhost:3443

const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3443;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const options = {
  key: fs.readFileSync(path.join(ROOT, 'certs', 'key.pem')),
  cert: fs.readFileSync(path.join(ROOT, 'certs', 'cert.pem')),
};

const server = https.createServer(options, (req, res) => {
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving over HTTPS at https://localhost:${PORT}`);
  console.log(`Also accessible on your LAN at https://<your-ip>:${PORT}`);
  console.log('(Your browser will warn about the self-signed cert — click "Advanced" → "Proceed")');
});
