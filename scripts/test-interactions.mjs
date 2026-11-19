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

function startServer(port = 4176) {
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

async function runInteractionSuite(port = 4176) {
  const cdpPort = 9223;
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
  await new Promise(r => setTimeout(r, 600));

  console.log('\n--- Running Interactive Feedback Loop Tests ---');

  // Test 1: Category Filter Tab Click
  const test1 = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const iosTab = document.querySelector('button[data-category="ios"]');
        iosTab.click();
        const cards = document.querySelectorAll('.app-card');
        return {
          tabClicked: 'ios',
          visibleCards: cards.length,
          allCardsAreIOS: Array.from(cards).every(c => c.querySelector('.card-subcategory')?.textContent)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Test 1 (Category Filter "iOS Apps"):', test1.result.value);

  // Test 2: Search Input
  const test2 = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const input = document.getElementById('search-input');
        input.value = 'Lap';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const cards = document.querySelectorAll('.app-card');
        return {
          searchedTerm: 'Lap',
          visibleCards: cards.length,
          cardTitle: cards.length > 0 ? cards[0].querySelector('.card-title')?.textContent : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Test 2 (Search Filter "Lap"):', test2.result.value);

  // Test 3: Open Modal for Lap
  const test3 = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const firstCard = document.querySelector('.app-card');
        firstCard.click();
        const backdrop = document.getElementById('modal-backdrop');
        const modalTitle = document.getElementById('modal-title')?.textContent;
        const isOpen = backdrop.classList.contains('open');
        const bodyOverflow = document.body.style.overflow;
        return {
          modalOpened: isOpen,
          modalTitle: modalTitle,
          bodyLocked: bodyOverflow === 'hidden',
          hash: window.location.hash
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Test 3 (Modal Drawer Open):', test3.result.value);

  // Test 4: Close Modal with Close Button
  const test4 = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const closeBtn = document.getElementById('modal-close-btn');
        closeBtn.click();
        const backdrop = document.getElementById('modal-backdrop');
        return {
          modalClosed: !backdrop.classList.contains('open'),
          bodyUnlocked: document.body.style.overflow === ''
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Test 4 (Modal Close):', test4.result.value);

  // Test 5: Reset Filters
  const test5 = await sendCdp('Runtime.evaluate', {
    expression: `
      (function() {
        const resetBtn = document.getElementById('btn-reset-filters') || document.querySelector('.category-pill[data-category="all"]');
        resetBtn.click();
        const input = document.getElementById('search-input');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const cards = document.querySelectorAll('.app-card');
        return {
          totalCardsRestored: cards.length,
          matchesOriginal17: cards.length === 17
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Test 5 (Reset Filters):', test5.result.value);

  ws.close();
  chromeProc.kill();
}

async function main() {
  const server = await startServer(4176);
  try {
    await runInteractionSuite(4176);
  } finally {
    server.close();
  }
}

main().catch(console.error);
