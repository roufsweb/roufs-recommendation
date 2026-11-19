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

function startServer(port = 4178) {
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

async function auditSession(port, width, height, sessionName, screenshotFile) {
  const cdpPort = port + 6000;
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
    throw new Error(`Could not connect to Chrome CDP for session ${sessionName}`);
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
  await sendCdp('Page.enable');

  // Wait for render
  await new Promise(r => setTimeout(r, 700));

  // Capture screenshot via CDP
  const screenshotData = await sendCdp('Page.captureScreenshot', { format: 'png' });
  if (screenshotData && screenshotData.data) {
    fs.writeFileSync(screenshotFile, Buffer.from(screenshotData.data, 'base64'));
  }

  // Evaluate DOM
  const evalResult = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const docWidth = document.documentElement.scrollWidth;
        const viewportWidth = window.innerWidth;
        const hasHorizontalOverflow = docWidth > viewportWidth;
        
        const tiles = document.querySelectorAll('.app-tile');
        const firstTileRect = tiles.length > 0 ? tiles[0].getBoundingClientRect() : null;
        const firstIcon = tiles.length > 0 ? tiles[0].querySelector('.tile-icon') : null;
        const firstIconRect = firstIcon ? firstIcon.getBoundingClientRect() : null;

        // Check if top hero section is gone
        const heroSection = document.querySelector('.hero-section');
        const hasHeroSection = !!heroSection;

        // Check touch target heights of interactive elements
        const smallTargets = [];
        document.querySelectorAll('button, a, .app-tile').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            if (r.height < 32 || r.width < 32) {
              smallTargets.push({ tag: el.tagName, text: el.textContent?.trim().substring(0, 15), w: r.width, h: r.height });
            }
          }
        });

        // Test clicking first tile to open modal
        let modalOpened = false;
        if (tiles.length > 0) {
          tiles[0].click();
          const modalBackdrop = document.getElementById('modal-backdrop');
          modalOpened = modalBackdrop.classList.contains('open');
          const closeBtn = document.getElementById('modal-close-btn');
          if (closeBtn) closeBtn.click();
        }

        return {
          viewport: { width: viewportWidth, height: window.innerHeight },
          scrollWidth: docWidth,
          hasHorizontalOverflow,
          hasHeroSection,
          tilesCount: tiles.length,
          tileWidth: firstTileRect ? Math.round(firstTileRect.width) : null,
          tileHeight: firstTileRect ? Math.round(firstTileRect.height) : null,
          iconSize: firstIconRect ? Math.round(firstIconRect.width) : null,
          modalInteractionTested: modalOpened,
          smallTargetsCount: smallTargets.length,
          smallTargetsSample: smallTargets.slice(0, 3)
        };
      })()
    `,
    returnByValue: true
  });

  ws.close();
  chromeProc.kill();

  return evalResult.result.value;
}

async function main() {
  const port = 4178;
  const server = await startServer(port);
  console.log('Optimization Loop Test Server running on port', port);

  try {
    console.log('\n======================================================');
    console.log('🔄 OPTIMIZATION FEEDBACK LOOP: MULTI-VIEWPORT AUDIT');
    console.log('======================================================');

    // Viewport 1: iOS Slip Phone / Flip Cover (320x658)
    const slipReport = await auditSession(port, 320, 658, 'iOS Slip Phone (320px)', 'shot-slip.png');
    console.log('\n📱 Viewport 1 [iOS Slip Phone 320x658]:', JSON.stringify(slipReport, null, 2));

    // Viewport 2: iPhone SE / 8 Standard (375x667)
    const seReport = await auditSession(port, 375, 667, 'iPhone SE (375px)', 'shot-se.png');
    console.log('\n📱 Viewport 2 [iPhone SE 375x667]:', JSON.stringify(seReport, null, 2));

    // Viewport 3: iPhone 13/14/15/16 (390x844)
    const iphoneReport = await auditSession(port, 390, 844, 'iPhone 15 (390px)', 'shot-iphone.png');
    console.log('\n📱 Viewport 3 [iPhone 15 390x844]:', JSON.stringify(iphoneReport, null, 2));

    // Viewport 4: Desktop (1280x800)
    const deskReport = await auditSession(port, 1280, 800, 'Desktop (1280px)', 'shot-desktop.png');
    console.log('\n💻 Viewport 4 [Desktop 1280x800]:', JSON.stringify(deskReport, null, 2));

    console.log('\n======================================================');
    console.log('🏆 OPTIMIZATION SUMMARY');
    console.log('======================================================');
    console.log(`- Hero section eliminated: ${!slipReport.hasHeroSection}`);
    console.log(`- All 18 app tiles rendered directly: ${slipReport.tilesCount === 18}`);
    console.log(`- Zero horizontal overflow on 320px Slip Phone: ${!slipReport.hasHorizontalOverflow}`);
    console.log(`- Zero horizontal overflow on Desktop: ${!deskReport.hasHorizontalOverflow}`);
    console.log(`- Modal / Sheet interaction verified: ${slipReport.modalInteractionTested}`);
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

main().catch(console.error);
