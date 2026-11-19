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

function startServer(port = 4174) {
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

async function inspectViewport(width, height, label) {
  const port = 9222;
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    'http://127.0.0.1:4174/'
  ]);

  // Wait for Chrome CDP to become available
  let target = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const tabs = await res.json();
      target = tabs.find(t => t.url.includes('4174'));
      if (target && target.webSocketDebuggerUrl) break;
    } catch {}
  }

  if (!target) {
    chromeProc.kill();
    throw new Error('Could not connect to Chrome CDP');
  }

  // Connect WebSocket to CDP
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

  // Enable runtime & DOM
  await sendCdp('Runtime.enable');
  await sendCdp('DOM.enable');

  // Wait 500ms for full render
  await new Promise(r => setTimeout(r, 500));

  // Run DOM inspection script in the browser
  const evalResult = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const docWidth = document.documentElement.scrollWidth;
        const viewportWidth = window.innerWidth;
        const hasHorizontalOverflow = docWidth > viewportWidth;
        
        // Find elements causing horizontal overflow if any
        const overflowingElements = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewportWidth + 1) {
            overflowingElements.push({
              tag: el.tagName,
              id: el.id,
              className: el.className,
              right: rect.right,
              diff: rect.right - viewportWidth
            });
          }
        });

        // Audit touch targets on interactive buttons
        const touchTargets = [];
        document.querySelectorAll('button, a, .category-pill, .platform-chip').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            touchTargets.push({
              tag: el.tagName,
              text: (el.textContent || '').trim().substring(0, 20),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              isSmall: rect.height < 36 || rect.width < 36
            });
          }
        });

        // Check contrast / font sizes
        const bodyComputed = window.getComputedStyle(document.body);
        const headerComputed = window.getComputedStyle(document.querySelector('.site-header'));

        return {
          viewport: { width: viewportWidth, height: window.innerHeight },
          scrollWidth: docWidth,
          hasHorizontalOverflow,
          overflowCount: overflowingElements.length,
          overflowSamples: overflowingElements.slice(0, 3),
          totalInteractive: touchTargets.length,
          smallTargetsCount: touchTargets.filter(t => t.isSmall).length,
          smallTargetSamples: touchTargets.filter(t => t.isSmall).slice(0, 3),
          cardCount: document.querySelectorAll('.app-card').length,
          guidesCount: document.querySelectorAll('.guide-card').length
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
  const server = await startServer(4174);
  console.log('Deep audit server started.');

  try {
    console.log('\n--- SESSION 1: Mobile Viewport Deep Audit (390x844) ---');
    const mobileData = await inspectViewport(390, 844, 'Mobile');
    console.log('Mobile Viewport Metrics:', JSON.stringify(mobileData, null, 2));

    console.log('\n--- SESSION 2: Desktop Viewport Deep Audit (1440x900) ---');
    const desktopData = await inspectViewport(1440, 900, 'Desktop');
    console.log('Desktop Viewport Metrics:', JSON.stringify(desktopData, null, 2));
  } finally {
    server.close();
  }
}

run().catch(console.error);
