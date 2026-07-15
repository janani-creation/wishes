const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const dbPath = path.join(rootDir, 'data', 'answers.json');

function ensureDbFile() {
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '[]', 'utf8');
  }
}

function readDb() {
  ensureDbFile();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(data) {
  ensureDbFile();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let requestedPath = decodeURIComponent(requestUrl.pathname);

  if (requestedPath === '/') {
    requestedPath = '/questions.html';
  }

  const filePath = path.join(rootDir, requestedPath);
  const safePath = path.normalize(filePath);

  if (!safePath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const content = fs.readFileSync(safePath);

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/answers') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const db = readDb();
        const entry = {
          id: Date.now(),
          submittedAt: new Date().toISOString(),
          answers: Array.isArray(data.answers) ? data.answers : [],
          completed: Boolean(data.completed),
          questionIndex: Number(data.questionIndex) || 0
        };

        db.push(entry);
        writeDb(db);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, saved: entry }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/answers') {
    const db = readDb();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(db));
    return;
  }

  serveStatic(req, res);
});

function startServer(port) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < 3010) {
      console.warn(`Port ${port} is busy. Trying ${port + 1}...`);
      server.removeAllListeners('error');
      server.close(() => startServer(port + 1));
      return;
    }

    console.error(error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Birthday quiz server running at http://localhost:${port}`);
  });
}

const port = Number(process.env.PORT) || 3000;
startServer(port);
