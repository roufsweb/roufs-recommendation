import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startServer(port = 4175) {
  const rootDir = process.cwd();
  const server = http.createServer((req, res) => {
    let filePath = path.join(rootDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function inspectViewport(port, width, height) {
  const cdpPort = port + 5000;
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--window-size=${width},${height}`,
    `http://127.0.0.1:${port}/`
  ]);

  let target = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
      const tabs = await res.json();
      target = tabs.find(t => t.url.includes(String(port)));
      if (target && target.webSocketDebuggerUrl) break;
    } catch {}
  }

  if (!target) {
    chromeProc.kill();
    throw new Error('Could not connect to Chrome CDP');
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);

  let idCounter = 1;
  function sendCdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCdp('Runtime.enable');
  await sendCdp('DOM.enable');

  // Wait 800ms for full script execution & DOM render
  await new Promise(r => setTimeout(r, 800));

  const evalResult = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const cards = document.querySelectorAll('.app-card');
        const guides = document.querySelectorAll('.guide-card');
        const tabs = document.querySelectorAll('.category-pill');
        const docWidth = document.documentElement.scrollWidth;
        const viewportWidth = window.innerWidth;

        return {
          viewport: { width: viewportWidth, height: window.innerHeight },
          scrollWidth: docWidth,
          hasHorizontalOverflow: docWidth > viewportWidth,
          cardCount: cards.length,
          guidesCount: guides.length,
          tabsCount: tabs.length,
          firstCardTitle: cards.length > 0 ? cards[0].querySelector('.card-title')?.textContent : null,
          allAppsRendered: cards.length === 17
        };
      })()
    `,
    returnByValue: true
  });

  ws.close();
  chromeProc.kill();

  return evalResult.result.value;
}

async function run() {
  const server = await startServer(4175);
  try {
    const mobile = await inspectViewport(4175, 390, 844);
    console.log('Mobile View Verification:', mobile);

    await new Promise(r => setTimeout(r, 500));

    const desktop = await inspectViewport(4175, 1440, 900);
    console.log('Desktop View Verification:', desktop);
  } finally {
    server.close();
  }
}

run().catch(console.error);
