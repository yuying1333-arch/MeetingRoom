/**
 * 极简静态文件服务器 —— build&run.bat 在缺少 python 时的 Node 兜底方案
 *
 * 用法: node server.js <静态目录> [端口]
 * 例:   node server.js unpackage/dist/build/web 8901
 *
 * 额外能力（静态目录里没有的虚拟路径）:
 *   /__qr        一个简单页面，显示当前访问地址 + 二维码（手机可扫）
 *   /__qr.png    当前访问地址的二维码图片（PNG）
 *
 * 说明: 二维码由同目录的 qrcode.js 生成，零第三方依赖。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const qrcode = require('./qrcode');

const rootDir = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || process.env.PORT || 8901);

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

/** 取本机局域网 IPv4 列表（过滤回环与自动专用地址） */
function getLanAddresses() {
  const result = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((info) => {
      if (info.family !== 'IPv4' && info.family !== 4) return;
      if (info.internal) return;
      if (info.address.startsWith('169.254.')) return;
      result.push(info.address);
    });
  });
  return result;
}

/** 根据请求头还原用户实际访问的地址，用于生成"扫了就能用"的二维码 */
function requestOrigin(req) {
  const host = req.headers.host || 'localhost:' + port;
  return 'http://' + host;
}

function qrPage(origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>扫码访问</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#f5f6f8;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#222}
  .card{background:#fff;border-radius:14px;padding:28px 32px;box-shadow:0 6px 26px rgba(0,0,0,.08);text-align:center;max-width:92vw}
  h1{font-size:17px;margin:0 0 6px;font-weight:600}
  p.tip{font-size:13px;color:#888;margin:0 0 18px}
  img{width:240px;height:240px;image-rendering:pixelated}
  code{display:inline-block;margin-top:16px;font-size:13px;color:#0a7cff;word-break:break-all}
</style>
</head>
<body>
  <div class="card">
    <h1>手机扫码访问</h1>
    <p class="tip">需与服务器处于同一局域网 / WiFi</p>
    <img src="/__qr.png" alt="访问二维码" />
    <br />
    <code>${origin}</code>
  </div>
</body>
</html>`;
}

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';

    // ---- 虚拟路径：二维码 ----
    if (urlPath === '/__qr.png' || urlPath === '/qrcode.png') {
      try {
        const png = qrcode.toPNG(requestOrigin(req), { scale: 8 });
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': png.length,
          'Cache-Control': 'no-store'
        });
        return res.end(png);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('二维码生成失败: ' + e.message);
      }
    }
    if (urlPath === '/__qr' || urlPath === '/__qr/') {
      const html = qrPage(requestOrigin(req));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end(html);
    }

    // ---- 静态文件 ----
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
    console.log('');
    console.log('[server] running');
    console.log('  root : ' + rootDir);
    console.log('  local: http://localhost:' + port);
    getLanAddresses().forEach((ip) => {
      console.log('  lan  : http://' + ip + ':' + port);
      console.log('  qr   : http://' + ip + ':' + port + '/__qr');
    });
    console.log('');
  })
  .on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error('');
      console.error('[server] port ' + port + ' is already in use.');
      console.error('         close the program using it, or change PORT in build&run.bat');
      console.error('');
    } else {
      console.error('[server] ' + e.message);
    }
    process.exit(1);
  });
