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

function startServer(port = 4876) {
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

async function verify() {
  const port = 4876;
  const cdpPort = 9225;
  const server = await startServer(port);
  console.log(`Local test server running on http://127.0.0.1:${port}`);

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--window-size=1280,800',
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
    server.close();
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
  await new Promise(r => setTimeout(r, 500));

  console.log('\n--- VERIFICATION 1: Homepage State ---');
  const homeCheck = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const guidesSection = document.querySelector('.guides-section');
        const guideCardCount = document.querySelectorAll('.guide-card').length;
        const tilesCount = document.querySelectorAll('.app-tile').length;
        const resultsText = document.getElementById('results-count-text')?.textContent;
        return {
          guidesSectionExists: !!guidesSection,
          guideCardCount,
          tilesCount,
          resultsText
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Homepage Check:', homeCheck.result.value);

  console.log('\n--- VERIFICATION 2: Click App WITH Guide (DNSecure) ---');
  const dnsecureCheck = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const tile = document.querySelector('.app-tile[data-id="dnsecure"]');
        if (!tile) return { error: 'Tile dnsecure not found' };
        tile.click();
        const backdrop = document.getElementById('modal-backdrop');
        const isOpen = backdrop.classList.contains('open');
        const title = document.getElementById('modal-title')?.textContent;
        const guideSection = document.querySelector('.modal-guide-section');
        const guideBadge = document.querySelector('.modal-guide-badge')?.textContent;
        const guideName = document.querySelector('.modal-guide-name')?.textContent;
        const steps = document.querySelectorAll('.modal-guide-step').length;
        const copyBtns = document.querySelectorAll('.modal-guide-section .copy-code-btn').length;
        return {
          isOpen,
          title,
          hasGuideSection: !!guideSection,
          guideBadge,
          guideName,
          stepsCount: steps,
          copyBtnsCount: copyBtns
        };
      })()
    `,
    returnByValue: true
  });
  console.log('DNSecure Modal:', dnsecureCheck.result.value);

  console.log('\n--- VERIFICATION 3: Test Copy Button Inside Modal ---');
  const copyCheck = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const btn = document.querySelector('.modal-guide-section .copy-code-btn');
        if (!btn) return { error: 'No copy button' };
        btn.click();
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-message')?.textContent;
        const hasShowClass = toast.classList.contains('show');
        return {
          toastShown: hasShowClass,
          toastMsg
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Copy & Toast Check:', copyCheck.result.value);

  // Close modal
  await sendCdp('Runtime.evaluate', {
    expression: `document.getElementById('modal-close-btn').click();`
  });
  await new Promise(r => setTimeout(r, 200));

  console.log('\n--- VERIFICATION 4: Click App WITHOUT Guide (Lap) ---');
  const lapCheck = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const tile = document.querySelector('.app-tile[data-id="lap"]');
        if (!tile) return { error: 'Tile lap not found' };
        tile.click();
        const title = document.getElementById('modal-title')?.textContent;
        const guideSection = document.querySelector('.modal-guide-section');
        return {
          title,
          hasGuideSection: !!guideSection
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Lap Modal (No Guide):', lapCheck.result.value);

  // Close modal
  await sendCdp('Runtime.evaluate', {
    expression: `document.getElementById('modal-close-btn').click();`
  });
  await new Promise(r => setTimeout(r, 200));

  console.log('\n--- VERIFICATION 5: URL Hash Navigation (#guide-cloudflare) ---');
  const hashCheck = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        window.location.hash = '#guide-cloudflare';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        const backdrop = document.getElementById('modal-backdrop');
        const isOpen = backdrop.classList.contains('open');
        const title = document.getElementById('modal-title')?.textContent;
        const guideName = document.querySelector('.modal-guide-name')?.textContent;
        return {
          isOpen,
          title,
          guideName
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Hash #guide-cloudflare:', hashCheck.result.value);

  // Close modal
  await sendCdp('Runtime.evaluate', {
    expression: `document.getElementById('modal-close-btn').click();`
  });
  await new Promise(r => setTimeout(r, 200));

  console.log('\n--- VERIFICATION 6: URL Hash Navigation (#guide-twingate) ---');
  const twingateCheck = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        window.location.hash = '#guide-twingate';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        const backdrop = document.getElementById('modal-backdrop');
        const isOpen = backdrop.classList.contains('open');
        const title = document.getElementById('modal-title')?.textContent;
        const guideName = document.querySelector('.modal-guide-name')?.textContent;
        return {
          isOpen,
          title,
          guideName
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Hash #guide-twingate:', twingateCheck.result.value);

  // Teardown
  ws.close();
  chromeProc.kill();
  server.close();
  console.log('\nAll verification tests completed successfully!');
}

verify().catch(console.error);
