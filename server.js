/**
 * 极简静态文件服务器 —— build&run.bat 在缺少 python 时的 Node 兜底方案
 *
 * 用法: node server.js <静态目录> [端口]
 * 例:   node server.js unpackage/dist/build/web 8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';

    const filePath = path.join(rootDir, urlPath);
    // 防目录穿越
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // 单页应用兜底：未命中的路径返回 index.html
        fs.readFile(path.join(rootDir, 'index.html'), (err2, html) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('404 Not Found');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        });
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log('静态服务已启动: http://localhost:' + port);
    console.log('根目录: ' + rootDir);
  });
